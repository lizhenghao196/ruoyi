<template>
  <el-dialog
    :visible="visible"
    custom-class="sms-dialog"
    width="520px"
    top="18vh"
    append-to-body
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div slot="title" class="sms-title">设置消息推送</div>

    <!--
      校验走 Element 的 el-form（同 ExecUserDialog）：红字由 el-form-item 渲染，
      必填星号由它按 rules / required 给。`:disabled` 放在 el-form 上，
      Element 会透传给 el-switch / el-input（都读 elForm.disabled）。
    -->
    <el-form
      ref="form"
      class="sms-form"
      :model="form"
      :rules="rules"
      label-width="77px"
      :disabled="submitting"
      @submit.native.prevent
    >
      <!-- 消息推送开关：文案是「关闭 ← 开关 → 开启」，与参考截图一致。
           这一行没有校验，所以不挂 prop（el-form-item 只对带 prop 的注册 field）。 -->
      <el-form-item label="消息推送">
        <div class="sms-switch">
          <span class="sms-switch__side">关闭</span>
          <el-switch v-model="form.sendOn" active-color="#2b7fd4" />
          <span class="sms-switch__side">开启</span>
        </div>
      </el-form-item>

      <!--
        群组ID：**只在开启推送时必填**（rules 是 computed，见那里）。
        `:required` 跟开关走 —— el-form-item 的星号是从 rules 推出来的，
        「星号恒显但只在开启时校验」用它的内置星号表达不了。
      -->
      <el-form-item label="群组ID" prop="groupId" :required="form.sendOn">
        <el-input
          :value="form.groupId"
          placeholder="请输入群组ID"
          @input="onGroupIdInput"
          @keyup.enter.native="submit"
        />
      </el-form-item>
    </el-form>

    <div slot="footer" class="sms-foot">
      <button type="button" class="sms-btn" :disabled="submitting" @click="onClose">
        取消
      </button>
      <button
        type="button"
        class="sms-btn is-primary"
        :disabled="submitting"
        @click="submit"
      >
        {{ submitting ? "提交中…" : "确定" }}
      </button>
    </div>
  </el-dialog>
</template>

<script>
/**
 * 设置消息推送
 *
 * 哑组件（同 SilenceDialog / ExecUserDialog）：**不自己调接口**，只把用户填的东西抛给父组件。
 * 打开前的「查当前状态」由父组件负责（见 index.vue 的 openSmsSetting），
 * 所以这里没有 loading —— 弹窗出现时 sendOn / groupId 已经是查回来的值。
 *
 * 出入参都用**布尔**，不用接口的 'Y' / 'N'：
 * 把 'Y' / 'N' 的翻译收在页面那一层（它才是调接口的人），组件不认线上协议。
 *
 * 提交中禁止关闭（点 × / ESC / 取消都会被拦），避免请求还在飞就把上下文丢了。
 *
 * ## 校验：用 Element 的 el-form
 * 曾经是自己算一个 `valid` 去置灰「确定」按钮 —— 那不是 Element 的校验，
 * 也没法告诉用户**为什么**不能提交。现在：
 *   · `rules`（computed，见下）+ `el-form-item` 的 `prop`，红字交给 `.el-form-item__error`；
 *   · `submit()` 里 `await this.$refs.form.validate()`，reject 就直接 return；
 *   · 必填星号由 `:required="form.sendOn"` 提供。
 * 配套地，**「确定」不再按校验结果置灰**（`disabled` 只跟 `submitting`）：
 * 按钮一旦置灰，el-form 的校验就永远没机会把红字显示出来，用户只看到一个不能点的灰按钮。
 * 这与 ExecUserDialog 的取舍一致（那边也是「点了才给红字」）。
 *
 * ## 群组ID 只在**开启推送**时必填
 * 关闭推送不该被一个空的群组 ID 卡住 —— 用户可能就是想先把推送关掉。
 * 实现方式是把 `rules` 写成 computed：关闭时给 `[]`。
 * ⚠️ 别想着「用 el-form-item 的 required 恒显星号、只让校验有条件」——
 * Element 的 `required` prop 会**额外补一条 `{required:true}` 规则**去校验非空，
 * 星号和校验是绑在一起的，分不开。所以星号也跟着开关走。
 */
