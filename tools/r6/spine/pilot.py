"""도형 파츠 8장으로 기계 보행체 T1~T4의 Spine 저작 데이터를 생성한다."""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw


SKINS = ("T1", "T2", "T3", "T4")
PIVOT = (24, 42)
CANVAS = (48, 48)
INK = "#12161B"
PARTS = {
    "leg": ((8, 17), [(2, 0), (7, 1), (7, 12), (4, 16), (0, 13), (1, 5)], "#4A5563"),
    "foot": ((13, 7), [(2, 1), (6, 0), (10, 2), (12, 5), (11, 6), (0, 6)], "#1D242C"),
    "hull": ((31, 19), [(0, 8), (7, 0), (26, 0), (30, 6), (27, 15), (5, 18)], "#4A5563"),
    "visor": ((12, 7), [(0, 2), (8, 0), (11, 2), (10, 5), (0, 6)], "#2FB5A3"),
    "T1": ((17, 10), [(0, 8), (5, 0), (14, 0), (16, 4), (12, 9)], "#B8C0C8"),
    "T2": ((21, 11), [(0, 8), (2, 3), (7, 0), (19, 0), (20, 4), (16, 10)], "#B8C0C8"),
    "T3": ((24, 13), [(0, 10), (5, 2), (12, 2), (17, 0), (23, 5), (19, 12)], "#B8C0C8"),
    "T4": ((27, 14), [(0, 10), (5, 4), (13, 4), (17, 0), (23, 0), (26, 5), (21, 13)], "#E69F24"),
}
# 좌표는 발 밑 원점 기준이며 위쪽이 양수다.
BONES = (
    ("root", None, 0, 0),
    ("hull", "root", 0, 22),
    ("far-leg", "hull", 6, -6),
    ("far-foot", "far-leg", 0, -12),
    ("near-leg", "hull", -8, -7),
    ("near-foot", "near-leg", 0, -12),
)
SLOTS = (
    ("far-leg", "far-leg", "leg", (29, 25)),
    ("far-foot", "far-foot", "foot", (26, 35)),
    ("hull", "hull", "hull", (8, 11)),
    ("armor", "hull", None, (10, 5)),
    ("visor", "hull", "visor", (30, 14)),
    ("near-leg", "near-leg", "leg", (12, 25)),
    ("near-foot", "near-foot", "foot", (9, 37)),
)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rotate(*keys):
    return [{"time": time, "value": angle} for time, angle in keys]


def translate(*keys):
    return [{"time": time, "x": x, "y": y} for time, x, y in keys]


def rotate_curved(*keys):
    """정규화 베지어 핸들 (cx1, cy1, cx2, cy2)을 Spine 4.3 절대 좌표 curve로 변환한다."""
    items = [(*k, None)[:3] for k in keys]
    result = []
    for idx, (t1, v1, ease) in enumerate(items):
        entry = {"time": round(t1, 4), "value": round(v1, 4)}
        if ease and idx + 1 < len(items):
            t2, v2, _ = items[idx + 1]
            dt = t2 - t1
            dv = v2 - v1
            if dt > 0:
                cx1, cy1, cx2, cy2 = ease
                entry["curve"] = [
                    round(t1 + dt * cx1, 5), round(v1 + dv * cy1, 5),
                    round(t1 + dt * cx2, 5), round(v1 + dv * cy2, 5),
                ]
        result.append(entry)
    return result


def translate_curved(*keys):
    """2채널(translate/scale) 키프레임에 Spine 4.3 8원소 절대 좌표 curve를 붙인다."""
    items = [(*k, None)[:4] for k in keys]
    result = []
    for idx, (t1, x1, y1, ease) in enumerate(items):
        entry = {"time": round(t1, 4), "x": round(x1, 4), "y": round(y1, 4)}
        if ease and idx + 1 < len(items):
            t2, x2, y2, _ = items[idx + 1]
            dt = t2 - t1
            dx = x2 - x1
            dy = y2 - y1
            if dt > 0:
                cx1, cy1, cx2, cy2 = ease
                entry["curve"] = [
                    round(t1 + dt * cx1, 5), round(x1 + dx * cy1, 5),
                    round(t1 + dt * cx2, 5), round(x1 + dx * cy2, 5),
                    round(t1 + dt * cx1, 5), round(y1 + dy * cy1, 5),
                    round(t1 + dt * cx2, 5), round(y1 + dy * cy2, 5),
                ]
        result.append(entry)
    return result


scale_curved = translate_curved


