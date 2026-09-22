/**
 * ⚠️ 演示专用：模拟「执行推进」带来的节点状态变化
 * ==========================================================================
 * 为什么需要它
 *   mockData/res.js 里的 executeResMap 是一份静态快照（节点要么 SUCCESS 要么 INIT），
 *   轮询时数据永远不会变，看不出轮询到底有没有生效，也没法验证 7 套状态配色。
 *   本模块在 api 层对返回结果做一次确定性变换，让节点状态沿「执行顺序」逐步推进。
 *
 * 推进规则
 *   - 每条流（planId + 流下标）独立维护进度，互不影响
 *   - 首次遇到某条流时把它「倒带到 30%」，模拟「正在执行中」
 *   - 之后每次调用推进 STEP 个节点，同一时刻最多 1 个节点处于「进行中」
 *   - 只改写「状态确实发生变化」的节点，已完成的节点时间戳原样保留（避免首屏跳变）
 *   - 时间以「流内最后一个已有结束时间」为锚点单调递增；同一并行组的相邻成员共享开始时间
 *
 * 节点的「剧情」：按 aniInstanceNodeId 做稳定哈希，分配到下面 FLAVOR_TABLE 的一行，
 *   决定它「进行中」用什么状态、「完成」用什么状态、以及会不会中断整条流。
 *   这样 7 种配色（init / run / ok / bad / confirm / stop / cancel）都能真实出现，
 *   并且同一条流每次刷新看到的配色是稳定的。
 *
 * 接入真实接口后怎么删
 *   1. 把 _mockFlagSimple.js 的 USE_MOCK 改成 false（本文件就不会被加载了）
 *   2. 确认页面正常后，删掉本文件 + _mockApiSimple.js 顶部的 import
 * ==========================================================================
 */
import { USE_MOCK } from './_mockFlagSimple'

// 总开关：跟着全局开关走 —— USE_MOCK 为 false 时整个 mock 层都不会被加载
export const DEMO_TICK_ENABLED = USE_MOCK

const STEP = 1 // 每次轮询每条流推进几个节点
const START_RATIO = 0.2 // 首次遇到流时倒带到百分之多少的进度
const NODE_STEP_SEC = 90 // 相邻节点的时间间隔（秒）
const NODE_RUN_SEC = 82 // 单个节点的执行耗时（秒），略小于间隔以留出空隙

/** 终态：不会再变化 */
const SETTLED = new Set([
  'SUCCESS',
  'INCOM_SUCCESS',
  'FAILED',
  'VERIFY_FAIL',
  'STOP',
  'CANCELLED',
  'SKIP'
])

/** 算作「跑完」的终态（用于判断整条流是否成功） */
const DONE_OK = new Set(['SUCCESS', 'SKIP'])

/** 判定为失败的状态（用于计划级 / 流级汇总） */
const BAD = new Set(['FAILED', 'VERIFY_FAIL'])

/**
 * 节点剧情表：按哈希值 0~99 落桶
 *   running  该节点「进行中」时显示的状态
 *   terminal 该节点「结束」时显示的状态
 *   halt     结束后是否中断整条流（后续节点永远停在 INIT）
 */
const FLAVOR_TABLE = [
  { upto: 44, running: 'RUNNING', terminal: 'SUCCESS', halt: false }, // 正常
  { upto: 56, running: 'VERIFY_EXEC', terminal: 'SUCCESS', halt: false }, // 异步验证
  { upto: 66, running: 'DEPEND_WAIT', terminal: 'SUCCESS', halt: false }, // 等依赖
  { upto: 74, running: 'CONFIRM', terminal: 'SUCCESS', halt: false }, // 等人确认
  { upto: 80, running: 'DEPEND_CONFIRM', terminal: 'SUCCESS', halt: false }, // 等依赖确认
  { upto: 86, running: 'RUNNING', terminal: 'INCOM_SUCCESS', halt: false }, // 部分成功
  { upto: 90, running: 'RUNNING', terminal: 'FAILED', halt: true }, // 失败
  { upto: 92, running: 'VERIFY_EXEC', terminal: 'VERIFY_FAIL', halt: true }, // 验证异常
  { upto: 94, running: 'RUNNING', terminal: 'STOP', halt: true }, // 挂起
  { upto: 95, running: 'RUNNING', terminal: 'CANCELLED', halt: true }, // 取消
  { upto: 99, running: null, terminal: 'SKIP', halt: false } // 跳过（不经历进行中）
]

/** 流进度：key = `${planId}:${flowIndex}`，value = 已推进到的节点数 */
const progress = new Map()

function pad(n) {
  return String(n).padStart(2, '0')
}

