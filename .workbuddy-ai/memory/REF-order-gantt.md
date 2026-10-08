# REF — 工单甘特图（orderGantt）

> 2026-09-21 新增，2026-09-22 / 09-23 更新。**改这个页面前必读。**
> 三层结构：`views/tool/orderGantt/index.vue`（单按钮「查看」+ el-dialog）
> → `components/OrderGantt.vue`（props `orders`，只负责把算好的数字贴到 style）
> → **纯函数 `ganttLayout.js`**（时间域/刻度/行分配/像素几何，全部可在 node 里断言）。
>
> 页头指标（2026-09-23）：只剩「工单总数」「时间跨度」，**「占用行数」已删**（用户要求，行数属内部实现）。
> 分组叫法（2026-09-23）：绿色那组从「手动 / 其他」改成 **「MANUAL 手动」**（图例 + 甘特图标签条 + `groups[].label` 三处一起改）。

## 0. 矩形宽度只认 `total_cost`（2026-09-22 用户明确要求）

**结束时间 = `beginTime` + `total_cost` 分钟，`endTime` 不参与绘图。**

用户原话：「开始时间没问题，取 beginTime，但是甘特图的结束时间不能取 endTime，
要看 total_cost 是多少」。样例里两个字段本来就打架：

| 工单 | beginTime | total_cost | 按 cost 的结束 | 接口 endTime |
| --- | --- | --- | --- | --- |
| CHGU-20260909-0086 | 09-17 18:00 | 115 | **09-17 19:55** | 09-17 23:00 |
| CHGU-20260909-0087 | 09-17 18:00 | 135 | **09-17 20:15** | 09-17 22:00 |
| CHGU-20260916-0047 | 09-18 00:00 | 135 | **09-18 02:15** | 09-18 06:00 |

- 判定只此一处：`ganttLayout.js` 的 `resolveSpan()`。顺序是刻意的：
  `beginTime` 解析不出来 → null（不画）；`total_cost > 0` → 用它；否则才回退 `endTime` 差；
  都没有 → `DEFAULT_DURATION_MIN`（30）。
- **回退分支留着是兜底**：`total_cost` 缺失时宁可退回起止时间差，也不要全画成固定 30 分钟。
- `fromCost` = 「时长不是由起止时间差算出来的」（cost 分支与兜底分支都为 true）。
- 改完必跑 `og_verify.mjs`（§3.2 已按新语义钉住三条断言），期望 `FAILURES: 0`。
- ⚠️ 别把顺序改回去。`endTime` 不代表工单实际占用时间，按它画会把矩形拉长一倍多。

## 1. 其余硬规则（改动时最容易破）

1. **行装箱从下往上**（`packRows(items, {fromBottom:true})`，两遍：先求最优行数再定向）。
   方向反了用户一眼就看出「这条明明能往下挪」。判据是 `rowEnd <= item.start`（端点相接算不重叠）。
2. **弹窗定高 + 按可用高度反推行高**（`fitRowPlan(rowPlan, availableHeight)`），目标**不出现滚动条、一眼看全**。
   - ⚠️ `containerHeight` 必须量**组件根节点 `.og`**，**绝不能量 `.og__plotwrap`** —— 后者高度正是被行高决定的，会形成循环依赖。
   - ⚠️ 三段固定高（页头/日期带/时间轴）**用 `outerHeight` 实测**（`offsetHeight` **漏外边距**，页头少算 12px 就会把时间轴切掉 9px）。行高**不能取整**（取整留 `行数×1px` 空白）。
   - ⚠️ **可用高度里必须扣掉标签条**（见 §1.6）：`fitRowPlan` 与 `buildLayout` 共用 `groupStripHeights()`，
     两边各算一套的话行高会偏大，整图正好多出一条标签条的高度、底部工单被 `overflow-y: hidden` 裁掉。
   - ⚠️ 弹窗选择器写 `.el-dialog.ogp-dialog`（0,2,0），单独 `.ogp-dialog` 压不过 element-ui 的 `margin`（同特异性只看打包顺序）。
