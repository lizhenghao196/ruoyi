<template>
  <el-dialog
    :visible="visible"
    custom-class="bsd-dialog"
    width="60%"
    top="15vh"
    append-to-body
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div slot="title" class="bsd-title">函数批量跳过</div>

    <div class="bsd">
      <!--
        顶部说明：列出这个弹窗支持跳过的函数状态范围。
        后端会按 oneKeyJumpFlag 一把跳，不在这些状态里的函数会被忽略
        —— 这行文案就是用来解释「为什么我点了确定，但有些函数没被跳过」的。
      -->
      <p class="bsd-text">
        支持函数状态<span class="bsd-text__key">未开始</span>、
        <span class="bsd-text__key">执行中</span>、
        <span class="bsd-text__key">重试</span>、
        <span class="bsd-text__key">失败的</span>批量跳过处理
      </p>

      <!--
        三件控件同排（el-form inline）：
          全选原子  switch  - 一键把所有原子勾上（也清空）
          *原子    multi    - 必填：手动选
          *函数    multi    - 必填：手动选（提交时按 (atomId, funcName) 笛卡尔积构造 functionSelList）

        校验走 Element 的 el-form：
          · `.el-form-item__error` 出红字
          · `:required` prop 给必填星号
          · `validate()` Promise 形式 reject 时 try/catch 兜住直接 return

        ⚠️ rules 里**不能**写 `required: true`（同 ExecUserDialog 的坑）：
        `{required, message, trigger}` 会被 async-validator 当 string 类型校验，
        el-select 的 array / number 都过不去。这里只挂自定义 validator。
      -->
      <el-form
        ref="form"
        class="bsd-form"
        :inline="true"
        :model="form"
        :rules="rules"
        :disabled="submitting"
        @submit.native.prevent
      >
        <el-form-item
          label="全选原子"
          class="bsd-form__switch"
          label-width="200"
        >
          <el-switch
            v-model="form.selectAll"
            active-color="#2b7fd4"
            @change="onSelectAllChange"
          />
        </el-form-item>

        <el-form-item
          label="原子"
          prop="atomIdList"
          required
          class="bsd-form__atom"
        >
          <el-select
            v-model="form.atomIdList"
            class="bsd-select"
            placeholder="请选择原子"
            filterable
            clearable
            multiple
            collapse-tags
            @change="onAtomListChange"
            style="width: 250px"
          >
            <el-option
              v-for="atom in atoms"
              :key="atom.aaiInstanceAtomId"
              :label="atom.aaiAtomName"
              :value="atom.aaiInstanceAtomId"
            />
          </el-select>
        </el-form-item>

        <el-form-item
          label="函数"
          prop="funcNameList"
          required
          class="bsd-form__fn"
        >
          <el-select
            v-model="form.funcNameList"
            class="bsd-select"
            placeholder="请选择函数"
            filterable
            clearable
            multiple
            collapse-tags
            style="width: 250px"
          >
            <el-option
              v-for="fn in functionOptions"
              :key="fn"
              :label="fn"
              :value="fn"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <div slot="footer" class="bsd-foot">
      <button
        type="button"
        class="bsd-btn"
        :disabled="submitting || batchLoading"
        @click="onClose"
      >
        取消
      </button>
      <button
        type="button"
        class="bsd-btn is-primary"
        :disabled="submitting"
        :loading="batchLoading"
        @click="submit"
      >
        {{ batchLoading ? "提交中…" : "确定" }}
      </button>
    </div>
  </el-dialog>
</template>

<script>
/**
 * 函数批量跳过
 *
 * 「查看明细」弹窗右上角的入口弹出来的子弹窗，自身完成：
 *   1. 表单校验（el-form / el-form-item）
 *   2. 调 multiAtomFuncSkip（带自己的 batchLoading，让确定按钮转圈）
 *   3. 成功 → emit 'success'，由父组件（AtomDetailDialog）关弹窗 + 重新拉明细
 *   4. 失败 → 留在弹窗让用户改完直接重试（batchLoading 已复位）
 *
 * 与「修改实施人 / 设置消息推送」不同的是，这里**父组件不传 submitting**：
 * submitting 是父组件为「自己正在干别的活」准备的（比如关弹窗前），但本弹窗的
 * 提交是自己跑的，loading 自己管就行。`submitting` prop 仍暴露着，方便父组件
 * 未来想在外面加锁（比如「批量跳过中别关明细弹窗」）时直接传。
 *
 * ## 「全选原子」开关
 * 一键把 dict 里节点下所有原子勾上 / 清空 —— 用户参考实现里直接放在表单第一列，
 * 主要是为了多原子时不用逐个勾。注意**打开**时会清掉 `selectAll`（手动改了
 * 就不再是「全选」语义了），见 onAtomListChange。
 *
 * ## 「函数」下拉的选项
 * 来源是 `atoms[*].functions[*].funcName` 的**全局去重集合**（不看当前选了
 * 哪些原子）—— 因为选函数和选原子是**两个独立维度**，函数名下拉只展示「整个
 * 节点下出现过哪些函数」，提交时按笛卡尔积筛掉那些「这个原子没这个函数名」
 * 的组合（见 buildFunctionSelList）。
 *
 * ## 入参构造（笛卡尔积再按「该原子真有此函数」过滤）
 *   - 对每个「选中的 atomId」和「选中的 funcName」
 *   - 真的去 `this.atoms` 里查这个原子有没有这个函数
 *   - 有 → 入 functionSelList
 *
 * ## 关闭守卫
 * 提交期间禁止点 × / ESC / 取消：batchLoading 期间不让 onClose 通过，
 * 避免请求还在飞就把上下文丢了（与 SilenceDialog / SmsSettingDialog 同套路）。
 */
