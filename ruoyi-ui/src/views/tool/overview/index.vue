<template>
  <div class="overview-page" :class="themeClass">
    <div class="overview-shell">
      <main class="overview-layout" :class="{ 'is-message-collapsed': messageCollapsed }">
        <section class="execution-panel panel-surface">
          <div class="panel-head">
            <div class="panel-head__left">
              <div class="panel-title">
                <span class="panel-title__icon">
                  <svg-icon icon-class="monitor" />
                </span>
                <div>
                  <h2>系统执行态势</h2>
                  <span>{{ overviewStats.runningEnvs }} 个变更计划执行中</span>
                </div>
              </div>
              <div class="panel-live">
                <i />
                <span class="panel-live__time">{{ fullDateTime }}</span>
              </div>
            </div>
            <div class="execution-toolbar">
              <button class="quick-action" type="button" @click="toggleTheme">
                <span class="tech-icon">
                  <svg-icon icon-class="theme" />
                </span>
                {{ resolvedTheme === 'light' ? 'Light' : 'Dark' }}
              </button>
              <button class="quick-action" type="button" @click="refreshOverview">
                <span class="tech-icon">
                  <svg-icon icon-class="monitor" />
                </span>
                刷新数据
              </button>
              <button class="quick-action" type="button" @click="messageCollapsed = !messageCollapsed">
                <span class="tech-icon">
                  <svg-icon :icon-class="messageCollapsed ? 'message' : 'more-up'" />
                </span>
                {{ messageCollapsed ? '展开消息' : '收起消息' }}
              </button>
              <button
                v-for="action in quickActions"
                :key="action.key"
                class="quick-action"
                type="button"
                :disabled="action.disabled"
                @click="handleQuickAction(action)"
              >
                <span class="tech-icon">
                  <svg-icon :icon-class="action.icon" />
                </span>
                {{ action.label }}
                <span v-if="action.key === 'notice' && maintenanceNoticeTotal" class="quick-action__badge">{{ maintenanceNoticeTotal }}</span>
              </button>
            </div>
          </div>

          <div class="execution-scroll">
            <div v-if="executionLoading && !visibleSystems.length" class="skeleton-grid">
              <div v-for="item in 6" :key="item" class="system-skeleton" />
            </div>
            <div v-else-if="executionError" class="state-panel is-error">
              <strong>执行情况加载失败</strong>
              <span>{{ executionError }}</span>
            </div>
            <div v-else-if="!visibleSystems.length" class="state-panel">
              <strong>暂无执行中的系统</strong>
              <span>当前没有可展示的变更计划进度。</span>
            </div>
            <div v-else class="system-grid">
              <article
                v-for="(system, index) in visibleSystems"
                :key="system.name"
                class="system-card"
                :class="{ 'is-running': system.hasRunning }"
                :style="systemStyle(system, index)"
              >
                <div class="system-card__identity">
                  <div class="system-identity__main">
                    <div class="system-identity__head">
                      <h3>{{ system.name }}</h3>
                      <span class="system-status" :class="systemStatusClass(system)">
                        {{ systemStatusText(system) }}
                      </span>
                    </div>
                    <p>{{ system.envs.length }} 个变更计划，{{ systemActiveText(system) }}</p>
                  </div>
                  <div class="system-identity__metrics">
                    <span class="system-metric is-placeholder">
                      <span class="system-metric__label">告警</span>
                      <span class="system-metric__value">-</span>
                    </span>
                    <span class="system-metric is-placeholder">
                      <span class="system-metric__label">巡检</span>
                      <span class="system-metric__value">-</span>
                    </span>
                  </div>
                </div>

                <div class="env-grid">
                  <div
                    v-for="env in system.envs"
                    :key="system.name + '-' + env.key"
                    class="env-block"
                    :class="[envBlockClass(env), envVisualClass(env)]"
                    tabindex="0"
                    @click="jump2Execute(env)"
                  >
                    <span class="env-block__dot" />
                    <span class="env-block__name">{{ env.label }}</span>
                    <strong class="env-block__percent">{{ env.percent }}%</strong>
                    <span class="env-block__status" :class="envActiveClass(env)">{{ envActiveText(env) }}</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <aside class="message-panel panel-surface" :class="{ 'is-collapsed': messageCollapsed }">
          <div class="panel-head message-panel__head">
            <div class="panel-title">
              <span class="panel-title__icon">
                <svg-icon icon-class="bell" />
              </span>
              <div>
                <h2>状态消息</h2>
                <span>{{ messageTotal }} 条记录</span>
              </div>
            </div>
            <transition name="message-new-tip">
              <em v-if="newMessageCount">{{ newMessageCount }} 条新增</em>
            </transition>
            <button
              class="message-panel__close"
              type="button"
              :aria-label="'关闭消息面板'"
              @click="messageCollapsed = true"
            >
              <svg-icon icon-class="close" />
            </button>
          </div>

          <div
            ref="messageBody"
            class="message-panel__body"
            @scroll.passive="handleMessageScroll"
          >
            <div v-if="messageLoading && !messages.length" class="timeline-skeleton">
              <div v-for="item in 6" :key="item" />
            </div>
            <div v-else-if="messageError" class="state-panel is-error">
              <strong>状态消息加载失败</strong>
              <span>{{ messageError }}</span>
            </div>
            <div v-else-if="!messages.length" class="state-panel">
              <strong>暂无状态消息</strong>
              <span>新的执行状态会出现在这里。</span>
            </div>
            <transition-group v-else name="timeline-list" tag="div" class="message-timeline">
              <article
                v-for="item in messages"
                :key="messageKey(item)"
                class="message-item timeline-item"
                :data-message-key="messageKey(item)"
                :class="[messageToneClass(item), { 'is-new': item._isNew }]"
                :style="messageInsertStyle(item)"
              >
                <div class="timeline-marker">
                  <span />
                </div>
                <div class="timeline-content">
                  <div class="timeline-content__head">
                    <h3 :title="messageTitle(item)">{{ messageTitle(item) }}</h3>
                    <div class="timeline-state">
                      <span>{{ messageToneText(item) }}</span>
                      <time>{{ formatShortTime(item.createTime) }}</time>
                    </div>
                  </div>
                  <el-tooltip
                    effect="dark"
                    popper-class="overview-message-tooltip"
                    placement="left"
                    :content="messageDescription(item)"
                    :open-delay="260"
                  >
                    <p :title="messageDescription(item)">{{ messageDescription(item) }}</p>
                  </el-tooltip>
                  <div class="timeline-meta">
                    <span>{{ messageTypeText(item.apemMessageType) }}</span>
                    <span>{{ item.aripExecSys || 'SYSTEM' }}</span>
                  </div>
                </div>
              </article>
            </transition-group>
            <div v-if="messageLoadingMore" class="message-loading-more">加载更多消息</div>
          </div>
        </aside>

        <button
          v-if="messageCollapsed"
          class="message-float"
          type="button"
          aria-label="展开消息"
          @click="messageCollapsed = false"
        >
          <svg-icon icon-class="message" />
          消息
        </button>
      </main>

      <el-dialog
        :visible.sync="cicdDialogVisible"
        title="CICD实施情况"
        width="1100px"
        top="6vh"
        :close-on-click-modal="false"
        append-to-body
        :class="['cicd-dialog', 'cicd-dialog--' + resolvedTheme]"
      >
        <div class="cicd-toolbar">
          <span v-if="cicdList.length" class="cicd-toolbar__count">共 {{ cicdList.length }} 条工单</span>
          <button class="quick-action" type="button" @click="fetchCicdList">
            刷新数据
          </button>
        </div>

        <el-table
          v-loading="cicdLoading"
          :data="cicdList"
          empty-text="暂无 CICD 实施工单"
          row-key="order_id"
          border
          max-height="520"
          class="cicd-table"
        >
          <el-table-column prop="order_id" label="工单号" min-width="160" />

          <el-table-column
            label="工单状态"
            width="115"
            column-key="order_status"
            :filters="getCicdStatusFilters()"
            :filter-method="filterCicdStatus"
          >
            <template slot-scope="{ row }">
              <span class="cicd-status-tag" :class="cicdStatusClass(row.order_status)">
                {{ row.order_status || '-' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column prop="auto_total_atom" label="自动实施原子总数" width="150" align="center">
            <template slot-scope="{ row }">
              <el-popover placement="top" width="800" trigger="click" :popper-class="'cicd-atom-popover cicd-atom-popover--' + resolvedTheme">
                <el-table :data="getAtomDetails(row, 'auto_atom_detail')" size="mini" border max-height="320" empty-text="暂无数据">
                  <el-table-column prop="idc" label="机房" width="100" />
                  <el-table-column prop="module" label="发布类型" min-width="140" show-overflow-tooltip />
                  <el-table-column prop="key" label="关键词" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="systemDeployStatus" label="发布状态" width="120" />
                </el-table>
                <span slot="reference" class="cicd-link-num">{{ row.auto_total_atom }}</span>
              </el-popover>
            </template>
          </el-table-column>

          <el-table-column prop="auto_finish_atom" label="自动实施完成数" width="140" align="center" />

          <el-table-column prop="total_atom" label="原子数量" width="110" align="center">
            <template slot-scope="{ row }">
              <el-popover placement="top" width="800" trigger="click" :popper-class="'cicd-atom-popover cicd-atom-popover--' + resolvedTheme">
                <el-table :data="getAtomDetails(row, 'atom_detail')" size="mini" border max-height="320" empty-text="暂无数据">
                  <el-table-column prop="idc" label="机房" width="100" />
                  <el-table-column prop="module" label="发布类型" min-width="140" show-overflow-tooltip />
                  <el-table-column prop="key" label="关键词" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="systemDeployStatus" label="发布状态" width="120" />
                </el-table>
                <span slot="reference" class="cicd-link-num">{{ row.total_atom }}</span>
              </el-popover>
            </template>
          </el-table-column>

          <el-table-column prop="success_atom" label="已发布原子" width="110" align="center" />

          <el-table-column prop="executeUserName" label="当前实施人" width="130" />

          <el-table-column label="操作" align="center" width="80">
            <template slot-scope="scope">
              <el-button
                circle
                type="primary"
                size="mini"
                plain
                icon="el-icon-s-promotion"
                title="去执行"
                @click="toExecute(scope.row.order_id)"
              ></el-button>
            </template>
          </el-table-column>
        </el-table>

        <div slot="footer" class="cicd-dialog__footer">
          <el-button @click="cicdDialogVisible = false">关闭</el-button>
        </div>
      </el-dialog>

      <el-dialog
        :visible.sync="maintenanceNoticeVisible"
        title="维护公告"
        width="820px"
        top="6vh"
        :close-on-click-modal="false"
        append-to-body
        :class="['maintenance-notice-dialog', 'maintenance-notice-dialog--' + resolvedTheme]"
      >
        <div class="maintenance-notice__header">
          <div class="maintenance-notice__header-info">
            <span class="maintenance-notice__count">共 {{ maintenanceNoticeTotal }} 条公告</span>
          </div>
          <button class="quick-action" type="button" style="color:#409eff" @click="getMaintenanceNoticeList()">
            刷新数据
          </button>
        </div>

        <div class="maintenance-notice__body" v-loading="maintenanceNoticeLoading && maintenanceNoticeList.length > 0">
          <div v-if="maintenanceNoticeLoading && !maintenanceNoticeList.length" class="maintenance-notice__loading">
            <div v-for="i in 4" :key="i" class="maintenance-notice-skeleton" />
          </div>
          <div v-else-if="!maintenanceNoticeList.length" class="state-panel">
            <strong>暂无维护公告</strong>
            <span>当前没有维护公告记录。</span>
          </div>
          <div v-else class="maintenance-notice__list">
            <div
              v-for="row in maintenanceNoticeList"
              :key="row.informId"
              class="maintenance-notice-card"
              :class="{ 'is-expanded': isNoticeExpanded(row) }"
            >
              <div class="notice-card__main" @click="toggleNotice(row)">
                <div class="notice-card__left">
                  <span class="notice-status-tag" :class="reviewStatusClass(row.reviewStatus)">
                    {{ reviewStatusText(row.reviewStatus) }}
                  </span>
                </div>
                <div class="notice-card__center">
                  <h4 class="notice-card__title">{{ row.informTitle }}</h4>
                  <p class="notice-card__content">{{ row.informContent || row.areaContent || '暂无内容' }}</p>
                  <div class="notice-card__meta">
                    <span class="notice-card__time">
                      {{ formatNoticeTime(row.startTime) }} ~ {{ formatNoticeTime(row.endTime) }}
                    </span>
                    <span class="notice-card__contact">维护联系人：{{ row.contactBy }}</span>
                  </div>
                </div>
                <div class="notice-card__right">
                  <el-button
                    type="primary"
                    size="mini"
                    plain
                    @click.stop="handleViewNotice(row)"
                  >查看</el-button>
                  <i
                    class="el-icon-arrow-down notice-card__expand-icon"
                    :class="{ 'is-rotated': isNoticeExpanded(row) }"
                  />
                </div>
              </div>

              <transition name="notice-expand">
                <div v-if="isNoticeExpanded(row)" class="notice-card__detail">
                  <div class="notice-detail-grid">
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">影响范围</span>
                      <span class="notice-detail__value">{{ row.areaContent || '-' }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">通知内容</span>
                      <span class="notice-detail__value">{{ row.informContent || '-' }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">通知来源</span>
                      <span class="notice-detail__value">{{ row.informContent || '-' }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">维护联系人</span>
                      <span class="notice-detail__value">{{ row.contactBy }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">值班信息</span>
                      <span class="notice-detail__value">{{ row.informDuty }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">审核人</span>
                      <span class="notice-detail__value">{{ row.reviewer }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">审核意见</span>
                      <span class="notice-detail__value">{{ row.reviewComment || '无' }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">创建时间</span>
                      <span class="notice-detail__value">{{ row.createTime || '-' }}</span>
                    </div>
                    <div class="notice-detail-item">
                      <span class="notice-detail__label">更新时间</span>
                      <span class="notice-detail__value">{{ row.updateTime || '-' }}</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import { getOverviewExecutions, getOverviewMessages, getCicdImplementList, getMaintenanceNoticeList } from '@/api/tool/overview'

const ENV_CONFIG = [
  { key: 'prod', label: '生产' },
  { key: 'sandbox', label: '沙箱' },
  { key: 'failover', label: '灾备' },
  { key: 'ITSM', label: 'ITSM' }
]

// 统一卡片背景色系：四张系统卡片采用一致的青绿色 glass 背景，
// 保留浅色青绿氛围和柔和阴影，避免 ACT/DASP/PAY/BILLING 出现不同底色。
// 卡片内状态色（执行中/告警/异常等）仍由 --success / --waiting / --failed 控制，不受影响。
const SYSTEM_PALETTE = [
  { color: '#22D3EE', lightColor: '#06B6D4', soft: 'rgba(34, 211, 238, 0.12)', lightSoft: 'rgba(6, 182, 212, 0.08)' },
  { color: '#22D3EE', lightColor: '#06B6D4', soft: 'rgba(34, 211, 238, 0.12)', lightSoft: 'rgba(6, 182, 212, 0.08)' },
  { color: '#22D3EE', lightColor: '#06B6D4', soft: 'rgba(34, 211, 238, 0.12)', lightSoft: 'rgba(6, 182, 212, 0.08)' },
  { color: '#22D3EE', lightColor: '#06B6D4', soft: 'rgba(34, 211, 238, 0.12)', lightSoft: 'rgba(6, 182, 212, 0.08)' },
  { color: '#22D3EE', lightColor: '#06B6D4', soft: 'rgba(34, 211, 238, 0.12)', lightSoft: 'rgba(6, 182, 212, 0.08)' }
]

const THEME_STORAGE_KEY = 'overview-theme'
const CORE_SYSTEM_ORDER = ['ACT', 'DASP', 'PAY', 'BILLING']
const DEFAULT_INSPECTION_TIME = '2025-05-20 18:00:00'
const INSPECTION_FIELDS = [
  { key: 'impact', label: '关联系统影响' },
  { key: 'fullLink', label: '全链路' },
  { key: 'alert', label: '待处理告警' },
  { key: 'logCloud', label: '日志云' }
]

export default {
  name: 'Overview',
  data() {
    return {
      executionLoading: false,
      messageLoading: false,
      executionError: '',
      messageError: '',
      executionMap: {},
      messages: [],
      messageTotal: 0,
      newMessageCount: 0,
      messagePageNum: 1,
      messagePageSize: 10,
      knownMessageKeys: [],
      messageCollapsed: true,
      messageTimer: null,
      executionTimer: null,
      messageNewTimer: null,
      themeMediaQuery: null,
      themeMediaListener: null,
      themePreference: 'system',
      systemTheme: 'dark',
      firstMessageLoaded: false,
      messageLoadingMore: false,
      messageLoadMoreArmed: true,
      messageRequestSeq: 0,
      now: Date.now(),
      clockTimer: null,
      cicdDialogVisible: false,
      cicdLoading: false,
      cicdList: [],
      cicdError: '',
      maintenanceNoticeVisible: false,
      maintenanceNoticeLoading: false,
      maintenanceNoticeList: [],
      maintenanceNoticeTotal: 0,
      expandedNoticeId: null,
      maintenanceNoticeReviewMap: {
        '1': '已评审',
        '0': '未评审',
        '2': '评审拒绝'
      },
      url_pre: 'http://km.citiccard.com/pages/viewpage.action?pageId=',
      quickActions: [
        { key: 'cicd', label: 'CICD实施情况', icon: 'dashboard' },
        { key: 'manual', label: '手动协同', icon: 'peoples', disabled: true },
        { key: 'notice', label: '维护公告', icon: 'bell' },
        { key: 'timeline', label: '时序图', icon: 'chart' }
      ]
    }
  },
  computed: {
    resolvedTheme() {
      return this.themePreference === 'system' ? this.systemTheme : this.themePreference
    },
    themeClass() {
      return 'theme-' + this.resolvedTheme
    },
    visibleSystems() {
      const list = Object.keys(this.executionMap).map(name => {
        const source = this.executionMap[name] || {}
        const envs = ENV_CONFIG.map(config => this.normalizeEnv(config, source[config.key])).filter(Boolean)
        const total = envs.reduce((sum, env) => sum + env.total, 0)
        const finished = envs.reduce((sum, env) => sum + env.finished, 0)
        return {
          name,
          raw: source,
          envs,
          inspection: this.normalizeInspection(source),
          hasRunning: envs.some(env => env.running),
          percent: total ? Math.min(100, Math.round((finished / total) * 100)) : 0
        }
      }).filter(system => system.envs.length > 0).sort((a, b) => {
        const orderA = CORE_SYSTEM_ORDER.includes(a.name) ? CORE_SYSTEM_ORDER.indexOf(a.name) : CORE_SYSTEM_ORDER.length
        const orderB = CORE_SYSTEM_ORDER.includes(b.name) ? CORE_SYSTEM_ORDER.indexOf(b.name) : CORE_SYSTEM_ORDER.length
        return orderA === orderB ? a.name.localeCompare(b.name) : orderA - orderB
      })
      // 已完成沉底：非已完成保持原顺序在前，已完成排到末尾
      const incomplete = []
      const complete = []
      list.forEach(s => {
        if (!s.hasRunning && s.percent >= 100) {
          complete.push(s)
        } else {
          incomplete.push(s)
        }
      })
      return incomplete.concat(complete)
    },
    overviewStats() {
      const systems = this.visibleSystems
      const envs = systems.reduce((list, system) => list.concat(system.envs), [])
      const total = envs.reduce((sum, env) => sum + env.total, 0)
      const finished = envs.reduce((sum, env) => sum + env.finished, 0)
      return {
        systems: systems.length,
        runningSystems: systems.filter(system => system.hasRunning).length,
        envs: envs.length,
        runningEnvs: envs.filter(env => env.running).length,
        percent: total ? Math.min(100, Math.round((finished / total) * 100)) : 0
      }
    },
    currentTime() {
      return this.formatClockTime(new Date(this.now))
    },
    fullDateTime() {
      return this.formatFullDateTime(new Date(this.now))
    },
  },
  created() {
    this.initTheme()
    this.fetchExecutions()
    this.fetchMessages({ appendNew: false })
    this.getMaintenanceNoticeList({ silent: true })
    this.executionTimer = window.setInterval(this.fetchExecutions, 12000)
    this.messageTimer = window.setInterval(() => this.fetchMessages({ appendNew: true }), 5000)
    this.clockTimer = window.setInterval(() => {
      this.now = Date.now()
    }, 1000)
  },
  beforeDestroy() {
    window.clearInterval(this.executionTimer)
    window.clearInterval(this.messageTimer)
    window.clearInterval(this.clockTimer)
    window.clearTimeout(this.messageNewTimer)
    this.destroyThemeListener()
  },
  methods: {
    initTheme() {
      const storedTheme = window.localStorage && window.localStorage.getItem(THEME_STORAGE_KEY)
      this.themePreference = ['light', 'dark'].includes(storedTheme) ? storedTheme : 'system'
      if (window.matchMedia) {
        this.themeMediaQuery = window.matchMedia('(prefers-color-scheme: light)')
        this.systemTheme = this.themeMediaQuery.matches ? 'light' : 'dark'
        this.themeMediaListener = event => {
          this.systemTheme = event.matches ? 'light' : 'dark'
        }
        if (this.themeMediaQuery.addEventListener) {
          this.themeMediaQuery.addEventListener('change', this.themeMediaListener)
        } else if (this.themeMediaQuery.addListener) {
          this.themeMediaQuery.addListener(this.themeMediaListener)
        }
      }
    },
    destroyThemeListener() {
      if (!this.themeMediaQuery || !this.themeMediaListener) {
        return
      }
      if (this.themeMediaQuery.removeEventListener) {
        this.themeMediaQuery.removeEventListener('change', this.themeMediaListener)
      } else if (this.themeMediaQuery.removeListener) {
        this.themeMediaQuery.removeListener(this.themeMediaListener)
      }
    },
    toggleTheme() {
      this.themePreference = this.resolvedTheme === 'light' ? 'dark' : 'light'
      if (window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, this.themePreference)
      }
    },
    refreshOverview() {
      this.fetchExecutions()
      this.fetchMessages({ appendNew: false })
    },
    fetchExecutions() {
      this.executionLoading = !Object.keys(this.executionMap).length
      return getOverviewExecutions().then(res => {
        this.executionMap = res.data || {}
        this.executionError = ''
      }).catch(() => {
        this.executionError = '执行情况加载失败'
      }).finally(() => {
        this.executionLoading = false
      })
    },
    fetchMessages(options = {}) {
      if (this.messageLoading && options.appendNew) {
        return Promise.resolve()
      }
      this.messageLoading = true
      const requestSeq = ++this.messageRequestSeq
      const messageBody = this.$refs.messageBody
      const shouldHoldHistoryPosition = messageBody && messageBody.scrollTop > 24
      const previousScrollHeight = messageBody ? messageBody.scrollHeight : 0
      const previousScrollTop = messageBody ? messageBody.scrollTop : 0
      return getOverviewMessages({
        pageNum: this.messagePageNum,
        pageSize: this.messagePageSize,
        appendNew: Boolean(options.appendNew) && !options.keepScroll && !options.keepScrollTop
      }).then(res => {
        if (requestSeq !== this.messageRequestSeq) {
          return
        }
        const rows = Array.isArray(res.rows) ? res.rows : []
        const oldKeys = new Set(this.knownMessageKeys)
        const currentMap = new Map(this.messages.map(item => [this.messageKey(item), item]))
        const beforeRects = this.captureMessageRects()
        const canAnimateMoves = this.firstMessageLoaded && !options.keepScroll
        const canMarkNew = this.firstMessageLoaded && !options.keepScrollTop
        let insertIndex = 0
        const nextRows = rows
          .slice()
          .sort(this.sortMessages)
          .slice(0, this.messagePageSize)
          .map(item => {
            const key = this.messageKey(item)
            const oldItem = currentMap.get(key)
            const isNew = canMarkNew && !oldKeys.has(key)
            const wasNew = Boolean(oldItem && oldItem._isNew)
            return {
              ...(oldItem || {}),
              ...item,
              _isNew: isNew || wasNew,
              _newIndex: isNew ? insertIndex++ : (wasNew ? oldItem._newIndex : 0)
            }
          })
        this.messages = nextRows
        this.messageTotal = res.total || nextRows.length
        this.newMessageCount = nextRows.filter(item => item._isNew).length
        this.knownMessageKeys = nextRows.map(this.messageKey)
        this.firstMessageLoaded = true
        this.messageError = ''
        if (insertIndex > 0 || options.keepScroll) {
          this.keepMessageScrollPosition(previousScrollHeight, previousScrollTop, shouldHoldHistoryPosition || options.keepScroll, insertIndex, options.keepScrollTop)
        }
        if (canAnimateMoves) {
          this.animateMessageMoves(beforeRects)
        }
        if (insertIndex > 0) {
          window.clearTimeout(this.messageNewTimer)
          this.messageNewTimer = window.setTimeout(this.clearNewMessageState, 4600)
        }
      }).catch(() => {
        if (requestSeq !== this.messageRequestSeq) {
          return
        }
        this.messageError = '状态消息加载失败'
      }).finally(() => {
        if (requestSeq === this.messageRequestSeq) {
          this.messageLoading = false
          this.messageLoadingMore = false
        }
      })
    },
    handleMessageScroll() {
      const messageBody = this.$refs.messageBody
      if (!messageBody || this.messageLoading || this.messageLoadingMore) {
        return
      }
      if (this.messages.length >= this.messageTotal) {
        return
      }
      const distanceToBottom = messageBody.scrollHeight - messageBody.scrollTop - messageBody.clientHeight
      if (distanceToBottom > 32) {
        this.messageLoadMoreArmed = true
        return
      }
      if (!this.messageLoadMoreArmed) {
        return
      }
      this.messageLoadMoreArmed = false
      this.messageLoadingMore = true
      this.messagePageSize += 20
      this.fetchMessages({ keepScroll: true, keepScrollTop: true })
    },
    normalizeEnv(config, env) {
      if (!env || Number(env.total) === 0) {
        return null
      }
      const total = Number(env.total) || 0
      const finished = Number(env.finished) || 0
      const percent = total ? Math.min(100, Math.round((finished / total) * 100)) : 0
      return {
        key: config.key,
        label: config.label,
        total,
        finished,
        planId: env.planId,
        percent,
        running: finished < total,
        activateOpr: env.activateOpr || '',
        auditOpr: env.auditOpr || '',
        checkOpr: env.checkOpr || '',
        collectOpr: env.collectOpr || '',
        nodeIds: env.nodeIds
      }
    },
    normalizeInspection(source) {
      const nested = source.inspection || {}
      return INSPECTION_FIELDS.reduce((result, field) => {
        result[field.key] = this.normalizeInspectionItem(nested[field.key] || source[field.key])
        return result
      }, {})
    },
    normalizeInspectionItem(item) {
      const sourceStatus = item && item.status ? String(item.status).toLowerCase() : ''
      const status = sourceStatus === 'error' ? 'error' : 'inspected'
      const time = item && item.time ? String(item.time) : DEFAULT_INSPECTION_TIME
      return {
        status,
        time
      }
    },
    sortMessages(a, b) {
      const timeA = a.createTime || a.updateTime || ''
      const timeB = b.createTime || b.updateTime || ''
      if (timeA !== timeB) {
        return timeA > timeB ? -1 : 1
      }
      return Number(b.apemId || 0) - Number(a.apemId || 0)
    },
    messageKey(item) {
      return String(item.apemId || item.id || [item.createTime, item.apemMessageStr].join('-'))
    },
    messageInsertStyle(item) {
      return {
        '--message-delay': `${Number(item._newIndex || 0) * 90}ms`
      }
    },
    captureMessageRects() {
      const messageBody = this.$refs.messageBody
      if (!messageBody) {
        return new Map()
      }
      return new Map(Array.from(messageBody.querySelectorAll('.message-item')).map(el => [
        el.getAttribute('data-message-key'),
        el.getBoundingClientRect()
      ]))
    },
    animateMessageMoves(beforeRects) {
      if (!beforeRects || !beforeRects.size) {
        return
      }
      this.$nextTick(() => {
        const messageBody = this.$refs.messageBody
        if (!messageBody) {
          return
        }
        Array.from(messageBody.querySelectorAll('.message-item')).forEach(el => {
          const key = el.getAttribute('data-message-key')
          const beforeRect = beforeRects.get(key)
          if (!beforeRect) {
            return
          }
          const afterRect = el.getBoundingClientRect()
          const deltaY = beforeRect.top - afterRect.top
          if (Math.abs(deltaY) < 1) {
            return
          }
          el.classList.add('is-shifting')
          el.style.setProperty('--message-shift-y', `${deltaY}px`)
          window.setTimeout(() => {
            el.classList.remove('is-shifting')
            el.style.removeProperty('--message-shift-y')
          }, 520)
        })
      })
    },
    keepMessageScrollPosition(previousScrollHeight, previousScrollTop, shouldHoldHistoryPosition, insertCount = 0, keepScrollTop = false) {
      this.$nextTick(() => {
        const messageBody = this.$refs.messageBody
        if (!messageBody) {
          return
        }
        if (keepScrollTop) {
          messageBody.scrollTop = previousScrollTop
          return
        }
        if (shouldHoldHistoryPosition) {
          messageBody.scrollTop = previousScrollTop + messageBody.scrollHeight - previousScrollHeight
          return
        }
        if (insertCount > 0) {
          messageBody.scrollTo({
            top: 0,
            behavior: 'smooth'
          })
        }
      })
    },
    clearNewMessageState() {
      this.messages = this.messages.map(item => ({
        ...item,
        _isNew: false,
        _newIndex: 0
      }))
      this.newMessageCount = 0
    },
    normalizeLevel(level) {
      return String(level || 'info').toLowerCase()
    },
    systemStyle(system, index) {
      const item = SYSTEM_PALETTE[index % SYSTEM_PALETTE.length]
      const color = this.resolvedTheme === 'light' ? item.lightColor : item.color
      return {
        '--system-accent': color,
        '--system-accent-soft': this.resolvedTheme === 'light' ? item.lightSoft : item.soft,
        '--system-glow': this.hexToRgba(color, this.resolvedTheme === 'light' ? 0.18 : 0.26)
      }
    },
    systemStatusClass(system) {
      if (system.hasRunning) {
        return 'is-running'
      }
      return system.percent >= 100 ? 'is-complete' : 'is-waiting'
    },
    systemStatusText(system) {
      if (system.hasRunning) {
        return '执行中'
      }
      return system.percent >= 100 ? '已完成' : '等待中'
    },
    systemActiveText(system) {
      const running = system.envs.filter(env => env.running).length
      if (running) {
        return `${running} 个活跃`
      }
      return '全部稳定'
    },
    envStatusClass(env) {
      if (env.running) {
        return 'is-running'
      }
      return env.percent >= 100 ? 'is-complete' : 'is-waiting'
    },
    // 变更计划方块样式类
    envBlockClass(env) {
      if (env.running) {
        return 'is-active'
      }
      return env.percent >= 100 ? 'is-done' : 'is-idle'
    },
    // 变更计划激活文案（使用接口返回的 activateOpr 字段，不再写死）
    envActiveText(env) {
      return env.activateOpr || (env.running || env.percent >= 100 ? '已激活' : '未激活')
    },
    // 变更计划激活状态动态样式类
    envActiveClass(env) {
      const text = this.envActiveText(env)
      if (text === '已激活') return 'is-activated'
      if (text === '待激活') return 'is-pending'
      return 'is-inactive'
    },
    // 是否已激活
    isEnvActivated(env) {
      return env && env.activateOpr === '已激活'
    },
    // 是否有异常节点
    hasEnvNodeIds(env) {
      const nodeIds = env && env.nodeIds
      if (Array.isArray(nodeIds)) return nodeIds.length > 0
      if (typeof nodeIds === 'string') return nodeIds.trim() !== ''
      return !!nodeIds
    },
    // 变更计划方框视觉状态 class
    envVisualClass(env) {
      if (this.isEnvActivated(env) && this.hasEnvNodeIds(env)) {
        return 'is-env-error'
      }
      if (this.isEnvActivated(env) && !this.hasEnvNodeIds(env)) {
        return 'is-env-running'
      }
      return 'is-env-static'
    },
    // 告警数量（占位：从巡检数据 alert 字段派生）
    systemAlertCount(system) {
      const alertItem = system.inspection && system.inspection.alert
      return alertItem && alertItem.status === 'error' ? 1 : 0
    },
    // 告警指标样式类
    systemAlertClass(system) {
      return this.systemAlertCount(system) > 0 ? 'is-warning' : ''
    },
    // 巡检状态（占位：后续需对接后端字段 system.patrolStatus）
    systemInspectionStatus(system) {
      const inspection = system.inspection || {}
      const hasError = INSPECTION_FIELDS.some(field => {
        const item = inspection[field.key]
        return item && item.status === 'error'
      })
      return hasError ? '异常' : '正常'
    },
    // 巡检指标样式类
    systemInspectionClass(system) {
      return this.systemInspectionStatus(system) === '异常' ? 'is-error' : ''
    },
    messageTone(item) {
      const level = this.normalizeLevel(item.apemMessageLevel)
      if (level === 'error') {
        return 'failed'
      }
      if (level === 'warn' || level === 'warning') {
        return 'waiting'
      }
      return 'success'
    },
    messageToneClass(item) {
      return 'tone-' + this.messageTone(item)
    },
    messageToneText(item) {
      const tone = this.messageTone(item)
      if (tone === 'failed') {
        return '失败'
      }
      if (tone === 'waiting') {
        return '等待'
      }
      return '成功'
    },
    messageTitle(item) {
      return item.awiWorkflowInstanceName || item.aripExecPlanName || item.aripExecSys || '系统事件'
    },
    messageDescription(item) {
      const parts = []
      if (item.aniInstanceNodeName) {
        parts.push(`${item.aniInstanceNodeName}节点`)
      }
      if (item.aaiAtomName) {
        parts.push(`${item.aaiAtomName}原子`)
      }
      if (item.apemFunctionName) {
        parts.push(`发布函数(${item.apemFunctionName})`)
      }
      if (item.apemMessageStr) {
        parts.push(item.apemMessageStr)
      }
      return parts.join('，') || '状态发生变化'
    },
    formatShortTime(time) {
      if (!time) {
        return ''
      }
      return String(time).slice(5, 16)
    },
    messageTypeText(type) {
      const map = {
        manual: '手工',
        program: '自动'
      }
      return map[type] || type || '系统'
    },
    formatClockTime(date) {
      const h = String(date.getHours()).padStart(2, '0')
      const m = String(date.getMinutes()).padStart(2, '0')
      const s = String(date.getSeconds()).padStart(2, '0')
      return `${h}:${m}:${s}`
    },
    formatFullDateTime(date) {
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const h = String(date.getHours()).padStart(2, '0')
      const min = String(date.getMinutes()).padStart(2, '0')
      const s = String(date.getSeconds()).padStart(2, '0')
      const w = weekDays[date.getDay()]
      return `${y}-${m}-${d} ${w} ${h}:${min}:${s}`
    },
    hexToRgba(hex, alpha) {
      const value = String(hex || '#22D3EE').replace('#', '')
      const bigint = parseInt(value, 16)
      const r = (bigint >> 16) & 255
      const g = (bigint >> 8) & 255
      const b = bigint & 255
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    },

    // ---- CICD 实施情况 ----

    handleQuickAction(action) {
      if (action.key === 'cicd') {
        this.handleOpenCicdDialog()
      } else if (action.key === 'notice') {
        this.openMaintenanceNotice()
      }
    },

    handleOpenCicdDialog() {
      this.cicdDialogVisible = true
      if (!this.cicdList.length) {
        this.fetchCicdList({ silent: true })
      }
    },

    fetchCicdList(options = {}) {
      this.cicdLoading = true
      this.cicdError = ''
      return getCicdImplementList().then(res => {
        this.cicdList = this.normalizeCicdRows(res.data || [])
        if (!options.silent) {
          this.$message && this.$message.success('刷新成功')
        }
      }).catch(() => {
        this.cicdError = 'CICD 实施情况加载失败，请稍后重试'
        this.$message && this.$message.error('CICD 实施情况加载失败')
      }).finally(() => {
        this.cicdLoading = false
      })
    },

    normalizeCicdRows(rows) {
      if (!Array.isArray(rows)) return []
      return rows.map(row => ({
        order_id: row.order_id || '-',
        order_status: row.order_status || '-',
        auto_total_atom: Number(row.auto_total_atom) || 0,
        auto_finish_atom: Number(row.auto_finish_atom) || 0,
        total_atom: Number(row.total_atom) || 0,
        success_atom: Number(row.success_atom) || 0,
        executeUserName: row.executeUserName || '-',
        auto_atom_detail: Array.isArray(row.auto_atom_detail) ? row.auto_atom_detail : [],
        atom_detail: Array.isArray(row.atom_detail) ? row.atom_detail : []
      }))
    },

    getCicdStatusFilters() {
      const STATUS_ORDER = [
        '业务验证', '成功', '部分成功', '失败', '取消',
        '待实施', '实施中', '预审', '草稿', '审批中',
        '审批通过', '工单已确认', '审批不通过', '预审驳回'
      ]
      const orderMap = new Map(STATUS_ORDER.map((s, i) => [s, i]))
      const statusSet = new Set()
      this.cicdList.forEach(row => {
        if (row.order_status) {
          statusSet.add(row.order_status)
        }
      })
      return Array.from(statusSet)
        .sort((a, b) => {
          const ai = orderMap.has(a) ? orderMap.get(a) : STATUS_ORDER.length
          const bi = orderMap.has(b) ? orderMap.get(b) : STATUS_ORDER.length
          return ai !== bi ? ai - bi : a.localeCompare(b)
        })
        .map(s => ({ text: s, value: s }))
    },

    filterCicdStatus(value, row) {
      return row.order_status === value
    },

    getAtomDetails(row, field) {
      const detail = row && row[field]
      return Array.isArray(detail) ? detail : []
    },

    toExecute(id) {
      setTimeout(() => {
        if (id.includes('CHGU')) {
          window.open('http://it/v2/changeOrder');
        } else if (id.includes('CHG')) {
          window.open(
            'http://cicd.omp.eprod-kzx1.cncb/pom/#/maintainOrder/execute/' +
              id
          );
        } else {
          window.open(
            'http://cicd.omp.eprod-kzx1.cncb/pom/#/deployOrder/execute/' +
              id
          );
        }
      });
    },

    jump2Execute(item) {
      if (!item || !item.planId) {
        this.$message && this.$message.warning('缺少变更计划ID')
        return
      }
      const { href } = this.$router.resolve({
        path: '/execute',
        query: { aripExecPlanId: item.planId }
      })
      window.open(href, '_blank')
    },

    // ---- 维护公告 ----

    openMaintenanceNotice() {
      this.maintenanceNoticeVisible = true
      this.getMaintenanceNoticeList({ silent: true })
    },

    getMaintenanceNoticeList(options = {}) {
      this.maintenanceNoticeLoading = true
      return getMaintenanceNoticeList().then(res => {
        this.maintenanceNoticeList = this.normalizeMaintenanceRows(res.rows || [])
        this.maintenanceNoticeTotal = res.total || this.maintenanceNoticeList.length
        if (!options.silent) {
          this.$message && this.$message.success('刷新成功')
        }
      }).catch(() => {
        if (!options.silent) {
          this.$message && this.$message.error('维护公告加载失败')
        }
      }).finally(() => {
        this.maintenanceNoticeLoading = false
      })
    },

    normalizeMaintenanceRows(rows) {
      if (!Array.isArray(rows)) return []
      return rows.map(row => ({
        informId: row.informId,
        informTitle: row.informTitle || '暂无标题',
        areaContent: row.areaContent || '',
        informContent: row.informContent || '',
        contactBy: row.contactBy || '-',
        informDuty: row.informDuty || '-',
        informUrl: row.informUrl || '',
        reviewStatus: String(row.reviewStatus || '0'),
        reviewer: row.reviewer || '-',
        reviewComment: row.reviewComment || '',
        createBy: row.createBy || '-',
        createTime: row.createTime || '',
        updateTime: row.updateTime || '',
        startTime: row.startTime || '',
        endTime: row.endTime || ''
      }))
    },

    jump2Km(url) {
      if (!url) {
        this.$message && this.$message.warning('暂无可查看链接')
        return
      }
      window.open(this.url_pre + url, '_blank')
    },

    handleViewNotice(row) {
      this.jump2Km(row.informUrl)
    },

    toggleNotice(row) {
      this.expandedNoticeId = this.expandedNoticeId === row.informId ? null : row.informId
    },

    isNoticeExpanded(row) {
      return this.expandedNoticeId === row.informId
    },

    reviewStatusText(status) {
      return this.maintenanceNoticeReviewMap[status] || '未知'
    },

    reviewStatusClass(status) {
      const map = {
        '1': 'is-passed',
        '0': 'is-unreviewed',
        '2': 'is-rejected'
      }
      return map[status] || ''
    },

    formatNoticeTime(time) {
      if (!time) return '-'
      return String(time).slice(0, 16)
    },

    cicdStatusClass(status) {
      const value = (status || '').trim()
      const map = {
        '业务验证': 'is-verify',
        '成功': 'is-success',
        '审批通过': 'is-success',
        '工单已确认': 'is-success',
        '部分成功': 'is-partial',
        '失败': 'is-danger',
        '审批不通过': 'is-danger',
        '预审驳回': 'is-danger',
        '取消': 'is-cancelled',
        '待实施': 'is-pending',
        '草稿': 'is-pending',
        '实施中': 'is-running',
        '预审': 'is-review',
        '审批中': 'is-review'
      }
      return map[value] || 'is-unknown'
    }
  }
}
</script>

<style lang="scss" scoped>
.overview-page {
  --page-bg: #050B15;
  --page-bg-layer: var(--page-bg);
  --panel-bg: linear-gradient(145deg, rgba(14, 25, 42, 0.95), rgba(9, 16, 28, 0.95));
  --panel-bg-strong: linear-gradient(145deg, rgba(16, 31, 52, 0.98), rgba(7, 13, 24, 0.98));
  --system-card-bg: linear-gradient(145deg, rgba(11, 22, 38, 0.95), rgba(4, 11, 24, 0.95));
  --panel-border: rgba(34, 211, 238, 0.2);
  --panel-border-strong: rgba(34, 211, 238, 0.38);
  --shadow-soft: 0 10px 40px rgba(0, 0, 0, 0.4);
  --shadow-hover: 0 8px 30px rgba(0, 0, 0, 0.35);
  --text-main: #EAF4FF;
  --text-muted: #C8D7E6;
  --text-soft: #A7B9CC;
  --line-soft: rgba(34, 211, 238, 0.38);
  --shell-wash: linear-gradient(120deg, rgba(34, 211, 238, 0.1), transparent 28%, transparent 74%, rgba(0, 245, 160, 0.08)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 34%);
  --grid-line-x: rgba(34, 211, 238, 0.04);
  --grid-line-y: rgba(34, 211, 238, 0.035);
  --button-bg: rgba(255, 255, 255, 0.03);
  --button-border: rgba(34, 211, 238, 0.15);
  --muted-surface: rgba(5, 11, 21, 0.42);
  --head-bg: rgba(5, 11, 21, 0.22);
  --tag-bg: rgba(255, 255, 255, 0.04);
  --accent: #22D3EE;
  --success: #00F5A0;
  --failed: #FF5B79;
  --waiting: #FFB84D;
  --pending: #FACC15;
  --pending-soft: rgba(250, 204, 21, 0.14);
  --radius: 18px;
  position: relative;
  height: calc(100vh - 84px);
  min-height: 720px;
  overflow: hidden;
  padding: 12px 16px 14px;
  color: var(--text-main);
  background:
    linear-gradient(90deg, var(--grid-line-x) 1px, transparent 1px),
    linear-gradient(180deg, var(--grid-line-y) 1px, transparent 1px),
    var(--page-bg-layer);
  background-size: 64px 64px, 64px 64px, auto;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.overview-page::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--shell-wash);
}

.overview-page.theme-light {
  --page-bg: #F7F9FC;
  --page-bg-layer: linear-gradient(180deg, #F7F9FC, #EEF4F9);
  --panel-bg: rgba(255, 255, 255, 0.85);
  --panel-bg-strong: rgba(255, 255, 255, 0.92);
  --system-card-bg: rgba(255, 255, 255, 0.86);
  --panel-border: rgba(15, 23, 42, 0.06);
  --panel-border-strong: rgba(6, 182, 212, 0.28);
  --shadow-soft: 0 8px 30px rgba(15, 23, 42, 0.06);
  --shadow-hover: 0 8px 30px rgba(15, 23, 42, 0.08);
  --text-main: #0F172A;
  --text-muted: #475569;
  --text-soft: #64748B;
  --line-soft: rgba(6, 182, 212, 0.22);
  --shell-wash:
    radial-gradient(circle at 18% 0%, rgba(6, 182, 212, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent 38%);
  --grid-line-x: rgba(15, 23, 42, 0.035);
  --grid-line-y: rgba(15, 23, 42, 0.03);
  --button-bg: rgba(255, 255, 255, 0.62);
  --button-border: rgba(15, 23, 42, 0.08);
  --muted-surface: rgba(248, 250, 252, 0.78);
  --head-bg: rgba(255, 255, 255, 0.36);
  --tag-bg: rgba(15, 23, 42, 0.05);
  --time-text: #64748B;
  --tooltip-bg: #FFFFFF;
  --tooltip-text: #334155;
  --tooltip-border: rgba(15, 23, 42, 0.08);
  --ring-track: rgba(15, 23, 42, 0.08);
  --scrollbar-thumb: rgba(15, 23, 42, 0.16);
  --accent: #06B6D4;
  --success: #10B981;
  --failed: #F43F5E;
  --waiting: #F59E0B;
  --pending: #CA8A04;
  --pending-soft: rgba(202, 138, 4, 0.12);
}

.overview-page.theme-dark {
  --time-text: #9FB3C8;
  --tooltip-bg: #101C2E;
  --tooltip-text: #C8D7E6;
  --tooltip-border: rgba(34, 211, 238, 0.2);
  --ring-track: rgba(255, 255, 255, 0.08);
  --scrollbar-thumb: rgba(34, 211, 238, 0.18);
}

.overview-page.theme-light .tech-icon {
  background:
    radial-gradient(circle at 35% 24%, rgba(255, 255, 255, 0.9), transparent 24%),
    linear-gradient(145deg, rgba(6, 182, 212, 0.16), rgba(255, 255, 255, 0.84));
  border-color: rgba(6, 182, 212, 0.16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px rgba(15, 23, 42, 0.06);
}

.overview-page.theme-light .env-block.is-env-running::before {
  opacity: 0.34;
}

.overview-page.theme-light .env-block.is-env-running::after {
  width: 52%;
  background: linear-gradient(100deg, transparent 0%, rgba(6, 182, 212, 0.12) 22%, rgba(255, 255, 255, 0.68) 36%, var(--system-accent) 52%, rgba(6, 182, 212, 0.22) 68%, transparent 100%);
  filter: blur(6px) saturate(1.7);
  mix-blend-mode: normal;
}

.overview-page.theme-light .env-block.is-env-running {
  box-shadow: inset 0 0 0 1px rgba(6, 182, 212, 0.16), 0 0 16px rgba(6, 182, 212, 0.12);
}

.overview-page.theme-light .env-block.is-env-error {
  background: linear-gradient(145deg, rgba(239, 68, 68, 0.1), var(--muted-surface));
  border-color: rgba(239, 68, 68, 0.2);
  border-top-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.08), inset 0 0 12px rgba(239, 68, 68, 0.04);
}

.overview-page.theme-light .env-block.is-env-error::after {
  width: 52%;
  background: linear-gradient(100deg, transparent 0%, rgba(239, 68, 68, 0.15) 22%, rgba(248, 113, 113, 0.5) 36%, rgba(239, 68, 68, 0.35) 52%, rgba(239, 68, 68, 0.15) 68%, transparent 100%);
  filter: blur(6px) saturate(1.7);
  mix-blend-mode: normal;
}

.overview-page.theme-light .env-block {
  --hover-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  --hover-bg: linear-gradient(145deg, var(--system-accent-soft), transparent 50%);
  --hover-border: rgba(15, 23, 42, 0.07);

  &.is-done {
    background: rgba(16, 185, 129, 0.08);
  }
}

.overview-page.theme-light .system-card:hover {
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(6, 182, 212, 0.08);
}

.overview-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}


.tech-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  color: var(--accent);
  background:
    radial-gradient(circle at 35% 24%, rgba(255, 255, 255, 0.35), transparent 24%),
    linear-gradient(145deg, rgba(34, 211, 238, 0.24), rgba(4, 12, 24, 0.86));
  border: 1px solid rgba(34, 211, 238, 0.22);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -10px 18px rgba(0, 0, 0, 0.18),
    0 0 18px rgba(34, 211, 238, 0.14);
}

.tech-icon::after {
  content: "";
  position: absolute;
  inset: 3px;
  pointer-events: none;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tech-icon .svg-icon {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.7));
}

.panel-surface,
.system-card {
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}

.system-card:hover,
.panel-surface:hover {
  border-color: var(--panel-border-strong);
  box-shadow: var(--shadow-hover), 0 0 0 1px rgba(34, 211, 238, 0.08);
}

.overview-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 14px;
  transition: all 0.3s ease;
}

.overview-layout.is-message-collapsed {
  grid-template-columns: minmax(0, 1fr) 0;
}

.panel-surface {
  min-height: 0;
  border-radius: var(--radius);
  transition: all 0.3s ease;
  overflow: hidden;
}

.execution-panel {
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.panel-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 66px;
  padding: 12px 16px;
  background: var(--head-bg);
}

.panel-head__left {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 18px;
  font-weight: 680;
}

.panel-head span {
  display: block;
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 12px;
}

.panel-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-title__icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  color: var(--accent);
  background:
    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.36), transparent 26%),
    rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.2);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -14px 24px rgba(0, 0, 0, 0.24),
    0 0 24px rgba(34, 211, 238, 0.16);
}

.panel-title__icon .svg-icon {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 9px rgba(34, 211, 238, 0.75));
}

