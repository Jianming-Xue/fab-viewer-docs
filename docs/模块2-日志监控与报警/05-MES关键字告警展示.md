# MES 关键字告警展示 · 功能文档

> 模块 2 · 日志监控与报警 ｜ 编号 **05** —— 功能 1（MES 关键字监控）的**报警展示与处置页**；`07` / `08` / `09` 预留给功能 3 TIBCO RV QUEUE 监控与报警，`10` 为告警服务工程实现
> 状态：**待补充 5 接口后端**（2026-11-14）｜ 以本篇 §5 为唯一生效口径
> 上承：`docs/03-Halo功能盘点.md` 一期范围第 2 项；沟通节奏见 `docs/01-模块沟通模板.md`

| 项 | 内容 |
|---|---|
| 功能名称 | 中文 **`MES关键字告警展示`**；英文 **`MES Log Monitor`**（保留不变，2026-11-13 确认） |
| 所属 Module | **`monitor-alarm`**；模块名英文 `Monitor Alarm` / 中文 `监控通知` |
| **作用** | **把「MES 关键字监控」判出的报警日志展示出来，并在界面上完成解决** |
| 使用者 | IT 运维 |
| 界面类型 | **展示类 + 处置类** |
| 权限 | **采用权限管控方案**：**功能级** + **「解决」权限点**（`Resolved` 开关与 **Resolve** 按钮**共用同一个权限点**）；菜单渲染与接口鉴权同一份权限数据，口径同 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §3.1；粒度见 §2 |
| 入口 | 所属 Module `monitor-alarm` 下的独立页面；与配置页 `MES Log Monitor Config`（挂 `config` → 系统配置）**不是同一个菜单** |
| 数据来源 | 功能 1 判定生成的 **Alarm**（配规则见 `01`，判定与通知见 `02`，本篇不重跑判定、不发通知） |
| 与既有文档 | 规则怎么配 → [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md)；怎么判 / 检测时机 / 怎么通知 → [`02-MES关键字监控与告警.md`](02-MES关键字监控与告警.md)（**纯运行时**）；**展示与处置 → 本篇 §2**；字段与落点边界 → [`../04-后台链路与数据模型.md`](../04-后台链路与数据模型.md) §六 |
| 收录状态 | **已收录进 git**（2026-11-14 放行 `.gitignore` 白名单） |

---

## 1. 功能定位与边界

**一句话**：功能 1（MES 关键字监控）定时扫日志、命中就生成 Alarm；本篇把这些 **Alarm 摆到界面上**，让 IT 运维看到、并**在界面上把它们解决掉**，形成「发现 → 处置」的闭环。

| 环节 | 归谁 |
|---|---|
| 配置规则（扫什么 / 等级 / 通知给谁） | `01` 配置文档 |
| 定时扫描、三道检查、生成 Alarm、通知 | `02` 运行时文档 §2 / §3 / §4 |
| **展示 Alarm + 界面处置** | **本篇 §2**（处置见 §2.4） |
| 字段 / 落点边界 | [`../04-后台链路与数据模型.md`](../04-后台链路与数据模型.md) §六 |

> 本篇**只消费 Alarm**：不产生告警、不重跑判定、不发通知；日志正文本体仍回 OpenSearch 查（链路边界不破）。

## 2. 页面与交互

### 2.0 前端规格总览

> 下表按区域收拢已定规格，细则见对应小节；组件的视觉呈现一律以 [`../05-视觉与交互规范.md`](../05-视觉与交互规范.md) 为准。

| 区域 | 元素 | 已定规格 | 细则 |
|---|---|---|---|
| 上卡片 · 汇总 | 汇总表格 | **9 列**；**单选**；**无搜索框**；操作列**「查看」为唯一触发**（行选中不参与）；首屏 `list` + SSE 增量按 `Item + Environment` 更新 | §2.1 |
| 下卡片 · detail | 当前查看行标识 | 详情表格**上方显示当前查看行的 `item + environment`**；明细表格内**不显示 Item / Environment 两列** | §2.3 |
| 下卡片 · detail | 明细表格 | **9 列**；**多选**；按 `reportTime` 倒序；分页 | §2.3 |
| 下卡片 · detail | 初始 / 空态 | 未点「查看」、当前行无 issue、开关打开后全已解决 —— 均**只显示一个表头**，无数据行 | §2.3 |
| 下卡片 · detail | 查看行切换 | 点另一行「查看」后**自动回第 1 页、清空明细多选选中** | §2.3 |
| 下卡片 · detail | 列表工具 | **刷新**按钮；**无新增记录入口**；**只过滤未解决的开关**（开＝仅未解决，关＝全部） | §2.3 |
| 下卡片 · detail | **Alarm Log** 按钮 | 下载**选中行归属的原始日志**；**启用条件＝detail 列表中存在选中行即可**；下载类按钮，不新增 / 不修改记录；接口见 §4.6 | §2.3 |
| 下卡片 · detail | 操作列菜单 | **More Info** → 弹出详情对话框 | §2.3 / §2.5 |
| 下卡片 · detail | `Resolved` 开关 | 由 `resolvedTime` 派生；打开即禁用、关闭可点 → 弹 comment 框提交 | §2.4 |
| 下卡片 · detail | **Resolve** 按钮 | 选中行只要有一个 `resolved = false` 即可用；批量只提交未解决行 | §2.4 |
| 弹框 · More Info | 3 个字段 | **取自当前行对象**；Rule Message（Label 全文 + 参数逐行 + 展开 / 折叠）、Resolved Time（**时间组件**）、Resolved User（**输入框组件**）；Time 在前、两者禁用；**只有「关闭」按钮** | §2.5 |
| 弹框 · Resolved Comment | 输入框 + 确认 | `Resolved Comment` **不可为空** → 点「确认」提交 | §2.4 |
| 全局 | Body 布局 | **自上而下**两张卡片 | 本节布局段 |
| 全局 | 权限 | **功能级 + 「解决」权限点**；`Resolved` 开关与 Resolve 按钮**共用同一权限点** | 本节权限段 |

