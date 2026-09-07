<template>
  <div class="app-container">
    <!-- 顶部标题 + 前端搜索 -->
    <div class="page-title">
      <span>HDP容量精细报表</span>
      <el-input
        v-model="searchText"
        placeholder="搜索集群名 / PATH"
        prefix-icon="el-icon-search"
        clearable
        class="search-input"
      />
    </div>

    <!-- 定高容器：撑满视口剩余高度，内部表格 100% 跟随 -->
    <div class="table-wrap">
      <vxe-table
        :data="filteredRows"
        stripe
        size="mini"
        height="100%"
        :scroll-y="{ enabled: true, gt: 100 }"
        :sort-config="{ trigger: 'cell' }"
        :cell-class-name="cellClassName"
        show-overflow
      >
        <vxe-column field="cluster_name" title="集群名" width="180" />
        <vxe-column field="path" title="PATH" width="180" show-overflow />
        <vxe-column
          field="size"
          align="right"
          width="150"
          sortable
          :sort-by="({ row }) => parseNum(row.size)"
        >
          <template #header>
            <span class="head-title">空间占用 (TB)</span>
          </template>
        </vxe-column>
        <vxe-column
          field="daily"
          align="center"
          sortable
          :sort-by="({ row }) => parseNum(row.daily)"
        >
          <!-- 表头：日增长率 + 问号提示（折算口径） -->
          <template #header>
            <span class="head-title">日增长率</span>
            <el-tooltip content="——依据最近7天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ row.daily || "—" }}</template>
        </vxe-column>
        <vxe-column
          field="weekly"
          align="center"
          sortable
          :sort-by="({ row }) => parseNum(row.weekly)"
        >
          <template #header>
            <span class="head-title">周增长率</span>
            <el-tooltip content="——最近7天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ row.weekly || "—" }}</template>
        </vxe-column>
        <vxe-column
          field="monthly"
          align="center"
          sortable
          :sort-by="({ row }) => parseNum(row.monthly)"
        >
          <template #header>
            <span class="head-title">月增长率</span>
            <el-tooltip content="——最近30天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ row.monthly || "—" }}</template>
        </vxe-column>
        <vxe-column
          field="yearly"
          align="center"
          sortable
          :sort-by="({ row }) => parseNum(row.yearly)"
        >
          <template #header>
            <span class="head-title">年增长率</span>
            <el-tooltip content="——最近90天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ row.yearly || "—" }}</template>
        </vxe-column>
        <vxe-column
          field="usage"
          title="当前使用率"
          align="center"
          width="130"
          sortable
          :sort-by="({ row }) =>
            row.usage === null || row.usage === undefined ? -Infinity : row.usage"
        >
          <!-- 状态胶囊：只突出数字，不整格变色 -->
          <template #default="{ row }">
            <span v-if="row.usage == null" class="usage-pill is-empty">—</span>
            <span v-else class="usage-pill" :class="usageClass(row.usage)">{{
              row.usage
            }}%</span>
          </template>
        </vxe-column>
        <vxe-column field="warning" align="center" width="130">
          <template #header>
            <span class="head-title">智能预警</span>
            <el-tooltip content="多维度预警空间使用" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
        </vxe-column>
        <vxe-column field="note" title="备注" width="130" show-overflow />
        <vxe-column field="cleanupStrategy" align="center" width="140">
          <template #header>
            <span class="head-title">目录清理策略</span>
            <el-tooltip placement="top">
              <div slot="content">
                1、日志定期清理；<br />2、历史数据清理；<br />3、空间存储异构；
              </div>
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
        </vxe-column>
        <vxe-column
          field="cleanupStandard"
          title="目录清理规范"
          align="center"
          width="110"
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

