# 任务：开发「异常资源月报」页面

请你作为一名资深 Vue2 + Element UI + 企业后台 UI/UX 工程师，在现有 **RuoYi-Vue（Vue2）项目**中开发一个新的后台页面：

> 菜单名称：异常资源月报

本次任务重点不是简单把数据用 Table 罗列出来，而是要根据数据结构设计一个**现代、美观、清晰、有层次感的数据监控月报页面**。

整体视觉要求：

- 企业级后台风格
- 简洁、现代、专业
- 有适当留白
- 信息层级清晰
- 不要花哨的大面积渐变
- 不要做成传统“表格堆砌”的若依页面
- 使用 Element UI 现有组件
- 可以通过 scoped SCSS 自定义样式提升视觉效果
- 页面要让用户能够快速发现异常资源
- 风格偏「运维监控 / 数据分析 Dashboard」
- 不要过度设计，不要影响后台系统整体一致性

---

# 一、技术要求

项目技术栈：

- Vue 2
- Element UI
- RuoYi-Vue
- SCSS
- 不要引入新的 UI 框架
- 不要使用 Vue3 Composition API
- 使用 Vue2 Options API
- 尽量复用 Element UI 组件

页面需要遵循当前项目已有的：

- API 请求方式
- 页面目录结构
- CSS 风格
- ESLint 规范
- RuoYi 组件规范

请先分析当前项目的目录结构和类似页面的实现方式，再进行开发。

---

# 二、页面查询参数

页面顶部提供查询条件。

接口请求参数：

```js
{
  systemId: '', // 系统英文缩写，字符串
  year: 2026,   // 年份，数字
  month_no: 8   // 月份，数字
}
```

字段说明：

| 字段     | 类型   | 说明         |
| -------- | ------ | ------------ |
| systemId | String | 系统英文缩写 |
| year     | Number | 年份         |
| month_no | Number | 月份         |

---

# 三、顶部查询区域设计

页面顶部设计一个简洁的查询区域。

不要使用传统若依那种：

```text
系统ID：[输入框]
年份：[输入框]
月份：[输入框]

[搜索] [重置]
```

这种布局太传统。

推荐设计：

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  异常资源月报                                                │
│  查看指定系统指定月份的资源异常情况                           │
│                                                              │
│  系统英文缩写                                                │
│  [ DASP________________ ]   [ 2026年08月 ▼ ]   [ 🔍 查询 ]  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

具体要求：

### 1. 页面标题

显示：

```text
异常资源月报
```

副标题：

```text
查看指定系统指定月份的资源异常情况
```

标题区域不要太高，保持简洁。

---

### 2. 系统英文缩写输入框

使用：

```html
<el-input></el-input>
```

绑定字段：

```js
systemId;
```

要求：

- placeholder：请输入系统英文缩写
- 输入内容自动转换成大写
- 输入框宽度建议 260px
- 不允许输入中文
- 可以限制为英文、数字、中划线等常见系统标识字符

例如：

```text
DASP
CRM
PAYMENT
```

用户输入小写：

```text
dasp
```

自动转换：

```text
DASP
```

---

### 3. 月份选择器

不要拆成年份选择器 + 月份选择器。

使用一个月份选择器：

```html
<el-date-picker type="month"></el-date-picker>
```

例如：

```text
2026年08月
```

内部自动拆分：

```js
{
  year: 2026,
  month_no: 8
}
```

要求：

- 默认当前月份
- format 使用：

```text
yyyy年MM月
```

- value-format 可以根据当前项目数据格式选择合适方案
- 查询时最终传递 Number 类型：

```js
year: Number(year);
month_no: Number(month_no);
```

---

### 4. 查询按钮

使用 Element UI Primary Button。

按钮：

```text
查询
```

图标：

```text
el-icon-search
```

点击后请求接口。

支持：

- 点击查询
- 输入框按 Enter 查询

---

# 四、页面整体数据结构

接口返回数据结构大致如下：

