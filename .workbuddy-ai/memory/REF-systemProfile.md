# REF — 系统画像（`views/tool/systemProfile/`）

> 页面：`index.vue`（2876 行，单文件）+ `linkTopology.js`（纯函数：链路规范化 / 筛选 / 瀑布布局）。
> 数据：`ruoyi-ui/mockData/res.js` 的 `systemProfileRes`（`组件拓扑` / `链路` / `集群关系` / `基础信息`），
> api 层 `src/api/tool/systemProfile.js`（**目前是纯 mock**，真实接口注释在函数尾部）。

## 1. 数据结构与「集群名」的唯一来源

```
组件拓扑: { 组件类型: { 集群名: [ 主机对象 ] } }      ← 第二层 key = 集群名
链路:     [ { fnode, snode, desc? } ]                 ← fnode/snode = 节点原始名
集群关系: { 组件类型: [ { clusterName, nodes[], desc? } ] }
```

**集群名在页面上出现在两个地方，必须一致**：
- 主机列表折叠面板标题 `profile-cluster__title`（= 组件拓扑第二层 key）
- **链路节点名本身就是集群名**（如 `bjb-dasp-nginx-kzx`），图上画出来的文字、悬浮卡片标题
  都是它，用户能直接拿去主机列表里对号

⚠️ **改 mock 链路数据前先对一遍组件拓扑的 key**。对不上那条链路在任何组件下都筛不出来，
页面表现为「凭空少了几条链路」，**不报错**。

⚠️ **2026-10-16 用户纠正过一次**：最早节点名写成 `集群名@角色`（`bjb-dasp-nginx-kzx@bjb-nginx-lb`），
用户问「NGINX 里没有这个名字，为什么链路上显示出来了」——
那种拼出来的名字主机列表里查不到，看着像凭空多出一台机器。**现在一律用集群名本身。**

## 2. 按组件筛链路（2026-10-16 定全等，2026-10-29 改成向下传递闭包）

- 纯函数 `linkTopology.js / filterLinksByClusters(links, rootNames)`：
  **两步**——
  1. **定根**：根名侧 trim，`fnode` 侧**逐字全等**（不是「包含」）。
     历史教训：早期是 `from.indexOf(name) >= 0`，于是 `集群名@角色` 也能命中，
     节点名就跟主机列表对不上了。
  2. **展开下游**（2026-10-29 用户要求）：从根沿链路做**可达性 BFS**，根的直接下游、
     下游的下游……全部收进集合，最后返回所有「起点落在集合里」的链路。
     即「这个 key 连同它下游的所有连线都画出来」（孙子、曾孙都算）。
  - ⚠️ **只看起点、不看终点**：这是**向前的传递闭包**，不是双向连通块。
    选 MYSQL 不该把 `NGINX→MYSQL` 带出来（那是 NGINX 的视角）。
  - 环靠 `visited` 兜住（HADOOP 的 `bjb↔hfa` 双向边很常见），不会死循环。
  - 集群名为空数组 -> 返回**空数组**，不退回全量。
- **根节点只有一个来源**（2026-10-29 当天改过两版，**最终版是这版**）：
  `index.vue / linkRootNames` = `expandedClusters`（组件拓扑第二层 key）；
  组件拓扑里**一个集群都没有**时才退回 `relationNodeNames`（`集群关系[组件].nodes`）。
  - ⚠️ **绝对不能把关系节点并进根集合**（第一版就是并进去的，当天被内网实测打回）。
    那份数据**不随折叠状态变化**，并进去以后：
    收起一个集群 → 图上一条不少（看着像「点了没反应」）；
    一键收起 → 无图（唯一的空集合状态）；
    只展开一个 → **瞬间显示全部链路**。
    三个症状会同时出现，而且 mock 里 CANAL/ES/ZOOKEEPER 有集群关系数据，**外网也能复现**。
  - 关系节点只在 `refreshTopo` 里做**严格条件下的兜底**：
    `!links.length && allExpanded && relationNodeNames.length`——
    即「集群全部展开却零命中」（说明组件拓扑 key 与链路 fnode 命名口径不一致）。
    部分展开时**不许兜底**，否则折叠效果又被抹平。
