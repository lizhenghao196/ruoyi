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
    <div v-loading="loading" element-loading-text="HDFS目录数据加载中..." class="table-wrap">
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
        <vxe-column field="cluster_name" title="集群名" width="150" />
        <vxe-column field="path" title="PATH" width="160" show-overflow />
        <!-- 空间占用两列：size=默认(原始字节) / sizeFormat=转化拟人单位，排序均依据 size 字节数值 -->
        <vxe-column
          field="size"
          align="right"
          width="145"
          sortable
          :sort-by="({ row }) => sortSize(row)"
        >
          <template #header>
            <span class="head-title">空间占用 (默认)</span>
          </template>
          <template #default="{ row }">{{ row.size || "—" }}</template>
        </vxe-column>
        <vxe-column
          field="sizeFormat"
          align="right"
          width="145"
          sortable
          :sort-by="({ row }) => sortSize(row)"
        >
          <template #header>
            <span class="head-title">空间占用 (拟人)</span>
          </template>
          <template #default="{ row }">{{ row.sizeFormat || "—" }}</template>
        </vxe-column>
        <vxe-column
          field="daily"
          align="center"
          width="100"
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
          <template #default="{ row }">{{ fmtGrowth(row.daily) }}</template>
        </vxe-column>
        <vxe-column
          field="weekly"
          align="center"
          width="100"
          sortable
          :sort-by="({ row }) => parseNum(row.weekly)"
        >
          <template #header>
            <span class="head-title">周增长率</span>
            <el-tooltip content="——最近7天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ fmtGrowth(row.weekly) }}</template>
        </vxe-column>
        <vxe-column
          field="monthly"
          align="center"
          width="100"
          sortable
          :sort-by="({ row }) => parseNum(row.monthly)"
        >
          <template #header>
            <span class="head-title">月增长率</span>
            <el-tooltip content="——最近30天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ fmtGrowth(row.monthly) }}</template>
        </vxe-column>
        <vxe-column
          field="yearly"
          align="center"
          width="100"
          sortable
          :sort-by="({ row }) => parseNum(row.yearly)"
        >
          <template #header>
            <span class="head-title">年增长率</span>
            <el-tooltip content="——最近90天折算" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
          <template #default="{ row }">{{ fmtGrowth(row.yearly) }}</template>
        </vxe-column>
        <vxe-column
          field="usage"
          title="当前使用率"
          align="center"
          width="120"
          sortable
          :sort-by="({ row }) => parseNum(row.usage)"
        >
          <!-- 状态胶囊：只突出数字，不整格变色（usage 兼容数字与 "100.0 %" 字符串） -->
          <template #default="{ row }">
            <span v-if="isEmptyText(row.usage)" class="usage-pill is-empty">—</span>
            <span v-else class="usage-pill" :class="usageClass(row.usage)">{{
              fmtUsage(row.usage)
            }}</span>
          </template>
        </vxe-column>
        <vxe-column field="warning" align="center" width="110">
          <template #header>
            <span class="head-title">智能预警</span>
            <el-tooltip content="多维度预警空间使用" placement="top">
              <i class="el-icon-question head-help-icon"></i>
            </el-tooltip>
          </template>
        </vxe-column>
        <!-- 备注不设宽度：吸收表格右侧剩余空间，自由展示 -->
        <vxe-column field="note" title="备注" show-overflow />
        <vxe-column field="cleanupStrategy" align="center" width="135">
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
import { listHdfsDirInfo } from '@/api/hdp'

// ===================== 数据源说明 =====================
// 真实数据：进入页面即 GET /hdp_api/get_hdp_node/hdfs_dir_info（python 服务）
// 接口成功 → 渲染真实目录行；接口失败/返回异常 → 追加 MOCK_COUNT 条模拟数据供本地预览
// 生产正式使用：删掉 loadData 失败分支里的 buildMockRows 追加即可

