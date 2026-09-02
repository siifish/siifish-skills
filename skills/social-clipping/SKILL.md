---
name: social-clipping
description: "Social content clipping methodology for share links."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [macos, linux, windows]
metadata:
  hermes:
    tags: [Social, Clipping, Archive, Bear, Methodology]
    related_skills: [social-media-extraction, bear-notes, blocked-page-recovery, ocr-and-documents]
---

# Social Clipping Methodology

## When to Use

Use this skill when the user wants to save a social-media or share-link post into their knowledge base. Typical triggers are phrases like:

- "剪藏到 Bear"
- "整理成文章"
- "把链接内容记下来"
- "提取原文"
- "记录到笔记"
- "保存这个链接"

It applies to any platform: 小红书, 微信公众号, B 站, 知乎, X/Twitter, etc. For platforms that already have a dedicated sub-skill (currently 小红书 via `social-media-extraction`), route to that sub-skill. For unsupported platforms, fall back to the generic extraction ladder in this skill.

## Core Idea

Turn a share-link into a clean, searchable, structured article with original media attached, then save it to the user's preferred note destination. Different platforms need different extraction ladders, but the same output template and workflow apply everywhere.

## Architecture

This is an **umbrella methodology skill**. The actual extraction for each platform lives in a **platform sub-skill** (e.g. `social-media-extraction` for 小红书 today). This skill defines the shared contract:

- output format
- title / tag conventions
- extraction ladder stages
- fallback policy
- interaction rules

## Workflow

When the user shares a link and asks to clip it:

1. **Identify the platform** from the URL domain / path.
2. **Route** to the platform sub-skill or, if none exists, to the generic ladder.
3. **Extract**: title, body text, images, comments, metadata.
4. **Organize** into the standard article template.
5. **Save** to the note destination via another skill (e.g. `bear-notes`).
6. **Report** what was saved, what was partial, and what needs manual follow-up.

## Standard output template

```markdown
# YYYY-MM-DD 合适的标题（来源剪藏）

> 来源：<original_url>
> 原帖/原文信息：<one-line summary>
> 整理说明：<what was extracted, any caveats>

## 一、要点总结

3-5 bullet takeaways from the content.

## 二、正文整理

Structured body content. Use headings, lists, tables, and blockquotes as needed.

### 图片 OCR 原文（如适用）

Group by image. Mark OCR uncertainty.

## 三、评论区精选（如适用）

Show top-level comments and author replies. State how many were loaded vs. total.

## 四、原始素材存档

- Original images attached at the bottom of the note.
- Raw OCR text can be kept in a collapsible code block or appendix if useful.

## 五、备注

- Caveats about OCR / extraction limits.
- What to check in the original app.

![](img_01.jpg)
![](img_02.jpg)
...
```

## Title convention

- Format: `YYYY-MM-DD 合适的标题（来源剪藏）`
- The "合适的标题" should be a short, descriptive title chosen by the assistant based on the content, not necessarily the original title verbatim.
- For 小红书, use `（小红书剪藏）`; for other platforms use a similar suffix.

## Tag convention

Always place tags below the title line, before the first section.

**Required tags**
- `#Notes/剪藏/小红书` (or the appropriate platform sub-tag)

**Recommended additional tags** (1-3, inferred from content)
- Topic tags from the user's existing tree (e.g. `#Research/研究领域/具身智能`, `#项目/实习招聘/...`).
- If a good match cannot be found, ask the user or create a dated sub-tag under `#项目/实习招聘/`.

## Platform sub-skill contract

A platform sub-skill must define:

| Item | Description |
|------|-------------|
| `match(url)` | Returns true if the URL belongs to this platform. |
| `extract(url)` | Returns a dict with at least `title`, `body`, `images`, `comments`, `metadata`, `source_url`. |
| `images_strategy` | One of `ignore`, `attach`, `ocr`. Default is `ocr`. |
| `comments_strategy` | One of `ignore`, `first_page`, `deep`. Default is `first_page`. |
| `deep_comments_threshold` | When `comments_strategy=first_page`, try deep scraping if total comments exceed this number. |

