/**
 * 工单甘特图演示数据层（**只有 mock 实现**）
 * ==========================================================================
 * 什么时候会跑到这里
 *   只有 ./_mockFlag.js 的 USE_MOCK 为 true 时，orderGantt.js 才会动态 import
 *   本文件。USE_MOCK 为 false 时本文件（连同 mockData/res.js 那 2.8MB 假数据）
 *   不会被加载 —— 那段 import 根本不会执行。
 *
 * 与 orderGantt.js 的分工
 *   orderGantt.js   负责「分发」+ 真实接口的契约文档（路径 / 入参 / 返回 / 坑）
 *   本文件          负责「假数据怎么造」
 *   两个文件都改了才算改了一个接口 —— 别只改一边。
 *
 * 数据从哪来
 *   mockData/res.js 的 `orderRes` 只给了 3 条样例；这里把它当**模板**交给
 *   ./_demoOrderGantt.js 扩到 100 条（时间锚定今天 18:00，跨度不超过 3 天）。
 *   为什么不在 res.js 里直接铺 100 条静态数据：那是 2.8MB 的生成文件，
 *   往里塞 100 条工单既难维护、又没法保证「跨度不超 3 天」这条约束。
 *
 * 接真实接口后怎么删
 *   1. ./_mockFlag.js 的 USE_MOCK 改成 false，确认页面正常
 *   2. 删掉本文件、./_demoOrderGantt.js，以及 orderGantt.js 里
 *      `if (USE_MOCK) { ... }` 那三行
 * ==========================================================================
 */
import { orderRes } from '../../../mockData/res'
import { buildOrderList } from './_demoOrderGantt'

/**
 * 获取工单列表（甘特图数据源）
 *
 * 返回结构与 mockData/res.js 里的 orderRes 完全一致：
 *   { code, msg, data: [ { orderId, total_cost, beginTime, endTime, mode, detail } ] }
 *
 * `detail` 是**对象数组**，每项字段固定 `{ type, count, type_cost }`，
 * 悬浮气泡用表格展示（表头就是这三个 key）。**别造嵌套结构** —— 表格渲染不了。
 *
 * 返回**深拷贝**：页面 / 组件不该改到这份假数据本身（否则第二次点「查看」就变样了）。
 *
 * @param {Object} [params] 真实接口的查询参数（系统、日期区间等），mock 阶段忽略
 * @returns {Promise<{code, msg, data}>}
 */
export function getOrderList(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const seeds = (orderRes && orderRes.data) || []
      resolve({
        code: orderRes && orderRes.code != null ? orderRes.code : 200,
        msg: (orderRes && orderRes.msg) || '查询成功',
        data: buildOrderList({ seeds, count: 100 })
      })
    }, 320)
  })
}

export default { getOrderList }
