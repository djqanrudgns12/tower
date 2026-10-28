# 현재 작업 게시판

기준일: 2026-10-28 · 현재 구간: **P1 첫 완성 구간 — 1차 작업 패키지 수합 완료, 문항 공동검수·리깅 대기** · 총괄: Claude Opus 5.5(Claude Code)

기준: `main`의 `bad6e76` 위에 수합 변경이 아직 커밋되지 않은 상태로 있다(이 작업 트리). READY인 QR-001·QR-002·RIG-001은 이 변경을 커밋한 뒤 그 commit을 `baseCommit`으로 작업 폴더를 만들어 발행한다. 붙여 넣을 프롬프트는 [발행용 프롬프트](work-packages/DISPATCH.md)에 있다.

| jobId | 상태 | 담당 | 소유 범위 | 선행 |
|---|---|---|---|---|
| CORE-P1 | 구현됨 · 독립 검토 반영 | 총괄 Claude | `src/domain/**`, `src/application/**`, `src/persistence/**`, 공유 계약 | — |
| [REVIEW-CORE-001](work-packages/REVIEW-CORE-001/RETURN.md) | **ACCEPTED** — 결함 10건 수정, 시험은 `tests/unit/review-core/` | Codex(검토 문맥) | `tests/review/**` | — |
| [UI-AUDIT-001](work-packages/UI-AUDIT-001/RETURN.md) | **ACCEPTED** — CSS 들임, 계약 변경 7건 반영(휴대폰 트레이 한 행은 §12.4대로 되돌림) | Argon 4 | `src/ui/**/*.module.css`(공통 제외) | — |
| [ART-SAMPLE-001](work-packages/ART-SAMPLE-001/RETURN.md) | **ACCEPTED** — 13장 `integrated_pass`, 대장 2·피격 1은 `visual_pass` 보류 | Codex 이미지 | `asset-source/incoming/ART-SAMPLE-001/**` | — |
| [Q20-001](work-packages/Q20-001/RETURN.md) | **RETURNED · 공동검수 대기** — 검사 통과, 정답 없는 입력 생성됨 | Argon 4 | `content-source/batches/Q20-001/**` | — |
| [QR-001/QR-002](work-packages/QR-001/REQUEST.md) | **READY**(커밋 후 발행) | Codex·Claude 새 문맥 | `content-source/reviews/Q20-001/*` | Q20-001 반환 ✓ |
| [RIG-001](work-packages/RIG-001/REQUEST.md) | **READY**(커밋 후 발행) | Claude 새 문맥 또는 Codex | `src/game/animation/**` | ART-SAMPLE-001 인수 ✓ |
| P1-REST | 진행 중 — A26 철회 목록 완료 | 총괄 | 연습 판·소리·설치 자리 목록·문맥 손실 | — |
| ART-002 | 계획 | Codex 이미지 | 지면·설치 돌·작은 장식(아직 임시 그림과 섞여 보임) | ART-SAMPLE-001 ✓ |
| CORE-P2 | 계획 | 다음 총괄(PRD 출발안: Claude) | 나머지 타워 7종·분기 14개·4~6학년 맵/은행 | G2 통과 |

READY 세 개는 소유 경로가 겹치지 않는다. QR-001·QR-002는 정답 키가 있는 `content-source/batches/**`를 뺀 작업 폴더에서 돌린다(발행용 프롬프트의 sparse checkout). 총괄만 공유 schema/package/lockfile/전역 토큰/라우터/인덱스를 수정한다. ACCEPTED는 총괄이 검사 후 부여한다.

1차 작업 폴더(`../tower-wp/{ART-SAMPLE-001,Q20-001,REVIEW-CORE-001,UI-AUDIT-001}`)는 결과를 본 저장소로 옮겼지만, 수합 변경이 커밋되기 전까지는 지우지 않는다.

측정된 성과(2026-10-28, 이 작업 트리): 타입·ESLint, 단위·속성 시험 61개, PRD 검산 48개, 문항·에셋 manifest 검사, Playwright e2e 4개(실제 원화 포함), 배포 빌드(JS gzip 약 501KB). 실기기·장시간 성능·엔진 밸런스·공동검수·리깅 인수·배포는 미실행. 최신 결과는 [인계서](HANDOFF.md)의 검증 절을 따른다.
