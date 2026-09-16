# MEMORY.md — 项目长期备忘（RuoYi-Vue 工作台）

## 项目定位
若依 RuoYi-Vue 后台管理系统，前后端分离。业务重心不在标准若依功能，而在 `views/tool/` 下自建的运营监控类页面（告警分析、异常报告、资源账单、系统画像、编排等）。

## 关键约定
- 新增业务页面：`ruoyi-ui/src/views/tool/<name>/index.vue` + `ruoyi-ui/src/api/tool/<name>.js` + `sql/<name>_menu.sql`（菜单走数据库动态路由，不写 router/index.js）。
- Mock 数据统一放 `ruoyi-ui/mockData/res.js`（不在 src 内），api 层从该文件导入，真实接口代码以注释保留在函数内，方便切换。
- 后端 tool 接口在 `ruoyi-admin/src/main/java/com/ruoyi/web/controller/tool/`。

## UI 规范（AGENTS.md，必须遵守）
- 风格：Modern SaaS / Futuristic / Minimal / Premium；参考 Linear、Datadog、Grafana11、Vercel Dashboard。
- 禁止：Element 默认风格、OA 风格、大面积边框、信息稀疏。
- 运营监控页面信息优先级：系统执行态势 > 状态消息 > 顶部概览。
- 所有 icon 必须 flex 居中。

## 协作规范
- 不自动跑构建；纯前端改动无需构建。
- 后端 java -jar 运行时源码改动需重新构建+重启，须先说明并等用户明确要求。
- 只有用户明确要求才执行验证/构建/启动/测试。
- 保留用户已有改动，不回退无关文件。

## 本地环境
- 后端工具链：`C:\Users\lenovo\.codex\tools\ruoyi-vue`（jdk17 / apache-maven-3.9.16 / redis-5.0.14.1 / garnet）。
- 默认端口：后端 8080，前端 dev 80，MySQL 3306，Redis 6379。
- 启动：根目录 `ry.bat`；打包后 `bin/run.bat`（java -jar ruoyi-admin.jar）。
- 日志：`backend.log`、`backend.err.log`、`ruoyi-ui/npm-dev.log`、`frontend.log`。
