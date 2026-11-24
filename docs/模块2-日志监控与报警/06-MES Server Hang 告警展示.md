# MES Server Hang 告警展示 · 功能文档

> 模块 2 · 日志监控与报警 ｜ 功能 2 ｜ 状态：**接口已定（2 条端点）、待后端实现** ｜ 以本篇正文（§2 / §4）为唯一生效口径
> 本篇定义展示处置侧：把功能 2 判出的 `Server Hang` / `Endless Rule` issue **摆到界面上、并在界面上完成解决**。规则怎么配见 [`03`](03-MES%20Server%20Hang%20监控配置.md)；怎么判 / 检测时机 / 怎么落库见 [`04`](04-MES%20Server%20Hang%20监控与告警.md)；通知怎么发见 [`10`](10-告警服务工程实现.md)；视觉与交互见 [`../05-视觉与交互规范.md`](../05-视觉与交互规范.md)。

## 1. 功能定位

功能 2（Server Hang 监控）扫块、按两条判据落 issue；本篇把这些 **issue 摆到界面上**，让 IT 运维**查看并解决**，形成「发现 → 处置」闭环。本篇**只消费 issue**：不产生告警、不重跑判定、不发通知；配置见 `03`、判定与落库见 `04`、通知见 `10`。与功能 1 展示页（`05`）共用同一套处置状态机与交互（Resolve 弹框、More Info、环境下拉），但**页面与表各自独立**：本篇只有一张 Server Hang Issue 详情卡片，无汇总表、无下载按钮。

## 2. 页面与交互

### 2.1 菜单位置与权限

| 项 | 内容 |
|---|---|
| 一级菜单 | **`Monitor & Alarm`** |
| 二级菜单 | **`MES Server Hang Monitor`**（与配置页 `Config` 同属这一个二级菜单，见 `03` §3） |
| 本页 | **`View & Resolve`** —— 菜单项就显示 `View & Resolve` |
| 挂载位置 | **`monitor-alarm`** 模块下 |
| 权限方式 | **功能级到本菜单 + 「解决」`Resolve`**（与 `05` §2.1 关键字展示页同款） |

**权限点**

| # | 权限点 | 标识 | 限制行为 |
|---|---|---|---|
| 1 | **功能级（菜单）** | — | 二级菜单 `MES Server Hang Monitor` / 本页 `View & Resolve` 入口；有菜单权限才可进入、使用本页 |
| 2 | **「解决」** | `Resolve` | 控制单条 `Resolved` 开关与批量 Resolve（同一动作）；有权限可解决、无权限禁止解决 |

读类（明细分页）不单独设权限，进入本菜单即可查看。

**与配置页的关系**：两页共属二级菜单 `MES Server Hang Monitor`。配置页占 `Create` / `Update` / `Delete` 三个动作（见 `03`），本页只占 `Resolve`；两组动作各管各的、互不相干。

### 2.2 详情卡片 · 工具栏

页面自上而下**只有一张 Server Hang Issue 详情卡片**。卡片顶部工具栏左起三个控件：

| 控件 | 规格 |
|---|---|
| **Environment** | **下拉，可为空**；候选来自 Misc `mes.global.environments`，前端调 **`GET /api/v1/sys_misc/env/list`** 取值（该接口**归属 Misc 模块**，本篇只消费、不复刻规格）；**空 ＝ 不限环境**（各环境的行都返回），**有值 ＝ 只取该环境**，作 §4.1 的 `environment` 入参 |
| **Previous Days** | **输入框，可为空**；只接受 **1~60 的正整数**，越界 / 非整数在前端阻断并提示（后端同样按 1~60 校验）；**空 ＝ 按默认 30 天**（不是「不限」），作 §4.1 的 `previousDays` 入参 |
| **Refresh** | **按钮**；按**当前 Environment + Previous Days** 重新调 §4.1 取**第一页**刷新下方表格；刷新后清空表格多选选中 |

- **默认值**：进入界面 **Environment 为空、Previous Days 为 30**；首调 §4.1 即 `environment`（空）+ `previousDays=30`。
- **空值按 30**：点 **Refresh** 时 Previous Days 被清空（或本来就是空），**按 30 天重查**，与进界面默认一致；前端发请求时直接传 `previousDays=30`。
- **统计窗口**：`previousDays`（**空按 30**）＝**终点今天 23:59:59、起点（今天 −（N−1）天）00:00:00**，**按 `IssueTime` 过滤**（不是 `ReportTime`，见 §4.1 ①）。

