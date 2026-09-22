<template>
  <el-dialog
    :visible.sync="innerVisible"
    :custom-class="isMore ? 'fd-dialog fd-dialog--detail' : 'fd-dialog'"
    width="820px"
    top="7vh"
    append-to-body
  >
    <!-- 标题：弹窗名 + alertKey（三个弹窗统一） -->
    <div slot="title" class="fd-title" :class="{ 'is-detail': isMore }">
      <span class="fd-title__main">{{ dialogTitle }}</span>
      <span v-if="headKey" class="fd-title__sub" :title="headKey">{{ headKey }}</span>
    </div>

    <div class="fd" :class="{ 'is-detail': isMore }">
      <!-- ==================== 更多字段：告警详情 ==================== -->
      <template v-if="isMore">
        <!-- 摘要区：级别 / 状态 / 来源 + 告警摘要 -->
        <div class="fd-summary">
          <div v-if="metaItems.length > 0" class="fd-summary__meta">
            <span v-for="meta in metaItems" :key="meta.key" class="fd-summary__meta-item">
              <span class="fd-summary__meta-label">{{ meta.label }}</span>
              <el-tag size="mini" effect="plain" class="fd-summary__meta-tag">{{ meta.value }}</el-tag>
            </span>
          </div>
          <div v-if="summaryText" class="fd-summary__content">
            <div class="fd-summary__label">告警摘要</div>
            <div class="fd-summary__text" :title="summaryText">{{ summaryText }}</div>
          </div>
        </div>

        <!-- 分组字段：两列，label 在上 value 在下 -->
        <div v-for="group in fieldGroups" :key="group.name" class="fd-group">
          <div class="fd-group__title">{{ group.name }}</div>
          <div class="fd-group__grid">
            <div v-for="field in group.fields" :key="field.key" class="fd-field">
              <div class="fd-field__label" :title="field.key">{{ field.key }}</div>
              <div class="fd-field__value" :class="field.clamp" :title="field.tooltip">
                <!-- 值本身是 http(s) 链接的字段（如 metric_link）可以直接点开 -->
                <a
                  v-if="field.href"
                  class="fd-field__link"
                  :href="field.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ field.display }}</a>
                <template v-else>{{ field.display }}</template>
              </div>
              <i
                class="fd-field__copy el-icon-document-copy"
                title="复制原始值"
                v-clipboard:copy="field.copy"
                v-clipboard:success="clipboardSuccess"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- ==================== 使用到的智能体 / 告警详情 ==================== -->
      <template v-else>
        <!-- 使用到的智能体：AgentTrace -->
        <template v-if="type === 'trace'">
          <div v-if="traceList.length > 0" class="fd__trace">
            <div v-for="(trace, index) in traceList" :key="index" class="fd__trace-item">
              <div class="fd__trace-head">
                <span class="fd__trace-index">{{ index + 1 }}</span>
                <span class="fd__trace-expert">{{ trace.expert }}</span>
                <!-- 技能标签跟在专家名右边，调用时间仍然靠右 -->
                <div v-if="trace.skillName && trace.skillName.length" class="fd__trace-skills">
                  <el-tag
                    v-for="skill in trace.skillName"
                    :key="skill"
                    size="mini"
                    effect="plain"
                    class="fd__trace-skill"
                  >
                    {{ skill }}
                  </el-tag>
                </div>
                <span class="fd__trace-time">{{ trace.callTime }}</span>
              </div>
              <div class="fd__trace-reason">{{ trace.reason }}</div>
            </div>
          </div>
          <el-empty v-else description="该告警无智能体调用记录" :image-size="90" />
        </template>

        <!-- 告警详情：output 是 markdown 文本，按 markdown 渲染（标题 / 有序无序列表 / 段落 + 行内链接、加粗、代码） -->
        <template v-else>
          <div v-if="reportBlocks.length > 0" class="fd__report">
            <component
              :is="block.tag"
              v-for="(block, index) in reportBlocks"
              :key="index"
              class="fd__report-block"
              :class="'is-' + block.type"
            >
              <span v-if="block.marker" class="fd__report-marker">{{ block.marker }}</span>
              <template v-for="(run, ri) in block.runs">
                <a
                  v-if="run.href"
                  :key="ri"
                  class="fd__report-link"
                  :href="run.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ run.v }}</a>
                <code v-else-if="run.t === 'code'" :key="ri" class="fd__report-code">{{ run.v }}</code>
                <strong v-else-if="run.t === 'b'" :key="ri">{{ run.v }}</strong>
                <span v-else :key="ri">{{ run.v }}</span>
              </template>
            </component>
          </div>
          <el-empty v-else description="该告警暂无告警详情" :image-size="90" />
        </template>
      </template>
    </div>
  </el-dialog>
</template>

