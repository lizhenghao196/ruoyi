<template>
  <section class="env-flow-bar">
    <!-- 环境 -->
    <div class="env-flow-bar__row">
      <span class="env-flow-bar__label">
        <span class="env-flow-bar__label-icon"><svg-icon icon-class="server" /></span>
        环境
      </span>
      <div class="env-flow-bar__items">
        <button
          v-for="env in environments"
          :key="env.key"
          type="button"
          class="env-chip"
          :class="{
            'is-active': env.key === activeEnv,
            'is-match': matchOf(envMatches, env.key),
            'is-dim': marking && !matchOf(envMatches, env.key)
          }"
          @click="$emit('env-change', env.key)"
        >
          <span class="env-chip__dot" />
          <span class="env-chip__name">{{ env.name }}</span>
          <span class="env-chip__desc">{{ env.desc }}</span>
          <span v-if="matchOf(envMatches, env.key)" class="chip-badge">{{ matchOf(envMatches, env.key) }}</span>
        </button>
      </div>
    </div>

    <!-- 流 -->
    <div class="env-flow-bar__row">
      <span class="env-flow-bar__label">
        <span class="env-flow-bar__label-icon"><svg-icon icon-class="tree" /></span>
        流
      </span>
      <div class="env-flow-bar__items">
        <button
          v-for="flow in flows"
          :key="flow.id"
          type="button"
          class="flow-chip"
          :class="{
            'is-active': flow.id === activeFlow,
            'is-match': matchOf(flowMatches, flow.id),
            'is-dim': marking && !matchOf(flowMatches, flow.id)
          }"
          @click="$emit('flow-change', flow.id)"
        >
          <span class="flow-chip__status" :class="'is-' + flow.status" :title="flowStatusText(flow.status)" />
          <span class="flow-chip__body">
            <span class="flow-chip__name">{{ flow.name }}</span>
            <span class="flow-chip__meta">{{ flow.nodes.length }} 节点 · {{ flow.updatedAt }}</span>
          </span>
          <span v-if="matchOf(flowMatches, flow.id)" class="chip-badge">{{ matchOf(flowMatches, flow.id) }}</span>
          <span class="flow-chip__bar"><i :style="{ width: flowProgress(flow) + '%' }" /></span>
        </button>
        <p v-if="!flows.length" class="env-flow-bar__empty">该环境下暂无流</p>
      </div>
    </div>
  </section>
</template>

<script>
import { FLOW_STATUS_TEXT } from '../constants'

export default {
  name: 'EnvFlowBar',
  props: {
    environments: {
      type: Array,
      default: () => []
    },
    activeEnv: {
      type: String,
      default: ''
    },
    flows: {
      type: Array,
      default: () => []
    },
    activeFlow: {
      type: String,
      default: ''
    },
    // 所选工单的原子在各环境 / 各流上的数量（{ key: count }）
    envMatches: {
      type: Object,
      default: () => ({})
    },
    flowMatches: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    // 所选工单是否已编排到某些位置：有位置时才做"未命中"的弱化展示
    marking() {
      return Object.keys(this.envMatches).length > 0
    }
  },
  methods: {
    flowStatusText(status) {
      return FLOW_STATUS_TEXT[status] || status
    },
    matchOf(matches, key) {
      return matches[key] || 0
    },
    // 流进度：已完成节点占比
    flowProgress(flow) {
      const total = flow.nodes.length
      if (!total) {
        return 0
      }
      const done = flow.nodes.filter(node => node.status === 'done').length
      return Math.round((done / total) * 100)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.env-flow-bar {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  @include panel;

  &__row {
    display: flex;
    align-items: center;
    min-width: 0;

    & + & {
      margin-top: 12px;
    }
  }

  &__label {
    display: flex;
    align-items: center;
    flex: none;
    margin-right: 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--orch-text-2);
    letter-spacing: 1px;
  }

  &__label-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-right: 6px;
    border-radius: 6px;
    background: var(--orch-accent-soft);
    color: var(--orch-accent);
    font-size: 12px;
  }

  &__items {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
    gap: 8px;
  }

  &__empty {
    margin: 0;
    font-size: 12px;
    color: var(--orch-text-3);
    line-height: 30px;
  }
}

.env-chip {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--orch-border);
  border-radius: 8px;
  background: #fff;
  color: var(--orch-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;

  &__dot {
    width: 6px;
    height: 6px;
    margin-right: 7px;
    border-radius: 50%;
    background: #cbd5e1;
    transition: background 0.18s ease;
  }

  &__name {
    font-weight: 600;
    color: var(--orch-text);
  }

  &__desc {
    margin-left: 6px;
    font-size: 11px;
    color: var(--orch-text-3);
  }

  &:hover {
    border-color: var(--orch-accent);
    color: var(--orch-accent);
  }

  // 选中环境：实心填充，与"命中"的描边浅底明确区分
  &.is-active {
    border-color: var(--orch-accent);
    background: var(--orch-accent);
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.28);

    .env-chip__dot {
      background: #fff;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.28);
    }

    .env-chip__name {
      color: #fff;
    }

    .env-chip__desc {
      color: rgba(255, 255, 255, 0.76);
    }

    .chip-badge {
      background: #fff;
      color: var(--orch-accent);
    }
  }

  // 含所选工单的原子（选中态优先，命中样式不再覆盖实心填充）
  &.is-match:not(.is-active) {
    border-color: var(--orch-accent);
    background: var(--orch-accent-soft);

    .env-chip__dot {
      background: var(--orch-accent);
    }
  }

  // 不含所选工单的原子
  &.is-dim:not(.is-active) {
    opacity: 0.5;
  }
}

.flow-chip {
  position: relative;
  display: flex;
  align-items: center;
  height: 50px;
  padding: 0 12px 3px;
  overflow: hidden;
  border: 1px solid var(--orch-border);
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;

  &__status {
    flex: none;
    width: 8px;
    height: 8px;
    margin-right: 9px;
    border-radius: 50%;
    background: #cbd5e1;

    &.is-running {
      background: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }

    &.is-done {
      background: #16a34a;
    }

    &.is-waiting {
      background: #94a3b8;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--orch-text);
    white-space: nowrap;
  }

  &__meta {
    margin-top: 2px;
    font-size: 11px;
    color: var(--orch-text-3);
    white-space: nowrap;
  }

  // 流方块底部进度条：已完成节点占比
  &__bar {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 3px;
    background: #eef2f8;

    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #60a5fa, var(--orch-accent));
      transition: width 0.3s ease;
    }
  }

  &:hover {
    border-color: var(--orch-accent);
  }

  // 选中流：实心填充
  &.is-active {
    border-color: var(--orch-accent);
    background: var(--orch-accent);
    box-shadow: 0 2px 10px rgba(64, 158, 255, 0.26);

    .flow-chip__status {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
    }

    .flow-chip__name {
      color: #fff;
    }

    .flow-chip__meta {
      color: rgba(255, 255, 255, 0.76);
    }

    .flow-chip__bar {
      background: rgba(255, 255, 255, 0.28);

      i {
        background: #fff;
      }
    }

    .chip-badge {
      background: #fff;
      color: var(--orch-accent);
    }
  }

  // 含所选工单的原子（选中态优先）
  &.is-match:not(.is-active) {
    border-color: var(--orch-accent);

    .flow-chip__name {
      color: var(--orch-accent);
    }
  }

  // 不含所选工单的原子
  &.is-dim:not(.is-active) {
    opacity: 0.5;
  }
}

/* 含所选工单的原子数量标识 */
.chip-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: 16px;
  height: 16px;
  margin-left: 8px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--orch-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
</style>
