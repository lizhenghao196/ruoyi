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
      custom-class="ogp-dialog"
    >
      <!-- v-if 保证每次打开都重建：宽度要重新量，悬浮状态也要清干净 -->
      <order-gantt v-if="dialogVisible" :orders="orders" />
    </el-dialog>
  </div>
</template>

<script>
import { getOrderList, pickPayload } from '@/api/tool/orderGantt'
import OrderGantt from './components/OrderGantt'

export default {
  name: 'OrderGanttPage',
  components: { OrderGantt },
  data() {
    return {
      loading: false,
      dialogVisible: false,
      orders: [],
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
    async handleView() {
      if (this.loading) {
        return
      }
      this.loading = true
      this.tip = ''
      this.isError = false
      try {
        const res = await getOrderList()
        // 载荷可能在 data 也可能在 rows，一律走 pickPayload（见 execPlan.js 的说明）
        const list = pickPayload(res)
        if (!Array.isArray(list) || !list.length) {
          this.isError = true
          this.tip = '未取到任何工单数据'
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
