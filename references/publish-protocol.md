# 发布协议：bundle apply + MCP + REST

所有对后端的变更通过 **bundle apply** 一次提交：SQL 列表 + magic-script 列表，顺序执行，失败可定位。

## 路径说明（重要）

- 现有客户端（GewuMind IDE、发布脚本）统一用 **`/api/ai/**`** 前缀
- 当前源码里 Java 控制器映射是 **`/ai/**`**（`AiApiController @RequestMapping("/ai")`）
- 不同构建版本前缀可能不一致。**接入前先探测**：依次 `GET {base}/ai/health`、`GET {base}/api/ai/health`，哪个通用哪个。MCP 端点是 `{base}/mcp`（无 /api 前缀问题）

## 认证

- REST：`X-AI-Key: <keyId>:<secret>` 请求头（keyId:secret 都取自后端配置的 AI Key；演示环境常见 `poctrusted:poctrusted`）
- MCP：**版本不一致**——老版本 `/mcp` 无鉴权；新构建（1.0.0 实测）会返回 **401**，需要同样带 `X-AI-Key` 头（或改用 REST）。接入前先 `curl -i {base}/mcp` 探测：401 就补 Key；无鉴权时也要注意 `sql_execute`（裸 SQL）的风险，公网部署前必须给 `/mcp/**` 加鉴权

## MCP Server（推荐接入方式）

后端自带 MCP Server（`McpServerController`），经典 **SSE transport**：

```
GET  {base}/mcp                  → SSE 流，首事件 name=endpoint，data=/mcp/message/{sessionId}
POST {base}/mcp/message/{sessionId}  → JSON-RPC 2.0（initialize / tools/list / tools/call）
```

### 配置方法

**Claude Code（CLI）：**

```bash
claude mcp add --transport sse gewumind-boot http://localhost:9089/mcp
# 验证
claude mcp list
```

**Claude Code（项目 .mcp.json）：**

```json
{
  "mcpServers": {
    "gewumind-boot": { "type": "sse", "url": "http://localhost:9089/mcp" }
  }
}
```

**只支持 stdio 的客户端（Cursor 等）：** 用 `mcp-remote` 桥接：

```json
{ "mcpServers": { "gewumind-boot": { "command": "npx", "args": ["-y", "mcp-remote", "http://localhost:9089/mcp"] } } }
```

### MCP 工具（6 个，`tools/list` 可查）

| 工具 | 参数 | 用途 |
|---|---|---|
| `status_check` | 无 | 健康检查：`{status, version, name}` |
| `bundle_apply` | `sql: [{name, content}]`（必填）, `ms: [{group, groupPath, name, method, path, script, permission, kind, cron, description, metaJson}]`（必填） | **发布入口**。一次执行全部 SQL + 写全部 magic-script + 刷新运行时 |
| `sql_execute` | `sql: string`（分号分隔多条） | 裸 SQL。**只用于只读诊断**（SHOW TABLES / SELECT / SHOW COLUMNS）；变更一律走 bundle_apply |
| `file_receive` | `path, content` | 把生成文件存到后端 `ai-projects/{path}`（调试用，不参与发布） |
| `data_query` | `question` | 自然语言查业务数据（后端 DataChat） |
| `docs_push` | `docs: [{name, content}]` | 推项目文档进后端 RAG 上下文（改善 data_query 质量） |

> `bundle_apply` 的 JSON schema 只声明了部分字段，但实现读取全部 MsScript 字段（kind/cron/groupPath/metaJson 均可传）。

## REST 发布（MCP 不可用时的等价路径）

```
POST {base}/api/ai/bundle/apply        # 前缀按"路径说明"探测
X-AI-Key: <keyId>:<secret>
Content-Type: application/json
```

### 请求体（BundleRequest）

```json
{
  "sql":   [ { "name": "ddl/t_device.sql", "content": "CREATE TABLE ..." } ],
  "ms":    [ { "group": "设备管理", "groupPath": "device", "name": "列表",
               "method": "POST", "path": "/list", "script": "return db.page(...)",
               "permission": "device:list", "kind": "api", "cron": null,
               "description": "", "metaJson": null } ],
  "migrate": [ { "name": "...", "content": "ALTER TABLE ..." } ],
  "selectedFiles": null,
  "ignored": null
}
```

