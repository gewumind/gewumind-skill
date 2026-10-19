## gewumind-boot 项目总览

本项目是 **gewumind-boot**：基于 [magic-api](https://gitee.com/ssssssss-team/magic-api) 的低代码业务系统，包含：

- **后端**：magic-api 框架（脚本引擎 + DB 访问 + 插件）
- **前端**：Vue 3 + Naive UI + 自研 mb-* 组件库
- **数据**：MySQL，InnoDB / utf8mb4
- **认证**：sa-token

### 本 skill（`gewumind-boot/`）的范围

**只**涵盖本项目特有的内容：
- 表规范（`sys_*` 业务表）
- 前端 mb-* 组件（mb-table、mb-form、mb-editor-table ...）
- 动态 SFC 组件机制
- 菜单注册（`sys_menu`）
- 后端 .ms 脚本模式（CRUD 模板）
- 代码生成器
- 前端项目结构 / 路由 / 权限 / 全局对象

### 其他 skill（本项目依赖的底层能力）

| Skill | 范围 | 与本项目的关系 |
|---|---|---|
| **`api`** | magic-api 脚本语法（import/lambda/try/async/类型转换等） | 后端 .ms 脚本的语法基础 |
| **`function`** | magic-api 内置函数（聚合/类型转换/集合扩展） | 后端 .ms 脚本里直接用 |
| **`database`** | db 模块 / redis / mongodb / SQL 占位符 | 后端 .ms 脚本访问数据用 |
| **`task`** | magic-api-plugin-task 定时任务 | 后端 cron 任务用 |

**这 4 个 skill 与本项目无关**——任何使用 magic-api 的项目都需要它们。改它们 = 改 magic-api 框架文档；改本 skill = 改 gewumind-boot 项目约定。

### 改哪里速查

| 想改的内容 | 改哪个 skill |
|---|---|
| mb-table 加个 prop | `gewumind-boot/01-mb-table.md` |
| 表审计字段 | `gewumind-boot/00-table-schema.md` |
| 后端 .ms 怎么写 CRUD | `gewumind-boot/06-crud-api.md` |
| SQL 动态条件写法 | `database/01-sql.md` |
| magic-script lambda 语法 | `api/01-grammar.md` |
| Redis 命令调用方式 | `database/04-redis.md` |
| 定时任务 cron 配置 | `task/01-config.md` |
| 集合的 group by | `function/02-collection.md` |

### 后端脚本生成原则

**先查底层 skill，再用本项目约定**：
1. SQL 语法 → `database/01-sql.md`
2. .ms 写法和审计字段 → `gewumind-boot/06-crud-api.md`
3. 魔法函数 → `function/`
4. 通用模块 → `api/03-response.md` `api/04-http.md` 等
