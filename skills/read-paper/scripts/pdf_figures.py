#!/usr/bin/env python3
"""pdf_figures.py — 论文 PDF 图表定位与渲染工具（read-paper skill）

用法:
  pdf_figures.py list <paper.pdf>
      列出嵌入图片（面积过滤），输出 JSON：[{"page","bbox","width","height"}, ...]
  pdf_figures.py crop <paper.pdf> <page> <x0> <y0> <x1> <y1> <out.png>
      按页面坐标区域 2x 渲染为 PNG（page 从 0 开始）
  pdf_figures.py page <paper.pdf> <page> <out.png>
      整页 2x 渲染兜底（矢量图定位不到时用）

注意: 新版 pymupdf 用 `import pymupdf`；通过 `uv run --with pymupdf python pdf_figures.py ...` 运行。
"""
import json
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("pymupdf not found — run via: uv run --with pymupdf python pdf_figures.py ...")

MIN_SIDE = 100  # 小于该边长的嵌入图视为图标/logo，跳过
ZOOM = 2.0      # 渲染缩放倍率


def cmd_list(pdf_path: str) -> None:
    doc = pymupdf.open(pdf_path)
    out = []
    for pno in range(len(doc)):
        page = doc[pno]
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                rects = page.get_image_rects(xref)
            except Exception:
                continue
            for r in rects:
                w, h = r.width, r.height
                if w < MIN_SIDE or h < MIN_SIDE:
                    continue
                out.append({
                    "page": pno,
                    "bbox": [round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)],
                    "width": round(w, 1),
                    "height": round(h, 1),
                })
    print(json.dumps(out, ensure_ascii=False))


def cmd_crop(pdf_path: str, page: int, x0: float, y0: float, x1: float, y1: float, out: str) -> None:
    doc = pymupdf.open(pdf_path)
    pg = doc[page]
    mat = pymupdf.Matrix(ZOOM, ZOOM)
    pix = pg.get_pixmap(matrix=mat, clip=pymupdf.Rect(x0, y0, x1, y1))
    pix.save(out)
    print(f"saved {out} ({pix.width}x{pix.height})")


def cmd_page(pdf_path: str, page: int, out: str) -> None:
    doc = pymupdf.open(pdf_path)
    pg = doc[page]
    mat = pymupdf.Matrix(ZOOM, ZOOM)
    pix = pg.get_pixmap(matrix=mat)
    pix.save(out)
    print(f"saved {out} ({pix.width}x{pix.height})")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(64)
    mode = args[0]
    if mode == "list" and len(args) == 2:
        cmd_list(args[1])
    elif mode == "crop" and len(args) == 8:
        cmd_crop(args[1], int(args[2]), *map(float, args[3:7]), args[7])
    elif mode == "page" and len(args) == 4:
        cmd_page(args[1], int(args[2]), args[3])
    else:
        print(__doc__)
        sys.exit(64)


if __name__ == "__main__":
    main()
