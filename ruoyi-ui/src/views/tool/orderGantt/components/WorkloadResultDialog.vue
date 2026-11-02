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

      <!-- 人数 >= 1 时说明这个数字是怎么来的（2026-11-02 用户需求）：
           可见区**只写当前这个数字走的那条逻辑**；完整的（两条逻辑 + 取大 + 口径演算）
           挂在左边的小 i 图标上，鼠标悬浮才出现。
           0 人时 explain 为 null，整块不渲染（用户只要求 >= 1 时说明）。 -->
      <div v-if="explain" class="wrd__why">
        <div class="wrd__why-head">
          <!-- i 小图标 = 完整逻辑的悬浮入口（enterable：鼠标能移进卡片里看） -->
          <el-tooltip
            placement="top-start"
            effect="light"
            popper-class="wrd-why-pop"
            :enterable="true"
            :open-delay="80"
          >
            <div slot="content" class="wrd-why-pop__body">
              <div class="wrd-why-pop__title">完整计算逻辑</div>
              <div
                v-for="r in popRows"
                :key="r.key"
                class="wrd-why-pop__row"
                :class="{ 'is-final': r.final, 'is-win': r.win }"
              >
                <span class="wrd-why-pop__k">{{ r.label }}</span>
                <span class="wrd-why-pop__v"><span v-for="(p, i) in r.parts" :key="i" :class="{ 'is-num': p.b, 'is-nw': p.nw }">{{ p.t }}</span></span>
              </div>
              <p class="wrd-why-pop__note"><span v-for="(p, i) in lines.note" :key="i" :class="{ 'is-num': p.b, 'is-nw': p.nw }">{{ p.t }}</span></p>
            </div>
            <span class="wrd__why-head-icon is-help">
              <i class="el-icon-info" />
            </span>
          </el-tooltip>
          <span>人数计算说明</span>
          <span class="wrd__why-head-hint">悬停图标查看完整逻辑</span>
        </div>

        <!-- 只展示决定当前人数的那条逻辑 -->
        <div class="wrd__why-item is-win is-final">
          <span class="wrd__why-k">{{ winnerLabel }}</span>
          <span class="wrd__why-v"><span v-for="(p, i) in winnerParts" :key="i" :class="{ 'is-num': p.b, 'is-nw': p.nw }">{{ p.t }}</span></span>
        </div>
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
 *
 * ⚠️ 「人数计算说明」那块（2026-11-02 用户需求）用的是 `workloadCalc.js` 的**纯函数**
 *    `explainStaffResult(result)` + `buildExplainLines(explain)` —— 只把 par 解读成文案，
 *    不调接口、不重算人数，也不改 par 本身（par 会原样 POST 到后端，不能多塞字段）。
 *    所以没有破坏「哑组件」约定。
 *    展示分工：可见区**只写决定当前人数的那条逻辑**；完整的两条逻辑 + 取大 + 口径演算
 *    挂在小 i 图标的 el-tooltip 里（popper 挂在 body 上，样式写在文件末尾的非 scoped 块）。
 */
