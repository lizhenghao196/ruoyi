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
- **所有 `metrics` 型 key 合并成「一条」指标条**（2026-09-21 起**不再按 P1/P2 分组**，`metricGroups` 恒为 0 或 1 组）
- 其余按 **key 顺序**出区块
- **不返回的 key 不产出区块**（如 `重复性分析` 可能整个不返回）→ **页面零特判**

## ⚠️ 指标：数据层照旧 P1/P2，**只在前端合并 + 重排**（2026-09-21）

用户原话：「虽然数据返回 P1 和 P2，但是我们在页面上不这么分了，然后字段展示的顺序是
AI处置量 AI处置率 AI关闭 AI关单率 人工关闭 人工关单率 自动化关闭 自动化关单率 AI未纳管 告警总量」。

- **接口 / mock 数据一个字节都不用改**（`P1` / `P2` 照旧）。
  ⚠️ 我第一版把 mock 里 P1+P2 合并成了一个 `指标` key，**被用户打回**：「不要改 mockData 里面的数据呀」。
  **要改展示就只改展示层。**
- 顺序常量 `METRIC_ORDER` 写在 `shape.js`，`orderMetrics()` 做**稳定排序**；`buildSections` 里
  所有 metrics 型 key 的值先汇进同一个 `metrics` 池（mixed 分支的标量也进池），最后排一次序。
- **顺序的唯一来源就是 `METRIC_ORDER`，页面里不许再抄一份**（反向断言 `!/AI处置量/.test(idxCode)`）。
- 未列入 `METRIC_ORDER` 的指标（后端新增）统一排在最后，且保持传入相对顺序 —— 不丢、不乱。
- 因为只认这张表，**后端拆几个 key、按什么顺序返回都无所谓**（实测 `{P2:{...}, P1:{...}}` 也能正确合并排序）。

## 指标条 `components/MetricCards.vue`

- props 仍是 `groups: [{ name, metrics: [{ key, display, tone }] }]`，但实际恒为 **1 组**
  （保留数组是为了组件契约稳定 + 万一后端再返回多个 metrics key）。
- **`v-if="groups.length > 1"` 才渲染 `.mc__tag` 分组标签** —— 合并成一条后不再显示 P1/P2 chip。
- 单组时模板给 `.mc__group.is-only`，CSS 去掉右侧 `padding-right: 14px`，让 10 项铺满整行。
- ⚠️ **`flex-grow` 用内联按「本组条数」给**：`:style="{ flexGrow: Math.max(1, group.metrics.length) }"`，CSS 打底 `flex: 0 1 auto`。
  写死 `flex: 1 1 auto` 会让项数不同的组**平分宽度**，条目少的组被拉得很空（实测 105px vs 238px）。
- 容器 `flex-wrap: nowrap` + `overflow-x: auto`：指标再多也在一行，装不下就横滚。
  验收看 `scrollWidth === clientWidth`（不靠滚动条藏数据）。

## 概览区的「告警总量」——**2026-10-16 已删除**（曾长期「暂不处理」）

筛选栏右侧概览区原来写着「告警总量」（= 页面实际渲染出的明细行数，mock 里 428），
指标条里也有「告警总量」（= 后端统计值，mock 里 530）→ **同名不同值**。

- 沿革：2026-09-21 我把它改名「明细条数」被用户回退（当时用户只要求「不区分 P1/P2 + 指标顺序」，
  概览要**原样不动**）；**2026-10-16 用户明确要求「把这里的告警总量删掉」** → 现在概览区不再有它。
- 现状：概览区只剩「重复性分析 N 组」，因此整块 `v-if` 改成
  **`searched && hasData && duplicateGroupCount > 0`** —— 不然没有重复性分析时会剩一个
  空的 `border-left: 1px dashed` 分隔框（`padding-left: 20px` 也白占位）。
- 连带清理：`totalCount` computed（只服务这个展示）与 `sectionRowCount` 导入一并移除；
  `sectionRowCount` 在 `shape.js` 里**仍然导出**（测试还在用）。
