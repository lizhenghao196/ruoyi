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
            <div class="category-header__right">
              <el-tag
                v-for="(count, subName) in getSubNameSummary(catName)"
                :key="subName"
                size="mini"
                type="info"
              >{{ subName }}: {{ count }}台</el-tag>
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
                  <span class="sub-header__dot" />
                  <strong>{{ subName }}</strong>
                  <el-tag size="mini">{{ subItem.data.length }} 条</el-tag>
                </div>

                <!-- 子类表格 -->
                <el-table
                  v-if="subItem.data && subItem.data.length"
                  :data="subItem.data"
                  border
                  stripe
                  size="small"
                  style="width: 100%"
                >
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
  </div>
</template>

<script>
import { getCapacityAnalysis } from '@/api/tool/capacity'
import JsonViewer from 'vue-json-viewer'
import 'vue-json-viewer/style.css'

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
      defaultCollapsed: false
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
      Object.keys(this.analysisResult).forEach((catName) => {
        state[catName] = this.defaultCollapsed
      })
      this.collapsedCategories = state
    },

    toggleCategory(catName) {
      this.$set(this.collapsedCategories, catName, !this.collapsedCategories[catName])
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

    getCellStyle(col, value) {
      return {}
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
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 0 auto;

  ::v-deep .el-tag {
    margin: 0;
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
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #409EFF;
    flex: 0 0 auto;
  }
}

.sub-empty {
  text-align: center;
  padding: 28px;
  color: #C0C4CC;
  font-size: 13px;
}

// JsonViewer popover 内层样式
.json-popover-inner {
  max-height: 420px;
  overflow: auto;
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
</style>
