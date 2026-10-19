# Magic-API URL 组合规则（重要！）

> Magic-API 2.1.1 的 URL 由 **目录结构 + group.json.path + .ms path** 三段拼成。
> 任何一段写错都会导致启动时 `POST:/xxx 已注册` 错误，或运行时 `404 Not Found`。

## 0. 黄金规则（违反即报错）

```
❌ 违禁行为                      ✅ 正确做法
────────────────────────────────────────────────────
中文路径 /保存 /列表 /设备管理    英文路径 /save /list /device
扁平 group（全是 parentId=0）     嵌套 group（父子级对应 URL 层级）
同名重复脚本（保存.ms + _保存.ms） 一个 action 只一个文件
混合命名（/内容管理 + /device）    统一中文目录名 + 英文 group.path
```

1. **group.json.path 永远用英文 kebab-case**（/device, /list, /function-mapping）
2. **.ms path 永远用英文单段 action**（/save, /list, /tree, /detail）
3. **目录名（文件夹名）用中文**，跟 group.json.name 保持一致
4. **一个 action 一个文件** — 不允许同名 .ms 出现在不同路径
5. **group 层级 = URL 层级** — `/device/list` → `设备管理/设备列表/列表.ms`，不是 `设备管理-列表/列表.ms`
6. **.ms 文件名用中文**（`列表.ms` `保存.ms` `详情.ms`），group.json.name 也跟目录名一致用中文。只有 group.json.path 和 .ms path 用英文
7. **所有 api.md 模块都必须用嵌套 group**（`内容管理/通知公告` `内容管理/宣传视频`），不允许平铺到顶级。**特别提醒**：内容管理、升级管理、系统设置、首页这四个模块容易被平铺——每个子页都要单独建子 group

---

## 1. 目录结构（嵌套）

每个目录都有自己的 `group.json`，**包括顶级**：

```
data/magic-api/api/
├── 设备管理/                          ← 顶级 group.json
│   ├── group.json                    ← path: /device, name: "设备管理"
│   ├── 设备列表/                      ← 子级 group.json
│   │   ├── group.json                ← path: /list, name: "设备列表"
│   │   ├── 列表.ms                   ← path: /list（中文文件名，英文 URL）
│   │   ├── 详情.ms                   ← path: /detail
│   │   └── 保存.ms                   ← path: /save
│   ├── 状态监控/
│   │   ├── group.json                ← path: /monitor, name: "状态监控"
│   │   └── 列表.ms                   ← path: /list
│   └── 远程控制/
│       ├── group.json                ← path: /control, name: "远程控制"
│       ├── 列表.ms                   ← path: /list
│       └── 发送指令.ms               ← path: /send-command
└── 首页/                              ← 顶级 group.json
    ├── group.json                    ← path: /home, name: "首页"
    └── 统计/                          ← 子级 group.json
        ├── group.json                ← path: /stats, name: "统计"
        ├── 概览.ms                   ← path: /overview
        ├── 场景统计.ms               ← path: /scenario-stats
        └── 在线率趋势.ms             ← path: /online-trend
```

---

## 2. 各级 group.json 的 path 规则

| 级别 | path 字段 | 例子 | 错误的写法 |
|---|---|---|---|
| 顶级 | `/{顶级-en}`（**单段**） | `/device`, `/config`, `/home` | ❌ `/device/registration`（带子级） |
| 子级 | `/{子页-en}`（**单段**） | `/registration`, `/monitor`, `/stats` | ❌ `/device/registration`（带顶级） |
| function/task 顶级 | `/{en-segment}` | `/config-center`, `/scheduled` | 同上 |
| function/task 子级 | `/{子-en}` | `/device`（if 嵌套在"设备管理"下） | 同上 |

**核心：每个 group.json.path 只含**自己这一段**的 URL 段，**不含**父级或子级。

---

## 3. .ms path 规则

`.ms` 文件的 `path` 字段是 **action 段**（单段），不含父级：

```json
{
  "path": "/list",       // ✅ 单段：/list
  "path": "/detail",     // ✅
  "path": "/upgrade-statistics"  // ✅ kebab-case 全名（避免与 statistics.ms 冲突）
}
```