- ⚠️ **指标条里的「告警总量」不受影响**，`METRIC_ORDER` 那 10 项一个没动。
- ⚠️ 断言坑：模板注释里为了说明「已删除」会写出「告警总量」四个字 →
  「模板里没有告警总量」这类断言必须**先剥掉 HTML 注释再匹配**（`idxTpl.replace(/<!--[\s\S]*?-->/g, '')`），
  否则假红。和 `misInfoReason` 是同一个坑。

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

## `buildQueryParams`：systemId 选填，teamName 始终带（2026-09-21）

- **用户不填系统 ID 时，参数里压根不能有 `systemId` 这个 key**（不是空串、不是 `null`）。
- **`teamName` 相反，始终带上**：下拉框默认值（现在是「全量」，见下）本身就是有效语义。
  默认值直接写死字符串（= 字典里对应项的 label，label 与 value 相同）。

## 组别字典 `dict_system_group`（2026-09-21 建，2026-10-15 换默认项）

- SQL：`sql/dict_system_group.sql`（照 `release_execute_status_dict.sql` 的写法，delete + insert，可重复执行）。
- 三项：**不限定组别** / **全量** / **基础平台域**。
- ⚠️ **dict_label 与 dict_value 完全相同**（都是中文）—— 前端 el-select 绑的就是中文，
  `teamName` 的默认值才能和字典项对上。**别把 value 改成拼音/英文码。**
- 页面：`dicts: ['dict_system_group']`，el-select 放在系统 ID 输入框**后面**（`.aa-bar__team`，150px）。
- ⚠️ **默认项 2026-10-15 从「不限定组别」改成「全量」**：`index.vue` 里 `teamName: '全量'` 是**硬编码**
  （页面不读 `is_default`）；SQL 里 `is_default='Y'` 也挪到「全量」了，但 **dict_sort 顺序没动**
  （「不限定组别」仍是第一项）。SQL 未重跑时 DB 里还是旧值，不影响页面。
- ⚠️ 截至 2026-09-21 收尾，数据库里**可能还没有这个字典**（`/dev-api/system/dict/data/type/dict_system_group`
  曾返回 `{"code":200,"rows":[]}`）→ 下拉框展开是空的，等用户执行 SQL。**2026-10-15 未复核。**

## ⚠️ 同一层级一律「按条数降序」（2026-10-15）

用户要求「数量多的排到上面 / 从左到右也降序」：

| 位置 | 数据 | 排法 |
|---|---|---|
| AI处置 左侧竖排导航 | `section.levels`（一级 = 处置结果） | 按该一级**总行数**降序 |
| P3 / 人工关单 / 自动化关单 的 tab 条 | `section.lists`（分类） | 按该分类**行数**降序 |

- 唯一实现处：`shape.js` 的纯函数 **`sortByCountDesc(items, countOf)`**（降序 + 同数按传入 index 稳定）。
  `makeTableSection` 排 `lists`；`makeNestedSection` 排 `levels`（countOf = `levelRowCount`）。
- **只在展示层排，mock / 接口数据一个字节没动。**
- 连带效果：`activeTabs[key] = section.lists[0].name` ⇒ 多 tab 区块**默认选中的变成条数最多的那个**
  （mock 里 P3 默认从「Agent关闭失败」15 条 → 「告警未恢复」27 条）；
  AI处置 默认一级从「AI关闭失败」→「AI关闭成功」（172 条）。
- ⚠️ **AI处置 里的二级「告警源」chip 没排**（用户只说了「左侧选择列」和「tab」，没提 chip）。
  脚本里有断言钉住「chip 顺序 = 全部 + 后端返回顺序」。要排先跟用户确认。
- ⚠️ 用户确认「tab 上的数量」就是排序依据 → **tab 标签上的 `(N)` 必须和排序一致**（`${name} (${rows.length})`）。

## 表格列 / 字段名 / 外部跳转（2026-09-21）

`components/AlarmTable.vue` 的列（**顺序即此**）：
`alertKey` / `summary` / `misinfoReason` / `alertReasonDesc` / AgentTrace / output / more

