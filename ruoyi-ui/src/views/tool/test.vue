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
      <!-- 姓名：固定列，静态定义（fixed 列放 v-for 动态列里会导致列宽计算错位） -->
      <el-table-column
        prop="memberName"
        width="150"
        fixed
        align="center">
        <template slot="header">
          <div>姓名
            <input type="text" v-model="search"
              style="width:90%"
              placeholder="搜索关键字" clearable />
          </div>
        </template>
        <template slot-scope="scope">
          {{ scope.row.memberName }}
        </template>
      </el-table-column>
      <!-- 岗位 -->
      <el-table-column
        prop="memberRole"
        width="90"
        sortable
        align="center">
        <template slot="header">
          <div>岗位</div>
        </template>
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.duty_role"
            :value="scope.row.memberRole" />
        </template>
      </el-table-column>
      <!-- 日期列 -->
      <el-table-column
        v-for="item in dateCols"
        :key="item"
        :prop="item"
        width="90"
        align="center">
        <template slot="header">
          <div>{{ item }}</div>
          <div>{{ titleFnc(item) }}</div>
        </template>
        <template slot-scope="scope">
          <el-tooltip
            v-if="scope.row[item].remark"
            class="item"
            effect="dark"
            :content="scope.row[item].remark"
            placement="top">
            <dict-tag
              :options="dict.type.rehearsal_dictionary"
              :value="scope.row[item].dutyType"
              style="cursor:pointer" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
    <div v-else class="no-data">暂无数据</div>
  </div>
</template>

<script>
import moment from "moment";
moment.locale("zh-cn");

/** 22 个成员姓名 */
const memberNames = [
  "张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十",
  "郑一", "陈二", "刘三", "黄四", "林五", "何六", "罗七", "梁八",
  "宋九", "谢十", "韩一", "唐二", "冯三", "董四"
];

/** 生成 2025-01-01 ~ 2025-01-31 的排班数据 */
function buildTableData() {
  return memberNames.map(name => {
    const row = { memberName: name, memberRole: "A" };
    for (let i = 1; i <= 31; i++) {
      const day = i < 10 ? "0" + i : "" + i;
      row["2025-01-" + day] = { dutyType: "无安排", remark: "123" };
    }
    return row;
  });
}

export default {
  dicts: ['rehearsal_dictionary', 'duty_role'],
  data() {
    return {
      search: "",
      totalLoading: false,
      tableData: buildTableData(),
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
  computed: {
    /** 日期列（排除姓名、岗位两列） */
    dateCols() {
      return this.tableHead.filter(item => item !== "memberName" && item !== "memberRole");
    }
  },
  mounted() {
    // 动态列 + 固定列场景下，等待渲染完成后重新计算布局，避免表头/表体错位
    this.$nextTick(() => {
      this.$refs.elTable && this.$refs.elTable.doLayout();
    });
    window.addEventListener('resize', this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    /** 窗口尺寸变化时重算表格布局 */
    handleResize() {
      this.$refs.elTable && this.$refs.elTable.doLayout();
    },
    /** 返回的表头 */
    titleFnc(item) {
      return moment(item).format("dddd");
    },
  }
};
</script>