**Body 布局（自上而下）**：上方卡片 = **汇总信息表格**（§2.1）；下方卡片 = **点「查看」后的 detail**（§2.3，行选中不参与），detail 内的**解决动作**见 §2.4、**More Info 弹框**见 §2.5。汇总表格**无搜索框**；**进入界面即调** `/api/v1/log_monitor/summary_info/list` 取首屏数据（§4.1）。视觉与交互一律以 [`../05-视觉与交互规范.md`](../05-视觉与交互规范.md) 为准，本篇只记「哪个条件触发」，不记呈现。

**权限粒度**：**功能级**（菜单渲染与接口鉴权同一份权限数据，口径同 `01` §3.1）+ **「解决」权限点**。`Resolved` 开关与 **Resolve** 按钮**共用同一个权限点**：无该权限则两者均不可操作、`/api/v1/log_monitor/resolve` 接口亦不可调；「查看」不单独控权，随功能级。

### 2.1 汇总信息表格

出参为 **`LogMonitorSummaryInfoDto` 对象集合**（每个对象 9 字段与 9 列一一对应，字段类型见 §4.5）：

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
- **实时通知采用 SSE 推送**：进入界面调 §4.1 **单独取首屏数据**，同时建立 `/api/v1/log_monitor/summary_info/stream` 长连接（§4.2）。
- 后续由服务端**推增量**：出参为 **`LogMonitorSummaryInfoDto` 对象集合**，**只输出有数据变化的对象**；前端以 **`Item + Environment` 为唯一条件**更新汇总表格中的数据（§4.2）；断线重连由底层兜底。
- **SSE 增量只更新汇总表格对应行，不触发下方 detail 重新查询**；detail 的重查时机以 §2.4 三种为准。
- 此处「通知」＝**界面汇总数据的实时推送**，与 `02` §4 的邮件 / 飞书告警通知不是一回事。

### 2.2 字段定义（已定）

| 字段 | 定义 |
|---|---|
| `lastAlarmTime` | **发出通知的时间**，不是 Alarm 生成时间 |
| `dailyCnt` | **当日 issue 的数量**；中文列名 **今日问题数量** |
| `remainingCnt` / `totalCnt` / `totalResolvedCnt` / `dailyResolvedCnt` | 与 `dailyCnt` 一致，**统一按 issue 数量统计** |

> 9 列里的 5 个计数字段**单位一致、不混用**；其余字段语义随七问卡片逐条拍板后回填。

### 2.3 明细卡片（detail）

**触发**：点汇总表格操作列**「查看」** → 下方卡片展示该行 **`item + environment` 下的全部 issue list**，调 §4.3 分页接口；结果按 **`reportTime` 倒序** 排列。**「查看」是唯一触发动作，行选中不触发 detail、也不作为前置条件**。

**当前查看行标识**：详情表格**上方显示当前查看行的 `item + environment`**；明细表格内**不再显示 Item / Environment 两列**（输出字段仍是 14 个，这两项只移到表格上方显示）。

**输出字段（14 个）**：`environment`、`item`、`lotId`、`ruleName`、`hostIpAddress`、`ruleMessage`、`issueMessage`、`tId`、`issueTime`、`reportTime`、`resolvedTime`、`resolvedUser`、`alarmed`、**`issueId`**；字段类型见 §4.5。

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
- **只过滤未解决的开关**：**开** → 调 §4.3 只查未解决；**关** → 调同一接口查全部（含已解决与未解决）。解决提交后的行保留规则见 §2.4。

**Alarm Log 按钮**

