## mb-form 表单组件

基于 naive-ui `n-form` 封装，支持栅格布局、动态字段、内置/动态组件、表单验证、保存/详情/重置。

源文件：`src/components/magic/template/mb-form.vue`

### 整体结构

```js
form = {
  props: { /* n-form props */ },
  rows: [
    {
      gutter: 24,  // n-grid cols
      cols: [
        { name, label, span, component, componentProps, rules, formItemProps, labelWidth, /* ... */ }
      ]
    }
  ]
}
```

### col 字段定义

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `name` | String | - | **必填**，字段名（formData 的 key） |
| `label` | String | - | 表单项标签 |
| `span` | Number | - | 栅格占位（n-gi span，0~24） |
| `gutter` | Number | - | 单独设置此列 gutter（覆盖 row） |
| `colProps` | Object | - | 透传给 `<n-gi>` |
| `formItemProps` | Object | - | 透传给 `<n-form-item>` |
| `labelWidth` | String/Number | - | 单独设置 label 宽度 |
| `component` | String | - | 组件名（如 `input` / `select` / `date` / `radio-dict`），`dynamic` 走 slot |
| `props` | Object | - | ⚠️ **透传给字段组件用 `props`，不是 `componentProps`**（`componentProps` 是 mb-editor-table/mb-table 专用） |
| `defaultValue` | Any | - | 字段默认值（`getData()` 时用） |
| `rules` | Object/Array | - | 验证规则（同 naive-ui） |
| `change` | Function | - | 字段值变化回调 |

### 组件命名规则（重要）

`col.component` 决定渲染的字段组件，规则：
- 不写或空 → `mb-input`
- 以 `n-` 开头（如 `n-input`）→ 直接用 `n-input`
- 名字在 `$global.dynamicComponentNames` 中 → 直接用
- 其他 → 自动加 `mb-` 前缀（如 `select` → `mb-select`）

可用的 `mb-*` 表单组件（来自 `src/components/magic/form/`）：
- `mb-input` 文本输入
- `mb-textarea` 多行文本
- `mb-select` 下拉选择（dict/options/url 三种数据源）
- `mb-tree-select` 树形下拉
- `mb-select-table` 弹窗表格选择
- `mb-date` 日期/日期范围
- `mb-switch` 开关
- `mb-checkbox` 复选框（dict/options/url）
- `mb-radio-dict` 字典单选（dictKey 字段）
- `mb-upload-image` 图片上传（含裁剪）
- `mb-upload-file` 文件上传
- `mb-upload-oss-file` OSS 文件上传
- `mb-video` 视频上传

### 完整 form 示例

```js
const form = {
  props: { labelWidth: '120px', labelPosition: 'right' },
  rows: [
    {
      gutter: 24,
      cols: [
        { name: 'name', label: '姓名', span: 12, component: 'input',
          rules: { required: true, message: '请输入姓名', trigger: ['blur'] } },
        { name: 'username', label: '账号', span: 12, component: 'input',
          rules: { required: true, message: '请输入账号', trigger: ['blur'] } },
        { name: 'status', label: '状态', span: 12, component: 'select',
          defaultValue: '1',
          props: { options: [{ value: '1', label: '启用' }, { value: '0', label: '禁用' }] } },
        { name: 'roleIds', label: '角色', span: 12, component: 'select',
          props: { multiple: true, url: '/sys/role/list', valueField: 'id', labelField: 'name' } },
        { name: 'birthday', label: '生日', span: 12, component: 'date',
          props: { type: 'date', valueFormat: 'yyyy-MM-dd' } },
        { name: 'remarks', label: '备注', span: 24, component: 'textarea' }
      ]
    }
  ]
}
```

### Props

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `form` | Object | `{}` | 表单结构定义（必填） |
| `detail` | Object | - | 详情模式：`{ formData, request: { url }, handlerFormData, excludeAssign }` |
| `add` | Object | - | 新增模式：`{ formData }`（初始值） |
| `primaryField` | String | `'id'` | 主键字段名（用于判断新增/编辑） |

### 暴露方法（ref）

```js
const formRef = ref()

// 加载详情
formRef.value.getDetail(id)  // 自动请求 request.url 填充表单

// 获取/初始化表单数据
formRef.value.getFormData()  // 当前 formData
formRef.value.initFormData() // 重置为 defaultValue

// 保存（自动触发校验 + POST + 成功提示 + 触发 reload）
formRef.value.save({ loading, hideLoading, hide })
```

### 保存事件流

1. `dataForm.value.validate((errors) => ...)` 触发校验
2. 通过 → `$common.post(form.request.url, formData)` 
3. 成功 → `$message.success('创建/修改成功')` → `emit('reload')` → 自动关闭对话框

### 配合 mb-list + mb-modal 标准 CRUD 模式

```vue
<template>
  <mb-list ref="magicList" v-bind="listOptions" />
  <mb-modal ref="formDialog" :title="dialogTitle" @confirm="magicForm.save($event)" width="50%">
    <mb-form ref="magicForm" @reload="magicList.reload" v-bind="formOptions" />
  </mb-modal>
</template>

<script setup>
import { ref, reactive } from 'vue'
const formDialog = ref()
const magicList = ref()
const magicForm = ref()
const dialogTitle = ref('')

const formOptions = reactive({
  form: { /* 上面的 form 结构 */ },
  detail: { request: { url: '/sys/user/detail' } }
})

const listOptions = reactive({
  tools: [{
    type: 'add', permission: 'user:save',
    click: () => {
      formOptions.detail.formData = null
      dialogTitle.value = '添加用户'
      formDialog.value.show()
    }
  }],
  table: {
    url: '/sys/user/list',
    where: { /* ... */ },
    cols: [ /* ... */ ]
  }
})
</script>
```

> ⚠️ **重要纠错**（AI 之前常踩的坑）：
> - ❌ 错误：`mb-dialog` → ✅ **没有 mb-dialog，用 mb-modal**
> - ❌ 错误：`@confirm-click` → ✅ `@confirm`
> - ❌ 错误：`<mb-modal><template #content>...</template></mb-modal>` → ✅ `<mb-modal>直接子内容</mb-modal>`（mb-modal 只有 default slot）
> - ❌ 错误：表单字段透传 `componentProps` → ✅ 用 **`props`**
