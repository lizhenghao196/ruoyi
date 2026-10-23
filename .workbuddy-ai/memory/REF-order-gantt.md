# REF — 工单甘特图（orderGantt）

> 2026-09-21 新增，2026-09-22 / 09-23 更新，**2026-10-16 横坐标改为固定窗口（见 §7，动手前先看）**。
> 三层结构：`views/tool/orderGantt/index.vue`（单按钮「查看」+ el-dialog）
> → `components/OrderGantt.vue`（props `orders`，只负责把算好的数字贴到 style）
> → **纯函数 `ganttLayout.js`**（时间域/刻度/行分配/像素几何，全部可在 node 里断言）。
>
> 页头指标（2026-09-23）：只剩「工单总数」「时间跨度」，**「占用行数」已删**（用户要求，行数属内部实现）。
> 分组叫法（2026-09-23）：绿色那组从「手动 / 其他」改成 **「MANUAL 手动」**（图例 + 甘特图标签条 + `groups[].label` 三处一起改）。

## 0. 矩形宽度：MANUAL 认 `total_cost`；AUTO 取 max(total_cost, 末位节点结束)
（2026-09-22 用户明确要求；**2026-10-12 按 mode 拆分修订**）

- **MANUAL（原样不变）**：结束时间 = `beginTime` + `total_cost` 分钟，**`endTime` 不参与绘图**。
  用户原话（2026-09-22）：「开始时间没问题，取 beginTime，但是甘特图的结束时间不能取 endTime，
  要看 total_cost 是多少」。样例里两个字段本来就打架（0086 起止跨 5 小时但 total_cost 115 等）。
- **AUTO（2026-10-12 需求变更，用户原话「综合 total_cost 和 node_detail 的 plan_start_time，
  取最长」）**：结束时间 = `max(beginTime + total_cost 推出, node_detail 最后一个节点的真正结束)`。
  末位节点 = 按 plan_start_time 排完序串行推进的最后一个。
  例：CHGU-20260917-0206：total_cost 推出 22:50，但末位节点 plan 00:30 + cost 15 → 00:45，
  **柱子画到 00:45**（暂停区随之从「被裁掉」变成 22:35~00:30 显形的 115 分钟）。
- 判定只此一处：`ganttLayout.js` 的 `resolveSpan()`。基础时长顺序仍是刻意的：
  `beginTime` 解析不出来 → null（不画）；`total_cost > 0` → 用它；否则 `endTime` 差兜底；
  都没有 → `DEFAULT_DURATION_MIN`（30）。⚠️ MANUAL 的兜底分支**别改回去**按 `endTime` 画。
- ⚠️ AUTO 分支里 `resolveSpan()` 会调 `computeNodeTimeline()`，并把结果挂到 `span.timeline`
  给 `buildLayout` 复用（避免每工单算两遍时间线）；顺序是：基础 span → 探时间线拿末位 end →
  需要则扩展 span → 用最终 span 再算一次（rests 的裁剪边界才对）。
- 改完必跑 `og_verify.mjs`（§3.2 时长规则 + §3.7 节点时间线/AUTO 延长），期望 `FAILURES: 0`。

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
   - ⚠️ **调色板里不许有红 / 玫红 / 粉**（2026-10-08 用户要求）：原来的第 2 色是粉
     `#fbd8e3` / `#f090b1`，观感撞上本系统的「红色告警」语义 → 换成蓝 `#d6e6ff` / `#7ba7f5`。
     现在 6 色 = **绿 蓝 黄 橙 青 紫**（色相 146/218/45/28/182/248°）。换色时避开暖红；
     橙（28°）已偏暖，别再往上加红。`og_syntax_check.mjs` 新增**按色相**的防回归断言
     （`<=20°` 或 `>=320°` 即判失败），换色会被它挡住。
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
  （自适应模式下才成立；**默认走固定窗口 §7，恒 12 小时**。）
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
| `og_syntax_check.mjs` | **进程内**跑 SFC 模板 + 脚本语法（不 spawn 子进程）+ 进度条四件套 / 调色板对比度 + **调色板不含红粉（按色相）** |
| `og_shot_tipbar.mjs` | 两个静态预览：配色对调（AUTO 绿 / MANUAL 蓝）+ 进度条宽度比例 + 截 `.og-tip` |
| `og_probe_tipbar_live.mjs` | **真实浏览器 + 真实页面**：登录 → `/tool/orderGantt` → 查看 → 悬浮 AUTO 矩形，核对配色与进度条（100/50/16.67%）+ 截图 |
| `og_probe_link_live.mjs` | **真实浏览器 + 真实页面**：悬浮两条样例矩形，核对气泡工单号是 `<a>`（href = `raw.url`、`target="_blank"`、rel 含 noopener、颜色 #2563eb）+ **真实点击后新开 tab 的地址**（见 §5）。⚠️ hover 后要等气泡稳（visibility/位置）再 Promise.all(click) —— 2026-10-12 踩过「点太急 click 反复重试、popup 30s 假失败」 |
| `og_probe_rest_live.mjs` | **真实浏览器 + 真实页面**：暂停区域专项（见 §6）—— 图例 3 条、4 条 AUTO 各自的暂停块数量 / 位置比例 / 宽度比例 / title / 斜纹、MANUAL 0 块、无横纵滚动、文字压层、悬浮仍正常 |
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

