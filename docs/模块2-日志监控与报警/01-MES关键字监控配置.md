# MES 关键字监控 · 配置文档

> 模块 2 · 日志监控与报警 ｜ 功能 1 ｜ 状态：**配置侧定稿**（2026-11-09：两张配置表、配置页、接口与出入参全部闭环）。判定 / 展示 / 扫描 / 通知等**运行时**内容见 [`02-MES关键字监控与告警.md`](02-MES关键字监控与告警.md)。

## 1. 功能定位

MES 运行时会产生各种错误 —— 比如日志里出现 `ORA-` 就是 Oracle 报错。这类错误散在海量日志里，靠人翻看不现实。本功能**定时扫描日志**，命中预设关键字就生成 Alarm 并通知到人（扫描与判定逻辑见运行时文档 §2 / §4）。

本篇只管**配置侧**：定义「扫什么、按什么等级、通知给谁」。

## 2. 配置表

**入口**：配置页与监控展示页**位于同一功能内**，靠**权限字符串**控制能不能打开配置（具体权限码待定）。

**配置分两张表**：

- **表一 `FabViewerLogMonitorCfg`**（§2.1）—— 监控规则本身：环境 + 规则名 + 关键字 + 三道检查的名单 + 报警等级 + 关联的通知配置；
- **表二 `FabViewerAlarmCfg`**（§2.2）—— 通知配置：收件人（邮件 / 飞书）+ 汇总发送间隔。**随规则走、不单独维护**：在规则弹框里就地配置，保存时同事务写入，一条规则对应一份（1:1）。

> **一条配置 = 一个规则 = 一个关键字**：`Item + Environment` 唯一。要监控多个关键字就建多条配置（规则名各不相同）。旧口径「一条规则下挂多行关键字」随唯一索引一并作废。

**规则字段（落 `FabViewerLogMonitorCfg`）**

| 字段 | 列名 | 必填 | 说明 |
|---|---|---|---|
| 环境名 | `Environment` | 必填 | 下拉，候选来自 Misc `mes.global.environments`；≤30 |
| **规则名称** | `Item` | 必填 | 规则标识名，如 `PROD-ORA-EXCEPTION`；≤63。汇总表按「环境名 + 规则名称」分组 → **一条规则占一行** |
| **关键字** | `Keyword` | 必填 | **一条配置一个关键字**；≤255 |
| 描述 | `Description` | 可选 | 这条规则是干什么的；≤255 |
| 排除关键字 | `ExcludeKeywords` | 可选 | json list，**词级**黑名单；≤4000 |
| 特殊 Rule Name | `SpecialRuleNames` | 可选 | json list，**Rule 级**白名单；≤4000 |
| 排除 Rule Name | `ExcludeRuleNames` | 可选 | json list，**Rule 级**黑名单；≤4000 |
| **报警等级** | `Priority` | 必填 | `P1` ~ `P4`；**值域来自 Misc `system.global.priority`**（后端读 Misc 校验，前端走 `priority/list` 取候选）；≤20 |
| **通知配置** | `AlarmCfgId` | 必填 | 关联 `FabViewerAlarmCfg.ID`；≤50 |

> 收件人（邮件 / 飞书）**不在规则表里**，落在 `FabViewerAlarmCfg` 靠 `AlarmCfgId` 关联；但**没有独立的配置页和接口** —— 它是规则的附属，在规则弹框的「通知」区块里一起编辑、一起提交。

### 2.1 表一 · `FabViewerLogMonitorCfg`（监控规则）

| 字段 | 长度 | 可空 | 说明 |
|---|---|---|---|
| `ID` | ≤50 | 否 | 主键（按全项目表规范，长度对齐 `FabViewerAlarmCfg.ID`） |
| `Item` | ≤63 | 否 | 规则名称 |
| `Environment` | ≤30 | 否 | 环境名 |
| `Keyword` | ≤255 | 否 | 关键字 |
| `Description` | ≤255 | 是 | 描述 |
| `ExcludeKeywords` | ≤4000 | 是 | JSON 数组，元素为字符串 |
| `SpecialRuleNames` | ≤4000 | 是 | JSON 数组，元素为字符串 |
| `ExcludeRuleNames` | ≤4000 | 是 | JSON 数组，元素为字符串 |
| `Priority` | ≤20 | 否 | 报警等级，值域由 Misc `system.global.priority` 决定 |
| `AlarmCfgId` | ≤50 | 否 | 关联 `FabViewerAlarmCfg.ID` |

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
| `NotifyInterval` | ≤10 | 否 | **汇总发送间隔（整数，单位分钟）**，默认 **5**、最小 **1** |

