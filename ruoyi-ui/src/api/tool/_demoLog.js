/**
 * ⚠️ 演示专用：`getUniqueInfo`（最新结果 / 历史结果 / 日志）的 mock 数据
 * ==========================================================================
 * POST /release/executeLog/getUniqueInfo 在 mockData/res.js 里没有现成数据，
 * 三个弹窗要展示的东西（执行日志、执行结果、历史结果）后端才有，
 * 所以这里按「原子 + 函数」的真实信息**造**一份形状正确的假数据。
 *
 * 返回的三个字段都是**字符串化 JSON**（前端拿到后要 JSON.parse）：
 *   aelMessage                执行日志：{ pre: [...], post: [...] }，每项 { timestamp, content(HTML) }
 *   aelAtomExecuteResult      执行结果：{ pre, post, pre_content, post_content }
 *                             其中 post_content.executeResultFlag === 'Y' 才展示执行结果表格，
 *                             post_content.getresult 是 aggregateByCmd 的输入
 *   aelAtomExecuteHisResult   历史结果：{ post: [{ timestamp, content(对象) }] }
 *
 * 接入真实接口后怎么删
 *   1. 删掉本文件
 *   2. 删掉 execPlan.js 顶部的 import，以及 getUniqueInfo 里标注「演示用」的那一段
 * ==========================================================================
 */

/** 造数据用的基准时间（2026-08-07 22:00:00，与 mock 里其它时间同一批） */
const BASE_TS = new Date('2026-08-07 22:00:00').getTime()

/** FNV-1a 32 位哈希 —— 与 _demoAtom.js / _demoTick.js 同一套，保证「同输入同输出」 */
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 稳定挑一个：同一 seed 每次拿到同一个值 */
function pick(list, seed) {
  return list[fnv1a(String(seed)) % list.length]
}

/** 把 '2026-08-07 22:00:00' 这种时间串转成毫秒；转不了就用基准时间 */
function ts(base, addSeconds) {
  const t = base ? new Date(base.replace(/-/g, '/')).getTime() : BASE_TS
  const start = Number.isNaN(t) ? BASE_TS : t
  return start + addSeconds * 1000
}

/** 一条执行日志（timeline 用，content 是 HTML —— 模板里是 v-html） */
function logItem(time, level, text) {
  const color = level === 'ERROR' ? '#c73b3b' : level === 'WARN' ? '#cf8f22' : '#3d4a5c'
  return {
    timestamp: time,
    content: `<div style="font-size:12.5px;line-height:1.7;color:${color}">[${level}] ${text}</div>`
  }
}

/** 一条日志序列（按函数名与阶段造，稳定可复现） */
function buildMessages(atom, funcName, phase) {
  const start = ts(atom.aaiStartTime, phase === 'pre' ? 0 : 30)
  const n = 2 + (fnv1a(funcName + phase) % 3)
  const out = []
  for (let i = 0; i < n; i++) {
    const seq = i + 1
    const level = i === n - 1 && fnv1a(funcName + phase + i) % 7 === 0 ? 'WARN' : 'INFO'
    const text =
      phase === 'pre'
        ? `预采集第 ${seq} 步：连接 ${pick(['BJ-DB', 'BJ-NFX', 'HF'], funcName + i)} 执行 ${funcName}`
        : `发布后第 ${seq} 步：校验 ${funcName} 执行结果，返回码 0`
    out.push(logItem(start + seq * 12, level, text))
  }
  return out
}

/**
 * 一个 cmd 的「执行结果」——形状对齐真实接口。
 *
 * ⚠️ `getresult` 不是一个字符串，而是 **{ rowList, total }**：
 *   rowList  二维数组，**第 0 行是表头**，其余是数据行（每行是值数组，按列下标对齐表头）
 *   total    数据行条数（不含表头）
 *
 * 组件的 aggregateByCmd 就是按这个形状拆出 header / row 的：
 *   header = rowList[0]（`\n` 会被去掉，`.` 会被去掉后当 prop）
 *   row    = rowList.slice(1) 映射成 { [表头]: 值 }
 * 表头里故意带一个 `.`（`MODULE.NAME`），用来验证「列 prop 会去掉点号」这条规则。
 */