### 2.3 明细表格

**触发**：**进入页面**即调 §4.1 取第一页（`environment` 空 + `previousDays=30`）；此后**只有点 Refresh 才重查**；不建实时通道、页面内不做定时刷新。

**出参**：`ServerHangMonitorDetailDto` 对象集合（**17 字段**，字段类型见 §4.3），按 **`ReportTime` 倒序** 排列（**同毫秒按 `ID` 倒序**兜底，§4.1 ②）。

- **`issueId`** = 每条 issue 的唯一 ID，即 OS 结果索引 `_id`（A `END_LINE_ID|Server Hang` / B `BlockId|Endless Rule`，见 `04` §3）；不单独成列，作行主键与解决提交标识（§2.4）。

**显示列（14 列）**

| # | 列（英文） | 列（中文） | 字段 |
|---|---|---|---|
| 1 | Environment | 环境 | `environment` |
| 2 | Host IP | 主机IP | `hostIpAddress` |
| 3 | Priority | 等级 | `priority` |
| 4 | Max Delay | 最大延迟 | `maxDelay` |
| 5 | Max Rule Cost | 最大耗时 | `maxRuleCost` |
| 6 | Issue Type | 问题类型 | `issueType` |
| 7 | ServerID | 服务ID | `serverId` |
| 8 | Rule Name | Rule名称 | `ruleName` |
| 9 | TID | TID | `tId` |
| 10 | Rule Message | Rule消息 | `ruleMessage` |
| 11 | Hang Start Time | 挂起开始时间 | `issueTime` |
| 12 | Alarmed | 是否通知 | `alarmed` |
| 13 | Report Time | 报告时间 | `reportTime` |
| 14 | Resolved | 是否解决 | **`resolvedTime` 派生的可点击开关**（§2.4） |

- **`issueType`** 三态：`Server Hang` / `Endless Rule` / `Rule Recovered`（B 闭合后原位改，见 `04` §7.6），照 Oracle `IssueType` 快照显示。
- **B 恢复行按已解决显示**：`04` §7.6 恢复时写 `ResolvedTime` = 当前时间、`ResolvedUser` = `System`、`ResolvedComment` = `Rule Recovered` —— 前端照常按 `resolvedTime` 非空派生 `resolved = true`（不再是人工处置的「未解决」行），More Info 里处置人显示 `System`（系统自动，不是登录用户）。
- **`maxDelay` / `maxRuleCost` / `priority`** 是告警生成时的配置快照（`04` §2.2），改配置不影响历史行。
- **列表未显示的字段**：`issueId`、`resolvedUser`、`resolvedTime`、`resolvedComment`。其中 `resolvedTime` 兼作 `Resolved` 开关判据；`resolvedUser` / `resolvedComment` 由 More Info 弹框展示（§2.5）；`issueId` 不展示，仅作行主键与解决提交标识。

**表格行为**

- **表格多选模式**，用于列表下方 **Resolve 批量提交**（§2.4）。
- **初始态 / 空态**：进入界面尚未查到 issue、或全部已解决 —— 均**只显示一个表头**，无数据行，不隐藏卡片。
- **操作列为菜单**，含 **More Info**：点击弹出详情对话框（规格见 §2.5）。
- 列表有**刷新**按钮、**无新增记录入口**（不新建 issue）。

### 2.4 解决（resolve）

**两个入口，同一套提交链路（§4.2）**

| 入口 | 触发 | 提交标识 |
|---|---|---|
| `Resolved` 开关 | 点击**关闭态**开关 | 该行 `issueId`（单个） |
| 列表下方 **Resolve** 按钮 | 多选后点击 | 选中行中**未解决**的 `issueId`（多个，字符串数组） |

**`Resolved` 开关**

