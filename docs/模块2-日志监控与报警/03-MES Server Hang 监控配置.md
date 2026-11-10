# MES Server Hang 监控 · 配置文档

> 模块 2 · 日志监控与报警 ｜ 功能 2 ｜ 状态：**配置侧定稿**（2026-11-10 表结构 / 接口 / 配置页拍板）。判定式、扫描、报警落库与通知等**运行时**内容见 [`04-MES Server Hang 监控与告警.md`](04-MES%20Server%20Hang%20监控与告警.md)。

| 项 | 内容 |
|---|---|
| 模块 | 模块 2 · 日志监控与报警 · 功能 2（第二类 · 报警） |
| 使用者 | IT 运维 |
| 上承 | `03-Halo功能盘点.md` 一期范围第 2 项（MES Server Hang 监控与告警） |
| 本篇范围 | **只管配置侧**：环境级两个阈值 + 等级 + 通知目标怎么存、怎么配 |
| 不在本篇 | 两条判据怎么算（判据 A Server Hang / 判据 B Endless Rule）→ 运行时文档 §1；扫描与落库 → 运行时文档 §3 |
| 本阶段边界 | 表结构 / 接口 / 配置页均已定稿（§2 / §3 / §4）；原型与样式细节另开 |

> 拆分说明：功能 1（关键字监控）已按「配置 / 运行时」拆两篇（`01` / `02`），本篇与之对齐。

---

## 1. 配置侧要解决什么

「一个环境下，两个阈值各配多少、报出来的报警算几级、发给谁」。

判定对象与判据在运行时侧定义，配置侧只需要知道**两个阈值的语义**（一句话，细节见运行时 §1）：

| 阈值 | 语义（一句话） | 单位 |
|---|---|---|
| **Max Delay** | Rule 未执行完（块未闭口）就停止写日志，停写超过这个值 ⇒ 报 `Server Hang` | 秒 |
| **Max Rule Cost** | 一次 Rule 的写日志时长超过这个值 ⇒ 报 `Endless Rule`（进行中就报，闭口后看总耗时） | 秒 |

**配置粒度：只看环境名，不需要 Rule Name**（2026-09-24 已定）—— 该环境下所有块都按这套阈值判。

原话（2026-09-24，配置项部分）：
> 「第二类需要配置环境名、最大 delay 时间、最大耗时时间，等级、发送邮件的地址、企业微信、钉钉等等。」

---

## 2. 配置表 `FabViewerSrvHangMonitorCfg`（环境级阈值）

**表规范（全项目）**：自维护表一律 `FabViewer` 前缀；代理主键 `ID`（不拿业务字段当自然键）；四审计字段由底层赋值；字符串长度**按字符**校验。

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `ID` | varchar2(50) | 否 | 主键，底层赋值 |
| `Environment` | ≤30 | 否 | 环境名；候选来自 Misc `mes.global.environments`；**唯一键**——一环境一行（§5-3 已定） |
| `MaxDelay` | 整数 | 否 | 最大 delay（秒），**`1 ~ 65535`**（§5-4 上限与运行时跨层约束的关系仍待确认） |
| `MaxRuleCost` | 整数 | 否 | 最大耗时（秒），**`1 ~ 65535`** |
| `Priority` | ≤20 | 否 | 报警等级；值域来自 Misc `system.global.priority`（§5-2 已定） |
| `AlarmCfgId` | ≤50 | 否 | 通知配置，**复用功能 1 的 `FabViewerAlarmCfg`**（邮件 / 飞书 + 通知间隔），随配置 1:1 |

- 审计字段 `createdAt` / `createdBy` / `updatedAt` / `updatedBy` 由底层统一赋值。
- **不设 `Enabled`**：字段清单未含，对齐功能 1「**配置即启用**」口径（§5-6）。
- ~~`AlarmItems`~~ 已废弃：通知目标改由 `AlarmCfgId` 指向 `FabViewerAlarmCfg` 承载（§5-5）。

**通知配置落点（已定）**：复用 `FabViewerAlarmCfg`，界面层用**公共组件 `AlarmCfgEditor`**（定义归 `01-MES关键字监控配置` §3.4），写操作随配置在同一事务内完成，**无独立通知接口**。

---

## 3. 配置页

### 3.1 菜单位置与权限

| 项 | 内容 |
|---|---|
| 菜单名 | `MES Server Hang Monitor Config` / `MES服务挂起监控配置` |
| 位置 | `config` 模块 → **系统配置**（与功能 1 的 MES Log Monitor Config 同级） |
| 权限 | **菜单级权限管控**：无菜单权限时入口不可见，接口也调不通（对齐功能 1） |

