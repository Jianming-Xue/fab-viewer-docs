# MES 日志关键字监控 · 运行时实现规格

> 模块 2 · 日志监控与报警 ｜ 功能 1 ｜ **2026-11-14 全新重写**：不沿用旧版章节结构与口径编号，按本次讨论的 7 章重新组织。
> 配置侧见 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md)，展示与处置见 [`05-MES关键字告警展示.md`](05-MES关键字告警展示.md)，表结构 / 多实例执行模型 / 自监控指标归 [`10-告警服务工程实现.md`](10-告警服务工程实现.md)。本文给到可直接执行的模板、Policy、DDL 与初始数据，以及运行逻辑与调度口径。

**总纲。** 规则存在 Oracle `FvLogMonitorCfg`，**不设 `enabled`、配置即启用**；告警服务每轮扫描开头**重新读一遍表**、不缓存、不做热加载，配置改动下一轮生效。服务每 **3 分钟**串行跑一轮：先按 `FvTurn` 行锁抢轮次（`FOR UPDATE SKIP LOCKED`），整轮跑完才放锁，被占用的刻度直接跳过，多实例不会撞。链路是「**块筛 → 块进度取增量 → 回行索引逐行判 → 写两源**」：先用规则 `Environment` 集合与两份 Rule Name 名单筛出候选块，再按块进度表只扫每块新增的行，`LOG_BODY` 命中 `Keyword` 且不含排除词就生成一条 issue。产出按「事实 / 状态」分两处 —— **OS 新建结果索引只存 4 项只读事实**（`_id` / `issueMessage` / `blockId` / `issueTime`，与块索引**共用同一个 ISM Policy** 归档），**Oracle 存状态行 + 块进度表**（长期保留，承载处置、通知、汇总与计数）。`issueId` = `LineId|Item` 作 OS 文档 `_id`，Oracle 不存拼接值，只存 `LineId` / `Item` 两列作复合 UK。界面查询最早到 30 天前，更早的数据走历史查询；Oracle 的汇总与统计不受此限。

---

## 1. OS 索引模板 · 本次结果索引

**结论：本次只新增一个索引模板，不放进现有行 / 块索引；`dynamic: strict`，mapping 只有 3 个字段，文档 `_id` 不算字段。**

### 1.1 命名与写入

| 项 | 口径 |
|---|---|
| 索引名 | `mes-log-monitor-issue-{env}-{yyyy.MM}`，**按月**一个，与块索引同粒度 |
| `{env}` | **小写**（`prod` / `pirun`）；字段值 `ENV` 仍是大写 `PROD` / `PIRUN`，两者不是一回事（`09` §一） |
| 选索引 | 按 **`issueTime` 所属月份**选，不按生成墙钟 —— 崩溃重扫跨月时同一 issue 仍落同一索引，幂等才稳 |
| 读别名 | `mes-log-monitor-issue-read`，写在模板里，新索引一建自带 |
| 写别名 | **不设**；写入直接指定月索引名（`09` §一 / `04` §5.2.1） |
| 模板名 / PUT 路径 | `mes-log-monitor-issue` / `_index_template/mes-log-monitor-issue` |

> 结果索引与块索引都是按月建、都不删，因此能共用一份 Policy（§2）。**`_id` 的幂等只在同一个索引内生效**，按月选索引必须按 `issueTime`，不能按扫描时刻 —— 这是本节最要紧的一条。

### 1.2 模板全文（可直接 PUT）

```json
{
  "index_patterns": ["mes-log-monitor-issue-*"],
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
        "issueMessage": { "type": "text" },
        "blockId":      { "type": "keyword" },
        "issueTime":    { "type": "date", "format": "yyyy/MM/dd HH:mm:ss.SSS||epoch_millis" }
      }
    },
    "aliases": {
      "mes-log-monitor-issue-read": {}
    }
  },
  "_meta": {
    "index": "mes-log-monitor-issue-{env}-{yyyy.MM}，每月一个；按 issueTime 所属月选索引；读别名 mes-log-monitor-issue-read（不设写别名）",
    "mapping": "3 个字段，dynamic: strict；文档 _id = LineId|Item，不进 properties",
    "policy": "由 mes-log-exec-keep 的 ism_template 自动挂；模板里不写 policy_id（09 §一）"
  }
}
```

settings 四项与 `12-template-exec.json` 一致；`issueTime` 的 date 格式沿用行 / 块模板的 `yyyy/MM/dd HH:mm:ss.SSS||epoch_millis`，因为它直接取行文档的 `LOG_TIME`。

### 1.3 字段与不存的字段

| 字段 | 类型 | 取自 | 说明 |
|---|---|---|---|
| `_id` | 文档 ID | `LineId\|Item` | 兼作对外 `issueId`；**文档内不冗余存 `issueId`**，`05` 出参由 `_id` 映射 |
| `issueMessage` | text | 命中行 `LOG_BODY` | 问题日志原文，唯一分词字段 |
| `blockId` | keyword | 块 `_id`（`REQUEST_EXEC_ID`） | 查询时回块取业务字段的锚点 |
| `issueTime` | date | 命中行 `LOG_TIME` | 选索引、按时间检索、ISM 排序；`05` 明细排序以 Oracle 为准 |

