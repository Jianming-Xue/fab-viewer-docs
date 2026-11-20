# MES 关键字告警展示 · 功能文档

> 模块 2 · 日志监控与报警 ｜ 功能 1 ｜ 状态：**接口已定（4 条端点）、待后端实现** ｜ 以本篇 §5 为唯一生效口径
> 本篇只做一件事：把功能 1 判出的 Alarm **展示出来、并在界面上完成解决**。规则怎么配见 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md)；怎么判 / 检测时机 / 怎么通知见 [`02-MES关键字监控与告警.md`](02-MES关键字监控与告警.md)。

| 项 | 内容 |
|---|---|
| 功能名称 | 中文 **`MES关键字告警展示`**；英文 **`MES Log Keyword Monitor`**（菜单项显示为 `View & Resolve`） |
| 所属 Module | **`monitor-alarm`**；一级菜单 **`Monitor & Alarm`** / 中文 `监控通知` |
| **作用** | **把「MES 关键字监控」判出的报警日志展示出来，并在界面上完成解决** |
| 使用者 | IT 运维 |
| 界面类型 | **展示类 + 处置类** |
| 权限 | **采用权限管控方案**：**功能级** + **「解决」权限点**（`Resolved` 开关与 **Resolve** 按钮**共用同一个权限点**）；菜单渲染与接口鉴权同一份权限数据，权限点定义口径同 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §3.1（本页只占「解决」这一点，配置页的新增 / 编辑 / 删除三个点不作用于本页）；粒度见 §2 |
| 入口 | 一级菜单 `Monitor & Alarm` → 二级菜单 **`MES Log Keyword Monitor`** → 本页 **`View & Resolve`**（菜单项就显示 `View & Resolve`）；与配置页 `Config` 同属该二级菜单 |
| 数据来源 | 功能 1 判定生成的 **Alarm**（配规则见 `01`，判定与通知见 `02`，本篇不重跑判定、不发通知） |
| 与既有文档 | 规则怎么配 → [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md)；怎么判 / 检测时机 / 怎么通知 → [`02-MES关键字监控与告警.md`](02-MES关键字监控与告警.md)；字段与落点边界 → [`../04-后台链路与数据模型.md`](../04-后台链路与数据模型.md) §六 |

---

## 1. 功能定位与边界

**一句话**：功能 1（MES 关键字监控）定时扫日志、命中就生成 Alarm；本篇把这些 **Alarm 摆到界面上**，让 IT 运维看到、并**在界面上把它们解决掉**，形成「发现 → 处置」的闭环。

| 环节 | 归谁 |
|---|---|
| 配置规则（扫什么 / 等级 / 通知给谁） | `01` 配置文档 |
| 定时扫描、判定、生成 Alarm、通知 | `02` 运行时文档（§3 / §4.4 / §5） |
| **展示 Alarm + 界面处置** | **本篇 §2**（处置见 §2.4） |
| 字段 / 落点边界 | [`../04-后台链路与数据模型.md`](../04-后台链路与数据模型.md) §六 |

> 本篇**只消费 Alarm**：不产生告警、不重跑判定、不发通知；日志正文本体仍回 OpenSearch 查（链路边界不破）。

## 2. 页面与交互

### 2.0 前端规格总览

> 下表按区域收拢已定规格，细则见对应小节；组件的视觉呈现一律以 [`../05-视觉与交互规范.md`](../05-视觉与交互规范.md) 为准。

| 区域 | 元素 | 已定规格 | 细则 |
|---|---|---|---|
| 上卡片 · 汇总 | 工具栏 | **Environment 下拉**（候选来自 Misc，**可为空＝全部环境**）+ **Previous Days 输入框**（**1~60 正整数**，可空，**空按 30**）+ **Refresh** 按钮；进入界面 **ENV 空 / Days 30**；点 Refresh 按当前两值重查 | §2.1 |
| 上卡片 · 汇总 | 汇总表格 | **9 列**；**单选**；**无关键字搜索框**；操作列**「查看」为唯一触发**（行选中不参与）；**进入界面调 `list` 取首屏数据**，页面内不做实时推送、只由 Refresh 手动刷新 | §2.1 |
| 下卡片 · detail | 当前查看行标识 | 详情表格**上方显示当前查看行的 `item + environment`**；明细表格内**不显示 Item / Environment 两列** | §2.3 |
| 下卡片 · detail | 明细表格 | **9 列**；**多选**；按 `reportTime` 倒序；分页 | §2.3 |
| 下卡片 · detail | 初始 / 空态 | 未点「查看」、当前行无 issue、开关打开后全已解决 —— 均**只显示一个表头**，无数据行 | §2.3 |
| 下卡片 · detail | 查看行切换 | 点另一行「查看」后**自动回第 1 页、清空明细多选选中** | §2.3 |
| 下卡片 · detail | 列表工具 | **刷新**按钮；**无新增记录入口**；**只过滤未解决的开关**（开＝仅未解决，关＝全部） | §2.3 |
| 下卡片 · detail | **Alarm Log** 按钮 | 下载**选中行归属的原始日志**；**启用条件＝detail 列表中存在选中行即可**；下载类按钮，不新增 / 不修改记录；接口见 §4.5 | §2.3 |
| 下卡片 · detail | 操作列菜单 | **More Info** → 弹出详情对话框 | §2.3 / §2.5 |
| 下卡片 · detail | `Resolved` 开关 | 由 `resolvedTime` 派生；打开即禁用、关闭可点 → 弹 comment 框提交 | §2.4 |
| 下卡片 · detail | **Resolve** 按钮 | 选中行只要有一个 `resolved = false` 即可用；批量只提交未解决行 | §2.4 |
| 弹框 · More Info | 3 个字段 | **取自当前行对象**；Rule Message（Label 全文 + 参数逐行 + 展开 / 折叠）、Resolved Time（**时间组件**）、Resolved User（**输入框组件**）；Time 在前、两者禁用；**只有「关闭」按钮** | §2.5 |
| 弹框 · Resolved Comment | 输入框 + 确认 | `Resolved Comment` **不可为空** → 点「确认」提交 | §2.4 |
| 全局 | Body 布局 | **自上而下**两张卡片 | 本节布局段 |
| 全局 | 权限 | **功能级 + 「解决」权限点**（共 1 + 1）；`Resolved` 开关与 Resolve 按钮**共用同一权限点**；配置页的三个动作点不作用于本页 | 本节权限段 |

**Body 布局（自上而下）**：上方卡片 = **汇总信息表格**（§2.1）；下方卡片 = **点「查看」后的 detail**（§2.3，行选中不参与），detail 内的**解决动作**见 §2.4、**More Info 弹框**见 §2.5。汇总表格**无关键字搜索框**，卡片顶部工具栏＝**Environment 下拉 + Previous Days 输入框 + Refresh 按钮**（§2.1）；**进入界面即调** `/api/v1/log_monitor/summary_info/list` 取首屏数据，入参 **`environment` 传空**、**`previousDays` 传 30**（§4.1）。视觉与交互一律以 [`../05-视觉与交互规范.md`](../05-视觉与交互规范.md) 为准，本篇只记「哪个条件触发」，不记呈现。

**权限粒度**：**功能级**（菜单渲染与接口鉴权同一份权限数据）+ **「解决」权限点**。`Resolved` 开关与 **Resolve** 按钮**共用同一个权限点**：无该权限则两者均不可操作、`/api/v1/log_monitor/resolve` 接口亦不可调；「查看」不单独控权，随功能级。

**与配置页的关系**：两页共属同一二级菜单 `MES Log Keyword Monitor`，权限点写法同 `01` §3.1。该菜单下共 **1 个功能级 + 4 个动作点**：`01` 配置页占「新增」`Create` / 「编辑」`Update` / 「删除」`Delete` 三点，**本页只占「解决」一个点** —— 三点都不作用于本页，本页的「解决」也不给配置页。读类（汇总 / 明细 / Alarm Log 下载）不占动作点，随功能级。

### 2.1 汇总信息表格

**工具栏**（卡片顶部，左起三个控件）：

| 控件 | 规格 |
|---|---|
| **Environment** | **下拉，可为空**；候选来自 Misc `mes.global.environments`，前端调 **`GET /api/v1/sys_misc/env/list`** 取值（该接口**归属 Misc 模块**，本篇只消费、不复刻规格）；**空 ＝ 不限环境**（各环境的行都返回），**有值 ＝ 只取该环境** |
| **Previous Days** | **输入框，可为空**；只接受 **1~60 的正整数**，越界 / 非整数在前端阻断并提示（后端同样按 1~60 校验）；**空 ＝ 按默认 30 天**（不是「不限」） |
| **Refresh** | **按钮**；按**当前 Environment + Previous Days** 重新调 `list`（§4.1）取汇总数据；刷新后清空汇总表格的行选中，**不触发下方 detail 重查**（§2.4 三种重查时机里不含本动作） |

- **默认值**：进入界面 **Environment 为空、Previous Days 为 30**；首调 `list` 即 `environment`（空）+ `previousDays=30`。
- **空值按 30**：点 **Refresh** 时 Previous Days 被清空（或本来就是空），**按 30 天重查**，与进界面默认一致；前端发请求时直接传 `previousDays=30`。
- **统计窗口**：`previousDays`（**空按 30**）＝**终点今天 23:59:59、起点（今天 −（N−1）天）00:00:00**，**按 `ReportTime` 过滤**；5 个计数字段与 `lastAlarmTime` 均在该窗口内统计，窗口外的记录不参与（取数见 §4.1 ①）。`dailyCnt` / `dailyResolvedCnt` 另用固定今日边界，与窗口无关（§4.1 ②）。

出参为 **`LogMonitorSummaryInfoDto` 对象集合**（每个对象 9 字段与 9 列一一对应，字段类型见 §4.4）：

| # | 字段 | 列（英文） | 列（中文） |
|---|---|---|---|
| 1 | `environment` | Environment | 环境 |
| 2 | `item` | Item | 项目 |
| 3 | `priority` | Priority | 等级 |
| 4 | `remainingCnt` | Remaining Count | 剩余未处理数量 |
| 5 | `totalCnt` | Total Count | 总数量 |
| 6 | `totalResolvedCnt` | Total Resolved Count | 总解决数量 |
| 7 | `dailyCnt` | Daily Count | **今日问题数量** |
| 8 | `dailyResolvedCnt` | Daily Resolved Count | 今日解决数量 |
| 9 | `lastAlarmTime` | Last Alarm Time | 上次通知时间 |

