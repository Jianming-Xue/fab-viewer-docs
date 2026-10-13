# Login Policy · 登录策略与登录历史

| 项 | 内容 |
|---|---|
| 模块 | 模块 6 · 用户与安全管理 · **Login Policy** |
| 使用者 | IT 运维（策略维护）；登录 / 改密链路（策略消费，后端强制） |
| 状态 | 需求骨架（沟通中） |

> 策略**直接挂给用户**（用户与策略一对一，`FabViewerUser.policyId`）：角色只管功能访问权限，登录策略不在角色上。用户未挂策略 ⇒ 走**默认策略**。校验由后端强制执行，前端提示只是辅助。

---

## 一、功能定位

| 项 | 内容 |
|---|---|
| 干什么 | 制定登录策略（密码长度、字符构成、密码有效期、账户有效期），逐用户差异化生效（用户直接挂一条） |
| 形态 | 配置页（策略列表 + 表单弹框）＋ Oracle 表 `FabViewerLoginPolicy`；登录历史另立为功能 4 |
| 与 Halo 的差别 | Halo 无独立策略功能 —— 本功能为**新增** |

## 二、策略模型

### 2.1 规则项（`FabViewerLoginPolicy` 列，共 9 项）

| # | 字段 | 说明 | 值域 |
|---|---|---|---|
| 1 | `minLength` | 密码**最小**长度 | 1 ~ 64 |
| 2 | `maxLength` | 密码**最大**长度 | ≥ `minLength`，≤ 128 |
| 3 | `requireUppercase` | 至少包含**一个大写字母** | 布尔 |
| 4 | `requireLowercase` | 至少包含**一个小写字母** | 布尔 |
| 5 | `requireDigit` | 至少包含**一个数字** | 布尔 |
| 6 | `requireSpecial` | 至少包含**一个特殊字符** —— 特殊字符的判定集合 = 本策略的 `specialChars` | 布尔 |
| 7 | `specialChars` | **特殊字符集合**（随策略指定）：`requireSpecial` 勾选时，密码须至少含集合中的一个字符；未勾选时集合不参与校验（值可保留） | 字符串，长度 1 ~ 32，保存时去重 |
| 8 | `passwordValidDays` | 密码有效期天数；**`-1` = 永不过期** | -1 / 1 ~ 3650 |
| 9 | `accountValidDays` | 账户有效期天数（创建时折算为到期日，§2.4）；**`-1` = 永不过期** | -1 / 1 ~ 36500 |

表结构其余字段：`id` 技术主键、`policyName` **唯一索引**、`isDefault`（全表**恒有且仅有一条** `true`，种子初始化）、`enabled` / `updatedAt` / `updatedBy` 同全项目表规范（停用的策略视同不存在，挂它的用户回落默认策略）。

### 2.2 用户与策略的挂载（定则）

| 项 | 口径 |
|---|---|
| 挂载 | 用户直接挂**一条**策略（`FabViewerUser.policyId`）—— 无合并、无最严计算，该用户的密码与登录规则即这一条 |
| 未挂 / 挂了停用的策略 | 回落**默认策略**（`isDefault = true` 那条） |
| 变更时机 | 换挂策略只影响**之后**的动作（改密 / 重置时的新密码校验与到期日折算）；已存档的两个到期日不重算（§2.4） |

### 2.3 消费场景（后端强制）

| 场景 | 用哪些规则项 |
|---|---|
| 登录 | **账户到期判定**（`accountExpiresAt` 已过 ⇒ 拒，见 §2.4）；**密码到期判定**（`passwordExpiresAt` 已过 ⇒ 强制改密） |
| 自助改密 / 管理员重置 / 创建用户设初始密码 | 新密码校验：长度区间（1 + 2）＋ 字符构成（3 ~ 7 按开关与集合）；并折算新的 `passwordExpiresAt` |

### 2.4 两个有效期的落库与判定（定则）

| 项 | 机制 |
|---|---|
| 账户有效期 | **创建时折算成绝对日期存档**：`FabViewerUser.accountExpiresAt` = 创建时刻 + 当时策略的 `accountValidDays`；`-1` ⇒ 存空 = 永久。续期 = 编辑用户时改该日期 |
| 密码有效期 | **改密时折算成绝对日期存档**：`FabViewerUser.passwordExpiresAt` = 改密时刻 + 当时策略的 `passwordValidDays`；`-1` ⇒ 存空 = 永不过期。`passwordChangedAt` 同步刷新 |
| 不重算 | 两个到期日一经折算存档，**策略 / 挂载此后变更不重算存量** —— 密码到期日在下次改密 / 重置时刷新，账户到期日由管理员编辑修改 |
| 判定时机 | **只做登录时控制**：两个到期日都只在登录那一刻判定（账户到期 ⇒ 拒登；密码到期 ⇒ 强制改密）。**不做后台自动检测** —— 无定时扫描、不自动停用过期账户；已登录会话不受两个有效期影响 |

## 三、页面逻辑（策略列表）

| 项 | 口径 |
|---|---|
| 进入页面 | 调 `page` 取第一页（默认每页 20，不分档） |
| 列（按序） | Policy Name、Min Length、Max Length、Upper、Lower、Digit、Special、Password Valid Days、Account Valid Days、Default、Enabled、Last Updated Time、Last Updated User + Action（编辑 / 删除） |
| 有效期列显示 | `-1` 显示「永不过期」 |
| Default 列 | 「默认」标记；**默认策略不可删除** |
| 删除 | 弹框确认；**被用户挂载中的策略不允许删除**（提示挂载数，先在用户管理换挂或清空）；默认策略恒拒删 |
| 添加 / 编辑 | 弹框表单：全字段 + 校验（`maxLength ≥ minLength`；两个天数 `-1` 或正整数；勾 `requireSpecial` 时 `specialChars` 必填、保存时去重） |
| 保存 | 不即时影响已登录会话 —— 密码有效期策略在**下一次登录 / 改密**时生效；账户到期日存档值不受影响（§2.4） |

## 四、接口清单

外壳一律走**统一响应包**（`{ "success": true, "errCode": 0, "data": ... }`）。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `security-management/api/v1/login_policy/page` | `GET` | 策略分页 |
| 2 | `security-management/api/v1/login_policy` | `POST` | 新增策略 |
| 3 | `security-management/api/v1/login_policy` | `PUT` | 编辑策略 |
| 4 | `security-management/api/v1/login_policy` | `DELETE` | 删除策略（默认策略 / 被用户挂载中的拒删） |

- 用户管理页的策略下拉直接调 1 号接口取候选（启用策略 + 「默认」项）。
- 登录 / 改密 / 重置**不走本清单** —— 归认证链路与用户管理（`03` §五）。

## 五、待定

（无 —— 特殊字符集合随策略指定；密码哈希算法在创建用户时由后端处理（`FabViewerUser` 只存 `passwordHash`）；两个有效期只在登录时检测，见 §2.4。）
