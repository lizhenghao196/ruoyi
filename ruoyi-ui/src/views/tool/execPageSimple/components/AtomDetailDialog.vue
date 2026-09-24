<template>
  <!-- 外层 div 只是为了让 Vue 2 有单一根节点：明细弹窗与三个「结果类」弹窗是并列的 -->
  <div class="add-wrap">
    <el-dialog
    :visible="visible"
    custom-class="add-dialog"
    width="100%"
    top="5vh"
    append-to-body
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div slot="title" class="add-title">
      <span class="add-title__text">查看明细</span>
      <span v-if="nodeName" class="add-title__node" :title="nodeName">{{
        nodeName
      }}</span>
      <span class="add-title__count">{{ atoms.length }} 个原子</span>
      <!--
        自动刷新开着时不再显示「函数明细加载中…」：每个周期闪一次太吵，
        而且右边已经有常亮的「刷新中...」把状态说清楚了（表格本身还有 loading 遮罩）。
      -->
      <span v-if="loading && !autoRefreshing" class="add-title__loading"
        >函数明细加载中…</span
      >
      <!--
        「函数批量跳过」入口：只在有原子时显示（空列表点开也是空，没什么可跳的）。
        显隐条件 `atoms.length` 而非 `!loading` —— 加载中时也别让按钮可点，
        等数据回来再让用户操作，避免「选了之后发现没原子」的尴尬。
      -->
      <button
        v-if="atoms.length"
        type="button"
        class="add-title__btn"
        :disabled="loading"
        @click="openBatchSkip"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" class="add-title__btn-icon">
          <path
            d="M2.2 5.2h6.2M8.4 5.2L5.6 2.6M8.4 5.2L5.6 7.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect
            x="2"
            y="9"
            width="8"
            height="1.2"
            rx="0.6"
            fill="currentColor"
          />
        </svg>
        函数批量跳过
      </button>

      <!--
        「一键跳过失败函数」入口：紧挨「函数批量跳过」右边。
        显隐与「函数批量跳过」对齐（`atoms.length`），但禁用态额外要求
        「失败函数列表非空」—— 没失败函数可跳时按钮置灰，避免点开空弹窗。
        loading 单独走 `jumpLoading`，与「函数批量跳过」互不干扰。

        用原生 `<button>` 而不是 `<el-button>`：视觉要跟左边那个对齐（同色同高），
        Element 的 mini + primary 默认样式偏白底蓝边，复写一圈不划算。
        「loading」靠「disabled + 文字变处理中」实现 —— 没动画，但体验够用：
        按钮被锁住不会重复点、状态明确告诉用户正在处理。
      -->
      <button
        v-if="atoms.length"
        type="button"
        class="add-title__btn add-title__btn--secondary"
        :class="{ 'is-loading': jumpLoading }"
        :disabled="loading || jumpLoading || filedFncList.length === 0"
        @click="skipFnc"
      >
        {{ jumpLoading ? "处理中…" : "一键跳过失败函数" }}
      </button>

      <!--
        「刷新 / 停止刷新」：点一下开一个定时器去刷明细（间隔 5s，比页面轮询慢一档）。

        ⚠️ 定时器**不在这里**，在父组件（index.vue 的 startDetailAutoRefresh）：
           弹窗是哑组件 —— 数据、loading 都在父组件手里，定时器跟着数据所有权走；
           而且「关弹窗」只有 closeDetail 一条路，销毁点唯一、不会漏。
           这里只把「切一下开关」抛给父组件，文案跟着父组件传回来的 `autoRefreshing` 走。

        ⚠️ 刻意**不**受 `loading` 约束（另外两个按钮都受）：自动刷新期间表格一直在 loading，
           按钮要是跟着 disabled，用户就没法把刷新停下来了。
        ⚠️ 显示条件带上 `autoRefreshing`：万一刷新回来原子列表变空了，
           按钮不能跟着消失 —— 否则定时器还开着，用户却找不到地方关它。
      -->
      <button
        v-if="atoms.length || autoRefreshing"
        type="button"
        class="add-title__btn add-title__btn--secondary"
        :class="{ 'is-active': autoRefreshing }"
        @click="toggleAutoRefresh"
      >
        {{ autoRefreshing ? "停止刷新" : "刷新" }}
      </button>
      <!-- 自动刷新开着时的黄色呼吸提示：常亮呼吸（表示「刷新一直在跑」），不是每次请求闪一下 -->
      <span v-if="autoRefreshing" class="add-title__refreshing">刷新中...</span>
    </div>

    <div class="add">
      <el-table
        ref="table"
        v-loading="loading"
        :data="atoms"
        row-key="aaiInstanceAtomId"
        :expand-row-keys="expandRowKeys"
        :height="tableHeight"
        size="mini"
        border
        @expand-change="onExpandChange"
        @row-dblclick="onRowDblclick"
      >
        <!-- 空表：三种情况文案不同，避免「一片空白不知道在等还是在错」 -->
        <template slot="empty">
          <div class="add-empty">
            <span v-if="loading" class="add-empty__text">正在加载明细…</span>
            <span v-else-if="error" class="add-empty__text is-bad">{{
              error
            }}</span>
            <span v-else class="add-empty__text">该节点下没有原子</span>
          </div>
        </template>

        <!--
          展开列：按原子类型分两种内容
            人工确认类 -> 「人工确认描述」+ 节点的 aniNodeDomurl
            其余类型   -> 函数明细（表格，等会做）
        -->
        <el-table-column type="expand" width="42">
          <template slot-scope="scope">
            <div class="add-expand">
              <template v-if="isHumanConfirmRow(scope.row)">
                <el-tag class="add-expand__tag">人工确认描述</el-tag>
                <p class="add-expand__desc">{{ selfDesc }}</p>
              </template>

              <!-- 其余类型：所属函数列表 -->
              <template v-else>
                <el-tag class="add-expand__tag">所属函数列表</el-tag>
                <el-table
                  :data="scope.row.functions"
                  :row-class-name="fnRowClassName(scope.row)"
                  height="300"
                  size="mini"
                  class="add-fn"
                >
                  <el-table-column type="index" width="50" />

                  <el-table-column label="函数" align="center">
                    <template slot-scope="fn">
                      <!-- ⚠️ 是 funcChName（Ch = Chinese），不是 funcCnName —— 写错这一列会静默变空 -->
                      <p class="add-fn__cell">{{ fn.row.funcChName }}</p>
                    </template>
                  </el-table-column>

                  <el-table-column label="状态" align="center">
                    <template slot-scope="fn">
                      <dict-tag :options="statusOptions" :value="fn.row.status" />
                    </template>
                  </el-table-column>

                  <!-- 最新结果：点过的那一行带【新】标记，方便回头看是哪一行 -->
                  <el-table-column label="最新结果" align="center" width="100">
                    <template slot-scope="fn">
                      <el-button
                        type="text"
                        size="small"
                        @click="uniqueInfo('result', fn.row, scope.row, fn)"
                      >
                        最新结果
                        <span
                          v-if="isNewResult(scope.row, fn.$index)"
                          class="add-fn__new"
                          >【新】</span
                        >
                      </el-button>
                    </template>
                  </el-table-column>

                  <el-table-column label="重试次数/最大重试次数" align="center">
                    <template slot-scope="fn">
                      <p class="add-fn__cell">
                        {{ retryTimes(scope.row, fn.row) }} /
                        {{ fn.row.maxRetryNum }}
                      </p>
                    </template>
                  </el-table-column>

                  <el-table-column label="函数计划执行时间" align="center">
                    <template slot-scope="fn">
                      {{ planExecuteTime(scope.row, fn.row) }}
                    </template>
                  </el-table-column>

                  <el-table-column label="操作" align="center">
                    <template slot-scope="fn">
                      <el-button
                        type="text"
                        size="small"
                        :disabled="fn.row.status === 'INIT'"
                        @click="uniqueInfo('history', fn.row, scope.row)"
                      >
                        历史结果
                      </el-button>
                      <el-button
                        type="text"
                        size="small"
                        :disabled="fn.row.status === 'INIT'"
                        @click="uniqueInfo('log', fn.row, scope.row)"
                      >
                        日志
                      </el-button>
                      <el-button
                        v-if="canSkipFn(fn.row)"
                        type="text"
                        size="small"
                        :disabled="isFnSkipDisabled(scope.row, fn.row)"
                        :loading="isFnLoading(scope.row, fn.row, 'skip')"
                        @click="fncSkipFnc(fn.row, scope.row)"
                      >
                        跳过
                      </el-button>
                      <el-button
                        v-if="canResultConfirm(fn.row)"
                        type="text"
                        size="small"
                        :disabled="fn.row.status !== 'CONFIRM'"
                        :loading="isFnLoading(scope.row, fn.row, 'confirm')"
                        @click="resultConfirm(fn.row, scope.row)"
                      >
                        结果确认
                      </el-button>
                      <el-button
                        v-if="!projectRoleDisabled"
                        type="text"
                        size="small"
                        :disabled="execDisableFnc(fn.row)"
                        :loading="isFnLoading(scope.row, fn.row, 'run')"
                        @click="manualFunc(fn.row, scope.row, fn)"
                      >
                        执行
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
            </div>
          </template>
        </el-table-column>

        <!-- 第二列：原子名称 -->
        <el-table-column
          label="原子名称"
          prop="aaiAtomName"
          align="center"
          width="160"
          show-overflow-tooltip
        />

        <!-- 第三列：机房（取自原子配置 JSON 的 idc） -->
        <el-table-column label="机房" align="center" width="80">
          <template slot-scope="scope">
            <p class="add-cell">{{ regionFnc(scope.row) }}</p>
          </template>
        </el-table-column>

        <!--
          第四列：域名切换类节点显示「指令描述」，其余节点显示「工单」。

          ⚠️「工单」列可以**双击**查该工单关联的自动发布文档（见 onRowDblclick）。
             「双击表格单元格」不是个能被猜到的交互，所以这里做两件事：
               ① 蓝色 + hover 下划线 —— 让它看起来就是「能点的」；
               ② 悬停 tooltip 直接写出「双击查看…」。
             ⚠️ 因为要用自定义 tooltip，这一列**不能**再挂 `show-overflow-tooltip`
                （两者会打架：一个是 el-table 自己包的 tooltip，一个是 el-tooltip）。
        -->
        <el-table-column
          v-if="isDomainSwitch"
          label="指令描述"
          prop="aaiOrderId"
          align="center"
          width="160"
        >
          <template slot-scope="scope">
            <el-tooltip placement="top">
              <div slot="content">
                {{ labelFnc(scope.row) }}
                <br />
                record_id: {{ recordIdFnc(scope.row) }}
              </div>
              <p class="add-cell is-ellipsis">{{ labelFnc(scope.row) }}</p>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column
          v-else
          label="工单"
          prop="aaiOrderId"
          align="center"
          width="160"
          class-name="add-order-cell"
        >
          <template slot-scope="scope">
            <el-tooltip
              v-if="scope.row.aaiOrderId"
              placement="top"
              content="双击查看该工单关联的文档"
            >
              <p class="add-cell is-order">{{ scope.row.aaiOrderId }}</p>
            </el-tooltip>
            <p v-else class="add-cell">—</p>
          </template>
        </el-table-column>

        <!-- 第五列：状态 -->
        <el-table-column
          label="状态"
          prop="aaiAtomStatus"
          align="center"
          width="100"
          sortable
        >
          <template slot-scope="scope">
            <dict-tag
              :options="statusOptions"
              :value="scope.row.aaiAtomStatus"
            />
          </template>
        </el-table-column>

        <!-- 第六列：原子计划时间（人工确认类节点没有） -->
        <el-table-column label="原子计划时间" align="center" width="200">
          <template slot-scope="scope">
            <div v-if="!isHumanConfirmNode">
              {{ planTimeFnc(scope.row) }}
            </div>
          </template>
        </el-table-column>

        <!-- 第七列：工单开始时间（人工确认类节点没有） -->
        <el-table-column label="工单开始时间" align="center" width="200">
          <template slot-scope="scope">
            <div v-if="!isHumanConfirmNode">
              {{ orderTimeFnc(scope.row) }}
            </div>
          </template>
        </el-table-column>

        <!-- 第八列 -->
        <el-table-column
          label="开始执行时间"
          prop="aaiStartTime"
          align="center"
          width="160"
        />

        <!-- 第九列 -->
        <el-table-column
          label="结束执行时间"
          prop="aaiEndTime"
          align="center"
          width="160"
        />

        <!-- 第十列 -->
        <el-table-column
          label="总函数"
          prop="totalFunctionCount"
          align="center"
          width="70"
        />

        <!-- 第十一列 -->
        <el-table-column
          label="失败函数"
          prop="failedFunctionCount"
          align="center"
          width="80"
        />

        <!-- 原子配置 -->
        <el-table-column label="原子配置" align="center" min-width="110">
          <template slot-scope="scope">
            <el-popover
              placement="top"
              width="600"
              trigger="hover"
              :open-delay="100"
              popper-class="add-json-popover"
            >
              <div class="add-json">
                <json-viewer
                  :value="toJsonValue(scope.row.aaiAtomConfig)"
                  :show-array-index="false"
                  :expand-depth="2"
                  copyable
                />
              </div>
              <el-button
                slot="reference"
                type="text"
                size="mini"
                icon="el-icon-view"
              >
                查看
              </el-button>
            </el-popover>
          </template>
        </el-table-column>

        <!--
          操作：⚠️ 这一列**绝对不能加 fixed="right"**。
          Element 2.15.14 的 table-body.js wrappedRowRender() 渲染展开行时只判 hasExpandColumn、
          不判 this.fixed，所以整个展开单元格（含内层「所属函数列表」）会被再渲染一份到
          .el-table__fixed-right —— 那是一层 position:absolute、不跟着横向滚动的副本，
          于是内层函数表里「跳过 / 执行」像被钉在右边，鼠标放上去滚只滚它们自己，
          看着就像「操作列被分成了两列」。
          内层函数表的「操作」列同理，也不能加 fixed。
        -->
        <el-table-column label="操作" align="center" width="170">
          <template slot-scope="scope">
            <!-- 人工确认类原子：由非项目角色的人来点「确认完成」 -->
            <el-button
              v-if="canConfirm(scope.row)"
              type="text"
              size="small"
              :disabled="isConfirmDisabled(scope.row)"
              :loading="isRowLoading(scope.row, 'confirm')"
              @click="confirmFnc(scope.row)"
            >
              确认完成
            </el-button>

            <!-- 其余原子：由项目角色的人来点「跳过」；已成功的不给跳过 -->
            <el-button
              v-if="canSkip(scope.row)"
              type="text"
              size="small"
              :disabled="isSkipDisabled(scope.row)"
              :loading="isRowLoading(scope.row, 'skip')"
              @click="atomSkipFnc(scope.row)"
            >
              跳过
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div slot="footer" class="add-foot">
      <button type="button" class="add-btn" @click="onClose">关闭</button>
    </div>
  </el-dialog>

    <!-- ==================== 最新结果 ==================== -->
    <el-dialog
      title="最新结果"
      :visible.sync="resultVisible"
      custom-class="add-result-dialog"
      width="70%"
      append-to-body
    >
      <div v-loading="tableLoading" class="result-content">
        <!-- 变化对比：预采集 vs 发布后的配置差异 -->
        <el-card
          v-if="aelAtomExecuteResult.pre_content && postContent"
          class="box-card w100"
        >
          <div class="el-tag-title">
            <el-tag size="medium" style="font-size: 16px">变化对比</el-tag>
          </div>
          <div class="diff-content">
            <!--
              ⚠️ CodeDiff（vue-code-diff@1.2.0）真正认的 prop 只有这几个：
                 oldString / newString / context / outputFormat / drawFileList /
                 renderNothingWhenEmpty / diffStyle / fileName / isShowNoChange
                 参考实现里写的 `trim` **不是**它的 prop（会被当成普通 DOM 属性挂在根节点上，
                 什么也不做）；想「没有差异也显示出来」要用 `isShowNoChange`。
            -->
            <code-diff
              :old-string="JSON.stringify(aelAtomExecuteResult.pre_content, null, 2)"
              :new-string="JSON.stringify(postContent, null, 2)"
              :context="100"
              output-format="side-by-side"
              :is-show-no-change="true"
            ></code-diff>
          </div>
        </el-card>

        <!-- 预采集-执行日志 -->
        <el-card
          v-if="aelMessage.pre && aelMessage.pre.length"
          class="box-card w100"
        >
          <div class="el-tag-title">
            <el-tag size="medium" style="font-size: 16px">预采集-执行日志</el-tag>
          </div>
          <div class="timeline-box">
            <el-timeline :reverse="true">
              <el-timeline-item
                v-for="(activity, index) in aelMessage.pre"
                :key="index"
                :timestamp="timeFormat(activity.timestamp)"
              >
                <div v-html="activity.content"></div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>
        <el-card v-else class="box-card w100 no-result">
          <el-tag size="medium" type="info" effect="plain">暂无日志</el-tag>
        </el-card>

        <!-- 执行日志 -->
        <el-card
          v-if="aelMessage.post && aelMessage.post.length"
          class="box-card w100"
        >
          <div class="el-tag-title">
            <el-tag size="medium" style="font-size: 16px">执行日志</el-tag>
          </div>
          <div class="timeline-box">
            <el-timeline :reverse="true">
              <el-timeline-item
                v-for="(activity, index) in aelMessage.post"
                :key="index"
                :timestamp="timeFormat(activity.timestamp)"
              >
                <div v-html="activity.content"></div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>
        <el-card v-else class="box-card w100 no-result">
          <el-tag size="medium" type="info" effect="plain">暂无日志</el-tag>
        </el-card>

        <!-- 执行结果：executeResultFlag === 'Y' 才有表格，否则整段 JSON 预览 -->
        <el-card class="box-card w100">
          <div class="el-tag-title">
            <el-tag size="medium" style="font-size: 16px">执行结果</el-tag>
          </div>
          <template v-if="postContent">
            <el-tabs
              v-if="postContent.executeResultFlag === 'Y'"
              v-model="activeName"
              @tab-click="handleClick"
            >
              <el-tab-pane
                v-for="(item, index) in tableList"
                :key="index"
                :label="item.cmd"
                :name="item.cmd"
              >
                <div slot="label">
                  <el-tooltip
                    class="item"
                    effect="dark"
                    :content="item.cmd"
                    placement="top"
                  >
                    <p class="text-ellipsis w200">{{ item.cmd }}</p>
                  </el-tooltip>
                </div>

                <div class="content-inner">
                  <!-- 一个 cmd 可能对应多条执行记录（不同机房），一条一张卡 -->
                  <el-card
                    v-for="(ite, idx) in item.data"
                    :key="idx"
                    class="result-item"
                  >
                    <el-tag size="medium" class="result-item__idc">{{ ite.idc }}</el-tag>
                    <!-- 列由接口下发的表头动态生成（表头里的 `.` 要去掉才能当 prop） -->
                    <el-table
                      :data="ite.getresult.row"
                      style="width: 100%"
                      height="250"
                      size="mini"
                    >
                      <el-table-column
                        v-for="(it, iidx) in ite.getresult.header"
                        :key="iidx"
                        :prop="colProp(it)"
                        :label="it"
                        show-overflow-tooltip
                        width="200"
                      ></el-table-column>
                    </el-table>
                  </el-card>
                </div>
              </el-tab-pane>
            </el-tabs>

            <div v-else class="inner inner-max">
              <json-viewer
                :value="postContent"
                :show-array-index="false"
                :expand-depth="100"
                copyable
              ></json-viewer>
            </div>
          </template>
          <div v-else class="no-result">
            <el-tag size="medium" type="info" effect="plain">暂无执行结果</el-tag>
          </div>
        </el-card>
      </div>

      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="resultVisible = false">关 闭</el-button>
      </span>
    </el-dialog>

    <!-- ==================== 日志 ==================== -->
    <el-dialog title="日志" :visible.sync="logVisible" width="50%" append-to-body>
      <div class="result-content">
        <el-card
          v-if="aelMessage.pre && aelMessage.pre.length"
          class="box-card w100"
        >
          <div class="el-tag-title">
            <el-tag size="medium" style="font-size: 16px">预采集-执行日志</el-tag>
          </div>
          <div class="timeline-box">
            <el-timeline :reverse="true">
              <el-timeline-item
                v-for="(activity, index) in aelMessage.pre"
                :key="index"
                :timestamp="timeFormat(activity.timestamp)"
              >
                <div v-html="activity.content"></div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>
        <el-card v-else class="box-card w100 no-result">
          <el-tag size="medium" type="info" effect="plain">暂无日志</el-tag>
        </el-card>

        <el-card
          v-if="aelMessage.post && aelMessage.post.length"
          class="box-card w100"
        >
          <div class="el-tag-title">
            <el-tag size="medium" type="info" style="font-size: 16px">发布后日志</el-tag>
          </div>
          <div class="timeline-box">
            <el-timeline :reverse="true">
              <el-timeline-item
                v-for="(activity, index) in aelMessage.post"
                :key="index"
                :timestamp="timeFormat(activity.timestamp)"
              >
                <div v-html="activity.content"></div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>
        <el-card v-else class="box-card w100 no-result">
          <el-tag size="medium" type="info" effect="plain">暂无日志</el-tag>
        </el-card>
      </div>

      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="logVisible = false">关 闭</el-button>
      </span>
    </el-dialog>

    <!-- ==================== 历史结果 ==================== -->
    <el-dialog
      title="历史结果"
      :visible.sync="historyVisible"
      width="50%"
      append-to-body
    >
      <div class="result-content">
        <el-card class="box-card w100">
          <div class="timeline-box">
            <el-timeline :reverse="true">
              <el-timeline-item
                v-for="(activity, index) in aelAtomExecuteHisResult.post"
                :key="index"
                :timestamp="timeFormat(activity.timestamp)"
              >
                <div class="inner">
                  <json-viewer
                    :value="activity.content"
                    :show-array-index="false"
                    :expand-depth="
                      index === aelAtomExecuteHisResult.post.length - 1 ? 1 : 0
                    "
                    copyable
                  ></json-viewer>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-card>
      </div>

      <span slot="footer" class="dialog-footer">
        <el-button type="primary" @click="historyVisible = false">关 闭</el-button>
      </span>
    </el-dialog>

    <!--
      ==================== 函数批量跳过 ====================
      右上角按钮点出来的子弹窗。自身完成调接口 + 确定按钮 loading，
      成功后 emit 'success'，由下面的 onBatchSkipSuccess 接手：关弹窗 + 通知父组件重新拉明细。
    -->
    <batch-skip-dialog
      :visible="batchSkipVisible"
      :atoms="atoms"
      @close="closeBatchSkip"
      @success="onBatchSkipSuccess"
    />

    <!--
      ==================== 一键跳过失败函数 ====================
      紧挨「函数批量跳过」右边的按钮点出来的子弹窗。
      自己完成「调接口 + 弹 loading + 成功后 emit refresh 拉新明细」整条链路，
      父组件只需要负责重新拉明细（弹窗不自己改 atoms）。

      表单字段只有一个 funcName（从 filedFncList 里选）；图里的弹窗宽 500px，
      用 Element 默认 footer（取消 + 确定）来配合 Dialog。
    -->
    <el-dialog
      title="一键跳过失败函数"
      :visible.sync="skipVisible"
      width="500px"
      :before-close="handleCloseSkip"
      append-to-body
    >
      <el-form
        ref="skipForm"
        :model="skipForm"
        :rules="skipRules"
        label-width="80px"
      >
        <el-form-item label="函数名" prop="funcName">
          <el-select
            v-model="skipForm.funcName"
            filterable
            clearable
            style="width: 100%"
            placeholder="请选择指定函数"
          >
            <el-option
              v-for="item in filedFncList"
              :key="item.funcName"
              :label="item.funcName"
              :value="item.funcName"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="skipVisible = false">取 消</el-button>
        <el-button
          :loading="skipLoading"
          type="primary"
          @click="submitSkip"
        >确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
