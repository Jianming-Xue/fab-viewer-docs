# MES 关键字监控 · 配置文档

## 1. 功能定位

MES 运行时会产生各种错误 —— 比如日志里出现 `ORA-` 就是 Oracle 报错。这类错误散在海量日志里，靠人翻看不现实。本功能**定时扫描日志**，命中预设关键字就生成 Alarm 并通知到人（扫描与判定逻辑见运行时文档，不在本篇展开）。

## 2. 配置表

**入口**：**`monitor-alarm` 模块 → 一级菜单 `Monitor & Alarm` → 二级菜单 `MES Log Keyword Monitor`**，与查看处置页（`View & Resolve`）同属这一个二级菜单；权限＝**功能级（到本菜单）+ 三个动作（`Create` / `Update` / `Delete`）**，见 §3.1。

**配置分两张表**：

- **表一 `FvLogMonitorCfg`**（§2.1）—— 监控规则本身：环境 + 规则名 + 关键字 + 三个检查名单 + 报警等级 + 启用状态 + 关联的通知配置；
- **表二 `FvAlarmCfg`**（§2.2）—— 通知配置：收件人（邮件 / 飞书）+ 汇总发送间隔。**随规则走、不单独维护**：在规则弹框里就地配置，保存时同事务写入，一条规则对应一份（1:1）。

> **一条配置 = 一个规则 = 一个关键字**：`Item + Environment` 唯一。要监控多个关键字就建多条配置（规则名各不相同）。

> 收件人（邮件 / 飞书）**不在规则表里**，落在 `FvAlarmCfg` 靠 `AlarmCfgId` 关联；但**没有独立的配置页和接口** —— 它是规则的附属，在规则弹框的「通知」区块里一起编辑、一起提交。

表名与栏位均大驼峰、全项目统一不加引号（不加引号的标识符 Oracle 会转成大写，写 `FvLogMonitorCfg` 与 `FVLOGMONITORCFG` 是同一张表）；两张表统一规范如下，长度 / 可空 / UK 见表内。

**两张表统一规范**：

- **主键 `ID`**：`VARCHAR2(≤50)`、非空；由框架底层赋值。表一的 `ID` 业务侧一律不引用（按业务 UK `Item + Environment` 读写、不出参）；表二的 `ID` 仅作表一 `AlarmCfgId` 的内部关联键，两边都不对外（§4.2 出参不带 `id` / `alarmCfgId`）。
- **审计四字段** `CreatedAt` / `CreatedBy` / `UpdatedAt` / `UpdatedBy`：**由底层统一控制** —— 赋值、`UpdatedAt` / `UpdatedBy` 的刷新与可空性均由框架托管，业务侧不进任何 SQL。
- 列名大驼峰、不加引号（Oracle 自动转大写）；**业务时间列**统一 `TIMESTAMP(3)`（毫秒，与本模块其他表一致；审计字段除外）；字符串长度按字符校验（避免 `VARCHAR2` 字节语义抛 `ORA-12899`）。

### 2.1 表一 · `FvLogMonitorCfg`（监控规则）

| 字段 | 列名 | 长度 | 可空 | 说明 |
|---|---|---|---|---|
| 主键 | `ID` | ≤50 | 否 | 底层赋值、业务不引用、不出参 |
| 规则名称 | `Item` | ≤30 | 否 | 规则标识名，如 `PROD-ORA-EXCEPTION`；汇总表按「环境名 + 规则名称」分组 → **一条规则占一行** |
| 环境名 | `Environment` | ≤30 | 否 | 下拉，候选来自 Misc `mes.global.environments`，前端调 **`GET /api/v1/sys_misc/env/list`**（归属 Misc 模块，本篇只消费） |
| 关键字 | `Keyword` | ≤30 | 否 | **一条配置一个关键字**；不限字符类型 |
| 描述 | `Description` | ≤255 | 是 | 这条规则是干什么的，给人看 |
| 排除关键字 | `ExcludeKeywords` | ≤4000 | 是 | JSON 数组，**词级**黑名单 |
| 关注 Rule Name | `FollowRuleNames` | ≤4000 | 是 | JSON 数组，**Rule 级**白名单 —— 配了则**只有**命中名单内的 Rule Name 才告警 |
| 排除 Rule Name | `ExcludeRuleNames` | ≤4000 | 是 | JSON 数组，**Rule 级**黑名单 |
| 报警等级 | `Priority` | ≤20 | 否 | `P1` ~ `P4`；**值域来自 Misc `system.global.priority`**（后端读 Misc 校验，前端走 `/api/v1/sys_misc/priority/list` 取候选，见 §4.1-6） |
| 启用状态 | `Enabled` | NUMBER(1) | 否 | 布尔：**`true`（库中 `1`）= 启用、非 `true` = 未启用**（`0` / `NULL` 等一律未启用，防止误用）；**新建默认 `true`**；只由列表开关改（`state` 接口），不进 Ro |
| 通知配置 | `AlarmCfgId` | ≤50 | 否 | 关联 `FvAlarmCfg.ID` |
| 审计四字段 | `CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy` | — | 见上 | 底层统一赋值、`UpdatedAt` 无条件刷新 |

**业务唯一索引**：`Item + Environment`。

- **新增 `Enabled`**：只有 `true` 的规则启用，非 `true` 未启用但配置保留；启停走列表开关（§3.2 / §4.1-7 `state` 接口）。
- 三个 JSON 数组字段的**长度按字符**校验（≤4000），元素个数不单独卡上限；空/未配置存 `NULL`。
- 改表后**不缓存、不热加载**：运行时每轮重读这张表，新增 / 修改 / 删除 / 启停都**下一轮生效**（`02` §6.2）。

