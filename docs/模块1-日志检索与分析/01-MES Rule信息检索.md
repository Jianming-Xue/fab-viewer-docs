# 功能 1 · MES Rule 信息检索

| 项 | 内容 |
|---|---|
| 模块 | 模块 1 · 日志检索与分析 |
| 使用者 | IT 运维 |
| 状态 | **需求已逐条确认** —— 旧稿已清空，本文为新口径 |
| 本阶段边界 | **只写页面功能描述**。不写原型图、不碰样式；凡取决于「怎么摆」的呈现细节归原型 SKILL |

> 字段与取值一律以 `04-后台链路与数据模型.md` 为准；视觉口径（色值、深浅色令牌、组件形态）以 `05-视觉与交互规范.md` 为准，本文只记「哪个条件触发」。

---

## 一、功能定位

| 项 | 内容 |
|---|---|
| 干什么 | 按条件从**已落成的 MES 块日志**中检索 Rule 信息，回显成列表，供用户查看 |
| 页面布局 | 自上而下三段：**上＝搜索区**、**中＝结果列表**、**下＝针对列表中选中行的操作按钮** |
| 对象口径 | 检索时**不区分块类型**，Rule / Txn 两类块都返回；靠列表的 `Request Type` 列区分 |

---

## 二、搜索区

### 2.1 构成与排布

- 共 **16 个过滤条件 + 1 个排序开关**
- **平铺区 12 项，每行 5 个**（开始时间与结束时间各占一格，合计 2 格）→ 排成 5 / 5 / 2
- **折叠区 4 项，默认收起**，由一个**折叠开关**控制显隐
- 折叠开关与 `Search` / `重置` 按钮**跟在栅格后面**

平铺区**行内顺序**（同 §2.2 的编号）：

| 行 | 条件 |
|---|---|
| 1 | Environment、Server Category、Server Number、开始时间、结束时间 |
| 2 | Rule Name、TID、EQP、Carrier、Lot |
| 3 | Min Cost Time、Max Cost Time |

### 2.2 平铺区条件（12 项）

| # | 控件 | 必填 | 取值来源 | 过滤块文档字段 | 匹配方式 | 不填 / 不选 |
|---|---|---|---|---|---|---|
| 1 | Environment | 否 | 进页面调 `GET log-viewer/api/v1/env/list` | `ENV` | 等值 | 不过滤 |
| 2 | Server Category | 否 | 进页面调 `GET log-viewer/api/v1/server_category/list` | `SERVER_CATEGORY` | 等值 | 不过滤 |
| 3 | Server Number | 否 | 手输，英文逗号分隔多值 | `SERVER_ID` | 与 Category 拼成 `SERVER_ID` 后等值，多值为或关系 | 不过滤 |
| 4 | 开始时间 | **是** | 时间选择器，精确到分钟 | `START_TIME` | 区间下界 | — |
| 5 | 结束时间 | **是** | 时间选择器，精确到分钟 | `START_TIME` | 区间上界 | — |
| 6 | Rule Name | 否 | 手输 | `RULENAME` | `ABC` 精确；`ABC*` 前缀 | 不过滤 |
| 7 | TID | 否 | 手输，单项值 | `TID`（keyword，可多值） | 精确比对，命中任一即算 | 不过滤 |
| 8 | EQP | 否 | 手输 | `EQPID`（可多值） | `ABC` 精确；`ABC*` 前缀；命中任一即算 | 不过滤 |
| 9 | Carrier | 否 | 手输 | `CARRIERID`（可多值） | 同 EQP | 不过滤 |
| 10 | Lot | 否 | 手输 | `LOTID`（可多值） | 同 EQP | 不过滤 |
| 11 | Min Cost Time | **是** | 手输，默认 `0` | `TOTAL_COST_MS` | 区间下界（秒 × 1000） | — |
| 12 | Max Cost Time | **是** | 手输，默认 `999` | `TOTAL_COST_MS` | 区间上界（秒 × 1000） | — |

**Server Number 细则**

- 每个 Number 限定 **1 ~ 1000 的正整数**
- 拼接：`Category` + `srv` + `.` + `Number` → 如 `FAB` + `1` = `FABsrv.1`；填 `1,2` 命中任一即算
- 校验**只在点 `Search` 那一刻**：按英文逗号分隔 → 每段 `trim` → 逐段验 1 ~ 1000 正整数 → **去重** → 英文逗号拼回发出
- 空段（`1,` / `1,,2`）与全角逗号（`1，2`）判非法 → 拦住，不发请求
- 依赖：Category 为空 → 本框**禁用**；Category 清空 → 本框值清空；Category 有值 → 本框可空
- Category 从「有值」改成「另一个值」→ 本框**保留原值**

