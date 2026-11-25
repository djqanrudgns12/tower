"""32px 판독 띠와 단계·종족 사이 실루엣 겹침을 계산한다."""

import argparse
from itertools import combinations, pairwise, product
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

from monsters import FAMILIES, read_json
from pilot import write_json


SIZE = 32
EVOLUTION_LIMIT = .92
SPECIES_LIMIT = .55


def thumbnail(image):
    crop = image.crop(image.getbbox())
    crop = ImageOps.contain(crop, (SIZE, SIZE), Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", (SIZE, SIZE))
    icon.paste(crop, ((SIZE - crop.width) // 2, SIZE - crop.height))
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


def review(packs, out):
    masks, icons, species_ids, evolution, cross = {}, {}, {}, [], []
    for pack in packs:
        spec = read_json(pack / "manifest-fragment.json")["species"]
        species, = spec
        if species in species_ids:
            raise ValueError(f"동일 종족을 두 번 지정했습니다 · {species}")
        ids = tuple(spec[species]["entities"])
        species_ids[species] = ids
        for actor in ids:
            with Image.open(pack / "silhouettes" / f"{actor}.png") as image:
                icons[actor] = thumbnail(image.convert("RGBA"))
            masks[actor] = silhouette(icons[actor])
            if not masks[actor].getbbox():
                raise ValueError(f"{actor} · 32px 실루엣에 보이는 화소가 없습니다.")
        for family in (*FAMILIES, "boss"):
            family_ids = [f"{species}-{family}-t{tier}" for tier in range(1, 5)]
            evolution.extend(overlap(a, b, masks, EVOLUTION_LIMIT) for a, b in pairwise(family_ids))

    for a, b in combinations(species_ids, 2):
        pairs = [overlap(x, y, masks, SPECIES_LIMIT) for x, y in product(species_ids[a], species_ids[b])]
        pairs.sort(key=lambda item: item["iou"], reverse=True)
        cross.append({"species": [a, b], "comparisons": len(pairs), "max": pairs[0], "failures": [
            pair for pair in pairs if not pair["pass"]
        ]})

    out.mkdir(parents=True, exist_ok=True)
    for species, ids in species_ids.items():
        sheet = Image.new("RGB", (240, 24 + len(ids) // 4 * 45), "#1D242C")
        draw = ImageDraw.Draw(sheet)
        for tier in range(4):
            draw.text((65 + 44 * tier, 6), f"T{tier + 1}", fill="#B8C0C8")
        for index, actor in enumerate(ids):
            row, col = divmod(index, 4)
            y = 23 + row * 45
            if col == 0:
                draw.text((5, y + 9), (*FAMILIES, "boss")[row], fill="#B8C0C8")
            x = 59 + col * 44
            draw.rectangle((x, y, x + 35, y + 35), fill="#12161B", outline="#4A5563")
            sheet.paste(icons[actor], (x + 2, y + 2), icons[actor])
        sheet.save(out / f"{species}-32px.webp", lossless=True)
    failures = sum(not pair["pass"] for pair in evolution) + sum(len(group["failures"]) for group in cross)
    write_json(out / "silhouettes.json", {
        "evolutionLimit": EVOLUTION_LIMIT, "speciesLimit": SPECIES_LIMIT, "evolution": evolution,
        "crossSpecies": cross, "failures": failures,
    })
    print(f"32px 실루엣 · 단계 {len(evolution)}쌍 · 종족 간 {sum(g['comparisons'] for g in cross)}쌍 · 기준 초과 {failures}쌍")
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    parser.add_argument("packs", nargs="+", type=Path)
    parser.add_argument("--report-only", action="store_true", help="반려가 있어도 보고서를 남기고 정상 종료한다.")
    args = parser.parse_args()
    raise SystemExit(bool(review(args.packs, args.out)) and not args.report_only)
