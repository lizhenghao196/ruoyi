/**
 * 工单甘特图 · 额外支持人员计算（纯函数，不依赖 Vue / DOM）
 * ==========================================================================
 * 2026-10-21 用户需求：甘特图页头加「一键计算额外需要变更支持人员人数」按钮，
 * 点了之后把两个字段打进控制台：
 *
 *   let par = {
 *     peopleNum: g,   // 最终得出的额外需要人数
 *     detail: [       // 五个时间段各一行
 *       { time, manualNum, manualCost, manualVal, autoNum, autoCost, autoVal, totalVal }
 *     ]
 *   }
 *
 * 计算规则（用户原话整理）：
 *   1. 18:00 - 06:00 拆成五段：18-20 / 20-22 / 22-24 / 0-2 / 2-6（前四段 2 小时、末段 4 小时）；
 *   2. 每段统计：手动单数 x、手动耗时 y、自动单数 z、自动耗时 a（耗时单位 H）；
 *      —— 耗时看的是**该时间段内的节点耗时**；一个工单跨多个时间段时，
 *         在每个时间段内分别计算它落在该段内的节点耗时；
 *   3. 手动数值 b = max(x, y) / 4，自动数值 c = max(z, a) / 10，段总分 = b + c；
 *   4. 逻辑一：五段总分取最大 d，**先把 d 四舍五入成整数 D**，
 *      D > 2 起每超过 1 加 1 人（D - 2）→ e；
 *      —— 2026-11-02 用户改动：原来是 ceil(d - 2)，现在先四舍五入再判：
 *         d = 2.1 → D = 2 → 没超过 2 → 0 人；d = 2.5 → D = 3 → 加 1 人；
 *   5. 逻辑二：**只看后四个时间段**（跳过 18:00 - 20:00），
 *      有连续 N 个时间段总分 > 1 就加 N - 1 人（N < 2 时为 0）→ f；
 *   6. 最终人数 g = max(e, f)。
 *
 * 为什么也拆成纯函数：规则全是「算」，一条浏览器都不需要；
 * node 里可以直接断言（og_workload_check.mjs），改错规则当场红。
 *
 * 数据来源约定（和甘特图本身保持同一判定，别在两处各写一套）：
 *   - 时间窗口 = ganttLayout 的 `buildDayWindow(date)`（当天 18:00 → 次日 06:00），
 *     「当天」由页面弹窗的日期选择器给出 —— 和横坐标是同一个窗口，不另算；
 *   - 工单占用区间 / 节点时间线 = ganttLayout 的 `resolveSpan`：
 *       · AUTO 有 node_detail → 只算节点**真正执行**的片段（computeNodeTimeline 串行排好的），
 *         节点之间的暂停不计入耗时；
 *       · MANUAL 没有 node_detail → 用工单自身占用区间 [beginTime, beginTime + total_cost)。
 * ==========================================================================
 */

import { MINUTE_MS, buildDayWindow, normalizeMode, resolveSpan } from './ganttLayout'

/**
 * 五个时间段的划分（相对窗口起点 18:00 的小时数，2+2+2+2+4 = 12 正好铺满窗口）。
 * 标签就用用户给的原文。
 */
export const WORKLOAD_SEGMENTS = [
  { label: '18:00 - 20:00', hours: 2 },
  { label: '20:00 - 22:00', hours: 2 },
  { label: '22:00 - 24:00', hours: 2 },
  { label: '00:00 - 02:00', hours: 2 },
  { label: '02:00 - 06:00', hours: 4 }
]

