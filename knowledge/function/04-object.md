## Object 扩展（类型转换与类型判断）


### 类型转换
```js
var obj = '123';
obj.asInt()        // 123
obj.asInt(1)       // 失败时返回 1
obj.asDouble()     // 123.0
obj.asDecimal()    // BigDecimal
obj.asFloat()      // 123.0f
obj.asLong()       // 123L
obj.asByte()       // byte
obj.asShort()      // short
obj.asDate('yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm')  // 多格式尝试
obj.asString()     // "123"
obj.asString("empty")  // 失败时返回 "empty"
```

`asDate` 智能识别：10 位数字→`new Date(value*1000)`，13 位数字→`new Date(value)`。

### 类型判断
```js
str.is('string')              // true
str.is('java.lang.String')    // true
str.is('java.lang.Integer')   // false
str.is(Date)                  // false

str.isString()
123.isInt()
123L.isLong()
123d.isDouble()
123f.isFloat()
123b.isByte()
true.isBoolean()
123s.isShort()
123m.isDecimal()
new Date().isDate()
[1,2,3].isArray() / .isList()
{k:v}.isMap()
[1,2,3].isCollection()
```

## 对应演示文件

- `4基础操作/4.1脚本语法/4.1.4类型转换.ms` — ::int/::double 类型转换
- `5进阶操作/5.3其它操作/5.3.5json转换.ms` — ::json / ::stringify
