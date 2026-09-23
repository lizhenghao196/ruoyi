/**
 * 工单甘特图布局（纯函数，不依赖 Vue / DOM）
 * ==========================================================================
 * 为什么单独拆出来
 *   甘特图难的部分是「算」不是「画」：时间域、刻度步长、行分配、像素几何。
 *   这些全是纯函数 —— 可以在 node 里直接断言，不用起浏览器、不用开 webpack。
 *   组件（components/OrderGantt.vue）只负责把算好的数字贴到 style 上。
 *
 * 三条不能改的规则
 *   1. **矩形宽度以 `total_cost` 为准**（`beginTime + total_cost 分钟`），
 *      `endTime` 只是 total_cost 缺失时的兜底。样例里这两个字段本来就打架
 *      （见 api/tool/orderGantt.js 的说明），判定只此一处，别在组件里再写一遍。
 *   2. **AUTO 工单排在下方（贴近 x 轴）**，其余（含 MANUAL 和任何未知 mode）排在上面。
 *      两组各自贪心装箱；两组之间留一条带标签的分隔带。
 *   3. **x 轴跨度自适应**：12 小时 ~ 3 天都能画，刻度步长从候选表里挑，
 *      保证刻度数不超过 maxTicks。
 *
 * 行分配算法
 *   贪心区间装箱：把工单按开始时间排序，逐个塞进「最后一个 bar 已经结束」的一行；
 *   塞不进就新开一行。所以「互不重叠的工单共用一行」，行数 = 最大并发数。
 *   注意判据是 `rowEnd <= item.start`（**端点相接算不重叠**），
 *   改成 `<` 会让大量相邻工单白白多占一行。
 *   方向默认**从下往上**（fromBottom）—— 优先塞进靠近 x 轴的行，空的留在最上面。
 *   细节见 packRows 的注释，那里写了为什么必须是两遍、以及为什么方向不改行数。
 *
 * 坐标约定
 *   全部是**像素**，且相对图表左上角：
 *     x 轴向右为正，domain.start 对应 x = 0，domain.end 对应 x = plotWidth；
 *     y 轴向下为正，第 0 行在顶部（**所以 AUTO 分组的 top 更大**）。
 *
 * plotWidth 谁来定
 *   本模块**不猜**宽度，由调用方传进来。组件的算法是：
 *     plotWidth = max(容器可用宽度, 跨度小时数 × MIN_PX_PER_HOUR)
 *   也就是「跨度大就把绘图区撑开、横向滚动」，而不是把主密集区压成一堆细线。
 *   所以本模块只负责「给定宽度下把矩形摆对」，滚动与否是组件的事。
 * ==========================================================================
 */

export const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

/** 起止时间都取不到时，矩形按这个宽度兜底（分钟） */
export const DEFAULT_DURATION_MIN = 30

/** 刻度步长候选（分钟）。都是能整除 1 天的值，这样刻度才能对齐到整点/整天 */
const STEP_CANDIDATES = [15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880]

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/* ------------------------------------------------------------ 时间解析 */

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 把接口给的时间转成时间戳。
 *
 * 刻意**不用 `new Date(str)` 直接解析**：'2026-09-17 22:00:00' 这种带空格、
 * 不带时区的格式在部分浏览器（老 Safari）会被判成 Invalid Date，
 * 而 mock 阶段用 Chrome 完全看不出来。这里用正则自己拆，行为确定。
 *
 * 支持：Date 对象 / 数字时间戳 / 'YYYY-MM-DD HH:mm:ss' / 'YYYY/MM/DD HH:mm' /
 *      'YYYY-MM-DDTHH:mm:ss'；日期部分必须有，时间部分可缺省（按 00:00:00）。
 *
 * @param {*} value
 * @returns {number|null} 时间戳，解析不出来返回 null
 */
