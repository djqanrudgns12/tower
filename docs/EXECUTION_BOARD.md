# 현재 작업 게시판

기준일: 2026-10-28 · 현재 구간: **P1 첫 완성 구간 — 구현됨, 독립 검토·원화·검수 문항 대기** · 총괄: Claude Opus 5.5(Claude Code)

기준: docs/prd-v0-5 브랜치. P1 구현은 `9634d00` 다음 commit에 들어 있다(`git log -1 --format=%h -- src`). READY 네 개는 `baseCommit` `ee58338`과 입력 해시를 머리말에 채웠고, 작업마다 전용 작업 폴더(`../tower-wp/<jobId>`, 브랜치 `wp/<jobId>`)를 만들어 두었다. 붙여 넣을 프롬프트는 [발행용 프롬프트](work-packages/DISPATCH.md)에 있다. 아직 아무것도 외부 모델에 보내지 않았다.

| jobId | 상태 | 담당 | 소유 범위 | 선행 |
|---|---|---|---|---|
| CORE-P1 | 구현됨 · 독립 검토 대기 | 총괄 Claude | `src/domain/**`, `src/application/**`, `src/persistence/**`, 공유 계약 | — |
| [REVIEW-CORE-001](work-packages/REVIEW-CORE-001/REQUEST.md) | READY·발행 준비됨 | Codex(검토 문맥) | `tests/review/**` | — |
| [ART-SAMPLE-001](work-packages/ART-SAMPLE-001/REQUEST.md) | READY·발행 준비됨 | Codex 이미지 | `asset-source/incoming/ART-SAMPLE-001/**` | — |
| [Q20-001](work-packages/Q20-001/REQUEST.md) | READY·발행 준비됨 | Argon 4 | `content-source/batches/Q20-001/**` | — |
| [UI-AUDIT-001](work-packages/UI-AUDIT-001/REQUEST.md) | READY·발행 준비됨 | Argon 4 | `src/ui/**/*.module.css`(공통 제외) | — |
| [QR-001/QR-002](work-packages/QR-001/REQUEST.md) | HOLD | Codex·Claude 새 문맥 | `content-source/reviews/Q20-001/*` | Q20-001 반환 |
| [RIG-001](work-packages/RIG-001/REQUEST.md) | HOLD | Claude/Codex | `src/game/animation/**` | ART-SAMPLE-001 인수 |
| P1-REST | READY | 총괄 | 연습 판·소리·설치 자리 목록·문맥 손실·철회 목록 | 위 검토 반영 |
| CORE-P2 | 계획 | 다음 총괄(PRD 출발안: Claude) | 나머지 타워 7종·분기 14개·4~6학년 맵/은행 | G2 통과 |

READY 네 개(REVIEW-CORE-001, ART-SAMPLE-001, Q20-001, UI-AUDIT-001)는 소유 경로가 겹치지 않고 서로 다른 작업 폴더에서 돌아 동시에 보낼 수 있다. 그동안 총괄은 이들의 소유 경로(특히 `src/ui/**/*.module.css`)를 고치지 않는다. 총괄만 공유 schema/package/lockfile/전역 토큰/라우터/인덱스를 수정한다. ACCEPTED는 총괄이 검사 후 부여한다.

측정된 성과(2026-10-28, 이 작업 트리): 도메인·콘텐츠 단위·속성 시험, Playwright e2e 4개(1440×900 한 판 흐름·정지 가림, 390×844 넘침·확대, 1366×650 R 모드, axe 0건), 배포 빌드 성공(JS gzip 약 494KB). 실기기·장시간 성능·엔진 밸런스·실제 원화·공동검수·배포는 미실행. 최신 결과는 [인계서](HANDOFF.md)의 검증 절을 따른다.
