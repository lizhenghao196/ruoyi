import request from "@/utils/request";
import { USE_MOCK } from "./_mockFlagSimple";

/**
 * 执行界面简版接口（execPageSimple 执行页面 + execPlanList 变更计划列表页）
 * ==========================================================================
 * ⚠️ 本文件是 ./execPlan.js 的**独立副本**，只服务 execPlanList / execPageSimple。
 *    用户明确要求「除了 mockData 里的内容，其他组件 / 方法 / 接口一律不许共享」，
 *    所以简版页面**不 import execPlan.js 的任何东西**，两边各自演化 ——
 *    改这里不要顺手去同步 execPlan.js，反之亦然。
 *
 * 演示 / 真实接口的切换
 *   每个函数开头都是同一个套路：
 *
 *     if (USE_MOCK) {
 *       return mockApi('xxx', 参数)   // 走 ./_mockApiSimple.js 里的假数据
 *     }
 *     return request({ ... })        // 走真实后端
 *
 *   开关在 ./_mockFlagSimple.js 的 USE_MOCK，**改一处即整页生效**，不用再注释代码。
 *   mock 实现全部集中在 ./_mockApiSimple.js（按需加载：USE_MOCK 为 false 时不会被加载）。
 *
 * 下面的注释写的都是**真实接口的契约**（路径 / 入参 / 返回 / 已知的坑），
 * mock 特有的说明在 _mockApiSimple.js 里。改一个接口要两个文件一起看。
 * ==========================================================================
 */

/**
 * 变更执行计划的数据结构（与 mockData/res.js 中的 planRes 结构一致）：
 * {
 *   code, msg,
 *   rows: [
 *     {
 *       system: 'ACT',                       // 系统编码
 *       date:   '2026-08-07',                // 执行日期
 *       orders: [ { belong, orderId, env } ],// 工单列表
 *       plans:  [                            // 发布计划（一个环境一条）
 *         { aripExecPlanId, aripExecPlanName, aripExecEnv, aripExecSys, aripExecStatus, ... }
 *       ]
 *     }
 *   ]
 * }
 *
 * 一个系统的同一天会按环境拆成多条计划（prod / sandbox / failover / ITSM），
 * 每条计划对应唯一一个 aripExecPlanId —— 执行页面就是按这个 id 去拉执行详情。
 */

/**
 * 按需加载 mock 实现并调用。
 *
 * 用动态 import：USE_MOCK 为 false 时这一支根本不会执行，
 * _mockApiSimple.js / _demo*Simple.js / mockData/res.js 也就不会被加载
 * （webpack 会把它们切成独立 chunk；编译期常量下这一支应当会被整段消掉，
 *   但这句没实测过 —— 要确认就跑一次 build:prod 看产物）。
 * 首次调用多一次 chunk 下载，之后 webpack 自己缓存，可忽略。
 *
 * ⚠️ 路径必须是 ./_mockApiSimple —— 写成 ./_mockApi 会静默跑起 execPage 那套 mock，
 *    简版页面看着照常工作，但「零共享」就破了（两页共用同一份演示数据与演示状态）。
 *    校验脚本 esp_verify.mjs 的 [C] 段钉住了这一行。
 */
function mockApi(name, ...args) {
  return import("./_mockApiSimple").then((mod) => mod[name](...args));
}

/**
 * 从接口返回里取出「有效载荷」—— 后端这一批接口的返回**不统一**：
 * 有的把数据放在 `data`（python 那批 `func/*`、执行详情、明细、结果），
 * 有的放在 `rows`（若依分页那批，如 `/system/user/listAll`）。
 * 所以页面上取值**一律走这里**，不要再直接写 `res.data` / `res.rows`。
 *
 * 规则（顺序是刻意的，别改成「哪个有值用哪个」的模糊判断）：
 *   1. `data` 不是 undefined / null  → 用 `data`（**空数组 `[]` 也算有值**）
 *   2. 否则 `rows` 不是 undefined / null → 用 `rows`
 *   3. 都没有 → null
 *
 * ⚠️ 判「有没有值」必须用 `!== undefined && !== null`，**不能用 `||`**：
 *    `data: []`（查出来一条都没有，是合法结果）用 `||` 会被判成 falsy 而回落到 rows，
 *    于是「空结果」和「没有 data 字段」两种情况的行为混在一起，排查时看不出来。
 * ⚠️ `data: null` + `rows: [...]` 这种返回要吃得下（`setNodeFinishSms` 的 data 恒为 null），
 *    所以先判 data 再判 rows，而不是「挑一个非空的」。
 * ⚠️ `data: 0` / `data: ''` 也算有值 —— 用 `||` 会把它们漏掉。
 *
 * @param {Object} res 接口原始返回
 * @returns {*} 载荷（可能是对象 / 数组 / 字符串），取不到时 null
 */
