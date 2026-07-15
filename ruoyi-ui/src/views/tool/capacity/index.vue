<template>
  <div class="app-container">
    <!-- 查询条件区域 -->
    <el-form :model="queryForm" ref="queryForm" :inline="true" class="search-form">
      <el-form-item label="系统">
        <el-input
          v-model="queryForm.system"
          placeholder="请输入系统名称"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
          @input="handleSystemInput"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="el-icon-search" @click="handleQuery">查询</el-button>
        <el-button icon="el-icon-refresh" @click="handleReset">重置</el-button>
        <el-button
          v-if="hasSearched && displayCategories.length"
          :icon="allExpanded ? 'el-icon-fold' : 'el-icon-unfold'"
          @click="toggleAll"
        >{{ allExpanded ? '一键收起' : '一键展开' }}</el-button>
      </el-form-item>
    </el-form>

    <!-- 结果展示区域 -->
    <div class="result-area">
      <!-- 加载中 -->
      <div v-if="loading" class="state-wrap">
        <i class="el-icon-loading" style="font-size: 32px; color: #909399;" />
        <p>正在查询，请稍候...</p>
      </div>

      <!-- 未查询 -->
      <div v-else-if="!hasSearched" class="state-wrap">
        <i class="el-icon-search" style="font-size: 32px; color: #C0C4CC;" />
        <p>输入系统名称后点击查询</p>
      </div>

      <!-- 无结果 -->
      <div v-else-if="!displayCategories.length" class="state-wrap">
        <i class="el-icon-warning-outline" style="font-size: 32px; color: #E6A23C;" />
        <p>未找到系统 "{{ lastQueryKeyword }}" 的性能容量数据</p>
      </div>

      <!-- 分类展示 -->
      <div v-else class="category-list">
        <el-card
          v-for="catName in displayCategories"
          :key="catName"
          class="category-card"
          shadow="never"
        >
          <!-- 大类标题（可折叠） -->
          <div slot="header" class="category-header" @click="toggleCategory(catName)">
            <div class="category-header__left">
              <i
                class="el-icon-arrow-right category-arrow"
                :class="{ 'is-expanded': !collapsedCategories[catName] }"
              />
              <div>
                <span class="category-title">{{ catName }}</span>
                <span class="category-meta">
                  &nbsp;{{ subCategoryCount(catName) }} 个实例组 &middot; {{ totalRowCount(catName) }} 条记录
                </span>
              </div>
            </div>
            <!-- 无溢出：直接展示全部标签 -->
            <div v-if="!tagsDisplay(catName).overflow.length" class="category-header__right">
              <el-tag
                v-for="entry in tagsDisplay(catName).visible"
                :key="entry.subName"
                size="mini"
                type="info"
              >{{ entry.subName }}: {{ entry.count }}台</el-tag>
            </div>
            <!-- 有溢出：整个区域悬浮展示全部标签 -->
            <div v-if="tagsDisplay(catName).overflow.length" class="category-header__right has-overflow">
              <el-popover
                placement="bottom"
                trigger="hover"
                :open-delay="200"
                popper-class="capacity-tags-popover"
              >
                <div class="tags-popover-body">
                  <el-tag
                    v-for="entry in tagsDisplay(catName).all"
                    :key="entry.subName"
                    size="mini"
                    type="info"
                    style="margin: 3px 6px 3px 0;"
                  >{{ entry.subName }}: {{ entry.count }}台</el-tag>
                </div>
                <div slot="reference" class="tags-inline">
                  <el-tag
                    v-for="entry in tagsDisplay(catName).visible"
                    :key="entry.subName"
                    size="mini"
                    type="info"
                  >{{ entry.subName }}: {{ entry.count }}台</el-tag>
                  <span class="tags-more-badge">+{{ tagsDisplay(catName).overflow.length }}</span>
                </div>
              </el-popover>
            </div>
          </div>

          <!-- 大类内容（子类 + 表格） -->
          <transition name="collapse">
            <div v-show="!collapsedCategories[catName]" class="category-body">
              <div
                v-for="(subItem, subName) in analysisResult[catName]"
                :key="subName"
                class="sub-section"
              >
                <!-- 子类标题 -->
                <div class="sub-header">
                  <span class="sub-header__dot" :class="'status-' + (subItem.code != null ? subItem.code : 0)" />
                  <strong>{{ subName }}</strong>
                  <span class="sub-header__status-tag" :class="'status-tag-' + (subItem.code != null ? subItem.code : 0)">
                    {{ statusText(subItem.code) }}
                  </span>
                  <el-tag size="mini" effect="plain">{{ subItem.data.length }} 条</el-tag>
                  <span class="sub-header__desc" v-if="subItem.desc" :title="subItem.desc">{{ subItem.desc }}</span>
                </div>

                <!-- 子类表格 -->
                <el-table
                  v-if="subItem.data && subItem.data.length"
                  :data="subItem.data"
                  border
                  stripe
                  size="small"
                  style="width: 100%"
                  :row-class-name="tableRowClassName"
                >
                  <!-- 固定状态列 -->
                  <el-table-column label="状态" align="center" width="72">
                    <template slot-scope="{ row }">
                      <span class="row-status-dot" :class="'status-' + (row.code != null ? row.code : 0)" />
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-for="col in getTableColumns(subItem.data)"
                    :key="col"
                    :prop="col"
                    :label="getColumnLabel(col)"
                    :min-width="getColumnWidth(col)"
                    show-overflow-tooltip
                  >
                    <template slot-scope="{ row }">
                      <span :style="getCellStyle(col, row[col])">
                        {{ formatCellValue(col, row[col]) }}
                      </span>
                    </template>
                  </el-table-column>
                  <!-- 操作列 -->
                  <el-table-column label="操作" align="center" width="80" fixed="right">
                    <template slot-scope="{ row }">
                      <el-button type="text" size="mini" icon="el-icon-data-line" @click="handleMonitor(row)">调用</el-button>
                    </template>
                  </el-table-column>
                  <!-- data 字段独立列，悬浮展示 JSON（暂时注释）
                  <el-table-column label="指标数据" align="center" width="100">
                    <template slot-scope="{ row }">
                      <el-popover
                        placement="left"
                        width="520"
                        trigger="hover"
                        popper-class="capacity-json-popover"
                      >
                        <div class="json-popover-inner">
                          <JsonViewer
                            :value="row.data"
                            :show-array-index="false"
                            :expand-depth="2"
                            copyable
                          >
                            <template v-slot:copy>复制</template>
                          </JsonViewer>
                        </div>
                        <el-button slot="reference" type="text" size="mini">
                          悬浮查看
                        </el-button>
                      </el-popover>
                    </template>
                  </el-table-column>
                  -->
                </el-table>
                <div v-else class="sub-empty">暂无数据</div>
              </div>
            </div>
          </transition>
        </el-card>
      </div>
    </div>

    <!-- 回到顶部 -->
    <el-backtop target=".app-main" :visibility-height="200" :right="40" :bottom="40" />

    <!-- 监控详情弹窗 -->
    <el-dialog
      :title="'监控详情 - ' + monitorHostname"
      :visible.sync="monitorVisible"
      width="1400px"
      top="5vh"
      :close-on-click-modal="false"
      @closed="handleMonitorClosed"
    >
      <div v-loading="monitorLoading" class="monitor-dialog-body">
        <template v-if="!monitorLoading && monitorMeta && Object.keys(monitorMeta).length">
          <!-- 左侧：meta 指标 -->
          <div class="monitor-meta-panel">
            <div class="monitor-meta-title">基础信息</div>
            <div class="monitor-meta-list">
              <div v-for="(val, key) in monitorMeta" :key="key" class="monitor-meta-item">
                <span class="monitor-meta-label">{{ key }}</span>
                <span class="monitor-meta-value">{{ formatMetaValue(val) }}</span>
              </div>
            </div>
          </div>
          <!-- 右侧：ECharts 图表区（Tab 切换） -->
          <div class="monitor-chart-panel">
            <el-tabs v-model="monitorActiveTab" @tab-click="handleTabClick">
              <el-tab-pane
                v-for="tab in monitorTabs"
                :key="tab"
                :label="tab"
                :name="tab"
              >
                <div
                  v-for="(chart, idx) in getTabCharts(tab)"
                  :key="idx"
                  class="monitor-chart-card"
                  :class="'chart-code-' + chart.code"
                >
                  <div class="monitor-chart-header">
                    <span class="monitor-chart-dot" :class="'status-' + (chart.code || 0)" />
                    <strong>{{ chart.title }}</strong>
                  </div>
                  <div v-if="chart.remark" class="monitor-chart-remark">
                    <i class="el-icon-warning-outline" style="color: #E6A23C;" />
                    {{ chart.remark }}
                  </div>
                  <div :ref="'chart-' + tab + '-' + idx" class="monitor-chart-box" />
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </template>
        <div v-else-if="!monitorLoading" class="monitor-empty">暂无监控数据</div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { getCapacityAnalysis, getMonitorDetail } from '@/api/tool/capacity'
