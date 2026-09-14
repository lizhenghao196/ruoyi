/**
 * 编排页面 Mock 数据
 * 后续接入真实接口时，替换为 src/api/tool/orchestration.js 即可，字段保持不变
 */

// 环境
export const environments = [
  { key: 'sandbox', name: '沙箱', code: 'SANDBOX', desc: '变更预演' },
  { key: 'prod', name: '生产', code: 'PROD', desc: '生产环境' },
  { key: 'dr', name: '灾备', code: 'DR', desc: '灾备环境' },
  { key: 'itsm', name: 'ITSM', code: 'ITSM', desc: '流程审批' }
]

// 节点状态：done 已完成 / running 进行中 / waiting 待执行 / failed 失败
// 节点类型：auto 自动 / manual 人工 / approve 审批 / check 校验
export const flows = [
  {
    id: 'prod-app-release',
    envKey: 'prod',
    name: '应用版本发布',
    code: 'APP_RELEASE',
    status: 'running',
    updatedAt: '2026-09-12 10:24',
    nodes: [
      { id: 'n1', name: '变更预检', type: 'check', status: 'done', owner: '张伟', duration: '2min', atomCount: 4, desc: '校验变更窗口、目标实例状态与依赖系统可用性，输出预检报告。' },
      { id: 'n2', name: '变更审批', type: 'approve', status: 'done', owner: '李静', duration: '15min', atomCount: 0, desc: '变更单进入审批环节，由变更管理员确认实施范围与回退方案。' },
      { id: 'n3', name: '制品包下发', type: 'auto', status: 'done', owner: '系统', duration: '3min', atomCount: 6, desc: '从制品库拉取版本包并分发至各机房发布节点，校验 MD5。' },
      { id: 'n4', name: '应用部署', type: 'auto', status: 'running', owner: '系统', duration: '8min', atomCount: 9, desc: '按发布队列依次执行容器发布原子，滚动替换实例。' },
      { id: 'n5', name: '服务健康检查', type: 'check', status: 'waiting', owner: '王强', duration: '5min', atomCount: 3, desc: '检查应用端口、注册中心状态与核心接口连通性。' },
      { id: 'n6', name: '灰度放量', type: 'manual', status: 'waiting', owner: '王强', duration: '10min', atomCount: 2, desc: '按 5% / 20% / 50% 梯度放量，观察交易成功率与响应时间。' },
      { id: 'n7', name: '流量切换', type: 'manual', status: 'waiting', owner: '赵敏', duration: '5min', atomCount: 4, desc: '完成负载均衡权重切换，将全量流量导入新版本。' },
      { id: 'n8', name: '业务校验', type: 'check', status: 'waiting', owner: '系统', duration: '4min', atomCount: 5, desc: '执行核心交易冒烟用例，比对校验报文与账务结果。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '应用版本发布实施手册 V3.2',
        type: 'PDF',
        size: '2.4 MB',
        updatedAt: '2026-09-08',
        content: '1. 实施前置条件\n   - 变更单已审批通过，实施窗口已确认\n   - 制品包已通过安全扫描与灰度验证\n\n2. 实施步骤\n   - 预检：确认目标实例 CPU / 内存水位低于 70%\n   - 下发：制品包分发至 BJ-DB、SH-IDC、GZ-DC 三机房\n   - 部署：按机房串行、实例并行执行滚动发布\n\n3. 注意事项\n   - 单机房部署失败立即中止后续机房并触发回退\n   - 灰度期间需持续观察交易成功率，低于 99.9% 立即回滚'
      },
      {
        id: 'd2',
        title: '生产变更回退方案',
        type: 'DOCX',
        size: '860 KB',
        updatedAt: '2026-09-05',
        content: '回退触发条件：\n  - 健康检查连续 3 次失败\n  - 灰度期间错误率超过 0.5%\n  - 业务校验用例出现资金类失败\n\n回退步骤：\n  1. 停止当前发布队列\n  2. 恢复上一版本镜像并重启实例\n  3. 恢复负载均衡权重\n  4. 通知业务方复核数据一致性'
      },
      {
        id: 'd3',
        title: '发布检查清单（Checklist）',
        type: 'XLSX',
        size: '128 KB',
        updatedAt: '2026-09-02',
        content: '☑ 变更单已审批\n☑ 实施窗口已通知业务\n☑ 回退方案已确认\n☑ 监控告警已屏蔽（实施期间）\n☐ 实施完成后解除告警屏蔽\n☐ 实施结果已归档至 ITSM'
      }
    ]
  },
  {
    id: 'prod-db-change',
    envKey: 'prod',
    name: '数据库变更',
    code: 'DB_CHANGE',
    status: 'waiting',
    updatedAt: '2026-09-11 18:40',
    nodes: [
      { id: 'n1', name: 'SQL 审核', type: 'check', status: 'done', owner: '陈磊', duration: '20min', atomCount: 2, desc: '由 DBA 审核变更 SQL，确认索引使用与执行计划。' },
      { id: 'n2', name: '备库预演', type: 'auto', status: 'done', owner: '系统', duration: '12min', atomCount: 3, desc: '在备库执行变更脚本，验证耗时与锁等待情况。' },
      { id: 'n3', name: '主库变更', type: 'auto', status: 'waiting', owner: '系统', duration: '15min', atomCount: 6, desc: '业务低峰期执行 DDL，全程监控主从延迟。' },
      { id: 'n4', name: '数据校验', type: 'check', status: 'waiting', owner: '陈磊', duration: '8min', atomCount: 4, desc: '比对变更前后记录数与关键字段一致性。' },
      { id: 'n5', name: '主从切换验证', type: 'manual', status: 'waiting', owner: '陈磊', duration: '10min', atomCount: 2, desc: '验证主从复制状态正常，必要时执行切换演练。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '数据库变更规范',
        type: 'PDF',
        size: '1.1 MB',
        updatedAt: '2026-08-28',
        content: '1. 所有 DDL 必须提供回滚脚本\n2. 单表变更涉及数据量超过 500 万行需分批执行\n3. 生产变更仅允许在 22:00 - 06:00 窗口执行\n4. 变更期间需开启慢查询监控'
      },
      {
        id: 'd2',
        title: '本次变更 SQL 清单',
        type: 'SQL',
        size: '24 KB',
        updatedAt: '2026-09-11',
        content: '-- 1. 账户表新增字段\nalter table t_account add column risk_level varchar(16) default \'L0\';\n\n-- 2. 新增索引\ncreate index idx_account_risk on t_account(risk_level);'
      }
    ]
  },
  {
    id: 'prod-network',
    envKey: 'prod',
    name: '网络策略下发',
    code: 'NETWORK_POLICY',
    status: 'waiting',
    updatedAt: '2026-09-10 09:12',
    nodes: [
      { id: 'n1', name: '策略校验', type: 'check', status: 'done', owner: '刘洋', duration: '6min', atomCount: 2, desc: '校验策略变更是否符合安全基线，检查端口开放范围。' },
      { id: 'n2', name: '防火墙下发', type: 'auto', status: 'waiting', owner: '系统', duration: '4min', atomCount: 8, desc: '向各机房防火墙推送策略并确认生效。' },
      { id: 'n3', name: '连通性验证', type: 'auto', status: 'waiting', owner: '系统', duration: '5min', atomCount: 3, desc: '逐条拨测策略涉及的源目地址连通性。' },
      { id: 'n4', name: '策略归档', type: 'manual', status: 'waiting', owner: '刘洋', duration: '3min', atomCount: 1, desc: '将本次策略变更归档至网络台账。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '网络策略变更申请单',
        type: 'PDF',
        size: '540 KB',
        updatedAt: '2026-09-10',
        content: '申请机房：BJ-DB、SH-IDC\n开通方向：应用区 -> 数据区\n目标端口：3306、6379\n有效期：长期'
      }
    ]
  },
  {
    id: 'sandbox-app-release',
    envKey: 'sandbox',
    name: '应用版本预演',
    code: 'APP_RELEASE_SIM',
    status: 'running',
    updatedAt: '2026-09-12 14:02',
    nodes: [
      { id: 'n1', name: '环境重置', type: 'auto', status: 'done', owner: '系统', duration: '6min', atomCount: 3, desc: '将沙箱环境恢复至基线版本，清理历史数据。' },
      { id: 'n2', name: '制品包下发', type: 'auto', status: 'done', owner: '系统', duration: '2min', atomCount: 4, desc: '下发待预演版本包至沙箱节点。' },
      { id: 'n3', name: '应用部署', type: 'auto', status: 'running', owner: '系统', duration: '5min', atomCount: 6, desc: '在沙箱环境执行部署原子，验证脚本正确性。' },
      { id: 'n4', name: '预演校验', type: 'check', status: 'waiting', owner: '周航', duration: '8min', atomCount: 2, desc: '执行预演用例，输出与生产环境的差异项。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '沙箱预演操作说明',
        type: 'DOCX',
        size: '320 KB',
        updatedAt: '2026-09-01',
        content: '沙箱环境仅用于变更预演，禁止承载业务流量。\n预演完成后需手动触发环境重置，避免残留脏数据影响下次预演。'
      }
    ]
  },
  {
    id: 'sandbox-env-reset',
    envKey: 'sandbox',
    name: '环境重置',
    code: 'ENV_RESET',
    status: 'waiting',
    updatedAt: '2026-09-09 16:30',
    nodes: [
      { id: 'n1', name: '数据清理', type: 'auto', status: 'waiting', owner: '系统', duration: '4min', atomCount: 3, desc: '清空业务库测试数据并重新导入基线数据。' },
      { id: 'n2', name: '配置回滚', type: 'auto', status: 'waiting', owner: '系统', duration: '3min', atomCount: 5, desc: '将配置中心参数回滚至基线版本。' },
      { id: 'n3', name: '环境自检', type: 'check', status: 'waiting', owner: '周航', duration: '5min', atomCount: 2, desc: '执行环境自检脚本，确认各组件状态正常。' }
    ],
    docs: []
  },
  {
    id: 'dr-switch-drill',
    envKey: 'dr',
    name: '灾备切换演练',
    code: 'DR_SWITCH',
    status: 'waiting',
    updatedAt: '2026-09-06 11:20',
    nodes: [
      { id: 'n1', name: '演练报备', type: 'manual', status: 'done', owner: '孙倩', duration: '30min', atomCount: 0, desc: '向业务与监管方报备演练计划与影响范围。' },
      { id: 'n2', name: '数据同步检查', type: 'check', status: 'done', owner: '系统', duration: '10min', atomCount: 2, desc: '检查主备数据同步延迟，确认 RPO 满足要求。' },
      { id: 'n3', name: '停写切换', type: 'manual', status: 'waiting', owner: '孙倩', duration: '8min', atomCount: 1, desc: '停止生产环境写入，等待同步队列清空。' },
      { id: 'n4', name: '灾备拉起', type: 'auto', status: 'waiting', owner: '系统', duration: '12min', atomCount: 7, desc: '在灾备机房启动应用实例并恢复数据卷。' },
      { id: 'n5', name: '业务验证', type: 'check', status: 'waiting', owner: '孙倩', duration: '15min', atomCount: 4, desc: '执行核心交易验证与数据一致性比对。' },
      { id: 'n6', name: '回切生产', type: 'manual', status: 'waiting', owner: '孙倩', duration: '20min', atomCount: 6, desc: '演练完成后回切至生产机房，恢复双向同步。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '灾备切换演练方案',
        type: 'PDF',
        size: '3.1 MB',
        updatedAt: '2026-09-06',
        content: '演练目标：验证灾备机房在 30 分钟内接管核心业务的能力。\nRTO 目标：30 分钟\nRPO 目标：5 分钟\n参与方：运维、DBA、业务、监管'
      },
      {
        id: 'd2',
        title: '演练结果记录表',
        type: 'XLSX',
        size: '96 KB',
        updatedAt: '2026-09-06',
        content: '演练时间 | 切换耗时 | 数据差异 | 结论\n2026-03-18 | 26min | 无 | 通过\n2026-06-20 | 24min | 无 | 通过'
      }
    ]
  },
  {
    id: 'dr-data-sync',
    envKey: 'dr',
    name: '数据同步校验',
    code: 'DATA_SYNC_CHECK',
    status: 'done',
    updatedAt: '2026-09-04 20:15',
    nodes: [
      { id: 'n1', name: '同步延迟检查', type: 'auto', status: 'done', owner: '系统', duration: '5min', atomCount: 2, desc: '检查各同步链路延迟指标是否低于阈值。' },
      { id: 'n2', name: '记录数比对', type: 'auto', status: 'done', owner: '系统', duration: '8min', atomCount: 3, desc: '按表比对主备记录数，输出差异清单。' },
      { id: 'n3', name: '差异修复', type: 'manual', status: 'done', owner: '孙倩', duration: '10min', atomCount: 1, desc: '对差异记录执行补同步并复核。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '数据同步校验报告',
        type: 'PDF',
        size: '740 KB',
        updatedAt: '2026-09-04',
        content: '同步链路：BJ-DB -> DR-BJ\n待比对表：12 张\n差异记录：0 条\n结论：主备数据一致'
      }
    ]
  },
  {
    id: 'itsm-approve',
    envKey: 'itsm',
    name: '变更审批流',
    code: 'CHANGE_APPROVE',
    status: 'running',
    updatedAt: '2026-09-12 09:30',
    nodes: [
      { id: 'n1', name: '变更提单', type: 'manual', status: 'done', owner: '张伟', duration: '10min', atomCount: 0, desc: '提交变更申请，填写实施范围、窗口与回退方案。' },
      { id: 'n2', name: '技术评审', type: 'approve', status: 'done', owner: '李静', duration: '25min', atomCount: 0, desc: '技术负责人评审变更方案的风险与可行性。' },
      { id: 'n3', name: '安全审核', type: 'approve', status: 'running', owner: '刘洋', duration: '20min', atomCount: 2, desc: '安全团队审核变更是否引入安全风险。' },
      { id: 'n4', name: '变更实施', type: 'auto', status: 'waiting', owner: '系统', duration: '-', atomCount: 8, desc: '审批通过后调度编排流程执行实际变更。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '变更管理办法',
        type: 'PDF',
        size: '1.8 MB',
        updatedAt: '2026-07-15',
        content: '一级变更：需变更委员会审批\n二级变更：需技术负责人与安全负责人审批\n三级变更：仅需技术负责人审批\n\n所有变更必须在实施前 1 个工作日完成审批'
      }
    ]
  },
  {
    id: 'itsm-emergency',
    envKey: 'itsm',
    name: '紧急故障处置',
    code: 'EMERGENCY_FIX',
    status: 'waiting',
    updatedAt: '2026-09-07 22:05',
    nodes: [
      { id: 'n1', name: '故障上报', type: 'manual', status: 'done', owner: '值班经理', duration: '5min', atomCount: 0, desc: '确认故障等级并建立应急群组。' },
      { id: 'n2', name: '应急授权', type: 'approve', status: 'done', owner: '孙倩', duration: '8min', atomCount: 0, desc: '授权跳过常规审批直接实施紧急修复。' },
      { id: 'n3', name: '紧急修复', type: 'auto', status: 'waiting', owner: '系统', duration: '10min', atomCount: 5, desc: '执行预置应急原子，快速恢复服务。' },
      { id: 'n4', name: '补单归档', type: 'manual', status: 'waiting', owner: '值班经理', duration: '15min', atomCount: 0, desc: '故障恢复后补齐变更单与故障报告。' }
    ],
    docs: [
      {
        id: 'd1',
        title: '应急故障处置预案',
        type: 'PDF',
        size: '980 KB',
        updatedAt: '2026-08-20',
        content: '故障等级判定：\n  P0：核心业务不可用，10 分钟内响应\n  P1：部分业务受损，30 分钟内响应\n  P2：非核心功能异常，2 小时内响应\n\n应急处置遵循“先恢复、后定位”原则'
      }
    ]
  }
]

