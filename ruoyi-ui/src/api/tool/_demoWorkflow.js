/**
 * ⚠️ 演示专用：updateWorkflowStatus（流头部 → 取消 / 暂停 / 恢复）的覆盖表
 * ==========================================================================
 * 跟 _demoNode.js 几乎是一对孪生兄弟，区别只在「覆盖的是 wf.awiWorkflowStatus
 * 而不是 node.aniStatus」。结构和理由完全相同 —— 直接改 executeResMap 会被下一轮
 * demoTick 推回剧情；走覆盖表，在 getExecuteIndex 里 demoTick **之后** apply，
 * 让流级状态（STOP / CANCELLED / RUNNING）能在轮询里稳定胜出。
 *
 * operation -> 目标状态的映射与 _demoNode.js 一致：
 *   STOP       暂停运行中工作流  -> 'STOP'
 *   CANCELLED  取消未开始工作流  -> 'CANCELLED'
 *   RECOVER    把 STOP 工作流恢复 -> 'RUNNING'
 *   未知 operation 原样写入（留口子）
 *
 * 接入真实接口后怎么删
 *   1. 删掉本文件
 *   2. 删掉 execPlan.js 顶部的 import、getExecuteIndex 里 applyWorkflowStatusOverrides 的调用、
 *      以及 updateWorkflowStatus 的整段 mock 分支
 * ==========================================================================
 */

/** 工作流状态的「操作覆盖表」：`{ [awiWorkflowInstanceId]: 'STOP' | 'CANCELLED' | 'RUNNING' | ... }` */
const WORKFLOW_STATUS_OVERRIDE = {}

/**
 * operation（接口值）-> 落到工作流上的目标状态。
 * 与 _demoNode.js 的映射保持一致（节点级 / 流级共用同一套语义）。
 */
export function resolveWorkflowStatusByOp(operation) {
  const map = {
    STOP: 'STOP',
    CANCELLED: 'CANCELLED',
    RECOVER: 'RUNNING'
  }
  return map[operation] || operation
}

/**
 * 记录一次工作流操作的结果（演示用）。
 * @param {Number|String} awiWorkflowInstanceId
 * @param {String} operation 接口的 operation（STOP / CANCELLED / RECOVER …）
 */
export function setWorkflowStatusOverride(awiWorkflowInstanceId, operation) {
  WORKFLOW_STATUS_OVERRIDE[String(awiWorkflowInstanceId)] = resolveWorkflowStatusByOp(operation)
}

/**
 * 把「人为操作结果」应用到一份 getExecuteIndex 深拷贝上。
 * 必须在 demoTick **之后**调用 —— 否则会被推进状态盖掉（理由同 _demoNode.js）。
 *
 * @param {Object} data getExecuteIndex 返回的 data（已深拷贝，可直接改写）
 */
export function applyWorkflowStatusOverrides(data) {
  if (!data || !Array.isArray(data.workflows) || !Object.keys(WORKFLOW_STATUS_OVERRIDE).length) {
    return
  }
  data.workflows.forEach(wf => {
    if (!wf || wf.awiWorkflowInstanceId === undefined || wf.awiWorkflowInstanceId === null) {
      return
    }
    const target = WORKFLOW_STATUS_OVERRIDE[String(wf.awiWorkflowInstanceId)]
    if (!target || wf.awiWorkflowStatus === target) {
      return
    }
    wf.awiWorkflowStatus = target
  })
}

export default { setWorkflowStatusOverride, applyWorkflowStatusOverrides, resolveWorkflowStatusByOp }