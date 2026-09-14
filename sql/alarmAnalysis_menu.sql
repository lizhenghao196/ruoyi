-- 告警分析菜单
-- 页面：ruoyi-ui/src/views/tool/alarmAnalysis/index.vue
-- 接口：ruoyi-ui/src/api/tool/alarmAnalysis.js（Mock 数据来自 mockData/res.js 的 analyzeRes）
-- 执行后需重新登录（或刷新页面）重新拉取菜单，菜单出现在「系统工具」下
insert into sys_menu values('1069', '告警分析', '3', '12', 'alarmAnalysis', 'tool/alarmAnalysis/index', '', '', 1, 0, 'C', '0', '0', 'tool:alarmAnalysis:list', 'chart', 'admin', sysdate(), '', null, '告警分析菜单');
