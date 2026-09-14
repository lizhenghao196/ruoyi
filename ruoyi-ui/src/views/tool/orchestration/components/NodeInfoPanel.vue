<template>
  <section class="node-info">
    <header class="node-info__head">
      <span class="node-info__title">
        <span class="node-info__icon"><svg-icon icon-class="form" /></span>
        节点信息
      </span>
      <button class="node-info__close" type="button" title="关闭" @click="$emit('close')">
        <svg-icon icon-class="close" />
      </button>
    </header>

    <div class="node-info__body">
      <p class="node-info__crumb" :title="flowName">{{ flowName }}</p>
      <h3 class="node-info__name">{{ node.name }}</h3>

      <div class="node-info__tags">
        <span class="node-tag" :class="'type-' + node.type">{{ nodeTypeText(node.type) }}</span>
        <span class="node-tag" :class="'status-' + node.status">
          <i class="node-tag__dot" />{{ nodeStatusText(node.status) }}
        </span>
      </div>

      <ul class="node-info__list">
        <li v-for="item in infoList" :key="item.label">
          <span>{{ item.label }}</span>
          <b :title="item.value">{{ item.value }}</b>
        </li>
      </ul>

      <div class="node-info__block">
        <h4>节点说明</h4>
        <p>{{ node.desc || '暂无说明' }}</p>
      </div>

      <div class="node-info__block">
        <h4>已分配原子</h4>
        <p class="node-info__atom">
          <span class="node-info__atom-num">{{ node.atomCount || 0 }}</span>
          个原子已编排到该节点
        </p>
      </div>
    </div>
  </section>
</template>

<script>
import { NODE_STATUS_TEXT, NODE_TYPE_TEXT } from '../constants'

export default {
  name: 'NodeInfoPanel',
  props: {
    node: {
      type: Object,
      required: true
    },
    flowName: {
      type: String,
      default: ''
    }
  },
  computed: {
    infoList() {
      return [
        { label: '节点类型', value: this.nodeTypeText(this.node.type) },
        { label: '节点状态', value: this.nodeStatusText(this.node.status) },
        { label: '负责人', value: this.node.owner || '-' },
        { label: '预计时长', value: this.node.duration || '-' },
        { label: '已分配原子', value: (this.node.atomCount || 0) + ' 个' }
      ]
    }
  },
  methods: {
    nodeTypeText(type) {
      return NODE_TYPE_TEXT[type] || type
    },
    nodeStatusText(status) {
      return NODE_STATUS_TEXT[status] || status
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.node-info {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 296px;
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

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--orch-text-3);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.16s ease;

    &:hover {
      background: #f2f5fa;
      color: var(--orch-text);
    }
  }

  &__body {
    padding: 14px;
    @include scroll-body;
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
    margin: 5px 0 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 22px;
    color: var(--orch-text);
  }

  &__tags {
    display: flex;
    align-items: center;
    margin-top: 10px;
    gap: 6px;
  }

  &__list {
    margin: 12px 0 0;
    padding: 10px 12px;
    list-style: none;
    border-radius: 9px;
    background: #f7f9fc;

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      line-height: 26px;
    }

    span {
      flex: none;
      color: var(--orch-text-3);
    }

    b {
      margin-left: 12px;
      font-weight: 500;
      color: var(--orch-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__block {
    margin-top: 16px;

    h4 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--orch-text-2);
    }

    p {
      margin: 7px 0 0;
      font-size: 12px;
      line-height: 19px;
      color: var(--orch-text-2);
    }
  }

  &__atom {
    display: flex;
    align-items: baseline;
    padding: 10px 12px;
    border-radius: 9px;
    background: #f7f9fc;
    color: var(--orch-text-3);
  }

  &__atom-num {
    margin-right: 5px;
    font-size: 18px;
    font-weight: 600;
    color: var(--orch-accent);
  }
}

.node-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 6px;
  background: #eef2f8;
  color: var(--orch-text-2);
  font-size: 11px;

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

  &.status-done {
    background: rgba(22, 163, 74, 0.1);
    color: #15803d;
  }

  &.status-running {
    background: rgba(37, 99, 235, 0.1);
    color: #2563eb;
  }

  &.status-failed {
    background: rgba(220, 38, 38, 0.1);
    color: #dc2626;
  }

  &__dot {
    width: 5px;
    height: 5px;
    margin-right: 5px;
    border-radius: 50%;
    background: currentColor;
  }
}
</style>
