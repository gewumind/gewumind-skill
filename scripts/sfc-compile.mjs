#!/usr/bin/env node
/**
 * sfc-compile.mjs — 把 src/pages/{name}.vue 编译成 sys_dynamic_component INSERT SQL
 *
 * 用法：
 *   node sfc-compile.mjs <project-root> --group <name> [remark]
 *       生成 L1 顶级分组（pid='0'，空组件），写 src/sql/sfc/{name}.sql（已存在则跳过）
 *
 *   node sfc-compile.mjs <project-root> <name> [--parent <name>] [remark]
 *       编译 src/pages/{name}.vue → 追加 INSERT 到 src/sql/sfc/{name}.sql
 *
 *   node sfc-compile.mjs <project-root> --uuid <name>
 *       打印 nameToUuid(name)，退出
 *
 * 依赖：@vue/compiler-sfc、@babel/parser（从上级目录 node_modules 解析）
 * 逻辑对齐 ai-design-frontend/src/core/sfc-compiler.ts + llm/tools/index.ts 的 nameToUuid。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as SFCCompiler from '@vue/compiler-sfc'
import { parse as babelParse } from '@babel/parser'

const COMP_IDENTIFIER = `__sfc__`

/** 由 name 派生稳定的 32 位 hex（djb2 4 轮加盐扩展；与 IDE nameToUuid 完全一致） */
export function nameToUuid(name) {
  let h1 = 5381 >>> 0
  let h2 = 52711 >>> 0
  let h3 = 2654435761 >>> 0
  let h4 = 2246822519 >>> 0
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i)
    h1 = ((h1 << 5) + h1 + c) >>> 0
    h2 = ((h2 * 31) ^ c) >>> 0
    h3 = ((h3 ^ (h3 << 13)) + c) >>> 0
    h4 = ((h4 + ((h4 << 3) ^ c)) ^ (h4 >>> 16)) >>> 0
  }
  const a = h1.toString(16).padStart(8, '0')
  const b = h2.toString(16).padStart(8, '0')
  const c3 = h3.toString(16).padStart(8, '0')
  const d = h4.toString(16).padStart(8, '0')
  return (a + b + c3 + d).slice(0, 32)
}

/** SFC 源码 → { compileJs, compileCss } 或 { error }（对齐 core/sfc-compiler.ts） */
export function compileCode(sourceCode) {
  const compiled = { js: '', css: '', errors: [] }
  compileFile(sourceCode, compiled)
  if (compiled.errors.length) {
    return { compileJs: '', compileCss: '', error: String(compiled.errors[0]) }
  }

  let jsCode = compiled.js
  const ast = babelParse(jsCode, { sourceType: 'module' })
  const replaceCode = (node, subCode) =>
    jsCode.substring(0, node.start) + subCode + jsCode.substring(node.end)

  for (let i = ast.program.body.length - 1; i >= 0; i--) {
    const node = ast.program.body[i]
    if (node.type === 'ImportDeclaration') {
      jsCode = replaceCode(
        node,
        node.specifiers
          .map(it =>
            `const ${it.local?.name || it.imported?.name || '*'} = ___magic__import__('${node.source.value}', '${it.imported?.name || '*'}');`
          )
          .join('\r\n')
      )
    } else if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration
      jsCode = replaceCode(node, `return ${decl.name || decl.id?.name || '__sfc__'}`)
    }
  }

  return { compileJs: jsCode, compileCss: compiled.css }
}

function compileFile(code, compiled) {
  const id = crypto.randomUUID()
  const filename = `${id}.vue`
  const { errors, descriptor } = SFCCompiler.parse(code, { filename, sourceMap: true })
  if (errors.length) {
    compiled.errors = errors
    return
  }
  if (hasVueCompositionFunctions(code) && !hasScriptSetup(code)) {
    compiled.errors = ['defineProps、defineExpose、defineEmits、defineSlots、defineOptions、defineModel需要在<script setup>下使用']
    return
  }
  if (
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang) ||
    (descriptor.template && descriptor.template.lang)
  ) {
    compiled.errors = ['lang="x" pre-processors are not supported.']
    return
  }

  const hasScoped = descriptor.styles.some(s => s.scoped)
  let clientCode = ''

  const clientScriptResult = doCompileScript(descriptor, id, compiled)
  if (!clientScriptResult) return
  const [clientScript, bindings] = clientScriptResult
  clientCode += clientScript

  if (descriptor.template && !descriptor.scriptSetup) {
    const clientTemplateResult = doCompileTemplate(descriptor, id, bindings, compiled)
    if (!clientTemplateResult) return
    clientCode += clientTemplateResult
  }

  if (hasScoped) {
    clientCode += `\n${COMP_IDENTIFIER}.__scopeId = ${JSON.stringify(`data-v-${id}`)}`
  }
  if (clientCode) {
    clientCode += `\n${COMP_IDENTIFIER}.__file = ${JSON.stringify(filename)}` + `\nexport default ${COMP_IDENTIFIER}`
    compiled.js = clientCode.trimStart()
  }

  let css = ''
  for (const style of descriptor.styles) {
    const styleResult = SFCCompiler.compileStyle({
      source: style.content,
      filename,
      id,
      scoped: style.scoped,
    })
    if (!styleResult.errors.length) css += styleResult.code + '\n'
  }
  compiled.css = css.trim() || '/* No <style> tags present */'
  compiled.errors = []
}

