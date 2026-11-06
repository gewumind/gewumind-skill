#!/usr/bin/env node
/**
 * regression.mjs — 全量回归：跑 plan 全部用例，与基线对比，输出失败差异
 *
 * 用法：
 *   node scripts/regression.mjs --plan tests/plan.json [--baseline reports/baseline.json] [--base http://...] [--out reports/] [--json]
 *
 * 跑 plan 里所有 api + permission 用例（ui 用例标记跳过，由 ui-smoke.mjs 执行）。
 * 若给 --baseline（上次 run 的 JSON 报告），对比输出：新增失败 / 已修复 / 仍失败 / 新增用例。
 * 退出码：全过 0；有失败 1；参数/计划错误 2。
 */
import { loadPlan, runHttpCase, writeReport, printSummary } from './lib/gwtest.mjs';
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const opts = { plan: 'tests/plan.json', out: 'reports', json: false, base: null, baseline: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => { const v = argv[++i]; if (v === undefined) { console.error(`缺 ${a} 的值`); process.exit(2); } return v; };
  if (a === '--plan') opts.plan = val();
  else if (a === '--out') opts.out = val();
  else if (a === '--base') opts.base = val();
  else if (a === '--baseline') opts.baseline = val();
  else if (a === '--json') opts.json = true;
  else if (a === '-h' || a === '--help') { console.error('用法：node scripts/regression.mjs --plan tests/plan.json [--baseline reports/baseline.json] [--base ...] [--out reports/] [--json]'); process.exit(2); }
  else { console.error(`未知参数 ${a}`); process.exit(2); }
}

let plan;
try { plan = loadPlan(opts.plan); } catch (e) { console.error(`regression: ${e.message}`); process.exit(2); }
if (opts.base) plan.base = opts.base.replace(/\/+$/, '');

const results = [];
for (const c of plan.cases) {
  if (c.type === 'ui') {
    results.push({ id: c.id, name: c.name, type: 'ui', ok: true, msg: `${c.name}：跳过（ui 用例由 ui-smoke.mjs 执行）` });
    continue;
  }
  try { results.push(await runHttpCase(plan, c)); }
  catch (e) { results.push({ id: c.id, name: c.name, type: c.type, ok: false, msg: `${c.name}：异常 ${e.message}` }); }
}
const summary = writeReport(results, { outDir: opts.out, name: 'regression' });

if (opts.baseline) {
  if (!existsSync(opts.baseline)) { console.error(`regression: 找不到基线 ${opts.baseline}`); process.exit(2); }
  const base = JSON.parse(readFileSync(opts.baseline, 'utf8'));
  const baseMap = new Map((base.results || []).map((r) => [r.id, r.ok]));
  const nowMap = new Map(results.map((r) => [r.id, r.ok]));
  const newFail = [], fixed = [], stillFail = [];
  const newCases = [...nowMap.keys()].filter((id) => !baseMap.has(id));
  for (const [id, ok] of nowMap) {
    const baseOk = baseMap.get(id);
    if (baseOk === undefined) continue;
    if (!ok && baseOk) newFail.push(id);
    else if (!ok && !baseOk) stillFail.push(id);
    else if (ok && !baseOk) fixed.push(id);
  }
  summary.diff = { newFail, fixed, stillFail, newCases };
  if (!opts.json) {
    console.log(`\nregression 基线对比（${opts.baseline}）：`);
    console.log(`  新增失败：${newFail.length ? newFail.join(', ') : '无'}`);
    console.log(`  已修复：${fixed.length ? fixed.join(', ') : '无'}`);
    console.log(`  仍失败：${stillFail.length ? stillFail.join(', ') : '无'}`);
    console.log(`  新增用例：${newCases.length ? newCases.join(', ') : '无'}`);
  }
}
printSummary(summary, opts.json);
process.exit(summary.ok ? 0 : 1);