// 模拟真实分布：大部分使用率 <70%，少数超阈值触发预警；部分字段留空
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
      // 使用率预警阈值（%）：超过该值进入预警/危险档
      threshold: 70,
      // 前端搜索关键字（匹配集群名 / PATH）
      searchText: "",
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
  computed: {
    // 前端搜索：集群名 或 PATH 包含关键字（忽略大小写）
    filteredRows() {
      const kw = this.searchText.trim().toLowerCase();
      if (!kw) return this.rows;
      return this.rows.filter(
        row =>
          String(row.cluster_name || "").toLowerCase().includes(kw) ||
          String(row.path || "").toLowerCase().includes(kw)
      );
    },
  },
  methods: {
    // 解析数值："+0.3%" → 0.3；空值 → 负无穷（排序靠后）
    parseNum(val) {
      if (val === null || val === "" || val === undefined) return -Infinity;
      const n = parseFloat(String(val).replace(/[+%,\s]/g, ""));
      return isNaN(n) ? -Infinity : n;
    },
    // 使用率档位：60/70/85 三档 → 状态色
    usageClass(usage) {
      if (usage >= 85) return "usage-danger";
      if (usage >= this.threshold) return "usage-warning";
      if (usage >= 60) return "usage-focus";
      return "usage-normal";
    },
    // 单元格样式：按列/数据语义返回不同 class（纯视觉，不影响逻辑）
    cellClassName({ row, column }) {
      const field = column.field || column.property;
      const cls = [];
      if (field === "cluster_name") {
        cls.push(String(row[field] || "").includes("-Total") ? "cell-total" : "col-main");
      } else if (field === "size") {
        cls.push("num-col", "col-main");
      } else if (field === "path") {
        cls.push("col-path");
      } else if (field === "note") {
        cls.push("col-note");
        if (row.usage > this.threshold) cls.push("col-note-warn");
      } else if (["daily", "weekly", "monthly", "yearly"].includes(field)) {
        cls.push("num-col", "col-growth");
        const v = this.parseNum(row[field]);
        if (v === -Infinity) cls.push("grow-empty");
        else if (v > 0.05) cls.push("grow-up");
        else if (v < -0.05) cls.push("grow-down");
        else cls.push("grow-flat");
      }
      return cls.join(" ");
    },
  },
};
</script>

