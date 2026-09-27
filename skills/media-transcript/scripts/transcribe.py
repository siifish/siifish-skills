#!/usr/bin/env python3
"""
media-transcript：给链接，出逐字稿。

链接 →（优先）直抓平台字幕 /（回退）下载音频 → ASR → markdown 逐字稿。

支持平台：B站（bilibili.com / b23.tv）、YouTube、小宇宙播客（xiaoyuzhou.fm）、
其余 yt-dlp 通用可解析的站点。

依赖：python3.9+、ffmpeg、yt-dlp（不在 PATH 时自动改用 `uvx yt-dlp`）。
ASR 后端（任选其一，按环境变量自动探测）：SILICONFLOW_API_KEY /
GROQ_API_KEY / OPENAI_API_KEY，或 --backend local（需 faster-whisper）。

用法：
  transcribe.py <url> [-o out.md] [--backend siliconflow|groq|openai|local]
                [--model M] [--lang zh] [--force-asr] [--no-subs] [--keep-temp]
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")

BACKENDS = {
    "siliconflow": {
        "url": "https://api.siliconflow.cn/v1/audio/transcriptions",
        "env": "SILICONFLOW_API_KEY",
        "model": "FunASR/sense-voice-small",
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/audio/transcriptions",
        "env": "GROQ_API_KEY",
        "model": "whisper-large-v3-turbo",
    },
    "openai": {
        "url": "https://api.openai.com/v1/audio/transcriptions",
        "env": "OPENAI_API_KEY",
        "model": "whisper-1",
    },
}

MAX_WAV_BYTES = 20 * 1024 * 1024   # 约 10 分钟 16k 单声道，给 API 留余量
SEGMENT_SECONDS = 600
CRLF = chr(13) + chr(10)


# ---------------------------------------------------------------- 基础工具

def log(msg):
    print(f"[media-transcript] {msg}", file=sys.stderr)


def run(cmd, **kw):
    """运行命令，失败抛 RuntimeError（附 stderr 尾部）。"""
    proc = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-800:]
        raise RuntimeError(f"命令失败: {' '.join(map(str, cmd))}\n{tail}")
    return proc


def yt_dlp():
    exe = shutil.which("yt-dlp")
    if exe:
        return [exe]
    if shutil.which("uvx"):
        return ["uvx", "yt-dlp"]
    raise RuntimeError("未找到 yt-dlp，请先安装：brew install yt-dlp 或 pipx install yt-dlp")


def cookie_args():
    """--cookies-from-browser <浏览器名> 或 --cookies <文件>，环境变量 COOKIES 指定。"""
    c = os.environ.get("COOKIES") or os.environ.get("YTDLP_COOKIES")
    if not c:
        return []
    if "/" in c or c.endswith((".txt", ".cookies")):
        return ["--cookies", c]
    return ["--cookies-from-browser", c]


def http_get(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def detect_platform(url):
    u = url.lower()
    if "bilibili.com" in u or "b23.tv" in u:
        return "bilibili"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "xiaoyuzhoufm.com" in u:
        return "xiaoyuzhou"
    return "generic"


# ------------------------------------------------------------ 元信息获取

def yt_dlp_info(url):
    # --no-playlist：B站合集/分P 链接只取当前这一P，避免枚举整个列表
    proc = run(yt_dlp() + ["--dump-single-json", "--skip-download",
                           "--no-playlist", *cookie_args(), url])
    return json.loads(proc.stdout)


def xiaoyuzhou_page(url):
    html = http_get(url, headers={"Referer": "https://www.xiaoyuzhoufm.com/"},
                    timeout=30).decode("utf-8", "ignore")
    title = None
    m = re.search(r'property="og:title"\s+content="([^"]+)"', html) or \
        re.search(r"<title[^>]*>(.*?)</title>", html, re.S)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip().split("|")[0].strip()
    return html, title


# ------------------------------------------------------------ 字幕直抓

def pick_subtitle_lang(info):
    """从 yt-dlp info 里挑一个字幕。返回 (是否AI字幕, 语言码, 下载url)。"""
    def candidates(d, auto):
        for lang, subs in (d or {}).items():
            for s in subs:
                if s.get("url"):
                    yield auto, lang, s["url"], s.get("ext", "")
    allc = list(candidates(info.get("subtitles"), False)) + \
           list(candidates(info.get("automatic_captions"), True))

    def score(item):
        auto, lang, _, _ = item
        l = lang.lower()
        s = 0
        if "zh" in l or "chi" in l:
            s += 100
        if l in ("zh-hans", "zh-cn", "zh-hans-cn", "ai-zh", "zh"):
            s += 20
        if l.startswith("en"):
            s += 10
        if auto:
            s -= 1        # 同名时优先人工字幕
        return -s
    return sorted(allc, key=score)[0] if allc else None


def parse_subtitles(raw, ext):
    """把 srt/vtt/B站json 统一转成 [(start, end, text)]，单位秒。"""
    def ts2s(t):
        t = t.replace(",", ".")
        parts = t.split(":")
        try:
            return float(parts[-1]) + 60 * float(parts[-2]) + 3600 * float(parts[-3])
        except (ValueError, IndexError):
            return 0.0

    cues = []
    ext = (ext or "").lower()
    if ext == "json" or raw.lstrip().startswith("{"):
        data = json.loads(raw)
        body = data.get("body") or []
        for b in body:
            cues.append((float(b.get("from", 0)), float(b.get("to", 0)),
                         str(b.get("content", "")).strip()))
    else:
        blocks = re.split(r"\n\s*\n", raw.replace("\r\n", "\n"))
        for blk in blocks:
            lines = [l for l in blk.split("\n") if l.strip()]
            if not lines:
                continue
            if lines[0].strip().upper().startswith(("WEBVTT", "NOTE", "STYLE", "REGION")) \
               or lines[0].startswith(("Kind:", "Language:")):
                continue
            m = None
            for i, l in enumerate(lines):
                m = re.match(r"(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*"
                             r"(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}", l)
                if m:
                    lines = lines[i:]
                    break
            if not m:
                continue
            start = ts2s(m.group(0).split("-->")[0].strip())
            end = ts2s(m.group(0).split("-->")[1].strip())
            text = " ".join(lines[1:])
            text = re.sub(r"<[^>]+>", "", text)          # VTT 内联时间戳/标签
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                cues.append((start, end, text))
    # VTT 卡拉OK重复行去重：相邻完全相同文本只留一条
    deduped = []
    for c in cues:
        if deduped and deduped[-1][2] == c[2]:
            deduped[-1] = (deduped[-1][0], c[1], c[2])
        else:
            deduped.append(c)
    return deduped


def cues_to_text(cues, para_gap=2.0):
    """按时间空隙分段，输出纯文本逐字稿。"""
    paras, cur = [], []
    prev_end = None
    for start, end, text in cues:
        if prev_end is not None and start - prev_end > para_gap and cur:
            paras.append("".join(cur))
            cur = []
        cur.append(text)
        prev_end = end
    if cur:
        paras.append("".join(cur))
    return "\n\n".join(p for p in paras if p.strip())


def fetch_subtitles(info):
    """YouTube 等：从 yt-dlp info 里挑字幕。返回 cues 或 None。"""
    pick = pick_subtitle_lang(info)
    if not pick:
        return None
    auto, lang, sub_url, ext = pick
    log(f"发现{'AI' if auto else '人工'}字幕：{lang}")
    raw = http_get(sub_url, headers={"Referer": "https://www.bilibili.com/"},
                   timeout=30).decode("utf-8", "ignore")
    if not ext:
        ext = "json" if raw.lstrip().startswith("{") else "vtt"
    return parse_subtitles(raw, ext)


# ------------------------------------------------------------ B站直连接口

def resolve_shortlink(url):
    """b23.tv 短链 → 最终地址。"""
    if "b23.tv" not in url:
        return url
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.url


def bili_cookie_header():
    """按优先级解析 B站 cookie：BILI_COOKIE 原始串 > COOKIES=文件 > COOKIES=浏览器名。"""
    raw = os.environ.get("BILI_COOKIE")
    if raw:
        return raw
    c = os.environ.get("COOKIES") or os.environ.get("YTDLP_COOKIES")
    if not c:
        return None
    if "/" in c or c.endswith((".txt", ".cookies")):      # Netscape cookies.txt
        pairs = []
        for line in Path(c).read_text(errors="ignore").splitlines():
            if line.startswith("#") or not line.strip():
                continue
            f = line.split("\t")
            if len(f) >= 7 and "bilibili.com" in f[0]:
                pairs.append(f"{f[5]}={f[6]}")
        return "; ".join(pairs) or None
    # 浏览器名：借 browser_cookie3 读（需要 uvx --with browser-cookie3 可用）
    try:
        proc = subprocess.run(
            ["uvx", "--with", "browser-cookie3", "python3", "-c",
             "import browser_cookie3;"
             "print('; '.join(f'{c.name}={c.value}' for c in "
             f"browser_cookie3.{c}(domain_name='bilibili.com')))"],
            capture_output=True, text=True, timeout=120)
        if proc.returncode == 0 and proc.stdout.strip():
            # uvx 可能把包下载进度混进 stdout，取最后一行含 = 的
            lines = [l for l in proc.stdout.splitlines() if "=" in l]
            if lines:
                return lines[-1].strip()
    except Exception as e:
        log(f"读取浏览器 cookie 失败：{e}")
    return None


def bilibili_api(url, cookie=None):
    headers = {"User-Agent": UA, "Referer": "https://www.bilibili.com/"}
    if cookie:
        headers["Cookie"] = cookie
    return headers


def bilibili_subtitle_cues(url):
    """B站官方接口直拿字幕（含 AI 字幕）。yt-dlp 的字幕字段对 B站不可靠。
    返回 cues、或 None（无字幕/未登录）。"""
    url = resolve_shortlink(url)
    m = re.search(r"(BV[0-9A-Za-z]+|av\d+)", url)
    if not m:
        return None
    vid = m.group(1)
    key, q = ("bvid", vid) if vid.startswith("BV") else ("aid", vid.lstrip("av"))
    cookie = bili_cookie_header()
    if not cookie:
        log("未配置 B站 cookie（BILI_COOKIE / COOKIES），AI 字幕需要登录态，跳过字幕直抓")
        return None
    headers = bilibili_api(url, cookie)
    view = json.loads(http_get(f"https://api.bilibili.com/x/web-interface/view?{key}={q}",
                               headers=headers).decode())
    data = view.get("data") or {}
    cid = (data.get("pages") or [{}])[0].get("cid")
    if not cid:
        return None
    player = json.loads(http_get(
        f"https://api.bilibili.com/x/player/v2?{key}={q}&cid={cid}",
        headers=headers).decode())
    subs = ((player.get("data") or {}).get("subtitle") or {}).get("subtitles") or []
    if not subs:
        return None
    sub = sorted(subs, key=lambda s: 0 if "zh" in (s.get("lan") or "") else 1)[0]
    log(f"发现B站字幕：{sub.get('lan')}（{'AI' if sub.get('ai_status') else '人工'}）")
    sub_url = (sub.get("subtitle_url") or "").lstrip("/")
    if sub_url.startswith("aisubtitle") or sub_url.startswith("i0"):
        sub_url = "https://" + sub_url
    raw = http_get(sub_url, headers=headers, timeout=30).decode("utf-8", "ignore")
    return parse_subtitles(raw, "json")


# ------------------------------------------------------------ 音频获取

def download_audio_ytdlp(url, out_wav):
    log("下载音频（yt-dlp）…")
    tmp = out_wav.parent / "audio_raw"
    run(yt_dlp() + ["-x", "--audio-format", "wav", "--audio-quality", "0",
                    "--no-playlist", *cookie_args(),
                    "-o", str(tmp) + ".%(ext)s", url])
    produced = sorted(out_wav.parent.glob("audio_raw.*"))
    if not produced:
        raise RuntimeError("yt-dlp 未产出音频文件")
    run(["ffmpeg", "-y", "-v", "error", "-i", str(produced[0]),
         "-ac", "1", "-ar", "16000", str(out_wav)])


def xiaoyuzhou_audio_url(html):
    patterns = [
        r'"audioUrl"\s*:\s*"(https?://[^"]+)"',
        r'"(https?://cdn\.xiaoyuzhoufm\.com/[^"]+?\.(?:mp3|m4a|aac)[^"]*)"',
        r'"url"\s*:\s*"(https?://[^"]+?\.(?:mp3|m4a|aac)(?:\?[^"]*)?)"',
    ]
    for p in patterns:
        m = re.search(p, html)
        if m:
            return m.group(1).replace("\\u002F", "/").replace("\\/", "/")
    return None


def download_audio_xiaoyuzhou(url, out_wav):
    log("解析小宇宙音频地址…")
    html, _ = xiaoyuzhou_page(url)
    audio = xiaoyuzhou_audio_url(html)
    if not audio:
        log("页面未解析到音频地址，回退 yt-dlp 通用解析")
        return download_audio_ytdlp(url, out_wav)
    log(f"音频地址：{audio[:90]}…")
    data = http_get(audio, headers={"Referer": "https://www.xiaoyuzhoufm.com/"},
                    timeout=120)
    raw = out_wav.parent / "audio_raw"
    raw.write_bytes(data)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(raw),
         "-ac", "1", "-ar", "16000", str(out_wav)])


# ------------------------------------------------------------ ASR

def default_backend():
    for name, cfg in BACKENDS.items():
        if os.environ.get(cfg["env"]):
            return name
    return None


def multipart_body(path, fields):
    boundary = uuid.uuid4().hex
    chunks = []
    for k, v in fields.items():
        head = ("--" + boundary + CRLF
                + 'Content-Disposition: form-data; name="' + k + '"' + CRLF + CRLF
                + v + CRLF)
        chunks.append(head.encode())
    fname = Path(path).name
    head = ("--" + boundary + CRLF
            + 'Content-Disposition: form-data; name="file"; filename="' + fname + '"'
            + CRLF + "Content-Type: audio/wav" + CRLF + CRLF)
    chunks.append(head.encode())
    chunks.append(Path(path).read_bytes())
    chunks.append((CRLF + "--" + boundary + "--" + CRLF).encode())
    return boundary, b"".join(chunks)


def transcribe_api(wav_path, backend, model=None, lang=None):
    cfg = BACKENDS[backend]
    key = os.environ.get(cfg["env"])
    if not key:
        raise RuntimeError(f"后端 {backend} 需要环境变量 {cfg['env']}（export {cfg['env']}=sk-...）")
    fields = {"model": model or cfg["model"], "response_format": "json"}
    if lang:
        fields["language"] = lang
    boundary, body = multipart_body(wav_path, fields)
    req = urllib.request.Request(
        cfg["url"], data=body, method="POST",
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            return json.loads(resp.read().decode()).get("text", "").strip()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{backend} API 报错 {e.code}: {e.read().decode()[:300]}")


def transcribe_local(wav_path, model="small", lang=None):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise RuntimeError("本地模式需要 faster-whisper：pip install faster-whisper")
    m = WhisperModel(model, device="auto", compute_type="auto")
    segments, _ = m.transcribe(str(wav_path), language=lang or "zh", vad_filter=True)
    return "".join(s.text.strip() for s in segments)


def split_wav(wav_path, tmpdir):
    """超过 API 上限的音频切成 10 分钟段。"""
    if wav_path.stat().st_size <= MAX_WAV_BYTES:
        return [wav_path]
    log(f"音频超过 {MAX_WAV_BYTES // 1024 // 1024}MB，按 {SEGMENT_SECONDS}s 切段")
    out = str(tmpdir / "seg_%03d.wav")
    run(["ffmpeg", "-y", "-v", "error", "-i", str(wav_path),
         "-f", "segment", "-segment_time", str(SEGMENT_SECONDS), "-c", "copy", out])
    return sorted(tmpdir.glob("seg_*.wav"))


def transcribe_audio(wav_path, backend, model=None, lang=None, tmpdir=None):
    parts = split_wav(wav_path, tmpdir) if tmpdir else [wav_path]
    texts = []
    for i, seg in enumerate(parts, 1):
        log(f"ASR 转写中（{i}/{len(parts)} 段）…")
        if backend == "local":
            texts.append(transcribe_local(seg, model=model or "small", lang=lang))
        else:
            texts.append(transcribe_api(seg, backend, model=model, lang=lang))
    return "\n\n".join(t for t in texts if t.strip())


# ------------------------------------------------------------ 主流程

def fmt_duration(sec):
    if not sec:
        return None
    sec = int(sec)
    if sec >= 3600:
        return f"{sec // 3600}:{(sec % 3600) // 60:02d}:{sec % 60:02d}"
    return f"{sec // 60:02d}:{sec % 60:02d}"


def build_markdown(title, url, platform, method, transcript, duration=None):
    import datetime
    today = datetime.date.today().isoformat()
    lines = [
        f"# {title or '未命名音视频'}",
        "",
        f"> - 来源：{url}",
        f"> - 平台：{platform}",
        f"> - 转写方式：{method}",
    ]
    if duration:
        lines.append(f"> - 时长：{duration}")
    lines += [f"> - 整理日期：{today}", "", "---", ""]
    return "\n".join(lines) + transcript.strip() + "\n"


def main():
    ap = argparse.ArgumentParser(description="链接 → 逐字稿 markdown")
    ap.add_argument("url")
    ap.add_argument("-o", "--out", help="输出 markdown 路径（默认打印到 stdout）")
    ap.add_argument("--backend", choices=["siliconflow", "groq", "openai", "local"],
                    default=None, help="ASR 后端（默认按环境变量自动探测）")
    ap.add_argument("--model", help="覆盖默认 ASR 模型名")
    ap.add_argument("--lang", help="语言提示，如 zh / en（whisper 系后端有效）")
    ap.add_argument("--force-asr", action="store_true", help="跳过字幕直抓，直接 ASR")
    ap.add_argument("--no-subs", action="store_true", help="同 --force-asr")
    ap.add_argument("--keep-temp", action="store_true", help="保留临时文件目录")
    args = ap.parse_args()

    platform = detect_platform(args.url)
    tmp = Path(tempfile.mkdtemp(prefix="media-transcript-"))
    try:
        info = None
        title, duration = None, None
        if platform in ("bilibili", "youtube", "generic"):
            try:
                info = yt_dlp_info(args.url)
                title, duration = info.get("title"), info.get("duration")
            except RuntimeError as e:
                log(f"yt-dlp 解析失败，尝试页面直取：{e}")

        cues = None
        if not (args.force_asr or args.no_subs):
            if platform == "bilibili":
                cues = bilibili_subtitle_cues(args.url)
            elif info:
                cues = fetch_subtitles(info)

        if cues:
            method = "平台字幕直抓（零 ASR）"
            transcript = cues_to_text(cues)
            duration = duration or (cues[-1][1] if cues else None)
        else:
            backend = args.backend or default_backend()
            if not backend:
                raise RuntimeError(
                    "无可用 ASR 后端。请 export SILICONFLOW_API_KEY / GROQ_API_KEY / "
                    "OPENAI_API_KEY 之一，或用 --backend local（需 faster-whisper）")
            wav = tmp / "audio.wav"
            if platform == "xiaoyuzhou":
                try:
                    download_audio_xiaoyuzhou(args.url, wav)
                except Exception as e:
                    log(f"小宇宙直取失败，回退 yt-dlp：{e}")
                    download_audio_ytdlp(args.url, wav)
                if not title:
                    try:
                        _, title = xiaoyuzhou_page(args.url)
                    except Exception:
                        pass
            else:
                download_audio_ytdlp(args.url, wav)
            if backend == "local":
                used_model = args.model or "small"
            else:
                used_model = args.model or BACKENDS[backend]["model"]
            method = f"ASR（{backend} / {used_model}）"
            transcript = transcribe_audio(wav, backend, model=args.model,
                                          lang=args.lang, tmpdir=tmp)
            if not duration:
                probe = subprocess.run(
                    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                     "-of", "csv=p=0", str(wav)],
                    capture_output=True, text=True)
                try:
                    duration = float(probe.stdout.strip())
                except ValueError:
                    pass

        if not transcript or len(transcript) < 10:
            raise RuntimeError("转写结果为空，请检查链接或换 --force-asr 重试")

        md = build_markdown(title, args.url, platform, method, transcript,
                            fmt_duration(duration))
        if args.out:
            Path(args.out).write_text(md)
            log(f"已写出 {args.out}（正文 {len(transcript)} 字）")
        else:
            print(md)
    finally:
        if args.keep_temp:
            log(f"临时目录保留在 {tmp}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, json.JSONDecodeError) as e:
        log(f"失败：{e}")
        sys.exit(1)
