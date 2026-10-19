## 前端项目结构

### 目录结构

```
src/
├── api/                      # 后端接口封装（axios）
│   ├── common.js
│   ├── user.js
│   └── ...
├── assets/                   # 静态资源
├── components/
│   ├── magic/                # 核心 mb-* 组件（业务封装）
│   │   ├── basic/            # mb-icon 等基础
│   │   ├── data/             # mb-table, mb-form, mb-search, mb-pagination
│   │   ├── form/             # mb-input, mb-select, mb-date ...
│   │   ├── feedback/         # mb-modal, mb-table-tooltip
│   │   ├── sfc/              # mb-monaco-volar, mb-vue-init-template
│   │   └── template/         # mb-list, mb-form (高级模板)
│   └── layout/               # 布局组件（sidebar/header/tabs）
├── router/                   # vue-router 配置
│   ├── index.js
│   ├── loadRouter.js         # 动态菜单加载
│   └── routerInterceptor.js  # 权限拦截
├── scripts/                  # 工具脚本
│   ├── common.js             # $common 全局方法
│   ├── request.js            # $common.post / get / put / delete
│   ├── global.js             # 全局配置（uiSize, filePrefix, dynamicComponentNames）
│   ├── xicons.js             # 全部 icon 组件
│   ├── svg-icons.js          # 本地 svg 图标名
│   ├── ossutil.js            # OSS 上传
│   ├── treeTable.js          # 树形数据工具
│   └── compiler/             # SFC 编译器
│       ├── sfc-compiler.js
│       ├── dynamicComponent.js
│       └── magic-import.js
├── store/modules/            # Pinia stores
│   ├── dictStore.js          # 字典缓存
│   ├── userStore.js          # 用户信息 + 权限
│   └── tabsStore.js          # 多页签
├── styles/                   # 全局样式
├── utils/                    # 工具函数
├── views/                    # 业务视图
│   ├── common/
│   │   └── show-component.vue  # 动态 SFC 容器
│   ├── login/
│   ├── system/               # 系统管理
│   ├── lowcode/              # 低代码（magic-editor）
│   └── examples/
├── App.vue
├── main.ts
└── permission.ts             # 全局前置守卫
```

### 路由

**路由加载**（`src/router/loadRouter.js`）：
1. 调用 `/system/menu/current/menus`
2. 把 `layoutMenus` 树转成 vue-router 格式
3. 注册到 `router.addRoute()`
4. 每个菜单的 `component` 字段用 `import('@/views/' + component + '.vue')` 动态加载

**路由结构**：
```js
{
  path: '/system',
  component: Layout,
  redirect: '/system/user',
  alwaysShow: true,
  children: [
    {
      path: 'user/user-list',
      name: 'UserList',
      component: () => import('@/views/system/user/user-list.vue'),
      meta: { title: '用户管理', icon: 'People', keepAlive: true }
    }
  ]
}
```

**前置守卫**（`permission.ts`）：
- 白名单：`/login`, `/404`, `/403`
- 每次路由切换：`NProgress.start()` → 查 title → 检查 token → 加载菜单 → `NProgress.done()`

### 权限系统

**两套机制**：
1. **路由级**（`routerInterceptor.js`）：菜单加载时已带 `permission` 字段
2. **按钮级**（`v-permission` 指令）：
   ```vue
   <n-button v-permission="'user:save'">新增</n-button>
   <mb-table-col :permission="'user:edit'" />
   ```
   - 实现：`src/utils/permission.js` 的 `checkPermission` 全局注册
   - 权限列表来自 `useUserStore().getAuths`（登录后 `/system/menu/current/menus` 接口返回的 `permissions` 字段）

### 全局 API 前缀

- `VITE_APP_BASE_API`：axios 的 baseURL（默认 `/api`）
- 所有 `$common.post(url, data)` 调用时不需要带前缀
- 文件 URL 用 `$global.filePrefix + encodeURIComponent(path)`

### 菜单 URL 类型（vue-router 之外的特殊菜单）

| `openMode` | 行为 | 何时用 |
|---|---|---|
| `'0'` | 页签（默认） | 标准业务菜单 |
| `'1'` | 新窗口 | 链接到其他系统（url 配 http://...） |
| `'2'` | 动态 SFC | 菜单配置 component_id |

### 全局对象（`$global`、`$common`、`$message`）

```js
// $global (scripts/global.js)
$global.uiSize.value              // 'small' | 'medium' | 'large'
$global.filePrefix                // '/api/file/download?path='
$global.dynamicComponentNames      // 全局注册的动态组件名数组
$global.themeColor                // '#2D8CF0'

// $common (scripts/common.js) — ~380 行工具集
$common.post(url, data)           // 返回 Promise
$common.get(url, params)
$common.put / delete / upload / download
$common.request(method)(url, data)  // 柯里化
$common.renderWhere(where)         // 转换 where 为接口入参
$common.exportExcel({ data, fileName })
$common.copyText(text)
$common.warning(msg, onOk, onCancel)
$common.uuid()
$common.notEmptyNot01(value)      // 排除 0/1/'0'/'1' 后判断非空
$common.getFileSuffixToLowerCase(url)
$common.getValidValue(value, default)
$common.renderIcon(name)          // xicons 渲染

// $message (naive-ui)
$message.success(msg)
$message.error(msg)
$message.warning(msg)
$message.info(msg)

// 字典
import { useDictStore } from "@/store/modules/dictStore";   // ⚠️ 唯一正确路径
const dictStore = useDictStore()
dictStore.getDictLabel(dictType, value)  // 翻译 value→label

// 用户
import { useUserStore } from "@/store/modules/userStore";   // ⚠️ 唯一正确路径
const userStore = useUserStore()
userStore.getAuths        // 权限码数组 ['user:view', 'user:save', ...]
userStore.getMenus        // 路由菜单
userStore.name
userStore.avatar
```

