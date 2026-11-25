"""완성 타워 시트를 발행하고 게임 매니페스트 v2의 타워 항목을 갱신한다."""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from pack import finish_cell
from check import manifest_errors, palette_violations, read_image
from mortar_pack import read_cells


STARTING_TOWERS = ("rail", "mortar", "cryo")
TOWERS = (*STARTING_TOWERS, "prism", "hangar", "bastion")
TILE = 384
SCALE = .60


def cells_from_sheet(folder, asset):
    sprite = asset["sprite"]
    width, height = sprite["frameWidth"], sprite["frameHeight"]
    source = read_image(folder / asset["file"])
    columns = source.width // width
    for i in range(sprite["frameCount"]):
        x, y = i % columns * width, i // columns * height
        yield source.crop((x, y, x + width, y + height))


def write_sheet(folder, name, cells, columns):
    width, height = cells[0].size
    rows = (len(cells) + columns - 1) // columns
    atlas = Image.new("RGBA", (columns * width, rows * height))
    for i, cell in enumerate(cells):
        atlas.paste(cell, (i % columns * width, i // columns * height))
    path = folder / f"{name}.webp"
    atlas.save(path, lossless=True, method=6)
    return path


def publish_sheet(sheets, folder, name, base, high, columns, pivot):
    file = write_sheet(folder, name, base, columns)
    file2x = write_sheet(folder, f"{name}-2x", high, columns)
    if any(palette_violations(read_image(path)) for path in (file, file2x)):
        raise ValueError(f"{name}: R04 팔레트 위반")
    width, height = base[0].size
    sheets[name] = {
        "file": f"towers/{folder.name}/{file.name}",
        "width": width, "height": height, "count": len(base), "pivot": pivot,
        "file2x": f"towers/{folder.name}/{file2x.name}",
        "artifactHash": hashlib.sha256(file.read_bytes()).hexdigest(),
        "artifactHash2x": hashlib.sha256(file2x.read_bytes()).hexdigest(),
    }


def publish_attacks(sheets, folder, attack_source, weapon, pivot2x):
    level, count = weapon["level"], weapon["attack"]["frames"]
    if count != 8:
        raise ValueError("게임용 공격 시트에는 방향당 8프레임이 필요합니다.")
    ids = []
    for half in range(2):
        raw = read_cells(attack_source, f"attack-{level}-{half}", {
            "tile": TILE, "grids": {f"attack-{level}-{half}": {"columns": count, "rows": 8, "frames": count * 8}},
        })
        high = [finish_cell(cell, outline_px=2) for cell in raw]
        base = [finish_cell(cell.resize((TILE // 2, TILE // 2), Image.Resampling.BOX)) for cell in raw]
        for start in range(0, len(base), count):
            if any(len({cell.tobytes() for cell in cells[start:start + count - 1]}) != count - 1
                   for cells in (base, high)):
                raise ValueError(f"Lv{level}: 공격 프레임의 동작이 중복됩니다.")

        # 한 시트의 모든 방향에 같은 절단 상자를 사용해 피벗과 프레임 번호가 유지된다.
        px, py = (round(v / 2) for v in pivot2x)
        bounds = [cell.getbbox() for cell in base] + [(px, py, px + 1, py + 1)]
        bounds += [(x // 2, y // 2, (right + 1) // 2, (bottom + 1) // 2)
                   for x, y, right, bottom in (cell.getbbox() for cell in high)]
        left = min(box[0] for box in bounds)
        top = min(box[1] for box in bounds)
        box = (left, top, max(box[2] for box in bounds), max(box[3] for box in bounds))
        name = f"{folder.name}-attack-lv{level}-{half}"
        publish_sheet(sheets, folder, name, [cell.crop(box) for cell in base],
                      [cell.crop(tuple(v * 2 for v in box)) for cell in high], count, [px - left, py - top])
        ids.append(name)
    return {"fps": weapon["attack"]["fps"], "sheets": ids, "frames": count}


def publish_drone(sheets, folder, tech, assets):
    base, high = (list(cells_from_sheet(tech, assets[f"hangar-drone{suffix}"])) for suffix in ("", "-2x"))
    px, py = assets["hangar-drone"]["sprite"]["pivot"]
    bounds = [cell.getbbox() for cell in base] + [(px, py, px + 1, py + 1)]
    bounds += [(x // 2, y // 2, (right + 1) // 2, (bottom + 1) // 2)
               for x, y, right, bottom in (cell.getbbox() for cell in high)]
    left, top = min(b[0] for b in bounds), min(b[1] for b in bounds)
    box = (left, top, max(b[2] for b in bounds), max(b[3] for b in bounds))
    publish_sheet(sheets, folder, "hangar-flight", [cell.crop(box) for cell in base],
                  [cell.crop(tuple(2 * n for n in box)) for cell in high], 8, [px - left, py - top])


def publish_tower(tower, tech, attacks, out, sheets):
    folder = out / tower
    folder.mkdir(parents=True)
    source = json.loads((tech / "manifest.json").read_text())
    errors = manifest_errors(source, tech)
    if errors:
        raise ValueError("\n".join(errors))
    assets = {asset["id"]: asset for asset in source["assets"]}
    body = f"{tower}-bodies"
    for suffix in ("", "-2x"):
        asset = assets[body + suffix]
        (folder / asset["file"]).write_bytes((tech / asset["file"]).read_bytes())
    sprite = assets[body]["sprite"]
    sheets[body] = {
        "file": f"towers/{tower}/{assets[body]['file']}", "width": sprite["frameWidth"],
        "height": sprite["frameHeight"], "count": sprite["frameCount"], "pivot": sprite["pivot"],
        "file2x": f"towers/{tower}/{assets[body + '-2x']['file']}",
        "artifactHash": assets[body]["artifactHash"], "artifactHash2x": assets[body + "-2x"]["artifactHash"],
    }
    attack_forms = {weapon["level"]: weapon for weapon in source["weapons"]}
    layout_path = attacks / "layout.json"
    attack_pivot = json.loads(layout_path.read_text())["pivot2x"] if layout_path.exists() else None
    clips, heads = {}, {}
    directions = source["directions"]
    for group in source["headSheets"]:
        base_asset, high_asset = (assets[group[key]] for key in ("asset", "asset2x"))
        base, high = (list(cells_from_sheet(tech, asset)) for asset in (base_asset, high_asset))
        for index, level in enumerate(group["levels"]):
            start, end = index * directions, (index + 1) * directions
            head = f"{tower}-lv{level}-heads"
            publish_sheet(sheets, folder, head, base[start:end], high[start:end], 4, base_asset["sprite"]["pivot"])
            heads[level] = head
            if level in attack_forms:
                clips[level] = publish_attacks(sheets, folder, attacks, attack_forms[level],
                                              attack_pivot or high_asset["sprite"]["pivot"])

    if tower == "hangar":
        publish_drone(sheets, folder, tech, assets)
    forms = []
    for index, level in enumerate(source["levels"]):
        weapon_level = max(start for start in clips if start <= level)
        forms.append({
            "body": body, "bodyFrame": index, "head": heads[level],
            "mount": [round(v / 2) for v in source["headAnchors2x"][index]],
            "scale": SCALE, "attack": clips[weapon_level],
        })
    return forms


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="기술 시트가 있는 타워별 폴더의 상위 폴더")
    parser.add_argument("attacks", type=Path, help="게임용 공격 렌더의 타워별 폴더가 있는 상위 폴더")
    parser.add_argument("manifest", type=Path, help="지도와 종족 항목을 이어받을 매니페스트")
    parser.add_argument("out", type=Path, help="게임 폴더에 반영할 새 출력 폴더")
    parser.add_argument("--tower", choices=TOWERS, action="append")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    for tower in dict.fromkeys(args.tower or STARTING_TOWERS):
        sheets = {}
        forms = publish_tower(tower, args.source / tower, args.attacks / tower, args.out / "towers", sheets)
        if tower in STARTING_TOWERS:
            manifest["sheets"].update(sheets)
            manifest["towers"][tower] = forms
        else:
            folder = args.out / "towers" / tower
            (folder / "pack.json").write_text(json.dumps({"forms": forms, "sheets": sheets}, indent=2) + "\n")
            lazy = manifest.setdefault("lazyTowers", [])
            if tower not in lazy:
                lazy.append(tower)
    (args.out / "manifest-v2.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