```js
{
  指标异常: {
    HADOOP: [
      {
        component: "dasp-hadoop",
        cpu: 64,
        hostname: "bjc-dasp-hive-kzx-0085",
        idc: "BJ-DB",

        inspect_data: {
          CPU使用率: {
            avg: 2.99,
            code: 2,
            max: 77.8,
            min: 0.82,
            p99: 36.58
          },

          "Filesystem space available": {
            AvailableSize: 38727.57,
            TotalSize: 101273.67,
            code: 0,
            usage: 61.76
          },

          内存使用率: {
            avg: 13.41,
            code: 1,
            max: 35.03,
            min: 12.91,
            p99: 24.86
          }
        },

        ip: "25.131.187.85",
        memory: 512,
        mtype: "p",
        net_zone_code: "BJ-DB/HCS/YN/HXYW",
        os: "Kylin Linux Advanced Server V10 64bit",
        sn: "2102313AUXN0P7100309"
      }
    ],

    应用: [
      {
        component: "dasp-ps-transfer",
        cpu: "2",
        hostname: "sza-dasp-transfer-kzx-0002",
        idc: "SZ-NW",
        inspect_data: {},
        ip: "25.131.16.332",
        memory: 4
      }
    ]
  },

  采集异常: {
    数据: {
      REDIS: [
        {
          desc: "数据集为空",
          ip: "192.168.12.156"
        }
      ],

      应用: [
        {
          desc: "数据集为空",
          ip: "192.168.231.24"
        }
      ]
    },

    采集日期: "2026-08-31"
  }
}
```

注意：

数据结构中的分类名称可能动态变化。

例如：

```js
指标异常: {
  HADOOP: [],
  应用: []
}
```

未来可能出现：

```js
指标异常: {
  HADOOP: [],
  REDIS: [],
  MYSQL: [],
  应用: []
}
```

因此：

**不要把 HADOOP 和 应用写死在页面逻辑中。**

应该根据：

```js
Object.keys(data.指标异常);
```

动态生成分类区域。

但视觉上：

- HADOOP 可以使用服务器图标
- 应用可以使用应用图标
- 其他分类根据名称提供合理默认图标

---

# 五、页面整体布局

页面整体结构严格按照以下思路设计：

```text
┌──────────────────────────────────────────────────────────────┐
│                      查询区域                                │
│                                                              │
│ 异常资源月报                                                  │
│ 查看指定系统指定月份的资源异常情况                             │
│                                                              │
│ [系统英文缩写]  [月份选择器]  [查询]                          │
└──────────────────────────────────────────────────────────────┘


查询成功后


┌──────────────────────────────────────────────────────────────┐
│                    异常资源概览                              │
│                                                              │
│      HADOOP异常          应用异常          采集异常           │
│          42                6                 5               │
│                                                              │
└──────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│ 🔥 指标异常                                                  │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ 🖥 HADOOP                                      共 42 台       │
│                                                              │
│ [Card]       [Card]       [Card]                             │
│                                                              │
│ [Card]       [Card]       [Card]                             │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ 📦 应用                                         共 6 台       │
│                                                              │
│ [Card]       [Card]       [Card]                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│ ⚠️ 采集异常                                                  │
│                                                              │
│ 类型        IP                     异常描述                   │
│ REDIS       192.168.xxx.xxx       数据集为空                 │
│ REDIS       192.168.xxx.xxx       数据集为空                 │
│ 应用        192.168.xxx.xxx       数据集为空                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 六、增加「异常资源概览」区域

查询成功后，在数据详情前增加一个概览区域。

目的：

让用户进入页面第一眼就知道：

- 本月有多少 HADOOP 异常资源
- 有多少应用异常
- 有多少采集异常

例如：

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  异常资源概览                                               │
│  2026年08月 · DASP                                         │
│                                                            │
│      🔴                  🟠                  ⚠️             │
│                                                            │
│      42                  6                    5             │
│                                                            │
│  HADOOP异常资源       应用异常资源          采集异常         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

设计要求：

- 不需要复杂图表
- 使用 3～4 个简洁统计卡片
- 数字突出
- 分类名称在数字下方
- 不要使用夸张渐变
- 使用轻微阴影或 border
- Hover 可以有轻微上浮效果

统计数据需要动态计算。

例如：

```js
HADOOP数量 = data.指标异常.HADOOP.length

应用数量 = data.指标异常.应用.length

采集异常数量 = 所有 data.采集异常.数据 下数组长度总和
```

注意：

如果指标异常分类不是固定的，则概览区域也应该支持动态展示。

例如：

```text
HADOOP异常
REDIS异常
MYSQL异常
应用异常
采集异常
```

如果数量太多，可以自动换行。

---

# 七、指标异常展示方式

这是本页面的核心。

## 不推荐使用 el-table

因为单条资源数据结构复杂：

```js
{
  hostname,
  ip,
  idc,
  cpu,
  memory,

  inspect_data: {
    CPU使用率: {},
    内存使用率: {},
    磁盘使用率: {}
  }
}
```

如果使用 Table：

```text
主机名 | IP | IDC | CPU | 内存 | CPU平均值 | CPU最大值 | 内存平均值 | ...
```

会导致：

- 表格非常宽
- 用户需要横向滚动
- 信息密度过高
- 阅读体验差

因此：

# 使用 Card 卡片展示

---

# 八、指标异常分类区域

例如：

```text
🔥 指标异常

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥 HADOOP
共 42 台异常资源

