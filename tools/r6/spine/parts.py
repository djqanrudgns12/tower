"""공통 캔버스 파츠와 수동 마스크를 처리한다."""

import math
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

from pilot import write_json


SLOT_NAME = re.compile(r"[a-z][a-z0-9-]*")


def load_part(path, canvas):
    with Image.open(path) as image:
        if image.format != "PNG" or image.mode != "RGBA" or image.size != canvas:
            raise ValueError(f"{path} · 공통 크기의 RGBA PNG가 필요합니다.")
        part = image.copy()
    if not part.getbbox():
        raise ValueError(f"{path} · 보이는 화소가 없습니다.")
    return part


def suggest_pivot(image, expected, radius):
    """기준 좌표가 비어 있으면 주변 불투명 화소에서 가장 가까운 점을 고른다."""
    x, y = expected
    alpha = image.getchannel("A")
    left, top = max(0, math.floor(x - radius)), max(0, math.floor(y - radius))
    right, bottom = min(image.width, math.ceil(x + radius) + 1), min(image.height, math.ceil(y + radius) + 1)
    if right <= left or bottom <= top:
        return expected
    window = alpha.crop((left, top, right, bottom))
    candidates = ((left + col + .5, top + row + .5)
                  for row in range(window.height) for col in range(window.width)
                  if window.getpixel((col, row)) >= 128)
    pivot = min(candidates, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2, default=expected)
    # 폭 전체에 걸친 윤곽 중심보다 제작자가 맞춘 접점을 우선한다.
    return expected if (pivot[0] - x) ** 2 + (pivot[1] - y) ** 2 > radius ** 2 else pivot


def extract(sheet, spec, out):
    """시트 좌표·수동 마스크·캔버스 배치로 보이는 부분만 분리한다."""
    from json import loads

    config = loads(spec.read_text())
    canvas = tuple(config["canvas"])
    with Image.open(sheet) as image:
        source = image.convert("RGBA")
    extracted = {}
    for name, entry in config["parts"].items():
        if not SLOT_NAME.fullmatch(name):
            raise ValueError(f"슬롯 이름을 확인하세요 · {name}")
        box, position = entry["box"], entry["position"]
        x1, y1, x2, y2 = box
        x, y = position
        if not (0 <= x1 < x2 <= source.width and 0 <= y1 < y2 <= source.height
                and 0 <= x <= canvas[0] - (x2 - x1) and 0 <= y <= canvas[1] - (y2 - y1)):
            raise ValueError(f"{name} · 시트 또는 출력 캔버스를 벗어났습니다.")
        mask_path = (spec.parent / entry["mask"]).resolve()
        if not mask_path.is_relative_to(spec.parent.resolve()):
            raise ValueError(f"{name} · 마스크는 명세 폴더 안에 있어야 합니다.")
        crop = source.crop(box)
        with Image.open(mask_path) as image:
            if image.mode not in ("1", "L") or image.size != crop.size:
                raise ValueError(f"{name} · 마스크는 잘라낸 영역과 같은 크기의 단일 채널 이미지여야 합니다.")
            mask = image.convert("L")
        if entry.get("removeSpecks", False):
            mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
        alpha = ImageChops.multiply(crop.getchannel("A"), mask)
        if not alpha.getbbox():
            raise ValueError(f"{name} · 마스크 안에 보이는 부분이 없습니다.")
        crop.putalpha(alpha)
        part = Image.new("RGBA", canvas)
        part.paste(crop, (x, y))
        extracted[name] = part
    if not extracted:
        raise ValueError("분리할 파츠를 지정하세요.")
    out.mkdir(parents=True, exist_ok=False)
    for name, part in extracted.items():
        part.save(out / f"{name}.png")
    write_json(out / "extraction.json", {"sheet": Path(sheet).name, "parts": config["parts"]})
