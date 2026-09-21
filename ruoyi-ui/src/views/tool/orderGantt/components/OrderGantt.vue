<template>
  <div class="og">
    <!-- ==================== 顶部：概览 + 图例 ==================== -->
    <div ref="head" class="og__head">
      <div class="og__stats">
        <div
          v-for="s in statCards"
          :key="s.key"
          class="og__stat"
          :class="'is-' + s.key"
        >
          <span class="og__stat-value">{{ s.value }}</span>
          <span class="og__stat-label">{{ s.label }}</span>
        </div>
      </div>

      <div class="og__legend">
        <span class="og__legend-item">
          <i class="og__legend-dot is-manual" />
          手动 / 其他 · {{ stats.manual }}
        </span>
        <span class="og__legend-item">
          <i class="og__legend-dot is-auto" />
          AUTO 自动 · {{ stats.auto }}
        </span>
        <span v-if="invalidCount > 0" class="og__legend-warn">
          <i class="el-icon-warning-outline" />
          {{ invalidCount }} 条时间无效未展示
        </span>
      </div>
    </div>

    <!-- ==================== 空态 ==================== -->
    <div v-if="!hasData" class="og__empty">
      <i class="el-icon-data-analysis" />
      <p>暂无可展示的工单</p>
    </div>

    <!-- ==================== 图表 ====================
         正常情况下**不出现任何滚动条**：
           宽度 —— 绘图区 = 容器宽，永远铺满；
           高度 —— 行高按可用高度反推（见 geometry），正好把所有行塞进去。
         日期带 / 时间轴仍留在里面用 sticky 吸边，好处是**三者宽度天然一致**：
         万一退化成纵向滚动（并发行数太多），滚动条会吃掉 8px 宽，
         拆到外面的话刻度就会和矩形错位。
    -->
    <div
      v-else
      ref="plotwrap"
      class="og__plotwrap"
      :class="{ 'is-scrolly': scrollY }"
    >
      <div class="og__inner" :style="{ width: plotWidth + 'px' }">
        <!-- 日期带（吸顶） -->
        <div ref="days" class="og__days">
          <div
            v-for="d in days"
            :key="d.dayStart"
            class="og__day"
            :style="{ left: d.x + 'px', width: d.width + 'px' }"
          >
            <span class="og__day-label">{{ d.label }}</span>
          </div>
        </div>

        <!-- 绘图区 -->
        <div class="og__plot" :style="{ height: totalHeight + 'px' }">
          <!-- 分组底色 -->
          <div
            v-for="g in groups"
            :key="'band-' + g.key"
            class="og__band"
            :class="'is-' + g.tone"
            :style="{ top: g.top + 'px', height: g.height + 'px' }"
          />

          <!-- 行分隔线 -->
          <div
            v-for="r in rows"
            :key="r.key"
            class="og__row"
            :style="{ top: r.top + 'px', height: r.height + 'px' }"
          />

          <!-- 竖向网格 -->
          <div
            v-for="t in gridTicks"
            :key="'g' + t.time"
            class="og__grid"
            :class="{ 'is-day': t.dayStart }"
            :style="{ left: t.x + 'px' }"
          />

          <!-- 分组分隔带（AUTO 组贴 x 轴，靠这条带和上面区分开） -->
          <div
            v-for="g in separators"
            :key="'sep-' + g.key"
            class="og__sep"
            :style="{ top: g.separatorTop + 'px' }"
          >
            <span class="og__sep-chip">{{ g.label }} · {{ g.count }} 条</span>
          </div>

          <!-- 「现在」竖线 -->
          <div v-if="nowX !== null" class="og__now" :style="{ left: nowX + 'px' }">
            <span class="og__now-dot" />
          </div>

          <!-- 工单矩形 -->
          <div
            v-for="bar in bars"
            :key="bar.key"
            class="og-bar"
            :class="[
              bar.auto ? 'is-auto' : 'is-manual',
              bar.width < 18 ? 'is-narrow' : ''
            ]"
            :style="{
              left: bar.left + 'px',
              width: bar.width + 'px',
              top: bar.top + 'px',
              height: bar.height + 'px'
            }"
            @mouseenter="onBarEnter(bar, $event)"
            @mouseleave="onBarLeave"
          >
            <span v-if="barLabel(bar)" class="og-bar__text">{{ barLabel(bar) }}</span>
          </div>
        </div>

        <!-- 时间轴（吸底）：短线 + 标签分两组画。
             短线**不能**放进 .og__tick 里 —— tick 会被 tickStyle 的 translateX 左右夹取
             （首尾各贴边、中间的居中），线会跟着跑偏。短线用不加 transform 的
             独立元素，left 就是 t.x，永远对着刻度。 -->
        <div ref="axis" class="og__axis">
          <div
            v-for="t in gridTicks"
            :key="'k' + t.time"
            class="og__tick-mark"
            :class="{ 'is-day': t.dayStart }"
            :style="{ left: t.x + 'px' }"
          />
          <div
            v-for="t in ticks"
            :key="'a' + t.time"
            class="og__tick"
            :class="{ 'is-day': t.dayStart }"
            :style="tickStyle(t)"
          >
            {{ t.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 悬浮气泡：工单号 + detail 明细表 ==================== -->
    <!-- ref="tip" 是必需的：tipStyle 要用**渲染后的真实高度**定位（见 measureTip） -->
    <div
      v-if="hover"
      ref="tip"
      class="og-tip"
      :style="tipStyle"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
    >
      <div class="og-tip__head">
        <i class="og-tip__dot" :class="hover.auto ? 'is-auto' : 'is-manual'" />
        <span class="og-tip__id">{{ hover.orderId }}</span>
        <span class="og-tip__mode" :class="hover.auto ? 'is-auto' : 'is-manual'">
          {{ hover.mode }}
        </span>
      </div>

      <div class="og-tip__meta">
        <span><i class="el-icon-time" />{{ hoverBeginText }}</span>
        <i class="el-icon-right og-tip__arrow" />
        <span>{{ hoverEndText }}</span>
        <span class="og-tip__cost">
          <i class="el-icon-timer" />{{ hoverDurationText }}
        </span>
      </div>

      <!-- detail 是**对象数组**（字段固定 type / count / type_cost），用表格展示。
           表头直接取 key 名，不翻译 —— 用户明确要求「表头就用 key 值就可以了」。
           列不写死：从数据里取 key 的并集，以后后端加字段不用改这里。 -->
      <div class="og-tip__detail">
        <table v-if="detailColumns.length" class="og-tip__table">
          <thead>
            <tr>
              <th
                v-for="c in detailColumns"
                :key="c.key"
                :class="{ 'is-num': c.num }"
              >
                {{ c.key }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in detailRows" :key="ri">
              <td
                v-for="c in detailColumns"
                :key="c.key"
                :class="{ 'is-num': c.num }"
              >
                {{ formatCell(row[c.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="og-tip__nodetail">该工单没有 detail</div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  buildLayout,
  measureTimeAxis,
  measureRowPlan,
  fitRowPlan,
  formatDateTimeShort,
  formatDuration
} from '../ganttLayout'

/** 刻度格数上限（标签数 = 格数 + 1） */
const MAX_TICKS = 12

/* ------------------------------------------------------------ 尺寸策略
 * 目标：**弹窗里不出现滚动条，一眼看全所有工单**（用户明确要求）。
 * 所以这里不写死行高，而是「按可用高度反推行高」：
 *   可用高度 = 组件量到的总高 - 页头 - 日期带 - 时间轴
 *   行高     = 可用高度 / 总行数，再夹到 [MIN, MAX] 之间
 * 行数只跟数据有关（measureRowPlan），所以先算行数、再定行高，不会来回抖。
 * 具体退让规则在 ganttLayout.js 的 fitRowPlan 里（那才是唯一实现，这里不重复）。
 * ------------------------------------------------------------------ */

/** 日期带 / 时间轴固定高度，**只作为「还没量到」时的兜底**，实际以量到的为准 */
const DAY_BAND_HEIGHT = 24
const AXIS_HEIGHT = 38
/** 绘图容器自己的上下边框（吃掉 2px，必须从可用高度里扣掉） */
const PLOTWRAP_BORDER_Y = 2

/**
 * 量一个元素的**占位高度** = offsetHeight + 上下外边距。
 *
 * ⚠️ 不能只取 `offsetHeight`：`.og__head` 带 `margin-bottom: 12px`，
 *    而 `.og` 是 column flex 容器 —— **外边距不会折叠，照样占位**。
 *    只算 offsetHeight 会少算 12px，反推出的行高偏大，整图比容器高出一截、
 *    底部被 `overflow-y: hidden` 切掉。实测就是这么错的：
 *    headHeight 量到 50（真实占位 62）→ 整图 664px > 可用 657px → 时间轴被切掉 9px。
 */
function outerHeight(el, fallback) {
  if (!el) {
    return fallback
  }
  const cs = window.getComputedStyle(el)
  const h =
    el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0)
  return h > 0 ? h : fallback
}

/** 矩形最小宽度：比这更窄就没法悬浮了 */
const MIN_BAR_WIDTH = 8
/** 绘图区最小宽度（容器极窄时的兜底，别让矩形挤成 0 宽） */
const MIN_PLOT_WIDTH = 360
/** 量不到容器高度时的兜底高度（保证纯函数拿到的是个合理值） */
const FALLBACK_AVAIL_HEIGHT = 380
/** 量不到页头高度时的兜底（页头 = 统计行 + 下边距 + 分隔线） */
const FALLBACK_HEAD_HEIGHT = 62
/** 弹窗占视口的比例 + 弹窗自身 chrome 的高度（头和 body 内边距、边框） */
const DIALOG_VH_RATIO = 0.88
const DIALOG_CHROME = 90

/**
 * 首帧用的容器高度估算。
 * 组件是挂载后才 measure() 的，如果初始值给 0 就会先用兜底高度算一次行高，
 * 量到真值后再改 —— 表现为打开弹窗瞬间矩形「先细后粗」闪一下。
 * 用视口估一次几乎就是真值（弹窗就是 88vh），闪动基本看不出来。
 */
function estimateContainerHeight() {
  if (typeof window === 'undefined' || !window.innerHeight) {
    return 0
  }
  return Math.max(0, Math.round(window.innerHeight * DIALOG_VH_RATIO) - DIALOG_CHROME)
}

/**
 * 悬浮气泡与矩形之间的间距。
 *
 * ⚠️ **必须 ≤ 6px**，这是算出来的，不是拍的：
 *    矩形在行内垂直居中，`top = 行顶 + (行高 - 矩形高) / 2`，而
 *    `矩形高 = min(22, 行高 - 6)` → 行内上下各留 3px → **相邻两行的矩形之间恒定 6px 空隙**。
 *    间距只要 ≤ 6，气泡就完全盖住这段空隙，鼠标从矩形往上走时**中途不会碰到上一行的矩形**
 *    （碰到了就会触发那一行的 mouseenter，气泡内容当场被换掉）。
 *    之前是 10px，会露出 4px 的上一行矩形，鼠标慢慢往上移就会「跳」到别的工单上。
 */
const TIP_GAP = 6
/**
 * 气泡宽度的固定值。
 * 从 380 加到 420：detail 换成表格后多了列内边距，
 * `type` 那列最长有 15 个字符（「ITSM_原子变更_YUM包更新」），380 会让它折成三行。
 */
const TIP_WIDTH = 420
/**
 * 气泡高度的**兜底估算**，只在「渲染后还没量到真实高度」的那一帧用。
 * 千万别拿它当真实高度做定位 —— 它会随 detail 行数在 150~330px 之间变，
 * 用固定值算会导致矮气泡离矩形极远（实测 detail 小的那条留了 150px 空白，鼠标根本走不过去）。
 */
const TIP_HEIGHT_FALLBACK = 300
/** 鼠标离开矩形后延迟关闭的毫秒数：留出从矩形挪到气泡上的时间 */
const TIP_CLOSE_DELAY = 220
/**
 * 判定「鼠标还在气泡附近」时的容差（px）。
 * 矩形 hover 时会上浮 1px，取值会有 1px 抖动，给点余量免得气泡闪。
 */
const TIP_KEEP_PAD = 10
const EDGE = 8

export default {
  name: 'OrderGantt',
  props: {
    /**
     * 工单数组，与 orderRes.data 同形：
     * { orderId, total_cost, beginTime, endTime, mode, detail }
     * 其中 detail 是对象数组，每项 { type, count, type_cost }
     */
    orders: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      /** 滚动容器的可用宽度，由 measure() 量出来 */
      containerWidth: 900,
      /** 组件根节点的总高（父级给了确定高度，所以这不是内容撑出来的） */
      containerHeight: estimateContainerHeight(),
      /**
       * 三段「固定高度」的实际占位：页头 / 日期带 / 时间轴。
       * 它们的高度都跟行高无关，所以**可以直接量**，不会和行高形成循环依赖。
       * 量到之后就不用再靠常量了 —— 常量只当「首帧还没量到」时的兜底。
       */
      headHeight: FALLBACK_HEAD_HEIGHT,
      daysHeight: DAY_BAND_HEIGHT,
      axisHeight: AXIS_HEIGHT,
      hover: null,
      tipRect: null,
      /**
       * 气泡的**真实尺寸**，渲染后量出来（不是估算）。
       * 初始 {0,0} 表示「还没量到」—— 此时气泡先 visibility:hidden，
       * 免得在错误的估算位置闪一下。
       */
      tipSize: { w: 0, h: 0 },
      closeTimer: null
    }
  },
  computed: {
    /** 时间轴（只跟数据有关，跟宽度无关） */
    axis() {
      return measureTimeAxis(this.orders, MAX_TICKS)
    },
    /**
     * 绘图区宽度 = **容器宽度**，铺满、不横向滚动（用户要求「不要滚动条」）。
     *
     * 代价：跨度大（最多 3 天）时矩形会被压窄。压到 MIN_BAR_WIDTH 就不再缩了 ——
     * 宁可略微重叠，也保证每根矩形都还悬浮得出来（否则气泡就没法触发）。
     * 之前的做法是按 MIN_PX_PER_HOUR 把绘图区撑开、横向滚动，观感更舒展，
     * 但和「一眼看全」冲突，所以改掉了；要还原只需把 plotWidth 换成
     * `max(容器宽, 跨度小时数 × 48)`。
     */
    plotWidth() {
      return Math.max(MIN_PLOT_WIDTH, this.containerWidth)
    },
    /** 只算行数（不含时间轴、不含像素），给行高反推用 */
    rowPlan() {
      return measureRowPlan(this.orders)
    },
    /**
     * 绘图区能用的高度 = 组件总高 - 页头 - 日期带 - 时间轴 - 绘图容器上下边框。
     * 三段固定高度都是**量出来的**（含外边距），不靠常量 —— 常量对不上 CSS 就会被裁。
     */
    availablePlotHeight() {
      const total = this.containerHeight > 120 ? this.containerHeight : FALLBACK_AVAIL_HEIGHT
      const fixed = this.headHeight + this.daysHeight + this.axisHeight + PLOTWRAP_BORDER_Y
      return Math.max(60, total - fixed)
    },
    /** 行高 / 矩形高 / 分隔带 —— 退让规则全在 ganttLayout.fitRowPlan 里 */
    geometry() {
      return fitRowPlan(this.rowPlan, this.availablePlotHeight)
    },
    /** 只有「并发行数多到行高压到下限仍放不下」时才为 true，用来退化成内部滚动 */
    scrollY() {
      return this.geometry.scrollY
    },
    layout() {
      return buildLayout(this.orders, {
        plotWidth: this.plotWidth,
        rowHeight: this.geometry.rowHeight,
        barHeight: this.geometry.barHeight,
        groupGap: this.geometry.groupGap,
        maxTicks: MAX_TICKS,
        minBarWidth: MIN_BAR_WIDTH
      })
    },
    hasData() {
      return this.layout.hasData
    },
    bars() {
      return this.layout.bars
    },
    rows() {
      return this.layout.rows
    },
    groups() {
      return this.layout.groups
    },
    ticks() {
      return this.layout.ticks
    },
    /**
     * 画「有宽度」的东西（竖向网格线、时间轴短线）时用的刻度 —— **剔掉正好落在
     * 绘图区右边缘的那一个**。
     *
     * 为什么必须剔：alignDomain 保证时间域终点落在刻度上，所以最后一个刻度的
     * x 恰好等于 plotWidth；而网格线是 `position:absolute; left:plotWidth; width:1px`，
     * 右边缘顶到 plotWidth + 1 → `overflow-x: auto` 立刻冒出一根横向滚动条。
     * 实测就是这样：clientWidth 1430、scrollWidth 1431，多出来的**正好 1px**。
     * 那根线本来就和绘图区右边框重合，去掉不损失任何信息。
     *
     * 刻度**标签**不能剔（那是时间轴的末端时间），所以模板里标签仍用 `ticks`。
     */
    gridTicks() {
      const limit = this.plotWidth - 0.5
      return this.ticks.filter((t) => t.x < limit)
    },
    days() {
      return this.layout.days
    },
    totalHeight() {
      return this.layout.totalHeight
    },
    nowX() {
      return this.layout.nowX
    },
    invalidCount() {
      return this.layout.invalidCount
    },
    stats() {
      return this.layout.stats
    },
    /** 只有存在两个分组时才画分隔带 */
    separators() {
      return this.groups.filter((g) => g.separatorTop !== null)
    },
    statCards() {
      const s = this.stats
      return [
        { key: 'total', label: '工单总数', value: s.total },
        { key: 'span', label: '时间跨度', value: s.spanText },
        { key: 'rows', label: '占用行数', value: s.rowCount }
      ]
    },
    /**
     * 气泡里表格的**数据行**。
     *
     * detail 是对象数组（字段固定 type / count / type_cost），每项一行。
     * 只收「对象」项：真接口偶尔会夹 null / 字符串，直接渲染会崩。
     * 不是数组（老结构 / 缺字段）就当没有 detail，走空态文案 —— 别去猜结构。
     */
    detailRows() {
      const d = this.hover && this.hover.detail
      if (!Array.isArray(d)) {
        return []
      }
      return d.filter((r) => r && typeof r === 'object' && !Array.isArray(r))
    },
    /**
     * 表格的列定义。
     *
     * 列**不写死**：取所有行出现过的 key 的并集（按首次出现顺序）。
     * 现在后端固定给 type / count / type_cost，所以实际就是这三列；
     * 以后加字段不用改这里，表头也自动多一列。
     * `num` = 该列所有值都是数字（或空）→ 右对齐，数字列才好对齐着看。
     */
    detailColumns() {
      const rows = this.detailRows
      if (!rows.length) {
        return []
      }
      const keys = []
      rows.forEach((r) => {
        Object.keys(r).forEach((k) => {
          if (keys.indexOf(k) === -1) {
            keys.push(k)
          }
        })
      })
      return keys.map((k) => ({
        key: k,
        num: rows.every(
          (r) => r[k] === null || r[k] === undefined || typeof r[k] === 'number'
        )
      }))
    },
    hoverBeginText() {
      return this.hover ? formatDateTimeShort(this.hover.start) : ''
    },
    hoverEndText() {
      return this.hover ? formatDateTimeShort(this.hover.end) : ''
    },
    hoverDurationText() {
      return this.hover ? formatDuration(this.hover.durationMinutes) : ''
    },
    /**
     * 气泡位置。
     *
     * 两条硬约束（都是为了「鼠标能从矩形走到气泡上」）：
     *   1. **用真实高度算**（tipSize.h），不能用估算值 —— 估大了就会留出一大段空白，
     *      鼠标还没走到气泡，矩形的 mouseleave 已经触发、气泡关了。
     *   2. **水平方向以矩形中心为准居中**，而不是左对齐矩形左边缘 ——
     *      宽矩形（几百 px）左对齐时，气泡可能盖不住矩形中心，
     *      鼠标从矩形中心垂直往上走会走进空白。
     * 配合 TIP_GAP ≤ 6（盖住行间那 6px 空隙），垂直方向也是「抬脚就到」。
     *
     * 上下策略：默认贴矩形上方；上方放不下就翻到下方；再不行才夹进视口（极端兜底）。
     */
    tipStyle() {
      if (!this.hover || !this.tipRect) {
        return { display: 'none' }
      }
      const r = this.tipRect
      const w = this.tipSize.w || TIP_WIDTH
      const h = this.tipSize.h || TIP_HEIGHT_FALLBACK
      const vw = window.innerWidth
      const vh = window.innerHeight

      // 垂直：优先上方，放不下翻下方
      let top = r.top - h - TIP_GAP
      if (top < EDGE) {
        top = r.bottom + TIP_GAP
      }
      // 水平：以矩形中心居中，再夹进视口
      let left = r.left + r.width / 2 - w / 2
      if (left + w > vw - EDGE) {
        left = vw - EDGE - w
      }
      if (left < EDGE) {
        left = EDGE
      }
      // 极端兜底：上下都放不下（窄屏 + 高气泡），夹进视口
      if (top + h > vh - EDGE) {
        top = Math.max(EDGE, vh - EDGE - h)
      }
      return {
        left: left + 'px',
        top: top + 'px',
        width: w + 'px',
        // 还没量到真实尺寸前先藏起来，免得在估算位置上闪一下
        visibility: this.tipSize.h > 0 ? 'visible' : 'hidden'
      }
    }
  },
  watch: {
    orders() {
      this.hideTip()
      this.$nextTick(this.measure)
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.measure()
      this.setupObserver()
    })
  },
  beforeDestroy() {
    this.cancelClose()
    this.teardownObserver()
    this.teardownTipObserver()
    this.stopPointerWatch()
  },
  methods: {
    /* ------------------------------ 尺寸测量 ------------------------------ */

    /**
     * 量四样东西：
     *   - **宽度**：滚动容器的 clientWidth（已扣掉可能存在的横向滚动条）。
     *     不要去量 .og__inner —— 它的宽度就是 plotWidth，量它等于自己喂自己。
     *   - **总高**：组件根节点的 clientHeight。父级（弹窗 body）是定高 flex 容器，
     *     所以这是「父级给的高度」，**不是内容撑出来的** —— 因此不会和行高互相喂。
     *   - **三段固定高**：页头 / 日期带 / 时间轴。它们只跟字号和 CSS 里的 height 有关，
     *     与行高无关，所以可以放心量（用 outerHeight 带上外边距）。
     *
     * ⚠️ 这里面任何一个变成「由内容撑出来」的，就会形成循环依赖
     *    （行高 → 内容 → 量到的值 → 行高）。
     *    所以总高一定要量 `.og` 而不是 `.og__plotwrap`：plotwrap 的高度正是被行高决定的。
     */
    measure() {
      const wrap = this.$refs.plotwrap
      if (wrap) {
        const w = wrap.clientWidth
        if (w > 0 && w !== this.containerWidth) {
          this.containerWidth = w
        }
      }
      const h = this.$el ? this.$el.clientHeight : 0
      if (h > 120 && h !== this.containerHeight) {
        this.containerHeight = h
      }
      const set = (key, el, fallback) => {
        const v = outerHeight(el, fallback)
        if (v !== this[key]) {
          this[key] = v
        }
      }
      set('headHeight', this.$refs.head, FALLBACK_HEAD_HEIGHT)
      set('daysHeight', this.$refs.days, DAY_BAND_HEIGHT)
      set('axisHeight', this.$refs.axis, AXIS_HEIGHT)
    },
    /**
     * 观察组件根节点：
     *   - 弹窗被拉大缩小时，根节点的高宽都会变
     *   - 横向滚动条出现/消失会吃掉 clientWidth
     * 两者都会触发 ResizeObserver（观察的是内容盒）。
     * 注意根节点的高是父级定的，**不会**因为行高变化而变 —— 所以不会自激。
     */
    setupObserver() {
      const target = this.$el
      if (typeof ResizeObserver === 'undefined') {
        this._onWindowResize = () => this.measure()
        window.addEventListener('resize', this._onWindowResize)
        return
      }
      this._ro = new ResizeObserver(() => this.measure())
      this._ro.observe(target)
    },
    teardownObserver() {
      if (this._ro) {
        this._ro.disconnect()
        this._ro = null
      }
      if (this._onWindowResize) {
        window.removeEventListener('resize', this._onWindowResize)
        this._onWindowResize = null
      }
    },

    /* ------------------------------ 渲染辅助 ------------------------------ */

    /** 矩形太窄就不写字，中等宽度只写工单号后四位 */
    barLabel(bar) {
      if (bar.width >= 148) {
        return bar.orderId
      }
      if (bar.width >= 52) {
        return bar.orderId.slice(-4)
      }
      return ''
    },
    /**
     * 单元格显示值。
     * 空值统一成「—」，免得表格里出现一片空白看不出是「没有」还是「没渲染」。
     * 数字 0 必须显示成 0，所以判空只能用 `== null` 和 `''`，不能用 falsy。
     */
    formatCell(v) {
      if (v === null || v === undefined || v === '') {
        return '—'
      }
      return String(v)
    },
    tickStyle(tick) {
      const half = 26
      let transform = 'translateX(-50%)'
      if (tick.x <= half) {
        transform = 'translateX(0)'
      } else if (tick.x >= this.plotWidth - half) {
        transform = 'translateX(-100%)'
      }
      return { left: tick.x + 'px', transform }
    },

    /* ------------------------------ 悬浮气泡 ------------------------------ */

    onBarEnter(bar, event) {
      this.cancelClose()
      const el = event && event.currentTarget
      const rect = el ? el.getBoundingClientRect() : null
      if (this.hover && this.hover.key === bar.key) {
        // 同一条：只刷新矩形位置（滚动/缩放后会变），别重置尺寸，免得气泡闪
        this.tipRect = rect
        return
      }
      this.hover = bar
      this.tipRect = rect
      // 换了一条工单 -> detail 变了 -> 尺寸要重新量
      this.tipSize = { w: 0, h: 0 }
      this.startPointerWatch()
      this.$nextTick(() => {
        this.measureTip()
        this.observeTip()
      })
    },
    /**
     * 量气泡的真实尺寸。必须渲染后才能量，所以由 $nextTick / ResizeObserver 驱动。
     * 只在真的变了才写 data，避免和「尺寸变 → 重渲染」形成循环。
     */
    measureTip() {
      const el = this.$refs.tip
      if (!el) {
        return
      }
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (w > 0 && h > 0 && (w !== this.tipSize.w || h !== this.tipSize.h)) {
        this.tipSize = { w, h }
      }
    },
    /**
     * 盯住气泡的尺寸变化：detail 行数不同、`type` 长文本折成两行，都会改变高度，
     * 不跟住的话位置就会按旧高度算、又跑远了。
     */
    observeTip() {
      const el = this.$refs.tip
      if (!el || typeof ResizeObserver === 'undefined') {
        return
      }
      this.teardownTipObserver()
      this._tipRo = new ResizeObserver(() => this.measureTip())
      this._tipRo.observe(el)
    },
    teardownTipObserver() {
      if (this._tipRo) {
        this._tipRo.disconnect()
        this._tipRo = null
      }
    },
    /**
     * 鼠标是否还停在「矩形 ∪ 气泡 ∪ 两者之间那道缝」这块区域里。
     * 两个矩形都带 TIP_KEEP_PAD 容差，所以中间那 6px 缝天然被盖住。
     */
    isPointerInTipZone(x, y) {
      const hit = (r) => {
        if (!r) {
          return false
        }
        return (
          x >= r.left - TIP_KEEP_PAD &&
          x <= r.right + TIP_KEEP_PAD &&
          y >= r.top - TIP_KEEP_PAD &&
          y <= r.bottom + TIP_KEEP_PAD
        )
      }
      if (hit(this.tipRect)) {
        return true
      }
      const el = this.$refs.tip
      return hit(el ? el.getBoundingClientRect() : null)
    },
    /**
     * 气泡打开期间盯住全局鼠标。
     *
     * ⚠️ 光靠 mouseleave 的定时器是不够的：鼠标**停在**「矩形与气泡之间那 6px 缝」
     *    里时不会产生任何事件，定时器照样到期、气泡照样消失 ——
     *    用户看到的就是「框框又不见了」。所以要在鼠标还在附近时主动把定时器取消掉。
     *
     * 只在 hover 期间挂监听，关掉气泡立刻摘掉，不给整个页面添负担。
     */
    startPointerWatch() {
      if (this._onDocMove || typeof document === 'undefined') {
        return
      }
      this._onDocMove = (e) => {
        if (!this.hover) {
          return
        }
        if (this.isPointerInTipZone(e.clientX, e.clientY)) {
          this.cancelClose()
        } else if (!this.closeTimer) {
          // 走远了：排队关闭。已经有定时器就别重置，否则鼠标一直在外面动就永远关不掉
          this.scheduleClose()
        }
      }
      document.addEventListener('mousemove', this._onDocMove, { passive: true })
    },
    stopPointerWatch() {
      if (this._onDocMove) {
        document.removeEventListener('mousemove', this._onDocMove)
        this._onDocMove = null
      }
    },
    onBarLeave() {
      this.scheduleClose()
    },
    cancelClose() {
      if (this.closeTimer) {
        clearTimeout(this.closeTimer)
        this.closeTimer = null
      }
    },
    /**
     * 延迟关闭：鼠标从矩形挪到气泡上时会先触发矩形的 mouseleave，
     * 留一点时间给气泡的 mouseenter 把定时器清掉，否则明细表根本看不成。
     *
     * 延迟时长配合 TIP_GAP=6 —— 只有 6px 的路要走，220ms 绰绰有余；
     * 给太长反而会在鼠标已经离开后还挂着气泡，显得迟钝。
     */
    scheduleClose() {
      this.cancelClose()
      this.closeTimer = setTimeout(() => {
        this.hideTip()
      }, TIP_CLOSE_DELAY)
    },
    hideTip() {
      this.cancelClose()
      this.stopPointerWatch()
      this.teardownTipObserver()
      this.hover = null
      this.tipRect = null
      // 尺寸必须一起清掉：下一条工单的 detail 可能小得多，
      // 留着旧高度会让第一帧按旧值定位，气泡又跑远一次。
      this.tipSize = { w: 0, h: 0 }
    }
  }
}
</script>

<style lang="scss" scoped>
/* ==========================================================================
   浅色主题 + 现代 SaaS 观感：白底、细分隔线、圆角渐变矩形、克制的阴影。
   注意别用全局元素选择器（assets/styles/index.scss 里有 aside 之类的全局规则，
   会漏进 scoped 组件），所有选择器都带 .og / .og-bar / .og-tip 前缀。
   ========================================================================== */
.og {
  --og-line: #e9edf5;
  --og-line-strong: #d7deeb;
  --og-text: #1f2937;
  --og-text-2: #5b6b82;
  --og-text-3: #97a3b6;

  /* ---- 分组配色：**AUTO = 蓝，手动 / 其他 = 绿** ----
     两组都是「浅 → 中」的渐变，深端只到 400 档（原来用了 600 档，观感偏浓）。
     深端再浅就压不住白字了，所以文字补了一层更实的投影（见 .og-bar__text）。 */
  --og-manual-a: #a7f3d0; /* 薄荷浅 */
  --og-manual-b: #34d399; /* 绿 · 主色 */
  --og-manual-soft: rgba(52, 211, 153, 0.055); /* 分组底色 */

  --og-auto-a: #bfdbfe; /* 天蓝浅 */
  --og-auto-b: #5b9cf8; /* 蓝 · 主色 */
  --og-auto-soft: rgba(91, 156, 248, 0.05);

  /* 时间轴 / 日期带的强调色（跟分组色无关，是「今天 / 整点」这类结构线） */
  --og-accent: #2563eb;

  position: relative;
  display: flex;
  flex-direction: column;
  /* 弹窗 body 是定高 flex 容器 → 这里 stretch 到满高。
     min-height: 0 是必须的：不加的话 flex 项的 min-height:auto 会被内容顶开，
     「父级给的高度」就变成了「内容撑的高度」，行高反推会失去基准。 */
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  font-size: 12px;
  color: var(--og-text);
}

/* ------------------------------- 顶部概览 ------------------------------- */
.og__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  flex: none;
  gap: 10px 16px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--og-line);
}

.og__stats {
  display: flex;
  align-items: stretch;
  gap: 22px;
}

.og__stat {
  display: flex;
  flex-direction: column;
  min-width: 62px;

  &-value {
    font-size: 17px;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0.2px;
    color: var(--og-text);
    font-variant-numeric: tabular-nums;
  }

  &-label {
    margin-top: 3px;
    font-size: 11px;
    line-height: 14px;
    color: var(--og-text-3);
  }

  &.is-span &-value {
    font-size: 14px;
    line-height: 20px;
    color: var(--og-accent);
  }
}

.og__legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.og__legend-item {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--og-text-2);
}

