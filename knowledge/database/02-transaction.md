## 事务


### 自动事务（推荐）
```js
var val = db.transaction(()=>{
    var v1 = db.update('...');
    var v2 = db.update('....');
    return v2;
});
return val;
```

### 手动事务
```js
var tx = db.transaction();
try {
    var value = db.update('...');
    tx.commit();
    return value;
} catch(e) {
    tx.rollback();
    throw e;
}
```

`db.transaction()` 不传回调时返回事务对象，需手动 `commit()` / `rollback()`。

## 对应演示文件

- `1数据库操作/1.4其它/1.4.5事务.ms` — 自动事务 + 手动事务两种模式