- 取值由 **`resolvedTime` 推断**：`resolvedTime` **为空 → 开关关闭**；**不为空 → 开关打开**。
- **行状态布尔 `resolved` 由前端从这个 `resolvedTime` 计算**：为空 → `false`（未解决）、不为空 → `true`（已解决）；**不在任何接口出入参中**（§4.3）。界面过程中的判断（Resolve 按钮是否可用、批量提交只取未解决行）一律用这个派生值。
- **开关打开时禁用**（已解决不可改回）；**开关关闭时取消禁用**、可点击。
- 点击关闭态开关 → 弹出**输入 `Resolved Comment` 的对话框**；**输入框不可为空** → 点「确认」提交。
- 提交成功后，返回的 `ServerHangMonitorDetailDto` 按 **`issueId` 回显、覆盖列表中对应行**（§4.2）。

**Resolve 按钮**

- 多选模式下：选中行中**只要有一个 `resolved = false`，按钮即可用**；否则**不可用（禁用）**。
- 点击 → 同样弹出**输入 `Resolved Comment` 的对话框**（不可为空）提交；`issueIds` 数组**只放选中行里 `resolved = false` 的 `issueId`，不含已解决行**。

> 单条与批量**同走 §4.2 一个接口、同一个入参对象**：`issueIds` 始终维持数组形态，可放 1 个也可放多个；本篇不另立单条接口。

**提交后的行保留**

- 返回结果按 `issueId` 覆盖对应行；即使该行已变为「已解决」，**也不隐藏、仍保留显示在列表中**（重查只由 Refresh 触发，§2.3）。
- **覆盖按字段合并**：返回对象的字段**非空才覆盖**，**空串保留原值**（防 OS 补齐失败时把列表里已有的 `hostIpAddress` / `ruleMessage` 冲成空，§4.2 ④）。

### 2.5 More Info 弹框

**展示字段（3 个）**：`resolvedTime`（Resolved Time）、`resolvedUser`（Resolved User）、`resolvedComment`（Resolved Comment）；**`issueId` 不展示**。

| 区块 | 呈现 |
|---|---|
| **Resolved Time** | **时间组件**，**禁用** |
| **Resolved User** | **输入框组件**，**禁用** |
| **Resolved Comment** | **输入框组件／文本域**（多行），**禁用**；显示解决时填写的 `resolvedComment` 原文 |

- 三者显示顺序：**Time → User → Comment**；均**禁用**（解决时填的 comment 在此原样回显）。
- 三个字段**均取自当前行对象**，不另调接口。
- **按钮**：More Info 弹框**只有一个「关闭」按钮**，无「确认」/「保存」等其它操作按钮；与 §2.4 输入 `Resolved Comment` 的对话框（含「确认」提交）不是同一个弹框。

## 3. 数据口径

- 字段与取值一律引用 [`04`](04-MES%20Server%20Hang%20监控与告警.md)（Oracle 表 §2、结果索引 §3）与 [`../09-OpenSearch索引模板.md`](../09-OpenSearch索引模板.md)（块 / 行索引字段），本篇不另立。
- 汇总无（本篇只有详情卡片）；明细字段与列见 **§2.3**，排序按 `reportTime` 倒序；解决提交与行覆盖见 **§2.4 / §4.2**。
- 时间窗按 `IssueTime`（字段语义见 `04` §2.1），见 **§2.2 / §4.1 ①**；端点的总表与全局约定见 **§4.0**、出入参对象见 **§4.3**。

## 4. 接口

### 4.0 接口总表与全局约定

**2 条端点均归属 `telemetry-hub`**（与 `05` 关键字展示同服务）。下表路径是**后端注册路径**（均以 `/api` 开头，后端维持不变）；**前端调用时一律在前面加 `/telemetry-hub` 前缀**（如 `/telemetry-hub/api/v1/srv_hang_monitor/detail_info/page`），由网关转发时去掉。

| # | 服务内路径 | 方法 | 用途 | 权限 | 细则 |
|---|---|---|---|---|---|
| 1 | `/api/v1/srv_hang_monitor/detail_info/page` | `GET` | 明细分页（进页面 / Refresh） | 进入本菜单即可 | §4.1 |
| 2 | `/api/v1/srv_hang_monitor/resolve` | **`POST`** | 解决提交 | 有「解决」`Resolve` 权限可操作，无则禁止 | §4.2 |

> Environment 下拉另消费一个 **Misc 模块**的接口 **`GET /api/v1/sys_misc/env/list`** —— 同在 **telemetry-hub 服务下、前端调用同样加 `/telemetry-hub`**，只是路由前缀不属本功能（`/api/v1/sys_misc`）；**本篇只消费、不复刻规格**（与 `05` 对 Misc 接口的消费口径一致），接口异常时下拉空、不阻断页面其他部分。

