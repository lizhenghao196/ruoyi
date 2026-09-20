-- ----------------------------
-- 发布执行状态字典（无样式版）
--
-- 用途：执行页面（views/tool/execPage）的「流状态」与「节点状态」文案来源。
--       "_no_css" 表示本字典只提供「键值 -> 标签」的映射，不带 css_class / list_class，
--       具体配色由前端按状态语义自行决定（见 flowLayout.js 的 statusTone）。
--
-- 节点样式分组（前端 statusTone 的 7 个 tone）：
--   init    初始化 / 待开始 / 已提交          —— 还没开始，中性灰
--   run     执行中 / 依赖等待 / 异步验证执行   —— 进行中，蓝
--   ok      执行成功                        —— 绿
--   bad     执行失败 / 异步验证异常           —— 红
--   confirm 结果待确认 / 依赖确认 / 部分成功    —— 需要人介入，琥珀
--   stop    挂起                            —— 紫
--   cancel  执行取消 / 跳过                  —— 灰
--
-- 注意：不写 dict_id / dict_code，交给自增，这样脚本可以原样搬到其它环境执行。
--       脚本可重复执行（先删同类型数据再插）。
-- ----------------------------

delete from sys_dict_data where dict_type = 'release_execute_status_no_css';
delete from sys_dict_type where dict_type = 'release_execute_status_no_css';

insert into sys_dict_type (dict_name, dict_type, status, create_by, create_time, remark)
values ('发布执行状态（无样式）', 'release_execute_status_no_css', '0', 'admin', sysdate(), '执行页面流/节点状态字典，不带样式，配色由前端决定');

insert into sys_dict_data (dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark) values
(0, '初始化',       'INIT',           'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：init'),
(0, '待开始',       'READY',          'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：init'),
(0, '已提交',       'SUBMIT',         'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：init'),
(0, '执行中',       'RUNNING',        'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：run'),
(0, '依赖等待',     'DEPEND_WAIT',    'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：run'),
(0, '异步验证执行', 'VERIFY_EXEC',    'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：run'),
(0, '结果待确认',   'CONFIRM',        'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：confirm'),
(0, '依赖确认',     'DEPEND_CONFIRM', 'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：confirm'),
(0, '执行成功',     'SUCCESS',        'release_execute_status_no_css', '', '', 'Y', '0', 'admin', sysdate(), '节点样式：ok'),
(0, '部分成功',     'INCOM_SUCCESS',  'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：confirm'),
(0, '执行失败',     'FAILED',         'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：bad'),
(0, '异步验证异常', 'VERIFY_FAIL',    'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：bad'),
(0, '挂起',         'STOP',           'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：stop'),
(0, '执行取消',     'CANCELLED',      'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：cancel'),
(0, '跳过',         'SKIP',           'release_execute_status_no_css', '', '', 'N', '0', 'admin', sysdate(), '节点样式：cancel');


-- ----------------------------
-- 发布执行状态字典（带样式版）
--
-- 用途：「查看明细」弹窗里原子状态列，用 dict-tag 直接渲染。
--
-- 和上面那个 no_css 版是**两套独立字典**，各管一摊，不要合并：
--   release_execute_status_no_css   执行页面的流 / 节点状态。文案来自字典，配色由前端
--                                   flowLayout.js 的 statusTone 决定（7 个 tone），
--                                   所以字典里刻意留空 list_class / css_class。
--   release_execute_status          明细弹窗的原子状态。配色直接由 list_class 决定，
--                                   必须填 —— DictTag 的规则是
--                                   listClass 为空/'default' 且 cssClass 为空时渲染**纯文本**，
--                                   留空会让状态退化成没有颜色的文字。
--
-- list_class 取值对齐 Element UI el-tag（primary 会被 DictTag 映射成默认蓝）：
--   info     中性灰：初始化 / 待开始 / 已提交 / 执行取消 / 跳过
--   primary  蓝    ：执行中 / 依赖等待
--   warning  琥珀  ：结果待确认 / 部分成功 / 重试中 / 挂起
--   success  绿    ：执行成功
--   danger   红    ：执行失败
--
-- ⚠️ 本字典 13 项，与 no_css 版（15 项）**对不齐**：
--     少 VERIFY_EXEC（异步验证执行）/ DEPEND_CONFIRM（依赖确认）
--     多 RETRY（重试中）
--    这三个值在明细表里会因为字典缺项而显示成原始枚举值。
--    要不要补全，等和后端确认这两套字典是不是同一个来源再定。
--
-- 同样不写 dict_id / dict_code，可重复执行。
-- ----------------------------

delete from sys_dict_data where dict_type = 'release_execute_status';
delete from sys_dict_type where dict_type = 'release_execute_status';

insert into sys_dict_type (dict_name, dict_type, status, create_by, create_time, remark)
values ('发布执行状态', 'release_execute_status', '0', 'admin', sysdate(), '查看明细弹窗原子状态字典，带样式（list_class 决定 el-tag 配色）');

insert into sys_dict_data (dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark) values
(0,  '初始化',     'INIT',          'release_execute_status', '', 'info',    'N', '0', 'admin', sysdate(), '中性灰'),
(1,  '待开始',     'READY',         'release_execute_status', '', 'info',    'N', '0', 'admin', sysdate(), '中性灰'),
(2,  '已提交',     'SUBMIT',        'release_execute_status', '', 'info',    'N', '0', 'admin', sysdate(), '中性灰'),
(3,  '执行中',     'RUNNING',       'release_execute_status', '', 'primary', 'N', '0', 'admin', sysdate(), '蓝'),
(4,  '依赖等待',   'DEPEND_WAIT',   'release_execute_status', '', 'primary', 'N', '0', 'admin', sysdate(), '蓝'),
(5,  '重试中',     'RETRY',         'release_execute_status', '', 'warning', 'N', '0', 'admin', sysdate(), '琥珀'),
(6,  '结果待确认', 'CONFIRM',       'release_execute_status', '', 'warning', 'N', '0', 'admin', sysdate(), '琥珀'),
(7,  '部分成功',   'INCOM_SUCCESS', 'release_execute_status', '', 'warning', 'N', '0', 'admin', sysdate(), '琥珀'),
(8,  '挂起',       'STOP',          'release_execute_status', '', 'warning', 'N', '0', 'admin', sysdate(), '琥珀'),
(9,  '执行成功',   'SUCCESS',       'release_execute_status', '', 'success', 'Y', '0', 'admin', sysdate(), '绿'),
(10, '执行失败',   'FAILED',        'release_execute_status', '', 'danger',  'N', '0', 'admin', sysdate(), '红'),
(11, '执行取消',   'CANCELLED',     'release_execute_status', '', 'info',    'N', '0', 'admin', sysdate(), '中性灰'),
(12, '跳过',       'SKIP',          'release_execute_status', '', 'info',    'N', '0', 'admin', sysdate(), '中性灰');