import JsonViewer from 'vue-json-viewer'
import 'vue-json-viewer/style.css'
import echarts from 'echarts'

const TOP_FIELD_ORDER = ['hostname', 'ip', 'idc', 'os', 'cpu', 'memory']

export default {
  name: 'Capacity',

  components: {
    JsonViewer
  },

  data() {
    return {
      queryForm: { system: '' },
      loading: false,
      hasSearched: false,
      lastQueryKeyword: '',
      analysisResult: {},
      metadata: {},
      collapsedCategories: {},
      defaultCollapsed: true,
      allExpanded: false,
      // 监控弹窗
      monitorVisible: false,
      monitorLoading: false,
      monitorHostname: '',
      monitorMeta: {},
      monitorTabData: {},
      monitorTabs: [],
      monitorActiveTab: ''
    }
  },

  computed: {
    displayCategories() {
      return Object.keys(this.analysisResult).filter(catName => {
        const cat = this.analysisResult[catName]
        if (!cat || typeof cat !== 'object') return false
        return Object.keys(cat).length > 0
      }).sort((a, b) => {
        const aCount = this.subCategoryCount(a)
        const bCount = this.subCategoryCount(b)
        if (aCount !== bCount) return bCount - aCount
        return a.localeCompare(b)
      })
    }
  },

  methods: {
    handleQuery() {
      this.loading = true
      this.hasSearched = true
      this.lastQueryKeyword = this.queryForm.system || '全部'

      getCapacityAnalysis(this.queryForm.system ? { system: this.queryForm.system } : {})
        .then((res) => {
          this.analysisResult = res.data.analysis_result || {}
          this.metadata = res.data.metadata || {}
          this.initCollapsed()
        })
        .catch(() => {
          this.$message.error('查询失败，请稍后重试')
        })
        .finally(() => {
          this.loading = false
        })
    },

    handleReset() {
      this.queryForm.system = ''
    },

    handleSystemInput(value) {
      // 只保留字母，小写转大写
      this.queryForm.system = value.replace(/[^a-zA-Z]/g, '').toUpperCase()
    },

    initCollapsed() {
      const state = {}
      const sorted = this.displayCategories
      sorted.forEach((catName, index) => {
        // 第一个分类默认展开，其余收起
        state[catName] = index !== 0
      })
      this.collapsedCategories = state
      this.allExpanded = true
    },

    toggleCategory(catName) {
      const newVal = !this.collapsedCategories[catName]
      this.$set(this.collapsedCategories, catName, newVal)
      // 同步 allExpanded 状态
      this.allExpanded = Object.values(this.collapsedCategories).every(v => !v)
    },

    toggleAll() {
      const expand = !this.allExpanded
      const state = {}
      Object.keys(this.collapsedCategories).forEach((key) => {
        state[key] = !expand
      })
      this.collapsedCategories = state
      this.allExpanded = expand
    },

    subCategoryCount(catName) {
      const cat = this.analysisResult[catName]
      return cat ? Object.keys(cat).length : 0
    },

    totalRowCount(catName) {
      const cat = this.analysisResult[catName]
      if (!cat) return 0
      let count = 0
      Object.values(cat).forEach((sub) => {
        if (sub && Array.isArray(sub.data)) {
          count += sub.data.length
        }
      })
      return count
    },

    getSubNameSummary(catName) {
      const cat = this.analysisResult[catName]
      if (!cat) return {}
      const summary = {}
      Object.entries(cat).forEach(([subName, sub]) => {
        const rows = (sub && Array.isArray(sub.data)) ? sub.data : []
        summary[subName] = rows.length
      })
      return summary
    },

    tagsDisplay(catName) {
      const summary = this.getSubNameSummary(catName)
      const entries = Object.entries(summary)
        .map(([subName, count]) => ({ subName, count }))
        .sort((a, b) => b.count - a.count || a.subName.localeCompare(b.subName))
      const maxVisible = 5
      return {
        all: entries,
        visible: entries.slice(0, maxVisible),
        overflow: entries.slice(maxVisible)
      }
    },

    getTableColumns(rows) {
      if (!Array.isArray(rows)) return []
      const keySet = new Set()
      rows.forEach((row) => {
        Object.keys(row).forEach((k) => {
          // 只取顶层字段，排除 code 和嵌套的 data
          if (k !== 'code' && k !== 'data') keySet.add(k)
        })
      })
      const ordered = []
      TOP_FIELD_ORDER.forEach((k) => {
        if (keySet.has(k)) {
          ordered.push(k)
          keySet.delete(k)
        }
      })
      const remaining = Array.from(keySet).sort((a, b) => a.localeCompare(b))
      return ordered.concat(remaining)
    },

    getColumnLabel(col) {
      return (this.metadata && this.metadata[col]) || col
    },

    getColumnWidth(col) {
      if (col === 'hostname') return 180
      if (col === 'ip') return 140
      if (col === 'os') return 160
      if (col === 'idc') return 100
      return 110
    },

    formatCellValue(col, value) {
      if (value === null || value === undefined) return '-'
      if (typeof value === 'boolean') return value ? '是' : '否'
      return value
    },

    statusText(code) {
      const map = { 0: '正常', 1: '警告', 2: '异常' }
      return map[code] || '未知'
    },

    tableRowClassName({ row }) {
      if (row.code === 2) return 'row-status-error'
      if (row.code === 1) return 'row-status-warning'
      return ''
    },

    getCellStyle(col, value) {
      return {}
    },

    // ========== 监控弹窗 ==========

    handleMonitor(row) {
      // 先清理旧图表实例
      this.disposeCharts()
      this.monitorVisible = true
      this.monitorLoading = true
      this.monitorHostname = row.hostname || ''
      this.monitorMeta = {}
      this.monitorCharts = []

      getMonitorDetail({ hostname: row.hostname }).then((res) => {
        if (res.retCode === 200 && res.data) {
          this.monitorMeta = res.data.meta || {}
          // 动态提取 data 中除 meta 外的所有 key 作为 tab
          const tabData = {}
          Object.keys(res.data).forEach((key) => {
            if (key !== 'meta' && Array.isArray(res.data[key])) {
              tabData[key] = res.data[key]
            }
          })
          this.monitorTabData = tabData
          this.monitorTabs = Object.keys(tabData)
          this.monitorActiveTab = this.monitorTabs[0] || ''
        } else {
          this.monitorMeta = {}
          this.monitorTabData = {}
          this.monitorTabs = []
          this.monitorActiveTab = ''
        }
      }).catch(() => {
        this.$message.error('获取监控数据失败')
      }).finally(() => {
        this.monitorLoading = false
        if (this.monitorTabs.length) {
          this.$nextTick(() => {
            setTimeout(() => {
              this.initMonitorCharts()
            }, 50)
          })
        }
      })
    },

    getTabCharts(tab) {
      return this.monitorTabData[tab] || []
    },

    initMonitorCharts() {
      const tab = this.monitorActiveTab
      if (!tab) return
      const charts = this.getTabCharts(tab)
      charts.forEach((chart, idx) => {
        const refName = 'chart-' + tab + '-' + idx
        const el = this.$refs[refName]
        if (!el) return
        // v-for 内 ref 可能是数组
        const dom = Array.isArray(el) ? el[0] : el
        const instance = echarts.init(dom)
        const lineColor = chart.code === 2 ? '#F56C6C' : (chart.code === 1 ? '#E6A23C' : '#409EFF')
        const areaColor = chart.code === 2
          ? 'rgba(245,108,108,0.12)'
          : (chart.code === 1 ? 'rgba(230,162,60,0.12)' : 'rgba(64,158,255,0.12)')
        instance.setOption({
          tooltip: {
            trigger: 'axis',
            formatter(params) {
              const p = params[0]
              return p.axisValue + '<br/>' +
                '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + p.color + ';margin-right:6px;"></span>' +
                chart.title + '：<b>' + p.value + '%</b>'
            }
          },
          grid: { left: 46, right: 20, top: 36, bottom: 32 },
          xAxis: {
            type: 'category',
            data: chart.time || [],
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#DCDFE6' } },
            axisTick: { show: false },
            axisLabel: { color: '#909399', fontSize: 11 }
          },
          yAxis: {
            type: 'value',
            name: '%',
            min: 0,
            splitLine: { lineStyle: { color: '#F2F3F5', type: 'dashed' } },
            axisLabel: { color: '#909399', fontSize: 11 }
          },
          series: [{
            data: chart.max || [],
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: lineColor, width: 2 },
            itemStyle: { color: lineColor },
            label: {
              show: true,
              position: 'top',
              color: '#606266',
              fontSize: 10,
              formatter: '{c}%'
            },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: areaColor },
              { offset: 1, color: 'rgba(255,255,255,0)' }
            ]) }
          }]
        })
        this._chartInstances = this._chartInstances || []
        this._chartInstances.push(instance)
        // resize 监听
        const resizeFn = () => { instance.resize() }
        window.addEventListener('resize', resizeFn)
        instance._resizeFn = resizeFn
      })
    },

    handleTabClick() {
      this.disposeCharts()
      this.$nextTick(() => {
        setTimeout(() => {
          this.initMonitorCharts()
        }, 50)
      })
    },

    disposeCharts() {
      if (this._chartInstances) {
        this._chartInstances.forEach((inst) => {
          if (inst._resizeFn) window.removeEventListener('resize', inst._resizeFn)
          inst.dispose()
        })
        this._chartInstances = []
      }
    },

    handleMonitorClosed() {
      this.disposeCharts()
    },

    formatMetaValue(val) {
      if (Array.isArray(val)) return val.join(', ')
      if (val === null || val === undefined) return '-'
      return val
    }
  }
}
</script>

