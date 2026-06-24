<template>
  <div class="overview-page" :class="themeClass">
    <div class="overview-shell">
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
              >
                <span class="tech-icon">
                  <svg-icon :icon-class="action.icon" />
                </span>
                {{ action.label }}
              </button>
              <div class="panel-live">
                <i />
                <span class="panel-live__time">{{ fullDateTime }}</span>
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
                <div class="system-card__identity">
                  <div class="system-identity__main">
                    <div class="system-identity__head">
                      <h3>{{ system.name }}</h3>
                      <span class="system-status" :class="systemStatusClass(system)">
                        {{ systemStatusText(system) }}
                      </span>
                    </div>
                    <p>{{ system.envs.length }} 个环境，{{ systemActiveText(system) }}</p>
                  </div>
                  <div class="system-identity__metrics">
                    <span class="system-metric" :class="systemAlertClass(system)">
                      <span class="system-metric__label">告警</span>
                      <span class="system-metric__value">{{ systemAlertCount(system) }}</span>
                    </span>
                    <span class="system-metric" :class="systemInspectionClass(system)">
                      <span class="system-metric__label">巡检</span>
                      <span class="system-metric__value">{{ systemInspectionStatus(system) }}</span>
                    </span>
                  </div>
                </div>

                <div class="env-grid">
                  <div
                    v-for="env in system.envs"
                    :key="system.name + '-' + env.key"
                    class="env-block"
                    :class="[envBlockClass(env), { 'is-sweeping': env.percent < 100 }]"
                    tabindex="0"
                  >
                    <span class="env-block__dot" />
                    <span class="env-block__name">{{ env.label }}</span>
                    <strong class="env-block__percent">{{ env.percent }}%</strong>
                    <span class="env-block__status">{{ envActiveText(env) }}</span>
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
    // 环境方块样式类
    envBlockClass(env) {
      if (env.running) {
        return 'is-active'
      }
      return env.percent >= 100 ? 'is-done' : 'is-idle'
    },
    // 环境激活文案（后续可对接后端字段 env.activeStatus）
    envActiveText(env) {
      return env.running || env.percent >= 100 ? '已激活' : '未激活'
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

.overview-page.theme-light .env-block.is-sweeping::before {
  opacity: 0.34;
}

.overview-page.theme-light .env-block::after {
  width: 52%;
  background: linear-gradient(100deg, transparent 0%, rgba(6, 182, 212, 0.12) 22%, rgba(255, 255, 255, 0.68) 36%, var(--system-accent) 52%, rgba(6, 182, 212, 0.22) 68%, transparent 100%);
  filter: blur(6px) saturate(1.7);
  mix-blend-mode: normal;
}

.overview-page.theme-light .env-block.is-sweeping {
  box-shadow: inset 0 0 0 1px rgba(6, 182, 212, 0.16), 0 0 16px rgba(6, 182, 212, 0.12);
}

.overview-page.theme-light .env-block {
  --hover-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  --hover-bg: linear-gradient(145deg, var(--system-accent-soft), transparent 50%);
  --hover-border: rgba(15, 23, 42, 0.07);
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
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 14px;
}

.system-card {
  position: relative;
  overflow: hidden;
  padding: 18px;
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

/* ---- 环境方块网格 ---- */

.env-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(82px, 96px));
  gap: 12px;
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

.env-block.is-sweeping::before {
  opacity: 0.32;
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

.env-block.is-sweeping:hover::before {
  opacity: 0.5;
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
  .env-block.is-sweeping::after {
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

  .env-block.is-sweeping::after {
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
    grid-template-columns: repeat(auto-fit, minmax(72px, 92px));
    gap: 8px;
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
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
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