- **表格单选模式**；**点操作列「查看」是触发下方 detail 的唯一动作**，**行选中不触发、也不作为前置条件**（§2.3）。
- **汇总数据在进入界面时调 `list` 取一次**，之后**只有点 Refresh 才重查**；不建实时通道、页面内不做定时刷新。
- 汇总表格的更新**不触发下方 detail 重新查询**；detail 的重查时机以 §2.4 三种为准。

### 2.2 字段定义（已定）

| 字段 | 定义 |
|---|---|
| `lastAlarmTime` | **发出通知的时间**，不是 Alarm 生成时间 |
| `dailyCnt` | **当日 issue 的数量**；中文列名 **今日问题数量** |
| `remainingCnt` / `totalCnt` / `totalResolvedCnt` / `dailyResolvedCnt` | 与 `dailyCnt` 一致，**统一按 issue 数量统计** |

> 9 列里的 5 个计数字段**单位一致、不混用**；其余字段语义随七问卡片逐条拍板后回填。

### 2.3 明细卡片（detail）

**触发**：点汇总表格操作列**「查看」** → 下方卡片展示该行 **`item + environment` 下的全部 issue list**，调 §4.2 分页接口；结果按 **`ReportTime` 倒序** 排列（**同毫秒按 `ID` 倒序**兜底，§4.2 ①）。**「查看」是唯一触发动作，行选中不触发 detail、也不作为前置条件**。

**当前查看行标识**：详情表格**上方显示当前查看行的 `item + environment`**；明细表格内**不再显示 Item / Environment 两列**（输出字段仍是 14 个，这两项只移到表格上方显示）。

**输出字段（14 个）**：`environment`、`item`、`lotId`、`ruleName`、`hostIpAddress`、`ruleMessage`、`issueMessage`、`tId`、`issueTime`、`reportTime`、`resolvedTime`、`resolvedUser`、`alarmed`、**`issueId`**；字段类型见 §4.4。

- **`issueId`** = 每条 issue 的**唯一 ID**；不单独成列，作为行主键与解决提交标识（§2.4）。

**显示列**（9 列）：

| # | 列（英文） | 列（中文） | 字段 |
|---|---|---|---|
| 1 | LotId | LotId | `lotId` |
| 2 | Rule Name | Rule名称 | `ruleName` |
| 3 | Host IP | 主机IP | `hostIpAddress` |
| 4 | Issue Message | 问题消息 | `issueMessage` |
| 5 | TID | TID | `tId` |
| 6 | Issue Time | 问题时间 | `issueTime` |
| 7 | Alarmed | 是否通知 | `alarmed` |
| 8 | Report Time | 报告时间 | `reportTime` |
| 9 | Resolved | 是否解决 | **`resolvedTime` 派生的可点击开关**（§2.4） |

**列表未显示的字段**：`environment`、`item`、`ruleMessage`、`resolvedTime`、`resolvedUser`、`issueId`。其中 `environment` / `item` **显示在详情表格上方**（当前查看行标识）；`ruleMessage` / `resolvedTime` / `resolvedUser` **由 More Info 弹框展示**（§2.5）；`issueId` **不展示**，仅作行主键与解决提交标识；`resolvedTime` 兼作 `Resolved` 开关判据。

- **表格多选模式**（汇总表格为单选，本表为多选）；多选用于列表下方 **Resolve 批量提交**（§2.4）。
- **初始态 / 空态**：进入界面尚未点「查看」、当前查看行无 issue、或未解决开关打开后全部已解决 —— 均**只显示一个表头**，无数据行，不隐藏卡片。
- **切换查看行**：点另一行的「查看」后，detail **自动回第 1 页、清空明细多选选中**，再按新行的 `item + environment` 查询。
- **操作列为菜单**，含 **More Info（更多信息）**：点击弹出**详情对话框**（规格见 §2.5）。
- 列表有**刷新**按钮、**无新增记录入口**（不新建 issue）；另设 **Alarm Log** 按钮，见本节末。
- **只过滤未解决的开关**：**开** → 调 §4.2 只查未解决；**关** → 调同一接口查全部（含已解决与未解决）。解决提交后的行保留规则见 §2.4。

**Alarm Log 按钮**

- **位置**：列表下方，与 **Resolve** 按钮并列。
- **用途**：下载**当前多选选中行归属的原始日志**；属下载类按钮，**不新增、不修改记录**。
- **启用条件**：**detail 列表中存在选中行即可**（不要求 `resolved = false`，与 Resolve 按钮判据不同）；无选中行时禁用。
- **单次上限**：服务端按 **`blockId` 去重后最多 10 个块**（§4.5 ②）；超限**由接口报错**、前端按框架错误提示展示，**不自动减选、不截断**。
- **权限**：随**功能级**管控，不属「解决」权限点。
- **调用接口**：**`POST /api/v1/log_monitor/log/download`**，入参 `LogMonitorLogDownloadRo`（只含 `issueIds`），出参为文件流；契约见 §4.5。

### 2.4 解决（resolve）

**两个入口，同一套提交链路（§4.3）**：

| 入口 | 触发 | 提交标识 |
|---|---|---|
| `Resolved` 开关 | 点击**关闭态**开关 | 该行 `issueId`（单个） |
| 列表下方 **Resolve** 按钮 | 多选后点击 | 选中行中**未解决**的 `issueId`（多个，字符串数组） |

**`Resolved` 开关**

- 取值由 **`resolvedTime` 推断**：`resolvedTime` **为空 → 开关关闭**；**不为空 → 开关打开**。
- **行状态布尔 `resolved` 由前端从这个 `resolvedTime` 计算**：为空 → `false`（未解决）、不为空 → `true`（已解决）；**不在任何接口出入参中**（§4.4）。界面过程中的判断（Resolve 按钮是否可用、批量提交只取未解决行）一律用这个派生值，不必每处再判 `resolvedTime`。
- **与 §4.2 同名入参 `resolved` 不是同一个东西**：前者是行状态（前端派生），后者是「只过滤未解决」开关的查询条件。
- **开关打开时禁用**（已解决不可改回）；**开关关闭时取消禁用**、可点击。
- 点击关闭态开关 → 弹出**输入 `Resolved Comment` 的对话框**；**输入框不可为空** → 点「确认」提交。
- 提交成功后，返回的 **`LogMonitorAlarmDetailDto`** 按 **`issueId` 回显、覆盖列表中对应行**（§4.3）。

**Resolve 按钮**

- 多选模式下：选中行中**只要有一个 `resolved = false`，按钮即可用**；否则按钮**不可用（禁用）**。
- 点击 → 同样弹出**输入 `Resolved Comment` 的对话框**（不可为空）提交；`issueIds` 数组**只放选中行里 `resolved = false` 的 `issueId`，不含已解决行**。

> 单条与批量**同走 §4.3 一个接口、同一个入参对象**：`issueIds` 始终维持数组形态，可放 1 个元素也可放多个；本篇不另立单条接口。

**提交后的行保留**

- 返回结果按 `issueId` 覆盖对应行；即使「只过滤未解决的开关」处于**打开**状态、返回的行已变为**已解决**，**也不隐藏、仍保留显示在列表中**。
- **覆盖按字段合并**：返回对象的字段**非空才覆盖**，**空串保留原值**（防 OS 补齐失败时把列表里已有的 `lotId` / `ruleMessage` 冲成空，§4.3 ④）。
- 只有用户主动触发以下三种动作之一，才按当前过滤条件重新查询、重新渲染列表：① 点列表**刷新**按钮；② **关闭**未解决开关；③ 重新点汇总表格的**「查看」**。

### 2.5 More Info 弹框

**展示字段（3 个）**：`ruleMessage`（Rule Message）、`resolvedTime`（Resolved Time）、`resolvedUser`（Resolved User）；**`issueId` 不展示**。

| 区块 | 呈现 |
|---|---|
| **Rule Message 全文** | 完整 `ruleMessage` 用 **Label** 形式显示（纯展示，不可编辑） |
| **解析后的请求参数** | 前端调 **API 组件中原有的 `mesRuleMessageParser` 方法**把 `ruleMessage` 里的参数解析出来，**逐行显示**；配一个**展开 / 折叠按钮**控制该区块展开或收起；**滚动只发生在参数行区域**，Label 区与其余区块不滚动 |
| **Resolved Time** | **时间组件**，**禁用** |
| **Resolved User** | **输入框组件**，**禁用** |

- 两个 Resolved 字段的**显示顺序**：**Time 在前、User 在后**；两者均**禁用**。
- **展示字段与 Rule Message 原文均取自当前行对象**，不另调接口；参数解析用 **API 组件中原有的 `mesRuleMessageParser` 方法**完成，不新增后端接口。
- **按钮**：More Info 弹框**只有一个「关闭」按钮**，无「确认」/「保存」等其它操作按钮；与 §2.4 输入 `Resolved Comment` 的对话框（含「确认」提交）不是同一个弹框。

## 3. 数据口径

- 字段与取值一律引用 [`../04-后台链路与数据模型.md`](../04-后台链路与数据模型.md)，本篇不另立；告警落点以 §六为边界。
- 汇总字段与列见 **§2.1**（`environment` / `previousDays` 两个查询条件见 §2.1 / §4.1）；已定字段语义见 **§2.2**；明细字段与列见 **§2.3**，排序按 `reportTime` 倒序；解决提交与行覆盖见 **§2.4 / §4.3**。
- 计数单位见 **§2.2**、More Info 弹框规格见 **§2.5**；四个端点的总表与全局约定见 **§4.0**、出入参对象见 **§4.4**。

## 4. 接口

### 4.0 接口总表与全局约定

**4 条端点均归属 `telemetry-hub`**（与 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §4 的 6 条配置接口同服务）；服务内前缀 `/api/v1/log_monitor`，前端调用加 `telemetry-hub` 前缀。

| # | 服务内路径 | 方法 | 用途 | 权限 | 细则 |
|---|---|---|---|---|---|
| 1 | `/api/v1/log_monitor/summary_info/list` | `GET` | 汇总首屏 / Refresh 重查 | 功能级 | §4.1 |
| 2 | `/api/v1/log_monitor/detail_info/page` | `GET` | 明细分页 | 功能级 | §4.2 |
| 3 | `/api/v1/log_monitor/resolve` | **`POST`** | 解决提交 | 「解决」权限点 | §4.3 |
| 4 | `/api/v1/log_monitor/log/download` | **`POST`** | Alarm Log 下载（选中行原始日志） | 功能级 | §4.5 |

