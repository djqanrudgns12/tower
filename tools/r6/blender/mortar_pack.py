"""곡사 포대 렌더를 두 해상도의 WebP와 원화 비교판으로 묶는다."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

from pack import finish_cell, pack_grid
from check import (
    R04, manifest_errors, mask_at_48, palette_violations, read_image, scene_difference, silhouette_iou,
)


LABELS = {
    1: "사각 포상과 단포신", 2: "보강 띠와 앵커", 4: "방패와 적재 상자",
    6: "중장갑 포신과 회전판", 8: "스커트와 공급 슈트", 10: "경고 띠와 완충기",
    12: "세라믹 포상과 쌍포", 14: "고정발과 장갑 덮개", 16: "장전 암과 압력 게이지",
    18: "금테 포상과 4연장", 20: "4방향 스커트와 탄도 돔",
}
REFERENCE_LEVELS = (1, 6, 12, 18, 20)
ADJACENT_IOU_LIMIT = .92
DEFAULT_FONT = Path("/System/Library/Fonts/AppleSDGothicNeo.ttc")


def read_cells(source_dir, name, layout):
    grid = layout["grids"][name]
    size = layout["tile"]
    width, height = grid["columns"] * size, grid["rows"] * size
    image = read_image(source_dir / f"{name}.png")
    if image.size != (width, height):
        raise ValueError(f"{name}의 PNG 크기와 레이아웃이 다릅니다.")
    cells = []
    for i in range(grid["columns"] * grid["rows"]):
        x = i % grid["columns"] * size
        y = i // grid["columns"] * size
        cell = image.crop((x, y, x + size, y + size))
        if i < grid["frames"]:
            cells.append(cell)
        elif cell.getchannel("A").getbbox():
            raise ValueError(f"{name}의 빈 칸에 렌더가 들어 있습니다.")
    return cells


def reference_crop(reference, index):
    # 바이블 원화의 다섯 카드에서 글자를 뺀 기체 부분만 가져온다.
    center = 160 + index * 280
    box = (center - 110, 220, center + 110, 435)
    scale = reference.width / 1440
    return reference.crop(tuple(round(coord * scale) for coord in box))


def make_review(out, reference, forms, levels, font_path):
    board = Image.new("RGBA", (1592, 782), R04[0])
    draw = ImageDraw.Draw(board)
    title = ImageFont.truetype(str(font_path), 32)
    section = ImageFont.truetype(str(font_path), 23)
    body = ImageFont.truetype(str(font_path), 18)
    small = ImageFont.truetype(str(font_path), 15)
    draw.text((24, 20), "곡사 포대", fill=R04[3], font=title)
    draw.text((24, 69), "원화와 Blender 렌더", fill=R04[3], font=section)
    for i, level in enumerate(REFERENCE_LEVELS):
        x = 24 + i * 310
        draw.rectangle((x, 102, x + 302, 325), fill=R04[1], outline=R04[2])
        draw.text((x + 12, 112), f"Lv{level}", fill=R04[3], font=body)
        for offset, label in ((80, "원화"), (225, "렌더")):
            draw.text((x + offset, 305), label, fill=R04[3], font=small, anchor="ms")
        ref = reference_crop(reference, i)
        ref.thumbnail((141, 143), Image.Resampling.LANCZOS)
        board.alpha_composite(ref, (x + 10, 147))
        match = forms[levels.index(level)].resize((160, 160), Image.Resampling.LANCZOS)
        board.alpha_composite(match, (x + 145, 142))

    draw.text((24, 346), "11형태 진화", fill=R04[3], font=section)
    for index, (level, form) in enumerate(zip(levels, forms)):
        x, y = 24 + index % 6 * 260, 381 + index // 6 * 192
        draw.rectangle((x, y, x + 251, y + 182), fill=R04[1], outline=R04[2])
        sprite = form.resize((170, 170), Image.Resampling.LANCZOS)
        board.alpha_composite(sprite, (x + 67, y - 2))
        draw.text((x + 12, y + 11), f"Lv{level}", fill=R04[3], font=body)
        draw.text((x + 12, y + 162), LABELS[level], fill=R04[3], font=small)
    board.save(out / "mortar-review.webp", format="WEBP", lossless=True, method=6)


def make_strip(out, forms, levels, font_path):
    strip = Image.new("RGBA", (782, 90), R04[1])
    draw = ImageDraw.Draw(strip)
    font = ImageFont.truetype(str(font_path), 14)
    for index, (level, form) in enumerate(zip(levels, forms)):
        x = index * 70 + 16
        sprite = form.resize((48, 48), Image.Resampling.BOX)
        draw.rectangle((x, 10, x + 47, 57), fill=R04[0], outline=R04[2])
        strip.alpha_composite(sprite, (x, 10))
        draw.text((x + 24, 79), f"Lv{level}", fill=R04[3], font=font, anchor="ms")
    strip.save(out / "mortar-48px.webp", format="WEBP", lossless=True, method=6)


def check_evolution(forms, levels, pivot):
    overlaps, failures = {}, []
    for previous_level, level, previous, form in zip(levels, levels[1:], forms, forms[1:]):
        pair = f"Lv{previous_level}→{level}"
        overlap = silhouette_iou((previous, pivot), (form, pivot))
        overlaps[pair] = round(overlap, 4)
        if overlap >= ADJACENT_IOU_LIMIT:
            failures.append(f"{pair} ({overlap:.4f})")
        old_mask, _ = mask_at_48(previous, pivot)
        new_mask, _ = mask_at_48(form, pivot)
        if not ImageChops.subtract(new_mask, old_mask).getbbox():
            failures.append(f"{pair} (밖으로 나온 윤곽이 없습니다)")
    return overlaps, failures


def pack_mortar(source, out, reference, font=DEFAULT_FONT):
    layout = json.loads((source / "layout.json").read_text())
    levels, raw_size = layout["levels"], layout["tile"]
    head_sheets = layout["headSheets"]
    if [level for group in head_sheets.values() for level in group] != levels:
        raise ValueError("포두 시트에 레벨이 빠졌거나 순서가 다릅니다.")
    assets, forms = [], []
    out.mkdir(parents=True, exist_ok=False)
    for name, grid in layout["grids"].items():
        raw = read_cells(source, name, layout)
        for density in (1, 2):
            size = raw_size * density // 2
            tiles = [finish_cell(img.resize((size, size), Image.Resampling.BOX), outline_px=density)
                     for img in raw]
            if name == "forms":
                if len({tile.tobytes() for tile in tiles}) != len(levels):
                    raise ValueError(f"{size}px에서 같은 그림으로 렌더된 진화 단계가 있습니다.")
                if density == 1:
                    forms = tiles
            if name in head_sheets:
                directions = layout["directions"]
                if len(tiles) != len(head_sheets[name]) * directions:
                    raise ValueError(f"{name}의 포두 프레임 수가 레벨·방향 수와 다릅니다.")
                for begin in range(0, len(tiles), directions):
                    if len({tile.tobytes() for tile in tiles[begin:begin + directions]}) != directions:
                        raise ValueError(f"{size}px에서 포두 회전 방향이 중복됩니다.")
            if name == "attack":
                for begin in range(0, len(tiles), grid["columns"]):
                    windup = tiles[begin]
                    fired = tiles[begin + 3]
                    if scene_difference(windup, fired)["changedPixels"] == 0:
                        raise ValueError(f"{size}px에서 발사 자세가 준비 자세와 같습니다.")
            sheet = pack_grid(tiles, grid["columns"])
            asset_id = f"mortar-{name}" + ("-2x" if density == 2 else "")
            path = out / f"{asset_id}.webp"
            sheet.save(path, lossless=True, method=6)
            if palette_violations(read_image(path)):
                raise ValueError(f"{path.name}에 R04 팔레트 위반이 있습니다.")
            pivot = layout["headPivot" if name in head_sheets else "bodyPivot"]
            assets.append({
                "id": asset_id, "file": path.name, "width": sheet.width, "height": sheet.height,
                "artifactHash": hashlib.sha256(path.read_bytes()).hexdigest(),
                "sprite": {"frameWidth": size, "frameHeight": size, "frameCount": len(tiles),
                           "pivot": [round(coord * size / raw_size) for coord in pivot]},
            })

    manifest = {
        "assets": assets, "levels": levels, "directions": layout["directions"],
        "headSheets": [{"asset": f"mortar-{name}", "asset2x": f"mortar-{name}-2x", "levels": group}
                       for name, group in head_sheets.items()],
        "headAnchors2x": layout["headAnchors"],
        "reviewDirection": layout["reviewDirection"], "weapons": layout["weapons"],
    }
    errors = manifest_errors(manifest, out)
    if errors:
        raise ValueError("\n".join(errors))
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    make_review(out, read_image(reference), forms, levels, font)
    make_strip(out, forms, levels, font)
    pivot = [round(coord / 2) for coord in layout["bodyPivot"]]
    overlaps, failures = check_evolution(forms, levels, pivot)
    print(json.dumps({"시트": len(assets), "48px 인접 단계 IoU": overlaps}, ensure_ascii=False))
    if failures:
        raise ValueError(f"48px 진화 윤곽 기준 미달 (IoU < {ADJACENT_IOU_LIMIT}): {', '.join(failures)}")