> 无 `Item` / `Description`：页面上的引用下拉按「`ID` + 收件人摘要（如 `a@x.com, b@x.com + 2 群`）」展示，不引入名称字段。

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
### 3.1 配置页布局

页面为**单栏**（不用 System Misc 的左侧分类栏）—— 规则天然带环境维度，用顶部筛选器就够，也省一层加载。

**顶部工具条**

| 位置 | 内容 |
|---|---|
| 左 | `关键字` 输入框（入参名 `keyword`，对 `item` / `description` / `environment` / `keyword` **四个栏位前后模糊匹配**，任一命中即返回）—— 不设独立的环境筛选下拉，搜环境名即可 |
| 右 | `+ 新建规则` 主按钮（无**编辑权限**时该按钮隐藏，搜索与浏览照常可用，页面转只读） |

**列表**（每页条数由分页组件默认值决定，不再单独指定；按 `Environment + Item` 升序）

| 列 | 内容 |
|---|---|
| 环境 | 原样显示 |
| 规则名称 | 加粗；超 **30 字符**省略 + hover 看全 |
| 关键字 | 等宽字体；超 **30 字符**省略 + hover 看全 |
| 等级 | `P1`~`P4` 色标（P1 红 / P2 橙 / P3 黄 / P4 灰），与展示页同一套（运行时文档 §3.1） |
| 通知 | 摘要「N 人 / M 群 / X min」；两边都空时显示灰字「未配置」 |
| 更新时间 | `yyyy-MM-dd HH:mm:ss`，取 `page` 出参的 `lastUpdatedTime`（§4.2） |
| 操作 | `编辑` / `删除`（删除**二次确认**，提示「删除后不再扫描该规则，已产生的报警保留」） |

> 空态 / 加载态 / 无权限态一律沿用 `05-视觉与交互规范`。

### 3.2 规则弹框（新建 / 编辑同一组件）

纵向两个区块，字段不多，**不拆 Tab**。

**区块一 · 规则**

| 字段 | 控件 | 校验 |
|---|---|---|
| 环境 | 下拉 | 必填；候选来自 `mes.global.environments`；**编辑态锁定**（与规则名共同构成定位键，见下） |
| 规则名称 | 输入框 | 必填 ≤63；保存时校验 `Item + Environment` 唯一；**编辑态锁定不可改** —— `Item + Environment` 是定位键，改了等于换一条，要换就删了重建 |
| 关键字 | 输入框 | 必填 ≤255 |
| 描述 | 输入框 | ≤255，可空 |
| 报警等级 | 下拉 | 必填；候选来自 `priority/list` |
| 排除关键字 | 标签输入（回车成 tag，可单个删） | 序列化后 ≤4000 |
| 特殊 Rule Name | 标签输入 | 序列化后 ≤4000 |
| 排除 Rule Name | 标签输入 | 序列化后 ≤4000 |

**区块二 · 通知**（落 `FabViewerAlarmCfg`，随规则一起提交）

| 字段 | 控件 | 校验 |
|---|---|---|
| 收件人 To | 标签输入 | 邮箱格式，可多个 |
| 抄送 CC | 标签输入 | 邮箱格式，可多个 |
| 飞书群 | **多行文本域，一行一个地址**（webhook 太长，用标签不好粘贴） | 每条须匹配群机器人地址格式 `https://open.feishu.cn/open-apis/bot/v2/hook/…` |
| @ 人 | 标签输入 | `ou_` 开头的 open_id，可多个 |
| 汇总间隔 | 数字输入 + 「分钟」后缀 | 整数 **≥1**，默认 **5** |

> 飞书群字段下方常驻灰字提示：「**@ 的人必须在对应群里**，否则 @ 不生效（消息照发）」。

**底部**：`取消` / `保存`。保存成功后：新增 ⇒ 刷新回第 1 页；编辑 ⇒ 原地替换该行。

### 4.1 接口清单