export function pickPayload(res) {
  if (!res || typeof res !== "object") {
    return null;
  }
  if (res.data !== undefined && res.data !== null) {
    return res.data;
  }
  if (res.rows !== undefined && res.rows !== null) {
    return res.rows;
  }
  return null;
}

// 变更执行计划默认汇总的系统（按此顺序输出）
export const EXEC_PLAN_SYSTEMS = ["ACT", "DASP", "AUTH"];

/**
 * 获取发布计划列表（planRes 全量）
 *
 * GET /release/plan/list
 * @returns {Promise<{ code, msg, rows }>}
 */
export function getPlanList() {
  if (USE_MOCK) {
    return mockApi("getPlanList");
  }
  return request({
    url: "/release/plan/list",
    method: "get",
  });
}

/**
 * 从发布计划列表中汇总指定系统「所有环境」的 aripExecPlanId
 *
 * 按 systems 的声明顺序遍历，系统内部按环境顺序（即 plans 数组原序）输出，
 * 去重后返回纯数字数组；无计划的系统自动跳过。
 *
 * 纯前端计算，不走接口 —— 与 mock / 真实无关。
 *
 * @param {Array}  rows     planRes.rows
 * @param {Array}  systems  系统编码，默认 ACT / DASP / AUTH
 * @returns {Number[]}      aripExecPlanId 列表
 */
export function pickExecPlanIds(rows, systems = EXEC_PLAN_SYSTEMS) {
  if (!Array.isArray(rows)) {
    return [];
  }
  const ids = [];
  const seen = new Set();
  systems.forEach((system) => {
    rows
      .filter((row) => row && row.system === system)
      .forEach((row) => {
        (row.plans || []).forEach((plan) => {
          const id = plan && plan.aripExecPlanId;
          if (id === undefined || id === null || id === "") {
            return;
          }
          if (seen.has(id)) {
            return;
          }
          seen.add(id);
          ids.push(id);
        });
      });
  });
  return ids;
}

/**
 * 获取单个执行计划的执行详情
 *
 * GET /prod-api/release/executeIndex/{aripExecPlanId}
 * （生产前缀 /prod-api 由 axios baseURL = VUE_APP_BASE_API 拼上，故此处只写 /release/...）
 *
 * 返回：{ msg, code, data }
 *   data = 计划字段（aripExecPlanId / aripExecPlanName / aripExecSys / aripExecEnv /
 *          aripExecStatus / aripExecOrderList / aripExecPlanStart / aripExecPlanEnd ...）
 *        + failedNodeNums / finishedNodeNums / totalNodeNums / workflows
 *
 * workflows 里每个元素是一条流（一个变更单）：
 *   { awiWorkflowInstanceName, awiWorkflowStatus, nodes[], relations[], aniNodeGroup ... }
 * 注意 nodes / relations 都是乱序的，要画图必须先按 relations 拓扑排序。
 *
 * @param {Number|String} aripExecPlanId
 */
export function getExecuteIndex(aripExecPlanId) {
  if (USE_MOCK) {
    return mockApi("getExecuteIndex", aripExecPlanId);
  }
  return request({
    url: "/release/executeIndex/" + aripExecPlanId,
    method: "get",
  });
}

/**
 * 批量获取执行详情：有多少个 aripExecPlanId 就并发调多少次
 *
 * 用 Promise.all 一次性发出全部请求，返回顺序与入参 aripExecPlanId 顺序严格一致。
 * 单个 id 请求失败不会让整批失败（该项以 code=500 + error 形式返回），
 * 因此调用方拿到的数组长度恒等于入参长度，可按下标与 planId 一一对应。
 *
 * `data` 用 pickPayload 归一化 —— 详情有可能落在 `data`、也有可能落在 `rows`，
 * 调用方拿到的 `item.data` 一定是载荷本身（取不到时 null），不用自己再判一次。
 *
 * 纯前端编排（并发 / 容错都在这里做），内部调 getExecuteIndex，mock 与真实共用。
 *
 * @param {Array<Number|String>} aripExecPlanIds
 * @returns {Promise<Array<{ aripExecPlanId, code, msg, data, error }>>}
 */
