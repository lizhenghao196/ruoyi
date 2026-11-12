# MEMORY.md — RuoYi-Vue 工作台长期备忘

> 只留「不知道就会做错」的。**动手前读对应 REF**：`REF-alarm-analysis.md`、`REF-exec-page.md`、`REF-exec-detail.md`、`REF-exec-simple.md`、`REF-order-gantt.md`、`REF-systemProfile.md`。历史细节见 `2026-09-*.md` / `2026-10-*.md`。

## 项目约定
- 新页面 = `views/tool/<n>/index.vue` + `api/tool/<n>.js` + `sql/<n>_menu.sql`；菜单走数据库动态路由，**不写** `router/index.js`。Mock 在 `mockData/res.js`。
- **mock/真实开关** = `_mockFlag.js` 的 `USE_MOCK`：函数体 = 真实接口 + `if(USE_MOCK) return mockApi('x',参数)`，mock 实现在 `_mockApi.js`。接真实 = 改 false 后删 `_mockApi.js`/`_demo*.js`/`mockData/res.js` + 各函数那三行。**改 `execPlan.js` 必跑 `test_mock_switch.mjs`**。
- **`code: 0` 能过拦截器是巧合**（`utils/request.js` 是 `res.data.code || 200`）；python `func/*` 成功码就是 0，**别判 `code === 200`**。
- **取载荷一律走 `pickPayload(res)`**：载荷可能在 `data` 也可能在 `rows`，`data` 非 undefined/null 就用它（**`[]`/`''`/`0`/`false` 都算有值，别用 `||` 判**）；页面里**不许出现裸 `res.data`/`res.rows`**。

## 启动 / 运行（2026-11-02 复核有效）
- 顺序：Redis → 后端 → 前端。MySQL 3306 常驻。
- Redis：`C:/Users/lenovo/.codex/tools/ruoyi-vue/redis-5.0.14.1` 下 `./redis-server.exe redis.windows.conf`（6379）。
- 后端：`unset SERVER__PORT` + `C:/Users/lenovo/.codex/tools/ruoyi-vue/jdk17/jdk-17.0.19+10/bin/java.exe -jar ruoyi-admin/target/ruoyi-admin.jar --server.port=8080`（约 18s 起完）。
- 前端：`ruoyi-ui` 下 `npm run dev`，端口 80，proxy → 8080，日志写 `ruoyi-ui/npm-dev.log`（根目录 `frontend.log` 是旧的，别认错）。
- ⚠️ **后台启动绝不能加 `&`**：包装 shell 立即退出会连带回收 redis/java/npm。症状极具误导——日志停在 druid profile、`tasklist` 里没 java（看着像「启动慢」）。`> log 2>&1` 可以，`&` 不行，用后台任务机制常驻。
- ⚠️ **必须显式 `--server.port=8080`**：WorkBuddy shell 注入 `SERVER__PORT=60044`（双下划线）被 Spring 宽松绑定成 `server.port`，会抢 60044 启动失败。
- ⚠️ **bash 里 `java` 不在 PATH**：必须绝对路径（见上）。

## Element 弹窗两个通用坑
- ⚠️ **`append-to-body` 的弹窗里，页面根节点声明的 CSS 变量继承不到**（DOM 挪到 body 下）：要用 `--xxx` 就在弹窗内容自己的包裹层上再声明一份，否则 `var()` 静默失效。
- ⚠️ **`el-dialog` 里的 `el-date-picker` 等带下拉面板的组件，Esc 会关掉整个弹窗**（面板只在焦点在 input 时 `stopPropagation`）⇒ 弹窗加 `:close-on-press-escape="false"`（配 `:close-on-click-modal="false"`）。

