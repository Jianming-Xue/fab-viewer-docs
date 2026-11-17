# MES 日志关键字监控 · 运行时实现规格

> 模块 2 · 日志监控与报警 ｜ 功能 1 ｜ **2026-11-17 从头重写**：本版保留 Oracle 表与 OS 索引模板 / ISM Policy 的**业务字段定义**（表格形式，不含建表语句与 JSON 全文），其余章节（初始数据、运行逻辑、定时器）待重新整理后逐章补。旧版内容在 git `9e3376b` 与备份 `/tmp/fabviewer_backup_20261117_07{50,54}`、`0951`。

## 1. Oracle 表

### 1.1 状态表 `FvLogMonitorAlarmState`

每条 issue 一行。框架 `ID` 作 PK，业务键 `LineId + Item` 作复合 UK。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ID` | VARCHAR2(50) | ✅ | 框架统一赋值，不出参 |
| `LineId` | VARCHAR2(128) | ✅ | 命中行 `_id` 原值（5 段，约 55~65 字符），128 留余量 |
| `Item` | VARCHAR2(30) | ✅ | 规则业务键；同一行被多条规则命中各存一行 |
| `Environment` | VARCHAR2(30) | ✅ | 取自规则表（`PROD` / `PIRUN`） |
| `Priority` | VARCHAR2(20) | ✅ | 取自规则表，`P1` ~ `P4` |
| `RuleName` | VARCHAR2(128) | — | 块 `RULENAME` 首值快照 |
| `IssueTime` | TIMESTAMP(3) | ✅ | 命中行 `LOG_TIME` |
| `ReportTime` | TIMESTAMP(3) | ✅ | 生成墙钟，首写后不变 |
| `ResolvedTime` | TIMESTAMP(3) | — | 处置时写；是否为空派生「已解决」 |
| `ResolvedUser` | VARCHAR2(64) | — | 处置人 |
| `ResolvedComment` | VARCHAR2(512) | — | 处置备注 |
| `Alarmed` | CHAR(1) | ✅ | 默认 `N`；通知器回写 `Y` |
| `LastAlarmTime` | TIMESTAMP(3) | — | 通知发出的时间，非生成时间 |

- 审计列 `createdAt` / `createdBy` / `updatedAt` / `updatedBy` 由底层统一补，不在此列。
- 辅助索引：`(Environment, Item, ReportTime DESC)` 服务汇总分组 + 明细分页；`(Alarmed, LastAlarmTime)` 服务通知器捞未发。

### 1.2 块进度表 `FvLogMonitorBlockScan`

每块一行，`BlockId` 作 UK。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ID` | VARCHAR2(50) | ✅ | 框架统一赋值 |
| `BlockId` | VARCHAR2(256) | ✅ | 块文档 `_id`（`REQUEST_EXEC_ID`），UK |
| `LastScannedLineId` | VARCHAR2(128) | ✅ | 上次扫到的末行身份串；末段 17 位是 `LOG_TIME` 毫秒串 |
| `TerminalFlag` | CHAR(1) | ✅ | 默认 `N`；扫完置 `Y`，未完维持 `N` |
| `LastScanTime` | TIMESTAMP(3) | ✅ | 服务墙钟，仅自监控 / 清理用 |

---

## 2. OS 索引模板 · 结果索引 `mes-log-monitor-issue`

**结论：只新增一个索引模板，不放进现有行 / 块索引；`dynamic: strict`；文档 `_id` = `LineId|Item`，不算字段。**

### 2.1 命名与写入

| 项 | 口径 |
|---|---|
| 索引名 | `mes-log-monitor-issue-{env}-{yyyy.MM}`，**按月**一个，与块索引同粒度 |
| `{env}` | **小写**（`prod` / `pirun`）；字段值 `ENV` 仍是大写 `PROD` / `PIRUN`（`09` §一） |
| 选索引 | 按 **`issueTime` 所属月份**选，不按生成墙钟 —— 崩溃重扫跨月时同一 issue 仍落同一索引，幂等才稳 |
| 读别名 | `mes-log-monitor-issue-read`，写在模板里，新索引一建自带 |
| 写别名 | **不设**；写入直接指定月索引名（`09` §一 / `04` §5.2.1） |
| 模板名 / PUT 路径 | `mes-log-monitor-issue` / `_index_template/mes-log-monitor-issue` |
| `index_patterns` | `mes-log-monitor-issue-*`；`priority` 200 |

> **`_id` 的幂等只在同一个索引内生效**，按月选索引必须按 `issueTime`，不能按扫描时刻 —— 这是本节最要紧的一条。

