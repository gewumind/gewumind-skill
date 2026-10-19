## 定时任务配置（magic-api.task.*）


```yaml
magic-api:
  task:
    enable: true             # 是否启用定时任务（默认 true）
    log: false               # 是否打印执行日志（2.1.0+，默认 false）
    thread-name-prefix: magic-task-  # 线程名前缀
    pool:
      size: 8                # 线程池大小（默认 CPU 核数）
    shutdown:
      await-termination: false           # 关闭时是否等待任务完成
      await-termination-period: 30s      # 等待时长
```

**配置类**：`org.ssssssss.magicapi.task.starter.MagicTaskConfig`

**说明**：
- `enable: false` 时，`taskScheduler` 为 null，任务不会执行（但实体仍可加载）
- 线程池是 Spring 的 `ThreadPoolTaskScheduler`，`shutdown.awaitTermination` 控制优雅停机
- `log: true` 会输出 `[开始执行]` / `[执行完毕]` 日志
