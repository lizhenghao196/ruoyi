package com.ruoyi.web.controller.tool;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;

/**
 * 总览页本地联调接口.
 */
@RestController
@RequestMapping("/tool/overview")
public class OverviewController
{
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final String DATE_TIME_PATTERN = "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}";

    private static final String STATUS_ERROR = "error";

    private static final String STATUS_INSPECTED = "inspected";

    private static final String DEFAULT_STATUS_TIME = "2025-05-20 18:00:00";

    private static final Object MESSAGE_LOCK = new Object();

    private static final AtomicInteger MESSAGE_ID = new AtomicInteger(19500);

    private static final AtomicInteger MESSAGE_APPEND_COUNT = new AtomicInteger(0);

    private static final LocalDateTime BASE_MESSAGE_TIME = LocalDateTime.of(2026, 6, 17, 9, 30, 0);

    private static final List<Map<String, Object>> MESSAGE_ROWS = initMessages();

    @PreAuthorize("@ss.hasPermi('tool:overview:list')")
    @GetMapping("/executions")
    public AjaxResult executions()
    {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("ACT", system(env(0, 0, 7992), env(5, 5, 9511, "1001,1002"), env(2, 0, 9518), null,
                status(STATUS_ERROR), status(STATUS_INSPECTED), status(STATUS_INSPECTED), status(STATUS_INSPECTED)));
        data.put("AUTH", system(env(12, 8, 7985), env(7, 0, 7986), null, env(3, 3, 7987),
                status(STATUS_INSPECTED), status(STATUS_INSPECTED), null, null));
        data.put("DASP", system(env(26, 0, 9413), null, env(4, 2, 9414), env(3, 1, 9415),
                status(STATUS_INSPECTED), null, null, null));
        data.put("PAY", system(env(145, 0, 10848), env(18, 4, 10849), null, null,
                status(STATUS_INSPECTED), null, null, null));
        data.put("BILLING", system(env(62, 19, 11001, "2001"), env(0, 0, 11002), null, env(5, 0, 11003),
                status(STATUS_INSPECTED), null, null, null));
        data.put("SEC", system(env(38, 12, 30110), env(21, 21, 30111, "3001,3002,3003"), null, env(9, 0, 30112),
                status(STATUS_INSPECTED), status(STATUS_INSPECTED), status(STATUS_ERROR), null));
        data.put("AUDIT", system(env(8, 3, 40110), null, env(15, 5, 40111), null,
                status(STATUS_INSPECTED), null, status(STATUS_INSPECTED), status(STATUS_INSPECTED)));
        data.put("MONITOR", system(env(56, 30, 50110, "5001,5002"), env(22, 0, 50111), env(10, 8, 50112), env(4, 4, 50113),
                status(STATUS_INSPECTED), status(STATUS_INSPECTED), status(STATUS_INSPECTED), status(STATUS_INSPECTED)));
        data.put("GATEWAY", system(env(20, 20, 60110), null, env(0, 0, 60111), null,
                status(STATUS_INSPECTED), null, null, null));
        data.put("LOG", system(env(90, 40, 70110), env(14, 7, 70111), env(8, 5, 70112), env(6, 0, 70113),
                status(STATUS_ERROR), status(STATUS_INSPECTED), null, null));
        return AjaxResult.success(data);
    }

    @PreAuthorize("@ss.hasPermi('tool:overview:list')")
    @GetMapping("/messages")
    public TableDataInfo messages(@RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(defaultValue = "false") Boolean appendNew)
    {
        List<Map<String, Object>> rows;
        synchronized (MESSAGE_LOCK)
        {
            if (Boolean.TRUE.equals(appendNew))
            {
                appendNewMessages();
            }
            rows = new ArrayList<>(MESSAGE_ROWS);
        }
        int safePageNum = Math.max(1, pageNum == null ? 1 : pageNum);
        int safePageSize = Math.max(10, pageSize == null ? 10 : pageSize);
        int startIndex = Math.min((safePageNum - 1) * safePageSize, rows.size());
        int endIndex = Math.min(startIndex + safePageSize, rows.size());
        List<Map<String, Object>> pageRows = rows.subList(startIndex, endIndex);
        TableDataInfo rspData = new TableDataInfo();
        rspData.setCode(200);
        rspData.setMsg("查询成功");
        rspData.setRows(pageRows);
        rspData.setTotal(rows.size());
        return rspData;
    }