- **位置**：列表下方，与 **Resolve** 按钮并列。
- **用途**：下载**当前多选选中行归属的原始日志**；属下载类按钮，**不新增、不修改记录**。
- **启用条件**：**detail 列表中存在选中行即可**（不要求 `resolved = false`，与 Resolve 按钮判据不同）；无选中行时禁用。
- **权限**：随**功能级**管控，不属「解决」权限点。
- **调用接口**：**`POST /api/v1/log_monitor/log/download`**，入参 `LogMonitorLogDownloadRo`（只含 `issueIds`），出参为文件流；契约见 §4.6。

### 2.4 解决（resolve）

**两个入口，同一套提交链路（§4.4）**：

| 入口 | 触发 | 提交标识 |
|---|---|---|
| `Resolved` 开关 | 点击**关闭态**开关 | 该行 `issueId`（单个） |
| 列表下方 **Resolve** 按钮 | 多选后点击 | 选中行中**未解决**的 `issueId`（多个，字符串数组） |

**`Resolved` 开关**

- 取值由 **`resolvedTime` 推断**：`resolvedTime` **为空 → 开关关闭**；**不为空 → 开关打开**。
- **行状态布尔 `resolved` 由前端从这个 `resolvedTime` 计算**：为空 → `false`（未解决）、不为空 → `true`（已解决）；**不在任何接口出入参中**（§4.5）。界面过程中的判断（Resolve 按钮是否可用、批量提交只取未解决行）一律用这个派生值，不必每处再判 `resolvedTime`。
- **与 §4.3 同名入参 `resolved` 不是同一个东西**：前者是行状态（前端派生），后者是「只过滤未解决」开关的查询条件。
- **开关打开时禁用**（已解决不可改回）；**开关关闭时取消禁用**、可点击。
- 点击关闭态开关 → 弹出**输入 `Resolved Comment` 的对话框**；**输入框不可为空** → 点「确认」提交。
- 提交成功后，返回的 **`LogMonitorAlarmDetailDto`** 按 **`issueId` 回显、覆盖列表中对应行**（§4.4）。

**Resolve 按钮**

- 多选模式下：选中行中**只要有一个 `resolved = false`，按钮即可用**；否则按钮**不可用（禁用）**。
- 点击 → 同样弹出**输入 `Resolved Comment` 的对话框**（不可为空）提交；`issueIds` 数组**只放选中行里 `resolved = false` 的 `issueId`，不含已解决行**。

> 单条与批量**同走 §4.4 一个接口、同一个入参对象**：`issueIds` 始终维持数组形态，可放 1 个元素也可放多个；本篇不另立单条接口。

**提交后的行保留**

- 返回结果按 `issueId` 覆盖对应行；即使「只过滤未解决的开关」处于**打开**状态、返回的行已变为**已解决**，**也不隐藏、仍保留显示在列表中**。
- 只有用户主动触发以下三种动作之一，才按当前过滤条件重新查询、重新渲染列表：① 点列表**刷新**按钮；② **关闭**未解决开关；③ 重新点汇总表格的**「查看」**。

### 2.5 More Info 弹框

**展示字段（3 个）**：`ruleMessage`（Rule Message）、`resolvedTime`（Resolved Time）、`resolvedUser`（Resolved User）；**`issueId` 不展示**。

| 区块 | 呈现 |
|---|---|
| **Rule Message 全文** | 完整 `ruleMessage` 用 **Label** 形式显示（纯展示，不可编辑） |
| **解析后的请求参数** | 前端用 **API 工具类中的请求参数解析方法**把 `ruleMessage` 里的参数解析出来，**逐行显示**；配一个**展开 / 折叠按钮**控制该区块展开或收起；**滚动只发生在参数行区域**，Label 区与其余区块不滚动 |
| **Resolved Time** | **时间组件**，**禁用** |
| **Resolved User** | **输入框组件**，**禁用** |

- 两个 Resolved 字段的**显示顺序**：**Time 在前、User 在后**；两者均**禁用**。
- **展示字段与 Rule Message 原文均取自当前行对象**，不另调接口；参数解析在**前端工具类完成**，不新增后端接口。
- **按钮**：More Info 弹框**只有一个「关闭」按钮**，无「确认」/「保存」等其它操作按钮；与 §2.4 输入 `Resolved Comment` 的对话框（含「确认」提交）不是同一个弹框。

## 3. 数据口径

- 字段与取值一律引用 [`../04-后台链路与数据模型.md`](../04-后台链路与数据模型.md)，本篇不另立；告警落点以 §六为边界。
- 汇总字段与列见 **§2.1**；已定字段语义见 **§2.2**；明细字段与列见 **§2.3**，排序按 `reportTime` 倒序；解决提交与行覆盖见 **§2.4 / §4.4**。
- 计数单位见 **§2.2**、More Info 弹框规格见 **§2.5**；五个端点的总表与全局约定见 **§4.0**、出入参对象见 **§4.5**。

## 4. 接口

### 4.0 接口总表与全局约定

