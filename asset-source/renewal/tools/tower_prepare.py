#!/usr/bin/env python3
"""타워 진화형 처리 공용 도구(Antigravity 편집 결과용): 흰 배경 원본 → 투명 192×192, 기본형과 같은 받침 폭·바닥 위치.

원본은 <작업 폴더>/sources/tower.<타워>.<형태>.generated.(jpg|png). 기본형 public/assets/tower.<타워>.r1.png의
실루엣 너비와 바닥선에 맞춘다(편집으로 받침을 보존했으므로 너비 기준이 곧 받침 기준이다).
실행(작업 폴더 루트에서):
  uv run --no-project --with pillow --with numpy python asset-source/renewal/tools/tower_prepare.py asset-source/renewal/ART-AG-EDIT
"""
from pathlib import Path
import json
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from monster_prepare import ASSETS, matte  # noqa: E402

SIZE = 192


def visible_box(im: Image.Image, alpha_min: int = 64) -> tuple[int, int, int, int]:
    """눈에 보이는 실루엣의 경계 상자. 거의 투명한 가장자리·그림자 픽셀(알파 64 미만)은 뺀다."""
    return im.getchannel("A").point(lambda a: 255 if a >= alpha_min else 0).getbbox()


def fit_to_base(cut: Image.Image, base: Image.Image) -> Image.Image:
    # 기본형과 진화형 모두 "보이는" 실루엣으로 맞춘다. 알파 0 초과 기준으로 재면 기본형의 희미한 가장자리 때문에
    # 바닥선이 10~23px 아래로 잡혀 진화형이 꺼져 보였다(2026-10-31 게임 내 검수).
    bx0, _, bx1, by1 = visible_box(base)
    cx0, cy0, cx1, cy1 = visible_box(cut)
    scale = (bx1 - bx0) / (cx1 - cx0)
    if (cy1 - cy0) * scale > by1:  # 위로 넘치면 높이에 맞춘다(진화형이 더 높을 때 잘리지 않게)
        scale = by1 / (cy1 - cy0)
    small = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    vx0, vx1, vy1 = round(cx0 * scale), round(cx1 * scale), round(cy1 * scale)
    x, y = (bx0 + bx1) // 2 - (vx0 + vx1) // 2, by1 - vy1
    # 원본 여백 때문에 좌표가 음수가 될 수 있다. 캔버스 밖 부분을 먼저 잘라 낸다.
    part = small.crop((max(0, -x), max(0, -y), min(small.width, SIZE - x), min(small.height, SIZE - y)))
    canvas.alpha_composite(part, (max(0, x), max(0, y)))
    return canvas


def main(job_dir: Path):
    entries, rows = [], []
    for src in sorted(job_dir.glob("sources/tower.*.generated.*")):
        _, tower, form = src.name.split(".")[:3]
        base = Image.open(ASSETS / f"tower.{tower}.r1.png").convert("RGBA")
        im = fit_to_base(matte(src), base)
        out = f"tower.{tower}.{form}.r1.png"
        im.save(job_dir / out)
        rows.append((tower, form, base, im))
        entries.append({"id": f"tower.{tower}.{form}", "file": out, "width": SIZE, "height": SIZE, "originX": 0.5, "originY": 0.8125,
                        "status": "draft", "producer": "Antigravity image-generator (Gemini), 기본형 편집"})
    sheet = Image.new("RGBA", (40 + 2 * 280, 20 + len(rows) * 220), (232, 224, 204, 255))
    d = ImageDraw.Draw(sheet)
    for i, (tower, form, base, im) in enumerate(rows):
        y = 10 + i * 220
        for j, (label, pic) in enumerate((("base", base), (form, im))):
            x = 20 + j * 280
            sheet.alpha_composite(pic.resize((128, 128), Image.LANCZOS), (x, y))
            for k, px in enumerate((64, 48, 32)):
                sheet.alpha_composite(pic.resize((px, px), Image.LANCZOS), (x + 140 + (k % 2) * 66, y + (k // 2) * 70))
            d.text((x, y + 135), f"{tower}.{label}", fill=(40, 30, 20, 255))
    sheet.save(job_dir / "contact-sheet.png")
    (job_dir / "manifest.json").write_text(json.dumps({"jobId": job_dir.name, "assets": entries}, ensure_ascii=False, indent=2) + "\n")
    print(f"{job_dir.name} ok {len(entries)}")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        main(Path(arg).resolve())
