# 服务挂起原因配置 · Server Hang Reason Config · 配置文档

## 1. 功能定位

维护 `FvSrvHangConfig` 配置表 —— 一条配置 = 一个 Rule × 一个 Hang 原因 × 一对开始 / 结束标志，派生服务据此在该 Rule 块内瞄定起止行、时差 > 0 即产出 Hang 记录供模块 1 展示；配置不分环境（PIRUN / PROD 共用），本文只管配置，判定 / 产出 / 展示分别归 `06` / `09` / 模块 1。

---

## 2. 配置表

**入口**：**`system-config` 模块 → 一级菜单 `System Config` → 本页 `Server Hang Reason Config`**，与 `System Misc` 同属这一级菜单（本模块只有一级菜单，两者是本页）；权限＝**功能级（到本菜单）+ 三个动作（`Create` / `Update` / `Delete`）**，见 §3.1。

**配置只有一张表**：

- **表 `FvSrvHangConfig`**（§2.1）—— 哪个 Rule、按什么标志行、判成什么 Hang 原因；`ruleName + hangReason` 唯一。
- §2.2 讲这张表两个标志字段（`startLineLike` / `endLineLike`）的匹配语义。

> **一条配置 = 一个 Rule × 一个 Hang 原因 × 一对起止标志**：同一 Rule 可配多个 Hang Reason（每 Reason 各一对标志），但同一（`ruleName`, `hangReason`）只允许一条。
>
> **不设启用字段之外的开关维度**：`enabled` 停用的配置不参与判定；配置**不分环境**，PIRUN / PROD 共用。

表名与栏位均大驼峰、全项目统一不加引号（不加引号的标识符 Oracle 会转成大写，写 `RuleName` 与 `RULENAME` 是同一列）。表规范如下，长度 / 可空 / UK 见表内。

**表统一规范**：

- **主键 `ID`**：`VARCHAR2(≤50)`、非空，由框架底层赋值；本表 `ID` **业务侧作定位键**（`state` / `PUT` / `DELETE` 的 `id` 入参），新增时为空。
- **审计字段** `UpdatedAt` / `UpdatedBy`：由底层统一控制 —— 赋值与保存时刷新，业务侧不进任何 SQL；**本表只有更新侧审计，无 `CreatedAt` / `CreatedBy`**。
- 列名大驼峰、不加引号（Oracle 自动转大写）；**业务时间列**统一 `TIMESTAMP(3)`（毫秒）；字符串长度按**字符**校验（避免 `VARCHAR2` 字节语义抛 `ORA-12899`）。

### 2.1 表 `FvSrvHangConfig`（判定配置）

| 字段 | 列名 | 长度 | 可空 | 说明 |
|---|---|---|---|---|
| 主键 | `ID` | ≤50 | 否 | 底层赋值；业务侧作定位键（`state` / `PUT` / `DELETE`），新增时为空 |
| Rule Name | `RuleName` | ≤255 | 否 | 瞄准的 Rule Name —— **精确匹配，不吃 `%`**；块 `RULENAME` 业务上单值（块不允许出现多 Rule Name） |
| 开始行标志 | `StartLineLike` | ≤4000 | 否 | 支持前后 `%` 模糊（四式语义见 §2.2） |
| 结束行标志 | `EndLineLike` | ≤4000 | 否 | 同上；与 Start 各自独立配置 |
| Hang 原因 | `HangReason` | ≤255 | 否 | 人工填写，随产出写进块文档 `HANG_LIST`、模块 1 弹框展示 |
| 启用状态 | `Enabled` | NUMBER(1) | 否 | 布尔：**`true`（库中 `1`）= 启用、`false` = 停用**；停用即该配置不参与判定；只由列表开关改（`state` 接口），不进新增 Ro |
| 更新审计 | `UpdatedAt` / `UpdatedBy` | — | 见上 | 底层统一赋值、保存时刷新 |

