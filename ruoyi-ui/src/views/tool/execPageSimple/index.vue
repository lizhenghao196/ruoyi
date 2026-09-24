<template>
  <div class="esp">
    <!--
      顶部（比 execPage 高一档，因为左侧要竖着放两行选择器）：
        [标题]  [环境行 / 流行]  [总体进度]  [操作按钮]
      交互顺序是**先环境、后流**：第一行的环境决定第二行列哪些流，
      第二行选中的流决定主体左侧画哪一张图。
    -->
    <header class="esp__header">
      <div class="esp-picker">
        <div class="esp-picker__caption">
          <span class="esp-picker__caption-icon">
            <svg-icon icon-class="tree-table" />
          </span>
          <div class="esp-picker__caption-text">
            <h1>执行界面简版</h1>
            <p>{{ captionText }}</p>
          </div>
        </div>

        <div class="esp-picker__rows">
          <!-- 第一行：环境（= 该系统的各个 aripExecPlanId，一个环境一条计划） -->
          <div class="esp-picker__row">
            <span class="esp-picker__label">环境</span>
            <div class="esp-picker__chips">
              <button
                v-for="env in envList"
                :key="env.planId"
                type="button"
                class="esp-chip"
                :class="{ 'is-active': isActiveEnv(env) }"
                :title="envTitle(env)"
                @click="selectEnv(env)"
              >
                <!--
                  圆点配色 = 该环境下**所有流的全部节点**汇总出来的 tone（见 flowLayout.aggregateTone），
                  不再用计划状态（aripExecStatus）—— 那样看不出底下节点跑到哪了。
                  悬停提示里有逐状态的数量，圆点颜色有据可查。
                -->
                <i class="esp-chip__dot" :class="'is-' + env.tone" />
                <span class="esp-chip__text">{{ env.env || "—" }}</span>
                <span class="esp-chip__sub">{{ env.flowCount }} 流</span>
              </button>
              <span v-if="!envList.length" class="esp-picker__hint">
                未接收到环境
              </span>
            </div>
          </div>

          <!-- 第二行：流（只列当前选中环境下的流） -->
          <div class="esp-picker__row">
            <span class="esp-picker__label">流</span>
            <div class="esp-picker__chips">
              <button
                v-for="flow in envFlows"
                :key="flow.key"
                type="button"
                class="esp-chip is-flow"
                :class="{ 'is-active': isActiveFlow(flow) }"
                :title="flow.name || '未命名流'"
                @click="selectFlow(flow)"
              >
                <i class="esp-chip__dot" :class="'is-' + toneOf(flow.status)" />
                <span class="esp-chip__text">{{ flow.name || "未命名流" }}</span>
              </button>
              <span v-if="!envFlows.length" class="esp-picker__hint">
                {{ selectedPlanId ? "该环境暂无流" : "请先选择环境" }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!--
        总体进度：把本页**全部**执行计划的 finishedNodeNums / totalNodeNums 各自求和后再算百分比
        （见 computed 里的 progressFinished / progressTotal / progressPercent）。
        进度条本身是哑的：只读 computed，不发请求、不参与轮询。
      -->
      <div
        class="esp-progress"
        :class="{ 'is-idle': !progressTotal }"
        :title="progressTitle"
      >
        <div class="esp-progress__track">
          <div
            class="esp-progress__fill"
            :style="{ width: progressPercent + '%' }"
          >
            <!-- 两层反向流动的波面 + 一道扫过的光带：进度**不动时也在动**（常驻动画） -->
            <span class="esp-progress__wave" />
            <span class="esp-progress__wave is-back" />
            <span class="esp-progress__sheen" />
            <!-- 进度右端的呼吸亮点 -->
            <span class="esp-progress__head" />
          </div>
          <!--
            文字分两层，逐字重合：
              底层深色铺满整条，上层白色按进度用 clip-path 裁掉右侧。
            所以文字跨在进度边界上时是「左白右灰」，进度再小也读得清。
          -->
          <span class="esp-progress__label">总体进度 {{ progressPercent }}%</span>
          <span
            class="esp-progress__label is-over"
            :style="{ clipPath: 'inset(0 ' + (100 - progressPercent) + '% 0 0)' }"
            >总体进度 {{ progressPercent }}%</span
          >
        </div>
      </div>

      <div class="esp__actions">
        <!-- 轮询状态指示：脉动点 + 最后更新时间 + 轮询次数 -->
        <div
          class="esp-live"
          :class="{ 'is-paused': !pollEnabled, 'is-error': !!failedIds.length }"
          :title="pollTitle"
        >
          <span class="esp-live__dot" />
          <span class="esp-live__state">{{ liveText }}</span>
          <span class="esp-live__time">{{ lastUpdatedAt || "—" }}</span>
          <span class="esp-live__count">#{{ pollCount }}</span>
        </div>

        <button
          type="button"
          class="esp-btn"
          :disabled="execUser.submitting"
          :title="usersLoading ? '用户列表加载中…' : '修改工单的实施人'"
          @click="openExecUser"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <circle
              cx="4.6"
              cy="3.9"
              r="2.1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M1.4 10.4c0-1.8 1.4-2.9 3.2-2.9s3.2 1.1 3.2 2.9"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
            <path
              d="M9.2 3.1v3.2M7.6 4.7h3.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          修改实施人
        </button>

        <!-- 设置消息推送：本页**所有**计划共用一份推送设置（见 openSmsSetting） -->
        <button
          type="button"
          class="esp-btn"
          :disabled="sms.querying || !rawIds.length"
          :title="
            rawIds.length
              ? `为本次 ${rawIds.length} 个执行计划设置消息推送`
              : '没有执行计划，无法设置'
          "
          @click="openSmsSetting"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M6 1.2a3.3 3.3 0 0 0-3.3 3.3v2L1.8 8.4h8.4L9.3 6.5v-2A3.3 3.3 0 0 0 6 1.2Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
            <path
              d="M4.7 9.6a1.4 1.4 0 0 0 2.6 0"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          设置消息推送
        </button>

        <button
          type="button"
          class="esp-btn"
          :class="{ 'is-on': !pollEnabled }"
          @click="togglePolling"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <template v-if="pollEnabled">
              <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
            </template>
            <path v-else d="M3 1.6 L10.4 6 L3 10.4 Z" fill="currentColor" />
          </svg>
          {{ pollEnabled ? "暂停" : "继续" }}
        </button>

        <button
          type="button"
          class="esp-btn"
          :class="{ 'is-spin': refreshing }"
          :disabled="refreshing"
          @click="refreshNow"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M6 1.6a4.4 4.4 0 1 0 4.4 4.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path d="M6 0 L9.2 2.1 L6 4.2 Z" fill="currentColor" />
          </svg>
          刷新
        </button>
      </div>
    </header>

    <!--
      主体：左右两栏。
        左 = 当前选中那一条流的**纵向**流程图（从上到下 = 执行方向）
        右 = 文档信息（工单关联的自动发布文档）
      ⚠️ **默认只有左栏**：页面一进来没有文档，流独占整宽；
         用户在「查看明细」里双击工单、接口返回了文档之后，右栏才出现（is-doc）。
      ⚠️ 这里刻意不用 <aside>：assets/styles/index.scss 里有一条全局 `aside { ... }`
         会漏进 scoped 组件（组件没声明的属性照样吃全局值），用 section 省掉这层心智负担。
    -->
    <main class="esp__body">
      <!-- 没有接收到任何 id -->
      <div v-if="!rawIds.length" class="esp-empty">
        <span class="esp-empty__icon">
          <svg-icon icon-class="question" />
        </span>
        <p class="esp-empty__title">没有接收到执行计划 ID</p>
        <p class="esp-empty__desc">
          请从「变更计划列表」页面点击「查看执行」进入本页面
        </p>
      </div>

      <!-- 正在并发拉取每个 aripExecPlanId 的执行详情 -->
      <div v-else-if="loading" class="esp-empty">
        <span class="esp-empty__icon is-spin">
          <svg-icon icon-class="time" />
        </span>
        <p class="esp-empty__title">正在获取执行详情…</p>
        <p class="esp-empty__desc">已并发请求 {{ rawIds.length }} 个执行计划</p>
      </div>

      <div v-else class="esp-split" :class="{ 'is-doc': docVisible }">
        <!-- 左：选中流的纵向流程图 -->
        <section class="esp-flow">
          <header v-if="currentFlow" class="esp-flow__head">
            <div class="esp-flow__head-main">
              <div class="esp-flow__title">
                <span class="esp-flow__seq"
                  >{{ currentFlow.flowIndex }}/{{ currentFlow.flowCount }}</span
                >
                <span class="esp-flow__name" :title="currentFlow.name">{{
                  currentFlow.name || "未命名流"
                }}</span>
                <span class="esp-pill" :class="'is-' + toneOf(currentFlow.status)">
                  {{ statusText(currentFlow.status) }}
                </span>
              </div>
              <div class="esp-flow__meta">
                <span class="esp-tag is-sys">{{ currentFlow.system || "—" }}</span>
                <span class="esp-tag is-env">{{ currentFlow.env || "—" }}</span>
                <span class="esp-tag is-plan">{{
                  currentFlow.planName || "—"
                }}</span>
                <span class="esp-meta"
                  >开始 {{ clock(currentFlow.startTime) || "—" }}</span
                >
                <span class="esp-meta"
                  >结束 {{ clock(currentFlow.endTime) || "—" }}</span
                >
                <span class="esp-meta">
                  {{ currentFlow.templateName
                  }}{{
                    currentFlow.templateVersion
                      ? " " + currentFlow.templateVersion
                      : ""
                  }}
                </span>
                <span class="esp-meta">
                  {{ currentFlow.graph.nodes.length }} 节点 ·
                  {{ currentFlow.graph.edges.length }} 连线 ·
                  {{ currentFlow.graph.groups.length }} 并行组
                </span>
              </div>
            </div>

            <!--
              流上的操作按钮，按 awiWorkflowStatus 决定显隐（三个互斥）。
              数据来自 flowLayout.js 透传的 awiWorkflowStatus / awiWorkflowInstanceId。
            -->
            <div class="esp-flow__btns">
              <el-button
                v-if="
                  currentFlow.awiWorkflowStatus === 'INIT' ||
                  currentFlow.awiWorkflowStatus === 'READY'
                "
                type="warning"
                size="mini"
                plain
                @click="flowCancel(currentFlow)"
                >取消</el-button
              >
              <el-button
                v-if="currentFlow.awiWorkflowStatus === 'RUNNING'"
                type="danger"
                size="mini"
                plain
                @click="flowStop(currentFlow)"
                >暂停</el-button
              >
              <el-button
                v-if="currentFlow.awiWorkflowStatus === 'STOP'"
                size="mini"
                plain
                @click="flowRecover(currentFlow)"
                >恢复</el-button
              >
            </div>
          </header>

          <!--
            画布滚动容器。除了滚动，还负责「认出用户是不是自己在滚」——
            见 markUserScroll / onCanvasMousedown 的说明：
            只有**输入类事件**（滚轮 / 触摸 / 键盘 / 拖滚动条）才算用户操作，
            程序化滚动和内容变化引起的 scroll 事件一律不算，
            否则轮询刷新一次就会误判成「用户刚滚过」、自动滚动被冻 20 秒。
          -->
          <div
            class="esp-flow__canvas"
            ref="flowCanvas"
            @wheel.passive="markUserScroll"
            @touchmove.passive="markUserScroll"
            @keydown="onCanvasKeydown"
            @mousedown="onCanvasMousedown"
          >
            <flow-graph
              v-if="currentFlow && currentFlow.graph.nodes.length"
              :graph="currentFlow.graph"
              :uid="currentFlow.key"
              :status-labels="statusLabels"
              :active-node-id="
                menu.visible && menu.flowKey === currentFlow.key
                  ? menu.nodeId
                  : null
              "
              @node-menu="onNodeMenu($event, currentFlow)"
              @node-dblclick="onNodeDblclick($event, currentFlow)"
            />
            <div v-else class="esp-flow__placeholder">
              <svg-icon icon-class="time" />
              <span>{{
                currentFlow ? "编排实例已创建，节点尚未生成" : "请先在上方选择一条流"
              }}</span>
            </div>
          </div>
        </section>

        <!--
          右：文档信息（工单关联的自动发布文档）。

          ⚠️ **默认不渲染**（docVisible = docFiles 非空）：页面一进来只有流，流独占整宽。
             只有用户在「查看明细」表格里**双击工单**、接口真的返回了文档，这一栏才出现。
          ⚠️ 一个工单可能关联多个文档（接口的 files 是**数组**）→ 用 tab 切换，
             iframe 始终只嵌当前那一个。
          ⚠️ 文档地址 = DOC_VIEW_BASE + file_name（**不是**返回里的 url 字段，那是另一条路由）。
        -->
        <section v-if="docVisible" class="esp-doc">
          <div class="esp-doc__head">
            <!-- 工单号：一眼看出这块文档属于哪个工单 -->
            <span class="esp-doc__order" :title="docOrderId">
              <svg-icon icon-class="documentation" />
              <span class="esp-doc__order-text">{{ docOrderId }}</span>
            </span>
            <span class="esp-doc__ops">
              <button
                type="button"
                class="esp-doc__btn"
                @click="openDocInNewTab"
              >
                新窗口打开
              </button>
              <!--
                收起文档区：清空 docFiles -> docVisible 变假 -> 整栏消失、左栏恢复独占整宽。
                （2026-09-24 用户要求把原来的「刷新」换成它 —— 刷新靠切 tab / 重新双击工单即可，
                  收起才是这一栏真正缺的出口。）
              -->
              <button
                type="button"
                class="esp-doc__btn esp-doc__close"
                title="收起文档区"
                @click="resetDocArea"
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M3.2 3.2 L8.8 8.8 M8.8 3.2 L3.2 8.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </span>
          </div>

          <!-- 多文档 tab：只有一个文档时也保留 tab 条（用户要求「显示出工单号和 tab」） -->
          <div class="esp-doc__tabs">
            <button
              v-for="(file, index) in docFiles"
              :key="file.file_name || index"
              type="button"
              class="esp-doc__tab"
              :class="{ 'is-active': index === docActiveIndex }"
              :title="file.file_name"
              @click="selectDoc(index)"
            >
              {{ docTabLabel(file) }}
            </button>
          </div>

          <!--
            文档视口 = 横向滚动容器。
            ⚠️ 文档是**跨源**内网地址，父页面动不了 iframe 内部（同源策略挡住 contentDocument /
               contentWindow），所以「横向看全」只能靠这里：iframe 被撑到比容器宽，
               父容器出现横向滚动条，用户横拉即可。
          -->
          <div ref="docFrame" class="esp-doc__frame">
            <!-- key 一换就重建 iframe：src 没变时浏览器不会重新请求，刷新会变成空操作 -->
            <iframe
              :key="docFrameKey"
              :src="docUrl"
              title="文档信息"
              frameborder="0"
              @load="onDocFrameLoad"
            ></iframe>
            <div v-if="!docFrameLoaded" class="esp-doc__frame-mask">
              <svg-icon icon-class="time" />
              <span>文档加载中…</span>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- 节点右键菜单：有哪些菜单项完全由节点状态决定（见 nodeMenu.js） -->
    <node-context-menu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :items="menuItems"
      :node-name="menuNode ? menuNode.aniInstanceNodeName : ''"
      :status-label="menuNode ? statusText(menuNode.aniStatus) : ''"
      @select="onMenuSelect"
      @close="closeMenu"
    />

    <!-- 设置静默：输入静默时长（分钟），0 = 取消静默 -->
    <silence-dialog
      :visible="silence.visible"
      :submitting="silence.submitting"
      @submit="submitSilence"
      @close="closeSilence"
    />

    <!-- 查看明细：该节点下的原子列表（数据全部来自 queryAotmOfNode） -->
    <atom-detail-dialog
      :visible="detail.visible"
      :node="detail.node"
      :atoms="detail.atoms"
      :loading="detail.loading"
      :error="detail.error"
      :project-role-disabled="isProjectRoleDisable"
      :submitting="detail.submitting"
      :auto-refreshing="detailAutoRefresh"
      @close="closeDetail"
      @confirm="onAtomConfirm"
      @skip="onAtomSkip"
      @refresh="reloadDetailAtoms"
      @refresh-with-loading="reloadDetailAtoms({ withLoading: true })"
      @toggle-auto-refresh="toggleDetailAutoRefresh"
      @order-dblclick="onDetailOrderDblclick"
    />

    <!-- 原子确认：**双击人工确认节点**弹出的小弹窗 -->
    <atom-confirm-dialog
      :visible="atomConfirm.visible"
      :node="atomConfirm.node"
      :atoms="atomConfirm.atoms"
      :loading="atomConfirm.loading"
      :submitting="atomConfirm.submitting"
      @close="closeAtomConfirm"
      @confirm="submitAtomConfirm"
    />

    <!-- 设置消息推送：页面级设置，作用于本页**全部** aripExecPlanId -->
    <sms-setting-dialog
      :visible="sms.visible"
      :send-on="sms.sendOn"
      :group-id="sms.groupId"
      :submitting="sms.submitting"
      @close="closeSmsSetting"
      @submit="submitSmsSetting"
    />

    <!-- 修改实施人：页面级操作，用户列表进页面就拉好（见 fetchUsers） -->
    <exec-user-dialog
      :visible="execUser.visible"
      :users="users"
      :users-loading="usersLoading"
      :submitting="execUser.submitting"
      @close="closeExecUser"
      @submit="submitExecUser"
    />
  </div>
</template>

<script>
/**
 * 执行界面简版（全屏页面，由「变更计划列表」页在新标签页打开）
 * ==========================================================================
 * 与 execPage（执行页面）的关系
 *   功能集合**完全一致**（修改实施人 / 设置消息推送 / 流操作 / 节点操作 / 查看明细 /
 *   静默 / 双击分流 / 轮询 / 总体进度），差别只在信息架构与布局：
 *     · 顶部左侧多了一组**两级选择器**：第一行选环境，第二行选流（先环境后流）
 *     · 主体默认只有左栏：选中那**一条**流的纵向流程图（从上到下 = 执行方向），独占整宽
 *     · 用户在「查看明细」表格里**双击工单**后，右栏才展出该工单关联的文档
 *       （工单号 + 多文档 tab + iframe），左右变成 6 : 4 —— 见 onDetailOrderDblclick
 *     · 流图方向由「从左到右」改成「从上到下」（见 flowLayout.js）
 *
 * ⚠️ 用户明确要求：除了 mockData 里的内容，**其他组件 / 方法 / 接口一律不许共享**。
 *    所以本页面用的是自己一套：./flowLayout.js、./nodeMenu.js、./nodeKind.js、
 *    ./nodeParams.js、./components/*、@/api/tool/execPageSimple。
 *    **不要为了「去重」把 import 改成 execPage 的那份** —— 两套页面就是要有各自的演化节奏。
 * ==========================================================================
 */
import {
  getExecuteIndexBatch,
  addNodeDelayParams,
  getPlanExtraInfo,
  setNodeFinishSms,
  isSmsSendOn,
  SMS_SEND_ON,
  SMS_SEND_OFF,
  listAllUser,
  changeExecUser,
  queryAotmOfNode,
  sureAtomInstance,
  updateAtomStatus,
  updateNodeStatus,
  updateWorkflowStatus,
  // 双击明细表「工单」列 -> 查该工单关联的自动发布文档（右栏文档区用它）
  queryAutoRate,
  // 接口返回的载荷有可能在 data、也有可能在 rows —— 取值一律走它（见函数说明）
  pickPayload,
} from "@/api/tool/execPageSimple";
import {
  mergeWorkflows,
  layoutFlow,
  toClock,
  statusTone,
  aggregateTone,
  TONE_ORDER,
  EXEC_STATUS_DICT_TYPE,
} from "./flowLayout";
import FlowGraph from "./components/FlowGraph";
import NodeContextMenu from "./components/NodeContextMenu";
import SilenceDialog from "./components/SilenceDialog";
import AtomDetailDialog from "./components/AtomDetailDialog";
import AtomConfirmDialog from "./components/AtomConfirmDialog";
import SmsSettingDialog from "./components/SmsSettingDialog";
import ExecUserDialog from "./components/ExecUserDialog";
import { buildNodeMenu } from "./nodeMenu";
// 「是不是人工确认节点」的唯一判定（明细弹窗也用它，见 AtomDetailDialog.vue）
import { isHumanConfirmNode } from "./nodeKind";
import { mapState } from "vuex";

// 轮询间隔（毫秒）。真实接口较慢时可调大，页面刷新按钮不受此限制。
const POLL_INTERVAL = 3000;

// 「查看明细」弹窗里那个「刷新 / 停止刷新」的定时间隔（毫秒），比页面轮询慢一档
const DETAIL_POLL_INTERVAL = 5000;

/* --------------------------- 画布自动滚动 --------------------------- */

/**
 * 用户自己滚动之后，自动滚动让位多久（毫秒）。
 * 用户明确要求 20 秒：这段时间内轮询再怎么刷新都不动视野，免得和用户抢滚动条。
 */
const AUTO_SCROLL_HOLD_MS = 20000;

/**
 * 平滑滚动「落点核对」的等待时长（毫秒）。
 * 平滑滚动没有「结束」事件，用这个窗口等它滚完；
 * 窗口结束后如果落点和我们要求的不一致，说明用户中途插了一手
 * （滚轮会打断平滑滚动），照样按「用户滚动」处理。
 */
const AUTO_SCROLL_SETTLE_MS = 700;

/**
 * 目标位置和当前位置差值小于它就不滚（像素）。
 * 轮询每 3 秒来一次，目标节点没动的时候不要每次都发起一次平滑滚动 ——
 * 那会让画面一直有轻微的蠕动感。
 */
const AUTO_SCROLL_MIN_DELTA = 6;

// 关闭菜单时的初始值：与「打开菜单」保持同一结构，避免出现半残状态
const MENU_CLOSED = {
  visible: false,
  x: 0,
  y: 0,
  planId: null,
  flowKey: null,
  nodeId: null,
};

// 静默弹窗的关闭态。planId / nodeId 才是提交时要用的，它们不依赖节点对象还存不存在。
const SILENCE_CLOSED = {
  visible: false,
  planId: null,
  nodeId: null,
  submitting: false,
};

/**
 * 查看明细弹窗的关闭态。
 * atoms 就是 `queryAotmOfNode` 返回的 `data[]` —— 表格里每一格都来自接口，
 * 不从节点自带的 atoms[] 里兜。
 */
const DETAIL_CLOSED = {
  visible: false,
  nodeId: null,
  node: null,
  atoms: [],
  loading: false,
  error: "",
  // 正在提交的原子操作：null 或 { aaiInstanceAtomId, action }（action = 'confirm' | 'skip'）
  submitting: null,
};

// 「原子确认」小弹窗（双击人工确认节点弹出）的关闭态
const ATOM_CONFIRM_CLOSED = {
  visible: false,
  nodeId: null,
  node: null,
  atoms: [],
  loading: false,
  submitting: false,
};

/**
 * 「设置消息推送」弹窗的关闭态。
 * 这里**没有 loading**：状态是**先查后开**的（见 openSmsSetting），
 * 查的过程由 `querying` 表示 —— 它驱动的是右上角那个按钮，不是弹窗。
 */
const SMS_CLOSED = {
  visible: false,
  querying: false,
  submitting: false,
  sendOn: false,
  groupId: 0,
};

// 「修改实施人」弹窗的关闭态（用户列表进页面就拉好，工单号由用户自己填）
const EXEC_USER_CLOSED = {
  visible: false,
  submitting: false,
};

/**
 * 右栏文档 iframe 的「加载中」兜底时长（毫秒）。
 *
 * ⚠️ 这里只是**防止遮罩永远不消失**，不是「超时 = 被 X-Frame-Options 拦了」的判据 ——
 * 被拦时浏览器照样会触发 iframe 的 load 事件（它加载的是一张空白错误页），
 * 所以前端**无法**区分「加载成功」和「被拦掉」，别拿这个时长做断言。
 * 真正能确认被拦的只有浏览器控制台的 `Refused to display ... in a frame`。
 */
const DOC_FRAME_TIMEOUT_MS = 8000;

/**
 * 文档的实际访问地址前缀 —— `query_auto_rate` 返回的 `files[].file_name` 拼在它后面即可。
 *
 * ⚠️ **不要**改用返回里的 `files[].url`（那是 `/api/v1/doc/view/...`，是另一条路由，
 *    与本页面要嵌的地址不是一回事）；用户明确给的就是「这条前缀 + file_name」。
 * ⚠️ 内网地址：网外访问不到，只在内网环境有效。
 */
const DOC_VIEW_BASE = "http://10.2.64.36:8121/api/cicd/doc/view/";

/**
 * 明细弹窗里的两个原子操作。它们只有「调哪个接口、叫什么名字」不同，
 * 其余流程（二次确认 -> 调接口 -> 重新拉明细 -> 按钮 loading）**完全一样**。
 */
const ATOM_ACTIONS = {
  confirm: { api: sureAtomInstance, label: "确认完成" },
  skip: { api: updateAtomStatus, label: "跳过" },
};

/**
 * 算作「项目角色」的角色标识。
 * 影响两处：① 右键菜单只读（只剩「查看明细」）；② 明细弹窗的「确认完成」按钮。
 */
const PROJECT_ROLE_KEYS = ["project_role"];

export default {
  name: "ExecPageSimple",
  components: {
    FlowGraph,
    NodeContextMenu,
    SilenceDialog,
    AtomDetailDialog,
    AtomConfirmDialog,
    SmsSettingDialog,
    ExecUserDialog,
  },
  // 状态文案走 RuoYi 字典：sys_dict_type = release_execute_status_no_css
  dicts: [EXEC_STATUS_DICT_TYPE],
  data() {
    return {
      loading: false, // 首屏 / 换参时的骨架态（会替换 DOM，仅此场景使用）
      refreshing: false, // 轮询中的静默刷新态（不遮挡页面）
      // 每个 aripExecPlanId 对应一条返回，顺序与 rawIds 严格一致
      results: [],
      failedIds: [], // 本轮拉取失败的 planId（失败项保留上一次的数据）
      lastUpdatedAt: "",
      pollCount: 0,
      pollEnabled: true,
      timer: null,
      reqSeq: 0,

      /* ------------------------- 两级选择器的选中态 ------------------------- */
      // 选中的环境（= 一个 aripExecPlanId）
      selectedPlanId: null,
      // 选中的流（flowLayout.mergeWorkflows 出的 key）
      selectedFlowKey: null,
      // URL 带过来的环境元信息：[{ planId, env, planName }]
      // 用途只有一个 —— 详情还没回来时先把第一行的环境撑住，别让用户对着一片空白
      incomingEnvs: [],
      incomingSys: "",

      // 节点右键菜单：只存「指向谁」，菜单项本身是算出来的（见 menuItems），
      // 这样轮询把节点状态改掉时，菜单项会跟着一起变，不会拿着陈旧状态做操作。
      menu: { ...MENU_CLOSED },
      silence: { ...SILENCE_CLOSED },
      detail: { ...DETAIL_CLOSED },
      /**
       * 「查看明细」弹窗的自动刷新（定时器）。
       * 三个字段是一组，全在页面里：弹窗是哑组件，只负责显示按钮文案 + 把点击抛上来。
       * 销毁点（缺一个都会漏出后台定时器）：
       *   ① closeDetail()  ② beforeDestroy()  ③ refreshDetailTick() 里弹窗已关的兜底
       */
      detailAutoRefresh: false,
      detailTimer: null,
      detailRefreshing: false,
      atomConfirm: { ...ATOM_CONFIRM_CLOSED },
      sms: { ...SMS_CLOSED },
      execUser: { ...EXEC_USER_CLOSED },
      users: [],
      usersLoading: false,

      /* ------------------------- 画布自动滚动 ------------------------- */
      /**
       * 最后一次「用户自己滚动」的时间戳（毫秒）。0 = 从来没滚过。
       * 自动滚动前会看它：距今不到 AUTO_SCROLL_HOLD_MS 就让位给用户。
       * 切换环境 / 流时会清零 —— 那是用户主动换视野，不该被上一次的滚动记录压住。
       */
      lastUserScrollAt: 0,
      // 平滑滚动的「落点核对」定时器（见 autoScrollToFocusNode 尾部）
      autoScrollSettleTimer: null,

      /* --------------------------- 右栏文档信息 --------------------------- */
      /**
       * 文档区当前展示的工单号 + 该工单关联的文档列表（= `query_auto_rate` 返回的 data）。
       *
       * ⚠️ **初始为空**：页面一进来不展示文档模块，流独占整宽。
       *    只有「查看明细」里双击工单、接口真的返回了文档，这一栏才展出来（见 docVisible）。
       */
      docOrderId: "",
      // files[] —— 一个工单可能关联**多个**文档，tab 切换
      docFiles: [],
      // 当前激活的 tab（docFiles 的下标）
      docActiveIndex: 0,
      // 文档接口是否在飞（挡住重复双击）
      docLoading: false,
      // iframe 的 key：刷新 / 切文档时自增，强制浏览器重新请求（src 不变不会重发）
      docFrameKey: 0,
      // 首帧是否已加载（只用来收「加载中」遮罩）
      docFrameLoaded: false,
      // 兜底定时器：到点无条件收遮罩，避免加载失败时永远转圈
      docFrameTimer: null,
    };
  },
  computed: {
    // 角色走 RuoYi 的用户信息（state.user.roles），与路由守卫、其它页面同一来源
    ...mapState({
      roles: (state) => state.user.roles,
      // 当前登录用户的 userName —— 「修改实施人」的 updateBy 就是它（**登录名**，不是 nickName）
      updateBy: (state) => state.user.name,
    }),
    // 从 URL query 取到本次传入的全部 aripExecPlanId（数字数组）
    rawIds() {
      return parseIds(this.$route.query.ids);
    },
    sysName() {
      return this.incomingSys || "";
    },

    /* --------------------------- 右栏文档信息 --------------------------- */

    /**
     * 文档区是否展示 —— 也就是「页面一进来流独占整宽」的那个开关。
     *
     * ⚠️ 没有文档时**整栏都不渲染**（模板 v-if），`.esp-split` 也就不会带 is-doc，
     *    左栏自然占满整屏（见样式里的 .esp-split.is-doc 覆盖）。
     *    接口返回空数组（工单没关联文档）时保持不展示，并提示一句（见 onDetailOrderDblclick）。
     */
    docVisible() {
      return this.docFiles.length > 0;
    },
    /**
     * 右栏要嵌的文档地址 = `DOC_VIEW_BASE` + 当前 tab 的 `file_name`。
     *
     * ⚠️ **不要**改用接口返回里的 `files[].url`（`/api/v1/doc/view/...` 是另一条路由）。
     * ⚠️ **不要**在这里 decodeURIComponent：file_name 是后端直接给的原文，
     *    再解一次会把文件名里合法的 `%xx` 吃坏。
     */
    docUrl() {
      const file = this.docFiles[this.docActiveIndex];
      const name = file && file.file_name;
      return name ? DOC_VIEW_BASE + name : "";
    },
    // 页头标题下的小字：加载中 / 汇总信息
    captionText() {
      if (!this.rawIds.length) {
        return "未接收到执行计划";
      }
      if (this.loading) {
        return `${this.rawIds.length} 个环境 · 加载中…`;
      }
      const okPlans = this.results.filter((item) => !item.error).length;
      const tail = this.failedIds.length
        ? ` · ${this.failedIds.length} 个环境获取失败`
        : "";
      return `${okPlans} 个环境 · ${this.allFlows.length} 条流${tail}`;
    },

    /* --------------------------- 两级选择器 --------------------------- */

    /**
     * 第一行：环境列表。
     *
     * 顺序严格跟 URL 里的 ids 走（= 页面一里 plans 的顺序），不按接口返回顺序 ——
     * 否则轮询期间环境块的相对位置会跳。
     *
     * 环境名 / 计划名**优先取接口**（那是最新真值），接口还没回来时回落到 URL 带过来的
     * incomingEnvs（首屏不至于空着）。两条路都取不到才显示占位符。
     */
    envList() {
      return this.rawIds.map((id) => {
        const item = this.results.find(
          (r) => String(r.aripExecPlanId) === String(id)
        );
        const data = item && item.data;
        const meta =
          this.incomingEnvs.find((m) => String(m.planId) === String(id)) || {};
        const workflows =
          data && Array.isArray(data.workflows) ? data.workflows : [];
        // 该环境下**所有流的全部节点**（环境 chip 的圆点配色就看它们）
        const nodes = workflows.reduce(
          (acc, wf) =>
            acc.concat(wf && Array.isArray(wf.nodes) ? wf.nodes : []),
          []
        );
        // 逐状态计数：只给悬停提示用，让圆点颜色「有据可查」
        const nodeStatusCount = {};
        nodes.forEach((n) => {
          const s = n && n.aniStatus;
          if (s) {
            nodeStatusCount[s] = (nodeStatusCount[s] || 0) + 1;
          }
        });
        return {
          planId: id,
          env: (data && data.aripExecEnv) || meta.env || "",
          planName: (data && data.aripExecPlanName) || meta.planName || "",
          system: (data && data.aripExecSys) || this.incomingSys || "",
          status: (data && data.aripExecStatus) || "",
          planStart: data && data.aripExecPlanStart,
          planEnd: data && data.aripExecPlanEnd,
          flowCount: workflows.length,
          // 圆点配色：该环境下所有节点的状态汇总（见 flowLayout.aggregateTone）
          tone: aggregateTone(nodes),
          nodeCount: nodes.length,
          nodeStatusCount,
          loaded: !!data,
          stale: !!(item && item.stale),
        };
      });
    },
    selectedPlan() {
      return (
        this.envList.find(
          (e) => String(e.planId) === String(this.selectedPlanId)
        ) || null
      );
    },

    // 全部流（不带布局）—— 融合所有环境的 workflows
    allFlows() {
      return mergeWorkflows(this.results);
    },
    // 第二行：当前选中环境的流
    envFlows() {
      if (this.selectedPlanId === null) {
        return [];
      }
      return this.allFlows.filter(
        (f) => String(f.planId) === String(this.selectedPlanId)
      );
    },
    /**
     * 当前选中的那一条流（带 DAG 布局）。
     * 布局只对选中的这条算 —— 简版一次只画一张图，没必要给所有流都算一遍几何。
     */
    currentFlow() {
      const flow =
        this.envFlows.find((f) => f.key === this.selectedFlowKey) || null;
      if (!flow) {
        return null;
      }
      return { ...flow, graph: layoutFlow(flow.nodes, flow.relations) };
    },

    liveText() {
      if (this.failedIds.length) {
        return "部分失败";
      }
      return this.pollEnabled ? "实时刷新" : "已暂停";
    },
    // 状态 -> 中文文案，唯一来源是字典
    statusLabels() {
      const map =
        this.dict && this.dict.label
          ? this.dict.label[EXEC_STATUS_DICT_TYPE]
          : null;
      return map || {};
    },

    /*
      总体进度：把本页**全部**执行计划的节点数各自求和后再算百分比。
      ⚠️ 两个字段是每个 plan 的载荷顶层字段（不是从 workflows 里数出来的）。
      单个计划请求失败时 results 里那一项沿用上一次的数据（stale），照样计入 ——
      所以进度不会因为某一次请求失败就掉回去。
    */
    progressFinished() {
      return this.results.reduce(
        (n, item) => n + toCount(item && item.data && item.data.finishedNodeNums),
        0
      );
    },
    progressTotal() {
      return this.results.reduce(
        (n, item) => n + toCount(item && item.data && item.data.totalNodeNums),
        0
      );
    },
    /*
      百分比：**不取小数，保留到个位**，用 Math.floor 而不是 round ——
      宁可少报 1%，也不要「进度条已到头、节点还在跑」那种最像 bug 的画面。
    */
    progressPercent() {
      if (!this.progressTotal) {
        return 0;
      }
      const pct = Math.floor((this.progressFinished / this.progressTotal) * 100);
      return Math.max(0, Math.min(100, pct));
    },
    progressTitle() {
      if (!this.progressTotal) {
        return "总体进度：暂无节点统计（等待执行详情返回）";
      }
      return `总体进度 ${this.progressPercent}% · 已完成 ${this.progressFinished} / ${this.progressTotal} 个节点`;
    },
    pollTitle() {
      const lines = [
        this.pollEnabled
          ? `每 ${POLL_INTERVAL / 1000} 秒自动刷新一次`
          : "自动刷新已暂停，点右侧「继续」恢复",
        `已轮询 ${this.pollCount} 次`,
        this.lastUpdatedAt ? `最后更新 ${this.lastUpdatedAt}` : "尚未拿到数据",
      ];
      if (this.failedIds.length) {
        lines.push(`本轮失败：${this.failedIds.join(", ")}（已沿用上一次数据）`);
      }
      return lines.join("\n");
    },

    /* ------------------------- 节点右键菜单 ------------------------- */

    /**
     * 项目角色是否被禁用。
     * 禁用时节点只读 —— 菜单里只剩「查看明细」；明细弹窗的「确认完成」也只给非项目角色。
     */
    isProjectRoleDisable() {
      const roles = this.roles || [];
      return PROJECT_ROLE_KEYS.some((key) => roles.includes(key));
    },
    /**
     * 菜单当前指向的节点：每次都从最新的 currentFlow 里按 id 重新查，
     * 而不是把右键那一刻的节点对象存下来 —— 轮询会整体重建 graph。
     */
    menuNode() {
      if (!this.menu.visible || this.menu.nodeId === null) {
        return null;
      }
      const flow = this.currentFlow;
      if (!flow || flow.key !== this.menu.flowKey) {
        return null;
      }
      const hit = flow.graph.nodes.find((n) => n.id === this.menu.nodeId);
      return hit ? hit.node : null;
    },
    // 先收敛成字符串：轮询每次都会重建节点对象，直接依赖对象会让 menuItems 反复重算
    menuStatus() {
      return this.menuNode ? this.menuNode.aniStatus : "";
    },
    // 菜单项：状态 -> 菜单（唯一判定处在 nodeMenu.js）
    menuItems() {
      return buildNodeMenu(this.menuStatus, {
        projectRoleDisabled: this.isProjectRoleDisable,
      });
    },

    /* ------------------------- 画布自动滚动 ------------------------- */

    /**
     * 是否有「操作弹窗 / 右键菜单」开着。
     * 开着的时候一律不自动滚动 —— 用户正在对着某个节点做操作，
     * 这时候把视野挪走，等于把人正在看的东西搬走了。
     * 新增弹窗时**记得加进来**（判漏了不会报错，只会偶尔抢视野）。
     */
    anyDialogOpen() {
      return (
        this.menu.visible ||
        this.silence.visible ||
        this.detail.visible ||
        this.atomConfirm.visible ||
        this.sms.visible ||
        this.execUser.visible
      );
    },
    /**
     * 自动滚动要盯住的那个节点：**报错 > 执行中 > 待确认 > 挂起**。
     *
     * 这四档正好是「需要人看」的四种形态，顺序与 flowLayout.aggregateTone 的
     * AGG_TONE_PRIORITY **刻意保持一致** —— 这样环境 chip 圆点的颜色和画布会居中的那个节点
     * 指向同一件事，圆点变色时画布也一定跟着过去了，两边不会互相打脸。
     *
     * 报错 / 待确认 / 挂起这三档都会一直命中（状态不会自己消失），
     * 所以页面自然就「停在那儿」不再往下走，正好是用户要的效果。
     * 四档都没有（流还没开始 / 已经跑完）-> 返回 null，**不滚动**，保持用户当前视野。
     */
    autoScrollNode() {
      const flow = this.currentFlow;
      if (!flow || !flow.graph.nodes.length) {
        return null;
      }
      const pick = (tone) =>
        flow.graph.nodes.find((n) => statusTone(n.node.aniStatus) === tone) ||
        null;
      return (
        pick("bad") || pick("run") || pick("confirm") || pick("stop") || null
      );
    },
  },
  created() {
    this.incomingSys = String(this.$route.query.sys || "");
    this.incomingEnvs = parseEnvMeta(this.$route.query.envs);
    this.fetchAll({ silent: false });
    // 用户列表进页面就拉（用户要求）—— 「修改实施人」的指定用户下拉要用
    this.fetchUsers();
    this.startPolling();
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    // 右栏文档：初始为空（页面一进来不展示文档模块），
    // 等用户在「查看明细」里双击工单、接口回了文档才会出现 ——
    // iframe 的遮罩定时器由 watch.docUrl 统一负责（首次赋值 / 刷新 / 切 tab 都走它）。
  },
  beforeDestroy() {
    this.stopPolling();
    // 页面被销毁时明细弹窗的自动刷新也必须停 —— 否则定时器会跟着组件一起被丢掉引用
    this.stopDetailAutoRefresh();
    if (this.autoScrollSettleTimer) {
      clearTimeout(this.autoScrollSettleTimer);
      this.autoScrollSettleTimer = null;
    }
    if (this.docFrameTimer) {
      clearTimeout(this.docFrameTimer);
      this.docFrameTimer = null;
    }
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  },
  watch: {
    /*
      文档地址变了（首次拿到文档 / 刷新 / 切 tab）-> 重建 iframe + 重新盖「加载中」遮罩。
      放这里统一处理，是因为这三条路径最终都只改 docUrl 这一个值；
      iframe 的 src 没变时浏览器不会重新发请求，所以要换 key 把它整个重建一次。
    */
    docUrl() {
      this.resetDocFrame();
    },
    // 同一标签页内被再次传入新的 ids 时，重置轮询并重新拉取
    rawIds() {
      this.pollCount = 0;
      this.lastUpdatedAt = "";
      this.failedIds = [];
      this.results = [];
      this.selectedPlanId = null;
      this.selectedFlowKey = null;
      this.lastUserScrollAt = 0;
      this.closeMenu();
      this.closeSilence();
      this.closeDetail();
      // 换了另一批执行计划 -> 右栏那块文档属于**上一个**工单，一并收起来
      this.resetDocArea();
      this.fetchAll({ silent: false });
      this.startPolling();
    },
    // 选中的环境被换掉（用户点击 / 数据变化）时，流的选择要跟着重置
    selectedPlanId() {
      this.ensureFlowSelection();
      this.closeMenu();
      // 换环境是用户主动换视野：上一次的滚动记录不该继续压着自动滚动
      this.lastUserScrollAt = 0;
      this.scheduleAutoScroll();
    },
    /*
      切换流 = 换了一张图，必须重新定位。
      换图之后画布内容整体换掉，浏览器可能把 scrollTop 夹回范围内 ——
      所以这里不能只看「用户滚没滚过」，直接清零滚动记录，强制重新居中一次。
    */
    selectedFlowKey() {
      this.lastUserScrollAt = 0;
      this.scheduleAutoScroll();
    },
    // 菜单打开期间节点被刷没了（流被替换 / 计划失败被清空），收起菜单
    menuNode(node) {
      if (this.menu.visible && !node) {
        this.closeMenu();
      }
    },
  },
  methods: {
    /**
     * 拉取全部执行详情
     * @param {Boolean} silent 静默模式：不显示骨架屏、不重置 DOM，用于轮询
     */
    async fetchAll({ silent = false } = {}) {
      const ids = this.rawIds;
      if (!ids.length) {
        this.results = [];
        this.loading = false;
        return;
      }
      // 静默轮询时如果上一次还没回来，直接跳过本轮，避免请求堆叠
      if (silent && this.refreshing) {
        return;
      }

      const seq = ++this.reqSeq;
      if (silent) {
        this.refreshing = true;
      } else {
        this.loading = true;
      }

      try {
        const batch = await getExecuteIndexBatch(ids);
        // 已有更新的请求发出，丢弃本次结果
        if (seq !== this.reqSeq) {
          return;
        }
        const prevMap = new Map(
          this.results.map((item) => [item.aripExecPlanId, item])
        );
        // 单个计划失败时沿用上一次的数据，避免页面被局部清空
        //
        // ⚠️ 载荷统一走 pickPayload（详情可能在 data、也可能在 rows）。
        //    **这里是唯一的归一化入口**：下游 mergeWorkflows / 总体进度都只读 `item.data`。
        this.results = batch.map((item) => {
          if (!item.error) {
            return { ...item, data: pickPayload(item) };
          }
          const prev = prevMap.get(item.aripExecPlanId);
          return prev && prev.data
            ? { ...prev, stale: true, msg: item.msg }
            : item;
        });
        this.failedIds = batch
          .filter((item) => item.error)
          .map((item) => item.aripExecPlanId);
        this.pollCount += 1;
        this.lastUpdatedAt = nowClock();
      } catch (e) {
        if (seq === this.reqSeq) {
          this.failedIds = ids.slice();
        }
      } finally {
        if (seq === this.reqSeq) {
          this.loading = false;
          this.refreshing = false;
          // 数据换了一批 -> 选中的环境 / 流可能已经不存在了，兜一次
          this.ensureSelection();
          // 首屏 / 轮询都可能让「执行中」的节点换位置，渲染完再决定要不要跟过去
          this.scheduleAutoScroll();
        }
      }
    },

    /* --------------------------- 右栏文档信息 --------------------------- */

    /**
     * 文档 iframe 加载完成 -> 收掉「加载中」遮罩。
     *
     * ⚠️ 被 X-Frame-Options 拦掉时这个事件**照样会触发**（浏览器加载的是一张空白错误页），
     *    所以这里只负责收遮罩，不能当作「加载成功」的判据。
     */
    onDocFrameLoad() {
      this.docFrameLoaded = true;
      if (this.docFrameTimer) {
        clearTimeout(this.docFrameTimer);
        this.docFrameTimer = null;
      }
    },
    // 兜底：到点无条件收遮罩，避免加载失败时永远转圈（见 DOC_FRAME_TIMEOUT_MS 注释）
    startDocFrameTimer() {
      if (this.docFrameTimer) {
        clearTimeout(this.docFrameTimer);
      }
      this.docFrameTimer = setTimeout(() => {
        this.docFrameTimer = null;
        this.docFrameLoaded = true;
      }, DOC_FRAME_TIMEOUT_MS);
    },
    /**
     * 「查看明细」表格里**双击工单** -> 查该工单关联的自动发布文档。
     *
     * 顺序（用户要求）：双击工单 → 请求接口 → 拿到文档 → 关掉查看明细弹窗 → 右栏展出文档区。
     *
     * ⚠️ 接口没返回文档时**不关弹窗、也不展文档区**，只提示一句 ——
     *    否则用户会看到「弹窗关了、右边还是老样子」，不知道刚才那下双击到底发生了什么。
     * ⚠️ 文档区一旦展出就**留着**：再双击别的工单是整块替换（工单号 + files + 回到第 0 个 tab）。
     * @param {Object} payload { orderId, row } —— 由 AtomDetailDialog 抛上来
     */
    async onDetailOrderDblclick({ orderId }) {
      if (!orderId || this.docLoading) {
        return;
      }
      this.docLoading = true;
      try {
        const res = await queryAutoRate({ orderId });
        const data = pickPayload(res) || {};
        const files = Array.isArray(data.files) ? data.files : [];
        if (!files.length) {
          this.$modal.msgWarning(`工单 ${orderId} 没有关联的文档`);
          return;
        }
        this.docOrderId = data.order_id || orderId;
        this.docFiles = files;
        this.docActiveIndex = 0;
        // 关掉「查看明细」—— 右栏文档区随之展出（docVisible 看的就是 docFiles）
        this.closeDetail();
      } catch (e) {
        console.error("[工单文档] query_auto_rate 请求失败", e);
        this.$modal.msgError((e && e.message) || "查询工单文档失败");
      } finally {
        this.docLoading = false;
      }
    },

    /**
     * 清空右栏文档区，回到「流独占整宽」。
     *
     * 目前只有一个调用点：同一标签页里被再次传入新的 ids（换了另一批执行计划）——
     * 那块文档属于上一个工单，留着就是错的。
     * ⚠️ 顺手把兜底定时器也清掉：文档区都没了，遮罩定时器再跑就是野定时器。
     */
    resetDocArea() {
      if (this.docFrameTimer) {
        clearTimeout(this.docFrameTimer);
        this.docFrameTimer = null;
      }
      this.docOrderId = "";
      this.docFiles = [];
      this.docActiveIndex = 0;
    },

    /**
     * 切换文档 tab。
     * 只改下标：docUrl 一变，watch.docUrl 会重建 iframe 并重新盖遮罩。
     */
    selectDoc(index) {
      if (index === this.docActiveIndex || !this.docFiles[index]) {
        return;
      }
      this.docActiveIndex = index;
    },

    /**
     * tab 上的文案。
     *
     * 文件名是 `<工单号>_<时间戳>.html`，很长 —— tab 位置窄，把「工单号_」前缀去掉
     * （工单号在上方已经单独显示过一遍），只留时间戳 + 扩展名，多个文档才分得清。
     * 前缀对不上（后端换了命名规则）就原样显示全名，别硬切。
     */
    docTabLabel(file) {
      const name = (file && file.file_name) || "";
      if (!name) {
        return "文档";
      }
      const prefix = this.docOrderId ? this.docOrderId + "_" : "";
      return prefix && name.indexOf(prefix) === 0
        ? name.slice(prefix.length)
        : name;
    },

    /**
     * 重建 iframe + 重新盖「加载中」遮罩。
     *
     * 这是「刷新」和「切 tab」的唯一落点（watch.docUrl 也走它）：
     * src 没变时浏览器不会重新发请求，所以必须换 key 把 iframe 整个重建一次。
     */
    resetDocFrame() {
      if (!this.docUrl) {
        return;
      }
      this.docFrameLoaded = false;
      this.docFrameKey += 1;
      this.startDocFrameTimer();
      // 换文档后把横向位置拉回最左：上一份文档横拉到的位置对这份没有意义，
      // 而且「加载中」遮罩是跟着内容滚的（只盖住 scrollLeft = 0 那一段）。
      this.resetDocScroll();
    },

    /**
     * 文档视口的横向滚动位置归零。
     *
     * ⚠️ 视口比容器宽（见 .esp-doc__frame 注释），滚的是**父容器**，不是 iframe 内部 ——
     *    所以这里改的是 ref 上的 scrollLeft，不是 contentWindow.scrollTo（跨源根本拿不到）。
     */
    resetDocScroll() {
      const el = this.$refs.docFrame;
      if (!el) {
        return;
      }
      el.scrollLeft = 0;
      el.scrollTop = 0;
    },
    // 兜底出口：iframe 嵌不出来（多半是被 X-Frame-Options 拦了）时，让用户能直接看原文
    openDocInNewTab() {
      if (!this.docUrl) {
        return;
      }
      window.open(this.docUrl, "_blank");
    },

    /* --------------------------- 两级选择器 --------------------------- */

    /**
     * 兜住选中态：数据每次刷新后都调一次。
     *
     * 为什么必须兜：轮询会把 results 整批换掉，用户当前选中的环境 / 流有可能
     * 在新数据里已经不存在（计划被换掉、流被取消后后端不再返回），
     * 这时 currentFlow 会变成 null、左栏一片空白，看着像页面坏了。
     */
    ensureSelection() {
      const envs = this.envList;
      if (!envs.length) {
        this.selectedPlanId = null;
        this.selectedFlowKey = null;
        return;
      }
      // 环境没了（或第一次进来）-> 落到第一个
      if (!envs.some((e) => String(e.planId) === String(this.selectedPlanId))) {
        this.selectedPlanId = envs[0].planId;
      }
      this.ensureFlowSelection();
    },

    /** 流的选择：当前环境下的第一条；已有且仍存在则保留 */
    ensureFlowSelection() {
      const flows = this.envFlows;
      if (!flows.length) {
        this.selectedFlowKey = null;
        return;
      }
      if (!flows.some((f) => f.key === this.selectedFlowKey)) {
        this.selectedFlowKey = flows[0].key;
      }
    },

    isActiveEnv(env) {
      return String(env.planId) === String(this.selectedPlanId);
    },
    isActiveFlow(flow) {
      return flow.key === this.selectedFlowKey;
    },
    // 环境块悬停提示：光看环境名看不出是哪条计划
    envTitle(env) {
      const lines = [
        `环境：${env.env || "—"}`,
        `计划：${env.planName || "—"}`,
        `执行计划 ID：${env.planId}`,
        env.status ? `计划状态：${this.statusText(env.status)}` : "",
        env.loaded ? `${env.flowCount} 条流` : "详情加载中…",
        // 圆点配色的依据：该环境下所有流的节点状态分布
        this.envNodeDistText(env),
      ];
      if (env.planStart || env.planEnd) {
        lines.push(`计划时间：${env.planStart || "—"} → ${env.planEnd || "—"}`);
      }
      if (env.stale) {
        lines.push("（本轮刷新失败，展示的是上一次的数据）");
      }
      return lines.filter(Boolean).join("\n");
    },
    // 点环境：watch(selectedPlanId) 会把流切到该环境的第一条
    selectEnv(env) {
      this.selectedPlanId = env.planId;
    },
    selectFlow(flow) {
      this.selectedFlowKey = flow.key;
      this.closeMenu();
    },
    /**
     * 环境 chip 悬停里的「节点状态：执行中 2 · 成功 12 · 失败 1」一行。
     * 中文一律走字典（this.statusText），本文件不维护状态中文表 ——
     * 否则字典一改，这里就成了第二份会漂移的真值。
     * 排序按 TONE_ORDER（越需要人看的越靠前），同 tone 内按状态值字典序，保证顺序稳定。
     */
    envNodeDistText(env) {
      const counts = env.nodeStatusCount || {};
      const values = Object.keys(counts);
      if (!values.length) {
        return "";
      }
      values.sort((a, b) => {
        const ta = TONE_ORDER.indexOf(statusTone(a));
        const tb = TONE_ORDER.indexOf(statusTone(b));
        return ta === tb ? String(a).localeCompare(String(b)) : ta - tb;
      });
      return (
        `节点状态：` +
        values.map((v) => `${this.statusText(v)} ${counts[v]}`).join(" · ")
      );
    },

    /* --------------------------- 画布自动滚动 --------------------------- */
    /*
      目标：把「需要人看」的节点带到画布视野中间，用户不用自己追着滚。
      三条约束（用户明确要求）：
        ① 用户自己滚过之后 20 秒内不动视野（AUTO_SCROLL_HOLD_MS）—— 别和用户抢滚动条
        ② 目标节点按 报错 > 执行中 > 待确认 > 挂起 挑（见 autoScrollNode）
        ③ 操作弹窗 / 右键菜单开着时不动（见 anyDialogOpen）

      怎么区分「用户滚的」和「程序滚的」——**只看输入事件，不看 scroll 事件**：
        滚轮 / 触摸 / 键盘 / 拖滚动条 都是人的动作，直接记时间戳；
        程序化平滑滚动和「内容变化导致浏览器夹 scrollTop」产生的 scroll 事件不记。
        这条很关键：轮询每 3 秒刷新一次内容，如果按 scroll 事件记，
        每次刷新都可能被误判成「用户刚滚过」，自动滚动就永远冻着不动了。
    */

    /** 用户主动滚动：滚轮 / 触摸 / 键盘（画布拿到焦点时） */
    markUserScroll() {
      this.lastUserScrollAt = Date.now();
    },
    /**
     * 键盘滚动也算用户主动滚动 —— 但只认**真的会滚动**的那几个键。
     * 画布拿到焦点时按 Tab / 字母键也会冒 keydown，那不该把自动滚动冻 20 秒。
     */
    onCanvasKeydown(e) {
      const keys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
        "Spacebar",
      ];
      if (keys.indexOf(e.key) !== -1) {
        this.markUserScroll();
      }
    },
    /**
     * 拖滚动条也算用户主动滚动。
     * mousedown 落在「元素 padding box 之外、offset 之内」的那条就是滚动条：
     * offsetWidth - clientWidth = 纵向滚动条宽，offsetHeight - clientHeight = 横向滚动条高。
     * 用 clientX/clientY 相对 rect 算，不依赖 e.target —— 点在滚动条上时 target 才是容器本身。
     */
    onCanvasMousedown(e) {
      const el = e.currentTarget;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const barW = el.offsetWidth - el.clientWidth;
      const barH = el.offsetHeight - el.clientHeight;
      const onVBar = barW > 0 && x >= el.clientWidth;
      const onHBar = barH > 0 && y >= el.clientHeight;
      if (onVBar || onHBar) {
        this.markUserScroll();
      }
    },
    /**
     * 数据变了之后排一次自动滚动。
     * 必须等 $nextTick：图是 computed 算出来的，DOM 要等这一轮渲染完才更新，
     * 提前量的话读到的是旧的 scrollHeight / 旧的节点坐标。
     */
    scheduleAutoScroll() {
      this.$nextTick(() => this.autoScrollToFocusNode());
    },
    /**
     * 把 autoScrollNode 那个节点滚到视野中间。
     * 纵向为主（简版的流程图是**从上到下**的，纵向才是主轴）。
     * 任何一条约束不满足就直接返回，什么都不做 —— 静默让位，不提示、不闪烁。
     */
    autoScrollToFocusNode() {
      const canvas = this.$refs.flowCanvas;
      if (!canvas) {
        return;
      }
      // ② 弹窗 / 菜单开着：不抢视野
      if (this.anyDialogOpen) {
        return;
      }
      // ③ 用户 20 秒内自己滚过：让位
      if (Date.now() - this.lastUserScrollAt < AUTO_SCROLL_HOLD_MS) {
        return;
      }
      const target = this.autoScrollNode;
      if (!target) {
        return;
      }
      const graphEl = canvas.querySelector(".flow-graph");
      if (!graphEl) {
        return;
      }
      // 把 .flow-graph 顶边换算到画布的滚动坐标系里（画布有 padding，不能直接拿 offsetTop）
      const canvasRect = canvas.getBoundingClientRect();
      const graphRect = graphEl.getBoundingClientRect();
      const graphTop = graphRect.top - canvasRect.top + canvas.scrollTop;
      // 节点是绝对定位在 .flow-graph 里的，y/h 就是它相对图顶边的坐标
      const nodeCenter = graphTop + target.y + target.h / 2;
      const max = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
      const top = Math.max(
        0,
        Math.min(max, Math.round(nodeCenter - canvas.clientHeight / 2))
      );
      // 已经在差不多的位置（目标没动）-> 不动，免得每轮轮询都蠕一下
      if (Math.abs(top - canvas.scrollTop) < AUTO_SCROLL_MIN_DELTA) {
        return;
      }

      canvas.scrollTo({ top, behavior: "smooth" });
      if (this.autoScrollSettleTimer) {
        clearTimeout(this.autoScrollSettleTimer);
      }
      this.autoScrollSettleTimer = setTimeout(() => {
        this.autoScrollSettleTimer = null;
        const el = this.$refs.flowCanvas;
        if (el && Math.abs(el.scrollTop - top) > 2) {
          this.lastUserScrollAt = Date.now();
        }
      }, AUTO_SCROLL_SETTLE_MS);
    },

    /* --------------------------- 轮询控制 --------------------------- */

    startPolling() {
      this.stopPolling();
      if (!this.pollEnabled) {
        return;
      }
      this.timer = setInterval(() => {
        this.fetchAll({ silent: true });
      }, POLL_INTERVAL);
    },

    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },

    // 暂停 / 继续自动刷新
    togglePolling() {
      this.pollEnabled = !this.pollEnabled;
      if (this.pollEnabled) {
        this.fetchAll({ silent: true });
        this.startPolling();
      } else {
        this.stopPolling();
      }
    },

    // 手动刷新：立刻拉一次，但不影响自动轮询的计时
    refreshNow() {
      if (this.refreshing) {
        return;
      }
      this.fetchAll({ silent: true });
    },

    // 页面切到后台时停止轮询，切回来立即补一次再恢复
    onVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (this.pollEnabled) {
          this.fetchAll({ silent: true });
          this.startPolling();
        }
      } else {
        this.stopPolling();
      }
    },

    clock(value) {
      return toClock(value);
    },
    statusText(status) {
      // 只认字典；字典没到位就显示状态值本身
      return this.statusLabels[status] || status || "—";
    },
    toneOf(status) {
      return statusTone(status);
    },

    /* ---------------------- 节点右键菜单：打开 / 关闭 ---------------------- */

    onNodeMenu(payload, flow) {
      this.menu = {
        visible: true,
        x: payload.event.clientX,
        y: payload.event.clientY,
        // 用流上的 planId（来自 executeIndex 的 data.aripExecPlanId），
        // 比节点自带的 aripExecPlanId 更可靠
        planId: flow.planId,
        flowKey: flow.key,
        nodeId: payload.nodeId,
      };
    },

    closeMenu() {
      if (!this.menu.visible) {
        return;
      }
      this.menu = { ...MENU_CLOSED };
    },

    /**
     * 双击节点 -> 按节点类型分流：
     *   人工确认节点 -> 弹「原子确认」小弹窗；
     *   其余节点     -> 直接走「查看明细」，与右键 -> 查看明细**完全同一条路**。
     *
     * ⚠️ 判的是**节点类型**（英文 `HUMAN_CONFIRM`），不是原子名 —— 详见 ./nodeKind。
     */
    onNodeDblclick(payload, flow) {
      const nodeId = payload && payload.nodeId;
      const node = payload && payload.node;
      if (!node) {
        return;
      }
      const ctx = {
        planId: flow && flow.planId,
        flowKey: flow && flow.key,
        nodeId,
        node,
      };
      if (isHumanConfirmNode(node)) {
        this.openAtomConfirm(ctx);
        return;
      }
      this.actNodeDetail(ctx);
    },

    /* ---------------------- 节点右键菜单：动作分发 ---------------------- */

    /**
     * 菜单项点击 -> 分发到对应动作。
     * 先取上下文再关菜单：菜单一关 menuNode 就变 null，动作就拿不到节点了。
     */
    onMenuSelect(item) {
      const ctx = {
        planId: this.menu.planId,
        flowKey: this.menu.flowKey,
        nodeId: this.menu.nodeId,
        node: this.menuNode,
      };
      this.closeMenu();
      switch (item.fnName) {
        case "atomFnc":
          this.actNodeDetail(ctx);
          break;
        case "stopIt":
          this.actNodeStop(ctx);
          break;
        case "cancelIt":
          this.actNodeCancel(ctx);
          break;
        case "recover":
          this.actNodeRecover(ctx);
          break;
        case "quietness":
          this.actNodeSilence(ctx);
          break;
        default:
          this.$modal.msgWarning(`未识别的节点操作：${item.fnName}`);
      }
    },

    // 查看明细
    async actNodeDetail(ctx) {
      const { nodeId, node } = ctx;
      if (!node) {
        return;
      }
      // 表格里每一格都来自这个接口，不从节点自带的 atoms[] 里兜 ——
      // 所以先开弹窗（表格空着 + 「正在加载明细…」），数据回来再填。
      this.detail = {
        ...DETAIL_CLOSED,
        visible: true,
        nodeId,
        node,
        loading: true,
      };
      try {
        const res = await this.fetchDetailAtoms(nodeId, node);
        // 弹窗可能已经被关掉、或换成了别的节点 —— 过期响应直接丢
        if (!this.detail.visible || this.detail.nodeId !== nodeId) {
          return;
        }
        const atoms = pickPayload(res);
        this.detail.atoms = Array.isArray(atoms) ? atoms : [];
        this.detail.loading = false;
      } catch (e) {
        if (!this.detail.visible || this.detail.nodeId !== nodeId) {
          return;
        }
        // 表格本体还在（只是空的），弹窗留着并把原因显示出来，比一闪而过强
        this.detail.loading = false;
        this.detail.error = (e && e.message) || "查询原子明细失败";
        console.error("[查看明细] 请求失败", e);
        this.$modal.msgError(this.detail.error);
      }
    },

    /**
     * 拉一次节点下的原子明细 —— 明细接口的**唯一请求入口**。
     *
     * 用户要求：把明细接口的原始返回打到控制台，方便核对字段。
     * 刻意不做 JSON.stringify —— 浏览器控制台里直接展开对象更好读，这行**不要删**。
     */
    async fetchDetailAtoms(nodeId, node) {
      const res = await queryAotmOfNode({ aniInstanceNodeId: nodeId, node });
      console.log("[查看明细] queryAotmOfNode 返回：", res);
      return res;
    },

    /**
     * 只重新拉一次明细，不动弹窗的开合状态 —— 「确认完成」成功后用它刷新表格。
     * @param {Object} [options]
     * @param {Boolean} [options.withLoading=false]
     *   「函数批量跳过」成功后用它（用户要求批量跳过后刷新要带 loading）。
     */
    async reloadDetailAtoms({ withLoading = false } = {}) {
      const { nodeId, node } = this.detail;
      if (!nodeId) {
        return;
      }
      if (withLoading) {
        this.detail.loading = true;
      }
      try {
        const res = await this.fetchDetailAtoms(nodeId, node);
        // 期间弹窗可能被关掉 / 换成了别的节点 —— 过期响应直接丢
        if (!this.detail.visible || this.detail.nodeId !== nodeId) {
          return;
        }
        const atoms = pickPayload(res);
        this.detail.atoms = Array.isArray(atoms) ? atoms : [];
      } catch (e) {
        if (withLoading) {
          this.detail.loading = false;
        }
        console.error("[查看明细] 刷新失败", e);
        this.$modal.msgError((e && e.message) || "查询原子明细失败");
      } finally {
        if (withLoading) {
          this.detail.loading = false;
        }
      }
    },

    /* ---------------- 查看明细弹窗：自动刷新 ---------------- */

    /**
     * 自动刷新的一拍：重拉一次当前节点的明细。
     * 两个守卫：① 弹窗已经关了 -> 兜底停表；② 上一拍还没回来 -> 跳过这一拍，别堆请求。
     */
    async refreshDetailTick() {
      if (!this.detail.visible) {
        this.stopDetailAutoRefresh();
        return;
      }
      if (this.detailRefreshing) {
        return;
      }
      this.detailRefreshing = true;
      try {
        // reloadDetailAtoms 自己吞异常（失败弹 msgError），这里 await 不会 reject
        await this.reloadDetailAtoms({ withLoading: true });
      } finally {
        this.detailRefreshing = false;
      }
    },

    /**
     * 开自动刷新：先立刻刷一次，再挂定时器。
     * 开头先 stop 一次：连点 / 重复开的时候保证**只有一个**定时器在跑。
     */
    startDetailAutoRefresh() {
      if (!this.detail.visible) {
        return;
      }
      this.stopDetailAutoRefresh();
      this.detailAutoRefresh = true;
      this.refreshDetailTick();
      this.detailTimer = setInterval(() => {
        this.refreshDetailTick();
      }, DETAIL_POLL_INTERVAL);
    },

    /**
     * 停自动刷新：清定时器 + 关开关。
     * **不动 `detailRefreshing`** —— 它的语义是「有一拍正在飞」，由那一拍自己的 finally 复位。
     */
    stopDetailAutoRefresh() {
      if (this.detailTimer) {
        clearInterval(this.detailTimer);
        this.detailTimer = null;
      }
      this.detailAutoRefresh = false;
    },

    /** 弹窗右上角「刷新 / 停止刷新」：来回切 */
    toggleDetailAutoRefresh() {
      if (this.detailAutoRefresh) {
        this.stopDetailAutoRefresh();
      } else {
        this.startDetailAutoRefresh();
      }
    },

    /** 明细弹窗里点「确认完成」（人工确认类原子）-> PUT /release/atomInstance */
    onAtomConfirm({ par }) {
      return this.submitAtom("confirm", par);
    },

    /** 明细弹窗里点「跳过」-> POST /release/executeIndex/updateAtomStatus */
    onAtomSkip({ par }) {
      return this.submitAtom("skip", par);
    },

    /**
     * 原子操作（确认完成 / 跳过）的公共流程。
     * 链路：弹窗先 $confirm 二次确认 -> 这里调接口 -> 成功后**重新拉一次明细**拿最新状态。
     */
    async submitAtom(action, par) {
      if (this.detail.submitting) {
        return;
      }
      const { api, label } = ATOM_ACTIONS[action];
      this.detail.submitting = {
        aaiInstanceAtomId: par && par.aaiInstanceAtomId,
        action,
      };
      try {
        await api(par);
        this.$modal.msgSuccess("操作成功");
        // 表格数据全部来自接口，操作成功后必须重新拉一次才能看到新状态
        await this.reloadDetailAtoms();
      } catch (e) {
        console.error(`[${label}] 请求失败`, e);
        this.$modal.msgError((e && e.message) || `${label}失败`);
      } finally {
        this.detail.submitting = null;
      }
    },

    /**
     * 节点动作的共用链路：右键菜单里点「暂停 / 取消节点 / 恢复」 -> 二次确认
     *   -> POST updateNodeStatus -> 成功后**重置轮询**（杀旧定时器 + 立刻拉一次 +
     *   重启新定时器），让新状态立刻反映到节点卡片上。
     */
    async submitNodeStatusAction(ctx, label, operation) {
      const nodeName =
        (ctx.node && ctx.node.aniInstanceNodeName) || `节点 ${ctx.nodeId}`;
      if (!ctx.nodeId) {
        return;
      }
      try {
        await this.$confirm(`确定${label}名称为${nodeName}的节点吗？`, "提示", {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        });
      } catch (e) {
        // 用户点了取消 / 关闭，什么都不做
        return;
      }
      try {
        await updateNodeStatus({
          aniInstanceNodeId: ctx.nodeId,
          operation,
        });
        this.$modal.msgSuccess("操作成功");
        // 重置轮询：先杀旧定时器，立刻拉一次拿到新状态，再启动一个干净的 3s 周期
        this.stopPolling();
        await this.fetchAll({ silent: true });
        this.startPolling();
      } catch (e) {
        console.error(`[${label}] 请求失败`, e);
        this.$modal.msgError((e && e.message) || `${label}失败`);
        // 失败不重置定时器 —— 旧定时器还在跑，下一轮轮询自然会拿一次最新状态
      }
    },
    // 暂停
    actNodeStop(ctx) {
      return this.submitNodeStatusAction(ctx, "暂停", "STOP");
    },
    // 取消节点
    actNodeCancel(ctx) {
      return this.submitNodeStatusAction(ctx, "取消节点", "CANCELLED");
    },
    // 恢复
    actNodeRecover(ctx) {
      return this.submitNodeStatusAction(ctx, "恢复", "RECOVER");
    },
    // 设置静默
    actNodeSilence(ctx) {
      this.openSilence(ctx);
    },

    /**
     * 流动作的共用链路：流头部按钮 → 二次确认 → POST updateWorkflowStatus
     *   → 成功后**重置轮询**。与 submitNodeStatusAction 是「孪生兄弟」。
     */
    async submitWorkflowStatusAction(flow, label, operation) {
      const workflowName =
        flow.awiWorkflowInstanceName || flow.name || `工作流 ${flow.flowIndex}`;
      const workflowId = flow.awiWorkflowInstanceId;
      if (workflowId === undefined || workflowId === null || workflowId === "") {
        // 没有真实 id 时不调接口（mergeWorkflows 在 awiWorkflowInstanceId 缺失时
        // 用 index 顶 key，但接口入参必须用真实 id —— 没真实 id 就不让点）
        this.$modal.msgWarning(`无法${label}工作流：缺少工作流 ID`);
        return;
      }
      try {
        await this.$confirm(
          `确定${label}名称为${workflowName}的工作流吗？`,
          "提示",
          {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
          }
        );
      } catch (e) {
        return;
      }
      try {
        await updateWorkflowStatus({
          awiWorkflowInstanceId: workflowId,
          operation,
        });
        this.$modal.msgSuccess("操作成功");
        this.stopPolling();
        await this.fetchAll({ silent: true });
        this.startPolling();
      } catch (e) {
        console.error(`[${label} 工作流] 请求失败`, e);
        this.$modal.msgError((e && e.message) || `${label}失败`);
      }
    },
    // 流 → 取消（INIT / READY）
    flowCancel(flow) {
      return this.submitWorkflowStatusAction(flow, "取消", "CANCELLED");
    },
    // 流 → 暂停（RUNNING）
    flowStop(flow) {
      return this.submitWorkflowStatusAction(flow, "暂停", "STOP");
    },
    // 流 → 恢复（STOP）
    flowRecover(flow) {
      return this.submitWorkflowStatusAction(flow, "恢复", "RECOVER");
    },

    /* ------------------------- 查看明细 ------------------------- */

    /**
     * 明细弹窗里存的是打开那一刻的节点快照 —— 轮询会整体重建节点对象，
     * 但弹窗是「看一眼」的场景，不需要跟着轮询跳动，所以不做实时联动。
     */
    closeDetail() {
      // 关弹窗必须停掉自动刷新的定时器（用户要求）—— 放在最前面
      this.stopDetailAutoRefresh();
      if (!this.detail.visible) {
        return;
      }
      this.detail = { ...DETAIL_CLOSED };
    },

    /* ------------------- 人工节点双击：「原子确认」小弹窗 ------------------- */

    /**
     * 打开「原子确认」小弹窗。
     * 与 actNodeDetail 同构：**先开弹窗（带 loading），原子明细回来再填**。
     */
    async openAtomConfirm({ nodeId, node }) {
      this.atomConfirm = {
        ...ATOM_CONFIRM_CLOSED,
        visible: true,
        nodeId,
        node,
        loading: true,
      };
      try {
        const res = await this.fetchDetailAtoms(nodeId, node);
        // 弹窗可能已经被关掉、或换成了别的节点 —— 过期响应直接丢
        if (!this.atomConfirm.visible || this.atomConfirm.nodeId !== nodeId) {
          return;
        }
        const atoms = pickPayload(res);
        this.atomConfirm.atoms = Array.isArray(atoms) ? atoms : [];
        this.atomConfirm.loading = false;
      } catch (e) {
        if (!this.atomConfirm.visible || this.atomConfirm.nodeId !== nodeId) {
          return;
        }
        this.atomConfirm.loading = false;
        console.error("[原子确认] 请求失败", e);
        this.$modal.msgError((e && e.message) || "查询原子明细失败");
      }
    },

    closeAtomConfirm() {
      if (!this.atomConfirm.visible) {
        return;
      }
      this.atomConfirm = { ...ATOM_CONFIRM_CLOSED };
    },

    /**
     * 「原子确认」里点「确认完成」。
     * 与明细弹窗里的「确认完成」**是同一个接口、同一套入参**（ATOM_ACTIONS.confirm）。
     */
    async submitAtomConfirm() {
      const atom = this.atomConfirm.atoms[0];
      if (!atom || this.atomConfirm.submitting) {
        return;
      }
      const { api, label } = ATOM_ACTIONS.confirm;
      this.atomConfirm.submitting = true;
      try {
        await api({
          aaiInstanceAtomId: atom.aaiInstanceAtomId,
          aaiAtomStatus: "SUCCESS",
        });
        this.$modal.msgSuccess("操作成功");
        this.atomConfirm = { ...ATOM_CONFIRM_CLOSED };
        // 明细弹窗没开时 reloadDetailAtoms 会直接返回，不用额外判断
        await this.reloadDetailAtoms();
      } catch (e) {
        console.error(`[${label}] 请求失败`, e);
        this.$modal.msgError((e && e.message) || `${label}失败`);
      } finally {
        this.atomConfirm.submitting = false;
      }
    },

    /* ------------------------- 修改实施人 ------------------------- */

    /**
     * 拉全部用户（「修改实施人」的指定用户下拉）。
     * 在 `created` 里调一次就够 —— 用户列表跟计划/轮询都无关，不用跟着刷新。
     */
    async fetchUsers() {
      if (this.usersLoading) {
        return;
      }
      this.usersLoading = true;
      try {
        const res = await listAllUser();
        // 若依分页接口的列表在 `rows`，但别写死 —— 也可能在 `data`（见 pickPayload）
        const rows = pickPayload(res);
        // 只留弹窗真正要用的三个字段，顺带把脏行滤掉（缺 userId 的行当 key 会撞）
        this.users = (Array.isArray(rows) ? rows : [])
          .filter((u) => u && u.userId !== undefined && u.userId !== null)
          .map((u) => ({
            userId: u.userId,
            userName: u.userName || "",
            nickName: u.nickName || u.userName || "",
          }));
      } catch (e) {
        console.error("[修改实施人] 查询用户列表失败", e);
        this.$modal.msgError((e && e.message) || "查询用户列表失败");
      } finally {
        this.usersLoading = false;
      }
    },

    /**
     * 打开「修改实施人」弹窗。
     * **不要求本页有工单** —— 工单号是用户在弹窗里自己填的（用户要求）。
     */
    openExecUser() {
      if (this.execUser.submitting) {
        return;
      }
      this.execUser = { ...EXEC_USER_CLOSED, visible: true };
    },

    closeExecUser() {
      if (!this.execUser.visible) {
        return;
      }
      this.execUser = { ...EXEC_USER_CLOSED };
    },

    /**
     * 提交「修改实施人」。
     * 请求体的四个字段（用户明确指定，别自己「理顺」）：
     *   orderId   工单号**数组**（弹窗里用户自己填的，已按逗号拆分去重）
     *   user      选中用户的 **userName**（登录名）
     *   username  选中用户的 **nickName**（中文名）—— 和上面那个名字容易搞反，但接口就是这样
     *   updateBy  当前登录用户的 userName（`state.user.name`）
     */
    async submitExecUser({ orderIds, userName, nickName }) {
      if (!orderIds || !orderIds.length || this.execUser.submitting) {
        return;
      }
      this.execUser.submitting = true;
      try {
        const res = await changeExecUser({
          orderId: orderIds,
          user: userName,
          username: nickName,
          updateBy: this.updateBy,
        });
        this.closeExecUser();
        // 文案优先用载荷里的那句「…工单实施人更新至xxx成功」（比 msg 的「成功」有用）；
        // 但这里**只认字符串** —— 万一后端在 rows 里回了数组/对象，
        // 直接塞给 $modal 会显示成 [object Object]，不如回落成 msg。
        const text = pickPayload(res);
        this.$modal.msgSuccess(
          typeof text === "string" && text
            ? text
            : (res && res.msg) || "操作成功"
        );
      } catch (e) {
        // 失败保留弹窗，让用户改完直接重试
        this.execUser.submitting = false;
        console.error("[修改实施人] 提交失败", e);
        this.$modal.msgError((e && e.message) || "修改实施人失败");
      }
    },

    /* ------------------------- 设置消息推送 ------------------------- */

    /**
     * 打开「设置消息推送」弹窗。
     * 顺序是**先查、后开**（用户要求）：查回来的 send / groupId 直接当弹窗初值。
     * planId 传**本页全部** aripExecPlanId 组成的数组（页面级设置）。
     * 查失败就**不开弹窗** —— 拿不到当前状态的话，用户看到的初值是假的。
     */
    async openSmsSetting() {
      const planIds = this.rawIds.slice();
      if (!planIds.length || this.sms.querying) {
        return;
      }
      this.sms.querying = true;
      try {
        const res = await getPlanExtraInfo(planIds);
        // 载荷可能在 data、也可能在 rows（见 pickPayload）——
        // 别写成 `res.data.nodeFinishedSms`，那样接口换到 rows 时会直接 TypeError
        const payload = pickPayload(res);
        const nodeFinishedSms = (payload && payload.nodeFinishedSms) || null;
        if (!nodeFinishedSms) {
          throw new Error("查询消息推送状态失败：返回里没有 nodeFinishedSms");
        }
        this.sms = {
          ...SMS_CLOSED,
          visible: true,
          sendOn: isSmsSendOn(nodeFinishedSms.send),
          groupId:
            nodeFinishedSms.groupId === null ||
            nodeFinishedSms.groupId === undefined
              ? 0
              : nodeFinishedSms.groupId,
        };
      } catch (e) {
        console.error("[设置消息推送] 查询状态失败", e);
        this.$modal.msgError((e && e.message) || "查询消息推送状态失败");
      } finally {
        this.sms.querying = false;
      }
    },

    closeSmsSetting() {
      if (!this.sms.visible) {
        return;
      }
      this.sms = { ...SMS_CLOSED };
    },

    /**
     * 提交「设置消息推送」。
     * 弹窗给的是布尔（sendOn），接口要的是 'Y' / 'N' —— 翻译放在这一层。
     * 成功后直接关弹窗：接口的 data 是 null，拿不到落库后的真值，所以**不在本地假装已生效**。
     */
    async submitSmsSetting({ sendOn, groupId }) {
      const planIds = this.rawIds.slice();
      if (!planIds.length || this.sms.submitting) {
        return;
      }
      this.sms.submitting = true;
      try {
        await setNodeFinishSms({
          planId: planIds,
          sendFlag: sendOn ? SMS_SEND_ON : SMS_SEND_OFF,
          groupId,
        });
        this.closeSmsSetting();
        this.$modal.msgSuccess("设置成功");
      } catch (e) {
        // 失败保留弹窗，让用户改完直接重试
        this.sms.submitting = false;
        console.error("[设置消息推送] 提交失败", e);
        this.$modal.msgError((e && e.message) || "设置消息推送失败");
      }
    },

    /* ------------------------- 设置静默 ------------------------- */

    openSilence(ctx) {
      if (!ctx.node) {
        return;
      }
      this.silence = {
        visible: true,
        planId: ctx.planId,
        nodeId: ctx.nodeId,
        submitting: false,
      };
    },

    closeSilence() {
      if (!this.silence.visible) {
        return;
      }
      this.silence = { ...SILENCE_CLOSED };
    },

    /**
     * 提交静默设置
     * @param {Number} delayMin 静默时长（分钟），已由弹窗校验过是 0~1440 的整数。
     *                          0 表示取消静默，此时节点上的静音图标会消失。
     */
    async submitSilence(delayMin) {
      const { planId, nodeId } = this.silence;
      if (
        planId === null ||
        planId === undefined ||
        nodeId === null ||
        nodeId === undefined
      ) {
        return;
      }
      this.silence.submitting = true;
      try {
        await addNodeDelayParams({ planId, nodeId, delayMin });
        this.closeSilence();
        this.$modal.msgSuccess(
          delayMin === 0 ? "已取消静默" : `已设置静默 ${delayMin} 分钟`
        );
        // 立刻拉一次，让节点上的静音图标马上出现 / 消失，不用干等下一个轮询周期
        this.fetchAll({ silent: true });
      } catch (e) {
        // 失败保留弹窗，让用户改完直接重试
        this.silence.submitting = false;
        this.$modal.msgError((e && e.message) || "设置静默失败");
      }
    },
  },
};

