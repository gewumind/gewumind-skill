## LINQ 语法（在 magic-script 中嵌入 SQL 操作集合）


### 完整语法

```sql
select 
    tableAlias.* | [tableAlias.]field [columnAlias]
    [,tableAlias.field2 [columnAlias2][,…]]
from expr[,…] tableAlias
[[left] join expr tableAlias2 on condition]
[where condition]
[group by tableAlias.field[,...]]
[having condition]
[order by tableAlias.field[asc|desc][,tableAlias.field[asc|desc]]]
[limit expr [offset expr]]
```

### 执行步骤

1. 从 `from` 子句创建虚拟表 VT1
2. 处理 `join`，创建虚拟表 VT2（筛选符合 `condition` 的行）
3. 处理 `where`，符合 `condition` 的行加入 VT1
4. 处理 `group by`，对 VT1/VT2 分组，将符合 `having` 的值加入 VT3
5. 处理 `select`，从 VT3 选择指定列加入 VT4
6. 处理 `order by`，对 VT4 排序
7. 处理 `limit`

### select 子句

```javascript
// 字段 + 别名（中间无逗号）
select t.name, sum(t.score) score, t.* from list t
```

> select 中带有聚合函数的，应该有 group by 语句，否则不会进行聚合处理。

### from 子句

```javascript
// 必须是 List 或 Map；别名是必须的
from [{name: 'Gitee'}, [name: 'Github']] t
from results t
from {name: 'Gitee'} t
```

### join 子句

```javascript
// 三种 join 都支持
[left] join [{name: 'Gitee'}, [name: 'Github']] t1 on t1.name = t.name
[left] join results t1 on 1 = 1
[left] join {name: 'Gitee'} t1 on t1.name = 'Gitee' and 1=1
```

### where 子句

```javascript
// or 等价于 ||，and 等价于 &&，可以混合使用
where t.name = 'Gitee' or t.name = 'Github' and 1=1 && 2=2
```

### group by / having

```javascript
// 分组操作
group by t.name, t1.xxx

// 嵌套 group（行转列）
var result = db.select('select api_method,api_group_id from magic_api_info')
var pivot = (list) => list.group(it => it.api_method, values => values.size())

select * from (
    select mg.group_name, pivot(ma)
    from result ma
    join db.select('select id,group_name from magic_group') mg on mg.id = ma.api_group_id
    group by ma.api_group_id
    having count(ma.api_method) > 5
) t
order by t.POST desc
```

### order by / limit

```javascript
// asc 可以不写，默认是 asc
order by t.name desc, t.xxx

limit 1                                                  // 固定取第一项，返回值会是对象而非 List
limit pageSize offset (page - 1) * pageSize               // 跳过 (page-1)*pageSize 取 pageSize 条
limit pageSize                                            // 取前 pageSize 条
```

### list 转 tree

```javascript
var toTree = (list, parentId) =>
    select t.*, toTree(list, t.id) children
    from list t
    where t.parent_id = parentId

return toTree(db.select('select id,group_name,parent_id from magic_group'), '0')
```

### 空值处理

```javascript
// || 把 null / 空字符串 / 0 / 空集合视为空
// ifnull 只判断 null
return
    select
        t.name || '无名' name,
        ifnull(t.age, 20) age
    from list t
```

### 对比：LINQ vs 链式 API

| 场景 | LINQ 写法 | 链式 API 写法 |
|------|----------|------------|
| 分组 | `select t.x, count(t.x) from list t group by t.x` | `list.group(t => t.x).map((k,v) => ...)` |
| 过滤 | `select * from list t where t.x > 10` | `list.filter(t => t.x > 10)` |
| 关联 | `select * from a left join b on a.id = b.id` | `a.join(b, (x,y) => x.id == y.id)` |
| 转换 | `select t.x*2 as y from list t` | `list.map(t => ({ y: t.x * 2 }))` |

**选择建议**：
- 简单集合操作 → **链式 API**（更通用，可读性好）
- 复杂 SQL 逻辑（子查询、having、复杂 join） → **LINQ**（更接近 SQL 思维）
## 对应演示文件

- `5进阶操作/5.1LINQ相关/5.1.1分组.ms` — group by / having
- `5进阶操作/5.1LINQ相关/5.1.2关联.ms` — LEFT JOIN 表关联
- `5进阶操作/5.1LINQ相关/5.1.3过滤.ms` — WHERE 条件过滤
- `5进阶操作/5.1LINQ相关/5.1.4空值转换.ms` — || 空值处理
- `5进阶操作/5.1LINQ相关/5.1.5字段转换.ms` — 三目运算符字段映射
- `5进阶操作/5.1LINQ相关/5.1.6list转tree.ms` — 递归树构建
- `5进阶操作/5.1LINQ相关/5.1.7行转列.ms` — Pivot 数据透视表
