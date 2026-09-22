/**
 * ⚠️ 演示专用：把节点自带的 atoms[] 拼成「查看明细」接口的返回结构
 * ==========================================================================
 * POST /release/executeIndex/queryAotmOfNode 的返回在 mockData/res.js 里没有现成数据，
 * 但节点的 atoms[] 已经带了几乎全部内容 —— 接口返回就是它，**再补两样**：
 *
 *   1. functions[]  由 aaiInstanceFunctionName 展开（节点上只是一串字符串化 JSON），
 *                   外加 totalFunctionCount / failedFunctionCount 两个计数
 *   2. aaiAtomConfig 里的 idc  —— mock 的原子配置里**一条都没有**，这里补上（见下）
 *
 * 字段前缀就是 aai*，**和节点自带的 atoms[] 一模一样，接口不改名**。
 *   （踩过一次：我一度以为接口返回是 ani* 前缀，那是把接口文档里的示例读错了。
 *     实际返回与节点同形。所以这里用 Object.assign 展开原始对象，而不是逐个列字段 ——
 *     逐个列就得抄 16 个字段名，抄错一个或漏一个都是静默的。）
 *
 * 哪些字段是「编」的
 *   下面这些字段**只在这个接口的返回里有**，节点的 atoms[] 里没有，mock 只能自己造：
 *   - aaiAtomConfig.idc         按下方 IDC_POOL 稳定挑一个（mock 里 239 条配置全都没有 idc）
 *   - functions[].funcChName    按函数名从下方 FUNC_CN 推导（推导不出就用 funcName）
 *                               ⚠️ 是 **Ch** 不是 Cn（Chinese 的 Ch）—— 后端就是这个拼法，
 *                                 页面（AtomDetailDialog 的「函数」列）也按它取，改回 Cn 会让那一列变空。
 *   - functions[].manual        按函数名稳定分桶（见 manualOf）：约 1/4 为 'N'（执行按钮置灰），
 *                               其余 'Y'。**原来是固定 'N'，导致所有执行按钮全灰、功能像没做。**
 *   - functions[].maxRetryNum   固定 3
 *
 * 接入真实接口后怎么删
 *   1. 删掉本文件
 *   2. 删掉 execPlan.js 顶部的 import，以及 queryAotmOfNode 里标注「演示用」的那一段
 * ==========================================================================
 */

/** 函数动作 -> 中文名。只覆盖 mock 数据里出现过的动作，未命中时回落成 funcName */
const FUNC_CN = {
  app_start: '应用启动',
  app_stop: '应用停止',
  backup: '备份',
  backup_exec: '备份执行',
  config_update: '配置更新',
  db_change: '数据库变更',
  env_check: '环境检查',
  health_check: '健康检查',
  notify: '通知',
  silence_alert: '屏蔽告警',
  unsilence_alert: '取消屏蔽告警',
  smoke_test: '冒烟测试',
  traffic_off: '流量摘除',
  traffic_on: '流量挂载',
  version_update: '版本更新',
  atom_exec: '原子执行',
  atom_exec_verify: '原子执行验证',
  update_execuser: '更新执行人',
  update_execuser_verify: '更新执行人验证',
  judge_alert_silence: '判断告警屏蔽'
}

/** 函数名后缀 -> 中文名 */
const FUNC_SUFFIX_CN = { befor: '前置', status: '状态' }

/** 算作「失败」的函数状态（与执行状态字典保持一致） */
const BAD = new Set(['FAILED', 'VERIFY_FAIL'])

/** 处于「进行中」的原子状态：函数列表要有一个停在当前函数上 */
const RUNNING = new Set(['RUNNING', 'VERIFY_EXEC', 'DEPEND_WAIT', 'CONFIRM', 'DEPEND_CONFIRM'])

/**
 * 机房（idc）候选值。
 *
 * 取的是 mock 里 `systemProfileRes.组件拓扑.*.idc` 真实出现过的三个值：
 *   BJ-NFX 北京南法信 / BJ-DB 北京东坝 / HF 合肥
 *
 * ⚠️ 真实接口的 aaiAtomConfig 里带 idc，而 mock 的 239 条原子配置**一条都没有**，
 *    所以这里按稳定哈希挑一个。**挑出来的归属是编的**，只保证：
 *      - 每个原子每次挑到的是同一个机房（不会刷新一次跳一次）
 *      - 用到的都是本项目数据里真实存在的机房代码，不会出现凭空造的名字
 *    接入真实接口后这段整个删掉即可。
 */
const IDC_POOL = ['BJ-NFX', 'BJ-DB', 'HF']

