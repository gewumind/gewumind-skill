# 19e — api.md 规范

> AI 在生成 api.md 时必读。api.md 是 magic-api 脚本（.ms）和 group.json 生成的唯一依据。
>
> 相关 skill：
> - 通用规范（追溯矩阵、命名、工具）见 `19a-docs-common.md`
> - magic-script 语法（db 操作 / 条件 / 函数调用等）见 `10-magic-script.md`
> - magic-api URL 规则见 `17-magic-api-url.md`
> - magic-function 见 `14-magic-function.md`
> - magic-task 见 `15-magic-task.md`

## 1. 完整节结构

**api.md 必须包含以下节**（不可省略）：

| 节 | 名称 | 必含 |
|---|---|---|
| §1 | 路径树 | ✅ 必含（左右对照表格） |
| §2 | 权限码段 | ✅ 必含 |
| §3 | 组织数据权限 | ✅ 必含 |
| §4+ | 各模块 API 端点 | ✅ 覆盖 ui.md 菜单树所有模块 |
| §N | 函数（Function） | ✅ 必含，即使空表也写 |
| §N+1 | 定时任务（Task） | ✅ 必含，即使空表也写 |

> 写 api.md 时**必须从 §1 开始写**，不允许从 §3 或 §4 开始。

## 2. §1 路径树（左边 Magic-API 路径 → 右边各层级 name / path）

> ⚠️ **§1 路径树是 api.md 的第一节，也是后续生成 group.json 和 .ms 脚本的唯一依据。不允许省略或跳过。如果你打算从 §3/§4 开始写，先停下来——必须先写完 §1 路径树。**

```markdown
# API 接口

## 修订记录
| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-06-11 | v1.0 | 初稿 |

## 1. 路径树（左边 Magic-API 路径 → 右边各层级 name / path）

> ⚠️ **§1 路径树必须用唯一的左右对照格式**（下面示例）。这是后续 parser（`parseApiPathTree`）唯一识别的格式，**任何其他格式（5 列表、多列平铺、含类型列等）都会被 autoFixDoc 拒绝并强制重写**。

路径树按模块分组，每个模块一个表：
> - **左侧**：Magic-API 工具里显示的文件夹/文件路径（用中文目录名）
> - **右侧**：该层级 group.json 的 `name`（中文）和 `path`（英文段）配置
>
> 这种**左右对照**形式方便后续 LLM 生成 group.json 和 .ms 脚本。

### 设备管理 (/device)

| 左侧：Magic-API 显示路径 | 右侧：各层级 name / path |
|------------------------|--------------------------|
| `api/设备管理/` | `name: "设备管理", path: "/device"` |
| `api/设备管理/设备列表/` | `name: "设备列表", path: "/list"` |
| `api/设备管理/设备列表/列表.ms` | `name: "列表", path: "/list"` (POST 设备列表) |
| `api/设备管理/设备列表/保存.ms` | `name: "保存", path: "/save"` (POST 新增/编辑) |
| `api/设备管理/设备列表/详情.ms` | `name: "详情", path: "/detail"` (GET 详情) |
| `api/设备管理/设备列表/删除.ms` | `name: "删除", path: "/delete"` (POST 删除) |
| `api/设备管理/状态监控/列表.ms` | `name: "列表", path: "/list"` (POST 状态监控列表) |
| `api/设备管理/远程控制/发送.ms` | `name: "发送", path: "/send"` (POST 远程控制指令) |
| `api/设备管理/MQTT回调/` | `name: "MQTT回调", path: "/mqtt"` |
| `api/设备管理/MQTT回调/心跳上报.ms` | `name: "心跳上报", path: "/heartbeat"` (MQTT 主题 device/heartbeat) |
```

