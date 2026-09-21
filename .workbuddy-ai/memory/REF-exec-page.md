# REF — 执行页面（execPage）：布局 / 轮询 / 进度条 / 字典 / 菜单 / 节点操作

> 从 `MEMORY.md` 拆出来的独立参考（主文件超限被截断过）。
> **动手改 `views/tool/execPage/**`、`execPlan.js` 或它们的接口前先读这里。**
> 「查看明细」弹窗见 `REF-exec-detail.md`；项目通用约定见 `MEMORY.md`。

## 布局与滚动
- 布局引擎 `flowLayout.js`：**纯函数、无 Vue 依赖、可 node 单测**。`layoutFlow` 几何**只能依赖 nodes/relations，不能依赖 `aniStatus`**。
- **横向滚动在每条流内部**（`.exec-flow__canvas` 的 `overflow:auto`），**不在** `.exec-page__body`（那里 `overflow-x:hidden`）。
  所以 `.exec-flow` / `.exec-flows` 都是 `width:100%` + stretch，**不能改回 `max-content`**（会把页面撑出横向滚动条）。
  头部不在滚动容器内 → `head-inner` 的旧 `sticky` 已移除。流头部是 flex 两栏：左 `head-main`(`flex:1;min-width:0`)、右 `btns`(`flex:none`)。
- **页头三栏**：标题 / `.exec-progress` 总体进度 / `.exec-page__actions`。中间那栏 `flex:1 + max-width:560px`，header 保持 `space-between`
  （原来的「N 个 ID」「状态字典 15 项」两块**已删**，连带 `dictReady`/`dictCount`/`dictChip` computed 和 `.exec-page__ids`/`.exec-dict` 样式）。
- 并行组时间：跨组 `from.aniEndTime <= to.aniStartTime`；组内同时执行（**别断言完全相等**）。

## 轮询（3s）
- 必须**静默**：只用 `refreshing`，**绝不置 `loading`**。
- **操作成功后必重置轮询**：stopPolling → fetchAll(silent) → startPolling；失败 catch **不**重置（旧定时器还在跑）。
  否则旧定时器跟新数据并发触发闪烁。

## 页头「总体进度」
- `results[]` 里每个 plan 的 **`data.finishedNodeNums` / `data.totalNodeNums`**（顶层字段）**各自求和后**再除，
  **`Math.floor`**（宁可少报 1%，也不能没跑完就显示 100%），夹 0~100。
- helper `toCount()` 把缺失/字符串/NaN/负数一律按 0（**一个 NaN 会让 `width:NaN%` 整块消失**）。
- **波浪常驻动效**（用户要求「不动时也要有动效」）：两层 SVG 波面 data URI 靠 `background-position` 位移，
  **位移距离必须正好 = `background-size` 宽（120px）**，否则循环接缝会跳；**别加 `animation-play-state: paused`**。
  `.is-back` 只覆盖 `background-image`/`animation`，`background-size` 在共享的 `.exec-progress__wave` 上（产物里只 1 处）。
- **文字跨进度边界「左白右灰」**：同一句「总体进度 N%」渲染**两层**，上层白字用
  `:style="{ clipPath: 'inset(0 ' + (100-pct) + '% 0 0)' }"` 裁剪 —— 不用知道 track 的 px 宽，也不会像「塞进 fill 里」那样被窄进度截断。

## 字典与配色
- 两套状态字典**不要合并**：
  `release_execute_status_no_css`（15 条，执行页面，`css_class`/`list_class` **全留空**）；
  `release_execute_status`（13 条，`dict_id=104`，明细弹窗，**必须填 `list_class`**）。SQL 在 `sql/release_execute_status_dict.sql`。
- **SVG 箭头颜色不能用内联 `:fill`**，必须靠 class 让 CSS 出 `fill`。

## 节点右键菜单 / 双击
- 菜单项**完全由 `aniStatus` 决定**，唯一判定处 `execPage/nodeMenu.js`（`buildNodeMenu`）。
  **菜单不存节点快照**：`menu` 只存 `{planId, flowKey, nodeId}`，`menuNode` 每次从最新 `flows` 重查。
- 浮层 `position: fixed`；关闭监听的 `scroll` 必须 capture；节点选中态用 `outline` 不用 `box-shadow`。
- 双击分流**唯一判定处** `execPage/nodeKind.js`（`isHumanConfirmNode`）：人工确认 → `AtomConfirmDialog.vue`，
  其余 → 与右键「查看明细」**同一条路**。FlowGraph 只报事件。
- **坑：`FlowGraph.vue` 里另有一个同名 `nodeKind()` computed**。查「双击有没有做类型判断」必须只抠 `onNodeDblclick` 方法体。
- 判节点类型用**英文** `aniInstanceNodeType.includes('HUMAN_CONFIRM')`；判**原子名**才用中文 `includes('人工确认')`。**不能混用**。
- 挂 `dblclick` 必须给 `.flow-node` 加 `user-select: none`；人工确认的 domurl 单独 `user-select: text`。
- `isProjectRoleDisable`：角色从 **`state.user.roles`** 取，命中 `PROJECT_ROLE_KEYS=['project_role']`。
  命名坑：返回的是「**用户是**项目角色」。

## 节点 / 流操作（页面级接口）
- **静默**：`POST /python/api/func/funcAddNodeDelayParams` + `{delayMin, nodeId, planId}`。值存 `aniNodeParams`。
  唯一判定处 `execPage/nodeParams.js`。`delayMin<=0` 移除 `noticeDelay` 整项；`Number('')===0` 坑。
- **节点 / 流 暂停/取消/恢复** operation ∈ `STOP`/`CANCELLED`/`RECOVER`（**RECOVER 映射 RUNNING**）：
  节点走 `POST /release/executeIndex/updateNodeStatus` + `{aniInstanceNodeId}`；
  流走 `POST /release/executeIndex/updateWorkflowStatus` + `{awiWorkflowInstanceId}`。
  分别共用 `submitNodeStatusAction` / `submitWorkflowStatusAction`。
  流按钮在流头部 `btn-area`，按 `awiWorkflowStatus` 显隐：**取消**（INIT/READY）/**暂停**（RUNNING）/**恢复**（STOP）。
- **消息推送**：`getPlanExtraInfo` 查，`setNodeFinishSms` 设。`planId` 传本页全部 aripExecPlanId 数组；`'Y'`/`'N'`。
- **修改实施人**：查 `GET /system/user/listAll`（成功码 **200**）；提交 `POST /python/api/cicd/changeExecUser`，
  入参 `{orderId: String[], user(登录名), username(中文名), updateBy(state.user.name)}`。
- **函数批量跳过**（明细弹窗右上角按钮）：`POST /python/api/func/multiAtomFuncSkip` +
  `{atomIdList, functionSelList, selectAll, oneKeyJumpFlag:'Y'}`。
  **`functionSelList` 是 (atomId, funcName) 的笛卡尔积过滤后产物**（用户各选原子 + 各选函数，再按"该原子真有此函数"过滤；同名跨原子产多条）。
  成功后走 `@refresh-with-loading` 重新拉明细（带 loading；原子级确认/跳过仍走 `@refresh` 不切 loading —— 不要混）。
- **状态覆盖表同构**（mock）：`_demoNode.js` / `_demoWorkflow.js`，都必须在 `getExecuteIndex` 的 demoTick **之后** apply
  （否则被推回剧情，「操作 1 秒后又变了」）。批量跳过也走 `patchFuncStatus` —— 同 `updateFunctionStatus` 的覆盖表机制（`FUNC_STATUS_OVERRIDE`）。
