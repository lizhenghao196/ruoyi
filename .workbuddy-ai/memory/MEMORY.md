# MEMORY.md — 项目长期备忘（RuoYi-Vue 工作台）

> 只留「不知道就会做错」的东西。历史见 `2026-09-*.md`，明细弹窗接口见 `REF-exec-detail.md`。

## 关键约定

- 新页面 = `views/tool/<name>/index.vue` + `api/tool/<name>.js` + `sql/<name>_menu.sql`；菜单走数据库动态路由，**不写** `router/index.js`。
- Mock 放 `ruoyi-ui/mockData/res.js`；演示数据造在 `api/tool/_demo*.js`。
- **execPage/execPlan 的 mock/真实 总开关**：`api/tool/_mockFlag.js` 的 `USE_MOCK`（一处生效，覆盖两个页面）。
  结构：`execPlan.js` = 真实接口 + `if (USE_MOCK) return mockApi('x', 参数)` 分发 + 契约文档；
  `_mockApi.js` = 全部 mock 实现（同名函数）+ 内部 helper，由 `mockApi()` **动态 import** 按需加载；
  `_demo*.js` 照旧是数据/覆盖表。`DEMO_TICK_ENABLED = USE_MOCK`。
  接真实接口 = 把 `USE_MOCK` 改 false（mock 层就不会被加载），确认后删 `_mockApi.js` + `_demo*.js` + `mockData/res.js`
  和 execPlan.js 里每个函数的 `if (USE_MOCK) {...}` 三行。**改 execPlan.js 必跑 `test_mock_switch.mjs`**。
  纯前端函数（`pickExecPlanIds` / `isSmsSendOn` / `getExecuteIndexBatch` / 常量）不挂开关。
- ⚠️ **api 层 import 结构一变，一批校验脚本会挂**：`execPlan.js` 现在静态 import `@/utils/request`
  （axios+element-ui+vuex，node 加载不了）。校验 loader 已加 `@/utils/request` → 内联桩；
  另有一类脚本「把 api 源码抠到 Temp 跑」（`test_flow` / `check_exec2`）需同步替换相对 import。详见技能 §10.1 / §13.7。
- **`code: 0` 能过拦截器是巧合**（`utils/request.js` 是 `res.data.code || 200`）。python `func/*` 成功码就是 0，**别判 `code === 200`**，只判 `data` 里有无要的字段。
- **`queryAotmOfNode` 返回的 `functions[]`，中文名字段是 `funcChName`（Ch = Chinese），不是 `funcCnName`** ——
  明细弹窗「函数」列取的就是它，写错**那一列静默变空、零报错**。改这个字段名要**四处一起改**：
  组件模板（`AtomDetailDialog.vue`）/ mock 投影（`_demoAtom.js` 的 `toFunctionRow`）/
  `execPlan.js` 的字段文档 / 校验脚本（`test_atom_detail.mjs` 的 `KEYS`、`test_atom_dialog.mjs` 的模板断言）。
  已加反向断言「不许出现 funcCnName」钉住拼写。⚠️ 断言前要剥注释（含模板 `<!-- -->`），
  否则自己留的警告注释会让这条断言假红。
- **取载荷一律走 `pickPayload(res)`**（`api/tool/execPlan.js` 导出）：接口的载荷**可能在 `data`、也可能在 `rows`**。
  规则：`data` 非 undefined/null 就用它（**`[]` / `''` / `0` / `false` 都算有值，别用 `||` 判**），否则用 `rows`，都没有才 null。
  页面里**不许再出现裸的 `res.data` / `res.rows`**（`test_res_payload.mjs` 会断言数量为 0）。
  `execPage/index.vue` 的 `fetchAll` 是**唯一归一化入口**（`data: pickPayload(item)`），下游 `mergeWorkflows` / 总体进度只读 `item.data`。
  文案类字段（如 `changeExecUser` 的提示）**只认字符串**，防止 rows 里回对象时 `$modal` 显示成 `[object Object]`。
- `window.open` 新标签页：必须**先同步** `window.open('', '_blank')` 占位，再 `tab.location.replace(...)`。

## 执行页面（execPage）

