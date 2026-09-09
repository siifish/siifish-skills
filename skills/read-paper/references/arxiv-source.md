# arXiv / 论文来源解析与下载

## arXiv 直链与 API

### 下载 PDF
```bash
# 推荐 export 域，裸 arxiv.org/pdf 偶发 403
curl -sL "https://export.arxiv.org/pdf/2603.16666" -o ~/Papers/Fast-WAM.pdf
```

### 元数据（发表日期、作者、机构、comment/journal-ref）
```bash
curl -sL "https://export.arxiv.org/api/query?id_list=2603.16666"
```
返回 Atom XML，关注：
- `<published>`：v1 提交日期（笔记里的 "arXiv:2026-03-23"）
- `<arxiv:comment>`：常有会议录用信息（如 "Accepted by ICLR 2027"）
- `<arxiv:journal_ref>`：期刊版信息
- 机构不总在 arXiv 元数据里 → 从 PDF 首页作者单位脚注抽，或项目主页找。

### 网页兜底
- arXiv abs 页（`arxiv.org/abs/<id>`）用 web_extract 抓 abstract、作者链接、项目主页线索。
- ar5iv（`ar5iv.labs.arxiv.org/html/<id>`）提供 HTML 全文，web_extract 抽取比 PDF 更干净，适合补抽章节文字。

## OpenReview / 会议页

- OpenReview 论坛页：`https://openreview.net/forum?id=<id>`，PDF 在 `https://openreview.net/pdf?id=<id>`。
- 项目主页（如 `*.github.io`）常有 paper 按钮 → web_extract 找 `.pdf` 链接。
- 纯会议页（无 arXiv 版）抓不到 PDF 时，web_extract 全文 + 找官方 PDF 链接。

## 只有论文名称时

1. `web_search "<全名> arxiv"`，优先 arxiv.org 结果。
2. 同名/重名论文多（如 "Attention is All You Need" 一堆引用页）→ 用作者名 + 年份消歧。
3. 搜不到 arXiv 版 → 搜 OpenReview / ACL Anthology / 项目主页。
4. 多候选无法消歧 → 列给用户挑，不猜。

## 本地 PDF

用户直接给文件路径时：
- 记录来源未知 → 开头信息块第一行写 "本地 PDF | 来源未知"，能抽到什么写什么。
- 仍尝试用论文全名反查 arXiv，补齐发表信息。

## 下载后校验

- `file ~/Papers/<简称>.pdf` 确认是 PDF（有些返回的是 HTML 错误页）。
- pymupdf 打不开 / 页数为 0 → 重新下载或换源。
