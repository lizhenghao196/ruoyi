<template>
  <el-dialog
    :visible="visible"
    custom-class="eu-dialog"
    width="560px"
    top="18vh"
    append-to-body
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div slot="title" class="eu-title">修改实施人</div>

    <!--
      校验走 Element 的 el-form（rules + validate），不手搓红字：
        · 红字由 el-form-item 自己渲染（.el-form-item__error），字段各自挂在各自那行下面
        · 必填星号也是 el-form-item 按 rules 里的 required 自动加的，不用手写
        · 提交时 `this.$refs.form.validate()` 一把过，校验不过就不会 emit
      `:disabled` 放在 el-form 上：Element 会把它透传给内部所有控件
      （el-input / el-select 都读 elForm.disabled），不用逐个写。
    -->
    <el-form
      ref="form"
      class="eu-form"
      :model="form"
      :rules="rules"
      label-width="89px"
      :disabled="submitting"
      @submit.native.prevent
    >
      <el-form-item label="工单号" prop="orderText" required>
        <el-input
          v-model="form.orderText"
          placeholder="多个工单请使用英文逗号,分割"
        />
      </el-form-item>

      <!-- 指定用户：1000 个用户必须能搜，中英文名都要能搜（见下方 filter-method 说明） -->
      <el-form-item label="指定用户" prop="userId" required>
        <el-select
          v-model="form.userId"
          class="eu-select"
          placeholder="请选择指定用户"
          filterable
          :filter-method="onFilter"
          :loading="usersLoading"
          @visible-change="onDropdownToggle"
        >
          <el-option
            v-for="u in matchedUsers"
            :key="u.userId"
            :label="u.nickName"
            :value="u.userId"
          >
            <span class="eu-opt">
              <span class="eu-opt__name">{{ u.nickName }}</span>
              <span class="eu-opt__account">{{ u.userName }}</span>
            </span>
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>

    <div slot="footer" class="eu-foot">
      <button type="button" class="eu-btn" :disabled="submitting" @click="onClose">
        取消
      </button>
      <button
        type="button"
        class="eu-btn is-primary"
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
 * 修改实施人
 *
 * 哑组件（同 SilenceDialog / SmsSettingDialog）：**不自己调接口**，
 * 用户列表由父组件在进页面时拉好传进来（见 index.vue 的 fetchUsers），
 * 工单号 + 选中的人通过 `submit` 抛给父组件，由父组件拼请求体。
 *
 * ## 校验：用 Element 的 el-form，不手搓
 * 曾经是自己维护 `orderError` / `userError` 再渲染 `<p>` 红字 —— 那不是 Element 的校验，
 * 也拿不到它的行为（失焦即校验、`clearValidate`、`validate()` 一把过、label 的必填星号）。
 * 现在：
 *   · `rules` + `el-form-item` 的 `prop`，红字交给 `.el-form-item__error`（位置/时机都是 Element 定的）；
 *   · 必填星号由 `el-form-item` 按 rules 里的 `required` 自动加；
 *   · `submit()` 里 `await this.$refs.form.validate()`，reject 就直接 return，红字已经出来了。
 * 两个字段**各自是各自的 `el-form-item`**，所以红字只会挂在自己那一行下面 ——
 * 共用一个错误行的话「请输入工单号」会显示在「指定用户」下面，看着像搞错了字段。
 *
 * 为什么「确定」不置灰：参考截图里就是点了才出红字。所以 `disabled` 只跟 `submitting`，
 * 校验交给 `validate()`，别改成 `:disabled="!valid"`。
 *
 * ## ⚠️ 坑：rules 里**不能**写 `required: true`（本项目 element-ui 依赖的 async-validator 是 1.8.5）
 * 看着最自然的写法是 `{ required: true, message: '请选择指定用户', trigger: 'change' }`，
 * 但那个 `trigger` 会让规则**落不到「纯非空」校验上**：
 *
 *   async-validator/lib/index.js  getValidationMethod(rule)
 *     · rule.validator 是函数        -> 直接用你的函数（**不做类型检查**）
 *     · 去掉 message 后只剩 required -> validators.required（纯非空，**不做类型检查**）
 *     · 其余                         -> validators[getType(rule)]，而 getType 默认返回 **'string'**
 *
 * 第三条意味着：`{required, message, trigger}` 会被当成 **string 类型**去校验，
 * 而 `el-select` 的 value 是**数字** `userId`（1015）—— 数字过不了 string 类型检查，
 * 于是**选了人也永远提交不了**（报的还是「请选择指定用户」，看着像没选）。
 * 已实测：数字 1015 被拒、字符串 '1015' 通过。
 *
 * 所以这里：
 *   · `rules` 里**只放自定义 validator**（走第一条分支，不做类型检查，数字/字符串都吃得下）；
 *   · 必填星号交给 `el-form-item` 的 `required` prop（它顺带补一条只有 required 一个键的规则，
 *     走第二条分支，同样是纯非空）。
 * 这样既拿到 Element 的校验行为，又不会被它的类型推断坑到。
 *
 * ## 工单号（用户自己填）
 * 空输入框，不自动带入本页的工单（用户明确要求）。
 * 解析规则见 `parseOrderIds`：英文逗号分隔 → trim → 丢空串 → 去重。
 * 后端要的是**数组**（见 api 层 changeExecUser 的入参说明）。
 * 校验也走它 —— 只打了几个逗号（`,,,`）不能算「填了」，所以除了 `required`
 * 还挂了一个自定义 validator。
 *
 * ## 「指定用户」的搜索 —— 自定义 filter-method
 * 需求是**中文名和登录名都能搜到**。Element 内置过滤只匹配 `el-option` 的 `label`
 * （option.vue：`new RegExp(query,'i').test(this.currentLabel)`），
 * 光靠 `label` 做不到「两个字段都匹配」而不动回显（label 一变，选中后输入框里
 * 就会显示成「林佳科 goodops_kzx」）。所以走自定义 `filter-method`：
 *   - `filter-method` 只把关键词记到 `keyword`（它拿到的是**完整**的当前输入值）；
 *   - 下拉里渲染的是 `matchedUsers` —— 按 keyword 过滤 nickName **和** userName，
 *     不区分大小写，两边任一命中即可。
 * 这样 `label` 还能保持是 `nickName`，选中后输入框里只显示中文名。
 *
 * 为什么可以这样「自己筛」而不会把 Element 的「无数据」文案搞坏：
 * Element 只在**没有** `filter-method` 时才自己过滤 option；此时
 * `filteredOptionsCount` 由每个 ElOption 在 created 时 `++`（option.vue:149）维护，
 * 正好等于我们渲染出来的条数，所以「一条都不匹配 → 显示无数据」仍然正确。
 *
 * ⚠️ 下拉每次打开都要把 `keyword` 清空（见 onDropdownToggle）。不清的话，
 * 上次搜的词会留着，重新打开会看到一个被旧词筛过的列表，
 * 而输入框里显示的是选中的人名 —— 看着就像搜索坏了。
 * （Element 自己也是这个语义：打开时把 query 设成已选项的 label 并且不做过滤。）
 *
 * 顺带纠正一个曾经的误判：Element 在 `handleQueryChange` 里对
 * `previousQuery === null` 的第一次变化直接 return（不调 filterMethod），
 * 但**下拉打开时自己就会先走一遍这个分支**（visible watcher 里
 * `query = selectedLabel; handleQueryChange(query)`），所以「用户敲的第一个字符
 * 收不到」并不成立 —— 第一个字符能正常进来。真正需要自己兜的是上面的 keyword 残留。
 */
