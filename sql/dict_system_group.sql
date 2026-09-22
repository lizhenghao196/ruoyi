-- ----------------------------
-- 系统组别字典 dict_system_group
--
-- 用途：告警分析页（views/tool/alarmAnalysis）「系统 ID」输入框后面的「组别」下拉框。
--       选中的值作为请求参数 `teamName` 传给接口，默认「不限定组别」。
--
-- ⚠️ 本字典 **label 与 value 完全相同**（都是中文文案本身）。
--    所以前端 el-select 绑定的值就是中文，`teamName` 的默认值直接写 '不限定组别'
--    就能和第一项对上 —— 别把 value 改成拼音/英文码，那样默认值会对不上。
--
-- 注意：不写 dict_id / dict_code，交给自增，这样脚本可以原样搬到其它环境执行。
--       脚本可重复执行（先删同类型数据再插）。
-- ----------------------------

delete from sys_dict_data where dict_type = 'dict_system_group';
delete from sys_dict_type where dict_type = 'dict_system_group';

insert into sys_dict_type (dict_name, dict_type, status, create_by, create_time, remark)
values ('系统组别', 'dict_system_group', '0', 'admin', sysdate(), '告警分析页系统组别下拉；label 与 value 相同');

insert into sys_dict_data (dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark) values
(0, '不限定组别', '不限定组别', 'dict_system_group', '', '', 'Y', '0', 'admin', sysdate(), '默认项，与前端 teamName 默认值一致'),
(1, '全量',       '全量',       'dict_system_group', '', '', 'N', '0', 'admin', sysdate(), ''),
(2, '基础平台域', '基础平台域', 'dict_system_group', '', '', 'N', '0', 'admin', sysdate(), '');