## Extraction ladder (generic)

Use this ladder when no platform sub-skill exists, or when a sub-skill step fails.

1. **Resolve short links** with a plain GET and mobile UA; HEAD often fails. Keep the final URL and query params.
2. **Fetch the resolved page** with mobile UA. Save HTML.
3. **Look for embedded JSON** (`window.__INITIAL_STATE__`, `__DATA__`, JSON-LD, etc.) and parse it.
4. **Fallback to clean extraction** (e.g. Firecrawl, `web_extract`) if embedded JSON is missing.
5. **Download images** with proper `Referer` and UA. Verify file magic bytes.
6. **OCR images** with macOS Vision via `ocrmac` when `images_strategy=ocr`. Human-pass before archiving if dense/stylized.
7. **Fetch comments**:
   - First try the platform's API or embedded data.
   - If only partial comments are available, save them with a note.
   - If `comments_strategy=deep` and comments exceed the threshold, use `browser_exec` to scroll and load more (requires user approval for remote debugging).
8. **Assemble the article** using the standard template.

## Comment handling policy

| Total comments | Action |
|----------------|--------|
| ≤ 5 | Load all from API/JSON if possible. |
| 6–20 | Load first page, annotate "共 N 条，仅展示首页". |
| > 20 or clearly valuable | Load first page, then attempt browser deep scrape if the user has approved remote debugging. Do not block saving the article while waiting. |

## Failure fallback policy

When extraction fails at any step, follow this ladder before giving up:

1. **Retry once**: change UA, add delay, re-fetch.
2. **Browser automation**: use `browser_exec` as a fallback for JS-rendered pages.
3. **Partial save**: save whatever was extracted (title, URL, partial text) with a clear "待补全" note.
4. **Escalate to user**: report the failure and ask whether to retry, skip, or try another tool.

## Interaction rules

- **Don't ask before acting** for the default flow. Extract and save automatically once the user says "剪藏".
- **Do ask** when:
  - The destination note system is unclear.
  - Content contains sensitive/paywalled/private material that shouldn't be archived.
  - Browser remote-debugging approval is needed.
  - No matching platform sub-skill exists and the generic ladder also fails.
- **Preserve identifiers**: keep the original URL, post ID, and author handle exactly as found.
- **Preserve media**: attach original images/files even when OCR text is included, so the user can verify.

## Pitfalls

- **Hashtags become Bear tags**: when pasting into Bear, rewrite `#话题[话题]#` as plain text lists. Remove leaked tags with `bearcli tags remove`.
- **OCR mixes columns** on dense tables (e.g. recruitment lists). Present raw OCR grouped by image plus a best-effort reconstructed table, clearly labeled.
- **Comment counts are misleading**: the JSON may report 26 comments but only embed 5. Always state what was actually loaded.
- **Image CDN checks Referer**: downloads fail without a proper `Referer`. Use `https://www.xiaohongshu.com/` for XHS; other platforms may need their own.
- **Browser automation requires approval**: on macOS, `browser_exec` needs the user to click "Allow remote debugging". Explain this once and wait.

## Example call pattern

```text
User: 查查这个链接 https://xhslink.cn/... 帮我剪藏到 Bear
Agent: [uses social-media-extraction to extract XHS post, then bear-notes to save]
```

## Platform Implementation: Xiaohongshu

This section is the concrete sub-skill for 小红书 (Xiaohongshu / RED). It follows the `social-clipping` contract and produces a structured article in Bear.

### Match URL

Match if the URL contains `xhslink.cn` or `xiaohongshu.com`.

### Contract values

| Field | Value |
|-------|-------|
| `images_strategy` | `ocr` |
| `comments_strategy` | `first_page` with deep fallback when `commentCount > 20` |
| `deep_comments_threshold` | 20 |

### Extraction ladder

#### 1. Resolve the short link (GET, never HEAD)

```bash
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
curl -s -A "$UA" "https://xhslink.cn/o/XXXX" -D - --max-time 20 | head -20
```

- 302 with `location: https://www.xiaohongshu.com/discovery/item/<id>?...&xsec_token=...`
- Keep the whole query string (`xsec_token` is required).
- `curl -IL` returns 404 because HEAD is unsupported; use plain GET.

