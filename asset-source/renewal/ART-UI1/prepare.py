#!/usr/bin/env python3
"""ART-UI1 처리(R4 원화 아이콘). uv run --no-project --with pillow --with numpy python prepare.py <목록> [<목록>…]

목록 파일은 줄마다 `<이름> <생성 원본 경로>`(Antigravity 생성 1024px 순백 배경 JPG).
원본을 sources/에 보존하고, 가장자리에 이어진 흰 배경만 지워 128×128 투명 PNG로 public/assets/ui/<이름>.png에 둔다.
그림은 칸의 88%(112px) 안에 가운데 정렬한다. 접촉판은 크림·숲색 바탕에 24·32·128px.
"""
from pathlib import Path
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
OUT = PROJECT / 'public/assets/ui'
SIZE, FIT = 128, 112
CREAM, FOREST = (255, 253, 247), (30, 48, 32)


def cutout(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert('RGB')).astype(np.int32)
    whiteish = (rgb.min(axis=2) > 228) & (np.ptp(rgb, axis=2) < 28)
    flood = Image.fromarray((whiteish * 255).astype('uint8')).copy()
    w, h = flood.size
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if flood.getpixel((x, y)) == 255:
            ImageDraw.floodfill(flood, (x, y), 127)
    background = np.asarray(flood) == 127
    alpha = Image.fromarray(((~background) * 255).astype('uint8'))
    # 흰 가장자리 띠를 1px 깎고 살짝 풀어 축소 때 계단이 생기지 않게 한다.
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert('RGBA')
    out.putalpha(alpha)
    return out


def fit(img: Image.Image) -> Image.Image:
    box = img.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    img = img.crop(box)
    scale = FIT / max(img.size)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    small = img.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(small, ((SIZE - size[0]) // 2, (SIZE - size[1]) // 2), small)
    return canvas


def sheet(names: list[str], path: Path) -> None:
    rows = [(CREAM, 24), (CREAM, 32), (FOREST, 32), (CREAM, 128)]
    cell = 140
    sheet = Image.new('RGB', (cell * len(names), cell * len(rows)), CREAM)
    for r, (bg, px) in enumerate(rows):
        band = Image.new('RGB', (cell * len(names), cell), bg)
        sheet.paste(band, (0, r * cell))
        for i, n in enumerate(names):
            icon = Image.open(OUT / f'{n}.png').resize((px, px), Image.Resampling.LANCZOS)
            sheet.paste(icon, (i * cell + (cell - px) // 2, r * cell + (cell - px) // 2), icon)
    sheet.save(path)


def main(lists: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    names = []
    for lst in lists:
        for line in Path(lst).read_text().splitlines():
            if not line.strip():
                continue
            name, src = line.split(maxsplit=1)
            kept = ROOT / 'sources' / f'{name}{Path(src).suffix}'
            shutil.copyfile(src, kept)
            fit(cutout(Image.open(kept))).save(OUT / f'{name}.png', optimize=True)
            names.append(name)
    sheet(names, ROOT / f'contact-sheet-{len(names)}.png')
    print('\n'.join(names))


if __name__ == '__main__':
    main(sys.argv[1:])
