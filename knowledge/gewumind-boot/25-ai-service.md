# AI 客服（trusted-chat）

> 2.0 商业能力：**可信 AI 客服**——让模型「选接口 + 权限内调用 + 逐项校验」，而不是生成 SQL 查库。
> 模型不接触数据库；数据只来自登记的 API 工具；越权数据不进提示词、不进答案、不落明文审计。
> 给业务方接 AI 客服时，按本文配置即可，**不需要改内核**。

## 1. 执行原理（先懂这个再配置）

### 核心设计

- 模型**不生成 SQL**，只做两件事：从「该用户 AI 角色可用的工具」里**选接口**、**填参数**。
- 数据由**服务端**调用 magic-api 接口取得，模型只看到接口返回的数据。
- 四层越界防护（全部在服务端，模型绕不过）：

| 层 | 机制 |
|---|---|
| ① API 权限 | 工具可配 `requiredPermission`，用户没有该权限 → `NO_PERMISSION` |
| ② 行级范围 | 工具配 `scopeType`（self/org/all）；服务端按用户身份**注入身份参数**（如 `userId`），模型改不了 |
| ③ 字段脱敏 | 工具配 `sensitiveFields`（逗号分隔），这些字段在进提示词前脱敏 |
| ④ 答案后检 | 答案里的数字/实体/日期与工具**实际返回**逐项比对，对不上 = 编造 → 拒答 |

### 一次问答的完整流程

```
用户提问
  → 门禁：已登录 + ai.enabled=true + 有效 License（或试用期）   不过 → AI_DISABLED
  → 规划：模型从「用户 AI 角色勾选的工具」中选接口、填参数
  → 执行：服务端调用工具的 magic-api 接口（带超时）
  → 后检：答案 vs 工具返回逐项比对（数字/实体/日期）
  → 展示：通过后以 SSE 流式输出，附引用（工具 + 记录数）
  → 审计：sys_ai_tool_call 留痕（工具/入参/状态/耗时），拒答也审计
```

### 固定话术（拒答不由模型自由发挥）

| code | 话术 |
|---|---|
| `NO_DATA` | 没有查询到相关数据。 |
| `NOT_FOUND` | 未找到匹配的记录。 |
| `NO_PERMISSION` | 您没有权限查看该数据。 |
| `UNSUPPORTED` | 这个问题我暂时无法回答，换个问法试试？ |
| `TOOL_ERROR` | 查询出现问题，请稍后重试。 |
| `NEED_CLARIFY` | 请补充一点信息，我就能帮您查了。 |

## 2. 启用前提（三者同时满足，否则 AI_DISABLED）

1. **License**：AI 客服是商业能力，需离线 License（或试用期）；未授权一律关闭。
2. **配置中心 `ai.enabled=true`**（`/system/configure/save`，configureKey 为驼峰 `aiEnabled` 对应的 `ai.enabled`）。
3. **配置中心 `ai.config`**（JSON 字符串）：

```json
{"endpoint":"http://<llm-host>:<port>","api-key":"<key或not-needed>","model":"<model>","max-tokens":4096,"temperature":0.1}
```

- `endpoint` 填 OpenAI 兼容地址**根地址**（不要带 `/v1`，客户端自动拼）。
- 局域网模型无 Key 时 `api-key` 填 `not-needed`。
- `max-tokens` 不要低于 2048（给推理留空间）。

## 3. 配置步骤（开发者的全部工作）

### 第 1 步：把业务查询接口登记为工具

- 页面：**AI 客服 → 工具目录**（动态组件 `data/{zh,en}/magic-api/component/AI客服/工具目录.ms`）
- 或 API：`POST /system/ai-tools/save`

| 字段 | 说明 |
|---|---|
| `toolKey` | 工具唯一标识（如 `order_list`），模型据此选择 |
| `name` | 工具名称 |
| `method` / `path` | magic-api 接口方法与路径（如 `GET /business/order/list`） |
| `description` | **给模型看的接口说明**（用途/入参/返回含义）——模型靠它选工具，必须写清楚 |
| `paramsSchema` | 入参 JSON Schema（`{"type":"object","properties":{...}}`） |
| `responseSchema` | 返回结构说明（字段/含义） |
| `requiredPermission` | 调用所需权限码（可空） |
| `scopeType` | 数据范围：`self` 本人 / `org` 机构 / `all` 全部 |
| `sensitiveFields` | 需脱敏字段，逗号分隔（如 `phone,idCard`） |
| `readOnly` | 1 只读（默认）/ 0 可写（特殊场景） |
| `enabled` | 1 启用 / 0 停用 |

