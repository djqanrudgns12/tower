"""Spine 뼈대에서 글자 없는 분해 시트 안내판과 좌표를 만든다."""

from PIL import Image, ImageDraw

from monsters import base_rig
from rigs import VARIANTS


SHEET = (1536, 1024)
CANVAS = (256, 256)
ROOT = (128, 216)
PIXELS_PER_UNIT = 3


def target_box(slot, variant, points):
    name = slot.name
    x, y = points[slot.bone]
    kind = name.split("-")[0]
    if name == "shadow":
        return [84, 207, 172, 224]
    if name == "head":
        y -= 9
    if name in ("body", "armor", "mark"):
        y -= 8
    if kind in ("arm", "leg"):
        is_tip = any(end in name for end in ("-hand-", "-foot-"))
        if is_tip:
            x, y = x + 4, y + 5
            width, height = (20, 19) if kind == "leg" else (18, 21)
        else:
            stem, side = name.rsplit("-", 1)
            tip = f"{stem}-{'foot' if kind == 'leg' else 'hand'}-{side}"
            tx, ty = points[tip]
            x, y = (x + tx) / 2, (y + ty) / 2
            width, height = 26, abs(ty - points[slot.bone][1]) + 17
    else:
        sizes = {
            "body": (54 if variant == "biped" else 86, 54), "head": (38, 36),
            "armor": (66, 48), "mark": (29, 24), "gear": (54, 66),
            "wing": (64, 40), "wheel": (30, 30), "swarm": (28, 22), "crystal": (34, 54),
        }
        width, height = (22, 35) if name.startswith("swarm-leg-") else sizes[kind]
    return [round(x - width / 2), round(y - height / 2),
            round(x + width / 2), round(y + height / 2)]


def guide_data(family, variant):
    _, bones, slots, _, points = base_rig(family, {"variant": variant}, CANVAS, ROOT, PIXELS_PER_UNIT)
    cells = {}
    for index, slot in enumerate(slots):
        col, row = index % 4, index // 4
        left, top = 32 + col * 288, 40 + row * 240
        cells[slot.name] = {
            "box": [left, top, left + 264, top + 216],
            "target": target_box(slot, variant, points),
            "bone": slot.bone,
            "required": slot.required,
        }
    return {
        "family": family, "variant": variant, "sheet": SHEET, "canvas": CANVAS,
        "root": ROOT, "pixelsPerUnit": PIXELS_PER_UNIT, "pivots": points, "slots": cells,
        "parents": {name: parent for name, (parent, _, _) in bones.items()},
    }


def guide_image(guide):
    image = Image.new("RGB", SHEET, "#12161B")
    draw = ImageDraw.Draw(image)
    for slot in guide["slots"].values():
        x, y, right, bottom = slot["box"]
        draw.rectangle((x, y, right - 1, bottom - 1), fill="#1D242C", outline="#4A5563", width=2)

    # 오른쪽 패널은 조립 자세의 원점과 관절 위치만 표시한다.
    left, top = 1216, 384
    draw.rectangle((left, top, left + 255, top + 255), outline="#4A5563", width=2)
    marks = {name: (left + x, top + y) for name, (x, y) in guide["pivots"].items()}
    for name, parent in guide["parents"].items():
        if parent:
            draw.line((marks[parent], marks[name]), fill="#4A5563", width=2)
    for name, (x, y) in marks.items():
        if name == "root":
            draw.line((x - 15, y, x + 15, y), fill="#E69F24", width=2)
            draw.line((x, y - 9, x, y + 9), fill="#E69F24", width=2)
        else:
            draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill="#2FB5A3")
    return image


def all_guides():
    for family, variants in VARIANTS.items():
        for variant in variants:
            yield f"{family}-{variant}", guide_data(family, variant)
