# 系统级配置 · System Misc

| 项 | 内容 |
|---|---|
| 模块 | 模块 5 · 系统管理 · **系统级配置**（System Misc） |
| 使用者 | IT 运维（配置维护）；全部功能页面的下拉候选（间接消费） |
| 状态 | **定稿**（2026-11-09 修订：PUT 收窄为**只改 value / defaultValue**，入参对象改 `ChangeSystemMiscValueRo`；编辑入口加**编辑权限点**；Boolean 落库转**大写 `TRUE` / `FALSE`**；长度一律按**字符**校验；卡片按 `item` 升序（SQL `order by item`）；候选接口收进 `sys_misc` 前缀；左列表**保留「全部」为第一项**、`category` 可为空；布尔拨动**二次确认**；并发按 `item` **加锁串行**；Json 草稿保留、两 tab 共用一个 radio；文本值 hover 看全；有改动关弹框需确认） |
| 来源 | `FabViewerMisc` 表曾议后搁置（无消费方），System Misc 使其归位 |

> 本篇按 `01-Server Hang Reason Config` 的格式组织；表规范沿用全项目约定，界面令牌沿用 `05`。

---

## 一、功能定位

| 项 | 内容 |
|---|---|
| 功能名 | 中文 **系统级配置** ／ English **System Misc**（界面文案双语，走 `05` §4.6） |
| 干什么 | 维护**全局使用的变量**（环境名列表、IP 列表等），一处配置、各处消费 |
| 权限 | **功能权限 + 编辑权限两级**：无功能权限 ⇒ `05` §4.3 的无权限态（插画 + 说明），不请求数据、不暴露任何配置内容；有功能权限但**无编辑权限** ⇒ 页面只读浏览（卡片、Json 查看可用），**「可编辑」总开关不显示**（或置灰，§3.3）。编辑权限点由模块 6 角色权限下发 |
| 形态 | 配置页（**Body 左右布局**：左侧 Category List ＋ 右侧卡片列表 / 可编辑总开关 / 查看·编辑弹框）＋ Oracle 表 `FabViewerMisc` |
| 操作边界 | **只维护既有配置项**：页面**不提供新增、不提供删除**，只有**编辑** —— 配置项清单由初始化脚本 / 运维落库，页面不改清单，只改内容 |
| 与 Reason Config 的差别 | 那边是**某一功能的专用配置**（Hang 判定）；这边是**全局变量的家** —— 候选值接口（`env/list`、`ipaddress/list` 等）的数据源（§六） |

---

## 二、配置表 `FabViewerMisc`

| 字段 | 长度 / 取值 | 说明 |
|---|---|---|
| `id` | — | 技术主键（全项目表规范） |
| `item` | ≤ **255** | 配置项名 —— **唯一索引**；接口层与页面均以它定位（§五） |
| `category` | ≤ **255** | 分类 —— **必填**；字符不限（非空即可）；下拉候选 = 本表 `distinct(category)`（自举，不另立清单） |
| `description` | ≤ **255** | 描述 —— 纯文本，不限字符格式；可空；页面左下角小字单行展示（**页面与接口均无修改入口**，只能初始化脚本 / 运维改库） |
| `valueType` | 枚举 | **必填、无默认值**（提交缺失即报错）；取值 `Boolean` / `Text` / `Integer` / `Float` / `Json`，决定 `value` 与 `defaultValue` 的校验规则（§四） |
| `value` | ≤ **4000** | 配置值 —— 按 `valueType` 校验；**一律可空**（Boolean 也允许空，空时以 `defaultValue` 为准） |
| `defaultValue` | ≤ **4000** | 默认值 —— 规则与 value 一致；差别：**Boolean 型 `defaultValue` 不可空**；Json 空值落 `[]` |
| `createdAt` / `createdBy` | — | 审计，创建时自动 |
| `updatedAt` / `updatedBy` | — | 审计，保存时自动 |

与旧议形态的差异：① 新增 `valueType`、`defaultValue`；② 审计补齐创建侧（`createdAt` / `createdBy`）；③ **取消 `enabled`**（配置项的存在与否就是开关，不设停用态）；④ **取消 Single / Multi 双模型**，Value 形态改由 `valueType` 决定（§四）。

---

## 三、页面逻辑（Body 左右布局）

