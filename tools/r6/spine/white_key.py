"""검토된 원화의 흰 배경과 안티앨리어싱 테두리를 분리한다."""

import numpy as np
from PIL import Image, ImageFilter

from cut_parts import components, open_rgba
from monsters import new_directory, read_json
from pilot import write_json


def clean(image, protected=()):
    pixels = np.array(image.convert("RGBA"))
    rgb, alpha = pixels[:, :, :3], pixels[:, :, 3]
    white = (rgb >= 240).all(axis=2) & (alpha > 0)
    h, w = white.shape
    protect = np.zeros_like(white)
    for x, y, right, bottom in protected:
        if not (0 <= x < right <= w and 0 <= y < bottom <= h):
            raise ValueError("흰 표식 보호 영역이 그림을 벗어납니다.")
        protect[y:bottom, x:right] = True
    removed = np.zeros_like(white)
    for part in components(white & ~protect):
        x, y, right, bottom = part.box
        edge = x == 0 or y == 0 or right == w or bottom == h
        if not edge:
            # 닫힌 점·가는 표식은 남긴다. 빈 면은 적어도 2×2 중심을 가진다.
            if part.area < 24 or min(right - x, bottom - y) < 3:
                continue
            region = np.zeros((bottom - y, right - x), bool)
            for row, start, end in part.runs:
                region[row-y, start-x:end-x] = True
            if not (region[:-1, :-1] & region[1:, :-1] & region[:-1, 1:] & region[1:, 1:]).any():
                continue
        for row, start, end in part.runs:
            removed[row, start:end] = True

    # 흰 영역 바로 옆의 혼합색만 처리한다. 투명 배경의 정상 외곽선은 보존한다.
    border = np.asarray(Image.fromarray(removed.astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
    ys, xs = np.nonzero(border & ~removed & ~protect & ~white & (alpha > 0))
    fringe = np.zeros_like(white)
    source = pixels.copy()
    for y, x in zip(ys, xs):
        color = source[y, x, :3].astype(float)
        opacity = source[y, x, 3] / 255.
        if opacity < 1:
            # C = aF + (1-a)255. 흰 매트와 양립하지 않는 색은 그대로 둔다.
            fg = (color - 255 * (1 - opacity)) / opacity
            if fg.min() < -1 or color.min() < 160:
                continue
        else:
            # 불투명하게 합쳐진 경계는 이웃의 실제 전경색으로 피복률을 추정한다.
            if color.min() < 200:
                continue
            near = source[max(0, y-2):y+3, max(0, x-2):x+3].reshape(-1, 4)
            samples = near[(near[:, 3] == 255) & (near[:, :3].min(axis=1) < 200), :3]
            if not len(samples):
                continue
            directions = samples.astype(float) - 255
            coverage = (directions @ (color - 255)) / (directions * directions).sum(axis=1)
            error = np.abs(255 + directions * coverage[:, None] - color).max(axis=1)
            best = error.argmin()
            if error[best] > 5 or not 0 < coverage[best] < 1:
                continue
            opacity = coverage[best]
            fg = 255 + (color - 255) / opacity
            alpha[y, x] = max(1, round(255 * opacity))
        rgb[y, x] = np.clip(np.rint(fg), 0, 255)
        fringe[y, x] = True
    pixels[removed] = 0
    mask = Image.fromarray(np.uint8(removed) * 255)
    corrected = Image.fromarray(pixels)
    return corrected, mask, {"removedPixels": int(removed.sum()), "fringePixels": int(fringe.sum())}


def review_strip(original, cleaned, mask):
    # 바뀐 부분을 원화 좌표에서 잘라 원본·삭제 영역(앰버)·완성 순서로 비교한다.
    bounds = mask.getbbox() or original.getbbox() or (0, 0, *original.size)
    x, y, r, b = bounds
    box = (max(0, x-12), max(0, y-12), min(original.width, r+12), min(original.height, b+12))
    overlay = original.copy()
    overlay.paste((230, 159, 36, 255), mask=mask)
    plate = Image.new("RGB", (540, 180), "#1D242C")
    for i, img in enumerate((original, overlay, cleaned)):
        thumb = img.crop(box)
        thumb.thumbnail((176, 176), Image.Resampling.LANCZOS)
        plate.paste(thumb, (i*180 + (180-thumb.width)//2, (180-thumb.height)//2), thumb)
    return plate


def preprocess(folder, cache, protected):
    if not cache.exists():
        with new_directory(cache) as stage:
            stats = {}
            board = Image.new("RGB", (540, 360), "#1D242C")
            for i, name in enumerate(("sheet", "assembly")):
                original = open_rgba(folder / (name + ".png"))
                corrected, mask, stats[name] = clean(original, protected.get(name, []))
                corrected.save(stage / (name + ".png"))
                mask.save(stage / (name + "-mask.png"))
                board.paste(review_strip(original, corrected, mask), (0, i*180))
            board.save(stage / "review.webp", lossless=True)
            count = sum(item["removedPixels"] for item in stats.values())
            write_json(stage / "white-key.json", {"applied": count > 0, "removedPixels": count, **stats})
    return read_json(cache / "white-key.json")
