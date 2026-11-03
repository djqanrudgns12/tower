# ART-RZ2 강가 키트 B

- 요청: Claude의 `20261103T115434-250ec9` 브리지 작업.
- 작업 범위: 이 폴더만 신규 작성. 다른 파일 수정·commit 금지.
- 기준: `../ART-R1/REQUEST.md`, `../../../docs/renewal/art-bible-v2.md`, `../../../docs/contracts/maps.candidate.v0.4.json`의 `river_z`.
- 참조: 41번 원화의 시점, ART-R2 숲의 단순한 둥근 덩어리와 갈색 외곽선, ART-R1 소품의 재질.
- 12종: 가장자리 숲 3, 강바위 2, 물레방아·나루 각 1, 갈대·통발·징검돌 각 1, 단독 나무 2.
- 좌상단 광원, 오른쪽 아래 짧은 그림자, 3단 이하 명암, 외곽선 `#3a291e`, 풀 `#78b85a`·모래 `#d8c48e` 근처. 글자·반짝임·가짜 투명 금지.
- 생성은 내장 `image_gen.imagegen`으로 항목별 1장. 프롬프트 전문은 `prompts.json`, 원본은 `sources/`.
- 처리는 ART-R1의 `prepare.py`를 복사·수정. 실제 생성 알파 보존, 알파 영역 잘라내기, 비율 유지 축소, 투명 여백. 색·명암을 후처리로 덮어쓰지 않는다.
- 밝은·어두운 접촉판 각각 큰 확인판과 64/48/32px 축소판 포함. 맵 합성 미리보기는 요청에 따라 미생성.
- 모든 인수 후보는 `manifest.json`에서 `draft`. 앱 반영·총괄 승인 없음.

재현 명령:

```sh
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-RZ2/prepare.py prepare
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-RZ2/prepare.py verify
```
