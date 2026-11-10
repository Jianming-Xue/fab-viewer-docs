# MES 关键字监控 · 配置文档

> 模块 2 · 日志监控与报警 ｜ 功能 1 ｜ 状态：**配置侧定稿**（2026-11-09 两张配置表 / 出入参闭环；2026-11-10 接口收为 6 个、`PUT` 定位键并入 Ro、`priority/list` **归属 Misc 模块**、规格写在本篇；页面规格定稿：菜单位于 `config` → 系统配置、查询卡片 + 表格卡片、两 Tab 弹框）。判定 / 展示 / 扫描 / 通知等**运行时**内容见 [`02-MES关键字监控与告警.md`](02-MES关键字监控与告警.md)。

## 1. 功能定位

MES 运行时会产生各种错误 —— 比如日志里出现 `ORA-` 就是 Oracle 报错。这类错误散在海量日志里，靠人翻看不现实。本功能**定时扫描日志**，命中预设关键字就生成 Alarm 并通知到人（扫描与判定逻辑见运行时文档 §2 / §4）。

本篇只管**配置侧**：定义「扫什么、按什么等级、通知给谁」。

## 2. 配置表

**入口**：配置页和监控展示页位于同一功能内；本页挂 **`config` 模块 → 系统配置（一级目录）** 下，走**菜单级权限管控**（细节见 §3.1）。

**配置分两张表**：

- **表一 `FabViewerLogMonitorCfg`**（§2.1）—— 监控规则本身：环境 + 规则名 + 关键字 + 三道检查的名单 + 报警等级 + 关联的通知配置；
- **表二 `FabViewerAlarmCfg`**（§2.2）—— 通知配置：收件人（邮件 / 飞书）+ 汇总发送间隔。**随规则走、不单独维护**：在规则弹框里就地配置，保存时同事务写入，一条规则对应一份（1:1）。

> **一条配置 = 一个规则 = 一个关键字**：`Item + Environment` 唯一。要监控多个关键字就建多条配置（规则名各不相同）。旧口径「一条规则下挂多行关键字」随唯一索引一并作废。

> 收件人（邮件 / 飞书）**不在规则表里**，落在 `FabViewerAlarmCfg` 靠 `AlarmCfgId` 关联；但**没有独立的配置页和接口** —— 它是规则的附属，在规则弹框的「通知」区块里一起编辑、一起提交。

### 2.1 表一 · `FabViewerLogMonitorCfg`（监控规则）

| 字段 | 列名 | 长度 | 可空 | 说明 |
|---|---|---|---|---|
| 主键 | `ID` | ≤50 | 否 | 按全项目表规范，长度对齐 `FabViewerAlarmCfg.ID`；不出参、不进 Ro |
| 规则名称 | `Item` | ≤30 | 否 | 规则标识名，如 `PROD-ORA-EXCEPTION`；**仅允许下划线 `_`、中划线 `-`、大小写字母、数字**（`^[A-Za-z0-9_-]{1,30}$`）；汇总表按「环境名 + 规则名称」分组 → **一条规则占一行** |
| 环境名 | `Environment` | ≤30 | 否 | 下拉，候选来自 Misc `mes.global.environments` |
| 关键字 | `Keyword` | ≤30 | 否 | **一条配置一个关键字**；不限字符类型 |
| 描述 | `Description` | ≤255 | 是 | 这条规则是干什么的，给人看 |
| 排除关键字 | `ExcludeKeywords` | ≤4000 | 是 | JSON 数组，**词级**黑名单 |
| 关注 Rule Name | `FollowRuleNames` | ≤4000 | 是 | JSON 数组，**Rule 级**白名单 —— 配了则**只有**命中名单内的 Rule Name 才告警 |
| 排除 Rule Name | `ExcludeRuleNames` | ≤4000 | 是 | JSON 数组，**Rule 级**黑名单 |
| 报警等级 | `Priority` | ≤20 | 否 | `P1` ~ `P4`；**值域来自 Misc `system.global.priority`**（后端读 Misc 校验，前端走 `/api/v1/sys_misc/priority/list` 取候选，见 §4.1-6） |
| 通知配置 | `AlarmCfgId` | ≤50 | 否 | 关联 `FabViewerAlarmCfg.ID` |

- **唯一索引**：`Item + Environment`。
- **不设 `enabled`**（配置即启用）；审计字段 `createdAt` / `createdBy` / `updatedAt` / `updatedBy` 由底层统一赋值。
- 三个 JSON 数组字段的**长度按字符**校验（≤4000），元素个数不单独卡上限；空/未配置存 `NULL`。

