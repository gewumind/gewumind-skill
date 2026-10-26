## 发行打包与数据库基线（dist / baseline）

项目做到「能交付」这一步时有两个必踩的坑，这里记录正确做法。

---

## 1. 打包发行版：`scripts/build-dist.sh`

```bash
cd <project>/backend
bash scripts/build-dist.sh              # 构建 jar + 组装 + 打包
bash scripts/build-dist.sh --skip-build  # 复用已有 target/gewumind-boot-app.jar
```

产物：

```
dist/gewumind-boot-app-<版本>/
├── libs/gewumind-boot-app.jar
├── bin/    start.sh / stop.sh / gen-ssl-cert.sh ...
├── config/ application.yml + application-{dev,online,docker,demo}.yml
├── data/zh/magic-api/   ← 接口、组件、任务脚本（备份重点）
├── db/init/          ← 数据库基线 SQL
└── docs/ DEPLOY.md
dist/gewumind-boot-app-<版本>.tar.gz / .zip
```

### ⚠️ 铁律：打包前必须先停实例

Spring Boot fat jar 是**随机访问 + 嵌套 jar**，运行中覆盖 `target/*.jar` 会让
正在跑的实例抛 `NoClassDefFoundError` 并返回 404。

脚本只检查 `target/` `libs/` `bin/` 下三个固定名的 pid 文件，**项目自建的 pid 文件
（如项目自建的 `<app>-boot.pid`）不会被识别**，所以要自己先停：

```bash
for p in $(pgrep -f 'gewumind-boot-app.jar'); do
  tr '\0' ' ' < /proc/$p/cmdline | grep -q -- '--server.port=9001' && kill -9 "$p"
done
# 打包 → 再按项目脚本重启
```

---

## 2. 数据库基线：01-baseline 只是「平台基线」

`db/init/01-baseline.sql` **只有平台自身表**（sys_* / magic_* / 演示数据），
**不包含任何业务表**。直接把这个包发到新环境，业务接口会全部报错。

正确做法：**分两层**，第二份由项目自己提供。

```
db/init/01-baseline.sql        ← 平台基线（仓库自带，不要改）
db/init/02-<业务>-baseline.sql  ← 业务基线（项目生成）
```

### 02 基线应包含

1. **全部业务表建表语句**（`SHOW CREATE TABLE` 导出，加 `IF NOT EXISTS`）
2. **平台共享表里的业务数据**：
   - `sys_office` 真实组织（并清掉基线预置的演示机构）
   - `sys_user` / `sys_role` / `sys_user_role` / `sys_role_menu` / `sys_role_office`
   - `sys_menu` 业务菜单树（含按钮权限行）
   - `sys_dict` / `sys_dict_items` 业务字典
   - `sys_configure` 业务配置（**排除 `license.*`**，属各环境私有）
3. **业务主数据**：基础档案、绑定关系、字典项对应的初始值等

### 02 基线不应包含

- 运行期数据：业务流水/台账记录、附件、操作日志、登录日志
- 自动化测试残留（`e2e_*` 等）
- 指向已删除主体的孤儿行（如指向已删角色的权限授权）

### 写法要求

- 全部语句**可重复执行**：`INSERT ... ON DUPLICATE KEY UPDATE`；清理语句写成幂等 DELETE/UPDATE；
- 不要 `CREATE DATABASE` / `USE`，库名由部署方决定；
- 建表语句建议保留 `SHOW CREATE TABLE` 原样（含索引、注释），仅把 `CREATE TABLE` 改成 `CREATE TABLE IF NOT EXISTS`。

### 用「还原验证」保证基线正确（强烈推荐）

不要只靠肉眼看 SQL，用一个全新库跑一遍再和现网逐表比对：

```bash
python3 scripts/gen-business-baseline.py     # 从运行库导出生成 02 基线
# 1) 建一个全新库（库名自定），依次导入 01 + 02
# 2) 逐表比对：
#    - 表清单 / SHOW CREATE TABLE（先归一化 CHARACTER SET / AUTO_INCREMENT 差异）
#    - 有效数据按主键逐字段比对
#    - 明确区分「真实差异」与「现网测试垃圾数据」
```

实测结论参考：表结构可做到完全一致；主数据与配置数据逐条一致；
剩余差异通常都指向「基线主动收敛 + 现网残留测试数据」，属预期差异。

把比对结果写成报告随包交付，部署方一眼能看出哪些差异是预期的。

---

## 3. 交付检查清单

- [ ] 打包前已停实例，`dist/` 重新生成
- [ ] `db/init/` 下有 `01-baseline.sql` 与 `02-<项目>-baseline.sql`
- [ ] 两份基线在**全新库**上导入无报错
- [ ] 新库导入后业务表齐全、数据与现网有效数据一致
- [ ] `dist/` 里包含 `data/{zh,en}/magic-api`（接口/组件/任务）与 `db/init`
- [ ] 附件与 `upload/` 运行期目录**不**进包
