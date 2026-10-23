# 四阶段管线（agent 执行版）

> 本文从 GewuMind IDE 的 orchestrator 角色 prompt 提取并改写：IDE 里的 `writeDoc`/`validateDocs`/`generateDdl` 等工具调用，在 agent 环境里变成"直接写文件 + 按格式规范自检"。`validateDocs`/`autoFixDoc` 已整体移植为 `scripts/docs-verify.mjs`（见下）。末尾有完整映射表。

## docs 校验门（阶段 1/2 的退出条件）

每写完一份 docs，跑校验器再进下一阶段（规则全部来自 `knowledge/gewumind-boot/19a-19e`，是 IDE `validateDocs` 的程序化移植）：

```bash
node scripts/docs-verify.mjs <project-root>              # 校验已存在的全部 docs + 交叉一致性
node scripts/docs-verify.mjs <project-root> --role api   # 只卡某一份
node scripts/docs-verify.mjs <project-root> --fix        # 程序化自动修复后就地写回（再校验）
node scripts/docs-verify.mjs <project-root> --json       # JSON 输出
```

- **exit 0 = 无 error**（warn 允许，问用户后决定是否修）；exit 1 = 有 error，必须修复后重跑
- 每条 issue 都带 `fix` 建议：格式类错误可直接改，`--fix` 能自动修的是确定性格式问题（空默认值、缺 **索引** 段、非法字段类型、MQTT 单独成节、缺函数/任务节、节重编号）；内容级问题（缺页面、路径错）按建议自己重写
- 校验器不替代人工交叉检查（见阶段 2 第 3 步），它只卡格式硬约束 + 结构完整性

## 通用原则（所有阶段遵守）

- **不直接执行 SQL 改库**。所有变更写成脚本文件，走 `bundle_apply` 发布。`sql_execute` 只用于只读诊断（SELECT 查现状）
- 永远不要给用户"你可以手动执行这条 SQL"这类建议——你自己完成全部生成工作
- gewumind-boot 现有表：`sys_*` / `magic_*` 开头的已存在，**不要 CREATE TABLE**，用 INSERT 数据
- `/system` 路径已被系统占用，绝对不要生成 `/system` 下的菜单或页面路由
- **补充/修改是正常流程**，不是例外：用户说"加个字段/改个页面"时，走 `knowledge/repair/` 的修复流程（改 docs → 增量生成 → 发布）
- 每阶段结束**等用户确认**再进下一阶段，不要一口气跑完
- 回答"分析项目/现在做到哪了"类问题：直接读 `docs/*.md` + `src/` 目录结构汇总，不要编造

## 阶段 1 · 写 requirement.md

### 关注点

1. **业务建模完整性**
   - 系统的所有使用者（§3）：admin / operator / 终端用户 / 财务 / 审计……
   - 组织层级（§2）：使用者归属谁？层级是什么？设备/资产归哪个组织节点？
   - **必须先和用户商讨组织层级、角色和归属**，再写用例
   - 组织数据用系统自带 `sys_office` 表（`pid` 实现层级、`type` 字典区分类型）。**不要在 §3 加"公司管理/部门管理"模块**——数据进 `sys_office`，由"组织管理"统一维护
2. **用例覆盖度**：每个角色在每个组织层级能做什么；用例的"前置/步骤/后置/字段清单/按钮/权限/查询条件"必须齐；用例之间不能打架（矛盾要主动指出）
3. **不越界**：requirement.md 不写表名（t_xxx）/ API 路径——那些在阶段 2

### requirement.md 模板（必须 7 节）

详见 `knowledge/gewumind-boot/19b-docs-requirement.md`。概要：

- §1 业务背景（why + 痛点 + 现状 + 目标）
- §2 组织机构（组织层级树 + 归属关系，角色和功能模块都依附于组织）
- §3 用户角色（列全，标注所属组织层级）
- §4 功能模块清单（每个模块：中文名 / 英文路径段 / 页面类型 / 父模块 / 权限段）
- §5 业务用例（每模块至少 1 个，含字段清单/按钮/权限/查询条件/展示列）
- §6 数据字典（所有枚举值）
- §7 权限模型（角色 → 权限码映射）

### 流程与退出条件

1. 用户给需求 / 上传 spec → 先做结构化分析，把**待确认问题**列给用户，不要直接写
2. 与用户敲定后写 `docs/requirement.md`
3. 校验：`node scripts/docs-verify.mjs <project-root> --role requirement` 必须 0 error（7 节齐全、各节表格列数、§4 英文路径、§5 字段清单/按钮/权限等硬约束都在校验器里，规范见 `knowledge/gewumind-boot/19a-docs-common.md`）
4. 通过 + 用户确认 → 进入阶段 2

