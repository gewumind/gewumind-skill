## 聚合函数（0.5.5+）


```js
var list = [1,2,3,4,5];
count(list)        // 5
sum(list)          // 15
max(list)          // 5
min(list)          // 1
avg(list)          // 3
group_concat(list)         // "1,2,3,4,5"
group_concat(list, '|')    // "1|2|3|4|5"
```

也可用集合扩展方法：`list.max()` / `list.min()` / `list.sum()` / `list.avg()` / `list.count()`

## 对应演示文件

- `5进阶操作/5.1LINQ相关/5.1.1分组.ms` — group + 聚合函数
- `4基础操作/4.4lambda/4.4.1分组.ms` — Lambda 分组并计算
