---
name: media-transcript
description: "给链接出逐字稿：B站/YouTube 优先直抓字幕（零成本零误差），无字幕时下载音频走 ASR（SiliconFlow/Groq/OpenAI/本地 whisper 任选）；默认转写完直接发 .txt 文件，要求存笔记时才落 Bear。触发词：转文字、逐字稿、字幕提取、视频转文字、音频转文字、小宇宙转写、B站字幕、transcribe、把链接转成文字、会议纪要音频。"
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [Media, Transcript, ASR, Bilibili, Podcast, Bear]
    related_skills: [youtube-content, bear-notes]
---

# Media Transcript（链接 → 逐字稿）

## When to Use

用户丢来一个视频/音频/播客链接，想要原文逐字稿时。典型触发：

- "把这个 B站视频转成文字：BV…"
- "这期小宇宙帮我出个逐字稿"
- "这个 YouTube 演讲提取原文"
- "会议录屏/音频帮我转写一下"

不适用：实时语音转写（用实时 ASR）、需要带时间轴字幕文件输出（脚本目前输出纯文本）。

## Core Workflow

```
1. 解析链接      → 判断平台（bilibili / youtube / xiaoyuzhou / generic）
2. 元信息        → yt-dlp 或页面解析拿标题/时长
3. 字幕优先      → B站走官方接口直抓（含 AI 字幕，需登录 cookie）；
                   YouTube 走 yt-dlp 字幕字段；无字幕才动 ASR
4. 回退 ASR      → 下载音频转写（详见 references/asr-backends.md）
5. 产出 TXT      → 默认直接把 .txt 文件发给用户（Output Contract）
```

原则：==**字幕直抓永远优先于 ASR**——免费、零错误率==。只有拿不到字幕时才动 ASR。

## Input Routing（平台路由）

| 链接特征 | 平台 | 路由 |
| --- | --- | --- |
| bilibili.com / b23.tv | bilibili | 先 yt-dlp 拿字幕列表（CC + AI 字幕），无字幕走音频+ASR。细节见 references/bilibili.md |
| youtube.com / youtu.be | youtube | 同上（官方字幕 + auto-captions） |
| xiaoyuzhou.fm | 小宇宙 | 页面解析音频直链 → 下载 → ASR（无字幕可抓）。细节见 references/xiaoyuzhou.md |
| 其他 | generic | yt-dlp 能解析就通用音频+ASR，解析不了就停下问用户 |

执行入口统一是脚本，不要手写散装命令：

```bash
# B站字幕需要登录 cookie，三选一（本机已登录的浏览器最省事）：
export COOKIES=chrome                     # 或 firefox / safari / edge
export COOKIES=~/cookies.txt              # Netscape 格式（Get cookies.txt LOCALLY 插件导出）
export BILI_COOKIE="SESSDATA=xxx; ..."    # 开发者工具直接复制

python3 scripts/transcribe.py <url> [-o out.md] [--backend siliconflow|groq|openai|local]
```

- 依赖：python3.9+、ffmpeg、yt-dlp（不在 PATH 自动用 `uvx yt-dlp`）
- ASR 后端按环境变量自动探测：`SILICONFLOW_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`，都没有时报错提示（除非 `--backend local`）
- 首次使用前帮用户确认至少一个 key 已配置（见 references/asr-backends.md 的注册与价格）

## 验证与异常处理

- 脚本成功但正文 < 10 字 → 视为失败，换 `--force-asr` 重试
- B站 AI 字幕缺失但视频有声音 → `--force-asr`
- 时长 >1h 的音频会自动按 10 分钟切段发给 API，属正常行为
- 报错先读 stderr 最后几行，常见三类：yt-dlp 解析失败（链接失效/需要登录）、API 401（key 没配）、API 限流（等 30s 重试）

## Output Contract

### 目的地（默认行为）
- ==默认：转写完成后直接把 `.txt` 文件发给用户（Feishu 用 `MEDIA:/绝对路径` 附件）==，不落 Bear
- 用户明确说"存 Bear / 记笔记 / 存一下"时，才走 bearcli 落库
- 文件位置：`-o /tmp/<bvid或slug>.txt`；正文保留脚本的元信息头（标题/来源/转写方式/时长）

### Bear 版标题与标签（仅在用户要求存笔记时）
- 标题：`YYYY-MM-DD 🎙 <标题>`（音频/播客）或 `YYYY-MM-DD 📺 <标题>`（视频）
- 正文第一行内嵌标签，==必须带 `#TODO/unread`==（未读标记，读完用户自己摘）：
  - `#Notes/逐字稿/bilibili #TODO/unread` / `#Notes/逐字稿/小宇宙 #TODO/unread` / `#Notes/逐字稿/youtube #TODO/unread`
- 正文结构沿用脚本输出：标题 + 元信息引用块（来源/平台/转写方式/时长/日期）+ `---` + 逐字稿

### 收尾
- 报告转写方式（字幕直抓 or ASR 后端）+ 字数，附上文件
- 正文明显异常时（乱码/大段空白/中英混杂失控）如实告知，不要硬交付
- ==B站 AI 字幕直抓的文本没有标点（B站源数据即如此），逐字稿用于阅读时可选做一次 LLM 后处理：加标点、分段——一句提示词即可，记得保持原文零删改==

## 边界与注意

- **版权与隐私**：转写内容仅限用户个人学习使用；付费/会员专属内容可能拿不到音频或字幕，脚本会失败并报错，不要绕过付费墙
- 小宇宙付费单集解析不到音频属正常（需要登录态）
- B站会员专享视频需要 SESSDATA cookie，脚本不支持，遇到就提示用户换公开视频
