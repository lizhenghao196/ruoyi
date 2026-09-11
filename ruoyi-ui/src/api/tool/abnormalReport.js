import { explistRes } from '../../../mockData/res'

/**
 * 异常资源月报接口
 *
 * 返回数据与 mockData/res.js 中的 explistRes 结构保持一致：
 * {
 *   指标异常: { 分类: [ 资源对象 ] },
 *   环比差异: {
 *     总结: { 上一个版本, 当前版本 },
 *     环比减少: [ { ip, idc } ],
 *     环比新增: [ 资源对象 ]
 *   },
 *   采集异常: { 数据: { 类型: [ { ip, desc } ] }, 采集日期 }
 * }
 * 分类名与指标结构可能动态变化，页面侧按 Object.keys 动态处理。
 */

const MOCK_RESPONSE = {
  code: 200,
  msg: 'success',
  data: explistRes
}

/**
 * 获取异常资源月报数据
 * @param {Object} params - { systemId, year, month_no }
 */
export function getAbnormalReport(params) {
  // Mock 模式
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(MOCK_RESPONSE)))
    }, 300)
  })

  // 真实接口
  // return request({
  //   url: '/tool/abnormalReport/list',
  //   method: 'get',
  //   params
  // })
}

export default { getAbnormalReport }
