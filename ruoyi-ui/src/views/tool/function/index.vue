<template>
  <div class="app-container">
    <!-- 查询区域 -->
    <el-form :model="queryForm" ref="queryForm" :inline="true">
      <el-form-item label="函数名称">
        <el-input
          v-model="queryForm.functionName"
          placeholder="请输入函数名称"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="el-icon-search" @click="handleQuery">查询</el-button>
        <el-button icon="el-icon-refresh" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 表格 -->
    <el-table
      :data="filteredList"
      border
      stripe
      v-loading="loading"
      style="width: 100%"
    >
      <el-table-column prop="affFunctionName" label="函数名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="affFunctionDesc" label="函数描述" min-width="260" show-overflow-tooltip />
      <el-table-column prop="affFunctionMethod" label="请求方式" width="90" align="center">
        <template slot-scope="{ row }">
          <el-tag
            :type="methodTagType(row.affFunctionMethod)"
            size="small"
            disable-transitions
          >{{ row.affFunctionMethod }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="affFunctionUrl" label="请求URL" min-width="260" show-overflow-tooltip />
      <el-table-column prop="afIsEnabled" label="状态" width="80" align="center">
        <template slot-scope="{ row }">
          <el-switch
            :value="row.afIsEnabled === '1'"
            disabled
            active-color="#13ce66"
            inactive-color="#ff4949"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template slot-scope="{ row }">
          <el-button type="primary" size="mini" icon="el-icon-video-play" @click="openDebugDialog(row)">
            调试
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 调试弹窗 -->
    <el-dialog
      :visible.sync="debugVisible"
      :title="'调试: ' + debugFunc.affFunctionName"
      width="1300px"
      top="2vh"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="debug-layout">
        <!-- 左侧：请求配置 -->
        <div class="debug-left">
          <!-- Method + URL -->
          <div class="debug-row">
            <el-input
              :value="debugFunc.affFunctionMethod"
              disabled
              class="debug-method"
            />
            <el-input
              :value="debugFunc.affFunctionUrl"
              disabled
              placeholder="请求URL"
              class="debug-url"
            />
          </div>

          <!-- Headers -->
          <div class="debug-field">
            <div class="debug-field__label">Headers：</div>
            <MonacoEditor
              v-model="debugHeaders"
              language="json"
              height="180"
            />
          </div>

          <!-- Params -->
          <div class="debug-field">
            <div class="debug-field__label">Params：</div>
            <MonacoEditor
              v-model="debugParams"
              language="json"
              height="200"
            />
          </div>

          <!-- 发送按钮 -->
          <div class="debug-actions">
            <el-button type="primary" icon="el-icon-s-promotion" :loading="debugSending" @click="sendDebugRequest">
              发送请求
            </el-button>
            <el-button icon="el-icon-refresh" @click="resetDebugForm">重置</el-button>
          </div>
        </div>

        <!-- 右侧：响应结果 -->
        <div class="debug-right">
          <template v-if="debugResult">
            <!-- 状态栏 -->
            <div class="response-bar" :class="debugResult.data.status === 200 ? 'is-success' : 'is-error'">
              <span class="response-bar__status">
                <i :class="debugResult.data.status === 200 ? 'el-icon-success' : 'el-icon-error'" />
                {{ debugResult.data.status === 200 ? '请求成功' : '请求异常' }}
              </span>
              <span class="response-bar__code">Status: {{ debugResult.data.status }}</span>
              <span class="response-bar__duration">耗时: <strong>{{ debugResult.data.duration }}ms</strong></span>
            </div>

            <!-- Response Body -->
            <div class="debug-field">
              <div class="debug-field__label">Response Body：</div>
              <div class="json-viewer-box">
                <JsonViewer
                  :key="debugResultKey"
                  :value="parseJson(debugResult.data.body)"
                  :expand-depth="3"
                  :show-array-index="false"
                  copyable
                >
                  <template v-slot:copy>复制</template>
                </JsonViewer>
              </div>
            </div>

            <!-- Response Headers -->
            <div class="debug-field">
              <div class="debug-field__label">Response Headers：</div>
              <div class="json-viewer-box">
                <JsonViewer
                  :key="debugResultKey + '_headers'"
                  :value="debugResult.data.headers"
                  :expand-depth="2"
                  :show-array-index="false"
                  copyable
                >
                  <template v-slot:copy>复制</template>
                </JsonViewer>
              </div>
            </div>
          </template>
          <div v-else class="debug-right__empty">
            <i class="el-icon-s-promotion" />
            <p>点击「发送请求」查看响应结果</p>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import MonacoEditor from '@/components/MonacoEditor'
import JsonViewer from 'vue-json-viewer'
import 'vue-json-viewer/style.css'

// ======================== 表格 mock 数据 ========================
const MOCK_TABLE_DATA = [
  {
    affFunctionAsyncFunc: '',
    affFunctionCallGaptime: 0,
    affFunctionCallType: '0',
    affFunctionDesc: '【开发:范鼎威】dns切换的结果查询函数(处置台执行流量切换后，切换结果的查询)',
    affFunctionDoubleExecute: 'N',
    affFunctionHeaders: '{"Content-Type":"application/json"}',
    affFunctionId: 89,
    affFunctionMaxNum: 10,
    affFunctionMethod: 'POST',
    affFunctionName: 'func_dns_switch_verify',
    affFunctionParams: '{"func_type":"func_oos_query","record_id":""}',
    affFunctionType: 'execFunc',
    affFunctionUrl: 'http://10.2.64.36:8121/api/func/verify',
    afIsEnabled: '1',
    afManualConfirm: 'N',
    afResConfirm: 'N',
    afSpecialMark: '{}',
    createBy: 'admin',
    updateBy: 'admin',
    affFunctionChName: '123'
  },
  {
    affFunctionAsyncFunc: '',
    affFunctionCallGaptime: 0,
    affFunctionCallType: '0',
    affFunctionDesc: '【开发:张三】cmdb主机信息查询接口，用于同步资产数据',
    affFunctionDoubleExecute: 'N',
    affFunctionHeaders: '{"Content-Type":"application/json","X-Auth-Token":"xxx"}',
    affFunctionId: 90,
    affFunctionMaxNum: 5,
    affFunctionMethod: 'POST',
    affFunctionName: 'func_cmdb_host_query',
    affFunctionParams: '{"host_ip":"","idc":"","page":1,"page_size":50}',
    affFunctionType: 'execFunc',
    affFunctionUrl: 'http://10.2.64.36:8121/api/cmdb/host/query',
    afIsEnabled: '1',
    afManualConfirm: 'N',
    afResConfirm: 'N',
    afSpecialMark: '{}',
    createBy: 'admin',
    updateBy: 'admin',
    affFunctionChName: '456'
  },
  {
    affFunctionAsyncFunc: '',
    affFunctionCallGaptime: 0,
    affFunctionCallType: '1',
    affFunctionDesc: '【开发:李四】监控告警回调处理函数，接收zabbix告警并写入工单系统',
    affFunctionDoubleExecute: 'N',
    affFunctionHeaders: '{"Content-Type":"application/json"}',
    affFunctionId: 91,
    affFunctionMaxNum: 20,
    affFunctionMethod: 'POST',
    affFunctionName: 'func_alert_callback',
    affFunctionParams: '{"alert_id":"","alert_level":"","alert_msg":"","host":"","trigger_time":""}',
    affFunctionType: 'execFunc',
    affFunctionUrl: 'http://10.2.64.37:8121/api/alert/callback',
    afIsEnabled: '1',
    afManualConfirm: 'Y',
    afResConfirm: 'N',
    afSpecialMark: '{"priority":"high"}',
    createBy: 'admin',
    updateBy: 'admin',
    affFunctionChName: '789'
  },
  {
    affFunctionAsyncFunc: '',
    affFunctionCallGaptime: 300,
    affFunctionCallType: '0',
    affFunctionDesc: '【开发:王五】配置变更推送，将配置中心变更同步到各业务线',
    affFunctionDoubleExecute: 'N',
    affFunctionHeaders: '{"Content-Type":"application/json","Authorization":"Bearer token123"}',
    affFunctionId: 92,
    affFunctionMaxNum: 8,
    affFunctionMethod: 'PUT',
    affFunctionName: 'func_config_push',
    affFunctionParams: '{"app_name":"","config_key":"","config_value":"","env":"prod"}',
    affFunctionType: 'execFunc',
    affFunctionUrl: 'http://10.2.64.38:8121/api/config/push',
    afIsEnabled: '0',
    afManualConfirm: 'N',
    afResConfirm: 'Y',
    afSpecialMark: '{}',
    createBy: 'admin',
    updateBy: 'admin',
    affFunctionChName: '012'
  },
  {
    affFunctionAsyncFunc: '',
    affFunctionCallGaptime: 0,
    affFunctionCallType: '0',
    affFunctionDesc: '【开发:赵六】日志查询聚合接口，支持多维度日志检索',
    affFunctionDoubleExecute: 'Y',
    affFunctionHeaders: '{"Content-Type":"application/json"}',
    affFunctionId: 93,
    affFunctionMaxNum: 15,
    affFunctionMethod: 'POST',
    affFunctionName: 'func_log_search',
    affFunctionParams: '{"index":"","query":"","start_time":"","end_time":"","size":100}',
    affFunctionType: 'execFunc',
    affFunctionUrl: 'http://10.2.64.39:8121/api/log/search',
    afIsEnabled: '1',
    afManualConfirm: 'N',
    afResConfirm: 'N',
    afSpecialMark: '{}',
    createBy: 'admin',
    updateBy: 'admin',
    affFunctionChName: '345'
  },
  {
    affFunctionAsyncFunc: '',
    affFunctionCallGaptime: 0,
    affFunctionCallType: '0',
    affFunctionDesc: '【开发:孙七】健康检查接口，探测目标服务可用性',
    affFunctionDoubleExecute: 'N',
    affFunctionHeaders: '{}',
    affFunctionId: 94,
    affFunctionMaxNum: 50,
    affFunctionMethod: 'GET',
    affFunctionName: 'func_health_check',
    affFunctionParams: '{"target_url":"","timeout":5}',
    affFunctionType: 'execFunc',
    affFunctionUrl: 'http://10.2.64.40:8121/api/health/check',
    afIsEnabled: '1',
    afManualConfirm: 'N',
    afResConfirm: 'N',
    afSpecialMark: '{}',
    createBy: 'admin',
    updateBy: 'admin',
    affFunctionChName: '678'
  }
]

export default {
  name: 'FunctionManage',

  components: {
    MonacoEditor,
    JsonViewer
  },

  data() {
    return {
      // 查询
      queryForm: { functionName: '' },
      loading: false,
      // 表格数据
      tableList: MOCK_TABLE_DATA,
      // 调试弹窗
      debugVisible: false,
      debugFunc: {},
      debugHeaders: '{}',
      debugParams: '{}',
      debugSending: false,
      debugResult: null,
      debugResultKey: 0
    }
  },

  computed: {
    filteredList() {
      const keyword = (this.queryForm.functionName || '').toLowerCase()
      if (!keyword) return this.tableList
      return this.tableList.filter((row) => {
        return (
          (row.affFunctionName || '').toLowerCase().includes(keyword) ||
          (row.affFunctionDesc || '').toLowerCase().includes(keyword)
        )
      })
    }
  },

  methods: {
    // ========== 查询 ==========
    handleQuery() {
      this.loading = true
      setTimeout(() => { this.loading = false }, 200)
    },

    handleReset() {
      this.queryForm.functionName = ''
    },

    // ========== 调试弹窗 ==========
    openDebugDialog(row) {
      // 模拟获取函数详情（实际应该调接口）
      this.debugFunc = { ...row }
      try {
        this.debugHeaders = JSON.stringify(JSON.parse(row.affFunctionHeaders), null, 2)
      } catch (e) {
        this.debugHeaders = row.affFunctionHeaders || '{}'
      }
      try {
        this.debugParams = JSON.stringify(JSON.parse(row.affFunctionParams), null, 2)
      } catch (e) {
        this.debugParams = row.affFunctionParams || '{}'
      }
      this.debugResult = null
      this.debugSending = false
      this.debugVisible = true
    },

    resetDebugForm() {
      try {
        this.debugHeaders = JSON.stringify(JSON.parse(this.debugFunc.affFunctionHeaders), null, 2)
      } catch (e) { /* ignore */ }
      try {
        this.debugParams = JSON.stringify(JSON.parse(this.debugFunc.affFunctionParams), null, 2)
      } catch (e) { /* ignore */ }
      this.debugResult = null
    },

    sendDebugRequest() {
      this.debugSending = true
      this.debugResult = null

      // 模拟请求耗时
      const startTime = Date.now()
      const mockDuration = 80 + Math.floor(Math.random() * 200)

      setTimeout(() => {
        const elapsed = Date.now() - startTime
        // 用实际耗时或 mock 耗时（取较大者模拟真实场景）
        const duration = Math.max(elapsed, mockDuration)

        // 模拟响应结果
        this.debugResult = {
          code: 200,
          msg: 'success',
          data: {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Server': 'nginx/1.20.1',
              'X-Request-Id': 'req_' + Date.now(),
              'X-Response-Time': duration + 'ms',
              'Connection': 'keep-alive'
            },
            body: JSON.stringify({
              code: 0,
              message: '操作成功',
              data: {
                task_id: 'task_' + Math.random().toString(36).slice(2, 10),
                status: 'completed',
                result: '函数执行成功，返回预期结果',
                timestamp: new Date().toISOString()
              }
            }, null, 2),
            duration: duration
          }
        }

        this.debugResultKey++
        this.debugSending = false
      }, mockDuration)
    },

    // ========== 工具 ==========
    methodTagType(method) {
      const map = { GET: '', POST: 'success', PUT: 'warning', DELETE: 'danger', PATCH: 'info' }
      return map[method] || ''
    },

    parseJson(str) {
      if (!str || typeof str !== 'string') return str
      try {
        return JSON.parse(str)
      } catch (e) {
        return str
      }
    }
  }
}
</script>

