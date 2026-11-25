"""조립 자세를 두 차례 맞추고 같은 계통의 부품을 T1 관절에 끼운다."""

import numpy as np
from PIL import Image

from cut_parts import CANVAS, assemble, estimate_targets, place


def part_pixels(image):
    return np.asarray(image.getchannel("A")) >= 128


def contact(mask, point):
    y, x = np.nonzero(mask)
    if not len(x):
        return point
    idx = np.argmin((x - point[0]) ** 2 + (y - point[1]) ** 2)
    return [int(x[idx]), int(y[idx])]


def joints(guide, layers, defaults):
    result = dict(defaults)
    for name, image in layers.items():
        if name != guide["slots"][name]["bone"]:
            continue
        x, y, right, bottom = image.getbbox()
        # 머리는 목, 몸통은 골반, 팔다리는 몸쪽 끝을 중심으로 돈다.
        fraction = .78 if name in ("head", "body") else .16
        hint = [(x + right) / 2, y + (bottom - y) * fraction]
        pixels = part_pixels(image)
        parent = guide["parents"][name]
        if parent in layers:
            overlap = pixels & part_pixels(layers[parent])
            if overlap.any():
                pixels = overlap
        result[name] = contact(pixels, hint)
    return result


def register(targets, pieces, canonical, fixed):
    """같은 뼈에 붙는 단계별 부품의 관절이 T1 회전축을 덮게 한다."""
    result = dict(targets)
    for name, pivot in canonical.items():
        if name not in pieces or name in fixed:
            continue
        bounds = targets[name]
        layer = place(pieces[name][0][0], bounds)
        x, y = contact(part_pixels(layer), pivot)
        dx = min(256 - bounds[2], max(-bounds[0], round(pivot[0] - x)))
        dy = min(256 - bounds[3], max(-bounds[1], round(pivot[1] - y)))
        result[name] = [bounds[0] + dx, bounds[1] + dy, bounds[2] + dx, bounds[3] + dy]
    return result


def signals(image):
    # 알파 및 무광 면의 명도를 함께 비교해 외곽 안에서 서로 다른 부품이 뒤바뀌지 않게 한다.
    alpha = part_pixels(image)
    gray = np.asarray(image.convert("L"), dtype=np.int16)
    return alpha, gray


def refine(pieces, guide, reference, targets, step, scale_change, canonical, fixed):
    visible = [name for name in guide["slots"] if name in pieces and name != "shadow"]
    layers = {name: place(pieces[name][0][0], targets[name]) for name in visible}
    ref_alpha, ref_gray = signals(reference)
    for name in sorted(visible, key=lambda k: -np.count_nonzero(part_pixels(layers[k]))):
        if name in fixed:
            continue
        under = Image.new("RGBA", CANVAS)
        above = np.zeros(ref_alpha.shape, bool)
        index = visible.index(name)
        for other in visible[:index]:
            under.alpha_composite(layers[other])
        for other in visible[index + 1:]:
            above |= part_pixels(layers[other])
        under_alpha, under_gray = signals(under)
        # 각 후보가 그 위치에 들어갈 때 줄어드는 오차를 같은 배경에서 계산한다.
        background = 256 * (ref_alpha != under_alpha) + np.abs(ref_gray - under_gray) * (ref_alpha & under_alpha)
        x1, y1, x2, y2 = targets[name]
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        part = pieces[name][0][0]
        best, best_box = None, targets[name]
        for scale in (1, 1 - scale_change, 1 + scale_change):
            width = max(1, round((x2 - x1) * scale))
            height = max(1, round((y2 - y1) * scale))
            if width > 256 or height > 256:
                continue
            sample = place(part, [0, 0, width, height]).crop((0, 0, width, height))
            alpha, gray = signals(sample)
            for dx in (0, -step, step, -2 * step, 2 * step):
                for dy in (0, -step, step, -2 * step, 2 * step):
                    x, y = cx - width // 2 + dx, cy - height // 2 + dy
                    if x < 0 or y < 0 or x + width > 256 or y + height > 256:
                        continue
                    if name in canonical:
                        px, py = (round(v) for v in canonical[name])
                        if not (0 <= px-x < width and 0 <= py-y < height and alpha[py-y, px-x]):
                            continue
                    crop = np.s_[y:y + height, x:x + width]
                    active = alpha & ~above[crop]
                    cost = 256 * ~ref_alpha[crop] + np.abs(ref_gray[crop] - gray) * ref_alpha[crop]
                    score = int(np.sum((cost - background[crop]) * active))
                    if best is None or score < best:
                        best, best_box = score, [x, y, x + width, y + height]
        targets[name] = best_box
        layers[name] = place(part, best_box)
    return layers


def fit(pieces, guide, reference, placement, canonical):
    targets, defaults = estimate_targets(guide, pieces, reference)
    targets.update(placement.get("targets", {}))
    fixed = set(placement.get("fixedTargets", []))
    if fixed - pieces.keys():
        raise ValueError("수동으로 맞춘 부품 이름을 확인하세요.")
    if canonical:
        targets = register(targets, pieces, canonical, fixed)
    scores = []
    best = None
    for step, scale in ((6, .18), (3, .08)):
        layers = refine(pieces, guide, reference, targets, step, scale, canonical, fixed)
        pivots = canonical or {**joints(guide, layers, defaults), **placement.get("jointHints", {})}
        placement.update(targets=targets, pivots=pivots)
        *_, iou = assemble(pieces, guide, reference, placement, [])
        scores.append(iou)
        if best is None or iou >= best[0]:
            best = iou, dict(targets), dict(pivots)
    placement.update(targets=best[1], pivots=best[2])
    return scores
