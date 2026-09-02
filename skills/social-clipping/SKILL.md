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

It applies to any platform: 小红书, 微信公众号, B 站, 知乎, X/Twitter, etc. For platforms that already have a dedicated reference (currently 小红书), route to that reference. For unsupported platforms, fall back to the generic extraction ladder in this skill.

## Core Idea

Turn a share-link into a clean, searchable, structured article with original media attached, then save it to the user's preferred note destination. Different platforms need different extraction ladders, but the same output template and workflow apply everywhere.

## Architecture

This is an **umbrella methodology skill**. The actual extraction for each platform lives in a **platform reference** under `references/<platform>.md`. This skill defines the shared contract:

- output format
- title / tag conventions
- extraction ladder stages
- fallback policy
- interaction rules

Platform references contain the concrete commands and pitfalls for that platform.

## Workflow

When the user shares a link and asks to clip it:

1. **Identify the platform** from the URL domain / path.
2. **Route** to the platform reference or, if none exists, to the generic ladder.
3. **Extract**: title, body text, images, comments, metadata.
4. **Organize** into the standard article template (see `references/output-template.md`).
5. **Save** to the note destination via another skill (e.g. `bear-notes`).
6. **Report** what was saved, what was partial, and what needs manual follow-up.

## Platform routing

| Platform | URL pattern | Reference |
|----------|-------------|-----------|
| 小红书 (Xiaohongshu / RED) | `xhslink.cn`, `xiaohongshu.com` | `references/xiaohongshu.md` |
| *(more to come)* | — | `references/<platform>.md` |

Load the matching reference before executing the extraction. If the platform is not yet supported, use the generic ladder below and consider creating a new reference afterwards.

## Standard output template

See `references/output-template.md` for the full template, title convention, and tag convention.

## Platform sub-skill contract

Each platform reference must define:

| Item | Description |
|------|-------------|
| `match(url)` | Returns true if the URL belongs to this platform. |
| `extract(url)` | Returns a dict with at least `title`, `body`, `images`, `comments`, `metadata`, `source_url`. |
| `images_strategy` | One of `ignore`, `attach`, `ocr`. Default is `ocr`. |
| `comments_strategy` | One of `ignore`, `first_page`, `deep`. Default is `first_page`. |
| `deep_comments_threshold` | When `comments_strategy=first_page`, try deep scraping if total comments exceed this number. |

## Extraction ladder (generic)

Use this ladder when no platform reference exists, or when a platform-specific step fails.

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
8. **Assemble the article** using the standard template in `references/output-template.md`.

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
  - No matching platform reference exists and the generic ladder also fails.
- **Preserve identifiers**: keep the original URL, post ID, and author handle exactly as found.
- **Preserve media**: attach original images/files even when OCR text is included, so the user can verify.

## Pitfalls

- **Hashtags become Bear tags**: when pasting into Bear, rewrite `#话题[话题]#` as plain text lists. Remove leaked tags with `bearcli tags remove`.
- **OCR mixes columns** on dense tables (e.g. recruitment lists). Present raw OCR grouped by image plus a best-effort reconstructed table, clearly labeled.
- **Comment counts are misleading**: the JSON may report 26 comments but only embed 5. Always state what was actually loaded.
- **Image CDN checks Referer**: downloads fail without a proper `Referer`. Platform references list the correct Referer per CDN.
- **Browser automation requires approval**: on macOS, `browser_exec` needs the user to click "Allow remote debugging". Explain this once and wait.

## Example call pattern

```text
User: 查查这个链接 https://xhslink.cn/... 帮我剪藏到 Bear
Agent: [loads references/xiaohongshu.md, extracts XHS post, then uses bear-notes to save]
```

## Adding a new platform reference

1. Create `references/<platform>.md` following the structure of `references/xiaohongshu.md`.
2. Define `match(url)`, extraction ladder, title/tag conventions, and pitfalls.
3. Add the platform to the routing table in this file.
4. Update `SKILLS_REGISTRY.md` if needed.