export function getExecuteIndexBatch(aripExecPlanIds) {
  const ids = Array.isArray(aripExecPlanIds) ? aripExecPlanIds : [];
  return Promise.all(
    ids.map((id) =>
      getExecuteIndex(id).then(
        (res) => ({
          aripExecPlanId: id,
          code: res.code,
          msg: res.msg,
          data: pickPayload(res),
          error: null,
        }),
        (err) => ({
          aripExecPlanId: id,
          code: 500,
          msg: err && err.message ? err.message : "请求失败",
          data: null,
          error: err,
        })
      )
    )
  );
}

/**
 * 设置节点静默（延迟通知）
 *
 * POST /python/api/func/funcAddNodeDelayParams
 * 入参：{ delayMin, nodeId, planId }
 *   delayMin  静默时长（分钟）
 *   nodeId    aniInstanceNodeId
 *   planId    aripExecPlanId
 *
 * 成功后该节点的 aniNodeParams 里会多出 { key: 'noticeDelay', value: delayMin }，
 * 执行页面据此在节点卡片上显示静音图标 + 「已静默 N 分钟」悬停提示
 * （解析规则见 views/tool/execPageSimple/nodeParams.js）。
 *
 * @param {Object} p
 * @param {Number|String} p.planId
 * @param {Number} p.nodeId
 * @param {Number} p.delayMin
 * @returns {Promise<{code, msg}>}
 */
export function addNodeDelayParams({ planId, nodeId, delayMin }) {
  if (USE_MOCK) {
    return mockApi("addNodeDelayParams", { planId, nodeId, delayMin });
  }
  return request({
    url: "/python/api/func/funcAddNodeDelayParams",
    method: "post",
    data: { planId, nodeId, delayMin },
  });
}

/* ------------------------- 设置消息推送 ------------------------- */

/**
 * 消息推送开关的取值：接口用 **字符串 'Y' / 'N'**，不是布尔、也不是 0/1。
 * 这两个常量是「开关 -> 接口值」的唯一来源，别在别处再写一遍裸的 'Y' / 'N'。
 */
export const SMS_SEND_ON = "Y";
export const SMS_SEND_OFF = "N";

/**
 * 接口返回的 `send` -> 开关是否打开。
 *
 * 宽容一点（大小写不敏感、非字符串也吃得下），但**只有 'Y' 算开启** ——
 * 其余（'N' / '' / null / undefined / 脏值）一律当关闭。
 * 反过来「不是 'N' 就当开启」会踩坑：字段缺失时会静默显示成「开启」，
 * 而用户看到的是「我明明没开过」。
 *
 * 纯前端转换，与 mock / 真实无关。
 *
 * @param {*} send 接口返回的 send 字段
 * @returns {Boolean}
 */
export function isSmsSendOn(send) {
  return String(send).toUpperCase() === SMS_SEND_ON;
}

/**
 * 查询变更计划的消息推送状态（「设置消息推送」弹窗打开前**先调它**）
 *
 * POST /python/api/func/getPlanExtraInfo
 * 入参：{ planId: Array<Number|String> }
 *   planId  本页**全部** aripExecPlanId 组成的**数组**（不是单个 id）
 *
 * 返回：{ code: 0, data: { nodeFinishedSms: { groupId, send } }, msg }
 *   send     'Y' 已开启 / 'N' 已关闭（用 isSmsSendOn 判）
 *   groupId  消息推送的群组 ID（0 = 没设过，是合法值不是空值）
 *
 * ⚠️ 入参是**数组**、返回却是**单个对象** —— 后端把这一批计划聚合成一个值给前端。
 *    所以别写成「按 planId 取自己那条」，返回里根本没有 planId。
 * ⚠️ 这个接口成功时 `code` 是 **0**，不是若依惯用的 200。它现在能过 axios 拦截器
 *    是因为拦截器写的是 `const code = res.data.code || 200`（0 是 falsy，回落成 200）；
 *    哪天拦截器改成 `??` 就会把成功当失败。所以**别在调用处判 code === 200**，
 *    只判 data 里有没有 nodeFinishedSms。
 *
 * @param {Array<Number|String>} planId 本页全部 aripExecPlanId
 * @returns {Promise<{code, msg, data}>}
 */
