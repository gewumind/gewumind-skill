## SQL 动态参数


magic-api 提供三种占位符：

### `#{expression}` — 参数化（防注入）
```js
return db.select('select * from sys_user where id = #{id}');
// 生成：select * from sys_user where id = ?
```

### `${expression}` — 字符串拼接（小心 SQL 注入）
```js
return db.select("select * from sys_user where id = '${id}'");
// 生成：select * from sys_user where id = '123'
```

### `?{condition, expression}` — 条件拼接（类似 mybatis if）
```js
return db.select("select * from sys_user ?{id, where id = #{id}}");
// id 有值：select * from sys_user where id = ?
// id 无值：select * from sys_user

return db.select("select * from sys_user ?{id!=null && id.length() > 3, where id = #{id}}");
```

### 典型 CRUD 模板
```js
// 列表 + 模糊查询
return db.select("""SELECT * FROM sys_user
    ?{name, AND name LIKE concat('%', #{name}, '%')}
    ?{role, AND role = #{role}}
    ORDER BY create_date DESC
""");

// 计数
return db.selectInt('select count(*) from sys_user where is_del = 0');

// 详情
return db.selectOne('select * from sys_user where id = #{id}');

// 保存（upsert）
return db.table('sys_user').primary('id').save(data);

// 软删除
return db.update('update sys_user set is_del = 1 where id = #{id}');
```

## 对应演示文件

- `1数据库操作/1.2使用SQL/1.2.4删除数据.ms` — #{id} 参数化占位符
- `1数据库操作/1.2使用SQL/1.2.6修改数据.ms` — 脚本变量引用
- `1数据库操作/1.4其它/1.4.7动态参数判断.ms` — #{} / ${} / ?{} 三种参数方式
