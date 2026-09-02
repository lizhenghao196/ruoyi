let res = {
  code: 200,
  msg: "操作成功",
  data: [
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
