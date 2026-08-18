<template>
  <div class="bill-page">
    <!-- 顶部工具栏 -->
    <div class="bill-toolbar">
      <div class="bill-toolbar__title">
        <span class="bill-toolbar__icon">
          <svg-icon icon-class="server" />
        </span>
        <div class="bill-toolbar__text">
          <h2>系统账单</h2>
          <span>{{ billMeta }}</span>
        </div>
      </div>
      <div class="bill-toolbar__actions">
        <button
          v-if="categories.length"
          class="quick-action"
          type="button"
          @click="toggleAll"
        >
          <span class="quick-action__chevron" :class="{ 'is-collapsed': allCollapsed }" />
          {{ allCollapsed ? '一键展开' : '一键收起' }}
        </button>
        <button class="quick-action" type="button" @click="fetchData">
          <span class="tech-icon">
            <svg-icon icon-class="monitor" />
          </span>
          刷新
        </button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="bill-state">
      <i class="el-icon-loading bill-state__icon" />
      <p>正在加载系统账单...</p>
    </div>

    <!-- 无数据 -->
    <div v-else-if="!categories.length" class="bill-state">
      <i class="el-icon-document bill-state__icon" />
      <p>暂无账单数据</p>
    </div>

    <!-- 分类列表 -->
    <div v-else class="bill-categories">
      <section
        v-for="cat in categories"
        :key="cat.name"
        class="bill-category"
        :class="{ 'is-empty': !cat.systems.length }"
      >
        <!-- 大类标题（可折叠） -->
        <header class="bill-category__head" @click="toggleCategory(cat.name)">
          <i class="bill-category__arrow" :class="{ 'is-expanded': !collapsed[cat.name] }" />
          <span class="bill-category__name">{{ cat.name }}</span>
          <span class="bill-category__count">{{ cat.systems.length }} 个系统</span>
          <span class="bill-category__hint">
            {{ collapsed[cat.name] ? '点击展开' : '点击收起' }}
          </span>
        </header>

        <transition name="bill-fade">
          <div v-if="!collapsed[cat.name]" class="bill-category__body">
            <div v-if="cat.systems.length" class="bill-systems">
              <!-- 一个系统 = 一个方块 -->
              <article
                v-for="system in cat.systems"
                :key="system.systemName"
                class="bill-system"
              >
                <header class="bill-system__head">
                  <strong>{{ system.systemName }}</strong>
                </header>

                <!-- 上中下三个部分 -->
                <div class="bill-system__sections">
                  <div
                    v-for="(sec, idx) in system.sections"
                    :key="sec.title"
                    class="bill-section"
                  >
                    <div class="bill-section__title">
                      <span class="bill-section__idx">{{ idx + 1 }}</span>
                      <span class="bill-section__label">{{ sec.title }}</span>
                    </div>

                    <!-- 内容预览，点击查看完整内容 -->
                    <div
                      class="bill-section__content"
                      :class="{ 'is-long': sec.tooLong }"
                      @click="openDetail(system, sec)"
                    >
                      <span class="bill-section__text">{{ sec.preview }}</span>
                      <span v-if="sec.tooLong" class="bill-section__more">点击查看全部</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="bill-empty">暂无系统数据</div>
          </div>
        </transition>
      </section>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      :title="detailTitle"
      :visible.sync="detailVisible"
      width="720px"
      top="6vh"
      append-to-body
    >
      <pre class="bill-detail-content">{{ detailContent }}</pre>
    </el-dialog>

    <!-- 回到顶部 -->
    <el-backtop target=".app-main" :visibility-height="300" :right="40" :bottom="40" />
  </div>
</template>

<script>
import { getBillData } from '@/api/tool/bill'

// 预览最多展示的行数
const PREVIEW_LINES = 4