// 字节 → 拟人单位（与后端 sizeFormat 口径一致，如 "716.871 TB"）
function fmtBytes(bytes) {
  if (bytes === "" || bytes === null || bytes === undefined) return "";
  const n = Number(bytes);
  if (isNaN(n) || n < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return v.toFixed(3).replace(/\.?0+$/, "") + " " + units[u];
}

// 从接口返回体中稳健地取出目录行数组（兼容多种包装格式）
function normalizeDirRows(body) {
  if (!body) return null;
  if (Array.isArray(body)) return body; // 1. 直接返回数组
  if (typeof body !== "object") return null;
  if (Array.isArray(body.data)) return body.data; // 2. 若依风格 { code, data:[...] }
  const data = body.data && typeof body.data === "object" ? body.data : body;
  if (data) {
    for (const k of [
      "rows",
      "list",
      "records",
      "items",
      "result",
      "hdfs_dir_info",
      "hdfsDirInfo",
    ]) {
      if (Array.isArray(data[k])) return data[k]; // 3. 包装在 rows/list/... 下
    }
  }
  // 4. 按节点分组的字典 { 节点名: [行…] }：把目录行数组拍平成列表
  if (data && typeof data === "object") {
    const isRowObj = x =>
      x &&
      typeof x === "object" &&
      !Array.isArray(x) &&
      ("path" in x || "size" in x || "sizeFormat" in x || "cluster_name" in x || "name" in x);
    const lists = Object.values(data).filter(v => Array.isArray(v) && v.length && v.every(isRowObj));
    if (lists.length) return [].concat(...lists);
  }
  return null;
}

// ===================== 大数据量预览（模拟数据） =====================
// 接口不可用时追加 2 万条模拟数据，方便本地预览虚拟滚动渲染性能与效果
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

// 增长率 mock：仅覆盖后端四种形态 ""(空) / "0" / "20%" / "新增：20%"（不再有 +/- 号）
function pickGrowth() {
  const t = Math.random();
  if (t < 0.08) return "";
  if (t < 0.14) return "0";
  if (t < 0.2) return "新增：" + rand(1, 60).toFixed(0) + "%";
  return rand(0.05, 40).toFixed(2).replace(/\.?0+$/, "") + "%";
}

// 字段口径与后端一致：size=原始字节、sizeFormat=拟人单位、usage="xx.x %"、增长率支持四种形态
function buildMockRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const size = r < 0.03 ? "" : String(Math.floor(rand(1e11, 9e14)));
    let usage = "";
    if (r >= 0.05) {
      const v = r < 0.9 ? rand(8, 70) : rand(70.1, 99);
      usage = v.toFixed(1) + " %";
    }
    rows.push({
      cluster_name:
        clusterPool[i % clusterPool.length] + (Math.random() < 0.15 ? "-Total" : ""),
      path: dirPool[(i * 7 + Math.floor(Math.random() * 3)) % dirPool.length],
      size,
      sizeFormat: fmtBytes(size),
      daily: pickGrowth(),
      weekly: pickGrowth(),
      monthly: pickGrowth(),
      yearly: pickGrowth(),
      usage,
      warning: "",
      note: usage && parseFloat(usage) > 70 ? "想降低至70%的阈值，需要清理{XX}数据" : "",
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
      // 接口加载状态
      loading: false,
      rows: [
        {
          // 与真实返回同构的样例
          cluster_name: "hf_cluster_arm（案例）", // 集群名
          path: "/", // PATH
          size: "788207629211633", // 空间占用（默认，原始字节）
          sizeFormat: "716.871 TB", // 空间占用（拟人单位）
          daily: "0.3%", // 日增长率
          weekly: "0.63%", // 周增长率
          monthly: "", // 月增长率（形态：空）
          yearly: "新增：20%", // 年增长率（形态：新增）
          usage: "100.0 %", // 当前使用率
          warning: "", // 智能预警
          note: "使用率已达100%，需立即清理", // 备注
          cleanupStrategy: "定期审计目录使用情况，清理无用数据", // 目录清理策略
          cleanupStandard: "遵循最小权限原则，确保清理操作安全可控", // 目录清理规范
        },
        {
          cluster_name: "集群名2-Total（案例）",
          path: "/apps/hive/warehouse/business_dw.db",
          size: "1282210111221",
          sizeFormat: "1.166 TB",
          daily: "0", // 形态：0
          weekly: "20%", // 形态：20%
          monthly: "2%",
          yearly: "12%",
          usage: "76.0 %",
          warning: "",
          note: "想降低至70%的阈值，需要清理{XX}数据",
          cleanupStrategy: "",
          cleanupStandard: "",
        },
        {
          cluster_name: "集群名2-目录",
          path: "",
          size: "",
          sizeFormat: "",
          daily: "",
          weekly: "",
          monthly: "",
          yearly: "",
          usage: "",
          warning: "",
          note: "",
          cleanupStrategy: "",
          cleanupStandard: "",
        },
      ],
    };
  },
  created() {
    // 进入页面即请求真实接口（成功渲染真实数据，失败保留样例兜底）
    this.loadData();
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
    // 进入页面拉取 HDFS 目录信息：GET /hdp_api/get_hdp_node/hdfs_dir_info
    async loadData() {
      this.loading = true;
      try {
        const res = await listHdfsDirInfo();
        const raw = normalizeDirRows(res.data);
        if (!raw) {
          console.warn("HDFS目录接口返回结构异常：", res.data);
          this.appendMockRows();
          this.$message({ message: "目录接口返回格式异常，已加载模拟数据供预览", type: "warning" });
          return;
        }
        this.rows = raw.map(row => this.normalizeRow(row));
        if (!this.rows.length) {
          this.$message({ message: "暂无HDFS目录数据", type: "info" });
        }
      } catch (e) {
        console.error("加载HDFS目录信息失败：", e);
        this.appendMockRows();
        this.$message({ message: "目录接口请求失败，已加载模拟数据供预览", type: "warning" });
      } finally {
        this.loading = false;
      }
    },
    // 接口不可用时：在样例行后追加 2 万条模拟数据，供本地预览大数据量效果
    appendMockRows() {
      this.rows = this.rows.concat(buildMockRows(MOCK_COUNT));
    },
    // 行数据规整：缺 sizeFormat 时按 size 字节换算补上（后端可能只返回字节数）
    normalizeRow(row) {
      const r = { ...row };
      const s = r.size === null || r.size === undefined ? "" : String(r.size).trim();
      const f = r.sizeFormat === null || r.sizeFormat === undefined ? "" : String(r.sizeFormat).trim();
      if (!f && s) r.sizeFormat = fmtBytes(s);
      return r;
    },
    // 解析数值：兼容 "+0.3%"、"0.05 %"、"0"、"20%"、"新增：20%"、"100.0 %" 等
    // 提取首个（可带负号的）数字；无法解析或空值 → 负无穷（排序靠后）
    parseNum(val) {
      if (val === null || val === undefined) return -Infinity;
      const s = String(val).trim();
      if (!s) return -Infinity;
      const m = s.match(/-?\d+(?:\.\d+)?/);
      const n = m ? parseFloat(m[0]) : NaN;
      return isNaN(n) ? -Infinity : n;
    },
    // 容量字符串 → 字节数（排序用）：兼容 "716.871 TB" / "320 GB" / "1.166 TB" 等 KB/MB/GB/TB/PB 单位
    parseBytes(val) {
      if (val === null || val === undefined) return -Infinity;
      const s = String(val).trim().toUpperCase();
      if (!s) return -Infinity;
      const m = s.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|PB|K|M|G|T|P)?/);
      if (!m) return -Infinity;
      const num = parseFloat(m[1]);
      if (isNaN(num)) return -Infinity;
      const units = {
        B: 1,
        K: 1024,
        KB: 1024,
        M: 1024 ** 2,
        MB: 1024 ** 2,
        G: 1024 ** 3,
        GB: 1024 ** 3,
        T: 1024 ** 4,
        TB: 1024 ** 4,
        P: 1024 ** 5,
        PB: 1024 ** 5,
      };
      return num * (units[m[2]] || 1);
    },
    // 空间占用排序键：size 为纯数字字节串时直接按字节比较（最精确，无 2^53 精度顾虑以外的问题）
    // 否则回退解析拟人单位 sizeFormat，兼容 KB/MB/GB/TB/PB 混合排序
    sortSize(row) {
      const raw = row.size === null || row.size === undefined ? '' : String(row.size).trim();
      if (/^\d+(?:\.\d+)?$/.test(raw)) return parseFloat(raw);
      return this.parseBytes(row.sizeFormat);
    },
    // 增长率展示：空 → "—"；其余原样保留（"0" / "20%" / "新增：20%" / "-0.5 %"…）
    fmtGrowth(v) {
      const s = String(v === null || v === undefined ? "" : v).trim();
      return s ? s : "—";
    },
    // 使用率展示：空 → "—"；已有 "%" 去掉多余空格统一为 "xx.x%"；纯数字补 "%"
    fmtUsage(v) {
      const s = String(v === null || v === undefined ? "" : v).trim();
      if (!s) return "—";
      const n = this.parseNum(s);
      if (n === -Infinity) return s;
      return (n % 1 ? n.toFixed(1) : n) + "%";
    },
    // 是否为空文本（usage 兼容 null / "" / "  "）
    isEmptyText(v) {
      return !String(v === null || v === undefined ? "" : v).trim();
    },
    // 使用率档位：60/70/85 三档 → 状态色（内部先解析，兼容字符串 "100.0 %"）
    usageClass(usage) {
      const n = this.parseNum(usage);
      if (n >= 85) return "usage-danger";
      if (n >= this.threshold) return "usage-warning";
      if (n >= 60) return "usage-focus";
      return "usage-normal";
    },
    // 单元格样式：按列/数据语义返回不同 class（纯视觉，不影响逻辑）
    cellClassName({ row, column }) {
      const field = column.field || column.property;
      const cls = [];
      if (field === "cluster_name") {
        cls.push(String(row[field] || "").includes("-Total") ? "cell-total" : "col-main");
      } else if (field === "size" || field === "sizeFormat") {
        cls.push("num-col", "col-main");
      } else if (field === "path") {
        cls.push("col-path");
      } else if (field === "note") {
        cls.push("col-note");
        if (this.parseNum(row.usage) > this.threshold) cls.push("col-note-warn");
      } else if (["daily", "weekly", "monthly", "yearly"].includes(field)) {
        cls.push("num-col", "col-growth");
        const v = this.parseNum(row[field]);
        const text = String(row[field] || "").trim();
        if (v === -Infinity) cls.push("grow-empty");
        else if (text.indexOf("新增") === 0) cls.push("grow-new"); // 新增目录：绿色
        else if (v > 0.05) cls.push("grow-up");
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
  color: #e6a23c; /* 增长：低饱和橙 */
}
::v-deep .vxe-body--column.grow-new {
  color: #67c23a; /* 新增目录：绿 */
  font-weight: 600;
}
::v-deep .vxe-body--column.grow-flat {
  color: #909399; /* 无增长 / 0 */
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
