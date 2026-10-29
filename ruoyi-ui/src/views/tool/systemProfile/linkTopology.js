/**
 * 系统画像 - 链路关系图：数据规范化 + 按组件集群筛选 + 瀑布分层布局（纯函数，无 echarts 依赖）
 *
 * 数据契约（兼容后端两种格式）：
 *   1. 对象数组：[{ fnode: "A", snode: "B" }, ...]（生产网真实格式）
 *   2. 元组：[["A", "snode", "B"], ...] / [["A", "", "B"], ...] / [["A", "B"], ...]
 *      节点名是原始字符串（如 bpc@SZ-CS-SCYW-CSPROD@app-bpc），不带「组件类型/集群名」前缀
 *   两种格式都允许附带额外字段（desc 等），会原样透传到 edges 上供悬浮展示
 *
 * 布局思路（瀑布式、自上而下）：
 *   1. 破环：DFS 标记回边（指向「当前搜索栈上节点」的边）。去掉回边后图一定是 DAG，
 *      分层时把回边当成反向边参与最长路径计算 —— 否则整块强连通子图（如 agent→sso→agent）
 *      无法被 Kahn 处理，只能全部堆到最底层，产生贯穿全图的长连线
 *   2. Kahn 最长路径分层：层号 = 从任一根节点出发的最长路径长度，节点尽量往上靠
 *   3. 层内两轮重心法排序（先按父节点、再按子节点），减少连线交叉
 *   4. 层内等距展开，同一层节点水平居中
 *   5. 边曲率按 source/target 字典序取正负号：双向边（A→B 与 B→A）自动分开
 *      （该曲率公式与 echarts graph/lines 的二次贝塞尔控制点算法一致，
 *        两个系列传同一个值即可让「静态虚线」与「流动光点」严格重合）
 */

/**
 * 链路数据规范化：对象 / 三元组 / 二元组 → [{ source, target, ...附加字段 }]，
 * 去重、去自环、去脏数据。
 *
 * 除 source/target 外的字段原样透传（例如后端将来会加的 desc 链路描述）：拓扑绘制只认
 * source/target，但悬浮连线时要把描述展示出来，所以不能在这里把字段吃掉。
 */
export function normalizeLinks(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  const seen = new Set();
  raw.forEach((item) => {
    let source;
    let target;
    let extra = null;
    if (Array.isArray(item)) {
      if (item.length >= 3) {
        source = item[0];
        target = item[2];
      } else if (item.length === 2) {
        source = item[0];
        target = item[1];
      }
      // 元组形式的附加字段：末尾挂一个对象（["A", "snode", "B", { desc: "..." }]）
      const tail = item[item.length - 1];
      if (tail && typeof tail === "object" && !Array.isArray(tail)) extra = tail;
    } else if (item && typeof item === "object") {
      source = item.fnode;
      target = item.snode;
      extra = item;
    }
    if (source == null || target == null) return;
    source = String(source).trim();
    target = String(target).trim();
    if (!source || !target || source === target) return;
    const key = source + "\u0000" + target;
    if (seen.has(key)) return;
    seen.add(key);
    const link = { source, target };
    if (extra) {
      Object.keys(extra).forEach((k) => {
        if (k === "fnode" || k === "snode" || k === "source" || k === "target") return;
        link[k] = extra[k];
      });
    }
    out.push(link);
  });
  return out;
}

/**
 * 按「组件下的集群名」筛链路 —— **顺着链路一路向下游展开**（纯函数）。
 *
 * 命中分两步：
 *   1. **定根**：传入的集群名就是根集合，起点要**全等**命中才算（不是「包含」）；
 *   2. **展开下游**：从根出发沿链路做可达性遍历 —— 根的直接下游、下游的下游、
 *      再下游……全部收进集合，最后把所有「起点落在集合里」的链路原样返回。
 *
 * 为什么不能只看第一层：真实链路是一条链，A→B 之后往往还有 B→C、C→D
 * （例如 MYSQL → CANAL → KAFKA → ES）。只看 `fnode === 集群名` 的话，
 * 选中 MYSQL 只能看到 MYSQL→CANAL 这一段，后半条链直接断掉；用户要的是
 * 「这个 key 连同它下游的所有连线都画出来」（孙子节点、曾孙节点都算）。
 *
 * 仍然**不看终点**：指向集合内的上游边不画 —— 选 MYSQL 不该把 NGINX→MYSQL
 * 也带出来（那是 NGINX 组件的视角）。所以这里是「向前的传递闭包」，不是「双向连通块」。
 *
 * 环不会死循环：visited 兼作可达集合，进过一次的节点不再入队
 * （HADOOP 的 bjb↔hfa 双向边这类数据很常见）。
 *
 * 一个集群名都拿不到（没选组件 / 组件下没有集群）时返回空数组 —— 调用方按
 * 「无链路」渲染占位，不要退回「显示全部」。
 *
 * @param {Array<{source:string,target:string}>} links normalizeLinks 的输出
 * @param {Array<string>} clusterNames 根节点名（组件拓扑第二层的 key / 集群关系里的节点名）
 * @returns {Array} 命中的链路（保持入参顺序）
 */
