"""게시된 아틀라스의 알파와 Spine 동작 좌표로 접합·가림을 검사한다."""

import argparse
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image

from batch import CATALOG, PUBLIC, SPECIES, white_patches
from mesh_weights import audit_mesh_budget
from part_guides import PIXELS_PER_UNIT
from pilot import write_json


MIN_JOINT_PIXELS = 6
JOINT_RADIUS = 24


def rasterize(image, vertices):
    """실제 영역의 좌상단·우상단·좌하단을 기준으로 알파를 3px/단위로 합성한다."""
    points = np.asarray(vertices) * [PIXELS_PER_UNIT, -PIXELS_PER_UNIT]
    start, right, bottom = points
    ends = np.array([start, right, bottom, right + bottom - start])
    left, top = np.floor(ends.min(axis=0)).astype(int)
    width, height = np.ceil(ends.max(axis=0)).astype(int) - [left, top]
    matrix = np.column_stack(((right - start) / image.width, (bottom - start) / image.height))
    inverse = np.linalg.inv(matrix)
    offset = inverse @ ([left, top] - start)
    transform = (*inverse[0], offset[0], *inverse[1], offset[1])
    warped = image.transform((width, height), Image.Transform.AFFINE, transform, Image.Resampling.BILINEAR)
    return left, top, np.asarray(warped) >= 128


def alpha_region(layer, box):
    x, y, pixels = layer
    left, top, right, bottom = box
    result = np.zeros((bottom - top, right - left), dtype=bool)
    a, b = max(left, x), min(right, x + pixels.shape[1])
    c, d = max(top, y), min(bottom, y + pixels.shape[0])
    if a < b and c < d:
        result[c-top:d-top, a-left:b-left] = pixels[c-y:d-y, a-x:b-x]
    return result


def overlap_pixels(parent, child):
    x, y, pixels = child
    box = x, y, x + pixels.shape[1], y + pixels.shape[0]
    return int(np.count_nonzero(pixels & alpha_region(parent, box)))


def hinge_pixels(parent, child, pivot):
    x, y = np.rint(np.asarray(pivot) * [PIXELS_PER_UNIT, -PIXELS_PER_UNIT]).astype(int)
    r = JOINT_RADIUS
    box = (x-r, y-r, x+r+1, y+r+1)
    dy, dx = np.ogrid[-r:r+1, -r:r+1]
    overlap = alpha_region(parent, box) & alpha_region(child, box)
    return int(np.count_nonzero(overlap & (dx * dx + dy * dy <= r * r)))


def joint_pairs(actor):
    slots = actor["poses"][0]["slots"]
    for child in slots:
        bone = actor["slots"][child]
        parent = actor["parents"][bone]
        if child == bone and parent in slots and child.startswith(("arm-", "leg-", "wing-", "wheel-", "swarm-leg-", "head")):
            yield parent, child, child


def visible_pixels(layers, name):
    x, y, pixels = layers[name]
    box = x, y, x + pixels.shape[1], y + pixels.shape[0]
    visible = pixels.copy()
    names = list(layers)
    for other in names[names.index(name)+1:]:
        visible &= ~alpha_region(layers[other], box)
    return int(visible.sum()), int(pixels.sum())


def measure(actor, atlas):
    pairs = list(joint_pairs(actor))
    joints = {}
    hinges = {}
    seen = {}
    crops = {name: atlas.crop(slot["box"]) for name, slot in actor["poses"][0]["slots"].items()}
    alphas = {name: crop.getchannel("A") for name, crop in crops.items()}
    for pose in actor["poses"]:
        layers = {name: rasterize(alphas[name], slot["vertices"]) for name, slot in pose["slots"].items()}
        where = [pose["clip"], round(pose["phase"], 4)]
        for parent, child, pivot in pairs:
            a, b = layers[parent], layers[child]
            area = overlap_pixels(a, b)
            if child not in joints or area < joints[child]["pixels"]:
                joints[child] = {"parent": parent, "pixels": area, "pose": where}
            hinge = hinge_pixels(a, b, pose["pivots"][pivot])
            hinges[child] = min(hinges.get(child, hinge), hinge)
        for name in ("head", "gear", "gear-rear", "armor"):
            if name in layers:
                visible, total = visible_pixels(layers, name)
                fraction = round(visible / total, 4) if total else 0
                if name not in seen or fraction < seen[name]["fraction"]:
                    seen[name] = {"fraction": fraction, "pixels": visible, "pose": where}
    return {"poses": len(actor["poses"]), "joints": joints, "hinges": hinges, "visible": seen,
            "white": {name: spots for name, crop in crops.items() if (spots := white_patches(crop))}}


