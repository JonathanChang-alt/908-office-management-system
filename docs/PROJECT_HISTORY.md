# 908 Office Management System - Project History

> 本日志依据 Git 历史、仓库文件、现有文档与源工作区文件时间戳整理。
> 项目早期未使用 Git，开发期事件以“阶段”描述；精确时间仅采信 Git / GitHub 记录。
> 本日志不含任何真实凭据、服务器信息或个人隐私。
> 生产环境信息不属于本公开项目日志的记录范围；公开发布版本与生产环境
> 配置、凭据和真实数据保持隔离。

## 1. Project Overview

学生会办公室 908 物资和值班管理系统：微信小程序前端 + Node.js/Express 后端 + SQLite。
覆盖物资登记/库存/借用/归还/借还记录、值班排班/打卡、工作人员与管理员权限管理。
当前正式版本 v1.0.0，公开于 GitHub，定位为作品展示与演示项目，未提供开源许可证（NO LICENSE）。

## 2. Development Timeline

### 阶段一：初始开发期 [CONFIRMED — file mtime evidence]

现存源工作区文件的 mtime 显示：核心前端文件形成于 2026-07-08 至 2026-07-09 之间
（首批页面与图标 07-08 13:39–17:22，登录/用户体系与工具模块 07-09 09:01–09:03）。
mtime 只能证明文件在相应时间被写入/修改，不能证明具体开发行为发生在该时刻。

**目标**：实现基础业务闭环（物资、借还、值班、打卡）与登录权限。

**完成内容**：后端服务（Express + better-sqlite3）、建表与种子数据、部署脚本；
小程序前端页面（首页/物资/值班/登录/用户）；微信登录（wx.login → code2Session）、
Token/Session、pending 审核状态。

**涉及模块**：backend/（server.js、db.js、routes/）、miniprogram/（pages/、utils/）。

**关键变化**：管理方式从人工登记向系统化记录迁移（依据现有 DEVELOPMENT_LOG 描述）。

**问题与处理**：早期曾依赖客户端提交的角色标记，后改为服务端基于 session/role 判断
（依据现有代码与 DEVELOPMENT_LOG 记录）。

**验证结果**：上述实现均可在当前代码中直接确认。

### 阶段二：开发联调与权限完善期 [INFERRED]

**目标**：联调前后端、完善鉴权与管理边界。

**完成内容**：全局登录鉴权、管理员操作后端强制校验、值班/打卡软删除与角色校验、
绑定码机制（现有代码可确认上述实现存在）。

**验证结果**：现有路由代码与中间件可确认实现存在；本阶段的时间跨度无直接证据。

### 阶段三：发布整理期（2026-09-01）[CONFIRMED — Session & file evidence]

**目标**：建立安全、独立、可公开的 GitHub 发布版本。

**完成内容**：建立发布副本目录；后端源码导出与脱敏（管理员 OpenID 白名单改为
环境变量配置、默认绑定码移除、敏感日志清理）；补齐初始化 Schema 与当前路由的
一致性；新增 .env.example 与 npm run init-db；完成 README / DEVELOPMENT_LOG /
ARCHITECTURE 文档；前端默认 API 指向本地地址、对外地址改为示例值、AppID 改为
touristappid；移除不可达的未完成页面。

**验证结果**：本地全流程验证通过（install → init-db → start → health 200）。

### 阶段四：第一次 Git Commit（2026-09-01 23:44:21 +0800）[CONFIRMED — Git]

`b502fa3 Initial release candidate`，51 个文件首次入库，分支 main。
（author 与 committer 时间相同。）

### 阶段五：Private 仓库与首次 Push（2026-09-02）[CONFIRMED — Git/GitHub]

创建 Private 仓库 `908-office-management-system`，push main；在线复查中未发现
.env、数据库、私钥或真实凭据等不应公开内容（.env.example 仅占位符；touristappid；
本地 API 默认）。

### 阶段六：截图与第二次 Commit（2026-09-02 12:21:35 +0800）[CONFIRMED — Git]

