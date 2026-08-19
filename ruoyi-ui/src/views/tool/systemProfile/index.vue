<template>
  <div class="profile-page">
    <!-- 顶部工具栏 -->
    <!-- <div class="profile-toolbar">
      <div class="profile-toolbar__title">
        <span class="profile-toolbar__icon">
          <svg-icon icon-class="link" />
        </span>
        <h2 class="profile-toolbar__name">系统画像</h2>
      </div>
      <div class="profile-toolbar__actions">
        <button class="quick-action" type="button" @click="fetchData">
          <i class="el-icon-refresh" />
          刷新
        </button>
      </div>
    </div> -->

    <!-- 加载中 -->
    <div v-if="loading" class="profile-state">
      <i class="el-icon-loading profile-state__icon" />
      <p>正在加载系统画像...</p>
    </div>

    <!-- 无数据 -->
    <div v-else-if="!profileData" class="profile-state">
      <i class="el-icon-document profile-state__icon" />
      <p>暂无系统画像数据</p>
    </div>

    <template v-else>
      <!-- 若依栅格：左侧轻量信息卡 span=6，右侧内容 span=18 -->
      <el-row :gutter="16" class="profile-body">
        <el-col :span="6">
          <section class="profile-basic">
            <header class="profile-basic__head">
              <span class="profile-basic__name">{{ basic.系统名 }}</span>
              <span class="profile-basic__level">{{ basic.系统重要性级别 }}</span>
            </header>

            <div class="profile-basic__room">
              <i class="el-icon-location-outline" />
              <span class="profile-basic__room-label">主机房</span>
              <span class="profile-basic__room-value">{{ basic.主机房 }}</span>
            </div>

            <p class="profile-basic__desc" :title="basic.系统简介">{{ basic.系统简介 }}</p>

            <div class="profile-basic__dc">
              <span class="profile-basic__dc-label">数据中心</span>
              <div class="profile-basic__dc-tags">
                <el-tag v-for="dc in basic.数据中心" :key="dc" size="mini" effect="plain">{{ dc }}</el-tag>
              </div>
            </div>

            <div class="profile-stats">
              <div v-for="s in stats" :key="s.label" class="profile-stat" :class="'is-' + s.key">
                <i :class="s.icon" />
                <div class="profile-stat__meta">
                  <span class="profile-stat__value">{{ s.value }}</span>
                  <span class="profile-stat__label">{{ s.label }}</span>
                </div>
              </div>
            </div>
          </section>
        </el-col>

        <el-col :span="18">
          <main class="profile-main">
            <el-tabs v-model="activeTab" class="profile-tabs">
              <!-- 组件拓扑：选择组件类型 → 按集群展示主机表格 -->
              <el-tab-pane label="组件拓扑" name="topo">
                <div class="profile-chips">
                  <button
                    v-for="c in componentList"
                    :key="c.name"
                    class="profile-chip"
                    :class="['is-' + c.name, { 'is-active': c.name === activeComponent }]"
                    type="button"
                    @click="selectComponent(c.name)"
                  >
                    <span class="profile-chip__name">{{ c.name }}</span>
                    <span class="profile-chip__count">{{ c.clusterCount }} 集群 · {{ c.hostCount }} 台</span>
                  </button>
                </div>

                <!-- 选中组件的集群表格，固定高度表内滚动，默认展开第一个 -->
                <div class="profile-cluster-panel">
                  <el-collapse
                    v-if="activeClusters.length"
                    :value="activeCluster"
                    accordion
                    @change="onClusterChange"
                  >
                    <el-collapse-item
                      v-for="cluster in activeClusters"
                      :key="cluster.name"
                      :name="cluster.name"
                    >
                      <template slot="title">
                        <span class="profile-cluster__title">{{ cluster.name }}</span>
                        <span class="profile-cluster__count">{{ cluster.hosts.length }} 台主机</span>
                      </template>
                      <el-table :data="cluster.hosts" size="mini" border height="300">
                        <el-table-column label="主机名" min-width="180" show-overflow-tooltip>
                          <template slot-scope="scope">
                            <span class="profile-host">
                              <i class="el-icon-monitor profile-host__icon" />
                              <span class="profile-host__name">{{ scope.row.hostname }}</span>
                            </span>
                          </template>
                        </el-table-column>
                        <el-table-column prop="ip" label="IP" width="125" />
                        <el-table-column prop="idc" label="机房" width="85" />
                        <el-table-column prop="component" label="组件" min-width="150" show-overflow-tooltip />
                        <el-table-column label="CPU" width="80">
                          <template slot-scope="scope">{{ scope.row.cpu }}C</template>
                        </el-table-column>
                        <el-table-column label="内存" width="90">
                          <template slot-scope="scope">{{ scope.row.memory }}G</template>
                        </el-table-column>
                        <el-table-column label="类型" width="86">
                          <template slot-scope="scope">
                            <span class="profile-mtype" :class="'is-' + (scope.row.mtype === 'P' ? 'p' : 'v')">
                              {{ machineType(scope.row.mtype) }}
                            </span>
                          </template>
                        </el-table-column>
                        <el-table-column prop="os" label="操作系统" min-width="180" show-overflow-tooltip />
                      </el-table>
                    </el-collapse-item>
                  </el-collapse>
                  <div v-else class="profile-empty">该组件暂无集群数据</div>
                </div>
              </el-tab-pane>

              <!-- 集群关系：标签式横向流式布局，分组标题胶囊 + 节点卡片自动换行 -->
              <el-tab-pane label="集群关系" name="clusters">
                <div class="profile-relation-panel">
                  <section
                    v-for="group in groupByType"
                    :key="group.name"
                    class="profile-relation-group"
                  >
                    <div
                      ref="relationFlow"
                      class="profile-relation-flow"
                      :class="{ 'is-collapsed': relationMeasured && relationOverflow[group.name] && !relationExpanded[group.name] }"
                    >
                      <!-- 分类标题胶囊：::before 小圆点颜色按组件类型区分 -->
                      <span
                        class="profile-relation-title"
                        :style="{ '--dot-color': group.dotColor }"
                      >{{ group.name }}</span>
                      <!-- 节点卡片（el-card 极简版）：只显示 集群名 ×数量 -->
                      <el-card
                        v-for="item in group.items"
                        :key="item.clusterName"
                        shadow="never"
                        class="profile-relation-card"
                        :class="'is-' + group.name"
                        :title="item.nodes.join('、')"
                      >
                        <span class="profile-relation-card__name">{{ item.clusterName }}</span>
                        <span class="profile-relation-card__count">×{{ item.nodes.length }}</span>
                      </el-card>
                    </div>
                    <a
                      v-if="relationMeasured && relationOverflow[group.name]"
                      class="profile-relation-toggle"
                      @click="toggleRelationGroup(group.name)"
                    >{{ relationExpanded[group.name] ? '收起' : '展开全部' }}</a>
                  </section>
                </div>
              </el-tab-pane>
            </el-tabs>
          </main>
        </el-col>
      </el-row>
    </template>

    <!-- 拓扑关系图：后端数据调整后再启用。
         启用后位于页面最底部（全宽），固定高度 340px，页面整体仍保持一屏不滚动；
         只需取消本段注释，并把下面注释块里对应的 data / methods / CSS 一并打开。 -->
    <!--
    <section class="profile-graph">
      <header class="profile-graph__head">
        <div class="profile-graph__title">
          <h3>组件拓扑关系</h3>
          <span class="profile-graph__hint">
            按调用流向分层布局 · 颜色表示链路层级 · 虚线为同层同步链路 · 点击节点查看主机明细，支持缩放拖拽
          </span>
        </div>
      </header>
      <div
        ref="graphEl"
        class="profile-graph__canvas"
        :style="{ height: graphHeight + 'px' }"
      />
    </section>
    -->
  </div>