**5 条端点均归属 `telemetry-hub`**（与 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §4 的 5 条配置接口同服务）；服务内前缀 `/api/v1/log_monitor`，前端调用加 `telemetry-hub` 前缀。

| # | 服务内路径 | 方法 | 用途 | 权限 | 细则 |
|---|---|---|---|---|---|
| 1 | `/api/v1/log_monitor/summary_info/list` | `GET` | 汇总首屏 | 功能级 | §4.1 |
| 2 | `/api/v1/log_monitor/summary_info/stream` | **`GET`（SSE）** | 汇总增量推送 | 功能级 | §4.2 |
| 3 | `/api/v1/log_monitor/detail_info/page` | `GET` | 明细分页 | 功能级 | §4.3 |
| 4 | `/api/v1/log_monitor/resolve` | **`POST`** | 解决提交 | 「解决」权限点 | §4.4 |
| 5 | `/api/v1/log_monitor/log/download` | **`POST`** | Alarm Log 下载（选中行原始日志） | 功能级 | §4.6 |

**全局约定**（引用既有后端设计，本篇不另立）

| 项 | 约定 | 来源 |
|---|---|---|
| 响应外壳 | `list` / `detail_info/page` / `resolve` **三条 REST 统一走全局响应包**：`code` / `success` / `errMsg` / `data` / `txId`，业务数据一律放 `data`；成功 `code = OK`、`success` 输出 `0` / `1`；**业务类失败 HTTP 恒 200**。`log/download` **成功为文件流、不走外壳**，仅**错误时**以框架标准接口返回错误信息（§4.6） | [`../模块6-用户与安全管理/05-后端设计.md`](../模块6-用户与安全管理/05-后端设计.md) §1.4；`01` §4.3 共性约定 1 |
| 分页 | `detail_info/page` **有分页**，出参为**分页对象 `Pageable`**；分页细节由底层提供，本篇不展开 | 同上 §1.5 |
| 对象命名 | API 入参 `Ro`、出参 `Dto`；**#3 `detail_info/page` 入参为 URL 拼接参数、不定义 `Ro`**（§4.3） | 同上 §1.6 |
| 定位键 | 汇总 / 明细按 `item + environment` 定位；单条 issue 按 `issueId` 定位 | §2.1 / §2.3 |

### 4.1 汇总信息（已定）

| 项 | 内容 |
|---|---|
| 路径 | `/api/v1/log_monitor/summary_info/list` |
| 方法 | **`GET`** |
| 入参 | **无**（汇总表格无搜索框） |
| 出参 | **`LogMonitorSummaryInfoDto` 对象集合**（每个对象 9 字段见 §2.1） |
| 调用时机 | **进入界面单独调用一次，取首屏数据** |
| 实时通道 | **SSE**（Server-Sent Events），服务端单向推送；端点与增量规则见 §4.2 |
| 权限 | 随**功能级权限**管控，无权限接口不可调 |

### 4.2 实时通知 SSE 流（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/summary_info/stream`** |
| 方法 | **`GET`** |
| 方向 | 服务端 → 浏览器，**单向推送** |
| 调用时机 | 进入界面建立长连接，与 §4.1 首屏取数并行 |
| 出参对象 | **`LogMonitorSummaryInfoDto` 对象集合**（9 字段见 §2.1），与 §4.1 首屏为同一个 DTO |
| 推送内容 | **增量**：**只输出有数据变化的对象**（一次可推多个）；前端按 **`Item + Environment`**（DTO 字段 `item` / `environment`）更新自己汇总表中的数据 |
| 前端实现 | **SSE 全部由前端公共类承接**：建连、鉴权、事件解析、断线重连等一律复用该公共类，开发时直接调用；**断线重连由底层兜底**；本篇不定义这些实现细节 |
| 权限 | 随**功能级权限**管控，无权限不可建立连接 |

### 4.3 明细信息分页（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/detail_info/page`** |
| 方法 | **`GET`** |
| 入参 | **参数拼接在 URL 中传递**（query 参数），**不定义 `Ro` 对象**；参数＝**分页**（见 §4.0）+ **`environment`** + **`item`** + **`resolved`**（**布尔类型**，对应未解决开关状态） |
| 出参 | **分页对象 `Pageable`**（行元素 14 字段见 §2.3 / §4.5） |
| 排序 | 按 **`reportTime` 倒序** |
| 调用时机 | 点汇总表格「查看」时；未解决开关切换时重新查询 |
| 过滤 | 开关**开**＝仅未解决；开关**关**＝全部（含已解决与未解决） |
| 权限 | 随**功能级权限**管控，无权限接口不可调 |