    private static List<Map<String, Object>> initMessages()
    {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(message(19411, "INFO", "manual", "DASP_合肥机房_通用发布[合肥]", "发布节点", "STOP",
                "发布函数", "即将开始STOP操作", "DASP_failover_2025-09-05", "DASP"));
        rows.add(message(19410, "WARN", "program", "PAY_生产发布", "交易清理节点", "CHECK",
                "巡检函数", "等待前置批次完成", "PAY_prod_2025-09-05", "PAY"));
        rows.add(message(19409, "ERROR", "program", "ACT_沙箱发布", "沙箱校验节点", "ALERT",
                "告警函数", "节点执行超时，请关注", "ACT_sandbox_2025-09-05", "ACT"));
        rows.add(message(19408, "INFO", "manual", "AUTH_生产发布", "人工确认节点", "CONFIRM",
                "确认函数", "人工确认已通过", "AUTH_prod_2025-09-05", "AUTH"));
        rows.add(message(19407, "WARN", "program", "BILLING_生产发布", "账务核对节点", "VERIFY",
                "核对函数", "账务核对耗时偏高", "BILLING_prod_2025-09-05", "BILLING"));
        rows.add(message(19406, "INFO", "program", "PAY_沙箱发布", "沙箱部署节点", "DEPLOY",
                "部署函数", "沙箱部署已完成", "PAY_sandbox_2025-09-05", "PAY"));
        rows.add(message(19405, "INFO", "manual", "ACT_生产发布", "发布审批节点", "APPROVE",
                "审批函数", "发布审批已通过", "ACT_prod_2025-09-05", "ACT"));
        rows.add(message(19404, "WARN", "program", "DASP_ITSM发布", "工单同步节点", "SYNC",
                "同步函数", "ITSM工单同步等待中", "DASP_ITSM_2025-09-05", "DASP"));
        rows.add(message(19403, "INFO", "program", "AUTH_沙箱发布", "配置检查节点", "CHECK",
                "检查函数", "配置检查通过", "AUTH_sandbox_2025-09-05", "AUTH"));
        rows.add(message(19402, "ERROR", "program", "BILLING_合肥发布", "链路检测节点", "ALERT",
                "告警函数", "链路检测异常，请复核", "BILLING_failover_2025-09-05", "BILLING"));
        for (int i = 0; i < 60; i++)
        {
            rows.add(historyMessage(i));
        }
        return rows;
    }

    private static void appendNewMessages()
    {
        int appendBatch = MESSAGE_APPEND_COUNT.incrementAndGet();
        int appendCount = appendBatch % 3 == 0 ? 2 : 1;
        for (int i = 0; i < appendCount; i++)
        {
            int id = MESSAGE_ID.incrementAndGet();
            MESSAGE_ROWS.add(0, liveMessage(id, appendBatch, i));
        }
    }

    private static Map<String, Object> liveMessage(int id, int appendBatch, int index)
    {
        String[] systems = { "DASP", "PAY", "ACT", "AUTH", "BILLING" };
        String system = systems[(appendBatch + index) % systems.length];
        String level = (appendBatch + index) % 5 == 0 ? "ERROR" : ((appendBatch + index) % 2 == 0 ? "WARN" : "INFO");
        String type = (appendBatch + index) % 2 == 0 ? "program" : "manual";
        String env = (appendBatch + index) % 3 == 0 ? "failover" : ((appendBatch + index) % 3 == 1 ? "prod" : "sandbox");
        String envName = "prod".equals(env) ? "生产" : ("sandbox".equals(env) ? "沙箱" : "合肥");
        String action = "ERROR".equals(level) ? "执行失败，等待处理" : ("WARN".equals(level) ? "发现新的等待批次" : "发现新的执行状态");
        Map<String, Object> item = messageAt(id, level, type, system + "_" + envName + "发布", "发布复核节点", "EXECUTE",
                "发布函数", action + " #" + appendBatch + "-" + (index + 1), system + "_" + env + "_2025-09-05", system,
                LocalDateTime.now().plusSeconds(index));
        item.put("aripExecEnv", env);
        return item;
    }