### 3.2 主界面

单页自上而下两个卡片，**没有查询卡片**（`list` 全量返回、无条件不分页，数据量 = 配置过的环境数，无需搜索）：

**① 表格卡片**

- 进入页面即调 `GET /cfg/list` 渲染全部数据；`刷新` 按钮重调同一接口。
- 工具栏：`新增` + `刷新`（左）。
- 列表 6 列：

| 列 | 内容 |
|---|---|
| Environment | 原样显示 |
| Max Delay | 数字 + `s` 后缀（秒） |
| Max Rule Cost | 数字 + `s` 后缀（秒） |
| Priority | `P1`~`P4` 色标，与功能 1 / 展示页同一套 |
| Last Updated User | 原样显示 |
| Last Updated Time | `yyyy-MM-dd HH:mm:ss` |

- 操作列：`修改` / `查看` / `删除`（`删除` **二次确认**，提示文案与功能 1 同口径——删除后不再扫描该环境，**不是立即生效**，需等告警服务下次加载配置，已产生的报警保留）。
- 空态 / 加载态沿用 `05-视觉与交互规范`。

**② 编辑卡片**（表格卡片下方，**页内卡片**，不用弹窗——与功能 1 不同）

| 区 | 位置 | 内容 |
|---|---|---|
| 配置区 | 左侧 | `Environment` 下拉（候选来自 Misc `mes.global.environments`）、`Priority` 下拉（候选走 `/api/v1/sys_misc/priority/list`）、`Max Delay` 输入框（整数 `1~65535`，单位秒）、`Max Rule Cost` 输入框（同左） |
| 通知区 | 右侧 | **直接嵌入通知配置公共组件 `AlarmCfgEditor`**——`Interval` / `Mail` / `飞书` 三段，定义见 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §3.4，校验内聚在组件里，本功能不重复实现 |
| 按钮区 | 卡片右下角 | `取消` + `确认` |

### 3.3 编辑卡片的禁用与回显（核心交互）

| 状态 | 进入方式 | 行为 |
|---|---|---|
| **初始 / 空闲** | 进入页面、或点过 `取消` 后 | 卡片内**全部控件禁用**（含 `确认`），仅 `取消` 按钮可用 |
| **新增** | 点工具栏 `新增` | 清空全部控件值并**解除禁用**；`Environment` 下拉可选 |
| **修改** | 点操作列 `修改` | **把该行的值回显到编辑卡片**（含通知配置，用列表行数据回填，无需再调接口）并解除禁用；`Environment` **保持锁定不可改**——它是定位键，改了等于换一条，要换就删了重建 |
| **查看** | 点操作列 `查看` | **只回显**该行的值，其余控件**保持禁用**（含 `确认`，防止误提交）；仅可点 `取消` 退出 |

- `取消`：清空全部控件值 → 恢复**初始态**（全部禁用），不产生任何提交。
- `确认`：先校验（必填 4 项 + 两阈值范围 + 通知间隔 + 邮箱格式，规则同 §4.2），通过后提交——新增走 `POST`、修改走 `PUT`；成功后**重新拉 `list` 回显到列表**，并回到初始态。
- 校验不过时就地红字提示，不弹全局错误。

> 两条交叉校验（关注 / 排除名单交集、排除词是 keyword 子串）是**关键字监控特有**的，本功能无 keyword，不适用；Alarm 区仅校验格式与必填。

---

## 4. 接口

服务内前缀 `/api/v1/srv_hang_monitor`（对齐功能 1 命名法，2026-11-10 确认）；响应外壳沿用整体库（`模块6/05-后端设计`）。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `/api/v1/srv_hang_monitor/cfg/list` | `GET` | 全量查询，**不分页、不设查询条件**，按 `Environment` 升序 |
| 2 | `/api/v1/srv_hang_monitor/cfg` | `POST` | 新增配置（同事务写通知配置） |
| 3 | `/api/v1/srv_hang_monitor/cfg` | `PUT` | 修改配置（同事务更新通知配置） |
| 4 | `/api/v1/srv_hang_monitor/cfg?environment=` | `DELETE` | 删除配置（`Environment` 作定位参数，连带删通知配置） |

> 无 `detail` 接口 —— 环境级一行一条、List 全量返回，编辑回填直接用列表行数据。

### 4.1 对象

