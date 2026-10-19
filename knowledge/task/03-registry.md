## 任务注册机制（TaskMagicDynamicRegistry）


继承 `AbstractMagicDynamicRegistry<TaskInfo>`，监听 magic-api 的文件/分组事件：

```java
@EventListener(condition = "#event.type == 'task'")
public void onFileEvent(FileEvent event) { processEvent(event); }

@EventListener(condition = "#event.type == 'task'")
public void onGroupEvent(GroupEvent event) { processEvent(event); }
```

**注册流程**：
1. 收到 FileEvent，调用 `register(entity)`
2. 先 `unregister(entity)` 取消旧任务
3. 用 `entity.getCron()` 构建 `CronTrigger`
4. 用 `taskScheduler.schedule(runnable, trigger)` 注册
5. 把 `ScheduledFuture` 存到 `MappingNode.mappingData`，用于后续取消

**执行流程**：
```java
ScriptManager.executeScript(entity.getScript(), magicScriptContext);
```
直接用 `magic-script` 引擎执行任务脚本，捕获异常但不抛出（避免影响其他任务）。

**关键点**：
- 任务**只在 `entity.isEnabled() == true` 时真正执行**（注册仍然发生）
- 注册失败（cron 非法）只 log error，不影响其他任务
- 取消时 `scheduledFuture.cancel(true)` 立即中断
- 类型过滤 `type == 'task'`，避免和其他类型（api/function/group）冲突