.og__legend-dot {
  display: inline-block;
  flex: none;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 3px;

  &.is-manual {
    background: linear-gradient(135deg, var(--og-manual-a), var(--og-manual-b));
  }

  &.is-auto {
    background: linear-gradient(135deg, var(--og-auto-a), var(--og-auto-b));
  }
}

.og__legend-warn {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fff7e6;
  color: #b7791f;
  font-size: 11px;

  i {
    margin-right: 4px;
  }
}

/* -------------------------------- 空态 -------------------------------- */
.og__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 70px 0;
  color: var(--og-text-3);

  i {
    font-size: 34px;
    color: #c8d2e0;
  }

  p {
    margin: 12px 0 0;
    font-size: 13px;
  }
}

/* --------------------- 绘图容器（正常不滚动） --------------------- */
.og__plotwrap {
  position: relative;
  /* flex: 0 1 auto = 高度跟内容走（内容高正好等于可用高），
     只有当内容真的超出可用高时才允许收缩，配合下面的 is-scrolly 内部滚动。
     **不能用 flex: 1 1 auto** —— 那样容器会比内容高，时间轴会被 sticky 顶到底部，
     中间留一道突兀的空白。 */
  flex: 0 1 auto;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--og-line);
  border-radius: 8px;
  background: #ffffff;

  /* 兜底：并发行数太多、行高压到下限仍放不下时才走这里 */
  &.is-scrolly {
    overflow-y: auto;
  }

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: #d6dce8;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #c2cbd9;
  }

  &::-webkit-scrollbar-corner {
    background: #ffffff;
  }
}

