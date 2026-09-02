# Standard article output template

Use this template for every clipped social post.

```markdown
# YYYY-MM-DD 合适的标题

#Notes/剪藏/小红书 #项目/... #Research/...

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

- Format: `YYYY-MM-DD 合适的标题`
- The "合适的标题" should be a short, descriptive title chosen by the assistant based on the content, not necessarily the original title verbatim.
- Place tags directly below the title line, before the source block.
- For 小红书, the tag `#Notes/剪藏/小红书` is required; other platforms use the appropriate `#Notes/剪藏/<平台>` tag.

## Tag convention

Always place tags directly below the title line.

**Required tags**
- `#Notes/剪藏/小红书` (or the appropriate platform sub-tag)

**Recommended additional tags** (1-3, inferred from content)
- Topic tags from the user's existing tree (e.g. `#Research/研究领域/具身智能`, `#项目/实习招聘/...`).
- If a good match cannot be found, ask the user or create a dated sub-tag under `#项目/实习招聘/`.
