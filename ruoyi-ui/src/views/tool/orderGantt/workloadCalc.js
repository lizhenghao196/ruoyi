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
 *   4. 逻辑一：五段总分取最大 d，**d > 2 起每超过 1 加 1 人** → e；
 *   5. 逻辑二：有连续 N 个时间段总分 > 1 就加 N - 1 人（N < 2 时为 0）→ f；
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
/** 逻辑一阈值：单时段总分超过它才开始算人 */
export const PEAK_THRESHOLD = 2
/** 逻辑二阈值：单时段总分超过它才算「超载段」 */
export const RUN_THRESHOLD = 1

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

  // 逻辑一：五段总分取最大 d，d > 2 起每超过 1 加 1 人。
  // 取整方向 = **向上**：d 只比 2 大一丝丝（如 2.05）也是「超过」，
  // 「大于 2 就需要增加人手」这句话里人手至少是 1 个；用人不能招 0.3 个。
  const peak = totals.reduce((m, t) => Math.max(m, t), 0)
  const peakExtra = peak > PEAK_THRESHOLD ? Math.ceil(peak - PEAK_THRESHOLD) : 0

  // 逻辑二：最长连续超载段（总分 > 1）为 N → 加 N - 1 人；只有一段超载时 N-1 = 0。
  let longest = 0
  let run = 0
  totals.forEach((t) => {
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
