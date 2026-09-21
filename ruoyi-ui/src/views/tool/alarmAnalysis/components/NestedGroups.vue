<template>
  <div class="ng">
    <template v-if="levels.length > 0">
      <!-- 一级（处置结果）：数量不定、可能有十几个 → 左侧竖排导航，自身可滚动 -->
      <aside class="ng__nav">
        <div class="ng__nav-list">
          <button
            v-for="level in levels"
            :key="level.name"
            type="button"
            class="ng__nav-item"
            :class="{ 'is-active': level.name === activeLevel }"
            :title="level.name"
            @click="activeLevel = level.name"
          >
            <i class="ng__dot" :class="'is-' + toneOf(level.name)" />
            <span class="ng__nav-name">{{ level.name }}</span>
            <span class="ng__nav-count">{{ levelRowCount(level) }}</span>
          </button>
        </div>
      </aside>

      <div class="ng__main">
        <!-- 二级（告警源）：也可能十几二十个 → 可换行的筛选 chip，默认「全部」 -->
        <div v-if="showFilter" class="ng__filter">
          <span class="ng__filter-label">告警源</span>
          <div class="ng__chips">
            <button
              v-for="chip in chips"
              :key="chip.value"
              type="button"
              class="ng__chip"
              :class="{ 'is-active': chip.value === activeFilter }"
              :title="chip.label"
              @click="pickFilter(chip.value)"
            >
              <span class="ng__chip-label">{{ chip.label }}</span>
              <span class="ng__chip-count">{{ chip.count }}</span>
            </button>
          </div>
        </div>

        <alarm-table :rows="rows" @view-field="forwardViewField" />
      </div>
    </template>

    <div v-else class="ng__empty">
      <i class="el-icon-circle-check ng__empty-icon" />
      <span>暂无数据</span>
    </div>
  </div>
</template>

<script>
import AlarmTable from './AlarmTable'
import { levelTone, levelRowCount, flattenLevel, ALL_GROUPS } from '../shape'

export default {
  name: 'NestedGroups',
  components: { AlarmTable },
  props: {
    // [ { name: 'AI关闭失败', groups: [ { name: '102', rows: [告警行] } ] } ]
    // 由 shape.js 的 buildSections 产出（kind === 'nested' 的区块）。
    // ⚠️ 两级数量都不固定：一级可能十几个、二级可能十几二十个，别按「三五个」写死布局。
    levels: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      activeLevel: '',
      // 每个一级各自记住自己选的告警源：{ 'AI关闭失败': '186' }（缺省 = 全部）
      activeGroup: {}
    }
  },
  computed: {
    currentLevel() {
      return this.levels.find((level) => level.name === this.activeLevel) || null
    },
    currentGroups() {
      return this.currentLevel ? this.currentLevel.groups || [] : []
    },
    // 只有一个告警源时不占地方，直接出表格
    showFilter() {
      return this.currentGroups.length > 1
    },
    chips() {
      const level = this.currentLevel
      if (!level) return []
      return [{ value: ALL_GROUPS, label: '全部', count: levelRowCount(level) }].concat(
        this.currentGroups.map((group) => ({
          value: group.name,
          label: group.name,
          count: group.rows.length
        }))
      )
    },
    // 当前生效的筛选值：缺省 / 失效的告警源都回落成「全部」，
    // 保证「高亮的 chip」和「表格里的行」永远是同一件事
    activeFilter() {
      const level = this.currentLevel
      if (!level) return ALL_GROUPS
      const picked = this.activeGroup[level.name]
      if (!picked || picked === ALL_GROUPS) return ALL_GROUPS
      return this.currentGroups.some((group) => group.name === picked) ? picked : ALL_GROUPS
    },
    rows() {
      return flattenLevel(this.currentLevel, this.activeFilter)
    }
  },
  watch: {
    // 数据换了（重新查询）就把选中态复位到第一项。
    // 必须 immediate：组件首次挂载时也要初始化，否则 activeLevel 是空串、右侧什么都不显示。
    levels: {
      immediate: true,
      handler() {
        this.resetSelection()
      }
    }
  },
  methods: {
    toneOf: levelTone,
    levelRowCount: levelRowCount,
    pickFilter(value) {
      const level = this.currentLevel
      if (!level) return
      // 对象新增 key 必须走 $set，否则视图不更新
      this.$set(this.activeGroup, level.name, value)
    },
    resetSelection() {
      const first = this.levels[0]
      this.activeLevel = first ? first.name : ''
      this.activeGroup = {}
    },
    // 表格里的「使用到的智能体 / 告警报告 / 更多字段」照原样抛给页面
    forwardViewField(type, row) {
      this.$emit('view-field', type, row)
    }
  }
}
</script>

