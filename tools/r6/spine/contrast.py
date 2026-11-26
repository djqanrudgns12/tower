"""R6 몬스터 실루엣 바깥 1px 은회 테두리와 내부 색 보존(CIELAB ΔE76)을 계산한다."""

import numpy as np
from PIL import Image

# R04 은회(#B8C0C8): 8방향 뒤쪽 패스(패스당 불투명도 0.25) 3중첩 시 실효 불투명도 약 0.58.
OUTLINE_RGB = (184, 192, 200)
OUTLINE_HEX = "#B8C0C8"
OUTLINE_PASS_ALPHA = 0.25
OUTLINE_EFFECTIVE_ALPHA = 0.58
INTERIOR_DELTA_E_LIMIT = 3.0


def apply_outer_outline(image, rgb=OUTLINE_RGB, alpha=OUTLINE_EFFECTIVE_ALPHA, pad=1):
    """원본 내부 색과 알파를 보존하고 실루엣 바깥 1px에만 저불투명도 테두리를 둔다."""
    src = image.convert("RGBA")
    if pad > 0:
        canvas = Image.new("RGBA", (src.width + 2 * pad, src.height + 2 * pad))
        canvas.paste(src, (pad, pad))
        src = canvas
    arr = np.asarray(src, dtype=np.float32)
    src_a = arr[:, :, 3] / 255.0
    padded = np.pad(src_a, 1, mode="constant", constant_values=0.0)
    dilated = np.maximum.reduce([
        padded[:-2, :-2], padded[:-2, 1:-1], padded[:-2, 2:],
        padded[1:-1, :-2], padded[1:-1, 1:-1], padded[1:-1, 2:],
        padded[2:, :-2], padded[2:, 1:-1], padded[2:, 2:],
    ])
    out_a = (dilated * alpha)[:, :, None]
    a_col = src_a[:, :, None]
    final_a = a_col + out_a * (1.0 - a_col)
    dst_rgb = np.array(rgb, dtype=np.float32)[None, None, :]
    numer = arr[:, :, :3] * a_col + dst_rgb * out_a * (1.0 - a_col)
    final_rgb = np.where(final_a > 1e-6, numer / np.maximum(final_a, 1e-6), 0.0)
    out = np.concatenate([
        np.clip(np.rint(final_rgb), 0, 255),
        np.clip(np.rint(final_a * 255.0), 0, 255),
    ], axis=2).astype(np.uint8)
    return Image.fromarray(out)


def rgb_to_lab(rgb):
    """sRGB uint8/float32 (..., 3) 배열을 D65 CIELAB로 변환한다."""
    srgb = np.asarray(rgb, dtype=np.float64) / 255.0
    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    r, g, b = linear[..., 0], linear[..., 1], linear[..., 2]
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.00000
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    delta = 6.0 / 29.0
    delta3 = delta ** 3
    f = lambda t: np.where(t > delta3, np.cbrt(t), t / (3.0 * delta * delta) + 4.0 / 29.0)
    fx, fy, fz = f(x), f(y), f(z)
    return np.stack([116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)], axis=-1)


def interior_color_delta_e(original, rendered, background=(74, 85, 99)):
    """원본의 알파 128 이상 내부 화소 평균 CIELAB ΔE76 차이를 반환한다."""
    orig_rgba = original.convert("RGBA")
    rend_rgba = rendered.convert("RGBA")
    if orig_rgba.size != rend_rgba.size:
        raise ValueError(f"크기가 다릅니다 · {orig_rgba.size} vs {rend_rgba.size}")
    mask = np.asarray(orig_rgba.getchannel("A")) >= 128
    if not mask.any():
        return 0.0
    bg = Image.new("RGBA", orig_rgba.size, (*background, 255))
    orig_rgb = np.asarray(Image.alpha_composite(bg, orig_rgba).convert("RGB"))
    rend_rgb = np.asarray(Image.alpha_composite(bg, rend_rgba).convert("RGB"))
    diff = rgb_to_lab(orig_rgb)[mask] - rgb_to_lab(rend_rgb)[mask]
    return float(np.linalg.norm(diff, axis=-1).mean())