| 不存 | 从哪来 |
|---|---|
| `item` / `environment` / `priority` / `ruleName` | Oracle 状态行（`ruleName` 是扫描时快照，purge 后仍能显示） |
| `lotId` / `tId` / `hostIpAddress` | 按 `blockId` 回**块文档**取 `LOTID` / `TID` / `HOSTIP` |
| `ruleMessage` | 块文档**没有**该字段（`04` §5.3.2）⇒ 按块的 `START_LINE_ID` **再回行索引**取首行 `LOG_BODY`，两步 |
| `lineId` / `startLineId` / `logFile` / `logOffset` | Oracle `LineId` 列、`_id` 拆分、块文档、行文档分别回查，不冗余 |
| 多值原文 `ruleNames` / `lotIds` / `tIds` | 块文档本来就是 keyword 数组，要原文直接读块 |

**`dynamic: strict` 是硬约束**：写进任何表外字段整篇拒写。结果索引写完不改，若后续要加字段，必须同时改本模板与 `10` 的写入代码。

### 1.4 部署约束

1. 装入顺序：**先 ISM Policy、再索引模板**（策略靠 `ism_template` 匹配索引模式自动挂，`09` §一）；只做 `PUT`，幂等、不删任何东西。
2. `plugins.index_state_management.policy_id` **已弃用**，不要写进 settings —— 3.x 下可能让索引创建被 unknown setting 拒掉（`09` §一）。
3. 分片 / 副本 1 / 1 是起步值，压测后回填 `09` §六。
4. 本文给的是**可执行配置内容**；`deploy/opensearch/` 与 `09` 的文件同步见文末「附」。

---

## 2. ISM Policy · 与块索引共用一份

**结论：本次不新建 Policy。** 把 `mes-log-exec-keep` 的 `ism_template` 扩到结果索引名，结果索引与块文档索引就走同一份归档策略 —— 上轮「老 issue 明细缺字段」的风险由此收口。

### 2.1 改动（`deploy/opensearch/02-ism-exec-keep.json` 改后全文）

```json
{
  "policy": {
    "description": "块索引 mes-log-exec-* 与结果索引 mes-log-monitor-issue-* 共用：0~360d 热（可写）；360d 起转冷（只读，不删除）。按月建索引、不用 rollover，min_index_age 按索引创建时间算。",
    "default_state": "hot",
    "states": [
      {
        "name": "hot",
        "actions": [ { "set_priority": { "priority": 100 } } ],
        "transitions": [ { "state_name": "cold", "conditions": { "min_index_age": "360d" } } ]
      },
      {
        "name": "cold",
        "actions": [ { "read_only": {} }, { "set_priority": { "priority": 0 } } ],
        "transitions": []
      }
    ],
    "ism_template": [
      { "index_patterns": ["mes-log-exec-*"], "priority": 100 },
      { "index_patterns": ["mes-log-monitor-issue-*"], "priority": 100 }
    ]
  }
}
```

- 只多了 `ism_template` 第二行，其余一字不动；`PUT _plugins/_ism/policies/mes-log-exec-keep` 幂等覆盖。
- 冷阶段的 `read_only` 对结果索引无害：它按月建，360 天前的月索引不会再被写（写入按 `issueTime` 选月）。
- 结果索引**不删**，所以 `issueMessage` 与 `blockId` 长期在；`04` §1322 的降级只发生在行索引被删之后（见 §2.3）。

### 2.2 时间分层（现状原文：`04` §5.2.5 / `09` §二）

| 索引 | hot | warm | cold | 到期 |
|---|---|---|---|---|
| 行 `mes-log-line-*` | 0 ~ 30 天 | 30 天起：只读 + 副本 1 + force merge 单段 | 180 天起 | **360 天删除** |
| 块 `mes-log-exec-*` | 0 ~ 360 天 | — | 360 天起：只读，**不删** | 归档保留 |
| 结果 `mes-log-monitor-issue-*`（本次） | 0 ~ 360 天 | — | 360 天起：只读，**不删** | 归档保留 |

> **已确认（2026-11-16）：ISM 沿用现行 360 天，不改数字、不动冻结文档。** 块索引与结果索引 0 ~ 360 天热、360 天起转冷只读不删；行索引 30 天热转温、180 天转冷、**360 天删除**；`30 天` 只是行索引热转温门槛与界面查询下限，不是块 / 结果索引的分档。本次仅给 `02-ism-exec-keep.json` 增一条 `ism_template` 匹配结果索引（§2.1），`04` §5.2.5、`09` §二、`deploy` 两份 ISM JSON 的分档数字一律不动。

### 2.3 查询分档（30 天）

| 档 | 数据源 | 行为 |
|---|---|---|
| **在线查询 ≤ 30 天** | Oracle 状态行 + 结果索引 + 块 / 行索引，三源拼装 | 同步、低延迟，14 字段全、`Alarm Log` 可下载 |
| **历史查询 > 30 天** | 同上，但行 / 块索引转温或冷 | **异步 + 超时与归档提示**；30 ~ 360 天字段仍全，只是慢 |
| **> 360 天** | 只剩 Oracle + 结果索引 + 块索引（归档） | 行索引已删 ⇒ `ruleMessage`、`Alarm Log` 原文按 `04` §1322 **显式留空并标注**，不能显示成「无数据」；`ruleName` 因存在 Oracle 仍可显示 |

- **界面查询下限 = 当前时间 − 30 天**，明细与下载都受限。
- **汇总 9 字段、MTTR / 误报率等统计不受 30 天限制**：`totalCnt` / `totalResolvedCnt` / `remainingCnt` 按 `05` §2.2 是全量统计，全部在 Oracle 单源算出。这条让「Oracle 长期保留」的价值落地；代价是汇总数字可能大于明细可见条数，界面需标注「明细仅展示近 30 天」。
- **不新建「历史查询」接口**：同一套接口，超过 30 天改走异步 + 归档提示，字段来源不变。

