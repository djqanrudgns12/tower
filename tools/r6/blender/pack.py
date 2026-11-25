"""Blender 그리드를 외곽선이 있는 WebP 시트와 검수용 비교판으로 묶는다."""

import argparse
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFilter


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "qa"))
from check import ALLOWED_COLORS, R04, manifest_errors, palette_violations, read_image


@lru_cache(maxsize=32768)
def snap_color(rgb):
    return min(ALLOWED_COLORS, key=lambda color: sum((a - b) ** 2 for a, b in zip(rgb, color)))


def finish_cell(cell, outline_px=1):
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds or min(bounds[:2]) <= outline_px or max(bounds[2:]) >= cell.width - outline_px:
        raise ValueError("비어 있거나, 외곽선을 그릴 여백이 없는 칸이 있습니다.")
    outline = Image.new("RGBA", cell.size, R04[0])
    outline.putalpha(alpha.filter(ImageFilter.MaxFilter(2 * outline_px + 1)))
    finished = Image.alpha_composite(outline, cell)
    # 면과 외곽선을 합성하면서 생긴 중간색을 팔레트에 맞추고 알파는 유지한다.
    colors = {rgba: (*snap_color(rgba[:3]), rgba[3])
              for _, rgba in finished.getcolors(cell.width * cell.height)}
    finished.putdata([colors[rgba] for rgba in finished.get_flattened_data()])
    return finished


def pack_grid(cells, columns):
    size = cells[0].width
    sheet = Image.new("RGBA", (columns * size, math.ceil(len(cells) / columns) * size))
    for index, cell in enumerate(cells):
        sheet.paste(cell, (index % columns * size, index // columns * size))
    return sheet


def pack(out):
    layout = json.loads((out / "layout.json").read_text())
    source = read_image(out / "tower-grid.png")
    size, directions = layout["tile"], layout["directions"]
    levels = layout["levels"]
    if source.size != (len(levels) * size, (directions + 2) * size):
        raise ValueError("Blender 시트 크기와 레이아웃이 다릅니다.")

    def cell(column, row):
        x, y = column * size, row * size
        return finish_cell(source.crop((x, y, x + size, y + size)))

    assets = []

    def save(name, cells, columns, pivot):
        sheet = pack_grid(cells, columns)
        filename = f"{name}.webp"
        path = out / filename
        # 작은 제한 팔레트와 투명 라인의 색을 고정한다.
        sheet.save(path, lossless=True, method=6)
        if palette_violations(read_image(path)):
            raise ValueError(f"{name}의 WebP에 팔레트 위반이 있습니다.")
        assets.append({
            "id": name, "file": filename, "width": sheet.width, "height": sheet.height,
            "artifactHash": hashlib.sha256(path.read_bytes()).hexdigest(),
            "sprite": {"frameWidth": size, "frameHeight": size, "frameCount": len(cells), "pivot": pivot},
        })

    bodies = [cell(i, 0) for i in range(len(levels))]
    save("rail-bodies", bodies, len(levels), layout["bodyPivot"])
    last_heads = []
    forms = []
    for i, (level, body) in enumerate(zip(levels, bodies)):
        heads = [cell(i, direction + 1) for direction in range(directions)]
        save(f"rail-lv{level}-heads", heads, 4, layout["headPivot"])
        forms.append(Image.alpha_composite(body, heads[2]))
        last_heads = heads
    attacks = [cell(i, directions + 1) for i in range(layout["attack"]["frames"])]
    save("rail-lv20-attack", attacks, len(attacks), layout["headPivot"])
    if len({form.tobytes() for form in forms}) != len(levels):
        raise ValueError("같은 이미지로 렌더된 진화 단계가 있습니다.")

    manifest = {"assets": assets}
    errors = manifest_errors(manifest, out)
    if errors:
        raise ValueError("\n".join(errors))
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    board = Image.new("RGBA", (size * len(levels), size * 4), R04[1])
    draw = ImageDraw.Draw(board)
    rows = [
        (forms, [f"Lv{level}" for level in levels]),
        ([Image.alpha_composite(bodies[-1], head) for head in last_heads[:8]], [f"{i * 22.5:g}°" for i in range(8)]),
        ([Image.alpha_composite(bodies[-1], head) for head in last_heads[8:]], [f"{i * 22.5:g}°" for i in range(8, 16)]),
        ([Image.alpha_composite(bodies[-1], head) for head in attacks], [str(i + 1) for i in range(len(attacks))]),
    ]
    for y, (cells, labels) in enumerate(rows):
        for x, (sprite, label) in enumerate(zip(cells, labels)):
            board.alpha_composite(sprite, (x * size, y * size))
            draw.text((x * size + size // 2, (y + 1) * size - 2), label, fill=R04[3], anchor="ms")
    board.save(out / "tower-review.webp", lossless=True, method=6)
    print(json.dumps({
        "assets": len(assets), "forms": len(forms), "bytes": sum((out / a["file"]).stat().st_size for a in assets),
        "headSheets": sum((out / a["file"]).stat().st_size for a in assets if a["id"].endswith("-heads")),
        "attackDistinctFrames": len({frame.tobytes() for frame in attacks}),
    }, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Blender 출력 폴더")
    parser.add_argument("--out", type=Path, help="WebP 출력 폴더")
    parser.add_argument("--reference", type=Path, help="타워 바이블 원화")
    parser.add_argument("--font", type=Path, help="비교판의 한글 글꼴")
    args = parser.parse_args()
    if args.out and args.reference:
        from mortar_pack import DEFAULT_FONT, pack_mortar

        layout = json.loads((args.source / "layout.json").read_text())
        pack_assets = pack_mortar
        if layout["towerId"] in ("rail", "cryo", "prism", "hangar", "bastion"):
            from tower_pack import pack_tower

            pack_assets = pack_tower
        pack_assets(args.source.resolve(), args.out.resolve(), args.reference.resolve(), args.font or DEFAULT_FONT)
    elif args.out or args.reference or args.font:
        parser.error("비교판 패킹에는 --out과 --reference가 모두 필요합니다.")
    else:
        pack(args.source.resolve())
