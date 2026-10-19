## 类型字面量与转换


### 类型字面量后缀

| 后缀 | Java 类型 | 默认值 |
|------|-----------|--------|
| `123` | `int` | `0` |
| `123L` | `long` | `0L` |
| `123.456d` | `double` | `0.0d` |
| `123.456f` | `float` | `0.0f` |
| `123b` | `byte` | `0b` |
| `123s` | `short` | `0s` |
| `123m` | `BigDecimal` | `0m` |
| `true` / `false` | `boolean` | `false` |
| `"abc"` / `'abc'` | `String` | `null` |
| `[1,2,3]` | `List<Object>` | `null` |
| `{a:1, b:2}` | `Map<String, Object>` | `null` |

### 类型转换 3 种方式

#### 方式 1：`::type` 语法（推荐）

```javascript
var a = 123
var str = "456.0"

return {
    'a::string': a::string,           // "123"
    'str::int(0)': str::int(0),       // 456（失败用默认值 0）
    'a::long': a::long,               // 123L
    'a::double': a::double,           // 123.0d
    '"abc"::int': "abc"::int(0),      // 0（失败用默认值）
    'date::date': '2024-01-01'::date('yyyy-MM-dd'),  // Date 对象
    'json::json': '{"a":1}'::json,    // Object
    'stringify': obj::string          // 任意对象 → String
}
```

支持的转换：`int` / `long` / `short` / `byte` / `float` / `double` / `string` / `date` / `json`

**带默认值**：`expr::type(defaultValue)`，转换失败时用 defaultValue。

**优势**：语法级，**不会产生空指针**。

#### 方式 2：扩展方法 `.asXxx()`

```javascript
var obj = '123'

return {
    asInt:     obj.asInt(),         // 123
    asInt1:    obj.asInt(1),        // 失败时返回 1
    asDouble:  obj.asDouble(),      // 123.0
    asDecimal: obj.asDecimal(),     // BigDecimal
    asFloat:   obj.asFloat(),       // 123.0f
    asLong:    obj.asLong(),        // 123L
    asByte:    obj.asByte(),        // byte
    asShort:   obj.asShort(),       // short
    asDate:    obj.asDate('yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm'),  // 多格式尝试
    asString:  obj.asString(),      // "123"
    asString1: obj.asString("empty")  // 失败时返回 "empty"
}
```

`asDate` 智能识别：10 位数字 → `new Date(value*1000)`，13 位数字 → `new Date(value)`。

#### 方式 3：Java 类方法

```javascript
import 'java.lang.Integer' as Integer
import 'java.lang.Long' as Long
import 'java.lang.Double' as Double

var n = Integer.parseInt('123')
var l = Long.parseLong('123')
var d = Double.parseDouble('1.5')
```

### 类型判断

```javascript
var str = 'hello'

str.isString()          // true
str.is('string')        // true
str.is('java.lang.String')  // true
str.is(Date)            // false

123.isInt()
123L.isLong()
123d.isDouble()
123f.isFloat()
true.isBoolean()
new Date().isDate()
[1,2,3].isArray()      // true
[1,2,3].isList()       // true
{k:v}.isMap()
```

### 数值扩展

```javascript
var v = 123.456d

v.toFixed(2)        // "123.46"（仿 JS，返回 String）
v.round(2)          // 123.46（四舍五入）
v.floor()           // 123
v.ceil()            // 124
v.asPercent(2)      // "12345.60%"
```

### 空值转换

```javascript
// 在 LINQ 中
select t.name || '匿名' name from list t     // || 把 null/空字符串/0/空集合视为空
select ifnull(t.age, 20) age from list t     // ifnull 只判 null

// 在脚本中
var name = body.user?.name ?: '匿名'
```

### JSON 转换

```javascript
var json = { name: '李富贵' }
var jsonString = '{"name": "李富贵"}'

return {
    jsonObject: jsonString::json,        // String → Object
    jsonString: json::stringify          // Object → String
}

// 也可用扩展方法
var obj = jsonString.asJson()
var str = json.asJsonString()
```

### 反模式

```javascript
// ❌ 不要假定转换一定成功
var n = "abc"::int  // 返回 0（语法级不会 NPE，但值可能不对）

// ✅ 带默认值
var n = "abc"::int(0)

// ❌ 不要在字符串拼接时混用复杂对象
var msg = "data: " + complexObject  // 调用 toString()，可能不是你想要的

// ✅ 显式序列化
var msg = "data: " + JSON.stringify(complexObject)

// ❌ 不要假定 boolean 转换（"false" 是字符串 true）
var flag = "false".asBoolean()  // true！

// ✅ 显式比较
var flag = "false" == 'true'    // false
```
## 对应演示文件

- `4基础操作/4.1脚本语法/4.1.4类型转换.ms` — ::int/::double/::date 转换
- `4基础操作/4.1脚本语法/4.1.17数字字面量.ms` — 123b/123s/123l/123f/123d/123m 字面量
- `5进阶操作/5.3其它操作/5.3.4数值转换.ms` — toFixed/round/asPercent/ceil/floor
- `5进阶操作/5.3其它操作/5.3.5json转换.ms` — ::json / ::stringify