## CSS 两个通用坑
- ⚠️ **全局元素选择器会漏进 scoped 组件**：`assets/styles/index.scss:99` 的 `aside { padding:8px 24px; margin-bottom:20px; line-height:32px; font-size:16px }` 命中组件里的 `<aside>`；特异性只对「双方都声明过的属性」生效，没声明的照样吃全局值（`margin-bottom:20px` 会扣掉 20px 高度）。scoped 里把这四个属性一起显式重置。
- ⚠️ **表格底线靠 `.el-table::before`**（`--border` 变体自身 `border-bottom:none`），**绝不能 `display:none`**，否则底部敞口。

## 告警分析（alarmAnalysis）
- **页面不认 P1/P2/P3，只认「形态」**：唯一判定 `alarmAnalysis/shape.js`（纯函数）。`metrics` 型 key 合成一条指标条；顺序唯一来源 `METRIC_ORDER`，页面不许再抄一份。
- ⚠️ **接口/mock 数据不要擅自改**：用户要「页面不这么分」就只改展示层（合并 mock 的 P1+P2 被打回过）；**用户点名要改的**才改。
- 表格列 `alertKey / summary / misinfoReason / alertReasonDesc / AgentTrace / output / more`；⚠️ `misinfoReason` 的 i 是小写；`alertSource`/`closedBy` 不展示。**按钮文字 2026-10-15 对调过**：output=「查看简报」（开弹窗）、more=「告警详情」（跳外链）——只换文字，弹窗标题仍叫「告警详情」（刻意不一致，别改）。
- 两个外链（新 tab，常量在 `AlarmTable.vue` 顶部）：`alertKey` → `http://alt.eprod-kzx1.cncb/#/jiraAlertInfo?alertKey=<值>`；more → `http://10.2.64.23/gdb_screen/#/agentInfo?activeRunId=<runId>`。判空别用 `||`（`runId: 0` 会被当空）。「更多字段」弹窗因此没了入口。
- 组别下拉走字典 `dict_system_group`，`form.teamName` 默认**「全量」**且**始终进请求参数**；日期默认**当天-当天**。
- ⚠️ **同一层级一律按条数降序**（`shape.js / sortByCountDesc` 排 `section.lists` 与 `section.levels`，**二级「告警源」chip 没排**）；只在展示层排，副作用是多 tab 区块默认选中条数最多的。
- ⚠️ **表格高度分两种**：`AlarmTable.vue` 的 `fixedHeight` —— AI处置 传 `fixed-height`（固定 420）；P3/人工关单/自动化关单 不传（`max-height=420`）。高度值**必须写成模板字面量**，模块级常量模板取不到。
- ⚠️ **概览区「告警总量」2026-10-16 已删**（指标条里的同名统计值保留）。概览区只剩「重复性分析」，整块 `v-if` 以 `duplicateGroupCount > 0` 为前提；`totalCount`/`sectionRowCount` 一并移除。
- 细节（`levelTone`、`flattenLevel`、窄屏降级、校验脚本、字典 SQL）→ `REF-alarm-analysis.md`。

## 执行页面 / 明细弹窗 / 执行界面简版
- 简版环境 chip **0 流不展示**：`visibleEnvList`（`!e.responded || e.flowCount > 0`）——⚠️ **判据是 `responded` 不是 `loaded`**（请求失败时 loaded 也 false，会把「取不到详情」显示成 0 流）。`ensureSelection` 同用；只做展示层过滤。节点卡片右下角 = 计划开始时分的时分秒（`planStartClock`）。
- ⚠️ **mock 不全**：`planRes` 31 个计划、`executeResMap` 只有 11 个 key ⇒ BPC/DPS/PAY/DSI/LMP/DNET/CIS 取不到详情（`未找到执行详情：<id>`），页面像「一堆 0 流环境」。
- 简版画布自动滚动：**只认输入事件（wheel/touchmove/滚动键/mousedown）**，**刻意不监听 `scroll`**（轮询的程序化滚动会被误判成用户滚动，自动滚动永久冻住）。目标节点 `bad > run`；用户滚动后 20s 让位；新弹窗要加进 `anyDialogOpen`。
- 简版右栏「文档信息」**默认不展示**；查看明细表里**双击工单**才展出（工单号 + 多文档 tab + iframe，6:4）。地址 = `DOC_VIEW_BASE + file_name`，**不是**接口的 `url`；⚠️ `el-table-column` 的 `class-name` 会同时落到表头 `th`。
- ⚠️ **文档 iframe 跨源**（`10.2.64.36:8121`）⇒ 横向滚动只能把 iframe 撑宽让父容器出横条：`.esp-doc__frame { overflow: auto }`（**不能改回 hidden**）+ `iframe { min-width: 1440px }`；纵向仍在 iframe 内部。
- 动手前必读：`REF-exec-page.md` / `REF-exec-detail.md` / `REF-exec-simple.md`（轮询静默、横滚在流内部、页头进度算法、哑组件契约、`type="expand"` 不能加 `fixed`；execPlanList / execPageSimple 与 execPage **代码零共享**）。