#### 2. Fetch the item page

```bash
curl -s -A "$UA" "$ITEM_URL" --max-time 30 -o /tmp/xhs_note.html
```

#### 3. Parse `window.__INITIAL_STATE__`

```python
import re, json
content = open('/tmp/xhs_note.html', encoding='utf-8').read()
raw = re.search(r'window\.__INITIAL_STATE__=(.*?)</script>', content, re.S).group(1)
raw = re.sub(r':\s*undefined\b', ': null', raw)
data = json.loads(raw)

def find_note(d, depth=0):
    if depth > 6: return None
    if isinstance(d, dict):
        if 'desc' in d and isinstance(d.get('imageList'), list):
            return d
        for v in d.values():
            n = find_note(v, depth+1)
            if n: return n
    elif isinstance(d, list):
        for v in d:
            n = find_note(v, depth+1)
            if n: return n

note = find_note(data)
# note['title'], note['desc'], note['imageList'], note['user']
```

#### 4. Extract comments

```python
comments = data.get('noteData', {}).get('data', {}).get('commentData', {}).get('comments', [])
total_comments = data.get('noteData', {}).get('data', {}).get('commentData', {}).get('commentCount', 0)
```

Only the first page is available via plain HTTP. If `commentCount > 20`, consider browser automation for deep scraping, after asking the user for remote-debugging approval.

#### 5. Download images

```bash
curl -s -o img1.jpg --max-time 30 -A "$UA" -e "https://www.xiaohongshu.com/" "$IMG_URL"
```

- Use `imageList[i].urlDefault` or `imageList[i].url`.
- Verify JPEG magic `ff d8 ff`.

#### 6. OCR images

Use `ocrmac` via `uv` (zero install, macOS native):

```bash
cd /tmp && uv run --with ocrmac python - <<'EOF'
from ocrmac import ocrmac
import glob
for p in sorted(glob.glob('/tmp/xhs_imgs/img_*.jpg')):
    print(f"\n--- {p} ---")
    for t in ocrmac.OCR(p, language_preference=['zh-Hans']).recognize():
        print(t[0])
EOF
```

On dense/stylized tables, expect character-level errors and inverted line order. Present raw OCR grouped by image plus a best-effort reconstructed table labeled as approximate.

#### 7. Save to Bear

Create the note via `bearcli`:

```bash
bearcli create "YYYY-MM-DD 合适标题（小红书剪藏）" --tags "#Notes/剪藏/小红书,#..." --fields id,title < body.md
```

Attach images one by one:

```bash
cat img1.jpg | bearcli attachments add <note_id> --filename "img_01.jpg"
```

### XHS-specific title convention

- `YYYY-MM-DD 合适标题（小红书剪藏）`
- "合适标题" should summarize the content (e.g. "具身offer决赛圈三选一"), not just echo the original title.

### XHS-specific tag convention

Required: `#Notes/剪藏/小红书`

Recommended (1-3, auto-inferred from content): topic tags from the user's existing tree (e.g. `#Research/研究领域/具身智能`, `#项目/实习招聘/...`). If no good match, ask the user or create a dated sub-tag under `#项目/实习招聘/`.

### XHS-specific pitfalls

- **Hashtags become real Bear tags**: rewrite `#话题[话题]#` as plain text lists. Remove leaked tags with `bearcli tags remove`.
- **Comment counts misleading**: `commentCount` may be 26 while only 5 are embedded. Always report what was actually loaded.
- **OCR column mixing**: for image-based tables, provide raw OCR + a clearly-labeled "best-effort" table.
- **Duplicate headings**: if the note title is passed to `bearcli create` and the body also starts with an H1, remove the duplicate.
- **Attachment markdown must be preserved** when overwriting a note; otherwise Bear detaches files.

## Future platform sub-skills

- `wechat`: WeChat 公众号 / 视频号分享链接.
- `bilibili`: B 站动态 / 视频分享链接.
- `zhihu`: 知乎回答 / 文章.
- `twitter`: X / Twitter posts.