// 'HH:MM:SS'
function nowClock() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 把接口里的计数字段（finishedNodeNums / totalNodeNums）收敛成安全的非负整数。
 * 缺失 / 字符串 / NaN / 负数一律按 0 计：进度是「先求和再相除」，
 * 一个 NaN 会顺着 reduce 污染整条进度（NaN% 的宽度会让进度块直接消失）。
 */
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// 兼容 ids=1,2,3 与 ids=1&ids=2 两种传参形式
function parseIds(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || "").split(",");
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const id = Number(String(item).trim());
    if (!id || Number.isNaN(id) || seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push(id);
  });
  return result;
}

/**
 * 解析 URL 带过来的环境元信息（`envs` 参数）。
 *
 * 这是「变更计划列表」页在开新标签页时顺手捎过来的一份**精简**副本：
 *   [{ planId: 75898, env: 'prod', planName: 'ACT_prod_2026-08-07' }, ...]
 *
 * 为什么明明接口里也有这些字段还要传：详情是并发请求回来的，首屏那 200~300ms
 * 第一行的环境块会空着；有了这份副本，环境名可以先撑住，用户不会对着一片空白。
 * **它只是占位**：接口回来后一律以接口数据为准（见 envList），
 * 所以哪怕参数被截断、编码坏了，最坏也只是首屏少显示几个环境名，不影响功能。
 *
 * 解析失败一律返回空数组 —— 这是纯展示用途的兜底数据，不值得让它把页面搞崩。
 */