### 2.2 表二 · `FvAlarmCfg`（通知配置）

**它不设名称字段** —— 不是独立业务实体，而是各类监控配置（关键字监控、Hang 监控等）**共用的通知扩展子集**，靠引用它的配置来辨识。

| 字段 | 列名 | 长度 | 可空 | 说明 |
|---|---|---|---|---|
| 主键 | `ID` | ≤50 | 否 | 底层赋值；仅被表一按 `AlarmCfgId` 内部关联，不出参 |
| 收件人 | `MailToUsers` | ≤4000 | 是 | JSON 数组，收件人邮箱；**为空 ⇒ 邮件不发** |
| 抄送 | `MailCCUsers` | ≤4000 | 是 | JSON 数组，抄送邮箱；CC 不顶替收件人 |
| 飞书群与 @ 人 | `FeishuGroups` | ≤4000 | 是 | JSON map（Key Value）：**key = 群机器人 webhook 地址**（字符串），**value = 该群要 @ 的人的 open_id** —— 一个人写 string、多个人写 string 数组（人在该群才生效）；可空 |
| 通知间隔 | `NotifyInterval` | ≤10 | 否 | **整数、单位分钟**，取值 `2 ~ 99999`（**必须 > 1**），默认 **5** |
| 审计四字段 | `CreatedAt`/`CreatedBy`/`UpdatedAt`/`UpdatedBy` | — | 见上 | 底层统一赋值、`UpdatedAt` 无条件刷新 |

**无业务唯一索引** —— 只按 `ID` 被表一 1:1 引用，不单独检索。

> 无 `Item` / `Description`：本表不单独展示、也不提供引用下拉 —— 一条规则一份、不允许复用已有配置（生命周期表下一条）。
> 本表随规则走：新增 / 修改 / 删除规则时同事务写它（下方生命周期表），运行时每轮重读、**下一轮生效**（`02` §6.2）。

**邮件通道口径**

- **`MailToUsers` 为空 ⇒ 邮件不发**（CC 只是抄送，不顶替收件人；只填 CC 不填 To 就等于不发邮件）。
- `MailToUsers` 非空时，CC 可为空；CC 里的人只收副本。
- 邮件失败不影响飞书发送，两者各自按结果记日志。

**飞书通道口径（方案 A · 群自定义机器人）**

- 只走 **webhook**：`FeishuGroups` 的一个 key 就是一个群机器人地址（一个地址对应一个群），**一份配置可填多个 key**，逐个 key 各发一条汇总消息、各自 @ 该 key 下的人（同一群内是一条）。
- 每个 key 的 value 是**该群要 @ 的人的 open_id**：一个人写 string、多个人写 string 数组；@ 的人**必须在这个群里**才生效（消息照发）。
- **不支持私聊单个用户**（群自定义机器人无用户身份，官方明确不能调 `im/v1/messages`）。
- 多群发送**互不影响**：某个群失败重试一次，仍失败只记日志、不阻断其他群；全失败才按发送失败上报。
- 底层 app 凭证 / 群配置已就绪，本表只管「发到哪些群、每个群 @ 谁」。

**通知配置的生命周期（随规则走）**

| 场景 | 口径 |
|---|---|
| 新建规则 | 先插 `FvAlarmCfg` 拿 `ID`，再插规则，**同一事务** |
| 修改规则 | 按其 `AlarmCfgId` 更新通知配置，再更新规则，**同一事务** |
| 删除规则 | **连带删除**其 `AlarmCfg`（无独立入口，留着就是孤儿）；**已产生的 Alarm 不删** —— 历史报警是证据，不随配置消失 |
| 复用已有配置 | **不允许** —— 一条规则一份，页面不提供「选择已有配置」 |

---

## 3. 配置页

### 3.1 菜单位置与权限

| 项 | 内容 |
|---|---|
| 一级菜单 | **`Monitor & Alarm`** |
| 二级菜单 | **`MES Log Keyword Monitor`**（与查看处置页同属这一个二级菜单） |
| 本页 | **`Config`** —— 菜单内就显示 `Config`；同级的查看处置页显示 `View & Resolve` |
| 挂载位置 | **`monitor-alarm`** 模块下 |
| 权限方式 | **功能级（到本菜单）+ 三个动作权限点**（`Create` / `Update` / `Delete`），见下表 |

**权限点**

| # | 权限点 | 标识 | 限制行为 |
|---|---|---|---|
| 1 | **功能级（菜单）** | — | 二级菜单 `MES Log Keyword Monitor` / 本页 `Config` 入口；有菜单权限才可进入、使用本页 |
| 2 | **「新增」** | `Create` | 控制新增规则；有权限可新增、无权限禁止新增 |
| 3 | **「编辑」** | `Update` | 控制编辑规则与启用 / 停用开关（同一动作）；有权限可改、无权限禁止 |
| 4 | **「删除」** | `Delete` | 控制删除规则；有权限可删、无权限禁止 |

读类（列表 / 详情）不单独设权限，进入本菜单即可查看。

### 3.2 主界面

页面为**单栏**，查询条件放顶部。

**查询卡片（上）**

| 元素 | 内容 |
|---|---|
| `keyword` 输入框 | 单个输入框，入参名 `keyword`；对 `item` / `description` / `environment` / `keyword` **四栏位前后模糊匹配（不区分大小写）**，任一命中即返回 |
| `查询` 按钮 | 点击调 `page`（§4.1-1） |
| 其他 | 不设独立的环境筛选下拉、不设重置按钮（清空输入框再点查询即全量） |

