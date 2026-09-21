# REF — 「查看明细」弹窗：接口 / 字段 / 坑（按需查阅）

> 从 `MEMORY.md` 拆出来的独立参考：这一节占了主文件一半篇幅，拆开是为了让 MEMORY.md 不再超限被截断。
> **动手改 `execPage/components/AtomDetailDialog.vue` 或它的接口前，先读这里。**
> 其余章节（项目约定、执行页面布局、字典配色、右键菜单、节点静默、校验方式）仍在 `MEMORY.md`。

## 「查看明细」：接口 + 弹窗
- `POST /release/executeIndex/queryAotmOfNode` + `{ aniInstanceNodeId }`（**`Aotm` 是后端原本拼写，别改成 `Atom`**）→ `{ msg, code, data: [...] }`，**`data` 是数组**。
- **⚠️ 返回字段前缀就是 `aai*`，与节点自带 `node.atoms[]` 同形，接口不改名。** 踩过大坑：把示例读成 `ani*`，做了一整套改名层还编出「末尾大写 T」这种不存在的陷阱 —— 全是幻觉，用户要求返工。**教训**：字段名靠 `grep -o 'aai[A-Za-z]*' ruoyi-ui/mockData/res.js | sort -u` 认，不靠眼睛；**目标名在项目数据里零命中、只出现在自己新建的文件里，就是红灯。**
  - 16 个 `aai*` 清单见 `_demoAtom.js` 顶部注释（`aaiAtomPlanStarttime` **末尾小写 `t`**）；相对节点只多 `functions[]` / `totalFunctionCount` / `failedFunctionCount`。`aaiAtomConfig` / `aaiAtomFuncStatus` / `aaiInstanceFunctionName` / `aaiRetryTimes` **都是字符串化 JSON**，用前安全解析。