function parseEnvMeta(raw) {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item) => item && item.planId !== undefined && item.planId !== null
      )
      .map((item) => ({
        planId: item.planId,
        env: item.env || "",
        planName: item.planName || "",
      }));
  } catch (e) {
    return [];
  }
}
</script>

<style lang="scss" scoped>
/* 7 个状态配色（主色 / 浅底），与 FlowGraph.vue 的 $tone-colors 保持一致 */
$tone-colors: (
  init: (
    #71849d,
    #f2f5f9,
  ),
  run: (
    #2b7fd4,
    #ecf5fd,
  ),
  ok: (
    #199a5c,
    #eaf7f0,
  ),
  bad: (
    #c73b3b,
    #fdeeee,
  ),
  confirm: (
    #cf8f22,
    #fdf6e8,
  ),
  stop: (
    #8264c4,
    #f4f0fc,
  ),
  cancel: (
    #8492a6,
    #f4f6f9,
  ),
);

.esp {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f4f6fb;
  background-image: linear-gradient(
      rgba(15, 23, 42, 0.028) 1px,
      transparent 1px
    ),
    linear-gradient(90deg, rgba(15, 23, 42, 0.028) 1px, transparent 1px);
  background-size: 24px 24px;

  --ex-panel: #ffffff;
  --ex-border: #e6eaf2;
  --ex-text: #1f2937;
  --ex-text-2: #5b6b82;
  --ex-text-3: #97a3b6;
  --ex-accent: var(--current-color, #409eff);
  --ex-accent-soft: #eef4fd;

  /*
    页头比 execPage 高一档（96px 起）：左侧要竖着放「环境 / 流」两行选择器。
    三栏：选择器（可伸缩）/ 总体进度（定宽）/ 操作按钮（不收缩）。
  */
  &__header {
    display: flex;
    align-items: center;
    flex: none;
    min-height: 96px;
    padding: 10px 20px;
    background: var(--ex-panel);
    border-bottom: 1px solid var(--ex-border);
    gap: 16px;
  }

  &__actions {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
  }

  /* 主体：左右分栏，整块占满剩余高度，两栏各自内部滚动 */
  &__body {
    flex: 1;
    min-height: 0;
    padding: 14px 20px 20px;
    overflow: hidden;
  }
}

/* --------------------------- 两级选择器（页头左侧） --------------------------- */
.esp-picker {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 14px;

  /* 标题块：竖排两行，给两行选择器当「锚」，不占太多宽度 */
  &__caption {
    display: flex;
    align-items: center;
    flex: none;
    max-width: 168px;
  }

  &__caption-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 30px;
    height: 30px;
    margin-right: 10px;
    border-radius: 9px;
    background: var(--ex-accent-soft);
    color: var(--ex-accent);
    font-size: 15px;
  }

  &__caption-text {
    min-width: 0;

    h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 19px;
      letter-spacing: 0.2px;
      color: var(--ex-text);
    }

    p {
      margin: 2px 0 0;
      font-size: 11.5px;
      line-height: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ex-text-3);
    }
  }

  /* 两行：第一行环境、第二行流 */
  &__rows {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    gap: 7px;
  }

  &__row {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  /* 行首的「环境 / 流」标签。⚠️ 用 span 不用 <label> —— index.scss 里有全局 label 样式 */
  &__label {
    flex: none;
    width: 34px;
    margin-right: 8px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: var(--ex-text-3);
  }

  /*
    小长方形按钮横排。
    行内横向滚动（不是换行）—— 换行会把页头撑高、把主体挤下去，
    而用户要求的是「顶部适当放高一点」，不是「想多高就多高」。
  */
  &__chips {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 2px 0;
    gap: 6px;

    &::-webkit-scrollbar {
      height: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 6px;
      background: #d7dfeb;
      background-clip: content-box;
    }
  }

  &__hint {
    flex: none;
    font-size: 11.5px;
    color: var(--ex-text-3);
  }
}

