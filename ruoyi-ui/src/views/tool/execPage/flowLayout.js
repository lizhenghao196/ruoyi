/**
 * 执行页面 —— 流图（DAG）布局与数据整理
 *
 * 纯函数模块，不依赖 Vue / DOM，便于单独跑脚本校验。
 *
 * 数据背景（来自 /release/executeIndex/{aripExecPlanId} 的 data.workflows[]）：
 *   - 一条 workflow = 一个变更单（合批流则含多个工单）
 *   - nodes[]     : 流里的节点，aniInstanceNodeId 唯一标识
 *   - relations[] : 节点连线，anirInstanceFromNodeId -> anirInstanceToNodeId，
 *                   取值对应 nodes[].aniInstanceNodeId
 *   - nodes[].aniNodeGroup : 并行组标识（32 位 hex），相同值表示同属一个并行组；
 *                            非并行节点为 null。
 *
 * ⚠️ 两个必须记住的数据特征：
 *   1. nodes / relations 都是**乱序**的，必须先按 relations 做拓扑排序再定位。
 *   2. **并行组在 relations 里仍是一条直线**：A -> B -> C -> D -> E，
 *      其中 B、C 同属一个并行组。也就是说任何节点的入度、出度都不会超过 1，
 *      并行关系只体现在 aniNodeGroup 上，不体现在连线上。
 *      所以画图时必须先把同一 aniNodeGroup 的节点**收缩成一个 unit**，
 *      否则 B、C 会被排到相邻两列，看不出「并行」。
 */

/* ------------------------------ 尺寸常量 ------------------------------ */
export const NODE_W = 200 // 节点卡片宽
export const NODE_H = 88 // 节点卡片高
export const COL_GAP = 76 // 列间距（留给连线）
export const GROUP_ROW_GAP = 28 // 并行组内成员的纵向间距（比普通间距大，给「执行先后」的连接箭头留位置）
export const SLOT_GAP = 20 // 同列多个 unit 之间的间距
export const GROUP_PAD = 12 // 并行组虚线框相对节点的内边距
// 四周留白：必须 ≥ GROUP_PAD，否则首/末列是并行组时虚线框会被画布裁掉；
// 顶部额外多留 8px 给「并行组 xxxx」标签（标签浮在框上边缘之上）。
export const PAD_TOP = GROUP_PAD + 22
export const PAD_LEFT = GROUP_PAD + 2
export const PAD_RIGHT = GROUP_PAD + 2
export const PAD_BOTTOM = GROUP_PAD + 4

/* --------------------------- 数据整理 / 格式化 --------------------------- */

/**
 * 把所有 executeIndex 返回里的 workflows 融合成一个统一的流列表
 * @param {Array<{ aripExecPlanId, code, data, error }>} results
 * @returns {Array} 流列表，顺序与入参 plan 顺序、plan 内 flows 顺序一致
 */
export function mergeWorkflows(results) {
  const flows = []
  const list = Array.isArray(results) ? results : []
  list.forEach(item => {
    const data = item && item.data
    if (!data) {
      return
    }
    const wfs = Array.isArray(data.workflows) ? data.workflows : []
    wfs.forEach((wf, index) => {
      flows.push({
        // 唯一键：planId + 流实例 id（缺失时退化为下标）
        key: `${data.aripExecPlanId}-${wf.awiWorkflowInstanceId || index}`,
        planId: data.aripExecPlanId,
        planName: data.aripExecPlanName,
        system: data.aripExecSys,
        env: data.aripExecEnv,
        planStatus: data.aripExecStatus,
        index,
        flowIndex: index + 1,
        flowCount: wfs.length,
        name: wf.awiWorkflowInstanceName || '',
        status: wf.awiWorkflowStatus || '',
        startTime: wf.awiExecuteStartTime,
        endTime: wf.awiExecuteEndTime,
        planStartTime: wf.awiPlanStartTime,
        planEndTime: wf.awiPlanEndTime,
        templateName: wf.workflowTemplateName || '',
        templateVersion: wf.workflowTemplateVersion || '',
        nodes: Array.isArray(wf.nodes) ? wf.nodes : [],
        relations: Array.isArray(wf.relations) ? wf.relations : [],
        // 透传原始字段：流级别的「暂停 / 取消 / 恢复」按钮（见 index.vue 流头部 btn-area）、
        // 以及后续重置状态时，**必须用真实接口字段名**（workflowInstanceId）入参，不能用 planId + index 凑的 key。
        // 这几个字段不入 SCSS / 布局计算，添加零成本。
        awiWorkflowInstanceId: wf.awiWorkflowInstanceId,
        awiWorkflowStatus: wf.awiWorkflowStatus,
        awiWorkflowInstanceName: wf.awiWorkflowInstanceName
      })
    })
  })
  return flows
}