**表格卡片（下）**

工具栏：右侧 `新增` 主按钮（受「新增」`Create` 管控，有权限可新增、无权限禁止）、`刷新` 按钮（按当前查询条件重跑 `page`，不控权）。

表格列（顺序固定）：

| # | 列 | 内容 |
|---|---|---|
| 1 | Environment | 原样显示 |
| 2 | Item | 取行 `item` |
| 3 | **Enabled** | **开关**，取行 `enabled`；紧接在 `Environment` / `Item` 两栏位之后 |
| 4 | Description | 取行 `description` |
| 5 | Keyword | 取行 `keyword` |
| 6 | Follow Rule Name | 多值栏位 |
| 7 | Exclude Keywords | 多值栏位 |
| 8 | Exclude Rule Names | 多值栏位 |
| 9 | Priority | `P1`~`P4` 色标（P1 红 / P2 橙 / P3 黄 / P4 灰） |
| 10 | Last Updated User | 取 `page` 出参 `lastUpdatedUser` |
| 11 | Last Updated Time | `yyyy-MM-dd HH:mm:ss`，取 `page` 出参 `lastUpdatedTime` |
| 12 | 操作 | `编辑` / `删除`（分别受「编辑」`Update` / 「删除」`Delete` 管控，有权限可操作、无权限禁止） |

**启用开关（第 3 列）**

| 项 | 口径 |
|---|---|
| 呈现 | 开关，取行 `enabled`；紧跟在 `Environment` / `Item` 两栏位之后；受「编辑」`Update` 管控（与行内编辑同一动作），有权限可操作、无权限禁止 |
| 点击 | **先弹 Warning 提示框**（确认 / 取消），不直接改状态；确认才调 `POST /api/v1/log_monitor/cfg/state?item=&environment=&enabled=<目标值>`（§4.1-7） |
| 取消 / 失败 | **开关回弹、该行不动**；失败按错误码清单提示 |
| 成功 | 返回单个 `LogMonitorCfgDto`，按 `item + environment` **原地刷新该行**（含开关与两个更新时间列），不重跑 `page`、不跳页 |
| 生效 | 运行时每轮重读配置，**下一轮生效**；提示框不再写「不会立即生效」 |

> 分页条沿用分页组件默认值；列表按 `Environment + Item` 升序（§4.1-1）。
>
> **删除**：与启用开关同一套 **Warning 提示框**（确认 / 取消）；确认才调 `DELETE`、取消关闭。提示框**不再写「不是立即生效」**（运行时下一轮生效）；已产生的 Alarm 一律保留。
>

### 3.3 规则弹框（新增 / 修改同一组件 · **Tab 两页**）

一个弹框、两个 Tab：**`Keyword 配置` → `Alarm 配置`**。新增与修改共用；修改态下 `Environment` / `Item` 锁定（定位键，不可改）。

**Tab 1 · Keyword 配置**

| 字段 | 控件 | 校验 |
|---|---|---|
| Environment | 下拉 | 必填；候选来自 Misc `mes.global.environments`，前端调 **`GET /api/v1/sys_misc/env/list`**；**编辑态锁定**（与 Item 共同构成定位键） |
| Item | 输入框 | 必填 **≤30 字符**；**只允许下划线 `_`、中划线 `-`、大小写字母、数字**（`^[A-Za-z0-9_-]{1,30}$`）；**编辑态锁定不可改** —— 要换就删了重建 |
| Keyword | 输入框 | 必填 **≤30 字符**；**不限字符类型** |
| Description | **多行文本域** | ≤255，可空 |
| Priority | 下拉 | 必填；候选来自 `/api/v1/sys_misc/priority/list`（§4.1-6） |
| Follow Rule Name | **多字符串输入控件**（回车成条、可逐条删） | 序列化后 ≤4000；与 Exclude Rule Names **不得有交集** |
| Exclude Keywords | 多字符串输入控件 | 序列化后 ≤4000；任一元素**不得是 `keyword` 的子串（含相等）** |
| Exclude Rule Names | 多字符串输入控件 | 序列化后 ≤4000 |

**底部（Tab 1）**：`取消` + `Next`（右）。点 `Next` **先校验本页**（必填 / 长度 / Item 字符集 / 两条交叉校验），通过才切到 Tab 2；不通过就地红字、**停在当前页**。

**Tab 2 · Alarm 配置**（落 `FvAlarmCfg`，随规则一起提交）

内容区直接嵌入**通知配置公共组件 `AlarmCfgEditor`**（定义见 §3.4），无 Tab 2 专属控件；**字段校验与取值基于该组件，回填按组件定义回写**（§3.4）。

**底部（Tab 2）**：`Previous`（位于 `取消` **之前**）+ `取消` + `确认`（占据 Tab 1 里 `Next` 的位置）。

- `Previous`：回 Tab 1（`Keyword 配置`），**保留已填值、不重复校验**；回到 Tab 1 后底部按钮组**恢复为 `取消` + `Next`**（`Previous` / `确认` 不再出现）。`取消`：关弹框，有改动时二次确认丢弃。
- `确认`：校验本页（**通知间隔 2~99999（必须 >1）**、**邮箱格式逐个校验**、**`feishuGroups` 的 webhook 与 open_id 格式**，校验规则由组件自带）后，与开关 / 删除一样**先弹 Warning 提示框**（确认 / 取消）—— 确认才提交（**新增走 `POST`、修改走 `PUT`**）、取消关闭不动；成功后关弹框，新增刷新回第 1 页、修改原地替换该行。
- 保存成功后 **toast 不再提示「不会立即生效」** —— 运行时每轮重读配置，删改与启停都**下一轮生效**（口径见 `02` §6.2）。

