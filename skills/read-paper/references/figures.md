# 图表抽取与 Bear 附件

## 工具

系统 python 无 pymupdf，统一用：
```bash
uv run --with pymupdf python <脚本>
```
新版 API：`import pymupdf`（`fitz` 别名仍可用但已 deprecated）。

## 脚本：scripts/pdf_figures.py

```bash
# 1) 列出 PDF 中的嵌入图片（尺寸过滤后），输出 JSON：页码、bbox、尺寸
uv run --with pymupdf python scripts/pdf_figures.py list <paper.pdf>

# 2) 抽取某页某区域的图片，2x 渲染为 PNG
uv run --with pymupdf python scripts/pdf_figures.py crop <paper.pdf> <page> <x0> <y0> <x1> <y1> <out.png>

# 3) 整页渲染（嵌入图抽不干净时的兜底，如矢量图）
uv run --with pymupdf python scripts/pdf_figures.py page <paper.pdf> <page> <out.png>
```

工作流：
1. `list` 找出方法图/结果图所在的嵌入图片（按面积过滤 > 100x100，跳过 logo/图标）。
2. 对矢量图（嵌入 list 里没有），用 pymupdf 读该页 text，定位图注（"Figure 2:"）所在位置，反推图表 bbox，`crop` 渲染。
3. 实在定位不了 → `page` 整页渲染后说明"整页截图"。

## 选取原则

- **必截**：方法/架构总览图（ usually Figure 1 或 2）。
- **择优**：主结果表（Table 1）、关键消融/可视化，总共 3~6 张封顶。
- 不截：小图标、logo、显而易见的示意图。
- 表格**先文字重述**（数字可搜索），截图作辅证放后面。

## 命名与控宽

- 命名 `figure<N>-<英文短描述>.png`（小写、连字符），如 `figure2-architecture-mask.png`。
- 正文引用：`![](figure2-architecture-mask.png)<!-- {"width":620} -->`
  - 方法大图：620~680；结果表/单栏图：480~520；小图：400 左右。
  - 文件必须放在笔记附件里且**引用名与实际文件名一字不差**，Bear 靠名字匹配。

## 挂附件

```bash
cat figure2-architecture-mask.png | bearcli attachments add <note-id> --filename figure2-architecture-mask.png
```

注意：
- `attachments add` 从 stdin 读字节，文件名用 `--filename` 指定。
- 先 `bearcli create` 拿 note-id 再挂；正文里的 `![]()` 引用在附件挂入后即生效。
- 若 edit/overwrite 触发附件保护门（stderr 列出将丢失的文件），先读拒绝信息，确认后加 `--force`。
