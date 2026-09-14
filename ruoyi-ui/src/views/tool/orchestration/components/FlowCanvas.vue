<template>
  <section class="flow-canvas">
    <header class="flow-canvas__head">
      <span class="flow-canvas__title">
        <span class="flow-canvas__icon"><svg-icon icon-class="tree" /></span>
        流程节点
      </span>
      <span v-if="flow" class="flow-canvas__sub">
        {{ flow.name }} · {{ flow.nodes.length }} 个节点 · 更新于 {{ flow.updatedAt }}
      </span>
      <span v-else class="flow-canvas__sub">请点击上方任意一个流</span>

      <div v-if="flow" class="flow-canvas__legend">
        <span v-for="item in legend" :key="item.status" class="legend-item">
          <i class="legend-item__dot" :class="'is-' + item.status" />{{ item.text }}
        </span>
        <span v-if="marking" class="legend-item is-match">
          <i class="legend-item__dot is-match" />含所选工单
        </span>
      </div>
    </header>

    <div v-if="flow" class="flow-canvas__body">
      <div class="flow-track">
        <template v-for="(node, index) in flow.nodes">
          <div
            :key="node.id"
            class="flow-node"
            :class="[
              'is-' + node.status,
              {
                'is-active': node.id === activeNodeId,
                'is-match': matchOf(node),
                'is-dim': marking && !matchOf(node)
              }
            ]"
            @click="$emit('node-click', node)"
          >
            <div class="flow-node__top">
              <span class="flow-node__index">{{ index + 1 }}</span>
              <span class="flow-node__type" :class="'type-' + node.type">{{ nodeTypeText(node.type) }}</span>
            </div>
            <div class="flow-node__name" :title="node.name">{{ node.name }}</div>
            <div class="flow-node__foot">
              <span class="flow-node__status">
                <i class="flow-node__status-dot" />{{ nodeStatusText(node.status) }}
              </span>
              <span class="flow-node__owner">{{ node.owner }}</span>
            </div>
            <div class="flow-node__atoms">
              <span class="flow-node__atom-count">原子 {{ node.atomCount || 0 }}</span>
              <span v-if="matchOf(node)" class="flow-node__match">含该工单 {{ matchOf(node) }}</span>
            </div>
          </div>

          <span v-if="index < flow.nodes.length - 1" :key="node.id + '-link'" class="flow-link">
            <i class="flow-link__line" />
            <i class="flow-link__arrow" />
          </span>
        </template>
      </div>
    </div>

    <div v-else class="flow-canvas__empty">
      <span class="flow-canvas__empty-icon"><svg-icon icon-class="tree" /></span>
      <p>选择一个流后，这里会展示该流的节点流程</p>
    </div>
  </section>
</template>

<script>
import { NODE_STATUS_TEXT, NODE_TYPE_TEXT } from '../constants'

