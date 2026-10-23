// 正例：参数化 + 条件拼接
var sql = "SELECT id, name FROM t_device WHERE is_del = 0 ?{keyword, AND name LIKE concat('%', #{keyword}, '%')} ?{status, AND status = #{status}} ORDER BY id DESC";
return db.select(sql);