.execution-toolbar {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-action {
  height: 34px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-main);
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
  transition: all 0.3s ease;
}

.quick-action .tech-icon {
  width: 20px;
  height: 20px;
  border-radius: 8px;
}

.quick-action .tech-icon .svg-icon {
  width: 16px;
  height: 16px;
}

.quick-action:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);
}

.quick-action__badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  background: var(--accent);
  border-radius: 999px;
  margin-left: 2px;
}

.quick-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.panel-live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px;
  color: var(--success);
  background: rgba(0, 245, 160, 0.1);
  border: 1px solid rgba(0, 245, 160, 0.18);
  border-radius: 999px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.panel-live i {
  width: 7px;
  height: 7px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 16px rgba(0, 245, 160, 0.9);
}

.panel-live__sep {
  opacity: 0.5;
  font-weight: 400;
}

.panel-live__time {
  display: inline;
  margin-top: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.execution-scroll,
.message-panel__body {
  min-height: 0;
  overflow: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.execution-scroll {
  flex: 1;
  min-height: 0;
  padding: 8px 14px 18px;
  overflow: visible;
}

.execution-scroll::-webkit-scrollbar,
.message-panel__body::-webkit-scrollbar {
  width: 8px;
}

.execution-scroll::-webkit-scrollbar-thumb,
.message-panel__body::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
}

.system-grid,
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 400px));
  gap: 14px;
  justify-content: start;
}

