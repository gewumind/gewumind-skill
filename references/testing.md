# 测试指南（单元 / 集成 / 浏览器模拟）

> 目标：把"能生成"变成"能证明它能跑"。三层测试由浅入深，**至少做到集成测试**；浏览器模拟按环境可选。
> 全部示例只用占位符：`{base}` 实例地址、`{token}` 登录令牌、`{user}` / `{password}` 测试账号、`{module}` / `{path}` 被测模块/路径、`{id}` 记录主键。**具体值运行时向用户要或探测，不写死在文档和脚本里。**

## 0. 开测前先确认（缺一不可）

| 需要 | 怎么拿 |
|---|---|
| 实例地址 `{base}` | 问用户；或探测 `GET {base}/ai/health` / `GET {base}/api/ai/health`（前缀随版本不同，见 `references/publish-protocol.md` §路径说明） |
| 登录方式 | 见 `references/publish-protocol.md` §登录；拿到 `{token}` 后放进请求头（应用侧常见 `token: <uuid>`） |
| 测试账号 | **用户提供**，不要硬编码到文档/脚本里；至少一个普通角色账号用于权限用例 |
| 被测对象 | 本次发布的接口 / 页面 / 菜单，来自 `docs/api.md`、`docs/ui.md` |

> 连不上实例、或拿不到测试账号 → 停下告诉用户。**绝不凭空写"测试通过"。**

## 1. 单元测试（单接口 / 单脚本，固定入参）

**定位**：最小粒度证明"这个接口/脚本本身算得对"，不依赖完整业务链路。

- **对象**：`docs/api.md` 每个端点；或本次改动的那个 `.ms` / `function`
- **做法**：用一组固定入参调一次，断言返回结构与 `docs/api.md` 约定一致（统一 `{code, data, msg}`）
- **必测边界**：空参、缺必填、超范围、非法类型、翻页越界
- **判定**：无异常抛出、`code` 正确、`data` 字段名与类型符合约定

```bash
# 列表：断言分页结构
curl -s "{base}{module}/list?current=1&size=10" -H "token: {token}"
# 期望：{"code":200,"data":{"list":[...],"total":N},"msg":"..."}

# 详情：按主键取回
curl -s "{base}{module}/detail?id={id}" -H "token: {token}"

# 负向：缺必填 / 非法类型，断言被拒且有明确提示
curl -s "{base}{module}/detail?id=" -H "token: {token}"
```

> 交互式更快：magic-api 编辑器（`/#/lowcode/magic-editor`）里对单个 `.ms` 点「测试」，填真实入参逐行看变量。

## 2. 集成测试（对运行实例，走完整链路）— **必做**

**定位**：证明"发布后的东西在真实权限、真实数据下能跑通"。

### 2.1 正向：CRUD 全链路（每个业务模块都跑一遍）

固定顺序，每步都断言，最后清理：

1. **新增** → 拿到新 `{id}`，断言成功
2. **列表** → 按唯一字段（如名称）查，断言能查到、`total` +1
3. **详情** → 按 `{id}` 取，断言字段与新增一致
4. **修改** → 改一个字段后再查，断言已更新
5. **删除** → 再查列表，断言已消失
6. **幂等** → 再删一次，断言不报 5xx（或按业务约定返回"不存在"）

### 2.2 查询与分页
- 无参、单条件、多条件组合、模糊查各测一次
- 分页字段以 `docs/api.md` 为准（可能是 `current/size`，也可能 `page/size`）；测第 1 页、最后一页、超大 `size`（应被截断而非 OOM）

### 2.3 权限（最容易漏）
- 用**普通角色**登录，断言：未授权菜单不返回、未授权接口被拒（403 / 业务错误码），**响应里不夹带数据**
- 未登录调受保护接口 → 拒绝
- 数据范围（本人 / 本组织 / 全部）按角色生效，抽查一条越界数据确实看不到

### 2.4 判定
- 所有断言通过、**越权 0 泄漏**、无 5xx
- 发布后冒烟可复用 `scripts/verify-publish.mjs`；集成测试覆盖面更全

## 3. 浏览器模拟测试（UI）— 可选但推荐

**定位**：证明"用户真的能点着用"。依赖浏览器环境，**先跑完单测/集成再跑**。

