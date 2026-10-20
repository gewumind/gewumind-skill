---
name: gewumind-boot
description: 面向运行中的 GewuMind Boot（magic-api 低代码后端）开发完整业务应用。四阶段管线：需求文档 → ui/database/api 设计文档 → 生成 DDL SQL / magic-script / .ms 组件页面 / 菜单与字典 SQL → 一键发布到后端。当用户要"做业务页面 / 增删改查模块 / 加菜单 / 加字典 / 写 magic-api 脚本 / 发布到 gewumind-boot"时使用。
---

# GewuMind Boot 开发 Skill

把一个自然语言需求变成**可发布的业务应用**：SQL 建表 + magic-api 脚本 + Vue 动态组件 + 菜单/字典数据，最后通过 `bundle_apply` 一次推送到运行中的 GewuMind Boot 后端。

## 前提：确认环境

开始任何工作前，先确认两件事（问用户或探测）：

1. **后端地址**（默认 `http://localhost:9089`）—— 健康探测：`GET /ai/health` 或 `GET /api/ai/health`（不同版本前缀不同，见 `references/publish-protocol.md` §路径说明）
2. **接入方式**（二选一，推荐 MCP）：
   - **MCP Server**（推荐）：后端自带 `/mcp` MCP 端点，配置方法见 `references/publish-protocol.md` §MCP。工具：`status_check` / `bundle_apply` / `sql_execute` / `file_receive` / `data_query` / `docs_push`
   - **REST**：`POST /api/ai/bundle/apply` + `X-AI-Key: <keyId>:<secret>` 头

如果连不上后端，**先停下**告诉用户，不要凭空生成产物。

## 项目工作区布局

所有生成物写在**项目工作区**（用户指定目录，参考 `magic-boot/test/` 的结构）：

```
{project}/
├── docs/
│   ├── requirement.md    # 阶段 1：需求规格（7 节）
│   ├── ui.md             # 阶段 2：界面设计（菜单树 + 页面详情）
│   ├── database.md       # 阶段 2：数据库设计（表结构 + 字典清单）
│   └── api.md            # 阶段 2：API 设计（路径树 + 端点 + 函数表 + 任务表）
├── src/
│   ├── sql/
│   │   ├── ddl/{table}.sql        # 建表（发布顺序 1）
│   │   ├── menu/{中文-中文}.sql    # 菜单 INSERT（发布顺序 2）
│   │   ├── sfc/{name}.sql         # SFC 组件 INSERT（发布顺序 3）
│   │   ├── insert/{table}.sql     # 预置数据（发布顺序 4）
│   │   ├── dict/{dict_type}.sql   # 字典 INSERT（发布顺序 5）
│   │   └── migrate/V{ts}_*.sql    # 已有表的结构变更
│   ├── magic-api/
│   │   ├── api/{中文组名}/.../*.ms + group.json   # 业务 API
│   │   ├── function/{中文组名}/...                # 公共函数
│   │   ├── task/{中文组名}/...                    # 定时任务
│   │   └── component/{中文组}/.../*.ms + group.json   # 组件页面（1.0.0）
│   └── pages/{name}.vue         # 页面源码（编译进 .ms）
```

**4 份 docs 是真相源**。代码永远从 docs 派生，不允许 docs 里没写东西出现在产物里。

## 四阶段管线（核心流程）

完整流程、每阶段退出条件、硬格式约束：**读 `references/pipeline.md`**。概要：

1. **阶段 1 · 需求**：与用户确认组织层级和角色 → 写 `docs/requirement.md`（7 节）→ 用户确认
2. **阶段 2 · 设计**：从 requirement 派生 `ui.md` / `database.md` / `api.md` → 交叉一致性检查 → 用户确认
3. **阶段 3 · 生成**：DDL → 预置数据 → magic-script（api/function/task）→ 组件页面（.vue → .ms）→ 菜单 SQL → 字典 SQL。**先数总数，再逐项生成，生成完逐一核对**
4. **阶段 4 · 发布**：调 MCP `bundle_apply`（或 REST `/api/ai/bundle/apply`）→ 检查 errors → 报告

