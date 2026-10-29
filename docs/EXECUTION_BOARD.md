# 현재 작업 게시판

기준일: 2026-10-29 · 현재 구간: **P1 첫 완성 구간 — 3학년 공개 문제은행 51문항(P1 목표 30~50 충족), 원화 27장, 소리, G2 시험 통과(실기기 제외)** · 총괄: Claude Opus 5.5(Claude Code)

기준: 브랜치 `p1/intake-round1`(origin에 push함, `main`에는 아직 병합 안 함). 1차 수합은 `bc3ee07`, 밸런스 `0.4-candidate`는 `ea7ffe4`. 2차(QR-001·QR-002·RIG-001)는 집 Mac 작업 폴더(`bc3ee07`)에서 돌았고 2026-10-29 수합했다. 3차 ART-002는 `ea7ffe4`를 `baseCommit`으로 요청서를 쓰고 집 Mac에 작업 폴더를 만들었다(요청서는 2차 수합 커밋에 들어갔고, 작업 폴더에는 복사본을 둠). 붙여 넣을 프롬프트는 [발행용 프롬프트](work-packages/DISPATCH.md)에 있다.

| jobId | 상태 | 담당 | 소유 범위 | 선행 |
|---|---|---|---|---|
| CORE-P1 | 구현됨 · 독립 검토 반영 | 총괄 Claude | `src/domain/**`, `src/application/**`, `src/persistence/**`, 공유 계약 | — |
| [REVIEW-CORE-001](work-packages/REVIEW-CORE-001/RETURN.md) | **ACCEPTED** — 결함 10건 수정, 시험은 `tests/unit/review-core/` | Codex(검토 문맥) | `tests/review/**` | — |
| [UI-AUDIT-001](work-packages/UI-AUDIT-001/RETURN.md) | **ACCEPTED** — CSS 들임, 계약 변경 7건 반영(휴대폰 트레이 한 행은 §12.4대로 되돌림) | Argon 4 | `src/ui/**/*.module.css`(공통 제외) | — |
| [ART-SAMPLE-001](work-packages/ART-SAMPLE-001/RETURN.md) | **ACCEPTED** — 13장 `integrated_pass`, 대장 2·피격 1은 `visual_pass` 보류 | Codex 이미지 | `asset-source/incoming/ART-SAMPLE-001/**` | — |
| [Q20-001](work-packages/Q20-001/RETURN.md) | **RETURNED · 공동검수 대기** — 검사 통과, 정답 없는 입력 생성됨 | Argon 4 | `content-source/batches/Q20-001/**` | — |
| [QR-001/QR-002](work-packages/QR-001/REQUEST.md) | **ACCEPTED** — 독립 풀이 40/40이 정답과 같음. 총괄 해설 대조를 더해 승인 14·격리 6(`content-source/approvals/registry.json`, PRD §18.4) | Codex·Claude 새 문맥 | `content-source/reviews/Q20-001/*` | Q20-001 반환 ✓ |
| [RIG-001](work-packages/RIG-001/RETURN.md) | **ACCEPTED** — 3파일 들임, 렌더러 연결 4건은 총괄이 반영, `enemy.walker.hit` `integrated_pass`(1440×900 전투 캡처로 확인) | Claude 새 문맥 또는 Codex | `src/game/animation/**` | ART-SAMPLE-001 인수 ✓ |
| [Q20-002](work-packages/Q20-002/RETURN.md) | **ACCEPTED** — 20문항 중 승인 17(새 14 전부, 고친 판 0011·0013·0017), 격리 3(고친 판 0004·0006·0015: Codex language·grade uncertain) | Argon 4 | `content-source/batches/Q20-002/**` — 격리 6문항 revision 2 + 새 문항 14개. 공개 은행에 승인 16문항 이상이 더 필요 | QR 수합 ✓ |
| [QR-003/QR-004](work-packages/QR-003/RETURN.md) | **ACCEPTED** — 독립 풀이 40/40 정답과 같음. Codex fail 0·uncertain 3, Claude fail 0·uncertain 0. 총괄 해설 대조 20/20 pass. 결과: **승인 31 → 첫 공개 은행 `src/content/questions/grade3.json`(`pub-b95a56e39f57`)** | Codex·Claude | `content-source/reviews/Q20-002/{codex,claude}.json` | Q20-002 수합 ✓ |
| [Q20-003](work-packages/Q20-003/RETURN.md) | **ACCEPTED** — 20문항 모두 승인(마지막 수정 3 + 새 17). Argon은 브리지로 두 번, 셸 없이 파일만 썼고(근거는 총괄 `fetch-evidence`), 검사는 총괄이 돌림 | Argon 4 | `content-source/batches/Q20-003/**` | QR-003 ✓ |
| [QR-005/QR-006](work-packages/QR-005/RETURN.md) | **ACCEPTED** — 독립 풀이 40/40 정답과 같음, Codex·Claude 모두 fail·uncertain 0. 총괄 해설 대조 20/20. **공개 은행 51문항(`pub-965fc76be294`)** | Codex·Claude | `content-source/reviews/Q20-003/{codex,claude}.json` | Q20-003 수합 ✓ |
| P1-REST | **완료** — A26 철회 목록·설치 자리 목록·문맥 손실 복구·첫 연습 판에 이어 소리(2026-10-29, WebAudio 합성, `src/ui/audio/sound.ts`) | 총괄 | 제작 음원으로 바꾸는 일은 공개 전 별도 작업 | — |
| QR-PRACTICE | 계획 | Codex·Claude 검토 | 연습 전용 4문항(`src/content/questions/practice.json`) 공동검수 | 공개 전 |
| [ART-002](work-packages/ART-002/RETURN.md) | **ACCEPTED** — 11장 HOLD 0, 실제 전투(1440×900)에서 지면 조립으로 확인해 모두 `integrated_pass`. 총괄이 agent-bridge로 Codex에 세 번 나눠 전달(15분 상한) | Codex 이미지 | `asset-source/incoming/ART-002/**` — 정원 지면 질감·설치 받침·작은 장식 11장 | ART-SAMPLE-001 ✓ |
| CORE-P2 | 계획 | 다음 총괄(PRD 출발안: Claude) | 나머지 타워 7종·분기 14개·4~6학년 맵/은행 | G2 통과 |

