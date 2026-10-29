#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工单甘特图 · 「推送到企微」三个字段的 Python 实现
==============================================================================
产出（就是前端 pushExtraStaff 发出去的那个 payload）：

    {
      "date":      "2026-10-27",          # 当天 18:00 → 次日 06:00 窗口的「当天」
      "peopleNum": 2,                     # 额外需要增加的变更支持人数
      "detail": [                         # 五个时间段各一项
        {"time": "18:00 - 20:00", "manualNum": 3, "manualCost": 2.5,
         "manualVal": 0.75, "autoNum": 1, "autoCost": 0.5,
         "autoVal": 0.1, "totalVal": 0.85},
        ...
      ]
    }

⚠️ 这是一份**独立**的实现，不 import 前端、不碰前端代码、不改任何现有文件。
   规则与前端一一对应（前端是唯一权威，改规则请两边一起改）：

     前端文件                                            本文件对应函数
     --------------------------------------------------  ---------------------
     ganttLayout.js  parseTime / startOfDay              parse_time / start_of_day
     ganttLayout.js  buildDayWindow                      build_day_window
     ganttLayout.js  normalizeMode                       normalize_mode
     ganttLayout.js  resolveSpan                         resolve_span
     ganttLayout.js  computeNodeTimeline                 compute_node_timeline
     workloadCalc.js costIntervals / overlapMinutes      cost_intervals / overlap_minutes
     workloadCalc.js calcExtraStaff                      calc_extra_staff
     views/.../OrderGantt.vue handleStaffPush（拼 payload）  build_payload
     api/tool/orderGantt.js getOrderList                 fetch_orders

计算规则（用户原话整理，与 workloadCalc.js 头部注释一致）
   1. 18:00 - 06:00 拆五段：18-20 / 20-22 / 22-24 / 0-2 / 2-6（前四段 2h、末段 4h）；
   2. 每段统计：手动单数 x、手动耗时 y、自动单数 z、自动耗时 a（单位 H）；
      耗时 = **该时间段内的节点耗时**；一个工单跨多个时间段时，各段分别算它落进来的部分；
   3. 手动数值 b = max(x, y) / 4，自动数值 c = max(z, a) / 10，段总分 = b + c；
   4. 逻辑一：五段总分取最大 d，d > 2 起每超过 1 加 1 人 → e（向上取整）；
   5. 逻辑二：有连续 N 段总分 > 1 就加 N - 1 人（N < 2 时为 0）→ f；
   6. 最终人数 g = max(e, f)。

用法
   # 1) 只算不推：date 取今天，工单从后端接口拉
   python order_workload.py

   # 2) 指定日期 / 指定接口
   python order_workload.py --date 2026-10-27 --url http://127.0.0.1:8080/python/api/cicd/orderList

   # 3) 用本地 JSON 文件当数据源（接口还没通时联调用）
   python order_workload.py --orders-file orders.json

   # 4) 内置样例自检（和前端 mock 那 8 条工单完全一致，不需要任何后端）
   python order_workload.py --mock

   # 5) 算完顺手推送到企微
   python order_workload.py --push

   # 6) 给后端调用：直接 import，别走命令行
   from order_workload import build_payload
   payload = build_payload(date="2026-10-27")     # → {date, peopleNum, detail}

