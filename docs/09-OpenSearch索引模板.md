# 09 · OpenSearch 索引模板（A10）

> 这是 `04-后台链路与数据模型.md` §5.2 / §5.3 的**可执行版本**：两个可组合索引模板 + 两个 ISM 策略。
> 文件在 `deploy/opensearch/`，装一次两条命令：`OPENSEARCH_URL=http://10.20.30.50:9200 ./apply.sh`（`--dry-run` 只打印命令）。
> 只做 `PUT`（幂等），不删任何东西。顺序有要求：先 ISM 策略，再模板 —— 策略靠自身的 `ism_template` 匹配 `mes-log-*`，索引一建出来就自动挂上。

## 一、先看这张表（全部是初值）

| 索引 | 命名 | 模板名 | 分片 | 副本 | `refresh_interval` | `codec` | `dynamic` | 读别名 | ISM 策略 | 到期 |
|---|---|---|---|---|---|---|---|---|---|---|
| 行 | `mes-log-line-{env}-{yyyy.MM.dd}` | `mes-log-line` | 1 | 1 | 5s | `best_compression` | `strict` | `mes-log-line-read` | `mes-log-line-360d` | 360 天删除 |
| 块 | `mes-log-exec-{env}-{yyyy.MM}` | `mes-log-exec` | 1 | 1 | 5s | `best_compression` | `strict` | `mes-log-exec-read` | `mes-log-exec-keep` | 不删除 |

- **不设写别名**（04 §5.2.1）。写入侧直接指定当天索引名；块文档写「**块首行时刻**」那个月的索引，因为闭口 UPSERT 要按 `_id` 定位。
- `{env}` 取**小写**（`prod` / `pirun`）；字段值 `ENV` 仍是大写 `PROD` / `PIRUN`，两者不是一回事。
- 读别名写在模板里，**新索引一建就自带**，查询侧只认别名。
- 分片副本 1 / 1 是「按天索引 + 中等偏下量级」的起步值（压测后回填，见 §六）。

**OpenSearch 用的是 ISM，不是 ES 的 ILM。** 接口是 `_plugins/_ism/policies/{id}`；**策略不写进索引模板**，靠策略自带的 `ism_template` 按索引模式自动挂（官方唯一推荐路径）。旧的 `plugins.index_state_management.policy_id` 已弃用、3.x 下还可能让索引创建被 unknown setting 拒掉，不要加。04 里沿用「ILM」这个习惯叫法，落到配置上按 ISM 写。

## 二、两个 ISM 策略的阶段

| 策略 | 适用 | hot | warm | cold | delete |
|---|---|---|---|---|---|
| `mes-log-line-360d` | `mes-log-line-*` | 0 ~ 30d（priority 100） | 30d 起：只读 + 副本 1 + force merge 单段 + priority 50 | 180d 起：priority 0 | 360d 起：删除 |
| `mes-log-exec-keep` | `mes-log-exec-*` | 0 ~ 360d（priority 100） | — | 360d 起：只读 + priority 0，**不删** | 无 |

- 索引按天/按月命名、**不用 rollover**，所以 `min_index_age` 就是索引年龄，到期日与索引名里的日期一眼能对上（04 §5.2.5）。
- 汇总索引归档后**不需要重新可写**：块文档写哪个索引由块首行时间决定，超过 360 天的块早就闭口了（04 §5.2.5 已拍）；唯一理论例外（超时封口块 360 天后被迟到行重开）由 06 §1.3.1 路 4 的**老块守卫**挡住 —— 块首行 ≥ 360 天不写老块。
- 冷阶段的「低配节点 / 可搜索快照」属部署侧动作，需要集群先有节点属性，模板里不写死。

## 三、行索引模板（全文）

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

五处值得单说的写法：