export default {
  name: 'FlowCanvas',
  props: {
    flow: {
      type: Object,
      default: null
    },
    activeNodeId: {
      type: String,
      default: ''
    },
    // 所选工单的原子在各节点上的数量（{ 'flowId#nodeId': count }）
    nodeMatches: {
      type: Object,
      default: () => ({})
    },
    // 所选工单是否已编排到某些位置
    marking: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      legend: [
        { status: 'done', text: '已完成' },
        { status: 'running', text: '进行中' },
        { status: 'waiting', text: '待执行' }
      ]
    }
  },
  methods: {
    matchOf(node) {
      return (this.flow && this.nodeMatches[this.flow.id + '#' + node.id]) || 0
    },
    nodeStatusText(status) {
      return NODE_STATUS_TEXT[status] || status
    },
    nodeTypeText(type) {
      return NODE_TYPE_TEXT[type] || type
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.flow-canvas {
  display: flex;
  flex-direction: column;
  min-height: 0;
  @include panel;

  &__head {
    @include panel-head;
  }

  &__title {
    @include panel-title;
  }

  &__icon {
    @include panel-icon;
  }

  &__sub {
    margin-left: 10px;
    @include panel-sub;
  }

  &__legend {
    display: flex;
    align-items: center;
    margin-left: auto;
    gap: 14px;
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 20px 16px;
    overflow: auto;
    background-image: radial-gradient(rgba(15, 23, 42, 0.055) 1px, transparent 1px);
    background-size: 18px 18px;
  }

  &__empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    color: var(--orch-text-3);
    font-size: 12px;

    p {
      margin: 10px 0 0;
    }
  }

  &__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #f2f5fa;
    font-size: 20px;
    color: #b7c2d3;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--orch-text-3);

  &__dot {
    width: 6px;
    height: 6px;
    margin-right: 5px;
    border-radius: 50%;
    background: #cbd5e1;

    &.is-done {
      background: #16a34a;
    }

    &.is-running {
      background: #2563eb;
    }

    &.is-match {
      background: var(--orch-accent);
      box-shadow: 0 0 0 3px var(--orch-accent-soft);
    }
  }

  &.is-match {
    color: var(--orch-accent);
  }
}

.flow-track {
  display: flex;
  align-items: center;
  min-width: min-content;
  // 节点较少时纵向居中；内容超出高度时 auto 归零，不会裁掉顶部
  margin: auto 0;
}

.flow-node {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: none;
  width: 158px;
  padding: 11px 12px 10px;
  border: 1px solid var(--orch-border);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.18s ease;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    background: #f2f5fa;
    color: var(--orch-text-3);
    font-size: 11px;
    font-weight: 600;
  }

  &__type {
    height: 18px;
    padding: 0 6px;
    border-radius: 5px;
    font-size: 11px;
    line-height: 18px;
    background: #eef2f8;
    color: var(--orch-text-2);

    &.type-auto {
      background: rgba(37, 99, 235, 0.09);
      color: #2563eb;
    }

    &.type-manual {
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
    }

    &.type-approve {
      background: rgba(124, 58, 237, 0.1);
      color: #7c3aed;
    }

    &.type-check {
      background: rgba(13, 148, 136, 0.1);
      color: #0d9488;
    }
  }

  &__name {
    margin-top: 9px;
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
    color: var(--orch-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 11px;
    color: var(--orch-text-3);
  }

  &__status {
    display: flex;
    align-items: center;
  }

  &__status-dot {
    width: 6px;
    height: 6px;
    margin-right: 5px;
    border-radius: 50%;
    background: #cbd5e1;
  }

  &__owner {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 原子统计行：左侧原子数，右侧所选原子的命中标识
  &__atoms {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--orch-border);
    font-size: 11px;
    color: var(--orch-text-3);
  }

  &__match {
    flex: none;
    margin-left: 8px;
    font-weight: 600;
    color: var(--orch-accent);
  }

  &.is-done .flow-node__status-dot {
    background: #16a34a;
  }

  &.is-running {
    border-color: rgba(37, 99, 235, 0.4);

    .flow-node__status-dot {
      background: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }
  }

  &.is-failed {
    border-color: rgba(220, 38, 38, 0.4);

    .flow-node__status-dot {
      background: #dc2626;
    }
  }

  &:hover {
    border-color: var(--orch-accent);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  &.is-active {
    border-color: var(--orch-accent);
    box-shadow: 0 0 0 3px var(--orch-accent-soft);
  }

  // 含所选工单的原子：左侧强调条 + 原子数行高亮
  &.is-match {
    border-color: var(--orch-accent);
    background: linear-gradient(180deg, var(--orch-accent-soft), #fff 62%);

    &::before {
      content: '';
      position: absolute;
      top: 10px;
      bottom: 10px;
      left: 0;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--orch-accent);
    }
  }

  // 不含所选工单的原子
  &.is-dim {
    opacity: 0.55;
  }
}

.flow-link {
  display: flex;
  align-items: center;
  flex: none;
  padding: 0 6px;

  &__line {
    width: 26px;
    height: 1px;
    background: #c7d2e0;
  }

  &__arrow {
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 6px solid #c7d2e0;
  }
}
</style>