**规则（强约束，违反会被 autoFixDoc 拒绝重写）**：
- **必须用上面示例的左右对照 2 列格式**（左列 `` `api/中文目录/` `` 反引号包围，右列 `` `name: "中文", path: "/英文"` `` 反引号包围）
- **严禁**用其他格式：5 列含类型/方法、6+ 列平铺表、含「字段」标题的字段表等
- 错误示范（会被拒绝）：
  - ❌ `| 类型 | magic-api 路径 | name | path | method |`
  - ❌ `| 中文目录 | /path | 文件名 | POST | /path | 说明 |`
  - ❌ 任何不以上面格式为模板的变体
- 左侧 = Magic-API 工具界面里看到的完整路径（中文目录名拼接）
- 右侧 = 该层级 group.json 的 `{name, path}` 配置
- `name` 是中文（用于 Magic-API 界面显示；.ms 条目的 name **必须与文件名一致**，如 `列表.ms` → `name: "列表"`，不可写成 `name: "list"`）
- `path` 是英文 kebab-case（用于 URL 拼接）
- 每个页面必须有一个 `列表.ms`（列表查询）
- 文件名用中文动作命名，与文件名语义一致：
  - `列表.ms` = 列表查询
  - `保存.ms` = 新增/编辑
  - `详情.ms` = 单条详情
  - `删除.ms` = 删除
  - `下拉.ms` = 下拉选项
  - `发送.ms` = 发送指令
  - `日志.ms` = 日志列表
  - `查询.ms` = 查询
  - `预览.ms` = 预览
  - `执行.ms` = 执行操作
  - `重试.ms` = 重新下发
  - `创建.ms` = 创建
  - `暂停.ms` / `继续.ms` / `取消.ms` = 任务控制
  - `发布.ms` = 发布
  - `统计.ms` = 统计数据
  - `批量下发.ms` = 批量推送
- 路径名必须与 ui.md 菜单树的路径段**完全一致**

## 3. §2 权限码段

```markdown
## 2. 权限码段
| 模块 | 权限码段 |
|------|----------|
| 首页 | home: |
| 设备管理 | device: |
| 配置管理 | config: |
| 内容管理 | content: |
| 升级管理 | upgrade: |
| 系统设置 | setting: |
| 组织管理 | org: |
```

## 4. §3 组织数据权限

> 所有列表查询 API **必须**按当前用户组织范围过滤数据。不允许全表无过滤查询。

**规则**：
1. 列表 API 在脚本中**必须调用 `office()`** 获取当前用户的可视用户 ID，作为 `create_by in(...)` 或 `office_id in(...)` 条件
2. 请求参数中**必须提供** `officeId`（可选），用户可手动选择其他组织
3. 如果业务表有 `office_id` 字段，直接按 `office_id` 过滤；如果没有，通过 `create_by` 关联用户表再关联组织
4. 每个列表 API 的请求结构必须包含 `officeId` 参数说明

## 5. §4+ 每个 API 格式

> ⚠️ **§4+ 每个 API 必须用以下固定格式**（连字符 + 粗体字段名 + 冒号 + 空格 + 值）。后续 LLM 生成 .ms 时按此格式解析 path/method/permission。

```markdown
## 4. 设备管理 API

### 4.1 设备列表 API (/device/list)

#### 4.1.1 列表
- **path:** /device/list
- **method:** POST
- **permission:** device:list
- **request:** `{ current, size, where: { sn?, model?, status? }, officeId? }`
- **response:** `{ code: 200, data: { list: [DeviceVO], total: N } }`

#### 4.1.2 详情
- **path:** /device/list/{id}
- **method:** GET
- **permission:** device:list
- **response:** DeviceVO

#### 4.1.3 保存
- **path:** /device/list/save
- **method:** POST
- **permission:** device:save
- **request:** DeviceDTO (sn, name, model, installLocationId)
- **response:** `{ code: 200, data: { id } }`
- **业务:** id 为空 → INSERT；非空 → UPDATE

#### 4.1.4 删除
- **path:** /device/list/{id}
- **method:** DELETE
- **permission:** device:delete
- **业务:** 逻辑删除 (is_del=1)
```

