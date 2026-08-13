---
name: glm-vision
description: 调用智谱 GLM-4V-Flash 视觉模型识别/理解图片。当用户需要描述图片、OCR 文字识别、图片问答、图表分析、截图/UI 理解时使用。
---

# GLM-4V-Flash 视觉识别

使用智谱开放平台的免费视觉模型 `glm-4v-flash` 识别、描述、理解图片。

## 何时使用

- 用户要求描述 / 识别 / 理解某张图片、截图、照片
- 提取图片中的文字（OCR）
- 针对图片内容提问
- 分析图表、报表截图、UI 截图、架构图

## 使用方法

辅助脚本封装了图片读取、base64 编码、API 调用与结果解析。拿到图片的本地路径或 URL 后，直接运行：

```bash
python .claude/skills/glm-vision/scripts/vision.py <图片路径或URL> [-p 提示词]
```

提示词可省略（默认会详细描述图片），也可通过 stdin 传入。示例：

```bash
# 描述图片（默认提示词）
python .claude/skills/glm-vision/scripts/vision.py ./screenshot.png

# OCR 提取文字
python .claude/skills/glm-vision/scripts/vision.py ./invoice.jpg -p "提取图中的所有文字"

# 分析图表
python .claude/skills/glm-vision/scripts/vision.py ./chart.png -p "这个图表反映了什么趋势？"

# 多图对比
python .claude/skills/glm-vision/scripts/vision.py ./a.png ./b.png -p "对比这两张图的差异"

# 直接从 stdin 传提示词
echo "图里有什么" | python .claude/skills/glm-vision/scripts/vision.py ./img.jpg

# 直接用公网图片 URL
python .claude/skills/glm-vision/scripts/vision.py "https://example.com/img.jpg" -p "图里有什么"
```

脚本会把识别结果以纯文本打印到 stdout。读取该输出，再按用户需要整理成最终答复。

## API Key 配置

脚本按以下顺序读取 API Key：

1. 环境变量 `ZHIPU_API_KEY`
2. 同目录上层的 `config.json`（已默认配置，并已加入 `.gitignore`）

更换或临时覆盖 Key：

```bash
export ZHIPU_API_KEY="你的新key"
```

## 注意事项

- 免费模型有速率限制，超限会返回 429，稍后重试即可
- 支持 jpg / jpeg / png / webp / gif / bmp，建议单张小于 10MB
- 若本地 base64 调用失败，改用公网图片 URL 重试
