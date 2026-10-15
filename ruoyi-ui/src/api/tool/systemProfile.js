import { systemProfileRes } from '../../../mockData/res'

/**
 * 系统画像接口
 *
 * 返回数据与 mockData/res.js 中的 systemProfileRes 结构保持一致：
 * {
 *   基础信息: { 主机房, 数据中心[], 系统名, 系统简介, 系统重要性级别, 所属集群 },
 *   组件拓扑: { 组件类型: { 集群名: [ 主机对象 ] } },
 *   链路: 链路关系图数据，前端 normalizeLinks 兼容两种格式：
 *     1. 对象数组：[{ fnode: "A", snode: "B" }, ...]
 *     2. 生产网真实格式（元组）：[["A", "snode", "B"], ...] / [["A", "", "B"], ...]
 *     节点名是原始字符串（如 bpc@SZ-CS-SCYW-CSPROD@app-bpc），不带「组件类型/集群名」前缀；
 *     节点一律同色，只按链路关系分层排布，不做任何特殊标记
 *     附加字段可选：例如 desc（链路描述），有就在悬浮连线时展示，没有就不显示 ——
 *     对象格式直接加键（{ fnode, snode, desc }），元组格式在末尾挂一个对象
 *     （["A", "snode", "B", { desc: "..." }]）；除 source/target 外的字段都会原样透传
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