export function getPlanExtraInfo(planId) {
  if (USE_MOCK) {
    return mockApi("getPlanExtraInfo", planId);
  }
  return request({
    url: "/python/api/func/getPlanExtraInfo",
    method: "post",
    data: { planId },
  });
}

/**
 * 设置节点完成的消息推送（「设置消息推送」弹窗点「确定」）
 *
 * POST /python/api/func/setNodeFinishSms
 * 入参：{ planId: Array<Number|String>, sendFlag: 'Y'|'N', groupId: Number }
 *   planId    同 getPlanExtraInfo —— 本页全部 aripExecPlanId 的**数组**
 *   sendFlag  'Y' 开启 / 'N' 关闭（**键名是 sendFlag**，与查询返回的 `send` 不同名）
 *   groupId   群组 ID
 *
 * 返回：{ code: 0, data: null, msg: '成功:更新节点完成的消息通知开关成功' }
 *   ⚠️ 成功时 `code` 同样是 **0**（同 getPlanExtraInfo 的说明）。
 *   data 恒为 null —— 前端拿不到回填值，**要刷新就重新调 getPlanExtraInfo**，
 *   不要在本地把刚提交的值当成已生效（本地改出来的「成功」看不出后端有没有真的落库）。
 *
 * @param {Object} p
 * @param {Array<Number|String>} p.planId
 * @param {String} p.sendFlag 'Y' | 'N'
 * @param {Number|String} p.groupId
 * @returns {Promise<{code, msg}>}
 */
export function setNodeFinishSms({ planId, sendFlag, groupId }) {
  if (USE_MOCK) {
    return mockApi("setNodeFinishSms", { planId, sendFlag, groupId });
  }
  return request({
    url: "/python/api/func/setNodeFinishSms",
    method: "post",
    data: { planId, sendFlag, groupId },
  });
}

/* ------------------------- 修改实施人 ------------------------- */

/**
 * 查询全部用户（「修改实施人」弹窗的「指定用户」下拉）
 *
 * GET /system/user/listAll?pageNum=1&pageSize=1000
 * 返回（若依标准分页）：{ code: 200, msg, total, rows: [ { userId, userName, nickName, ... } ] }
 *   ⚠️ 这是若依的 `/system/*` 接口，成功码是 **200**
 *      （不是 python 那批 `func/*` 的 0，见 getPlanExtraInfo 的说明）。
 *   pageSize 写 1000：这个下拉要能一次列全，不做分页。
 *
 * **为什么放在这个文件里**：它只被 execPage 用（进页面就拉一次，见 index.vue 的
 * fetchUsers）。接真实接口后本函数可以挪去 `api/system/user.js`。
 */
export function listAllUser() {
  if (USE_MOCK) {
    return mockApi("listAllUser");
  }
  return request({
    url: "/system/user/listAll",
    method: "get",
    params: { pageNum: 1, pageSize: 1000 },
  });
}

/**
 * 修改工单的实施人
 *
 * POST /python/api/cicd/changeExecUser
 * 入参：{ orderId: String[], user, username, updateBy }
 *   orderId   工单号**数组** —— 由用户在弹窗里自己填，前端按逗号拆分 + 去重
 *             （见 ExecUserDialog 的 parseOrderIds）
 *   user      选中用户的 `userName`（登录名，如 'qiongpei su'）
 *   username  选中用户的 `nickName`（中文名，如 '苏琼沛'）
 *             ⚠️ 这两个名字**容易搞反**：`user` 是登录名、`username` 才是中文名 ——
 *                与直觉相反，但请求体里就是这样（用户也明确说了），别「顺手改顺」。
 *   updateBy  当前登录用户的 `userName`（= `state.user.name`，用户明确指定）
 *
 * 返回：{ code: 0, data: '<人话>', msg: '成功' }
 *   ⚠️ 成功码是 **0**（同 python 那批接口）。
 *   `data` 是一句可读的结果文案（「…工单实施人更新至xxx成功」），比 `msg` 的「成功」
 *   有用得多，所以提示优先用它（见 index.vue 的 submitExecUser）。
 *
 * ⚠️ 路径里的 `cyc` 段是**照截图逐字抄的**，接真实接口前请核对一遍 ——
 *    这类路径抄错一个字母会 404，而 mock 阶段完全看不出来。
 */