只依赖标准库（urllib / json / datetime / argparse），Python 3.7+ 可直接跑。
==============================================================================
"""

import argparse
import json
import math
import re
import sys
from datetime import date as _date
from datetime import datetime, timedelta

# ---------------------------------------------------------------- 常量

#: 五个时间段的划分（相对窗口起点 18:00 的小时数，2+2+2+2+4 = 12 正好铺满窗口）
WORKLOAD_SEGMENTS = [
    {"label": "18:00 - 20:00", "hours": 2},
    {"label": "20:00 - 22:00", "hours": 2},
    {"label": "22:00 - 24:00", "hours": 2},
    {"label": "00:00 - 02:00", "hours": 2},
    {"label": "02:00 - 06:00", "hours": 4},
]

#: 手动数值的分母：max(单数, 耗时) / 4
MANUAL_DIVISOR = 4
#: 自动数值的分母：max(单数, 耗时) / 10
AUTO_DIVISOR = 10
#: 逻辑一阈值：单时段总分超过它才开始算人
PEAK_THRESHOLD = 2
#: 逻辑二阈值：单时段总分超过它才算「超载段」
RUN_THRESHOLD = 1

#: 窗口起点：当天 18:00
WINDOW_START_HOUR = 18
#: 窗口终点：次日 06:00 —— 写成「30 点」直接加在当天 00:00 上，省掉跨天判断
WINDOW_END_HOUR = 30

#: 起止时间都取不到时，矩形按这个宽度兜底（分钟）
DEFAULT_DURATION_MIN = 30

#: 默认接口（与前端 api/tool/orderGantt.js 里的占位路径一致，联调前需确认）
DEFAULT_ORDER_LIST_URL = "http://127.0.0.1:8080/python/api/cicd/orderList"
#: 默认推送接口
DEFAULT_PUSH_URL = "http://127.0.0.1:8080/python/api/cicd/pushStaffToWecom"

#: 时间字符串解析。支持 'YYYY-MM-DD HH:mm:ss' / 'YYYY/MM/DD HH:mm' / 'YYYY-MM-DDTHH:mm:ss'；
#: 日期部分必须有，时间部分可缺省（按 00:00:00）—— 与 ganttLayout.js 的 parseTime 同款正则。
_TIME_RE = re.compile(
    r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?"
)
_DATE_ONLY_RE = re.compile(r"^\d{4}-\d{1,2}-\d{1,2}$")


# ---------------------------------------------------------------- 数值小工具

def js_round(value):
    """JS 的 `Math.round`：.5 一律往 +∞ 进位（Python 的 round 是银行家舍入，会算出不一样的数）。"""
    return math.floor(value + 0.5)


def round2(value):
    """
    保留两位小数 —— 对应 workloadCalc.js 的 `round2`。

    整数结果返回 int：JS 里 `Math.round(0*100)/100` 序列化出来是 `0` 不是 `0.0`，
    这里保持一致，否则推给后端的 JSON 会凭空多出 `.0`。
    """
    r = js_round(float(value) * 100) / 100
    return int(r) if r == int(r) else r


def to_positive_number(value):
    """正数才认；None / '' / 非数字 / <=0 一律 None（对应 ganttLayout.js 的同名函数）。"""
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(n) or n <= 0:
        return None
    return n


# ---------------------------------------------------------------- 时间解析

def parse_time(value):
    """
    把接口给的时间转成 datetime（本地时区、naive）。

    刻意不用 dateutil / 不猜格式：'2026-09-17 22:00:00' 这种带空格、不带时区的格式
    各家实现口径不一，这里用正则自己拆，行为确定 —— 与前端 parseTime 一致。

    :param value: datetime / date / 数字时间戳（秒或毫秒）/ 时间字符串
    :return: datetime 或 None（解析不出来）
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, _date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(value):
            return None
        # 10 位当秒、13 位当毫秒（前端传的是毫秒）
        seconds = value / 1000.0 if abs(value) > 1e11 else float(value)
        try:
            return datetime.fromtimestamp(seconds)
        except (OverflowError, OSError, ValueError):
            return None

    s = str(value).strip()
    if not s:
        return None
    m = _TIME_RE.match(s)
    if not m:
        return None
    try:
        return datetime(
            int(m.group(1)),
            int(m.group(2)),
            int(m.group(3)),
            int(m.group(4) or 0),
            int(m.group(5) or 0),
            int(m.group(6) or 0),
        )
    except ValueError:
        return None


def start_of_day(ts):
    """当天 00:00:00（对应 ganttLayout.js 的 startOfDay）"""
    return ts.replace(hour=0, minute=0, second=0, microsecond=0)


