import request from "@/utils/request";
import { USE_MOCK } from "./_mockFlag";
// 取载荷的规则只有一份，别在这里再抄一遍（为什么必须走它，见 execPlan.js 的注释）
import { pickPayload } from "./execPlan";

/**
 * 工单甘特图接口（views/tool/orderGantt）
 * ==========================================================================
 * 演示 / 真实接口的切换
 *   每个函数开头都是同一个套路：
 *
 *     if (USE_MOCK) {
 *       return mockApi('xxx', 参数)   // 走 ./_mockOrderGantt.js 里的假数据
 *     }
 *     return request({ ... })        // 走真实后端
 *
 *   开关在 ./_mockFlag.js 的 USE_MOCK，**改一处即整页生效**，不用再注释代码。
 *   mock 实现全部集中在 ./_mockOrderGantt.js（按需加载：USE_MOCK 为 false 时不会被加载）。
 *
 * ⚠️ 真实接口路径是**占位值**，还没跟后端对过 —— 联调前必须确认，别直接上生产。
 * ==========================================================================
 */

/**
 * 按需加载 mock 实现并调用。
 *
 * 用动态 import：USE_MOCK 为 false 时这一支根本不会执行，
 * _mockOrderGantt.js / _demoOrderGantt.js / mockData/res.js 也就不会被加载。
 */
function mockApi(name, ...args) {
  return import("./_mockOrderGantt").then((mod) => mod[name](...args));
}

/**
 * 获取工单列表（甘特图数据源）
 *
 * ⚠️ 路径待确认（占位）
 * POST /python/api/cicd/orderList
 * 入参：{ systemId?, beginTime?, endTime? } —— 具体字段以联调为准
 *
 * 返回：{ code, msg, data: [ ... ] }
 *   data 里每条：
 *     orderId     工单号（唯一，甘特图里当 key 用）
 *     total_cost  耗时 —— **单位是分钟**（不是毫秒、不是秒）
 *     beginTime   'YYYY-MM-DD HH:mm:ss'
 *     endTime     'YYYY-MM-DD HH:mm:ss'
 *     mode        'AUTO' 自动 / 'MANUAL' 手动（其它值一律按 MANUAL 处理）
 *     detail      **对象数组**，每项字段固定：{ type, count, type_cost }
 *                   type      变更类型名（长短不一，表格里要能换行）
 *                   count     次数
 *                   type_cost 该项耗时（分钟，样例里都是 5 的整数倍）
 *                 悬浮气泡用**表格**展示，表头直接取这三个 key ——
 *                 所以**不要**再往 detail 里塞嵌套对象 / 空值，表格渲染不了。
 *                 样例满足的两条自洽关系（已写成断言）：
 *                   sum(type_cost) <= total_cost；type_cost 是 5 的整数倍
 *
 * ⚠️ `total_cost` 与 `beginTime`/`endTime` 在样例里是**打架**的：
 *      样例 1  起止跨 5 小时（300 分钟）但 `total_cost: 115`
 *      样例 3  起止跨 6 小时（360 分钟）但 `total_cost: 135`
 *    所以「矩形多宽」不能直接信某一个字段 —— 判定规则统一放在
 *    `views/tool/orderGantt/ganttLayout.js` 的 resolveSpan()：
 *    **以 total_cost 为准（beginTime + total_cost 分钟），endTime 仅作兜底**。
 *    `endTime` 不代表工单实际占用的时间，只按它画会把矩形拉长一倍多。要改规则只改那一处。
 *
 * @param {Object} [params] 查询参数
 * @returns {Promise<{code, msg, data}>}
 */
export function getOrderList(params) {
  if (USE_MOCK) {
    // return mockApi("getOrderList", params);
    return {
      code: 200,
      msg: "查询成功",
      data: [
        {
          orderId: "CHGU-20260909-0086",
          total_cost: 30, // 耗时 - 分钟
          beginTime: "2026-09-17 18:00:00", // 开始时间
          endTime: "2026-09-17 23:00:00",
          mode: "AUTO", // AUTO:自动，MANUAL:手动
          detail: [
            {
              type: "容器云工程发布/重启",
              count: 2,
              type_cost: 30,
            },
            {
              type: "数据库发布",
              count: 1,
              type_cost: 15,
            },
            {
              type: "配置发布",
              count: 1,
              type_cost: 5,
            },
          ],
        },
        {
          orderId: "CHGU-20260909-0087",
          total_cost: 135, // 耗时 - 分钟
          beginTime: "2026-09-17 18:00:00", // 开始时间
          endTime: "2026-09-17 22:00:00",
          mode: "MANUAL", // AUTO:自动，MANUAL:手动
          detail: [
            {
              type: "配置发布",
              count: 1,
              type_cost: 5,
            },
          ],
        },
        {
          orderId: "CHGU-20260916-0047",
          total_cost: 135, // 耗时 - 分钟
          beginTime: "2026-09-18 00:00:00", // 开始时间
          endTime: "2026-09-18 06:00:00",
          mode: "MANUAL", // AUTO:自动，MANUAL:手动
          detail: [
            {
              type: "ITSM_原子变更_YUM包更新",
              count: 5,
              type_cost: 50,
            },
            {
              type: "ITSM_屏蔽告警",
              count: 1,
              type_cost: 5,
            },
          ],
        },
      ],
    };
  }
  return request({
    url: "/python/api/cicd/orderList",
    method: "post",
    data: params || {},
  });
}

export { pickPayload };

export default {
  getOrderList,
  pickPayload,
};