>  Environment 下拉另消费一个 **Misc 模块**的接口 **`GET /api/v1/sys_misc/env/list`**，**不属本功能前缀**；**本篇只消费、不复刻规格**（与 `01` 对 Misc 接口的消费口径一致），接口异常时下拉空、不阻断页面其他部分。

**全局约定**（引用既有后端设计，本篇不另立）

| 项 | 约定 | 来源 |
|---|---|---|
| 响应外壳 | `list` / `detail_info/page` / `resolve` **三条 REST 统一走全局响应包**：`code` / `success` / `errMsg` / `data` / `txId`，业务数据一律放 `data`；成功 `code = OK`、`success` 输出 `0` / `1`；**业务类失败 HTTP 恒 200**。`log/download` **成功为文件流、不走外壳**，仅**错误时**以框架标准接口返回错误信息（§4.5） | [`../模块6-用户与安全管理/05-后端设计.md`](../模块6-用户与安全管理/05-后端设计.md) §1.4；`01` §4.3 共性约定 1 |
| 分页 | `detail_info/page` **有分页** | 同上 §1.5 |
| 对象命名 | API 入参 `Ro`、出参 `Dto`；**#2 `detail_info/page` 入参为 URL 拼接参数、不定义 `Ro`**（§4.2） | 同上 §1.6 |
| 定位键 | 汇总 / 明细按 `item + environment` 定位；单条 issue 按 `issueId` 定位 | §2.1 / §2.3 |

### 4.1 汇总信息（已定）

| 项 | 内容 |
|---|---|
| 路径 | `/api/v1/log_monitor/summary_info/list` |
| 方法 | **`GET`** |
| 入参 | **query 参数**（拼在 URL 中，**不定义 `Ro` 对象**）：**`environment`**（可空，空＝不限环境）+ **`previousDays`**（可空，**空＝按 30**；有值须为 **1~60 正整数**） |
| 出参 | **`LogMonitorSummaryInfoDto` 对象集合**（每个对象 9 字段见 §2.1）；集合行范围受 `environment` 收窄，计数字段受 `previousDays` 收窄 |
| 调用时机 | **进入界面调一次**（`environment` 空、`previousDays=30`）；点工具栏 **Refresh** 时按当前两值再调（**Previous Days 留空按 30**） |
| 权限 | 随**功能级权限**管控，无权限接口不可调 |

**后端取数（已定）**

**数据源：只查 Oracle 状态表 `FvLogMonitorAlarmState` 一张表** —— 不读 OS 索引、不 join 规则表（规则删了 Alarm 仍要显示，项目 / 等级用行内快照）。

**① 时间窗（以 `ReportTime` 为基准）**

| 项 | 取值 |
|---|---|
| `previousDays` | 空 ⇒ **30**；`N` ⇒ 窗口天数（1~60） |
| 终点 | **今天 23:59:59**；实现取**半开区间 `< 明天 00:00:00`**，避免 `TIMESTAMP(3)` 的 `23:59:59.xxx` 被 `<=` 挡掉 |
| 起点 | **（今天 −（N − 1）天）00:00:00**，即 `TRUNC(SYSDATE) - (N - 1)` —— 含今天共 **N 个自然日** |
| 过滤 | `ReportTime >= 起点 AND ReportTime < 明天 00:00:00` |

> 取**整零点**且**含今天正好 N 天**：`N=30`、今天 11-18 时，窗口＝**10-20 00:00:00 ~ 11-18 23:59:59**（含两端 30 个自然日）。前端进界面传 30、服务端收到空同样按 30。

**② SQL**（`TRUNC(SYSDATE)` 在服务端取当天零点；`:days` = `previousDays`，`:env` 可空）

```sql
SELECT Environment,
       Item,
       MAX(Priority)                                                 AS PRIORITY,
       SUM(CASE WHEN ResolvedTime IS NULL     THEN 1 ELSE 0 END)      AS REMAINING_CNT,
       COUNT(*)                                                       AS TOTAL_CNT,
       SUM(CASE WHEN ResolvedTime IS NOT NULL THEN 1 ELSE 0 END)      AS TOTAL_RESOLVED_CNT,
       SUM(CASE WHEN ReportTime >= TRUNC(SYSDATE) THEN 1 ELSE 0 END)  AS DAILY_CNT,
       SUM(CASE WHEN ReportTime >= TRUNC(SYSDATE)
                 AND ResolvedTime IS NOT NULL THEN 1 ELSE 0 END)      AS DAILY_RESOLVED_CNT,
       MAX(LastAlarmTime)                                             AS LAST_ALARM_TIME
  FROM FvLogMonitorAlarmState
 WHERE ReportTime >= TRUNC(SYSDATE) - (:days - 1)
   AND ReportTime <  TRUNC(SYSDATE) + 1
   /* :env 非空时才拼下面这行，避免空串 / NULL 的类型歧义 */
   AND Environment = :env
 GROUP BY Environment, Item
 ORDER BY Environment, Item
```

- `:env` **为空时不拼这一条件**（按 `Environment` 动态拼 SQL），不用 `NVL` / `(:env IS NULL OR …)` 写法。
- `TRUNC(SYSDATE) - (:days - 1)` 取的是**服务端库时区**的零点，与 `ReportTime` 的写入时区一致；前端不做时区换算。`(:days - 1)` 的减一不能省——否则 `N=30` 会变成 31 天。
- 走现有辅助索引 `(Environment, Item, ReportTime DESC)`，无需新建索引。

**③ 字段 ↔ 栏位映射**

| # | 出参字段 | 取自 `FvLogMonitorAlarmState` |
|---|---|---|
| 1 | `environment` | **`Environment`**（分组键 1） |
| 2 | `item` | **`Item`**（分组键 2） |
| 3 | `priority` | **`Priority`**（行内快照；组内理论上同一值，SQL 取 `MAX` 仅作兜底） |
| 4 | `remainingCnt` | `ResolvedTime IS NULL` 的行数 |
| 5 | `totalCnt` | 窗口内 **`COUNT(*)`** |
| 6 | `totalResolvedCnt` | `ResolvedTime IS NOT NULL` 的行数 |
| 7 | `dailyCnt` | **`ReportTime >= TRUNC(SYSDATE)`**（今日）的行数 |
| 8 | `dailyResolvedCnt` | 今日 **且** `ResolvedTime IS NOT NULL` 的行数 |
| 9 | `lastAlarmTime` | **`MAX(LastAlarmTime)`**（最近一次发通知时间） |

**不出参的栏位**：`ID`、`LineId`、`RuleName`、`IssueTime`、`ResolvedUser`、`ResolvedComment`、`Alarmed` 与审计列均不参与汇总；`LineId` / `RuleName` / `IssueTime` 只在明细（§4.2）用。

**④ 取数要点**

1. **一张表就能成行**：汇总 9 字段全在 `FvLogMonitorAlarmState`，**不依赖 OS**，OS 不可用时汇总照常返回。
2. **`Priority` 是历史快照**：规则改过等级后旧行仍是旧值，`MAX` 只是同一个 `Environment + Item` 下出现分歧时不报错；**不 join 规则表取「当前等级」**。
3. **`remainingCnt` 也在窗口内**：与其它计数字段同一个 `WHERE`，窗口外未解决的不算（口径统一，不做特例）。
4. **`LastAlarmTime` 为空**（从未发通知）⇒ 出参 `null`，前端显示空，**不当 0**。
5. **空结果** ⇒ `data` 返回 **`[]`**，不返 `null`、不报错；无数据时页面只显示表头。
6. 排序固定 **`Environment`、`Item` 升序**，保证每次 Refresh 行序稳定。

### 4.2 明细信息分页（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/detail_info/page`** |
| 方法 | **`GET`** |
| 入参 | **参数拼接在 URL 中传递**（query 参数），**不定义 `Ro` 对象**；参数＝**分页**（见 §4.0）+ **`environment`** + **`item`** + **`resolved`**（**布尔类型**，对应未解决开关状态）；**`environment` / `item` 必填非空**，见 ⓪ |
| 出参 | **分页对象 `Pageable`**（行元素 14 字段见 §2.3 / §4.4） |
| 排序 | 按 **`ReportTime` 倒序**，**`ID` 作稳定第二键**（`ORDER BY ReportTime DESC, ID DESC`，理由见本节 ①） |
| 调用时机 | 点汇总表格「查看」时；未解决开关切换时重新查询 |
| 过滤 | 开关**开**＝仅未解决（`resolved = true` ⇒ `ResolvedTime IS NULL`）；开关**关**＝全部（含已解决与未解决） |
| 权限 | 随**功能级权限**管控，无权限接口不可调 |

**后端取数（已定）**

**⓪ 入参校验与默认值**

| 参数 | 必填 | 校验 / 默认 | 不合法 |
|---|---|---|---|
| `environment` | **是** | ≤30；**不能为空**（空串 / 纯空白同为空） | `EnvironmentRequired` |
| `item` | **是** | ≤30；**不能为空** | `ItemRequired` |
| `pageIndex` | 否 | 整数 ≥ 1，缺省 **1** | `< 1` 按 1 处理 |
| `pageSize` | 否 | 整数 **1~200**，缺省 **20** | 越界 ⇒ `PageSizeOutOfRange` |
| `resolved` | 否 | 布尔；`true` = 只查未解决；缺省 / `false` = 全部 | 非布尔值由框架层拒 |

> **本接口不收 `previousDays`**：明细是该 `item + environment` 下的**全量 issue**，不受汇总统计窗口约束（§5-60）。
> `environment` / `item` 必须非空—— 两者是汇总表的行定位键，界面永远从「查看」带过来；空入参等于把全库 issue 当一页返回，直接拒。

**① 排序与分页方案（只在 Oracle 侧做）**

