<template>
  <el-dialog
    :visible="visible"
    custom-class="sd-dialog"
    width="520px"
    top="18vh"
    append-to-body
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div slot="title" class="sd-title">设置静默时长</div>

    <div class="sd">
      <div class="sd-form">
        <span class="sd-form__required">*</span>
        <span class="sd-form__label">静默时长</span>
        <div class="sd-form__input">
          <el-input
            :value="delayMin"
            placeholder="请输入数字"
            @input="onInput"
            @keyup.enter.native="submit"
          >
            <span slot="append">min(分钟)</span>
          </el-input>
        </div>
      </div>

      <div class="sd-tips">
        <span class="sd-tips__label">温馨提示：</span>
        <span class="sd-tips__body">
          1.静默只针对【结果待确认】的消息提醒类型<br />
          2.设置静默时长为0，表示取消消息提醒静默
        </span>
      </div>
    </div>

    <div slot="footer" class="sd-foot">
      <button type="button" class="sd-btn" :disabled="submitting" @click="onClose">取消</button>
      <button
        type="button"
        class="sd-btn is-primary"
        :disabled="submitting || !valid"
        @click="submit"
      >
        {{ submitting ? '提交中…' : '确定' }}
      </button>
    </div>
  </el-dialog>
</template>

<script>
/**
 * 设置静默时长
 *
 * 纯输入组件：不碰接口，只把合法的分钟数抛给父组件。
 * 提交中禁止关闭（点 × / ESC / 取消都会被拦），避免请求还在飞就把上下文丢了。
 *
 * ⚠️ 允许输入 0 —— 0 表示**取消静默**（见下方温馨提示），不是「静默 0 分钟」。
 * 后端拿到 0 后取消静默，节点上的静音图标随之消失。
 */
import { DELAY_MAX_MINUTES } from '../nodeParams'

export default {
  name: 'SilenceDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    // 提交中：由父组件控制，期间禁用按钮并禁止关闭
    submitting: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      // 初始为空（截图里 placeholder 是「请输入数字」），由用户自己填
      delayMin: '',
      DELAY_MAX_MINUTES
    }
  },
  computed: {
    /**
     * 必须是 0 ~ 1440 的整数，且不能为空。
     * 注意 Number('') === 0，所以空值必须单独拦掉，不能只判断数字范围。
     */
    valid() {
      const raw = this.delayMin
      if (raw === '' || raw === null || raw === undefined) {
        return false
      }
      const n = Number(raw)
      return Number.isInteger(n) && n >= 0 && n <= DELAY_MAX_MINUTES
    }
  },
  watch: {
    // 每次打开都清空，避免带上一次的输入
    visible(val) {
      if (val) {
        this.delayMin = ''
      }
    }
  },
  methods: {
    // 只允许数字：截图里的输入框是普通文本框，这里顺手把非数字字符滤掉，并去掉前导零
    onInput(val) {
      const s = val === null || val === undefined ? '' : String(val)
      this.delayMin = s.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '')
    },
    submit() {
      if (this.submitting || !this.valid) {
        return
      }
      this.$emit('submit', Number(this.delayMin))
    },
    onClose() {
      if (this.submitting) {
        return
      }
      this.$emit('close')
    }
  }
}
</script>

<style lang="scss" scoped>
.sd-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #1f2937;
}

.sd {
  padding: 4px 0;
}

.sd-form {
  display: flex;
  align-items: center;
  margin-bottom: 20px;

  &__required {
    flex: none;
    width: 11px;
    color: #c73b3b;
    font-size: 13px;
    line-height: 1;
  }

  &__label {
    flex: none;
    width: 74px;
    font-size: 13px;
    color: #3d4a5c;
  }

  &__input {
    flex: 1;
    min-width: 0;
  }
}

/* 温馨提示：第一行以「温馨提示：」开头，第二行与「1.」左对齐 */
.sd-tips {
  display: flex;
  font-size: 12px;
  line-height: 1.9;
  color: #8492a6;

  &__label {
    flex: none;
    white-space: nowrap;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }
}

.sd-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.sd-btn {
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

/* el-input 是 Element 默认样式，这里只收一下字号和后缀底色 */
.sd-form__input ::v-deep {
  .el-input__inner {
    font-size: 13px;
  }

  .el-input-group__append {
    padding: 0 14px;
    background: #f5f7fa;
    color: #8492a6;
    font-size: 12px;
  }
}
</style>

<!-- dialog 挂载在 body 上，覆盖 el-dialog 内部样式需非 scoped（同 alarmAnalysis / bill 页做法） -->
<style lang="scss">
.sd-dialog {
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