**业务唯一索引**：`RuleName + HangReason` —— 同一 Rule 可配多个 Hang Reason（每个 Reason 各一对标志）；同一组合只允许一条。

> 新增 / 修改校验业务唯一键（`ruleName` + `hangReason`），冲突即拒；切 `enabled` / 改配置**下一轮重放生效**（消费方每次 Case 2 执行前重读、不缓存，§4.2）。

### 2.2 匹配语义（配置时须知）

`startLineLike` / `endLineLike` 按 **SQL LIKE** 语义，`%` **写在配置值里**（库里存什么就按什么判）；**页面上 `%` 不进输入框** —— 匹配方式用单选框表达，提交时按单选框把 `%` 拼回首尾存库、编辑回显时拆开：

| 库里存的 | 语义 | 单选框标签 |
|---|---|---|
| `%ABC%` | 包含 ABC | **前后模糊匹配** |
| `ABC%` | 以 ABC 开头 | **只后模糊匹配**（结尾模糊） |
| `%ABC` | 以 ABC 结尾 | **只前模糊匹配**（开头模糊） |
| `ABC` | 整串相等 | **精确匹配** |

**文本可含 `%`**：输入框不限制 `%`；**实际执行只看首尾是否含 `%` 来判定匹配方式** —— 文本自身以 `%` 开头 / 结尾时，按对应模糊语义生效（配置时自查）。

**「精确匹配」的语义提醒（维持 SQL LIKE 语义 + 页面提示，不改判据）**：不带 `%` = 与该行 `LOG_BODY`（**剥掉行首时间戳 / Server ID 前缀后的本体**）**整串一字不差**。三个后果配置页要提示：① 不能把带前缀的整行贴进去；② `LOG_BODY` 超过 4000 字符的行**永远配不上**（输入框长度上限）；③ 通常应优先用 `%…%` 包含式。

`ruleName` 不参与此四式 —— 一律精确。

---

## 3. 配置页

### 3.1 菜单位置与权限

| 项 | 内容 |
|---|---|
| 一级菜单 | **`System Config`**（中文界面同显示 `System Config`） |
| 本页 | **`Server Hang Reason Config`**（中文界面显示「**服务挂起原因配置**」；与 `System Misc` 同属一级菜单 `System Config`，为其下两个本页之一） |
| 挂载位置 | **`system-config`** 模块下 |
| 权限方式 | **功能级（到本菜单）+ 三个动作权限点**（`Create` / `Update` / `Delete`），见下表 |

**权限点**

| # | 权限点 | 标识 | 限制行为 |
|---|---|---|---|
| 1 | **功能级（菜单）** | — | 一级菜单 `System Config` / 本页 `Server Hang Reason Config` 入口；有菜单权限才可进入、使用本页 |
| 2 | **「新增」** | `Create` | 控制新增（表单空态点 Confirm）；有权限可新增、无权限禁止 |
| 3 | **「编辑」** | `Update` | 控制编辑与启用 / 停用开关（同一动作）；有权限可改、无权限禁止 |
| 4 | **「删除」** | `Delete` | 控制删除（Action 列）；有权限可删、无权限禁止 |

读类（列表 / 详情）不单独设权限，进入本菜单即可查看。

### 3.2 表格区

页面自上而下两段：**上 = 配置表格区，下 = 配置控件区（表单）**（视觉细节归模块 1 `05` 与原型）。

**进入页面**：调用 `GET /api/v1/srv_hang_cfg/page` 分页取**第一页**并回显；默认**每页 20 条**。页面**无搜索框**，顶部只有一个**刷新图标按钮**。前端调用时路径加 `/telemetry-hub` 前缀，即 `/telemetry-hub/api/v1/srv_hang_cfg/page`（§4.1）。