> 两条交叉校验**前端先做一遍**（在 Tab 1 即时红字，不等 Next），后端再兜一次，两者同源（§4.3「写接口的交叉校验」）。

### 3.4 通知配置公共组件 `AlarmCfgEditor`

`Interval` + `Mail` + `飞书` 三段的**公共通知配置组件**，模块 2 内所有带通知的配置界面一律直接嵌入本组件，不各自实现：

| 消费方 | 嵌入位置 |
|---|---|
| 功能 1 · MES Log Keyword Monitor（Config） | 规则弹框 Tab 2 `Alarm 配置`（§3.3） |
| 功能 2 · MES Server Hang Monitor（`Config` 页） | 编辑卡片右侧通知区（`03-配置文档` §3.2） |

内容区**从上到下用分割符分成三段**：

**① 通知间隔**（最上，独立一段，无分割标题）

| 字段 | 控件 | 校验 |
|---|---|---|
| 通知间隔（分） | 输入框 | **必填**；仅整型数字，**`2 ~ 99999`（必须 > 1）**；默认 **5**；≤1 / 超上限 / 非整数 ⇒ 就地红字 |

**② ── 邮件通知 ──**

| 字段 | 控件 | 校验 |
|---|---|---|
| 收件人 To | 多字符串输入控件 | 可空；**提交时**逐个校验邮箱格式，不合规 ⇒ 报错定位到该条、**阻断提交** |
| 抄送 CC | 多字符串输入控件 | 同上 |

**③ ── 飞书通知 ──**

| 字段 | 控件 | 校验 |
|---|---|---|
| 飞书群与 @ 人 | **Key Value 组件**：key 填群 webhook，value 填该群要 @ 的人的 open_id | 可空；key 须匹配群机器人地址格式 `https://open.feishu.cn/open-apis/bot/v2/hook/…`，value 须是 `ou_` 开头的 open_id（一个值 string、多个值 string 数组）；不合规 ⇒ 阻断提交 |

> 组件里**一行一个群**：左边 key 是 webhook 地址，右边 value 是这群要 @ 的人 —— 只有一个 open_id 时按字符串填，多个按数组填。key 唯一（同一 webhook 不重复），不同群各占一行。

**组件级约定**：

> **除「通知间隔」外全部可空** —— 邮件两栏都空、飞书 Key Value 组件留空也允许保存（等于这条配置只落库、不发通知）。
> 飞书 Key Value 组件下方常驻灰字提示：「**@ 的人必须在对应群里**，否则 @ 不生效（消息照发）」。
> 校验全部**内聚在组件里**（必填、范围、邮箱格式、webhook / open_id 格式），消费方只负责取值 / 回填，不重复写校验。**前端已实现**，消费方基于 `AlarmCfgEditor` 完成字段校验与取值。
> **回填按组件定义回写**：`notifyInterval` 回写到**通知间隔输入框**；`mailToUsers` / `mailCCUsers` 回写到**各自对应的字符串集合组件**；飞书内容 **`feishuGroups`**（JSON map：webhook → open_id）按 **Key Value 组件**的定义回写 —— key 回写 webhook、value 回写该群要 @ 的人（单个 string / 多个 string 数组）。
> 组件的值模型即 `AlarmCfgRo` / `AlarmCfgDto`（§4.2），两个消费方同构 —— 落同一张 `FvAlarmCfg`，无独立通知接口。

---

## 4. 接口

### 4.1 接口清单

下表路径是**后端注册路径**（均以 `/api` 开头，后端维持不变）；**前端调用时一律在前面加 `/telemetry-hub` 前缀**（如 `/telemetry-hub/api/v1/log_monitor/cfg/page`），由网关转发时去掉。响应外壳与分页结构沿用整体库。

> 全部接口（含第 6 条 Misc）都在 **telemetry-hub 服务下**，前端调用都加 `/telemetry-hub`；只是**路由前缀不同** —— 第 6 条 `priority/list` 归 **Misc 模块**（`/api/v1/sys_misc`），不属本功能前缀 `/api/v1/log_monitor`，只读 Misc 表；**接口规格写在本篇**（§4.1-6）。

| # | 接口 | Method | 用途 | 权限 |
|---|---|---|---|---|
| 1 | `/api/v1/log_monitor/cfg/page` | `GET` | 分页查询（`keyword` 四栏位模糊） | 进入本菜单即可 |
| 2 | `/api/v1/log_monitor/cfg/detail?item=&environment=` | `GET` | 详情（编辑回填，含通知配置） | 进入本菜单即可 |
| 3 | `/api/v1/log_monitor/cfg` | `POST` | 新建规则（同事务写通知配置） | 有「新增」`Create` 权限可操作，无则禁止 |
| 4 | `/api/v1/log_monitor/cfg` | `PUT` | 修改规则（**定位键在 body 的 Ro 里**，同事务更新通知配置） | 有「编辑」`Update` 权限可操作，无则禁止 |
| 5 | `/api/v1/log_monitor/cfg?item=&environment=` | `DELETE` | 删除规则（连带删通知配置） | 有「删除」`Delete` 权限可操作，无则禁止 |
| 6 | `/api/v1/sys_misc/priority/list` | `GET` | 报警等级候选（**归属 Misc 模块**，本功能只消费，规格见本节 6） | — |
| 7 | `/api/v1/log_monitor/cfg/state?item=&environment=&enabled` | `POST` | 启用 / 停用单条规则（列表开关，规格见本节 7） | 有「编辑」`Update` 权限可操作，无则禁止 |

