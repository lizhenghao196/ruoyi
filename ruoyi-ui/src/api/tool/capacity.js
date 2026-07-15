import request from '@/utils/request'
import monitorTestData from '@/views/tool/capacity/test.js'

// ==================== Mock 数据 ====================
const MOCK_RESPONSE = {
  code: 200,
  msg: 'success',
  data: {
    analysis_params: {
      system: ''
    },
    analysis_result: {
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
      max_memory: '最大内存(MB)'
    }
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

export default { getCapacityAnalysis, getMonitorDetail }
