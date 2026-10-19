## Bundle Apply（AI 发布的统一入口）

所有 AI 对 Magic-Boot Core 的变更，**统一**通过 `POST /api/ai/bundle/apply` 一次提交。

### 为什么是 Bundle

旧的 API 风格（一堆专用接口）有这些问题：
- AI 每生成一个对象就立刻打 DB，没有 review 机会
- DDL / SFC INSERT / 菜单 INSERT 各自执行，失败会留下脏数据
- 每个接口都要维护鉴权、限流、错误处理

Bundle 模式下：
- 所有变更（SQL + .ms）打包成一个请求
- 失败可整体回滚（SQL 是顺序执行的，前一条失败就停下）
- 用户在编辑器里 review 后再点「发布」
- 后端只有 1 个接口要维护

### Docs 驱动的完整业务项目

当用户给的是 4 份说明书（需求 / 界面 / 数据库 / API）而不是单页面需求时：

1. AI 调 `readDocs` 读 docs/*.md
2. 跟用户讨论 docs 是否要补充/修改
3. 用户确认 → AI 调 `refactorByDocs` 启动全量重建
4. AI 按 docs 顺序生成：
   - 数据库说明书 → `generateDdl` × N
   - API 说明书 → `generateMagicScript` × M（每个 API 4 个 CRUD）
   - 界面说明书 → `writeFile` × P（.vue 页面）
   - 配合 `generateSfcSql` / `generateMenuSql` / `generateDictSql`
5. 用户点「发布」→ applyBundle 一键推送

### 请求体

```json
{
  "sql": [
    { "name": "pro_product.sql", "content": "CREATE TABLE ..." }
  ],
  "ms": [
    {
      "group": "产品管理",
      "groupPath": "product",
      "name": "list",
      "method": "POST",
      "path": "/list",
      "script": "return db.page('...')",
      "permission": "product:list"
    }
  ]
}
```

### 响应

```json
{
  "success": true,
  "appliedSql": ["pro_product.sql (3 stmts)"],
  "appliedMs": ["/data/.../api/产品管理/list.ms"],
  "errors": []
}
```

错误时：
```json
{
  "success": false,
  "appliedSql": ["pro_product.sql (1 stmts)"],
  "appliedMs": [],
  "errors": [{ "type": "sql", "name": "sys_menu.sql", "message": "Duplicate column 'name'" }]
}
```

### AI 端工具对照

| 旧工具（已删除） | 新工具（写到文件树） | 文件位置 |
|---|---|---|
| `createTable`            | `generateDdl`         | `src/sql/ddl/{table}.sql` |
| `createComponent`        | `generateSfcSql`      | `src/sql/sfc/{name}.sql` |
| `registerMenu`           | `generateMenuSql`     | `src/sql/menu/{module}.sql` |
| `saveScript` / `createScript` | `generateMagicScript` | `src/magic-api/{kind}/{group}/{name}.ms` + `group.json` |
| (无)                     | `generateDictSql`     | `src/sql/dict/{type}.sql` |
| `pushFiles` (仅磁盘)     | `writeFile`           | 任意路径 |

### 用户操作流

1. AI 调上述 `generateXxx` 工具 → 写到虚拟文件树
2. 用户在编辑器里看（diff 视图、SQL 高亮）
3. 点「发布」→ `PublishPanel` 扫描 `src/sql/**.sql` + `src/magic-api/**/**.ms` → 调 `applyBundle`
4. 后端按顺序执行，失败回滚（同一 SQL 脚本里的多语句继续，跨 SQL 停下）

### 已删除的后端接口

| 接口 | 状态 | 替代 |
|---|---|---|
| `POST /api/ai/component/save` | 删除 | `generateSfcSql` + `applyBundle` |
| `POST /api/ai/menu/register`   | 删除 | `generateMenuSql` + `applyBundle` |
| `POST /api/ai/table/create`    | 删除 | `generateDdl` + `applyBundle` |
| `POST /api/ai/script/save`     | 删除 | `generateMagicScript` + `applyBundle` |
| `GET /api/ai/table/query`      | 保留（stub） | — |
