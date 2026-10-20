# 18 — 系统配置（Logo / 名称 / 登录背景）

## 概览

系统在 `src/system/` 下放 3 类资源，发布到后端 `sys_system_config` 表（TEXT 列，可存 base64）。前端（`gewumind-boot/frontend`）启动时自动调 `/api/ai/system-config` 加载到 `useSystemConfigStore`。

| 资源 | 路径 | 类型 | 说明 |
|------|------|------|------|
| 系统名 | `src/system/system.json` → `system.name` | string | 显示在 layout header + login + 浏览器 title |
| Logo | `src/system/logo.svg` (或 `.png/.jpg`) | image | 渲染成 dataURL 存到 `system.logo` |
| 登录背景 | `src/system/login-bg.svg` (或 `.png/.jpg`) | image | 渲染成 dataURL 存到 `system.login.bg` |

## 文件结构

```
src/system/
├── system.json        # {"system.name": "...", ...}（其它字段空着由 apply 补）
├── logo.svg           # 推荐 SVG，体积小
├── logo.png           # 或 PNG（透明背景）
└── login-bg.svg       # 1920x1080 渐变 / 抽象图
```

> `system.json` 是「主入口」：name 必填，logo/bg 字段可省略（让 apply-bundle 自动读 `logo.svg` 等文件）。
> apply-bundle 会自动检测 `logo.{svg,png,jpg}` 和 `login-bg.{svg,png,jpg}`，转 base64 dataURL 上传。

## 调用工具

| 工具 | 用途 |
|------|------|
| `setSystemConfig(logo, name, loginBg)` | LLM 直接调用（生成新设计时） |

## 缺省行为

- `system.name` 缺省值: `GewuMind Boot 后台`
- `system.logo` 缺省值: `""`（前端 layout 显示 `$global.title` 文字）
- `system.login.bg` 缺省值: `""`（login.vue 用原蓝色背景）

## 前端显示

- `平台登录页源码` — 显示 logo + name + bg
- `平台首页源码` — 显示 name
- `gewumind-boot/frontend/src/layout/index.vue` — header 显示 logo + name

## 后端 API

- `GET /api/ai/system-config`（公开）→ `{logo, name, loginBg}` 三个字段
- `POST /api/ai/system-config`（需 X-AI-Key）→ 接受 `{logo, name, loginBg}`，UPSERT 到 `sys_system_config` 表
- `GET /api/ai/sfc-source?name=home|login`（公开）→ 返回 `sys_dynamic_component` 里的 source_code（home/login 动态加载用）

## 注意事项

1. **SFC 动态加载**：home.vue / login.vue 启动时调 `/api/ai/sfc-source?name=home`，若有 SFC 则编译+渲染；无则 fallback 到原静态页。
2. **sys_system_config 表**：自动 CREATE TABLE IF NOT EXISTS，含 id/configure_key/configure_value (TEXT)/configure_name/is_del/create_date/update_date。
3. **base64 体积**：SVG 通常 < 1KB；PNG 控制在 < 50KB（建议 200x80 logo + 1920x1080 bg）。
4. **图片格式**：SVG 透明 + 体积小，推荐。PNG/JPG 用作 logo 也行，bg 优先 SVG（更清晰）。
5. **不存 raw bytes**：base64 dataURL 直接存进 `configure_value`（TEXT 列）。如果将来要存外部 URL，前端可识别 data: 开头当 img src，其它当 URL 处理。
