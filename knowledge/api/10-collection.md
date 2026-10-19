## collection / lambda 操作

magic-script 的 List 和 Map 都有丰富的链式方法。

### List 常用方法

```javascript
var list = [1, 2, 3, 4, 5];

list.size()                 // 5
list.get(0)                // 1
list.add(6)                // [1,2,3,4,5,6]
list.remove(0)             // [2,3,4,5,6]
list.first()               // 2
list.isEmpty()             // false
list.contains(3)           // true

list.filter(it => it > 2)              // [3,4,5,6]
list.map(it => it * 2)                 // [4,6,8,10,12]
list.reduce((a, b) => a + b, 0)        // 25 (sum)
list.group(it => it % 2, vals => vals.size())  // {0:[2,4,6], 1:[3,5]}
list.sort((a, b) => a - b)             // 升序
list.distinct()                        // 去重
list.stream().map(it => it + 1).collect(Collectors.toList())  // Java Stream
```

### each (遍历)

```javascript
var sum = 0;
list.each(it => sum += it);

var totalStr = '';
list.each((idx, item) => totalStr += idx + ':' + item + ';');
```

### Map 常用方法

```javascript
var map = { a: 1, b: 2, c: 3 };

map.size()                 // 3
map.get('a')               // 1
map.put('d', 4)            // 添加
map.remove('a')            // 删除
map.containsKey('b')       // true
map.containsValue(2)       // true
map.keySet()               // ['a', 'b', 'c']
map.values()               // [1, 2, 3]

map.each((key, value) => log.info('{}={}', key, value));
```

### toMap / nodes.toMap (数据库查询结果构造映射)

```javascript
var menus = db.select('select id, name, pid, url, sort from sys_menu where is_del = 0 order by sort');
var nodes = menus.toMap(it => it.id);  // Map<id, menu>

nodes.each((key, node) => {
    if (nodes.containsKey(node.pid)) {
        if (!nodes[node.pid].children) nodes[node.pid].children = [];
        nodes[node.pid].children.push(node);
    }
});

return nodes.values().filter(it => it.pid == '0');  // 找所有顶级菜单
```

### group / sort 高级用法

```javascript
// 分组 + 计数 + 按值倒序
db.camel().select('select api_group_id from magic_api_info')
    .group(it => it.api_group_id, list => list.size())
    .sort((k1, k2, v1, v2) => v2 - v1)

// 链式
list.filter(x => x.active)
    .map(x => ({ id: x.id, name: x.name }))
    .group(x => x.group, g => g.size())
```

### join（左外连接）

```javascript
return db.camel().select('select api_name, api_group_id from magic_api_info')
    .join(
        db.camel().select('select id, group_name from magic_group'),
        (t1, t2) => t1.apiGroupId == t2.id)
    .map(it => ({
        name: it.apiName,
        groupId: it.apiGroupId,
        groupName: it.groupName
    }))
```

### spread 展开

```javascript
var map = { a: 1, b: 2 };
var list = [1, 2, 3, 4, 5];

return {
    ...map,
    c: 3,
    d: [...list]
};
// { a:1, b:2, c:3, d:[1,2,3,4,5] }
```

