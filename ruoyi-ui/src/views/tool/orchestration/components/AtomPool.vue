<template>
  <section class="atom-pool">
    <header class="atom-pool__head">
      <span class="atom-pool__title">
        <span class="atom-pool__icon"><svg-icon icon-class="list" /></span>
        未分配原子
      </span>
      <span class="atom-pool__count">{{ atoms.length }} 个</span>
      <span class="atom-pool__sub">{{ orderId ? '所属工单 ' + orderId : '未选择工单' }}</span>
    </header>

    <div class="atom-pool__body">
      <ul v-if="atoms.length" class="atom-list">
        <li v-for="atom in atoms" :key="atom.id" class="atom-item">
          <span class="atom-item__icon"><svg-icon icon-class="component" /></span>
          <div class="atom-item__main">
            <div class="atom-item__name" :title="atom.name">{{ atom.name }}</div>
            <div class="atom-item__meta">
              <span class="atom-item__module">{{ atom.module }}</span>
              <span class="atom-item__idc">{{ atom.idc }}</span>
            </div>
          </div>
          <span class="atom-item__status">{{ atom.status }}</span>
        </li>
      </ul>

      <div v-else class="atom-pool__empty">
        <span class="atom-pool__empty-icon"><svg-icon icon-class="list" /></span>
        <p>暂无未分配原子</p>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: 'AtomPool',
  props: {
    atoms: {
      type: Array,
      default: () => []
    },
    orderId: {
      type: String,
      default: ''
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.atom-pool {
  flex: 1;
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

  &__count {
    display: inline-flex;
    align-items: center;
    height: 18px;
    margin-left: 8px;
    padding: 0 7px;
    border-radius: 6px;
    background: var(--orch-accent-soft);
    color: var(--orch-accent);
    font-size: 11px;
    font-weight: 600;
  }

  &__sub {
    margin-left: auto;
    @include panel-sub;
  }

  &__body {
    padding: 6px;
    @include scroll-body;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 120px;
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
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #f2f5fa;
    font-size: 18px;
    color: #b7c2d3;
  }
}

.atom-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.atom-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: default;
  transition: background 0.16s ease;

  & + & {
    margin-top: 2px;
  }

  &:hover {
    background: #f7f9fc;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 26px;
    height: 26px;
    margin-right: 10px;
    border-radius: 8px;
    background: #f2f5fa;
    color: #8b9bb4;
    font-size: 13px;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 12px;
    font-weight: 500;
    color: var(--orch-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    align-items: center;
    margin-top: 3px;
    font-size: 11px;
    color: var(--orch-text-3);
  }

  &__module {
    padding: 0 6px;
    border-radius: 5px;
    background: #f2f5fa;
    line-height: 16px;
  }

  &__idc {
    margin-left: 7px;
  }

  &__status {
    flex: none;
    margin-left: 10px;
    font-size: 11px;
    color: var(--orch-text-2);
  }
}
</style>
