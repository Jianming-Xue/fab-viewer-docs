# MES Server Hang 监控 · 配置文档

> 模块 2 · 日志监控与报警 ｜ 功能 2 ｜ 状态：**配置侧定稿**
> 本篇定义配置侧：**一个环境下两个阈值配多少、报几级、通知给谁、启不启用** —— 配置表与通知表的字段、配置页的列表与编辑卡片、配置接口与校验口径。两条判据、扫描、报警落库与通知等运行时见 [`04-MES Server Hang 监控与告警.md`](04-MES%20Server%20Hang%20监控与告警.md)；通知配置公共组件 `AlarmCfgEditor` 的定义见 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §3.4。

## 1. 功能定位

MES 服务 Hang 靠日志块判定：块停写超过 **Max Delay** 秒 ⇒ 报 `Server Hang`；一次 Rule 写日志时长超过 **Max Rule Cost** 秒 ⇒ 报 `Endless Rule`。本功能**只管配置侧** —— 「一个环境下，两个阈值各配多少、报出来的报警算几级、发给谁、启不启用」；判定式、扫描与报警落库、通知在运行时文档展开，不在本篇。

配置侧只需知道两个阈值的语义（一句话，细节见运行时 `04` §2.2）：

| 阈值 | 语义（一句话） | 单位 |
|---|---|---|
| **Max Delay** | Rule 未执行完（块未闭口）就停止写日志，停写超过这个值 ⇒ 报 `Server Hang` | 秒 |
| **Max Rule Cost** | 一次 Rule 的写日志时长超过这个值 ⇒ 报 `Endless Rule`（进行中就报，闭口后看总耗时） | 秒 |

**配置粒度：只看环境名，不需要 Rule Name** —— 该环境下所有块都按这套阈值判；判定口径见 `04` §2.1。

---

## 2. 配置表

**入口**：**`monitor-alarm` 模块 → 一级菜单 `Monitor & Alarm` → 二级菜单 `MES Server Hang Monitor`**，与功能 1 同模块、同一级菜单；权限＝**功能级（到本菜单）+ 三个动作（`Create` / `Update` / `Delete`）**，见 §3.1。

**配置分两张表**：

- **表一 `FvSrvHangMonitorCfg`**（§2.1）—— 环境级阈值本身：环境 + 两个阈值 + 报警等级 + 启用状态 + 关联的通知配置；
- **表二 `FvAlarmCfg`**（§2.2）—— 通知配置：收件人（邮件 / 飞书）+ 汇总发送间隔。**复用功能 1 的表与定义**、**随配置走、不单独维护**：在编辑卡片右侧就地配置，保存时同事务写入，一条配置对应一份（1:1）。

> **一条配置 = 一个环境 = 一行**：`Environment` 唯一。按 Rule Name 分阈值不在本功能范围内。

> 收件人（邮件 / 飞书）**不在阈值表里**，落在 `FvAlarmCfg` 靠 `AlarmCfgId` 关联；但**没有独立配置页和接口** —— 它是配置的附属，在编辑卡片的通知区里一起编辑、一起提交。

### 2.1 表一 · `FvSrvHangMonitorCfg`（环境级阈值）

**结论：一张环境阈值表**，一环境一行，`Environment` 作业务键 UK（`POST` / `PUT` / `DELETE` / `state` 均按它定位，§4.1）。表名与栏位均大驼峰、全项目统一不加引号（不加引号的标识符 Oracle 会转成大写，写 `FvSrvHangMonitorCfg` 与 `FVSRVHANGMONITORCFG` 是同一张表）；统一规范如下，长度 / 可空 / UK 见表内。

**统一规范**：

- **主键 `ID`**：`VARCHAR2(≤50)`、非空；由框架底层赋值，业务侧一律按业务 UK `Environment` 读写、不引用 `ID`（不出参）。
- **审计四字段** `CreatedAt` / `CreatedBy` / `UpdatedAt` / `UpdatedBy`：**由底层统一控制** —— 赋值、`UpdatedAt` / `UpdatedBy` 的刷新与可空性均由框架托管，业务侧不进任何 SQL。
- 列名大驼峰、不加引号（Oracle 自动转大写）；字符串长度按字符校验（避免 `VARCHAR2` 字节语义抛 `ORA-12899`）。