/**
 * 查看明细 —— 节点下的原子列表
 *
 * 表格数据**全部来自 `/release/executeIndex/queryAotmOfNode` 的返回**（`data[]`），
 * 不从节点自带的 atoms[] 里取 —— 两处字段前缀都是 `aai*`（`aaiAtomName` / `aaiAtomStatus` /
 * `aaiAtomConfig`…），但只有接口返回带 `functions[]` 和两个函数计数，
 * 所以统一以接口为准，避免出现「表格一半是接口、一半是节点」的分裂。
 *
 * 列结构（自左向右）：
 *   1  展开图标（type=expand）—— 按原子类型分两种内容（分流见 isHumanConfirmRow）：
 *                        人工确认类： 「人工确认描述」tag + 节点 aniNodeDomurl；
 *                        其余类型：   「所属函数列表」内层表格（7 列，函数级五个操作按钮）
 *   2  原子名称          aaiAtomName
 *   3  机房              aaiAtomConfig.idc
 *   4  指令描述 / 工单    域名切换类节点显示 aaiAtomConfig.record_desc（tooltip 带 record_id），
 *                        其余节点直接显示 aaiOrderId
 *   5  状态              aaiAtomStatus，走字典 release_execute_status
 *   6  原子计划时间        aaiAtomPlanStarttime 至 aaiAtomPlanEndtime（人工确认类节点不显示）
 *   7  工单开始时间        aaiAtomConfig.beginTime（人工确认类节点不显示）
 *   8  开始执行时间        aaiStartTime
 *   9  结束执行时间        aaiEndTime
 *   10 总函数            totalFunctionCount
 *   11 失败函数          failedFunctionCount
 *   12 原子配置           aaiAtomConfig（JsonViewer 气泡）
 *   13 操作              确认完成 / 跳过
 */
