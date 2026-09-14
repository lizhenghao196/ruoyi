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
      <order-bar
        :orders="orders"
        :active-order-id="orderId"
        :env-places="envPlaces"
        :places="places"
        :active-env="envKey"
        @order-change="handleOrderChange"
        @locate="handleLocateEnv"
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
          <atom-pool :atoms="unassignedAtoms" :order-id="orderId" />
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
import OrderBar from './components/OrderBar'
import FlowCanvas from './components/FlowCanvas'
import AtomPool from './components/AtomPool'
import DocPanel from './components/DocPanel'
import NodeInfoPanel from './components/NodeInfoPanel'
import { environments, flows, orders, atoms, unassignedAtoms } from './mock'

export default {
  name: 'Orchestration',
  components: { EnvFlowBar, OrderBar, FlowCanvas, AtomPool, DocPanel, NodeInfoPanel },
  data() {
    return {
      environments,
      orders,
      envKey: environments.length ? environments[0].key : '',
      flowId: '',
      nodeId: '',
      orderId: orders.length ? orders[0].orderId : ''
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
    // 未分配原子（按工单归属）
    unassignedAtoms() {
      return unassignedAtoms.filter(atom => atom.orderId === this.orderId)
    },
    // 该工单的原子编排到哪些流程节点上（即"工单出现在哪里"）
    places() {
      return atoms
        .filter(atom => atom.orderId === this.orderId)
        .reduce((list, atom) => list.concat(atom.placements || []), [])
    },
    // 该工单是否已编排到某些位置：有位置时才做"未命中"的弱化展示
    marking() {
      return this.places.length > 0
    },
    // 该工单的原子在各环境 / 流上的数量
    envMatches() {
      return this.countBy(item => item.envKey)
    },
    flowMatches() {
      return this.countBy(item => item.flowId)
    },
    // 节点 id 只在流内唯一，用 flowId#nodeId 作键
    nodeMatches() {
      return this.countBy(item => item.flowId + '#' + item.nodeId)
    },
    // 按环境汇总，供工单面板展示与跳转
    envPlaces() {
      return environments
        .map(env => ({
          envKey: env.key,
          envName: env.name,
          count: this.envMatches[env.key] || 0
        }))
        .filter(item => item.count > 0)
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
    // 切换工单：环境 / 流 / 节点上的标识随之刷新
    handleOrderChange(orderId) {
      this.orderId = orderId
      // 当前流不含该工单的原子时，自动落到本环境第一个含该工单的流
      if (this.flowMatches[this.flowId]) {
        return
      }
      this.nodeId = ''
      const matched = this.envFlows.find(flow => this.flowMatches[flow.id])
      if (matched) {
        this.flowId = matched.id
      }
    },
    // 点击环境标识：切到该环境，并自动选中其中第一个含该工单的流
    handleLocateEnv(envKey) {
      this.envKey = envKey
      this.nodeId = ''
      const list = flows.filter(flow => flow.envKey === envKey)
      const matched = list.find(flow => this.flowMatches[flow.id])
      this.flowId = matched ? matched.id : (list.length ? list[0].id : '')
    },
    // 点击节点：选中并弹出右侧信息面板，再次点击同一个节点则收起
    handleNodeClick(node) {
      this.nodeId = this.nodeId === node.id ? '' : node.id
    },
    // 按出现位置取键统计数量
    countBy(keyOf) {
      const result = {}
      this.places.forEach(item => {
        const key = keyOf(item)
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