- **收起集群的出边必须再兜一刀**（2026-10-29）：传递闭包算完后，把
  `activeClusters ∖ openClusters` 作为 source 的边全部剔掉。
  原因：闭包是「从根往下游走」，若别的集群指向它（`hfa→bjb`，收起 bjb 后 bjb 仍被 hfa 可达），
  按闭包语义它的出边还会留着 → 用户点了收起却一条不少。剔掉后「收起哪个集群，它的连线就消失」才成立。
  （节点作为**终点**仍然显示，这是对的：上游展开着，线就该在。）
- mock 里 MYSQL/CANAL 等组件的 `集群关系` 大部分是注释掉的；CANAL/ES/ZOOKEEPER 有数据。
- 命中唯一性靠「集群名全局唯一」保证。`sp_verify.mjs` 的 C 段有断言：
  每个 fnode 全等于某个集群名、每条链路恰好归属一个组件。
- 展开后的规模（mock，49 条全量）：MYSQL 4→13 条 / 6 层、CANAL 3→9、GREATDB 3→12、
  应用 14→18、NGINX 3→3、测试 0→0（空态用例）。**没有哪个组件把全图吞掉**。

### 筛选的输入是「**已展开**的集群」，不是「组件下所有集群」

主机列表折叠面板的展开状态（`data.openClusters`）和右侧链路图**共用一份状态**：
- `activeClusters` = 当前组件下的全部集群（候选）；
- `expandedClusters` = `activeClusters ∩ openClusters` —— **这才是链路图的筛选输入**。
- 收起一个集群 ⇒ 它的 fnode（节点 + 连线）从图上消失；全部收起 ⇒ 「无链路」，
  空态文案是「左侧集群都收起了，展开后即可看到链路」（第三种文案，别和「画像没返回链路」混）。
- 写 `openClusters` 一律走 `setOpenClusters(names)`（集合没变就不重算拓扑）；
  入口有 `selectComponent` / `onClusterToggle` / `toggleAllClusters` / 搜索框那个 watcher。
- `toggleAllClusters` 是**切换**语义：全展开 → 收，否则 → 展开（按钮文案跟着变）。
- **默认展开策略 = 只开第一个集群**（2026-11-04，用户诉求：生产上单个组件动辄上百集群
  如 HAPROXY 310 个，全展开会把右侧链路图画成上千条线的「碗」，既难看又卡）：
  - 唯一入口 `defaultOpenClusters()`，`doSearch`（查询成功回调里定完 `activeComponent` 之后）
    和 `selectComponent` 都调它。**别再写回 `this.openClusters = this.activeClusters.slice()`**。
  - 「第一个」= `filteredGroups[0].name`，即主机列表里**第一个可见**的集群。
    ⚠️ 不等于组件拓扑 `Object.keys()` 的第一个：`componentList` 里 clusters 按
    `name.localeCompare` **排过序**（HAPROXY / 应用 两个组件的两种顺序确实不同），
    用拓扑 key 顺序当期望值写断言会假红。
  - 搜索把当前组件的集群全过滤掉时兜底到 `activeClusters[0]`，否则链路图会退化成
    「左侧集群都收起了」的空态。`searchQuery` 那个 watcher 保持不变（无交集时自动开第一个可见集群）。
  - 默认态 `allClustersExpanded === false` ⇒ 表头按钮显示「一键展开」（不是「一键收起」）。
  - 效果（mock，NGINX）：默认 2 节点 / 1 边；一键展开 4 节点 / 3 边。
  - 校验：`Temp/sp_default_open_check.mjs`（51 项，纯函数 + 源码断言）+
    浏览器侧 19 项（折叠 `is-active` 计数、展开项 = 列表第一项、切组件仍只开一个、
    按钮文案、控制台无报错）。
