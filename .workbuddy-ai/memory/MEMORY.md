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
- **指标顺序的唯一来源是 `shape.js` 的 `METRIC_ORDER`**（2026-09-21 起页面不再区分 P1/P2，10 项固定顺序，
  `orderMetrics` 稳定排序，表里没有的排最后）。**页面不许再抄一份顺序**；后端拆几个 key、按什么顺序返回都无所谓。
- ⚠️ **接口/mock 数据不要擅自改**：用户要的是「页面上不这么分」，不是「数据层合并」。
  第一版把 mock 里 P1+P2 合并成一个 key，被用户打回（「不要改 mockData 里面的数据呀」）。
  **要改展示就只改展示层**；但**用户点名要改的**（如「顺便改 mock 字段名」）照做 —— 分清这两种。
- 表格列 = `alertKey / summary / misinfoReason / alertReasonDesc / AgentTrace / output / more`。
  ⚠️ **`misinfoReason` 的 i 是小写**（mock 已同步）；`alertSource` / `closedBy` **不展示**。
- 两个外部跳转（都新开 tab，常量在 `AlarmTable.vue` 顶部）：`alertKey` 列的值 →
  `http://alt.eprod-kzx1.cncb/#/jiraAlertInfo?alertKey=<alertKey>`；more 列「查看简报」→
  `http://10.2.64.23/gdb_screen/#/agentInfo?activeRunId=<runId>`。判空别用 `||`（`runId: 0` 会被当空）。
  ⚠️ 「更多字段」弹窗因此**没了入口**（代码留着）。
- **组别下拉**：字典 `dict_system_group`（label 与 value 相同：不限定组别/全量/基础平台域），
  SQL 在 `sql/dict_system_group.sql`；`form.teamName` 默认「不限定组别」且**始终进请求参数**（systemId 仍是不填不带）。
  ⚠️ 数据库里当时还没这个字典，下拉展开是空的 —— 需用户执行 SQL。
- 概览区的「告警总量」（明细行数）与指标条里的「告警总量」（后端统计值）**同名不同值**，
  用户已知、明确不动 —— **别再顺手改概览**。
- `AI处置` = nested 型，**两级数量都不固定（各可能十几二十个）**：一级用左侧竖排导航，二级用可换行 chip（默认**「全部」**，是**筛选**不是切换）。
- `buildQueryParams`：**系统 ID 选填 —— 不填时参数里压根没有 `systemId` 这个 key**（不是空串）。
- **细节与坑（`levelTone` 顺序、`flattenLevel` 兜底、窄屏降级、三个校验脚本）→ `REF-alarm-analysis.md`，改这个页面前必读。**

## 执行页面 / 明细弹窗
- 最容易踩的都在 REF 里，**动手前必读**：轮询必须静默 / 横滚在每条流内部 / 页头进度算法 / 哑组件契约 / `type="expand"` 不能加 `fixed`。
  → `REF-exec-page.md`（执行页面、流布局、右键菜单、节点操作）、`REF-exec-detail.md`（查看明细弹窗）。

