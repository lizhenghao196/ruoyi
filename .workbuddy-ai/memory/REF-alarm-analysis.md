# REF — 告警分析页（alarmAnalysis）：形态驱动渲染 / 组件约定 / 坑

> 从 `MEMORY.md` 拆出来的独立参考。
> **动手改 `ruoyi-ui/src/views/tool/alarmAnalysis/**` 之前，先读这里。**

## 核心：页面不认 P1/P2/P3，只认「形态」

唯一判定处 **`views/tool/alarmAnalysis/shape.js`**（纯函数、无 Vue 依赖、可 node 单测）。
**页面里不许出现 `p1Data` / `p2Data` / `p3Data` 这种按业务 key 写死的分支**（有反向断言钉住）。

```
shapeOf(v) → metrics | table | nested | duplicate | rows | empty | mixed
```
- `metrics`：纯对象，值全是标量（数字/字符串）→ 指标条
- `table`：纯对象，值全是数组 → 表格区块
- `nested`：纯对象，值是「对象套数组」（`{ 一级: { 二级: [行] } }`）→ 两级导航
- `duplicate`：数组，元素是「带重复性分组的对象」→ 合并单元格表格
- `rows`：数组，元素是纯对象 → 普通表格
- `empty`：`[]` 或 `{}`
- `mixed`：同 key 混标量 + 数组 → **拆到「指标组 + 表格区块」两处，不丢数据**
- `raw`：兜底，原样 JSON 预览

`buildSections(payload)` → `{ metricGroups, sections }`：
- **所有 `metrics` 型 key 合并成「一条」指标条**（P1 + P2 在一行里，靠 chip 标签分组区分）
- 其余按 **key 顺序**出区块
- **不返回的 key 不产出区块**（如 `重复性分析` 可能整个不返回）→ **页面零特判**

## 指标条 `components/MetricCards.vue`

- props 是 `groups: [{ name, metrics: [{ key, display, tone }] }]`（**不是单个 metrics 对象**）
- ⚠️ **`flex-grow` 用内联按「本组条数」给**：`:style="{ flexGrow: Math.max(1, group.metrics.length) }"`，CSS 打底 `flex: 0 1 auto`。
  写死 `flex: 1 1 auto` 会让 2 项的 P2 和 7 项的 P1 **平分宽度**，每条指标被拉得很空（实测 105px vs 238px）。
- 容器 `flex-wrap: nowrap` + `overflow-x: auto`：指标再多也在一行，装不下就横滚。

## `AI处置`（nested 型）`components/NestedGroups.vue`

数据结构：`{ 处置结果: { 告警源: [告警行] } }`。
- **二级那个数字 key 已确认是 `alertSource`**（问过用户）。
- ⚠️ **两级数量都不固定**：一级可能十几个，二级可能十几二十个。**别按「三五个」写死布局。**
  这是用户第二次明确提出的要求（第一次给了示例数据，第二次强调「告警源多的时候有十几二十个」「AI处置里面的字段也不是固定的」）。

渲染方案：
- **一级 = 左侧竖排导航**（横向 el-tabs 十几个会挤爆）：
  - **`.ng { align-items: stretch }`** + **条目列表 `.ng__nav-list { position: absolute; top/right/bottom/left: 6px }`**
    —— 绝对定位子元素**不参与父元素高度计算** → 导航自身高度≈0 → flex 行高由右侧内容决定 → stretch 把导航拉成
    **与右侧内容 / 表格严格等高**（用户要求「高度拉满，不要有空余空间」）。
  - 列表 `overflow-y: auto`：条目再多也在导航内部滚，不把整块撑高。
  - ⚠️ **`.ng__nav` 必须显式 `margin: 0; padding: 0; line-height; font-size`** —— 见下「全局样式泄漏」。
- **二级 = 可换行 chip**（单行 el-radio-button 二十个会溢出）：`flex-wrap: wrap`，第一个是 **「全部」**（带总条数）。
  - ⚠️ **语义是「筛选」不是「切换」—— 默认必须是「全部」**，不能默认把 19 个告警源藏起来（表格里有 `alertSource` 列可辨认）。
  - 每个一级**各自记自己的筛选值**（`activeGroup[levelName]`），切走切回还在；**重新查询才复位**。
  - 只有一个告警源时 `showFilter` 为 false，不占地方。