export function parseTime(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (value instanceof Date) {
    const t = value.getTime()
    return isNaN(t) ? null : t
  }
  if (typeof value === 'number') {
    return isFinite(value) ? value : null
  }
  const s = String(value).trim()
  if (!s) {
    return null
  }
  const m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  )
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
      0
    )
    const t = d.getTime()
    return isNaN(t) ? null : t
  }
  const t = new Date(s).getTime()
  return isNaN(t) ? null : t
}

/** 当天 00:00:00.000 的时间戳（本地时区） */
export function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function toPositiveNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number(value)
  if (!isFinite(n) || n <= 0) {
    return null
  }
  return n
}

/**
 * mode 归一化：只认 'AUTO'，其余（'MANUAL' / 空 / 未知值 / 大小写不一致）全归 MANUAL。
 * 反过来「不是 MANUAL 就当 AUTO」会踩坑：字段缺失时会静默把工单画到自动分组里，
 * 而用户看到的是「我明明没配自动」。
 */
export function normalizeMode(mode) {
  return String(mode == null ? '' : mode).trim().toUpperCase() === 'AUTO'
    ? 'AUTO'
    : 'MANUAL'
}

/**
 * 解析一条工单占用的时间区间 —— **矩形多宽就由这里说了算**。
 *
 * 规则（顺序是刻意的）：
 *   1. beginTime 解析不出来  → 返回 null，这条不画（调用方计入 invalidCount）
 *   2. total_cost > 0        → 时长 = total_cost 分钟  ← **主判据**
 *   3. 否则 endTime > beginTime → 时长 = 两者之差（兜底）
 *   4. 都没有                 → 时长 = DEFAULT_DURATION_MIN
 *
 * 第 2 步优先于第 3 步：`endTime` 在这份数据里**不代表工单实际占用的时间**，
 * 只按 total_cost 画。样例 3 起止跨 6 小时（360 分钟）但 total_cost 只有 135，
 * 按 endTime 画出来的矩形会凭空长出一倍多，用户看到的「结束时间」是错的。
 *
 * 第 3 步留着是纯兜底：total_cost 缺失时，宁可退回起止时间差，
 * 也不要给所有工单都画成固定 30 分钟 —— 那才是彻底看不出信息。
 *
 * @param {Object} item
 * @returns {{start:number, end:number, durationMinutes:number, fromCost:boolean}|null}
 *          fromCost = 时长不是由起止时间差算出来的（total_cost 或兜底宽度）
 */
export function resolveSpan(item) {
  const start = parseTime(item && item.beginTime)
  if (start === null) {
    return null
  }
  const end = parseTime(item && item.endTime)
  const cost = toPositiveNumber(item && item.total_cost)

  let durationMinutes
  let fromCost = false
  if (cost !== null) {
    durationMinutes = cost
    fromCost = true
  } else if (end !== null && end > start) {
    durationMinutes = (end - start) / MINUTE_MS
  } else {
    durationMinutes = DEFAULT_DURATION_MIN
    fromCost = true
  }

  return {
    start,
    end: start + durationMinutes * MINUTE_MS,
    durationMinutes,
    fromCost
  }
}

/* --------------------------------------------------------- 时间轴 / 刻度 */

/** 所有工单的并集区间；没有有效工单时返回 null */
export function buildDomain(spans) {
  let min = Infinity
  let max = -Infinity
  ;(Array.isArray(spans) ? spans : []).forEach((s) => {
    if (!s) {
      return
    }
    if (s.start < min) {
      min = s.start
    }
    if (s.end > max) {
      max = s.end
    }
  })
  if (!isFinite(min) || !isFinite(max)) {
    return null
  }
  // 所有工单都是零时长时给一个最小可视宽度，否则后面会除以 0
  if (max - min < 5 * MINUTE_MS) {
    max = min + 5 * MINUTE_MS
  }
  return { start: min, end: max }
}

