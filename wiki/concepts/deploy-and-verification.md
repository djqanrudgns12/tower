---
id: hub-deploy-and-verification
type: hub
title: 배포·보존 잠금·검증 예산 운영
status: active
updated: 2026-11-16
verified: { commit: e22ff57f, date: 2026-11-16 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: package.json
    sha256: a30c5cbd4a9e080a26987cc63f28b2a5dc928c404a7f96f392bc94209d441fe6
  - path: .github/workflows/pages.yml
    sha256: "3d661834606ab2b66da309cbf8d8968032333e6ae8d6a708848c18bf3182459e"
  - path: docs/DEPLOY.md
    sha256: "4697485dc76d7c4e3b7ba2b00bedd31373fd3d13892905314a0bc294db9d43d1"
  - path: tools/validate-plan.mjs
    sha256: "9335404b1bac48dccf79827a06dfcbf61ee4ba9b00824559507710b93ea192d9"
---

# 배포·보존 잠금·검증 예산 운영 (`deploy-and-verification`)

이 저장소는 정적 웹 자동 배포(GitHub Pages)와 에지 API 수동 배포(Cloudflare Workers/D1)로 나뉘며, 단일 작업 폴더 다중 에이전트 규약과 Mac mini 자원 보호·검증 예산을 엄격히 따른다. 전체 실행 스크립트 목록은 [commands.md](../commands.md)에 정리되어 있다.

## 1. 운영 배포 절차 ([DEPLOY.md](../../docs/DEPLOY.md))

1. **정적 웹게임 (`voca.ssamuniverse.com`)**:
   - [.github/workflows/pages.yml](../../.github/workflows/pages.yml)이 배포 브랜치 푸시 시 `npm ci` → 빌드 → GitHub Pages 배포를 수행한다.
   - **DNS 회색 구름(DNS only) 절대 유지 (`DEC-07` · `L-TD-201`)**: Cloudflare 주황 구름(Proxy)을 켜면 한국 학교망(KT 등) 트래픽이 미국 거점으로 우회해 에셋 로딩이 급격히 느려지므로 반드시 회색 구름을 유지한다.
2. **기록·랭킹 서버 (`voca-api.ssamuniverse.com`)**:
   - 스키마 변경 시: `npm run server:db:remote`
   - 공개 문제은행 갱신 시(**정적 웹 배포보다 먼저!**): `npm run server:seed:remote`
   - Worker 코드 배포: `npm run server:deploy` (사용자 확인 필요한 운영 반영)

## 2. 문서·원화 보존 잠금 (`W09` · [validate-plan.mjs](../../tools/validate-plan.mjs))

- **해시 고정 4종 (1바이트도 수정·이동 금지)**:
  - `docs/assets/design-41-kingdom-expedition.png`
  - `vocabulary_td_prd_claude_v0_1.md`, `vocabulary_td_prd_v0_3.md`, `vocabulary_td_prd_v0_4.md`
- **진입 문서 링크 불변식**: `README.md`, `docs/READ_FIRST.md`, `docs/HANDOFF.md` 3개 파일은 반드시 `vocabulary_td_prd_v0_5.md` 문자열 참조와 유효한 로컬 링크·짝수 코드 펜스(```` ``` ````)를 유지해야 한다.
- **주의 (`L-TD-203`)**: `npm run validate:plan`은 실행 시 `docs/contracts/prd_v0_5_validation.json`을 다시 쓴다. 다른 에이전트가 해당 파일을 미커밋 상태로 점유 중일 때는 덮어쓰지 않도록 읽기 전용 동등 검사인 `npm run wiki:lint`(`W09`)로 먼저 확인한다.

## 3. 검증 예산 및 Mac mini `resource-guard`

- **범위 우선 검증**: 작업 중에는 바뀐 범위 시험(`npx vitest run <파일>`, `npm run typecheck`, `npm run lint`, `npm run wiki:check`)만 1회 실행하고, 통과한 검사를 반복 실행하지 않는다.
- **고부하 명령 보호**: 전체 시험(`npm run verify`, `npm run test:e2e`), 제품 빌드(`npm run build`), 관문 시뮬레이션(`npm run simulate:gate`)을 새로 띄울 때는 `/Users/bodyking/.local/bin/resource-guard run --profile test|build -- <명령>`으로 감싼다(반환값 `75`는 자원 대기이므로 시험 실패로 오판하지 않는다).
- **단일 폴더 부분 커밋**: `git worktree`와 `git add .`을 쓰지 않고, 내가 고친 경로만 `git commit --only -- <경로>`로 커밋한다. 작업 종료 시 `agent-cleanup mine`으로 내가 띄운 프로세스를 정리한다.