## 阶段 2 · 写 ui.md / database.md / api.md

### 派生关系（requirement.md 是真相源）

| 下游 | 派生自 requirement |
|---|---|
| ui.md 菜单树 | §4 功能模块清单 |
| ui.md 字段表/按钮/权限 | §5 业务用例 |
| database.md 表结构 | §5 字段清单 |
| api.md 路径段映射 | §4 功能模块 |
| api.md 权限码段 | §7 权限模型 |

**不允许在 ui/database/api 里出现 requirement.md 没有的内容**。

### database.md 硬约束

- 表名 `t_xxx`；引擎 InnoDB / utf8mb4 / ROW_FORMAT=DYNAMIC
- 每张表用 **5 列表格**（字段/类型/必填/默认/说明）；**必填列只能填 `是` 或 `否`**（PK 写在类型里，如 `varchar(36) PK`）
- **类型列固定值**：varchar(N) / char(N) / int / bigint / tinyint / smallint / decimal(M,D) / datetime / date / time / text / longtext / mediumtext / json / boolean / bit（不准 free-style 写 string/number）
- **每张表显式列出全部公共字段**：id (varchar(36) PK) / is_del / create_by / create_date / update_by / update_date，不允许「同上」「公共字段省略」
- 关联字段用 `xxx_id varchar(36)` + 注释说明关联表，**不写外键**
- 枚举字段用 `dict: xxx` 注释关联；文档末尾必须有「数据字典清单」节，**唯一格式为 3 列表格** `| 字典编码 | 中文名 | 枚举值 |`（如 `| device_status | 设备状态 | online=在线, offline=离线 |`），**禁止 bullet list**
- 表间必须有 `---` 分隔符
- 组织机构用 `sys_office`（已含 id/name/code/pid/sort/type），**不要新建** t_company/t_dept/t_team；类型字典 `sys_dict.type='org_type'`

### ui.md 硬约束

- §1 菜单树：树形结构，菜单名 = 页面名
- 每个页面 §2.x 必须有「**字段**」**4 列表格**（字段/类型/必填/说明）。**纯列表页也要有**——至少列出表格全部展示列
- **类型列固定值**：string(N) / int / text / select / tree-select / date / datetime / upload / editor / switch / radio / checkbox（不准用 json、dropdown）
- 每个页面段后加 **ASCII 线框草图**（plain text 代码块，线框必须闭合）
- 页面表格里的状态/类型/等级等枚举值必须出现在 database.md 数据字典清单里
- 组织机构页面使用系统自带 `sys_office` 默认页面，不重复设计

### api.md 硬约束

- 路径 `/{顶级}/{子段}/{动作}`，kebab-case；权限码 `<模块>:<动作>`（list/save/delete/export/import）
- 请求扁平字段，响应统一 `{code, data, msg}`
- 组织管理 API 操作 `sys_office`：`/sys/office/list|save|delete`，权限码 `office:*`
- 类型字典 API 操作 `sys_dict/sys_dict_items`：`/sys/dict/{type}/items`，权限码 `dict:*`

**§1 路径树必须用唯一允许的左右对照格式**（严禁 5/6 列平铺表）：

```
| 左侧：Magic-API 显示路径 | 右侧：各层级 name / path |
|------------------------|--------------------------|
| `api/设备管理/` | `name: "设备管理", path: "/device"` |
| `api/设备管理/设备列表/` | `name: "设备列表", path: "/list"` |
| `api/设备管理/设备列表/列表.ms` | `name: "列表", path: "/list"` (POST 设备列表) |
```

- §1 必须包含**所有**顶层 group 目录行（§1 是索引，不能只写详情跳过索引）
- MQTT 回调放在 `设备管理/MQTT回调/` 子 group 下（主题写在对应 .ms 行说明列），禁止单独成节

**§4+ 端点格式**（不准平铺表格）：

```
#### 4.1.1 列表
- **path:** /device/list
- **method:** POST
- **permission:** device:list
- **request:** `{ current, size, where: { sn?, model?, status? }, officeId? }`
- **response:** `{ code: 200, data: { list: [...], total: N } }`
```

**§10 函数表（7 列，必须一个表格，不准每个函数单独成节）**：

```
| 中文组名 | groupPath | name | path | 参数 | 返回 | 说明 |
```

**§11 定时任务表（6 列，同构）**：

```
| 中文组名 | groupPath | name | path | cron | 说明 |
```

### 流程与退出条件