**Rule Name / EQP / Carrier / Lot 星号规则**

| 输入 | 行为 |
|---|---|
| `ABC` | 精确匹配 |
| `ABC*` | 前缀匹配（值以 `ABC` 开头） |
| `*` / `*ABC` / `AB*C` / `ABC**` | 判非法 → 拦住，不发请求 |
| 空 | 不过滤 |

上述四框规则一致：块侧字段为多值时，命中其中任一即算。

**校验时机**：同时间控件 —— **输入时即时校验**（标红 + 错误文案）；点 `Search` 时被拦住、不发请求。

**时间细则**

- 过滤：`开始时间 ≤ START_TIME ≤ 结束时间`（闭区间）
- 初始值：结束时间 = 当前时刻；开始时间 = 当前时刻 − 1 小时
- 校验：任一值变化后**即时**校验
  - 规则 1：`开始时间 ≤ 结束时间`（同分钟判**合法**）
  - 规则 2：两者差值 **≤ 1 天**
- 清空开始时间 → 自动补为「结束时间 − 1 小时」
- 清空结束时间 → 自动补为「开始时间 + 1 小时」

**Min / Max Cost Time 细则**

- 单位**秒**；**入参原样传秒**（`minCost` / `maxCost`，不做 ×1000 换算，换算由后端做）
- 值域 `0 ~ 99999.99`（原上限 999.99 会把运行超 16.6 分钟的慢块 —— 静默封口、Endless、反复 REOPEN 那批 —— 永远卡在检索之外，与「找慢」的定位冲突），小数点后最多 2 位
- 过滤：`Min ≤ TOTAL_COST_MS ≤ Max`（后端把秒换算成毫秒后与 `TOTAL_COST_MS` 比）
- 校验**即时**；`Min > Max` 判不合法
- 清空：Min 自动补 `0`，Max 自动补 `999`

**本功能不含的条件**：`Inner Rule Name`、`PORTID`。

### 2.3 折叠区条件（4 项，默认收起）

| 控件 | 必填 | 取值来源 | 过滤块文档字段 | 匹配方式 | 不填 / 不选 |
|---|---|---|---|---|---|
| Host IP | 否 | 进页面调 `GET log-viewer/api/v1/ipaddress/list`（**不带参**）；Environment 选值后再调一次，带参数 `environment` | `HOSTIP` | 等值 | 不过滤 |
| User ID | 否 | 手输，**单项值** | `USERID`（keyword，可多值） | 精确比对，命中任一即算；`*` 当普通字符 | 不过滤 |
| Error Code | 否 | 手输，**单项值** | `ERR_CODE`（多值） | 命中其中任一即算；**不做模糊** | 不过滤 |
| Rule Result | 否 | 进页面调 `GET log-viewer/api/v1/rule_result/list` | `RULE_RESULT` | 等值 | 不过滤 |

Host IP 虽默认收起，**进页面照旧调候选接口**；Environment 变了仍要重取候选并清空已选值。

### 2.4 排序开关

| 项 | 口径 |
|---|---|
| 控件 | Desc Time 开关，在栅格里占一格 |
| 默认 | **关闭** |
| 关闭 | 按块文档 `START_TIME` **正序**（旧 → 新） |
| 打开 | 按 `START_TIME` **倒排**（新 → 旧） |
| 作用范围 | 只影响排序，不影响过滤 |

### 2.5 按钮

| 按钮 | 行为 |
|---|---|
| Search | 调 `POST log-viewer/api/v1/rule_info/page`，查**第 1 页**；调接口前对全部条件做前置校验，不合法不发请求 |
| 重置 | 条件区全部恢复进页面时的默认值；结果列表**清空**回到未查询态；**不自动查询** |

「重置」后各控件的取值：Environment / Host IP / Server Category / Server Number 清空；Rule Name / Rule Result / Error Code / TID / EQP / Carrier / Lot / User ID 清空；开始时间 = 当前时刻 − 1 小时；结束时间 = 当前时刻；Min / Max Cost Time = `0` / `999`；Desc Time 开关 = 关闭。

### 2.6 折叠开关

