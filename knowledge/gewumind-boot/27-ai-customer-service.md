# AI 客服（2.3 核心能力）

> 2.3 的重点能力。标准版不含 AI；旗舰版包含 `ai_chat`、`ai_kb`、`ai_h5`。

## 1. 能力范围

| 能力 | License feature | 页面 / 入口 |
|---|---|---|
| 内部可信 AI 客服 | `ai_chat` | `/#/ai/trusted-chat` |
| 知识库问答 | `ai_kb` | `/#/ai/kb-list`、AI 角色授权 |
| 对外 H5 客服 | `ai_h5` | `/#/ai/channel-list`、`/#/h5/chat?channel=...` |

AI 客服不是“让模型直接写 SQL”，而是：

1. 用户在 AI 角色允许的**只读工具目录**内提问；
2. 模型选择工具并传参；
3. 后端按该用户的数据范围（self / org / all）执行；
4. 答案必须来自工具结果，带引用/拒答码，不能编造。

## 2. 配置中心

顺序：`启用 AI` → `AI 配置(JSON)` → `AI 会话压缩配置` → `AI 角色/工具` → `知识库` → `H5 客服`。

关键配置：

- `ai.enabled=true`：总开关。关闭时 H5、知识库同时关闭。
- `ai.config`：OpenAI 兼容模型地址、模型名、API Key、max-tokens、temperature。
- `ai.context.config`：会话压缩（窗口、阈值、保留消息数、摘要 Token）。
- `ai.tts.config` / `ai.asr.config`：可选语音；OpenAI 兼容端点，也支持 MiniMax。
- `ai.kb.enabled=true`：知识库。
- `ai.h5.enabled=true`：对外 H5 客服。

## 3. AI 角色与工具

1. 「AI 客服 → 工具目录」登记只读业务接口（GET/POST 查询），填路径、说明、参数 Schema。
2. 「AI 客服 → AI 角色」选择可用工具 + 数据范围。
3. 「用户管理」给用户分配 AI 角色。
4. 没有 AI 角色的用户不能使用 AI 客服。

原则：

- 只登记只读接口；写接口不要给 AI。
- 数据范围必须由后端权限/角色控制，不能只靠提示词。
- 工具返回字段尽量稳定，避免模型猜列名。

## 4. 知识库

- 支持 Markdown / 纯文本 / URL / 在线编辑。
- 文档发布后切块、检索；回答带文档标题与段落引用。
- 授权到 AI 角色 / 组织；未授权文档不会出现在结果里。
- 知识库不可用时，数据问答仍可用；知识问答返回“未启用”。

## 5. H5 对外客服

流程：

1. 配置中心启用 `ai.h5.enabled`。
2. 「AI 客服 → 渠道配置」创建渠道，配置品牌名、头像、欢迎语、主题色、允许嵌入域名、限流。
3. 用 `/api/system/ai-h5/embed` 或渠道页生成带 `user + exp + sig` 的签名链接。
4. 客户站点用 `/h5-widget.js` 嵌入，或直接打开 `/#/h5/chat?channel=...&user=...&exp=...&sig=...`。

注意：

- H5 不做匿名用户；必须带签名用户。
- H5 仅能查本人范围内的数据。
- 历史会话按“签名用户 + 渠道”绑定；支持历史会话切换和 `/session` 命令。
- 涉及会话/菜单文案时携带 `X-Lang`，后端按应用语言返回中英文。

## 6. 语音（可选）

- TTS/ASR 使用 OpenAI 兼容接口；可接 MiniMax：
  - TTS：`https://api.minimax.cn`，模型 `speech-2.8-hd`
  - ASR：`https://api.minimax.cn`，模型 `asr-1.0`
- 浏览器录音为 webm 时，服务端会转 wav 再送 ASR。
- 未配置时前端回退浏览器能力或禁用按钮。

## 7. 常见问题

| 现象 | 排查 |
|---|---|
| AI 页面 403 / 功能未启用 | License 是否包含 `ai_chat`；`ai.enabled` 是否为 true |
| H5 打开提示未开启 | `ai.h5.enabled`、License `AI_H5`、渠道是否启用 |
| H5 提示接入链接无效 | `user/exp/sig` 是否完整、是否过期、公钥是否匹配 |
| AI 回答“无权限” | 检查 AI 角色工具范围 + 数据范围 |
| 知识库不生效 | `ai.kb.enabled` + 文档已发布 + AI 角色已授权 |
| 模型调用失败 | 配置中心 `ai.config` 端点、模型名、Key、网络 |
| 历史会话看不到 | 是否同一签名用户 + 同一渠道；是否已删除 |

## 8. 2.3 License

- 标准版：不含 AI。
- 旗舰版：包含全部 AI 能力。
- 验签使用 `kid` keyring；标准版 `pro-2026`，旗舰版 `ent-2026`。