3. **配色：AUTO 自动 = 绿，MANUAL 手动 = 蓝**（2026-09-24 用户要求**对调**，此前是反的）。
   变量名**不改**、只换颜色值（`--og-auto-*` 永远代表自动组），
   图例圆点 / 分组底色 / 柱体 / 气泡圆点全走变量，对调后自动跟着变。
   ⚠️ 但气泡里 `.og-tip__mode` 的 `is-auto` / `is-manual` 徽标底色是**硬编码**的（`#e9f9f1` / `#eaf2ff`），
   对调时必须手动跟着换 —— 09-24 就漏过一次（绿柱子配蓝 AUTO 徽标）。
   `og_scss.mjs` 按**色相 + 明度**钉住了两组配色（AUTO 徽标必须绿系、MANUAL 徽标必须蓝系），
   别把两组调换回去。
     - ⚠️ **柱体上不能放白字**（2026-09-22）：底色是浅→中的渐变，白字对比度只有 1.4~1.9，用户反馈过两次。
     文字色走 `--og-auto-ink: #065f46`（深祖母绿）/ `--og-manual-ink: #1e3a8a`（深靛蓝）
     （`.og-bar.is-auto/.is-manual` 映射到 `--og-bar-text`），
     沿渐变最差 4.00 / 3.73，是白字的 3 倍。深色字**不要再挂 text-shadow**（白字时代才需要，会把边缘糊脏）。
4. **悬浮气泡必须紧贴矩形、鼠标能走到气泡上**（气泡里有明细表，走不过去等于白做）：
   - 定位读**渲染后量到的真实高度** `tipSize.h`（估算常量只当兜底）—— 用估算值算 `top`，矮气泡会离矩形 150px。
     模板 `.og-tip` 上**必须有 `ref="tip"`**，否则量不到尺寸；`ResizeObserver` 跟住 JSON 展开导致的高度变化。
   - `TIP_GAP` **必须 ≤ 6px**（矩形高 = `min(22, 行高-6)` → 相邻两行矩形间恒定 6px 缝，间距 ≤6 才盖得住，
     否则鼠标往上走会「跳」到上一行的工单上）。
   - 水平**以矩形中心居中**，不是左对齐矩形左边缘（宽矩形会让鼠标走出气泡左右边界）。
   - 气泡打开期间在 `document` 上挂 `mousemove` 守卫（`startPointerWatch`）：指针在「矩形 ∪ 气泡」±10px 内 → `cancelClose()`；
     走远了且**当前没有定时器**才 `scheduleClose()`（不加这个判断，鼠标一直在外面动就永远关不掉）。
     **只靠 `mouseleave` 定时器不够 —— 鼠标停在缝里不动时没有任何事件，定时器照样到期。**
5. **`detail` 是对象数组、字段固定 `{ type, count, type_cost }`，气泡用表格展示**（2026-09-21 变更）：
   - 表头**直接渲染 key 名**（用户要求「表头就用 key 值」），列取所有行 key 的并集**不写死**，`num`（全列是数字）右对齐。
   - 组件里**不许再引 `vue-json-viewer`**（包本身留着，capacity / function / AtomDetailDialog 还在用）。`og_verify.mjs` §4.1 钉住了。
   - 造数器**不能**给样例单按 mode 覆盖 `total_cost`：样例 1 是 AUTO 但耗时 115 分钟，
     一覆盖成 AUTO 区间（8~30）就破了 `sum(type_cost) <= total_cost`。
   - 两条数据自洽约束（断言钉住）：`type_cost` 是 5 的倍数；`sum(type_cost) <= total_cost`。
   - `TIP_WIDTH` 420 / `TIP_HEIGHT_FALLBACK` 300（实测气泡高：1 行 135px、5 行 243px）。