export default {
  name: 'Bill',
  data() {
    return {
      loading: false,
      billData: null,
      collapsed: {},
      detailVisible: false,
      detailTitle: '',
      detailContent: ''
    }
  },
  computed: {
    // 预处理后的分类数据（第一层由返回数据动态决定，不写死）
    categories() {
      const raw = (this.billData && this.billData.data) || this.billData || {}
      if (Array.isArray(raw)) {
        return []
      }
      return Object.keys(raw).map((name) => {
        const systems = (raw[name] || []).map((sys) => {
          const sections = (sys.data || []).map((sec) => {
            // const content = this.cleanContent(sec.content)
            const content = sec.content

            const lines = content ? content.split('\n') : []
            const tooLong = lines.length > PREVIEW_LINES
            const preview = tooLong
              ? lines.slice(0, PREVIEW_LINES).join('\n') + '…'
              : content
            return {
              title: sec.title,
              content,
              preview,
              tooLong
            }
          })
          return {
            systemName: sys.systemName,
            sections
          }
        })
        return { name, systems }
      })
    },
    // 顶部统计文案
    billMeta() {
      if (!this.categories.length) {
        return '暂无账单数据'
      }
      const totalSystems = this.categories.reduce((sum, c) => sum + c.systems.length, 0)
      return `${this.categories.length} 个分类 · ${totalSystems} 个系统`
    },
    // 是否全部收起
    allCollapsed() {
      return (
        this.categories.length > 0 &&
        this.categories.every((cat) => this.collapsed[cat.name])
      )
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    fetchData() {
      this.loading = true
      getBillData()
        .then((res) => {
          this.billData = res.data || res
          // 默认第一个分类展开，其余收起
          const collapsed = {}
          Object.keys(this.billData || {}).forEach((name, index) => {
            collapsed[name] = index !== 0
          })
          this.collapsed = collapsed
          console.log('bill categories =>', this.categories)
        })
        .catch(() => {
          this.billData = null
        })
        .finally(() => {
          this.loading = false
        })
    },
    toggleCategory(name) {
      this.$set(this.collapsed, name, !this.collapsed[name])
    },
    toggleAll() {
      const target = !this.allCollapsed
      const collapsed = {}
      this.categories.forEach((cat) => {
        collapsed[cat.name] = target
      })
      this.collapsed = collapsed
    },
    openDetail(system, sec) {
      this.detailTitle = `${system.systemName} · ${sec.title}`
      this.detailContent = sec.content
      this.detailVisible = true
    },
    // 清理多行文本：去空白、去空行
    cleanContent(content) {
      if (!content) {
        return ''
      }
      return String(content)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
    }
  }
}
</script>

<style lang="scss" scoped>
.bill-page {
  padding: 20px;
  min-height: 100%;
}

/* ============ 顶部工具栏 ============ */
.bill-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  &__title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-size: 22px;
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
  }

  &__text {
    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.3;
    }
    span {
      font-size: 12px;
      color: #94a3b8;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.quick-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #6366f1;
    color: #6366f1;
    background: #f8fafc;
  }

  .tech-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  &__chevron {
    width: 8px;
    height: 8px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg) translateY(-1px);
    transition: transform 0.2s ease;
    margin-right: 2px;

    &.is-collapsed {
      transform: rotate(-135deg) translateY(-1px);
    }
  }
}

/* ============ 加载/空状态 ============ */
.bill-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #94a3b8;

  &__icon {
    font-size: 34px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

/* ============ 分类卡片 ============ */
.bill-categories {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bill-category {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #eef1f5;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 15px 20px;
    cursor: pointer;
    user-select: none;
    background: linear-gradient(180deg, #fbfcfe, #f7f9fc);
    border-bottom: 1px solid #f1f5f9;
  }

  &__arrow {
    width: 8px;
    height: 8px;
    border-right: 2px solid #64748b;
    border-bottom: 2px solid #64748b;
    transform: rotate(-45deg);
    transition: transform 0.2s ease;

    &.is-expanded {
      transform: rotate(45deg) translateY(-2px);
    }
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
  }

  &__count {
    font-size: 12px;
    color: #64748b;
    padding: 2px 10px;
    background: #f1f5f9;
    border-radius: 999px;
  }

  &__hint {
    margin-left: auto;
    font-size: 12px;
    color: #cbd5e1;
  }

  &__body {
    padding: 18px 20px 20px;
  }
}

/* ============ 系统方块 ============ */
.bill-systems {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.bill-system {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #eef1f5;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  // 性能优化：离屏卡片跳过渲染，几百个系统展开时不卡顿
  content-visibility: auto;
  contain-intrinsic-size: auto 420px;

  &:hover {
    border-color: #e2e8f0;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px 16px;
    background: linear-gradient(180deg, #fbfcfe, #f7f9fc);
    border-bottom: 1px solid #f1f5f9;

    strong {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      word-break: break-all;
    }
  }

  &__sections {
    display: flex;
    flex-direction: column;
  }
}

/* ============ 三个部分（上中下） ============ */
.bill-section {
  padding: 12px 16px;

  & + & {
    border-top: 1px solid #f1f5f9;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__idx {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 6px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  &__label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
  }

  &__content {
    position: relative;
    cursor: pointer;
    padding: 9px 11px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    transition: background 0.15s ease, border-color 0.15s ease;

    &:hover {
      background: #eef2ff;
      border-color: #c7d2fe;
    }
  }

  &__text {
    display: block;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
    line-height: 1.6;
    color: #475569;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }

  &__more {
    display: inline-block;
    margin-top: 6px;
    font-size: 11px;
    color: #6366f1;
  }
}

/* ============ 空状态 ============ */
.bill-empty {
  padding: 24px 0;
  text-align: center;
  color: #cbd5e1;
  font-size: 13px;
}

/* ============ 折叠过渡 ============ */
.bill-fade-enter-active,
.bill-fade-leave-active {
  transition: opacity 0.2s ease;
}
.bill-fade-enter,
.bill-fade-leave-to {
  opacity: 0;
}

/* ============ 响应式 ============ */
@media (max-width: 900px) {
  .bill-systems {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .bill-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<style lang="scss">
// 全局样式：详情弹窗内容（dialog 挂载在 body，需非 scoped）
.bill-detail-content {
  margin: 0;
  max-height: 62vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
  line-height: 1.7;
  color: #334155;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 8px;
  padding: 14px 16px;
}
</style>