### 2.4 三处保留期的关系

OS 结果索引与块索引共用 Policy ⇒ **两边同步归档、都不删**；Oracle 状态行长期保留。唯一会丢的是**行索引原文**（360 天），影响面只有 `ruleMessage` 和 `Alarm Log` 下载，且已有 `04` §1322 的降级口径，不新发明。

---

## 3. Oracle 建表

**结论：新建 2 张表，复用 3 张现成表；两张新表统一「框架 `ID` 作 PK、业务键作 UK」。**

### 3.1 表清单

| 表 | 状态 | 用途 |
|---|---|---|
| `FvLogMonitorAlarmState` | **新建** | 每 issue 一行：分组维度、`ruleName` 快照、处置 / 通知 / 汇总与计数 |
| `FvLogMonitorBlockScan` | **新建** | 每块一行：`LAST_SCANNED_LINE_ID` 增量进度，扫描正确性的依赖 |
| `FvTurn` | 复用（`06` §1.2） | 轮次行锁；本次只**插一行**，不改结构 |
| `FvLogMonitorCfg` | 复用（`01` §2.1） | 监控规则，每轮全量读 |
| `FvAlarmCfg` | 复用（`01` §2.2） | 通知窗口与渠道 |

### 3.2 状态表 DDL

```sql
CREATE TABLE FvLogMonitorAlarmState (
  ID               VARCHAR2(50)    NOT NULL,
  LineId           VARCHAR2(128)   NOT NULL,
  Item             VARCHAR2(30)    NOT NULL,
  Environment      VARCHAR2(30)    NOT NULL,
  Priority         VARCHAR2(20)    NOT NULL,
  RuleName         VARCHAR2(128)   NULL,
  IssueTime        TIMESTAMP(3)    NOT NULL,
  ReportTime       TIMESTAMP(3)    NOT NULL,
  ResolvedTime     TIMESTAMP(3)    NULL,
  ResolvedUser     VARCHAR2(64)    NULL,
  ResolvedComment  VARCHAR2(512)   NULL,
  Alarmed          CHAR(1)         DEFAULT 'N' NOT NULL,
  LastAlarmTime    TIMESTAMP(3)    NULL,
  CONSTRAINT PK_FV_LM_ALARM_STATE  PRIMARY KEY (ID),
  CONSTRAINT UK_FV_LM_ALARM_STATE  UNIQUE (LineId, Item),
  CONSTRAINT CK_FV_LM_ALARM_FLAG   CHECK (Alarmed IN ('Y','N'))
);

CREATE INDEX IDX_FV_LM_STATE_LIST  ON FvLogMonitorAlarmState (Environment, Item, ReportTime DESC);
CREATE INDEX IDX_FV_LM_STATE_ALARM ON FvLogMonitorAlarmState (Alarmed, LastAlarmTime);
```

- `ID` 长度 ≤50，对齐 `FvAlarmCfg.ID` / `01` §2.1 的全项目表规范，由框架统一赋值，**不出参、不进 Ro**。
- `LineId` 是行 `_id` 原值（5 段，约 55~65 字符），`VARCHAR2(128)` 留余量；**不要按 50 建**。
- 审计列 `createdAt` / `createdBy` / `updatedAt` / `updatedBy` 由底层统一补，DDL 不手写（`01` §2.1）。
- 两个索引分别服务「汇总分组 + 明细分页」与「通知器捞 `alarmed = 'N'`」。

### 3.3 块进度表 DDL

```sql
CREATE TABLE FvLogMonitorBlockScan (
  ID                  VARCHAR2(50)    NOT NULL,
  BlockId             VARCHAR2(256)   NOT NULL,
  LastScannedLineId   VARCHAR2(128)   NOT NULL,
  TerminalFlag        CHAR(1)         DEFAULT 'N' NOT NULL,
  LastScanTime        TIMESTAMP(3)    NOT NULL,
  CONSTRAINT PK_FV_LM_BLOCK_SCAN PRIMARY KEY (ID),
  CONSTRAINT UK_FV_LM_BLOCK_SCAN UNIQUE (BlockId),
  CONSTRAINT CK_FV_LM_BLOCK_FLAG  CHECK (TerminalFlag IN ('Y','N'))
);
```

| 列 | 说明 |
|---|---|
| `BlockId` | = `REQUEST_EXEC_ID`（块文档 `_id`），**UK**；本服务按它查进度、按框架 `ID` 更新 |
| `LastScannedLineId` | 上次扫到的末行身份串；**末段 17 位就是 `LOG_TIME` 毫秒串**，可直接解析出下一轮的 `LOG_TIME` 下界 |
| `TerminalFlag` | 块闭口且已扫完置 `Y`；之后永久跳过，进度行可按保留期清 |
| `LastScanTime` | 服务墙钟，只做自监控与清理判据，**不参与扫描区间计算** |

### 3.4 状态表字段口径

