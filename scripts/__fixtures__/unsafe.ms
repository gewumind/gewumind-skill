// 反例：字符串拼接 SQL（sql-check 应拦截）
var keyword = body.keyword;
var status = body.status;
var sql = "SELECT id, name FROM t_device WHERE is_del = 0";
if (keyword) sql += " AND name LIKE '%" + keyword + "%'";
if (status) sql += " AND status = '" + status + "'";
sql += " ORDER BY id DESC LIMIT " + body.offset + ", " + body.size;
return db.select(sql);