Body 分左右两栏：**左 = Category List**（分类切换，§3.2）；**右 = 卡片列表 + 「可编辑」总开关 + 查看 / 编辑弹框**（§3.3 ~ §3.5）。**不设搜索区、不设分页** —— 选中一个分类即取该分类下全部配置。

### 3.1 进页面加载顺序（强约束）

| 步 | 动作 |
|---|---|
| 1 | 调 `GET telemetry-hub/api/v1/sys_misc/category/list` 取分类数组（已去重排序） |
| 2 | **默认选中「全部」**（左列表第一项，本地固定项，不来自接口） |
| 3 | 带当前选中项调 `GET telemetry-hub/api/v1/sys_misc/list`：选中「全部」⇒ **不带 `category`**，取全表；选中具体分类 ⇒ 带 `category` 取该分类。一次取回**全部** Misc（不分页） |
| 4 | 分类数组为空 ⇒ 左列表**只剩「全部」**，右栏按第 3 步查出全表（表也空则空态「暂无配置」） |

> 顺序不能颠倒：**先分类、后列表**。选中项变化才触发第 3 步，切换分类时右栏整体替换（不留旧数据、不叠加）。

### 3.2 左侧 Category List

| 项 | 口径 |
|---|---|
| 数据源 | `category/list`，展示顺序 = 接口返回顺序 |
| 「全部」 | **恒显示，且为第一项**（本地固定项，非接口数据）；进页面**默认选中它** |
| 选中「全部」 | 调 `list` 时**不带 `category`** ⇒ 返回全表（仍 `order by item`） |
| 选中态 | 选中项**字号放大**（常规 `14px` → 选中 `16px` 加粗 + 主色 `#2F7D5A`），与其余项**明显区分**；未选中为 `14px` 常规、次级灰 |
| 点击 | 切换分类 ⇒ 重新调 `list`（§3.1 第 3 步）；选中态样式随点击即时切换 |
| 条数计数 | 不做 —— 只出分类名 |
| 刷新时机 | 编辑只改 `value` / `defaultValue`（§5.2），**category 不可改** ⇒ 左列表无需因编辑而刷新；保存成功后仅右侧对应卡片按返回值替换 |
| 空表 | 分类候选为空 ⇒ 左列表只剩「全部」，右侧照常出全表（空则空态） |

### 3.3 右侧卡片列表

**容器**：卡片纵向排列，容器内滚动（**不分页**，一次渲染该分类全部项）。卡片沿用 `05` 令牌 —— 圆角基准 `10px`、内边距 `20px`（舒适档），卡片间 `12px`。

**排序**：按 `item` **升序** —— 由 `list` 接口 SQL 的 `order by item` 保证（§5.1），前端按返回顺序直接渲染，不再排。

**单张卡片的三区排版**：

| 区域 | 内容 |
|---|---|
| **左上** | `item` —— `14px`、`colorText` 加粗（主标识） |
| **左下** | `description` —— `12px` 次级灰，单行、超长省略号（库内已限 **≤255**） |
| **右侧（垂直居中）** | `value` 与 `defaultValue`，行为见下 |

**右侧 value 区（按 `valueType` 渲染）**：

| `valueType` | 呈现 |
|---|---|
| **Boolean** | **开关**：`true` = 打开，`false` = 关闭。**显示值 = `value` 为空时取 `defaultValue`**（`defaultValue` 永不为空） |
| **Text / Integer / Float** | **一行文本**，字号与颜色**与 item 一致**（`14px`、`colorText`）；超过 **20 字符**省略号截断，**hover 提示完整值** |
| **Json** | **「…」三点按钮** —— 点击查看完整 JSON（只读弹框，§3.4） |

`defaultValue` 的呈现：跟在 value 之后同区显示，`12px` 次级灰、前缀「默认」；截断规则同 value（同样 hover 看全）。

**「可编辑」总开关（列表上方，仅对有编辑权限的用户可见）**：

| 状态 | 效果 |
|---|---|
| **默认：关闭** | 非布尔类型的**编辑按钮隐藏**；布尔开关**置灰禁用**（状态照常显示，不可拨动） |
| 打开 | 非布尔类型（Text / Integer / Float / Json）value **最右侧显示编辑按钮**；布尔开关**可拨动** |

