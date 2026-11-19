# 09 · OpenSearch 索引模板（A10）

> 这是 `04-后台链路与数据模型.md` §4 的**可执行版本**：两个可组合索引模板 + 两个 ISM 策略。**行、块两套索引字段口径均以本文为准**（行 → §三、块 → §四）—— 04 已冻结为纯行文档且只讲怎么给行字段赋值，09 是两套 mapping 字段清单 / 类型 / 含义的唯一权威。
> 文件在 `deploy/opensearch/`：2 个 ISM 策略 + 2 个可组合索引模板，共 4 个 JSON。部署方案由项目后端按项目要求整理，本目录只交可执行配置。
> 装入只做 `PUT`（幂等），不删任何东西。顺序有要求：先 ISM 策略，再模板 —— 策略靠自身的 `ism_template` 匹配 `mes-log-*`，索引一建出来就自动挂上。

## 一、两个索引模板（全部是初值）

| 索引 | 命名 | 模板名 | 分片 | 副本 | `refresh_interval` | `codec` | `dynamic` | 读别名 | ISM 策略 | 到期 |
|---|---|---|---|---|---|---|---|---|---|---|
| 行 | `mes-log-line-{yyyy.MM}` | `mes-log-line` | 1 | 1 | 5s | `best_compression` | `strict` | `mes-log-line-read` | `mes-log-line-360d` | 360 天删除 |
| 块 | `mes-log-exec-{yyyy.MM}` | `mes-log-exec` | 1 | 1 | 5s | `best_compression` | `strict` | `mes-log-exec-read` | `mes-log-exec-keep` | 不删除 |

| 项 | 口径 |
|---|---|
| 写别名 | **不设**（04 §4.1）。写入侧直接指定当月索引名；块文档写「**块首行时刻**」那个月的索引，因为闭口 UPSERT 要按 `_id` 定位 |
| 环境区分 | **索引名不带环境段**：`PRD` / `PIRUN` 默认都算 **Production**、写进同一套索引；环境由**框架 `prefix`** 前置区分 —— 索引名、读别名、`index_patterns`、ISM `ism_template` 四处用**同一前缀**；本文写的是去 `prefix` 的**基名** |
| 读别名 | 写在模板里，**新索引一建就自带**，查询侧只认别名 |
| 分片副本 1 / 1 | 「按月索引 + 中等偏下量级」的起步值，压测后回填（§六） |
| ISM 不是 ILM | 接口 `_plugins/_ism/policies/{id}`；**策略不写进索引模板**，靠策略自带的 `ism_template` 按索引模式自动挂（官方唯一推荐路径）。旧的 `plugins.index_state_management.policy_id` 已弃用、3.x 下还可能让索引创建被 unknown setting 拒掉。04 里沿用「ILM」这个习惯叫法，落到配置上按 ISM 写 |

## 二、两个 ISM 策略的阶段

| 策略 | 适用 | hot | warm | cold | delete |
|---|---|---|---|---|---|
| `mes-log-line-360d` | `mes-log-line-*` | 0 ~ 30d（priority 100） | 30d 起：只读 + 副本 1 + force merge 单段 + priority 50 | 180d 起：priority 0 | 360d 起：删除 |
| `mes-log-exec-keep` | `mes-log-exec-*` | 0 ~ 360d（priority 100） | — | 360d 起：只读 + priority 0，**不删** | 无 |

| 项 | 口径 |
|---|---|
| 索引按月命名、不用 rollover | `min_index_age` 就是索引年龄，到期月与索引名里的月份一眼能对上（04 §4.4） |
| 汇总索引归档后不需要重新可写 | 块文档写哪个索引由块首行时间决定，超过 360 天的块早就闭口了（04 §4.4 已拍）；且静默封口即终局、不再解封，不存在归档后被迟到行重开的情况 |
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
| `system.name` | keyword | 系统名常量 `MES-300Works`，采集端注入、加工层透传；每条查询都带它，隔离混进同集群的其他系统。**名字里的点号是 ES 的路径分隔符**，不是普通字符 |
| `ENV` / `HOSTIP` / `SERVER_ID` | keyword | 锁流三元组，三个必须齐全 |
| `SERVER_CATEGORY` / `SERVER_NUMBER` | keyword | 服务类目与编号，从 `SERVER_ID` 反推。`SERVER_NUMBER` 用 keyword 不用整数：编号是标识不是度量，用整数遇到非数字编号会在 `dynamic: strict` 下直接写入失败 |
| `LOG_TIME` | date，``yyyy/MM/dd HH:mm:ss.SSS\|\|epoch_millis`` | 日志自身时间。区间粗筛与翻页排序都打它；行首解析不出前缀的行取 `@timestamp` 归一后的值。只认日志格式，写 ISO 串会直接报错（落库格式只有一种，04 §3.2.1） |
| `LOG_FILE` | keyword | 日志文件名 |
| `LOG_FINGERPRINT` | keyword | 文件头 1KiB 哈希（SHA-256 64 hex），一个指纹 = 一个物理文件、永不复用；二级重排的**分堆**步（04 §4.3 第 1 步） |
| `LOG_OFFSET` | long | 行在文件内的字节偏移；二级重排的**堆内升序**步（04 §4.3 第 3 步），同一堆内按它就是写入顺序 |
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