/** 手动数值的分母：max(单数, 耗时) / 4 */
export const MANUAL_DIVISOR = 4
/** 自动数值的分母：max(单数, 耗时) / 10 */
export const AUTO_DIVISOR = 10
/** 逻辑一阈值：单时段总分**四舍五入后**超过它才开始算人 */
export const PEAK_THRESHOLD = 2
/** 逻辑二阈值：单时段总分超过它才算「超载段」 */
export const RUN_THRESHOLD = 1
/**
 * 逻辑二从第几段开始看（2026-11-02 用户改动：**不看 18:00 - 20:00，只看后四段**）。
 * 下标对应 WORKLOAD_SEGMENTS，1 = 从「20:00 - 22:00」起算。
 * ⚠️ 只影响逻辑二；五段仍然全部参与统计和明细表，逻辑一也仍在五段里取峰值。
 */
export const RUN_SEGMENT_START = 1

/** 保留两位小数（页面上要打印的值，也用来参与后续比较，避免「显示的和算的不是一个数」） */
function round2(v) {
  return Math.round(v * 100) / 100
}

/**
 * 一条工单的「计耗时间片」数组。
 *
 * - AUTO 且节点时间线可用 → 各节点真正执行的片段（串行结果，暂停不算耗时）；
 * - 其余情况（MANUAL 本来就没有 node_detail；AUTO 但节点全无效）→
 *   工单自身占用区间 [beginTime, beginTime + total_cost)。
 *   resolveSpan 已经按页面同款规则定好这个区间（total_cost 优先、endTime 只兜底），
 *   这里不重新判一遍。
 * - beginTime 解析不出来的工单 → 空数组（整条不参与统计，和甘特图不画它一致）。
 *
 * @param {Object} item 原始工单
 * @returns {Array<{start:number,end:number}>}
 */
function costIntervals(item) {
  const span = resolveSpan(item)
  if (!span) {
    return []
  }
  if (span.timeline && Array.isArray(span.timeline.segments) && span.timeline.segments.length) {
    return span.timeline.segments
  }
  return [{ start: span.start, end: span.end }]
}

/**
 * 一组时间片落在 [segStart, segEnd) 内的总分钟数。
 *
 * 逐个时间片与时间段求交 —— 「一个工单跨多个时间段时分别计算」就在这里体现：
 * 时间片本身不切，只是每段各算各的重合部分，互不影响。
 */
function overlapMinutes(intervals, segStart, segEnd) {
  let minutes = 0
  intervals.forEach((iv) => {
    const s = Math.max(iv.start, segStart)
    const e = Math.min(iv.end, segEnd)
    if (e > s) {
      minutes += (e - s) / MINUTE_MS
    }
  })
  return minutes
}

/**
 * 算「额外需要变更支持人员人数」（2026-10-21 用户需求）。
 *
 * @param {Array<Object>} orders 工单数组（接口原样，和甘特图同一份数据）
 * @param {string} date 'YYYY-MM-DD'，页面弹窗的日期 —— 决定 18:00-06:00 窗口
 * @returns {{peopleNum:number, detail:Array}|null} 日期解析失败返回 null
 *          （调用方给提示，别拿着坏日期算出一堆 0 骗人）
 */