- `AtomDetailDialog.vue` 是**哑组件**：数据全部来自接口、不从节点 `atoms[]` 取；不自己调接口、不本地改 `atoms`；失败**保留弹窗** + `error` 文案；是**快照**、不跟轮询联动。**13 列结构与各列宽度/prop 以 `test_atom_dialog.mjs` 的 `[1.5]` 断言为准**，取数方法每个都要留兜底。
  - 展开行按原子类型分流，用 `isHumanConfirmRow(row)`（与 `canConfirm` 共用同一个 `isHumanConfirm`）：人工确认类给「人工确认描述」+ 节点 **`aniNodeDomurl`**（computed `selfDesc`，来自**节点**、整个弹窗同值；mock 210 个节点只有 1 个带值）；其余给「所属函数列表」内层表格（7 列见 `[1.5]`）。取值 `retryTimes(外层原子, 函数行)` / `planExecuteTime(外层原子, 函数行)`，模板内层作用域叫 `fn`（外层 `scope`，别重名遮蔽）。
    - 取值方法**只读、不修改原对象**。`planExecuteTime` 参考实现 `JSON.parse(JSON.stringify(x))` 的**意图是深拷贝再读**（不是写错），但 `JSON.stringify` 对字符串输入只是加引号 → 往返后还是字符串 → 那列空；本项目 `aaiAtomFuncStatus` 239 条**全是字符串**，所以直接解析一次，**两种形态都要能吃**。
    - **【新】标记**：点过「最新结果」/「执行」的函数行打红【新】+ 整行高亮，**让用户关掉弹窗回到表格后还能认出刚点的是哪一条**。**两处写入**（`uniqueInfo` 的 `flag === 'result'` 分支、`submitFn('run')`），都是**赋值**不是 push（后点覆盖先点，同时只有一行带标记），跨展开/收起保留、**明细弹窗重开清空**、请求失败**不写**（不留假标记）。key = `String(aaiInstanceAtomId) + String(函数下标)`。行高亮走 `fnRowClassName(atomRow)`（`row-class-name` 回调拿不到外层原子，所以「传原子返回函数」闭包进去）。
      - ⚠️ **红色样式 grep `add-fn__new` 搜不到**：SCSS 是 `&-fn { &__new { color: #f56c6c } }` 嵌套写的。**判断「样式在不在」必须编译 SCSS 查产物**（踩过：搜不到就以为没写，差点重复加一遍）。
      - 「最新结果」弹窗比另外两个宽：`width="70%"` + `custom-class="add-result-dialog"`（带 `max-width: calc(100vw - 40px)` 兜底）—— 里面有 side-by-side 的 diff，50% 太窄。
      - **三个结果弹窗的 UI 约定**（2026-09-17 用户要求，改这里别改回去）：
        ① 操作列按钮文案是「最新结果 / **历史结果** / 日志」—— **不是「日志历史结果」**（旧文案，已改）；
        ② 弹窗里的 tag 一律**靠左**：`.el-tag-title` 与 `.no-result` 都是 `justify-content: flex-start`
           （原来两个都是 `center`），且都在 **scoped** 块里（只影响本组件）；
        ③ 每个 tag 都**显式写 `size="medium"`** —— `el-tag` 的 `tagSize()` 是
           `this.size || (this.$ELEMENT || {}).size`，而 `main.js` 是
           `Vue.use(Element, { size: Cookies.get('size') || 'medium' })`，
           **导航栏的「布局大小」选择器会改这个 cookie** —— 不写 size 就会被带成 mini。
           展开行那两个 tag（`add-expand__tag`）**不在本次范围**，仍没写 size。
      - **`functions[].manual` 是 mock 编的字段**（真实值由后端函数字典下发），`_demoAtom.js` 的 `manualOf` 按函数名稳定分桶：约 1/4 为 `'N'`（「执行」置灰）、其余 `'Y'`。**曾固定写 `'N'` → 所有执行按钮全灰、功能看着像没做**（用户反馈过）。
    - **函数级操作（三个）**：跳过 `POST /release/executeIndex/updateFunctionStatus` + `{ aaiInstanceAtomId, operation:'SKIP', functionName, functionType }`；**结果确认走同一个接口，只有 `operation` 不同（`'CONFIRM'`）** —— 参考实现里两个 api 就是同一个函数；执行 `POST /python/api/func/manual` + `{ funcName, atomId }`（**不带 aai* 前缀**）。三者共用 `submitFn`：调接口 → `$message.success` → **`$emit('refresh')` 让父组件重拉明细**；loading 精确到「哪一行的哪个函数」（`fnSubmitting` + `isFnLoading`）。`operation` 走 `FN_OPERATION = { skip:'SKIP', confirm:'CONFIRM' }` 映射。
      - **⚠️ 函数级操作没有「是不是指派人」这层判断**（2026-09-17 用户要求删掉）：原来的 `if (this.isDisable)` + prop + 页面 `isNotAssignee` computed 已**整条链路删除**。**别照参考实现加回来**。
      - mock 的 `updateFunctionStatus` operation → 目标状态走 `FUNC_OP_TO_STATUS`（`SKIP→SKIP`、`CONFIRM→SUCCESS`）；**`CONFIRM→SUCCESS` 是演示推断**（参考实现没说确认后落到哪个状态），不加状态原地不动、看着像没生效。
    - **最新结果 / 历史结果 / 日志**：共用 `uniqueInfo(flag, row, outerRow, scope)`，flag = `'result' | 'history' | 'log'`；接口 `POST /release/executeLog/getUniqueInfo` + `{ aelInstanceAtomId, aelFunctionName }`（**入参键名是 `ael*`，值取原子的 `aaiInstanceAtomId`，别顺手改成 aai**）→ `data` 里三个**字符串化 JSON**（`aelMessage` / `aelAtomExecuteResult` / `aelAtomExecuteHisResult`）。`post_content.executeResultFlag === 'Y'` 才出表格（`aggregateByCmd` 按 `cmd` 分组 → `el-tabs`），否则 JsonViewer 预览。没数据按 flag 提示（参考实现**不提示** → 用户以为点了没反应）。
      - `aggregateByCmd` 的参考截图**压缩成一行**、逐字还原不了，按「按 cmd 分组 → `{ cmd, data: [{ getresult:{header,row}, idc, … }] }`」重写。输入是 `post_content.getresult`（**不是 executeResult**），`getresult.rowList` **第 0 行是表头**。**行对象的键与列 `prop` 必须统一走 `colProp()`（去掉 `.`）**，否则 `MODULE.NAME` 整列空。
      - `vue-code-diff@1.2.0` 导出的是**插件**（不是组件），只能 `Vue.use` 注册成全局 `<code-diff>`。真正认的 prop 只有 `oldString / newString / context / outputFormat / drawFileList / renderNothingWhenEmpty / diffStyle / fileName / isShowNoChange` —— 参考实现的 `trim` / `show-change` 是空操作。它的 main 是 `/dist/vue-code-diff.js`（**畸形路径**），node resolve 处理不了 → 校验脚本必须换桩。
  - **⚠️「人工确认」两个关键字别合并**：判**原子名**用中文 `includes('人工确认')`（真实原子叫 `人工确认_变更审批`，严格相等匹配不上）；判**节点类型**用英文 `HUMAN_CONFIRM`。拿中文去判节点类型**永远为假、毫无报错**。
  - 操作列：`canConfirm` = 人工确认原子 + **非**项目角色；`canSkip` = **任何原子都可以**，只排除已 `SUCCESS`；`isConfirmDisabled` 三条（节点 `CANCELLED` / 原子 `SUCCESS` / 节点 `INIT`）。坑：`canSkip` 曾把 `projectRoleDisabled` 写成**必要条件**，而 `PROJECT_ROLE_KEYS` 是空数组 → 恒 false → 「空数组=不限制角色」被读成「谁都不能跳过」，且无报错。**「不限制」的开关不能写成必要条件**。
  - 原子级两接口别混：确认完成 `PUT /release/atomInstance` + `{ aaiInstanceAtomId, aaiAtomStatus:'SUCCESS' }`；跳过 `POST /release/executeIndex/updateAtomStatus` + `{ aaiInstanceAtomId, operation:'SKIP' }`。链路：弹窗 `$confirm` → `$emit('confirm'|'skip', { row, par })` → 父组件 `submitAtom` → `$modal.msgSuccess` → `reloadDetailAtoms()`。loading 走 prop `submitting`，`submitAtom` 开头挡并发。
  - `queryAotmOfNode` 调用收敛在父组件 **`fetchDetailAtoms(nodeId, node)`**（唯一入口，`console.log(res)` 写在这里 —— 用户要求保留、**不许 stringify**）；`actNodeDetail`（开弹窗）与 `reloadDetailAtoms`（只刷表格）都走它。
  - **⚠️ mock 大坑：改原始数据页面读不到。** `getExecuteIndex` 每次 `JSON.parse(JSON.stringify(res))` **深拷贝**给页面 → 页面节点与 `executeResMap` 里的**不是同一批对象**，mock 只改原始数据表现为「提示成功但状态没变」。解法：`_demoAtom.js` 模块级覆盖表 `ATOM_STATUS_OVERRIDE` / `FUNC_STATUS_OVERRIDE`。**自查**：mock 改了数据界面没变 → 先确认页面拿的是不是深拷贝副本。


