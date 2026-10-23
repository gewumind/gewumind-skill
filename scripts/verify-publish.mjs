#!/usr/bin/env node
/**
 * verify-publish.mjs — 发布后只读验证：组件 / 接口 / 菜单
 *
 * 用法：
 *   node scripts/verify-publish.mjs --base http://localhost:9089 \
 *     --component 设备列表 --api /api/device/list --menu-url /device/list \
 *     --username admin --password 123456
 *
 *   # 已有登录态时直接给 token
 *   node scripts/verify-publish.mjs ... --token <uuid>
 *
 * 检查项：
 *   1. /system/component/runtime/list 中存在目标组件（按 name 或 path 匹配）
 *   2. 目标 API 返回 HTTP 2xx 且 code=200（默认 POST，body 可用 --api-body 覆盖）
 *   3. 当前用户菜单树中存在目标 url/path
 *
 * 退出码：全部通过 0；有失败 1；参数错误 2。只读，不修改任何文件。
 */
import { createHash } from 'node:crypto';

const TIMEOUT = 15000;
const opts = {
  base: 'http://localhost:9089',
  apiMethod: 'POST',
  apiBody: { page: 1, size: 1 },
  json: false,
};

function usage(msg) {
  if (msg) console.error(`verify-publish: ${msg}`);
  console.error(`用法：
  node scripts/verify-publish.mjs --base http://localhost:9089 \\
    [--component 设备列表] [--api /api/device/list] [--menu-url /device/list] \\
    [--token <uuid> | --username <u> --password <p>] \\
    [--api-method POST] [--api-body '{"page":1,"size":1}'] [--json]`);
  process.exit(2);
}

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => {
    const v = argv[++i];
    if (v === undefined) usage(`缺少 ${a} 的值`);
    return v;
  };
  switch (a) {
    case '--base': opts.base = val(); break;
    case '--component': opts.component = val(); break;
    case '--api': opts.api = val(); break;
    case '--api-method': opts.apiMethod = val().toUpperCase(); break;
    case '--api-body':
      try { opts.apiBody = JSON.parse(val()); } catch { usage('--api-body 必须是 JSON'); }
      break;
    case '--menu-url': opts.menuUrl = val(); break;
    case '--token': opts.token = val(); break;
    case '--username': opts.username = val(); break;
    case '--password': opts.password = val(); break;
    case '--json': opts.json = true; break;
    case '-h': case '--help': usage(); break;
    default: usage(`未知参数 ${a}`);
  }
}

opts.base = opts.base.replace(/\/+$/, '');
if (!opts.component && !opts.api && !opts.menuUrl) usage('至少给 --component / --api / --menu-url 之一');
if (opts.menuUrl && !opts.token && !(opts.username && opts.password)) {
  usage('--menu-url 需要 --token 或 --username/--password');
}

const checks = [];
function record(ok, msg) { checks.push({ ok, msg }); }

async function request(path, init = {}) {
  const res = await fetch(opts.base + path, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON response */ }
  return { res, json, text };
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function walk(node, fn) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, fn);
  } else if (node && typeof node === 'object') {
    fn(node);
    for (const v of Object.values(node)) walk(v, fn);
  }
}

if (opts.username && opts.password) {
  try {
    const { json } = await request('/system/security/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: opts.username, password: sha256(opts.password), code: '', uuid: '' }),
    });
    const token = json?.data;
    if (token) {
      opts.token = token;
      record(true, `login ${opts.username}`);
    } else {
      record(false, `login ${opts.username} -> ${json?.message || 'no token'}`);
    }
  } catch (e) {
    record(false, `login ${opts.username} -> ${e.message}`);
  }
}

if (opts.component) {
  try {
    const { json } = await request('/system/component/runtime/list');
    const list = json?.data;
    const hit = Array.isArray(list) && list.find((c) =>
      c.name === opts.component || c.path === opts.component ||
      (typeof c.path === 'string' && c.path.endsWith('/' + opts.component)));
    if (hit) record(true, `component ${hit.name} (${hit.path})`);
    else record(false, `component not found: ${opts.component}`);
  } catch (e) {
    record(false, `component check failed: ${e.message}`);
  }
}

if (opts.api) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers.token = opts.token;
    const init = { method: opts.apiMethod, headers };
    if (!['GET', 'HEAD'].includes(opts.apiMethod)) init.body = JSON.stringify(opts.apiBody);
    const { res, json, text } = await request(opts.api, init);
    const code = json?.code;
    if (!res.ok) record(false, `api ${opts.apiMethod} ${opts.api} -> HTTP ${res.status} ${text.slice(0, 120)}`);
    else if (code !== undefined && code !== 200) record(false, `api ${opts.apiMethod} ${opts.api} -> code ${code} ${json?.message || ''}`);
    else record(true, `api ${opts.apiMethod} ${opts.api} -> ${code ?? res.status}`);
  } catch (e) {
    record(false, `api check failed: ${e.message}`);
  }
}

if (opts.menuUrl) {
  if (!opts.token) {
    record(false, 'menu check skipped: login failed');
  } else {
    try {
      const { json } = await request('/system/menu/current/menus', {
        method: 'POST',
        headers: { token: opts.token },
      });
      const found = [];
      walk(json?.data, (n) => {
        if (n.url === opts.menuUrl || n.path === opts.menuUrl) found.push(n);
      });
      if (found.length) record(true, `menu ${opts.menuUrl} (${found[0].title || found[0].name || 'ok'})`);
      else record(false, `menu not found: ${opts.menuUrl}`);
    } catch (e) {
      record(false, `menu check failed: ${e.message}`);
    }
  }
}

const ok = checks.length > 0 && checks.every((c) => c.ok);
if (opts.json) {
  console.log(JSON.stringify({ ok, checks }, null, 2));
} else {
  for (const c of checks) console.log(`[${c.ok ? 'ok' : 'FAIL'}] ${c.msg}`);
  console.log(`verify-publish: ${ok ? 'OK' : 'FAILED'} (${checks.filter((c) => c.ok).length}/${checks.length})`);
}
process.exit(ok ? 0 : 1);