def today_str():
    """今天的 'YYYY-MM-DD' —— date 字段默认值"""
    return _date.today().strftime("%Y-%m-%d")


def build_day_window(date_value=None):
    """
    按日期算出固定窗口 `[当天 18:00, 次日 06:00]`（对应 ganttLayout.js 的 buildDayWindow）。

    「当天」是动态的（今天打开是今天 18:00，明天打开是明天 18:00），
    写死的只有 18 / 06 两个时刻 —— 和甘特图横坐标同一个窗口。

    :param date_value: 'YYYY-MM-DD'；None → 取今天
    :return: (start, end) 或 None（日期解析不出来 —— 别拿坏日期算出一堆 0 骗人）
    """
    if date_value is None or date_value == "":
        date_value = today_str()
    ts = parse_time(date_value)
    if ts is None:
        return None
    day_start = start_of_day(ts)
    return (
        day_start + timedelta(hours=WINDOW_START_HOUR),
        day_start + timedelta(hours=WINDOW_END_HOUR),
    )


# ---------------------------------------------------------------- 工单区间

def normalize_mode(mode):
    """
    mode 归一化：只认 'AUTO'，其余（'MANUAL' / 空 / 未知值 / 大小写不一致）全归 MANUAL。

    反过来「不是 MANUAL 就当 AUTO」会踩坑：字段缺失时会静默把工单算进自动那一档。
    """
    return "AUTO" if str("" if mode is None else mode).strip().upper() == "AUTO" else "MANUAL"


def compute_node_timeline(item, span):
    """
    算一条 AUTO 工单的节点执行时间线（对应 ganttLayout.js 的 computeNodeTimeline）。

    `plan_start_time` 的语义是「**这个时间之后**节点才可以开始执行」，不是开始时间。
    节点之间**串行**：真正开始 = max(前一个节点的真正结束, 本节点的 plan_start_time)。

    ⚠️ 先按 plan_start_time 升序排、再串行推进（前端踩过事故，别改回数组序）：
       不排序的话「可开工时间在跨度之外」的节点会被排到第一个执行，整根柱子全变休息区。

    :param item: 原始工单（读 node_detail / beginTime）
    :param span: resolve_span 的结果 {start, end}
    :return: {"segments": [...], "rests": [...], "nodeCount": int, "validNodeCount": int} 或 None
             （没有 node_detail / 没有有效节点 → None，调用方据此完全不画休息区）
    """
    if not item or not span:
        return None
    nodes = item.get("node_detail")
    if not isinstance(nodes, list) or not nodes:
        return None

    span_start = span["start"]
    span_end = span["end"]

    # 1. 逐节点解析「可开工时间」与耗时。
    #    plan_start_time 解析不出来 → 退回外层 beginTime；
    #    cost 无效（缺失 / <=0）→ 该节点不产生执行段。
    parsed = []
    for index, n in enumerate(nodes):
        if not isinstance(n, dict):
            continue
        plan = parse_time(n.get("plan_start_time"))
        if plan is None:
            plan = span_start
        cost = to_positive_number(n.get("cost"))
        if cost is None:
            continue
        parsed.append(
            {
                "earliest": plan,
                "minutes": cost,
                "name": n.get("node_name") if isinstance(n.get("node_name"), str) else "",
                "type": n.get("node_type") if isinstance(n.get("node_type"), str) else "",
                "index": index,
            }
        )
    if not parsed:
        return None

    # 2. 按「可开工时间」升序排，同值保持数组原顺序（显式带 index 做 tiebreak）
    parsed.sort(key=lambda x: (x["earliest"], x["index"]))

    # 3. 串行推进：真正开始 = max(游标, 可开工时间)，结束 = 开始 + cost
    segments = []
    cursor = span_start
    for n in parsed:
        actual_start = max(cursor, n["earliest"])
        actual_end = actual_start + timedelta(minutes=n["minutes"])
        segments.append(
            {
                "start": actual_start,
                "end": actual_end,
                "minutes": n["minutes"],
                "name": n["name"],
                "type": n["type"],
            }
        )
        cursor = actual_end

    # 4. 休息区间 = 工单总跨度 [span_start, span_end] 减去所有执行段。
    #    执行段超出 span_end 的部分（节点总工时 > total_cost 的数据自相矛盾）裁掉，
    #    别让休息算出负区间。
    rests = []
    rest_cursor = span_start
    for s in segments:
        seg_start = max(s["start"], span_start)
        seg_end = min(s["end"], span_end)
        if seg_end <= seg_start:
            continue
        if seg_start > rest_cursor:
            rests.append(
                {
                    "start": rest_cursor,
                    "end": seg_start,
                    "minutes": (seg_start - rest_cursor).total_seconds() / 60.0,
                }
            )
        if seg_end > rest_cursor:
            rest_cursor = seg_end
    if rest_cursor < span_end:
        rests.append(
            {
                "start": rest_cursor,
                "end": span_end,
                "minutes": (span_end - rest_cursor).total_seconds() / 60.0,
            }
        )

    return {
        "segments": segments,
        "rests": rests,
        "nodeCount": len(nodes),
        "validNodeCount": len(parsed),
    }


