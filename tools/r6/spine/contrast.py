"""R6 몬스터 아틀라스 제작 단계에서 바닥 대비와 외곽 좌상단 무광 림을 보정한다."""

import numpy as np
from PIL import Image

R04_SILVER = np.array([184 / 255, 192 / 255, 200 / 255], dtype=np.float32)

# 종족별 (은회 혼합 비율, 감마 지수, 외곽 좌상단 림 강도)
SPECIES_TONE = {
    "elf": (0.20, 0.62, 0.24),
    "human": (0.10, 0.78, 0.14),
    "machine": (0.18, 0.65, 0.20),
    "insect": (0.20, 0.62, 0.22),
    "stone": (0.16, 0.68, 0.18),
}


def outer_rim_mask(union_solid):
    """전체 실루엣의 바깥 좌상단 2~3px 경계(내부 1px 외곽선 안쪽)만 선택한다."""
    h, w = union_solid.shape
    up1 = np.pad(union_solid[:-1, :], ((1, 0), (0, 0)), constant_values=False) if h > 1 else np.zeros_like(union_solid)
    lf1 = np.pad(union_solid[:, :-1], ((0, 0), (1, 0)), constant_values=False) if w > 1 else np.zeros_like(union_solid)
    up3 = np.pad(union_solid[:-3, :], ((3, 0), (0, 0)), constant_values=False) if h > 3 else np.zeros_like(union_solid)
    lf3 = np.pad(union_solid[:, :-3], ((0, 0), (3, 0)), constant_values=False) if w > 3 else np.zeros_like(union_solid)
    return union_solid & (~up3 | ~lf3) & (up1 & lf1)


def apply_tone(image, species, rim_mask=None):
    """어두운 외곽선과 알파를 보존하며 무광 면의 명도와 외곽 림을 보정한다."""
    if species not in SPECIES_TONE:
        return image
    silver_mix, gamma, rim_strength = SPECIES_TONE[species]
    arr = np.asarray(image.convert("RGBA")).astype(np.float32)
    rgb, alpha = arr[:, :, :3], arr[:, :, 3]
    if not (alpha > 0).any():
        return image
    luma = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]) / 255.0
    # 1px 카본 외곽선(luma <= 0.09)은 보존하고 중간 톤만 완만히 들어올린다.
    tone_mask = np.clip((luma - 0.09) / 0.13, 0.0, 1.0)
    norm = np.clip(rgb / 255.0, 0.0, 1.0)
    lifted = np.power(norm, gamma) * (1.0 - silver_mix) + R04_SILVER * silver_mix
    out_norm = norm * (1.0 - tone_mask[:, :, None]) + lifted * tone_mask[:, :, None]
    if rim_strength > 0 and rim_mask is not None:
        rim = rim_mask & (alpha >= 128) & (luma > 0.09)
        out_norm = np.where(rim[:, :, None], out_norm * (1.0 - rim_strength) + R04_SILVER * rim_strength, out_norm)
    out = arr.copy()
    # 무광 화풍과 흰 얼룩 0 기준을 지키기 위해 최댓값을 238로 제한한다.
    out[:, :, :3] = np.clip(np.rint(out_norm * 255.0), 0, 238)
    return Image.fromarray(out.astype(np.uint8))


def enhance_skin_layers(parts, species):
    """스킨의 비그림자 파츠 전체 실루엣을 기준으로 이음매 없이 대비를 보정한다."""
    if species not in SPECIES_TONE:
        return parts
    union_solid = None
    for name, part in parts.items():
        if name == "shadow":
            continue
        solid = np.asarray(part.getchannel("A")) >= 128
        union_solid = solid if union_solid is None else (union_solid | solid)
    rim_mask = outer_rim_mask(union_solid) if union_solid is not None else None
    return {
        name: (part if name == "shadow" else apply_tone(part, species, rim_mask))
        for name, part in parts.items()
    }
