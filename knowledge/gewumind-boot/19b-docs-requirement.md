# 19b — requirement.md 规范

> AI 在生成 requirement.md 时必读。requirement.md 是后续 3 份 docs（ui / database / api）的**唯一业务真相源**。requirement.md 写得粗，后续 3 份会全部失真。
>
> 相关 skill：
> - 通用规范（追溯矩阵、命名、工具）见 `19a-docs-common.md`
> - 4 份 docs 的写作约束和禁止项汇总见 `19a-docs-common.md` §5-§6

## 1. 结构（必须 7 节，缺一不可）

```markdown
# 业务需求规格

## 修订记录
| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2026-06-11 | v1.0 | 初稿 |

## 1. 业务背景
（why：为什么要做这个系统，痛点是什么）

## 2. 组织机构（组织层级树）
> **角色和权限都依附于组织**。必须先定义组织层级，再写角色和功能。
> - 参考回复约定：`manageOrg`（管理组织）、`orgId`
> - **⚠️ 数据库/API 设计约束**：使用系统自带的 `sys_office` 表（已含 `id/name/code/pid/sort/...`），**不要新建** `t_company / t_dept / t_team` 等
>   - 层级关系 → 用 `sys_office.pid` 自引用实现
>   - 组织类型 → 用 `sys_office.type` 字段区分（值来自 `sys_dict.type = 'org_type'`）
>   - 字典项示例（以平台实际字典为准）：`company=公司, dept=部门, team=班组`
>   - 详见 skill `gewumind-boot/09-common-tables.md` §sys_office

| 层级 | 实体 | sys_office.type | 是否必须 |
|------|------|-----------------|----------|
| L1 | 集团/公司 | `company` | 是 |
| L2 | 部门/分公司 | `dept` / `branch` | 视业务 |
| L3 | 分组/科室 | `group` | 视业务 |
| L4 | 班组/小组 | `team` | 视业务 |

组织间关系：`归属` / `管辖` / `属于`

## 3. 用户角色
| 角色编码 | 角色名 | 描述 | 主要操作 | 所属组织层级 |
| role_admin | 超级管理员 | ... | ... | L1 |
| role_operator | 业务操作员 | ... | ... | L2/L3 |
| role_viewer | 查看者 | 只读 | 仅查看 | L1-L4 |

## 4. 功能模块清单（菜单结构草图）
> **这一节是 ui.md 菜单树的依据**。每个功能模块必须给出：
> - 中文名
> - 英文路径段（kebab-case，会直接出现在 ui.md 菜单和 api.md 路径里）
> - 页面类型（list / form / detail / buttons）
> - 父模块（如有）

> 英文路径必须按 `/{module}/{page}` 两级格式（如 `/device/list`），**不是** `/device-list` 扁平格式。

| 编码 | 中文名 | 英文路径 | 页面类型 | 父模块 | 权限段 |
|------|--------|----------|----------|--------|--------|
| device-list | 设备列表 | /device/list | list | - | device: |
| device-form | 设备登记 | /device/list/save | form | device-list | device: |
| device-monitor | 状态监控 | /device/monitor | list | device-list | device: |

## 5. 业务用例（每个功能模块一个用例）
### 5.1 设备登记
- **所属模块**：device-form
- **前置**：操作员已登录
- **步骤**：进入「设备登记」→ 填写 SN/型号 → 提交
- **后置**：设备进入"待激活"状态
- **字段清单**（这就是 ui.md 的字段表、database.md 的表结构依据）：
  - 字段名（sn）· 类型（string(32)）· 必填（是）· 唯一（是）· 说明
  - 字段名（model）· 类型（dict: device_model）· 必填（是）· 说明
- **按钮**：新增 / 编辑 / 删除 / 导出
- **权限**：`device:list`, `device:save`, `device:delete`
- **列表查询条件**：SN（模糊）、model（精确）、status（精确）
- **列表展示列**：SN、型号、状态、安装位置、最近心跳、创建时间

### 5.2 ...

## 6. 数据字典（枚举值拆解）
> **database.md 的 dict 字段、ui.md 的 select options 都从这里取**。

| 字典编码 | 中文名 | 枚举值（key=中文名）|
|----------|--------|---------------------|
| device_status | 设备状态 | pending=待激活, online=在线, offline=离线, fault=故障 |

## 7. 权限模型
> **api.md 的权限码段、ui.md 的按钮可见性都从这里取**。

| 角色 | 拥有权限 |
|------|----------|
| role_admin | *（全部） |
| role_operator | device:*, config:*, upgrade:list, upgrade:save |
| role_viewer | *:list |

权限码命名规范：`<模块>:<动作>`，动作 = list / save / delete / export / import
```

## 2. 禁止项

- ❌ 「我觉得应该用 MySQL」 → 写进 database.md
- ❌ 「表名用 t_device」 → 写进 database.md
- ❌ 「POST /device/save」 → 写进 api.md
- ❌ 「页面顶部有搜索框」 → 写进 ui.md
- ✅ 「需要支持按 SN 搜索设备」 → requirement.md 正确

## 3. 多轮讨论时的更新规则（防内容重复）

> ⚠️ **多轮讨论时，LLM 禁止直接 append 新内容到文件末尾。必须全量重写。**

**流程**：
1. `readFile('requirement.md')` → 读懂已有内容
2. 融合本轮讨论的新需求
3. `writeFile('requirement.md', 完整新内容)` — **写整个文件**，不是 append
4. 如果用户只提了一个小改动（如「改个字段名」），仍然全量重写，不要局部 edit

**为什么禁止 append**：
- 文件开头存 v1.0 版本，末尾又 append v1.1 版本 → 两份内容打架，后续 reader 不知道该读哪个
- LLM 上下文有限，append 多了前面的旧版会被截断丢失
- 后续 validateDocs 扫描到重复内容会报 error，需额外修复

**正确做法**：
- ✅ 每次修改都 `writeFile`（全量内容）
- ✅ 每次修改都更新「修订记录」表（日期、版本、变更说明）
- ❌ 不要在末尾追加「v2.0 补充：以下为第二版新增内容...」

## 4. 枚举值必须拆解为字典

业务需求里出现「类型」「状态」「类别」「级别」等表述时，**必须在 requirement.md 明确列出所有枚举值及含义**：

```markdown
## 5. 数据字典

| 字典编码 | 中文名 | 备注 |
|----------|--------|------|
| device_status | 设备状态 | 待激活/已激活/已停用/已报废 |
| device_model | 设备型号 | A100/B200/C300 |
```

- ❌「设备有多种状态」→ 没列出状态值
- ✅「设备状态：待激活/已激活/已停用/已报废」→ 明确列出
- 后续 database.md 里字典字段用 `dict: device_status` 关联
- 后续 ui.md 里字典字段渲染为 select，options 从字典取
