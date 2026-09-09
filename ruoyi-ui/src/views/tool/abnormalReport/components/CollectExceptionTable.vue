<template>
  <section class="ce-table">
    <div class="ce-table__header">
      <div class="ce-table__title">
        <i class="el-icon-warning ce-table__title-icon" />
        采集异常
        <span v-if="rows.length > 0" class="ce-table__count">{{ rows.length }} 条</span>
      </div>
      <div class="ce-table__meta">
        <span v-if="collectDate" class="ce-table__date">
          <i class="el-icon-date" />
          采集日期：{{ collectDate }}
        </span>
        <el-tag v-if="rows.length > 0" type="danger" effect="plain" size="small">异常</el-tag>
      </div>
    </div>

    <el-table v-if="rows.length > 0" :data="rows" class="ce-table__table">
      <el-table-column label="数据类型" width="140">
        <template slot-scope="scope">
          <span class="ce-table__type">{{ scope.row.type || '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="IP地址">
        <template slot-scope="scope">
          <span class="ce-table__ip">{{ scope.row.ip || '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="异常描述">
        <template slot-scope="scope">
          <span class="ce-table__desc">{{ scope.row.desc || '--' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-else description="当前采集正常，无异常数据" :image-size="80" />
  </section>
</template>

<script>
import { flattenCollectException } from '../utils'

export default {
  name: 'CollectExceptionTable',
  props: {
    // { 数据: { 类型: [ { ip, desc } ] }, 采集日期 }
    collect: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    rows() {
      return flattenCollectException(this.collect)
    },
    collectDate() {
      return this.collect.采集日期 || ''
    }
  }
}
</script>

<style lang="scss" scoped>
.ce-table {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 18px 20px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  &__title-icon {
    color: #e6a23c;
  }

  &__count {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: #909399;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__date {
    font-size: 12px;
    color: #909399;
  }

  &__type {
    display: inline-block;
    padding: 1px 8px;
    font-size: 12px;
    color: #606266;
    background: #f5f7fa;
    border-radius: 4px;
    line-height: 18px;
  }

  &__ip {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 13px;
    color: #606266;
  }

  &__desc {
    font-size: 13px;
    color: #f56c6c;
  }

  // 表格样式覆写：浅灰 header、圆角、轻微行 hover
  ::v-deep .el-table {
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #ebeef5;
  }

  ::v-deep .el-table th.el-table__cell {
    background: #f5f7fa;
    color: #606266;
    font-weight: 600;
  }

  ::v-deep .el-table--border th.el-table__cell {
    border-color: #ebeef5;
  }

  ::v-deep .el-table--border td.el-table__cell {
    border-color: #f2f3f5;
  }

  ::v-deep .el-table tbody tr:hover > td.el-table__cell {
    background: #fafbfd;
  }

  ::v-deep .el-table::before {
    display: none;
  }
}
</style>
