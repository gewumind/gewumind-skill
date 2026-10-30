# 24 — 实测坑与对齐要点（agent 必读）

> 本文对 **1.2.0 发行包 / 内核 0.3.3** 实测有效。
> 旧 1.0.0 结论（`_b/_w` 显式提取、where 用 `type:`、`date-range` 自动展开 Start/End）**已废弃**，见 §2/§3。
> 开始新项目前先按本文自检，能省掉大半调试时间。

## 1. `sql-column-case: camel` —— 结果集键是驼峰，组件必须驼峰

后端默认配置：

```yaml
magic-api:
  sql-column-case: camel
```

`select card_no from t_业务表` 返回的键是 **`cardNo`**，不是 `card_no`。

**后果**：页面有数据但**每一列都是空的**（组件按 `card_no` 取不到值）。

**正确做法**：

- 组件 `cols` 的 `field` 用驼峰：`{field: 'cardNo', label: '卡号'}`
- 组件 `where` 的键也用驼峰：`where: { cardNo: {label: '卡号'} }`
- 脚本里读结果集用驼峰：`u.memberId`（不是 `u.member_id`）
- **SQL 列名仍然是蛇形**（`m.card_no`），只在脚本变量/组件字段处用驼峰

**别用驼峰别名**：`select member_id as memberId` 会得到 `memberid`（全小写），
因为 camel 转换只处理 `snake_case`。要别名就用蛇形 `as member_name`（自动转 `memberName`）。

## 2. 参数注入：搜索参数是**裸变量**，JSON body 是 `data`

1.2.0 实测（内核 0.3.3）：magic-api 会把请求参数注入为脚本变量。

- **搜索/查询参数**（mb-table 平铺的 `where`）→ **同名裸变量**；`parameters` 为空也能取到。
- **JSON body** → 绑定到 `data` 对象，用 `data.x`。
- **不要**再写 `var _b = body; var _w = _b.where`：`_b/_w` 在 1.2.0 多余，且 `_w` 可能取不到值。

```js
// ✅ 列表：搜索参数直接用裸变量
return db.page("""
  select * from t_card
  where is_del = 0
  ?{cardNo, and card_no = #{cardNo}}
""")

// ✅ 保存：JSON body → data
var d = data == null ? {} : data      // 首次 POST 无 body 时 data 可能为 null
if (d.id) { db.update("update t_card set name = #{d.name} where id = #{d.id}") }
else      { db.insert("insert into t_card(id, name) values(#{id}, #{d.name})") }
```

> mb-table 的搜索请求是 **POST**（`parameters: []`），搜索字段照样以裸变量注入，**无需** GET、也**无需**先把 `where` 拆出来。

## 3. `?{}` / `#{}` 解析的是**脚本变量**（不是 SQL 列）

`?{x, and ...}` 里的 `x` 取的是脚本作用域变量，不会自动读 SQL 列名。
搜索参数本身已是裸变量，可直接用；JSON body 用 `data.x`：

```js
return db.page("""
    select ... where is_del = 0
    ?{username, and username like concat('%', #{username}, '%')}
""")
```

## 4. 免登录接口：`anonymous` **和** `require_login` 都要写

只写 `anonymous=true` 仍然返回 `{"code":402,"message":"凭证已过期"}`。

```json
"options": [
  {"name": "anonymous",     "value": "true",  "description": "该接口不需要登录也可访问"},
  {"name": "require_login", "value": "false", "description": "该接口需要登录才允许访问"}
]
```

> 选项名是**下划线**风格（`require_login`），写 `require-login` 不生效。
> 另：本版本 `parameter` 在 GET / form 下为空，**query 参数取不到** ——
> 需要带参查询的接口直接做成 **POST**，别用 GET。

## 5. `.ms` 的 `groupId` 必须等于父 `group.json` 的 `id`

否则启动时 `DefaultMagicResourceService` 抛：

```
java.lang.NullPointerException: Cannot invoke "...Group.getType()" because "group" is null
```

**整个 magic-api 全挂**（所有接口 404，日志只有这一条 ERROR，极易误判成"目录没读到"）。

自检：遍历所有 `.ms` 解析 meta，校验 `groupId ∈ {各 group.json 的 id}`，悬空就补。
新建脚本忘了写 `groupId` 时最常见。

## 6. 平台自带的 api / function / 组件不能删

清空 `data/magic-api/api` 后只放自己的业务脚本，会连带删掉平台基线：

