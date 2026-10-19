## 数据库操作完整指南

### db 模块基础

无需 import：

```javascript
return db.select('select * from sys_user');           // List<Map>
return db.selectInt('select count(*) from sys_user'); // int
return db.selectOne('select * from sys_user limit 1'); // Map
return db.selectValue('select username from sys_user limit 1'); // Object

return db.update('update sys_user set name = ? where id = ?');   // int 受影响行
return db.insert('insert into ... values (...)', 'id');         // 插入并返回带 id 的对象

return db.page('select * from sys_user');             // {list: [...], total: N}
```

### 列名转换

```javascript
db.camel()    // api_name → apiName
db.pascal()   // api_name → ApiName
db.upper()    // api_name → API_NAME
db.lower()    // API_NAME → api_name
db.default()  // 保持原样
```

例：

```javascript
return db.camel().select('select api_name, api_path from magic_api_info');
// 返回字段为 apiName, apiPath
```

### SQL 占位符

| 语法 | 用途 | 示例 |
|---|---|---|
| `#{var}` | 参数化（防注入，必用） | `where id = #{id}` → `?` |
| `${var}` | 直接字符串拼接（小心注入） | `order by ${columnName}` |
| `?{cond, expr}` | 条件拼接（MyBatis if 风格）| `?{name, and name like '%'||#{name}||'%'}` |

#### #{} 高级用法

```javascript
// 1. 数组自动展开成 IN(?,?,?)
var ids = ['1', '2', '3'];
db.select('select * from magic_api_info where id in (#{ids})')
// → where id in (?, ?, ?)

// 2. 与 LIKE 配合
db.select("select * from sys_user where name like concat('%', #{name}, '%')")
```

#### ?{} 条件拼接

```javascript
db.select("""
    select * from sys_user where 1=1
    ?{name, and name like concat('%', #{name}, '%')}
    ?{role, and role = #{role}
    ?{createDate, and create_date >= #{createDate}}
""")
```

### db.table() 链式 API（1.0.0+，推荐用）

```javascript
// 查询列表
return db.table('magic_api_info').select();

// 查询单列
return db.table('magic_api_info').column('api_name').select();

// 分页
return db.table('magic_api_info').columns('api_method', 'api_path').page();

// 数量
return db.table('magic_api_info').count();

// where 条件（MyBatis-Plus 风格）
return db.table('sys_user')
    .where()
    .eq('role', 'admin')           // =
    .ne('status', 0)               // !=
    .gt('age', 18)                 // >
    .lt('age', 60)                 // <
    .like('name', '%李%')          // LIKE
    .in('dept_id', [1, 2, 3])      // IN
    .select();

// 更新
return db.table('sys_user').primary('id', 'uuid').update({ user_name: '新名字' });

// 插入（自增主键）
return db.table('sys_user').primary('id').insert({ user_name: 'xxx' });

// Upsert（id 已存在则更新，否则插入）
return db.table('magic_api_info').primary('id').saveOrUpdate({
    id: '033239e63a2a42b987567a37a2efdd32',
    api_name: '666'
});

// 逻辑删除
return db.table('sys_user').logic().where().eq('id', id).delete();

// 物理删除
return db.table('sys_user').where().eq('id', id).delete();
```

### 事务

```javascript
// 方式1：自动事务（lambda，简化写法）
var val = db.transaction(() => {
    var count1 = db.update("delete from sys_role where id = ?", roleId);
    var count2 = db.update("delete from sys_user_role where role_id = ?", roleId);
    return count1 + count2;
});
// 成功自动 commit，异常自动 rollback

// 方式2：手动事务
var tx = db.transaction();   // 不传 callback，返回事务对象
try {
    var v1 = db.update("...");
    var v2 = db.update("...");
    tx.commit();
    return v1 + v2;
} catch (e) {
    tx.rollback();
    throw e;
}
```

### 缓存

```javascript
// 基础缓存（TTL 毫秒）
return db.cache('user_list', 60000).select('select * from sys_user');

// 表级缓存 + 失效联动
db.cache('user').table('sys_user').where().eq('id', 1).delete();  // 删除时自动清缓存

// 手动清除
db.deleteCache('user_list');
```

### 多数据源

```javascript
// 1.4.1动态切换数据源.ms
const dbKey = 'slave';
return db[dbKey].select('select 1');

// 直接用数据源名访问
return db.slave.select('select 1');
```

### MyBatis 风格 XML 标签

> magic-api 支持 MyBatis 风格的 XML 动态 SQL

```javascript
// <where> + <if>
return db.select("""
    select api_name from magic_api_info
    <where>
        <if test="name != null and name != ''">
            and api_name like concat('%', #{name}, '%')
        </if>
    </where>
""")

// <foreach> 用于 IN
const idList = ['1', '2', '3'];
return db.select("""
    select id from magic_api_info
    where id in
    <foreach collection="idList" open="(" separator="," close=")" item="item">
        #{item}
    </foreach>
""")

// <if><elseif><else>
const val = 1;
return db.select("""
    select api_name from magic_api_info where
    <if test="val == 2">api_name is not null</if>
    <elseif test="val == 1">api_name = '测试'</elseif>
    <else>api_name is null</else>
""")

// <set> 用于动态 UPDATE
var sql = """
update test_data
    <set>
        <if test="name != null">name = #{name}</if>
        <if test="content != null">content = #{content}</if>
    </set>
    where id = #{id}
""";
return db.update(sql)
```

### 存储过程

```javascript
// 调用存储过程（仅支持无输出参数）
return db.update("""
    call produce_name(#{param1}, #{param2})
""")
```

### LINQ 风格查询

> magic-script 支持类 SQL 的 LINQ 语法对 List/Map 操作

```javascript
var apiList = db.camel().select('select api_name, api_group_id from magic_api_info');

// 简单 SELECT 投影
return select api_name, api_group_id from apiList t

// GROUP BY + COUNT
return
    select t.api_group_id, count(t.api_group_id) count
    from apiList t
    group by t.api_group_id
    order by count(t.api_group_id) desc

// LEFT JOIN
return
    select t.*, g.group_name
    from apiList t
    left join groupList g on t.apiGroupId = g.id

// WHERE
return select * from apiList t where t.sex = 0

// 空值处理
return
    select
        t.name || '无名' name,         // 空值处理（用 || 默认）
        ifnull(t.age, 20) age          // SQL ifnull
    from apiList t

// 递归 CTE 转树
var toTree = (list, parentId) => select
    t.*,
    toTree(list, t.id) children
from list t where t.parent_id = parentId

var flatData = db.select('select id, group_name, parent_id from magic_group');
return toTree(flatData, '0')
```

