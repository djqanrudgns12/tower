"""기존 G2 기계 파츠의 색과 단순한 면을 사용한 재현용 합성 파츠."""

import argparse
from pathlib import Path
import shutil

from PIL import Image, ImageDraw

from monsters import ACTORS, base_rig, load_config


INK, SLATE, GRAY, SILVER, AMBER, TEAL = ("#12161B", "#1D242C", "#4A5563", "#B8C0C8", "#E69F24", "#2FB5A3")
PART_SHAPES = {
    "leg": ([(-4, 2), (4, 2), (6, -8), (2, -12), (-3, -7)], SLATE),
    "foot": ([(-4, 4), (2, 4), (6, -3), (6, -6), (-6, -6), (-6, -1)], GRAY),
    "arm": ([(-4, 3), (4, 3), (7, -3), (5, -8), (-3, -7)], GRAY),
    "hand": ([(-3, 4), (4, 4), (7, -3), (0, -6), (-4, -1)], SLATE),
    "head": ([(-6, 1), (-3, 7), (6, 8), (12, 3), (8, -2), (-4, -3)], SLATE),
    "wing-far": ([(0, 0), (4, 11), (14, 20), (19, 17), (11, 7), (5, -1)], GRAY),
    "wing-near": ([(0, -3), (-10, 0), (-22, 13), (-16, 16), (-5, 8), (0, 3)], SILVER),
}
BODIES = {
    "infantry": [(-8, -6), (-10, 7), (-3, 14), (5, 14), (11, 8), (9, -6)],
    "runner": [(-23, -5), (-26, 1), (-14, 8), (9, 9), (21, 3), (22, -5)],
    "armored": [(-22, -9), (-23, 3), (-18, 11), (9, 12), (26, 6), (27, -8)],
    "special": [(-13, -3), (-10, 7), (2, 10), (14, 7), (17, 0), (5, -7)],
    "boss": [(-18, -9), (-18, 10), (-11, 20), (9, 19), (21, 9), (15, -9)],
}


def paint(canvas, points, ppu, name, bone, family, variant, tier):
    x, y = points[bone]
    image = Image.new("RGBA", canvas)
    draw = ImageDraw.Draw(image)
    accent = TEAL if tier < 4 else AMBER

    def polygon(vertices, color, outline=INK):
        draw.polygon([(round(x + dx * ppu), round(y - dy * ppu)) for dx, dy in vertices],
                     fill=color, outline=outline, width=2 if outline else 1)

    if name == "body":
        body = BODIES[family]
        if variant == "quadruped" and family == "boss":
            body = [(-27, -7), (-28, 7), (-19, 17), (13, 16), (26, 8), (31, -6)]
        growth = 1 + (tier - 1) * .075
        if family == "armored" and tier == 1:
            growth = .76
        polygon([(dx * growth, dy) for dx, dy in body], GRAY)
        polygon([(-6, -3), (-7, 6), (6, 8), (12, 5), (8, -3)], SILVER)
    elif name == "armor":
        height = {"infantry": 12, "runner": 7, "armored": 10, "special": 7, "boss": 16}[family]
        width = 4 + tier * 4
        crest = tier * 2
        if family == "runner" and tier >= 3:
            crest += 6
        elif family == "armored":
            crest += (0, 2, 9, 16)[tier - 1]
        polygon([(-width, height - 4), (-width + 5, height + crest), (-7, height + crest + 3),
                 (2, height + 2), (10, height + 1), (13, height - 4), (7, height - 7), (-13, height - 8)], SILVER)
    elif name == "gear":
        length = 8 + 5 * tier
        rise = 2 + tier * 3
        if family == "armored":
            length += 8
            rise += 4
        polygon([(-2, -3), (6, 0), (length - 4, rise), (length, rise),
                 (length + 1, rise - 4), (7, -5)], GRAY)
    elif name == "mark":
        polygon([(1, 6), (8, 7), (11, 5), (5, 3)], accent, None)
    elif name in PART_SHAPES or name.startswith(("leg", "arm")):
        piece = ("foot" if "-foot-" in name else "hand" if "-hand-" in name else name.split("-")[0]
                 if name.startswith(("leg", "arm")) else name)
        shape, color = PART_SHAPES[piece]
        if piece == "leg" and family == "armored":
            shape = [(dx * 1.3, dy * .85) for dx, dy in shape]
        if piece == "head" and family in ("runner", "armored"):
            shape = [(dx * 1.15, dy * .72) for dx, dy in shape]
        if name.startswith("wing"):
            shape = [(dx * (1 + (tier - 1) * .12), dy) for dx, dy in shape]
        polygon(shape, color)
        if piece == "head":
            polygon([(1, 4), (8, 4), (9, 2), (1, 2)], accent, None)
    else:
        raise ValueError(f"합성 파츠가 없는 슬롯 · {name}")
    if not image.getbbox() or 0 in image.getbbox()[:2] or image.getbbox()[2] == canvas[0] or image.getbbox()[3] == canvas[1]:
        raise ValueError(f"{family}/{tier}/{name} · 합성 파츠가 잘렸습니다.")
    return image


def generate(source, out):
    _, canvas, root, ppu, profiles = load_config(source.parent)
    out.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(source, out / "species.json")
    for entry, skins in ACTORS.items():
        family = "boss" if entry.startswith("boss-") else entry
        variant, _, slots, _, pivots = base_rig(family, profiles.get(entry, {}), canvas, root, ppu)
        for skin in skins:
            tier = int(skin[-1])
            folder = out / entry / skin
            folder.mkdir(parents=True)
            for slot in slots:
                if slot.name == "shadow" or (slot.name == "gear" and tier == 1):
                    continue
                paint(canvas, pivots, ppu, slot.name, slot.bone, family, variant, tier).save(folder / f"{slot.name}.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path, help="합성 종족의 species.json")
    parser.add_argument("out", type=Path, help="새 소스 폴더")
    args = parser.parse_args()
    generate(args.spec, args.out)
