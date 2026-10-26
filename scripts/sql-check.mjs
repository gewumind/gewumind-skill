#!/usr/bin/env node
/**
 * sql-check.mjs — 扫描 .ms 脚本里的不安全 SQL 拼接
 *
 * 用法：
 *   node scripts/sql-check.mjs <file-or-dir> [...]
 *   node scripts/sql-check.mjs            # 默认扫描 src/magic-api、data/zh/magic-api、data/en/magic-api
 *
 * 规则：
 *   - ✅ 允许 `#{expr}`（参数化）与 `?{cond, ...}`（条件拼接）
 *   - ❌ 禁止 SQL 行里出现「引号 + 变量」拼接：`... '%" + keyword + "%'`
 *   - ❌ 禁止 SQL 字符串里使用 `${...}`（直接替换，防注入失效）
 *   - ❌ 禁止 LIMIT/OFFSET 用变量拼接（应校验数字或用 #{}）
 *
 * 退出码：有违规 → 1；否则 0。
 * 只读：不会修改任何文件。
 */
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const SEP = '='.repeat(32);
const SQL_KW = /\b(SELECT|INSERT|UPDATE|DELETE|REPLACE|FROM|WHERE|LIKE|AND|OR|SET|VALUES|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|IN\s*\()/i;
const CONCAT = /(['"])\s*\+\s*[A-Za-z_$]/;   // "... " + var
const CONCAT2 = /\+\s*(['"])/;               // var + " ..."
const INTERP = /\$\{[^}]+\}/;                // ${var}

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) walk(join(p, f), out);
  } else if (extname(p) === '.ms') {
    out.push(p);
  }
  return out;
}

function bodyOf(text) {
  const i = text.indexOf(SEP);
  return i >= 0 ? text.slice(i + SEP.length) : text;
}

function checkFile(file) {
  const hits = [];
  const body = bodyOf(readFileSync(file, 'utf8'));
  body.split(/\r?\n/).forEach((line, n) => {
    const code = line.trim();
    if (!code) return;
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
    if (!SQL_KW.test(code)) return;
    if (CONCAT.test(code) || CONCAT2.test(code) || INTERP.test(code)) {
      hits.push({ file, line: n + 1, code });
    }
  });
  return hits;
}

const args = process.argv.slice(2);
let targets = args;
if (!targets.length) {
  targets = ['src/magic-api', 'data/magic-api', 'data/zh/magic-api', 'data/en/magic-api'].filter(existsSync);
}
if (!targets.length) {
  console.error('sql-check: 没有找到要扫描的目录（默认 src/magic-api、data/zh|en/magic-api）');
  process.exit(2);
}

const files = [];
for (const t of targets) {
  const p = resolve(t);
  if (!existsSync(p)) { console.error(`sql-check: 路径不存在 ${t}`); process.exit(2); }
  walk(p, files);
}

let total = 0;
for (const f of files) {
  for (const h of checkFile(f)) {
    total++;
    console.error(`${h.file}:${h.line}: ERROR unsafe SQL concatenation`);
    console.error(`    ${h.code}`);
  }
}

if (total) {
  console.error(`\nsql-check: ${total} 处不安全 SQL（${files.length} 个 .ms）`);
  console.error('修复：用 #{param} 参数化、?{cond, ...} 做动态条件；禁止 "..." + var 与 ${...}。');
  process.exit(1);
}
console.log(`sql-check: OK（${files.length} 个 .ms）`);