## 5. 气泡工单号超链接（2026-10-12 新增）

**需求**：悬浮气泡 head 里的工单号变成**蓝色超链接**，点击**新开浏览器 tab** 访问工单的 `url`。

- 链接取 `hover.raw.url`：`buildLayout()` 给每条 bar 挂了 `raw`（原始数据），
  mock / 真实接口给的 `url` 直接可用 —— **不要往 `ganttLayout.js` 加字段**（纯函数只管几何）。
- 判空 + 协议过滤在 computed `hoverUrl()`：非字符串 / 空 → 空串；**只放行 `^https?://`**
  （`javascript:` 之类一律不成链）。空串时模板渲染 `<span>` 纯文本，不摆点不动的假链接。
- 模板形态和 AlarmTable.vue 的 alertKey 一致：`<a target="_blank" rel="noopener noreferrer">`，
  颜色 `--og-accent`（#2563eb），默认无下划线、hover 才加。
- **没碰** tipStyle / measureTip / pointer watch：链接在气泡内部，可达性逻辑原样有效。
- 校验：`og_probe_link_live.mjs`（真实浏览器：两条样例的 href / target / rel / 颜色断言 +
  真实点击后 popup 地址断言）。注意 `.og-bar.is-manual` 匹配到 **2 个元素**（0087 + 0047），
  定位要 `nth=0`；popup.url() 会被目标站点规范化（百度补尾斜杠），比对时去掉 `/`$；
  headless 下 popup 事件偶发竞态/外网 chrome-error，脚本已有重试与容错。

## 5.5 气泡 meta 行：三枚胶囊 —— 总耗时 / 节点耗时 / 实际耗时（10-13 起，10-16 加第三枚）

- 结构：meta 行右侧一层 `.og-tip__costs` 容器（`flex-direction:column; align-items:flex-end;
  margin-left:auto`）里竖排三枚胶囊，顺序 **总耗时 → 节点耗时 → 实际耗时**。
  ⚠️ `margin-left:auto` 放在**容器**上，不能给几个 pill 各设一个：多个 auto margin 会平分
  剩余空间、把胶囊在同一行左右分开，竖不起来。
- 三枚共用一套视觉，CSS 写成**一个选择器列表**（`.og-tip__cost, .og-tip__nodecost,
  .og-tip__actualcost`）—— 以后再加胶囊把类名补进这个列表，别各写一份。
- 总耗时 / 节点耗时的拆分原因：AUTO 的总耗时 = `max(beginTime+total_cost, 末位节点结束)`
  （§0/§6 的新规则），会把节点间等待吃进来；**节点耗时 = 原始 `total_cost`**，
  两者在 0206 上分别是 2h45m / 50 分钟。MANUAL 两者相同（竖排显示反而能一眼看出「无等待」）。
- `hoverNodeCostText` 判空：`== null` / `''` / NaN / 负数 → 空串，模板 `v-if` 整项不渲染；
  **0 是合法值**（显示「0 分钟」），判空不许用 falsy。
