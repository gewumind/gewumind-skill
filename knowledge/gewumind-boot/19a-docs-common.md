# 19a — 4 份 docs 通用规范（追溯矩阵 / 工具 / 命名 / 禁止项）

> AI 在生成 / 修复 / 改写项目 docs 时必读。docs 是「项目大脑」：决定 DDL、API、SFC、menu SQL 怎么写。
> docs 出错 → 后续生成全错。**所以写 docs 比写代码更要谨慎**。

## 概述：4 份 docs 的定位

| 文件 | 写什么 | 不写什么 | 读者 |
|---|---|---|---|
| `requirement.md` | 业务背景、组织机构、用户角色、用例、痛点 | 技术方案、表结构、API | 产品/客户/PM |
| `ui.md` | 菜单组件树、每个页面的字段/按钮/操作流 + ASCII 线框图 | 后端表、API | 前端 SFC 生成 + menu SQL / 用户确认 |
| `database.md` | 表结构、字段类型、约束、关系 | 菜单、API | DDL 生成 |
| `api.md` | 每个端点 path/method/参数/响应/权限 | 页面字段、表结构 | .ms 生成 |

**doc → 生成物映射**：
- **ui.md** → SFC（.vue 页面）+ menu SQL（sys_menu INSERT）
- **database.md** → DDL（CREATE TABLE）
- **api.md** → magic-api 脚本（.ms）

**严禁越界**：
- requirement.md 不写「表名 = sys_user」 → 写「需要记录用户信息（含登录名、密码、姓名）」
- ui.md 不写「POST /user/save」 → 写「点保存 → 提示成功 → 列表刷新」
- database.md 不写「POST /user/list」 → 写「users 表加 login_count 字段」
- api.md 不写「页面上要 logo」 → 写「GET /system/config/logo 返回 base64」

## 1. validateDocs 工具

LLM 在生成 docs 后**必调** `validateDocs()`。验证范围包括：
1. **结构完整性** — 每份 doc 是否包含强制章节
2. **内容完整性** — requirement.md 的每个模块/字段/字典是否在 ui.md / database.md / api.md 中有对应内容（见 §2 追溯矩阵）
3. **交叉一致性** — 4 份 docs 之间的命名/路径/权限是否一致（见 §3）

返回结构：

```json
{
  "requirement": {
    "issues": [
      {"level": "error", "msg": "缺少 §1 业务背景", "fix": "应加 ## 1. 业务背景"},
      {"level": "warn", "msg": "§5 业务用例 缺「字段清单」", "fix": "每个用例加「字段清单」段：字段名 · 类型 · 必填 · 唯一 · 说明"}
    ],
    "score": 85
  },
  "ui": {...},
  "database": {...},
  "api": {...},
  "summary": "需求文档存在 2 个 error + 1 个 warn，建议修复后再生成脚本"
}
```

**LLM 看到 validateDocs 输出**：
- error → 必须修复后再进入「生成脚本」阶段
- warn → 询问用户后修复
- 全部通过 → 进入下一阶段

## 2. fixDoc 工具

```js
fixDoc({
  file: 'requirement.md',
  issues: [
    {level: 'error', msg: '...'},
    {level: 'warn', msg: '...'},
  ],
  autoFix: true  // 自动应用建议修复
})
```

返回：
- 用户**未确认** → 工具返回建议列表，等用户在 UI 上点「应用」
- 用户**已确认** → 直接 `writeFile(requirement.md, fixedContent)`
- `dryRun: true` → 只返回 diff，不写

## 3. 内容完整性校验（requirement → docs 追溯）

> ⚠️ **requirement.md 是所有 docs 的唯一来源。每个写在 requirement 里的需求，都必须在 ui.md / database.md / api.md 中有对应内容。**

### 3.1 追溯矩阵（写完后必须逐行对照）

| requirement.md § | 必须在 ui.md 有 | 必须在 database.md 有 | 必须在 api.md 有 |
|---|---|---|---|
| §4 功能模块清单 每条 | 菜单树对应节点 | - | 路径段映射对应段 |
| §5 业务用例 每个用例 | 对应页面（字段/按钮/操作流） | 对应表（字段/类型/约束） | 对应 API 组（增删改查列表） |
| §5 字段清单 每个字段 | 页面字段表的行 | 表字段列 | 请求/响应 VO 属性 |
| §5 按钮 每个按钮 | 页面按钮列表 | - | 对应 API（save/delete 等） |
| §5 列表查询条件 每个 | 页面搜索条件 | 表索引/字段 | API list 请求参数 |
| §6 数据字典 每个 dict | 字段类型标注 `dict: xxx` | 数据字典清单 + 字段关联 | - |
| §7 权限模型 每个角色 | 页面权限码标注 | - | 接口权限码段 |

