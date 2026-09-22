<template>
  <div class="at">
    <el-table
      v-if="rows.length > 0"
      :data="rows"
      size="mini"
      border
      height="420"
    >
      <!-- alertKey：值本身可点击，新开 tab 跳到外部告警详情页（链接后面拼 alertKey） -->
      <el-table-column
        prop="alertKey"
        label="alertKey"
        width="170"
        show-overflow-tooltip
      >
        <template slot-scope="scope">
          <a
            v-if="alertUrl(scope.row)"
            class="at__link"
            :href="alertUrl(scope.row)"
            target="_blank"
            rel="noopener noreferrer"
          >{{ scope.row.alertKey }}</a>
          <span v-else>{{ scope.row.alertKey }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="summary"
        label="summary"
        min-width="280"
        show-overflow-tooltip
      />
      <!-- ⚠️ 字段名是小写 i（misinfoReason），别写成 misInfoReason -->
      <el-table-column
        prop="misinfoReason"
        label="misinfoReason"
        width="130"
        show-overflow-tooltip
      />
      <el-table-column
        prop="alertReasonDesc"
        label="alertReasonDesc"
        width="140"
        show-overflow-tooltip
      />
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
            告警详情
          </el-button>
        </template>
      </el-table-column>
      <!-- 查看简报：新开 tab 跳到外部简报页（链接后面拼 runId）；没有 runId 时置灰 -->
      <el-table-column label="more" width="110" align="center">
        <template slot-scope="scope">
          <el-button
            type="text"
            size="mini"
            :disabled="!briefUrl(scope.row)"
            @click="openBrief(scope.row)"
          >
            查看简报
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
// 外部系统地址：前缀固定，后面直接拼字段值
//   告警详情（alertKey 列 / 值可点）：http://alt.eprod-kzx1.cncb/#/jiraAlertInfo?alertKey=<alertKey>
//   简报（「查看简报」按钮）：        http://10.2.64.23/gdb_screen/#/agentInfo?activeRunId=<runId>
const ALERT_DETAIL_URL = 'http://alt.eprod-kzx1.cncb/#/jiraAlertInfo?alertKey='
const BRIEF_URL = 'http://10.2.64.23/gdb_screen/#/agentInfo?activeRunId='

export default {
  name: 'AlarmTable',
  props: {
    rows: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    // alertKey -> 告警详情链接；没有 alertKey 时返回空串，模板退化成纯文本（不出现死链）
    alertUrl(row) {
      const value = row && row.alertKey
      if (value === undefined || value === null || value === '') return ''
      return ALERT_DETAIL_URL + encodeURIComponent(String(value))
    },
    // runId -> 简报链接；没有 runId 时返回空串，按钮置灰（避免跳到带空参数的坏链接）
    briefUrl(row) {
      const value = row && row.runId
      if (value === undefined || value === null || value === '') return ''
      return BRIEF_URL + encodeURIComponent(String(value))
    },
    // 与 alertKey 一样新开一个浏览器 tab
    openBrief(row) {
      const url = this.briefUrl(row)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
}
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

  /* alertKey 列的可点击值 */
  &__link {
    color: #409eff;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      color: #66b1ff;
      text-decoration: underline;
    }
  }

  /* 表格样式对齐系统画像页 */
  ::v-deep .el-table {
    // ⚠️ 这里**不能**写 `&::before { display: none }`！
    // Element 的 `.el-table--border { border-right: none; border-bottom: none }` 把根元素的
    // 下边框去掉了，表格**底部那条横线完全靠 `.el-table::before`（1px 绝对定位）**来画。
    // 把它 display:none 掉，表格底部就是敞口的，看着「不完整」。
    // （右侧竖线是 `.el-table--border::after`，与这条无关。）
    // 行的 `td` 各自有 border-bottom，但表格是固定 height 滚动的，
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