❌ 错误：
```json
{
  "path": "/device/registration/list",  // 不应含父级
  "path": "/list",                       // 与同级 statistics.ms 的 /list 冲突（如有）
}
```

**避免冲突**：同目录下 .ms path 必须唯一。.ms 文件名用中文，group.json.path 和 .ms path 用英文：
- `列表.ms` → path: `/list`（中文文件名，英文 path）
- `场景统计.ms` → path: `/scenario-stats`
- `在线率趋势.ms` → path: `/online-trend`
- 如果两个 .ms 文件的 path 必须不同 → 用 kebab-case 全名区分（如 `path: /online-trend` 和 `path: /scenario-stats`）

---

## 4. 创建顺序：先父级再子级

> ⚠️ **每次调 `generateMagicScript` 前必须确认父级 group 已存在**。不存在则**先创建父级**。

**错误流程**（当前 LLM 翻车模式）：
```
1. generateMagicScript(group='内容下发')  → parentId=0   ← ❌ 父级 内容管理 不存在，只能用 0
2. generateMagicScript(group='通知公告')   → parentId=0   ← ❌ 同上
最终 URL: /内容下发/list  (丢失了 /content 前缀)
```

**正确流程**：
```
1. generateMagicScript(kind='group', group='内容管理', groupPath='/content')  ← 先建父级
2. generateMagicScript(kind='api', group='内容管理/通知公告', groupPath='/notice', name='列表', script=...)  ← name 用中文，parentId 自动指向上面
3. generateMagicScript(kind='api', group='内容管理/通知公告', groupPath='/notice', name='保存', script=...)
最终 URL: /content/notice/list ✓  /content/notice/save ✓
```

**规则**：
1. 从 api.md 顶部遍历每行路径段，**先处理顶级段**（/device, /config, /content, /upgrade, /home, /setting）
2. 再处理各顶级下的子段（/notice, /delivery, /function, /list 等）
3. 同级的 group 顺序不重要，但**父级必须在子级之前创建**
4. `generateMagicScript` 工具会自动设置 parentId（传入父级 group 名），不要自己传 parentId=0

## 5. URL 拼装示例

| 顶级 group.path | 子级 group.path | .ms path | 最终 URL |
|---|---|---|---|
| `/device` | `/registration` | `/list` | `/device/registration/list` |
| `/device` | `/monitor` | `/list` | `/device/monitor/list` |
| `/config` | `/function` | `/options` | `/config/function/options` |
| `/system` | `/app` | `/options` | `/system/app/options` |
| `/home` | `/stats` | `/card` | `/home/stats/card` |
| `/home` | `/stats` | `/scenario-distribution` | `/home/stats/scenario-distribution` |
| `/home` | `/stats` | `/upgrade-statistics` | `/home/stats/upgrade-statistics` |

**注意**：`概览.ms` 和 `在线率趋势.ms` 不能都用 `path: /overview`，
否则最终 URL 都是 `/home/stats/overview` → 启动报 `已注册` 错误。各 .ms 的 path 要唯一。

---

## 6. 中文名 → 英文段 映射

| 中文 | 英文段 | 备注 |
|---|---|---|---|
| 设备管理（顶级） | `/device` | |
| 配置管理（顶级） | `/config` | |
| 升级管理（顶级） | `/upgrade` | |
| 内容管理（顶级） | `/content` | |
| 系统设置（顶级） | `/setting` | ⚠️ 不是 `/system`（系统已占用）|
| 首页（顶级） | `/home` | |
| 设备登记/设备列表 | `/registration` 或 `/list` | |
| 状态监控 | `/monitor` | |
| 远程控制 | `/control` | |
| 通知公告 | `/notice` | ❌ 不是 `/通知公告` |
| 宣传视频 | `/video` | ❌ 不是 `/宣传视频` |
| 内容下发 | `/delivery` | ❌ 不是 `/内容下发` |
| 下发记录 | `/delivery-record` | ❌ 不是 `/下发记录` |
| 阅读记录 | `/read-record` | ❌ 不是 `/阅读记录` |
| 使用记录 | `/usage-record` | ❌ 不是 `/使用记录` |
| 应用功能维护 | `/function` | ❌ 不是 `/功能维护` |
| 场景维护 | `/scenario` | |
| 安装地点类型维护 | `/location-type` | ❌ 不是 `/安装地点类型` |
| 功能配置 | `/mapping` | ❌ 不是 `/功能配置` |
| 批量升级 | `/batch` | |
| 升级任务 | `/task` | ❌ 不是 `/升级任务` |
| 升级记录 | `/record` | |
| 组织管理 | `/office` | ❌ 不是 `/组织管理` |
| 参数配置 | `/param` | |
| 网络配置 | `/network` | |
| 应用管理 | `/app` | |