1. 先完整读 `docs/requirement.md`（不能凭印象）
2. 按序写：database.md → ui.md → api.md（每份单文件；大文档分多次写，首次 overwrite、后续 append，每写完一节核对一次完整性）
3. 校验：`node scripts/docs-verify.mjs <project-root>` 三份全过（0 error，含 §1 路径树格式 A、函数表 7 列、任务表 6 列、5 列字段表、公共字段、组织表反模式、数据字典清单格式 + 跨文档一致性检查）
4. 交叉一致性检查（自己逐项核，校验器只覆盖格式层面）：
   - ui.md 每个页面的字段 ⊆ database.md 对应表字段
   - api.md 每个权限码 ⊆ requirement §7 权限模型
   - database.md 字典键 ⊇ 所有 `dict:` 引用
   - api.md §1 路径树 group ⊇ §4 端点所属模块
5. 全部通过 + 用户确认 → 进入阶段 3

## 阶段 3 · 生成代码

### 第一步：先数总数（防止遗漏）

- ui.md §2 → **总页面数**，记住每页的表格列/查询条件/按钮
- api.md §1 路径树 → **总 api .ms 数** + **总 api 模块数**（MQTT 回调也算 api）
- api.md §10 → **总 function .ms 数**（每行一个）
- api.md §11 → **总 task .ms 数**（每行一个）

记住这些数字，生成完逐一核对。

### 生成顺序

1. **DDL**：`src/sql/ddl/{table}.sql`
   - database.md 标 `必填=是` 的字段必须 `NOT NULL`（即使有 DEFAULT）
   - `is_del` 所有表 `NOT NULL DEFAULT 0`
   - DDL 里 `dict:` 注释引用的字典键必须在 database.md 字典清单有定义，缺的补进 docs
2. **预置数据**：对 database.md 标"预置"的表 → `src/sql/insert/{table}.sql`
3. **magic-script**：`src/magic-api/{kind}/{中文组名}/.../{name}.ms` + 每级目录的 `group.json`
   - **api**：目录名来自 api.md §1 左侧中文路径；`.ms` 的 name=中文（列表/保存/详情/删除），path=英文 kebab-case（/list /save）。**所有模块必须用嵌套 group**，不允许平铺到顶级
   - **function**：遍历 api.md §10 每行：目录=`中文组名`，`group.json.path`=`groupPath` 列，.ms name=`name` 列，.ms path=`path` 列。完整 URL = groupPath + path
   - **task**：遍历 api.md §11 每行，结构同 function + cron
   - CRUD 写法：`knowledge/gewumind-boot/06-crud-api.md`；SQL 动态条件：`knowledge/database/01-sql.md`
   - **SQL 安全**：生成后跑 `node scripts/sql-check.mjs <project>`；有拼接或 SQL 里的 `${}` 一律改 `#{}` / `?{}`，exit 0 再继续
4. **组件页面（.ms）**：每个页面写 `src/pages/{name}.vue`（name 匹配 `^[a-zA-Z0-9\-_]+$`，**必须含模块前缀**如 device-list），然后：
   `node scripts/ms-component.mjs --vue src/pages/{name}.vue --group {中文组} --group-path /{英文组} --name {中文页面名} --path /{页面路径} --out src/magic-api/component`
   产出 `src/magic-api/component/{中文组}/group.json` + `{页面名}.ms`。
   **菜单 url = group-path + 页面 path**；1.0.0 的 `sys_menu` 没有 `component_id`，不要写。详见 `references/component-page.md`。
5. **菜单 SQL**：`src/sql/menu/{父中文名}-{子中文名}.sql`（**文件名全中文，禁止混英文**）
   - ui.md §1 菜单树几层就生成几层（顶级 + 子级），首页 `/home` 已有不生成
   - 子菜单 pid 用派生 UUID（nameToUuid(父菜单name)），禁止硬编码随机 UUID
   - 菜单 `url` = 组件页面完整路径（group path + 页面 path）；**不要写 `component_id`**
   - **模块绑定是可选的**，不要默认生成；需要独立顶部标签时才见 `knowledge/gewumind-boot/23-module-organization.md`
   - 每个新建菜单必须有 icon（非空），从 `knowledge/gewumind-boot/16-icon-library.md` 选
   - 菜单中文名必须与 ui.md 菜单树完全一致
6. **字典 SQL**：对 database.md 字典清单**每个键**生成一条 `sys_dict` + `sys_dict_items` INSERT → `src/sql/dict/{键名}.sql`
   - 这是 DDL 里 `dict:` 引用真正生效的步骤，**必须全部生成**

