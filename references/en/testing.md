# Testing guide (unit / integration / browser simulation)

> Goal: turn "it is generated" into "it is proven to run". Three layers, shallow to deep; **integration is the minimum**, browser simulation is optional per environment.
> All examples use placeholders only: `{base}` instance URL, `{token}` login token, `{user}` / `{password}` test account, `{module}` / `{path}` module/path under test, `{id}` record key. **Get the real values at runtime from the user or by probing — never hardcode them in docs or scripts.**

## 0. Confirm before testing (all required)

| Need | How to get it |
|---|---|
| Instance URL `{base}` | Ask the user; or probe `GET {base}/ai/health` / `GET {base}/api/ai/health` (prefix varies by version, see `references/en/publish-protocol.md`) |
| Login | See `references/en/publish-protocol.md`; put the returned `{token}` in the request header (app side usually `token: <uuid>`) |
| Test accounts | **Provided by the user**; never hardcode them; keep at least one non-admin account for permission cases |
| Targets | The APIs / pages / menus just published, from `docs/api.md` and `docs/ui.md` |

> If the instance is unreachable or you have no test account, **stop** and tell the user. Never claim "tests passed" without evidence.

## 1. Unit test (single endpoint / script, fixed input)

**Purpose**: prove a single endpoint/script computes correctly, independent of the full flow.

- **Target**: each endpoint in `docs/api.md`, or the `.ms` / `function` you just changed
- **Method**: call once with fixed input, assert the response matches the `docs/api.md` contract (uniform `{code, data, msg}`)
- **Boundaries**: empty, missing required, out of range, wrong type, page overflow
- **Pass**: no exception, correct `code`, `data` fields and types match the contract

```bash
# list: assert paging shape
curl -s "{base}{module}/list?current=1&size=10" -H "token: {token}"
# expect: {"code":200,"data":{"list":[...],"total":N},"msg":"..."}

# detail: fetch by key
curl -s "{base}{module}/detail?id={id}" -H "token: {token}"

# negative: missing required / wrong type must be rejected clearly
curl -s "{base}{module}/detail?id=" -H "token: {token}"
```

> Faster interactively: in the magic-api editor (`/#/lowcode/magic-editor`) click **Test** on a single `.ms` and inspect variables with real input.

## 2. Integration test (against the running instance) — **required**

**Purpose**: prove the published artifacts work under real permissions and real data.

### 2.1 Happy path: full CRUD (once per module)

Fixed order, assert each step, clean up at the end:

1. **Create** → get the new `{id}`, assert success
2. **List** → query by a unique field (e.g. name), assert found and `total` +1
3. **Detail** → fetch by `{id}`, assert fields match the created record
4. **Update** → change one field, re-read, assert updated
5. **Delete** → re-list, assert gone
6. **Idempotent** → delete again, assert no 5xx (or the documented "not found")

### 2.2 Query & paging
- No filter, single filter, combined filters, fuzzy search
- Paging fields per `docs/api.md` (`current/size` or `page/size`); test first page, last page, oversized `size` (truncated, not OOM)

### 2.3 Permissions (most often missed)
- Log in as a **non-admin**, assert: unauthorized menus are not returned, unauthorized APIs are rejected (403 / business code), and **the response carries no data**
- Anonymous call to a protected API → rejected
- Data scope (self / org / all) takes effect per role; spot-check that an out-of-scope record is invisible

### 2.4 Pass
- All assertions pass, **zero privilege leaks**, no 5xx
- Reuse `scripts/verify-publish.mjs` for a post-publish smoke; integration covers more

## 3. Browser simulation test (UI) — optional but recommended

**Purpose**: prove a user can actually click through it. Requires a browser; **run unit/integration first**.

- **Tool**: Playwright (preferred, ships a browser) or Puppeteer
- **Per-page flow**:
  1. Open `{base}` → log in (account from the user)
  2. Enter the menu → wait for the table to load (wait for a concrete element, not a fixed `sleep`)
  3. **Create**: click New → fill required fields → submit → assert success toast and a new row
  4. **Edit**: change a row → submit → assert the row updated
  5. **Delete**: delete a row → confirm → assert the row is gone
  6. **Permission**: with the low-privilege account, assert unauthorized buttons are **not visible**
- **Pass**: key paths work, browser console **0 errors**, UI data matches the API
- **Selectors**: prefer stable text / roles / `data-*` over fragile DOM paths

```js
// Playwright pseudo-code (URL and accounts always from env vars, never hardcoded)
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(process.env.GW_BASE);
await page.fill('[name=username]', process.env.GW_USER);
await page.fill('[name=password]', process.env.GW_PASS);
await page.click('button[type=submit]');
await page.waitForURL('**/home');          // wait for a stable post-login anchor
// …enter menu → fill form → assert
```

## 4. Test data & cleanup
- Tag test data with a recognizable prefix (e.g. `TEST_`), delete it afterwards
- **Idempotent**: the same suite reruns without failing on leftovers
- Delete only your own data; never touch existing user data

## 5. Pass criteria & reporting

| Layer | Pass criteria |
|---|---|
| Unit | Every endpoint asserts; boundaries covered |
| Integration | Full flow + permissions + query/paging pass; zero privilege leaks; no 5xx |
| Browser | Key paths work; 0 console errors; data consistent |

Report to the user: **what ran, the result (pass / fail / not covered), and the symptom + location of any failure**. Never just say "tests passed".

