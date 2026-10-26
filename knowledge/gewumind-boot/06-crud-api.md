## CRUD API 模式（magic-script .ms）

后端 API 用 magic-script 编写（.ms 文件），存于 `data/zh/magic-api/api/{group}/{apiName}.ms`。

### AI 生成新 API 的流程（变更后）

**不**再通过 `/api/ai/script/save` 这种专用接口即时写入。AI 应该：

1. 调用 `generateMagicScript(kind, group, groupPath, name, method, path, script, permission)` 工具
   - `kind` 必填：`api`（REST）/ `function`（函数调用）/ `task`（定时任务）
   - 工具会同时生成 `group.json`（含 groupId/path/type）和 `{name}.ms`（meta JSON + 脚本）
   - 写到项目 `src/magic-api/{kind}/{group}/{name}.ms` 和 `src/magic-api/{kind}/{group}/group.json`
2. 用户点「发布」时 `applyBundle` 一次性把 .ms 写入后端 `data/zh/magic-api/{kind}/`

**为什么不直接调 script/save**：让用户 review meta + script，bundle 内一起发布能保证 .ms 写盘和 SQL 顺序一致。

每个 .ms 文件 = 元数据 JSON + 脚本（`============` 分隔）。

### 文件结构

```json
{
  "id": "uuid",
  "name": "列表",
  "path": "/list",
  "method": "POST",
  "groupId": "uuid",
  "options": [{ "name": "permission", "value": "user:view" }],
  "requestBody": "",
  "responseBody": "...",
  "requestBodyDefinition": { ... },
  "responseBodyDefinition": { ... }
}
================================
return db.page("""SELECT * FROM sys_user WHERE is_del = 0""")
```

### 标准 CRUD 模板

**列表分页**：
```js
// 用户管理/列表.ms
return db.page("""
    select
        su.id, su.username, su.name, su.is_login, su.phone, su.create_date,
        su.office_id, su.head_portrait,
        so.name office_name,
        (select group_concat(sr.name) from sys_role sr
         left join sys_user_role sur on sr.id = sur.role_id
         where sr.is_del = 0 and sur.user_id = su.id) roles
    from sys_user su
    left join sys_office so on su.office_id = so.id
    left join sys_user_role sur on su.id = sur.user_id
    where su.is_del = 0
    ?{roleId, and sur.role_id in(#{roleId.split(',')})}
    ?{officeId, and su.office_id in(#{officeId.split(',')})}
    ?{username, and su.username like concat('%',#{username},'%')}
    ?{name, and su.name like concat('%',#{name},'%')}
    ?{isLogin, and su.is_login = #{isLogin}}
    ?{orderByColumn, order by su.${orderByColumn} ${direction == 0 ? 'asc' : direction == 1 ? 'desc' : ''}}
    ?{!orderByColumn, order by su.create_date desc}
""")
```

**保存（upsert + 关联表）**：
```js
// 用户管理/保存.ms
import cn.dev33.satoken.secure.SaSecureUtil;
import org.ssssssss.magicapi.modules.db.cache.SqlCache

// 1. 唯一性校验
var usernameCount = db.selectInt("select count(1) from sys_user where is_del = 0 and username = #{username} ?{id, and id != #{id}}")
if(usernameCount > 0){
    exit 0, '登录名称已存在'
}

// 2. 加密密码
password = password ? SaSecureUtil.sha256(password) : ''

// 3. 主表保存（saveOrUpdate 用 body 而非 data）
if(id){
    SqlCache.delete(`permissions:${id}`)     // 清权限缓存
    db.update("delete from sys_user_role where user_id = #{id}")  // 删旧关联
}
id = db.table("sys_user").primary("id").saveOrUpdate(body)

// 4. 关联表保存
for(roleId in roles.split(',')){
    db.table("sys_user_role").column('user_id', id).column("role_id", roleId).insert()
}
```

**删除（逻辑）**：
```js
// 用户管理/删除.ms
import org.ssssssss.magicapi.modules.db.cache.SqlCache

for(id in ids.split(',')){
    db.table("sys_user").logic().where().eq("id", id).delete()
    SqlCache.delete(`permissions:${id}`)
}
```

**详情**：
```js
// 用户管理/获取用户信息.ms
var user = db.selectOne("select * from sys_user where id = #{id} and is_del = 0")
var roles = db.select("select role_id from sys_user_role where user_id = #{id}")
return { user, roles }
```

**树形菜单**：
```js
// 菜单管理/获取菜单tree.ms
var menus = db.select("""select id, name, pid, url, sort, icon, open_mode, component_id
                        from sys_menu where is_del = 0 order by sort""")
// 用 nodes.toMap + 父子关系构造 tree
var nodes = menus.toMap(it => it.id)
nodes.each((key, node) => {
    if(nodes.containsKey(node.pid)){
        if(!nodes[node.pid].children) nodes[node.pid].children = []
        nodes[node.pid].children.push(node)
    }
})
return nodes.values().filter(it => it.pid == '0')
```

### 组织数据权限过滤

> **所有查询 API**（包括首页 dashboard 统计、列表、详情、汇总报表）**必须**按当前用户的组织范围过滤数据。**不允许返回全平台数据**。管理员（permission='0'）除外。