| 对象 | 方向 | 说明 |
|---|---|---|
| `ServerHangMonitorCfgRo` | 入参（`POST` / `PUT` 共用） | `environment` / `maxDelay` / `maxRuleCost` / `priority` / `alarmCfgRo`（嵌套 `AlarmCfgRo`，复用功能 1 定义，已确认）；**无 `ID`、无审计字段** |
| `ServerHangMonitorCfgDto` | 出参（`list`） | 上列字段 + `lastUpdatedTime` / `lastUpdatedUser`；`alarmCfg` 为嵌套 `AlarmCfgDto`；**不带 `id` / `alarmCfgId` / 审计字段** |

### 4.2 校验（前后端同源）

| # | 规则 | 失败码 |
|---|---|---|
| 1 | `environment` / `maxDelay` / `maxRuleCost` / `priority` **四项必填**（`POST` / `PUT` 同） | `RequireParameterMissing` |
| 2 | `maxDelay` / `maxRuleCost` 为整数，**`> 0` 且 `≤ 65535`** | `ParameterInvalid` |
| 3 | `environment` ∈ Misc `mes.global.environments`、`priority` ∈ Misc `system.global.priority` —— 调 **Misc 的 By Item 查询 Txn** 取值后比对（与功能 1 同一套，不直连 Misc 表） | `EnvironmentNotAllowed` / `PriorityNotAllowed` |
| 4 | `POST`：`environment` **不能已存在**（一环境一行） | `SrvHangMonitorCfgExists` |
| 5 | `PUT` / `DELETE`：`environment` **必须已存在** | `SrvHangMonitorCfgNotFound` |

**实现口径**（对齐功能 1，2026-11-10 确认）：

- 存在性判断统一走 `FvFetchObjectLockTxn`：`POST` 不加锁仅查存在；`PUT` / `DELETE` 加锁，同 `environment` 键串行。
- 事务顺序对齐功能 1：新增先建 `AlarmCfg` 再建本表行；修改原地 `UPDATE` 通知行；删除两表一起删；已产生的告警历史不动。

### 4.3 错误码

`RequireParameterMissing` / `ParameterInvalid` 复用整体库既有码；新增 `SrvHangMonitorCfgExists` / `SrvHangMonitorCfgNotFound`，并复用功能 1 的 `EnvironmentNotAllowed` / `PriorityNotAllowed`。

---

## 5. 已确认口径（配置侧）

| # | 口径 |
|---|---|
| 1 | 表名 **`FabViewerSrvHangMonitorCfg`**；`Environment` 为唯一键（一环境一行） |
| 2 | `Priority` 值域来自 Misc `system.global.priority` |
| 3 | `MaxDelay` / `MaxRuleCost` 为配置的正整数秒数，**取值范围 `> 0` 且 `≤ 65535`**（2026-11-10 确认：上限 65535、下限不含 0） |
| 4 | 接口 4 个：`list`（不分页无条件）/ `POST` / `PUT` / `DELETE`（以 `Environment` 定位）；入参 `ServerHangMonitorCfgRo`、出参 `ServerHangMonitorCfgDto` |
| 5 | 通知复用 `FabViewerAlarmCfg`（`AlarmCfgId` 外联，1:1，无独立通知接口） |
| 6 | 不设 `Enabled`，配置即启用 |
| 7 | 接口前缀 **`/api/v1/srv_hang_monitor`**；`ServerHangMonitorCfgRo` 内**嵌套 `AlarmCfgRo`**（对齐功能 1）（2026-11-10 确认） |
| 8 | 配置页 **`MES Server Hang Monitor Config`**（`config` → 系统配置、菜单级权限）；主界面 = 表格卡片 + **页内编辑卡片**（不用弹窗，与功能 1 不同） |
| 9 | 编辑卡片默认**全部禁用**（仅 `取消` 可用）：`新增` 清空并解除禁用、`修改` 回显并解除禁用、`查看` 只回显不解除；`取消` 清空并回初始态；`确认` 校验后提交并重拉 `list` 回显 |
| 10 | **修改态 `Environment` 锁定不可改**（定位键）；`Max Delay` / `Max Rule Cost` 输入限整数 `1~65535` |
| 11 | **通知配置是公共组件 `AlarmCfgEditor`**（定义归 `01-MES关键字监控配置` §3.4：Interval / Mail / 飞书三段，校验内聚）；本功能编辑卡片右侧直接嵌入，落同一张 `FabViewerAlarmCfg`，无独立通知接口 |

## 6. 待确认（配置侧）

| # | 问题 | 为什么必须问 |
|---|---|---|
| 1 | `MaxDelay` / `MaxRuleCost` 的**现场取值**（Halo 现配多少） | 决定运行时跨层约束（`MaxDelay` < 静默期）能不能满足，反过来约束本表的值域 |

> 运行时侧待确认（报警恢复口径、一个块只报一次的范围、扫描周期、应用形态、报警表归属）见运行时文档 §5。