| 字段 | 列名 | 长度 | 可空 | 说明 |
|---|---|---|---|---|
| 主键 | `ID` | ≤50 | 否 | 底层赋值、业务不引用、不出参 |
| 环境名 | `Environment` | ≤30 | 否 | **业务 UK** —— 一环境一行；下拉，候选来自 Misc `mes.global.environments`，前端调 **`GET /api/v1/sys_misc/env/list`**（归属 Misc 模块，本篇只消费） |
| 最大 delay | `MaxDelay` | NUMBER(5) | 否 | 最大 delay（秒），**`1 ~ 65535`** |
| 最大耗时 | `MaxRuleCost` | NUMBER(5) | 否 | 最大写日志耗时（秒），**`1 ~ 65535`** |
| 报警等级 | `Priority` | ≤20 | 否 | `P1` ~ `P4`；**值域来自 Misc `system.global.priority`**（后端读 Misc 校验，前端走 `/api/v1/sys_misc/priority/list` 取候选，见 §4.1「后端校验」第 3 条） |
| 启用状态 | `Enabled` | — | 否 | 布尔；`true` 生效、`false` 停用；**新建默认 `true`**；只由列表开关改（`state` 接口，§3.2 / §4.1-5），不进 Ro |
| 通知配置 | `AlarmCfgId` | ≤50 | 否 | 关联 `FvAlarmCfg.ID` |
| 审计四字段 | `CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy` | — | 见上 | 底层统一赋值、`UpdatedAt` 无条件刷新 |

**业务唯一索引**：`Environment`。

- **`Enabled`**：只有 `true` 的配置生效，`false` 停用但配置保留；停用环境不参与两条判据 —— 运行时每轮重读配置时过滤（§4.3 共性 7 / `04` §7.3）。

### 2.2 表二 · `FvAlarmCfg`（通知配置）

**复用功能 1 的表，不另立、不重复定义**：字段（列名 / 长度 / 可空）与邮件 / 飞书通道口径一律见 [`01-MES关键字监控配置.md`](01-MES关键字监控配置.md) §2.2，本篇不列。

它与主表的关系同 01：**不设名称字段** —— 不是独立业务实体，而是各类监控配置（关键字监控、Hang 监控等）**共用的通知扩展子集**，靠引用它的配置来辨识；**无业务唯一索引** —— 只按 `ID` 被表一 1:1 引用（`FvSrvHangMonitorCfg.AlarmCfgId` → `FvAlarmCfg.ID`），不单独检索；本表不单独展示、也不提供引用下拉，一条配置一份、不允许复用已有配置。

本表随配置走：新增 / 修改 / 删除配置时同事务写它（下方生命周期表），运行时每轮重读、**下一轮生效**。

**通知配置的生命周期（随配置走）**

| 场景 | 口径 |
|---|---|
| 新建配置 | 先插 `FvAlarmCfg` 拿 `ID`，再插本表行，**同一事务** |
| 修改配置 | 按其 `AlarmCfgId` 更新通知配置，再更新本表行，**同一事务**；**原地 UPDATE 通知行，不删不新建** |
| 删除配置 | **连带删除**其 `FvAlarmCfg`（无独立入口，留着就是孤儿）；**已产生的 Alarm 不删** —— 历史报警是证据，不随配置消失 |
| 复用已有配置 | **不允许** —— 一条配置一份，页面不提供「选择已有配置」 |

---

## 3. 配置页

### 3.1 菜单位置与权限

| 项 | 内容 |
|---|---|
| 一级菜单 | **`Monitor & Alarm`**（与功能 1 相同） |
| 二级菜单 | **`MES Server Hang Monitor`** |
| 本页 | **`Config`** —— 菜单内就显示 `Config` |
| 挂载位置 | **`monitor-alarm`** 模块下（与功能 1 相同） |
| 权限方式 | **功能级（到本菜单）+ 三个动作权限点**（`Create` / `Update` / `Delete`），见下表 |

