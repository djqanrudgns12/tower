#!/usr/bin/env python3
"""ART-OAK1 처리(R5 참나무 재질 원화를 9-slice·타일·3-slice 웹 자산으로).

실행(저장소 루트 어디서나):
  uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-OAK1/prepare.py <목록> [<목록>...]

목록 파일은 줄마다 `<id> <종류> <원본 경로>` (빈 줄·# 줄 무시). 원본은 sources/에 이미 있으므로 복사하지 않는다.
  종류: frame(틀·홈·양피지), tile(판), key(키), badge(배지), strip(띠·선)
  예)
    oak.frame.lg  frame asset-source/renewal/ART-OAK1/sources/oak.frame.lg.r1.jpg
    oak.board     tile  asset-source/renewal/ART-OAK1/sources/oak.board.r1.jpg
    oak.key.brass key   asset-source/renewal/ART-OAK1/sources/oak.key.brass.r1.jpg

결과
  public/assets/ui/oak/<id에서 oak. 뺀 이름>.webp   (알파 유지, 종류별 무게 예산 안에서 가장 높은 품질)
  asset-source/renewal/ART-OAK1/manifest.json        (id별 크기·바이트·slice·권장 CSS·원본 SHA-256, 실행마다 병합)
  asset-source/renewal/ART-OAK1/tile-check-<이름>.png (tile 종류: 2x2 이음새 확인)

처리 요약
  frame : 바깥 흰 배경(가장자리 flood fill)과, 가운데가 흰색이면 틀 안쪽 흰 면(가운데 flood fill)을 투명으로 지운다.
          흰색과 섞인 가장자리 픽셀은 가까운 짙은 윤곽색으로 알파를 풀어 흰 테두리를 없앤다. 정사각으로 잘라 줄이고(lg 512, 그 밖 256)
          네 변 테 폭을 재서 9-slice 값을 정한다. 안쪽이 면(홈·양피지)이면 가운데 색과 달라지는 마지막 자리까지를 테로 본다.
  tile  : 판 사이 어두운 이음(가로)과 판 단위 주기를 지키면서 판마다 조명 기울기를 평탄하게 하고, 좌우는 반 폭 오프셋 블렌드로 잇는다.
  key·badge·strip : 흰 배경 제거 후 바운딩 박스로 잘라 높이 기준으로 줄이고(key 96, badge 48, ribbon 96, rule 24), 좌우 끝(둥근 끝·리벳·꼬리)이
          들어가는 3-slice 폭을 위·아래 윤곽이 평평해지는 자리와 열 색 변화에서 정한다.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
OUT = PROJECT / 'public/assets/ui/oak'
URL_BASE = '/assets/ui/oak'
MANIFEST = ROOT / 'manifest.json'
TOTAL_BUDGET = 400 * 1024

# 종류별 무게 예산(바이트). 12장 합계 400KB 이하가 목표라 합계가 이 안에 들도록 잡았다.
BUDGET = {'frame.lg': 60_000, 'frame': 28_000, 'tile': 40_000, 'key': 22_000, 'badge': 12_000, 'ribbon': 18_000, 'rule': 8_000}
FRAME_SIZE = {'frame.lg': 512}          # 나머지 frame은 256
STRIP_HEIGHT = {'key': 96, 'badge': 48, 'ribbon': 96, 'rule': 24}
DISPLAY_SCALE = 2                       # 원화는 표시 크기의 2배 밀도
TILE_SIZE = 256
# 판 위 글 대비(ui-rules-v4 §2.6): 평균을 --oak-1(#decba8)로 옮기고 결·이음 대비를 이 배율로 줄인다.
# 0.55에서 128px 표시 --ink 대비 최소 ≥4.5(원본은 평균 6.4·판자 틈 1.4, 세션 K 측정 2026-11-05).
TILE_TONE = {'oak.board': ((0xde, 0xcb, 0xa8), 0.55)}


# ---------------------------------------------------------------- 공통

def short_id(id_: str) -> str:
    return id_[4:] if id_.startswith('oak.') else id_


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def whiteish(rgb: np.ndarray) -> np.ndarray:
    return (rgb.min(axis=2) > 238) & (np.ptp(rgb, axis=2) < 20)


def flood(mask: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    """mask(True=흰색)에서 seeds와 이어진 칸만 True로 돌려준다(줄 단위 flood fill, Pillow 버전과 무관)."""
    h, w = mask.shape
    left = mask.copy()
    out = np.zeros_like(mask)
    stack: list[tuple[int, int]] = []
    for sx, sy in seeds:
        if left[sy, sx]:
            stack.append((sx, sy))
        while stack:
            x, y = stack.pop()
            row = left[y]
            if not row[x]:
                continue
            l = x
            while l > 0 and row[l - 1]:
                l -= 1
            r = x
            while r < w - 1 and row[r + 1]:
                r += 1
            row[l:r + 1] = False
            out[y, l:r + 1] = True
            for ny in (y - 1, y + 1):
                if 0 <= ny < h:
                    nrow = left[ny]
                    xx = l
                    while xx <= r:
                        if nrow[xx]:
                            stack.append((xx, ny))
                            while xx <= r and nrow[xx]:
                                xx += 1
                        else:
                            xx += 1
    return out


def border_seeds(w: int, h: int, step: int = 16) -> list[tuple[int, int]]:
    s = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)]
    s += [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    return s + [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]


def cutout(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """bg(True=지울 배경)를 투명으로 만든 RGBA(uint8).

    배경 경계 3px 안의 섞인 픽셀은 c = a*F + (1-a)*255 로 보고, F를 가까운 가장 짙은 색(윤곽)으로 잡아 알파 a를 푼다.
    그래서 흰 테두리가 남지 않고 가장자리가 부드럽다.
    """
    h, w, _ = rgb.shape
    u8 = rgb.astype('uint8')
    dil = np.asarray(Image.fromarray((bg * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))) > 0
    band = dil & ~bg
    near_dark = np.asarray(Image.fromarray(u8).filter(ImageFilter.MinFilter(7))).astype(np.float32)
    lum_c = rgb.mean(axis=2)
    lum_f = near_dark.mean(axis=2)
    a = np.clip((255 - lum_c) / np.maximum(255 - lum_f, 8.0), 0.0, 1.0)
    alpha = np.where(bg, 0.0, np.where(band, a, 1.0))
    out_rgb = np.where((band & (a < 0.98))[..., None], near_dark, rgb)
    out = np.dstack([np.clip(out_rgb, 0, 255), alpha * 255]).round().astype('uint8')
    out[bg, :3] = 0
    return out


def premult_resize(arr: np.ndarray, size: tuple[int, int]) -> Image.Image:
    img = Image.fromarray(arr, 'RGBA')
    return img.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')


def bbox_alpha(arr: np.ndarray, thr: int = 127) -> tuple[int, int, int, int]:
    ys, xs = np.where(arr[..., 3] > thr)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def save_webp(img: Image.Image, path: Path, budget: int) -> tuple[int, str]:
    """예산 안에서 가장 높은 품질로 저장하고 (바이트, 품질)을 돌려준다. 작은 장은 무손실을 먼저 본다."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp.webp')
    try:
        img.save(tmp, 'WEBP', lossless=True, quality=100, method=6)
        if tmp.stat().st_size <= budget:
            tmp.replace(path)
            return path.stat().st_size, 'lossless'
        for q in (96, 93, 90, 87, 84, 81, 78, 74, 70):
            img.save(tmp, 'WEBP', quality=q, alpha_quality=100, method=6)
            if tmp.stat().st_size <= budget:
                break
        tmp.replace(path)
        return path.stat().st_size, str(q)
    finally:
        if tmp.exists():
            tmp.unlink()