import { buildExplainLines, explainStaffResult } from '../workloadCalc'

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
    },
    /**
     * 人数 >= 1 时的「这个数字是怎么来的」说明数据；0 人 / 没结果 → null（整块不渲染）。
     * 全部由 par 现算（纯函数），不新增 prop，也不往 par 里塞字段。
     */
    explain() {
      return explainStaffResult(this.result)
    },
    /** 文案分段（纯函数拼好）：{ peak, run, summary, note } */
    lines() {
      return buildExplainLines(this.explain)
    },
    /** 可见区只渲染决定当前人数的那条逻辑（逻辑二用精简版：不带时间段，避免把「N 人」挤到下一行） */
    winnerParts() {
      if (!this.explain || !this.lines) {
        return []
      }
      return this.explain.winner === 'run' ? this.lines.runBrief : this.lines.peak
    },
    winnerLabel() {
      return this.explain && this.explain.winner === 'run'
        ? '逻辑二 · 连续超载'
        : '逻辑一 · 单时段峰值'
    },
    /** 悬浮卡片里的完整过程：两条逻辑 + 取大结论（决定项加重） */
    popRows() {
      if (!this.explain || !this.lines) {
        return []
      }
      const w = this.explain.winner
      return [
        { key: 'peak', label: '逻辑一 · 单时段峰值', parts: this.lines.peak, win: w === 'peak' },
        { key: 'run', label: '逻辑二 · 连续超载', parts: this.lines.run, win: w === 'run' },
        { key: 'sum', label: '取较大值', parts: this.lines.summary, final: true }
      ]
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

/* 「人数计算说明」块（2026-11-02 用户需求）：人数 >= 1 才渲染。
   变量 --wrd-* 声明在非 scoped 的 .wrd-dialog 上（body 内容的祖先），这里可以直接用。 */
.wrd__why {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid #e4ecf7;
  border-left: 3px solid var(--wrd-accent);
  border-radius: 8px;
  background: #f7faff;

  &-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--wrd-text);

    &-icon {
      /* ⚠️ icon 必须 flex 居中（项目约定） */
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      color: var(--wrd-accent);
      border-radius: 50%;
      transition: background 0.16s ease, color 0.16s ease;

      /* i 图标 = 完整逻辑的悬浮入口：给「可交互」的提示 */
      &.is-help {
        cursor: help;

        &:hover {
          background: rgba(37, 99, 235, 0.1);
        }
      }
    }

    &-hint {
      margin-left: auto;
      font-size: 11px;
      font-weight: 400;
      color: var(--wrd-text-3);
    }
  }

  &-item {
    /* 标签在上、算式在下（一行标签一列算式并排的话，「逻辑一 · 单时段峰值」会把
       92px 的标签列撑成两行，第二行只剩「峰值」孤零零吊着） */
    display: block;
    font-size: 12px;
    line-height: 1.7;
    color: var(--wrd-text-2);

    & + & {
      margin-top: 6px;
    }

    /* 最终人数由哪条逻辑决定 → 那一条加重，另一条保持浅色 */
    &.is-win {
      color: var(--wrd-text);
    }

    &.is-final {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #dde7f5;
      color: var(--wrd-text);
    }
  }

  &-k {
    display: block;
    font-size: 11px;
    line-height: 1.6;
    color: var(--wrd-text-3);
  }

  &-v {
    display: block;
  }

  /* 文案分段（buildExplainLines 的 { b } / { nw }）—— 数字强调、时间段不许断行。
     段是 <span>，不是 <b>：分段渲染时标签统一，样式只管这两个类。
     悬浮卡片里的同名类在下面非 scoped 的 .wrd-why-pop 里另有一份（popper 挂在 body 上）。 */
  &-v .is-num {
    font-weight: 600;
    color: var(--wrd-accent);
    font-variant-numeric: tabular-nums;
    /* 「3 人」不许在数字和「人」之间断行 */
    white-space: nowrap;
  }

  /* 时间段（18:00 - 20:00）整段不断行 —— 否则会在连字符处断成「18:00 - 20:0 / 0」 */
  &-v .is-nw {
    white-space: nowrap;
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

/* 「完整计算逻辑」悬浮卡片（i 图标的 popper，2026-11-02 用户需求）。
   ⚠️ popper 挂在 body 上、**不在 .wrd-dialog 里面**，所以：
      ① 样式只能写在这里（非 scoped）—— scoped 选择器带 data-v 属性，popper 节点上没有；
      ② --wrd-* 变量继承不到，必须在这里再声明一份（和 append-to-body 是同一类坑）。 */
.el-tooltip__popper.wrd-why-pop {
  --wrd-accent: #2563eb;
  --wrd-text: #1f2937;
  --wrd-text-2: #5b6b82;
  --wrd-text-3: #97a3b6;

  max-width: 470px;
  padding: 12px 14px;
  border: 1px solid #e4ecf7;
  border-radius: 8px;
  box-shadow: 0 10px 26px rgba(15, 35, 70, 0.14);
  font-size: 12px;
  line-height: 1.7;
  color: var(--wrd-text-2);

  .wrd-why-pop__title {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--wrd-text);
  }

  .wrd-why-pop__row {
    & + & {
      margin-top: 6px;
    }

    /* 决定项加重，另一条保持浅色（和弹窗里的可见区同一套语义） */
    &.is-win {
      color: var(--wrd-text);
    }

    &.is-final {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #dde7f5;
      color: var(--wrd-text);
    }
  }

  .wrd-why-pop__k {
    display: block;
    font-size: 11px;
    line-height: 1.6;
    color: var(--wrd-text-3);
  }

  .wrd-why-pop__v {
    display: block;
  }

  .is-num {
    font-weight: 600;
    color: var(--wrd-accent);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .is-nw {
    white-space: nowrap;
  }

  .wrd-why-pop__note {
    margin: 8px 0 0;
    padding-top: 7px;
    border-top: 1px dashed #dde7f5;
    font-size: 11px;
    line-height: 1.7;
    color: var(--wrd-text-3);
  }
}
</style>
