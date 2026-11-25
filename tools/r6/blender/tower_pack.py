"""타워 시트를 패킹하고 같은 레벨 실루엣을 비교한다."""

import argparse
import hashlib
from itertools import combinations
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

from mortar_pack import DEFAULT_FONT, REFERENCE_LEVELS, check_evolution, read_cells
from pack import finish_cell, pack_grid
from check import ALLOWED_COLORS, R04, manifest_errors, mask_at_48, palette_violations, read_image, silhouette_iou
from tower_game_pack import SCALE


LABELS = {
    "rail": ("레일 포탑", ("원기둥 목과 단포신", "잠금 날개와 슬라이더", "옆 장갑과 균형추", "합금 목과 쌍포신", "유압 고정발",
                         "후방 방열판", "장갑 기둥과 삼연장", "가속 고리와 옆 갑판", "옆 장갑과 안테나",
                         "장포신과 얇은 가속 고리", "4번째 가속 고리와 금테 기단")),
    "cryo": ("냉각 중계탑", ("3중 공명 고리", "냉매 회수관과 보호 캡", "중간 클램프와 벤트", "4중 공명 고리",
                          "하부 방열판", "공명 고리 곡면 클립", "분리한 두 고리 묶음", "냉매 탱크와 확장판",
                          "상단 분사 노즐", "5단 냉각 고리", "부유 결정과 하단 노즐")),
    "prism": ("프리즘 탑", ("삼각 기단과 단결정", "모서리 고정대", "외곽 가새", "외곽 위성 수정 두 개",
                              "합금 외피", "부유 광학 고리", "굽은 세라믹 장갑과 단결정", "반사판",
                              "집속 고리와 상단 보강", "대형 결정과 위성 네 개", "장갑 버팀목과 광학 고리")),
    "hangar": ("드론 격납고", ("2단 육각 갑판과 정찰 드론", "유도등 지지대", "격납 아치와 방풍벽", "로터 두 기와 격자 마스트",
                               "보조 안테나", "충전 도크", "쌍발 레일과 고정익 세 기", "갑판 외곽 지지발",
                               "격자 증축과 탄약 랙", "고정익 네 기와 금테", "육각 유도선과 지휘 드론")),
    "bastion": ("방벽 기지", ("지원 벙커와 전면 방벽", "방벽 쐐기", "붐 보조 센서", "이어진 2단 방벽",
                               "충격 흡수부", "후방 송출 장치", "3단 세라믹 방벽과 접시", "기단 고정발",
                               "보조 센서 받침", "금테 접시와 4단 방벽", "지원 코어와 방벽 고정발")),
}
CROSS_IOU_LIMIT = .55
PALETTE_NAMES = ("카본", "슬레이트", "선", "은회", "앰버", "틸")
COLOR_FAMILY = dict(zip(ALLOWED_COLORS, (name for name in PALETTE_NAMES for _ in range(4))))