6. **每个分组上方都有一条标签条（chip）**（2026-09-23 用户要求「甘特图上 MANUAL 手动也要加一行」）：
   - 几何**全在 `ganttLayout.js`**：`CHIP_HEIGHT = 18`、`CHIP_STRIP_HEIGHT = 22`（与 `.og__sep-chip` 的 CSS 对齐），
     `groupStripHeights(manualRows, autoRows, groupGap)` 算各组让出的高度，`groups[].chipTop` 是标签的 y。
     **组件不许自己算**（否则和行高反推对不上）。
   - 手动组的标签条是**新增的独立空间**（原来手动组顶上什么都没有）；AUTO 组的标签条就是两组之间那条缝
     （`groupGap`，标签本来就画在缝里），只有 AUTO 单独存在时才单独留一条。所以 `onlyAuto.groups[0].top === 22` 而不是 0。
   - 虚线 `separatorTop` **仍然只在两组之间画**（手动组上方没有上一组）；标签条与虚线是两回事，别合并回一个 `v-for`。
   - `.og__sep-chip` 现在是 `.og__plot` 的**直接子元素**（不再是 `.og__sep` 的子元素），`top` 由 `chipTop` 内联给出，
     CSS 里不再有 `top: -9px`；`z-index: 6` 高于柱体（5）。改高度时**必须同时改 `CHIP_HEIGHT`**（全局 border-box，18 = 含边框总高）。
7. **柱体文字要么完整、要么不显示**（2026-09-23 用户要求；原来是 148/52 两档阈值 + `slice(-4)`）：
   - 判定拆两半：文字真实宽度由**组件**用 `canvas.measureText` 量（纯函数量不了字体），
     容量判定是纯函数 `barTextCapacity(barWidth)` / `canFitLabel(textWidth, barWidth)`（在 `ganttLayout.js`，可断言）。
   - 量宽用 canvas 而不是隐藏 DOM 节点：上百根柱子各量一次，DOM 方案每次「改文字+读宽度」都强制同步重排。
     字体从 `.og` 的 computed style 取（`.og` 没设 font-family，取到的是继承值），
     字号/字重/字距按 `.og-bar__text` 写死（10px / 500 / 0.2px），**字距 canvas 不认，手动补 `0.2 × 字数`**。
     结果按文字缓存（`_textWidthCache`）；首帧还没挂载时用兜底字体族，挂载后重建量具并清缓存。
   - ⚠️ `textWidth()` 里**必须先取量具、再查缓存**：字体族是挂载后才解析出来的，量具检测到字体变了会清缓存；
     反过来的话首帧用兜底字体量出来的宽度会被一直复用（缓存命中直接 return，永远走不到重建那一步）。
     字体串本身用 `_labelFontReady` **只解析一次** —— 每次渲染会调上百次（每根柱子两次），
     每次都 `getComputedStyle` 会触发上百次样式重算。`og_verify.mjs` §5.6 有这两条源码级回归断言。
   - 容量：`宽度 - 14`（`.og-bar` 的 `padding: 0 7px`）；`is-narrow`（`width < 18`）时内边距为 0；
     再留 `BAR_LABEL_SAFE = 2px` 余量。**实测** 'CHGU-20260909-0087' 在 Chrome 里是 **106.4px**，
     所以完整工单号至少要 122.4px 宽的矩形（原来阈值 148 偏大，但同一量级）。
   - 后果要提前跟用户说：矩形普遍不够宽时**大量工单号不显示**（demo 100 条里只有 12 条够宽；真实 3 条样例里 2 条）。
     这是用户明确要的（完整信息在悬浮气泡里），但每次改完要报一下实际条数。
   - ⚠️ 别退回 `slice(-4)` 或 `text-overflow: ellipsis` —— 半截工单号（`CHGU-20260909-0…` / `0086`）比不写更容易误读。

