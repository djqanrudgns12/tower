"""32px 판독 띠, 실루엣 겹침과 바닥 대비를 계산한다."""

import argparse
from itertools import combinations, pairwise, product
from math import dist
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageCms, ImageColor, ImageDraw, ImageOps

from contrast import (
    INTERIOR_DELTA_E_LIMIT,
    OUTLINE_EFFECTIVE_ALPHA,
    OUTLINE_HEX,
    apply_outer_outline,
    interior_color_delta_e,
)
from monsters import FAMILIES, read_json
from pilot import write_json


SIZE = 32
EVOLUTION_LIMIT = .92
SPECIES_LIMIT = .55
COLOR_LIMIT = 15
BOSS_LIMIT = .70
CONTRAST_LIMIT = 1.5
# 초원 고원 맵 규격의 지형 바탕색과 길 표면색을 사용한다.
BACKGROUNDS = {"terrain": "#1D242C", "path": "#4A5563"}


def luminance(rgb):
    channels = [value / 255 for value in rgb]
    linear = [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in channels]
    return sum(value * weight for value, weight in zip(linear, (.2126, .7152, .0722)))


def ground_contrast(icon, mask):
    scores = {}
    for name, color in BACKGROUNDS.items():
        background = ImageColor.getrgb(color)
        ground = luminance(background)
        composite = Image.alpha_composite(Image.new("RGBA", icon.size, color), icon)
        pixels = (luminance(pixel[:3]) for pixel, visible in zip(composite.get_flattened_data(), mask.get_flattened_data()) if visible)
        ratios = [(max(foreground, ground) + .05) / (min(foreground, ground) + .05) for foreground in pixels]
        scores[name] = {"median": round(median(ratios), 3),
                        "lowShare": round(sum(value < CONTRAST_LIMIT for value in ratios) / len(ratios), 3)}
    return scores