def make_review(out, tower, reference, forms, levels, font_path):
    title, names = LABELS[tower]
    board = Image.new("RGBA", (1592, 704), R04[0])
    draw = ImageDraw.Draw(board)
    heading = ImageFont.truetype(str(font_path), 29)
    body = ImageFont.truetype(str(font_path), 17)
    for x, text in ((24, title), (194, "원화와 Blender 렌더")):
        draw.text((x, 20), text, fill=R04[3], font=heading if x == 24 else body)
    support = tower in ("prism", "hangar", "bastion")
    for index, level in enumerate(REFERENCE_LEVELS):
        x = 24 + index * 310
        draw.rectangle((x, 67, x + 300, 296), fill=R04[1], outline=R04[2])
        draw.text((x + 11, 79), f"Lv{level}", fill=R04[3], font=body)
        offset = 214 * index
        sx, sy = reference.width / 1100, reference.height / 619
        left, top, right, bottom = (33, 98, 201, 363) if support else (38, 89, 208, 329)
        crop = reference.crop((round((left + offset) * sx), round(top * sy),
                               round((right + offset) * sx), round(bottom * sy)))
        crop.thumbnail((130, 166), Image.Resampling.LANCZOS)
        board.alpha_composite(crop, (x + 74 - crop.width // 2, 104))
        board.alpha_composite(forms[levels.index(level)].resize((153, 153), Image.Resampling.LANCZOS), (x + 144, 104))
        for shift, label in ((74, "원화"), (219, "렌더")):
            draw.text((x + shift, 281), label, fill=R04[3], font=body, anchor="ms")

    draw.text((24, 316), "11형태 진화", fill=R04[3], font=heading)
    for index, (level, name, form) in enumerate(zip(levels, names, forms)):
        x, y = 24 + index % 6 * 260, 358 + index // 6 * 167
        draw.rectangle((x, y, x + 251, y + 156), fill=R04[1], outline=R04[2])
        size, dx, dy = (130, 60, -2) if tower == "rail" else (162, 54, -4)
        board.alpha_composite(form.resize((size, size), Image.Resampling.LANCZOS), (x + dx, y + dy))
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
    if name == "drone":
        if len(tiles) != 32:
            raise ValueError("별도 비행 드론에 무기 4단계 × 8방향이 필요합니다.")
        for begin in range(0, len(tiles), 8):
            if len({tile.tobytes() for tile in tiles[begin:begin + 8]}) != 8:
                raise ValueError("드론 비행 방향이 중복됩니다.")
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
            pivot = layout["headPivot" if name in head_sheets or name == "drone" else "bodyPivot"]
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


def published_cells(folder, manifest, sheet):
    sprite = next(asset for asset in manifest["assets"] if asset["id"].endswith(f"-{sheet}"))
    atlas = read_image(folder / sprite["file"])
    spec = sprite["sprite"]
    width, height = spec["frameWidth"], spec["frameHeight"]
    columns = atlas.width // width
    cells = []
    for index in range(spec["frameCount"]):
        x, y = index % columns * width, index // columns * height
        cells.append((atlas.crop((x, y, x + width, y + height)), spec["pivot"]))
    return cells


def published_forms(folder):
    manifest = json.loads((folder / "manifest.json").read_text())
    return dict(zip(manifest["levels"], published_cells(folder, manifest, "forms")))


def comparison_board(path, towers, font_path):
    board = Image.new("RGBA", (1252, 316), R04[0])
    draw = ImageDraw.Draw(board)
    title = ImageFont.truetype(str(font_path), 23)
    label = ImageFont.truetype(str(font_path), 17)
    draw.text((20, 14), "R6 타워 6종 · Lv20", fill=R04[3], font=title)
    ground_y = 224
    for index, (tower, forms) in enumerate(towers.items()):
        left = 20 + index * 204
        draw.rectangle((left, 51, left + 192, 296), fill=R04[1], outline=R04[2])
        form, (px, py) = forms[20]
        board.alpha_composite(form, (left + 96 - px, ground_y - py))
        name = "곡사 포대" if tower == "mortar" else LABELS[tower][0]
        draw.text((left + 96, 287), name, fill=R04[3], font=label, anchor="ms")
    board.save(path, lossless=True, method=6)


def color_shares(form):
    color_pixels = dict.fromkeys(PALETTE_NAMES, 0)
    swatches = form.getcolors(form.width * form.height)
    for frequency, (*rgb, alpha) in swatches:
        if alpha >= 128:
            color_pixels[COLOR_FAMILY[tuple(rgb)]] += frequency
    total = sum(color_pixels.values())
    return {name: round(count * 100 / total, 2) for name, count in color_pixels.items()}


def attack_change(previous, frame):
    # 투명 여백을 분모에서 빼고 채널 중 하나라도 12 이상 바뀐 화소를 센다.
    union = ImageChops.lighter(previous.getchannel("A"), frame.getchannel("A")).point(
        lambda alpha: 255 if alpha >= 128 else 0)
    difference = ImageChops.difference(previous, frame).split()
    peak = ImageChops.lighter(ImageChops.lighter(difference[0], difference[1]),
                             ImageChops.lighter(difference[2], difference[3]))
    visible = ImageChops.darker(union, peak.point(lambda delta: 255 if delta >= 12 else 0))
    return visible.histogram()[255] / union.histogram()[255]


def placed_sprite(image, pivot):
    canvas = Image.new("RGBA", (192, 192))
    canvas.alpha_composite(image, (96 - pivot[0], 128 - pivot[1]))
    return canvas, (96, 128)


def visible_luma(image):
    bins = image.convert("L").histogram(mask=image.getchannel("A").point(
        lambda alpha: 255 if alpha >= 128 else 0))
    return sum(value * count for value, count in enumerate(bins)) / sum(bins)


def compare_to_pad(file, towers, pad_inputs):
    image, projection = pad_inputs
    config = json.loads(projection.read_text())
    pad = read_image(image).crop((0, 0, *config["padSize"]))
    pad_entry = placed_sprite(pad, config["padPivot"])
    pad_luma = visible_luma(pad)
    file.write("\n## 빈 설치 칸과 Lv1\n\n"
               "빈 칸의 첫 프레임과 게임 배율로 줄인 타워를 지면 피벗에 맞췄다. "
               "명도는 알파 128 이상 화소의 평균이다.\n\n"
               "| 타워 | 48px IoU | 타워 명도 | 빈 칸 명도 |\n"
               "| --- | ---: | ---: | ---: |\n")
    size = round(192 * SCALE)
    for tower, levels in towers.items():
        form, pivot = levels[1]
        sprite = form.resize((size, size), Image.Resampling.BOX)
        model_entry = placed_sprite(sprite, tuple(round(value * SCALE) for value in pivot))
        iou = silhouette_iou(model_entry, pad_entry)
        file.write(f"| {tower} | {iou:.4f} | {visible_luma(sprite):.1f} | {pad_luma:.1f} |\n")


def evidence_table(path, towers, folders, pad_inputs):
    with path.open("w") as file:
        file.write("# R6 타워 진화와 색 비중\n\n")
        file.write("192px 완성 형태에서 알파 128 이상인 화소를 색 계열별로 셌다. "
                   "프리즘 앰버는 주수정과 위성 수정 표면이다. 나머지 다섯 종은 앰버 표식을 전부 금테로 셌다.\n\n")
        file.write("| 타워 | 레벨 | " + " | ".join(PALETTE_NAMES) + " | 48px 면적 | 이전 단계 IoU |\n")
        file.write("| --- | ---: | " + " | ".join("---:" for _ in range(8)) + " |\n")
        for tower, levels in towers.items():
            previous = None
            for level, entry in levels.items():
                form, _ = entry
                shares = color_shares(form)
                area = mask_at_48(*entry)[0].histogram()[255]
                overlap = "—" if previous is None else f"{silhouette_iou(previous, entry):.4f}"
                values = " | ".join(f"{share:.2f}%" for share in shares.values())
                file.write(f"| {tower} | {level} | {values} | {area} | {overlap} |\n")
                previous = entry

        file.write("\n## 공격 견본\n\n"
                   "192px 견본의 첫 프레임과 공격 중 프레임을 비교했다. "
                   "가시 영역에서 RGBA 중 하나가 12 이상 바뀐 비율의 최댓값이다.\n\n"
                   "| 타워 | Lv1 | Lv6 | Lv12 | Lv18 |\n"
                   "| --- | ---: | ---: | ---: | ---: |\n")
        for folder in folders:
            manifest = json.loads((folder / "manifest.json").read_text())
            frames = published_cells(folder, manifest, "attack")
            offset, peaks = 0, []
            for weapon in manifest["weapons"]:
                count = weapon["attack"]["frames"]
                idle = frames[offset][0]
                peak = max(attack_change(idle, image) for image, _ in frames[offset + 1:offset + count])
                peaks.append(f"{peak:.1%}")
                offset += count
            file.write(f"| {folder.name} | " + " | ".join(peaks) + " |\n")
        if pad_inputs:
            compare_to_pad(file, towers, pad_inputs)


def comparison_table(path, results, levels):
    with path.open("w") as file:
        file.write("# R6 타워 6종 48px 실루엣 IoU\n\n")
        file.write("완성 형태를 48px로 축소한 뒤 알파 128 이상을 지면 피벗에 맞춰 비교했다. 기준은 0.55 미만이다.\n\n")
        file.write("| 타워 조합 | " + " | ".join(f"Lv{level}" for level in levels) + " |\n")
        file.write("| --- | " + " | ".join("---:" for _ in levels) + " |\n")
        for pair, values in results.items():
            cells = [f"{value:.4f}" if value < CROSS_IOU_LIMIT else f"**{value:.4f}**"
                     for value in values.values()]
            file.write(f"| {pair} | " + " | ".join(cells) + " |\n")


def compare_towers(folders, board=None, table=None, font=DEFAULT_FONT, evidence=None, pad_inputs=None):
    towers = {folder.name: published_forms(folder) for folder in folders}
    levels = next(iter(towers.values())).keys()
    if any(forms.keys() != levels for forms in towers.values()):
        raise ValueError("타워의 레벨 목록이 다릅니다.")
    results, failures = {}, []
    for left, right in combinations(towers, 2):
        pair = f"{left}·{right}"
        results[pair] = {}
        for level in levels:
            iou = silhouette_iou(towers[left][level], towers[right][level])
            results[pair][level] = round(iou, 4)
            if iou >= CROSS_IOU_LIMIT:
                failures.append(f"{pair} Lv{level} ({iou:.4f})")
    heights = {}
    for level in levels:
        row = {}
        for tower, forms in towers.items():
            mask, _ = mask_at_48(*forms[level])
            _, top, _, bottom = mask.getbbox()
            row[tower] = bottom - top
        heights[level] = row
        if "rail" in row and any(height >= row["rail"] for name, height in row.items() if name in ("mortar", "cryo")):
            failures.append(f"Lv{level} 레일 높이 {row}")
    print(json.dumps({"48px IoU": results, "48px 높이": heights}, ensure_ascii=False, indent=2))
    if board:
        comparison_board(board, towers, font)
    if table:
        comparison_table(table, results, levels)
    if evidence:
        evidence_table(evidence, towers, folders, pad_inputs)
    if failures:
        raise SystemExit("48px 타워 간 실루엣 기준 미달: " + ", ".join(failures))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="타워의 같은 레벨에서 48px 실루엣 IoU를 비교합니다.")
    parser.add_argument("folders", type=Path, nargs="+")
    parser.add_argument("--board", type=Path)
    parser.add_argument("--table", type=Path)
    parser.add_argument("--font", type=Path, default=DEFAULT_FONT)
    parser.add_argument("--evidence", type=Path, help="레벨별 색 비중·면적·인접 IoU 표")
    parser.add_argument("--pad", type=Path, nargs=2, metavar=("WEBP", "PROJECTION"),
                        help="설치 칸 비교에 사용할 시트와 피벗 JSON")
    args = parser.parse_args()
    compare_towers(args.folders, args.board, args.table, args.font, args.evidence, args.pad)