- **「实际耗时」= 原始 `actualCostTime`**（2026-10-16 用户要求：「显示在节点耗时下面，
  直接取值展示，不用换算，这个字段后端已经把单位啥的换算好了；空串就显示暂无」）：
  - 唯一计算处 = computed `hoverActualCostText`。**原样取值展示**，不调 `formatDuration`、
    不当数字处理（值形如 `"1.5小时"`，已经带单位）。
  - **空串 → 显示「暂无」**；`null` / `undefined` / 纯空白也一并兜底成「暂无」（防后端漏字段）。
    因此这一枚**始终渲染**，模板上**不加 `v-if`**（和节点耗时相反）。
  - ⚠️ 文案是「实际耗时 <值>」（空格，无冒号），和另外两枚一致 —— 用户口述里写的是
    「实际耗时: 暂无」，落地时统一成与总耗时/节点耗时同款，别单独加冒号。
  - mock（`api/tool/orderGantt.js` 内联的 8 条）里已按**用户给的格式**补齐该字段：
    有值 5 条（`"1.5小时"` / `"1.9小时"` / `"2.6小时"` / `"1.6小时"` / `"0.8小时"`）、
    空串 3 条（0086 / 0047 / 0206，用来演示「暂无」）。0086 / 0087 两条的字段是**用户自己加的**。
  - 校验：`og_probe_actualcost_live.mjs`（真实浏览器：三枚顺序 / 右对齐 / 有值原样显示 /
    空串显示「暂无」且仍渲染 / 气泡仍在视口内 / 不滚动，**FAILURES 0**）。
- ⚠️ meta 竖排后气泡会高一截（每加一枚 ~24px）：tipStyle 用 measureTip 的实测高度定位，自动跟随，
  og_verify_tip 的可达性断言已覆盖。
- 校验：og_probe_rest_live 第 6 节（0206 = 165/50、0086 = 30/30、0087 MANUAL = 135/135，
  外加「节点耗时 pill 在总耗时下方且右对齐」的几何断言）。
- ⚠️ **气泡会挡住相邻行的柱子 —— 写 hover 类校验脚本时每次都要先移开**（2026-10-16 踩过）：
  `og_probe_rest_live.mjs` 的 `hoverMeta` 直接 `mouse.move` 到目标柱子中心，
  上一个气泡（420px 宽）正好压住 0206 的中心点时，鼠标落在**气泡**上、触发不了 `onBarEnter`，
  读到的还是上一个工单（假红 3 条）。修法：hover 前先 `moveAway()` 等气泡关掉。
  （这是「气泡必须能承接鼠标」设计的固有代价，不是 bug。）

## 6. AUTO 工单柱子的暂停区域（2026-10-12 新增）

**需求**：AUTO 工单带 `node_detail`（只有 AUTO 有），在柱子上把「工单总时长里没被任何节点
占用的片段」用灰白斜纹画成暂停区域；图例加第三条「暂停区域」。

- **唯一计算处 = 纯函数 `computeNodeTimeline(item, span)`**（ganttLayout.js）。
  `buildLayout` 把结果挂到 `bar.timeline`（没有 node_detail 的工单是 null，组件据此一块都不画）。
  - `plan_start_time` 的语义（用户特别强调）：**「该时间之后节点才可以开始执行」**，
    不是开始时间；**null 或解析失败 → 取外层 `beginTime`**（外层 beginTime 就是这一级的 plan）。
  - **先按 `plan_start_time`（可开工时间）升序排，再串行执行**（2026-10-12 用户明确要求）：
    ⚠️ 中间曾改成「按 node_detail 数组顺序执行」——用户加的工单 CHGU-20260917-0206
    直接证伪：它第一个节点的 plan 是**次日 00:30**（在整个工单跨度外），按数组序排第一
    执行，四个节点被全推到跨度外、**整根柱子都变成暂停区**。排序后 22:00 可开工的三个
    节点先做（35 分钟），00:30 的排最后（被 total_cost 裁掉），只剩尾部 15 分钟暂停。
    同值（含多个 null 都解析成外层 beginTime）时保持**数组原顺序**（显式 index tiebreak，
    不依赖引擎 sort 稳定性）。
  - 节点真正开始时间 = `max(前一节点真正结束时间, 本节点 plan_start_time)`；
    plan 早于前一节点结束 → 排队等前一做完。游标从外层 beginTime 起。
  - `cost` 无效（缺失 / <=0 / NaN）→ 该节点不产生执行段；整段 `node_detail` 空 / 全无效 /
    非数组 → 返回 **null**（整根柱子一块暂停区都不画，MANUAL 零影响）。
  - rests = 工单**总跨度**（按 §0 的 AUTO 规则：`max(total_cost 推出, 末位节点结束)`）
    减去所有执行段 ⇒「节点之间的计划等待」和「尾部余量」都算暂停（用户样例 0086 是尾部 5 分钟）。
    ⚠️ 跨度本身会被末位节点延长（0206：50 → 165 分钟），原「被裁掉」的等待随之显形
    （0206 的暂停 = 22:35~00:30 共 115 分钟，不是 15 分钟）。执行段超出旧 spanEnd 不再被剪。
    执行段互相重叠（数据自相矛盾时）也不会出负区间。