### 4.4 解决提交（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/resolve`** |
| 方法 | **`POST`** |
| 入参对象 | **`ResolveLogMonitorAlarmRo`** |
| 入参 1 | **`issueIds`**：字符串数组，**不可为空**；**维持数组形态**，可放 1 个也可放多个 `issueId`；批量提交时**不含已解决行** |
| 入参 2 | **`resolvedComment`**：字符串，**不可为空**（对话框输入） |
| 出参 | **`LogMonitorAlarmDetailDto` 对象集合**，按输入 `issueIds` **一一返回**（输入 1 个返回 1 个、多个返回多个）；前端按 **`issueId`** 覆盖对应行 |
| 调用时机 | 对话框点「确认」提交时；`Resolved` 开关（单条）或 **Resolve** 按钮（批量） |
| 权限 | 受**「解决」权限点**管控，与 `Resolved` 开关 / **Resolve** 按钮共用同一权限点，无权限接口不可调 |

### 4.5 出入参对象（已定）

| 对象 | 用于 | 字段 |
|---|---|---|
| `LogMonitorSummaryInfoDto`（出参） | §4.1 汇总首屏 / §4.2 SSE 增量 | **对象集合**；每个对象 **9 字段**见 §2.1、**字段类型见下表**；5 个计数字段按 issue 数量统计，见 §2.2；SSE 只输出有数据变化的对象 |
| `LogMonitorAlarmDetailDto`（出参） | §4.3 明细分页的行元素 / §4.4 解决提交的返回 | **14 字段**见 §2.3、**字段类型见下表**；`issueId` 为每行唯一 ID、`resolvedTime` 派生 `Resolved` 开关；`environment` / `item` 显示在详情表上方、不成列 |
| `ResolveLogMonitorAlarmRo`（入参） | §4.4 解决提交 | 2 字段，见下表 |
| `LogMonitorLogDownloadRo`（入参） | §4.6 Alarm Log 下载 | **1 字段**，见下表 |

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

> 输出字段仍为 **14 个**，**不含 `resolved`**：行状态布尔 `resolved` 由前端按 `resolvedTime` 是否为空计算（§2.4），**不在接口出入参中**；§4.3 的同名入参 `resolved` 是「未解决开关」的过滤条件，二者不是同一个东西。`resolvedTime` 为时间类型，与 §2.5 的 Resolved Time 时间组件一致。

**`ResolveLogMonitorAlarmRo`**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `issueIds` | `List<string>` | 是 | **维持数组形态**，可放 1 个也可放多个 `issueId`；批量提交**不含已解决行** |
| `resolvedComment` | `string` | 是 | 对话框输入，**不可为空** |

> `resolve` 出参按输入 `issueIds` **一一返回** `LogMonitorAlarmDetailDto`，前端按 `issueId` 覆盖对应行（§2.4 / §4.4）。

**`LogMonitorLogDownloadRo`**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `issueIds` | `List<string>` | 是 | 取自 detail 列表**当前多选选中行**的 `issueId`；**对象只含此一个字段** |

### 4.6 Alarm Log 下载（已定）

| 项 | 内容 |
|---|---|
| 路径 | **`/api/v1/log_monitor/log/download`**（服务内前缀 `/api/v1/log_monitor` + 后缀 `/log/download`） |
| 方法 | **`POST`** |
| 入参对象 | **`LogMonitorLogDownloadRo`** |
| 入参 | **仅 `issueIds`**：字符串数组，取自 detail 列表**当前多选选中行**的 `issueId` |
| 出参 | **成功：以文件流返回**（选中行归属的原始日志），**不走响应外壳** |
| 错误 | 接口发生错误时**仍以框架标准接口返回错误信息**（全局响应外壳 `code` / `success` / `errMsg` / `data` / `txId`） |
| 调用时机 | 点 **Alarm Log** 按钮时；启用条件＝detail 列表中存在选中行（§2.3） |
| 权限 | 随**功能级**管控，不属「解决」权限点 |

> 示例只用真实业务接口 / 服务名，不用占位符。

## 5. 已确认口径

