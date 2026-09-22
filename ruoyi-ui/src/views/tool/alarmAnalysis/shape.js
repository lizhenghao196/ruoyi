/**
 * 告警分析页的数据形态判定与区块构建。
 *
 * ⚠️ 纯函数模块：不 import Vue / Element / api，可在 node 里直接跑断言（见技能 ruoyi-ui-node-verify）。
 *
 * 后端返回的载荷是「按顶层 key 分块」的，**每块的形态可能不同**，页面不再硬编码 P1/P2/P3，
 * 而是按形态动态渲染：
 *
 *   metrics    指标型：{ 指标名: 标量 }                 → 所有指标型 key **合并成一条**指标条（不再按 P1/P2 分组）
 *   table      表格型：{ 分类名: [告警行] }              → 一张表 / 多分类 el-tabs
 *   nested     两级型：{ 一级: { 二级: [告警行] } }      → 一级 el-tabs + 二级切换 + 表格（本项目 = AI处置）
 *   duplicate  重复型：[ { data: [...], 重复性说明 } ]   → 重复性分析表
 *   rows       行数组：[ 告警行 ]                       → 单表
 *   empty      空（{} / []）                          → 不渲染
 *   其它（raw）                                       → 不渲染
 *   混合型（同一 key 下既有标量又有数组）               → 逐子项拆到「指标组 / 表格区块 / 两级区块」，不丢数据
 *
 * 「重复性分析」这类 key 后端**可能不返回** —— 本模块按 key 存在与否决定是否产出区块，
 * 页面只渲染产出的区块，因此不返回就是不渲染（不需要页面写任何特判）。
 */

const ICONS = {
  metrics: 'el-icon-data-analysis',
  table: 'el-icon-warning-outline',
  nested: 'el-icon-cpu',
  duplicate: 'el-icon-refresh'
}

/** 合并指标条在 collapsed 里的固定 key（指标不是 payload 的某个 key） */
export const METRICS_KEY = '__metrics__'

/** 合并后那唯一一条指标条的名字（只有一个分组，界面上不再显示分组标签） */
export const METRIC_GROUP_NAME = '指标'

/**
 * 指标展示顺序 —— **唯一来源**。
 *
 * 后端仍然按 P1 / P2 拆 key 返回，但**页面上不再区分**：所有指标合并成一条，
 * 顺序以本表为准，**与接口返回的 key 顺序无关**。
 * 表里没列到的指标（后端新增）排在已列出指标之后，并保持它们之间的接口返回顺序（稳定排序）。
 */
export const METRIC_ORDER = [
  'AI处置量',
  'AI处置率',
  'AI关闭',
  'AI关单率',
  '人工关闭',
  '人工关单率',
  '自动化关闭',
  '自动化关单率',
  'AI未纳管',
  '告警总量'
]

/** 指标名 → 顺序位次（未列出的指标统一排在最后） */
const METRIC_INDEX = METRIC_ORDER.reduce((map, name, index) => {
  map[name] = index
  return map
}, {})

/**
 * 按 METRIC_ORDER 给指标排序（稳定排序）。
 *
 * 未列入 METRIC_ORDER 的指标统一视作同一档「最后」，按传入顺序原样排在后面，
 * 不会因为排序而丢失，也不会打乱后端新增指标之间的相对次序。
 *
 * @param {Array<{key: string}>} metrics toMetrics 的产物
 * @returns {Array} 新数组（不改原数组）
 */
export function orderMetrics(metrics) {
  const fallback = METRIC_ORDER.length
  return (metrics || [])
    .map((metric, index) => ({ metric: metric, index: index }))
    .sort((a, b) => {
      const ia = METRIC_INDEX[a.metric.key]
      const ib = METRIC_INDEX[b.metric.key]
      const ra = ia === undefined ? fallback : ia
      const rb = ib === undefined ? fallback : ib
      return ra === rb ? a.index - b.index : ra - rb
    })
    .map((item) => item.metric)
}

const SCALAR_TYPES = ['string', 'number', 'boolean']

export function isPlain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isScalar(value) {
  return value === null || value === undefined || SCALAR_TYPES.indexOf(typeof value) > -1
}

/** 告警行数组：非空且元素都是对象 */
export function isRowArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isPlain)
}

/** 重复性分析： [ { data: [告警行], 重复性说明 } ] */
export function isDuplicateGroups(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((g) => isPlain(g) && Array.isArray(g.data) && '重复性说明' in g)
  )
}

/** 两级型： { 一级: { 二级: [告警行] } } */
export function isNestedGroups(value) {
  if (!isPlain(value)) return false
  const vals = Object.values(value)
  return vals.length > 0 && vals.every((x) => isPlain(x) && Object.values(x).every(Array.isArray))
}

/**
 * 判定一个值的形态。
 * @returns {'empty'|'metrics'|'table'|'nested'|'duplicate'|'rows'|'raw'|'mixed'}
 */
