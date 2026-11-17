# 09 · OpenSearch 索引模板（A10）

> 这是 `04-后台链路与数据模型.md` §5.2 / §5.3 的**可执行版本**：两个可组合索引模板 + 两个 ISM 策略。
> 文件在 `deploy/opensearch/`：2 个 ISM 策略 + 2 个可组合索引模板，共 4 个 JSON。部署方案由项目后端按项目要求整理，本目录只交可执行配置。
> 装入只做 `PUT`（幂等），不删任何东西。顺序有要求：先 ISM 策略，再模板 —— 策略靠自身的 `ism_template` 匹配 `mes-log-*`，索引一建出来就自动挂上。

## 一、两个索引模板（全部是初值）

| 索引 | 命名 | 模板名 | 分片 | 副本 | `refresh_interval` | `codec` | `dynamic` | 读别名 | ISM 策略 | 到期 |
|---|---|---|---|---|---|---|---|---|---|---|
| 行 | `mes-log-line-{env}-{yyyy.MM.dd}` | `mes-log-line` | 1 | 1 | 5s | `best_compression` | `strict` | `mes-log-line-read` | `mes-log-line-360d` | 360 天删除 |
| 块 | `mes-log-exec-{env}-{yyyy.MM}` | `mes-log-exec` | 1 | 1 | 5s | `best_compression` | `strict` | `mes-log-exec-read` | `mes-log-exec-keep` | 不删除 |

| 项 | 口径 |
|---|---|
| 写别名 | **不设**（04 §5.2.1）。写入侧直接指定当天索引名；块文档写「**块首行时刻**」那个月的索引，因为闭口 UPSERT 要按 `_id` 定位 |
| `{env}` | 取**小写**（`prod` / `pirun`）；字段值 `ENV` 仍是大写 `PROD` / `PIRUN`，两者不是一回事 |
| 读别名 | 写在模板里，**新索引一建就自带**，查询侧只认别名 |
| 分片副本 1 / 1 | 「按天索引 + 中等偏下量级」的起步值，压测后回填（§六） |
| ISM 不是 ILM | 接口 `_plugins/_ism/policies/{id}`；**策略不写进索引模板**，靠策略自带的 `ism_template` 按索引模式自动挂（官方唯一推荐路径）。旧的 `plugins.index_state_management.policy_id` 已弃用、3.x 下还可能让索引创建被 unknown setting 拒掉。04 里沿用「ILM」这个习惯叫法，落到配置上按 ISM 写 |

## 二、两个 ISM 策略的阶段

| 策略 | 适用 | hot | warm | cold | delete |
|---|---|---|---|---|---|
| `mes-log-line-360d` | `mes-log-line-*` | 0 ~ 30d（priority 100） | 30d 起：只读 + 副本 1 + force merge 单段 + priority 50 | 180d 起：priority 0 | 360d 起：删除 |
| `mes-log-exec-keep` | `mes-log-exec-*` | 0 ~ 360d（priority 100） | — | 360d 起：只读 + priority 0，**不删** | 无 |

| 项 | 口径 |
|---|---|
| 索引按天 / 按月命名、不用 rollover | `min_index_age` 就是索引年龄，到期日与索引名里的日期一眼能对上（04 §5.2.5） |
| 汇总索引归档后不需要重新可写 | 块文档写哪个索引由块首行时间决定，超过 360 天的块早就闭口了（04 §5.2.5 已拍）；唯一理论例外（超时封口块 360 天后被迟到行重开）由 06 §1.3.1 路 4 的**老块守卫**挡住 —— 块首行 ≥ 360 天不写老块 |
| 冷阶段节点分配 | 「低配节点 / 可搜索快照」属部署侧动作，需要集群先定义节点属性，模板里不写死 |

## 三、行索引模板

`deploy/opensearch/11-template-line.json`：