## 弹窗头部：自动刷新（刷新 / 停止刷新）

- 头部按钮自左向右：**函数批量跳过 → 一键跳过失败函数 → 刷新/停止刷新 → 「刷新中...」**（黄色呼吸）。
- **定时器不在弹窗里**：在 `index.vue`（`DETAIL_POLL_INTERVAL` / `detailTimer` / `detailAutoRefresh` /
  `detailRefreshing`），弹窗只 `$emit('toggle-auto-refresh')`，文案跟 prop `autoRefreshing` 走。
  改「刷新相关」先想清楚改的是哪一侧 —— 往弹窗里塞 `setInterval` 会破坏哑组件契约（有断言钉住）。
- 刷新时带 loading（`reloadDetailAtoms({withLoading:true})`），**展开状态由 `reapplyExpand()` 保持**：
  `watch.atoms` 里把 `expandRowKeys` 换成新数组引用，强制 Element 的 `setExpandRowKeys` 用新数据重建。
- 刷新按钮**不写 disabled**：自动刷新期间表格一直 loading，按钮必须还能点（用来停表）。
- 校验脚本 `test_detail_refresh.mjs`（模板接线 / SCSS 产物 + scoped keyframes 改名一致性 /
  脚本结构 / 弹窗运行时展开保持 / 页面运行时定时器生命周期）。


## 两条「不知道就会做错」的硬约束

### 1. `funcChName` 的拼写（Ch，不是 Cn）

`queryAotmOfNode` 返回的 `functions[]` 里，中文名字段是 **`funcChName`**（Ch = Chinese），**不是 `funcCnName`**。
明细弹窗「函数」列取的就是它 —— 写错**那一列静默变空、零报错**。

改这个字段名要**四处一起改**：
`AtomDetailDialog.vue` 组件模板 / `_demoAtom.js` 的 `toFunctionRow` 投影 / `execPlan.js` 的字段文档 /
`test_atom_detail.mjs` 的 `KEYS`。

已加**反向断言**「不许出现 `funcCnName`」钉住拼写。
⚠️ **断言前必须剥注释**（含模板 `<!-- -->`）—— 自己留的警告注释会让这条断言假红。

### 2. 有 `type="expand"` 的表，任何列都不能加 `fixed`

**左固定也一样不行。** Element 2.15.14 的 `wrappedRowRender()` 不判 `this.fixed`：
展开行（连同内层「所属函数列表」）会被复制进 `.el-table__fixed-right` 那个
`position:absolute`、**不跟横向滚动**的白底层 → 内层「跳过/执行」被钉在右边不动，
看着像「操作列被分成两列」。

外层「操作」列的 `fixed="right"` **已去掉**，原位留了警告注释，**别加回来**。
守它的脚本：`check_fixed_expand.mjs`。

