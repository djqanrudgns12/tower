"""Blender의 초원 고원 배경과 상태별 설치대를 제품 WebP로 패킹한다."""

import argparse
from pathlib import Path
from io import BytesIO

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
MAX_BYTES = 150_000


def pack(source, out):
    with Image.open(source / "meadow-plateau.png") as background:
        encoded = BytesIO()
        background.convert("RGB").save(encoded, "WEBP", quality=90, method=6)
        if encoded.tell() > MAX_BYTES:
            raise ValueError(f"배경 예산 {MAX_BYTES}B 초과 · {encoded.tell()}B")
    with Image.open(source / "pad.png") as idle, Image.open(source / "pad-selected.png") as selected:
        if idle.size != selected.size:
            raise ValueError("두 설치대의 프레임 크기가 다릅니다.")
        sheet = Image.new("RGBA", (idle.width * 2, idle.height))
        sheet.paste(idle, (0, 0))
        sheet.paste(selected, (idle.width, 0))
    out.mkdir(parents=True, exist_ok=True)
    (out / "meadow-plateau.webp").write_bytes(encoded.getvalue())
    sheet.save(out / "meadow-pads.webp", "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, default=ROOT / "public/assets/r6/map")
    args = parser.parse_args()
    pack(args.source, args.out)