export default {
  name: "ExecUserDialog",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 全部用户：[{ userId, userName, nickName }]
    users: {
      type: Array,
      default: () => [],
    },
    // 用户列表还在拉
    usersLoading: {
      type: Boolean,
      default: false,
    },
    // 提交中：期间禁用控件并禁止关闭
    submitting: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      // el-form 的 model。两个字段都在这里，`prop` 直接对得上，别拆成两个变量。
      form: {
        // 工单号原始文本（解析在提交时做）
        orderText: "",
        // 选中的 userId（null = 没选）。每次打开都清空 —— 截图里打开时是空的，
        // 而且「改实施人」是个明确的一次性动作，不该默认沿用上次选的人。
        userId: null,
      },
      // 校验规则。**只放自定义 validator，刻意不写 `required: true`** —— 原因见下面的长注释。
      // 必填星号由 el-form-item 的 `required` prop 提供（它会给 label 加星号，
      // 并且额外补一条只有 `required` 一个键的规则，那条走的是「纯非空」校验，不查类型）。
      rules: {
        orderText: [{ validator: this.validateOrderText, trigger: "blur" }],
        userId: [{ validator: this.validateUserId, trigger: "change" }],
      },
      // 指定用户下拉的搜索关键词（由 filter-method 写入，见 onFilter）
      keyword: "",
    };
  },
  computed: {
    /**
     * 下拉里真正渲染的用户 —— 按 keyword 同时匹配中文名和登录名。
     *
     * 空关键词返回原数组（不复制）：Element 打开下拉时会走到这里，
     * 每次都新建数组会让 option 全量重建，白白抖一下。
     */
    matchedUsers() {
      const kw = this.keyword.toLowerCase();
      const list = this.users || [];
      if (!kw) {
        return list;
      }
      return list.filter((u) => {
        const name = String(u.nickName || "").toLowerCase();
        const account = String(u.userName || "").toLowerCase();
        return name.indexOf(kw) > -1 || account.indexOf(kw) > -1;
      });
    },
  },
  watch: {
    visible(val) {
      if (!val) {
        return;
      }
      this.resetForm();
    },
  },
  methods: {
    /**
     * 每次打开都清空输入与校验痕迹。
     *
     * `clearValidate()` 必须等一拍：el-dialog 的 body 是**懒渲染**的，
     * 首次打开时 `$refs.form` 这一拍还不存在。不清的话，上次打开留下的红字
     * 会跟着带到下一次（el-dialog 默认不销毁内容）。
     */
    resetForm() {
      this.form.orderText = "";
      this.form.userId = null;
      this.keyword = "";
      this.$nextTick(() => {
        const form = this.$refs.form;
        if (form) {
          form.clearValidate();
        }
      });
    },

    /**
     * 工单号校验：按真实解析结果判，而不是只看非空。
     * 只打了几个逗号（`,,,`）时 `required` 会放过去，但解析出来是空数组 —— 那不算填了。
     */
    validateOrderText(rule, value, callback) {
      if (!this.parseOrderIds(value).length) {
        callback(new Error("请输入工单号"));
        return;
      }
      callback();
    },

    /**
     * 指定用户校验：除了非空，还要**确实在名单里**。
     * 名单是接口给的，理论上选不出名单外的人；但用户列表可能在弹窗开着的时候被换掉
     * （或接口给了脏 userId），那样提交出去的后端也认不了，所以这里兜一下。
     */
    validateUserId(rule, value, callback) {
      if (value === null || value === undefined || value === "") {
        callback(new Error("请选择指定用户"));
        return;
      }
      const hit = (this.users || []).some(
        (u) => String(u.userId) === String(value)
      );
      if (!hit) {
        callback(new Error("请选择指定用户"));
        return;
      }
      callback();
    },

    /**
     * 下拉搜索（自定义 filter-method）。
     *
     * 只负责记录关键词，过滤交给 `matchedUsers`。**不要**在这里直接改 option 的显隐 ——
     * 我们控制的是「渲染哪些 option」，那才是唯一数据源。
     */
    onFilter(query) {
      this.keyword = String(query == null ? "" : query).trim();
    },

    /**
     * 下拉开合。
     *
     * 打开时清空关键词：Element 打开时是「不过滤」语义（把 query 设成已选项的 label
     * 且不触发过滤），我们得跟上，否则会拿上次的词筛出一个列表，
     * 和输入框里显示的人名对不上。
     */
    onDropdownToggle(open) {
      if (open) {
        this.keyword = "";
      }
    },

    /**
     * 把「工单号」输入框的内容解析成数组。
     *
     * 只认英文逗号（placeholder 里也是这么说的）；中文逗号 `，` 一并容错 ——
     * 从 Excel/工单系统粘过来常常是中文逗号，为此报「格式不对」不值得。
     * 顺带 trim + 丢空串 + 去重：用户很容易多打一个逗号，或者把同一个工单写两遍。
     */
    parseOrderIds(text) {
      const ids = [];
      const seen = {};
      String(text == null ? "" : text)
        .split(/[,，]/)
        .forEach((part) => {
          const id = part.trim();
          if (!id || seen[id]) {
            return;
          }
          seen[id] = true;
          ids.push(id);
        });
      return ids;
    },

    /**
     * 提交。
     *
     * `validate()` 不带回调时返回 Promise，校验不过会 **reject**（带 invalidFields），
     * 所以这里 try/catch 兜住 —— 红字 el-form-item 已经渲染了，直接 return 就行。
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
      const hit = (this.users || []).find(
        (u) => String(u.userId) === String(this.form.userId)
      );
      if (!hit) {
        return;
      }
      this.$emit("submit", {
        orderIds: this.parseOrderIds(this.form.orderText),
        userId: hit.userId,
        userName: hit.userName,
        nickName: hit.nickName,
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
.eu-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #1f2937;
}

/* el-select 默认是 inline-block，这里让它撑满整行 */
.eu-select {
  width: 100%;
}

/* 下拉项：左边中文名、右边登录名（与参考截图一致） */
.eu-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__account {
    flex: none;
    color: #8492a6;
    font-size: 12px;
  }
}

.eu-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.eu-btn {
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
  （同 SilenceDialog / SmsSettingDialog）。
  el-form 的样式在这里统一收：label 左对齐、字号、错误红字颜色 ——
  布局仍交给 Element 自己的 flex/float，不要重写它的定位（红字是绝对定位的）。
-->
<style lang="scss">
.eu-dialog {
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

  /* 标签左对齐（Element 默认右对齐），与参考截图一致 */
  .el-form-item__label {
    padding-right: 8px;
    font-size: 13px;
    color: #3d4a5c;
    text-align: left;
  }

  /* 校验红字：颜色对齐参考截图，字号收小 */
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
