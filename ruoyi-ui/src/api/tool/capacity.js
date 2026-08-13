import request from '@/utils/request'
import monitorTestData, { resStr, res1, res2 } from '@/views/tool/capacity/test.js'

// ==================== 生成大量实例组的 Mock 分类 ====================
function generateLargeCategory() {
  const cat = {}
  const idcs = ['BJ-DB', 'BJ-YZ', 'BJ-LH', 'BJ-YF', 'BJ-DX', 'BJ-HD', 'BJ-CY', 'BJ-FT', 'BJ-SY', 'BJ-TZ', 'BJ-MT', 'BJ-PG', 'BJ-HR']
  for (let i = 1; i <= 52; i++) {
    const pad = String(i).padStart(3, '0')
    const idcIdx = i % idcs.length
    const code = i <= 30 ? 0 : (i <= 44 ? 1 : 2)
    const desc = code === 2 ? '资源使用率过高，需紧急处理' : (code === 1 ? '部分指标接近阈值，建议关注' : '运行状态正常')
    const rowCount = (i % 3) + 2 // 每组 2-4 条记录
    const rows = []
    for (let j = 0; j < rowCount; j++) {
      const rpad = String(j + 1).padStart(2, '0')
      const baseRow = {
        code: (i + j) % 5 === 0 ? 2 : ((i + j) % 3 === 0 ? 1 : 0),
        cpu: String((i % 8) + 2),
        memory: String([4, 8, 16, 32, 64][(i + j) % 5]),
        hostname: `bja-dsi-k8s-node-${pad}-${rpad}-kzx`,
        ip: `25.${129 + (i % 7)}.${i}.${10 + j}`,
        idc: idcs[idcIdx],
        os: ['Red.Hat.Enterprise.Linux.7.9', 'Red.Hat.Enterprise.Linux.8.6', 'CentOS.7.9', 'Kylin.Linux.Advanced.Server.V10'][j % 4]
      }
      // 前 3 个实例组添加额外列，模拟列多导致操作被遮挡的场景
      if (i <= 3) {
        Object.assign(baseRow, {
          disk_usage: String(45 + ((i + j) * 7) % 40) + '%',
          network_in: String(120 + (i * 31) % 500) + 'MB/s',
          network_out: String(80 + (j * 47) % 300) + 'MB/s',
          iops_read: String(1500 + (i * 200) % 3000),
          iops_write: String(800 + (j * 300) % 2000),
          connections: String(320 + (i + j) * 50),
          qps: String(1200 + (i * j) * 100),
          avg_latency: (2.3 + (i * 0.5) + (j * 0.3)).toFixed(1) + 'ms',
        })
      }
      rows.push(baseRow)
    }
    cat[`bja-dsi-k8s-cluster-${pad}`] = { code, desc, data: rows }
  }
  return cat
}