**权限点**

| # | 权限点 | 标识 | 限制行为 |
|---|---|---|---|
| 1 | **功能级（菜单）** | — | 二级菜单 `MES Server Hang Monitor` / 本页 `Config` 入口；有菜单权限才可进入、使用本页 |
| 2 | **「新增」** | `Create` | 控制新增配置；有权限可新增、无权限禁止新增 |
| 3 | **「修改」** | `Update` | 控制修改配置与启用 / 停用开关（同一动作）；有权限可改、无权限禁止 |
| 4 | **「删除」** | `Delete` | 控制删除配置；有权限可删、无权限禁止 |

读类（列表 / 查看）不单独设权限，进入本菜单即可查看。

### 3.2 主界面

单页自上而下两个卡片，**没有查询卡片**（`list` 全量返回、无条件不分页，数据量 = 配置过的环境数，无需搜索）。

**① 表格卡片**

- 进入页面即调 `GET /api/v1/srv_hang_monitor/cfg/list` 渲染全部数据；`刷新` 按钮按当前数据重调同一接口。
- 工具栏：右侧 `新增` 主按钮（受「新增」`Create` 管控，有权限可新增、无权限禁止）、`刷新` 按钮（按当前数据重调 `list`，不控权）。
- 表格列（顺序固定）：

| # | 列 | 内容 |
|---|---|---|
| 1 | Environment | 原样显示；唯一键 |
| 2 | **Enabled** | **开关**，取行 `enabled`；紧跟 `Environment` 之后 |
| 3 | Max Delay | 数字 + `s` 后缀（秒） |
| 4 | Max Rule Cost | 数字 + `s` 后缀（秒） |
| 5 | Priority | `P1`~`P4` 色标，与功能 1 / 展示页同一套 |
| 6 | Last Updated User | 取 `list` 出参 `lastUpdatedUser` |
| 7 | Last Updated Time | `yyyy-MM-dd HH:mm:ss`，取 `list` 出参 `lastUpdatedTime` |
| 8 | 操作 | `修改` / `查看` / `删除`（`修改` 受「修改」`Update`、`删除` 受「删除」`Delete` 管控，有权限可操作、无权限禁止；`查看` 进入本菜单即可） |

**启用开关（第 2 列）**

| 项 | 口径 |
|---|---|
| 呈现 | 开关，取行 `enabled`；紧跟 `Environment` 之后；停用行仍留在列表里（列表不过滤） |
| 权限 | 受「修改」`Update` 管控（与行内修改同一动作），有权限可操作、无权限禁止 |
| 点击 | **先弹 Warning 提示框**（确认 / 取消），不直接改状态；确认才调 **`POST /api/v1/srv_hang_monitor/cfg/state?environment=&enabled=<目标值>`**（§4.1-5） |
| 取消 / 失败 | **开关回弹、该行不动**；失败按错误码清单提示 |
| 成功 | 返回单个 `ServerHangMonitorCfgDto`，按 `environment` **原地刷新该行**（含开关与两个更新时间列），**不重跑 `list`、不跳页** |
| 生效 | 运行时每轮重读配置，**下一轮生效**；提示框不再写「不会立即生效」 |

> 列表按 `Environment` 升序（§4.1-1），不分页。
>
> **删除**：与启用开关同一套 **Warning 提示框**（确认 / 取消）；确认才调 `DELETE`、取消关闭；按钮受「删除」`Delete` 管控，有权限可删、无权限禁止。提示框**不再写「不是立即生效」**（运行时下一轮生效）；已产生的报警一律保留。

**② 编辑卡片**（表格卡片下方，**页内卡片**，不用弹窗 —— 与功能 1 不同）

