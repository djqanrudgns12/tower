# 다음 총괄·다음 컴퓨터 인계

기준일: 2026-10-28 · 현재 구간: **P1 첫 완성 구간 — 1차 작업 패키지 수합, P1-REST(소리 제외) 완료, 2차 작업 발행 대기** · 총괄: Claude Opus 5.5(Claude Code, Windows PC) · 다음 작업 장소: 집 Mac

## 집 Mac에서 처음 할 일

작업은 GitHub의 브랜치 **`p1/intake-round1`**에 push되어 있다. `main`은 아직 `bad6e76`(이 구간 이전)이며 병합하지 않았다.

```bash
cd /Users/bodyking/Desktop/vibecoding/towerdeffense
git status --short          # 비어 있어야 한다. 무언가 있으면 먼저 확인한다.
git fetch origin
git switch p1/intake-round1 # 처음이면 origin/p1/intake-round1을 따라가는 로컬 브랜치가 생긴다
git pull --ff-only
npm ci
npx playwright install chromium
npm run verify              # 타입·ESLint·단위 70개·PRD 검산·문항 검사
```

Node 24(`.node-version`). 브라우저 흐름까지 보려면 `npm run test:e2e`(7개, 약 2분, 5173 포트가 비어 있어야 한다).

## 먼저 읽을 것

1. 이 인계서.
2. [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md) — §18.4 P1 구현·수합·P1-REST 기록, 확정 결정은 §0.2.
3. [작업 게시판](EXECUTION_BOARD.md), [작업 패키지](work-packages/README.md), [발행용 프롬프트](work-packages/DISPATCH.md).
4. [README](../README.md) — 실행·검사 명령과 모듈 경계.

## 지금 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| P1 엔진·화면·저장 | 구현됨, 독립 검토 결함 10건 수정 | [REVIEW-CORE-001 반환](work-packages/REVIEW-CORE-001/RETURN.md), `tests/unit/review-core/` |
| UI 보정 | 들임 + 계약 변경 7건 반영 | [UI-AUDIT-001 반환](work-packages/UI-AUDIT-001/RETURN.md), 전후 캡처 `docs/work-packages/UI-AUDIT-001/shots/` |
| 원화 | 16장 중 13장 게임 적용(`integrated_pass`), 대장 2·피격 1 보류(`visual_pass`) | [ART-SAMPLE-001 반환](work-packages/ART-SAMPLE-001/RETURN.md), `public/assets/manifest.json`의 `notes` |
| 3학년 문항 20개(Argon) | 검사 통과, 공동검수 대기. 게임 은행에는 아직 없음 | [Q20-001 반환](work-packages/Q20-001/RETURN.md), 정답 없는 입력 `content-source/reviews/Q20-001/blind-input.json` |
| A26 철회 목록 | 완료 | `src/content/retractions.json` |
| 설치 자리 목록·전장 키보드(§12.4) | 완료 | `src/ui/game/SlotList.tsx` |
| WebGL 문맥 손실 복구(§12.7) | 완료 | `RunController.rendererLost/rendererRestored` |
| 첫 연습 판(§12.2) | 완료. 연습 전용 4문항은 공동검수 전 | `practiceContext`, `src/content/questions/practice.json` |
| 소리 | 미착수(음원 작업을 먼저 정해야 함) | PRD §11.5 |
| 2차 작업 QR-001·QR-002·RIG-001 | **READY, 아직 아무 모델에도 보내지 않음** | [발행용 프롬프트](work-packages/DISPATCH.md) 2차 절 |

이 구간의 커밋(`bad6e76` 다음, 모두 `p1/intake-round1`):

| commit | 내용 |
|---|---|
| `bc3ee07` | 1차 수합: 엔진 결함 수정, UI 보정, 원화 13장, 문항 20개·검토 입력, 철회 목록. **2차 작업의 baseCommit** |
| `c836f05` | 2차 작업 머리말(baseCommit·contractHash)·발행 문서 |
| `2fb43dc` | 설치 자리 목록·전장 키보드, WebGL 문맥 손실 복구 |
| `0448bf6` | 첫 연습 판 |
| 그다음 | 이 인계서와 Mac용 발행 안내 |

