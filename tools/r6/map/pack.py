"""Blender R6 V2 다층 지형·설치대·성문 2패스·공용 아우라 시트를 제품 WebP 및 메타데이터로 패킹한다."""

import argparse
import json
import math
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SPEC = json.loads((ROOT / "src/game/r6/mapProjection.json").read_text())
MAX_BYTES = 150_000
VRAM_BUDGET_BYTES = 12 * 1024 * 1024  # 12 MiB
NORM_SIZE = (1492, 934)
HIGH_SIZE = (2090, 1308)


def encode_cwebp(img: Image.Image, out_path: Path, quality: int = 92, lossless: bool = False) -> int:
    tmp_png = out_path.with_suffix(".tmp.png")
    img.save(tmp_png, "PNG")
    cmd = ["cwebp", "-quiet", "-m", "6"]
    if lossless:
        cmd += ["-lossless", "-z", "9"]
    else:
        cmd += ["-q", str(quality), "-sharp_yuv", "-alpha_q", "100"]
    cmd += [str(tmp_png), "-o", str(out_path)]
    try:
        subprocess.run(cmd, check=True)
    finally:
        tmp_png.unlink(missing_ok=True)
    return out_path.stat().st_size


def pack_gate_layer(src_path: Path, out_path: Path) -> dict:
    with Image.open(src_path).convert("RGBA") as full:
        assert full.size == HIGH_SIZE, f"{src_path.name}: 예상 {HIGH_SIZE}, 실제 {full.size}"
        bbox = full.getbbox()
        if not bbox:
            raise ValueError(f"{src_path.name}: 성문 알파가 비어 있습니다.")
        x0, y0, x1, y1 = bbox
        # 2px 여유 포함 크롭 후 512×256 이하 POT 캔버스에 정렬 저장해 무손실 밉맵 지원
        x0 = max(0, x0 - 2)
        y0 = max(0, y0 - 2)
        x1 = min(full.width, x1 + 2)
        y1 = min(full.height, y1 + 2)
        cropped = full.crop((x0, y0, x1, y1))
        cw, ch = cropped.size
        pot_w = 1 << math.ceil(math.log2(max(1, cw)))
        pot_h = 1 << math.ceil(math.log2(max(1, ch)))
        sheet = Image.new("RGBA", (pot_w, pot_h), (0, 0, 0, 0))
        sheet.paste(cropped, (0, 0))
        encode_cwebp(sheet, out_path, lossless=True)

        ov = SPEC["overview"]
        world_x = ov["x"] + (x0 / full.width) * ov["width"]
        world_y = ov["y"] + (y0 / full.height) * ov["height"]
        disp_w = (pot_w / full.width) * ov["width"]
        disp_h = (pot_h / full.height) * ov["height"]
        return {
            "file": out_path.name,
            "potSize": [pot_w, pot_h],
            "contentSize": [cw, ch],
            "worldX": round(world_x, 3),
            "worldY": round(world_y, 3),
            "displayW": round(disp_w, 3),
            "displayH": round(disp_h, 3),
            "bytes": out_path.stat().st_size,
            "vramBytes": pot_w * pot_h * 4,
        }


def build_wave_aura(out_path: Path) -> dict:
    # 256×256 POT 시트 (2×2 각 128×128: [0] 햇살 보케, [1] 빛가루/꽃잎, [2] 별빛 글린트, [3] 황혼 불티)
    sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))

    # [0] 부드러운 원형 글로우
    c0 = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d0 = ImageDraw.Draw(c0)
    d0.ellipse((24, 24, 104, 104), fill=(255, 255, 255, 210))
    c0 = c0.filter(ImageFilter.GaussianBlur(14))
    sheet.paste(c0, (0, 0))

    # [1] 대각선 바람결/꽃잎 조각
    c1 = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d1 = ImageDraw.Draw(c1)
    d1.polygon([(36, 78), (64, 34), (92, 52), (62, 92)], fill=(255, 255, 255, 225))
    c1 = c1.filter(ImageFilter.GaussianBlur(3))
    sheet.paste(c1, (128, 0))

    # [2] 4각 별빛 글린트
    c2 = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(c2)
    d2.polygon([(64, 14), (74, 54), (114, 64), (74, 74), (64, 114), (54, 74), (14, 64), (54, 54)], fill=(255, 255, 255, 240))
    c2 = c2.filter(ImageFilter.GaussianBlur(2.5))
    sheet.paste(c2, (0, 128))

    # [3] 포털 에너지 링
    c3 = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d3 = ImageDraw.Draw(c3)
    d3.ellipse((18, 18, 110, 110), outline=(255, 255, 255, 230), width=10)
    c3 = c3.filter(ImageFilter.GaussianBlur(3.5))
    sheet.paste(c3, (128, 128))

    size = encode_cwebp(sheet, out_path, quality=92)
    return {"file": out_path.name, "size": [256, 256], "bytes": size, "vramBytes": 256 * 256 * 4}


