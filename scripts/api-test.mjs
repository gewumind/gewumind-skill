#!/usr/bin/env node
/**
 * api-test.mjs — 接口契约测试（带登录态 + 夹具）
 *
 * 用法：
 *   node scripts/api-test.mjs --plan tests/plan.json [--base http://localhost:9089] [--out reports/] [--json]
 *
 * 跑 plan 里所有 type=api 的用例（正向契约：HTTP/code/字段结构），输出 JSON + JUnit 报告到 --out。
 * 退出码：全过 0；有失败 1；参数/计划错误 2。
 */
import { loadPlan, runHttpCase, writeReport, printSummary } from './lib/gwtest.mjs';

const argv = process.argv.slice(2);
const opts = { plan: 'tests/plan.json', out: 'reports', json: false, base: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => { const v = argv[++i]; if (v === undefined) { console.error(`缺 ${a} 的值`); process.exit(2); } return v; };
  if (a === '--plan') opts.plan = val();
  else if (a === '--out') opts.out = val();
  else if (a === '--base') opts.base = val();
  else if (a === '--json') opts.json = true;
  else if (a === '-h' || a === '--help') { console.error('用法：node scripts/api-test.mjs --plan tests/plan.json [--base ...] [--out reports/] [--json]'); process.exit(2); }
  else { console.error(`未知参数 ${a}`); process.exit(2); }
}

let plan;
try { plan = loadPlan(opts.plan); } catch (e) { console.error(`api-test: ${e.message}`); process.exit(2); }
if (opts.base) plan.base = opts.base.replace(/\/+$/, '');

const cases = plan.cases.filter((c) => c.type === 'api');
if (!cases.length) { console.error('api-test: plan 里没有 type=api 的用例'); process.exit(2); }

const results = [];
for (const c of cases) {
  try { results.push(await runHttpCase(plan, c)); }
  catch (e) { results.push({ id: c.id, name: c.name, type: 'api', ok: false, msg: `${c.name}：异常 ${e.message}` }); }
}
const summary = writeReport(results, { outDir: opts.out, name: 'api-test' });
printSummary(summary, opts.json);
process.exit(summary.ok ? 0 : 1);