<style lang="scss" scoped>
.search-form {
  margin-bottom: 16px;
}

// 状态占位
.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 48px;
  color: #909399;
  font-size: 14px;
  background: #fff;
  border-radius: 4px;
}

// 分类列表
.category-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

// 分类卡片
.category-card {
  ::v-deep .el-card__header {
    padding: 0;
    cursor: pointer;
    user-select: none;
    background: #fafafa;
    border-bottom: 1px solid #EBEEF5;
    transition: background 0.2s;

    &:hover {
      background: #f0f2f5;
    }
  }

  ::v-deep .el-card__body {
    padding: 0;
  }
}

// 分类标题行
.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
}

.category-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.category-arrow {
  font-size: 12px;
  color: #909399;
  transition: transform 0.3s ease;
  flex: 0 0 auto;

  &.is-expanded {
    transform: rotate(90deg);
  }
}

.category-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.category-meta {
  font-size: 12px;
  color: #909399;
}

.category-header__right {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 100%;
  overflow: hidden;

  ::v-deep .el-tag {
    margin: 0;
    flex-shrink: 0;
  }

  // 溢出时整行可悬浮，给一点视觉提示
  &.has-overflow {
    cursor: pointer;
    padding: 2px 6px;
    margin: -2px -6px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: #f0f2f5;
    }
  }
}