export function shapeOf(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty'
    if (isDuplicateGroups(value)) return 'duplicate'
    if (value.every(isPlain)) return 'rows'
    return 'raw'
  }
  if (!isPlain(value)) return 'raw'
  const vals = Object.values(value)
  if (vals.length === 0) return 'empty'
  if (vals.every(isScalar)) return 'metrics'
  if (vals.every(Array.isArray)) return 'table'
  if (isNestedGroups(value)) return 'nested'
  return 'mixed'
}

/**
 * 单个指标的展示态。
 * 无值（含空串）或 0（含 "0.0%"）算「没有数据」：灰色弱化，但仍展示。
 */
export function metricTone(raw) {
  const empty = raw === undefined || raw === null || raw === ''
  if (empty) return 'muted'
  const num = Number(String(raw).replace('%', ''))
  return !isNaN(num) && num === 0 ? 'muted' : 'active'
}

/** { 指标名: 值 } → [ { key, value, display, tone } ]（保持原始顺序） */
export function toMetrics(obj) {
  return Object.keys(obj || {}).map((key) => {
    const raw = obj[key]
    const empty = raw === undefined || raw === null || raw === ''
    return {
      key: key,
      value: raw,
      display: empty ? '-' : raw,
      tone: metricTone(raw)
    }
  })
}

/** 分类列表 → 表格区块描述 */
function makeTableSection(key, lists) {
  const items = lists.map((l) => ({ name: l.name, rows: l.rows }))
  if (items.length === 0) return null
  const total = items.reduce((sum, item) => sum + item.rows.length, 0)
  const single = items.length === 1
  return {
    key: key,
    kind: 'table',
    title: single && items[0].name !== key ? `${key} · ${items[0].name}` : key,
    icon: ICONS.table,
    badge: single ? `${total} 条` : `${items.length} 类 / ${total} 条`,
    lists: items
  }
}

/** 两级型 → 区块描述： levels[].groups[].rows[] */
function makeNestedSection(key, value) {
  const levels = Object.keys(value).map((name) => ({
    name: name,
    groups: Object.keys(value[name] || {}).map((groupName) => ({
      name: groupName,
      rows: Array.isArray(value[name][groupName])
        ? value[name][groupName].filter(isPlain)
        : []
    }))
  }))
  if (levels.length === 0) return null
  const total = levels.reduce(
    (sum, level) => sum + level.groups.reduce((s, group) => s + group.rows.length, 0),
    0
  )
  return {
    key: key,
    kind: 'nested',
    title: key,
    icon: ICONS.nested,
    badge: `${levels.length} 类 / ${total} 条`,
    levels: levels
  }
}

/** 重复性分析 → 区块描述（只保留真有明细的分组） */
function makeDuplicateSection(key, groups) {
  const valid = groups.filter((g) => isPlain(g) && Array.isArray(g.data) && g.data.length > 0)
  const rows = valid.reduce((sum, g) => sum + g.data.length, 0)
  return {
    key: key,
    kind: 'duplicate',
    title: key,
    icon: ICONS.duplicate,
    badge: `${valid.length} 组 / ${rows} 条`,
    groups: valid
  }
}

/**
 * 把接口载荷拆成「指标条 + 区块列表」。
 *
 * 指标永远排在最前面（看板习惯：先总览后明细），其余区块保持 payload 里的 key 顺序。
 *
 * ⚠️ 指标**不再按 key 分组**：后端照旧返回 P1 / P2 两个（或更多）指标型 key，
 * 但这里会把它们全部合并成**同一条**，顺序由 `METRIC_ORDER` 决定 ——
 * 所以后端怎么拆 key、按什么顺序返回，都不影响页面展示。
 *
 * @param {Object} payload 接口载荷
 * @returns {{ metricGroups: Array<{name, metrics}>, sections: Array<Object> }}
 */
export function buildSections(payload) {
  const sections = []
  // 合并用的指标池：跨 key 累积（P1 + P2 …），最后统一排序成一条
  const metrics = {}
  if (!isPlain(payload)) return { metricGroups: [], sections: sections }

  const pushList = (key, lists) => {
    const section = makeTableSection(key, lists)
    if (section) sections.push(section)
  }
  const pushNested = (key, value) => {
    const section = makeNestedSection(key, value)
    if (section) sections.push(section)
  }

  Object.keys(payload).forEach((key) => {
    const value = payload[key]
    const shape = shapeOf(value)

    if (shape === 'empty' || shape === 'raw') return

    if (shape === 'metrics') {
      Object.keys(value).forEach((name) => {
        metrics[name] = value[name]
      })
      return
    }
    if (shape === 'table') {
      pushList(key, Object.keys(value).map((name) => ({ name: name, rows: value[name].filter(isPlain) })))
      return
    }
    if (shape === 'rows') {
      pushList(key, [{ name: key, rows: value.filter(isPlain) }])
      return
    }
    if (shape === 'nested') {
      pushNested(key, value)
      return
    }
    if (shape === 'duplicate') {
      sections.push(makeDuplicateSection(key, value))
      return
    }

    // mixed：同一个 key 下混着标量 / 数组 / 两级对象 —— 逐子项拆到对应位置，不丢数据
    const lists = []
    const nested = {}
    Object.keys(value).forEach((subKey) => {
      const sub = value[subKey]
      if (isScalar(sub)) {
        metrics[subKey] = sub
      } else if (Array.isArray(sub)) {
        lists.push({ name: subKey, rows: sub.filter(isPlain) })
      } else if (isNestedGroups(sub)) {
        nested[subKey] = sub
      }
    })
    if (lists.length > 0) pushList(key, lists)
    if (Object.keys(nested).length > 0) pushNested(key, nested)
  })

  // 所有指标合并成唯一一条（不再分组），顺序按 METRIC_ORDER
  const merged = orderMetrics(toMetrics(metrics))
  const metricGroups = merged.length > 0 ? [{ name: METRIC_GROUP_NAME, metrics: merged }] : []
  return { metricGroups: metricGroups, sections: sections }
}

