# REF — 执行界面简版（execPlanList / execPageSimple）

> 2026-09-22 新增。**改这两个页面前必读。**
> 与 `execPage` 的关系：功能对齐，**代码零共享**（用户明确要求），只允许共用 `mockData/res.js`。

## 0. 为什么会有两个「几乎一样」的页面

用户要求：「虽然功能接口和 execPage 大部分都一样，但是除了 mockData 里面的内容，
其他所有组件所有方法不许共享使用，包括接口」——目的是让两边各自演化、互不牵连。

所以**不要为了「复用」把简版的 import 指向 `@/api/tool/execPlan`、`@/views/tool/execPage/*`**，
也不要「顺手同步」两边。改 `execPage` 不该波及简版，反之亦然。

## 1. 文件清单（哪些是副本，谁是原件）

| 简版（新） | 原件 | 说明 |
| --- | --- | --- |
| `views/tool/execPlanList/index.vue` | 无 | 页面一，全新 |
| `views/tool/execPageSimple/index.vue` | `execPage/index.vue` | 页面二，**整文件重写**（结构大改） |
| `execPageSimple/components/*.vue`（8 个） | `execPage/components/*.vue` | 逐个复制 |
| `execPageSimple/flowLayout.js` | `execPage/flowLayout.js` | **改造为纵向**，见 §3 |
| `execPageSimple/nodeKind.js` / `nodeMenu.js` / `nodeParams.js` | 同名 | 原样复制 |
| `api/tool/execPageSimple.js` | `api/tool/execPlan.js` | 接口层副本 |
| `api/tool/_mockFlagSimple.js` | `_mockFlag.js` | **独立开关**，两套互不影响 |
| `api/tool/_mockApiSimple.js` | `_mockApi.js` | mock 实现 |
| `api/tool/_demo{Atom,Log,Node,Sms,Tick,User,Workflow}Simple.js` | `_demo*.js` | 7 个 |
| `mockData/res.js` | — | **唯一共享**（用户明确允许） |

路由：`store/modules/permission.js` 的 `STANDALONE_PATHS` 加了 `/tool/execPageSimple`（新标签页 + 独立全屏）。
⚠️ 匹配的是**相对 path**：`filterAsyncRouter` 里子路由的 `route.path` 是 `execPageSimple`（不带 `/tool/`），
所以白名单必须同时放 `'/tool/execPageSimple'` 和 `'execPageSimple'` 两个值 —— 这是既有约定，别只留一个。

菜单：`sql/execPageSimple_menu.sql`（1073 列表页 / 1074 执行页隐藏），
**已于 2026-09-22 15:0x 实际执行进 `ry-vue` 库**（备份：`Temp/sys_menu_backup_20260922.sql`）。
数据库连接信息在 `ruoyi-admin/src/main/resources/application-druid.yml`（库名 `ry-vue`），
mysql 客户端 `/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql`。
⚠️ **别重复执行**，否则 1073/1074 主键冲突。改菜单先 `select ... where menu_id in (1073,1074)` 看现状。

## 2. 页面一：变更计划列表（execPlanList）

- `el-table` 按系统聚合渲染 `planRes`（10 个系统 / 31 条计划）。
- 列：`type="expand"`（环境明细）+ 系统 + 执行日期 + 环境标签组 + 计划数 + 工单 + 操作。
- ⚠️ **有 `type="expand"` 列 ⇒ 任何列都不能加 `fixed`**（element-ui 2.15 会错位）。`esp_verify.mjs` [G] 段钉住了。
- `row-key` 用 `system-date-index`：`planRes` 里有两个 ACT 行（同 system 不同 date），只用 system 会重复。
- 「查看执行」→ `handleExec(row)`：**先同步 `window.open('', '_blank')` 占位**，再 `$router.resolve()`
  拼 URL 跳转（`await` 之后再 `window.open` 会被浏览器弹窗拦截）。
