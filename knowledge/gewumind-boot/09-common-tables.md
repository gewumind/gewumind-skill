## 常用表结构

### sys_user（用户）
```sql
id            VARCHAR(32)  PK                   -- UUID
username      VARCHAR(50)  NOT NULL  UNIQUE      -- 登录名
name          VARCHAR(50)                        -- 姓名
password      VARCHAR(100)                       -- sha256 加密
phone         VARCHAR(20)
email         VARCHAR(100)
is_login      VARCHAR(2)   DEFAULT '1'           -- 允许登录
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
office_id     VARCHAR(32)                        -- 所属机构
head_portrait VARCHAR(200)                       -- 头像路径
remarks       TEXT
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_role（角色）
```sql
id            VARCHAR(32)  PK                   -- UUID
name          VARCHAR(50)  NOT NULL              -- 角色名
code          VARCHAR(50)  NOT NULL  UNIQUE      -- 角色编码（系统角色用 'admin'/'user'）
description   TEXT
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_user_role（用户-角色关联）
```sql
id            VARCHAR(32)  PK                   -- UUID
user_id       VARCHAR(32)  NOT NULL
role_id       VARCHAR(32)  NOT NULL
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_role_menu（角色-菜单权限）
```sql
id            VARCHAR(32)  PK                   -- UUID
role_id       VARCHAR(32)  NOT NULL
menu_id       VARCHAR(32)  NOT NULL
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_menu（菜单）
完整字段见 `05-menu-register.md`：
- `id, name, url, component, component_id, open_mode, pid, permission, is_show, sort, icon, keep_alive`
- `is_del, create_by, create_date, update_by, update_date`

### sys_office（组织机构）

```sql
id            VARCHAR(32)  PK                   -- UUID
name          VARCHAR(100) NOT NULL
code          VARCHAR(50)
pid           VARCHAR(32)  DEFAULT '0'         -- 上级 office id，'0' = 顶级
sort          INT          DEFAULT 0
remarks       TEXT
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

**树形结构**：`sys_office.pid` 指向父 office id，支持多层嵌套（如 总公司 → 华北分公司 → 北京办事处）。

**在 API 里怎么用**：

```js
// 1. 当前用户的可视 user_id 列表（含本级 + 所有下级 office 的 user）
var userIds = office()

// 2. 业务表 t_device 通过 create_by 关联到 user，再通过 sys_user.office_id 过滤
// （或直接在业务表加 office_id 字段更高效）
```

完整用法见 `06-crud-api.md` "组织数据权限过滤" 和 `04-dynamic-sfc.md` "🏠 首页 / Dashboard / 汇总首页 — 组织权限过滤"。

### sys_dynamic_component（动态组件）
```sql
id            VARCHAR(32)  PK                   -- UUID
name          VARCHAR(50)  NOT NULL  UNIQUE      -- 组件名（注册到 Vue app）
source_code   TEXT                               -- 原始 .vue SFC 源码
compile_js    TEXT                               -- 编译后 JS
compile_css   TEXT                               -- 编译后 CSS
type          INT          DEFAULT 1             -- 0=分组, 1=组件
pid           VARCHAR(32)  DEFAULT '0'
description   VARCHAR(200)
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

完整字段语义见 `04-dynamic-sfc.md` "🔒 SFC 必须忠实现 ui.md"。

### sys_dict（字典类型）
```sql
id            VARCHAR(32)  PK                   -- UUID
type          VARCHAR(100) NOT NULL  UNIQUE      -- 字典类型编码
description   VARCHAR(200)                       -- 描述
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_dict_items（字典项）
```sql
id            VARCHAR(32)  PK                   -- UUID
dict_type     VARCHAR(100) NOT NULL              -- 关联 sys_dict.type
value         VARCHAR(100) NOT NULL              -- 字典值
label         VARCHAR(100) NOT NULL              -- 显示名
sort          INT          DEFAULT 0
description   VARCHAR(200)
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_configure（配置中心）
```sql
id            VARCHAR(32)  PK                   -- UUID
config_key    VARCHAR(100) NOT NULL  UNIQUE
config_value  TEXT
description   VARCHAR(200)
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### sys_log / sys_operation_log（操作日志）
```sql
id            VARCHAR(32)  PK                   -- UUID
user_id       VARCHAR(36)
username      VARCHAR(50)
operation     VARCHAR(200)
method        VARCHAR(200)
params        TEXT
ip            VARCHAR(50)
location      VARCHAR(200)
cost_time     INT
is_del        INT          DEFAULT 0             -- 0=未删 1=已删
create_by     VARCHAR(36)                        -- 创建人 ID
create_date   DATETIME     DEFAULT NOW()         -- 创建时间
update_by     VARCHAR(36)                        -- 更新人 ID
update_date   DATETIME                           -- 更新时间
```

### 关键约定

#### 软删除
- 所有业务表都通过 `is_del = 0` 过滤
- 物理删除只用于日志/临时数据
- 删除用 `db.update('update x set is_del = 1 where id = ?')`

#### 主键生成
- VARCHAR(32) UUID：`$common.uuid()` 或 `UUID.randomUUID().toString().replace('-', '')`
- 插入时可以不传 `id`，magic-api 会自动生成

#### 审计字段自动填充
- **后端** 通过拦截器自动写入 `create_by/create_date/update_by/update_date`
- 前端无需手动传这些字段

#### 用户名密码
- 密码用 `SaSecureUtil.sha256(password)` 加密（sa-token 框架）
- 不存明文，登录时同样 sha256 后比对
- 修改密码时清权限缓存：`SqlCache.delete(\`permissions:${id}\`)`

#### 角色编码
- `'admin'`：超级管理员，拥有所有权限（`/system/menu/current/menus` 自动跳过权限校验）
- 其他角色：需要 `sys_role_menu` 显式授权

#### 关联查询模式
```sql
-- 角色名拼接（多对多 → 一对多字符串）
(select group_concat(sr.name) from sys_role sr
 left join sys_user_role sur on sr.id = sur.role_id
 where sr.is_del = 0 and sur.user_id = su.id) roles
```

#### 字典翻译模式
- 前端 `mb-table` 设置 `dictType: 'status'` 自动翻译
- 后端查询时如果要返回 label：
  ```js
  db.select("""select su.*, sd.label status_label
              from sys_user su
              left join sys_dict_items sd on sd.dict_type = 'status' and sd.value = su.status""")
  ```

#### 时间查询模式
- `create_date` 用 `datetime` 类型
- 区间查询：
  ```js
  ?{startDate, and su.create_date >= #{startDate}}
  ?{endDate, and su.create_date <= #{endDate}}
  ```
- 前端 `mb-date` 组件 type='daterange' 自动产生 `[start, end]` 数组