**每阶段结束等用户确认再进下一阶段**。不要一口气跑完。

**docs 校验门**：阶段 1/2 写完 docs 后必须跑 `node scripts/docs-verify.mjs <project-root>`（`--fix` 可程序化自动修复格式问题），exit 0 才能进下一阶段。校验规则 = `knowledge/gewumind-boot/19a-19e` 文档规范（IDE `validateDocs` 的整体移植）。

## 生成代码前必读

| 要做什么 | 先读哪个 |
|---|---|
| 写 / 改 4 份 docs（阶段 1/2） | `references/pipeline.md` §docs 校验门 + 写完跑 `node scripts/docs-verify.mjs <project-root>`（`--fix` 自动修格式） |
| 改前端 / 重新部署 / 打包发行版 | `knowledge/gewumind-boot/21-frontend-build-deploy.md` |
| 不知道怎么开发 / 要不要装 IDEA / 怎么联调调试 | `knowledge/gewumind-boot/22-debug-listen-and-dev-paths.md`（含**监听调试**这个 magic-api 没有的自研能力） |
| 直接读写 `.ms` 文件 | `knowledge/server-plugin/01-structure.md` §分隔符必须带首尾 `\r\n` |
| 写组件页面（`.ms`） | `references/component-page.md` + `knowledge/gewumind-boot/04b-sfc-vue-codegen.md` |
| 写 `.vue`（SFC 表路线，旧版） | `references/conventions.md` §SFC 硬规则 + `knowledge/gewumind-boot/04-dynamic-sfc.md` |
| `.vue` → SFC SQL（编译） | `references/sfc-compile.md` |
| 建表 / 公共字段 / 命名 | `references/conventions.md` §表规范 + `knowledge/gewumind-boot/00-table-schema.md` |
| 写 magic-script CRUD | `knowledge/gewumind-boot/06-crud-api.md` + `knowledge/database/01-sql.md` |
| magic-api 语法（lambda/import/类型） | `knowledge/api/` 目录 |
| 菜单 SQL | `knowledge/gewumind-boot/05-menu-register.md` |
| 模块组织（可选，不是必绑） | `knowledge/gewumind-boot/23-module-organization.md` |
| 字典 SQL | `knowledge/gewumind-boot/13-data-dictionary.md` |
| 发布 / bundle apply | `references/publish-protocol.md` |
| 工作流 / 报表 / 插件 | `knowledge/workflow/` / `knowledge/report/` / `knowledge/server-plugin/` |

## 铁律（违反必然出 bug）