**全局约定**（引用既有后端设计，本篇不另立）

| 项 | 约定 | 来源 |
|---|---|---|
| 响应外壳 | 两条 REST 统一走全局响应包：`code` / `success` / `errMsg` / `data` / `txId`，业务数据一律放 `data`；成功 `code = OK`、`success` 输出 `0` / `1`；**业务类失败 HTTP 恒 200** | `01` §4.3 共性约定 1 |
| 分页 | `detail_info/page` **有分页** | 同上 §1.5 |
| 对象命名 | API 入参 `Ro`、出参 `Dto`；**#1 `detail_info/page` 入参为 URL 拼接参数、不定义 `Ro`**（§4.1） | 同上 §1.6 |
| 定位键 | 单条 issue 按 `issueId` 定位（= OS 结果索引 `_id`，自带竖线） | §2.3 / `04` §3 |

### 4.1 明细信息分页（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/srv_hang_monitor/detail_info/page`** |
| 方法 | **`GET`** |
| 入参 | **参数拼接在 URL 中传递**（query 参数），**不定义 `Ro` 对象**；参数＝**分页**（见 §4.0）+ **`environment`** + **`previousDays`** |
| 出参 | **分页对象 `Pageable`**（行元素 17 字段见 §2.3 / §4.3） |
| 排序 | 按 **`ReportTime` 倒序**，**`ID` 作稳定第二键**（`ORDER BY ReportTime DESC, ID DESC`） |
| 调用时机 | **进入页面**调一次（`environment` 空、`previousDays=30`）；点 **Refresh** 按当前两值重查第一页 |
| 权限 | 进入本菜单即可查询 |

**后端取数（已定）**

**⓪ 入参校验与默认值**

| 参数 | 必填 | 校验 / 默认 | 不合法 |
|---|---|---|---|
| `environment` | 否 | ≤30；**可空，空＝不限环境** | 超长由框架层拒 |
| `previousDays` | 否 | 整数 **1~60**，缺省 **30** | 越界 / 非整数 ⇒ `PreviousDaysOutOfRange` |
| `pageIndex` | 否 | 整数 ≥ 1，缺省 **1** | `< 1` 按 1 处理 |
| `pageSize` | 否 | 整数 **1~200**，缺省 **20** | 越界 ⇒ `PageSizeOutOfRange` |

> `previousDays` 空不是「不限」，是**按 30 天**（§2.2）。前端进界面传 30、服务端收到空同样按 30。

**① 时间窗（以 `IssueTime` 为基准）**

| 项 | 取值 |
|---|---|
| `previousDays` | 空 ⇒ **30**；`N` ⇒ 窗口天数（1~60） |
| 终点 | **今天 23:59:59**；实现取**半开区间 `< 明天 00:00:00`**，避免 `TIMESTAMP(3)` 的 `23:59:59.xxx` 被 `<=` 挡掉 |
| 起点 | **（今天 −（N − 1）天）00:00:00**，即 `TRUNC(SYSDATE) - (N - 1)` —— 含今天共 **N 个自然日** |
| 过滤字段 | **`IssueTime`**（块 `LAST_LINE_TIME`，业务时间），**不是 `ReportTime`** —— 与 `05` 汇总按 `ReportTime` 不同，本篇需求按问题发生时间看窗口 |

> `N=30`、今天 11-23 时，窗口＝**10-25 00:00:00 ~ 11-23 23:59:59**（含两端 30 个自然日）。`(:days - 1)` 的减一不能省，否则 `N=30` 会变成 31 天。

**② SQL**（`TRUNC(SYSDATE)` 在服务端取当天零点；`:days` = `previousDays`，`:env` 可空）

