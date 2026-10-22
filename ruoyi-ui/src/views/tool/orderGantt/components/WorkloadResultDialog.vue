<template>
  <el-dialog
    :visible="visible"
    custom-class="wrd-dialog"
    width="560px"
    top="16vh"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @close="onClose"
  >
    <div slot="title" class="wrd-title">额外变更支持人数</div>

    <div class="wrd">
      <!-- 结论区：用户要的那行「额外需要变更支持人数: x人」 -->
      <div class="wrd__hero">
        <span class="wrd__hero-label">额外需要变更支持人数:</span>
        <span class="wrd__hero-num">{{ peopleNum }}</span>
        <span class="wrd__hero-unit">人</span>
      </div>

      <!-- 五段明细：每段的单数与耗时（外加段总分，说明这个人数是怎么来的） -->
      <table class="wrd__table">
        <thead>
          <tr>
            <th class="is-time">时间段</th>
            <th>手动单数</th>
            <th>手动耗时(H)</th>
            <th>自动单数</th>
            <th>自动耗时(H)</th>
            <th>段总分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in detail" :key="d.time">
            <td class="is-time">{{ d.time }}</td>
            <td>{{ d.manualNum }}</td>
            <td>{{ d.manualCost }}</td>
            <td>{{ d.autoNum }}</td>
            <td>{{ d.autoCost }}</td>
            <td>{{ d.totalVal }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div slot="footer" class="wrd-foot">
      <button type="button" class="wrd-btn" :disabled="pushing" @click="onClose">
        关闭
      </button>
      <button
        type="button"
        class="wrd-btn is-primary"
        :disabled="pushing || !hasResult"
        @click="onPush"
      >
        <!-- ⚠️ icon 必须 flex 居中（项目约定） -->
        <span class="wrd-btn__icon">
          <i :class="pushing ? 'el-icon-loading' : 'el-icon-s-promotion'" />
        </span>
        <span>{{ pushing ? '推送中…' : '推送到企微' }}</span>
      </button>
    </div>
  </el-dialog>
</template>

<script>
/**
 * 「额外变更支持人数」结果弹窗（2026-10-22 用户需求）。
 *
 * 由甘特图页头的「获取额外变更支持人数」按钮打开，展示 workloadCalc.js 算出的
 * par：一行结论（人数）+ 五个时间段的单数 / 耗时明细。
 *
 * ⚠️ **哑组件**（同 AtomConfirmDialog 的规矩）：不自己调接口。
 *    「推送到企微」只抛 `@push`，请求由父组件（OrderGantt.vue）发；
 *    `pushing` 也由父组件传进来，这里只负责按钮态。
 *    好处是推送成功/失败的提示、对话框关闭时机都在父组件一处决定。
 */
export default {
  name: 'WorkloadResultDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    /**
     * 计算结果 par：{ peopleNum, detail: [五个时间段各一项] }。
     * 父组件用 workloadCalc.calcExtraStaff(orders, date) 算好传进来。
     */
    result: {
      type: Object,
      default: null
    },
    /** 正在推送企微（请求进行中）—— 父组件管，这里只置按钮态 */
    pushing: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    /** 最终额外需要人数；result 没到时显示 0，不摆 undefined */
    peopleNum() {
      const r = this.result
      return r && typeof r.peopleNum === 'number' ? r.peopleNum : 0
    },
    /** 五段明细；result 没到时是空数组（表格空体） */
    detail() {
      const r = this.result
      return r && Array.isArray(r.detail) ? r.detail : []
    },
    /** 有结果才让推（防止空 par 发出去） */
    hasResult() {
      return !!this.result
    }
  },
  methods: {
    onPush() {
      if (this.pushing) {
        return
      }
      this.$emit('push')
    },
    /**
     * 关闭。推送进行中不许关（点 × / ESC 都会被拦）——
     * 请求还在飞就把上下文丢了，推送完用户自己看到成功提示再关。
     */
    onClose() {
      if (this.pushing) {
        return
      }
      this.$emit('close')
    }
  }
}
</script>

<style lang="scss" scoped>
.wrd {
  padding: 2px 0 4px;
}

.wrd__hero {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 2px 16px;
  border-bottom: 1px dashed var(--wrd-line);
  margin-bottom: 14px;

  &-label {
    font-size: 13px;
    color: var(--wrd-text-2);
    letter-spacing: 0.2px;
  }

  &-num {
    font-size: 30px;
    font-weight: 700;
    line-height: 1;
    color: var(--wrd-accent);
    font-variant-numeric: tabular-nums;
  }

  &-unit {
    font-size: 14px;
    color: var(--wrd-text-2);
  }
}

.wrd__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    padding: 8px 10px;
    text-align: center;
    color: var(--wrd-text);
    font-variant-numeric: tabular-nums;
  }

  th {
    background: var(--wrd-head-bg);
    font-weight: 500;
    color: var(--wrd-text-2);
    white-space: nowrap;

    &.is-time {
      text-align: left;
    }
  }

  td {
    border-bottom: 1px solid var(--wrd-line);

    &.is-time {
      text-align: left;
      white-space: nowrap;
      color: var(--wrd-text-2);
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.wrd-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.wrd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 18px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  color: #5b6b82;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease,
    box-shadow 0.16s ease;

  &:hover:not(:disabled) {
    border-color: #a9c9ec;
    color: #2b7fd4;
  }

  &.is-primary {
    border-color: var(--wrd-accent);
    background: var(--wrd-accent);
    color: #fff;

    &:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }

  /* ⚠️ icon 必须 flex 居中（项目约定） */
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 6px;
    font-size: 14px;
  }
}
</style>

<!-- dialog 挂在 body 上，改它内部结构（标题/页脚内边距）必须非 scoped（同 AtomConfirmDialog）。
     --wrd-* 变量也声明在这里：这是**body 内容与 footer slot 的共同祖先** ——
     声明在 .wrd（body 里）上的话 footer 的按钮拿不到（scoped 下 slot 内容不是 .wrd 的后代）。 -->
<style lang="scss">
.wrd-dialog {
  --wrd-accent: #2563eb;
  --wrd-text: #1f2937;
  --wrd-text-2: #5b6b82;
  --wrd-text-3: #97a3b6;
  --wrd-line: #e9edf5;
  --wrd-head-bg: #f6f8fb;

  border-radius: 10px;

  .el-dialog__header {
    padding: 18px 22px 14px;
    border-bottom: 1px solid #e9edf5;
  }

  .el-dialog__headerbtn {
    top: 20px;
    right: 20px;
    font-size: 16px;
  }

  .el-dialog__body {
    padding: 4px 22px 0;
  }

  .el-dialog__footer {
    padding: 16px 22px 20px;
  }
}
</style>
