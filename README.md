# gewumind-skill

把 GewuMind IDE（Tauri 桌面端）里的 AI 开发能力，打包成**任何 agent 都能用**的 skill：四阶段管线（需求 → 设计文档 → 代码生成 → 一键发布）+ 完整知识库 + 后端 MCP 工具接入说明。

```
gewumind-skill/
├── SKILL.md                  # skill 入口（agent 加载这个）
├── references/
│   ├── pipeline.md           # 四阶段管线（IDE 工具 → agent 动作映射）
│   ├── conventions.md        # 硬约定速查：表/SFC/菜单/字典/API + 强制模板
│   ├── sfc-compile.md        # .vue → sys_dynamic_component SQL 编译规则
│   └── publish-protocol.md   # bundle apply 协议 + MCP 接入 + REST 运维端点
├── scripts/
│   └── sfc-compile.mjs       # SFC 编译脚本（node，依赖已在 magic-boot 根 node_modules）
└── knowledge/                # 知识库（83 篇，来自 IDE 的 skills 目录）
    ├── gewumind-boot/        # 平台约定（26 篇）：表规范/mb-* 组件/SFC/菜单/CRUD/发布…
    ├── api/ database/ function/ task/   # magic-api 语言与内置能力
    ├── workflow/ report/     # 工作流 / 报表
    └── server-plugin/ subscriber-plugin/ repair/
```

## 它替代了 IDE 的什么

| GewuMind IDE（Tauri） | 本 skill + MCP |
|---|---|
| 桌面应用 + 聊天 UI | 宿主 agent（Claude Code / Cursor / 任意 MCP 客户端）自带 |
| 多 provider key 管理 | 宿主 agent 自带模型 |
| CodeMirror 编辑器 + Git 面板 | agent 原生读写文件 + git |
| RAG 本地 embedding | agent 直接读 `docs/` + `src/`（项目规模 grep 足够） |
| `writeDoc`/`generateDdl`/`lintVue` 等 20+ 内置工具 | 直接写文件 + 按 `references/` 规则自检 |
| `validateDocs`/`autoFixDoc`（docs 校验门） | `scripts/docs-verify.mjs`（1107 行校验逻辑的 node 版，`--fix` 程序化自动修复） |
| 发布按钮 | MCP `bundle_apply`（后端自带 MCP Server） |
| SFC 编译（`@vue/compiler-sfc`） | `scripts/sfc-compile.mjs`（同一套编译逻辑的 node 版） |

## 安装

### Claude Code

方式一（个人级，所有项目可用）：

```bash
# 软链到 Claude skills 目录（或整体复制）
ln -s /data/projects/magic-boot/gewumind-skill ~/.claude/skills/gewumind-boot
```

方式二（项目级 `.claude/skills/`）：把本目录拷进项目的 `.claude/skills/gewumind-boot/`。

然后配置 MCP（后端运行中，默认 `http://localhost:9089`）：

```bash
claude mcp add --transport sse gewumind-boot http://localhost:9089/mcp
```

### Cursor / 其他 MCP 客户端

见 `references/publish-protocol.md` §MCP（stdio 客户端用 `npx mcp-remote` 桥接）。
把 `SKILL.md` 内容贴进项目 rules（`.cursor/rules/`）作为知识入口，agent 会按需读 `references/` 和 `knowledge/`。

### 任何 agent（无 MCP）

只用 REST：`POST {base}/api/ai/bundle/apply` + `X-AI-Key`。完整契约见 `references/publish-protocol.md`。

## 使用

对 agent 说（示例）：

> 用 gewumind-boot 做一个设备管理模块：设备登记、心跳监控、固件版本，发布到 localhost:9089

agent 应走四阶段：`docs/requirement.md` → `ui/database/api.md` → 生成 `src/sql/**` + `src/magic-api/**` + `src/pages/*.vue` → `bundle_apply` 发布。每阶段结束等确认。

## 依赖与运行要求

- 运行中的 GewuMind Boot 后端（`docker compose up -d`，端口 9089）
- Node 18+（跑 `scripts/sfc-compile.mjs`；依赖 `@vue/compiler-sfc` + `@babel/parser` 已在 magic-boot 根 `package.json`）
- `scripts/sfc-compile.mjs` 从 magic-boot 仓库根目录运行（模块解析依赖根 node_modules）

## 与 IDE 的关系

- 知识库与 IDE `src/llm/skills/` 同源（2026-08 快照）。**两边要同步维护**：改约定先改 skill（agent 侧用），再同步回 IDE 目录，或反过来
- IDE 冻结后，本 skill 就是 GewuMind 的"AI 开发面"；IDE 仅保留为非技术用户的可选 GUI
- `validateDocs`/`autoFixDoc` 已整体移植为 `scripts/docs-verify.mjs`（阶段 1/2 的退出门，用法见 `references/pipeline.md` §docs 校验门）。移植时顺手修了 IDE 的 3 处误报：api §1 路径树标准表头被误判、`database.md` 修订记录表被 5 列护栏误伤、`\Z` 无效转义导致节末区段提取失效（详见脚本头注释）——这三处 IDE 侧的 `docsValidator.ts` 尚未回修

## License

[MIT](LICENSE) © gewuMind contributors
