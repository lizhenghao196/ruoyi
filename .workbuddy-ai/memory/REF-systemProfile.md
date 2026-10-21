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

## 2. 按组件筛选链路（2026-10-16）

- 纯函数 `linkTopology.js / filterLinksByClusters(links, clusterNames)`：
  **只看起点**（`normalizeLinks` 之后的 `source`，即 fnode），而且是**全等**
  `fnode === 集群名` —— **不是「包含」**（用户明确要求「要用全等来判断」）。
  历史教训：早期是 `from.indexOf(name) >= 0`，于是 `集群名@角色` 也能命中，
  节点名就跟主机列表对不上了。
  - fnode 侧**不做** trim / 大小写折叠，要的就是逐字相同；
  - 集群名侧 trim（来自对象 key，可能有空白）；
  - 集群名为空数组 -> 返回**空数组**，不退回全量。
- 命中唯一性靠「集群名全局唯一」保证（全等匹配下重名会让一条链路归属两个组件）。
  `sp_verify.mjs` 的 C 段有断言：每个 fnode 全等于某个集群名、每条链路恰好归属一个组件。

### 筛选的输入是「**已展开**的集群」，不是「组件下所有集群」

主机列表折叠面板的展开状态（`data.openClusters`）和右侧链路图**共用一份状态**：
- `activeClusters` = 当前组件下的全部集群（候选）；
- `expandedClusters` = `activeClusters ∩ openClusters` —— **这才是链路图的筛选输入**。
- 收起一个集群 ⇒ 它的 fnode（节点 + 连线）从图上消失；全部收起 ⇒ 「无链路」，
  空态文案是「左侧集群都收起了，展开后即可看到链路」（第三种文案，别和「画像没返回链路」混）。
- 写 `openClusters` 一律走 `setOpenClusters(names)`（集合没变就不重算拓扑）；
  入口有 `selectComponent` / `onClusterToggle` / `toggleAllClusters` / 搜索框那个 watcher。
- `toggleAllClusters` 是**切换**语义：全展开 → 收，否则 → 展开（按钮文案跟着变）。
- `index.vue` 的两份链路：
  - `allLinks` —— 全量（`prepareData` 里 `normalizeLinks` 一次），**只给顶部概览的「链路」总数用**；
  - `links` —— 当前组件的筛选结果，右侧链路图 / 放大弹窗 / 表头计数都用它。
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

## 4. 校验脚本（都在 `C:/Users/lenovo/AppData/Local/Temp/`）

```bash
cd "C:/Users/lenovo/AppData/Local/Temp" && \
  "C:/Users/lenovo/.workbuddy-ai/binaries/node/versions/22.22.2-6/node.exe" \
  --experimental-loader ./resolve_ext_loader.mjs ./sp_verify.mjs    # 纯函数 + mock + 页面集成 + SCSS + 源码
# 浏览器侧（playwright + 本机 Chrome，需要 dev server 在 :80）
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