`deploy/opensearch/12-template-exec.json`：`mes-log-exec-{yyyy.MM}`（基名，环境前缀由框架 `prefix` 加），按月切、永久归档不删。一块 = 一次请求执行；`_id` = `REQUEST_EXEC_ID`，在块整个生命周期里不变。**本节是块索引字段口径的唯一权威**（04 已冻结为纯行文档，块字段不在 04）；派生侧怎么用这些字段见 `06-派生服务工程实现.md` §二 / §三。

```json
{
  "index_patterns": ["mes-log-exec-*"],
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
        "@timestamp":       { "type": "date" },
        "START_LINE_ID":    { "type": "keyword" },
        "END_LINE_ID":      { "type": "keyword" },
        "ENV":              { "type": "keyword" },
        "HOSTIP":           { "type": "keyword" },
        "SERVER_ID":        { "type": "keyword" },
        "SERVER_CATEGORY":  { "type": "keyword" },
        "SERVER_NUMBER":    { "type": "keyword" },
        "system.name":      { "type": "keyword" },
        "REQUEST_TYPE":     { "type": "keyword" },
        "ORDER_BY":         { "type": "long" },
        "START_TIME":       { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
        "END_TIME":         { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
        "LAST_LINE_TIME":   { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
        "CLOSE_TIME":       { "type": "date", "format": "strict_date_optional_time||epoch_millis" },
        "EXEC_STATUS":      { "type": "keyword" },
        "TOTAL_COST_MS":       { "type": "long" },
        "COST_SUM_MS":         { "type": "long" },
        "UNACCOUNTED_COST_MS": { "type": "long" },
        "COST_BREAKDOWN": {
          "type": "nested",
          "properties": {
            "ITEM":          { "type": "keyword" },
            "GROUP":         { "type": "keyword" },
            "COUNT":         { "type": "integer" },
            "SUM_MS":        { "type": "long" },
            "MAX_MS":        { "type": "long" },
            "FIRST_BEGIN_TS":{ "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
            "LAST_END_TS":   { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" }
          }
        },
        "INNER_RULES": {
          "type": "nested",
          "properties": {
            "NAME":       { "type": "keyword" },
            "START_TIME": { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
            "END_TIME":   { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" }
          }
        },
        "HANG_LIST": {
          "type": "nested",
          "properties": {
            "START_LINE_ID":  { "type": "keyword" },
            "END_LINE_ID":    { "type": "keyword" },
            "START_LINE_LOG": { "type": "keyword", "index": false, "doc_values": false },
            "END_LINE_LOG":   { "type": "keyword", "index": false, "doc_values": false },
            "HANG_REASON":    { "type": "keyword" },
            "HANG_COST_MS":   { "type": "long" },
            "START_TIME":     { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" },
            "END_TIME":       { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" }
          }
        },
        "RULENAME":    { "type": "keyword" },
        "LOTID":       { "type": "keyword" },
        "EQPID":       { "type": "keyword" },
        "PORTID":      { "type": "keyword" },
        "CARRIERID":   { "type": "keyword" },
        "USERID":      { "type": "keyword" },
        "TID":         { "type": "keyword" },
        "ERR_CODE":    { "type": "keyword" },
        "RULE_RESULT": { "type": "keyword" },
        "LOCK_SEQ":    { "type": "keyword" }
      }
    },
    "aliases": {
      "mes-log-exec-read": {}
    }
  },
  "_meta": {
    "index": "mes-log-exec-{yyyy.MM}，每月一个，不带环境段（环境由部署前缀区分）；块文档按块首行时刻选索引；读别名 mes-log-exec-read（不设写别名）",
    "mapping": "32 个字段、dynamic: strict；3 个 nested：COST_BREAKDOWN / INNER_RULES / HANG_LIST",
    "fields": "RULENAME / LOTID / EQPID / PORTID / CARRIERID / USERID / TID / ERR_CODE 可多值（keyword 数组）；@timestamp、CLOSE_TIME 用 ISO 墙钟，其余时间字段用日志格式 yyyy/MM/dd HH:mm:ss.SSS"
  }
}
```