| 区 | 位置 | 内容 |
|---|---|---|
| 配置区 | 左侧 | `Environment` 下拉（候选来自 Misc `mes.global.environments`，前端调 `GET /api/v1/sys_misc/env/list`）、`Priority` 下拉（候选走 `GET /api/v1/sys_misc/priority/list`）、`Max Delay` 输入框（整数 `1~65535`，单位秒）、`Max Rule Cost` 输入框（同左）。**无 Enabled 控件** —— 启停只在列表开关做 |
| 通知区 | 右侧 | **直接嵌入通知配置公共组件 `AlarmCfgEditor`** —— `Interval` / `Mail` / `飞书` 三段，定义见 `01` §3.4；校验内聚在组件里，本功能不重复实现，回填按组件定义回写 |
| 按钮区 | 卡片右下角 | `取消` + `确认` |

### 3.3 编辑卡片的禁用与回显（核心交互）

| 状态 | 进入方式 | 行为 |
|---|---|---|
| **初始 / 空闲** | 进入页面、或点过 `取消` 后 | 卡片内**全部控件禁用**（含 `确认`），仅 `取消` 按钮可用 |
| **新增** | 点工具栏 `新增`（受「新增」`Create` 管控，有权限可新增、无权限禁止） | 清空全部控件值并**解除禁用**；`Environment` 下拉可选；**`Enabled` 不在卡片里，落库默认 `true`** |
| **修改** | 点操作列 `修改`（受「修改」`Update` 管控，有权限可改、无权限禁止） | **把该行的值回显到编辑卡片**（含通知配置，用列表行数据回填，无需再调接口）并解除禁用；`Environment` **保持锁定不可改** —— 它是定位键，改了等于换一条，要换就删了重建；**开关状态不在卡片里改**（回显时忽略 `enabled`，提交也不带它） |
| **查看** | 点操作列 `查看`（进入本菜单即可） | **只回显**该行的值，其余控件**保持禁用**（含 `确认`，防止误提交）；仅可点 `取消` 退出 |

- `取消`：清空全部控件值 → 恢复**初始态**（全部禁用），不产生任何提交。
- `确认`：先校验（必填 4 项 + 两阈值范围 + 通知间隔 + 邮箱 / webhook 格式，规则同 §4.1 的校验清单），通过后与开关 / 删除一样**先弹 Warning 提示框**（确认 / 取消）—— 确认才提交（**新增走 `POST`、修改走 `PUT`**）、取消关闭不动；成功后重新拉 `list` 回显到列表，并回到初始态。按钮权限与入口一致：新增态受「新增」`Create` 管控、修改态受「修改」`Update` 管控（分别对应 `POST` / `PUT`）。
- 校验不过时就地红字提示，不弹全局错误；保存成功后 toast **不再提示「不会立即生效」**（运行时下一轮生效）。
- 两条交叉校验（关注 / 排除名单交集、排除词是 keyword 子串）是**关键字监控特有**的，本功能无 keyword，不适用；Alarm 区仅校验格式与必填。

---

## 4. 接口

服务内前缀 `/api/v1/srv_hang_monitor`；前端调用加网关前缀 `telemetry-hub`；响应外壳沿用整体库。本篇为全量不分页接口，不使用分页结构。

> Misc 的 `env/list` / `priority/list` **归属 Misc 模块**（`/api/v1/sys_misc`），本功能只消费；规格见 `01` §2.1 / §3.3 / §4.1-6，本篇不重复。

### 4.1 接口清单

| # | 接口 | Method | 用途 | 权限 |
|---|---|---|---|---|
| 1 | `/api/v1/srv_hang_monitor/cfg/list` | `GET` | 全量查询，**不分页、不设查询条件**，按 `Environment` 升序 | 进入本菜单即可 |
| 2 | `/api/v1/srv_hang_monitor/cfg` | `POST` | 新增配置（同事务写通知配置） | 有「新增」`Create` 权限可操作，无则禁止 |
| 3 | `/api/v1/srv_hang_monitor/cfg` | `PUT` | 修改配置（同事务更新通知配置） | 有「修改」`Update` 权限可操作，无则禁止 |
| 4 | `/api/v1/srv_hang_monitor/cfg?environment=` | `DELETE` | 删除配置（`Environment` 作定位参数，连带删通知配置） | 有「删除」`Delete` 权限可操作，无则禁止 |
| 5 | `/api/v1/srv_hang_monitor/cfg/state?environment=&enabled` | `POST` | 启用 / 停用单个环境配置（列表开关，规格见本节 5） | 有「修改」`Update` 权限可操作，无则禁止（与 `PUT` 同一动作） |

