# gewumind-skill

> 把 GewuMind Boot 的后端能力，变成任何 AI Agent 都能用的开发技能。
> An agent-agnostic skill that turns requirements into a running low-code backend.
>
> **版本 1.1.0** · 与 [gewumind-boot](https://github.com/gewumind/gewumind-boot) 同版本发布。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agents](https://img.shields.io/badge/agents-Claude%20Code%20%7C%20Cursor%20%7C%20opencode-111)](#安装)

`gewumind-skill` 不是一个模型，也不是一个 IDE。它是一套**给 Agent 用的工程规范 + 知识库 + 发布协议**。

装上它，你的 Claude Code / Cursor / opencode 就能按四阶段——**需求 → 设计 → 生成 → 发布**——把一个业务需求变成可运行的低代码后端应用。

它解决的不是"AI 会不会写代码"，而是"AI 写出来的东西**能不能跑、敢不敢上线**"。

> Codex 能写代码，但写完还要人来接。这个 skill 把目录约定、文档门禁、发布备份、回滚和验证固化给 Agent，让交付可重复。

---

## 它能做什么

- **四阶段交付**：需求文档 → UI / 数据库 / API 设计 → 代码生成 → 一键发布
- **不是黑盒**：生成的 SQL、magic-script、`.ms` 组件页面都落在你的项目里，可读、可改、可审阅
- **有门禁**：文档校验、固定目录与表规范、权限码约定、发布前备份、失败可回滚
- **有知识库**：平台约定 + magic-api 语言文档，Agent 按需查阅，不靠模型瞎猜
- **任意 Agent**：Claude Code、Cursor、opencode，或任何支持 MCP / REST 的客户端

## 前置条件

| 依赖 | 要求 |
|---|---|
| GewuMind Boot 后端 | 运行中，默认 `http://localhost:9089` |
| Node.js | 18+（用于 `sfc-compile` / `docs-verify` / `verify-publish` 脚本） |
| AI Key | 后端启动日志会打印，或在后台「AI Key」页面创建 |
| Agent | Claude Code / Cursor / opencode / 任意 MCP 客户端 |

## 快速开始

### 1. 启动后端

```bash
git clone https://github.com/gewumind/gewumind-boot.git
cd gewumind-boot

# 建库并导入基线（MySQL 8）
mysql -uroot -p -e "CREATE DATABASE \`gewumind-boot\` DEFAULT CHARACTER SET utf8mb4"
mysql -uroot -p gewumind-boot < db/init/01-baseline.sql

export SPRING_DATASOURCE_PASSWORD='你的数据库密码'
bash scripts/start.sh
```

也可以直接下载 [Release 发行包](https://github.com/gewumind/gewumind-boot/releases)，解压后 `bash start.sh`（Windows 用 `start.bat`）。

> Gitee 用户可改用 `git clone https://gitee.com/gewumind/gewumind-boot.git`（内容与 GitHub 同步）。

启动日志里会打印 `X-AI-Key`，后面接 MCP / REST 要用。

### 2. 安装 skill

```bash
git clone https://github.com/gewumind/gewumind-skill.git
cd gewumind-skill
```

> Gitee：`git clone https://gitee.com/gewumind/gewumind-skill.git`（与 GitHub 同步）。

**Claude Code**（个人级，所有项目可用）：

```bash
ln -s "$PWD" ~/.claude/skills/gewumind-boot
```

**opencode**：

```bash
ln -s "$PWD" ~/.agents/skills/gewumind-boot
```

**Cursor / 其他 Agent**：把 `SKILL.md` 贴进项目 rules（如 `.cursor/rules/`），Agent 会按需读取 `references/` 和 `knowledge/`。

### 3. 接入 MCP

后端自带 MCP Server：`http://localhost:9089/mcp`。部分构建需要带 `X-AI-Key`（401 时补上）。

**Claude Code**：

```bash
claude mcp add --transport sse gewumind-boot http://localhost:9089/mcp
```

**opencode**（`~/.config/opencode/opencode.jsonc`）：

```jsonc
{
  "mcp": {
    "gewumind-boot": {
      "type": "remote",
      "url": "http://localhost:9089/mcp",
      "headers": { "X-AI-Key": "<keyId>:<secret>" }
    }
  }
}
```

**Cursor / 只支持 stdio 的客户端**：

```json
{
  "mcpServers": {
    "gewumind-boot": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:9089/mcp", "--header", "X-AI-Key:<keyId>:<secret>"]
    }
  }
}
```

> 不接 MCP 也能用：直接调用 REST `POST /api/ai/bundle/apply`，请求头带 `X-AI-Key`。

### 4. 对 Agent 说

```text
用 gewumind-boot 做一个设备管理模块：
设备登记、心跳监控、固件版本，发布到 localhost:9089。
```

Agent 会按四阶段执行，并在每阶段结束等你确认。

## 四阶段管线

| 阶段 | 产物 | 门禁 |
|---|---|---|
| 1. 需求 | `docs/requirement.md` | 组织 / 角色 / 范围确认 |
| 2. 设计 | `docs/ui.md`、`database.md`、`api.md` | `node scripts/docs-verify.mjs <project>` 通过 |
| 3. 生成 | `src/sql/**`、`src/magic-api/**`、`src/magic-api/component/**/*.ms` | 表 / 字段 / 权限码 / 确定性 ID 约定 |
| 4. 发布 | 通过 `bundle_apply` 写入后端 | sql-check 通过 + 发布后 verify-publish + 可回滚 |

发布后跑 `node scripts/verify-publish.mjs` 检查组件 / 接口 / 菜单；失败用 `scripts/rollback.sh` 回退到 `backupVersion`。

> **发布说明**：SQL / 菜单 / 字典走 `bundle_apply`；页面是 `.ms` 组件，内核 0.3.1+ 直接用 `bundle_apply`（`kind: component`）发布，旧版内核才需要复制到后端 `data/magic-api/component/` 并重启。详见 `references/component-page.md`。

## MCP 工具

| 工具 | 作用 |
|---|---|
| `status_check` | 健康检查：版本、名称、状态 |
| `bundle_apply` | **发布入口**：SQL + magic-script 一次提交 |
| `sql_execute` | 只读诊断（`SHOW` / `SELECT`），不要用于变更 |
| `data_query` | 自然语言查询业务数据 |
| `file_receive` | 把生成文件暂存到后端（调试用） |
| `docs_push` | 推送项目文档到后端 RAG 上下文 |

## 项目结构

```text
gewumind-skill/
├── SKILL.md                  # Agent 入口（英文）
├── SKILL.zh.md               # 中文参考
├── README.en.md              # English README
├── references/
│   ├── pipeline.md           # 四阶段管线与退出条件
│   ├── conventions.md        # 表 / SFC / 菜单 / 字典 / API 硬约定
│   ├── component-page.md     # .ms 组件页面规范（1.0.0 页面机制）
│   ├── sfc-compile.md        # .vue → 动态组件 SQL 编译规则（旧版）
│   ├── publish-protocol.md   # bundle_apply / MCP / REST 协议
│   └── en/                   # 英文核心文档（pipeline/conventions/component-page/publish-protocol）
├── scripts/
│   ├── docs-verify.mjs       # 文档校验门（--fix 自动修复）
│   ├── sql-check.mjs         # SQL 参数化检查（防注入）
│   ├── verify-publish.mjs    # 发布后验证：组件 / 接口 / 菜单
│   ├── rollback.sh           # 回滚到备份版本 + 复验
│   ├── ms-component.mjs      # .vue → .ms 组件页面
│   └── sfc-compile.mjs       # SFC 编译（旧版 SQL 路线）
└── knowledge/                # 知识库（按平台 / 语言 / 能力分类）
```

`scripts/` 里的 Node 脚本需要：

```bash
npm i @vue/compiler-sfc @babel/parser
```

## 知识库

`knowledge/` 按主题组织，Agent 会按需读取，不需要你一次性喂给模型：

- `gewumind-boot/`：平台约定——表规范、`mb-*` 组件、组件页面、菜单、CRUD、发布、报表、字典、图标、系统配置、**首页 dashboard**
- `api/`、`database/`、`function/`、`task/`：magic-api 语法与内置能力
- `workflow/`、`report/`：工作流与报表
- `server-plugin/`、`subscriber-plugin/`：服务端 / 订阅插件
- `repair/`：已有功能的修改流程

## 常见问题

**MCP 返回 401**
补上 `X-AI-Key` 头；key 在后端启动日志或后台「AI Key」页面。

**接口 403（禁止访问）**
脚本里的 `permission` 权限码还没有分配给当前角色。联调时可先去掉接口级 `permission`，正式环境再写进菜单 / 角色。

**发布后页面 404 / 空白**
确认 `.ms` 组件已复制到后端 `data/magic-api/component/` 并重启；菜单 `url` 必须等于 `group path + 组件 path`；`.ms` 分隔符必须是 `\r\n` + 32 个 `=` + `\r\n`，且 `compileJs` 不为空。

**改了代码没生效**
在线编程里的脚本是热更新的；如果改的是后端 Java 或前端静态资源，需要重启 / 重新打包。

## 许可

[MIT](LICENSE) © gewuMind contributors
