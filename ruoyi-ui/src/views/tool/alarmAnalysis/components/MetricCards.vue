<template>
  <div class="mc">
    <div
      v-for="(group, gi) in groups"
      :key="group.name"
      class="mc__group"
      :class="{ 'is-first': gi === 0 }"
      :style="{ flexGrow: Math.max(1, group.metrics.length) }"
    >
      <!-- 分组标签：把 P1 / P2 … 区分开，同时所有指标仍挤在同一行 -->
      <span class="mc__tag" :title="group.name">{{ group.name }}</span>

      <div class="mc__items">
        <div
          v-for="(metric, mi) in group.metrics"
          :key="metric.key"
          class="mc__item"
          :class="{ 'is-first': mi === 0 }"
        >
          <div class="mc__value" :class="'is-' + metric.tone">{{ metric.display }}</div>
          <div class="mc__label" :title="metric.key">{{ metric.key }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MetricCards',
  props: {
    // [ { name: 'P1', metrics: [ { key, value, display, tone } ] } ] —— 由 shape.js 的 buildSections 产出
    groups: {
      type: Array,
      default: () => []
    }
  }
}
</script>

<style lang="scss" scoped>
$divider: #e4e7ed;
$divider-weak: #f0f2f5;

.mc {
  display: flex;
  flex-wrap: nowrap; // 指标强制一行，任何时候都不换行
  align-items: stretch;
  width: 100%;
  // 兜底：指标实在太多时横向滚动，既不换行也不裁掉数据（正常情况下用不到）
  overflow-x: auto;
  overflow-y: hidden;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 2px;
  }
}

/* 一组指标（P1 / P2 …）：标签 + 指标们 */
.mc__group {
  position: relative;
  display: flex;
  align-items: stretch;
  // flex-grow 由模板按「本组指标条数」内联设置：这样剩余空间按条数分配，
  // 每条指标的宽度大致相等，不会出现「P2 只有 2 项、却和 P1 平分宽度」导致 P2 被拉得很空
  flex: 0 1 auto;
  min-width: 0; // 空间不足时优先压缩，而不是把整行撑破
  padding-right: 14px;

  // 组与组之间：比组内分割线更明显的一条竖线
  &:not(.is-first) {
    padding-left: 14px;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      width: 1px;
      height: 34px;
      margin-top: -17px;
      background: $divider;
    }
  }
}

/* 分组标签 chip：小圆角浅蓝底，一眼区分 P1 / P2 */
.mc__tag {
  flex: none;
  align-self: center;
  margin-right: 12px;
  padding: 1px 7px;
  border: 1px solid #d9ecff;
  border-radius: 9px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.mc__items {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
}

.mc__item {
  position: relative;
  flex: 1 1 auto; // 宽度按内容自适应，剩余空间均分
  min-width: 0;
  padding: 0 7px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  // 组内第一条不要分割线（组标签和它之间已经有间距了）
  &.is-first {
    padding-left: 0;

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
    background: $divider-weak;
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