/**
 * FNV-1a 32 位哈希。用于「同一输入 -> 同一输出」的稳定分桶，
 * 和 `_demoTick.js` 里给节点安排过程态用的是同一套办法。
 */
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * 安全解析 JSON 字符串。真实数据里出现过空串 / null / 坏 JSON，
 * 裸 JSON.parse 会把整个明细渲染搞崩。
 * @returns {*} 解析失败一律返回 null
 */
function readJson(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return null
  }
  if (typeof raw !== 'string') {
    return raw
  }
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

/**
 * 给原子配置补上 idc。
 *
 * 解析不了（空串 / 坏 JSON / 不是对象）就**原样返回原始字符串** ——
 * 宁可这一行机房列空着，也不能把原始数据改坏。
 * 已经有 idc 的更不动。
 *
 * @param {String} configRaw aaiAtomConfig 原始字符串
 * @param {*} seed 稳定分桶用的种子（用 aaiInstanceAtomId）
 * @returns {String} 字符串化 JSON
 */
function withIdc(configRaw, seed) {
  const obj = readJson(configRaw)
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return configRaw
  }
  if (obj.idc) {
    return configRaw
  }
  obj.idc = IDC_POOL[fnv1a(String(seed)) % IDC_POOL.length]
  return JSON.stringify(obj)
}

/**
 * 按函数名推导中文名
 *   func_<模块>_<动作>[_befor|_status]  ->  「<模块> <动作中文><后缀中文>」
 * 例：func_release_app_start_befor -> 「release 应用启动前置」
 * 推导不出动作时原样返回 funcName（不编造）。
 */
function cnNameOf(funcName) {
  const s = String(funcName || '')
  if (!s.startsWith('func_')) {
    return s
  }
  const parts = s.slice(5).split('_')
  let suffix = ''
  const last = parts[parts.length - 1]
  if (parts.length > 1 && FUNC_SUFFIX_CN[last]) {
    suffix = FUNC_SUFFIX_CN[parts.pop()]
  }
  // 从后往前试最长的动作名（动作本身可能带下划线，如 atom_exec_verify）
  for (let len = Math.min(3, parts.length); len >= 1; len--) {
    const action = parts.slice(parts.length - len).join('_')
    if (FUNC_CN[action]) {
      const module = parts.slice(0, parts.length - len).join('_')
      return (module ? module + ' ' : '') + FUNC_CN[action] + suffix
    }
  }
  return s
}

/**
 * 把 aaiInstanceFunctionName 里的一项展开成 functions[] 的行
 *
 * ⚠️ manual / maxRetryNum 是编的（真实值由后端函数字典下发）。
 *    confirm 优先取数据里自带的 afResConfirm（postFunc 才有）。
 */
function toFunctionRow(fn, index, total, atomStatus) {
  const isLast = index === total - 1
  // 原子在跑：最后一个函数是「进行中」，前面的都已完成；否则函数状态跟随原子
  const status = RUNNING.has(atomStatus) ? (isLast ? atomStatus : 'SUCCESS') : atomStatus
  return {
    confirm: fn.afResConfirm || 'N',
    // ⚠️ 字段名是 funcChName（Ch = Chinese），不是 funcCnName —— 用户确认过，别「顺手改顺」
    funcChName: cnNameOf(fn.funcName),
    funcName: fn.funcName,
    funcType: fn.funcType,
    groupIndex: String(fn.groupIndex === undefined || fn.groupIndex === null ? '' : fn.groupIndex),
    manual: manualOf(fn.funcName),
    maxRetryNum: 3,
    status,
    stepIndex: String(fn.stepIndex === undefined || fn.stepIndex === null ? '' : fn.stepIndex)
  }
}

/**
 * 函数「是否允许手动执行」—— `manual === 'N'` 会让「执行」按钮置灰
 * （组件里的 `execDisableFnc`）。
 *
 * ⚠️ **这个值是编的**：真实取值由后端函数字典下发，`aaiInstanceFunctionName` 里
 *    根本没有这个字段（一条都没有）。之前固定写 `'N'`，后果是
 *    **所有函数的「执行」按钮全是灰的**，功能看着像没做 —— 用户就是这么反馈的。
 *
 *    这里改成按函数名**稳定分桶**（FNV-1a 哈希，和 idc 分桶同一套办法）：
 *    约 1/4 的函数 `'N'`（保留「置灰」这一态可看），其余 `'Y'`（可点、能跑通链路）。
 *    同一个函数每次投影结果一致，刷新不会跳。
 *
 *    想让全部可执行：把 `MANUAL_DISABLED_MOD` 改成 0（`n % 0` 走不到，见下面判断）。
 */
const MANUAL_DISABLED_MOD = 4

