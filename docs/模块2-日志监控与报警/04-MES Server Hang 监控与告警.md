# MES Server Hang 监控与告警 · 运行时规格

> 模块 2 · 日志监控与报警 ｜ 功能 2 ｜ 状态：**定版**
> 本篇只讲运行时 —— Oracle 状态表、两条判据与两个 DSL、整轮互斥、每轮业务（A / B 判定 + 落库查重 + Endless Rule 恢复），以及扫描产出给通知与展示用的数据；通知怎么发、发什么格式、发给谁一律见 [`10-告警服务工程实现.md`](10-告警服务工程实现.md)，本篇不定义也不复述。**OS 结果索引的字段口径唯一权威在 [`../09-OpenSearch索引模板.md`](../09-OpenSearch索引模板.md) §五，本篇 §3 只引用**。规则怎么配见 [`03`](03-MES%20Server%20Hang%20监控配置.md)，报警怎么展示与处置见 [`06`](06-MES%20Server%20Hang%20告警展示.md)，关键字监控那一路见 [`02`](02-MES关键字监控与告警.md)。

## 1. 功能定位

本篇是 **Server Hang 监控的运行时实现规格**：每 `HangScanInterval` 全量扫块索引里所有「进行中」的块，逐块跑 A（Server Hang）/ B（Endless Rule）两条判据，命中落成 issue，供通知与展示消费。配置侧（阈值 / 等级 / 排除名单 / 收件人）见 `03`；通知怎么发见 `10`；报警怎么展示与处置见 `06`；关键字监控那一路见 `02`。本篇只定义运行时这套机制 —— Oracle 状态表、两条判据与 DSL、整轮互斥与每轮业务。

与关键字监控（功能 1）的关系：**各自独立的一张状态表、一套报警服务、一条 `FvTurn` 行锁**，只共用 OS 结果索引（靠 `issueType` 区分来源）与通知配置 `FvAlarmCfg`。

## 2. Oracle 表

**只一张表** —— `FvSrvHangMonitorAlarmState`（新建，不复用功能 1），一条 issue 一行，`IssueId` = OS `_id` 作业务 UK。不放结果文本与规则配置（结果文本在 OS 结果索引 §3，规则配置在 `03`）。

表名与栏位均大驼峰、全项目统一不加引号（不加引号的标识符 Oracle 会转成大写，写 `FvSrvHangMonitorAlarmState` 与 `FVSRVHANGMONITORALARMSTATE` 是同一张表）；主键 `ID` 与审计四字段由底层统一赋值，业务侧不引用 `ID`、不进任何 SQL；业务时间列统一 `TIMESTAMP(3)`（毫秒），与行索引 `@timestamp` 对齐（审计字段除外）；字符串长度按字符校验（避免 `VARCHAR2` 字节语义抛 `ORA-12899`）。

### 2.1 表 · `FvSrvHangMonitorAlarmState`（告警状态）

每条 issue 一行，`IssueId` = OS `_id` 作业务 UK。