import { multiAtomFuncSkip } from "@/api/tool/execPlan";

export default {
  name: "BatchSkipDialog",
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 全部可选原子（= 当前节点的明细列表，来自 queryAotmOfNode 的 data[]）
    atoms: {
      type: Array,
      default: () => [],
    },
    /**
     * 提交中：由父组件控制。
     * 平时是 false（父组件没传就当没传）；父组件想在弹窗开着的时候锁住外部动作时传 true。
     */
    submitting: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      // el-form 的 model
      form: {
        selectAll: false,
        atomIdList: [],
        funcNameList: [],
      },
      // 校验规则：**只放自定义 validator**，刻意不写 `required: true`
      // —— 理由同 ExecUserDialog 的坑（async-validator 的 type 推断）。
      rules: {
        atomIdList: [{ validator: this.validateAtomIdList, trigger: "change" }],
        funcNameList: [
          { validator: this.validateFuncNameList, trigger: "change" },
        ],
      },
      // 确定按钮的 loading（提交期间转圈，并禁止关闭）
      batchLoading: false,
    };
  },
  computed: {
    /**
     * 「函数」下拉里实际渲染的函数名 —— 当前节点所有原子下出现过的函数名（去重 + 排序）。
     *
     * **不去重按「选中的原子」过滤**：函数选择和原子选择是两个独立维度，
     * 「选哪个函数」与「在哪个原子下跑」是后端按笛卡尔积解的事。
     * 这里只展示「这个节点下出现过哪些函数名」，让用户看着完整名字选。
     * 提交时再按 (atomId, funcName) 真的查到函数 → 过滤（见 buildFunctionSelList）。
     *
     * 排序：稳定输出顺序，避免下拉里顺序刷新一下变一下（看着像跳）。
     */
    functionOptions() {
      const set = new Set();
      (this.atoms || []).forEach((atom) => {
        (atom.functions || []).forEach((fn) => {
          if (fn && fn.funcName) {
            set.add(fn.funcName);
          }
        });
      });
      return Array.from(set).sort();
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
     * 每次打开都清空表单 + 校验痕迹。
     * `clearValidate()` 要等一拍：el-dialog 的 body 是**懒渲染**的，
     * 首次打开时 `$refs.form` 这一拍还不存在。
     */
    resetForm() {
      this.form.selectAll = false;
      this.form.atomIdList = [];
      this.form.funcNameList = [];
      this.$nextTick(() => {
        const form = this.$refs.form;
        if (form) {
          form.clearValidate();
        }
      });
    },

    /**
     * 「全选原子」开关变化：一键勾选 / 清空。
     *
     * 只在"打开"状态推 atomIdList；不要在用户手动改 atomIdList 时反过来推
     * selectAll —— 那是 onAtomListChange 的活儿。
     */
    onSelectAllChange(val) {
      const all = (this.atoms || []).map((a) => a.aaiInstanceAtomId);
      this.form.atomIdList = val ? all.slice() : [];
      // 手动清空校验痕迹：切 selectAll 不会触发 atomIdList 的 change
      // （setter 写入时机跟 input 不同），这里显式 clearValidate 让红字消失
      this.$nextTick(() => {
        const form = this.$refs.form;
        if (form) {
          form.clearValidate(["atomIdList", "funcNameList"]);
        }
      });
    },

    /**
     * 用户手动改 atomIdList：若数量与"全选"不一致，selectAll 应回到 false。
     *
     * 不去判断"具体是谁"，因为全选 = 数量等于原子总数，所以只要数量对不上就
     * 一定能判定"不是全选"。少一个就当半选，多一个（不会发生，el-select 不让加
     * 不存在的）也合理。
     */
    onAtomListChange() {
      const total = (this.atoms || []).length;
      const len = (this.form.atomIdList || []).length;
      if (this.form.selectAll && len !== total) {
        this.form.selectAll = false;
      }
    },

    /**
     * 原子列表校验：非空。
     *
     * `required: true` 不能写在 rules 里（async-validator 会按 string 类型校验，
     * array 过不去）。所以这里用纯自定义 validator + el-form-item 的 `required` prop
     * 来凑齐「必填星号 + 校验失败的红字」这一对 Element 行为。
     */
    validateAtomIdList(rule, value, callback) {
      if (!Array.isArray(value) || !value.length) {
        callback(new Error("请选择原子"));
        return;
      }
      callback();
    },

    /**
     * 函数列表校验：非空。同 validateAtomIdList 的理由。
     */
    validateFuncNameList(rule, value, callback) {
      if (!Array.isArray(value) || !value.length) {
        callback(new Error("请选择函数"));
        return;
      }
      callback();
    },

    /**
     * 把用户选的「原子 id 数组 + 函数名数组」展开成后端要跳过的函数清单。
     *
     * 笛卡尔积后**过滤掉**那些「这个原子没这个函数」的组合：
     *   - 函数下拉展示的是「节点下出现过的所有函数名」（不去重按选中原子过滤），
     *     所以"选了 atom 101 + 函数 funcA"时，如果 atom 101 真有 funcA 才入清单，
     *     没有就丢弃（不报错 —— 选了不存在的对是用户体感问题，前端不骂）。
     *
     * 同名函数在多个原子下都存在时，会产出多条记录
     * （与 updateFunctionStatus 的 {aaiInstanceAtomId, functionName} 一一对应）。
     */
    buildFunctionSelList() {
      const atomIds = (this.form.atomIdList || []).map(String);
      const fnNames = this.form.funcNameList || [];
      const fnNameSet = new Set(fnNames.map(String));
      const result = [];
      atomIds.forEach((atomId) => {
        const atom = (this.atoms || []).find(
          (a) => String(a.aaiInstanceAtomId) === String(atomId)
        );
        if (!atom) {
          return;
        }
        (atom.functions || []).forEach((fn) => {
          if (!fn || !fn.funcName) {
            return;
          }
          if (!fnNameSet.has(fn.funcName)) {
            return;
          }
          result.push({
            atomId: atom.aaiInstanceAtomId,
            funcName: fn.funcName,
          });
        });
      });
      return result;
    },

    /**
     * 提交：校验 → 构造入参 → 调接口 → 成功 emit 'success' / 失败留在弹窗。
     *
     * 校验用 `await form.validate()`（Promise 形式，失败 reject），
     * 红字由 el-form-item 自己渲染，这里 catch 到直接 return。
     */
    async submit() {
      if (this.batchLoading || this.submitting) {
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
      const atomIdList = (this.form.atomIdList || []).map(String);
      const functionSelList = this.buildFunctionSelList();
      const par = {
        atomIdList,
        functionSelList,
        // 一键跳过标记：固定 'Y'（后端据此走批量路径）
        oneKeyJumpFlag: "Y",
        // 全选原子的开关值（落地成 'Y' / 'N'，组件不认接口协议，组件里翻译）
        selectAll: this.form.selectAll ? "Y" : "N",
      };
      this.batchLoading = true;
      try {
        await multiAtomFuncSkip(par);
        this.$message.success("操作成功");
        this.$emit("success");
      } catch (e) {
        console.error("[函数批量跳过] 失败", e);
        this.$message.error((e && e.message) || "批量跳过失败");
      } finally {
        this.batchLoading = false;
      }
    },
    onClose() {
      // 提交中禁止关闭：与 SilenceDialog / SmsSettingDialog 同套路
      if (this.batchLoading || this.submitting) {
        return;
      }
      this.$emit("close");
    },
  },
};
</script>

<style lang="scss" scoped>
.bsd-title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: #1f2937;
}