| 项 | 口径 |
|---|---|
| 控制对象 | Host IP、User ID、Error Code、Rule Result 共 4 项 |
| 默认 | 收起 |
| 位置 | 条件区末尾，与 `Search` / `重置` 同一行 |
| 状态记忆 | **记住上次状态**（存浏览器本地） |
| 收起时 | **这 4 项已填的值一并清空**（等于不限制） |
| 清空时机 | **点收起那一刻立即清**（不等点 `Search`）；重新展开看到的是空输入 |

### 2.7 联动汇总

| 触发 | 动作 |
|---|---|
| Environment 值变（选上 / 改选 / 取消） | 重取 Host IP 候选；**清空已选 Host IP** |
| Server Category 为空 | Server Number 禁用 |
| Server Category 清空 | Server Number 一并清空 |
| Server Category 改选 | Server Number **保留原值** |
| 清空开始时间 | 自动补为「结束时间 − 1 小时」 |
| 清空结束时间 | 自动补为「开始时间 + 1 小时」 |
| 清空 Min / Max Cost Time | Min 补 `0`、Max 补 `999` |
| 折叠开关收起 | Host IP / User ID / Error Code / Rule Result 的值清空 |

### 2.8 校验时机

| 控件 | 时机 | 不合法时 |
|---|---|---|
| Server Number | 点 `Search` 时 | 拦住，不发请求 |
| Rule Name / EQP / Carrier / Lot（星号） | **即时** | 标红 + 错误文案；点 `Search` 被拦住（同时间控件） |
| TID | — | `*` 当普通字符，不拦 |
| 开始时间 / 结束时间 | 即时 | 标红 + 错误文案；点 `Search` 被拦住（依 `05` §4.8） |
| Min / Max Cost Time | 即时 | 标红 + 错误文案；点 `Search` 被拦住（依 `05` §4.8） |

---

## 三、结果列表

### 3.1 分页

| 项 | 口径 |
|---|---|
| 形态 | 分页列表，回显 Search 结果 |
| 默认每页 | **20 条** |
| 档位 | **20 / 50 / 100** |
| 翻页 | 用列表自带的分页组件 |
| 分页组件 | **始终显示**（只有一页时也显示） |
| 总条数 | 显示**共 N 条**（取出参 `total`） |
| 结果数上限 | **不设** —— 不做「结果超限 / 检索截断」提示 |

### 3.2 列

列顺序固定，分五段：

| 段 | 列 | 默认 | 可否隐藏 |
|---|---|---|---|
| 恒显示（14） | Environment、Host IP、Server ID、Rule Name、Request Type、Start Time、End Time、Rule Result、Error Code、EqpID、Lot ID、Carrier ID、User ID、TID | 显示 | 不可 |
| 可隐藏（3） | Total Cost Time、Item Cost Summary、UnAccounted Cost | 显示 | 可 |
| 可选（1） | EXEC_STATUS | **不显示** | 勾选才出 |
| 动态耗时（N） | 由 Lock Object / Call Sys 决定，N = 两个多选选中的项数之和 | — | — |
| 固定末列（1） | Server Hang | 显示 | 不可 |

**列与块文档字段对照**

| 列名 | 块文档字段 | 备注 |
|---|---|---|
| Environment | `ENV` | |
| Host IP | `HOSTIP` | |
| Server ID | `SERVER_ID` | |
| Rule Name | `RULENAME` | 对 Txn 行存的是 Txn Name |
| Request Type | `REQUEST_TYPE` | 只有 `Rule` / `TXN` 两个值，兼作 Rule / Txn 的区分列 |
| Start Time | `START_TIME` | |
| End Time | `END_TIME` | |
| Rule Result | `RULE_RESULT` | |
| Error Code | `ERR_CODE` | 多值 |
| EqpID | `EQPID` | 多值 |
| Lot ID | `LOTID` | 多值 |
| Carrier ID | `CARRIERID` | 多值 |
| User ID | `USERID` | 多值（展示首值 + 角标） |
| TID | `TID` | 多值 |
| Total Cost Time | `TOTAL_COST_MS` | 毫秒存、**秒**显 |
| Item Cost Summary | `COST_SUM_MS` | 毫秒存、**秒**显 |
| UnAccounted Cost | `UNACCOUNTED_COST_MS` | 毫秒存、**秒**显 |
| EXEC_STATUS | `EXEC_STATUS` | 进行中 / 已完成 / 中断 / 超时封口 |

