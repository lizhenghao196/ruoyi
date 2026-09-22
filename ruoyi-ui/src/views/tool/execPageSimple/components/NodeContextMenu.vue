<template>
  <transition name="nm-fade">
    <div
      v-if="visible"
      ref="menu"
      class="nm"
      :style="pos"
      @contextmenu.prevent
    >
      <!-- 头部：先确认右键的是哪个节点、当前什么状态，避免误操作 -->
      <div class="nm__head">
        <span class="nm__name" :title="nodeName">{{ nodeName || '未命名节点' }}</span>
        <span v-if="statusLabel" class="nm__status">{{ statusLabel }}</span>
      </div>

      <ul class="nm__list">
        <li
          v-for="item in items"
          :key="item.fnName"
          class="nm__item"
          :class="{ 'is-danger': item.danger }"
          @click="pick(item)"
        >
          <i class="nm__icon" :class="item.icon" />
          <span class="nm__label">{{ item.label }}</span>
        </li>
      </ul>
    </div>
  </transition>
</template>

<script>
/**
 * 节点右键菜单
 *
 * 纯展示组件：菜单项由外部传入（见 ../nodeMenu.js 的 buildNodeMenu），
 * 本组件只负责「浮层定位 + 交互」，不做任何状态到菜单的推断。
 *
 * 用 fixed 定位而不是挂在节点内部：节点卡片是 overflow:hidden 的，
 * 且画布本身可横向滚动，挂在内部一定会被裁掉。
 */
export default {
  name: 'NodeContextMenu',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    // 视口坐标（右键时的 clientX / clientY）
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    },
    // buildNodeMenu() 的结果
    items: {
      type: Array,
      default: () => []
    },
    nodeName: {
      type: String,
      default: ''
    },
    statusLabel: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      // 实际落点：贴到视口边缘时自动翻转，保证菜单完整可见
      pos: { left: '0px', top: '0px' }
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.place()
      }
    },
    x() {
      this.place()
    },
    y() {
      this.place()
    },
    // 轮询可能让菜单项增减（状态变了），高度跟着变，重新贴边
    items() {
      this.place()
    }
  },
  mounted() {
    // capture 阶段监听：滚动容器内部的 scroll 不冒泡，只有捕获才拿得到
    document.addEventListener('mousedown', this.onDocMouseDown, true)
    document.addEventListener('keydown', this.onDocKeyDown, true)
    window.addEventListener('resize', this.onClose)
    window.addEventListener('scroll', this.onClose, true)
  },
  beforeDestroy() {
    document.removeEventListener('mousedown', this.onDocMouseDown, true)
    document.removeEventListener('keydown', this.onDocKeyDown, true)
    window.removeEventListener('resize', this.onClose)
    window.removeEventListener('scroll', this.onClose, true)
  },
  methods: {
    /**
     * 定位：默认贴鼠标右下角，超出视口则往回收。
     * 在 $nextTick 里量尺寸 —— 此时 DOM 已插入但浏览器尚未绘制，
     * 同一帧内完成测量与赋值，不会看到菜单闪到错误位置。
     */
    place() {
      if (!this.visible) {
        return
      }
      this.$nextTick(() => {
        const el = this.$refs.menu
        if (!el) {
          return
        }
        const EDGE = 8 // 距视口边缘留白
        const w = el.offsetWidth
        const h = el.offsetHeight
        const vw = window.innerWidth
        const vh = window.innerHeight
        const left = this.x + w + EDGE > vw ? Math.max(EDGE, vw - w - EDGE) : this.x
        const top = this.y + h + EDGE > vh ? Math.max(EDGE, vh - h - EDGE) : this.y
        this.pos = { left: left + 'px', top: top + 'px' }
      })
    },
    pick(item) {
      this.$emit('select', item)
    },
    onClose() {
      if (this.visible) {
        this.$emit('close')
      }
    },
    // 点到菜单外面就关掉；菜单内部的 mousedown 不算
    onDocMouseDown(e) {
      if (!this.visible) {
        return
      }
      if (this.$el && this.$el.contains(e.target)) {
        return
      }
      this.$emit('close')
    },
    onDocKeyDown(e) {
      if (this.visible && e.key === 'Escape') {
        this.$emit('close')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.nm {
  position: fixed;
  z-index: 3000;
  min-width: 158px;
  padding: 5px;
  background: #fff;
  border: 1px solid #e6eaf2;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.06);
  user-select: none;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 9px 7px;
    margin-bottom: 4px;
    border-bottom: 1px solid #f1f4f8;
    gap: 8px;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #26303f;
  }

  /* 状态文案来自字典，这里只给中性底色，不参与 7 套状态配色 */
  &__status {
    display: inline-flex;
    align-items: center;
    flex: none;
    height: 16px;
    padding: 0 6px;
    border-radius: 4px;
    background: #f2f4f8;
    color: #5b6b82;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    white-space: nowrap;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 9px;
    border-radius: 7px;
    color: #3d4a5c;
    cursor: pointer;
    transition: background-color 0.14s ease, color 0.14s ease;

    &:hover {
      background: #eef4fd;
      color: #2b7fd4;

      .nm__icon {
        color: #2b7fd4;
      }
    }

    /* 危险动作（取消节点）：标红，和普通操作区分开 */
    &.is-danger {
      color: #c73b3b;

      .nm__icon {
        color: #c73b3b;
      }

      &:hover {
        background: #fdeeee;
        color: #c73b3b;
      }
    }
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 14px;
    height: 14px;
    margin-right: 8px;
    font-size: 13px;
    line-height: 1;
    color: #7b8a9c;
    transition: color 0.14s ease;
  }

  &__label {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2px;
    white-space: nowrap;
  }
}

.nm-fade-enter-active,
.nm-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
  transform-origin: left top;
}

.nm-fade-enter,
.nm-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