**缺失判断标准**：
- requirement.md 里写了字段 A → ui.md 没有字段 A → **error**
- requirement.md 里写了模块 B → ui.md 菜单树没有 B → **error**
- requirement.md 里写了字典 C → database.md 数据字典清单没有 C → **error**
- requirement.md 里写了用例 D → api.md 没有 D 的接口组 → **error**

### 3.2 写后自检流程

1. **读完** requirement.md 全文
2. 每读一个模块/字段/字典 → 确认它在目标 doc 里的位置
3. 如果发现缺失 → 在 **写当前 doc 之前**就问用户，不要等到写完
4. `validateDocs` 运行后，针对 `issues` 里的每个 `error` → 调 `fixDoc` 修复，**不能跳过**

**典型遗漏场景**（AI 历史翻车记录）：
- ❌ requirement 里写了 8 个功能模块，ui.md 菜单树只有 6 个
- ❌ requirement 里某个用例列出了 5 个字段，ui.md 页面字段表只有 3 个
- ❌ requirement 里某个字段是 `dict: xxx`，database.md 漏了对应的字典项
- ❌ requirement 里某个模块要求「批量删除」按钮，ui.md 没写，api.md 没 delete 接口
- ❌ requirement 里写了组织架构 4 级，database.md 没有提及 `sys_office` 表

## 4. 4 份 docs 的交叉一致性

LLM 必须**自检**：

| 检查项 | 来源 | 验证 |
|---|---|---|
| ui.md 菜单树路径段 | → api.md 路径段映射 | 完全一致 |
| api.md 路径树文件夹/文件 | → magic-api group.json + .ms | 顶级文件夹 = group，二级文件夹 = 嵌套 group，.ms = action |
| api.md 路径树 | → ui.md 菜单树 | 每个菜单树页面在路径树至少有一个 list.ms |
| menu SQL 的 url | → ui.md 菜单路径 | 完全一致 |
| database.md 表名 | → api.md 路径 | 表名应反映业务（无强约束） |
| ui.md 字段 | → database.md 表 | 字段名/类型一致 |
| ui.md 权限 | → api.md 权限码段 | 段名一致 |
| ui.md 字典引用 | → database.md 字典关联 | 字典 type 一致 |
| ui.md 操作流 | → api.md 业务说明 | 1.1 列表 = 1.1 list |
| 4 docs 命名 (snake_case) | 统一 | 全文一致 |

不一致 → `validateDocs` 报错 → LLM 必须先修一致再生成脚本。

## 5. AI 工作流（在 orchestrator 里的 4 阶段）

```
阶段 1: 调研
  ↓
  readDocs → 看现状
  searchDocs → 找历史知识
  ↓
阶段 2: 生成 docs
  ↓
  ⚠️ 多轮讨论时每次都是全量 writeFile，不是 append
  writeDoc(requirement.md) → validateDocs → fixDoc（循环）
  writeDoc(ui.md) → validateDocs
  writeDoc(database.md) → validateDocs
  writeDoc(api.md) → validateDocs
  ↓
阶段 3: 生成脚本
  ↓
  listTables → diffSchema → 检查 schema 现状
  generateDdl / generateMenuSql / generateSfcSql
  generateDictSql / generateMagicScript
  ↓
  🚨 **必须调一次 fixMagicApi**（不是可选！fixMagicApi 修：.ms groupId 悬空、菜单 component_id 缺、L2 SFC 缺、L3 按钮菜单、sys_menu permission 重复、L1 SFC 缺）
  ↓
  fixMagicApi 后才能进 阶段 4
  ↓
阶段 4: 发布验证
  ↓
  applyBundleSelective（按 UI 勾选）
  失败 → rollback（applySnapshot）→ 修复 → 重试
  成功 → takeSnapshot
```

> 每一阶段必须等上一阶段**完整通过**才能进入下一阶段。
> validateDocs 失败 → 回到「生成 docs」阶段。
> applyBundle 失败 → 回到「生成脚本」阶段。

## 6. 禁止总结（通用）