.og__inner {
  position: relative;
}

/* ------------------------------- 日期带 ------------------------------- */
.og__days {
  position: sticky;
  top: 0;
  z-index: 7;
  height: 24px;
  background: #f5f8fd;
  border-bottom: 1px solid var(--og-line);
  overflow: hidden;
}

.og__day {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding-left: 9px;
  border-left: 1px solid var(--og-line-strong);
  overflow: hidden;

  &:first-child {
    border-left: none;
  }
}

.og__day-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 23px;
  letter-spacing: 0.2px;
  color: var(--og-text-2);
  white-space: nowrap;
}

/* ------------------------------ 绘图区 ------------------------------- */
.og__plot {
  position: relative;
  width: 100%;
}

/* 分组底色 */
.og__band {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 0;

  &.is-manual {
    background: var(--og-manual-soft);
  }

  &.is-auto {
    background: var(--og-auto-soft);
  }
}

/* 行分隔线 */
.og__row {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 1;
  /* ⚠️ 必须 border-box：行高是按可用高度反推出来的，每一行都恰好占满。
     用默认的 content-box 的话 `height + 1px 边框` 会比行高多 1px，
     最后一行就会比绘图区底边多探出 1px（实测 scrollHeight 656 / clientHeight 655）。
     纵向虽然 overflow:hidden 看不出来，但一旦退化成 is-scrolly 就是一根 1px 滚动条。 */
  box-sizing: border-box;
  border-bottom: 1px solid rgba(15, 23, 42, 0.045);
}

