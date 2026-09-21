import { analyzeRes } from '../../../mockData/res'

/**
 * 告警分析接口
 *
 * ⚠️ 返回结构**不再是固定的 P1/P2/P3**：后端按顶层 key 分块返回，每块的形态可能不同，
 * 页面按形态动态渲染（形态判定与区块构建见 `views/tool/alarmAnalysis/shape.js`）。
 *
 * 当前 mockData/res.js 里的 analyzeRes 覆盖了这几种形态：
 *   P1: { 指标名: 值 }                              指标型 → 与 P2 合并成一行，按 key 分组展示
 *   P2: { 指标名: 值 }                              指标型
 *   P3 / 人工关单 / 自动化关单:
 *        { 分类名: [ 告警行 ] }                      表格型 → 单分类直接出表，多分类用 tab
 *   AI处置:
 *        { 处置结果: { 告警源: [ 告警行 ] } }          两级型 → 一级 tab + 二级（告警源）切换 + 表格
 *   重复性分析: [ { data: [ { alertKey, 内容, 原因 } ], 重复性说明 } ]
 *                                                  重复型 → 分组纵向合并单元格
 *
 * 「重复性分析」这类 key 后端**可能不返回** —— 页面按 key 存在与否决定是否渲染，
 * 因此不返回就是不渲染，不需要页面做特判。
 *
 * 告警行字段：表格直接展示 alertKey / summary / misInfoReason / alertReasonDesc /
 * alertSource / closedBy，AgentTrace 与 output 通过按钮弹窗查看，其余字段在「更多」弹窗中展示。
 *
 * 查询条件（页面上的 systemId / startDate / endDate）只做透传，Mock 数据不做任何筛选，
 * 无论传什么条件都返回全量示例数据；真实接口由后端按这些条件过滤。
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