export function filterLinksByClusters(links, clusterNames) {
  const list = Array.isArray(links) ? links : [];
  // 根节点名来自对象 key / 数组元素，两侧可能带空白，先 trim 再参与全等比较
  const names = (Array.isArray(clusterNames) ? clusterNames : [])
    .map((n) => (n == null ? "" : String(n)).trim())
    .filter(Boolean);
  if (!names.length) return [];

  // 邻接表：起点 -> 下游终点[]。只用于「往下游走」，链路对象本身不改
  const outMap = new Map();
  list.forEach((link) => {
    if (!link) return;
    const from = link.source == null ? "" : String(link.source);
    const to = link.target == null ? "" : String(link.target);
    if (!from || !to) return;
    const outs = outMap.get(from);
    if (outs) outs.push(to);
    else outMap.set(from, [to]);
  });

  // 迭代 BFS（真实链路节点数可达数百，递归有栈溢出风险）
  const visited = new Set(names);
  const queue = names.slice();
  let head = 0;
  while (head < queue.length) {
    const outs = outMap.get(queue[head]);
    head += 1;
    if (!outs) continue;
    outs.forEach((to) => {
      if (visited.has(to)) return; // 环 / 重复下游：展开过就不再入队
      visited.add(to);
      queue.push(to);
    });
  }

  return list.filter((link) => {
    if (!link) return false;
    // fnode 侧不做 trim / 大小写折叠：要的就是「逐字相同」，宽松匹配会
    // 把「长得像但其实是另一个集群」的链路放进来，那正是要避免的
    const from = link.source == null ? "" : String(link.source);
    return from !== "" && visited.has(from);
  });
}

/**
 * DFS 标记回边：返回与 edges 等长的 reversed 标记数组。
 * 迭代实现（真实链路数据节点数可达数百，递归有栈溢出风险）。
 */
function markBackEdges(nodeIds, edges, outEdgeIdx) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  nodeIds.forEach((id) => color.set(id, WHITE));
  const reversed = new Array(edges.length).fill(false);

  nodeIds.forEach((start) => {
    if (color.get(start) !== WHITE) return;
    color.set(start, GRAY);
    // 栈帧：[节点, 下一条待访问出边的下标]
    const stack = [[start, 0]];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const outs = outEdgeIdx.get(frame[0]);
      if (frame[1] >= outs.length) {
        color.set(frame[0], BLACK);
        stack.pop();
        continue;
      }
      const ei = outs[frame[1]];
      frame[1] += 1;
      const to = edges[ei].target;
      const c = color.get(to);
      if (c === GRAY) {
        // 指向搜索栈上的祖先 ⇒ 回边（自环已在 normalizeLinks 剔除）
        reversed[ei] = true;
      } else if (c === WHITE) {
        color.set(to, GRAY);
        stack.push([to, 0]);
      }
      // BLACK：前向边 / 交叉边，方向保留（按 DFS 结束时间排序仍是有向无环的）
    }
  });
  return reversed;
}

/**
 * 构建瀑布拓扑
 * @param {Array<{source:string,target:string}>} links normalizeLinks 的输出
 * @param {Object} [options]
 * @param {number} [options.colGap]   层内水平间距（世界单位）
 * @param {number} [options.layerGap] 层间垂直间距（世界单位）
 * @param {number} [options.curveness] 边曲率（正数，实际符号按方向分配）
 * @returns {{
 *   nodes: Array<{id:string,layer:number,degree:number,inDegree:number,outDegree:number,x:number,y:number,isRoot:boolean}>,
 *   edges: Array<{source:string,target:string,depth:number,back:boolean,curveness:number}>,  // depth=跨层数，back=分层时被反向的回边
 *   layerCount:number, maxLayerSize:number, width:number, height:number,
 *   centerX:number, centerY:number
 * }}
 */
