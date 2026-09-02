# Platform reference stub

Use this as a starting point when adding support for a new social platform.

## Match URL

Describe the URL patterns that identify this platform. Examples:

- `https://mp.weixin.qq.com/s/...`
- `https://t.bilibili.com/...`
- `https://zhuanlan.zhihu.com/p/...`
- `https://twitter.com/.../status/...`

## Contract values

| Field | Recommended value |
|-------|-----------------|
| `images_strategy` | `ocr` / `attach` / `ignore` |
| `comments_strategy` | `first_page` / `deep` / `ignore` |
| `deep_comments_threshold` | 20 |

## Workflow summary

1. Resolve any short links.
2. Fetch the page with an appropriate UA and Referer.
3. Extract structured data (JSON, HTML, API, etc.).
4. Extract or infer first-page comments.
5. Download images if needed.
6. OCR images if `images_strategy=ocr`.
7. Assemble article using `references/output-template.md`.
8. Save to note destination and attach originals.

## Step-by-step commands

Document the exact commands or code snippets here. Include:

- curl commands with UA / Referer
- JSON parsing examples
- Image download logic
- OCR invocation
- Comment extraction limits

## Platform-specific conventions

### Title

`YYYY-MM-DD 合适标题（<平台> 剪藏）`

### Tags

Required: `#Notes/剪藏/<平台>`

Recommended: infer 1-3 topic tags from content.

## Pitfalls

List platform-specific gotchas here. Common ones:

- Auth walls / login required
- CDN Referer checks
- Rate limits
- Short-link resolution quirks
- Comment pagination limits
- OCR errors on platform-native image layouts
