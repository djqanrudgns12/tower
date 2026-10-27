# 다음 총괄·다음 컴퓨터 인계

기준일: 2026-10-28 · 현재 구간: P1 첫 완성 구간 구현됨 · 총괄: Claude Opus 5.5(Claude Code) · 브랜치 `docs/prd-v0-5`, P1 구현은 `9634d00` 다음 commit(`git log -1 --format=%h -- src`로 확인). push 안 함

## 먼저 읽을 것

1. [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md) — §18.4 P1 구현 기록, 확정 결정은 §0.2.
2. [작업 게시판](EXECUTION_BOARD.md), [작업 패키지](work-packages/README.md).
3. [README](../README.md) — 실행·검사 명령과 모듈 경계.
4. [v0.5 점검 근거](prd_v0_5_review.md) — 밸런스 근사 결과와 남은 위험.

## 이번에 실제로 한 것

PRD v0.5대로 P1을 구현했다. 라이브러리는 npm 레지스트리에서 확인한 현재 버전으로 정확히 잠갔다(Phaser 4.2.1, React 19.3.1, Vite 8.3.5, TypeScript 6.0.3, Zod 4.6.7, idb 8.0.4, Vitest 5.0.5, Playwright 1.64.1). Phaser 4 API는 패키지에 들어 있는 공식 마이그레이션 문서·타입 정의로 확인했고(Canvas 렌더러 폐기 예정, `roundPixels` 기본 false, tint 모드 변경), rolldown의 폐기 예정 옵션(`advancedChunks`) 대신 `codeSplitting`을 썼다. xorshift32는 Marsaglia(2003) C 원형과 출력 5개를 대조해 골든 벡터로 고정했다. IndexedDB는 Chrome 121부터 기본 durability가 relaxed라는 공식 안내에 따라 주기 저장은 기본, ‘저장 후 나가기’·종료 기록은 strict로 쓴다.

구현 중 바로잡은 것: 첫 텍스처 생성 때마다 성능 정지가 뜨던 루프(일회성 끊김은 버리고 반복만 정지, PRD §14 갱신), 화면이 저장소를 직접 부르던 경계 위반(세션 서비스로 이동), 렌더 중 ref 읽기(React Compiler 규칙), 문항 ID 규칙과 어긋난 Argon 지시서 예시, 시험 기대값 산술 오류 1건(최대 나머지 14/6/4).

## 검증(이 작업 트리에서 실제 실행)

- `npm run typecheck`, `npx eslint .` 통과.
- `npm test`: 도메인·콘텐츠 단위·속성 시험 통과(A01~A18·A30~A36 대응, fast-check 불변식 포함).
- `npm run test:e2e`: 4개 통과 — 1440×900 새 게임→준비→설치→전투→정지 중 문제 DOM 제거→재개, 390×844 가로 넘침 0·확대 선택·미니맵, 1366×650 R 모드·칸 ≥44px, axe 위반 0.
- `npm run build` 성공. JS gzip 약 494KB(Phaser 357KB), 글꼴은 unicode-range 서브셋.
- 문항 파이프라인(초안→sidecar→근거 해시→정답 없는 검토 입력→JS/TS 해시 일치)을 임시 복사본의 합성 문항으로 확인.
- 미실행: 실기기(iOS Safari·Android), 30분 장시간 성능, 엔진 밸런스 시뮬레이션(S11), 실제 원화, Argon/Codex 작업, 공동검수, 배포.

## 다음 첫 행동

1. READY 패키지 네 개의 `baseCommit`·`contractHash`를 `node tools/contract-hash.mjs <jobId>`로 채워 발행한다(게시판을 RUNNING으로).
2. 기다리는 동안 총괄은 P1-REST(연습 판, 설치 자리 목록, 문맥 손실 복구, 철회 목록)를 진행한다. 원화·문항이 오면 work-packages/README의 ‘받을 때’ 절차를 따른다.

## 보존/복구

원문 v0.1·v0.3·v0.4·41번 PNG는 검산 도구가 해시를 확인한다. 광범위 reset/clean으로 복구하지 말고 해당 commit의 필요한 파일만 비교한다. `.claude/launch.json`은 미리보기 서버 설정이다.
