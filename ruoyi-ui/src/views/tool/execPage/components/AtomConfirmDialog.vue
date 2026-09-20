<template>
  <el-dialog
    :visible="visible"
    custom-class="ac-dialog"
    width="500px"
    top="18vh"
    append-to-body
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div slot="title" class="ac-title">原子确认</div>

    <!-- 明细是异步拉的：数据没回来时先给遮罩，别让人对着空白点按钮 -->
    <div v-loading="loading" class="ac">
      <p class="ac-desc">{{ desc }}</p>
    </div>

    <div slot="footer" class="ac-foot">
      <button type="button" class="ac-btn" :disabled="submitting" @click="onClose">
        取消
      </button>
      <button
        type="button"
        class="ac-btn is-primary"
        :disabled="disabled || submitting"
        @click="onConfirm"
      >
        {{ submitting ? '提交中…' : '确认完成' }}
      </button>
    </div>
  </el-dialog>
</template>

<script>
/**
 * 人工确认节点 —— 双击节点弹出的「原子确认」小弹窗
 *
 * 与「查看明细」弹窗的关系：
 *   · 双击**人工确认节点** -> 弹这个（节点上只有一个原子，没必要铺一整张表）；
 *   · 双击**其它节点**     -> 直接走「查看明细」（由 index.vue 分流，见 onNodeDblclick）；
 *   · 右键 -> 查看明细     -> 任何时候都能开明细弹窗。
 *
 * 「确认完成」的链路与明细弹窗里的那个**完全一样**（都落到父组件的 submitAtom ->
 * `PUT /release/atomInstance` + `aaiAtomStatus: 'SUCCESS'`），
 * 所以这里也照「哑组件」的规矩来：**不自己调接口**，只把原子抛给父组件（`@confirm`）。
 *
 * 描述文案取自**节点**的 `aniNodeDomurl`（参考实现：`this.atomDesc = ite.aniNodeDomurl`），
 * 为空时给明确占位，不编假数据。
 */
export default {
  name: "AtomConfirmDialog",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 当前节点（取 aniNodeDomurl / aniStatus）
    node: {
      type: Object,
      default: null,
    },
    // 该节点下的原子明细（人工节点只有 1 条；这里只用 [0]）
    atoms: {
      type: Array,
      default: () => [],
    },
    // 正在拉原子明细
    loading: {
      type: Boolean,
      default: false,
    },
    // 正在提交「确认完成」
    submitting: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    atom() {
      return (this.atoms && this.atoms[0]) || null;
    },
    desc() {
      return (this.node && this.node.aniNodeDomurl) || "（无人工确认描述）";
    },
    nodeStatus() {
      return (this.node && this.node.aniStatus) || "";
    },
    /**
     * 「确认完成」的置灰规则 —— 与明细弹窗里的 `isConfirmDisabled` **逐条一致**（三条）：
     *   节点 `CANCELLED` / 原子 `SUCCESS` / 节点 `INIT`。
     *
     * ⚠️ 副作用（与明细弹窗相同）：mock 里两个人工确认节点都是 `INIT`，
     *    所以按钮是**显示但置灰**的 —— 不是「没做」，是当前状态确实不能确认。
     *    另外原子还没拉回来（`!atom`）时也置灰，避免拿到 undefined 去调接口。
     */
    disabled() {
      return (
        !this.atom ||
        this.nodeStatus === "CANCELLED" ||
        this.atom.aaiAtomStatus === "SUCCESS" ||
        this.nodeStatus === "INIT"
      );
    },
  },
  methods: {
    onConfirm() {
      if (this.disabled || this.submitting || !this.atom) {
        return;
      }
      this.$emit("confirm", this.atom);
    },
    // 提交中不许关（点 × / ESC / 取消都会被拦），避免请求还在飞就把上下文丢了
    onClose() {
      if (this.submitting) {
        return;
      }
      this.$emit("close");
    },
  },
};
</script>

<style lang="scss" scoped>
.ac-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #1f2937;
}

.ac {
  min-height: 56px;
  padding: 2px 0 6px;
}

/* 描述可能是一整条 URL，必须允许断行，否则会把弹窗撑出横向滚动 */
.ac-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #3d4a5c;
  word-break: break-all;
  white-space: pre-wrap;
}

.ac-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.ac-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 22px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #5b6b82;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;

  &:hover:not(:disabled) {
    border-color: #a9c9ec;
    color: #2b7fd4;
  }

  &.is-primary {
    background: #2b7fd4;
    border-color: #2b7fd4;
    color: #fff;

    &:hover:not(:disabled) {
      background: #1f6fbf;
      border-color: #1f6fbf;
      color: #fff;
    }
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}
</style>

<!-- dialog 挂载在 body 上，覆盖 el-dialog 内部样式需非 scoped（同 SilenceDialog 做法） -->
<style lang="scss">
.ac-dialog {
  border-radius: 8px;

  .el-dialog__header {
    padding: 18px 22px 14px;
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
