# B站路由细节

## 字幕层级（脚本自动按此优先级挑）

1. **人工 CC 字幕**（up 主上传）：最准
2. **AI 字幕**（B站自动生成，`lan: ai-zh`）：==2026-09 实测，B站字幕接口（含 AI 字幕）必须带登录 cookie，否则返回空列表==
3. 无字幕 → 回退音频 + ASR

## 实现方式：官方接口直连，不信 yt-dlp

==实测发现 yt-dlp 的 `--cookies-from-browser` 能读到 cookie，但其 bilibili 提取器的
`subtitles`/`automatic_captions` 字段依然为空（对 B站不可靠）==。因此脚本对 B站走
官方 API 直连：

1. `GET https://api.bilibili.com/x/web-interface/view?bvid=…` → 拿 `cid`、标题、时长
2. `GET https://api.bilibili.com/x/player/v2?bvid=…&cid=…`（带 Cookie 头）→ `data.subtitle.subtitles`
3. 选 `lan` 含 `zh` 的字幕，抓 `subtitle_url`（`//aisubtitle.hdslb.com/…json`，需补 `https:`）
4. 内容是 JSON：`{"body":[{"from":0.0,"to":1.2,"content":"…"}]}`

Cookie 来源三选一（脚本 `bili_cookie_header` 自动按此优先级解析）：
- `BILI_COOKIE` 环境变量：原始 `SESSDATA=xxx; bili_jct=…` 串
- `COOKIES=/path/cookies.txt`：Netscape 格式（Chrome 插件 "Get cookies.txt LOCALLY" 导出）
- `COOKIES=chrome`（浏览器名）：脚本会 `uvx --with browser-cookie3` 现场读，已在本机验证可行

坑：==uvx 首次下载 browser-cookie3 时会把进度输出混进 stdout，脚本已做过滤（取最后一行含 `=` 的）==。

## 已知限制

- 未登录 → 拿不到任何字幕 → 自动回退 ASR（日志会有提示）
- **会员专享视频**音频流需要登录态，脚本不带会员 cookie 给 yt-dlp 时会失败 → 遇到就告诉用户换公开视频
- **合集/分P 链接**：脚本全程带 `--no-playlist`（==坑：不带的话 yt-dlp 会枚举整个合集，
  146 个分P 能跑十几分钟==）；默认取第 1 P，指定分P 用 `?p=N`
- 老视频（2019 年前）可能没有 AI 字幕，属正常

## 快速验证某 BV 有没有字幕

```bash
COOKIES=chrome python3 - <<'EOF'
import sys; sys.path.insert(0, "skills/media-transcript/scripts")
import transcribe as t
cues = t.bilibili_subtitle_cues("https://www.bilibili.com/video/BVxxxx")
print("有字幕" if cues else "无字幕", len(cues or []))
EOF
```
