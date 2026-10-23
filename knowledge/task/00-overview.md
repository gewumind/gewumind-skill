## 定时任务插件（magic-api-plugin-task）


magic-api 官方定时任务插件，基于 Spring `ThreadPoolTaskScheduler` 实现，可视化配置 + 动态注册/取消。

**Maven 引入**：
```xml
<dependency>
    <groupId>org.ssssssss</groupId>
    <artifactId>magic-api-plugin-task</artifactId>
    <version>latest</version>
</dependency>
```

**核心组件**：
- `MagicTaskConfig`（`magic-api.task.*` 配置）
- `TaskInfo`（任务实体）
- `TaskInfoMagicResourceStorage`（JSON 文件存储）
- `TaskMagicDynamicRegistry`（监听 FileEvent/GroupEvent，自动注册/取消）
- `MagicTaskController`（提供 `/task/execute` 手动执行接口）

**使用流程**：
1. 启动应用后访问 `http://host:port/magic/web`
2. 进入"定时任务"菜单创建任务
3. 配置 cron 表达式、启用状态、描述、脚本内容
4. 保存后插件自动从磁盘加载、注册到 TaskScheduler
5. 修改任务后插件自动重新注册

**手动执行**（调试用）：
```http
POST /task/execute?id={taskId}
```

## 对应演示文件

- `task/test/test.ms` — 定时任务演示示例

## ⚠️ 两个必须知道的坑（1.0.0 实测）

### 坑 1：`log` 是模块，不是内置变量 —— 必须 `import log`

定时任务脚本里直接写 `log.info(...)` 会抛 `MagicScriptException: 对象为空`
（普通 api 脚本同理）。正确写法：

```javascript
import log          // ← 必须 import
log.info('清理完成，处理 ' + n + ' 条')
```

也可用 SLF4J：`import org.slf4j.LoggerFactory` + `LoggerFactory.getLogger('xxx')`，
但 **`import log` 是平台惯例，优先用它**。

### 坑 2：`/task/execute` 手动执行接口在嵌入部署下不可用

插件里确实有 `@PostMapping("/task/execute")`，但它是通过 magic-api 插件的
`controllerRegister()` 注册到 magic-api servlet 映射上的。作为**库嵌入**的
GewuMind Boot（`scanBasePackages` 只含 `com.gewumind.*`）中该路由 **404**。

**验证任务的可行做法**：临时把 cron 改成 `*/20 * * * * ?`，重启后端，每 20 秒
触发一次；验证完改回正式 cron 再重启。详见 `knowledge/task/05-pitfalls.md`。