// 工单
export const orders = [
  {
    orderId: 'LMP-20260912-0007',
    systemId: 'LMP',
    planName: 'LMP 9 月版本发布',
    status: '待实施',
    executeUserName: 'lizhenghao',
    window: '2026-09-12 22:00 ~ 2026-09-13 02:00',
    totalAtom: 36,
    successAtom: 12,
    reason: '9 月常规版本发布，含账户同步模块改造与风控规则更新',
    createdAt: '2026-09-11 15:20'
  },
  {
    orderId: 'DASP-CHG-20260911-0002',
    systemId: 'DASP',
    planName: 'DASP 数据库扩容',
    status: '审批中',
    executeUserName: 'chenlei',
    window: '2026-09-13 23:00 ~ 2026-09-14 01:00',
    totalAtom: 18,
    successAtom: 0,
    reason: '账户表数据量增长过快，需扩容至 4T 并调整分区策略',
    createdAt: '2026-09-10 10:05'
  },
  {
    orderId: 'PAY-20260909-0005',
    systemId: 'PAY',
    planName: '支付网关网络策略调整',
    status: '预审',
    executeUserName: 'liuyang',
    window: '2026-09-14 22:00 ~ 2026-09-14 23:30',
    totalAtom: 12,
    successAtom: 0,
    reason: '支付网关新增合作方接入，需开通专线访问策略',
    createdAt: '2026-09-09 14:48'
  }
]

