# 19d — database.md 规范

> AI 在生成 database.md 时必读。database.md 是 DDL 生成的唯一依据，决定了 gewumind-boot 后端的所有表结构。
>
> 相关 skill：
> - 通用规范（追溯矩阵、命名、工具）见 `19a-docs-common.md`
> - magic-script SQL 语法（`db.page` / `db.update` / 参数绑定等）见 `10-magic-script.md`
> - 系统表（`sys_office` / `sys_user` / `sys_dict` 等）见 `09-common-tables.md`

## 1. 每张表格式

> ⚠️ **每张表必须用以下固定 5 列表格**（字段 / 类型 / 必填 / 默认 / 说明）。这是后续 LLM 生成 DDL 时唯一能解析的格式，**改格式会导致 DDL 字段类型/必填错乱**。
>
> ⚠️ **唯一允许的格式**：5 列（字段/类型/必填/默认/说明）。**严禁**6+ 列（含字典、备注、索引等多余列）或 3- 列简化。validateDocs 会报错让 LLM 重写。
> - ❌ 错误：`| 字段 | 类型 | 必填 | 默认 | 说明 | 字典 |`（6 列）
> - ❌ 错误：`id, code(v50,UQ), name(v100), ...`（单行简化）
> - ✅ 正确：`| 字段 | 类型 | 必填 | 默认 | 说明 |`（5 列）

**每张表必须显式列出所有字段**（包括公共字段），不允许用 `... 公共字段` 省略。

**禁止单行简化写法**：不允许用 `id, code(v50,UQ), name(v100), remarks(text), is_del, ...` 单行格式。LLM 生成代码时无法从单行格式中解析出精确的字段类型、必填、默认值、注释。**每张表的字段必须用完整 5 列表格（字段 / 类型 / 必填 / 默认 / 说明）逐行展开**。

**类型列必须从以下固定值里选**（MySQL 实际类型，避免 LLM 自由发挥）：
- `varchar(N)` / `char(N)` — 字符串（N 为长度）
- `int` / `bigint` / `tinyint` / `smallint` — 整数
- `decimal(M,D)` — 精确小数
- `datetime` / `date` / `time` — 时间
- `text` / `longtext` / `mediumtext` — 长文本
- `json` — JSON
- `boolean` / `bit` — 布尔

**必填列必须填 `是` 或 `否`**（不是 `Y`/`N`/`true`/`1`），让 LLM 一眼判断。

**默认列**：字符串/数字/时间常量直接写（如 `'offline'`、`0`、`NOW()`），无默认写 `-`。

**表间必须有 `---` 分隔符**：每张表结束（最后一行 `**索引**` 或 `**字典关联**`）和下一张表标题（`## N. xxx`）之间必须有 `---` 空行分隔，便于 DDL 解析。

```markdown
## 1. 设备表 (t_device)

| 字段 | 类型 | 必填 | 默认 | 说明 |
| id | varchar(36) | 是 | UUID | PK，去连字符 UUID |
| sn | varchar(32) | 是 | - | 设备 SN，唯一 |
| model | varchar(64) | 是 | - | 型号 |
| status | tinyint | 是 | 0 | 0=待激活 1=在线 2=离线 3=故障 |
| install_location_id | varchar(36) | 否 | NULL | 关联 t_location.id（应用层关联，不用外键） |
| last_online_time | datetime | 否 | NULL | 最近一次心跳 |
| is_del | int | 是 | 0 | 0=未删 1=已删 |
| create_by | varchar(36) | 否 | NULL | 创建人 ID |
| create_date | datetime | 是 | NOW() | 创建时间 |
| update_by | varchar(36) | 否 | NULL | 更新人 ID |
| update_date | datetime | 否 | NULL | 更新时间 |

**索引**:
- UNIQUE KEY `uk_sn` (sn, is_del)
- KEY `idx_status` (status)
- KEY `idx_location` (install_location_id)

**字典关联**:
- model → dict: device_model
- status → dict: device_status
```

## 2. 公共字段（每张表必含，必须逐条列出）

> ⚠️ **不要**写「公共字段省略」或「同上」。**每张表的字段表里必须逐行列出全部公共字段**。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| id | varchar(36) | 是 | UUID | PK，去连字符 |
| is_del | int | 是 | 0 | 0=未删 1=已删 |
| create_by | varchar(36) | 否 | NULL | 创建人 ID |
| create_date | datetime | 是 | NOW() | 创建时间 |
| update_by | varchar(36) | 否 | NULL | 更新人 ID |
| update_date | datetime | 否 | NULL | 更新时间 |

## 3. 数据字典清单

> database.md 最后必须有一个完整的「数据字典清单」节，列出所有用到的字典及其枚举值。
> 这个清单是后续 dict SQL 生成的全部依据。

```markdown
## N. 数据字典清单

| 字典编码 | 中文名 | 枚举值 |
|----------|--------|--------|
| device_status | 设备状态 | 0=待激活, 1=在线, 2=离线, 3=故障 |
| device_model | 设备型号 | A100, B200, C300 |
| org_type | 组织类型 | company=公司, station=场站, fleet=车队, line=线路, team=班组 |
```