| 字段 | 列名 | 长度 | 可空 | 说明 |
|---|---|---|---|---|
| 主键 | `ID` | ≤50 | 否 | 底层赋值、业务不引用、不出参 |
| 环境 | `Environment` | ≤30 | 否 | 取自配置表，快照（§2.2） |
| 等级 | `Priority` | ≤20 | 否 | 取自配置表，快照（§2.2） |
| 最大 delay | `MaxDelay` | NUMBER(5) | 否 | 秒，`1 ~ 65535`，快照（§2.2） |
| 最大耗时 | `MaxRuleCost` | NUMBER(5) | 否 | 秒，`1 ~ 65535`，快照（§2.2） |
| issue 身份 | `IssueId` | ≤400 | 否 | **业务 UK** = OS `_id`：A = `END_LINE_ID\|Server Hang`、B = `BlockId\|Endless Rule`；A 每次命中 `END_LINE_ID` 不同即新一行（§7.6） |
| 判据类型 | `IssueType` | ≤20 | 否 | 落库 `Server Hang` / `Endless Rule`；B 块闭合后原位改 `Rule Recovered`，与 OS `issueType` 同值（§7.6） |
| 块身份 | `BlockId` | ≤256 | 否 | 块文档 `_id`（`REQUEST_EXEC_ID`），= OS `blockId`，跳模块 1 块详情的锚；**不是 UK** |
| 规则名 | `RuleName` | ≤128 | 是 | 块 `RULENAME` 首值快照 |
| 命中时刻 | `IssueTime` | TIMESTAMP(3) | 否 | 块 `LAST_LINE_TIME`（两条判据相同），= OS `issueTime`，不是墙钟 |
| 生成时刻 | `ReportTime` | TIMESTAMP(3) | 否 | 状态行生成墙钟，首写后不变 |
| 处置时刻 | `ResolvedTime` | TIMESTAMP(3) | 是 | 处置时写；空 = 未解决（误报同样写处置字段） |
| 处置人 | `ResolvedUser` | ≤64 | 是 | 处置人 |
| 处置备注 | `ResolvedComment` | ≤512 | 是 | 处置备注 |
| 是否已通知 | `Alarmed` | CHAR(1) | 否 | 默认 `N`，通知器回写 `Y`；B 恢复时 `Y` → `N`（§7.6） |
| 最后通知时刻 | `LastAlarmTime` | TIMESTAMP(3) | 是 | 通知发出时间；B 恢复时不变（§7.6） |
| 审计四字段 | `CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy` | — | 见上 | 底层统一赋值 |

**业务唯一索引**：`IssueId`（= OS `_id`）。库层冲突跳过，不更新首次写入的行。
**辅助索引**：`(BlockId, ReportTime DESC)` 同块多 issue / 跳块详情；`(Environment, Priority, ReportTime DESC)` 汇总分组 + 明细分页；`(Alarmed, LastAlarmTime)` 通知器捞未发。

### 2.2 配置快照

`Environment` / `Priority` / `MaxDelay` / `MaxRuleCost` 在告警生成时从 `FvSrvHangMonitorCfg` 复制，之后不随配置变化 —— 配置改阈值、调等级、删除后，历史告警仍显示当时口径（复盘 / MTTA / MTTR 按当时算）。配置侧字段名与值域原样落列，不重命名、不换算。

> 轮次表 `FvTurn` 是复用的框架表，不在此列；本模块只借它的行锁，预置数据与每轮锁 SQL 见 §5 / §6。

---

## 3. OS 结果索引 · 见 `09` §五

不新建模板、不改 mapping：与关键字监控写同一份 `mes-log-monitor-issue`，靠 `issueType` 区分来源。**字段清单、类型、索引名 / settings / mapping / ISM 的唯一权威在 `09-OpenSearch索引模板.md` §五**（含完整 JSON 模板 + 字段表），可执行配置在 `deploy/opensearch/13-template-monitor-issue.json`。本文只列**本功能实际写入什么值**，字段定义不复述，避免两处维护漂移。

| 字段 | 类型 | 本功能写入值 | 说明 |
|---|---|---|---|
| `issueMessage` | text | A：判定时当时 `END_LINE_ID` 那一行的 `LOG_BODY` 原文；B：**为空** | 问题日志原文，唯一分词字段 |
| `blockId` | keyword | 块 `_id`（`REQUEST_EXEC_ID`），= Oracle `BlockId` | 不是 `_id`；查询时回块取业务字段的锚 |
| `issueTime` | date | 块 `LAST_LINE_TIME`（两条判据相同），= Oracle `IssueTime` | 选索引依据 + 按时间检索 + ISM 排序 |
| `issueType` | keyword | A `Server Hang`；B `Endless Rule`，块闭合后覆盖为 `Rule Recovered`（§7.6） | 一条 issue 一个值，区分来源与判据 |
| `_id` | ES metadata，非 mapping 字段 | A `END_LINE_ID\|Server Hang`（判定时未闭合块当时）；B `BlockId\|Endless Rule` | = 对外 `issueId` = Oracle `IssueId`，文档内不冗余存（`06` 出参由 `_id` 映射） |

