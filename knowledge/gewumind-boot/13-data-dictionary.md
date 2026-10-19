## 数据字典（sys_dict + sys_dict_items）

gewumind-boot 的数据字典是**前端下拉选项 / 表格列翻译的统一来源**。两表一对多：

- `sys_dict`：字典类型（type 是业务键，dict_type 是 0=系统类 / 1=业务类）
- `sys_dict_items`：字典项（value 业务代码用，label 前端显示）

---

### db schema

**sys_dict**（每条 = 一个字典类型）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar(32) | 主键（推荐 `dict-{type}` 形式） |
| `type` | varchar | 字典类型编码（业务键，唯一），如 `status` / `sex` / `hat_type` |
| `desc_ribe` | varchar | 描述（前端下拉框的 placeholder 也用这个） |
| `dict_type` | int | `0=系统类`（系统提供，不允许改）/ `1=业务类`（业务自定义） |
| `is_del` | int | 软删除 |
| `create_by` / `create_date` / `update_by` / `update_date` | - | 审计 |

**sys_dict_items**（每条 = 字典里的一个选项）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar(32) | 主键 |
| `dict_id` | varchar(32) | 关联 sys_dict.id |
| `value` | text | **值**（业务代码用的，如 "1"） |
| `label` | text | **显示名**（前端下拉显示的，如 "启用"） |
| `sort` | int | 排序号（小的在前） |
| `is_del` / 审计字段 | - | - |

---

### AI 工作流

**新增字典**（用户说"加一个 hat_type 字典"）：
1. `listDicts(type='hat_type')` — 查是否已存在
2. 已存在 → 调 `addDictItem(type='hat_type', value='1', label='棒球帽', sort=10)` 逐条加 item
3. 不存在 → 调 `addDictItem` 一次（工具自动建 dict）

**批量初始化**（用户给一组枚举值）：用 `generateDictSql` 写一条 sys_dict + N 条 sys_dict_items 的 INSERT。

#### ⛔ 严禁手写 SQL — 用结构化 items[]

历史教训：LLM 反复在 sys_dict/sys_dict_items INSERT 上搞错括号位置（漏 `)`、多 `)`、空 items 输出孤儿 `);`），导致 SQL 不合法。

**正确调用方式 — 传结构化数据**（工具内部用 `buildDictSql()` 拼装，绝对正确）：

```json
{
  "dictType": "device_status",
  "name": "设备状态",
  "dictTypeVal": 1,
  "items": [
    {"value": "online",  "label": "在线"},
    {"value": "offline", "label": "离线"}
  ]
}
```

工具自动：
- 生成 sys_dict 行（UUID 用 `nameToUuid("dict-{type}")` 派生）
- 按 10/20/30 排序生成 items（每条 UUID 用 `nameToUuid("dict-item-{type}-{value}")` 派生）
- 末尾正确闭合括号 + `;`

**批量模式** — 一次生成多个字典：

```json
{
  "dicts": [
    {"dictType": "device_status", "name": "设备状态", "dictTypeVal": 1, "items": [...]},
    {"dictType": "device_command", "name": "控制指令", "dictTypeVal": 1, "items": [...]}
  ]
}
```

**legacy `sql` 字段已废弃** — 如果你之前习惯传 `sql: "INSERT INTO ..."`，工具会强制走 parse→rebuild 兜底，但**强烈建议改成结构化 items[]**，因为这是历史 bug 的根源。

**前端用字典**（mb-table 列 / mb-select）：
- 表格列：`{ field: 'status', label: '状态', dictType: 'status' }` → 自动翻译
- 表单下拉：`<mb-select v-model="form.status" type="dict_type" :dictType="'status'" />` 或 `dict-type="status"`
- 代码里手动翻译（⚠️ import 路径必须正确）：
  ```js
  import { useDictStore } from "@/store/modules/dictStore";  // ✅ 唯一正确
  const dictStore = useDictStore();
  dictStore.getDictLabel('status', row.status);  // → '启用'
  ```

---

### 标准模式

#### 模式 1：业务新表有枚举字段

**用户对话**： "产品管理页加个 status 字段，值是 1=上架 0=下架"

**AI 操作**：
1. `listDicts(type='status')` → 检查是否已存在
2. 若已有 '1'='上架' '0'='下架' → 不用加
3. 若没有 → `addDictItem(type='status', value='1', label='上架')` + `addDictItem(type='status', value='0', label='下架')`
4. DDL 时给业务表加 `status varchar(1) DEFAULT '1'`
5. .vue 里 `cols: [{ field: 'status', dictType: 'status' }]`

#### 模式 2：复刻已部署的字典

**用户对话**： "把 gewumind-boot 里的 hat_type 字典加到本地项目"

**AI 操作**：
1. `listDicts(type='hat_type')` → 看已部署有哪些 item
2. 调 `generateDictSql(dictType='hat_type', sql='INSERT INTO sys_dict ...; INSERT INTO sys_dict_items ...;')`，工具自动复用已部署的 `dict.id`

#### 模式 3：字典已存在但要加新 item

**用户对话**： "给 status 加个 '2=草稿'"

**AI 操作**：
1. `listDicts(type='status')` → 确认 status 字典存在
2. `addDictItem(type='status', value='2', label='草稿')` → 工具自动算 sort = max+10

---

### 前端代码模式速查

| 场景 | 模板 |
|---|---|
| **mb-table 列翻译** | `{ field: 'status', label: '状态', dictType: 'status', width: 80 }` |
| **mb-search 下拉** | `{ field: 'status', label: '状态', component: 'select', dictType: 'status' }` |
| **mb-form 下拉** | `<mb-select type="dict_type" :dictType="'status'" v-model="form.status" />` |
| **n-form-item 下拉** | `<mb-input type="dict_type" dict-type="status" v-model="form.status" />` |
| **手动翻译** | `dictStore.getDictLabel('status', row.status)` |
| **批量翻译** | `row.status = dictStore.getDictName('status', row.status)` |

---

### 写 magic-script 时的关联

字典数据本身只在前端用（渲染下拉）。后端 magic-script 只关心**值（value）**，不翻译：

```js
// /product/list  接收 status 过滤条件
var where = '1=1'
if (#{status}) where += ' AND status = ' + db.quote(#{status})   // 不需要翻译，传 '1' / '0' 即可
var list = db.select("SELECT * FROM pro_product WHERE " + where + " ORDER BY create_date DESC")
return { total: list.length, list: list }
```

但**新建记录时**，前端会把 value 传到后端（用户在下拉里选 '上架'，前端会翻译成 '1' 再传，或者后端自己翻译，看实现）。

---

### AI 工具调用清单

| 工具 | 用途 | 调用时机 |
|---|---|---|
| `listDicts(type?)` | 查现有字典 | 加 item 之前必先调 |
| `addDictItem(type, value, label, sort?)` | 加单个 item | 加/补字典项 |
| `generateDictSql(dictType, sql)` | 批量写多 items | 初始化大量枚举值 |
| `getProjectSnapshot` | 顺带能拿 dict（已包含在 snapshot 里） | 概览时用 |

**重要**：加 dict item 不需要走 `applyBundle` 流程，**直接生效**（后端是 POST，不是 SQL bundle）。