.system-card {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border-radius: 20px;
  background: var(--system-card-bg);
  transition: all 0.3s ease;
  width: 100%;
  max-width: 400px;
  min-width: 0;
}

.system-card::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 34%),
    linear-gradient(180deg, var(--system-accent-soft), transparent 56%);
  opacity: 0.86;
}

.system-card:hover {
  transform: translateY(-4px);
  border-color: var(--system-accent);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.38), 0 0 24px var(--system-glow);
}

/* ---- 系统卡片身份区 ---- */

.system-card__identity {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.system-identity__main {
  min-width: 0;
  flex: 1 1 auto;
}

.system-identity__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.system-identity__head h3 {
  margin: 0;
  overflow: hidden;
  color: var(--text-main);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-card__identity p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.system-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  flex: 0 0 auto;
}

.system-status.is-running {
  color: var(--success);
  background: rgba(0, 245, 160, 0.1);
}

.system-status.is-complete {
  color: var(--accent);
  background: rgba(34, 211, 238, 0.1);
}

.system-status.is-waiting {
  color: var(--waiting);
  background: rgba(255, 184, 77, 0.1);
}

/* ---- 系统指标胶囊 ---- */

.system-identity__metrics {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 0 auto;
}

.system-metric {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  background: var(--muted-surface);
  border: 1px solid var(--panel-border);
  transition: all 0.3s ease;
}

.system-metric__label {
  color: var(--text-soft);
}

.system-metric__value {
  font-weight: 650;
  font-family: Consolas, Monaco, monospace;
  color: var(--text-main);
}

.system-metric.is-warning {
  border-color: rgba(255, 184, 77, 0.3);
  background: rgba(255, 184, 77, 0.08);
}

.system-metric.is-warning .system-metric__value {
  color: var(--waiting);
}

.system-metric.is-error {
  border-color: rgba(255, 91, 121, 0.3);
  background: rgba(255, 91, 121, 0.08);
}

.system-metric.is-error .system-metric__value {
  color: var(--failed);
}

.system-metric.is-placeholder {
  opacity: 0.35;
  pointer-events: none;
}

/* ---- 变更计划方块网格 ---- */

.env-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.env-block {
  --env-tone: var(--accent);
  --hover-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
  --hover-bg: linear-gradient(145deg, var(--system-accent-soft), transparent 55%);
  --hover-border: rgba(255, 255, 255, 0.07);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  aspect-ratio: 1 / 1;
  min-width: 0;
  overflow: hidden;
  padding: 14px 10px 10px;
  background: var(--muted-surface);
  border: 1px solid var(--panel-border);
  border-top: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(.2,.8,.2,1),
              box-shadow 0.22s cubic-bezier(.2,.8,.2,1),
              border-color 0.22s cubic-bezier(.2,.8,.2,1);
}

.env-block.is-active {
  --env-tone: var(--success);
  border-top-color: var(--success);
}

.env-block.is-done {
  --env-tone: var(--accent);
  border-top-color: var(--accent);
  background: rgba(0, 245, 160, 0.06);
}

.env-block.is-idle {
  --env-tone: var(--waiting);
  border-top-color: var(--waiting);
}

.env-block::before,
.env-block::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  border-radius: inherit;
  z-index: 0;
}

