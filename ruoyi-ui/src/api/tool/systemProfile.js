import request from '@/utils/request'
import { systemProfileRes } from '../../../mockData/res'

/**
 * 系统画像接口
 *
 * 返回数据与 mockData/res.js 中的 systemProfileRes 结构保持一致：
 * {
 *   基础信息: { 主机房, 数据中心[], 系统名, 系统简介, 系统重要性级别, 所属集群 },
 *   组件拓扑: { 组件类型: { 集群名: [ 主机对象 ] } },
 *   链路: 链路关系图数据，前端 normalizeLinks 兼容两种格式：
 *     1. 对象数组：[{ fnode: "A", snode: "B" }, ...]
 *     2. 生产网真实格式（元组）：[["A", "snode", "B"], ...] / [["A", "", "B"], ...]
 *     节点名是原始字符串（如 bpc@SZ-CS-SCYW-CSPROD@app-bpc），不带「组件类型/集群名」前缀；
 *     节点一律同色，只按链路关系分层排布，不做任何特殊标记
 *     附加字段可选：例如 desc（链路描述），有就在悬浮连线时展示，没有就不显示 ——
 *     对象格式直接加键（{ fnode, snode, desc }），元组格式在末尾挂一个对象
 *     （["A", "snode", "B", { desc: "..." }]）；除 source/target 外的字段都会原样透传
 *   集群关系: { 组件类型: [ { clusterName, nodes[] } ] }
 * }
 */

/**
 * 组件配套操作（下载配置 / 读取配置文件 / 读取链路信息）的演示数据开关
 * ==========================================================================
 *   true   → 下面三个函数走本地 mock（本文件内 MOCK_*），页面可直接点出弹窗看效果
 *   false  → 全部走真实后端（/proxy/profile_center/*）
 *
 * ⚠️ 这三个接口是**配置中心**的，返回成功码是字符串 '0000'（不是若依的 200），
 *    utils/request.js 的响应拦截器已经把 '0000' 加进成功码白名单。
 * 想彻底清掉 mock：把本常量删掉，同时删掉每个函数开头那段 `if (USE_MOCK) { ... }` 即可
 * ==========================================================================
 */
const USE_MOCK = true

const MOCK_PROFILE = {
  code: 200,
  msg: 'success',
  data: systemProfileRes
}

// mock：从源端下载资源配置
const MOCK_DOWNLOAD_CONFIG = {
  code: '0000',
  data: 'node: 26.131.49.188 successs'
}

// mock：组件配套文件读取（content 里刻意保留 \n 与 \t，用来验证弹窗不重排格式）
const MOCK_READ_CONFIG = {
  code: '0000',
  msg: 'success',
  data: [
    {
      filename: '26.131.49.188',
      content:
        '# /etc/nginx/nginx.conf\n' +
        'user  nginx;\n' +
        'worker_processes  auto;\n' +
        '\n' +
        'events {\n' +
        '\tworker_connections  10240;\n' +
        '}\n' +
        '\n' +
        'http {\n' +
        '\tinclude       mime.types;\n' +
        '\tdefault_type  application/octet-stream;\n' +
        '\tlog_format  main  \'$remote_addr - $remote_user [$time_local] "$request" \'\n' +
        '\t                  \'$status $body_bytes_sent "$http_referer" \'\n' +
        '\t                  \'"$http_user_agent" "$http_x_forwarded_for"\';\n' +
        '\n' +
        '\t# 上游服务\n' +
        '\tupstream app_backend {\n' +
        '\t\tserver 26.131.49.101:8080  weight=5 max_fails=3 fail_timeout=10s;\n' +
        '\t\tserver 26.131.49.188:8080  weight=5 max_fails=3 fail_timeout=10s;\n' +
        '\t\tkeepalive 64;\n' +
        '\t}\n' +
        '\n' +
        '\tserver {\n' +
        '\t\tlisten       80;\n' +
        '\t\tserver_name  _;\n' +
        '\n' +
        '\t\tlocation / {\n' +
        '\t\t\tproxy_pass   http://app_backend;\n' +
        '\t\t\tproxy_set_header   Host             $host;\n' +
        '\t\t\tproxy_set_header   X-Real-IP        $remote_addr;\n' +
        '\t\t\tproxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;\n' +
        '\t\t\tproxy_read_timeout 60s;\n' +
        '\t\t}\n' +
        '\t}\n' +
        '}\n'
    },
    {
      filename: '26.131.49.101',
      content:
        '# /etc/nginx/conf.d/upstream.conf\n' +
        'upstream auth_service {\n' +
        '\tserver 26.131.49.101:9001;\n' +
        '\tserver 26.131.49.188:9001;\n' +
        '}\n' +
        '\n' +
        'server {\n' +
        '\tlisten 9001;\n' +
        '\tlocation /auth {\n' +
        '\t\tproxy_pass http://auth_service;\n' +
        '\t}\n' +
        '}\n'
    },
    {
      // JSON 型 content（生产上 JAVA微服务/微服务组件的配置文件常是这个形态）：
      // 用来验证弹窗会把字符串 parse 成对象、用 json-viewer 展开 2 层展示
      filename: 'pay-gateway@prod',
      content: JSON.stringify(
        {
          'eureka.client.httpPing.enable': true,
          'eureka.client.httpPing.retryCount': 2,
          'eureka.client.service-url.defaultZone':
            'http://eureka-kzx1:8761/eureka/',
          'spring.datasource.url':
            'jdbc:mysql://bjb-dasp-mysql-kzx:3306/pay?useUnicode=true',
          'server.port': 8080,
          logging: { level: { root: 'INFO', 'com.cncb': 'DEBUG' } },
          'thread-pool': { core: 8, max: 32, queue: 200 }
        },
        null,
        2
      )
    }
  ]
}

