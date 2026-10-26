# 前端 SFC 组件（component/工作流示例/`<name>`.ms）

## 文件位置

```
backend/data/zh/magic-api/component/工作流示例/<name>.ms
```

文件名建议中文（与定义文件同名）。`MagicWorkflow.vue` 通过 `magic-import.js` 注册的异步组件加载；菜单 url = `/workflow-demo/<x>` 自动映射到本目录里 name=`<x>` 的 SFC。

## 文件结构

```jsonc
{
  "properties" : {
    "type": 1,
    "remark": "...",
    "entryApi": null,
    "group": null
  },
  "id": "<uuid>",
  "script": null,
  "groupId": "16583e6eef854d24b6dc99162979017c",
  "name": "<流程显示名>",
  "createTime": null,
  "updateTime": null,
  "lock": null,
  "createBy": null,
  "updateBy": null,
  "path": "/<name>",
  "type": 1,
  "entryApi": null,
  "group": null,
  "remark": "...",
  "compileJs": "/* Analyzed bindings: { \"MagicWorkflow\": \"setup-const\" } */\nconst _openBlock = ___magic__import__('vue', 'openBlock');\nconst _createBlock = ___magic__import__('vue', 'createBlock');\n\nconst MagicWorkflow = ___magic__import__('@/components/workflow/MagicWorkflow.vue', '*');\n\nconst __sfc__ = { __name: '<short>', setup(__props) {\n  return (_ctx, _cache) => {\n    return (_openBlock(), _createBlock(MagicWorkflow, {\n      title: \"...\", subtitle: \"...\", processId: \"...\", entryApi: \"/data/plugins/workflow-api/...\", category: \"OA\"\n    }))\n  }\n}\n}\n__sfc__.__file = \"<short>.vue\"\nreturn __sfc__",
  "compileCss": "/* No <style> tags present */"
}
================================
<template>
    <MagicWorkflow
        title="<流程显示名>"
        subtitle="<流程简要说明>"
        processId="<name>_v1"
        entryApi="/data/plugins/workflow-api/<name>"
        category="OA"
    />
</template>

<script setup>
import MagicWorkflow from '@/components/workflow/MagicWorkflow.vue'
</script>
```

## 模板（手动写法）

如果你**新建**一个 SFC 文件，直接写 `================================` 分隔符下方的 vue 源码即可，前端 magic-script 编译会自动生成 compileJs：

```vue
<template>
    <MagicWorkflow
        title="跨部门申请"
        subtitle="员工发起 → IT 技术评估 → 财务预算审核 → 总经理综合审批；各部门只能编辑本部门字段"
        processId="cross_v1"
        entryApi="/data/plugins/workflow-api/cross"
        category="OA"
    />
</template>

<script setup>
import MagicWorkflow from '@/components/workflow/MagicWorkflow.vue'
</script>
```

> magic-api 的 magic-script 编译器会把 `<template>` + `<script setup>` 编译成 compileJs 字段（运行时直接 eval 加载）。**手动**写完整 JSON 头也行，但一般通过 IDE 编辑器生成。

## MagicWorkflow Props

| prop | 必填 | 值来源 | 示例 |
|------|------|--------|------|
| `title` | 是 | 流程显示名 | `"请假审批"` |
| `subtitle` | 否 | 新建按钮下方说明 | `"员工请假流程"` |
| `processId` | 是 | 定义文件 JSON 头的 processId | `"leave_v1"` |
| `entryApi` | 是 | 入口 API 完整绝对路径 | `"/data/plugins/workflow-api/leave"` |
| `definitionApi` | 否 | `/workflow-def/<name>`（一般不需要，组件有 fallback） | `"/workflow-def/leave"` |
| `definitionId` | 否 | 定义文件 ID（仅记录用） | `"wf-leave-def-001"` |
| `category` | 否 | 分类标签（默认 "OA"） | `"OA"` |

## 菜单 URL ↔ SFC 映射

- 菜单 `sys_menu.url = '/workflow-demo/<name>'`（不带 .ms 后缀）
- `ComponentRuntimeController` 扫描 `component/工作流示例/` 目录，按 file.path 注册到全局 Vue 组件
- file.path = `/<name>`，所以菜单 url 直接命中

也就是说：菜单加 `/workflow-demo/<name>`，同目录下要有 `<name>.ms` 才会渲染。

## 注意事项

- SFC 本身只是 `<MagicWorkflow />` 的薄壳，所有审批 UI、字段渲染、审批弹窗、节点分组展示都在 MagicWorkflow.vue 内部实现
- 不同流程**不需要**写不同的 SFC 模板，差异化通过 props（title / subtitle / processId / entryApi）和 definition.forms 实现
- 修改 MagicWorkflow 组件本身会影响所有流程（统一优化点）

## 对应演示文件

- `backend/data/zh/magic-api/component/工作流示例/请假审批.ms` — 请假审批包装
- `backend/data/zh/magic-api/component/工作流示例/采购审批.ms` — 采购审批包装
- `backend/data/zh/magic-api/component/工作流示例/合同审批.ms` — 合同审批包装
- `backend/data/zh/magic-api/component/工作流示例/跨部门申请.ms` — 跨部门申请包装
- `backend/data/zh/magic-api/component/工作流示例/流程详情.ms` — 流程详情（只读展示）
