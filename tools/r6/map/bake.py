"""garden_u 계약 좌표와 높이 샘플로 초원 고원 WebP를 굽는다."""

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageColor

ROOT = Path(__file__).resolve().parents[3]
CARBON, SLATE, LINE, SILVER, AMBER, TEAL = map(
    ImageColor.getrgb, ("#12161B", "#1D242C", "#4A5563", "#B8C0C8", "#E69F24", "#2FB5A3")
)
CELL = 64
STEP = 16
CONTOUR_INTERVAL = 12
MAX_BYTES = 150_000


def blend(a, b, fraction):
    return tuple(round(x + (y - x) * fraction) for x, y in zip(a, b))


def heights(width, height):
    """좌상단 원점에서 오른쪽·아래로 16px마다 잰 가상 높이(m)."""
    ridges = [(0.21, 0.18, 0.24, 0.33, 55), (0.79, 0.41, 0.17, 0.42, 68),
              (0.43, 0.89, 0.32, 0.26, 48), (0.48, 0.43, 0.24, 0.23, -23)]
    return [[round(30 + sum(
        rise * math.exp(-((x / width - cx) / rx) ** 2 - ((y / height - cy) / ry) ** 2)
        for cx, cy, rx, ry, rise in ridges
    )) for x in range(0, width + 1, STEP)] for y in range(0, height + 1, STEP)]


