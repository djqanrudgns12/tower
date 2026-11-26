---
id: hub-deploy-and-verification
type: hub
title: 배포·보존 잠금·검증 예산 운영
status: active
updated: 2026-11-25
verified: { commit: b231561f, date: 2026-11-26 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: package.json
    sha256: "438e5fc906d190ae6ff3e75af936f686e94d883375aff3ab996bcf06cd749d08"
  - path: .github/workflows/pages.yml
    sha256: "3d661834606ab2b66da309cbf8d8968032333e6ae8d6a708848c18bf3182459e"
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: docs/renewal/r6/tech/G5-server.md
    sha256: "895f648cac4edc29c8eadafdd6bcced05880e8b8609c5f49d33099f832099dae"
  - path: docs/renewal/r6/tech/G5-perf.md
    sha256: f53b47482ca494b4723d1b72f04b485b4d69cdf3520ad2a0a8cf46433305b455
  - path: tools/validate-plan.mjs
    sha256: "9335404b1bac48dccf79827a06dfcbf61ee4ba9b00824559507710b93ea192d9"
---

# 배포·보존 잠금·검증 예산 운영 (`deploy-and-verification`)

이 저장소는 정적 웹 자동 배포(GitHub Pages)와 에지 API 수동 배포(Cloudflare Workers/D1)로 나뉘며, 단일 작업 폴더 다중 에이전트 규약과 Mac mini 자원 보호·검증 예산을 엄격히 따른다. 전체 실행 스크립트 목록은 [commands.md](../commands.md)에 정리되어 있다.

## 1. 운영 배포 절차 ([DEPLOY.md](../../docs/DEPLOY.md))

1. **정적 웹게임 (`voca.ssamuniverse.com`)**:
   - [.github/workflows/pages.yml](../../.github/workflows/pages.yml)이 `main` 브랜치 푸시 시 `npm ci` → 빌드 → GitHub Pages 배포를 수행한다.
   - **DNS 회색 구름(DNS only) 절대 유지 (`DEC-07` · `L-TD-201`)**: Cloudflare 주황 구름(Proxy)을 켜면 국내 학교망(KT 등) 트래픽이 미국으로 우회해 로딩이 느려지므로 반드시 회색 구름을 유지한다.
2. **기록·랭킹 서버 (`voca-api.ssamuniverse.com`)**:
   - 스키마 변경 시: `npm run server:db:remote`
   - 공개 문제은행 갱신 시(**정적 웹 배포보다 먼저!**): `npm run server:seed:remote`
   - Worker 배포: `npm run server:deploy` (사용자 확인 필요한 운영 반영)
3. **R6 시즌 2 (`2.0.0`) 운영 반영 절차 ([G5-server.md](../../docs/renewal/r6/tech/G5-server.md) · 아직 운영 미반영)**:
   - G5 통합 시험과 실기기 확인을 마친 뒤 **사용자 승인**을 받아 수업 외 시간(30분+ 확보)에 실행한다.
   - 순서: ① 접속 현황·D1 Time Travel 북마크·Worker/Pages 복구 지점 기록 → ② `npm run server:db:remote`(`0003`·`0004_ranking_seasons.sql` 적용) → ③ `2.0.0` 승인 조합 4행을 비활성(`active=0`) 상태로 먼저 시드 → ④ `npm run server:deploy` 후 `npm run server:seed:remote`로 승인 조합 활성화 → ⑤ `main` 빠른 전진·Pages 배포 후 시즌 1/2 분리 실확인. 이상 시 `submissions_open=0`으로 시즌 2 신규 제출만 일시 중지하거나 이전 Pages를 재배포한다.

## 2. 문서·원화 보존 잠금 (`W09` · [validate-plan.mjs](../../tools/validate-plan.mjs))

- **해시 고정 4종 (1바이트도 수정·이동 금지)**:
  - `docs/assets/design-41-kingdom-expedition.png`
  - `vocabulary_td_prd_claude_v0_1.md`, `vocabulary_td_prd_v0_3.md`, `vocabulary_td_prd_v0_4.md`
- **진입 문서 링크 불변식**: `README.md`, `docs/READ_FIRST.md`, `docs/HANDOFF.md` 3개 파일은 반드시 `vocabulary_td_prd_v0_5.md` 참조와 유효한 로컬 링크·짝수 코드 펜스(```` ``` ````)를 유지해야 한다.
- **주의 (`L-TD-203`)**: `npm run validate:plan`은 `docs/contracts/prd_v0_5_validation.json`을 다시 쓴다. 타인이 점유 중일 때는 읽기 전용 `npm run wiki:lint`(`W09`)로 확인한다.

## 3. R6 시험 명령 · 검증 예산 · `resource-guard`

- **범위 우선 검증**: 작업 중에는 바뀐 범위 시험(`npx vitest run <파일>`, `npm run typecheck`, `npm run lint`, `npm run wiki:check`)만 1회 실행하고 통과한 검사를 반복하지 않는다.
- **R6 전용 시험 명령**:
  - 저사양 자동 화질·W1~W10 CPU 6배/1배 성능 검증: `npm run test:r6-perf` ([G5-perf.md](../../docs/renewal/r6/tech/G5-perf.md), `resource-guard --profile test` 필수 · 학생 접속 0명 조건 권장)
  - 전장·VFX·통주 E2E: `npm run test:e2e -- tests/e2e/r6-battlefield.spec.ts tests/e2e/r6-vfx.spec.ts` (전체 통주는 `TOWER_R6_FULL_RUN=1` + `r6-full-run.spec.ts`)
  - 밸런스 v2 관문: `npm run simulate:gate -- --v2 --seeds 8`
- **고부하 명령 보호**: `npm run verify`, `npm run test:e2e`, `npm run test:r6-perf`, `npm run build`, `npm run simulate:gate`, Blender/Spine 대량 렌더는 `/Users/bodyking/.local/bin/resource-guard run --profile <test|build|avatar> --wait-seconds 900 -- <명령>`으로 감싼다(반환값 `75`는 자원 대기).
- **단일 폴더 부분 커밋**: `git worktree`와 `git add .`을 쓰지 않고 자기 파일만 `git commit --only -- <경로>`로 커밋한다. 종료 시 `agent-cleanup mine`으로 띄운 프로세스를 정리한다.
