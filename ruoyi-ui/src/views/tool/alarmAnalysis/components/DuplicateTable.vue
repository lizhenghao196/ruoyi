<template>
  <div class="dt">
    <el-table
      v-if="rows.length > 0"
      :data="rows"
      size="mini"
      border
      max-height="520"
      :span-method="spanMethod"
    >
      <el-table-column prop="alertKey" label="alertKey" width="170" show-overflow-tooltip />
      <el-table-column prop="原因" label="原因" min-width="220" />
      <el-table-column prop="内容" label="内容" min-width="320" />
      <el-table-column
        prop="重复性说明"
        label="重复性说明"
        min-width="320"
        class-name="dt__cell-explain"
      />
    </el-table>

    <div v-else class="dt__empty">
      <i class="el-icon-circle-check dt__empty-icon" />
      <span>该查询条件下暂无重复性分析数据</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DuplicateTable',
  props: {
    // [ { data: [ { alertKey, 内容, 原因 } ], 重复性说明 } ]
    groups: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    // 把分组拍平成行，记录每条明细在本组中的位置，供合并单元格使用
    rows() {
      const list = []
      this.groups.forEach((group, groupIndex) => {
        const data = group && Array.isArray(group.data) ? group.data : []
        data.forEach((row, rowIndex) => {
          list.push({
            _key: `${groupIndex}-${rowIndex}-${(row && row.alertKey) || ''}`,
            _first: rowIndex === 0,
            _size: data.length,
            alertKey: row ? row.alertKey : '',
            原因: row ? row.原因 : '',
            内容: row ? row.内容 : '',
            重复性说明: (group && group.重复性说明) || ''
          })
        })
      })
      return list
    }
  },
  methods: {
    // 第 4 列（重复性说明）按分组纵向合并
    spanMethod({ row, columnIndex }) {
      if (columnIndex !== 3) return
      if (!row._first) return { rowspan: 0, colspan: 0 }
      return { rowspan: row._size, colspan: 1 }
    }
  }
}
</script>

<style lang="scss" scoped>
$border: #ebeef5;

.dt {
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
    &::before {
      display: none;
    }

    th.el-table__cell {
      background: #f5f7fa;
      color: #909399;
      font-weight: 600;
      font-size: 12px;
      padding: 8px 0;
      border-bottom: 1px solid $border;
    }

    td.el-table__cell {
      padding: 8px 0;
      font-size: 12.5px;
      color: #606266;
      border-bottom: 1px solid $border;
      vertical-align: top;
      line-height: 1.6;
      word-break: break-word;
    }

    .el-table__row:hover > td.el-table__cell {
      background: #f5f9ff;
    }

    th .cell,
    td .cell {
      padding-left: 8px;
      padding-right: 8px;
    }

    /* 合并单元格：整组共用一个背景，便于看出分组边界 */
    td.dt__cell-explain {
      background: #fafcff;
      color: #5a6b8c;
      border-left: 1px solid $border;
    }
  }
}
</style>