/* 竖向网格 */
.og__grid {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 1px;
  background: rgba(15, 23, 42, 0.055);

  &.is-day {
    background: rgba(15, 23, 42, 0.16);
  }
}

/* 分组分隔带 */
.og__sep {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 3;
  height: 0;
  border-top: 1px dashed var(--og-line-strong);
}

.og__sep-chip {
  position: absolute;
  left: 12px;
  top: -9px;
  height: 18px;
  padding: 0 9px;
  border: 1px solid var(--og-line-strong);
  border-radius: 9px;
  background: #ffffff;
  color: var(--og-text-2);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

/* 「现在」竖线 */
.og__now {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: 1px;
  background: #ef4444;
  opacity: 0.65;
}

.og__now-dot {
  position: absolute;
  top: -3px;
  left: -3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
}

/* ------------------------------ 工单矩形 ------------------------------ */
.og-bar {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  padding: 0 7px;
  border-radius: 6px;
  overflow: hidden;
  cursor: default;
  /* 顶部一道高光 + 主渐变，比纯色更有体积感 */
  background-image: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.38) 0%,
      rgba(255, 255, 255, 0) 52%
    ),
    linear-gradient(135deg, var(--og-bar-a), var(--og-bar-b));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.34);
  transition: box-shadow 0.16s ease, transform 0.16s ease, filter 0.16s ease;

  &.is-manual {
    --og-bar-a: var(--og-manual-a);
    --og-bar-b: var(--og-manual-b);
  }

  &.is-auto {
    --og-bar-a: var(--og-auto-a);
    --og-bar-b: var(--og-auto-b);
  }

  /* 太窄的矩形用大圆角会变成「药丸」，缩成 3px */
  &.is-narrow {
    border-radius: 3px;
    padding: 0;
  }

  &:hover {
    z-index: 8;
    filter: saturate(1.08) brightness(1.04);
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.22),
      inset 0 0 0 1px rgba(255, 255, 255, 0.34);
  }

  &__text {
    font-size: 10px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: 0.2px;
    color: rgba(255, 255, 255, 0.96);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* 柱体调淡之后白字对比度变低，投影要更实一点才读得清 */
    text-shadow: 0 1px 2px rgba(15, 23, 42, 0.32);
  }
}