| 被删的东西 | 症状 |
|---|---|
| `api/系统管理/**`（含 `安全/登录.ms`） | **登录 500 / 404**，进不去后台 |
| `function/配置中心/根据key获取数据值.ms` | 登录报 `找不到函数：/configure/getBykey` |
| `component/系统设置/**`、`dashboard/**` | 系统设置页面空白、首页 `[dashboard] trend/pie load failed 404` |
| `api/脚本演示/**` | 首页仪表盘 `/data/report-op/sales-trend` 404 |

**做法**：只**新增**自己的目录；同步组件时只覆盖自己那几个组，
不要 `rm -rf component/` 整目录替换。

## 7. `bundle_apply` 的返回不可全信

- `appliedSql: []` / `appliedMs: []` 也可能是**成功**（后端把"已存在"过滤掉了）
- 真实落盘路径看日志：`grep "Saved ms:" 日志`
- 已知两类落盘 bug（详见 `references/publish-protocol.md` §实测坑）：
  多一层字面量 `file:` 目录、分隔符写成 `\n====\r\n`
- 发布后**二进制校验**分隔符，并确认文件落在 `<backend>/data/magic-api/api/...`

## 8. 菜单图标只能用平台内置图标集

`sys_menu_icon` 表是空的；图标名来自前端内置集合，写错就是「菜单无图标」。

安全做法：`select distinct icon from sys_menu where icon <> ''` 拿现成名字复用
（本版本可见：`People`、`user`、`Accessibility`、`MdOutlinePersonOutline`、`Organization12Filled`、
`sub-level`、`MdOutlineAssessment`、`Receipt24Regular`、`Camera`、`NewspaperOutline`、`database`、
`SettingsSharp`、`Menu`、`interface`、`BookLetter24Filled` 等）。

## 9. 按钮权限要同时有「菜单行」和「角色授权」

脚本 `options` 里写了 `permission: base:save`，若 `sys_menu` 没有该权限码的按钮菜单、
或 `sys_role_menu` 没给角色授权，调用直接：

```json
{"code":403,"message":"禁止访问"}
```

**做法**（每个动作一条）：

```sql
-- 按钮菜单（is_show = 0，不在侧边栏出现）
INSERT INTO sys_menu (id, pid, icon, name, url, permission, sort, open_mode, is_del, keep_alive, is_show, create_by, create_date)
VALUES ('djbtn-base-save', '<页面菜单id>', '', '保存基础数据', '', 'base:save', 1, '0', 0, 1, 0, 'admin', NOW());

-- 授予角色（role_id='1' 通常是管理员）
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES ('1', 'djbtn-base-save');
```

## 10. 别和平台自带模块重复造轮子

平台已有 **系统设置 › 用户管理 / 角色管理**（操作 `sys_user` / `sys_role`，功能更全：导入、分配角色）。
再做一套「后台账号管理 / 角色权限管理」= 两个入口改同一张表，必然互相覆盖。

**原则**：凡是 `sys_*` 表的管理界面，优先复用平台页面；自己只做业务表（`t_*`）的模块。

## 11. `db.table().insert()` 不会生成 varchar 主键

```js
id = db.table("t_业务表").primary("id").insert({ ... })   // ✗ Field 'id' doesn't have a default value
```

先取 UUID 再显式传入：

```js
id = db.selectValue("select replace(uuid(), '-', '')")
db.table("t_业务表").primary("id").insert({ id: id, ... })
```

（更新走 `saveOrUpdate` + `data.id = exist.id` 时不受影响。）

## 12. 字典值形态要和列类型一致

字典 `site_status = normal/abnormal`，列却建成 `tinyint` → 插入报
`Incorrect integer value: 'normal'`。

枚举列统一用 `varchar(16)` / `varchar(32)`，与字典 key 保持一致；纯 0/1 状态才用 `tinyint`。

## 13. 检查清单（发布前逐条过）

- [ ] 列表脚本用**裸变量**取搜索参数；JSON body 用 `data.x`（`data` 可能为 null，先判空）
- [ ] 组件 `cols.field` / `where` 键是驼峰
- [ ] 每个 `.ms` 的 `groupId` 能在同目录链上找到对应 `group.json`
- [ ] 平台基线（系统管理 / function / 组件）完整未删
- [ ] 每个按钮权限码都有按钮菜单 + 角色授权
- [ ] 菜单 `url` = group path + 组件 path，且每个菜单都有内置图标名
- [ ] 发布后 `grep "Saved ms:"` 落盘路径正确、分隔符为 `\r\n====\r\n`
