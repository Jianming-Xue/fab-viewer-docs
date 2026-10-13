# Login History · 登录历史

| 项 | 内容 |
|---|---|
| 模块 | 模块 6 · 用户与安全管理 · **Login History** |
| 使用者 | IT 运维（安全排查） |
| 状态 | 需求骨架（沟通中） |

> **只写不删**：登录链路每次尝试（成功 / 失败）追加一条；无修改、无删除入口，不做自动清理（量级：人 × 频次，可控）。

---

## 一、功能定位

| 项 | 内容 |
|---|---|
| 干什么 | 记录并查询每次登录：谁、何时、从哪个 IP、成功与否、失败原因 |
| 形态 | 查询页（条件 + 只读列表）＋ Oracle 表 `FabViewerLoginHistory` |
| 写入方 | 登录链路（security-management 微服务内）；本页面**只读** |

## 二、表 `FabViewerLoginHistory`（只写不删）

| 字段 | 说明 |
|---|---|
| `id` | 技术主键 |
| `username` | 登录用的账号（按名记录，不引 `userId` 外键 —— 用户删除后历史仍在） |
| `authType` | LOCAL / AD（预留） |
| `success` | 成功 / 失败 |
| `failReason` | 失败原因（记真实原因，逐类区分）：密码错误 / 账号不存在 / 账号停用 / 账户过期 / 密码过期未改（强制改密未完成即退出）/ 其他 |
| `loginTime` | 登录时刻 |
| `ip` | 来源 IP |

> 登录失败的**对外提示口径**（是否区分「账号不存在」与「密码错误」以防枚举）归认证链路；历史表记**真实原因**供内部排查。

## 三、页面逻辑

| 项 | 口径 |
|---|---|
| 条件 | 账号（模糊）、时间段（起止，可空） |
| 列（按序） | Login Time、Username、Auth Type、Success、Fail Reason、IP |
| 分页 | 每页 20（不分档）；总条数取出参 `total` |
| 操作 | **只读** —— 无增删改入口 |

## 四、接口清单

外壳一律走**统一响应包**（`{ "success": true, "errCode": 0, "data": ... }`）。

| # | 接口 | Method | 用途 |
|---|---|---|---|
| 1 | `security-management/api/v1/login_history/page` | `GET` | 登录历史分页（只读；条件：username 模糊、startTime / endTime 可空） |

## 五、待定

（无）
