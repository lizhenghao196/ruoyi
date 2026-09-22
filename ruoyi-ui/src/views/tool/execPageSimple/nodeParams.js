/**
 * 执行页面 —— 节点参数（aniNodeParams）解析
 *
 * 纯函数模块，不依赖 Vue / DOM，可直接用 node 跑断言。
 *
 * aniNodeParams 是**字符串化的 JSON 数组**，形如：
 *   '[{"key":"noticeDelay","value":10}]'
 *
 * 节点静默（延迟通知）就存在这里：key = 'noticeDelay'，value = 静默分钟数。
 * 值为 0 表示**取消静默**（不是静默 0 分钟），等价于没配。
 * 节点上配了有效值 -> 节点卡片上显示静音图标，悬停显示「已静默 N 分钟」。
 *
 * 参考实现是直接 JSON.parse 后 .find()，没有兜底：真实数据里出现过空串、
 * '[]'、null、坏 JSON，任一情况都会把整个节点渲染搞崩。这里统一兜住。
 */

/** 静默参数在 aniNodeParams 里的 key */
export const NOTICE_DELAY_KEY = 'noticeDelay'

/** 静默时长上限（分钟）= 24 小时。用于弹窗输入校验，超出视为非法 */
export const DELAY_MAX_MINUTES = 1440

/**
 * 静默时长为 0 = **取消静默**（见弹窗里的温馨提示），不是「静默 0 分钟」。
 * 所以下面读取时 0 一律当作「没配静默」，节点上的静音图标随之消失。
 * 前端只按这一个规则判断，后端无论是把 value 写成 0 还是把整项删掉，都能正确显示。
 */

/**
 * 把 aniNodeParams 解析成数组
 * @param {String|Array|null} raw
 * @returns {Array<Object>} 解析失败一律返回空数组，绝不抛错
 */
export function parseNodeParams(raw) {
  if (!raw) {
    return []
  }
  // 已经是数组就直接用（真实接口若返回对象结构，这里也能兼容）
  if (Array.isArray(raw)) {
    return raw
  }
  if (typeof raw !== 'string') {
    return []
  }
  let json = null
  try {
    json = JSON.parse(raw)
  } catch (e) {
    return []
  }
  return Array.isArray(json) ? json : []
}

/**
 * 取出节点的静默时长
 * @param {Object} node wf.nodes[] 里的一个节点
 * @returns {Number|null} 没配置 / 值为 0（= 取消静默）/ 值不是正数时返回 null
 */
export function noticeDelayMinutes(node) {
  const hit = parseNodeParams(node && node.aniNodeParams).find(
    item => item && item.key === NOTICE_DELAY_KEY
  )
  if (!hit) {
    return null
  }
  const n = Number(hit.value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 节点是否处于静默（决定要不要显示静音图标） */
export function hasNoticeDelay(node) {
  return noticeDelayMinutes(node) !== null
}

/** 静音图标的悬停文案：'已静默10分钟'；未静默返回空串 */
export function noticeDelayText(node) {
  const n = noticeDelayMinutes(node)
  return n === null ? '' : `已静默${n}分钟`
}

/**
 * 往 aniNodeParams 里写入静默时长（原地改节点，返回新的参数字符串）
 *   - delayMin > 0：已有 noticeDelay 就改值，没有就追加；**其它参数原样保留**
 *   - delayMin = 0（或非法值）：把 noticeDelay 整项**移除** —— 0 表示取消静默，
 *     不留 `{key:'noticeDelay', value:0}` 这种残渣，免得后面读数据时看着像「还配着」
 *
 * 注意：读取侧（noticeDelayMinutes）也把 value 0 当作没配，
 * 所以即使后端选择「写入 0」而不是删除，节点上的静音图标同样会消失。
 * @param {Object} node
 * @param {Number} delayMin
 * @returns {String} 新的 aniNodeParams 字符串
 */
export function withNoticeDelay(node, delayMin) {
  const arr = parseNodeParams(node && node.aniNodeParams)
  // 先把旧的 noticeDelay 摘掉（顺带清掉数组里的 null 项），再按需写回
  const rest = arr.filter(item => item && item.key !== NOTICE_DELAY_KEY)
  const n = Number(delayMin)
  if (!Number.isFinite(n) || n <= 0) {
    return JSON.stringify(rest)
  }
  const hit = arr.find(item => item && item.key === NOTICE_DELAY_KEY)
  rest.push(hit ? Object.assign(hit, { value: n }) : { key: NOTICE_DELAY_KEY, value: n })
  return JSON.stringify(rest)
}

export default {
  parseNodeParams,
  noticeDelayMinutes,
  hasNoticeDelay,
  noticeDelayText,
  withNoticeDelay,
  NOTICE_DELAY_KEY,
  DELAY_MAX_MINUTES
}
