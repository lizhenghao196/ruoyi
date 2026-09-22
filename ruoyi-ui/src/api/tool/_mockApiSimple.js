/**
 * 执行界面简版 演示数据层（**只有 mock 实现**）
 * ==========================================================================
 * ⚠️ 本文件是 ./_mockApi.js 的**独立副本**，只服务 execPageSimple / execPlanList。
 *    用户明确要求「除了 mockData 里的内容，其他组件 / 方法 / 接口一律不许共享」，
 *    所以这里连造数器（_demo*Simple.js）都是各自一份 —— 改 execPage 的 mock
 *    不会波及简版页面，反之亦然。**不要为了「去重」把两边合并。**
 *    唯一共享的是 mockData/res.js（假数据仓库，用户明确允许共享）。
 *
 * 什么时候会跑到这里
 *   只有 ./_mockFlagSimple.js 的 USE_MOCK 为 true 时，execPageSimple.js 才会动态
 *   import 本文件。USE_MOCK 为 false 时本文件（连同 mockData/res.js 那 1.4MB 假数据）
 *   不会被加载 —— 那段 import 根本不会执行。
 *
 * 本文件里的函数与 execPageSimple.js 里的同名函数一一对应：
 *   execPageSimple.js  负责「分发」+ 真实接口的契约文档（路径 / 入参 / 返回 / 坑）
 *   本文件             负责「假数据怎么造、操作结果怎么记」
 *   两个文件都改了才算改了一个接口 —— 别只改一边。
 *
 * 接真实接口后怎么删
 *   1. ./_mockFlagSimple.js 的 USE_MOCK 改成 false，确认页面正常
 *   2. 删掉本文件、同目录 _demo*Simple.js、_mockFlagSimple.js，
 *      以及 execPageSimple.js 里每个函数开头的 `if (USE_MOCK) { ... }` 三行
 * ==========================================================================
 */
import { planRes, executeResMap } from '../../../mockData/res'
// 让静态快照也能随轮询推进状态（为什么需要，见该文件开头）
import { demoTick, DEMO_TICK_ENABLED } from './_demoTickSimple'
// addNodeDelayParams 靠它写 aniNodeParams —— 「写入」和页面「读取」共用同一套参数规则
import { withNoticeDelay } from '@/views/tool/execPageSimple/nodeParams'
// queryAotmOfNode 靠它把节点的 atoms[] 拼成接口返回结构；
// sureAtomInstance / updateAtomStatus / updateFunctionStatus 靠它记下操作结果（覆盖表）
import { buildAtomRes, setAtomStatusOverride, setFuncStatusOverride } from './_demoAtomSimple'
// getUniqueInfo（最新结果 / 历史结果 / 日志）的假数据由它造
import { buildUniqueInfo } from './_demoLogSimple'
// 消息推送（getPlanExtraInfo / setNodeFinishSms）的状态由它存
import { getSmsOverride, setSmsOverride } from './_demoSmsSimple'
// listAllUser（「修改实施人」的指定用户下拉）的名单由它造
import { buildUserList } from './_demoUserSimple'
// updateNodeStatus（节点 暂停/取消/恢复）的覆盖表
import { setNodeStatusOverride, applyNodeStatusOverrides } from './_demoNodeSimple'
// updateWorkflowStatus（流 取消/暂停/恢复）的覆盖表
import { setWorkflowStatusOverride, applyWorkflowStatusOverrides } from './_demoWorkflowSimple'

/* ------------------------------ 计划列表 ------------------------------ */

/**
 * 获取发布计划列表（planRes 全量）
 * @returns {Promise<{ code, msg, rows }>}
 */
export function getPlanList() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        code: planRes.code,
        msg: planRes.msg,
        rows: JSON.parse(JSON.stringify(planRes.rows))
      })
    }, 200)
  })
}

/* ------------------------------ 执行详情 ------------------------------ */

/**
 * 获取单个执行计划的执行详情（从 executeResMap 按 planId 取对应的一份数据）
 * @param {Number|String} aripExecPlanId
 */