/* 顶部说明条：背景块 + 高亮关键字，列出支持的函数状态范围 */
.bsd-text {
  margin: 0 0 16px;
  padding: 8px 12px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #5b6b82;
  font-size: 12.5px;
  line-height: 1.7;

  &__key {
    margin: 0 2px;
    padding: 1px 6px;
    border-radius: 3px;
    background: #fdf6e8;
    color: #cf8f22;
    font-weight: 500;
  }
}

.bsd {
  padding: 4px 0;
}

/*
  inline 表单三个控件同排：
    - 全选原子   固定宽度，让开关位置稳定
    - 原子        由内容决定宽度（不放 flex-grow，否则会被拉伸，间隔变大）
    - 函数        同上
  这里给每个 form-item 显式 min-width 兜底，太窄时降不下去；不写 flex-grow 让
  浏览器按内容（label + select 自身宽度）算 —— 这样两个 select 各按 placeholder
  文字宽度自然展开，不被多余空白拉开。

  ⚠️ label 不能换行。这里给 label 设 `white-space: nowrap` 兜底，
  即使文本宽过 label-width 也走单行（而不是折成两行看着"没对齐"）；
  label-width 算好 72px 装得下"全选原子"（4 字 52px + 11+4 padding = 67px 富余）。

  ⚠️ 关键：每个 `.el-form-item` 强制 `display: flex; align-items: center;`。
  Element 默认 el-form-item 内部用 `float: left` 让 label 和 content 同行，
  但在 inline form 里每个 form-item 是 inline-block，外加 `vertical-align: middle`。
  当某列内容塞不下时 content 折下来变 2 行高 → 撑高整行 → 默认 middle 让旁边
  的 1 行高 items 居中于整行中段 → 出现"中间一大块空白"。
  改成 flex + center 之后，label 和 content 在 form-item 内部稳定同行，
  所有 form-item 都是 1 行高，整行没有 middle 居中带来的空白。

  ⚠️ 不要给 atom / fn 列加 `flex: 1 1 <Xpx>`（flex-grow: 1）。
  flex-grow: 1 会强制拉伸 select 到「容器剩余空间的一半」（这里 ~260px），
  拉伸后 form-item 比内容需要的更宽，看起来「select 之间一大块空白」。
  正确做法是 `flex: 0 1 auto`（默认）：宽度由内容决定，可收缩到 min-width，
  空间不足时缩到 min-width 再换行。
*/
.bsd-form {
  display: flex;
  align-items: center;  // form-items 垂直居中（不是 middle 中段居中）
  flex-wrap: wrap;

  ::v-deep .el-form-item {
    display: flex;
    align-items: center;
    margin: 0;
  }

  &__switch {
    flex: none;
    width: 140px;  // label 72 + switch 40 + 28 buffer = 140
  }

  &__atom {
    // flex 默认 = 0 1 auto：宽度由内容决定；可收缩到 min-width；不拉伸
    // （flex-grow: 1 会把 select 拉到 ~260px，让 select 之间显得空——用户验证过）
    min-width: 200px;
  }

  &__fn {
    min-width: 200px;
  }
}