/**
 * 挑刻度步长：从候选表里选**第一个**能满足「格数 <= maxTicks」的。
 *
 * 从最小的候选开始选 = 在够用的前提下取最细的粒度，刻度信息量最大。
 * 候选表全部能整除 1 天，所以 alignDomain 把起点对齐到当天 00:00 的整数倍之后，
 * 跨天的刻度依然落在整点上。
 *
 * ⚠️ maxTicks 是**格数**（区间数）上限，不是标签数：n 格会产出 n + 1 个刻度标签
 *    （首尾各一个边界）。所以 12 格 = 13 个标签，别按「标签数」去理解它。
 *
 * @param {number} spanMinutes
 * @param {number} [maxTicks=10] 格数上限
 */
export function pickStepMinutes(spanMinutes, maxTicks) {
  const limit = maxTicks > 0 ? maxTicks : 10
  const span = spanMinutes > 0 ? spanMinutes : 1
  for (let i = 0; i < STEP_CANDIDATES.length; i += 1) {
    if (span / STEP_CANDIDATES[i] <= limit) {
      return STEP_CANDIDATES[i]
    }
  }
  return STEP_CANDIDATES[STEP_CANDIDATES.length - 1]
}

/** 候选表里的下一档（已经最大就原样返回） */
function nextStepMinutes(step) {
  const i = STEP_CANDIDATES.indexOf(step)
  return i >= 0 && i < STEP_CANDIDATES.length - 1 ? STEP_CANDIDATES[i + 1] : step
}

/**
 * 把时间域向外扩到刻度边界：起点向下取整、终点向上取整。
 * 这样第一个/最后一个刻度一定落在图表边缘，不会出现「半格」。
 */
export function alignDomain(domain, stepMinutes) {
  if (!domain) {
    return null
  }
  const step = Math.max(1, stepMinutes) * MINUTE_MS
  const base = startOfDay(domain.start)
  return {
    start: base + Math.floor((domain.start - base) / step) * step,
    end: base + Math.ceil((domain.end - base) / step) * step
  }
}

/**
 * 生成刻度。`dayStart` 标记「正好落在当天 00:00」的刻度 —— 组件用它画加粗的日分隔线。
 */
export function buildTicks(domain, stepMinutes) {
  if (!domain) {
    return []
  }
  const step = Math.max(1, stepMinutes) * MINUTE_MS
  const base = startOfDay(domain.start)
  const first = base + Math.floor((domain.start - base) / step) * step
  const ticks = []
  for (let t = first, i = 0; t <= domain.end && i < 400; t += step, i += 1) {
    ticks.push({ time: t, dayStart: t === startOfDay(t) })
  }
  return ticks
}

/**
 * 按自然日切分时间域，供顶部日期带使用。
 * 首段从 domain.start 开始、末段到 domain.end 结束（所以首末段可能不满一天）。
 */
export function buildDaySegments(domain) {
  if (!domain) {
    return []
  }
  const segs = []
  let cursor = domain.start
  let guard = 0
  while (cursor < domain.end && guard < 400) {
    const dayStart = startOfDay(cursor)
    const end = Math.min(dayStart + DAY_MS, domain.end)
    segs.push({ start: cursor, end, dayStart })
    cursor = end
    guard += 1
  }
  return segs
}

/* ------------------------------------------------------------- 行分配 */

/**
 * 贪心 first-fit 需要的**行数**。
 *
 * 对区间图来说，按 start 升序 + first-fit 得到的行数就是**最大并发数**，也是最优值：
 * 当某条工单放不进任何已有行时，说明每一行里都有一条和它重叠的工单，
 * 于是存在 size = 行数 + 1 的两两重叠集合 —— 少一行一定放不下。
 * 所以这个值可以当「最优行数」用，第二遍装箱直接拿它当总行数。
 *
 * @param {Array<{start:number,end:number}>} items **必须已按 start 升序**
 */
function countRowsNeeded(items) {
  const rowEnds = []
  ;(Array.isArray(items) ? items : []).forEach((item) => {
    let row = -1
    for (let i = 0; i < rowEnds.length; i += 1) {
      // 端点相接（rowEnd === start）算不重叠，共用一行
      if (rowEnds[i] <= item.start) {
        row = i
        break
      }
    }
    if (row === -1) {
      rowEnds.push(item.end)
    } else {
      rowEnds[row] = item.end
    }
  })
  return rowEnds.length
}