    private static Map<String, Object> historyMessage(int index)
    {
        String[] systems = { "DASP", "PAY", "ACT", "AUTH", "BILLING" };
        String[] envs = { "prod", "sandbox", "failover", "ITSM" };
        String[] envNames = { "生产", "沙箱", "合肥", "ITSM" };
        String[] nodes = { "发布检查节点", "配置同步节点", "制品校验节点", "工单确认节点", "数据库复核节点", "回滚预案节点" };
        String[] messages = { "等待执行窗口", "前置检查完成", "制品包校验通过", "批次进入排队", "人工复核完成", "环境状态同步完成" };
        String system = systems[index % systems.length];
        String env = envs[index % envs.length];
        String envName = envNames[index % envNames.length];
        String level = index % 11 == 0 ? "ERROR" : (index % 4 == 0 ? "WARN" : "INFO");
        String type = index % 3 == 0 ? "manual" : "program";
        int id = 19401 - index;
        Map<String, Object> item = message(id, level, type, system + "_" + envName + "发布", nodes[index % nodes.length],
                index % 2 == 0 ? "CHECK" : "SYNC", index % 2 == 0 ? "检查函数" : "同步函数",
                messages[index % messages.length], system + "_" + env + "_2025-09-05", system);
        item.put("aripExecEnv", env);
        return item;
    }

    private Map<String, Object> system(Map<String, Object> prod, Map<String, Object> sandbox, Map<String, Object> failover,
            Map<String, Object> itsm, Map<String, Object> alert, Map<String, Object> fullLink,
            Map<String, Object> impact, Map<String, Object> logCloud)
    {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("prod", prod);
        item.put("sandbox", sandbox);
        item.put("failover", failover);
        item.put("ITSM", itsm);
        item.put("alert", normalizeStatus(alert));
        item.put("fullLink", normalizeStatus(fullLink));
        item.put("impact", normalizeStatus(impact));
        item.put("logCloud", normalizeStatus(logCloud));
        return item;
    }

    private Map<String, Object> env(int total, int finished, int planId)
    {
        return env(total, finished, planId, null);
    }

    private Map<String, Object> env(int total, int finished, int planId, String nodeIds)
    {
        Map<String, Object> item = new LinkedHashMap<>();
        if (nodeIds != null && !nodeIds.trim().isEmpty())
        {
            item.put("nodeIds", nodeIds);
        }
        else
        {
            item.put("nodeIds", new ArrayList<Integer>());
        }
        item.put("total", total);
        item.put("finished", finished);
        item.put("planId", planId);
        // 环境操作状态字段：根据 total / finished 区分激活状态
        if (total == 0)
        {
            item.put("activateOpr", "未激活");
            item.put("auditOpr", "待审核");
            item.put("checkOpr", "待检查");
            item.put("collectOpr", "待采集");
        }
        else if (finished == 0)
        {
            item.put("activateOpr", "待激活");
            item.put("auditOpr", "待审核");
            item.put("checkOpr", "待检查");
            item.put("collectOpr", "待采集");
        }
        else if (finished < total)
        {
            item.put("activateOpr", "已激活");
            item.put("auditOpr", "审核中");
            item.put("checkOpr", "检查中");
            item.put("collectOpr", "采集中");
        }
        else
        {
            item.put("activateOpr", "已激活");
            item.put("auditOpr", "已审核");
            item.put("checkOpr", "已检查");
            item.put("collectOpr", "已采集");
        }
        return item;
    }

