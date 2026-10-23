#!/usr/bin/env node
/**
 * ms-component.mjs — 把 .vue 编译成 GewuMind Boot 的 .ms 组件页面
 *
 * 产物：
 *   <out>/<group>/group.json
 *   <out>/<group>/<name>.ms   （meta JSON + \r\n 32个= \r\n + Vue SFC 源码）
 *
 * 用法：
 *   node scripts/ms-component.mjs \
 *     --vue src/pages/device-list.vue \
 *     --group 设备管理 --group-path /device \
 *     --name 设备列表 --path /list \
 *     [--out src/magic-api/component] [--publish]
 *
 * --publish 只输出 bundle_apply 需要的 JSON（kind=component + metaJson），不写本地文件。
 * 输出菜单 url = group-path + path（如 /device/list）。
 * 依赖：@vue/compiler-sfc、@babel/parser（与 sfc-compile.mjs 相同）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { nameToUuid, compileCode } from './sfc-compile.mjs';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const vue = arg('vue');
const update = arg('update');
const group = arg('group');
const groupPath = arg('group-path');
const name = arg('name');
const path = arg('path');
const out = resolve(arg('out', 'src/magic-api/component'));

// 更新已有 .ms：保留 id/groupId/name/path，只替换 SFC 与 compileJs/Css
if (update) {
  const msPath = resolve(update);
  if (!existsSync(msPath)) { console.error('找不到 ' + msPath); process.exit(1); }
  const SEP = '='.repeat(32);
  const raw = readFileSync(msPath, 'utf8');
  const i = raw.indexOf(SEP);
  if (i < 0) { console.error('.ms 缺少分隔符'); process.exit(1); }
  const meta = JSON.parse(raw.slice(0, i));
  const oldBody = raw.slice(i + SEP.length).replace(/^\r?\n/, '');
  const source = vue ? readFileSync(vue, 'utf8') : oldBody;
  const { compileJs, compileCss, error } = compileCode(source);
  if (error) { console.error('SFC 编译失败: ' + error); process.exit(1); }
  meta.properties = meta.properties || {};
  meta.properties.compileJs = compileJs;
  meta.properties.compileCss = compileCss;
  meta.compileJs = compileJs;
  meta.compileCss = compileCss;
  writeFileSync(msPath, JSON.stringify(meta, null, 2) + '\r\n' + SEP + '\r\n' + source);
  console.log(JSON.stringify({ updated: msPath, name: meta.name, path: meta.path, jsBytes: compileJs.length, cssBytes: compileCss.length }, null, 2));
  process.exit(0);
}

if (!vue || !group || !groupPath || !name || !path) {
  console.error('用法: node scripts/ms-component.mjs --vue <file.vue> --group <中文组> --group-path </device> --name <页面名> --path </list> [--out <dir>]');
  process.exit(1);
}
if (!groupPath.startsWith('/') || !path.startsWith('/')) {
  console.error('--group-path 与 --path 必须以 / 开头');
  process.exit(1);
}

const source = readFileSync(vue, 'utf8');
const { compileJs, compileCss, error } = compileCode(source);
if (error) {
  console.error('SFC 编译失败: ' + error);
  process.exit(1);
}

const gid = nameToUuid(group);
const cid = nameToUuid(group + '/' + name);

const meta = {
  properties: { type: 1, remark: null, entryApi: null, group: null, compileJs, compileCss },
  id: cid,
  script: null,
  groupId: gid,
  name,
  createTime: Date.now(),
  updateTime: null,
  lock: null,
  createBy: null,
  updateBy: null,
  path,
  type: 1,
  remark: null,
  entryApi: null,
  compileJs,
  compileCss,
  group: null,
};

if (process.argv.includes('--publish')) {
  console.log(JSON.stringify({
    menuUrl: groupPath + path,
    ms: [{
      group,
      groupPath,
      name,
      path,
      kind: 'component',
      script: source,
      metaJson: JSON.stringify(meta),
    }],
  }, null, 2));
  process.exit(0);
}

const gdir = join(out, group);
mkdirSync(gdir, { recursive: true });

const gj = join(gdir, 'group.json');
if (!existsSync(gj)) {
  writeFileSync(gj, JSON.stringify({
    properties: {}, id: gid, name: group, type: 'component',
    parentId: '0', path: groupPath, paths: [], options: [],
  }, null, 2));
}

const SEP = '='.repeat(32);
const content = JSON.stringify(meta, null, 2) + '\r\n' + SEP + '\r\n' + source;
const msFile = join(gdir, name + '.ms');
writeFileSync(msFile, content);

console.log(JSON.stringify({
  ms: msFile,
  group: gdir,
  menuUrl: groupPath + path,
  groupId: gid,
  componentId: cid,
  jsBytes: compileJs.length,
  cssBytes: compileCss.length,
}, null, 2));
