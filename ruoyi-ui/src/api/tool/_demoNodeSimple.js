/**
 * ⚠️ 演示专用：updateNodeStatus（右键菜单 → 暂停 / 取消 / 恢复）的覆盖表
 * ==========================================================================
 * 为什么需要它
 *   mockData/res.js 里的 executeResMap 是一份不会自动变的静态快照，
 *   `_demoTick` 每轮按剧情推一次节点状态。直接改 executeResMap 的
 *   `aniStatus` 会被下一轮 demoTick 覆盖回去，表现为「点了暂停看到
 *   STOP，1 秒后变回 RUNNING」—— 像功能没生效。
 *
 *   这里用一张**模块级**的覆盖表把「人为操作结果」记下来：
 *     1. updateNodeStatus 的 mock 写入这张表；
 *     2. getExecuteIndex 在 demoTick **之后**把覆盖表里的状态应用回节点，
 *        这样无论 demoTick 推到什么状态、人工状态总能胜出。
 *   页面持有的节点是深拷贝副本（executeResMap 那份不会变），所以读侧必须
 *   主动 apply 一次，否则轮询重建副本就读不到。
 *
 * operation -> 目标状态的映射
 *   STOP       暂停运行中节点      -> 'STOP'
 *   CANCELLED  取消未开始/运行中节点 -> 'CANCELLED'
 *   RECOVER    把 STOP 节点恢复运行  -> 'RUNNING'
 *   未知 operation 一律按字面写入（让真后端的扩展字段留个口子）
 *
 * 接入真实接口后怎么删
 *   1. 删掉本文件
 *   2. 删掉 execPlan.js 顶部的 import、getExecuteIndex 里 applyNodeStatusOverrides 的调用、
 *      以及 updateNodeStatus 的整段 mock 分支
 * ==========================================================================
 */

/** 节点状态的「操作覆盖表」：`{ [aniInstanceNodeId]: 'STOP' | 'CANCELLED' | 'RUNNING' | ... }` */
const NODE_STATUS_OVERRIDE = {}

/**
 * operation（接口值）-> 落到节点上的目标状态。
 * 真实接口由后端决定，这里只覆盖用户截图里给出的三个值；
 * 未命中时原样返回 operation —— 万一真实接口有别的取值，
 * 前端不会因为本地多一层映射而把它压成错误状态。
 */
export function resolveNodeStatusByOp(operation) {
  const map = {
    STOP: 'STOP',
    CANCELLED: 'CANCELLED',
    RECOVER: 'RUNNING'
  }
  return map[operation] || operation
}

/**
 * 记录一次节点操作的结果（演示用，见 NODE_STATUS_OVERRIDE 的说明）。
 * @param {Number|String} aniInstanceNodeId
 * @param {String} operation 接口的 operation（STOP / CANCELLED / RECOVER …）
 */
export function setNodeStatusOverride(aniInstanceNodeId, operation) {
  NODE_STATUS_OVERRIDE[String(aniInstanceNodeId)] = resolveNodeStatusByOp(operation)
}

/**
 * 把「人为操作结果」应用到一份 getExecuteIndex 深拷贝上。
 * 必须在 demoTick **之后**调用 —— 否则会被推进状态盖掉。
 *
 * 只覆盖状态确实不同的节点，避免无谓重写触发 flow / node 的 :key 重算。
 *
 * @param {Object} data getExecuteIndex 返回的 data（已深拷贝，可直接改写）
 */
export function applyNodeStatusOverrides(data) {
  if (!data || !Array.isArray(data.workflows) || !Object.keys(NODE_STATUS_OVERRIDE).length) {
    return
  }
  data.workflows.forEach(wf => {
    const nodes = Array.isArray(wf && wf.nodes) ? wf.nodes : []
    nodes.forEach(node => {
      if (!node || node.aniInstanceNodeId === undefined || node.aniInstanceNodeId === null) {
        return
      }
      const target = NODE_STATUS_OVERRIDE[String(node.aniInstanceNodeId)]
      if (!target || node.aniStatus === target) {
        return
      }
      node.aniStatus = target
    })
  })
}

export default { setNodeStatusOverride, applyNodeStatusOverrides, resolveNodeStatusByOp }