/* 环境 / 流 的小长方形按钮 */
.esp-chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 27px;
  padding: 0 10px;
  border: 1px solid var(--ex-border);
  border-radius: 7px;
  background: #fff;
  color: var(--ex-text-2);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease,
    color 0.16s ease, box-shadow 0.16s ease;

  &__dot {
    flex: none;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    /* 默认取 init 色，具体 tone 由下面 @each 覆盖 */
    background: nth(map-get($tone-colors, init), 1);

    @each $name, $c in $tone-colors {
      &.is-#{$name} {
        background: nth($c, 1);
      }
    }

    /* 取消 / 跳过：空心圈，呼应节点卡片的虚线边框 */
    &.is-cancel {
      background: transparent;
      box-shadow: inset 0 0 0 1.5px nth(map-get($tone-colors, cancel), 1);
    }
  }

  &__text {
    min-width: 0;
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__sub {
    flex: none;
    margin-left: 7px;
    font-family: Menlo, Consolas, monospace;
    font-size: 10px;
    color: #a6b1c0;
  }

  &:hover {
    border-color: #cfdcef;
    background: #f7fafd;
    color: var(--ex-accent);
  }

  /* 选中：主色描边 + 浅底 + 一圈外光晕，和未选中的白底一眼分得开 */
  &.is-active {
    border-color: var(--ex-accent);
    background: var(--ex-accent-soft);
    color: var(--ex-accent);
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
  }

  /* 流按钮允许更长（流名普遍比环境名长） */
  &.is-flow .esp-chip__text {
    max-width: 220px;
  }
}