/**
 * 贪心区间装箱。
 *
 * ⚠️ **方向很重要**：`fromBottom` 默认 true —— 优先往「更靠近 x 轴的行」放。
 *    从上往下放（false）会让上面挤成一片、下面稀稀拉拉：实测 100 条里有 38 条
 *    明明能再往下挪一格，用户一眼就看出来了（「CHGU-...-0016 可以往下摞呀」）。
 *    甘特图的基准线是 x 轴，所以视觉上应该**从轴往上长**，空的留在最上面。
 *
 * 为什么是两遍：第二遍要「从最后一行往前找」，就得先知道总行数。
 * 第一遍用普通 first-fit 求出最优行数（见 countRowsNeeded），第二遍才定向装箱。
 * 两遍的行数必然一致 —— 方向不影响 first-fit 的行数（上面那段证明）。
 *
 * @param {Array<{start:number,end:number}>} items **必须已按 start 升序**
 * @param {Object} [options]
 * @param {boolean} [options.fromBottom=true] true = 优先靠近 x 轴（行号大的行）
 * @returns {{placed: Array, rowCount: number}}
 */
export function packRows(items, options) {
  const list = Array.isArray(items) ? items : []
  const fromBottom = !options || options.fromBottom !== false
  const rowCount = countRowsNeeded(list)
  if (rowCount === 0) {
    return { placed: [], rowCount: 0 }
  }

  // -Infinity 保证空行永远放得下
  const rowEnds = new Array(rowCount).fill(-Infinity)
  const placed = []
  list.forEach((item) => {
    let row = -1
    if (fromBottom) {
      for (let i = rowCount - 1; i >= 0; i -= 1) {
        if (rowEnds[i] <= item.start) {
          row = i
          break
        }
      }
    } else {
      for (let i = 0; i < rowCount; i += 1) {
        if (rowEnds[i] <= item.start) {
          row = i
          break
        }
      }
    }
    if (row === -1) {
      // 理论上到不了（行数是最优值），兜底别让矩形跑丢
      row = fromBottom ? 0 : rowCount - 1
    }
    rowEnds[row] = item.end
    placed.push(Object.assign({}, item, { row }))
  })
  return { placed, rowCount }
}

/**
 * 只算「行」，不算时间轴也不算像素 —— 给组件**先知道有几行**用。
 *
 * 组件要靠行数反推每行高度（高度有限、还不许滚动），而行数只跟数据有关。
 *
 * @param {Array<Object>} items
 * @returns {{manualCount, autoCount, manualRows, autoRows, rowCount, bothGroups}|null}
 */
export function measureRowPlan(items) {
  const manual = []
  const auto = []
  ;(Array.isArray(items) ? items : []).forEach((item) => {
    const span = resolveSpan(item)
    if (!span) {
      return
    }
    if (normalizeMode(item && item.mode) === 'AUTO') {
      auto.push(span)
    } else {
      manual.push(span)
    }
  })
  const byStartLite = (a, b) => a.start - b.start
  manual.sort(byStartLite)
  auto.sort(byStartLite)

  const manualRows = countRowsNeeded(manual)
  const autoRows = countRowsNeeded(auto)
  return {
    manualCount: manual.length,
    autoCount: auto.length,
    manualRows,
    autoRows,
    rowCount: manualRows + autoRows,
    bothGroups: manualRows > 0 && autoRows > 0
  }
}

/* ------------------------------------------------------- 高度自适应 */

/**
 * 行高 / 矩形高 / 分隔带的取值区间。
 * 组件（OrderGantt.vue）和校验脚本共用这一份 —— 别在两处各写一套数字。
 */
export const ROW_HEIGHT_RANGE = { min: 13, max: 32 }
export const BAR_HEIGHT_RANGE = { min: 7, max: 22 }
export const GROUP_GAP_RANGE = { min: 14, max: 32 }
/** 矩形比行高矮多少（留上下呼吸） */
const BAR_INSET = 6

