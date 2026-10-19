# Magic-Script 语言规范

> Magic-Script 是 magic-api 的脚本语言，基于 Java 平台，语法类似 JavaScript 但有大量差异。本文档是 AI 生成代码的语法权威参考。

## 1. 变量与类型

```javascript
var x = 1;              // 整数（Java int）
var y = 1L;             // 长整数（Java long）
var z = 1.5d;           // 双精度（Java double）
var f = 1.5f;           // 单精度（Java float）
var b = 1b;             // 字节
var s = 1s;             // 短整型
var m = 1m;             // BigDecimal
var bool = true;        // 布尔
var str = "字符串";     // 字符串
var str2 = '单引号';   // 同上
var list = [1, 2, 3];  // 列表
var map = { key: 1, name: "test" };  // Map
var nullVal = null;
```

**⚠️ `const` 声明不支持** — 只用 `var`

## 2. 字符串

```javascript
// 普通字符串
var s = "hello" + " " + "world";

// 模板字符串（支持 ${} 表达式）
var a = 200;
var x = `${a + 22}`;        // "222"
return `result: ${a}`;       // "result: 200"

// 文本块（多行 SQL）
return """
    select * from table_name
    where is_del = 0
    and name like concat('%', #{name}, '%')
""";

// 转义
// 支持: \t, \n, \r, \', \", \\
// 不支持: \u, \x, \0 等
```

## 3. 条件与循环

### if / else
```javascript
if (x > 10) {
    return x;
} else if (x > 5) {
    return 5;
} else {
    return 0;
}

// 三元表达式
return x >= 18 ? '成年' : '未成年';
```

### for 循环（唯一循环语法）
```javascript
// 遍历范围（含首尾）
for (val in range(0, 100)) {
    sum = sum + val;
}

// 遍历列表
for (val in [1, 2, 3, 4, 5]) {
    sum = sum + val;
}

// 遍历 Map（同时取 key 和 value）
for (key, value in map) {
    result = result + key + value;
}

// ⚠️ 没有 continue 的情况下循环内跳过后续逻辑 — 只能靠 if 包裹
for (val in range(0, 10)) {
    if (val % 3 == 0) {
        // 跳过 — 直接 continue 不支持（见下方说明）
    }
    sum = sum + val;
}
```

### while 循环
```javascript
var i = 0;
while (i < 100) {
    sum = sum + i;
    i = i + 1;
}
```

### break — 支持
```javascript
for (val in range(0, 100)) {
    if (val > 90) {
        break;  // ✅ 退出循环
    }
    sum = sum + val;
}
```

### continue — ❌ 不支持
```javascript
// ❌ 错误！magic-script 没有 continue
for (val in range(0, 10)) {
    if (val % 3 == 0) {
        continue;  // 编译报错
    }
    sum = sum + val;
}

// ✅ 正确写法：if 包裹整个逻辑
for (val in range(0, 10)) {
    if (val % 3 != 0) {
        sum = sum + val;
    }
}
```

## 4. try / catch / finally

```javascript
try {
    x = 10 / 0;
    return x;
} catch (e) {
    return 0;
}

// finally（finally 的 return 会覆盖 try/catch 的 return）
try {
    return 2 / 0;
} catch (e) {
    return 9;
} finally {
    return 8;  // 最终返回 8
}

// 吞掉异常继续执行
try {
    db.update("delete from xxx where id = #{id}");
} catch (e) {
    // 忽略错误
}
```

## 5. 运算符

### 算术
```javascript
+, -, *, /, %       // 标准运算
a += 1;            // 复合赋值
++a;  a++;         // 自增（前后置都支持）
```

### 比较
```javascript
==, !=, <, >, <=, >=       // 标准比较
===, !==                    // 严格相等
```

### 逻辑
```javascript
&&, ||, !                   // AND, OR, NOT
true && false                // false
```

### 类型检查
```javascript
// ✅ 用 instanceof（不是 typeof）
if (value instanceof Number) { ... }

// ✅ 用 instanceof String
if (value instanceof String) { ... }
```

### 类型转换
```javascript
// cast 运算符 `::`
"123"::int              // String → int
"123"::double           // String → double
123d::int              // double → int

// 带默认值的转换（转换失败返回默认值）
"abc"::int(0)          // "abc" 转 int 失败 → 0
null::long::double(0)  // 链式
```

### 其他
```javascript
// 三元
x > 0 ? x : -x

// 安全导航
map?.key?.subKey        // null 时短路返回 null

// instanceof
value instanceof String  // true/false

// 静态方法调用
DateFormat.LONG
```

## 6. 函数定义