| 列 | 取自 | 用途 |
|---|---|---|
| `LineId` / `Item` | 命中行 `_id` / 规则 `Item` | 复合 UK；同一行被多条规则命中可各存一条，`05` 的 5 个计数不少算 |
| `Environment` / `Priority` | 规则表 | 汇总按 `Item + Environment` 分组；`Priority` 取 `P1` ~ `P4` |
| `RuleName` | 块 `RULENAME` **取首值** | 扫描时快照，块索引归档后 Rule Name 列仍在 |
| `IssueTime` / `ReportTime` | 命中行 `LOG_TIME` / 生成墙钟 | `dailyCnt` 当日判据、明细倒序；三者不与 `LastAlarmTime` 混用 |
| `ResolvedTime` / `ResolvedUser` / `ResolvedComment` | **`05` 处置写入** | `Resolved` 开关由 `ResolvedTime` 是否为空派生；扫描侧不写 |
| `Alarmed` / `LastAlarmTime` | 通知器回写 | `LastAlarmTime` = **通知发出的时间**，非生成时间 |

**不存拼接后的 `IssueId`**：对外 `issueId` = `LineId + '|' + Item` 现算；`resolve` 与 `Alarm Log` 下载（`05` §4.6）的入参按 `|` 拆回两列定位 UK。分隔符安全：行 `_id` 五段（大写环境名 / 点分 IP / 16 位 hex / 数字 offset / 17 位毫秒）与 `Item` 字符集 `^[A-Za-z0-9_-]{1,30}$` 都不含 `|`，全串仅一个竖线。

5 个计数（`remainingCnt` / `totalCnt` / `totalResolvedCnt` / `dailyCnt` / `dailyResolvedCnt`）与 `lastAlarmTime` **全在本表按 `Environment + Item` 聚合一次算出**，SSE 增量也走它；明细的「按 `item + environment` 过滤 / 只过滤未解决 / `reportTime` 倒序分页」同样**全部在本表完成**，OS 只按 `_id` 批量补内容，不做跨源分页。

### 3.5 不建的表与理由

| 不建 | 理由 |
|---|---|
| 待发通知表 | 待发就是 `Alarmed = 'N'`，发完回写标记，零累积 |
| 全局时间水位表 | `06` §1.2.1 的 B 类游标，一错会静默漏报整段时间窗；本服务用块级进度 |
| OS 独立状态索引 | 进度是正确性依赖，要行级 UPDATE；OS 无行锁、有 refresh 延迟、受 ISM 影响 |
| 结果索引里的 `item` 等冗余列 | 分组 / 过滤 / 分页全在 Oracle，OS 只存只读事实 |

---

## 4. 初始数据

**结论：只有轮次行是启动必需，缺了会静默全停；业务规则由 `01` 配置页维护，服务不预置。**

### 4.1 必须预置 · 轮次行

```sql
-- 关键字监控轮次：本服务每 3min 抢这一行的行锁
MERGE INTO FvTurn t
USING (SELECT 'LOGMON' AS CYCLE FROM dual) s
ON (t.CYCLE = s.CYCLE)
WHEN NOT MATCHED THEN INSERT (CYCLE) VALUES (s.CYCLE);

-- Server Hang 独立一行：两把锁互不阻塞
MERGE INTO FvTurn t
USING (SELECT 'HANGMON' AS CYCLE FROM dual) s
ON (t.CYCLE = s.CYCLE)
WHEN NOT MATCHED THEN INSERT (CYCLE) VALUES (s.CYCLE);
```

- **为什么必须预置**：`SELECT … FOR UPDATE SKIP LOCKED` 返回 0 行的含义是「别人在跑」。轮次行一旦缺失，**所有节点会集体永久跳过且不报错**（`06` §1.1 第 4 步 / §1.2.1）。启动时用 `MERGE` 补，缺哪行补哪行。
- **为什么用短名**：`FvTurn.cycle` 是 `VARCHAR2(8)` 且唯一索引（`06` §1.2 表定义），`LOG_MONITOR`（11）/`SERVER_HANG`（11）都装不下。`LOGMON` / `HANGMON` 在 8 字符内；若坚持语义全称，须先把该列扩到 `VARCHAR2(32)` 并连动 `06`。
- `id` 由自增 / 框架补；`fromTs` / `toTs` / `owner` / `startedAt` / `streamCnt` 全部留空 —— 本服务用块进度表推进，不用 `FvTurn` 的时间游标。
- 多实例部署时**每台启动都跑这段 MERGE**，幂等。

### 4.2 业务规则样例（非启动依赖，用于联调校验）

```sql
INSERT INTO FvAlarmCfg (ID, NotifyInterval)
VALUES ('ALARM-PROD-ORA', 5);

INSERT INTO FvLogMonitorCfg
  (ID, Item, Environment, Keyword, ExcludeKeywords,
   FollowRuleNames, ExcludeRuleNames, Priority, AlarmCfgId, Description)
VALUES
  ('CFG-PROD-ORA', 'PROD-ORA-EXCEPTION', 'PROD', 'ORA-', NULL,
   '["EAPReqJobInEx","EAPReqJobOutEx","JOBPREPRULE"]', '["PRE","POST"]', 'P1',
   'ALARM-PROD-ORA', 'PROD 环境 FABsrv.10 / FABsrv.20 的 Oracle 报错关键字');

INSERT INTO FvAlarmCfg (ID, NotifyInterval)
VALUES ('ALARM-PIRUN-EAP', 5);

INSERT INTO FvLogMonitorCfg
  (ID, Item, Environment, Keyword, ExcludeKeywords,
   FollowRuleNames, ExcludeRuleNames, Priority, AlarmCfgId, Description)
VALUES
  ('CFG-PIRUN-EAP', 'PIRUN-EAP-OFFLINE', 'PIRUN', 'EAP offline', NULL,
   '["EAPReqJobOutEx"]', NULL, 'P2',
   'ALARM-PIRUN-EAP', 'PIRUN 环境 FABsrv.2 的 EAP 掉线');
```