- 布尔开关与编辑按钮**同受这一个总开关管控**，不设第二个入口。
- 布尔开关拨动**需二次确认**：拨动后弹确认框（如「确认将 `mes.xxx` 改为 **开启**？」）—— 确认才走 `PUT`（只改 `value`，入参 `ChangeSystemMiscValueRo`，§5.2），成功后卡片按返回值刷新；**取消则开关回弹到原状态**，不发请求；`PUT` 失败同样回弹并提示。
- **总开关不是权限闸门，是防误触**：真正的编辑权限判定在权限点 —— 无编辑权限的用户整个总开关都不出现（§一）。

### 3.4 查看弹框（Json「…」触发）

只读：展示该配置项完整 JSON（`value` 与 `defaultValue` 并列，等宽字体、可滚动），**不带编辑控件**，底部只有 `关闭`。

### 3.5 编辑弹框（编辑按钮触发）

**顶部字段（全部只读展示）** —— 编辑只涉及 value / defaultValue（§5.2），其余字段在页面上**一律不可改**：

| 字段 | 口径 |
|---|---|
| Item | **锁定**（定位键，不可改） |
| Category | **只读展示**（接口不支持改，§5.2） |
| Description | **只读展示**（接口不支持改，§5.2） |
| Value Type | **锁定**（不可改）—— 类型是配置项的固有契约，要换类型只能另立新项 |

> 要改 `category` / `description` 只能由运维直接在数据库中改 —— 页面与接口都没有入口。

**形态 radio（位于 Tab 上方，全弹框共用一个）**：`List` / `Map` 两个 radio —— **value 和 defaultValue 共用这一个选择**，切换 radio 时两个 tab 的编辑区一起切换。

- **切换保留草稿**：List 与 Map 两个形态**各留一份草稿**，来回切换数据不丢；**最终提交以当前选中的 radio 为准**（未选中的那份草稿丢弃）。
- **草稿生命周期**：编辑期间保留；**关闭弹框（含确认成功 / 取消 / ESC / 点遮罩）后自动清除**，下次打开按库中数据重新初始化。
- **打开弹框时 radio 默认选中**：按当前数据实际形态反推（数组 ⇒ List，对象 ⇒ Map）。

**下方 Tab：`Value` / `Default Value`** —— 两个 tab 各一个编辑区，**进弹框默认停在 `Value`**；两边的控件形态与校验规则完全一致（差别仅 Boolean 的 `defaultValue` 不可空、且不可编辑）。

> **Boolean 例外**：`Default Value` tab **只读**（只展示，不给编辑控件）—— 布尔默认值不开放给页面改，需要时运维直接改库。

**底部按钮**：`取消`（**有改动时先弹「放弃修改？」确认**，无改动直接关）／`确认`（先校验**两个 tab**，通过后走 `PUT`；不过则停在弹框内报错，不关闭）。Boolean 型只有一个可编辑区（`Value`），校验也只走它。

**Tab 内控件（按 `valueType`）**：

| `valueType` | 控件 |
|---|---|
| **Text** | **输入框**：不卡字符类型，只卡长度 ≤4000 |
| **Integer** | **输入框**：仅整型，非整型即时报错；长度 ≤4000 |
| **Float** | **输入框**：仅浮点，非浮点即时报错；长度 ≤4000 |
| **Boolean** | **开关**。`Value` tab 可改、允许留空；**`Default Value` tab 只读** —— 页面不提供布尔默认值的编辑入口（要改由运维直接在库里改，§4 注） |
| **Json** | 编辑区形态由 Tab 上方的共用 radio 决定（`List` / `Map`，§上）；两区交互见下 |

**Json · List 编辑区**：

| 区域 | 行为 |
|---|---|
| 列表（上方） | 自上而下逐行展示已有元素；**每行末尾一个删除图标**，点击即移除该元素 |
| 新增图标按钮（列表**上方**） | 点击 ⇒ 在列表**第一行**插入一个**空输入框**，**焦点立即落在该输入框** |
| 失焦处理 | **有值** ⇒ 保留这一行（成为正式元素）；**无值** ⇒ 收回该输入框，**不产生新行** |

**Json · Map 编辑区（左 Key / 右 Value 两列）**：

