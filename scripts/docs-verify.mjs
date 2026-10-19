#!/usr/bin/env node
/**
 * docs-verify.mjs — GewuMind Boot 四文档校验器（skill 版）
 *
 * 从 GewuMind IDE 的 src/llm/docsValidator.ts 整体移植（IDE 里是 validateDocs 工具，
 * agent 环境没有这个工具，本脚本就是它的替代）。
 * 对照 knowledge/gewumind-boot/19a~19e 的 4 份文档规范校验 docs/ 下的文档：
 * 输出每个文件的 issues 列表 + score（0-100）+ 跨文档一致性检查。
 *
 * 用法：
 *   node scripts/docs-verify.mjs <project-root> [options]
 *
 *   <project-root>   项目工作区目录（包含 docs/ 的那一层）
 *   --role <r>       只校验一份：requirement | ui | database | api | all（默认 all，只查已存在的文件）
 *   --fix            程序化自动修复（就地写回，然后重新校验）。只修可确定性转换的
 *                    格式问题（表格格式/缺段/非法类型）；内容层面问题仍需 AI 重写
 *   --strict         warn 也按失败处理（exit 1）
 *   --json           输出 JSON（供机器解析，不打印人类可读报告）
 *
 * 退出码：0 = 无 error（warn 允许）   1 = 有 error   2 = 用法/文件缺失错误
 *
 * 与 IDE 版的差异（修正 IDE 已知 bug，规则本身 1:1 保留）：
 *   1. api §1 路径树校验跳过表头行——IDE 版会把规范里的标准表头
 *      `| 左侧：Magic-API 显示路径 | 右侧：... |` 误判为格式 B 违规
 *   2. JS 不支持 `\Z`（被当成字面量 Z），requirement §4/§5 区段提取改用 `$`
 *   3. requirement 列数提示文案 typo：「数据字典=4」→ 3（规范为 3 列）
 *   4. 删除 IDE 死代码（autoFixApi 的 §1 转换块从未生效；未使用的 tokens/kebab 助手）
 *   5. 字符串替换改用 function replacement，避免文档内容里的 `$&`/`$'` 被当替换模式
 *   6. database 5 列护栏跳过「修订记录」节——19a 规定四份 docs 都要有 3 列修订记录表，
 *      IDE 版会把 database.md 的修订记录误报为「列数不是 5」
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ============== 通用助手 ==============

const HEADING_RE = /^(#{1,3})\s+(.+?)$/gm

function extractHeadings(content) {
  const out = []
  let m
  HEADING_RE.lastIndex = 0
  while ((m = HEADING_RE.exec(content))) {
    out.push(m[2].trim())
  }
  return out
}

function extractMenuPathsFromUi(ui) {
  const out = []
  for (const line of ui.split('\n')) {
    // 匹配 `(/device-management)` 或 `(/device-registration ...)` 形式
    const m = line.match(/\(\s*(\/[a-z][a-z0-9-]*)/)
    if (m) out.push(m[1])
  }
  return out
}

function extractPathSegmentsFromApi(api) {
  const out = []
  let inSec1 = false
  for (const line of api.split('\n')) {
    if (/^##\s+1\./.test(line)) { inSec1 = true; continue }
    if (inSec1 && /^##\s+\d+\.\s/.test(line)) break
    if (!inSec1) continue
    // 旧格式：路径段映射平铺表 / | 中文名 | /xxx |
    if (line.trim().startsWith('|') && /\|\s*\/[a-z]/.test(line)) {
      const m = line.match(/\|\s*(\/[a-z][a-z0-9-]*)\s*\|/)
      if (m) out.push(m[1])
      continue
    }
    // 新格式A：| `api/<dir>/` | `name: "...", path: "/<dir>/<path>"` |
    const m2 = line.match(/`api\/([^`\/]+)\/[^`]*`\s*\|\s*`name:\s*"[^"]+",\s*path:\s*"([^"]+)"`/)
    if (m2 && m2[2].startsWith('/')) {
      out.push(m2[2])
    }
  }
  return out
}

function extractTablesFromDatabase(db) {
  const out = []
  for (const h of extractHeadings(db)) {
    // 形如 "1. 设备表 (t_device)" 或 "## 1.1 设备表 (t_device)"
    const m = h.match(/\((t_[a-z0-9_]+)\)/i) || h.match(/(t_[a-z0-9_]+)/)
    if (m) out.push(m[1])
  }
  return out
}

// ============== requirement 校验 ==============

/**
 * requirement.md 各节允许的表格列数（按节标题子串匹配）
 * 来自 skill 19b-docs-requirement.md §1 模板
 */
const REQ_TABLE_COLS = [
  { sectionKeyword: /修订记录/, expectedCols: 3, description: '日期/版本/变更说明' },
  { sectionKeyword: /组织机构/, expectedCols: 4, description: '层级/实体/type/示例' },
  { sectionKeyword: /用户角色/, expectedCols: 5, description: '角色编码/角色名/描述/主要操作/所属组织层级' },
  { sectionKeyword: /功能模块清单/, expectedCols: 6, description: '编码/中文名/英文路径/页面类型/父模块/权限段' },
  { sectionKeyword: /数据字典/, expectedCols: 3, description: '字典编码/中文名/枚举值' },
  { sectionKeyword: /权限模型/, expectedCols: 2, description: '角色/拥有权限' },
]