1. **分页只在 Oracle**：`COUNT` + `ORDER BY … OFFSET/FETCH` 一次完成，OS **不参与排序、不参与分页**，只按当页 `issueId` 补字段。因此排序键只能取 Oracle 栏位。
2. **第一键 `ReportTime DESC`** —— 与 §2.3 「按 `reportTime` 倒序」一致。
3. **必须带第二键 `ID DESC`**：`ReportTime` 是 `TIMESTAMP(3)` 且同一轮扫出的多条 issue 极易同毫秒，单键排序在**分页**下会出现同一行在两页都出现、或整行被跳过；`ID` 唯一且单调，作稳定 tie-break。
4. **不用 `IssueTime` 排**：它是日志时间，不同块 / 不同机器会穿插，跟「最近报的在上」不一致。
5. **走现成索引** `(Environment, Item, ReportTime DESC)`：前两列等值定位到组内，第二键排序只在组内小集合上做。
6. **偏移分页的漂移接受**：翻页期间有新 issue 入库时，后页会错位（重复 / 漏行）。属偏移分页固有行为，**不引入游标**；要看最新数据由列表刷新按钮重查第一页。

**② SQL**（先 `COUNT` 再取当页；`:onlyUnresolved = true` 时才拼 `ResolvedTime IS NULL`）

```sql
-- A 总数（Pageable 的 total）
SELECT COUNT(*)
  FROM FvLogMonitorAlarmState
 WHERE Environment = :env
   AND Item        = :item
   AND ResolvedTime IS NULL;      /* 仅 :onlyUnresolved = true */

-- B 当页数据（Oracle 12c+；未解决开关关掉时去掉 ResolvedTime 那一行）
SELECT ID,
       LineId,
       Item,
       Environment,
       RuleName,
       IssueTime,
       ReportTime,
       ResolvedTime,
       ResolvedUser,
       Alarmed,
       LineId || '|' || Item AS ISSUE_ID
  FROM FvLogMonitorAlarmState
 WHERE Environment = :env
   AND Item        = :item
   AND ResolvedTime IS NULL
 ORDER BY ReportTime DESC, ID DESC
 OFFSET (:pageIndex - 1) * :pageSize ROWS FETCH NEXT :pageSize ROWS ONLY;
```

- `ISSUE_ID` 与结果索引的 `_id` **完全同值**（`LineId|Item`），后面 OS 那三跳全靠它锚定。
- 排序键与过滤键都在本表，**不 join、不回 OS**；`total` 来自 Oracle，与 OS 能否补齐无关。

**③ OS 补五字段（三跳，按物理索引分批）**

Oracle 先出行，OS 只负责把 `issueMessage` / `blockId` → `LOTID`·`TID`·`HOSTIP`·`START_LINE_ID` → `LOG_BODY` 串起来：

| 跳 | 索引（去 prefix 基名） | 入参 | 取什么 |
|---|---|---|---|
| ① 结果 | **`mes-log-monitor-issue-{yyyy.MM}`** | 当页 `issueId` 集合 | `issueMessage`、`blockId` |
| ② 块 | **`mes-log-exec-{yyyy.MM.dd}`** | ①的 `blockId` 去重 | `LOTID`、`TID`、`HOSTIP`、`START_LINE_ID` |
| ③ 行 | **`mes-log-line-{yyyy.MM}`** | ②的 `START_LINE_ID` 去重 | `LOG_BODY` → `ruleMessage` |

- **三跳都用 `ids` 查询按 `_id` 精确取**：不搜关键字、不排序、不算分。
- **索引名算出来、不扫读别名**：① 月取 `IssueTime` 的月份；② 按 `_id` **末段 17 位毫秒串**（`yyyyMMddHHmmssSSS`）的日期（块按日索引）、③ 取同段毫秒串的月份（行按月索引）。一个当页可能跨几个月，**按索引名分组、一组一次请求**。
  > 这条硬口径来自 `04` §4.2：不要拿 `mes-log-line-read` 扫全部月索引（360 天分片全开）。
- **索引名不带环境段**，实际由框架 `prefix` 前置；`PRD` / `PIRUN` 写同一套索引（`09` §五）。

**第 1 跳 · 结果索引**（一页多条同月，一次请求）

```json
GET /mes-log-monitor-issue-2026.08/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["issueMessage", "blockId"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20260811171949380|EAPReqJobInEx",
        "PROD_10.20.30.40_9b1e77c05a2d4f31_8012000_20260811172115072|PRE"
      ]
    }
  }
}
```

**第 2 跳 · 块索引**（块 `_id` 末段也是 17 位毫秒，同样能定日）

```json
GET /mes-log-exec-2026.08.11/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["LOTID", "TID", "HOSTIP", "START_LINE_ID"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_FABsrv.63_PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20260811171949380",
        "PROD_10.20.30.40_FABsrv.63_PROD_10.20.30.40_9b1e77c05a2d4f31_8012000_20260811172115072"
      ]
    }
  }
}
```

**第 3 跳 · 行索引**（只取块首行那一篇的原文）

```json
GET /mes-log-line-2026.08/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["LOG_BODY"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20260811171949380",
        "PROD_10.20.30.40_9b1e77c05a2d4f31_8012000_20260811172115072"
      ]
    }
  }
}
```

- 三段都**不带 `sort`**（按 `_id` 取没有顺序意义）；回填时**按 `_id` 建 map**，OS 返回顺序不保证。
- 结果索引**不需要加 `issueType = Keyword` 过滤**：本功能的 `_id` 恒为 `LineId|Item`，Server hang 写的是 `LineId|issueType`，两批 `_id` 不会撞。

**④ 字段来源总表（14 字段）**

| # | 出参字段 | 来源 | 说明 |
|---|---|---|---|
| 1 | `environment` | Oracle `Environment` | 定位键 |
| 2 | `item` | Oracle `Item` | 定位键 |
| 3 | `lotId` | OS 块 `LOTID` | keyword **可多值**，**取数组首个** |
| 4 | `ruleName` | Oracle `RuleName` | 扫描时快照、单值，**不取块的 `RULENAME`**（它是多值） |
| 5 | `hostIpAddress` | OS 块 `HOSTIP` | 单值 |
| 6 | `ruleMessage` | OS 行 `LOG_BODY`（经块 `START_LINE_ID`） | 块首行原文，含请求参数（§2.5 用它解析） |
| 7 | `issueMessage` | OS 结果 `issueMessage` | 命中行原文 |
| 8 | `tId` | OS 块 `TID` | keyword **可多值**，**取数组首个** |
| 9 | `issueTime` | Oracle `IssueTime` | 同时是选结果月索引的依据 |
| 10 | `reportTime` | Oracle `ReportTime` | 排序键 |
| 11 | `resolvedTime` | Oracle `ResolvedTime` | 前端据此派生 `resolved`（§2.4） |
| 12 | `resolvedUser` | Oracle `ResolvedUser` | 处置人 |
| 13 | `alarmed` | Oracle `Alarmed` | `Y` → `true`、`N` → `false` |
| 14 | `issueId` | Oracle `LineId`（用竖线拼 `Item`） | 与结果索引 `_id` 同值；行主键与解决提交标识 |

> Oracle 出 **9 个**（1、2、4、9~14），OS 出 **5 个**（3、5、6、7、8）。`ID` / `ResolvedComment` / 审计列**不出参**。

**⑤ 取数要点**

1. **OS 是补齐、不是过滤**：一页里某些 `issueId` 在结果索引/块索引查不到 ⇒ 对应字段留**空串**，**不丢行、不改 `total`**、不报错，只记一条 WARN。
2. **OS 请求失败要报错**（连接 / 超时 / 5xx）：抛 `LogMonitorSourceUnavailable`，**不返回半页空字段** —— 明细页几乎每行都有 OS 字段，静默降级等于让人对着一片空判断（本接口口径：OS 失败显式报错，**不静默降级**）。
3. **行索引 360 天过期的降级**：`ruleMessage` 取不到 ⇒ 留空，其余 13 个字段照常（设计接受的降级，保留期见 `04` §4.4）。
4. **多值字段取首个**：`LOTID` / `TID` 是 keyword 数组（`09` §四：按出现顺序追加、同值去重），出参是 `string`，统一取**下标 0**，取不到给空串。
5. **批量粒度**：每跳一次带整页 ID（≤ 200），**不逐行发请求**；按索引名分组后，跨几天就几组，正常情况下 200 条落在 1~2 天内（3 组以内）。
6. **`resolved` 只管过滤、不改出参**：出参仍 14 字段、不含 `resolved`；行状态由前端从 `resolvedTime` 派生（§2.4 / §4.4）。

### 4.3 解决提交（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/resolve`** |
| 方法 | **`POST`** |
| 入参对象 | **`ResolveLogMonitorAlarmRo`** |
| 入参 1 | **`issueIds`**：字符串数组，**不可为空**；**维持数组形态**，可放 1 个也可放多个 `issueId`；批量提交时**不含已解决行** |
| 入参 2 | **`resolvedComment`**：字符串，**不可为空**（对话框输入） |
| 出参 | **`LogMonitorAlarmDetailDto` 对象集合**，按**实际更新成功的对象**返回（数量 ≤ 入参 `issueIds` 数量：已被解决的 `issueId` 不返回）；前端按 **`issueId`** 覆盖对应行 |
| 调用时机 | 对话框点「确认」提交时；`Resolved` 开关（单条）或 **Resolve** 按钮（批量） |
| 权限 | 受**「解决」权限点**管控，与 `Resolved` 开关 / **Resolve** 按钮共用同一权限点，无权限接口不可调 |

**后端取数（已定）**

**⓪ 入参校验与解析**

| 项 | 校验 | 不合法 |
|---|---|---|
| `issueIds` | **非空数组**（至少 1 个），元素非空 | `IssueIdsRequired` |
| `issueIds[i]` | 必须能按**首个竖线**拆成 `LineId` + `Item`，两段均非空 | `IssueIdInvalid` |
| `resolvedComment` | **trim 后非空**，长度 **≤512**（表栏位 `VARCHAR2(512)`） | 空 ⇒ `ResolvedCommentRequired`；超长 ⇒ `ResolvedCommentTooLong` |

- **解析规则**：`issueId` 与结果索引 `_id` 同值，形如 `LineId|Item`（`LineId` 内部是 `_` 分隔的 5 段、不含竖线）。按**首个竖线**拆：前段 `LineId`、后段 `Item`（`Item` 即使含竖线也整段归后段），拆出的 `(LineId, Item)` 对就是查库条件。
- **表的「已解决」没有单独的 `Resolved` 布尔栏位**：由 `ResolvedTime` 是否为空表示，配 `ResolvedUser` / `ResolvedComment` 记录处置。所以「更新 resolved」＝写这**三列**（§1.1）。

