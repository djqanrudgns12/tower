# 작업 패키지

P1 첫 구현(2026-10-28, 총괄 Claude Opus 5.5) 뒤 병렬로 맡길 일이다. 각 폴더의 `REQUEST.md`를 그대로 해당 모델에 전달하고, 결과는 같은 폴더의 `RETURN.md`와 허용 경로의 파일로 받는다. 상태는 [작업 게시판](../EXECUTION_BOARD.md)이 기준이다. READY 네 개는 발행 준비를 마쳤고(머리말 채움·작업 폴더 생성), 붙여 넣을 프롬프트는 [DISPATCH.md](DISPATCH.md)에 있다. 아직 어느 것도 보내지 않았다.

| jobId | 담당 | 상태 | 선행 | 소유 경로 |
|---|---|---|---|---|
| [ART-SAMPLE-001](ART-SAMPLE-001/REQUEST.md) | Codex 이미지 | READY | 없음 | `asset-source/incoming/ART-SAMPLE-001/**` |
| [Q20-001](Q20-001/REQUEST.md) | Argon 4 | READY | 없음 | `content-source/batches/Q20-001/**` |
| [UI-AUDIT-001](UI-AUDIT-001/REQUEST.md) | Argon 4 | READY | 없음 | `src/ui/**/*.module.css`(공통 제외) |
| [REVIEW-CORE-001](REVIEW-CORE-001/REQUEST.md) | Codex 검토 | READY | 없음 | `tests/review/**` |
| [QR-001/QR-002](QR-001/REQUEST.md) | Codex·Claude 검토 | HOLD | Q20-001 반환 | `content-source/reviews/Q20-001/*` |
| [RIG-001](RIG-001/REQUEST.md) | Claude/Codex | HOLD | ART-SAMPLE-001 인수 | `src/game/animation/**` |

READY 네 개는 소유 경로가 겹치지 않아 **동시에** 보낼 수 있다. Argon에게 두 개를 줄 때는 서로 다른 대화로 보낸다.

## 발행 순서

1. 현재 변경을 커밋하고 `git rev-parse HEAD`를 REQUEST의 `baseCommit`에 적는다.
2. `node tools/contract-hash.mjs <jobId>`로 입력 계약 해시를 찍어 REQUEST 머리말에 붙인다(inputFiles에 없는 파일이 있으면 도구가 실패한다).
3. 작업마다 `git worktree add -b wp/<jobId> ../tower-wp/<jobId> <baseCommit>`로 전용 폴더를 만들고 채운 REQUEST.md를 복사한다. 한 폴더를 같이 쓰면 미완성 문항·원화가 다른 작업의 `npm test`를 깨뜨리고, e2e가 남의 5173 서버를 재사용한다. 작업 폴더와 `wp/*` 브랜치는 GitHub에 올라가지 않으므로 모델을 돌릴 컴퓨터에서 만든다. Windows에서는 먼저 `git config core.autocrlf input`을 해 둔다. 그러지 않으면 `.ts`가 CRLF로 풀려 contractHash가 맞지 않는다.
4. 게시판에서 상태를 RUNNING으로 바꾸고 담당·발행 시각을 적는다(실제로 보낸 것만).

## 받을 때(총괄)

- 허용 경로 밖 변경은 버리고 `REQUESTED_CONTRACT_CHANGE`만 검토한다.
- 문항: `npm run validate:content` → `npm run blind-input -- Q20-001` → QR 발행.
- 원화: `npm run validate:assets` → 실제 셀 배율·41번 나란히 비교(PRD §17.5 V06·V09) → 통과 항목만 `status: integrated_pass`로 바꿔 `public/assets/`로 옮긴다. 그 순간부터 게임이 PNG를 쓴다.
- 검토: `tests/review`의 실패 시험을 하나씩 고치고 통과하면 `tests/unit`으로 옮긴다.
- ACCEPTED는 총괄만 붙인다.
