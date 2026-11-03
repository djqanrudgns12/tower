# ART-CY2 결과

- 범위: `asset-source/renewal/ART-CY2/` 내부만 작성. 다른 파일 수정·커밋 없음.
- 생성: 내장 `image_gen.imagegen` 항목별 1회, 총 원본 12장. 생성 즉시 `sources/` 복사 보존. 재생성·반려 없음.
- 프롬프트: `prompts.json`. 참조: 41번 원화(투영), ART-R2 숲(둥근 형태), ART-R1 꽃밭(소품 손맛).
- 처리: `ART-R1/prepare.py`를 복사·수정, ART-RZ2의 접촉판 형식 적용. 생성 알파 보존, 비율 유지 축소 및 투명 여백. 배경 제거·색 보정·좌우반전 없음.
- 산출: 처리본 12종, 밝은/어두운 접촉판(큰 그림 및 32/48/64px 축소), manifest 전부 `draft`. 합성 미리보기 없음.

## 항목별 상태

| id | 처리 크기 | 상태 |
|---|---|---|
| courtyard.edge.wall.0 | 384×384 | 자체 1차 검수 통과 / draft |
| courtyard.edge.wall.1 | 384×384 | 자체 1차 검수 통과 / draft |
| courtyard.edge.wall.2 | 384×384 | 자체 1차 검수 통과 / draft |
| courtyard.edge.pines.0 | 384×384 | 자체 1차 검수 통과 / draft |
| courtyard.edge.pines.1 | 384×384 | 자체 1차 검수 통과 / draft |
| courtyard.landmark.lantern | 192×384 | 자체 1차 검수 통과 / draft |
| courtyard.landmark.pavilion | 384×384 | 자체 1차 검수 통과 / draft |
| courtyard.prop.jars | 192×192 | 자체 1차 검수 통과 / draft |
| courtyard.prop.lanterns | 192×192 | 자체 1차 검수 통과 / draft |
| courtyard.prop.flowerpot | 128×128 | 자체 1차 검수 통과 / draft |
| courtyard.tree.0 | 256×256 | 자체 1차 검수 통과 / draft |
| courtyard.tree.1 | 256×256 | 자체 1차 검수 통과 / draft |

## 검증

- 실행: `uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-CY2/prepare.py prepare` — 12종 처리, technicalFailures 없음.
- 실행: 같은 명령의 `verify` — assetCount 12, sourceCount 12, errors 0, protectedChangesSinceBaseline 0.
- 자체 시각 검수: `contact-sheet-light.png`, `contact-sheet-dark.png` 확인. 상세 판단은 `visual-review.json`.
- 앱 빌드/e2e 미실행: 앱 코드 변경 없음. 검증 결과는 `logs/final-verification.json`.

## 총괄 판단

- 실제 courtyard 맵에서 담 3종의 연결부·높이·길 및 설치 자리 가림 여부를 확인해야 한다. 합성 미리보기는 요청대로 생략했다.
- 석등은 `displayWidthCells:1`, `displayHeightCells:2`. 장식 칸 점유와 시각적 크기를 별도 판단해야 한다.
- 외곽선이 선명하고 묵직하다. 기존 ART-R2 숲과 실제 배치에서 선 굵기·팔레트 무게를 최종 판단해야 한다.
- 그림 자체에 좌상단 밝은 면과 짧은 접지 그림자가 들어 있다. 실제 좌우반전 배치에서 광원 일관성을 확인해야 하며, 반전 후 광원 자동 보정은 제공하지 않는다.
- 미술 인수·public 승격·게임 반영은 미실행.