/**
 * 按**可用高度**反推行高 —— 「不滚动、一眼看全所有工单」的核心算法。
 *
 * 思路：行数只跟数据有关（见 measureRowPlan），所以可以「先算行数、再定行高」，
 * 让 rowCount × rowHeight + 分隔带 正好塞进可用高度。这样就没有纵向滚动条。
 *
 * ⚠️ **行高不取整**（原来 `Math.floor` 过，是错的）：
 *    取整会留下最多 `行数 × 1px` 的余量 —— 19 行就是 12px 空白，白花花地挂在时间轴下面，
 *    看着像时间轴多了一段下内边距。改成保留两位小数的精确商之后整图正好填满，
 *    行的 y 坐标是小数，浏览器按子像素渲染，1px 的分隔线会略柔一点点，不影响观感。
 *
 * 三级退让（顺序是刻意的）：
 *   1. 满行高 + 满分隔带（32 / 32）—— 空间够就用它，观感最好
 *   2. 行高不够 13px 时，先把分隔带收到 14px 再算一次
 *   3. 还是不够 → `scrollY: true`，行高锁在下限，由组件退化成内部滚动
 * 第 3 级是兜底：并发行数太多时宁可出现滚动条，也不能把工单裁掉。
 * 正常数据（100 条 / 20 行内）走不到第 3 级。
 *
 * @param {{rowCount:number, bothGroups:boolean}|null} rowPlan measureRowPlan 的结果
 * @param {number} availableHeight 绘图区可用高度（组件已扣掉页头 / 日期带 / 时间轴 / 边框）
 * @returns {{rowHeight:number, barHeight:number, groupGap:number, scrollY:boolean}}
 */
export function fitRowPlan(rowPlan, availableHeight) {
  const rows = rowPlan && rowPlan.rowCount > 0 ? rowPlan.rowCount : 0
  const both = !!(rowPlan && rowPlan.bothGroups)
  const avail = isFinite(availableHeight) && availableHeight > 0 ? availableHeight : 0

  if (!rows) {
    return {
      rowHeight: ROW_HEIGHT_RANGE.max,
      barHeight: BAR_HEIGHT_RANGE.max,
      groupGap: both ? GROUP_GAP_RANGE.max : 0,
      scrollY: false
    }
  }

  // 两位小数：足够精确，又不会让 style 里出现一长串浮点尾数
  const fit = (gap) => Math.round(((avail - gap) / rows) * 100) / 100

  let groupGap = both ? GROUP_GAP_RANGE.max : 0
  let rowHeight = Math.min(ROW_HEIGHT_RANGE.max, fit(groupGap))
  if (rowHeight < ROW_HEIGHT_RANGE.min && both) {
    groupGap = GROUP_GAP_RANGE.min
    rowHeight = Math.min(ROW_HEIGHT_RANGE.max, fit(groupGap))
  }

  const scrollY = rowHeight < ROW_HEIGHT_RANGE.min
  if (scrollY) {
    // 兜底时锁整数下限：反正要滚，行高整齐一点更好看
    rowHeight = ROW_HEIGHT_RANGE.min
  }

  return {
    rowHeight,
    barHeight: Math.max(BAR_HEIGHT_RANGE.min, Math.min(BAR_HEIGHT_RANGE.max, rowHeight - BAR_INSET)),
    groupGap,
    scrollY
  }
}

/* ------------------------------------------------------------- 主入口 */

/**
 * 只算时间轴，不算矩形。
 *
 * 拆出来是因为组件需要**先知道跨度**才能定绘图区宽度
 * （宽度不够就横向滚动，见 OrderGantt.vue 的 MIN_PX_PER_HOUR），
 * 而跨度只跟时间有关、跟宽度无关。buildLayout 内部也走这里，规则只此一份。
 *
 * @param {Array<Object>} items
 * @param {number} [maxTicks=10] 刻度格数上限（标签数 = 格数 + 1）
 * @returns {{domain, stepMinutes, spanMinutes, ticks, days}|null} 没有有效工单时 null
 */