def resolve_span(item):
    """
    解析一条工单占用的时间区间（对应 ganttLayout.js 的 resolveSpan）—— 时长由这里说了算。

    规则（顺序是刻意的）：
      1. beginTime 解析不出来 → None，这条不参与统计；
      2. total_cost > 0       → 时长 = total_cost 分钟  ← **MANUAL 的主判据**
      3. 否则 endTime > beginTime → 时长 = 两者之差（兜底）
      4. 都没有                → 时长 = DEFAULT_DURATION_MIN

    ⚠️ AUTO 是例外（2026-10-12 需求变更）：结束时间取更晚的那个 ——
       max(beginTime + total_cost, node_detail 末位节点真正结束)。
       MANUAL 没有 node_detail，仍走上面 2~4 步，一格不变。

    :return: {"start", "end", "durationMinutes", "fromCost", "timeline"} 或 None
    """
    if not item:
        return None
    start = parse_time(item.get("beginTime"))
    if start is None:
        return None
    end = parse_time(item.get("endTime"))
    cost = to_positive_number(item.get("total_cost"))

    from_cost = False
    if cost is not None:
        duration_minutes = cost
        from_cost = True
    elif end is not None and end > start:
        duration_minutes = (end - start).total_seconds() / 60.0
    else:
        duration_minutes = DEFAULT_DURATION_MIN
        from_cost = True

    span = {
        "start": start,
        "end": start + timedelta(minutes=duration_minutes),
        "durationMinutes": duration_minutes,
        "fromCost": from_cost,
        "timeline": None,
    }

    if normalize_mode(item.get("mode")) == "AUTO":
        probe = compute_node_timeline(item, span)
        if probe and probe["segments"]:
            node_end = probe["segments"][-1]["end"]
            if node_end > span["end"]:
                span["end"] = node_end
                span["durationMinutes"] = (node_end - start).total_seconds() / 60.0
        # 用最终 span 再算一次（rests 的裁剪边界才是对的）
        span["timeline"] = compute_node_timeline(item, span)

    return span


def cost_intervals(item):
    """
    一条工单的「计耗时间片」（对应 workloadCalc.js 的 costIntervals）。

    - AUTO 且节点时间线可用 → 各节点真正执行的片段（串行结果，节点间暂停不算耗时）；
    - 其余情况（MANUAL 本来就没有 node_detail；AUTO 但节点全无效）→ 整段占用区间
      [beginTime, beginTime + total_cost)；
    - beginTime 解析不出来 → 空列表（整条不参与统计，和甘特图不画它一致）。

    :return: [(start, end), ...]
    """
    span = resolve_span(item)
    if not span:
        return []
    timeline = span.get("timeline")
    if timeline and timeline.get("segments"):
        return [(s["start"], s["end"]) for s in timeline["segments"]]
    return [(span["start"], span["end"])]


