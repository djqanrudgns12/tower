#!/usr/bin/env python3
"""종족 몬스터 처리 공용 도구: Antigravity 흰 배경 원본 → 투명 배경·기존 적 규격(128/192)·접촉판·manifest.

원본은 <작업 폴더>/sources/<종족>.<역할>.generated.(jpg|png). 역할 이름으로 크기 기준(일반·대장)과 실루엣 높이 배율을 정한다.
실행(작업 폴더 루트에서):
  uv run --no-project --with pillow --with numpy python asset-source/renewal/tools/monster_prepare.py asset-source/renewal/ART-M2
"""
from collections import deque
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "public" / "assets"

# 역할별 실루엣 높이 배율(기준: 기존 enemy.walker.0 / enemy.boss.0의 실루엣 높이).
ROLE_SCALE = {
    "walker": 1.0, "runner": 0.98, "brute": 1.12, "shell": 1.0, "wisp": 0.98, "swarm": 0.72, "flyer": 1.0, "splitter": 1.04,
    "boss5": 0.95, "boss10": 1.0, "boss15": 1.0, "boss20": 1.05,
}
SPEC = {"walker": (128, "enemy.walker.0.r1.png"), "boss": (192, "enemy.boss.0.r1.png")}
ORIGIN_Y = 0.75  # 기존 적 manifest의 originY(발 위치)
ORDER = list(ROLE_SCALE)


def matte(path: Path) -> Image.Image:
    """가장자리에서 이어진 흰 배경만 지우고, 배경에 닿은 밝은 테두리 픽셀은 반투명으로 낮춘다."""
    src = Image.open(path)
    if src.mode == "RGBA" and src.getextrema()[3][0] < 255:
        im = src.convert("RGBA")
        return im.crop(im.getbbox())
    a = np.asarray(src.convert("RGB")).astype(int)
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
    near = bg.copy()
    for _ in range(2):
        n = near.copy()
        n[1:] |= near[:-1]; n[:-1] |= near[1:]; n[:, 1:] |= near[:, :-1]; n[:, :-1] |= near[:, 1:]
        near = n
    edge = near & ~bg
    alpha[edge] = np.clip((250 - lo[edge]) / 60.0, 0, 1) * 255
    im = Image.fromarray(np.dstack([a, alpha]).astype(np.uint8), "RGBA")
    return im.crop(im.getbbox())


def silhouette_height(path: Path) -> float:
    im = Image.open(path).convert("RGBA")
    box = im.getbbox()
    return (box[3] - box[1]) / im.height


def place(cut: Image.Image, size: int, height_frac: float) -> Image.Image:
    scale = min(size * height_frac / cut.height, size * 0.96 / cut.width)
    sw, sh = max(1, round(cut.width * scale)), max(1, round(cut.height * scale))
    small = cut.resize((sw, sh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bottom = round(size * ORIGIN_Y + size * 0.06)  # 발밑 접지 여유(ART-M1과 같은 값)
    canvas.alpha_composite(small, ((size - sw) // 2, max(0, bottom - sh)))
    return canvas


def contact(items, bg, out: Path):
    cols, cw = 6, 225
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cw + 20, rows * 180 + 20), bg)
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(items):
        x0, y0 = 10 + (i % cols) * cw, 10 + (i // cols) * 180
        for j, px in enumerate((64, 48, 32)):
            sheet.alpha_composite(im.resize((px, px), Image.LANCZOS), (x0 + j * 72, y0 + 10 + (64 - px)))
        d.text((x0, y0 + 90), name, fill=(40, 30, 20, 255) if sum(bg[:3]) > 380 else (240, 230, 210, 255))
    sheet.save(out)


def main(job_dir: Path):
    ref_h = {k: silhouette_height(ASSETS / f) for k, (_, f) in SPEC.items()}
    made = [(f"(기존) {f.split('.r1')[0]}", Image.open(ASSETS / f).convert("RGBA")) for _, f in SPEC.values()]
    entries = []
    sources = sorted(job_dir.glob("sources/*.generated.*"), key=lambda p: ORDER.index(p.name.split(".")[1]))
    for src in sources:
        race, role = src.name.split(".")[:2]
        kind = "boss" if role.startswith("boss") else "walker"
        size = SPEC[kind][0]
        im = place(matte(src), size, ref_h[kind] * ROLE_SCALE[role])
        job = f"{race}.{role}"
        im.save(job_dir / f"{job}.r1.png")
        made.append((job, im))
        entries.append({"id": job, "file": f"{job}.r1.png", "width": size, "height": size, "originX": 0.5, "originY": ORIGIN_Y,
                        "kind": kind, "heightScale": ROLE_SCALE[role], "status": "draft", "producer": "Antigravity image-generator (Gemini)"})
    contact(made, (124, 188, 76, 255), job_dir / "contact-sheet-grass.png")
    contact(made, (58, 41, 30, 255), job_dir / "contact-sheet-dark.png")
    (job_dir / "manifest.json").write_text(json.dumps({"jobId": job_dir.name, "assets": entries}, ensure_ascii=False, indent=2) + "\n")
    print(f"{job_dir.name} ok {len(entries)}")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        main(Path(arg).resolve())