- 收件人 / 飞书群地址由 `01` 配置页按真实值填写，**运行时不预置**；`MailToUsers` 为空 ⇒ 不发邮件（`01` §2.2）。
- 两份名单是 JSON 字符串数组，空 / 未配置存 `NULL`；`Item + Environment` 唯一；保存后下一轮生效。
- 示例用的是项目固定枚举：接口 / Rule Name 为 `JOBPREPRULE` / `EAPReqJobInEx` / `EAPReqJobOutEx` / `PRE` / `POST`，服务为 `FABsrv.2` / `FABsrv.10` / `FABsrv.20`。

### 4.3 部署顺序

`①` 建两张 Oracle 表 → `②` 预置轮次行 → `③` `PUT` ISM Policy（§2.1）→ `④` `PUT` 索引模板（§1.2）→ `⑤` 配置页录规则 → `⑥` 启动告警服务。
`③ / ④` 顺序不能反：策略靠 `ism_template` 匹配，索引一建出来就得挂上（`09` §一）。

---

## 5. 服务运行逻辑

**结论：每轮 8 步，扫描范围由「块进度」界定，不由时间窗界定；配置每轮重读，事实先写、进度后推。**

### 5.1 链路位置

```
Filebeat ──▶ Logstash ──▶ OS 行索引 mes-log-line-* ──┬──▶ 展示层（只读查日志）
                                                     └──▶ 派生服务 Scheduler + Worker
                                                                  ↓ 按流重放切块
                                                           OS 块索引 mes-log-exec-*
                                                                  ↓
                                              告警服务（3min 串行扫，本文 §6）
                                                                  ↓
                          OS 结果索引 mes-log-monitor-issue-*  +  Oracle 两张表
```

行是**先**落库、块是 Scheduler + Worker **异步**产出的。所以「只管入块的行」靠**块驱动**实现：块产出后才进候选，天然不含未入块的行，也吃掉派生延迟。

### 5.2 每轮 8 步

| 步 | 做什么 | 打在哪 |
|---|---|---|
| 1 | **读配置**：全量重读 `FvLogMonitorCfg` + `FvAlarmCfg`（§7），`Environment` 去重成集合、按环境分组；不缓存 | Oracle |
| 2 | **取候选块**：`EXEC_STATUS = 进行中` 的块（按上述环境集合）∪ 进度表中 `TerminalFlag = 'N'` 的块，合并去重；`ENV` 进查询条件，不拉全量回内存筛 | 块索引读别名 + 进度表 |
| 3 | **块筛**：按规则的两份 Rule Name 名单过滤（§5.3）；没配规则的环境压根不查 | 块文档 `RULENAME` |
| 4 | **查进度**：按 `BlockId` 读 `LAST_SCANNED_LINE_ID`；没有的按新块处理（下界 = 块 `START_LINE_ID`）；末行未推进的块跳过，零查询 | Oracle 进度表 |
| 5 | **回行取增量**：按锁流三元组 `ENV + HOSTIP + SERVER_ID` + 块 `START_TIME` / `END_TIME` 粗筛 `LOG_TIME`，用 `[START_LINE_ID, END_LINE_ID]` 精确截断，再截掉上次扫过的行（§5.4）；跨天按两端点算日索引名，不打开读别名 | 行索引 |
| 6 | **逐行判**：`LOG_BODY` 原文过 `Keyword` + `ExcludeKeywords`；**一命中行一条 issue**，`issueId` = `LineId\|Item`，同一行被多条规则命中可各生成一条 | 行文档 |
| 7 | **写结果**：OS 结果索引按 `_id` 幂等写 4 字段 → Oracle 状态行按 `UK = (LineId, Item)` 冲突跳过 + 进度 UPDATE，**两者在同一 Oracle 事务提交** | 两源 |
| 8 | **两个出口**：汇总变化推 SSE 给 `05`；通知器按 `NotifyInterval` 独立合并发邮件 / 飞书（§5.7）。**处置状态只由 `05` 写** | — |

> 第 2 步的并集是关键：进行中块靠状态枚举，已闭口但进度未标终态的块靠进度表兜住，**不依赖 `CLOSE_TIME` 墙钟窗口**，因此业务机时钟偏移 / 派生延迟都不会造成漏扫。`CLOSE_TIME` 只作观察，不作查询条件。

### 5.3 判定口径（5 项检查）

| # | 检查项 | 层级 | 打在哪 | 否决条件 |
|---|---|---|---|---|
| 1 | `Environment` | 环境 | 块 `ENV` | 不在本轮规则的环境集合内 |
| 2 | 关注 Rule Name（`FollowRuleNames`） | Rule 级白名单 | 块 `RULENAME` | 值不为空且不在名单内；未配名单跳过 |
| 3 | 排除 Rule Name（`ExcludeRuleNames`） | Rule 级黑名单 | 块 `RULENAME` | 在名单内；未配名单跳过 |
| 4 | `Keyword` | 词级命中 | 行 `LOG_BODY` | 原文不含关键字 |
| 5 | `ExcludeKeywords` | 词级黑名单 | 行 `LOG_BODY` | 原文含任一排除词；未配名单跳过 |