import JsonViewer from "vue-json-viewer";
import "vue-json-viewer/style.css";
// 「最新结果」里的配置对比用它渲染 diff（vue-code-diff@1.2.0，UMD 插件形态）
import CodeDiff from "vue-code-diff";
import Vue from "vue";
// pickPayload：接口返回的载荷有可能在 data、也有可能在 rows，取值一律走它
import {
  getUniqueInfo,
  updateFunctionStatus,
  manualFunc,
  funcSkip,
  pickPayload,
} from "@/api/tool/execPageSimple";
import { DETAIL_STATUS_DICT_TYPE } from "../flowLayout";
// 判「是不是人工确认节点」的**唯一实现**在 ../nodeKind（index.vue 也要用同一个判定）。
// 这里起个别名，避免和同名 computed `isHumanConfirmNode` 撞上（撞了会自己调自己、无限递归）。
import { isHumanConfirmNode as isHumanNode } from "../nodeKind";
import BatchSkipDialog from "./BatchSkipDialog";

// vue-code-diff 导出的是**插件**（不是组件），只能 Vue.use 注册成全局 <code-diff>。
// Vue.use 对同一插件是幂等的（第二次调用是 no-op），所以写在组件文件里也不会重复注册。
Vue.use(CodeDiff, {});

/**
 * 「人工确认」的**原子名**关键字 —— 只用于判原子，**不要**拿它判节点类型。
 *
 * 本项目「人工确认」有**两个不同的关键字**，别合并：
 *   - 原子名（`aaiAtomName`）用中文 `人工确认` —— 决定操作列给不给「确认完成」按钮、
 *     展开行走哪个分支。用 `includes` 而不是严格相等：mock 里真实的人工确认原子叫
 *     「人工确认_变更审批」「人工确认_业务复核」，严格相等一个都匹配不上，
 *     按钮会永远不出现（和「没做这个功能」长得一样，没有任何报错）。
 *   - 节点类型（`aniInstanceNodeType`）用英文 `HUMAN_CONFIRM` —— 决定
 *     「原子计划时间 / 工单开始时间」两列显不显示、以及展开行是否默认展开。
 *     **判定函数在 `../nodeKind`**（`isHumanConfirmNode`），index.vue 的节点双击分流也用它。
 *     ⚠️ 节点类型是英文枚举（真实取值见 mock：`HUMAN_CONFIRM` / `DOMAIN_SWITCH` /
 *     `RELEASE_*` / `ITSM_*`），拿中文去 includes 会**永远为假**、毫无报错。
 */
const HUMAN_CONFIRM_KEY = "人工确认";

/**
 * 「确认完成」的二次确认文案（与需求给的文案逐字一致，改文案要同步改校验脚本）。
 * 讲清两件事：① 这是人工核对动作；② 点完会自动更新当前人工节点的状态。
 */
const CONFIRM_TIP =
  "请仔细阅读确认描述里的内容，确认操作都已处置完成。确认完成后将会自动更新当前人工节点的状态";

/**
 * 三个「结果类」弹窗在**没有数据**时各自的提示文案。
 * 三个按钮共用 uniqueInfo，靠 flag 区分；文案照参考实现的 msgObj。
 */
const NO_RESULT_TEXT = {
  result: "暂无最新结果",
  history: "暂无历史结果",
  log: "暂无日志",
};

/**
 * 函数级操作 -> 接口的 `operation` 取值。
 *
 * 「跳过」和「结果确认」共用同一个接口 `updateFunctionStatus`，
 * 唯一的区别就是这个字段（参考实现里两个 api 是同一个函数，
 * 上方注释写的就是「// 函数跳过 - 结果确认」）。
 * 「执行」走另一个接口 `manualFunc`，不在这张表里。
 */
const FN_OPERATION = {
  skip: "SKIP",
  confirm: "CONFIRM",
};

/** 函数级操作 -> 失败日志里的中文名，只用于 console.error 的可读性 */
const FN_ACTION_CN = {
  skip: "跳过函数",
  confirm: "结果确认",
  run: "手动执行",
};

/** 该原子是不是「人工确认」类 */
function isHumanConfirm(row) {
  return String((row && row.aaiAtomName) || "").includes(HUMAN_CONFIRM_KEY);
}