function manualOf(funcName) {
  if (!MANUAL_DISABLED_MOD) {
    return 'Y'
  }
  return fnv1a(String(funcName)) % MANUAL_DISABLED_MOD === 0 ? 'N' : 'Y'
}

/**
 * 原子状态的「操作覆盖表」：`{ [aaiInstanceAtomId]: 'SKIP' | 'SUCCESS' }`
 *
 * 为什么需要它 —— 踩过一次，记下来：
 *   `getExecuteIndex` 每次都会 `JSON.parse(JSON.stringify(res))` 深拷贝一份数据
 *   （`_demoTick` 要在一份**可写副本**上推进状态，否则多次轮询会叠加），
 *   所以**页面持有的节点和 executeResMap 里的原始节点是两套独立对象**。
 *   「确认完成 / 跳过」只改原始数据的话，页面那份副本读不到 ——
 *   表现为「提示操作成功，但表格里的状态没变」，看着像接口没生效。
 *   这里用一张**模块级**的覆盖表把结果带过去：投影时（buildOne）应用，
 *   页面重新拉明细就能看到；轮询重建副本也不影响它。
 *
 * 演示专用：接入真实接口后，本表与 setAtomStatusOverride 一起删掉。
 */
const ATOM_STATUS_OVERRIDE = {}

/**
 * 记录一次原子操作的结果（演示用，见 ATOM_STATUS_OVERRIDE 的说明）。
 * @param {Number|String} aaiInstanceAtomId
 * @param {String} status 目标状态，如 'SKIP' / 'SUCCESS'
 */
export function setAtomStatusOverride(aaiInstanceAtomId, status) {
  ATOM_STATUS_OVERRIDE[String(aaiInstanceAtomId)] = status
}

/**
 * 函数状态的覆盖表：`{ [原子id]: { [函数名]: 'SKIP' | 'RUNNING' } }`
 *
 * 与 ATOM_STATUS_OVERRIDE 同一个理由 —— 「跳过函数」「手动执行函数」改的是
 * `aaiInstanceFunctionName` 里的 status，而页面持有的节点是深拷贝副本，
 * 只改原始数据的话重新拉明细读不到，表现为「操作成功但状态没变」。
 */
const FUNC_STATUS_OVERRIDE = {}

/**
 * 记录一次函数级操作的结果（演示用）。
 * @param {Number|String} aaiInstanceAtomId
 * @param {String} funcName
 * @param {String} status 目标状态，如 'SKIP' / 'RUNNING'
 */
export function setFuncStatusOverride(aaiInstanceAtomId, funcName, status) {
  const key = String(aaiInstanceAtomId)
  if (!FUNC_STATUS_OVERRIDE[key]) {
    FUNC_STATUS_OVERRIDE[key] = {}
  }
  FUNC_STATUS_OVERRIDE[key][String(funcName)] = status
}

/**
 * 把一个节点的 atoms[] 里的一项，补成接口返回的一行。
 *
 * 用 Object.assign 展开原始对象：原始字段一个不动、一个不漏，
 * 只覆盖 aaiAtomConfig（补 idc）并追加 functions / 两个计数。
 */
function buildOne(raw) {
  const atomKey = String(raw.aaiInstanceAtomId)
  // 被「确认完成 / 跳过」操作过的原子，状态以覆盖表为准
  const status = ATOM_STATUS_OVERRIDE[atomKey] || raw.aaiAtomStatus
  const funcOver = FUNC_STATUS_OVERRIDE[atomKey] || {}
  const fns = readJson(raw.aaiInstanceFunctionName)
  const list = Array.isArray(fns) ? fns : []
  const functions = list.map((fn, i) => {
    const row = toFunctionRow(fn, i, list.length, status)
    // 被「跳过函数 / 手动执行」操作过的函数，状态以覆盖表为准
    const ov = funcOver[String(fn.funcName)]
    return ov ? Object.assign({}, row, { status: ov }) : row
  })

  return Object.assign({}, raw, {
    aaiAtomConfig: withIdc(raw.aaiAtomConfig, raw.aaiInstanceAtomId),
    aaiAtomStatus: status,
    functions,
    failedFunctionCount: functions.filter(f => BAD.has(f.status)).length,
    totalFunctionCount: functions.length
  })
}

/**
 * 拼出 queryAotmOfNode 的 mock 返回
 * @param {Object} node wf.nodes[] 里的一个节点（自带 atoms[]）
 * @returns {Object} { code, msg, data }
 */
export function buildAtomRes(node) {
  const atoms = Array.isArray(node && node.atoms) ? node.atoms : []
  return {
    code: 200,
    msg: '操作成功',
    data: atoms.map(raw => buildOne(raw))
  }
}

export default { buildAtomRes, setAtomStatusOverride, setFuncStatusOverride }