- **渲染**（OrderGantt.vue）：模板里 `.og-bar__rest`（绝对定位），几何走组件方法
  `restBlocks` / `restBlockStyle`：**百分比宽**，分母 = bar 自己的真实跨度（end-start）。
  **不参与布局** ⇒ 柱高、气泡高度、行高零变化。title = 「暂停时间 N 分钟」。
  ⚠️ **术语（2026-10-13 用户要求）**：界面上「休息」一律改称**「暂停」**（图例「暂停区域」、
  title「暂停时间 N 分钟」）；**代码标识符不动**（`rest` / `rests` / `restBlocks` /
  `restBlockStyle` / `.og-bar__rest` / `computeNodeTimeline` 的 rests 字段、脚本
  `og_probe_rest_live.mjs` 等）—— 换说法不换变量名，别为文案 rename 满仓库代码。
  文字 span 抬 `position: relative; z-index: 1` 压住斜纹。
- **配色 = 中性灰白斜纹**（rgba(100,116,139,.32) + 白斜纹）：刻意避开绿/蓝两组分组色，
  也不碰红色（告警语义）。图例点 `.og__legend-dot.is-rest` 同款斜纹。
- ⚠️ **柱体文字条数会变少**：样例扩到 8 条后时间跨度 27 小时、矩形普遍变窄，
  **只有 0111（155 分钟）和 0206（延长后 165 分钟）显示得出完整工单号**，其余按
  「完整或没有」规则不显示文字 —— 不是 bug（og_check_labels 会打印实际条数）。
- **两份 mock 别混**：页面实际数据是 `api/tool/orderGantt.js` 内联的 **8 条**
  （3 条原始 + 0110/0111/0205 + 用户加的 0206、0210；0210 是「单节点恰好填满 → 0 暂停」的
  边界样例）。`mockData/res.js` 的 orderRes（造数器 seeds）**没动** —— og_verify §4 的
  「样例条数 = 3」断言读的是它，别顺手同步。
- **重叠分行**：柱子结束时间变长后（0206 与 0210 重叠），`packRows` 按新 span 自动分行
  （AUTO 组实测 3 行）—— og_probe_rest_live 第 5 节断言「同组同行柱子两两不重叠」。
- 校验：og_verify §3.7 纯函数断言（含用户样例 0086 的 5 分钟尾部暂停、排队、乱序不重排、
  null plan 边界、clamp、buildLayout 挂载）；og_probe_rest_live.mjs 真实浏览器全量几何断言。

## 7. 横坐标固定为「当天 18:00 → 次日 06:00」（2026-10-16 用户要求）

**需求原话**：甘特图的横坐标改为当天 18:00 - 第二天的 06:00 固定住；数据本来就在这个范围内，
不是的话可以改 mock；**注意时间不要写死，因为甘特图的横坐标是当天，到了第二天第二天就是当天了**。

- **「当天」的来源 = 页面弹窗的日期选择器**（`index.vue` 的 `date`，默认当天）→ 传给组件的
  prop `windowDate`。所以窗口是**动态**的，今天打开是今天 18:00、明天是明天 18:00。
  写死的只有 **18 / 06 这两个时刻**（`ganttLayout.js` 的 `WINDOW_START_HOUR = 18` /
  `WINDOW_END_HOUR = 30`，30 点直接加在当天 00:00 上，省掉跨天判断）。
  判定只此一处 = 纯函数 `buildDayWindow(date)`，**页面/组件不许再算一遍**。
- `measureTimeAxis(items, maxTicks, timeWindow)` 第三参 + `buildLayout` 的 `options.window`：
  **传了就用窗口**（`spans` 非空时），不传就退回自适应 —— 组件仍可脱离页面单独使用，
  `og_preview*.mjs` / `og_diag.mjs` 那些老脚本（2 参调用）行为不变。
