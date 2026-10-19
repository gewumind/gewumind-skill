## 表规范

gewumind-boot 项目的所有业务表必须遵循以下规范。

### 必含审计字段
```sql
is_del       INT          DEFAULT 0       -- 逻辑删除标记（0=正常, 1=删除）
create_by    VARCHAR(32)  DEFAULT NULL    -- 创建人 ID
create_date  DATETIME     DEFAULT NULL    -- 创建时间
update_by    VARCHAR(32)  DEFAULT NULL    -- 更新人 ID
update_date  DATETIME     DEFAULT NULL    -- 更新时间
remarks      TEXT         DEFAULT NULL    -- 备注
```

### 表引擎与字符集
```sql
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
ROW_FORMAT = DYNAMIC
```

### 主键策略
两种主键类型，按场景选：
- `VARCHAR(32)` UUID：跨系统、分布式友好（推荐给业务表）
- `INT` 自增：本地、顺序友好（适合日志/关联表）

### 表名规范
- snake_case，全小写，下划线分词（如 `sys_user`、`proj_product`）
- 系统表统一 `sys_` 前缀（`sys_user`、`sys_role`、`sys_menu`、`sys_dynamic_component`、`sys_dict`、`sys_office`）
- 业务表建议业务前缀（如 `proj_`、`order_`）

### 完整建表示例
```sql
CREATE TABLE proj_product (
    id          VARCHAR(32)  NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL COMMENT '产品名称',
    code        VARCHAR(50)  NOT NULL COMMENT '产品编码',
    category_id VARCHAR(32)  DEFAULT NULL COMMENT '分类 ID',
    price       DECIMAL(10,2) DEFAULT 0 COMMENT '价格',
    status      VARCHAR(2)   DEFAULT '1' COMMENT '状态(0=禁用 1=启用)',
    description TEXT         DEFAULT NULL COMMENT '描述',
    is_del      INT          DEFAULT 0,
    create_by   VARCHAR(32)  DEFAULT NULL,
    create_date DATETIME     DEFAULT NULL,
    update_by   VARCHAR(32)  DEFAULT NULL,
    update_date DATETIME     DEFAULT NULL,
    remarks     TEXT         DEFAULT NULL,
    UNIQUE KEY uk_code (code),
    KEY idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC COMMENT='产品表';
```

### 查询惯例
- 所有业务查询**必须**带 `is_del = 0` 条件
- 列表查询用 `db.page("""...""")`（详见 database skill）
- 关联查询用 `LEFT JOIN`，避免子查询性能问题