- 页面「**扫描接口**」可自动草拟只读接口候选（`POST /system/ai-tools/scan`），**人工确认后导入**。
- 页面「**试调用**」可验证工具（`POST /system/ai-tools/test-call`，body `{toolKey, params}`）。

### 第 2 步：建 AI 角色并分配用户

- 页面：**AI 客服 → AI 角色**（动态组件 `AI角色.ms`）
- 角色 = 名称 + 数据范围（self/org/all）+ 说明
- 「**接口**」按钮：勾选该角色可调用的工具（工具目录的子集）→ `POST /system/ai-roles/tools`
- 「**用户**」按钮：把用户分配到角色（**一个用户一个 AI 角色**）→ `POST /system/ai-roles/assign-user`（`roleId` 传空 = 取消）

### 第 3 步：开启

- 配置中心 `ai.enabled=true` + `ai.config`（见 §2）
- 导入 License（配置中心 → 上传授权文件）

## 4. 页面与路由

| 页面 | 路由 | 类型 |
|---|---|---|
| AI 对话（trusted-chat） | `/ai/trusted-chat` | **静态路由**（前端内置，`src/views/ai/trusted-chat.vue`） |
| 工具目录 | `/ai/tool-list` | 动态组件（`.ms`） |
| AI 角色 | `/ai/role-list` | 动态组件（`.ms`） |
| AI 审计 | `/ai/audit` | 动态组件（`.ms`） |

- 菜单「AI 客服」目录 + 按钮权限（`ai-tool:save/delete/scan`、`ai-role:save/delete`、`ai-audit:view`）由 `db/init/02-ai-2.0.sql` 注册，admin 默认全授权。
- 前端按 `GET /api/ai/system-config` 的开关状态决定 AI 对话页的可用态。

## 5. 关键 API

| API | 说明 |
|---|---|
| `POST /api/ai/chat/stream` | 问答（SSE，`text/event-stream`） |
| `GET /api/ai/system-config` | AI 开关/配置状态（前端判断展示） |
| `/system/ai-tools/{list,save,status,delete,test-call,scan}` | 工具目录管理 |
| `/system/ai-roles/{list,get,save,delete,tools,assign-user,user-assignments}` | AI 角色管理 |
| AI 审计页 | 调用留痕 / 拒答审计（`sys_ai_tool_call`） |

**SSE 事件协议**（`/api/ai/chat/stream`）：

| 事件 | 含义 |
|---|---|
| `status` | 阶段提示（`planning`） |
| `citations` | 本次答案引用的工具/记录（数据类问题才有） |
| `message` | 答案正文（已通过答案后检，绝不编造） |
| `done` | 收尾：`status` / `grounded` / `refusal_code` / `session_id` |
| `error` | 门禁未过 / 参数缺失 / 运行异常（`code`：`AI_DISABLED` / `NEED_CLARIFY` / `TOOL_ERROR`…） |

## 6. 数据表（DDL 见 `db/init/02-ai-2.0.sql`，幂等可重跑）

| 表 | 用途 |
|---|---|
| `sys_ai_tool` | 工具目录 |
| `sys_ai_role` / `sys_ai_role_tool` / `sys_user_ai_role` | AI 角色 / 角色-工具 / 用户-角色 |
| `sys_ai_tool_call` | 调用审计（工具/入参/状态/耗时） |
| `sys_ai_feedback` | 用户反馈 |

## 7. 给业务方接 AI 客服的要点

1. 业务方只需提供**只读查询接口**（magic-api），登记进工具目录即可，不改内核。
2. `description` 是模型选工具的唯一依据——写清楚「查什么、入参什么、返回什么含义」。
3. 接口支持按 `userId` 过滤时配 `scopeType=self`，服务端自动注入身份参数，用户只能查自己的数据。
4. 手机号/身份证等敏感字段进 `sensitiveFields`。
5. **不要**把写接口（增删改）登记为工具（`readOnly=0` 仅限特殊受控场景）。
6. 参考实现：订单/客户业务演示接口在 `data/{zh,en}/magic-api/component/ai-service/`（订单列表/客户详情等），工具与角色配置见 `db/init/02-ai-2.0.sql`。
7. 验收：应用仓库 `tests/ai/`（黄金集 + 越权矩阵 + 免费基线），`bash tests/ai/ci.sh` 一键跑。
