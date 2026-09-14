<template>
  <section class="cs" :class="{ 'is-collapsed': collapsed }">
    <div
      class="cs__head"
      role="button"
      :title="collapsed ? '展开' : '收起'"
      @click="$emit('toggle')"
    >
      <i v-if="icon" :class="['cs__icon', icon]" />
      <span class="cs__title">{{ title }}</span>
      <span v-if="badge" class="cs__badge">{{ badge }}</span>
      <i :class="['cs__caret', 'el-icon-arrow-down', { 'is-collapsed': collapsed }]" />
    </div>

    <!-- 用 v-if 而不是 v-show：收起时卸载表格，展开时重新挂载，避免 el-table 在
         隐藏容器里算出的列宽/滚动条残留。tab 选中态由父组件保存，不受影响 -->
    <div v-if="!collapsed" class="cs__body">
      <slot />
    </div>
  </section>
</template>

<script>
export default {
  name: 'CollapseSection',
  props: {
    title: {
      type: String,
      default: ''
    },
    icon: {
      type: String,
      default: ''
    },
    badge: {
      type: String,
      default: ''
    },
    collapsed: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="scss" scoped>
$card: #fff;
$border: #ebeef5;
$text-main: #303133;
$text-sub: #909399;

.cs {
  background: $card;
  border: 1px solid $border;
  border-radius: 8px;
  padding: 0 20px 4px;
  margin-bottom: 16px;
  transition: background 0.2s ease;

  &.is-collapsed {
    background: #fafbfd;
    padding-bottom: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 8px;
    margin: 0 -8px;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease;

    &:hover {
      background: #f5f7fa;
    }
  }

  &__icon {
    color: #409eff;
    font-size: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: $text-main;
  }

  &__badge {
    font-size: 12px;
    color: $text-sub;
  }

  &__caret {
    margin-left: auto;
    color: #909399;
    font-size: 13px;
    transition: transform 0.2s ease;
    flex-shrink: 0;

    &.is-collapsed {
      transform: rotate(-90deg);
    }
  }

  &__body {
    padding-bottom: 16px;
  }
}
</style>