```sql
-- A 总数（Pageable 的 total）
SELECT COUNT(*)
  FROM FvSrvHangMonitorAlarmState
 WHERE IssueTime >= TRUNC(SYSDATE) - (:days - 1)
   AND IssueTime <  TRUNC(SYSDATE) + 1
   /* :env 非空时才拼下面这行，避免空串 / NULL 的类型歧义 */
   AND Environment = :env;

-- B 当页数据（Oracle 12c+）
SELECT ID, IssueId, Environment, Priority, MaxDelay, MaxRuleCost,
       IssueType, RuleName, IssueTime, ReportTime, ResolvedTime,
       ResolvedUser, ResolvedComment, Alarmed
  FROM FvSrvHangMonitorAlarmState
 WHERE IssueTime >= TRUNC(SYSDATE) - (:days - 1)
   AND IssueTime <  TRUNC(SYSDATE) + 1
   /* :env 非空时才拼 */
   AND Environment = :env
 ORDER BY ReportTime DESC, ID DESC
 OFFSET (:pageIndex - 1) * :pageSize ROWS FETCH NEXT :pageSize ROWS ONLY;
```

- `:env` **为空时不拼这一条件**（按 `Environment` 动态拼 SQL），不用 `NVL` / `(:env IS NULL OR …)` 写法。
- **`ID` 取回只为排序第二键与 resolve 定位**，不出参（§4.3）。
- 排序键与过滤键都在本表，**不 join、不回 OS**；`total` 来自 Oracle，与 OS 能否补齐无关。
- 走现成辅助索引 `(Environment, Priority, ReportTime DESC)`，无需新建索引。

**③ OS 补四字段（三跳，按物理索引分批）**

Oracle 先出行，OS 只负责把 `issueId` → `blockId` → 块字段 → 行原文串起来：

| 跳 | 索引（去 prefix 基名） | 入参 | 取什么 |
|---|---|---|---|
| ① 结果 | **`mes-log-monitor-issue-{yyyy.MM}`** | 当页 `issueId` 集合 | `blockId` |
| ② 块 | **`mes-log-exec-{yyyy.MM.dd}`** | ①的 `blockId` 去重 | `HOSTIP`、`SERVER_ID`、`TID`、`START_LINE_ID` |
| ③ 行 | **`mes-log-line-{yyyy.MM}`** | ②的 `START_LINE_ID` 去重 | `LOG_BODY` → `ruleMessage` |

- **三跳都用 `ids` 查询按 `_id` 精确取**：不搜关键字、不排序、不算分。
- **索引名算出来、不扫读别名**：① 月取当页 Oracle 行的 `IssueTime` 月份（§2.1）；② 按 `_id` **末段 17 位毫秒串**（`yyyyMMddHHmmssSSS`）的日期（块按日索引）、③ 取同段毫秒串的月份（行按月索引）。一个当页可能跨几个月，**按索引名分组、一组一次请求**。
- **索引名不带环境段**，实际由框架 `prefix` 前置（`09` §五）。

**第 1 跳 · 结果索引**（一页多条同月，一次请求）

```json
GET /mes-log-monitor-issue-2026.11/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["blockId"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20261123101530001|Server Hang",
        "PROD_10.20.30.40_FABsrv.10_PROD_10.20.30.40_7c1d99e02b3f4a56_8012000_20261123101822180|Endless Rule"
      ]
    }
  }
}
```

**第 2 跳 · 块索引**（块 `_id` 末段也是 17 位毫秒，同样能定日）

```json
GET /mes-log-exec-2026.11.23/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["HOSTIP", "SERVER_ID", "TID", "START_LINE_ID"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_FABsrv.10_PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20261123101530001",
        "PROD_10.20.30.40_FABsrv.10_PROD_10.20.30.40_7c1d99e02b3f4a56_8012000_20261123101822180"
      ]
    }
  }
}
```

**第 3 跳 · 行索引**（只取块首行那一篇的原文）

```json
GET /mes-log-line-2026.11/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["LOG_BODY"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20261123101530001",
        "PROD_10.20.30.40_7c1d99e02b3f4a56_8012000_20261123101822180"
      ]
    }
  }
}
```

- 三段都**不带 `sort`**（按 `_id` 取没有顺序意义）；回填时**按 `_id` 建 map**，OS 返回顺序不保证。
- 结果索引**不需要加 `issueType` 过滤**：三跳用 `issueId` 精确取，A/B/恢复行的 `_id` 各不相同（`04` §3）。
- **`issueId` 第 1 跳不再拆**：它的竖线是 `_id` 本身的一部分（A `END_LINE_ID|Server Hang` / B `BlockId|Endless Rule`），整串就是结果索引 `_id`，直接按原文取，不像 `05` 的 `LineId|Item` 要拆两段查库（§4.2 ⓪）。

