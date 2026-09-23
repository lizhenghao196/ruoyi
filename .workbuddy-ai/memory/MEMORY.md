# MEMORY.md — RuoYi-Vue 工作台长期备忘

> 只留「不知道就会做错」的。**动手前读对应 REF**：`REF-alarm-analysis.md`（告警分析）、`REF-exec-page.md`（执行页面/流布局/右键菜单）、`REF-exec-detail.md`（查看明细弹窗）、`REF-exec-simple.md`（执行界面简版）、`REF-order-gantt.md`（工单甘特图）。历史见 `2026-09-*.md`。

## 项目约定
- 新页面 = `views/tool/<n>/index.vue` + `api/tool/<n>.js` + `sql/<n>_menu.sql`；菜单走数据库动态路由，**不写** `router/index.js`。Mock 在 `mockData/res.js`。
- **mock/真实开关** = `_mockFlag.js` 的 `USE_MOCK`：函数体 = 真实接口 + `if(USE_MOCK) return mockApi('x',参数)`，mock 实现在 `_mockApi.js`。接真实 = 改 false 后删 `_mockApi.js`/`_demo*.js`/`mockData/res.js` + 各函数那三行。**改 `execPlan.js` 必跑 `test_mock_switch.mjs`**。
- **`code: 0` 能过拦截器是巧合**（`utils/request.js` 是 `res.data.code || 200`）；python `func/*` 成功码就是 0，**别判 `code === 200`**。
- **取载荷一律走 `pickPayload(res)`**：载荷可能在 `data` 也可能在 `rows`，`data` 非 undefined/null 就用它（**`[]`/`''`/`0`/`false` 都算有值，别用 `||` 判**）；页面里**不许出现裸 `res.data`/`res.rows`**。

## CSS 两个通用坑
- ⚠️ **全局元素选择器会漏进 scoped 组件**：`assets/styles/index.scss:99` 的 `aside { padding:8px 24px; margin-bottom:20px; line-height:32px; font-size:16px }` 会命中组件里的 `<aside>`。**特异性只对「双方都声明过的属性」生效**，没声明的照样吃全局值（`margin-bottom:20px` 会让 `stretch` 高度被扣 20px）。**scoped 里把这四个属性一起显式重置**。
- ⚠️ **表格底线靠 `.el-table::before`**（`--border` 变体自身 `border-bottom:none`）。**绝不能给它 `display:none`**，否则底部敞口。

## 告警分析（alarmAnalysis）
- **页面不认 P1/P2/P3，只认「形态」**：唯一判定处 `alarmAnalysis/shape.js`（纯函数）。`metrics` 型 key 合并成**一条**指标条，其余按 key 顺序出区块，不返回的 key 不产出区块；顺序唯一来源是 `shape.js` 的 `METRIC_ORDER`，**页面不许再抄一份**。
- ⚠️ **接口/mock 数据不要擅自改**：用户要的是「页面上不这么分」，不是「数据层合并」（把 mock 的 P1+P2 合并成一个 key 被打回过）。**要改展示就只改展示层**；**用户点名要改的**才改。
- 表格列 `alertKey / summary / misinfoReason / alertReasonDesc / AgentTrace / output / more`；⚠️ **`misinfoReason` 的 i 是小写**；`alertSource`/`closedBy` 不展示。
- 两个外部跳转（新开 tab，常量在 `AlarmTable.vue` 顶部）：`alertKey` → `http://alt.eprod-kzx1.cncb/#/jiraAlertInfo?alertKey=<值>`；more 列「查看简报」→ `http://10.2.64.23/gdb_screen/#/agentInfo?activeRunId=<runId>`。判空别用 `||`（`runId: 0` 会被当空）。「更多字段」弹窗因此没了入口。
- 组别下拉走字典 `dict_system_group`；`form.teamName` 默认「不限定组别」且**始终进请求参数**（systemId 不填不带）。概览区与指标条的「告警总量」**同名不同值**，用户明确不动。`AI处置` 是 nested 型、两级数量不固定（二级 chip 是**筛选**）。
- **细节（`levelTone` 顺序、`flattenLevel` 兜底、窄屏降级、三个校验脚本、字典 SQL）→ `REF-alarm-analysis.md`。**

## 执行页面 / 明细弹窗 / 执行界面简版
- **动手前必读**（三个 REF）：轮询必须静默 / 横滚在每条流内部 / 页头进度算法 / 哑组件契约 / `type="expand"` 不能加 `fixed`；execPlanList / execPageSimple 与 execPage **代码零共享**，别互相 import。

## 工单甘特图（orderGantt）
- ⚠️ **矩形宽度只认 `total_cost`**：结束时间 = `beginTime + total_cost 分钟`，**`endTime` 不参与绘图**（2026-09-22 用户明确要求），判定只此一处 = `ganttLayout.js` 的 `resolveSpan()`。**改这个页面前读 `REF-order-gantt.md`**（五条硬规则、气泡可达性、边缘不溢出、九个校验脚本）。

## 校验 / 协作
- node 校验：`cd C:/Users/lenovo/AppData/Local/Temp && node --experimental-loader ./resolve_ext_loader.mjs ./test_xxx.mjs`；浏览器像素校验见技能 `ruoyi-ui-node-verify`。**dev server 日志认人**：根目录 `frontend.log` 是旧的，真正在写的是 `ruoyi-ui/npm-dev.log`。
- 不自动跑构建；纯前端改动无需构建。后端 `java -jar` 改动需重构建+重启，**须先说明并等用户明确要求**。工具链 `C:\Users\lenovo\.codex\tools\ruoyi-vue`。