export function getExecuteIndex(aripExecPlanId) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const res = executeResMap[aripExecPlanId]
      if (!res) {
        reject(new Error(`未找到执行详情：${aripExecPlanId}`))
        return
      }
      // 深拷贝：demoTick 会在一份可写副本上推进状态，否则多次轮询会叠加
      const payload = JSON.parse(JSON.stringify(res))
      // 模拟执行推进（轮询时能看到状态变化）。注意 workflows 在 payload.data 里，不是顶层
      if (DEMO_TICK_ENABLED && payload && payload.data) {
        demoTick(payload.data)
      }
      // 把人工暂停/取消/恢复的结果盖回节点。**必须在 demoTick 之后**，
      // 否则会被推进状态盖掉（表现为「暂停后一秒又跑起来了」，见 _demoNode.js）。
      if (payload && payload.data) {
        applyNodeStatusOverrides(payload.data)
      }
      // 把人工暂停/取消/恢复的结果盖回工作流。理由同上（见 _demoWorkflow.js）。
      if (payload && payload.data) {
        applyWorkflowStatusOverrides(payload.data)
      }
      resolve(payload)
    }, 260)
  })
}

/* --------------------------- 节点静默（延迟通知） --------------------------- */

/**
 * 设置节点静默（延迟通知）
 *
 * 直接改静态数据里该节点的 aniNodeParams。与 _demoTick.js 同理 ——
 * executeResMap 是一份静态快照，不真的改数据的话，轮询拉回来的还是原样，
 * 节点上的静音图标永远不会出现，看不出功能有没有生效。
 *
 * 复用 nodeParams.js 的 withNoticeDelay，让「写入」和「读取」用同一套参数规则（单一数据源）。
 *
 * @param {Object} p
 * @param {Number|String} p.planId
 * @param {Number} p.nodeId
 * @param {Number} p.delayMin
 */
export function addNodeDelayParams({ planId, nodeId, delayMin }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const res = executeResMap[planId]
      const workflows = (res && res.data && res.data.workflows) || []
      let hit = null
      workflows.forEach(wf => {
        ;((wf && wf.nodes) || []).forEach(node => {
          if (node && node.aniInstanceNodeId === nodeId) {
            hit = node
          }
        })
      })
      if (!hit) {
        reject(new Error(`未找到节点：${nodeId}`))
        return
      }
      hit.aniNodeParams = withNoticeDelay(hit, delayMin)
      resolve({ code: 200, msg: '操作成功' })
    }, 320)
  })
}

/* --------------------------- 消息推送 --------------------------- */

/**
 * 查询变更计划的消息推送状态（「设置消息推送」弹窗打开前先调它）
 *
 * 演示状态存在 _demoSms.js 的模块级变量里（不按 planId 分，理由见该文件）。
 *
 * @param {Array<Number|String>} planId 本页全部 aripExecPlanId
 */
export function getPlanExtraInfo(planId) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!Array.isArray(planId) || !planId.length) {
        reject(new Error('planId 不能为空'))
        return
      }
      resolve({
        code: 0,
        msg: '成功:变更计划附加信息查询成功',
        data: { nodeFinishedSms: getSmsOverride() }
      })
    }, 300)
  })
}

/**
 * 设置节点完成的消息推送（「设置消息推送」弹窗点「确定」）
 *
 * 把演示状态写进 _demoSms.js 的模块级变量，这样「确定 -> 再打开弹窗」能读回刚设的值
 * （否则功能看着没生效）。
 *
 * @param {Object} p
 * @param {Array<Number|String>} p.planId
 * @param {String} p.sendFlag 'Y' | 'N'
 * @param {Number|String} p.groupId
 */
export function setNodeFinishSms({ planId, sendFlag, groupId }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!Array.isArray(planId) || !planId.length) {
        reject(new Error('planId 不能为空'))
        return
      }
      setSmsOverride(sendFlag, groupId)
      resolve({
        code: 0,
        data: null,
        msg: '成功:更新节点完成的消息通知开关成功'
      })
    }, 360)
  })
}

/* --------------------------- 修改实施人 --------------------------- */

/** 查询全部用户（「修改实施人」弹窗的「指定用户」下拉） */
export function listAllUser() {
  return new Promise(resolve => {
    setTimeout(() => {
      const rows = buildUserList()
      resolve({ code: 200, msg: '操作成功', total: rows.length, rows })
    }, 260)
  })
}

