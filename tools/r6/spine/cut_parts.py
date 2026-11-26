"""R6 분해 시트를 슬롯 PNG와 Spine 종족 명세로 변환한다."""

import argparse
from collections import defaultdict
from dataclasses import dataclass
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from monsters import ACTORS, SPECIES, new_directory, read_json, slots_for_skin
from part_guides import CANVAS, PIXELS_PER_UNIT, ROOT, all_guides, guide_data, guide_image
from parts import suggest_pivot
from pilot import write_json
from rigs import layout
from slot_plan import draw_plan


MIN_AREA = 8
RESAMPLE = Image.Resampling.LANCZOS


@dataclass
class Component:
    runs: list[tuple[int, int, int]]

    @property
    def box(self):
        return (min(left for _, left, _ in self.runs), self.runs[0][0],
                max(right for _, _, right in self.runs), self.runs[-1][0] + 1)

    @property
    def area(self):
        return sum(right - left for _, left, right in self.runs)

    def crop(self, image):
        left, top, right, bottom = self.box
        pixels = np.zeros((bottom - top, right - left), dtype=bool)
        for y, start, end in self.runs:
            pixels[y - top, start - left:end - left] = True
        data = np.asarray(image.crop(self.box)).copy()
        data[~pixels] = 0
        return Image.fromarray(data)


def components(mask):
    """인접 행의 구간을 묶어 8방향 연결 성분을 찾는다."""
    parents, runs = [], []

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    previous = []
    for y, row in enumerate(mask):
        edges = np.flatnonzero(np.diff(row, prepend=False, append=False))
        current = []
        cursor = 0
        for left, right in zip(edges[::2].tolist(), edges[1::2].tolist()):
            index = len(runs)
            runs.append((y, left, right))
            parents.append(index)
            current.append((left, right, index))
            while cursor < len(previous) and previous[cursor][1] < left:
                cursor += 1
            for previous_index in range(cursor, len(previous)):
                before_left, _, before_id = previous[previous_index]
                if before_left > right:
                    break
                parents[root(before_id)] = root(index)
        previous = current
    groups = defaultdict(list)
    for index, run in enumerate(runs):
        groups[root(index)].append(run)
    return [Component(group) for group in groups.values()]


def open_rgba(path):
    with Image.open(path) as image:
        return image.convert("RGBA")


def valid_box(box, size):
    if (not isinstance(box, (list, tuple)) or len(box) != 4 or any(type(v) is not int for v in box)
            or not (0 <= box[0] < box[2] <= size[0] and 0 <= box[1] < box[3] <= size[1])):
        raise ValueError(f"이미지 안의 사각형이 필요합니다 · {box}")
    return tuple(box)


def valid_point(point):
    if (not isinstance(point, (list, tuple)) or len(point) != 2
            or any(type(v) not in (int, float) or not 0 <= v < size for v, size in zip(point, CANVAS))):
        raise ValueError(f"조립 캔버스 안의 좌표가 필요합니다 · {point}")
    return point


def foreground(image, background):
    """구형 RGB 시트에서 지정한 단색의 유사 화소를 지운다."""
    if background is None:
        if image.getchannel("A").getextrema()[0] == 255:
            raise ValueError("배경이 없는 RGBA 그림이 필요합니다.")
        return image
    color, tolerance = background["rgb"], background["tolerance"]
    if (not isinstance(color, list) or len(color) != 3 or any(type(v) is not int or not 0 <= v <= 255 for v in color)
            or type(tolerance) is not int or not 0 <= tolerance <= 255):
        raise ValueError("배경 키는 RGB 세 값과 허용 오차로 지정하세요.")
    data = np.asarray(image).copy()
    difference = np.max(np.abs(data[:, :, :3].astype(np.int16) - color), axis=2)
    seed = Image.fromarray(np.uint8(difference > tolerance) * 255)
    padded = ImageOps.expand(seed, 1)
    ImageDraw.floodfill(padded, (0, 0), 64)
    # 단색 시트의 닫힌 윤곽 안에 있는 어두운 음영을 복원한다.
    mask = np.asarray(padded)[1:-1, 1:-1] != 64
    data[:, :, 3] *= mask
    return Image.fromarray(data)