其余两条口径，照 `09` §五：

- **选索引与环境**：按 `issueTime`（业务时间）所属月份选、不按扫描墙钟；环境由框架 `prefix` 前置区分；读走 `mes-log-monitor-issue-read`、不设写别名；`dynamic: strict`。
- **ISM 不另配**：与关键字监控共用 `mes-log-exec-keep`，靠 `ism_template` 匹配 `mes-log-monitor-issue-*` 自动挂，hot 0 ~ 360 天、360 天后 cold 只读不删（`09` §二 / §五）。

---

## 4. 运行时逻辑

**一句话**：每 `HangScanInterval` 醒一轮，**全量**捞块索引 `mes-log-exec-read` 中**所有 `EXEC_STATUS = 进行中` 的块**，逐块判 A / B；无 `@timestamp` 滑动窗口、不推 `FvTurn.CursorTs`、不需要 Block Scan 表；上一轮未命中的块下一轮自然还会被看到，闭口后不再进查询、不补报。

### 4.1 口径

| 项 | 口径 |
|---|---|
| 扫描对象 | `EXEC_STATUS = 进行中`；闭口三态（已完成 / 中断 / 超时封口）不进查询 |
| 判定依据 | 块上现成的 `START_TIME` / `LAST_LINE_TIME` / `EXEC_STATUS`，零字段改动 |
| 环境过滤 | 每轮读 `FvSrvHangMonitorCfg` 取 `Enabled = true` 的 `Environment`，DSL 用 `terms ENV` |
| Server 过滤 | 启动时读 Misc `log.monitor.servercategory`，DSL 用 `terms SERVER_CATEGORY`，**空名单 = 零命中** |
| Rule 过滤 | 两条判据各自的 Exclude Rule Name List（启动读），各进各的 DSL；**空名单不加该条件** |
| 产出 | 命中 → A / B 各按自己的 `_id` 写 Oracle + OS，一条 issue 一个 `issueType`，同一块可各一条 |
| 互斥 | `FvTurn` 独立行 `Name = SRVHANGMON`，`SELECT … FOR UPDATE SKIP LOCKED`（§6） |
| 应用形态 | 同一应用多定时器项目；与关键字监控是两个独立报警服务 |

### 4.2 必须守住

- **A 的上界**：`now − LAST_LINE_TIME > MaxDelay` 且 `≤ 10min` 才报 Server Hang；更大的块由派生层封成超时封口、不再进扫描。**10min 与静默期 `SilenceMinutes` 各按各自配置走、不互相兜底**。
- **Exclude Rule List 为空时不加排除条件**；**Server Category 白名单恒拼，空名单零命中**（不写「空名单跳过该条件」）。

---

## 5. 轮次表 · 预置数据

**结论**：轮次表 `FvTurn` 复用现成框架表，**不改表结构；`Name = 'SRVHANGMON'` 这一行由初始化脚本 / 运维预置，服务启动不写、只校验（§6）**。本模块只借这张表的行锁做整轮互斥，**不读也不推 `CursorTs`** —— 与关键字监控的 `MONITOR` 行各占一行、各一把独立行锁，互不阻塞。

### 5.1 本模块用到的列

| 列 | 类型 | 说明 |
|---|---|---|
| `Name` | VARCHAR2(30) | **唯一索引**，业务定位键。本模块固定 `SRVHANGMON`；与 `MONITOR` 各占一行、各一把锁 |
| `Owner` | VARCHAR2(64) | 抢到本轮的节点，诊断用 |
| `StartedAt` | TIMESTAMP(3) | 本轮触发时刻，诊断用 |