### 2.2 表二 · `FabViewerAlarmCfg`（通知配置）

**它不设名称字段** —— 不是独立业务实体，而是各类监控配置（关键字监控、Hang 监控等）**共用的通知扩展子集**，靠引用它的配置来辨识。

| 字段 | 长度 | 可空 | 说明 |
|---|---|---|---|
| `ID` | ≤50 | 否 | 主键 |
| `MailToUsers` | ≤4000 | 是 | JSON 数组，收件人邮箱 |
| `MailCCUsers` | ≤4000 | 是 | JSON 数组，抄送邮箱 |
| `FeishuWebhooks` | ≤4000 | 是 | JSON 数组，飞书**群机器人**地址列表（**可多个群**） |
| `FeishuAtUsers` | ≤4000 | 是 | JSON 数组，要 @ 的人的 **open_id**（人在该群才生效） |
| `NotifyInterval` | ≤10 | 否 | **通知间隔（整数，单位分钟）**，**取值范围 `1 ~ 99999`**，默认 **5** |

> 无 `Item` / `Description`：页面上的引用下拉按「`ID` + 收件人摘要（如 `a@x.com, b@x.com + 2 群`）」展示，不引入名称字段。

**邮件通道口径**

- **`MailToUsers` 为空 ⇒ 邮件不发**（CC 只是抄送，不顶替收件人；只填 CC 不填 To 就等于不发邮件）。
- `MailToUsers` 非空时，CC 可为空；CC 里的人只收副本。
- 邮件失败不影响飞书发送，两者各自按结果记日志。

**飞书通道口径（方案 A · 群自定义机器人）**

- 只走 **webhook**：一个地址对应一个群；**一份配置可填多个群地址**，逐个群各发一条同样的汇总消息（同一群内是一条）。
- **不支持私聊单个用户**（群自定义机器人无用户身份，官方明确不能调 `im/v1/messages`）；@ 人靠 `open_id`，该人**必须在这个群里**，否则 @ 不生效（消息照发）。
- 多群发送**互不影响**：某个群失败重试一次，仍失败只记日志、不阻断其他群；全失败才按发送失败上报。
- 底层 app 凭证 / 群配置已就绪，本表只管「发到哪些群、@ 谁」。

**通知配置的生命周期（随规则走）**

| 场景 | 口径 |
|---|---|
| 新建规则 | 先插 `FabViewerAlarmCfg` 拿 `ID`，再插规则，**同一事务** |
| 修改规则 | 按其 `AlarmCfgId` 更新通知配置，再更新规则，**同一事务** |
| 删除规则 | **连带删除**其 `AlarmCfg`（无独立入口，留着就是孤儿）；**已产生的 Alarm 不删** —— 历史报警是证据，不随配置消失 |
| 复用已有配置 | **不允许** —— 一条规则一份，页面不提供「选择已有配置」 |

---

## 3. 配置页

### 3.1 菜单位置与权限

| 项 | 内容 |
|---|---|
| 菜单名称 | 英文 **`MES Log Monitor Config`**；中文 **`MES日志监控配置`** |
| 挂载位置 | `config` 模块 → **系统配置**（一级目录）下 |
| 权限方式 | **菜单级权限管控**：无该菜单权限的用户**看不到入口、也调不通接口**（菜单渲染与接口鉴权同一份权限数据） |

### 3.2 主界面

页面为**单栏**（不用 System Misc 的左侧分类栏）—— 规则天然带环境维度，用顶部查询条件就够，也省一层加载。

**查询卡片（上）**

| 元素 | 内容 |
|---|---|
| `keyword` 输入框 | 单个输入框，入参名 `keyword`；对 `item` / `description` / `environment` / `keyword` **四栏位前后模糊匹配（不区分大小写）**，任一命中即返回 |
| `查询` 按钮 | 点击调 `page`（§4.1-1）；回车等价于点按钮 |
| 其他 | 不设独立的环境筛选下拉、不设重置按钮（清空输入框再点查询即全量） |

**表格卡片（下）**

工具栏：左侧 `新增` 主按钮（无菜单权限时整页不可见）、`刷新` 按钮（按当前查询条件重跑 `page`）。

表格列（顺序固定）：

