import { analyzeRes } from '../../../mockData/res'

/**
 * 告警分析接口
 *
 * ⚠️ 返回结构**不再是固定的 P1/P2/P3**：后端按顶层 key 分块返回，每块的形态可能不同，
 * 页面按形态动态渲染（形态判定与区块构建见 `views/tool/alarmAnalysis/shape.js`）。
 *
 * 当前 mockData/res.js 里的 analyzeRes 覆盖了这几种形态：
 *   P1: { 指标名: 值 }                              指标型 ┐ 后端仍按 P1/P2 拆 key 返回，
 *   P2: { 指标名: 值 }                              指标型 ┘ 但页面把它们**合并成一条**指标条展示
 *   P3 / 人工关单 / 自动化关单:
 *        { 分类名: [ 告警行 ] }                      表格型 → 单分类直接出表，多分类用 tab
 *   AI处置:
 *        { 处置结果: { 告警源: [ 告警行 ] } }          两级型 → 一级 tab + 二级（告警源）切换 + 表格
 *   重复性分析: [ { data: [ { alertKey, 内容, 原因 } ], 重复性说明 } ]
 *                                                  重复型 → 分组纵向合并单元格
 *
 * ⚠️ **数据层不动**：接口照旧返回 P1 / P2；「不区分 P1/P2」只发生在展示层 ——
 * 所有「指标型」key 会被合并成同一条，顺序由 `views/tool/alarmAnalysis/shape.js` 的
 * `METRIC_ORDER` 决定（AI处置量 → AI处置率 → … → 告警总量），
 * 因此后端把指标拆成几个 key、按什么顺序返回，都不影响页面展示。
 *
 * 「重复性分析」这类 key 后端**可能不返回** —— 页面按 key 存在与否决定是否渲染，
 * 因此不返回就是不渲染，不需要页面做特判。
 *
 * 告警行字段：表格直接展示 alertKey / summary / misinfoReason（⚠️ i 是小写）/ alertReasonDesc；
 * alertSource / closedBy **不展示**；AgentTrace 通过「使用到的智能体」弹窗查看，
 * output 通过「告警详情」弹窗查看（按 markdown 渲染）。
 * alertKey 的值可点击、新开 tab 跳到外部告警详情页；「查看简报」按钮用 runId 跳外部简报页。
 *
 * 查询条件（页面上的 systemId / teamName / startDate / endDate）只做透传，Mock 数据不做任何筛选，
 * 无论传什么条件都返回全量示例数据；真实接口由后端按这些条件过滤。
 * ⚠️ `systemId` 选填（不填时参数里压根没有这个 key）；`teamName` 有默认值「不限定组别」（字典
 * `dict_system_group` 的第一项），始终带上 —— 它本身就是「不按组别过滤」这个有效语义。
 */

/**
 * 取接口载荷。
 *
 * 与 `api/tool/execPlan.js` 的 `pickPayload` 同一条规则：载荷**可能在 `data`、也可能在 `rows`**。
 * `data` 非 undefined/null 就用它（`[]` / `''` / `0` / `false` 都算有值，别用 `||` 判），
 * 否则用 `rows`，都没有才 null。
 *
 * @param {Object} res 接口原始响应
 * @returns {*} 载荷
 */
export function pickPayload(res) {
  if (!res || typeof res !== 'object') return null
  if (res.data !== undefined && res.data !== null) return res.data
  if (res.rows !== undefined && res.rows !== null) return res.rows
  return null
}

/**
 * 获取告警分析数据
 *
 * @param {Object} params - { systemId?, startDate, endDate }
 *   ⚠️ `systemId` 是**选填**的：用户没填时调用方不会带这个 key（见 shape.js 的 buildQueryParams）
 */
export function getAlarmAnalysis(params) {
  // Mock 模式：示例数据不过滤，直接全量返回
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        code: 200,
        msg: 'success',
        data: JSON.parse(JSON.stringify(analyzeRes))
      })
    }, 300)
  })

  // 真实接口
  // return request({
  //   url: '/tool/alarmAnalysis/list',
  //   method: 'get',
  //   params
  // })
}

export default { getAlarmAnalysis, pickPayload }