/* form-items 之间的间距用 margin-right 撑（之前用 gap 在某些场景不生效） */
.bsd-form ::v-deep .bsd-form__switch {
  margin-right: 8px;
}
.bsd-form ::v-deep .bsd-form__atom {
  margin-right: 8px;
}
.bsd-form ::v-deep .bsd-form__fn {
  margin-right: 0;  // 最后一个不要右边距
}

.bsd-select {
  width: 100%;
}

.bsd-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.bsd-btn {
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
  transition: background-color 0.16s ease, border-color 0.16s ease,
    color 0.16s ease;

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
  （同 SilenceDialog / SmsSettingDialog / ExecUserDialog）。
  标签左对齐、必填星号槽位、错误红字颜色 —— 与其它小弹窗保持一致。

  inline 表单里 el-form-item 多了 margin-bottom、margin-right 默认值，
  这里全清掉让 flex 布局接管；红字宽度跟 form-item 同宽，否则会跑偏。
-->
<style lang="scss">
.bsd-dialog {
  border-radius: 8px;
  max-width: calc(100vw - 40px);

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

  /*
    标签左对齐 + 必填星号预留槽位（避免「有星号的行推右 / 没星号的行不推」导致错位）
    label 宽度 72px：能装下"全选原子"4 字（≈52px）+ 11px 星号 padding = 67px 富余 5px。
    三个控件能塞进 60% 弹窗里不换行。

    `white-space: nowrap` 是关键兜底：即使将来有人加长 label 文本，
    也走单行溢出而不是折两行（折两行会让"全选原 / 子"看着像没对齐）。
  */
  .el-form-item__label {
    position: relative;
    width: 72px !important;
    padding-left: 11px;
    padding-right: 4px;
    font-size: 13px;
    color: #3d4a5c;
    text-align: left;
    white-space: nowrap;
  }

  .el-form-item.is-required:not(.is-no-asterisk)
    > .el-form-item__label::before {
    position: absolute;
    left: 0;
    margin-right: 0;
  }

  /* inline 表单的红字位置：让它显示在自己那一行下面，不被 flex 挤到右边 */
  .bsd-form .el-form-item__error {
    position: absolute;
    left: 0;
    padding-top: 2px;
    font-size: 12px;
    color: #c73b3b;
  }
}
</style>