- 窗口 = 12 小时 → `pickStepMinutes(720, 12)` 选到 **60 分钟**步长，13 个刻度
  （18:00…23:00 / 00:00…06:00），日期带 2 段（当天 + 次日），`00:00` 那根是 `is-day`。
- ⚠️ **原代码潜伏的裁剪 bug，固定窗口后才可达**（务必别改回去）：`buildLayout` 的
  `if (left < 0) { width += left }` **没有下限** —— 窗口外的工单算出**负宽度**
  （CSS 当无效声明忽略 → 柱子按内容撑开），且 `left > plotWidth` 时会把
  `overflow-x: auto` 的容器**撑出一根横向滚动条**。现在：
  `width = Math.max(0, width + left)` + `left > plotWidth` 时 `left=plotWidth, width=0`。
  宽度 0 = 整条不画，由组件 computed `visibleBars`（`filter(b => b.width > 0)`）过滤 ——
  **工单仍计入 `stats.total`**，只是不渲染。模板的 `v-for` 已从 `bars` 换成 `visibleBars`。
- **mock 数据的日期也跟着动态化**（`api/tool/orderGantt.js`）：样例里的时间写成**占位日期**
  `2026-09-17`（= 窗口当天）/ `2026-09-18`（= 次日），返回前走 `shiftMockDates(data, params.date)`
  替换成真实日期。⚠️ 替换必须用**单次正则回调**，不能两轮 `split/join` ——
  用户选的日期恰好等于某个占位值时，第一轮刚换出来的会被第二轮再换一次（已写成断言）。
- **三条样例被挪进窗口**（原来在窗口外）：0110 由 09:00 改 **19:00**、0111 由 13:00 改 **21:30**
  （endTime 顺延到次日 00:05）、0205 由 10:00 改 **02:00**；node_detail 的 `plan_start_time`
  与注释里的时间一起改（三条各自演示的语义不变：中间暂停 / 长暂停 50 分钟 / 排队）。
- 副作用（正面）：柱子变宽，**柱体文字从 2/8 条涨到 6/8 条**（原来只有 0111 和 0206 放得下）。
-   校验：`og_window_check.mjs`（纯函数边界含跨月/跨年/闰年 + mock 端到端 + 源码接线，
  **FAILURES 0**）；`og_probe_window_live.mjs`（真实浏览器：13 个刻度序列、日期带是今天/次日、
  柱子像素位置反算回时间与「开始时间 + 耗时」一致、无横纵滚动，**FAILURES 0**）。
  改了横坐标相关的东西，这两个脚本要一起跑。

## 8. 一键计算额外需要变更支持人员人数（2026-10-21 新增）

**需求**：甘特图页头加按钮「一键计算额外需要变更支持人员人数」，点击后按五段统计
算 `par = { peopleNum, detail[] }` 打到控制台，供后端后续对接。

- **纯函数模块 = `views/tool/orderGantt/workloadCalc.js`**（`calcExtraStaff(orders, date)`）：
  窗口/时间线判定全部复用 ganttLayout（`buildDayWindow` / `resolveSpan`），**不另写一套**。
  date 解析失败 → 返回 null（组件提示，不出假数据）。
- **五段划分**（`WORKLOAD_SEGMENTS`）：18-20 / 20-22 / 22-24 / 0-2 / **2-6（4 小时）**，
  从窗口起点累计、末段夹到 `win.end`。窗口本身还是 §7 的「当天 18:00 → 次日 06:00」。
- **每段统计**：手动单数 x / 手动耗时 y、自动单数 z / 自动耗时 a（单位 H）。
  - 耗时 = **该时间段内的节点耗时**；AUTO 走 `span.timeline.segments`（computeNodeTimeline
    串行排好的执行段，**节点间暂停不计**）；MANUAL 没有 node_detail →
    按工单区间 `[beginTime, beginTime+total_cost)`（resolveSpan 判定，和柱宽同源）。
  - 一个工单跨多段 → 每段各算各的重合分钟数（`overlapMinutes` 求交，不切时间片）。
  - 某段内零占用的工单不计单也不计耗时。
- **数值**：`b = max(x,y)/4`、`c = max(z,a)/10`、段总分 = b+c；`MANUAL_DIVISOR=4` /
  `AUTO_DIVISOR=10` 是导出常量。**显示值 round2，后续比较也用 round2 后的值**
  （保持「打出来的人数」和「打印的分数」自洽）。
