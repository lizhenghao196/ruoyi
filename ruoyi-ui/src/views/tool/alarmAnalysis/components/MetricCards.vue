<template>
  <div class="mc">
    <div v-for="metric in metrics" :key="metric.key" class="mc__item">
      <div class="mc__value" :class="'is-' + metric.tone">{{ metric.value }}</div>
      <div class="mc__label" :title="metric.key">{{ metric.key }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MetricCards',
  props: {
    // P1: { 指标名: 值 }
    metricsData: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    metrics() {
      const data = this.metricsData || {}
      return Object.keys(data).map((key) => {
        const raw = data[key]
        const empty = raw === undefined || raw === null || raw === ''
        // 无值（含空串）或 0（含 0.0%）算作「没有数据」：灰色弱化，但仍然展示
        const num = Number(String(raw).replace('%', ''))
        const isZero = !empty && !isNaN(num) && num === 0
        return {
          key: key,
          value: empty ? '-' : raw,
          tone: empty || isZero ? 'muted' : 'active'
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.mc {
  display: flex;
  flex-wrap: nowrap; // 13 个指标强制一行，任何时候都不换行
  align-items: stretch;
  width: 100%;
}

.mc__item {
  position: relative;
  flex: 1 1 auto; // 宽度按内容自适应，剩余空间均分
  min-width: 0; // 空间不足时优先压缩，而不是把整行撑破
  padding: 0 7px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  &:first-child {
    padding-left: 0;

    // 首个指标左侧不要分割线
    &::before {
      display: none;
    }
  }

  // 极淡的竖向分割线：26px 高，不贯穿整个区域
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 1px;
    height: 26px;
    margin-top: -13px;
    background: #f0f2f5;
  }
}

.mc__value {
  font-size: 19px;
  font-weight: 500;
  line-height: 1.2;
  color: #86909c; // 无值 / 0：灰色弱化
  white-space: nowrap;

  // 有值：主题蓝
  &.is-active {
    font-weight: 600;
    color: #409eff;
  }
}

.mc__label {
  margin-top: 5px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  color: #86909c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
