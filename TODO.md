你现在继续优化总览页 CICD实施情况弹窗里的“工单状态”样式。

重点文件大概率是：
ruoyi-ui/src/views/tool/overview/index.vue

背景：
CICD实施情况里的工单状态不止当前几个，完整状态如下：
- 业务验证
- 成功
- 部分成功
- 失败
- 取消
- 待实施
- 实施中
- 预审
- 草稿
- 审批中
- 审批通过
- 工单已确认
- 审批不通过
- 预审驳回

目标：
把 CICD 表格里的“工单状态”列统一渲染为状态 tag，并覆盖以上所有状态。浅色/深色主题下都要清晰可读，风格要和维护公告弹窗的状态 tag 统一。

实现要求：
1. 不新增依赖。
2. 不改接口。
3. 不自动跑构建。
4. 不影响 CICD 刷新、跳转、原子详情 popover。
5. 只改总览页 CICD 状态渲染和样式。
6. 保留未知状态兜底，不能因为新状态导致无样式或报错。

模板要求：
找到 CICD 表格的工单状态列，把普通文本改成类似：

<template slot-scope="{ row }">
  <span class="cicd-status-tag" :class="cicdStatusClass(row.order_status)">
    {{ row.order_status || '-' }}
  </span>
</template>

如果当前已经有类似结构，请补全状态映射即可。

方法要求：
完善 `cicdStatusClass(status)`，先对 status 做 trim 兜底：

const value = (status || '').trim()

建议按语义分组，不要每个状态都乱给颜色：

- `业务验证`：is-verify
- `成功`、`审批通过`、`工单已确认`：is-success
- `部分成功`：is-partial
- `失败`、`审批不通过`、`预审驳回`：is-danger
- `取消`：is-cancelled
- `待实施`、`草稿`：is-pending
- `实施中`：is-running
- `预审`、`审批中`：is-review
- 其他未知状态：is-unknown

同时检查 `getCicdStatusFilters()`：
- 如果它是从 cicdList 动态生成，可以保留动态生成。
- 如果它是写死的，请补全上面所有状态。
- 筛选顺序建议按这份完整状态列表顺序保持稳定：
  业务验证、成功、部分成功、失败、取消、待实施、实施中、预审、草稿、审批中、审批通过、工单已确认、审批不通过、预审驳回

样式要求：
在 CICD 弹窗样式里补齐 `.cicd-status-tag` 的所有状态 class，并分别适配：
- `.cicd-dialog--light`
- `.cicd-dialog--dark`

颜色语义建议：

浅色模式：
- is-success：绿色文字 + 淡绿背景
- is-partial：琥珀文字 + 淡黄背景
- is-danger：红色文字 + 淡红背景
- is-cancelled：灰色文字 + 浅灰背景
- is-pending：蓝灰文字 + 浅蓝灰背景
- is-running：蓝青文字 + 淡青背景
- is-review：紫/靛蓝文字 + 淡紫背景
- is-verify：青色或蓝色文字 + 淡蓝背景
- is-unknown：灰色兜底

深色模式：
- 保持相同语义颜色，但用低透明背景和细边框。
- 不要纯黑背景。
- 不要过度发光。
- 文字必须清晰可读。

基础 tag 样式：
.cicd-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

注意：
- 图标/按钮容器必须 flex 居中。
- 不要让状态 tag 撑高表格行。
- 不要把状态样式写成全局污染其他页面。
- 如果已有 `.cicd-status-tag.is-review` 等旧样式，请改成完整映射，不要留下只覆盖几个状态的半成品。

验收标准：
1. 以上 14 个工单状态都有对应 class 和可见样式。
2. 未知状态也有兜底样式。
3. 浅色主题下状态 tag 清晰、克制、和维护公告风格统一。
4. 深色主题下状态 tag 清晰，不刺眼。
5. 工单状态筛选项能覆盖所有状态，或至少不会漏掉接口实际返回的状态。
6. CICD 表格布局不抖动、不撑高。
7. 不新增依赖、不自动构建。

最后输出：
- 改了哪些文件
- `cicdStatusClass` 的状态映射
- 工单状态筛选是否调整
- 浅色/深色状态样式如何分组
- 建议手动验证步骤