def intersection(a, b):
    return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))


def touching_edges(box, cell):
    return {edge for edge, value, limit in zip(("left", "top", "right", "bottom"), box, cell) if value == limit}


def read_guide(image, guide, issues):
    if image.size != tuple(guide["sheet"]):
        raise ValueError(f"분해 시트 크기는 {guide['sheet']}이어야 합니다 · {image.size}")
    parts = defaultdict(list)
    cells = {name: tuple(slot["box"]) for name, slot in guide["slots"].items()}
    for part in components(np.asarray(image.getchannel("A")) > 0):
        box = part.box
        if part.area < MIN_AREA:
            issues.append({"code": "speck", "box": box})
            continue
        matches = [name for name, cell in cells.items() if intersection(box, cell)]
        if len(matches) != 1:
            issues.append({"code": "crossing_cells" if matches else "outside_cell",
                           "box": box, "slots": matches, "blocking": True})
            continue
        name, = matches
        if intersection(box, cells[name]) != (box[2] - box[0]) * (box[3] - box[1]) or touching_edges(box, cells[name]):
            issues.append({"code": "clipped_cell", "box": box, "slot": name, "blocking": True})
            continue
        parts[name].append((part.crop(image), box))
    return parts


def read_legacy(image, config, guide, issues):
    parts = defaultdict(list)
    for name, source in config["parts"].items():
        if name not in guide["slots"]:
            raise ValueError(f"틀에서 사용할 수 없는 슬롯입니다 · {name}")
        left, top, right, bottom = valid_box(source["box"], image.size)
        crop = foreground(image.crop((left, top, right, bottom)), config.get("background"))
        trim = set(source.get("trim", []))
        if trim - {"left", "top", "right", "bottom"}:
            raise ValueError(f"잘라낼 변의 이름을 확인하세요 · {name}")
        for part in components(np.asarray(crop.getchannel("A")) > 0):
            x1, y1, x2, y2 = part.box
            box = (left + x1, top + y1, left + x2, top + y2)
            if part.area < MIN_AREA:
                issues.append({"code": "speck", "box": box, "slot": name})
                continue
            edges = touching_edges(box, (left, top, right, bottom))
            if edges:
                issues.append({"code": "legacy_trim", "box": box, "slot": name,
                               "edges": sorted(edges), "blocking": bool(edges - trim)})
            parts[name].append((part.crop(crop), box))
    return parts


