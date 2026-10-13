# System Misc · 全局配置

| 项 | 内容 |
|---|---|
| 模块 | 模块 5 · 系统管理 · **System Misc** |
| 使用者 | IT 运维（配置维护）；全部功能页面的下拉候选（间接消费） |
| 状态 | **定稿** |
| 来源 | `FabViewerMisc` 表曾议后搁置（无消费方），System Misc 使其归位 |

> 本篇按 `01-Server Hang Reason Config` 的格式组织；表规范沿用全项目约定。

---

## 一、功能定位

| 项 | 内容 |
|---|---|
| 干什么 | 维护**全局使用的变量**（环境名列表、IP 列表等），一处配置、各处消费 |
| 形态 | 配置页（**左右布局**：Category 窄列表 ＋ 搜索 / 表格 / 三模式弹框）＋ Oracle 表 `FabViewerMisc` |
| 与 Reason Config 的差别 | 那边是**某一功能的专用配置**（Hang 判定）；这边是**全局变量的家** —— 候选值接口（`env/list`、`ipaddress/list` 等）的数据源（§六，待拍板） |

---

## 二、配置表 `FabViewerMisc`

| 字段 | 说明 |
|---|---|
| `id` | 技术主键（全项目表规范） |
| `item` | 配置项名 —— **唯一索引**（一行一个配置项；接口层也以它定位，§五） |
| `description` | 描述 —— **纯文本**，不限字符格式；**长度 ≤ 4000**（多行文本域） |
| `category` | 分类 —— 下拉候选 = **本表 `distinct(category)`**（自举，不另立清单） |
| `value` | 配置值 —— **JSON**（类型系统见 §四；接口传入即入库格式，后端零转换） |
| `updatedAt` / `updatedBy` | 审计，保存时自动 |

与旧议形态的三处差异：`value` 支持 JSON；`item` 定唯一索引；**取消 `enabled`**（配置项的存在与否就是开关，不设停用态）。

---

## 三、页面逻辑（左右布局）

页面分左右两栏：**左 = Category 窄列表**（精确过滤入口，§3.1）；**右 = 搜索区 + 表格区 + 行级操作**（§3.2 ~ §3.4）。左侧选中项与右侧查询条件是**同一查询的两个输入面**：选中左列表项自动查询，点 `Search` 同样结合左列表选中项过滤。

### 3.1 Category 窄列表（左侧）

| 项 | 口径 |
|---|---|
| 数据源 | 进页面调 `GET /api/v1/sys_misc/category/list`（= 本表 `distinct(category)`），按**字典序**展示 |
| 首行 | 恒显示「**全部**」，进页面**默认选中「全部」** |
| 进页面行为 | 默认选中「全部」⇒ **自动查询全部的第 1 页**（打开页面直接出数据，无未查询空态） |
| 选中某分类 | **自动**调 `page` 查第 1 页：带上右侧查询输入框当前值 + 本分类；**等值**匹配 |
| 选中「全部」 | 不带 `category` 入参（= 不按分类过滤） |
| 与 `Search` 的关系 | `Search` 同样结合左列表当前选中项过滤（§3.2）；两侧谁最后变谁触发，不打架 |
| 条数计数 | **不做** —— 快节奏的轻查询，列表只出分类名 |
| 刷新时机 | 新增 / 修改 / 删除**成功后重取**本列表；当前选中项若已消失（该分类最后一行被删等）⇒ **回落到「全部」并重查** |
| 空表 | 候选为空 ⇒ 左列表只剩「全部」 |

### 3.2 搜索区（右侧）

| 项 | 口径 |
|---|---|
| 条件 | **仅一个 `Condition` 输入框**，对 `item` / `description` / `value` **三个栏位前后模糊匹配**（contains），任一栏位命中即返回（与 Reason Config 的 `ruleName` 精确匹配不同） |
| 按钮 | `Search` → `GET /api/v1/sys_misc/page` 查第 1 页，**结合左列表当前选中项**（§3.1）；Condition 不填 = 不过滤 |

### 3.3 表格区