字段共 **32 个**（`_id` 不占模板字段），其中 3 组 `nested`（`COST_BREAKDOWN` / `INNER_RULES` / `HANG_LIST`）。

| 字段 | 类型 | 含义 |
|---|---|---|
| `_id` = `REQUEST_EXEC_ID` | keyword | `ENV + HOSTIP + SERVER_ID + 块首行身份串`，**不等于** `START_LINE_ID`；不占模板字段 |
| `START_LINE_ID` / `END_LINE_ID` | keyword | 块首行 / 末行身份串（取自 `hit._id`）。两端点截断块区间；`END_LINE_ID` 还当「末行之后有没有行」的锚点（取数时留在结果里当参照，不剔） |
| `ENV` / `HOSTIP` / `SERVER_ID` | keyword | 锁流三元组，从行文档照抄；三个必须齐全，缺一个就跨流误捞 |
| `SERVER_CATEGORY` / `SERVER_NUMBER` | keyword | 服务类目与编号（`FAB` + `2`），加工层从 `SERVER_ID` 反推，照抄进块供查询分组 |
| `system.name` | keyword | 常量 `MES-300Works`，照抄自块首行（块内每行同值）；每条查询都带它，隔离混进同集群的其他系统。写入用点号键名，ES 当路径建字段 |
| `REQUEST_TYPE` | keyword | 只 `Rule` / `TXN` 两值，判不出留空；TXN 只取 TxnName |
| `ORDER_BY` | long | 块的处理序 = 单位时间戳 14 位（`yyyyMMddHHmmss`，取该单位处理时的系统时间）+ 5 位序号（该 `REQ_BEGIN` 在单位行里的行号、补零），共 19 位。「取最新一块」按它 `desc`；19 位已超 JS 安全整数，前端按字符串接 |
| `START_TIME` | date，日志格式 | 块首行 `LOG_TIME`，区间左端粗筛端点 |
| `END_TIME` | date，日志格式 | 区间右端，= **本块末行自己的** `LOG_TIME`（不是「末行 + 1」，时间加不出下一行）。未闭口随重放推进、闭口定格在末行；闭口与未闭口同义，都是「当前末行」。取数写法 `gte END_TIME`、`END_LINE_ID` 留结果当锚点 |
| `LAST_LINE_TIME` | date，日志格式 | 重放已推进到的末行日志时间，未闭口期间也更新；慢轮次判静默只看它，闭口后与 `END_TIME` 同值 |
| `CLOSE_TIME` | date，墙钟 | 判定闭口那一刻的墙钟，仅审计、不参与任何计算 |
| `@timestamp` | date，墙钟 | **派生服务首次建块那一刻的系统当前时刻**。批次① `_create` 写一次、②③不回写；`doc_as_upsert` 补建的块该字段为空。**与行索引的 `@timestamp` 同名不同义**：行上是采集摄入时刻、进业务时间窗，块上不进业务时间窗（业务时间一律看 `START_TIME` / `END_TIME`） |
| `EXEC_STATUS` | keyword | 进行中 / 已完成 / 中断 / 超时封口。分路只看最新一块这一个字段 |
| `RULENAME` / `LOTID` / `EQPID` / `PORTID` / `CARRIERID` / `USERID` / `TID` | keyword（可多值） | 块首行解析出的七个业务字段，按出现顺序追加、同值去重；只解析块首行这一行，取不到留空。算法见 `06-附录A-块首行解析方案.md` |
| `RULE_RESULT` | keyword | 块级业务结果，取块内最后一条 `RULE_REPLY` 行的行级值原样落库（`PASS` / `CANCELRULE` / …开放集合）。**不来自首行解析**；等于 `CANCELRULE` 才是块级失败 |
| `ERR_CODE` | keyword（多值） | 块内 `RULE_ERR_LINE` 行 `ERR_CODE` 的并集去重；非空不代表块失败 |
| `LOCK_SEQ` | keyword（多值） | 锁顺序：按重放序列首次出现的 `LOCK_OBJ\|LOCK_ID` 逐个追加，首现定序、同值去重，数组保序；空 `LOCK_ID` 的加锁行不进序列 |
| `TOTAL_COST_MS` | long | `END_TIME − START_TIME` |
| `COST_SUM_MS` | long | Σ 各项 `SUM_MS` |
| `UNACCOUNTED_COST_MS` | long | `TOTAL_COST_MS − COST_SUM_MS`，未归因时间 |
| `COST_BREAKDOWN` | nested | 一项一条（锁对象 / 被调系统各分组）：`ITEM`（`LOCK` / `CALL`）、`GROUP`（keyword）、`COUNT`（integer）、`SUM_MS` / `MAX_MS`（long）、`FIRST_BEGIN_TS` / `LAST_END_TS`（date，日志格式） |
| `INNER_RULES` | nested | 内部 Rule 调用明细，一次调用一条：`NAME`（keyword）、`START_TIME` / `END_TIME`（date，日志格式）；按 `START_TIME` 升序，**`NAME` 与块 `RULENAME` 同名的整对放弃**（外层自身的执行行不是嵌套调用），未等到 `END` 的 `START` 记下但 `END_TIME` 留空 |
| `HANG_LIST` | nested | Server Hang 一处一条：`START_LINE_ID` / `END_LINE_ID` / `HANG_REASON`（keyword）、`START_LINE_LOG` / `END_LINE_LOG`（keyword，`index: false` + `doc_values: false`，纯展示不检索）、`HANG_COST_MS`（long）、`START_TIME` / `END_TIME`（date，日志格式）。按 `START_TIME` 升序、时差 > 0 才记；只对 `RULENAME` 命中启用 Hang 配置的块判（配置表在模块5） |