[Card] [Card] [Card]

[Card] [Card] [Card]
```

分类 Header 设计：

左侧：

- 图标
- 分类名称

例如：

```text
🖥 HADOOP
```

右侧：

```text
共 42 台
```

使用一个浅色 Tag 或圆角数量 Badge。

例如：

```text
HADOOP      [42 台]
```

分类之间增加适当间距：

```scss
margin-top: 32px;
```

不要让所有分类挤在一起。

---

# 九、Card 卡片详细设计

每一张 Card = 一台异常资源。

Card 建议宽度：

```text
320px ~ 380px
```

使用 CSS Grid 自动布局：

```scss
.resource-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
```

不要固定：

```scss
grid-template-columns: repeat(3, 1fr);
```

需要支持不同屏幕宽度自动适应。

---

# 十、Card 视觉结构

Card 推荐设计如下：

```text
┌───────────────────────────────────────────────┐
│                                               │
│ 🖥 bjc-dasp-hive-kzx-0085              ● 异常 │
│                                               │
│ dasp-hadoop          BJ-DB                    │
│ IP：25.131.187.85                              │
│                                               │
│ ───────────────────────────────────────────── │
│                                               │
│ CPU使用率                              77.8%  │
│ ██████████████████████░░                       │
│ Max 77.8%              P99 36.58%              │
│                                               │
│ 内存使用率                             35.03% │
│ ██████████░░░░░░░░░░░░                       │
│ Max 35.03%             P99 24.86%              │
│                                               │
│ 磁盘使用率                             61.76% │
│ █████████████████░░░░░                       │
│                                               │
│ ───────────────────────────────────────────── │
│                                               │
│ CPU 64 Core       Memory 512 GB       详情 →   │
│                                               │
└───────────────────────────────────────────────┘
```

---

# 十一、Card 第一部分：资源基础信息

Card Header：

左侧显示：

```text
服务器图标 + hostname
```

例如：

```text
🖥 bjc-dasp-hive-kzx-0085
```

hostname 是最重要的信息。

要求：

- 字体稍大
- font-weight: 600
- 如果太长，使用 ellipsis
- 鼠标 Hover 显示完整 hostname

右侧显示资源整体异常等级。

例如：

```text
● 严重
```

或者：

```text
● 异常
```

整体状态根据 inspect_data 中所有指标的 code 判断。

规则：

```js
code = 0  正常
code = 1  警告
code = 2  严重
```

取当前资源所有指标中最高级别。

例如：

```text
CPU code = 2
内存 code = 1
磁盘 code = 0

最终状态：

严重
```

颜色映射：

```js
0 => success
1 => warning
2 => danger
```

建议颜色：

```scss
正常：#67C23A
警告：#E6A23C
严重：#F56C6C
```

不要使用过于鲜艳刺眼的颜色。

---

# 十二、Card 第二部分：基础标签

不要写成传统后台：

```text
Component：dasp-hadoop
IDC：BJ-DB
IP：25.131.xxx.xxx
```

这样太死板。

建议：

Component 和 IDC 使用轻量 Tag：

```text
[dasp-hadoop]   [BJ-DB]
```

下面显示：

```text
IP：25.131.187.85
```

Tag 样式：

- 浅灰背景
- 圆角
- 小字号
- 不要使用太重的 Element Tag 颜色

建议自定义：

```scss
background: #f5f7fa;
color: #606266;
border-radius: 4px;
```

---

# 十三、Card 第三部分：指标展示

这是 Card 最重要的区域。

每个 inspect_data 中的指标动态渲染。

例如：

```js
inspect_data = {
  CPU使用率: {},
  内存使用率: {},
  "Filesystem space available": {},
};
```

不要写死三个指标。

应该：

```js
Object.entries(inspect_data);
```

动态渲染。

---

## 指标展示形式

每个指标：

```text
CPU使用率                         77.8%
████████████████████░░

