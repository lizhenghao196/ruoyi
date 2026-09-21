/**
 * 工单甘特图演示数据生成器（纯函数，不依赖 Vue / DOM）
 * ==========================================================================
 * 为什么需要它
 *   mockData/res.js 里的 `orderRes` **只有 3 条** —— 那是用户给的样例，只用来定
 *   「字段长什么样」。真实场景一次最多返回 **100 条**，所以这里以那 3 条为模板，
 *   按同一形状把数据补齐到 100 条。
 *
 * 时间怎么定（用户给的约束，别改）
 *   1. beginTime 基本落在「今天 18:00 ~ 次日 06:00」这 12 小时窗口里（约 84% 的工单）；
 *   2. 剩下的散在窗口之后，但**整体跨度绝不超过 3 天**（今天 18:00 + 72h 是硬上界）；
 *   3. 于是 x 轴跨度是 12h ~ 3 天，**不能写死成 12 小时** —— 刻度必须自适应。
 *      这条约束的落地在 ganttLayout.js 的 pickStepMinutes，本文件只保证数据不越界。
 *
 * 尾部为什么要「偏置」而不是均匀撒
 *   x 轴跨度由**最晚那条工单**决定。若尾部均匀撒到 60 小时外，只要有一条落在很后面，
 *   整条 x 轴就被撑到 3 天，前面那 84 条挤在主窗口里的工单会被压成一堆细线，
 *   图完全没法看（真实业务里也是这个毛病）。所以尾部用 pow(rnd, SPILL_BIAS) 往
 *   mainEnd 偏：多数只超出几小时，跨度稳定在 24 小时上下，主密集区能占到一半宽度。
 *   要验「3 天跨度也能画」，直接跑 ganttLayout 的断言，不用改这里的分布。
 *
 * 为什么用固定种子的伪随机
 *   每次点「查看」都换一批数据，截图 / 联调 / 复现问题都没法对齐。
 *   这里用 mulberry32 + 固定种子，**同一天内每次生成的结果完全一致**。
 *   （种子固定 → 数据稳定；窗口锚点用「今天 18:00」→ 日期跟着当天走。）
 *
 * 用户给的 3 条样例怎么处理
 *   `orderId` / `mode` / `detail` **原样保留**，只把 `beginTime` / `endTime`
 *   重新锚定到演示窗口里 —— 样例里的时间是 2026-09-17 / 09-18，直接用会把 x 轴
 *   撑到 7 天，直接违反上面第 2 条约束。
 *   `total_cost` **样例单保留自己的值**（115 / 135 / 135），其余按 mode 的时长区间随机。
 *   起止时间统一按 `beginTime + total_cost` 重算，保证「耗时」和「起止时间」自洽
 *   （样例里 `total_cost: 115` 配 `beginTime === endTime`，两者本来就是打架的）。
 *   ⚠️ 样例单的 total_cost 不能覆盖：样例 1 是 AUTO 但耗时 115 分钟，
 *      一覆盖成 AUTO 区间（8~30 分钟），它的 detail 明细耗时之和就比总耗时大了。
 *
 * detail 的形态（2026-09-21 变更，别改回去）
 *   **对象数组**，每项字段固定：`{ type, count, type_cost }`。
 *   悬浮气泡用**表格**展示，表头就是这三个 key —— 不再是 JsonViewer，
 *   所以这里**不能**再造「嵌套 / 空值 / 深嵌套」那类结构，表格会没法渲染。
 *   两条自洽约束（用户样例全部满足，断言也钉住了）：
 *     1. `type_cost` 是 5 的整数倍；
 *     2. `sum(type_cost) <= total_cost`（明细耗时是总耗时的一部分）。
 *
 * 和页面/组件的接口
 *   只导出 `buildOrderList()` 和几个格式化辅助；生成结果的字段与 orderRes.data 完全同形。
 * ==========================================================================
 */

export const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

/** 演示数据的目标条数（真实场景「最多 100 个」） */
export const DEMO_ORDER_COUNT = 100

/** 固定种子：换掉它就等于换一批数据，但同一天内保持稳定 */
const DEMO_SEED = 20260921

/** 主窗口占比：其余散到主窗口之后（但不超过 3 天硬上界） */
const MAIN_WINDOW_RATIO = 0.84

/** 尾部最大外溢小时数 + 偏置指数（越大越贴着 mainEnd，跨度越短） */
const SPILL_HOURS = 14
const SPILL_BIAS = 1.4

/** AUTO 工单偏短、MANUAL 偏长 —— 这决定了甘特图下半区（AUTO）会很紧凑 */
const AUTO_DURATION = [8, 30]
const MANUAL_DURATION = [40, 180]

/** 起始时间对齐粒度（分钟）：让矩形边界落在整点上，看着才整齐 */
const AUTO_ALIGN_MINUTES = 5
const MANUAL_ALIGN_MINUTES = 10

/* ------------------------------------------------------------------ 工具 */