## 工单甘特图（orderGantt，2026-09-21 新增）
- 页面 `views/tool/orderGantt/index.vue`（单按钮「查看」+ el-dialog）→ 组件 `components/OrderGantt.vue`（props `orders`）→ **纯函数 `ganttLayout.js`**（可 node 断言）。
- **五条硬规则**（改动时最容易破）：
  1. **行装箱从下往上**（`packRows(items, {fromBottom:true})`，两遍：先求最优行数再定向）。方向反了用户一眼就看出「这条明明能往下挪」。
  2. **弹窗定高 + 按可用高度反推行高**（`fitRowPlan(rowPlan, availableHeight)`），目标是**不出现滚动条、一眼看全**。
     ⚠️ `containerHeight` 必须量**组件根节点 `.og`**，**绝不能量 `.og__plotwrap`** —— 后者的高度正是被行高决定的，会形成循环依赖。
     ⚠️ 三段固定高（页头/日期带/时间轴）**用 `outerHeight` 实测**（`offsetHeight` **漏外边距**，页头少算 12px 就会把时间轴切掉 9px）。行高**不能取整**（取整留 `行数×1px` 空白）。
     ⚠️ 弹窗选择器写 `.el-dialog.ogp-dialog`（0,2,0），单独 `.ogp-dialog` 压不过 element-ui 的 `margin`（同特异性只看打包顺序）。
  3. **配色：AUTO = 蓝，手动 / 其他 = 绿**（`--og-auto-*` / `--og-manual-*`，图例/气泡/柱体全走变量）。
     改动时别把两组调换回去 —— `og_scss.mjs` 按**色相 + 明度**钉住了。
     ⚠️ **柱体上不能放白字**（2026-09-22）：底色是浅→中的渐变，白字对比度只有 1.4~1.9，用户反馈过两次。
     文字色走 `--og-manual-ink: #065f46` / `--og-auto-ink: #1e3a8a`（`.og-bar.is-manual/.is-auto` 里映射到 `--og-bar-text`），
     沿渐变最差 4.00 / 3.73，是白字的 3 倍。深色字**不要再挂 text-shadow**（白字时代才需要，会把边缘糊脏）。
  4. **悬浮气泡必须紧贴矩形、鼠标能走到气泡上**（气泡里有 JsonViewer，走不过去等于白做）：
     - 定位读**渲染后量到的真实高度** `tipSize.h`（估算常量只当兜底）—— 用估算值算 `top`，矮气泡会离矩形 150px。
       模板 `.og-tip` 上**必须有 `ref="tip"`**，否则量不到尺寸；`ResizeObserver` 跟住 JSON 展开导致的高度变化。
     - `TIP_GAP` **必须 ≤ 6px**（算出来的：矩形高 = `min(22, 行高-6)` → 相邻两行矩形间恒定 6px 缝，间距 ≤6 才盖得住，否则鼠标往上走会「跳」到上一行的工单上）。
     - 水平**以矩形中心居中**，不是左对齐矩形左边缘（宽矩形会让鼠标走出气泡左右边界）。
     - 气泡打开期间在 `document` 上挂 `mousemove` 守卫（`startPointerWatch`）：指针在「矩形 ∪ 气泡」±10px 内 → `cancelClose()`；走远了且**当前没有定时器**才 `scheduleClose()`（不加这个判断，鼠标一直在外面动就永远关不掉）。**只靠 `mouseleave` 定时器不够 —— 鼠标停在缝里不动时没有任何事件，定时器照样到期。**
     - 验收：`og_verify_tip.mjs`（真实浏览器，8 组断言，含「分步移动鼠标走过去」「停在缝里 700ms」），源码断言在 `og_verify.mjs` §5.5。
  5. **`detail` 是对象数组、字段固定 `{ type, count, type_cost }`，气泡用表格展示**（2026-09-21 变更）：
     - 表头**直接渲染 key 名**（用户要求「表头就用 key 值」），列取所有行 key 的并集**不写死**，`num`（全列是数字）右对齐。
     - 组件里**不许再引 `vue-json-viewer`**（包本身留着，capacity / function / AtomDetailDialog 还在用）。`og_verify.mjs` §4.1 钉住了这条。
     - 造数器**不能**给样例单按 mode 覆盖 `total_cost`：样例 1 是 AUTO 但耗时 115 分钟，一覆盖成 AUTO 区间（8~30）就破了 `sum(type_cost) <= total_cost`。
     - 两条数据自洽约束（断言钉住）：`type_cost` 是 5 的倍数；`sum(type_cost) <= total_cost`。
     - `TIP_WIDTH` 420 / `TIP_HEIGHT_FALLBACK` 300（实测气泡高：1 行 135px、5 行 243px）。
- **任何「有宽度的东西」都不能画在 `x === plotWidth` 上**：`alignDomain` 保证最后一个刻度恰好落在 plotWidth，
  1px 宽的网格线右边缘顶到 plotWidth+1 → `overflow-x: auto` 就冒出一根横向滚动条。网格线/刻度短线走 `gridTicks`（过滤过），**标签仍用完整 `ticks`**。
- 时间域跨度大时**不横向撑开**（`plotWidth = max(360, 容器宽)`）；真到 3 天时矩形被压窄但保证 ≥8px 仍可悬浮。
- 校验：`og_verify.mjs`（全量，须 FAILURES:0）+ `og_scss.mjs`（编译 + 配色色相 + **柱体文字对比度/白字回归防线**）+ `og_rows.mjs`（方向）+ `og_diag.mjs`（数值体检）+ `og_preview.mjs`（静态预览 HTML）+ **`og_verify_browser.mjs`（真实浏览器：`scrollWidth===clientWidth` 才算「不滚动」）** + **`og_verify_tip.mjs`（气泡可达性）**。
  ⚠️ `og_verify.mjs` §4 造数断言**必须给 `buildOrderList` 注入 `now`**：默认取 `Date.now()`，而窗口断言用固定日期，
  不注入就隔天必报「主窗口 0 条」+「同种子不一致」两条假失败（2026-09-22 踩过）。
- 视觉验收：`og_shot_ink.mjs`（开预览 HTML 截柱体文字，`deviceScaleFactor:2`；预览页 `.og__plotwrap` 只有 ~192px 高，蓝条会被裁在视口外，截图前先撑开）。
- 其余细节（矩形宽度判定只此一处、AUTO 分组置底、尾部外溢要偏置、`packRows` 副本坑、对齐后要重校验格数）见 `2026-09-21.md`。

## 校验 / 协作
- node 校验：`cd C:/Users/lenovo/AppData/Local/Temp && node --experimental-loader ./resolve_ext_loader.mjs ./test_xxx.mjs`。浏览器视觉/像素校验见技能 `ruoyi-ui-node-verify`。
- **dev server 日志认人**：仓库根 `frontend.log` 是旧的，真正在写的是 **`ruoyi-ui/npm-dev.log`** —— 先 `ls -lat *.log` 按 mtime 判断，再比「最后一次 `Compiled` 时间 > 所有源文件 mtime」。
- 不自动跑构建；纯前端改动无需构建。后端 `java -jar` 改动需重构建+重启，**须先说明并等用户明确要求**。工具链 `C:\Users\lenovo\.codex\tools\ruoyi-vue`。
- 指出差异时**先复述对方意图**，再讲「在什么输入下达不到该意图」；**能用数据复现就先复现**（本次写脚本量出「38 条可往下挪」，比争论有用）。