- 布局引擎 `flowLayout.js`：**纯函数、无 Vue 依赖、可 node 单测**。
- 轮询（3s）必须**静默**：只用 `refreshing`，**绝不置 `loading`**。`layoutFlow` 几何**只能依赖 nodes/relations，不能依赖 `aniStatus`**。
- 并行组时间：跨组 `from.aniEndTime <= to.aniStartTime`；组内同时执行（**别断言完全相等**）。
- **轮询启停**：操作成功后**立即 stop → 重新拉数据 → start**（否则旧定时器跟新数据并发触发闪烁）。
- **横向滚动在每条流内部**（`.exec-flow__canvas` 的 `overflow:auto`），**不在** `.exec-page__body`（那里 `overflow-x:hidden`）。所以 `.exec-flow` / `.exec-flows` 都是 `width:100%` + stretch，**不能改回 `max-content`**（会把页面撑出横向滚动条）。头部不在滚动容器内 → `head-inner` 的旧 `sticky` 已移除。流头部是 flex 两栏：左 `head-main`(`flex:1;min-width:0`)、右 `btns`(`flex:none`)。
- **页头三栏**：标题 / `.exec-progress` 总体进度 / `.exec-page__actions`。中间那栏 `flex:1 + max-width:560px`，header 保持 `space-between`（原来的「N 个 ID」「状态字典 15 项」两块**已删**，连带 `dictReady`/`dictCount`/`dictChip` computed 和 `.exec-page__ids`/`.exec-dict` 样式）。
- **总体进度**：`results[]` 里每个 plan 的 **`data.finishedNodeNums` / `data.totalNodeNums`**（顶层字段）**各自求和后**再除，**`Math.floor`**（宁可少报 1%，也不能没跑完就显示 100%），夹 0~100；helper `toCount()` 把缺失/字符串/NaN/负数一律按 0（一个 NaN 会让 `width:NaN%` 整块消失）。
- **波浪常驻动效**（用户要求「不动时也要有动效」）：两层 SVG 波面 data URI 靠 `background-position` 位移，**位移距离必须正好 = `background-size` 宽（120px）**，否则循环接缝会跳；**别加 `animation-play-state: paused`**。`.is-back` 只覆盖 `background-image`/`animation`，`background-size` 在共享的 `.exec-progress__wave` 上（产物里只 1 处）。
- **文字跨进度边界「左白右灰」**：同一句「总体进度 N%」渲染**两层**，上层白字用 `:style="{ clipPath: 'inset(0 ' + (100-pct) + '% 0 0)' }"` 裁剪 —— 不用知道 track 的 px 宽，也不会像「塞进 fill 里」那样被窄进度截断。

## 字典与配色

- 两套状态字典**不要合并**：`release_execute_status_no_css`（15 条，执行页面，`css_class`/`list_class` **全留空**）；`release_execute_status`（13 条，`dict_id=104`，明细弹窗，**必须填 `list_class`**）。SQL 在 `sql/release_execute_status_dict.sql`。
- **SVG 箭头颜色不能用内联 `:fill`**，必须靠 class 让 CSS 出 `fill`。

## 节点右键菜单 / 双击

- 菜单项**完全由 `aniStatus` 决定**，唯一判定处 `execPage/nodeMenu.js`（`buildNodeMenu`）。**菜单不存节点快照**：`menu` 只存 `{planId, flowKey, nodeId}`，`menuNode` 每次从最新 `flows` 重查。
- 浮层 `position: fixed`；关闭监听的 `scroll` 必须 capture；节点选中态用 `outline` 不用 `box-shadow`。
- 双击分流**唯一判定处** `execPage/nodeKind.js`（`isHumanConfirmNode`）：人工确认 → `AtomConfirmDialog.vue`，其余 → 与右键「查看明细」**同一条路**。FlowGraph 只报事件。
- **坑：`FlowGraph.vue` 里另有一个同名 `nodeKind()` computed**。查「双击有没有做类型判断」必须只抠 `onNodeDblclick` 方法体。
- 判节点类型用**英文** `aniInstanceNodeType.includes('HUMAN_CONFIRM')`；判**原子名**才用中文 `includes('人工确认')`。**不能混用**。
- 挂 `dblclick` 必须给 `.flow-node` 加 `user-select: none`；人工确认的 domurl 单独 `user-select: text`。
- `isProjectRoleDisable`：角色从 **`state.user.roles`** 取，命中 `PROJECT_ROLE_KEYS=['project_role']`。命名坑：返回的是「**用户是**项目角色」。

## 节点操作（页面级接口）

