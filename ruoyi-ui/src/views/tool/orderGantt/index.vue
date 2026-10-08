<template>
  <div class="ogp-page">
    <div class="ogp-card">
      <div class="ogp-card__head">
        <span class="ogp-card__icon">
          <i class="el-icon-s-data" />
        </span>
        <div class="ogp-card__title">
          <h2>工单甘特图</h2>
          <p>获取工单数据，按时间轴查看工单占用窗口（AUTO 工单贴近时间轴排列）</p>
        </div>
      </div>

      <button
        class="ogp-btn"
        type="button"
        :disabled="loading"
        @click="handleView"
      >
        <span class="ogp-btn__icon">
          <i :class="loading ? 'el-icon-loading' : 'el-icon-view'" />
        </span>
        <span>{{ loading ? '正在获取工单…' : '查看' }}</span>
      </button>

      <p v-if="tip" class="ogp-card__tip" :class="{ 'is-error': isError }">
        {{ tip }}
      </p>
    </div>

    <!-- 甘特图用 element 弹窗承载 -->
    <el-dialog
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      width="92%"
      top="5vh"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      custom-class="ogp-dialog"
    >
      <!-- ⚠️ 这层包裹是必需的：弹窗 body 是 flex 容器，甘特图要「吃剩余高度」，
           中间必须有一个 column flex 的父级把高度传下去 ——
           少了它组件就量不到确定高度，行高反推直接失效（见 OrderGantt 的 measure()）。

           ⚠️ 上面那句 `:close-on-press-escape="false"` 是**加了时间选择器之后才必须的**：
             日期面板的 Esc 由 el-date-picker 自己处理并 stopPropagation，
             **但前提是焦点在那个 input 上**；焦点不在时 Esc 直接冒到 document，
             被弹窗接走 → 整个弹窗被关掉（实测踩过）。
             和已有的 `:close-on-click-modal="false"` 一个意思 —— 别让误触把图关掉。 -->
      <div class="ogp-dialog__body">
        <!-- 日期过滤条：默认**当天**，用户可以在弹窗里自己改，
             点搜索重新拉数据（弹窗保持打开）。 -->
        <div class="ogp-filter">
          <span class="ogp-filter__label">日期</span>
          <el-date-picker
            v-model="date"
            class="ogp-filter__picker"
            type="date"
            size="small"
            placeholder="选择日期"
            value-format="yyyy-MM-dd"
            :clearable="false"
          />
          <button
            class="ogp-search"
            type="button"
            :disabled="loading"
            @click="handleSearch"
          >
            <span class="ogp-search__icon">
              <i :class="loading ? 'el-icon-loading' : 'el-icon-search'" />
            </span>
            <span>{{ loading ? '查询中…' : '搜索' }}</span>
          </button>
          <span
            v-if="tip"
            class="ogp-filter__tip"
            :class="{ 'is-error': isError }"
          >
            {{ tip }}
          </span>
        </div>

        <!-- v-if 保证每次打开都重建：宽度要重新量，悬浮状态也要清干净 -->
        <order-gantt v-if="dialogVisible" :orders="orders" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { getOrderList, pickPayload } from '@/api/tool/orderGantt'
import OrderGantt from './components/OrderGantt'

/** 补零（两位） */
function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}
/**
 * 按**本地时区**格式化成 'YYYY-MM-DD'。
 *
 * 和 el-date-picker 的 `value-format="yyyy-MM-dd"` 一致，
 * 也和项目里其它 `date` 字段的写法一致（`execPlan.js` / `execPageSimple.js` 里就是 `'2026-08-07'`）。
 */
function formatDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}
/**
 * 默认日期：**当天**（用户指定）。
 *
 * 直接取本地当天的年月日，不做任何时区换算 —— 页面上显示的、传给后端的都是同一个本地日期。
 *
 * ⚠️ 只在 data() 里算一次（即页面加载时刻）。页面一直开着跨过 0 点的话「当天」不会跟着变 ——
 *    这是刻意的：不能让用户选完日期后被悄悄重置。
 */