```json
{
  "index_patterns": ["mes-log-line-*"],
  "priority": 200,
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "refresh_interval": "5s",
      "index.codec": "best_compression"
    },
    "mappings": {
      "dynamic": "strict",
      "properties": {
        "@timestamp":      { "type": "date" },
        "system.name":     { "type": "keyword" },
        "ENV":             { "type": "keyword" },
        "HOSTIP":          { "type": "keyword" },
        "SERVER_ID":       { "type": "keyword" },
        "SERVER_CATEGORY": { "type": "keyword" },
        "SERVER_NUMBER":   { "type": "keyword" },
        "LOG_TIME":        { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
        "LOG_FILE":        { "type": "keyword" },
        "LOG_FINGERPRINT": { "type": "keyword" },
        "LOG_OFFSET":      { "type": "long" },
        "LOG_RAW":         { "type": "keyword", "index": false, "doc_values": false },
        "LOG_BODY":        { "type": "text" },
        "MSG_KIND":        { "type": "keyword" },
        "CALL_SYS":        { "type": "keyword" },
        "LOCK_OBJ":        { "type": "keyword" },
        "LOCK_ID":         { "type": "keyword" },
        "ERR_CODE":        { "type": "keyword" },
        "RULE_RESULT":     { "type": "keyword" },
        "INNER_RULE_NAME": { "type": "keyword" }
      }
    },
    "aliases": { "mes-log-line-read": {} }
  }
}
```

字段含义（`properties` 20 个）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `@timestamp` | date | 采集链路的**摄入时刻**，行落进链路的时刻。派生层快循环的活跃流发现、重放水位线、告警扫描窗口都打在它上面；兼作纯文本行 `LOG_TIME` 的兜底（04 §3.2.1 / §3.3）。**与块索引的 `@timestamp` 同名不同义** |
| `system.name` | keyword | 系统名常量 `MES-300Works`，每条查询都带它 |
| `ENV` / `HOSTIP` / `SERVER_ID` | keyword | 锁流三元组，三个必须齐全 |
| `SERVER_CATEGORY` / `SERVER_NUMBER` | keyword | 服务类目与编号，从 `SERVER_ID` 反推。`SERVER_NUMBER` 用 keyword 不用整数：编号是标识不是度量，用整数遇到非数字编号会在 `dynamic: strict` 下直接写入失败 |
| `LOG_TIME` | date，``yyyy/MM/dd HH:mm:ss.SSS\|\|epoch_millis`` | 日志自身时间。区间粗筛与翻页排序都打它；行首解析不出前缀的行取 `@timestamp` 归一后的值。只认日志格式，写 ISO 串会直接报错（落库格式只有一种，04 §3.2.1） |
| `LOG_FILE` | keyword | 日志文件名 |
| `LOG_FINGERPRINT` | keyword | 文件头 1KiB 哈希（SHA-256 64 hex），一个指纹 = 一个物理文件、永不复用；两级重排的第一级 |
| `LOG_OFFSET` | long | 行在文件内的字节偏移；两级重排的第二级 |
| `LOG_RAW` | keyword（`index: false`、`doc_values: false`） | 整行原文，只在 `_source` 里供还原用、检索不到，省一份正排 |
| `LOG_BODY` | text | 唯一分词的字段 |
| `MSG_KIND` | keyword | 加工层打的行标签，派生层全部跨行判断的唯一输入 |
| `CALL_SYS` | keyword | 调用类行的被调系统（`SPL` / `R2R` / …），开放集合 |
| `LOCK_OBJ` / `LOCK_ID` | keyword | 锁类行的对象与 ID（`LOT` / `CARRIER` / `EQP`），开放集合、形态不固定 |
| `ERR_CODE` | keyword（多值） | 行内 `Error(<码>)` 的报错码，一行可多个、保留出现顺序不去重；只表示「这行报错」，不表示块失败 |
| `RULE_RESULT` | keyword | `RULE_REPLY` 行的业务结果，取值原样（`PASS` / `CANCELRULE` / …） |
| `INNER_RULE_NAME` | keyword | 内部 Rule 起止行的 Rule 名 |

