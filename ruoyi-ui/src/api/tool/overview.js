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

export function getCicdImplementList() {
  return request({
    url: '/tool/overview/cicdImplement',
    method: 'get'
  })
}

export function getMaintenanceNoticeList() {
  return request({
    url: '/tool/overview/maintenanceNotice',
    method: 'get'
  })
}