**耗时三列显示单位 = 秒**（字段存毫秒，显示时 ÷ 1000）。

### 3.3 列设置抽屉

入口：列表下方的**「可选列」按钮**，点击打开抽屉。

抽屉内容共四样：

1. 可隐藏三列的显隐勾选（Total Cost Time、Item Cost Summary、UnAccounted Cost），默认勾上
2. EXEC_STATUS 的显隐勾选，默认不勾
3. `Lock Object` 多选下拉，进页面调 `GET log-viewer/api/v1/lock_object/list` 取候选
4. `Call Sys` 多选下拉，进页面调 `GET log-viewer/api/v1/call_sys/list` 取候选

| 项 | 口径 |
|---|---|
| 列拖拽排序 | **不做**（`05` §4.2 的拖拽口径本次不用） |
| 恢复默认 | **不设**该按钮 |
| Lock Object / Call Sys 记忆 | **记住上次勾选**（存浏览器本地） |
| 点「确认」后 | **不重新查询** —— 按当前页已有数据**重新渲染主界面的列**：勾上的就地追加、取消勾选的就地撤掉，行数据不动，不重查接口 |
| 列值从哪来 | 一律取**当前页接口返回的参数**（`rule_info/page` 出参 `contents[]`，见 §5.3）：可隐藏三列与 EXEC_STATUS 直接取出参里的同名字段；动态耗时列按 `item` + `group` 从出参 `costBreakDown[]` 里筛 |

#### 动态耗时列

| 项 | 口径 |
|---|---|
| 生成规则 | 每选中一个锁对象 → 追加一列；每选中一个调用系统 → 追加一列。选 N 项追加 N 列 |
| 列名 | 锁 → `Lock` **+ 一个空格 +** 对象名；调用 → `Call` **+ 一个空格 +** 系统名。例：`Lock EQP`、`Call AMA` |
| 位置 | 追加在列表最后，**`Server Hang` 列之前** |
| 取值 | 从**当前页接口返回的参数**里筛：出参 `costBreakDown[]` 中 `item` + `group` 命中本列的那一条，取其 `summary` 回显到列表（该值在后端的来源是块文档 `COST_BREAKDOWN`，`04` §5.3.2） |
| 单位 | 秒 |
| 缺该项耗时 | 该单元格**显示空** |

### 3.4 Rule Result 标红

| `RULE_RESULT` 取值 | 单元格 |
|---|---|
| `CANCELRULE` | **底色改红** |
| `PASS` | 不变 |
| 其他取值 / 空 | 不变（不标成败色） |

- **只标 Rule Result 这一个单元格**，不加行首常驻标记
- 依据 `05` §2.3：块级失败只认 `Rule Result`；`Error Code` 非空**不驱动**标红

### 3.5 多值字段展示

`EQPID` / `LOTID` / `CARRIERID` / `TID` / `ERR_CODE` 一个块里可能有多个值，列里**显示首值 + 角标**（同 `04` §7.1）。

### 3.6 Server Hang 列

| 项 | 口径 |
|---|---|
| 位置 | 列表**最后一列，永远最后** |
| 形态 | 行内操作按钮，**按钮带数量**，如 `Hang (3)` |
| 数量 > 0 | 按钮**红色**、可点击 → 打开 **Server Hang 弹框** |
| 数量 ≤ 0 | 按钮**置灰**、不可点击 |
| 数据来源 | 数量 = page 出参 `hangCount`（`HANG_LIST` 长度，§5.3-9）；弹框内容 = 10 号接口 `rule_info/hang_list`（§5.3-10） |
| 本期 | Hang **未落库**：列照出现，按钮**恒置灰**（按 `≤ 0` 渲染）、**点不开**；落库后再启用 |

> **落库形态已定**：块文档嵌套数组 `HANG_LIST`，每条 **8 项** —— Start / End 两行的行 ID + 完整原文、Hang Reason、耗时、起止时间。判定与配置归模块 5 **Server Hang Reason Config**（`模块5-系统管理/01`），运行在派生服务。落库后启用：行内按钮按「数量 > 0 红 / ≤ 0 灰」判断，弹框内容见下（弹框加 Hang Reason 列**推后**，先做后端）。

#### Server Hang 弹框