def terrain(image, height_grid):
    samples = Image.new("L", (len(height_grid[0]), len(height_grid)))
    samples.putdata([value for row in height_grid for value in row])
    width, height = image.size
    values = samples.resize(image.size, Image.Resampling.BILINEAR)
    # 북서 방향으로 두 샘플의 명암 차를 비교하고, 고도 단을 약하게 칠한다.
    source = values.load()
    image.putdata([
        blend(SLATE, LINE, max(0.01, min(0.28, 0.035 + (z // 12) * 0.02 + slope * 0.007)))
        for y in range(height) for x in range(width)
        for z in (source[x, y],)
        for slope in (z - source[min(x + STEP, width - 1), min(y + STEP, height - 1)],)
    ])
    draw = ImageDraw.Draw(image)
    for y, (upper, lower) in enumerate(zip(height_grid, height_grid[1:])):
        for x in range(len(upper) - 1):
            a = (x * STEP, y * STEP, upper[x])
            b = ((x + 1) * STEP, y * STEP, upper[x + 1])
            c = ((x + 1) * STEP, (y + 1) * STEP, lower[x + 1])
            d = (x * STEP, (y + 1) * STEP, lower[x])
            for triangle in ((a, b, c), (a, c, d)):
                z_min, z_max = min(p[2] for p in triangle), max(p[2] for p in triangle)
                first = (z_min // CONTOUR_INTERVAL + 1) * CONTOUR_INTERVAL
                for level in range(first, z_max + 1, CONTOUR_INTERVAL):
                    points = []
                    for (px, py, pz), (qx, qy, qz) in zip(triangle, (*triangle[1:], triangle[0])):
                        if min(pz, qz) < level <= max(pz, qz):
                            t = (level - pz) / (qz - pz)
                            points.append((round(px + (qx - px) * t), round(py + (qy - py) * t)))
                    color = blend(SLATE, LINE, 0.65 if level % 24 == 0 else 0.42)
                    draw.line(points, fill=color, width=1)
    for x in range(CELL, width, CELL):
        for y in range(CELL, height, CELL):
            color = blend(SLATE, LINE, 0.62)
            draw.line((x - 3, y, x + 3, y), fill=color)
            draw.line((x, y - 3, x, y + 3), fill=color)


def center(cell):
    return tuple(c * CELL + CELL // 2 for c in cell)


def path(draw, map_config, width):
    points = [(0, center(map_config["entryCell"])[1]), *map(center, map_config["waypoints"]),
              (width, center(map_config["exitCell"])[1])]
    for thickness, color in ((47, CARBON), (43, blend(SLATE, LINE, 0.84)),
                             (39, SLATE), (34, blend(CARBON, SLATE, 0.42))):
        draw.line(points, fill=color, width=thickness, joint="curve")
    # 직선 구간에만 돌턱 이음매를 넣어 모퉁이가 깨끗하게 이어지게 한다.
    seam = blend(SLATE, LINE, 0.52)
    for (x, y), (nx, ny) in zip(points, points[1:]):
        if y == ny:
            for sx in range(min(x, nx) + 25, max(x, nx) - 20, 18):
                for side in (-1, 1):
                    draw.line((sx, y + side * 20, sx, y + side * 23), fill=seam)
        else:
            for sy in range(min(y, ny) + 25, max(y, ny) - 20, 18):
                for side in (-1, 1):
                    draw.line((x + side * 20, sy, x + side * 23, sy), fill=seam)


def chamfer(draw, x, y, w, h, cut, color, outline):
    left, right, top, bottom = x - w, x + w, y - h, y + h
    draw.polygon([(left + cut, top), (right - cut, top), (right, top + cut), (right, bottom - cut),
                  (right - cut, bottom), (left + cut, bottom), (left, bottom - cut), (left, top + cut)],
                 fill=color, outline=outline, width=2)


def pads(draw, slots):
    for slot in slots:
        x, y = center((slot["x"], slot["y"]))
        chamfer(draw, x, y + 3, 23, 20, 7, CARBON, SLATE)
        chamfer(draw, x, y, 23, 20, 7, SLATE, LINE)
        draw.line((x - 5, y, x + 5, y), fill=LINE)
        draw.line((x, y - 5, x, y + 5), fill=LINE)
        draw.line((x - 12, y + 16, x + 12, y + 16), fill=blend(LINE, SILVER, 0.26))


def props(draw, map_config):
    # 각 무리의 중심은 가장자리 여유 칸에만 둔다. 길·설치 칸은 같은 계약 좌표를 검사한다.
    blocked = {tuple(p) for p in map_config["pathCells"]} | {(s["x"], s["y"]) for s in map_config["slots"]}
    for cell in ((1, 0), (13, 0), (0, 6), (4, 8), (8, 8), (14, 5)):
        if cell in blocked:
            raise ValueError(f"소품 무리가 길 또는 설치 칸에 있습니다. {cell}")
        x, y = center(cell)
        for dx, dy, size in ((-13, 6, 11), (0, 1, 15), (14, 9, 8)):
            px, py = x + dx, y + dy
            draw.polygon([(px - size, py + 5), (px - size // 2, py - size),
                          (px + size // 3, py - size - 3), (px + size, py + 3),
                          (px + size // 2, py + 8), (px - 5, py + 9)], fill=LINE, outline=CARBON)
            draw.polygon([(px - size // 2, py - size), (px + size // 3, py - size - 3),
                          (px + size // 4, py), (px - size, py + 5)], fill=blend(LINE, SILVER, 0.22))

    x, y = center(map_config["entryCell"])
    for dy in (-24, 24):
        chamfer(draw, x - 11, y + dy, 14, 7, 4, CARBON, LINE)
        draw.line((x - 19, y + dy, x - 3, y + dy), fill=AMBER, width=3)
    for dx in (-16, -5, 6):
        draw.line([(x + dx - 4, y - 6), (x + dx + 2, y), (x + dx - 4, y + 6)], fill=AMBER, width=2)

    x, y = center(map_config["exitCell"])
    for dy in (-23, 23):
        chamfer(draw, x, y + dy, 17, 11, 6, LINE, CARBON)
        draw.line((x - 10, y + dy - 6, x + 10, y + dy - 6), fill=TEAL, width=2)
    draw.rectangle((x - 13, y - 13, x + 14, y - 7), fill=LINE, outline=CARBON)
    draw.line((x + 14, y - 12, x + 14, y + 12), fill=TEAL, width=2)
    for dx in (-29, -20):
        draw.line([(x + dx - 3, y - 5), (x + dx + 2, y), (x + dx - 3, y + 5)], fill=TEAL, width=2)


def bake(out):
    maps = json.loads((ROOT / "docs/contracts/maps.candidate.v0.4.json").read_text())["maps"]
    garden = next(m for m in maps if m["id"] == "garden_u")
    width, height = (garden[key] * CELL for key in ("gridWidth", "gridHeight"))
    image = Image.new("RGB", (width, height))
    terrain(image, heights(width, height))
    draw = ImageDraw.Draw(image)
    path(draw, garden, width)
    pads(draw, garden["slots"])
    props(draw, garden)
    # 메모리에서 용량을 검사하고 통과한 결과만 파일에 쓴다.
    from io import BytesIO
    encoded = BytesIO()
    image.save(encoded, format="WEBP", lossless=True, method=6)
    if encoded.tell() > MAX_BYTES:
        raise ValueError(f"배경 WebP 용량 초과 · {encoded.tell():,}B > {MAX_BYTES:,}B")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(encoded.getvalue())
    print(f"초원 고원 · {width}×{height} · 길 {len(garden['pathCells'])}칸 · 설치 {len(garden['slots'])}칸 · {encoded.tell():,}B")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "public/assets/r6/meadow-plateau.webp")
    bake(parser.parse_args().out)
