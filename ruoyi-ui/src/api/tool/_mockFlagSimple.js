/**
 * 执行界面简版（execPlanList / execPageSimple）演示数据总开关
 * ==========================================================================
 *   true   → 本目录下 execPageSimple.js 里的接口**全部走本地 mock**
 *            （数据来自 ./_mockApiSimple.js + ./_demo*Simple.js + mockData/res.js）
 *   false  → **全部走真实后端**（execPageSimple.js 里的 request 分支）
 *
 * 只改这一个值，整条链路（变更计划列表页 + 执行界面简版）一起切换。
 *
 * ⚠️ 这个开关与 execPage 的 ./_mockFlag.js **是两个独立的开关**，互不影响 ——
 *    这是刻意设计的：简版页面从接口层到组件层都是自己的一套（见 execPageSimple.js 顶部说明），
 *    改 execPage 的东西不该波及简版页面，反之亦然。
 *
 * 注意：改成 false 之后，Simple 那套 mock 文件（_mockApiSimple.js / _demo*Simple.js）
 *      **不会再被加载** —— execPageSimple.js 是用动态 import 按需加载它们的。
 *      （mockData/res.js 是两套页面共享的假数据仓库，这一点是刻意的：
 *        用户明确允许「mockData 里的内容」共享，不允许共享组件 / 方法 / 接口。）
 *
 * 想彻底清掉 mock：把本文件删掉，同时删掉 execPageSimple.js 里每个函数开头的
 *      `if (USE_MOCK) { return mockApi(...) }` 三行即可（其余都是真实接口代码）。
 * ==========================================================================
 */
export const USE_MOCK = true