<style lang="scss" scoped>
$border: #ebeef5;
$text-sub: #909399;

.ng {
  display: flex;
  align-items: stretch; // 关键：左侧导航跟右侧内容等高，不留空余
  gap: 16px;

  /* ============ 一级：左侧竖排导航（容纳十几个，超出可滚） ============ */
  &__nav {
    // ⚠️ 下面四行「显式归零」不能删！
    //    `assets/styles/index.scss:99` 有一条**全局元素选择器**
    //      aside { background:#eef1f6; padding:8px 24px; margin-bottom:20px; border-radius:2px;
    //              line-height:32px; font-size:16px; color:#2c3e50; }
    //    它会命中这个 <aside>。本选择器 `.ng__nav[data-v-x]`（0,2,0）特异性虽然更高，
    //    但**特异性只在双方都声明了同一属性时才起作用** —— 我没声明的属性照样吃全局值。
    //    其中 `margin-bottom:20px` 最致命：flex 行 `align-items:stretch` 拉伸的是 margin box，
    //    于是导航的 border-box 高度 = 内容高度 - 20px，表现为「导航比右侧内容矮 20px、底下一道空缝」。
    //    `padding:8px 24px` 则会让绝对定位的列表以 padding box 为参照、整体向内缩 24px。
    margin: 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.5;
    color: #606266;

    position: relative; // 配合下面的绝对定位列表
    flex: none;
    width: 212px;
    border: 1px solid #f0f2f5;
    border-radius: 8px;
    background: #fafbfd;

    // ⚠️ 条目列表**整体绝对定位**，这是「高度拉满」的关键：
    // 绝对定位的子元素不参与父元素高度计算 → 导航自身高度 ≈ 0，
    // 于是 flex 行高完全由右侧内容决定，`align-items: stretch` 再把导航拉到一样高。
    // 如果让条目在正常流里，条目多时导航会把右侧一起撑高（表格下面留白），
    // 条目少时导航又只有一小条（下面一大块空白）。
  }

  &__nav-list {
    position: absolute;
    top: 6px;
    right: 6px;
    bottom: 6px;
    left: 6px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #dcdfe6;
      border-radius: 2px;
    }
  }

  &__nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    line-height: 20px;
    color: #606266;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
      background: #f2f4f8;
    }

    &.is-active {
      background: #fff;
      color: #409eff;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(64, 158, 255, 0.14);
    }
  }

  &__nav-name {
    flex: 1 1 auto;
    min-width: 0; // 长名字（如 HANDLED_ERROR_REPLAY）省略号收尾
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__nav-count {
    flex: none;
    font-size: 11px;
    font-weight: 400;
    color: #a8abb2;
  }

  &__nav-item.is-active &__nav-count {
    color: #409eff;
  }

  /* ============ 右侧内容 ============ */
  &__main {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* ============ 二级：告警源筛选 chip（可换行，容纳十几二十个） ============ */
  &__filter {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__filter-label {
    flex: none;
    padding-top: 4px;
    font-size: 12px;
    color: $text-sub;
    white-space: nowrap;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 220px;
    padding: 3px 10px;
    border: 1px solid $border;
    border-radius: 13px;
    background: #fff;
    font-family: inherit;
    font-size: 12px;
    line-height: 16px;
    color: #606266;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;

    &:hover {
      border-color: #c6e2ff;
      color: #409eff;
    }

    &.is-active {
      border-color: #409eff;
      background: #ecf5ff;
      color: #409eff;
      font-weight: 600;
    }
  }

  &__chip-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chip-count {
    flex: none;
    font-size: 11px;
    font-weight: 400;
    color: #a8abb2;
  }

  &__chip.is-active &__chip-count {
    color: #409eff;
  }

  /* ============ 语义色点（判定见 shape.js 的 levelTone） ============ */
  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;

    &.is-ok {
      background: #10b981;
    }

    &.is-bad {
      background: #f56c6c;
    }

    &.is-warn {
      background: #e6a23c;
    }

    &.is-info {
      background: #409eff;
    }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 28px 0 22px;
    font-size: 13px;
    color: $text-sub;
  }

  &__empty-icon {
    font-size: 28px;
    color: #c0c4cc;
  }
}

/* 窄屏：导航改成横排置顶，避免表格被挤扁 */
@media (max-width: 1100px) {
  .ng {
    flex-direction: column;
  }

  // 竖排时没有「等高」的参照了（导航的绝对定位列表撑不起高度），
  // 所以这里必须显式给一个高度，列表再在内部滚动
  .ng__nav {
    width: 100%;
    height: 180px;
  }
}
</style>