> `CursorTs` **本模块不用**：全量扫未闭合块、不推窗口游标，抢到锁即整轮重判。列名为本模块口径；现场轮次表若已有等价列，直接复用、SQL 里的列名按现场对齐，**口径不变**。`ID` 等技术主键由自增 / 框架补。

### 5.2 预置数据

`Name = 'SRVHANGMON'` 这一行由**初始化脚本 / 运维预置**，初始化脚本只需给下面这一个栏位赋值（部署时一次）：

| 栏位 | 值 |
|---|---|
| `Name` | `SRVHANGMON` |

- **谁写**：初始化脚本 / 运维；服务启动**一行都不写** —— 不补行、不覆盖。
- **多实例**：每台启动各自校验、都不写；行由部署阶段一次性预置。

## 6. 启动校验与每轮锁 SQL

**启动前置校验**：只读检查 `SRVHANGMON` 行存在且可读（连不上 / 查不动一并算失败）；**有问题直接启动失败并报错**，不降级、不静默跳过、不自动补。`SKIP LOCKED` 返回 0 行的语义是「别人在跑」，行一旦缺失会伪装成「每轮都被跳过」⇒ 静默全停，必须在启动阶段挡住。业务规则仍由 `03` 配置页维护，服务不预置。

### 6.1 每轮执行的 SQL

```sql
-- ① 抢轮次：本轮第一条语句，跨机互斥；返回 0 行即本轮结束（不排队、不补跑）
SELECT Name
  FROM FvTurn
 WHERE Name = 'SRVHANGMON'
   FOR UPDATE SKIP LOCKED;      -- 必须带 SKIP LOCKED

-- ② 抢到后登记本轮归属（同一事务，行锁持到整轮结束）
UPDATE FvTurn SET Owner = :nodeId, StartedAt = :fireAt
 WHERE Name = 'SRVHANGMON';

-- ③ §7 整轮完成后 COMMIT；跳过 / 失败 ROLLBACK，本轮无改动（不读也不推 CursorTs）
COMMIT;
```

- 返回 **1 行** = 抢到，行锁从这条 `SELECT` 一直持到 `COMMIT`；返回 **0 行** = 别人在跑，**本轮事务直接结束**（还没做任何改动，提交与回滚等价）。
- **为什么必须 `SKIP LOCKED`**：不带 SKIP，后醒的节点会阻塞在行锁上排队，锁一释放接着跑第二遍 —— 周期漂移、同一刻度重复执行；带 SKIP 才是「被占用就跳过、不排队、不补跑」。
- 不引 Redis / 分布式锁：进程崩了事务回滚、行锁自动释放，不需要租约与接管。

### 6.2 锁的边界

| 项 | 口径 |
|---|---|
| 事务范围 | 只包本轮扫描与判定落库；外部 IO（通知等）全在 `COMMIT` 之后、锁外 |
| 串行语义 | 不排队、不补跑；上一轮没结束，下一个 `HangScanInterval` 刻度整轮跳过 |
| 同机防重入 | 定时器固定速率触发，上一轮没完下次照样来 ⇒ 进程内「正在跑就跳过本次触发」标记 |
| 一轮跑过一周期 | 持锁跨过下一个刻度，那个刻度被跳过；因全量重判、不推游标，无需收敛 |
| 崩溃 | Oracle 行锁随事务回滚自动释放，下一轮别的节点直接接管，无主备切换 |
| 相位固定节点 | 可能长期抢不到轮次，不报错、不影响正确性；排查时先看这一处 |

---

## 7. 每轮业务

**一句话**：本章只写 §4 / §6 没写的部分 —— 抢到 `SRVHANGMON` 行锁（§6.1 ①）之后、`COMMIT`（③）之前，一轮 6 步。全量扫与互斥口径（§4）、抢锁与失败回滚（§6.1）、事务边界（§6.2）一律引用，不重复。