> **定位键统一是 `item + environment`**（唯一索引），不用 `id`：
> - `detail` / `DELETE` / `state` 用 **query 参数**（无 body，只能走 URL）；
> - `PUT` **不收 query 参数**，定位键 `item` / `environment` 就在 `LogMonitorCfgRo` 里（与 `POST` 同一对象），后端按这两个字段找记录、且**不改这两个字段的值**（改了等于换一条，不允许）。
>
> **通知配置没有独立接口** —— 不收 `alarmCfgId` 入参，也不暴露 `/alarm_cfg/*`，全部随规则的写操作在同一事务内完成；权限随所在写动作（`POST` 随「新增」、`PUT` 随「编辑」、`DELETE` 随「删除」）。

**1 · `page`（GET）** 入参：`pageIndex`、`pageSize`（分页组件默认值）、`keyword`（可空；对 `item` / `description` / `environment` / `keyword` 四栏位 contains，任一命中即返回）。出参 `data` = `Pageable<LogMonitorCfgDto>`。

**SQL 取数**：主表 `FvLogMonitorCfg` **LEFT JOIN** `FvAlarmCfg` ON 主表.`ALARM_CFG_ID` = `FvAlarmCfg`.`ID`。两表 1:1（或 1:0），理论上一条规则一行；但出参仍**以主表行为准做去重**，防止连接意外产生重复行（主表数据不重复是前提，AlarmCfg 侧异常不放大到列表）。

**2 · `detail`（GET）** 入参 `item` + `environment`，查不到 ⇒ 拒。出参 `data` = **单个 `LogMonitorCfgDto`**（含嵌套 `alarmCfg`），供编辑弹框回填。

**3 · `POST`** 入参 `LogMonitorCfgRo` → 校验 → 唯一性检查 → **事务内**插 `AlarmCfg` 拿 ID、插规则 → 回 `LogMonitorCfgDto`。

**4 · `PUT`** 入参 `LogMonitorCfgRo`（与 `POST` 同一对象，**`item` / `environment` 作为定位键必传**）→ 按这两个字段查库，不存在 ⇒ 拒 → 校验 → **事务内**按该规则的 `AlarmCfgId` 更新通知配置、更新规则 → 回 `LogMonitorCfgDto`。**定位键只用于查记录、不进 `UPDATE` 的列** —— 这两列的值不会被改写（要换规则名/环境就删了重建）。

**5 · `DELETE`** 按 query 的 `item + environment` 定位 → **事务内**删规则、删其 `AlarmCfg` → 成功返空。**已产生的 Alarm 一律保留**。

**6 · `priority/list`（GET）** 无入参；出参 `data` = **`List<string>`**（去重 + 字符串升序，如 `["P1","P2","P3","P4"]`）。

- **归属 Misc 模块**（服务内路径 `/api/v1/sys_misc/priority/list`），本功能只是**消费方**；规格写在本篇。
- **后端实现：同服务内直接读 System Misc 的优先级配置项 `system.global.priority`**，输出 `string[]`；取值 / 回落规则见 System Misc 规格；返回空数组 ⇒ `[]`。
- **只读 Misc 表、不改**；供规则弹框的「报警等级」下拉取值，接口异常时下拉空、不阻断页面其他部分。

**7 · `state`（POST）** 入参走 query：`item` + `environment`（定位键）+ `enabled`（布尔，目标状态）。按定位键加锁查对象，查不到 ⇒ `LogMonitorCfgNotFound`；事务内**只更新主表 `ENABLED` 一列**，不动 `FvAlarmCfg`。出参 `data` = **单个 `LogMonitorCfgDto`**（与 `page` 行同构，含 `enabled` 与两个展示字段），供列表原地刷新该行。权限：有「编辑」`Update` 权限可操作、无则禁止。

**后端校验（7 条，前后端同源）**

1. `environment` 必须存在于 Misc `mes.global.environments`；
2. `priority` 必须存在于 Misc `system.global.priority`；
3. `item + environment` 唯一（仅 `POST` 校验 —— `PUT` 不可改这两项，天然不冲突）；
4. 三个 JSON 数组**序列化后**各 ≤4000 字符；
5. `notifyInterval` 为整数且落在 **`2 ~ 99999`**（必须 > 1）；
6. 两条交叉校验：排除词不得是 `keyword` 子串（含相等）、关注名单与排除名单不得有交集（详见 §4.3「写接口的交叉校验」）；
7. 通知格式：`mailToUsers` / `mailCCUsers` **逐个**校验邮箱格式；`feishuGroups` 的 **key 逐个**校验群机器人地址格式、**value** 校验 open_id（`ou_` 开头，单个 string 或 string 数组逐项校验），任一不合规 ⇒ `ParameterInvalid`（三项均可为空，空则跳过校验）。

### 4.2 出入参对象