/* ------------------------------- 时间轴 -------------------------------
   比原来明显一档：轴加高、分隔线加深、每个刻度带一根短线、
   标签从 11px 灰字升到 12px 中灰字，整点 / 零点用加粗蓝色。
   height 必须和脚本里的 AXIS_HEIGHT 一致（行高是按可用高度反推的）。 */
.og__axis {
  position: sticky;
  bottom: 0;
  z-index: 7;
  height: 38px;
  background: linear-gradient(180deg, #f7f9fd 0%, #ffffff 62%);
  border-top: 1px solid var(--og-line-strong);
}

/* 刻度短线：独立元素，left 就是刻度位置，不带任何 transform */
.og__tick-mark {
  position: absolute;
  top: 0;
  width: 1px;
  height: 6px;
  background: var(--og-line-strong);

  /* 跨天的那一根（00:00）加粗加长 */
  &.is-day {
    width: 2px;
    height: 10px;
    background: rgba(37, 99, 235, 0.5);
  }
}

.og__tick {
  position: absolute;
  top: 12px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.1px;
  color: var(--og-text-2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &.is-day {
    color: var(--og-accent);
    font-weight: 700;
  }
}

/* ----------------------------- 悬浮气泡 ----------------------------- */
.og-tip {
  position: fixed;
  z-index: 4000;
  padding: 12px 14px 13px;
  border: 1px solid var(--og-line);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16),
    0 2px 6px rgba(15, 23, 42, 0.06);
}

.og-tip__head {
  display: flex;
  align-items: center;
}

.og-tip__dot {
  display: inline-block;
  flex: none;
  width: 9px;
  height: 9px;
  margin-right: 7px;
  border-radius: 3px;

  /* 直接引用分组色变量，避免「改了甘特图忘了改气泡」 */
  &.is-manual {
    background: linear-gradient(135deg, var(--og-manual-a), var(--og-manual-b));
  }

  &.is-auto {
    background: linear-gradient(135deg, var(--og-auto-a), var(--og-auto-b));
  }
}

.og-tip__id {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--og-text);
}

