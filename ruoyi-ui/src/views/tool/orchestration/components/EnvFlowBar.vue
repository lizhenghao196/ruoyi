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
  position: relative;
  z-index: 0;
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
  isolation: isolate;
  transition: border-color 0.18s ease, border-width 0.18s ease, background 0.18s ease,
    color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;

  &__dot {
    width: 6px;
    height: 6px;
    margin-right: 7px;
    border-radius: 50%;
    background: #cbd5e1;
    transition: background 0.18s ease, box-shadow 0.18s ease;
  }

  &__name {
    font-weight: 600;
    color: var(--orch-text);
    transition: color 0.18s ease;
  }

  &__desc {
    margin-left: 6px;
    font-size: 11px;
    color: var(--orch-text-3);
    transition: color 0.18s ease;
  }

  /* hover：只把边框转成浅蓝，弱于选中 */
  &:hover {
    border-color: #a5c9f5;
  }

  /* 选中：2px 主题描边 + 浅色外环，走"描边"通道，背景保持纯白 */
  &.is-active {
    border-width: 2px;
    border-color: var(--orch-accent);
    box-shadow: 0 0 0 3px var(--orch-accent-soft);
    padding: 0 11px; // 补掉边框加粗带来的 1px 位移，内容不跳动

    .env-chip__dot {
      background: var(--orch-accent);
      box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.18);
    }

    .env-chip__name {
      color: var(--orch-accent);
    }
  }

  /* 含该工单原子：旋转流光描边 + 光晕，比单向扫光更抓眼 */
  &.is-match {
    border-color: transparent;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      // 环厚度跟随边框宽度：未选中 1px，选中（2px 边框）时同步为 2px
      padding: 1px;
      border-radius: 8px;
      background: conic-gradient(
        from var(--flow-angle, 0deg),
        rgba(64, 158, 255, 0.18) 0deg,
        rgba(64, 158, 255, 0.18) 200deg,
        #a5d5ff 260deg,
        #ffffff 292deg,
        #409eff 320deg,
        #7cc0ff 344deg,
        rgba(64, 158, 255, 0.18) 360deg
      );
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask-composite: exclude;
      animation: chip-spin 2.4s linear infinite;
      pointer-events: none;
    }

    /* 外发光：流光溢出到元素外围，明显但不过分 */
    &::after {
      content: '';
      position: absolute;
      inset: -1px;
      z-index: -2;
      border-radius: 9px;
      background: linear-gradient(120deg, rgba(64, 158, 255, 0.5), rgba(125, 200, 255, 0.28));
      filter: blur(6px);
      opacity: 0.75;
      animation: chip-glow 2.4s ease-in-out infinite;
      pointer-events: none;
    }

    .env-chip__dot {
      background: var(--orch-accent);
      box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.18);
    }

    .env-chip__name {
      color: var(--orch-accent);
    }
  }

  /* 命中 + 选中：流光由蓝转金，与"仅命中（未选中）"的蓝色流光明确区分 */
  &.is-active.is-match {
    border-color: transparent;
    box-shadow: none;

    &::before {
      padding: 2px;
      background: conic-gradient(
        from var(--flow-angle, 0deg),
        rgba(245, 158, 11, 0.25) 0deg,
        rgba(245, 158, 11, 0.25) 190deg,
        #fcd34d 255deg,
        #fffbeb 288deg,
        #f59e0b 320deg,
        #fbbf24 345deg,
        rgba(245, 158, 11, 0.25) 360deg
      );
    }

    &::after {
      background: linear-gradient(120deg, rgba(245, 158, 11, 0.6), rgba(252, 211, 77, 0.35));
      filter: blur(8px);
      opacity: 0.9;
    }

    .env-chip__dot {
      background: #f59e0b;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.22);
    }

    .env-chip__name {
      color: #b45309;
    }
  }

  /* 不含该工单原子：弱化到可忽略，hover 恢复 */
  &.is-dim:not(.is-active) {
    opacity: 0.45;

    &:hover {
      opacity: 1;
    }
  }
}