- URL 契约：`?ids=<所有 aripExecPlanId 逗号分隔>&sys=<系统名>&envs=<JSON>`，
  `envs` 是 `[{ planId, env, planName, ... }]`，只用于**首屏占位**（接口回来后以接口为准）。

## 3. 页面二：执行界面简版（execPageSimple）

### 3.1 结构

- 根 class `.esp`。
- 页头 `.esp__header`（min-height 96px）三栏：`.esp-picker` / `.esp-progress`（复用波浪+光带+clip-path 双层文字）/ `.esp__actions`。
- `.esp-picker` 两行 `.esp-picker__row`：第一行「环境」、第二行「流」，都是 `.esp-chip` 小长方形按钮（选中态 `is-active`）。
- 主体 `.esp__body` → `.esp-split` 左右两栏，**按 6 : 4 分宽（流 6 成 / 文档 4 成）**：
  - 左 `.esp-flow`（`flex:6 1 0; min-width:0`）= 流头（标题/状态胶囊/meta/暂停·取消·恢复）+ `.esp-flow__canvas` 画 `<flow-graph>`。
  - 右 `.esp-doc`（`flex:4 1 0; min-width:0`）= 虚线框 + `documentation` 图标占位（**将来放文档信息**）。
  - ⚠️ 比例必须用 **`flex: 6 1 0` / `flex: 4 1 0`（basis 归零）**，不能写 `width: 60% / 40%` ——
    `.esp-split` 有 14px 的 gap，百分比会变成 60% + 40% + 14px > 100% 把容器撑破。
    basis 归零后剩余空间按 grow 分配，gap 自动被扣掉，比例是精确的 6:4。
  - ⚠️ 两栏都要 `min-width: 0`：左栏没它会被 FlowGraph 的 px 宽顶开、右栏被挤没。
  - 窄屏媒体查询（<1280px）**只管 `.esp-progress`**，不再覆盖 `.esp-doc` 宽度
    （`flex-basis:0` 优先于 `width`，留着不生效还会误导）。
- ⚠️ **模板里不许出现 `<label>` / `<aside>`**：`assets/styles/index.scss` 有全局同名选择器会漏进 scoped 组件。
  行首标签用 `<span class="esp-picker__label">`，左右两栏用 `<section>`。

### 3.2 两级选择（这是与 execPage 最大的数据层差别）

- `envList`：**严格按 URL `ids` 的顺序**；环境名优先取接口返回值，首屏回落 URL `envs`。
- `envFlows` = `allFlows`（`mergeWorkflows(results)`）里 `planId === selectedPlanId` 的那些。
- `currentFlow`：**唯一**调用 `layoutFlow` 的地方，只画选中的那一条流。
- `ensureSelection()` 挂在 `fetchAll` 的 `finally`：轮询换数据后如果选中的 plan 不在了，
  自动回落到第一个环境 —— 否则左栏会空白，看着像页面坏了。
- `watch: selectedPlanId` → `ensureFlowSelection()` + `closeMenu()`（切环境要切流、关右键菜单）。
- `menuNode` 从 `currentFlow` 里按 id 重新查（不缓存节点对象）。

### 3.3 纵向布局（`execPageSimple/flowLayout.js`）

**主轴方向 = 执行方向**，这条直觉在两种布局里都要成立：

| | 横向版（execPage） | 纵向版（简版） |
| --- | --- | --- |
| 层 | 列（从左到右） | **行（从上到下）** |
| 同行/列多 unit | 纵向堆叠 | **横向并排** |
| 并行组内成员 | 纵向堆叠 + **竖线** | **横向并排 + 横线** |
| 常量 | `COL_GAP` / `GROUP_ROW_GAP` | `ROW_GAP` / `GROUP_COL_GAP` |
| `links` 形状 | `{ x, y1, y2 }` | `{ y, x1, x2 }` |
| 连线 | 源**右中** → 目标**左中** | 源外框**底中** → 目标外框**顶中**（竖直贝塞尔） |

