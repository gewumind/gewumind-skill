#!/usr/bin/env node
/**
 * ui-smoke.mjs — Playwright UI 冒烟（登录 / 进页面 / 表格渲染 / 控制台 0 error）
 *
 * 用法：
 *   node scripts/ui-smoke.mjs --plan tests/plan.json [--out reports/] [--json]
 *
 * 跑 plan 里所有 type=ui 的用例：登录（账号来自 plan.roles）→ 打开 c.url → 等表格/关键元素
 * → 收集控制台 error。CRUD 深测（新增/编辑/删除）需按用例在 steps 里扩展选择器，本脚本提供
 * 登录 + 导航 + 渲染 + 0-console-error 的冒烟骨架。
 * 依赖：npm i -D playwright && npx playwright install chromium。未安装 → 退出码 3（跳过）。
 * 退出码：全过 0；有失败 1；参数/计划错误 2；Playwright 缺失 3。
 */
import { loadPlan, writeReport, printSummary } from './lib/gwtest.mjs';

const argv = process.argv.slice(2);
const opts = { plan: 'tests/plan.json', out: 'reports', json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => { const v = argv[++i]; if (v === undefined) { console.error(`缺 ${a} 的值`); process.exit(2); } return v; };
  if (a === '--plan') opts.plan = val();
  else if (a === '--out') opts.out = val();
  else if (a === '--json') opts.json = true;
  else if (a === '-h' || a === '--help') { console.error('用法：node scripts/ui-smoke.mjs --plan tests/plan.json [--out reports/] [--json]'); process.exit(2); }
  else { console.error(`未知参数 ${a}`); process.exit(2); }
}

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.error('ui-smoke: 未安装 Playwright（npm i -D playwright && npx playwright install chromium）'); process.exit(3); }

let plan;
try { plan = loadPlan(opts.plan); } catch (e) { console.error(`ui-smoke: ${e.message}`); process.exit(2); }

const cases = plan.cases.filter((c) => c.type === 'ui');
if (!cases.length) { console.error('ui-smoke: plan 里没有 type=ui 的用例'); process.exit(2); }

const browser = await chromium.launch();
const results = [];
try {
  for (const c of cases) {
    const role = plan.roles?.[c.role];
    if (!role) { results.push({ id: c.id, name: c.name, type: 'ui', ok: false, msg: `${c.name}：role "${c.role}" 未定义` }); continue; }
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    const fails = [];
    try {
      // 登录
      await page.goto(plan.base, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.fill('input[type=text], [name=username]', role.username, { timeout: 10000 });
      await page.fill('input[type=password], [name=password]', role.password, { timeout: 10000 });
      await page.click('button[type=submit], button:has-text("登录"), button:has-text("登 录")', { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      // 进页面
      await page.goto(plan.base + c.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // 等表格 / 关键元素
      await page.waitForSelector('table, .el-table, [class*=table], [class*=list]', { timeout: 15000 })
        .catch(() => fails.push(`页面未渲染出表格/列表（${c.url}）`));
      if (errors.length) fails.push(`控制台 ${errors.length} 个 error：${errors.slice(0, 3).join(' | ')}`);
    } catch (e) {
      fails.push(`异常 ${e.message}`);
    }
    const ok = fails.length === 0;
    results.push({ id: c.id, name: c.name, type: 'ui', ok, msg: `${c.name}：${ok ? '通过' : fails.join('；')}` });
    await page.close();
  }
} finally {
  await browser.close();
}
const summary = writeReport(results, { outDir: opts.out, name: 'ui-smoke' });
printSummary(summary, opts.json);
process.exit(summary.ok ? 0 : 1);
