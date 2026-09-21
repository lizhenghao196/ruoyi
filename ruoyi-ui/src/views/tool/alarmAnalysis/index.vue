<template>
  <div class="alarm-analysis">
    <!-- ================= 顶部工具栏：查询条件 ================= -->
    <section class="aa-bar">
      <div class="aa-bar__filters">
        <!-- 系统 ID 选填：不填也能查，组装参数时不会带 systemId 字段 -->
        <el-input
          :value="form.systemId"
          class="aa-bar__input"
          placeholder="系统英文缩写（选填），如 AUTH"
          clearable
          maxlength="32"
          prefix-icon="el-icon-s-grid"
          @input="onSystemInput"
          @keyup.enter.native="handleQuery"
        />
        <el-date-picker
          v-model="form.dateRange"
          class="aa-bar__range"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="yyyy-MM-dd"
          unlink-panels
          :clearable="!loading"
        />
        <el-button
          type="primary"
          icon="el-icon-search"
          :disabled="loading"
          @click="handleQuery"
        >
          查询
        </el-button>

        <!-- 一键收起 / 一键展开：查询出数据后可用 -->
        <el-button
          v-if="searched && hasData"
          type="info"
          plain
          class="aa-bar__toggle-all"
          :disabled="loading"
          @click="toggleAllSections"
        >
          <i :class="allCollapsed ? 'el-icon-arrow-down' : 'el-icon-arrow-up'" />
          {{ allCollapsed ? '一键展开' : '一键收起' }}
        </el-button>
      </div>

      <!-- 查询成功后的概览 -->
      <div v-if="searched && hasData" class="aa-bar__overview">
        <span class="aa-bar__overview-item">
          告警总量 <b>{{ totalCount }}</b>
        </span>
        <span v-if="duplicateGroupCount > 0" class="aa-bar__overview-item">
          重复性分析 <b>{{ duplicateGroupCount }}</b> 组
        </span>
      </div>
    </section>

    <!-- ================= 数据区域 ================= -->
    <div v-loading="loading" element-loading-text="正在查询..." class="aa-body">
      <!-- 未查询 -->
      <section v-if="!searched" class="aa-state">
        <el-empty description="请输入查询条件后点击「查询」" :image-size="110">
          <p class="aa-state__hint">支持系统英文缩写（选填，如 AUTH）与告警时间范围组合查询</p>
        </el-empty>
      </section>

      <!-- 查询成功但无数据 -->
      <section v-else-if="!hasData" class="aa-state">
        <el-empty description="当前查询条件下暂无告警数据" :image-size="110" />
      </section>

      <template v-else>
        <!-- 指标：所有「指标型」数据合并成一行，按 key 分组（P1 / P2 …）用标签区分 -->
        <collapse-section
          v-if="metricGroups.length > 0"
          title="指标"
          icon="el-icon-data-analysis"
          :badge="metricsBadge"
          :collapsed="!!collapsed[metricsKey]"
          @toggle="toggleSection(metricsKey)"
        >
          <metric-cards :groups="metricGroups" />
        </collapse-section>

        <!-- 其余区块：完全按后端返回的 key 与形态动态渲染 -->
        <collapse-section
          v-for="section in sections"
          :key="section.key"
          :title="section.title"
          :icon="section.icon"
          :badge="section.badge"
          :collapsed="!!collapsed[section.key]"
          @toggle="toggleSection(section.key)"
        >
          <!-- 两级型（如 AI处置）：一级 tab → 二级切换 → 表格 -->
          <nested-groups
            v-if="section.kind === 'nested'"
            :levels="section.levels"
            @view-field="openField"
          />

          <!-- 重复型（如 重复性分析）：分组纵向合并单元格 -->
          <duplicate-table
            v-else-if="section.kind === 'duplicate'"
            :groups="section.groups"
          />

          <!-- 表格型：分类内只有一张表就直接展示，多张表用 tab 切换 -->
          <alarm-table
            v-else-if="section.lists.length === 1"
            :rows="section.lists[0].rows"
            @view-field="openField"
          />

          <el-tabs v-else v-model="activeTabs[section.key]" class="aa-tabs">
            <el-tab-pane
              v-for="list in section.lists"
              :key="list.name"
              :label="`${list.name} (${list.rows.length})`"
              :name="list.name"
              lazy
            >
              <alarm-table :rows="list.rows" @view-field="openField" />
            </el-tab-pane>
          </el-tabs>
        </collapse-section>
      </template>
    </div>

    <!-- 字段查看弹窗：使用到的智能体 / 告警报告 / 更多字段 -->
    <field-dialog :visible.sync="fieldVisible" :type="fieldType" :item="fieldItem" />
  </div>
</template>

<script>
import { getAlarmAnalysis, pickPayload } from '@/api/tool/alarmAnalysis'
import { buildSections, buildQueryParams, sectionRowCount, METRICS_KEY } from './shape'
import CollapseSection from './components/CollapseSection'
import MetricCards from './components/MetricCards'
import AlarmTable from './components/AlarmTable'
import NestedGroups from './components/NestedGroups'
import DuplicateTable from './components/DuplicateTable'
import FieldDialog from './components/FieldDialog'

