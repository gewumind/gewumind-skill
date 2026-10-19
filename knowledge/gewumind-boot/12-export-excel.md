## 导出 Excel 功能

gewumind-boot 提供 3 种导出模式，按使用场景选：

| 模式 | 适用场景 | API | 备注 |
|---|---|---|---|
| **A. 当前页导出**（**CRUD 标配**） | 表格内点导出按钮 | `mb-table` ref 的 `exportExcel()` | 用表格当前列定义 + 当前页数据 |
| **B. 全量导出** | 后端脚本侧生成 | `db.select(...)` + 暴露 `/export` 端点 | 数据量大时必需 |
| **C. 自定义数据导出** | 非表格数据 / 汇总报表 | `$common.exportExcel({ data, fileName })` | 直接传数据数组 |

### 🚨 CRUD 列表页**标配导出**

**只要 ui.md 设计界面写了「导出」按钮**，**必须**用以下模式：

1. **Vue 端**：`<n-button @click="table.exportExcel({fileName: 'X'})">导出</n-button>`（mb-table 必须有 `ref="table"`）
2. **L3 menu 端**：必须生成 `generateMenuSql({isButton:true, permission:'<module>:export', ...})`
3. **lintVue 自动检查**：
   - 检测到「导出」字样但没 `exportExcel` 调用 → warning
   - 用 `exportExcel` 但 `<mb-table>` 缺 `ref` → **error**（不能发布）

---

### 模式 A：mb-table 内置导出（标准模式，90% 场景）

**模板**：在 `mb-search` 的 `#buttons` slot 里放一个导出按钮，点击调用 `ref.exportExcel()`。

参考 `src/views/system/monitor/oper-log.vue` 第 4-10 行：

```vue
<template>
  <div class="mb-list">
    <div class="mb-search">
      <mb-search :where="tableOptions.where" @search="reloadTable">
        <template #buttons>
          <n-button type="primary" @click="table.exportExcel({ fileName: '操作日志' })">
            <mb-icon icon="DownloadOutline" />
            导出
          </n-button>
        </template>
      </mb-search>
    </div>
    <div class="mb-table">
      <mb-table ref="table" v-bind="tableOptions" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
const table = ref()
const tableOptions = reactive({
  id: 'oper-log',
  url: '/system/log/oper/list',
  // ... cols
})
</script>
```

**关键点**：
- `mb-table` 必须有 `ref`（`const table = ref()`）
- `exportExcel({ fileName: '操作日志' })` 自动追加 `.xlsx` 扩展名
- 导出范围：**当前页**（受 `pageSize` 限制）
- 导出格式：按 `cols[]` 定义（含字典翻译、列宽、formatter）

**其他常见变体**：

```vue
<!-- 选中行导出（仅导出勾选行） -->
<n-button @click="table.exportExcel({ fileName: '选中数据', onlyChecked: true })">导出选中</n-button>

<!-- 带自定义表头前缀（合并多 sheet） -->
<n-button @click="table.exportExcel({ fileName: '报表', prefix: '部门-A组' })">导出</n-button>

<!-- 自定义列渲染（导出时脱敏手机号） -->
const cols = [{
  field: 'phone', label: '手机',
  exportRender: (row) => row.phone?.replace(/^(\d{3})\d{4}/, '$1****')
}]
```

---

### 模式 B：全量导出（数据量大时必需）

mb-table 默认只导出当前页。如果需要全量数据（比如 10 万行的日志），必须走后端：

**前端调用**：
```vue
<n-button @click="$common.exportExcel({
  url: '/system/log/oper/export',
  method: 'post',
  where: searchWhere,            // 当前查询条件
  fileName: '操作日志-全量'
})">
  全量导出
</n-button>
```

**后端 magic-script（`/export` 端点）**：参考 `src/views/system/日志管理/操作日志.ms` 第 19 行的 responseBody 模板，但实际生成逻辑是：

```js
// /system/log/oper/export
var where = #{?and create_date >= #{startTime} #{?and create_date <= #{endTime}}
var rows = db.select("SELECT * FROM sys_oper_log WHERE 1=1 " + where + " ORDER BY create_date DESC")
return { total: rows.length, list: rows }
```

**关键点**：
- 全量查询可能很慢（10万+ 行），建议加 limit 或者让前端流式下载
- 大表导出推荐异步：写临时文件 + 前端轮询状态
- `$common.exportExcel({ url })` 内部自动处理 Blob 下载

---

### 模式 C：自定义数据导出

非表格场景（汇总报表、跨表 join、复杂计算）：

```js
// 任意位置：构造数据后导出
$common.exportExcel({
  data: [
    { name: '张三', score: 95 },
    { name: '李四', score: 87 }
  ],
  fileName: '成绩单',
  // 可选：自定义表头
  headers: ['姓名', '分数']
})
```

**典型场景**：
- 统计报表（多表 join 后汇总）
- 导出当前选中的复杂对象
- 导出非列表数据（如用户操作日志聚合）

---

### AI 生成代码时的标准模式

**写 .vue 时的检查清单**：

1. ✅ 如果页面是列表 + 有"导出"按钮 → 用 **模式 A**（mb-table ref + exportExcel）
2. ✅ 如果数据量大（> 1万行）→ 用 **模式 B**（后端 /export 端点）
3. ✅ 如果是非表格数据 → 用 **模式 C**（$common.exportExcel 直接传 data）
4. ✅ 按钮放在 `<mb-search>` 的 `#buttons` slot 里（与操作日志一致）
5. ✅ `fileName` 用中文，跟菜单名一致（如"操作日志"）
6. ✅ 图标用 `mb-icon icon="DownloadOutline"`

**生成 magic-script 时**（`/export` 端点）：
- 没有 limit，但建议加 `LIMIT 100000` 保护
- 列名跟 mb-table 的 `cols[].field` 保持一致
- 返回 `{ total, list: [...] }` 格式（mb-table 兼容）
