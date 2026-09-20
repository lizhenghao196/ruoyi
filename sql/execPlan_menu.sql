-- 变更执行计划菜单（页面只有一个按钮：汇总 ACT / DASP / AUTH 全部环境的 aripExecPlanId，在新标签页打开执行页面）
-- 页面：ruoyi-ui/src/views/tool/execPlan/index.vue
-- 接口：ruoyi-ui/src/api/tool/execPlan.js（Mock 数据来自 mockData/res.js 的 planRes）
-- 执行后需重新登录（或刷新页面）重新拉取菜单，菜单出现在「系统工具」下
insert into sys_menu values('1070', '变更执行计划', '3', '13', 'execPlan', 'tool/execPlan/index', '', '', 1, 0, 'C', '0', '0', 'tool:execPlan:list', 'job', 'admin', sysdate(), '', null, '变更执行计划菜单');

-- 执行页面菜单（全屏独立页面，仅由「变更执行计划」按钮在新标签页打开，visible=1 不在侧边栏显示）
-- 页面：ruoyi-ui/src/views/tool/execPage/index.vue
-- 全屏展示由前端 store/modules/permission.js 中的 STANDALONE_PATHS 控制
-- 传参：/tool/execPage?ids=<aripExecPlanId 逗号拼接>
insert into sys_menu values('1071', '执行页面', '3', '14', 'execPage', 'tool/execPage/index', '', '', 1, 0, 'C', '1', '0', 'tool:execPage:list', 'tree-table', 'admin', sysdate(), '', null, '执行页面菜单（新标签页全屏打开）');
