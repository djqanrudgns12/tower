#!/usr/bin/env python3
"""ART-M1 몬스터 처리: Antigravity 흰 배경 원본 → 투명 배경·기존 적 규격(128/192)·접촉판.

실행(작업 폴더 루트에서):
  uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-M1/prepare.py
"""
from collections import deque
from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ASSETS = ROOT / "public" / "assets"

# 역할별 실루엣 높이 배율(기준: 기존 enemy.walker.0의 실루엣 높이). 대장은 enemy.boss.0 기준.
JOBS = {
    "acorn.runner": ("walker", 0.98),
    "acorn.brute": ("walker", 1.12),
    "acorn.shell": ("walker", 1.0),
    "acorn.wisp": ("walker", 0.98),
    "acorn.swarm": ("walker", 0.72),
    "acorn.flyer": ("walker", 1.0),
    "acorn.splitter": ("walker", 1.04),
    "acorn.boss5": ("boss", 0.95),
    "acorn.boss10": ("boss", 1.0),
    "acorn.boss15": ("boss", 1.0),
    "acorn.boss20": ("boss", 1.05),
}
SPEC = {"walker": (128, "enemy.walker.0.r1.png"), "boss": (192, "enemy.boss.0.r1.png")}
ORIGIN_Y = 0.75  # 기존 적 manifest의 originY(발 위치)


def matte(path: Path) -> Image.Image:
    """가장자리에서 이어진 흰 배경만 지우고, 배경에 닿은 밝은 테두리 픽셀은 반투명으로 낮춘다."""
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    h, w, _ = a.shape
    lo, hi = a.min(axis=2), a.max(axis=2)
    white = (lo >= 228) & (hi - lo <= 24)
    bg = np.zeros((h, w), bool)
    q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
    while q:
        y, x = q.popleft()
        if bg[y, x] or not white[y, x]:
            continue
        bg[y, x] = True
        if y > 0: q.append((y - 1, x))
        if y < h - 1: q.append((y + 1, x))
        if x > 0: q.append((y, x - 1))
        if x < w - 1: q.append((y, x + 1))
    alpha = np.where(bg, 0, 255).astype(float)
    # 배경에서 2px 안쪽의 밝은 테두리(JPEG·안티에일리어스 잔여)는 밝을수록 투명하게.
    near = bg.copy()
    for _ in range(2):
        n = near.copy()
        n[1:] |= near[:-1]; n[:-1] |= near[1:]; n[:, 1:] |= near[:, :-1]; n[:, :-1] |= near[:, 1:]
        near = n
    edge = near & ~bg
    alpha[edge] = np.clip((250 - lo[edge]) / 60.0, 0, 1) * 255
    rgba = np.dstack([a, alpha]).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    return im.crop(im.getbbox())


def silhouette_height(path: Path) -> float:
    im = Image.open(path).convert("RGBA")
    box = im.getbbox()
    return (box[3] - box[1]) / im.height


def place(cut: Image.Image, size: int, height_frac: float) -> Image.Image:
    target_h = size * height_frac
    scale = min(target_h / cut.height, size * 0.96 / cut.width)
    sw, sh = max(1, round(cut.width * scale)), max(1, round(cut.height * scale))
    small = cut.resize((sw, sh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bottom = round(size * ORIGIN_Y + size * 0.06)  # 발밑 접지 여유(기존 그림과 같은 위치에 맞춘 값)
    canvas.alpha_composite(small, ((size - sw) // 2, max(0, bottom - sh)))
    return canvas


def contact(items: list[tuple[str, Image.Image]], bg: tuple, out: Path):
    cols, cell = 6, 150
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell * 3 // 2 + 20, rows * 180 + 20), bg)
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(items):
        x0, y0 = 10 + (i % cols) * cell * 3 // 2, 10 + (i // cols) * 180
        for j, px in enumerate((64, 48, 32)):
            s = im.resize((px, px), Image.LANCZOS)
            sheet.alpha_composite(s, (x0 + j * 72, y0 + 10 + (64 - px)))
        d.text((x0, y0 + 90), name, fill=(40, 30, 20, 255) if sum(bg[:3]) > 380 else (240, 230, 210, 255))
    sheet.save(out)


def main():
    out_dir = HERE
    ref_h = {k: silhouette_height(ASSETS / f) for k, (_, f) in SPEC.items()}
    made, manifest = [], []
    for kind, (sz, f) in SPEC.items():
        made.append((f"(기존) {f.split('.r1')[0]}", Image.open(ASSETS / f).convert("RGBA")))
    for job, (kind, k) in JOBS.items():
        src = next(HERE.glob(f"sources/{job}.generated.*"))
        size = SPEC[kind][0]
        im = place(matte(src), size, ref_h[kind] * k)
        im.save(out_dir / f"{job}.r1.png")
        made.append((job, im))
        manifest.append({"id": job, "file": f"{job}.r1.png", "width": size, "height": size, "originX": 0.5, "originY": ORIGIN_Y,
                         "kind": kind, "heightScale": k, "status": "draft", "producer": "Antigravity image-generator (Gemini)"})
    contact(made, (124, 188, 76, 255), out_dir / "contact-sheet-grass.png")
    contact(made, (58, 41, 30, 255), out_dir / "contact-sheet-dark.png")
    (out_dir / "manifest.json").write_text(json.dumps({"jobId": "ART-M1", "assets": manifest}, ensure_ascii=False, indent=2) + "\n")
    print(f"ok {len(manifest)}")


if __name__ == "__main__":
    main()