- **工具**：Playwright（首选，自带浏览器）或 Puppeteer
- **每个页面的流程**：
  1. 打开 `{base}` → 登录（账号用户提供）
  2. 进菜单 → 等表格加载完成（等具体元素出现，不用固定 `sleep`）
  3. **新增**：点「新增」→ 弹窗填必填项 → 提交 → 断言提示成功且列表出现新行
  4. **编辑**：改一行 → 提交 → 断言行内容更新
  5. **删除**：删一行 → 确认 → 断言行消失
  6. **权限**：用低权限账号，断言无权限按钮**不可见**
- **判定**：关键路径全通、浏览器控制台 **0 error**、界面数据与接口一致
- **选择器**：优先用稳定文本 / 角色 / `data-*`，别依赖易变的 DOM 层级

```js
// Playwright 伪代码（示例；地址与账号一律来自环境变量，不写死）
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(process.env.GW_BASE);
await page.fill('[name=username]', process.env.GW_USER);
await page.fill('[name=password]', process.env.GW_PASS);
await page.click('button[type=submit]');
await page.waitForURL('**/home');          // 等登录后的稳定锚点
// …进入菜单 → 填表 → 断言
```

## 4. 测试数据与清理
- 统一用可识别前缀（如 `TEST_`）标记测试数据，跑完删除
- **幂等**：同一套测试能重复跑，不因残留数据失败
- 只删自己造的数据，不碰用户已有数据

## 5. 通过标准与报告

| 层级 | 通过标准 |
|---|---|
| 单元 | 每个端点断言通过，边界有覆盖 |
| 集成 | 全链路 + 权限 + 查询分页全过，0 越权泄漏，无 5xx |
| 浏览器 | 关键路径通，0 console error，数据一致 |

向用户报告：**跑了哪些、结果（通过 / 失败 / 未覆盖）、失败项的现象与定位**。不要只说一句"测试通过"。

## 6. 常见坑
- 首屏 POST 可能**没有 body**：脚本必须判空（见 `knowledge/gewumind-boot/24-pitfalls-1.0.0.md`）
- 分页参数名随版本不同（`current/size` vs `page/size`）：以 `docs/api.md` 和实测为准
- 返回字段可能是驼峰（`sql-column-case: camel`，如 `customerName` / `orderCount`）：断言前先看一次实测字段名，别按 SQL 别名猜
- 按钮权限要「菜单行 + 角色授权」两份，少一份按钮不显示（见 `knowledge/gewumind-boot/05-menu-register.md`）
- 越权测试别只看 HTTP 码，要看**响应里有没有带出数据**
- 浏览器登录态有时效，长流程中途要重新校验会话

## 7. 自动化测试脚本（gewumind-skill 2.2 新增）

> 把上面三层测试**脚本化**：一份测试计划（`tests/plan.json`）驱动 5 个脚本，产物落 `reports/`（JSON + JUnit）。
> 与知识库联动：生成 / 执行前先 `knowledge.search` 检索既有用例 / 业务规则 / 历史问题；新用例先存草稿，人工确认后入库。
> 与发布联动：`verify-publish.mjs --run-tests` 自动跑冒烟 + 权限测试，**失败阻止发布**并提示回滚。

### 7.1 测试计划格式（`tests/plan.json`）

```json
{
  "base": "http://localhost:9089",
  "module": "device",
  "roles": { "admin": {"username":"admin","password":"123456"}, "operator": {"username":"op","password":"123456"} },
  "cases": [
    {"id":"device-list","type":"api","name":"设备列表","role":"admin","method":"POST","path":"/api/device/list","body":{"page":1,"size":10},
     "expect":{"http":200,"code":200,"shape":{"data.list":"array","data.total":"number"}}},
    {"id":"device-detail-unauth","type":"permission","name":"operator 访问详情应被拒","role":"operator","method":"POST","path":"/api/device/detail","body":{"id":1},
     "expect":{"denied":true,"noData":true}},
    {"id":"device-page","type":"ui","name":"设备页 CRUD 冒烟","role":"admin","url":"/device/list","steps":["login","goto","assert-table"]}
  ]
}
```

