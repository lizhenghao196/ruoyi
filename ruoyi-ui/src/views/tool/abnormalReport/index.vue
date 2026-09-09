<template>
  <div class="abnormal-report">
    <!-- ================= 顶部工具栏：左侧查询条件 + 右侧异常概览 ================= -->
    <section class="ar-bar">
      <div class="ar-bar__filters">
        <el-input
          :value="form.systemId"
          class="ar-bar__input"
          placeholder="系统英文缩写，如 DASP"
          clearable
          maxlength="32"
          prefix-icon="el-icon-s-grid"
          @input="onSystemInput"
          @keyup.enter.native="handleQuery"
        />
        <el-date-picker
          v-model="form.month"
          class="ar-bar__month"
          type="month"
          format="yyyy年MM月"
          value-format="yyyy-MM"
          placeholder="选择月份"
          :clearable="false"
        />
        <el-button
          type="primary"
          icon="el-icon-search"
          :disabled="loading"
          @click="handleQuery"
        >
          查询
        </el-button>

        <!-- 一键收起 / 一键展开：查询出分组数据后可用 -->
        <el-button
          v-if="searched && indicatorGroups.length > 0"
          type="info"
          plain
          class="ar-bar__toggle-all"
          :disabled="loading"
          @click="toggleAllGroups"
        >
          <i :class="allCollapsed ? 'el-icon-arrow-down' : 'el-icon-arrow-up'" />
          {{ allCollapsed ? '一键展开' : '一键收起' }}
        </el-button>
      </div>

      <div v-if="searched && hasData" class="ar-bar__overview">
        <exception-overview :stats="overviewStats" />
      </div>
    </section>

    <!-- ================= 数据区域 ================= -->
    <div v-loading="loading" element-loading-text="正在查询..." class="ar-body">
      <!-- 未查询 -->
      <section v-if="!searched" class="ar-state">
        <el-empty description="请输入查询条件获取异常资源数据" :image-size="110">
          <p class="ar-state__hint">支持系统英文缩写（如 DASP）与月份组合查询</p>
        </el-empty>
      </section>

      <!-- 查询成功但无数据 -->
      <section v-else-if="!hasData" class="ar-state">
        <el-empty description="当前查询条件下暂无异常资源" :image-size="110" />
      </section>

      <template v-else>
        <!-- 指标异常：有数据展示分组，无数据也保留模块并提示 -->
        <section class="ar-metrics">
          <div class="ar-metrics__title">
            <div class="ar-metrics__title-main">
              <i class="el-icon-warning-outline ar-metrics__title-icon" />
              指标异常
              <span class="ar-metrics__badge">{{ indicatorTotal }} 台异常资源</span>
            </div>
            <span class="ar-metrics__period">{{ periodLabel }}</span>
          </div>

          <template v-if="indicatorGroups.length > 0">
            <div
              v-for="group in indicatorGroups"
              :key="group.name"
              class="ar-metrics__group"
              :class="{ 'is-collapsed': isGroupCollapsed(group.name) }"
            >
              <div
                class="ar-metrics__group-head"
                role="button"
                :title="isGroupCollapsed(group.name) ? '展开该分类' : '收起该分类'"
                @click="toggleGroup(group.name)"
              >
                <div class="ar-metrics__group-name">
                  <i :class="['ar-metrics__group-icon', group.icon]" />
                  {{ group.name }}
                  <el-tag size="small" effect="plain" type="info">共 {{ group.list.length }} 台</el-tag>
                  <i
                    :class="['ar-metrics__caret', isGroupCollapsed(group.name) ? 'is-collapsed' : '']"
                    class="el-icon-arrow-down"
                  />
                </div>
              </div>

              <div v-if="!isGroupCollapsed(group.name)" class="ar-metrics__cards">
                <resource-card
                  v-for="(item, index) in group.list"
                  :key="(item.hostname || '') + '|' + (item.ip || '') + '|' + index"
                  :item="item"
                  :category="group.name"
                  @view-detail="openDetail"
                />
              </div>
            </div>
          </template>

          <!-- 指标异常为空时的占位提示 -->
          <div v-else class="ar-metrics__no-data">
            <i class="el-icon-circle-check ar-metrics__no-data-icon" />
            <p class="ar-metrics__no-data-text">该查询条件下暂无指标异常资源</p>
          </div>
        </section>

        <!-- 采集异常 -->
        <collect-exception-table
          v-if="collectRows.length > 0 || collectDate"
          class="ar-collect"
          :collect="collectData"
        />
      </template>
    </div>

    <!-- 资源详情抽屉 -->
    <resource-detail-drawer :visible.sync="drawerVisible" :item="detailItem" />
  </div>
