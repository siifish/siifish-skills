# 小宇宙路由细节

小宇宙没有字幕可抓，只能解析音频直链 → ASR。

## 链接形式

- 单集页：`https://www.xiaoyuzhoufm.com/episode/<24位id>`（用户分享的通常是这种）
- 节目页：`https://www.xiaoyuzhoufm.com/podcast/<id>` —— 不是单集！让用户点开某一期拿 episode 链接

## 音频地址解析

单集页 HTML 内嵌 JSON 里有音频直链，脚本按三个正则依次尝试：

1. `"audioUrl":"https://…"` 
2. `https://cdn.xiaoyuzhoufm.com/….mp3|m4a|aac`
3. 泛化的 `"url":"…mp3|m4a|aac"`

==2026-09 实测命中的是第 3 条：真实 CDN 是 `media.xyzcdn.net/…mp3`（不在第 2 条的白名单里，
所以第 3 条兜底很重要）==。注意转义：页面 JSON 里可能出现 `\u002F` / `\/`，脚本已做替换。

HTTP 头要求：
- `User-Agent` 必须（脚本内置）
- `Referer: https://www.xiaoyuzhoufm.com/`（下载音频时建议带，已内置）

## 失败模式

| 现象 | 原因 | 对策 |
| --- | --- | --- |
| 页面 200 但解析不到音频 | 付费单集 / 页面结构改版 | 回退 yt-dlp 通用解析；仍失败则告知用户该单集需要登录态，建议用客户端导出音频再 `--backend` 本地转 |
| 音频下载 403 | CDN 校验 Referer/UA | 脚本已带头，仍 403 就换 yt-dlp |
| 播客 1~3 小时很常见 | 超长音频 | 脚本自动按 10 分钟切段，ASR 按段收费，提醒用户留意用量 |

## 手工验证某集音频地址

```bash
curl -s -A "Mozilla/5.0" "https://www.xiaoyuzhoufm.com/episode/<id>" \
  | grep -oE 'https://cdn\.xiaoyuzhoufm\.com/[^"]+\.(mp3|m4a)' | head -1
```