- **顺序**：`1~3` 在块阶段、`4~5` 在行阶段，两段都过才生成 issue。
- **一律区分大小写**：`ORA-` 不命中 `ora-`，`EAPReqJobInEx` ≠ `eapreqjobinex`。`match_phrase` 打 `LOG_BODY` 只作粗筛取候选，最终判定取回原文按字节比较；`01` §4.3 的两条交叉校验沿用同一口径。
- **只管入块的行**：通信族 `COMM_RCV` / `COMM_SND`、定时器族 `POLL`、解析不出的纯文本行、无归属块的行，照常落行文档但没有块，本服务一律不管（`04` §4.2.1 / §3.2.1.1），不设旁路。
- **`RULENAME` 为空的块仍进候选**：配了关注名单时**空值放行**，排除名单对空值也不生效；七个业务字段解析不到留空是常态，不能整块丢掉。
- **多值按任一命中**：块 `RULENAME` 等七个业务字段是 keyword 数组（`04` §1375），任一元素命中名单即算命中；`05` DTO 是 `string`，出参按「出现顺序 + 同值去重」**取首值**。
- **查询按规则各发一次**（`Keyword` 粗筛 + 时间范围 + `size` 上限），OpenSearch 只返回命中行，不一次拉该环境全量日志。

### 5.4 增量取行、幂等与崩溃恢复

**行 `_id` 不能比大小**（第三段是哈希，`04` §3.2.2），所以增量不靠 `_id` range：

1. `LastScannedLineId` 的**第 5 段是 17 位毫秒串** `yyyyMMddHHmmssSSS` ⇒ 解析出 `LOG_TIME` 下界，`range LOG_TIME gte` 该值。
2. 同毫秒多带的行，用 `hit._id` 与 `LastScannedLineId` 比对截断；排序 `[LOG_TIME 升序, _doc 升序]` + `search_after`（`04` §3.2.2，行索引 1 分片才有 `_doc` tie-break）。
3. 上界用块 `END_LINE_ID`；进行中块的 `END_LINE_ID` 会随重放推进，闭口后固定。
4. 块被尾行解封（`REOPEN_LOG`）或重放 UPSERT 导致末行身份串回退时，不记解封次数 / 重放版本，靠 `issueId` 幂等兜重复。

| 块状态 | 本轮动作 |
|---|---|
| 进度表没有 | 新块 → 扫 `[START_LINE_ID, 当前 END_LINE_ID]` |
| 已扫过、末行未变 | 跳过，零查询 |
| 已扫过、块推进了 | 只扫上次末行之后的新行 |
| 已终态且已扫 | 永久跳过，进度行可按保留期清 |

**崩溃恢复按「先写事实、后推进度」**：OS 结果按 `_id` 覆盖、Oracle 状态行按 UK 冲突跳过，且 Oracle 侧「状态行 INSERT + 进度 UPDATE」同一事务；崩在任意一步，进度都不推进，下轮重扫这一段，两源幂等保证最终一致。跨源没有同一事务，这就是替代方案。

### 5.5 字段来源与三源拼装

| 时点 | 写 / 读 | 字段 |
|---|---|---|
| 扫描时写 OS | 结果索引 4 项 | `_id` / `issueMessage` / `blockId` / `issueTime` |
| 扫描时写 Oracle | 状态行 | `LineId` / `Item` / `Environment` / `Priority` / `RuleName` / `IssueTime` / `ReportTime` |
| `05` 处置 / 通知写 | 状态行 | `ResolvedTime` / `ResolvedUser` / `ResolvedComment`、`Alarmed` / `LastAlarmTime` |
| 查询明细时现取 | 块 / 行索引 | `lotId` / `tId` / `hostIpAddress` / `ruleMessage` |

`05` 的 `LogMonitorAlarmDetailDto` **14 字段一个都不改**：Oracle 9（含现算 `issueId`）+ OS 结果 1（`issueMessage`）+ 块 / 行索引 4。汇总 `LogMonitorSummaryInfoDto` 9 字段全在 Oracle 单源聚合。`resolve` 只写 Oracle；`Alarm Log` 下载取 Oracle `LineId` 回行索引 `GET` 原文。

**回块取数走两轮批量 `mget`**：当页 `blockId` 去重取块文档 → `START_LINE_ID` 去重取行文档，不逐条单查；块 / 行取不到时按 `04` §7.3 落空串，不报错、不阻塞列表返回。

### 5.6 限流、降级与失败

| 项 | 口径 |
|---|---|
| 单规则每轮上限 | **50 条**；上限内逐条写，超出部分折叠成**一条汇总 issue**（正文「另有 M 条同类，已折叠」） |
| 折叠 issue 的键 | `LineId` 取本轮超出的第一行 `_id`、`Item` 同规则 —— 这些行本来就没落库，UK 不冲突，`Alarm Log` 也能回捞到真实原文；折叠只在单轮内生效，不跨轮累计 |
| `RULENAME` 空值 | Oracle `RuleName` 落空串，不写 `UNKNOWN` / `-`（`04` §7.3） |
| 环境值域 | 以 Misc `mes.global.environments` 为准，部署时与 Filebeat `fields.ENV` 大写值对齐；两边不齐 `term` 全落空**且不报错**（§7.3） |
| OS 查询超时 / 落库失败 | 本轮进度不推、整体回滚，下轮重扫；失败记服务日志，不吞异常 |
| 通知失败 | 逐群重试一次、仍失败只记日志（`01` §2.2），不阻塞扫描 |
| 自监控指标 | 轮次长期抢不到、单轮耗时超 3min、进度停滞、结果写入失败计数；具体指标名归 `10` |