def animations():
    walk = {"hull": {"translate": translate((0, 0, 0), (0.25, 0, 2), (0.5, 0, 0),
                                             (0.75, 0, 2), (1, 0, 0))}}
    for side, sign in (("far", -1), ("near", 1)):
        walk[f"{side}-leg"] = {"rotate": rotate((0, -18 * sign), (0.5, 18 * sign), (1, -18 * sign))}
        walk[f"{side}-foot"] = {"rotate": rotate((0, 9 * sign), (0.5, -9 * sign), (1, 9 * sign))}
    return {
        "walk": {"bones": walk},
        "hit": {"bones": {"hull": {
            "rotate": rotate((0, 0), (1 / 12, 16), (0.25, 0)),
            "translate": translate((0, 0, 0), (1 / 12, -2, 1), (0.25, 0, 0)),
        }}},
        "fall": {"bones": {
            "hull": {
                "rotate": rotate((0, 0), (0.25, 33), (0.5, 61)),
                "translate": translate((0, 0, 0), (0.25, -2, -6), (0.5, -3, -8)),
            },
            "near-leg": {"rotate": rotate((0, 0), (0.25, 35), (0.5, 52))},
            "far-leg": {"rotate": rotate((0, 0), (0.25, 15), (0.5, 28))},
        }},
    }


def generate(out, author):
    out.mkdir(parents=True, exist_ok=False)
    parts = out / "parts"
    parts.mkdir()
    for name, (size, points, color) in PARTS.items():
        image = Image.new("RGBA", size)
        ImageDraw.Draw(image).polygon(points, fill=color, outline=INK)
        image.save(parts / f"{name}.png")

    layers = []
    for order, (slot, _, part, position) in enumerate(SLOTS):
        for skin in ("default",) if part else SKINS:
            layers.append({
                "slot": slot, "skin": skin, "order": order, "position": position,
                "path": f"parts/{part or skin}.png",
            })
    manifest = out / "layers.json"
    source = out / "walker.json"
    write_json(manifest, {"canvas": CANVAS, "root": PIVOT, "layers": layers})
    subprocess.run([
        sys.executable, str(author / "scripts/layers_to_spine.py"),
        "--manifest", str(manifest), "--out", str(source),
    ], check=True)

    rig = json.loads(source.read_text())
    rig["bones"] = []
    origin = {}
    for name, parent, x, y in BONES:
        bone = {"name": name, "x": x, "y": y}
        if parent:
            bone["parent"] = parent
        rig["bones"].append(bone)
        px, py = origin.get(parent, (0, 0))
        origin[name] = (px + x, py + y)
    slot_bones = {slot: bone for slot, bone, _, _ in SLOTS}
    for slot in rig["slots"]:
        slot["bone"] = slot_bones[slot["name"]]
    for skin in rig["skins"]:
        for slot, attachments in skin["attachments"].items():
            x, y = origin[slot_bones[slot]]
            for region in attachments.values():
                region["x"] -= x
                region["y"] -= y
    rig["animations"] = animations()
    write_json(source, rig)

    # 편집 가능 JSON과 패킹된 런타임 JSON을 같은 프로젝트에서 출력한다.
    start_dir = out / "editable"
    packed = out / "packed"
    cli = [
        "spine-cli", "-i", str(source), "-o", str(out / "walker.spine"), "-r",
        "-i", str(out / "walker.spine"), "-o", str(start_dir),
        "-e", str(author / "references/export-editable.json"),
        "-i", str(out / "walker.spine"), "-o", str(packed),
        "--set", "packAtlas.premultiplyAlpha=false", "-e", "json+pack",
    ]
    subprocess.run(cli, check=True)
    exported = json.loads((start_dir / source.name).read_text())
    for field in ("bones", "slots", "animations", "skins"):
        def names(data):
            if field == "animations":
                return set(data[field])
            return {entry["name"] for entry in data[field]}
        if names(exported) != names(rig):
            raise ValueError(f"왕복 결과에 누락된 {field} 항목이 있습니다.")
    if not (packed / "walker.atlas").is_file():
        raise ValueError("Spine 아틀라스가 생성되지 않았습니다.")
    print("Spine 왕복 완료 · 뼈 6개 · 슬롯 7개 · 스킨 4종 · 동작 3종")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path, help="새 출력 폴더")
    parser.add_argument("--author", type=Path, default=Path.home() / ".agents/skills/spine-authoring")
    args = parser.parse_args()
    generate(args.out.resolve(), args.author.resolve())