.flow-chip {
  position: relative;
  z-index: 0;
  display: flex;
  align-items: center;
  height: 50px;
  padding: 0 12px;
  overflow: hidden;
  border: 1px solid var(--orch-border);
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  isolation: isolate;
  transition: border-color 0.18s ease, background 0.18s ease, opacity 0.18s ease;

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
    transition: color 0.18s ease;
  }

  &__meta {
    margin-top: 2px;
    font-size: 11px;
    color: var(--orch-text-3);
    white-space: nowrap;
  }

  /* hover：只把边框转成浅蓝，弱于选中 */
  &:hover {
    border-color: #a5c9f5;
  }

  /* 选中：2px 主题描边 + 浅色外环（同环境 chip） */
  &.is-active {
    border-width: 2px;
    border-color: var(--orch-accent);
    box-shadow: 0 0 0 3px var(--orch-accent-soft);
    padding: 0 11px; // 补掉边框加粗带来的 1px 位移

    .flow-chip__name {
      color: var(--orch-accent);
    }
  }

  /* 含该工单原子：旋转流光描边 + 光晕（同环境 chip） */
  &.is-match {
    border-color: transparent;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      // 环厚度跟随边框宽度
      padding: 1px;
      border-radius: 8px;
      background: conic-gradient(
        from var(--flow-angle, 0deg),
        rgba(64, 158, 255, 0.18) 0deg,
        rgba(64, 158, 255, 0.18) 200deg,
        #a5d5ff 260deg,
        #ffffff 292deg,
        #409eff 320deg,
        #7cc0ff 344deg,
        rgba(64, 158, 255, 0.18) 360deg
      );
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask-composite: exclude;
      animation: chip-spin 2.4s linear infinite;
      pointer-events: none;
    }

    &::after {
      content: '';
      position: absolute;
      inset: -1px;
      z-index: -2;
      border-radius: 9px;
      background: linear-gradient(120deg, rgba(64, 158, 255, 0.5), rgba(125, 200, 255, 0.28));
      filter: blur(6px);
      opacity: 0.75;
      animation: chip-glow 2.4s ease-in-out infinite;
      pointer-events: none;
    }

    .flow-chip__name {
      color: var(--orch-accent);
    }
  }

  /* 命中 + 选中：流光由蓝转金，与"仅命中（未选中）"的蓝色流光明确区分 */
  &.is-active.is-match {
    border-color: transparent;
    box-shadow: none;

    &::before {
      padding: 2px;
      background: conic-gradient(
        from var(--flow-angle, 0deg),
        rgba(245, 158, 11, 0.25) 0deg,
        rgba(245, 158, 11, 0.25) 190deg,
        #fcd34d 255deg,
        #fffbeb 288deg,
        #f59e0b 320deg,
        #fbbf24 345deg,
        rgba(245, 158, 11, 0.25) 360deg
      );
    }

    &::after {
      background: linear-gradient(120deg, rgba(245, 158, 11, 0.6), rgba(252, 211, 77, 0.35));
      filter: blur(8px);
      opacity: 0.9;
    }

    .flow-chip__name {
      color: #b45309;
    }
  }

  /* 不含该工单原子：弱化到可忽略，hover 恢复 */
  &.is-dim:not(.is-active) {
    opacity: 0.45;

    &:hover {
      opacity: 1;
    }
  }
}

/* 流光角度：注册为可动画的自定义属性，让 conic-gradient 原地转动 */
@property --flow-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

/* 旋转流光：角度递增，光带沿边框连续绕行（形状不变） */
@keyframes chip-spin {
  from {
    --flow-angle: 0deg;
  }

  to {
    --flow-angle: 360deg;
  }
}

/* 外发光呼吸 */
@keyframes chip-glow {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 0.95;
  }
}

/* 含该工单原子：计数胶囊 */
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