| 项 | 口径 |
|---|---|
| 列（按序） | Rule Name、Start Line Like、End Line Like、Hang Reason、Enabled、Last Updated Time、Last Updated User |
| 行选择 | **单选，不支持多选** |
| Action 列 | **最右侧固定**，两个操作：**删除 / 编辑**（分别受 `Delete` / `Update` 管控，无权限禁止） |
| Enabled 列 | **开关**形态、可操作 —— `true` 打开 / `false` 关闭；受 `Update` 管控；点击调用 `POST /api/v1/srv_hang_cfg/state` 切换该条配置的 `enabled` |
| 翻页 | 按页码再调 `page` 接口（推定） |

**删除**（Action 列）：**弹框确认后**调用 `DELETE /api/v1/srv_hang_cfg` 删除该条配置（弹框形态按 `05`）；已产出的历史 Hang 记录不受影响（不回算）。

### 3.3 配置控件区（下方表单）

| 控件 | 回填 / 约束 |
|---|---|
| Rule Name 输入框 | 限定**数字、大小写字母**，长度 ≤ 255 |
| Hang Reason 输入框 | 限定**数字、大小写字母、逗号、点、下划线、中划线**，长度 ≤ 255 |
| Start Line Like 输入框 | **不限任何字符**，长度 ≤ 4000；**只填具体文本，`%` 不进输入框**（匹配方式交给单选框） |
| End Line Like 输入框 | 同上；**与 Start 各自单独配置**（文本框 + 单选框各一组） |
| 匹配方式单选框 × 2 组 | 四选一：**只前模糊 / 只后模糊 / 前后模糊 / 精确**（对应库中 `%` 位置，见 §2.2 表） |

**编辑**（Action 列）：将该行内容填充进表单 —— `ruleName` → Rule Name 框、`hangReason` → Hang Reason 框、`startLineLike` / `endLineLike` **拆掉首尾 `%` 后只填具体文本**，按 `%` 位置设好两个单选框。编辑时**全部输入框都可以改，改后不能为空**。

### 3.4 Confirm / Cancel（双模式）

| 模式 | 触发 | 行为 |
|---|---|---|
| **编辑模式**（已点编辑、表单已回填） | 点 **Confirm** | 调用 `PUT /api/v1/srv_hang_cfg`；**入参 `id` = 选中行的 `id`** |
| **新增模式**（表单为空） | 点 **Confirm** | 调用 `POST /api/v1/srv_hang_cfg`；**入参 `id` 可为空** |
| 任意模式 | 点 **Cancel** | **清空全部控件值**（回到新增模式）＋ **取消表格选中** |

**提交拼接（Confirm 时）**：`startLineLike` / `endLineLike` 的入参值 = 输入框文本**按各自单选框把 `%` 追加到首尾**后的完整形态（只前模糊加头、只后模糊加尾、前后都加、精确不加）。

## 4. 接口

### 4.1 接口清单

下表路径是**后端注册路径**（均以 `/api` 开头，后端维持不变）；**前端调用时一律在前面加 `/telemetry-hub` 前缀**（如 `/telemetry-hub/api/v1/srv_hang_cfg/page`），由网关转发时去掉。全部接口都在 **telemetry-hub 服务下**。

| # | 接口 | Method | 用途 | 权限 |
|---|---|---|---|---|
| 1 | `/api/v1/srv_hang_cfg/page` | `GET` | 分页取配置 | 进入本菜单即可 |
| 2 | `/api/v1/srv_hang_cfg/state` | `POST` | 切换一条配置的 `enabled` | 有「编辑」`Update` 权限可操作，无则禁止 |
| 3 | `/api/v1/srv_hang_cfg` | `POST` | 新增（`id` 为空） | 有「新增」`Create` 权限可操作，无则禁止 |
| 4 | `/api/v1/srv_hang_cfg` | `PUT` | 编辑（`id` = 选中行） | 有「编辑」`Update` 权限可操作，无则禁止 |
| 5 | `/api/v1/srv_hang_cfg` | `DELETE` | 删除 | 有「删除」`Delete` 权限可操作，无则禁止 |