| 区域 | 行为 |
|---|---|
| **左列 · Key** | 与 List **同一套输入形式**：自上而下逐行展示 key；每行末尾删除图标，点击即删该 key **并连带删掉它的 value**；**列表左上角一个主题色新增图标**，点击在**第一行**插入空输入框并聚焦，失焦有值则保留、无值则收回 |
| **左列 · 修改** | 已有 key 行显示**蓝色修改图标**（`#1677FF`），点击转为输入框改名；改名后该 key 的 value 跟着走 |
| **右列 · Value** | 展示**当前选中 key** 的 value：`string` ⇒ **只显示一行**；数组 ⇒ **按列表显示多行**。每行的增删与 List 完全一致（行末尾删除图标 + 列表上方新增图标 + 失焦保留规则） |
| **两列联动** | 点击左列某个 key ⇒ 右列**自动切到该 key 的 value**；删除 key ⇒ 其 value 一并删除 |

**图标口径（List 与 Map 共用一套颜色）**：

| 图标 | 颜色 | 出现位置 |
|---|---|---|
| **新增** | 主题色 `#2F7D5A`（`05` §2.2） | List 左上角、Map 左列左上角、Map 右列 value 列表上方 |
| **修改** | Info 蓝 `#1677FF`（`05` §2.3） | **仅 Map 左列的 key 行** —— List 与 value 行没有修改图标（本身就是输入框，直接改） |
| **删除** | 次级灰，**不做标记**、点了直接从列表移除（无二次确认） | 每行末尾 |

**提交时的形态折算**（两个 tab 都按**当前选中的 radio** 折算）：

| 场景 | 落库 JSON |
|---|---|
| radio = List | value / defaultValue 均落字符串数组，如 `["PROD","PIRUN"]` |
| radio = Map，某 key 的 value **≤1 行** | `{"PROD":"10.18.100.1"}`（value 存 **string**） |
| radio = Map，某 key 的 value **>1 行** | `{"PROD":["10.18.100.1","10.18.100.2"]}`（value 存 **string 数组**） |
| radio = Map，某 key 的 value **0 行** | 按「≤1 行」处理，存空串 `""` |

**显示长度**：`key`、`value`、List 元素一律**单行显示，超 30 字符省略号**截断；完整内容走 **hover 提示**。

> **可编辑字段仅两个**：`value` / `defaultValue`。`item`（定位键）、`valueType`（类型契约）、`category`、`description` **一律不可改**（接口不支持，§5.2）。

**保存后**：接口返回的 `SystemMiscDto` 直接替换该卡片；`category` 不可改，左列表无需刷新（§3.2）。

---

## 四、Value / Default Value 校验规则（按 `valueType`）

`value` 与 `defaultValue` **同一套类型规则**；可空性上只有一处差别：**Boolean 型的 `defaultValue` 不可空**（`value` 一律允许空）。

**两条全局口径**：

- **长度一律按字符校验**（与其他页面的校验口径一致，不按字节）—— `item` ≤255 字符、`category` ≤255 字符、`description` ≤255 字符、`value` / `defaultValue` ≤4000 字符。
- **落库形态**：`value` / `defaultValue` 底层均为文本列，各类型按字符串原样落库，唯 Boolean 例外 —— **落库前转大写 `TRUE` / `FALSE`**（如 `"TRUE"`）；Text / Integer / Float / Json 均按原文（或序列化原文）字符串落库，出参时按 `valueType` 还原为对应类型。

| `valueType` | 规则 | `value` 可空 | `defaultValue` 可空 |
|---|---|---|---|
| **Boolean** | 仅 `true` / `false`；**落库转大写 `TRUE` / `FALSE`** | **是**（空 ⇒ 以 `defaultValue` 为准） | **否**（必须择一，不留空）；**页面不可改**，见下注 |
| **Text** | 任意文本 | 是（**空存 `NULL`**，不存空串） | 是（同左） |
| **Integer** | 整型；输入非整型**报错** | 是（空存 `NULL`） | 是（同左） |
| **Float** | 浮点型；非数字**报错** | 是（空存 `NULL`） | 是（同左） |
| **Json** | 只允许**三形态**（下详）；**空值统一落 `[]`**，不存 null | 是（空即 `[]`） | 是（空即 `[]`） |

> **Boolean 的 `defaultValue` 页面不可编辑**：弹框的 `Default Value` tab 只读，页面也**没有其他设置默认值的入口**。库层仍要求它非空（`true` / `false`），需要调整时**由运维直接在数据库中改**。接口侧同理 —— 修改 Boolean 型配置时**不更新 `defaultValue`**（§5.2 第 4 步）。

**Json 三形态**（顶层只能是其中之一）：