/* --------------------------- 总体进度（页头中间） --------------------------- */
.esp-progress {
  display: flex;
  align-items: center;
  flex: 0 1 320px;
  min-width: 200px;

  &__track {
    position: relative;
    width: 100%;
    height: 24px;
    border-radius: 999px;
    background: #eef1f6;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.07);
    /* 进度块右端是直角，靠这里收进胶囊圆角里 */
    overflow: hidden;
  }

  &__fill {
    position: relative;
    z-index: 1;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #35c281 0%, #1fa768 55%, #17945a 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 1px 3px rgba(23, 148, 90, 0.25);
    transition: width 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
    /* 波浪裁在进度块内部；进度为 0 时块宽 0，波浪自然也看不见 */
    overflow: hidden;
  }

  /*
    波浪：一块横向平铺的 SVG 波面，靠 background-position 位移流动。
    ⚠️ 位移距离必须**正好等于 background-size 的宽度（120px）**，否则循环接缝会跳。
  */
  &__wave {
    position: absolute;
    inset: 0;
    background-repeat: repeat-x;
    background-size: 120px 100%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8Q15 2 30 8T60 8T90 8T120 8L120 16L0 16Z' fill='%23ffffff' fill-opacity='0.32'/%3E%3C/svg%3E");
    animation: esp-wave 3.4s linear infinite;
    pointer-events: none;

    &.is-back {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8Q15 14 30 8T60 8T90 8T120 8L120 16L0 16Z' fill='%23ffffff' fill-opacity='0.2'/%3E%3C/svg%3E");
      animation: esp-wave-rev 5.2s linear infinite;
    }
  }

  /* 光带：一道斜向高光扫过进度块 */
  &__sheen {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
      100deg,
      transparent 0%,
      rgba(255, 255, 255, 0.42) 50%,
      transparent 100%
    );
    background-size: 34% 100%;
    background-repeat: no-repeat;
    animation: esp-sheen 2.6s linear infinite;
    pointer-events: none;
  }

  /* 进度右端一颗呼吸的亮点 */
  &__head {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.75);
    box-shadow: 0 0 8px 2px rgba(255, 255, 255, 0.55);
    animation: esp-head-pulse 1.8s ease-in-out infinite;
    pointer-events: none;
  }

  /*
    文字两层、逐字重合：底层深色铺满整条，上层白色由 :style 的 clip-path 按进度裁掉右侧。
    所以文字跨在进度边界上时是「左白右灰」—— 进度再小也读得清。
  */
  &__label {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.3px;
    white-space: nowrap;
    color: #7b8a9c;
    pointer-events: none;

    &.is-over {
      color: #fff;
      text-shadow: 0 1px 2px rgba(6, 78, 46, 0.35);
    }
  }

  /* 还没有节点统计：给空槽一条缓慢扫过的淡绿光，别让这块看起来「死了」 */
  &.is-idle .esp-progress__track::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    background-image: linear-gradient(
      100deg,
      transparent 0%,
      rgba(25, 154, 92, 0.14) 50%,
      transparent 100%
    );
    background-size: 28% 100%;
    background-repeat: no-repeat;
    animation: esp-sheen 3.2s linear infinite;
    pointer-events: none;
  }
}