服务内前缀 `/api/v1/log_monitor`，前端调用加网关前缀 `telemetry-hub`；响应外壳与分页结构沿用整体库（`模块6/05-后端设计`）。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `/api/v1/log_monitor/cfg/page` | `GET` | 分页查询（`keyword` 四栏位模糊） |
| 2 | `/api/v1/log_monitor/cfg/detail?item=&environment=` | `GET` | 详情（编辑回填，含通知配置） |
| 3 | `/api/v1/log_monitor/cfg` | `POST` | 新建规则（同事务写通知配置） |
| 4 | `/api/v1/log_monitor/cfg?item=&environment=` | `PUT` | 修改规则（同事务更新通知配置） |
| 5 | `/api/v1/log_monitor/cfg?item=&environment=` | `DELETE` | 删除规则（连带删通知配置） |

> **定位键统一是 `item + environment`**（唯一索引），不用 `id`：详情、修改、删除三个接口都用这两个 query 参数定位；弹框里两者编辑态锁定，定位键全程不变。
> **通知配置没有独立接口** —— 不收 `alarmCfgId` 入参，也不暴露 `/alarm_cfg/*`，全部随规则的写操作在同一事务内完成。读接口（`page` / `detail`）对只读用户开放，写接口（`POST` / `PUT` / `DELETE`）需**编辑权限**。

> **报警等级候选接口（本功能专用下拉）**：`GET /api/v1/sys_misc/priority/list` —— 无入参，出参 `data` = `List<string>`（去重 + 字符串升序，如 `["P1","P2","P3","P4"]`）。数据源为 Misc 表 `item = system.global.priority`（`List<string>` 形态）；取数与回落规则同 Misc 候选接口（`value` 空 ⇒ 取 `defaultValue`，两者皆空 ⇒ `[]`）。该接口挂 `sys_misc` 前缀（数据源在 Misc 表），**文档归本篇维护**（原写在 Misc §六，2026-11-09 拆出）。

**1 · `page`（GET）** 入参：`pageIndex`、`pageSize`（分页组件默认值）、`keyword`（可空；对 `item` / `description` / `environment` / `keyword` 四栏位 contains，任一命中即返回）。出参 `data` = `Pageable<LogMonitorCfgDto>`。

**SQL 取数**：主表 `FabViewerLogMonitorCfg` **LEFT JOIN** `FabViewerAlarmCfg` ON 主表.`ALARM_CFG_ID` = `FabViewerAlarmCfg`.`ID`。两表 1:1（或 1:0），理论上一条规则一行；但出参仍**以主表行为准做去重**，防止连接意外产生重复行（主表数据不重复是前提，AlarmCfg 侧异常不放大到列表）。

**2 · `detail`（GET）** 入参 `item` + `environment`，查不到 ⇒ 拒。出参 `data` = **单个 `LogMonitorCfgDto`**（含嵌套 `alarmCfg`），供编辑弹框回填。

**3 · `POST`** 入参 `LogMonitorCfgRo` → 校验 → 唯一性检查 → **事务内**插 `AlarmCfg` 拿 ID、插规则 → 回 `LogMonitorCfgDto`。

**4 · `PUT`** 入参 `LogMonitorCfgRo`（与 `POST` 同一对象），按 query 的 `item + environment` 定位，不存在 ⇒ 拒 → 校验 → **事务内**按规则的 `AlarmCfgId` 更新通知配置、更新规则 → 回 `LogMonitorCfgDto`。**后端处理时不改 `item` / `environment` 两项** —— Ro 里即使带了这两个字段也一律忽略（定位键不可改）。

**5 · `DELETE`** 按 `item + environment` 定位 → **事务内**删规则、删其 `AlarmCfg` → 成功返空。**已产生的 Alarm 一律保留**。

**后端校验（5 条，前后端同源）**

1. `environment` 必须存在于 Misc `mes.global.environments`；
2. `priority` 必须存在于 Misc `system.global.priority`；
3. `item + environment` 唯一（仅 `POST` 校验 —— `PUT` 不可改这两项，天然不冲突）；
4. 三个 JSON 数组**序列化后**各 ≤4000 字符；
5. `notifyInterval` 为整数且 ≥1。

### 4.2 出入参对象