.env-block::before {
  background:
    linear-gradient(90deg, transparent, var(--system-accent-soft), transparent),
    radial-gradient(circle at 18% 50%, var(--system-accent-soft), transparent 34%);
}

.env-block::after {
  width: 42%;
  background: linear-gradient(100deg, transparent 0%, rgba(255, 255, 255, 0.12) 30%, var(--system-accent) 50%, rgba(255, 255, 255, 0.12) 68%, transparent 100%);
  filter: blur(8px);
  mix-blend-mode: screen;
  transform: translateX(-145%);
}

/* ---- 变更计划方框视觉状态 ---- */

/* 执行中：正常光影流光 */
.env-block.is-env-running::before {
  opacity: 0.32;
}

.env-block.is-env-running::after {
  animation: envEnergySweep 4.2s cubic-bezier(0.45, 0, 0.2, 1) infinite;
}

.env-block.is-env-running:hover::before {
  opacity: 0.5;
}

/* 异常：红色底色 + 红色光影流光 */
.env-block.is-env-error {
  --env-error-bg: rgba(248, 113, 113, 0.1);
  --env-error-border: rgba(248, 113, 113, 0.35);
  --env-error-glow: rgba(248, 113, 113, 0.2);
  background: linear-gradient(145deg, rgba(248, 113, 113, 0.12), var(--muted-surface));
  border-color: rgba(248, 113, 113, 0.25);
  border-top-color: rgba(248, 113, 113, 0.55);
  box-shadow: 0 0 18px rgba(248, 113, 113, 0.1), inset 0 0 16px rgba(248, 113, 113, 0.06);
}

