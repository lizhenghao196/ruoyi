/**
 * 执行页面（execPage / execPlan）演示数据总开关
 * ==========================================================================
 *   true   → 本目录下 execPlan.js 里的接口**全部走本地 mock**
 *            （数据来自 ./_mockApi.js + ./_demo*.js + mockData/res.js）
 *   false  → **全部走真实后端**（execPlan.js 里的 request 分支）
 *
 * 只改这一个值，整页（执行页面 + 变更执行计划列表页）一起切换，
 * 不用再去逐个注释 / 取消注释接口实现。
 *
 * 注意：改成 false 之后，mock 那套文件（_mockApi.js / _demo*.js /
 *      mockData/res.js）**不会再被加载** —— execPlan.js 是用动态 import 按需加载它们的，
 *      webpack 会把它们切成独立的 chunk，开关为 false 时那段 import 根本不会执行。
 *      开关是编译期常量，构建时这一支应当会被整段消掉、chunk 也不生成，
 *      但**这句没实测过**（没跑 build:prod）；要确认就跑一次构建、看产物里还有没有 mock chunk。
 *
 * 想彻底清掉 mock：把本文件删掉，同时删掉 execPlan.js 里每个函数开头的
 *      `if (USE_MOCK) { return mockApi(...) }` 三行即可（其余都是真实接口代码）。
 * ==========================================================================
 */
export const USE_MOCK = true