export function calcExtraStaff(orders, date) {
  const win = buildDayWindow(date)
  if (!win) {
    return null
  }
  const list = Array.isArray(orders) ? orders.filter(Boolean) : []

  const detail = []
  let cursor = win.start
  WORKLOAD_SEGMENTS.forEach((seg) => {
    // 末段夹到窗口终点：窗口恒 12 小时、五段小时数正好铺满，夹一下只是防止
    // 将来窗口规则变动时把时间段算到窗外去
    const segEnd = Math.min(cursor + seg.hours * 60 * MINUTE_MS, win.end)

    let manualNum = 0
    let manualMinutes = 0
    let autoNum = 0
    let autoMinutes = 0
    list.forEach((item) => {
      const minutes = overlapMinutes(costIntervals(item), cursor, segEnd)
      if (minutes <= 0) {
        // 这个时间段内没有任何占用 → 既不计单也不计耗时
        return
      }
      if (normalizeMode(item.mode) === 'AUTO') {
        autoNum += 1
        autoMinutes += minutes
      } else {
        manualNum += 1
        manualMinutes += minutes
      }
    })

    const manualCost = round2(manualMinutes / 60)
    const autoCost = round2(autoMinutes / 60)
    const manualVal = round2(Math.max(manualNum, manualCost) / MANUAL_DIVISOR)
    const autoVal = round2(Math.max(autoNum, autoCost) / AUTO_DIVISOR)
    detail.push({
      time: seg.label,
      manualNum,
      manualCost,
      manualVal,
      autoNum,
      autoCost,
      autoVal,
      totalVal: round2(manualVal + autoVal)
    })
    cursor = segEnd
  })

  /* ---------------- 两条逻辑，取最大值 ---------------- */
  const totals = detail.map((d) => d.totalVal)

  // 逻辑一：五段总分取最大 d，**四舍五入成整数 D**，D > 2 起每超过 1 加 1 人。
  // 2026-11-02 用户改动（原来 ceil(d - 2)）：
  //   d = 2.1 → D = 2 → 没超过 2 → 0 人；d = 2.5 → D = 3 → 3 - 2 = 1 人。
  // ⚠️ 用 Math.round（.5 向上）正好符合用户举的例子；别改回 Math.ceil，
  //    og_workload_check.mjs 的 B5 有 2.1 / 2.25 会红的断言。
  const peak = totals.reduce((m, t) => Math.max(m, t), 0)
  const peakRounded = Math.round(peak)
  const peakExtra = peakRounded > PEAK_THRESHOLD ? peakRounded - PEAK_THRESHOLD : 0

  // 逻辑二：**只看后四段**（跳过 18:00 - 20:00）最长连续超载段（总分 > 1）为 N
  // → 加 N - 1 人；只有一段超载时 N-1 = 0。
  // 首段即使超载也不参与连续段（否则「18-20 + 20-22」会被算成连续 2 段）。
  let longest = 0
  let run = 0
  totals.slice(RUN_SEGMENT_START).forEach((t) => {
    run = t > RUN_THRESHOLD ? run + 1 : 0
    if (run > longest) {
      longest = run
    }
  })
  const runExtra = longest > 1 ? longest - 1 : 0

  return {
    peopleNum: Math.max(peakExtra, runExtra),
    detail
  }
}

/**
 * 把算好的 par 翻译成「这个人数是怎么来的」的说明数据（2026-11-02 用户需求）。
 *
 * 用户原话：「当额外需要变更支持人数大于等于 1 的时候，需要在弹窗里面说明，
 * 这个数字是怎么来的，根据哪个逻辑，简要的计算过程说明一下」。
 *
 * ⚠️ **只做解读、不重算人数**：段总分全部取自 `par.detail`，人数仍用 `par.peopleNum` ——
 *    说明里的每个数字必须和结论行 / 明细表**完全一致**（同一份数据，不搞第二套算法）。
 * ⚠️ 入参就是 `calcExtraStaff` 的返回值，**不要往里塞说明字段**：
 *    那份 par 会原样 POST 到后端（`pushExtraStaff` 是 `{ ...par, date }`），
 *    多出来的字段会跟着进请求体。说明只在展示层现算。
 *
 * @param {{peopleNum:number, detail:Array}} result calcExtraStaff 的返回值
 * @returns {Object|null} 人数 < 1 / 没有明细 → null（弹窗里整块不渲染）
 */
