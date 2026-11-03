# ART-SS1 설원 바닥 재료

완료: snow_step 접두어 완성 PNG 12장. 전부 자체 1차 검수 통과, manifest status draft. 총괄 인수 미실행.
생성: 내장 image_gen.imagegen, 원본 14장 모두 sources/ 보존. 외부 API·CLI 생성 미사용.
실제 프롬프트: prompts.json, 참조 편집·재생성 실제 입력은 generation-metadata.json 및 logs/*.generation.json.

## 처리

ART-R1/prepare.py를 복사해 설원 팔레트·id로 수정. 재료 전용 접촉판과 최종 검사 및 정원 받침 폭·중심 맞춤은 ART-RZ1 형식 적용.
불투명 4장은 평균색·낮은 대비·16px 양축 경계 연결. 투명 8장은 생성 알파 보존, 비율 유지 축소와 투명 여백.
path.tuft.1·path.pebbles.0·slot.pad.1은 멀리 떨어진 희미한 알파 찌꺼기를 명시적 sourceCrop 사각 자르기로 제외. 덧칠·마스킹·알파 재구성·좌우반전 없음.
원본은 덮어쓰지 않았다. 받침은 같은 번호 정원 받침의 불투명 알파 폭·중심에 맞춤.

## 자체 반려와 재생성

- path.tuft.1 attempt1: 넓은 갈색 후광. 후광 없는 path.tuft.0 원본을 참조해 attempt2 생성.
- path.pebbles.0 attempt1: 높은 바위 무리로 읽히며 주변 후광. 정원 path.pebbles.0를 참조해 작은 돌 배치로 attempt2 생성.
- 반려 원본은 sources/, 당시 처리본과 이유는 rejected/ 보존. 나머지 10장은 재생성 없음.

## 시각 확인

밝은·어두운 배경 접촉판에서 32/48/64px로 기존 정원 받침·타워와 비교. tile-check.png에서 지면 네 장의 2×2 반복 확인.
최종 자갈·둔덕은 작은 길 재료로 구별됨. 받침 중앙은 비어 있고 눈은 테두리에만 소량.
원형 받침은 정원과 폭·중심 같고 눈/투영으로 가시 높이 4px 증가(192px 원본, 64px 축소에서 약 1.3px).

## 총괄 판단과 미실행

눈길과 base의 색 차이, 매우 미세한 meadow.0 마른 풀의 실제 표시 크기 가독성, 원형 받침의 높이/시점 최종 판단 필요.
합성 미리보기는 요청에 따라 생성하지 않음. 게임 통합·브라우저·e2e·빌드·독립 검수·최종 미술 인수는 미실행. 앱 코드 변경 없음.

## 재현

```sh
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-SS1/prepare.py prepare
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-SS1/prepare.py verify
```

검증 예산: 변경 없는 처리 결과는 캐시 재사용. 최종 verify는 1회 실행하며 로그는 logs/final-verification.json.

최종 실행 결과: prepare.py verify 1회 통과, 12 assets, 원본 14장, errors []. 규격·실제 알파·이음매·원본/산출물 SHA·draft 상태·정원 받침 폭/중심 검사 완료.
정원 사각 받침은 폭·높이·중심 모두 동일. 원형은 폭·중심 동일, 가시 높이 +4px.
동시 작업 관측: baseline 이후 public/assets/manifest.json 내용이 바뀌었고 기존 변경이 현재 Git 상태에서 사라짐. 본 작업은 해당 파일에 쓰지 않았으며 범위 밖 변경을 복구하지 않음. 상세는 preservation-baseline.json와 logs/final-verification.json.
