<template>
  <div class="flow-graph" :style="{ width: graph.width + 'px', height: graph.height + 'px' }">
    <!-- ① 连线层：源节点底中 → 目标节点顶中（纵向布局） -->
    <svg class="flow-graph__edges" :width="graph.width" :height="graph.height">
      <defs>
        <marker
          v-for="tone in TONES"
          :key="tone"
          :id="markerId(tone)"
          markerUnits="userSpaceOnUse"
          markerWidth="9"
          markerHeight="9"
          refX="8.5"
          refY="4.5"
          orient="auto"
        >
          <path
            d="M 0.5 0.5 L 8.5 4.5 L 0.5 8.5 Z"
            class="flow-graph__arrow"
            :class="'is-' + tone"
          />
        </marker>
      </defs>
      <path
        v-for="edge in graph.edges"
        :key="edge.id"
        class="flow-graph__edge"
        :class="'is-' + edge.tone"
        :d="edge.d"
        :marker-end="`url(#${markerId(edge.tone)})`"
      />
      <!-- 并行组内部：相邻成员之间的**横向**连线，体现组内执行先后（纵向布局） -->
      <path
        v-for="link in graph.links"
        :key="link.id"
        class="flow-graph__edge is-grp"
        :d="`M ${link.x1} ${link.y} L ${link.x2 - 2} ${link.y}`"
        :marker-end="`url(#${markerId('grp')})`"
      />
    </svg>

    <!-- ② 并行组框：同 aniNodeGroup 的节点框在一起 -->
    <div
      v-for="group in graph.groups"
      :key="group.key"
      class="flow-group"
      :style="boxStyle(group)"
    >
      <span class="flow-group__label">
        并行组 {{ group.label }}
        <em>{{ group.count }}</em>
      </span>
    </div>

    <!-- ③ 节点层 -->
    <div
      v-for="item in graph.nodes"
      :key="item.id"
      class="flow-node"
      :class="[
        'is-' + toneOf(item.node.aniStatus),
        { 'is-flash': !!flashed[item.id], 'is-active': isActive(item.id) }
      ]"
      :style="boxStyle(item)"
      :title="nodeTip(item.node)"
      @contextmenu.prevent="onNodeMenu($event, item)"
      @dblclick="onNodeDblclick(item)"
    >
      <div class="flow-node__head">
        <span class="flow-node__dot" />
        <span class="flow-node__name">{{ item.node.aniInstanceNodeName }}</span>
        <!-- 已设置静默：静音图标，悬停看静默了多久（值来自 aniNodeParams.noticeDelay）
             title="" 是必须的：节点卡片整体挂了原生 title，空 title 把它挡掉，
             否则悬停图标时 el-tooltip 和浏览器原生提示会同时冒出来 -->
        <el-tooltip
          v-if="silenceText(item.node)"
          effect="light"
          placement="top"
          :content="silenceText(item.node)"
        >
          <span class="flow-node__mute" title=""><svg-icon icon-class="volume-off" /></span>
        </el-tooltip>
        <!-- 并行组内的执行序号 -->
        <span v-if="item.gSize > 1" class="flow-node__ord" :title="`并行组内第 ${item.gIndex} 个（共 ${item.gSize} 个）`">
          {{ item.gIndex }}
        </span>
      </div>

      <div class="flow-node__body">
        <!-- ① 人工确认节点：展示 aniNodeDomurl，为空时给明确占位 -->
        <template v-if="nodeKind(item.node) === 'human'">
          <div class="flow-node__line">
            <span
              class="flow-node__desc"
              :class="humanHasUrl(item.node) ? 'is-link' : 'is-muted'"
              :title="humanDesc(item.node)"
            >
              {{ humanDesc(item.node) }}
            </span>
          </div>
          <div class="flow-node__time">{{ timeText(item.node) }}</div>
        </template>

        <!-- ② 域名切换节点：正文展示 config.record_desc，悬停看 record_id -->
        <template v-else-if="nodeKind(item.node) === 'domain'">
          <el-tooltip effect="light" placement="top" :open-delay="120">
            <div slot="content" class="flow-tip">
              <div class="flow-tip__desc">{{ labelFnc(domainAtom(item.node)) || '—' }}</div>
              <div class="flow-tip__rid">record_id：{{ recordIdFnc(domainAtom(item.node)) || '—' }}</div>
            </div>
            <div class="flow-node__line">
              <span class="flow-node__desc is-domain" :title="labelFnc(domainAtom(item.node))">
                {{ labelFnc(domainAtom(item.node)) || '—' }}
              </span>
            </div>
          </el-tooltip>
          <div class="flow-node__time">{{ timeText(item.node) }}</div>
        </template>

        <!-- ③ 其余节点：任务数 + 各状态的任务数（只显示有数量的状态） -->
        <template v-else>
          <div class="flow-node__line flow-node__tasks">
            <span class="flow-node__tasks-label">任务数</span>
            <span class="flow-node__tasks-num">{{ taskTotal(item.node) }}</span>
            <span class="flow-node__chips">
              <span
                v-for="s in taskChipsShown(item.node)"
                :key="s.value"
                class="flow-node__chip"
                :class="'is-' + toneOf(s.value)"
                :title="`${s.label} ${s.count} 个`"
              >
                <i class="flow-node__chip-dot" />{{ s.count }} {{ s.label }}
              </span>
              <span
                v-if="taskChipsRest(item.node).length"
                class="flow-node__chip is-rest"
                :title="taskRestTitle(item.node)"
              >+{{ taskChipsRest(item.node).length }}</span>
            </span>
          </div>
          <div class="flow-node__time">{{ timeText(item.node) }}</div>
        </template>
      </div>

      <div class="flow-node__foot">
        <span class="flow-node__status">{{ statusText(item.node.aniStatus) }}</span>
        <span class="flow-node__dur">{{ durationOf(item.node) || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script>
// ⚠️ 本组件是 execPage/components/FlowGraph.vue 的**独立副本**，服务「执行界面简版」。
//    与横向版的唯一差别：并行组内成员的先后连线是**横向**的（见 graph.links 的绘制），
//    因为简版用的是纵向布局（主轴 = 从上到下的执行方向），组内先后跟着主轴转 90°。
//    其余（状态配色、节点内容分支、右键 / 双击事件、脉冲提示）完全一致。
//    用户要求两套页面组件不共享，所以这里是复制而不是 import —— 别为了「去重」合并回去。
import { toClock, formatDuration, statusTone } from '../flowLayout'
import { noticeDelayText } from '../nodeParams'

// 7 个状态分组 + 1 个「并行组内先后」连线色
// 具体色值只在 <style> 的 $tone-colors 里定义一份，箭头靠 class 取色，避免两边各写一遍
const TONES = ['init', 'run', 'ok', 'bad', 'confirm', 'stop', 'cancel', 'grp']

// 状态变化的脉冲提示保留时长（毫秒），与 .is-flash 的动画总时长保持一致
const FLASH_MS = 3200

// 默认分支里统计的任务状态及展示顺序（与需求给的参考实现一致）
const TASK_STATUS = ['INIT', 'SUCCESS', 'RUNNING', 'FAILED', 'SKIP', 'CONFIRM']

// 默认分支一行里最多摆几个状态块，多出来的收成「+n」（节点宽度有限）
const TASK_CHIP_MAX = 2

export default {
  name: 'FlowGraph',
  props: {
    // layoutFlow() 的计算结果：{ width, height, nodes, edges, groups, links }
    graph: {
      type: Object,
      required: true
    },
    // 同一页面多条流时用于区分 svg marker id
    uid: {
      type: [String, Number],
      default: 'flow'
    },
    // 状态 -> 中文文案，唯一来源是字典 release_execute_status_no_css。
    // 字典没到位时回落到状态值本身（如 SUCCESS），不再维护第二份中文，避免两边漂移。
    statusLabels: {
      type: Object,
      default: () => ({})
    },
    // 右键菜单当前指向的节点 id：只给该节点加一圈选中描边。
    // 与状态配色无关，也不参与布局计算，所以不会影响几何。
    activeNodeId: {
      type: [String, Number],
      default: null
    }
  },
  data() {
    return {
      TONES,
      // 本轮状态发生变化的节点 id -> true，用于蓝色脉冲提示
      flashed: {}
    }
  },
  created() {
    // 非响应式，仅用于清理定时器
    this.flashTimers = {}
  },
  beforeDestroy() {
    Object.keys(this.flashTimers).forEach(id => clearTimeout(this.flashTimers[id]))
    this.flashTimers = {}
  },
  watch: {
    /**
     * 轮询会不断推入新的 graph。这里对比前后两次的节点状态，
     * 把变化的节点标出来做脉冲提示 —— 用户不用盯屏幕也能知道哪变了。
     * 注意：只改 class，不改尺寸，所以不会引起布局跳动。
     */
    graph: {
      handler(next, prev) {
        if (!prev || !Array.isArray(prev.nodes) || !Array.isArray(next.nodes)) {
          return
        }
        const before = new Map(prev.nodes.map(n => [n.id, n.node && n.node.aniStatus]))
        const hits = next.nodes
          .filter(n => before.has(n.id) && before.get(n.id) !== (n.node && n.node.aniStatus))
          .map(n => n.id)
        if (hits.length) {
          this.flash(hits)
        }
      }
    }
  },
  methods: {
    flash(ids) {
      const next = { ...this.flashed }
      ids.forEach(id => {
        next[id] = true
        if (this.flashTimers[id]) {
          clearTimeout(this.flashTimers[id])
        }
        this.flashTimers[id] = setTimeout(() => {
          const cur = { ...this.flashed }
          delete cur[id]
          this.flashed = cur
          delete this.flashTimers[id]
        }, FLASH_MS)
      })
      this.flashed = next
    },
    markerId(tone) {
      return `fg-arrow-${this.uid}-${tone}`
    },
    isActive(id) {
      return this.activeNodeId !== null && this.activeNodeId !== undefined && this.activeNodeId === id
    },
    /**
     * 右键节点：把节点交给页面弹出菜单。
     * 菜单里有哪些项由节点状态决定（见 ../nodeMenu.js），本组件不做任何推断。
     */
    onNodeMenu(event, item) {
      this.$emit('node-menu', {
        event,
        node: item.node,
        nodeId: item.id
      })
    },
    /**
     * 双击节点：把节点交给页面分流。
     *
     * 与右键同一个原则 —— **本组件不做任何类型判断**（不认「人工确认节点」），
     * 只负责把事件和最新的节点对象报出去；「人工确认节点弹原子确认、其余走查看明细」
     * 这条规则在 `index.vue` 的 `onNodeDblclick` 里，判定函数在 `../nodeKind`。
     * 组件里写死一份判断的话，规则一改就要改两处，而且渲染组件里没法单测。
     */
    onNodeDblclick(item) {
      this.$emit('node-dblclick', {
        node: item.node,
        nodeId: item.id
      })
    },
    boxStyle(box) {
      return {
        left: box.x + 'px',
        top: box.y + 'px',
        width: box.w + 'px',
        height: box.h + 'px'
      }
    },
    toneOf(status) {
      return statusTone(status)
    },
    statusText(status) {
      // 只认字典；字典没到位就显示状态值本身，让「字典未生效」这件事在页面上一眼可见
      return this.statusLabels[status] || status || '—'
    },
    atomCount(node) {
      return (node.atoms || []).length
    },
    // 单原子 → 显示原子名；多原子（合批）→ 显示「合批」+ 数量角标
    atomText(node) {
      const atoms = node.atoms || []
      if (!atoms.length) {
        return '—'
      }
      if (atoms.length === 1) {
        return atoms[0].aaiAtomName || node.aniInstanceNodeName
      }
      const names = [...new Set(atoms.map(a => a.aaiAtomName).filter(Boolean))]
      return names.length === 1 ? names[0] : `合批 ${atoms.length} 个任务`
    },

    /* ---------------- 节点内容分支 ---------------- */

    /**
     * 节点正文该展示什么：
     *   human  —— aniInstanceNodeType 含 HUMAN_CONFIRM，展示 aniNodeDomurl
     *   domain —— 含 DOMAIN_SWITCH，展示 config.record_desc（悬停看 record_id）
     *   task   —— 其余，展示任务数与各状态任务数
     * 用 includes 而不是全等：真实数据里类型值可能带前后缀。
     */
    nodeKind(node) {
      const t = (node && node.aniInstanceNodeType) || ''
      if (t.includes('HUMAN_CONFIRM')) {
        return 'human'
      }
      if (t.includes('DOMAIN_SWITCH')) {
        return 'domain'
      }
      return 'task'
    },
    humanHasUrl(node) {
      const url = node && node.aniNodeDomurl
      return !!(url !== undefined && url !== null && String(url).trim())
    },
    humanDesc(node) {
      const url = node && node.aniNodeDomurl
      const s = url === undefined || url === null ? '' : String(url).trim()
      return s || '（无人工确认描述）'
    },
    // DOMAIN_SWITCH 只看第一个原子，与参考实现一致
    domainAtom(node) {
      return ((node && node.atoms) || [])[0] || null
    },
    /**
     * 从原子的 aaiAtomConfig（JSON 字符串）里取字段。
     * 参考实现直接写 json.record_desc.toString()，字段缺失时会抛错；
     * 这里统一兜成 ''，解析失败也不炸，交给模板显示占位符。
     */
    atomConfigField(row, key) {
      if (!row || !row.aaiAtomConfig) {
        return ''
      }
      let json = null
      try {
        json = JSON.parse(row.aaiAtomConfig)
      } catch (e) {
        return ''
      }
      if (!json) {
        return ''
      }
      const v = json[key]
      return v === undefined || v === null ? '' : String(v)
    },
    labelFnc(row) {
      return this.atomConfigField(row, 'record_desc')
    },
    recordIdFnc(row) {
      return this.atomConfigField(row, 'record_id')
    },

    /* ---------------- 默认分支：任务数与状态分布 ---------------- */

    taskBreakdown(node) {
      const atoms = (node && node.atoms) || []
      return TASK_STATUS.map(value => ({
        value,
        label: this.statusText(value),
        count: atoms.filter(a => a && a.aaiAtomStatus === value).length
      }))
    },
    /**
     * 任务数 = 上述 6 种状态的数量之和（与参考实现 taskNumFnc 一致）。
     * 注意它和 atoms.length 不一定相等：原子状态若落在 DEPEND_WAIT / VERIFY_EXEC /
     * DEPEND_CONFIRM 等这 6 种之外，就不会被计入。
     */
    taskTotal(node) {
      return this.taskBreakdown(node).reduce((n, s) => n + s.count, 0)
    },
    // 只展示有数量的状态，避免一排 0
    taskChips(node) {
      return this.taskBreakdown(node).filter(s => s.count > 0)
    },
    taskChipsShown(node) {
      return this.taskChips(node).slice(0, TASK_CHIP_MAX)
    },
    taskChipsRest(node) {
      const all = this.taskChips(node)
      return all.length > TASK_CHIP_MAX ? all.slice(TASK_CHIP_MAX) : []
    },
    taskRestTitle(node) {
      return this.taskChipsRest(node)
        .map(s => `${s.label} ${s.count} 个`)
        .join('\n')
    },
    timeText(node) {
      const start = toClock(node.aniStartTime)
      const end = toClock(node.aniEndTime)
      if (!start && !end) {
        return '未开始'
      }
      return `${start || '—'} → ${end || '—'}`
    },
    durationOf(node) {
      return formatDuration(node.aniStartTime, node.aniEndTime)
    },
    // 静默文案：'已静默10分钟'；没配静默返回空串（空串 = 不显示静音图标）
    silenceText(node) {
      return noticeDelayText(node)
    },
    nodeTitle(node) {
      const atoms = node.atoms || []
      const lines = [
        `${node.aniInstanceNodeName}（${node.aniInstanceNodeType}）`,
        `状态：${this.statusText(node.aniStatus)}`,
        `时间：${node.aniStartTime || '—'} → ${node.aniEndTime || '—'}`,
        node.aniNodeGroup ? `并行组：${node.aniNodeGroup}` : '非并行节点',
        // 正文按分支换了内容，原子名与任务数挪到悬停里，信息不丢
        `任务数：${this.atomCount(node)} · ${this.atomText(node)}`
      ]
      const silence = this.silenceText(node)
      if (silence) {
        lines.splice(2, 0, silence)
      }
      if (this.nodeKind(node) === 'human') {
        lines.push(`人工确认描述：${this.humanDesc(node)}`)
      }
      atoms.forEach((a, i) => {
        lines.push(`原子${i + 1}：${a.aaiAtomName} / ${a.aaiOrderId} / ${a.aaiAtomStatus}`)
      })
      return lines.join('\n')
    },
    // 域名切换节点正文用 el-tooltip 展示，这里不再挂原生 title，免得两层提示同时冒出来
    nodeTip(node) {
      return this.nodeKind(node) === 'domain' ? null : this.nodeTitle(node)
    }
  }
}
</script>

<style lang="scss" scoped>
/* ==========================================================================
   状态色板：7 个 tone（与 flowLayout.js 的 statusTone 一一对应）
   每个 tone 四个色：渐变起 / 渐变止 / 浅底 / 描边
     init    初始化 / 待开始 / 已提交         —— 中性灰蓝，还没开始
     run     执行中 / 依赖等待 / 异步验证执行  —— 蓝，进行中
     ok      执行成功                       —— 绿
     bad     执行失败 / 异步验证异常          —— 红
     confirm 结果待确认 / 依赖确认 / 部分成功   —— 琥珀，需要人介入
     stop    挂起                           —— 紫，中止
     cancel  执行取消 / 跳过                  —— 冷灰 + 虚线边框，作废
   ========================================================================== */
$tone-colors: (
  init:    (#9aa8bd, #71849d, #f2f5f9, #dfe6ee),
  run:     (#5aa9f0, #2b7fd4, #ecf5fd, #d3e6fa),
  ok:      (#3fb27f, #199a5c, #eaf7f0, #cfe9dd),
  bad:     (#e07070, #c73b3b, #fdeeee, #f6d6d6),
  confirm: (#e9b463, #cf8f22, #fdf6e8, #f2e2c2),
  stop:    (#a98ede, #8264c4, #f4f0fc, #e3d9f5),
  cancel:  (#a9b4c4, #8492a6, #f4f6f9, #e4e9f0)
);

/* 把色板注入成 CSS 变量，节点内部所有部件都从这里取色 */
.flow-node {
  @each $name, $c in $tone-colors {
    --#{$name}-a: #{nth($c, 1)};
    --#{$name}-b: #{nth($c, 2)};
    --#{$name}-soft: #{nth($c, 3)};
    --#{$name}-line: #{nth($c, 4)};
  }
}

.flow-graph {
  position: relative;
  flex: none;

  &__edges {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
  }

  &__edge {
    fill: none;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-dasharray: 5 4;

    /* 连线颜色跟节点状态同源，取色板的「渐变起」色（较亮，虚线不显得压） */
    @each $name, $c in $tone-colors {
      &.is-#{$name} {
        stroke: #{nth($c, 1)};
      }
    }

    /* 并行组内部的先后连线：更细、更淡，和主流程线区分开 */
    &.is-grp {
      stroke: #5cbf90;
      stroke-width: 1.2;
      stroke-dasharray: 3 3;
      opacity: 0.75;
    }
  }

  /* 箭头（SVG marker 里的三角）。marker 有独立的渲染上下文，
     不能继承 path 的 stroke，所以这里单独按 tone 给 fill */
  &__arrow {
    @each $name, $c in $tone-colors {
      &.is-#{$name} {
        fill: #{nth($c, 1)};
      }
    }

    &.is-grp {
      fill: #5cbf90;
    }
  }
}

/* ---------------- 并行组框 ---------------- */
/* 并行组不是「状态」，所以不参与 7 套状态色板，固定用绿色虚线框表示 */
.flow-group {
  position: absolute;
  border: 1px dashed #3fb27f;
  border-radius: 14px;
  background: rgba(25, 154, 92, 0.035);
  pointer-events: none;

  &__label {
    position: absolute;
    top: -9px;
    left: 10px;
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 8px;
    border-radius: 9px;
    background: #fff;
    border: 1px solid #cfe9dd;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #199a5c;
    white-space: nowrap;

    em {
      margin-left: 4px;
      padding: 0 5px;
      border-radius: 6px;
      background: #eaf7f0;
      font-style: normal;
      font-size: 10px;
    }
  }
}

/* ---------------- 域名切换节点的悬停提示 ----------------
   el-tooltip 的 popper 默认挂到 body，不会被节点的 overflow:hidden 裁掉；
   内容仍由本组件渲染，所以 scoped 样式照样命中。 */
.flow-tip {
  max-width: 320px;
  line-height: 1.65;

  &__desc {
    font-size: 12px;
    font-weight: 500;
    color: #26303f;
    word-break: break-all;
  }

  &__rid {
    margin-top: 2px;
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    color: #6b7a90;
    word-break: break-all;
  }
}

/* ---------------- 节点卡片 ---------------- */
.flow-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid var(--init-line);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
  /* 节点卡片挂了 @dblclick —— 不禁用选中，双击会把节点名选成蓝底高亮，
     画布上看着很脏（而且松开后高亮还留着）。节点名不是给人复制的，直接禁掉。 */
  user-select: none;
  transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.45s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    z-index: 3;
  }

  /* 轮询刷出了新状态：用 box-shadow 做脉冲，不占布局、不推动任何东西 */
  &.is-flash {
    z-index: 2;
    animation: flow-flash 1.6s ease-out 2;
  }

  /* 右键菜单指向的节点：加一圈外描边。
     用 outline 而不是 box-shadow —— .is-flash 的脉冲动画占着 box-shadow，
     两者同时出现时后者会被动画覆盖，描边就没了。outline 不占布局，也不参与动画。 */
  &.is-active {
    z-index: 4;
    outline: 2px solid rgba(64, 158, 255, 0.5);
    outline-offset: 1px;
  }

  /* 7 套状态样式：描边 / 头部渐变 / 状态胶囊 / 合批角标 一起换色。
     选择器是 .flow-node.is-x .flow-node__y（0,2,x），
     比后面单独写的 .flow-node__y（0,1,x）优先级高，所以能稳定覆盖默认色。 */
  @each $name, $c in $tone-colors {
    &.is-#{$name} {
      border-color: var(--#{$name}-line);

      .flow-node__head {
        background: linear-gradient(135deg, var(--#{$name}-a), var(--#{$name}-b));
      }

      .flow-node__status {
        background: var(--#{$name}-soft);
        color: var(--#{$name}-b);
      }
    }
  }

  /* 已取消 / 已跳过：虚线边框 + 降透明度，视觉上读作「作废」，
     和同为中性色的「初始化/待开始」区分开 */
  &.is-cancel {
    border-style: dashed;
    opacity: 0.72;
  }

  &__head {
    display: flex;
    align-items: center;
    flex: none;
    height: 28px;
    padding: 0 10px;
    background: linear-gradient(135deg, var(--init-a), var(--init-b));
    color: #fff;
  }

  &__dot {
    display: flex;
    flex: none;
    width: 5px;
    height: 5px;
    margin-right: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 0 2.5px rgba(255, 255, 255, 0.22);
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
  }

  /* 并行组内序号 */
  &__ord {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 14px;
    height: 14px;
    margin-left: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.24);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
    font-family: Menlo, Consolas, monospace;
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  /* 已设置静默：静音图标。与并行组序号同款小圆底，但只作标记、不可点 */
  &__mute {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 15px;
    height: 15px;
    margin-left: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.24);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
    font-size: 10px;
    line-height: 1;
    cursor: default;
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
    padding: 0 10px;
    gap: 3px;
  }

  &__line {
    display: flex;
    align-items: center;
    min-width: 0;
    line-height: 16px;
  }

  &__desc {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    color: #26303f;
  }

  /* ---- 正文三个分支各自的修饰色 ---- */

  /* 人工确认：有 domurl 时读作链接 */
  &__desc.is-link {
    font-weight: 400;
    color: #2b7fd4;
    text-decoration: underline;
    text-decoration-color: rgba(43, 127, 212, 0.32);
    /* 卡片整体禁了选中（见 .flow-node 的 user-select），但这条 URL 是给人复制的，
       单独放开 —— 拖选不会触发 dblclick，所以两者不冲突。 */
    user-select: text;
  }

  /* 人工确认：没有描述时的占位，弱化成灰字 */
  &__desc.is-muted {
    font-weight: 400;
    color: #a8b3c3;
  }

  /* 域名切换：正文是 record_desc */
  &__desc.is-domain {
    font-weight: 500;
    color: #1f6feb;
  }

  /* ---- 默认分支：任务数 + 各状态任务数 ---- */
  &__tasks {
    gap: 5px;
  }

  &__tasks-label {
    flex: none;
    font-size: 9.5px;
    letter-spacing: 0.2px;
    color: #9aa6b8;
  }

  &__tasks-num {
    flex: none;
    font-family: Menlo, Consolas, monospace;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    color: #26303f;
  }

  &__chips {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    /* 节点宽度有限，状态多的时候宁可裁掉，也不要撑破卡片（多出来的收成 +n） */
    overflow: hidden;
  }

  /* 状态块：小圆点 + 数量 + 名称。配色跟节点状态同源，取同一套 tone 变量 */
  &__chip {
    display: inline-flex;
    align-items: center;
    flex: none;
    height: 15px;
    padding: 0 5px;
    border-radius: 4px;
    /* 默认取 init 色，具体 tone 由下面 @each 覆盖 */
    background: var(--init-soft);
    color: var(--init-b);
    font-size: 9.5px;
    font-weight: 600;
    white-space: nowrap;
    transition: background-color 0.45s ease, color 0.45s ease;

    @each $name, $c in $tone-colors {
      &.is-#{$name} {
        background: var(--#{$name}-soft);
        color: var(--#{$name}-b);
      }
    }

    /* 溢出计数，中性色，不参与状态语义 */
    &.is-rest {
      background: #eef1f6;
      color: #8492a6;
    }
  }

  &__chip-dot {
    flex: none;
    width: 5px;
    height: 5px;
    margin-right: 3px;
    border-radius: 50%;
    background: currentColor;
  }

  &__time {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: Menlo, Consolas, monospace;
    font-size: 10px;
    line-height: 13px;
    color: #93a0b4;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    height: 24px;
    padding: 0 10px;
    border-top: 1px solid #f1f4f8;
    background: #fcfdff;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    height: 15px;
    padding: 0 6px;
    border-radius: 4px;
    /* 默认取 init 色，具体 tone 由上方 @each 循环覆盖 */
    background: var(--init-soft);
    color: var(--init-b);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    transition: background-color 0.45s ease, color 0.45s ease;
  }

  &__dur {
    font-family: Menlo, Consolas, monospace;
    font-size: 10px;
    color: #a8b3c3;
  }
}

/* 状态变化的脉冲：纯 box-shadow，不影响尺寸与布局 */
@keyframes flow-flash {
  0% {
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0.55);
  }

  100% {
    box-shadow: 0 0 0 14px rgba(64, 158, 255, 0);
  }
}
</style>