| 项 | 口径 |
|---|---|
| 列（按序） | Item、Description、Category、Value、Last Updated Time、Last Updated User + **Action（最右固定）** |
| Description 列 | 显示描述文本，超长**省略号**截断 |
| **Value 列** | 按 **JSON 字符串**显示，超长**省略号**截断；**可点击** → 打开**详情弹框**展示完整 Value（只读，即三模式弹框的查看模式，§3.4） |
| Action | **修改**（打开修改弹框）、**删除**（**弹框确认后**调接口，弹框形态按 `05`） |
| 分页 | **每页 20**（不分档） |
| 添加入口 | **表格左下方添加按钮图标** → 打开新增弹框（弹框式，区别于 Reason Config 的内嵌表单） |

**保存后的行级行为**：

| 动作 | 行为 |
|---|---|
| 新增（点添加图标） | **表格第一行先插入一个空白行**（占位），新增弹框同时打开 |
| 新增保存成功 | 接口返回值**填充进该空白行**；取消 / 失败 ⇒ **移除空白行**（推定，恢复原表格） |
| 修改保存成功 | 接口返回值**直接覆盖该行内容** |
| 删除成功 | **直接删除该行** |

### 3.4 三模式复用弹框（查看 / 修改 / 新增同一组件）

上方固定三字段 + 下方 Value 结构化编辑（§四）：

| 字段 / 区域 | 查看 | 修改 | 新增 |
|---|---|---|---|
| Item | 只读 | **锁定**（定位键） | 必填；仅大小写字母 + 数字，长度 ≤ 255（推定） |
| Description | 只读 | 可改 | 必填；**多行文本域**，不限字符格式，**长度 ≤ 4000** |
| Category | 只读 | **可改** | 必填；**下拉 + 输入双模式**（combobox），候选 = 本表 `distinct(category)`（与 `/api/v1/sys_misc/category/list` 同源，§五-5）；仅大小写字母 + 数字，**长度 ≤ 20** |
| Value | 只读（编辑器只读态） | 可改 | 必填（推定）；Single / Multi 单选 + 编辑器（§四） |

---

## 四、Value 编辑器（Single / Multi）

**Value 顶层恒为 JSON List**；页面呈**编辑器样式**（结构化控件容器，视觉细节归 `05` / 原型）。外层一组单选框定编辑模型：

| 模型 | 编辑器 | 存储形态 |
|---|---|---|
| **Single Value** | **输入框 / 布尔选择器**二选一：输入框自由输入（内容为合法数字则存数字，否则存文本）；布尔选择器 = `true` / `false` | `[ x ]`（长度恒 1，x ∈ 数字 / 文本 / **布尔** —— 全系统唯一允许布尔的形态） |
| **Multi Value** | **节点式列表，按节点增加**：每新增一个节点先选**值**还是 **Map** —— **值节点** = 标量输入（文本 / 数字，**禁布尔**）；**Map 节点** = 键输入框 + 值数组（复用值节点控件增删）；两类节点**可混排** | `[ 元素, … ]`，元素 = 标量或单层 Map（`{ 键: [标量数组] }`）⇒ **深度封顶两层**（Map 的值不能再嵌 Map，也不能是 Single 形态） |

约束：

- **Multi 的值节点与 Map 值数组一律禁布尔**（布尔只存在于 Single）。
- **规模上限**：List **最多 100 项** —— 顶层与 Map 值数组同限（防护值，后端一并校验）。
- Map **键 = 自由键**。
- 必填（推定）：Single 输入框非空；Multi **至少 1 个节点**且节点完整（值节点非空；Map 节点键与值数组非空）。

**打开时的形态识别**：解析 JSON —— 长度 1 且元素为标量 ⇒ 按 **Single** 呈现（等价表示，可切 Multi 继续加节点）；其余（多元素 / 含 Map）⇒ **Multi**。

**模式切换**：Single → Multi 把当前单值转成一个值节点；Multi → Single **清空重选**（多节点装不进单值）。

`ip_list` 示例（Multi · 两个 Map 节点）：`[ {"PROD": ["10.18.100.1","10.18.100.2"]}, {"PIRUN": ["10.18.200.1"]} ]`。

---

## 五、接口清单

外壳一律走**统一响应包**（`{ "success": true, "errCode": 0, "data": ... }`，模块 1 `01` §5.1）。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `/api/v1/sys_misc/page` | `GET` | 分页查询（含 Category 过滤） |
| 2 | `/api/v1/sys_misc` | `POST` | 新增 |
| 3 | `/api/v1/sys_misc` | `PUT` | 修改 |
| 4 | `/api/v1/sys_misc` | `DELETE` | 删除 |
| 5 | `/api/v1/sys_misc/category/list` | `GET` | Category 窄列表候选（`distinct(category)`） |