def normalize_reference(image, config):
    if "box" in config:
        image = image.crop(valid_box(config["box"], image.size))
    image = foreground(image, config.get("background"))
    if config.get("background") is not None:
        groups = components(np.asarray(image.getchannel("A")) > 0)
        if groups:
            image = max(groups, key=lambda part: part.area).crop(image)
    box = image.getbbox()
    if box is None:
        raise ValueError("조립 기준판에 보이는 화소가 없습니다.")
    if image.size == CANVAS:
        return image
    subject = image.crop(box)
    scale = min(184 / subject.width, 156 / subject.height)
    width, height = [max(1, round(size * scale)) for size in subject.size]
    canvas = Image.new("RGBA", CANVAS)
    canvas.paste(subject.resize((width, height), RESAMPLE), (ROOT[0] - width // 2, ROOT[1] - height))
    return canvas


def estimate_targets(guide, parts, reference):
    visible = [guide["slots"][name]["target"] for name in parts if name != "shadow"]
    pivots = {name: xy for name, xy in guide["pivots"].items() if name != "root"}
    if not visible:
        return {}, pivots
    bounds = (min(box[0] for box in visible), min(box[1] for box in visible),
              max(box[2] for box in visible), max(box[3] for box in visible))
    ref = reference.getbbox()
    sx, sy = ((ref[i + 2] - ref[i]) / (bounds[i + 2] - bounds[i]) for i in range(2))

    def point(x, y):
        return ref[0] + (x - bounds[0]) * sx, ref[1] + (y - bounds[1]) * sy

    targets = {}
    for name in parts:
        x1, y1, x2, y2 = guide["slots"][name]["target"]
        targets[name] = [*map(round, point(x1, y1)), *map(round, point(x2, y2))]
    pivots = {name: [round(max(0, min(v, size - 1)), 2) for v, size in zip(point(*xy), CANVAS)]
              for name, xy in pivots.items()}
    return targets, pivots


def orient_parts(pieces, rotations):
    for name, degrees in rotations.items():
        if name not in pieces or type(degrees) not in (int, float) or not -180 <= degrees <= 180:
            raise ValueError(f"슬롯의 회전각을 확인하세요 · {name}")
        rotated = []
        for part, source_box in pieces[name]:
            image = part.rotate(degrees, Image.Resampling.BICUBIC, expand=True)
            rotated.append((image.crop(image.getbbox()), source_box))
        pieces[name] = rotated
    return pieces


def place(part, target):
    x1, y1, x2, y2 = target
    scale = min((x2 - x1) / part.width, (y2 - y1) / part.height)
    width, height = [max(1, round(size * scale)) for size in part.size]
    x, y = (x1 + x2 - width) // 2, (y1 + y2 - height) // 2
    layer = Image.new("RGBA", CANVAS)
    layer.paste(part.resize((width, height), RESAMPLE), (x, y))
    return layer


def assemble(pieces, guide, reference, placement, issues):
    targets, pivots = estimate_targets(guide, pieces, reference)
    manual_targets, manual_pivots = placement.get("targets", {}), placement.get("pivots", {})
    if set(manual_targets) - pieces.keys() or set(manual_pivots) - (guide["pivots"].keys() - {"root"}):
        raise ValueError("조립 좌표에 쓰인 슬롯과 뼈 이름을 확인하세요.")
    pivots.update({name: valid_point(point) for name, point in manual_pivots.items()})
    layers, details = {}, {}
    preview = Image.new("RGBA", CANVAS)
    for name, parts in pieces.items():
        if len(parts) != 1:
            issues.append({"code": "multiple_components", "slot": name,
                           "boxes": [box for _, box in parts], "blocking": True})
            continue
        (part, box), = parts
        target = manual_targets.get(name, targets.get(name, guide["slots"][name]["target"]))
        try:
            valid_box(target, CANVAS)
        except ValueError:
            issues.append({"code": "clipped_canvas", "slot": name, "box": target, "blocking": True})
            continue
        layer = place(part, target)
        layers[name] = layer
        details[name] = {"sourceBox": box, "targetBox": target, "placedBox": layer.getbbox()}
        bone = guide["slots"][name]["bone"]
        if name == bone and bone not in manual_pivots:
            pivots[bone] = suggest_pivot(layer, pivots[bone], 3 * PIXELS_PER_UNIT)
    view = placement.get("view", {})
    _, _, slots, _ = layout(guide["family"], {"variant": guide["variant"]})
    if view.get("rearGear"):
        valid_box(view["rearGear"], CANVAS)
        layers["gear-rear"] = place(pieces["gear"][0][0].transpose(Image.Transpose.FLIP_LEFT_RIGHT), view["rearGear"])
    for slot in draw_plan(slots, view):
        if slot.part in layers and slot.part != "shadow":
            preview.alpha_composite(layers[slot.part])
    pivots = {name: valid_point(point) for name, point in pivots.items()}
    a, b = [np.asarray(image.getchannel("A")) >= 128 for image in (preview, reference)]
    union = np.count_nonzero(a | b)
    iou = round(np.count_nonzero(a & b) / union, 3) if union else 0
    return layers, details, pivots, preview, iou


def cut(sheet, reference_path, guide_path, out, species, entry, skin, placement_path=None):
    family = "boss" if entry.startswith("boss-") else entry
    if skin not in ACTORS[entry]:
        raise ValueError(f"계통과 단계 조합을 확인하세요 · {entry}/{skin}")
    saved_guide = read_json(guide_path)
    guide = json.loads(json.dumps(guide_data(family, saved_guide["variant"])))
    if saved_guide != guide:
        raise ValueError("안내판 JSON이 현재 뼈대와 다릅니다. 같은 틀의 새 안내판을 쓰세요.")
    placement = read_json(placement_path) if placement_path else {}
    profile = {"variant": guide["variant"]}
    armless = placement.get("armless", False)
    if type(armless) is not bool:
        raise ValueError("armless는 참 또는 거짓이어야 합니다.")
    if armless:
        if guide["variant"] != "biped":
            raise ValueError("팔 없는 단계는 이족 틀에서만 지정할 수 있습니다.")
        profile["armlessSkins"] = [skin]
    if "scale" in placement:
        scale = placement["scale"]
        if type(scale) not in (int, float) or not 0 < scale <= 8:
            raise ValueError("게임 표시 배율은 0 초과 8 이하여야 합니다.")
        profile["scale"] = scale
    _, _, slots, _ = layout(family, profile)
    intended = {slot.name: slot for slot in slots_for_skin(slots, profile, skin)}
    issues = []
    reference = normalize_reference(open_rgba(reference_path), placement.get("reference", {}))
    image = open_rgba(sheet)
    if "legacy" in placement:
        pieces = read_legacy(image, placement["legacy"], guide, issues)
    else:
        pieces = read_guide(foreground(image, None), guide, issues)
    orient_parts(pieces, placement.get("rotations", {}))
    for name in pieces.keys() - intended.keys():
        issues.append({"code": "omitted_slot_present", "slot": name, "blocking": True})
    for name, slot in intended.items():
        if slot.required and name not in pieces:
            issues.append({"code": "missing_slot", "slot": name, "blocking": True})
    layers, details, pivots, preview, iou = assemble(pieces, guide, reference, placement, issues)
    profile["pivots"] = pivots
    if placement.get("view"):
        profile["views"] = {skin: placement["view"]}
    ready = not any(issue.get("blocking") for issue in issues)
    with new_directory(out) as stage:
        silhouette = Image.new("RGBA", CANVAS, "#B8C0C8")
        silhouette.putalpha(reference.getchannel("A"))
        silhouette.save(stage / "assembly-silhouette.webp", lossless=True)
        reference.save(stage / "assembly-reference.webp", lossless=True)
        preview.save(stage / "assembly-preview.webp", lossless=True)
        write_json(stage / "report.json", {
            "species": species, "entry": entry, "skin": skin, "sheet": sheet.name,
            "reference": reference_path.name, "guide": guide_path.name,
            "placement": placement_path.name if placement_path else None,
            "ready": ready, "silhouetteIoU": iou, "parts": details, "pivots": pivots, "issues": issues,
        })
        if ready:
            folder = stage / entry / skin
            folder.mkdir(parents=True)
            for name, layer in layers.items():
                layer.save(folder / f"{name}.png")
            write_json(stage / "species.json", {"species": species, "canvas": CANVAS, "root": ROOT,
                                                "pixelsPerUnit": PIXELS_PER_UNIT, "rigs": {entry: profile}})
    print(f"{species}/{entry}/{skin} · 슬롯 {len(layers)}개 · 실루엣 IoU {iou:.3f} · {out / 'report.json'}")
    return ready


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    guides = commands.add_parser("guides", help="틀별 PNG 안내판과 좌표 JSON을 출력한다.")
    guides.add_argument("out", type=Path)
    run = commands.add_parser("cut", help="시트와 조립 기준판을 읽어 투명 PNG를 만든다.")
    run.add_argument("sheet", type=Path)
    run.add_argument("reference", type=Path)
    run.add_argument("guide", type=Path)
    run.add_argument("out", type=Path)
    run.add_argument("--species", required=True, choices=SPECIES)
    run.add_argument("--entry", required=True, choices=ACTORS)
    run.add_argument("--skin", required=True, choices=("T1", "T2", "T3", "T4"))
    run.add_argument("--placement", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "guides":
            with new_directory(args.out) as stage:
                for name, guide in all_guides():
                    guide_image(guide).save(stage / f"{name}.png", optimize=True)
                    write_json(stage / f"{name}.json", guide)
        elif not cut(args.sheet, args.reference, args.guide, args.out, args.species, args.entry, args.skin, args.placement):
            parser.exit(2, "대응하지 못한 파츠가 있습니다. report.json을 확인하세요.\n")
    except (ValueError, TypeError, KeyError, OSError) as error:
        parser.exit(1, f"처리 실패 · {error}\n")


if __name__ == "__main__":
    main()
