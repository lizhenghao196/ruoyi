# MEMORY.md — RuoYi-Vue 工作台长期备忘

> 只留「不知道就会做错」的。**动手前先读对应 REF**：
> 告警分析 → `REF-alarm-analysis.md`；执行页面/流布局/右键菜单/节点操作 → `REF-exec-page.md`；「查看明细」弹窗 → `REF-exec-detail.md`。历史见 `2026-09-*.md`。

## 项目约定
- 新页面 = `views/tool/<n>/index.vue` + `api/tool/<n>.js` + `sql/<n>_menu.sql`；菜单走数据库动态路由，**不写** `router/index.js`。Mock 放 `mockData/res.js`，演示数据在 `api/tool/_demo*.js`。
- **mock/真实开关** `api/tool/_mockFlag.js` 的 `USE_MOCK`（覆盖 execPage/execPlan）：`execPlan.js` = 真实接口 + `if(USE_MOCK) return mockApi('x',参数)`；`_mockApi.js` = 全部 mock 实现（动态 import）。接真实 = 改 false 后删 `_mockApi.js`/`_demo*.js`/`mockData/res.js` + 各函数那三行。**改 `execPlan.js` 必跑 `test_mock_switch.mjs`**。
- **`code: 0` 能过拦截器是巧合**（`utils/request.js` 是 `res.data.code || 200`）。python `func/*` 成功码就是 0，**别判 `code === 200`**。
- **取载荷一律走 `pickPayload(res)`**：载荷可能在 `data` 也可能在 `rows`；`data` 非 undefined/null 就用它（**`[]`/`''`/`0`/`false` 都算有值，别用 `||` 判**）。页面里**不许出现裸 `res.data`/`res.rows`**。
- 明细弹窗有两条硬约束（`funcChName` 拼写、有 `type="expand"` 的表不许加 `fixed`），**动手前读 `REF-exec-detail.md`**。

## CSS 两个通用坑（任何页面都会踩）
- ⚠️ **全局元素选择器会漏进 scoped 组件**：`assets/styles/index.scss:99` 的 `aside { padding:8px 24px; margin-bottom:20px; line-height:32px; font-size:16px }` 会命中组件里的 `<aside>`。组件选择器特异性更高，但**特异性只对「双方都声明过的属性」生效**——没声明的照样吃全局值；`margin-bottom:20px` 会让 `align-items:stretch` 拉伸出的高度被扣掉 20px（比邻列矮一道缝）。**写 scoped 时把 padding/margin/line-height/font-size 一起显式重置**。
- ⚠️ **表格底部横线靠 `.el-table::before`**：`.el-table--border` 自己 `border-bottom:none`，底线**完全靠 `::before`**（右侧竖线是 `--border::after`）。**绝不能写 `.el-table { &::before { display:none } }`**，否则底部敞口。

## 告警分析（alarmAnalysis）
- **页面不认 P1/P2/P3，只认「形态」**：唯一判定处 `views/tool/alarmAnalysis/shape.js`（纯函数）。所有 `metrics` 型 key 合并成**一条**指标条，
  其余按 key 顺序出区块，**不返回的 key 不产出区块**（如 重复性分析），页面零特判。
- `AI处置` = nested 型，**两级数量都不固定（各可能十几二十个）**：一级用左侧竖排导航，二级用可换行 chip（默认**「全部」**，是**筛选**不是切换）。
- `buildQueryParams`：**系统 ID 选填 —— 不填时参数里压根没有 `systemId` 这个 key**（不是空串）。
- **细节与坑（`levelTone` 顺序、`flattenLevel` 兜底、窄屏降级、两个校验脚本）→ `REF-alarm-analysis.md`，改这个页面前必读。**

## 执行页面 / 明细弹窗
- 最容易踩的都在 REF 里，**动手前必读**：轮询必须静默 / 横滚在每条流内部 / 页头进度算法 / 哑组件契约 / `type="expand"` 不能加 `fixed`。
  → `REF-exec-page.md`（执行页面、流布局、右键菜单、节点操作）、`REF-exec-detail.md`（查看明细弹窗）。

## 校验 / 协作
- node 校验：`cd C:/Users/lenovo/AppData/Local/Temp && node --experimental-loader ./resolve_ext_loader.mjs ./test_xxx.mjs`。浏览器视觉/像素校验见技能 `ruoyi-ui-node-verify`。
- 不自动跑构建；纯前端改动无需构建。后端 `java -jar` 改动需重构建+重启，**须先说明并等用户明确要求**。工具链 `C:\Users\lenovo\.codex\tools\ruoyi-vue`。
- 指出差异时**先复述对方意图**，再讲「在什么输入下达不到该意图」。
