## 脚本语法（magic-script 1.x）

magic-script 是 magic-api 内置的动态脚本语言，语法类似 JavaScript 但基于 JVM。

### 关键字

| 关键字 | 含义 |
|---|---|
| `var` | 定义变量（**不支持 `const` `let`**） |
| `if` / `else` / `else if` | 条件分支 |
| `for ... in` | 遍历集合/Map/range |
| `while` | while 循环 |
| `break` | 跳出循环 |
| `continue` | ❌ **不支持**，用 `if` 包裹替代 |
| `return` | 返回 |
| `exit code, msg, data?` | 终止并返回指定响应 |
| `assert cond : code, msg` | 条件断言（失败时 exit） |
| `try` / `catch` / `finally` | 异常处理 |
| `import` / `as` | 导入 Java 类或内置模块 |
| `new` | 创建 Java 对象 |
| `async` | 异步调用（`.get()` 获取结果） |
| `switch` / `case` | ❌ **不支持** |
| `do...while` | ❌ **不支持** |
| `class` | ❌ **不支持类定义** |

### 类型字面量

| 字面量 | 类型 |
|---|---|
| `123b` / `123s` | byte / short |
| `123` | int（默认） |
| `123l` | long |
| `123.456f` | float |
| `123.456d` | double |
| `123.456m` | **BigDecimal**（金钱计算必须用 m 后缀） |
| `'hello'` / `"hello"` | String |
| `"""多行字符串"""` | 多行字符串（用于 SQL） |
| `/\d+/g` | 正则 Pattern |
| `()=>expr` | lambda |
| `[1,2,3]` | List |
| `{k:v}` | Map |
| `true` / `false` / `null` | 布尔 / 空值 |

### 类型转换 `::` 运算符

```javascript
"123"::int             // 123
"123.5"::double        // 123.5
"abc"::int(0)          // 带默认值：转换失败返回 0
null::long::double(0)  // 链式转换
"2020-01-01"::date('yyyy-MM-dd')  // 字符串转 Date
'{"a":1}'::json        // 解析 JSON
{a:'1'}::stringify     // Map 转 JSON 字符串
```

### 运算符

| 类别 | 符号 |
|---|---|
| 数学 | `+` `-` `*` `/` `%` `++` `--` `+=` |
| 比较 | `<` `<=` `>` `>=` `==` `!=` `===` `!==` |
| 逻辑 | `&&` `||` `!`（短路）|
| 三元 | `cond ? a : b`（空值/0/空集合视为 false） |
| 可选链 | `map?.key?.sub`（null 时短路返回 null） |
| 安全 | `?.` |
| 类型检查 | `value instanceof String`（**用 instanceof，不用 typeof**） |

### 对象/数组操作

```javascript
var map = { id: 1, name: 'test' };
var list = [1, 2, 3];

map.name                  // 点访问
map['name']               // 索引访问
map?.sub?.key             // 安全访问
{...map, c: 3}            // 对象展开
[...list, 4, 5]           // 数组展开
list.size()               // 长度
list.add(item)            // 添加
list.get(0)               // 索引
list.filter(it => it > 1) // 过滤
list.map(it => it * 2)    // 映射
list.first()              // 第一个
list.each(it => sum += it)
list.group(keyFn, valFn)  // 分组
list.sort(fn)             // 排序
```

### 循环

```javascript
// for-each（推荐）
for(item in list) { ... }                     // 单参数
for(index, item in list) { ... }              // 带索引
for(key, value in map) { ... }                // Map
for(value in range(0, 100)) { ... }           // 含首尾的范围

// while
var i = 0;
while(i < 10) {
    sum += i;
    i++;
}
```

### if / exit / assert

```javascript
// if
if (x > 0) {
    return x;
} else if (x == 0) {
    return 0;
} else {
    return -1;
}

// exit 终止并返回
exit 400, '参数错误'
exit 200, '成功', { id: 1 }
exit 500, '服务器错误'

// assert 断言（一行 if/exit 的简写）
assert name != null && name != '' : 400, '名称不能为空'
assert age >= 18 : '年龄必须满 18'
```

### try/catch/finally

```javascript
try {
    var x = 1 / 0;
} catch(e) {
    log.error('出错了', e);     // catch(e) 不需要类型
    return 0;
} finally {
    return null;                // finally 的 return 会覆盖 try/catch
}
```

### 函数 / lambda

```javascript
var add = (a, b) => a + b;
var fn1 = e => e + 1;           // 单参数可省略括号
var fn2 = e => { return e + 1 };
var fn3 = (a, b) => {
    a += 1;
    return a + b;
};

add(1, 2);       // 3
[1,2,3].map(add); // [3, 4, 5]
```

### import

```javascript
import 'java.lang.System' as System;                    // Java 静态类（带别名）
import 'java.util.Date';                                // 直接引用类名
import 'cn.dev33.satoken.stp.StpUtil';                  // 业务 Sa-Token
import 'org.ssssssss.magicapi.modules.db.cache.SqlCache';

// 跨 .ms 文件：函数/接口
import '@/test/add' as add;                             // @ 是 magic-api 资源根
import '@get:/base/module/assert' as test;             // 调用另一个 HTTP 接口
import '@post:/system/menu/save' as MenuSave;          // POST 接口

// Spring Bean
import 'org.springframework.core.env.Environment' as env;

// 内置模块（不需要路径）
import log;
import response;
import request;
import http;
import env;
```

### new

```javascript
import 'java.util.HashMap' as HashMap;
import 'java.text.SimpleDateFormat' as SDF;

var map = new HashMap();
var df = new SDF('yyyy-MM-dd HH:mm:ss');
return df.format(new date());
```

### 字符串模板

```javascript
var name = 'magic';
var greeting = `Hello, ${name}!`;          // 模板字符串支持 ${expr}
return `当前用户: ${StpUtil.getLoginId()}`;
```

### 异步执行

```javascript
var future1 = async db.select('select * from sys_user');
var future2 = async db.selectInt('select count(*) from sys_user');
// .get() 阻塞拿结果
return {
    list: future1.get(),
    total: future2.get()
};
```

