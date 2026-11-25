"""무기 단계마다 포두 16방향의 공격 8프레임을 게임용으로 렌더한다."""

import argparse
from functools import partial
import json
import math
from pathlib import Path
import sys

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import mortar_render
import tower_render
import support_render
from render import PALETTE


def render(tower, kit_file, recipe_file, out):
    stages = json.loads(recipe_file.read_text())["stages"]
    out.mkdir(parents=True, exist_ok=False)
    bpy.ops.wm.open_mainfile(filepath=str(kit_file))
    colors = (*PALETTE, "amber-charge") if tower == "prism" else PALETTE
    materials = {name: bpy.data.materials[f"R04 · {name}"] for name in colors}
    if tower == "mortar":
        kit = bpy.data.scenes["곡사 포대 · 부품"]
        assemble = mortar_render.assemble
        head_height = mortar_render.CENTER_HEIGHT
    elif tower in support_render.KITS:
        _, title, _, _ = support_render.KITS[tower]
        kit = bpy.data.scenes[f"{title} · 부품"]
        assemble = partial(support_render.assemble, tower)
        head_height = mortar_render.CENTER_HEIGHT
    else:
        kit = bpy.data.scenes[f"{tower_render.TITLES[tower]} · 부품"]
        assemble = partial(tower_render.assemble, tower)
        head_height = tower_render.HEAD_HEIGHT
    center = tower_render.HEAD_CENTERS.get(tower, mortar_render.CENTER_HEIGHT)
    for stage in stages:
        level = stage["level"]
        if level not in (1, 6, 12, 18):
            continue
        for half in range(2):
            cells = [(stage, direction, "head", frame)
                     for direction in range(half * 8, (half + 1) * 8)
                     for frame in range(stage["attack"]["frames"])]
            mortar_render.batch(kit, materials, out / f"attack-{level}-{half}.png", cells, 8, assemble, center)
    up_z = math.sqrt(1 - mortar_render.CAMERA_RAY.z ** 2)
    tile = mortar_render.TILE
    pivot = [tile // 2, round(tile * (.5 - (head_height - center) * up_z / mortar_render.VIEW))]
    (out / "layout.json").write_text(json.dumps({"pivot2x": pivot}, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tower", choices=("mortar", "rail", "cryo", *support_render.KITS))
    parser.add_argument("kit", type=Path)
    parser.add_argument("recipe", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    render(args.tower, args.kit, args.recipe, args.out.resolve())