.og-tip__mode {
  margin-left: 8px;
  padding: 1px 7px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.3px;

  /* 底色比柱体浅得多，方便当「标签」读；文字用同色系的深色 */
  &.is-manual {
    background: #e9f9f1;
    color: #1f9d6b;
  }

  &.is-auto {
    background: #eaf2ff;
    color: #2f7ff0;
  }
}

.og-tip__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 8px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--og-line);
  font-size: 11px;
  color: var(--og-text-2);
  font-variant-numeric: tabular-nums;

  i {
    margin-right: 3px;
  }
}

.og-tip__arrow {
  color: var(--og-text-3);
}

.og-tip__cost {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 9px;
  background: #f2f5fa;
  color: var(--og-text-2);
}

/* detail 表格。
   用原生 <table> 而不是 el-table：气泡里就三五行的紧凑明细，
   el-table 自带的那套外层边框 / ::before 底线 / 行高设定在这里全是负担，
   而且要额外压样式。原生表格配 border-collapse 反而更好对齐。

   列宽策略：**数字列收窄（width:1% + nowrap），文本列吃剩余宽度并允许换行**。
   这样 `type` 那种长文本（「ITSM_原子变更_YUM包更新」）会自动折成两行，
   而 count / type_cost 永远是一行、右对齐，扫起来是一条竖线。 */