**④ 字段来源总表（17 字段）**

| # | 出参字段 | 来源 | 说明 |
|---|---|---|---|
| 1 | `issueId` | Oracle `IssueId` | = 结果索引 `_id`；行主键与解决提交标识 |
| 2 | `environment` | Oracle `Environment` | 分组 / 过滤键 |
| 3 | `priority` | Oracle `Priority` | 配置快照 |
| 4 | `hostIpAddress` | OS 块 `HOSTIP` | 单值 |
| 5 | `maxDelay` | Oracle `MaxDelay` | 配置快照，秒 |
| 6 | `maxRuleCost` | Oracle `MaxRuleCost` | 配置快照，秒 |
| 7 | `issueType` | Oracle `IssueType` | `Server Hang` / `Endless Rule` / `Rule Recovered` |
| 8 | `serverId` | OS 块 `SERVER_ID` | 单值 |
| 9 | `ruleName` | Oracle `RuleName` | 扫描时快照、单值 |
| 10 | `ruleMessage` | OS 行 `LOG_BODY`（经块 `START_LINE_ID`） | 块首行原文 |
| 11 | `issueTime` | Oracle `IssueTime` | 同时是选结果月索引的依据 |
| 12 | `reportTime` | Oracle `ReportTime` | 排序键 |
| 13 | `alarmed` | Oracle `Alarmed`（`NUMBER(1)`，布尔） | `1` → `true`、非 `1` → `false` |
| 14 | `resolvedUser` | Oracle `ResolvedUser` | 处置人 |
| 15 | `resolvedTime` | Oracle `ResolvedTime` | 前端据此派生 `resolved`（§2.4） |
| 16 | `resolvedComment` | Oracle `ResolvedComment` | 处置说明，More Info 弹框回显（§2.5） |
| 17 | `tId` | OS 块 `TID` | keyword **可多值**，**取数组首个** |

> Oracle 出 **13 个**（1、2、3、5、6、7、9、11~16），OS 出 **4 个**（4、8、10、17）。`ID` / 审计列**不出参**。**本篇不出 `issueMessage`**（`Server Hang` 的原文就是块首行 `ruleMessage`，见 `04` §3）。`tId` 取数组下标 0，取不到给空串。

**⑤ 取数要点**

1. **OS 是补齐、不是过滤**：一页里某些 `issueId` 在结果索引/块索引查不到 ⇒ 对应字段留**空串**，**不丢行、不改 `total`**、不报错，只记一条 WARN。
2. **OS 请求失败要报错**（连接 / 超时 / 5xx）：抛 `LogMonitorSourceUnavailable`，**不返回半页空字段**（与 `05` §4.2 ⑤同款口径）。
3. **行索引 360 天过期的降级**：`ruleMessage` 取不到 ⇒ 留空，其余 16 个字段照常。
4. **批量粒度**：每跳一次带整页 ID（≤ 200），**不逐行发请求**；按索引名分组后，跨几天就几组。
5. **`resolved` 只管前端派生、不改出参**：出参 17 字段、不含 `resolved`（§4.3）。

### 4.2 解决提交（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/srv_hang_monitor/resolve`** |
| 方法 | **`POST`** |
| 入参对象 | **`ResolveServerHangMonitorAlarmRo`** |
| 入参 1 | **`issueIds`**：字符串数组，**不可为空**；**维持数组形态**，可放 1 个也可放多个；批量提交时**不含已解决行** |
| 入参 2 | **`resolvedComment`**：字符串，**不可为空** |
| 出参 | **`ServerHangMonitorDetailDto` 对象集合**，按**实际更新成功的对象**返回（数量 ≤ 入参 `issueIds` 数量：已被解决的 `issueId` 不返回）；前端按 **`issueId`** 覆盖对应行 |
| 调用时机 | 对话框点「确认」提交时；`Resolved` 开关（单条）或 **Resolve** 按钮（批量） |
| 权限 | 有「解决」`Resolve` 权限可操作、无则禁止（`Resolved` 开关与 Resolve 按钮同一动作，§2） |

**后端取数（已定）**

**⓪ 入参校验与解析**