外壳一律走**统一响应包**（`{ "success": true, "errCode": 0, "data": ... }`，模块 1 `01` §5.1）；入出参格式与模块 1 `01` §5.3 同款。

**1 · `srv_hang_cfg/page`**

| 项 | 内容 |
|---|---|
| 方法 | `GET` |
| 入参 | URL 参数，**仅两个**：`pageIndex`（进页面传 `1`，翻页传目标页）、`pageSize`（默认 `20`） |
| 默认排序 | **`ruleName` + `hangReason`**（方向按默认升序） |

入参

```json
{
  "pageIndex": 1,
  "pageSize": 20
}
```

出参（`data`，同模块 1 `01` §5.3-9 分页格式）

```json
{
  "totalPage": 1,
  "total": 3,
  "pageIndex": 1,
  "pageSize": 20,
  "contents": [
    {
      "id": "<配置 id>",
      "ruleName": "<Rule Name>",
      "hangReason": "<Hang Reason>",
      "startLineLike": "<带 % 的开始行标志完整值>",
      "endLineLike": "<带 % 的结束行标志完整值>",
      "enabled": true,
      "updatedAt": "<最后更新时间>",
      "updatedBy": "<最后更新人>"
    }
  ]
}
```

**2 · `srv_hang_cfg/state`**

| 项 | 内容 |
|---|---|
| 方法 | `POST` |
| 行为 | 成功后页面**局部更新该行 Enabled 列**，不重拉列表 |

入参

```json
{
  "id": "<配置 id>",
  "enabled": true
}
```

出参：`data` 为空，只报成败 —— `{ "success": true, "errCode": 0 }`

**3 · `srv_hang_cfg`（POST · 新增）**

| 项 | 内容 |
|---|---|
| `id` | 传 `null`（新增） |
| `startLineLike` / `endLineLike` | 输入框文本**按各自单选框追加 `%` 后的完整值**（§3.4 提交拼接） |
| `enabled` | **不入参** —— 新增默认值由后端定（出参回显） |
| 行为 | 成功后**表格第一行插入出参内容** |

入参

```json
{
  "id": null,
  "ruleName": "<Rule Name 输入框的值>",
  "hangReason": "<Hang Reason 输入框的值>",
  "startLineLike": "<Start 文本 + 按单选框追加的 %>",
  "endLineLike": "<End 文本 + 按单选框追加的 %>"
}
```

出参（`data` = 单条配置对象，字段与 `page` 出参 `contents[]` 条目一致）

```json
{
  "id": "<服务端生成的配置 id>",
  "ruleName": "<Rule Name>",
  "hangReason": "<Hang Reason>",
  "startLineLike": "<带 % 的完整值>",
  "endLineLike": "<带 % 的完整值>",
  "enabled": true,
  "updatedAt": "<保存时刻>",
  "updatedBy": "<保存人>"
}
```

**4 · `srv_hang_cfg`（PUT · 编辑）**

| 项 | 内容 |
|---|---|
| 入参 | 同新增（5 字段），`id` = **选中行的 `id`** |
| 出参 | 同新增（单条配置对象） |
| 行为 | 成功后**用出参内容更新选中行每个单元格** |

**5 · `srv_hang_cfg`（DELETE · 删除）**

| 项 | 内容 |
|---|---|
| 入参 | **仅 `id`** |
| 行为 | **弹框确认后**调用；成功后**表格中删除该行** |

入参

```json
{
  "id": "<配置 id>"
}
```

出参：`data` 为空，只报成败。

### 4.2 联动口径

切 `enabled` / 新增 / 修改 ⇒ 判定行为**下一轮重放生效**（消费方每次 Case 2 执行前重读配置、不缓存）；停用 / 删除**不回算**历史 Hang；新增 / 修改校验业务唯一键（`ruleName` + `hangReason`，冲突即拒）。

## 5. 待确认

（无）
