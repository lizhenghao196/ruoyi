<template>
  <div class="exec-page">
    <!-- 顶部：标题 + 总体进度 + 轮询控制 -->
    <header class="exec-page__header">
      <div class="exec-page__title">
        <span class="exec-page__icon">
          <svg-icon icon-class="tree-table" />
        </span>
        <div class="exec-page__title-text">
          <h1>执行页面</h1>
          <p>{{ summaryText }}</p>
        </div>
      </div>

      <!--
        总体进度：占页头中间这块（左边标题、右边操作按钮）。
        数据把本页**全部**执行计划的 finishedNodeNums / totalNodeNums 各自求和后再算百分比
        （见 computed 里的 progressFinished / progressTotal / progressPercent）。
        进度条本身是哑的：只读 computed，不发请求、不参与轮询。
      -->
      <div
        class="exec-progress"
        :class="{ 'is-idle': !progressTotal }"
        :title="progressTitle"
      >
        <div class="exec-progress__track">
          <div
            class="exec-progress__fill"
            :style="{ width: progressPercent + '%' }"
          >
            <!-- 两层反向流动的波面 + 一道扫过的光带：进度**不动时也在动**（常驻动画） -->
            <span class="exec-progress__wave" />
            <span class="exec-progress__wave is-back" />
            <span class="exec-progress__sheen" />
            <!-- 进度右端的呼吸亮点 -->
            <span class="exec-progress__head" />
          </div>
          <!--
            文字分两层，逐字重合：
              底层深色铺满整条，上层白色按进度用 clip-path 裁掉右侧。
            所以文字跨在进度边界上时是「左白右灰」，进度再小也读得清
            —— 比把文字塞进进度块里（窄进度会截断文字）稳得多。
          -->
          <span class="exec-progress__label"
            >总体进度 {{ progressPercent }}%</span
          >
          <span
            class="exec-progress__label is-over"
            :style="{
              clipPath: 'inset(0 ' + (100 - progressPercent) + '% 0 0)',
            }"
            >总体进度 {{ progressPercent }}%</span
          >
        </div>
      </div>

      <div class="exec-page__actions">
        <!-- 轮询状态指示：脉动点 + 最后更新时间 + 轮询次数 -->
        <div
          class="exec-live"
          :class="{ 'is-paused': !pollEnabled, 'is-error': !!failedIds.length }"
          :title="pollTitle"
        >
          <span class="exec-live__dot" />
          <span class="exec-live__state">{{ liveText }}</span>
          <span class="exec-live__time">{{ lastUpdatedAt || "—" }}</span>
          <span class="exec-live__count">#{{ pollCount }}</span>
        </div>

        <!--
          修改实施人：工单号由用户在弹窗里**自己填**（用户要求），所以这里不再
          依赖本页有没有工单 —— 只要不在提交中就能打开（见 openExecUser）。
        -->
        <button
          type="button"
          class="exec-btn"
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
        <!-- 查状态期间只置灰、不给图标加 is-spin —— 铃铛转圈很怪（那是刷新按钮的语汇） -->
        <button
          type="button"
          class="exec-btn"
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
          class="exec-btn"
          :class="{ 'is-on': !pollEnabled }"
          @click="togglePolling"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <template v-if="pollEnabled">
              <rect
                x="2"
                y="1.5"
                width="3"
                height="9"
                rx="1"
                fill="currentColor"
              />
              <rect
                x="7"
                y="1.5"
                width="3"
                height="9"
                rx="1"
                fill="currentColor"
              />
            </template>
            <path v-else d="M3 1.6 L10.4 6 L3 10.4 Z" fill="currentColor" />
          </svg>
          {{ pollEnabled ? "暂停" : "继续" }}
        </button>

        <button
          type="button"
          class="exec-btn"
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

    <!-- 图例：状态部分由字典生成，按 7 个配色分组，和节点配色完全一致 -->
    <!-- <div v-if="flows.length" class="exec-legend">
      <span
        v-for="group in statusLegend"
        :key="group.tone"
        class="exec-legend__item is-status"
      >
        <i :class="'is-' + group.tone" />{{ group.labels.join(" / ") }}
      </span>

      <span class="exec-legend__sep" />

      <span class="exec-legend__item"
        ><i class="is-group" />虚线框 = 并行组（同 aniNodeGroup）</span
      >
      <span class="exec-legend__item"
        ><i class="is-order" />组内虚线箭头 + 角标 = 执行先后</span
      >
      <span class="exec-legend__item"
        ><i class="is-flash" />蓝色脉冲 = 本轮状态有变化</span
      >
      <span class="exec-legend__item is-mute">
        <svg-icon icon-class="volume-off" />静音图标 = 已设置静默（悬停看时长）
      </span>
      <span class="exec-legend__item"
        ><i class="is-menu" />右键节点 = 操作菜单（随状态变化）</span
      >
    </div> -->

    <main class="exec-page__body">
      <!-- 没有接收到任何 id -->
      <div v-if="!rawIds.length" class="exec-empty">
        <span class="exec-empty__icon">
          <svg-icon icon-class="question" />
        </span>
        <p class="exec-empty__title">没有接收到执行计划 ID</p>
        <p class="exec-empty__desc">
          请从「变更执行计划」页面点击按钮进入本页面
        </p>
      </div>

      <!-- 正在并发拉取每个 aripExecPlanId 的执行详情 -->
      <div v-else-if="loading" class="exec-empty">
        <span class="exec-empty__icon is-spin">
          <svg-icon icon-class="time" />
        </span>
        <p class="exec-empty__title">正在获取执行详情…</p>
        <p class="exec-empty__desc">
          已并发请求 {{ rawIds.length }} 个执行计划
        </p>
      </div>

      <!-- 拉到了返回，但里面没有 workflows -->
      <div v-else-if="!flows.length" class="exec-empty">
        <span class="exec-empty__icon">
          <svg-icon icon-class="question" />
        </span>
        <p class="exec-empty__title">没有可展示的流</p>
        <p class="exec-empty__desc">
          已获取 {{ results.length }} 条执行详情，但其中不含 workflows
        </p>
      </div>

      <!-- 全部流 -->
      <div v-else class="exec-flows">
        <section
          v-for="flow in flows"
          :key="flow.key"
          class="exec-flow"
          :class="{ 'is-empty': !flow.graph.nodes.length }"
        >
          <header class="exec-flow__head">
            <div class="exec-flow__head-inner">
              <!-- 左：标题 + meta（head-inner 是 flex 行，右侧放按钮） -->
              <div class="exec-flow__head-main">
                <div class="exec-flow__title">
                  <span class="exec-flow__seq"
                    >{{ flow.flowIndex }}/{{ flow.flowCount }}</span
                  >
                  <span class="exec-flow__name" :title="flow.name">{{
                    flow.name || "未命名流"
                  }}</span>
                  <span class="exec-pill" :class="'is-' + toneOf(flow.status)">
                    {{ statusText(flow.status) }}
                  </span>
                </div>
                <div class="exec-flow__meta">
                  <span class="exec-tag is-sys">{{ flow.system || "—" }}</span>
                  <span class="exec-tag is-env">{{ flow.env || "—" }}</span>
                  <span class="exec-tag is-plan">{{
                    flow.planName || "—"
                  }}</span>
                  <span class="exec-meta"
                    >开始 {{ clock(flow.startTime) || "—" }}</span
                  >
                  <span class="exec-meta"
                    >结束 {{ clock(flow.endTime) || "—" }}</span
                  >
                  <span class="exec-meta">
                    {{ flow.templateName
                    }}{{
                      flow.templateVersion ? " " + flow.templateVersion : ""
                    }}
                  </span>
                  <span class="exec-meta">
                    {{ flow.graph.nodes.length }} 节点 ·
                    {{ flow.graph.edges.length }} 连线 ·
                    {{ flow.graph.groups.length }} 并行组
                  </span>
                </div>
              </div>
              <!--
                右：流上的操作按钮，按 awiWorkflowStatus 决定显隐（三个互斥）。
                数据来自 flowLayout.js 透传的 `awiWorkflowStatus` / `awiWorkflowInstanceId`
                / `awiWorkflowInstanceName`（mergeWorkflows 已透传这几个字段）。
                :disabled 暂不绑 isDisable（用户明确说这个逻辑不考虑）。
              -->
              <div class="btn-area exec-flow__btns">
                <el-button
                  v-if="
                    flow.awiWorkflowStatus === 'INIT' ||
                    flow.awiWorkflowStatus === 'READY'
                  "
                  type="warning"
                  size="mini"
                  plain
                  @click="flowCancel(flow)"
                  >取消</el-button
                >
                <el-button
                  v-if="flow.awiWorkflowStatus === 'RUNNING'"
                  type="danger"
                  size="mini"
                  plain
                  @click="flowStop(flow)"
                  >暂停</el-button
                >
                <el-button
                  v-if="flow.awiWorkflowStatus === 'STOP'"
                  size="mini"
                  plain
                  @click="flowRecover(flow)"
                  >恢复</el-button
                >
              </div>
            </div>
          </header>

          <div class="exec-flow__canvas">
            <flow-graph
              v-if="flow.graph.nodes.length"
              :graph="flow.graph"
              :uid="flow.key"
              :status-labels="statusLabels"
              :active-node-id="
                menu.visible && menu.flowKey === flow.key ? menu.nodeId : null
              "
              @node-menu="onNodeMenu($event, flow)"
              @node-dblclick="onNodeDblclick($event, flow)"
            />
            <div v-else class="exec-flow__placeholder">
              <svg-icon icon-class="time" />
              <span>编排实例已创建，节点尚未生成</span>
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
    />

    <!--
      原子确认：**双击人工确认节点**弹出的小弹窗（节点上只有一个原子，不铺表格）。
      「确认完成」与明细弹窗里那个走同一条链路（见 submitAtomConfirm）。
    -->
    <atom-confirm-dialog
      :visible="atomConfirm.visible"
      :node="atomConfirm.node"
      :atoms="atomConfirm.atoms"
      :loading="atomConfirm.loading"
      :submitting="atomConfirm.submitting"
      @close="closeAtomConfirm"
      @confirm="submitAtomConfirm"
    />

    <!--
      设置消息推送：页面级设置，作用于本页**全部** aripExecPlanId（不是某一个节点）。
      打开前先查一次当前状态并回填（见 openSmsSetting），确定走 setNodeFinishSms。
    -->
    <sms-setting-dialog
      :visible="sms.visible"
      :send-on="sms.sendOn"
      :group-id="sms.groupId"
      :submitting="sms.submitting"
      @close="closeSmsSetting"
      @submit="submitSmsSetting"
    />

    <!--
      修改实施人：页面级操作。
      用户列表在进页面时就拉好（见 fetchUsers），弹窗里不再请求；
      工单号是弹窗里用户自己填的，父组件不传。
    -->
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
  // 接口返回的载荷有可能在 data、也有可能在 rows —— 取值一律走它（见函数说明）
  pickPayload,
} from "@/api/tool/execPlan";
import {
  mergeWorkflows,
  layoutFlow,
  toClock,
  EXEC_STATUS_VALUES,
  statusTone,
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

/**
 * 「查看明细」弹窗里那个「刷新 / 停止刷新」的定时间隔（毫秒）。
 *
 * 比页面轮询（POLL_INTERVAL = 3s）**慢一档**：明细那一拍会切弹窗的 loading，
 * 跟着页面同频会把表格遮罩闪得太频繁；5s 既够「盯着看状态推进」，又不吵。
 * 两个定时器各自独立，互不影响（页面轮询是静默的，明细刷新才切 loading）。
 *
 * 定时器**归页面所有**（不是弹窗）：明细数据、loading 都在 detail 里，
 * 定时器跟着数据所有权走；而且弹窗的关闭点只有 closeDetail 一处，
 * 销毁点唯一 —— 不会出现「弹窗关了定时器还在跑」。
 */
const DETAIL_POLL_INTERVAL = 5000;

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
 *
 * atoms 就是 `queryAotmOfNode` 返回的 `data[]` —— 表格里每一格都来自接口，
 * 不从节点自带的 atoms[] 里兜。接口没回来时表格是空的（配合 loading / error 提示）。
 */
const DETAIL_CLOSED = {
  visible: false,
  nodeId: null,
  node: null,
  atoms: [],
  loading: false,
  error: "",
  // 正在提交的原子操作：null 或 { aaiInstanceAtomId, action }（action = 'confirm' | 'skip'）
  // 驱动明细表格里对应那一行按钮的 loading，同时挡住并发操作
  submitting: null,
};

/**
 * 「原子确认」小弹窗（双击人工确认节点弹出）的关闭态。
 *
 * 与明细弹窗同构，但只服务一个动作（确认完成），所以 submitting 是布尔值而不是对象
 * —— 那边要精确到「哪一行的哪个按钮」，这边只有一个按钮。
 */
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
 *
 * 与上面两个弹窗不同，这里**没有 loading**：状态是**先查后开**的
 * （见 openSmsSetting），弹窗出现时 sendOn / groupId 已经是查回来的真值，
 * 不需要「先开弹窗给遮罩、数据回来再填」那一套。
 * 查的过程由 `querying` 表示 —— 它驱动的是**右上角那个按钮**转圈，不是弹窗。
 */
const SMS_CLOSED = {
  visible: false,
  querying: false,
  submitting: false,
  // 开关是否打开（接口的 'Y' / 'N' 在页面这一层翻译成布尔，组件不认线上协议）
  sendOn: false,
  // 群组 ID；0 = 未配置，是合法值
  groupId: 0,
};

/**
 * 「修改实施人」弹窗的关闭态。
 *
 * 这个弹窗**打开时不需要请求** —— 用户列表在进页面时就拉好了（见 fetchUsers），
 * 工单号由用户在弹窗里自己填（见 ExecUserDialog 的 parseOrderIds）。
 * 所以这里只有 visible / submitting 两个字段。
 */
const EXEC_USER_CLOSED = {
  visible: false,
  submitting: false,
};

/**
 * 明细弹窗里的两个原子操作。它们只有「调哪个接口、叫什么名字」不同，
 * 其余流程（二次确认 -> 调接口 -> 重新拉明细 -> 按钮 loading）**完全一样**，
 * 所以共用 submitAtom —— 分开写的话「操作后要重新拉明细」这种要求很容易只改一处。
 */
const ATOM_ACTIONS = {
  confirm: { api: sureAtomInstance, label: "确认完成" },
  skip: { api: updateAtomStatus, label: "跳过" },
};

/**
 * 算作「项目角色」的角色标识。
 * 当前登录用户命中其中任意一个 -> 视为项目角色。
 *
 * 影响两处：
 *   1. 右键菜单：项目角色下节点只读，菜单只剩「查看明细」（见 nodeMenu.js 的 READONLY_MENU）；
 *   2. 明细弹窗操作列：「确认完成」只给**非**项目角色，「跳过」不判角色。
 *
 * ⚠️ 标识就是 `project_role`（用户给的参考实现里写死的那个值），
 *    角色本身从 RuoYi 的 `state.user.roles` 取（见 computed 里的 mapState）。
 */
const PROJECT_ROLE_KEYS = ["project_role"];

export default {
  name: "ExecPage",
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
  // 加载后通过 this.dict.label[EXEC_STATUS_DICT_TYPE][status] 取中文
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
      // 节点右键菜单：只存「指向谁」，菜单项本身是算出来的（见 menuItems），
      // 这样轮询把节点状态改掉时，菜单项会跟着一起变，不会拿着陈旧状态做操作。
      menu: { ...MENU_CLOSED },
      // 设置静默弹窗
      silence: { ...SILENCE_CLOSED },
      // 查看明细弹窗
      detail: { ...DETAIL_CLOSED },
      /**
       * 「查看明细」弹窗的自动刷新（定时器）。
       *
       * 三个字段是一组，全在页面里：弹窗是哑组件，只负责显示按钮文案 + 把点击抛上来。
       *   detailAutoRefresh  开关 —— 传给弹窗驱动「刷新 / 停止刷新」与「刷新中...」
       *   detailTimer        setInterval 句柄 —— 停表时 clear，别丢引用（丢了就再也停不掉）
       *   detailRefreshing   这一拍是否在飞 —— 防请求堆叠（与 fetchAll 的 silent 守卫同构）
       *
       * 销毁点（缺一个都会漏出后台定时器）：
       *   ① closeDetail()           —— 关弹窗（含点遮罩/×/底部关闭，都走 @close）
       *   ② beforeDestroy()         —— 页面被销毁（切路由 / 换标签页）
       *   ③ refreshDetailTick() 里弹窗已关的兜底
       */
      detailAutoRefresh: false,
      detailTimer: null,
      detailRefreshing: false,
      // 原子确认小弹窗（双击人工确认节点）
      atomConfirm: { ...ATOM_CONFIRM_CLOSED },
      sms: { ...SMS_CLOSED },
      execUser: { ...EXEC_USER_CLOSED },
      // 「修改实施人」的指定用户下拉：进页面就拉好（见 fetchUsers），弹窗不再请求
      users: [],
      usersLoading: false,
    };
  },
  computed: {
    // 角色走 RuoYi 的用户信息（state.user.roles），与路由守卫、其它页面同一来源。
    // 不要用 $store.getters.roles —— 用户明确要求按参考实现用 mapState 取。
    ...mapState({
      roles: (state) => state.user.roles,
      // 当前登录用户的 userName —— 「修改实施人」的 updateBy 就是它
      // （用户明确指定取 state.user.name；注意它是**登录名**，不是 nickName）
      updateBy: (state) => state.user.name,
    }),
    // 从 URL query 取到本次传入的全部 aripExecPlanId（数字数组）
    rawIds() {
      return parseIds(this.$route.query.ids);
    },
    // 把所有 plan 的 workflows 融合成一条流列表，并预先算好各自的 DAG 布局
    flows() {
      return mergeWorkflows(this.results).map((flow) => {
        const graph = layoutFlow(flow.nodes, flow.relations);
        return { ...flow, graph };
      });
    },
    summaryText() {
      if (!this.rawIds.length) {
        return "未接收到执行计划";
      }
      if (this.loading) {
        return `${this.rawIds.length} 个执行计划 · 加载中…`;
      }
      const okPlans = this.results.filter((item) => !item.error).length;
      const nodeTotal = this.flows.reduce(
        (n, f) => n + f.graph.nodes.length,
        0
      );
      const groupTotal = this.flows.reduce(
        (n, f) => n + f.graph.groups.length,
        0
      );
      const tail = this.failedIds.length
        ? ` · ${this.failedIds.length} 个计划获取失败`
        : "";
      return `${okPlans} 个执行计划 · ${this.flows.length} 条流 · ${nodeTotal} 个节点 · ${groupTotal} 个并行组${tail}`;
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
      ⚠️ 两个字段是每个 plan 的载荷顶层字段（不是从 workflows 里数出来的），
         见 api/tool/execPlan.js 的 getExecuteIndex 说明。
      ⚠️ 这里的 `item.data` 已经在 fetchAll 里用 pickPayload 归一化过了
         （接口的载荷可能在 data、也可能在 rows），所以下游只管读 `.data`。
      单个计划请求失败时 results 里那一项沿用上一次的数据（stale），照样计入 ——
      所以进度不会因为某一次请求失败就掉回去。
    */
    progressFinished() {
      return this.results.reduce(
        (n, item) =>
          n + toCount(item && item.data && item.data.finishedNodeNums),
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
      百分比：**不取小数，保留到个位**（用户要求），用 Math.floor 而不是 round ——
      宁可少报 1%，也不要「进度条已到头、节点还在跑」那种最像 bug 的画面。
      再夹到 0~100：接口给的 finished 万一大过 total（脏数据）也不让进度条溢出。
    */
    progressPercent() {
      if (!this.progressTotal) {
        return 0;
      }
      const pct = Math.floor(
        (this.progressFinished / this.progressTotal) * 100
      );
      return Math.max(0, Math.min(100, pct));
    },
    // 进度条悬停提示：光看百分比看不出分子分母，这里补上
    progressTitle() {
      if (!this.progressTotal) {
        return "总体进度：暂无节点统计（等待执行详情返回）";
      }
      return `总体进度 ${this.progressPercent}% · 已完成 ${this.progressFinished} / ${this.progressTotal} 个节点`;
    },
    // 字典里的全部状态项。
    // 字典没到位时只撑「槽位」（文案回落成状态值本身），不编造中文 —— 这样字典是否生效一眼可辨。
    statusItems() {
      const list =
        this.dict && this.dict.type
          ? this.dict.type[EXEC_STATUS_DICT_TYPE]
          : null;
      if (list && list.length) {
        return list.map((item) => ({ value: item.value, label: item.label }));
      }
      return EXEC_STATUS_VALUES.map((value) => ({ value, label: value }));
    },
    // 图例：把字典里的 15 个状态按 7 个 tone 分组，配色和节点完全一致
    statusLegend() {
      const buckets = new Map(TONE_ORDER.map((tone) => [tone, []]));
      this.statusItems.forEach((item) => {
        const list = buckets.get(statusTone(item.value));
        if (list) {
          list.push(item.label);
        }
      });
      return TONE_ORDER.map((tone) => ({
        tone,
        labels: buckets.get(tone),
      })).filter((g) => g.labels.length);
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
        lines.push(
          `本轮失败：${this.failedIds.join(", ")}（已沿用上一次数据）`
        );
      }
      return lines.join("\n");
    },

    /* ------------------------- 节点右键菜单 ------------------------- */

    /**
     * 项目角色是否被禁用。
     * 禁用时节点只读 —— 菜单里只剩「查看明细」（见 nodeMenu.js 的 READONLY_MENU）；
     * 明细弹窗的「确认完成」也只给非项目角色。
     *
     * 角色从 RuoYi 的 `state.user.roles` 取（computed 里的 mapState），
     * 命中 PROJECT_ROLE_KEYS 里的任一标识即为项目角色。
     */
    isProjectRoleDisable() {
      const roles = this.roles || [];
      return PROJECT_ROLE_KEYS.some((key) => roles.includes(key));
    },

    /**
     * 菜单当前指向的节点：每次都从最新的 flows 里按 id 重新查，
     * 而不是把右键那一刻的节点对象存下来 —— 轮询会整体重建 graph，
     * 存引用会拿到一份永远不会再更新的快照。
     */
    menuNode() {
      if (!this.menu.visible || this.menu.nodeId === null) {
        return null;
      }
      const flow = this.flows.find((f) => f.key === this.menu.flowKey);
      if (!flow) {
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
  },
  created() {
    this.fetchAll({ silent: false });
    // 用户列表进页面就拉（用户要求）—— 「修改实施人」的指定用户下拉要用，
    // 拉完之前下拉是 loading 态，不阻塞页面本身
    this.fetchUsers();
    this.startPolling();
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  },
  beforeDestroy() {
    this.stopPolling();
    // 页面被销毁（切路由 / 关标签页）时明细弹窗的自动刷新也必须停 —— 否则定时器会跟着组件
    // 一起被丢掉引用，请求还在后台按 5s 打接口，谁也停不掉
    this.stopDetailAutoRefresh();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  },
  watch: {
    // 同一标签页内被再次传入新的 ids 时，重置轮询并重新拉取
    rawIds() {
      this.pollCount = 0;
      this.lastUpdatedAt = "";
      this.failedIds = [];
      this.results = [];
      this.closeMenu();
      this.closeSilence();
      this.closeDetail();
      this.fetchAll({ silent: false });
      this.startPolling();
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
        //    **这里是唯一的归一化入口**：下游 mergeWorkflows / 总体进度都只读 `item.data`，
        //    在这里把信封拆干净，它们就不用各自再判一遍。
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
        }
      }
    },

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

    // 页面切到后台时停止轮询，切回来立即补一次再恢复，省流量也避免回来时看到陈旧数据
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

    /**
     * 右键节点 -> 打开菜单
     * @param {Object} payload FlowGraph 抛上来的 { event, node, nodeId }
     * @param {Object} flow    所属流（用于在轮询后按 flowKey + nodeId 找回最新节点）
     */
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
     * 双击节点 -> 按节点类型分流（用户要求）：
     *   人工确认节点 -> 弹「原子确认」小弹窗；
     *   其余节点     -> 直接走「查看明细」，与右键 -> 查看明细**完全同一条路**。
     *
     * 分流规则写在这里而不是 FlowGraph 里：组件只负责报事件
     * （见 `FlowGraph.onNodeDblclick`），规则集中在页面 + `./nodeKind` 的纯函数里，好改也好测。
     *
     * ⚠️ 判的是**节点类型**（英文 `HUMAN_CONFIRM`），不是原子名 ——
     *    两个关键字不能混用，详见 `./nodeKind` 的说明。
     *
     * @param {Object} payload FlowGraph 抛上来的 { node, nodeId }
     * @param {Object} flow    所属流（只用来取 planId / key，和右键菜单保持一致）
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
     *
     * 先取上下文再关菜单：菜单一关 menuNode 就变 null，动作就拿不到节点了。
     * 上下文里带的是当前最新的节点对象，不是右键那一刻的快照。
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

    /**
     * 节点动作。链路（右键 -> 菜单 -> 分发）已通，拿到的是当前最新的节点对象。
     *
     * 「暂停 / 取消节点 / 恢复」共用 submitNodeStatusAction 走 updateNodeStatus；
     * 「设置静默」见 submitSilence；「查看明细」见 actNodeDetail。
     */
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
        // 原子数组可能在 data、也可能在 rows（见 pickPayload）
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
     * 「确认完成」成功后也要重新拉一次，所以抽出来给两处共用。
     */
    async fetchDetailAtoms(nodeId, node) {
      const res = await queryAotmOfNode({ aniInstanceNodeId: nodeId, node });
      console.log("[查看明细] queryAotmOfNode 返回：", res);
      return res;
    },

    /**
     * 只重新拉一次明细，不动弹窗的开合状态 —— 「确认完成」成功后用它刷新表格。
     * 与 actNodeDetail 的区别：不重置 detail、不切 loading（否则整张表会闪一层遮罩）。
     *
     * @param {Object} [options]
     * @param {Boolean} [options.withLoading=false]
     *   「函数批量跳过」成功后用它：用户明确要求「批量跳过后查明细弹窗数据的时候
     *   弹窗也要loading」，所以这里加一个开关带上 loading。
     *   默认 false —— 原子级确认/跳过仍然走「无感刷新」，避免每次点按钮都闪遮罩。
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
        // 同 actNodeDetail：原子数组可能在 data、也可能在 rows
        const atoms = pickPayload(res);
        this.detail.atoms = Array.isArray(atoms) ? atoms : [];
      } catch (e) {
        // 失败也清掉 loading，否则表格永远停在遮罩态
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

    /* ---------------- 查看明细弹窗：自动刷新（「刷新 / 停止刷新」） ---------------- */

    /**
     * 自动刷新的一拍：重拉一次当前节点的明细。
     *
     * 走 `reloadDetailAtoms({ withLoading: true })` —— 用户要求「刷新的时候明细弹窗要 loading」，
     * 与「函数批量跳过」成功后的刷新是同一条链路（都带 loading，都会整表换数据）。
     * 展开状态由弹窗自己保持（见 AtomDetailDialog 的 reapplyExpand），这里不用管。
     *
     * 两个守卫：
     *   ① 弹窗已经关了 → 兜底停表。正常关弹窗时 closeDetail 已经停了，
     *      这一条防的是「先关弹窗、后一拍才排到」的时序（以及任何绕过 closeDetail 的关闭）。
     *   ② 上一拍还没回来 → 直接跳过这一拍，别堆请求（与 fetchAll 的 silent 守卫同构）。
     *      注意：手动点出来的刷新（@refresh / @refresh-with-loading）**不受**这个守卫约束，
     *      用户的显式操作永远照做。
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
     *
     * 先刷一次是为了即时反馈 —— 点了按钮马上能看到 loading 和最新数据，
     * 否则要干等 5s，用户会以为按钮没生效。
     * 开头先 stop 一次：连点 / 重复开的时候保证**只有一个**定时器在跑。
     *
     * 开头的 visible 守卫是**防僵尸定时器**：立刻刷那一拍如果发现弹窗不可见，
     * 会自己 stop（见 refreshDetailTick 的守卫①）—— 那之后要是还继续挂定时器，
     * 就留下一个「开关显示已关、定时器却还在跑」的僵尸（要等下一拍才被清掉）。
     * 正常进不来（按钮在弹窗里），纯粹是防御。
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
     *
     * **不动 `detailRefreshing`** —— 它的语义是「有一拍正在飞」，由那一拍自己的 finally 复位。
     * 在这里顺手置 false 会让它变成一句假话：正在飞的请求不会因为停了定时器就消失，
     * 置 false 只会让「停止 → 立刻再开」时的守卫形同虚设（多打一次重复请求）。
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

    /**
     * 明细弹窗里点「确认完成」（人工确认类原子）-> PUT /release/atomInstance
     */
    onAtomConfirm({ par }) {
      return this.submitAtom("confirm", par);
    },

    /**
     * 明细弹窗里点「跳过」-> POST /release/executeIndex/updateAtomStatus
     */
    onAtomSkip({ par }) {
      return this.submitAtom("skip", par);
    },

    /**
     * 原子操作（确认完成 / 跳过）的公共流程。
     *
     * 链路：弹窗先 $confirm 二次确认 -> 这里调接口 -> 成功后**重新拉一次明细**拿最新状态。
     * 全程 detail.submitting 指向「哪一行的哪个操作」，对应按钮转 loading 并挡住并发点击。
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
     *   重启新定时器），让新状态（STOP / CANCELLED / RUNNING）立刻反映到节点卡片上。
     *
     * 重置定时器的理由（用户要求）：
     *   操作完成后节点状态已经变了，最自然的反应是「马上看到新状态」。
     *   只调用 `fetchAll({ silent: true })` 也行，但旧定时器可能在下一次（< 3s 内）
     *   触发，叠加在刚拉回来的数据上，让卡片有节奏不齐的闪烁。停掉旧定时器再重启，
     *   干净起算一个 3s 周期。
     *
     * 菜单只对「允许操作的 aniStatus」暴露这些按钮（见 nodeMenu.js 的 STATUS_MENU），
     * 所以这里**不再二次校验状态**。如果用户在确认期间节点被外部推进了，真实接口
     * 会按后端逻辑处理；mock 也会按接口成功回执。
     *
     * @param {Object} ctx 右键时刻的 { planId, flowKey, nodeId, node }
     * @param {String} label 菜单文案里的动词，「暂停 / 取消节点 / 恢复」
     * @param {String} operation 接口值，STOP / CANCELLED / RECOVER 三选一
     */
    async submitNodeStatusAction(ctx, label, operation) {
      const nodeName =
        (ctx.node && ctx.node.aniInstanceNodeName) || `节点 ${ctx.nodeId}`;
      if (!ctx.nodeId) {
        return;
      }
      // 二次确认：参考截图里 Element UI 的 this.$confirm 形态，
      // 与 AtomDetailDialog 的函数/原子操作保持同一种提示风格。
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
        // 重置轮询：先杀旧定时器，立刻拉一次拿到新状态，再启动一个干净的 3s 周期。
        // 顺序很重要 —— startPolling 内部也会 stop，但显式 stop 让「立即拉取」这一步
        // 不会被旧定时器的下一次触发抢占。
        this.stopPolling();
        await this.fetchAll({ silent: true });
        this.startPolling();
      } catch (e) {
        console.error(`[${label}] 请求失败`, e);
        this.$modal.msgError((e && e.message) || `${label}失败`);
        // 失败不重置定时器 —— 旧定时器还在跑，下一轮轮询自然会拿一次最新状态。
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
     *   → 成功后**重置轮询**（杀旧定时器 + 立刻拉一次 + 重启新定时器）。
     *
     * 与 submitNodeStatusAction 是「孪生兄弟」：同一套 stop → fetch → start 的重置
     * 顺序，同一套 $confirm 二次确认，同一套成功/失败/取消分支。原因完全一样，
     * 见 submitNodeStatusAction 上方的注释。
     *
     * @param {Object} flow mergeWorkflows 出的流对象（已透传 awiWorkflowInstanceId 等字段）
     * @param {String} label 菜单文案里的动词，「取消 / 暂停 / 恢复」
     * @param {String} operation 接口值，STOP / CANCELLED / RECOVER 三选一
     */
    async submitWorkflowStatusAction(flow, label, operation) {
      const workflowName =
        flow.awiWorkflowInstanceName || flow.name || `工作流 ${flow.flowIndex}`;
      const workflowId = flow.awiWorkflowInstanceId;
      if (
        workflowId === undefined ||
        workflowId === null ||
        workflowId === ""
      ) {
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
      // 关弹窗必须停掉自动刷新的定时器（用户要求）—— 放在最前面：
      // 无论这次关闭走的是 ×、遮罩、底部按钮还是页面自己调的，都先把表停掉。
      // （定时器在页面手里，所以「销毁」也必须是页面做，不能指望弹窗被关时顺手带走。）
      this.stopDetailAutoRefresh();
      if (!this.detail.visible) {
        return;
      }
      this.detail = { ...DETAIL_CLOSED };
    },

    /* ------------------- 人工节点双击：「原子确认」小弹窗 ------------------- */

    /**
     * 打开「原子确认」小弹窗。
     *
     * 与 actNodeDetail 同构：**先开弹窗（带 loading），原子明细回来再填** ——
     * 「确认完成」要拿原子的 `aaiInstanceAtomId`，所以必须先拿到明细。
     * 人工节点只有一个原子，弹窗里只取 `atoms[0]`。
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
        // 同 actNodeDetail：原子数组可能在 data、也可能在 rows
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
     *
     * 与明细弹窗里的「确认完成」**是同一个接口、同一套入参**（`ATOM_ACTIONS.confirm`）：
     *   PUT /release/atomInstance + { aaiInstanceAtomId, aaiAtomStatus: 'SUCCESS' }
     * 这里复用 `ATOM_ACTIONS.confirm.api` 而不是再写一次 url/入参 —— 接口一改只改一处。
     *
     * 成功后就地把小弹窗关掉，并顺手刷一下明细（明细弹窗可能正开着同一个节点）。
     * 节点状态本身靠页面轮询刷新，不用手动改。
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
     *
     * 在 `created` 里调一次就够 —— 用户列表跟计划/轮询都无关，不用跟着刷新。
     * 失败只提示、不重试：弹窗里会显示空下拉，用户重进页面即可。
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
     *
     * **不再要求本页有工单** —— 工单号是用户在弹窗里自己填的（用户要求），
     * 所以只要不在提交中就能打开（上一版会因为本页没有 aripExecOrderList 而打不开，
     * 那和「让用户自己输工单号」是矛盾的）。
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
     *
     * 请求体的四个字段（用户明确指定，别自己「理顺」）：
     *   orderId   工单号**数组** —— 弹窗里用户自己填的，已按逗号拆分去重
     *   user      选中用户的 **userName**（登录名）
     *   username  选中用户的 **nickName**（中文名）—— 和上面那个名字容易搞反，但接口就是这样
     *   updateBy  当前登录用户的 userName（`state.user.name`）
     *
     * 提示优先用返回的 `data`：那是一句「…工单实施人更新至xxx成功」，
     * 比 `msg` 的「成功」有用得多（见 changeExecUser 的说明）。
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
        // 载荷可能在 data、也可能在 rows，所以走 pickPayload。
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
     *
     * 顺序是**先查、后开**（用户要求）：查回来的 send / groupId 直接当弹窗初值，
     * 弹窗一出现就是当前状态。不做「先开弹窗再填」—— 那样开关会先显示成「关闭」、
     * 等数据回来再跳到「开启」，设置类弹窗里这种跳变很容易被当成 bug。
     *
     * planId 传**本页全部** aripExecPlanId 组成的数组（不是单个 id）：
     * 这是页面级设置，作用于本次打开的所有计划。
     * 查失败就**不开弹窗** —— 拿不到当前状态的话，用户看到的初值是假的，
     * 一确定就把一个不知道从哪来的值写了回去。
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
          // 请求成功但没带 nodeFinishedSms：当失败处理，别拿 undefined 去填弹窗
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
     *
     * 弹窗给的是布尔（sendOn），接口要的是 'Y' / 'N' —— 翻译放在这一层，
     * 组件不认线上协议（见 SmsSettingDialog 的说明）。
     *
     * 成功后直接关弹窗：接口的 data 是 null，拿不到落库后的真值，所以**不在本地
     * 假装已生效**；下次打开会重新查一次，那时看到的就是后端真实的持久化结果
     * —— 「设置成功但其实没生效」只有这样才看得出来。
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
 *
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

.exec-page {
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

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    min-height: 62px;
    padding: 0 20px;
    background: var(--ex-panel);
    border-bottom: 1px solid var(--ex-border);
    /*
      三栏：标题 / 总体进度 / 操作按钮。
      中间那栏（.exec-progress）是 flex:1 + max-width，剩余宽度全被它吃掉，
      所以 space-between 只负责把两边贴到端点；两边都没富余时，
      这个 gap 兜住最小间距。
    */
    gap: 16px;
  }

  &__title {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    margin-right: 11px;
    border-radius: 9px;
    background: var(--ex-accent-soft);
    color: var(--ex-accent);
    font-size: 16px;
  }

  &__title-text {
    min-width: 0;

    h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 20px;
      letter-spacing: 0.2px;
      color: var(--ex-text);
    }

    p {
      margin: 3px 0 0;
      font-size: 12px;
      line-height: 16px;
      color: var(--ex-text-3);
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
  }

  /*
    只做**纵向**滚动。横向滚动条下沉到每条流自己的 `&__canvas` 里
    （见 .exec-flow 的注释）—— 节点多的流只在自己卡片内部横向滚，
    页面整体不再出现一条横跨所有流的横向滚动条。
  */
  &__body {
    flex: 1;
    min-height: 0;
    padding: 14px 20px 20px;
    overflow-x: hidden;
    overflow-y: auto;
    /* 轮询更新内容时不要触发浏览器的滚动锚定，滚动位置完全交给用户 */
    overflow-anchor: none;
  }
}

/* --------------------------- 总体进度（页头中间） --------------------------- */
/*
  原来这块放的是「N 个 ID」「状态字典 15 项」两个标签，用户要求删掉换成总体进度条。
  ⚠️ 波浪 + 光带是**常驻动画**（用户明确要求「进度条不动的时候也要有动效」），
     不要给它加 animation-play-state: paused 之类的「静止就停」逻辑。
*/
.exec-progress {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  /* 上限 560px：再宽就成一条横贯页头的色带，不像进度条了 */
  max-width: 560px;

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
    /* 进度变化时平滑推进：轮询 3s 一拍，0.55s 刚好跟得上又不拖沓 */
    transition: width 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
    /* 波浪裁在进度块内部；进度为 0 时块宽 0，波浪自然也看不见 */
    overflow: hidden;
  }

  /*
    波浪：一块横向平铺的 SVG 波面，靠 background-position 位移流动。
    两层相位相反、速度不同，叠出「两层水面互相穿过」的层次。
    ⚠️ 位移距离必须**正好等于 background-size 的宽度（120px）**，
       否则每个循环的接缝处会跳一下。
  */
  &__wave {
    position: absolute;
    inset: 0;
    background-repeat: repeat-x;
    background-size: 120px 100%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8Q15 2 30 8T60 8T90 8T120 8L120 16L0 16Z' fill='%23ffffff' fill-opacity='0.32'/%3E%3C/svg%3E");
    animation: exec-wave 3.4s linear infinite;
    pointer-events: none;

    /* 反向、慢一档、更淡：制造前后两层水面的视差 */
    &.is-back {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 16' preserveAspectRatio='none'%3E%3Cpath d='M0 8Q15 14 30 8T60 8T90 8T120 8L120 16L0 16Z' fill='%23ffffff' fill-opacity='0.2'/%3E%3C/svg%3E");
      animation: exec-wave-rev 5.2s linear infinite;
    }
  }

  /*
    光带：一道斜向高光扫过进度块。
    宽度给百分比而不是 px，所以进度块再窄也不会「整条都是光」。
  */
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
    animation: exec-sheen 2.6s linear infinite;
    pointer-events: none;
  }

  /* 进度右端一颗呼吸的亮点：进度停在某个值时也能看出「它是活的」 */
  &__head {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.75);
    box-shadow: 0 0 8px 2px rgba(255, 255, 255, 0.55);
    animation: exec-head-pulse 1.8s ease-in-out infinite;
    pointer-events: none;
  }

  /*
    文字两层、逐字重合：
      底层深色铺满整条，上层白色由 :style 的 clip-path 按进度裁掉右侧。
    所以文字跨在进度边界上时是「左白右灰」—— 进度再小也读得清，
    比把文字塞进进度块里（窄进度会把文字截断）稳得多。
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

  /*
    还没有节点统计（首屏 / 详情没回来）：进度块是空的，
    给空槽一条缓慢扫过的淡绿光，别让这块看起来「死了」。
  */
  &.is-idle .exec-progress__track::after {
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
    animation: exec-sheen 3.2s linear infinite;
    pointer-events: none;
  }
}