def budget_violations(catalog_path, atlas_root):
    """내보낸 모든 리그가 본/슬롯/메시/가중치 상한, 걷기 키(≤9·루프 폐합), fall 길이를 지키는지 점검한다."""
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    violations = []
    for rig_id, meta in data["rigs"].items():
        rig = json.loads((atlas_root / meta["file"]).read_text(encoding="utf-8"))
        is_boss = "-boss-" in rig_id
        for reason, count, limit in audit_mesh_budget(rig, is_boss=is_boss):
            violations.append({"rig": rig_id, "reason": reason, "count": count, "limit": limit})
        walk_bones = rig.get("animations", {}).get("walk", {}).get("bones", {})
        for bname, channels in walk_bones.items():
            for cname, keys in channels.items():
                if len(keys) > 9:
                    violations.append({"rig": rig_id, "reason": f"walk:{bname}.{cname}", "count": len(keys), "limit": 9})
                if len(keys) >= 2:
                    if cname == "rotate" and abs((keys[-1].get("value", 0) - keys[0].get("value", 0)) % 360) > 0.01:
                        violations.append({"rig": rig_id, "reason": f"walk-loop:{bname}.{cname}", "count": 1, "limit": 0})
                    elif cname == "translate" and (
                        abs(keys[-1].get("x", 0) - keys[0].get("x", 0)) > 0.01
                        or abs(keys[-1].get("y", 0) - keys[0].get("y", 0)) > 0.01
                    ):
                        violations.append({"rig": rig_id, "reason": f"walk-loop:{bname}.{cname}", "count": 1, "limit": 0})
                    elif cname == "scale" and (
                        abs(keys[-1].get("x", 1) - keys[0].get("x", 1)) > 0.01
                        or abs(keys[-1].get("y", 1) - keys[0].get("y", 1)) > 0.01
                    ):
                        violations.append({"rig": rig_id, "reason": f"walk-loop:{bname}.{cname}", "count": 1, "limit": 0})
        fall_bones = rig.get("animations", {}).get("fall", {}).get("bones", {})
        fall_limit = 0.9 if is_boss else 0.6
        fall_dur = max(
            (k.get("time", 0) for ch in fall_bones.values() for keys in ch.values() for k in keys),
            default=0.0,
        )
        if fall_dur > fall_limit:
            violations.append({"rig": rig_id, "reason": "fall-duration", "count": fall_dur, "limit": fall_limit})
    return violations


def audit(catalog=CATALOG, public=PUBLIC, species_list=SPECIES):
    actors = {}
    budgets = []
    for species in species_list:
        cat_file = catalog / f"{species}.json"
        budgets.extend(budget_violations(cat_file, public.parent))
        result = json.loads(subprocess.check_output(
            ["node", Path(__file__).with_name("rig-poses.mjs"), cat_file, public.parent]))
        with Image.open(public / species / result["page"]) as packed:
            atlas = packed.convert("RGBA")
        actors.update({id: measure(actor, atlas) for id, actor in result["actors"].items()})
    failed = [id for id, row in actors.items()
              if any(joint["pixels"] < MIN_JOINT_PIXELS for joint in row["joints"].values())]
    hinge_failed = [id for id, row in actors.items() if any(area < MIN_JOINT_PIXELS for area in row["hinges"].values())]
    return {"minJointPixels": MIN_JOINT_PIXELS, "jointRadius": JOINT_RADIUS,
            "failed": failed, "hingeFailed": hinge_failed, "budgetViolations": budgets, "actors": actors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, nargs="?")
    parser.add_argument("--catalog", type=Path, default=CATALOG)
    parser.add_argument("--public", type=Path, default=PUBLIC)
    parser.add_argument("--species", nargs="+", choices=SPECIES, default=SPECIES)
    parser.add_argument("--budget", action="store_true")
    args = parser.parse_args()
    if args.budget:
        budgets = []
        for sp in args.species:
            budgets.extend(budget_violations(args.catalog / f"{sp}.json", args.public.parent))
        print(f"예산·제약·루프 위반 {len(budgets)}건")
        if budgets:
            print(json.dumps(budgets[:10], ensure_ascii=False, indent=2))
            raise SystemExit(1)
        return
    if not args.output:
        parser.error("output 경로 또는 --budget 플래그가 필요합니다.")
    report = audit(args.catalog, args.public, args.species)
    write_json(args.output, report)
    print(f"관절 접합 기준 미달 {len(report['failed'])}/{len(report['actors'])}개체 · "
          f"회전축 주변 여유 미달 {len(report['hingeFailed'])}개체 · "
          f"예산 초과 {len(report['budgetViolations'])}건")


if __name__ == "__main__":
    main()