function defaultDate() {
  return formatDate(new Date())
}

export default {
  name: 'OrderGanttPage',
  components: { OrderGantt },
  data() {
    return {
      loading: false,
      dialogVisible: false,
      orders: [],
      /**
       * 查询用的日期，`'YYYY-MM-DD'`。
       * 直接当 `date` 传给接口，中间不做任何转换 —— 转换多一道就多一个对不上的机会。
       */
      date: defaultDate(),
      tip: '',
      isError: false
    }
  },
  computed: {
    dialogTitle() {
      return this.orders.length
        ? `工单甘特图（${this.orders.length} 条工单）`
        : '工单甘特图'
    }
  },
  methods: {
    /** 页面上的「查看」：用当前时间范围拉一次数据，成功后打开弹窗 */
    async handleView() {
      await this.fetchOrders()
    },
    /** 弹窗里的「搜索」：同一套逻辑，只是弹窗保持打开（用户改完时间就地重查） */
    async handleSearch() {
      await this.fetchOrders()
    },
    /**
     * 拉工单数据。
     *
     * 入参字段名按后端约定：**`date`**（用户明确指定），值形如 `'2026-09-24'`。
     * 日期必填 —— picker 设了 `clearable=false`，正常不会为空，
     * 但万一为空就直接提示、**不发请求**（拿空串去查后端只会返回全量，更糟）。
     *
     * 查不到数据时分两种处理：
     *   - 弹窗还没开（首次点「查看」）→ 只提示，不开空弹窗（保持原有行为）；
     *   - 弹窗已经开着（用户点「搜索」）→ **把 orders 清空**，让图切到空态。
     *     不能留着上一次的数据 —— 那样图和上面选的日期对不上，属于骗人。
     */
    async fetchOrders() {
      if (this.loading) {
        return
      }
      const date = this.date
      if (!date) {
        this.isError = true
        this.tip = '请先选择日期'
        return
      }
      this.loading = true
      this.tip = ''
      this.isError = false
      try {
        const res = await getOrderList({ date })
        // 载荷可能在 data 也可能在 rows，一律走 pickPayload（见 execPlan.js 的说明）
        const list = pickPayload(res)
        if (!Array.isArray(list) || !list.length) {
          this.isError = true
          this.tip = '未取到任何工单数据'
          if (this.dialogVisible) {
            this.orders = []
          }
          return
        }
        this.orders = list
        this.dialogVisible = true
        this.tip = `已获取 ${list.length} 条工单`
      } catch (e) {
        this.isError = true
        this.tip = '获取工单数据失败，请重试'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.ogp-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: calc(100vh - 84px);
  padding: 24px;
  box-sizing: border-box;

  --ogp-panel: #ffffff;
  --ogp-border: #e6eaf2;
  --ogp-text: #1f2937;
  --ogp-text-2: #5b6b82;
  --ogp-text-3: #97a3b6;
  --ogp-accent: var(--current-color, #409eff);
  --ogp-accent-soft: #eef4fd;
}

.ogp-card {
  width: 100%;
  max-width: 460px;
  padding: 28px 28px 24px;
  background: var(--ogp-panel);
  border: 1px solid var(--ogp-border);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);

  &__head {
    display: flex;
    align-items: flex-start;
    margin-bottom: 22px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 34px;
    height: 34px;
    margin-right: 12px;
    border-radius: 10px;
    background: var(--ogp-accent-soft);
    color: var(--ogp-accent);
    font-size: 17px;
  }

  &__title {
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      line-height: 20px;
      letter-spacing: 0.2px;
      color: var(--ogp-text);
    }

    p {
      margin: 5px 0 0;
      font-size: 12px;
      line-height: 17px;
      color: var(--ogp-text-3);
    }
  }

  &__tip {
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 17px;
    color: var(--ogp-text-2);

    &.is-error {
      color: #d14343;
    }
  }
}

.ogp-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 42px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: var(--ogp-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 6px 18px rgba(64, 158, 255, 0.32);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    font-size: 15px;
  }
}

/* ==================== 弹窗内容：过滤条 + 甘特图 ====================
   ⚠️ 弹窗是 `append-to-body` 的，这层 DOM 挂在 body 下、**不在 `.ogp-page` 里面**，
      所以 `.ogp-page` 上声明的 `--ogp-*` 变量**继承不到这里** ——
      必须自己再声明一份，否则 `var(--ogp-border)` 直接失效（边框消失、颜色退回默认）。
      这也是为什么 `.el-dialog.ogp-dialog` 那段要写成非 scoped（见文件末尾）。
   ⚠️ 必须是 column flex + `min-height: 0`：甘特图的高度是「父级给多少用多少」，
      中间多一层不传递高度的话组件会量到 0，行高反推失效、整图空白。 */
.ogp-dialog__body {
  --ogp-border: #e6eaf2;
  --ogp-text-2: #5b6b82;
  --ogp-text-3: #97a3b6;
  --ogp-accent: var(--current-color, #409eff);
  --ogp-accent-soft: #eef4fd;

  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.ogp-filter {
  display: flex;
  align-items: center;
  flex: none;
  flex-wrap: wrap;
  gap: 10px 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ogp-border);

  &__label {
    flex: none;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2px;
    color: var(--ogp-text-2);
  }

  /* 单个日期选择器，element 默认宽 220px，够用；
     这里只锁住「不许被 flex 压缩」，否则窗口窄时日期会被压成省略号。 */
  &__picker {
    flex: none;
  }

  &__tip {
    font-size: 12px;
    line-height: 17px;
    color: var(--ogp-text-3);

    &.is-error {
      color: #d14343;
    }
  }
}

.ogp-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--ogp-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 6px;
    font-size: 13px;
  }
}
</style>