- ⚠️ **字段名是 `misinfoReason`，i 是小写**（不是 `misInfoReason`）。mock 已同步改过（428 处）。
  写断言时注意：「模板里没有 misInfoReason」要**只匹配属性值**（`prop="misInfoReason"`），
  因为注释里为了提醒「别写错」会把这个串写出来，全串匹配会假红。
- **`alertSource` / `closedBy` 不展示**：表格列删了，`FieldDialog` 里也进了 `HIDDEN_KEYS`（弹窗里也不列）。
- 按钮文字（⚠️ **2026-10-15 又对调过一次，现在的状态是**）：
  - `output` 列 = **「查看简报」**（`$emit('view-field','report')` → 弹窗渲染 output 的 markdown）
  - `more` 列 = **「告警详情」**（跳外部 gdb_screen，用 `runId`）
  - ⚠️ **只换了按钮文字**，行为没换；`FieldDialog` 里 `report` 的弹窗标题**仍然是「告警详情」**。
    用户明确说「只换文字，其他都不变」→ **这个不一致是刻意的**，别顺手「修好」（脚本里有断言钉住）。
  - 沿革：output 原来是「告警报告」→ 09-21 改「告警详情」；more 原来是「更多字段」→ 09-21 改「查看简报」→ 10-15 两者对调。
  - 「更多字段」弹窗（`type === 'more'`）**仍然没有入口**，代码留着没删，需要时能接回来。
- **两个外部跳转**（常量写在 AlarmTable 顶部，都是新开 tab）：

  | 触发 | 字段 | 地址 |
  |---|---|---|
  | alertKey 列的值（`<a target="_blank">`） | `alertKey` | `http://alt.eprod-kzx1.cncb/#/jiraAlertInfo?alertKey=<alertKey>` |
  | more 列「告警详情」按钮 | `runId` | `http://10.2.64.23/gdb_screen/#/agentInfo?activeRunId=<runId>` |

  - ⚠️ 判空用 `=== undefined || === null || === ''`，**不要用 `||`**（`runId: 0` 会被当空）。
  - 缺 `alertKey` → 值退化成纯文本（不出死链）；缺 `runId` → 按钮 `disabled`。

## 表格高度：AI处置 = 固定 `height=420`，其余 = `max-height=420`（2026-10-15 定稿）

`AlarmTable.vue` 一个组件被四处复用，靠 **`fixedHeight` 开关**（Boolean，默认 `false`）分两种模式：

| 位置 | 传参 | 根元素行内 style | 效果 |
|---|---|---|---|
| **AI处置**（`NestedGroups.vue`） | `fixed-height` | `height: 420px` | 永远 420 高，给左侧导航做「等高」参照 |
| P3 / 人工关单 / 自动化关单（`index.vue`） | 不传 | `max-height: 420px` | 行少时跟着变矮，超过 420 才滚动 |

`DuplicateTable.vue`（重复性分析）**不受影响**，仍是 `max-height="520"`。

- ⚠️ **高度值必须写成模板里看得见的字面量**（`:height="fixedHeight ? 420 : undefined"`）。
  我第一版写成模块级 `const TABLE_HEIGHT = 420`，**模板里是 undefined**（模板只能访问实例属性），
  于是 `fixedHeight ? C : undefined` 两边都算成 undefined → AI处置 根本没高度。
  **node 断言全绿但浏览器里是坏的** —— 是 `aa_height_verify.mjs` 抓到 `[Vue warn] Property or method "TABLE_HEIGHT" is not defined`。
- 判据（Element 实现：`table-layout.js` 的 `setHeight(value, prop)` → `el.style[prop] = value + 'px'`，
  作用在 `.el-table` **根元素**上）：读根元素的行内 `style.height` / `style.max-height` 就是权威结论。
- 行为级验证：把非 AI处置 的行 DOM 藏到只剩 2 行 → AI处置 仍 420，其余缩到 ~123。见 `aa_height_verify.mjs`。
- 沿革：10-15 我先做了一版又被用户要求整条回退（当时他只是在**描述现状**），随后他给出明确数值
  （「height=420 / max-height=420」）才算定稿。⇒ **这类只提属性的模糊描述，先问清是「要改」还是「在描述现状」。**

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