def gblur(a: np.ndarray, sigma: float) -> np.ndarray:
    h, w = a.shape
    pad = int(3 * sigma)
    hh, ww = h + 2 * pad, w + 2 * pad
    f = np.fft.rfft2(a, s=(hh, ww))
    fy = np.fft.fftfreq(hh)[:, None]
    fx = np.fft.rfftfreq(ww)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(f * g, s=(hh, ww))[:h, :w]


# ---------------------------------------------------------------- frame

def edge_widths_alpha(alpha: np.ndarray) -> dict[str, int]:
    """구멍(투명)이 있는 틀의 네 변 테 폭. 가운데 1/3 줄들의 중앙값."""
    h, w = alpha.shape
    lo, hi = h // 3, 2 * h // 3

    def first_clear(vec: np.ndarray) -> int:
        idx = np.where(vec <= 8)[0]
        return int(idx.min()) if len(idx) else -1

    left = [first_clear(alpha[y, :w // 2]) for y in range(lo, hi)]
    right = [first_clear(alpha[y, w // 2:][::-1]) for y in range(lo, hi)]
    top = [first_clear(alpha[:h // 2, x]) for x in range(lo, hi)]
    bottom = [first_clear(alpha[h // 2:, x][::-1]) for x in range(lo, hi)]
    return {k: int(np.median(v)) for k, v in dict(top=top, right=right, bottom=bottom, left=left).items()}


def edge_widths_face(rgb: np.ndarray, tol: int = 10) -> dict[str, int]:
    """구멍 없는 틀(홈·양피지): 가운데 면 색과 tol 넘게 달라지는 마지막 자리까지를 테로 본다."""
    h, w, _ = rgb.shape
    c = np.median(rgb[h * 2 // 5:h * 3 // 5, w * 2 // 5:w * 3 // 5].reshape(-1, 3), axis=0)
    mid = slice(h * 3 // 8, h * 5 // 8)

    def last_dev(strip: np.ndarray) -> int:  # strip: (길이, 3) 바깥→안
        dev = np.abs(strip - c).max(axis=1)
        idx = np.where(dev > tol)[0]
        return int(idx.max()) + 1 if len(idx) else 0

    left = last_dev(rgb[mid, :w // 2].mean(axis=0))
    right = last_dev(rgb[mid, w // 2:][:, ::-1].mean(axis=0))
    top = last_dev(rgb[:h // 2, mid].mean(axis=1))
    bottom = last_dev(rgb[h // 2:, mid][::-1].mean(axis=1))
    return dict(top=top, right=right, bottom=bottom, left=left)


def process_frame(id_: str, src: Path) -> tuple[Image.Image, dict]:
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    white = whiteish(rgb)
    outer = flood(white, border_seeds(w, h))
    cx, cy = w // 2, h // 2
    hole = flood(white, [(cx, cy)]) if white[cy, cx] and not outer[cy, cx] else np.zeros_like(outer)
    has_hole = bool(hole.any())
    rgba = cutout(rgb, outer | hole)
    x0, y0, x1, y1 = bbox_alpha(rgba)
    side = min(x1 - x0, y1 - y0)                       # 정사각으로(가운데 기준)
    x0 += (x1 - x0 - side) // 2
    y0 += (y1 - y0 - side) // 2
    rgba = rgba[y0:y0 + side, x0:x0 + side]
    size = FRAME_SIZE.get(short_id(id_), 256)
    img = premult_resize(rgba, (size, size))
    arr = np.asarray(img)
    measured = edge_widths_alpha(arr[..., 3]) if has_hole else edge_widths_face(arr[..., :3].astype(np.float32))
    slice_px = int(max(measured.values()))
    border_css = {'frame.lg': 18, 'frame.sm': 10, 'groove': 10, 'parch': 8}.get(short_id(id_), 10)
    meta = {
        'size': [size, size], 'hasHole': has_hole, 'cropSource': [x0, y0, side, side],
        'measuredEdges': measured, 'slice': {'top': slice_px, 'right': slice_px, 'bottom': slice_px, 'left': slice_px},
        'displayBorder': border_css,
    }
    fill = '' if has_hole else ' fill'
    meta['css'] = (f"border: {border_css}px solid transparent; border-image: url({URL_BASE}/{short_id(id_)}.webp) {slice_px}{fill} / {border_css}px stretch;"
                   + ' background-clip: padding-box;')
    return img, meta


# ---------------------------------------------------------------- tile

def seam_ratio(arr: np.ndarray, axis: int) -> float:
    """랩(끝↔처음) 이웃 차이 / 안쪽 이웃 차이의 평균. 1 안팎이면 이음새가 안쪽과 같은 정도."""
    a = arr[..., :3].astype(np.float32)
    inner = np.abs(np.diff(a, axis=axis)).mean()
    wrap = np.abs(np.take(a, 0, axis=axis) - np.take(a, -1, axis=axis)).mean()
    return float(wrap / max(inner, 1e-6))


def dark_runs(vec: np.ndarray, thr: float) -> list[tuple[int, int]]:
    dark = vec < thr
    runs, start = [], None
    for i, d in enumerate(dark):
        if d and start is None:
            start = i
        if not d and start is not None:
            runs.append((start, i)); start = None
    if start is not None:
        runs.append((start, len(vec)))
    return runs


def process_tile(id_: str, src: Path) -> tuple[Image.Image, dict]:
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    # 위·아래 반쪽 이음이 합쳐 한 이음(안쪽 이음과 같은 두께)이 되도록 한 줄씩 깎는다. 판 간격 255.5px = 1022/4.
    rgb = rgb[1:1023]
    h, w, _ = rgb.shape
    lum = rgb.mean(axis=2)
    rows = lum[:, 40:w - 40].mean(axis=1)
    runs = dark_runs(rows, 70)
    # 위 반쪽·아래 반쪽이 한 이음이므로 판 경계는 안쪽 이음 3개 + 랩 이음 하나
    inner_seams = [r for r in runs if r[0] > 0 and r[1] < h]
    cuts = [(0, 0)] + inner_seams + [(h, h)]
    planks = []
    for (a0, a1), (b0, b1) in zip(cuts[:-1], cuts[1:]):
        planks.append((a1, b0))                      # 이음 사이 판(이음 윗면 하이라이트·아랫면 경사 포함)
    # 조명 기울기 평탄화: 판마다 마스크 블러(판 안쪽만)로 저주파를 추정해 일정한 밝기로 나눈다.
    means = []
    for y0, y1 in planks:
        means.append(lum[y0 + 14:y1 - 14, 40:w - 40].mean())
    target = float(np.mean(means))
    out = rgb.copy()
    for (y0, y1), m in zip(planks, means):
        mask = np.zeros((h, w), np.float32)
        mask[y0 + 14:y1 - 14, :] = 1
        low = gblur(lum * mask, 90) / np.maximum(gblur(mask, 90), 1e-4)
        t = target + 0.3 * (m - target)              # 판마다 살짝 다른 밝기는 30%만 남긴다
        f = np.clip(t / np.maximum(low, 1.0), 0.8, 1.25)
        out[y0:y1] = np.clip(rgb[y0:y1] * f[y0:y1, :, None], 0, 255)
    # 좌우 이음: 반 폭 오프셋 블렌드. 가장자리는 원본 가운데 내용, 가운데 평탄 구간은 원본 그대로.
    shifted = np.roll(out, w // 2, axis=1)
    x = np.arange(w, dtype=np.float32)
    d = np.minimum(x, w - 1 - x) / (0.34 * w)       # 0(가장자리) → 1 (0.34 폭 안쪽부터 원본)
    t = np.clip(d, 0, 1)
    wgt = (t * t * (3 - 2 * t))[None, :, None]
    blended = out * wgt + shifted * (1 - wgt)
    arr = np.dstack([np.clip(blended, 0, 255), np.full((h, w), 255)]).round().astype('uint8')
    img = Image.fromarray(arr, 'RGBA').convert('RGB').resize((TILE_SIZE, TILE_SIZE), Image.Resampling.LANCZOS)
    small = np.asarray(img)
    if id_ in TILE_TONE:
        token, k = TILE_TONE[id_]
        f = small.astype(np.float32)
        f = np.array(token, np.float32) + k * (f - f.reshape(-1, 3).mean(axis=0))
        small = np.clip(f, 0, 255).round().astype('uint8')
        img = Image.fromarray(small, 'RGB')
    sx, sy = seam_ratio(small, 1), seam_ratio(small, 0)
    # 2x2 확인판
    check = Image.new('RGB', (TILE_SIZE * 2, TILE_SIZE * 2))
    for i in range(2):
        for j in range(2):
            check.paste(img, (i * TILE_SIZE, j * TILE_SIZE))
    check.save(ROOT / f'tile-check-{short_id(id_)}.png')
    meta = {
        'size': [TILE_SIZE, TILE_SIZE], 'seamRatio': {'x': round(sx, 2), 'y': round(sy, 2)},
        'planks': len(planks), 'plankHeightPx': TILE_SIZE // max(len(planks), 1),
        'css': f"background: url({URL_BASE}/{short_id(id_)}.webp) 0 0 / {TILE_SIZE}px {TILE_SIZE}px repeat;",
    }
    return Image.fromarray(small, 'RGB'), meta


# ---------------------------------------------------------------- key / badge / strip

def cap_width(arr: np.ndarray, use_color: bool = True, cap_min: int = 0) -> tuple[int, dict]:
    """좌우 끝(둥근 끝·리벳·꼬리) 폭. 열 높이(알파 합)·윗선이 가운데 열과 같아지는 자리와 열 평균 색이 같아지는 자리 중 큰 값 + 3px."""
    h, w, _ = arr.shape
    alpha = arr[..., 3].astype(np.float32) / 255
    ext = alpha.sum(axis=0)
    top = np.array([np.argmax(alpha[:, x] > 0.5) for x in range(w)])
    mid = w // 2

    def walk(rng, ok) -> int:
        n = 0
        for x in rng:
            if not ok(x):
                break
            n += 1
        return n

    shape_ok = lambda x: abs(ext[x] - ext[mid]) < 0.5 and abs(int(top[x]) - int(top[mid])) <= 1
    left_shape = mid - walk(range(mid, -1, -1), shape_ok) + 1
    right_shape = w - (mid + walk(range(mid, w), shape_ok))
    weight = alpha[..., None]
    colmean = (arr[..., :3].astype(np.float32) * weight).sum(axis=0) / np.maximum(weight.sum(axis=0), 1e-3)
    color_ok = lambda x: np.abs(colmean[x] - colmean[mid]).max() <= 9
    left_col = mid - walk(range(mid, -1, -1), color_ok) + 1 if use_color else 0
    right_col = w - (mid + walk(range(mid, w), color_ok)) if use_color else 0
    cap = max(left_shape, right_shape, left_col, right_col, cap_min - 3) + 3
    cap = int(min(cap, w * 0.45))
    return cap, {'shapeLeft': int(left_shape), 'shapeRight': int(right_shape), 'colorLeft': int(left_col), 'colorRight': int(right_col)}


def process_strip(id_: str, kind: str, src: Path) -> tuple[Image.Image, dict]:
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    white = whiteish(rgb)
    outer = flood(white, border_seeds(w, h))
    # 배경에 남은 먼지·잔상 섬을 없애려고 가운데에서 이어진 몸통만 남긴다.
    body = flood(~outer, [(w // 2, h // 2)])
    rgba = cutout(rgb, ~body)
    x0, y0, x1, y1 = bbox_alpha(rgba)
    m = 3
    x0, y0, x1, y1 = max(x0 - m, 0), max(y0 - m, 0), min(x1 + m, w), min(y1 + m, h)
    rgba = rgba[y0:y1, x0:x1]
    target_h = STRIP_HEIGHT.get(short_id(id_).split('.')[0], STRIP_HEIGHT[kind if kind in STRIP_HEIGHT else 'key'])
    scale = target_h / rgba.shape[0]
    size = (round(rgba.shape[1] * scale), target_h)
    img = premult_resize(rgba, size)
    arr = np.asarray(img)
    # 나뭇결이 있는 막대(rule)는 열 색이 결 따라 달라지므로 모양만으로 끝 폭을 잡고, 끝 마개 옆 그늘을 위해 최소 20px을 둔다.
    is_rule = short_id(id_).startswith('rule')
    cap, detail = cap_width(arr, use_color=not is_rule, cap_min=20 if is_rule else 0)
    disp_h = target_h // DISPLAY_SCALE
    cap_css = round(cap / DISPLAY_SCALE)
    meta = {
        'size': list(size), 'cropSource': [x0, y0, x1 - x0, y1 - y0], 'slice': {'left': cap, 'right': cap},
        'capDetail': detail, 'displayHeight': disp_h,
        'css': (f"height: {disp_h}px; border: 0 solid transparent; border-width: 0 {cap_css}px; "
                f"border-image: url({URL_BASE}/{short_id(id_)}.webp) 0 {cap} fill / 0 {cap_css}px stretch;"),
    }
    return img, meta


# ---------------------------------------------------------------- 실행

def unify_key_caps(items: dict) -> None:
    """키는 색만 다른 한 벌이므로 3-slice 폭을 가장 큰 값으로 통일한다(값이 장마다 다르면 늘렸을 때 끝 모양이 어긋난다)."""
    keys = [v for k, v in items.items() if k.startswith('oak.key.')]
    if not keys:
        return
    cap = max(v['slice']['left'] for v in keys)
    for k, v in items.items():
        if not k.startswith('oak.key.'):
            continue
        v['slice'] = {'left': cap, 'right': cap}
        cap_css = round(cap / DISPLAY_SCALE)
        v['css'] = (f"height: {v['displayHeight']}px; border: 0 solid transparent; border-width: 0 {cap_css}px; "
                    f"border-image: url({v['url']}) 0 {cap} fill / 0 {cap_css}px stretch;")


def budget_for(id_: str, kind: str) -> int:
    s = short_id(id_)
    if s in BUDGET:
        return BUDGET[s]
    head = s.split('.')[0]
    if kind == 'frame':
        return BUDGET['frame']
    return BUDGET.get(head, BUDGET.get(kind, 20_000))


def main(lists: list[str]) -> None:
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {'items': {}}
    items = manifest.setdefault('items', {})
    for lst in lists:
        for line in Path(lst).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            id_, kind, src_arg = line.split(maxsplit=2)
            src = Path(src_arg)
            src = src if src.is_absolute() else (PROJECT / src if (PROJECT / src).exists() else Path.cwd() / src)
            if kind == 'frame':
                img, meta = process_frame(id_, src)
            elif kind == 'tile':
                img, meta = process_tile(id_, src)
            elif kind in ('key', 'badge', 'strip'):
                img, meta = process_strip(id_, kind, src)
            else:
                raise SystemExit(f'알 수 없는 종류: {kind} ({id_})')
            out = OUT / f'{short_id(id_)}.webp'
            size, quality = save_webp(img, out, budget_for(id_, kind))
            items[id_] = {
                'kind': kind, 'out': str(out.relative_to(PROJECT)), 'url': f'{URL_BASE}/{short_id(id_)}.webp',
                'width': img.width, 'height': img.height, 'bytes': size, 'quality': quality,
                **meta,
                'source': {'path': str(src.relative_to(PROJECT)) if src.is_relative_to(PROJECT) else str(src), 'sha256': sha256(src)},
            }
            print(f"{id_:16s} {kind:6s} {img.width}x{img.height} {size:6d}B q={quality} slice={meta.get('slice')}")
    unify_key_caps(items)
    manifest['items'] = dict(sorted(items.items()))
    total = sum(v['bytes'] for v in items.values())
    manifest['totalBytes'] = total
    manifest['budgetBytes'] = TOTAL_BUDGET
    manifest['count'] = len(items)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'합계 {total} B ({len(items)}장, 목표 {TOTAL_BUDGET} B 이하)')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
