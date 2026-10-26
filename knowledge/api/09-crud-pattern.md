## CRUD 标准模式

### 列表（带可选过滤）

```javascript
// 不带分页
return {
    list: db.camel().select("""
        SELECT id, app_name, app_key, status, create_date
        FROM sys_open_app
        WHERE is_del = 0
        ?{name, AND app_name LIKE CONCAT('%', #{name}, '%')}
        ORDER BY create_date DESC
    """)
}

// 带分页（与 mb-table 配合）
return db.camel().page("""
    SELECT * FROM sys_user
    WHERE is_del = 0
    ?{keyword, AND name LIKE CONCAT('%', #{keyword}, '%')}
""")
```

**前端 `mb-table` 默认 `method: 'POST'`**，会自动发送 `current`/`size` + where 条件。

### 详情

```javascript
return db.selectOne("SELECT * FROM sys_user WHERE id = #{id} AND is_del = 0");
```

### 保存（新增 + 编辑）

⚠️ **必须**优先参考 `data/zh/magic-api/api/系统管理/用户管理/保存.ms` 这种"项目标准模板"，不要自己编。

```javascript
// 1. 校验必填
if (!app_name || app_name == '') {
    exit 0, '应用名称不能为空'
}
if (!app_key || app_key == '') {
    exit 0, 'AppKey 不能为空'
}

// 2. 唯一性校验
var count = db.selectInt("select count(1) from sys_open_app where is_del = 0 and app_key = #{app_key} ?{id, and id != #{id}}");
if (count > 0) {
    exit 0, 'AppKey 已存在';
}

// 3. 组装数据（用 bare 变量，对应 form-urlencoded 字段）
var app = {
    id,
    app_name,
    app_key,
    app_secret,
    status: status::int(1),
    rate_limit: rate_limit ? (rate_limit::int) : null,
    rate_duration: rate_duration ? (rate_duration::int) : 60
};
// 注意：saveOrUpdate 会自动为空的 id 生成 UUID，不需要手动 uuid()

// 4. 保存
return db.table('sys_open_app').primary('id').saveOrUpdate(app)
```

### 软删除

```javascript
// 1. 校验
if (!id || id == '') {
    exit 0, 'id 不能为空'
}

// 2. 关联校验（按业务需要）
var childCount = db.selectInt('select count(1) from sys_user where office_id = #{id} and is_del = 0');
if (childCount > 0) {
    exit 0, '该组织下还有用户，无法删除';
}

// 3. 逻辑删除
db.table('sys_open_app').logic().where().eq('id', id).delete();
return true;
```

**DELETE 方法**（前端 `$common.handleDelete` 用 `params` 传 query string）：

```json
{
  "method": "DELETE",
  "parameters": [{"name": "id", "required": true, "dataType": "String"}]
}
================================
if (!id || id == '') { exit 0, 'id 不能为空' }
db.table('sys_user').logic().where().eq('id', id).delete();
return true;
```

### 批量删除

```javascript
for (id in ids.split(',')) {
    if (id && id != '') {
        db.table('sys_user').logic().where().eq('id', id).delete();
    }
}
return true;
```

## ⚠️ 关键约定

1. **POST 表单提交** → magic-api 自动把 form-urlencoded 字段映射为 bare 变量
2. **POST JSON body** → 必须用 `body.xxx` 访问
3. **GET/DELETE query string** → 直接是 bare 变量
4. **保存不要用 save()**，必须用 **saveOrUpdate()**（自动 upsert，空 id 时系统填充 UUID）
5. **前端 $common.handleDelete** 用 DELETE + query，自动匹配 method:DELETE + bare id
