# Server Hang Reason Config · 第一类 Server Hang List 的配置

| 项 | 内容 |
|---|---|
| 模块 | 模块 5 · 系统管理 · **Server Hang Reason Config**（配置页，未开工） |
| 使用者 | IT 运维（配置维护） |
| 状态 | **定稿**，页面未开工 |
| 来源 | 拆分自模块 2 功能 2 |

> **定位**：本功能只管**配置** —— 维护「哪个 Rule、按什么标志行、判成什么 Hang 原因」。判定与运行归**派生服务**（动 `06` 时归位）、产出 `HANG_LIST` 落块文档（动 `04` 时定名）、展示在模块 1 —— **判定与运行口径速查见模块 2 `02` 附录**，本文不含。

---

## 一、功能定位

| 项 | 内容 |
|---|---|
| 管什么 | 第一类 Server Hang 的判定配置：一条配置 = **一个 Rule × 一个 Hang 原因 × 一对开始 / 结束标志** |
| 配了干什么 | 派生服务按配置在该 Rule 的块内瞄定开始 / 结束行，时差 > 0 产出 Hang 记录（含本配置的 `hangReason`），供模块 1 展示 |
| 环境 | **不分环境** —— PIRUN / PROD 共用同一套配置 |

## 二、配置表 `FabViewerSrvHangConfig`

| 字段 | 配置视角说明 |
|---|---|
| `id` | 技术主键（全项目表规范：`FabViewer` 前缀 + `id` 主键 + `enabled` + `updatedAt`/`updatedBy`） |
| `ruleName` | 瞄准的 Rule Name —— **精确匹配，不吃 `%`**；块 `RULENAME` 业务上单值（块不允许出现多 Rule Name） |
| `startLineLike` | 开始行标志 —— 支持前后 `%` 模糊（四式语义见 §三） |
| `endLineLike` | 结束行标志 —— 同上 |
| `hangReason` | Hang 原因（人工填写），随产出写进块文档 `HANG_LIST`、模块 1 弹框展示 |
| `enabled` | true 启用 / false 停用 —— 停用即该配置不参与判定（块不再产出该 Reason 的 Hang） |
| `updatedAt` / `updatedBy` | 审计，保存时自动 |

**业务唯一键 =（`ruleName`, `hangReason`）**：同一条 Rule 可配**多个** Hang Reason（每个 Reason 各一对标志）；同一（ruleName, hangReason）只允许一条。

## 三、匹配语义（配置时须知 定）

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

## 四、页面逻辑（视觉细节归 `05` 与原型）

页面自上而下两段：**上 = 配置表格区，下 = 配置控件区（表单）**。

### 4.1 表格区

**进入页面**：调用 `log-viewer/api/v1/srv_hang_cfg/page` 分页取**第一页**并回显；默认**每页 20 条**。页面**无搜索框**，顶部只有一个**刷新图标按钮**。

| 项 | 口径 |
|---|---|
| 列（按序） | Rule Name、Start Line Like、End Line Like、Hang Reason、Enabled、Last Updated Time、Last Updated User |
| 行选择 | **单选，不支持多选** |
| Action 列 | **最右侧固定**，两个操作：**删除 / 编辑** |
| Enabled 列 | **开关**形态、可操作 —— `true` 打开 / `false` 关闭；点击调用 `log-viewer/api/v1/srv_hang_cfg/state` 切换该条配置的 `enabled` |
| 翻页 | 按页码再调 `page` 接口（推定） |

**删除**（Action 列）：**弹框确认后**调用 `DELETE log-viewer/api/v1/srv_hang_cfg` 删除该条配置（弹框形态按 `05`）；已产出的历史 Hang 记录不受影响（不回算）。

### 4.2 配置控件区（下方表单）

| 控件 | 回填 / 约束 |
|---|---|
| Rule Name 输入框 | 限定**数字、大小写字母**，长度 ≤ 255 |
| Hang Reason 输入框 | 限定**数字、大小写字母、逗号、点、下划线、中划线**，长度 ≤ 255 |
| Start Line Like 输入框 | **不限任何字符**，长度 ≤ 4000；**只填具体文本，`%` 不进输入框**（匹配方式交给单选框） |
| End Line Like 输入框 | 同上；**与 Start 各自单独配置**（文本框 + 单选框各一组） |
| 匹配方式单选框 × 2 组 | 四选一：**只前模糊 / 只后模糊 / 前后模糊 / 精确**（对应库中 `%` 位置，见 §三表） |