**① 读取与更新（同一事务）**

1. **加锁读**：按 `(LineId, Item)` 对**一次**查出 `ResolvedTime IS NULL` 的全部行，`FOR UPDATE` 锁住。
2. **集合为空 ⇒ 报错 `LogMonitorIssueNotFound`**（errMsg：勾选的 issue 不存在或已被解决），事务回滚、不写库。
3. **只改三列**：`ResolvedTime = :now`（服务墙钟取一次、整批同值）、`ResolvedUser = :user`（当前登录用户）、`ResolvedComment = :comment`；审计列由框架统一补，不手写。
4. 更新后的对象（`ID` + 新值）就是出参的 Oracle 半部分，不再回查一次。

```sql
-- A 加锁读（一次，不逐条；只捞未解决的）
SELECT ID, LineId, Item, Environment, Priority, RuleName,
       IssueTime, ReportTime, ResolvedTime, ResolvedUser, Alarmed
  FROM FvLogMonitorAlarmState
 WHERE (LineId, Item) IN ((:lineId1, :item1), (:lineId2, :item2))
   AND ResolvedTime IS NULL
   FOR UPDATE;

-- B 批量更新（只按 A 捞到的 ID）
UPDATE FvLogMonitorAlarmState
   SET ResolvedTime    = :now,
       ResolvedUser    = :user,
       ResolvedComment = :comment
 WHERE ID IN (:ids)
   AND ResolvedTime IS NULL;   -- 双保险：行本已被本事务锁住，正常必然成立
```

- 行值 `IN` 列表按实际数组长度拼（1 个就一组）；批量提交一行 SQL、**不循环单条 update**。
- 若拆分后出现**重复的 `(LineId, Item)`**（前端重复传），入库前先去重，避免 `IN` 列表撑大。

**② 出参组装**

- **Oracle 9 字段**取自更新后的对象（`resolvedTime` = `:now`、`resolvedUser` = `:user`、`resolvedComment` 写入库但**不出参**）。
- **OS 5 字段**（`lotId` / `hostIpAddress` / `ruleMessage` / `issueMessage` / `tId`）**复用 §4.2 ③ 的同一套三跳查询**，不另写一套；索引选择与分组规则完全一致。
- `issueId` 用 `LineId` + 竖线 + `Item` 拼回，供前端匹配行。

**③ 出参数量：按实际更新对象返回**

- 只返回**真正被更新**的对象，数量 ≤ 入参数量；已被解决的 `issueId` **不进集合、不返回**（原先「入 1 出 1」不再成立）。
- 前端按返回的 `issueId` 逐个覆盖，**没返回的行保持原样**。
- **全员已被解决（集合空）⇒ 报错**，不返回空数组—— 否则用户点了确认什么也没发生，以为没生效。

**④ 先提交、后补 OS（与读接口不同）**

- 顺序：**事务提交之后再走 OS 三跳**。理由：处置动作不能被 OS 拖死 —— 更新已生效还报错，用户重试会撞「已被解决」，反而更差。
- OS 补齐失败（连接 / 超时 / 5xx）⇒ **不报错**、记 WARN、**OS 5 字段回传空串**。
- 对应前端覆盖规则：**非空字段覆盖、空串保留原值**（§2.4）—— 否则会把列表里已有的 `lotId` / `ruleMessage` 冲成空。

**⑤ 幂等与并发**

1. **重复提交同一 `issueId`**：第二次读不到（已解决）⇒ `LogMonitorIssueNotFound`，**不会覆盖**原处置人与时间。
2. **两人并发**：`FOR UPDATE` 让后到者等锁，拿到锁后 `ResolvedTime IS NULL` 不再成立 ⇒ 空集合报错，**先到者赢**。
3. **一个 `issueId` 只对应一行**（UK `LineId + Item`），按 `ID` 批量更新不会误伤其它行。

### 4.4 出入参对象（已定）

| 对象 | 用于 | 字段 |
|---|---|---|
| `LogMonitorSummaryInfoDto`（出参） | §4.1 汇总首屏 | **对象集合**；每个对象 **9 字段**见 §2.1、**字段类型见下表**；5 个计数字段按 issue 数量统计，见 §2.2 |
| `LogMonitorAlarmDetailDto`（出参） | §4.2 明细分页的行元素 / §4.3 解决提交的返回 | **14 字段**见 §2.3、**字段类型见下表**；`issueId` 为每行唯一 ID、`resolvedTime` 派生 `Resolved` 开关；`environment` / `item` 显示在详情表上方、不成列 |
| `ResolveLogMonitorAlarmRo`（入参） | §4.3 解决提交 | 2 字段，见下表 |
| `LogMonitorLogDownloadRo`（入参） | §4.5 Alarm Log 下载 | **1 字段**，见下表 |

**`LogMonitorSummaryInfoDto`**

| 字段 | 类型 |
|---|---|
| `environment` | `string` |
| `item` | `string` |
| `priority` | `string` |
| `remainingCnt` | `int` |
| `totalCnt` | `int` |
| `totalResolvedCnt` | `int` |
| `dailyCnt` | `int` |
| `dailyResolvedCnt` | `int` |
| `lastAlarmTime` | 时间类型 |

> 5 个以 `Cnt` 结尾的字段统一为 `int`，按 issue 数量统计（§2.2）。

**`LogMonitorAlarmDetailDto`**

| 字段 | 类型 |
|---|---|
| `environment` | `string` |
| `item` | `string` |
| `lotId` | `string` |
| `ruleName` | `string` |
| `hostIpAddress` | `string` |
| `ruleMessage` | `string` |
| `issueMessage` | `string` |
| `tId` | `string` |
| `issueTime` | 时间类型 |
| `reportTime` | 时间类型 |
| `resolvedTime` | 时间类型 |
| `resolvedUser` | `string` |
| `alarmed` | `boolean` |
| `issueId` | `string` |

> 输出字段仍为 **14 个**，**不含 `resolved`**：行状态布尔 `resolved` 由前端按 `resolvedTime` 是否为空计算（§2.4），**不在接口出入参中**；§4.2 的同名入参 `resolved` 是「未解决开关」的过滤条件，二者不是同一个东西。`resolvedTime` 为时间类型，与 §2.5 的 Resolved Time 时间组件一致。

**`ResolveLogMonitorAlarmRo`**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `issueIds` | `List<string>` | 是 | **维持数组形态**，可放 1 个也可放多个 `issueId`；批量提交**不含已解决行** |
| `resolvedComment` | `string` | 是 | 对话框输入，**不可为空** |

> `resolve` 出参按**实际更新成功的对象**返回 `LogMonitorAlarmDetailDto`（数量 ≤ 入参 `issueIds`），前端按 `issueId` 覆盖对应行（§2.4 / §4.3）。
**`LogMonitorLogDownloadRo`**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `issueIds` | `List<string>` | 是 | 取自 detail 列表**当前多选选中行**的 `issueId`；**对象只含此一个字段** |

### 4.5 Alarm Log 下载（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/log/download`**（服务内前缀 `/api/v1/log_monitor` + 后缀 `/log/download`） |
| 方法 | **`POST`** |
| 入参对象 | **`LogMonitorLogDownloadRo`** |
| 入参 | **仅 `issueIds`**：字符串数组，取自 detail 列表**当前多选选中行**的 `issueId` |
| 出参 | **成功：以 `.zip` 文件流返回**（每个块一份原始日志），**不走响应外壳**；包名 **`meslog_{yyyyMMddHHmmss}.zip`**，包内顶层目录 **`meslog_{yyyyMMddHHmmss}/`**，目录下每块一份 **`{blockId}.log`** |
| 下载上限 | **单次最多 10 个块**（按 **`blockId` 去重后**计数，不是 `issueIds` 个数）；超限由接口报错 |
| 错误 | 接口发生错误时**仍以框架标准接口返回错误信息**（全局响应外壳 `code` / `success` / `errMsg` / `data` / `txId`），**不自定错误包结构、不自定错误码格式** |
| 调用时机 | 点 **Alarm Log** 按钮时；启用条件＝detail 列表中存在选中行（§2.3） |
| 权限 | 随**功能级**管控，不属「解决」权限点 |

**后端处理（已定）**

**⓪ 入参校验**

| 项 | 校验 | 不合法 |
|---|---|---|
| `issueIds` | **非空数组**（至少 1 个），元素非空 | `IssueIdsRequired`（与 §4.3 同一个码） |
| `issueIds[i]` | 必须能按**首个竖线**拆成 `LineId` + `Item`，两段非空 | `IssueIdInvalid`（与 §4.3 同一个码） |
| 命名时间戳 | **服务端取当前时刻 `yyyyMMddHHmmss`**（如 `20261118125234`），**只用于文件夹与 zip 命名**；**不取 `txId`、不要求前端传任何名字** | 进处理时取一次 |

> 格式校验的作用与 §4.3 不同：本接口**不用 `LineId` / `Item` 查库**，校验只为保证拿去 OS 的串就是结果索引的 `_id`（`LineId|Item`），脏串会静默查空、表现成「issue 不存在」。

**① `issueId` → `blockId`（OS 结果索引，1 组）**

- **索引月份从 `issueId` 自己算**：`issueId` 竖线前的 `LineId` 末段是 17 位毫秒串（`yyyyMMddHHmmssSSS`），取前 6 位得 `yyyy.MM`。这里**没有 Oracle 行可用**（不像 §4.2 能取 `IssueTime`），只能走这条；跨月就按月分 2 组。
- 回填**按 `_id` 建 map**（结果索引 `_id` 即 `issueId`），OS 返回顺序不保证。

```json
GET /mes-log-monitor-issue-2026.08/_search
{
  "size": 200,
  "track_total_hits": false,
  "_source": ["blockId"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20260811171949380|EAPReqJobInEx",
        "PROD_10.20.30.40_9b1e77c05a2d4f31_8012000_20260811172115072|PRE"
      ]
    }
  }
}
```

**② 块数上限与缺失判定**

