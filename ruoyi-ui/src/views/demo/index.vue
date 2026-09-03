<template>
  <div class="app-container">
    <!-- 顶部标题 -->
    <div class="page-title">HDP容量精细报表</div>

    <!-- 定高容器：撑满视口剩余高度，内部表格 100% 跟随 -->
    <div class="table-wrap">
      <vxe-table
        :data="rows"
        border
        size="mini"
        height="100%"
        :scroll-y="{ enabled: true, gt: 100 }"
        :sort-config="{ trigger: 'cell' }"
        :cell-class-name="cellClassName"
        show-overflow
      >
        <vxe-column field="cluster_name" title="集群名" width="180" />
        <vxe-column field="path" title="PATH" width="220" show-overflow />
        <vxe-column
          field="size"
          align="center"
          width="110"
          sortable
          :sort-by="({ row }) => parseNum(row.size)"
        >
          <template #header>空间占用<br />(TB)</template>
        </vxe-column>
        <vxe-column title="日增长率 (%)" align="center">
          <vxe-column
            field="daily"
            title="——依据最近7天折算"
            align="center"
            sortable
            :sort-by="({ row }) => parseNum(row.daily)"
          >
            <template #default="{ row }">{{ row.daily }}</template>
          </vxe-column>
        </vxe-column>
        <vxe-column title="周增长率 (%)" align="center">
          <vxe-column
            field="weekly"
            title="——最近7天折算"
            align="center"
            sortable
            :sort-by="({ row }) => parseNum(row.weekly)"
          >
            <template #default="{ row }">{{ row.weekly }}</template>
          </vxe-column>
        </vxe-column>
        <vxe-column title="月增长率 (%)" align="center">
          <vxe-column
            field="monthly"
            title="——最近30天折算"
            align="center"
            sortable
            :sort-by="({ row }) => parseNum(row.monthly)"
          >
            <template #default="{ row }">{{ row.monthly }}</template>
          </vxe-column>
        </vxe-column>
        <vxe-column title="年增长率 (%)" align="center">
          <vxe-column
            field="yearly"
            title="——最近90天折算"
            align="center"
            sortable
            :sort-by="({ row }) => parseNum(row.yearly)"
          >
            <template #default="{ row }">{{ row.yearly }}</template>
          </vxe-column>
        </vxe-column>
        <vxe-column
          field="usage"
          title="当前使用率：XX %"
          align="center"
          width="130"
          sortable
          :sort-by="({ row }) =>
            row.usage === null || row.usage === undefined ? -Infinity : row.usage"
        >
          <template #default="{ row }">{{
            row.usage === null || row.usage === undefined ? "" : row.usage + "%"
          }}</template>
        </vxe-column>
        <vxe-column title="智能预警" align="center" width="160">
          <vxe-column field="warning" title="▪ 多维度预警空间使用" align="center" />
        </vxe-column>
        <vxe-column field="note" title="备注" width="260" show-overflow />
        <vxe-column title="目录清理策略：" align="center" width="200">
          <vxe-column field="cleanupStrategy" align="center">
            <template #header
              >1、日志定期清理；<br />2、历史数据清理；<br />3、空间存储异构；</template
            >
          </vxe-column>
        </vxe-column>
        <vxe-column
          field="cleanupStandard"
          title="目录清理规范"
          align="center"
          width="130"
        />
      </vxe-table>
    </div>
  </div>
</template>

<script>
// ===================== 性能压测（模拟大数据量） =====================
// 正式使用时把 MOCK_COUNT 改为 0，只保留下方 3 条样例数据
const MOCK_COUNT = 20000;

