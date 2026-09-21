<template>
  <div class="at">
    <el-table
      v-if="rows.length > 0"
      :data="rows"
      size="mini"
      border
      height="420"
    >
      <el-table-column
        prop="alertKey"
        label="alertKey"
        width="170"
        show-overflow-tooltip
      />
      <el-table-column
        prop="summary"
        label="summary"
        min-width="280"
        show-overflow-tooltip
      />
      <el-table-column
        prop="misInfoReason"
        label="misInfoReason"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column
        prop="alertReasonDesc"
        label="alertReasonDesc"
        width="140"
        show-overflow-tooltip
      />
      <el-table-column prop="alertSource" label="alertSource" width="100" />
      <el-table-column prop="closedBy" label="closedby" width="90" />
      <el-table-column label="AgentTrace" width="140" align="center">
        <template slot-scope="scope">
          <el-button
            type="text"
            size="mini"
            @click="$emit('view-field', 'trace', scope.row)"
          >
            使用到的智能体
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="output" width="110" align="center">
        <template slot-scope="scope">
          <el-button
            type="text"
            size="mini"
            @click="$emit('view-field', 'report', scope.row)"
          >
            告警报告
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="more" width="110" align="center">
        <template slot-scope="scope">
          <el-button
            type="text"
            size="mini"
            @click="$emit('view-field', 'more', scope.row)"
          >
            更多字段
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-else class="at__empty">
      <i class="el-icon-circle-check at__empty-icon" />
      <span>该分类下暂无告警数据</span>
    </div>
  </div>
</template>

<script>
export default {
  name: "AlarmTable",
  props: {
    rows: {
      type: Array,
      default: () => [],
    },
  },
};
</script>

<style lang="scss" scoped>
$border: #ebeef5;

.at {
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 28px 0 22px;
    font-size: 13px;
    color: #909399;
  }

  &__empty-icon {
    font-size: 28px;
    color: #c0c4cc;
  }

  /* 表格样式对齐系统画像页 */
  ::v-deep .el-table {
    // ⚠️ 这里**不能**写 `&::before { display: none }`！
    // Element 的 `.el-table--border { border-right: none; border-bottom: none }` 把根元素的
    // 下边框去掉了，表格**底部那条横线完全靠 `.el-table::before`（1px 绝对定位）**来画。
    // 把它 display:none 掉，表格底部就是敞口的，看着「不完整」。
    // （右侧竖线是 `.el-table--border::after`，与这条无关。）
    // 行的 `td` 各自有 border-bottom，但表格是 max-height 滚动的，
    // 滚到中间时最后一条可见行的线并不在容器底边 —— 所以容器底线必须由 ::before 提供。

    th.el-table__cell {
      background: #f5f7fa;
      color: #909399;
      font-weight: 600;
      font-size: 12px;
      padding: 8px 0;
      border-bottom: 1px solid $border;
    }

    td.el-table__cell {
      padding: 6px 0;
      font-size: 12.5px;
      color: #606266;
      border-bottom: 1px solid $border;
    }

    .el-table__row:hover > td.el-table__cell {
      background: #f5f9ff;
    }

    th .cell,
    td .cell {
      padding-left: 8px;
      padding-right: 8px;
    }
  }
}
</style>
