<template>
  <div class="ex-overview">
    <div v-for="stat in stats" :key="stat.name" class="ex-overview__item">
      <i :class="['ex-overview__icon', stat.icon]" :style="iconStyle(stat)" />
      <div class="ex-overview__text">
        <b class="ex-overview__count" :style="{ color: stat.color }">{{ stat.count }}</b>
        <span class="ex-overview__label" :title="stat.label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExceptionOverview',
  props: {
    // [{ name, label, count, icon, color }]
    stats: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    iconStyle(stat) {
      const color = stat.color || '#909399'
      return { color: color, background: color + '1a' }
    }
  }
}
</script>

<style lang="scss" scoped>
.ex-overview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    font-size: 16px;
    flex-shrink: 0;
  }

  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__count {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__label {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }
}
</style>