### 字典系统

- 接口：`/sys/dict/items?type={dictType}`
- 缓存：`useDictStore` Pinia 存储，首次调用时按需加载
- 翻译：`dictStore.getDictLabel('sex', '1')` → '男'

### 国际化

- `vue-i18n`（配置在 `src/locales/`）
- `$t('key')` 或 `t('key')`
- 切换：用户配置 → 持久化到 localStorage

### 主题

- naive-ui 内置主题
- `vueuse` 的 `useDark` + `useColorMode`
- 主题色：`$global.themeColor`，可在设置中修改

### 多页签

- `useTabsStore` Pinia 维护 `tabs` 数组
- 切换路由时 push、关闭时 remove
- 支持右键菜单：关闭当前 / 关闭其他 / 关闭全部 / 刷新

### 与后端交互的约定

| 前端 | 后端 | 说明 |
|---|---|---|
| `$common.post('/sys/user/list', where)` | `POST /api/sys/user/list` | baseURL 前缀 |
| 入参 body（JSON） | magic-script 自动解构到变量 | 直接用字段名 |
| 返回 `{ code, message, data, timestamp, executeTime }` | magic-api 自动包装 | success 拦截 |
| 文件下载 `$common.download(path)` | `/api/file/download?path=...` | GET 触发浏览器下载 |
| 图片 `<n-image src="$global.filePrefix + encodeURIComponent(path)" />` | 同上 | |

### 开发约定

- **组件命名**：PascalCase 业务组件，kebab-case 模板引用
- **样式**：`<style scoped>`，scoped 自动隔离
- **TypeScript**：业务组件用 `<script setup lang="ts">`，魔法组件用 JS
- **图标**：用 `mb-icon :icon="IconName"` 统一入口
- **国际化文案**：所有用户可见文字用 `$t('key')`（中文可豁免）

## mb-* 组件目录（速查）

按使用频率排序。**粗体** = 高频 / 核心；普通 = 偶尔使用；斜体 = 特定场景。

### 模板/容器（`template/`）
- **mb-list** — 列表页标准封装：`mb-search` + 工具栏 + `mb-table` + 多选状态管理
- **mb-form** — 表单标准封装：栅格布局 + 动态字段 + 验证 + 保存/详情（详见 02-mb-form）

### 列表/数据（`data/`）
- **mb-table** — 复杂表格：列定义/排序/合计/列拖拽/字典翻译/Excel 导出（详见 01-mb-table）
- **mb-editor-table** — 单元格可编辑表格：点击激活/alwaysEdit/树形增删（详见 03-editor-table）
- **mb-search** — 搜索栏：自动绑定 `where` 字段、搜索/重置事件
- **mb-pagination** — 分页器（`mb-table` 内置，无需直接用）
- *mb-tree* — 树形数据展示（表格 + 树形结构）
- *mb-tree-select* — 树形下拉单选/多选
- *mb-radio-dict* — 字典单选按钮组

### 表单字段（`form/`，配合 mb-form 使用）
- **mb-input** — 文本输入（不写 `component` 时的默认）
- **mb-textarea** — 多行文本
- **mb-select** — 下拉选择（支持 `options` 静态或 `url` 远程）
- **mb-date** — 日期/日期范围（type: date/daterange/datetime）
- *mb-switch* — 开关（type: 'switch'）
- *mb-checkbox* — 复选框/多选
- *mb-select-table* — 弹窗表格选择（适合多字段检索场景）
- *mb-upload-image* — 多图上传（type: 'upload-image'）
- *mb-upload-file* — 文件上传
- *mb-upload-oss-file* — OSS 阿里云文件上传
- *mb-video* — 视频上传

### 反馈/容器（`feedback/`）
- **mb-modal** — 模态框：配合 `mb-form` 做新增/编辑弹窗
- *mb-table-tooltip* — 表格内容悬浮提示（mb-table 内置，无需直接用）

### 基础（`basic/`）
- **mb-icon** — 图标统一入口（xicons 库），`<mb-icon icon="People" />`

### SFC 编辑器（`sfc/`，仅动态组件编辑用）
- *mb-monaco-volar* — Monaco + Volar，编辑动态组件源码
- *mb-vue-init-template* — SFC 初始化模板（新动态组件的脚手架）

### 选型速查

| 需求 | 用什么 |
|---|---|
| 列表页（CRUD） | **mb-list** + **mb-table** + **mb-search** + **mb-modal** + **mb-form** |
| 复杂可编辑表格 | **mb-editor-table** |
| 树形下拉 | mb-tree-select |
| 单选按钮组（字典） | mb-radio-dict |
| 远程搜索下拉 | mb-select（`url` + `filterable`） |
| 复杂弹窗选择 | mb-select-table |
| 多图字段 | mb-upload-image |
| 范围日期 | mb-date（`type: 'daterange'`） |
| 开关字段 | mb-switch |
| 字典翻译展示 | mb-table 列 `dictType: 'xxx'` |
| 动态组件 | sys_dynamic_component + show-component.vue |

### 选型原则

1. **优先高频组件**：mb-list / mb-form / mb-table 覆盖 90% 业务场景
2. **找不到合适的再用 niche 组件**：mb-select-table / mb-tree-select / mb-tree 解决特殊场景
3. **SFC 编辑器不要直接复用**：mb-monaco-volar 是给动态组件编辑器用的，不要在业务页面里用