## 다음 첫 행동

1. **2차 작업 보내기(Mac).** Windows PC에 만든 작업 폴더와 `wp/*` 브랜치는 그 컴퓨터에만 있다(push하지 않음). Mac에서는 [발행용 프롬프트](work-packages/DISPATCH.md) 2차 절의 bash 블록을 저장소 폴더에서 그대로 실행해 `../tower-wp/{QR-001,QR-002,RIG-001}`를 만든다. QR 폴더에 `content-source/batches`가 **없어야** 한다(정답 원본). 프롬프트의 Windows 경로는 `/Users/bodyking/Desktop/vibecoding/tower-wp/`로 바꿔 붙여 넣는다. 보낸 것만 [작업 게시판](EXECUTION_BOARD.md)에서 RUNNING으로 바꾼다.
   - QR-001 → Codex 새 세션, QR-002 → Claude 새 대화(이 총괄 문맥이 아닌 것), RIG-001 → Claude 새 대화 또는 Codex.
   - 같은 작업을 Windows에서도 보내지 않는다. Windows 쪽 작업 폴더는 다음에 그 PC에서 `git worktree remove --force ../tower-wp/<jobId>` 후 `git branch -D wp/<jobId>`로 지운다.
2. **반환되면 수합.** [작업 패키지](work-packages/README.md)의 ‘받을 때’ 절차를 따른다.
   - QR: 두 보고서를 `npx vitest run tests/unit/content.test.ts`로 형식 검사 → [QR-001 요청서](work-packages/QR-001/REQUEST.md)의 승인 규칙(Argon 자체 반박 + Codex + Claude 중 하나라도 fail/uncertain이면 격리, blindChoice가 정답과 다르면 자동 격리)으로 판정한다. 총괄 사전 메모: 해설 20/20이 사전 뜻과 일치, `g3-argon-0013` 보기 c ‘받아적었어요’ 띄어쓰기 의심. **통과 문항을 게임 은행으로 옮기는 빌드 도구는 아직 없다**(초안 → `bankQuestionSchema` 변환, `status: published`, 은행 버전 올림). 수합 때 총괄이 만든다.
   - RIG: `src/game/animation/**`와 `tests/unit/animation*.test.ts`만 들인다. 피격 프레임 연결처럼 `BattleScene.ts`가 필요한 요청은 총괄이 반영한다. RIG가 도는 동안 총괄은 `src/game/animation/**`를 고치지 않는다.
3. **G2 게이트 준비(PRD §18.2).** 4→5→6웨이브, 오답·정지·저장복귀·보상 중복 검증. 엔진 밸런스 시뮬레이터(S11)로 `tools/balance-sketch.mjs`를 대체하는 것이 첫 일이다(PRD §18.1). 실기기 확인도 남아 있다.
4. 그 밖의 대기 일: ART-002(지면·설치 돌·작은 장식, 지금은 임시 그림과 원화가 섞여 보임), 대장 원화 5웨이브 전투 확인, 소리용 음원 작업 정의, QR-PRACTICE(연습 전용 4문항 검토), `p1/intake-round1`을 `main`에 합칠지(PR 여부) 결정.

## 이 구간에서 바뀐 설계(코드를 읽기 전에 알 것)