| 项 | 口径 |
|---|---|
| 行 `_id` | 行身份串，不占模板字段（构造见 04 §3.2.2，搜索结果 hit 自带）；`SORT_KEY` 已退役 |
| 策略不写在模板里 | 靠 ISM 策略自带的 `ism_template` 自动挂；3.x 已弃用 `plugins.index_state_management.policy_id`，写进去可能让索引创建被 unknown setting 直接拒掉 |

## 四、块索引模板

`deploy/opensearch/12-template-exec.json`，`mes-log-exec-{env}-{yyyy.MM}`，按月切、永久归档不删。

字段含义（`properties` 33 个，其中 4 组 `nested`）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `@timestamp` | date | **派生服务首次建块那一刻的系统当前时刻**（墙钟 ISO）。批次① `_create` 写一次、②③不回写；`doc_as_upsert` 补建的块该字段为空。业务时间窗打 `START_TIME`，不打它（04 §5.2.3）；**与行索引的 `@timestamp` 同名不同义** |
| `ORDER_BY` | long | 块的处理序 = 单位时间戳 14 位（`yyyyMMddHHmmss`，取该单位处理时的系统时间）+ 5 位序号，共 19 位。「取最新一块」按它 `desc`；19 位已超 JS 安全整数，前端按字符串接 |
| `START_LINE_ID` / `END_LINE_ID` | keyword | 块首行 / 末行身份串。两端点截断块区间；末行 ID 还当「末行之后有没有行」的锚点 |
| `ENV` / `HOSTIP` / `SERVER_ID` / `SERVER_CATEGORY` / `SERVER_NUMBER` | keyword | 锁流三元组 + 查询分组，从行文档照抄 |
| `system.name` | keyword | 从行文档照抄（块内每行同值），汇总索引查询靠它过滤 |
| `REQUEST_TYPE` | keyword | 只 `Rule` / `TXN` 两值，判不出留空 |
| `START_TIME` / `END_TIME` | date，日志格式 | 块首行 / 末行的日志时间，粗筛区间端点；`END_TIME` 未闭口随重放推进、闭口定格在末行 |
| `LAST_LINE_TIME` | date，日志格式 | 重放已推进到的末行日志时间，未闭口期间也更新；慢循环判静默只看它，闭口后与 `END_TIME` 同值 |
| `CLOSE_TIME` | date，墙钟 | 判定闭口那一刻的墙钟，仅审计、不参与计算 |
| `EXEC_STATUS` | keyword | 进行中 / 已完成 / 中断 / 超时封口 |
| `REOPEN_LOG` | nested | 解封账，一次解封一条、只增不改。子字段 `PREV_END_TIME` / `FIRST_TIME`（date，日志格式）、`GAP_MS`（long）、`REOPENED_AT`（date，墙钟） |
| `TOTAL_COST_MS` / `COST_SUM_MS` / `UNACCOUNTED_COST_MS` | long | 总耗时 / Σ 各项耗时 / 未归因时间 |
| `COST_BREAKDOWN` | nested | 一项一条：`ITEM` / `GROUP`（keyword）、`COUNT`（integer）、`SUM_MS` / `MAX_MS`（long）、`FIRST_BEGIN_TS` / `LAST_END_TS`（date，日志格式） |
| `LOCK_SEQ` | keyword（多值） | 锁顺序，元素形如 `CARRIER\|FPB08765`；首现定序、同值去重，数组保序；空 `LOCK_ID` 的加锁行不进序列 |
| `INNER_RULES` | nested | 内部 Rule 调用明细，一次调用一条：`NAME`（keyword）、`START_TIME` / `END_TIME`（date，日志格式）；按 `START_TIME` 升序，**`NAME` 与块 `RULENAME` 同名的整对放弃** |
| `HANG_LIST` | nested | Server Hang 一处一条：`START_LINE_ID` / `END_LINE_ID` / `HANG_REASON`（keyword）、`START_LINE_LOG` / `END_LINE_LOG`（keyword，`index: false` + `doc_values: false`，纯展示不检索、省一份正排）、`HANG_COST_MS`（long）、`START_TIME` / `END_TIME`（date，日志格式）；按 `START_TIME` 升序、时差 > 0 才记 |
| `RULENAME` / `LOTID` / `EQPID` / `PORTID` / `CARRIERID` / `USERID` / `TID` | keyword（可多值） | 块首行解析出的七个业务字段，按出现顺序、同值去重；解析不到留空，不另设 MISS 标记 |
| `ERR_CODE` | keyword（多值） | 块内 `RULE_ERR_LINE` 行 `ERR_CODE` 的并集去重；非空不代表块失败 |
| `RULE_RESULT` | keyword | 块级业务结果，取块内最后一条 `RULE_REPLY` 行的行级值原样落库；等于 `CANCELRULE` 才是块级失败 |
| `_id` = `REQUEST_EXEC_ID` | keyword | 不占模板字段。`ENV + HOSTIP + SERVER_ID + 块首行身份串`，**不等于** `START_LINE_ID` |