export function changeExecUser({ orderId, user, username, updateBy }) {
  if (USE_MOCK) {
    return mockApi("changeExecUser", { orderId, user, username, updateBy });
  }
  return request({
    url: "/python/api/cicd/changeExecUser",
    method: "post",
    data: { orderId, user, username, updateBy },
  });
}

/**
 * 查询节点下的原子明细（节点右键 ->「查看明细」）
 *
 * POST /release/executeIndex/queryAotmOfNode
 * 入参：{ aniInstanceNodeId }
 *   aniInstanceNodeId  节点的 aniInstanceNodeId（**取当前右键的那个节点的真实值**）
 *   （接口名里的 Aotm 是后端原本的拼写，别顺手改成 Atom）
 *
 * 返回：{ msg, code, data: [atom, ...] }
 *   data 是**数组** —— 一个节点下可能有多个原子（合批场景）。
 *   atom 上这几个字段是**字符串化 JSON**，用之前必须解析：
 *     aaiAtomConfig            原子部署配置（idc / beginTime / module ...）
 *     aaiAtomFuncStatus        每个函数的执行情况 { funcName: { desc, next } }
 *     aaiInstanceFunctionName  函数实例列表（id / status / stepIndex / groupIndex）
 *     aaiRetryTimes            每个函数的重试次数 { funcName: n }
 *   ⚠️ 前缀就是 `aai*`，和节点自带的 atoms[] 完全同形，接口不改名。
 *   （踩过：一度以为接口返回是 `ani*` 前缀，那是把接口文档示例读错了 —— 别按 ani 取字段。）
 *   functions[] 是后端展开好的函数列表，带 funcChName / status / stepIndex / groupIndex 等。
 *   ⚠️ 中文名字段是 **`funcChName`**（Ch = Chinese），**不是 `funcCnName`** ——
 *      明细弹窗「函数」列取的就是它，写成 Cn 那一列会静默变空（没有任何报错）。
 *
 * @param {Object} p
 * @param {Number|String} p.aniInstanceNodeId
 * @param {Object} [p.node] 仅 mock 用：直接传节点对象可省一次查找，真实接口**不发**这个字段。
 *                          必须与 aniInstanceNodeId 指向同一个节点，否则忽略它、退回按 id 查找。
 * @returns {Promise<{code, msg, data}>}
 */
export function queryAotmOfNode({ aniInstanceNodeId, node }) {
  if (USE_MOCK) {
    return mockApi("queryAotmOfNode", { aniInstanceNodeId, node });
  }
  return request({
    url: "/release/executeIndex/queryAotmOfNode",
    method: "post",
    data: { aniInstanceNodeId },
  });
}

/**
 * 执行页面人工类型原子「确认完成」按钮
 *
 * PUT /release/atomInstance
 * 入参：{ aaiInstanceAtomId, aaiAtomStatus }
 *   aaiInstanceAtomId  要确认的那个原子（明细表格里的那一行）
 *   aaiAtomStatus      目标状态；「确认完成」固定传 'SUCCESS'
 *
 * 返回：{ code, msg } —— 前端只关心成功与否，成功后**必须重新拉一次明细**
 * 才能看到新状态（表格数据全部来自 queryAotmOfNode，不在本地改）。
 *
 * ⚠️ 入参字段就是 `aai*` 前缀，和明细接口同形（别按 ani 取）。
 *
 * @param {Object} data
 * @param {Number|String} data.aaiInstanceAtomId
 * @param {String} data.aaiAtomStatus
 * @returns {Promise<{code, msg}>}
 */
export function sureAtomInstance(data) {
  if (USE_MOCK) {
    return mockApi("sureAtomInstance", data);
  }
  return request({
    url: "/release/atomInstance",
    method: "put",
    data: data,
  });
}

/**
 * 原子跳过
 *
 * POST /release/executeIndex/updateAtomStatus
 * 入参：{ aaiInstanceAtomId, operation }
 *   aaiInstanceAtomId  要跳过的那个原子（明细表格里的那一行）
 *   operation          操作类型；「跳过」固定传 'SKIP'
 *
 * 返回：{ code, msg } —— 同 sureAtomInstance，成功后前端要重新拉一次明细。
 *
 * ⚠️ 它和「确认完成」是**两个不同的接口**（路径、方法、入参都不一样）：
 *     确认完成  PUT  /release/atomInstance                + { aaiAtomStatus }
 *     跳过      POST /release/executeIndex/updateAtomStatus + { operation }
 *    别图省事合成一个。
 *
 * @param {Object} data
 * @param {Number|String} data.aaiInstanceAtomId
 * @param {String} data.operation
 * @returns {Promise<{code, msg}>}
 */