关键口径：

- **两种时间格式**：`@timestamp` / `CLOSE_TIME` 走墙钟 `strict_date_optional_time||epoch_millis`；`START_TIME` / `END_TIME` / `LAST_LINE_TIME` 与三个 nested 里的时间子字段走日志格式 `yyyy/MM/dd HH:mm:ss.SSS`。两套别混。
- **多值字段**：七个业务字段 + `ERR_CODE` + `LOCK_SEQ` 都是 keyword 数组，mapping 无需特殊处理；`RULE_RESULT` 取最后一条、不记多值。
- **业务时间窗打 `START_TIME`**，不打块上的 `@timestamp`。
- **不存第二份真相**：块不存全部行（靠 04 §4.2 区间回捞）、不存单次调用明细（`COST_BREAKDOWN` 一项一条）、不存逐次加锁清单（`LOCK_SEQ` 只记去重定序序列）。
- **无 `REOPEN_LOG`**：静默封口即终局、不再解封，块一旦封「超时封口」就是终态，字段清单里没有解封账这一项。

## 五、`dynamic: strict` 的前置条件

两个模板都是 `strict` —— 写进一个模板里没声明的字段，**整篇文档被拒**。这样设计的理由：字段清单是固定的（行索引以 04 §4.5 为准、块索引以本文 §四为准），漏改模板应该立刻暴露，而不是悄悄多出一个查不到的字段。

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
| 分片数 | 1 | 按月索引、量级中等偏下；**数据量估算**出来后按实际月增量再核 |

## 七、来源与未做项

| 内容 | 出处 |
|---|---|
| 行文档字段清单 | 本文 §三（04 已瘦化为只讲赋值，04 §3.3 / §4.5） |
| 块文档字段清单 | 本文 §四（04 已冻结为纯行文档，块字段不在 04） |
| 索引划分、读/写别名、环境前缀（框架 `prefix`） | 04 §4.1 |
| 保留策略三档与「归档不删」 | 04 §4.4 |

两条**没做**，留到压测或部署阶段：

- **`index.sort.field: ["LOG_TIME"]`**（行索引按时间预排序，省掉每次查询的排序开销、提升区间扫描）。它对写入有成本、且**建索引后不可改**，压测后再定。
- **冷阶段的节点分配**（低配节点 / 可搜索快照）：需要集群先定义节点属性，属部署侧。