> **定位键统一是 `environment`**（唯一索引），不用 `id`：
> - `DELETE` / `state` 用 **query 参数**（无 body，只能走 URL）；
> - `PUT` **不收 query 参数**，定位键 `environment` 就在 `ServerHangMonitorCfgRo` 里（与 `POST` 同一对象），后端按它找记录、**且不改这一列的值**（改了等于换一条，不允许）。
>
> **通知配置没有独立接口** —— 不收 `alarmCfgId` 入参，也不暴露 `/alarm_cfg/*`，全部随配置的写操作在同一事务内完成；权限随所在写动作（`POST` 随「新增」、`PUT` / `state` 随「修改」、`DELETE` 随「删除」）。

**1 · `list`（GET）** 无入参；出参 `data` = `List<ServerHangMonitorCfgDto>`；**全量、不过滤 `Enabled`** —— 停用配置仍出现在列表里供启停与查看。

**2 · `POST`** 入参 `ServerHangMonitorCfgRo` → 校验 → 唯一性检查 → **事务内**插 `AlarmCfg` 拿 ID、插配置行 → 回 `ServerHangMonitorCfgDto`。**`Enabled` 不接受入参，落库默认 `true`**。

**3 · `PUT`** 入参 `ServerHangMonitorCfgRo`（与 `POST` 同一对象，**`environment` 作为定位键必传**）→ 按它查库，不存在 ⇒ 拒 → 校验 → **事务内**按该配置的 `AlarmCfgId` 更新通知配置、更新配置行 → 回 `ServerHangMonitorCfgDto`。**定位键只用于查记录、不进 `UPDATE` 的列**；**`ENABLED` 也不在更新列里** —— 弹框不碰启停。

**4 · `DELETE`** 按 query 的 `environment` 定位 → **事务内**删配置、删其 `AlarmCfg` → 成功返空。**已产生的 Alarm 一律保留**。

**5 · `state`（POST）** 入参走 query：`environment`（定位键）+ `enabled`（布尔，目标状态）。按定位键加锁查对象，查不到 ⇒ `SrvHangMonitorCfgNotFound`；事务内**只更新主表 `ENABLED` 一列**，不动 `FvAlarmCfg`、不动定位键。出参 `data` = **单个 `ServerHangMonitorCfgDto`**（与 `list` 行同构，含 `enabled` 与两个展示字段），供列表原地刷新该行。权限：有「修改」`Update` 权限可操作、无则禁止（与 `PUT` 同一动作）。

**后端校验（6 条，前后端同源）**

1. `environment` / `maxDelay` / `maxRuleCost` / `priority` **四项必填**（`POST` / `PUT` 同）；
2. `maxDelay` / `maxRuleCost` 为整数且落在 **`1 ~ 65535`**；
3. `environment` ∈ Misc `mes.global.environments`、`priority` ∈ Misc `system.global.priority` —— 调 `shared-business-lib` 库 utility 的 **`FetchEnvFromSystemMisc()`** / **`FetchPriorityFromSystemMisc()`**，**均输入为空、输出 `string[]`**；**不直连 Misc 表、不复刻解析逻辑**（对齐功能 1）；
4. `POST`：`environment` **不能已存在**（一环境一行）；
5. `PUT` / `DELETE` / `state`：`environment` **必须已存在**；
6. 通知配置：`notifyInterval` 为整数且 **`1 ~ 99999`**，`mailToUsers` / `mailCCUsers` **逐个**校验邮箱格式、`feishuWebhooks` **逐个**校验机器人地址格式，任一不合规 ⇒ `ParameterInvalid`（三项名单均可为空，空则跳过校验）。

