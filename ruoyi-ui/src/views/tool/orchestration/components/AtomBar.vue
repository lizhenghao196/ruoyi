<template>
  <section class="atom-bar">
    <header class="atom-bar__head">
      <span class="atom-bar__title">
        <span class="atom-bar__icon"><svg-icon icon-class="component" /></span>
        原子
      </span>
      <el-select
        class="atom-bar__select"
        size="mini"
        filterable
        :value="activeAtomId"
        placeholder="选择原子"
        @change="$emit('atom-change', $event)"
      >
        <el-option
          v-for="item in atoms"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        >
          <span class="atom-option">
            <span class="atom-option__name">{{ item.name }}</span>
            <span class="atom-option__meta">{{ item.module }}</span>
          </span>
        </el-option>
      </el-select>
    </header>

    <div v-if="atom" class="atom-bar__body">
      <p class="atom-bar__crumb" :title="orderName">{{ orderName || atom.orderId }}</p>
      <div class="atom-bar__name" :title="atom.name">{{ atom.name }}</div>

      <div class="atom-bar__tags">
        <span class="atom-tag" :class="statusClass">{{ atom.status }}</span>
        <span class="atom-tag is-plain">{{ atom.module }}</span>
        <span class="atom-tag is-plain">{{ atom.idc }}</span>
      </div>

      <div class="atom-bar__summary">
        <span class="atom-bar__summary-label">出现位置</span>
        <span class="atom-bar__summary-value">
          <b>{{ places.length }}</b> 处 · <b>{{ envCount }}</b> 个环境
        </span>
      </div>

      <!-- 该原子出现的位置：点击可直接切换到对应 环境 / 流 / 节点 -->
      <ul v-if="places.length" class="atom-bar__places">
        <li v-for="item in places" :key="item.key">
          <button
            type="button"
            class="place-item"
            :title="item.envName + ' / ' + item.flowName + ' / ' + item.nodeName"
            @click="$emit('locate', item)"
          >
            <span class="place-item__env">{{ item.envName }}</span>
            <span class="place-item__path">{{ item.flowName }} · {{ item.nodeName }}</span>
            <span class="place-item__arrow" />
          </button>
        </li>
      </ul>

      <p v-else class="atom-bar__none">该原子尚未编排到任何流程节点</p>
    </div>

    <div v-else class="atom-bar__empty">暂未选择原子</div>
  </section>
</template>

<script>
import { ATOM_STATUS_CLASS } from '../constants'

export default {
  name: 'AtomBar',
  props: {
    // 可选原子（含已编排与未分配）
    atoms: {
      type: Array,
      default: () => []
    },
    activeAtomId: {
      type: String,
      default: ''
    },
    // 当前选中的原子
    atom: {
      type: Object,
      default: null
    },
    // 当前原子的出现位置（已补齐环境/流/节点名称）
    places: {
      type: Array,
      default: () => []
    },
    orderName: {
      type: String,
      default: ''
    }
  },
  computed: {
    statusClass() {
      return (this.atom && ATOM_STATUS_CLASS[this.atom.status]) || 'is-default'
    },
    envCount() {
      return new Set(this.places.map(item => item.envKey)).size
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.atom-bar {
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
    width: 206px;

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

  &__crumb {
    margin: 0;
    font-size: 11px;
    color: var(--orch-text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__name {
    margin-top: 3px;
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

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 12px;
  }

  &__summary-label {
    color: var(--orch-text-3);
  }

  &__summary-value {
    color: var(--orch-text-2);

    b {
      color: var(--orch-accent);
      font-weight: 600;
    }
  }

  &__places {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    max-height: 78px;
    overflow: auto;
  }

  &__none {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: #f7f9fc;
    font-size: 12px;
    line-height: 18px;
    color: var(--orch-text-3);
  }

  &__empty {
    margin: 0;
    padding: 20px 14px;
    font-size: 12px;
    color: var(--orch-text-3);
  }
}

.atom-option {
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

.atom-tag {
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

.place-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 26px;
  padding: 0 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s ease;

  &__env {
    flex: none;
    height: 18px;
    padding: 0 6px;
    border-radius: 5px;
    background: var(--orch-accent-soft);
    color: var(--orch-accent);
    font-size: 11px;
    line-height: 18px;
  }

  &__path {
    flex: 1;
    min-width: 0;
    margin-left: 8px;
    font-size: 12px;
    color: var(--orch-text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 右侧箭头（纯 css，避免依赖不存在的图标）
  &__arrow {
    flex: none;
    width: 5px;
    height: 5px;
    margin-left: 8px;
    border-top: 1.5px solid var(--orch-text-3);
    border-right: 1.5px solid var(--orch-text-3);
    transform: rotate(45deg);
  }

  &:hover {
    background: var(--orch-accent-soft);

    .place-item__path {
      color: var(--orch-accent);
    }

    .place-item__arrow {
      border-color: var(--orch-accent);
    }
  }
}
</style>
