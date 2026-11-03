# ART-FX1 처리 기록

## 산출물

- `fx.butterfly.yellow.0.r1.png`, `.1.r1.png`와 `fx.butterfly.white.0.r1.png`, `.1.r1.png`. 각 64×64 RGBA, 위에서 본 펼침/접힘 프레임.
- `fx.cloudshadow.0.r1.png`~`fx.cloudshadow.2.r1.png`. 각 512×512 RGBA, RGB는 #2b3a4a 단색, 중심 알파 255.
- `contact-sheet-grass.png`. 기존 잔디 위 나비 18px, 구름 200px 및 알파 0.13. 두 화풍 참조를 함께 표시.
- `contact-sheet-inspection.png`. 나비 64/48/32/18px, 구름 알파 1 윤곽 검사.

## 생성과 처리

나비는 내장 `image_gen.imagegen`으로 4회 생성했다. 노란 펼침에서 접힘과 흰 펼침을 편집 생성하고, 흰 접힘은 두 참조를 사용했다. 정확한 호출 프롬프트와 도구 원본 위치는 `prompts.json`에 기록했다. 재생성은 없다.

도구가 요청한 1024 대신 1254×1254 이미지를 반환했다. 반환 원본을 `sources/*.attempt1.generated.png`로 보존하고, `sources/*.1024.white.png`를 별도로 만들었다. 순백 외부 연결 영역만 flood fill로 제거해 닫힌 흰 날개 내부를 유지한다. 잔여 그라데이션을 재질별 2톤의 지정 팔레트로 정리했다. 열린 프레임에서 가져온 몸통·더듬이 영역을 접힌 프레임의 같은 좌표에 고정했다. 전체 1024 캔버스를 함께 축소해 접은 날개가 개별 bbox 맞춤으로 확대되지 않게 했다.

구름 3종은 요청에서 허용한 Pillow 합성이다. 수동 타원 합집합에 34px GaussianBlur를 적용했다. 1024px 순백 합성 원본과 별도의 원래 알파를 함께 보존하고, 저장한 알파로 흰 배경을 제거했다. 최종 RGB는 알파와 무관하게 #2b3a4a이며, 흰 배경의 색이 가장자리에 섞이지 않는다.

## 확인과 수정

첫 접촉판에서는 Pillow `Image.fromarray`의 읽기 전용 버퍼 때문에 flood fill이 적용되지 않아 나비 배경이 불투명했다. 3×3 최소 재현으로 원인을 확인하고, 쓰기 가능한 `.copy()`를 적용해 수정했다. 수정 후 두 접촉판을 다시 만들고 시각 확인했다. 이 수정은 이미지 재생성이 아니다.

`uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-FX1/prepare.py prepare`로 재현한다. 같은 경로의 `verify` 명령이 규격·알파·해시·몸통 동일성과 참조 보존을 확인해 `logs/final-verification.json`에 기록한다. `manifest.json`은 총괄 인수 전 `draft` 상태다. 앱 빌드와 e2e는 미실행이다.