- **명령은 틱 경계에서 반영한다.** `RunController.dispatch`는 답안·거래를 바로 상태에 쓰지 않고 다음 논리 틱 시작에 순번대로 반영한다. 화면에는 사본(`trial`)에 미리 적용한 결과(거부 이유·새 타워 번호)를 돌려준다. 정지는 즉시 채택하고 그 틱에 모인 명령을 취소한다(PRD §3.4(1)·§20.3). 루프가 돌지 않을 때(단위 시험)는 바로 반영한다. 그래서 화면 반영은 최대 1/30초 늦고, e2e는 클릭 뒤 상태 변화를 기다려야 한다.
- **수동 ‘다음 문제’는 틱 끝에 처리한다.** `next`는 `autoAdvanceTick = tick`만 표시하고, 그 틱의 처치·누출·완료 판정 뒤에 넘어간다(§3.4(8)). 시험 도우미 `answerCurrent`는 ‘다음’ 뒤 한 틱을 더 돈다.
- 손상·철회 문항은 준비 교체·전투 교체·마무리 취소(`replaceUnavailableQuestion`, §9.5). 컨트롤러 생성 때도 한 번 검사한다.
- `num.ts`의 나눗셈은 몫·나머지로 계산해 분자가 안전 범위를 넘지 않는다. tick·명령 수치 한계는 상태를 바꾸기 전에 던지고 컨트롤러가 NUMERIC_LIMIT 정지로 바꾼다.
- 글자 크기별 문제판 예산: `product.defaults.v0.5.json`의 `layout.questionFontExtraPx`(+0/12/28px).
- 연습 판은 정규 규칙에 시도 수 1·적 3마리·등장 간격 2.2초만 바꾼 문맥으로 돌고, 저장·기록·소유권이 없다. 홈의 연습 권유는 설정 `practiceSeen`으로 끈다.
- `.gitattributes`: `asset-source/**`는 줄바꿈 변환 없이 바이트 그대로 둔다(`SHA256SUMS.txt`와 일치). `asset-source`·`content-source`는 ESLint 대상에서 뺐다.
- PRD 질문 2건의 답: 한 번의 긴 프레임은 벽시계 시간을 버린다(§13.3), seed 0은 먼저 재매핑한 뒤 스트림 상수와 XOR(§20.1, golden vector 시험).

## 검증(2026-10-28, Windows PC에서 실제 실행)

- `npm run verify` 통과: 타입·ESLint, 단위·속성 시험 17파일 70개, PRD 검산 48개, 문항 검사.
- `npm run validate:assets` 통과(납품·배포 manifest).
- `npm run test:e2e` 7개 통과: 1440×900 한 판 흐름·정지 가림, 390×844 넘침·확대, 키보드 자리 선택·설치 자리 목록, WebGL 문맥 손실/복구, 첫 연습 판 끝까지, 1366×650 R 모드, axe 위반 0.
- `npm run build` 성공, JS gzip 약 504KB(Phaser 357KB).
- 원화는 1440×900 전투의 실제 칸(72px)에서 41번과 나란히 확인했다(2배 캡처).
- 미실행: Mac에서의 실행(집에서 첫 `verify`로 확인), 실기기(iOS Safari·Android), 화면 읽기 프로그램 실사용, 30분 장시간 성능, 엔진 밸런스 시뮬레이션, 대장 원화 전투 화면, 보행 리깅 인수, 문항 공동검수, 소리, 배포.

## 하지 말 것·보존

- 원문 v0.1·v0.3·v0.4·41번 PNG는 검산 도구가 해시를 확인한다. 광범위 reset/clean으로 복구하지 말고 해당 commit의 필요한 파일만 비교한다.
- 저장소는 **공개(PUBLIC)**다. 문항 정답 원본(`content-source/batches/`)도 올라가 있으므로, 검토자에게는 정답 원본을 뺀 작업 폴더만 준다. 비밀값·계정 정보는 커밋하지 않는다.
- QR 작업이 끝나기 전에는 Q20 문항을 게임 은행에 넣지 않는다. 공동검수를 거치지 않은 문항을 ‘승인’으로 표시하지 않는다.
- 원화 상태를 직접 본 범위 밖으로 올리지 않는다(전투 화면에서 못 본 것은 `visual_pass`).
- `.claude/launch.json`은 미리보기 서버 설정이다(`tower-dev`, 5173).
