# UI-AUDIT-001 — 화면 점검과 스타일 보정(Argon 4)

```yaml
jobId: UI-AUDIT-001
status: READY
owner: Argon 4
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: ee5833846f0aa227ea3a6e2fe89257b02bae0e33  # docs/prd-v0-5, 2026-10-28 발행 준비
contractHash:  # node tools/contract-hash.mjs UI-AUDIT-001 — inputFiles별 SHA-256
  vocabulary_td_prd_v0_5.md: 5d6f25e96aee6e07c31ea33d968cfbc210a9336ab4fb5235284db6cb0f20056a
  docs/assets/design-41-kingdom-expedition.png: 5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13
  src/ui/styles/global.css: b56b448480523af7298c9bc93402e70d0e632c00dc42eb50c0a229796be5ab65
  src/ui/kit.module.css: 907abaee60c23d2e1e0fdc5efc471301df9971c4ef721fb7cecc43a785e9c120
  src/ui/copy.ts: fd4799756d2a9432d77ea9a243bb3e900fa153826a0199bb6d42d0a731af658c
  tests/e2e/play.spec.ts: 3aea535a15079df01bea54218ff0fc9d80bada2686604fe41a122ef972436276
inputFiles:
  - vocabulary_td_prd_v0_5.md
  - docs/assets/design-41-kingdom-expedition.png
  - src/ui/styles/global.css
  - src/ui/kit.module.css
  - src/ui/copy.ts
  - tests/e2e/play.spec.ts
allowedPaths:
  - src/ui/**/*.module.css (global.css·kit.module.css 제외)
forbiddenPaths:
  - src/ui/styles/global.css, src/ui/kit.module.css (공통 토큰·조작부는 총괄만)
  - src/ui/**/*.tsx, src/ui/copy.ts (문구·구조 변경은 제안만)
  - src/domain/**, src/application/**, src/game/**, src/contracts/**, package.json
deliverable: 점검표 + 허용 범위 CSS 패치 + 문구·구조 변경 제안 목록 + 전후 캡처
returnPath: docs/work-packages/UI-AUDIT-001/RETURN.md
```

## 실행 방법

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

캡처는 `test-results/shots/`에 생긴다(1440×900·390×844·1366×650). 직접 보려면 `npm run dev` 후 브라우저에서 같은 크기로 확인한다.

## 점검할 화면과 크기

홈, 새 게임, 준비 문제(정답·오답·모르겠어요 피드백), 배치(빈칸 선택→미리보기→설치, 타워 선택→강화→진화 길→판매 확인), 전투, 마무리 문제, 일시정지, 결과, 내 기록, 사용 설명서.
크기: 1440×900, 1366×650, 1024×690, 768×950, 390×664, 320×460, 글자 크게·아주 크게.

## 점검표(화면마다 표로, PRD §12.8 11항목 + 아래)

PRD §12.8 표를 그대로 쓴다(모서리 반경 2토큰, 그림자 1겹, 그라데이션·블러 0, 글꼴 1종 2굵기, 아이콘 1세트·이모지 0, 토큰 밖 색 0, 4px 간격, 같은 카드 3개 이상 격자 0, 느낌표 화면당 1개, 기능 없는 장식 0, 버튼 6상태). 추가로:

- §2.3 표시 규칙: 난이도 한국어, ‘점수’, ‘힘 8 · 1초마다 · 2.5칸’, 영어 단독 라벨 0.
- §12.5: 보기 4개 같은 모양, 말줄임·보기 안 스크롤 0, 2×2/1열이 제출 전후로 바뀌지 않음, 피드백 자리로 보기가 밀리지 않음.
- §12.1: R/S 모드와 칸 크기가 표와 ±1px, 가로 넘침 0, 정지 버튼이 언제나 보임.
- 대비: 일반 글자 4.5:1, 주요 비텍스트 3:1(실제 합성색으로 잰다).

## 고치는 방법

허용 경로의 CSS만 바꾼다. 문구·구조·동작이 문제면 고치지 말고 RETURN에 `REQUESTED_CONTRACT_CHANGE`로 위치·현재·제안·근거(PRD 절)를 적는다. 새 색·반경·간격 값이 필요하면 토큰 추가를 제안한다(직접 추가하지 않는다). 범용 UI 키트·CSS 유틸리티 프레임워크를 들이지 않는다.

## RETURN.md

화면×크기 점검표(pass/fail+근거), 바꾼 CSS 파일과 이유, 제안 목록, 전후 캡처 경로, `npm run test:e2e` 실제 결과. 취향 차이는 사용자 판단 항목으로 따로 적는다.