    private Map<String, Object> status(String status)
    {
        Map<String, Object> item = new HashMap<>();
        item.put("status", status);
        item.put("time", DEFAULT_STATUS_TIME);
        return item;
    }

    private Map<String, Object> normalizeStatus(Map<String, Object> source)
    {
        String sourceStatus = source == null ? null : String.valueOf(source.get("status"));
        String safeStatus = STATUS_ERROR.equals(sourceStatus) ? STATUS_ERROR : STATUS_INSPECTED;
        Object sourceTime = source == null ? null : source.get("time");
        String sourceTimeText = sourceTime == null ? "" : String.valueOf(sourceTime).trim();
        String safeTime = sourceTimeText.matches(DATE_TIME_PATTERN) ? sourceTimeText : DEFAULT_STATUS_TIME;
        Map<String, Object> item = new HashMap<>();
        item.put("status", safeStatus);
        item.put("time", safeTime);
        return item;
    }

    private static Map<String, Object> message(int id, String level, String type, String flowName, String nodeName,
            String atomName, String functionName, String message, String planName, String system)
    {
        return messageAt(id, level, type, flowName, nodeName, atomName, functionName, message, planName, system,
                BASE_MESSAGE_TIME.plusSeconds(id - 19400));
    }

    private static Map<String, Object> messageAt(int id, String level, String type, String flowName, String nodeName,
            String atomName, String functionName, String message, String planName, String system, LocalDateTime time)
    {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("createBy", "admin");
        item.put("createTime", time.format(DATE_TIME_FORMATTER));
        item.put("updateBy", "");
        item.put("updateTime", time.format(DATE_TIME_FORMATTER));
        item.put("aaiAtomName", atomName);
        item.put("aaiInstanceAtomId", null);
        item.put("aniInstanceNodeId", null);
        item.put("aniInstanceNodeName", nodeName);
        item.put("apemFunctionName", functionName);
        item.put("apemId", id);
        item.put("apemMessageJson", null);
        item.put("apemMessageLevel", level);
        item.put("apemMessageStr", message);
        item.put("apemMessageType", type);
        item.put("aripExecDate", "2025-09-05");
        item.put("aripExecEnv", planName.contains("failover") ? "failover" : "prod");
        item.put("aripExecPlanId", 9406);
        item.put("aripExecPlanName", planName);
        item.put("aripExecSys", system);
        item.put("awiWorkflowInstanceId", 18527);
        item.put("awiWorkflowInstanceName", flowName);
        item.put("remark", "");
        return item;
    }

    @PreAuthorize("@ss.hasPermi('tool:overview:list')")
    @GetMapping("/cicdImplement")
    public AjaxResult cicdImplement()
    {
        return AjaxResult.success(buildCicdMockData());
    }