- `index.vue` 的两份链路：
  - `allLinks` —— 全量（`prepareData` 里 `normalizeLinks` 一次），**只给顶部概览的「链路」总数用**；
  - `links` —— 当前组件展开下游后的结果，右侧链路图 / 放大弹窗 / 表头计数都用它。
  - 顶部概览「链路」= `allLinks.length`（系统级，用户确认**不跟着组件变**）；当前组件的条数在
    链路图表头上单独给（还有一个 `profile-link__scope` chip 显示归属组件）。
- 刷新链路：`refreshTopo()`（筛选 + `buildTopology`）→ `applyComponentLinks()`（重筛 + `$nextTick`
  重画 inline/dialog 两个画布）。`selectComponent` 里判 `changed` 才重算。
- ⚠️ **`doSearch` 里必须先定 `activeComponent` 再调 `prepareData()`**：顺序反了会先按上一次查询的
  组件筛一遍链路（白算一次拓扑），还得再补一次重算。
- ⚠️ **无链路时容器被 `v-if` 摘掉，实例必须 dispose**：`renderTopoChart` 统一走 `disposeTopoChart(mode)`
  （收实例 + 清 `_topoStates[mode]` + 清悬浮卡片）。容器没了还留着实例会漏，且切回来会叠两层画布。
- 空态文案两种（`linkEmptyTitle` / `linkEmptyHint`）：
  `allLinks.length === 0` → 「暂无链路数据」；有链路但当前组件没匹配到 → **「无链路」**。
- mock 里 **「测试」组件故意一条链路都没配**，用来验证空态 —— 别当成遗漏给补上。

## 3. 线段上的 desc（「空间合适就直出，不合适退回悬浮卡片」）

判定 + 排版 = `edgeLabelPlans(topo, posMap)`，返回 `null` = 不直出。**全局一刀切**，两层：
1. 节点数 ≤ `TOPO_EDGE_LABEL_MAX_NODES`(14) 且 线段数 ≤ `TOPO_EDGE_LABEL_MAX_EDGES`(12)；
2. **每一条**带 desc 的线段都要放得下至少 `TOPO_EDGE_LABEL_MIN_W`(60px) 宽的文字：
   `预算 = min(线段长 - PAD(26), MAX_W(200))`。

只要有一条不满足就**全部不直出**（半张图有字、半张没有比统一不给更容易让人以为图坏了）。
不直出时 desc 仍然在**悬浮连线的卡片**里给（`updateTopoHover` → `placeTopoHover`），这条路径一直都在。

### 排版：文字横着画、锚在曲线中点

**这是用户拍板的形式，别再自己发挥**：
- 文字摆在线段中点（`curveMidpoint`，二次贝塞尔 t=0.5）、**横着画、不转不偏移**。
- ⚠️ 2026-10-16 试过两版「贴着线条」的玩法，**都被用户否掉**：
  ① 文字顺着线段方向旋转（`label.rotate` 逐条给角度）；② 锚点沿法线让开 11px（贴线不压线）。
  用户原话：「算了，文字还是不要竖着了，用之前的形式，你只需要考虑文字过多的情况就行了」。
  ⇒ 竖线（角度 90°）上的中文会竖着排，读起来费劲，所以不要旋转。
  ⇒ 顺带删掉了「文字块旋转后做分离轴碰撞判定」那套（横排后它会把 NGINX 默认视图的标签全判掉）。
- **只保留「desc 文字过多」的自适应处理**（见下）。

### desc 过多：按线段实际宽度自适应截断

- `fitText` + `estimateTextWidth`：⚠️ 宽度必须**逐字累加**（`charWidth`：中日韩/全角 11px、其余 6.2px），
  早期用「字数 × 11」估，中英混排会忽长忽短 —— `sp_verify` 有防回归断言。
- `预算 = min(线段长 − PAD(26), MAX_W(200))`，按预算截断并补省略号；
  **长线多画几个字、短线少画几个字**，不再因为「desc 太长」整条线放弃
  （只有预算不足 `MIN_W`(60) 才整体不画）。全文始终能在悬浮卡片里看到。