| 项 | 口径 |
|---|---|
| 触发 | 点行内的 `Server Hang` 按钮 |
| 形态 | **弹框**（`05` §4.4 的「右侧抽屉 720px + Export」作废） |
| 内容 | 列表显示该块**全部 Server Hang List** |
| 列（按序） | 开始行、结束行、耗时、开始行日志、结束行日志 |
| 开始行 / 结束行 | 该行的**日志时间** |
| 耗时 | **秒，3 位小数**（同 `05` §4.2 徽标口径） |
| 开始行日志 / 结束行日志 | 该行的**日志原文** |
| 按钮 | **只有「关闭」** |
| 排序 | 按**开始行时间正序** |
| 本期 | 按钮恒置灰、弹框**开不了**；落库后启用 |

### 3.7 列表交互与状态

**选中**

| 项 | 口径 |
|---|---|
| 模式 | **单选** —— 一次只有一行选中 |
| 怎么选中 | **行首单选框**与**点击整行**都生效 |
| 选中后 | `Rule Log`、`Full Log` 可用 |
| 取消选中 | 手动取消（再点一次）→ 两个按钮不可用 |
| 保留范围 | **翻页保留** —— 翻页回来仍是它；**重新 `Search` / 点 `重置` 则一律清空** |

**列表区状态**

| 状态 | 口径 |
|---|---|
| 空结果（查到 0 条） | 下方 `Export` / `Rule Log` / `Full Log` **三个按钮都不可用** |
| 加载中 | 列表中间显示**加载动画**；`Export` / `Rule Log` / `Full Log` **三个按钮都置灰** |
| **进行中的块** | `EXEC_STATUS = 进行中` 的行**整行标记底色**（颜色令牌归 `05`）—— 表示该块仍在运行、行上的 `End Time` / 耗时 / `Hang (N)` 是**当前已推进的部分值**，需等待完成；不勾 `EXEC_STATUS` 列也能凭行色识别 |

> 选中行底色、空态插画、加载样式等**呈现细节**归原型 SKILL（`05` §4.2 已有基调），本文档只定「什么时候是什么状态」。

---

## 四、下方操作按钮

列表**选中模式 = 单选**。按钮共四个：

> **入参里的「块 `id`」从哪来**：取**本页列表出参对象里的 `id` 字段**（`rule_info/page` 出参 `contents[].id`，值 = 块文档 `_id`）。该字段**不出列**，只作 `Rule Log` / `Full Log` / `rule_info/detail` 的入参（§5.3）。

| 按钮 | 可用条件 | 动作 |
|---|---|---|
| Export | 列表**有值**时可用 | 把**当前页**列表内容导出到 Excel；**只导显示中的列**，隐藏列不导出 |
| Rule Log | **选中一行**时可用；取消选中则不可用 | 用该行的块 `id` 调 `GET log-viewer/api/v1/rule_info/detail` → 打开 **Rule Info Detail 弹窗** |
| Full Log | **选中一行**时可用 | 用该行块 `id` 调 `POST log-viewer/api/v1/rule_info/full_log` → 下载该块涉及**全部文件**的全量日志，`.zip` |
| 可选列 | — | 打开列设置抽屉 |

### 4.1 Export

| 项 | 口径 |
|---|---|
| 可用条件 | 列表有值 |
| 范围 | **当前页**的列表内容 |
| 目标格式 | Excel |
| 列范围 | **只导显示中的列**，隐藏列不导出 |
| `Server Hang` 列 | **不导出**（它是按钮，不是数据） |
| 文件名 | `RuleInfo_<导出时刻 yyyyMMddHHmmss>.xlsx`（只带导出时刻） |

### 4.2 Rule Log → Rule Info Detail 弹窗

**弹窗结构**

```
┌─ Rule Info Detail ──────────────────────┐
│  全局搜索行                              │
│  ──────────────────────────────────      │
│  日志行（滚动区，按需加载）               │
│  ──────────────────────────────────      │
│  底部：全量下载 / 成因分析 / 退出         │
└──────────────────────────────────────────┘
```

**日志按需加载（游标式）**

| 项 | 口径 |
|---|---|
| 接口 | `GET log-viewer/api/v1/rule_info/detail` |
| 首次入参 | `id` = 选中行的块 `id`（列表出参的 `id` 字段）；`lastFingerprint`、`lastOffset` **为空** |
| 返回 | `data.raw` = 本次的日志原文（**多行以换行符拼接成一个字符串**）；`data.finished` = 是否搜索完毕 |
| 显示 | 按返回顺序逐行显示在显示控件里 |
| 每批条数 | **后端定**，前端不传 |
| 触底加载 | 滚动到**最底部**时，按**上一次是否搜索完毕**决定是否再调 |
| 再调入参 | `id` = 同一个块；`lastFingerprint` = 上次返回的 `fingerprint`、`lastOffset` = 上次返回的 `offset` |
| 追加方式 | 新日志**追加到最底下** |
| 加载中 | 滑动时加**加载效果** |
| 全部取完 | 后端返回搜索完毕后，**最底部显示「搜索完毕」** |