<style lang="scss" scoped>
/* ============ 页面标题 ============ */
.page-title {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* 搜索框：紧挨标题右侧，间距仅几像素 */
.search-input {
  width: 280px;
  margin-left: 10px;
  flex-shrink: 0;
}

/* ============ 表格容器：vxe 主题变量统一注入 ============ */
.table-wrap {
  height: calc(100vh - 170px);

  /* 行高 44px，数据更透气；单元格左右留白 12px */
  --vxe-ui-table-row-height-mini: 44px;
  --vxe-ui-table-cell-padding-mini: 4px 12px;

  /* 表头：普通列表头浅灰底 + 中文字重 */
  --vxe-ui-table-header-background-color: #f7f9fc;
  --vxe-ui-table-header-font-weight: 600;

  /* 斑马纹：极浅、几乎不可察觉 */
  --vxe-ui-table-row-striped-background-color: #fafcff;

  /* 行 hover：浅蓝，不刺眼 */
  --vxe-ui-table-row-hover-background-color: #f3f8ff;
  --vxe-ui-table-row-hover-striped-background-color: #f3f8ff;

  /* 排序图标：默认浅灰，hover/激活蓝 */
  --vxe-ui-table-column-icon-border-color: #c0c4cc;
  --vxe-ui-table-column-icon-border-hover-color: #409eff;
}

/* ============ 外框与格线：弱化 Excel 格子感 ============ */
::v-deep .vxe-table.vxe-table--render-default {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

/* 行间仅保留极浅横线，不再有竖线分割 */
::v-deep .vxe-table--render-default .vxe-body--column {
  border-bottom: 1px solid #f0f2f5;
}

/* ============ 表头层级 ============ */
/* 表头与数据区交界线 */
::v-deep .vxe-table--header-wrapper {
  border-bottom: 1px solid #dcdfe6;
}

/* 基础表头：浅灰底、13px、600 */
::v-deep .vxe-table--header-wrapper {
  font-size: 13px;
  letter-spacing: 0.2px;
}
::v-deep .vxe-table--header-wrapper .vxe-header--column {
  background-color: #f7f9fc !important;
  color: #303133;
  font-weight: 600;
}

/* 表头文字 + 问号提示图标（说明性 tooltip 入口） */
.head-title {
  line-height: 1;
}

/* 表头一律单行：禁止任何换行/折行（vxe 默认对 slot 内容会 break-all） */
::v-deep .vxe-table--header-wrapper .vxe-cell,
::v-deep .vxe-table--header-wrapper .vxe-cell--wrapper,
::v-deep .vxe-table--header-wrapper .vxe-cell--wrapper .head-title {
  white-space: nowrap;
}
.head-help-icon {
  margin-left: 3px;
  font-size: 13px;
  color: #a8abb2;
  cursor: help;
  vertical-align: -1px;
}
.head-help-icon:hover {
  color: #409eff;
}

/* ============ 行 hover / 斑马 ============ */
::v-deep .vxe-table--render-default .vxe-body--row.row--hover .vxe-body--column {
  background-color: #f3f8ff !important;
  transition: background-color 0.2s ease;
}

/* ============ 字体层级 ============ */
/* 一级信息：集群名 / 空间占用 —— 主色 + 中等字重 */
::v-deep .vxe-body--column.col-main {
  color: #303133;
  font-weight: 500;
}
/* Total 汇总行：更重一级 */
::v-deep .vxe-body--column.cell-total {
  color: #303133;
  font-weight: 600;
}

/* 数字：等宽 + 表格数字对齐，避免跳动 */
::v-deep .vxe-body--column.num-col {
  font-family: Consolas, Monaco, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

/* 辅助信息：PATH / 备注 —— 小号灰字 */
::v-deep .vxe-body--column.col-path {
  font-family: Consolas, Monaco, Menlo, monospace;
  font-size: 12px;
  color: #606266;
}
::v-deep .vxe-body--column.col-note {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
/* 风险备注：橙色轻微强调，不变整块背景 */
::v-deep .vxe-body--column.col-note-warn {
  color: #e6a23c;
}

/* ============ 增长率列：极浅底色分区 + 增减分色 ============ */
::v-deep .vxe-body--column.col-growth {
  background-color: #fcfdff;
}
::v-deep .vxe-body--column.grow-up {
  color: #e6a23c; /* 正增长：低饱和橙 */
}
::v-deep .vxe-body--column.grow-down {
  color: #67c23a; /* 负增长：柔和绿 */
}
::v-deep .vxe-body--column.grow-flat {
  color: #909399; /* 接近 0 */
}
::v-deep .vxe-body--column.grow-empty {
  color: #c0c4cc; /* 无数据占位 — */
}

/* ============ 当前使用率：状态胶囊（只突出数字） ============ */
.usage-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}
/* 正常 / 关注：蓝色数字，无背景 */
.usage-pill.usage-normal,
.usage-pill.usage-focus {
  color: #409eff;
}
/* 预警（≥70%）：橙字 + 极浅橙底 */
.usage-pill.usage-warning {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.08);
}
/* 高风险（≥85%）：红字 + 极浅红底 */
.usage-pill.usage-danger {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.08);
}
/* 无数据 */
.usage-pill.is-empty {
  color: #c0c4cc;
  font-weight: 400;
  padding: 2px 6px;
}

/* ============ 排序图标三态 ============ */
::v-deep .vxe-table .vxe-sort--asc-btn.sort--active,
::v-deep .vxe-table .vxe-sort--desc-btn.sort--active,
::v-deep .vxe-table .vxe-sort--asc-btn:hover,
::v-deep .vxe-table .vxe-sort--desc-btn:hover {
  color: #409eff;
}
</style>
