/**
 * ⚠️ 演示专用：节点完成消息推送（「设置消息推送」弹窗）的 mock 状态
 * ==========================================================================
 * 这两个接口在 mockData/res.js 里没有现成数据，本文件负责把「查」和「设」串起来：
 *
 *   查  POST /python/api/func/getPlanExtraInfo   { planId: Number[] }
 *       -> { code: 0, data: { nodeFinishedSms: { groupId, send } }, msg }
 *   设  POST /python/api/func/setNodeFinishSms   { planId: Number[], sendFlag, groupId }
 *       -> { code: 0, data: null, msg }
 *
 * **为什么要一个模块级的状态**：execPlan.js 的 mock 全是「现算」的，没有地方存
 * 用户刚设过的值。不存的话点完「确定」再打开弹窗又回到默认值，看着像接口没生效 ——
 * 和 `_demoAtom.js` 里 ATOM_STATUS_OVERRIDE 是同一个理由。
 *
 * **为什么只有一份状态、不按 planId 分**：入参是 planId **数组**，但返回是**单个对象**
 * （见上面 getPlanExtraInfo 的形状）—— 后端显然是把这一批计划聚合成一个值给前端。
 * mock 就照这个形状来：一次设置 = 一份状态。不去猜「后端按什么规则聚合」，
 * 猜错了比简单实现更糟（本项目有过「把猜的结论写进注释、后面全建立在它上面」的教训）。
 *
 * 接入真实接口后怎么删
 *   1. 删掉本文件
 *   2. 删掉 execPlan.js 顶部的 import，以及 getPlanExtraInfo / setNodeFinishSms
 *      里标注「演示用」的那一段
 * ==========================================================================
 */

/**
 * 默认状态：与接口返回示例一致（`{groupId: 0, send: "N"}` = 没设过 / 关闭）。
 * `groupId: 0` 就是「未配置群组」，所以它是**合法值**，不要当空值拦掉。
 */
export const DEFAULT_SMS = { groupId: 0, send: 'N' }

/** 当前状态（模块级；刷新页面即回到默认值，和别的 mock 一样） */
let current = { ...DEFAULT_SMS }

/**
 * 读当前状态。返回**副本** —— 调用方拿到的对象改不动内部值。
 * @returns {{groupId: Number, send: 'Y'|'N'}}
 */
export function getSmsOverride() {
  return { ...current }
}

/**
 * 记一次设置。
 *
 * sendFlag 只认 'Y'（开启），其余一律落到 'N'（关闭）——
 * 与接口语义一致（`send: "Y"` 开启 / `"N"` 关闭），也不给脏值留活路。
 *
 * @param {String} sendFlag 'Y' | 'N'
 * @param {Number|String} groupId
 * @returns {{groupId: Number, send: 'Y'|'N'}} 设置后的状态
 */
export function setSmsOverride(sendFlag, groupId) {
  const gid = Number(groupId)
  current = {
    send: String(sendFlag) === 'Y' ? 'Y' : 'N',
    groupId: Number.isFinite(gid) ? gid : 0
  }
  return getSmsOverride()
}

export default { DEFAULT_SMS, getSmsOverride, setSmsOverride }