### 7.1 一轮 6 步

| 步 | 做什么 | 打在哪 | 口径 |
|---|---|---|---|
| 1 | 抢 `SRVHANGMON` 行锁；抢不到整轮跳过 | Oracle | **已写** §6.1 ① / §6.2 |
| 2 | 启动读 System Misc 三份名单（§7.2）；每轮重读配置表（§7.3） | System Misc + Oracle | §7.2 / §7.3 |
| 3 | A / B 各发一个 DSL 捞进行中块，各自带 ENV + Server Category + 自己的 Exclude Rule List（§7.4） | 块索引 | §7.4 |
| 4 | 逐块判定，两判据互不冲突、可同时检查；命中按 §7.4 映射准备落库 | 块文档 | §7.4 |
| 5 | 第二轮起：A 落库前查重、B 以第一次为准；Endless Rule 闭合块改 `Rule Recovered`（§7.6） | OS + Oracle | §7.6 |
| 6 | `COMMIT`；通知在事务 / 锁之外外发（见 `10`） | Oracle | **已写** §6.1 ③ / §6.2 |

### 7.2 启动时读 System Misc

| 配置项 | 用途 | 处理 |
|---|---|---|
| `log.monitor.servercategory` | 决定哪些 Server 看 Server Hang | 启动读一次，取 `string[]`，嵌 `terms SERVER_CATEGORY`；**空名单零命中**；改配置要重启 |
| `log.monitor.srvhang.excludeRules` | A · Server Hang 的排除 Rule Name List | 启动读一次，**空名单不加排除条件**；改配置要重启 |
| `log.monitor.endless.excludeRules` | B · Endless Rule 的排除 Rule Name List | 同上 |

- 三份名单都是**公共方法返回什么原样记什么**，服务侧不解析、不校验、不转换、不补默认值；与每轮重读的配置表（§7.3）是两回事。
- 环境名单 `mes.global.environments` 随配置校验，运行时按配置表 `Environment` 取（§7.3）。

### 7.3 每轮读配置

重读 `FvSrvHangMonitorCfg`，只取 `Enabled = true`，`Environment` 去重成环境集合，DSL 用 `terms ENV`。不缓存、不热加载，改配置下一轮生效。环境候选来自 Misc `mes.global.environments`；与 Filebeat `fields.ENV` 大小写不齐会全落空且不报错 ⇒ 启动时打印读到的环境集合。

```sql
-- 每轮开头重读；快照四列一并用，AlarmCfgId 留给通知器按 ID 取
SELECT Environment, Priority, MaxDelay, MaxRuleCost, AlarmCfgId
  FROM FvSrvHangMonitorCfg
 WHERE Enabled = :enabledTrue;
```

### 7.4 两条判据与两个 DSL

| 判据 | 对象（`EXEC_STATUS`） | 判定式 | `issueType` |
|---|---|---|---|
| A · Server Hang | 未闭合（仅进行中） | `now − LAST_LINE_TIME > MaxDelay` 且 `≤ 10min`（上界即超时封口判据） | `Server Hang` |
| B · Endless Rule | 未闭合（仅进行中） | `LAST_LINE_TIME − START_TIME > MaxRuleCost` | `Endless Rule` |

闭口三态都不判。

**DSL 拼装**

- A / B 各一个查询，可同时检查；各自按自己的 `_id` 落一条 issue。
- 各自带三项条件：`terms ENV`（本轮环境集合）+ `terms SERVER_CATEGORY`（恒拼）+ 该判据自己的 Exclude Rule List（拼在块 `RULENAME` 上，空则不加）。
- 公共过滤：`EXEC_STATUS = 进行中`；`IssueId` 幂等照 §2 / §3。
- **DSL 只捞候选块、时间判据在应用侧逐块判**：`MaxDelay` / `MaxRuleCost` 按环境不同（一环境一行配置），且 B 是两个字段相减，range 表达不了；DSL 不拼时间阈值。