### 5.7 两个出口（都不在扫描锁内）

| 出口 | 驱动 | 说明 |
|---|---|---|
| **SSE 汇总增量** | Oracle 状态行变化 | `05` §2.1 以 `Item + Environment` 为条件更新汇总行；与邮件 / 飞书**不是一回事** |
| **邮件 / 飞书通知** | `FvAlarmCfg.NotifyInterval` 分钟窗口 | 按 `AlarmCfgId + Alarmed = 'N'` 捞本窗口 issue → 合并一条发出 → 回写 `Alarmed = 'Y'` / `LastAlarmTime`；空窗口不发、P1 不设旁路、正文最多列 20 条、日志片段按 `LineId` 回行索引现捞 |

**待发通知不落表**，就是状态行上的 `Alarmed = 'N'`；发完即清，零累积。通知发送是外部 IO，**必须移出 §6 的行锁范围**（详见 §6.5）。

---

## 6. 定时器 · 串行执行与多实例互斥

**结论：3 分钟一轮，行锁覆盖整轮；被占用的刻度跳过、不补跑。跳过的周期不会漏报 —— 增量靠块进度表，不靠时间窗。**

### 6.1 周期与触发

| 项 | 口径 |
|---|---|
| cron | `0 0/3 * * * *` —— **6 位带秒位**，每 3 分钟第 0 秒触发（`06` §1.2.1 同款） |
| 时钟 | 各节点 NTP 对齐；这是「多节点同时醒」的基准 |
| 串行语义 | **不排队、不补跑**：上一轮没结束，下一个刻度整轮跳过；不是在结束后立刻补一轮（补跑会让周期漂移，故障恢复时堆一串） |
| 固定速率 | cron 是固定速率触发，上一轮没完下一次照样来 ⇒ 必须有两层防重入（§6.4） |

### 6.2 抢轮次伪代码

```
cron 0 0/3 * * * *:
    if 本机上一轮还没跑完:  跳过本次触发                 # ① 同机防重入
    BEGIN 事务                                          # ② 行锁从这里开始
    if SELECT CYCLE FROM FvTurn WHERE CYCLE = 'LOGMON'
              FOR UPDATE SKIP LOCKED 返回 0 行:
        COMMIT;  本轮结束                               # 别人在跑；什么都没改
    # ③ 整轮扫描（§5.2 的 8 步）全在锁内
        读配置 → 取候选块 → 块筛 → 查进度 → 回行取增量 → 逐行判
        → 写 OS 结果 → 写 Oracle 状态行 + 推进度（同一 Oracle 事务）
    # ④ SSE 增量在 COMMIT 之后推；通知发送完全在锁外
    COMMIT                                             # ⑤ 放锁
```

- `SELECT … FOR UPDATE SKIP LOCKED` 返回 1 行即抢到，行锁从这条 `SELECT` 一直持到 `COMMIT`；返回 0 行即别人在跑，本轮事务直接结束（`06` §1.2.1）。
- **轮次行必须预置**（§4.1），否则返回 0 行会被误读成「别人在跑」，所有节点集体永久跳过且不报错。

### 6.3 时序

| 触发点 | 实例 A | 实例 B / C | 数据 |
|---|---|---|---|
| t=0 | 抢到 `LOGMON` 行锁，扫描开始 | `SKIP LOCKED` 返回 0 行，本轮事务结束 | 扫 t=0 前攒下的块增量 |
| t=3min | 仍在扫，持锁跨过刻度 | 锁未释放 ⇒ 全部跳过 | **不漏**：进度没推进，行留到下轮 |
| A 提交 | 释放锁、进度已推、推 SSE | — | 结果落库 |
| t=6min | 重新抢（也可能被别的实例抢到） | 同上 | 一次扫掉这 6 分钟累积的行 |

### 6.4 多实例与多任务

| 层 | 做法 |
|---|---|
| **跨机互斥** | Oracle 行锁 + `SKIP LOCKED`；不引入 Redis / 分布式锁 |
| **同机防重入** | 进程内「正在跑就跳过本次触发」标记（cron 固定速率，上一轮没完下次照样来）—— `06` §1.2.1 明确写了，别漏 |
| **按任务分行** | 关键字监控 `LOGMON`、Server Hang `HANGMON` **各占一行、各一把独立行锁**，互不阻塞；不要挤派生层的 `FAST` / `SLOW` 两行 |
| **轮次行长度** | `FvTurn.cycle` 是 `VARCHAR2(8)` ⇒ 短名（§4.1），用全称需先扩列 |
| **多实例收益** | 谁抢到谁跑，其余节点零成本跳过；某节点挂了下一轮别的节点直接接管，无主备切换 |

### 6.5 崩溃、跳周期与长事务

- **崩溃不用租约**：持的是 Oracle 行锁，进程崩了事务回滚、锁自动释放 —— 这是选 DB 行锁而非 Redis 锁的最大好处。
- **通知必须移出锁范围**：邮件 / 飞书是外部 IO，放锁内会把整轮事务拖成分钟级长事务；它本来就是 `Alarmed = 'N'` 按 `NotifyInterval` 独立驱动的，不归扫描轮次管。
- **一轮真超过 3min**：按「跳周期」跑，正确性没事，只是发现延迟变长；先观察自监控，不改机制。要退化成「短事务抢锁 + 租约接管」，得额外处理假死双跑（块进度 CAS + `issueId` 幂等 + fencing），归 `10`。
- **同周期跑两轮的边界**：一轮接近 3min 结束时，`COMMIT` 之后恰好赶上刻度，后醒的节点可能再抢到一轮 —— 幂等重扫，不出错数据。
- **相位固定的节点**可能长期抢不到轮次，它不报错、也不影响正确性；排查时先看这一处。

