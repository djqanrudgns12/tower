"""레일·냉각 시트를 패킹하고 세 타워의 같은 레벨을 비교한다."""

import argparse
import hashlib
from itertools import combinations
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from mortar_pack import DEFAULT_FONT, REFERENCE_LEVELS, check_evolution, read_cells
from pack import finish_cell, pack_grid
from check import R04, manifest_errors, palette_violations, read_image, silhouette_iou


LABELS = {
    "rail": ("레일 포탑", ("단포신", "잠금 날개와 슬라이더", "옆 장갑과 균형추", "쌍포신", "유압 고정발",
                         "후방 방열판", "세라믹 삼연장", "가속 고리와 확장 갑판", "옆 장갑과 안테나",
                         "4열 레일과 3중 가속 고리", "4번째 가속 고리와 금테 기단")),
    "cryo": ("냉각 중계탑", ("3중 공명 고리", "냉매 회수관과 보호 캡", "중간 클램프와 벤트", "4중 공명 고리",
                          "하부 방열판", "고리 분할판", "분리한 두 고리 묶음", "냉매 탱크와 확장판",
                          "상단 분사 노즐", "5단 냉각 고리", "냉각 결정과 금테 노즐")),
}
CROSS_IOU_LIMIT = .55


def make_review(out, tower, reference, forms, levels, font_path):
    title, names = LABELS[tower]
    board = Image.new("RGBA", (1592, 704), R04[0])
    draw = ImageDraw.Draw(board)
    heading = ImageFont.truetype(str(font_path), 29)
    body = ImageFont.truetype(str(font_path), 17)
    for x, text in ((24, title), (194, "원화와 Blender 렌더")):
        draw.text((x, 20), text, fill=R04[3], font=heading if x == 24 else body)
    for index, level in enumerate(REFERENCE_LEVELS):
        x = 24 + index * 310
        draw.rectangle((x, 67, x + 300, 296), fill=R04[1], outline=R04[2])
        draw.text((x + 11, 79), f"Lv{level}", fill=R04[3], font=body)
        offset = 214 * index
        sx, sy = reference.width / 1100, reference.height / 619
        crop = reference.crop((round((38 + offset) * sx), round(89 * sy),
                               round((208 + offset) * sx), round(329 * sy)))
        crop.thumbnail((130, 166), Image.Resampling.LANCZOS)
        board.alpha_composite(crop, (x + 74 - crop.width // 2, 104))
        board.alpha_composite(forms[levels.index(level)].resize((153, 153), Image.Resampling.LANCZOS), (x + 144, 104))
        for shift, label in ((74, "원화"), (219, "렌더")):
            draw.text((x + shift, 281), label, fill=R04[3], font=body, anchor="ms")

    draw.text((24, 316), "11형태 진화", fill=R04[3], font=heading)
    for index, (level, name, form) in enumerate(zip(levels, names, forms)):
        x, y = 24 + index % 6 * 260, 358 + index // 6 * 167
        draw.rectangle((x, y, x + 251, y + 156), fill=R04[1], outline=R04[2])
        board.alpha_composite(form.resize((162, 162), Image.Resampling.LANCZOS), (x + 54, y - 4))
        draw.text((x + 10, y + 10), f"Lv{level}", fill=R04[3], font=body)
        draw.text((x + 10, y + 144), name, fill=R04[3], font=body, anchor="ls")
    board.save(out / f"{tower}-review.webp", lossless=True, method=6)


def make_strip(out, tower, forms, levels, font_path):
    board = Image.new("RGBA", (782, 87), R04[1])
    draw = ImageDraw.Draw(board)
    font = ImageFont.truetype(str(font_path), 14)
    for index, (level, form) in enumerate(zip(levels, forms)):
        x = index * 70 + 16
        draw.rectangle((x, 10, x + 47, 57), fill=R04[0], outline=R04[2])
        board.alpha_composite(form.resize((48, 48), Image.Resampling.BOX), (x, 10))
        draw.text((x + 24, 78), f"Lv{level}", fill=R04[3], font=font, anchor="ms")
    board.save(out / f"{tower}-48px.webp", lossless=True, method=6)


def check_cells(name, tiles, layout):
    levels, directions = layout["levels"], layout["directions"]
    if name in ("bodies", "forms") and len(tiles) != len(levels):
        raise ValueError(f"{name}: 레벨과 프레임 수가 다릅니다.")
    if name == "forms" and len({tile.tobytes() for tile in tiles}) != len(levels):
        raise ValueError("같은 그림으로 렌더된 진화 단계가 있습니다.")
    if name in layout["headSheets"]:
        if len(tiles) != len(layout["headSheets"][name]) * directions:
            raise ValueError(f"{name}: 레벨·방향과 포두 프레임 수가 다릅니다.")
        for begin in range(0, len(tiles), directions):
            if len({tile.tobytes() for tile in tiles[begin:begin + directions]}) != directions:
                raise ValueError(f"{name}: 포두 회전 방향이 중복됩니다.")
    if name == "attack":
        frames = layout["grids"][name]["columns"]
        if len(tiles) != sum(weapon["attack"]["frames"] for weapon in layout["weapons"]):
            raise ValueError("무기별 공격 프레임 수가 레시피와 다릅니다.")
        for begin in range(0, len(tiles), frames):
            if len({tile.tobytes() for tile in tiles[begin:begin + frames - 1]}) != frames - 1:
                raise ValueError("공격 전개 중 같은 그림인 프레임이 있습니다.")


def pack_tower(source, out, reference, font=DEFAULT_FONT):
    layout = json.loads((source / "layout.json").read_text())
    tower, levels, raw_size = layout["towerId"], layout["levels"], layout["tile"]
    head_sheets = layout["headSheets"]
    if [level for group in head_sheets.values() for level in group] != levels:
        raise ValueError("포두 시트에 레벨이 빠졌거나 순서가 다릅니다.")
    out.mkdir(parents=True, exist_ok=False)
    assets = []
    for name, grid in layout["grids"].items():
        cells = read_cells(source, name, layout)
        for density in (1, 2):
            size = raw_size * density // 2
            tiles = [finish_cell(cell.resize((size, size), Image.Resampling.BOX), outline_px=density)
                     for cell in cells]
            check_cells(name, tiles, layout)
            sheet = pack_grid(tiles, grid["columns"])
            asset_id = f"{tower}-{name}" + ("-2x" if density == 2 else "")
            path = out / f"{asset_id}.webp"
            sheet.save(path, lossless=True, method=6)
            if palette_violations(read_image(path)):
                raise ValueError(f"{path.name}: R04 팔레트 위반")
            pivot = layout["headPivot" if name in head_sheets else "bodyPivot"]
            assets.append({
                "id": asset_id, "file": path.name, "width": sheet.width, "height": sheet.height,
                "artifactHash": hashlib.sha256(path.read_bytes()).hexdigest(),
                "sprite": {"frameWidth": size, "frameHeight": size, "frameCount": len(tiles),
                           "pivot": [round(coord * size / raw_size) for coord in pivot]},
            })

    manifest = {
        "assets": assets, "levels": levels, "directions": layout["directions"],
        "headSheets": [{"asset": f"{tower}-{name}", "asset2x": f"{tower}-{name}-2x", "levels": group}
                       for name, group in head_sheets.items() if name in layout["grids"]],
        "headAnchors2x": layout["headAnchors"],
        "reviewDirection": layout["reviewDirection"], "weapons": layout["weapons"],
    }
    errors = manifest_errors(manifest, out)
    if errors:
        raise ValueError("\n".join(errors))
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    published = published_forms(out)
    forms = [published[level][0] for level in levels]
    make_review(out, tower, read_image(reference), forms, levels, font)
    make_strip(out, tower, forms, levels, font)
    overlaps, failures = check_evolution(forms, levels, published[levels[0]][1])
    print(json.dumps({"타워": tower, "시트": len(assets), "48px 인접 단계 IoU": overlaps}, ensure_ascii=False))
    if failures:
        raise ValueError("48px 인접 실루엣 기준 미달: " + ", ".join(failures))


def published_forms(folder):
    manifest = json.loads((folder / "manifest.json").read_text())
    sprite = next(asset for asset in manifest["assets"] if asset["id"].endswith("-forms"))
    atlas = read_image(folder / sprite["file"])
    spec = sprite["sprite"]
    w, h = spec["frameWidth"], spec["frameHeight"]
    columns = atlas.width // w
    cells = {}
    for index, level in enumerate(manifest["levels"]):
        x, y = index % columns * w, index // columns * h
        cells[level] = (atlas.crop((x, y, x + w, y + h)), spec["pivot"])
    return cells


def compare_towers(folders):
    towers = {folder.name: published_forms(folder) for folder in folders}
    levels = next(iter(towers.values())).keys()
    if any(forms.keys() != levels for forms in towers.values()):
        raise ValueError("세 타워의 레벨 목록이 다릅니다.")
    results, failures = {}, []
    for left, right in combinations(towers, 2):
        pair = f"{left}·{right}"
        results[pair] = {}
        for level in levels:
            iou = silhouette_iou(towers[left][level], towers[right][level])
            results[pair][level] = round(iou, 4)
            if iou >= CROSS_IOU_LIMIT:
                failures.append(f"{pair} Lv{level} ({iou:.4f})")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit("48px 타워 간 실루엣 기준 미달: " + ", ".join(failures))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="세 타워의 같은 레벨에서 48px 실루엣 IoU를 비교합니다.")
    parser.add_argument("folders", type=Path, nargs=3)
    compare_towers(parser.parse_args().folders)
