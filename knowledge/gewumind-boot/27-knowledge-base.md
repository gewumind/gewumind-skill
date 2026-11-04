# 知识库（AI 客服知识源，2.1 新增）

> 2.1 商业能力：**AI 知识库**——把使用手册/部署指南/业务规则/FAQ 变成可检索、可引用的知识。
> AI 客服回答「怎么用/怎么配/为什么/业务规则」类问题时检索知识库并给出文档引用；
> gewumind-skill 开发流程也可通过 `POST /api/ai/kb/search` 共用同一知识源。
> 给业务方接知识库时，按本文配置即可，**不需要改内核**。

## 1. 执行原理

### 检索链路（ACL 前置，越权文档 0 泄漏）

```
检索请求（用户/skill）
  → 门禁：已登录 + ai.kb.enabled=true + License 含 AI_KB 能力   不过 → {enabled:false, message:"知识库未启用"}
  → ACL 前置：按「AI 角色 / 组织 × 知识库 / 文档」过滤可见文档（空表=仅管理员）
  → 全文检索：MySQL 全文索引（ngram，支持中文），标题/面包屑加权，topK 默认 5
  → 引用：每条命中带 doc_title / heading_path / version / seq
  → 审计：sys_ai_kb_query_log 留痕（用户/渠道/检索词/命中数/引用/耗时）
```

### 与 AI 客服的衔接

- 编排器识别 `knowledge` 意图 → 走知识库检索（ACL 同口径）→ 模型**只依据命中文档片段**作答。
- 片段里没有答案 → 固定话术「未找到匹配的记录。」（NOT_FOUND），不硬答。
- 答案带引用（文档 + 标题路径 + 版本），可追溯。
- 未授权 AI_KB 时知识问答返回「知识库未启用」，**数据问答（AI_CHAT_INTERNAL）不受影响**。

### 文档生命周期

```
导入（Markdown/纯文本/URL/在线编辑）→ 草稿（自动清洗密钥/凭据）
  → 发布（version+1，重建切块：按标题分节 + 300–800 字窗口，重叠 50 字）
  → 检索只用「已发布 + 最新版本」的切块
  → 删除（软删，切块清除，审计保留）
```

## 2. 启用前提（三者同时满足，否则「知识库未启用」）

1. **License**：需含 `ai_kb` 能力位（`features:["*"]` 的授权自动覆盖）。
2. **配置中心 `ai.kb.enabled=true`**。
3. **AI 客服已启用**（`ai.enabled=true` + `ai.config` 模型配置）——知识库是 AI 客服的知识源。

## 3. 配置步骤（管理端）

1. 菜单「AI 客服 → 知识库」：新建知识库（名称/范围/描述）。
2. 导入文档：
   - **在线编辑**：直接写 Markdown/纯文本（含密钥的内容会自动脱敏为 `[已脱敏]`）；
   - **导入 URL**：抓 HTML 转文本（适合在线文档/帮助中心）；
   - 保存后是**草稿**，点「发布」才进检索（发布 = version+1 + 重建切块）。
3. **访问控制**（默认空表=仅管理员可见）：
   - 给「AI 角色」授权整个知识库或单篇文档 → 该角色下的用户即可检索；
   - 或给「组织」授权 → 该组织用户可检索。
4. 用「检索测试」验证：输入检索词，看命中与引用是否符合预期。
5. 首批内容建议：使用手册、部署指南、FAQ（从 `docs/zh` 的 Markdown 导入）。

## 4. API（skill / 外部调用）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/ai/kb/search` | body `{query, top_k?}` → `{enabled, total, hits:[{doc_id,doc_title,kb_name,version,seq,heading_path,content,score}]}` |
| GET | `/api/ai/kb/doc/{id}` | 读文档全文（走当前用户 ACL；无权 → `{found:false, message:"无权查看该文档"}`） |

- **未授权/未开启**：返回 `{enabled:false, message:"知识库未启用"}`（HTTP 200，不 500）——调用方按「无知识源」处理即可。
- 管理端（仅管理员 + AI_KB 授权）：`/system/ai-kb/*`（list/save/delete、docs/doc/save/doc/import-url/doc/publish/doc/delete、acl/acl-save/acl-delete、search-test）。

## 5. 开发流程中的用法（gewumind-skill）

- **理解需求前**：`POST /api/ai/kb/search` 检索业务规则/产品约定/既有 FAQ，避免与既有约定冲突。
- **写测试/验收前**：检索该模块的已知问题与验收口径。
- **回答用户「怎么用/为什么」类问题时**：先检索知识库，答案引用文档（`doc_title › heading_path`），不要凭记忆编造。
- 检索无命中 → 如实说「知识库中没有找到」，不要硬答。

## 6. 数据表

| 表 | 用途 |
|---|---|
| `sys_ai_kb` | 知识库（名称/范围/状态） |
| `sys_ai_kb_doc` | 文档（来源/草稿-发布/版本/内容哈希） |
| `sys_ai_kb_chunk` | 切块（版本/序号/标题面包屑/全文 ngram 索引） |
| `sys_ai_kb_acl` | 访问控制（知识库/文档 × AI 角色/组织；空表=仅管理员） |
| `sys_ai_kb_query_log` | 检索审计（用户/渠道/检索词/命中/引用/耗时） |

## 7. 边界（2.1 不做）

- 向量检索：`ai.config` 预留 `embedding` 扩展点，配了 embedding 端点才启用（2.1 纯关键词）。
- PDF/DOCX 解析：留 2.2（v1 支持 Markdown/纯文本/URL/在线编辑）。
- 服务端 ASR/TTS 语音：留 2.2（2.1 语音仅浏览器 Web Speech API，不支持自动降级文字）。