/** 某个区块里的告警条数（duplicate 按明细行数算） */
export function sectionRowCount(section) {
  if (!section) return 0
  if (section.kind === 'table') {
    return section.lists.reduce((sum, list) => sum + list.rows.length, 0)
  }
  if (section.kind === 'nested') {
    return section.levels.reduce(
      (sum, level) => sum + level.groups.reduce((s, group) => s + group.rows.length, 0),
      0
    )
  }
  if (section.kind === 'duplicate') {
    return section.groups.reduce((sum, group) => sum + group.data.length, 0)
  }
  return 0
}

/** 二级筛选的「全部」哨兵值（把某个一级下的所有告警源合并展示） */
export const ALL_GROUPS = '__all__'

/** 某个一级（nested 区块的 `levels[i]`）下的总条数 */
export function levelRowCount(level) {
  return ((level && level.groups) || []).reduce((sum, group) => sum + group.rows.length, 0)
}

/**
 * 按二级筛选值把某个一级下的告警源分组拍平成行。
 *
 * `filter` 为空 / `ALL_GROUPS` → 全部；
 * 筛选值已失效（数据刷新后那个告警源没了）→ **也退回全部**，避免用户看到一张空表却不知道为什么。
 *
 * ⚠️ 二级数量不定（可能十几二十个），所以这里是「筛选」不是「切换」：
 * 默认就是全部，界面上的 chip 只是把范围缩小，任何告警源都不会被默认藏起来。
 */
export function flattenLevel(level, filter) {
  const groups = (level && level.groups) || []
  const all = () => groups.reduce((acc, group) => acc.concat(group.rows), [])
  if (!filter || filter === ALL_GROUPS) return all()
  const hit = groups.find((group) => group.name === filter)
  return hit ? hit.rows : all()
}

/**
 * 组装查询参数。
 *
 * ⚠️ 系统 ID 是**选填**的：用户没填时**不要带 `systemId` 字段**（不是空串，是压根没有这个 key）。
 *
 * 组别 `teamName` 相反 —— 下拉框有默认值「不限定组别」（字典 `dict_system_group` 的第一项），
 * 它本身就是一个有效的筛选语义（= 不按组别过滤），所以**始终带上**，不做「空就不带」的处理。
 */
export function buildQueryParams(form) {
  const src = form || {}
  const range = Array.isArray(src.dateRange) ? src.dateRange : []
  const params = {}
  const systemId = String(src.systemId === undefined || src.systemId === null ? '' : src.systemId).trim()
  if (systemId) params.systemId = systemId
  params.teamName = String(src.teamName === undefined || src.teamName === null ? '' : src.teamName).trim()
  params.startDate = range[0] || ''
  params.endDate = range[1] || ''
  return params
}

/**
 * 一级 tab 的语义色调（用于标题前的小圆点）：
 *   成功 / SUCCESS / OK  → ok（绿）
 *   失败 / FAIL          → bad（红）
 *   重放 / ERROR / REPLAY → warn（橙）
 *   其它                 → info（蓝）
 *
 * 顺序不能换：`HANDLED_ERROR_REPLAY` 里既有 ERROR 也不含「成功/失败」，
 * 只有把「成功 → 失败 → 重放」按这个次序判，它才会落到 warn。
 */
export function levelTone(name) {
  const text = String(name === undefined || name === null ? '' : name)
  if (/成功|SUCCESS|OK|PASS/i.test(text)) return 'ok'
  if (/失败|FAIL/i.test(text)) return 'bad'
  if (/重放|ERROR|REPLAY/i.test(text)) return 'warn'
  return 'info'
}

export default {
  METRICS_KEY,
  METRIC_GROUP_NAME,
  METRIC_ORDER,
  ALL_GROUPS,
  isPlain,
  isScalar,
  isRowArray,
  isDuplicateGroups,
  isNestedGroups,
  shapeOf,
  metricTone,
  toMetrics,
  orderMetrics,
  buildSections,
  sectionRowCount,
  levelRowCount,
  flattenLevel,
  buildQueryParams,
  levelTone
}