export function updateAtomStatus(data) {
  if (USE_MOCK) {
    return mockApi("updateAtomStatus", data);
  }
  return request({
    url: "/release/executeIndex/updateAtomStatus",
    method: "post",
    data: data,
  });
}

/**
 * 最新结果 / 历史结果 / 日志（三个弹窗共用这一个接口，靠前端 flag 区分怎么展示）
 *
 * POST /release/executeLog/getUniqueInfo
 * 入参：{ aelInstanceAtomId, aelFunctionName }
 *   aelInstanceAtomId  原子 id（外层表格那一行；**键名是 `ael*` 不是 `aai*`**，
 *                      值取自原子的 `aaiInstanceAtomId`）
 *   aelFunctionName    函数名（内层表格那一行，= row.funcName）
 *
 * 返回：{ code, msg, data: { aelMessage, aelAtomExecuteResult, aelAtomExecuteHisResult } }
 *   ⚠️ 三个字段都是**字符串化 JSON**，前端拿到后要 JSON.parse 再给模板用。
 *   data 为空 / 缺失时，前端按 flag 提示「暂无最新结果 / 暂无历史结果 / 暂无日志」。
 *
 *   aelAtomExecuteResult.post_content 里：
 *     executeResultFlag  'Y' 才展示执行结果表格
 *     getresult          执行结果原始数据（数组，每项 { cmd, getresult:{rowList,total}, idc, ... }），
 *                        交给组件的 aggregateByCmd 按 cmd 分组
 */
export function getUniqueInfo(data) {
  if (USE_MOCK) {
    return mockApi("getUniqueInfo", data);
  }
  return request({
    url: "/release/executeLog/getUniqueInfo",
    method: "post",
    data: data,
  });
}

/**
 * 函数跳过 / 结果确认
 *
 * POST /release/executeIndex/updateFunctionStatus
 * 入参：{ aaiInstanceAtomId, operation: 'SKIP' | 'CONFIRM', functionName, functionType }
 *
 * ⚠️ 这个接口**被两个操作共用**（参考实现里就是一个 api 函数，上方注释写的
 *     是「// 函数跳过 - 结果确认」），靠 `operation` 区分：
 *       跳过       operation = 'SKIP'
 *       结果确认   operation = 'CONFIRM'
 *
 * ⚠️ 和**原子级**的「跳过」是两个接口，别搞混：
 *     原子跳过  POST /release/executeIndex/updateAtomStatus     + { aaiInstanceAtomId, operation }
 *     函数跳过  POST /release/executeIndex/updateFunctionStatus + { aaiInstanceAtomId, operation, functionName, functionType }
 */
export function updateFunctionStatus(data) {
  if (USE_MOCK) {
    return mockApi("updateFunctionStatus", data);
  }
  return request({
    url: "/release/executeIndex/updateFunctionStatus",
    method: "post",
    data: data,
  });
}

/**
 * 手动执行原子函数
 *
 * POST /python/api/func/manual
 * 入参：{ funcName, atomId }
 *   ⚠️ 这个接口的字段名和别处不一样：是 `funcName` + `atomId`，不带 aai* 前缀。
 *
 * 返回：{ code, msg } —— msg 会被直接弹给用户（见组件里 `$message.success(res.msg)`）。
 */
export function manualFunc(data) {
  if (USE_MOCK) {
    return mockApi("manualFunc", data);
  }
  return request({
    url: "/python/api/func/manual",
    method: "post",
    data: data,
  });
}

/* ------------------------- 节点级操作：暂停 / 取消 / 恢复 ------------------------- */