// ==================== Mock 数据 ====================
const MOCK_RESPONSE = {
  code: 200,
  msg: 'success',
  data: {
    analysis_params: {
      system: ''
    },
    analysis_result: {
      'K8S集群(52实例组模拟)': generateLargeCategory(),
      GREATDB: {
        'bja-dsi-greatdb-1': {
          code: 0, // code: 0=正常(绿), 1=警告(黄), 2=异常(红)
          desc: '主集群运行稳定，CPU与内存使用率均在合理范围',
          data: [
            { code: 0, cpu: '8', memory: '32', hostname: 'bja-dsi-greatdb-010-kzx', ip: '25.129.2.110', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 0, cpu: '8', memory: '32', hostname: 'bja-dsi-greatdb-011-kzx', ip: '25.129.2.111', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 1, cpu: '8', memory: '64', hostname: 'bja-dsi-greatdb-012-kzx', ip: '25.129.2.112', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' }
          ]
        },
        'bjb-dsi-greatdb-1': {
          code: 1,
          desc: '备集群内存使用率持续偏高，建议近期扩容',
          data: [
            { code: 1, cpu: '4', memory: '16', hostname: 'bjb-dsi-greatdb-010-kzx', ip: '25.129.3.110', idc: 'BJ-YZ', os: 'CentOS.7.9' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bjb-dsi-greatdb-011-kzx', ip: '25.129.3.111', idc: 'BJ-YZ', os: 'CentOS.7.9' }
          ]
        },
        'bjc-dsi-greatdb-1': {
          code: 0,
          desc: '灾备集群运行正常，定期同步延迟在秒级',
          data: [
            { code: 0, cpu: '8', memory: '32', hostname: 'bjc-dsi-greatdb-010-kzx', ip: '25.129.4.110', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux.8.6' },
            { code: 0, cpu: '8', memory: '32', hostname: 'bjc-dsi-greatdb-011-kzx', ip: '25.129.4.111', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux.8.6' }
          ]
        },
        'bjd-dsi-greatdb-1': {
          code: 2,
          desc: '磁盘空间不足，部分表空间增长异常需紧急处理',
          data: [
            { code: 2, cpu: '4', memory: '16', hostname: 'bjd-dsi-greatdb-010-kzx', ip: '25.129.5.110', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 1, cpu: '4', memory: '16', hostname: 'bjd-dsi-greatdb-011-kzx', ip: '25.129.5.111', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 2, cpu: '4', memory: '16', hostname: 'bjd-dsi-greatdb-012-kzx', ip: '25.129.5.112', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux.7.9' }
          ]
        },
        'bje-dsi-greatdb-1': {
          code: 1,
          desc: '只读实例CPU负载波动较大，慢查询偶发增长',
          data: [
            { code: 1, cpu: '8', memory: '32', hostname: 'bje-dsi-greatdb-010-kzx', ip: '25.129.6.110', idc: 'BJ-DX', os: 'Red.Hat.Enterprise.Linux.8.6' },
            { code: 0, cpu: '8', memory: '32', hostname: 'bje-dsi-greatdb-011-kzx', ip: '25.129.6.111', idc: 'BJ-DX', os: 'Red.Hat.Enterprise.Linux.8.6' }
          ]
        }
      },
      HAPROXY: {
        'bja-dsi-haproxy-1': {
          code: 0,
          desc: '主负载均衡节点，流量分发正常，连接数稳定',
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bja-dsi-haproxy-020-kzx', ip: '25.129.2.210', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bja-dsi-haproxy-021-kzx', ip: '25.129.2.211', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bja-dsi-haproxy-022-kzx', ip: '25.129.2.212', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjb-dsi-haproxy-1': {
          code: 0,
          desc: '备用负载均衡，承接离线流量与定时任务',
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bjb-dsi-haproxy-020-kzx', ip: '25.129.3.210', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' },
            { code: 1, cpu: '2', memory: '4', hostname: 'bjb-dsi-haproxy-021-kzx', ip: '25.129.3.211', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjc-dsi-haproxy-1': {
          code: 2,
          desc: '活跃连接数超阈值，CPU负载过高，需紧急扩容',
          data: [
            { code: 2, cpu: '2', memory: '4', hostname: 'bjc-dsi-haproxy-020-kzx', ip: '25.129.4.210', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 2, cpu: '2', memory: '4', hostname: 'bjc-dsi-haproxy-021-kzx', ip: '25.129.4.211', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 1, cpu: '2', memory: '4', hostname: 'bjc-dsi-haproxy-022-kzx', ip: '25.129.4.212', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjd-dsi-haproxy-1': {
          code: 0,
          desc: '新机房负载均衡节点，承接灰度流量',
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bjd-dsi-haproxy-020-kzx', ip: '25.129.5.210', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bjd-dsi-haproxy-021-kzx', ip: '25.129.5.211', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bje-dsi-haproxy-1': {
          code: 1,
          desc: '部分后端服务响应超时，需排查上游链路',
          data: [
            { code: 1, cpu: '2', memory: '4', hostname: 'bje-dsi-haproxy-030-kzx', ip: '25.129.6.210', idc: 'BJ-DX', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bje-dsi-haproxy-031-kzx', ip: '25.129.6.211', idc: 'BJ-DX', os: 'Red.Hat.Enterprise.Linux' },
            { code: 1, cpu: '2', memory: '4', hostname: 'bje-dsi-haproxy-032-kzx', ip: '25.129.6.212', idc: 'BJ-DX', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      },
      'JAVA应用': {
        'bj-order-service-1': {
          code: 0,
          desc: '订单核心服务，QPS稳定，线程池使用正常',
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-order-svc-010-kzx', ip: '25.129.2.50', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-order-svc-011-kzx', ip: '25.129.2.51', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 1, cpu: '4', memory: '8', hostname: 'bj-order-svc-012-kzx', ip: '25.129.2.52', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-payment-service-1': {
          code: 1,
          desc: '支付服务GC频率偏高，Young GC间隔缩短，需调整JVM参数',
          data: [
            { code: 1, cpu: '8', memory: '16', hostname: 'bj-pay-svc-010-kzx', ip: '25.129.2.60', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '8', memory: '16', hostname: 'bj-pay-svc-011-kzx', ip: '25.129.2.61', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-user-service-1': {
          code: 0,
          desc: '用户服务运行正常，接口响应时间在预期范围内',
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-user-svc-010-kzx', ip: '25.129.2.70', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-user-svc-011-kzx', ip: '25.129.2.71', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-user-svc-012-kzx', ip: '25.129.2.72', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-gateway-service-1': {
          code: 0,
          desc: 'API网关服务，流量路由与鉴权正常',
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-gateway-svc-010-kzx', ip: '25.129.2.80', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-gateway-svc-011-kzx', ip: '25.129.2.81', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-notification-service-1': {
          code: 1,
          desc: '消息推送服务，偶发队列积压需关注',
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bj-notify-svc-010-kzx', ip: '25.129.2.90', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 1, cpu: '2', memory: '4', hostname: 'bj-notify-svc-011-kzx', ip: '25.129.2.91', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-scheduler-service-1': {
          code: 0,
          desc: '定时任务调度服务，任务执行成功率99.8%',
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-scheduler-svc-010-kzx', ip: '25.129.2.100', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-scheduler-svc-011-kzx', ip: '25.129.2.101', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 1, cpu: '4', memory: '8', hostname: 'bj-scheduler-svc-012-kzx', ip: '25.129.2.102', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      },
      MYSQL: {
        'bja-dsi-mysql-1': {
          code: 0,
          desc: '主库集群读写正常，主从延迟在毫秒级',
          data: [
            { code: 0, cpu: '16', memory: '64', hostname: 'bja-dsi-mysql-010-kzx', ip: '25.129.2.130', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' },
            { code: 0, cpu: '16', memory: '64', hostname: 'bja-dsi-mysql-011-kzx', ip: '25.129.2.131', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' },
            { code: 1, cpu: '16', memory: '64', hostname: 'bja-dsi-mysql-012-kzx', ip: '25.129.2.132', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' }
          ]
        },
        'bjb-dsi-mysql-1': {
          code: 2,
          desc: '从库慢查询数量激增，部分索引失效需紧急重建',
          data: [
            { code: 2, cpu: '8', memory: '32', hostname: 'bjb-dsi-mysql-010-kzx', ip: '25.129.3.130', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 1, cpu: '8', memory: '32', hostname: 'bjb-dsi-mysql-011-kzx', ip: '25.129.3.131', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux.7.9' }
          ]
        },
        'bjc-dsi-mysql-1': {
          code: 1,
          desc: '只读实例连接数接近上限，建议增加只读节点',
          data: [
            { code: 1, cpu: '8', memory: '32', hostname: 'bjc-dsi-mysql-010-kzx', ip: '25.129.4.130', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 0, cpu: '8', memory: '32', hostname: 'bjc-dsi-mysql-011-kzx', ip: '25.129.4.131', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 1, cpu: '8', memory: '32', hostname: 'bjc-dsi-mysql-012-kzx', ip: '25.129.4.132', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux.7.9' }
          ]
        }
      },
      NGINX: {
        'bja-dsi-nginx-1': {
          code: 0,
          desc: '前台网关集群，流量转发正常，无异常状态码',
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bja-dsi-nginx-030-kzx', ip: '25.129.2.20', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bja-dsi-nginx-031-kzx', ip: '25.129.2.21', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bja-dsi-nginx-032-kzx', ip: '25.129.2.22', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjb-dsi-nginx-1': {
          code: 0,
          desc: '备用机房网关，承接跨机房调度流量',
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-nginx-030-kzx', ip: '25.129.3.20', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-nginx-031-kzx', ip: '25.129.3.21', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjc-dsi-nginx-1': {
          code: 1,
          desc: 'P99延迟略有上升，建议关注后端连接池状态',
          data: [
            { code: 1, cpu: '4', memory: '8', hostname: 'bjc-dsi-nginx-030-kzx', ip: '25.129.4.20', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bjc-dsi-nginx-031-kzx', ip: '25.129.4.21', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjd-dsi-nginx-1': {
          code: 2,
          desc: '502错误码突增，需紧急排查上游服务健康状态',
          data: [
            { code: 2, cpu: '4', memory: '8', hostname: 'bjd-dsi-nginx-030-kzx', ip: '25.129.5.20', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux' },
            { code: 2, cpu: '4', memory: '8', hostname: 'bjd-dsi-nginx-031-kzx', ip: '25.129.5.21', idc: 'BJ-YF', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      },
      REDIS: {
        'bja-dsi-redis-1': {
          code: 0,
          desc: '主缓存集群命中率97%以上，响应时间亚毫秒级',
          data: [
            { code: 0, cpu: '4', memory: '16', hostname: 'bja-dsi-redis-010-kzx', ip: '25.129.2.150', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bja-dsi-redis-011-kzx', ip: '25.129.2.151', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bja-dsi-redis-012-kzx', ip: '25.129.2.152', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjb-dsi-redis-1': {
          code: 1,
          desc: '内存使用接近上限，建议扩容或调整淘汰策略',
          data: [
            { code: 1, cpu: '4', memory: '8', hostname: 'bjb-dsi-redis-010-kzx', ip: '25.129.3.150', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-redis-011-kzx', ip: '25.129.3.151', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjc-dsi-redis-1': {
          code: 0,
          desc: '缓存预热实例，命中率逐步提升中',
          data: [
            { code: 0, cpu: '4', memory: '16', hostname: 'bjc-dsi-redis-010-kzx', ip: '25.129.4.150', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bjc-dsi-redis-011-kzx', ip: '25.129.4.151', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      }
    },
    metadata: {
      os: '操作系统',
      hostname: '主机名',
      ip: 'IP地址',
      idc: '机房',
      cpu: 'CPU核数',
      memory: '内存(GB)',
      CPU: 'CPU使用率(%)',
      '内存': '内存使用率(%)',
      connections: '连接数',
      qps: 'QPS',
      tps: 'TPS',
      slow_queries: '慢查询数',
      hit_rate: '命中率(%)',
      threads: '线程数',
      gc_count: 'GC次数',
      active_connections: '活跃连接数',
      requests_per_sec: '请求数/秒',
      used_memory: '已用内存(MB)',
      max_memory: '最大内存(MB)',
      disk_usage: '磁盘使用率',
      network_in: '入站流量',
      network_out: '出站流量',
      iops_read: '读IOPS',
      iops_write: '写IOPS',
      avg_latency: '平均延迟'
    },
    report: [
      {
        title: '全量低负载分析',
        content: '本次扫描共覆盖 12 个系统大类、82 个实例组、约 300 台主机。\n其中低负载（CPU 平均使用率 < 30%、内存使用率 < 40%）实例占比约 68%，整体资源利用率偏低。\n\n建议：\n1. 对长期低负载的实例组进行规格降配或实例合并，释放闲置资源；\n2. 结合业务波峰波谷，合理调整副本数量。'
      },
      {
        title: '全量高负载分析',
        content: '高负载（CPU 平均使用率 > 80% 或内存使用率 > 85%）实例共 23 台，主要集中在 GREATDB、HAPROXY 与部分 JAVA 应用。\n其中 6 台已持续高负载超过 24 小时，存在性能劣化风险。\n\n建议：\n1. 优先对异常实例进行垂直扩容（升配 CPU/内存）；\n2. 对无状态 JAVA 应用进行水平扩容，分散流量压力。'
      },
      {
        title: 'CPU 使用率分析',
        content: '全量实例 CPU 平均使用率为 46.8%，P95 使用率为 82.3%。\n高 CPU 实例主要集中在 HAPROXY 网关（bjc-dsi-haproxy-1 集群），平均使用率达 87%，峰值逼近 95%。\n\n建议：为网关实例开启连接复用与压缩，必要时增加节点分摊流量。'
      },
      {
        title: '内存使用率分析',
        content: '全量实例内存平均使用率为 61.2%，其中 12 台实例内存使用率超过 85%。\nREDIS 集群内存使用率整体偏高（均值 78%），存在缓存淘汰导致命中率下降的风险。\n\n建议：\n1. 调整 REDIS 淘汰策略并评估扩容；\n2. 排查 JAVA 应用堆内存设置，避免 GC 频繁。'
      },
      {
        title: '磁盘容量分析',
        content: '磁盘使用率超过 80% 的实例共 9 台，其中 bjd-dsi-greatdb-1 集群磁盘使用率已达 92%，增长趋势明显。\n\n建议：\n1. 立即清理历史归档与无用日志，释放磁盘空间；\n2. 对表空间增长异常的库做数据归档或扩容。'
      },
      {
        title: '网络流量分析',
        content: '核心机房 BJ-DB 入站流量峰值 2.4GB/s、出站峰值 1.8GB/s，带宽利用率约 71%。\n跨机房调度流量（BJ-DB -> BJ-YZ）占出站流量的 42%，链路压力较大。\n\n建议：评估跨机房专线扩容，或将高频跨机房访问切换为就近读。'
      },
      {
        title: '数据库连接与慢查询分析',
        content: 'MYSQL 集群活跃连接数峰值 3800，连接池使用率 84%，接近上限。\n慢查询数量近 24 小时增长 35%，主要来自 bjb-dsi-mysql-1 从库的部分失效索引。\n\n建议：\n1. 重建失效索引；\n2. 适当提高连接池上限并开启慢查询实时告警。'
      },
      {
        title: '缓存命中率分析',
        content: 'REDIS 主集群命中率 97.2%，表现良好；备集群命中率 89.5%，略低于预期。\n部分热点 key 出现集中访问，存在单分片热点风险。\n\n建议：对热点 key 进行拆分或本地缓存，降低单分片压力。'
      },
      {
        title: '实例分布与机房概览',
        content: '实例分布在 BJ-DB、BJ-YZ、BJ-LH、BJ-YF、BJ-DX 等 13 个机房。\nBJ-DB 机房实例数量最多（约 128 台），承担核心流量；BJ-YZ 作为同城灾备。\n\n建议：核心与灾备实例尽量跨机房部署，避免单机房故障影响整体可用性。'
      },
      {
        title: '风险项汇总与优化建议',
        content: '本次分析共发现风险项 17 个，其中：\n- 高危（需立即处理）：6 个，涉及磁盘不足、CPU 超限、慢查询激增；\n- 中危（建议近期处理）：8 个，涉及内存偏高、连接数接近上限；\n- 低危（持续关注）：3 个，涉及低负载资源浪费。\n\n建议按「磁盘/CPU/内存 -> 连接/慢查询 -> 低负载降配」的顺序逐项闭环处理。'
      }
    ]
  }
}

// ==================== API 接口 ====================

/**
 * 获取性能容量分析数据（POST）
 * @param {Object} data - 请求参数 { system: string }
 */
export function getCapacityAnalysis(data) {
  // Mock 模式
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = JSON.parse(JSON.stringify(MOCK_RESPONSE))
      if (data && data.system) {
        const keyword = data.system.toLowerCase()
        const filtered = {}
        Object.keys(result.data.analysis_result).forEach((key) => {
          if (key.toLowerCase().includes(keyword)) {
            filtered[key] = result.data.analysis_result[key]
          }
        })
        if (Object.keys(filtered).length > 0) {
          result.data.analysis_result = filtered
        }
      }
      resolve(result)
    }, 400)
  })

  // 真实接口
  // return request({
  //   url: '/tool/capacity/analysis',
  //   method: 'post',
  //   data
  // })
}

/**
 * 获取单机监控详情（Mock 模拟）
 * @param {Object} params - { hostname: string }
 */
export function getMonitorDetail(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(monitorTestData)
    }, 600)
  })
}

/**
 * 获取配置文件内容（Mock 模拟）
 * @param {Object} params - { hostname: string }
 */
export function getConfigFile(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const hostname = (params && params.hostname) || ''
      // 包含 greatdb 的返回异常情况(res2)，其他返回正常配置(resStr)
      if (/greatdb/i.test(hostname)) {
        resolve({ retCode: 500, data: null, message: res2.message })
      } else {
        resolve({ retCode: 200, data: resStr })
      }
    }, 400)
  })
}

/**
 * 获取服务器磁盘信息（Mock 模拟）
 * @param {Object} params - { hostname: string }
 * res1: 正常情况 - 物理盘 + 逻辑盘
 * res2: 异常情况 - 仅支持物理机
 *
 * 通过 hostname 中是否包含 "greatdb" 来模拟异常情况，便于演示两种场景
 */
export function getServerInfo(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const hostname = (params && params.hostname) || ''
      // 包含 greatdb 的返回异常情况(res2)，其他返回正常情况(res1)
      if (/greatdb/i.test(hostname)) {
        resolve({ code: 200, data: res2 })
      } else {
        resolve({ code: 200, data: res1 })
      }
    }, 300)
  })
}

export default { getCapacityAnalysis, getMonitorDetail, getConfigFile, getServerInfo }
