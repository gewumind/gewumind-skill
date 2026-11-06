/**
 * gwtest.mjs — gewumind-skill 测试脚本共享库
 *
 * 被 test-plan / api-test / permission-test / ui-smoke / regression 复用：
 *   - loadPlan / validatePlan：测试计划（JSON）加载与校验
 *   - login：对实例 /system/security/login 登录拿 token（密码 sha256）
 *   - request：带 token 的 HTTP 请求
 *   - assertShape：按点路径断言字段类型/存在
 *   - runHttpCase：执行单个 api/permission 用例（含 denied/noData 越权断言）
 *   - writeReport：输出 JSON + JUnit 报告
 *
 * 测试计划格式（tests/plan.json）：
 *   {
 *     "base": "http://localhost:9089",
 *     "module": "device",
 *     "roles": { "admin": {"username":"admin","password":"123456"}, "operator": {...} },
 *     "cases": [
 *       {"id":"device-list","type":"api","name":"设备列表","role":"admin",
 *        "method":"POST","path":"/api/device/list","body":{"page":1,"size":10},
 *        "expect":{"http":200,"code":200,"shape":{"data.list":"array","data.total":"number"}}},
 *       {"id":"device-detail-unauth","type":"permission","name":"operator 访问详情应被拒",
 *        "role":"operator","method":"POST","path":"/api/device/detail","body":{"id":1},
 *        "expect":{"denied":true,"noData":true}},
 *       {"id":"device-page","type":"ui","name":"设备页 CRUD 冒烟","role":"admin",
 *        "url":"/device/list","steps":["login","goto","assert-table","create","edit","delete"]}
 *     ]
 *   }
 * expect 字段：http(期望状态码) / code(期望业务码) / shape(点路径→类型) / denied(期望被拒) / noData(期望不夹带数据)。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const TIMEOUT = 20000;
const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

export function loadPlan(file) {
  const plan = JSON.parse(readFileSync(file, 'utf8'));
  validatePlan(plan);
  return plan;
}

export function validatePlan(plan) {
  const errs = [];
  if (!plan || typeof plan !== 'object') {
    errs.push('plan 必须是对象');
  } else {
    if (!plan.base) errs.push('缺 base（实例地址）');
    if (!Array.isArray(plan.cases) || !plan.cases.length) errs.push('cases 必须是非空数组');
    (plan.cases || []).forEach((c, i) => {
      const tag = c?.id ? `cases[${i}](${c.id})` : `cases[${i}]`;
      if (!c.id) errs.push(`${tag} 缺 id`);
      if (!c.type || !['api', 'permission', 'ui'].includes(c.type)) errs.push(`${tag} type 必须是 api|permission|ui`);
      if (c.type === 'ui') {
        if (!c.url) errs.push(`${tag} ui 用例缺 url`);
      } else if (c.type === 'api' || c.type === 'permission') {
        if (!c.path) errs.push(`${tag} 缺 path`);
        if (!c.method) errs.push(`${tag} 缺 method`);
      }
      if (c.role && plan.roles && !plan.roles[c.role]) errs.push(`${tag} role "${c.role}" 未在 roles 定义`);
    });
  }
  if (errs.length) throw new Error('plan 校验失败：\n  ' + errs.join('\n  '));
  return true;
}

export async function login(base, { username, password }) {
  const res = await fetch(base + '/system/security/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: sha256(password), code: '', uuid: '' }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  const token = json?.data;
  if (!token) throw new Error(`login ${username} 失败：${json?.message || text.slice(0, 120)}`);
  return token;
}

export async function request(base, token, method, path, body) {
  const headers = {};
  if (token) headers.token = token;
  const m = (method || 'POST').toUpperCase();
  const init = { method: m, headers, signal: AbortSignal.timeout(TIMEOUT) };
  if (body !== undefined && !['GET', 'HEAD'].includes(m)) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { res, json, text };
}

function getByPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export function assertShape(json, shape) {
  const fails = [];
  for (const [path, want] of Object.entries(shape || {})) {
    const v = getByPath(json, path);
    if (want === 'present') { if (v === undefined) fails.push(`${path} 应存在`); }
    else if (want === 'absent') { if (v !== undefined) fails.push(`${path} 应不存在`); }
    else if (typeOf(v) !== want) fails.push(`${path} 期望 ${want}，实际 ${typeOf(v)}`);
  }
  return fails;
}

export async function runHttpCase(plan, c) {
  const role = plan.roles?.[c.role];
  let token = null;
  if (role) token = await login(plan.base, role);
  const { res, json, text } = await request(plan.base, token, c.method, c.path, c.body);
  const code = json?.code;
  const denied = res.status === 401 || res.status === 403 || (code !== undefined && code !== 200);
  const hasData = !!(json && json.data !== undefined && json.data !== null && json.data !== '');
  const exp = c.expect || {};
  const fails = [];
  if (exp.denied) {
    if (!denied) fails.push(`期望被拒（401/403 或 code!=200），实际 HTTP ${res.status} code ${code}`);
  } else {
    if (exp.http && res.status !== exp.http) fails.push(`HTTP 期望 ${exp.http}，实际 ${res.status}`);
    if (exp.code !== undefined) {
      if (code !== exp.code) fails.push(`code 期望 ${exp.code}，实际 ${code}`);
    } else if (code !== undefined && code !== 200) {
      fails.push(`业务错误 code ${code} ${json?.message || ''}`);
    }
    fails.push(...assertShape(json, exp.shape));
  }
  if (exp.noData && hasData) fails.push('响应夹带 data（越权泄漏）');
  const ok = fails.length === 0;
  return { id: c.id, name: c.name, type: c.type, ok, msg: `${c.name}：${ok ? '通过' : fails.join('；')}`, http: res.status, code, data: hasData };
}

export function writeReport(results, { outDir, name }) {
  mkdirSync(outDir, { recursive: true });
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const summary = { name, total: results.length, passed, failed, ok: results.length > 0 && failed === 0, results };
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(summary, null, 2));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cases = results.map((r) => {
    const fail = r.ok ? '' : `<failure message="${esc(r.msg)}"/>`;
    return `    <testcase name="${esc(r.id || r.name)}">${fail}</testcase>`;
  }).join('\n');
  const junit = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${esc(name)}" tests="${results.length}" failures="${failed}">\n${cases}\n</testsuite>\n`;
  writeFileSync(join(outDir, `${name}.xml`), junit);
  return summary;
}

export function printSummary(summary, json) {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const r of summary.results) console.log(`[${r.ok ? 'ok' : 'FAIL'}] ${r.id} ${r.msg}`);
    console.log(`${summary.name}: ${summary.ok ? 'OK' : 'FAILED'} (${summary.passed}/${summary.total} 通过, ${summary.failed} 失败)`);
  }
}