.og-tip__detail {
  /* 行数多时兜底：气泡再高也不能顶出视口（真数据可能十几行） */
  max-height: 210px;
  margin-top: 10px;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: #d6dce8;
    border-radius: 4px;
  }
}

.og-tip__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
    /* 长文本换行，别把表格撑破 */
    word-break: break-word;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding-top: 0;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--og-line-strong);
    background: #ffffff;
    /* 表头用 --og-text-2（#5b6b82）而不是最浅的 --og-text-3（#97a3b6）：
       表头是「列名」，得比正文更早被扫到，太浅会像占位符；
       但也别用 --og-text（#1f2937）—— 那样和单元格数据一样黑，
       表头和数据就分不出层次了。 */
    color: var(--og-text-2);
    font-weight: 500;
    letter-spacing: 0.2px;
    /* 表头就是 key 名（type / count / type_cost），原样显示 */
    white-space: nowrap;
  }

  td {
    border-bottom: 1px solid var(--og-line);
    color: var(--og-text);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  /* 数字列：贴住内容宽度、右对齐 */
  th.is-num,
  td.is-num {
    width: 1%;
    text-align: right;
    white-space: nowrap;
  }

  th.is-num {
    padding-right: 8px;
  }
}

.og-tip__nodetail {
  padding: 10px 12px;
  border: 1px dashed var(--og-line-strong);
  border-radius: 7px;
  color: var(--og-text-3);
  font-size: 11px;
}
</style>