- `sql[].name`：文件标识（发布日志用）；`content` 可含多条分号分隔语句
- `ms[]` 字段语义（与后端 `writeMagicScript` 对齐）：
  - `group`：中文目录链，`/` 分隔（`"设备管理/设备登记"` = 两层嵌套）；后端自动逐级建目录 + group.json
  - `kind`：`api`（默认）/ `function` / `task`
  - `name`：中文脚本名（如 `列表`）→ 落盘 `{groupDir}/{name}.ms`
  - `method`：默认 POST；`path`：默认 `/{name}`，建议显式传英文 kebab（`/list`）
  - `permission`：权限码；`cron`：task 必填；`metaJson`：可选，完整 meta JSON 字符串（保留 parameters/returnType/options 等高级字段，后端会覆盖 id/groupId/name/path）
  - `groupPath`：仅顶级单段时生效（英文 URL 段，如 `device`）；嵌套层由后端查表推断，一般不用管
- `migrate[]`：已有表的结构变更（ALTER/DROP），与 sql 分开走
- `selectedFiles`：非 null 时只发布列表内的 SQL（name 或 basename 匹配）——部分发布

### 响应

```json
{ "success": true, "appliedSql": ["ddl/t_device.sql (3 stmts)"], "appliedMs": [".../设备管理/列表.ms"], "errors": [] }
```

`errors` 非空：`[{"type":"sql"|"ms","name":"...","message":"..."}]`——**SQL 是顺序执行的，前一条失败就停下**，所以 errors 里的条目就是该修的文件。

### 后端执行细节（影响产物写法）

1. **发布前自动备份**（mysqldump + MS 快照），失败不阻塞
2. `CREATE TABLE` 的表**已存在**时 → 自动转 ALTER 补列（缺列才加，不报错）
3. **UPSERT 表**（`sys_dynamic_component` / `sys_menu` / `sys_dict_items`）：INSERT 记录已存在 → 转 UPDATE——这就是 SFC/菜单/字典可重复发布的基础
4. 其余 INSERT 已存在 → 跳过（幂等）
5. .ms 落盘格式 = meta JSON + 换行 + 32 个 `=` 分隔线 + 脚本体；HTML 实体会自动反转义（`&lt;` → `<`）

### SQL 文件收集顺序（参考 发布脚本）

`src/sql/` 下按目录依次收集，**顺序即执行顺序**：

```
ddl → menu → sfc → insert → dict
```

（先建表 → 再菜单/SFC → 再插预置数据/字典。）

### 运维端点（REST，均需 X-AI-Key）

| 端点 | 用途 |
|---|---|
| `GET /api/ai/tables` | 数据表元数据（发布前了解现有 schema） |
| `GET /api/ai/scripts` | 已部署 magic-script 清单 |
| `GET /api/ai/dicts` / `POST /api/ai/dicts/items` | 字典查询 / 补单条字典项 |
| `GET /api/ai/icons` | 可用图标 |
| `GET /api/ai/sfc-source` | 读已部署动态组件源码（修复时先看现状） |
| `GET /api/ai/snapshot` | 发布前快照 |
| `POST /api/ai/rollback` | 回退到备份（body `{version}`） |
| `POST /api/ai/backup/list` | 备份列表 |
| `POST /api/ai/magic-api/repair` | 修复 magic-api 运行时与磁盘不一致 |
| `GET/POST /api/ai/system-config` | 系统配置（logo/名称/登录背景） |
| `POST /api/ai/diff` | 变更 diff |
| `POST /api/ai/reset` | 重置（慎用） |

> 路径前缀同样受"路径说明"影响：`/api/ai` 不通时换 `/ai`。

## 发布后验证与回滚

发布成功（`errors` 为空）后，先做只读验证，再向用户报告：

