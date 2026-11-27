"""타워 6종 66형태의 128×128 @2x 타이트 크롭 전용 초상화 아틀라스(512×384 WebP)를 생성한다."""

import json
import math
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
R6_DIR = ROOT / "public/assets/r6"
TOWERS = ("rail", "mortar", "cryo", "prism", "hangar", "bastion")
CELL = 128
COLS = 4
ROWS = 3
TARGET_SPAN = 110  # 128px 중 85.9% 점유


def head_direction(dx: float, dy: float, projection: dict) -> int:
    bearing = math.atan2(dx, -dy / projection["squashY"])
    zero = projection["zeroBearingDeg"] * math.pi / 180.0
    return (round((zero - bearing) * 8.0 / math.pi) % 16 + 16) % 16


def slice_frame(sheet_img: Image.Image, w: int, h: int, frame: int) -> Image.Image:
    cols = max(1, sheet_img.width // w)
    cx, cy = (frame % cols) * w, (frame // cols) * h
    return sheet_img.crop((cx, cy, cx + w, cy + h))


def encode_webp(img: Image.Image, out_path: Path) -> None:
    tmp = out_path.with_suffix(".tmp.png")
    img.save(tmp, "PNG")
    try:
        subprocess.run(
            ["cwebp", "-quiet", "-q", "94", "-alpha_q", "100", "-sharp_yuv", "-m", "6", str(tmp), "-o", str(out_path)],
            check=True,
        )
    finally:
        tmp.unlink(missing_ok=True)


def build():
    manifest = json.loads((R6_DIR / "manifest-v2.json").read_text())
    projection = manifest["projection"]
    front_dir = head_direction(0, -1, projection)

    for tid in TOWERS:
        forms = manifest["towers"].get(tid)
        sheets = dict(manifest["sheets"])
        if not forms:
            pack = json.loads((R6_DIR / "towers" / tid / "pack.json").read_text())
            forms = pack["forms"]
            sheets.update(pack["sheets"])

        atlas = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
        opened: dict[str, Image.Image] = {}

        def get_img(path_rel: str) -> Image.Image:
            if path_rel not in opened:
                opened[path_rel] = Image.open(R6_DIR / path_rel).convert("RGBA")
            return opened[path_rel]

        min_fill = 1.0
        for idx, form in enumerate(forms):
            b_spec = sheets[form["body"]]
            h_spec = sheets[form["head"]]
            scale_b = 2 if "file2x" in b_spec else 1
            scale_h = 2 if "file2x" in h_spec else 1
            b_img = get_img(b_spec.get("file2x", b_spec["file"]))
            h_img = get_img(h_spec.get("file2x", h_spec["file"]))

            bw, bh = b_spec["width"] * scale_b, b_spec["height"] * scale_b
            hw, hh = h_spec["width"] * scale_h, h_spec["height"] * scale_h
            b_cell = slice_frame(b_img, bw, bh, form["bodyFrame"])
            h_cell = slice_frame(h_img, hw, hh, front_dir)

            # head를 body 좌표에 mount - headPivot 위치에 합성
            mx, my = form["mount"][0] * scale_b, form["mount"][1] * scale_b
            hx, hy = h_spec["pivot"][0] * scale_h, h_spec["pivot"][1] * scale_h
            ox = round(mx - hx)
            oy = round(my - hy)

            left = min(0, ox)
            top = min(0, oy)
            right = max(bw, ox + hw)
            bottom = max(bh, oy + hh)
            comp = Image.new("RGBA", (right - left, bottom - top), (0, 0, 0, 0))
            comp.paste(b_cell, (-left, -top), b_cell)
            comp.paste(h_cell, (ox - left, oy - top), h_cell)

            # 알파 >= 110 기준 타이트 크롭 (+2px 여유)
            alpha = comp.getchannel("A").point(lambda a: 255 if a >= 110 else 0)
            bbox = alpha.getbbox() or comp.getbbox()
            if not bbox:
                raise ValueError(f"{tid} 형태 {idx}가 비어 있습니다.")
            bx0 = max(0, bbox[0] - 2)
            by0 = max(0, bbox[1] - 2)
            bx1 = min(comp.width, bbox[2] + 2)
            by1 = min(comp.height, bbox[3] + 2)
            tight = comp.crop((bx0, by0, bx1, by1))

            tw, th = tight.size
            k = TARGET_SPAN / max(tw, th)
            nw, nh = max(1, round(tw * k)), max(1, round(th * k))
            resized = tight.resize((nw, nh), Image.Resampling.LANCZOS)

            min_fill = min(min_fill, max(nw, nh) / CELL)
            col, row = idx % COLS, idx // COLS
            px = col * CELL + (CELL - nw) // 2
            # 하단 안정감 확보: 수직 하단 바이어스 +2px
            py = row * CELL + min(CELL - nh, (CELL - nh) // 2 + 2)
            atlas.paste(resized, (px, py), resized)

        for img in opened.values():
            img.close()
        out_path = R6_DIR / "towers" / tid / f"{tid}-portraits.webp"
        encode_webp(atlas, out_path)
        kb = out_path.stat().st_size / 1024
        print(f"[portraits] {tid:8s}: 512x384 ({kb:.1f} KiB), minFill={min_fill*100:.1f}%")


if __name__ == "__main__":
    build()