export function measureTimeAxis(items, maxTicks) {
  const spans = []
  ;(Array.isArray(items) ? items : []).forEach((item) => {
    const s = resolveSpan(item)
    if (s) {
      spans.push(s)
    }
  })
  const raw = buildDomain(spans)
  if (!raw) {
    return null
  }

  // 先按原始跨度挑一档步长，再对齐到刻度边界。
  // ⚠️ 对齐会**把时间域往外撑**（最多各撑一格），撑完之后格数可能又超了，
  //    所以这里要循环往粗的档位退，直到「对齐后的格数 <= maxTicks」。
  //    少了这个循环，极端数据（比如 71 小时的跨度 + 6 小时刻度）会多出两格，
  //    刻度数超出上限、标签开始挤。
  let stepMinutes = pickStepMinutes((raw.end - raw.start) / MINUTE_MS, maxTicks)
  let domain = alignDomain(raw, stepMinutes)
  const limit = maxTicks > 0 ? maxTicks : 10
  for (let guard = 0; guard < STEP_CANDIDATES.length; guard += 1) {
    if ((domain.end - domain.start) / MINUTE_MS / stepMinutes <= limit) {
      break
    }
    const next = nextStepMinutes(stepMinutes)
    if (next === stepMinutes) {
      break
    }
    stepMinutes = next
    domain = alignDomain(raw, stepMinutes)
  }

  return {
    domain,
    stepMinutes,
    spanMinutes: (domain.end - domain.start) / MINUTE_MS,
    ticks: buildTicks(domain, stepMinutes),
    days: buildDaySegments(domain)
  }
}

function num(value, fallback) {
  return typeof value === 'number' && isFinite(value) ? value : fallback
}

function byStart(a, b) {
  if (a.start !== b.start) {
    return a.start - b.start
  }
  return a.index - b.index
}

const EMPTY_LAYOUT = {
  hasData: false,
  domain: null,
  stepMinutes: 0,
  plotWidth: 0,
  totalHeight: 0,
  rowHeight: 0,
  barHeight: 0,
  bars: [],
  rows: [],
  groups: [],
  ticks: [],
  days: [],
  nowX: null,
  invalidCount: 0,
  stats: {
    total: 0,
    auto: 0,
    manual: 0,
    rowCount: 0,
    invalidCount: 0,
    spanMinutes: 0,
    spanText: '—'
  }
}

/**
 * 生成整张甘特图的布局。
 *
 * @param {Array<Object>} items 接口返回的工单数组（orderRes.data）
 * @param {Object} [options]
 * @param {number} [options.plotWidth=900] 绘图区像素宽度（由组件量出来传进来）
 * @param {number} [options.rowHeight=32]  每行高度（含行间距）
 * @param {number} [options.barHeight=22]  矩形高度
 * @param {number} [options.groupGap=30]   MANUAL 组与 AUTO 组之间的分隔带高度
 * @param {number} [options.maxTicks=10]   刻度格数上限
 * @param {number} [options.minBarWidth=8] 矩形最小宽度（太窄的矩形没法悬浮）
 * @param {boolean} [options.fromBottom=true] 行装箱方向：true = 优先靠近 x 轴（推荐）
 * @param {number} [options.now]           画「现在」竖线用的时间戳，默认取当前时刻
 * @returns {Object} 布局结果，见 EMPTY_LAYOUT 的字段说明
 */