**`LogMonitorCfgRo`（入参）**

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `environment` | string | 是 | ≤30，须在 Misc 值域内 |
| `item` | string | 是 | ≤30，不限字符类型 |
| `keyword` | string | 是 | ≤30，不限字符类型 |
| `description` | string | 否 | ≤255 |
| `excludeKeywords` | `List<string>` | 否 | 序列化 ≤4000 |
| `followRuleNames` | `List<string>` | 否 | 序列化 ≤4000 |
| `excludeRuleNames` | `List<string>` | 否 | 序列化 ≤4000 |
| `priority` | string | 是 | 须在 Misc 值域内 |
| `alarmCfg` | `AlarmCfgRo` | 是 | 嵌套，见下 |

> `item` / `environment` 是**定位键**：`POST` 用它俩做唯一性校验，`PUT` 用它俩定位记录；两列**都不会被改**。
> **`enabled` 不在 Ro 里** —— 新建默认 `true`，之后只由 `state` 接口改；弹框新增 / 修改都不碰这一列。

**`AlarmCfgDto` / `AlarmCfgRo`（嵌套出参 / 入参，同形）**

| 字段 | 类型 | 必填 | 约束 / 说明 |
|---|---|---|---|
| `mailToUsers` | `List<string>` | 否 | 邮箱格式，序列化 ≤4000 |
| `mailCCUsers` | `List<string>` | 否 | 同上 |
| `feishuGroups` | `Map<string, string \| string[]>`（JSON object） | 否 | **key = 群 webhook 地址，value = 该群要 @ 的人的 open_id**（一个值 string、多个值 string 数组）；序列化 ≤4000 |
| `notifyInterval` | int | 是 | **2 ~ 99999**（必须 > 1），默认 5 |

**`LogMonitorCfgDto`（出参，字段与 `LogMonitorCfgRo` 同形，另加 `enabled` 与两个展示字段）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `item` | string | 规则名称 |
| `environment` | string | 环境名 |
| `keyword` | string | 关键字 |
| `description` | string | 描述；空 ⇒ `null` |
| `excludeKeywords` | `List<string>` | 空 ⇒ `[]` |
| `followRuleNames` | `List<string>` | 空 ⇒ `[]` |
| `excludeRuleNames` | `List<string>` | 空 ⇒ `[]` |
| `priority` | string | `P1` ~ `P4` |
| `enabled` | boolean | `true` = 启用、非 `true` = 未启用 |
| `alarmCfg` | `AlarmCfgDto` | 嵌套通知配置 |
| `lastUpdatedTime` | string | 审计 `updatedAt` 有值取它，为空取 `createdAt` |
| `lastUpdatedUser` | string | 审计 `updatedBy` 有值取它，为空取 `createdBy` |

> **不带 `id` / `alarmCfgId` / 四个审计字段**（`createdAt`·`createdBy`·`updatedAt`·`updatedBy`）—— 技术键不出参，通知配置的定位完全在后端（按规则的 `AlarmCfgId` 就地更新）；更新时间只以 `lastUpdatedTime` / `lastUpdatedUser` 两个字段对外。

> `lastUpdatedTime` / `lastUpdatedUser` **在 `page` 与 `state` 出参里填**（列表「更新时间」列用、`state` 成功后原地刷新该行时用，`lastUpdatedUser` 作悬浮提示）；`detail` / `POST` / `PUT` 回的单条对象保留字段结构，值为空也允许。

**响应示例（单条，`detail` / `POST` / `PUT` / `state` 的 `data` 同形）**

```json
{
  "code": "OK", "success": 1, "errMsg": "", "txId": "3f9c1b7e2a4d",
  "data": {
    "environment": "PROD",
    "item": "PROD-ORA-EXCEPTION",
    "keyword": "ORA-",
    "description": "Oracle 报错关键字",
    "excludeKeywords": ["ORA-00001"],
    "followRuleNames": ["EAPReqJobInEx"],
    "excludeRuleNames": [],
    "priority": "P1",
    "enabled": true,
    "alarmCfg": {
      "mailToUsers": ["ops@fab.com", "dba@fab.com"],
      "mailCCUsers": ["lead@fab.com"],
      "feishuGroups": {
        "https://open.feishu.cn/open-apis/bot/v2/hook/xxxx": "ou_5d3c…",
        "https://open.feishu.cn/open-apis/bot/v2/hook/yyyy": ["ou_7a1b…", "ou_9c2d…"]
      },
      "notifyInterval": 5
    }
  }
}
```

> 出参不带 `id` / `alarmCfgId` / 审计字段：通知配置的定位完全在后端（按规则的 `AlarmCfgId` 就地更新），前端不需要知道这些技术键；展示用的更新时间由 `page` 出参直接给，也不走这个对象。

### 4.3 实现逻辑（逐接口）

**七条共性约定**（下面各接口不再重复）

1. 响应外壳：`code` 成功恒 `OK`、失败为 PascalCase 业务码，`success` 输出 `0` / `1`，`errMsg` 成功为空串。
2. `ID` 与四个审计字段**全部由底层赋值**，不进任何 Ro；`updatedAt` / `updatedBy` 每次写操作无条件刷新。
3. 字符串长度一律**按字符**校验（先校验、再落库，避免 `VARCHAR2` 字节语义抛 `ORA-12899`）；`trim` 后为空视同未传。
4. 三个 JSON 数组字段（`ExcludeKeywords` / `FollowRuleNames` / `ExcludeRuleNames`）处理一致：元素 `trim` → 去空串 → **去重（保持原顺序）** → 序列化为 JSON 存；空数组存 `NULL`。
5. 事务边界：一条写接口 = 一个事务（涉及规则表与通知表时**同提交同回滚**；`state` 只动规则表、`POST` / `PUT` / `DELETE` 带通知表）；`AlarmCfg` 的 ID 在同一事务内生成。
6. **存在性与锁**：`POST` 需**校验对象是否已存在**（不加锁）；`PUT` / `DELETE` / `state` 需**校验对象存在并对 `item + environment` 加锁**（查到即持锁，同键写操作串行）。**不指定具体公共方法名**，实现层按此语义选型。
7. 权限：功能级到本菜单，进入菜单即可查（`page` / `detail`）；写动作 `POST` 要「新增」`Create`、`PUT` / `state` 要「编辑」`Update`、`DELETE` 要「删除」`Delete`，有权限可操作、无权限禁止。

