---
name: read-paper
description: "读论文并撰写结构化 Bear 阅读笔记。用户提供论文名称、arXiv/会议链接或本地 PDF，skill 负责解析来源、下载论文、提取正文与图表、按模板撰写深读/速读笔记到 Bear。触发词：读论文、读一下这篇、帮我读、这篇论文、arxiv、paper reading、写阅读笔记、论文笔记。"
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [macos, linux, windows]
metadata:
  hermes:
    tags: [Research, Paper, Reading, Bear, arXiv]
    related_skills: [bear-notes, arxiv, ocr-and-documents]
---

# Read Paper（论文深读 → Bear 笔记）

## When to Use

用户想读一篇论文并落成 Bear 阅读笔记时。典型触发：

- "读一下这篇论文：<链接/名称>"
- "帮我读 arXiv:2603.16666"
- "这是 PDF，写个论文笔记"
- "速读这篇"（快速版）

## Core Workflow

```
1. 解析输入        → 拿到论文全名 + PDF（见 references/arxiv-source.md）
2. 下载 PDF        → ~/Papers/<简称>.pdf
3. 提取正文        → pymupdf 抽全文 text，通读
4. 截取图表        → scripts/pdf_figures.py（见 references/figures.md）
5. 判断论文类型     → 方法类 or 数据集/基准类（决定模板与标签）
6. 查重            → bearcli search 论文标题/arXiv ID；已存在则问用户：更新旧的 or 新建
7. 撰写笔记        → 按 references/template.md 模板写 markdown
8. 挂附件          → bearcli attachments add 挂截图，正文 ![](name.png)<!-- {"width":600} --> 引用
9. 收尾            → 报告笔记 id + 标题，清理临时截图目录
```

## Input Routing（解析阶梯）

按优先级逐级尝试，一级失败再退到下一级：

1. **本地 PDF 文件**（用户发来路径/附件）→ 直接用，跳过下载。
2. **arXiv ID 或 arXiv 链接** → `https://export.arxiv.org/pdf/<id>` 直接下载；元数据走 arXiv API。
3. **OpenReview / 会议页 / 项目主页链接** → web_extract 抓页面，找 PDF 直链（OpenReview 的 pdf 链接、项目页的 paper 按钮）。
4. **只有论文名称** → web_search 定位 arXiv 页（优先 arXiv 版本），回到第 2 级。
5. **解析不出来** → 停下来问用户，给候选列表让其确认，不瞎猜。

论文类型判断：标题/摘要出现 dataset、benchmark、corpus、大规模数据构建 → 数据集类；否则默认方法类。不确定就问。

## Output Contract

### 目的地
- 默认 Bear（`/bear-notes`）。用户指定其他目的地（飞书文档、文件）时按用户要求。

### 标题与标签
- 标题：`YYYY-MM-DD 📑 <简称>`（当天日期；简称从全名/常用缩写提取，如 Fast-WAM、π₀ 写作 Pi-0）
- 正文第一行写标签（Bear 内嵌 hashtag 风格，不用 `--tags`），**必须带 `#TODO/unread`**（未读标记，读完由用户自己摘掉）：
  - 方法类：`#Notes/读论文/摘要 #TODO/unread`
  - 数据集/基准类：`#Notes/读论文/数据集 #TODO/unread`
- 研究领域标签（`#Research/研究领域/...`）**默认不加**，用户点名才加。

### 开头信息块（固定四行结构）
```
- <发表信息：arXiv 日期 / 会议+年份> | <机构>
- [<论文全名>](<论文页面链接>)
- 项目主页：[<名>](<url>)；代码：[<repo>](<url>)   ← 没有则省略整行
- ***Reading Log***
  - <一句话概括：这篇论文做了什么、核心结论是什么>
```

