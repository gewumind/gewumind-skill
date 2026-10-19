## Date 扩展 / Map 扩展 / Number 扩展 / Class 扩展 / Pattern 扩展


```js
var date = new Date();
date.format('yyyy-MM-dd')            // 2024-01-01
date.format('yyyy-MM-dd HH:mm:ss')
```

## Map 扩展

```js
var map = {b:2, a:1};
map.sort()                          // {a:1, b:2}（按 key 排序）
map.sort((k1,k2)=>k1.compareTo(k2))
map.each((key, value, source)=>{...})   // 遍历
map.asString('&', '=')              // "b=2&a=1"（key 分隔符, kv 分隔符）
map.asString('&', (k,v)=>k+'='+v)   // 同上，自定义映射
map.asList((k,v,src)=>({k:v}))      // [{k:2},{k:1}]
map.merge('c', 3)                   // 合并单条
map.merge({c:3, d:4})               // 合并 Map
```

## Number 扩展

```js
var v = 123.456d;
v.round(2)        // 123.46
v.toFixed(10)     // "123.4560000000"（强制位数）
v.floor()         // 123
v.ceil()          // 124
v.asPercent(2)    // "12.90%"
```

## Class 扩展

```js
import 'java.text.SimpleDateFormat' as SimpleDateFormat;
var sdf = SimpleDateFormat.newInstance('yyyy-MM-dd HH:mm:ss');
// 等同 new SimpleDateFormat('yyyy-MM-dd HH:mm:ss')
```

## Pattern 扩展

```js
var regx = /^\d+$/;
regx.test('123456')   // true
```

## 对应演示文件

- `4基础操作/4.1脚本语法/4.1.14正则表达式.ms` — Pattern 扩展方法
- `4基础操作/4.1脚本语法/4.1.6定义lambda.ms` — Lambda 扩展