### 4.2 出入参对象

**`ServerHangMonitorCfgRo`（入参，`POST` / `PUT` 共用）**

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `environment` | string | 是 | ≤30，须在 Misc 值域内；**定位键**，`PUT` 不改其值 |
| `maxDelay` | int | 是 | 整数 **`1 ~ 65535`** |
| `maxRuleCost` | int | 是 | 整数 **`1 ~ 65535`** |
| `priority` | string | 是 | 须在 Misc 值域内 |
| `alarmCfg` | `AlarmCfgRo` | 是 | 嵌套，定义见 `01` §4.2；本功能同形复用 |

> **`enabled` 不在 Ro 里** —— 新建默认 `true`，之后只由 `state` 接口改；编辑卡片新增 / 修改都不碰这一列。
> **`alarmCfg`** 为入参字段名（类型是 `AlarmCfgRo`），与功能 1 的 `LogMonitorCfgRo` 同构；出参同名字段为 `AlarmCfgDto`。

**`AlarmCfgDto` / `AlarmCfgRo`（嵌套出参 / 入参，同形）**

字段 `mailToUsers` / `mailCCUsers` / `feishuWebhooks` / `feishuAtUsers` / `notifyInterval`，定义与校验见 `01` §4.2，本篇不重复。

**`ServerHangMonitorCfgDto`（出参，`list` / `POST` / `PUT` / `state` 同形）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `environment` | string | 环境名 |
| `maxDelay` | int | 最大 delay（秒） |
| `maxRuleCost` | int | 最大耗时（秒） |
| `priority` | string | `P1` ~ `P4` |
| `enabled` | boolean | `true` 生效 / `false` 停用；列表开关取它 |
| `alarmCfg` | `AlarmCfgDto` | 嵌套通知配置 |
| `lastUpdatedTime` | string | 审计 `updatedAt` 有值取它，为空取 `createdAt` |
| `lastUpdatedUser` | string | 审计 `updatedBy` 有值取它，为空取 `createdBy` |

> **不带 `id` / `alarmCfgId` / 四个审计字段** —— 技术键不出参，通知配置的定位完全在后端（按配置的 `AlarmCfgId` 就地更新）；更新时间只以 `lastUpdatedTime` / `lastUpdatedUser` 两个字段对外。
> 两个展示字段在 **`list` 与 `state` 出参里必填**（列表列用、`state` 成功后原地刷新该行时用）；`POST` / `PUT` 回的单条对象保留字段结构，值为空也允许。

**响应示例（单条，`state` / `POST` / `PUT` 的 `data` 同形；`list` 的 `data` 为同形数组）**

```json
{
  "code": "OK", "success": 1, "errMsg": "", "txId": "3f9c1b7e2a4d",
  "data": {
    "environment": "PROD",
    "maxDelay": 120,
    "maxRuleCost": 300,
    "priority": "P1",
    "enabled": true,
    "alarmCfg": {
      "mailToUsers": ["ops@fab.com", "dba@fab.com"],
      "mailCCUsers": ["lead@fab.com"],
      "feishuWebhooks": ["https://open.feishu.cn/open-apis/bot/v2/hook/xxxx"],
      "feishuAtUsers": ["ou_5d3c…"],
      "notifyInterval": 5
    }
  }
}
```

### 4.3 实现逻辑（逐接口）

**八条共性约定**（下面各接口不再重复）