Max 77.8%              P99 36.58%
```

结构：

### 第一行

左侧：

```text
指标名称
```

右侧：

```text
核心数值
```

例如：

```text
CPU使用率                       77.8%
```

---

### 第二行

使用：

```html
<el-progress></el-progress>
```

展示进度条。

注意：

进度条颜色根据 code 决定。

```js
code === 0;
绿色;

code === 1;
橙色;

code === 2;
红色;
```

---

### 第三行

对于 CPU / 内存指标：

展示：

```text
Max：77.8%       P99：36.58%
```

不要把：

```text
avg
min
max
p99
```

全部塞进 Card。

Card 只展示：

```text
Max
P99
```

完整数据放到详情 Drawer。

---

# 十四、磁盘指标特殊处理

数据：

```js
"Filesystem space available": {
  AvailableSize,
  TotalSize,
  code,
  usage
}
```

Card 中展示：

```text
磁盘使用率                       61.76%

████████████████░░░░
```

如果数据存在：

可以在底部展示：

```text
可用：37.82 GB
```

需要将：

```js
AvailableSize;
```

进行合理格式化。

注意：

单位数据目前可能不是 GB，需要根据接口实际单位处理。

如果无法确认单位：

不要擅自添加 GB。

可以仅显示：

```text
可用空间：38727.57
```

或者详情页展示完整原始数据。

---

# 十五、指标名称转换

接口中可能存在：

```text
CPU使用率
内存使用率
Filesystem space available
```

页面显示建议做名称映射。

例如：

```js
const metricNameMap = {
  CPU使用率: "CPU使用率",
  内存使用率: "内存使用率",
  "Filesystem space available": "磁盘使用率",
};
```

但是注意：

如果未来出现未知指标：

必须兜底显示原始名称。

不要导致页面报错。

例如：

```js
getMetricName(name) {
  return metricNameMap[name] || name
}
```

---

# 十六、Card 底部资源配置

Card 最底部展示：

```text
CPU：64 Core
内存：512 GB
```

布局：

```text
CPU 64 Core      Memory 512 GB        详情 →
```

要求：

- 使用较小字体
- 浅灰色
- 不要抢占视觉重点
- CPU 和 Memory 信息居左
- 详情按钮居右

如果字段不存在：

显示：

```text
--
```

不要报错。

---

# 十七、Card Hover 效果

Hover 时增加轻微交互。

要求：

```scss
transition: all 0.25s ease;
```

Hover：

```scss
transform: translateY(-3px);
box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
```

不要：

- 大幅放大
- 强烈阴影
- 花哨动画

保持企业后台专业感。

---

# 十八、Card 点击详情

每张 Card 底部提供：

```text
查看详情 →
```

点击后打开：

```html
<el-drawer></el-drawer>
```

Drawer 宽度：

```text
480px ~ 600px
```

推荐：

```html
:with-header="false"
```

自己设计 Drawer Header。

---

# 十九、Drawer 详情设计

Drawer 结构：

```text
┌────────────────────────────────────┐
│                                    │
│ bjc-dasp-hive-kzx-0085        ×    │
│ dasp-hadoop                        │
│                                    │
│ ───────────────────────────────── │
│                                    │
│ 基础信息                            │
│                                    │
│ Component      dasp-hadoop         │
│ Hostname       bjc-xxx             │
│ IP             25.131.xxx.xxx      │
│ IDC            BJ-DB               │
│ 网络区域        BJ-DB/HCS/YN/HXYW   │
│ 操作系统        Kylin Linux...      │
│ SN             2102313...          │
│                                    │
│ ───────────────────────────────── │
│                                    │
│ 资源配置                            │
│                                    │
│ CPU            64 Core             │
│ Memory         512 GB              │
│ Machine Type   p                   │
│                                    │
│ ───────────────────────────────── │
│                                    │
│ 指标详情                            │
│                                    │
│ CPU使用率                            │
│ ┌────────────────────────────────┐ │
│ │ Avg      Min      Max      P99 │ │
│ │ 2.99     0.82     77.8     36.58│ │
│ └────────────────────────────────┘ │
│                                    │
│ 内存使用率                           │
│ ┌────────────────────────────────┐ │
│ │ Avg      Min      Max      P99 │ │
│ │ ...                            │ │
│ └────────────────────────────────┘ │
│                                    │
└────────────────────────────────────┘
```

Drawer 中展示完整数据。

包括：

基础信息：

```js
component;
hostname;
ip;
idc;
net_zone_code;
os;
sn;
```

资源配置：

```js
cpu;
memory;
mtype;
```

指标详情：

动态遍历：

```js
inspect_data;
```

不要只支持 CPU / 内存 / 磁盘。

未知指标也必须正常展示。

---

# 二十、采集异常区域

采集异常数据比较简单：

```js
{
  desc: "数据集为空",
  ip: "192.168.12.156"
}
```

因此：

# 采集异常不要使用大型 Card

使用简洁的 Table。

页面：

```text
┌──────────────────────────────────────────────────────────────┐
│ ⚠️ 采集异常                                                  │
│                                                              │
│ 采集日期：2026-08-31                                         │
│                                                              │
│ ┌────────────┬──────────────────┬─────────────────────────┐ │
│ │ 数据类型    │ IP               │ 异常描述                │ │
│ ├────────────┼──────────────────┼─────────────────────────┤ │
│ │ REDIS       │ 192.168.12.156  │ 数据集为空              │ │
│ │ REDIS       │ 192.168.12.155  │ 数据集为空              │ │
│ │ 应用        │ 192.168.231.24  │ 数据集为空              │ │
│ └────────────┴──────────────────┴─────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