| # | 列 | 内容 |
|---|---|---|
| 1 | Environment | 原样显示 |
| 2 | Item | 加粗；超 **30 字符**省略 + hover 看全 |
| 3 | Description | 超长省略 + hover 看全；空显示灰色 `-` |
| 4 | Keyword | 等宽字体；超 **30 字符**省略 + hover 看全 |
| 5 | Follow Rule Name | **多值栏位**：多个值并排展示，溢出省略 + hover 看全；空显示灰色 `-`（= 不限 Rule） |
| 6 | Exclude Keywords | 同上（多值栏位） |
| 7 | Exclude Rule Names | 同上（多值栏位） |
| 8 | Priority | `P1`~`P4` 色标（P1 红 / P2 橙 / P3 黄 / P4 灰），与展示页同一套（运行时文档 §3.1） |
| 9 | Last Updated User | 取 `page` 出参 `lastUpdatedUser` |
| 10 | Last Updated Time | `yyyy-MM-dd HH:mm:ss`，取 `page` 出参 `lastUpdatedTime` |
| 11 | 操作 | `编辑` / `删除` |

> 分页条沿用分页组件默认值；列表按 `Environment + Item` 升序（§4.1-1）。
>
> **删除**：二次确认，提示必须点明「**不是立即生效** —— 告警服务在下一次加载配置后才停止扫描（通常 1 个扫描周期内），期间仍可能产生少量报警；已产生的报警一律保留」。
>
> 空态 / 加载态 / 无权限态一律沿用 `05-视觉与交互规范`。

### 3.3 规则弹框（新增 / 修改同一组件 · **Tab 两页**）

一个弹框、两个 Tab：**`Keyword 配置` → `Alarm 配置`**。新增与修改共用；修改态下 `Environment` / `Item` 锁定（定位键，不可改）。

**Tab 1 · Keyword 配置**

| 字段 | 控件 | 校验 |
|---|---|---|
| Environment | 下拉 | 必填；候选来自 Misc `mes.global.environments`；**编辑态锁定**（与 Item 共同构成定位键） |
| Item | 输入框 | 必填 **≤30 字符**；**只允许下划线 `_`、中划线 `-`、大小写字母、数字**（`^[A-Za-z0-9_-]{1,30}$`）；**编辑态锁定不可改** —— 要换就删了重建 |
| Keyword | 输入框 | 必填 **≤30 字符**；**不限字符类型** |
| Description | **多行文本域** | ≤255，可空 |
| Priority | 下拉 | 必填；候选来自 `/api/v1/sys_misc/priority/list`（§4.1-6） |
| Follow Rule Name | **多字符串输入控件**（回车成条、可逐条删） | 序列化后 ≤4000；与 Exclude Rule Names **不得有交集** |
| Exclude Keywords | 多字符串输入控件 | 序列化后 ≤4000；任一元素**不得是 `keyword` 的子串（含相等）** |
| Exclude Rule Names | 多字符串输入控件 | 序列化后 ≤4000 |

**底部（Tab 1）**：`取消` + `Next`（右）。点 `Next` **先校验本页**（必填 / 长度 / Item 字符集 / 两条交叉校验），通过才切到 Tab 2；不通过就地红字、**停在当前页**。

**Tab 2 · Alarm 配置**（落 `FabViewerAlarmCfg`，随规则一起提交）

内容区**从上到下用分割符分成三段**：

**① 通知间隔**（最上，独立一段，无分割标题）

| 字段 | 控件 | 校验 |
|---|---|---|
| 通知间隔（分） | 输入框 | **必填**；仅整型数字，**`1 ~ 99999`**；默认 **5**；超出范围 / 非整数 ⇒ 就地红字 |

**② ── 邮件通知 ──**

| 字段 | 控件 | 校验 |
|---|---|---|
| 收件人 To | 多字符串输入控件 | 可空；**提交时**逐个校验邮箱格式，不合规 ⇒ 报错定位到该条、**阻断提交** |
| 抄送 CC | 多字符串输入控件 | 同上 |

**③ ── 飞书通知 ──**

| 字段 | 控件 | 校验 |
|---|---|---|
| 飞书群 | **多行文本域，一行一个地址**（webhook 太长，用多字符串输入控件不好粘贴） | 可空；每条须匹配群机器人地址格式 `https://open.feishu.cn/open-apis/bot/v2/hook/…`，不合规 ⇒ 阻断提交 |
| @ 人 | 多字符串输入控件 | 可空；`ou_` 开头的 open_id，可多个 |

> **除「通知间隔」外全部可空** —— 邮件两栏都空、飞书两栏都空也允许保存（等于这条规则只落库、不发通知）。
> 飞书群字段下方常驻灰字提示：「**@ 的人必须在对应群里**，否则 @ 不生效（消息照发）」。

**底部（Tab 2）**：`Previous`（位于 `取消` **之前**）+ `取消` + `确认`（占据 Tab 1 里 `Next` 的位置）。