1. **不直接执行 SQL 改库**——所有变更写成脚本文件，走 `bundle_apply` 发布（`sql_execute` 只用于诊断查询）
2. `sys_*` / `magic_*` 是系统表，**不要 CREATE TABLE**，只 INSERT 数据
3. `/system` 路径已被系统占用，禁止生成
4. 组织机构用系统自带 `sys_office`，不要新建 t_company/t_dept 之类的表
5. `.vue` 里 API 调用用 `$common.post` / `$common.handleDelete`，**不用** `fetch()`/`axios`；路径**不加** `/api` 前缀
6. 每个按钮独立权限码，禁止复用；权限码格式 `<模块>:<动作>`
7. 表名 `t_xxx`；每张表显式列出全部公共字段（id/is_del/create_by/create_date/update_by/update_date），不允许「同上」
8. 菜单 SQL 文件名全中文；SFC 的 id/pid 用 name 派生的确定性 UUID（见 `references/sfc-compile.md`），禁止硬编码随机 UUID
9. 发布失败 → 读 errors → 修文件 → 重新发布。后端有发布前自动备份，必要时走 rollback 端点
10. **读写任何 `.ms` 文件，分隔符必须带首尾 `\r\n`**（`"\r\n" + 32个"=" + "\r\n"`）。漏掉会让后端 `indexOf(SEPARATOR)` 返回 -1，把整个文件当源码，在线编辑里表现为"内容是空的"。详见 `knowledge/server-plugin/01-structure.md`
11. **改前端后必须重建 + 同步 + 重打包**；且**实例运行期间禁止原地 `mvn package` 覆盖 fat jar**（会让运行中的实例抛 `NoClassDefFoundError` 并返回 404）。顺序恒为 stop → package → start。详见 `knowledge/gewumind-boot/21-frontend-build-deploy.md`
12. **先问用户走哪条开发路径**（导入 IDEA / 下 release 在线开发 / 用 skill）。只做业务功能时应推荐 **release + 在线开发**，不要让用户去装 IDEA 拉源码
13. **报表是 Vue SFC + `<MagicReport>`，不是 JSON 描述符**；组件用 `postJson` 调用，所以报表接口必须用 `body` 取参。详见 `knowledge/gewumind-boot/22-debug-listen-and-dev-paths.md`
14. **前后台联调推荐「监听调试」**（本项目独有，magic-api 没有）：设断点后点工具栏「监听调试」，再从前端触发接口，可用真实入参逐行调试
15. **magic-script 不支持 `??`（null 合并）**：`body.x ?? 1`、`body.where ?? {}` 直接解析报错，必须写 `if (x == null)`。示例库里的 `??` 是过期写法，见 `knowledge/gewumind-boot/10-magic-script.md` §5
16. **1.0.0 的 `bundle_apply` 有两个落盘坑**：① 可能写到 `<project>/file:./data/magic-api/...`（多一层 `file:`）；② 分隔符写成 `\n====\r\n`（应为 `\r\n====\r\n`）。发布后必须二进制校验并移动到正确目录，否则脚本为 null / 接口 404。详见 `references/publish-protocol.md` §实测坑
17. **页面用 `.ms` 组件页面（1.0.0）**：目录 `src/magic-api/component/{中文组}/`，`group.json` 的 `path` + 组件 `path` = 菜单 `url`；菜单**不要写 `component_id`**。生成用 `scripts/ms-component.mjs`；发布是「复制到后端 `data/magic-api/component/` + 重启」。详见 `references/component-page.md`
18. **应用侧联调口径**：业务接口是 `/api/...`，登录头是 `token: <uuid>`；在线编程编辑器在 `/#/lowcode/magic-editor`（本构建 `/magic/web` 为 404）；写菜单前先 `SHOW COLUMNS FROM sys_menu`（可能没有 `component_id`）

## 知识库索引（knowledge/）

| 目录 | 内容 | 何时查 |
|---|---|---|
| `gewumind-boot/` (29 篇) | **本项目平台约定**：表规范、mb-* 组件、SFC 机制、菜单、CRUD 模板、bundle 发布、报表、字典、图标、系统配置、**前端构建部署** | 生成任何产物前 |
| `api/` (14 篇) | magic-api 脚本语言：语法/请求/响应/模块/数据库/插件 | 写 .ms 时 |
| `database/` (11 篇) | db 模块、SQL 占位符、事务、redis/mongo/kafka/mqtt 访问 | 写 .ms 数据访问时 |
| `function/` (6 篇) | magic-api 内置函数：聚合/集合/类型转换 | .ms 里用函数时 |
| `task/` (5 篇) | 定时任务插件配置与注册 | 生成 task .ms 时 |
| `workflow/` (5 篇) | 工作流定义文件、入口 API、包装页面 | 做审批流时 |
| `report/` (6 篇) | 报表组件 props 与生成工作流 | 做报表时 |
| `server-plugin/` / `subscriber-plugin/` | 服务端插件 / 订阅插件开发与推送 | 做插件时 |
| `repair/` | 补充/修改已有功能的修复流程 | 用户说"改一下/加个字段"时 |
