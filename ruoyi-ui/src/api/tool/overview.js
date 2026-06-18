import request from '@/utils/request'

export function getOverviewExecutions() {
  return request({
    url: '/tool/overview/executions',
    method: 'get'
  })
}

export function getOverviewMessages(params) {
  return request({
    url: '/tool/overview/messages',
    method: 'get',
    params
  })
}