| 形态 | 写法 | 示例 |
|---|---|---|
| ① 字符串数组 | `List<string>` | `["PROD","PIRUN"]` |
| ② 字符串键值表 | `Map<string, string>` | `{"PROD":"10.18.100.1"}` |
| ③ 字符串键 + 字符串数组值 | `Map<string, List<string>>` | `{"PROD":["10.18.100.1","10.18.100.2"]}` |

Json 约束：

- Map 的 **key 一律 string**；value 为 **string** 或 **string 数组**，同一 Map 内两种写法可混用。
- **不嵌更深结构**：无 Map 套 Map、无「Map 数组」（旧版多 Map 并列形态作废）。
- **规模双卡**：**项数 ≤100**（顶层元素数；Map 按 key 数计）**且** 序列化原文 **长度 ≤4000 字符**，两条都要卡（后端一并校验）。
- **空值规范**：Json 型 `value` / `defaultValue` 为空时不写 null —— 数据库**统一存 `[]`**（页面空编辑器提交即 `[]`，后端落库前归一化）。

**控件映射**：

| `valueType` | 编辑控件 |
|---|---|
| Boolean | **开关**（`true` 开 / `false` 关）；`value` 允许空，空态在卡片上按 `defaultValue` 的状态显示 |
| Text | **输入框**：不卡字符类型，只卡长度 ≤4000 |
| Integer | **输入框**：仅整型，非整型即时报错；长度 ≤4000 |
| Float | **输入框**：仅浮点，非浮点即时报错；长度 ≤4000 |
| Json | 编辑区形态由弹框级共用 radio 决定（`List` / `Map`，§3.5）；List = 列表（每行末尾删除图标）+ 左上角主题色新增图标；Map = 左 Key / 右 Value 两列（key 行带蓝色修改图标）。交互见 §3.5；提交时 Map 的 value ≤1 行折成 `string`。整体受 ≤100 项 / ≤4000 字符双卡 |

**示例**：

- `mes.global.environments` · `Json` · `["PROD","PIRUN"]`
- `mes.global.ipaddresses` · `Json` · `{"PROD":["10.18.100.1","10.18.100.2"],"PIRUN":"10.18.200.1"}`
- `mes.rule.results` · `Json` · `["PASS","CANCELRULE"]`
- `max_retry_times` · `Integer` · `3`
- `enable_trace` · `Boolean` · `true`

---

## 五、接口清单

**路径前缀**：服务内统一 `/api/v1/sys_misc`（**不再带 `log-viewer`**）；前端调用时由网关加服务前缀，实际为 `telemetry-hub/api/v1/sys_misc/...`。

**响应外壳**：走**整体库**的全局响应包（`模块6/05-后端设计` §1.4）—— `code`（成功恒 `OK`）/ `success`（布尔，输出转 `0` / `1`）/ `errMsg` / `data` / `txId`。

> **本功能不提供分页接口** —— 选中分类即取该分类下全部配置、选中「全部」即取全表（§3.1），`data` 为数组，不用整体库的 `Pageable`。

| # | 接口（前端路径） | Method | 用途 |
|---|---|---|---|
| 1 | `telemetry-hub/api/v1/sys_misc/list` | `GET` | 按 `category` 取该分类下**全部** Misc |
| 2 | `telemetry-hub/api/v1/sys_misc` | `PUT` | 修改（页面唯一写操作） |
| 3 | `telemetry-hub/api/v1/sys_misc/category/list` | `GET` | Category List 候选（`distinct(category)` 去重排序） |

> **不做 `POST`（新增）/ `DELETE`（删除）** —— 配置项清单由初始化脚本 / SQL 落库，页面与接口均无增删能力（§一 操作边界）。

### 5.1 `list`（GET，URL 参数，**不分页**）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | string | 否 | **等值**过滤；**空 = 不过滤，返回全表**（左列表选「全部」时不带，§3.1 / §3.2） |

出参 `data` = **`SystemMiscDto` 数组**（选中分类 ⇒ 该分类全量；「全部」⇒ 全表全量；无分页包装；空 ⇒ `[]`）。**SQL 必须带 `order by item` 升序**，前端按返回顺序直接渲染（§3.3 排序口径）。

```json
{
  "code": "OK", "success": 1, "errMsg": "",
  "data": [
    { "item": "mes.global.ipaddresses", "category": "global",
      "description": "<描述文本>", "valueType": "Json",
      "value": { "PROD": ["10.18.100.1", "10.18.100.2"] },
      "defaultValue": [],
      "createdAt": "2026-10-13 16:20:11", "createdBy": "admin",
      "updatedAt": "2026-11-06 11:30:03", "updatedBy": "admin" }
  ],
  "txId": "3f9c1b7e2a4d"
}
```