const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// 默认最近 30 天（含今天）
const defaultRange = () => {
  const end = new Date()
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000)
  return [fmtDate(start), fmtDate(end)]
}

export default {
  name: 'AlarmAnalysis',
  components: {
    CollapseSection,
    MetricCards,
    AlarmTable,
    NestedGroups,
    DuplicateTable,
    FieldDialog
  },
  data() {
    return {
      form: {
        systemId: '',
        dateRange: defaultRange() // [startDate, endDate]，yyyy-MM-dd
      },
      loading: false,
      searched: false,
      // 指标条在 collapsed / sectionKeys 里的固定 key（指标不是 payload 的某个 key）
      metricsKey: METRICS_KEY,
      // 指标组： [ { name: 'P1', metrics: [...] } ] —— 所有指标型 key 合并成一行
      metricGroups: [],
      // 其余区块：形态由 shape.js 判定，页面只按 kind 选渲染器
      sections: [],
      collapsed: {}, // 已收起的区块: { __metrics__/P3/人工关单/AI处置/重复性分析: true }
      activeTabs: {}, // 表格型区块内当前选中的 tab: { P3: 'Agent关闭失败' }
      lastParams: null, // 最近一次查询参数
      fieldVisible: false,
      fieldType: 'more',
      fieldItem: {}
    }
  },
  computed: {
    // 所有可收缩的区块 key（指标 + 动态区块），供一键收起使用
    sectionKeys() {
      const keys = this.sections.map((section) => section.key)
      return this.metricGroups.length > 0 ? [this.metricsKey].concat(keys) : keys
    },
    metricsBadge() {
      const count = this.metricGroups.reduce((sum, group) => sum + group.metrics.length, 0)
      return `${this.metricGroups.length} 组 · ${count} 项`
    },
    // 告警总量：表格型 + 两级型里的告警条数（重复性分析单独统计）
    totalCount() {
      return this.sections.reduce((sum, section) => {
        return sum + (section.kind === 'duplicate' ? 0 : sectionRowCount(section))
      }, 0)
    },
    duplicateSection() {
      return this.sections.find((section) => section.kind === 'duplicate') || null
    },
    duplicateGroupCount() {
      return this.duplicateSection ? this.duplicateSection.groups.length : 0
    },
    hasData() {
      return this.metricGroups.length > 0 || this.sections.length > 0
    },
    // 所有区块都已收起
    allCollapsed() {
      const keys = this.sectionKeys
      return keys.length > 0 && keys.every((key) => !!this.collapsed[key])
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
      // 系统 ID 选填：没填就不带 systemId 字段（见 shape.js 的 buildQueryParams）
      const params = buildQueryParams(this.form)
      this.loading = true
      // 返回 promise：便于外部（校验脚本 / 调用方）等待本次查询结束
      return getAlarmAnalysis(params)
        .then((res) => {
          const built = buildSections(pickPayload(res))
          this.metricGroups = built.metricGroups
          this.sections = built.sections
          this.collapsed = {} // 新查询默认全部展开
          // 重新生成 tab 状态：整对象替换，保证新增的 key 也是响应式的
          const tabs = {}
          built.sections.forEach((section) => {
            if (section.kind === 'table' && section.lists.length > 1) {
              tabs[section.key] = section.lists[0].name
            }
          })
          this.activeTabs = tabs
          this.searched = true
          this.lastParams = params
        })
        .finally(() => {
          this.loading = false
        })
    },
    toggleSection(key) {
      this.$set(this.collapsed, key, !this.collapsed[key])
    },
    // 一键收起 / 一键展开：任一展开则全部收起，全部收起则全部展开
    toggleAllSections() {
      if (this.allCollapsed) {
        this.collapsed = {}
      } else {
        const map = {}
        this.sectionKeys.forEach((key) => {
          map[key] = true
        })
        this.collapsed = map
      }
    },
    openField(type, row) {
      this.fieldType = type
      this.fieldItem = row || {}
      this.fieldVisible = true
    }
  }
}
</script>

<style lang="scss" scoped>
$bg: #f5f7fa;
$card: #fff;
$border: #ebeef5;
$text-sub: #909399;

.alarm-analysis {
  background: $bg;
  min-height: calc(100vh - 84px);
  padding: 16px 20px 20px;
}

/* ================= 顶部工具栏 ================= */
.aa-bar {
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

  &__range {
    width: 300px;
  }

  &__toggle-all {
    i {
      margin-right: 4px;
    }
  }

  &__overview {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 20px;
    padding-left: 20px;
    border-left: 1px dashed $border;
    font-size: 12px;
    color: $text-sub;
    white-space: nowrap;
  }

  &__overview-item {
    b {
      margin-left: 4px;
      font-size: 14px;
      color: #409eff;
    }
  }
}

/* ================= 状态区 ================= */
.aa-state {
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

/* ================= 分类内的 tab（多张表时） ================= */
.aa-tabs {
  ::v-deep .el-tabs__header {
    margin: 0 0 10px;
  }

  ::v-deep .el-tabs__nav-wrap::after {
    height: 1px;
    background-color: $border;
  }

  ::v-deep .el-tabs__item {
    height: 34px;
    line-height: 34px;
    font-size: 13px;
    color: #606266;

    &.is-active {
      font-weight: 600;
    }
  }
}
</style>