export function buildTopology(links, options = {}) {
  const opts = {
    colGap: 150,
    layerGap: 120,
    curveness: 0.14,
    ...options,
  };
  const list = Array.isArray(links) ? links : [];

  // ---------- 1. 节点集合与邻接表（保持首次出现顺序） ----------
  const nodeIds = [];
  const idSet = new Set();
  const outMap = new Map(); // id -> target[]
  const inMap = new Map(); // id -> source[]
  const ensure = (id) => {
    if (idSet.has(id)) return;
    idSet.add(id);
    nodeIds.push(id);
    outMap.set(id, []);
    inMap.set(id, []);
  };
  list.forEach((e) => {
    ensure(e.source);
    ensure(e.target);
    outMap.get(e.source).push(e.target);
    inMap.get(e.target).push(e.source);
  });

  if (!nodeIds.length) {
    return {
      nodes: [],
      edges: [],
      layerCount: 0,
      maxLayerSize: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  // 连带附加字段一起复制的浅拷贝：desc 这类描述要一路带到绘制层（悬浮连线时展示）
  const edges = list.map((e) => ({ ...e }));
  const outEdgeIdx = new Map(nodeIds.map((id) => [id, []]));
  edges.forEach((e, i) => outEdgeIdx.get(e.source).push(i));

  // ---------- 2. 破环：回边在分层时按反向计入 ----------
  const reversed = markBackEdges(nodeIds, edges, outEdgeIdx);
  const dagOut = new Map(nodeIds.map((id) => [id, []]));
  const dagIn = new Map(nodeIds.map((id) => [id, []]));
  edges.forEach((e, i) => {
    const u = reversed[i] ? e.target : e.source;
    const v = reversed[i] ? e.source : e.target;
    dagOut.get(u).push(v);
    dagIn.get(v).push(u);
  });

  // ---------- 3. Kahn 最长路径分层（去回边后必为 DAG，所有节点都会被处理） ----------
  const depth = new Map();
  const indeg = new Map();
  nodeIds.forEach((id) => {
    depth.set(id, 0);
    indeg.set(id, dagIn.get(id).length);
  });
  const roots = nodeIds.filter((id) => indeg.get(id) === 0);
  const queue = roots.slice();
  let head = 0;
  while (head < queue.length) {
    const u = queue[head];
    head += 1;
    const d = depth.get(u) + 1;
    dagOut.get(u).forEach((v) => {
      if (depth.get(v) < d) depth.set(v, d);
      const left = indeg.get(v) - 1;
      indeg.set(v, left);
      if (left === 0) queue.push(v);
    });
  }
  let maxDepth = 0;
  depth.forEach((d) => {
    if (d > maxDepth) maxDepth = d;
  });
  const layerCount = maxDepth + 1;

  // ---------- 4. 分层 + 层内两轮重心法排序 ----------
  const layers = [];
  for (let i = 0; i < layerCount; i += 1) layers.push([]);
  nodeIds.forEach((id) => layers[depth.get(id)].push(id));
  const slotOf = new Map(); // id -> 层内水平序号（可为小数，居中在 0 两侧）
  const assignSlots = () => {
    layers.forEach((layer) => {
      layer.forEach((id, i) => slotOf.set(id, i - (layer.length - 1) / 2));
    });
  };
  // 邻居重心的均值（邻居不在同层时忽略）
  const bary = (id, neighbors) => {
    let sum = 0;
    let n = 0;
    neighbors.forEach((nb) => {
      const s = slotOf.get(nb);
      if (s == null) return;
      sum += s;
      n += 1;
    });
    return n ? sum / n : 0;
  };
  assignSlots();
  // 4a. 按父节点重心（上层 → 下层）
  for (let i = 1; i < layerCount; i += 1) {
    layers[i].sort((a, b) => bary(a, dagIn.get(a)) - bary(b, dagIn.get(b)));
    assignSlots();
  }
  // 4b. 按子节点重心（下层 → 上层）
  for (let i = layerCount - 2; i >= 0; i -= 1) {
    layers[i].sort((a, b) => bary(a, dagOut.get(a)) - bary(b, dagOut.get(b)));
    assignSlots();
  }
  assignSlots();

  const maxLayerSize = layers.reduce((m, l) => Math.max(m, l.length), 0);

  // ---------- 5. 世界坐标（与画布尺寸无关，渲染时再等比映射） ----------
  const nodes = nodeIds.map((id) => ({
    id,
    layer: depth.get(id),
    degree: outMap.get(id).length + inMap.get(id).length,
    inDegree: inMap.get(id).length,
    outDegree: outMap.get(id).length,
    x: slotOf.get(id) * opts.colGap,
    y: depth.get(id) * opts.layerGap,
    isRoot: indeg.get(id) === 0 && depth.get(id) === 0,
  }));

  const outEdges = edges.map((e, i) => {
    const from = depth.get(e.source);
    const to = depth.get(e.target);
    return {
      // 先摊开原始链路（desc 等附加字段），再用下面算出来的字段覆盖
      ...e,
      source: e.source,
      target: e.target,
      // 跨层数（负数代表向上回连，画的时候仍然按原方向画）
      depth: to - from,
      back: reversed[i],
      // 曲率符号按字典序分配：双向边自动分离；正负公式与 echarts 的控制点算法一致
      curveness: e.source < e.target ? opts.curveness : -opts.curveness,
    };
  });

  const halfW = ((maxLayerSize - 1) / 2) * opts.colGap + opts.colGap * 0.5;
  const centerY = (layerCount - 1) * 0.5 * opts.layerGap;
  const height = (layerCount - 1) * opts.layerGap + opts.layerGap * 0.6;
  return {
    nodes,
    edges: outEdges,
    layerCount,
    maxLayerSize,
    width: halfW * 2,
    height,
    centerX: 0,
    centerY,
  };
}