/**
 * mulberry32：32 位种子伪随机，短小且分布够用。
 * 刻意不用 Math.random —— 那个没法复现。
 */
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rnd, min, max) {
  if (max < min) {
    return min
  }
  return min + Math.floor(rnd() * (max - min + 1))
}

/** 从 list 里随机取 n 个（不重复、不改原数组） */
function sample(rnd, list, n) {
  const copy = list.slice()
  const out = []
  const take = Math.min(n, copy.length)
  for (let i = 0; i < take; i += 1) {
    const idx = randInt(rnd, 0, copy.length - 1)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function pad4(n) {
  const s = '' + n
  return s.length >= 4 ? s : '0000'.slice(s.length) + s
}

/** 时间戳 -> 'YYYY-MM-DD HH:mm:ss'（本地时区，和 orderRes 的格式一致） */
export function formatDateTime(ts) {
  const d = new Date(ts)
  return (
    d.getFullYear() +
    '-' +
    pad2(d.getMonth() + 1) +
    '-' +
    pad2(d.getDate()) +
    ' ' +
    pad2(d.getHours()) +
    ':' +
    pad2(d.getMinutes()) +
    ':' +
    pad2(d.getSeconds())
  )
}

function compactDate(ts) {
  const d = new Date(ts)
  return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
}

/** 把时间戳对齐到 step 分钟的整数倍（本地时钟边界，因为东八区偏移是 60 的整数倍） */
function alignTo(ts, stepMinutes) {
  const step = stepMinutes * MINUTE_MS
  return Math.round(ts / step) * step
}

/**
 * 演示窗口：今天 18:00 起。
 *
 * - start    主窗口起点 = 今天 18:00
 * - mainEnd  主窗口终点 = 次日 06:00（12 小时）
 * - hardEnd  硬上界     = 今天 18:00 + 72h（也就是第 3 天的 18:00）
 *
 * @param {Date|number} [now] 锚点时间，默认取当前时刻（测试时可注入固定值）
 */
export function demoWindow(now) {
  const t = now instanceof Date ? now : new Date(now == null ? Date.now() : now)
  const start = new Date(
    t.getFullYear(),
    t.getMonth(),
    t.getDate(),
    18,
    0,
    0,
    0
  ).getTime()
  return {
    start,
    mainEnd: start + 12 * 60 * MINUTE_MS,
    hardEnd: start + 3 * DAY_MS
  }
}

/* ---------------------------------------------------- detail 的形态池 */

/**
 * detail 是**对象数组**，每项字段固定：`{ type, count, type_cost }`。
 * 悬浮气泡用**表格**展示（表头就是这三个 key），不再是 JsonViewer。
 *
 * 为什么要有一份固定的类型词表
 *   演示数据要能一眼看出「表格列宽/换行」扛不扛得住长文本，
 *   所以类型名故意长短混着来（最短「配置发布」4 字，最长 15 字）。
 *   前 5 个是用户样例里出现过的，原样收进来，别改。
 */
const CHANGE_TYPES = [
  '容器云工程发布/重启',
  '数据库发布',
  '配置发布',
  'ITSM_原子变更_YUM包更新',
  'ITSM_屏蔽告警',
  'ITSM_原子变更_主机重启',
  'ITSM_原子变更_配置刷新',
  '中间件发布',
  '网络策略变更',
  '证书更新',
  '批量脚本执行',
  '监控阈值调整'
]

/** type_cost 的最小步长（分钟）：样例里所有 type_cost 都是 5 的整数倍 */
const COST_UNIT = 5
/** 一条工单的 detail 最多几项（样例是 1~3 项，留点余量） */
const MAX_DETAIL_ITEMS = 5
/** 单项 count 的取值范围（样例里出现过 1 / 2 / 5） */
const COUNT_RANGE = [1, 6]

/**
 * 把 budget 个「5 分钟」随机切成 n 份，每份至少 1 份。
 * 用来把 total_cost 摊到各变更类型上，保证 **sum(type_cost) <= total_cost**
 * （用户给的 3 条样例都满足这个关系：50<=115 / 5<=135 / 55<=135）。
 */
function splitUnits(rnd, budget, n) {
  const parts = new Array(n).fill(1)
  let left = budget - n
  while (left > 0) {
    const add = randInt(rnd, 1, left)
    parts[randInt(rnd, 0, n - 1)] += add
    left -= add
  }
  return parts
}

/**
 * 造一条工单的 detail（对象数组）。
 *
 * @param {Function} rnd       伪随机源
 * @param {number}   totalCost 该工单的 total_cost（分钟），用来给 type_cost 定上界
 */
function buildDetail(rnd, totalCost) {
  const totalUnits = Math.max(1, Math.floor(totalCost / COST_UNIT))
  const n = randInt(rnd, 1, Math.min(MAX_DETAIL_ITEMS, totalUnits))
  // 预算取 35%~85%，别把 total_cost 占满 —— 样例里 type_cost 之和都明显小于 total_cost
  const budget = Math.max(n, Math.round(totalUnits * (0.35 + rnd() * 0.5)))
  const costs = splitUnits(rnd, Math.min(budget, totalUnits), n)

  return sample(rnd, CHANGE_TYPES, n).map((type, i) => ({
    type,
    count: randInt(rnd, COUNT_RANGE[0], COUNT_RANGE[1]),
    type_cost: costs[i] * COST_UNIT
  }))
}

/* -------------------------------------------------------------- 主入口 */

function normalizeMode(mode) {
  const m = String(mode == null ? '' : mode).toUpperCase()
  return m === 'AUTO' ? 'AUTO' : 'MANUAL'
}

/**
 * 造一条工单。
 *
 * @param {Function} rnd   伪随机源
 * @param {Object}   ctx   上下文（窗口 / 序号 / 可选的模板）
 */
function makeOrder(rnd, ctx) {
  const { start, mainEnd, hardEnd } = ctx.window
  const template = ctx.template || null

  const mode = template ? normalizeMode(template.mode) : rnd() < 0.42 ? 'AUTO' : 'MANUAL'
  const range = mode === 'AUTO' ? AUTO_DURATION : MANUAL_DURATION
  /**
   * 时长取法：**样例单用样例自己的 total_cost**，其余按 mode 的区间随机。
   *
   * ⚠️ 样例单必须保留自己的 total_cost，不能用 mode 区间覆盖 —— 样例 1 是 AUTO
   *    但 `total_cost: 115`，而 AUTO 区间是 8~30 分钟；一覆盖，
   *    它的 detail 明细耗时之和（50）就比 total_cost 还大，
   *    「明细是总耗时的一部分」这个关系当场破掉（实测就是这么被断言抓到的）。
   *    样例的 total_cost 本来就属于「原样保留」的一部分，别动。
   */
  const seedCost = template ? Number(template.total_cost) : NaN
  const durationMinutes =
    Number.isFinite(seedCost) && seedCost > 0 ? Math.round(seedCost) : randInt(rnd, range[0], range[1])
  const durationMs = durationMinutes * MINUTE_MS

  // 84% 落在主窗口 [18:00, 次日 06:00]，其余散到 [次日 06:00, +SPILL_HOURS]（偏置靠前）
  const inMainWindow = rnd() < MAIN_WINDOW_RATIO
  const latestStart = Math.max(start, hardEnd - durationMs)
  const from = inMainWindow ? start : mainEnd
  let to
  if (inMainWindow) {
    to = Math.max(start, mainEnd - durationMs)
  } else {
    const spillTo = Math.min(mainEnd + SPILL_HOURS * 60 * MINUTE_MS, latestStart)
    to = mainEnd + (spillTo - mainEnd) * Math.pow(rnd(), SPILL_BIAS)
    to = Math.min(Math.max(to, mainEnd), latestStart)
  }

  const align = mode === 'AUTO' ? AUTO_ALIGN_MINUTES : MANUAL_ALIGN_MINUTES
  let beginTs = alignTo(randInt(rnd, from, to), align)
  // 对齐可能把起点推过界（尤其散在尾部的），夹回来
  if (beginTs < start) {
    beginTs = start
  }
  if (beginTs > latestStart) {
    beginTs = latestStart
  }
  const endTs = beginTs + durationMs

  // 样例的 orderId 原样保留；新造的按「开始日期 + 序号」生成
  const orderId = template
    ? template.orderId
    : 'CHGU-' + compactDate(beginTs) + '-' + pad4(ctx.seq)

  const beginTime = formatDateTime(beginTs)
  const endTime = formatDateTime(endTs)

  // detail：样例有就用样例的（原样保留，已经是对象数组），否则按固定字段造一条
  const detail =
    template && template.detail ? template.detail : buildDetail(rnd, durationMinutes)

  return {
    orderId,
    total_cost: durationMinutes, // 分钟，与 beginTime/endTime 自洽
    beginTime,
    endTime,
    mode,
    detail
  }
}

/**
 * 生成演示工单列表。
 *
 * @param {Object}   [options]
 * @param {Array}    [options.seeds] 用户给的样例（orderRes.data），原样保留 orderId/mode/detail
 * @param {number}   [options.count] 目标条数，默认 100
 * @param {number}   [options.seed]  伪随机种子，默认固定值
 * @param {Date|number} [options.now] 演示窗口锚点，默认当前时刻
 * @returns {Array<Object>} 与 orderRes.data 同形的数组
 */
export function buildOrderList(options) {
  const opts = options || {}
  const seeds = Array.isArray(opts.seeds) ? opts.seeds.filter(Boolean) : []
  const count = opts.count > 0 ? opts.count : DEMO_ORDER_COUNT
  const rnd = mulberry32(opts.seed == null ? DEMO_SEED : opts.seed)
  const window = demoWindow(opts.now)

  const list = []
  let seq = 1

  // 1) 样例先行：形状照抄，时间重新锚定到演示窗口
  seeds.forEach((seed) => {
    list.push(makeOrder(rnd, { window, seq: seq++, template: seed }))
  })

  // 2) 补齐到 count 条
  while (list.length < count) {
    list.push(makeOrder(rnd, { window, seq: seq++ }))
  }

  return list
}

export default buildOrderList
