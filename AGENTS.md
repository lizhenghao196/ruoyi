# AGENTS

## 项目介绍

这是一个若依 `RuoYi-Vue` 后台管理系统项目，采用前后端分离架构。

项目主要用于后台管理、系统配置、权限菜单、代码生成、系统工具等管理类场景。前端位于 `ruoyi-ui`，后端入口位于 `ruoyi-admin`，公共模块、系统模块、框架模块等按若依默认结构组织。

## 技术栈

- 前端：Vue 2、Vuex、Vue Router、Element UI、Axios、SCSS
- 后端：Spring Boot、Spring Security、MyBatis、Druid
- 数据库：MySQL
- 缓存：Redis
- 构建工具：Maven、Vue CLI、npm

## 编码规范

- 尽量沿用若依原有目录结构、命名方式和代码风格。
- 前端页面优先复用 Element UI 和项目已有组件，不随意引入新依赖。
- 后端接口优先遵循若依现有 Controller、Service、Mapper 分层方式。
- 修改代码前先确认影响范围，避免无关重构。
- 保留用户已有改动，不回退、不覆盖无关文件。

## UI 风格

- 后台管理页面保持清晰、紧凑、易扫描的工作台风格。
- 表单、按钮、卡片、表格等优先遵循若依和 Element UI 的现有视觉规范。
- 动效应服务于状态变化和操作反馈，避免过度装饰。
- 卡片、列表、面板等布局要注意尺寸一致性和响应式表现。

## 协作规则

- 每次改完代码后不要自动跑构建。
- 纯前端改动通常不需要重新构建。
- 后端改动后不要默认重新构建，先判断当前运行方式：如果是源码或开发模式运行，优先重启后端；如果是 `java -jar` 方式运行且 Java 源码改动需要立即生效，先说明必须重新构建并重启，得到用户明确要求后再执行构建。
- 后端配置或资源改动能通过重启生效时，优先只重启后端，不随意跑前端构建。
- 只有在用户明确要求验证、构建、启动、测试时，再运行对应命令。
- 如果需要建议验证方式，先说明建议命令，由用户决定是否执行。
- 后端工具在C:\Users\lenovo\.codex\tools\ruoyi-vue，你启动后端应该要用到

AGENTS.md

# UI Style

- Modern SaaS
- Futuristic
- Minimal
- Premium

参考：

- Linear
- Datadog
- Grafana11
- Vercel Dashboard

禁止：

- Element默认风格
- OA风格
- 大面积边框
- 信息稀疏

运营监控页面：

系统执行态势 > 状态消息 > 顶部概览

所有icon必须flex居中。