- mock 里「容器云」那条 desc 故意写长（30 字），用来演示截断：线上画 18 字 193px，卡片里给全文。

### ⚠️ echarts 4.9 / zrender 的硬事实（改这块之前必读）

- **`lines` 系列不渲染 label**：`LinesView` 走 `LineDraw` / `EffectLine`，整条链路没有 label 分支；
  `linesSeries.js` 的默认 option 里虽然有 `label` 字段，但没有任何地方消费它。
  ⇒ 线段上的文字只能用 **scatter** 挂在锚点上（二次贝塞尔 t=0.5，`curveMidpoint`）。
- **`symbol: 'none'` 会连 label 一起没有**：`SymbolDraw.symbolNeedsDraw` 里有一句
  `data.getItemVisual(idx, 'symbol') !== 'none'` —— 为 `none` 时**图形元素压根不创建**。
  正确写法：`symbol: 'circle'` + `itemStyle: { color: 'transparent' }`（anchor 用 symbolSize 2）。
- **label 的字号和元素 scale 无关**（2026-10-16 实测纠正，之前记错过）：
  zrender 的 `RectText` mixin 默认只把**矩形** `applyTransform` 到视图空间、**不** `setTransform`，
  所以文字永远按 `style.fontSize` 的像素值画 —— 节点系列 `symbolSize:14`（缩放 7 倍）的文字
  照样是 11px。**改字号要改 `label.fontSize`，别去动 symbolSize。**
- 文字位置**会**受 scale 影响（矩形被变换）：所以 `inlineLabelsFit` 按
  `posMap + baseSize/2 + distance` 摆矩形是对得上真实渲染的。
- 旋转能不能刷新（**现在没用到，留着备查**）：`label.rotate` 会被 `setTextStyleCommon` 转成**弧度**
  存进 `style.textRotation`；`SymbolDraw.updateData` 的 update 分支里会 `symbolPath.setStyle(...)`
  （标记脏）+ 同层节点动画，所以拖拽时重设数据项能让角度跟着变。⚠️ 但拖拽时要**整颗替换**数据项
  （`state.edgeLabelItems[li] = {...}`），原地改 `label.rotate` 不保证被重读。

### 数据项与拖拽

- `state.edgeLabelItems`（scatter 的数据项，`value` = 线段中点、`name` = 截断后的 desc）
  + `state.edgeLabelIndex`（连线下标 → 标签项下标）。
- **拖拽节点时标签要跟着走**：`writeTopoNodePos` 里按 `edgeLabelIndex.get(ei)` 找回标签项，
  用新的 `coords` 重算曲线中点。文字**不重新截断**（拖拽中变长短会让文字跳）。
  `state.refresh(all)` 里也要带上这个系列（否则拖完标签留在原地）。
- zlevel 与节点同层（`TOPO_ZLEVEL_NODE`）、`z: 3` 低于节点的 4 ⇒ 文字压在连线之上、节点之下。

### 节点名：小图里空间够就常显（2026-10-16 需求 1）

判定 = `inlineLabelsFit(topo, posMap, labelMax)`：把每个名字按「**节点正下方居中**」摆成一块矩形
（起点 = 节点中心 + 半径 + `TOPO_NODE_LABEL_DISTANCE`，高 = 行数 × `TOPO_NODE_LABEL_LINE_H`），
**两两不重叠、也不压到任何一个节点**就常显，否则还是「悬浮才显示」。
- 纯几何判定，`posMap` 已经是画布像素坐标，和最终渲染同一套尺度。
- 弹窗里恒常显（`show = isDialog || state.showNodeLabels`）。
- 判定与渲染**共用** `TOPO_NODE_LABEL_DISTANCE` / `TOPO_NODE_LABEL_LINE_H` 两个常量 ——
  早期分别在判定和 option 里写死 `6` / `13`，迟早会对不上。