</template>

<script>
import { getSystemProfile } from '@/api/tool/systemProfile'

// ==================== 拓扑关系图相关（暂时注释，后端数据调整后再启用） ====================
// import * as echarts from 'echarts'
//
// // 组件类型 → 调用链路层级（左→右）
// const TIER_OF_COMPONENT = {
//   NGINX: 0,
//   HAPROXY: 1,
//   容器云: 1,
//   应用: 2,
//   MYSQL: 3,
//   CANAL: 4,
//   ZOOKEEPER: 4,
//   KAFKA: 5,
//   ES: 6,
//   GREATDB: 6,
//   HADOOP: 6
// }
//
// // 各层级名称与颜色（颜色取自验证过的分层色板前 7 个槽位：蓝/橙/青/黄/品红/绿/紫）
// const TIER_NAMES = [
//   '接入层 · NGINX',
//   '负载层 · HAPROXY/容器云',
//   '应用层 · 应用',
//   '数据库 · MYSQL',
//   '同步协调 · CANAL/ZOOKEEPER',
//   '消息队列 · KAFKA',
//   '存储检索 · ES/GREATDB/HADOOP'
// ]
//
// const TIER_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7']
//
// // 分层布局参数
// const NODE_VGAP = 74      // 同层节点垂直间距
// const GROUP_VGAP = 30     // 同层内组件组之间的额外间距
// const TIER_HGAP = 230     // 层级之间水平间距
// const AXIS_PADDING = 60   // 画布左右留白
// const CANVAS_VPAD = 150   // 画布上下留白（节点标签需要空间）
// ==================== 拓扑关系图相关结束 ====================