export function explainStaffResult(result) {
  if (!result || !Array.isArray(result.detail) || !result.detail.length) {
    return null
  }
  const peopleNum = typeof result.peopleNum === 'number' ? result.peopleNum : 0
  // 用户要求「大于等于 1 才说明」：0 人的情况不解释（弹窗只留结论行 + 明细表）
  if (!(peopleNum >= 1)) {
    return null
  }

  const detail = result.detail
  const totals = detail.map((d) => d.totalVal)

  /* 逻辑一：最高段总分 d（同分取靠前那段，和 reduce 的 Math.max 语义一致） */
  let peakIdx = 0
  totals.forEach((t, i) => {
    if (t > totals[peakIdx]) {
      peakIdx = i
    }
  })
  const peakRow = detail[peakIdx]
  const peakVal = totals[peakIdx]
  // 逻辑一：和 calcExtraStaff 同一套判据（先四舍五入，再 D - 2）
  const peakRounded = Math.round(peakVal)
  const peakExtra = peakRounded > PEAK_THRESHOLD ? peakRounded - PEAK_THRESHOLD : 0

  /* 逻辑二：后四段里最长连续超载段（段总分 > 1），同长取靠前的那一段 */
  let bestStart = 0
  let bestLen = 0
  let curStart = 0
  let curLen = 0
  totals.forEach((t, i) => {
    // 2026-11-02：18:00 - 20:00 不参与逻辑二，直接跳过（不打断、也不计入连续段）
    if (i < RUN_SEGMENT_START) {
      return
    }
    if (t > RUN_THRESHOLD) {
      if (curLen === 0) {
        curStart = i
      }
      curLen += 1
      if (curLen > bestLen) {
        bestLen = curLen
        bestStart = curStart
      }
    } else {
      curLen = 0
    }
  })
  const runExtra = bestLen > 1 ? bestLen - 1 : 0
  const runTimes = bestLen > 0 ? detail.slice(bestStart, bestStart + bestLen).map((d) => d.time) : []

  // 逻辑一那一段的总分是怎么凑出来的（「简要计算过程」用它举例）。
  // partsSum 单独算：两个 2 位小数相加可能和 totalVal 差 0.01（round2 各自取整），
  // 这时页面上不摆「= 合计」，免得和明细表的段总分对不上。
  const partsSum = round2(peakRow.manualVal + peakRow.autoVal)

  return {
    peopleNum,
    peak: {
      time: peakRow.time,
      value: peakVal,
      // 四舍五入后的整数（逻辑一真正拿来判 > 2 的那个数，文案里要展示）
      rounded: peakRounded,
      extra: peakExtra,
      manualNum: peakRow.manualNum,
      manualCost: peakRow.manualCost,
      manualVal: peakRow.manualVal,
      autoNum: peakRow.autoNum,
      autoCost: peakRow.autoCost,
      autoVal: peakRow.autoVal,
      partsSum,
      partsMatch: partsSum === peakVal
    },
    run: {
      length: bestLen,
      extra: runExtra,
      times: runTimes
    },
    // 最终由哪条逻辑决定（并列时按 calcExtraStaff 的 max 语义，两条等价，这里报逻辑一）
    winner: peakExtra >= runExtra ? 'peak' : 'run'
  }
}

/**
 * 把说明数据拼成「可渲染的文字段」（纯函数，2026-11-02 用户需求）。
 *
 * 用户要求：**弹窗里只展示当前这个数字走的那条逻辑**，另外挂一个 i 小图标，
 * 鼠标悬浮才显示完整的两条逻辑 + 取大 + 口径演算。
 * 所以文案拆成四组，弹窗自己决定渲染哪几组。
 *
 * 每段：`{ t: 文字, b?: 数字（加粗变色）, nw?: 时间段（不许断行） }`
 * - 分段而不是直接给一整串：数字要强调、时间段不能断行，`v-html` 拼标签不安全；
 * - 放纯函数里：node 里 `parts.map(p => p.t).join('')` 就能断言最终文案，不用起浏览器。
 *
 * @param {Object|null} explain explainStaffResult 的返回值
 * @returns {{peak:Array, run:Array, summary:Array, note:Array}|null}
 */