/**
 * 修改工单的实施人
 *
 * 只回形状正确的响应，**刻意不真的改数据** —— 实施人落在原子的
 * `aaiAtomConfig.executeUserName` 上，而本页没有任何地方展示它（明细弹窗也不显示），
 * 改了也看不见；反而会让 mock 多一份没人读的「真相」。要验证请求发对没发对，看请求体。
 *
 * 四个必填字段逐个校验：**少传一个就拒**。这不是多余 —— 真实后端缺字段会报错，
 * 而 mock 静默放过的话，「页面忘了传 updateBy」这种 bug 在演示阶段完全看不出来。
 *
 * @param {Object} p
 * @param {String[]} p.orderId
 * @param {String} p.user
 * @param {String} p.username
 * @param {String} p.updateBy
 */
export function changeExecUser({ orderId, user, username, updateBy }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!Array.isArray(orderId) || !orderId.length) {
        reject(new Error('orderId 不能为空'))
        return
      }
      if (!user) {
        reject(new Error('请选择指定用户'))
        return
      }
      if (!username) {
        reject(new Error('username 不能为空'))
        return
      }
      if (!updateBy) {
        reject(new Error('updateBy 不能为空'))
        return
      }
      resolve({
        code: 0,
        msg: '成功',
        data: `[['${orderId.join("','")}']] 工单实施人更新至${user}成功`
      })
    }, 360)
  })
}

/* --------------------------- 节点明细（原子） --------------------------- */

/**
 * 查询节点下的原子明细（节点右键 ->「查看明细」）
 *
 * 节点自带的 atoms[] 就是明细的另一种投影，_demoAtom.js 负责改字段名（aai* -> ani*）
 * + 把 aniInstanceFunctionName 展开成 functions[]。
 *
 * @param {Object} p
 * @param {Number|String} p.aniInstanceNodeId
 * @param {Object} [p.node] 仅 mock 用的快捷入参：直接传节点对象可省一次查找。
 */
export function queryAotmOfNode({ aniInstanceNodeId, node }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // node 必须和 aniInstanceNodeId 对得上才敢用；对不上就退回按 id 查找 ——
      // 否则传错节点会静默返回别人的明细，很难查。
      const passed =
        node && String(node.aniInstanceNodeId) === String(aniInstanceNodeId) ? node : null
      const hit = passed || findNodeById(aniInstanceNodeId)
      if (!hit) {
        reject(new Error(`未找到节点：${aniInstanceNodeId}`))
        return
      }
      resolve(buildAtomRes(hit))
    }, 300)
  })
}

/**
 * 执行页面人工类型原子「确认完成」按钮
 *
 * 改原始原子的状态，**并记进 _demoAtom 的覆盖表**。只改原始数据是不够的 ——
 * getExecuteIndex 每次深拷贝一份给页面，页面持有的节点和这里改的不是同一批对象
 * （见 _demoAtom.js 的 ATOM_STATUS_OVERRIDE）。
 *
 * @param {Object} data { aaiInstanceAtomId, aaiAtomStatus }
 */
export function sureAtomInstance(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const hit = findAtomById(data && data.aaiInstanceAtomId)
      if (!hit) {
        reject(new Error(`未找到原子：${data && data.aaiInstanceAtomId}`))
        return
      }
      hit.aaiAtomStatus = data.aaiAtomStatus
      setAtomStatusOverride(data.aaiInstanceAtomId, data.aaiAtomStatus)
      resolve({ code: 200, msg: '操作成功' })
    }, 420)
  })
}

/**
 * 原子跳过
 *
 * 把目标原子的状态改成 operation（目前只有 'SKIP' 一种），并记进 _demoAtom 的覆盖表
 * （理由同 sureAtomInstance）。
 *
 * @param {Object} data { aaiInstanceAtomId, operation }
 */
export function updateAtomStatus(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const hit = findAtomById(data && data.aaiInstanceAtomId)
      if (!hit) {
        reject(new Error(`未找到原子：${data && data.aaiInstanceAtomId}`))
        return
      }
      hit.aaiAtomStatus = data.operation
      setAtomStatusOverride(data.aaiInstanceAtomId, data.operation)
      resolve({ code: 200, msg: '操作成功' })
    }, 420)
  })
}

/* --------------------------- 最新结果 / 历史结果 / 日志 --------------------------- */