def overlap_minutes(intervals, seg_start, seg_end):
    """
    一组时间片落在 [seg_start, seg_end) 内的总分钟数。

    逐个时间片与时间段求交 —— 「一个工单跨多个时间段时分别计算」就体现在这里：
    时间片本身不切，只是每段各算各的重合部分，互不影响。
    """
    minutes = 0.0
    for iv_start, iv_end in intervals:
        s = max(iv_start, seg_start)
        e = min(iv_end, seg_end)
        if e > s:
            minutes += (e - s).total_seconds() / 60.0
    return minutes


# ---------------------------------------------------------------- 主计算

def calc_extra_staff(orders, date_value=None):
    """
    算「额外需要变更支持人员人数」（对应 workloadCalc.js 的 calcExtraStaff）。

    :param orders: 工单数组（接口原样，和甘特图同一份数据）
    :param date_value: 'YYYY-MM-DD'，决定 18:00-06:00 窗口；None → 取今天
    :return: {"peopleNum": int, "detail": [...]} 或 None（日期解析失败）
    """
    win = build_day_window(date_value)
    if not win:
        return None
    win_start, win_end = win

    items = [o for o in orders if o] if isinstance(orders, list) else []

    detail = []
    cursor = win_start
    for seg in WORKLOAD_SEGMENTS:
        # 末段夹到窗口终点：窗口恒 12 小时、五段小时数正好铺满，
        # 夹一下只是防止将来窗口规则变动时把时间段算到窗外去。
        seg_end = min(cursor + timedelta(hours=seg["hours"]), win_end)

        manual_num = 0
        manual_minutes = 0.0
        auto_num = 0
        auto_minutes = 0.0

        for item in items:
            minutes = overlap_minutes(cost_intervals(item), cursor, seg_end)
            if minutes <= 0:
                # 这个时间段内没有任何占用 → 既不计单也不计耗时
                continue
            if normalize_mode(item.get("mode")) == "AUTO":
                auto_num += 1
                auto_minutes += minutes
            else:
                manual_num += 1
                manual_minutes += minutes

        manual_cost = round2(manual_minutes / 60.0)
        auto_cost = round2(auto_minutes / 60.0)
        manual_val = round2(max(manual_num, manual_cost) / MANUAL_DIVISOR)
        auto_val = round2(max(auto_num, auto_cost) / AUTO_DIVISOR)
        detail.append(
            {
                "time": seg["label"],
                "manualNum": manual_num,
                "manualCost": manual_cost,
                "manualVal": manual_val,
                "autoNum": auto_num,
                "autoCost": auto_cost,
                "autoVal": auto_val,
                "totalVal": round2(manual_val + auto_val),
            }
        )
        cursor = seg_end

    # ---------------- 两条逻辑，取最大值 ----------------
    totals = [d["totalVal"] for d in detail]

    # 逻辑一：五段总分取最大 d，d > 2 起每超过 1 加 1 人。取整方向 = **向上**：
    # d 只比 2 大一丝丝（如 2.05）也算「超过」—— 人手至少是 1 个，不能招 0.3 个人。
    peak = max(totals) if totals else 0
    peak_extra = math.ceil(peak - PEAK_THRESHOLD) if peak > PEAK_THRESHOLD else 0

    # 逻辑二：最长连续超载段（总分 > 1）为 N → 加 N - 1 人；只有一段超载时 N-1 = 0。
    longest = 0
    run = 0
    for t in totals:
        run = run + 1 if t > RUN_THRESHOLD else 0
        if run > longest:
            longest = run
    run_extra = longest - 1 if longest > 1 else 0

    return {"peopleNum": max(peak_extra, run_extra), "detail": detail}