@keyframes esp-wave {
  from {
    background-position: 0 0;
  }

  to {
    background-position: -120px 0;
  }
}

@keyframes esp-wave-rev {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 120px 0;
  }
}

@keyframes esp-sheen {
  from {
    background-position: -45% 0;
  }

  to {
    background-position: 145% 0;
  }
}

@keyframes esp-head-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}

/* --------------------------- 轮询状态指示 --------------------------- */
.esp-live {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  background: #f3f9f5;
  border: 1px solid #d9ebe1;
  gap: 7px;

  &__dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #199a5c;
    animation: esp-pulse 1.8s ease-out infinite;
  }

  &__state {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #199a5c;
  }

  &__time {
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    color: #7b8a9c;
  }

  &__count {
    font-family: Menlo, Consolas, monospace;
    font-size: 10px;
    color: #a6b1c0;
  }

  &.is-paused {
    background: #f6f7f9;
    border-color: #e5e9f0;

    .esp-live__dot {
      background: #a9b4c4;
      animation: none;
    }

    .esp-live__state {
      color: #8492a6;
    }
  }

  &.is-error {
    background: #fdf4f4;
    border-color: #f5dbdb;

    .esp-live__dot {
      background: #c73b3b;
      animation: none;
    }

    .esp-live__state {
      color: #c73b3b;
    }
  }
}