<script>
// 表格已展示的字段 + 通过按钮展示的字段，剩下的都在这里动态展示
const SHOWN_KEYS = [
  'alertKey',
  'summary',
  'misinfoReason', // ⚠️ 小写 i，别写成 misInfoReason
  'alertReasonDesc',
  'AgentTrace',
  'output'
]
// 明确不展示的字段：表格列已去掉，这里也不再列出
const HIDDEN_KEYS = ['alertSource', 'closedBy']
// 摘要区已展示的字段，不在下方字段列表里重复
const SUMMARY_KEYS = ['level', 'status', 'sourceName']
const META_LABELS = { level: '告警级别', status: '告警状态', sourceName: '来源' }
// 毫秒时间戳字段，展示可读时间，原始值放 tooltip
const MS_KEYS = ['time', 'gte', 'lte', 'createTime', 'receiveTime']
// 字段分组：未出现在任何分组里的字段会自动落到「其他信息」，保证不丢字段
const GROUP_DEFS = [
  { name: '告警时间', keys: ['startTime', 'endTime', 'createTime', 'receiveTime', 'time'] },
  { name: '告警指标', keys: ['metric', 'actual_value', 'gte', 'lte', 'metric_link'] },
  { name: '系统信息', keys: ['idc', 'runId', 'systemId'] }
]
// 长文本字段的展示方式：metric 允许 2 行，其余单行截断 + tooltip
const CLAMP_CLASS = { metric: 'is-clamp2' }
// 单元格可用宽度（px），估算超过这个宽度才挂 tooltip，避免短值上出现无意义的提示
const CELL_WIDTH = 320
const CJK_RE = /[　-〿㐀-䶿一-鿿＀-￯]/

// 粗估文本宽度：CJK 按 13px，其余按 6.5px
function estWidth(text) {
  let width = 0
  for (let i = 0; i < text.length; i++) {
    width += CJK_RE.test(text.charAt(i)) ? 13 : 6.5
  }
  return width
}

// http(s) 开头的值渲染成可点击链接，其余仍按普通文本展示
const URL_RE = /^https?:\/\//i

const pad = (n) => String(n).padStart(2, '0')

// 毫秒 -> yyyy-MM-dd HH:mm:ss（按 +08:00）
function formatMs(value) {
  const num = Number(value)
  if (!isFinite(num) || num < 1e12 || num >= 1e13) return ''
  const d = new Date(num + 8 * 3600 * 1000)
  if (isNaN(d.getTime())) return ''
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  return `${date} ${time}`
}

/* ---- 告警详情（output）的 markdown 轻量渲染 ----
   按行拆成块（标题 / 列表项 / 段落），行内再拆成 run（链接 / 加粗 / 代码 / 纯文本）。
   结果交给模板渲染，不用 v-html，避免注入风险。 */
const HEADING_RE = /^(#{1,6})\s+(.*)$/
const ORDERED_RE = /^(\d{1,2})[.、]\s+(.*)$/
const UNORDERED_RE = /^[-*+]\s+(.*)$/
// 行内只处理 markdown 语法本身：**加粗** / `代码` / [文本](链接)。
// 裸 URL 按标准 markdown 不自动成链，保持纯文本，不再变蓝
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g

function inlineRuns(text) {
  const runs = []
  const push = (type, value, href) => runs.push({ t: type, v: value, href: href || '' })
  let last = 0
  let matched
  INLINE_RE.lastIndex = 0
  while ((matched = INLINE_RE.exec(text)) !== null) {
    if (matched.index > last) push('text', text.slice(last, matched.index))
    const token = matched[0]
    if (token.slice(0, 2) === '**') {
      push('b', token.slice(2, -2))
    } else if (token.charAt(0) === '`') {
      push('code', token.slice(1, -1))
    } else {
      // [文本](链接)：链接文字照常显示，地址放到 href
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      push('a', link[1], link[2])
    }
    last = matched.index + token.length
  }
  if (last < text.length) push('text', text.slice(last))
  return runs
}

function parseMarkdown(text) {
  const blocks = []
  String(text)
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim()
      if (trimmed === '') return
      let matched = trimmed.match(HEADING_RE)
      if (matched) {
        blocks.push({ type: 'h', tag: 'h4', marker: '', runs: inlineRuns(matched[2]) })
        return
      }
      matched = trimmed.match(ORDERED_RE)
      if (matched) {
        blocks.push({ type: 'li', tag: 'div', marker: matched[1] + '.', runs: inlineRuns(matched[2]) })
        return
      }
      matched = trimmed.match(UNORDERED_RE)
      if (matched) {
        blocks.push({ type: 'li', tag: 'div', marker: '•', runs: inlineRuns(matched[1]) })
        return
      }
      blocks.push({ type: 'p', tag: 'p', marker: '', runs: inlineRuns(trimmed) })
    })
  return blocks
}