export function buildExplainLines(explain) {
  if (!explain) {
    return null
  }
  const peak = explain.peak
  const run = explain.run
  const peopleNum = explain.peopleNum
  const winner = explain.winner

  /* 逻辑一：峰值 d → 四舍五入 D → D - 2
     2026-11-02 改动：先把 d 四舍五入再判 > 2，文案要把「四舍五入 = D」摆出来，
     否则用户看到 d = 2.1 却 0 人会以为算错。 */
  const peakParts = [
    { t: '五段总分最高 d = ' },
    { t: String(peak.value), b: true },
    { t: '（' },
    { t: peak.time, nw: true },
    { t: '），四舍五入 = ' },
    { t: String(peak.rounded), b: true }
  ]
  if (peak.extra > 0) {
    peakParts.push(
      { t: ' > 2 → ' },
      { t: peak.rounded + ' − 2 = ' },
      { t: peak.extra + ' 人', b: true }
    )
  } else {
    peakParts.push({ t: '，未超过 2 → ' }, { t: '0 人', b: true })
  }

  /* 逻辑二：后四段（跳过 18:00 - 20:00）最长连续超载段 N → N - 1
     - `run`      = 完整版（带具体哪几段）→ 悬浮卡片用；
     - `runBrief` = 精简版（不带时间段）→ 弹窗可见区用：四段的时间串加起来太长，
       摆进去会把「N 人」挤到下一行，读起来很别扭（时间段在明细表和悬浮卡片里都有）。 */
  const runParts = []
  const runBrief = []
  if (run.extra > 0) {
    runParts.push({ t: '后四段连续 ' }, { t: String(run.length), b: true }, { t: ' 段总分 > 1（' })
    run.times.forEach((t, i) => {
      if (i) {
        runParts.push({ t: '、' })
      }
      runParts.push({ t, nw: true })
    })
    runParts.push(
      { t: '）→ ' },
      { t: run.length + ' − 1 = ' },
      { t: run.extra + ' 人', b: true }
    )
    runBrief.push(
      { t: '后四段连续 ' },
      { t: String(run.length), b: true },
      { t: ' 段总分 > 1 → ' },
      { t: run.length + ' − 1 = ' },
      { t: run.extra + ' 人', b: true }
    )
  } else if (run.length === 1) {
    runParts.push(
      { t: '后四段只有 1 段总分 > 1（' },
      { t: run.times[0] || '', nw: true },
      { t: '），不足 2 段 → ' },
      { t: '0 人', b: true }
    )
    runBrief.push(
      { t: '后四段只有 1 段总分 > 1，不足 2 段 → ' },
      { t: '0 人', b: true }
    )
  } else {
    runParts.push({ t: '后四段没有连续 2 段总分 > 1 → ' }, { t: '0 人', b: true })
    runBrief.push({ t: '后四段没有连续 2 段总分 > 1 → ' }, { t: '0 人', b: true })
  }

  /* 两条取较大值 */
  const summary = [
    { t: 'max(' + peak.extra + ', ' + run.extra + ') = ' },
    { t: peopleNum + ' 人', b: true },
    { t: '（由' + (winner === 'run' ? '逻辑二' : '逻辑一') + '决定）' }
  ]

  /* 段总分口径 + 拿最高分段做一次完整演算 */
  const note = [
    { t: '段总分 = max(手动单数, 手动耗时H) ÷ 4 + max(自动单数, 自动耗时H) ÷ 10。以最高分段 ' },
    { t: peak.time, nw: true },
    {
      t:
        ' 为例：max(' +
        peak.manualNum +
        ', ' +
        peak.manualCost +
        ') ÷ 4 = ' +
        peak.manualVal +
        '，max(' +
        peak.autoNum +
        ', ' +
        peak.autoCost +
        ') ÷ 10 = ' +
        peak.autoVal
    }
  ]
  // 两个 2 位小数相加可能与段总分差 0.01（各自 round2），这时不摆「合计」，免得对不上
  if (peak.partsMatch) {
    note.push({ t: '，合计 ' + peak.value })
  }
  note.push({ t: '。' })

  return { peak: peakParts, run: runParts, runBrief, summary, note }
}
