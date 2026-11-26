---
id: lessons-ops-and-workflow
type: lessons
title: 운영·워크플로 교훈 원장
status: active
updated: 2026-11-16
verified: { commit: "9424ff2c", date: 2026-11-26 }
sources:
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: server/wrangler.toml
    sha256: "630d680192e27718f41a94011e16707eaa30f36a976a4bc482aeb881b4f0271a"
  - path: tools/validate-plan.mjs
    sha256: "9335404b1bac48dccf79827a06dfcbf61ee4ba9b00824559507710b93ea192d9"
---

# 운영·워크플로 교훈 원장 (`201` ~ `299`)

> 새 교훈이나 위반 카운터는 직접 편집하지 않고 `npm run wiki:delta`로 제출한 뒤 `npm run wiki:curate`로 병합합니다.

## 수록 교훈

### L-TD-201 · `voca.ssamuniverse.com` DNS는 반드시 Cloudflare 회색 구름(DNS only) 유지
- **언제**: 도메인 DNS 레코드나 정적 호스팅(GitHub Pages) 설정을 점검·변경할 때
- **규칙**: 정적 웹 도메인 `voca.ssamuniverse.com`은 Cloudflare 프록시(주황 구름)를 켜지 않고 반드시 **회색 구름(DNS only)**으로 유지한다.
- **왜**: 무료 요금제에서 주황 구름을 켜면 국내 학교망(KT 등) 트래픽이 미국 에지로 우회되어 교실 환경에서 초기 에셋 로딩이 심각하게 지연된다.
- **검사**: `dig voca.ssamuniverse.com`이 GitHub Pages IP를 직접 반환하는지 확인
- **단계**: L2 (`docs/DEPLOY.md` 운영 수칙 고정)
- **카운터**: 적중 2 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-05 · 확인 2026-11-16
- **태그**: `deploy`, `dns`
- **근거**: [DEPLOY.md](../../docs/DEPLOY.md)

### L-TD-202 · 기록·랭킹 Worker는 `workers_dev = false`로 우회 경로 원천 차단
- **언제**: `server/wrangler.toml`이나 Cloudflare Workers 라우팅·CORS·캐시 설정을 수정할 때
- **규칙**: `workers_dev = false`와 `ALLOWED_ORIGINS` 제한을 항상 유지하고 사용자 지정 도메인(`voca-api.ssamuniverse.com`) 단일 진입점만 열어 둔다.
- **왜**: 기본 `*.workers.dev` 주소가 열려 있으면 도메인에 설정된 WAF 규칙과 60초 에지 랭킹 캐시를 우회해 D1 읽기 한도를 소진시킬 수 있다.
- **검사**: `npm run test:server` 및 `server/wrangler.toml` 설정 확인
- **단계**: L3 (`server/wrangler.toml` 및 서버 시험 고정)
- **카운터**: 적중 1 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-05 · 확인 2026-11-16
- **태그**: `server`, `deploy`
- **근거**: [wrangler.toml](../../server/wrangler.toml)

### L-TD-203 · 단일 폴더 다중 에이전트 작업 시 타인 미커밋 파일 보존 및 `--only` 커밋
- **언제**: 같은 작업 트리에서 다른 에이전트의 미커밋·스테이지 변경(예: `prd_v0_5_validation.json`, `src/ui/**`)이 공존할 때
- **규칙**: `git restore`, `git add .`을 절대 쓰지 않고 내 파일만 `git commit --only -- <경로>`로 커밋하며, 타인이 점유 중인 `prd_v0_5_validation.json`을 덮어쓰는 `validate:plan` 대신 읽기 전용 `npm run wiki:lint`(`W09`)를 사용한다.
- **왜**: 단일 폴더 체제에서 전체 스테이징이나 부수 파일 덮어쓰기 도구를 돌리면 동시에 일하는 동료 에이전트의 진행분과 섞이거나 변경이 유실된다.
- **검사**: 커밋 전후 `git status --short` 대조 및 `npm run wiki:check`
- **단계**: L4 (`AGENTS.md` 규칙 및 `tools/wiki/hooks/run-hook.mjs` 보호)
- **카운터**: 적중 2 · 위반 0 · 오탐 0
- **날짜**: 최초 2026-11-04 · 확인 2026-11-16
- **태그**: `git`, `verification`, `wiki`
- **근거**: [AGENTS.md](../../AGENTS.md)
