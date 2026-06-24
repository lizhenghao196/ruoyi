请在总览页面右上角工具栏最右侧，把现有 `.panel-live` 从单纯的 `Live` 升级为“实时状态 + 当前时间”胶囊。

目标文件：
ruoyi-ui/src/views/tool/overview/index.vue

要求：
1. 不要新增依赖。
2. 不要改变接口逻辑。
3. 保留 Live 绿点状态。
4. 在 Live 后面显示当前浏览器本地时间，格式为 `HH:mm:ss`。
5. 鼠标悬浮 title 可显示完整日期时间，例如 `2026-06-23 周二 14:32:08`。
6. 每秒刷新时间，组件销毁时清理 timer。
7. 样式保持 Modern SaaS / Grafana / Linear 风格。
8. 时间使用等宽字体。
9. light/dark 两种主题都要适配。
10. 不要把时间放到系统卡片里，也不要新增大面积时间卡片。

推荐文案结构：
`Live · 14:32:08`

推荐位置：
复用现有 `.panel-live`，仍放在 `.execution-toolbar` 最右侧。