.env-block.is-env-error::before {
  opacity: 0.38;
  background:
    linear-gradient(90deg, transparent, rgba(248, 113, 113, 0.14), transparent),
    radial-gradient(circle at 18% 50%, rgba(248, 113, 113, 0.08), transparent 34%);
}

.env-block.is-env-error::after {
  width: 42%;
  background: linear-gradient(100deg, transparent 0%, rgba(248, 113, 113, 0.18) 30%, rgba(239, 68, 68, 0.45) 50%, rgba(248, 113, 113, 0.18) 68%, transparent 100%);
  filter: blur(8px);
  mix-blend-mode: screen;
  animation: envErrorSweep 4.2s cubic-bezier(0.45, 0, 0.2, 1) infinite;
}

.env-block.is-env-error:hover::before {
  opacity: 0.55;
}

.env-block.is-env-error:hover {
  border-color: rgba(248, 113, 113, 0.45);
  box-shadow: 0 0 28px rgba(248, 113, 113, 0.18), inset 0 0 20px rgba(248, 113, 113, 0.1);
}

/* 静态：无任何光影流光 */
.env-block.is-env-static::before,
.env-block.is-env-static::after {
  opacity: 0;
  animation: none;
}

/* 100% 完成态：绿色背景，无光影流光 */
.env-block.is-done::before,
.env-block.is-done::after {
  opacity: 0 !important;
  animation: none !important;
}

