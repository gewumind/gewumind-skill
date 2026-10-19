## 任务脚本示例


任务脚本使用 magic-script 语法，可使用全部内置模块（`db`、`http`、`log`、`magic` 等）。

### 示例：清理过期数据
```javascript
// 每天 0 点清理 30 天前的日志
var threshold = new Date() - 30 * 24 * 60 * 60 * 1000;
var count = db.update("delete from sys_log where create_date < #{threshold}");
log.info("清理过期日志 {} 条", count);
return count;
```

### 示例：定时同步外部数据
```javascript
import http;
import log;
var data = http.connect('https://api.example.com/data')
    .get()
    .getBody();
db.update("delete from sync_temp");
for(var item in data) {
    db.table('sync_temp').insert(item);
}
log.info("同步完成，共 {} 条", data.size());
```

### 示例：心跳上报
```javascript
import http;
http.connect('http://monitor.example.com/heartbeat')
    .header('Authorization', 'Bearer xxx')
    .body({ node: 'gewumind-boot-1', time: new Date() })
    .post();
```

### 调试
- **手动执行**：`POST /task/execute?id={taskId}`（带 WebSocket session 用于日志）
- **查看日志**：开启 `magic-api.task.log: true`
- **立即重载**：修改文件后插件自动重新注册

### 注意事项
- 任务脚本抛异常会被 catch 吞掉，必须自己 `log.error`
- 单任务执行超时不会阻塞其他任务（线程池隔离）
- 修改 cron 后必须**保存**才能生效（不保存只改了内存）

## 对应演示文件

- `task/test/test.ms` — 定时任务演示示例（路径: backend/data/magic-api/task/test/）