export function buildLayout(items, options) {
  const opts = options || {}
  const rowHeight = num(opts.rowHeight, 32)
  const barHeight = Math.min(num(opts.barHeight, 22), rowHeight)
  const groupGap = num(opts.groupGap, 30)
  const plotWidth = Math.max(1, num(opts.plotWidth, 900))
  const maxTicks = num(opts.maxTicks, 10)
  const minBarWidth = Math.max(1, num(opts.minBarWidth, 8))
  // 显式写出来而不是靠 packRows 的默认值 —— 这是本模块的第二条硬规则，不该藏
  const fromBottom = opts.fromBottom !== false

  const list = Array.isArray(items) ? items : []
  const bars = []
  let invalidCount = 0

  list.forEach((item, index) => {
    const span = resolveSpan(item)
    if (!span) {
      invalidCount += 1
      return
    }
    const mode = normalizeMode(item && item.mode)
    bars.push({
      // orderId 可能重复（后端数据不保证），拼上下标才是稳定 key
      key: (item && item.orderId != null ? String(item.orderId) : 'row') + '#' + index,
      index,
      orderId: item && item.orderId != null ? String(item.orderId) : '—',
      mode,
      auto: mode === 'AUTO',
      start: span.start,
      end: span.end,
      durationMinutes: span.durationMinutes,
      durationFromCost: span.fromCost,
      detail: item ? item.detail : null,
      raw: item,
      row: 0
    })
  })

  const axis = measureTimeAxis(list, maxTicks)
  if (!axis) {
    return Object.assign({}, EMPTY_LAYOUT, {
      plotWidth,
      rowHeight,
      barHeight,
      invalidCount,
      stats: Object.assign({}, EMPTY_LAYOUT.stats, {
        invalidCount,
        total: list.length
      })
    })
  }

  const { domain, stepMinutes, ticks, days } = axis

  const manual = bars.filter((b) => !b.auto).sort(byStart)
  const auto = bars.filter((b) => b.auto).sort(byStart)
  const manualPack = packRows(manual, { fromBottom })
  const autoPack = packRows(auto, { fromBottom })

  // AUTO 组永远在下面（y 更大）→ 贴近 x 轴
  const manualTop = 0
  const manualHeight = manualPack.rowCount * rowHeight
  const autoTop = manualPack.rowCount > 0 ? manualHeight + groupGap : 0
  const autoHeight = autoPack.rowCount * rowHeight
  const totalHeight = Math.max(rowHeight, autoTop + autoHeight)

  const span = domain.end - domain.start
  const toX = (ts) => ((ts - domain.start) / span) * plotWidth

  // ⚠️ 几何只能写在 packRows 产出的**副本**上（packRows 是纯函数，会 Object.assign 出新对象），
  //    所以下面 place 改的是 manualPack.placed / autoPack.placed，
  //    最终返回的 bars 必须是这两个数组的合并结果 —— 拿上面那个 `bars` 数组返回会得到一堆
  //    left/width/top 全是 undefined 的矩形（页面上表现为整张图空白）。
  const place = (packed, groupTop, groupKey) => {
    packed.placed.forEach((bar) => {
      bar.group = groupKey
      bar.rowTop = groupTop + bar.row * rowHeight
      bar.top = bar.rowTop + (rowHeight - barHeight) / 2
      bar.height = barHeight

      let left = toX(bar.start)
      let width = toX(bar.end) - left
      if (!(width > 0)) {
        width = 1
      }
      if (width < minBarWidth) {
        width = minBarWidth
      }
      if (left < 0) {
        width += left
        left = 0
      }
      if (left + width > plotWidth) {
        width = Math.max(1, plotWidth - left)
      }
      bar.left = left
      bar.width = width
    })
  }
  place(manualPack, manualTop, 'manual')
  place(autoPack, autoTop, 'auto')

  const rows = []
  for (let i = 0; i < manualPack.rowCount; i += 1) {
    rows.push({ key: 'm' + i, group: 'manual', top: manualTop + i * rowHeight, height: rowHeight })
  }
  for (let i = 0; i < autoPack.rowCount; i += 1) {
    rows.push({ key: 'a' + i, group: 'auto', top: autoTop + i * rowHeight, height: rowHeight })
  }

  const groups = []
  if (manualPack.rowCount > 0) {
    groups.push({
      key: 'manual',
      label: '手动 / 其他',
      tone: 'manual',
      top: manualTop,
      height: manualHeight,
      rowCount: manualPack.rowCount,
      count: manual.length,
      separatorTop: null
    })
  }
  if (autoPack.rowCount > 0) {
    groups.push({
      key: 'auto',
      label: 'AUTO 自动',
      tone: 'auto',
      top: autoTop,
      height: autoHeight,
      rowCount: autoPack.rowCount,
      count: auto.length,
      // 两组都在时才画分隔带；只有 AUTO 时没必要
      separatorTop: manualPack.rowCount > 0 ? autoTop - groupGap / 2 : null
    })
  }

  const nowTs = num(opts.now, Date.now())
  let nowX = nowTs >= domain.start && nowTs <= domain.end ? toX(nowTs) : null
  // ⚠️ 夹到 plotWidth - 1：这条竖线只有 1px 宽，画在 plotWidth 上右边缘就顶到
  //    plotWidth + 1，`overflow-x: auto` 会因此冒出横向滚动条（真实踩过）。
  //    「现在」正好等于 domain.end 时就会命中这一条。
  if (nowX !== null) {
    nowX = Math.min(nowX, plotWidth - 1)
  }

  const spanMinutes = span / MINUTE_MS

  return {
    hasData: bars.length > 0,
    domain,
    stepMinutes,
    plotWidth,
    totalHeight,
    rowHeight,
    barHeight,
    bars: manualPack.placed
      .concat(autoPack.placed)
      .sort((a, b) => a.index - b.index),
    rows,
    groups,
    // ⚠️ 首尾两个刻度的 x 分别是 0 和 plotWidth（alignDomain 保证了这一点）。
    //    渲染方要注意：**在 x = plotWidth 处画任何有宽度的东西都会撑出 1px 横向滚动条**。
    //    组件里对竖向网格线做了过滤（见 OrderGantt.vue 的 gridTicks），
    //    但刻度标签本身要保留 —— 那是时间轴的末端时间，不能少。
    ticks: ticks.map((t) => ({
      time: t.time,
      dayStart: t.dayStart,
      x: toX(t.time),
      label: formatClock(t.time),
      dayLabel: formatDay(t.time)
    })),
    days: days.map((d) => ({
      dayStart: d.dayStart,
      x: toX(d.start),
      width: toX(d.end) - toX(d.start),
      label: formatDay(d.dayStart),
      clockLabel: formatClock(d.start)
    })),
    nowX,
    invalidCount,
    stats: {
      total: bars.length,
      auto: auto.length,
      manual: manual.length,
      rowCount: manualPack.rowCount + autoPack.rowCount,
      invalidCount,
      spanMinutes,
      spanText: formatSpan(span)
    }
  }
}

