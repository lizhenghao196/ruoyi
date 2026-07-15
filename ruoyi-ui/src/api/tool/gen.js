import request from '@/utils/request'

// 查询生成表数据
export function listTable(query) {
  return request({
    url: '/tool/gen/list',
    method: 'get',
    params: query
  })
}
// 查询db数据库列表
export function listDbTable(query) {
  return request({
    url: '/tool/gen/db/list',
    method: 'get',
    params: query
  })
}

// 查询表详细信息
export function getGenTable(tableId) {
  return request({
    url: '/tool/gen/' + tableId,
    method: 'get'
  })
}

// 修改代码生成信息
export function updateGenTable(data) {
  return request({
    url: '/tool/gen',
    method: 'put',
    data: data
  })
}

// 导入表
export function importTable(data) {
  return request({
    url: '/tool/gen/importTable',
    method: 'post',
    params: data
  })
}

// 创建表
export function createTable(data) {
  return request({
    url: '/tool/gen/createTable',
    method: 'post',
    params: data
  })
}

// 预览生成代码
export function previewTable(tableId) {
  return request({
    url: '/tool/gen/preview/' + tableId,
    method: 'get'
  })
}

// 删除表数据
export function delTable(tableId) {
  return request({
    url: '/tool/gen/' + tableId,
    method: 'delete'
  })
}

// 生成代码（自定义路径）
export function genCode(tableName) {
  return request({
    url: '/tool/gen/genCode/' + tableName,
    method: 'get'
  })
}

// 同步数据库
export function synchDb(tableName) {
  return request({
    url: '/tool/gen/synchDb/' + tableName,
    method: 'get'
  })
}

let res = {
"code": 0,
"data": {
"affFunctionAsyncFunc": "",
"affFunctionCallGaptime": 0,
"affFunctionCallType": "0",
"affFunctionDesc": "【开发:范鼎威】dns切换的结果查询函数(处置台执行流量切换后，切换结果的查询)",
"affFunctionDoubleExecute": "N",
"affFunctionHeaders": '{"Content-Type":"application/json"}',
"affFunctionId": 89,
"affFunctionMaxNum": 10,
"affFunctionMethod": "POST",
"affFunctionName": "func_dns_switch_verify",
"affFunctionParams": '{"func_type":"func_oos_query","record_id":""}',
"affFunctionType": "execFunc",
"affFunctionUrl": "http://10.2.64.36:8121/api/func/verify",
"afIsEnabled": "1",
"afManualConfirm": "N",
"afResConfirm": "N",
"afSpecialMark": "{}",
"createBy": "admin",
"updateBy": "admin",
"affFunctionChName": "123"
},
"msg": "成功"
}
