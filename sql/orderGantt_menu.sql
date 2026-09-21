-- 工单甘特图菜单（页面只有一个按钮：查看；点击后在 element 弹窗里展示甘特图）
-- 页面：ruoyi-ui/src/views/tool/orderGantt/index.vue
-- 组件：ruoyi-ui/src/views/tool/orderGantt/components/OrderGantt.vue
-- 接口：ruoyi-ui/src/api/tool/orderGantt.js（Mock 数据由 mockData/res.js 的 orderRes 扩展生成）
-- 执行后需重新登录（或刷新页面）重新拉取菜单，菜单出现在「系统工具」下
insert into sys_menu values('1072', '工单甘特图', '3', '15', 'orderGantt', 'tool/orderGantt/index', '', '', 1, 0, 'C', '0', '0', 'tool:orderGantt:list', 'time-range', 'admin', sysdate(), '', null, '工单甘特图菜单');