数据需要扁平化。

原始数据：

```js
{
  REDIS: [
    {},
    {}
  ],
  应用: [
    {},
    {}
  ]
}
```

转换：

```js
[
  {
    type: "REDIS",
    ip: "192.168.12.156",
    desc: "数据集为空",
  },
  {
    type: "应用",
    ip: "192.168.231.24",
    desc: "数据集为空",
  },
];
```

Table 字段：

| 数据类型 | IP地址 | 异常描述 |
| -------- | ------ | -------- |

---

# 二十一、采集异常 Table 样式

不要使用默认非常密集的 Table。

建议：

```scss
.el-table {
  border-radius: 6px;
  overflow: hidden;
}
```

Header：

- 浅灰色背景
- 字体加粗
- 不要使用深蓝色

Row Hover：

使用轻微背景变化。

异常描述：

可以使用：

```html
<el-tag type="danger"></el-tag>
```

或者浅红色文字。

不要整行变红。

---

# 二十二、页面加载状态

点击查询后：

使用：

```html
v-loading
```

覆盖数据展示区域。

要求：

- 查询过程中禁用查询按钮
- 显示 Loading
- 防止重复请求

---

# 二十三、空数据状态

如果接口返回：

```js
{
}
```

或者：

```js
{
  指标异常: {},
  采集异常: {}
}
```

页面显示：

```text
暂无异常数据
```

使用：

```html
<el-empty></el-empty>
```

文案：

```text
当前查询条件下暂无异常资源
```

不要显示空白页面。

---

# 二十四、查询前默认状态

页面首次进入时：

不要直接显示一大片空 Card。

建议：

```text
                📊

           异常资源月报

     请输入系统英文缩写并选择月份

          [ DASP______ ]

```

或者使用：

```html
<el-empty></el-empty>
```

但要区分：

### 未查询

```text
请输入查询条件获取异常资源数据
```

### 查询成功但无数据

```text
当前查询条件下暂无异常资源
```

这两个状态不能混用。

---

# 二十五、数据兼容性要求

接口返回字段可能存在：

```js
undefined;
null;
("");
```

必须进行兼容处理。

例如：

```js
hostname || "--";
```

数值格式化：

```js
formatNumber(value);
```

要求：

- null 显示 --
- 数字最多保留两位小数
- 不要出现：

```text
undefined
NaN
null
```

---

# 二十六、建议封装组件

如果当前项目结构允许，建议拆分组件。

例如：

```text
views/
└── abnormalResource/
    ├── index.vue
    └── components/
        ├── ResourceCard.vue
        ├── ResourceDetailDrawer.vue
        ├── ExceptionOverview.vue
        └── CollectExceptionTable.vue
```

职责：

### index.vue

负责：

- 查询条件
- API 请求
- 数据处理
- 页面整体布局

---

### ExceptionOverview.vue

负责：

```text
异常资源概览
```

---

### ResourceCard.vue

负责：

```text
单个资源异常 Card
```

---

### ResourceDetailDrawer.vue

负责：

```text
资源完整详情
```

---

### CollectExceptionTable.vue

负责：

```text
采集异常 Table
```

如果项目现有代码习惯不适合拆分多个组件，则可以根据项目实际情况调整。

但是：

# ResourceCard 和详情 Drawer 建议必须独立封装

避免 index.vue 代码过于庞大。

---

# 二十七、图标建议

使用 Element UI 图标。

HADOOP：

