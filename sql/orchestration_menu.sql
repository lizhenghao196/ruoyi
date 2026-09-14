-- 编排页面菜单（点击菜单后在新浏览器标签页打开，独立全屏，无侧边栏/顶栏/页签栏）
-- 页面：ruoyi-ui/src/views/tool/orchestration/index.vue
-- 打开方式由前端 store/modules/permission.js 中的 STANDALONE_PATHS 控制
insert into sys_menu values('1068', '编排页面', '3', '11', 'orchestration', 'tool/orchestration/index', '', '', 1, 0, 'C', '0', '0', 'tool:orchestration:list', 'tree', 'admin', sysdate(), '', null, '编排页面菜单（新标签页全屏打开）');