使用微信开发者工具模拟器配合本地 demo 后端，采集 6 张真实运行截图（登录/首页/
物资/借还记录/值班/用户管理），OCR 文字复核通过；README 展示截图；
`0796d54 Add project screenshots`（新增 6 个图片文件，仓库文件数 51 → 57）。

### 阶段七：公开前最终审核 [CONFIRMED — Session evidence]

只读全面审核：两个 Commit 的全文扫描未发现凭据类内容；Commit 作者邮箱为个人
邮箱，所有者已知悉并接受公开，Git 历史未重写；其余检查通过。

### 阶段八：Public 发布（2026-09-02）[CONFIRMED — GitHub]

仓库切换为 Public；匿名访问验证通过（主页/README/截图均 HTTP 200）。

### 阶段九：v1.0.0 定版 [CONFIRMED — Git tag + GitHub Release API]

- annotated tag `v1.0.0`：tagger time 2026-09-02 12:44:33 +0800，指向 0796d54
- GitHub Release：created_at 2026-09-02T04:44:33Z（= 12:44:33 +0800），
  published_at 2026-09-02T04:56:16Z（= 12:56:16 +0800），正式 Release（非
  pre-release）、显示为 Latest；资产仅 GitHub 自动生成的 Source code
  (zip / tar.gz)；Release notes 与既定文本一致
- 发布后只读验证：Tag 指向正确、匿名访问全通、Git 完整性不变

## 3. Major Features Completed

- WeChat Mini Program frontend（5 个页面，3 个 tabBar）
- Office materials management（登记/库存/状态/软删除）
- Borrow and return records（事务扣减/恢复库存、查询统计、管理员批注）
- Duty management（排班/本周视图/统计）
- Check-in（重复打卡与人员一致性校验、记录管理）
- User management（staff/admin/pending/disabled、管理员审核）
- Local backend support（npm run init-db / npm start）
- Demo-safe configuration（环境变量化、无默认管理员、示例种子数据）
- Documentation and screenshots（README/ARCHITECTURE/DEVELOPMENT_LOG/6 张截图）

## 4. Important Technical Decisions

（本部分只记录“采用了什么方式”与“最终状态”，不推断设计动机。）

- 目录结构：miniprogram/ 与 backend/ 分目录，docs/ 集中存放文档
- 配置处理：秘密经环境变量读取；.env.example 仅含占位符；.gitignore 覆盖
  数据库、日志、私钥、私有配置与备份
- Demo 与 production 边界：发布版不含生产数据库与 .env；种子数据均为明显示例值
- 敏感信息隔离：管理员 OpenID 白名单与绑定码均环境变量化、无默认值
- 版本管理方式：独立发布副本 → 本地首次 Commit → Private 仓库 → 在线复查 →
  公开 → annotated tag + GitHub Release 定版

## 5. Debugging and Problems Solved

### 问题一：初始化表结构与路由字段不一致
现象：fresh 数据库初始化后，部分接口会因缺列报错。
原因：初始化 Schema 与后续路由演进存在历史差异。
处理：在发布副本补齐 borrow_records / duty_schedules / users 的缺失字段并验证。
结果：7 张数据表列校验全部通过。
依据：发布整理会话记录与本地验证结果。

### 问题二：未完成页面成为死代码
现象：某历史页面调用了不存在的 API 方法，且无任何页面入口。
处理：在发布副本移除该页面及其注册，文档同步更新。
结果：发布版页面注册与实际文件完全一致（5 个注册页面全部真实存在）。
依据：全文引用审计与会话记录。

### 问题三：发布工具链与网络
现象：发布准备开始时本机缺少必要工具链，且对外网络多次中断。
处理：补齐本地 Git / Node.js 工具链，并在网络恢复后完成 GitHub Push 与验证。
结果：Push、Tag 与全部在线验证完成。
依据：会话记录。

## 6. Security and Privacy Cleanup