    private List<Map<String, Object>> buildCicdMockData()
    {
        List<Map<String, Object>> list = new ArrayList<>();

        list.add(cicdOrder("LMP-20260623-0001", "预审", 21, 0, 21, 0, "zhouke_kzx",
                buildMultiDetail(
                    cicdDetail("BJ-DB", "configQueueItemList", "lmp-group-sync-db_arm.yml", "未开始"),
                    cicdDetail("BJ-DB", "configQueueItemList", "lmp-group-sync-cache.yml", "未开始"),
                    cicdDetail("SH-IDC", "deployService", "app-deploy-base_v2.yml", "未开始"),
                    cicdDetail("SH-IDC", "deployService", "app-deploy-web_v2.yml", "未开始"),
                    cicdDetail("GZ-DC", "networkQueues", "lmp-network-sync.yml", "未开始"),
                    cicdDetail("GZ-DC", "networkQueues", "lmp-network-backup.yml", "未开始"),
                    cicdDetail("BJ-DB", "dbQueues", "db-migration-master.yml", "未开始"),
                    cicdDetail("SH-IDC", "monitorQueues", "monitor-agent-config.yml", "未开始"),
                    cicdDetail("GZ-DC", "cacheQueues", "redis-cluster-sync.yml", "未开始"),
                    cicdDetail("BJ-DB", "resetModule", "reset-script-env.yml", "未开始")
                ),
                cicdAtomDetail("BJ-DB", "containerQueues", "lmp-label-explore", "0-待实施")));

        list.add(cicdOrder("LMP-20260623-0002", "待实施", 35, 12, 35, 10, "wangwei_dev",
                cicdAutoAtomDetail("SH-IDC", "deployService", "app-deploy-config_v2.yml", "进行中"),
                cicdAtomDetail("SH-IDC", "networkQueues", "lmp-network-sync", "1-实施中")));

        list.add(cicdOrder("LMP-20260623-0003", "待重置", 18, 18, 18, 15, "lisi_ops",
                cicdAutoAtomDetail("GZ-DC", "resetModule", "reset-script_v1.yml", "已完成"),
                cicdAtomDetail("GZ-DC", "dbQueues", "db-migration-tool", "2-已完成")));

        list.add(cicdOrder("LMP-20260624-0004", "重置", 42, 30, 42, 28, "zhaoyun_admin",
                new ArrayList<Map<String, Object>>(),
                new ArrayList<Map<String, Object>>()));

        list.add(cicdOrder("LMP-20260624-0005", "预审", 8, 0, 8, 0, "chenliu_test",
                cicdAutoAtomDetail("BJ-DB", "checkModule", "pre-check-config.yml", "未开始"),
                cicdAtomDetail("BJ-DB", "cacheQueues", "redis-refresh-script", "0-待实施")));

        list.add(cicdOrder("LMP-20260625-0006", "待实施", 56, 22, 56, 20, "sunqi_release",
                cicdAutoAtomDetail("SH-IDC", "releaseService", "release-pipeline_v3.yml", "进行中"),
                cicdAtomDetail("SH-IDC", "monitorQueues", "monitor-agent-deploy", "1-实施中")));

        return list;
    }

    private Map<String, Object> cicdOrder(String orderId, String orderStatus,
            int autoTotalAtom, int autoFinishAtom, int totalAtom, int successAtom,
            String executeUserName,
            List<Map<String, Object>> autoAtomDetail,
            List<Map<String, Object>> atomDetail)
    {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("order_id", orderId);
        item.put("order_status", orderStatus);
        item.put("auto_total_atom", autoTotalAtom);
        item.put("auto_finish_atom", autoFinishAtom);
        item.put("total_atom", totalAtom);
        item.put("success_atom", successAtom);
        item.put("executeUserName", executeUserName);
        item.put("auto_atom_detail", autoAtomDetail != null ? autoAtomDetail : new ArrayList<>());
        item.put("atom_detail", atomDetail != null ? atomDetail : new ArrayList<>());
        return item;
    }

    private Map<String, Object> cicdDetail(String idc, String module, String key, String status)
    {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("idc", idc);
        item.put("module", module);
        item.put("key", key);
        item.put("systemDeployStatus", status);
        return item;
    }

