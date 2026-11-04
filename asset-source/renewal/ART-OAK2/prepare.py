"""ART-OAK2 처리: 흰 배경을 가장자리부터 지우고(flood fill), 흰색과 섞인 가장자리는 알파로 풀어 흰 테를 없앤 뒤,
바운딩 박스로 잘라 목표 폭(표시 2배 밀도)으로 줄여 PNG로 저장한다.
실행: uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-OAK2/prepare.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
# id: (원본, 출력, 목표 폭 px)
ITEMS = {
    'guide.ch5.new_features': ('sources/guide.ch5.new_features.r2.jpg', 'public/assets/guide/guide.ch5.new_features.png', 680),
    'note.empty': ('sources/note.empty.r1.jpg', 'public/assets/ui/note.empty.png', 480),
}
MARK = (255, 0, 255)


def cutout(img: Image.Image) -> Image.Image:
    rgb = img.convert('RGB')
    work = rgb.copy()
    w, h = work.size
    for x in range(0, w, 8):
        for y in (0, h - 1):
            if sum(work.getpixel((x, y))) > 3 * 225: ImageDraw.floodfill(work, (x, y), MARK, thresh=40)
    for y in range(0, h, 8):
        for x in (0, w - 1):
            if sum(work.getpixel((x, y))) > 3 * 225: ImageDraw.floodfill(work, (x, y), MARK, thresh=40)
    a = np.asarray(rgb).astype(np.float32)
    bg = np.all(np.asarray(work) == MARK, axis=2)
    alpha = np.where(bg, 0.0, 1.0)
    # 배경에 닿은 2px 띠: 흰색과 섞인 정도만큼 알파를 풀고 색을 되돌린다
    near = np.asarray(Image.fromarray((bg * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
    edge = near & ~bg
    whiteness = np.clip((a.min(axis=2) - 150) / 105, 0, 1)
    alpha = np.where(edge, 1 - whiteness, alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((a - 255 * (1 - alpha[..., None])) / safe, 0, 255)
    out = np.dstack([col, alpha * 255]).round().astype('uint8')
    im = Image.fromarray(out, 'RGBA')
    return im.crop(im.getbbox())


for id_, (src, dst, width) in ITEMS.items():
    im = cutout(Image.open(ROOT / src))
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.Resampling.LANCZOS)
    path = PROJECT / dst
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)
    print(f'{id_:24s} {width}x{h} {path.stat().st_size}B -> {dst}')
