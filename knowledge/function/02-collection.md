## 集合 / 数组扩展（Collection, Iterator, Enumeration, Object[]）


```js
var list = [1,2,3,4,5];
list.map(e=>e+1)               // [2,3,4,5,6]
list.filter(e=>e>3)            // [4,5]
list.filter((item,idx)=>idx>1) // [3,4,5]
list.each(item=>item.put('age', 18))  // 遍历修改
list.sort((a,b)=>a-b)
list.reserve()                 // 反转
list.join('-')                 // "1-5-2-3-6"
list.shuffle()
list.max()                     // 18
list.min()
list.sum()
list.avg()
list.skip(2)                   // 跳过前 N 个
list.limit(3)                  // 取前 N 个
list.findNotNull()             // 第一个非 null
list.every(e=>e>0)             // true
list.some(e=>e==0)             // false
list.reduce((sum, val)=>sum+val)  // 6

// 集合转 Java 对象
import 'com.example.User' as User;
return list.asBean(User.class);

// 分组
var result = [
    {xxx:1, yyy:2, value:11},
    {xxx:1, yyy:2, value:22},
    {xxx:2, yyy:2, value:33}
];
result.group(item=>item.xxx + '_' + item.yyy)  // Map<Object,List>
// 带映射
result.group(item=>item.xxx + '_' + item.yyy, list=>{
    count: list.size(),
    sum: list.map(v=>v.value).sum(),
    avg: list.map(v=>v.value).avg()
})

// 关联（join）
var year2019 = [...];
var year2018 = [...];
year2019.join(year2018,
    (left,right)=>left.code == right.code,
    (left,right)=>({
        '年份': left.pt,
        '编号': left.code,
        '今年': left.sum,
        '去年': right == null ? '-' : right.sum
    })
);
```

## 对应演示文件

- `4基础操作/4.4lambda/4.4.1分组.ms` — 集合分组
- `4基础操作/4.4lambda/4.4.2关联.ms` — 集合关联（JOIN）
- `4基础操作/4.4lambda/4.4.3过滤.ms` — 集合过滤
- `4基础操作/4.4lambda/4.4.4过滤和转换.ms` — 过滤 + 转换
- `4基础操作/4.4lambda/4.4.5字段转换.ms` — 字段映射
- `4基础操作/4.4lambda/4.4.6list转tree.ms` — 列表转树
- `4基础操作/4.4lambda/4.4.7动态行转列.ms` — 行转列