| 项 | 口径 |
|---|---|
| 时间字段两种格式 | `@timestamp` / `CLOSE_TIME` / `REOPEN_LOG.REOPENED_AT` 走墙钟 ``strict_date_optional_time\|\|epoch_millis``；`START_TIME` / `END_TIME` / `LAST_LINE_TIME` 与 `COST_BREAKDOWN` / `INNER_RULES` / `HANG_LIST` 的时间子字段走日志格式 `yyyy/MM/dd HH:mm:ss.SSS` |
| 多值字段 | 七个业务字段 + `ERR_CODE` + `LOCK_SEQ` 都是 `keyword` 数组，mapping 不用特殊处理 |
| 业务时间窗 | 打 `START_TIME`，不打块上的 `@timestamp`（04 §5.2.3） |

## 五、`dynamic: strict` 的前置条件

两个模板都是 `strict` —— 写进一个模板里没声明的字段，**整篇文档被拒**。这样设计的理由：字段清单是固定的（04 §4 / §5.3），漏改模板应该立刻暴露，而不是悄悄多出一个查不到的字段。

它带来一条**必须做的配套**：

> 加工层输出前，按 04 §4 的输出字段清单把字段裁干净。Filebeat 会带上 `agent.*` / `host.*` / `ecs.*` / `log.file.*` / `input.type` 这类元数据，Logstash 里不加 `mutate` / `prune` 裁剪就写进去，会因 `strict` 全部 400。

如果希望上线期更稳、宁可静默忽略未知字段，把两个模板里的 `"dynamic": "strict"` 改成 `"dynamic": false`（未知字段不进索引、仍留在 `_source`）。二选一，改一处即可；推荐保留 `strict`。

## 六、初值可调项（压测或部署后回填）

| 项 | 现值 | 怎么改 |
|---|---|---|
| `refresh_interval` | 行/块 5s | 读侧已有 `now − L`（32 秒）水位线，5 秒足够。写压大时上调 |
| `index.codec` | `best_compression` | 省磁盘、费 CPU。只能建索引时定，改后新索引生效 |
| 副本数 | 1 | 集群节点数变化时按需调；温阶段固定降到 1 |
| warm / delete 年龄 | 30d / 360d | 改 ISM 策略即可，对已建索引同样生效 |
| `dynamic` | `strict` | 见 §五 |
| 分片数 | 1 | 按天索引、量级中等偏下；**数据量估算**出来后按实际日增量再核 |

## 七、来源与未做项

| 内容 | 出处 |
|---|---|
| 行文档字段清单 | 04 §5.3.1 |
| 块文档字段清单 | 04 §5.3.2 |
| 索引划分、读/写别名、`{env}` 大小写 | 04 §5.2.1 |
| 保留策略三档与「归档不删」 | 04 §5.2.5 |

两条**没做**，留到压测或部署阶段：

- **`index.sort.field: ["LOG_TIME"]`**（行索引按时间预排序，省掉每次查询的排序开销、提升区间扫描）。它对写入有成本、且**建索引后不可改**，压测后再定。
- **冷阶段的节点分配**（低配节点 / 可搜索快照）：需要集群先定义节点属性，属部署侧。