1. 响应外壳：`code` 成功恒 `OK`、失败为 PascalCase 业务码，`success` 输出 `0` / `1`，`errMsg` 成功为空串。
2. `ID` 与四个审计字段**全部由底层赋值**，不进任何 Ro；`updatedAt` / `updatedBy` 每次写操作无条件刷新。
3. 字符串长度一律**按字符**校验（先校验、再落库，避免 `VARCHAR2` 字节语义抛 `ORA-12899`）；`trim` 后为空视同未传。
4. 两个整数阈值先按整数解析再判 `1 ~ 65535`；`notifyInterval` 同理判 `1 ~ 99999`；非整数 ⇒ `ParameterInvalid`。
5. 事务边界：一条写接口 = 一个事务（`POST` / `PUT` / `DELETE` 带通知表，`state` 只动主表）；`AlarmCfg` 的 ID 在同一事务内生成。
6. **存在性与锁**：`POST` 需**校验对象是否已存在**（不加锁）；`PUT` / `DELETE` / `state` 需**校验对象存在并对 `environment` 加锁**（查到即持锁，同键写操作串行）。**不指定具体公共方法名**，实现层按此语义选型。
7. **启停的生效路径**：`list` 全量返回、`Enabled` 只是行上的一个状态；运行时告警服务**每轮重读配置，只取 `Enabled = true` 的行**，停用环境不进本轮环境集合、不参与两条判据（见 `04` §7.3）。不缓存、不热加载，删改与启停都**下一轮生效**。
8. 权限：功能级到本菜单，进入菜单即可查（`list`）；写动作 `POST` 要「新增」`Create`、`PUT` / `state` 要「修改」`Update`、`DELETE` 要「删除」`Delete`，有权限可操作、无权限禁止。

**1 · `list`**

| 步骤 | 动作 |
|---|---|
| ① | 无入参；不分页、不设查询条件，全量返回 |
| ② | 主 SQL：`FvSrvHangMonitorCfg m LEFT JOIN FvAlarmCfg a ON m.ALARM_CFG_ID = a.ID`，**`ORDER BY m.ENVIRONMENT ASC`** |
| ③ | 出参仍**以主表行为准去重**，防止连接意外产生重复行（主表数据不重复是前提）；**不过滤 `Enabled`**，停用行照样返回 |
| ④ | 行映射：主表字段直出；**没有通知行（1:0）⇒ `alarmCfg = null`**；`lastUpdatedTime` / `lastUpdatedUser` 按 Dto 口径填 |

**2 · `POST`**

| 步骤 | 动作 |
|---|---|
| ① | **必填校验（4 项）**：`environment` / `maxDelay` / `maxRuleCost` / `priority` 任一为空或空白 ⇒ `RequireParameterMissing`；顺带校验两阈值（`1~65535`）、`notifyInterval`（`1~99999`，缺省补 **5**）、邮箱 / webhook 逐个格式校验（可空，空则跳过），超限或不合规 ⇒ `ParameterInvalid` |
| ② | **值域校验（调 `shared-business-lib` 库 utility 的公共方法）**：环境候选调 `FetchEnvFromSystemMisc()`、等级候选调 `FetchPriorityFromSystemMisc()`，均输入为空、输出 `string[]`；**不直连 Misc 表、不复刻解析逻辑**；不在值域（含未配、集合为空）⇒ `EnvironmentNotAllowed` / `PriorityNotAllowed` |
| ③ | **存在性校验**：按 `environment` 校验对象是否已存在（**不加锁**）—— 已存在 ⇒ 不允许创建（`SrvHangMonitorCfgExists`）；库层唯一索引兜底，捕获约束冲突转同一业务码（防并发穿透） |
| ④ | 事务：**先建通知对象** —— 生成 `AlarmCfg.ID` → INSERT `FvAlarmCfg` → 拿到 `ALARM_CFG_ID`；**再建配置对象** —— 生成本表 `ID` → INSERT `FvSrvHangMonitorCfg`（带该 `ALARM_CFG_ID`），**`ENABLED` 取默认 `true`** → 提交 |
| ⑤ | 回参：按 `environment` 单条重查一次并映射，**不回显入参**，保证与库内真实值一致（含默认值补全） |

**3 · `PUT`**