### 2.2 settings

| 项 | 值 | 说明 |
|---|---|---|
| `number_of_shards` | 1 | 与 `12-template-exec.json` 一致，起步值，压测后回填 `09` §六 |
| `number_of_replicas` | 1 | 同上 |
| `refresh_interval` | 5s | 同上 |
| `index.codec` | best_compression | 同上 |
| `policy_id` setting | **不写** | `plugins.index_state_management.policy_id` 已弃用，写进 3.x 可能被 unknown setting 拒掉（`09` §一） |

### 2.3 mapping 字段（共 3 个）

| 字段 | 类型 | 取自 | 用途 |
|---|---|---|---|
| `issueMessage` | text | 命中行 `LOG_BODY` | 问题日志原文，唯一分词字段 |
| `blockId` | keyword | 块 `_id`（`REQUEST_EXEC_ID`） | 查询时回块取业务字段的锚点 |
| `issueTime` | date（`yyyy/MM/dd HH:mm:ss.SSS\|\|epoch_millis`） | 命中行 `LOG_TIME` | 选索引、按时间检索、ISM 排序 |

- 文档 `_id` = `LineId|Item`，兼作对外 `issueId`；**文档内不冗余存**，`05` 出参由 `_id` 映射。
- `dynamic: strict` 硬约束：写进任何表外字段整篇拒写；后续加字段必须同时改本模板与 `10` 写入代码。
- date 格式沿用行 / 块模板，因为 `issueTime` 直接取行文档的 `LOG_TIME`。

### 2.4 不存的字段

| 不存 | 从哪来 |
|---|---|
| `item` / `environment` / `priority` / `ruleName` | Oracle 状态行（`ruleName` 是扫描时快照，purge 后仍能显示） |
| `lotId` / `tId` / `hostIpAddress` | 按 `blockId` 回**块文档**取 `LOTID` / `TID` / `HOSTIP` |
| `ruleMessage` | 块文档**没有**该字段（`04` §5.3.2）⇒ 按块的 `START_LINE_ID` **再回行索引**取首行 `LOG_BODY`，两步 |
| `lineId` / `startLineId` / `logFile` / `logOffset` | Oracle `LineId` 列、`_id` 拆分、块文档、行文档分别回查，不冗余 |
| 多值原文 `ruleNames` / `lotIds` / `tIds` | 块文档本来就是 keyword 数组，要原文直接读块 |

---

## 3. ISM Policy · 与块索引共用一份

**结论：不新建 Policy，`mes-log-exec-keep` 的 `ism_template` 扩一条匹配结果索引即可；策略靠 `ism_template` 匹配索引模式自动挂，装入顺序先 Policy 后模板。**

### 3.1 Policy 定义

| 项 | 口径 |
|---|---|
| Policy 名 | `mes-log-exec-keep`（现成，改后 `PUT _plugins/_ism/policies/mes-log-exec-keep` 幂等覆盖） |
| `default_state` | hot |
| hot 阶段 | `set_priority: 100`；`min_index_age: 360d` 后转 cold |
| cold 阶段 | `read_only` + `set_priority: 0`；**不删除**，归档保留 |
| `ism_template` | 两条：`mes-log-exec-*`（原有一条）+ `mes-log-monitor-issue-*`（**本次新增**），`priority` 均 100 |
| 改动文件 | `deploy/opensearch/02-ism-exec-keep.json` 只加 `ism_template` 第二行，其余一字不动 |

### 3.2 时间分层

| 索引 | hot | warm | cold | 到期 |
|---|---|---|---|---|
| 行 `mes-log-line-*` | 0 ~ 30 天 | 30 天起：只读 + 副本 1 + force merge 单段 | 180 天起 | **360 天删除** |
| 块 `mes-log-exec-*` | 0 ~ 360 天 | — | 360 天起：只读，**不删** | 归档保留 |
| 结果 `mes-log-monitor-issue-*`（本次） | 0 ~ 360 天 | — | 360 天起：只读，**不删** | 归档保留 |

- **已确认（2026-11-16）：沿用现行 360 天**，不改数字、不动 `04` §5.2.5 / `09` §二 / `deploy` 的分档；`30 天` 只是行索引热转温门槛与界面查询下限。
- 冷阶段 `read_only` 对结果索引无害：按月建，360 天前的月索引不会再被写（写入按 `issueTime` 选月）。
- 三处保留期的关系：结果索引与块索引同步归档、都不删；Oracle 长期保留；唯一会丢的是**行索引原文**（360 天），影响面只有 `ruleMessage` 与 `Alarm Log` 下载，降级口径见 `04` §1322。
