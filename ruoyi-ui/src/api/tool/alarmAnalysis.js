import { analyzeRes } from '../../../mockData/res'

/**
 * 告警分析接口
 *
 * 返回数据与 mockData/res.js 中的 analyzeRes 结构保持一致：
 * {
 *   P1: { 指标名: 值 },                                // 汇总指标
 *   P2: { 人工关单: [ 告警对象 ] },
 *   P3: { Agent关闭失败: [ 告警对象 ], 告警未恢复: [ 告警对象 ] },
 *   重复性分析: [ { data: [ { alertKey, 内容, 原因 } ], 重复性说明 } ]
 * }
 * 告警对象字段见 mockData/res.js：表格直接展示 alertKey / summary / misInfoReason /
 * alertReasonDesc / alertSource / closedBy，AgentTrace 与 output 通过按钮弹窗查看，
 * 其余字段在「更多」弹窗中展示。
 *
 * 查询条件（页面上的 systemId / startDate / endDate）只做透传，Mock 数据不做任何筛选，
 * 无论传什么条件都返回全量示例数据；真实接口由后端按这些条件过滤。
 */

/**
 * 获取告警分析数据
 * @param {Object} params - { systemId, startDate, endDate }
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

export default { getAlarmAnalysis }
