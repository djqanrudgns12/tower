# 현재 작업 게시판

기준일: 2026-10-28 · 현재 구간: **P1 첫 완성 구간 — 1차 작업 패키지 수합 완료, 문항 공동검수·리깅 대기** · 총괄: Claude Opus 5.5(Claude Code)

기준: 브랜치 `p1/intake-round1`(origin에 push함, `main`에는 아직 병합 안 함). 1차 수합은 `bc3ee07`. READY인 QR-001·QR-002·RIG-001은 `bc3ee07`을 `baseCommit`으로 머리말을 채워 커밋했다. 작업 폴더(`../tower-wp/<jobId>`)는 Windows PC에만 만들어 두었고, 집 Mac에서는 [발행용 프롬프트](work-packages/DISPATCH.md) 2차 절의 명령으로 새로 만든다. 아직 어느 모델에도 보내지 않았다. 붙여 넣을 프롬프트는 [발행용 프롬프트](work-packages/DISPATCH.md)에 있다.

| jobId | 상태 | 담당 | 소유 범위 | 선행 |
|---|---|---|---|---|
| CORE-P1 | 구현됨 · 독립 검토 반영 | 총괄 Claude | `src/domain/**`, `src/application/**`, `src/persistence/**`, 공유 계약 | — |
| [REVIEW-CORE-001](work-packages/REVIEW-CORE-001/RETURN.md) | **ACCEPTED** — 결함 10건 수정, 시험은 `tests/unit/review-core/` | Codex(검토 문맥) | `tests/review/**` | — |
| [UI-AUDIT-001](work-packages/UI-AUDIT-001/RETURN.md) | **ACCEPTED** — CSS 들임, 계약 변경 7건 반영(휴대폰 트레이 한 행은 §12.4대로 되돌림) | Argon 4 | `src/ui/**/*.module.css`(공통 제외) | — |
| [ART-SAMPLE-001](work-packages/ART-SAMPLE-001/RETURN.md) | **ACCEPTED** — 13장 `integrated_pass`, 대장 2·피격 1은 `visual_pass` 보류 | Codex 이미지 | `asset-source/incoming/ART-SAMPLE-001/**` | — |
| [Q20-001](work-packages/Q20-001/RETURN.md) | **RETURNED · 공동검수 대기** — 검사 통과, 정답 없는 입력 생성됨 | Argon 4 | `content-source/batches/Q20-001/**` | — |
| [QR-001/QR-002](work-packages/QR-001/REQUEST.md) | **READY·발행 준비됨** | Codex·Claude 새 문맥 | `content-source/reviews/Q20-001/*` | Q20-001 반환 ✓ |
| [RIG-001](work-packages/RIG-001/REQUEST.md) | **READY·발행 준비됨** | Claude 새 문맥 또는 Codex | `src/game/animation/**` | ART-SAMPLE-001 인수 ✓ |
| P1-REST | 소리만 남음 — A26 철회 목록·설치 자리 목록·문맥 손실 복구·첫 연습 판 완료 | 총괄 | 소리(음원 작업 필요) | 음원 묶음 |
| QR-PRACTICE | 계획 | Codex·Claude 검토 | 연습 전용 4문항(`src/content/questions/practice.json`) 공동검수 | 공개 전 |
| ART-002 | 계획 | Codex 이미지 | 지면·설치 돌·작은 장식(아직 임시 그림과 섞여 보임) | ART-SAMPLE-001 ✓ |
| CORE-P2 | 계획 | 다음 총괄(PRD 출발안: Claude) | 나머지 타워 7종·분기 14개·4~6학년 맵/은행 | G2 통과 |

READY 세 개는 소유 경로가 겹치지 않는다. QR-001·QR-002는 정답 키가 있는 `content-source/batches/**`를 뺀 작업 폴더에서 돌린다(발행용 프롬프트의 sparse checkout). 총괄만 공유 schema/package/lockfile/전역 토큰/라우터/인덱스를 수정한다. ACCEPTED는 총괄이 검사 후 부여한다.

1차 작업 폴더와 `wp/*` 브랜치는 반환물이 본 저장소와 같음을 확인한 뒤 지웠다. UI-AUDIT-001의 전후 캡처와 원래 CSS 패치는 [UI-AUDIT-001 폴더](work-packages/UI-AUDIT-001/)의 `shots/`·`returned-css.patch`로 보존했다. RIG-001이 도는 동안 총괄은 `src/game/animation/**`를 고치지 않는다.

측정된 성과(2026-10-28, 이 작업 트리): 타입·ESLint, 단위·속성 시험 70개, PRD 검산 48개, 문항·에셋 manifest 검사, Playwright e2e 7개(실제 원화·키보드·문맥 손실·연습 판 포함), 배포 빌드(JS gzip 약 504KB). 실기기·장시간 성능·엔진 밸런스·공동검수·리깅 인수·배포는 미실행. 최신 결과는 [인계서](HANDOFF.md)의 검증 절을 따른다.
