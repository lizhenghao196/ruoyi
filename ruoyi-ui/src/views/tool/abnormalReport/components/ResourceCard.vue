<template>
  <div class="res-card">
    <!-- ===== 头部：hostname + 整体异常级别 ===== -->
    <div class="res-card__head">
      <div class="res-card__host" :title="hostname">
        <i :class="['res-card__host-icon', categoryIcon]" />
        <span class="res-card__hostname">{{ hostname }}</span>
      </div>
      <span class="res-card__status" :class="`is-${status.key}`">
        <i class="res-card__status-dot" />
        {{ status.label }}
      </span>
    </div>

    <!-- ===== 基础标签：component / idc / ip ===== -->
    <div class="res-card__tags">
      <span class="res-card__tag">{{ component }}</span>
      <span class="res-card__tag">{{ idc }}</span>
    </div>
    <p class="res-card__ip">
      <span class="res-card__ip-label">IP</span>
      <span class="res-card__ip-value">{{ ip }}</span>
    </p>

    <!-- ===== 指标区：动态渲染 inspect_data ===== -->
    <div class="res-card__metrics">
      <div v-for="metric in metrics" :key="metric.name" class="res-metric">
        <div class="res-metric__top">
          <span class="res-metric__name" :title="metric.rawName">{{ metric.name }}</span>
          <span class="res-metric__value" :style="{ color: metric.color }">
            {{ metric.valueText }}
          </span>
        </div>

        <el-progress
          class="res-metric__bar"
          :percentage="metric.percent"
          :stroke-width="6"
          :show-text="false"
          :color="metric.color"
        />

        <!-- 百分比指标：Max / P99 -->
        <div v-if="metric.usageLike" class="res-metric__meta">
          <span>Max {{ metric.maxText }}</span>
          <span>P99 {{ metric.p99Text }}</span>
        </div>

        <!-- 磁盘类指标：可用空间 -->
        <div v-else-if="metric.availText !== '--'" class="res-metric__meta">
          <span>可用空间 {{ metric.availText }}</span>
        </div>
      </div>
    </div>

    <!-- ===== 底部：资源配置 + 详情 ===== -->
    <div class="res-card__foot">
      <div class="res-card__specs">
        <span class="res-card__spec">CPU {{ cpuText }}</span>
        <span class="res-card__spec">Memory {{ memoryText }}</span>
      </div>
      <button type="button" class="res-card__detail" @click="$emit('view-detail', item)">
        查看详情
        <i class="el-icon-arrow-right" />
      </button>
    </div>
  </div>
</template>

<script>
import {
  getResourceStatus,
  getStatusInfo,
  getMetricName,
  isUsageLikeMetric,
  isFsLikeMetric,
  getMetricCoreValue,
  formatNumber,
  clampPercent,
  getCategoryIcon
} from '../utils'

export default {
  name: 'ResourceCard',
  props: {
    // 单台异常资源对象
    item: {
      type: Object,
      default: () => ({})
    },
    // 所属分类名（HADOOP / 应用 / ...），用于头部图标
    category: {
      type: String,
      default: ''
    }
  },
  computed: {
    hostname() {
      return this.item.hostname || '--'
    },
    component() {
      return this.item.component || '--'
    },
    idc() {
      return this.item.idc || '--'
    },
    ip() {
      return this.item.ip || '--'
    },
    cpuText() {
      const v = this.item.cpu
      if (v === undefined || v === null || v === '') return '--'
      return `${v} Core`
    },
    memoryText() {
      const v = this.item.memory
      if (v === undefined || v === null || v === '') return '--'
      return `${v} GB`
    },
    categoryIcon() {
      return getCategoryIcon(this.category)
    },
    status() {
      return getResourceStatus(this.item.inspect_data)
    },
    // 指标展示列表：统一转成便于模板渲染的结构
    metrics() {
      const inspect = this.item.inspect_data
      if (!inspect || typeof inspect !== 'object') return []
      return Object.keys(inspect).map((rawName) => {
        const m = inspect[rawName]
        const codeInfo = getStatusInfo(m ? m.code : undefined)
        const usageLike = isUsageLikeMetric(m)
        const fsLike = isFsLikeMetric(m)
        const core = getMetricCoreValue(m)
        return {
          rawName: rawName,
          name: getMetricName(rawName),
          usageLike: usageLike,
          code: codeInfo,
          color: codeInfo.color,
          valueText: core === null ? '--' : `${formatNumber(core)}%`,
          percent: clampPercent(core),
          maxText: usageLike ? `${formatNumber(m.max)}%` : '--',
          p99Text: usageLike ? `${formatNumber(m.p99)}%` : '--',
          availText: fsLike ? formatNumber(m.AvailableSize) : '--'
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.res-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px 18px;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__host {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__host-icon {
    color: #409eff;
    font-size: 16px;
    flex-shrink: 0;
  }

  &__hostname {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    flex-shrink: 0;

    &.is-danger {
      color: #f56c6c;
    }
    &.is-warning {
      color: #e6a23c;
    }
    &.is-normal {
      color: #67c23a;
    }
  }

  &__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  &__tag {
    padding: 1px 8px;
    font-size: 12px;
    color: #606266;
    background: #f5f7fa;
    border-radius: 4px;
    line-height: 18px;
  }

  &__ip {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 8px 0 0;
    font-size: 13px;
  }

  &__ip-label {
    color: #909399;
  }

  &__ip-value {
    color: #606266;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }

  &__metrics {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #ebeef5;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #f2f3f5;
  }

  &__specs {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  &__spec {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
  }

  // 查看详情：柔和浅蓝胶囊按钮
  &__detail {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    height: 28px;
    padding: 0 14px;
    font-size: 12px;
    color: #409eff;
    background: #ecf5ff;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    outline: none;
    transition: all 0.2s ease;

    i {
      font-size: 12px;
      transition: transform 0.2s ease;
    }

    &:hover {
      color: #fff;
      background: #409eff;
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

.res-metric {
  &__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  &__name {
    font-size: 13px;
    color: #606266;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__value {
    font-size: 15px;
    font-weight: 600;
    flex-shrink: 0;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 12px;
    color: #909399;
  }

  &__bar {
    width: 100%;
  }
}
</style>
