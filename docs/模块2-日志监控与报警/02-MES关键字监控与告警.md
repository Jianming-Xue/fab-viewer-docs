# MES 日志关键字监控 · 运行时实现规格

> 模块 2 · 日志监控与报警 ｜ 功能 1 ｜ **2026-11-17 从头重写**：本版**只保留 Oracle 表结构**，其余章节（OS 索引模板、ISM、初始数据、运行逻辑、定时器）全部清空，待重新整理后逐章补。旧版内容在 git `9e3376b` 与备份 `/tmp/fabviewer_backup_20261117_075{0,4}/02.md`。

## 1. Oracle 表

### 1.1 状态表 `FvLogMonitorAlarmState`

每条 issue 一行。框架 `ID` 作 PK，业务键 `LineId + Item` 作复合 UK。

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

| 列 | 说明 |
|---|---|
| `ID` | 框架统一赋值，长度 ≤50；不出参 |
| `LineId` | 命中行 `_id` 原值（5 段，约 55~65 字符），`VARCHAR2(128)` 留余量 |
| `Item` | 规则业务键；同一行被多条规则命中各存一行 |
| `Environment` / `Priority` | 取自规则表；`Priority` 取 `P1` ~ `P4` |
| `RuleName` | 块 `RULENAME` 首值快照 |
| `IssueTime` | 命中行 `LOG_TIME` |
| `ReportTime` | 生成墙钟，首写后不变 |
| `ResolvedTime` / `ResolvedUser` / `ResolvedComment` | 处置时写 |
| `Alarmed` / `LastAlarmTime` | 通知器回写；`LastAlarmTime` = 通知发出时间 |

### 1.2 块进度表 `FvLogMonitorBlockScan`

每块一行，`BlockId` 作 UK。

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
| `ID` | 框架统一赋值 |
| `BlockId` | 块文档 `_id`（`REQUEST_EXEC_ID`），UK |
| `LastScannedLineId` | 上次扫到的末行身份串；末段 17 位是 `LOG_TIME` 毫秒串 |
| `TerminalFlag` | 扫完置 `Y`，未完维持 `N` |
| `LastScanTime` | 服务墙钟，仅自监控 / 清理用 |