/**
 * 节点的右键菜单 → 「暂停 / 取消节点 / 恢复」共用这一个接口
 *
 * POST /release/executeIndex/updateNodeStatus
 * 入参：{ aniInstanceNodeId, operation }
 *   aniInstanceNodeId  节点的 aniInstanceNodeId（**取当前右键的那个节点的真实值**）
 *   operation          操作类型，三选一（值是固定的字符串，与字典/接口协议保持一致）：
 *                       STOP        暂停（运行中的节点 → STOP）
 *                       CANCELLED   取消（未开始/运行中的节点 → CANCELLED）
 *                       RECOVER     恢复（STOP 节点 → RUNNING）
 *
 * 返回：{ code, msg } —— 前端只关心成功与否，成功后**重置轮询**即可拉到最新节点状态
 * （节点状态变化不是这条接口直接给的，是后端改了库、前端下次轮询看到的）。
 *
 * ⚠️ 与「原子跳过」「函数跳过」都是 `update*Status` 系列，但**入参与接口路径都不一样**，
 *    别图省事合成一个：
 *      原子跳过  POST /release/executeIndex/updateAtomStatus     + { aaiInstanceAtomId, operation }
 *      函数跳过  POST /release/executeIndex/updateFunctionStatus + { aaiInstanceAtomId, operation, functionName, functionType }
 *      节点操作  POST /release/executeIndex/updateNodeStatus     + { aniInstanceNodeId, operation }
 *
 * @param {Object} data
 * @param {Number|String} data.aniInstanceNodeId
 * @param {String} data.operation  'STOP' | 'CANCELLED' | 'RECOVER'
 * @returns {Promise<{code, msg}>}
 */
export function updateNodeStatus(data) {
  if (USE_MOCK) {
    return mockApi("updateNodeStatus", data);
  }
  return request({
    url: "/release/executeIndex/updateNodeStatus",
    method: "post",
    data,
  });
}

/**
 * 流头部按钮 → 「取消 / 暂停 / 恢复」共用这一个接口
 *
 * POST /release/executeIndex/updateWorkflowStatus
 * 入参：{ awiWorkflowInstanceId, operation }
 *   awiWorkflowInstanceId  流的 awiWorkflowInstanceId（**取当前流的真实值**，不是 planId + index）
 *   operation               操作类型，三选一：
 *                            CANCELLED  取消（INIT / READY 流 → CANCELLED）
 *                            STOP       暂停（RUNNING 流 → STOP）
 *                            RECOVER    恢复（STOP 流 → RUNNING）
 *
 * 返回：{ code, msg } —— 前端只关心成功与否，成功后**重置轮询**即可拉到最新流状态。
 *
 * ⚠️ 与「节点级」的 updateNodeStatus 是**两个不同的接口**（入参字段、接口路径都不一样）：
 *     节点操作  POST /release/executeIndex/updateNodeStatus     + { aniInstanceNodeId, operation }
 *     流操作    POST /release/executeIndex/updateWorkflowStatus + { awiWorkflowInstanceId, operation }
 *    别图省事合成一个。
 *
 * @param {Object} data
 * @param {Number|String} data.awiWorkflowInstanceId
 * @param {String} data.operation  'STOP' | 'CANCELLED' | 'RECOVER'
 * @returns {Promise<{code, msg}>}
 */
export function updateWorkflowStatus(data) {
  if (USE_MOCK) {
    return mockApi("updateWorkflowStatus", data);
  }
  return request({
    url: "/release/executeIndex/updateWorkflowStatus",
    method: "post",
    data,
  });
}

/**
 * 函数批量跳过（「查看明细」弹窗 → 右上角「函数批量跳过」按钮）
 *
 * POST /python/api/func/multiAtomFuncSkip
 * 入参：{ atomIdList, functionSelList, includeChildren, ignoreCompleted, oneKeyJumpFlag }
 *   atomIdList        用户在弹窗里选的原子 id 数组（已去重）
 *   functionSelList   选中原子的全部函数去重后的 [{ atomId, funcName }, ...]
 *   includeChildren   是否包含子函数（'Y' / 'N'，对应弹窗里的开关）
 *   ignoreCompleted   是否忽略已完成（'Y' / 'N'，对应弹窗里的开关）
 *   oneKeyJumpFlag    固定 'Y'（一键跳过标记，后端据此走批量路径）
 *
 * 返回：{ code, msg } —— 成功后弹窗要重新拉一次明细才能看到最新状态。
 *
 * ⚠️ 这个接口的字段名跟前几个 `update*Status` 系列不一样：
 *     原子跳过  POST /release/executeIndex/updateAtomStatus      + { aaiInstanceAtomId, operation }
 *     函数跳过  POST /release/executeIndex/updateFunctionStatus  + { aaiInstanceAtomId, operation, functionName, functionType }
 *     批量跳过  POST /python/api/func/multiAtomFuncSkip          + { atomIdList, functionSelList, oneKeyJumpFlag, ... }
 *    是**第三个**不同接口，别图省事合成一个。
 */
