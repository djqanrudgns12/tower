# ART-RZ2 강가 키트 B 결과

- 내장 `image_gen.imagegen`으로 12종 각각 1회 생성. 원본 12장은 `sources/`에 보존했다.
- 요청된 12종 전부 처리 완료. 최종 PNG 크기는 `prompts.json`·`manifest.json`과 일치하며 실제 생성 알파를 보존했다.
- 재생성·자체 반려: 없음. 색·명암·외곽선을 덮어쓰는 후처리 없이 알파 영역 잘라내기·비율 유지 축소·투명 여백만 적용했다.
- `prepare.py`는 ART-R1 스크립트를 복사·수정했다. 맵 합성 기능은 제외하고, 12종과 밝은/어두운 접촉판만 처리한다.
- `contact-sheet-light.png`·`contact-sheet-dark.png`: 큰 256px 범위 확인판과 64·48·32px 축소판. 자체 1차 시각 검수는 `visual-review.json`에 항목별 기록했다.
- 최종 인수 전이므로 manifest의 status는 모두 `draft`.
- `logs/last-prepare.json`: 12종 처리, 기술 실패 0. `logs/final-verification.json`: 크기·알파·여백·해시·원본·draft·접촉판 검사 결과.
- 검증 실행: `uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-RZ2/prepare.py prepare`, 같은 스크립트의 `verify`.
- 앱 빌드·e2e·실제 맵 배치·총괄 인수: 미실행. 합성 미리보기: 요청에 따라 미생성.
- 총괄 판단: ART-R2 숲과의 손맛·서늘한 팔레트 적합성, 실제 장식 칸에서 물레방아/나루의 크기와 길·설치 자리 가림, 단독 버드나무의 잎 술 가독성. forest.2의 왼쪽에는 작은 물가가 포함되어 있다.
- 원본의 좌상단 밝은 면과 오른쪽 아래 그림자를 유지했다. 좌우반전을 쓰는 실제 배치의 광원 적합성은 총괄 배치 시 확인이 필요하다.
- 이 폴더만 신규 작성. 다른 파일 수정·commit 없음. 동시 진행 중인 ART-RZ1 등은 건드리지 않았다.