（`id` 不出参 —— 行键即 `item`，定位与修改全走它。）

### 5.2 `PUT`（修改）

入参对象 **`ChangeSystemMiscValueRo`** —— **只改值，不带其他字段**（`category` / `description` 均无修改入口，页面与接口都没有）：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `item` | string | 是 | 定位键（唯一索引），≤255 字符 —— 与库中不一致按「不存在」拒 |
| `value` | any | 否 | 按库中 `valueType` 校验（§四），**可空**；Json 空 ⇒ 落 `[]` |
| `defaultValue` | any | 否 | 同 `value`；**Boolean 型忽略此字段**（不落库，页面无入口，§四 注） |

- **`category` / `description` / `valueType` 均不在 `ChangeSystemMiscValueRo` 中** —— 一律不可改；前端误传按未知字段忽略，不入库。
- **`PUT` 是整表单式提交**：`value` / `defaultValue` 两个字段**都传当前值**（弹框里没改的 tab 也传原值），不做「只改传了哪个字段」的局部合并；布尔开关拨动只传 `item` + `value`（Boolean 无 defaultValue 入参，§四 注）。
- 出参 `data` = **`SystemMiscDto`**（单条，字段见 §5.3），页面直接替换该卡片（§3.3）。

**修改逻辑**

1. **先对 `item` 加锁** —— 由底层统一加锁机制按 `item` 粒度串行化（同一配置项同时只允许一笔修改在途），随后按 `item` 查库；不存在 ⇒ 拒（页面只编辑既有项）。
2. 取库中 `valueType`，按 §四 校验 `value`（可空）。`defaultValue` **仅非 Boolean 时**参与校验（Boolean 库中值恒非空、入参不认）。
3. Boolean 型 `value` 落库前转大写 `TRUE` / `FALSE`；Json 型空值归一化为 `[]` 再落库。
4. 只更新 `value` / `defaultValue`（Boolean 仅 `value`）+ `updatedAt` / `updatedBy`（底层审计，§一 注）；`item`、`valueType`、`category`、`description`、`createdAt` / `createdBy` 不动。
5. 提交事务并释放锁，返回更新后的 `SystemMiscDto`。

> **并发口径**：并发同一 `item` 的两笔修改**排队执行**（后到者等前一笔释放锁后再读库），因此不会出现「后保存静默覆盖前一笔」；不额外用 `updatedAt` 做乐观锁比对。

### 5.3 对象定义

**`ChangeSystemMiscValueRo`**（入参）：`item` / `value` / `defaultValue`（见 §5.2 表）。

**`SystemMiscDto`**（出参）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `item` | string | 配置项名（唯一键） |
| `category` | string | 分类 |
| `description` | string | 描述，可空 |
| `valueType` | string | `Boolean` / `Text` / `Integer` / `Float` / `Json` |
| `value` | any | 按 `valueType` 还原：Boolean ⇒ bool、Text ⇒ string、Integer ⇒ int、Float ⇒ number、Json ⇒ 数组 / 对象（底层均存字符串，Boolean 存大写 `TRUE` / `FALSE`，§四） |
| `defaultValue` | any | 同上 |
| `createdAt` / `createdBy` | string | 创建审计 |
| `updatedAt` / `updatedBy` | string | 更新审计 |

### 5.4 `category/list`（GET）

无入参；出参 `data` = **按 `category` 去重并排序后的 string 数组**（空表 ⇒ 空数组）：

```json
{ "code": "OK", "success": 1, "errMsg": "", "data": ["global", "hang"], "txId": "3f9c1b7e2a4d" }
```

不分页（distinct 值有限）。页面左侧直接按返回顺序渲染，**不额外补「全部」**（§3.2）。

**后端复验**：直调接口绕过页面控件时，后端按 §四 同一套规则校验 `value`（可空）与 `defaultValue`（Integer 整型 / Float 浮点 / Json 三形态 + 项数 ≤100 + 序列化原文 ≤4000 字符；Boolean 不校验也不改 `defaultValue`），不符即拒 —— 防把坏结构写进全局配置。长度一律按字符校验（§四 全局口径）。


---

## 六、与候选值接口的关系（**候选值都从 Misc 出**）