- 窄屏 `@media (max-width: 1100px)`：改竖排，导航置顶 + **显式 `height: 180px`**
  （竖排时没有「等高」参照了，绝对定位列表撑不起高度，必须给死高度）。

配套纯函数（都在 `shape.js`）：
- `ALL_GROUPS`（「全部」的哨兵值）、`levelRowCount(level)`、`flattenLevel(level, filter)`
  —— ⚠️ **`flattenLevel` 在筛选值失效时必须退回「全部」**，不能给空表（否则看着像没数据）。
- ⚠️ **`levelTone` 的判定顺序是「成功 → 失败 → 重放 → 其它」，不能换**：
  `HANDLED_ERROR_REPLAY` 含 `ERROR` 但不含成功/失败，换顺序就会落到 `bad`。

## `buildQueryParams`：系统 ID 是选填

**用户不填系统 ID 时，参数里压根不能有 `systemId` 这个 key**（不是空串、不是 `null`）。

## ⚠️ 全局元素选择器会漏进 scoped 组件

`ruoyi-ui/src/assets/styles/index.scss:99` 有一条**全局元素选择器**：

```scss
aside {
  background: #eef1f6; padding: 8px 24px; margin-bottom: 20px;
  border-radius: 2px; line-height: 32px; font-size: 16px; color: #2c3e50;
}
```

它会命中组件里的 `<aside class="ng__nav">`。
**关键认知：CSS 特异性只对「双方都声明过的属性」生效** ——
`.ng__nav[data-v-x]`（0,2,0）特异性虽然高于 `aside`（0,0,1），但**我没声明的属性照样吃全局值**。

后果：`margin-bottom: 20px` 让 `align-items: stretch` 拉伸出的高度被扣掉 20px
（表现为「导航比右侧内容矮一道缝」，实测 `navH:436 / mainH:456`）。

**修法**：在 `.ng__nav` 里把 `margin` / `padding` / `line-height` / `font-size` 一起显式归零。
**通用教训**：在 scoped 组件里用 `<aside>` / `<article>` 这类语义标签前，先 grep 全局样式表看有没有元素选择器。

## ⚠️ 表格底部横线靠 `.el-table::before`

Element 的 `.el-table--border { border-right: none; border-bottom: none }` **去掉了根元素的下边框**，
所以表格**底部那条横线完全靠 `.el-table::before`（1px 绝对定位）来画**；
右侧竖线是 `.el-table--border::after`，另一回事。

**绝不能写** `.el-table { &::before { display: none } }` —— 写了表格底部就是敞口的，看着「不完整」。
`AlarmTable.vue` / `DuplicateTable.vue` 曾各写一句，**这就是「表格最下面 border 不显示」的根因**（已删，原位留了警告注释）。

补充：行的 `td` 各自有 `border-bottom`，但表格是 `max-height` 滚动容器 ——
滚到中间时最后一条可见行的线并不在容器底边，所以容器底线**必须**由 `::before` 提供。

## 校验脚本

- `C:/Users/lenovo/AppData/Local/Temp/test_alarm_analysis.mjs`（**241 条**，node）
  8 个分组：shape.js 纯函数 / 真实 mock 跑 buildSections / 「不返回就不渲染」与容错 / SFC 模板+script /
  SCSS 产物 / 页面级集成（抠 index.vue 跑真实 mock）/ NestedGroups 组件行为 / MetricCards。
  ⚠️ 里面有**反向断言**：`!/el-tabs/` + `!/el-radio-group/` 钉住「不许退回横向 tab / 单行分段」；
  `!/p1Data|p2Data|p3Data/`；`!/\bres\.data\b|\bres\.rows\b/`。
- `C:/Users/lenovo/AppData/Local/Temp/aa_fix_verify.mjs`（**29 条**，playwright + 本机 Chrome，像素级）
  验「表格底部横线真的画出来了」「导航与右侧等高（gap === 0）」「压力 15 个一级」「窄屏 1000px」。
  配套 `png_pixels.mjs`（自写极简 PNG 解码器）。
  ⚠️ 像素断言的判据坑见技能 `ruoyi-ui-node-verify` 的「浏览器视觉校验」一节。
