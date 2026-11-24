"""garden_u 계약 좌표와 높이 샘플로 초원 고원 WebP를 굽는다."""

import argparse
import json
import math
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
CARBON, SLATE, LINE, SILVER, AMBER, TEAL = map(
    ImageColor.getrgb, ("#12161B", "#1D242C", "#4A5563", "#B8C0C8", "#E69F24", "#2FB5A3")
)
CELL = 64
STEP = 16
CONTOUR_INTERVAL = 8
INDEX_INTERVAL = 24
MAX_BYTES = 150_000
# 중심 칸과 바위 조각의 상대 좌표(x, y), 반폭, 높이, 좌우 방향.
EDGE_CLUSTERS = {
    (5, 0): [(-21, -9, 10, 7, -1), (-5, -11, 17, 12, -1), (12, -7, 12, 9, 1), (21, 1, 6, 4, 1)],
    (14, 5): [(14, -22, 10, 11, -1), (10, -3, 15, 17, 1), (23, 13, 8, 10, -1), (3, 21, 6, 5, 1)],
    (4, 8): [(-21, 9, 8, 5, -1), (-7, 13, 14, 8, 1), (9, 12, 16, 11, -1), (22, 20, 8, 5, -1)],
    (0, 6): [(-14, -19, 9, 7, 1), (-11, -2, 16, 14, -1), (-14, 16, 12, 10, 1), (3, 22, 6, 4, 1)],
}


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
        blend(CARBON, SLATE, max(0.14, min(1, 0.27 + (z // CONTOUR_INTERVAL) * 0.055 + slope * 0.035)))
        for y in range(height) for x in range(width)
        for z in (source[x, y],)
        for slope in (z - source[min(x + STEP, width - 1), min(y + STEP, height - 1)],)
    ])
    contours = Image.new("RGBA", (width * 2, height * 2))
    draw = ImageDraw.Draw(contours)
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
                            points.append((round(2 * (px + (qx - px) * t)), round(2 * (py + (qy - py) * t))))
                    index_line = level % INDEX_INTERVAL == 0
                    if index_line:
                        draw.line([(px, py + 3) for px, py in points], fill=CARBON, width=4)
                    color = blend(SLATE, LINE, 0.55 if index_line else 0.34)
                    draw.line(points, fill=color, width=3 if index_line else 2)
    layer = contours.resize(image.size, Image.Resampling.BOX)
    image.paste(layer, (0, 0), layer)
    draw = ImageDraw.Draw(image)
    for x in range(CELL, width, CELL):
        for y in range(CELL, height, CELL):
            color = blend(SLATE, LINE, 0.25)
            draw.line((x - 2, y, x + 2, y), fill=color)
            draw.line((x, y - 2, x, y + 2), fill=color)


def center(cell):
    return tuple(c * CELL + CELL // 2 for c in cell)


def rounded_route(points):
    """격자 모서리에서만 길 면을 둥글린다. 적 이동 좌표는 계약을 따른다."""
    route = [points[0]]
    for before, (x, y), after in zip(points, points[1:], points[2:]):
        if (before[0] == x == after[0]) or (before[1] == y == after[1]):
            continue
        radius = min(40, math.dist(before, (x, y)) / 2, math.dist(after, (x, y)) / 2)
        ax, ay = (max(-1, min(1, v)) for v in (before[0] - x, before[1] - y))
        bx, by = (max(-1, min(1, v)) for v in (after[0] - x, after[1] - y))
        for step in range(17):
            t = step / 16
            u = 1 - t
            route.append((round(x + radius * (ax * u * u + bx * t * t)),
                          round(y + radius * (ay * u * u + by * t * t))))
    return [*route, points[-1]]


def path(draw, map_config, width):
    points = [(0, center(map_config["entryCell"])[1]), *map(center, map_config["waypoints"]),
              (width, center(map_config["exitCell"])[1])]
    route = rounded_route(points)
    draw.line([(x, y + 4) for x, y in route], fill=CARBON, width=55, joint="curve")
    for thickness, color in (
        (55, CARBON),
        (51, blend(SLATE, LINE, 0.69)),
        (49, blend(SLATE, LINE, 0.92)),
        (45, blend(LINE, SILVER, 0.63)),
        (43, blend(LINE, SILVER, 0.17)),
        (37, blend(SLATE, LINE, 0.85)),
        (33, blend(LINE, SILVER, 0.10)),
    ):
        draw.line(route, fill=color, width=thickness, joint="curve")
    # 턱의 돌 이음매는 직선부만 표시하고 밝은 연속선은 남긴다.
    seam = blend(SLATE, LINE, 0.54)
    for (x, y), (nx, ny) in zip(points, points[1:]):
        if y == ny:
            for sx in range(min(x, nx) + 34, max(x, nx) - 32, 27):
                for side in (-1, 1):
                    draw.line((sx, y + side * 23, sx, y + side * 25), fill=seam)
        else:
            for sy in range(min(y, ny) + 34, max(y, ny) - 32, 27):
                for side in (-1, 1):
                    draw.line((x + side * 23, sy, x + side * 25, sy), fill=seam)


def chamfer(draw, x, y, w, h, cut, color, outline):
    left, right, top, bottom = x - w, x + w, y - h, y + h
    draw.polygon([(left + cut, top), (right - cut, top), (right, top + cut), (right, bottom - cut),
                  (right - cut, bottom), (left + cut, bottom), (left, bottom - cut), (left, top + cut)],
                 fill=color, outline=outline, width=2)


def pads(draw, slots):
    for slot in slots:
        x, y = center((slot["x"], slot["y"]))
        chamfer(draw, x, y + 2, 21, 18, 7, CARBON, CARBON)
        line = blend(SLATE, LINE, 0.27)
        chamfer(draw, x, y, 21, 18, 7, blend(CARBON, SLATE, 0.8), line)
        cross = blend(SLATE, LINE, 0.08)
        draw.line((x - 4, y, x + 4, y), fill=cross)
        draw.line((x, y - 4, x, y + 4), fill=cross)


def rock(draw, x, y, width, height, side):
    def points(vertices):
        return [(x + round(px * width * side), y + round(py * height)) for px, py in vertices]

    outline = [(-1, 0.5), (-0.64, -0.46), (-0.19, -1), (0.57, -0.87),
               (0.84, -0.34), (1, 0.55), (0.44, 0.87), (-0.57, 0.82)]
    draw.polygon([(px + 3, py + 3) for px, py in points(outline)], fill=CARBON)
    draw.polygon(points(outline), fill=blend(SLATE, LINE, 0.38), outline=CARBON)
    draw.polygon(points([(-0.64, -0.46), (-0.19, -1), (0.57, -0.87), (0.3, -0.31), (-0.34, 0.14)]),
                 fill=blend(SLATE, LINE, 0.84))
    draw.polygon(points([(-1, 0.5), (-0.64, -0.46), (-0.34, 0.14), (0.3, -0.31), (0.44, 0.45), (-0.57, 0.82)]),
                 fill=blend(SLATE, LINE, 0.58))
    draw.line(points([(-0.57, 0.55), (-0.1, 0.38), (0.48, -0.11), (0.84, -0.34)]), fill=blend(SLATE, LINE, 0.33))


def props(draw, map_config):
    blocked = {tuple(p) for p in map_config["pathCells"]} | {(s["x"], s["y"]) for s in map_config["slots"]}
    for cell, rocks in EDGE_CLUSTERS.items():
        x, y = cell
        edge = {x, map_config["gridWidth"] - 1 - x, y, map_config["gridHeight"] - 1 - y}
        if 0 not in edge or cell in blocked:
            raise ValueError(f"소품 무리는 길과 설치 칸을 비운 가장자리에 둡니다. {cell}")
        x, y = center(cell)
        for dx, dy, width, height, side in rocks:
            rock(draw, x + dx, y + dy, width, height, side)


def chevrons(draw, x, y, offsets, color):
    for dx in offsets:
        px = x + dx
        draw.polygon([(px - 4, y - 7), (px, y - 7), (px + 7, y), (px, y + 7),
                      (px - 4, y + 7), (px + 2, y)], fill=color)


def entry_marker(draw, cell):
    x, y = center(cell)
    for side in (-1, 1):
        py = y + side * 28
        chamfer(draw, x - 11, py + 3, 20, 10, 5, CARBON, CARBON)
        chamfer(draw, x - 11, py, 20, 9, 5, blend(SLATE, LINE, 0.74), CARBON)
        draw.line((x - 22, py - 4, x - 4, py - 4), fill=blend(LINE, SILVER, 0.32))
        draw.line((x - 19, py + 2, x - 7, py + 2), fill=AMBER, width=2)
    chevrons(draw, x, y, (-22, -9, 4), AMBER)


def gate(draw, cell):
    x, y = center(cell)

    def panel(vertices, color):
        draw.polygon([(x + dx, y + dy) for dx, dy in vertices], fill=color, outline=CARBON)

    # 바닥의 모따기 기단 위에 양쪽 장갑판을 올린다. 적이 지나는 가운데는 비운다.
    for side in (-1, 1):
        def face(vertices, color):
            panel([(dx, side * dy) for dx, dy in vertices], color)

        face([(-80, 24), (-69, 48), (-34, 48), (-27, 43), (22, 43), (30, 35), (30, 22), (-61, 22)], CARBON)
        face([(-77, 25), (-60, 45), (-36, 45), (-29, 40), (20, 40), (29, 34), (29, 22), (-62, 22)], SLATE)
        face([(-63, 30), (-53, 43), (-40, 43), (-34, 39), (12, 39), (20, 36), (18, 29)], LINE)
        face([(-58, 29), (-50, 40), (7, 40), (14, 34), (12, 26)], blend(LINE, SILVER, 0.12))
        face([(5, 18), (25, 18), (29, 25), (29, 36), (20, 43), (9, 38), (5, 30)], blend(SLATE, LINE, 0.66))
        face([(6, 18), (22, 18), (26, 23), (26, 32), (20, 36), (9, 32), (6, 26)], LINE)
        for dx in (-44, -36, -28, -20):
            draw.line((x + dx, y + side * 33, x + dx + 3, y + side * 38), fill=CARBON, width=2)
        draw.line((x + 9, y + side * 20, x + 22, y + side * 20), fill=TEAL, width=2)
        draw.line((x - 60, y + side * 25, x - 6, y + side * 25), fill=blend(LINE, SILVER, 0.36))

    # 통과면의 이음매와 틸 표시는 적 뒤로 지나간다.
    draw.rectangle((x + 12, y - 17, x + 26, y + 17), fill=blend(SLATE, LINE, 0.81), outline=CARBON)
    for py in range(y - 12, y + 13, 6):
        draw.line((x + 16, py, x + 22, py), fill=LINE)
    chevrons(draw, x, y, (-37, -24, -11), TEAL)


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
    entry_marker(draw, garden["entryCell"])
    gate(draw, garden["exitCell"])
    # 메모리에서 용량을 검사하고 통과한 결과만 파일에 쓴다.
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
