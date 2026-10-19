# 21 · 前端构建与部署链路

面向「改前端 → 让改动生效」的完整链路。这条链路横跨三个仓库，**顺序错一步就会出现「代码改了但页面没变」或「页面全白」**。

## 1. 三个仓库的关系

| 仓库 | 作用 | 是否 git |
|---|---|---|
| `magic-boot/frontend` | 前端**源码**（Vue 3 + Vite） | 否（不在版本控制里） |
| `gewumind-boot` | 发布工程：fat jar + 前端**产物** | 是 |
| `magic-boot/backend` | 后端 Java 源码 + `data/magic-api` 低代码容器 | 否 |

`gewumind-boot` 把 `src/main/resources/static/` 提交进仓库，保证 clone 下来直接能跑；改前端后必须**重新同步产物**回去。

## 2. 标准链路

```bash
# 1) 改前端源码（magic-boot/frontend/src/...）
cd /data/projects/magic-boot/frontend

# 2) 构建
VITE_APP_BASE_API='' npm run build          # 产出 dist/

# 3) 全量同步到发布工程（先删后拷，避免残留旧 hash 文件）
cd /data/projects/gewumind-boot
bash scripts/stop.sh
rm -rf src/main/resources/static
cp -r /data/projects/magic-boot/frontend/dist src/main/resources/static

# 4) 重新打包并启动
mvn -q -o package -DskipTests
bash scripts/start.sh
```

## 3. 铁律

### 3.1 绝不在实例运行时原地覆盖 fat jar

Spring Boot fat jar 是「嵌套 jar + 随机访问」：JVM 运行时按需从
`target/gewumind-boot-app.jar` 里读 class。**服务运行期间执行 `mvn package`
覆盖这个文件，运行中的实例会随机抛 `NoClassDefFoundError` /
`ClassNotFoundException`，接口返回 404。**

正确顺序恒为：`stop.sh` → `mvn package` → `start.sh`。
`scripts/build-dist.sh` 已内置该检查，检测到实例存活会直接拒绝打包。

### 3.2 `VITE_APP_BASE_API` 必须覆盖为空

`.env.production` 里写死了内网地址（形如 `http://192.168.x.x:8089/`）。
gewumind-boot 是同源部署，必须在构建时用环境变量覆盖（shell 环境变量
优先级高于 `.env` 文件）：

```bash
VITE_APP_BASE_API='' npm run build
```

CI 会扫描产物里的内网 IP 与本机绝对路径，带进去直接构建失败。

### 3.3 混淆插件不能碰坏 `__vitePreload`

`vite-plugin-obfuscator` 的 `include` 选项无效，会对 bundle 里**所有** chunk
调用 `obfuscate(code, options)`；若把配置套在 `options: {}` 里则全走默认值
（含 `transformObjectKeys: true`），并把 vite 的 preload 依赖数组替换成字符串
占位符 → 运行时报 `deps.map is not a function`，路由只注册一半、页面白屏。

本项目已改为自写插件 `obfuscateSkipPreloadChunks`（见 `vite.config.js`）：
- 选项**平铺**传给 `javascript-obfuscator`，`transformObjectKeys: false`、`target: 'browser'`
- `transformIndexHtml` 遍历 bundle，**跳过** `code.includes('__vitePreload')` 的 chunk

改混淆配置后，务必在浏览器里验证：页面能渲染、路由能跳转、控制台无报错。

### 3.4 静态资源同步要「先删后拷」

`rm -rf src/main/resources/static && cp -r dist src/main/resources/static`。
直接 `cp -r` 会把上一次的旧 hash chunk 留在仓库里，仓库体积持续膨胀，
且容易误判「到底在跑哪一版」。

## 4. 怎么确认跑的是哪一版

```bash
# 构建产物里入口文件的 hash
grep -o 'index-[a-z0-9]*\.js' src/main/resources/static/index.html

# 实际服务返回的入口
curl -s http://localhost:9089/ | grep -o 'index-[a-z0-9]*\.js'

# jar 内是否含前端
unzip -l target/gewumind-boot-app.jar | grep 'static/index.html'
```

三者一致才是部署成功。浏览器若仍显示旧 hash，是**缓存**，强刷即可
（`.ms` 低代码组件是运行时热加载的，不受此影响）。

## 5. `.ms` 低代码组件不走前端构建

`data/magic-api/component/**.ms` 由后端在运行时读盘编译，前端只负责渲染。
改 `.ms` 后：

- 需要把新编译产物（`compileJs` / `compileCss`）写回文件头部
- **浏览器刷新即可生效**，不需要重新 `npm run build`，也不需要重启
- 但**必须用后端同款分隔符**写回，参见 `knowledge/server-plugin/01-structure.md`

## 6. 打包发行版

```bash
bash scripts/build-dist.sh          # 需先 stop；产出 dist/*.tar.gz + *.zip
```

布局：`bin/`（jar + start/stop，`.sh` 与 `.bat` 双份）、`config/`、`data/magic-api/`、
`db/`、`docs/`、`DEPLOY.md`。启动脚本会自动识别「发行包布局（jar 在 bin/）」
与「源码布局（jar 在 target/）」两种目录结构。
