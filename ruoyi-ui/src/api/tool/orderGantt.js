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
 * 入参：{ date } —— 'YYYY-MM-DD'，页面弹窗里的日期选择器直接传过来
 *       （默认**当天**，见 views/tool/orderGantt/index.vue 的 defaultDate）
 *
 * ⚠️ **下面的 mock 分支刻意不按 `date` 过滤**：
 *    那 3 条样例工单的时间是 09-17 / 09-18，而默认日期是「今天」，
 *    一旦真过滤，页面上永远是「未取到任何工单数据」、弹窗都打不开。
 *    所以别顺手给它加过滤 —— 要看过滤效果请接真实接口（USE_MOCK = false）。
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
 *     node_detail **仅 AUTO 工单有**（2026-10-12 新增），对象数组，每项：
 *                   plan_start_time  该时间**之后**节点才可以开始执行
 *                                   （**不是**开始时间）；null = 取外层 beginTime
 *                   cost             该节点耗时（分钟）
 *                   node_name / node_type / node_id / plan_id / workflow_id 展示用
 *                 节点之间**串行**：一个做完才能做下一个，真正开始时间 =
 *                 max(前一个节点的真正结束时间, 本节点 plan_start_time)。
 *                 串行结果由 ganttLayout.js 的 computeNodeTimeline 算（纯函数），
 *                 柱子上「工单总时长里没被节点占用的片段」画成休息区域（灰白斜纹）。
 *
 * ⚠️ `total_cost` 与 `beginTime`/`endTime` 在样例里是**打架**的：
 *      样例 1  起止跨 5 小时（300 分钟）但 `total_cost: 115`
 *      样例 3  起止跨 6 小时（360 分钟）但 `total_cost: 135`
 *    所以「矩形多宽」不能直接信某一个字段 —— 判定规则统一放在
 *    `views/tool/orderGantt/ganttLayout.js` 的 resolveSpan()：
 *    **以 total_cost 为准（beginTime + total_cost 分钟），endTime 仅作兜底**。
 *    `endTime` 不代表工单实际占用的时间，只按它画会把矩形拉长一倍多。要改规则只改那一处。
 *
 * @param {Object} [params] 查询参数，`{ date: 'YYYY-MM-DD' }`
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
          url: "https://www.baidu.com",
          node_detail: [
            {
              cost: 15,
              node_id: 524465,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260909-0086",
              plan_id: 88435,
              plan_start_time: "2026-09-17 18:00:00",
              workflow_id: 60281,
            },
            {
              cost: 10,
              node_id: 524472,
              node_name: "人工节点",
              node_type: "人工确认",
              orderId: "CHGU-20260909-0086",
              plan_id: 88435,
              plan_start_time: null,
              workflow_id: 60281,
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
          url: "https://www.google.com",
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
          url: "https://www.github.com",
        },
        /* ---- 以下三条为 2026-10-12 新增的 AUTO 样例：演示 node_detail 串行执行 + 柱子上
           休息区域的三种形态 ----
              0110：中间有等待（后一节点 plan 晚于前一做完）+ 尾部余量
              0111：等待特别长（50 分钟的中间休息）
              0205：后一节点 plan 早于前一做完（排队，真正开始要等前一节点结束）
           ⚠️ 只有 AUTO 工单才有 node_detail；plan_start_time 为 null 表示取外层
           beginTime；plan_start_time 是「该时间后才能开始」，不是开始时间。 */
        {
          orderId: "CHGU-20260917-0110",
          total_cost: 120,
          beginTime: "2026-09-17 09:00:00",
          endTime: "2026-09-17 11:00:00",
          mode: "AUTO",
          detail: [
            { type: "容器云工程发布/重启", count: 2, type_cost: 50 },
            { type: "数据库发布", count: 1, type_cost: 30 },
            { type: "配置发布", count: 1, type_cost: 25 },
          ],
          url: "https://www.qq.com",
          node_detail: [
            {
              cost: 20,
              node_id: 600001,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              plan_start_time: "2026-09-17 09:00:00",
              workflow_id: 60281,
            },
            {
              cost: 30,
              node_id: 600002,
              node_name: "数据库变更",
              node_type: "数据库发布",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              // 09:50 才能开始，而上一节点 09:20 就做完了 → 中间休息 09:20~09:50
              plan_start_time: "2026-09-17 09:50:00",
              workflow_id: 60281,
            },
            {
              cost: 25,
              node_id: 600003,
              node_name: "配置下发",
              node_type: "配置发布",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              // null → 取外层 beginTime（09:00 后即可），实际 10:20 上一节点做完才开始
              plan_start_time: null,
              workflow_id: 60281,
            },
          ],
        },
        {
          orderId: "CHGU-20260917-0111",
          total_cost: 155,
          beginTime: "2026-09-17 13:00:00",
          endTime: "2026-09-17 15:35:00",
          mode: "AUTO",
          detail: [
            { type: "ITSM_原子变更_YUM包更新", count: 3, type_cost: 45 },
            { type: "人工确认", count: 2, type_cost: 30 },
            { type: "ITSM_屏蔽告警", count: 1, type_cost: 5 },
          ],
          url: "https://www.taobao.com",
          node_detail: [
            {
              cost: 40,
              node_id: 600010,
              node_name: "YUM包更新",
              node_type: "ITSM_原子变更_YUM包更新",
              orderId: "CHGU-20260917-0111",
              plan_id: 90002,
              plan_start_time: "2026-09-17 13:00:00",
              workflow_id: 60282,
            },
            {
              cost: 20,
              node_id: 600011,
              node_name: "人工审批",
              node_type: "人工确认",
              orderId: "CHGU-20260917-0111",
              plan_id: 90002,
              // 14:30 才能开始，上一节点 13:40 做完 → 中间休息 50 分钟
              plan_start_time: "2026-09-17 14:30:00",
              workflow_id: 60282,
            },
            {
              cost: 35,
              node_id: 600012,
              node_name: "屏蔽告警",
              node_type: "ITSM_屏蔽告警",
              orderId: "CHGU-20260917-0111",
              plan_id: 90002,
              plan_start_time: null,
              workflow_id: 60282,
            },
          ],
        },
        {
          orderId: "CHGU-20260918-0205",
          total_cost: 100,
          beginTime: "2026-09-18 10:00:00",
          endTime: "2026-09-18 11:40:00",
          mode: "AUTO",
          detail: [
            { type: "容器云工程发布/重启", count: 1, type_cost: 25 },
            { type: "数据库发布", count: 2, type_cost: 30 },
            { type: "配置发布", count: 1, type_cost: 20 },
          ],
          url: "https://www.jd.com",
          node_detail: [
            {
              cost: 35,
              node_id: 600020,
              node_name: "容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260918-0205",
              plan_id: 90003,
              plan_start_time: "2026-09-18 10:00:00",
              workflow_id: 60283,
            },
            {
              cost: 25,
              node_id: 600021,
              node_name: "数据库变更",
              node_type: "数据库发布",
              orderId: "CHGU-20260918-0205",
              plan_id: 90003,
              // plan（10:20）早于上一节点的真正结束（10:35）→ 排队等到 10:35 才开始
              plan_start_time: "2026-09-18 10:20:00",
              workflow_id: 60283,
            },
            {
              cost: 20,
              node_id: 600022,
              node_name: "配置下发",
              node_type: "配置发布",
              orderId: "CHGU-20260918-0205",
              plan_id: 90003,
              plan_start_time: null,
              workflow_id: 60283,
            },
          ],
        },
        {
          orderId: "CHGU-20260917-0206",
          total_cost: 50,
          beginTime: "2026-09-17 22:00:00",
          endTime: "2026-09-18 6:00:00",
          mode: "AUTO",
          detail: [
            { type: "容器云工程发布/重启", count: 2, type_cost: 50 },
            { type: "数据库发布", count: 1, type_cost: 30 },
            { type: "配置发布", count: 1, type_cost: 25 },
          ],
          node_detail: [
            {
              cost: 15,
              node_id: 600001,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              plan_start_time: "2026-09-18 00:30:00",
              workflow_id: 60281,
            },
            {
              cost: 10,
              node_id: 600001,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              plan_start_time: null,
              workflow_id: 60281,
            },
            {
              cost: 15,
              node_id: 600001,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              plan_start_time: "2026-09-17 22:00:00",
              workflow_id: 60281,
            },
            {
              cost: 10,
              node_id: 600001,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              plan_start_time: null,
              workflow_id: 60281,
            },
          ],
        },
        {
          orderId: "CHGU-20260917-0210",
          total_cost: 50,
          beginTime: "2026-09-18 00:00:00",
          endTime: "2026-09-18 6:00:00",
          mode: "AUTO",
          detail: [
            { type: "容器云工程发布/重启", count: 2, type_cost: 50 },
            { type: "数据库发布", count: 1, type_cost: 30 },
            { type: "配置发布", count: 1, type_cost: 25 },
          ],
          node_detail: [
            {
              cost: 50,
              node_id: 600001,
              node_name: "批处理-容器云发布",
              node_type: "容器云工程发布/重启",
              orderId: "CHGU-20260917-0110",
              plan_id: 90001,
              plan_start_time: null,
              workflow_id: 60281,
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