**A · Server Hang 查块 DSL**（`mes-log-exec-read`；`terms SERVER_CATEGORY` 恒拼、空数组即零命中）

```json
GET /mes-log-exec-read/_search
{
  "size": 200,
  "track_total_hits": false,
  "query": {
    "bool": {
      "filter": [
        {"term":  {"EXEC_STATUS": "进行中"}},
        {"terms": {"ENV": ["PROD", "PIRUN"]}},
        {"terms": {"SERVER_CATEGORY": ["FAB", "LIST"]}}
      ],
      "must_not": [
        {"terms": {"RULENAME": ["JOBPREPRULE", "EAPReqJobOutEx"]}}
      ]
    }
  },
  "sort": [{"_id": "asc"}],
  "_source": ["ENV", "RULENAME", "START_TIME", "LAST_LINE_TIME", "END_LINE_ID"]
}
```

**B · Endless Rule 查块 DSL**：把上面 `must_not` 的名单换成 `log.monitor.endless.excludeRules` 那份（示例 `["EAPReqJobInEx", "PRE", "POST"]`），其余完全相同。**名单为空时整条 `must_not` 不拼**，不是拼空数组（空 `must_not` 会排除所有块）。

- 翻页用 `search_after` 带上页最后一条的 `_id`，首屏不带，翻到返回空数组为止；`_id` 即 `BlockId` 默认返回。
- `_source` 取判定所需字段：`START_TIME` / `LAST_LINE_TIME` 应用侧判时间、`END_LINE_ID` A 取原文与拼 `_id`、`RULENAME` 落 Oracle 快照；`SERVER_CATEGORY` 已进查询不再取。

**应用侧逐块判定**

```
A: (now - LAST_LINE_TIME) > MaxDelay*1000 且 (now - LAST_LINE_TIME) <= 600000   → issueType = Server Hang
B: (LAST_LINE_TIME - START_TIME) > MaxRuleCost*1000                            → issueType = Endless Rule
```

`MaxDelay` / `MaxRuleCost` 按该块 `ENV` 从本轮重读的配置快照取（单位秒，×1000 换毫秒）；两条独立判定、同块可同时命中。`issueTime` 取块 `LAST_LINE_TIME`。

**A 取 `issueMessage` 原文**：按判定当时块的 `END_LINE_ID` 到行索引取 `_source.LOG_BODY`（`END_LINE_ID` 即行 `_id`）；B 不取、写空字符串。

```json
GET /mes-log-line-read/_doc/{END_LINE_ID}
{"_source": ["LOG_BODY"]}
```

**写入映射**

| 项 | A · Server Hang | B · Endless Rule |
|---|---|---|
| OS `_id` = Oracle `IssueId` | `END_LINE_ID\|Server Hang`（判定时未闭合块当时） | `BlockId\|Endless Rule` |
| `issueType` | `Server Hang` | `Endless Rule` |
| `issueTime` = Oracle `IssueTime` | 块 `LAST_LINE_TIME` | 块 `LAST_LINE_TIME` |
| `issueMessage` | 当时 `END_LINE_ID` 那一行的 `LOG_BODY` 原文 | 空字符串 |
| `blockId` = Oracle `BlockId` | 块 `_id`（`REQUEST_EXEC_ID`） | 同左 |
| Oracle `RuleName` | 取块的 `RULENAME` 快照 | 同左 |

A 的 `_id` 取判定时那一次的 `END_LINE_ID`，不是块 `_id`；B 用块 `_id`。两条 issue 都写 Oracle + OS 两源，各按自己的 `_id` 幂等。

### 7.5 存放与通知