> 与既有口径对齐：日志还原按 `LOG_FINGERPRINT` + `LOG_OFFSET` **两级排序**（`04` §5.2.4），游标用 (fingerprint, offset) 这一对正落在同一套键上。

**日志行显示**：按日志**原文一行一条**，不做加工；长行**自动换行**（折行显示，不出横向滚动条）。

**全局搜索行**：只过滤**已加载到前端**的那部分日志行。

**重开弹窗**：关闭再打开**从头重新加载**（`fingerprint` / `offset` 重新置空）。

**底部按钮**

| 按钮 | 口径 |
|---|---|
| 全量下载 | **全部日志加载完毕后按钮才出现**；把该块**全部日志行**拼成一个 `.log` 文件下载 |
| 成因分析 | **暂存、禁用** —— 为后续的 AI 分析预留 |
| 退出 | 关闭弹窗 |

### 4.3 Full Log

| 项 | 口径 |
|---|---|
| 可用条件 | **选中一行** |
| 接口 | `POST log-viewer/api/v1/rule_info/full_log` |
| 入参 | `id` = 该行的块 `id`（列表出参的 `id` 字段） |
| 后端做什么 | 由该块的 `_id` 找出**涉及的全部文件**，逐个做**文件级还原**，打包成 `.zip` 下载 |
| 还原顺序 | 每个文件内按 `LOG_OFFSET` 升序（`04` §5.2.4 文件级还原） |
| zip 内容 | **每个文件一个 `.log`**；块只落在一个文件里时，zip 内就 1 个 |
| zip 内文件名 | 取该文件的 `LOG_FILE` **原值**（含滚动序号，如 `FABsrv.log.1`；行文档字段，`04` §5.3.1） |

> **跟弹窗底部「全量下载」的区别**（刻意分成两个动作，不是同一个）：
>
> | | Full Log | 弹窗 · 全量下载 |
> |---|---|---|
> | 作用域 | **文件级** —— 块涉及的全部文件，每个文件的**全量行** | **块级** —— 本块自己的全部行 |
> | 排序 | 文件内按 `LOG_OFFSET` 升序 | 先按 `LOG_FINGERPRINT` 分组、组间按文件时序、组内按 `LOG_OFFSET` 升序 |
> | 产物 | `.zip`（每个文件一个 `.log`） | `.log`（一个文本文件） |
> | 对应 `04` | §5.2.4 文件级还原 | §5.2.4 执行级还原 |

## 五、接口清单（本功能新增）

### 5.1 统一响应包

除文件下载外，所有接口的出参外壳一致：

```json
{ "success": true, "errCode": 0, "data": ... }
```

数据一律放在 `data` 里。

### 5.2 接口总表

| # | 接口 | 方法 | 用途 | 调用时机 |
|---|---|---|---|---|
| 1 | `log-viewer/api/v1/env/list` | `GET` | Environment 候选 | 进页面 |
| 2 | `log-viewer/api/v1/ipaddress/list` | `GET` | Host IP 候选 | 进页面（不带参）；Environment 选值后再调 |
| 3 | `log-viewer/api/v1/server_category/list` | `GET` | Server Category 候选 | 进页面 |
| 4 | `log-viewer/api/v1/rule_result/list` | `GET` | Rule Result 候选 | 进页面 |
| 5 | `log-viewer/api/v1/lock_object/list` | `GET` | Lock Object 多选候选 | 进页面 |
| 6 | `log-viewer/api/v1/call_sys/list` | `GET` | Call Sys 多选候选 | 进页面 |
| 7 | `log-viewer/api/v1/rule_info/detail` | `GET` | Rule Info Detail 弹窗的日志，按游标分页 | 点 `Rule Log` 时；触底再调 |
| 8 | `log-viewer/api/v1/rule_info/full_log` | `POST` | Full Log 打包下载 | 点 `Full Log` 时 |
| 9 | `log-viewer/api/v1/rule_info/page` | `POST` | 结果分页查询 | 点 `Search` 时 |
| 10 | `log-viewer/api/v1/rule_info/hang_list` | `GET` | Server Hang 弹框的明细（块内全部 Hang） | 点 `Hang (N)` 按钮时 |