- `Previous`：回 Tab 1（`Keyword 配置`），**保留已填值、不重复校验**；回到 Tab 1 后底部按钮组**恢复为 `取消` + `Next`**（`Previous` / `确认` 不再出现）。`取消`：关弹框，有改动时二次确认丢弃。
- `确认`：校验本页（**通知间隔 1~99999**、**邮箱格式逐个校验**、webhook 格式）后提交 —— **新增走 `POST`、修改走 `PUT`**；成功后关弹框，新增刷新回第 1 页、修改原地替换该行。
- 提交**不是立即生效**：保存成功后 toast 提示「配置已保存，告警服务将在下次加载配置后生效（通常 1 个扫描周期内）」。

> 两条交叉校验**前端先做一遍**（在 Tab 1 即时红字，不等 Next），后端再兜一次，两者同源（§4.3「写接口的交叉校验」）。

---

## 4. 接口

### 4.1 接口清单

服务内前缀 `/api/v1/log_monitor`（第 1 ~ 5 条），前端调用加网关前缀 `telemetry-hub`；响应外壳与分页结构沿用整体库（`模块6/05-后端设计`）。

> 第 6 条 `priority/list` **不属本功能前缀** —— 它归 **Misc 模块**（`/api/v1/sys_misc`），只读 Misc 表；**接口规格写在本篇**（§4.1-6），不在模块 5 的文档里重复一遍。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `/api/v1/log_monitor/cfg/page` | `GET` | 分页查询（`keyword` 四栏位模糊） |
| 2 | `/api/v1/log_monitor/cfg/detail?item=&environment=` | `GET` | 详情（编辑回填，含通知配置） |
| 3 | `/api/v1/log_monitor/cfg` | `POST` | 新建规则（同事务写通知配置） |
| 4 | `/api/v1/log_monitor/cfg` | `PUT` | 修改规则（**定位键在 body 的 Ro 里**，同事务更新通知配置） |
| 5 | `/api/v1/log_monitor/cfg?item=&environment=` | `DELETE` | 删除规则（连带删通知配置） |
| 6 | `/api/v1/sys_misc/priority/list` | `GET` | 报警等级候选（**归属 Misc 模块**，本功能只消费，规格见本节 6） |

> **定位键统一是 `item + environment`**（唯一索引），不用 `id`：
> - `detail` / `DELETE` 用 **query 参数**（无 body，只能走 URL）；
> - `PUT` **不收 query 参数**，定位键 `item` / `environment` 就在 `LogMonitorCfgRo` 里（与 `POST` 同一对象），后端按这两个字段找记录、且**不改这两个字段的值**（改了等于换一条，不允许）。
>
> **通知配置没有独立接口** —— 不收 `alarmCfgId` 入参，也不暴露 `/alarm_cfg/*`，全部随规则的写操作在同一事务内完成。权限走**菜单级**（§3.1）：有该菜单权限即具备本功能全部读写能力，不再单独区分只读 / 编辑角色；`priority/list` 的权限随 Misc 模块走。

**1 · `page`（GET）** 入参：`pageIndex`、`pageSize`（分页组件默认值）、`keyword`（可空；对 `item` / `description` / `environment` / `keyword` 四栏位 contains，任一命中即返回）。出参 `data` = `Pageable<LogMonitorCfgDto>`。

**SQL 取数**：主表 `FabViewerLogMonitorCfg` **LEFT JOIN** `FabViewerAlarmCfg` ON 主表.`ALARM_CFG_ID` = `FabViewerAlarmCfg`.`ID`。两表 1:1（或 1:0），理论上一条规则一行；但出参仍**以主表行为准做去重**，防止连接意外产生重复行（主表数据不重复是前提，AlarmCfg 侧异常不放大到列表）。

**2 · `detail`（GET）** 入参 `item` + `environment`，查不到 ⇒ 拒。出参 `data` = **单个 `LogMonitorCfgDto`**（含嵌套 `alarmCfg`），供编辑弹框回填。

**3 · `POST`** 入参 `LogMonitorCfgRo` → 校验 → 唯一性检查 → **事务内**插 `AlarmCfg` 拿 ID、插规则 → 回 `LogMonitorCfgDto`。

**4 · `PUT`** 入参 `LogMonitorCfgRo`（与 `POST` 同一对象，**`item` / `environment` 作为定位键必传**）→ 按这两个字段查库，不存在 ⇒ 拒 → 校验 → **事务内**按该规则的 `AlarmCfgId` 更新通知配置、更新规则 → 回 `LogMonitorCfgDto`。**定位键只用于查记录、不进 `UPDATE` 的列** —— 这两列的值不会被改写（要换规则名/环境就删了重建）。