// 已编排原子：placements 记录该原子出现在哪些环境 / 流 / 节点上（用于页面标识）
export const atoms = [
  {
    id: 'at1',
    orderId: 'LMP-20260912-0007',
    name: 'audit-log-report.yml',
    module: '审计留痕',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [
      { envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n4' },
      { envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n8' },
      { envKey: 'dr', flowId: 'dr-switch-drill', nodeId: 'n5' },
      { envKey: 'itsm', flowId: 'itsm-approve', nodeId: 'n4' }
    ]
  },
  {
    id: 'at2',
    orderId: 'LMP-20260912-0007',
    name: 'base-image-pull.yml',
    module: '容器发布',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [
      { envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n2' },
      { envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n3' },
      { envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n3' },
      { envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n4' }
    ]
  },
  {
    id: 'at3',
    orderId: 'LMP-20260912-0007',
    name: 'web-image-pull.yml',
    module: '容器发布',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [
      { envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n3' },
      { envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n4' }
    ]
  },
  {
    id: 'at4',
    orderId: 'LMP-20260912-0007',
    name: 'middleware-image-pull.yml',
    module: '容器发布',
    idc: 'SH-IDC',
    status: '已编排',
    placements: [{ envKey: 'dr', flowId: 'dr-switch-drill', nodeId: 'n4' }]
  },
  {
    id: 'at5',
    orderId: 'LMP-20260912-0007',
    name: 'env-baseline-reset.yml',
    module: '环境初始化',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [
      { envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n1' },
      { envKey: 'sandbox', flowId: 'sandbox-env-reset', nodeId: 'n1' }
    ]
  },
  {
    id: 'at6',
    orderId: 'LMP-20260912-0007',
    name: 'config-baseline-apply.yml',
    module: '配置同步',
    idc: 'SH-IDC',
    status: '已编排',
    placements: [
      { envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n1' },
      { envKey: 'sandbox', flowId: 'sandbox-env-reset', nodeId: 'n2' }
    ]
  },
  {
    id: 'at7',
    orderId: 'LMP-20260912-0007',
    name: 'deploy-script-verify.yml',
    module: '部署校验',
    idc: 'SH-IDC',
    status: '已编排',
    placements: [{ envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n3' }]
  },
  {
    id: 'at8',
    orderId: 'LMP-20260912-0007',
    name: 'live-diff-report.yml',
    module: '差异比对',
    idc: 'GZ-DC',
    status: '已编排',
    placements: [{ envKey: 'sandbox', flowId: 'sandbox-app-release', nodeId: 'n4' }]
  },
  {
    id: 'at9',
    orderId: 'LMP-20260912-0007',
    name: 'healthcheck-http.yml',
    module: '健康检查',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [
      { envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n5' },
      { envKey: 'dr', flowId: 'dr-switch-drill', nodeId: 'n5' }
    ]
  },
  {
    id: 'at10',
    orderId: 'LMP-20260912-0007',
    name: 'gray-release-config.yml',
    module: '灰度配置',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n6' }]
  },
  {
    id: 'at11',
    orderId: 'LMP-20260912-0007',
    name: 'lb-weight-switch-cfg.yml',
    module: '流量切换',
    idc: 'SH-IDC',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n7' }]
  },
  {
    id: 'at12',
    orderId: 'LMP-20260912-0007',
    name: 'smoke-trade-case.yml',
    module: '业务校验',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [
      { envKey: 'prod', flowId: 'prod-app-release', nodeId: 'n8' },
      { envKey: 'prod', flowId: 'prod-db-change', nodeId: 'n4' }
    ]
  },
  {
    id: 'at13',
    orderId: 'DASP-CHG-20260911-0002',
    name: 'ddl-audit-report.yml',
    module: '数据库变更',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-db-change', nodeId: 'n1' }]
  },
  {
    id: 'at14',
    orderId: 'DASP-CHG-20260911-0002',
    name: 'ddl-execute-master.yml',
    module: '数据库变更',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-db-change', nodeId: 'n3' }]
  },
  {
    id: 'at15',
    orderId: 'DASP-CHG-20260911-0002',
    name: 'ddl-rehearse-slave.yml',
    module: '数据库变更',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-db-change', nodeId: 'n2' }]
  },
  {
    id: 'at16',
    orderId: 'LMP-20260912-0007',
    name: 'sync-lag-probe.yml',
    module: '同步延迟检查',
    idc: 'GZ-DC',
    status: '已编排',
    placements: [
      { envKey: 'dr', flowId: 'dr-data-sync', nodeId: 'n1' },
      { envKey: 'dr', flowId: 'dr-switch-drill', nodeId: 'n2' }
    ]
  },
  {
    id: 'at17',
    orderId: 'LMP-20260912-0007',
    name: 'dr-app-bootstrap.yml',
    module: '灾备拉起',
    idc: 'DR-BJ',
    status: '已编排',
    placements: [
      { envKey: 'dr', flowId: 'dr-switch-drill', nodeId: 'n4' },
      { envKey: 'dr', flowId: 'dr-switch-drill', nodeId: 'n6' }
    ]
  },
  {
    id: 'at18',
    orderId: 'LMP-20260912-0007',
    name: 'security-scan-report.yml',
    module: '安全审核',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'itsm', flowId: 'itsm-approve', nodeId: 'n3' }]
  },
  {
    id: 'at19',
    orderId: 'LMP-20260912-0007',
    name: 'emergency-hotfix-pkg.yml',
    module: '紧急修复',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'itsm', flowId: 'itsm-emergency', nodeId: 'n3' }]
  },
  {
    id: 'at20',
    orderId: 'PAY-20260909-0005',
    name: 'network-policy-push.yml',
    module: '网络策略',
    idc: 'BJ-DB',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-network', nodeId: 'n2' }]
  },
  {
    id: 'at21',
    orderId: 'PAY-20260909-0005',
    name: 'firewall-conn-test.yml',
    module: '连通性校验',
    idc: 'SH-IDC',
    status: '已编排',
    placements: [{ envKey: 'prod', flowId: 'prod-network', nodeId: 'n3' }]
  },
  {
    id: 'at22',
    orderId: 'DASP-CHG-20260911-0002',
    name: 'db-record-compare.yml',
    module: '数据校验',
    idc: 'SH-IDC',
    status: '已编排',
    placements: [
      { envKey: 'dr', flowId: 'dr-data-sync', nodeId: 'n2' },
      { envKey: 'prod', flowId: 'prod-db-change', nodeId: 'n4' }
    ]
  }
]

// 未分配原子（按工单归属，尚未编排到流程节点上，即没有 placements）
export const unassignedAtoms = [
  { id: 'a1', orderId: 'LMP-20260912-0007', name: 'app-deploy-base_v2.yml', module: '容器发布', idc: 'BJ-DB', status: '待实施' },
  { id: 'a2', orderId: 'LMP-20260912-0007', name: 'app-deploy-web_v2.yml', module: '容器发布', idc: 'BJ-DB', status: '待实施' },
  { id: 'a3', orderId: 'LMP-20260912-0007', name: 'lmp-group-sync-db_arm.yml', module: '配置同步', idc: 'SH-IDC', status: '待实施' },
  { id: 'a4', orderId: 'LMP-20260912-0007', name: 'redis-cluster-sync.yml', module: '缓存同步', idc: 'GZ-DC', status: '待实施' },
  { id: 'a5', orderId: 'LMP-20260912-0007', name: 'db-migration-master.yml', module: '数据迁移', idc: 'BJ-DB', status: '待实施' },
  { id: 'a6', orderId: 'LMP-20260912-0007', name: 'monitor-agent-config.yml', module: '监控配置', idc: 'SH-IDC', status: '待实施' },
  { id: 'a7', orderId: 'LMP-20260912-0007', name: 'lmp-network-backup.yml', module: '网络策略', idc: 'GZ-DC', status: '待实施' },
  { id: 'a8', orderId: 'LMP-20260912-0007', name: 'pre-check-config.yml', module: '变更预检', idc: 'BJ-DB', status: '待实施' },
  { id: 'a9', orderId: 'LMP-20260912-0007', name: 'smoke-case-runner.yml', module: '业务校验', idc: 'BJ-DB', status: '待实施' },
  { id: 'a10', orderId: 'LMP-20260912-0007', name: 'lb-weight-switch.yml', module: '流量切换', idc: 'SH-IDC', status: '待实施' },
  { id: 'a11', orderId: 'DASP-CHG-20260911-0002', name: 'db-expand-tablespace.yml', module: '数据库变更', idc: 'BJ-DB', status: '待实施' },
  { id: 'a12', orderId: 'DASP-CHG-20260911-0002', name: 'db-partition-rebuild.yml', module: '数据库变更', idc: 'BJ-DB', status: '待实施' },
  { id: 'a13', orderId: 'DASP-CHG-20260911-0002', name: 'db-slave-lag-check.yml', module: '数据校验', idc: 'BJ-YZ', status: '待实施' },
  { id: 'a14', orderId: 'DASP-CHG-20260911-0002', name: 'db-backup-snapshot.yml', module: '备份', idc: 'BJ-DB', status: '待实施' },
  { id: 'a15', orderId: 'DASP-CHG-20260911-0002', name: 'db-index-rebuild.yml', module: '数据库变更', idc: 'SH-IDC', status: '待实施' },
  { id: 'a16', orderId: 'PAY-20260909-0005', name: 'pay-gw-firewall-policy.yml', module: '网络策略', idc: 'BJ-DB', status: '待实施' },
  { id: 'a17', orderId: 'PAY-20260909-0005', name: 'pay-gw-route-check.yml', module: '连通性校验', idc: 'GZ-DC', status: '待实施' },
  { id: 'a18', orderId: 'PAY-20260909-0005', name: 'pay-gw-cert-renew.yml', module: '证书管理', idc: 'BJ-DB', status: '待实施' }
]
