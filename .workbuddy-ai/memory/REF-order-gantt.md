# REF — 工单甘特图（orderGantt）

> 2026-09-21 新增，2026-09-22 更新。**改这个页面前必读。**
> 三层结构：`views/tool/orderGantt/index.vue`（单按钮「查看」+ el-dialog）
> → `components/OrderGantt.vue`（props `orders`，只负责把算好的数字贴到 style）
> → **纯函数 `ganttLayout.js`**（时间域/刻度/行分配/像素几何，全部可在 node 里断言）。

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

## 1. 其余四条硬规则（改动时最容易破）

1. **行装箱从下往上**（`packRows(items, {fromBottom:true})`，两遍：先求最优行数再定向）。
   方向反了用户一眼就看出「这条明明能往下挪」。判据是 `rowEnd <= item.start`（端点相接算不重叠）。
2. **弹窗定高 + 按可用高度反推行高**（`fitRowPlan(rowPlan, availableHeight)`），目标**不出现滚动条、一眼看全**。
   - ⚠️ `containerHeight` 必须量**组件根节点 `.og`**，**绝不能量 `.og__plotwrap`** —— 后者高度正是被行高决定的，会形成循环依赖。
   - ⚠️ 三段固定高（页头/日期带/时间轴）**用 `outerHeight` 实测**（`offsetHeight` **漏外边距**，页头少算 12px 就会把时间轴切掉 9px）。行高**不能取整**（取整留 `行数×1px` 空白）。
   - ⚠️ 弹窗选择器写 `.el-dialog.ogp-dialog`（0,2,0），单独 `.ogp-dialog` 压不过 element-ui 的 `margin`（同特异性只看打包顺序）。
3. **配色：AUTO = 蓝，手动 / 其他 = 绿**（`--og-auto-*` / `--og-manual-*`，图例/气泡/柱体全走变量）。
   `og_scss.mjs` 按**色相 + 明度**钉住了，别把两组调换回去。
   - ⚠️ **柱体上不能放白字**（2026-09-22）：底色是浅→中的渐变，白字对比度只有 1.4~1.9，用户反馈过两次。
     文字色走 `--og-manual-ink: #065f46` / `--og-auto-ink: #1e3a8a`（`.og-bar.is-manual/.is-auto` 映射到 `--og-bar-text`），
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

## 2. 边缘与几何

- **任何「有宽度的东西」都不能画在 `x === plotWidth` 上**：`alignDomain` 保证最后一个刻度恰好落在 plotWidth，
  1px 宽的网格线右边缘顶到 plotWidth+1 → `overflow-x: auto` 就冒出一根横向滚动条。
  网格线/刻度短线走 `gridTicks`（过滤过），**标签仍用完整 `ticks`**。
- 时间域跨度大时**不横向撑开**（`plotWidth = max(360, 容器宽)`）；真到 3 天时矩形被压窄但保证 ≥8px 仍可悬浮。
- 其余：AUTO 分组置底、尾部外溢要偏置、`packRows` 副本坑、对齐后要重校验格数 → 见 `2026-09-21.md`。

## 3. 校验（脚本都在 `C:/Users/lenovo/AppData/Local/Temp/`）

| 脚本 | 管什么 |
| --- | --- |
| `og_verify.mjs` | 全量，**须 `FAILURES: 0`**。§3.2 = 时长规则，§4.1 = 禁 vue-json-viewer，§5.5 = 气泡可达性源码断言 |
| `og_scss.mjs` | SCSS 编译 + 配色色相 + **柱体文字对比度 / 白字回归防线** |
| `og_rows.mjs` | 行装箱方向（「可往下挪」必须 0 条） |
| `og_diag.mjs` | 数值体检（行高/矩形宽/间隙/日期段） |
| `og_preview.mjs` | 静态预览 HTML（demo 数据） |
| `og_preview_seed.mjs` | 静态预览 HTML（**用户给的 3 条真实样例** + 结束时间核对表），本次新增 |
| `og_verify_browser.mjs` | 真实浏览器：`scrollWidth === clientWidth` 才算「不滚动」 |
| `og_verify_tip.mjs` | 气泡可达性（真实浏览器，含「分步移动鼠标走过去」「停在缝里 700ms」） |
| `og_shot_ink.mjs` | 开预览 HTML 截柱体文字，`deviceScaleFactor:2` |

⚠️ `og_verify.mjs` §4 造数断言**必须给 `buildOrderList` 注入 `now`**：默认取 `Date.now()`，而窗口断言用固定日期，
不注入就隔天必报「主窗口 0 条」+「同种子不一致」两条假失败（2026-09-22 踩过）。

⚠️ `og_shot_ink.mjs` 截图前先把预览页 `.og__plotwrap` 撑开 —— 它只有 ~192px 高，蓝条会被裁在视口外。