**编辑**（Action 列）：将该行内容填充进表单 —— `RuleName` → Rule Name 框、`hangReason` → Hang Reason 框、`startLineLike` / `endLineLike` **拆掉首尾 `%` 后只填具体文本**，按 `%` 位置设好两个单选框。编辑时**全部输入框都可以改，改后不能为空**。

### 4.3 Confirm / Cancel（双模式）

| 模式 | 触发 | 行为 |
|---|---|---|
| **编辑模式**（已点编辑、表单已回填） | 点 **Confirm** | 调用 `PUT log-viewer/api/v1/srv_hang_cfg`；**入参 `id` = 选中行的 `id`** |
| **新增模式**（表单为空） | 点 **Confirm** | 调用 `POST log-viewer/api/v1/srv_hang_cfg`；**入参 `id` 可为空** |
| 任意模式 | 点 **Cancel** | **清空全部控件值**（回到新增模式）＋ **取消表格选中** |

**提交拼接（Confirm 时 定）**：`startLineLike` / `endLineLike` 的入参值 = 输入框文本**按各自单选框把 `%` 追加到首尾**后的完整形态（只前模糊加头、只后模糊加尾、前后都加、精确不加）。

### 4.4 接口清单

外壳一律走**统一响应包**（`{ "success": true, "errCode": 0, "data": ... }`，模块 1 `01` §5.1）；入出参格式与模块 1 `01` §5.3 同款。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `log-viewer/api/v1/srv_hang_cfg/page` | `GET` | 分页取配置 |
| 2 | `log-viewer/api/v1/srv_hang_cfg/state` | `POST` | 切换一条配置的 `enabled` |
| 3 | `log-viewer/api/v1/srv_hang_cfg` | `POST` | 新增（`id` 为空） |
| 4 | `log-viewer/api/v1/srv_hang_cfg` | `PUT` | 编辑（`id` = 选中行） |
| 5 | `log-viewer/api/v1/srv_hang_cfg` | `DELETE` | 删除 |

**1 · `srv_hang_cfg/page`**

| 项 | 内容 |
|---|---|
| 方法 | `GET` |
| 入参 | URL 参数，**仅两个**：`pageIndex`（进页面传 `1`，翻页传目标页）、`pageSize`（默认 `20`） |
| 默认排序 | **`ruleName` + `hangReason`**（方向按默认升序） |

**入参**

```json
{
  "pageIndex": 1,
  "pageSize": 20
}
```

**出参**（`data`，同模块 1 `01` §5.3-9 分页格式）

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

**入参**

```json
{
  "id": "<配置 id>",
  "enabled": true
}
```

**出参**：`data` 为空，只报成败 —— `{ "success": true, "errCode": 0 }`

**3 · `srv_hang_cfg`（POST · 新增）**

| 项 | 内容 |
|---|---|
| `id` | 传 `null`（新增） |
| `startLineLike` / `endLineLike` | 输入框文本**按各自单选框追加 `%` 后的完整值**（§4.3 提交拼接） |
| `enabled` | **不入参** —— 新增默认值由后端定（出参回显） |
| 行为 | 成功后**表格第一行插入出参内容** |

**入参**

```json
{
  "id": null,
  "ruleName": "<Rule Name 输入框的值>",
  "hangReason": "<Hang Reason 输入框的值>",
  "startLineLike": "<Start 文本 + 按单选框追加的 %>",
  "endLineLike": "<End 文本 + 按单选框追加的 %>"
}
```

**出参**（`data` = 单条配置对象，字段与 `page` 出参 `contents[]` 条目一致）

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

**入参**

```json
{
  "id": "<配置 id>"
}
```

**出参**：`data` 为空，只报成败。

**联动口径**：切 `enabled` / 新增 / 修改 ⇒ 判定行为**最迟 5 分钟生效**（消费方 5min 缓存）；停用 / 删除**不回算**历史 Hang；新增 / 修改校验业务唯一键（`ruleName` + `hangReason`，冲突即拒）。

### 4.5 待定

（无）

## 五、与其他部分的边界

| 部分 | 归属 |
|---|---|
| 判定与运行（配对、压缩、重放节奏） | 已落 `06`（§2.2 / §2.3 / §4.7 / §1.3.1(4) / §十）；速查仍见模块 2 `02` 附录 |
| 产出 `HANG_LIST`（块文档字段，每条 8 项） | 已定名并落 `04` §5.3.2 / `06` §2.2 / `09` §四 / `12-template-exec.json`（块 33 / nested 4） |
| 展示 | 模块 1 `01` §3.6 **唯一出口**（列数字 = `hangCount`、弹框 = 10 号接口 `rule_info/hang_list`）；`02` Rule 实效分析**不消费**（列表无该列） |

---