### 6.6 最坏发现延迟

`3min（扫描周期）+ 派生层快 / 慢轮次（30s / 60s）+ 块产出延迟 ≈ 3.5 ~ 4 分钟`，仍在「分钟级」内，北星指标（把 Lot stuck / EAP offline / 接口超时等典型异常 MTTR 压到分钟级）不破。若一轮被跳过，最坏再加 3min。

---

## 7. 配置 · 每轮读表

**结论：服务不做配置缓存、不做热加载监听；每轮扫描的第 1 步从 Oracle 全量重读，改配置下一轮生效。**

### 7.1 读什么

| 表 | 读的字段 | 用途 |
|---|---|---|
| `FvLogMonitorCfg` | `Environment` / `Item` / `Keyword` / `ExcludeKeywords` / `FollowRuleNames` / `ExcludeRuleNames` / `Priority` / `AlarmCfgId` | 规则、名单、分组维度；**一行 = 一条规则 = 一个关键字**，`Item + Environment` 唯一 |
| `FvAlarmCfg` | `NotifyInterval` / `MailToUsers` / `MailCCUsers` / `FeishuWebhooks` / `FeishuAtUsers` | 通知窗口与渠道，按 `AlarmCfgId` 关联 |
| Misc `mes.global.environments` / `system.global.priority` | 环境名 / 等级值域 | 校验与下拉候选（`01` §2.1） |

- **不设 `enabled`**：配置即启用、有行即生效；运行时读的是**全部规则**，不做启停筛选。
- 三份名单是 JSON 字符串数组：未配存 `NULL` ⇒ 跳过该项检查；`Keyword` 是单值。
- 派生层 / 加工层的配置来自 `fabviewer.yaml`（`06` §四），**与本服务无关**；本服务的唯一配置来源是 Oracle 表。

### 7.2 生效点与在途语义

| 场景 | 口径 |
|---|---|
| 新增 / 修改规则 | **保存不立即生效**，下一轮扫描开头重读到才生效（`01` §5-18） |
| 删除规则 | 下一轮起不再参与扫描；**已生成的 issue 不删**，历史报警是证据 |
| 规则在途 | 本轮已读到规则后配置再改，本轮仍按读到的那份跑完；不做中途重载 |
| 改名单 | 块筛（两份 Rule 名单）与行判（排除词）都按本轮读到的版本；下轮起用新版本 |
| 通知配置 | 通知器按 `NotifyInterval` 独立驱动，改动同样下一窗口生效 |

> 「每轮读表」与「串行执行」是配套的：配置读取发生在**抢到行锁之后**（§5.2 步骤 1），保证一轮之内不会有两个实例各按不同版本跑。

### 7.3 三条静默失效防线

1. **环境名值域对齐**：规则 `Environment` 候选来自 Misc，采集层 `ENV` 是 Filebeat `fields` 写死的大写值（`04` §154）。两边值域 / 大小写不齐，`term` 全等会**一个块都命中不了且不报错** ⇒ 部署时逐环境核对，启动时打印读到的环境集合。
2. **轮次行预置**：缺 `LOGMON` 行 ⇒ 所有节点集体永久跳过（§4.1）。
3. **进度不越界**：`LastScannedLineId` 只在「结果写入 + 状态行 INSERT」都成功之后推进；写超了会跳过未扫的行且静默漏报（§5.4）。

---

### 附：口径基准与连动

**本次拍板（7 条）**：`①` 结果索引最小 4 字段；`②` `issueId` = `LineId|Item` 作 OS `_id`、Oracle 只存两列复合 UK；`③` 结果索引与块索引共用同一 ISM Policy（**沿用现行 360 天转冷不删，不改数字**）、Oracle 长期保留、界面查询下限 30 天；`④` 扫描周期 **3 分钟**且串行；`⑤` 多实例靠 `FvTurn` 行锁 + `SKIP LOCKED`，同机再加进程内标记；`⑥` 配置每轮全量重读、不缓存；`⑦` 只管入块的行、`RULENAME` 空值放行。

**引用现成口径**：`01` §2.1 / §2.2 / §5-18（配置表与生效点）、`04` §3.2.2（行 `_id` 五段）、§5.2.5 / §1322（ISM 分层与降级）、§5.3.2（块字段表）、`05` §2.1 / §2.3 / §4.6（9 + 14 字段契约）、`06` §1.1 / §1.2.1（`FvTurn` 表与抢轮次范式）、`09` §一 / §二（ISM 写法与模板约束）。

**待整体定稿同步（本轮不动）**：`04` §六口径 2「报警事件进 Oracle」与 §954「扫描窗口打 `@timestamp`」被 Z 方案与块级进度翻口径，`00` 概览 §4.1 存储选型、`05` §1 / §3 / §4 的三源拼装说明、`10` 的 DDL / 多实例执行模型 / 自监控指标、`deploy/opensearch/` 新增模板与 Policy 改动、`09` 文档同步 —— `04` 冻结，动前须单独拍板。