## 6. Common pitfalls
- The first POST may have **no body**: scripts must null-guard it (see `knowledge/gewumind-boot/24-pitfalls-1.0.0.md`)
- Paging parameter names differ by version (`current/size` vs `page/size`): follow `docs/api.md` and the live behavior
- Response fields may be camelCase (`sql-column-case: camel`, e.g. `customerName` / `orderCount`): check the live field names before asserting; don't guess from SQL aliases
- Button permissions need **both** the menu row and the role grant; with only one the button never shows (see `knowledge/gewumind-boot/05-menu-register.md`)
- For privilege tests, don't stop at the HTTP code — check **whether the response leaked data**
- Browser login sessions expire; re-validate the session mid-flow for long runs

## 7. Automated test scripts (new in gewumind-skill 2.2)

> Script the three layers above: one test plan (`tests/plan.json`) drives 5 scripts; artifacts land in `reports/` (JSON + JUnit).
> Linked to the knowledge base: before generating / running, `knowledge.search` for existing cases / business rules / past issues; new cases are saved as drafts and confirmed by a human before being committed.
> Linked to publishing: `verify-publish.mjs --run-tests` auto-runs smoke + permission tests; **a failure blocks the release** and suggests a rollback.

### 7.1 Test plan format (`tests/plan.json`)

```json
{
  "base": "http://localhost:9089",
  "module": "device",
  "roles": { "admin": {"username":"admin","password":"123456"}, "operator": {"username":"op","password":"123456"} },
  "cases": [
    {"id":"device-list","type":"api","name":"device list","role":"admin","method":"POST","path":"/api/device/list","body":{"page":1,"size":10},
     "expect":{"http":200,"code":200,"shape":{"data.list":"array","data.total":"number"}}},
    {"id":"device-detail-unauth","type":"permission","name":"operator detail access must be denied","role":"operator","method":"POST","path":"/api/device/detail","body":{"id":1},
     "expect":{"denied":true,"noData":true}},
    {"id":"device-page","type":"ui","name":"device page CRUD smoke","role":"admin","url":"/device/list","steps":["login","goto","assert-table"]}
  ]
}
```

`expect` fields: `http` (expected status) / `code` (expected business code) / `shape` (dot-path → type `array|number|string|object|boolean|present|absent`) / `denied` (expect rejection: 401/403 or code≠200) / `noData` (expect no `data` in the response, guarding against privilege leaks). Omit `role` = anonymous (no token).

### 7.2 Scripts (`scripts/`, sharing `scripts/lib/gwtest.mjs`)

| Script | Purpose | Usage |
|---|---|---|
| `test-plan.mjs` | Scan `docs/api.md` for `METHOD /path` to scaffold a plan / validate / list cases | `node scripts/test-plan.mjs scaffold --api-doc docs/api.md --base <base> --out tests/plan.json`; `... validate --plan tests/plan.json`; `... list --plan tests/plan.json` |
| `api-test.mjs` | Run `type=api` cases (happy-path contract: HTTP/code/field shape) | `node scripts/api-test.mjs --plan tests/plan.json [--base ...] [--out reports/] [--json]` |
| `permission-test.mjs` | Run `type=permission` cases (role×endpoint matrix, assert rejection + no data leak) | `node scripts/permission-test.mjs --plan tests/plan.json [--base ...] [--out reports/] [--json]` |
| `ui-smoke.mjs` | Run `type=ui` cases (Playwright login/navigate/table render/0 console errors) | `node scripts/ui-smoke.mjs --plan tests/plan.json [--out reports/]` (needs `npm i -D playwright && npx playwright install chromium`; exits 3 to skip if missing) |
| `regression.mjs` | Run all api+permission cases, diff failures against a baseline | `node scripts/regression.mjs --plan tests/plan.json [--baseline reports/baseline.json] [--out reports/]` |

Exit codes: all pass 0; any failure 1; arg/plan error 2; (ui-smoke) Playwright missing 3. Reports: `reports/<name>.json` + `reports/<name>.xml` (JUnit).

### 7.3 Workflow

1. **Generate the plan**: `test-plan.mjs scaffold` from `docs/api.md` → a human/LLM fills in real `roles` accounts, `permission` privilege cases, `ui` cases, fixtures and exact `shape` assertions.
2. **Run**: `api-test` + `permission-test` (always) → `ui-smoke` (when a browser is available) → `regression` (full pre-release + baseline diff).
3. **Report**: tell the user what ran, pass/fail/not-covered, and the symptom + location of any failure; **never just say "tests passed"**.
4. **Release gate**: `verify-publish.mjs --run-tests` auto-runs smoke + permission tests; a failure → block the release and suggest a rollback (see `references/en/publish-protocol.md`).

### 7.4 Privilege-bug interception (example)

Seed a privilege bug (an endpoint missing a permission check, so a normal role can read data) → `permission-test`'s `noData` assertion fails (the response carries `data`) → exit code 1 → `verify-publish --run-tests` blocks the release. This is the "tests can stop a bad release" loop.

### 7.5 H5 external customer-service cases (new in 2.2)

H5 channels use SSE (`POST /api/ai/h5/ask`, `channel` + `userId`), not a plain JSON endpoint, so `api-test`'s `shape` assertions don't apply. Cover three classes with `type=api` cases + a custom assertion script:

- **Golden set**: an anonymous / phone visitor asks a business question → assert `success` and that the answer contains real data (a phone visitor should hit their own data)
- **Privilege matrix**: an anonymous visitor asks about someone else's data → assert `NO_DATA` (0 leak); cross-user → `NEED_CLARIFY`
- **Handoff**: a visitor triggers a handoff → assert a `pending` ticket lands in `sys_ai_handoff`

> The identity parameter is `userId` (`phone:<number>` / `anon:<id>` prefix, produced by `resolveExternalId`); a magic-api tool endpoint must strip the `phone:` prefix and read the script variable directly (the internal `execute`'s `req` is null, so `#{}`/`?{}` can't bind the injected param). A tool's `params_schema` must not set `required:["phone"]` (it triggers `NEED_CLARIFY`).
