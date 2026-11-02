#!/usr/bin/env python3
"""ART-R4b: 신규 타워 기본형 8종에 역할 색 표식을 더한 Antigravity 편집본 처리.

원본은 sources/tower.<타워>.generated.jpg(흰 배경). ART-R4/tower.<타워>.r1.png(색 표식 전 기본형)의
보이는 실루엣 폭·바닥선에 맞춰 투명 192×192 tower.<타워>.r1.png로 만든다. 무기 층은 ART-R4 것을 그대로 쓴다.
실행(작업 폴더 루트에서):
  uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R4b/prepare.py
"""
from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "tools"))
from monster_prepare import matte  # noqa: E402
from tower_prepare import SIZE, fit_to_base  # noqa: E402

R4 = ROOT.parent / "ART-R4"


def main():
    entries, rows = [], []
    for src in sorted(ROOT.glob("sources/tower.*.generated.*")):
        tower = src.name.split(".")[1]
        before = Image.open(R4 / f"tower.{tower}.r1.png").convert("RGBA")
        im = fit_to_base(matte(src), before)
        out = f"tower.{tower}.r1.png"
        im.save(ROOT / out)
        rows.append((tower, before, im))
        entries.append({"id": f"tower.{tower}", "file": out, "width": SIZE, "height": SIZE, "originX": 0.5, "originY": 0.8125,
                        "status": "draft", "producer": "Antigravity image-generator (Gemini), ART-R4 기본형 편집(역할 색 표식)"})
    sheet = Image.new("RGBA", (40 + 2 * 280, 20 + len(rows) * 220), (232, 224, 204, 255))
    d = ImageDraw.Draw(sheet)
    for i, (tower, before, im) in enumerate(rows):
        y = 10 + i * 220
        for j, (label, pic) in enumerate((("ART-R4", before), ("ART-R4b", im))):
            x = 20 + j * 280
            sheet.alpha_composite(pic.resize((128, 128), Image.LANCZOS), (x, y))
            for k, px in enumerate((64, 48, 32)):
                sheet.alpha_composite(pic.resize((px, px), Image.LANCZOS), (x + 140 + (k % 2) * 66, y + (k // 2) * 70))
            d.text((x, y + 135), f"{tower} {label}", fill=(40, 30, 20, 255))
    sheet.save(ROOT / "contact-sheet.png")
    (ROOT / "manifest.json").write_text(json.dumps({"jobId": ROOT.name, "assets": entries}, ensure_ascii=False, indent=2) + "\n")
    print(f"{ROOT.name} ok {len(entries)}")


if __name__ == "__main__":
    main()