`expect` 字段：`http`（期望状态码）/ `code`（期望业务码）/ `shape`（点路径→类型 `array|number|string|object|boolean|present|absent`）/ `denied`（期望被拒：401/403 或 code≠200）/ `noData`（期望响应不夹带 `data`，防越权泄漏）。`role` 省略 = 匿名（无 token）。

### 7.2 脚本（`scripts/`，共享 `scripts/lib/gwtest.mjs`）

| 脚本 | 作用 | 用法 |
|---|---|---|
| `test-plan.mjs` | 从 `docs/api.md` 扫描 `METHOD /path` 生成计划骨架 / 校验 / 列用例 | `node scripts/test-plan.mjs scaffold --api-doc docs/api.md --base <base> --out tests/plan.json`；`... validate --plan tests/plan.json`；`... list --plan tests/plan.json` |
| `api-test.mjs` | 跑 `type=api` 用例（正向契约：HTTP/code/字段结构） | `node scripts/api-test.mjs --plan tests/plan.json [--base ...] [--out reports/] [--json]` |
| `permission-test.mjs` | 跑 `type=permission` 用例（角色×接口矩阵，断言被拒 + 不夹带数据） | `node scripts/permission-test.mjs --plan tests/plan.json [--base ...] [--out reports/] [--json]` |
| `ui-smoke.mjs` | 跑 `type=ui` 用例（Playwright 登录/进页面/表格渲染/0 console error） | `node scripts/ui-smoke.mjs --plan tests/plan.json [--out reports/]`（需 `npm i -D playwright && npx playwright install chromium`；未装退出码 3 跳过） |
| `regression.mjs` | 跑全部 api+permission 用例，与基线对比输出失败差异 | `node scripts/regression.mjs --plan tests/plan.json [--baseline reports/baseline.json] [--out reports/]` |

退出码：全过 0；有失败 1；参数/计划错误 2；（ui-smoke）Playwright 缺失 3。报告：`reports/<name>.json` + `reports/<name>.xml`（JUnit）。

### 7.3 工作流

1. **生成计划**：`test-plan.mjs scaffold` 从 `docs/api.md` 出骨架 → 人工/LLM 补全 `roles` 真实账号、`permission` 越权用例、`ui` 用例、夹具与精确 `shape` 断言。
2. **执行**：`api-test` + `permission-test`（必跑）→ `ui-smoke`（有浏览器环境时）→ `regression`（发布前全量 + 基线对比）。
3. **报告**：向用户报告跑了哪些、通过/失败/未覆盖、失败项现象与定位；**绝不凭空写"测试通过"**。
4. **发布门禁**：`verify-publish.mjs --run-tests` 自动跑冒烟 + 权限测试，失败 → 阻止发布并提示回滚（见 `references/publish-protocol.md`）。

### 7.4 越权 bug 拦截（示例）

预置一个越权 bug（某接口未做权限校验，普通角色能拿到数据）→ `permission-test` 的 `noData` 断言会失败（响应夹带 `data`）→ 退出码 1 → `verify-publish --run-tests` 阻止发布。这就是"测试能拦住坏发布"的闭环。

### 7.5 H5 对外客服用例（2.2 新增）

H5 渠道走 SSE（`POST /api/ai/h5/ask`，`channel` + `userId`），不是普通 JSON 接口，`api-test` 的 `shape` 断言不适用。用 `type=api` 用例 + 自定义断言脚本覆盖三类：

- **黄金集**：匿名 / 手机号访客问业务问题 → 断言 `success` 且答案含真实数据（手机号访客应命中本人数据）
- **越权矩阵**：匿名访客问他人数据 → 断言 `NO_DATA`（0 泄漏）；跨用户 → `NEED_CLARIFY`
- **转人工**：访客触发转人工 → 断言 `sys_ai_handoff` 落 `pending` 工单

> 身份参数是 `userId`（`phone:<手机号>` / `anon:<id>` 前缀，由 `resolveExternalId` 生成）；magic-api 工具端点须剥 `phone:` 前缀、直接取脚本变量（内部 `execute` 的 `req` 为 null，`#{}`/`?{}` 绑定不到注入参数）。工具 `params_schema` 勿 `required:["phone"]`（会触发 `NEED_CLARIFY`）。