```javascript
// 函数是 lambda 表达式，赋值给变量
var add = (a, b) => a + b;
var greet = () => { return "hello"; };
var print = x => { println(x); };

// 调用
return add(1, 2);         // 3
return greet();             // "hello"
```

## 7. Map 和 List 操作

```javascript
// Map 字面量
var map = { id: 1, name: "test", code: "T001" };

// 访问属性
map.name
map['name']
map?.name                  // 安全访问

// 赋值
map.name = "new name";
map['code'] = "T002";

// List 字面量
var list = [1, 2, 3, 4, 5];

// 遍历
for (val in list) {
    sum = sum + val;
}

// 索引访问
list[0]
list[0] = 100;

// 常用方法
list.size();
list.add(1);
list.get(0);
list.stream().map(it => it + 1);
list.first();

// 展开操作
sum(...[1, 2, 3])         // 函数参数展开
[...list1, ...list2]      // 数组合并
{...map1, ...map2}        // Map 合并
```

## 8. 解构

```javascript
// 对象解构
var {a, b} = {a: 1, b: 2}

// 数组解构
var [c, d] = [3, 4]

// rest
var {a, b, ...rest} = {a: 1, b: 2, c: 3, d: 4}
var [o, p, ...q] = [11, 12, 13, 14, 15, 16]
```

## 9. exit 语句（提前返回）

```javascript
exit;                     // 无值退出
exit 0, "成功";           // code=0, message="成功"
exit 400, "参数错误";     // code=400, message
exit 200, "msg", data;    // code, message, data

// 示例
if (!id) {
    exit 0, "id 不能为空";
}
```

## 10. import（导入 Java 类）

```javascript
// ✅ 正确
import 'java.util.Date';
import 'java.text.SimpleDateFormat';
import 'cn.dev33.satoken.stp.StpUtil';
import org.ssssssss.magicapi.modules.db.cache.SqlCache;

// ✅ 带别名
import 'java.text.SimpleDateFormat' as SDF;
var df = new SDF('yyyy-MM-dd');

// ✅ 导入并使用
import cn.dev33.satoken.secure.SaSecureUtil;
var hash = SaSecureUtil.sha256(password);

// ❌ 不支持 ES6 import
import xxx from 'module'    // ❌
import { xxx } from 'module'  // ❌
```

## 11. 数据库操作（db 对象）

### 分页列表
```javascript
return db.page("""
    select * from table_name
    where is_del = 0
    ?{name, and name like concat('%', #{name}, '%')}
    ?{status, and status = #{status}}
    ?{orderByColumn, order by ${orderByColumn} ${direction == 0 ? 'asc' : direction == 1 ? 'desc' : ''}}
    ?{!orderByColumn, order by create_date desc}
""");
```

### 单条查询
```javascript
return db.selectOne("select * from table_name where id = #{id} and is_del = 0");

// 带参数默认值
var count = db.selectInt("select count(1) from table_name");
```

### 插入
```javascript
// 方式1: db.table + primary + insert
var id = uuid();
db.table("table_name").primary("id").insert({ id: id, name: name, code: code });

// 方式2: 原生 SQL
db.update("insert into table_name (id, name) values (#{id}, #{name})");

// 方式3: saveOrUpdate（自动判断）
var entityId = db.table("table_name").primary("id").saveOrUpdate({ id: id, name: name });
```

### 更新
```javascript
// 方式1: db.table + primary + update
db.table("table_name").primary("id").update({ id: id, name: name });

// 方式2: 原生 SQL
db.update("update table_name set name = #{name}, update_date = now() where id = #{id}");
```

### 删除（逻辑删除）
```javascript
// 方式1: db.table().logic().where().eq().delete()
db.table("table_name").logic().where().eq("id", id).delete();

// 方式2: 原生 SQL
db.update("update table_name set is_del = 1, update_date = now() where id = #{id}");

// 批量删除
var idList = ids.split(',');
for (id in idList) {
    if (id && id != '') {
        db.table("table_name").logic().where().eq("id", id).delete();
    }
}
```

### SQL 拼接语法（模板）
```javascript
// #{var} — 参数化（防注入），必须用这个
db.update("update table set name = #{name} where id = #{id}");

// ${var} — 字符串拼接（小心注入）
db.update("update table set name = '${name}' where id = ${id}");

// ?{condition, sql} — 条件拼接
"?{name, and name like '%' || #{name} || '%'}"
"?{status, and status = #{status}}"
"?{!orderByColumn, order by create_date desc}"
```

## 12. 其他常用函数

```javascript
uuid()                     // 生成 UUID
range(0, 100)             // 包含首尾的范围
current_timestamp()        // 当前时间戳（毫秒）
println(...)               // 打印日志
Arrays.asList(1, 2, 3)   // Java Arrays 工具
```