### 章节模板
- 方法类五节：`## 背景相关工作问题` / `## 思路贡献` / `## 方法细节` / `## 数据集任务、验证指标、对比Baseline和算力` / `## 实验结果`
- 数据集类五节：`## 背景与动机` / `## 数据构建流程` / `## 数据规模与分布统计` / `## 基准任务与评测协议` / `## 实验结果与发现`
- 模板全文与写作细则见 **references/template.md**。

### 公式与格式
- 行内公式 `$...$`。
- **行间公式必须三行写法**（Bear 渲染要求，`$$...$$` 单行不渲染）：
  ```
  $$
  R' = R \oplus (t - t_{prev})
  $$
  ```
- 关键结论用 `==高亮==`；极关键点加 🟢🟡🔵 前缀；每节末尾用 `~一句话~` 收束核心 takeaway（沿用 Fast-WAM 笔记风格）。
- 关键数字要复读（成功率、相对提升、参数量、延迟等），不要只写"显著提升"。

### 深度档位
- **深读（默认）**：Fast-WAM 那种 ~1 万字级别，含受控变量分析、数字复读、局限与未报告信息讨论。
- **速读**：用户说"速读/快速版"时，每节压缩到 2-4 句，砍掉局限讨论，篇幅约 1/3。

## Figures（图表进笔记）

- 方法/架构图**必截**；关键结果图/表择优截；单篇 3~6 张。
- 命名 `figure<N>-<英文短描述>.png`，正文 `<!-- {"width":500~680} -->` 控宽。
- 抽取与渲染方法见 **references/figures.md**。

## 查重与更新策略

撰写前 `bearcli search "<论文标题关键词>"` 查重：
- **无已有笔记** → 正常新建。
- **已有同论文笔记** → 停下来问用户：更新旧的（`overwrite --base` 安全重写，保留 Reading Log 合并）还是新建一篇。不擅自覆盖。

## 收尾

- 报告：笔记标题 + id + 图表数量。
- 清理临时截图目录（`~/Papers/figures/<简称>/`）；PDF 保留在 `~/Papers/`。
- 问用户是否要在 Bear 中打开（`bearcli open <id>`）。

## Pitfalls

- **不要 sqlite3 直查 Bear 库**（本机会挂死）；一律走 bearcli。
- arXiv 下载用 `export.arxiv.org`，`arxiv.org/pdf` 裸链偶尔会 403。
- pymupdf 用 `uv run --with pymupdf`（系统 python 没装）；新版 API 是 `import pymupdf` 不是 `import fitz`。
- 表格优先**文字重述**再附图——截图里的数字不可搜索，重述才够。
- 论文没报告的信息（训练 GPU 小时、λ 等）如实写"未报告"，不要编。
- 写笔记前先 `bearcli create` 拿到 id，再挂附件；附件引用名必须与实际文件名一字不差，否则 Bear 会移除附件。
- ⚠️ `bearcli attachments add` 会**在笔记末尾自动追加一排裸 `![](文件名)` 引用**（无 width 注释），与正文里已写好的带宽度引用重复。挂完全部附件后必须 `cat` 检查笔记尾部，用 `edit --find` 把这排裸引用整块删掉（这些文件在正文仍有引用，删除不触发附件保护门）。
- ⚠️ `bearcli edit --find/--replace` 的 CLI 参数会转义解释 `\n \t \\`——LaTeX 里的 `\theta`、`\text` 会被吃掉 `\t`。**经 CLI 参数传含 LaTeX 的字符串时反斜杠必须双写**（`\\theta`），或用 subprocess 列表传参避免 shell 引号问题；批量 edit 是原子的，一条失败全部不写，报 not found 时先 cat 核对实际字符。
- ⚠️ execute_code 里写正文模板**不要用 r-string（r"""）**：r-string 中写的 `<!-- {\"width\":620} -->` 会把反斜杠字面保留进笔记，Bear 宽度注释失效。用普通三引号字符串，内部引号无需转义。写完务必 cat 抽查一处 `![]()` 引用确认无字面反斜杠、注释以 `-->` 正确闭合（`%}`、`>}}` 都是写残的变体）。