| # | 口径 |
|---|---|
| 1 | 本篇归**模块 2**，编号 **05**（顺延 `01`~`04`） |
| 2 | 作用＝**展示经 MES 关键字监控产生的报警日志 + 在界面上解决**；不负责判定与通知 |
| 3 | 所属 Module = **`monitor-alarm`**；模块名 `Monitor Alarm` / `监控通知`；功能名 `MES关键字告警展示`（原 `MES日志监控` / `MES Log Monitor`，2026-11-13 更名） |
| 4 | **采用权限管控方案**：**功能级**（菜单渲染与接口鉴权同一份权限数据，口径同 `01` §3.1）+ **「解决」权限点**；粒度见 §2 |
| 5 | Body **自上而下**：上方卡片 = 汇总信息表格、**无搜索框**；进入界面调 `/api/v1/log_monitor/summary_info/list`，出参 `LogMonitorSummaryInfoDto` **对象集合**（每个对象 9 字段 / 9 列见 §2.1） |
| 6 | 汇总表格**单选模式**、操作列含「查看」（**「查看」为唯一触发，行选中不起作用**）、**实时通知（SSE 推送）** |
| 7 | `lastAlarmTime` = **发出通知的时间**（非 Alarm 生成时间） |
| 8 | `dailyCnt` = **当日 issue 的数量**；中文列名 **今日问题数量** |
| 9 | **实时通知采用 SSE 推送**：进入界面调 `list` 取首屏数据、同时建立 SSE 长连接，后续由服务端单向推送增量更新（§4.2） |
| 10 | SSE 订阅端点 = **`/api/v1/log_monitor/summary_info/stream`**（§4.2），与首屏 `list` 端点并存 |
| 11 | SSE **推增量**，出参＝`LogMonitorSummaryInfoDto` 对象集合（**只输出有数据变化的对象**）；以 **`Item + Environment` 为唯一条件**更新汇总表格中的数据 |
| 12 | 进入界面**仍单独调用 `list` 取首屏**；SSE 只负责后续增量，不代替首屏 |
| 13 | **断线重连由底层兜底**，本篇不定义 |
| 14 | 下方卡片 = **点「查看」后的 detail**（行选中不参与）；点操作列「查看」触发，取该行 `item + environment` 下的全部 issue list |
| 15 | 明细接口 = **`/api/v1/log_monitor/detail_info/page`**，**分页**取数，结果按 **`reportTime` 倒序** |
| 16 | 明细 **14 个输出字段 → 9 个显示列**（§2.3）；`environment` / `item` 显示在详情表格上方，`ruleMessage` / `resolvedTime` / `resolvedUser` 由 **More Info 弹框**展示，`issueId` 不展示 |
| 17 | 明细表格**多选**；操作列为**菜单**，含 **More Info**；列表有**刷新**按钮、**无新增记录入口**；另设 **Alarm Log** 下载按钮 |
| 18 | **只过滤未解决的开关**：开＝只查未解决，关＝查全部（含已解决与未解决），均调 `/api/v1/log_monitor/detail_info/page` |
| 19 | 明细输出字段含 **`issueId`** = 每条 issue 的**唯一 ID**，不单独成列，作行主键与解决提交标识 |
| 20 | `Resolved` 列为**可点击开关**，由 **`resolvedTime` 派生**：为空＝关闭、不为空＝打开；**打开时禁用**（不可改回），关闭时取消禁用 |
| 21 | 点击关闭态开关 → 弹出**输入 `Resolved Comment` 的对话框**（**不可为空**）→ 点「确认」提交 |
| 22 | 解决提交 = **`POST /api/v1/log_monitor/resolve`**，入参对象 **`ResolveLogMonitorAlarmRo`**：`issueIds`（字符串数组，不可为空）+ `resolvedComment`（字符串，不可为空）；**单条＝数组 1 个元素，批量＝多个元素**，同走一个接口 |
| 23 | 提交成功后，用**返回结果覆盖掉原有行**的内容 |
| 24 | 列表下方 **Resolve** 按钮：多选选中行中**只要有一个 `resolved = false` 即可用**，否则禁用；点击同样弹 comment 对话框提交，`issueId` 为**多个值（字符串数组）** |
| 25 | `issueIds` **维持数组形态**：1 个或多个元素同走一个接口；批量提交**只放未解决行的 `issueId`，不含已解决行** |
| 26 | `resolve` 出参 = **`LogMonitorAlarmDetailDto` 对象集合**，按输入 `issueIds` **一一返回**（输入 1 个返回 1 个、多个返回多个）；覆盖时按 **`issueId`** 回显对应行 |
| 27 | **提交后的行保留**：未解决开关**打开**时，返回的已解决行**不隐藏、仍保留显示**；仅用户主动「刷新 / 关闭开关 / 重新点汇总『查看』」才按当前过滤条件重新查询 |
| 28 | 明细接口入参 = **拼接在 URL 中的 query 参数、不定义 `Ro` 对象**：**分页** + **`environment`** + **`item`** + **`resolved`**（**布尔类型**，对应未解决开关状态） |
| 29 | 权限管控到**功能** + **「解决」权限点**；`Resolved` 开关与 **Resolve** 按钮**是同一个权限点**，「查看」随功能级、不单独控权 |
| 30 | 界面 **5 条端点**：`list` / `stream` / `detail_info/page` 为 **`GET`**（含 SSE 流）；`resolve` / `log/download` 为 **`POST`** |
| 31 | 9 列里的 **5 个计数字段**（`remainingCnt` / `totalCnt` / `totalResolvedCnt` / `dailyCnt` / `dailyResolvedCnt`）**统一按 issue 数量统计**，单位不混用 |
| 32 | `dailyCnt` 中文列名 = **今日问题数量**（Daily Count） |
| 33 | More Info 弹框展示 **3 个字段**：Rule Message / Resolved Time / Resolved User；**`issueId` 不展示** |
| 34 | Resolved Time 用**时间组件**、Resolved User 用**输入框组件**；**Time 在前、User 在后**，两者**均禁用** |
| 35 | Rule Message 完整原文用 **Label** 显示；请求参数由前端 **API 工具类方法**解析后**逐行显示**、带**展开 / 折叠按钮**，**滚动只发生在参数行区域** |
| 36 | More Info 弹框**只有一个「关闭」按钮**，无其它操作按钮（与 §2.4 的 comment 对话框不同） |
| 37 | **5 条端点均归属 `telemetry-hub`**（与 `01` §4 的 5 条配置接口同服务）；服务内前缀 `/api/v1/log_monitor` |
| 38 | `list` / `detail_info/page` / `resolve` **三条 REST 统一走全局响应外壳**（业务数据放 `data`）；明细分页**有分页**、出参为**分页对象 `Pageable`**，分页细节由底层提供、本篇不展开 |
| 39 | **SSE 全部实现细节由前端公共类承接**（建连 / 鉴权 / 事件解析 / 断线重连），开发时直接复用，本篇不定义 |
| 40 | **初始态 / 空态**：进入界面未点「查看」、当前查看行无 issue、未解决开关打开后全已解决 —— 明细表格**只显示一个表头**，无数据行，不隐藏卡片 |
| 41 | **点操作列「查看」是触发 detail 的唯一动作**；**行选中不起作用**，不触发加载、也不作为前置条件 |
| 42 | **切换查看行**：点另一行「查看」后 detail **自动回第 1 页、清空明细多选选中**，再按新行的 `item + environment` 查询 |
| 43 | 详情表格**上方显示当前查看行的 `item + environment`**；明细**不再显示 Item / Environment 两列**（14 个输出字段 → **9 个显示列**） |
| 44 | **SSE 增量只更新汇总表格对应行，不触发 detail 重新查询**；detail 重查仍按 §2.4 三种时机 |
| 45 | More Info 弹框**展示字段与 Rule Message 原文均取自当前行对象**，不另调接口 |
| 46 | 下方卡片增设 **Alarm Log** 按钮（与 Resolve 并列）：下载**当前多选选中行归属的原始日志**；**启用条件＝detail 列表中存在选中行即可**（不要求未解决、无选中行时禁用）；下载类按钮，不新增 / 不修改记录，权限随**功能级** |
| 47 | **Alarm Log 下载接口已定**（§4.6），已定接口为 §4.0 总表 **5 条** |
| 48 | **#1 `list` 出参＝`LogMonitorSummaryInfoDto` 对象集合**（每个对象 9 字段见 §2.1），**不是单条对象** |
| 49 | **#2 SSE 出参＝`LogMonitorSummaryInfoDto` 对象集合**：**只输出有数据变化的对象**（一次可推多个），前端按 **`item + environment`** 更新自己汇总表中的数据；与 §4.1 首屏为同一个 DTO |
| 50 | **#3 `detail_info/page` 入参＝拼接在 URL 中的 query 参数、不定义 `Ro` 对象**：分页 + `environment` + `item` + `resolved`（布尔） |
| 51 | **#5 端点＝`POST /api/v1/log_monitor/log/download`**（服务内前缀 `/api/v1/log_monitor` + 后缀 `/log/download`），归 `telemetry-hub`，权限随**功能级**、不属「解决」权限点 |
| 52 | **#5 入参对象＝`LogMonitorLogDownloadRo`，只含 `issueIds` 一个字段**（字符串数组），取自 detail 列表当前多选选中行的 `issueId`；不定义其它参数 |
| 53 | **#5 出参＝成功以文件流返回原始日志、不走响应外壳**；**接口发生错误时仍以框架标准接口返回错误信息**（全局响应外壳） |
| 54 | **#5 方法＝`POST`**（用户 2026-11-14 回拍确认）；`LogMonitorSummaryInfoDto` 字段类型：`environment` / `item` / `priority` 为 `string`、5 个 `Cnt` 结尾字段为 `int`、`lastAlarmTime` 为时间类型（§4.5） |
| 55 | `LogMonitorAlarmDetailDto` 字段类型：`issueTime` / `reportTime` / `resolvedTime` 为时间类型、`alarmed` 为 `boolean`、其余 10 个字段为 `string`；**输出字段仍 14 个、不含 `resolved`**，`resolvedTime` 时间类型与 §2.5 时间组件一致（§4.5） |
| 56 | **行状态布尔 `resolved` 是前端由 `resolvedTime` 是否为空计算出的派生值**（为空 → `false`、不为空 → `true`），**不在任何接口出入参中**；界面过程判断（Resolve 按钮可用性、批量提交只取未解决行）一律用它，不必每处再判 `resolvedTime`。与 §4.3 同名入参 `resolved`（「只过滤未解决」开关的查询条件）不是同一个东西（§2.4 / §4.5） |

