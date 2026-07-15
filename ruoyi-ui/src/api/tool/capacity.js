import request from '@/utils/request'

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
          code: 0,
          data: [
            { code: 0, cpu: '8', memory: '32', hostname: 'bja-dsi-greatdb-010-kzx', ip: '25.129.2.110', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 0, cpu: '8', memory: '32', hostname: 'bja-dsi-greatdb-011-kzx', ip: '25.129.2.111', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 0, cpu: '8', memory: '64', hostname: 'bja-dsi-greatdb-012-kzx', ip: '25.129.2.112', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' }
          ]
        },
        'bjb-dsi-greatdb-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '16', hostname: 'bjb-dsi-greatdb-010-kzx', ip: '25.129.3.110', idc: 'BJ-YZ', os: 'CentOS.7.9' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bjb-dsi-greatdb-011-kzx', ip: '25.129.3.111', idc: 'BJ-YZ', os: 'CentOS.7.9' }
          ]
        }
      },
      HAPROXY: {
        'bja-dsi-haproxy-1': {
          code: 0,
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bja-dsi-haproxy-020-kzx', ip: '25.129.2.210', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bja-dsi-haproxy-021-kzx', ip: '25.129.2.211', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bja-dsi-haproxy-022-kzx', ip: '25.129.2.212', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjb-dsi-haproxy-1': {
          code: 0,
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bjb-dsi-haproxy-020-kzx', ip: '25.129.3.210', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bjb-dsi-haproxy-021-kzx', ip: '25.129.3.211', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjc-dsi-haproxy-1': {
          code: 0,
          data: [
            { code: 0, cpu: '2', memory: '4', hostname: 'bjc-dsi-haproxy-020-kzx', ip: '25.129.4.210', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bjc-dsi-haproxy-021-kzx', ip: '25.129.4.211', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '2', memory: '4', hostname: 'bjc-dsi-haproxy-022-kzx', ip: '25.129.4.212', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      },
      'JAVA应用': {
        'bj-order-service-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-order-svc-010-kzx', ip: '25.129.2.50', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-order-svc-011-kzx', ip: '25.129.2.51', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-order-svc-012-kzx', ip: '25.129.2.52', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-payment-service-1': {
          code: 0,
          data: [
            { code: 0, cpu: '8', memory: '16', hostname: 'bj-pay-svc-010-kzx', ip: '25.129.2.60', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '8', memory: '16', hostname: 'bj-pay-svc-011-kzx', ip: '25.129.2.61', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bj-user-service-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-user-svc-010-kzx', ip: '25.129.2.70', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-user-svc-011-kzx', ip: '25.129.2.71', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bj-user-svc-012-kzx', ip: '25.129.2.72', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      },
      MYSQL: {
        'bja-dsi-mysql-1': {
          code: 0,
          data: [
            { code: 0, cpu: '16', memory: '64', hostname: 'bja-dsi-mysql-010-kzx', ip: '25.129.2.130', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' },
            { code: 0, cpu: '16', memory: '64', hostname: 'bja-dsi-mysql-011-kzx', ip: '25.129.2.131', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' },
            { code: 0, cpu: '16', memory: '64', hostname: 'bja-dsi-mysql-012-kzx', ip: '25.129.2.132', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux.8.6' }
          ]
        },
        'bjb-dsi-mysql-1': {
          code: 0,
          data: [
            { code: 0, cpu: '8', memory: '32', hostname: 'bjb-dsi-mysql-010-kzx', ip: '25.129.3.130', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux.7.9' },
            { code: 0, cpu: '8', memory: '32', hostname: 'bjb-dsi-mysql-011-kzx', ip: '25.129.3.131', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux.7.9' }
          ]
        }
      },
      NGINX: {
        'bja-dsi-nginx-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bja-dsi-nginx-030-kzx', ip: '25.129.2.20', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bja-dsi-nginx-031-kzx', ip: '25.129.2.21', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bja-dsi-nginx-032-kzx', ip: '25.129.2.22', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjb-dsi-nginx-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-nginx-030-kzx', ip: '25.129.3.20', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-nginx-031-kzx', ip: '25.129.3.21', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjc-dsi-nginx-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bjc-dsi-nginx-030-kzx', ip: '25.129.4.20', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bjc-dsi-nginx-031-kzx', ip: '25.129.4.21', idc: 'BJ-LH', os: 'Red.Hat.Enterprise.Linux' }
          ]
        }
      },
      REDIS: {
        'bja-dsi-redis-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '16', hostname: 'bja-dsi-redis-010-kzx', ip: '25.129.2.150', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bja-dsi-redis-011-kzx', ip: '25.129.2.151', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '16', hostname: 'bja-dsi-redis-012-kzx', ip: '25.129.2.152', idc: 'BJ-DB', os: 'Red.Hat.Enterprise.Linux' }
          ]
        },
        'bjb-dsi-redis-1': {
          code: 0,
          data: [
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-redis-010-kzx', ip: '25.129.3.150', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' },
            { code: 0, cpu: '4', memory: '8', hostname: 'bjb-dsi-redis-011-kzx', ip: '25.129.3.151', idc: 'BJ-YZ', os: 'Red.Hat.Enterprise.Linux' }
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

export default { getCapacityAnalysis }