- 常显时表头那句「悬浮查看节点」要藏起来（`inlineNodeLabels` data 由 `renderTopoChart` 回写，
  只在值变化时赋值，避免和 ResizeObserver 形成来回重排）。
- 实测：NGINX（4 节点）常显；「应用」（15 节点）不常显。

## 3.5 悬浮卡片：单击固定 + 可复制（2026-10-29）

**用户诉求**：悬浮卡片一动就消失，里面的内容复制不了；问能不能让节点下面的字也选中。
→ 节点名是 **canvas（echarts scatter label）画的，物理上无法选中**，只能把「可复制」做在卡片上。

**交互**：单击节点/连线 → 卡片**固定**（`topoHover.pinned`），不再跟随鼠标，文字可划选、可点「复制」按钮；
再点同一目标 / 点画布空白 / 按 Esc / 点卡片上的 × / 切组件 / 折叠 / 缩放平移 → 取消固定。

实现要点（改这块必看）：
- ⚠️ **`updateTopoHover` 开头遇到 `pinned` 必须直接 return**。否则鼠标一动就重新判定、
  卡片被换掉或清空 —— 这正是原来「不能复制」的根因。
- ⚠️ **`clearTopoHover(mode, force)` 加了 `force` 参数**：非强制时**不动固定态**。
  「卡片内容已失效」的场景必须传 `true`：`disposeTopoChart` / `renderTopoChart` /
  滚轮缩放 / `onTopoDialogClose` / `resetTopoView` / `openTopoDialog`（收掉小图那份）。
- ⚠️ **`pointer-events` 是两态的**：跟随态 `none`（不能挡命中测试，老规矩），
  固定态 `.is-pinned` → `auto` + `user-select: text`。**不能图省事全局设 auto**，
  那会让跟随态卡片挡住 `hitTestTopo`，悬浮链就断了。
- **单击 vs 拖拽**：`bindTopoInteractions` 里新增 `down = { hit, x, y, moved }`，
  移动超过 **4px** 才算拖拽（`mousemove` 里置 `moved` 并顺手 `unpinTopoHover()`，
  否则卡片停在原地、和拖走的节点对不上）。`mouseup` 里 `!down.moved` 才算单击；
  `globalout`（鼠标离开画布）**不算单击**。
- **卡片高度恒一行底注**（跟随态「单击固定后可选中复制」/ 固定态「已固定 · 按 Esc 取消」）：
  两态都占一行，固定的一瞬间卡片不会跳位置。`placeTopoHover` 的 `rows` 相应 +1（标题 + 底注）。
- **复制走两条路**：优先 `navigator.clipboard.writeText`，失败/不存在时 `textarea + execCommand` 兜底 ——
  **内网是 http，非安全上下文里 `navigator.clipboard` 根本不存在**，只写前者内网会复制不了。
  复制内容是「标题 / 指标（· 连接）/ desc」三行。
- 卡片返回对象里 `pinned` / `pinKey` 必须在 `placeTopoHover` 的**字面量里就声明**（哪怕空值）——
  Vue 2 在对象赋给 `topoHover` 之后再加的新属性不是响应式的。
- 校验：`Temp/sp_pin_check.mjs`（38 项：固定/取消/点空白/Esc/连线 desc/复制内容拼装/源码断言）。

## 3.6 性能：几百个集群时的卡顿（2026-11-04 实测）

**场景**：生产上单个组件 310 个集群 / 1550 台主机 / 170 条链路（232 节点），点「一键展开」卡 3.4s。

**测量方法**（可复现）：playwright + `channel: 'msedge'`（本机 Chrome 起不来，见 §4 末尾），
注入合成数据到 `vm.profileData` 后 `prepareData()` + `renderTopoChart()`，
用 `PerformanceObserver({entryTypes:['longtask']})` 统计主线程阻塞、CDP `Profiler` 抓函数级耗时。

**结论：主因不是 echarts**。