// 溢出时标签行（popover reference 内）
.tags-inline {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tags-more-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  color: #909399;
  background: #f0f2f5;
  border-radius: 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: #409EFF;
    background: #ecf5ff;
  }
}

// 分类内容区
.category-body {
  padding: 12px 16px 16px;
}

// 折叠动画
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.35s ease;
  overflow: hidden;
}

.collapse-enter,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave {
  opacity: 1;
  max-height: 8000px;
}

// 子类区域
.sub-section {
  margin-bottom: 16px;
  padding: 12px 14px;
  background: #fafafa;
  border-radius: 4px;

  &:last-child {
    margin-bottom: 0;
  }
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #606266;

  &__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: 0 0 auto;
    transition: box-shadow 0.3s;

    &.status-0 { background: #67C23A; box-shadow: 0 0 6px rgba(103,194,58,0.5); }
    &.status-1 { background: #E6A23C; box-shadow: 0 0 6px rgba(230,162,60,0.5); }
    &.status-2 { background: #F56C6C; box-shadow: 0 0 6px rgba(245,108,108,0.5); }
  }

  &__status-tag {
    display: inline-block;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    color: #fff;
    flex: 0 0 auto;
    line-height: 18px;

    &.status-tag-0 { background: #67C23A; }
    &.status-tag-1 { background: #E6A23C; }
    &.status-tag-2 { background: #F56C6C; }
  }

  &__desc {
    flex: 1;
    font-size: 12px;
    color: #909399;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    margin-left: 4px;
  }
}

.sub-empty {
  text-align: center;
  padding: 28px;
  color: #C0C4CC;
  font-size: 13px;
}

// 表格行状态色点
.row-status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  vertical-align: middle;

  &.status-0 { background: #67C23A; box-shadow: 0 0 5px rgba(103,194,58,0.45); }
  &.status-1 { background: #E6A23C; box-shadow: 0 0 5px rgba(230,162,60,0.45); }
  &.status-2 { background: #F56C6C; box-shadow: 0 0 5px rgba(245,108,108,0.45); }
}

// 表格行背景色提示
::v-deep .el-table {
  .row-status-warning td {
    background-color: #fdf6ec !important;
  }
  .row-status-error td {
    background-color: #fef0f0 !important;
  }
}

// JsonViewer popover 内层样式
.json-popover-inner {
  max-height: 420px;
  overflow: auto;
}

// ==================== 监控弹窗 ====================

.monitor-dialog-body {
  display: flex;
  gap: 20px;
  min-height: 460px;
}

// 左侧 meta 面板
.monitor-meta-panel {
  width: 260px;
  flex-shrink: 0;
  background: #fafafa;
  border-radius: 6px;
  padding: 16px;
  overflow-y: auto;
  max-height: 560px;
}

.monitor-meta-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 2px solid #409EFF;
}

.monitor-meta-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.monitor-meta-item {
  display: flex;
  align-items: flex-start;
  padding: 7px 0;
  border-bottom: 1px dashed #EBEEF5;
  font-size: 13px;
  line-height: 1.5;

  &:last-child {
    border-bottom: none;
  }
}

.monitor-meta-label {
  color: #909399;
  flex-shrink: 0;
  min-width: 100px;
  white-space: nowrap;

  &::after {
    content: '：';
  }
}

.monitor-meta-value {
  color: #303133;
  word-break: break-all;
}

// 右侧图表面板
.monitor-chart-panel {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  max-height: 560px;

  ::v-deep .el-tabs__header {
    margin-bottom: 12px;
  }

  ::v-deep .el-tabs__nav-wrap::after {
    height: 1px;
  }
}

.monitor-chart-card {
  background: #fff;
  border: 1px solid #EBEEF5;
  border-radius: 6px;
  padding: 14px 16px 8px;
  transition: border-color 0.2s;

  &.chart-code-2 {
    border-color: #FEF0F0;
    background: #fefafa;
  }
  &.chart-code-1 {
    border-color: #FDF6EC;
    background: #fefcf8;
  }
}

.monitor-chart-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  strong {
    font-size: 13px;
    color: #303133;
  }
}

.monitor-chart-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.status-0 { background: #67C23A; box-shadow: 0 0 5px rgba(103,194,58,0.4); }
  &.status-1 { background: #E6A23C; box-shadow: 0 0 5px rgba(230,162,60,0.4); }
  &.status-2 { background: #F56C6C; box-shadow: 0 0 5px rgba(245,108,108,0.4); }
}

.monitor-chart-remark {
  font-size: 12px;
  color: #E6A23C;
  background: #fef8ee;
  padding: 6px 10px;
  border-radius: 4px;
  margin-bottom: 6px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.monitor-chart-box {
  width: 100%;
  height: 300px;
}

.monitor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #C0C4CC;
  font-size: 14px;
}
</style>

<style lang="scss">
// 全局样式：popover 中的 JsonViewer 容器
.capacity-json-popover {
  padding: 12px 16px !important;

  .json-popover-inner {
    .jv-container {
      font-size: 13px;
    }
  }
}

// 标签溢出弹窗
.capacity-tags-popover {
  padding: 8px 10px !important;
  max-width: 440px;

  .tags-popover-body {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
}
</style>
