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
        data.put("ACT", system(env(0, 0, 7992), env(5, 5, 9511), env(2, 0, 9518), null,
                status(STATUS_ERROR), status(STATUS_INSPECTED), status(STATUS_INSPECTED), status(STATUS_INSPECTED)));
        data.put("AUTH", system(env(0, 0, 7985), null, null, null,
                status(STATUS_INSPECTED), null, null, null));
        data.put("DASP", system(env(26, 0, 9413), null, env(4, 2, 9414), env(3, 1, 9415),
                status(STATUS_INSPECTED), null, null, null));
        data.put("PAY", system(env(145, 0, 10848), env(18, 4, 10849), null, null,
                status(STATUS_INSPECTED), null, null, null));
        data.put("BILLING", system(env(62, 19, 11001), env(0, 0, 11002), null, env(5, 0, 11003),
                status(STATUS_INSPECTED), null, null, null));
        data.put("EMPTY", system(env(0, 0, 0), null, null, null,
                status(STATUS_INSPECTED), null, null, null));
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
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("nodeIds", new ArrayList<Integer>());
        item.put("total", total);
        item.put("finished", finished);
        item.put("planId", planId);
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
}