| 项 | 校验 | 不合法 |
|---|---|---|
| `issueIds` | **非空数组**（至少 1 个），元素非空 | `IssueIdsRequired` |
| `issueIds[i]` | **长度 ≤400**（表 `IssueId` 栏位）、**含竖线且两段非空**；**不拆段查库**（见下） | `IssueIdInvalid` |
| `resolvedComment` | **trim 后非空**，长度 **≤512**（表栏位 `VARCHAR2(512)`） | 空 ⇒ `ResolvedCommentRequired`；超长 ⇒ `ResolvedCommentTooLong` |

- **与 `05` 的 resolve 校验同规则**（非空数组、comment 不可为空且 ≤512、只改处置三列），**唯一差别是本表按 `IssueId` 等值定位**：
  - `05` 的 `issueId = LineId|Item`，按**首个竖线拆两段**得 `(LineId, Item)` 作查库条件；
  - 本篇 `issueId` 本身就是完整 `_id`（A `END_LINE_ID|Server Hang` / B `BlockId|Endless Rule`），**整串等值查 `FvSrvHangMonitorAlarmState.IssueId`**，不拆、不拼回。竖线只在格式校验时确认存在，不参与查库。
- **表的「已解决」没有单独的 `Resolved` 布尔栏位**：由 `ResolvedTime` 是否为空表示，配 `ResolvedUser` / `ResolvedComment` 记录处置。所以「更新 resolved」＝写这**三列**。

**① 读取与更新（同一事务）**

1. **加锁读**：按 `IssueId` 对**一次**查出 `ResolvedTime IS NULL` 的全部行，`FOR UPDATE` 锁住。
2. **集合为空 ⇒ 报错 `LogMonitorIssueNotFound`**（errMsg：勾选的 issue 不存在或已被解决），事务回滚、不写库。
3. **只改三列**：`ResolvedTime = :now`（服务墙钟取一次、整批同值）、`ResolvedUser = :user`（当前登录用户）、`ResolvedComment = :comment`；审计列由框架统一补，不手写。
4. 更新后的对象（`ID` + 新值）就是出参的 Oracle 半部分，不再回查一次。

```sql
-- A 加锁读（一次，不逐条；只捞未解决的）
SELECT ID, IssueId, IssueType, Environment, Priority, ReportTime, Alarmed
  FROM FvSrvHangMonitorAlarmState
 WHERE IssueId IN (:issueId1, :issueId2)
   AND ResolvedTime IS NULL
   FOR UPDATE;

-- B 批量更新（只按 A 捞到的 ID）
UPDATE FvSrvHangMonitorAlarmState
   SET ResolvedTime    = :now,
       ResolvedUser    = :user,
       ResolvedComment = :comment
 WHERE ID IN (:ids)
   AND ResolvedTime IS NULL;   -- 双保险：行本已被本事务锁住，正常必然成立
```

- `IN` 列表按实际数组长度拼（1 个就 1 项）；批量提交一行 SQL、**不循环单条 update**。
- 若 `issueIds` 出现**重复**，入库前先去重，避免 `IN` 列表撑大。

**② 出参组装**

- **Oracle 13 字段**：12 个取自更新后的对象（`resolvedTime` = `:now`、`resolvedUser` = `:user`、`resolvedComment` = 取本次入参 `:comment`），`issueId` 用对象 `IssueId` 原值（不再拼）。
- **OS 4 字段**（`hostIpAddress` / `serverId` / `ruleMessage` / `tId`）**复用 §4.1 ③ 的同一套三跳查询**，不另写一套；索引选择与分组规则完全一致。
- 出参字段集合与 §4.1 的 17 字段完全相同（§4.3）。

**③ 出参数量：按实际更新对象返回**

- 只返回**真正被更新**的对象，数量 ≤ 入参数量；已被解决的 `issueId` **不进集合、不返回**。
- 前端按返回的 `issueId` 逐个覆盖，**没返回的行保持原样**。
- **全员已被解决（集合空）⇒ 报错**，不返回空数组 —— 否则用户点了确认什么也没发生，以为没生效。

**④ 先提交、后补 OS（与读接口不同）**

- 顺序：**事务提交之后再走 OS 三跳**。理由：处置动作不能被 OS 拖死 —— 更新已生效还报错，用户重试会撞「已被解决」，反而更差。
- OS 补齐失败（连接 / 超时 / 5xx）⇒ **不报错**、记 WARN、**OS 4 字段回传空串**。
- 对应前端覆盖规则：**非空字段覆盖、空串保留原值**（§2.4）—— 否则会把列表里已有的 `hostIpAddress` / `ruleMessage` 冲成空。

