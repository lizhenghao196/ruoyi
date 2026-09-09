/**
 * 异常资源月报 - 公共工具方法
 * 状态、指标、格式化相关的纯函数，供页面各组件复用
 */

// code: 0 正常 / 1 不饱和 / 2 负载高
const STATUS = {
  0: { key: 'normal', label: '正常', color: '#67C23A', tag: 'success' },
  1: { key: 'warning', label: '不饱和', color: '#E6A23C', tag: 'warning' },
  2: { key: 'danger', label: '负载高', color: '#F56C6C', tag: 'danger' }
}

/** 获取指标级别描述信息，未知级别兜底为「正常」 */
export function getStatusInfo(code) {
  const c = code === undefined || code === null || code === '' ? 0 : Number(code)
  return STATUS[c] || STATUS[0]
}

/**
 * 资源整体异常级别 = inspect_data 中所有指标的最高级别
 * @param {Object} inspectData
 */
export function getResourceStatus(inspectData) {
  if (!inspectData || typeof inspectData !== 'object') return STATUS[0]
  let level = 0
  Object.keys(inspectData).forEach((key) => {
    const m = inspectData[key]
    if (m && m.code !== undefined && m.code !== null) {
      level = Math.max(level, Number(m.code) || 0)
    }
  })
  return getStatusInfo(level)
}

/** 指标名称显示映射，未知指标兜底显示原始名称 */
const METRIC_NAMES = {
  CPU使用率: 'CPU使用率',
  内存使用率: '内存使用率',
  'Filesystem space available': '磁盘使用率'
}

export function getMetricName(name) {
  return METRIC_NAMES[name] || name
}

/** 判断指标是否为 avg/min/max/p99 类的百分比指标 */
export function isUsageLikeMetric(m) {
  return !!m && typeof m === 'object' && 'avg' in m && 'p99' in m
}

/** 判断指标是否为 磁盘可用空间(usage) 类指标 */
export function isFsLikeMetric(m) {
  return !!m && typeof m === 'object' && !('avg' in m) && 'usage' in m
}

/** 指标核心数值（进度条按它展示）：百分比指标取 max，磁盘类取 usage */
export function getMetricCoreValue(m) {
  if (!m || typeof m !== 'object') return null
  if (isUsageLikeMetric(m)) return Number(m.max)
  if (isFsLikeMetric(m)) return Number(m.usage)
  const first = Object.keys(m).find((k) => typeof m[k] === 'number')
  return first !== undefined ? Number(m[first]) : null
}

/**
 * 数字格式化：null/undefined/'' 显示 --，最多保留 decimals 位小数
 * 去掉多余的尾零（77.80 -> 77.8）
 */
export function formatNumber(value, decimals = 2) {
  if (value === undefined || value === null || value === '') return '--'
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  const fixed = num.toFixed(decimals).replace(/(\.\d*?)0+$/, '$1')
  return fixed.endsWith('.') ? fixed.slice(0, -1) : fixed
}

/** 百分比进度值（0 ~ 100），非法值返回 0，避免进度条报错 */
export function clampPercent(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.min(100, Math.max(0, num))
}

/** mtype -> 机型文案，未知兜底原文 */
export function machineTypeLabel(mtype) {
  const map = { p: '物理机', v: '虚拟机' }
  return mtype ? map[mtype] || mtype : '--'
}

/** 分类图标：HADOOP/应用 专用图标，未知分类给默认图标 */
export function getCategoryIcon(name) {
  const map = { HADOOP: 'el-icon-monitor', 应用: 'el-icon-box' }
  return map[name] || 'el-icon-coin'
}

/**
 * 采集异常扁平化：
 * { REDIS: [...], 应用: [...] } -> [ { type, ip, desc } ]
 */
export function flattenCollectException(collect) {
  if (!collect || !collect.数据 || typeof collect.数据 !== 'object') return []
  const rows = []
  Object.keys(collect.数据).forEach((type) => {
    const list = collect.数据[type]
    if (!Array.isArray(list)) return
    list.forEach((row) => {
      if (!row) return
      rows.push({
        type: type,
        ip: row.ip,
        desc: row.desc
      })
    })
  })
  return rows
}