.env-block:hover,
.env-block:focus-visible {
  transform: translateY(-2px);
  border-color: var(--hover-border);
  border-top-color: var(--env-tone);
  box-shadow: var(--hover-shadow);
  background: var(--hover-bg), var(--muted-surface);
}

.env-block:focus-visible {
  outline: none;
}

.env-block__dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--waiting);
  box-shadow: 0 0 6px rgba(255, 184, 77, 0.78);
  z-index: 1;
}

.env-block.is-active .env-block__dot {
  background: var(--success);
  box-shadow: 0 0 8px rgba(0, 245, 160, 0.88);
}

.env-block.is-done .env-block__dot {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(34, 211, 238, 0.86);
}

.env-block.is-env-error .env-block__dot {
  background: var(--failed);
  box-shadow: 0 0 8px rgba(255, 91, 121, 0.88);
}

.env-block__name {
  position: relative;
  z-index: 1;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.env-block__percent {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 1px;
  color: var(--text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.env-block__status {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  color: var(--text-soft);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
  border-radius: 999px;
  background: rgba(167, 185, 204, 0.08);
}

.env-block.is-active .env-block__status {
  color: var(--success);
  background: rgba(0, 245, 160, 0.08);
}

.env-block.is-done .env-block__status {
  color: var(--accent);
  background: rgba(34, 211, 238, 0.08);
}

/* 激活状态差异化样式 —— 提高优先级覆盖 .env-block.is-active/.is-done 的默认色 */
.env-block .env-block__status.is-activated {
  color: var(--success);
  background: rgba(0, 245, 160, 0.12);
  font-weight: 600;
}

.env-block .env-block__status.is-pending {
  color: var(--pending);
  background: var(--pending-soft);
  font-weight: 600;
}

.env-block .env-block__status.is-inactive {
  color: var(--failed);
  background: rgba(255, 91, 121, 0.1);
  font-weight: 500;
}

.message-panel {
  display: flex;
  flex-direction: column;
  width: 340px;
  min-width: 0;
  transition: all 0.3s ease;
}

.message-panel.is-collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateX(16px);
  border-color: transparent;
}

.message-panel__head em {
  flex: 0 0 auto;
  padding: 5px 9px;
  color: var(--success);
  background: rgba(0, 245, 160, 0.1);
  border: 1px solid rgba(0, 245, 160, 0.18);
  border-radius: 999px;
  font-size: 12px;
  font-style: normal;
}

.message-panel__close {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: auto;
  padding: 0;
  color: var(--text-soft);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.22s ease;
}

.message-panel__close:hover {
  color: var(--text-main);
  background: var(--button-bg);
  border-color: var(--button-border);
}

.message-panel__close .svg-icon {
  width: 14px;
  height: 14px;
}

.message-panel__body {
  flex: 1;
  padding: 8px 7px 10px 6px;
  overscroll-behavior: contain;
}

.message-timeline {
  position: relative;
  display: grid;
  gap: 7px;
}

.message-timeline::before {
  content: "";
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 8px;
  width: 1px;
  background: linear-gradient(180deg, rgba(34, 211, 238, 0), var(--line-soft), rgba(0, 245, 160, 0));
}

.timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 5px;
  transition: all 0.3s ease;
}

.timeline-item {
  --timeline-tone: var(--success);
  --timeline-soft: rgba(0, 245, 160, 0.12);
}

.timeline-item.tone-failed {
  --timeline-tone: var(--failed);
  --timeline-soft: rgba(255, 91, 121, 0.12);
}

.timeline-item.tone-waiting {
  --timeline-tone: var(--waiting);
  --timeline-soft: rgba(255, 184, 77, 0.12);
}

.timeline-marker {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14px;
}

.timeline-marker span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--timeline-tone);
  box-shadow: 0 0 10px currentColor;
  color: var(--timeline-tone);
}

.timeline-item.is-new .timeline-marker span {
  width: 10px;
  height: 10px;
  margin-top: -1px;
}

.timeline-content {
  position: relative;
  overflow: hidden;
  min-height: 92px;
  max-height: 112px;
  padding: 9px 10px 8px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  transition: all 0.3s ease;
}

.timeline-content::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, var(--timeline-soft), transparent 58%);
  opacity: 0.52;
}

.timeline-item:hover {
  transform: translateY(-2px);
}

.timeline-item:hover .timeline-content {
  border-color: var(--timeline-tone);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);
}

.timeline-content__head,
.timeline-content h3,
.timeline-content p,
.timeline-meta {
  position: relative;
  z-index: 1;
}

.timeline-content__head,
.timeline-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.timeline-state {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  min-width: 68px;
  color: var(--text-soft);
}

.timeline-state span {
  color: var(--timeline-tone);
  font-size: 10px;
  font-weight: 650;
  line-height: 16px;
}

.timeline-state time {
  color: var(--time-text);
  font-family: Consolas, Monaco, monospace;
  font-size: 10px;
  line-height: 16px;
  opacity: 0.75;
}

.timeline-content h3 {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-content p {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  word-break: break-word;
  overflow-wrap: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.timeline-meta {
  justify-content: flex-start;
  margin-top: 5px;
  overflow: hidden;
}

.timeline-meta span {
  display: inline-flex;
  align-items: center;
  max-width: 50%;
  height: 18px;
  padding: 0 7px;
  overflow: hidden;
  color: var(--text-soft);
  background: var(--tag-bg);
  border: 0;
  border-radius: 999px;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

::v-deep .overview-message-tooltip {
  max-width: 420px;
  padding: 14px;
  color: var(--tooltip-text);
  background: var(--tooltip-bg);
  border: 1px solid var(--tooltip-border);
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.7;
  white-space: normal;
  word-break: break-word;
}

.timeline-item.is-new .timeline-content {
  border-color: var(--accent);
  box-shadow: 0 12px 32px rgba(34, 211, 238, 0.1), 0 0 0 1px rgba(34, 211, 238, 0.12);
}

.timeline-item.is-shifting {
  animation: messageShiftDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.timeline-list-enter-active,
.timeline-list-leave-active {
  transition: opacity 0.34s ease, transform 0.34s ease;
}

.timeline-list-enter {
  opacity: 0;
  transform: translate3d(0, -18px, 0) scale(0.98);
}

.timeline-list-leave-to {
  opacity: 0;
  transform: translate3d(0, 12px, 0) scale(0.98);
}

.timeline-list-move {
  transition: transform 0.44s ease;
}

.timeline-list-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}

.message-loading-more {
  padding: 12px 0 2px;
  color: var(--text-soft);
  font-size: 12px;
  text-align: center;
}

.message-float {
  position: fixed;
  right: 20px;
  top: 50%;
  z-index: 5;
  width: 58px;
  height: 58px;
  color: #031018;
  background: linear-gradient(135deg, #22D3EE, #00F5A0);
  border: 0;
  border-radius: 18px;
  box-shadow: 0 16px 42px rgba(34, 211, 238, 0.24);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.3s ease;
}

.message-float .svg-icon {
  width: 17px;
  height: 17px;
}

.message-float:hover {
  transform: translateY(-4px);
}

.state-panel {
  display: grid;
  place-content: center;
  gap: 6px;
  min-height: 220px;
  padding: 24px;
  text-align: center;
  background: var(--muted-surface);
  border-radius: var(--radius);
}

.state-panel strong {
  color: var(--text-main);
  font-size: 15px;
}

.state-panel span {
  color: var(--text-muted);
  font-size: 12px;
}

.state-panel.is-error strong {
  color: var(--failed);
}

.system-skeleton,
.timeline-skeleton div {
  position: relative;
  overflow: hidden;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
}

.system-skeleton {
  height: 220px;
  border-radius: 20px;
}

.timeline-skeleton {
  display: grid;
  gap: 7px;
}

.timeline-skeleton div {
  height: 104px;
}

.system-skeleton::after,
.timeline-skeleton div::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.12), transparent);
  transform: translateX(-100%);
}

.message-new-tip-enter-active,
.message-new-tip-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.message-new-tip-enter,
.message-new-tip-leave-to {
  opacity: 0;
  transform: translate3d(0, -4px, 0);
}

@media (prefers-reduced-motion: no-preference) {
  .timeline-item.is-new .timeline-marker span {
    animation: latestMessagePulse 2.4s ease-out infinite;
  }

  .system-skeleton::after,
  .timeline-skeleton div::after {
    animation: skeletonSweep 1.5s ease-in-out infinite;
  }

  .timeline-item.is-new .timeline-content {
    animation:
      newMessageIn 0.68s cubic-bezier(0.16, 1, 0.3, 1) both,
      messageGlow 3.6s ease-out 0.24s both;
    animation-delay: var(--message-delay), calc(var(--message-delay) + 240ms);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }

  .env-block.is-env-running::after,
  .env-block.is-env-error::after {
    display: none;
  }
}

/* 正常绿色流光 */
@keyframes envEnergySweep {
  0% {
    opacity: 0;
    transform: translateX(-145%);
  }
  12% {
    opacity: 0.56;
  }
  44% {
    opacity: 0.42;
    transform: translateX(270%);
  }
  58%,
  100% {
    opacity: 0;
    transform: translateX(270%);
  }
}

/* 红色异常流光 */
@keyframes envErrorSweep {
  0% {
    opacity: 0;
    transform: translateX(-145%);
  }
  12% {
    opacity: 0.6;
  }
  44% {
    opacity: 0.48;
    transform: translateX(270%);
  }
  58%,
  100% {
    opacity: 0;
    transform: translateX(270%);
  }
}

@keyframes latestMessagePulse {
  0% {
    box-shadow: 0 0 10px currentColor, 0 0 0 0 var(--timeline-soft);
  }
  72% {
    box-shadow: 0 0 10px currentColor, 0 0 0 8px rgba(34, 211, 238, 0);
  }
  100% {
    box-shadow: 0 0 10px currentColor, 0 0 0 0 rgba(34, 211, 238, 0);
  }
}

@keyframes skeletonSweep {
  100% {
    transform: translateX(100%);
  }
}

@keyframes newMessageIn {
  0% {
    opacity: 0;
    transform: translate3d(0, -18px, 0) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes messageGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.22), 0 18px 48px rgba(34, 211, 238, 0.16);
  }
  60% {
    box-shadow: 0 0 0 8px rgba(34, 211, 238, 0), 0 18px 48px rgba(34, 211, 238, 0.12);
  }
  100% {
    box-shadow: 0 18px 48px rgba(34, 211, 238, 0.08);
  }
}

