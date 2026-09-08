import axios from 'axios'
import { getToken } from '@/utils/auth'

// HDP 容量数据源（独立 python 服务，非若依后端）
// 接口由前端同源直接提供（如 nginx location /hdp_api），因此不走 /dev-api|/prod-api 网关前缀
// 若部署后该接口挂在网关前缀下，把 BASE 改为 process.env.VUE_APP_BASE_API 即可
const BASE = ''

// 获取 HDFS 目录信息（GET，页面进入即调用）
export function listHdfsDirInfo(params) {
  return axios({
    url: BASE + '/hdp_api/get_hdp_node/hdfs_dir_info',
    method: 'get',
    params,
    timeout: 30000,
    headers: getToken() ? { Authorization: 'Bearer ' + getToken() } : {}
  })
}