**字段名固定**（必须用以下 5 个粗体字段名，顺序可选）：
- `**path:**` — URL 路径（不含 baseURL）
- `**method:**` — HTTP 方法（GET/POST/PUT/DELETE）
- `**permission:**` — 权限码（如 `device:list`）
- `**request:**` — 请求体结构（用反引号包围 JSON / 表单）
- `**response:**` — 响应体结构（用反引号包围 JSON）

附加字段（可选）：`**业务:**` `**desc:**` `**params:**` `**return:**`

**禁止项**：
- ❌ 用不带 `**` 的 `- path: /...`（虽然能解析，但混用风格会乱）
- ❌ 用 `**path**`（缺冒号）或 `**Path:**`（大小写不一致）

## 6. 函数（Function）API

**必须**有一个函数章节。Magic 脚本支持函数定义。如果需求中没有明确的函数调用，仍需要列出可能需要的辅助函数（如汇总、统计、计算）。不允许省略此章节。

> ⚠️ **表格列固定**：`中文组名` `groupPath`（英文）`name`（中文）`path`（英文调用名）`参数` `返回` `说明`。
> - `中文组名` = magic-api 嵌套 group（顶级/子级），如 `组织服务` `配置中心` `设备服务`
> - `groupPath` = 中文组名对应的**英文 group path 段**（如 `组织服务` → `/org`，`配置中心` → `/config`，`设备服务` → `/device`）。**与 §1 路径树的顶级 group path 一致**（如 `/org` `/config` `/mqtt`）
> - `name` = .ms 的 `name` 字段（中文，与文件名一致）
> - `path` = .ms 的 `path` 字段（**英文 kebab-case 调用名**，如 `/getCurrentUserOffice`）
> - `参数` / `返回` 是 magic-script 签名
>
> 这是后续 `generateMagicScript(kind='function')` 唯一能解析的格式。`groupPath` 必须和 `name/path` 在 magic-api 里能拼成完整 URL（如 `groupPath='/org' + path='/getCurrentUserOffice'` = `/org/getCurrentUserOffice`）。

```markdown
## 10. 函数（Function）

| 中文组名 | groupPath | name | path | 参数 | 返回 | 说明 |
|----------|-----------|------|------|------|------|------|
| 组织服务 | /org | 获取当前用户组织机构 | /getCurrentUserOffice | 无 | Map | 获取当前登录用户的组织机构信息 |
| 配置中心 | /config | 根据key获取数据值 | /getBykey | configureKey | String | 从 sys_configure 表根据key获取配置值 |
| 设备服务 | /device | 判断设备心跳状态 | /checkHeartbeatStatus | lastOnlineTime, threshold | String | 根据最后在线时间判断设备在线/离线状态 |
```

## 7. 定时任务（Task）API

**必须**有一个定时任务章节。如果需求中没有明确的定时任务，至少列出心跳检查类任务。不允许省略此章节。

> ⚠️ **表格列固定**：`中文组名` `groupPath`（英文）`name`（中文）`path` `cron` `说明`。
> - `中文组名` = magic-api 嵌套 group（顶级/子级），如 `监控任务` `统计任务` `清理任务`
> - `groupPath` = 中文组名对应的**英文 group path 段**（如 `监控任务` → `/monitor`，`统计任务` → `/stats`，`清理任务` → `/clean`）。**与 §1 路径树顶级 group path 一致**
> - `name` = .ms 的 `name` 字段（中文）
> - `path` = .ms 的 `path` 字段（英文 kebab-case 标识，如 `/heartbeat`）
> - `cron` = 标准 cron 表达式
>
> 这是后续 `generateMagicScript(kind='task')` 唯一能解析的格式。

```markdown
## 11. 定时任务（Task）

| 中文组名 | groupPath | name | path | cron | 说明 |
|----------|-----------|------|------|------|------|
| 监控任务 | /monitor | 心跳检查 | /heartbeat | 0 */5 * * * ? | 每5分钟检查设备心跳状态，更新在线/离线标记 |
| 统计任务 | /stats | 每日统计 | /dailyStats | 0 0 1 * * ? | 每天凌晨1点汇总统计数据 |
| 清理任务 | /clean | 清理过期记录 | /clearExpiredRecords | 0 0 3 * * ? | 每天凌晨3点清理过期记录 |
```

