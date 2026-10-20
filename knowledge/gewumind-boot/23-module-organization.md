# 模块组织（可选）

> 模块（`sys_module`）是菜单的**可选**组织方式：把一组菜单放进顶部的模块标签页。
> **菜单不绑定模块也能正常使用。** 只有当你希望业务菜单单独占一个模块标签时才需要创建并绑定。
> demo 库里 70 个菜单未绑定模块，仍然正常工作。

## 什么时候需要

| 场景 | 是否需要模块 |
|---|---|
| 默认业务菜单，跟着系统菜单树走 | ❌ 不需要 |
| 单个页面 / 少量菜单 | ❌ 不需要 |
| 希望顶部出现独立标签（如「设备管理」），把该业务菜单归到下面 | ✅ 需要 |
| 多产品/多租户按模块隔离 | ✅ 需要 |

## 表结构

### sys_module

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar(36) | 主键（UUID） |
| `name` | varchar(255) | 模块显示名（如 设备管理） |
| `code` | varchar(255) | 模块编码（英文，如 device） |
| `icon` | varchar(255) | 图标（svgIcons kebab-case） |
| `sort` | int | 排序 |
| `is_show` | tinyint | 是否显示 |
| `is_del` | tinyint | 逻辑删除 |
| `create_by` / `create_date` / `update_by` / `update_date` | | 审计字段 |

### sys_module_menu

| 字段 | 说明 |
|---|---|
| `module_id` | `sys_module.id` |
| `menu_id` | `sys_menu.id` |

### sys_role_module（可选）

角色 → 模块的授权。不配也能通过 `sys_role_menu` 看到菜单；配置后按模块做权限隔离。

## SQL 示例

创建「设备管理」模块，并把同名菜单绑进去：

```sql
-- 1. 创建模块
INSERT INTO sys_module (id, name, code, icon, sort, is_show, is_del, create_date)
VALUES (UUID(), '设备管理', 'device', 'monitor', 10, 1, 0, NOW());

-- 2. 绑定菜单（可多条；模块或菜单不存在时插入 0 行）
INSERT INTO sys_module_menu (module_id, menu_id)
SELECT m.id, sm.id
FROM sys_module m, sys_menu sm
WHERE m.code = 'device' AND sm.name = '设备管理' AND sm.is_del = 0;

-- 3. 可选：给角色授权模块
INSERT INTO sys_role_module (role_id, module_id)
SELECT '角色id', id FROM sys_module WHERE code = 'device';
```

## 规则

1. **不要默认生成模块绑定**。只有 `ui.md` / 需求明确要求「独立模块标签」时才加。
2. 模块绑定**不替代菜单权限**：菜单仍需要 `sys_role_menu`。
3. 没有菜单的模块不会显示；绑定后顶部才会出现标签。
4. `sys_module` / `sys_module_menu` / `sys_role_module` 是系统表，**只 INSERT，不 CREATE**。
5. 模块 `id` 用 UUID；`code` 用英文；`name` 用中文。
6. 重复发布时用 `WHERE NOT EXISTS` 或 `ON DUPLICATE KEY UPDATE` 保证幂等。

## 与菜单的关系

- 菜单是必选的（页面入口）；模块是可选的（分组标签）。
- 一个菜单最多属于一个模块（`sys_module_menu` 主键是 `module_id + menu_id`，可按需扩展）。
- 菜单树接口 `当前用户菜单.ms` 会返回 `modules` 和每个菜单的 `module_id`；前端按模块分组渲染顶部标签。