**`LogMonitorCfgRo`（入参）**

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `environment` | string | 是 | ≤30，须在 Misc 值域内 |
| `item` | string | 是 | ≤63 |
| `keyword` | string | 是 | ≤255 |
| `description` | string | 否 | ≤255 |
| `excludeKeywords` | `List<string>` | 否 | 序列化 ≤4000 |
| `specialRuleNames` | `List<string>` | 否 | 序列化 ≤4000 |
| `excludeRuleNames` | `List<string>` | 否 | 序列化 ≤4000 |
| `priority` | string | 是 | 须在 Misc 值域内 |
| `alarmCfg` | `AlarmCfgRo` | 是 | 嵌套，见下 |

**`AlarmCfgRo`（嵌套入参）**

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `mailToUsers` | `List<string>` | 否 | 邮箱格式，序列化 ≤4000 |
| `mailCCUsers` | `List<string>` | 否 | 同上 |
| `feishuWebhooks` | `List<string>` | 否 | 群机器人地址，序列化 ≤4000 |
| `feishuAtUsers` | `List<string>` | 否 | open_id 列表，序列化 ≤4000 |
| `notifyInterval` | int | 是 | ≥1，默认 5 |

**`LogMonitorCfgDto`（出参，字段与 `Ro` 完全同形；**不带 `id` 与四个审计字段**），另带两个列表展示字段**：

| 字段 | 类型 | 取值逻辑 |
|---|---|---|
| `lastUpdatedTime` | string | 审计字段 `updatedAt` **有值** ⇒ 取 `updatedAt`；为空 ⇒ 取 `createdAt` |
| `lastUpdatedUser` | string | 审计字段 `updatedBy` **有值** ⇒ 取 `updatedBy`；为空 ⇒ 取 `createdBy` |

> 这两个字段**只在 `page` 出参里填**（列表「更新时间」列用，连带 `lastUpdatedUser` 可作悬浮提示）；`detail` / `POST` / `PUT` 回的单条对象同样带字段结构，但值为空不填也允许。

**`AlarmCfgDto`（嵌套出参，同 `AlarmCfgRo`，不带 `id`）**

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
    "specialRuleNames": ["EAPReqJobInEx"],
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

## 5. 已确认口径（配置侧）

| # | 口径 |
|---|---|
| 1 | **一条配置 = 一个规则 = 一个关键字**：`Item + Environment` 唯一；要监控多个关键字就建多条配置（规则名各不相同） |
| 2 | 配置页与展示页同属一个功能，靠**权限字符串**控制能否打开配置；权限归口模块 6 的用户与权限管理，本模块只消费 |
| 3 | 报警等级 `P1`~`P4` 配在**规则级**；**值域来自 Misc `system.global.priority`** —— 后端读 Misc 校验、前端走 `priority/list` 取候选（§4.1） |
| 4 | 「规则名称」= 一条规则的标识名（如 `PROD-ORA-EXCEPTION`）；`Item + Environment` 是定位键，**编辑态锁定不可改** —— 要换就删了重建 |
| 5 | **配置分两张表**：`FabViewerLogMonitorCfg`（规则，§2.1）+ `FabViewerAlarmCfg`（通知，§2.2）；通知配置**随规则走**（1:1、同事务写、不单独维护、页面不提供复用），**无名称字段** |
| 6 | 飞书走**群自定义机器人 webhook**：一份配置可填多个群（`FeishuWebhooks` JSON 数组），逐群各发一条；@ 人用 `open_id` 且须在该群才生效 |
| 7 | `NotifyInterval` **默认 5 分钟、最小 1 分钟** |
| 8 | **不设 `enabled`**（配置即启用）；`createdAt` / `createdBy` / `updatedAt` / `updatedBy` 由底层统一赋值 |
| 9 | 三个 JSON 数组字段按**字符**校验 ≤4000；空 / 未配置存 `NULL` |
| 10 | 接口定位键统一 `item + environment`（不用 `id`）；`PUT` / `DELETE` 用 query 参数定位，`PUT` 忽略 Ro 里的 `item` / `environment` |

## 6. 待确认

| # | 问题 | 状态 |
|---|---|---|
| 1 | 「特殊 Rule Name」是否改名（建议「关注 Rule Name」/「仅监控 Rule Name」，白名单语义更直白） | ⏳ 待定 —— 改名的话运行时文档 §2 的判定文案同步改 |
