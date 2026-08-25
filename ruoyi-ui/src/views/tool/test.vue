<template>
  <div class="app-container">
    <el-table ref="elTable"
      v-if="tableData.length"
      v-loading="totalLoading"
      :data="tableData.filter(data => !search || data.memberName.toLowerCase().includes(search.toLowerCase()))"
      :default-sort="{ prop: 'memberRole', order: 'descending' }"
      height="750"
      border
      style="width: 100%">
      <el-table-column
        v-for="(item, index) in tableHead"
        :key="index"
        :prop="item"
        align="center"
        :width="item === 'memberName' ? '150' : '90'"
        :fixed="item === 'memberName' ? true : false"
        :sortable="item === 'memberRole' ? true : false">
        <template slot="header">
          <div v-if="item === 'memberName'">姓名
            <input type="text" v-model="search"
              style="width:90%"
              placeholder="搜索关键字" clearable />
          </div>
          <div v-else-if="item === 'memberRole'">
            岗位
          </div>
          <div v-else>
            <div>{{ item }}</div>
            <div>{{ titleFnc(item) }}</div>
          </div>
        </template>
        <template slot-scope="scope">
          <el-tooltip
            v-if="item !== 'memberName' && scope.row[item].remark && item !== 'memberRole'"
            class="item"
            effect="dark"
            :content="scope.row[item].remark"
            placement="top">
            <dict-tag
              :options="dict.type.rehearsal_dictionary"
              :value="scope.row[item].dutyType"
              style="cursor:pointer" />
          </el-tooltip>
          <el-tooltip
            v-else-if="item !== 'memberName' && scope.row[item].remark && item !== 'memberRole'"
            class="item"
            effect="dark"
            :content="scope.row[item].remark"
            placement="top">
            <dict-tag
              :options="dict.type.rehearsal_dictionary"
              :value="scope.row[item].dutyType"
              style="cursor:pointer" />
          </el-tooltip>
          <div v-else-if="item === 'memberName'">
            {{ scope.row.memberName }}
          </div>
          <div v-else-if="item === 'memberRole'">
            <dict-tag
              :options="dict.type.duty_role"
              :value="scope.row.memberRole" />
          </div>
        </template>
      </el-table-column>
    </el-table>
    <div v-else class="no-data">暂无数据</div>
  </div>
</template>

<script>
import { Res as res } from "@/res";
import moment from "moment";
moment.locale("zh-cn");

export default {
  data() {
    return {
      tableData: [
        {
          memberName: "张三",
          memberRole: "A",
          "2025-01-01": { dutyType: "无安排", remark: "123" },
          "2025-01-02": { dutyType: "无安排", remark: "123" },
          "2025-01-03": { dutyType: "无安排", remark: "123" },
          "2025-01-04": { dutyType: "无安排", remark: "123" },
          "2025-01-05": { dutyType: "无安排", remark: "123" },
          "2025-01-06": { dutyType: "无安排", remark: "123" },
          "2025-01-07": { dutyType: "无安排", remark: "523" },
          "2025-01-08": { dutyType: "无安排", remark: "123" },
          "2025-01-09": { dutyType: "无安排", remark: "123" },
          "2025-01-10": { dutyType: "无安排", remark: "123" },
          "2025-01-11": { dutyType: "无安排", remark: "123" },
          "2025-01-12": { dutyType: "无安排", remark: "123" },
          "2025-01-13": { dutyType: "无安排", remark: "123" },
          "2025-01-14": { dutyType: "无安排", remark: "123" },
          "2025-01-15": { dutyType: "无安排", remark: "123" },
          "2025-01-16": { dutyType: "无安排", remark: "123" },
          "2025-01-17": { dutyType: "无安排", remark: "123" },
          "2025-01-18": { dutyType: "无安排", remark: "123" },
          "2025-01-19": { dutyType: "无安排", remark: "123" },
          "2025-01-20": { dutyType: "无安排", remark: "123" },
          "2025-01-21": { dutyType: "无安排", remark: "123" },
          "2025-01-22": { dutyType: "无安排", remark: "(property) remark: string" },
          "2025-01-23": { dutyType: "无安排", remark: "123" },
          "2025-01-24": { dutyType: "无安排", remark: "123" },
          "2025-01-25": { dutyType: "无安排", remark: "123" },
          "2025-01-26": { dutyType: "无安排", remark: "123" },
          "2025-01-27": { dutyType: "无安排", remark: "123" },
          "2025-01-28": { dutyType: "无安排", remark: "123" },
          "2025-01-29": { dutyType: "无安排", remark: "123" },
          "2025-01-30": { dutyType: "无安排", remark: "123" },
          "2025-01-31": { dutyType: "无安排", remark: "123" }
        }
      ],
      tableHead: [
        "memberName",
        "memberRole",
        "2025-01-01",
        "2025-01-02",
        "2025-01-03",
        "2025-01-04",
        "2025-01-05",
        "2025-01-06",
        "2025-01-07",
        "2025-01-08",
        "2025-01-09",
        "2025-01-10",
        "2025-01-11",
        "2025-01-12",
        "2025-01-13",
        "2025-01-14",
        "2025-01-15",
        "2025-01-16",
        "2025-01-17",
        "2025-01-18",
        "2025-01-19",
        "2025-01-20",
        "2025-01-21",
        "2025-01-22",
        "2025-01-23",
        "2025-01-24",
        "2025-01-25",
        "2025-01-26",
        "2025-01-27",
        "2025-01-28",
        "2025-01-29",
        "2025-01-30",
        "2025-01-31"
      ],
      timeRange: []
    };
  },
  methods: {
    /** 返回的表头 */
    titleFnc(item) {
      return moment(item).format("dddd");
    },
  }
};
</script>

<style lang="less" scoped>
.el-table {
  overflow: auto;
  box-sizing: border-box;
}
::-webkit-scrollbar {
  width: 6px;
  height: 12px;
}
::-webkit-scrollbar-track {
  background-color: #f1f1f1;
}
::-webkit-scrollbar-thumb {
  background-color: #c0c0c0;
  border-radius: 3px;
}
/deep/ .el-table__body-wrapper::-webkit-scrollbar {
  width: 0;
  height: 0;
}
/deep/ .el-table__body-wrapper::-webkit-scrollbar {
  width: 6px;
  height: 12px;
}
/deep/ .el-table__body-wrapper::-webkit-scrollbar-thumb {
  border-radius: 8px;
}
</style>