- ❌ **绝不编造 docs 里没有的内容**。LLM 只能生成 docs 里明确写到的字段、权限、菜单、字典。
- ❌ **绝不跨边界**写 docs（api.md 不写字段，database.md 不写路径）。
- ❌ **绝不在 docs 里有「TBD」/「待定」/「TODO」**。如果 LLM 不知道，应该问用户。
- ✅ **每个 docs 必须能独立读懂**——读者不读另 3 份也能理解。
- ✅ **每份 docs 开头有「修订记录」节**（阿拉伯数字编号整体内容），便于快速了解最新变更。
- ✅ **保持单文件** — requirement / ui / database / api.md 各自一份，不拆 `--N-` 子文件。如果内容长就写长，不要为了拆而拆

## 7. 命名规范（4 份 docs 通用）

- **表名**: `t_xxx`（系统表 `sys_*` / `magic_*` 已存在，不要建）
- **字段名**: snake_case（`sn`, `device_name`, `create_date`）
- **API 路径**: `/{顶级}/{子段}/{动作}`，kebab-case（`/device/list`）
- **权限码**: `<模块>:<动作>`（`device:list` / `device:save`）
- **菜单名**: 中文（`设备管理`）
- **SFC name**: kebab-case（`device-list`）
- **文件**: 放 `src/pages/{name}.vue` / `src/magic-api/{kind}/{group}/{name}.ms`

## 8. 写前强制检查清单（通用）

**调用 `writeDoc()` 前必须逐条确认**。任何一条不满足 → 修改后再写。

### 内容完整性（requirement → docs 追溯）
- [ ] requirement.md §4 每个功能模块 → 菜单树有对应节点
- [ ] requirement.md §5 每个用例 → ui.md 有对应页面
- [ ] requirement.md §5 每个字段 → ui.md 页面字段有该行
- [ ] requirement.md §5 每个按钮 → 页面按钮列表有该项
- [ ] requirement.md §5 每个查询条件 → 页面搜索条件有该项
- [ ] requirement.md §6 每个字典 → database.md 数据字典清单有该项
- [ ] requirement.md §7 每个权限角色 → api.md 权限码段有对应段
- [ ] requirement.md §5 每个字段 → database.md 对应表有该列
- [ ] requirement.md §5 每个用例 → api.md 有对应 API 组

### 脚本生成（stage 3）
- [ ] **magic-api 目录和 api.md §1 路径树左侧完全一致**（中文嵌套，如 `设备管理/设备列表/列表.ms`），不额外生成英文目录
- [ ] **.ms 文件名和 api.md §1 路径树右侧 name 字段一致**（如 `列表.ms` `保存.ms` `详情.ms`），不用英文
- [ ] **group 参数用 `/` 分隔嵌套**（如 `设备管理/设备列表`），不用 `-` 平铺
- [ ] group.json.path 永远英文单段（`/device`, `/notice`, `/function`），无中文
- [ ] 目录名（文件夹）用中文，group.json.name 跟目录名一致
- [ ] 一个 action 一个 .ms 文件，无重复/下划线平铺文件
- [ ] 子 group 的 parentId 指向父 group.id（嵌套层级）
- [ ] 每个二级模块**都有父级 group**（如 `内容管理/通知公告` → 父级 `内容管理/` 存在且 parentId 正确）
- [ ] 无 parentId=0 的业务子模块（只有顶级模块如 设备管理/配置管理/内容管理/升级管理/系统设置/首页 可以 parentId=0）
- [ ] group.json.path 必须与 api.md 路径段映射一致（如 api.md 写 `/notice` → group.path 必须 `/notice`）
- [ ] 系统设置顶级 group.path = `/setting`，不是 `/system` 也不是 `/settings`
- [ ] **function/task 同样用嵌套中文 group**（如 `组织服务/获取当前用户组织机构.ms`）— group.json.path 是英文单段（如 `/getCurrentUserOffice`）
- [ ] **MQTT 回调也用 `kind=api`，纳入 §1 路径树的合适 group 下**（如 `设备管理/MQTT回调/心跳上报.ms`）— **禁止单独放在 `/mqtt/` 目录**
- [ ] 列表 API 脚本调用 `office()` 做组织过滤
- [ ] 项目根目录有 `function/组织服务/获取当前用户组织机构.ms`

### SFC 生成（stage 3）
- [ ] 查询条件、展示列、按钮都从 ui.md 逐条对照，无遗漏
- [ ] `officeId` 查询条件已在 `listOptions.table.where` 中配置
- [ ] 字典字段使用了 `dictStore.getDict('xxx')`
- [ ] SFC name 是纯英文 kebab-case（`device-list`），不含 `/`
- [ ] menu SQL 的 `componentName` 与 SFC name 一致