## 13. 跨接口调用

```javascript
// 调用其他 API
import "@post:/sys/role/list" as RoleList
var roles = RoleList({ keyword: '' })

// 调用自定义函数
import '@get:/group/function_name' as MyFunc
```

## 14. 正则表达式

```javascript
var reg = /abc.*?f/gis;
reg.test("abcdef");                    // true
"abc123def".match(/(\d+)/)[0];        // "123"
```

## 15. 日期时间

```javascript
// 当前日期
var now = new date();

// 格式化
new date().format("yyyy-MM-dd HH:mm:ss");

// 字符串转日期
var date = "2024-01-01"::date('yyyy-MM-dd');

// 日期运算（加天数）
var tomorrow = new date().time + 86400000;
```

## ❌ 绝对禁止的语法

| 语法 | 错误原因 |
|---|---|
| `typeof xxx` | ❌ 不存在 typeof，用 `instanceof` |
| `import assert;` | ❌ 没有 `assert` 模块（`assert` 是语法特性，直接用） |
| `assert.notBlank(name, msg)` | ❌ 没有模块 API，直接用 `assert name != null : 400, 'msg'` |
| `continue` | ❌ 不支持 continue，用 `if` 包裹替代 |
| `switch / case / default` | ❌ 不支持 switch |
| `do { } while()` | ❌ 不支持 do-while |

> ✅ `assert cond : code, msg` 是 magic-script 的语法糖，失败时直接 `exit`：
> ```js
> assert name != null && name != '' : 400, '名称不能为空'
> ```
> 等价于 `if (!(name != null && name != '')) { exit 400, '名称不能为空' }`
| `class Foo {}` | ❌ 不支持类定义 |
| `export xxx` | ❌ 不支持 export |
| `const x = 1` | ❌ 不支持 const |
| `void expr` | ❌ 不支持 void |
| `delete obj.key` | ❌ 不支持 delete 操作符 |
| `import xxx from 'module'` | ❌ 不支持 ES6 import |
| `await expr` | ❌ 不支持 await，用 `async + .get()` |
| `label: for(...)` + `break label` | ❌ 不支持标签语句 |

## ✅ 推荐写法 vs ❌ 错误写法

```javascript
// ✅ 判断字符串
if (value instanceof String) { ... }

// ❌
if (typeof value === 'string') { ... }

// ✅ 跳过循环项
for (val in range(0, 10)) {
    if (val % 3 == 0) {
        // 跳过此迭代
    }
    sum = sum + val;
}

// ❌
for (val in range(0, 10)) {
    if (val % 3 == 0) continue;  // 语法错误
    sum = sum + val;
}

// ✅ 批量删除
for (id in idList) {
    if (id && id != '') {
        db.table("table_name").logic().where().eq("id", id).delete();
    }
}
return true;

// ✅ 保存（自动 upsert）
var entity = {
    id : body.id,
    name : body.name,
    code : body.code
}
if (entity.id && entity.id != '') {
    db.table('table_name').primary('id').update(entity);
    return db.selectOne('select * from table_name where id = #{id}', {id: entity.id});
} else {
    entity.id = uuid();
    db.table('table_name').primary('id').insert(entity);
    return { id: entity.id };
}

// ✅ 参数用 body. 前缀
var name = body.name;
var code = body.code;
db.update("update table set name = #{name} where id = #{id}");
```

## ⚠️ 前端请求 Content-Type 与参数解析

gewumind-boot 前端 `$common.post(url, data)` 发送 `Content-Type: application/x-www-form-urlencoded`。

| 请求 Content-Type | magic-api 变量解析 |
|---|---|
| `application/x-www-form-urlencoded` | 每个字段 → bare 变量（`ids`, `name`）+ `body` 对象 |
| `application/json` | 整个 JSON → `body` 对象 |

**实际验证结论（2026-06-04）**：
- `$common.post('/api/delete', {ids: 'xxx'})` → form-urlencoded → **用 bare `ids` 变量正确**
- `$common.post('/api/save', {...})` → form-urlencoded → **用 bare 变量 + `body` 都正确**

**CRUD 推荐写法**：
```javascript
// 保存
return db.table('table_name').primary('id').saveOrUpdate(body)

// 删除
return db.table('table_name').logic().where().eq('id', ids).delete()

// 详情
return db.selectOne("select * from table_name where id = #{id}")

// 列表
return db.page("select * from table_name where is_del = 0 ?{name, and name like concat('%',#{name},'%')}")
```

**⚠️ 绝对禁止**：`saveOrUpdate(data)` 中的 `data` 在 form-urlencoded 请求下不可靠，应始终用 `body`。
