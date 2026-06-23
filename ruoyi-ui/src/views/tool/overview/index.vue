<template>
  <div class="overview-page" :class="themeClass">
    <div class="overview-shell">
      <header class="overview-hero">
        <div class="overview-hero__main">
          <div class="overview-hero__copy">
            <span class="overview-kicker">RELEASE OPERATIONS</span>
            <h1>运营监控总览</h1>
            <p>系统执行优先，状态消息实时追踪。</p>
          </div>
          <div class="overview-hero__actions">
            <button class="theme-action" type="button" @click="toggleTheme">
              <span class="tech-icon">
                <svg-icon icon-class="theme" />
              </span>
              {{ resolvedTheme === 'light' ? 'Light' : 'Dark' }}
            </button>
            <button class="ghost-action" type="button" @click="refreshOverview">
              <span class="tech-icon">
                <svg-icon icon-class="monitor" />
              </span>
              刷新数据
            </button>
            <button class="primary-action" type="button" @click="messageCollapsed = !messageCollapsed">
              <span class="tech-icon">
                <svg-icon :icon-class="messageCollapsed ? 'message' : 'more-up'" />
              </span>
              {{ messageCollapsed ? '展开消息' : '收起消息' }}
            </button>
          </div>
        </div>
        <div class="overview-hero__metrics">
          <section class="metric-grid">
            <article
              v-for="metric in metricCards"
              :key="metric.key"
              class="metric-card"
              :style="metricStyle(metric)"
            >
              <div class="metric-card__head">
                <span>{{ metric.label }}</span>
                <em>{{ metric.delta }}</em>
              </div>
              <div class="metric-card__value">
                <strong>{{ metric.value }}</strong>
                <span v-if="metric.suffix">{{ metric.suffix }}</span>
              </div>
              <div class="metric-card__foot">
                <small>{{ metric.meta }}</small>
                <svg class="metric-sparkline" viewBox="0 0 128 42" preserveAspectRatio="none" aria-hidden="true">
                  <path :d="sparklineArea(metric.series, 128, 42)" />
                  <polyline :points="sparklinePoints(metric.series, 128, 42)" />
                </svg>
              </div>
            </article>
          </section>
        </div>
      </header>

      <main class="overview-layout" :class="{ 'is-message-collapsed': messageCollapsed }">
        <section class="execution-panel panel-surface">
          <div class="panel-head">
            <div class="panel-title">
              <span class="panel-title__icon">
                <svg-icon icon-class="monitor" />
              </span>
              <div>
                <h2>系统执行态势</h2>
                <span>{{ overviewStats.runningEnvs }} 个环境执行中</span>
              </div>
            </div>
            <div class="execution-toolbar">
              <button
                v-for="action in quickActions"
                :key="action.key"
                class="quick-action"
                type="button"
              >
                <span class="tech-icon">
                  <svg-icon :icon-class="action.icon" />
                </span>
                {{ action.label }}
              </button>
              <div class="panel-live">
                <i />
                Live
              </div>
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
              <span>当前没有可展示的环境进度。</span>
            </div>
            <div v-else class="system-grid">
              <article
                v-for="(system, index) in visibleSystems"
                :key="system.name"
                class="system-card"
                :class="{ 'is-running': system.hasRunning }"
                :style="systemStyle(system, index)"
              >
                <el-popover
                  :ref="'inspectionPopover-' + system.name"
                  :value="Boolean(inspectionVisible[system.name])"
                  :placement="inspectionPlacement(system)"
                  :width="360"
                  trigger="manual"
                  :visible-arrow="true"
                  :offset="10"
                  transition=""
                  :popper-options="inspectionPopperOptions"
                  :popper-class="inspectionPopperClass"
                >
                  <div
                    class="inspection-popover__body"
                    @mouseenter="showInspection(system.name)"
                    @mouseleave="scheduleInspectionHide(system.name)"
                  >
                    <section
                      v-for="item in inspectionItems(system)"
                      :key="system.name + '-' + item.key"
                      class="inspection-popover__item"
                    >
                      <div class="inspection-popover__line">
                        <span class="inspection-popover__label">{{ item.label }}：</span>
                        <span class="inspection-popover__status" :class="'is-' + item.status">
                          {{ inspectionStatusText(item.status) }}
                        </span>
                      </div>
                      <time class="inspection-popover__time">{{ item.time }}</time>
                    </section>
                  </div>
                  <button
                    slot="reference"
                    class="system-info-trigger"
                    type="button"
                    :aria-label="system.name + ' 更多巡检状态'"
                    aria-haspopup="true"
                    :aria-expanded="inspectionVisible[system.name] ? 'true' : 'false'"
                    @mouseenter="showInspection(system.name)"
                    @mouseleave="scheduleInspectionHide(system.name)"
                    @focus="showInspection(system.name)"
                    @blur="scheduleInspectionHide(system.name)"
                    @keydown.esc.stop.prevent="hideInspection(system.name)"
                  >
                    <i class="el-icon-info" aria-hidden="true" />
                  </button>
                </el-popover>

                <div class="system-card__top">
                  <div class="progress-ring">
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <circle class="ring-track" cx="50" cy="50" r="42" />
                      <circle class="ring-value" cx="50" cy="50" r="42" :style="ringStyle(system.percent)" />
                    </svg>
                    <div class="progress-center">
                      <strong>{{ system.percent }}</strong>
                      <span>%</span>
                    </div>
                  </div>
                  <div class="system-card__summary">
                    <span class="system-status" :class="systemStatusClass(system)">
                      {{ systemStatusText(system) }}
                    </span>
                    <h3>{{ system.name }}</h3>
                    <p>{{ system.envs.length }} 个环境，{{ systemActiveText(system) }}</p>
                  </div>
                </div>

                <div class="env-status-list">
                  <div
                    v-for="env in system.envs"
                    :key="system.name + '-' + env.key"
                    class="env-status-row"
                    :class="[envStatusClass(env), { 'is-sweeping': env.percent < 100 }]"
                  >
                    <div class="env-status-row__main">
                      <span class="env-dot" />
                      <span class="env-name">{{ env.label }}</span>
                    </div>
                    <div class="env-progress">
                      <i :style="{ width: env.percent + '%' }" />
                    </div>
                    <strong>{{ env.percent }}%</strong>
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
    </div>
  </div>