const clusterPool = ["集群名1", "集群名2", "集群名3", "集群名4", "集群名5"];
const dirPool = [
  "Total",
  "/apps/hive/warehouse/business_dw.db",
  "/apps/hive/warehouse/user_ods.db",
  "/apps/hive/warehouse/logs_ods.db",
  "/apps/hive/warehouse/trade_dw.db",
  "/apps/hive/warehouse/crm_dw.db",
  "/apps/hive/warehouse/report_mart.db",
  "/data/kafka/topics/order_event",
  "/data/kafka/topics/user_action",
  "/data/kafka/topics/pay_callback",
  "/apps/azkaban/projects",
  "/user/hive/warehouse/tmp",
  "/data/flink/checkpoint",
  "/tmp/hadoop-yarn/staging",
  "/var/log/hadoop-hdfs",
  "/data/spark/spark-warehouse",
  "/backup/hbase/snapshot",
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function fmtRate(v) {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

// 模拟真实分布：大部分使用率 <70%，少数超阈值触发红色预警；部分字段留空
function buildMockRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const usage = r < 0.05 ? null : r < 0.9 ? +rand(8, 70).toFixed(1) : +rand(70.1, 98).toFixed(1);
    rows.push({
      cluster_name:
        clusterPool[i % clusterPool.length] + (Math.random() < 0.15 ? "-Total" : ""),
      path: dirPool[(i * 7 + Math.floor(Math.random() * 3)) % dirPool.length],
      size: Math.random() < 0.02 ? "" : rand(30, 9000).toFixed(2),
      daily: Math.random() < 0.08 ? "" : fmtRate(rand(-1.5, 1.5)),
      weekly: Math.random() < 0.06 ? "" : fmtRate(rand(-4, 4)),
      monthly: Math.random() < 0.04 ? "" : fmtRate(rand(-30, 35)),
      yearly: Math.random() < 0.03 ? "" : fmtRate(rand(-60, 160)),
      usage,
      warning: "",
      note: usage !== null && usage > 70 ? "想降低至70%的阈值，需要清理{XX}数据" : "",
      cleanupStrategy: "",
      cleanupStandard: "",
    });
  }
  return rows;
}

export default {
  name: "Demo",
  data() {
    return {
      // 使用率阈值：超过该值，使用率单元格显示红色
      threshold: 70,
      rows: [
        {
          cluster_name: "集群名1-Total（案例）", // 集群名
          path: "", // PATH
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
          cluster_name: "集群名2-Total（案例）",
          path: "",
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
          cluster_name: "集群名2-目录",
          path: "",
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
  created() {
    // 压测：追加模拟大数据，观察虚拟滚动渲染性能
    this.rows = this.rows.concat(buildMockRows(MOCK_COUNT));
  },
  methods: {
    // 解析数值："+0.3%" → 0.3；空值 → 负无穷（排序靠后）
    parseNum(val) {
      if (val === null || val === "" || val === undefined) return -Infinity;
      const n = parseFloat(String(val).replace(/[+%,\s]/g, ""));
      return isNaN(n) ? -Infinity : n;
    },
    // 单元格样式：数字列等宽字体；使用率超过阈值时红色
    cellClassName({ row, column }) {
      const field = column.field || column.property;
      const cls = [];
      if (["size", "daily", "weekly", "monthly", "yearly", "usage"].includes(field)) {
        cls.push("num-col");
      }
      if (field === "usage" && row.usage > this.threshold) {
        cls.push("danger-cell");
      }
      return cls.join(" ");
    },
  },
};
</script>

<style lang="scss" scoped>
/* 页面标题 */
.page-title {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* 表格容器：占满视口剩余高度（navbar 50 + tagsView 34 + 标题行 + 页面内边距） */
.table-wrap {
  height: calc(100vh - 170px);
}

/* vxe 动态 cell class 需深度选择器 */
::v-deep .vxe-body--column.num-col {
  font-family: Consolas, Monaco, monospace;
}

/* 使用率超过阈值的单元格：红色 */
::v-deep .vxe-body--column.danger-cell {
  background-color: #f8d9d8 !important;
  color: #ff4d4f;
  font-weight: 600;
}
</style>
