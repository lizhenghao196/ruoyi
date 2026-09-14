/** 编排页面枚举字典 */

// 流状态
export const FLOW_STATUS_TEXT = {
  running: '执行中',
  waiting: '待执行',
  done: '已完成'
}

// 节点状态
export const NODE_STATUS_TEXT = {
  done: '已完成',
  running: '进行中',
  waiting: '待执行',
  failed: '失败'
}

// 节点类型
export const NODE_TYPE_TEXT = {
  auto: '自动',
  manual: '人工',
  approve: '审批',
  check: '校验'
}

// 原子状态样式
export const ATOM_STATUS_CLASS = {
  已编排: 'is-success',
  待实施: 'is-warning',
  审批中: 'is-running',
  预审: 'is-default',
  已完成: 'is-success'
}
