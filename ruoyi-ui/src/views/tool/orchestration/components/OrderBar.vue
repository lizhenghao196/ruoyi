<template>
  <section class="order-bar">
    <header class="order-bar__head">
      <span class="order-bar__title">
        <span class="order-bar__icon"><svg-icon icon-class="form" /></span>
        工单
      </span>
      <el-select
        class="order-bar__select"
        size="mini"
        :value="activeOrderId"
        placeholder="请选择工单"
        @change="$emit('order-change', $event)"
      >
        <el-option
          v-for="item in orders"
          :key="item.orderId"
          :label="item.orderId"
          :value="item.orderId"
        >
          <span class="order-option">
            <span class="order-option__name">{{ item.orderId }}</span>
            <span class="order-option__meta">{{ item.systemId }}</span>
          </span>
        </el-option>
      </el-select>
    </header>

    <div v-if="order" class="order-bar__body">
      <div class="order-bar__name" :title="order.planName">{{ order.planName }}</div>

      <div class="order-bar__tags">
        <span class="order-tag" :class="statusClass">{{ order.status }}</span>
        <span class="order-tag is-plain">{{ order.systemId }}</span>
        <span class="order-tag is-plain">{{ order.executeUserName }}</span>
      </div>

      <ul class="order-bar__info">
        <li class="is-wide">
          <span>实施窗口</span>
          <b :title="order.window">{{ order.window }}</b>
        </li>
        <li>
          <span>原子进度</span>
          <b>{{ order.successAtom }} / {{ order.totalAtom }}</b>
        </li>
        <li>
          <span>已编排</span>
          <b>{{ places.length }} 处</b>
        </li>
      </ul>

      <div class="order-bar__progress">
        <span class="order-bar__progress-bar" :style="{ width: progress + '%' }" />
      </div>

      <!-- 该工单的原子落在哪些环境：点击直接切换过去 -->
      <div v-if="envPlaces.length" class="order-bar__envs">
        <button
          v-for="item in envPlaces"
          :key="item.envKey"
          type="button"
          class="env-place"
          :class="{ 'is-active': item.envKey === activeEnv }"
          :title="item.envName + ' 下有 ' + item.count + ' 个该工单的原子'"
          @click="$emit('locate', item.envKey)"
        >
          <span class="env-place__name">{{ item.envName }}</span>
          <span class="env-place__count">{{ item.count }}</span>
        </button>
      </div>
      <p v-else class="order-bar__none">该工单的原子尚未编排到任何流程节点</p>

      <p class="order-bar__reason" :title="order.reason">{{ order.reason }}</p>
    </div>

    <div v-else class="order-bar__empty">暂未选择工单</div>
  </section>
</template>

<script>
import { ORDER_STATUS_CLASS } from '../constants'

export default {
  name: 'OrderBar',
  props: {
    orders: {
      type: Array,
      default: () => []
    },
    activeOrderId: {
      type: String,
      default: ''
    },
    // 该工单的原子在各环境上的分布（[{ envKey, envName, count }]）
    envPlaces: {
      type: Array,
      default: () => []
    },
    // 该工单的原子在流程节点上的出现位置总数
    places: {
      type: Array,
      default: () => []
    },
    activeEnv: {
      type: String,
      default: ''
    }
  },
  computed: {
    order() {
      return this.orders.find(item => item.orderId === this.activeOrderId) || null
    },
    statusClass() {
      return (this.order && ORDER_STATUS_CLASS[this.order.status]) || 'is-default'
    },
    progress() {
      const total = this.order.totalAtom || 0
      if (!total) {
        return 0
      }
      return Math.min(100, Math.round((this.order.successAtom / total) * 100))
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.order-bar {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 336px;
  @include panel;

  &__head {
    justify-content: space-between;
    @include panel-head;
  }

  &__title {
    @include panel-title;
  }

  &__icon {
    @include panel-icon;
  }

  &__select {
    width: 186px;

    ::v-deep .el-input__inner {
      height: 28px;
      line-height: 28px;
      border-color: var(--orch-border);
      border-radius: 8px;
      background: #fff;
      font-size: 12px;
      color: var(--orch-text);
    }

    ::v-deep .el-input__icon {
      line-height: 28px;
    }
  }

  &__body {
    flex: 1;
    min-height: 0;
    padding: 12px 14px;
    overflow: auto;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: var(--orch-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__tags {
    display: flex;
    align-items: center;
    margin-top: 8px;
    gap: 6px;
  }

  // 两列排布，压缩面板高度，避免顶部区域留白过多
  &__info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 9px 0 0;
    padding: 0;
    list-style: none;
    gap: 0 16px;

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      font-size: 12px;
      line-height: 22px;
    }

    .is-wide {
      grid-column: 1 / -1;
    }

    span {
      flex: none;
      color: var(--orch-text-3);
    }

    b {
      margin-left: 10px;
      font-weight: 500;
      color: var(--orch-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__progress {
    height: 5px;
    margin-top: 7px;
    border-radius: 3px;
    background: #eef2f8;
    overflow: hidden;
  }

  &__progress-bar {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #60a5fa, var(--orch-accent));
    transition: width 0.3s ease;
  }

  &__envs {
    display: flex;
    flex-wrap: wrap;
    margin-top: 9px;
    gap: 6px;
  }

  &__none {
    margin: 9px 0 0;
    padding: 7px 10px;
    border-radius: 8px;
    background: #f7f9fc;
    font-size: 12px;
    line-height: 18px;
    color: var(--orch-text-3);
  }

  &__reason {
    margin: 8px 0 0;
    padding: 7px 10px;
    border-radius: 8px;
    background: #f7f9fc;
    font-size: 12px;
    line-height: 18px;
    color: var(--orch-text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty {
    margin: 0;
    padding: 20px 14px;
    font-size: 12px;
    color: var(--orch-text-3);
  }
}

.order-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    flex: none;
    margin-left: 12px;
    color: var(--orch-text-3);
    font-size: 11px;
  }
}

.order-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 6px;
  background: #eef2f8;
  color: var(--orch-text-2);
  font-size: 11px;

  &.is-warning {
    background: rgba(245, 158, 11, 0.12);
    color: #b45309;
  }

  &.is-running {
    background: rgba(37, 99, 235, 0.1);
    color: #2563eb;
  }

  &.is-success {
    background: rgba(22, 163, 74, 0.1);
    color: #15803d;
  }

  &.is-plain {
    background: #f4f6fb;
    color: var(--orch-text-3);
  }
}

/* 该工单原子所在的环境：点击切换 */
.env-place {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--orch-border);
  border-radius: 7px;
  background: #f7f9fc;
  cursor: pointer;
  transition: all 0.16s ease;

  &__name {
    font-size: 11px;
    color: var(--orch-text-2);
  }

  &__count {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--orch-accent);
  }

  &:hover {
    border-color: var(--orch-accent);
    background: var(--orch-accent-soft);

    .env-place__name {
      color: var(--orch-accent);
    }
  }

  &.is-active {
    border-color: var(--orch-accent);
    background: var(--orch-accent-soft);
  }
}
</style>