| 指标 | 数值 |
|---|---|
| 点击 → 绘制完成 | 3456 ms |
| 主线程阻塞 | 2289 ms（单次长任务 1692 ms） |
| echarts `setOption`（170 边） | 191 ms（3.4%） |
| 筛选 + `buildTopology` | 7 ms |
| 首屏 DOM（**只展开 1 个面板**） | 70608 节点 / 310 个 el-table / 1550 行 |

CPU 采样 top：`getTransitionInfo`(Vue) 1215ms/14.7%、`collapse-transition.enter`(Element) 1154ms/14%、
`resizeListener`(el-table 布局) 904ms/10.9%。

**三个根因**：
1. `el-collapse` 的内容用 **`v-show`**，310 个 `el-table` 首屏就全建好了（哪怕只展开一个）。
2. 展开时 310 个面板同时改 display ⇒ 每个都读 computed style（`getTransitionInfo`）⇒
   **310 次强制同步布局串成 1.7s 长任务**。
3. 310 个 el-table 各自 `doLayout`（`resizeListener`）。

⚠️ **CSS 禁 transition 完全无效**（3456→3364ms）：Element 的 `collapse-transition` 是
JS 内联 style + rAF 驱动的，外部 CSS 压不住；而且根因是布局次数，不是动画时长。

**已做（2026-11-04，三层懒加载，缺一层就会退化）**：

1. **默认只展开第一个集群**（`defaultOpenClusters`，见 §2）。
2. **表格 `v-if` 懒渲染**：`isClusterOpen(name)` —— 只有展开的集群才建 `el-table`。
   ⚠️ `el-collapse` 的内容是 `v-show`，收起时表格照样在 DOM 里，这是 7 万节点的来源。
   ⚠️ 加了 v-if 后展开的一瞬间没有内容可量高度，`el-collapse` 的 max-height 过渡会把
   表格压成 0 —— 必须配 `.el-collapse-item__wrap { max-height: none !important }`。
3. **视口懒挂载**：`isClusterMounted(name)` + `IntersectionObserver`（root = `.profile-hosts__panel`，
   `rootMargin: 400px 0px`）。展开但屏外的先渲染 `.profile-cluster__loading` 占位块，
   滚进视口 400px 才换成真表格。`mountedClusters` 在 `doSearch` / `selectComponent` 里重置为
   默认展开的那一个，`setOpenClusters` 里把收起集群的标记撤掉（否则再展开会瞬间重建全部）。
   ⚠️ **观察器必须校验 root 身份**（2026-11-05 修）：`ensureClusterObserver` 里判
   `_clusterObserver && _clusterObserverRoot === this.$refs.hostsPanel` 才复用，否则
   `disconnect()` 重建并把新实例存进 `_clusterObserverRoot`。**不能只判「有没有实例」**：
   `doSearch` 里 `loading = true` 会把整个内容区（第 26 行 `v-else-if="loading"`）换成加载态，
   `hostsPanel` 这个 DOM 连同旧 root 一起销毁重建，观察器还盯着已脱离文档的旧 root 时
   交叉计算恒为 0 ⇒ 占位块永久停在「滚动到此加载主机明细」。
   症状极具误导：**默认展开的首个集群正常**（它在 `mountedClusters` 里、直接建表，根本不走观察器），
   只有「收起再展开」和「展开其他集群」才暴露；且**空态输入框查询正常、弹窗切系统才坏** ——
   空态时 `hostsPanel` 还没挂载（`searched=false`），`ensure` 返回 null 不缓存，所以首次没踩到。
   回调里用**局部 `observer` 变量** `unobserve`，不要用 `this._clusterObserver`（重建后实例已换）。
   验证脚本 `Temp/sp_lazy_check.mjs`（A 空态 / B 弹窗 / C 连续切），回退对照能精确复现
   `tables:0 placeholders:1`。
4. `.el-collapse-item__wrap` 的 `content-visibility: auto` + `contain-intrinsic-size: auto 300px`。

⚠️ **占位高度口径必须一致**：`placeholderStyle` = `min(320, 41 + 行数 × 37)`，
`contain-intrinsic-size` 用 300 —— 两者对不上，滚过之后真实高度替换估算值，滚动条会跳
（实测偏差 0.13%，可接受，但别再放大）。

