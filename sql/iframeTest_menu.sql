-- iframe测试菜单（vue页面内嵌外部网页）
-- 页面：ruoyi-ui/src/views/tool/iframeTest/index.vue，iframe 默认嵌 https://www.baidu.com
-- 如需换嵌入目标：改页面 data.url，或访问 /tool/iframeTest?url=目标地址
insert into sys_menu values('1067', 'iframe测试', '3', '10', 'iframeTest', 'tool/iframeTest/index', '', '', 1, 0, 'C', '0', '0', 'tool:iframeTest:list', 'link', 'admin', sysdate(), '', null, 'iframe测试菜单（vue页面内嵌外部网页）');