- **静默**：`POST /python/api/func/funcAddNodeDelayParams` + `{delayMin, nodeId, planId}`。值存 `aniNodeParams`。唯一判定处 `execPage/nodeParams.js`。`delayMin<=0` 移除 `noticeDelay` 整项；`Number('')===0` 坑。
- **节点 / 流 暂停/取消/恢复** operation ∈ `STOP`/`CANCELLED`/`RECOVER`（**RECOVER 映射 RUNNING**）：节点走 `POST /release/executeIndex/updateNodeStatus` + `{aniInstanceNodeId}`；流走 `POST /release/executeIndex/updateWorkflowStatus` + `{awiWorkflowInstanceId}`。分别共用 `submitNodeStatusAction` / `submitWorkflowStatusAction`。流按钮在流头部 `btn-area`，按 `awiWorkflowStatus` 显隐：**取消**（INIT/READY）/**暂停**（RUNNING）/**恢复**（STOP）。
- **成功后必重置轮询**：stopPolling → fetchAll(silent) → startPolling；失败 catch **不**重置（旧定时器还在跑）。
- **消息推送**：`getPlanExtraInfo` 查，`setNodeFinishSms` 设。`planId` 传本页全部 aripExecPlanId 数组；`'Y'`/`'N'`。
- **修改实施人**：查 `GET /system/user/listAll`（成功码 **200**）；提交 `POST /python/api/cicd/changeExecUser`，入参 `{orderId: String[], user(登录名), username(中文名), updateBy(state.user.name)}`。
- **函数批量跳过**（明细弹窗右上角按钮）：`POST /python/api/func/multiAtomFuncSkip` + `{atomIdList, functionSelList, selectAll, oneKeyJumpFlag:'Y'}`。**`functionSelList` 是 (atomId, funcName) 的笛卡尔积过滤后产物**（用户各选原子 + 各选函数，再按"该原子真有此函数"过滤；同名跨原子产多条）。成功后走 `@refresh-with-loading` 重新拉明细（带 loading；原子级确认/跳过仍走 `@refresh` 不切 loading —— 不要混）。
- 项目角色（`isProjectRoleDisable` 真）→ **右键菜单只读**。
- **状态覆盖表同构**（mock）：`_demoNode.js` / `_demoWorkflow.js`，都必须在 `getExecuteIndex` 的 demoTick **之后** apply（否则被推回剧情，「操作 1 秒后又变了」）。批量跳过也走 `patchFuncStatus` —— 同 `updateFunctionStatus` 的覆盖表机制（`FUNC_STATUS_OVERRIDE`）。

## 「查看明细」弹窗

**改 `AtomDetailDialog.vue` 前先读 `REF-exec-detail.md`**。三条：① 字段前缀是 **`aai*`**，**接口不改名**；② 弹窗是哑组件，**不自己调接口、不本地改 `atoms`**；③ mock 改了页面读不到，必须用 `_demoAtom.js` 模块级覆盖表。

- **⚠️ 有 `type="expand"` 的表，任何列都不能加 `fixed`**（左固定也一样）：Element 2.15.14 的 `wrappedRowRender()` 不判 `this.fixed`，展开行（连同内层「所属函数列表」）会被复制进 `.el-table__fixed-right` 那个 `position:absolute`、**不跟横向滚动**的白底层 → 内层「跳过/执行」被钉在右边不动，看着像「操作列被分成两列」。外层「操作」列的 `fixed="right"` **已去掉**，原位留了警告注释，别加回来。守它的脚本：`check_fixed_expand.mjs`。
- **一键跳过失败函数**（右上角第二个按钮，紧挨「函数批量跳过」）：`POST /python/api/func/funcSkip` + `{nodeId: aniInstanceNodeId, funcName}`。`nodeId` 是**节点** id（不是原子 id）—— 与批量跳过的 `atomIdList` 区分。成功后走 `@refresh`（**不带** loading；批量跳过那条才是 `refresh-with-loading`，别混）。
- 选项列表 **`filedFncList`（命名沿用用户截图，是 `filed` 不是 `failed`，别"顺手改顺"）**：在 `watch.atoms` 里用 `buildFiledFncList` 构建，规则 `aaiAtomStatus==='FAILED' && fn.status==='FAILED'`，按 funcName 去重（跨原子/同原子都去，保留首次）。
- ⚠️ mock 坑：`buildAtomRes` 的规矩是「**非 RUNNING 原子下，所有函数 status = 原子 aaiAtomStatus**」（除非被 `setFuncStatusOverride` 单独覆盖）。所以把原子标 FAILED，该原子**所有**函数都进 filedFncList —— 这是 mock 简化，**不是**真实接口行为，别去"补"独立 FAILED。
- ⚠️ mock 坑：判「这个函数算不算失败」**必须走 `buildAtomRes({atoms:[atom]})` 读投影后的 status**，不能直接 `JSON.parse(aaiInstanceFunctionName)` 读 —— 覆盖表不在原始字符串里，直接读会把"已被 setFuncStatusOverride 标 FAILED"的函数漏掉（第一版就栽在这）。
- **自动刷新（「刷新 / 停止刷新」按钮，在「一键跳过失败函数」右边）**：定时器**在 index.vue 里**（`DETAIL_POLL_INTERVAL=5000` / `detailTimer` / `detailAutoRefresh` / `detailRefreshing`），弹窗只 `$emit('toggle-auto-refresh')` + 用 prop `autoRefreshing` 显示文案。销毁点三处：`closeDetail()`（**在早退判断之前**）、`beforeDestroy()`、tick 里「弹窗已关」兜底。tick 走 `reloadDetailAtoms({withLoading:true})`。刷新按钮**刻意不 disabled**（否则 loading 期间停不掉），显示条件 `atoms.length || autoRefreshing`（原子刷空了按钮也不能消失）。展开保持靠 `reapplyExpand()`：`expandRowKeys = expandRowKeys.slice()` 换引用，强制 Element 用新数据重建展开行。

## 前端校验

`cd C:/Users/lenovo/AppData/Local/Temp && node --experimental-loader ./resolve_ext_loader.mjs ./test_xxx.mjs`。方法论见用户级技能 `ruoyi-ui-node-verify`。

## 协作

- 不自动跑构建；纯前端改动无需构建。后端 `java -jar` 改动需重构建+重启，**须先说明并等用户明确要求**。后端工具链 `C:\Users\lenovo\.codex\tools\ruoyi-vue`（jdk17/maven-3.9.16/redis-5.0.14.1）。
- 指出差异时**先复述对方意图**，再讲「在什么输入下达不到该意图」。