8. **气泡明细表里 `type` 单元格有「占比进度条」**（2026-09-24 用户要求，照参考图）：
   - 条长 = `type_cost` / 工单 **`total_cost`**（用户点名的分母，**不是** `sum(type_cost)`），**封顶 1**。
     真实样例 `CHGU-20260909-0086` 的 `total_cost` 是 30、detail 合计 50（30/15/5）→ 第一行正好 100%（封顶在起作用）。
   - 分母取 `bar.durationMinutes` 而**不是** `raw.total_cost`：`resolveSpan()` 里「total_cost > 0 就按它算」，
     正常情况两者是同一个数；`total_cost` 缺失时它还能回退成起止时间差，不会整张表一条条都不画。
   - 铺在 **`type` 列**（`barColumnKey`：有 `type` 用 `type`，没有就退到第一列），
     **每行一种颜色**（`BAR_PALETTE` 6 色循环）。调色板都是「高明度填充 + 同色系描边」——
     `type` 文字（`--og-text` #1f2937）是**压在条上**的，填充一深就糊；实测最差对比度 10.6。
   - ⚠️ 条必须 `position: absolute`，且 `.og-tip__cell` 必须 `position: relative`：
     前者保证**加进度条前后气泡高度一模一样**（气泡高度直接决定悬浮位置，一变鼠标就走不过去）；
     后者是百分比宽度的包含块 —— 少了它最近的定位祖先是 `.og-tip`（`position: fixed`），
     条会按 420px 解析、比单元格宽 4 倍（实测 26% 的条看着像铺满）。
   - ⚠️ 静态预览（`og_preview*.mjs`）的 `renderDetailTable` 必须同步同一套规则，
     调色板**从组件源码正则抠**（不自己抄一份），否则预览会骗人。

9. **分组标签条的量词是「单」不是「条」**（2026-09-24 用户要求）：
   `{{ g.label }} · {{ g.count }} 单` → 「MANUAL 手动 · 2 单」。
   ⚠️ 只改**标签条**这一处。页面上另外两处带「条」的文案（弹窗标题 `N 条工单`、
   卡片提示 `已获取 N 条工单`）用户没让改，别顺手动 —— 「3 条工单」本来就是通顺的。
   `og_check_labels.mjs` / `og_preview*.mjs` 里的同款文案已同步。

## 2. 边缘与几何

- **任何「有宽度的东西」都不能画在 `x === plotWidth` 上**：`alignDomain` 保证最后一个刻度恰好落在 plotWidth，
  1px 宽的网格线右边缘顶到 plotWidth+1 → `overflow-x: auto` 就冒出一根横向滚动条。
  网格线/刻度短线走 `gridTicks`（过滤过），**标签仍用完整 `ticks`**。
- 时间域跨度大时**不横向撑开**（`plotWidth = max(360, 容器宽)`）；真到 3 天时矩形被压窄但保证 ≥8px 仍可悬浮。
- 其余：AUTO 分组置底、尾部外溢要偏置、`packRows` 副本坑、对齐后要重校验格数 → 见 `2026-09-21.md`。

## 3. 校验（脚本都在 `C:/Users/lenovo/AppData/Local/Temp/`）

