## MyBatis 动态 SQL


### 支持的关键字

| 关键字 | 用途 |
|--------|------|
| `<if>` | 条件判断 |
| `<elseif>` | 多分支 |
| `<else>` | 否则分支 |
| `<where>` | 自动处理 WHERE / 移除开头 AND / OR |
| `<foreach>` | 遍历集合（生成 IN / VALUES / 批量） |
| `<trim>` | 自定义前后缀剥离（where / set 的底层） |
| `<set>` | 自动处理 SET / 移除尾部逗号 |

### `<where>` + `<if>`

`where` 元素只在子元素返回任何内容时插入 WHERE 子句，且自动去除开头的 AND / OR：

```javascript
return db.select("""
    select * from test_data
    where 1 = 1
    <if test="id != null">
        and id = #{id}
    </if>
""")
```

等价的 `<trim>` 写法：
```xml
<trim prefix="WHERE" prefixOverrides="AND |OR ">
  ...
</trim>
```

### `<if>` / `<elseif>` / `<else>`（互斥分支）

```javascript
var sql = """
select * from test_data
    where
    <if test="id == null">id = 0</if>
    <elseif test="id < 1000">id = #{id}</elseif>
    <else>id = -1</else>
"""
return db.select(sql)
```

### `<foreach>`（遍历集合）

```javascript
var sql = """
select * from test_data
where id in
<foreach item='item' index='index' collection='body.ids'
      open="(" separator="," close=")">
    #{item}
</foreach>
"""
return db.select(sql)
```

属性：
- `collection`：要遍历的集合（支持 `body.ids` 这种点路径）
- `item`：每次迭代的变量名
- `index`：索引变量（可选）
- `open` / `close`：包裹字符
- `separator`：分隔符

### `<set>` + `<if>`

动态 UPDATE，自动处理尾部逗号：

```javascript
var sql = """
update test_data
    <set>
        <if test="name != null">name = #{name}</if>
        <if test="content != null">content = #{content}</if>
    </set>
    where `id` = #{id}
"""
return db.update(sql)
```

等价的 `<trim>` 写法：
```xml
<trim prefix="SET" suffixOverrides=",">
  ...
</trim>
```

### 嵌套使用

```javascript
var sql = """
update test_data
    <set>
        <if test="name != null and name != ''">
            name = #{name},
        </if>
        <if test="ids != null and ids.size() > 0">
            <foreach collection="ids" open="(" separator="," close=")">
                #{item}
            </foreach>
        </if>
    </set>
    where id = #{id}
"""
return db.update(sql)
```

### 对比：MyBatis 标签 vs magic-api `?{}` 条件

| 写法 | 适用 |
|------|------|
| `<if>` / `<where>` / `<foreach>` / `<set>` | 复杂 SQL（动态列、批量、子查询） |
| `?{condition, expr}` | 简单条件追加到 SQL 末尾 |

```javascript
// MyBatis 风格
db.select("""
    select * from magic_api_info
    <where>
        <if test="name != null and name != ''">
            and api_name like concat('%', #{name}, '%')
        </if>
    </where>
""")

// magic-api 简写
db.select("""
    select * from magic_api_info
    ?{name, and api_name like concat('%', #{name}, '%')}
""")
```

### 注意事项

- `<if test="...">` 内的表达式是 magic-script 语法，可以用 `&&` `||` `!=` 等运算符
- MyBatis 的 `<bind>` / `<choose>` / `<when>` / `<otherwise>` / `<include>` / `<sql>` **不支持**
## 对应演示文件

- `1数据库操作/1.3使用mybatis语法/1.3.1使用if标签.ms` — <if> + <where> 动态查询
- `1数据库操作/1.3使用mybatis语法/1.3.2使用foreach标签.ms` — <foreach> 遍历 IN 条件
- `1数据库操作/1.3使用mybatis语法/1.3.3使用elseif标签.ms` — <if>/<elseif>/<else> 多分支
- `1数据库操作/1.3使用mybatis语法/1.3.4使用set标签.ms` — <set> 动态更新