def build_payload(orders=None, date_value=None):
    """
    组装推送到企微的三字段 payload —— 等价于前端 handleStaffPush 里的

        const payload = { ...staffResult, date: this.windowDate }

    :param orders: 工单数组；None → 按 date 去接口拉
    :param date_value: 'YYYY-MM-DD'；None → **取今天**
    :return: {"date": str, "peopleNum": int, "detail": list}
    :raises ValueError: 日期无效，或工单数据一条都没有（别推个空账过去）
    """
    if not date_value:
        date_value = today_str()
    if parse_time(date_value) is None:
        raise ValueError("日期无效：%r（需要 'YYYY-MM-DD'）" % (date_value,))

    if orders is None:
        orders = fetch_orders(date_value)

    result = calc_extra_staff(orders, date_value)
    if result is None:
        raise ValueError("日期无效，无法计算：%r" % (date_value,))

    return {
        "date": date_value,
        "peopleNum": result["peopleNum"],
        "detail": result["detail"],
    }


# ---------------------------------------------------------------- 数据获取 / 推送

def _brief(text, limit=300):
    """接口报错体压成一行（上游返回里常带换行，打出来像断句）"""
    return " ".join(str(text or "").split())[:limit]


def _pick_payload(res):
    """
    从接口返回里取载荷 —— 与前端 api/tool/orderGantt.js 的 pickPayload 同一口径：

    载荷可能在 `data` 也可能在 `rows`；`data` **不是 None 就用它**
    （`[]` / `''` / `0` / `false` 都算有值，别用 `or` 判 —— 空数组会被误吞）。
    """
    if isinstance(res, list):
        return res
    if not isinstance(res, dict):
        return []
    if res.get("data") is not None:
        return res["data"]
    if res.get("rows") is not None:
        return res["rows"]
    return []