## 工单甘特图（orderGantt）
- ⚠️ **横坐标固定「当天 18:00 → 次日 06:00」**：唯一判定 `ganttLayout.js` 的 `buildDayWindow(date)`（`WINDOW_START_HOUR=18`/`END=30`），「当天」= 弹窗 `date`（动态，别写死）；`measureTimeAxis` 第三参 / `buildLayout` 的 `options.window`，不传退回自适应。窗口外工单 width 裁成 0（`visibleBars` 过滤，仍计入 `stats.total`）。mock 日期走 `shiftMockDates` **单次正则回调**替换。改横坐标必跑 `og_window_check.mjs` + `og_probe_window_live.mjs`。
- 气泡右侧三枚胶囊 = 总耗时 → 节点耗时 → **实际耗时**。实际耗时取 `hover.raw.actualCostTime`，**原样展示**（后端已带单位），空/null → 「暂无」⇒ **始终渲染不加 `v-if`**；唯一计算处 `hoverActualCostText`。⚠️ hover 校验脚本每次 hover 前先 `moveAway()`（420px 气泡会盖住相邻行）。
- ⚠️ **柱体文字「统一显示 + 省略号截断」**（2026-10-23，09-23 的「完整或没有」作废）：唯一实现 `truncateLabel(text, measure, barWidth)`（二分找最长前缀+…，保留头部，至少 1 字符）；`canFitLabel` 只剩「完整放得下」快路径语义；CSS ellipsis 是兜底。
- ⚠️ **矩形宽度按 mode 拆**：**MANUAL** 结束 = `beginTime + total_cost` 分钟，**`endTime` 不参与绘图**；**AUTO** = `max(beginTime+total_cost, node_detail 末位节点真正结束)`。判定只此一处 `resolveSpan()`。
- 配色：**AUTO 绿 / MANUAL 蓝**（2026-09-24 对调，变量名不变只换值；气泡 `.og-tip__mode` 徽标硬编码要手动跟）。分组标签条量词是「**单**」。
- **AUTO 暂停区域**：`node_detail` **按 plan_start_time 升序串行执行**（按数组序被 0206 证伪，别改回去）；`plan_start_time` = 最早可开工，null→外层 beginTime；纯函数 `computeNodeTimeline` 挂 `bar.timeline`。
- `BAR_PALETTE` **不许有红/玫红/粉**（撞告警红）；现 6 色 = 绿蓝黄橙青紫，`og_syntax_check.mjs` 有按色相断言。
- **人数两条逻辑（2026-11-02 改版）**：逻辑一 = 五段总分最大值**先四舍五入**成 D，`D>2` 才 `D-2` 人（2.1→0 人、2.5→1 人，**不是 ceil**）；逻辑二 = **只看后四段**（跳过 18:00-20:00），连续 N 段 > 1 → N-1 人。改动要同时改 `calcExtraStaff` 和 `explainStaffResult` 两处，**外加 `py/order_workload.py` 的 `calc_extra_staff`**（py 四舍五入必须用 `js_round`，内置 `round` 是银行家舍入会差 1 人）。
- **人数说明（2026-11-02）**：`explainStaffResult(result)` 只解读 par、**不重算也不往 par 塞字段**（par 原样 POST 给后端）；0 人 → null 不渲染。**展示分工**：可见区只写 winner 那条逻辑（逻辑二用 `runBrief` 不带时间段，否则「N 人」被挤到下一行），完整两条逻辑 + 取大 + 口径演算挂在 i 图标的 `el-tooltip`（`popper-class="wrd-why-pop"`）。⚠️ popper 挂 body：样式只能写**非 scoped**、`--wrd-*` 要在 popper 上重声明、判可见别用 `offsetParent`。文案由 `buildExplainLines` 拼成 `{t,b,nw}` 段（node 里 join 就能断言）。⚠️ mock 现有 **11 条**，0211/0212/0213（MANUAL、18:30+6h、三条并发）现在算出 **2 人**（后四段连续 3 段；首段 1.83 已被逻辑二排除），改这三条会让 `og_workload_check.mjs` C 节全红（故意的）。hover 类脚本必须 `mouse.move` 不传 `steps`。
- 详见 `REF-order-gantt.md`（硬规则 9 条、气泡可达性、chip、进度条、弹窗日期过滤条、§8 人数计算、§9 人数说明）。

