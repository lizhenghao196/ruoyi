<template>
  <div class="profile-page">
    <!-- 顶部操作行：左侧搜索框 + 查询按钮，右侧统计卡片（搜索成功后显示） -->
    <section class="profile-topbar">
      <div class="profile-topbar__search">
        <el-input
          :value="systemQuery"
          size="medium"
          clearable
          placeholder="请输入系统英文名称"
          prefix-icon="el-icon-search"
          class="profile-topbar__input"
          @input="onSystemInput"
          @keyup.enter.native="searchSystem"
        />
        <el-button type="primary" size="medium" @click="searchSystem">查询</el-button>
      </div>
      <div v-if="searched" class="profile-stats-row">
        <div
          v-for="s in stats"
          :key="s.key"
          class="profile-stat"
          :class="'is-' + s.key"
        >
          <i :class="s.icon" />
          <div class="profile-stat__meta">
            <span class="profile-stat__value">{{ s.value }}</span>
            <span class="profile-stat__label">{{ s.label }}</span>
          </div>
          <span v-if="s.reserved" class="profile-stat__badge">预留</span>
        </div>
      </div>
    </section>

    <!-- 加载中 -->
    <div v-if="loading" class="profile-state">
      <i class="el-icon-loading profile-state__icon" />
      <p>正在加载系统画像...</p>
    </div>

    <!-- 未查询 / 查询无数据 -->
    <div v-else-if="!searched || !profileData" class="profile-state">
      <i class="el-icon-document profile-state__icon" />
      <p>{{ !searched ? '暂无内容' : '暂无系统画像数据' }}</p>
      <p v-if="!searched" class="profile-state__hint">请输入系统英文名称进行查询</p>
    </div>

    <template v-else>
      <!-- ============ 基础信息栏（互换后第二行，约 56px） ============ -->
      <section class="profile-info">
        <span class="profile-info__name" :title="basic.系统名">{{ basic.系统名 }}</span>
        <span class="profile-info__level">{{ basic.系统重要性级别 }}</span>
        <span class="profile-info__divider" />

        <span class="profile-info__room">
          <i class="el-icon-location-outline" />
          <span class="profile-info__room-label">主机房</span>
          <span class="profile-info__room-value">{{ basic.主机房 }}</span>
        </span>

        <!-- 数据中心标签：可横向滚动 -->
        <div class="profile-info__dcs">
          <el-tag
            v-for="dc in basic.数据中心"
            :key="dc"
            size="mini"
            effect="plain"
            class="profile-info__dc"
          >{{ dc }}</el-tag>
        </div>

        <!-- 简介：一行省略，悬停显示全部 -->
        <p class="profile-info__desc" :title="basic.系统简介">
          <span class="profile-info__desc-label">简介</span>
          <span class="profile-info__desc-text">{{ basic.系统简介 }}</span>
        </p>
      </section>

      <!-- ============ 组件拓扑区域（约 90px）：左侧紧凑标签 + 右侧集群关系 ============ -->
      <section class="profile-topo">
        <div class="profile-topo__main">
          <header class="profile-topo__head">
            <span class="profile-topo__title">组件拓扑</span>
            <span class="profile-topo__hint">点击组件类型，筛选左侧主机列表</span>
          </header>
          <div class="profile-topo__tags">
            <button
              v-for="c in componentList"
              :key="c.name"
              class="profile-topo__tag"
              :class="['is-' + c.name, { 'is-active': c.name === activeComponent }]"
              :title="c.clusterCount + ' 个集群 · ' + c.hostCount + ' 台主机'"
              type="button"
              @click="selectComponent(c.name)"
            >
              <span class="profile-topo__tag-name">{{ c.name }}</span>
              <span class="profile-topo__tag-count">{{ c.hostCount }}</span>
            </button>
          </div>
        </div>

        <!-- 集群关系：选中组件的 key 在“集群关系”中存在时展示，否则显示空态
             （用 div 而非 aside：全局 index.scss 对 aside 有 margin/背景/内边距默认样式） -->
        <div class="profile-topo__relation">
          <template v-if="relationGroups">
            <span class="profile-topo__relation-title">集群关系</span>
            <div class="profile-topo__relation-list">
              <div
                v-for="g in relationGroups"
                :key="g.clusterName"
                class="profile-topo__relation-item"
                :title="(g.nodes || []).join('、')"
              >
                <span class="profile-topo__relation-name">{{ g.clusterName }}</span>
                <span class="profile-topo__relation-nodes">{{ (g.nodes || []).join('、') }}</span>
              </div>
            </div>
          </template>
          <span v-else class="profile-topo__relation-empty">
            <i class="el-icon-warning-outline" /> 暂无集群关系
          </span>
        </div>
      </section>

      <!-- ============ 底部：左侧主机列表（45%） + 右侧链路关系图预留区（55%） ============ -->
      <div class="profile-bottom">
        <!-- 主机列表：按集群分组，表头固定，内容区内部滚动 -->
        <section class="profile-hosts">
          <header class="profile-hosts__head">
            <span class="profile-hosts__title">主机列表</span>
            <span class="profile-hosts__count">{{ filteredTotal }} / {{ activeHostTotal }} 台</span>
            <el-input
              v-model="searchQuery"
              size="mini"
              clearable
              placeholder="搜索主机名 / IP"
              prefix-icon="el-icon-search"
              class="profile-hosts__search"
            />
          </header>

          <div class="profile-hosts__panel">
            <!-- 每个集群一个可展开收起的表格，默认展开第一个 -->
            <el-collapse
              v-if="filteredGroups.length"
              :value="openClusters"
              @change="onClusterToggle"
            >
              <el-collapse-item
                v-for="cluster in filteredGroups"
                :key="cluster.name"
                :name="cluster.name"
              >
                <template slot="title">
                  <i class="profile-cluster__dot" />
                  <span class="profile-cluster__title">{{ cluster.name }}</span>
                  <span class="profile-cluster__count">{{ cluster.hostCount }} 台主机</span>
                </template>
                <!-- max-height：数据多（80+ 条）时表内滚动，表头固定；
                     列宽固定总和 680px < 表格可用 ~693px（1920 全屏），
                     主机名（最长 22 字符 ≈ 200px 含图标与内边距）完整展示且不出现横向滚动条 -->
                <el-table :data="cluster.hosts" size="mini" border max-height="320">
                  <el-table-column label="主机名" width="190" show-overflow-tooltip>
                    <template slot-scope="scope">
                      <span class="profile-host">
                        <i class="el-icon-monitor profile-host__icon" />
                        <span class="profile-host__name">{{ scope.row.hostname }}</span>
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="ip" label="IP" width="108" />
                  <el-table-column label="机房" width="80">
                    <template slot-scope="scope">
                      <span class="profile-idc">{{ scope.row.idc }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="类型" width="56">
                    <template slot-scope="scope">
                      <span class="profile-mtype" :class="scope.row.mtype === 'P' ? 'is-p' : 'is-v'">
                        {{ machineType(scope.row.mtype) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="CPU" width="60">
                    <template slot-scope="scope">{{ scope.row.cpu }}C</template>
                  </el-table-column>
                  <el-table-column label="内存" width="60">
                    <template slot-scope="scope">{{ scope.row.memory }}G</template>
                  </el-table-column>
                  <el-table-column prop="os" label="操作系统" show-overflow-tooltip />
                </el-table>
              </el-collapse-item>
            </el-collapse>
            <div v-else class="profile-hosts__empty">
              <i class="el-icon-search" />
              <p>未找到匹配的主机</p>
            </div>
          </div>
        </section>

        <!-- 链路关系图预留区：固定高度，后续替换为 ECharts -->
        <section class="profile-link">
          <header class="profile-link__head">
            <span class="profile-link__title">链路关系图</span>
            <span class="profile-link__badge">预留 · ECharts</span>
          </header>
          <div class="profile-link__placeholder">
            <i class="el-icon-connection profile-link__icon" />
            <p class="profile-link__text">链路关系图区域</p>
            <p class="profile-link__hint">后续接入 ECharts 拓扑关系图（共 {{ links.length }} 条链路）</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script>
import { getSystemProfile } from '@/api/tool/systemProfile'

// 组件类型的展示顺序（与调用流向一致）
const COMPONENT_ORDER = ['NGINX', 'HAPROXY', '容器云', '应用', 'MYSQL', 'CANAL', 'ZOOKEEPER', 'KAFKA', 'ES', 'GREATDB', 'HADOOP']

export default {
  name: 'SystemProfile',

  data() {
    return {
      loading: false,
      profileData: null,
      links: [],
      activeComponent: '',
      searchQuery: '',
      openClusters: [], // 展开的集群（非手风琴，默认展开第一个）
      systemQuery: '', // 系统英文名称搜索框
      searched: false // 是否已执行查询（未查询前仅显示搜索框与空状态）
    }
  },

  watch: {
    // 搜索后若展开的集群全部被过滤掉，自动展开第一个匹配集群
    searchQuery() {
      this.$nextTick(() => {
        if (!this.filteredGroups.length) return
        const hasOpen = this.openClusters.some(n => this.filteredGroups.some(g => g.name === n))
        if (!hasOpen) {
          this.openClusters = [this.filteredGroups[0].name]
        }
      })
    }
  },

  computed: {
    basic() {
      return (this.profileData && this.profileData['基础信息']) || {}
    },
    // 统计卡片：组件类型 / 集群 / 主机 / 链路（链路预留，仅显示数字）
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
        { key: 'link', label: '链路', value: this.links.length, icon: 'el-icon-connection', reserved: true }
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
    // 当前选中组件的主机总数（未过滤）
    activeHostTotal() {
      const comp = this.componentList.find(c => c.name === this.activeComponent)
      return comp ? comp.hostCount : 0
    },
    // 集群关系：仅当选中组件的 key 在“集群关系”中存在且有数据时返回（否则空态）
    relationGroups() {
      const rel = (this.profileData && this.profileData['集群关系']) || {}
      const item = rel[this.activeComponent]
      return Array.isArray(item) && item.length ? item : null
    },
    // 当前选中组件下、按集群分组的主机（搜索过滤后），空集群剔除
    filteredGroups() {
      const comp = this.componentList.find(c => c.name === this.activeComponent)
      const clusters = comp ? comp.clusters : []
      const q = this.searchQuery.trim().toLowerCase()
      if (!q) {
        return clusters.map(g => ({ ...g, hostCount: g.hosts.length }))
      }
      return clusters
        .map(g => {
          const hosts = g.hosts.filter(h => {
            return (h.hostname || '').toLowerCase().includes(q) ||
              (h.ip || '').toLowerCase().includes(q)
          })
          return { ...g, hosts, hostCount: hosts.length }
        })
        .filter(g => g.hosts.length > 0)
    },
    // 搜索后匹配的主机总数
    filteredTotal() {
      return this.filteredGroups.reduce((s, g) => s + g.hosts.length, 0)
    }
  },

  methods: {
    // 搜索框只允许英文，小写自动转大写（非英文字符直接过滤）
    onSystemInput(val) {
      this.systemQuery = (val || '').replace(/[^a-zA-Z]/g, '').toUpperCase()
    },

    // 查询系统画像：输入系统英文名称后回车或点查询按钮触发
    searchSystem() {
      const q = this.systemQuery.trim()
      if (!q) {
        this.$message.warning('请输入系统英文名称')
        return
      }
      this.loading = true
      getSystemProfile({ systemName: q })
        .then(res => {
          this.profileData = res.data
          this.prepareData()
          this.searched = true
          // 默认选中第一个组件（按数据顺序），并展开其第一个集群
          const first = this.componentList[0]
          if (first) {
            this.activeComponent = first.name
            this.openClusters = first.clusters.length ? [first.clusters[0].name] : []
          }
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

    // 切换组件类型：左侧主机列表联动筛选，并默认展开其第一个集群
    selectComponent(name) {
      this.activeComponent = name
      const comp = this.componentList.find(c => c.name === name)
      this.openClusters = comp && comp.clusters.length ? [comp.clusters[0].name] : []
    },

    // 展开/收起集群（非手风琴，value 为展开的集群名数组）
    onClusterToggle(val) {
      this.openClusters = val || []
    },

    machineType(mtype) {
      const map = { V: '虚拟机', P: '物理机' }
      return map[mtype] || mtype
    }
  }
}
</script>

<style lang="scss" scoped>
/* ============ 设计变量 ============ */
$profile-bg: #f5f7fa;                          // 页面整体背景（极浅灰蓝，避免纯白）
$profile-card-bg: #fff;                        // 卡片背景
$profile-card-border: #ebeef5;                 // 卡片浅边框
$profile-card-radius: 10px;                    // 卡片圆角
$profile-card-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);       // 卡片轻量阴影
$profile-stat-bg: #f8f9fa;                     // 极浅灰（标签兜底色）
$profile-accent: #409eff;                      // 主题蓝（Element 默认主色）

// 统计卡片：key → 强调色（左色条 + 图标色块 + 淡色渐变背景）
$stat-colors: (
  'component': #409eff,
  'cluster': #67c23a,
  'host': #e6a23c,
  'link': #9254de
);

/* ============ 页面整体：一屏内，仅主机列表内部滚动 ============ */
.profile-page {
  padding: 20px;
  /* 高度拉满 app-main 内容区（84 = navbar 50 + tags-view 34；版权条已禁用，无额外补偿） */
  height: calc(100vh - 84px);
  min-height: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

  /* 空状态辅助提示（未查询时） */
  &__hint {
    margin-top: 6px;
    font-size: 12px;
    color: #c0c4cc;
  }
}

/* ============ 顶部基础信息栏 ============ */
.profile-info {
  flex-shrink: 0;
  height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  overflow: hidden;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;

  &__name {
    flex-shrink: 0;
    max-width: 320px;
    font-size: 16px;
    font-weight: 700;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 重要性级别：橙金色徽标 */
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
    font-weight: 700;
  }

  &__divider {
    flex-shrink: 0;
    width: 1px;
    height: 20px;
    background: $profile-card-border;
  }

  &__room {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;

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

  /* 数据中心标签：弹性占位优先完整展示，多时横向滚动（隐藏滚动条） */
  &__dcs {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__dc {
    flex-shrink: 0;
  }

  /* 简介：动态宽度（跟随内容伸缩，不抢数据中心空间）；过长省略，悬停 title 显示全部 */
  &__desc {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 40%;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    overflow: hidden;
  }

  &__desc-label {
    flex-shrink: 0;
    color: #909399;
    font-size: 12px;
  }

  &__desc-text {
    color: #606266;
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ============ 顶部操作行（第一行）：左侧搜索 + 右侧统计卡片 ============ */
.profile-topbar {
  flex-shrink: 0;
  height: 72px;
  display: flex;
  align-items: center;
  gap: 16px;

  &__search {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__input {
    width: 300px;
  }
}

/* ============ 统计卡片行（顶部操作行右侧，搜索成功后显示） ============ */
.profile-stats-row {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.profile-stat {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: $profile-card-radius;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  box-shadow: $profile-card-shadow;
  overflow: hidden;

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
    line-height: 1.2;
    min-width: 0;
  }

  /* 数字大且突出，标签字号较小 */
  &__value {
    font-size: 24px;
    font-weight: 700;
    color: #303133;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    font-size: 11.5px;
    color: #909399;
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 10px;
    color: #909399;
    background: $profile-stat-bg;
    padding: 0 6px;
    border-radius: 6px;
    line-height: 16px;
  }
}

/* ============ 组件拓扑区域：左侧标签 + 右侧集群关系 ============ */
.profile-topo {
  flex-shrink: 0;
  height: 90px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;

  /* 左侧：标题 + 组件标签 */
  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  &__head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__title {
    font-size: 13px;
    font-weight: 700;
    color: #303133;
  }

  &__hint {
    font-size: 11.5px;
    color: #909399;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* 右侧：集群关系（title + nodes；选中组件无对应数据时显示空态）。
     高度不设 height: 100%，由父级 align-items: center 保证垂直居中 */
  &__relation {
    flex-shrink: 0;
    width: 520px;
    min-width: 0;
    padding-left: 16px;
    border-left: 1px dashed #dcdfe6;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;

    &-title {
      flex-shrink: 0;
      font-size: 11.5px;
      color: #909399;
    }

    &-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 42px; /* 90px 行内最多两行集群，多余省略 */
      overflow: hidden;
      min-width: 0;
    }

    &-item {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      line-height: 19px;
    }

    /* title：集群名（加粗，不省略） */
    &-name {
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 600;
      color: #303133;
    }

    /* nodes：节点列表（省略时悬停 title 看全部） */
    &-nodes {
      flex: 1;
      min-width: 0;
      font-size: 11.5px;
      color: #909399;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &-empty {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #c0c4cc;

      i {
        font-size: 13px;
      }
    }
  }
}

/* 组件标签：紧凑胶囊 + 数量角标；未选中统一灰白，选中态主题蓝 */
.profile-topo__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 999px;
  background: $profile-card-bg;
  color: #606266;
  cursor: pointer;
  transition: all 0.15s ease;

  /* 选中态：统一 Nginx 蓝，不再按组件类型区分颜色 */
  &.is-active {
    background: #ecf5ff;
    border-color: $profile-accent;
    color: $profile-accent;
    box-shadow: 0 2px 8px 0 rgba(64, 158, 255, 0.25);
  }

  &__name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__count {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 10.5px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.06);
  }
}

/* ============ 底部：主机列表 + 链路占位 ============ */
.profile-bottom {
  flex: 1;
  min-height: 440px;
  display: flex;
  gap: 16px;
}

/* ---- 主机列表卡片 ---- */
.profile-hosts {
  flex: 9;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;
  overflow: hidden;

  &__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px 10px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: #303133;
  }

  &__count {
    font-size: 11.5px;
    color: #909399;
    background: $profile-stat-bg;
    padding: 1px 8px;
    border-radius: 8px;
    line-height: 18px;
  }

  &__search {
    width: 200px;
    margin-left: auto;
  }

  /* 集群折叠面板容器：多个集群展开时整体滚动（左右内边距收紧，给表格让出宽度） */
  &__panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 8px 12px;
  }

  &__empty {
    padding: 48px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #909399;
    font-size: 13px;

    i {
      font-size: 28px;
    }

    p {
      margin: 0;
    }
  }
}

/* ============ 集群折叠面板：每个集群一个可展开收起的表格 ============ */
/* 【Element 覆写】折叠面板改白卡：浅边框 + 圆角 */
::v-deep .profile-hosts__panel .el-collapse {
  border: none;
}

::v-deep .profile-hosts__panel .el-collapse-item {
  border: 1px solid $profile-card-border;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
  background: $profile-card-bg;

  .el-collapse-item__header {
    background: linear-gradient(180deg, #f7fafd, #fff);
    padding: 0 14px;
    height: 42px;
    line-height: 42px;
    border-bottom: none;
    font-size: 12.5px;
    color: #303133;
  }

  /* 展开态：标题行淡蓝高亮 */
  &.is-active .el-collapse-item__header {
    background: #f5f9ff;

    .profile-cluster__count {
      background: #ecf5ff;
      color: $profile-accent;
    }
  }

  .el-collapse-item__wrap {
    border-bottom: none;
    background: #fff;
  }

  .el-collapse-item__content {
    padding: 12px 10px 14px;
  }

  /* 【Element 覆写】表格：表头浅灰底、行 hover 淡蓝、去底部横线 */
  .el-table {
    &::before {
      display: none;
    }

    th.el-table__cell {
      background: #f5f7fa;
      color: #909399;
      font-weight: 600;
      font-size: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #ebeef5;
    }

    td.el-table__cell {
      padding: 6px 0;
      font-size: 12.5px;
      color: #606266;
      border-bottom: 1px solid #ebeef5;
    }

    .el-table__row:hover > td.el-table__cell {
      background: #f5f9ff;
    }
  }
}

/* 集群标题：统一主题蓝圆点 + 集群名 + 台数徽标 */
.profile-cluster {
  &__dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    margin-right: 8px;
    flex-shrink: 0;
    background: $profile-accent;
  }

  &__title {
    font-weight: 600;
    color: #303133;
    margin-right: 10px;
  }

  &__count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 400;
    color: #909399;
    background: $profile-stat-bg;
    border-radius: 8px;
    padding: 1px 8px;
    line-height: 18px;
  }
}

/* 表格内主机名：图标 + 名称 */
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

/* 机房：浅灰底标签 */
.profile-idc {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background: $profile-stat-bg;
  color: #606266;
  font-size: 11px;
  font-weight: 500;
}

/* 主机类型：蓝/绿标签（V=虚拟机 / P=物理机） */
.profile-mtype {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  border-radius: 4px;
  font-size: 11px;
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

/* ---- 链路关系图预留区 ---- */
.profile-link {
  flex: 11;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;
  overflow: hidden;

  &__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px 10px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: #303133;
  }

  &__badge {
    margin-left: auto;
    font-size: 11px;
    color: $profile-accent;
    background: #ecf5ff;
    padding: 2px 8px;
    border-radius: 8px;
    line-height: 16px;
  }

  /* 占位卡片：虚线边框 + 图标 + 文字，后续替换为 ECharts */
  &__placeholder {
    flex: 1;
    min-height: 0;
    margin: 0 16px 16px;
    border: 1.5px dashed #dcdfe6;
    border-radius: $profile-card-radius;
    background: linear-gradient(180deg, #fbfdff, #fff);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  &__icon {
    font-size: 40px;
    color: #c0c4cc;
  }

  &__text {
    margin: 6px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: #606266;
  }

  &__hint {
    margin: 0;
    font-size: 12px;
    color: #909399;
  }
}
</style>
