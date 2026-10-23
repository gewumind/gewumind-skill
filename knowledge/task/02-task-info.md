## TaskInfo 数据模型


继承 `PathMagicEntity`，核心字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String | 主键 |
| `name` | String | 任务名称 |
| `path` | String | 任务路径 |
| `groupId` | String | 分组 ID |
| `script` | String | 任务脚本内容（magic-script） |
| `cron` | String | **cron 表达式**（必填） |
| `enabled` | boolean | **是否启用（默认 `false`！必须显式写 `"enabled": true` 才会被调度）** |
| `description` | String | 任务描述 |
| `createDate` | Date | 创建时间 |
| `updateDate` | Date | 更新时间 |

**示例 cron 表达式**：
- `0 0 0 * * ?` 每天 0 点
- `0 0/5 * * * ?` 每 5 分钟
- `0 0 8 ? * MON-FRI` 工作日早 8 点

**文件存储**：默认存到 `magic-api.resource.location/task/{id}.json`