## 8. MQTT 回调（设备→后台）

> ⚠️ **MQTT 回调必须**纳入 `设备管理` 的 §1 路径树下，作为 `MQTT回调` 子 group。**不能**单独成节、**不能**放在独立的 `/mqtt/` 目录。

**MQTT 回调本质是 `kind=api`**，不是单独一种 kind。在 §1 路径树里**作为子模块的 .ms 节点**，主题在 .ms 行的「说明」里列出。

**在 §1 路径树里写**（必须有"主题"列在说明里）：

```markdown
### 设备管理 (/device)
| 左侧：Magic-API 显示路径 | 右侧：各层级 name / path | 说明（主题） |
|---|---|---|
| `api/设备管理/` | `name: "设备管理", path: "/device"` | |
| `api/设备管理/MQTT回调/` | `name: "MQTT回调", path: "/mqtt"` | 设备→后台 MQTT 入口 |
| `api/设备管理/MQTT回调/心跳上报.ms` | `name: "心跳上报", path: "/heartbeat"` (POST 设备心跳上报) | 主题 `device/heartbeat` |
| `api/设备管理/MQTT回调/升级上报.ms` | `name: "升级上报", path: "/upgrade-result"` (POST 设备升级完成上报) | 主题 `device/upgrade/result` |
| `api/设备管理/MQTT回调/重启上报.ms` | `name: "重启上报", path: "/restart-result"` (POST 设备重启完成回复) | 主题 `device/restart/result` |
```

**规则**：
- 主题必须出现在 §1 路径树对应 .ms 行的「说明」列（用 `主题 xxx` 标识）
- **禁止**单独写 §12 章节（重复且 parser 不识别）
- magic-api 完整 URL = `groupPath + path`（如 `/device/mqtt/heartbeat` = `/device` + `/mqtt` + `/heartbeat`）

## 9. 代码块闭合规则（writeDoc 边界）

> ⚠️ **写 writeDoc append 时必须检查代码块边界**：

- 每个 writeDoc 的 `content` 末尾必须有**偶数个** ` ``` `
- JSON 示例（` ```json `）必须闭合才能结束当前 writeDoc
- 如果最后一个 JSON 块没写完，**先补 ` ``` ` 关掉**，下轮 writeDoc 再重新开 ` ```json ` 继续
- 工具会自动补 ` ``` ` 来防误判，但**最好自己先闭**——自动补的内容可能不完整

## 10. 禁止项

> 本节编号暂用 §10，最终按实际章节序号重新编号（因为 §4-§9 的序号由模块数决定）。

- ❌ 写「使用 MyBatis / JPA / Redis」 → 不在 api.md 范围
- ❌ 写「请求体用 multipart/form-data」 → 统一 JSON
- ❌ 写「响应里包含 access_token」 → 用 sa-token 自动注入
- ❌ 写「分页 size 必传 10」 → 用 gewumind-boot 默认 (size=10, current=1)
- ❌ 中文 API 路径（`/保存`、`/列表`、`/设备管理`） → 必须用英文 kebab-case（`/save`、`/list`、`/device`）
- ❌ 扁平 group 结构（所有子模块挂 parentId=0） → 必须嵌套，层级对应 URL 路径
- ❌ **同时生成中文和英文两套 magic-api 目录** → magic-api 目录名必须和 api.md §1 路径树左侧**完全一致**（中文目录名）。不允许额外生成英文 kebab-case 目录。每个模块只有一套目录，不重复
- ❌ **漏生成页面 SFC** → ui.md §2 写了多少个页面，就必须生成多少个 .vue 文件。一个不能少
- ❌ 缺函数章节 / 定时任务章节 / MQTT 回调章节
- ✅ 必写：path、method、权限码、请求结构、响应结构
- ✅ 请求结构用扁平字段，不用嵌套过深
- ✅ 业务逻辑（如：id 存在则更新）简述

## 12. 写前强制检查清单

- [ ] **§1 路径树存在且完整**（用左右对照表格：左列 Magic-API 中文路径，右列 name/path 配置）← **不可省略，必须从 §1 开始写**
- [ ] §1 路径树覆盖 ui.md 菜单树所有页面（每个页面至少一个 list.ms）
- [ ] §1 路径树文件名统一用中文动作命名（如 `列表.ms` `保存.ms` `详情.ms`）
- [ ] 有「函数」章节（即使空表也写）
- [ ] 有「定时任务」章节（即使空表也写）
- [ ] 如果有设备上报，加「MQTT 回调」章节
- [ ] 每个 API 有 path / method / 权限码 / 请求 / 响应
- [ ] API path 用英文 kebab-case（`/save` / `/list` / `/tree`），不用中文
- [ ] group 层级 = URL 路径层级（嵌套，非扁平 `parentId=0` 平铺）
- [ ] 每个列表 API 说明 `officeId` 参数（组织过滤）
- [ ] 函数章节包含「获取当前用户组织机构」function

## 11. 写入策略：**合并写**多个端点到一次 writeDoc

> ⚠️ **关键约束**：避免 LLM 单次输出超过 provider 配置的 max_tokens（被 `finish_reason=length` 截断）。但**不要每个 `### N.M` 就调一次 writeDoc**——每个 writeDoc 都有 reasoning_content + tool_call JSON 元数据开销，**浪费 token**。