@keyframes esp-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(25, 154, 92, 0.45);
  }

  70% {
    box-shadow: 0 0 0 6px rgba(25, 154, 92, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(25, 154, 92, 0);
  }
}

/* --------------------------- 顶部小按钮 --------------------------- */
.esp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  height: 28px;
  padding: 0 11px;
  border: 1px solid var(--ex-border);
  border-radius: 8px;
  background: #fff;
  color: var(--ex-text-2);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease,
    color 0.16s ease;

  svg {
    flex: none;
    width: 11px;
    height: 11px;
    margin-right: 5px;
  }

  &:hover:not(:disabled) {
    background: #f5f8fd;
    border-color: #cfdcef;
    color: var(--ex-accent);
  }

  &:disabled {
    cursor: default;
    opacity: 0.65;
  }

  &.is-on {
    background: #eef4fd;
    border-color: #d3e2f8;
    color: var(--ex-accent);
  }

  &.is-spin svg {
    animation: esp-spin 0.9s linear infinite;
  }
}

/* --------------------------- 主体：左右分栏 --------------------------- */
.esp-split {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
  gap: 14px;
}

/*
  左栏：选中那一条流的纵向流程图。

  ⚠️ **默认独占整宽**（flex: 1 1 0）—— 页面一进来没有文档区，流就该占满一屏。
     只有 `.esp-split` 带上 is-doc（= 用户双击工单、文档真的回来了）时才变成 6 : 4，
     那条覆盖写在下面 `.esp-split.is-doc .esp-flow`。
  ⚠️ 用 flex 而不是 `width: 60%`：容器里有 14px 的 gap，
     写成百分比会变成 60% + 40% + 14px > 100%，把容器撑破；
     basis 归零后剩余空间按 grow 分，比例才是精确的（gap 已被扣掉）。
  ⚠️ min-width:0 是关键 —— 没有它，FlowGraph 的 px 宽度会把这一栏顶开、
     右栏被挤没（flex 子项的默认 min-width 是 auto，按内容撑）。
*/
.esp-flow {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  background: var(--ex-panel);
  border: 1px solid var(--ex-border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);

  /* 注意：这里不能加 overflow:hidden —— 会裁掉 Canvas 里并行组的虚线框外沿 */
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex: none;
    padding: 10px 16px 11px;
    border-bottom: 1px solid var(--ex-border);
    border-radius: 11px 11px 0 0;
    background: linear-gradient(180deg, #fbfcff, #f6f9fd);
    gap: 14px;
  }

  /* 左栏：min-width:0 是关键 —— 否则长流名会把按钮挤出卡片 */
  &__head-main {
    flex: 1;
    min-width: 0;
  }

  &__btns {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
  }

  &__title {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  &__seq {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    height: 19px;
    padding: 0 7px;
    margin-right: 9px;
    border-radius: 6px;
    background: #eef1f7;
    color: #64748b;
    font-family: Menlo, Consolas, monospace;
    font-size: 10.5px;
    font-weight: 600;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #1b2533;
  }

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 8px;
    gap: 7px;
  }

  /*
    画布：FlowGraph 的根元素带 layoutFlow 算出来的明确 px 宽高（纵向图通常**又高又窄**），
    所以这里纵向是主要滚动方向、横向兜底。
    ⚠️ 图比容器窄时横向居中（flex），图比容器宽时才出现横向滚动条。
  */
  &__canvas {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    flex: 1;
    min-height: 0;
    padding: 10px 4px 16px;
    overflow: auto;
    /* 轮询更新内容时不要触发浏览器的滚动锚定，滚动位置完全交给用户 */
    overflow-anchor: none;

    /* 细滚动条：默认滚动条在 Windows 上很粗，会压掉可视高度、也不符合整体风格 */
    &::-webkit-scrollbar {
      height: 8px;
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 8px;
      background: #cbd5e1;
      background-clip: content-box;

      &:hover {
        background: #94a3b8;
        background-clip: content-box;
      }
    }
  }

  &__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    margin: auto;
    height: 92px;
    color: var(--ex-text-3);
    font-size: 12px;

    .svg-icon {
      margin-right: 7px;
      font-size: 15px;
    }
  }
}