/**
 * 最新结果 / 历史结果 / 日志（三个弹窗共用这一个接口，靠前端 flag 区分怎么展示）
 *
 * 按「原子 + 函数」造一份形状正确的假数据（见 _demoLog.js）。
 *
 * @param {Object} data { aelInstanceAtomId, aelFunctionName }
 */
export function getUniqueInfo(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const atom = findAtomById(data && data.aelInstanceAtomId)
      if (!atom) {
        reject(new Error(`未找到原子：${data && data.aelInstanceAtomId}`))
        return
      }
      resolve(buildUniqueInfo(atom, data && data.aelFunctionName))
    }, 360)
  })
}

/* --------------------------- 函数级操作 --------------------------- */

/**
 * 函数跳过 / 结果确认
 *
 * 把该函数的状态改成 FUNC_OP_TO_STATUS 里的目标状态，同时记进覆盖表。
 *
 * @param {Object} data { aaiInstanceAtomId, operation, functionName, functionType }
 */
export function updateFunctionStatus(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const ok = patchFuncStatus(
        data && data.aaiInstanceAtomId,
        data && data.functionName,
        FUNC_OP_TO_STATUS[data && data.operation] || (data && data.operation)
      )
      if (!ok) {
        reject(
          new Error(
            `未找到原子或函数：${data && data.aaiInstanceAtomId} / ${data && data.functionName}`
          )
        )
        return
      }
      resolve({ code: 200, msg: '操作成功' })
    }, 420)
  })
}

/**
 * 函数级操作的 `operation` -> 落到函数上的目标状态（**mock 专用**）。
 *
 *   SKIP    跳过      -> SKIP（「跳过」，字典 `release_execute_status` 里有这个值）
 *   CONFIRM 结果确认  -> SUCCESS
 *
 * ⚠️ `CONFIRM` 的目标状态是**演示推断**：参考实现只给了 operation 的取值，
 *    没说后端确认通过后函数落到哪个状态。这里按「结果待确认（CONFIRM）确认通过 → SUCCESS」
 *    推进 —— 否则状态原地不动，「重新拉明细」看不出任何变化，功能像没生效。
 */
const FUNC_OP_TO_STATUS = { SKIP: 'SKIP', CONFIRM: 'SUCCESS' }

/** 手动执行原子函数 */
export function manualFunc(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const ok = patchFuncStatus(data && data.atomId, data && data.funcName, 'RUNNING')
      if (!ok) {
        reject(
          new Error(`未找到原子或函数：${data && data.atomId} / ${data && data.funcName}`)
        )
        return
      }
      resolve({ code: 200, msg: '操作成功' })
    }, 420)
  })
}

/* --------------------------- 节点级操作：暂停 / 取消 / 恢复 --------------------------- */

/**
 * 节点的右键菜单 → 「暂停 / 取消节点 / 恢复」
 *
 * 把目标节点的状态记进覆盖表（详见 _demoNode.js 的说明）。直接改 executeResMap 的
 * aniStatus 不行 —— 下一轮 demoTick 会把它推回剧情里安排的状态，
 * 表现为「暂停后一秒又跑起来了」。所以走覆盖表。
 *
 * @param {Object} data { aniInstanceNodeId, operation }
 */
export function updateNodeStatus(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const id = data && data.aniInstanceNodeId
      if (id === undefined || id === null || id === '') {
        reject(new Error('aniInstanceNodeId 不能为空'))
        return
      }
      if (!data || !data.operation) {
        reject(new Error('operation 不能为空'))
        return
      }
      const hit = findNodeById(id)
      if (!hit) {
        reject(new Error(`未找到节点：${id}`))
        return
      }
      setNodeStatusOverride(id, data.operation)
      resolve({ code: 200, msg: '操作成功' })
    }, 320)
  })
}

/**
 * 流头部按钮 → 「取消 / 暂停 / 恢复」
 *
 * 与 updateNodeStatus 的 mock 同构 —— 直接改 executeResMap 的 awiWorkflowStatus
 * 会被下一轮 demoTick 推回剧情里安排的状态（详见 _demoWorkflow.js）。
 *
 * @param {Object} data { awiWorkflowInstanceId, operation }
 */