// 单个字段 -> 展示模型（展示值 / tooltip / 复制值 / 行数限制）
function buildField(key, raw) {
  const empty = raw === undefined || raw === null || raw === ''
  const text = empty ? '' : String(raw)
  const trimmed = text.trim()
  const human = MS_KEYS.indexOf(key) >= 0 ? formatMs(raw) : ''
  const href = !empty && URL_RE.test(trimmed) ? trimmed : ''
  const display = empty ? '-' : human || href || text
  let tooltip = ''
  if (!empty && (human || estWidth(text) > CELL_WIDTH)) {
    tooltip = human ? `${key}: ${text}` : text
  }
  return {
    key: key,
    display: display,
    href: href,
    tooltip: tooltip,
    copy: text,
    clamp: CLAMP_CLASS[key] || ''
  }
}

export default {
  name: 'FieldDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    // trace | report | more
    type: {
      type: String,
      default: 'more'
    },
    item: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    innerVisible: {
      get() {
        return this.visible
      },
      set(val) {
        this.$emit('update:visible', val)
      }
    },
    isMore() {
      return this.type === 'more'
    },
    dialogTitle() {
      // report = 表格 output 列「告警详情」按钮打开的弹窗（渲染 output 的 markdown）
      // more   = 原「更多字段」弹窗。该入口已改成「查看简报」（跳外部系统），当前没有调用方，
      //          代码先留着，需要时还能接回来。
      const titles = {
        trace: '使用到的智能体',
        report: '告警详情',
        more: '告警详情'
      }
      return titles[this.type] || ''
    },
    headKey() {
      const val = this.item && this.item.alertKey
      return val === undefined || val === null ? '' : String(val)
    },
    summaryText() {
      const val = this.item && this.item.summary
      return val === undefined || val === null || val === '' ? '' : String(val)
    },
    // 级别 / 状态 / 来源
    metaItems() {
      const item = this.item || {}
      return SUMMARY_KEYS.filter((key) => {
        const val = item[key]
        return val !== undefined && val !== null && val !== ''
      }).map((key) => ({
        key: key,
        label: META_LABELS[key],
        value: item[key]
      }))
    },
    traceList() {
      const list = this.item && this.item.AgentTrace
      return Array.isArray(list) ? list.filter((t) => t && typeof t === 'object') : []
    },
    // 告警详情：把 output 当作 markdown 解析成块
    reportBlocks() {
      const text = this.item && this.item.output
      if (text === undefined || text === null || text === '') return []
      return parseMarkdown(text)
    },
    // 除表格列、摘要区、以及明确不展示的字段之外的字段，按分组输出
    fieldGroups() {
      const item = this.item || {}
      const keys = Object.keys(item).filter((key) => {
        return (
          SHOWN_KEYS.indexOf(key) < 0 &&
          HIDDEN_KEYS.indexOf(key) < 0 &&
          SUMMARY_KEYS.indexOf(key) < 0
        )
      })
      const groups = GROUP_DEFS.map((def) => ({
        name: def.name,
        keys: def.keys.filter((key) => keys.indexOf(key) >= 0)
      }))
      const grouped = groups.reduce((acc, group) => acc.concat(group.keys), [])
      const rest = keys.filter((key) => grouped.indexOf(key) < 0)
      if (rest.length > 0) {
        groups.push({ name: '其他信息', keys: rest })
      }
      return groups
        .filter((group) => group.keys.length > 0)
        .map((group) => ({
          name: group.name,
          fields: group.keys.map((key) => buildField(key, item[key]))
        }))
    }
  },
  methods: {
    clipboardSuccess() {
      this.$modal.msgSuccess('复制成功')
    }
  }
}
</script>

<style lang="scss" scoped>
$border: #ebeef5;
$text-main: #303133;
$text-sub: #909399;

