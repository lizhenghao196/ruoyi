<template>
  <div class="profile-page">
    <!-- 空状态：居中的搜索入口（未查询前只显示这里） -->
    <div v-if="!searched" class="profile-empty">
      <i class="el-icon-monitor profile-empty__icon" />
      <h2 class="profile-empty__title">系统画像</h2>
      <p class="profile-empty__hint">请输入系统英文名称查询系统画像</p>
      <div class="profile-empty__search">
        <el-input
          :value="systemQuery"
          size="medium"
          clearable
          placeholder="请输入系统英文名称"
          prefix-icon="el-icon-search"
          class="profile-empty__input"
          @input="onSystemInput"
          @keyup.enter.native="searchSystem"
        />
        <el-button type="primary" size="medium" @click="searchSystem">查询</el-button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else-if="loading" class="profile-state">
      <i class="el-icon-loading profile-state__icon" />
      <p>正在加载系统画像...</p>
    </div>

    <!-- 查询无数据 -->
    <div v-else-if="!profileData" class="profile-state">
      <i class="el-icon-document profile-state__icon" />
      <p>暂无系统画像数据</p>
    </div>

    <template v-else>
      <!-- ============ 顶部信息栏（单行）：系统信息 | 机房 | 简介 | 行内统计 ============ -->
      <section class="profile-info">
        <!-- 系统名称：视觉权重最高，可点击切换系统 -->
        <button
          type="button"
          class="profile-info__switch"
          :title="'点击切换系统（当前：' + basic.系统名 + '）'"
          @click="openSystemSwitch"
        >
          <span class="profile-info__name">{{ basic.系统名 }}</span>
          <span class="profile-info__level">{{ basic.系统重要性级别 }}</span>
          <span class="profile-info__switch-hint"><i class="el-icon-refresh" /> 切换</span>
        </button>

        <span class="profile-info__divider" />

        <!-- 机房/数据中心：可压缩省略，不换行 -->
        <div class="profile-info__rooms">
          <span class="profile-info__room">
            <i class="el-icon-location-outline" />
            <span class="profile-info__room-label">主机房</span>
            <span class="profile-info__room-value">{{ basic.主机房 }}</span>
          </span>
          <el-tag
            v-for="dc in basic.数据中心"
            :key="dc"
            size="mini"
            effect="plain"
            class="profile-info__dc"
          >{{ dc }}</el-tag>
        </div>

        <span class="profile-info__divider" />

        <!-- 简介：最主要的可压缩区，单行省略，悬停显示全部 -->
        <p class="profile-info__desc" :title="basic.系统简介">
          <span class="profile-info__desc-label">简介</span>
          <span class="profile-info__desc-text">{{ basic.系统简介 }}</span>
        </p>

        <span class="profile-info__divider" />

        <!-- 行内紧凑统计：不再使用大卡片 -->
        <div class="profile-stats-inline">
          <span
            v-for="s in stats"
            :key="s.key"
            class="profile-stat-inline"
            :class="'is-' + s.key"
          >
            <i :class="s.icon" />
            <span class="profile-stat-inline__value">{{ s.value }}</span>
            <span class="profile-stat-inline__label">{{ s.label }}</span>
            <span v-if="s.reserved" class="profile-stat-inline__badge">预留</span>
          </span>
        </div>
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

    <!-- 系统切换弹窗：点击系统名称后出现，复用现有搜索/查询逻辑 -->
    <el-dialog
      title="切换系统"
      :visible.sync="switchDialogVisible"
      width="480px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="profile-switch">
        <p class="profile-switch__hint">输入系统英文名称，查询后切换当前系统画像</p>
        <div class="profile-switch__row">
          <el-input
            :value="switchQuery"
            size="medium"
            clearable
            placeholder="请输入系统英文名称"
            prefix-icon="el-icon-search"
            @input="onSwitchInput"
            @keyup.enter.native="searchSystemFromDialog"
          />
          <el-button type="primary" size="medium" @click="searchSystemFromDialog">查询</el-button>
        </div>
      </div>
    </el-dialog>
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
      searched: false, // 是否已执行查询（未查询前仅显示居中的搜索入口）
      switchDialogVisible: false, // 系统切换弹窗
      switchQuery: '' // 切换弹窗内的查询输入（与主搜索框独立）
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
        { key: 'component', label: '组件', value: componentCount, icon: 'el-icon-menu' },
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

    // 打开系统切换弹窗（预填当前查询词，回车/点查询后重新查询）
    openSystemSwitch() {
      this.switchQuery = this.systemQuery
      this.switchDialogVisible = true
    },

    // 切换弹窗输入框：同样只允许英文并转大写
    onSwitchInput(val) {
      this.switchQuery = (val || '').replace(/[^a-zA-Z]/g, '').toUpperCase()
    },

    // 查询系统画像：输入系统英文名称后回车或点查询按钮触发
    searchSystem() {
      this.doSearch(this.systemQuery)
    },

    // 切换弹窗内查询：复用同一查询逻辑，成功后自动关闭弹窗
    searchSystemFromDialog() {
      this.doSearch(this.switchQuery)
    },

    // 统一查询逻辑（空值校验 → 请求 → 更新状态）
    doSearch(q) {
      const name = (q || '').trim()
      if (!name) {
        this.$message.warning('请输入系统英文名称')
        return
      }
      this.systemQuery = name
      this.loading = true
      getSystemProfile({ systemName: name })
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
          this.switchDialogVisible = false
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
  gap: 12px;
  background: $profile-bg;
}

