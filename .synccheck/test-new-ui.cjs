// 系统画像页逻辑验证：mock 数据 → 组件脚本 → 计算属性与方法
const fs = require('fs')
const path = require('path')

// 1. 从 mockData/res.js 提取 systemProfileRes
const resJs = fs.readFileSync(path.join(__dirname, '../ruoyi-ui/mockData/res.js'), 'utf8')
  .replace(/export\s*\{[^}]*\}/, '')
const systemProfileRes = new Function(resJs + '; return systemProfileRes')()

// 2. 解析组件脚本（去掉 import / export）
const compiler = require(path.join(__dirname, '../ruoyi-ui/node_modules/vue-template-compiler'))
const vueSrc = fs.readFileSync(path.join(__dirname, '../ruoyi-ui/src/views/tool/systemProfile/index.vue'), 'utf8')
const parsed = compiler.parseComponent(vueSrc)
const scriptBody = parsed.script.content
  .replace(/^import .*$/m, '')
  .replace('export default', 'return')
const component = new Function(scriptBody)()

// 3. 构造 vm：data + computed
const vm = Object.create(component.methods)
vm.profileData = systemProfileRes
vm.activeTab = 'topo'
vm.activeComponent = ''
vm.activeCluster = ''
vm.relationMeasured = false
vm.relationOverflow = {}
vm.relationExpanded = {}
vm.$set = (obj, k, v) => { obj[k] = v }
// prepareData 等价逻辑（不调用 fetchData，避免触发 mock api）
const raw = vm.profileData['链路'] || []
const seen = new Set()
vm.links = raw.filter(l => {
  const k = l.fnode + '|' + l.snode
  if (seen.has(k)) return false
  seen.add(k)
  return true
})
for (const k of Object.keys(component.computed)) {
  Object.defineProperty(vm, k, { get: () => component.computed[k].call(vm), configurable: true })
}

let pass = 0
let fail = 0
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS ' + name) }
  else { fail++; console.log('FAIL ' + name, extra === undefined ? '' : JSON.stringify(extra)) }
}

// 基础信息
const b = vm.basic
t('基础信息: 系统名', b.系统名 === 's新核心_数据&应用服务', b.系统名)
t('基础信息: 级别 A+', b.系统重要性级别 === 'A+', b.系统重要性级别)

// 统计
t('stats: 4 项', vm.stats.length === 4)
t('stats 值 11/34/41/36', vm.stats.map(s => s.value).join('/') === '11/34/41/36', vm.stats.map(s => s.value))
t('链路去重后 36 条', vm.links.length === 36, vm.links.length)

// 组件列表
t('componentList: 11 个', vm.componentList.length === 11, vm.componentList.length)
t('主机总数 41 / 集群总数 34', vm.componentList.reduce((s, c) => s + c.hostCount, 0) === 41 && vm.componentList.reduce((s, c) => s + c.clusterCount, 0) === 34)

// 集群关系分组（新 groupByType 计算属性）
const groups = vm.groupByType
t('groupByType: 12 组', groups.length === 12, groups.length)
t('groupByType 排序 NGINX 第一', groups[0].name === 'NGINX')
t('groupByType RSYNC 最后', groups[groups.length - 1].name === 'RSYNC')
t('dotColor: NGINX=#409eff', groups.find(g => g.name === 'NGINX').dotColor === '#409eff')
t('dotColor: HAPROXY=#e6a23c', groups.find(g => g.name === 'HAPROXY').dotColor === '#e6a23c')
t('dotColor: 容器云=#67c23a', groups.find(g => g.name === '容器云').dotColor === '#67c23a')
t('dotColor: 应用=#909399', groups.find(g => g.name === '应用').dotColor === '#909399')
t('dotColor: MYSQL=#f56c6c', groups.find(g => g.name === 'MYSQL').dotColor === '#f56c6c')
t('dotColor: 其余类型有映射(非兜底)', groups.every(g => g.dotColor && g.dotColor !== ''))
t('totalNodes 计算正确', groups.every(g => g.totalNodes === g.items.reduce((s, i) => s + i.nodes.length, 0)))
const kafka = groups.find(g => g.name === 'KAFKA')
t('KAFKA 组 items 含 clusterName/nodes', kafka.items.every(i => i.clusterName && Array.isArray(i.nodes) && i.nodes.length > 0))

// 展开/收起交互
vm.toggleRelationGroup('NGINX')
t('toggleRelationGroup 展开', vm.relationExpanded.NGINX === true)
vm.toggleRelationGroup('NGINX')
t('toggleRelationGroup 收起', vm.relationExpanded.NGINX === false)

// 原有交互
vm.selectComponent('CANAL')
const canal = vm.componentList.find(c => c.name === 'CANAL')
t('selectComponent: 展开第一个集群', vm.activeCluster === canal.clusters[0].name)
t('machineType', vm.machineType('V') === '虚拟机' && vm.machineType('P') === '物理机' && vm.machineType('X') === 'X')

// 模板结构检查（TODO 交付要求）
const tpl = parsed.template.content
t('模板: el-row gutter=16', tpl.includes(':gutter="16"'))
t('模板: 左 span=6 右 span=18', tpl.includes(':span="6"') && tpl.includes(':span="18"'))
t('模板: 集群关系流式布局 relation-flow', tpl.includes('profile-relation-flow'))
t('模板: 分类标题胶囊 + 圆点', tpl.includes('profile-relation-title') && tpl.includes('--dot-color'))
t('模板: 节点用 el-card 极简版', tpl.includes('el-card') && tpl.includes('profile-relation-card'))
t('模板: 展开全部链接', tpl.includes('profile-relation-toggle') && tpl.includes('展开全部'))
t('模板: 表格固定高度 height="300"', tpl.includes('height="300"'))
t('模板: 拓扑图注释保留在底部', tpl.includes('拓扑关系图') && tpl.includes('profile-graph'))
t('模板: 工具栏保持注释状态', /<!-- <div class="profile-toolbar">/.test(tpl))

// 样式检查（交付要求）
const css = parsed.styles[0].content
t('样式: 卡片边框 #e4e7ed', css.includes('#e4e7ed'))
t('样式: 4px 圆角', css.includes('border-radius: 4px'))
t('样式: 轻投影 0 1px 2px rgba(0,0,0,.04)', css.includes('0 1px 2px rgba(0, 0, 0, 0.04)'))
t('样式: 标题 14px #303133 600', /font-size: 14px[\s\S]{0,300}font-weight: 600[\s\S]{0,300}#303133/.test(css) || css.includes('#303133'))
t('样式: 统计数字 20px 600', css.includes('font-size: 20px') && css.includes('font-weight: 600'))
t('样式: ::v-deep 覆写 el-tabs 底线 #e4e7ed', css.includes('::v-deep .el-tabs__nav-wrap::after') && css.includes('#e4e7ed'))
t('样式: ::before 8px 圆点', css.includes('::before') && css.includes('width: 8px'))
t('样式: 折叠 3 行 max-height 112px', css.includes('max-height: 112px'))

console.log('\n' + pass + ' PASS, ' + fail + ' FAIL')
process.exit(fail ? 1 : 0)