function doCompileScript(descriptor, id, compiled) {
  if (descriptor.script || descriptor.scriptSetup) {
    try {
      const compiledScript = SFCCompiler.compileScript(descriptor, { id, inlineTemplate: true })
      let code = ''
      if (compiledScript.bindings) {
        code += `\n/* Analyzed bindings: ${JSON.stringify(compiledScript.bindings, null, 2)} */`
      }
      code += '\n' + SFCCompiler.rewriteDefault(compiledScript.content, COMP_IDENTIFIER)
      return [code, compiledScript.bindings]
    } catch (e) {
      compiled.errors = [e]
      return undefined
    }
  }
  return [`\nconst ${COMP_IDENTIFIER} = {}`, undefined]
}

function doCompileTemplate(descriptor, id, bindingMetadata, compiled) {
  const templateResult = SFCCompiler.compileTemplate({
    source: descriptor.template && descriptor.template.content,
    filename: descriptor.filename,
    id,
    scoped: descriptor.styles.some(s => s.scoped),
    slotted: descriptor.slotted,
    isProd: false,
    compilerOptions: { bindingMetadata },
  })
  if (templateResult.errors.length) {
    compiled.errors = templateResult.errors
    return undefined
  }
  const fnName = 'render'
  return (
    `\n${templateResult.code.replace(/\nexport (function|const) (render|ssrRender)/, `$1 ${fnName}`)}` +
    `\n${COMP_IDENTIFIER}.${fnName} = ${fnName}`
  )
}

function hasVueCompositionFunctions(content) {
  return /defineExpose\s*|defineProps\s*|defineEmits\s*/.test(content)
}
function hasScriptSetup(content) {
  return /<script\s+setup[^>]*>/.test(content)
}

const esc = s => String(s ?? '').replace(/'/g, "''")

// ==================== CLI ====================
const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('用法: sfc-compile.mjs <project-root> (--group <name> [remark] | <name> [--parent <name>] [remark] | --uuid <name>)')
  process.exit(1)
}
const ROOT = resolve(args[0])
const rest = args.slice(1)

function writeSql(sqlPath, insertSql, { skipIfExists = false } = {}) {
  if (existsSync(sqlPath)) {
    if (skipIfExists) return { skipped: true, path: sqlPath }
    const existing = readFileSync(sqlPath, 'utf-8')
    writeFileSync(sqlPath, existing.trimEnd() + '\n\n' + insertSql + '\n')
    return { appended: true, path: sqlPath }
  }
  mkdirSync(join(ROOT, 'src/sql/sfc'), { recursive: true })
  writeFileSync(sqlPath, insertSql + '\n')
  return { created: true, path: sqlPath }
}

if (rest[0] === '--uuid') {
  console.log(nameToUuid(rest[1]))
  process.exit(0)
}

if (rest[0] === '--group') {
  const name = rest[1]
  const remark = rest[2] || ''
  if (!name || !/^[a-zA-Z0-9\-_]+$/.test(name)) {
    console.error(`name "${name}" 只能包含大小写英文、数字和-_`)
    process.exit(1)
  }
  const id = nameToUuid(name)
  const sqlPath = join(ROOT, 'src/sql/sfc', `${name}.sql`)
  const insertSql =
    `INSERT INTO sys_dynamic_component (id, pid, name, source_code, compile_js, compile_css, type, remark, is_del, create_by, create_date)\n` +
    `VALUES ('${id}', '0', '${name}', '', '', '', 0, '${esc(remark)}', 0, NULL, NOW());`
  const r = writeSql(sqlPath, insertSql, { skipIfExists: true })
  console.log(JSON.stringify({ name, id, ...r }, null, 2))
  process.exit(r.skipped ? 0 : 0)
}

// 组件模式
const name = rest[0]
let parent = ''
let remark = ''
for (let i = 1; i < rest.length; i++) {
  if (rest[i] === '--parent') { parent = rest[++i] || '' } else { remark = rest[i] }
}
if (!name || !/^[a-zA-Z0-9\-_]+$/.test(name)) {
  console.error(`name "${name}" 只能包含大小写英文、数字和-_`)
  process.exit(1)
}
if (parent && !/^[a-zA-Z0-9\-_]+$/.test(parent)) {
  console.error(`parent "${parent}" 只能包含大小写英文、数字和-_`)
  process.exit(1)
}
const vuePath = join(ROOT, 'src/pages', `${name}.vue`)
if (!existsSync(vuePath)) {
  console.error(`找不到 ${vuePath}。请先把 .vue 写到 src/pages/。`)
  process.exit(1)
}
const vueSource = readFileSync(vuePath, 'utf-8')
const result = compileCode(vueSource)
if (result.error) {
  console.error(`SFC 编译失败: ${result.error}`)
  process.exit(1)
}
const id = nameToUuid(name)
const pid = parent ? `'${nameToUuid(parent)}'` : `'0'`
const insertSql =
  `INSERT INTO sys_dynamic_component (id, pid, name, source_code, compile_js, compile_css, type, remark, is_del, create_by, create_date)\n` +
  `VALUES ('${id}', ${pid}, '${name}', '${esc(vueSource)}', '${esc(result.compileJs)}', '${esc(result.compileCss)}', 0, '${esc(remark)}', 0, NULL, NOW());`
const r = writeSql(join(ROOT, 'src/sql/sfc', `${name}.sql`), insertSql)
console.log(JSON.stringify({ name, id, parent: parent || null, pid, jsBytes: result.compileJs.length, cssBytes: result.compileCss.length, ...r }, null, 2))