@keyframes exec-wave {
  from {
    background-position: 0 0;
  }

  to {
    background-position: -120px 0;
  }
}

@keyframes exec-wave-rev {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 120px 0;
  }
}

@keyframes exec-sheen {
  from {
    background-position: -45% 0;
  }

  to {
    background-position: 145% 0;
  }
}

@keyframes exec-head-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}

/* --------------------------- 轮询状态指示 --------------------------- */
.exec-live {
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
    animation: exec-pulse 1.8s ease-out infinite;
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

    .exec-live__dot {
      background: #a9b4c4;
      animation: none;
    }

    .exec-live__state {
      color: #8492a6;
    }
  }

  &.is-error {
    background: #fdf4f4;
    border-color: #f5dbdb;

    .exec-live__dot {
      background: #c73b3b;
      animation: none;
    }

    .exec-live__state {
      color: #c73b3b;
    }
  }
}

@keyframes exec-pulse {
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
.exec-btn {
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
    animation: exec-spin 0.9s linear infinite;
  }
}

/* --------------------------- 图例 --------------------------- */
.exec-legend {
  display: flex;
  align-items: center;
  flex: none;
  flex-wrap: wrap;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid var(--ex-border);
  gap: 16px;

  &__item {
    display: inline-flex;
    align-items: center;
    font-size: 11.5px;
    color: var(--ex-text-2);

    i {
      display: inline-flex;
      flex: none;
      width: 9px;
      height: 9px;
      margin-right: 6px;
      border-radius: 50%;

      /* 状态色点：与节点卡片头部渐变的主色同源 */
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

      &.is-group {
        width: 14px;
        height: 11px;
        border-radius: 3px;
        border: 1px dashed #3fb27f;
        background: rgba(25, 154, 92, 0.06);
      }

      /* 组内执行顺序：一小段竖向虚线 */
      &.is-order {
        width: 2px;
        height: 11px;
        border-radius: 1px;
        background: repeating-linear-gradient(
          180deg,
          #5cbf90 0,
          #5cbf90 2px,
          transparent 2px,
          transparent 4px
        );
      }

      /* 本轮状态有变化：蓝色脉冲圈 */
      &.is-flash {
        width: 11px;
        height: 11px;
        background: #fff;
        border: 1.5px solid #409eff;
        box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.22);
      }

      /* 右键菜单提示：小方块里三条横线 */
      &.is-menu {
        width: 11px;
        height: 11px;
        border-radius: 3px;
        background-color: #f1f4f9;
        background-image: linear-gradient(#b9c4d4, #b9c4d4),
          linear-gradient(#b9c4d4, #b9c4d4), linear-gradient(#b9c4d4, #b9c4d4);
        background-size: 7px 1.3px;
        background-position: 2px 2.4px, 2px 4.85px, 2px 7.3px;
        background-repeat: no-repeat;
      }
    }

    /* 静默标识：直接复用节点上那个 volume-off 图标，保证图例和节点是同一个符号 */
    &.is-mute .svg-icon {
      flex: none;
      width: 12px;
      height: 12px;
      margin-right: 6px;
      color: #5b6b82;
    }
  }

  &__sep {
    width: 1px;
    height: 12px;
    background: var(--ex-border);
  }
}

/* --------------------------- 流列表 --------------------------- */
.exec-flows {
  display: flex;
  flex-direction: column;
  /*
    撑满页面 + stretch：每条流卡片等宽（都等于页面宽度），横向滚动下沉到卡片内部。
    ⚠️ 原来是 (width:max-content, align-items:flex-start) —— 「每张卡片自己按内容撑宽」，
    那条最宽的流会把整个页面撑出一条横向滚动条。用户反馈这个体验不好，改成统一撑满。
  */
  align-items: stretch;
  width: 100%;
  gap: 14px;
}

/* 每张卡片等宽撑满；节点多时由 &__canvas 内部横滚（见下） */
.exec-flow {
  display: flex;
  flex-direction: column;
  /*
    宽度撑满页面，**不再用 max-content 把页面撑出横向滚动条**。
    横向滚动改由下面的 `&__canvas` 自己承担：节点多的流只在自己卡片内部横滚，
    头部（流名 + 操作按钮）始终固定在卡片顶部看得见 —— 比原来的 sticky 停靠更直观。
  */
  width: 100%;
  background: var(--ex-panel);
  border: 1px solid var(--ex-border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);

  /* 注意：这里不能加 overflow:hidden —— 会裁掉 Canvas 里并行组的虚线框外沿。
     圆角改用头部自己的 border-radius 实现。 */
  &__head {
    border-bottom: 1px solid var(--ex-border);
    border-radius: 11px 11px 0 0;
    background: linear-gradient(180deg, #fbfcff, #f6f9fd);
  }

  /* 左「标题 + meta」/ 右「操作按钮」两栏。
     ⚠️ 原来的 position:sticky + width:max-content 是为「页面级横向滚动时标题停靠」
     设计的；现在横向滚动下沉到 &__canvas，头部根本不在滚动容器内，
     sticky 就没有滚动祖先、会退化成普通定位 —— 所以这里改成普通 flex。 */
  &__head-inner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 16px 11px;
  }

  /* 左栏：min-width:0 是关键 —— 否则长流名会把按钮挤出卡片 */
  &__head-main {
    flex: 1;
    min-width: 0;
  }

  /* 右栏：按钮组不收缩 */
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
    每条流**自己的横向滚动容器**：FlowGraph 的根元素有 layoutFlow 算出来的
    明确 px 宽度（节点多时可达数千 px），超出本卡片宽度时就在这里横滚。
    ⚠️ overflow 用 auto 而不是 (auto, hidden)：纵向理论上不会溢出（高度是精确算的），
    但万一溢出，hidden 会**裁掉**内容、auto 只是多一条滚动条，后者代价小得多。
  */
  &__canvas {
    padding: 6px 4px;
    overflow: auto;
    /* 轮询更新内容时不要触发浏览器的滚动锚定，横向位置完全交给用户 */
    overflow-anchor: none;

    /* 细滚动条：默认滚动条在 Windows 上很粗，会压掉卡片高度、也不符合整体风格 */
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
    height: 92px;
    color: var(--ex-text-3);
    font-size: 12px;

    .svg-icon {
      margin-right: 7px;
      font-size: 15px;
    }
  }
}

/* 状态胶囊（流级）：7 套配色，与节点状态一一对应 */
.exec-pill {
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

.exec-tag {
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

.exec-meta {
  font-size: 11.5px;
  color: #8593a6;
}

/* --------------------------- 空 / 加载态 --------------------------- */
.exec-empty {
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
      animation: exec-spin 1.6s linear infinite;
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

@keyframes exec-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