**1 · `page`**

| 步骤 | 动作 |
|---|---|
| ① | 分页参数（`pageIndex` / `pageSize`）**直接交给底层 `PageRequest`**，默认值、越界兜底全由底层负责，**业务侧不写这段判断** |
| ② | `keyword` `trim` 后空 ⇒ 不加条件；非空 ⇒ `%` `_` `\` **转义**后 **`LIKE '%kw%'`（前后模糊）**，四栏位 `OR` 拼，**比较前统一 `UPPER()`（列与入参都转）—— 不区分大小写**，`ora-` 与 `ORA-` 行为一致（列上函数导致索引失效，当前表量级可接受） |
| ③ | 主 SQL：`FvLogMonitorCfg m LEFT JOIN FvAlarmCfg a ON m.ALARM_CFG_ID = a.ID`，**`ORDER BY m.ENVIRONMENT ASC, m.ITEM ASC`**（先按环境聚拢、再按规则名） |
| ④ | 计数用主表单表 + 同一 `WHERE`（**不 JOIN**），避免 1:N 异常把 `totalSize` 放大 |
| ⑤ | 行映射：主表字段直出；JSON 列反序列化为 `List<string>`，**解析失败按空数组**（脏数据不炸列表）；**没有通知行（1:0）⇒ `alarmCfg = null`** |

**2 · `detail`**

| 步骤 | 动作 |
|---|---|
| ① | `item` / `environment` 缺失或空白 ⇒ `RequireParameterMissing` |
| ② | 按 `ITEM + ENVIRONMENT` 查主表（唯一索引命中）⇒ 查不到抛 `LogMonitorCfgNotFound` |
| ③ | 用该行 `ALARM_CFG_ID` 查通知表；1:0 ⇒ `alarmCfg = null`（前端按空表单渲染） |
| ④ | 出参单个 `LogMonitorCfgDto`，与 `page` 的行结构**完全同构**（同一映射函数） |

**3 · `POST`**

| 步骤 | 动作 |
|---|---|
| ① | **必填校验（4 项）**：`environment` / `item` / `keyword` / `priority` 任一为空或空白 ⇒ `RequireParameterMissing`；顺带校验 `item` ≤30、`keyword` ≤30、`description` ≤255、`notifyInterval`（整数 **2~99999**，必须 > 1，缺省补 **5**）、**邮箱 / `feishuGroups` 的 key（webhook）与 value（open_id）格式校验**（可空，空则跳过），超限或不合规 ⇒ `ParameterInvalid`；**三名单交叉校验见本节末**「写接口的交叉校验」 |
| ② | **值域校验（复用 `/list` 方法）**：环境候选取 `env/list`、等级候选取 `priority/list` 的后端取值方法（同服务内直接调方法、不走 HTTP；二者均出 `string[]`，分别读 Misc `mes.global.environments` / `system.global.priority`）；提交值不在候选内（含未配、集合为空）⇒ `EnvironmentNotAllowed` / `PriorityNotAllowed` |
| ③ | **存在性校验**：按 `item + environment` 校验对象是否已存在（**不加锁**）—— 已存在 ⇒ **不允许创建**（`LogMonitorCfgExists`）；库层唯一索引兜底，捕获约束冲突**转同一业务码**（防并发穿透） |
| ④ | 事务：**先建通知对象**——生成 `AlarmCfg.ID` → INSERT `FvAlarmCfg` → 拿到 `ALARM_CFG_ID`；**再建监控对象**——生成规则 `ID` → INSERT `FvLogMonitorCfg`（带该 `ALARM_CFG_ID`）→ 提交 |
| ⑤ | 回参：按 `detail` 逻辑重查一次并映射（**不回显入参**，保证与库内真实值一致，含默认值补全） |

**4 · `PUT`**

| 步骤 | 动作 |
|---|---|
| ① | `item` / `environment` 必填（**定位键**）；缺失 ⇒ `RequireParameterMissing` |
| ② | **加锁查对象**：按 `item + environment` 校验存在并**加锁** —— 与 `DELETE` / `state` 同一把键锁、同键串行；查不到 ⇒ **未创建不允许修改**（`LogMonitorCfgNotFound`） |
| ③ | 必填（4 项）与值域校验同 `POST` ①②，**并做同一套三名单交叉校验**（**跳过唯一性** —— 两个定位键不可改，天然不冲突） |
| ④ | 事务：取本行 `ALARM_CFG_ID` → **UPDATE 通知行**（按该 ID 原地改全字段，**不删不新建**；仅当该 ID 为空 / 通知行缺失的历史脏数据才补插一行并回写）→ UPDATE 规则行（`SET` 不含 `ITEM` / `ENVIRONMENT` / `ID` / 审计）→ 提交 |
| ⑤ | 回参：同 `POST` ⑤，重查后映射 |

**5 · `DELETE`**

| 步骤 | 动作 |
|---|---|
| ① | `item` / `environment` 必填；缺失 ⇒ `RequireParameterMissing` |
| ② | **加锁查对象**：按 `item + environment` 校验存在并**加锁** —— 与 `PUT` / `state` 同一把键锁、同键串行；查不到 ⇒ **未创建不允许删除**（`LogMonitorCfgNotFound`） |
| ③ | 事务：**通知行与监控行一起删**——按本行 `ALARM_CFG_ID` 删 `FvAlarmCfg` → 删 `FvLogMonitorCfg` → 提交 |
| ④ | **已产生的 Alarm 一律不动**（运行时的历史数据与本表无外键关系） |
| ⑤ | 回参：`data` 为空 |

**6 · `priority/list`**

| 步骤 | 动作 |
|---|---|
| ① | 无入参；同服务内直接读 System Misc 的优先级配置项 `system.global.priority`，输出 `string[]` |
| ② | 取值 / 回落规则见 System Misc 规格；本篇只消费返回的 `string[]` |
| ③ | 返回空数组 ⇒ 出参 `[]`（**不报错**，前端下拉空、不阻断页面） |
| ④ | 去重 + **字符串升序**排序后输出 `List<string>` |
| ⑤ | 不缓存：每次调此 list 方法读当前值，Misc 改完即时生效 |

**7 · `state`**

| 步骤 | 动作 |
|---|---|
| ① | `item` / `environment` / `enabled` 缺失或空白 ⇒ `RequireParameterMissing`；`enabled` 非布尔 ⇒ `ParameterInvalid` |
| ② | 按 `item + environment` 校验存在并**加锁**（与 `PUT` / `DELETE` 同一把键锁）；查不到 ⇒ `LogMonitorCfgNotFound` |
| ③ | 事务：只 `UPDATE FvLogMonitorCfg SET ENABLED = :enabled`（**不动通知表、不动定位键**），审计列由底层刷新 → 提交 |
| ④ | 按 `detail` 同一映射函数重查一次，回单个 `LogMonitorCfgDto`（含 `enabled` 与两个展示字段）；前端按定位键原地替换该行 |

**写接口的交叉校验（`POST` / `PUT` 共用，位置在值域校验之后、开事务之前）**

| # | 规则 | 判定方式 | 失败码 |
|---|---|---|---|
| 1 | **关注 / 排除 Rule Name 不得有交集** | 两个名单（已 `trim`、去重）取交集，**原样比较（区分大小写）**；交集非空 ⇒ 拒，`errMsg` 带出重复的 Rule Name。理由：同一条 Rule 同时在白名单与黑名单，按检查顺序必然被排除，配置无意义 | `RuleNameConflict` |
| 2 | **排除关键字必须比 `keyword` 更具体，不得反盖** | 逐个元素判断：若某排除词是 `keyword` 的**子串（含完全相等）**⇒ 拒。理由：任何含 `keyword` 的日志必然也含该排除词，命中会被全量排除，规则**永不生效** | `ExcludeKeywordInvalid` |

判定举例（`keyword` / 排除词 → 结论）：

| `keyword` | 排除词 | 结论 |
|---|---|---|
| `ORA-` | `ORA-0001` | ✅ 通过 —— 只排掉 0001，其余 `ORA-` 照样告警 |
| `ORA-0001` | `ORA-` | ❌ 拒 —— `ORA-` 是 `ORA-0001` 的子串，会把全部命中排掉 |
| `ORA-0001` | `ORA-0001` | ❌ 拒 —— 完全相等，等于把这条规则关掉 |

> 比较口径与运行时「日志**包含**关键字」的判定**同源**：一律**区分大小写**、按子串包含。若运行时的匹配口径改为忽略大小写，此处须同步改（两处必须一致，否则校验拦不住废配置）。

**错误码清单（本篇涉及 8 个：复用 4 + 新增 4）**

| `code` | 触发 | 前端表现 |
|---|---|---|
| `RequireParameterMissing` | 必填项缺失 / 空白 | 定位到字段的红字提示 |
| `ParameterInvalid` | 长度超限、`notifyInterval` 非整数或不在 `2~99999`（≤1 同样拒）、邮箱 / `feishuGroups` 的 webhook 或 open_id 格式不合规、JSON 序列化超长 | 定位到字段的红字提示 |
| `LogMonitorCfgExists` | `item + environment` 已存在（创建时） | 提示「同环境下该规则名已存在」 |
| `LogMonitorCfgNotFound` | `detail` 查不到；`PUT` / `DELETE` / `state` 时该 `item + environment` 未创建 | 提示后刷新列表 |
| `EnvironmentNotAllowed` / `PriorityNotAllowed` | 值不在 Misc 值域内（含 Misc 未配） | 提示去 System Misc 先配候选值 |
| `RuleNameConflict` | 关注名单与排除名单有重复的 Rule Name | 提示重复项，定位到两个名单行 |
| `ExcludeKeywordInvalid` | 存在「排除词是 keyword 子串（含相等）」的配置 | 提示该排除词会让规则永不生效，定位到排除关键字行 |

> 前 4 个是整体库既有码，直接复用；`EnvironmentNotAllowed` / `PriorityNotAllowed` / `RuleNameConflict` / `ExcludeKeywordInvalid` 为本模块新增。
> 值域校验逻辑**只实现一份**（`POST` / `PUT` 共用的校验函数），内部复用 `env/list` / `priority/list` 的后端取值方法拿候选 `string[]`（与前端下拉共用一套取值逻辑、同服务内直接调方法不走 HTTP），不在候选内即拒。

## 5. 待确认

（无）