</template>

<script>
import { getAbnormalReport } from '@/api/tool/abnormalReport'
import { getCategoryIcon, flattenCollectException } from './utils'
import ExceptionOverview from './components/ExceptionOverview'
import ResourceCard from './components/ResourceCard'
import ResourceDetailDrawer from './components/ResourceDetailDrawer'
import CollectExceptionTable from './components/CollectExceptionTable'

const pad = (n) => String(n).padStart(2, '0')
// 默认查询上一月（月初出上月报表场景）
const prevMonth = () => {
  const d = new Date()
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${p.getFullYear()}-${pad(p.getMonth() + 1)}`
}

// 概览卡片循环色板
const ACCENT_COLORS = ['#f56c6c', '#e6a23c', '#409eff', '#67c23a', '#909399']

export default {
  name: 'AbnormalReport',
  components: {
    ExceptionOverview,
    ResourceCard,
    ResourceDetailDrawer,
    CollectExceptionTable
  },
  data() {
    return {
      form: {
        systemId: '',
        month: prevMonth() // 默认上一月，yyyy-MM
      },
      loading: false,
      searched: false,
      indicatorData: {}, // 指标异常: { 分类: [] }
      collectData: {}, // 采集异常: { 数据, 采集日期 }
      collapsedGroups: {}, // 已收起的分类: { 分类名: true }
      lastParams: null, // 最近一次查询参数
      drawerVisible: false,
      detailItem: null
    }
  },
  computed: {
    periodLabel() {
      if (!this.lastParams) return ''
      const { year, month_no } = this.lastParams
      return `${year}年${pad(month_no)}月`
    },
    // 指标异常分类（动态 key），仅保留有数据的分类，行元素做空值过滤
    indicatorGroups() {
      if (!this.indicatorData || typeof this.indicatorData !== 'object') return []
      return Object.keys(this.indicatorData)
        .filter((name) => Array.isArray(this.indicatorData[name]) && this.indicatorData[name].length > 0)
        .map((name) => ({
          name: name,
          icon: getCategoryIcon(name),
          list: this.indicatorData[name].filter((row) => row && typeof row === 'object')
        }))
        .filter((g) => g.list.length > 0)
    },
    indicatorTotal() {
      return this.indicatorGroups.reduce((sum, g) => sum + g.list.length, 0)
    },
    collectRows() {
      return flattenCollectException(this.collectData)
    },
    collectDate() {
      const d = this.collectData && this.collectData.采集日期
      return d === undefined || d === null || d === '' ? '' : String(d)
    },
    hasData() {
      // 采集日期也算「有数据」：此时指标异常模块空态也需要展示
      return this.indicatorGroups.length > 0 || this.collectRows.length > 0 || !!this.collectDate
    },
    // 所有分组都已收起
    allCollapsed() {
      const groups = this.indicatorGroups
      return groups.length > 0 && groups.every((g) => !!this.collapsedGroups[g.name])
    },
    // 概览统计卡片：动态分类 + 采集异常
    overviewStats() {
      const stats = this.indicatorGroups.map((g, i) => ({
        name: g.name,
        label: `${g.name}异常资源`,
        count: g.list.length,
        icon: g.icon,
        color: ACCENT_COLORS[i % ACCENT_COLORS.length]
      }))
      const collectCount = this.collectRows.length
      if (collectCount > 0 || this.collectDate) {
        stats.push({
          name: '采集异常',
          label: '采集异常',
          count: collectCount,
          icon: 'el-icon-warning',
          color: collectCount > 0 ? '#e6a23c' : '#909399'
        })
      }
      return stats
    }
  },
  methods: {
    // 只允许英文/数字/中划线/下划线，自动转大写
    onSystemInput(value) {
      this.form.systemId = String(value || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .toUpperCase()
    },
    handleQuery() {
      if (this.loading) return
      const month = this.form.month || prevMonth()
      const [yearStr, monthStr] = month.split('-')
      const params = {
        systemId: this.form.systemId,
        year: Number(yearStr),
        month_no: Number(monthStr)
      }
      this.loading = true
      getAbnormalReport(params)
        .then((res) => {
          const data = (res && res.data) || {}
          // 防御：指标异常/采集异常 可能缺失、为 null 或空对象
          const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
          this.indicatorData = isPlain(data.指标异常) ? data.指标异常 : {}
          this.collectData = isPlain(data.采集异常) ? data.采集异常 : {}
          this.collapsedGroups = {} // 新查询默认全部分组展开
          this.searched = true
          this.lastParams = params
        })
        .finally(() => {
          this.loading = false
        })
    },
    openDetail(item) {
      this.detailItem = item
      this.drawerVisible = true
    },
    // 单个分类：展开 / 收起
    toggleGroup(name) {
      this.$set(this.collapsedGroups, name, !this.collapsedGroups[name])
    },
    isGroupCollapsed(name) {
      return !!this.collapsedGroups[name]
    },
    // 一键收起 / 一键展开：任一展开则全部收起，全部收起则全部展开
    toggleAllGroups() {
      if (this.allCollapsed) {
        this.collapsedGroups = {}
      } else {
        const map = {}
        this.indicatorGroups.forEach((g) => {
          map[g.name] = true
        })
        this.collapsedGroups = map
      }
    }
  }
}
</script>

<style lang="scss" scoped>
$bg: #f5f7fa;
$card: #fff;
$border: #ebeef5;
$text-main: #303133;
$text-sub: #909399;

.abnormal-report {
  background: $bg;
  min-height: calc(100vh - 84px);
  padding: 16px 20px 20px;
}

/* ================= 顶部工具栏 ================= */
.ar-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  background: $card;
  border: 1px solid $border;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;

  &__filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  &__input {
    width: 260px;
  }

  &__month {
    width: 200px;
  }

  // 查询成功后的右侧概览，紧贴查询条件右侧
  &__overview {
    margin-left: auto;
    display: flex;
    align-items: center;
    padding-left: 20px;
    border-left: 1px dashed $border;
    min-width: 280px;
    justify-content: flex-end;
  }
}

/* ================= 状态区 ================= */
.ar-state {
  background: $card;
  border: 1px solid $border;
  border-radius: 8px;
  padding: 32px 0;

  &__hint {
    margin: 0;
    font-size: 12px;
    color: #c0c4cc;
  }
}

/* ================= 指标异常 ================= */
.ar-metrics {
  background: $card;
  border: 1px solid $border;
  border-radius: 8px;
  padding: 16px 20px 20px;

  &__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  &__title-main {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 600;
    color: $text-main;
  }

  &__title-icon {
    color: #f56c6c;
  }

  &__badge {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: $text-sub;
  }

  &__period {
    font-size: 12px;
    color: #c0c4cc;
  }

  &__no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 36px 0 28px;
  }

  &__no-data-icon {
    font-size: 34px;
    color: #c0c4cc;
  }

  &__no-data-text {
    margin: 0;
    font-size: 13px;
    color: #909399;
  }

  &__group {
    margin-top: 20px;
    border-radius: 8px;
    transition: background 0.2s ease;

    &:first-of-type {
      margin-top: 0;
    }

    &.is-collapsed {
      background: #fafbfd;

      .ar-metrics__group-head {
        margin-bottom: 0;
        padding-bottom: 0;
        border-radius: 8px;
      }
    }
  }

  &__group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    margin-bottom: 4px;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease;
    margin-left: -10px;
    margin-right: -10px;

    &:hover {
      background: #f5f7fa;
    }
  }

  &__group-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    color: $text-main;

    ::v-deep .el-tag {
      margin-left: 4px;
    }
  }

  &__group-icon {
    color: #409eff;
    font-size: 16px;
  }

  &__caret {
    color: #909399;
    font-size: 13px;
    transition: transform 0.2s ease;
    flex-shrink: 0;
    margin-left: 6px;

    &.is-collapsed {
      transform: rotate(-90deg);
    }
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
}

/* ================= 采集异常 ================= */
.ar-collect {
  margin-top: 16px;
}
</style>