/** 状态字典没加载完时给个空数组，dict-tag 会回落成显示原始值 */
export default {
  name: "AtomDetailDialog",
  components: { JsonViewer, BatchSkipDialog },
  // 明细表的原子状态文案 + 配色走后台字典（带 list_class，dict-tag 直接渲染成 el-tag）
  dicts: [DETAIL_STATUS_DICT_TYPE],
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    // 当前查看的节点（用于标题，以及判断节点类型决定要不要显示「指令描述」列）
    node: {
      type: Object,
      default: null,
    },
    // 表格数据：queryAotmOfNode 返回的 data[]（一个节点下可能有多个原子）
    atoms: {
      type: Array,
      default: () => [],
    },
    // 接口是否还在飞
    loading: {
      type: Boolean,
      default: false,
    },
    // 接口失败时的错误文案（空串表示没失败）
    error: {
      type: String,
      default: "",
    },
    // 当前登录用户是否属于项目角色。**只影响「确认完成」**（非项目角色才给点）；
    // 「跳过」自 2026-09-17 起不再受它约束，见下方 canSkip 的说明。
    projectRoleDisabled: {
      type: Boolean,
      default: false,
    },
    /**
     * 原子级操作进行中：`null`，或 `{ aaiInstanceAtomId, action }`（action = 'confirm' | 'skip'）。
     * 用它精确驱动「**哪一行的哪个按钮**」转 loading，而不是整列一起转；
     * 同时父组件拿它挡住并发操作。请求包含「调接口 + 随后重新拉明细」整段。
     */
    submitting: {
      type: Object,
      default: null,
    },
    /**
     * 「自动刷新」是否开着（定时器在父组件里，见 index.vue 的 startDetailAutoRefresh）。
     *
     * 只驱动右上角按钮的文案（刷新 / 停止刷新）、active 配色，以及右侧「刷新中...」的显隐。
     * 弹窗**自己不存这个状态** —— 单点存在父组件，点按钮只 `$emit('toggle-auto-refresh')`。
     */
    autoRefreshing: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      // 展开行的 key（row-key = aaiInstanceAtomId）
      expandRowKeys: [],
      /**
       * 本次打开是否已经做过「默认展开」。
       *
       * 人工确认节点要求打开就展开（见 applyDefaultExpand），但明细是**异步**回来的，
       * 而且用户随时可以手动收起 —— 所以要有个「只做一次」的闸：
       * 做过之后就不再动 `expandRowKeys`，免得用户刚收起又被拉开。
       * 每次打开（watch.visible）与每次换节点（watch.node）都重置。
       */
      expandInited: false,
      /**
       * 所属节点的状态。两个按钮都拿它判断「节点被取消了就都不给点」。
       * 由父组件传入并在每次打开时刷新（见 watch.visible）。
       */
      atomStatus: undefined,
      /**
       * 点过「最新结果」/「执行」的函数行 key 列表，key = `原子id + 函数下标`。
       *
       * 用途是**让用户记得自己刚点的是哪一行**：弹窗盖在表格上，看完关掉回到表格，
       * 很容易忘了刚才点的是哪一条 —— 靠按钮上的红【新】和整行高亮认回来。
       *
       * ⚠️ 两处写入（`uniqueInfo('result', …)` 与 `submitFn('run', …)`）用的都是**赋值**
       *    而不是 push（照参考实现），所以同一时刻最多只有一个【新】，
       *    后一次操作会覆盖前一次。要改成「多行都留标记」就换成 push + 去重。
       */
      instanceList: [],
      // 表格高度跟随窗口，保证表头固定、内容区自己滚
      winH: typeof window === "undefined" ? 900 : window.innerHeight,

      /* ---------------- 最新结果 / 日志 / 历史结果（三个弹窗） ---------------- */

      // 三个弹窗的开关
      resultVisible: false,
      logVisible: false,
      historyVisible: false,
      /**
       * getUniqueInfo 返回的三个**字符串化 JSON**，解析后放这里给模板用。
       * 字段名沿用接口（ael 前缀），方便和接口文档对照。
       */
      aelMessage: { pre: [], post: [] },
      aelAtomExecuteResult: { pre: [], post: [], pre_content: null, post_content: null },
      aelAtomExecuteHisResult: { post: [] },
      // 「最新结果」里按 cmd 分组的表格数据 + 当前选中的 tab
      tableList: [],
      activeName: "",
      // 三个弹窗共用的加载态（查 getUniqueInfo 期间）
      tableLoading: false,
      // 函数级操作进行中：{ aaiInstanceAtomId, funcName, action }（action = 'skip' | 'run'）
      fnSubmitting: null,
      // 「函数批量跳过」弹窗的开合状态（自身开合，不依赖父组件）
      batchSkipVisible: false,

      /* ---------------- 一键跳过失败函数 ---------------- */

      /**
       * 右上角「一键跳过失败函数」按钮的 loading 态。
       *
       * 单独用 `jumpLoading` 而不是共用 `loading`（那是「明细在飞」的遮罩）：
       *   - 「点完跳过后接口还没返回」是按钮的事，不该让整张表也转圈；
       *   - 「明细还在飞」时按钮就 disabled 了，根本进不到「loading」分支。
       */
      jumpLoading: false,
      /**
       * 当前节点下「原子+函数**都** FAILED」的失败函数列表（去重后）。
       *
       * ⚠️ 命名沿用参考实现里的 `filedFncList`（不是 `failedFncList`）——
       *    看起来是 typo，但与下游代码（接口 par、模板循环）保持一致能少踩坑；
       *    改名要同步改接口 + 模板 + 校验脚本，三处以上才有意义，单点改名不划算。
       *
       * 来源：watch.atoms 时调用 buildFiledFncList 重建。
       * 「打开弹窗时也要 reset」：避免切换节点那一瞬间，下拉里残留上一个节点的失败函数名。
       */
      filedFncList: [],
      // 「一键跳过失败函数」子弹窗的开合状态
      skipVisible: false,
      // 弹窗表单（只有 funcName 一个字段；按用户图照搬）
      skipForm: { funcName: "" },
      // 弹窗表单校验：funcName 必选（必填 + 失焦/选完都过）
      skipRules: {
        funcName: [
          { required: true, message: "请选择指定函数", trigger: "change" },
        ],
      },
      // 子弹窗「确定」按钮的 loading
      skipLoading: false,
    };
  },
  computed: {
    nodeName() {
      return (this.node && this.node.aniInstanceNodeName) || "";
    },
    // 只有域名切换类节点才展示「指令描述」列，其余节点展示「工单」
    isDomainSwitch() {
      return !!(this.node && this.node.aniInstanceNodeType === "DOMAIN_SWITCH");
    },
    /**
     * 人工确认类节点：原子计划时间 / 工单开始时间两列不展示，且展开行**默认展开**。
     * 判的是**节点类型**（英文枚举 HUMAN_CONFIRM），与「确认完成」按钮判原子名是两件事 ——
     * 判定实现共用 `../nodeKind` 的 `isHumanConfirmNode`（index.vue 的节点双击分流也用它）。
     */
    isHumanConfirmNode() {
      return isHumanNode(this.node);
    },
    /**
     * 人工确认描述（展开行里显示的那段文字）。
     *
     * 取自**节点**的 `aniNodeDomurl` —— 参考实现里是 `this.self_desc = ite.aniNodeDomurl`，
     * 那个 `ite` 是节点循环变量，所以它来自节点、不是原子；整个弹窗里是同一个值。
     *
     * mock 现状：210 个节点里只有 **1 个**带 `aniNodeDomurl`，恰好就是人工确认节点
     * （「人工确认_变更审批」，值是个 ITSM 变更单链接），所以展开它是能看到描述的；
     * 其余节点回落成 '—'（与其它列一致），不编假数据。
     */
    selfDesc() {
      return (this.node && this.node.aniNodeDomurl) || "—";
    },
    statusOptions() {
      const list =
        this.dict && this.dict.type
          ? this.dict.type[DETAIL_STATUS_DICT_TYPE]
          : null;
      return list || [];
    },
    /**
     * 「最新结果」里发布后的那段内容（执行结果 + 配置对比都从这里取）。
     * 单独抽出来是因为模板里要判它有没有、以及 executeResultFlag 是不是 'Y'，
     * 写成 computed 比在模板里一路 `aelAtomExecuteResult.post_content && …` 好读。
     */
    postContent() {
      return (this.aelAtomExecuteResult && this.aelAtomExecuteResult.post_content) || null;
    },
    tableHeight() {
      // 弹窗 top=5vh + 头部 + 底部按钮 + 表格自身内边距，留 250px 比较稳
      return Math.max(320, this.winH - 250);
    },
  },
  watch: {
    visible(val) {
      if (!val) {
        return;
      }
      // 每次打开都重置：展开行、节点状态、函数行的【新】标记 + 顺手关掉子弹窗
      this.expandRowKeys = [];
      this.expandInited = false;
      this.instanceList = [];
      this.atomStatus = (this.node && this.node.aniStatus) || undefined;
      // 关掉子弹窗：明细弹窗被关时，子弹窗也得跟着关，否则下次打开会带着上一次的残留
      // （且 el-dialog 默认不销毁内容，表单值还在）
      this.batchSkipVisible = false;
      // 同理：「一键跳过失败函数」弹窗也要跟着关 + 表单清空
      this.skipVisible = false;
      this.skipForm = { funcName: "" };
      if (this.$refs.skipForm) {
        this.$refs.skipForm.clearValidate();
      }
      // 失败函数列表清空，避免切换节点那一瞬间下拉还残留上一个节点的内容
      this.filedFncList = [];
      this.$nextTick(() => {
        if (this.$refs.table) {
          this.$refs.table.clearSelection();
        }
      });
    },
    // 弹窗没关、直接点了另一个节点的「查看明细」：换节点也要重新做一次默认展开
    node() {
      this.expandInited = false;
      this.applyDefaultExpand();
    },
    /**
     * 明细是**异步**回来的（弹窗先开、表格后填），所以默认展开必须挂在这里 ——
     * 只挂在 watch.visible 上的话，那会儿 atoms 还是空的，展开会落空。
     */
    atoms() {
      this.applyDefaultExpand();
      // 重拉明细（自动刷新 / 操作后刷新）之后，让表格保持原来的展开状态
      this.reapplyExpand();
      // 「一键跳过失败函数」下拉的失败函数列表也跟着明细走：
      // 明细回来 / 变化（点完确认/跳过后重拉）都重算一次。
      this.filedFncList = this.buildFiledFncList(this.atoms);
    },
  },
  mounted() {
    window.addEventListener("resize", this.onResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
  },
  methods: {
    onResize() {
      this.winH = window.innerHeight;
    },

    /* ------------------------------ 单元格取值 ------------------------------ */

    /**
     * 机房：藏在原子配置 JSON 里（obj.idc）。
     *
     * 真实接口的 aaiAtomConfig 带 idc；mock 的原始数据里没有，
     * 由演示层（api/tool/_demoAtom.js）按稳定哈希补上，所以现在这一列是有值的。
     *
     * 兜底必须留着：空串 / 坏 JSON / 配置里没有 idc 都回落成 '—'。
     * （参考实现是裸 JSON.parse，坏 JSON 会直接崩掉整个表格。）
     */
    regionFnc(row) {
      const obj = this.readJson(row && row.aaiAtomConfig);
      return (obj && obj.idc) || "—";
    },

    /** 计划时间：'开始 至 结束' */
    planTimeFnc(row) {
      const start = (row && row.aaiAtomPlanStarttime) || "";
      const end = (row && row.aaiAtomPlanEndtime) || "";
      if (!start && !end) {
        return "—";
      }
      return `${start || "—"} 至 ${end || "—"}`;
    },

    /**
     * 工单开始时间：藏在原子配置 JSON 里（obj.beginTime）。
     * 兜底同 regionFnc —— 空串 / 坏 JSON / 没这个字段都回落成 '—'。
     */
    orderTimeFnc(row) {
      const obj = this.readJson(row && row.aaiAtomConfig);
      return (obj && obj.beginTime) || "—";
    },

    /**
     * 指令描述：藏在原子配置 JSON 里（obj.record_desc）。
     * 只有域名切换类节点的配置带这个字段，其余节点返回空串（列本身也不显示）。
     */
    labelFnc(row) {
      const obj = this.readJson(row && row.aaiAtomConfig);
      if (obj && obj.record_desc !== null && obj.record_desc !== undefined) {
        return String(obj.record_desc);
      }
      return "";
    },

    /** 指令单号：藏在原子配置 JSON 里（obj.record_id），配合 labelFnc 一起进 tooltip */
    recordIdFnc(row) {
      const obj = this.readJson(row && row.aaiAtomConfig);
      if (obj && obj.record_id !== null && obj.record_id !== undefined) {
        return String(obj.record_id);
      }
      return "";
    },

    /**
     * 把字符串化的 JSON 转成 JsonViewer 能展示的对象 / 数组。
     * 与 capacity 页的 toJsonValue 保持一致：解析失败返回 {}，不让坏数据把弹窗搞崩。
     */
    toJsonValue(value) {
      if (value !== null && value !== undefined && typeof value === "object") {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch (e) {
        return {};
      }
    },

    /** 安全解析 JSON 字符串，失败返回 null */
    readJson(raw) {
      if (raw === null || raw === undefined || raw === "") {
        return null;
      }
      if (typeof raw !== "string") {
        return raw;
      }
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    /* ------------------------------ 展开行 ------------------------------ */

    /**
     * 展开行的**默认展开**规则（用户要求）：
     *   人工确认节点 -> 打开就展开；其余节点 -> 默认收起。
     *
     * 为什么不做成 computed：用户能手动收起，展开状态是**数据**不是派生值。
     * 为什么挂在 watch.atoms 上：明细是异步回来的，弹窗刚开时 atoms 还是空数组，
     * 那时候展开会落空（key 一个都对不上）。
     *
     * `expandInited` 保证**只做一次**：用户收起之后，后续的重新拉明细
     * （比如点完「确认完成」）不会再把它拉开。
     */
    applyDefaultExpand() {
      if (this.expandInited) {
        return;
      }
      if (!this.isHumanConfirmNode) {
        // 非人工节点：什么都不做，但要标记「已初始化」，免得数据每变一次就重算一遍
        this.expandInited = true;
        return;
      }
      const atoms = Array.isArray(this.atoms) ? this.atoms : [];
      const keys = atoms
        .map((a) => a && a.aaiInstanceAtomId)
        .filter((id) => id !== undefined && id !== null);
      if (!keys.length) {
        // 数据还没回来，等下一次 watch.atoms
        return;
      }
      this.expandRowKeys = keys;
      this.expandInited = true;
    },

    onExpandChange(row, expandedRows) {
      this.expandRowKeys = (expandedRows || []).map(
        (item) => item.aaiInstanceAtomId
      );
    },

    /**
     * 表格行双击 —— 目前**只有「工单」列**的双击有意义。
     *
     * 双击工单 = 「查这个工单关联的自动发布文档」：这里只把工单号抛给父组件
     * （弹窗是哑组件，**不自己调接口**，接口与文档区都归父组件管），
     * 父组件拿到后去请求、再决定要不要关掉本弹窗、要不要展出右栏文档区。
     *
     * ⚠️ 判列用 `column.property`，**不要**写 `column.label === '工单'` —— 文案一改就静默失效。
     * ⚠️ `aaiOrderId` 这一个 prop 被**两列**共用：
     *      域名切换类节点 -> 该列 label 是「指令描述」
     *      其余节点       -> 该列 label 是「工单」
     *    只有后者才该触发，所以先排除 isDomainSwitch。
     * ⚠️ 展开列（type="expand"）的 column.property 是 undefined，天然被下面挡掉。
     */
    onRowDblclick(row, column) {
      if (this.isDomainSwitch) {
        return;
      }
      if (!column || column.property !== "aaiOrderId") {
        return;
      }
      const orderId = row && row.aaiOrderId;
      if (!orderId) {
        return;
      }
      this.$emit("order-dblclick", { orderId, row });
    },

    /**
     * 明细重拉之后，让表格**保持刷新前的展开状态**（用户要求：展开的 expend 刷新后仍然展开）。
     *
     * 为什么要显式做一遍：`expand-row-keys` 在 Element 里是**非 deep 的 prop watcher**，
     * 数组引用不变就不会触发；数据整体换掉之后能不能保持展开，取决于
     * `updateExpandRows` 按 rowKey 重新映射这个实现细节 —— 那是**实现细节、不是契约**，
     * 换个版本（或 rowKey 取不到）就可能塌掉。这里给一个新数组引用，
     * 强制 Element 重新执行 `setExpandRowKeys`（用**新数据**重建展开行），
     * 把「刷新前后展开状态一致」变成确定的。
     *
     * 没有展开行时直接返回：别把 `[]` 也重新赋值一遍，白触发一次 setExpandRowKeys。
     */
    reapplyExpand() {
      if (!this.expandRowKeys.length) {
        return;
      }
      this.expandRowKeys = this.expandRowKeys.slice();
    },

    /* ------------------------- 展开行：函数明细表格 ------------------------- */

    /**
     * 这一行函数是不是「刚点过最新结果」的那一行 —— 决定按钮上的【新】与整行高亮。
     *
     * key 用 `原子id + 函数下标`：一个弹窗里可能展开多个原子，
     * 只用函数下标会串台（第 1 个原子的第 2 个函数 ≠ 第 2 个原子的第 2 个函数）。
     */
    isNewResult(atomRow, index) {
      if (!atomRow) {
        return false;
      }
      return this.instanceList.includes(
        String(atomRow.aaiInstanceAtomId) + String(index)
      );
    },

    /**
     * 内层函数表格的行 class（给「刚点过最新结果」那一行加高亮底色）。
     *
     * Element 的 `row-class-name` 回调只给 `{ row, rowIndex }`，**拿不到外层的原子**，
     * 所以这里写成「传原子、返回函数」的形式，把原子闭包进去。
     * （参考实现里还有个 `row-style`，功能与这里重复，统一走 class 更好维护。）
     */
    fnRowClassName(atomRow) {
      return ({ rowIndex }) =>
        this.isNewResult(atomRow, rowIndex) ? "is-new-result" : "";
    },

    /**
     * 函数的重试次数：从**原子**的 `aaiRetryTimes` 里按函数名取。
     * 那是字符串化 JSON（`{ [funcName]: n }`），解析失败 / 没有该函数都回落 '—'。
     */
    retryTimes(outerRow, row) {
      const obj = this.readJson(outerRow && outerRow.aaiRetryTimes);
      const n = obj && obj[row && row.funcName];
      return n === undefined || n === null ? "—" : n;
    },

    /**
     * 函数计划执行时间：从**原子**的 `aaiAtomFuncStatus` 里按函数名取 `.next`。
     *
     * 参考实现用的是 `JSON.parse(JSON.stringify(outerRow.aaiAtomFuncStatus))`，
     * 意图是「深拷贝一份再读，别动原对象」—— 这个意图没问题，`readJson` 同样满足：
     * 字符串输入走 `JSON.parse` 得到**新对象**，对象输入只读不写、不碰原引用。
     *
     * 只是那一行在**字符串**输入下达不到深拷贝的效果：`JSON.stringify('{"a":1}')`
     * 是给字符串加一层引号（并不会把字符串变成对象），再 `JSON.parse` 又还原成字符串，
     * 于是 `typeof obj === 'object'` 为 false、`obj[funcName]` 取不到值 —— 这一列会是空的。
     * 本项目数据里 `aaiAtomFuncStatus` **239 条全是字符串**（实测），所以这里直接用
     * `readJson` 解析一次；两种形态都能吃，坏 JSON 也不会把表格搞崩。
     */
    planExecuteTime(outerRow, row) {
      const obj = this.readJson(outerRow && outerRow.aaiAtomFuncStatus);
      const hit = obj && obj[row && row.funcName];
      return (hit && hit.next) || "";
    },

    /**
     * 函数级操作按钮的可见性 / 置灰规则。
     * 与原子级那四个方法同一套路：规则集中在这里，模板只做渲染。
     */
    canSkipFn(row) {
      const status = row && row.status;
      return (
        status !== "SUCCESS" && status !== "SKIP" && !this.projectRoleDisabled
      );
    },

    isFnSkipDisabled(outerRow, row) {
      return (
        this.atomStatus === "CANCELLED" ||
        (outerRow && outerRow.aaiAtomStatus === "SKIP") ||
        (row && row.status === "SKIP")
      );
    },

    canResultConfirm(row) {
      return (
        !!row &&
        (row.confirm === "Y" || row.status === "CONFIRM") &&
        !this.projectRoleDisabled
      );
    },

    /**
     * 函数级「执行」按钮的置灰条件：`manual === 'N'` 时不给点（该函数不允许手动执行）。
     * `manual` 由接口下发（mock 里 `_demoAtom.js` 固定给 'N'）。
     */
    execDisableFnc(row) {
      return !!row && row.manual === "N";
    },

    /** 这一行的这个函数操作是否正在提交中 —— 驱动按钮 loading（与原子级的 isRowLoading 同构） */
    isFnLoading(outerRow, row, action) {
      const s = this.fnSubmitting;
      if (!s || !row || !outerRow) {
        return false;
      }
      return (
        String(s.aaiInstanceAtomId) === String(outerRow.aaiInstanceAtomId) &&
        String(s.funcName) === String(row.funcName) &&
        s.action === action
      );
    },

    /* ------------------- 展开行：最新结果 / 历史结果 / 日志 ------------------- */

    /**
     * 「最新结果」「日志历史结果」「日志」三个按钮共用这一个方法，靠 flag 区分。
     *
     * 链路：查 getUniqueInfo -> 解析三个字符串化 JSON -> 按 flag 打开对应弹窗。
     * 接口没给数据时按 flag 提示「暂无最新结果 / 暂无历史结果 / 暂无日志」
     * （参考实现在载荷为空时只关 loading、不提示，用户会以为点了没反应，这里补上）。
     * 载荷取 `pickPayload(res)` —— 有可能在 data、也可能在 rows，别写死 res.data。
     *
     * ⚠️ 入参键名是 `ael*`（`aelInstanceAtomId` / `aelFunctionName`），
     *    与返回字段同前缀；**值**才取自原子的 `aaiInstanceAtomId`。别顺手改成 aai。
     *
     * ⚠️ `scope` 只有 `flag === 'result'` 时才用得上 —— 用来记「刚看的是哪一行」，
     *    给那一行打上【新】标记（见下）。
     */
    uniqueInfo(flag, row, outerRow, scope) {
      const par = {
        aelInstanceAtomId: outerRow.aaiInstanceAtomId,
        aelFunctionName: row.funcName,
      };
      this.tableLoading = true;
      // 返回 Promise 方便调用方/校验脚本 await（模板里的 @click 不用返回值）
      return getUniqueInfo(par)
        .then((res) => {
          this.tableLoading = false;
          // 载荷可能在 data、也可能在 rows（见 api/tool/execPlan.js 的 pickPayload）
          const payload = pickPayload(res);
          if (!payload) {
            this.$message.error(NO_RESULT_TEXT[flag] || "暂无数据");
            return;
          }
          // 三个字段都是字符串化 JSON，解析失败也要给个**结构完整**的兜底，
          // 否则模板里的 aelMessage.pre / aelAtomExecuteHisResult.post 会是 undefined 直接报错
          this.aelMessage = this.readJson(payload.aelMessage) || { pre: [], post: [] };
          this.aelAtomExecuteResult = this.readJson(payload.aelAtomExecuteResult) || {
            pre: [],
            post: [],
            pre_content: null,
            post_content: null,
          };
          this.aelAtomExecuteHisResult = this.readJson(payload.aelAtomExecuteHisResult) || {
            post: [],
          };

          // 执行结果的原始数据在 post_content.getresult（**不是 executeResult**），
          // 且只有 executeResultFlag === 'Y' 才有表格可看，否则回落成整段 JSON 预览。
          const post = this.postContent;
          if (post && post.executeResultFlag === "Y") {
            this.tableList = this.aggregateByCmd(post.getresult);
            this.activeName = this.tableList.length ? this.tableList[0].cmd : "";
          } else {
            this.tableList = [];
            this.activeName = "";
          }

          if (flag === "result") {
            /**
             * 【新】标记：**点过「最新结果」的那一行**打红【新】+ 整行高亮。
             *
             * 用途（用户提的交互）：弹窗是盖在表格上的，用户看完最新结果、关掉弹窗回到表格，
             * 很容易忘了刚看的是哪一条 —— 靠这个标记认回来。
             *
             * 写在**拿到数据之后**而不是点击那一刻：请求失败时不该留下「看过了」的假标记。
             * key 与「执行」共用一套（`原子id + 函数下标`），所以两者是**互相覆盖**关系
             * （`instanceList` 是赋值不是 push），同一时刻最多只有一行带【新】。
             */
            this.instanceList = [
              String(outerRow.aaiInstanceAtomId) + String(scope && scope.$index),
            ];
            this.resultVisible = true;
          } else if (flag === "log") {
            this.logVisible = true;
          } else if (flag === "history") {
            this.historyVisible = true;
          } else {
            this.$message.error(NO_RESULT_TEXT[flag] || "暂无数据");
          }
        })
        .catch((e) => {
          this.tableLoading = false;
          console.error("[执行日志] 请求失败", e);
          this.$message.error((e && e.message) || "查询执行日志失败");
        });
    },

    /**
     * 把执行结果按 `cmd` 分组，供「执行结果」那块一个 cmd 一个 tab。
     *
     * 输入：`post_content.getresult` —— 数组，每项
     *   `{ cmd, getresult: { rowList, total }, idc, ret_execute, sqlCmd, uuid }`
     * 其中 `rowList` 是**二维数组**：**第 0 行是表头**，其余是数据行（值数组，按列下标对齐表头）。
     *
     * 输出：`[{ cmd, data: [{ getresult: { header, row, rowList, total }, idc, ret_execute, sqlCmd, uuid }] }]`
     *   - `header` 表头数组（`\n` 去掉）—— 模板据此**动态生成列**，`:label="it"`
     *   - `row`    数据行对象数组，模板 `:data="ite.getresult.row"`
     *
     * 参考实现里 `if (total === 0) … else if (total === 1) …` 两个分支都赋 `row = []`
     * （写重了，等价于没有分支），这里直接按 else 分支的语义实现。
     * 表头 / 行长度不一致时按列下标取值、缺列给空串，不让坏数据把表格搞崩。
     *
     * ⚠️ 行对象的键用 `colProp(表头)`（去掉 `.`）而不是原表头：
     *    参考实现里表头去 `\n`、列 prop 去 `.`，两处规则不一致 ——
     *    `MODULE.NAME` 的列 prop 是 `MODULENAME`，而行对象的键还是 `MODULE.NAME`，
     *    结果**整列取不到值、永远是空的**。这里统一走 `colProp`，两边对齐。
     */
    aggregateByCmd(arr) {
      const list = Array.isArray(arr) ? arr : [];
      const map = new Map();
      list.forEach((item) => {
        if (!item) {
          return;
        }
        const cmd = item.cmd || "未命名";
        if (!map.has(cmd)) {
          map.set(cmd, { cmd, data: [] });
        }
        const group = map.get(cmd);
        const raw = item.getresult || {};
        const rowList = Array.isArray(raw.rowList) ? raw.rowList : [];
        const header = (rowList.length > 0 ? rowList[0] : []) || [];
        const head = (Array.isArray(header) ? header : []).map((h) =>
          String(h).replace(/\n/g, "")
        );
        const row = rowList.slice(1).map((rowData) => {
          const obj = {};
          head.forEach((label, index) => {
            const value = rowData ? rowData[index] : "";
            obj[this.colProp(label)] =
              value === undefined || value === null ? "" : value;
          });
          return obj;
        });
        group.data.push({
          getresult: {
            header: head,
            row,
            rowList,
            total: raw.total === undefined || raw.total === null ? row.length : raw.total,
          },
          idc: item.idc,
          ret_execute: item.ret_execute,
          sqlCmd: item.sqlCmd,
          uuid: item.uuid,
        });
        map.set(cmd, group);
      });
      return Array.from(map.values());
    },

    /**
     * 「执行结果」表格的列 prop：表头可能带 `.`（如 `MODULE.NAME`），
     * 去掉后才能当 `prop` 用（`.` 在 prop 路径里是「下一级」的意思，会被当成嵌套对象）。
     * `aggregateByCmd` 造行对象时用的是同一个方法，两边必须一致，否则整列空。
     */
    colProp(label) {
      return String(label).replace(/\./g, "");
    },

    /** 点 tab 只切 activeName，不做别的（Element 的 tab-click 参数这里用不上） */
    handleClick() {},

    /**
     * 时间戳（毫秒）-> 'YYYY-MM-DD HH:mm:ss'。
     * 已经是字符串 / 转不出合法时间时原样返回，不抛错（真实数据里时间格式不一定统一）。
     */
    timeFormat(ts) {
      if (ts === null || ts === undefined || ts === "") {
        return "";
      }
      const d = new Date(Number(ts));
      if (Number.isNaN(d.getTime())) {
        return String(ts);
      }
      const p = (n) => String(n).padStart(2, "0");
      return (
        `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
      );
    },

    /* ------------------- 展开行：函数级操作 ------------------- */

    /**
     * 函数跳过 -> POST /release/executeIndex/updateFunctionStatus
     * 入参 { aaiInstanceAtomId, operation: 'SKIP', functionName, functionType }
     */
    fncSkipFnc(row, outerRow) {
      this.$confirm(`确定跳过函数名称为${row.funcName}的函数吗？`, "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(() => this.submitFn("skip", row, outerRow))
        .catch(() => {
          // 点了取消 / 关闭：什么都不做
        });
    },

    /**
     * 函数结果确认 -> **与「跳过」同一个接口**，靠 `operation` 区分。
     *
     * 参考实现里这两个方法共用同一个 api 函数（api 上方的注释就是
     * 「// 函数跳过 - 结果确认」）：`POST /release/executeIndex/updateFunctionStatus`，
     * 入参同形，只有 `operation` 不同（跳过 SKIP / 结果确认 CONFIRM）。
     *
     * 与「执行」不同，参考实现里这里**不打【新】标记**，成功后就重新拉一次明细。
     */
    resultConfirm(row, outerRow) {
      this.$confirm(`确定对函数名称为${row.funcName}的函数结果确认`, "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(() => this.submitFn("confirm", row, outerRow))
        .catch(() => {
          // 点了取消 / 关闭：什么都不做
        });
    },

    /**
     * 函数手动执行 -> POST /python/api/func/manual
     * 入参 { funcName, atomId }（这个接口不带 aai* 前缀，别顺手改）
     *
     * 成功后把这一行标记成【新】，让用户知道刚执行的是哪一行。
     */
    manualFunc(row, outerRow, scope) {
      this.$confirm(`确定对函数名称为${row.funcName}的函数手动执行`, "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(() => this.submitFn("run", row, outerRow, scope))
        .catch(() => {
          // 点了取消 / 关闭：什么都不做
        });
    },

    /**
     * 函数级操作（跳过 / 结果确认 / 执行）的公共流程。
     *
     * 与原子级的 submitAtom 同构：调接口 -> 成功提示 -> **让父组件重新拉一次明细**
     * （明细数据在父组件手里，弹窗不本地改 atoms）。
     * loading 精确到「哪一行的哪个函数」（fnSubmitting + isFnLoading）。
     */
    async submitFn(action, row, outerRow, scope) {
      if (this.fnSubmitting) {
        return;
      }
      const funcName = row && row.funcName;
      const atomId = outerRow && outerRow.aaiInstanceAtomId;
      this.fnSubmitting = { aaiInstanceAtomId: atomId, funcName, action };
      try {
        let msg = "操作成功";
        if (action === "run") {
          const res = await manualFunc({ funcName, atomId });
          // 手动执行的提示文案用接口返回的 msg（参考实现就是 res.msg）
          msg = (res && res.msg) || "操作成功";
          // 【新】标记：**赋值**而不是 push —— 只标记刚执行的那一行
          this.instanceList = [String(atomId) + String(scope && scope.$index)];
        } else {
          // 跳过 / 结果确认共用 updateFunctionStatus，只有 operation 不同
          await updateFunctionStatus({
            aaiInstanceAtomId: atomId,
            operation: FN_OPERATION[action],
            functionName: funcName,
            functionType: row && row.funcType,
          });
        }
        this.$message.success(msg);
        // 让父组件重新拉一次明细（函数状态是接口返回的，不在本地改）
        this.$emit("refresh");
      } catch (e) {
        console.error(`[${FN_ACTION_CN[action] || "函数操作"}] 请求失败`, e);
        this.$message.error((e && e.message) || "操作失败");
      } finally {
        this.fnSubmitting = null;
      }
    },

    /* ------------------------------ 操作列 ------------------------------ */

    /**
     * 「谁能在哪一行点什么」这套规则集中在这四个方法里，模板只做渲染。
     * 拆出来是因为它是一条**业务规则**（项目角色 vs 非项目角色能做的事不一样），
     * 散在模板里既测不了、也没法一眼看全。
     *
     * 规则（2026-09-17 按用户要求调整）：
     *   确认完成 —— 只有「人工确认」原子，且当前用户**不是**项目角色；
     *   跳过     —— **任何原子都可以，包括「人工确认」类**；已 SUCCESS 的不显示；
     *   两者都额外受「节点已取消」约束（节点 CANCELLED 了就不给动）；
     *   已 SKIP 的原子跳过按钮置灰。
     *
     * ⚠️ 本次把「跳过」的**项目角色条件去掉了**，原因值得记一笔：
     *    `PROJECT_ROLE_KEYS` 目前是空数组（角色标识待与后端对齐），
     *    于是 `isProjectRoleDisable` 恒为 false；而它原本是跳过的**必要条件** ——
     *    结果「空数组 = 不限制角色」被读成了「谁都不能跳过」，
     *    **任何原子都点不出跳过按钮**，且没有任何报错。
     *    现在改为不判角色，人工确认原子也能跳过（用户要求两个按钮并存）。
     *    将来若要按角色恢复限制，只改这一个方法。
     */
    /**
     * 这一行是不是「人工确认」类原子 —— 模板里用（展开行按它分流）。
     * 判定逻辑与 canConfirm 共用同一个 `isHumanConfirm`，避免两处写法不一致。
     */
    isHumanConfirmRow(row) {
      return isHumanConfirm(row);
    },

    canConfirm(row) {
      return isHumanConfirm(row) && !this.projectRoleDisabled;
    },

    canSkip(row) {
      return row.aaiAtomStatus !== "SUCCESS";
    },

    /**
     * 「确认完成」什么时候置灰。照参考实现，是**三条**条件（之前只判了第一条）：
     *   ① 节点已取消 CANCELLED
     *   ② 该原子已成功 SUCCESS
     *   ③ 节点处于 INIT（还没开始）
     *
     * 参考实现里 ① 判的是 `atomStatus`、③ 判的是 `ite.aniStatus`（节点状态）——
     * 在本弹窗里两者同源：`atomStatus` 就是打开弹窗时从节点取的 `aniStatus` 快照
     * （见 watch.visible），所以这里用同一个值判即可。
     *
     * ⚠️ 条件 ③ 是这轮补上的：补之前节点 INIT 也能点「确认完成」。
     */
    isConfirmDisabled(row) {
      const nodeStatus = this.atomStatus;
      return (
        nodeStatus === "CANCELLED" ||
        (row && row.aaiAtomStatus === "SUCCESS") ||
        nodeStatus === "INIT"
      );
    },

    isSkipDisabled(row) {
      return this.atomStatus === "CANCELLED" || row.aaiAtomStatus === "SKIP";
    },

    /**
     * 这一行的这个操作是否正在提交中 —— 驱动按钮 loading。
     * 只让被点的那一行的那一个按钮转圈，而不是整列一起转。
     */
    isRowLoading(row, action) {
      const s = this.submitting;
      if (!s || !row) {
        return false;
      }
      return (
        String(s.aaiInstanceAtomId) === String(row.aaiInstanceAtomId) &&
        s.action === action
      );
    },

    /**
     * 确认完成（人工确认类原子）
     *
     * 只负责「二次确认 + 把入参抛给父组件」：真正的请求（PUT /release/atomInstance）
     * 和随后的重新拉明细都在父组件里做 —— 明细数据由父组件持有，
     * 弹窗不自己改数据，免得出现「表格一半来自接口、一半来自本地」的分裂。
     * 请求期间按钮转 loading，状态由父组件通过 confirmLoading 传回来。
     */
    confirmFnc(row) {
      this.$confirm(CONFIRM_TIP, "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(() => {
          this.$emit("confirm", {
            row,
            // 入参照接口要求：原子 id + 目标状态（确认完成固定 SUCCESS）
            par: {
              aaiInstanceAtomId: row.aaiInstanceAtomId,
              aaiAtomStatus: "SUCCESS",
            },
          });
        })
        .catch(() => {
          // 点了取消 / 关闭：什么都不做，也不弹提示
        });
    },

    /**
     * 跳过（2026-09-17 起人工确认类原子也可以跳过）
     *
     * 与 confirmFnc 同构：只做二次确认 + 把入参抛给父组件，
     * 真正的请求（POST /release/executeIndex/updateAtomStatus）和随后的重新拉明细
     * 都在父组件里做 —— 明细数据由父组件持有，弹窗不自己改数据。
     * 请求期间按钮转 loading，状态由父组件通过 submitting 传回来。
     */
    atomSkipFnc(row) {
      this.$confirm(`确定跳过原子名称为${row.aaiAtomName}的原子吗？`, "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(() => {
          this.$emit("skip", {
            row,
            // 入参照接口要求：原子 id + 操作类型（跳过固定 SKIP）
            par: {
              aaiInstanceAtomId: row.aaiInstanceAtomId,
              operation: "SKIP",
            },
          });
        })
        .catch(() => {
          // 点了取消 / 关闭：什么都不做，也不弹提示
        });
    },

    onClose() {
      this.$emit("close");
    },

    /* ------------------------------ 头部：自动刷新 ------------------------------ */

    /**
     * 点「刷新 / 停止刷新」—— 只把「切一下开关」抛给父组件。
     *
     * 定时器、`autoRefreshing` 都在父组件里（它才是明细数据和 loading 的持有者，
     * 也是唯一知道「这一拍请求回来了没有」的地方）；弹窗这边**不存状态**，
     * 否则会出现「弹窗以为在刷、父组件其实停了」这种两边对不上的情况。
     * 关弹窗停定时器同理，在父组件的 closeDetail 里做（唯一关闭点）。
     */
    toggleAutoRefresh() {
      this.$emit("toggle-auto-refresh");
    },

    /* ------------------------------ 函数批量跳过 ------------------------------ */

    /**
     * 打开「函数批量跳过」弹窗。
     *
     * 只在有原子时才允许打开（按钮的 `v-if` 已经拦过，这里再判一次防御）。
     * 不传 nodeId / planId —— 接口入参只用 atomIdList，节点上下文不参与。
     */
    openBatchSkip() {
      if (!this.atoms || !this.atoms.length) {
        return;
      }
      if (this.loading) {
        // 明细还在飞时不让点：弹窗里选完原子，列表突然换了一份会更难理解
        return;
      }
      this.batchSkipVisible = true;
    },

    /**
     * 关闭「函数批量跳过」弹窗（取消按钮 / × / ESC）。
     * BatchSkipDialog 的提交中守卫拦了 onClose，所以这里不用再判 loading。
     */
    closeBatchSkip() {
      this.batchSkipVisible = false;
    },

    /**
     * 批量跳过成功后由 BatchSkipDialog 触发：
     *   1. 关掉子弹窗
     *   2. 通知父组件**带 loading** 重新拉一次明细（用户要求：批量跳过后查明细弹窗数据的时候弹窗也要loading）
     *
     * 走 `refresh-with-loading` 而不是现有的 `refresh`：
     *   - `refresh` → 父组件的 reloadDetailAtoms（不切 loading，刻意避免闪遮罩）
     *   - `refresh-with-loading` → 父组件新的 reloadDetailAtoms({ withLoading: true })，会切 loading
     * 这样原子级确认/跳过仍是「无感刷新」，不会因为这个改动而闪遮罩。
     */
    onBatchSkipSuccess() {
      this.batchSkipVisible = false;
      this.$emit("refresh-with-loading");
    },

    /* -------------------------- 一键跳过失败函数 -------------------------- */

    /**
     * 按图1的规则从明细里抽「原子+函数都 FAILED」的函数名列表。
     *
     * 规则（照搬参考实现里的循环）：
     *   1. 遍历 atoms（每个原子）
     *   2. 遍历该原子的 functions（每个函数）
     *   3. 当 aaiAtomStatus === 'FAILED' 且 函数 status === 'FAILED' 时收集
     *   4. 同名函数只留一个（按出现顺序去重）
     *
     * 返回**深拷贝**后的数组，避免模板里直接引用 props 里的对象，
     * 万一未来谁手贱改了某一项会把 props 里的数据也改了。
     *
     * @param {Array} atoms 明细接口返回的 data[]，原子级 aaiAtomStatus + functions[].status
     * @returns {Array<{ funcName, ... }>}
     */
    buildFiledFncList(atoms) {
      const list = Array.isArray(atoms) ? atoms : []
      const arr = []
      list.forEach((item) => {
        const fns = (item && item.functions) || []
        fns.forEach((ite) => {
          if (
            item &&
            ite &&
            item.aaiAtomStatus === "FAILED" &&
            ite.status === "FAILED"
          ) {
            const dup = arr.find((x) => x && x.funcName === ite.funcName)
            if (!dup) {
              arr.push(ite)
            }
          }
        })
      })
      return JSON.parse(JSON.stringify(arr))
    },

    /**
     * 打开「一键跳过失败函数」弹窗。
     *
     * 没失败函数时按钮已经 disabled 了，这里再判一次防御。
     * `$nextTick` 里清表单校验 —— el-dialog 打开后才挂载 el-form，
     * 否则 ref.skipForm 是 undefined。
     */
    skipFnc() {
      if (!this.filedFncList.length) {
        return
      }
      if (this.loading) {
        return
      }
      this.skipForm = { funcName: "" }
      this.skipVisible = true
      this.$nextTick(() => {
        if (this.$refs.skipForm) {
          this.$refs.skipForm.clearValidate()
        }
      })
    },

    /**
     * 「一键跳过失败函数」弹窗点确定：
     *   1. 表单校验（funcName 必填）
     *   2. 调 POST /python/api/func/funcSkip（入参 { nodeId: aniInstanceNodeId, funcName }）
     *   3. 成功后通知父组件重新拉一次明细（弹窗不自己改 atoms）
     *
     * 链路与现有 `submitFn` / `submitAtom` 同构：
     *   - loading 精确到「这个子弹窗」（`skipLoading`，跟其他 loading 不冲突）
     *   - `this.ite`（参考实现里的写法）在我们这里就是 `this.node`（props.node），
     *     「查看明细」一次只查一个节点，整个弹窗里它就是同一个值。
     */
    async submitSkip() {
      if (this.skipLoading) {
        return
      }
      // this.$refs 在 require 时若引用为 undefined，
      // 上面跳过（不要让校验抛错打断 loading 重置的逻辑）
      const formRef = this.$refs.skipForm
      if (!formRef) {
        return
      }
      let valid = false
      try {
        valid = await formRef.validate()
      } catch (e) {
        // 校验失败时 validate() 会 reject；不弹错，只是不提交
        return
      }
      if (!valid) {
        return
      }
      const nodeId = this.node && this.node.aniInstanceNodeId
      const funcName = this.skipForm && this.skipForm.funcName
      const par = { nodeId, funcName }
      this.skipLoading = true
      try {
        await funcSkip(par)
        this.$message.success("操作成功")
        // 关弹窗 + 通知父组件重新拉明细（无感刷新，与函数级操作同档）
        this.skipVisible = false
        this.$emit("refresh")
      } catch (e) {
        console.error("[一键跳过失败函数] 请求失败", e)
        this.$message.error((e && e.message) || "操作失败")
      } finally {
        this.skipLoading = false
      }
    },

    /**
     * 子弹窗的 before-close：清掉表单 + 校验状态。
     *
     * 不去动 `skipLoading` —— 那由 submitSkip 自己 finally 重置，
     * 这里管了会跟正在飞的请求打架（关弹窗 → skipLoading 被强制设 false，
     * 但请求可能还在路上，回调里又设 false，看着没影响，其实抢了状态）。
     */
    handleCloseSkip() {
      this.skipForm = { funcName: "" }
      this.skipVisible = false
      this.$nextTick(() => {
        if (this.$refs.skipForm) {
          this.$refs.skipForm.clearValidate()
        }
      })
    },
  },
};
</script>

<style lang="scss" scoped>
.add-title {
  display: flex;
  align-items: center;
  min-width: 0;
  // 给右上角 × 图标让位：Element 的 `el-dialog__headerbtn` 是 `position: absolute; right: 20px`
  // （宽约 16px → 占 right:20~36px），padding-right: 56px 才能让 margin-left: auto 推上去的
  // 按钮避开 × 区域；不写这个，按钮就会被 × 盖住。
  padding-right: 56px;

  &__text {
    flex: none;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.2px;
    color: #1f2937;
  }

  &__node {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 520px;
    margin-left: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #5b6b82;
  }

  &__count {
    flex: none;
    height: 20px;
    padding: 0 8px;
    margin-left: 10px;
    border-radius: 5px;
    background: #eef1f7;
    color: #64748b;
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 20px;
  }

  &__loading {
    flex: none;
    margin-left: 10px;
    font-size: 11.5px;
    color: #cf8f22;
  }

  /*
    右上角「函数批量跳过」按钮。
    `margin-left: auto` 把按钮推到行尾 —— 标题区是 flex，items 之前用 flex: none / 0 1 auto
    排着走，加一个 auto margin 就把后面的东西顶到右端。
    颜色走 next 12 蓝色（与页面其它主按钮对齐），跟节点「就绪态」的蓝呼应。
  */
  &__btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    margin-left: auto;
    padding: 0 12px;
    border: 1px solid #cfdcef;
    border-radius: 6px;
    background: #eef4fd;
    color: #2b7fd4;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2px;
    cursor: pointer;
    transition: background-color 0.16s ease, border-color 0.16s ease,
      color 0.16s ease;

    &:hover:not(:disabled) {
      background: #e2ecf9;
      border-color: #a9c9ec;
      color: #1f6fbf;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }

    /*
      「停止刷新」态：配色从蓝转琥珀，跟右边那句「刷新中...」呼应 ——
      一眼能看出「现在正在自动刷新」，而不是普通按钮。
      注意这里**不写 disabled**：自动刷新期间表格一直 loading，按钮必须还能点（用来停表）。
    */
    &.is-active {
      border-color: #f0d9a8;
      background: #fdf6e7;
      color: #b7791f;

      &:hover:not(:disabled) {
        background: #fbefd8;
        border-color: #e6c98a;
        color: #9c6615;
      }
    }
  }

  &__btn-icon {
    flex: none;
    width: 12px;
    height: 12px;
    margin-right: 5px;
  }

  /*
    头部「一键跳过失败函数」等次级按钮的间距：
    第一个按钮靠 `margin-left: auto` 推到行尾，第二个没自己的 margin 就会贴上去。
    8px 是头部按钮之间的舒适间距，跟页面其它按钮组对齐。
  */
  &__btn--secondary {
    margin-left: 8px;
  }

  /*
    自动刷新开着时的「刷新中...」：黄色 + 呼吸（透明度来回）。

    颜色取的是同一个头部里「函数明细加载中…」的 #cf8f22 —— 都是「正在等数据」的语义，
    一个色系读起来才是一套语言。

    ⚠️ 这个 @keyframes 写在**样式块顶层**，没嵌在 .add-title 里。
       vue-loader 的 scoped 插件会把 keyframes 改名（`add-refresh-breath` ->
       `add-refresh-breath-<scopeId>`），并把 animation 里的引用一起改掉；
       实测（@vue/component-compiler-utils 的 compileStyle）两边是一致的。
       嵌着写其实也能跑（dart-sass 会把嵌套的 at-rule 提到顶层），
       但那是编译器的行为，别让「动画生不生效」依赖它 —— 顶层最直白。
  */
  &__refreshing {
    flex: none;
    margin-left: 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2px;
    color: #cf8f22;
    animation: add-refresh-breath 1.4s ease-in-out infinite;
  }
}

@keyframes add-refresh-breath {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.25;
  }
}

.add {
  min-height: 200px;

  &-cell {
    margin: 0;
    word-break: break-all;

    /* 指令描述：单行省略，完整内容靠 el-tooltip 展示 */
    &.is-ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      word-break: normal;
      cursor: default;
    }

    /*
      工单：**双击**可以查该工单关联的自动发布文档（见 onRowDblclick）。
      做成「链接」的样子 —— 蓝色 + 悬停变深并加下划线 —— 让「这里能点」一眼可见；
      「双击」这个动作本身由单元格上的 el-tooltip 说明。
      ⚠️ 只在**有工单号**时才加这个 class（空值渲染的是普通 `add-cell` 的「—」），
         否则一个灰色的「—」看着也能点，是误导。
    */
    &.is-order {
      color: #2b6cff;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.15s ease;

      &:hover {
        color: #1a56db;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
  }

  &-expand {
    box-sizing: border-box;
    /* 左内边距跟展开图标对齐（照需求图） */
    padding: 0 0 0 45px;
    background: #fafbfd;

    &__tag {
      display: block;
      width: 100%;
      margin-bottom: 10px;
      text-align: center;
    }

    &__desc {
      margin: 0;
      padding-bottom: 10px;
      font-size: 12.5px;
      line-height: 1.7;
      color: #3d4a5c;
      word-break: break-all;
    }
  }

  /* 内层「所属函数列表」表格 */
  &-fn {
    padding-bottom: 12px;

    &__cell {
      margin: 0;
    }

    /* 【新】标记：让用户认出刚点过最新结果的那一行 */
    &__new {
      color: #f56c6c;
    }
  }

  &-empty {
    padding: 26px 0;

    &__text {
      font-size: 12.5px;
      color: #97a3b6;

      &.is-bad {
        color: #c73b3b;
      }
    }
  }
}

/* JsonViewer 外层：太高就把弹层自己滚起来，别把表格撑爆 */
.add-json {
  max-height: 420px;
  overflow: auto;
}

.add-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 22px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #5b6b82;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    border-color: #a9c9ec;
    color: #2b7fd4;
  }
}

/* 表格收一收，跟页面的紧凑风格对齐 */
.add ::v-deep {
  .el-table {
    font-size: 12px;
    color: #3d4a5c;
  }

  .el-table th {
    background: #f7f9fc;
    color: #5b6b82;
    font-weight: 600;
  }

  .el-table td,
  .el-table th {
    padding: 6px 0;
  }

  .el-table__expanded-cell {
    padding: 0 !important;
    background: #fafbfd;
  }

  .el-button--text {
    padding: 0 4px;
  }

  /* 「工单」列可双击（查该工单关联的自动发布文档，见 onRowDblclick）——
     只给一个鼠标提示，不改任何视觉。域名切换节点的「指令描述」列没有这个 class。
     ⚠️ 必须限定 td：el-table-column 的 class-name 会**同时加到表头的 th 上**，
        不限定的话表头也会显示手型光标（表头并不能双击）。 */
  td.add-order-cell {
    cursor: pointer;
  }
}

/* 内层「所属函数列表」：刚点过最新结果的那一行整行高亮
   （行 class 由 fnRowClassName 给出，见 methods）
   ⚠️ 必须写在 scoped 块里 —— 非 scoped 块里的 ::v-deep 不会被编译，
      产物里原样保留 `::v-deep` 是无效选择器，整条规则会被浏览器丢掉。 */
.add-fn ::v-deep {
  .is-new-result td {
    background: #fff5f5;
  }
}

/* ---------------- 最新结果 / 日志 / 历史结果（三个弹窗） ---------------- */

.result-content {
  /* 内容再长也别把弹窗撑出屏幕，自己滚 */
  max-height: 68vh;
  overflow-y: auto;
}

.box-card {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.w100 {
  width: 100%;
}

/* 卡片标题：整行居左（用户要求 tag 靠左，不要居中） */
.el-tag-title {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 10px;
}

/* 时间线容器：限高自己滚 */
.timeline-box {
  max-height: 300px;
  padding-right: 6px;
  overflow-y: auto;
}

/* 「暂无日志 / 暂无执行结果」的空态：tag 同样靠左（与上面的卡片标题对齐） */
.no-result {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 64px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* 「变化对比」：diff 自己带横向滚动，外面给点上下留白即可 */
.diff-content {
  padding: 2px 0 6px;
}

/* 「执行结果」的 tab 标签：cmd 可能很长，单行省略，完整内容靠 el-tooltip */
.text-ellipsis {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.w200 {
  max-width: 200px;
}

/* 一个 tab 里的多条执行记录 */
.content-inner {
  padding: 4px 0 0;
}

.result-item {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &__idc {
    margin-bottom: 10px;
  }
}

/* 「没有执行结果表格」时整段 post_content 的 JSON 预览 */
.inner {
  padding: 4px 2px;
}

.inner-max {
  max-height: 360px;
  overflow: auto;
}
</style>

<!-- dialog 挂载在 body 上，覆盖 el-dialog 内部样式需非 scoped（同 SilenceDialog 做法） -->
<style lang="scss">
/**
 * 「最新结果」比另外两个结果弹窗（日志 / 历史结果）宽。
 *
 * 理由：它里面有一块 **side-by-side 的配置 diff**（`<code-diff output-format="side-by-side">`），
 * 左右各占一半，50% 宽度下每行只剩几个字、完全看不出差异。另外两个弹窗只有时间线，
 * 保持 50% 不动。
 *
 * ⚠️ 用 `custom-class` 而不是全局改 `el-dialog` —— 项目里其它页面的弹窗不能跟着变宽。
 *    窄屏仍要兜住，别顶出视口（与 .add-dialog 同一套兜底）。
 */
.add-result-dialog {
  max-width: calc(100vw - 40px);
}

.add-dialog {
  border-radius: 8px;
  /* 窄屏时不要顶出视口 */
  max-width: calc(100vw - 40px);

  .el-dialog__header {
    padding: 16px 22px 14px;
    border-bottom: 1px solid #e6eaf2;
  }

  .el-dialog__headerbtn {
    top: 18px;
    right: 20px;
    font-size: 16px;
  }

  .el-dialog__body {
    padding: 12px 18px 0;
  }

  .el-dialog__footer {
    padding: 12px 22px 16px;
  }
}

/* JsonViewer 弹层内层 */
.add-json-popover {
  padding: 8px 10px;
}
</style>