</template>

<script>
import { getOverviewExecutions, getOverviewMessages } from '@/api/tool/overview'

const ENV_CONFIG = [
  { key: 'prod', label: '生产' },
  { key: 'sandbox', label: '沙箱' },
  { key: 'failover', label: '合肥' },
  { key: 'ITSM', label: 'ITSM' }
]

const SYSTEM_PALETTE = [
  { color: '#22D3EE', lightColor: '#06B6D4', soft: 'rgba(34, 211, 238, 0.16)', lightSoft: 'rgba(6, 182, 212, 0.12)' },
  { color: '#00F5A0', lightColor: '#10B981', soft: 'rgba(0, 245, 160, 0.14)', lightSoft: 'rgba(16, 185, 129, 0.12)' },
  { color: '#8B5CF6', lightColor: '#8B5CF6', soft: 'rgba(139, 92, 246, 0.15)', lightSoft: 'rgba(139, 92, 246, 0.12)' },
  { color: '#FFB84D', lightColor: '#F59E0B', soft: 'rgba(255, 184, 77, 0.14)', lightSoft: 'rgba(245, 158, 11, 0.14)' },
  { color: '#FF5B79', lightColor: '#F43F5E', soft: 'rgba(255, 91, 121, 0.14)', lightSoft: 'rgba(244, 63, 94, 0.12)' }
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
      messageCollapsed: false,
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
      inspectionVisible: {},
      inspectionHideTimers: {},
      inspectionPopperOptions: {
        gpuAcceleration: false,
        boundariesElement: 'viewport',
        boundariesPadding: 12,
        flipBehavior: 'flip'
      },
      quickActions: [
        { key: 'cicd', label: 'CICD实施情况', icon: 'dashboard' },
        { key: 'manual', label: '手动协同', icon: 'peoples' },
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
    inspectionPopperClass() {
      return 'overview-inspection-popover overview-inspection-popover--' + this.resolvedTheme
    },
    visibleSystems() {
      return Object.keys(this.executionMap).map(name => {
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
    metricCards() {
      const stats = this.overviewStats
      return [
        {
          key: 'systems',
          label: '系统总数',
          value: stats.systems,
          suffix: '',
          delta: 'Active',
          meta: '纳管服务',
          tone: '#22D3EE',
          series: this.metricSeries(stats.systems * 12 + 18, 2)
        },
        {
          key: 'running',
          label: '执行系统',
          value: stats.runningSystems,
          suffix: '',
          delta: stats.runningSystems ? 'Live' : 'Idle',
          meta: '实时运行',
          tone: '#00F5A0',
          series: this.metricSeries(stats.runningSystems * 18 + 12, 5)
        },
        {
          key: 'envs',
          label: '环境总数',
          value: stats.envs,
          suffix: '',
          delta: `${stats.runningEnvs} live`,
          meta: '环境实例',
          tone: '#FFB84D',
          series: this.metricSeries(stats.envs * 8 + 20, 8)
        },
        {
          key: 'progress',
          label: '总进度',
          value: stats.percent,
          suffix: '%',
          delta: stats.percent >= 80 ? 'Stable' : 'Watch',
          meta: '完成比例',
          tone: '#8B5CF6',
          series: this.metricSeries(stats.percent || 10, 11)
        }
      ]
    }
  },
  created() {
    this.initTheme()
    this.fetchExecutions()
    this.fetchMessages({ appendNew: false })
    this.executionTimer = window.setInterval(this.fetchExecutions, 12000)
    this.messageTimer = window.setInterval(() => this.fetchMessages({ appendNew: true }), 5000)
  },
  beforeDestroy() {
    window.clearInterval(this.executionTimer)
    window.clearInterval(this.messageTimer)
    window.clearTimeout(this.messageNewTimer)
    Object.keys(this.inspectionHideTimers).forEach(name => {
      window.clearTimeout(this.inspectionHideTimers[name])
    })
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
        running: finished < total
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
    inspectionItems(system) {
      const inspection = system.inspection || {}
      return INSPECTION_FIELDS.map(field => ({
        key: field.key,
        label: field.label,
        status: (inspection[field.key] && inspection[field.key].status) || 'inspected',
        time: (inspection[field.key] && inspection[field.key].time) || DEFAULT_INSPECTION_TIME
      }))
    },
    inspectionStatusText(status) {
      return status === 'error' ? '异常' : '已巡检'
    },
    inspectionPlacement(system) {
      return system.name === 'BILLING' ? 'left-start' : 'right-start'
    },
    showInspection(name) {
      Object.keys(this.inspectionHideTimers).forEach(key => {
        window.clearTimeout(this.inspectionHideTimers[key])
        this.$delete(this.inspectionHideTimers, key)
      })
      Object.keys(this.inspectionVisible).forEach(key => {
        if (key !== name) {
          this.$set(this.inspectionVisible, key, false)
        }
      })
      this.$set(this.inspectionVisible, name, true)
    },
    scheduleInspectionHide(name) {
      window.clearTimeout(this.inspectionHideTimers[name])
      const timer = window.setTimeout(() => {
        this.hideInspection(name)
      }, 180)
      this.$set(this.inspectionHideTimers, name, timer)
    },
    hideInspection(name) {
      window.clearTimeout(this.inspectionHideTimers[name])
      this.$delete(this.inspectionHideTimers, name)
      this.$set(this.inspectionVisible, name, false)
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
    metricStyle(metric) {
      const toneMap = {
        '#22D3EE': '#06B6D4',
        '#00F5A0': '#10B981',
        '#FFB84D': '#F59E0B',
        '#8B5CF6': '#8B5CF6'
      }
      const tone = this.resolvedTheme === 'light' ? (toneMap[metric.tone] || metric.tone) : metric.tone
      return {
        '--metric-tone': tone,
        '--metric-glow': this.hexToRgba(tone, this.resolvedTheme === 'light' ? 0.12 : 0.22)
      }
    },
    metricSeries(value, seed) {
      const base = Math.max(8, Math.min(92, Number(value) || 8))
      return Array.from({ length: 9 }).map((_, index) => {
        const wave = Math.sin((index + seed) * 0.9) * 12
        const lift = index * 1.8
        return Math.max(4, Math.min(98, base + wave + lift))
      })
    },
    sparklinePoints(values, width = 128, height = 42) {
      const points = this.normalizePoints(values, width, height)
      return points.map(point => `${point.x},${point.y}`).join(' ')
    },
    sparklineArea(values, width = 128, height = 42) {
      const points = this.normalizePoints(values, width, height)
      if (!points.length) {
        return ''
      }
      const line = points.map(point => `${point.x},${point.y}`).join(' L ')
      return `M ${points[0].x},${height} L ${line} L ${points[points.length - 1].x},${height} Z`
    },
    normalizePoints(values, width, height) {
      if (!Array.isArray(values) || !values.length) {
        return []
      }
      const max = Math.max(...values, 1)
      const min = Math.min(...values, 0)
      const range = Math.max(max - min, 1)
      return values.map((value, index) => {
        const x = values.length === 1 ? 0 : Math.round((index / (values.length - 1)) * width)
        const y = Math.round(height - ((value - min) / range) * (height - 8) - 4)
        return { x, y }
      })
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
    ringStyle(percent) {
      const circumference = 263.89
      return {
        strokeDashoffset: circumference - (circumference * Math.max(0, Math.min(100, percent))) / 100
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
    hexToRgba(hex, alpha) {
      const value = String(hex || '#22D3EE').replace('#', '')
      const bigint = parseInt(value, 16)
      const r = (bigint >> 16) & 255
      const g = (bigint >> 8) & 255
      const b = bigint & 255
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

.overview-page.theme-light .env-status-row.is-sweeping::before {
  opacity: 0.34;
}

.overview-page.theme-light .env-status-row::after {
  width: 52%;
  background: linear-gradient(100deg, transparent 0%, rgba(6, 182, 212, 0.12) 22%, rgba(255, 255, 255, 0.68) 36%, var(--system-accent) 52%, rgba(6, 182, 212, 0.22) 68%, transparent 100%);
  filter: blur(6px) saturate(1.7);
  mix-blend-mode: normal;
}

.overview-page.theme-light .env-status-row.is-sweeping {
  box-shadow: inset 0 0 0 1px rgba(6, 182, 212, 0.16), 0 0 16px rgba(6, 182, 212, 0.12);
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

.overview-hero {
  display: grid;
  grid-template-columns: minmax(520px, 1fr) 392px;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  min-height: 0;
  height: 104px;
  max-height: 112px;
}

.overview-hero__main {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 2px 0;
}

.overview-hero__copy {
  flex: 1 1 auto;
  min-width: 0;
}

.overview-kicker {
  display: inline-flex;
  margin-bottom: 4px;
  color: var(--accent);
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.overview-hero h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.overview-hero p {
  margin: 4px 0 0;
  color: var(--text-soft);
  font-size: 14px;
}

.overview-hero__metrics {
  min-width: 0;
  width: 352px;
  align-self: start;
  justify-self: end;
}

.overview-hero__metrics .metric-grid {
  justify-content: end;
}

.overview-hero__telemetry {
  flex: 0 1 430px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  padding: 1px;
  border: 1px solid rgba(34, 211, 238, 0.16);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(0, 245, 160, 0.08)),
    rgba(255, 255, 255, 0.035);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 16px 36px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}

.overview-hero__telemetry div {
  min-width: 0;
  padding: 11px 12px;
  background: var(--muted-surface);
}

.overview-hero__telemetry span {
  display: block;
  overflow: hidden;
  color: var(--text-soft);
  font-family: Consolas, Monaco, monospace;
  font-size: 10px;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.overview-hero__telemetry strong {
  display: block;
  margin-top: 5px;
  background: linear-gradient(135deg, #FFFFFF, var(--accent), var(--success));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  font-family: Consolas, Monaco, monospace;
  font-size: 22px;
  line-height: 1;
}

.overview-hero__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.theme-action,
.ghost-action,
.primary-action {
  height: 36px;
  padding: 0 12px 0 6px;
  color: var(--text-main);
  border-radius: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
  transition: all 0.3s ease;
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

.theme-action,
.ghost-action,
.primary-action {
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.theme-action:hover,
.ghost-action:hover,
.primary-action:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.15);
}

.theme-action .tech-icon .svg-icon,
.ghost-action .tech-icon .svg-icon,
.primary-action .tech-icon .svg-icon {
  width: 16px;
  height: 16px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 80px);
  justify-content: end;
  gap: 8px;
}

.metric-card,
.panel-surface,
.system-card {
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}

.metric-card {
  position: relative;
  overflow: hidden;
  width: 80px;
  height: 72px;
  min-height: 72px;
  padding: 8px;
  border-radius: 14px;
  transition: all 0.3s ease;
}

.metric-card::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 34%),
    linear-gradient(90deg, var(--metric-glow), transparent 48%);
  opacity: 0.48;
}

.metric-card:hover,
.system-card:hover,
.panel-surface:hover {
  border-color: var(--panel-border-strong);
  box-shadow: var(--shadow-hover), 0 0 0 1px rgba(34, 211, 238, 0.08);
}

.metric-card:hover {
  border-color: var(--panel-border-strong);
  box-shadow: var(--shadow-soft);
  transform: none;
}

.metric-card__head,
.metric-card__value,
.metric-card__foot {
  position: relative;
  z-index: 1;
}

.metric-card__head,
.metric-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.metric-card__head span,
.metric-card__foot small {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
}

.metric-card__head em {
  display: none;
}

.metric-card__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 6px;
}

.metric-card__value strong {
  background: linear-gradient(135deg, #FFFFFF, var(--metric-tone), #B8FFF2);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  font-family: Consolas, Monaco, monospace;
  font-size: 20px;
  font-weight: 700;
  line-height: 0.95;
}

.metric-card__value span {
  color: var(--metric-tone);
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
}

.metric-card__foot {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 7px;
  margin-top: 0;
  justify-content: flex-end;
}

.metric-card__foot small {
  display: none;
}

.metric-sparkline {
  width: 48px;
  height: 18px;
  overflow: visible;
}

.metric-sparkline path {
  fill: var(--metric-glow, var(--system-accent-soft));
}

.metric-sparkline polyline {
  fill: none;
  stroke: var(--metric-tone, var(--system-accent));
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 8px currentColor);
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
  grid-template-columns: repeat(auto-fit, minmax(288px, 1fr));
  gap: 14px;
}

.system-card {
  position: relative;
  overflow: hidden;
  height: 220px;
  min-height: 220px;
  padding: 20px;
  border-radius: 20px;
  background: var(--system-card-bg);
  transition: all 0.3s ease;
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

.system-info-trigger {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--text-soft);
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: help;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: all 0.22s ease;
}

.system-info-trigger .el-icon-info {
  display: block;
  font-size: 15px;
  line-height: 1;
}

.system-info-trigger:hover,
.system-info-trigger:focus-visible,
.system-info-trigger[aria-expanded="true"] {
  color: var(--system-accent);
  background: var(--system-accent-soft);
  border-color: var(--system-accent);
  box-shadow: 0 0 18px var(--system-glow), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.overview-page.theme-light .system-info-trigger {
  color: #64748B;
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.overview-page.theme-light .system-info-trigger:hover,
.overview-page.theme-light .system-info-trigger:focus-visible,
.overview-page.theme-light .system-info-trigger[aria-expanded="true"] {
  color: var(--system-accent);
  background: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.34);
  box-shadow: 0 12px 24px rgba(6, 182, 212, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.system-card__top,
.env-status-list {
  position: relative;
  z-index: 1;
}

.system-card__top {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.progress-ring {
  position: relative;
  width: 112px;
  height: 112px;
}

.progress-ring svg {
  width: 112px;
  height: 112px;
  transform: rotate(-90deg);
}

.ring-track,
.ring-value {
  fill: none;
  stroke-width: 10;
}

.ring-track {
  stroke: var(--ring-track);
}

.ring-value {
  stroke: var(--system-accent);
  stroke-dasharray: 263.89;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
  filter: drop-shadow(0 0 14px var(--system-glow));
}

.progress-center {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transform: translate(-50%, -50%);
}

.progress-ring strong {
  color: var(--text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
}

.progress-ring span {
  color: var(--system-accent);
  font-family: Consolas, Monaco, monospace;
  margin-left: 2px;
  font-size: 14px;
  line-height: 1;
  opacity: 0.82;
}

.system-card__summary {
  min-width: 0;
}

.system-status {
  display: inline-flex;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1;
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

.system-card h3 {
  overflow: hidden;
  margin: 13px 0 8px;
  color: var(--text-main);
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-card p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}

.env-status-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.env-status-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(42px, 0.8fr) minmax(32px, 1fr) 30px;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 4px 5px;
  overflow: hidden;
  background: var(--muted-surface);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.env-status-row::before,
.env-status-row::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
}

.env-status-row::before {
  background:
    linear-gradient(90deg, transparent, var(--system-accent-soft), transparent),
    radial-gradient(circle at 18% 50%, var(--system-accent-soft), transparent 34%);
}

.env-status-row::after {
  width: 42%;
  background: linear-gradient(100deg, transparent 0%, rgba(255, 255, 255, 0.18) 30%, var(--system-accent) 50%, rgba(255, 255, 255, 0.18) 68%, transparent 100%);
  filter: blur(10px);
  mix-blend-mode: screen;
  transform: translateX(-145%);
}

.env-status-row.is-sweeping::before {
  opacity: 0.34;
}

.env-status-row:hover {
  background: rgba(34, 211, 238, 0.075);
  border-color: rgba(34, 211, 238, 0.18);
}

.env-status-row__main {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.env-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--waiting);
  box-shadow: 0 0 12px rgba(255, 184, 77, 0.78);
}

.env-status-row.is-running .env-dot {
  background: var(--success);
  box-shadow: 0 0 14px rgba(0, 245, 160, 0.88);
}

.env-status-row.is-complete .env-dot {
  background: var(--accent);
  box-shadow: 0 0 14px rgba(34, 211, 238, 0.86);
}

.env-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.env-progress {
  position: relative;
  z-index: 1;
  overflow: hidden;
  min-width: 32px;
  height: 4px;
  background: rgba(167, 185, 204, 0.18);
  border-radius: 999px;
}

.env-progress i {
  position: absolute;
  inset: 0 auto 0 0;
  max-width: 100%;
  background: linear-gradient(90deg, var(--system-accent), rgba(255, 255, 255, 0.78));
  border-radius: inherit;
  box-shadow: 0 0 12px var(--system-glow);
  transition: width 0.45s ease;
}

.env-status-row.is-sweeping .env-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  width: 34%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.82), transparent);
  border-radius: inherit;
  transform: translateX(-120%);
}

.env-status-row strong {
  position: relative;
  z-index: 1;
  display: block;
  min-width: 30px;
  color: var(--text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
  text-align: right;
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
  .env-status-row.is-sweeping::after,
  .env-status-row.is-sweeping .env-progress::after {
    animation: envEnergySweep 4.2s cubic-bezier(0.45, 0, 0.2, 1) infinite;
  }

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

  .env-status-row.is-sweeping::after,
  .env-status-row.is-sweeping .env-progress::after {
    display: none;
  }
}

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
  .overview-hero {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
  }

  .overview-hero__main {
    padding-top: 0;
  }

  .overview-hero h1 {
    white-space: normal;
  }

  .metric-grid {
    grid-template-columns: repeat(4, 80px);
    justify-content: start;
  }

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

  .overview-hero {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    height: auto;
  }

  .overview-hero__main {
    width: 100%;
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-hero__actions {
    width: 100%;
  }

  .overview-hero__metrics {
    width: 100%;
    flex-basis: auto;
  }

  .theme-action,
  .ghost-action,
  .primary-action {
    flex: 1;
  }

  .metric-grid,
  .system-grid,
  .skeleton-grid {
    grid-template-columns: 1fr;
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
    height: auto;
    min-height: 220px;
    padding: 20px;
  }

  .system-info-trigger {
    top: 12px;
    right: 12px;
  }

  .system-card__top {
    grid-template-columns: 112px minmax(0, 1fr);
  }

  .progress-ring,
  .progress-ring svg {
    width: 112px;
    height: 112px;
  }

  .progress-ring strong {
    font-size: 40px;
  }

  .progress-ring span {
    font-size: 16px;
  }

  .env-status-row {
    grid-template-columns: minmax(52px, 0.72fr) minmax(48px, 1fr) 36px;
    min-height: 34px;
    padding: 6px 8px;
  }

  .env-status-list {
    margin-top: 10px;
    gap: 8px;
  }
}

@media (max-width: 560px) {
  .metric-grid {
    grid-template-columns: repeat(2, 80px);
  }

  .overview-hero__actions {
    flex-direction: column;
  }

  .theme-action,
  .ghost-action,
  .primary-action {
    width: 100%;
  }

  .quick-action {
    flex-basis: 100%;
  }

  .system-card__top {
    grid-template-columns: 1fr;
  }

  .env-status-list {
    grid-template-columns: 1fr;
  }

  .message-panel__body {
    padding-right: 4px;
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
</style>