1. **`blockId` 去重**再计数 —— 多选 20 条 issue 全落在同一个块，只算 **1 个块**，允许下载。
2. **单个 `issueId` 取不到 `blockId`**（结果索引已被 ISM 清掉）⇒ **只记一条 WARN 日志、跳过该 `issueId`**，**不阻断整批**，其余块照常打包；成功响应里不掺这段信息（错误包只用于失败场景）。
3. **一个 `blockId` 都取不到** ⇒ `LogMonitorIssueNotFound`（没有可下载的块，**不返回空包**）。
4. **去重后 > 10 ⇒ 报错 `LogMonitorDownloadBlockLimitExceeded`**，errMsg 带实际块数（如「单次最多下载 10 个块，本次 13 个」），**不做截断降级**（截断会让用户以为下全了）。

**③ 读块信息（OS 块索引，按日索引分组）**

- 块 `_id` 末段同样是 17 位毫秒，**按它定日索引**；10 个块可能跨几天，**按索引名分组、一组一次请求**。
- 只取**捞行必需的 8 个字段**（块文档字段口径见 `09` §四：**四个 `term` 条件** + **两个区间端点** `START_TIME` / `END_TIME` + **两个截断锚** `START_LINE_ID` / `END_LINE_ID`；这四个 `term` 怎么用在 `04` §4.2）。
- **任一块取不到即算失败**（块索引过期 / 块被清）⇒ `LogMonitorIssueNotFound`，**整批不下载** —— 与「`issueId` 取不到 `blockId` 只记 WARN 跳过」口径相反：**块信息取不到不能跳过**（跳了就成了缺块包，用户拿着不全的日志去排查）。

```json
GET /mes-log-exec-2026.08.11/_search
{
  "size": 20,
  "track_total_hits": false,
  "_source": ["ENV", "HOSTIP", "SERVER_ID", "system.name",
              "START_TIME", "END_TIME", "START_LINE_ID", "END_LINE_ID"],
  "query": {
    "ids": {
      "values": [
        "PROD_10.20.30.40_FABsrv.63_PROD_10.20.30.40_3f2a9c1d0b7e4f68_8012000_20260811171949380",
        "PROD_10.20.30.40_FABsrv.63_PROD_10.20.30.40_9b1e77c05a2d4f31_8012000_20260811172115072"
      ]
    }
  }
}
```

**④ 按块捞整块行（`FetchMESRuleFullLogs()`）**

- 每个块调 `shared-business-lib` 库的 **`FetchMESRuleFullLogs()`**：**输入＝块信息对象**（③ 取回的块，含四个 `term` 条件 + `START_TIME` / `END_TIME` + `START_LINE_ID` / `END_LINE_ID`）、**输出＝该块全部行日志对象集合**（已还原块内写入顺序）。粗筛 / 重排 / 截断都在方法内部（口径 `04` §4.2 六条件 + `LOG_TIME` 闭区间上界、`04` §4.3 三级重排、`[START_LINE_ID, END_LINE_ID]` 截断），**本接口不自拼 DSL、不自己重排**。
- 拿回来的行序**就是写入顺序**，直接照序写文件，不再排序。
- **块与块串行**：一个块写完再下一个，10 个块也不并发拉行（避免同时开 10 条重查询把 OS 打满）。

**⑤ 组织文件与内容（IO 交工具方法）**

**业务侧只负责组织文件和文件内容** —— 目录名、文件名、每行内容、zip 包名；**文件夹组织 / 写入 / 删除 / 下载输出等一律调 `common-lib` 库的工具方法**（方法提供文件夹组织、写入、删除、下载输出等能力）：

> 工具方法内部的落盘顺序、重名处理、清理实现**不在本篇展开**；本篇只规定业务侧组织什么、何时清理。

| 项 | 规则 |
|---|---|
| 文件夹 | **`meslog_` + 当前时刻 `yyyyMMddHHmmss`**，如 `meslog_20261118125234`；zip 顶层只有这一个目录 |
| 文件名 | **`{blockId}.log`**，即块 `_id` 原文（`PROD_10.20.30.40_FABsrv.63_PROD_..._20260811171949380.log`）；块 `_id` 唯一，不会重名 |
| 文件内容 | 该块行按写入顺序逐行写 **`LOG_RAW`**（行原文，含行首前缀，`04` §3.3 / §4.5），**一行一条、行尾 `\n`**，UTF-8 无 BOM |
| 不加料 | **不写表头、不写分隔线、不写块元信息注释** —— 下载件是原始日志，加了东西就没法直接比对了 |
| zip | **`meslog_{yyyyMMddHHmmss}.zip`**，含 `meslog_20261118125234/` 与其中 N 个 `.log` |
| 时间戳取值 | **整个请求只取一次**（进 ⑤ 时取），目录名与 zip 名共用同一个值，不会出现两者不一致 |
| 重名 | 目录 / 文件的创建、重名、并发冲突由 **`common-lib` 工具方法**处理，业务侧**不判重、不加随机后缀、不检查存在性** |
| 内存 / 写入方式 | 由 **`common-lib` 工具方法**负责（流式写入等），**不在本篇展开**；业务侧只把每块内容组织好交给工具方法 |

**⑥ 输出与清理（交工具方法）**

1. **写入 / 打包 / 输出 / 删除一律调 `common-lib` 的工具方法**；业务侧不自己写文件 IO。
2. 业务口径：**要么给出完整 zip、要么给出错误包**，不给半个 zip。
3. **下载完成（输出流关闭）与接口失败两条路径都清理**：调 `common-lib` 的工具方法删掉本次 `meslog_{yyyyMMddHHmmss}` 整个目录（含 `.log` 与 `.zip`），不留残留。
4. 工具方法抛错 ⇒ **拿方法的 error 输出**，走接口报错格式；清理异常不改写已发出的响应。

**⑦ 错误码清单（全部复用框架与本节已定义的码，不新造格式）**

| 场景 | 码 |
|---|---|
| `issueIds` 空 / 元素空 | `IssueIdsRequired` |
| `issueId` 拆不出两段 | `IssueIdInvalid` |
| 去重后块数 > 10 | `LogMonitorDownloadBlockLimitExceeded` |
| `blockId` 全取不到、块取不到 | `LogMonitorIssueNotFound` |
| OS 连接 / 超时 / 5xx | `LogMonitorSourceUnavailable`（同 §4.2） |
| 文件写入 / 输出 / 删除异常 | **取工具方法的 error 输出** |

**⑧ 响应头**

| 头 | 值 |
|---|---|
| `Content-Type` | `application/zip` |
| `Content-Disposition` | `attachment; filename="meslog_{yyyyMMddHHmmss}.zip"` |
| `Content-Length` | zip 文件实际大小（包已生成好，长度确定） |

> 成功响应**不走外壳**（§4.0），失败响应**必须走外壳**。

> 示例只用真实业务接口 / 服务名，不用占位符。

## 5. 已确认口径

