#!/usr/bin/env python3
"""ART-FX1 처리. uv run --no-project --with pillow --with numpy python <파일> prepare|verify

나비 생성 원본을 보존하고 1024px 순백 소스를 따로 둔다. 배경 연결 영역만 제거하고
지정된 평면 팔레트로 정리한다. 프레임 사이 공통 몸통은 열린 프레임 것을 고정한다.
구름은 허용된 Pillow 합성으로 생성하며 단색 RGB와 부드러운 알파를 분리한다.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
RESAMPLE = Image.Resampling.LANCZOS
OUTLINE = (58, 41, 30)
CLOUD = (43, 58, 74)
COLORS = {
    'yellow': [OUTLINE, (118, 82, 51), (242, 201, 76), (220, 163, 51)],
    'white': [OUTLINE, (118, 82, 51), (246, 250, 255), (197, 222, 240)],
}
# 수동 배치한 서로 다른 구름 윤곽과 가로세로 비율.
CLOUD_LOBES = [
    [(170, 425, 470, 725), (320, 275, 650, 740), (500, 350, 840, 710)],
    [(145, 370, 485, 650), (340, 260, 650, 690), (510, 340, 850, 650),
     (265, 480, 700, 765)],
    [(290, 150, 650, 500), (220, 345, 740, 730), (360, 520, 800, 865)],
]


def read(name):
    return json.loads((ROOT / name).read_text())


def write(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    return ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', size)


def cutout(source, color):
    """닫힌 흰 날개 내부를 보존하는 외부 배경 flood fill."""
    rgb = np.asarray(source.convert('RGB')).astype(np.int32)
    eligible = (rgb.min(axis=2) > 230) & (np.ptp(rgb, axis=2) < 22)
    # fromarray의 읽기 전용 버퍼에서는 floodfill이 적용되지 않는다.
    flood = Image.fromarray((eligible * 255).astype('uint8')).copy()
    ImageDraw.floodfill(flood, (0, 0), 127)
    foreground = np.asarray(flood) != 127
    palette = np.array(COLORS[color], dtype=np.int32)
    distances = ((rgb[:, :, None, :] - palette[None, None, :, :]) ** 2).sum(axis=3)
    flat = palette[distances.argmin(axis=2)].astype('uint8')
    rgba = np.dstack((flat, (foreground * 255).astype('uint8')))
    rgba[~foreground, :3] = 0
    return Image.fromarray(rgba)


def body_mask(opened):
    """원본에서 읽은 몸통과 더듬이 영역. 날개 패턴은 포함하지 않는다."""
    region = Image.new('L', (1024, 1024))
    draw = ImageDraw.Draw(region)
    draw.rectangle((481, 357, 543, 753), fill=255)
    draw.polygon([(453, 259), (478, 257), (516, 367), (490, 375)], fill=255)
    draw.polygon([(545, 257), (570, 259), (533, 375), (507, 367)], fill=255)
    data = np.asarray(opened)
    brown = (data[:, :, 0] < 150) & (data[:, :, 3] == 255)
    return Image.fromarray((np.asarray(region) * brown).astype('uint8'))


def butterflies():
    metadata = {}
    for color in COLORS:
        frames = []
        for frame in range(2):
            ident = f'fx.butterfly.{color}.{frame}'
            raw = ROOT / f'sources/{ident}.attempt1.generated.png'
            normalized = Image.open(raw).convert('RGB').resize((1024, 1024), RESAMPLE)
            normalized.save(ROOT / f'sources/{ident}.1024.white.png')
            frames.append(cutout(normalized, color))
            metadata[ident] = {
                'selectedSource': f'sources/{ident}.1024.white.png',
                'attempts': [{'attempt': 1, 'tool': 'image_gen.imagegen',
                              'source': str(raw.relative_to(ROOT)),
                              'rawSize': list(Image.open(raw).size)}],
                'processing': '외부 순백 연결 영역 제거, 지정 4색(재질별 2톤) 평면화, 공통 몸통 고정, 공통 좌표 축소',
            }
        mask = body_mask(frames[0])
        mask.save(ROOT / f'sources/fx.butterfly.{color}.body-mask.png')
        # 열린 프레임의 몸통 픽셀을 같은 좌표에 고정한다.
        frames[1].paste(frames[0], (0, 0), mask)
        for frame, image in enumerate(frames):
            ident = f'fx.butterfly.{color}.{frame}'
            image.save(ROOT / f'sources/{ident}.1024.transparent.png')
            # 개별 bbox 맞춤을 하지 않아 접은 날개 폭이 확대되지 않는다.
            image.resize((64, 64), RESAMPLE).save(ROOT / f'{ident}.r1.png')
    return metadata


def clouds():
    metadata = {}
    for index, lobes in enumerate(CLOUD_LOBES):
        ident = f'fx.cloudshadow.{index}'
        mask = Image.new('L', (1024, 1024))
        draw = ImageDraw.Draw(mask)
        for box in lobes:
            draw.ellipse(box, fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(34))
        # 부드러운 가장자리와 실제 255 중심. RGB에는 흰 배경 혼입이 없다.
        data = np.asarray(mask).copy()
        data[data < 1] = 0
        mask = Image.fromarray(data)
        mask.save(ROOT / f'sources/{ident}.1024.alpha.png')
        shadow = Image.new('RGBA', (1024, 1024), CLOUD + (255,))
        shadow.putalpha(mask)
        white = Image.new('RGBA', (1024, 1024), 'white')
        white.alpha_composite(shadow)
        white.convert('RGB').save(ROOT / f'sources/{ident}.1024.white.png')
        # 순백 프리뷰에서 저장한 원래 알파를 이용해 정확히 배경을 제거한다.
        final = Image.new('RGBA', (512, 512), CLOUD + (255,))
        final.putalpha(mask.resize((512, 512), RESAMPLE))
        final.save(ROOT / f'{ident}.r1.png')
        metadata[ident] = {
            'selectedSource': f'sources/{ident}.1024.white.png',
            'alphaSource': f'sources/{ident}.1024.alpha.png',
            'attempts': [{'attempt': 1, 'tool': 'Pillow', 'lobes': lobes, 'blurPx': 34}],
            'processing': '허용된 Pillow 타원 합집합 합성. 단색 #2b3a4a와 알파 분리, 512px 축소',
        }
    return metadata


def contacts():
    grass = Image.open(PROJECT / 'public/assets/ground.grass.r1.png').convert('RGBA')
    board = Image.new('RGBA', (960, 640))
    for y in range(0, board.height, grass.height):
        for x in range(0, board.width, grass.width):
            board.alpha_composite(grass, (x, y))
    draw = ImageDraw.Draw(board)
    draw.text((24, 20), 'ART-FX1  실제 표시 크기 · 나비 18px / 구름 200px · 알파 0.13',
              font=font(22), fill='#263521')
    for i in range(3):
        shadow = Image.open(ROOT / f'fx.cloudshadow.{i}.r1.png').resize((200, 200), RESAMPLE)
        shadow.putalpha(shadow.getchannel('A').point(lambda v: round(v * .13)))
        board.alpha_composite(shadow, (60 + i * 300, 100))
        draw.text((86 + i * 300, 315), f'fx.cloudshadow.{i}', font=font(15), fill='#263521')
    for i, color in enumerate(COLORS):
        for frame in range(2):
            ident = f'fx.butterfly.{color}.{frame}'
            image = Image.open(ROOT / f'{ident}.r1.png').resize((18, 18), RESAMPLE)
            board.alpha_composite(image, (148 + frame * 160, 430 + i * 105))
            draw.text((105 + frame * 160, 464 + i * 105), f'{color}.{frame}', font=font(16), fill='#263521')
    draw.text((516, 415), '화풍 참조', font=font(16), fill='#263521')
    for i, path in enumerate(['public/assets/deco.tree.r1.png',
                              'asset-source/renewal/ART-M6/beetle.flyer.r1.png']):
        image = Image.open(PROJECT / path).convert('RGBA').resize((64, 64), RESAMPLE)
        board.alpha_composite(image, (540 + i * 155, 460))
    board.convert('RGB').save(ROOT / 'contact-sheet-grass.png')
    # 같은 결과를 64/48/32/18px로 나란히 보며 외곽선과 축소 가독성을 확인한다.
    inspect = Image.new('RGBA', (960, 600), '#e8e1cb')
    draw = ImageDraw.Draw(inspect)
    for row, color in enumerate(COLORS):
        for frame in range(2):
            ident = f'fx.butterfly.{color}.{frame}'
            x, y = 30 + frame * 470, 20 + row * 180
            draw.text((x, y), ident, font=font(17), fill='#3a291e')
            image = Image.open(ROOT / f'{ident}.r1.png')
            for col, size in enumerate([64, 48, 32, 18]):
                inspect.alpha_composite(image.resize((size, size), RESAMPLE), (x + col * 100, y + 35))
                draw.text((x + col * 100, y + 107), f'{size}px', font=font(13), fill='#3a291e')
    for i in range(3):
        image = Image.open(ROOT / f'fx.cloudshadow.{i}.r1.png').resize((180, 180), RESAMPLE)
        inspect.alpha_composite(image, (45 + i * 310, 390))
        draw.text((45 + i * 310, 570), f'cloudshadow.{i} · 알파 1', font=font(14), fill='#3a291e')
    inspect.convert('RGB').save(ROOT / 'contact-sheet-inspection.png')


def prepare():
    metadata = butterflies()
    metadata.update(clouds())
    write('generation-metadata.json', metadata)
    assets = []
    measurements = {}
    for ident, meta in metadata.items():
        path = ROOT / f'{ident}.r1.png'
        image = Image.open(path)
        data = np.asarray(image)
        alpha = data[:, :, 3]
        cloud = ident.startswith('fx.cloudshadow')
        measurements[ident] = {
            'sourceSize': list(Image.open(ROOT / meta['selectedSource']).size),
            'width': image.width, 'height': image.height,
            'alphaMin': int(alpha.min()), 'alphaMax': int(alpha.max()),
            'borderAlphaMax': int(max(alpha[0].max(), alpha[-1].max(), alpha[:, 0].max(), alpha[:, -1].max())),
            'sourceHash': sha(ROOT / meta['selectedSource']), 'artifactHash': sha(path),
            'technicalPass': True,
        }
        assets.append({
            'id': ident, 'revision': 1, 'file': path.name, 'width': image.width,
            'height': image.height, 'originX': .5, 'originY': .5,
            'displayCells': (200 if cloud else 18) / 128,
            'displayPx': 200 if cloud else 18, 'layer': 'fx', 'frames': 1,
            'status': 'draft', 'sourceHash': measurements[ident]['sourceHash'],
            'artifactHash': sha(path), 'producer': 'Pillow' if cloud else 'image_gen.imagegen / 내장 도구',
            'license': '자체 생성, 프로젝트 전용',
            'notes': meta['processing'] + (' 게임 표시 알파 0.10~0.16, 접촉판 0.13.' if cloud else ' 0=펼침, 1=접힘. 같은 64px 캔버스, 몸통 좌표 고정.') + ' 총괄 인수 전 draft.',
        })
    write('measurements.json', measurements)
    write('manifest.json', {'schemaVersion': '1', 'jobId': 'ART-FX1',
          'styleReferenceSha256': sha(PROJECT / 'docs/assets/design-41-kingdom-expedition.png'), 'assets': assets})
    contacts()
    write('logs/last-prepare.json', {'processed': list(metadata), 'regenerations': [],
          'rawNormalization': '나비 내장 도구 반환 1254px를 보존하고 처리용 1024px 소스를 별도로 저장',
          'cloudMethod': 'Pillow 합성', 'appBuild': '미실행 · 에셋 패키지만 생성'})
    print('7개 에셋과 접촉판 2개 처리 완료')


def verify():
    errors = []
    manifest = read('manifest.json')
    metadata = read('generation-metadata.json')
    for asset in manifest['assets']:
        ident = asset['id']
        path = ROOT / asset['file']
        image = Image.open(path)
        data = np.asarray(image)
        alpha = data[:, :, 3]
        cloud = ident.startswith('fx.cloudshadow')
        expected = (512, 512) if cloud else (64, 64)
        if image.mode != 'RGBA' or image.size != expected or sha(path) != asset['artifactHash']:
            errors.append(ident + ' 크기/모드/해시 오류')
        if alpha.min() != 0 or alpha.max() != 255:
            errors.append(ident + ' 알파 범위 오류')
        if any(edge.any() for edge in [alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]]):
            errors.append(ident + ' 테두리 여백 없음')
        if cloud and not (data[:, :, :3] == CLOUD).all():
            errors.append(ident + ' 단색 오류')
        if Image.open(ROOT / metadata[ident]['selectedSource']).size != (1024, 1024):
            errors.append(ident + ' 처리 소스 크기 오류')
    body_checks = {}
    for color in COLORS:
        opened = np.asarray(Image.open(ROOT / f'sources/fx.butterfly.{color}.0.1024.transparent.png'))
        folded = np.asarray(Image.open(ROOT / f'sources/fx.butterfly.{color}.1.1024.transparent.png'))
        mask = np.asarray(Image.open(ROOT / f'sources/fx.butterfly.{color}.body-mask.png')) > 0
        equal = np.array_equal(opened[mask], folded[mask])
        body_checks[color] = {'bodyPixelsIdentical': equal, 'bodyPixelCount': int(mask.sum()),
                              'openBBox': list(Image.fromarray(opened[:, :, 3]).getbbox()),
                              'foldedBBox': list(Image.fromarray(folded[:, :, 3]).getbbox())}
        if not equal:
            errors.append(color + ' 몸통 불일치')
    protected = read('preservation-baseline.json')['protected']
    changed = [path for path, digest in protected.items() if sha(PROJECT / path) != digest]
    if changed:
        errors.append('참조 파일 변경')
    report = {'assetCount': len(manifest['assets']), 'automatedPass': not errors,
              'errors': errors, 'bodyChecks': body_checks, 'protectedChanges': changed,
              'visualReview': read('visual-review.json'),
              'gitStatus': subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=all'], cwd=PROJECT, text=True),
              'appBuild': '미실행 · 앱 코드 변경 없음', 'e2e': '미실행 · 앱 코드 변경 없음',
              'acceptance': '총괄 인수 미실행'}
    write('logs/final-verification.json', report)
    print(json.dumps({key: report[key] for key in ['assetCount', 'automatedPass', 'errors', 'bodyChecks', 'protectedChanges']}, ensure_ascii=False, indent=2))
    assert not errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'verify'])
    globals()[parser.parse_args().action]()