/* 有文档时：流 6 成 / 文档 4 成（精确 6:4，14px 的 gap 由 basis:0 自动扣掉） */
.esp-split.is-doc .esp-flow {
  flex: 6 1 0;
}

/*
  右栏：文档信息（工单关联的自动发布文档）。

  ⚠️ 只在 docVisible 时渲染（页面一进来不展示文档模块，流独占整宽），
     所以这里直接就是「有内容」的卡片样式 —— 原来的虚线占位空壳
     （.esp-doc__empty / __empty-icon / __empty-title / __empty-desc）已随之删掉。
  ⚠️ 与左栏按 **6 : 4** 分宽（流 6 / 文档 4），随窗口伸缩。
*/
.esp-doc {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 4 1 0;
  min-width: 0;
  padding: 10px 10px 12px;
  border: 1px solid #e6eaf2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  /* 只淡入、不动尺寸 —— 左栏从「独占整宽」切到 6 成是瞬时的，
     给宽度加过渡会让两栏在动画期间加起来超过 100%，反而抖一下 */
  animation: esp-doc-in 0.2s ease;

  /* 头部：左 = 工单号，右 = 刷新 / 新窗口打开 */
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    gap: 8px;
    margin-bottom: 8px;
  }

  /* 工单号：一眼看出这块文档属于哪个工单 */
  &__order {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ex-text);

    .svg-icon {
      flex: none;
      font-size: 14px;
      color: var(--ex-text-3);
    }
  }

  &__order-text {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__ops {
    display: flex;
    align-items: center;
    flex: none;
    gap: 6px;
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 9px;
    border: 1px solid #e2e8f2;
    border-radius: 6px;
    background: #fff;
    color: var(--ex-text-2);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;

    &:hover {
      border-color: #bcd2ff;
      background: #f5f9ff;
      color: #2b6cff;
    }
  }

  /* 收起按钮：只有一个图标，宽度收成正方形，与左边的文字按钮同高 */
  &__close {
    width: 24px;
    padding: 0;

    svg {
      width: 12px;
      height: 12px;
    }

    /* 收起是「关闭」语义，hover 用暖色，和「新窗口打开」的蓝色区分开 */
    &:hover {
      border-color: #f3c6c6;
      background: #fef3f3;
      color: #e35d5d;
    }
  }

  /*
    tab 条：一个工单可能关联**多个**文档，横向排开，再多就横向滚。
    只有一个文档时也保留 —— 用户要求「显示出工单号和 tab」。
  */
  &__tabs {
    display: flex;
    align-items: center;
    flex: none;
    gap: 4px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eef1f7;
    overflow-x: auto;
    overflow-y: hidden;
  }

  &__tab {
    flex: none;
    max-width: 220px;
    height: 24px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: #f4f6fb;
    color: var(--ex-text-2);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;

    &:hover {
      color: #2b6cff;
    }

    &.is-active {
      border-color: #bcd2ff;
      background: #eaf1ff;
      color: #2b6cff;
      font-weight: 600;
    }
  }

  /*
    文档视口：占满头部与 tab 以下的全部高度，随右栏伸缩。

    ⚠️ **横向滚动条靠这里出**（2026-09-24 用户反馈「内容比视口宽时看不到右边、也没法横拉」）：
       文档是**跨源**内网页（10.2.64.36:8121），父页面被同源策略挡着，
       contentDocument / contentWindow 都拿不到 —— 既读不出内容真实宽度，也没法给里面注入
       overflow-x: auto 或把滚轮按比例映射成横向滚动（事件在 iframe 内部就消化掉了，不冒泡）。
       唯一纯前端能做的是：**把 iframe 的视口撑得比容器宽**。
       这样两头都有收益 ——
         ① iframe 内文档按 1440px 布局，宽表格不再被挤成一条条竖线；
         ② 父容器 scrollWidth > clientWidth，横向滚动条出现在父页面上，用户可以横拉。
       ⚠️ 纵向滚动条仍然在 iframe 内部（文档自身比视口高，浏览器默认就滚），这个不用动。
       要「像纵向那样顺手」，得让文档与页面同源（加 devServer 代理 + 后端返回相对路径），
       或者让生成文档的模板自己给表格套一层 overflow-x: auto —— 两者都要后端配合。
  */
  &__frame {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    border-radius: 8px;
    /* 原 overflow: hidden —— 溢出被藏掉，父容器层面根本不会有横向滚动条 */
    overflow: auto;

    /* 细滚动条：和左栏画布 .esp-flow__canvas 保持同一套观感 */
    &::-webkit-scrollbar {
      height: 8px;
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 8px;
      background: #cbd5e1;
      background-clip: content-box;

      &:hover {
        background: #94a3b8;
        background-clip: content-box;
      }
    }

    iframe {
      display: block;
      /* 撑满容器；但**不**低于桌面设计宽度 -> 容器窄于它时出横向滚动条 */
      width: 100%;
      min-width: 1440px;
      /*
        height: 100% 解析的是容器的**内容盒**高度（已扣掉横向滚动条占的 8px），
        所以横条出现后 iframe 不会多出 8px 把容器再顶出一条纵向滚动条。
      */
      height: 100%;
      border: 0;
      background: #fff;
    }
  }

  /* 加载遮罩。⚠️ 只按「load 有没有来」收，不能当「加载成功」的判据（见 DOC_FRAME_TIMEOUT_MS） */
  &__frame-mask {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #fff;
    color: var(--ex-text-3);
    font-size: 12px;
  }
}

/* 文档区出现的淡入（只动透明度，不参与左右分栏的宽度计算） */
@keyframes esp-doc-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 窄屏（<1280px）：收窄页头进度条，给两行选择器与操作按钮让位。
   ⚠️ 这里**不再**单独收窄 .esp-doc —— 左右两栏（有文档时）已按 6:4 定比，
      给右栏再塞一个 width 也不会生效（flex-basis:0 优先于 width），
      留着只会让读代码的人以为还有一层宽度控制。 */
@media screen and (max-width: 1280px) {
  .esp-progress {
    flex: 0 1 220px;
    min-width: 150px;
  }
}

/* --------------------------- 状态胶囊 / 标签 / 元信息 --------------------------- */
/* 状态胶囊（流级）：7 套配色，与节点状态一一对应 */
.esp-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  height: 20px;
  padding: 0 9px;
  margin-left: 10px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  background: nth(map-get($tone-colors, init), 2);
  color: nth(map-get($tone-colors, init), 1);

  @each $name, $c in $tone-colors {
    &.is-#{$name} {
      background: nth($c, 2);
      color: nth($c, 1);
    }
  }

  /* 取消 / 跳过：虚线描边，和节点的「作废」样式呼应 */
  &.is-cancel {
    border: 1px dashed #c3ccd9;
  }
}

.esp-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 19px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
  background: #f2f4f8;
  color: var(--ex-text-2);

  &.is-sys {
    background: var(--ex-accent-soft);
    color: var(--ex-accent);
  }

  &.is-env {
    background: #f1f5fb;
    color: #4b6b96;
  }

  &.is-plan {
    background: #f4f5f8;
    color: #7c8798;
    font-family: Menlo, Consolas, monospace;
    font-size: 10.5px;
  }
}

.esp-meta {
  font-size: 11.5px;
  color: #8593a6;
}

/* --------------------------- 空 / 加载态 --------------------------- */
.esp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
  color: var(--ex-text-3);

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    margin-bottom: 12px;
    border-radius: 12px;
    background: #eef1f7;
    font-size: 22px;

    &.is-spin {
      animation: esp-spin 1.6s linear infinite;
    }
  }

  &__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--ex-text-2);
  }

  &__desc {
    margin: 6px 0 0;
    font-size: 12px;
  }
}

@keyframes esp-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
