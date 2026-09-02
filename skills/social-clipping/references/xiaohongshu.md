# Xiaohongshu (小红书) platform reference

Platform sub-skill for 小红书 (Xiaohongshu / RED). Follows the `social-clipping` contract and produces a structured article in Bear.

## Match URL

Match if the URL contains `xhslink.cn` or `xiaohongshu.com`.

## Contract values

| Field | Value |
|-------|-------|
| `images_strategy` | `ocr` |
| `comments_strategy` | `first_page` with deep fallback when `commentCount > 20` |
| `deep_comments_threshold` | 20 |

## Workflow summary

1. Resolve short link with mobile UA (GET, not HEAD).
2. Fetch item page with mobile UA.
3. Parse `window.__INITIAL_STATE__` JSON.
4. Extract note data and first-page comments.
5. Download images with proper Referer.
6. OCR images with `ocrmac`.
7. Assemble article using `references/output-template.md`.
8. Save to Bear and attach original images.

## Step-by-step commands

### 1. Resolve the short link (GET, never HEAD)

```bash
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
curl -s -A "$UA" "https://xhslink.cn/o/XXXX" -D - --max-time 20 | head -20
```

- 302 with `location: https://www.xiaohongshu.com/discovery/item/<id>?...&xsec_token=...`
- Keep the whole query string (`xsec_token` is required).
- `curl -IL` returns 404 because HEAD is unsupported; use plain GET.

### 2. Fetch the item page

```bash
curl -s -A "$UA" "$ITEM_URL" --max-time 30 -o /tmp/xhs_note.html
```

### 3. Parse `window.__INITIAL_STATE__`

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

### 4. Extract comments

```python
comments = data.get('noteData', {}).get('data', {}).get('commentData', {}).get('comments', [])
total_comments = data.get('noteData', {}).get('data', {}).get('commentData', {}).get('commentCount', 0)
```

Only the first page is available via plain HTTP. If `commentCount > 20`, consider browser automation for deep scraping, after asking the user for remote-debugging approval.

### 5. Download images

```bash
curl -s -o img1.jpg --max-time 30 -A "$UA" -e "https://www.xiaohongshu.com/" "$IMG_URL"
```

- Use `imageList[i].urlDefault` or `imageList[i].url`.
- Verify JPEG magic `ff d8 ff`.

### 6. OCR images

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

### 7. Save to Bear

Create the note via `bearcli`:

```bash
bearcli create "YYYY-MM-DD 合适标题（小红书剪藏）" --tags "#Notes/剪藏/小红书,#..." --fields id,title < body.md
```

Attach images one by one:

```bash
cat img1.jpg | bearcli attachments add <note_id> --filename "img_01.jpg"
```

## XHS-specific conventions

### Title

- `YYYY-MM-DD 合适标题（小红书剪藏）`
- "合适标题" should summarize the content (e.g. "具身offer决赛圈三选一"), not just echo the original title.

### Tags

Required: `#Notes/剪藏/小红书`

Recommended (1-3, auto-inferred from content): topic tags from the user's existing tree (e.g. `#Research/研究领域/具身智能`, `#项目/实习招聘/...`). If no good match, ask the user or create a dated sub-tag under `#项目/实习招聘/`.

## Pitfalls

- **Hashtags become real Bear tags**: rewrite `#话题[话题]#` as plain text lists. Remove leaked tags with `bearcli tags remove`.
- **Comment counts misleading**: `commentCount` may be 26 while only 5 are embedded. Always report what was actually loaded.
- **OCR column mixing**: for image-based tables, provide raw OCR + a clearly-labeled "best-effort" table.
- **Duplicate headings**: if the note title is passed to `bearcli create` and the body also starts with an H1, remove the duplicate.
- **Attachment markdown must be preserved** when overwriting a note; otherwise Bear detaches files.