<style lang="scss" scoped>
// ==================== 调试弹窗 - 左右布局 ====================
.debug-layout {
  display: flex;
  gap: 16px;
  min-height: 520px;
}

.debug-left {
  flex: 0 0 480px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.debug-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #EBEEF5;
  padding-left: 16px;

  &__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #C0C4CC;

    i {
      font-size: 48px;
      margin-bottom: 12px;
    }

    p {
      font-size: 14px;
    }
  }
}

// Method + URL 行
.debug-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;

  .debug-method {
    width: 90px;
    flex: 0 0 auto;

    ::v-deep .el-input__inner {
      font-weight: 700;
      color: #409EFF;
      text-align: center;
      background: #ecf5ff;
      border-color: #b3d8ff;
    }
  }

  .debug-url {
    flex: 1;
  }
}

.debug-field {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;

  &__label {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 5px;
    flex: 0 0 auto;
  }
}

.debug-actions {
  display: flex;
  gap: 10px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid #EBEEF5;
  flex: 0 0 auto;
}

// 响应状态栏
.response-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  flex: 0 0 auto;
  flex-wrap: wrap;

  &.is-success {
    background: rgba(103, 194, 58, 0.08);
    border: 1px solid rgba(103, 194, 58, 0.2);
  }

  &.is-error {
    background: rgba(245, 108, 108, 0.08);
    border: 1px solid rgba(245, 108, 108, 0.2);
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;

    i { font-size: 16px; }

    .is-success & {
      color: #67C23A;
    }

    .is-error & {
      color: #F56C6C;
    }
  }

  &__code {
    font-size: 13px;
    font-family: Consolas, Monaco, monospace;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;

    .is-success & {
      color: #67C23A;
      background: rgba(103, 194, 58, 0.12);
    }

    .is-error & {
      color: #F56C6C;
      background: rgba(245, 108, 108, 0.12);
    }
  }

  &__duration {
    margin-left: auto;
    font-size: 13px;
    color: #909399;

    strong {
      color: #303133;
      font-family: Consolas, Monaco, monospace;
    }
  }
}

// JsonViewer 展示容器
.json-viewer-box {
  flex: 1;
  min-height: 0;
  height: 220px;
  overflow: auto;
  border: 1px solid #EBEEF5;
  border-radius: 4px;
  padding: 10px 14px;
  background: #fff;

  ::v-deep .jv-container {
    font-size: 13px;
  }
}
</style>
