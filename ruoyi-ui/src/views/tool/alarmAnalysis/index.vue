<template>
  <div class="alarm-analysis">
    <!-- ================= 顶部工具栏：查询条件 ================= -->
    <section class="aa-bar">
      <div class="aa-bar__filters">
        <el-input
          :value="form.systemId"
          class="aa-bar__input"
          placeholder="系统英文缩写，如 AUTH"
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
        <span class="aa-bar__overview-item">
          重复性分析 <b>{{ duplicateGroups.length }}</b> 组
        </span>
      </div>
    </section>

    <!-- ================= 数据区域 ================= -->
    <div v-loading="loading" element-loading-text="正在查询..." class="aa-body">
      <!-- 未查询 -->
      <section v-if="!searched" class="aa-state">
        <el-empty description="请输入查询条件后点击「查询」" :image-size="110">
          <p class="aa-state__hint">支持系统英文缩写（如 AUTH）与告警时间范围组合查询</p>
        </el-empty>
      </section>

      <!-- 查询成功但无数据 -->
      <section v-else-if="!hasData" class="aa-state">
        <el-empty description="当前查询条件下暂无告警数据" :image-size="110" />
      </section>

      <template v-else>
        <!-- P1：指标 -->
        <collapse-section
          title="指标"
          icon="el-icon-data-analysis"
          :badge="`P1 汇总 · ${p1Count} 项`"
          :collapsed="!!collapsed.metrics"
          @toggle="toggleSection('metrics')"
        >
          <metric-cards :metrics-data="p1Data" />
        </collapse-section>

        <!-- P2 / P3：分类内只有一张表就直接展示，多张表用 tab 切换 -->
        <collapse-section
          v-for="section in alarmSections"
          :key="section.key"
          :title="section.title"
          icon="el-icon-warning-outline"
          :badge="section.badge"
          :collapsed="!!collapsed[section.key]"
          @toggle="toggleSection(section.key)"
        >
          <template v-if="section.lists.length === 1">
            <alarm-table :rows="section.lists[0].rows" @view-field="openField" />
          </template>

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

        <!-- 重复性分析 -->
        <collapse-section
          title="重复性分析"
          icon="el-icon-refresh"
          :badge="`${duplicateGroups.length} 组 / ${duplicateRowCount} 条`"
          :collapsed="!!collapsed.duplicate"
          @toggle="toggleSection('duplicate')"
        >
          <duplicate-table :groups="duplicateGroups" />
        </collapse-section>
      </template>
    </div>

    <!-- 字段查看弹窗：使用到的智能体 / 告警报告 / 更多字段 -->
    <field-dialog :visible.sync="fieldVisible" :type="fieldType" :item="fieldItem" />
  </div>
</template>

<script>
import { getAlarmAnalysis } from '@/api/tool/alarmAnalysis'
import CollapseSection from './components/CollapseSection'
import MetricCards from './components/MetricCards'
import AlarmTable from './components/AlarmTable'
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
      p1Data: {}, // P1: { 指标名: 值 }
      p2Data: {}, // P2: { 人工关单: [] }
      p3Data: {}, // P3: { Agent关闭失败: [], 告警未恢复: [] }
      duplicateGroups: [], // 重复性分析: [ { data: [], 重复性说明 } ]
      collapsed: {}, // 已收起的区块: { metrics/P2/P3/duplicate: true }
      activeTabs: {}, // 区块内当前选中的 tab: { P3: 'Agent关闭失败' }
      lastParams: null, // 最近一次查询参数
      fieldVisible: false,
      fieldType: 'more',
      fieldItem: {}
    }
  },
  computed: {
    // P2 / P3 区块：每个分类下有 1 张表直接展示，多张表用 tab 切换
    alarmSections() {
      const sections = []
      const build = (key, group, lists) => {
        if (!lists || typeof lists !== 'object') return
        const items = Object.keys(lists).map((name) => ({
          name: name,
          rows: Array.isArray(lists[name])
            ? lists[name].filter((row) => row && typeof row === 'object')
            : []
        }))
        if (items.length === 0) return
        const total = items.reduce((sum, item) => sum + item.rows.length, 0)
        sections.push({
          key: key,
          group: group,
          lists: items,
          title: items.length === 1 ? `${group} · ${items[0].name}` : group,
          badge: items.length === 1 ? `${total} 条` : `${items.length} 类 / ${total} 条`
        })
      }
      build('P2', 'P2', this.p2Data)
      build('P3', 'P3', this.p3Data)
      return sections
    },
    // 所有可收缩的区块 key，供一键收起使用
    sectionKeys() {
      return ['metrics'].concat(
        this.alarmSections.map((section) => section.key),
        ['duplicate']
      )
    },
    p1Count() {
      return Object.keys(this.p1Data || {}).length
    },
    totalCount() {
      return this.alarmSections.reduce((sum, section) => {
        return sum + section.lists.reduce((s, list) => s + list.rows.length, 0)
      }, 0)
    },
    duplicateRowCount() {
      return this.duplicateGroups.reduce((sum, group) => {
        return sum + (Array.isArray(group.data) ? group.data.length : 0)
      }, 0)
    },
    hasData() {
      return this.totalCount > 0 || this.duplicateRowCount > 0
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
      const range = Array.isArray(this.form.dateRange) ? this.form.dateRange : []
      const params = {
        systemId: this.form.systemId,
        startDate: range[0] || '',
        endDate: range[1] || ''
      }
      this.loading = true
      getAlarmAnalysis(params)
        .then((res) => {
          const data = (res && res.data) || {}
          // 防御：P1/P2/P3/重复性分析 可能缺失、为 null 或结构不符
          const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
          this.p1Data = isPlain(data.P1) ? data.P1 : {}
          this.p2Data = isPlain(data.P2) ? data.P2 : {}
          this.p3Data = isPlain(data.P3) ? data.P3 : {}
          this.duplicateGroups = Array.isArray(data.重复性分析)
            ? data.重复性分析.filter((group) => {
                return isPlain(group) && Array.isArray(group.data) && group.data.length > 0
              })
            : []
          this.collapsed = {} // 新查询默认全部展开
          // 重新生成 tab 状态：整对象替换，保证新增的 key 也是响应式的
          const tabs = {}
          this.alarmSections.forEach((section) => {
            if (section.lists.length > 1) {
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