| 步骤 | 动作 |
|---|---|
| ① | `environment` 必填（**定位键**）；缺失 ⇒ `RequireParameterMissing` |
| ② | **加锁查对象**：按 `environment` 校验存在并**加锁** —— 与 `DELETE` / `state` 同一把键锁、同键串行；查不到 ⇒ 未创建不允许修改（`SrvHangMonitorCfgNotFound`） |
| ③ | 必填（4 项）与值域校验同 `POST` ①②，**跳过唯一性**（定位键不可改，天然不冲突）；通知格式同源校验 |
| ④ | 事务：取本行 `ALARM_CFG_ID` → **UPDATE 通知行**（按该 ID 原地改全字段，不删不新建；仅当该 ID 为空 / 通知行缺失的历史脏数据才补插一行并回写）→ UPDATE 配置行（`SET` 不含 `ENVIRONMENT` / `ID` / `ENABLED` / 审计）→ 提交 |
| ⑤ | 回参：同 `POST` ⑤，重查后映射 |

**4 · `DELETE`**

| 步骤 | 动作 |
|---|---|
| ① | `environment` 必填；缺失 ⇒ `RequireParameterMissing` |
| ② | **加锁查对象**：按 `environment` 校验存在并**加锁** —— 与 `PUT` / `state` 同一把键锁、同键串行；查不到 ⇒ 未创建不允许删除（`SrvHangMonitorCfgNotFound`） |
| ③ | 事务：**通知行与配置行一起删** —— 按本行 `ALARM_CFG_ID` 删 `FvAlarmCfg` → 删 `FvSrvHangMonitorCfg` → 提交 |
| ④ | **已产生的 Alarm 一律不动**（运行时的历史数据与本表无外键关系） |
| ⑤ | 回参：`data` 为空 |

**5 · `state`**

| 步骤 | 动作 |
|---|---|
| ① | `environment` / `enabled` 缺失或空白 ⇒ `RequireParameterMissing`；`enabled` 非布尔 ⇒ `ParameterInvalid`；**`enabled=false` 是合法目标值，不算缺失** |
| ② | 按 `environment` 校验存在并**加锁**（与 `PUT` / `DELETE` 同一把键锁）；查不到 ⇒ `SrvHangMonitorCfgNotFound` |
| ③ | 事务：**只 `UPDATE FvSrvHangMonitorCfg SET ENABLED = :enabled`**（不动通知表、不动定位键），审计列由底层刷新 → 提交 |
| ④ | 按单条重查的同一映射函数回一个 `ServerHangMonitorCfgDto`（含 `enabled` 与两个展示字段）；前端按 `environment` 原地替换该行，**不重跑 `list`** |

**错误码清单（本篇涉及 6 个）**

| `code` | 触发 | 前端表现 |
|---|---|---|
| `RequireParameterMissing` | 必填项缺失 / 空白（含 `state` 的 `environment` / `enabled` 缺失） | 定位到字段的红字提示 / 开关回弹 |
| `ParameterInvalid` | 两阈值非整数或超 `1~65535`、`enabled` 非布尔、`notifyInterval` 超 `1~99999`、邮箱 / webhook 格式不合规 | 定位到字段的红字提示 |
| `SrvHangMonitorCfgExists` | `environment` 已存在（创建时） | 提示「该环境已配置」 |
| `SrvHangMonitorCfgNotFound` | `PUT` / `DELETE` / `state` 时该 `environment` 未创建 | 提示后刷新列表 |
| `EnvironmentNotAllowed` / `PriorityNotAllowed` | 值不在 Misc 值域内（含 Misc 未配） | 提示去 System Misc 先配候选值 |

> `RequireParameterMissing` / `ParameterInvalid` 复用整体库既有码；`SrvHangMonitorCfgExists` / `SrvHangMonitorCfgNotFound` 为本篇新增；`EnvironmentNotAllowed` / `PriorityNotAllowed` 复用功能 1 新增码。
> 值域校验逻辑**只实现一份**（`POST` / `PUT` 共用的校验函数），内部统一调 `FetchEnvFromSystemMisc()` / `FetchPriorityFromSystemMisc()`。

---

## 5. 待确认

（无）