实测（310 集群 / 1550 主机 / 170 链路）：

| 场景 | 改前 | 改后 |
|---|---|---|
| 切到 310 集群的组件 | 几秒 | **118 ms**（DOM 70608 → 3858） |
| 一键展开 310 个 | 3456 ms | **1011 ms**（只建 3 个表格，307 个占位） |
| 滚动 4500px（挂 18 个表） | — | fps 44.8，单次最长任务 61 ms |

验证：21 项（切组件/展开/滚动挂载/收起清理/滚动条）+ 20 项（真实 mock 数据回归）+
既有 28/38/51/34 项全过。

**没做的（可选）**：
- **echarts 降级**（大图 >150 边时）：关流动光点 + 关入场动画，`setOption` 191→126ms，
  静止帧率 55→60fps。光点层是 motionBlur 整层重绘，170 个动画符号持续吃 CPU ——
  这是「页面一直卡」的**第二个独立原因**，和点击卡是两回事。
- **el-table 换轻量表格**：310 个组件实例（layout/ResizeObserver/事件）本身重，
  但懒挂载后同时存在的表格只有 3~8 个，收益已经不大。

**兼容性**：`content-visibility` 需 Chrome 85+，不支持时自动降级为普通渲染（无副作用）。
打印和 Ctrl+F 查找时浏览器会临时渲染（规范要求），不影响。

## 4. 校验脚本（都在 `C:/Users/lenovo/AppData/Local/Temp/`）

```bash
cd "C:/Users/lenovo/AppData/Local/Temp" && \
  "C:/Users/lenovo/.workbuddy-ai/binaries/node/versions/22.22.2-6/node.exe" \
  --experimental-loader ./resolve_ext_loader.mjs ./sp_verify.mjs    # 纯函数 + mock + 页面集成 + SCSS + 源码
# 浏览器侧（playwright + 本机 Chrome，需要 dev server 在 :80）
#   ⚠️ 2026-11-04 起：channel:'chrome' 在本机报 `spawn UNKNOWN`（bash 里直接执行 chrome.exe
#   是 Permission denied），改用 channel:'msedge' 正常。浏览器侧脚本一律用 Edge。
  ... ./sp_shot.mjs
```

- `sp_verify.mjs`：A SFC 语法/模板；B `filterLinksByClusters` 边界（含「全等，不是包含」）；
  **C mock ↔ 组件拓扑的对应关系**（每个 fnode 全等于某个集群名、每条链路恰好归属一个组件、
  集群名全局唯一）；D **抠 `index.vue` 的 `<script>` 在 node 里跑**（echarts 换桩、
  `./linkTopology` 换 `@/` 别名），断言默认组件 / 切组件 / 空态 / 重复点击不重算 /
  **折叠联动（收起一个集群链路少一条、全收起空态、一键收起展开、setOpenClusters 幂等）** /
  `inlineLabelsFit` 六组边界；E `edgeLabelPlans` 的密度 / 预算 / 自适应截断边界 +
  「锚点就是曲线中点、计划里没有旋转角」+ 真实数据上 NGINX 直出、应用不直出、容器云长 desc 被截断；
  F SCSS 产物；G 源码防回归（含**不许出现 `symbol: 'none'`**、锚点 symbolSize 2 + 字号写在
  `label.fontSize`、逐字估宽，以及**反向断言**：不许再出现 `label:{rotate}` / `lineAngle` /
  `edgeLabelAnchor` / `TOPO_EDGE_LABEL_OFFSET` / `quadsOverlap` —— 用户否掉过的那版不许被"好心"加回来；
  还要断言 `refreshTopo` 筛的是 `expandedClusters`、写 `openClusters` 都走 `setOpenClusters`、
  按钮在搜索框左边）。
