<template>
  <el-drawer
    :visible="visible"
    size="560px"
    :with-header="false"
    :append-to-body="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="rdd">
      <!-- ===== 头部：hostname + component ｜ 整体状态 + 关闭 ===== -->
      <div class="rdd__head">
        <div class="rdd__head-main">
          <h3 class="rdd__hostname" :title="hostname">{{ hostname }}</h3>
          <p class="rdd__component" :title="component">{{ component }}</p>
        </div>
        <div class="rdd__head-side">
          <span
            class="rdd__status"
            :style="{ color: status.color, background: status.color + '1a' }"
            :title="`整体状态：${status.label}`"
          >
            <i class="rdd__status-dot" :style="{ background: status.color }" />
            {{ status.label }}
          </span>
          <button type="button" class="rdd__close" @click="$emit('update:visible', false)">
            <i class="el-icon-close" />
          </button>
        </div>
      </div>

      <div v-if="item" class="rdd__body">
        <!-- 基础信息 -->
        <section class="rdd__section">
          <h4 class="rdd__section-title">基础信息</h4>
          <div class="rdd__tiles">
            <div v-for="row in baseRows" :key="row.label" class="rdd__tile" :class="{ 'is-full': row.full }">
              <span class="rdd__tile-label">{{ row.label }}</span>
              <span
                class="rdd__tile-value"
                :class="{ 'rdd__tile-value--mono': row.mono }"
                :title="row.value"
              >{{ row.value }}</span>
            </div>
          </div>
        </section>

        <!-- 资源配置 -->
        <section class="rdd__section">
          <h4 class="rdd__section-title">资源配置</h4>
          <div class="rdd__tiles rdd__tiles--3">
            <div class="rdd__tile">
              <span class="rdd__tile-label">CPU</span>
              <span class="rdd__tile-value">{{ cpuText }}</span>
            </div>
            <div class="rdd__tile">
              <span class="rdd__tile-label">Memory</span>
              <span class="rdd__tile-value">{{ memoryText }}</span>
            </div>
            <div class="rdd__tile">
              <span class="rdd__tile-label">Machine Type</span>
              <span class="rdd__tile-value">{{ machineType }}</span>
            </div>
          </div>
        </section>

        <!-- 指标详情 -->
        <section class="rdd__section">
          <h4 class="rdd__section-title">指标详情</h4>
          <div v-if="metricBlocks.length === 0" class="rdd__empty">该资源暂无指标数据</div>

          <div v-for="block in metricBlocks" :key="block.rawName" class="rdd__metric">
            <div class="rdd__metric-head">
              <span class="rdd__metric-name">{{ block.name }}</span>
              <span class="rdd__metric-tag" :style="{ color: block.code.color, background: block.code.bg }">
                {{ block.code.label }}
              </span>
            </div>

            <!-- avg/min/max/p99：单行四格统计 -->
            <div v-if="block.isStats" class="rdd__stat-row">
              <div v-for="cell in block.cells" :key="cell.label" class="rdd__stat-cell">
                <span class="rdd__stat-value">{{ cell.value }}</span>
                <span class="rdd__stat-label">{{ cell.label }}</span>
              </div>
            </div>

            <!-- 其它指标：字段横向成行 -->
            <div v-else class="rdd__kv">
              <div v-for="row in block.kvRows" :key="row.label" class="rdd__kv-row">
                <span class="rdd__row-label">{{ row.label }}</span>
                <span class="rdd__row-value" :class="{ 'rdd__row-value--mono': row.mono }">{{ row.value }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </el-drawer>
</template>

<script>
import {
  getResourceStatus,
  getStatusInfo,
  getMetricName,
  isUsageLikeMetric,
  formatNumber,
  machineTypeLabel
} from '../utils'

export default {
  name: 'ResourceDetailDrawer',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    item: {
      type: Object,
      default: null
    }
  },
  computed: {
    hostname() {
      return (this.item && this.item.hostname) || '--'
    },
    component() {
      return (this.item && this.item.component) || '--'
    },
    status() {
      return getResourceStatus(this.item ? this.item.inspect_data : null)
    },
    cpuText() {
      const v = this.item && this.item.cpu
      if (v === undefined || v === null || v === '') return '--'
      return `${v} Core`
    },
    memoryText() {
      const v = this.item && this.item.memory
      if (v === undefined || v === null || v === '') return '--'
      return `${v} GB`
    },
    machineType() {
      return machineTypeLabel(this.item ? this.item.mtype : undefined)
    },
    baseRows() {
      const it = this.item || {}
      const def = (v) => (v === undefined || v === null || v === '' ? '--' : v)
      return [
        { label: 'Hostname', value: def(it.hostname), mono: true },
        { label: 'IP', value: def(it.ip), mono: true },
        { label: 'IDC', value: def(it.idc) },
        { label: '网络区域', value: def(it.net_zone_code) },
        { label: 'OS', value: def(it.os), full: true },
        { label: 'SN', value: def(it.sn), mono: true, full: true }
      ]
    },
    metricBlocks() {
      const inspect = this.item ? this.item.inspect_data : null
      if (!inspect || typeof inspect !== 'object') return []
      return Object.keys(inspect).map((rawName) => {
        const m = inspect[rawName]
        const code = getStatusInfo(m ? m.code : undefined)
        const isStats = isUsageLikeMetric(m)
        const block = {
          rawName: rawName,
          name: getMetricName(rawName),
          code: { label: code.label, color: code.color, bg: code.color + '1a' },
          isStats: isStats
        }
        if (isStats) {
          const pct = (v) => (v === undefined || v === null || v === '' ? '--' : `${formatNumber(v)}%`)
          block.cells = [
            { label: 'Avg', value: pct(m.avg) },
            { label: 'Min', value: pct(m.min) },
            { label: 'Max', value: pct(m.max) },
            { label: 'P99', value: pct(m.p99) }
          ]
        } else {
          const kvRows = []
          Object.keys(m || {}).forEach((k) => {
            let value = m[k]
            if (k === 'code') {
              value = getStatusInfo(value).label
            } else if (typeof value === 'number') {
              value = formatNumber(value)
            } else if (value === undefined || value === null || value === '') {
              value = '--'
            }
            const labelMap = { usage: '使用率', AvailableSize: '可用空间', TotalSize: '总空间' }
            kvRows.push({ label: labelMap[k] || k, value: value, mono: typeof m[k] === 'string' })
          })
          block.kvRows = kvRows
        }
        return block
      })
    }
  }
}
</script>

