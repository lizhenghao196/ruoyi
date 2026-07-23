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
            <div v-if="!safeTags(catName).overflow.length" class="category-header__right">
              <el-tag
                v-for="entry in safeTags(catName).visible"
                :key="entry.subName"
                size="mini"
                type="info"
              >{{ entry.subName }}: {{ entry.count }}台</el-tag>
            </div>
            <!-- 有溢出：整个区域悬浮展示全部标签 -->
            <div v-if="safeTags(catName).overflow.length" class="category-header__right has-overflow">
              <el-popover
                placement="bottom"
                trigger="hover"
                :open-delay="200"
                popper-class="capacity-tags-popover"
              >
                <div class="tags-popover-body">
                  <el-tag
                    v-for="entry in safeTags(catName).all"
                    :key="entry.subName"
                    size="mini"
                    type="info"
                    style="margin: 3px 6px 3px 0;"
                  >{{ entry.subName }}: {{ entry.count }}台</el-tag>
                </div>
                <div slot="reference" class="tags-inline">
                  <el-tag
                    v-for="entry in safeTags(catName).visible"
                    :key="entry.subName"
                    size="mini"
                    type="info"
                  >{{ entry.subName }}: {{ entry.count }}台</el-tag>
                  <span class="tags-more-badge">+{{ safeTags(catName).overflow.length }}</span>
                </div>
              </el-popover>
            </div>
          </div>

          <!-- 大类内容（子类 + 表格） -->
          <transition name="fade">
            <div v-if="!collapsedCategories[catName]" class="category-body">
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

                <!-- 子类表格（原生 table 替代 el-table，52 实例组场景性能提升明显） -->
                <table
                  v-if="subItem.data && subItem.data.length"
                  class="native-table"
                  style="width: 100%"
                >
                  <thead>
                    <tr>
                      <th class="col-status">状态</th>
                      <th
                        v-for="col in getTableColumns(subItem.data)"
                        :key="col"
                        :style="{ minWidth: getColumnWidth(col) + 'px' }"
                      >{{ getColumnLabel(col) }}</th>
                      <th class="col-action" style="width: 140px;">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, ri) in subItem.data"
                      :key="ri"
                      :class="tableRowClassName({ row })"
                    >
                      <td class="col-status">
                        <span class="row-status-dot" :class="'status-' + (row.code != null ? row.code : 0)" />
                      </td>
                      <td
                        v-for="col in getTableColumns(subItem.data)"
                        :key="col"
                        :title="formatCellValue(col, row[col])"
                      >{{ formatCellValue(col, row[col]) }}</td>
                      <td class="col-action">
                        <el-button type="text" size="mini" icon="el-icon-data-line" @click="handleMonitor(row)">历史数据</el-button>
                        <span class="action-gap" />
                        <el-dropdown trigger="hover" @command="(cmd) => handleMoreCommand(cmd, row)">
                          <el-button type="text" size="mini">
                            更多<i class="el-icon-arrow-down el-icon--right"></i>
                          </el-button>
                          <el-dropdown-menu slot="dropdown">
                            <el-dropdown-item command="config" icon="el-icon-document">配置文件</el-dropdown-item>
                          </el-dropdown-menu>
                        </el-dropdown>
                      </td>
                    </tr>
                  </tbody>
                </table>
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

    <!-- 配置文件弹窗 -->
    <el-dialog
      :title="'配置文件 - ' + configHostname"
      :visible.sync="configVisible"
      width="1100px"
      top="8vh"
      :close-on-click-modal="false"
    >
      <div v-loading="configLoading" class="config-dialog-body">
        <template v-if="!configLoading && configContent">
          <div class="config-toolbar">
            <span class="config-server">{{ configServerIp }}</span>
            <el-button type="text" size="mini" icon="el-icon-document-copy" @click="copyConfig">复制内容</el-button>
          </div>
          <div class="config-code-wrapper">
            <div class="config-line-numbers">
              <span v-for="i in configLines.length" :key="i">{{ i }}</span>
            </div>
            <pre class="config-code"><code v-html="configHighlighted"></code></pre>
          </div>
        </template>
        <div v-else-if="!configLoading" class="monitor-empty">暂无配置文件数据</div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { getCapacityAnalysis, getMonitorDetail, getConfigFile } from '@/api/tool/capacity'
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
      tagsCache: {},
      // 监控弹窗
      monitorVisible: false,
      monitorLoading: false,
      monitorHostname: '',
      monitorMeta: {},
      monitorTabData: {},
      monitorTabs: [],
      monitorActiveTab: '',
      // 配置文件弹窗
      configVisible: false,
      configLoading: false,
      configHostname: '',
      configContent: ''
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
    },

    configLines() {
      return this.configContent ? this.configContent.split('\n') : []
    },
    configServerIp() {
      const firstLine = this.configLines[0] || ''
      const match = firstLine.match(/^(\S+)/)
      return match ? match[1] : ''
    },
    configHighlighted() {
      return this.configLines.slice(1).map((line) => {
        let escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
        if (/^\s*#/.test(escaped)) {
          return '<span class="cfg-comment">' + escaped + '</span>'
        }
        escaped = escaped.replace(/\b(server|upstream|location|if|stream|http|events)\b/g,
          '<span class="cfg-keyword">$1</span>')
        escaped = escaped.replace(/^(\s*)([\w_]+)(\s)/, (m, space, directive, after) => {
          return space + '<span class="cfg-directive">' + directive + '</span>' + after
        })
        return escaped
      }).join('\n')
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
          this.buildTagsCache()
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

    safeTags(catName) {
      return this.tagsCache[catName] || { all: [], visible: [], overflow: [] }
    },

    buildTagsCache() {
      const cache = {}
      this.displayCategories.forEach((catName) => {
        cache[catName] = this.tagsDisplay(catName)
      })
      this.tagsCache = cache
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
        if (res.data && Array.isArray(res.data)) {
          this.monitorMeta = res.meta || {}
          // 每个 chart 的 title 作为一个 tab，tab 内只有一个图表
          const tabData = {}
          res.data.forEach((chart) => {
            const tabName = chart.title || '默认'
            if (!tabData[tabName]) tabData[tabName] = []
            tabData[tabName].push(chart)
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
                chart.title + '：<b>' + p.value + '</b>'
            }
          },
          grid: { left: 46, right: 50, top: 36, bottom: 32 },
          xAxis: {
            type: 'category',
            data: chart.timeline || [],
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#DCDFE6' } },
            axisTick: { show: false },
            axisLabel: { color: '#909399', fontSize: 11 }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: '#F2F3F5', type: 'dashed' } },
            axisLabel: { color: '#909399', fontSize: 11 }
          },
          series: [{
            data: chart.data || [],
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
              formatter: '{c}'
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
    },

    // ========== 配置文件弹窗 ==========

    handleMoreCommand(cmd, row) {
      if (cmd === 'config') {
        this.openConfigDialog(row)
      }
    },

    openConfigDialog(row) {
      this.configVisible = true
      this.configLoading = true
      this.configHostname = row.hostname || ''
      this.configContent = ''

      getConfigFile({ hostname: row.hostname }).then((res) => {
        if (res.retCode === 200 && res.data) {
          this.configContent = res.data
        }
      }).catch(() => {
        this.$message.error('获取配置文件失败')
      }).finally(() => {
        this.configLoading = false
      })
    },

    copyConfig() {
      const text = this.configContent
      if (!text) return
      navigator.clipboard.writeText(text).then(() => {
        this.$message.success('已复制到剪贴板')
      }).catch(() => {
        // fallback
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        this.$message.success('已复制到剪贴板')
      })
    }
  },
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

// 折叠动画（仅淡入淡出，避免 max-height 过渡触发大量 DOM 重排）
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
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

// 原生表格（替代 el-table）
.native-table {
  border-collapse: collapse;
  font-size: 12px;
  color: #606266;
  table-layout: auto;

  thead {
    background: #f5f7fa;
  }

  th {
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    color: #909399;
    border: 1px solid #EBEEF5;
    white-space: nowrap;
  }

  td {
    padding: 6px 10px;
    border: 1px solid #EBEEF5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  tbody tr {
    transition: background 0.15s;

    &:hover {
      background: #f5f7fa;
    }

    // 斑马纹
    &:nth-child(even) {
      background: #fafafa;

      &:hover {
        background: #f5f7fa;
      }
    }

    // 状态行背景
    &.row-status-warning td {
      background-color: #fdf6ec;
    }
    &.row-status-error td {
      background-color: #fef0f0;
    }
  }

  .col-status {
    width: 72px;
    text-align: center;
  }

  .col-action {
    width: 140px;
    text-align: center;
    white-space: nowrap;
  }

  .action-gap {
    display: inline-block;
    width: 8px;
  }
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
  align-items: center;
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

// ==================== 配置文件弹窗 ====================

.config-dialog-body {
  min-height: 360px;
}

.config-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin-bottom: 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.config-server {
  font-size: 13px;
  color: #606266;
  font-weight: 600;

  &::before {
    content: '服务器 ';
    font-weight: 400;
    color: #909399;
  }
}

.config-code-wrapper {
  display: flex;
  border: 1px solid #EBEEF5;
  border-radius: 6px;
  overflow: auto;
  max-height: 560px;
}

.config-line-numbers {
  flex-shrink: 0;
  width: 48px;
  padding: 14px 0;
  background: #fafafa;
  border-right: 1px solid #EBEEF5;
  text-align: center;
  user-select: none;
  position: sticky;
  left: 0;

  span {
    display: block;
    font-size: 12px;
    line-height: 22px;
    color: #C0C4CC;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  }
}

.config-code {
  flex: 1;
  margin: 0;
  padding: 14px 16px;
  overflow: visible;
  background: #fff;
  font-size: 12px;
  line-height: 22px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  tab-size: 4;
  white-space: pre;
  color: #303133;

  code {
    font-family: inherit;
  }

  ::v-deep .cfg-comment {
    color: #A0A4A8;
    font-style: italic;
  }

  ::v-deep .cfg-keyword {
    color: #409EFF;
    font-weight: 600;
  }

  ::v-deep .cfg-directive {
    color: #E6A23C;
  }
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
    align-content: flex-start;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
  }
}
</style>