**1 · `page`（GET，URL 参数）**

入参:`pageIndex`、`pageSize`(每页 20)、`condition`(**前后模糊匹配**:对 `item` / `description` / `value` 三栏位 contains,任一命中即返回;`value` 按 JSON 字符串原文匹配;可空 = 不过滤)、`category`(**等值**,可空 = 不按分类过滤 —— 左列表选「全部」时不带,§3.1)。

```json
{
  "totalPage": 1, "total": 2, "pageIndex": 1, "pageSize": 20,
  "contents": [
    { "item": "env_list", "description": "<描述文本>",
      "category": "global", "value": ["PROD", "PIRUN"],
      "updatedAt": "…", "updatedBy": "…" }
  ]
}
```

(`id` 不出参 —— 行键即 `item`;定位、增删改全走它。)

**2 · `POST`（新增）** 入参四字段：

```json
{ "item": "env_list", "category": "global", "description": "<描述文本>", "value": ["PROD", "PIRUN"] }
```

- `item` 冲突（唯一索引）⇒ 拒（错误码，不覆盖）；其余校验同 §3.4 / §四。
- 出参:`data` = **单条配置对象**（字段同 `contents[]` 条目）——页面第一行的空白行用它填充（§3.3 定）。

**3 · `PUT`（修改）** 入参与 POST 完全一致（`item` 作定位键，虽不可改；`category` / `description` / `value` 为新值）。出参同 POST（单条对象，页面直接覆盖该行，§3.3）。

**4 · `DELETE`** 入参**仅 `item`**;出参只报成败。**前端须弹框确认后才调用**（§3.3）。

**5 · `category/list`（GET）** 无入参;出参 `data`:

```json
{ "category": ["global", "hang"] }
```

不分页（distinct 值有限,字典序返回）;空表 ⇒ 空数组（页面左列表只剩「全部」）。与弹框 Category combobox 候选**同源**（本表 `distinct(category)`,§3.4）。

**value 的后端复验（推定）**：直调接口绕过页面编辑器时，后端按 §四同一套类型规则校验（Single 长度 1 / Multi 元素为标量或单层 Map / 布尔只许出现在 Single / Map 值限标量数组），不符即拒 —— 防把坏结构写进全局配置。

---

## 六、与候选值接口的关系（**候选值都从 Misc 出**）

模块 1/00 的跨模块依赖「环境名 / Host IP / Server Category 的候选值来自配置」——落点即本功能。六个 `/list` 候选接口的数据源全部为 Misc，`item` 命名约定：

| 候选接口 | 消费方 | Misc 的 `item` | Value 形态（§四） |
|---|---|---|---|
| `GET /api/v1/env/list` | 01 / 02 / 03 的 Environment 下拉 | `env_list` | Multi · 全值节点（标量列表） |
| `GET /api/v1/ipaddress/list?environment=` | 01 / 03 的 Host IP 下拉（环境联动） | `ip_list` | Multi · **Map 节点**（键 = 环境名，值 = IP 数组）—— 联动即「按 `environment` 取键」 |
| `GET /api/v1/server_category/list` | 01 / 03 的 Server Category 下拉 | `server_category_list` | Multi · 全值节点（标量列表） |
| `GET /api/v1/rule_result/list` | 01 折叠区 Rule Result 下拉 | `rule_result_list` | Multi · 全值节点（标量列表） |
| `GET /api/v1/lock_object/list` | 01 列设置 Lock Object 候选 | `lock_object_list` | Multi · 全值节点（标量列表） |
| `GET /api/v1/call_sys/list` | 01 列设置 Call Sys 候选 | `call_sys_list` | Multi · 全值节点（标量列表） |

> `lock_object` / `call_sys` 在 04 的「开放集合、零配置」指**落库侧不设清单**（见到什么记什么）；下拉候选从 Misc 出只是**输入辅助**，不构成白名单 —— 两者不矛盾。候选取数即「按 `item` 读 Misc 的 `value`」。

## 七、待定

（无）

---