// 组件类型的展示顺序（与调用流向一致）
const COMPONENT_ORDER = ['NGINX', 'HAPROXY', '容器云', '应用', 'MYSQL', 'CANAL', 'ZOOKEEPER', 'KAFKA', 'ES', 'GREATDB', 'HADOOP']

// 集群关系分组标题圆点颜色（按组件类型）。
// 前 5 个为需求指定；其余组件类型沿用同一色系补全，未列出的类型走兜底色 #909399
const COMPONENT_DOT_COLOR = {
  NGINX: '#409eff',
  HAPROXY: '#e6a23c',
  容器云: '#67c23a',
  应用: '#909399',
  MYSQL: '#f56c6c',
  CANAL: '#9254de',
  ZOOKEEPER: '#f759ab',
  KAFKA: '#faad14',
  ES: '#13c2c2',
  GREATDB: '#722ed1',
  HADOOP: '#fa8c16',
  RSYNC: '#a0d911'
}

// 集群关系折叠高度：最多展示 3 行（卡片约 32px + 行间距 8px）
const RELATION_COLLAPSED_HEIGHT = 112

export default {
  name: 'SystemProfile',

  data() {
    return {
      loading: false,
      profileData: null,
      links: [],
      activeTab: 'topo',
      activeComponent: '',
      activeCluster: '',
      // 集群关系「展开全部」相关状态
      relationMeasured: false,   // 是否已完成首次高度测量（测量后再应用折叠）
      relationOverflow: {},      // 各分组是否超出 3 行，需要折叠
      relationExpanded: {}       // 用户手动展开的分组
      // ===== 拓扑关系图相关（暂注释，启用时 graphHeight 建议 340：页面底部固定高度，保证一屏不滚动） =====
      // graphHeight: 340,
      // chart: null,
      // nodes: [],
      // dialogVisible: false,
      // dialogTitle: '',
      // dialogNode: null,
      // dialogHosts: [],
      // dialogLinks: []
    }
  },

  computed: {
    basic() {
      return (this.profileData && this.profileData['基础信息']) || {}
    },
    stats() {
      const topo = (this.profileData && this.profileData['组件拓扑']) || {}
      const componentCount = Object.keys(topo).length
      const clusterCount = Object.keys(topo).reduce(
        (sum, comp) => sum + Object.keys(topo[comp]).length, 0)
      const hostCount = Object.keys(topo).reduce((sum, comp) => {
        return sum + Object.values(topo[comp]).reduce((s, hosts) => s + hosts.length, 0)
      }, 0)
      return [
        { key: 'component', label: '组件类型', value: componentCount, icon: 'el-icon-menu' },
        { key: 'cluster', label: '集群', value: clusterCount, icon: 'el-icon-office-building' },
        { key: 'host', label: '主机', value: hostCount, icon: 'el-icon-monitor' },
        { key: 'link', label: '链路', value: this.links.length, icon: 'el-icon-connection' }
      ]
    },
    // 组件类型列表（含集群与主机统计），按 COMPONENT_ORDER 排序
    componentList() {
      const topo = (this.profileData && this.profileData['组件拓扑']) || {}
      return Object.keys(topo)
        .map(name => {
          const clusterMap = topo[name]
          const clusters = Object.keys(clusterMap)
            .map(cname => ({ name: cname, hosts: clusterMap[cname] }))
            .sort((a, b) => a.name.localeCompare(b.name))
          return {
            name,
            clusters,
            clusterCount: clusters.length,
            hostCount: clusters.reduce((s, c) => s + c.hosts.length, 0)
          }
        })
        .sort((a, b) => {
          const ia = COMPONENT_ORDER.indexOf(a.name)
          const ib = COMPONENT_ORDER.indexOf(b.name)
          if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
          if (ia === -1) return 1
          if (ib === -1) return -1
          return ia - ib
        })
    },
    // 当前选中组件下的集群列表
    activeClusters() {
      const comp = this.componentList.find(c => c.name === this.activeComponent)
      return comp ? comp.clusters : []
    },
    clusterGroups() {
      const rel = (this.profileData && this.profileData['集群关系']) || {}
      return Object.keys(rel)
        .map(name => ({ name, items: rel[name] }))
        .sort((a, b) => {
          const ia = COMPONENT_ORDER.indexOf(a.name)
          const ib = COMPONENT_ORDER.indexOf(b.name)
          if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
          if (ia === -1) return 1
          if (ib === -1) return -1
          return ia - ib
        })
    },
    // 集群关系流式布局分组：在 clusterGroups 基础上补充圆点颜色与节点总数
    groupByType() {
      return this.clusterGroups.map(g => ({
        ...g,
        dotColor: COMPONENT_DOT_COLOR[g.name] || '#909399',
        totalNodes: g.items.reduce((s, i) => s + (i.nodes ? i.nodes.length : 0), 0)
      }))
    }
  },

  watch: {
    // 切到集群关系 tab 后测量各分组高度，决定哪些分组需要「展开全部」
    activeTab(val) {
      if (val === 'clusters') {
        this.$nextTick(() => this.measureRelationGroups())
      }
    }
  },

  mounted() {
    this.fetchData()
    window.addEventListener('resize', this.handleRelationResize)
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.handleRelationResize)
  },

  methods: {
    fetchData() {
      this.loading = true
      getSystemProfile({})
        .then(res => {
          this.profileData = res.data
          this.prepareData()
          // 默认选中第一个组件类型，并展开其第一个集群
          const first = this.componentList[0]
          if (first) {
            this.activeComponent = first.name
            this.activeCluster = first.clusters.length ? first.clusters[0].name : ''
          }
          // 若数据到达时已停留在集群关系 tab，需要重新测量
          this.$nextTick(() => {
            if (this.activeTab === 'clusters') this.measureRelationGroups()
          })
        })
        .catch(() => {
          this.$message.error('获取系统画像数据失败')
        })
        .finally(() => {
          this.loading = false
        })
    },

    // 链路去重（用于统计），防御后端出现重复数据
    prepareData() {
      const rawLinks = this.profileData['链路'] || []
      const seen = new Set()
      this.links = []
      rawLinks.forEach(l => {
        const key = `${l.fnode}|${l.snode}`
        if (seen.has(key)) return
        seen.add(key)
        this.links.push(l)
      })
    },

    // 切换组件类型：重置展开第一个集群
    selectComponent(name) {
      this.activeComponent = name
      const comp = this.componentList.find(c => c.name === name)
      this.activeCluster = comp && comp.clusters.length ? comp.clusters[0].name : ''
    },

    // 手动展开/收起集群（手风琴模式下 value 为当前展开项，收起时为 ''）
    onClusterChange(name) {
      this.activeCluster = name
    },

    machineType(mtype) {
      const map = { V: '虚拟机', P: '物理机' }
      return map[mtype] || mtype
    },

    // 测量集群关系各分组内容高度：首次测量在未折叠状态下进行（自然高度），
    // 之后折叠状态下 clientHeight=112、scrollHeight=自然高度，仍然可正确判断
    measureRelationGroups() {
      if (this.activeTab !== 'clusters') return
      const flows = this.$refs.relationFlow
      const list = Array.isArray(flows) ? flows : flows ? [flows] : []
      if (!list.length) return
      const overflow = {}
      this.groupByType.forEach((g, i) => {
        const el = list[i]
        if (el && el.scrollHeight > RELATION_COLLAPSED_HEIGHT + 4) {
          overflow[g.name] = true
        }
      })
      this.relationOverflow = overflow
      this.relationMeasured = true
    },

    // 展开/收起单个分组
    toggleRelationGroup(name) {
      this.$set(this.relationExpanded, name, !this.relationExpanded[name])
    },

    // 窗口尺寸变化后重新测量（仅在集群关系 tab 下生效）
    handleRelationResize() {
      this.measureRelationGroups()
    }

    // ==================== 拓扑关系图相关（暂注释） ====================
    // renderChart() {
    //   if (!this.$refs.graphEl) return
    //   if (this.chart) {
    //     this.chart.dispose()
    //     this.chart = null
    //   }
    //   this.chart = echarts.init(this.$refs.graphEl)
    //   this.chart.on('click', params => this.onChartClick(params))
    //   this.chart.setOption(this.buildOption())
    //   window.removeEventListener('resize', this.handleResize)
    //   window.addEventListener('resize', this.handleResize)
    // },
    //
    // buildOption() { ... },
    // formatTooltip(params) { ... },
    // onChartClick(params) { ... },
    // tierLabel(tier) { return TIER_NAMES[tier] || '未分层' },
    // handleResize() { if (this.chart) this.chart.resize() }
    // ==================== 拓扑关系图相关结束 ====================
  }
}
</script>