@keyframes messageShiftDown {
  0% {
    transform: translate3d(0, var(--message-shift-y), 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

@media (max-width: 1280px) {
  .overview-layout,
  .overview-layout.is-message-collapsed {
    grid-template-columns: 1fr;
  }

  .message-panel,
  .message-panel.is-collapsed {
    width: 100%;
    min-height: 320px;
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
}

@media (max-width: 768px) {
  .overview-page {
    height: auto;
    min-height: calc(100vh - 84px);
    overflow: visible;
    padding: 12px;
  }

  .system-grid,
  .skeleton-grid {
    grid-template-columns: 1fr;
  }

  .system-card {
    max-width: none;
  }

  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .execution-toolbar {
    justify-content: flex-start;
    width: 100%;
  }

  .quick-action {
    flex: 1 1 calc(50% - 8px);
  }

  .system-card {
    padding: 16px;
  }

  .system-identity__head h3 {
    font-size: 24px;
  }

  .env-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .env-block {
    padding: 10px 6px 8px;
  }

  .env-block__name {
    font-size: 11px;
  }

  .env-block__percent {
    font-size: 16px;
  }

  .env-block__status {
    font-size: 9px;
    padding: 1px 5px;
  }
}

@media (max-width: 560px) {
  .quick-action {
    flex-basis: 100%;
  }

  .system-card__identity {
    flex-direction: column;
    gap: 8px;
  }

  .system-identity__metrics {
    align-self: flex-start;
  }

  .env-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .message-panel__body {
    padding-right: 4px;
  }
}

/* ---- CICD 实施情况弹窗 ---- */

// Shared layout (no colors)
.cicd-dialog {
  ::v-deep .el-dialog {
    border-radius: 18px;
  }

  ::v-deep .el-dialog__header {
    padding: 20px 24px 14px;
  }

  ::v-deep .el-dialog__title {
    font-size: 18px;
    font-weight: 680;
    letter-spacing: 0.02em;
  }

  ::v-deep .el-dialog__headerbtn {
    top: 20px;
    right: 24px;

    .el-dialog__close {
      font-size: 20px;
      transition: color 0.22s ease;
    }
  }

  ::v-deep .el-dialog__body {
    padding: 16px 24px 24px;
  }

  .cicd-dialog__footer {
    text-align: right;
    padding-top: 4px;
  }
}

// Light theme
.cicd-dialog--light {
  ::v-deep .el-dialog {
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  }

  ::v-deep .el-dialog__header {
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  ::v-deep .el-dialog__title {
    color: #111827;
  }

  ::v-deep .el-dialog__headerbtn .el-dialog__close {
    color: #94a3b8;

    &:hover {
      color: #06B6D4;
    }
  }

  .cicd-toolbar__count {
    color: #64748b;
  }

  // refresh button
  .quick-action {
    color: #475569;
    background: #f1f5f9;
    border-color: rgba(15, 23, 42, 0.08);

    &:hover {
      border-color: #06B6D4;
      color: #06B6D4;
    }
  }

  // el-table theming
  ::v-deep .el-table {
    background: #fff;
    border-color: rgba(15, 23, 42, 0.06);

    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      border-bottom-color: rgba(15, 23, 42, 0.06);
    }

    td {
      color: #334155;
      border-bottom-color: rgba(15, 23, 42, 0.05);
    }

    tr:hover > td {
      background: #f1f5f9;
    }

    &::before {
      background: rgba(15, 23, 42, 0.06);
    }
  }

  ::v-deep .el-table--border {
    border-color: rgba(15, 23, 42, 0.06);

    th,
    td {
      border-right-color: rgba(15, 23, 42, 0.06);
    }
  }

  ::v-deep .el-table__empty-text {
    color: #94a3b8;
  }

  ::v-deep .el-loading-mask {
    background: rgba(255, 255, 255, 0.65);
  }

  .cicd-link-num {
    color: #06B6D4;
    border-bottom-color: rgba(6, 182, 212, 0.4);

    &:hover {
      color: #10B981;
      border-bottom-color: rgba(16, 185, 129, 0.5);
      text-shadow: none;
    }
  }

  .cicd-status-tag {
    &.is-verify {
      color: #0369a1;
      background: rgba(14, 165, 233, 0.1);
      border-color: rgba(14, 165, 233, 0.2);
    }

    &.is-success {
      color: #047857;
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.2);
    }

    &.is-partial {
      color: #a16207;
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.2);
    }

    &.is-danger {
      color: #be123c;
      background: rgba(244, 63, 94, 0.1);
      border-color: rgba(244, 63, 94, 0.2);
    }

    &.is-cancelled {
      color: #64748b;
      background: rgba(100, 116, 139, 0.1);
      border-color: rgba(100, 116, 139, 0.18);
    }

    &.is-pending {
      color: #334155;
      background: rgba(71, 85, 105, 0.08);
      border-color: rgba(71, 85, 105, 0.16);
    }

    &.is-running {
      color: #0e7490;
      background: rgba(6, 182, 212, 0.1);
      border-color: rgba(6, 182, 212, 0.2);
    }

    &.is-review {
      color: #5b21b6;
      background: rgba(139, 92, 246, 0.1);
      border-color: rgba(139, 92, 246, 0.2);
    }

    &.is-unknown {
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.08);
      border-color: rgba(148, 163, 184, 0.15);
    }
  }

  .cicd-error {
    color: #be123c;
    background: rgba(244, 63, 94, 0.06);
    border-color: rgba(244, 63, 94, 0.15);
  }
}

// Dark theme
.cicd-dialog--dark {
  ::v-deep .el-dialog {
    background: linear-gradient(145deg, rgba(14, 25, 42, 0.98), rgba(9, 16, 28, 0.98));
    border: 1px solid rgba(34, 211, 238, 0.2);
    box-shadow: 0 22px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(34, 211, 238, 0.08);
    backdrop-filter: blur(18px) saturate(130%);
    -webkit-backdrop-filter: blur(18px) saturate(130%);
  }

  ::v-deep .el-dialog__header {
    border-bottom: 1px solid rgba(34, 211, 238, 0.12);
  }

  ::v-deep .el-dialog__title {
    color: #EAF4FF;
  }

  ::v-deep .el-dialog__headerbtn .el-dialog__close {
    color: #A7B9CC;

    &:hover {
      color: #22D3EE;
    }
  }

  .cicd-toolbar__count {
    color: #C8D7E6;
  }

  // refresh button
  .quick-action {
    color: #EAF4FF;
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(34, 211, 238, 0.15);

    &:hover {
      border-color: #22D3EE;
    }
  }

  // el-table theming
  ::v-deep .el-table {
    background: transparent;
    color: #EAF4FF;
    border-color: rgba(34, 211, 238, 0.08);

    th {
      background: rgba(255, 255, 255, 0.04);
      color: #A7B9CC;
      font-weight: 600;
      border-bottom-color: rgba(34, 211, 238, 0.1);
    }

    td {
      color: #C8D7E6;
      border-bottom-color: rgba(34, 211, 238, 0.06);
    }

    tr:hover > td {
      background: rgba(255, 255, 255, 0.04);
    }

    &::before {
      background: rgba(34, 211, 238, 0.08);
    }
  }

  ::v-deep .el-table--border {
    border-color: rgba(34, 211, 238, 0.08);

    th,
    td {
      border-right-color: rgba(34, 211, 238, 0.08);
    }
  }

  ::v-deep .el-table__empty-text {
    color: #A7B9CC;
  }

  ::v-deep .el-loading-mask {
    background: rgba(5, 11, 21, 0.6);
  }

  .cicd-link-num {
    color: #22D3EE;
    border-bottom-color: rgba(34, 211, 238, 0.4);

    &:hover {
      color: #00F5A0;
      border-bottom-color: rgba(0, 245, 160, 0.6);
      text-shadow: 0 0 12px rgba(34, 211, 238, 0.4);
    }
  }

  .cicd-status-tag {
    &.is-verify {
      color: #38BDF8;
      background: rgba(56, 189, 248, 0.12);
      border-color: rgba(56, 189, 248, 0.22);
    }

    &.is-success {
      color: #00F5A0;
      background: rgba(0, 245, 160, 0.1);
      border-color: rgba(0, 245, 160, 0.2);
    }

    &.is-partial {
      color: #FBBF24;
      background: rgba(251, 191, 36, 0.1);
      border-color: rgba(251, 191, 36, 0.2);
    }

    &.is-danger {
      color: #FB7185;
      background: rgba(251, 113, 133, 0.1);
      border-color: rgba(251, 113, 133, 0.2);
    }

    &.is-cancelled {
      color: #94A3B8;
      background: rgba(148, 163, 184, 0.1);
      border-color: rgba(148, 163, 184, 0.18);
    }

    &.is-pending {
      color: #A7B9CC;
      background: rgba(167, 185, 204, 0.08);
      border-color: rgba(167, 185, 204, 0.16);
    }

    &.is-running {
      color: #22D3EE;
      background: rgba(34, 211, 238, 0.1);
      border-color: rgba(34, 211, 238, 0.2);
    }

    &.is-review {
      color: #A78BFA;
      background: rgba(167, 139, 250, 0.12);
      border-color: rgba(167, 139, 250, 0.22);
    }

    &.is-unknown {
      color: #64748B;
      background: rgba(100, 116, 139, 0.08);
      border-color: rgba(100, 116, 139, 0.15);
    }
  }

  .cicd-error {
    color: #FF5B79;
    background: rgba(255, 91, 121, 0.08);
    border-color: rgba(255, 91, 121, 0.2);
  }
}

// Shared internal layout (no colors)
.cicd-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.cicd-toolbar__count {
  font-size: 13px;
}

.cicd-link-num {
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.22s ease;
  border-bottom: 1px dashed;
}

.cicd-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid;
}

.cicd-error {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  text-align: center;
  border: 1px solid;
}

/* ---- 维护公告弹窗 ---- */

// 共享布局
.maintenance-notice-dialog {
  ::v-deep .el-dialog {
    border-radius: 18px;
  }

  ::v-deep .el-dialog__header {
    padding: 20px 24px 14px;
  }

  ::v-deep .el-dialog__title {
    font-size: 18px;
    font-weight: 680;
    letter-spacing: 0.02em;
  }

  ::v-deep .el-dialog__headerbtn {
    top: 20px;
    right: 24px;

    .el-dialog__close {
      font-size: 20px;
      transition: color 0.22s ease;
    }
  }

  ::v-deep .el-dialog__body {
    padding: 16px 24px 24px;
  }
}

// Light 主题
.maintenance-notice-dialog--light {
  ::v-deep .el-dialog {
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  }

  ::v-deep .el-dialog__header {
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  ::v-deep .el-dialog__title {
    color: #111827;
  }

  ::v-deep .el-dialog__headerbtn .el-dialog__close {
    color: #94a3b8;

    &:hover {
      color: #06B6D4;
    }
  }

  .maintenance-notice__count {
    color: #64748b;
  }

  .maintenance-notice__body {
    &::-webkit-scrollbar-thumb {
      background: rgba(15, 23, 42, 0.12);
    }
  }

  .maintenance-notice-skeleton {
    background: #f8fafc;
    border-color: rgba(15, 23, 42, 0.06);

    &::after {
      background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.1), transparent);
    }
  }

  .maintenance-notice-card {
    background: #f8fafc;
    border-color: rgba(15, 23, 42, 0.06);

    &:hover {
      border-color: rgba(6, 182, 212, 0.18);
      background: #f1f5f9;
      box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);
    }

    &.is-expanded {
      border-color: rgba(6, 182, 212, 0.22);
      background: #f1f5f9;
    }
  }

  .notice-card__title {
    color: #111827;
  }

  .notice-card__content {
    color: #64748b;
  }

  .notice-card__time,
  .notice-card__contact {
    color: #94a3b8;
  }

  .notice-card__expand-icon {
    color: #94a3b8;
  }

  .notice-card__detail {
    border-top-color: rgba(15, 23, 42, 0.06);
  }

  .notice-detail__label {
    color: #94a3b8;
  }

  .notice-detail__value {
    color: #334155;
  }

  .notice-status-tag {
    &.is-passed {
      color: #047857;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    &.is-unreviewed {
      color: #a16207;
      background: rgba(202, 138, 4, 0.1);
      border: 1px solid rgba(202, 138, 4, 0.2);
    }

    &.is-rejected {
      color: #be123c;
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.2);
    }
  }

  .quick-action {
    color: #475569;
    background: #f1f5f9;
    border-color: rgba(15, 23, 42, 0.08);

    &:hover {
      border-color: #06B6D4;
      color: #06B6D4;
    }
  }
}