| 脚本 | 管什么 |
| --- | --- |
| `og_verify.mjs` | 全量，**须 `FAILURES: 0`**。§3.2 = 时长规则，§4.1 = 禁 vue-json-viewer，§5.5 = 气泡可达性源码断言，**§5.6 = 09-23 四项改动（页头指标 / 标签条 / canFitLabel / 标签条计入总高）** |
| `og_scss.mjs` | SCSS 编译 + 配色色相 + **柱体文字对比度 / 白字回归防线** |
| `og_rows.mjs` | 行装箱方向（「可往下挪」必须 0 条） |
| `og_diag.mjs` | 数值体检（行高/矩形宽/间隙/日期段/**能显示文字的条数**，用实测 106.4px 当常量） |
| `og_preview.mjs` | 静态预览 HTML（demo 数据） |
| `og_preview_seed.mjs` | 静态预览 HTML（**用户给的 3 条真实样例** + 结束时间核对表） |
| `og_check_labels.mjs` | **真实浏览器 + 真实页面**（登录 → /tool/orderGantt → 查看）：页头 2 个指标、图例文案、两条标签条不压柱体、**没有被 ellipsis 截断的工单号**、无横/纵滚动条 |
| `og_shot_chip.mjs` | 两个静态预览的浏览器核对 + `.og__plotwrap` 元素截图（`deviceScaleFactor:2`） |
| `og_verify_browser.mjs` | 真实浏览器：`scrollWidth === clientWidth` 才算「不滚动」 |
| `og_verify_tip.mjs` | 气泡可达性（真实浏览器，含「分步移动鼠标走过去」「停在缝里 700ms」） |
| `og_shot_ink.mjs` | 开预览 HTML 截柱体文字，`deviceScaleFactor:2` |
| `og_syntax_check.mjs` | **进程内**跑 SFC 模板 + 脚本语法（不 spawn 子进程）+ 进度条四件套 / 调色板对比度 |
| `og_shot_tipbar.mjs` | 两个静态预览：配色对调（AUTO 绿 / MANUAL 蓝）+ 进度条宽度比例 + 截 `.og-tip` |
| `og_probe_tipbar_live.mjs` | **真实浏览器 + 真实页面**：登录 → `/tool/orderGantt` → 查看 → 悬浮 AUTO 矩形，核对配色与进度条（100/50/16.67%）+ 截图 |
| `og_filter_check.mjs` | 弹窗日期过滤条（`index.vue`）：模板/接线源码断言（`type="date"` / `value-format` / 传参 `{ date }` / 不再出现 `beginTime`）+ **真实执行 `defaultDate()`**（注入假 Date 跑当天首末秒、月初、年末、年初 6 个边界） |
| `og_probe_filter_live.mjs` | **真实浏览器 + 真实页面**：默认**当天**、是单日期不是 range、选择器可点开、Esc 只关面板不关弹窗、量词是「单」、**加了过滤条后甘特图仍不滚动**、换日期点搜索后弹窗仍在 |

⚠️ **受限环境里 `og_verify.mjs` 会有 6 条假红**：它的语法检查走
`execFileSync(process.execPath, ['--check', tmp])`，子进程被沙箱拒绝时报
`spawnSync <node.exe> EBUSY`，于是 6 个文件一起报「语法错误」。
判据：报错文本里是 `spawnSync` / `EBUSY` 而不是 `SyntaxError` + 行号。
用 `og_syntax_check.mjs`（`vue-template-compiler` + `@babel/parser`，进程内）代替即可。
除这 6 条外，`og_verify.mjs` 的其余断言必须全绿。

⚠️ 预览页（`og_preview*.mjs`）09-23 修掉三个**渲染器自身的坑**，之前一直让它「看起来有问题」：
1. `.og` 的 `<div>` **没闭合**，后面的 `.stage`（气泡示例）被当成 `.og` 的 flex 子项，
   把 `.og__plotwrap` 挤到只剩 ~190px（柱体全被裁）。现在收三层：`</div></div></div>`。
2. `.shell` 宽度 1320 → **1322**（= plotWidth 1280 + body 左右内边距 40 + 绘图容器边框 2），
   否则 plotwrap 的 clientWidth 只有 1278，凭空多 2px 横向滚动。
3. 竖向网格线 / 时间轴短线**没按组件的 `gridTicks` 过滤**（`x < plotWidth - 0.5`），
   画在 plotWidth 上的那根会撑出 1px 横向滚动条。

⚠️ `og_verify.mjs` §4 造数断言**必须给 `buildOrderList` 注入 `now`**：默认取 `Date.now()`，而窗口断言用固定日期，
不注入就隔天必报「主窗口 0 条」+「同种子不一致」两条假失败（2026-09-22 踩过）。

⚠️ 页面上的 `api/tool/orderGantt.js` **把 3 条样例内联在 `getOrderList` 里**（`USE_MOCK` 为 true 时直接用，
不走 `_mockOrderGantt.js` 的 100 条造数）。所以真实页面上只有 3 条工单，`0086` 的 `total_cost` 是 **30**
（不是文档注释里的 115）—— 它画出来只有 79px 宽，**放不下工单号，按新规则不显示文字**，不是 bug。

⚠️ `og_shot_ink.mjs` 截图前先把预览页 `.og__plotwrap` 撑开 —— 它只有 ~192px 高，蓝条会被裁在视口外。

## 4. 弹窗里的日期过滤条（index.vue，2026-09-24 新增，同日改为单日期）

**需求（最终形态）**：弹窗里加**日期**选择器，默认**当天**，传参字段名 **`date`**（`'YYYY-MM-DD'`），
加搜索按钮，用户可自行改日期后就地重查。
> 中途变过一次：最初要的是 `datetimerange`（默认「昨天 18:00 → 今天 08:00」，传 `beginTime` / `endTime`），
> 随后用户改成「传日期了」→ 单日期 + `date`。**现在只有 `date`，`beginTime` / `endTime` 已全部移除。**

- 默认值在 `index.vue` 的 `defaultDate()` 里算：`formatDate(new Date())`，取**本地**年月日，
  不做时区换算 —— 页面显示的、传给后端的都是同一个本地日期。
- 格式 `'YYYY-MM-DD'`：`el-date-picker` 的 `value-format="yyyy-MM-dd"`，
  且与项目里其它 `date` 字段一致（`execPlan.js` / `execPlanSimple.js` 的样例就是 `'2026-08-07'`）。
- ⚠️ **只在 `data()` 里算一次**（页面加载时刻）—— 刻意**不**在每次打开弹窗时重置，
  否则用户选完日期、关掉再点「查看」就被悄悄改回去了。跨过 0 点不会自动变「新当天」，同理。
- `:clearable="false"`：日期始终有值，不会发出空参数（真为空则只提示、不发请求）。
- 「查看」和「搜索」共用 `fetchOrders()`，区别只是「搜索」时弹窗本来就开着。
  查不到数据分两种：弹窗没开（首次查看）→ 只提示不开空弹窗；弹窗已开（搜索）→
  **把 `orders` 清空**让图切空态（不能留着上一次的数据，那样图和上面选的日期对不上）。
- ⚠️ **`.ogp-dialog__body` 这层包裹不能省**：弹窗 body 是 flex 容器，甘特图要「吃剩余高度」，
  中间必须有个 `column flex + min-height: 0` 的父级把高度传下去，否则组件量到 0、行高反推失效。
  实测加了过滤条后 `.og` 707 → 662px，`scrollWidth === clientWidth` 仍成立（不滚动）。
- ⚠️ **`.ogp-dialog__body` 里要自己再声明一份 `--ogp-*` 变量**：弹窗是 `append-to-body` 的，
  这层 DOM 挂在 `body` 下、**不在 `.ogp-page` 里面**，页面根节点上的变量继承不到（边框会直接消失）。
- ⚠️ **弹窗必须加 `:close-on-press-escape="false"`**（实测踩过）：
  日期面板的 Esc 由 `el-date-picker` 的 `handleKeydown` 处理（并 `stopPropagation`），
  **但前提是焦点在那个 input 上**。焦点不在时 Esc 直接冒到 `document`，被弹窗接走 → 整个弹窗被关掉。
  加了之后：面板开着按 Esc 只关面板、弹窗留着。
- ⚠️ **mock 分支刻意不按 `date` 过滤**（见 `api/tool/orderGantt.js` 的注释）：
  3 条样例工单是 09-17 / 09-18，默认日期是「今天」，一过滤就永远「未取到任何工单数据」、弹窗都打不开。
  **别顺手给它加过滤。** 同理：因为走 mock，网络上观察不到请求体 ——
  参数名的接线靠 `og_filter_check.mjs` 做源码级断言。
