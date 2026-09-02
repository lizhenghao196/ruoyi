<template>
  <div class="app-container">
    <el-card shadow="never">
      <div slot="header" class="card-head">
        <span>HDP容量使用趋势</span>
      </div>

      <el-table
        :data="rows"
        border
        size="mini"
        height="600"
        :cell-class-name="cellClassName"
        style="width: 100%"
      >
        <el-table-column prop="name" label="目录列表" width="200" />
        <el-table-column
          prop="size"
          align="center"
          width="110"
          sortable
          :sort-method="(a, b) => sortByVal(a.size, b.size)"
        >
          <template #header>空间占用<br />(TB)</template>
        </el-table-column>
        <el-table-column label="日增长率 (%)" align="center" width="130">
          <el-table-column
            label="——依据最近7天折算"
            align="center"
            sortable
            :sort-method="(a, b) => sortByVal(a.daily, b.daily)"
          >
            <template #default="{ row }">{{ row.daily }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="周增长率 (%)" align="center" width="120">
          <el-table-column
            label="——最近7天折算"
            align="center"
            sortable
            :sort-method="(a, b) => sortByVal(a.weekly, b.weekly)"
          >
            <template #default="{ row }">{{ row.weekly }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="月增长率 (%)" align="center" width="130">
          <el-table-column
            label="——最近30天折算"
            align="center"
            sortable
            :sort-method="(a, b) => sortByVal(a.monthly, b.monthly)"
          >
            <template #default="{ row }">{{ row.monthly }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="年增长率 (%)" align="center" width="130">
          <el-table-column
            label="——最近90天折算"
            align="center"
            sortable
            :sort-method="(a, b) => sortByVal(a.yearly, b.yearly)"
          >
            <template #default="{ row }">{{ row.yearly }}</template>
          </el-table-column>
        </el-table-column>
        <el-table-column
          prop="usage"
          label="当前使用率：XX %"
          align="center"
          width="130"
          sortable
          :sort-method="(a, b) => sortByVal(a.usage, b.usage)"
        >
          <template #default="{ row }">{{
            row.usage === null ? "" : row.usage + "%"
          }}</template>
        </el-table-column>
        <el-table-column label="智能预警" align="center" width="160">
          <el-table-column
            prop="warning"
            label="▪ 多维度预警空间使用"
            align="center"
          />
        </el-table-column>
        <el-table-column prop="note" label="备注" width="260" />
        <el-table-column label="目录清理策略：" align="center" width="200">
          <el-table-column prop="cleanupStrategy" align="center">
            <template #header
              >1、日志定期清理；<br />2、历史数据清理；<br />3、空间存储异构；</template
            >
          </el-table-column>
        </el-table-column>
        <el-table-column
          prop="cleanupStandard"
          label="目录清理规范"
          align="center"
          width="130"
        />
      </el-table>
    </el-card>
  </div>
</template>

<script>
export default {
  name: "Demo",
  data() {
    return {
      // 使用率阈值：超过该值，使用率单元格显示红色
      threshold: 70,
      rows: [
        {
          name: "集群名1-Total（案例）", // 目录列表
          size: "3204.76", // 空间占用
          daily: "+0.3%", // 日增长率
          weekly: "+1.1%", // 周增长率
          monthly: "+5.4%", // 月增长率
          yearly: "+12.4%", // 年增长率
          usage: 66.0, // 当前使用率
          warning: "", // 智能预警
          note: "距离70%的阈值，还剩{XX}天——最近90天折算", // 备注
          cleanupStrategy: "", // 目录清理策略
          cleanupStandard: "", // 目录清理规范
        },
        {
          name: "集群名2-Total（案例）",
          size: "128.22",
          daily: "+0.3%",
          weekly: "+2.0%",
          monthly: "+2.0%",
          yearly: "+12.0%",
          usage: 76.0,
          warning: "",
          note: "想降低至70%的阈值，需要清理{XX}数据",
          cleanupStrategy: "",
          cleanupStandard: "",
        },
        {
          name: "集群名2-目录",
          size: "18.88",
          daily: "",
          weekly: "",
          monthly: "",
          yearly: "",
          usage: null,
          warning: "",
          note: "",
          cleanupStrategy: "",
          cleanupStandard: "",
        },
      ],
    };
  },
  methods: {
    // 解析数值："+0.3%" → 0.3；空值 → 负无穷（排序靠后）
    parseNum(val) {
      if (val === null || val === "" || val === undefined) return -Infinity;
      const n = parseFloat(String(val).replace(/[+%,\s]/g, ""));
      return isNaN(n) ? -Infinity : n;
    },
    // 数值排序比较器（用于 sort-method）
    sortByVal(va, vb) {
      return this.parseNum(va) - this.parseNum(vb);
    },
    // 单元格样式：数字列等宽字体；使用率超过阈值时红色
    cellClassName({ row, column }) {
      const cls = [];
      if (
        ["size", "daily", "weekly", "monthly", "yearly", "usage"].includes(
          column.property
        )
      ) {
        cls.push("num-col");
      }
      if (column.property === "usage" && row.usage > this.threshold) {
        cls.push("danger-cell");
      }
      return cls.join(" ");
    },
  },
};
</script>

<style lang="scss" scoped>
/* el-table 动态 cell class 需深度选择器 */
::v-deep .num-col {
  font-family: Consolas, Monaco, monospace;
}

/* 使用率超过阈值的单元格：红色 */
::v-deep .danger-cell {
  background: #f8d9d8;
  color: #ff4d4f;
  font-weight: 600;
}

/* 行 hover 时保持红色（el-table 默认 hover 背景会覆盖 td 背景色） */
::v-deep .el-table__body tr:hover > td.danger-cell {
  background-color: #f8d9d8 !important;
}
</style>