- `C:/Users/lenovo/AppData/Local/Temp/test_alarm_analysis.mjs`（**344 条**，node）
  9 个分组：shape.js 纯函数 / 真实 mock 跑 buildSections / 「不返回就不渲染」与容错 / SFC 模板+script /
  SCSS 产物 / 页面级集成（抠 index.vue 跑真实 mock）/ NestedGroups 组件行为 / MetricCards /
  **[9] 列·字段名·外部链接·组别字典·默认查询条件**。
  ⚠️ **SFC script 语法检查用 `@babel/parser`（`babelParse(src, {sourceType:'module'})`），
  不要用 `execFileSync(process.execPath, ['--check', tmp])`** —— 本机沙箱里「node 里再 spawn node」
  必然 `EBUSY`，6 个文件全假红（2026-10-15 踩过，已改）。
  ⚠️ 里面有**反向断言**：`!/el-tabs/` + `!/el-radio-group/` 钉住「不许退回横向 tab / 单行分段」；
  `!/p1Data|p2Data|p3Data/`；`!/\bres\.data\b|\bres\.rows\b/`；
  `!/AI处置量/`（页面不许抄指标顺序）；`!/告警总量/.test(idxTplNoComment)`（2026-10-16 起概览不再有「告警总量」，
  ⚠️ **必须先剥 HTML 注释**再匹配，见上文断言坑）；
  `!/29 \* 24 \* 60 \* 60 \* 1000/`（默认日期不许退回 30 天）；
  `/report: '告警详情'/` + `!/report: '查看简报'/`（output 弹窗标题**刻意**不跟着按钮改）；
  output / more 两列**按列切开**断言按钮文字（整模板匹配会两处都命中，改反了也测不出来）。
  MetricCards 的「单组不渲染标签」用 `compiler.compileToFunctions(...).render` 拿 vnode 数 `.mc__tag`，**不需要浏览器**。
- `C:/Users/lenovo/AppData/Local/Temp/aa_fields_verify.mjs`（**新增 2026-09-21**，playwright + 本机 Chrome）
  专测本次 6 条需求：下拉位置/默认值/选项/选中后 `form.teamName` 变化、查询参数带 teamName 且 systemId 仍不填不带、
  列名与按钮文案、alertKey 是 `<a target=_blank>` 且 href 拼对、点「查看简报」拦截 `window.open` 验证链接。
  ⚠️ 页面有 **4 个 `.at` 表格**（AI处置/P3/人工关单/自动化关单），选列时必须只取第一个，否则断言被 4 份重复撑爆。
  ⚠️ 前端代理前缀是 **`/dev-api`**（不是 `/prod-api`）。
  ⚠️ 字典没配时**注入一份字典数据**到 `aa.dict.type` 再验证选项渲染（不改数据库）。
- `C:/Users/lenovo/AppData/Local/Temp/aa_metric_verify.mjs`（**新增 2026-09-21**，playwright + 本机 Chrome）
  专测指标条：10 项 / 顺序 / 数值 / 无 `.mc__tag` / 只有 1 组 / 同一行（`offsetTop` 去重后 = 1）/
  `scrollWidth === clientWidth` / 末项右边界 ≤ 容器右边界 / **B 段：概览区只剩「重复性分析」且不含「告警总量」** / 无 JS 报错。
  ⚠️ 要过滤 `[WDS] Disconnected!`（dev-server HMR 的正常日志）和
  `Failed to load resource`（外部字体/CDN 超时，网络抖动就会冒出来）—— 都不是业务报错。
- `C:/Users/lenovo/AppData/Local/Temp/aa_fix_verify.mjs`（**29 条**，playwright + 本机 Chrome，像素级）
  验「表格底部横线真的画出来了」「导航与右侧等高（gap === 0）」「压力 15 个一级」「窄屏 1000px」。
  配套 `png_pixels.mjs`（自写极简 PNG 解码器）。
  ⚠️ 像素断言的判据坑见技能 `ruoyi-ui-node-verify` 的「浏览器视觉校验」一节。
