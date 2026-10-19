# 命名约定 / 颜色 / 导出 / 错误排查

## 命名约定

| 元素                   | 规则                                       | 示例                                  |
| ---------------------- | ------------------------------------------ | ------------------------------------- |
| `.ms` 文件             | 小写英文 + .ms 后缀                      | `sales-quarterly.ms`                 |
| `.ms` 文件 id 字段     | `rpt-<name>-api-001`                       | `rpt-sales-quarterly-api-001`         |
| `.ms` 文件 path 字段   | `/<name>`（与文件名一致）                | `/sales-quarterly`                    |
| 前端 page 路径         | `frontend/src/views/report-demo/<name>.vue` | `sales-quarterly.vue`                 |
| 路由 URL              | `/report-demo/<name>`                      | `/report-demo/sales-quarterly`        |
| entryApi prop          | `/data/report-op/<name>`                  | `/data/report-op/sales-quarterly`     |
| 后端 groupId           | `rpt-op-group-001`（固定不变）            | —                                      |
| sys_menu id            | `rpt-demo-<name>`                          | `rpt-demo-sales-quarterly`             |
| 菜单 sort             | 95-110 范围已有约定，新报表接续            | 106 续在 merge (105) 后                |

不要复用一个 `.ms` 文件挂多个 menu。**每张报表一个 .ms + 一个薄壳 page + 一个菜单项** 是最干净的做法。

## 颜色 / tag 类型

naive-ui 的 `n-tag` type 与语义对应：

| type       | 视觉                          | 业务含义                       |
| ---------- | ----------------------------- | ------------------------------ |
| `default`  | 灰色                          | 中性 / 已结束                  |
| `success`  | 绿                            | 已通过 / 已批准 / 增长         |
| `warning`  | 黄                            | 待处理 / 风险 / 警告          |
| `error`    | 红                            | 失败 / 已驳回 / 已撤回        |
| `info`     | 蓝                            | 信息 / 进行中 / 提示          |

用 `tagMap: { value: 'xxx' }` 把后端 status 字符串映射成 tag 类型。

## cellStyle 中常用的颜色

```js
// 增长率（红黄绿三档）
cellStyle: (v) => ({
    color: v >= 0.1 ? '#2e7d32'     // 深绿：>=10%
          : v >= 0 ? '#1976d2'        // 蓝：>0
          : '#c62828',                 // 红：<=0
    fontWeight: 600
})

// 进度条（按值显示）
cellStyle: (v) => ({
    background: v >= 0.9 ? '#e8f5e9'   // 浅绿 >=90%
              : v >= 0.5 ? '#fff8e1'   // 浅黄 >=50%
              : '#ffebee',             // 浅红 <50%
    textAlign: 'center',
    fontWeight: 600
})

// 金额阈值（万元红警）
cellStyle: (v) => ({
    color: v >= 1000000 ? '#d32f2f' : null,
    background: v >= 1000000 ? '#fff5f5' : null
})
```

## 导出 Excel

MagicReport 自带导出（点击"导出 Excel"按钮）。要点：

1. **必须用 `xlsx-js-style`** —— 工程 `package.json` 里是 `xlsx-js-style` 而不是 `xlsx`。后者会丢失所有颜色样式。
2. **导出格式**：`format: 'money' / 'number' / 'percent'` 会被保留为字符串，单元格样式不会自动加 ¥ 符号
3. **Excel 多 Sheet**：用 MagicReport 的 `tabs` slot，wrap `<n-tabs>`，再 `onExportMultiSheet` 触发多 sheet 写出

```js
import * as XLSX from 'xlsx-js-style'
import dayjs from 'dayjs'

function onExportMultiSheet() {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers.value), '供应商')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orders.value), '订单')
    XLSX.writeFile(wb, 'suppliers-' + dayjs().format('YYYYMMDD') + '.xlsx')
}
```

## 错误排查表