Q20-002의 소유 경로(`content-source/batches/Q20-002/**`)는 ART-002와 겹치지 않는다. 반환되면 QR(Codex·Claude)을 다시 돌린다. ART-002의 소유 경로(`asset-source/incoming/ART-002/**`)는 2차 수합 대상(`src/game/animation/**`, `content-source/reviews/**`)이나 총괄이 수합 때 고칠 렌더러(`src/game/**`)와 겹치지 않는다. QR-001·QR-002는 정답 키가 있는 `content-source/batches/**`를 뺀 작업 폴더에서 돌린다(발행용 프롬프트의 sparse checkout). 총괄만 공유 schema/package/lockfile/전역 토큰/라우터/인덱스를 수정한다. ACCEPTED는 총괄이 검사 후 부여한다.

1차 작업 폴더와 `wp/*` 브랜치는 반환물이 본 저장소와 같음을 확인한 뒤 지웠다. UI-AUDIT-001의 전후 캡처와 원래 CSS 패치는 [UI-AUDIT-001 폴더](work-packages/UI-AUDIT-001/)의 `shots/`·`returned-css.patch`로 보존했다. RIG-001이 도는 동안 총괄은 `src/game/animation/**`를 고치지 않는다.

측정된 성과(2026-10-29, 이 작업 트리): `npm run verify`(타입·ESLint, 단위·속성 시험, PRD 검산 48개, 문항·에셋 manifest 검사, 승인 레지스트리 재계산 대조), Playwright e2e 7개(실제 원화·키보드·문맥 손실·연습 판 포함), 1440×900 실제 전투 연속 캡처(보행·피격·감속). 배포 빌드는 2026-10-28 결과(JS gzip 약 504KB)이고 이번에는 다시 돌리지 않았다. 실기기·장시간 성능·학생 실측·배포는 미실행. 최신 결과는 [인계서](HANDOFF.md)의 검증 절을 따른다.