**5 · `DELETE`** 按 query 的 `item + environment` 定位 → **事务内**删规则、删其 `AlarmCfg` → 成功返空。**已产生的 Alarm 一律保留**。

**6 · `priority/list`（GET）** 无入参；出参 `data` = **`List<string>`**（去重 + 字符串升序，如 `["P1","P2","P3","P4"]`）。

- **归属 Misc 模块**（服务内路径 `/api/v1/sys_misc/priority/list`），本功能只是**消费方**；规格写在本篇，模块 5 的 Misc 文档不再重复（那里只列通用候选接口）。
- 数据源是 Misc 表 `item = system.global.priority`（`List<string>` 形态）：`value` 为空 ⇒ 回落 `defaultValue`；两者皆空 ⇒ `[]`；解析规则与 Misc 候选接口同一套（`模块5/02-System Misc` §6.1 ~ §6.3）。
- **只读 Misc 表、不改**；供规则弹框的「报警等级」下拉取值，接口异常时下拉空、不阻断页面其他部分。

**后端校验（8 条，前后端同源）**

1. `environment` 必须存在于 Misc `mes.global.environments`；
2. `priority` 必须存在于 Misc `system.global.priority`；
3. `item + environment` 唯一（仅 `POST` 校验 —— `PUT` 不可改这两项，天然不冲突）；
4. 三个 JSON 数组**序列化后**各 ≤4000 字符；
5. `notifyInterval` 为整数且落在 **`1 ~ 99999`**；
6. `item` ≤30 字符且只含 `_` `-` 字母数字（`^[A-Za-z0-9_-]{1,30}$`）；`keyword` ≤30 字符、不限字符类型；
7. 两条交叉校验：排除词不得是 `keyword` 子串（含相等）、关注名单与排除名单不得有交集（详见 §4.3「写接口的交叉校验」）；
8. 通知格式：`mailToUsers` / `mailCCUsers` **逐个**校验邮箱格式、`feishuWebhooks` **逐个**校验机器人地址格式，任一不合规 ⇒ `ParameterInvalid`（这三项均可为空，空则跳过校验）。

### 4.2 出入参对象

**`LogMonitorCfgRo`（入参）**

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `environment` | string | 是 | ≤30，须在 Misc 值域内 |
| `item` | string | 是 | ≤30；`^[A-Za-z0-9_-]{1,30}$` |
| `keyword` | string | 是 | ≤30，不限字符类型 |
| `description` | string | 否 | ≤255 |
| `excludeKeywords` | `List<string>` | 否 | 序列化 ≤4000 |
| `followRuleNames` | `List<string>` | 否 | 序列化 ≤4000 |
| `excludeRuleNames` | `List<string>` | 否 | 序列化 ≤4000 |
| `priority` | string | 是 | 须在 Misc 值域内 |
| `alarmCfg` | `AlarmCfgRo` | 是 | 嵌套，见下 |

> `item` / `environment` 是**定位键**：`POST` 用它俩做唯一性校验，`PUT` 用它俩定位记录；两列**都不会被改**。

**`AlarmCfgDto` / `AlarmCfgRo`（嵌套出参 / 入参，同形）**

| 字段 | 类型 | 必填 | 约束 / 说明 |
|---|---|---|---|
| `mailToUsers` | `List<string>` | 否 | 邮箱格式，序列化 ≤4000 |
| `mailCCUsers` | `List<string>` | 否 | 同上 |
| `feishuWebhooks` | `List<string>` | 否 | 群机器人地址，序列化 ≤4000 |
| `feishuAtUsers` | `List<string>` | 否 | `open_id` 列表，序列化 ≤4000 |
| `notifyInterval` | int | 是 | **1 ~ 99999**，默认 5 |

**`LogMonitorCfgDto`（出参，字段与 `LogMonitorCfgRo` 同形，另加两个展示字段）**

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
| `alarmCfg` | `AlarmCfgDto` | 嵌套通知配置 |
| `lastUpdatedTime` | string | 审计 `updatedAt` 有值取它，为空取 `createdAt` |
| `lastUpdatedUser` | string | 审计 `updatedBy` 有值取它，为空取 `createdBy` |

> **不带 `id` / `alarmCfgId` / 四个审计字段**（`createdAt`·`createdBy`·`updatedAt`·`updatedBy`）—— 技术键不出参，通知配置的定位完全在后端（按规则的 `AlarmCfgId` 就地更新）；更新时间只以 `lastUpdatedTime` / `lastUpdatedUser` 两个字段对外。

> `lastUpdatedTime` / `lastUpdatedUser` **只在 `page` 出参里填**（列表「更新时间」列用，`lastUpdatedUser` 作悬浮提示）；`detail` / `POST` / `PUT` 回的单条对象保留字段结构，值为空也允许。