模块 1/00 的跨模块依赖「环境名 / Host IP / Server Category 的候选值来自配置」——落点即本功能。六个 `/list` 候选接口的数据源全部为 Misc，**路径统一收在 `sys_misc` 前缀下**，`item` 用**业务命名空间前缀**命名，`valueType` 一律 `Json`：

| 候选接口（服务内路径） | 消费方 | Misc 的 `item` | 形态（§四） |
|---|---|---|---|
| `GET /api/v1/sys_misc/env/list` | 01 / 02 / 03 的 Environment 下拉 | `mes.global.environments` | ① `List<string>` |
| `GET /api/v1/sys_misc/ipaddress/list?environment=` | 01 / 03 的 Host IP 下拉（环境联动） | `mes.global.ipaddresses` | ③ `Map<string, List<string>>`（键 = 环境名；值也兼容 `Map<string, string>`） |
| `GET /api/v1/sys_misc/server_category/list` | 01 / 03 的 Server Category 下拉 | `mes.global.servercategories` | ① `List<string>` |
| `GET /api/v1/sys_misc/rule_result/list` | 01 折叠区 Rule Result 下拉 | `mes.rule.results` | ① `List<string>` |
| `GET /api/v1/sys_misc/lock_object/list` | 01 列设置 Lock Object 候选 | `mes.rule.lockedobjects` | ① `List<string>` |
| `GET /api/v1/sys_misc/call_sys/list` | 01 列设置 Call Sys 候选 | `mes.rule.calledsystems` | ① `List<string>` |

> 前端调用时同样加网关前缀，如 `telemetry-hub/api/v1/sys_misc/env/list`。

**出参**：六个接口一律 `data` = **`List<string>`**（去重 + 排序后），空则 `[]`。

### 6.1 取数规则（六个接口共用）

1. 先读 `value`，按 §6.2 判定形态并解析成字符串集合。
2. 解析结果**为空**（value 为空 / 结构不认 / 按环境过滤后无值）⇒ **回落读 `defaultValue`**，解析方式与读 value **完全一致**。
3. `defaultValue` 也取不到 ⇒ 输出**空数组** `[]`（不报错、不返回 null）。
4. 输出前一律**去重 + 排序**。

### 6.2 形态判定

| `value` / `defaultValue` 的实际结构 | 取值方式 |
|---|---|
| **List**（字符串数组） | 取**全部**元素 |
| **Map**（键值表，值可为 string 或 string 数组） | **按 `environment` 过滤**：入参非空 ⇒ 取该 key 的值；入参为空 ⇒ **全部 key 的 value 合并** |
| 其他（标量 / 非 Json / 结构不合法） | 视为取不到值 ⇒ 走 §6.1 的回落或输出 `[]` |

> 只有 `ipaddress/list` 带 `environment` 入参；其余五个即便 item 被配成 Map 形态，也因不传 environment 而退化为「全部 value 摊平」—— 规则统一，不特判。

### 6.3 IP 接口的联动（`mes.global.ipaddresses`）

| 入参 `environment` | 取值 |
|---|---|
| 空 | Map 的**全部 value 合并**，去重排序 |
| 有值（如 `PROD`） | 只取该 key 的值（string 或 string[]），去重排序 |
| 该 key 不存在 / 值取空 | **回落 `defaultValue`**，回落时同样按「Map + environment」的方式取，不是直接取全量 |

> 排序口径为**字符串字典序**（IP 亦按字符串序，不做 IP 数值序 —— 如 `10.18.100.10` 会排在 `10.18.100.2` 前）。

> `lock_object` / `call_sys` 在 04 的「开放集合、零配置」指**落库侧不设清单**（见到什么记什么）；下拉候选从 Misc 出只是**输入辅助**，不构成白名单 —— 两者不矛盾。候选取数即「按 `item` 读 Misc 的 `value`（空则 `defaultValue`）」。

---

## 七、待确认

（无）—— 原 5 条已于 2026-11-09 全部拍板：① 左列表**保留「全部」且为第一项**（§3.1 / §3.2）；② 并发同一 `item` 由**底层加锁机制串行化**（§5.2）；③ 布尔拨动**需二次确认**（§3.3）；④ 总开关**不记忆**状态；⑤ **不做**虚拟滚动，容器常规滚动。

> 原型 `System-Misc-annotated-prototype.html` **本轮不同步** —— 先把需求口径定稿，原型统一后补。

---
