## 参数验证


`assert` 模块，验证失败抛异常，终止脚本。

```js
import assert;

// 验证非空
assert.notBlank(message, 1001, 'message不能为空');

// 验证长度
assert.isTrue(message != null && message.length() >= 10, 1003, 'message长度不能小于10');

// 正则验证
assert.regx(phone, '\d{11}', 1004, 'phone必须11位数字');
```

完整方法见 api skill 的 `06-modules-extra.md`：
- `assert.notNull(value, code, msg)`
- `assert.notEmpty(value, code, msg)`
- `assert.notBlank(value, code, msg)`
- `assert.isTrue(condition, code, msg)`
- `assert.regx(value, pattern, code, msg)`

**UI 验证表达式**（1.0.0+ 可在 magic-api UI 配置）：
- `value.length() >= 6`
- `value == 1 || value == 2`
- `type == '1' ? value != null && value != '' : true`

## 对应演示文件

- `4基础操作/4.2Web相关/4.2.1参数自动验证.ms` — JSON 元数据 validateType 定义