### 5.3 各接口入参 / 出参

**候选类接口 1 ~ 6**：入参走 URL 参数；`data` 为一个键 + 字符串数组。**数据源 = 模块 5 System Misc（`FabViewerMisc`）**，`item` 命名约定见 `模块5-系统管理/02-System Misc.md` §六；`ipaddress/list` 的 `environment` 参数 = 取 `ip_list`（Map 型）对应键。

| # | 接口 | 入参 | `data` |
|---|---|---|---|
| 1 | `env/list` | — | `{"env": ["PROD", "PIRUN"]}` |
| 2 | `ipaddress/list` | `environment`（可缺省） | `{"ipaddress": ["10.18.100.1", "10.18.100.3", "10.18.100.2"]}` |
| 3 | `server_category/list` | — | `{"serverCategory": ["LIST", "QUERY", "FAB", "IDE", "XSITE"]}` |
| 4 | `rule_result/list` | — | `{"ruleResult": ["PASS", "CANCELRULE"]}` |
| 5 | `lock_object/list` | — | `{"lockObject": ["EQP", "CARRIER", "LOT"]}` |
| 6 | `call_sys/list` | — | `{"calledSystem": ["MCS", "R2R", "RMS", "SPC", "RTD"]}` |

**7 · `rule_info/detail`**

| 项 | 内容 |
|---|---|
| 入参（URL） | `id=块 id&lastFingerprint=&lastOffset=`（`id` 取列表出参的 `id` 字段，§4）；首次 `lastFingerprint` / `lastOffset` 留空 |
| `data` | `{"raw": "<日志原文>", "finished": false, "fingerprint": "<文件指纹>", "offset": 985678}` |
| `raw` | 本次返回的日志原文；**多行以换行符拼接成一个字符串** |
| `finished` | 是否搜索完毕 |
| `fingerprint` / `offset` | 下次调用时回传给 `lastFingerprint` / `lastOffset` |

**8 · `rule_info/full_log`**

| 项 | 内容 |
|---|---|
| 方法 | `POST` |
| 入参 | `id=块 id`（同 `rule_info/detail` 的入参取法） |
| 出参 | **`.zip` 文件** —— 直接下载，不走统一响应包 |

**9 · `rule_info/page`**

| 项 | 内容 |
|---|---|
| 方法 | `POST` |
| `pageIndex` | 页码；点 `Search` 传 `1`，翻页传目标页 |
| `pageSize` | 每页条数；默认 `20`，可选 `20 / 50 / 100` |
| `parameters` | 16 个过滤条件 + 1 个排序开关，与 §2 条件区一一对应 |
| `serverId` | 字符串数组；由 Server Category + Server Number 拼成（`FABsrv.1`），命中任一即可 |
| `startTime` / `endTime` | 格式 `yyyyMMddHHmm`，如 `202609221543` |
| `minCost` / `maxCost` | **秒**，**原样传**（不 ×1000）；值域 `0 ~ 99999.99` |
| `ipaddress` | 键名照原样（全小写） |
| `userId` | 输入框的值（精确等值） |
| `descTime` | 布尔；`true` = 倒排（新 → 旧），`false` = 正序 |

**入参**

```json
{
  "pageIndex": 1,
  "pageSize": 20,
  "parameters": {
    "env": "<Environment 下拉框的值>",
    "serverCategory": "<Server Category 下拉框的值>",
    "serverId": ["<Server Category + Server Number 拼成的 ID 集合>"],
    "startTime": "<yyyyMMddHHmm>",
    "endTime": "<yyyyMMddHHmm>",
    "ruleName": "<Rule Name 输入框的值>",
    "tid": "<TID 输入框的值>",
    "eqpId": "<EQP 输入框的值>",
    "carrierId": "<Carrier 输入框的值>",
    "lotId": "<Lot 输入框的值>",
    "ipaddress": "<Host IP 下拉框的值>",
    "userId": "<User ID 输入框的值>",
    "errorCode": "<Error Code 输入框的值>",
    "ruleResult": "<Rule Result 下拉框选择的值>",
    "minCost": "<Min Cost Time 输入框的值>",
    "maxCost": "<Max Cost Time 输入框的值>",
    "descTime": false
  }
}
```

