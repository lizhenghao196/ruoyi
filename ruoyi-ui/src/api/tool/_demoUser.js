/**
 * ⚠️ 演示专用：用户列表（「修改实施人」弹窗的「指定用户」下拉）
 * ==========================================================================
 * 接口：GET /system/user/listAll?pageNum=1&pageSize=1000
 * 返回（若依标准分页）：{ code: 200, msg: '操作成功', total, rows: [SysUser, ...] }
 *   SysUser 里本功能只用三个字段：userId / userName（登录名）/ nickName（中文名）
 *
 * **名单是从哪儿来的（没有一个是编的）**
 *   1. 前 12 个取自**本项目自己的 mock 数据**：`mockData/res.js` 里每个原子的
 *      `aaiAtomConfig.executeUserName / executeUserNameCn` —— 就是本项目真实用到的执行人，
 *      把这两列凑成对儿（去重后 12 对）。这样下拉里的人名和页面上看到的是同一批。
 *   2. 后 8 个取自**参考实现的截图**（下拉列表 + 请求参数里能看清的账号）：
 *      goodops_kzx / 超级管理员(admin) / 林佳科 / 陈继雄 / 闫婧宇 / 高翔1 / 周克 / 苏琼沛。
 *
 * **userId 是占位值**：真实 userId 由接口下发，截图里只看到一个（林佳科 = 1111），
 * 其余没法知道，所以这里从 1001 起顺序编。**它只当下拉的 value / key 用**
 * （保证唯一即可），提交时用的是 userName / nickName，不依赖它。
 * 接真实接口后整个文件删掉，这条占位也就没有意义了。
 *
 * **刻意不做的**：不编 deptName / phonenumber / email 等字段 ——
 * 弹窗一个都不显示，编出来只会让人以为是真的。要加字段就等接口接上。
 *
 * 接入真实接口后怎么删
 *   1. 删掉本文件
 *   2. 删掉 execPlan.js 顶部的 import，以及 listAllUser 里标注「演示用」的那一段
 * ==========================================================================
 */

/**
 * 执行人：[中文名 nickName, 登录名 userName]
 * 前 12 对来自本项目 mock（executeUserNameCn / executeUserName），后 8 对来自参考截图。
 */
const USER_PAIRS = [
  // —— 本项目 mock 里真实出现的执行人（顺序按中文名拼音无关，稳定即可）——
  ['韦绵宇', 'mianyu wei'],
  ['王悦', 'yue2 wang'],
  ['黄波', 'huangbo_kzx'],
  ['杨森', 'hz_yangsen1_kzx'],
  ['何琦', 'qi1 he'],
  ['杨慧慧', 'huihui yang'],
  ['詹宗鑫', 'zongxin zhan'],
  ['张先斌', 'zhangxianbin_kzx'],
  ['陈晓斌', 'xiaobin1 chen'],
  ['陈家泽', 'sm_chenjiaze_kzx'],
  ['梁顺立', 'liangshunli_kzx'],
  ['唐文俊', 'tangwenjun_kzx'],
  // —— 参考截图里能看清的账号 ——
  ['goodops_kzx', 'goodops_kzx'],
  ['超级管理员', 'admin'],
  ['林佳科', 'linjiake_kzx'],
  ['陈继雄', 'chenxiong_kzx'],
  ['闫婧宇', 'yanjingyu_kzx'],
  ['高翔1', 'xiang1 gao'],
  ['周克', 'zhouke_kzx'],
  ['苏琼沛', 'qiongpei su']
]

/** userId 起始值（占位，见文件头说明） */
const USER_ID_BASE = 1000

/**
 * 用户列表。**每次调用返回新数组**，调用方改不动内部数据
 * （页面把它存进 data，深拷贝一份更省心，这里直接给副本）。
 */
export function buildUserList() {
  return USER_PAIRS.map(([nickName, userName], i) => ({
    userId: USER_ID_BASE + i + 1,
    userName,
    nickName
  }))
}

export default { buildUserList }
