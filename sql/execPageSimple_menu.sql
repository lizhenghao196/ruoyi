-- ============================================================================
-- 执行界面简版 —— 菜单（两个页面）
-- ============================================================================
-- 页面一：变更计划列表（侧边栏可见，Element UI 表格）
--   ruoyi-ui/src/views/tool/execPlanList/index.vue
--   接口：ruoyi-ui/src/api/tool/execPageSimple.js 的 getPlanList（mock 数据来自 mockData/res.js 的 planRes）
--
-- 页面二：执行界面简版（**全屏独立页面**，visible=1 不在侧边栏显示，仅由页面一在新标签页打开）
--   ruoyi-ui/src/views/tool/execPageSimple/index.vue
--   全屏展示由前端 store/modules/permission.js 中的 STANDALONE_PATHS 控制
--   传参：/tool/execPageSimple?ids=<aripExecPlanId 逗号拼接>&sys=<系统编码>&envs=<环境信息 JSON>
--
-- 执行后需重新登录（或刷新页面）重新拉取菜单，菜单出现在「系统工具」下。
-- ============================================================================

-- 页面一：变更计划列表
insert into sys_menu values('1073', '变更计划列表', '3', '16', 'execPlanList', 'tool/execPlanList/index', '', '', 1, 0, 'C', '0', '0', 'tool:execPlanList:list', 'list', 'admin', sysdate(), '', null, '变更计划列表菜单（表格 + 查看执行按钮）');

-- 页面二：执行界面简版（全屏独立页面，新标签页打开）
insert into sys_menu values('1074', '执行界面简版', '3', '17', 'execPageSimple', 'tool/execPageSimple/index', '', '', 1, 0, 'C', '1', '0', 'tool:execPageSimple:list', 'tree-table', 'admin', sysdate(), '', null, '执行界面简版菜单（新标签页全屏打开）');
