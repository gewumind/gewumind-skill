#!/usr/bin/env node
/**
 * test-plan.mjs — 生成 / 校验 / 列出测试计划
 *
 * 用法：
 *   node scripts/test-plan.mjs scaffold --api-doc docs/api.md --base http://localhost:9089 --out tests/plan.json
 *   node scripts/test-plan.mjs validate --plan tests/plan.json
 *   node scripts/test-plan.mjs list --plan tests/plan.json
 *
 * scaffold：从 API 目录（docs/api.md）扫描 `METHOD /path` 端点，生成测试计划骨架
 *           （每个端点一个 type=api 用例，默认 expect {code:200}）。骨架需人工/LLM 补全
 *           roles 真实账号、permission 用例（越权）、ui 用例、夹具与精确 shape 断言。
 * validate：校验计划格式（roles 引用、type、必填字段）。
 * list：列出用例。
 * 退出码：成功 0；校验失败/未扫到端点 1；参数错误 2。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validatePlan } from './lib/gwtest.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
const opts = { apiDoc: 'docs/api.md', plan: 'tests/plan.json', base: 'http://localhost:9089', out: 'tests/plan.json' };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  const val = () => { const v = rest[++i]; if (v === undefined) { console.error(`缺 ${a} 的值`); process.exit(2); } return v; };
  if (a === '--api-doc') opts.apiDoc = val();
  else if (a === '--plan') opts.plan = val();
  else if (a === '--base') opts.base = val();
  else if (a === '--out') opts.out = val();
  else if (a === '-h' || a === '--help') { console.error('用法：node scripts/test-plan.mjs <scaffold|validate|list> [--api-doc ...] [--plan ...] [--base ...] [--out ...]'); process.exit(2); }
  else { console.error(`未知参数 ${a}`); process.exit(2); }
}

if (cmd === 'scaffold') {
  if (!existsSync(opts.apiDoc)) { console.error(`test-plan: 找不到 API 目录 ${opts.apiDoc}`); process.exit(2); }
  const text = readFileSync(opts.apiDoc, 'utf8');
  const seen = new Set();
  const cases = [];
  const re = /\b(GET|POST|PUT|DELETE|PATCH)\b\s*[:|]?\s*(\/[a-zA-Z0-9_\-./{}]+(?:\?[a-zA-Z0-9_=&.+-]+)?)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const path = m[2].split('?')[0];
    const key = method + ' ' + path;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = (path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + method.toLowerCase()).replace(/-+$/, '');
    cases.push({ id, type: 'api', name: `${method} ${path}`, role: 'admin', method, path, body: {}, expect: { code: 200 } });
  }
  if (!cases.length) { console.error('test-plan: 未从 API 目录扫描到任何端点（确认格式含 "METHOD /path"）'); process.exit(1); }
  const plan = {
    base: opts.base.replace(/\/+$/, ''),
    module: opts.apiDoc.replace(/^.*\//, '').replace(/\.md$/, ''),
    roles: { admin: { username: 'admin', password: 'CHANGE_ME' } },
    cases,
  };
  mkdirSync(dirname(opts.out) || '.', { recursive: true });
  writeFileSync(opts.out, JSON.stringify(plan, null, 2));
  console.log(`test-plan: 生成 ${cases.length} 个 api 用例骨架 → ${opts.out}`);
  console.log('  请补全：roles 真实账号、permission 用例（越权）、ui 用例、夹具与精确 shape 断言。');
  process.exit(0);
} else if (cmd === 'validate') {
  if (!existsSync(opts.plan)) { console.error(`test-plan: 找不到 ${opts.plan}`); process.exit(2); }
  try { validatePlan(JSON.parse(readFileSync(opts.plan, 'utf8'))); console.log(`test-plan: ${opts.plan} 校验通过`); process.exit(0); }
  catch (e) { console.error(`test-plan: ${e.message}`); process.exit(1); }
} else if (cmd === 'list') {
  if (!existsSync(opts.plan)) { console.error(`test-plan: 找不到 ${opts.plan}`); process.exit(2); }
  const plan = JSON.parse(readFileSync(opts.plan, 'utf8'));
  for (const c of plan.cases) console.log(`  [${c.type}] ${c.id} — ${c.name}${c.role ? ` (${c.role})` : ''}`);
  console.log(`共 ${plan.cases.length} 个用例`);
  process.exit(0);
} else {
  console.error('用法：node scripts/test-plan.mjs <scaffold|validate|list> [--api-doc ...] [--plan ...] [--base ...] [--out ...]');
  process.exit(2);
}