**规则**：
- 每张表的每个 dict: 字段对应的字典都必须列出
- DDL 里 `dict:` 注释引用的每个 key 必须在此清单有条目，一个不能少（避免 DDL 引用未定义的字典）
- 枚举值必须和 requirement.md §6 保持一致
- 此节和每个表的「字典关联」行互相对应

## 4. 禁止项

- ❌ 写外键约束（FOREIGN KEY） → 应用层关联，不用数据库外键
- ❌ 写存储过程、触发器 → 不在 gewumind-boot 范围
- ❌ 写「分 16 个库」 → gewumind-boot 用单库
- ❌ 写「读 model = TextField」 → 用 varchar(N) + 注释说明
- ❌ 写索引、约束、字典关联缺失 → 必写
- ❌ 单行简化字段表 → 必须用 5 列表格逐行展开
- ❌ 表间无 `---` 分隔符 → 必须有
- ❌ 字典引用但数据字典清单无对应项 → 必须有
- ✅ 字段类型用 MySQL 实际类型（varchar/int/datetime/tinyint/...）
- ✅ NOT NULL 必须标 `必填: 是`
- ✅ 每个枚举字段必标「dict: xxx」
- ✅ 关联字段用 `xxx_id varchar(36)` + 注释说明关联哪个表，由应用层保证一致性

## 5. NOT NULL 规则（生成 DDL 时必读）

- `database.md` 标记 **`必填=是`** 的字段 → DDL 里必须加 `NOT NULL`，即使有 `DEFAULT` 值
- `is_del` 在所有表都是必填 → DDL 必须 `NOT NULL DEFAULT 0`
- `dict:` 注释引用的字典键 → 必须在 §数据字典章节有定义

## 6. 写入策略：**合并写**多张表到一次 writeDoc

> ⚠️ **关键约束**：避免 LLM 单次输出超过 provider 配置的 max_tokens（被 `finish_reason=length` 截断）。但**不要每张表就调一次 writeDoc**——每个 writeDoc 都有 reasoning_content + tool_call JSON 元数据开销，**浪费 token**。

**合并写多张表**：

```
❌ 错误：每张表独立 writeDoc（17 次往返 + 17 次元数据浪费，$0.03+）
✅ 正确：合并 4-6 张表到一个 writeDoc（3-4 次往返就够，省 70% token）
```

**单次 writeDoc 调用规范**：
- `content` 字符数 = `max_tokens × 4 × 0.8`（留 20% 余量给 tool_call JSON）
- **DeepSeek-V4-Flash 16K tokens** = 单次可写 **~52000 字符**（≈ 4-6 张完整业务表 + 索引）
- 一次写多张表（按 §N. 章节边界合并）——不是每张表写一次

**典型示例流程**（17 张表 + 字典 ≈ 80K 字符）：
1. **writeDoc overwrite 初始化**：写文档标题 + §1. 设备表 + §2. 场景表 + §3. 安装地点类型（~30K 字符）
2. **writeDoc append**：写 §4-§9 中 6 张表（~30K 字符）
3. **writeDoc append**：写 §10-§17 后 8 张表（~20K 字符）
4. **writeDoc append**：写 §N. 数据字典清单
5. `checkDocCompleteness` + `validateDocs` 检查
6. 如缺表 → 继续 append 补全（不要 overwrite，会丢前文）

**为什么合并写**：
- 每个 writeDoc 调用都带 reasoning_content（思考） + tool_call JSON（结构）
- 17 次往返 = 17 倍元数据浪费
- 合并后 4 次 = 节省 75% 的非内容 token
- 写超 max_tokens 时工具会自动按 `## ` 切分拼接，所以**理论上一次写全部表也行**，但仍要避免超长

**为什么不能写超 max_tokens**：
- 单次 output > max_tokens 会被 `finish_reason=length` 截断
- 截断后 writeDoc 收到不完整内容 → 写入半截文档 → 后面的章节全丢
- 工具会自动按 `## ` 切，但会丢元数据，**你应主动控制在安全范围内**

## 7. 写前强制检查清单

- [ ] 每张表都用 5 列表格（字段/类型/必填/默认/说明）逐行展开，无单行简化
- [ ] 每张表都列出全部 6 个公共字段（id / is_del / create_by / create_date / update_by / update_date）
- [ ] 表间都有 `---` 分隔符
- [ ] 写入策略：合并 4-6 张表到一个 writeDoc（不是每张表独立）
- [ ] 数据字典清单节列出了全部枚举值（`0=待激活, 1=在线` 格式，非仅引用）
- [ ] DDL 中 `dict:` 注释引用的每个 key 在数据字典清单有对应项
- [ ] NOT NULL 规则：必填字段都加了 NOT NULL
- [ ] 系统表（sys_office 等）没有重复建表
- [ ] 写入策略：合并 4-6 张表到一个 writeDoc（不是每张表独立）
