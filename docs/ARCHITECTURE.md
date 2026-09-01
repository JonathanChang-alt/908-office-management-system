# System Architecture

## 1. Overall Architecture

```text
微信小程序（WeChat Mini Program）
    |
    | HTTP / REST API
    v
Node.js + Express（后端服务，默认 127.0.0.1:3001）
    |
    | better-sqlite3
    v
SQLite 数据库（data/swu_office.db）
```

## 2. Frontend

前端为原生微信小程序，位于 `miniprogram/`：

| 模块 | 职责 |
| --- | --- |
| `pages/index` | 首页仪表盘：物资 / 借还 / 值班 / 打卡统计、最近借还、值班列表 |
| `pages/materials` | 物资管理：列表、新增、编辑、停用、借用、归还 |
| `pages/duty` | 值班管理：排班、打卡、打卡记录 |
| `pages/users` | 用户管理（管理员）：用户列表与角色 / 状态更新 |
| `pages/login` | 微信登录（wx.login → 后端 wechat-login） |
| `utils/api.js` | 统一 API 请求封装（BASE_URL 配置、Token 注入、401 处理） |
| `utils/auth.js` | 本地登录态管理（token / currentUser、角色判断、登录守卫） |

页面导航为三个 tabBar：首页、物资、值班。

## 3. Backend

后端位于 `backend/`，主要模块：

| 文件 | 职责 |
| --- | --- |
| `server.js` | Express 入口：环境变量加载、全局 Token 鉴权中间件、路由注册、健康检查 |
| `db.js` | SQLite 连接（WAL 模式）、建表函数、演示数据种子、绑定码种子 |
| `routes/auth.js` | 微信登录（code2Session）、会话创建、`/auth/me` |
| `routes/materials.js` | 物资查询 / 新增 / 编辑 / 停用、统计 |
| `routes/borrow.js` | 借还记录查询、借用、归还、管理员批注 |
| `routes/duty.js` | 值班排班查询 / 新增 / 编辑 / 软删除、统计 |
| `routes/checkin.js` | 打卡、查重、打卡记录、统计、软删除 |
| `routes/users.js` | 用户列表与更新（管理员） |
| `scripts/init-db.js` | 数据库初始化脚本（`npm run init-db`） |

## 4. Authentication

```text
小程序 wx.login
    | 临时 code
    v
POST /api/auth/wechat-login { code, name }
    |
    | 后端调用微信 code2Session（WECHAT_APPID + WECHAT_SECRET）
    v
openid
    |
    | 查询 / 创建 users 记录
    | 管理员白名单判断（ADMIN_OPENIDS 环境变量）
    v
生成随机 Token → 写入 sessions 表（7 天有效期）
    |
    v
返回 { token, user } → 小程序端存储并随请求携带（Authorization: Bearer <token>）
```

- 全局中间件解析 Token → 查询有效 session → 注入 `req.user`
- 新用户默认 `pending`，管理员审核后为 `active`
- `disabled` 用户不可登录使用

## 5. Authorization

接口访问边界（由 `server.js` 全局中间件强制）：

| 角色 | 权限 |
| --- | --- |
| anonymous（未登录） | 仅可访问健康检查 `GET /api/health` 与登录接口 `POST /api/auth/wechat-login`；其余接口返回 401 |
| staff（工作人员，active） | 可查询数据、借用 / 归还、打卡 |
| admin（管理员） | 额外拥有：物资 / 值班新增编辑删除、打卡记录删除、借还批注、用户管理 |

管理员写操作统一在服务端校验 `req.user.role === 'admin'`（基于 session，不信任客户端提交的角色字段），staff 越权返回 403。

## 6. Database

SQLite 数据库共 7 张表（由 `db.js` 建表函数创建，`npm run init-db` 初始化）：

| 表名 | 作用 |
| --- | --- |
| `materials` | 物资：编号、名称、分类、总量 / 可借数量、位置、状态 |
| `borrow_records` | 借还记录：借用人、物资、数量、用途、借用 / 归还时间、备注、批注、状态 |
| `duty_schedules` | 值班排班：日期、星期、时段、值班人员、地点、状态 |
| `checkins` | 打卡记录：值班 ID、打卡人、打卡时间、状态 |
| `users` | 用户：openid、姓名、角色、部门、绑定码、手机号、状态 |
| `sessions` | 登录会话：Token、openid、过期时间 |
| `bind_codes` | 身份绑定码：码、姓名、角色、使用状态 |

## 7. Material Flow

```text
物资登记（materials）
    → 借用（borrow）：事务内写入 borrow_records 并扣减 available
    → 库存减少，available 为 0 时状态自动变为「已借完」
    → 归还（return）：事务内更新记录为「已归还」并恢复 available（不超过 total）
    → 历史记录保留（borrow_records 不删除，物资停用为软删除）
```

## 8. Duty Flow

```text
值班排班（duty_schedules，管理员维护）
    → 值班人员打卡（checkins）
    → 校验：值班存在 / 未重复打卡 / 打卡人与值班安排一致
    → 打卡记录保留（删除为软删除）
```

## 9. Security

- 所有秘密通过环境变量读取（`WECHAT_SECRET` 等），`.env` 被 `.gitignore` 排除
- Token 服务端随机生成并入库，客户端仅持有会话 Token
- 管理员 OpenID 白名单由 `ADMIN_OPENIDS` 环境变量配置，无默认管理员
- 绑定码由环境变量配置（`ADMIN_BIND_CODE` / `STAFF_BIND_CODE` / `REVIEW_BIND_CODE`），不硬编码默认值
- 后端全局鉴权 + 服务端角色校验，接口边界见第 5 节
- 生产数据库不进入仓库，仓库不包含任何真实用户数据

## 10. Deployment

抽象部署方式（不含具体服务器信息）：

```text
微信小程序
    ↓ HTTPS
Linux 服务器（反向代理）
    ↓ 反向代理 /api
Node.js + PM2（127.0.0.1:3001）
    ↓
SQLite
```

本地开发默认：微信开发者工具 → `http://127.0.0.1:3001/api` → 本机 Node.js 后端。
