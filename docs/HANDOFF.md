# 다음 총괄·다음 컴퓨터 인계

기준일: 2026-10-28 · 현재 구간: P1 첫 완성 구간, 1차 작업 패키지 수합 완료·2차 발행 준비·P1-REST(소리 제외) 완료 · 총괄: Claude Opus 5.5(Claude Code) · 브랜치 `p1/intake-round1`(수합 `bc3ee07`). push 안 함. 다른 컴퓨터에서 이어 하려면 이 브랜치를 push해야 한다

## 먼저 읽을 것

1. [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md) — §18.4 P1 구현·수합 기록, 확정 결정은 §0.2.
2. [작업 게시판](EXECUTION_BOARD.md), [작업 패키지](work-packages/README.md), [발행용 프롬프트](work-packages/DISPATCH.md).
3. [README](../README.md) — 실행·검사 명령과 모듈 경계.
4. 반환서: [REVIEW-CORE-001](work-packages/REVIEW-CORE-001/RETURN.md), [UI-AUDIT-001](work-packages/UI-AUDIT-001/RETURN.md), [ART-SAMPLE-001](work-packages/ART-SAMPLE-001/RETURN.md), [Q20-001](work-packages/Q20-001/RETURN.md).

## 이번에 실제로 한 것

1차 작업 패키지 네 개(Codex 검토·Codex 이미지·Argon 문항·Argon UI)의 반환을 받아 작업 폴더별로 허용 경로 밖 변경이 없음을 확인하고 본 저장소로 들였다.

- **엔진(REVIEW-CORE-001):** 결함 10건 수정. 핵심 설계 변경은 `RunController.dispatch`다. 답안·거래는 바로 상태를 바꾸지 않고 다음 논리 틱 시작에 순번대로 반영하며, 화면에는 사본(trial)에 미리 적용한 결과를 돌려준다. 정지는 즉시 채택하고 그 틱에 모인 명령을 취소한다. 루프가 돌지 않을 때(시험)는 바로 반영한다. 수동 ‘다음 문제’는 `autoAdvanceTick = tick`으로 틱 끝 판정 뒤에 처리한다. 그래서 시험 도우미 `answerCurrent`는 ‘다음’ 뒤 한 틱을 더 돈다. 나머지: 손상 문항 교체(`replaceUnavailableQuestion`), 버닝 중 구매 간격, 오래된 이력부터 완화, 비행 틱 올림, `num.ts`의 몫·나머지 나눗셈, tick·명령 원자성, 패배 시 연속 정답 초기화.
- **화면(UI-AUDIT-001):** CSS 들임 + 계약 변경 7건. 휴대폰 기본 3종 트레이만 §12.4대로 한 행으로 되돌렸다. 새 타워 선택은 dispatch 결과의 `towerBuilt` 번호로 옮긴다(상태 반영이 한 틱 늦으므로).
- **원화(ART-SAMPLE-001):** `public/assets/manifest.json`에 13장 `integrated_pass`. 대장 2장·피격 1장은 `visual_pass`(이유는 manifest `notes`). 납품 원본은 `asset-source/incoming/ART-SAMPLE-001/`에 그대로 둔다.
- **문항(Q20-001):** 검사 통과, `content-source/reviews/Q20-001/blind-input.json` 생성(정답·해설 없음 확인). 공동검수 전이라 게임 은행에는 넣지 않았다.
- **A26:** `src/content/retractions.json` 철회 목록을 문맥 생성 때 적용. 전부 철회면 판을 열지 않는다.
- PRD 질문 2건(긴 프레임 예외, seed 0 스트림 순서)은 §13.3·§20.1에 답했다.

## 검증(이 작업 트리에서 실제 실행)

- `npm run verify` 통과: 타입·ESLint, 단위·속성 시험 14파일 61개, PRD 검산 48개, 문항 검사.
- `npm run validate:assets` 통과(납품·배포 manifest 둘 다).
- `npm run test:e2e` 4개 통과(실제 원화가 실린 상태).
- `npm run build` 성공, JS gzip 약 501KB(Phaser 357KB).
- 1440×900 전투 실제 칸(72px)에서 원화를 41번과 나란히 확인(2배 캡처). 390×844 트레이 한 행 확인.
- P1-REST 뒤: 단위·속성 시험 70개, e2e 7개(키보드 자리 선택·목록, WebGL 문맥 손실/복구, 첫 연습 판 끝까지) 통과.
- 미실행: 실기기(iOS Safari·Android), 30분 장시간 성능, 엔진 밸런스 시뮬레이션(S11), 5웨이브 대장 원화, 보행 리깅 인수, 문항 공동검수, 배포.

## 다음 첫 행동

1. 2차 세 작업은 머리말(`baseCommit` `bc3ee07`·`contractHash`)과 작업 폴더(`../tower-wp/QR-001`, `QR-002`, `RIG-001`)가 준비되어 있다. [발행용 프롬프트](work-packages/DISPATCH.md)를 각 모델의 새 대화에 보내고, 보낸 것만 게시판에서 RUNNING으로 바꾼다. QR 폴더에는 정답 원본이 없다(sparse checkout, `git sparse-checkout list`로 확인).
2. P1-REST는 소리만 남았다(설치 자리 목록·문맥 손실 복구·첫 연습 판은 `2fb43dc` 이후 커밋에 있다). 소리는 음원 제작 작업을 먼저 정해야 한다. RIG-001이 도는 동안 `src/game/animation/**`는 고치지 않는다.
3. QR 두 보고서가 오면 QR-001 REQUEST의 승인 규칙대로 판정하고, 통과 revision만 3학년 은행 빌드에 넣는다.
4. 다음 게이트는 G2(PRD §18.2: 4→5→6웨이브, 오답·정지·저장복귀·보상 중복 검증)다. 엔진 밸런스 시뮬레이터(S11)와 실기기 확인이 아직 없다.

## 하지 말 것·보존

원문 v0.1·v0.3·v0.4·41번 PNG는 검산 도구가 해시를 확인한다. 광범위 reset/clean으로 복구하지 말고 해당 commit의 필요한 파일만 비교한다. `asset-source/**`는 납품 증거라 `.gitattributes`에서 줄바꿈 변환을 끄고 바이트 그대로 둔다(`SHA256SUMS.txt`와 일치). `.claude/launch.json`은 미리보기 서버 설정이다.