.fd {
  max-height: 68vh;
  overflow-y: auto;

  // 「更多字段」模式：body 自带内边距，不限制高度、不出现滚动条，内容整体铺开展示
  // （基础 .fd 的 68vh 上限只作用于智能体/报告两个弹窗）
  &.is-detail {
    padding: 14px 20px 18px;
    max-height: none;
    overflow: visible;
  }

  /* ---------- 智能体 ---------- */
  &__trace-item {
    border: 1px solid $border;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__trace-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap; // 标签多的时候换行，而不是把整行撑破
    gap: 8px;
    margin-bottom: 8px;
  }

  &__trace-index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ecf5ff;
    color: #409eff;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  &__trace-expert {
    flex: none;
    font-size: 13.5px;
    font-weight: 600;
    color: $text-main;
  }

  &__trace-time {
    flex: none;
    margin-left: auto;
    font-size: 12px;
    color: $text-sub;
  }

  // 与专家名同一行，空间不够时在内部换行
  &__trace-skills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__trace-skill {
    margin: 0;
  }

  &__trace-reason {
    font-size: 12.5px;
    color: #606266;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  /* ---------- 告警详情：output 按 markdown 渲染 ---------- */
  &__report {
    border: 1px solid $border;
    border-radius: 8px;
    padding: 6px 18px 16px;
  }

  // 标题 / 列表项 / 段落共用一个基础样式，用 is-h / is-li / is-p 区分
  &__report-block {
    margin: 0;

    &.is-p {
      margin: 6px 0;
      font-size: 12.5px;
      line-height: 1.8;
      color: #606266;
      word-break: break-word;
    }

    &.is-li {
      display: flex;
      gap: 6px;
      margin: 5px 0;
      font-size: 12.5px;
      line-height: 1.8;
      color: #606266;
      word-break: break-word;
    }

    // 章节标题：只靠字号 / 字重 / 颜色区分，不加横线和色块
    &.is-h {
      margin: 18px 0 8px;
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.6;
      color: $text-main;

      &:first-child {
        margin-top: 10px;
      }
    }
  }

  &__report-marker {
    flex: none;
    min-width: 15px;
    text-align: right;
    color: #909399;
  }

  // 正文里的链接：默认跟随正文颜色，只有 hover 才变蓝，避免整段文字被一条蓝url打断
  &__report-link {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dashed #c9cdd4;

    &:hover {
      color: #409eff;
      border-bottom-color: #409eff;
    }
  }

  &__report-code {
    padding: 0 4px;
    border-radius: 3px;
    background: #f5f7fa;
    font-family: Consolas, Menlo, 'Courier New', monospace;
    font-size: 12px;
    color: #c7254e;
  }
}

/* ==================== 告警详情（更多字段） ==================== */
.fd-title {
  display: flex;
  flex-direction: column;
  gap: 3px;

  &__main {
    font-size: 18px;
    font-weight: 400;
    line-height: 1.3;
    color: $text-main;
  }

  &__sub {
    font-family: Consolas, Menlo, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.3;
    color: #86909c;
    padding-right: 28px; // 避开关闭按钮
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &.is-detail &__main {
    font-weight: 600;
    color: #1d2129;
  }
}

/* 摘要区 */
.fd-summary {
  background: #f7f8fa;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 14px;

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 20px;
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__meta-label {
    font-size: 12px;
    color: #86909c;
  }

  &__meta-tag {
    margin: 0;
  }

  &__content {
    margin-top: 9px;
  }

  &__label {
    font-size: 12px;
    color: #86909c;
    margin-bottom: 2px;
  }

  &__text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
    font-size: 13px;
    line-height: 1.5;
    color: #1d2129;
  }
}

/* 分组 */
.fd-group {
  & + & {
    margin-top: 14px;
  }

  // 分组标题要比下面的字段名（12px/#86909C）明显：字号加大、颜色加深、左侧加主题色竖条
  &__title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    color: #1d2129;
    padding: 8px 0 8px 9px;
    margin-bottom: 2px;
    border-left: 3px solid #409eff;
    border-radius: 2px 0 0 2px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)); // 两列，长文本不撑破列宽
    column-gap: 16px;
  }
}

/* 字段：label 在上、value 在下，只有极淡分割线，不用卡片 */
.fd-field {
  position: relative;
  min-height: 50px;
  padding: 8px 22px 8px 8px;
  border-bottom: 1px solid #f2f3f5;
  transition: background 0.15s ease;

  &:hover {
    background: #fafbfc;

    .fd-field__copy {
      opacity: 1;
    }
  }

  &__label {
    font-size: 12px;
    line-height: 1.4;
    color: #86909c;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__value {
    font-size: 13px;
    line-height: 1.45;
    color: #1d2129;
    word-break: break-all;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.is-clamp2 {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  }

  // 可点击的值（如 metric_link）：主题蓝，hover 加下划线
  &__link {
    color: #409eff;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      color: #66b1ff;
      text-decoration: underline;
    }
  }

  &__copy {
    position: absolute;
    top: 7px;
    right: 6px;
    font-size: 13px;
    color: #c0c4cc;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;

    &:hover {
      color: #409eff;
    }
  }
}
</style>

<!-- dialog 挂载在 body 上，覆盖 el-dialog 内部样式需非 scoped（同 bill 页做法） -->
<style lang="scss">
// 三个弹窗（更多字段 / 使用到的智能体 / 告警详情）统一圆角
.fd-dialog {
  border-radius: 8px;
}

// 「更多字段」：标题固定，body 自带内边距
.fd-dialog--detail {
  .el-dialog__header {
    padding: 14px 20px 12px;
    border-bottom: 1px solid #f0f2f5;
  }

  .el-dialog__headerbtn {
    top: 14px;
    right: 18px;
  }

  .el-dialog__body {
    padding: 0;
  }
}
</style>