<style lang="scss" scoped>
/* ============ 设计变量 ============ */
$profile-bg: #f5f7fa;                          // 页面整体背景（极浅灰蓝，避免纯白）
$profile-card-bg: #fff;                        // 卡片背景
$profile-card-border: #ebeef5;                 // 卡片浅边框
$profile-card-radius: 10px;                    // 大卡片（左右模块）圆角
$profile-node-radius: 4px;                     // 统计项/节点卡片圆角
$profile-card-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);       // 卡片轻量阴影
$profile-stat-bg: #f8f9fa;                     // 极浅灰（未映射组件类型的节点标签兜底色）
$profile-accent: #409eff;                      // 主题蓝（Element 默认主色）

// 统计卡片：key → 强调色（左色条 + 图标色 + 淡色渐变背景）
$stat-colors: (
  'component': #409eff,
  'cluster': #67c23a,
  'host': #e6a23c,
  'link': #9254de
);

// 组件类型 → 节点标签浅色底（与 COMPONENT_DOT_COLOR 同源色板：NGINX 浅蓝、HAPROXY 浅橙…）
$component-colors: (
  'NGINX': #409eff,
  'HAPROXY': #e6a23c,
  '容器云': #67c23a,
  '应用': #909399,
  'MYSQL': #f56c6c,
  'CANAL': #9254de,
  'ZOOKEEPER': #f759ab,
  'KAFKA': #faad14,
  'ES': #13c2c2,
  'GREATDB': #722ed1,
  'HADOOP': #fa8c16,
  'RSYNC': #a0d911
);