export function updateWorkflowStatus(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const id = data && data.awiWorkflowInstanceId
      if (id === undefined || id === null || id === '') {
        reject(new Error('awiWorkflowInstanceId 不能为空'))
        return
      }
      if (!data || !data.operation) {
        reject(new Error('operation 不能为空'))
        return
      }
      const hit = findWorkflowById(id)
      if (!hit) {
        reject(new Error(`未找到工作流：${id}`))
        return
      }
      setWorkflowStatusOverride(id, data.operation)
      resolve({ code: 200, msg: '操作成功' })
    }, 320)
  })
}

/* --------------------------- 批量 / 一键跳过 --------------------------- */

/**
 * 函数批量跳过（「查看明细」弹窗 → 右上角「函数批量跳过」按钮）
 *
 * 逐个函数走 patchFuncStatus 把状态改成 SKIP，并写进覆盖表 —— 单独改 executeResMap
 * 不够，「页面下轮的轮询」拿到的是 getExecuteIndex 深拷贝出来的副本，
 * 必须靠覆盖表才能让重新拉明细看到变化（与 updateFunctionStatus 的 mock 同构）。
 *
 * @param {Object} data { atomIdList, functionSelList, ... }
 */
export function multiAtomFuncSkip(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const atomIdList = (data && data.atomIdList) || []
      const functionSelList = (data && data.functionSelList) || []
      if (!atomIdList.length) {
        reject(new Error('atomIdList 不能为空'))
        return
      }
      let processed = 0
      functionSelList.forEach(fn => {
        const ok = patchFuncStatus(fn.atomId, fn.funcName, 'SKIP')
        if (ok) {
          processed += 1
        }
      })
      resolve({ code: 200, msg: '操作成功', data: { processed } })
    }, 420)
  })
}

/**
 * 一键跳过失败函数（「查看明细」弹窗 → 右上角「一键跳过失败函数」按钮）
 *
 * 走与 updateFunctionStatus / multiAtomFuncSkip 同一套 patchFuncStatus，把目标函数置为 SKIP
 * 并写进覆盖表（理由详见 patchFuncStatus）。
 *
 * @param {Object} data { nodeId, funcName }
 */
export function funcSkip(data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const nodeId = data && data.nodeId
      const funcName = data && data.funcName
      if (nodeId === undefined || nodeId === null || nodeId === '') {
        reject(new Error('nodeId 不能为空'))
        return
      }
      if (!funcName) {
        reject(new Error('funcName 不能为空'))
        return
      }
      // 按 nodeId 找出它下面的全部原子，挨个试 patchFuncStatus ——
      // 失败函数名下拉只是函数名（不区分原子），得逐个原子看哪个真有这个函数
      // 且状态是 FAILED（filedFncList 已按这个规则过滤过）。
      const atoms = findAtomsByNodeId(nodeId)
      if (!atoms.length) {
        reject(new Error(`未找到节点下的原子：${nodeId}`))
        return
      }
      let processed = 0
      atoms.forEach(a => {
        // 先看是不是真「失败」的失败函数，避免 mock 静默放过不该过的请求
        if (!isFuncFailed(a, funcName)) {
          return
        }
        const ok = patchFuncStatus(a.aaiInstanceAtomId, funcName, 'SKIP')
        if (ok) {
          processed += 1
        }
      })
      if (!processed) {
        reject(new Error(`未找到失败函数：${nodeId} / ${funcName}`))
        return
      }
      resolve({ code: 200, msg: '操作成功', data: { processed } })
    }, 420)
  })
}

/* ------------------------------ mock 内部工具 ------------------------------ */

/**
 * 改某个函数的状态（mock 专用）：原始数据与覆盖表**都要改**。
 *
 * 只改原始数据不够 —— 页面持有的节点是 getExecuteIndex 深拷贝出来的副本，
 * 覆盖表才是让「重新拉明细」能看到变化的那条路（见 _demoAtom.js 的说明）。
 *
 * @returns {Boolean} 找到并改成功返回 true
 */
function patchFuncStatus(aaiInstanceAtomId, funcName, status) {
  const atom = findAtomById(aaiInstanceAtomId)
  if (!atom) {
    return false
  }
  let list = null
  try {
    list = JSON.parse(atom.aaiInstanceFunctionName)
  } catch (e) {
    list = null
  }
  if (!Array.isArray(list)) {
    return false
  }
  const hit = list.find(fn => fn && String(fn.funcName) === String(funcName))
  if (!hit) {
    return false
  }
  hit.status = status
  atom.aaiInstanceFunctionName = JSON.stringify(list)
  setFuncStatusOverride(aaiInstanceAtomId, funcName, status)
  return true
}