/* ------------------------------------------------------------- 格式化 */

/** 时间戳 -> 'HH:mm' */
export function formatClock(ts) {
  const d = new Date(ts)
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

/** 时间戳 -> 'MM-DD 周X' */
export function formatDay(ts) {
  const d = new Date(ts)
  return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + WEEKDAYS[d.getDay()]
}

/** 时间戳 -> 'MM-DD HH:mm' */
export function formatDateTimeShort(ts) {
  const d = new Date(ts)
  return (
    pad2(d.getMonth() + 1) +
    '-' +
    pad2(d.getDate()) +
    ' ' +
    pad2(d.getHours()) +
    ':' +
    pad2(d.getMinutes())
  )
}

/** 毫秒 -> 'X 天 Y 小时' / 'Y 小时 Z 分' / 'Z 分钟' */
export function formatSpan(ms) {
  const minutes = Math.max(0, Math.round(ms / MINUTE_MS))
  if (minutes >= 24 * 60) {
    const d = Math.floor(minutes / (24 * 60))
    const h = Math.round((minutes % (24 * 60)) / 60)
    return h > 0 ? d + ' 天 ' + h + ' 小时' : d + ' 天'
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? h + ' 小时 ' + m + ' 分' : h + ' 小时'
  }
  return minutes + ' 分钟'
}

/** 分钟 -> '1 小时 55 分' / '45 分钟'（矩形悬浮气泡里的「耗时」） */
export function formatDuration(minutes) {
  return formatSpan((minutes || 0) * MINUTE_MS)
}