- **两条逻辑**：d = 五段总分最大 ⇒ **逻辑一 `e = d > 2 ? Math.ceil(d - 2) : 0`**
  （⚠️ 向上取整是**当前解读**：用户原话「d大于2则需要增加人手，每超过1则增加一人」，
  取 ceil 才能保证 d=2.05 也出 1 人；若用户要 floor，只改 `Math.ceil` 一处，
  `og_workload_check.mjs` 的 B5 有对应断言会红）。逻辑二：最长连续 N 段总分 > 1 ⇒
  `f = N - 1`（N<2 为 0）。**g = max(e, f)** = `peopleNum`。
- **按钮与接线**：`OrderGantt.vue` 的 `.og__head` 里、图例右侧（`.og__calc` 描边小按钮，
  icon flex 居中）→ `handleCalcStaff()`：`calcExtraStaff(this.orders, this.windowDate)` →
  `console.log(par)` + 打开结果弹窗。数据源 = 当前弹窗工单 + 当前日期（和图同源，
  换日期/搜索后点的就是图上这批数据）。
- **按钮文案**（2026-10-22 改名）：「**获取额外变更支持人数**」（原「一键计算额外需要变更支持人员人数」）。
- **结果弹窗 = `components/WorkloadResultDialog.vue`**（2026-10-22 用户需求）：
  - 哑组件（同 AtomConfirmDialog 规矩）：**不自己调接口**，`@push` / `@close` 抛给父组件；
    接口调用、`staffPushing` 态、关闭时机全在 OrderGantt.vue 一处决定。
  - 内容：结论行「额外需要变更支持人数: x人」+ 五段明细表（时间段 / 手动单数 /
    手动耗时(H) / 自动单数 / 自动耗时(H) / 段总分）+ footer「关闭」「推送到企微」。
  - ⚠️ **`:visible` 不要加 `.sync`**：弹窗内部「推送中不许关」靠 onClose 早退实现，
    走 sync 的话 × 号会绕过拦截直接放掉对话框。
  - ⚠️ **`--wrd-*` 变量声明在非 scoped 的 `.wrd-dialog` 上**：那是 body 内容与
    footer slot 的**共同祖先**；声明在 `.wrd`（body 内）的话 footer 按钮拿不到
    （scoped 下 slot 内容不是 `.wrd` 的后代）—— 和 append-to-body 变量继承是同一类坑。
  - 弹窗本身也 `:close-on-click-modal="false"` + `:close-on-press-escape="false"`（防误触）。
- **推送到企微**：`api/tool/orderGantt.js` 的 `pushExtraStaff(payload)`，**POST**，
  请求体 = 打印的 par **+ `date`**（左上角日期选择器的值，'YYYY-MM-DD'，
  2026-10-22 用户要求「把左上角的日期也传过去」；即 `{ ...par, date: windowDate }`）；
  真实路径是占位（`/python/api/cicd/pushStaffToWecom`），
  **USE_MOCK 下 mock 成功**（console.log 参数 + 300ms 延迟）。接真实接口只改这一处。
  成功 → `$message.success('推送成功')` + 关弹窗；失败 → 提示、弹窗留着。
  ⚠️ 不判 `res.code`（拦截器已拦业务错误；python 侧成功码可能是 0，判 === 200 会误杀）。
- ⚠️ **`computeNodeTimeline` 排序坑**（本次连踩两次）：null 的 `plan_start_time`
  取外层 beginTime **参与排序**，所以 0110/0111/0205 的真实执行序是
  n1 → n3(null) → n2(晚 plan)，不是数组序；手推期望值必错，以脚本输出为准。
- 校验：`og_workload_check.mjs`（接线 + 纯函数全规则 + mock 8 条端到端，FAILURES 0）；
  `og_probe_workload_live.mjs`（真实浏览器：按钮位置/文案、点击后控制台 par 与
  node 侧期望值 JSON 完全一致、结果弹窗结论行/表头/5 行、推送到企微成功并自动关窗、
  关闭按钮、连点幂等 + 截图 `og_workload_head.png` / `og_workload_result.png`，FAILURES 0）。
  联动回归：og_syntax_check / og_window_check 均 FAILURES 0。