// mock：读取配置文件中的链路信息
const MOCK_READ_LINK = {
  code: '0000',
  msg: 'success',
  data: {
    clusterName: 'bjb-dasp-nginx-kzx',
    updateTime: '2026-11-09 21:05:12',
    nodes: [
      {
        node: 'bjb-dasp-nginx-kzx@bjb-nginx-lb',
        type: 'NGINX',
        ip: '26.131.49.188',
        upstreams: [
          { target: 'bjb-dasp-app-kzx@bjb-app-01', port: 8080, weight: 5 },
          { target: 'bjb-dasp-app-kzx@bjb-app-02', port: 8080, weight: 5 }
        ]
      },
      {
        node: 'bjb-dasp-app-kzx@bjb-app-01',
        type: 'JAVA微服务',
        ip: '26.131.49.101',
        upstreams: [{ target: 'bjb-dasp-mysql-kzx@bjb-mysql-m', port: 3306, weight: 1 }]
      }
    ]
  }
}

/**
 * 获取系统画像数据
 * @param {Object} params - 预留请求参数
 */
export function getSystemProfile(params) {
  // Mock 模式
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(MOCK_PROFILE)))
    }, 300)
  })

  // 真实接口
  // return request({
  //   url: '/tool/systemProfile/list',
  //   method: 'get',
  //   params
  // })
}

/**
 * 从源端下载资源配置至本地
 * @param {Object} data - { systemId, module, clusterName, refresh }
 *    refresh 默认 1（强制刷新，不吃源端缓存）
 * @returns { code: '0000', data: 'node: xxx successs' }
 */
export function downloadConfigToLocal(data) {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Object.assign({}, MOCK_DOWNLOAD_CONFIG))
      }, 600)
    })
  }
  return request({
    url: '/proxy/profile_center/download/config',
    method: 'post',
    data: Object.assign({ refresh: 1 }, data)
  })
}

/**
 * 组件配套文件读取
 * @param {Object} data - { systemId, module, clusterName }
 * @returns { code: '0000', msg, data: [ { filename, content } ] }
 *    content 是文件原文（含 \n \t），展示时**不能**重排格式
 */
export function readComponentConfig(data) {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(JSON.parse(JSON.stringify(MOCK_READ_CONFIG)))
      }, 600)
    })
  }
  return request({
    url: '/proxy/profile_center/readconfig',
    method: 'post',
    data
  })
}

/**
 * 读取配置文件中的链路信息
 * @param {Object} data - { systemId, module, clusterName }
 * @returns { code: '0000', data: <JSON 对象> }
 */
export function readComponentLink(data) {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(JSON.parse(JSON.stringify(MOCK_READ_LINK)))
      }, 600)
    })
  }
  return request({
    url: '/proxy/profile_center/config/readLink',
    method: 'post',
    data
  })
}

export default {
  getSystemProfile,
  downloadConfigToLocal,
  readComponentConfig,
  readComponentLink
}
