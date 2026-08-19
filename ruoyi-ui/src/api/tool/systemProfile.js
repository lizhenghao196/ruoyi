import { systemProfileRes } from '../../../mockData/res'

/**
 * 系统画像接口
 *
 * 返回数据与 mockData/res.js 中的 systemProfileRes 结构保持一致：
 * {
 *   基础信息: { 主机房, 数据中心[], 系统名, 系统简介, 系统重要性级别 },
 *   组件拓扑: { 组件类型: { 集群名: [ 主机对象 ] } },
 *   链路: [ { fnode, snode } ],
 *   集群关系: { 组件类型: [ { clusterName, nodes[] } ] }
 * }
 */

const MOCK_PROFILE = {
  code: 200,
  msg: 'success',
  data: systemProfileRes
}

/**
 * 获取系统画像数据
 * @param {Object} params - 预留请求参数
 */
export function getSystemProfile(params) {
  // Mock 模式
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(MOCK_PROFILE)))
    }, 300)
  })

  // 真实接口
  // return request({
  //   url: '/tool/systemProfile/list',
  //   method: 'get',
  //   params
  // })
}

export default { getSystemProfile }