def pack(source: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)

    # 1) 기존 홈 미리보기 + fallback 겸용 960×576 (test_pack.py ≤ 150,000B 검사 포함)
    with Image.open(source / "meadow-plateau.png") as background:
        assert background.size == (960, 576), f"meadow-plateau.png 크기 불일치: {background.size}"
        rgb = background.convert("RGB")
        for q in (90, 86, 82):
            encoded = BytesIO()
            rgb.save(encoded, "WEBP", quality=q, method=6)
            if encoded.tell() <= MAX_BYTES:
                break
        if encoded.tell() > MAX_BYTES:
            raise ValueError(f"배경 예산 {MAX_BYTES}B 초과 · {encoded.tell()}B")
        (out / "meadow-plateau.webp").write_bytes(encoded.getvalue())

    # 2) 설치대 1× (64×48×2) + 2× (128×96×2) 무손실 패킹
    pad_meta = {}
    for suffix, key_name in (("", "meadow-pads.webp"), ("-2x", "meadow-pads-2x.webp")):
        with Image.open(source / f"pad{suffix}.png") as idle, Image.open(source / f"pad-selected{suffix}.png") as selected:
            if idle.size != selected.size:
                raise ValueError(f"두 설치대{suffix} 프레임 크기가 다릅니다.")
            sheet = Image.new("RGBA", (idle.width * 2, idle.height))
            sheet.paste(idle, (0, 0))
            sheet.paste(selected, (idle.width, 0))
            encode_cwebp(sheet, out / key_name, lossless=True)
            pad_meta[key_name] = {
                "size": [sheet.width, sheet.height],
                "vramBytes": sheet.width * sheet.height * 4,
            }

    # 3) 4대 학년 바이옴 × 주간/다크 2× (2090×1308) + 1× (1492×934)
    terrain_meta = {}
    for biome in ("meadow", "river", "ochre", "snow"):
        for theme in ("day", "dark"):
            high_src = source / f"{biome}-{theme}-2x.png"
            with Image.open(high_src).convert("RGB") as high_img:
                assert high_img.size == HIGH_SIZE, f"{high_src.name} 크기 불일치: {high_img.size}"
                f2x = f"{biome}-{theme}-2x.webp"
                b2x = encode_cwebp(high_img, out / f2x, quality=92)
                low_img = high_img.resize(NORM_SIZE, Image.Resampling.LANCZOS)
                f1x = f"{biome}-{theme}-1x.webp"
                b1x = encode_cwebp(low_img, out / f1x, quality=90)
                terrain_meta[f"{biome}-{theme}"] = {
                    "1x": {"file": f1x, "size": list(NORM_SIZE), "bytes": b1x, "vramBytes": NORM_SIZE[0] * NORM_SIZE[1] * 4},
                    "2x": {"file": f2x, "size": list(HIGH_SIZE), "bytes": b2x, "vramBytes": HIGH_SIZE[0] * HIGH_SIZE[1] * 4},
                }

    # 4) 성문 앞/뒤 2패스 + 공용 아우라
    gate_back = pack_gate_layer(source / "gate-back-2x.png", out / "gate-back.webp")
    gate_front = pack_gate_layer(source / "gate-front-2x.png", out / "gate-front.webp")
    aura = build_wave_aura(out / "wave-aura.webp")

    # 5) 고밀도 활성 세트 VRAM ≤ 12 MiB 수학 검증
    high_vram = (
        HIGH_SIZE[0] * HIGH_SIZE[1] * 4
        + gate_back["vramBytes"]
        + gate_front["vramBytes"]
        + pad_meta["meadow-pads-2x.webp"]["vramBytes"]
        + aura["vramBytes"]
    )
    if high_vram > VRAM_BUDGET_BYTES:
        raise ValueError(f"고밀도 활성 VRAM {high_vram / (1024*1024):.2f} MiB > 상한 12.00 MiB")

    # gatePlaneY: 성문 중심 (14.62, 7.50)을 r6 투영한 발밑 Y
    rx, ry, rz = SPEC["cameraRay"]
    horiz = math.hypot(rx, ry)
    right_y = rx / horiz
    right_x = -ry / horiz
    squash = rz / math.hypot(horiz, rz)
    scale = SPEC["pixelsPerCell"] / 64.0
    wx, wy = 14.62 * 64.0 - 480.0, 7.50 * 64.0 - 288.0
    gate_plane_y = SPEC["center"][1] + scale * squash * (right_y * wx + right_x * wy)

    meta = {
        "version": 2,
        "overview": SPEC["overview"],
        "gatePlaneY": round(gate_plane_y, 2),
        "portalInteriorCells": [15.70, 7.50],
        "highVramMiB": round(high_vram / (1024 * 1024), 3),
        "gateBack": gate_back,
        "gateFront": gate_front,
        "aura": aura,
        "pads": pad_meta,
        "terrains": terrain_meta,
    }
    (out / "map-v2-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    print(f"[pack] 완료: highVRAM = {meta['highVramMiB']} MiB (<= 12 MiB), gateBack={gate_back['potSize']}, gateFront={gate_front['potSize']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, default=ROOT / "public/assets/r6/map")
    args = parser.parse_args()
    pack(args.source, args.out)
