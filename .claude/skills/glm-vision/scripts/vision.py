#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""调用智谱 GLM-4V-Flash 视觉模型识别/理解图片。

用法:
    python vision.py <图片路径或URL> [-p 提示词]
    echo "提示词" | python vision.py <图片路径或URL>

图片既可以是本地文件路径（自动转 base64），也可以是公网 http(s) URL。
识别结果以纯文本打印到 stdout。
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request

# 强制 UTF-8 输出，避免 Windows 控制台中文乱码
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
MODEL = "glm-4v-flash"
DEFAULT_PROMPT = "请详细描述这张图片的内容。"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)


def load_api_key():
    """按优先级读取 API Key: 环境变量 -> config.json。"""
    key = os.environ.get("ZHIPU_API_KEY", "").strip()
    if key:
        return key

    config_path = os.path.join(SKILL_DIR, "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            key = (cfg.get("api_key") or "").strip()
            if key:
                return key
        except (OSError, ValueError):
            pass
    return None


def image_to_url(image):
    """把本地路径或公网 URL 转成接口可用的 url 字符串。"""
    if image.startswith("http://") or image.startswith("https://"):
        return image

    path = os.path.abspath(image)
    if not os.path.exists(path):
        print(
            f"错误: 文件不存在: {image}（提示词请用 -p 传入，例如 -p \"描述这张图\"）",
            file=sys.stderr,
        )
        sys.exit(1)
    if os.path.isdir(path):
        print(f"错误: 是目录而非图片: {image}", file=sys.stderr)
        sys.exit(1)

    with open(path, "rb") as f:
        data = f.read()
    if not data:
        print(f"错误: 文件为空: {image}", file=sys.stderr)
        sys.exit(1)

    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def call_api(images, prompt, api_key, temperature):
    content = [
        {"type": "image_url", "image_url": {"url": image_to_url(img)}}
        for img in images
    ]
    content.append({"type": "text", "text": prompt})

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": content}],
        "temperature": temperature,
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer {}".format(api_key),
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print("HTTP {} 错误: {}".format(e.code, body), file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print("网络错误: {}".format(e.reason), file=sys.stderr)
        sys.exit(1)

    try:
        return result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        print(
            "接口返回异常: {}".format(json.dumps(result, ensure_ascii=False)),
            file=sys.stderr,
        )
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="调用智谱 GLM-4V-Flash 识别图片"
    )
    parser.add_argument("images", nargs="+", help="图片本地路径或 URL，可传多个")
    parser.add_argument(
        "-p",
        "--prompt",
        default=None,
        help="提示词（可选，缺省时从 stdin 读取，否则使用默认描述）",
    )
    parser.add_argument(
        "--temperature", type=float, default=0.7, help="采样温度，默认 0.7"
    )
    args = parser.parse_args()

    prompt = args.prompt
    if not prompt:
        if not sys.stdin.isatty():
            prompt = sys.stdin.read().strip()
    prompt = prompt or DEFAULT_PROMPT

    api_key = load_api_key()
    if not api_key:
        print(
            "错误: 未找到 API Key。请设置环境变量 ZHIPU_API_KEY 或编辑 config.json。",
            file=sys.stderr,
        )
        sys.exit(1)

    text = call_api(args.images, prompt, api_key, args.temperature)
    print(text)


if __name__ == "__main__":
    main()
