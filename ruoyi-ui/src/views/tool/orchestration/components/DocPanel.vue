<template>
  <section class="doc-panel">
    <header class="doc-panel__head">
      <span class="doc-panel__title">
        <span class="doc-panel__icon"><svg-icon icon-class="documentation" /></span>
        文档
      </span>
      <span class="doc-panel__count">{{ docs.length }} 篇</span>
      <span class="doc-panel__sub">{{ flowName ? flowName + ' 相关文档' : '未选择流' }}</span>
    </header>

    <div class="doc-panel__body">
      <ul v-if="docs.length" class="doc-list">
        <li
          v-for="doc in docs"
          :key="doc.id"
          class="doc-item"
          :class="{ 'is-open': doc.id === activeDocId }"
          @click="toggleDoc(doc)"
        >
          <div class="doc-item__row">
            <span class="doc-item__type" :class="'type-' + docTypeClass(doc.type)">{{ doc.type }}</span>
            <div class="doc-item__main">
              <div class="doc-item__title" :title="doc.title">{{ doc.title }}</div>
              <div class="doc-item__meta">{{ doc.size }} · 更新于 {{ doc.updatedAt }}</div>
            </div>
            <span class="doc-item__arrow" :class="{ 'is-open': doc.id === activeDocId }" />
          </div>
          <p v-if="doc.id === activeDocId" class="doc-item__content">{{ doc.content }}</p>
        </li>
      </ul>

      <div v-else class="doc-panel__empty">
        <span class="doc-panel__empty-icon"><svg-icon icon-class="documentation" /></span>
        <p>{{ flowName ? '该流暂无相关文档' : '选择一个流后展示相关文档' }}</p>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: 'DocPanel',
  props: {
    docs: {
      type: Array,
      default: () => []
    },
    flowName: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      activeDocId: ''
    }
  },
  watch: {
    docs() {
      this.activeDocId = ''
    }
  },
  methods: {
    toggleDoc(doc) {
      this.activeDocId = this.activeDocId === doc.id ? '' : doc.id
    },
    docTypeClass(type) {
      return (type || '').toLowerCase()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../panel';

.doc-panel {
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
    background: #f2f5fa;
    color: var(--orch-text-2);
    font-size: 11px;
    font-weight: 600;
  }

  &__sub {
    margin-left: auto;
    @include panel-sub;
  }

  &__body {
    padding: 8px;
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

.doc-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.doc-item {
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.16s ease;

  & + & {
    margin-top: 2px;
  }

  &:hover {
    background: #f7f9fc;
  }

  &.is-open {
    border-color: var(--orch-border);
    background: #fbfcfe;
  }

  &__row {
    display: flex;
    align-items: center;
  }

  &__type {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 34px;
    height: 34px;
    margin-right: 10px;
    border-radius: 9px;
    background: #f2f5fa;
    color: #8b9bb4;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;

    &.type-pdf {
      background: rgba(220, 38, 38, 0.09);
      color: #dc2626;
    }

    &.type-docx {
      background: rgba(37, 99, 235, 0.09);
      color: #2563eb;
    }

    &.type-xlsx {
      background: rgba(22, 163, 74, 0.1);
      color: #16a34a;
    }

    &.type-sql {
      background: rgba(124, 58, 237, 0.1);
      color: #7c3aed;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 12px;
    font-weight: 500;
    color: var(--orch-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    margin-top: 3px;
    font-size: 11px;
    color: var(--orch-text-3);
  }

  &__arrow {
    flex: none;
    width: 6px;
    height: 6px;
    margin-left: 8px;
    border-right: 1.5px solid #b7c2d3;
    border-bottom: 1.5px solid #b7c2d3;
    transform: rotate(45deg) translateY(-1px);
    transition: transform 0.18s ease;

    &.is-open {
      border-color: var(--orch-accent);
      transform: rotate(225deg) translateY(-1px);
    }
  }

  &__content {
    margin: 9px 0 0;
    padding: 9px 11px;
    border-radius: 8px;
    background: #f7f9fc;
    font-size: 12px;
    line-height: 19px;
    color: var(--orch-text-2);
    white-space: pre-line;
  }
}
</style>