/** '2026-08-07 20:12:01' 往后推 seconds 秒 */
function shiftTime(base, seconds) {
  if (!base) {
    return null
  }
  const t = new Date(String(base).replace(/-/g, '/')).getTime()
  if (Number.isNaN(t)) {
    return null
  }
  const d = new Date(t + seconds * 1000)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** FNV-1a，稳定映射到 0~99，保证同一节点每次刷新拿到同一套配色 */
function bucket(id) {
  const s = String(id)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100
}

function flavorOf(id) {
  const p = bucket(id)
  return FLAVOR_TABLE.find(f => p <= f.upto) || FLAVOR_TABLE[0]
}

/**
 * 按 relations 求出节点的执行顺序（拓扑序）
 * 数据特征是「一条直线」，但这里仍用通用的 Kahn，避免真实数据出现分支时排错。
 */
function topoOrder(nodes, relations) {
  const ids = nodes.map(n => n.aniInstanceNodeId)
  const idSet = new Set(ids)
  const succ = new Map(ids.map(id => [id, []]))
  const indeg = new Map(ids.map(id => [id, 0]))
  const seen = new Set()

  ;(Array.isArray(relations) ? relations : []).forEach(r => {
    const a = r && r.anirInstanceFromNodeId
    const b = r && r.anirInstanceToNodeId
    if (!idSet.has(a) || !idSet.has(b) || a === b) {
      return
    }
    const k = a + '>' + b
    if (seen.has(k)) {
      return
    }
    seen.add(k)
    succ.get(a).push(b)
    indeg.set(b, indeg.get(b) + 1)
  })

  const queue = ids.filter(id => indeg.get(id) === 0)
  const out = []
  while (queue.length) {
    const id = queue.shift()
    out.push(id)
    succ.get(id).forEach(nx => {
      indeg.set(nx, indeg.get(nx) - 1)
      if (indeg.get(nx) === 0) {
        queue.push(nx)
      }
    })
  }
  // 兜底：数据成环时把剩余节点按原序补上，保证不丢节点
  if (out.length < ids.length) {
    const done = new Set(out)
    ids.forEach(id => {
      if (!done.has(id)) {
        out.push(id)
      }
    })
  }
  return out
}

/** 汇总一条流的状态 */
function flowStatusOf(states) {
  if (!states.length) {
    return 'INIT'
  }
  if (states.some(s => BAD.has(s))) {
    return 'FAILED'
  }
  if (states.includes('INCOM_SUCCESS')) {
    return 'INCOM_SUCCESS'
  }
  if (states.includes('STOP')) {
    return 'STOP'
  }
  if (states.includes('CANCELLED')) {
    return 'CANCELLED'
  }
  if (states.every(s => DONE_OK.has(s))) {
    return 'SUCCESS'
  }
  if (states.every(s => s === 'INIT' || s === 'READY')) {
    return 'SUBMIT'
  }
  return 'RUNNING'
}

/**
 * 对单个执行详情做一次「状态推进」
 * @param {Object} data getExecuteIndex 返回的 data（已深拷贝，可直接改写）
 * @returns {Object} 同一个 data 对象
 */
export function demoTick(data) {
  if (!DEMO_TICK_ENABLED || !data || !Array.isArray(data.workflows)) {
    return data
  }

  let finished = 0
  let failed = 0
  let running = 0

  data.workflows.forEach((wf, flowIndex) => {
    const nodes = Array.isArray(wf.nodes) ? wf.nodes : []
    if (!nodes.length) {
      return
    }
    const order = topoOrder(nodes, wf.relations)
    if (!order.length) {
      return
    }
    const byId = new Map(nodes.map(n => [n.aniInstanceNodeId, n]))

    // ① 每个节点按 id 稳定分配剧情；找到第一个「会中断流程」的节点作为断点
    const flavors = order.map(id => flavorOf(id))
    let haltAt = -1
    for (let i = 0; i < flavors.length; i++) {
      if (flavors[i].halt) {
        haltAt = i
        break
      }
    }
    // 断点之前的节点才会被执行；断点本身停在它的终态；之后的节点永远是 INIT
    const limit = haltAt >= 0 ? haltAt : order.length

    // ② 本轮进度：首次遇到就倒带到 START_RATIO，之后每次推进 STEP（不会越过断点）
    const key = `${data.aripExecPlanId}:${flowIndex}`
    const done = Math.min(
      limit,
      progress.has(key) ? progress.get(key) + STEP : Math.max(0, Math.round(limit * START_RATIO))
    )
    progress.set(key, done)

    // ③ 时间锚点 = 流内最后一个已有结束时间的节点
    let anchor = null
    let anchorIdx = -1
    for (let i = order.length - 1; i >= 0; i--) {
      const n = byId.get(order[i])
      if (n && n.aniEndTime) {
        anchor = n.aniEndTime
        anchorIdx = i
        break
      }
    }
    if (!anchor) {
      anchor =
        wf.awiPlanStartTime ||
        wf.awiWorkflowTriggerTime ||
        wf.awiExecuteStartTime ||
        wf.awiPlanEndTime ||
        data.aripExecPlanStart ||
        `${data.aripExecDate || '2026-08-07'} 20:00:00`
      anchorIdx = -1
    }

    // ④ 时间偏移：同一并行组的相邻成员共享开始时间（它们是并行的），跨组才往后推
    const rel = new Array(order.length).fill(0)
    for (let i = 1; i < order.length; i++) {
      const cur = byId.get(order[i])
      const prev = byId.get(order[i - 1])
      const parallel = cur && prev && cur.aniNodeGroup && cur.aniNodeGroup === prev.aniNodeGroup
      rel[i] = rel[i - 1] + (parallel ? 0 : NODE_STEP_SEC)
    }
    const baseRel = rel[anchorIdx >= 0 ? anchorIdx : 0]

    // ⑤ 逐个节点对齐到目标状态（只改状态确实变了的，避免无谓重写）
    const states = []
    order.forEach((id, i) => {
      const node = byId.get(id)
      if (!node) {
        return
      }
      const flavor = flavors[i]
      let st
      if (i < done) {
        st = flavor.terminal
      } else if (i === done && i === limit && haltAt >= 0) {
        // 断点节点：执行到它时停在失败态
        st = flavor.terminal
      } else if (i === done) {
        st = flavor.running || flavor.terminal
      } else if (i === done + 1 && done < limit) {
        st = 'READY' // 下一个待开始
      } else {
        st = 'INIT'
      }
      states.push(st)

      if (SETTLED.has(st)) {
        finished += 1
        if (BAD.has(st)) {
          failed += 1
        }
      } else if (st !== 'INIT' && st !== 'READY' && st !== 'SUBMIT') {
        running += 1
      }

      if (node.aniStatus === st) {
        return
      }

      const offset = rel[i] - baseRel
      const hasNoTime = st === 'INIT' || st === 'READY' || st === 'SUBMIT' || st === 'SKIP'
      // 已有时间就沿用（进行中转终态时不要改写开始时间），否则按锚点推导
      const start = hasNoTime ? null : node.aniStartTime || shiftTime(anchor, offset)
      let end = SETTLED.has(st) && st !== 'SKIP'
        ? node.aniEndTime || shiftTime(anchor, offset + NODE_RUN_SEC)
        : null
      // 兜底：锚点漂移导致结束时间早于开始时间时，直接按开始时间往后推一个耗时
      if (start && end && end <= start) {
        end = shiftTime(start, NODE_RUN_SEC)
      }

      node.aniStatus = st
      node.aniStartTime = start
      node.aniEndTime = end
      // 原子状态与节点状态保持同步（运行时状态看 aaiAtomStatus）
      ;(node.atoms || []).forEach(atom => {
        atom.aaiAtomStatus = st
        atom.aaiStartTime = start
        atom.aaiEndTime = end
      })
    })

    // ⑥ 流级状态与时间跟着节点走，避免出现「节点全绿但流还标着待执行」
    const flowStatus = flowStatusOf(states)
    wf.awiWorkflowStatus = flowStatus
    const starts = order.map(id => byId.get(id)).filter(Boolean).map(n => n.aniStartTime).filter(Boolean).sort()
    const ends = order.map(id => byId.get(id)).filter(Boolean).map(n => n.aniEndTime).filter(Boolean).sort()
    if (starts.length) {
      wf.awiExecuteStartTime = wf.awiExecuteStartTime || starts[0]
    }
    wf.awiExecuteEndTime = DONE_OK.has(flowStatus) ? (ends.length ? ends[ends.length - 1] : null) : null
  })

  // ⑦ 计划级统计跟着走，避免出现「节点全绿但计划还在执行中」的矛盾
  if (typeof data.totalNodeNums === 'number') {
    data.finishedNodeNums = finished
    data.failedNodeNums = failed
    if (data.totalNodeNums > 0 && finished >= data.totalNodeNums) {
      data.aripExecStatus = failed > 0 ? 'INCOM_SUCCESS' : 'SUCCESS'
    } else if (running > 0) {
      data.aripExecStatus = 'RUNNING'
    }
  }

  return data
}

export default { demoTick, DEMO_TICK_ENABLED }
