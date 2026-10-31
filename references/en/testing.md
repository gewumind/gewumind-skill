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
