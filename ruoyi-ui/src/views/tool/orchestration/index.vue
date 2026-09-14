<template>
  <div class="orchestration-page">
    <!-- 上部：信息与切换 -->
    <header class="orch-header">
      <env-flow-bar
        :environments="environments"
        :active-env="envKey"
        :flows="envFlows"
        :active-flow="flowId"
        :env-matches="envMatches"
        :flow-matches="flowMatches"
        @env-change="handleEnvChange"
        @flow-change="handleFlowChange"
      />
      <atom-bar
        :atoms="selectableAtoms"
        :active-atom-id="atomId"
        :atom="currentAtom"
        :places="places"
        :order-name="orderName"
        @atom-change="handleAtomChange"
        @locate="handleLocate"
      />
    </header>

    <!-- 下部：主体 -->
    <main class="orch-main">
      <div class="orch-main__left">
        <flow-canvas
          class="orch-main__canvas"
          :flow="currentFlow"
          :active-node-id="nodeId"
          :node-matches="nodeMatches"
          :marking="marking"
          @node-click="handleNodeClick"
        />

        <div class="orch-main__bottom">
          <atom-pool
            :atoms="unassignedAtoms"
            :order-id="orderId"
            :active-atom-id="atomId"
            @atom-click="handleAtomChange"
          />
          <doc-panel :docs="currentDocs" :flow-name="currentFlowName" />
        </div>
      </div>

      <transition name="node-slide">
        <node-info-panel
          v-if="currentNode"
          :node="currentNode"
          :flow-name="currentFlowName"
          @close="nodeId = ''"
        />
      </transition>
    </main>
  </div>
</template>

<script>
import EnvFlowBar from './components/EnvFlowBar'
import AtomBar from './components/AtomBar'
import FlowCanvas from './components/FlowCanvas'
import AtomPool from './components/AtomPool'
import DocPanel from './components/DocPanel'
import NodeInfoPanel from './components/NodeInfoPanel'
import { environments, flows, orders, atoms, unassignedAtoms } from './mock'

export default {
  name: 'Orchestration',
  components: { EnvFlowBar, AtomBar, FlowCanvas, AtomPool, DocPanel, NodeInfoPanel },
  data() {
    return {
      environments,
      orders,
      envKey: environments.length ? environments[0].key : '',
      flowId: '',
      nodeId: '',
      atomId: atoms.length ? atoms[0].id : ''
    }
  },
  computed: {
    // 当前环境下的流
    envFlows() {
      return flows.filter(flow => flow.envKey === this.envKey)
    },
    currentFlow() {
      return this.envFlows.find(flow => flow.id === this.flowId) || null
    },
    currentFlowName() {
      return this.currentFlow ? this.currentFlow.name : ''
    },
    currentDocs() {
      return this.currentFlow ? this.currentFlow.docs : []
    },
    // 当前选中的节点
    currentNode() {
      if (!this.currentFlow) {
        return null
      }
      return this.currentFlow.nodes.find(node => node.id === this.nodeId) || null
    },
    // 可选原子：已编排原子 + 未分配原子
    selectableAtoms() {
      return atoms.concat(unassignedAtoms)
    },
    // 当前选中的原子
    currentAtom() {
      return this.selectableAtoms.find(atom => atom.id === this.atomId) || null
    },
    // 该原子所属工单
    orderId() {
      return this.currentAtom ? this.currentAtom.orderId : ''
    },
    orderName() {
      const order = this.orders.find(item => item.orderId === this.orderId)
      return order ? order.planName : ''
    },
    // 未分配原子（与所选原子同工单）
    unassignedAtoms() {
      return unassignedAtoms.filter(atom => atom.orderId === this.orderId)
    },
    // 所选原子的出现位置（补齐环境 / 流 / 节点名称，供面板展示与跳转）
    places() {
      const placements = (this.currentAtom && this.currentAtom.placements) || []
      return placements.map(item => {
        const flow = flows.find(flow => flow.id === item.flowId)
        const node = flow ? flow.nodes.find(node => node.id === item.nodeId) : null
        const env = environments.find(env => env.key === item.envKey)
        return {
          key: item.envKey + '-' + item.flowId + '-' + item.nodeId,
          envKey: item.envKey,
          flowId: item.flowId,
          nodeId: item.nodeId,
          envName: env ? env.name : item.envKey,
          flowName: flow ? flow.name : item.flowId,
          nodeName: node ? node.name : item.nodeId,
          current: item.envKey === this.envKey && item.flowId === this.flowId
        }
      })
    },
    // 所选原子是否已编排到某些位置：有位置时才做"未命中"的弱化展示
    marking() {
      return this.places.length > 0
    },
    // 各环境 / 流 / 节点上含有该原子的数量
    envMatches() {
      return this.countBy('envKey')
    },
    flowMatches() {
      return this.countBy('flowId')
    },
    nodeMatches() {
      return this.countBy('nodeId')
    }
  },
  created() {
    this.flowId = this.envFlows.length ? this.envFlows[0].id : ''
  },
  methods: {
    // 切换环境：重置流与节点选中
    handleEnvChange(envKey) {
      if (envKey === this.envKey) {
        return
      }
      this.envKey = envKey
      this.nodeId = ''
      const list = flows.filter(flow => flow.envKey === envKey)
      this.flowId = list.length ? list[0].id : ''
    },
    // 切换流：重置节点选中
    handleFlowChange(flowId) {
      this.flowId = flowId
      this.nodeId = ''
    },
    // 选择原子：环境 / 流 / 节点上的标识随之刷新
    handleAtomChange(atomId) {
      this.atomId = atomId
    },
    // 点击出现位置：直接切换到该环境、流，并展开对应节点
    handleLocate(place) {
      this.envKey = place.envKey
      this.flowId = place.flowId
      this.nodeId = place.nodeId
    },
    // 点击节点：选中并弹出右侧信息面板，再次点击同一个节点则收起
    handleNodeClick(node) {
      this.nodeId = this.nodeId === node.id ? '' : node.id
    },
    // 按出现位置字段统计数量
    countBy(field) {
      const result = {}
      this.places.forEach(item => {
        const key = item[field]
        result[key] = (result[key] || 0) + 1
      })
      return result
    }
  }
}
</script>

<style lang="scss" scoped>
.orchestration-page {
  /* 编排页面主题变量 */
  --orch-panel: #ffffff;
  --orch-border: #e6eaf2;
  --orch-text: #1f2937;
  --orch-text-2: #5b6b82;
  --orch-text-3: #97a3b6;
  --orch-accent: var(--current-color, #409eff);
  --orch-accent-soft: #eef4fd;
  --orch-radius: 10px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  padding: 12px;
  box-sizing: border-box;
  background-color: #f4f6fb;
  background-image: linear-gradient(rgba(15, 23, 42, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.028) 1px, transparent 1px);
  background-size: 24px 24px;
  overflow: hidden;
}

.orch-header {
  display: flex;
  flex: none;
  align-items: stretch;
  min-width: 0;
  gap: 12px;
}

.orch-main {
  display: flex;
  flex: 1;
  align-items: stretch;
  min-height: 0;
  margin-top: 12px;
  gap: 12px;

  &__left {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    gap: 12px;
  }

  &__canvas {
    flex: 1 1 44%;
  }

  &__bottom {
    display: flex;
    flex: 1 1 56%;
    min-height: 0;
    gap: 12px;
  }
}

/* 节点信息面板弹出/收起 */
.node-slide-enter-active,
.node-slide-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.node-slide-enter,
.node-slide-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

@media screen and (max-width: 1280px) {
  .orch-header {
    flex-wrap: wrap;
  }
}
</style>