- 配置与报警状态落 Oracle，不进 OpenSearch；观测文本走 OS 结果索引（§3），报警记录存 `BlockId`，点开跳模块 1 块详情看原始日志。
- 与功能 1 共用同一套处置状态机与展示口径（模块 2 处置页 / 模块 4 Dashboard），表各自一张。
- 通知复用功能 1 的 `FvAlarmCfg`（邮件 + 飞书 + 通知间隔），随配置 1:1；企微 / 钉钉后续扩。外发实现见 `10`。

### 7.6 第二轮起 · 落库查重与 Endless Rule 恢复

| 场景 | 检查 | 结果 |
|---|---|---|
| A 重复命中 | 落库前按本条 `issueId` 查 OS 是否已有该 `_id` | 有 ⇒ OS + Oracle 都不写；无 ⇒ 新建两源各一行 |
| A 恢复后再犯 | 同一块 a 点记过、恢复后 b 点又命中 | `LAST_LINE_ID`（`END_LINE_ID`）不同 ⇒ `issueId` 不同 ⇒ 两行，不合并、不覆盖 |
| B 重复命中 | 再次扫到未停止的同一块 | 不写两源，以第一次落的那行为准（`_id` 恒定，天然幂等） |
| B 恢复 | 按 Oracle `IssueType = Endless Rule` 找行，检查块是否闭合（已完成 / 超时封口 / 中断都算） | 闭合 ⇒ 两源原位改 `Rule Recovered`，`_id` / `IssueId` 不变 |

**B 恢复的字段更新**（原位，不新增行）

| 源 | 字段 | 动作 |
|---|---|---|
| OS | `issueType` | `Endless Rule` → `Rule Recovered` |
| OS | `_id` | 不变 |
| Oracle | `IssueType` | `Endless Rule` → `Rule Recovered` |
| Oracle | `Alarmed` | 当前为 `Y` 时改 `N`，已是 `N` 不动 |
| Oracle | `LastAlarmTime` | 不变 |

A 的查重按 OS `_id` 存在性，Oracle `IssueId` UK 作库层兜底；B 靠恒定 `_id` 幂等。**A 不做 `Rule Recovered`**：恢复后再次停写是新的一条，旧行保持 `Server Hang` 不动。恢复检查从 Oracle 已落的 `Endless Rule` 行出发按 `BlockId` 查块 `EXEC_STATUS`（主扫只捞进行中块，闭口块不在候选里）。

**A 查重 + 写两源**（索引名按 `issueTime` = 块 `LAST_LINE_TIME` 所属月份选，示例 `2026.11`）

```json
-- ① 查重：存在则本条整条跳过（OS 与 Oracle 都不写）
HEAD /mes-log-monitor-issue-2026.11/_doc/{issueId}      -- 200 = 已有，404 = 新建

-- ② 新建 OS：_id 即对外 issueId，四字段写全（dynamic: strict）
PUT /mes-log-monitor-issue-2026.11/_doc/{issueId}
{
  "issueMessage": "<END_LINE_ID 行的 LOG_BODY 原文>",
  "blockId": "<REQUEST_EXEC_ID>",
  "issueTime": "2026/11/23 10:15:30.000",
  "issueType": "Server Hang"
}
```

```sql
-- ③ 新建 Oracle 状态行：ID 与审计四字段由底层赋值，不出现在 SQL 里
MERGE INTO FvSrvHangMonitorAlarmState t
USING (SELECT :issueId AS issueId FROM dual) s
   ON (t.IssueId = s.issueId)
 WHEN NOT MATCHED THEN
   INSERT (Environment, Priority, MaxDelay, MaxRuleCost, IssueId, IssueType,
           BlockId, RuleName, IssueTime, ReportTime, Alarmed)
   VALUES (:env, :priority, :maxDelay, :maxRuleCost, :issueId, 'Server Hang',
           :blockId, :ruleName, :issueTime, :reportTime, 'N');
```