def thumbnail(image, size=SIZE):
    crop = image.crop(image.getbbox())
    crop = ImageOps.contain(crop, (size, size), Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", (size, size))
    icon.paste(crop, ((size - crop.width) // 2, size - crop.height))
    return icon


def silhouette(icon):
    return icon.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0)


def iou(a, b):
    same = ImageChops.darker(a, b).histogram()[255]
    either = ImageChops.lighter(a, b).histogram()[255]
    if not either:
        raise ValueError("32px 판독 띠에 보이는 화소가 없습니다.")
    return same / either


def overlap(first, second, masks, limit):
    ratio = iou(masks[first], masks[second])
    return {"first": first, "second": second, "iou": ratio, "pass": ratio < limit}


def path_composite(icon):
    return Image.alpha_composite(Image.new("RGBA", icon.size, BACKGROUNDS["path"]), icon).convert("RGB")


def color_distance(pair, labs, masks):
    first, second = pair["first"], pair["second"]
    shared = ImageChops.darker(masks[first], masks[second]).get_flattened_data()
    return round(sum(dist(a, b) for a, b, visible in zip(labs[first], labs[second], shared) if visible)
                 / sum(bool(visible) for visible in shared), 3)


def write_color_board(out, paths, icons, pairs):
    block_w, block_h = 374, 170
    sheet = Image.new("RGB", (2 * block_w, 26 + block_h * ((len(pairs) + 1) // 2)), BACKGROUNDS["terrain"])
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), "32px / 128px   IoU >= 0.55, delta E < 15", fill="#B8C0C8")
    for index, pair in enumerate(pairs, 1):
        x, y = (index - 1) % 2 * block_w + 8, 26 + (index - 1) // 2 * block_h
        draw.text((x, y), f"{index:02d}  IoU {pair['iou']:.3f}   delta E {pair['deltaE']:.1f}", fill="#B8C0C8")
        for actor, offset in ((pair["first"], 0), (pair["second"], 179)):
            with Image.open(paths[actor]) as image:
                large = thumbnail(image.convert("RGBA"), 128)
            sheet.paste(path_composite(icons[actor]), (x + offset, y + 113))
            sheet.paste(path_composite(large), (x + offset + 35, y + 17))
            draw.text((x + offset, y + 149), actor, fill="#B8C0C8")
    sheet.save(out / "cross-species-worst.webp", lossless=True)


def review(packs, out):
    images = {}
    for pack in packs:
        spec = read_json(pack / "manifest-fragment.json")["species"]
        species, = spec
        if species in images:
            raise ValueError(f"동일 종족을 두 번 지정했습니다 · {species}")
        images[species] = {actor: pack / "silhouettes" / f"{actor}.png" for actor in spec[species]["entities"]}
    return review_images(images, out)


def review_images(images, out):
    masks, icons, outlined_icons, species_ids, evolution, cross = {}, {}, {}, {}, [], []
    boss_pairs, contrast, raw_contrast, interior_delta_e = {}, {}, {}, {}
    for species, paths in images.items():
        ids = tuple(paths)
        species_ids[species] = ids
        for actor in ids:
            with Image.open(paths[actor]) as image:
                icons[actor] = thumbnail(image.convert("RGBA"))
            masks[actor] = silhouette(icons[actor])
            if not masks[actor].getbbox():
                raise ValueError(f"{actor} · 32px 실루엣에 보이는 화소가 없습니다.")
            raw_contrast[actor] = ground_contrast(icons[actor], masks[actor])
            padded_raw = Image.new("RGBA", (SIZE + 2, SIZE + 2))
            padded_raw.paste(icons[actor], (1, 1))
            outlined = apply_outer_outline(icons[actor], pad=1)
            outlined_icons[actor] = outlined
            contrast[actor] = ground_contrast(outlined, silhouette(outlined))
            interior_delta_e[actor] = round(interior_color_delta_e(padded_raw, outlined), 3)
        bosses = [actor for actor in ids if actor.startswith(f"{species}-boss-")]
        regulars = [actor for actor in ids if actor not in bosses]
        pairs = [overlap(boss, regular, masks, BOSS_LIMIT) for boss, regular in product(bosses, regulars)]
        boss_pairs[species] = sorted(pairs, key=lambda pair: pair["iou"], reverse=True)
        for family in (*FAMILIES, "boss"):
            family_ids = [f"{species}-{family}-t{tier}" for tier in range(1, 5)]
            evolution.extend(overlap(a, b, masks, EVOLUTION_LIMIT) for a, b in pairwise(family_ids)
                             if a in masks and b in masks)

    for a, b in combinations(species_ids, 2):
        pairs = [overlap(x, y, masks, SPECIES_LIMIT) for x, y in product(species_ids[a], species_ids[b])]
        pairs.sort(key=lambda item: item["iou"], reverse=True)
        cross.append({"species": [a, b], "comparisons": len(pairs), "max": pairs[0], "failures": [
            pair for pair in pairs if not pair["pass"]
        ]})

    out.mkdir(parents=True, exist_ok=True)
    for species, ids in species_ids.items():
        sheet = Image.new("RGB", (240, 24 + (len(FAMILIES) + 1) * 45), "#1D242C")
        draw = ImageDraw.Draw(sheet)
        for tier in range(4):
            draw.text((65 + 44 * tier, 6), f"T{tier + 1}", fill="#B8C0C8")
        for row, family in enumerate((*FAMILIES, "boss")):
            draw.text((5, 32 + row * 45), family, fill="#B8C0C8")
        for actor in ids:
            family, tier = actor.removeprefix(species + "-").rsplit("-t", 1)
            row, col = (*FAMILIES, "boss").index(family), int(tier) - 1
            y = 23 + row * 45
            x = 59 + col * 44
            draw.rectangle((x, y, x + 35, y + 35), fill=BACKGROUNDS["path"], outline="#12161B")
            sheet.paste(outlined_icons[actor], (x + 1, y + 1), outlined_icons[actor])
        sheet.save(out / f"{species}-32px.webp", lossless=True)
    failures = sum(not pair["pass"] for pair in evolution) + sum(len(group["failures"]) for group in cross)
    boss_failures = sum(not pair["pass"] for pairs in boss_pairs.values() for pair in pairs)
    transform = ImageCms.buildTransform(ImageCms.createProfile("sRGB"), ImageCms.createProfile("LAB"), "RGB", "LAB")
    labs = {actor: [(light * 100 / 255, a, b) for light, a, b in
                    ImageCms.applyTransform(path_composite(icon), transform).get_flattened_data()]
            for actor, icon in icons.items()}
    color_groups = {"A": [], "B": []}
    for group in cross:
        for pair in group["failures"]:
            delta = color_distance(pair, labs, masks)
            color_groups["A" if delta >= COLOR_LIMIT else "B"].append({
                "first": pair["first"], "second": pair["second"], "iou": pair["iou"], "deltaE": delta,
            })
    color_groups["B"].sort(key=lambda pair: (-pair["iou"], pair["deltaE"], pair["first"], pair["second"]))
    write_color_board(out, {actor: path for entries in images.values() for actor, path in entries.items()},
                      icons, color_groups["B"][:20])
    write_json(out / "silhouettes.json", {
        "evolutionLimit": EVOLUTION_LIMIT, "speciesLimit": SPECIES_LIMIT, "evolution": evolution,
        "crossSpecies": cross, "failures": failures,
        "bossLimit": BOSS_LIMIT, "bossVsRegular": boss_pairs, "bossPairFailures": boss_failures,
        "contrastLimit": CONTRAST_LIMIT, "contrastBackgrounds": BACKGROUNDS,
        "groundContrast": contrast, "groundContrastRaw": raw_contrast,
        "outlineSpec": {"color": OUTLINE_HEX, "widthPx": 1, "effectiveAlpha": OUTLINE_EFFECTIVE_ALPHA, "neighbors": 8},
        "interiorColorDeltaE": {
            "limit": INTERIOR_DELTA_E_LIMIT,
            "max": round(max(interior_delta_e.values(), default=0.0), 3),
            "actors": interior_delta_e,
        },
        "crossSpeciesColor": {"size": SIZE, "background": BACKGROUNDS["path"], "deltaELimit": COLOR_LIMIT,
                              "method": "mean-CIE76-on-shared-alpha128", **color_groups},
    })
    print(f"32px 실루엣 · 단계 {len(evolution)}쌍 · 종족 간 {sum(g['comparisons'] for g in cross)}쌍 · 기준 초과 {failures}쌍")
    print(f"32px 보스와 일반 · {sum(map(len, boss_pairs.values()))}쌍 · 재검수 {boss_failures}쌍")
    print(f"32px 종족 간 색 판독 · A {len(color_groups['A'])}쌍 · B {len(color_groups['B'])}쌍")
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    parser.add_argument("packs", nargs="+", type=Path)
    parser.add_argument("--report-only", action="store_true", help="반려가 있어도 보고서를 남기고 정상 종료한다.")
    args = parser.parse_args()
    raise SystemExit(bool(review(args.packs, args.out)) and not args.report_only)