**响应示例（单条，`detail` / `POST` / `PUT` 的 `data` 同形）**

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

> 出参不带 `id` / `alarmCfgId` / 审计字段：通知配置的定位完全在后端（按规则的 `AlarmCfgId` 就地更新），前端不需要知道这些技术键；展示用的更新时间由 `page` 出参直接给，也不走这个对象。

### 4.3 实现逻辑（逐接口）

**七条共性约定**（下面各接口不再重复）

1. 响应外壳：`code` 成功恒 `OK`、失败为 PascalCase 业务码，`success` 输出 `0` / `1`，`errMsg` 成功为空串（对齐 `模块6/05` §1.4）。
2. `ID` 与四个审计字段**全部由底层赋值**，不进任何 Ro；`updatedAt` / `updatedBy` 每次写操作无条件刷新。
3. 字符串长度一律**按字符**校验（先校验、再落库，避免 `VARCHAR2` 字节语义抛 `ORA-12899`）；`trim` 后为空视同未传。
4. 三个 JSON 数组字段（`ExcludeKeywords` / `FollowRuleNames` / `ExcludeRuleNames`）处理一致：元素 `trim` → 去空串 → **去重（保持原顺序）** → 序列化为 JSON 存；空数组存 `NULL`。
5. 事务边界：一条写接口 = 一个事务（规则表 + 通知表同提交同回滚）；`AlarmCfg` 的 ID 在同一事务内生成。
6. **存在性判断统一走 `FvFetchObjectLockTxn`**（按 `item + environment` 取对象）：`POST` 走**不加锁**模式、只判断是否存在；`PUT` / `DELETE` 走**加锁**模式（查到即持有该键的锁，同键写操作串行）。
7. 权限：走**菜单级权限管控**（§3.1）—— 有该菜单权限即可读写本功能全部接口，无权限则连接口都调不通；`priority/list` 随 Misc 模块权限。

**1 · `page`**

