/**
 * 执行页面 —— 节点类型判定
 *
 * 纯函数模块，不依赖 Vue / DOM，可直接用 node 跑断言（同 nodeMenu.js / nodeParams.js）。
 *
 * 为什么单独抽出来：**「是不是人工确认节点」这个判定有两处要用**，写两份迟早不一致 ——
 *   1. `components/AtomDetailDialog.vue`
 *        · 不展示「原子计划时间 / 工单开始时间」两列；
 *        · 打开时展开行**默认展开**（用户要求：人工节点默认展开，其余默认收起）；
 *   2. `index.vue`
 *        · 节点**双击**时，人工确认节点弹「原子确认」小弹窗，其余节点走「查看明细」。
 *
 * ⚠️ 判的是**节点类型**（`aniInstanceNodeType`，英文枚举），不是**原子名**。
 *    本项目「人工确认」有**两个不同的关键字，别合并**：
 *      · 判原子名（`aaiAtomName`）用中文 `includes('人工确认')` —— 决定给不给「确认完成」按钮、
 *        展开行走哪个分支；真实原子叫「人工确认_变更审批」「人工确认_业务复核」，
 *        严格相等一个都匹配不上。
 *      · 判节点类型（`aniInstanceNodeType`）用英文 `HUMAN_CONFIRM` —— 就是本文件。
 *    拿中文去判节点类型会**永远为假、且毫无报错**（该隐藏的列不隐藏、该展开的不展开），
 *    和「这个功能没做」长得一模一样。
 */

/** 人工确认节点类型（`aniInstanceNodeType` 的取值之一；mock 里另有 RELEASE_* / ITSM_* / DOMAIN_SWITCH） */
export const HUMAN_CONFIRM_NODE_TYPE = 'HUMAN_CONFIRM'

/**
 * 该节点是不是人工确认节点。
 *
 * 用 `includes` 而不是严格相等：真实数据里出现过带前缀的变体
 * （如 `ITSM_HUMAN_CONFIRM_X`），严格相等会漏掉它们 —— 而漏掉的后果是
 * 「双击没弹窗 / 列没隐藏」，没有任何报错。
 *
 * @param {Object} node 节点对象（wf.nodes[] 里的 node）
 * @returns {Boolean}
 */
export function isHumanConfirmNode(node) {
  const type = (node && node.aniInstanceNodeType) || ''
  return String(type).includes(HUMAN_CONFIRM_NODE_TYPE)
}

export default { HUMAN_CONFIRM_NODE_TYPE, isHumanConfirmNode }