## 系统画像（systemProfile）
- ⚠️ **右侧链路图 = 选中组件的 key + 它下游整条链**（向下传递闭包，2026-10-29）：`filterLinksByClusters` **只认 fnode（起点）、全等**，从根一路展开下游（MYSQL→CANAL→KAFKA→ES→GW）；**不看终点**（指向集合内的上游边不画）；环靠 visited。**根只认 `expandedClusters`**；`集群关系[组件].nodes` **绝不能并进根集合**（不随折叠变，并进去「收起集群→右侧跟着变」彻底失效，内网实测打回过），只在「全展开却零命中」兜底。闭包后还要**剔掉「已收起集群」作为起点的边**。集群名 = 组件拓扑第二层 key = **链路节点名本身**。`allLinks`（全量，只给顶部概览「链路」总数）+ `links`（展开结果）；顶部概览不跟组件变。
- ⚠️ **主机列表折叠态与右侧链路图共用 `openClusters`**：链路根集合 = `linkRootNames`（当前组件有集群时**只等于 `expandedClusters`**，一个集群都没有才退回 `relationNodeNames`），收起即消失；**默认只展开第一个集群**（2026-11-04 起，唯一入口 `defaultOpenClusters()`，`doSearch` 和 `selectComponent` 都走它，别再写回 `activeClusters.slice()`）；写一律走 `setOpenClusters()`（集合没变不重算）；`toggleAllClusters` 是切换语义，按钮在搜索框左边。空态三种文案。
- ⚠️ **小图节点名空间够就常显**：`inlineLabelsFit`（节点正下方矩形两两不压、不压节点），判定与渲染共用 `TOPO_NODE_LABEL_DISTANCE`/`_LINE_H`；常显时藏掉「悬浮查看节点」。
- ⚠️ **echarts 4.9 `lines` 系列不渲染 label** ⇒ desc 只能用 **scatter** 挂锚点，且 **`symbol:'none'` 元素根本不创建**（用 `circle`+透明色）。**label 字号与元素 scale 无关**，改 `label.fontSize` 别动 `symbolSize`。文字横着画、锚在曲线中点（另两版被否）。「空间合适」= 节点≤14 且线段≤12 且每条带 desc 线段 ≥60px；desc 按线段实际宽度逐字估宽截断（上限 200px），一条不满足就**全部**退回悬浮卡片。
- ⚠️ **几百个集群时的卡顿主因不是 echarts**（2026-11-04 实测 310 集群/1550 主机/170 链路）：CPU 采样里 Vue `getTransitionInfo` 14.7% + `collapse-transition.enter` 14% + el-table `resizeListener` 10.9%，**echarts 合计只有 3.4%**。根因是 `el-collapse` 用 `v-show`（310 个 el-table 首屏就全建好，7 万 DOM 节点），切组件/展开时全量重建。**CSS 禁用 transition 无效**（Element 用内联 style + rAF 驱动）。
- ⚠️ **主机列表表格是三层懒加载，别退回 v-show**：① 只有 `openClusters` 里的才建表（`isClusterOpen`）；② 展开但屏外的先渲染占位块（`isClusterMounted` + `IntersectionObserver`，root = `.profile-hosts__panel`，rootMargin 400px），滚到附近才建；③ `.el-collapse-item__wrap` 加 `content-visibility: auto` + `contain-intrinsic-size: auto 300px`（**占位高度必须和 `placeholderStyle` 的 41+37×行数 口径一致，否则滚动条跳**）。实测：切 310 集群 **118ms**、一键展开 310 个 **1011ms**（只建 3 个表格）、滚动 4500px fps 44.8。`setOpenClusters` 里必须把收起集群的挂载标记一起撤掉，否则再展开会瞬间重建全部表格。
- ⚠️ **观察器必须校验 root 身份**（2026-11-05）：`ensureClusterObserver` 判 `_clusterObserverRoot === this.$refs.hostsPanel` 才复用，否则 disconnect 重建。`doSearch` 里 `loading=true` 会把内容区 `v-if` 换成加载态、`hostsPanel` 整个重建，旧 root 脱离文档 ⇒ 交叉计算恒 0 ⇒ 占位块永久停在「滚动到此加载」。**症状误导**：首个集群正常（不走观察器）、空态输入框查询正常（那时 panel 未挂载、observer 没缓存），只有「弹窗切系统 + 收起再展开/展开其他」才坏。回调 unobserve 用局部 `observer` 变量。
- ⚠️ **组件配套操作三按钮（2026-11-09）**：只有 `CONFIG_ACTION_COMPONENTS`（NGINX/HAPROXY/微服务/JAVA微服务）的**折叠头中间**有「下载配置/读取文件/读取链路」。折叠头是三列 grid（`__head`：`minmax(0,1fr) auto minmax(0,1fr)`），中间列 auto ⇒ 按钮恒居中，记录数在第三列右对齐、紧贴 Element 箭头。**按钮容器和按钮都必须 `@click.stop`**（否则点按钮会连带折叠）。loading 用 `cfgLoading` 对象、key=`集群名|动作`，必须 `$set`/`$delete`。
- ⚠️ **配置中心三个接口成功码是字符串 `'0000'`**：`utils/request.js` 加了 `SUCCESS_CODES = [200,'200','0000']`，判断改成 `indexOf(code) < 0`；**别再写回 `code !== 200`**。api 在 `api/tool/systemProfile.js`，顶部 `USE_MOCK` 默认 true（接真实后端改 false）。
- 细节（`refreshTopo`/`applyComponentLinks`/`disposeTopoChart`、`topoLabelOf` 不许削两段式名字、**悬浮卡片单击固定+复制**、像素断言要 A/B 不要 hex）→ `REF-systemProfile.md`。

## 校验 / 协作
- node 校验：`cd C:/Users/lenovo/AppData/Local/Temp && node --experimental-loader ./resolve_ext_loader.mjs ./test_xxx.mjs`；浏览器像素校验见技能 `ruoyi-ui-node-verify`。
- 不自动跑构建；纯前端改动无需构建。后端 `java -jar` 改动需重构建+重启，**须先说明并等用户明确要求**。工具链 `C:\Users\lenovo\.codex\tools\ruoyi-vue`。
- 已知无害告警：`src/views/tool/systemProfile/systemProfile.zip` 被 `require.context` 扫到 → `Compiled with 1 warning`（不影响运行）。