| # | 口径 |
|---|---|
| 1 | 本篇归**模块 2**，编号 **05**（顺延 `01`~`04`） |
| 2 | 作用＝**展示经 MES 关键字监控产生的报警日志 + 在界面上解决**；不负责判定与通知 |
| 3 | 所属 Module = **`monitor-alarm`**；一级菜单 `Monitor & Alarm` / 中文 `监控通知`；功能名 `MES关键字告警展示`，菜单位于二级菜单 `MES Log Keyword Monitor` 下的 `View & Resolve` |
| 4 | **采用权限管控方案**：**功能级**（菜单渲染与接口鉴权同一份权限数据，口径同 `01` §3.1）+ **「解决」权限点**；粒度见 §2 |
| 5 | Body **自上而下**：上方卡片 = 汇总信息表格、**无关键字搜索框**，顶部工具栏＝**Environment 下拉 + Previous Days 输入 + Refresh 按钮**；进入界面调 `/api/v1/log_monitor/summary_info/list`，出参 `LogMonitorSummaryInfoDto` **对象集合**（每个对象 9 字段 / 9 列见 §2.1） |
| 6 | 汇总表格**单选模式**、操作列含「查看」（**「查看」为唯一触发，行选中不起作用**） |
| 7 | `lastAlarmTime` = **发出通知的时间**（非 Alarm 生成时间） |
| 8 | `dailyCnt` = **当日 issue 的数量**；中文列名 **今日问题数量** |
| 9 | **汇总数据在进入界面调 `list` 取一次，之后仅由 Refresh 触发重查**；不建实时通道、不做定时刷新 |
| 10 | 下方卡片 = **点「查看」后的 detail**（行选中不参与）；点操作列「查看」触发，取该行 `item + environment` 下的全部 issue list |
| 11 | 明细接口 = **`/api/v1/log_monitor/detail_info/page`**，**分页**取数，结果按 **`reportTime` 倒序** |
| 12 | 明细 **14 个输出字段 → 9 个显示列**（§2.3）；`environment` / `item` 显示在详情表格上方，`ruleMessage` / `resolvedTime` / `resolvedUser` 由 **More Info 弹框**展示，`issueId` 不展示 |
| 13 | 明细表格**多选**；操作列为**菜单**，含 **More Info**；列表有**刷新**按钮、**无新增记录入口**；另设 **Alarm Log** 下载按钮 |
| 14 | **只过滤未解决的开关**：开＝只查未解决，关＝查全部（含已解决与未解决），均调 `/api/v1/log_monitor/detail_info/page` |
| 15 | 明细输出字段含 **`issueId`** = 每条 issue 的**唯一 ID**，不单独成列，作行主键与解决提交标识 |
| 16 | `Resolved` 列为**可点击开关**，由 **`resolvedTime` 派生**：为空＝关闭、不为空＝打开；**打开时禁用**（不可改回），关闭时取消禁用 |
| 17 | 点击关闭态开关 → 弹出**输入 `Resolved Comment` 的对话框**（**不可为空**）→ 点「确认」提交 |
| 18 | 解决提交 = **`POST /api/v1/log_monitor/resolve`**，入参对象 **`ResolveLogMonitorAlarmRo`**：`issueIds`（字符串数组，不可为空）+ `resolvedComment`（字符串，不可为空）；**单条＝数组 1 个元素，批量＝多个元素**，同走一个接口 |
| 19 | 提交成功后，用**返回结果覆盖掉原有行**的内容 |
| 20 | 列表下方 **Resolve** 按钮：多选选中行中**只要有一个 `resolved = false` 即可用**，否则禁用；点击同样弹 comment 对话框提交，`issueId` 为**多个值（字符串数组）** |
| 21 | `issueIds` **维持数组形态**：1 个或多个元素同走一个接口；批量提交**只放未解决行的 `issueId`，不含已解决行** |
| 22 | `resolve` 出参 = **`LogMonitorAlarmDetailDto` 对象集合**，按**实际更新成功的对象**返回（数量 ≤ 入参 `issueIds`，**已被解决的不返回**）；覆盖时按 **`issueId`** 回显对应行（§4.3 ③） |
| 23 | **提交后的行保留**：未解决开关**打开**时，返回的已解决行**不隐藏、仍保留显示**；仅用户主动「刷新 / 关闭开关 / 重新点汇总『查看』」才按当前过滤条件重新查询 |
| 24 | 明细接口入参 = **拼接在 URL 中的 query 参数、不定义 `Ro` 对象**：**分页** + **`environment`** + **`item`** + **`resolved`**（**布尔类型**，对应未解决开关状态） |
| 25 | 权限管控到**功能级** + **「解决」权限点**（本页只占这一点，配置页的新增 / 编辑 / 删除三点不作用于本页）；`Resolved` 开关与 **Resolve** 按钮**是同一个权限点**，「查看」随功能级、不单独控权 |
| 26 | 界面 **4 条端点**：`list` / `detail_info/page` 为 **`GET`**；`resolve` / `log/download` 为 **`POST`** |
| 27 | 9 列里的 **5 个计数字段**（`remainingCnt` / `totalCnt` / `totalResolvedCnt` / `dailyCnt` / `dailyResolvedCnt`）**统一按 issue 数量统计**，单位不混用 |
| 28 | `dailyCnt` 中文列名 = **今日问题数量**（Daily Count） |
| 29 | More Info 弹框展示 **3 个字段**：Rule Message / Resolved Time / Resolved User；**`issueId` 不展示** |
| 30 | Resolved Time 用**时间组件**、Resolved User 用**输入框组件**；**Time 在前、User 在后**，两者**均禁用** |
| 31 | Rule Message 完整原文用 **Label** 显示；请求参数由前端调 **API 组件中原有的 `mesRuleMessageParser` 方法**解析后**逐行显示**、带**展开 / 折叠按钮**，**滚动只发生在参数行区域** |
| 32 | More Info 弹框**只有一个「关闭」按钮**，无其它操作按钮（与 §2.4 的 comment 对话框不同） |
| 33 | **4 条端点均归属 `telemetry-hub`**（与 `01` §4 的 6 条配置接口同服务）；服务内前缀 `/api/v1/log_monitor` |
| 34 | `list` / `detail_info/page` / `resolve` **三条 REST 统一走全局响应外壳**（业务数据放 `data`）；明细**有分页**（§4.0） |
| 35 | **初始态 / 空态**：进入界面未点「查看」、当前查看行无 issue、未解决开关打开后全已解决 —— 明细表格**只显示一个表头**，无数据行，不隐藏卡片 |
| 36 | **点操作列「查看」是触发 detail 的唯一动作**；**行选中不起作用**，不触发加载、也不作为前置条件 |
| 37 | **切换查看行**：点另一行「查看」后 detail **自动回第 1 页、清空明细多选选中**，再按新行的 `item + environment` 查询 |
| 38 | 详情表格**上方显示当前查看行的 `item + environment`**；明细**不再显示 Item / Environment 两列**（14 个输出字段 → **9 个显示列**） |
| 39 | More Info 弹框**展示字段与 Rule Message 原文均取自当前行对象**，不另调接口 |
| 40 | 下方卡片增设 **Alarm Log** 按钮（与 Resolve 并列）：下载**当前多选选中行归属的原始日志**；**启用条件＝detail 列表中存在选中行即可**（不要求未解决、无选中行时禁用）；下载类按钮，不新增 / 不修改记录，权限随**功能级** |
| 41 | **Alarm Log 下载接口已定**（§4.5），已定接口为 §4.0 总表 **4 条** |
| 42 | **#1 `list` 出参＝`LogMonitorSummaryInfoDto` 对象集合**（每个对象 9 字段见 §2.1），**不是单条对象** |
| 43 | **#2 `detail_info/page` 入参＝拼接在 URL 中的 query 参数、不定义 `Ro` 对象**：分页 + `environment` + `item` + `resolved`（布尔） |
| 44 | **#4 端点＝`POST /api/v1/log_monitor/log/download`**（服务内前缀 `/api/v1/log_monitor` + 后缀 `/log/download`），归 `telemetry-hub`，权限随**功能级**、不属「解决」权限点 |
| 45 | **#4 入参对象＝`LogMonitorLogDownloadRo`，只含 `issueIds` 一个字段**（字符串数组），取自 detail 列表当前多选选中行的 `issueId`；不定义其它参数 |
| 46 | **#4 出参＝成功以文件流返回原始日志、不走响应外壳**；**接口发生错误时仍以框架标准接口返回错误信息**（全局响应外壳） |
| 47 | **#4 方法＝`POST`**；`LogMonitorSummaryInfoDto` 字段类型：`environment` / `item` / `priority` 为 `string`、5 个 `Cnt` 结尾字段为 `int`、`lastAlarmTime` 为时间类型（§4.4） |
| 48 | `LogMonitorAlarmDetailDto` 字段类型：`issueTime` / `reportTime` / `resolvedTime` 为时间类型、`alarmed` 为 `boolean`、其余 10 个字段为 `string`；**输出字段仍 14 个、不含 `resolved`**，`resolvedTime` 时间类型与 §2.5 时间组件一致（§4.4） |
| 49 | **行状态布尔 `resolved` 是前端由 `resolvedTime` 是否为空计算出的派生值**（为空 → `false`、不为空 → `true`），**不在任何接口出入参中**；界面过程判断（Resolve 按钮可用性、批量提交只取未解决行）一律用它，不必每处再判 `resolvedTime`。与 §4.2 同名入参 `resolved`（「只过滤未解决」开关的查询条件）不是同一个东西（§2.4 / §4.4） |
| 50 | 汇总卡片顶部工具栏**三个元素**：**Environment 下拉** + **Previous Days 输入框** + **Refresh 按钮**（§2.1） |
| 51 | Environment 候选来自 Misc `mes.global.environments`，前端调 **`GET /api/v1/sys_misc/env/list`**（归属 Misc 模块，本篇只消费、不复刻规格）；**可为空，空＝不限环境** |
| 52 | Previous Days **只接受 1~60 的正整数、可为空**，**空＝按默认 30 天**（不提供「不限 / 全部历史」口径），越界 / 非整数前端阻断、后端同样按 1~60 校验 |
| 53 | 进入界面默认 **Environment 空 / Previous Days 30**，首调 `list` 即 `environment` 空 + `previousDays=30` |
| 54 | `list` **通过 query 传 `environment` + `previousDays`**（不定义 `Ro`）；点 **Refresh** 按当前两值重查汇总，且不触发下方 detail 重查（§4.1 / §2.4） |
| 55 | `previousDays` 时间窗（按 **`ReportTime`**）：**终点＝今天 23:59:59、起点＝（今天 −（N−1）天）00:00:00**（含今天共 N 个自然日）；空按 30；实现用 `< 明天 00:00:00` 半开区间以免丢毫秒（§4.1 ①） |
| 56 | 5 个计数字段与 `lastAlarmTime` **全部在同一窗口内统计**，`remainingCnt` 不特例（窗口外的未解决不计）；`dailyCnt` / `dailyResolvedCnt` 另用固定今日边界（§4.1 ②） |
| 57 | **summary 只查 Oracle `FvLogMonitorAlarmState` 一张表**，不读 OS 索引、不 join 规则表，OS 不可用时汇总仍可用（§4.1） |
| 58 | 9 字段 ↔ 栏位：`environment`→`Environment`、`item`→`Item`、`priority`→`Priority`（快照，`MAX` 兜底）、`remainingCnt`/`totalCnt`/`totalResolvedCnt`→按 `ResolvedTime` 条件计数、`dailyCnt`/`dailyResolvedCnt`→加 `ReportTime >= TRUNC(SYSDATE)`、`lastAlarmTime`→`MAX(LastAlarmTime)`（§4.1 ③） |
| 59 | summary 结果**固定按 `Environment`、`Item` 升序**；空结果返回 `data: []`，`LastAlarmTime` 为空出 `null`（不按 0） |
| 60 | **明细入参不收 `previousDays`**：明细是该 `item + environment` 下的**全量 issue**，不受汇总统计窗口约束（§4.2 ⓪） |
| 61 | 明细入参校验：`environment` / `item` **必填非空**（≤30），空 ⇒ `EnvironmentRequired` / `ItemRequired`；`pageIndex` 默认 1；`pageSize` **1~200** 默认 20，越界 ⇒ `PageSizeOutOfRange`；`resolved = true` ⇒ `ResolvedTime IS NULL`（§4.2 ⓪） |
| 62 | 明细**排序＝`ORDER BY ReportTime DESC, ID DESC`**：`ID` 作稳定第二键，避免同毫秒多行在分页时重复 / 漏行；**分页与排序只在 Oracle**，OS 不参与排序、不参与分页（§4.2 ①） |
| 63 | 明细用**偏移分页**，翻页期间的漂移（新 issue 入库导致后页错位）**接受**，不引入游标；看最新数据由列表刷新回第 1 页（§4.2 ①） |
| 64 | 明细的 OS 补字段走**三跳 `ids` 查询**（结果 → 块 → 行），**按物理索引名分组请求**：结果与行按月（`IssueTime` / `_id` **末段 17 位毫秒串**的月份）、块按日取同段毫秒串的日期；**不扫读别名**（`04` §4.2）。索引名不带环境段、由框架 `prefix` 前置（§4.2 ③） |
| 65 | 明细 14 字段来源：**Oracle 出 9 个**（`environment` / `item` / `ruleName` / `issueTime` / `reportTime` / `resolvedTime` / `resolvedUser` / `alarmed` / `issueId`）+ **OS 出 5 个**（`lotId` / `hostIpAddress` / `ruleMessage` / `issueMessage` / `tId`）；`lotId` / `tId` 是 keyword 多值，**取数组首个**；`ruleName` 用 Oracle 快照、不取块的多值 `RULENAME`（§4.2 ④） |
| 66 | OS 为**补齐不是过滤**：查不到的字段留空串、**不丢行、不改 `total`**；**OS 请求失败报 `LogMonitorSourceUnavailable`**，不返回半页空字段；行索引 360 天过期只影响 `ruleMessage`（留空，其余照常）（§4.2 ⑤） |
| 67 | `resolve` 校验：`issueIds` **非空数组且每个元素可拆为 `LineId`+`Item`**（`IssueIdsRequired` / `IssueIdInvalid`）；`resolvedComment` **非空且 ≤512**（`ResolvedCommentRequired` / `ResolvedCommentTooLong`）（§4.3 ⓪） |
| 68 | `issueId` 按**首个竖线**拆：前段 `LineId`、后段 `Item`；表中**没有 `Resolved` 布尔栏位**，「已解决」由 `ResolvedTime` 是否为空表达，更新 resolved ＝**写 `ResolvedTime` + `ResolvedUser` + `ResolvedComment` 三列**（§4.3 ⓪ / ①） |
| 69 | `resolve` 在**同一事务**内：先按 `(LineId, Item)` 对**一次加锁读** `ResolvedTime IS NULL` 的全部行（`FOR UPDATE`），**集合为空 ⇒ `LogMonitorIssueNotFound` 并回滚**（不写库、不返回空数组）（§4.3 ①） |
| 70 | 更新只改三列：`ResolvedTime = :now`（整批同值）、`ResolvedUser = 当前登录用户`、`ResolvedComment = 入参`；审计列由框架补；按 `ID` 批量一条 `UPDATE`，不循环单条（§4.3 ①） |
| 71 | `resolve` 出参**按实际更新成功的对象返回**（数量 ≤ 入参），已解决的 `issueId` 不返回、行保持原样；前端**按字段合并覆盖：非空覆盖、空串保留原值**（§4.3 ③ / §2.4） |
| 72 | `resolve` **先提交事务、后补 OS**（复用 §4.2 三跳）；**OS 失败不报错**、记 WARN、OS 5 字段回传空串 —— 处置动作不被 OS 拖死（§4.3 ④） |
| 73 | 下载校验：`issueIds` **非空数组、元素非空** + 每个 `issueId` 可拆 `LineId` / `Item`，复用 **`IssueIdsRequired`** / **`IssueIdInvalid`**；拆出的两段**不用于查库**，只为保证拿去 OS 的串就是结果索引的 `_id`（§4.5 ⓪） |
| 74 | 下载用 **`issueId` 直接去结果索引取 `blockId`**（1 组请求）；**索引月份由 `issueId` 里 `LineId` 末段 17 位毫秒的前 6 位算** —— 这条路径没有 Oracle 行可取 `IssueTime`（§4.5 ①） |
| 75 | **单次最多 10 个块，按 `blockId` 去重后计数**（不是 `issueIds` 个数，多个 issue 落同一块只算 1 个）；超限报 **`LogMonitorDownloadBlockLimitExceeded`**，**不截断降级**（§4.5 ②） |
| 76 | **单个 `issueId` 取不到 `blockId` ⇒ 只记 WARN 日志并跳过该条**，其余块照常打包、不阻断；**一个 `blockId` 都取不到** ⇒ `LogMonitorIssueNotFound`（不返回空包）；**块文档取不到** ⇒ **算失败**、整批不下载（§4.5 ②③） |
| 77 | 块信息只取捞行必需的 **8 个字段**（`ENV` / `HOSTIP` / `SERVER_ID` / `system.name` / `START_TIME` / `END_TIME` / `START_LINE_ID` / `END_LINE_ID`），**按 `blockId` 末段 17 位毫秒定日索引、分组请求**（§4.5 ③） |
| 78 | 捞整块行**调 `shared-business-lib` 的 `FetchMESRuleFullLogs()`**：**输入＝块信息对象、输出＝该块全部行日志对象集合**；粗筛 / 重排 / 截断都在方法内部（口径 `04` §4.2 / §4.3），**本接口不自拼 DSL**；**块与块串行**，行序即写入顺序、照序写不再排（§4.5 ④） |
| 79 | 下载件结构：文件夹 **`meslog_{yyyyMMddHHmmss}`** / 每块 **`{blockId}.log`** / 包 **`meslog_{yyyyMMddHHmmss}.zip`**；**不拼 `txId`**，时间戳由服务端在进 ⑤ 时取一次、目录与 zip 共用；文件内容＝该块行按写入顺序的 **`LOG_RAW`**（行原文含前缀），一行一条、`\n` 结尾、UTF-8 无 BOM，**不加表头 / 分隔线 / 块元信息**（§4.5 ⑤） |
| 80 | 文件夹组织 / 写入 / 删除 / 下载输出一律调 **`common-lib` 的工具方法**（方法提供文件夹组织、写入、删除、下载输出等能力，不写具体方法名），**业务侧只组织文件和内容**；口径：**要么完整 zip 要么错误包**；**下载完成和接口失败两条路径都清理**本次 `meslog_{yyyyMMddHHmmss}` 整个目录；工具方法内部不展开（§4.5 ⑤⑥） |
| 81 | 目录 / 文件的创建、重名、并发冲突由 **`common-lib` 工具方法**处理：业务侧**不判重、不加随机后缀、不检查存在性**（§4.5 ⑤） |
| 82 | 下载的业务错误码全部复用：`IssueIdsRequired` / `IssueIdInvalid` / `LogMonitorDownloadBlockLimitExceeded` / `LogMonitorIssueNotFound` / `LogMonitorSourceUnavailable`（OS 失败）；**文件 IO 类错误直接拿工具方法的 error 输出**，不自定错误包结构、不自定错误码格式（§4.5 ⑦） |