/** '2026-08-07 20:12:01' -> '20:12:01' */
export function toClock(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }
  const part = value.trim().split(/\s+/)
  return part.length > 1 ? part[1] : part[0]
}

/** 起止时间 -> 'HH:MM:SS'，缺任一端返回 '' */
export function formatDuration(start, end) {
  if (!start || !end) {
    return ''
  }
  const a = new Date(String(start).replace(/-/g, '/')).getTime()
  const b = new Date(String(end).replace(/-/g, '/')).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) {
    return ''
  }
  const total = Math.round((b - a) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

/* ------------------- 执行状态：文案来自字典，配色由前端决定 ------------------- */

/**
 * 状态字典类型（sys_dict_type.dict_type）。
 * 页面通过 RuoYi 的 dicts 机制加载：`dicts: [EXEC_STATUS_DICT_TYPE]`，
 * 再用 this.dict.label[EXEC_STATUS_DICT_TYPE][status] 取中文文案。
 * 该字典是「无样式」版（dict_code 里不带 css_class / list_class），
 * 所以配色完全由本文件的 statusTone 决定。
 *
 * 职责划分（刻意不重叠）：
 *   字典  —— 只负责「状态值 -> 中文文案」。改文案去后台字典管理改，前端不用动。
 *   本文件 —— 只负责「状态值 -> 配色分组（tone）」。前端不需要知道任何中文。
 * 因此这里**不保留中文兜底表**：一旦重复维护，两边会漂移，
 * 而且会让「字典到底有没有生效」变得无法从页面上看出来。
 * 字典没加载完时文案直接回落成状态值本身（如 SUCCESS），配合页头的字典状态提示，
 * 一眼就能分辨当前是字典生效还是字典没到位。
 */
export const EXEC_STATUS_DICT_TYPE = 'release_execute_status_no_css'

/**
 * 「查看明细」弹窗用的状态字典类型（sys_dict_type.dict_type）。
 *
 * 和 EXEC_STATUS_DICT_TYPE 是**两套独立字典**，别合并：
 *   本常量指的那个**带 list_class**，由 dict-tag 直接渲染成 el-tag，配色来自后台字典；
 *   EXEC_STATUS_DICT_TYPE 那个不带样式，配色由本文件的 statusTone 决定。
 * 所以这里也**不需要**中文兜底表 —— 明细表里字典缺项时显示原始值，一眼能看出字典没配全。
 *
 * 两个常量放一起是为了让「执行页面到底用了哪几套状态字典」一眼可见。
 */
export const DETAIL_STATUS_DICT_TYPE = 'release_execute_status'

/** 图例里 tone 的展示顺序（按重要性，不按字典顺序） */
export const TONE_ORDER = ['ok', 'run', 'init', 'confirm', 'bad', 'stop', 'cancel']

/**
 * 状态 -> 视觉分组（tone）。共 7 组：
 *   init    初始化 / 待开始 / 已提交            —— 还没开始
 *   run     执行中 / 依赖等待 / 异步验证执行     —— 进行中
 *   ok      执行成功                          —— 成功
 *   bad     执行失败 / 异步验证异常             —— 失败
 *   confirm 结果待确认 / 依赖确认 / 部分成功      —— 需要人介入
 *   stop    挂起                              —— 中止
 *   cancel  执行取消 / 跳过                     —— 作废
 */
const STATUS_TONE = {
  INIT: 'init',
  READY: 'init',
  SUBMIT: 'init',

  RUNNING: 'run',
  DEPEND_WAIT: 'run',
  VERIFY_EXEC: 'run',

  SUCCESS: 'ok',

  FAILED: 'bad',
  VERIFY_FAIL: 'bad',

  CONFIRM: 'confirm',
  DEPEND_CONFIRM: 'confirm',
  INCOM_SUCCESS: 'confirm',

  STOP: 'stop',

  CANCELLED: 'cancel',
  SKIP: 'cancel'
}

/**
 * 全部执行状态（词表）。直接从 STATUS_TONE 的 key 派生，避免再抄一份出来漂移。
 * 顺序即组内展示顺序，与字典 dict_code 顺序一致。
 * 用途：字典还没加载完时，用它把图例的「槽位」先撑起来（文案回落成状态值本身）。
 */
export const EXEC_STATUS_VALUES = Object.keys(STATUS_TONE)

/** 未知状态统一落到 init（中性灰），避免出现无样式节点 */
export function statusTone(status) {
  return STATUS_TONE[status] || 'init'
}

/* ------------------------------- 布局计算 ------------------------------- */

/**
 * 计算一条流的画布几何
 *
 * 步骤：① 建邻接表 → ② 按 aniNodeGroup 把节点收缩成 unit（并行组 = 一个 unit）
 *      → ③ 在收缩图上做 Kahn 拓扑 + 最长路径分层 → ④ 按层分列
 *      → ⑤ 列内纵向堆叠、每列垂直居中 → ⑥ unit 之间连线（组内不画线）
 *
 * @param {Array} rawNodes     wf.nodes（乱序）
 * @param {Array} rawRelations wf.relations（乱序）
 * @returns {{ width, height, nodes, edges, groups, links, units }}
 *   nodes : [{ id, x, y, w, h, group, gIndex, gSize, node }]  gIndex/gSize 为并行组内序号
 *   edges : [{ id, from, to, d, tone }]   d 为 SVG path，from/to 为 unit key
 *   groups: [{ key, x, y, w, h, label, count }]
 *   links : [{ id, x, y1, y2 }]  并行组内相邻成员之间的竖向连线（体现执行先后）
 */
export function layoutFlow(rawNodes, rawRelations) {
  const list = (Array.isArray(rawNodes) ? rawNodes : []).filter(
    n => n && n.aniInstanceNodeId !== undefined && n.aniInstanceNodeId !== null
  )
  if (!list.length) {
    return { width: 0, height: 0, nodes: [], edges: [], groups: [], links: [], units: [] }
  }

  const indexMap = new Map(list.map((n, i) => [n.aniInstanceNodeId, i]))
  const ids = list.map(n => n.aniInstanceNodeId)
  const idSet = new Set(ids)

  // ① 原始邻接表：去重、剔除自环与悬空引用
  const rawEdges = []
  const seenEdge = new Set()
  ;(Array.isArray(rawRelations) ? rawRelations : []).forEach(r => {
    const from = r && r.anirInstanceFromNodeId
    const to = r && r.anirInstanceToNodeId
    if (!idSet.has(from) || !idSet.has(to) || from === to) {
      return
    }
    const ek = from + '>' + to
    if (seenEdge.has(ek)) {
      return
    }
    seenEdge.add(ek)
    rawEdges.push([from, to])
  })

  // ② 收缩并行组：同一 aniNodeGroup 的节点合成一个 unit
  const unitOf = new Map()
  const units = new Map()
  list.forEach(n => {
    const key = n.aniNodeGroup ? 'g:' + n.aniNodeGroup : 'n:' + n.aniInstanceNodeId
    unitOf.set(n.aniInstanceNodeId, key)
    if (!units.has(key)) {
      units.set(key, { key, group: n.aniNodeGroup || null, items: [] })
    }
    units.get(key).items.push(n.aniInstanceNodeId)
  })
  units.forEach(u => u.items.sort((a, b) => indexMap.get(a) - indexMap.get(b)))

  const firstIdx = unit => indexMap.get(unit.items[0])

  // 收缩后的边（组内关系直接丢弃 —— 并行组内部不画线）
  const cSucc = new Map([...units.keys()].map(k => [k, []]))
  const cIndeg = new Map([...units.keys()].map(k => [k, 0]))
  const cEdges = []
  const cSeen = new Set()
  rawEdges.forEach(([a, b]) => {
    const ua = unitOf.get(a)
    const ub = unitOf.get(b)
    if (ua === ub) {
      return
    }
    const ck = ua + '>' + ub
    if (cSeen.has(ck)) {
      return
    }
    cSeen.add(ck)
    cSucc.get(ua).push(ub)
    cIndeg.set(ub, cIndeg.get(ub) + 1)
    cEdges.push([ua, ub])
  })

  // ③ Kahn 拓扑 + 最长路径分层
  const unitKeys = [...units.keys()]
  const level = new Map(unitKeys.map(k => [k, 0]))
  const deg = new Map(cIndeg)
  const ready = unitKeys
    .filter(k => cIndeg.get(k) === 0)
    .sort((a, b) => firstIdx(units.get(a)) - firstIdx(units.get(b)))
  const order = []
  while (ready.length) {
    const k = ready.shift()
    order.push(k)
    cSucc.get(k).forEach(next => {
      if (level.get(next) < level.get(k) + 1) {
        level.set(next, level.get(k) + 1)
      }
      deg.set(next, deg.get(next) - 1)
      if (deg.get(next) === 0) {
        ready.push(next)
      }
    })
  }
  // 兜底：数据成环时把剩余 unit 压到最后一层之后，保证不丢节点
  if (order.length < unitKeys.length) {
    const tail = order.length ? Math.max(...order.map(k => level.get(k))) + 1 : 0
    unitKeys
      .filter(k => !order.includes(k))
      .forEach(k => {
        level.set(k, tail)
        order.push(k)
      })
  }

  // ④ 按层分列
  const maxLevel = unitKeys.reduce((m, k) => Math.max(m, level.get(k)), 0)
  const columns = []
  for (let i = 0; i <= maxLevel; i++) {
    columns.push([])
  }
  order.forEach(k => columns[level.get(k)].push(k))
  columns.forEach(col => col.sort((a, b) => firstIdx(units.get(a)) - firstIdx(units.get(b))))

  // ⑤ 几何：unit 高 = 成员数 × NODE_H + 间距；列高 = 各 unit 高之和
  const colGeom = columns.map(col =>
    col.map(key => {
      const unit = units.get(key)
      const count = unit.items.length
      return {
        key,
        unit,
        width: unit.group ? NODE_W + GROUP_PAD * 2 : NODE_W,
        height: count * NODE_H + (count - 1) * GROUP_ROW_GAP
      }
    })
  )
  const colWidth = colGeom.map(slots => slots.reduce((m, s) => Math.max(m, s.width), 0))
  const colHeight = colGeom.map(slots =>
    slots.reduce((sum, s) => sum + s.height, 0) + Math.max(0, slots.length - 1) * SLOT_GAP
  )
  const contentHeight = colHeight.reduce((m, h) => Math.max(m, h), 0)

  const nodes = []
  const groups = []
  const links = [] // 并行组内部成员之间的竖向连接（体现执行先后）
  const rectOf = new Map() // unit key -> 用于连线的外框
  let cursorX = PAD_LEFT

  colGeom.forEach((slots, colIndex) => {
    let cursorY = PAD_TOP + Math.max(0, (contentHeight - colHeight[colIndex]) / 2)

    slots.forEach(slot => {
      const unit = slot.unit
      const x = cursorX + (colWidth[colIndex] - slot.width) / 2
      unit.items.forEach((id, i) => {
        nodes.push({
          id,
          x,
          y: cursorY + i * (NODE_H + GROUP_ROW_GAP),
          w: NODE_W,
          h: NODE_H,
          group: unit.group,
          gIndex: i + 1, // 组内第几个（体现执行先后）
          gSize: unit.items.length,
          node: list[indexMap.get(id)]
        })
      })
      // 并行组内部：相邻成员之间拉一条竖向短线，表示组内的执行先后
      if (unit.items.length > 1) {
        const cx = x + NODE_W / 2
        for (let i = 0; i + 1 < unit.items.length; i++) {
          const y1 = cursorY + i * (NODE_H + GROUP_ROW_GAP) + NODE_H
          links.push({
            id: `${unit.key}#${i}`,
            x: cx,
            y1,
            y2: y1 + GROUP_ROW_GAP
          })
        }
      }
      if (unit.group) {
        const box = {
          key: `${colIndex}:${unit.group}`,
          x: x - GROUP_PAD,
          y: cursorY - GROUP_PAD,
          w: NODE_W + GROUP_PAD * 2,
          h: slot.height + GROUP_PAD * 2,
          label: String(unit.group).slice(0, 8),
          count: unit.items.length
        }
        groups.push(box)
        rectOf.set(unit.key, box)
      } else {
        rectOf.set(unit.key, { x, y: cursorY, w: NODE_W, h: NODE_H })
      }
      cursorY += slot.height + SLOT_GAP
    })

    cursorX += colWidth[colIndex] + COL_GAP
  })

  // ⑥ 连线：从源 unit 外框右中 → 目标 unit 外框左中
  const nodeById = new Map(list.map(n => [n.aniInstanceNodeId, n]))
  const edges = cEdges
    .filter(([a, b]) => rectOf.has(a) && rectOf.has(b))
    .map(([a, b]) => {
      const A = rectOf.get(a)
      const B = rectOf.get(b)
      const x1 = A.x + A.w
      const y1 = A.y + A.h / 2
      const x2 = B.x - 6 // 给箭头留落点
      const y2 = B.y + B.h / 2
      const k = Math.max(26, (x2 - x1) * 0.42)
      return {
        id: `${a}>${b}`,
        from: a,
        to: b,
        d: `M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`,
        // 目标 unit 全部成功 -> 绿色，否则用中性色（和节点的 init 同一套色）
        tone: units.get(b).items.every(id => statusTone(nodeById.get(id).aniStatus) === 'ok')
          ? 'ok'
          : 'init'
      }
    })

  const width = Math.max(cursorX - COL_GAP + PAD_RIGHT, NODE_W + PAD_LEFT + PAD_RIGHT)
  const height = contentHeight + PAD_TOP + PAD_BOTTOM

  return { width, height, nodes, edges, groups, links, units: colGeom.flat().map(s => s.unit) }
}