**⑤ 幂等与并发**

1. **重复提交同一 `issueId`**：第二次读不到（已解决）⇒ `LogMonitorIssueNotFound`，**不会覆盖**原处置人与时间。
2. **两人并发**：`FOR UPDATE` 让后到者等锁，拿到锁后 `ResolvedTime IS NULL` 不再成立 ⇒ 空集合报错，**先到者赢**。
3. **一个 `issueId` 只对应一行**（UK `IssueId`），按 `ID` 批量更新不会误伤其它行。

### 4.3 出入参对象（已定）

| 对象 | 用于 | 字段 |
|---|---|---|
| `ServerHangMonitorDetailDto`（出参） | §4.1 明细分页的行元素 / §4.2 解决提交的返回 | **17 字段**见 §2.3、字段类型见下表；`issueId` 为每行唯一 ID、`resolvedTime` 派生 `Resolved` 开关 |
| `ResolveServerHangMonitorAlarmRo`（入参） | §4.2 解决提交 | 2 字段，见下表 |

**`ServerHangMonitorDetailDto`**

| 字段 | 类型 |
|---|---|
| `issueId` | `string` |
| `environment` | `string` |
| `priority` | `string` |
| `hostIpAddress` | `string` |
| `maxDelay` | `int` |
| `maxRuleCost` | `int` |
| `issueType` | `string` |
| `serverId` | `string` |
| `ruleName` | `string` |
| `ruleMessage` | `string` |
| `issueTime` | 时间类型 |
| `reportTime` | 时间类型 |
| `alarmed` | `boolean` |
| `resolvedUser` | `string` |
| `resolvedTime` | 时间类型 |
| `resolvedComment` | `string` |
| `tId` | `string` |

> 输出字段 **17 个**，**不含 `resolved`**：行状态布尔 `resolved` 由前端按 `resolvedTime` 是否为空计算（§2.4），不在接口出入参中。`maxDelay` / `maxRuleCost` 单位秒、出 `int`；`resolvedTime` 为时间类型，与 §2.5 的 Resolved Time 时间组件一致。

**`ResolveServerHangMonitorAlarmRo`**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `issueIds` | `List<string>` | 是 | **维持数组形态**，可放 1 个也可放多个；批量提交**不含已解决行**；元素为完整 `issueId`（含竖线，§4.2 ⓪） |
| `resolvedComment` | `string` | 是 | 对话框输入，**不可为空**、≤512 |

> `resolve` 出参按**实际更新成功的对象**返回 `ServerHangMonitorDetailDto`（数量 ≤ 入参 `issueIds`），前端按 `issueId` 覆盖对应行（§2.4 / §4.2）。

## 5. 公共内容（本篇只消费，定义不在本篇）

本篇跑在通用前端组件 / 规范与通用后端库之上；下面这些公共内容与配置**不在本篇定义、也不在本篇维护**，本篇只是调用 / 读取。明细散落在各节，此处集中列出备查，口径以对应节为准。

### 5.1 前端

| 项 | 来源 | 本篇用途 | 明细 |
|---|---|---|---|
| 视觉与交互规范 | [`../05-视觉与交互规范.md`](../05-视觉与交互规范.md) | 本页视觉与交互以其为准，本篇只记「哪个条件触发」、不记呈现 | 头部 |
| 环境下拉（接口 + 配置） | Misc 接口 `GET /api/v1/sys_misc/env/list` + 系统配置 `mes.global.environments` | 取 Environment 下拉候选；本篇只消费、不复刻规格，接口异常时下拉空、不阻断页面 | §2.2 / §4.0 |

### 5.2 后端

| 项 | 来源 | 本篇用途 | 明细 |
|---|---|---|---|
| 全局响应包 | 整体库既有（口径同 `01` §4.3） | `code` / `success` / `errMsg` / `data` / `txId`；两条端点走外壳、业务失败 HTTP 恒 200 | §4.0 |
| 分页 `Pageable` | 整体库既有 | `detail_info/page` 的分页出参结构；分页只在 Oracle 侧做，OS 不参与 | §4.0 / §4.1 |
