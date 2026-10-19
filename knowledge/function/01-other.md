## 其它函数


| 函数 | 入参 | 返回 | 说明 |
|---|---|---|---|
| `ifnull(target, trueVal, falseVal)` | Object×3 | Object | 空值判断 |
| `date_format(date, pattern)` | Date, String | String | 日期格式化（默认 `yyyy-MM-dd HH:mm:ss`）|
| `now()` | - | Date | 等同 `new Date()` |
| `round(num, len)` | Number, int | Number | 四舍五入保留 N 位小数 |
| `floor(num)` | Number | Number | 向下取整 |
| `ceil(num)` | Number | Number | 向上取整 |
| `percent(num, len)` | Number, int | String | 转百分比（默认 0 位） |

```js
ifnull(null, 1)                       // 1
ifnull(0, 1)                          // 0
date_format(new Date())               // 2024-01-01 12:30:30
date_format(new Date(), 'yyyy-MM-dd') // 2024-01-01
round(123.456d, 2)                    // 123.46
floor(123.456d)                       // 123
ceil(123.456d)                        // 124
percent(0.1289999, 2)                 // "12.90%"
```

## 对应演示文件

- `5进阶操作/5.3其它操作/5.3.4数值转换.ms` — toFixed/round/asPercent/ceil/floor
- `5进阶操作/5.1LINQ相关/5.1.4空值转换.ms` — ifnull 空值处理