export default {
  name: "SmsSettingDialog",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 打开时的初始开关状态（父组件查接口拿到的 send 翻译而来）
    sendOn: {
      type: Boolean,
      default: false,
    },
    // 打开时的初始群组 ID；0 是「未配置」的合法值，会照原样显示成 "0"
    groupId: {
      type: [String, Number],
      default: 0,
    },
    // 提交中：由父组件控制，期间禁用按钮并禁止关闭
    submitting: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      // el-form 的 model（用户改的是它，props 只用来初始化）
      form: {
        sendOn: false,
        // 存**字符串**：这样「清空输入框」能如实表示成 ''，
        // 而不是被 Number('') === 0 悄悄变成 0（这个坑静默弹窗那边踩过）
        groupId: "",
      },
    };
  },
  computed: {
    /**
     * 校验规则。**随开关变** —— 这就是「只在开启时必填」的实现处。
     *
     * 关闭推送时给空数组（校验直接放过）；开启时必须填一个 **> 0 的整数**：
     * `0` 是「未配置群组」，开启后推不到任何地方，属于「看着成功其实没生效」，要拦住。
     */
    rules() {
      if (!this.form.sendOn) {
        return { groupId: [] };
      }
      return { groupId: [{ validator: this.validateGroupId, trigger: "blur" }] };
    },
  },
  watch: {
    // 每次打开都用父组件查回来的值重置本地态，避免带上一次的输入
    visible(val) {
      if (!val) {
        return;
      }
      this.resetForm();
    },
    // 关掉推送时把群组ID 的红字撤掉 —— 那会儿它已经不必填了，
    // 留着一条「请输入群组ID」会让人以为还卡着
    "form.sendOn"() {
      this.clearGroupIdValidate();
    },
  },
  methods: {
    /**
     * 每次打开重置 + 清掉校验痕迹。
     * `clearValidate()` 要等一拍：el-dialog 的 body 是**懒渲染**的，
     * 首次打开时 `$refs.form` 这一拍还不存在。
     */
    resetForm() {
      this.form.sendOn = !!this.sendOn;
      this.form.groupId =
        this.groupId === null || this.groupId === undefined
          ? ""
          : String(this.groupId);
      this.$nextTick(() => {
        const form = this.$refs.form;
        if (form) {
          form.clearValidate();
        }
      });
    },

    clearGroupIdValidate() {
      this.$nextTick(() => {
        const form = this.$refs.form;
        if (form) {
          form.clearValidate("groupId");
        }
      });
    },

    /**
     * 群组ID 校验：必须是 **> 0 的整数**。
     *
     * ⚠️ `Number('') === 0` —— 空值必须**单独**拦掉，不能只判数字范围，
     * 否则「什么都没填」会被当成合法的 0（这个坑静默弹窗那边踩过）。
     */
    validateGroupId(rule, value, callback) {
      if (value === "" || value === null || value === undefined) {
        callback(new Error("请输入群组ID"));
        return;
      }
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        callback(new Error("群组ID 必须是大于 0 的整数"));
        return;
      }
      callback();
    },

    // 只允许数字，并去掉前导零（但保留单独的 '0'）
    onGroupIdInput(val) {
      const s = val === null || val === undefined ? "" : String(val);
      this.form.groupId = s.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    },

    /**
     * 提交。`validate()` 不带回调时返回 Promise，校验不过会 **reject**，
     * 所以 try/catch 兜住 —— 红字 el-form-item 已经渲染了，直接 return 就行。
     * 用 `await` 而不是回调，是为了让 `submit()` 本身可被 await（测试里就这么用）。
     */
    async submit() {
      if (this.submitting) {
        return;
      }
      const form = this.$refs.form;
      if (!form) {
        return;
      }
      try {
        await form.validate();
      } catch (e) {
        return;
      }
      this.$emit("submit", {
        sendOn: !!this.form.sendOn,
        // 关闭推送时群组 ID 允许为空 —— 按接口语义落成 0（未配置）
        groupId: Number(this.form.groupId) || 0,
      });
    },
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
.sms-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #1f2937;
}

/* 消息推送那一行是「关闭 [开关] 开启」三个东西横排 */
.sms-switch {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sms-switch__side {
  font-size: 13px;
  line-height: 1;
  color: #3d4a5c;
}

.sms-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.sms-btn {
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

<!--
  dialog 挂载在 body 上，覆盖 el-dialog / el-form 内部样式需非 scoped
  （同 SilenceDialog / AtomConfirmDialog / ExecUserDialog）。
-->
<style lang="scss">
.sms-dialog {
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

  .el-form-item {
    margin-bottom: 20px;
  }

  /*
    标签左对齐（Element 默认右对齐），与参考截图一致。
    两行都预留出必填星号的位置：Element 的星号是 ::before **内联**在文字前面的，
    有星号的行文字被推右约 11px、没星号的行不推 —— 于是「消息推送」和「群组ID」
    两行标签会错开；而且群组ID 的星号跟着开关出现/消失时，那一行的标签还会左右跳。
    把星号改成绝对定位到预留槽里、标签一律 padding-left: 11px，就都不抖了。
  */
  .el-form-item__label {
    position: relative;
    /* 给必填星号预留的槽（星号被改成绝对定位到 left:0，见下一条） */
    padding-left: 11px;
    padding-right: 8px;
    font-size: 13px;
    color: #3d4a5c;
    text-align: left;
  }

  .el-form-item.is-required:not(.is-no-asterisk) > .el-form-item__label::before {
    position: absolute;
    left: 0;
    margin-right: 0;
  }

  /* 校验红字：颜色对齐参考截图，字号收小（别重写定位，它是绝对定位的） */
  .el-form-item__error {
    padding-top: 2px;
    font-size: 12px;
    color: #c73b3b;
  }

  .el-input__inner {
    font-size: 13px;
  }
}
</style>