| 现象                                       | 原因                                              | 解决                                                                   |
| ------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 表格空白，Network 看 API 返回 `{"code": 200, "data": []}` | 入参写错（magic-script 没读到 body 字段） | 后端 `.ms` 用 `body.month`，不是 `month`                                |
| 表格空白，Network 返回 `[...]`              | 自定义 `@RestController` 没经过 magic-api 包装    | 在 controller 上手动包 `{code: 200, data: ...}`                        |
| 表格空白且网络根本没请求                  | entryApi 路径写错                                 | 看 console.log，应该 `<baseURL>/data/report-op/<name>`                  |
| tagMap 没颜色                            | key 是数字，不是字符串                           | key 转字符串；或者在 tagMap 里也用数字 key                            |
| 跨行合并失败                             | rowSpan 闭包没有引用最新的 rows                    | 用 `const reportRows = ref([])` + `reportRows.value` 拿当前数据    |
| Cascader 不展开                          | 数据格式不对                                     | 必须是 `{label, value, children?}`                                  |
| autocomplete 不联想                      | optionsApi 请求方式不对                          | 请求 body 用 `{kw: '<搜索词>'}`                                    |
| 子查询 select 选项一直是空                | optionsApi 引用的 API 没注册 / 没启动            | magic-api 启动后要解析所有 .ms 看启动日志确认成功                      |
| Excel 颜色 / tag 全丢了                  | 用错了 xlsx 包                                    | 改用 `xlsx-js-style`                                                  |
| tagMap 都变 default                       | value 没匹配上 key                                | key 必须严格相等（包括大小写）；用 `labelMap` 兼容旧值               |
| 菜单看不到                                  | open_mode='0' 或 sys_role_menu 没 INSERT         | 在菜单 INSERT 后同时加进 sys_role_menu                                |
| 子节点形式（children）只显示其中一列      | children array 为空数组                          | 检查 children 至少 1 个                                              |
| `resizable: false` 不生效               | 字段拼错大小写                                    | 字段是 `resizable`，不是 `resize`                                    |
| 切换 dark / light 模式颜色错乱           | cellStyle / tagMap 用了硬编码颜色               | 改用 CSS 变量或 conditional class                                     |

## 常见错误代码

### `MagicReport` props 校验

MagicReport 不强制 props，但传错类型会导致：

| 错传类型                                | 现象                                       |
| -------------------------------------- | ------------------------------------------ |
| `entryApi` 拼成 `/data/report-op//name` (path 含 `//`) | 网络请求 404                            |
| `params: 'foo'` (应是 Array)           | Vue warn，但运行时尝试 .filter 报错         |
| `columns[i].format: 'RMB'`            | formatCell fallback 到 String() 不报错    |

错误一般会打印在浏览器 console，从 F12 → Console 拿到完整栈。

### 后端 magic-script 错误

- **空指针错误**：`NullPointerException` 通常是 `.ms` 里访问 `body` 上的字段，但 body 是 `null`（POST 没传 body）。处理：`var x = (body == null ? '' : body.x)`
- **`Cannot find column`**：`db.select("SELECT * FROM t")` 中的 `t` 表不存在 → 检查 `data-magic-api/` 下的建表 SQL
- **`Parse error at line X`**：magic-script 语法错误 → 看 `Column X` 列附近的语法（漏写 `}`、未闭合的 `(`
- **`期待 ')' 获得 'xxx'`**：变量名或方法名拼错 → 检查变量是否先前定义
- **返回空数组**：SQL 条件没匹配上 → 在 .ms 加 `log.info('debug msg')` 或控制台 echo 调试

## 进阶：如何测试 MagicReport

```bash
# 后端启动后，浏览器打开
http://localhost:9089/api/magic/web/index.html#/report-demo/profit

# 或直接 curl 测试 API
curl -X POST http://localhost:9089/api/data/report-op/profit \
     -H 'token: <your-token>' \
     -H 'Content-Type: application/json' \
     -d '{"month":"2026-07"}'
```

返回 `{code: 200, message: "success", data: [...]}` 就 OK。

## 进阶：发布流程

1. dev 在 ai-design-frontend 里写"魔法报表"插件，让用户在前端填"报表名 + params + columns"
2. 插件生成 `.ms` 和 `.vue` 写到 `<project>/src/magic-api/...`
3. 用户点"发布"→ `applyBundle` 同步到后端 `data/magic-api/api/...`
4. 同时 INSERT `sys_menu` + `sys_role_menu`
5. 重启后端 → 用户在浏览器侧边栏看到新报表

**注意**：发布前必须先 read 这份 skill + 0X 开发手册（`docs/gewumind-boot/09-magic-report-guide.md`），不要硬编码中文菜单文本，不要把 props 写错位置。

## 对应演示文件

- `6报表操作/` — 12 个已完成报表，可作为命名、颜色、导出的参考