- `sp_shot.mjs`：浏览器侧。登录 → `/tool/systemProfile` → 输入系统名查询 → 依次切组件，
  断言 chip / 表头计数 / 画布上的文字（读 `vm.linkChart.getZr().storage.getDisplayList()` 的
  `style.text`）/ 悬浮卡片里的 desc / 空态 / 顶部概览总数 / 控制台无报错；
  还断言**链路起点全等于集群名且能在左侧主机列表标题里找到**、**悬浮节点卡片标题就是集群名**、
  **desc 过长时按宽度截断带省略号（浮空卡片里给全文）**、**文字不旋转、锚点=曲线中点**、
  **需求 1：稀疏图节点名常显 / 稠密图不常显 / 常显时不显示「悬浮查看节点」**、
  **需求 2：点折叠头联动链路图、一键收起/展开、按钮文案随状态切换**。
  ⚠️ 画布上的文字**有两类**（desc 标签 + 节点名），统计必须用 `splitTexts(texts, descs)` 分类
  （desc 可能带省略号，不能直接用 `indexOf` 全等比较），否则断言会数错。
  **含开·关标签的 A/B 像素对照**：清空 `topo-edge-labels` 系列数据前后各数一次「有墨」像素
  （`(r+g+b)/3 < 200`），差值就是文字贡献（实测 750 vs 352）。
  ⚠️ 文字是**斜着画**的，像素对照的取样框要用方形的（140×120）才能兜住任意角度；
  多带进来的连线/节点/别的标签会被「开/关」两次相减消掉。截图在 `Temp/sp_shots/`。

⚠️ **别用「精确 hex 匹配文字色」做像素断言**：10.5px 的 CJK 笔画只有 1px 宽，Chrome 光栅化后
核心像素被抗锯齿提亮（`#41678f` 实测读成 `(102,132,165)`），精确匹配必然假红。
同理 `el.getBoundingRect()` 量 label 也没用 —— scatter 的 label 挂在 symbol 图形元素上，
那个元素的 boundingRect 只算形状本身（2×2 的圆点），量出来永远 2px。
量字号看 `el.style.fontSize`（**文字实际就是这个字号，与元素 scale 无关**），
量角度看 `el.style.textRotation`。

## 5. 其它零散约定

- 节点显示名 `topoLabelOf`：**默认整串照画**（节点名就是集群名，必须和主机列表对得上）。
  只削两类：三段式主机名 `a@b@c` → `<b 的最后一段>@<c>`；域名取第一个点之前（`starcard-dasp.gw.khx.cc` → `starcard-dasp`，端口保留）。
  ⚠️ **两段式 `xxx@yyy` 不削**（`BJ-DB@auth-adapt-mcd` 这种集群名）—— 早期版本只留 `@` 后面那段，
  结果图上叫 `auth-adapt-mcd`、主机列表里叫 `BJ-DB@auth-adapt-mcd`，又是一处对不上。
- `TOPO_LABEL_MAX` = 24 / `TOPO_LABEL_MAX_DIALOG` = 26：集群名 19~30 字符，上限放宽后
  38 个集群里只有 `BJ-DB@auth-service-switchadapt` 一个会被截。小图文字现在**空间够就会常显**，
  所以上限放宽不会造成"到处都写着字"。
- 悬浮卡片宽度 268px（`.profile-hover` 的 `max-width`），`placeTopoHover` 按它估高度 —— 改 desc
  字号/行数要一起看。
- 主机列表的列宽按 `tableWidth` 等比压缩，`ResizeObserver` 盯的是**卡片**不是面板（见 `observeHostsCard`）。
- 🐞 **已知未修的既有小 bug**：主机列表每个集群的量词永远是「条记录」，标准主机结构不会显示「台主机」——
  `isStandard` 算在 `componentList` 的**组件对象**上，而模板读的是 `filteredGroups` 里**集群对象**的
  `cluster.isStandard`（`filteredGroups` 只 spread 了 `{name, hosts}`，该字段是 undefined）。
  顶部组件 tag 的 tooltip 用的是组件级 `c.isStandard`，那个是对的。用户没提，**没动**。
