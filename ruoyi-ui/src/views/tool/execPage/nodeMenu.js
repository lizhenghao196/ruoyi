/**
 * 执行页面 —— 节点右键菜单项
 *
 * 纯函数模块，不依赖 Vue / DOM，可直接用 node 跑断言。
 *
 * 规则：右键菜单里有哪些按钮，**完全由节点的 aniStatus 决定**。
 *   状态不同 -> 可执行的动作不同（例如只有「执行中 / 初始化」能暂停，
 *   只有「挂起」能恢复，只有「初始化」能取消）。
 * 本文件只负责「状态 -> 菜单项」的映射，动作本身由页面实现。
 *
 * 未在 STATUS_MENU 里列举的状态（READY / SUBMIT / DEPEND_WAIT / VERIFY_EXEC /
 * VERIFY_FAIL / DEPEND_CONFIRM / INCOM_SUCCESS / SKIP …）统一走 DEFAULT_MENU，
 * 与参考实现的 else 分支一致 —— 这是显式约定，不是漏配。
 */

/**
 * 动作元数据
 *   label  菜单文案
 *   icon   Element 图标类名（项目已全量引入 element-ui 2.15 图标字体）
 *   danger 危险动作，菜单里标红
 *
 * fnName 沿用既有命名（stopIt / recover / cancelIt / atomFnc / quietness），
 * 便于和旧代码、后端动作标识对齐。
 */
export const MENU_ACTIONS = {
  stopIt: { label: '暂停', icon: 'el-icon-video-pause' },
  recover: { label: '恢复', icon: 'el-icon-coordinate' },
  cancelIt: { label: '取消节点', icon: 'el-icon-circle-close', danger: true },
  atomFnc: { label: '查看明细', icon: 'el-icon-more' },
  quietness: { label: '设置静默', icon: 'el-icon-turn-off-microphone' }
}

/**
 * 状态 -> 菜单项（数组顺序即展示顺序）
 *
 * 关于「设置静默」的图标：参考截图的 RUNNING 分支里写的是 el-icon-more，
 * 和同分支的「查看明细」撞了；其余所有分支都是 el-icon-turn-off-microphone。
 * 这里按语义统一成 el-icon-turn-off-microphone。
 */
export const STATUS_MENU = {
  RUNNING: ['stopIt', 'atomFnc', 'quietness'],
  STOP: ['recover', 'atomFnc', 'quietness'],
  SUCCESS: ['atomFnc', 'quietness'],
  FAILED: ['atomFnc', 'quietness'],
  CANCELLED: ['atomFnc', 'quietness'],
  INIT: ['stopIt', 'cancelIt', 'atomFnc', 'quietness'],
  CONFIRM: ['atomFnc', 'quietness']
}

/** 未列举状态的菜单（对应参考实现的 else 分支） */
export const DEFAULT_MENU = ['atomFnc', 'quietness']

/** 项目角色被禁用：只读，仅保留「查看明细」 */
export const READONLY_MENU = ['atomFnc']

/**
 * 生成节点的右键菜单项
 * @param {String} status 节点 aniStatus
 * @param {Object} [options]
 * @param {Boolean} [options.projectRoleDisabled] 项目角色是否被禁用（禁用 -> 只读菜单）
 * @returns {Array<{ fnName: String, label: String, icon: String, danger: Boolean }>}
 */
export function buildNodeMenu(status, options = {}) {
  const keys = options.projectRoleDisabled
    ? READONLY_MENU
    : STATUS_MENU[status] || DEFAULT_MENU
  return keys.map(fnName => {
    const action = MENU_ACTIONS[fnName]
    return {
      fnName,
      label: action.label,
      icon: action.icon,
      danger: !!action.danger
    }
  })
}

export default {
  buildNodeMenu,
  MENU_ACTIONS,
  STATUS_MENU,
  DEFAULT_MENU,
  READONLY_MENU
}
