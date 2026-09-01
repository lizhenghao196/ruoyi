<template>
  <div ref="chart" class="spark-line"></div>
</template>

<script>
import * as echarts from "echarts";

export default {
  name: "SparkLine",
  props: {
    // 近6个月数据，下标0为最远月，下标5为最近月
    data: {
      type: Array,
      default: () => [],
    },
  },
  computed: {
    months() {
      // 根据当前日期生成近6个月标签（下标0为最远月）
      const labels = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.getMonth() + 1 + "月");
      }
      return labels;
    },
  },
  mounted() {
    // 表格 cell 渲染完成后容器才有实际宽度，等 nextTick 再初始化
    this.$nextTick(() => {
      this.initChart();
      window.addEventListener("resize", this.handleResize);
    });
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
    clearTimeout(this.retryTimer);
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  },
  watch: {
    data: {
      deep: true,
      handler() {
        this.chart && this.chart.setOption(this.buildOption());
      },
    },
  },
  methods: {
    handleResize() {
      this.chart && this.chart.resize();
    },
    buildOption() {
      return {
        grid: { left: 38, right: 8, top: 26, bottom: 24 },
        xAxis: {
          type: "category",
          data: this.months,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: "#DCDFE6" } },
          axisLabel: { fontSize: 10, color: "#909399", interval: 0, margin: 6 },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: 100,
          splitNumber: 2,
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#EBEEF5", type: "dashed" } },
          axisLabel: {
            fontSize: 10,
            color: "#909399",
            formatter: "{value}%",
          },
        },
        tooltip: {
          trigger: "axis",
          confine: true,
          formatter: params => {
            const p = params[0];
            return p.name + "：" + p.value + "%";
          },
        },
        series: [
          {
            type: "line",
            data: this.data,
            smooth: true,
            symbol: "circle",
            symbolSize: 4,
            showSymbol: true,
            lineStyle: { width: 2, color: "#409EFF" },
            itemStyle: { color: "#409EFF" },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(64, 158, 255, 0.35)" },
                { offset: 1, color: "rgba(64, 158, 255, 0.02)" },
              ]),
            },
            emphasis: { focus: "series" },
            label: {
              show: true,
              position: "top",
              distance: 5,
              fontSize: 10,
              color: "#409EFF",
              formatter: params => params.value + "%",
            },
          },
        ],
      };
    },
    initChart() {
      if (!this.data || !this.data.length) return;
      const el = this.$refs.chart;
      // 容器宽度还没就绪（表格列宽未排完）时稍后重试，避免图表只画出一半
      if (!el || !el.offsetWidth) {
        this.retryTimer = setTimeout(() => this.initChart(), 100);
        return;
      }
      this.chart = echarts.init(el);
      this.chart.setOption(this.buildOption());
      this.chart.resize();
    },
  },
};
</script>

<style scoped>
.spark-line {
  width: 100%;
  height: 104px;
}
</style>
