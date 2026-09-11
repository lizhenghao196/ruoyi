<template>
  <section class="rr">
    <!-- ===== 头部：标题 + 上一个版本 → 当前版本 对比 ===== -->
    <div class="rr__header">
      <div class="rr__title">
        <i class="el-icon-sort rr__title-icon" />
        环比差异
        <span v-if="changedCount > 0" class="rr__badge">共 {{ changedCount }} 台发生变化</span>
      </div>

      <div class="rr__summary">
        <span class="rr__version">
          <span class="rr__version-label">上一个版本</span>
          <b class="rr__version-value">
            {{ versionText(data.previous) }}<em v-if="data.previous !== null" class="rr__version-unit">台</em>
          </b>
        </span>

        <i class="el-icon-right rr__version-arrow" />

        <span class="rr__version">
          <span class="rr__version-label">当前版本</span>
          <b class="rr__version-value">
            {{ versionText(data.current) }}<em v-if="data.current !== null" class="rr__version-unit">台</em>
          </b>
        </span>

        <span v-if="trend" class="rr__delta" :class="'is-' + trend.key" :title="trend.tip">
          <i :class="trend.icon" />
          <b>{{ trend.text }}</b>
          <em v-if="trend.percent">{{ trend.percent }}</em>
        </span>
      </div>
    </div>

    <!-- ===== 环比减少 / 环比新增 ===== -->
    <div class="rr__panels">
      <div class="rr-panel is-down">
        <div class="rr-panel__head">
          <span class="rr-panel__icon"><i class="el-icon-bottom" /></span>
          <span class="rr-panel__name">环比减少</span>
          <span class="rr-panel__count">{{ data.decreased.length }} 台</span>
        </div>

        <ul v-if="data.decreased.length > 0" class="rr-panel__list">
          <li
            v-for="(row, index) in data.decreased"
            :key="'down-' + index"
            class="rr-row is-inline"
          >
            <span v-if="row.hostname" class="rr-row__host">{{ row.hostname }}</span>
            <span class="rr-row__ip">{{ plain(row.ip) }}</span>
            <span v-if="row.idc" class="rr-row__tag">{{ row.idc }}</span>
          </li>
        </ul>

        <!-- 环比减少可能整体缺失 -->
        <p v-else class="rr-panel__empty">暂无环比减少</p>
      </div>

      <div class="rr-panel is-up">
        <div class="rr-panel__head">
          <span class="rr-panel__icon"><i class="el-icon-top" /></span>
          <span class="rr-panel__name">环比新增</span>
          <span class="rr-panel__count">{{ data.increased.length }} 台</span>
        </div>

        <ul v-if="data.increased.length > 0" class="rr-panel__list">
          <li
            v-for="(row, index) in data.increased"
            :key="'up-' + index"
            class="rr-row is-action"
            @click="$emit('view-detail', row)"
          >
            <div class="rr-row__body">
              <span class="rr-row__host" :title="plain(row.hostname)">{{ plain(row.hostname) }}</span>
              <div class="rr-row__meta">
                <span class="rr-row__ip">{{ plain(row.ip) }}</span>
                <span v-if="row.idc" class="rr-row__tag">{{ row.idc }}</span>
                <span v-if="row.component" class="rr-row__tag">{{ row.component }}</span>
              </div>
              <div v-if="specText(row)" class="rr-row__spec">{{ specText(row) }}</div>
            </div>

            <!-- 与点击整行等效，同时提供键盘可达的入口 -->
            <button
              type="button"
              class="rr-row__detail"
              title="查看资源详情"
              @click.stop="$emit('view-detail', row)"
            >
              查看详情
              <i class="el-icon-arrow-right" />
            </button>
          </li>
        </ul>

        <!-- 环比新增可能整体缺失 -->
        <p v-else class="rr-panel__empty">暂无环比新增</p>
      </div>
    </div>
  </section>
</template>

<script>
import { normalizeRingRatio, formatNumber, machineTypeLabel } from '../utils'

export default {
  name: 'RingRatioDiff',
  props: {
    // { 总结: { 上一个版本, 当前版本 }, 环比减少: [ { ip, idc } ], 环比新增: [ 资源对象 ] }
    diff: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    data() {
      return normalizeRingRatio(this.diff)
    },
    changedCount() {
      return this.data.decreased.length + this.data.increased.length
    },
    // 当前版本相对上一个版本的变化，无总结数据时为 null
    trend() {
      const delta = this.data.delta
      if (delta === null) return null
      if (delta === 0) {
        return { key: 'flat', icon: 'el-icon-minus', text: '持平', percent: '', tip: '较上一个版本无变化' }
      }
      const down = delta < 0
      const abs = Math.abs(delta)
      const previous = this.data.previous
      return {
        key: down ? 'down' : 'up',
        icon: down ? 'el-icon-bottom' : 'el-icon-top',
        text: `${abs} 台`,
        percent: previous > 0 ? `${((abs / previous) * 100).toFixed(1)}%` : '',
        tip: `较上一个版本${down ? '减少' : '增加'} ${abs} 台`
      }
    }
  },
  methods: {
    plain(value) {
      return value === undefined || value === null || value === '' ? '--' : value
    },
    versionText(value) {
      return value === null ? '--' : value
    },
    // 新增资源的配置摘要：64 Core · 512 GB · 物理机
    specText(row) {
      const parts = []
      const has = (v) => v !== undefined && v !== null && v !== ''
      if (has(row.cpu)) parts.push(`${formatNumber(row.cpu, 0)} Core`)
      if (has(row.memory)) parts.push(`${formatNumber(row.memory, 0)} GB`)
      if (row.mtype) parts.push(machineTypeLabel(row.mtype))
      return parts.join(' · ')
    }
  }
}
</script>