> 只留生效口径，按编号追加，不留作废说明。

## 6. 待确认（七问卡片）

| # | 问题 | 状态 |
|---|---|---|
| 1 | 一句话：给谁解决什么问题 | ✅ 已明确：IT 运维在界面上看报警、就地解决，形成处置闭环 |
| 2 | 谁在用、什么时候触发它 | ✅ 已明确：IT 运维；**进入界面即加载** + SSE 实时推送更新 |
| 3 | 输入从哪来、结果给谁 | ✅ 已明确：首屏＝`list`、后续＝`stream` 增量、明细＝`detail_info/page`；处置结果＝`resolve` 提交并覆盖原有行 |
| 4 | 核心对象是什么、有哪些状态 | ✅ 已明确：核心对象＝issue（`issueId` 唯一）；状态＝未解决 / 已解决，由 `resolvedTime` 是否为空派生 |
| 5 | 正常流程走几步 | ✅ 已明确：**7 步**走完「发现 → 处置」闭环（§6.3） |
| 6 | 最常出问题的三种情况 | ✅ 已明确：**实时增量 / 解决提交 / 过滤与行保留** 三类（§6.4） |
| 7 | 怎么算做好了 | ✅ 已明确：**闭环 / 实时 / 一致 / 可核对** 四条标准，对齐北星指标 MTTR 小时级 → 分钟级（§6.5） |