其余规则（乱序数据先拓扑、`aniNodeGroup` 收缩成 unit、组内不画线、行内居中、`PAD_*` 留白）与横向版对称。
并行组外框宽 = `count*NODE_W + (count-1)*GROUP_COL_GAP + GROUP_PAD*2`，高 = `NODE_H + GROUP_PAD*2`。

### 3.4 与 execPage 一致的部分（都已完整保留）

轮询（3s，静默）、明细自动刷新（5s）、修改实施人、设置消息推送、暂停/取消/恢复、
节点右键菜单、节点双击看明细、流操作、`PROJECT_ROLE_KEYS` 权限判断、字典驱动状态配色。

### 3.5 环境 chip 的圆点 = 节点状态汇总（2026-09-23 改）

- **环境 chip 的圆点不再看计划状态**（`aripExecStatus`），改成看**节点**：
  该环境下所有流的全部节点一起汇总，配色由 `flowLayout.aggregateTone(nodes)` 决定。
  动机：计划状态是另一个层级，`aripExecStatus=SUCCESS` 时底下节点可能还有一半是 `INIT`
  （真实 mock 数据里 11 个环境有 2 个就是这种），圆点会骗人。
- ⚠️ **流 chip 的圆点不动**，仍取 `flow.status`（= `awiWorkflowStatus`）。用户明确只要环境改。
- 汇总优先级（`AGG_TONE_PRIORITY` + 收尾分支，唯一判定处 `aggregateTone`）：
  `bad > run > confirm > stop` → 全 `ok` → 全 `cancel` → 含 `ok` 的混合（读作 run）→ `init`。
- 悬停提示（`envTitle` + `envNodeDistText`）里带一行「节点状态：执行中 2 · 成功 12」，
  让圆点颜色有据可查。⚠️ **中文一律走字典 `statusText`**，页面不许新增状态中文表。

### 3.6 画布自动滚动（2026-09-23 新增）

把「执行中 / 报错」的节点带到 `.esp-flow__canvas` 视野中间。三条约束：

1. **用户自己滚过之后 20 秒内不动视野**（`AUTO_SCROLL_HOLD_MS = 20000`）。
2. **目标节点优先级 `bad > run > confirm > stop`**（`autoScrollNode`）：
   ⚠️ 这四档和 `flowLayout.js` 的 `AGG_TONE_PRIORITY` **刻意保持同一顺序**，
   所以「环境 chip 圆点是什么颜色」和「画布会居中哪个节点」永远指向同一件事 ——
   **改一处必须改另一处**（`esp_verify.mjs` [I] 段有交叉断言钉住）。
   报错 / 待确认 / 挂起三档都会一直命中（状态不会自己消失），
   所以页面自然「停在那儿」不再往下走。四档都没有（没开始 / 已跑完）→ 不滚动。
3. **弹窗 / 右键菜单开着时不动**（`anyDialogOpen`）。⚠️ **新增弹窗要记得加进 `anyDialogOpen`**。

⚠️⚠️ **最容易被改坏的一条：区分「用户滚的」和「程序滚的」只看输入事件，不看 `scroll` 事件。**
`@wheel` / `@touchmove` / `@keydown`（只认滚动键）/ `@mousedown`（判滚动条）→ 记 `lastUserScrollAt`；
画布**刻意不监听 `scroll`**。原因：轮询每 3s 刷一次内容，按 `scroll` 记的话，
程序化滚动和「内容变短导致浏览器夹 scrollTop」都会被误判成「用户刚滚过」，
自动滚动就永远冻着不动 —— 这个 bug 不会报错，只会「功能像没做」。
- `autoScrollBusy` 这类标志位是**多余的**，已删；别再为了「识别程序滚动」把它加回来。
- 平滑滚动落点核对：`AUTO_SCROLL_SETTLE_MS = 700` 后比对 `scrollTop`，不一致说明用户中途插了一手。
- `AUTO_SCROLL_MIN_DELTA = 6`：目标没动就不发起滚动，否则每轮轮询都蠕一下。
- 触发点：`fetchAll` 的 `finally`（首屏 + 每轮轮询）、`watch.selectedPlanId`、`watch.selectedFlowKey`。
  后两个**先把 `lastUserScrollAt` 清零**再滚 —— 换环境/换流是用户主动换视野，不该被上一条滚动记录压住。