**合并写多个端点**：

```
❌ 错误：每个 API 端点独立 writeDoc（60+ 次往返 + 60+ 次元数据浪费，$0.04+）
✅ 正确：合并多个 ### N.M 到一个 writeDoc（5-6 次往返就够，省 80% token）
```

**单次 writeDoc 调用规范**：
- `content` 字符数 = `max_tokens × 4 × 0.8`（留 20% 余量给 tool_call JSON）
- **8K tokens** 配置下单次 ≈ **~26000 字符**（≈ 8-12 个完整 API 端点）
- **16K tokens** 配置下单次 ≈ **~52000 字符**（≈ 20-30 个完整 API 端点）
- **在不确定 max_tokens 时，保守起见单次 < 20000 字符**（避免被截断）
- 一次写多个 `### N.M` 端点（按 §N. 模块边界合并）——不是每个端点写一次

**典型示例流程**（60+ 端点 + 10 函数 + 3 任务 + 3 MQTT ≈ 80K 字符，假设 16K tokens）：
1. **writeDoc overwrite 初始化**：写文档标题 + §1 路径树（6 模块合并 ~30K 字符）
2. **writeDoc append**：写 §2 权限码段 + §3 数据权限 + §4-§5 设备/配置 API（~30K 字符）
3. **writeDoc append**：写 §6-§9 内容/升级/设置 API（~20K 字符）
4. **writeDoc append**：写 §10 函数 + §11 任务 + MQTT 回调（§1 路径树已有）
5. `checkDocCompleteness` + `validateDocs` 检查
6. 如缺端点 → 继续 append 补全（不要 overwrite，会丢前文）

**为什么合并写**：
- 每个 writeDoc 调用都带 reasoning_content（思考） + tool_call JSON（结构）
- 60+ 次往返 = 60+ 倍元数据浪费
- 合并后 5-6 次 = 节省 90% 的非内容 token
- 写超 max_tokens 时工具会自动按 `## ` 切分拼接，所以**理论上一次写全部 API 也行**，但仍要避免超长

**为什么不能写超 max_tokens**：
- 单次 output > max_tokens 会被 `finish_reason=length` 截断
- 截断后 writeDoc 收到不完整内容 → 写入半截文档 → 后面的章节全丢
- 工具会自动按 `## ` 切，但会丢元数据，**你应主动控制在安全范围内**