> ⚠️ 表中未列出的新模块 → 用英文 kebab-case 直接翻译（例如"设备详情" → `/detail`，"历史记录" → `/history`）。**绝不能用中文作为 path 值**。

---

## 7. 常见错误及修复

### 错误 1: 启动报 `已注册`

```
MagicAPIException: POST:/home/home/stats/statistics 已注册
```

**原因**：group.json path 含完整 URL（如 `/home/stats`），拼接后 `/home` + `/home/stats` + `/statistics` 重复。

**修复**：子级 group.json.path 只保留单段 `/stats`，不写成 `/home/stats`。

### 错误 2: 启动报 `已注册`（同级 .ms 重复）

**原因**：同目录下 `statistics.ms` 和 `upgrade-statistics.ms` 都用 `path: /statistics`，
URL 重复。

**修复**：用 kebab-case 全名区分。`upgrade-statistics.ms` 用 `path: /upgrade-statistics`。

### 错误 3: 运行时 404 Not Found

**原因**：URL 没注册上。可能是 group.json path 写错，或 .ms path 含父级。

**修复**：检查每个 group.json.path 都是单段、每个 .ms path 都是单段 action。

### 错误 4: 同个功能出现重复脚本

```
配置管理/场景/保存.ms         ← ✅ 正确（嵌套在 场景/ 下）
配置管理/场景_保存.ms         ← ❌ 重复，应删除（同级平铺）
```

**原因**：LLM 生成了两种命名风格（文件夹 + 下划线前缀），applyBundle 会全部写入，导致同一功能出现多个 URL。

**修复**：**只留一种**。推荐用子文件夹组织：`配置管理/场景维护/保存.ms`。删除同级下以 `场景维护_` 为前缀的平铺文件。

### 错误 5: group 扁平化导致 URL 路径丢失层级

```
← ❌ 扁平
设备管理/group.json         (path: /device)
设备管理/列表.ms            (path: /list)  → 预期 /device/list  ✅ 碰巧OK
设备管理-功能配置/列表.ms   (path: /list)  → 实际 /list         ❌ 没有父级路径

← ✅ 嵌套
配置管理/场景/group.json   (path: /scenario)
配置管理/场景/列表.ms      (path: /list)  → /config/scenario/list ✅
```

**原因**：把 `配置管理-功能配置` 建为顶级 group（parentId=0），丢失了 `/config/function` 路径前缀。

**修复**：无特别父子关系 → `parentId: "0"`；有层级关系 → 子 group 的 `parentId` 指向父 group 的 `id`，`path` 只写自己这一段。

---

## 8. 自动化修复（fixEverything / fixMagicApi 工具）

GewuMind 的 `fixEverything` 工具（或 CLI `ai-design-run.mjs` 的 `runFixEverything`）会自动检测并修复：

1. 顶级 group.json.path 包含 `/` → 截断为单段
2. 子级 group.json.path 包含 `/` → 截断为子级单段
3. 同目录下 .ms path 重复 → 用 .ms 文件名（kebab-case）覆盖
4. .ms path 含父级 → 截断为 action 段

调用方式：
```javascript
// LLM 调 fixEverything 工具（或自动在所有步骤后跑）
{
  "name": "fixEverything"
}
```

返回示例：
```
✓ 修 group.json path 1 个（顶级/子级只保留单段）
✓ 修 .ms path 1 个（用 kebab-case 全名避免冲突）
```

---

## 9. 相关 skill

- `10-magic-script.md` — magic-script 语法
- `14-magic-function.md` — function 元数据 schema
- `15-magic-task.md` — task 元数据 schema
- `06-crud-api.md` — API 命名规范