/* ============ 空状态：居中的搜索入口（未查询前展示） ============ */
.profile-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &__icon {
    font-size: 44px;
    color: #c0c4cc;
    margin-bottom: 10px;
  }

  &__title {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 700;
    color: #303133;
    letter-spacing: 2px;
  }

  &__hint {
    margin: 0;
    font-size: 12.5px;
    color: #909399;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
  }

  &__input {
    width: 460px;
  }
}

/* ============ 加载/无数据状态 ============ */
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

/* ============ 系统切换弹窗 ============ */
.profile-switch {
  &__hint {
    margin: 0 0 12px;
    font-size: 12.5px;
    color: #909399;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-input {
      flex: 1;
    }
  }
}

/* ============ 顶部信息栏（单行）：系统信息 | 机房 | 简介 | 行内统计 ============ */
.profile-info {
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;

  /* 竖分隔线（分组：系统信息 / 机房 / 简介 / 统计） */
  &__divider {
    flex-shrink: 0;
    width: 1px;
    height: 20px;
    background: $profile-card-border;
  }

  /* 系统名称整体：可点击的切换入口，视觉权重最高 */
  &__switch {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    min-width: 0;
  }

  &__name {
    max-width: 380px;
    font-size: 16px;
    font-weight: 700;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.15s ease;
  }

  /* 悬停/聚焦时名称变主题蓝，提示可点击 */
  &__switch:hover .profile-info__name {
    color: $profile-accent;
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

  /* “切换”小提示 */
  &__switch-hint {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    color: #909399;
    background: $profile-stat-bg;
    border-radius: 6px;
    padding: 1px 6px;
    line-height: 16px;

    i {
      font-size: 11px;
    }
  }

  /* 机房/数据中心：可压缩省略（空间不足时优先于简介收缩） */
  &__rooms {
    flex: 0 1 auto;
    max-width: 340px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
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

  &__dc {
    flex-shrink: 0;
  }

  /* 简介：最主要的可压缩区，单行省略，悬停 title 显示全部 */
  &__desc {
    flex: 1 1 auto;
    min-width: 100px;
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
    flex: 1;
    min-width: 0;
    color: #606266;
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 行内紧凑统计：图标 + 数字 + 短标签，不再使用大卡片 */
  .profile-stats-inline {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-left: 4px;
  }

  .profile-stat-inline {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;

    i {
      font-size: 14px;
      color: #909399;
      align-self: center;
    }

    &__value {
      font-size: 16px;
      font-weight: 700;
      color: #303133;
      font-variant-numeric: tabular-nums;
    }

    &__label {
      font-size: 11.5px;
      color: #909399;
    }

    &__badge {
      font-size: 10px;
      color: #909399;
      background: $profile-stat-bg;
      border-radius: 6px;
      padding: 0 4px;
      line-height: 14px;
      align-self: center;
    }

    /* 指标图标沿用原统计颜色体系 */
    @each $key, $color in $stat-colors {
      &.is-#{$key} i {
        color: $color;
      }
    }
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