### 6.2 本轮待拍板

（暂无）。后续新增缺口按此表顺延补入。

> 以下三节**只按 §2 / §4 / §5 已定规格整理**，不新增业务口径。

### 6.3 正常流程（7 步）

1. **进页面**：调 §4.1 `list` 取汇总首屏，同时建 §4.2 `stream` 的 SSE 长连接。
2. **看汇总**：9 列按 `Item + Environment` 定位一行；后续由 SSE **增量**（`LogMonitorSummaryInfoDto` 对象集合，只含有数据变化的对象）按该唯一键更新汇总表中对应数据。
3. **点「查看」**：调 §4.3 `detail_info/page` 取该行 `item + environment` 下的 issue 列表，按 `reportTime` 倒序。
4. **看明细**：按需用「只过滤未解决」开关 / **刷新** / 翻页；点 **More Info** 看 Rule Message 全文与解析后的请求参数（§2.5）。
5. **发起处置**：点关闭态 `Resolved` 开关，或多选未解决行点列表下方 **Resolve** 按钮（§2.4）。
6. **提交**：填 `Resolved Comment`（不可为空）→ 点「确认」→ **POST** §4.4 `/api/v1/log_monitor/resolve`（`issueIds` + `resolvedComment`）。
7. **回显**：按返回 `LogMonitorAlarmDetailDto` 的 `issueId` 覆盖对应行；已解决行**仍保留显示**，直到主动「刷新 / 关开关 / 重新点『查看』」才重查。

### 6.4 最常见的三类问题

| # | 风险点 | 为什么容易出事 |
|---|---|---|
| 1 | **实时增量与首屏并行** | `list` 首屏与 `stream` 建连同时发生，增量若在首屏返回前后到达，容易重复计数或覆盖首屏；断连由底层兜底、界面又无连接态提示，会变成「汇总不动但没人知道」。唯一键 `Item + Environment` 若字段缺失或大小写不一致，会更新错行 |
| 2 | **解决提交的范围与失败态** | Resolve 按钮只看「选中行有一个 `resolved = false`」即可用，批量时混入已解决行会多提交 `issueId`；重复点击、提交失败时 comment 框与行状态如何回退，本篇未定义 |
| 3 | **过滤条件与行保留打架** | 未解决开关**打开**时，提交返回的已解决行按 §5-27 **必须仍显示**；前端若顺手按当前过滤条件重过滤，就会「解决完行突然消失」。三种重查时机（刷新 / 关开关 / 重新点「查看」）漏一个，列表就和后端不一致 |

> 另有一处易混口径：5 个计数字段按 **issue 数量**、`02` 通知是定时合并发，`lastAlarmTime` 是**通知发出时间**、`reportTime` 是明细**报告时间**；对账时按通知条数或把两个时间当同一个，就会算不平。

### 6.5 验收标准

1. **闭环**：从看汇总 → 查看明细 → 解决 → 行回显，全程在本页面完成，不切系统、不手工改库。
2. **实时**：进入界面首屏由 `list` 给出；后续汇总计数随 SSE 增量更新，无需手动刷新页面。
3. **一致**：5 个计数字段统一按 issue 数量；解决后按 `issueId` 覆盖、已解决行的保留与三种重查时机符合 §2.4 / §5-27，不出现「行消失 / 计数不降」。
4. **可核对**：More Info 能看到 Rule Message 全文与解析后的请求参数，凭 `issueId` 能定位到具体 issue。
5. **对齐北星指标**：把 Lot stuck / EAP offline / 接口超时等典型异常的 **MTTR 从小时级压到分钟级**（项目既定目标，本篇不另设数值）。