**规则**：
1. **任何 API**（不只是列表）开头都**必须**用 `office()` 函数获取当前用户的可见用户 ID 列表，作为条件传参
2. 如果业务表有 `office_id`：用 `office_id in(#{userIds})` 过滤
3. 如果业务表没有直接 `office_id`：通过关联表找到组织归属再过滤
4. 提供 `officeId` 作为可选查询参数，用户可手动选择组织范围

**首页 dashboard 统计 API 特别强调**：

首页（汇总首页）展示给所有登录用户看，**绝对不能**返回全平台数据：

```js
// ❌ 错误：全平台统计
var onlineCount = db.selectInt("SELECT COUNT(*) FROM t_device WHERE status = 'online'");

// ✅ 正确：按 office() 范围过滤
var userIds = office();
var onlineCount = db.selectInt("""
    SELECT COUNT(*) FROM t_device d
    WHERE d.is_del = 0 AND d.status = 'online'
    ?{userIds.size() > 0, AND d.create_by IN (#{userIds})}
""");
```

> 多层组织：`office()` 递归返回当前 office + 所有下级 office 的 user_id 列表。
> 例：用户属于「华北分公司」 → 可看华北 + 北京 + 天津 的数据（详见 `04-dynamic-sfc.md` "首页 / Dashboard / 汇总首页 — 组织权限过滤"）。

**标准模式**：
```js
// 列表.ms — 组织数据过滤
// 1. 获取当前用户的可视用户范围
var userIds = office()
// 管理员（permission='0'）返回空数组，脚本特殊处理
// 业务用户（permission='1'/'2'）返回可视用户 ID 列表

// 2. 分页查询 + 组织过滤
return db.page("""
    select td.*, so.name office_name
    from t_device td
    left join sys_office so on td.office_id = so.id
    where td.is_del = 0
    ?{userIds.size() > 0, and td.create_by in(#{userIds})}  ← 组织数据过滤
    ?{officeId, and td.office_id = #{officeId}}               ← 手动选择组织
    ?{keyword, and (td.name like concat('%%',#{keyword},'%%') or td.sn like concat('%%',#{keyword},'%%'))}
    ?{orderByColumn, order by td.${orderByColumn} ${direction == 0 ? 'asc' : 'desc'}}
    ?{!orderByColumn, order by td.create_date desc}
""")
```

> ⚠️ `userIds` 为空数组且非管理员 → 查询自动返回空（无权限看任何数据）。`if(userIds == null)` 不判断，用 `size()` 判断长度。

### 常用魔法（magic-script 糖）

| 语法 | 用途 |
|---|---|
| `#{var}` | 参数化占位符（防注入） |
| `${var}` | 字符串拼接（小心） |
| `?{cond, expr}` | 条件拼接（cond 真则拼接 expr） |
| `db.page(sql)` | 分页查询（自动用 where.current/size） |
| `db.table('t').primary('id','1').saveOrUpdate(data)` | upsert |
| `db.table('t').where().eq('f',v).select()` | 链式查询 |
| `db.transaction(() => { ... })` | 事务 |
| `exit 0, 'msg'` | 终止并返回 code/message |
| `import 'cn.dev33.satoken.secure.SaSecureUtil'` | 导入 Java 类 |
| `SqlCache.delete('key')` | 清除 magic-api 缓存 |

### 接口元数据（options）

```json
"options": [
  { "name": "permission", "value": "user:view" },
  { "name": "login", "value": "false" }   // 标记不需要登录
]
```

`permission` 是接口权限码，sa-token 拦截器自动校验。

### 跨接口调用

```js
import "@post:/sys/role/list" as RoleList
var roles = RoleList({ keyword: '' })
```

### 请求体入参

前端 `$common.post(url, data)` 发送 `Content-Type: application/x-www-form-urlencoded`，参数解析为 **bare 变量**：
```js
// 前端: $common.post('/api/save', {id: 'xxx', name: 'test'})
// body: { id: 'xxx', name: 'test' }
// 变量: id = 'xxx', name = 'test'
return db.table("sys_user").primary("id").saveOrUpdate(body)
```

**推荐**：始终用 `body` 对象传给 `saveOrUpdate`，避免 bare 变量名冲突。

PathVariable：
```
GET /api/sys/user/{id}/detail
```
```js
return db.selectOne("select * from sys_user where id = #{id}")
```

### 完整 .ms 范例：菜单保存

```json
{
  "id": "uuid",
  "name": "保存",
  "path": "/save",
  "method": "POST",
  "options": [{ "name": "permission", "value": "menu:save" }],
  "requestBody": "{ id, name, url, pid, sort, icon, openMode, componentId, permission, isShow, keepAlive }"
}
================================
import org.ssssssss.magicapi.modules.db.cache.SqlCache

// 校验 name 必填
if(!name){ exit 0, '菜单名称不能为空' }

// 组装数据
var menu = { id, name, url, pid, sort, icon, open_mode: openMode,
             component_id: componentId, permission, is_show: isShow,
             keep_alive: keepAlive ? '1' : '0' }

// 自动判断新增/编辑
var menuId = db.table("sys_menu").primary("id").saveOrUpdate(menu)

// 清菜单缓存（让路由重新加载）
SqlCache.delete('menus:current')
SqlCache.delete('menus:role:*')

return { id: menuId }
```