公开发布前完成的整理（均有会话记录与扫描结果支撑）：
- 排除生产数据库、.env、node_modules、日志、备份、私钥与 SSH 相关文件
- 真实管理员 OpenID 改为环境变量白名单机制，无默认值
- 默认绑定码从发布版移除，绑定码改为环境变量配置
- 登录日志不再输出完整 OpenID 与姓名（发布版代码）
- 种子数据中的真实姓名替换为示例姓名
- 对外地址与标识替换为示例值/游客模式；默认 API 指向本地开发地址
- 对发布版（含 Git 历史）进行多轮关键词与文件类型扫描

在本次既定扫描范围内，未发现 API Key、Token、私钥、生产凭据、生产数据库或
真实业务数据等敏感内容。本结论仅代表既定扫描范围内的检查结果，不构成绝对
安全保证。

## 7. Git and Repository Preparation

- 独立发布副本与开发工作区分离；git init -b main
- 第一次 Commit：b502fa3 Initial release candidate（2026-09-01 23:44:21 +0800，51 个文件）
- Private 仓库首次 Push 与在线复查
- 第二次 Commit：0796d54 Add project screenshots（2026-09-02 12:21:35 +0800，+6 个图片文件）
- 第三次 Commit：docs/PROJECT_HISTORY.md 入库（2026-09-02，本历史文档；
  README 与发布检查清单同步更新）
- 公开前最终审核；Commit 作者邮箱仍保留在 Git 历史中，所有者已知悉并接受公开
- 历史完整性（截至 v1.0.0 发布时）：共 2 个 Commit，无 force push、无 amend、
  无历史重写

## 8. v1.0.0 Release

- 公开基线：0796d54（Add project screenshots）
- annotated tag v1.0.0：tagger time 2026-09-02 12:44:33 +0800，指向 0796d54
- GitHub Release v1.0.0：created 2026-09-02 12:44:33 +0800（API 原始值
  2026-09-02T04:44:33Z），published 2026-09-02 12:56:16 +0800（API 原始值
  2026-09-02T04:56:16Z）；正式 Release、Latest
- Release notes：First public release of the 908 Office Management System（与既定文本一致）
- 资产：仅 GitHub 自动生成的 Source code (zip / tar.gz)，无手工上传附件
- 发布后只读验证：Tag 指向正确、匿名访问全通、Git 完整性不变、无 LICENSE

## 9. Current Project State

- 正式版本：v1.0.0；仓库 Public；分支 main
- 用途：作品展示与演示项目（portfolio / demonstration）
- 边界：在本次既定扫描范围内，未发现生产凭据、生产数据库或真实业务数据等
  敏感内容；截图与文档全部使用 demo 数据
- 已完成：业务闭环、文档、截图、初始化脚本、安全默认配置
- 尚未包含：LICENSE、自动化测试体系、CI、在线 Demo

> 历史快照（v1.0.0 发布基线，会随后续开发变化，非永久状态）：
> - v1.0.0 tag 指向 0796d54（Add project screenshots）
> - v1.0.0 发布时 Git 历史为 2 个 Commit
> - v1.0.0 发布时共有 57 个 tracked files
> - 发布后只读验证时 working tree 为 clean 状态

## 10. Lessons Learned

（本部分区分“项目事实”与“总结/建议”。）

- 项目事实：早期未使用 Git，开发期事件只能以文件 mtime 与现有文档还原。
  建议：从项目第一天起使用版本控制。
- 项目事实：公开发布前集中完成了安全整理与文档补全。
  建议：敏感配置从最初就环境变量化，文档随功能迭代持续更新。
- 项目事实：初始化脚本与路由 Schema 曾不一致，靠发布前 fresh database 验证发现。
  建议：Schema 变更与初始化脚本同步维护，并定期做 fresh database 验证。

## 11. Future Work

（以下均为“未来可考虑”事项，尚未实施，也未确定计划。）

- License 决策
- 自动化测试体系
- CI（如 GitHub Actions）
- API 文档 / OpenAPI
- 在线 Demo 部署方案
- UI / UX 改进
