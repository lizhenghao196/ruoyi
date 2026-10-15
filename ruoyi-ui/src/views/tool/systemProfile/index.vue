<template>
  <div class="profile-page">
    <!-- 空状态：居中的搜索入口（未查询前只显示这里） -->
    <div v-if="!searched" class="profile-empty">
      <i class="el-icon-monitor profile-empty__icon" />
      <h2 class="profile-empty__title">系统画像</h2>
      <p class="profile-empty__hint">请输入系统英文名称查询系统画像</p>
      <div class="profile-empty__search">
        <el-input
          :value="systemQuery"
          size="medium"
          clearable
          placeholder="请输入系统英文名称"
          prefix-icon="el-icon-search"
          class="profile-empty__input"
          @input="onSystemInput"
          @keyup.enter.native="searchSystem"
        />
        <el-button type="primary" size="medium" @click="searchSystem"
          >查询</el-button
        >
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else-if="loading" class="profile-state">
      <i class="el-icon-loading profile-state__icon" />
      <p>正在加载系统画像...</p>
    </div>

    <!-- 查询无数据 -->
    <div v-else-if="!profileData" class="profile-state">
      <i class="el-icon-document profile-state__icon" />
      <p>暂无系统画像数据</p>
    </div>

    <template v-else>
      <!-- ============ 顶部信息栏（单行）：系统信息 | 机房 | 统计 | 简介 ============ -->
      <section class="profile-info">
        <!-- 系统名称：视觉权重最高，可点击切换系统（i 图标定位在名称左上方，不占布局空间） -->
        <button
          type="button"
          class="profile-info__switch"
          :title="'点击切换系统（当前：' + basic.系统名 + '）'"
          @click="openSystemSwitch"
        >
          <i class="el-icon-info profile-info__info-icon" />
          <span class="profile-info__name">{{ basic.系统名 }}</span>
          <span class="profile-info__level">{{ basic.系统重要性级别 }}</span>
        </button>

        <span class="profile-info__divider" />

        <!-- 机房/数据中心：优先完整展示 -->
        <div class="profile-info__rooms">
          <span class="profile-info__room">
            <i class="el-icon-location-outline" />
            <span class="profile-info__room-label">主</span>
            <span class="profile-info__room-value">{{ basic.主机房 }}</span>
          </span>
          <el-tag
            v-for="dc in basic.数据中心"
            :key="dc"
            size="mini"
            effect="plain"
            class="profile-info__dc"
            >{{ dc }}</el-tag
          >
        </div>

        <span class="profile-info__divider" />

        <!-- 行内紧凑统计 -->
        <div class="profile-stats-inline">
          <span
            v-for="s in stats"
            :key="s.key"
            class="profile-stat-inline"
            :class="'is-' + s.key"
          >
            <i :class="s.icon" />
            <span class="profile-stat-inline__value">{{ s.value }}</span>
            <span class="profile-stat-inline__label">{{ s.label }}</span>
          </span>
        </div>

        <span class="profile-info__divider" />

        <!-- 简介：放最后，最主要的可压缩区，单行省略，悬停显示全部 -->
        <p class="profile-info__desc" :title="basic.系统简介">
          <span class="profile-info__desc-label">简介</span>
          <span class="profile-info__desc-text">{{ basic.系统简介 }}</span>
        </p>
      </section>

      <!-- ============ 组件拓扑区域（约 90px）：左侧紧凑标签 + 右侧集群关系 ============ -->
      <section class="profile-topo">
        <div class="profile-topo__main">
          <header class="profile-topo__head">
            <span class="profile-topo__title">组件拓扑</span>
            <span class="profile-topo__hint"
              >点击组件类型，筛选左侧主机列表</span
            >
          </header>
          <div class="profile-topo__tags">
            <button
              v-for="c in componentList"
              :key="c.name"
              class="profile-topo__tag"
              :class="[
                'is-' + c.name,
                { 'is-active': c.name === activeComponent },
              ]"
              :title="
                c.clusterCount +
                ' 个集群 · ' +
                c.hostCount +
                (c.isStandard ? ' 台主机' : ' 条记录')
              "
              type="button"
              @click="selectComponent(c.name)"
            >
              <span class="profile-topo__tag-name">{{ c.name }}</span>
              <span class="profile-topo__tag-count">{{ c.hostCount }}</span>
            </button>
          </div>
        </div>

        <!-- 集群关系：选中组件的 key 在“集群关系”中存在时展示文字按钮，点击弹窗查看明细；否则显示空态
             （用 div 而非 aside：全局 index.scss 对 aside 有 margin/背景/内边距默认样式） -->
        <div class="profile-topo__relation">
          <template v-if="relationGroups">
            <span class="profile-topo__relation-title">集群关系</span>
            <button
              type="button"
              class="profile-topo__relation-btn"
              title="点击查看集群关系明细"
              @click="openRelationDialog"
            >
              <i class="el-icon-view" />
              点击查看集群关系
            </button>
          </template>
          <span v-else class="profile-topo__relation-empty">
            <i class="el-icon-warning-outline" /> 暂无集群关系
          </span>
        </div>
      </section>

      <!-- ============ 底部：左侧主机列表（45%） + 右侧链路关系图预留区（55%） ============ -->
      <div class="profile-bottom">
        <!-- 主机列表：按集群分组，表头固定，内容区内部滚动 -->
        <section ref="hostsCard" class="profile-hosts">
          <header class="profile-hosts__head">
            <span class="profile-hosts__title">主机列表</span>
            <span class="profile-hosts__count"
              >{{ filteredTotal }} / {{ activeHostTotal }} 台</span
            >
            <el-input
              v-model="searchQuery"
              size="mini"
              clearable
              placeholder="搜索主机名 / IP"
              prefix-icon="el-icon-search"
              class="profile-hosts__search"
            />
          </header>

          <div ref="hostsPanel" class="profile-hosts__panel">
            <!-- 每个集群一个可展开收起的表格，默认展开第一个 -->
            <el-collapse
              v-if="filteredGroups.length"
              :value="openClusters"
              @change="onClusterToggle"
            >
              <el-collapse-item
                v-for="cluster in filteredGroups"
                :key="cluster.name"
                :name="cluster.name"
              >
                <template slot="title">
                  <i class="profile-cluster__dot" />
                  <span class="profile-cluster__title">{{ cluster.name }}</span>
                  <span class="profile-cluster__count">
                    {{ cluster.hostCount }}
                    {{ cluster.isStandard ? "台主机" : "条记录" }}
                  </span>
                </template>
                <!-- 动态列：列来自数据字段并集，字段增减/新增组件类型都无需改代码；
                     主机名/机房/类型/CPU/内存保留图标与标签样式，其余字段原样展示。
                     max-height：数据多（80+ 条）时表内滚动，表头固定 -->
                <el-table
                  :data="cluster.hosts"
                  size="mini"
                  border
                  max-height="320"
                >
                  <el-table-column
                    v-for="col in cluster.columns"
                    :key="col.prop"
                    :prop="col.prop"
                    :label="col.label"
                    :width="col.width"
                    :min-width="col.minWidth"
                    :render-header="renderColumnHeader"
                    show-overflow-tooltip
                  >
                    <template slot-scope="scope">
                      <span v-if="col.prop === 'hostname'" class="profile-host">
                        <i class="el-icon-monitor profile-host__icon" />
                        <span class="profile-host__name">{{
                          scope.row.hostname
                        }}</span>
                      </span>
                      <span v-else-if="col.prop === 'idc'" class="profile-idc">{{
                        scope.row.idc
                      }}</span>
                      <span
                        v-else-if="col.prop === 'mtype'"
                        class="profile-mtype"
                        :class="scope.row.mtype === 'P' ? 'is-p' : 'is-v'"
                        >{{ machineType(scope.row.mtype) }}</span
                      >
                      <span v-else-if="col.prop === 'cpu'"
                        >{{ scope.row.cpu }}C</span
                      >
                      <span v-else-if="col.prop === 'memory'"
                        >{{ scope.row.memory }}G</span
                      >
                      <span v-else>{{ scope.row[col.prop] }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </el-collapse-item>
            </el-collapse>
            <div v-else class="profile-hosts__empty">
              <i class="el-icon-search" />
              <p>未找到匹配的主机</p>
            </div>
          </div>
        </section>

        <!-- 链路关系图：瀑布拓扑（节点为原始节点名、链路为边，自上而下分层） -->
        <section class="profile-link">
          <header class="profile-link__head">
            <span class="profile-link__title">链路关系图</span>
            <span class="profile-link__count"
              >{{ links.length }} 条链路 · {{ linkNodeCount }} 个节点</span
            >
            <!-- 右侧：小图不显示节点名，给一句提示 + 放大入口，避免用户不知道要悬浮 -->
            <div class="profile-link__actions">
              <span v-if="links.length" class="profile-link__tip"
                >悬浮查看节点</span
              >
              <!-- 视图被动过（拖过节点 / 缩放平移过）才出现，平时不占位 -->
              <el-tooltip
                v-if="links.length && topoDirty.inline"
                content="重置视图"
                placement="top"
                :open-delay="300"
              >
                <button
                  type="button"
                  class="profile-link__icon"
                  title="重置视图"
                  @click="resetTopoView('inline')"
                >
                  <i class="el-icon-refresh-left" />
                </button>
              </el-tooltip>
              <el-tooltip
                v-if="links.length"
                content="放大查看链路关系图"
                placement="top"
                :open-delay="300"
              >
                <button
                  type="button"
                  class="profile-link__icon"
                  title="放大查看链路关系图"
                  @click="openTopoDialog"
                >
                  <i class="el-icon-full-screen" />
                </button>
              </el-tooltip>
            </div>
          </header>
          <!-- 有链路数据才渲染拓扑图（默认不显示节点文字，悬浮显示）；
               拖拽节点 / 拖拽画布平移 / 滚轮缩放，动过之后头部出现「重置视图」；
               点击右上角全屏按钮在弹窗中放大查看（弹窗内文字常显） -->
          <div v-if="links.length" class="profile-link__chart">
            <div ref="linkChart" class="profile-link__canvas" />
            <div
              v-if="topoHover && topoHover.mode === 'inline'"
              class="profile-hover"
              :style="{ left: topoHover.left + 'px', top: topoHover.top + 'px' }"
            >
              <div class="profile-hover__title">{{ topoHover.title }}</div>
              <div v-if="topoHover.meta.length" class="profile-hover__meta">
                <span v-for="(m, i) in topoHover.meta" :key="i">{{ m }}</span>
              </div>
              <!-- 链路描述：后端没给 desc 字段时整段不出现 -->
              <p v-if="topoHover.desc" class="profile-hover__desc">
                {{ topoHover.desc }}
              </p>
            </div>
          </div>
          <!-- 链路字段缺失 / 空数组 / 数据全是脏数据（自环、空节点）时都走这里 -->
          <div v-else class="profile-link__empty">
            <i class="el-icon-share" />
            <p>暂无链路数据</p>
            <span>当前系统画像未返回链路关系</span>
          </div>
        </section>
      </div>
    </template>

    <!-- 系统切换弹窗：点击系统名称后出现，复用现有搜索/查询逻辑 -->
    <el-dialog
      title="切换系统"
      :visible.sync="switchDialogVisible"
      width="480px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="profile-switch">
        <p class="profile-switch__hint">
          输入系统英文名称，查询后切换当前系统画像
        </p>
        <div class="profile-switch__row">
          <el-input
            :value="switchQuery"
            size="medium"
            clearable
            placeholder="请输入系统英文名称"
            prefix-icon="el-icon-search"
            @input="onSwitchInput"
            @keyup.enter.native="searchSystemFromDialog"
          />
          <el-button
            type="primary"
            size="medium"
            @click="searchSystemFromDialog"
            >查询</el-button
          >
        </div>
      </div>
    </el-dialog>

    <!-- 集群关系弹窗：点击“点击查看集群关系”后出现，表格展示集群名称/节点/描述；
         标题带组件名称，点击遮罩（mask）可直接关闭 -->
    <el-dialog
      :title="'集群关系 - ' + activeComponent"
      :visible.sync="relationDialogVisible"
      width="880px"
      append-to-body
      :close-on-click-modal="true"
    >
      <el-table :data="relationGroups" size="mini" border max-height="420">
        <el-table-column label="集群名称" width="140" show-overflow-tooltip>
          <template slot-scope="scope">{{ scope.row.clusterName }}</template>
        </el-table-column>
        <el-table-column label="集群节点" show-overflow-tooltip>
          <template slot-scope="scope">{{
            (scope.row.nodes || []).join("、")
          }}</template>
        </el-table-column>
        <el-table-column label="集群描述" width="240" show-overflow-tooltip>
          <template slot-scope="scope">
            <!-- desc 字段兼容：旧数据没有 desc 时显示 - -->
            <span :class="{ 'profile-relation-desc--empty': !scope.row.desc }">
              {{ scope.row.desc || "-" }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 链路关系图放大弹窗：大画布展示瀑布拓扑，节点文字常显，
         滚轮缩放 / 拖拽平移 / 一键重置；关闭时销毁图表实例 -->
    <el-dialog
      title="链路关系图"
      :visible.sync="topoDialogVisible"
      width="86%"
      top="6vh"
      append-to-body
      custom-class="profile-topo-dialog"
      :close-on-click-modal="true"
      @opened="onTopoDialogOpened"
      @close="onTopoDialogClose"
    >
      <div class="profile-topo-dialog__body">
        <div class="profile-topo-dialog__bar">
          <span class="profile-topo-dialog__meta"
            >{{ links.length }} 条链路 · {{ linkNodeCount }} 个节点 · 自上而下分层展示</span
          >
          <div class="profile-topo-dialog__actions">
            <!-- 节点名按画布宽度截短（机房前缀 + 角色），悬浮才给全名，这里点一句 -->
            <span class="profile-topo-dialog__tip"
              >拖拽节点 · 拖拽平移 · 滚轮缩放 · 悬浮看全名</span
            >
            <el-button size="mini" round @click="resetTopoView('dialog')"
              >重置视图</el-button
            >
          </div>
        </div>
        <div class="profile-topo-dialog__chart">
          <div ref="topoDialogChart" class="profile-topo-dialog__canvas" />
          <div
            v-if="topoHover && topoHover.mode === 'dialog'"
            class="profile-hover"
            :style="{ left: topoHover.left + 'px', top: topoHover.top + 'px' }"
          >
            <div class="profile-hover__title">{{ topoHover.title }}</div>
            <div v-if="topoHover.meta.length" class="profile-hover__meta">
              <span v-for="(m, i) in topoHover.meta" :key="i">{{ m }}</span>
            </div>
            <p v-if="topoHover.desc" class="profile-hover__desc">
              {{ topoHover.desc }}
            </p>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import * as echarts from "echarts";
import { getSystemProfile } from "@/api/tool/systemProfile";
import { normalizeLinks, buildTopology } from "./linkTopology";

// 组件类型的展示顺序（与调用流向一致）
const COMPONENT_ORDER = [
  "NGINX",
  "HAPROXY",
  "容器云",
  "应用",
  "MYSQL",
  "CANAL",
  "ZOOKEEPER",
  "KAFKA",
  "ES",
  "GREATDB",
  "HADOOP",
];

// 链路关系图（瀑布拓扑）视觉配置：和页面同色系的浅色「蓝图」。
// 节点就是链路里出现的原始名字，不区分类型/集群，全部同一个色系；
// 唯一的变化是大小随连接数微增（连接越多越显眼）
const TOPO_COLORS = {
  // 节点：上浅下深的蓝色渐变 + 白色内圈，白底上像一块块立体的蓝宝石
  nodeTop: "#8ec6ff",
  nodeBottom: "#2f74c0",
  nodeBorder: "rgba(255, 255, 255, 0.95)",
  nodeShadow: "rgba(47, 116, 192, 0.34)",
  // 悬浮：整体提亮（上端更浅、下端更饱和）+ 深一点的描边，
  // 白底上不会糊成一片白，一眼看出亮的是这一颗
  nodeTopBright: "#cfe6ff",
  nodeBottomBright: "#409eff",
  nodeBorderBright: "rgba(31, 111, 208, 0.9)",
  nodeShadowBright: "rgba(64, 158, 255, 0.55)",
  // 连线：浅蓝灰，和浅色底拉得开又不喧宾夺主（跨多层的跳线用更淡的 edge）
  edge: "rgba(154, 180, 216, 0.72)",
  edgeStrong: "rgba(124, 160, 210, 0.9)",
  // 悬浮时被点亮的相邻连线：深蓝，和浅色静态线一眼分得开
  edgeActive: "rgba(23, 100, 196, 0.95)",
  // 沿链路流动的光点：主题蓝但带透明度 —— 它只是「有东西在流动」的暗示，
  // 不该抢过节点和连线本身；悬浮时被点亮的那几条稍亮，因为那时视线就在这里
  flow: "rgba(64, 158, 255, 0.5)",
  flowActive: "rgba(64, 158, 255, 0.85)",
  label: "#4d6785",
};

// 节点外形：六边形（尖顶），比圆角方块更像「节点」，小尺寸下轮廓也清晰
// 100×100 视口内绘制，echarts 会按 symbolSize 等比缩放
const TOPO_NODE_SYMBOL =
  "path://M50,3 L93,26.5 L93,73.5 L50,97 L7,73.5 L7,26.5 Z";

// 系列的 id：悬浮高亮相邻连线时按 id 局部更新，避免整图重建
const TOPO_EDGE_SERIES = "topo-edges"; // 全部连线（静态虚线）
const TOPO_FLOW_SERIES = "topo-flow"; // 沿连线流动的光点（线条本身不画）
const TOPO_FOCUS_SERIES = "topo-focus"; // 悬浮时高亮的相邻连线 + 光点
const TOPO_NODE_SERIES = "topo-nodes"; // 节点

// 分层画布（zlevel）：流动光点的拖尾是 zrender 的 motionBlur 实现的 ——
// 它把整层画布按 lastFrameAlpha 叠加到下一帧，而且这层不再被自动清空。
// 所以「有光点的层」上不能放静态内容：静态虚线和节点会被一帧帧反复叠加，
// 越叠越亮、还留下运动残影（看起来就是一片糊的荧光）。分开成独立画布后，
// 光点在自己那层留拖尾，连线和节点各自干净
const TOPO_ZLEVEL_EDGE = 1; // 静态虚线
const TOPO_ZLEVEL_FLOW = 2; // 流动光点（唯一开 motionBlur 的层）
const TOPO_ZLEVEL_FOCUS = 3; // 悬浮高亮
const TOPO_ZLEVEL_NODE = 4; // 节点 + 文字

// 世界坐标下的层间距：下限（实际值按画布宽高比反解，见 topoLayoutFor）。
// 再小上下两层就要压到一起了，所以只允许放大
const TOPO_LAYER_GAP = 120;
// 反解出的层内水平间距的上下限：太窄文字挤在一起，太宽会被缩得很小
const TOPO_COL_GAP_MIN = 96;
const TOPO_COL_GAP_MAX = 340;

// 节点文字：长名截断（真实节点名可达 30+ 字符），完整名看 tooltip。
// 小图里文字只在悬浮时出现，一次只有一条，可以放宽；
// 弹窗里文字常显、一层又可能有 20 多个节点，能画几个字要按实际列距反算
// （见 topoState 里的 labelMax），这里只兜住上下限
const TOPO_LABEL_MAX = 18;
const TOPO_LABEL_MAX_DIALOG = 22;
const TOPO_LABEL_MIN_DIALOG = 6;
// 11px 字号下拉丁字符的近似宽度（含字距）
const TOPO_LABEL_CHAR_W = 6.6;
// 截断只砍尾巴：这些名字「像不像」几乎都差在前半段
// （bpc-unity-in-gateway / bpc-unity-out-gateway 到第 11 个字符才分开），
// 留头去尾还认得出，掐头留尾或头尾各留一半就会撞成同一个名字
function shortNodeName(name, max = TOPO_LABEL_MAX) {
  const s = String(name || "");
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// 画在节点下面的是名字里「有信息量」的那一段：
//   集群路径 + 角色  bpc@SZ-CS-SCYW-CSPROD@bpc-scheduler → CSPROD@bpc-scheduler
//     集群路径只留最后一段，但一定要留 —— 同一套应用在 CS / 科技园两个机房各部署一份，
//     只取角色的话两个节点会同时叫 bpc-scheduler，谁也认不出哪个是哪个
//   域名取第一个点之前  starcard-dasp.gw.khx.cc → starcard-dasp
// 生产网的节点名动辄 30+ 字符，整串画出来只会互相压成一条黑线。全名在悬浮卡片里给
function topoLabelOf(name) {
  const raw = String(name || "");
  // 端口要留着：同一个域名带不带端口是两条链路，截掉就分不出来了
  const port = raw.lastIndexOf(":");
  const suffix = port > 0 ? raw.slice(port) : "";
  const parts = raw.split("@");
  const role = parts[parts.length - 1];
  if (parts.length > 2) {
    const cluster = parts[parts.length - 2].split("-").pop();
    return (cluster ? cluster + "@" + role : role) + suffix;
  }
  if (parts.length === 2 && parts[0] && role) return role + suffix;
  const dot = raw.indexOf(".");
  return (dot > 0 ? raw.slice(0, dot) : raw) + suffix;
}

// 节点下面真正画出来的文字。
// 一行放不下就截短 —— 但机房代码 + @ 要占掉前面七八个字符，剩不下几个字给角色时，
// 截出来就是「CSPROD@bpc…」：同一个机房里的 app / batch / scheduler / 各种网关
// 全长一个样，等于没名字。角色至少要留下 6 个字符（bpc-app 和 bpc-api-gateway
// 到第 6 个字符才分开），留不下就折成两行（机房代码一行、角色一行）——
// 弹窗里的行距本来就够，多占一行比留一堆分不清的名字强
function topoNodeLabel(name, max) {
  const text = topoLabelOf(name);
  if (text.length <= max) return text;
  const at = text.indexOf("@");
  if (at > 0 && max < at + 9) {
    return (
      shortNodeName(text.slice(0, at), max) +
      "\n" +
      shortNodeName(text.slice(at + 1), max)
    );
  }
  return shortNodeName(text, max);
}

// 画布缩放范围：再小节点就只剩一个点，再大一点内容就撑满整屏
const TOPO_ZOOM_MIN = 0.45;
const TOPO_ZOOM_MAX = 5;
// 滚轮每格的缩放倍率（按倍率而不是固定步长，放得很大时也不会一格跳出去）
const TOPO_ZOOM_STEP = 1.14;
// 悬浮连线的命中容差（屏幕像素）：虚线本身很细，给宽一点才好点中
const TOPO_HOVER_TOL = 8;
// 高亮某条（某几条）连线时，其余连线的透明度。
// 不能压到 0.1 那种「几乎消失」——整张图会看起来只剩高亮的那条线，
// 关系图的上下文（其它链路怎么走）全丢了。压暗到一半左右，能看出主次但都还在
const TOPO_EDGE_DIM = 0.45;
// 连线的二次贝塞尔采样段数（10 段足够，容差 8px 看不出偏差）
const TOPO_HOVER_STEPS = 10;

// 点到线段的距离（命中测试用；无依赖的纯几何，放模块级避免每次调用都新建闭包）
function distToSegment(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len ? ((x - a[0]) * dx + (y - a[1]) * dy) / len : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const px = a[0] + dx * t - x;
  const py = a[1] + dy * t - y;
  return Math.sqrt(px * px + py * py);
}

// 光标样式：画布可能已经被 dispose（弹窗关闭、容器重绘），这时静默跳过
function zrSetCursor(chart, style) {
  const zr = chart && chart.getZr();
  if (!zr || (zr.isDisposed && zr.isDisposed())) return;
  zr.setCursorStyle(style);
}

// zr.on(...) 回调收到的是 zrender 的 packet（zrender/lib/Handler.js makeEventPacket），
// 坐标只挂在 offsetX/offsetY 上，**没有** zrX/zrY —— 那是 packet 内部原始 DOM 事件上的字段。
// 早期版本直接读 e.zrX/e.zrY 拿到的是 undefined，命中测试拿 undefined 比距离必然全部落空：
// 节点拖不动、悬浮不高亮，连平移都会把 view 算成 NaN（整张图散架）。原始事件在 packet.event 里
function zrEventXY(e) {
  const x = e.offsetX != null ? e.offsetX : e.zrX;
  const y = e.offsetY != null ? e.offsetY : e.zrY;
  return [x == null ? 0 : x, y == null ? 0 : y];
}

// 主机列表列定义：已知字段的中文表头 + 期望列宽（minWidth，不是固定宽度）；
// 未收录的字段直接用英文 key 当表头，键顺序即列的展示顺序。
// 列宽只写“期望值”，实际渲染时会被 buildColumns 等比压缩到表格可用宽度内，
// 保证永远不出现横向滚动条；装不下的内容用省略号 + 悬浮 tooltip 看全
// fixedWidth：短字段（IP/机房/CPU/内存…）内容就那么长，宽度够用时锁死这个宽度不再变宽，
// 省下来的宽度全给主机名、操作系统这类文本列；宽度不够时固定宽失效，退化成 minWidth 参与压缩
const FIELD_COLUMNS = {
  hostname: { label: "主机名", minWidth: 150, fixedWidth: 190 },
  ip: { label: "IP", minWidth: 104, fixedWidth: 104 },
  idc: { label: "机房", minWidth: 76, fixedWidth: 76 },
  mtype: { label: "类型", minWidth: 72, fixedWidth: 76 },
  cpu: { label: "CPU", minWidth: 58, fixedWidth: 58 },
  memory: { label: "内存", minWidth: 64, fixedWidth: 64 },
  os: { label: "操作系统", minWidth: 96 },
  component: { label: "组件", minWidth: 84 },
  net_zone_code: { label: "网络区域", minWidth: 96 },
  serviceName: { label: "服务名", minWidth: 110 },
  limitCPU: { label: "CPU限额", minWidth: 84, fixedWidth: 84 },
  limitMemory: { label: "内存限额", minWidth: 92, fixedWidth: 92 },
  replica: { label: "副本数", minWidth: 72, fixedWidth: 72 },
};
const FIELD_ORDER = Object.keys(FIELD_COLUMNS);
// 未收录字段的期望列宽 / 列宽压缩下限（再窄就没法看了）
const DEFAULT_COLUMN_WIDTH = 110;
const MIN_COLUMN_WIDTH = 56;

export default {
  name: "SystemProfile",

  data() {
    return {
      loading: false,
      profileData: null,
      links: [],
      // 主机列表表格可用宽度（实测），用于把动态列压缩到容器内，避免横向滚动条
      tableWidth: 0,
      activeComponent: "",
      searchQuery: "",
      openClusters: [], // 展开的集群（非手风琴，默认展开第一个）
      systemQuery: "", // 系统英文名称搜索框
      searched: false, // 是否已执行查询（未查询前仅显示居中的搜索入口）
      switchDialogVisible: false, // 系统切换弹窗
      switchQuery: "", // 切换弹窗内的查询输入（与主搜索框独立）
      relationDialogVisible: false, // 集群关系弹窗
      linkChart: null, // ECharts 实例（页面内链路关系图）
      topoDialogChart: null, // ECharts 实例（放大弹窗内的链路关系图）
      topo: null, // 链路瀑布拓扑（normalizeLinks + buildTopology 产物，每次查询后计算一次）
      topoDialogVisible: false, // 链路关系图放大弹窗
      // 悬浮卡片（节点 / 连线）：{ mode, left, top, title, meta[], desc }
      topoHover: null,
      // 视图是否被用户动过（拖过节点 / 缩放 / 平移）：动过才显示「重置视图」
      topoDirty: { inline: false, dialog: false },
    };
  },

  created() {
    // 两个画布的渲染状态（数据项 / 位置表 / 视图变换）。刻意不做响应式：
    // 里面挂着几十个节点和连线的数据项，Vue 逐层劫持纯属浪费，它只服务于交互回调
    this._topoStates = { inline: null, dialog: null };
  },

  watch: {
    // 搜索后若展开的集群全部被过滤掉，自动展开第一个匹配集群
    searchQuery() {
      this.$nextTick(() => {
        if (!this.filteredGroups.length) return;
        const hasOpen = this.openClusters.some((n) =>
          this.filteredGroups.some((g) => g.name === n)
        );
        if (!hasOpen) {
          this.openClusters = [this.filteredGroups[0].name];
        }
      });
    },
  },

  mounted() {
    // 窗口尺寸变化时重绘链路关系图
    window.addEventListener("resize", this.handleResize);
  },

  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
    if (this._topoRedrawTimer) {
      clearTimeout(this._topoRedrawTimer);
      this._topoRedrawTimer = null;
    }
    if (this.panelObserver) {
      this.panelObserver.disconnect();
      this.panelObserver = null;
    }
    if (this.linkChart) {
      this.linkChart.dispose();
      this.linkChart = null;
    }
    if (this.topoDialogChart) {
      this.topoDialogChart.dispose();
      this.topoDialogChart = null;
    }
    this._topoStates = { inline: null, dialog: null };
    this.topoHover = null;
  },

  computed: {
    basic() {
      return (this.profileData && this.profileData["基础信息"]) || {};
    },
    // 统计卡片：组件类型 / 集群 / 主机 / 链路（链路预留，仅显示数字）
    stats() {
      const topo = (this.profileData && this.profileData["组件拓扑"]) || {};
      const componentCount = Object.keys(topo).length;
      const clusterCount = Object.keys(topo).reduce(
        (sum, comp) => sum + Object.keys(topo[comp]).length,
        0
      );
      const hostCount = Object.keys(topo).reduce((sum, comp) => {
        return (
          sum +
          Object.values(topo[comp]).reduce((s, hosts) => s + hosts.length, 0)
        );
      }, 0);
      return [
        {
          key: "component",
          label: "组件",
          value: componentCount,
          icon: "el-icon-menu",
        },
        {
          key: "cluster",
          label: "集群",
          value: clusterCount,
          icon: "el-icon-office-building",
        },
        {
          key: "host",
          label: "主机",
          value: hostCount,
          icon: "el-icon-monitor",
        },
        {
          key: "link",
          label: "链路",
          value: this.links.length,
          icon: "el-icon-connection",
          reserved: true,
        },
      ];
    },
    // 组件类型列表（含集群与主机统计），按 COMPONENT_ORDER 排序
    componentList() {
      const topo = (this.profileData && this.profileData["组件拓扑"]) || {};
      return Object.keys(topo)
        .map((name) => {
          const clusterMap = topo[name];
          const clusters = Object.keys(clusterMap)
            .map((cname) => ({ name: cname, hosts: clusterMap[cname] }))
            .sort((a, b) => a.name.localeCompare(b.name));
          // isStandard：首条记录含 hostname+ip 视为标准主机结构，用于文案（台主机/条记录）
          const firstHost = clusters[0] && clusters[0].hosts[0];
          return {
            name,
            clusters,
            clusterCount: clusters.length,
            hostCount: clusters.reduce((s, c) => s + c.hosts.length, 0),
            isStandard: !!(firstHost && firstHost.hostname && firstHost.ip),
          };
        })
        .sort((a, b) => {
          const ia = COMPONENT_ORDER.indexOf(a.name);
          const ib = COMPONENT_ORDER.indexOf(b.name);
          if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
    },
    // 当前选中组件的主机总数（未过滤）
    activeHostTotal() {
      const comp = this.componentList.find(
        (c) => c.name === this.activeComponent
      );
      return comp ? comp.hostCount : 0;
    },
    // 集群关系：仅当选中组件的 key 在“集群关系”中存在且有数据时返回（否则空态）
    relationGroups() {
      const rel = (this.profileData && this.profileData["集群关系"]) || {};
      const item = rel[this.activeComponent];
      return Array.isArray(item) && item.length ? item : null;
    },
    // 当前选中组件下、按集群分组的主机（搜索过滤后），空集群剔除
    filteredGroups() {
      const comp = this.componentList.find(
        (c) => c.name === this.activeComponent
      );
      const clusters = comp ? comp.clusters : [];
      const q = this.searchQuery.trim().toLowerCase();
      if (!q) {
        return clusters.map((g) => ({
          ...g,
          hostCount: g.hosts.length,
          columns: this.buildColumns(g.hosts),
        }));
      }
      return clusters
        .map((g) => {
          // 匹配记录中任意字段：标准主机搜主机名/IP，微服务等结构搜 serviceName 等任意字段
          const hosts = g.hosts.filter((h) => {
            return Object.keys(h).some((k) => {
              const v = h[k];
              return String(v == null ? "" : v)
                .toLowerCase()
                .includes(q);
            });
          });
          return {
            ...g,
            hosts,
            hostCount: hosts.length,
            columns: this.buildColumns(hosts),
          };
        })
        .filter((g) => g.hosts.length > 0);
    },
    // 搜索后匹配的主机总数
    filteredTotal() {
      return this.filteredGroups.reduce((s, g) => s + g.hosts.length, 0);
    },
    // 链路关系图节点数量（瀑布拓扑的节点数，链路里出现过即计入）
    linkNodeCount() {
      return (this.topo && this.topo.nodes.length) || 0;
    },
  },

  methods: {
    // 搜索框只允许英文，小写自动转大写（非英文字符直接过滤）
    onSystemInput(val) {
      this.systemQuery = (val || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
    },

    // 打开系统切换弹窗（预填当前查询词，回车/点查询后重新查询）
    openSystemSwitch() {
      this.switchQuery = this.systemQuery;
      this.switchDialogVisible = true;
    },

    // 切换弹窗输入框：同样只允许英文并转大写
    onSwitchInput(val) {
      this.switchQuery = (val || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
    },

    // 查询系统画像：输入系统英文名称后回车或点查询按钮触发
    searchSystem() {
      this.doSearch(this.systemQuery);
    },

    // 切换弹窗内查询：复用同一查询逻辑，成功后自动关闭弹窗
    searchSystemFromDialog() {
      this.doSearch(this.switchQuery);
    },

    // 统一查询逻辑（空值校验 → 请求 → 更新状态）
    doSearch(q) {
      const name = (q || "").trim();
      if (!name) {
        this.$message.warning("请输入系统英文名称");
        return;
      }
      this.systemQuery = name;
      this.loading = true;
      getSystemProfile({ systemId: name })
        .then((res) => {
          this.profileData = res.data || res;
          this.prepareData();
          this.searched = true;
          // 默认选中第一个组件（按数据顺序），并展开其第一个集群
          const first = this.componentList[0];
          if (first) {
            this.activeComponent = first.name;
            this.openClusters = first.clusters.length
              ? [first.clusters[0].name]
              : [];
          }
        })
        .catch(() => {
          this.$message.error("获取系统画像数据失败");
        })
        .finally(() => {
          this.loading = false;
          this.switchDialogVisible = false;
          // loading 置 false 后内容区（含图表容器）才挂载，此时再测量表格宽度、渲染链路关系图
          this.$nextTick(() => {
            this.measureTableWidth();
            this.observeHostsCard();
            this.renderTopoChart("inline");
          });
        });
    },

    // 链路数据规范化 + 瀑布拓扑构建（查询成功后调用一次）。
    // 兼容两种后端格式：
    //   1. 对象数组：[{ fnode, snode }, ...]
    //   2. 生产网真实格式（元组）：[["A", "snode", "B"], ...] / [["A", "", "B"], ...]
    // 节点名是原始字符串（不带「组件类型/集群名」前缀），去重、去自环、去脏数据
    prepareData() {
      // 整体响应可能为空对象 / 不含链路字段：统一兜底，后面按「空数据」渲染占位
      const data = this.profileData || {};
      const raw = data["链路"];
      const rawLinks = Array.isArray(raw)
        ? raw
        : raw && Array.isArray(raw.arrow)
        ? raw.arrow
        : [];
      this.links = normalizeLinks(rawLinks);
      // 节点位置只由链路关系决定（分层 + 层内重心排序），没有任何需要特殊标记的节点
      this.topo = buildTopology(this.links, {
        colGap: TOPO_COL_GAP_MIN,
        layerGap: TOPO_LAYER_GAP,
      });
      // 换了一批链路 ⇒ 之前按画布尺寸缓存的布局作废
      this._topoLayoutKey = "";
      this._topoLayout = null;
    },

    // ---------- 链路关系图（瀑布拓扑） ----------
    // mode: "inline" 页面内小图（默认不显示文字、悬浮才显示）/ "dialog" 放大弹窗（文字常显）
    // 两个画布的交互完全一致：拖拽节点、拖拽平移、滚轮缩放、悬浮高亮
    renderTopoChart(mode) {
      const el =
        mode === "dialog" ? this.$refs.topoDialogChart : this.$refs.linkChart;
      if (!el || !this.topo || !this.topo.nodes.length) return;
      if (mode === "dialog") {
        if (this.topoDialogChart) {
          this.topoDialogChart.dispose();
          this.topoDialogChart = null;
        }
      } else if (this.linkChart) {
        this.linkChart.dispose();
        this.linkChart = null;
      }
      const chart = echarts.init(el);
      if (mode === "dialog") this.topoDialogChart = chart;
      else this.linkChart = chart;
      const topo = this.topoLayoutFor(mode, el);
      const state = this.topoState(mode, el, topo);
      this._topoStates[mode] = state;
      chart.setOption(this.buildTopoOption(mode, state));
      this.bindTopoInteractions(chart, state, mode);
      // 重绘 = 回到初始布局 + 1:1 视图，脏标记跟着清掉
      this.topoDirty[mode] = false;
      this.clearTopoHover(mode);
    },

    // 高亮某个节点的全部相邻连线（nodeId 为空 = 全部恢复）。
    // echarts 5 的 emphasis.focus:'adjacency' 在 4.x 里不存在（graph 系列的
    // focusNodeAdjacency 又不受支持，见 buildTopoOption 注释），所以手动做
    applyTopoFocus(chart, state, nodeId) {
      this.syncTopoFocus(
        chart,
        state,
        nodeId ? state.adjIndex.get(nodeId) || [] : []
      );
    },

    // 把「要高亮的连线下标」落到图上。
    // 相邻连线塞进 focus 系列 + 其余连线整体压暗（TOPO_EDGE_DIM，压暗但仍可见），
    // 高亮的那几条额外加一层更亮的实线 + 光点；一次 setOption 只改几个字段，开销很小
    syncTopoFocus(chart, state, edgeIdx) {
      state.focusEdges = edgeIdx;
      const focusing = edgeIdx.length > 0;
      const flow = !state.interacting;
      chart.setOption(
        {
          series: [
            {
              id: TOPO_EDGE_SERIES,
              lineStyle: { opacity: focusing ? TOPO_EDGE_DIM : 1 },
            },
            // 流动光点只在拖拽/缩放时整体让位（那一层是 motionBlur 整层重绘，开着拖拽会顿）；
            // 高亮连线时其余线条的光点照旧流动，否则整张图像「被关掉了一半」
            { id: TOPO_FLOW_SERIES, effect: { show: flow } },
            {
              id: TOPO_FOCUS_SERIES,
              data: edgeIdx.map((i) => state.focusItems[i]),
              effect: { show: flow },
            },
          ],
        },
        { lazyUpdate: true }
      );
    },

    // 画布交互：拖拽节点 / 拖拽平移 / 滚轮缩放 / 悬浮高亮。
    //
    // 【平移缩放为什么不用 dataZoom】dataZoom 每移动一次都要重算坐标轴、让四个系列整体
    // 重绘（61 条 effect 连线还要连光点元素一起重建），鼠标一动就掉帧 —— 这就是弹窗里
    // 拖拽/缩放发卡的原因。这里改成直接给「系列所在的 zrender 组合」写 transform：
    // 数据没变、图形元素没重建，只多几次矩阵合成，所以跟手。
    // echarts 自带的 graph 系列 roam 也是这个原理（本组件用不了 graph，见 buildTopoOption）
    bindTopoInteractions(chart, state, mode) {
      const zr = chart.getZr();
      let drag = null; // 正在拖的节点
      let pan = null; // 画布平移起点
      let frame = 0; // 拖拽的帧节流（鼠标事件比屏幕刷新密）
      let pending = null; // 本帧要落到的节点位置

      // 屏幕坐标 → 未变换的基准坐标（节点位置、连线形状都存的是基准坐标）
      const toBase = (x, y) => [
        (x - state.view.x) / state.view.k,
        (y - state.view.y) / state.view.k,
      ];

      // 画布的缩放/平移 = 四个系列组合的 transform。
      // zrender 的变换是 T·S，即「先缩放后平移」，所以屏幕点 = position + scale × 基准点
      state.applyView = () => {
        const { x, y, k } = state.view;
        const attr = { position: [x, y], scale: [k, k] };
        chart.getModel().getSeries().forEach((m) => {
          const view = chart.getViewOfSeriesModel(m);
          if (view && view.group) view.group.attr(attr);
        });
      };

      // 把最新的节点/连线写回图表。all=false 只刷「连线 + 节点」两层：
      // 拖拽时流动光点那层是 motionBlur 整层重绘，跳过它才跟手（松手后 all=true 补齐）
      state.refresh = (all) => {
        const series = [
          { id: TOPO_EDGE_SERIES, data: state.edgeItems },
          { id: TOPO_NODE_SERIES, data: state.nodeItems },
        ];
        if (all) {
          series.push({ id: TOPO_FLOW_SERIES, data: state.edgeItems });
          series.push({
            id: TOPO_FOCUS_SERIES,
            data: state.focusEdges.map((i) => state.focusItems[i]),
          });
        }
        chart.setOption({ series }, { lazyUpdate: true });
      };

      // 拖拽中的每帧：先把节点位置落到数据上，再刷新（latest wins）
      const flush = () => {
        frame = 0;
        if (!drag || !pending) return;
        this.writeTopoNodePos(state, drag.id, pending);
        pending = null;
        state.refresh(false);
      };

      const stopInteraction = () => {
        if (drag) {
          if (frame) {
            window.cancelAnimationFrame(frame);
            frame = 0;
          }
          if (pending) {
            this.writeTopoNodePos(state, drag.id, pending);
            pending = null;
          }
          drag = null;
          // 松手：把流动光点的数据补齐并恢复光点动画
          state.refresh(true);
          this.setTopoInteracting(chart, state, false);
        }
        pan = null;
        zr.setCursorStyle("grab");
      };

      zr.on("mousedown", (e) => {
        const [mx, my] = zrEventXY(e);
        const hit = this.hitTestTopo(state, mx, my);
        if (hit && hit.type === "node") {
          const p = state.posMap.get(hit.id);
          const [bx, by] = toBase(mx, my);
          // 记住鼠标在节点内的偏移：拖起来不会「跳一下」
          drag = { id: hit.id, dx: bx - p[0], dy: by - p[1], moved: false };
          // 交互中先关掉流动光点：那一层是 motionBlur 整层重绘，开着拖拽会顿
          this.setTopoInteracting(chart, state, true);
        } else {
          pan = { x: mx, y: my, vx: state.view.x, vy: state.view.y };
        }
        zr.setCursorStyle("grabbing");
        // 拖拽画布时不要顺带选中页面文字
        if (e.event && e.event.preventDefault) e.event.preventDefault();
      });

      zr.on("mousemove", (e) => {
        const [mx, my] = zrEventXY(e);
        if (drag) {
          const [bx, by] = toBase(mx, my);
          pending = [bx - drag.dx, by - drag.dy];
          if (!drag.moved) {
            drag.moved = true;
            this.markTopoDirty(mode);
          }
          // 鼠标事件的密度高于屏幕刷新率，按帧节流；setOption 走的是同一个 rAF
          if (!frame) frame = window.requestAnimationFrame(flush);
          return;
        }
        if (pan) {
          state.view.x = pan.vx + (mx - pan.x);
          state.view.y = pan.vy + (my - pan.y);
          this.markTopoDirty(mode);
          state.applyView();
          return;
        }
        // 悬浮：自己做命中测试。命中目标没变就什么都不做 ——
        // 否则每移动 1px 都会 setOption 一次
        const hit = this.hitTestTopo(state, mx, my);
        this.updateTopoHover(chart, state, mode, hit);
      });

      zr.on("mouseup", stopInteraction);
      zr.on("globalout", stopInteraction);

      zr.on("mousewheel", (e) => {
        const ev = e.event || {};
        // packet.wheelDelta 就是 zrender 归一化过的 zrDelta（正数=放大），
        // 拿不到时再退回原始 DOM 事件：wheelDelta 正数放大，deltaY 反之
        const delta =
          e.wheelDelta != null
            ? e.wheelDelta
            : ev.wheelDelta != null
            ? ev.wheelDelta
            : -(ev.deltaY || 0);
        if (!delta || !state.applyView) return;
        // 滚轮缩放会带动页面/弹窗滚动，必须拦掉
        if (ev.preventDefault) ev.preventDefault();
        const next = Math.max(
          TOPO_ZOOM_MIN,
          Math.min(
            TOPO_ZOOM_MAX,
            state.view.k * (delta > 0 ? TOPO_ZOOM_STEP : 1 / TOPO_ZOOM_STEP)
          )
        );
        if (next === state.view.k) return;
        // 以光标为锚点缩放：光标下的那个点不动，才不会「跑掉」
        const [mx, my] = zrEventXY(e);
        const ratio = next / state.view.k;
        state.view.x = mx - (mx - state.view.x) * ratio;
        state.view.y = my - (my - state.view.y) * ratio;
        state.view.k = next;
        this.markTopoDirty(mode);
        state.applyView();
        // 缩放后原锚点已经不准了，先收起卡片，等下一次移动重新判定
        this.clearTopoHover(mode);
        state.hoverKey = "";
      });
    },

    // 交互中（拖节点 / 平移 / 缩放）先关掉流动光点：它那一层靠 zrender 的 motionBlur
    // 整层重绘，开着会让每次拖拽都多一层合成；松手后再亮起来
    setTopoInteracting(chart, state, on) {
      if (state.interacting === on) return;
      state.interacting = on;
      this.syncTopoFocus(chart, state, state.focusEdges);
    },

    // 命中测试：自己做，不走 echarts 的事件系统 ——
    // 4.9 的 lines 系列既不给连线元素挂 tooltip 也不支持 item 事件，而「鼠标一动就知道
    // 命中了谁」是悬浮高亮的前提。统一在「未变换的基准坐标」里算距离：先测节点（节点压在
    // 连线上，优先命中半径内最近的），再按二次贝塞尔采样测连线。
    // 几十~几百次浮点运算，比一次 setOption 便宜得多
    hitTestTopo(state, px, py) {
      const k = state.view.k;
      const x = (px - state.view.x) / k;
      const y = (py - state.view.y) / k;
      let node = null;
      let nodeDist = Infinity;
      state.posMap.forEach((p, id) => {
        const d = Math.sqrt(
          (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y)
        );
        // 命中范围随缩放一起放大：屏幕上始终是「节点外 3px」
        if (d <= state.radius.get(id) + 3 / k && d < nodeDist) {
          nodeDist = d;
          node = id;
        }
      });
      if (node) return { type: "node", id: node };
      const tol = TOPO_HOVER_TOL / k;
      let edge = -1;
      let edgeDist = tol;
      for (let i = 0; i < state.edgeItems.length; i += 1) {
        const d = this.distToTopoEdge(state.edgeItems[i], x, y);
        if (d < edgeDist) {
          edgeDist = d;
          edge = i;
        }
      }
      return edge >= 0 ? { type: "edge", index: edge } : null;
    },

    // 点到一条连线的距离。曲率控制点用的就是 echarts lines 系列的公式
    // （linesLayout.js：cp = 中点 − 垂直方向 × curveness），采样点才能和画出来的线重合
    distToTopoEdge(item, x, y) {
      const a = item.coords[0];
      const b = item.coords[1];
      const c = (item.lineStyle && item.lineStyle.curveness) || 0;
      if (!c) return distToSegment(x, y, a, b);
      const cx = (a[0] + b[0]) / 2 - (a[1] - b[1]) * c;
      const cy = (a[1] + b[1]) / 2 - (b[0] - a[0]) * c;
      let best = Infinity;
      let px = a[0];
      let py = a[1];
      for (let i = 1; i <= TOPO_HOVER_STEPS; i += 1) {
        const t = i / TOPO_HOVER_STEPS;
        const u = 1 - t;
        const qx = u * u * a[0] + 2 * u * t * cx + t * t * b[0];
        const qy = u * u * a[1] + 2 * u * t * cy + t * t * b[1];
        const d = distToSegment(x, y, [px, py], [qx, qy]);
        if (d < best) best = d;
        px = qx;
        py = qy;
      }
      return best;
    },

    // 移动节点：位置数组整颗替换（不原地改），连线的两端引用同步指过去。
    // 这样「初始位置快照」永远干净，重置视图直接拷回来就行
    writeTopoNodePos(state, id, xy) {
      state.posMap.set(id, xy);
      const ni = state.nodeIndex.get(id);
      if (ni != null) state.nodeItems[ni].value = xy;
      const adj = state.adjIndex.get(id);
      if (!adj) return;
      adj.forEach((ei) => {
        const item = state.edgeItems[ei];
        if (item.source === id) item.coords[0] = xy;
        else item.coords[1] = xy;
        const focus = state.focusItems[ei];
        if (focus) {
          if (focus.source === id) focus.coords[0] = xy;
          else focus.coords[1] = xy;
        }
      });
    },

    // 悬浮态。命中目标变了才动图（setOption / 高亮 / 卡片），没变直接返回 ——
    // 这个方法每次鼠标移动都会调用
    updateTopoHover(chart, state, mode, hit) {
      const key = hit
        ? hit.type + ":" + (hit.type === "node" ? hit.id : hit.index)
        : "";
      if (key === state.hoverKey) return;
      state.hoverKey = key;
      const el =
        mode === "dialog" ? this.$refs.topoDialogChart : this.$refs.linkChart;
      if (!hit) {
        chart.dispatchAction({ type: "downplay", seriesId: TOPO_NODE_SERIES });
        this.applyTopoFocus(chart, state, "");
        this.clearTopoHover(mode);
        zrSetCursor(chart, "grab");
        return;
      }
      if (hit.type === "node") {
        const i = state.nodeIndex.get(hit.id);
        const node = state.nodeItems[i] || {};
        // 节点自身提亮（emphasis 状态：更亮的渐变 + 白描边 + 文字常显）
        chart.dispatchAction({ type: "downplay", seriesId: TOPO_NODE_SERIES });
        chart.dispatchAction({
          type: "highlight",
          seriesId: TOPO_NODE_SERIES,
          dataIndex: i,
        });
        this.applyTopoFocus(chart, state, hit.id);
        const meta = [];
        if (typeof node.layer === "number") meta.push("第 " + (node.layer + 1) + " 层");
        meta.push("上游 " + node.inDegree + " · 下游 " + node.outDegree);
        if (node.isRoot) meta.push("入口节点");
        this.topoHover = this.placeTopoHover(
          mode,
          el,
          state,
          state.posMap.get(hit.id),
          { title: hit.id, meta, desc: "" }
        );
        zrSetCursor(chart, "move");
        return;
      }
      // 连线：只点亮这一条，其余压暗
      const item = state.edgeItems[hit.index];
      chart.dispatchAction({ type: "downplay", seriesId: TOPO_NODE_SERIES });
      this.syncTopoFocus(chart, state, [hit.index]);
      const meta = [];
      if (Math.abs(item.depth || 0) > 1) meta.push("跨 " + Math.abs(item.depth) + " 层");
      this.topoHover = this.placeTopoHover(
        mode,
        el,
        state,
        this.topoEdgeMidpoint(item),
        {
          title: item.source + " → " + item.target,
          meta,
          // 后端给了 desc 才显示，没给就是空串（模板里整段不出现）
          desc: item.desc ? String(item.desc) : "",
        }
      );
      zrSetCursor(chart, "pointer");
    },

    // 连线中点（屏幕坐标）：二次贝塞尔 t=0.5
    topoEdgeMidpoint(item) {
      const a = item.coords[0];
      const b = item.coords[1];
      const c = (item.lineStyle && item.lineStyle.curveness) || 0;
      if (!c) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const cx = (a[0] + b[0]) / 2 - (a[1] - b[1]) * c;
      const cy = (a[1] + b[1]) / 2 - (b[0] - a[0]) * c;
      return [
        (a[0] + 2 * cx + b[0]) / 4,
        (a[1] + 2 * cy + b[1]) / 4,
      ];
    },

    // 卡片定位：贴在被悬浮的元素上方，容器内放不下就翻到下方，最后整体夹在容器内。
    // 宽度按卡片最大宽度（268px）估，高度按行数估 —— 只影响贴边时的偏移量
    placeTopoHover(mode, el, state, anchor, content) {
      const k = state.view.k;
      const ax = anchor[0] * k + state.view.x;
      const ay = anchor[1] * k + state.view.y;
      const W = (el && el.clientWidth) || 320;
      const H = (el && el.clientHeight) || 240;
      const CW = 268;
      const rows =
        1 +
        (content.meta.length ? 1 : 0) +
        (content.desc ? Math.min(3, Math.ceil(content.desc.length / 20)) : 0);
      const CH = 16 + rows * 19;
      let left = Math.round(ax - CW / 2);
      left = Math.max(8, Math.min(W - CW - 8, left));
      let top = Math.round(ay - CH - 16);
      if (top < 8) top = Math.round(ay + 18);
      top = Math.max(8, Math.min(H - CH - 8, top));
      return {
        mode,
        left,
        top,
        title: content.title,
        meta: content.meta,
        desc: content.desc,
      };
    },

    markTopoDirty(mode) {
      if (!this.topoDirty[mode]) this.topoDirty[mode] = true;
    },

    clearTopoHover(mode) {
      if (this.topoHover && this.topoHover.mode === mode) this.topoHover = null;
    },

    // 单条连线（lines 系列的数据项）。
    // 曲率只能逐条给（方向不同曲率符号不同）；颜色/线型/透明度走系列级配置，
    // 这样悬浮时可以只改系列级 opacity 就整体压暗，不用重建整个 data
    buildEdgeItem(e, highlight, posMap) {
      const a = posMap.get(e.source);
      const b = posMap.get(e.target);
      // 跨多层的「跳线」用更淡的颜色：它们是骨架之外的补充关系，
      // 让相邻层之间的瀑布主线更清楚
      const long = Math.abs(e.depth) > 1;
      const item = {
        name: e.source + " → " + e.target,
        source: e.source,
        target: e.target,
        // 悬浮连线时展示的附加信息（后端有就带上，没有就是空）
        desc: e.desc || "",
        depth: e.depth,
        coords: [a, b],
        lineStyle: { curveness: e.curveness },
      };
      if (!highlight) {
        item.lineStyle.color = long ? TOPO_COLORS.edge : TOPO_COLORS.edgeStrong;
      }
      return item;
    },

    // 画布内边距。弹窗里有缩放/平移，留白可以大一些；页面内的小图贴边，别浪费空间
    topoPad(mode) {
      return mode === "dialog"
        ? { padX: 46, padY: 40 }
        : { padX: 18, padY: 16 };
    },

    // 按画布宽高比重建布局：世界坐标是等比映射到画布的，
    // 只有让「世界宽高比 ≈ 画布宽高比」才能把画布用满 —— 否则窄高的小图上下留白、
    // 宽扁的弹窗左右留白，而且节点文字会挤在一起（文字是像素尺寸，不跟着缩放）。
    // buildTopology 里：世界宽 = 层内最大节点数 × colGap，世界高 = (层数-0.4) × layerGap，
    // 所以先按宽高比解出 colGap：
    //   worldW / worldH = innerW / innerH  ⇒  colGap = layerGap·(layerCount-0.4)·innerW / (innerH·maxLayerSize)
    // 生产网真实数据是「2 层 × 20 多个节点」的扇形，解出来远小于下限、会被夹住 ——
    // 这时水平方向已经没有余量了，就反过来把 layerGap 撑开补上比例差：
    // 层间距变大只是让上下更松，不会压字，总比缩成贴在顶部的一条横线好。
    topoLayoutFor(mode, el) {
      const base = this.topo;
      if (!base || !base.nodes.length || !el) return base;
      const { padX, padY } = this.topoPad(mode);
      const innerW = Math.max(20, el.clientWidth - padX * 2);
      const innerH = Math.max(20, el.clientHeight - padY * 2);
      const cols = Math.max(1, base.maxLayerSize);
      // 世界高 = (层数-1)·layerGap + 0.6·layerGap
      const rows = Math.max(0, base.layerCount - 1) + 0.6;
      const aspect = innerW / innerH;
      const colGap = Math.max(
        TOPO_COL_GAP_MIN,
        Math.min(TOPO_COL_GAP_MAX, (TOPO_LAYER_GAP * rows * aspect) / cols)
      );
      // 要让世界宽高比等于画布宽高比，世界高得是 世界宽 / aspect；
      // 只放大不缩小 —— 层间距小于基准值会把上下两层压到一起。
      // 上面 colGap 被夹到下限时这条一定大于基准值（比例差得靠层间距补），
      // 被夹到上限（层多列少的瘦高图）时才会落到基准值，此时左右留白是正常的
      const layerGap = Math.max(
        TOPO_LAYER_GAP,
        (cols * colGap) / (rows * aspect)
      );
      const key =
        mode +
        "|" +
        Math.round(colGap) +
        "|" +
        Math.round(layerGap) +
        "|" +
        base.layerCount;
      if (this._topoLayoutKey === key && this._topoLayout) return this._topoLayout;
      const next = buildTopology(this.links, {
        colGap,
        layerGap,
      });
      this._topoLayoutKey = key;
      this._topoLayout = next;
      return next;
    },

    // 世界坐标 → 画布像素（等比缩放 + 居中），并把节点数据项、连线和
    // 「节点 → 相邻连线下标」一次算好：悬浮高亮/拖拽时直接用现成的数据项，
    // 不用重新过滤、换算、重建option
    topoState(mode, el, topo) {
      const { padX, padY } = this.topoPad(mode);
      const W = Math.max(20, el.clientWidth);
      const H = Math.max(20, el.clientHeight);
      const innerW = Math.max(20, W - padX * 2);
      const innerH = Math.max(20, H - padY * 2);
      const scale = Math.min(
        innerW / Math.max(1, topo.width),
        innerH / Math.max(1, topo.height)
      );
      const offX = padX + (innerW - topo.width * scale) / 2;
      const offY = padY + (innerH - topo.height * scale) / 2;
      const worldLeft = topo.centerX - topo.width / 2;
      const worldTop = topo.centerY - topo.height / 2;
      const posMap = new Map(
        topo.nodes.map((n) => [
          n.id,
          [offX + (n.x - worldLeft) * scale, offY + (n.y - worldTop) * scale],
        ])
      );
      const adjIndex = new Map();
      topo.edges.forEach((e, i) => {
        [e.source, e.target].forEach((id) => {
          if (!adjIndex.has(id)) adjIndex.set(id, []);
          adjIndex.get(id).push(i);
        });
      });
      const { baseSize } = this.topoNodeMetrics(mode);
      const isDialog = mode === "dialog";
      // 弹窗里文字常显，同一层节点挨得太近就会互相压成一条黑线
      // （生产网数据一层 20 多个节点，屏幕列距只有 40~70 像素，而名字有 90 像素宽）。
      // 两个办法一起用：文字上下交错（相邻节点错开一个字高），
      // 再按实际列距反算最多能画几个字 —— 挤不下就截短，宁可少两个字也不要压字。
      // 文字是跟着画布一起缩放的，缩放/平移后比例不变，所以按初始视图算一次就够
      const colGapWorld = topo.width / Math.max(1, topo.maxLayerSize);
      const labelPitch = colGapWorld * scale;
      const staggerLabels =
        isDialog && labelPitch < TOPO_LABEL_MAX_DIALOG * TOPO_LABEL_CHAR_W;
      // 交错后相邻的同类文字隔开两个列距；不交错就只有一列距
      const labelRoom = labelPitch * (staggerLabels ? 2 : 1);
      const labelMax = isDialog
        ? Math.max(
            TOPO_LABEL_MIN_DIALOG,
            Math.min(
              TOPO_LABEL_MAX_DIALOG,
              Math.floor((labelRoom - 8) / TOPO_LABEL_CHAR_W)
            )
          )
        : TOPO_LABEL_MAX;
      const nodeItems = topo.nodes.map((n) => ({
        id: n.id,
        name: n.id,
        // 交错显示时的文字位置（不交错就沿用系列默认的 bottom）
        label: staggerLabels
          ? {
              position:
                Math.abs(Math.round(n.x / colGapWorld)) % 2 ? "top" : "bottom",
            }
          : undefined,
        // 拖拽时改的就是这个坐标（整颗替换，见 writeTopoNodePos）
        value: posMap.get(n.id),
        layer: n.layer,
        inDegree: n.inDegree,
        outDegree: n.outDegree,
        isRoot: n.isRoot,
        // 所有节点一样大：大小只表示连接数的话，扇形图里同一层的节点会参差不齐，
        // 一眼看上去像两种东西（其实只是连得多连得少），反而干扰读图
        symbolSize: baseSize,
        itemStyle: {
          color: this.topoNodeFill(false),
          borderColor: TOPO_COLORS.nodeBorder,
          borderWidth: 1,
          shadowBlur: isDialog ? 14 : 9,
          shadowColor: TOPO_COLORS.nodeShadow,
        },
        // 悬浮高亮：节点整体提亮 + 换深色描边（逐节点写）
        emphasis: {
          itemStyle: {
            color: this.topoNodeFill(true),
            borderColor: TOPO_COLORS.nodeBorderBright,
            borderWidth: 1.8,
            shadowBlur: isDialog ? 26 : 16,
            shadowColor: TOPO_COLORS.nodeShadowBright,
          },
        },
      }));
      return {
        mode,
        W,
        H,
        posMap,
        adjIndex,
        nodeItems,
        // 这个尺寸下节点文字最多能画几个字（buildTopoOption 的 formatter 用）
        labelMax,
        nodeIndex: new Map(topo.nodes.map((n, i) => [n.id, i])),
        // 命中半径（基准坐标系里的半径，随视图缩放一起放大）
        radius: new Map(
          topo.nodes.map((n, i) => [n.id, nodeItems[i].symbolSize / 2])
        ),
        // 初始位置快照：重置视图把节点放回这里。
        // posMap 里的坐标数组都是整颗替换（不原地改），所以快照不会被拖拽弄脏
        basePos: new Map(posMap),
        // 画布视图（缩放 + 平移），由各系列所在 zrender 组合的 transform 实现
        view: { k: 1, x: 0, y: 0 },
        // 当前高亮的连线下标 / 悬浮命中 / 是否正在拖拽缩放
        focusEdges: [],
        hoverKey: "",
        interacting: false,
        edgeItems: topo.edges.map((e) => this.buildEdgeItem(e, false, posMap)),
        focusItems: topo.edges.map((e) => this.buildEdgeItem(e, true, posMap)),
      };
    },

    // 节点尺寸：只有两种画布尺寸，节点大小固定（不按连接数变，见 topoState 里的注释）
    topoNodeMetrics(mode) {
      return mode === "dialog" ? { baseSize: 26 } : { baseSize: 14 };
    },

    // 上下渐变填充：白底上靠明暗差做出体积感，比纯色块更像实体
    topoNodeFill(bright) {
      const c = TOPO_COLORS;
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: bright ? c.nodeTopBright : c.nodeTop },
        { offset: 1, color: bright ? c.nodeBottomBright : c.nodeBottom },
      ]);
    },

    // 构建拓扑图 option。
    //
    // 【为什么不用 graph 系列】echarts 4.9 的 graph + coordinateSystem:'cartesian2d' 有 bug：
    // simpleLayout 取不到节点的 x/y，所有节点的 layout 都是 NaN，整张图什么都画不出来，
    // 而且 GraphView 遍历边时还会因为边没有图形元素直接抛异常。
    // 所以这里：节点 = scatter 系列，连线 = lines 系列（自带流动光点），两者共用一套坐标。
    // x/y 轴按「1 数据单位 = 1 像素」铺满画布（grid 四边为 0、轴隐藏），
    // 坐标在 topoState 里已经换算成像素，所以连线形状不会被拉伸
    buildTopoOption(mode, state) {
      const isDialog = mode === "dialog";
      const c = TOPO_COLORS;
      const W = state.W;
      const H = state.H;
      const { edgeItems, nodeItems } = state;
      const baseSize = this.topoNodeMetrics(mode).baseSize;

      return {
        backgroundColor: "transparent",
        animationDuration: 600,
        grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
        xAxis: {
          type: "value",
          min: 0,
          max: W,
          boundaryGap: [0, 0],
          show: false,
        },
        yAxis: {
          type: "value",
          min: 0,
          max: H,
          boundaryGap: [0, 0],
          inverse: true,
          show: false,
        },
        // 没有 tooltip / dataZoom：
        //   悬浮信息走自绘的卡片（lines 系列在 4.9 里根本不给连线挂 tooltip），
        //   缩放平移走系列组合的 transform（见 bindTopoInteractions），都不经过 echarts 自己那套
        //
        // clip:false 是必需的：直角坐标系系列默认按 grid 区域裁剪，缩放/平移之后画布上的
        // 内容会跑到 grid 之外，会被裁掉（拖动时内容一块块消失）
        series: [
          {
            // 静态虚线（不含光点，所以这一层不会被 motionBlur 叠加）
            id: TOPO_EDGE_SERIES,
            type: "lines",
            coordinateSystem: "cartesian2d",
            polyline: false,
            clip: false,
            zlevel: TOPO_ZLEVEL_EDGE,
            z: 2,
            lineStyle: {
              color: c.edgeStrong,
              width: isDialog ? 1.2 : 1,
              type: "dashed",
              opacity: 1,
            },
            data: edgeItems,
          },
          {
            // 流动光点：线条本身透明，只让 effect 的圆点沿同一条二次贝塞尔跑
            // （和静态虚线共用同一份数据，曲率一致 ⇒ 严格重合）
            id: TOPO_FLOW_SERIES,
            type: "lines",
            coordinateSystem: "cartesian2d",
            polyline: false,
            clip: false,
            silent: true,
            zlevel: TOPO_ZLEVEL_FLOW,
            z: 2,
            lineStyle: { opacity: 0, width: 0 },
            // 光点收小、调淡、拖尾缩短：是背景里的流动感，不该盖过节点和连线
            effect: {
              show: !state.interacting,
              period: isDialog ? 5 : 6.5,
              trailLength: 0.14,
              loop: true,
              symbol: "circle",
              symbolSize: isDialog ? 3.6 : 2.4,
              color: c.flow,
            },
            data: edgeItems,
          },
          {
            // 悬浮节点时高亮的那几条相邻连线（默认空，不占视觉）；
            // 自带光点：追踪链路时流动的光只走被点亮的那几条
            id: TOPO_FOCUS_SERIES,
            type: "lines",
            coordinateSystem: "cartesian2d",
            polyline: false,
            clip: false,
            silent: true,
            zlevel: TOPO_ZLEVEL_FOCUS,
            z: 3,
            lineStyle: {
              color: c.edgeActive,
              width: isDialog ? 2.2 : 1.6,
              opacity: 0.95,
            },
            effect: {
              show: true,
              period: isDialog ? 2.2 : 2.8,
              trailLength: 0.2,
              loop: true,
              symbol: "circle",
              symbolSize: isDialog ? 4.4 : 3.2,
              color: c.flowActive,
            },
            data: [],
          },
          {
            // 节点（数据项在 topoState 里建好，拖拽时原地改坐标即可）
            id: TOPO_NODE_SERIES,
            type: "scatter",
            clip: false,
            zlevel: TOPO_ZLEVEL_NODE,
            z: 4,
            symbol: TOPO_NODE_SYMBOL,
            symbolSize: baseSize,
            label: {
              // 小图默认不显示文字（悬浮时经 emphasis 显示）；弹窗内常显
              show: isDialog,
              position: "bottom",
              distance: 6,
              color: c.label,
              fontSize: 11,
              lineHeight: 13,
              formatter: (p) => topoNodeLabel(p.name, state.labelMax),
            },
            emphasis: {
              label: {
                show: true,
                color: c.label,
                fontSize: isDialog ? 12 : 11,
                fontWeight: 700,
                lineHeight: 13,
                formatter: (p) => topoNodeLabel(p.name, state.labelMax),
              },
            },
            data: nodeItems,
          },
        ],
      };
    },

    // 打开链路关系图放大弹窗（弹窗内文字常显、可缩放/平移）
    openTopoDialog() {
      this.topoDialogVisible = true;
    },

    // 弹窗完全展开后再初始化图表（容器此时才有尺寸）
    onTopoDialogOpened() {
      this.$nextTick(() => this.renderTopoChart("dialog"));
    },

    onTopoDialogClose() {
      if (this.topoDialogChart) {
        this.topoDialogChart.dispose();
        this.topoDialogChart = null;
      }
      this._topoStates.dialog = null;
      this.clearTopoHover("dialog");
      this.topoDirty.dialog = false;
    },

    // 重置视图：被拖走的节点回到初始位置，画布缩放/平移回到 1:1，
    // 顺带清掉悬浮高亮和卡片（节点位置变化有过渡动画，点一下能看清「归位」）
    resetTopoView(mode = "dialog") {
      const chart = mode === "dialog" ? this.topoDialogChart : this.linkChart;
      const state = this._topoStates[mode];
      if (!chart || !state) return;
      // 1. 节点归位：位置数组整颗替换，连线的两端引用同步指过去
      state.basePos.forEach((base, id) => {
        this.writeTopoNodePos(state, id, base.slice());
      });
      // 2. 画布回正
      state.view.x = 0;
      state.view.y = 0;
      state.view.k = 1;
      state.applyView();
      // 3. 数据整体刷一遍（含流动光点）+ 清掉高亮
      state.hoverKey = "";
      chart.dispatchAction({ type: "downplay", seriesId: TOPO_NODE_SERIES });
      this.syncTopoFocus(chart, state, []);
      state.refresh(true);
      this.clearTopoHover(mode);
      this.topoDirty[mode] = false;
      zrSetCursor(chart, "grab");
    },

    // 容器尺寸变化后重排：轴范围要按新尺寸重算，直接 resize 会拉伸变形
    scheduleInlineRedraw() {
      if (this._topoRedrawTimer) clearTimeout(this._topoRedrawTimer);
      this._topoRedrawTimer = setTimeout(() => {
        this._topoRedrawTimer = null;
        if (this.links.length) this.renderTopoChart("inline");
      }, 200);
    },

    // 窗口尺寸变化时重绘链路关系图（轴范围按新尺寸重算，直接 resize 会拉伸变形），
    // 并重新测量表格可用宽度（列宽跟着重算）
    handleResize() {
      if (this.links.length) this.renderTopoChart("inline");
      if (this.topoDialogVisible) this.renderTopoChart("dialog");
      this.measureTableWidth();
    },

    // 测量表格可用于分列的宽度：直接量 el-table__body-wrapper，
    // 它已经扣掉了竖向滚动条（正是 Element 计算列宽时用的那个宽度），不用靠内边距去估算
    measureTableWidth() {
      const panel = this.$refs.hostsPanel;
      if (!panel) return;
      const bodies = panel.querySelectorAll(".el-table__body-wrapper");
      let w = 0;
      for (let i = 0; i < bodies.length; i += 1) {
        if (bodies[i].clientWidth > 0) {
          w = bodies[i].clientWidth;
          break;
        }
      }
      // 表格还没渲染 / 集群全收起时量不到，退回按面板宽度估算（内边距 8+8、内容区 10+10、边框与滚动条再留 20）
      if (!w) w = panel.clientWidth - 56;
      if (w > 0 && w !== this.tableWidth) this.tableWidth = w;
    },

    // 卡片渲染后才能拿到 DOM：监听卡片宽度变化（窗口缩放、侧边栏折叠都覆盖），
    // 监听卡片而不是面板 —— 卡片宽度由 flex 决定，不受表格滚动条出现/消失影响，不会来回抖
    observeHostsCard() {
      const el = this.$refs.hostsCard;
      if (!el || !window.ResizeObserver) return;
      if (!this.panelObserver) {
        this.panelObserver = new ResizeObserver(() => {
          this.measureTableWidth();
          // 链路卡片与主机卡片同排，宽度变化时拓扑图要按新画布重排
          this.scheduleInlineRedraw();
        });
      }
      this.panelObserver.observe(el);
    },

    // 切换组件类型：左侧主机列表联动筛选，并默认展开其第一个集群
    selectComponent(name) {
      this.activeComponent = name;
      const comp = this.componentList.find((c) => c.name === name);
      this.openClusters =
        comp && comp.clusters.length ? [comp.clusters[0].name] : [];
    },

    // 展开/收起集群（非手风琴，value 为展开的集群名数组）
    onClusterToggle(val) {
      this.openClusters = val || [];
    },

    // 打开集群关系弹窗（数据来自 relationGroups computed）
    openRelationDialog() {
      this.relationDialogVisible = true;
    },

    // 构建主机列表列（全动态）：取集群内所有记录字段的并集，数据里有几个字段就展示几列，
    // 新增字段无需改代码；已知字段用中文表头，未收录的字段直接用英文 key 当表头。
    // 列宽不写死：按期望宽度等比压缩到当前表格可用宽度内 ——
    // 字段变多时只是列变窄 + 省略号，永远不会撑出横向滚动条
    buildColumns(hosts) {
      const keys = [];
      const seen = new Set();
      (hosts || []).forEach((h) =>
        Object.keys(h).forEach((k) => {
          if (!seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        })
      );
      // 已知字段按 FIELD_ORDER 排序，未收录字段保持首次出现顺序排在最后
      keys.sort((a, b) => {
        const ia = FIELD_ORDER.indexOf(a);
        const ib = FIELD_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      const metas = keys.map((k) => FIELD_COLUMNS[k] || {});
      const prefs = metas.map((m) => m.minWidth || DEFAULT_COLUMN_WIDTH);
      // 表格可用宽度（还没测量到就按 900 估一个），再留 4px 边框余量
      const budget = Math.max(320, (this.tableWidth || 900) - 4);
      // 列数特别多时，压缩下限也跟着降，保证“总宽 <= 可用宽度”这条能成立
      const floor = Math.min(MIN_COLUMN_WIDTH, Math.floor(budget / keys.length));
      const total = prefs.reduce((s, w) => s + w, 0);
      // 固定宽模式下的实际总宽（固定列用 fixedWidth，其余用 minWidth）；
      // 只有它塞得进容器才敢用固定宽 —— 否则整表退化成等比压缩，宁可列窄也不能出横向滚动条
      const roomyTotal = prefs.reduce((s, w, i) => s + (metas[i].fixedWidth || w), 0);
      const roomy = roomyTotal <= budget;
      const scale = roomy ? 1 : budget / total;
      const widths = prefs.map((w, i) => {
        if (roomy && metas[i].fixedWidth) return metas[i].fixedWidth;
        return Math.max(floor, Math.floor(w * scale));
      });
      // 压缩（或垫到下限）后还有零头超预算的话，从最宽的列往下削，直到正好塞进容器
      let sum = widths.reduce((s, w) => s + w, 0);
      while (sum > budget) {
        let widest = -1;
        widths.forEach((w, i) => {
          if (w > floor && (widest === -1 || w > widths[widest])) widest = i;
        });
        if (widest === -1) break; // 所有列都到下限，再削就没法看了
        widths[widest] -= 1;
        sum -= 1;
      }
      return keys.map((k, i) => ({
        prop: k,
        label: metas[i].label || k,
        // 短字段固定宽（富余时锁死不再被撑开），其余列 minWidth 自适应吃掉富余宽度
        width: roomy && metas[i].fixedWidth ? metas[i].fixedWidth : undefined,
        minWidth: widths[i],
      }));
    },

    machineType(mtype) {
      const map = { V: "虚拟机", P: "物理机" };
      return map[mtype] || mtype;
    },

    // 表头：列被压窄时用省略号，同时挂原生 title，悬浮可看完整字段名
    renderColumnHeader(h, { column }) {
      return h("span", { attrs: { title: column.label } }, column.label);
    },
  },
};
</script>

<style lang="scss" scoped>
/* ============ 设计变量 ============ */
$profile-bg: #f5f7fa; // 页面整体背景（极浅灰蓝，避免纯白）
$profile-card-bg: #fff; // 卡片背景
$profile-card-border: #ebeef5; // 卡片浅边框
$profile-card-radius: 10px; // 卡片圆角
$profile-card-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06); // 卡片轻量阴影
$profile-stat-bg: #f8f9fa; // 极浅灰（标签兜底色）
$profile-accent: #409eff; // 主题蓝（Element 默认主色）

// 统计卡片：key → 强调色（左色条 + 图标色块 + 淡色渐变背景）
$stat-colors: (
  "component": #409eff,
  "cluster": #67c23a,
  "host": #e6a23c,
  "link": #9254de,
);

/* ============ 页面整体：一屏内，仅主机列表内部滚动 ============ */
.profile-page {
  padding: 20px;
  /* 高度拉满 app-main 内容区（84 = navbar 50 + tags-view 34；版权条已禁用，无额外补偿） */
  height: calc(100vh - 84px);
  min-height: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: $profile-bg;
}

/* ============ 空状态：居中的搜索入口（未查询前展示） ============ */
.profile-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &__icon {
    font-size: 44px;
    color: #c0c4cc;
    margin-bottom: 10px;
  }

  &__title {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 700;
    color: #303133;
    letter-spacing: 2px;
  }

  &__hint {
    margin: 0;
    font-size: 12.5px;
    color: #909399;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
  }

  &__input {
    width: 460px;
  }
}

/* ============ 加载/无数据状态 ============ */
.profile-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;

  &__icon {
    font-size: 36px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

/* ============ 系统切换弹窗 ============ */
.profile-switch {
  &__hint {
    margin: 0 0 12px;
    font-size: 12.5px;
    color: #909399;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-input {
      flex: 1;
    }
  }
}

/* ============ 顶部信息栏（单行）：系统信息 | 机房 | 简介 | 行内统计 ============ */
.profile-info {
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;

  /* 竖分隔线（分组：系统信息 / 机房 / 简介 / 统计） */
  &__divider {
    flex-shrink: 0;
    width: 1px;
    height: 20px;
    background: $profile-card-border;
  }

  /* 系统名称整体：可点击的切换入口，视觉权重最高 */
  &__switch {
    position: relative;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    min-width: 0;
  }

  /* i 图标：绝对定位在名称左上方，不占布局空间 */
  &__info-icon {
    position: absolute;
    top: -2px;
    left: -16px;
    font-size: 12px;
    color: #909399;
  }

  &__name {
    max-width: 380px;
    font-size: 16px;
    font-weight: 700;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.15s ease;
  }

  /* 悬停/聚焦时名称变主题蓝，提示可点击 */
  &__switch:hover .profile-info__name {
    color: $profile-accent;
  }

  /* 重要性级别：橙金色徽标 */
  &__level {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 10px;
    background: #fdf6ec;
    border: 1px solid #faecd8;
    color: #e6a23c;
    font-size: 11px;
    font-weight: 700;
  }

  /* 机房/数据中心：宽度 = 内容宽度（随机房个数自适应），不参与压缩，压缩空间全部由简介提供 */
  &__rooms {
    flex: 0 0 auto;
    max-width: 960px; /* 极端兜底：机房过多时裁切，不撑爆信息栏 */
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
  }

  &__room {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    i {
      color: $profile-accent;
      font-size: 14px;
    }
  }

  &__room-label {
    color: #909399;
    font-size: 12px;
  }

  &__room-value {
    color: #606266;
    font-weight: 600;
    font-size: 13px;
  }

  &__dc {
    flex-shrink: 0;
  }

  /* 简介：最主要的可压缩区（可压至 60px 极限），单行省略，悬停 title 显示全部 */
  &__desc {
    flex: 1 1 auto;
    min-width: 60px;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    overflow: hidden;
  }

  &__desc-label {
    flex-shrink: 0;
    color: #909399;
    font-size: 12px;
  }

  &__desc-text {
    flex: 1;
    min-width: 0;
    color: #606266;
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 行内紧凑统计：图标 + 数字 + 短标签，不再使用大卡片 */
  .profile-stats-inline {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .profile-stat-inline {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;

    i {
      font-size: 12px;
      color: #909399;
      align-self: center;
    }

    &__value {
      font-size: 15px;
      font-weight: 700;
      color: #303133;
      font-variant-numeric: tabular-nums;
    }

    &__label {
      font-size: 11.5px;
      color: #909399;
    }

    /* 指标图标沿用原统计颜色体系 */
    @each $key, $color in $stat-colors {
      &.is-#{$key} i {
        color: $color;
      }
    }
  }
}

/* ============ 组件拓扑区域：左侧标签 + 右侧集群关系 ============ */
.profile-topo {
  flex-shrink: 0;
  height: 90px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;

  /* 左侧：标题 + 组件标签 */
  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  &__head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__title {
    font-size: 13px;
    font-weight: 700;
    color: #303133;
  }

  &__hint {
    font-size: 11.5px;
    color: #909399;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* 右侧：集群关系（title + nodes；选中组件无对应数据时显示空态）。
     高度不设 height: 100%，由父级 align-items: center 保证垂直居中 */
  &__relation {
    flex-shrink: 0;
    width: 520px;
    min-width: 0;
    padding-left: 16px;
    border-left: 1px dashed #dcdfe6;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;

    &-title {
      flex-shrink: 0;
      font-size: 11.5px;
      color: #909399;
    }

    /* 文字按钮：点击后弹窗用表格展示集群关系明细 */
    &-btn {
      flex-shrink: 0;
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      border: none;
      background: none;
      font-size: 12.5px;
      color: $profile-accent;
      cursor: pointer;
      transition: color 0.15s ease;

      i {
        font-size: 12px;
      }

      &:hover {
        color: #2f8be8;
        text-decoration: underline;
      }
    }

    &-empty {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #c0c4cc;

      i {
        font-size: 13px;
      }
    }
  }
}

/* 集群关系弹窗内：desc 缺失时占位符 - 弱化显示 */
.profile-relation-desc--empty {
  color: #c0c4cc;
}

/* 组件标签：紧凑胶囊 + 数量角标；未选中统一灰白，选中态主题蓝 */
.profile-topo__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 999px;
  background: $profile-card-bg;
  color: #606266;
  cursor: pointer;
  transition: all 0.15s ease;

  /* 选中态：统一 Nginx 蓝，不再按组件类型区分颜色 */
  &.is-active {
    background: #ecf5ff;
    border-color: $profile-accent;
    color: $profile-accent;
    box-shadow: 0 2px 8px 0 rgba(64, 158, 255, 0.25);
  }

  &__name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__count {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 10.5px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.06);
  }
}

/* ============ 底部：主机列表（宽，动态列多）+ 链路关系图（窄） ============ */
.profile-bottom {
  flex: 1;
  min-height: 440px;
  display: flex;
  gap: 16px;
}

/* ---- 主机列表卡片 ---- */
.profile-hosts {
  flex: 13;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;
  overflow: hidden;

  &__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px 10px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: #303133;
  }

  &__count {
    font-size: 11.5px;
    color: #909399;
    background: $profile-stat-bg;
    padding: 1px 8px;
    border-radius: 8px;
    line-height: 18px;
  }

  &__search {
    width: 200px;
    margin-left: auto;
  }

  /* 集群折叠面板容器：多个集群展开时整体滚动（左右内边距收紧，给表格让出宽度） */
  &__panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 8px 12px;
  }

  &__empty {
    padding: 48px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #909399;
    font-size: 13px;

    i {
      font-size: 28px;
    }

    p {
      margin: 0;
    }
  }
}

/* ============ 集群折叠面板：每个集群一个可展开收起的表格 ============ */
/* 【Element 覆写】折叠面板改白卡：浅边框 + 圆角 */
::v-deep .profile-hosts__panel .el-collapse {
  border: none;
}

::v-deep .profile-hosts__panel .el-collapse-item {
  border: 1px solid $profile-card-border;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
  background: $profile-card-bg;

  .el-collapse-item__header {
    background: linear-gradient(180deg, #f7fafd, #fff);
    padding: 0 14px;
    height: 42px;
    line-height: 42px;
    border-bottom: none;
    font-size: 12.5px;
    color: #303133;
  }

  /* 展开态：标题行淡蓝高亮 */
  &.is-active .el-collapse-item__header {
    background: #f5f9ff;

    .profile-cluster__count {
      background: #ecf5ff;
      color: $profile-accent;
    }
  }

  .el-collapse-item__wrap {
    border-bottom: none;
    background: #fff;
  }

  .el-collapse-item__content {
    padding: 12px 10px 14px;
  }

  /* 【Element 覆写】表格：表头浅灰底、行 hover 淡蓝、去底部横线 */
  .el-table {
    &::before {
      display: none;
    }

    th.el-table__cell {
      background: #f5f7fa;
      color: #909399;
      font-weight: 600;
      font-size: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #ebeef5;
    }

    td.el-table__cell {
      padding: 6px 0;
      font-size: 12.5px;
      color: #606266;
      border-bottom: 1px solid #ebeef5;
    }

    .el-table__row:hover > td.el-table__cell {
      background: #f5f9ff;
    }

    /* 动态列多、列被压窄时：单元格左右内边距收窄给文字让位 */
    th .cell,
    td .cell {
      padding-left: 8px;
      padding-right: 8px;
    }

    /* 表头单行长省略号（完整名称用原生 title 悬浮查看），避免表头折行撑高 */
    th .cell {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

/* 集群标题：统一主题蓝圆点 + 集群名 + 台数徽标 */
.profile-cluster {
  &__dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    margin-right: 8px;
    flex-shrink: 0;
    background: $profile-accent;
  }

  &__title {
    font-weight: 600;
    color: #303133;
    margin-right: 10px;
  }

  &__count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 400;
    color: #909399;
    background: $profile-stat-bg;
    border-radius: 8px;
    padding: 1px 8px;
    line-height: 18px;
  }
}

/* 表格内主机名：图标 + 名称 */
.profile-host {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &__icon {
    color: #909399;
    font-size: 13px;
  }

  &__name {
    color: #303133;
    font-weight: 600;
  }
}

/* 机房：浅灰底标签 */
.profile-idc {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background: $profile-stat-bg;
  color: #606266;
  font-size: 11px;
  font-weight: 500;
}

/* 主机类型：蓝/绿标签（V=虚拟机 / P=物理机） */
.profile-mtype {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;

  &.is-v {
    background: #ecf5ff;
    color: #409eff;
  }

  &.is-p {
    background: #f0f9eb;
    color: #67c23a;
  }
}

/* ---- 链路关系图 ---- */
.profile-link {
  flex: 7;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: $profile-card-bg;
  border: 1px solid $profile-card-border;
  border-radius: $profile-card-radius;
  box-shadow: $profile-card-shadow;
  overflow: hidden;

  &__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px 10px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: #303133;
  }

  /* 右侧操作区：提示文案 + 放大按钮 */
  &__actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__tip {
    font-size: 11.5px;
    color: #a6b1bf;
    white-space: nowrap;
  }

  /* 右上角图标按钮（重置视图 / 放大）：小图看整体，点开在大弹窗里看细节 */
  &__icon {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid $profile-card-border;
    border-radius: 6px;
    background: $profile-card-bg;
    color: #606266;
    cursor: pointer;
    transition: all 0.15s ease;

    i {
      font-size: 13px;
      align-self: center;
    }

    &:hover {
      color: $profile-accent;
      border-color: $profile-accent;
      background: #ecf5ff;
    }
  }

  /* 图表容器：占满头部以下区域；浅色「蓝图」底 —— 极浅蓝渐变打底，叠一层淡蓝光晕，
     再铺点阵网格，和页面其它浅色卡片同一个色调。position: relative 给画布层和悬浮卡片做定位参照 */
  &__chart {
    position: relative;
    flex: 1;
    min-height: 0;
    margin: 0 16px 16px;
    border: 1px solid #e4edf9;
    border-radius: $profile-card-radius;
    overflow: hidden;
    background-color: #fbfdff;
    background-image:
      radial-gradient(circle, rgba(64, 158, 255, 0.13) 1px, transparent 1px),
      radial-gradient(
        ellipse at 50% 36%,
        rgba(64, 158, 255, 0.12) 0%,
        rgba(64, 158, 255, 0.03) 55%,
        rgba(255, 255, 255, 0) 76%
      ),
      linear-gradient(170deg, #fbfdff 0%, #f2f8fe 100%);
    background-size: 22px 22px, 100% 100%, 100% 100%;
  }

  /* ECharts 画布层：铺满容器、独立占一个节点（卡片必须是它的兄弟，不能放在里面） */
  &__canvas {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }

  /* 无链路数据时的占位：和图表容器同一个盒子（虚线边框表示“待接入”），
     多宽多高都跟图表一致，接入真实图后不会跳版 */
  &__empty {
    flex: 1;
    min-height: 0;
    margin: 0 16px 16px;
    border: 1px dashed #cfe0f5;
    border-radius: $profile-card-radius;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    background: linear-gradient(175deg, #f8fbff 0%, #eff5fd 100%);

    i {
      font-size: 30px;
      color: #c3d7f0;
    }

    p {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: #7b8da8;
    }

    span {
      font-size: 11.5px;
      color: #a6b1bf;
    }
  }

  /* 链路/集群计数徽标 */
  &__count {
    font-size: 11px;
    color: #909399;
    background: $profile-stat-bg;
    padding: 1px 8px;
    border-radius: 8px;
    line-height: 18px;
  }
}

/* ============ 链路图悬浮卡片（节点 / 连线，小图与弹窗共用） ============ */
.profile-hover {
  position: absolute;
  z-index: 6;
  max-width: 268px;
  padding: 8px 10px 9px;
  border: 1px solid #e2ecfa;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 8px 24px rgba(31, 66, 116, 0.16);
  color: #303133;
  /* 卡片浮在画布上，但绝不能挡住命中测试 —— 否则鼠标压到卡片上悬浮态就断了 */
  pointer-events: none;

  &__title {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.45;
    word-break: break-all;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-top: 5px;
    font-size: 11px;
    color: #909399;
  }

  /* 链路描述：后端返回 desc 字段才出现，没有就整段不渲染 */
  &__desc {
    margin: 6px 0 0;
    padding-top: 6px;
    border-top: 1px dashed #e8eef7;
    font-size: 11.5px;
    line-height: 1.55;
    color: #606266;
    word-break: break-all;
  }
}

/* ============ 链路关系图放大弹窗（内容由本模板渲染，scoped 可命中） ============ */
.profile-topo-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-topo-dialog__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-topo-dialog__meta {
  font-size: 12px;
  color: #606266;
}

.profile-topo-dialog__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.profile-topo-dialog__tip {
  font-size: 11.5px;
  color: #a6b1bf;
}

.profile-topo-dialog__chart {
  /* 画布层与悬浮卡片的定位参照；底色与页面内小图完全一致 */
  position: relative;
  height: calc(78vh - 130px);
  min-height: 420px;
  border: 1px solid #e4edf9;
  border-radius: $profile-card-radius;
  overflow: hidden;
  background-color: #fbfdff;
  background-image:
    radial-gradient(circle, rgba(64, 158, 255, 0.13) 1px, transparent 1px),
    radial-gradient(
      ellipse at 50% 36%,
      rgba(64, 158, 255, 0.12) 0%,
      rgba(64, 158, 255, 0.03) 55%,
      rgba(255, 255, 255, 0) 76%
    ),
    linear-gradient(170deg, #fbfdff 0%, #f2f8fe 100%);
  background-size: 22px 22px, 100% 100%, 100% 100%;
}

/* ECharts 画布层：铺满弹窗容器，和悬浮卡片互不干扰（同小图） */
.profile-topo-dialog__canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
</style>

<!-- dialog 挂载在 body 上，覆盖 el-dialog 内部样式需非 scoped（同 AtomDetailDialog 做法）。
     用 custom-class（profile-topo-dialog）而不是全局改 .el-dialog，其它页面弹窗不跟着变 -->
<style lang="scss">
.profile-topo-dialog {
  max-width: calc(100vw - 40px);
  border: 1px solid #ebeef5;
  border-radius: 12px;
  overflow: hidden;

  .el-dialog__header {
    padding: 14px 18px 10px;
    border-bottom: 1px solid #f0f3f8;
  }

  .el-dialog__title {
    color: #303133;
    font-size: 15px;
    font-weight: 700;
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: #909399;

    &:hover {
      color: #409eff;
    }
  }

  .el-dialog__body {
    padding: 14px 18px 18px;
    color: #606266;
  }

  /* 重置视图按钮：浅色描边按钮，和页面里的次级按钮同一个观感 */
  .el-button--mini.is-round {
    background: #fff;
    border-color: #dbe7f7;
    color: #409eff;

    &:hover {
      background: #ecf5ff;
      border-color: #409eff;
      color: #409eff;
    }
  }
}
</style>
