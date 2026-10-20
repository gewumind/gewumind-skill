# SFC 编译：.vue → sys_dynamic_component INSERT SQL

动态组件的发布链路：**写 `src/pages/{name}.vue` → 编译成 SQL → `bundle_apply` 发布 → 后端落 `sys_dynamic_component` 表 → magic-web 运行时加载**。

## 两级 SFC 结构

| 层级 | 含义 | pid | 需要 .vue |
|---|---|---|---|
| **L1 顶级分组** | 菜单树顶级容器（如 `device`） | `'0'` | 否（source_code/compile_js/compile_css 全空） |
| **L2 组件** | 实际页面（如 `device-list`） | `'0'` 或 L1 的派生 UUID | 是 |

**生成顺序：先 L1 分组，再 L2 组件**（L2 的 pid 依赖 L1 的 name 派生）。

## 确定性 UUID（nameToUuid）

id/pid **不用随机 UUID**，由 name 确定性派生（djb2 4 轮加盐扩展为 32 hex）：

- 同名永远同 UUID，跨 session/跨设备一致
- 重推时字面 UUID 不变 → 主键冲突 → 后端 UPSERT 接管（同 name 找到旧记录 UPDATE）
- 实现与 IDE `llm/tools/index.ts` 的 `nameToUuid` 完全一致（`scripts/sfc-compile.mjs` 内可直接调用 `--uuid`）

```
nameToUuid("user") = 7c9f2e84555659363e497b70419128f2
nameToUuid("user-center") = 503e8db280e2136ceddf7e1efd6c83b6
```

## SQL 格式

**L1 分组**（`src/sql/sfc/{name}.sql`，文件已存在则跳过）：

```sql
INSERT INTO sys_dynamic_component (id, pid, name, source_code, compile_js, compile_css, type, remark, is_del, create_by, create_date)
VALUES ('<nameToUuid(name)>', '0', '<name>', '', '', '', 0, '<中文备注>', 0, NULL, NOW());
```

**L2 组件**（`src/sql/sfc/{name}.sql`，文件已存在则**追加**，不覆盖）：

```sql
INSERT INTO sys_dynamic_component (id, pid, name, source_code, compile_js, compile_css, type, remark, is_del, create_by, create_date)
VALUES ('<nameToUuid(name)>', '<nameToUuid(parent) 或 0>', '<name>', '<转义的 .vue 源码>', '<转义的 compile_js>', '<转义的 compile_css>', 0, '<中文备注>', 0, NULL, NOW());
```

- 单引号转义：`'` → `''`
- vue 源码含换行——SQL 字符串可以跨行，这是合法的（一条语句物理上占多行）
- name 约束：`^[a-zA-Z0-9\-_]+$`，**必须含模块前缀**（`device-list` 而不是 `list`）
- 文件命名 = `src/sql/sfc/{name}.sql`（**不是** `{parent}-{name}.sql`；name 本身已含前缀）

## 编译规则（compileCode）

输入 .vue 源码，输出 `compile_js` + `compile_css`：

1. **校验**：`@vue/compiler-sfc` parse；`<script setup>` 强制（defineProps 等只能在 setup 下用）；不支持 lang 预处理器（lang="ts"/"tsx" 等）
2. **compileScript**（inlineTemplate: true）→ `rewriteDefault(__sfc__)`
3. 非 setup 的 template → `compileTemplate`，挂 `__sfc__.render`
4. scoped 样式 → `__sfc__.__scopeId = "data-v-<随机id>"`；末尾追加 `__sfc__.__file` + `export default __sfc__`
5. **import 改写**（babel AST 遍历，从后往前替换）：
   - `import { x, y as z } from 'mod'` → `const x = ___magic__import__('mod', 'x'); const z = ___magic__import__('mod', 'y');`
   - `export default ...` → `return __sfc__`
   - 编译器内部生成的 runtime import（`_createVNode` 等）也会被改写成 `___magic__import__('vue', '...')`——**这是预期行为**，magic-api 运行时提供 `___magic__import__` 解析
6. **样式**：每个 `<style>` 过 `compileStyle`（scoped 加 data-v-xxx 属性选择器）

## 用法（scripts/sfc-compile.mjs）

依赖 `@vue/compiler-sfc` + `@babel/parser`（项目根目录 `package.json` 声明）。

```bash
# L1 顶级分组（已存在则跳过）
node gewumind-skill/scripts/sfc-compile.mjs <project-root> --group device 设备管理

# L2 组件（写/追加 src/sql/sfc/{name}.sql）
node gewumind-skill/scripts/sfc-compile.mjs <project-root> device-list --parent device 设备列表

# 顶层组件（无 parent，pid='0'）
node gewumind-skill/scripts/sfc-compile.mjs <project-root> home-dashboard 汇总首页

# 查派生 UUID
node gewumind-skill/scripts/sfc-compile.mjs <project-root> --uuid device-list
```

输出 JSON：`{ name, id, parent, pid, jsBytes, cssBytes, created|appended|skipped, path }`。
编译失败（语法错误/非 setup）→ 非零退出 + 错误信息，修 .vue 后重跑。

## 注意

- 编译用**随机** `data-v-xxx` scopeId（每次重编译会变）——幂等性靠 name 派生的主键 UPSERT 保证，scopeId 变化无副作用（scoped CSS 属性选择器在 compile_css 里与 js 内嵌的 scopeId 一致，二者同次编译生成）
- 后端发布时 `sys_dynamic_component` 的 UPSERT 按 name 匹配旧记录（主键冲突 → UPDATE）
- 生成 L2 前**必须**已生成对应 L1（保证 pid 的派生 name 有定义）
