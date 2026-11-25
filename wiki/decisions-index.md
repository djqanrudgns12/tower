---
id: wiki-decisions-index
type: registry
title: 핵심 의사결정 색인
status: active
generated_by: tools/wiki/gen.mjs
---

# 핵심 의사결정 색인 (`decisions-index`)

> 이 파일은 `npm run wiki:sync` (`tools/wiki/gen.mjs`)가 코드·계약 JSON·SQL에서 결정적으로 자동 생성합니다. 직접 수정하지 마세요.

> 이 저장소는 단일 ADR 파일 대신 `AGENTS.md`, `docs/renewal/README.md`, `docs/style-lock-v1.md`, `docs/DEPLOY.md`, `docs/CR1000_HANDOFF.md`에 도메인별 확정 결정이 분산되어 있습니다. 아래 색인이 각 원본의 정확한 줄 번호를 자동 추적합니다.

| ID | 영역 | 상태 | 결정 제목 | 핵심 규칙 요약 | 근거 위치 |
| --- | --- | --- | --- | --- | --- |
| `DEC-01` | 작업 폴더·Git | 확정 (2026-11-04) | **단일 작업 폴더 운영 및 worktree 격리 폐기** | `towerdeffense` 단일 폴더에서만 작업하며 별도 worktree·복사본을 만들지 않는다. 커밋은 자기 파일만 경로를 지정해 수행한다. | [AGENTS.md#L13](../AGENTS.md#L13) |
| `DEC-02` | 문서 우선순위 | 확정 (2026-10-30) | **리뉴얼 헌장(`docs/renewal/**`) 우선 적용** | 타워 20종·Lv4/Lv7 진화·종족 몬스터·전투 UI 완화는 `docs/renewal/`이 PRD v0.5보다 우선한다. | [docs/renewal/README.md#L5](../docs/renewal/README.md#L5) |
| `DEC-03` | 화풍·시각 | 확정 (2026-10-28) | **41번 「왕국 원정대」 화풍 잠금 및 AI slop 차단** | `docs/assets/design-41-kingdom-expedition.png` 해시를 기준선으로 고정하고 32/48/64px 가독성과 알파 테두리를 검증한다. | [docs/style-lock-v1.md#L3](../docs/style-lock-v1.md#L3) |
| `DEC-04` | 게임 규칙 | 확정 (2026-10-28) | **‘모르겠어요’ 0점·한국어 난이도·배속 없음·HP 성장 115%** | 모르겠어요는 PT 0·골드 0, 난이도 표시는 쉬움/보통/어려움/아주 어려움, 전투 배속 없음, 웨이브 HP 성장률 115%로 고정한다. | [vocabulary_td_prd_v0_5.md#L283](../vocabulary_td_prd_v0_5.md#L283) |
| `DEC-05` | 도메인 엔진 | 확정 | **30Hz 고정 틱 · 시드 PRNG 전용 · 이어하기 없음** | `RunController`가 유일한 상태 작성자이며 `Math.random`을 금지한다. 진행 중 창을 닫으면 기록 없이 폐기하고 완주/패배만 기록한다. | [src/application/RunController.ts#L27](../src/application/RunController.ts#L27) |
| `DEC-06` | 원화·성능 | 확정 (2026-11-05) | **인게임 그림 전면 WebP 전환 및 선택 맵 지연 적재** | `public/assets/**`는 `cwebp -q 85 -alpha_q 100 -m 6` WebP로 넣고 알파 경계 상자를 보존해 첫 전투 전 전송량을 약 3MB로 줄인다. | [docs/HOSTING_IMPL_PLAN.md#L50](../docs/HOSTING_IMPL_PLAN.md#L50) |
| `DEC-07` | 호스팅·배포 | 확정 (2026-11-05) | **GitHub Pages(회색 구름 DNS) + Cloudflare Workers/D1 분리 아키텍처** | 정적 게임(`voca.ssamuniverse.com`)은 KT 학교망 우회를 막기 위해 Cloudflare 프록시 없는 GitHub Pages로, 기록·랭킹 API(`voca-api.ssamuniverse.com`)는 Workers+D1 APAC으로 운영한다. | [docs/DEPLOY.md#L11](../docs/DEPLOY.md#L11) |
| `DEC-08` | 보안·랭킹 | 확정 (2026-11-05) | **`workers.dev` 비활성화 · `PLAYER_SALT` 단일 비밀값 · `standings` 사전 집계** | WAF와 거점 캐시 우회를 막기 위해 사용자 지정 도메인만 허용하고, 서버 재채점(`question_regraded_combat_bounded`) 통과 판만 `standings` 집계표에 반영한다. | [server/wrangler.toml#L13](../server/wrangler.toml#L13) |
| `DEC-09` | 문제은행 검수 | 확정 (2026-11-06~09) | **CR-1000 다중 모델 블라인드 공동검수 및 `commit-lock` 원자적 반영** | `codex-argon-v1` 및 `claude-argon-v1` 정책으로 3~6학년 자기 학년 각 1,000문항 이상과 Normal 심화 150+ 바닥을 달성했으며, 콘텐츠 경로는 반드시 `commit-lock.mjs` 안에서만 수정한다. | [docs/CR1000_HANDOFF.md#L7](../docs/CR1000_HANDOFF.md#L7) |
| `DEC-10` | UI 보존 | 확정 (2026-11-04) | **사용자가 다듬은 화면·기능(통합 수호 랭킹 등) 임의 교체 금지** | 기존 화면이나 기능을 통째로 걷어내는 리뉴얼·삭제는 반드시 사용자 확인 뒤에 수행한다. | [AGENTS.md#L43](../AGENTS.md#L43) |