<style lang="scss" scoped>
$card: #fff;
$border: #ebeef5;
$text-main: #303133;
$text-sub: #909399;
$success: #67c23a;
$warning: #e6a23c;
$primary: #409eff;

.rr {
  background: $card;
  border: 1px solid $border;
  border-radius: 8px;
  padding: 18px 20px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 20px;
    margin-bottom: 14px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 600;
    color: $text-main;
  }

  &__title-icon {
    color: $primary;
  }

  &__badge {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: $text-sub;
  }

  &__summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  &__version {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  &__version-label {
    font-size: 12px;
    color: $text-sub;
  }

  &__version-value {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    color: $text-main;
  }

  &__version-unit {
    margin-left: 2px;
    font-size: 11px;
    font-style: normal;
    font-weight: 400;
    color: $text-sub;
  }

  &__version-arrow {
    font-size: 13px;
    color: #c0c4cc;
  }

  // 环比变化徽章：减少=好转（绿）、增加=恶化（橙）、持平（灰）
  &__delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 10px;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 600;

    i {
      font-size: 12px;
    }

    em {
      font-style: normal;
      font-size: 11px;
      font-weight: 400;
      opacity: 0.85;
    }

    &.is-down {
      color: $success;
      background: rgba(103, 194, 58, 0.12);
    }

    &.is-up {
      color: $warning;
      background: rgba(230, 162, 60, 0.12);
    }

    &.is-flat {
      color: $text-sub;
      background: #f4f4f5;
    }
  }

  &__panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 16px;
  }
}

.rr-panel {
  display: flex;
  flex-direction: column;
  background: #fafbfd;
  border: 1px solid $border;
  border-radius: 8px;
  padding: 12px 14px;

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    font-size: 12px;
    flex-shrink: 0;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  &__count {
    margin-left: auto;
    font-size: 12px;
    color: $text-sub;
  }

  &.is-down &__icon {
    color: $success;
    background: rgba(103, 194, 58, 0.12);
  }

  &.is-up &__icon {
    color: $warning;
    background: rgba(230, 162, 60, 0.12);
  }

  // 清单过长时内部滚动，避免挤压下方模块
  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 84px;
    margin: 0;
    font-size: 12px;
    color: #c0c4cc;
  }
}

.rr-row {
  padding: 8px 10px;
  border-top: 1px dashed $border;

  &:first-child {
    border-top: none;
  }

  // 新增清单左侧内容区
  &__body {
    flex: 1;
    min-width: 0;
  }

  &__host {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: $text-main;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__ip {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 13px;
    color: #606266;
  }

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  &__tag {
    padding: 0 8px;
    font-size: 12px;
    line-height: 18px;
    color: #606266;
    background: #eef1f6;
    border-radius: 4px;
  }

  &__spec {
    margin-top: 4px;
    font-size: 12px;
    color: $text-sub;
  }

  // 减少清单以 IP 为主信息，颜色提升一档
  .is-down &__ip {
    color: $text-main;
  }

  // 减少清单字段少，单行展示：IP 在左、机房靠右
  &.is-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .rr-row__tag {
      margin-left: auto;
      flex-shrink: 0;
    }
  }

  // 新增清单可点击查看详情
  &.is-action {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: background 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      background: $card;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);

      .rr-row__host {
        color: $primary;
      }
    }
  }

  // 查看详情：与 Card 内同款浅蓝胶囊按钮，尺寸更紧凑
  &__detail {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    height: 24px;
    padding: 0 10px;
    font-size: 12px;
    color: $primary;
    background: #ecf5ff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    outline: none;
    transition: all 0.2s ease;

    i {
      font-size: 12px;
      transition: transform 0.2s ease;
    }

    &:hover,
    &:focus-visible {
      color: $card;
      background: $primary;
      box-shadow: 0 4px 10px rgba(64, 158, 255, 0.35);

      i {
        transform: translateX(2px);
      }
    }

    &:active {
      transform: scale(0.97);
    }
  }
}
</style>