export function multiAtomFuncSkip(data) {
  if (USE_MOCK) {
    return mockApi("multiAtomFuncSkip", data);
  }
  return request({
    url: "/python/api/func/multiAtomFuncSkip",
    method: "post",
    data,
  });
}

/**
 * 一键跳过失败函数（「查看明细」弹窗 → 右上角「一键跳过失败函数」按钮）
 *
 * POST /python/api/func/funcSkip
 * 入参：{ nodeId, funcName }
 *   nodeId    节点的 aniInstanceNodeId（**取当前查看明细的那个节点的 id**，
 *             不是原子 id —— 与 multiAtomFuncSkip 用 atomIdList 区分）
 *   funcName  要跳过的失败函数名（用户在弹窗下拉里选的那一条）
 *
 * 返回：{ code, msg } —— 成功后弹窗要重新拉一次明细才能看到最新状态。
 *
 * ⚠️ 这又是一个**第三个**不同接口（与上面 multiAtomFuncSkip 是两条独立路径）：
 *     批量跳过  POST /python/api/func/multiAtomFuncSkip   + { atomIdList, functionSelList, ... }
 *     一键跳过  POST /python/api/func/funcSkip            + { nodeId, funcName }
 *    别图省事合成一个。
 */
export function funcSkip(data) {
  if (USE_MOCK) {
    return mockApi("funcSkip", data);
  }
  return request({
    url: "/python/api/func/funcSkip",
    method: "post",
    data,
  });
}

/* ------------------------- 工单关联文档（自动发布渲染出的 HTML） ------------------------- */

/**
 * 查询工单关联的自动发布文档
 *
 * POST /python/api/cicd/query_auto_rate
 * 入参：{ order_id } —— **下划线命名**（python 那批接口的约定），值取原子的 `aaiOrderId`
 *       （也就是「查看明细」表格里「工单」列的那个工单号）。
 *
 * 返回（真实示例）：
 * {
 *   code: 0,
 *   msg: '成功',
 *   data: {
 *     order_id: 'DASP-CHG-20260916-0003',
 *     total_files: 1,
 *     files: [
 *       {
 *         created_time: 1709534510,          // 秒级时间戳
 *         file_name:    'DASP-CHG-20260916-0003_1486122233.html',
 *         file_path:    '/app/data/aspect/release/auto_env/.../rendered/docs/<file_name>',
 *         file_size:    99506,
 *         url:          '/api/v1/doc/view/<file_name>',
 *       },
 *     ],
 *   },
 * }
 *
 * ⚠️ **`files` 是数组** —— 一个工单可能关联多个文档，页面上用 tab 切换（别只取第 0 个）。
 * ⚠️ 成功码是 **0**（python `func/*`、`cicd/*` 那批的约定），**别判 `code === 200`**。
 * ⚠️ 页面上真正拿去嵌 iframe 的地址**不是**返回里的 `url`（那是另一条路由 /api/v1/...），
 *    而是 `DOC_VIEW_BASE + file_name`（见 index.vue 顶部的 `DOC_VIEW_BASE`）。
 */
export function queryAutoRate({ orderId }) {
  if (USE_MOCK) {
    return mockApi("queryAutoRate", { orderId });
  }
  return request({
    url: "/python/api/cicd/query_auto_rate",
    method: "post",
    data: { order_id: orderId },
  });
}

export default {
  getPlanList,
  pickExecPlanIds,
  pickPayload,
  getExecuteIndex,
  getExecuteIndexBatch,
  addNodeDelayParams,
  getPlanExtraInfo,
  setNodeFinishSms,
  listAllUser,
  changeExecUser,
  queryAotmOfNode,
  sureAtomInstance,
  updateAtomStatus,
  getUniqueInfo,
  updateFunctionStatus,
  manualFunc,
  updateNodeStatus,
  updateWorkflowStatus,
  multiAtomFuncSkip,
  funcSkip,
  queryAutoRate,
  EXEC_PLAN_SYSTEMS,
  SMS_SEND_ON,
  SMS_SEND_OFF,
  isSmsSendOn,
};