### 组件页面生成铁律（.vue）

完整规则与禁止清单见 `references/conventions.md` §SFC 硬规则。核心：

- 用 `<div class="mb-list">` 包装（**不是** `<mb-list>` 组件本体，有 bug）
- 表单用 `<mb-modal>` + 手写 `<n-form>` + `<n-grid>` + `<n-form-item>` + `<mb-input>/<mb-select>`（**不是** `<mb-form>` 容器）
- API 调用用 `$common.post` / `$common.handleDelete`，路径**不加** `/api` 前缀
- 每个按钮独立权限码，禁止复用
- `.vue` → `.ms` 的编译/发布见 `references/component-page.md`
- 权威模板：平台自带的系统页面（如 dict-list），照抄其结构
- 生成完逐页对照 ui.md §2 对应页面核对（字段/列/按钮/查询条件缺一不可）

### 完成后自检（替代 IDE 的 fixMagicApi + lintVue）

- [ ] .vue 语法合法（template/script/style 结构正确，script setup 正确 import）
- [ ] 页面数 = 阶段 3 开头数出的总数
- [ ] api .ms 数 = §1 路径树叶子数；function/task 数 = §10/§11 行数
- [ ] 字典 SQL 文件数 = database.md 字典清单行数
- [ ] 菜单 SQL 覆盖 ui.md 菜单树全部节点（除首页）
- [ ] 无禁用模式：`<mb-list>` 本体 / `<mb-form>` / `fetch(`/`axios` / `/api/` 前缀 / `.open()` / `@confirm-click` / modal 内 `<template #content>`
- [ ] SFC id/pid 全部用派生 UUID，父级 SFC 已先生成

## 阶段 4 · 发布

见 `references/publish-protocol.md`。**发布前：`node scripts/sql-check.mjs <project>` 必须 exit 0。**

要点：

1. （可选稳妥做法）先调 REST `GET /ai/snapshot` 做发布前快照
2. 收集产物 → `bundle_apply`（MCP 工具或 REST）
3. 检查响应 `errors`：非空 → 修对应文件 → 重新发布
4. 成功后向用户报告 appliedSql/appliedMs
5. 失败且需要回退 → REST `POST /ai/rollback`

## IDE 工具 → agent 动作映射表

| IDE 工具（Tauri 内） | agent 环境等价动作 |
|---|---|
| `writeDoc(file, content, mode)` | 直接写 `docs/*.md`（write/edit 工具） |
| `readDocs()` | 读 `docs/*.md` |
| `validateDocs(role)` / `checkDocCompleteness` | `node scripts/docs-verify.mjs <project-root> [--role <r>]`（exit 0 = 通过；规则 = 本文档硬约束 + `knowledge/gewumind-boot/19a-19e` 的程序化实现） |
| `autoFixDoc(role)` | `node scripts/docs-verify.mjs <project-root> --fix`（确定性格式问题自动修）+ 按 issue 的 `fix` 建议自己改写内容级问题 |
| `analyzeRequirement` / `analyzeProject` | 直接读文件分析（agent 原生能力） |
| `hasRag` / `initRag` / RAG | **不需要**。agent 直接读 docs + src 目录；项目规模用 grep/read 足够 |
| `generateDdl` | 写 `src/sql/ddl/{table}.sql` |
| `generateInsert` | 写 `src/sql/insert/{table}.sql` |
| `migrateSql` | 写 `src/sql/migrate/V{ts}_{name}.sql`（已有表变更；先用 `sql_execute` SELECT 查现状） |
| `generateMenuSql` | 写 `src/sql/menu/{中文}.sql` |
| `generateDictSql` | 写 `src/sql/dict/{键名}.sql` |
| `generateMagicScript` | 写 `src/magic-api/{kind}/{组名}/.../{name}.ms` + `group.json` |
| `writeFile` / `pushToCore` | 直接写文件到工作区 |
| `generateSfcFromVue` / `generateSfcSql` | 按 `references/sfc-compile.md` 编译写 `src/sql/sfc/{name}.sql`（脚本版见该文档） |
| `lintVue` | 自检（conventions.md 禁止清单 + 语法检查） |
| `fixMagicApi` | 阶段 3 末尾自检清单 |
| `diffSchema` | `sql_execute` 跑 `SHOW COLUMNS FROM t_xxx` 对比 database.md |
| `takeSnapshot` / `restoreSnapshot` | REST `GET /ai/snapshot` / `POST /ai/rollback` |
| `applyBundle` / `applyBundleSelective` | MCP `bundle_apply` 或 REST `POST /api/ai/bundle/apply` |