| 步骤 | 动作 |
|---|---|
| ① | 分页参数（`pageIndex` / `pageSize`）**直接交给底层 `PageRequest`**，默认值、越界兜底全由底层负责，**业务侧不写这段判断** |
| ② | `keyword` `trim` 后空 ⇒ 不加条件；非空 ⇒ `%` `_` `\` **转义**后 **`LIKE '%kw%'`（前后模糊）**，四栏位 `OR` 拼，**比较前统一 `UPPER()`（列与入参都转）—— 不区分大小写**，`ora-` 与 `ORA-` 行为一致（列上函数导致索引失效，当前表量级可接受） |
| ③ | 主 SQL：`FabViewerLogMonitorCfg m LEFT JOIN FabViewerAlarmCfg a ON m.ALARM_CFG_ID = a.ID`，**`ORDER BY m.ENVIRONMENT ASC, m.ITEM ASC`**（先按环境聚拢、再按规则名） |
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
| ① | **必填校验（4 项）**：`environment` / `item` / `keyword` / `priority` 任一为空或空白 ⇒ `RequireParameterMissing`；顺带校验 `item` ≤30 且 `^[A-Za-z0-9_-]{1,30}$`、`keyword` ≤30、`description` ≤255、`notifyInterval`（整数 **1~99999**，缺省补 **5**）、**邮箱 / webhook 逐个格式校验**（可空，空则跳过），超限或不合规 ⇒ `ParameterInvalid`；**三名单交叉校验见本节末**「写接口的交叉校验」 |
| ② | **值域校验（走 Misc 的 By Item 查询 Txn）**：分别以 `mes.global.environments`、`system.global.priority` 调 Misc 模块提供的**按 `item` 查询 Txn**，取该行 `VALUE` / `DEFAULT_VALUE` 按 Misc §6.1~§6.3 解析成候选集合后比对 —— **不直连 Misc 表、不复刻解析逻辑**；不在值域（含 Misc 未配、集合为空）⇒ `EnvironmentNotAllowed` / `PriorityNotAllowed` |
| ③ | **存在性校验**：调 `FvFetchObjectLockTxn`（`item + environment`，**不加锁模式**）—— POST 只判断对象是否已存在、不持锁；已存在 ⇒ **不允许创建**（`LogMonitorCfgExists`）；库层唯一索引兜底，捕获约束冲突**转同一业务码**（防并发穿透） |
| ④ | 事务：**先建通知对象**——生成 `AlarmCfg.ID` → INSERT `FabViewerAlarmCfg` → 拿到 `ALARM_CFG_ID`；**再建监控对象**——生成规则 `ID` → INSERT `FabViewerLogMonitorCfg`（带该 `ALARM_CFG_ID`）→ 提交 |
| ⑤ | 回参：按 `detail` 逻辑重查一次并映射（**不回显入参**，保证与库内真实值一致，含默认值补全） |

**4 · `PUT`**

| 步骤 | 动作 |
|---|---|
| ① | `item` / `environment` 必填（**定位键**）；缺失 ⇒ `RequireParameterMissing` |
| ② | **加锁查对象**：调 `FvFetchObjectLockTxn`（`item + environment`，**加锁模式**）—— 与 `DELETE` 同一把键锁、同键串行；查不到 ⇒ **未创建不允许修改**（`LogMonitorCfgNotFound`） |
| ③ | 必填（4 项）与值域校验同 `POST` ①②，**并做同一套三名单交叉校验**（**跳过唯一性** —— 两个定位键不可改，天然不冲突） |
| ④ | 事务：取本行 `ALARM_CFG_ID` → **UPDATE 通知行**（按该 ID 原地改全字段，**不删不新建**；仅当该 ID 为空 / 通知行缺失的历史脏数据才补插一行并回写）→ UPDATE 规则行（`SET` 不含 `ITEM` / `ENVIRONMENT` / `ID` / 审计）→ 提交 |
| ⑤ | 回参：同 `POST` ⑤，重查后映射 |

**5 · `DELETE`**

| 步骤 | 动作 |
|---|---|
| ① | `item` / `environment` 必填；缺失 ⇒ `RequireParameterMissing` |
| ② | **加锁查对象**：调 `FvFetchObjectLockTxn`（`item + environment`，**加锁模式**）—— 与 `PUT` 同一把键锁、同键串行；查不到 ⇒ **未创建不允许删除**（`LogMonitorCfgNotFound`） |
| ③ | 事务：**通知行与监控行一起删**——按本行 `ALARM_CFG_ID` 删 `FabViewerAlarmCfg` → 删 `FabViewerLogMonitorCfg` → 提交 |
| ④ | **已产生的 Alarm 一律不动**（运行时的历史数据与本表无外键关系） |
| ⑤ | 回参：`data` 为空 |

**6 · `priority/list`**

| 步骤 | 动作 |
|---|---|
| ① | 无入参；按 `ITEM = 'system.global.priority'` 读 Misc 一行 |
| ② | 取 `VALUE` 按 Misc §6.2 判形态并展平成字符串集合；**解析为空 / 结构不认** ⇒ 回落 `DEFAULT_VALUE`，同样方式解析 |
| ③ | 两者皆空 ⇒ 返回 `[]`（**不报错**，前端下拉空、不阻断页面） |
| ④ | 去重 + **字符串升序**排序后输出 `List<string>` |
| ⑤ | 不缓存：单行主键查询，开销可忽略；Misc 改完即时生效 |

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
| `ParameterInvalid` | 长度超限、`notifyInterval` 非整数或超出 `1~99999`、邮箱 / webhook 格式不合规、JSON 序列化超长 | 定位到字段的红字提示 |
| `LogMonitorCfgExists` | `item + environment` 已存在（创建时） | 提示「同环境下该规则名已存在」 |
| `LogMonitorCfgNotFound` | `detail` 查不到；`PUT` / `DELETE` 时该 `item + environment` 未创建 | 提示后刷新列表 |
| `EnvironmentNotAllowed` / `PriorityNotAllowed` | 值不在 Misc 值域内（含 Misc 未配） | 提示去 System Misc 先配候选值 |
| `RuleNameConflict` | 关注名单与排除名单有重复的 Rule Name | 提示重复项，定位到两个名单行 |
| `ExcludeKeywordInvalid` | 存在「排除词是 keyword 子串（含相等）」的配置 | 提示该排除词会让规则永不生效，定位到排除关键字行 |

> 前 4 个是整体库既有码，直接复用；`EnvironmentNotAllowed` / `PriorityNotAllowed` / `RuleNameConflict` / `ExcludeKeywordInvalid` 为本模块新增，需在 `模块6/05` §十的错误码表登记。
> 值域校验逻辑**只实现一份**（`POST` / `PUT` 共用的校验函数），内部统一调 Misc 的 By Item 查询 Txn。

## 5. 已确认口径（配置侧）

| # | 口径 |
|---|---|
| 1 | **一条配置 = 一个规则 = 一个关键字**：`Item + Environment` 唯一；要监控多个关键字就建多条配置（规则名各不相同） |
| 2 | 配置页与展示页同属一个功能；配置页挂 **`config` 模块 → 系统配置** 下，菜单名 `MES Log Monitor Config` / `MES日志监控配置`，走**菜单级权限管控**（无权限则入口不可见、接口不可调） |
| 3 | 报警等级 `P1`~`P4` 配在**规则级**；**值域来自 Misc `system.global.priority`** —— 后端读 Misc 校验、前端走 `/api/v1/sys_misc/priority/list` 取候选（该接口**归属 Misc 模块**，规格写在本篇 §4.1-6） |
| 4 | 「规则名称」= 一条规则的标识名（如 `PROD-ORA-EXCEPTION`）；`Item + Environment` 是定位键，**编辑态锁定不可改** —— 要换就删了重建 |
| 5 | **配置分两张表**：`FabViewerLogMonitorCfg`（规则，§2.1）+ `FabViewerAlarmCfg`（通知，§2.2）；通知配置**随规则走**（1:1、同事务写、不单独维护、页面不提供复用），**无名称字段** |
| 6 | 飞书走**群自定义机器人 webhook**：一份配置可填多个群（`FeishuWebhooks` JSON 数组），逐群各发一条；@ 人用 `open_id` 且须在该群才生效 |
| 7 | `NotifyInterval` **默认 5 分钟，取值范围 `1 ~ 99999`**（整数，单位分钟） |
| 8 | **不设 `enabled`**（配置即启用）；`createdAt` / `createdBy` / `updatedAt` / `updatedBy` 由底层统一赋值 |
| 9 | 三个 JSON 数组字段按**字符**校验 ≤4000；空 / 未配置存 `NULL` |
| 10 | 接口定位键统一 `item + environment`（不用 `id`）：`detail` / `DELETE` 走 query 参数，`PUT` 的定位键收在 `LogMonitorCfgRo` body 里、不额外传 query；定位键只用于查记录，不参与更新 |
| 11 | 「特殊 Rule Name」已更名为「**关注 Rule Name**」（字段 `FollowRuleNames`），**白名单语义不变**：配了则只有命中名单内 Rule Name 才告警；三个名单统一用**多字符串输入控件**（回车成条、可逐条删） |
| 12 | **值域与存在性校验统一走 Misc 的 By Item 查询 Txn**（`mes.global.environments` / `system.global.priority`）：取行值后按 Misc §6.1~§6.3 解析比对，不直连 Misc 表、不复刻解析逻辑；`environment` / `item` / `keyword` / `priority` 四项必填 |
| 13 | **存在性判断统一走 `FvFetchObjectLockTxn`**（入参 `item + environment`）：`POST` 走**不加锁**模式、只判断是否存在，已存在则拒；`PUT` / `DELETE` 走**加锁**模式、同键串行，未创建则拒 |
| 14 | **通知对象的写语义**：创建先建 `AlarmCfg` 再建规则；修改**原地 UPDATE 通知行**、不删不新建；删除时两表一起删 |
| 15 | **三名单两条交叉校验**（`POST` / `PUT` 同源、前后端同源）：① 排除关键字**不得是 `keyword` 的子串（含相等）**——否则规则永不生效；② **关注名单与排除名单不得有交集**，否则该 Rule 必被排除。比较口径与运行时「包含」判定一致（区分大小写） |
| 16 | `Item` **≤30 字符**且只允许 `_` `-` 大小写字母数字（`^[A-Za-z0-9_-]{1,30}$`）；`Keyword` **≤30 字符**、不限字符类型；`Description` ≤255 支持多行 |
| 17 | 规则弹框**两个 Tab**（`Keyword 配置` → `Alarm 配置`），**底部按钮组随 Tab 切换**：Tab 1 为 `取消` + `Next`；Tab 2 为 `Previous` + `取消` + `确认`；`Previous` 回 Tab 1 并恢复成 `取消` + `Next`；`Next` 先校验本页，`确认` 校验后提交（新增 `POST` / 修改 `PUT`） |
| 18 | 配置的保存与删除**不是立即生效** —— 告警服务下次加载配置后才按新配置执行（通常 1 个扫描周期内），页面须明确提示 |
| 19 | `Alarm 配置` Tab 用**分割符**分三段（通知间隔 → 邮件通知 → 飞书通知）：**只有「通知间隔」必填且限 `1~99999` 整数**，其余（To / CC / 飞书群 / @ 人）全部可空；**邮箱格式在提交时逐个校验，不过则报错、不允许提交**（后端同源兜一次） |
| 20 | **邮件只在 `MailToUsers` 非空时发送** —— 只填 CC 不填 To ⇒ 邮件不发（CC 不顶替收件人），飞书不受影响 |

## 6. 待确认

（无）
