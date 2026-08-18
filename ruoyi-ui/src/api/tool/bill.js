import request from "@/utils/request";

/**
 * 系统账单接口
 *
 * 返回数据与 mockData/res.js 中的 billRes 结构保持一致：
 * {
 *   "1.重要系统": [ { systemName, data: [ { title, content } ] } ],
 *   "2.关键系统": [ ... ]
 * }
 *
 * 每个系统含三个部分（上中下）：
 *   - 虚拟机资源账单
 *   - 物理机资源账单
 *   - 低资源使用率明细
 * content 为多行文本，以 \n 分隔。
 */

const VM_CONTENT =
  "总量:252台\n\n         可用资源:\nCPU:6960c,内存:22176G,文件系统:202271.54G\n已使用:\nCPU:1479.63c,占比:21.26%\n内存:7751.72G,占比:34.96%\n文件系统:84609.39G,占比:41.83%";

const PM_CONTENT =
  "总量:252台\n可用资源:\nCPU:6960c,内存:22176G,文件系统:202271.54G\n已使用:\nCPU:1479.63c,占比:21.26%\n内存:7751.72G,占比:34.96%\n文件系统:84609.39G,占比:41.83%";

const LOW_USAGE_CONTENT =
  "合计17套集群资源使用率低,阈值30%。\n" +
  "集群HAPROXY-act_ht_haproxy_5:设备数:2\n可用资源:\nCPU:32c,内存:128G,文件系统:401.8G\n已使用:\nCPU:0.31c,占比:0.98%\n内存:26.47G,占比:20.68%\n文件系统:6.46G,占比:1.61%\n" +
  "集群HAPROXY-act_ht_haproxy_7:设备数:2\n可用资源:\nCPU:16c,内存:32G,文件系统:321.84G\n已使用:\nCPU:2.13c,占比:13.34%\n内存:8.49G,占比:26.52%\n文件系统:2.44G,占比:0.76%\n" +
  "集群HAPROXY-act_ht_haproxy_8:设备数:2\n可用资源:\nCPU:16c,内存:32G,文件系统:321.84G\n已使用:\nCPU:2.15c,占比:13.46%\n内存:8.49G,占比:26.53%\n文件系统:2.44G,占比:0.76%\n" +
  "集群HAPROXY-act_ht_haproxy_9:设备数:2\n可用资源:\nCPU:16c,内存:32G,文件系统:321.84G\n已使用:\nCPU:2.22c,占比:13.87%...";

// 生成一个系统（含 上/中/下 三个部分）
function buildSystem(systemName) {
  return {
    systemName,
    data: [
      { title: "虚拟机资源账单", content: VM_CONTENT },
      { title: "物理机资源账单", content: PM_CONTENT },
      { title: "低资源使用率明细", content: LOW_USAGE_CONTENT },
    ],
  };
}

// 账单 Mock 数据
const MOCK_BILL = {
  code: 200,
  msg: "success",
  data: {
    "1.重要系统": [buildSystem("S新核心_账户处理")],
    "2.关键系统": [buildSystem("S数据服务网关")],
  },
};

/**
 * 获取系统账单数据
 * @param {Object} params - 预留请求参数
 */
export function getBillData(params) {
  // Mock 模式
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(MOCK_BILL)));
    }, 300);
  });

  // 真实接口
  // return request({
  //   url: '/tool/bill/list',
  //   method: 'get',
  //   params
  // })
}

export default { getBillData };