/**
 * 「这个原子里的这个函数算失败」—— mock 专用。
 *
 * ⚠️ 必须走 buildAtomRes 拿投影后的状态，不能直接 parse `aaiInstanceFunctionName`：
 *    真实状态 = 覆盖表(FUNC_STATUS_OVERRIDE) → 原子 aaiAtomStatus 推导 → 默认值，
 *    buildAtomRes 自己就是这么投影的。直接读原始字符串里的 status，
 *    会把「已被 setFuncStatusOverride 标 FAILED 的函数」漏掉（或反过来漏放）。
 *    临时构造一个 `{ atoms: [atom] }` 的 node 给 buildAtomRes，零侵入。
 */
function isFuncFailed(atom, funcName) {
  if (!atom) return false
  const projected = buildAtomRes({ atoms: [atom] }).data[0]
  if (!projected || projected.aaiAtomStatus !== 'FAILED') {
    return false
  }
  return (projected.functions || []).some(
    f => f && String(f.funcName) === String(funcName) && f.status === 'FAILED'
  )
}

/** 在静态 mock 数据里按 aniInstanceNodeId 找节点 */
function findNodeById(aniInstanceNodeId) {
  const planIds = Object.keys(executeResMap)
  for (let i = 0; i < planIds.length; i++) {
    const data = executeResMap[planIds[i]] && executeResMap[planIds[i]].data
    const workflows = (data && data.workflows) || []
    for (let j = 0; j < workflows.length; j++) {
      const nodes = (workflows[j] && workflows[j].nodes) || []
      for (let k = 0; k < nodes.length; k++) {
        if (nodes[k] && nodes[k].aniInstanceNodeId === aniInstanceNodeId) {
          return nodes[k]
        }
      }
    }
  }
  return null
}

/** 在静态 mock 数据里按 awiWorkflowInstanceId 找工作流 */
function findWorkflowById(awiWorkflowInstanceId) {
  const planIds = Object.keys(executeResMap)
  for (let i = 0; i < planIds.length; i++) {
    const data = executeResMap[planIds[i]] && executeResMap[planIds[i]].data
    const workflows = (data && data.workflows) || []
    for (let j = 0; j < workflows.length; j++) {
      if (
        workflows[j] &&
        String(workflows[j].awiWorkflowInstanceId) === String(awiWorkflowInstanceId)
      ) {
        return workflows[j]
      }
    }
  }
  return null
}

/** 在静态 mock 数据里按 aaiInstanceAtomId 找原子 */
function findAtomById(aaiInstanceAtomId) {
  const planIds = Object.keys(executeResMap)
  for (let i = 0; i < planIds.length; i++) {
    const data = executeResMap[planIds[i]] && executeResMap[planIds[i]].data
    const workflows = (data && data.workflows) || []
    for (let j = 0; j < workflows.length; j++) {
      const nodes = (workflows[j] && workflows[j].nodes) || []
      for (let k = 0; k < nodes.length; k++) {
        const atoms = (nodes[k] && nodes[k].atoms) || []
        for (let m = 0; m < atoms.length; m++) {
          if (String(atoms[m].aaiInstanceAtomId) === String(aaiInstanceAtomId)) {
            return atoms[m]
          }
        }
      }
    }
  }
  return null
}

/**
 * 在静态 mock 数据里按 aniInstanceNodeId 找出它下面的全部原子。
 * 不复用 findNodeById：找原子比找节点多一层循环。
 */
function findAtomsByNodeId(aniInstanceNodeId) {
  const planIds = Object.keys(executeResMap)
  for (let i = 0; i < planIds.length; i++) {
    const data = executeResMap[planIds[i]] && executeResMap[planIds[i]].data
    const workflows = (data && data.workflows) || []
    for (let j = 0; j < workflows.length; j++) {
      const nodes = (workflows[j] && workflows[j].nodes) || []
      for (let k = 0; k < nodes.length; k++) {
        if (nodes[k] && String(nodes[k].aniInstanceNodeId) === String(aniInstanceNodeId)) {
          return Array.isArray(nodes[k].atoms) ? nodes[k].atoms : []
        }
      }
    }
  }
  return []
}