    @SafeVarargs
    private final List<Map<String, Object>> buildMultiDetail(Map<String, Object>... details)
    {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> detail : details)
        {
            list.add(detail);
        }
        return list;
    }

    private List<Map<String, Object>> cicdAutoAtomDetail(String idc, String module, String key, String status)
    {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(cicdDetail(idc, module, key, status));
        return list;
    }

    private List<Map<String, Object>> cicdAtomDetail(String idc, String module, String key, String status)
    {
        return cicdAutoAtomDetail(idc, module, key, status);
    }

    @PreAuthorize("@ss.hasPermi('tool:overview:list')")
    @GetMapping("/maintenanceNotice")
    public TableDataInfo maintenanceNotice()
    {
        List<Map<String, Object>> rows = buildMaintenanceNoticeMockData();
        TableDataInfo rspData = new TableDataInfo();
        rspData.setCode(200);
        rspData.setMsg("查询成功");
        rspData.setRows(rows);
        rspData.setTotal(rows.size());
        return rspData;
    }

    private List<Map<String, Object>> buildMaintenanceNoticeMockData()
    {
        List<Map<String, Object>> list = new ArrayList<>();

        list.add(maintenanceNotice(5158, "南去信息&南湾机房管理存储升级以及业务存储管理面升级",
                "管理存储升级以及业务存储管理面升级对业务虚拟机/裸金属无影响",
                "南去信息&南湾机房管理存储升级以及业务存储管理面升级",
                "基础平台组值班",
                "工作日晚班: 李宝华, 工作日白班: 苏琼市",
                "144724872", "1", "谢华娇", "同意",
                "tangwenjun_kzx",
                "2026-06-17 16:07:04", "2026-06-22 17:10:04",
                "2026-06-23 20:00:00", "2026-06-24 06:00:00"));

        list.add(maintenanceNotice(5159, "上海张江机房核心交换机升级通知",
                "张江机房核心交换机固件升级，升级期间业务流量自动切换至备用链路",
                "上海张江机房核心交换机固件升级通知",
                "网络运维组值班",
                "工作日白班: 王建国, 工作日晚班: 陈小明",
                "144724873", "1", "赵审核", "已通过",
                "wangjianguo_ops",
                "2026-06-18 09:00:00", "2026-06-22 14:00:00",
                "2026-06-25 02:00:00", "2026-06-25 06:00:00"));

        list.add(maintenanceNotice(5160, "深圳灾备中心数据库升级维护",
                "灾备中心MySQL集群从5.7升级至8.0，升级期间灾备切换暂停",
                "深圳灾备中心数据库集群升级维护通知",
                "DBA团队值班",
                "工作日晚班: 刘工, 周末白班: 张工",
                "144724874", "0", "", "",
                "liugong_dba",
                "2026-06-19 11:30:00", "2026-06-20 08:00:00",
                "2026-06-27 00:00:00", "2026-06-27 04:00:00"));

        list.add(maintenanceNotice(5161, "北京亦庄机房电力维护通知",
                "亦庄机房A路电力检修，影响A路供电设备，B路正常供电",
                "北京亦庄机房A路电力检修通知",
                "IDC运维组值班",
                "工作日白班: 李运维, 工作日晚班: 张运维",
                "144724875", "2", "周审核", "需补充影响范围说明",
                "liyunwei_idc",
                "2026-06-20 15:00:00", "2026-06-21 10:00:00",
                "2026-06-28 22:00:00", "2026-06-29 02:00:00"));

        list.add(maintenanceNotice(5162, "杭州金融云SSL证书更新",
                "金融云平台SSL证书到期前更新，更新期间需短暂重启网关服务",
                "杭州金融云SSL证书更新维护通知",
                "安全运维组值班",
                "工作日晚班: 钱安全, 工作日白班: 周安全",
                "144724876", "1", "郑审核", "同意更新",
                "qiananquan_sec",
                "2026-06-21 08:00:00", "2026-06-21 16:00:00",
                "2026-06-30 01:00:00", "2026-06-30 03:00:00"));

        return list;
    }

    private Map<String, Object> maintenanceNotice(int informId, String informTitle, String areaContent,
            String informContent, String contactBy, String informDuty, String informUrl,
            String reviewStatus, String reviewer, String reviewComment,
            String createBy, String createTime, String updateTime,
            String startTime, String endTime)
    {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("informId", informId);
        item.put("informTitle", informTitle);
        item.put("areaContent", areaContent);
        item.put("informContent", informContent);
        item.put("contactBy", contactBy);
        item.put("informDuty", informDuty);
        item.put("informUrl", informUrl);
        item.put("reviewStatus", reviewStatus);
        item.put("reviewer", reviewer);
        item.put("reviewComment", reviewComment);
        item.put("createBy", createBy);
        item.put("createTime", createTime);
        item.put("updateTime", updateTime);
        item.put("startTime", startTime);
        item.put("endTime", endTime);
        return item;
    }
}