- **`LOG_RAW` 既不建索引也不建 `doc_values`。** 它只在 `_source` 里供还原用，检索不到（04 §5.3.1 的 `index: false`），省一份正排。
- **`LOG_TIME` 只认日志格式**（`yyyy/MM/dd HH:mm:ss.SSS`）加 `epoch_millis` 兜底。写进来一个 ISO 串会直接报错 —— 这是有意的，落库格式只有一种（04 §3.2.1）。
- **`LOG_TIME` 是 `date` 且只认日志格式**：区间粗筛、翻页排序都打它（`SORT_KEY` 已退役，04 §3.2.2）；行 `_id` 不占模板字段（构造见 04 §3.2.2，搜索结果 hit 自带）。
- **`SERVER_NUMBER` 用 `keyword` 而不是整数**：编号是标识、不是度量，只做等值筛选不做范围；用整数反而会在遇到非数字编号时**写入失败**（`dynamic: strict` 下直接报错）。
- **策略不写在模板里。** 它靠 ISM 策略自带的 `ism_template` 按索引模式自动挂（§一）—— 3.x 已弃用 `plugins.index_state_management.policy_id`，写进去可能让索引创建被 unknown setting 直接拒掉。

## 四、块索引

块索引字段就是 04 §5.3.2 那张表，四组 `nested` 是重点：

| 字段 | 类型 | 子字段 |
|---|---|---|
| `REOPEN_LOG` | nested | `PREV_END_TIME` / `FIRST_TIME`（date，日志格式）、`GAP_MS`（long）、`REOPENED_AT`（date，墙钟） |
| `COST_BREAKDOWN` | nested | `ITEM` / `GROUP`（keyword）、`COUNT`（integer）、`SUM_MS` / `MAX_MS`（long）、`FIRST_BEGIN_TS` / `LAST_END_TS`（date，日志格式） |
| `INNER_RULES` | nested | `NAME`（keyword）、`START_TIME` / `END_TIME`（date，日志格式）。一次内部 Rule 调用一条，按 `START_TIME` 升序；**`NAME` 与块 `RULENAME` 同名的整对放弃**（04 §3.2.3） |
| `HANG_LIST` | nested | `START_LINE_ID` / `END_LINE_ID`（keyword）、`START_LINE_LOG` / `END_LINE_LOG`（keyword，`index: false` + `doc_values: false` —— 同 `LOG_RAW` 先例，纯展示不检索，省一份正排）、`HANG_REASON`（keyword）、`HANG_COST_MS`（long）、`START_TIME` / `END_TIME`（date，日志格式）。一处 Server Hang 一条、按 `START_TIME` 升序、时差 > 0 才记（判定与配置见模块 5 `Server Hang Reason Config`、`06` §2.2 / §4.7） |
| `LOCK_SEQ` | keyword（多值） | 无子字段。元素形如 `CARRIER\|FPB08765`，**首现定序、同值去重**的锁顺序（04 §3.2.3）；数组保序，空 `LOCK_ID` 的加锁行不进序列 |

**`ORDER_BY` 是 `long`** —— 19 位纯数字（单位时间戳 14 位 + 5 位序号），排序与 `range` 都按数值走，「取最新一块」直接按它 `desc`。

时间字段分两种格式，别混：`START_TIME` / `END_TIME` / `LAST_LINE_TIME` / `COST_BREAKDOWN` / `INNER_RULES` / `HANG_LIST` 的时间子字段走**日志格式**，`CLOSE_TIME` / `REOPENED_AT` 是**墙钟**、走 `strict_date_optional_time||epoch_millis`。

七个业务字段（`RULENAME` / `LOTID` / `EQPID` / `PORTID` / `CARRIERID` / `USERID` / `TID`）与 `ERR_CODE`、`LOCK_SEQ` 都可能多值 —— mapping 不用特殊处理，同字段多值就是 `keyword` 数组。`ERR_CODE` 是**并集去重**后的数组，不代表块失败；`LOCK_SEQ` 是**首现定序**的锁顺序数组。

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