function validateRequirement(content) {
  const issues = []
  if (!content.trim()) {
    return { role: 'requirement', file: 'requirement.md', issues: [{ level: 'error', msg: '文件为空', fix: '补充需求内容' }], score: 0 }
  }

  // 硬护栏：每节表格列数必须是 skill 里规定的固定列数
  // 只检查 ## N. 顶级节下的**第一个**表格（MQTT 子表、字段清单子表等子表不在此范围）
  const sectionColViolations = []
  let currentSection = ''
  let tableCountInSection = 0
  for (const line of content.split('\n')) {
    // 顶级 ## N. 标题
    const headingMatch = line.match(/^##\s*\d+\.\s+(.+)/)
    if (headingMatch) {
      currentSection = headingMatch[1].trim()
      tableCountInSection = 0
      continue
    }
    // 子 ### 标题 → 重置计数（子节不查列数）
    if (line.match(/^###\s+\d+\.\d+/)) {
      tableCountInSection = 99
      continue
    }
    if (!currentSection) continue
    if (!/^\|/.test(line)) continue
    const cells = line.split('|').map(s => s.trim()).filter(s => s)
    if (cells.length < 1) continue
    if (/^[-:]+$/.test(cells[0])) continue
    // 排除表头行
    if (['日期', '层级', '角色编码', '编码', '字典编码', '角色'].includes(cells[0])) continue
    tableCountInSection++
    if (tableCountInSection > 1) continue  // 只查节里第一个表格
    // 找当前节对应的列数要求
    const rule = REQ_TABLE_COLS.find(r => r.sectionKeyword.test(currentSection))
    if (rule && cells.length !== rule.expectedCols) {
      sectionColViolations.push(`§${currentSection} 表格一行有 ${cells.length} 列（应为 ${rule.expectedCols} 列：${rule.description}）`)
    }
  }
  if (sectionColViolations.length > 0) {
    issues.push({
      level: 'error',
      msg: `${sectionColViolations.length} 行 requirement.md 表格列数不符合 skill 规范：` + sectionColViolations.slice(0, 3).join('; '),
      fix: '每节表格必须用 skill 19b-docs-requirement.md §1 规定的固定列数（修订记录=3, 组织机构=4, 用户角色=5, 功能模块清单=6, 数据字典=3, 权限模型=2）',
    })
  }
  if (!/##\s*1\.\s*业务背景|#\s*业务背景|##\s*1\s+业务背景/i.test(content) && !/业务背景|项目背景|需求背景/.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§1 业务背景」', fix: '加 ## 1. 业务背景，描述 why + 痛点' })
  }
  if (!/##\s*2\.\s*组织机构|##\s*2\s*组织机构|组织(机构|层级|架构|树)/i.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§2 组织机构」', fix: '加 ## 2. 组织机构：定义组织层级（集团/公司/场站/车队/线路/班组）及其归属关系' })
  }
  // §3 用户角色
  if (!/##\s*3\.\s*用户角色|##\s*3\s+用户角色|用户角色|角色|admin/i.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§3 用户角色」', fix: '加 ## 3. 用户角色（admin / operator / viewer ...）' })
  }
  // §4 功能模块清单（菜单结构草图）— ui.md 菜单树的依据
  if (!/##\s*4\.\s*功能模块|##\s*4\s*功能模块|功能模块清单|模块清单|菜单结构/i.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§4 功能模块清单」', fix: '加 ## 4. 功能模块清单：列出每个模块的「中文名 / 英文路径 / 页面类型 / 父模块 / 权限段」（ui.md 菜单树的依据）' })
  } else {
    // 检查表格里是否有英文路径段（kebab-case）
    // 注意：原 IDE 用 `\Z`（JS 里是字面量 Z，节末无 ## / --- 时整体不匹配），这里改为 `$`
    const moduleTable = content.match(/##\s*4\.[^\n]*\n([\s\S]*?)(?=\n##\s|\n---|$)/)
    if (moduleTable && !/\/[a-z][a-z0-9-]+/.test(moduleTable[1])) {
      issues.push({ level: 'error', msg: '§4 功能模块清单里没有英文路径段（kebab-case）', fix: '表格必须含 `/kebab-case` 英文路径（会出现在 ui.md 菜单和 api.md 路径里）' })
    }
  }
  // §5 业务用例（每个功能模块一个用例，含字段清单/按钮/权限）
  if (!/##\s*5\.\s*业务用例|##\s*5\s*业务用例|业务用例|用例|用户故事/i.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§5 业务用例」', fix: '加 ## 5. 业务用例：每个模块一个用例，含「字段清单/按钮/权限/查询条件/展示列」' })
  } else {
    const useCaseBody = content.match(/##\s*5\.[\s\S]*?(?=\n##\s|$)/)
    if (useCaseBody) {
      const uc = useCaseBody[0]
      if (!/\*\*字段清单\*\*/.test(uc) && !/字段清单/.test(uc)) {
        issues.push({ level: 'warn', msg: '§5 业务用例缺少「字段清单」段（ui.md 字段表 / database.md 表结构的依据）', fix: '每个用例加「字段清单」段：字段名 · 类型 · 必填 · 唯一 · 说明' })
      }
      if (!/\*\*按钮\*\*/.test(uc)) {
        issues.push({ level: 'warn', msg: '§5 业务用例缺少「**按钮**」段', fix: '每个用例加「按钮」段：新增 / 编辑 / 删除 / 导出 / 自定义按钮' })
      }
      if (!/\*\*权限\*\*/.test(uc) && !/权限[:：]/.test(uc)) {
        issues.push({ level: 'warn', msg: '§5 业务用例缺少「**权限**」段', fix: '每个用例加「权限」段：`module:action` 形式' })
      }
      if (!/\*\*列表查询条件\*\*/.test(uc) && !/列表查询条件|查询条件/.test(uc)) {
        issues.push({ level: 'warn', msg: '§5 业务用例缺少「列表查询条件」', fix: '每个列表型用例加「查询条件」段：字段名 + 匹配方式（模糊/精确/范围）' })
      }
    }
  }
  // §6 数据字典
  if (!/##\s*6\.\s*数据字典|##\s*6\s*数据字典|数据字典|字典编码|枚举值/.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§6 数据字典」', fix: '加 ## 6. 数据字典：列出所有枚举值（database.md dict 字段、ui.md select options 的依据）' })
  }
  // §7 权限模型
  if (!/##\s*7\.\s*权限模型|##\s*7\s+权限模型|权限模型|权限矩阵|角色权限|权限码|权限段/i.test(content)) {
    issues.push({ level: 'error', msg: '缺少「§7 权限模型」', fix: '加 ## 7. 权限模型：角色 → 权限码 映射（api.md 权限码段、ui.md 按钮可见性的依据）' })
  }
  // 越界检查
  if (/\bt_[a-z_]+\s*\(.*\)/.test(content) || /sys_[a-z_]+/.test(content)) {
    issues.push({ level: 'warn', msg: '出现表名（如 t_xxx / sys_xxx），表结构应写进 database.md', fix: '改为业务描述，如「需要记录用户登录账号和密码」' })
  }
  if (/POST\s*\/[a-z]/i.test(content) || /GET\s*\/[a-z]/i.test(content)) {
    issues.push({ level: 'warn', msg: '出现 API 路径（如 POST /xxx），API 应写进 api.md', fix: '改为业务描述，如「用户提交后保存到数据库」' })
  }
  return scoreIt('requirement', 'requirement.md', issues)
}

// ============== ui 校验 ==============

function validateUi(content) {
  const issues = []
  if (!content.trim()) {
    return { role: 'ui', file: 'ui.md', issues: [{ level: 'error', msg: '文件为空', fix: '补充界面设计' }], score: 0 }
  }
  if (!/##\s*〇|菜单树|页面|##\s*0\./.test(content)) {
    issues.push({ level: 'error', msg: '缺少「菜单树」章节', fix: '加 ## 菜单树（含英文段 /kebab-case）' })
  }
  if (!/\*\*字段\*\*/.test(content) && !/\|.*字段.*\|/.test(content)) {
    issues.push({ level: 'warn', msg: '页面章节缺少「**字段**」表格', fix: '每个页面加字段表（字段/类型/必填/说明）' })
  }
  // 硬护栏：每个字段表必须用 4 列（字段/类型/必填/说明）。任何 5+ 列或 3- 列都报错
  const uiFieldRowRE = /^\|\s*([a-zA-Z_]\w*)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/
  const wrongUiColCountViolations = []
  for (const line of content.split('\n')) {
    // 必须字段/类型/必填/说明 4 列都存在才算字段表行
    if (!uiFieldRowRE.test(line)) continue
    const allCells = line.match(/^\|(.+)\|$/)
    if (!allCells) continue
    const cells = allCells[1].split('|').map(s => s.trim()).filter(s => s)
    // 排除表头
    if (cells[0] === '字段') continue
    if (cells.length !== 4) {
      wrongUiColCountViolations.push(`一行有 ${cells.length} 列（应为 4 列：字段/类型/必填/说明）: ${line.slice(0, 80)}`)
    }
  }
  if (wrongUiColCountViolations.length > 0) {
    issues.push({
      level: 'error',
      msg: `${wrongUiColCountViolations.length} 行字段表列数不是 4：` + wrongUiColCountViolations.slice(0, 3).join('; '),
      fix: '每个页面的字段表必须用 4 列固定格式：| 字段 | 类型 | 必填 | 说明 |。禁止 5+ 列（含默认值、字典等多余列）或 3- 列简化。',
    })
  }
  if (!/\*\*权限\*\*/.test(content) && !/权限[:：]/.test(content)) {
    issues.push({ level: 'warn', msg: '页面章节缺少「**权限**」', fix: '每个页面标注权限码（device:list / device:save）' })
  }
  if (!/\*\*按钮\*\*/.test(content) && !/操作流|操作步骤/.test(content)) {
    issues.push({ level: 'warn', msg: '页面章节缺少「**按钮**」或「**操作流**」', fix: '列出页面所有按钮 + 操作步骤' })
  }
  // 检查 ASCII 线框图（19c-docs-ui.md §5）
  // 用 plain text 代码块（不带语言标识）画 ┌ ┐ │ ─ 框；不强制每页都有
  const pageSections = content.match(/^###\s+\d+\.\d+/gm) || []
  if (pageSections.length > 0) {
    // 统计 ``` plain code blocks 数量（不包含带语言标识的）
    const codeBlocks = content.match(/^```\s*$/gm) || []
    // 配对计算 code block 数（每对 = 1 个代码块）
    const codeBlockCount = Math.floor(codeBlocks.length / 2)
    if (codeBlockCount < pageSections.length / 2) {
      issues.push({
        level: 'warn',
        msg: `${pageSections.length} 个页面，ASCII 线框图似乎偏少（${codeBlockCount} 个代码块）`,
        fix: '每个页面段后加 ``` 代码块，用 ┌ ┐ │ ─ 画框（搜索/表格/按钮/分页/弹窗布局）',
      })
    }
  }
  return scoreIt('ui', 'ui.md', issues)
}

// ============== database 校验 ==============

function validateDatabase(content) {
  const issues = []
  if (!content.trim()) {
    return { role: 'database', file: 'database.md', issues: [{ level: 'error', msg: '文件为空', fix: '补充数据库设计' }], score: 0 }
  }
  if (!/varchar\(36\)|uuid|UUID/i.test(content)) {
    issues.push({ level: 'warn', msg: 'id 字段类型未声明', fix: '所有表 id 用 `varchar(36) PK（UUID 去连字符）`' })
  }

  // 硬护栏：必填列只能填"是/否"，不准用 PK/Y/N/必填 等
  const fieldRowRegex = /^\|\s*([\w_]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/
  const requiredColViolations = []
  const wrongColCountViolations = []
  const linesArr = content.split('\n')
  let inDictSection = false
  let inRevisionSection = false  // skill 版修正：修订记录是 3 列表，不属于字段表
  for (const line of linesArr) {
    if (/^##[^#]*数据字典/.test(line)) { inDictSection = true; inRevisionSection = false; continue }
    if (/^##\s/.test(line)) inRevisionSection = /修订记录/.test(line)
    if (inRevisionSection) continue
    const m = line.match(fieldRowRegex)
    if (m) {
      const required = m[3].trim()
      if (required && required !== '是' && required !== '否' && required !== 'PK' && required !== '-') {
        requiredColViolations.push(`字段 ${m[1].trim()} 必填列写了"${required}"，必须填"是"或"否"`)
      }
    }
    // 硬护栏：每张表必须用 5 列（字段/类型/必填/默认/说明）。任何 6+ 列或 3- 列都报错
    if (inDictSection) continue
    const allCells = line.match(/^\|(.+)\|$/)
    if (allCells) {
      const cells = allCells[1].split('|').map(s => s.trim())
      if (cells.length >= 1 && cells.length !== 5) {
        // 排除表头、索引节、非字段表行
        const isFieldHeader = cells[0] === '字段' && cells.length >= 4
        const isSeparator = cells[0].startsWith('-') || cells[0].startsWith(':')
        if (!isFieldHeader && !isSeparator) {
          wrongColCountViolations.push(`一行有 ${cells.length} 列（应为 5 列：字段/类型/必填/默认/说明）: ${line.slice(0, 80)}`)
        }
      }
    }
  }
  if (requiredColViolations.length > 0) {
    issues.push({
      level: 'error',
      msg: `${requiredColViolations.length} 个字段必填列不规范：` + requiredColViolations.slice(0, 3).join('; '),
      fix: '必填列必须填"是"或"否"——不准用 PK/Y/N/必填 等其他词（PK 写在类型列如 varchar(36) PK）',
    })
  }
  if (wrongColCountViolations.length > 0) {
    issues.push({
      level: 'error',
      msg: `${wrongColCountViolations.length} 行字段表列数不是 5：` + wrongColCountViolations.slice(0, 3).join('; '),
      fix: '每张业务表的字段表必须用 5 列固定格式：| 字段 | 类型 | 必填 | 默认 | 说明 |。禁止 6+ 列（含字典、备注等多余列）或 3- 列简化写法。',
    })
  }
  const tables = extractTablesFromDatabase(content)
  if (tables.length === 0) {
    issues.push({ level: 'error', msg: '未检测到业务表（t_xxx）', fix: '每张业务表用 `## N. 表名 (t_xxx)` 格式' })
  }
  // 检查每张表是否包含公共字段
  const COMMON_FIELDS = ['is_del', 'create_by', 'create_date', 'update_by', 'update_date']
  for (const table of tables) {
    // 提取该表的字段区域（从表标题到下一个表标题或文件结尾）
    const tableRegex = new RegExp(`\\(?(?:${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\)?[\\s\\S]*?(?=##\\s*\\d|$)`, 'i')
    const tableMatch = content.match(tableRegex)
    if (!tableMatch) continue
    const tableSection = tableMatch[0]
    for (const field of COMMON_FIELDS) {
      if (!tableSection.includes(field)) {
        issues.push({ level: 'error', msg: `表 ${table} 缺少公共字段 \`${field}\``, fix: `在 ${table} 表定义中加 \`${field}\` 字段` })
      }
    }
  }
  if (!/\bdict:\s*[a-z_]+/i.test(content) && !/字典[:：]/.test(content)) {
    issues.push({ level: 'warn', msg: '未标注字典关联', fix: '枚举字段加 `dict: type_name` 标记' })
  }
  // 检查数据字典清单节（19d-docs-database.md §3）
  const dictSectionMatch = content.match(/(?<=^|\n)##\s*数据字典清单[\s\S]*?(?=\n##\s|$)/)
  if (!dictSectionMatch && !/数据字典(清单|映射|集合|表)/.test(content)) {
    issues.push({ level: 'error', msg: '缺少「数据字典清单」节', fix: 'database.md 末尾加 `## 数据字典清单`，用 3 列表格（| 字典编码 | 中文名 | 枚举值 |）列出所有 dict 编码及其枚举值' })
  } else if (dictSectionMatch) {
    const sectionLines = dictSectionMatch[0].split('\n')
    let hasBullet = false
    let hasTable = false
    for (const line of sectionLines) {
      const t = line.trim()
      if (/^[-*]\s+\*\*[a-z_]/.test(t)) hasBullet = true
      if (/^\|\s*[a-z_]/.test(t) && t.endsWith('|')) hasTable = true
    }
    if (hasBullet && !hasTable) {
      issues.push({ level: 'error', msg: '数据字典清单节用了 bullet list（- **key**），必须用 3 列固定表格：| 字典编码 | 中文名 | 枚举值 |', fix: '将 bullet list 替换为 3 列表格，每行格式如 `| device_status | 设备状态 | 0=待激活, 1=在线 |`' })
    }
  }
  // ⚠️ 反模式：组织机构数据用 sys_office + sys_dict('org_type')，不要新建以下表
  // 3 类匹配：
  //   A. 明确已知的组织子类型（t_company / t_station / ...）
  //   B. 任何 t_*org* 形式（t_org / t_organization / t_org_unit）
  //   C. 业务前缀 + organizations（terminal_organizations / project_organizations ...）
  // 匹配时排除 sys_office（系统表本身）和 magic_*/sys_* 前缀
  const ORG_TABLE_PATTERNS = [
    { re: /\b(t_[a-z_]*(company|station|fleet|dept|team|branch|line|workshop|warehouse|office))\b/gi, label: 't_<org-type>' },
    { re: /\bt_[a-z_]*org[a-z_]*\b/gi, label: 't_*org*' },
    { re: /\b[a-z]+_organizations?\b/gi, label: '<prefix>_organizations' },
    { re: /\borganizations?\b/gi, label: 'organizations (any)' },
  ]
  const excludeRe = /\b(sys_office|magic_organization)/  // 系统表本身
  const orgHits = []
  for (const { re, label } of ORG_TABLE_PATTERNS) {
    let m
    re.lastIndex = 0
    while ((m = re.exec(content)) !== null) {
      const tableName = m[0]
      if (excludeRe.test(tableName)) continue
      orgHits.push({ table: tableName, pattern: label })
    }
  }
  if (orgHits.length > 0) {
    const unique = Array.from(new Map(orgHits.map(h => [h.table.toLowerCase(), h])).values())
    issues.push({
      level: 'error',
      msg: `组织机构数据应使用系统自带的 \`sys_office\` 表（用 \`pid\` 实现层级、\`type\` 字典区分类型），不要新建 ${unique.map(h => '`' + h.table + '`').join(' / ')}`,
      fix: `删除这些表，改用 sys_office。组织类型定义到 sys_dict (type='org_type')：company / station / fleet / branch / line / workshop / warehouse / dept / team`,
    })
  }
  return scoreIt('database', 'database.md', issues)
}

// ============== api 校验 ==============

// §1 路径树表头行（IDE autoFixApi 同款识别表，validateApi 校验时也跳过这些行——
// IDE 版 validateApi 没跳，会把规范里的标准表头误判为格式 B 违规）
const SEC1_HEADER_CELL = /左侧|右侧|^类型$|magic-api|^name$|^path$|^method$|^中文目录$|^英文路径$|^文件名$|^方法$|^说明$/

function validateApi(content) {
  const issues = []
  if (!content.trim()) {
    return { role: 'api', file: 'api.md', issues: [{ level: 'error', msg: '文件为空', fix: '补充 API 接口' }], score: 0 }
  }
  if (!/##\s*〇|路径(段映射|树)|权限码段/.test(content)) {
    issues.push({ level: 'error', msg: '缺少「路径段映射 / 路径树」章节', fix: '加 ## 1. 路径树（左边 Magic-API 路径 → 右边各层级 name / path）' })
  }
  if (!/\*?\*?path\*?\*?\s*[:：]/i.test(content)) {
    issues.push({ level: 'error', msg: 'API 端点缺少 `path:` 字段', fix: '每个 API 标注 `path: /xxx/xxx`' })
  }
  if (!/\*?\*?method\*?\*?\s*[:：]/i.test(content)) {
    issues.push({ level: 'error', msg: 'API 端点缺少 `method:` 字段', fix: '每个 API 标注 `method: GET|POST|DELETE`' })
  }
  if (!/\*?\*?权限\*?\*?\s*[:：]/i.test(content)) {
    issues.push({ level: 'warn', msg: 'API 端点缺少权限码', fix: '每个 API 加 `权限: module:action`' })
  }

  // 硬护栏：api.md §1 路径树只能两种格式
  // 找 §1 范围（## 1. 到下一个 ## N.）
  const lines = content.split('\n')
  let inSec1 = false
  let sec1HasTableRow = false
  let sec1InvalidFormat = false
  for (const line of lines) {
    if (/^##\s+1\./.test(line)) { inSec1 = true; continue }
    if (inSec1 && /^##\s+\d+\.\s/.test(line)) break
    if (!inSec1) continue
    // 跳过表头、分隔行、空行
    if (/^\|\s*[-:]+\s*\|/.test(line)) continue  // 分隔行
    if (/^\|\s*$/.test(line)) continue  // 空表行
    if (/^\s*$/.test(line)) continue
    // 找表格行
    const m = line.match(/^\|(.+)\|$/)
    if (!m) continue
    sec1HasTableRow = true
    const cells = m[1].split('|').map(s => s.trim()).filter(c => c)
    // 跳过表头行（skill 版修正：IDE 没跳，标准表头会被误报）
    if (SEC1_HEADER_CELL.test(cells[0] || '')) continue
    // ✅ 唯一允许的格式 A：左列含 `api/` 包围 + 必须是 2 列
    if (cells[0]?.includes('`api/')) {
      if (cells.length !== 2) {
        issues.push({ level: 'error', msg: `§1 路径树格式A 必须是 2 列（| \`api/目录/\` | \`name: "...", path: "/..."\` |），当前 ${cells.length} 列`, fix: '改为 2 列格式 A' })
      }
      continue
    }
    // ❌ 任何其他格式都被拒绝（包括 Format B/C 变体、含 dir/api/group 类型列等）
    sec1InvalidFormat = true
    issues.push({
      level: 'error',
      msg: `§1 路径树必须用唯一的左右对照 2 列格式 A（| \`api/目录/\` | \`name: "...", path: "/..."\` |）。当前行有 ${cells.length} 列，第 1 列="${cells[0] || ''}"，**严禁**用 5 列含 dir/api/group 类型列、含 METHOD 列、含说明列等任何变体。`,
      fix: '重写整个 §1 为格式 A：左列 `api/中文目录/`，右列 `name: "...", path: "/英文路径"`（参考 skill 19e-docs-api.md §1 示例）。validateDocs 会拒绝任何其他格式。',
    })
    break  // 找到第一个错就报，后续不需要继续扫
  }
  void sec1HasTableRow
  void sec1InvalidFormat

  // ========== 硬约束：函数/任务表必须用新格式 ==========
  // 函数表格硬校验：必须有 groupPath / name / path 列
  let funcTableFound = false
  let funcTableValid = false
  for (const line of content.split('\n')) {
    if (/^##\s*.*函数/.test(line)) funcTableFound = true
    if (funcTableFound && /^\|/.test(line)) {
      // 检测表头：必须含 "中文组名" + "groupPath" + "name" + "path"
      if (/\|\s*[^|]*中文组名[^|]*\|/.test(line) &&
          /\|\s*[^|]*groupPath[^|]*\|/.test(line) &&
          /\|\s*[^|]*name[^|]*\|/.test(line) &&
          /\|\s*[^|]*path[^|]*\|/.test(line)) {
        funcTableValid = true
        break
      }
      // 错误格式：列名不规范
      if (/\|\s*[^|]*函数名[^|]*\|/.test(line) || /^\|\s*name\s*\|/.test(line)) {
        // LLM 用了旧的"函数名"列名
        if (funcTableFound) {
          issues.push({
            level: 'error',
            msg: '函数表格用了旧格式（"函数名"列）。**必须**用新格式：`| 中文组名 | groupPath | name | path | 参数 | 返回 | 说明 |`（7 列），含 groupPath 列',
            fix: '删除当前函数表格，按 skill 19e-docs-api.md §6 示例重写为 7 列结构。所有函数/任务必须在一个表格里（不准每个函数单独 ### N.M 子节）',
          })
        }
      }
    }
  }
  if (funcTableFound && !funcTableValid) {
    // 已经发现错误不重复报
    if (!issues.some(i => i.msg.includes('函数表格'))) {
      issues.push({
        level: 'error',
        msg: '函数表格**不是**新格式。**必须**用 7 列表格：`| 中文组名 | groupPath | name | path | 参数 | 返回 | 说明 |`',
        fix: '重写 §函数 章节，按 skill 19e-docs-api.md §6 的固定格式',
      })
    }
  }

  // 任务表格硬校验：必须有 groupPath / name / path / cron 列
  let taskTableFound = false
  let taskTableValid = false
  for (const line of content.split('\n')) {
    if (/^##\s*.*定时任务/.test(line)) taskTableFound = true
    if (taskTableFound && /^\|/.test(line)) {
      if (/\|\s*[^|]*中文组名[^|]*\|/.test(line) &&
          /\|\s*[^|]*groupPath[^|]*\|/.test(line) &&
          /\|\s*[^|]*\bcron\b[^|]*\|/.test(line)) {
        taskTableValid = true
        break
      }
    }
  }
  if (taskTableFound && !taskTableValid) {
    issues.push({
      level: 'error',
      msg: '定时任务表格**不是**新格式。**必须**用 6 列表格：`| 中文组名 | groupPath | name | path | cron | 说明 |`',
      fix: '重写 §定时任务 章节，按 skill 19e-docs-api.md §7 的固定格式',
    })
  }

  // ========== 硬约束：MQTT 回调不能单独成节 ==========
  // 检查是否有 `## N. MQTT` 章节
  if (/^##\s*\d+\.\s*MQTT/m.test(content)) {
    issues.push({
      level: 'error',
      msg: 'MQTT 回调**不应该单独成节**。必须纳入 §1 路径树的 `设备管理/MQTT回调/` 子 group（kind=api）。主题写在对应 .ms 行的说明列（`主题 xxx` 标识）',
      fix: '删除 §MQTT 章节，把每个 .ms 节点移到 §1 路径树的 `api/设备管理/MQTT回调/` 下',
    })
  }

  return scoreIt('api', 'api.md', issues)
}

function scoreIt(role, file, issues) {
  // 关键格式错误（如函数/任务表用旧格式、MQTT 单独成节）= 直接 0 分，
  // 强制 LLM 必须用 writeDoc 重写
  const criticalErrors = issues.filter(i =>
    i.level === 'error' &&
    (i.msg.includes('函数表格') || i.msg.includes('定时任务表格') || i.msg.includes('MQTT'))
  ).length
  if (criticalErrors > 0) {
    return { role, file, issues, score: 0 }
  }
  // score: 100 - 20*error - 5*warn - 1*info
  const err = issues.filter(i => i.level === 'error').length
  const warn = issues.filter(i => i.level === 'warn').length
  const score = Math.max(0, 100 - 20 * err - 5 * warn)
  return { role, file, issues, score }
}

// ============== 交叉一致性 ==============

function crossCheck(docs) {
  const issues = []
  const ui = docs.find(d => d.role === 'ui')?.content || ''
  const api = docs.find(d => d.role === 'api')?.content || ''
  const db = docs.find(d => d.role === 'database')?.content || ''

  // ui menu paths vs api 路径段映射
  const uiPaths = extractMenuPathsFromUi(ui)
  const apiPaths = extractPathSegmentsFromApi(api)
  for (const p of uiPaths) {
    if (!apiPaths.includes(p) && p.split('/').filter(Boolean).length > 0) {
      issues.push({
        level: 'warn',
        msg: `ui.md 出现路径 ${p} 但 api.md 路径段映射未列`,
        fix: `在 api.md 路径段映射表加「| ${p} |」一行`,
      })
    }
  }
  // db tables 必须在 ui 字段或 api 引用
  const dbTables = extractTablesFromDatabase(db)
  for (const t of dbTables) {
    if (!ui.includes(t) && !api.includes(t)) {
      issues.push({
        level: 'info',
        msg: `表 ${t} 在 ui.md / api.md 中无引用`,
        fix: `确认 ${t} 是必备业务表，否则从 database.md 删除`,
      })
    }
  }
  return issues
}

// ============== 入口 ==============

function validateDocs(input) {
  // 简版：input.content 单文件校验；input.docs 多文件交叉
  const docs = input.docs || (input.content && input.role
    ? [{ role: input.role, file: `${input.role}.md`, content: input.content }]
    : [])

  if (docs.length === 0) {
    return { docs: [], totalScore: 0, summary: '未提供 docs 内容（传 content + role，或 docs: [...]）' }
  }

  const results = []
  for (const d of docs) {
    switch (d.role) {
      case 'requirement': results.push(validateRequirement(d.content)); break
      case 'ui':          results.push(validateUi(d.content)); break
      case 'database':    results.push(validateDatabase(d.content)); break
      case 'api':         results.push(validateApi(d.content)); break
    }
  }

  const totalScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0
  const allIssues = results.flatMap(r => r.issues)
  const errors = allIssues.filter(i => i.level === 'error').length
  const warns = allIssues.filter(i => i.level === 'warn').length

  let summary
  if (errors > 0) {
    summary = `${errors} 个 error + ${warns} 个 warn — 建议先修复再进入「生成脚本」阶段`
  } else if (warns > 0) {
    summary = `无 error，${warns} 个 warn — 询问用户后再决定是否修复`
  } else {
    summary = '全部通过 — 可以进入「生成脚本」阶段'
  }

  return {
    docs: results,
    totalScore,
    summary,
    crossCheck: docs.length >= 2 ? crossCheck(docs) : undefined,
  }
}

// ============== 程序化 auto-fix：不经过 LLM，纯代码修复已知格式错误 ==============

/**
 * 只修复可确定性转换的格式问题（表格格式、缺段、非法类型等）。
 * 内容层面的问题（缺页面、路径错误）仍需 LLM 修复。
 */
function autoFixDocContent(content, role) {
  const fixes = []
  let c = content
  if (role === 'database') {
    c = autoFixDatabase(c, fixes)
  } else if (role === 'ui') {
    c = autoFixUi(c, fixes)
  } else if (role === 'api') {
    c = autoFixApi(c, fixes)
  }
  return { content: c, fixes }
}

// ─── database.md 自动修复 ───

function autoFixDatabase(content, fixes) {
  let c = content

  // 1. 空默认值 → "-"
  // 匹配 5 列表格中必填列（是/否）后紧接着空单元格的情况
  // （IDE 版用 while + Set + 二次 replace，这里改成单次替换回调，
  //   语义相同，且避免文档内容里的 $& 被当替换模式）
  let defaultFixed = 0
  c = c.replace(/^(\|.*?\|.*?\| (?:是|否) )\|(\s*)\|(.*\|)$/gm, (full, g1, g2, g3) => {
    if (g2.trim() === '' && !g3.trim().startsWith('-')) {
      defaultFixed++
      return g1 + '| - |' + g3
    }
    return full
  })
  if (defaultFixed > 0) {
    fixes.push(`database: 将 ${defaultFixed} 个空默认值填为 "-"`)
  }

  // 2. 缺 **索引** 段的表 — 检查每个 "## N. 表名" 后是否有 "**索引**"
  const tableHeadingRE = /^##\s+\d+\.\s+\S+/gm
  const tableHeadings = []
  let th
  tableHeadingRE.lastIndex = 0
  while ((th = tableHeadingRE.exec(c))) {
    tableHeadings.push(th[0])
  }

  const indexSectionRE = /^\*\*索引\*\*/m
  let missingIndex = 0
  for (const heading of tableHeadings) {
    // 找这张表结束位置（下一个 ## 或文档尾）
    const pos = c.indexOf(heading)
    const remaining = c.slice(pos + heading.length)
    const nextHeadingMatch = remaining.match(/^##\s+\d+\.\s+(\S+)/m)
    const nextPos = nextHeadingMatch ? pos + heading.length + (nextHeadingMatch.index || 0) : c.length
    const tableBlock = c.slice(pos + heading.length, nextPos)
    if (!indexSectionRE.test(tableBlock)) {
      // 在表末尾（--- 之后）插入 **索引** 段
      const tableEndMatch = tableBlock.match(/---\s*$/m)
      const insertPos = tableEndMatch
        ? pos + heading.length + (tableEndMatch.index || 0) + tableEndMatch[0].length
        : nextPos
      const before = c.slice(0, insertPos)
      const after = c.slice(insertPos)
      c = before + '\n\n**索引**\n- （待补充）\n\n**字典关联**\n- dict: （待补充）\n' + after
      missingIndex++
    }
  }
  if (missingIndex > 0) {
    fixes.push(`database: 为 ${missingIndex} 张表补全 "**索引**" 和 "**字典关联**" 段`)
  }

  return c
}

// ─── ui.md 自动修复 ───

const UI_ALLOWED_TYPES = new Set([
  'string', 'int', 'text', 'select', 'tree-select', 'date', 'datetime',
  'upload', 'editor', 'switch', 'radio', 'checkbox',
])

function autoFixUi(content, fixes) {
  // 1. 字段表中非法类型 → 替换为合法类型
  // 匹配 4 列表格的第三列（类型列）
  const fieldTableRowRE = /^\| *([a-zA-Z_]+) *\| *(.+?) *\| *(是|否) *\|.*\|$/gm
  let m
  let c = content
  const typeFixes = []

  fieldTableRowRE.lastIndex = 0
  while ((m = fieldTableRowRE.exec(c))) {
    const rawType = m[2].trim().toLowerCase()
    // 去掉括号内容判断基本类型
    const baseType = rawType.replace(/\(.*\)/, '')
    if (!UI_ALLOWED_TYPES.has(baseType) && !/^(string)\(\d+\)$/.test(rawType)) {
      // 非法类型 → 映射到最近接的合法类型
      const mapping = {
        'json': 'text',
        'number': 'int',
        'bool': 'switch',
        'boolean': 'switch',
        'dropdown': 'select',
        'textarea': 'text',
        'richtext': 'editor',
        'rich-text': 'editor',
        'img': 'upload',
        'image': 'upload',
        'file': 'upload',
        'tree': 'tree-select',
        'datepicker': 'date',
        'datetimepicker': 'datetime',
      }
      const replacement = mapping[rawType] || mapping[baseType]
      if (replacement && replacement !== rawType) {
        const oldRow = m[0]
        const newRow = oldRow.replace(m[2], replacement)
        if (oldRow !== newRow) {
          typeFixes.push({ from: rawType, to: replacement, row: oldRow })
          // function replacement：避免文档内容里的 $& 被当替换模式
          c = c.replace(oldRow, () => newRow)
        }
      }
    }
  }

  if (typeFixes.length > 0) {
    const unique = [...new Set(typeFixes.map(f => `${f.from}→${f.to}`))]
    fixes.push(`ui: 修复 ${typeFixes.length} 个非法字段类型 (${unique.join(', ')})`)
  }

  return c
}

// ─── api.md 自动修复 ───

/** 所有 autoFixApi 能识别的 § 章节及其理想顺序（按标题中文子串匹配） */
const API_SECTION_ORDER = [
  { sub: '路径树', num: 1 },
  { sub: '权限码段', num: 2 },
  { sub: '组织数据权限', num: 3 },
  { sub: 'API 端点详情', num: 4 },
  { sub: '通用接口', num: 5 },
  { sub: '统一响应格式', num: 6 },
  { sub: '函数', num: 7 },
  { sub: '定时任务', num: 8 },
]

function autoFixApi(content, fixes) {
  let c = content

  // ────────────── 0. 删除冗余 §2 路径段映射 ──────────────
  // 场景：§1 已正确写路径树（左右对照），但 §2 还保留了旧平铺表
  const sec2MappingRe = /^##\s+2\.\s+路径段映射[\s\S]*?(?=\n##\s+\d+\.\s|$)/m
  if (sec2MappingRe.test(c)) {
    c = c.replace(sec2MappingRe, '')
    fixes.push('api: 移除冗余 §2 路径段映射（§1 已有正确路径树）')
  }

  // ────────────── 1. 删除独立的 MQTT 章节（如果在路径树中了）──────────────
  // 场景：LLM 写了 §6 MQTT 回调说明，但 §1 路径树已有 `设备管理/MQTT回调/` 行
  const hasMQTTinPathTree = /api\/[^`]*MQTT回调/i.test(c)
  const mqttSecRe = /^##\s+\d+\.\s+MQTT[\s\S]*?(?=\n##\s+\d+\.\s|$)/m
  if (hasMQTTinPathTree && mqttSecRe.test(c)) {
    c = c.replace(mqttSecRe, '')
    fixes.push('api: 移除独立 §MQTT 章节（内容已在 §1 路径树 的 设备管理/MQTT回调/ 中）')
  }

  // ────────────── 2. 重排 section 顺序 ──────────────
  // 提取所有 ## N. Title 及其完整内容
  const rawLines = c.split('\n')
  // 找出每个 ## N. 的起始行号
  const secLineIndices = []
  for (let i = 0; i < rawLines.length; i++) {
    if (/^##\s+\d+\.\s+\S/.test(rawLines[i])) {
      secLineIndices.push(i)
    }
  }
  if (secLineIndices.length > 0) {
    // 解析每个 section
    const sections = []
    for (let si = 0; si < secLineIndices.length; si++) {
      const start = secLineIndices[si]
      const end = si + 1 < secLineIndices.length ? secLineIndices[si + 1] : rawLines.length
      const heading = rawLines[start]
      const numMatch = heading.match(/^##\s+(\d+)\.\s+(.+)/)
      if (!numMatch) continue
      sections.push({
        start,
        end,
        num: parseInt(numMatch[1], 10),
        title: numMatch[2].trim(),
        text: rawLines.slice(start, end).join('\n'),
      })
    }
    // 找出每个 section 在 API_SECTION_ORDER 中的理想位置
    let needsReorder = false
    const idealOrder = []
    const unmatched = []
    for (let i = 0; i < sections.length; i++) {
      const found = API_SECTION_ORDER.findIndex(o => sections[i].title.includes(o.sub))
      if (found >= 0) {
        idealOrder.push(found)
      } else {
        idealOrder.push(-1)
        unmatched.push(i)
      }
    }
    // 检查是否需要重排：
    // 1. matched 的序号逆序（如 组织权限 出现在 API 端点 之后）
    // 2. 函数/定时任务出现在 non-函数/定时任务 节之前（它们应放文档尾部）
    let lastMatchedIdx = -1
    for (let i = 0; i < sections.length; i++) {
      if (idealOrder[i] >= 0) {
        if (idealOrder[i] < lastMatchedIdx) {
          needsReorder = true
          break
        }
        lastMatchedIdx = idealOrder[i]
      }
    }
    if (!needsReorder) {
      // 简单检查：函数/定时任务节是否出现在非函数节之后
      let lastNonFuncIdx = -1
      let firstFuncIdx = sections.length
      for (let i = 0; i < sections.length; i++) {
        if (/函数|定时任务/.test(sections[i].title)) {
          firstFuncIdx = Math.min(firstFuncIdx, i)
        } else {
          lastNonFuncIdx = i  // 包括 matched 和 unmatched
        }
      }
      if (firstFuncIdx < lastNonFuncIdx) {
        needsReorder = true
      }
    }
    if (needsReorder) {
      // 重排 matched sections 按 API_SECTION_ORDER 顺序
      // 但 函数/定时任务 永远放最后（LLM 常把它们写在不正确的位置）
      const matchedSections = sections
        .map((s, i) => ({ s, ideal: idealOrder[i] }))
        .filter(x => x.ideal >= 0)
        .sort((a, b) => a.ideal - b.ideal)
        .map(x => x.s)
      const unmatchedSections = sections.filter((_, i) => idealOrder[i] < 0)
      // 分离 函数/定时任务 节放最后
      const funcOrTask = matchedSections.filter(s => /函数|定时任务/.test(s.title))
      const otherMatched = matchedSections.filter(s => !/函数|定时任务/.test(s.title))
      // 重新组合文档：先保留非 section 内容（§ 之前的绪论/修订记录等）
      const preamble = rawLines.slice(0, secLineIndices[0]).join('\n')
      // 重组顺序：其他匹配节 → 未匹配节 → 函数/定时任务节
      const reorderedTexts = [...otherMatched, ...unmatchedSections, ...funcOrTask].map(s => s.text)
      c = preamble + '\n\n' + reorderedTexts.join('\n\n')
      fixes.push('api: 重排节序——函数/定时任务移至结尾')
    }
  }

  // ────────────── 3. 重编号全部 ## N. ──────────────
  const secLines = c.split('\n')
  let secCounter = 0
  let renumbered = 0
  for (let i = 0; i < secLines.length; i++) {
    const m = secLines[i].match(/^(##\s+)(\d+)(\.\s+.+)/)
    if (m) {
      secCounter++
      const newLine = m[1] + secCounter + m[3]
      if (secLines[i] !== newLine) {
        secLines[i] = newLine
        renumbered++
      }
    }
  }
  if (renumbered > 0) {
    c = secLines.join('\n')
    fixes.push(`api: 重编号 ${renumbered} 个节符（§1→§${secCounter}）`)
  }

  // ────────────── 4. 合并重复的函数/任务节 ──────────────
  // 场景：LLM 同时写了空节 "## 函数（Function）" 和真实节 "## 函数表"
  // → 合并：保留有真实内容的节
  const DUP_PAIRS = [
    { header: '函数（Function）', table: '函数表' },
    { header: '函数表', table: '函数（Function）' },
    { header: '定时任务（Task）', table: '定时任务表' },
    { header: '定时任务表', table: '定时任务（Task）' },
  ]
  for (const pair of DUP_PAIRS) {
    // 查找包含 p1 和 p2 的两个相邻节
    const p1Re = new RegExp(`^##\\s+\\d+\\.\\s+${pair.header}[\\s\\S]*?(?=\\n##\\s+\\d+\\.\\s|\$)`, 'm')
    const p2Re = new RegExp(`^##\\s+\\d+\\.\\s+${pair.table}[\\s\\S]*?(?=\\n##\\s+\\d+\\.\\s|\$)`, 'm')
    const p1Match = c.match(p1Re)
    const p2Match = c.match(p2Re)
    if (p1Match && p2Match) {
      // 判断哪个有真实表格内容（至少 1 行非空表格数据行）
      const hasRealContent = (s) => {
        const rows = s.split('\n').filter(l => l.trim().startsWith('|') && !/^\|[- :]+\|/.test(l) && !/^\|\s*字段\s*\|/.test(l))
        return rows.length >= 2
      }
      const p1Real = hasRealContent(p1Match[0])
      const p2Real = hasRealContent(p2Match[0])
      if (p1Real && !p2Real) {
        c = c.replace(p2Match[0], '')
        fixes.push(`api: 合并重复节——保留"${pair.table}"(有内容)，删除"${pair.header}"(空)`)
      } else if (p2Real && !p1Real) {
        c = c.replace(p1Match[0], '')
        fixes.push(`api: 合并重复节——保留"${pair.header}"(有内容)，删除"${pair.table}"(空)`)
      }
    }
  }

  // ────────────── 5. 补缺失的 §3 组织数据权限 ──────────────
  // match: 任何包含"组织数据权限"的 ## 标题（无论有无编号）
  if (!/^##\s*(?:\d+\.\s+)?组织数据权限/m.test(c) && !/组织数据权限/.test(c.slice(0, 500))) {
    // 找到 §2 权限码段末尾插入
    const sec2EndMatch = c.match(/^##\s+\d+\.\s+权限码段[\s\S]*?(?=\n##\s+\d+\.\s|$)/m)
    if (sec2EndMatch) {
      const insertAt = (sec2EndMatch.index || 0) + sec2EndMatch[0].length
      const before = c.slice(0, insertAt)
      const after = c.slice(insertAt)
      c = before + '\n\n## 3. 组织数据权限\n\n> 所有列表查询 API 必须按当前用户组织范围过滤数据。\n\n**规则**：\n1. 列表 API 必须调用 `office()` 获取当前用户可视组织 ID\n2. 请求参数必须提供 `officeId`（可选），用户可手动选择\n3. 每个列表 API 的请求结构必须包含 `officeId` 参数说明\n' + after
      fixes.push('api: 补全缺失的 §3 组织数据权限')
    }
  }

  // ────────────── 6. 补缺失的函数（Function）章节 ──────────────
  const hasFunc = /^##\s*(?:\d+\.\s+)?函数/.test(c) || /\|\s*中文组名\s*\|\s*groupPath\s*\|\s*name\s*\|\s*path\s*\|\s*参数\s*\|\s*返回\s*\|\s*说明\s*\|/.test(c)
  if (!hasFunc) {
    c = c.trimEnd() + '\n\n## 函数（Function）\n\n> 当前项目未定义函数调用。\n\n| 中文组名 | groupPath | name | path | 参数 | 返回 | 说明 |\n|----------|-----------|------|------|------|------|------|\n| - | - | - | - | - | - | - |\n'
    fixes.push('api: 补全缺失的 "函数（Function）" 章节')
  }

  // ────────────── 7. 补缺失的定时任务（Task）章节 ──────────────
  const hasTask = /^##\s*(?:\d+\.\s+)?定时任务/.test(c) || /\|\s*中文组名\s*\|\s*groupPath\s*\|\s*name\s*\|\s*path\s*\|\s*cron\s*\|\s*说明\s*\|/.test(c)
  if (!hasTask) {
    c = c.trimEnd() + '\n\n## 定时任务（Task）\n\n> 当前项目未定义定时任务。\n\n| 中文组名 | groupPath | name | path | cron | 说明 |\n|----------|-----------|------|------|------|------|\n| - | - | - | - | - | - |\n'
    fixes.push('api: 补全缺失的 "定时任务（Task）" 章节')
  }

  // ────────────── 8. 最终重编号：确保所有 ## 标题带连续编号 ──────────────
  // 跳过这些非正文节（不编号）
  const SKIP_UNNUMBERED = /^(修订记录|〇|菜单树)/
  const lastLines = c.split('\n')
  let finalCounter = 0
  for (let i = 0; i < lastLines.length; i++) {
    const line = lastLines[i]
    // 匹配有编号的 ## N. Title
    const numberedMatch = line.match(/^(##\s+)(\d+)(\.\s+.+)/)
    if (numberedMatch) {
      finalCounter++
      const newLine = numberedMatch[1] + finalCounter + numberedMatch[3]
      if (line !== newLine) lastLines[i] = newLine
      continue
    }
    // 匹配无编号的 ## Title（如刚追加的函数/任务节），跳过 修订记录/菜单树/〇
    const unnumberedMatch = line.match(/^(##\s+)([^\d#].+)/)
    if (unnumberedMatch) {
      const title = unnumberedMatch[2].trim()
      if (SKIP_UNNUMBERED.test(title)) continue
      finalCounter++
      lastLines[i] = `${unnumberedMatch[1]}${finalCounter}. ${title}`
    }
  }
  c = lastLines.join('\n')

  return c
}

// ============== CLI ==============

const ROLES = ['requirement', 'ui', 'database', 'api']

function usage(code) {
  console.error(`用法: node docs-verify.mjs <project-root> [options]

  <project-root>   项目工作区目录（包含 docs/ 的那一层）
  --role <r>       只校验：requirement | ui | database | api | all（默认 all）
  --fix            程序化自动修复后就地写回（再重新校验）
  --strict         warn 也按失败处理
  --json           输出 JSON
  退出码: 0 无 error / 1 有 error / 2 用法或文件缺失`)
  process.exit(code)
}

function parseArgs(argv) {
  const opts = { role: 'all', fix: false, strict: false, json: false, root: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--role') {
      const v = argv[++i]
      if (!ROLES.includes(v) && v !== 'all') usage(2)
      opts.role = v
    } else if (a === '--fix') {
      opts.fix = true
    } else if (a === '--strict') {
      opts.strict = true
    } else if (a === '--json') {
      opts.json = true
    } else if (a === '-h' || a === '--help') {
      usage(0)
    } else if (a.startsWith('-')) {
      console.error(`未知选项: ${a}`)
      usage(2)
    } else if (opts.root === null) {
      opts.root = a
    } else {
      console.error(`多余参数: ${a}`)
      usage(2)
    }
  }
  if (!opts.root) usage(2)
  return opts
}

const LEVEL_MARK = { error: '✗', warn: '⚠', info: 'ℹ' }
const LEVEL_TAG = { error: '[error]', warn: '[warn]', info: '[info]' }

function printReport(project, result, missing, fixes, opts) {
  console.log(`GewuMind docs-verify   project=${project}`)
  console.log('')
  for (const d of result.docs) {
    const mark = d.issues.some(i => i.level === 'error') ? '✗' : d.issues.some(i => i.level === 'warn') ? '⚠' : '✓'
    console.log(`── docs/${d.file}   score=${d.score}   ${mark}`)
    for (const i of d.issues) {
      console.log(`   ${LEVEL_MARK[i.level]} ${LEVEL_TAG[i.level]} ${i.msg}`)
      if (i.fix) console.log(`      fix: ${i.fix}`)
    }
    if (d.issues.length === 0) console.log('   ✓ 通过')
  }
  for (const f of missing) {
    console.log(`   ℹ [info] docs/${f} 不存在（该阶段可能还没到）`)
  }
  if (result.crossCheck && result.crossCheck.length > 0) {
    console.log('')
    console.log('── 交叉一致性（cross-check）')
    for (const i of result.crossCheck) {
      console.log(`   ${LEVEL_MARK[i.level]} ${LEVEL_TAG[i.level]} ${i.msg}`)
      if (i.fix) console.log(`      fix: ${i.fix}`)
    }
  }
  if (fixes.length > 0) {
    console.log('')
    console.log('── 自动修复（--fix 已写回）')
    for (const f of fixes) console.log(`   ✓ ${f}`)
  }
  const allIssues = result.docs.flatMap(d => d.issues)
  const errors = allIssues.filter(i => i.level === 'error').length
  const warns = allIssues.filter(i => i.level === 'warn').length
  const crossIssues = result.crossCheck || []
  console.log('')
  console.log('════════════════════════════════════')
  console.log(`总分 ${result.totalScore}/100   ${result.summary}`)
  console.log(`（含 cross-check：${crossIssues.filter(i => i.level === 'error').length} error / ${crossIssues.filter(i => i.level === 'warn').length} warn / ${crossIssues.filter(i => i.level === 'info').length} info）`)
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const root = resolve(opts.root)
  const docsDir = join(root, 'docs')
  if (!existsSync(docsDir)) {
    const msg = `docs/ 目录不存在: ${docsDir}`
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2))
    } else {
      console.error(msg)
    }
    process.exit(2)
  }

  const roles = opts.role === 'all' ? ROLES : [opts.role]

  // 1. 读文件（--fix 时先程序化修复再写回）
  const docs = []
  const missing = []
  const fixes = []
  for (const role of ROLES) {
    const file = join(docsDir, `${role}.md`)
    if (!existsSync(file)) {
      if (role === opts.role) {
        const msg = `文件不存在: ${file}`
        if (opts.json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2))
        else console.error(msg)
        process.exit(2)
      }
      if (roles.includes(role)) missing.push(`${role}.md`)
      continue
    }
    if (!roles.includes(role)) continue  // --role 指定时只处理该文件
    let content = readFileSync(file, 'utf8')
    if (opts.fix) {
      const r = autoFixDocContent(content, role)
      if (r.fixes.length > 0) {
        content = r.content.replace(/\s+$/, '') + '\n'
        writeFileSync(file, content, 'utf8')
        fixes.push(...r.fixes.map(f => `[${role}] ${f}`))
      }
    }
    docs.push({ role, file: `${role}.md`, content })
  }

  if (docs.length === 0) {
    const msg = `docs/ 下没有任何文档（${ROLES.map(r => r + '.md').join(' / ')}）`
    if (opts.json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2))
    else console.error(msg)
    process.exit(2)
  }

  // 2. 校验
  const result = validateDocs({ docs })

  // 3. 输出
  if (opts.json) {
    console.log(JSON.stringify({
      project: root,
      ok: !result.docs.some(d => d.issues.some(i => i.level === 'error')) && (opts.strict ? !result.docs.some(d => d.issues.some(i => i.level === 'warn')) : true),
      totalScore: result.totalScore,
      summary: result.summary,
      docs: result.docs,
      missing,
      crossCheck: result.crossCheck || [],
      fixes,
    }, null, 2))
  } else {
    printReport(root, result, missing, fixes, opts)
  }

  // 4. 退出码
  const allIssues = result.docs.flatMap(d => d.issues)
  const errors = allIssues.filter(i => i.level === 'error').length
  const warns = allIssues.filter(i => i.level === 'warn').length
  if (errors > 0) process.exit(1)
  if (opts.strict && warns > 0) process.exit(1)
  process.exit(0)
}

// 以下导出供其他脚本/测试复用；直接运行本文件时才执行 CLI
export { validateDocs, validateRequirement, validateUi, validateDatabase, validateApi, crossCheck, autoFixDocContent, autoFixApi, autoFixUi, autoFixDatabase }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