- 坐标换算：`.flow-graph` 顶边要用 `getBoundingClientRect` 差值换算到画布滚动坐标系，
  **不能拿 `offsetTop`**（画布有 `padding: 10px 4px 16px`，且 offsetParent 不确定）。

## 4. 两个踩过的坑

### 4.1 动态 import 漏改（真 bug，2026-09-22 已修）

`execPageSimple.js` 的 `mockApi()` 里：

```js
return import("./_mockApi").then((mod) => mod[name](...args));   // ← 漏改，应为 ./_mockApiSimple
```

**症状**：页面看着完全正常（数据照出），`node --check` 过、模板编译过、`grep "_mockApi'"` 搜不到（它带括号）。
实际整条链路跑的是 execPage 的 mock，「零共享」已破但**零报错**。
暴露方式：运行时报错里出现了不该出现的路径 `_mockApi.js:143`。

**防回归**：`esp_verify.mjs` [C] 段断言 `import(...)` 的说明符全部以 `Simple` 结尾。
批量改名后复查 `grep -rn "_mockApi\.js\|_demo[A-Z][A-Za-z]*\.js" <新目录> | grep -v Simple`（空才算干净），
**注释里的旧文件名也要一起改**，否则下次 grep 会以为自己改完了。

### 4.2 成功码不是 200

`getPlanExtraInfo` 的 mock 返回 `code: 0`（python `func/*` 那批的约定）。
断言成功码写 `code === 0 || code === 200`，别凭「若依都是 200」硬写。
另外 `getPlanExtraInfo(planId)` 的入参是 **planId 数组**，不是单个 id。

## 5. 校验

`esp_verify.mjs`（写在 `C:/Users/lenovo/AppData/Local/Temp/`，必须带解析钩子跑）：

```bash
cd "C:/Users/lenovo/AppData/Local/Temp" && \
  node --experimental-loader ./resolve_ext_loader.mjs ./esp_verify.mjs 2>&1 | \
  grep -vE "MODULE_TYPELESS|Reparsing|To eliminate|trace-warnings|ExperimentalWarning|--experimental-loader|Custom ESM Loaders|^--import"
```

六段：A SFC 编译（10 个）/ B JS 语法（14 个）/ C 零共享扫描 / D 纵向几何（真实数据 21 条流、210 节点、53 并行组）/
E 与横向版对照（纵向 `H>W` vs 横向 `W>H`）/ F mock 链路 + 路由菜单 + expand 无 fixed /
**H 左右分栏 6:4（编译 SCSS 产物后抠 `.esp-flow` / `.esp-doc` 规则体断言 flex）** /
**I 环境圆点汇总 + 画布自动滚动（2026-09-23 新增，51 条断言：`aggregateTone` 行为、真实数据汇总、
圆点取 `env.tone`、20s 让位、只认输入事件不认 scroll、弹窗抑制、四档优先级且与 `AGG_TONE_PRIORITY` 交叉一致、
`anyDialogOpen` 覆盖 6 个弹窗）**。
**动简版两页任一文件必跑**，期望 `FAILURES: 0`。

⚠️ 真实数据里有 1 条**空流**（节点尚未生成）：`layoutFlow([], [])` 返回全 0 空布局，
页面显示「编排实例已创建，节点尚未生成」占位 —— 断言要跳过它，别当成几何 bug。