function resultGroup(cmd, seed) {
  const idc = pick(['BJ-DB', 'BJ-NFX', 'HF'], seed)
  const header = ['IDC', 'MODULE.NAME', 'STATUS', 'RET_CODE']
  const rowCount = 1 + (fnv1a(seed) % 3)
  const rowList = [header]
  for (let i = 0; i < rowCount; i++) {
    rowList.push([
      pick(['BJ-DB', 'BJ-NFX', 'HF'], seed + i),
      `${cmd.split(' ').pop()}.${i + 1}`,
      i === rowCount - 1 && fnv1a(seed + i) % 7 === 0 ? 'FAILED' : 'SUCCESS',
      String(1000 + (fnv1a(seed + i) % 900))
    ])
  }
  return {
    cmd,
    getresult: { rowList, total: rowCount },
    idc,
    ret_execute: `ret=${1000 + (fnv1a(seed) % 900)}`,
    sqlCmd: `select * from ${cmd.replace(/\s+/g, '_')} where idc='${idc}'`,
    uuid: (fnv1a(seed + 'uuid') >>> 0).toString(16)
  }
}

/**
 * 拼出 getUniqueInfo 的 mock 返回
 *
 * @param {Object} atom     原子（mock 原始对象，自带 aaiAtomName / aaiAtomStatus 等）
 * @param {String} funcName 函数名（row.funcName）
 * @returns {Object} { code, msg, data }
 */
export function buildUniqueInfo(atom, funcName) {
  const seed = `${(atom && atom.aaiInstanceAtomId) || ''}|${funcName || ''}`
  const name = (atom && atom.aaiAtomName) || '原子'
  const cmdList = [`show ${name} version`, `check ${name} status`, `exec ${name} config`]

  // 每个 cmd 一组「执行结果」，交给组件的 aggregateByCmd 按 cmd 归并
  const executeResult = cmdList.map((cmd, ci) => resultGroup(cmd, `${seed}|${ci}`))

  const aelMessage = {
    pre: buildMessages(atom, funcName, 'pre'),
    post: buildMessages(atom, funcName, 'post')
  }

  const aelAtomExecuteResult = {
    pre: buildMessages(atom, funcName, 'pre'),
    post: buildMessages(atom, funcName, 'post'),
    // CodeDiff 的两侧内容
    pre_content: {
      atom: name,
      func: funcName,
      idc: pick(['BJ-DB', 'BJ-NFX', 'HF'], seed),
      version: '1.0.0',
      params: { timeout: 300, retry: 0 }
    },
    post_content: {
      atom: name,
      func: funcName,
      idc: pick(['BJ-DB', 'BJ-NFX', 'HF'], seed),
      version: '1.0.1',
      params: { timeout: 600, retry: 2 },
      // 'Y' 才展示执行结果表格；用哈希分桶，保证既有 Y 也有 N 的情况可看
      executeResultFlag: fnv1a(seed) % 4 === 0 ? 'N' : 'Y',
      getresult: executeResult
    }
  }

  const aelAtomExecuteHisResult = {
    post: [0, 1].map(i => ({
      timestamp: ts(atom.aaiStartTime, 60 + i * 120),
      content: {
        round: i + 1,
        func: funcName,
        atom: name,
        status: i === 0 ? 'FAILED' : 'SUCCESS',
        detail: { idc: pick(['BJ-DB', 'BJ-NFX', 'HF'], seed + i), ret: `ret=${2000 + i}` }
      }
    }))
  }

  return {
    code: 200,
    msg: '操作成功',
    data: {
      aelMessage: JSON.stringify(aelMessage),
      aelAtomExecuteResult: JSON.stringify(aelAtomExecuteResult),
      aelAtomExecuteHisResult: JSON.stringify(aelAtomExecuteHisResult)
    }
  }
}

export default { buildUniqueInfo }