```bash
node scripts/verify-publish.mjs --base http://localhost:9089 \
  --component 设备列表 --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

- 组件按 `/system/component/runtime/list` 的 `name` 或 `path` 匹配
- 接口默认 `POST`，body `{"page":1,"size":1}`，用 `--api-body` / `--api-method` 覆盖
- 菜单需要登录态：`--username/--password`（脚本自己 `sha256` 后登录）或 `--token <uuid>`
- 退出码：0 全通过，1 有失败，2 参数错误

验证失败时，回滚到发布前自动创建的备份版本（`bundle_apply` 响应的 `backupVersion`）：

```bash
scripts/rollback.sh --base http://localhost:9089 --version <backupVersion> \
  --ai-key "$GW_AI_KEY" \
  --component 设备列表 --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

`rollback.sh` = `POST /api/ai/rollback`（头 `X-AI-Key: <keyId>:<secret>`，body `{"version":"..."}`）+ 自动复验。

## 实测坑（2026-10 · gewumind-boot 1.0.0，务必对照）

以下问题在真实克隆 + `demo` 库上实测出现，写产物/发布前先规避：

### 1. `.ms` 落盘路径多出 `file:`（后端 bug）
`bundle_apply` 返回的 `appliedMs` 可能是：

```
<project>/file:./data/magic-api/api/设备管理/列表.ms
```

即多出一层字面量 `file:` 目录。**发布后必须检查**：若存在 `<project>/file:./data/...`，把整个分组目录移到 `<project>/data/magic-api/api/`，再重启（或调 `POST /api/ai/magic-api/repair`）。否则接口一直 404。

### 2. `.ms` 分隔符必须 CRLF 包围（后端自己会写错）
标准格式：

```
<meta JSON>\r\n================================\r\n<script>
```

1.0.0 的 `bundle_apply` 实测写出的是 `\n================================\r\n`（分隔符前只有 LF）。重新加载时 `indexOf(SEPARATOR)` 失败，整个文件被当源码，表现为脚本为 `null`、接口报 `literal cannot be used alone`。
**发布后用二进制校验 `}\r\n====\r\n`；不对就重写该文件。**

### 3. magic-script 不支持 `??`
`var x = body.x ?? 1`、`body.where ?? {}` 都会解析报错（`Expected a variable, field, map...`）。一律改成显式判空：

```js
var x = body.x;
if (x == null) { x = 1; }
```

（示例库里可能还留着 `??` 写法，不要照抄。）

### 4. 新接口默认 403
脚本带 `options: [{name:"permission", value:"device:list"}]` 时，admin 未分配该权限 → `{"code":403,"message":"禁止访问"}`。
演示/联调可先**去掉 permission**（`options: []`）；正式项目应把权限码写进菜单/角色并分配。

### 5. 应用 API 前缀、登录头、编辑器地址
- 业务接口实际走 **`/api/...`**（`magic-api.prefix: "/"` + 前端 baseURL `/api`），不是 `/device/list`。
- 前端登录后的请求头是 **`token: <uuid>`**，不是 `magic-token`、也不是 `Authorization`。
- 在线编程编辑器地址是 **`/#/lowcode/magic-editor`**；本构建 `/magic/web` 是 404。

### 6. `sys_menu` 实际 schema 可能没有 `component_id`
1.0.0 的库中 `sys_menu` 只有 16 列，**没有 `component_id`**（与 `05-menu-register.md` 的字段表不一致）。写菜单 SQL 前先 `SHOW COLUMNS FROM sys_menu`，以实际列为准；`component` / `remarks` 同样不存在。

## 发布工作流（agent 版）

1. （稳妥做法）`GET /ai/snapshot` 记一下当前状态
2. 组装 bundle：SQL 按 `ddl → menu → sfc → insert → dict` 顺序；ms 按 api/function/task 分组
3. `bundle_apply`（MCP）或 `POST /api/ai/bundle/apply`（REST）
4. `errors` 为空 → 报告 `appliedSql`/`appliedMs` 清单
5. `errors` 非空 → 定位对应文件 → 修正 → **只重发失败部分或整体重发**（幂等设计允许整体重发）
6. 需要回退 → `scripts/rollback.sh --version <backupVersion> --ai-key ...`（或 `POST /ai/rollback`）