> 只留生效口径，按编号追加，不留作废说明。

## 6. 待确认（七问卡片）

| # | 问题 | 状态 |
|---|---|---|
| 1 | 一句话：给谁解决什么问题 | ✅ 已明确：IT 运维在界面上看报警、就地解决，形成处置闭环 |
| 2 | 谁在用、什么时候触发它 | ✅ 已明确：IT 运维；**进入界面即加载**汇总数据 |
| 3 | 输入从哪来、结果给谁 | ✅ 已明确：汇总＝`list`、明细＝`detail_info/page`；处置结果＝`resolve` 提交并覆盖原有行 |
| 4 | 核心对象是什么、有哪些状态 | ✅ 已明确：核心对象＝issue（`issueId` 唯一）；状态＝未解决 / 已解决，由 `resolvedTime` 是否为空派生 |
| 5 | 正常流程走几步 | ✅ 已明确：**7 步**走完「发现 → 处置」闭环（§6.3） |
| 6 | 最常出问题的三种情况 | ✅ 已明确：**汇总时效 / 解决提交 / 过滤与行保留** 三类（§6.4） |
| 7 | 怎么算做好了 | ✅ 已明确：**闭环 / 时效 / 一致 / 可核对** 四条标准，对齐北星指标 MTTR 小时级 → 分钟级（§6.5） |

### 6.2 本轮待拍板

（暂无）。后续新增缺口按此表顺延补入。

> 以下三节**只按 §2 / §4 / §5 已定规格整理**，不新增业务口径。

### 6.3 正常流程（7 步）

1. **进页面**：默认 **ENV 空 / Days 30**，调 §4.1 `list` 取汇总数据。
2. **看汇总 / 换条件**：9 列按 `Item + Environment` 定位一行；改 Environment / Previous Days 后点 **Refresh** 按新条件重查，页面内不自动更新。
3. **点「查看」**：调 §4.2 `detail_info/page` 取该行 `item + environment` 下的 issue 列表，按 `reportTime` 倒序。
4. **看明细**：按需用「只过滤未解决」开关 / **刷新** / 翻页；点 **More Info** 看 Rule Message 全文与解析后的请求参数（§2.5）。
5. **发起处置**：点关闭态 `Resolved` 开关，或多选未解决行点列表下方 **Resolve** 按钮（§2.4）。
6. **提交**：填 `Resolved Comment`（不可为空）→ 点「确认」→ **POST** §4.3 `/api/v1/log_monitor/resolve`（`issueIds` + `resolvedComment`）。
7. **回显**：按返回 `LogMonitorAlarmDetailDto` 的 `issueId` 覆盖对应行（**返回数量可少于提交数量**：已被别人解决的会跳过）；已解决行**仍保留显示**，直到主动「刷新 / 关开关 / 重新点『查看』」才重查。

### 6.4 最常见的三类问题

| # | 风险点 | 为什么容易出事 |
|---|---|---|
| 1 | **汇总条件与时效** | 汇总只在进界面与点 Refresh 时取数、页面内不自动更新，长时间停留后看到的是**旧计数**；改了下拉 / 天数却忘了点 Refresh，看到的是**旧条件下的计数**；`previousDays` 填窗口外的值会让「总数量」与预期对不上；留空则**按 30 天兜底**，别当成「全部历史」 |
| 2 | **解决提交的范围与失败态** | Resolve 按钮只看「选中行有一个 `resolved = false`」即可用，批量时混入已解决行会多提交 `issueId`；重复点击、提交失败时 comment 框与行状态如何回退，本篇未定义 |
| 3 | **过滤条件与行保留打架** | 未解决开关**打开**时，提交返回的已解决行按 §5-23 **必须仍显示**；前端若顺手按当前过滤条件重过滤，就会「解决完行突然消失」。三种重查时机（刷新 / 关开关 / 重新点「查看」）漏一个，列表就和后端不一致 |

> 另有一处易混口径：5 个计数字段按 **issue 数量**，`lastAlarmTime` 是**通知发出时间**、`reportTime` 是明细**报告时间**；对账时按通知条数或把两个时间当同一个，就会算不平。

### 6.5 验收标准

1. **闭环**：从看汇总 → 查看明细 → 解决 → 行回显，全程在本页面完成，不切系统、不手工改库。
2. **时效与筛选**：进入界面按 `environment` 空 + `previousDays=30` 由 `list` 给出汇总数据；改条件后点 **Refresh** 即按新条件重查；页面内不自动刷新。
3. **一致**：5 个计数字段统一按 issue 数量；解决后按 `issueId` 覆盖、已解决行的保留与三种重查时机符合 §2.4 / §5-23，不出现「行消失 / 计数不降」。
4. **可核对**：More Info 能看到 Rule Message 全文与解析后的请求参数，凭 `issueId` 能定位到具体 issue。
5. **对齐北星指标**：把 Lot stuck / EAP offline / 接口超时等典型异常的 **MTTR 从小时级压到分钟级**（项目既定目标，本篇不另设数值）。