def fetch_orders(date_value=None, url=None, token=None, timeout=10):
    """
    拉工单列表（对应前端 getOrderList）。

    POST {date} 到 orderList 接口，返回 data 数组。**不校验 code**：
    前端拦截器已拦掉业务错误，且 python 侧成功码可能就是 0（不是 200）。

    :param date_value: 'YYYY-MM-DD'；None → 取今天
    :param url: 接口地址；None → DEFAULT_ORDER_LIST_URL
    :param token: 可选，放 Authorization 头（后端要鉴权时用）
    :return: list
    """
    import urllib.error
    import urllib.request

    if not date_value:
        date_value = today_str()
    url = url or DEFAULT_ORDER_LIST_URL

    body = json.dumps({"date": date_value}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    if token:
        req.add_header("Authorization", token if token.lower().startswith("bearer ") else "Bearer " + token)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        detail = _brief(e.read().decode("utf-8", "replace"))
        raise RuntimeError("拉取工单失败：HTTP %s %s（%s）" % (e.code, e.reason, detail))
    except urllib.error.URLError as e:
        raise RuntimeError("拉取工单失败：%s 不可达（%s）" % (url, e.reason))

    try:
        res = json.loads(raw)
    except ValueError:
        raise RuntimeError("拉取工单失败：返回不是 JSON（前 200 字符：%r）" % (raw[:200],))

    rows = _pick_payload(res)
    return rows if isinstance(rows, list) else []


def push_to_wecom(payload, url=None, token=None, timeout=10):
    """
    把 payload 推到企微（对应前端 pushExtraStaff）。

    成功判据和前端一致：**能拿到响应就算成功**，不看 code（python 侧成功码可能是 0）。

    :param payload: build_payload 的返回值
    :return: 接口返回体（dict）
    """
    import urllib.error
    import urllib.request

    url = url or DEFAULT_PUSH_URL
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json;charset=utf-8")
    req.add_header("Accept", "application/json")
    if token:
        req.add_header("Authorization", token if token.lower().startswith("bearer ") else "Bearer " + token)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        detail = _brief(e.read().decode("utf-8", "replace"))
        raise RuntimeError("推送失败：HTTP %s %s（%s）" % (e.code, e.reason, detail))
    except urllib.error.URLError as e:
        raise RuntimeError("推送失败：%s 不可达（%s）" % (url, e.reason))

    try:
        return json.loads(raw) if raw.strip() else {}
    except ValueError:
        return {"raw": raw}


# ---------------------------------------------------------------- 内置样例（自检用）

#: 与前端 api/tool/orderGantt.js 里 USE_MOCK 那 8 条样例**完全一致**，
#: 只把日期写成占位符：'__DAY__' = 窗口当天，'__NEXT__' = 次日。
_MOCK_ORDERS = [
    {
        "orderId": "CHGU-20260909-0086",
        "total_cost": 30,
        "beginTime": "__DAY__ 18:00:00",
        "endTime": "__DAY__ 23:00:00",
        "mode": "AUTO",
        "node_detail": [
            {"cost": 15, "node_name": "批处理-容器云发布", "plan_start_time": "__DAY__ 18:00:00"},
            {"cost": 10, "node_name": "人工节点", "plan_start_time": None},
        ],
    },
    {
        "orderId": "CHGU-20260909-0087",
        "total_cost": 135,
        "beginTime": "__DAY__ 18:00:00",
        "endTime": "__DAY__ 22:00:00",
        "mode": "MANUAL",
    },
    {
        "orderId": "CHGU-20260916-0047",
        "total_cost": 135,
        "beginTime": "__NEXT__ 00:00:00",
        "endTime": "__NEXT__ 06:00:00",
        "mode": "MANUAL",
    },
    {
        "orderId": "CHGU-20260917-0110",
        "total_cost": 120,
        "beginTime": "__DAY__ 19:00:00",
        "endTime": "__DAY__ 21:00:00",
        "mode": "AUTO",
        "node_detail": [
            {"cost": 20, "node_name": "批处理-容器云发布", "plan_start_time": "__DAY__ 19:00:00"},
            {"cost": 30, "node_name": "数据库变更", "plan_start_time": "__DAY__ 19:50:00"},
            {"cost": 25, "node_name": "配置下发", "plan_start_time": None},
        ],
    },
    {
        "orderId": "CHGU-20260917-0111",
        "total_cost": 155,
        "beginTime": "__DAY__ 21:30:00",
        "endTime": "__NEXT__ 00:05:00",
        "mode": "AUTO",
        "node_detail": [
            {"cost": 40, "node_name": "YUM包更新", "plan_start_time": "__DAY__ 21:30:00"},
            {"cost": 20, "node_name": "人工审批", "plan_start_time": "__DAY__ 23:00:00"},
            {"cost": 35, "node_name": "屏蔽告警", "plan_start_time": None},
        ],
    },
    {
        "orderId": "CHGU-20260918-0205",
        "total_cost": 100,
        "beginTime": "__NEXT__ 02:00:00",
        "endTime": "__NEXT__ 03:40:00",
        "mode": "AUTO",
        "node_detail": [
            {"cost": 35, "node_name": "容器云发布", "plan_start_time": "__NEXT__ 02:00:00"},
            {"cost": 25, "node_name": "数据库变更", "plan_start_time": "__NEXT__ 02:20:00"},
            {"cost": 20, "node_name": "配置下发", "plan_start_time": None},
        ],
    },
    {
        "orderId": "CHGU-20260917-0206",
        "total_cost": 50,
        "beginTime": "__DAY__ 22:00:00",
        "endTime": "__NEXT__ 06:00:00",
        "mode": "AUTO",
        "node_detail": [
            {"cost": 15, "node_name": "批处理-容器云发布", "plan_start_time": "__NEXT__ 00:30:00"},
            {"cost": 10, "node_name": "批处理-容器云发布", "plan_start_time": None},
            {"cost": 15, "node_name": "批处理-容器云发布", "plan_start_time": "__DAY__ 22:00:00"},
            {"cost": 10, "node_name": "批处理-容器云发布", "plan_start_time": None},
        ],
    },
    {
        "orderId": "CHGU-20260917-0210",
        "total_cost": 50,
        "beginTime": "__NEXT__ 00:00:00",
        "endTime": "__NEXT__ 06:00:00",
        "mode": "AUTO",
        "node_detail": [
            {"cost": 50, "node_name": "批处理-容器云发布", "plan_start_time": None},
        ],
    },
]


def mock_orders(date_value=None):
    """
    内置样例工单（日期替换成 date_value / 次日）。

    ⚠️ 用**单次遍历替换**，不是两轮 replace：两轮的话，当所选日期恰好等于
       某个占位值时，第一轮刚换出来的字符串会被第二轮再换一次（前端踩过）。
    """
    if not date_value:
        date_value = today_str()
    day = parse_time(date_value)
    if day is None:
        raise ValueError("日期无效：%r" % (date_value,))
    next_day = (start_of_day(day) + timedelta(days=1)).strftime("%Y-%m-%d")

    def walk(node):
        if isinstance(node, str):
            return node.replace("__DAY__", date_value).replace("__NEXT__", next_day)
        if isinstance(node, list):
            return [walk(x) for x in node]
        if isinstance(node, dict):
            return {k: walk(v) for k, v in node.items()}
        return node

    return walk(_MOCK_ORDERS)


# ---------------------------------------------------------------- 命令行

def _print_json(obj, pretty=True):
    text = json.dumps(obj, ensure_ascii=False, indent=2 if pretty else None)
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 控制台中文/省略号不乱码
    except (AttributeError, ValueError):
        pass
    print(text)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="工单甘特图 · 计算「推送到企微」的 date / peopleNum / detail",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--date", default=None, help="窗口当天 'YYYY-MM-DD'（默认今天）")
    parser.add_argument("--url", default=None, help="工单列表接口（默认 %s）" % DEFAULT_ORDER_LIST_URL)
    parser.add_argument("--push-url", default=None, help="推送接口（默认 %s）" % DEFAULT_PUSH_URL)
    parser.add_argument("--orders-file", default=None, help="用本地 JSON 文件当数据源（数组或 {data:[...]}）")
    parser.add_argument("--token", default=None, help="可选，Authorization 头的值")
    parser.add_argument("--mock", action="store_true", help="用内置 8 条样例工单（和前端 mock 一致）")
    parser.add_argument("--push", action="store_true", help="算完直接推送到企微")
    parser.add_argument("--compact", action="store_true", help="输出单行 JSON")
    args = parser.parse_args(argv)

    date_value = args.date or today_str()

    # 命令行场景不打 traceback：数据源不通 / 日期写错 / 文件不存在都只给一行人话 + 非零退出码
    try:
        # ---- 数据源：本地文件 / 内置样例 / 接口 ----
        if args.orders_file:
            with open(args.orders_file, "r", encoding="utf-8") as f:
                orders = _pick_payload(json.load(f))
        elif args.mock:
            orders = mock_orders(date_value)
        else:
            orders = fetch_orders(date_value, url=args.url, token=args.token)

        if not orders:
            _print_json(
                {"date": date_value, "peopleNum": 0, "detail": [], "warning": "当天没有工单数据"},
                pretty=not args.compact,
            )
            return 0

        payload = build_payload(orders, date_value)
        _print_json(payload, pretty=not args.compact)

        if args.push:
            res = push_to_wecom(payload, url=args.push_url, token=args.token)
            _print_json({"push": "ok", "response": res}, pretty=not args.compact)
        return 0
    except (ValueError, RuntimeError, OSError) as e:
        try:
            sys.stderr.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
        sys.stderr.write("[order_workload] %s\n" % (e,))
        return 1


if __name__ == "__main__":
    sys.exit(main())