<style lang="scss" scoped>
$bg: #f5f7fa;
$card: #fff;
$border: #ebeef5;

.rdd {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $bg;

  /* ===== 头部 ===== */
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
    background: $card;
    border-bottom: 1px solid $border;
    flex-shrink: 0;
  }

  &__head-main {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  &__hostname {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__component {
    margin: 0;
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__head-side {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  // 整体状态徽章
  &__status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  &__status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: #909399;
    font-size: 15px;
    cursor: pointer;

    &:hover {
      background: $bg;
      color: #303133;
    }
  }

  /* ===== 内容区（紧凑排布，避免滚动） ===== */
  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px 16px;
  }

  &__section {
    margin-top: 14px;

    &:first-child {
      margin-top: 0;
    }
  }

  &__section-title {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: #606266;
  }

  /* 瓦片网格 */
  &__tiles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    &--3 {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  &__tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 8px 12px;
    background: $card;
    border: 1px solid $border;
    border-radius: 8px;

    &.is-full {
      grid-column: 1 / -1;
    }
  }

  &__tile-label {
    font-size: 11px;
    color: #909399;
  }

  &__tile-value {
    font-size: 13px;
    color: #303133;
    word-break: break-all;
    line-height: 1.45;

    &--mono {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
  }

  /* 指标卡 */
  &__metric {
    margin-bottom: 8px;
    padding: 10px 14px 12px;
    background: $card;
    border: 1px solid $border;
    border-radius: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__metric-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__metric-name {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  &__metric-tag {
    padding: 0 8px;
    font-size: 11px;
    border-radius: 10px;
    line-height: 18px;
  }

  // 单行四格统计：数值 + 标签
  &__stat-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  &__stat-cell {
    text-align: center;
    border-radius: 6px;
    background: #fafbfd;
    padding: 6px 2px;
  }

  &__stat-value {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    line-height: 1.3;
  }

  &__stat-label {
    display: block;
    margin-top: 1px;
    font-size: 11px;
    color: #909399;
  }

  // 键值型指标：横向成行
  &__kv-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 3px 0;
    font-size: 12px;
  }

  &__row-label {
    color: #909399;
    flex-shrink: 0;
  }

  &__row-value {
    color: #303133;
    text-align: right;
    word-break: break-all;

    &--mono {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
  }

  &__empty {
    padding: 20px 0;
    text-align: center;
    color: #909399;
    font-size: 13px;
    background: $card;
    border: 1px dashed $border;
    border-radius: 8px;
  }
}
</style>