```text
el-icon-monitor
```

应用：

```text
el-icon-box
```

指标异常：

```text
el-icon-warning-outline
```

采集异常：

```text
el-icon-warning
```

查询：

```text
el-icon-search
```

详情：

```text
el-icon-arrow-right
```

不要引入新的 Icon 库。

---

# 二十八、颜色规范

整体页面背景：

```scss
#f5f7fa
```

内容卡片：

```scss
#ffffff
```

主色：

使用当前 RuoYi 系统主题色。

不要自行定义新的品牌主色。

状态颜色：

```scss
success: #67C23A
warning: #E6A23C
danger:  #F56C6C
```

普通文字：

```scss
#303133
```

次级文字：

```scss
#909399
```

Border：

```scss
#EBEEF5
```

要求：

- 不使用彩虹色
- 不使用过多渐变
- 不使用大面积红色
- 红色仅用于异常状态强调

---

# 二十九、间距规范

页面：

```scss
padding: 20px;
```

模块之间：

```scss
margin-bottom: 20px;
```

分类之间：

```scss
margin-top: 32px;
```

Card：

```scss
padding: 18px ~20px;
```

Card Gap：

```scss
16px;
```

整体要有呼吸感。

---

# 三十、响应式要求

PC 后台优先。

Card Grid：

```scss
grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
```

保证：

- 宽屏自动多列
- 普通笔记本至少 2～3 列
- 小屏自动减少列数

不要出现 Card 宽度过窄。

---

# 三十一、代码质量要求

请特别注意：

### 不要写死数据

禁止：

```js
data.指标异常.HADOOP;
```

作为唯一逻辑。

应该支持：

```js
Object.keys(data.指标异常);
```

动态分类。

---

### 不要写死指标

禁止：

```js
inspect_data.CPU使用率;
inspect_data.内存使用率;
```

作为唯一逻辑。

应该：

```js
Object.entries(inspect_data);
```

动态渲染。

---

### 提取工具方法

建议：

```js
getStatusInfo(code);

getResourceStatus(inspectData);

getMetricName(name);

getMetricValue(name, data);

formatNumber(value);

formatMetricDetail(data);

flattenCollectException(data);
```

---

# 三十二、最终页面目标

最终页面应该具备以下体验：

用户进入：

```text
异常资源月报
```

↓

输入：

```text
DASP
```

↓

选择：

```text
2026年08月
```

↓

点击：

```text
查询
```

↓

首先看到：

```text
异常资源概览

HADOOP异常资源：42
应用异常资源：6
采集异常：5
```

↓

往下看到：

```text
🔥 指标异常

🖥 HADOOP

[资源Card]
[资源Card]
[资源Card]

📦 应用

[资源Card]
[资源Card]
```

↓

点击某张 Card：

```text
查看完整资源详情 Drawer
```

↓

最后：

```text
⚠️ 采集异常

Table 展示
```

---

# 三十三、最终开发要求

请直接开始开发，不需要只给我设计建议。

开发前请：

1. 先分析当前项目目录结构
2. 查找类似页面
3. 确认 RuoYi 当前 Element UI 版本
4. 确认 API 请求封装方式
5. 确认 views 目录规范

然后：

1. 创建页面
2. 创建必要组件
3. 编写完整样式
4. 实现查询逻辑
5. 实现动态数据处理
6. 实现 Card
7. 实现 Drawer
8. 实现采集异常 Table
9. 实现 Loading
10. 实现空状态
11. 检查 ESLint
12. 确保项目可以正常编译

---

# 三十四、特别强调

这个页面最重要的不是“展示所有字段”，而是：

> **帮助用户快速发现异常资源，并快速理解异常情况。**

因此必须遵循：

```text
概览
↓
分类
↓
资源
↓
核心异常指标
↓
详情
```

的信息层级。

不要把页面做成：

```text
一个巨大 Table
```

也不要做成：

```text
每张 Card 塞满所有字段
```

最终效果应该是：

> 第一眼看概览
> 第二眼看哪个分类异常最多
> 第三眼定位具体资源
> 第四眼查看核心指标
> 需要时再打开详情

请严格按照以上产品和 UI 设计思路实现，同时结合当前项目已有的代码规范进行适配。完成后请汇报：

1. 修改/新增了哪些文件
2. 页面组件结构
3. 数据处理逻辑
4. 接口参数处理方式
5. 需要我确认的接口地址或字段
6. 是否存在需要后端配合的地方

不要擅自修改项目其他无关页面。