B 命中走同一套写入，`IssueType` / `issueType` 换 `Endless Rule`、`issueMessage` 传空串；重复命中因 `_id` 与 `IssueId` 恒定，`HEAD` 返回 200 即跳过、`MERGE` 也命中已有行不插入，以第一次为准。

**B 恢复**（从 Oracle 找候选 → 查块状态 → 两源原位改）

```sql
-- ① 候选：只找 Endless Rule 行（已改 Rule Recovered 的不再进来）
SELECT IssueId, BlockId
  FROM FvSrvHangMonitorAlarmState
 WHERE IssueType = 'Endless Rule';
```

```json
-- ② 逐行按 BlockId 查块；EXEC_STATUS ∈ {已完成, 超时封口, 中断} 即闭合
GET /mes-log-exec-read/_doc/{BlockId}
{"_source": ["EXEC_STATUS"]}
```

```sql
-- ③ Oracle 原位改：Alarmed 仅 Y→N，LastAlarmTime 不出现在 SET 里
UPDATE FvSrvHangMonitorAlarmState
   SET IssueType = 'Rule Recovered',
       Alarmed   = CASE WHEN Alarmed = 'Y' THEN 'N' ELSE Alarmed END
 WHERE IssueId = :issueId;
```

```json
-- ④ OS 原位改：_id 不变，只覆盖 issueType
POST /mes-log-monitor-issue-{yyyy.MM}/_update/{issueId}
{"doc": {"issueType": "Rule Recovered"}}
```

**待确认（不阻塞开发，定后补）**：① 查重与 B 恢复检查的执行顺序 / 频率 —— 是否同一轮内；B 恢复检查每轮都扫 Oracle 的 `Endless Rule` 行，还是只在扫到相关块时。② 恢复后是否触发通知 —— `Alarmed` 由 `Y` 改 `N` 后，通知器按 `(Alarmed, LastAlarmTime)` 捞未发时会不会把这条恢复行重新捞去发（归 `10`）。

## 8. 参数配置（包含公共方法）

本篇只列本功能读的应用参数；业务阈值 / 等级 / 通知目标在 `03`。改值不动判定逻辑，走 git 同步版本；默认值均为初值，压测后回填。

| 参数 | 说明 | 默认值 |
|---|---|---|
| `HangScanInterval` | Server Hang 监控扫块文档周期；全量扫未闭合块，每轮重判 | 暂定 3min |
| `SilenceMinutes` | 派生层停写封「超时封口」门槛；与判据 A 的 10min 各按各自配置、不互相兜底 | `06` §五 10min / `fabviewer.yaml` 5min（两处未统一、留底不改） |

### 8.1 公共方法与系统配置（本篇只消费，定义不在本篇）

本篇跑在 System Misc 之上；下面这些系统配置**不在本篇定义、也不在本篇维护**，本篇只是读取。明细散落在各步骤，此处集中列出备查，口径以对应步骤为准。**本功能不调用 `FetchMESRuleFullLogs()`**（只按 `END_LINE_ID` 取单行原文，见 §7.4）。

**系统配置（System Misc，本篇只读取不定义）**

| 配置项 | 用途 | 读取时点 | 明细 |
|---|---|---|---|
| `mes.global.environments` | 环境名单，配置 `Environment` 值域 | 启动时随读 | §7.3 |
| `log.monitor.servercategory` | Server 类别白名单，嵌 `terms SERVER_CATEGORY`（恒拼、空名单零命中） | 启动时读一次，改后重启生效 | §7.2 / §4.1 |
| `log.monitor.srvhang.excludeRules` | A · Server Hang 排除 Rule Name List（空则不加条件） | 启动时读一次，改后重启生效 | §7.2 / §7.4 |
| `log.monitor.endless.excludeRules` | B · Endless Rule 排除 Rule Name List（空则不加条件） | 启动时读一次，改后重启生效 | §7.2 / §7.4 |

> 以上均非本服务参数（应用参数表见上）；本篇消费但不维护，定义与维护方不在本篇。