<!--
  弹窗挂在 body 上，scoped 命中不了它的内部元素 —— 这一段**必须**是非 scoped 的
  （项目先例：views/tool/bill/index.vue、alarmAnalysis/components/FieldDialog.vue）。

  ⚠️ 选择器写成 `.el-dialog.ogp-dialog`（两个类）而不是单独 `.ogp-dialog`：
  custom-class 和 element 自带的 `.el-dialog` 打在**同一个元素**上，特异性相同（0,1,0），
  谁生效就只看打包顺序 —— 而 element-ui 的样式来自 node_modules，顺序不受控。
  提到 (0,2,0) 才能稳定压过 `.el-dialog { margin: 0 auto 50px }` 这类规则。

  高度策略：**弹窗定高 + body 变 flex 容器**，甘特图组件在里面 stretch 到满高，
  自己按可用高度反推行高。这样才做得到「不滚动、一眼看全」——
  如果让弹窗高度跟内容走，组件就永远量不到「还剩多少高度」。
-->
<style lang="scss">
.el-dialog.ogp-dialog {
  display: flex;
  flex-direction: column;
  /* top="5vh" 会写成 inline 的 margin-top；这里只把底边距收掉，
     88vh + 5vh = 93vh，下面留 7vh 呼吸，绝不会顶出屏幕。 */
  height: 88vh;
  margin-bottom: 0;
  border-radius: 12px;
  overflow: hidden;

  .el-dialog__header {
    flex: none;
    padding: 16px 20px;
    border-bottom: 1px solid #e9edf5;
  }

  .el-dialog__title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #1f2937;
  }

  .el-dialog__headerbtn {
    top: 18px;
  }

  /* body 撑满剩余高度并变成 flex 容器，子组件才能拿到确定高度 */
  .el-dialog__body {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    padding: 16px 20px 18px;
    overflow: hidden;
  }
}
</style>