/* 页面整体：固定一屏高度，页面本身不滚动，各区块内部滚动；背景极浅灰蓝衬托白色卡片 */
.profile-page {
  padding: 20px;
  height: calc(100vh - 165px);
  min-height: 520px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: $profile-bg;
}

/* ============ 加载/空状态 ============ */
.profile-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;

  &__icon {
    font-size: 36px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

/* ============ 主体栅格布局（el-row gutter=16，左 span=6 右 span=18） ============ */
.profile-body {
  flex: 1;
  min-height: 0;
}

.profile-body > .el-col {
  height: 100%;
}

/* ============ 左列：系统基础信息（轻量卡片，与右侧 el-tabs 同级风格） ============ */
.profile-basic {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;
  padding: 20px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid $profile-card-border;
  }

  /* 系统名称：16px / 700，页面主要标题层级 */
  &__name {
    font-size: 16px;
    font-weight: 700;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__level {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 10px;
    background: #fdf6ec;
    border: 1px solid #faecd8;
    color: #e6a23c;
    font-size: 11px;
    font-weight: 600;
  }

  &__room {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;

    i {
      color: $profile-accent;
      font-size: 14px;
    }
  }

  &__room-label {
    color: #909399;
    font-size: 12px;
  }

  &__room-value {
    color: #606266;
    font-weight: 600;
    font-size: 13px;
  }

  &__desc {
    margin: 0 0 12px;
    font-size: 13px;
    color: #606266;
    line-height: 1.7;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__dc {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__dc-label {
    font-size: 12px;
    color: #909399;
  }

  &__dc-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
}

/* 统计 2×2：数字 22px/700 强调；每项白底 + 极淡边框，按 key 区分左色条、微渐变背景与图标色块 */
.profile-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed $profile-card-border;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.profile-stat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: $profile-node-radius;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;

  /* 图标：圆角小色块，带淡色底与主题色 */
  i {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 17px;
    color: #909399;
    background: $profile-stat-bg;
  }

  /* 按统计项 key 区分：左色条 + 微渐变背景 + 图标主题色 */
  @each $key, $color in $stat-colors {
    &.is-#{$key} {
      border-left: 3px solid $color;
      background: linear-gradient(135deg, mix($color, #fff, 10%), #fff 70%);

      i {
        color: $color;
        background: mix($color, #fff, 14%);
      }
    }
  }

  &__meta {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
    min-width: 0;
  }

  &__value {
    font-size: 22px;
    font-weight: 700;
    color: #303133;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    font-size: 12px;
    color: #909399;
  }
}

/* ============ 右列：组件拓扑 / 集群关系 ============ */
.profile-main {
  height: 100%;
  box-sizing: border-box;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;
  padding: 12px 20px 20px;
  display: flex;
  flex-direction: column;
}

.profile-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  /* 【Element 覆写】tab 底线颜色与左侧卡片边框色完全一致 #ebeef5，
     消除左右两侧颜色不一致的违和感（Element 默认同为 #E4E7ED，这里显式锁定） */
  ::v-deep .el-tabs__nav-wrap::after {
    background-color: $profile-card-border;
    height: 1px;
  }

  /* 【Element 覆写】激活 tab 文字与滑块统一为主色 #409eff（Element 默认同色，这里显式锁定） */
  ::v-deep .el-tabs__item.is-active {
    color: $profile-accent;
    font-weight: 600;
    /* 选中标签增加蓝色浅阴影（光晕） */
    text-shadow: 0 0 8px rgba(64, 158, 255, 0.35);
  }

  ::v-deep .el-tabs__active-bar {
    background-color: $profile-accent;
  }

  /* 【Element 覆写】tab 内容区撑满剩余高度，内部滚动 */
  ::v-deep .el-tabs__content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
  }

  ::v-deep .el-tabs__content > .el-tab-pane {
    width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}

/* 组件类型选择：胶囊标签，按组件类型淡色系区分，选中态蓝框蓝字 + 浅蓝阴影 */
.profile-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 14px;
}

.profile-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 999px;
  background: $profile-card-bg;
  color: #606266;
  cursor: pointer;
  transition: all 0.15s ease;

  /* 按组件类型映射淡色背景/边框/文字（Nginx 蓝、Kafka 橙、MySQL 绿…，与 COMPONENT_DOT_COLOR 同源） */
  @each $name, $color in $component-colors {
    &.is-#{$name} {
      background: mix($color, #fff, 10%);
      border-color: mix($color, #fff, 30%);
      color: mix($color, #303133, 70%);

      &.is-active {
        background: mix($color, #fff, 18%);
      }
    }
  }

  &.is-active {
    border-color: $profile-accent;
    color: $profile-accent;
    /* 选中状态：保持蓝色边框和文字，增加浅蓝背景阴影 */
    box-shadow: 0 2px 8px 0 rgba(64, 158, 255, 0.25);
  }

  &__name {
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__count {
    font-size: 11px;
    color: #909399;
    white-space: nowrap;
  }

  &.is-active &__count {
    color: #69b1ff;
  }
}

/* 集群折叠面板（内部滚动，页面不滚） */
.profile-cluster-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* 【Element 覆写】折叠面板改节点卡片：白底、4px 圆角 + 浅边框 #ebeef5（Element 默认顶部圆角/无外边框） */
::v-deep .profile-cluster-panel .el-collapse {
  border: none;
}

::v-deep .profile-cluster-panel .el-collapse-item {
  border: 1px solid $profile-card-border;
  border-radius: $profile-node-radius;
  margin-bottom: 10px;
  overflow: hidden;
  background: $profile-card-bg;

  /* 【Element 覆写】折叠面板标题行：白底微渐变、展开态主色高亮 */
  .el-collapse-item__header {
    background: linear-gradient(180deg, #f7fafd, #fff);
    padding: 0 14px;
    height: 44px;
    line-height: 44px;
    border-bottom: none;
    font-size: 13px;
    color: #303133;
  }

  &.is-active .el-collapse-item__header {
    background: #f5f9ff;
    color: $profile-accent;
  }

  .el-collapse-item__wrap {
    border-bottom: none;
    background: #fff;
  }

  /* 【Element 覆写】折叠面板内容区默认 padding-bottom 25px → 14px */
  .el-collapse-item__content {
    padding: 0 14px 14px;
  }
}

.profile-cluster {
  &__title {
    font-weight: 600;
    color: #303133;
    margin-right: 10px;
  }

  &__count {
    font-size: 11.5px;
    color: $profile-accent;
    background: #ecf5ff;
    border-radius: 9px;
    padding: 1px 8px;
    line-height: 18px;
  }
}

/* 表格：固定高度 300px，表内滚动；表头浅灰底 */
/* 【Element 覆写】表头底色 #f5f7fa、文字 #909399（Element 默认白底 #909399） */
::v-deep .profile-cluster-panel .el-table {
  &::before {
    display: none;
  }

  th.el-table__cell {
    background: #f5f7fa;
    color: #909399;
    font-weight: 600;
    font-size: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #ebeef5;
  }

  td.el-table__cell {
    padding: 8px 0;
    font-size: 12.5px;
    color: #606266;
    border-bottom: 1px solid #ebeef5;
  }

  .el-table__row:hover > td.el-table__cell {
    background: #f5f9ff;
  }
}

.profile-host {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &__icon {
    color: #909399;
    font-size: 13px;
  }

  &__name {
    color: #303133;
    font-weight: 600;
  }
}

.profile-mtype {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;

  &.is-v {
    background: #ecf5ff;
    color: #409eff;
  }

  &.is-p {
    background: #f0f9eb;
    color: #67c23a;
  }
}

.profile-empty {
  padding: 40px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

/* ============ 集群关系：标签式横向流式布局 ============ */
.profile-relation-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.profile-relation-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

/* 分组内流式容器：标题胶囊 + 节点卡片横向排列，超出自动换行 */
.profile-relation-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;

  /* 折叠态：最多展示 3 行（约 32px/行 + 8px 间距），其余隐藏 */
  &.is-collapsed {
    max-height: 112px;
    overflow: hidden;
  }
}

/* 分类标题胶囊：::before 8px 小圆点，颜色按组件类型（CSS 变量 --dot-color 传入） */
.profile-relation-title {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  background: #f5f7fa;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
    background: var(--dot-color, #909399);
    flex-shrink: 0;
  }
}

/* 节点标签（el-card 极简版）：浅色底按组件类型映射（NGINX 浅蓝、HAPROXY 浅橙…），
   去掉生硬边框，改为大圆角 + 内边距的标签形态 */
.profile-relation-card {
  border: none;
  border-radius: 999px;
  color: #606266;
  background: $profile-stat-bg; /* 兜底：未映射的组件类型用极淡灰 */

  /* 按组件类型映射浅色背景与文字色（与 COMPONENT_DOT_COLOR 同源色板） */
  @each $name, $color in $component-colors {
    &.is-#{$name} {
      background: mix($color, #fff, 10%);
      color: mix($color, #303133, 75%);

      .profile-relation-card__name {
        color: mix($color, #303133, 75%);
      }

      .profile-relation-card__count {
        color: mix($color, #909399, 70%);
      }
    }
  }

  /* 【Element 覆写】el-card 默认 body padding 20px → 6px 14px 标签化 */
  ::v-deep .el-card__body {
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.profile-relation-card__name {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}

.profile-relation-card__count {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
}

/* 展开全部 / 收起 */
.profile-relation-toggle {
  align-self: flex-start;
  font-size: 12px;
  color: $profile-accent;
  cursor: pointer;
  user-select: none;

  &:hover {
    text-decoration: underline;
  }
}

/* ============ 拓扑关系图（暂注释）。启用时取消注释，样式保证图固定在页面底部：
     .profile-graph { flex-shrink: 0; height: 340px; display: flex; flex-direction: column;
       背景白卡片与 profile-main 一致；.profile-graph__canvas { flex: 1; min-height: 0; } } ============ */
/* .profile-graph { ... } */
</style>