// Dark 主题
.maintenance-notice-dialog--dark {
  ::v-deep .el-dialog {
    background: linear-gradient(145deg, rgba(14, 25, 42, 0.98), rgba(9, 16, 28, 0.98));
    border: 1px solid rgba(34, 211, 238, 0.2);
    box-shadow: 0 22px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(34, 211, 238, 0.08);
  }

  ::v-deep .el-dialog__header {
    border-bottom: 1px solid rgba(34, 211, 238, 0.12);
  }

  ::v-deep .el-dialog__title {
    color: #EAF4FF;
  }

  ::v-deep .el-dialog__headerbtn .el-dialog__close {
    color: #A7B9CC;

    &:hover {
      color: #22D3EE;
    }
  }

  .maintenance-notice__count {
    color: #C8D7E6;
  }

  .maintenance-notice__body {
    &::-webkit-scrollbar-thumb {
      background: rgba(34, 211, 238, 0.18);
    }
  }

  .maintenance-notice-skeleton {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(34, 211, 238, 0.06);

    &::after {
      background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.08), transparent);
    }
  }

  .maintenance-notice-card {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(34, 211, 238, 0.08);

    &:hover {
      border-color: rgba(34, 211, 238, 0.18);
      background: rgba(255, 255, 255, 0.04);
    }

    &.is-expanded {
      border-color: rgba(34, 211, 238, 0.2);
      background: rgba(255, 255, 255, 0.04);
    }
  }

  .notice-card__title {
    color: #EAF4FF;
  }

  .notice-card__content {
    color: #C8D7E6;
  }

  .notice-card__time,
  .notice-card__contact {
    color: #A7B9CC;
  }

  .notice-card__expand-icon {
    color: #A7B9CC;
  }

  .notice-card__detail {
    border-top-color: rgba(34, 211, 238, 0.08);
  }

  .notice-detail__label {
    color: #A7B9CC;
  }

  .notice-detail__value {
    color: #EAF4FF;
  }

  .notice-status-tag {
    &.is-passed {
      color: #00F5A0;
      background: rgba(0, 245, 160, 0.1);
      border: 1px solid rgba(0, 245, 160, 0.2);
    }

    &.is-unreviewed {
      color: #FACC15;
      background: rgba(250, 204, 21, 0.1);
      border: 1px solid rgba(250, 204, 21, 0.2);
    }

    &.is-rejected {
      color: #FF5B79;
      background: rgba(255, 91, 121, 0.1);
      border: 1px solid rgba(255, 91, 121, 0.2);
    }
  }

  .quick-action {
    color: #EAF4FF;
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(34, 211, 238, 0.15);

    &:hover {
      border-color: #22D3EE;
    }
  }
}

// 通用内部布局（颜色无关）
.maintenance-notice__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.maintenance-notice__header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.maintenance-notice__count {
  font-size: 13px;
}

.maintenance-notice__body {
  max-height: 60vh;
  overflow-y: auto;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
  }
}

.maintenance-notice__loading {
  display: grid;
  gap: 10px;
}

.maintenance-notice-skeleton {
  height: 82px;
  border-radius: 14px;
  overflow: hidden;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    animation: skeletonSweep 1.5s ease-in-out infinite;
  }
}

.maintenance-notice__list {
  display: grid;
  gap: 10px;
}

.maintenance-notice-card {
  border-radius: 14px;
  transition: all 0.26s ease;
  overflow: hidden;
  min-height: 82px;
}

.notice-card__main {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  cursor: pointer;
}

.notice-card__left {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notice-status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.notice-card__center {
  flex: 1 1 auto;
  min-width: 0;
}

.notice-card__title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-card__content {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notice-card__meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.notice-card__time {
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
}

.notice-card__contact {
  font-size: 11px;
}

.notice-card__right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.notice-card__expand-icon {
  font-size: 14px;
  transition: transform 0.26s ease;

  &.is-rotated {
    transform: rotate(180deg);
  }
}

.notice-card__detail {
  padding: 14px 16px;
}

.notice-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 18px;
}

.notice-detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.notice-detail__label {
  font-size: 11px;
  font-weight: 500;
}

.notice-detail__value {
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
}

.notice-expand-enter-active,
.notice-expand-leave-active {
  transition: all 0.28s ease;
  overflow: hidden;
}

.notice-expand-enter,
.notice-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.notice-expand-enter-to,
.notice-expand-leave {
  max-height: 300px;
}

@media (max-width: 768px) {
  .maintenance-notice-dialog ::v-deep .el-dialog {
    width: 92vw !important;
  }

  .notice-detail-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .notice-detail-grid {
    grid-template-columns: 1fr;
  }

  .notice-card__main {
    flex-wrap: wrap;
  }

  .notice-card__right {
    margin-left: auto;
  }
}

</style>

<style lang="scss">
.overview-inspection-popover {
  box-sizing: border-box;
  width: min(360px, calc(100vw - 24px)) !important;
  padding: 0;
  border-radius: 14px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.4;
  word-break: normal;
  overflow-wrap: normal;
}

.overview-inspection-popover.fade-in-linear-enter,
.overview-inspection-popover.fade-in-linear-leave-active,
.overview-inspection-popover.el-fade-in-linear-enter,
.overview-inspection-popover.el-fade-in-linear-leave-active {
  opacity: 1;
}

.overview-inspection-popover,
.overview-inspection-popover[x-placement^="right"] .popper__arrow::after,
.overview-inspection-popover[x-placement^="left"] .popper__arrow::after,
.overview-inspection-popover[x-placement^="top"] .popper__arrow::after,
.overview-inspection-popover[x-placement^="bottom"] .popper__arrow::after {
  background: rgba(11, 22, 38, 0.94);
}

.overview-inspection-popover--dark {
  color: #EAF4FF;
  border: 1px solid rgba(34, 211, 238, 0.34);
  box-shadow:
    0 22px 54px rgba(0, 0, 0, 0.48),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 32px rgba(34, 211, 238, 0.14);
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
}

.overview-inspection-popover--light {
  color: #0F172A;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow:
    0 22px 48px rgba(15, 23, 42, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(1.15);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
}

.overview-inspection-popover--light[x-placement^="right"] .popper__arrow::after,
.overview-inspection-popover--light[x-placement^="left"] .popper__arrow::after,
.overview-inspection-popover--light[x-placement^="top"] .popper__arrow::after,
.overview-inspection-popover--light[x-placement^="bottom"] .popper__arrow::after {
  background: rgba(255, 255, 255, 0.94);
}

.overview-inspection-popover[x-placement^="right"] .popper__arrow {
  border-right-color: rgba(34, 211, 238, 0.34);
}

.overview-inspection-popover[x-placement^="right"] .popper__arrow::after {
  border-right-color: rgba(11, 22, 38, 0.94);
}

.overview-inspection-popover[x-placement^="left"] .popper__arrow {
  border-left-color: rgba(34, 211, 238, 0.34);
}

.overview-inspection-popover[x-placement^="left"] .popper__arrow::after {
  border-left-color: rgba(11, 22, 38, 0.94);
}

.overview-inspection-popover[x-placement^="top"] .popper__arrow {
  border-top-color: rgba(34, 211, 238, 0.34);
}

.overview-inspection-popover[x-placement^="top"] .popper__arrow::after {
  border-top-color: rgba(11, 22, 38, 0.94);
}

.overview-inspection-popover[x-placement^="bottom"] .popper__arrow {
  border-bottom-color: rgba(34, 211, 238, 0.34);
}

.overview-inspection-popover[x-placement^="bottom"] .popper__arrow::after {
  border-bottom-color: rgba(11, 22, 38, 0.94);
}

.overview-inspection-popover--light[x-placement^="right"] .popper__arrow {
  border-right-color: rgba(15, 23, 42, 0.1);
}

.overview-inspection-popover--light[x-placement^="right"] .popper__arrow::after {
  border-right-color: rgba(255, 255, 255, 0.94);
}

.overview-inspection-popover--light[x-placement^="left"] .popper__arrow {
  border-left-color: rgba(15, 23, 42, 0.1);
}

.overview-inspection-popover--light[x-placement^="left"] .popper__arrow::after {
  border-left-color: rgba(255, 255, 255, 0.94);
}

.overview-inspection-popover--light[x-placement^="top"] .popper__arrow {
  border-top-color: rgba(15, 23, 42, 0.1);
}

.overview-inspection-popover--light[x-placement^="top"] .popper__arrow::after {
  border-top-color: rgba(255, 255, 255, 0.94);
}

.overview-inspection-popover--light[x-placement^="bottom"] .popper__arrow {
  border-bottom-color: rgba(15, 23, 42, 0.1);
}

.overview-inspection-popover--light[x-placement^="bottom"] .popper__arrow::after {
  border-bottom-color: rgba(255, 255, 255, 0.94);
}

.inspection-popover__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  padding: 14px;
}

.inspection-popover__item {
  min-width: 0;
}

.inspection-popover__line {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
  white-space: nowrap;
}

.inspection-popover__label {
  flex: 0 0 auto;
  color: #A5B4FC;
  font-size: 14px;
  font-weight: 650;
}

.overview-inspection-popover--light .inspection-popover__label {
  color: #4F46E5;
}

.inspection-popover__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.inspection-popover__status.is-inspected {
  color: #34D399;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(52, 211, 153, 0.24);
}

.inspection-popover__status.is-error {
  color: #FB7185;
  background: rgba(244, 63, 94, 0.14);
  border: 1px solid rgba(251, 113, 133, 0.24);
}

.overview-inspection-popover--light .inspection-popover__status.is-inspected {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.2);
}

.overview-inspection-popover--light .inspection-popover__status.is-error {
  color: #BE123C;
  background: rgba(244, 63, 94, 0.1);
  border-color: rgba(244, 63, 94, 0.18);
}

.inspection-popover__time {
  display: block;
  margin-top: 8px;
  color: #9FB3C8;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.overview-inspection-popover--light .inspection-popover__time {
  color: #64748B;
}

@media (max-width: 560px) {
  .overview-inspection-popover {
    width: min(320px, calc(100vw - 24px)) !important;
  }

  .inspection-popover__body {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* ---- CICD atom popover ---- */
.cicd-atom-popover {
  padding: 0;
  border-radius: 14px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.cicd-atom-popover--light {
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1);

  .el-table {
    background: #fff;

    th {
      background: #f8fafc;
      color: #475569;
      border-bottom-color: rgba(15, 23, 42, 0.06);
    }

    td {
      color: #334155;
      border-bottom-color: rgba(15, 23, 42, 0.05);
    }
  }
}

.cicd-atom-popover--dark {
  background: rgba(14, 25, 42, 0.98);
  border: 1px solid rgba(34, 211, 238, 0.2);
  box-shadow: 0 22px 64px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(18px) saturate(130%);

  .el-table {
    background: transparent;
    color: #C8D7E6;

    th {
      background: rgba(255, 255, 255, 0.04);
      color: #A7B9CC;
      border-bottom-color: rgba(34, 211, 238, 0.1);
    }

    td {
      color: #C8D7E6;
      border-bottom-color: rgba(34, 211, 238, 0.06);
    }
  }
}

</style>