**出参**（统一响应包里的 `data`）

```json
{
  "totalPage": 10,
  "total": 187,
  "pageIndex": 2,
  "pageSize": 20,
  "contents": [
    {
      "id": "<块 id（值 = 块文档 _id，不出列）>",
      "env": "<ENV 列的值>",
      "ipaddress": "<HOSTIP 列的值>",
      "serverId": "<SERVER_ID 列的值>",
      "ruleName": "<RULENAME 列的值>",
      "requestType": "<REQUEST_TYPE 列的值>",
      "startTime": "<START_TIME 列的值>",
      "endTime": "<END_TIME 列的值>",
      "ruleResult": "<RULE_RESULT 列的值>",
      "errorCode": ["<ERR_CODE 列的值>"],
      "eqpId": ["<EQPID 列的值>"],
      "lotId": ["<LOTID 列的值>"],
      "carrierId": ["<CARRIERID 列的值>"],
      "userId": ["<USERID 列的值>"],
      "tid": ["<TID 列的值>"],
      "totalCostTime": "<TOTAL_COST_MS 列的值>",
      "costSummary": "<COST_SUM_MS 列的值>",
      "unaccountedCost": "<UNACCOUNTED_COST_MS 列的值>",
      "execStatus": "<EXEC_STATUS 列的值>",
      "hangCount": "<HANG_LIST 长度，int；Server Hang 列按钮的数字>",
      "costBreakDown": [
        { "item": "<ITEM>", "group": "<GROUP>", "summary": "<SUM_MS>" }
      ]
    }
  ]
}
```

**`contents[]` 字段 ↔ 列表列 ↔ 块文档字段**

| 出参字段 | 列表列 | 块文档字段 | 备注 |
|---|---|---|---|
| `id` | — | 块 `_id` | **不出列**；`Rule Log` / `Full Log` / `rule_info/detail` 的入参 |
| `env` | Environment | `ENV` | |
| `ipaddress` | Host IP | `HOSTIP` | |
| `serverId` | Server ID | `SERVER_ID` | |
| `ruleName` | Rule Name | `RULENAME` | |
| `requestType` | Request Type | `REQUEST_TYPE` | |
| `startTime` | Start Time | `START_TIME` | |
| `endTime` | End Time | `END_TIME` | |
| `ruleResult` | Rule Result | `RULE_RESULT` | |
| `errorCode` | Error Code | `ERR_CODE` | **数组** |
| `eqpId` | EqpID | `EQPID` | **数组** |
| `lotId` | Lot ID | `LOTID` | **数组** |
| `carrierId` | Carrier ID | `CARRIERID` | **数组** |
| `userId` | User ID | `USERID` | **数组** |
| `tid` | TID | `TID` | **数组** |
| `totalCostTime` | Total Cost Time | `TOTAL_COST_MS` | |
| `costSummary` | Item Cost Summary | `COST_SUM_MS` | |
| `unaccountedCost` | UnAccounted Cost | `UNACCOUNTED_COST_MS` | |
| `execStatus` | EXEC_STATUS | `EXEC_STATUS` | 可选列 |
| `hangCount` | Server Hang 列（按钮数字） | `HANG_LIST` | **数组长度**；> 0 按钮红色可点、= 0 置灰（§3.6）；明细走 10 号接口，**列表不带 HANG_LIST 本体** |
| `costBreakDown[]` | 动态耗时列 | `COST_BREAKDOWN` | 取 `item` + `group` 命中那条的 `summary` |

**10 · `rule_info/hang_list`**（配合 `HANG_LIST` 落库）

| 项 | 内容 |
|---|---|
| 方法 | `GET` |
| 入参 | URL 参数 `id`（同 `rule_info/detail` 的取法：page 出参 `contents[].id`） |
| 出参 | `data` = **该块全部 Hang 的数组，不分页**（一个块内条数有限）；按 `startTime` 升序（块内条目本就按 `START_TIME` 升序存储，原样输出） |

```json
[
  {
    "startTime": "<开始行时间>",
    "endTime": "<结束行时间>",
    "hangCostMs": "<耗时 ms>",
    "startLineLog": "<开始行完整原文>",
    "endLineLog": "<结束行完整原文>",
    "hangReason": "<Hang Reason，弹框加列推后，字段先带上>",
    "startLineId": "<开始行身份串，不出列，跳原文锚备用>",
    "endLineId": "<结束行身份串，同上>"
  }
]
```
