# 다음 총괄·다음 컴퓨터 인계

기준일: 2026-10-29 · 현재 구간: **P1 첫 완성 구간 — 첫 공개 문제은행(3학년 31문항) 게임 연결, 원화 27장 적용, G2 시험 통과(실기기 제외)** · 2026-10-29부터 총괄이 `agent-bridge`로 Codex·Antigravity에 직접 전달한다 · 총괄: Claude Opus 5.5(Claude Code, Windows PC → 집 Mac)

## 집 Mac에서 처음 할 일

작업은 GitHub의 브랜치 **`p1/intake-round1`**에 push되어 있다. `main`은 아직 `bad6e76`(이 구간 이전)이며 병합하지 않았다.

```bash
cd /Users/bodyking/Desktop/vibecoding/tower   # 집 Mac의 저장소 폴더 이름은 tower다
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
| 원화 | **27장 모두 게임 적용(`integrated_pass`)**: ART-SAMPLE-001 16장(대장 2장은 2026-10-29 5웨이브 전투로 확인) + ART-002 11장(풀·흙 질감·풀 얼룩·설치 받침·바위·입구 깃발·작은 장식). 남은 임시 그림은 P2 적(빠른·튼튼·껍질 등)과 투사체·표식 | [ART-SAMPLE-001 반환](work-packages/ART-SAMPLE-001/RETURN.md), `public/assets/manifest.json`의 `notes` |
| 3학년 문항(Argon) | **첫 공개 은행 31문항, 게임이 싣는다.** Q20-001 승인 14·격리 6, Q20-002 승인 17·격리 3(고친 판 0004·0006·0015). `src/content/index.ts`는 `grade<N>.json`(published)이 있으면 개발용 대신 그것을 싣고, 판은 콘텐츠 모드 `published`로 시작한다 | `content-source/approvals/registry.json`(`npm run build:bank`), PRD §18.4 |
| A26 철회 목록 | 완료 | `src/content/retractions.json` |
| 설치 자리 목록·전장 키보드(§12.4) | 완료 | `src/ui/game/SlotList.tsx` |
| WebGL 문맥 손실 복구(§12.7) | 완료 | `RunController.rendererLost/rendererRestored` |
| 첫 연습 판(§12.2) | 완료. 연습 전용 4문항은 공동검수 전 | `practiceContext`, `src/content/questions/practice.json` |
| 소리 | 미착수(음원 작업을 먼저 정해야 함) | PRD §11.5 |
| 2차 작업 QR-001·QR-002·RIG-001 | **수합 완료(ACCEPTED).** RIG 연결 4건은 총괄이 `BattleScene.ts`·`assets.ts`에 넣었다. 작업 폴더 `../tower-wp/{QR-001,QR-002,RIG-001}`은 수합을 커밋한 뒤 지운다 | [작업 게시판](EXECUTION_BOARD.md), [RIG-001 반환](work-packages/RIG-001/RETURN.md) |
| 3차 작업 ART-002·Q20-002 | **수합 완료.** ART-002는 ACCEPTED, Q20-002는 검토 대기. 지면은 `art.ts` `composeGroundArt`가 맵 데이터로 조립한다 | [ART-002 반환](work-packages/ART-002/RETURN.md), [Q20-002 반환](work-packages/Q20-002/RETURN.md) |
| 엔진 밸런스 시뮬레이터(S11)·밸런스 | 완료, 근사 모델 폐기. 사용자가 후보 A 방향을 골라 `0.4-candidate`로 반영: Normal 기준 34.3분→23.3분, 정답률 효과 1~2→2.5~4웨이브, PRD 기준 6개 통과 | PRD §17.3, `docs/contracts/balance.candidate.v0.4.json`, `docs/balance/s11-*.json` |
| 비석 ‘가’ 글자 | 원화 아래에 깔려 안 보이던 결함 수정 | `BattleScene.ts` `STELE_FACE_Y` |

이 구간의 커밋(`bad6e76` 다음, 모두 `p1/intake-round1`):

| commit | 내용 |
|---|---|
| `bc3ee07` | 1차 수합: 엔진 결함 수정, UI 보정, 원화 13장, 문항 20개·검토 입력, 철회 목록. **2차 작업의 baseCommit** |
| `c836f05` | 2차 작업 머리말(baseCommit·contractHash)·발행 문서 |
| `2fb43dc` | 설치 자리 목록·전장 키보드, WebGL 문맥 손실 복구 |
| `0448bf6` | 첫 연습 판 |
| `19e1c6c` | 이 인계서와 Mac용 발행 안내 |
| `17a72d3` | 검토자 폴더의 정답 노출 차단(Q20 반환서 제외·이력·개발 은행 금지) |
| `258161f` | 비석 글자, S11 시뮬레이터·기준선 |
| `ea7ffe4` | 밸런스 `0.4-candidate`, 사용 설명서 준비 문항 수를 계약에서 읽기, e2e 포트 `E2E_PORT` |
| 그다음 | 2차 수합(RIG 연결·피격 원화, QR 판정·승인 레지스트리·`build:bank`), ART-002 요청서 |

## 다음 첫 행동

1. **Q20-003(Argon).** 격리된 고친 판 3개(0004·0006·0015)는 마지막 수정(revision 3)을 받고, 새 문항으로 P1 목표 50문항까지 채운다. 지적 내용은 `content-source/reviews/Q20-002/codex.json` findings. 수합 → `npm run blind-input` → QR(Codex 브리지·새 문맥 Claude) → 총괄 해설 대조 → `npm run build:bank` 순서는 이번과 같다.
2. **Argon 전달 방법.** 사람이 Antigravity에 붙여 넣어도 되고, 총괄은 `agent-bridge send --from claude --to antigravity --wake --cwd <작업 폴더>`로 한다(브리지 실행은 15분 상한이라 10문항씩 나눈다).
3. **G2 게이트(PRD §18.2).** 4→5→6웨이브·오답·정지·저장복귀·보상 중복은 2026-10-29에 도메인 시험(`tests/unit/g2.test.ts`)과 브라우저 e2e(저장하고 나가기 → 이어하기)로 확인했다(PRD §18.4 ‘G2 게이트 시험’). 남은 것은 실기기(iOS Safari·Android) 확인과 장시간 성능. 밸런스 남은 위험: Easy 27~29분, 정답률 60% 초보형의 첫 보스 처치 0.13.
4. 그 밖의 대기 일: 고블린 추가 프레임(위·아래 방향, 보폭이 긴 걸음 — RIG-001 반환서 §9, 실제 화면을 보고 ART-003으로 낼지 정함), 대장 원화 5웨이브 전투 확인, 소리용 음원 작업 정의, QR-PRACTICE(연습 전용 4문항 검토), `p1/intake-round1`을 `main`에 합칠지(PR 여부) 결정.

## 이 구간에서 바뀐 설계(코드를 읽기 전에 알 것)

- **명령은 틱 경계에서 반영한다.** `RunController.dispatch`는 답안·거래를 바로 상태에 쓰지 않고 다음 논리 틱 시작에 순번대로 반영한다. 화면에는 사본(`trial`)에 미리 적용한 결과(거부 이유·새 타워 번호)를 돌려준다. 정지는 즉시 채택하고 그 틱에 모인 명령을 취소한다(PRD §3.4(1)·§20.3). 루프가 돌지 않을 때(단위 시험)는 바로 반영한다. 그래서 화면 반영은 최대 1/30초 늦고, e2e는 클릭 뒤 상태 변화를 기다려야 한다.
- **수동 ‘다음 문제’는 틱 끝에 처리한다.** `next`는 `autoAdvanceTick = tick`만 표시하고, 그 틱의 처치·누출·완료 판정 뒤에 넘어간다(§3.4(8)). 시험 도우미 `answerCurrent`는 ‘다음’ 뒤 한 틱을 더 돈다.
- 손상·철회 문항은 준비 교체·전투 교체·마무리 취소(`replaceUnavailableQuestion`, §9.5). 컨트롤러 생성 때도 한 번 검사한다.
- `num.ts`의 나눗셈은 몫·나머지로 계산해 분자가 안전 범위를 넘지 않는다. tick·명령 수치 한계는 상태를 바꾸기 전에 던지고 컨트롤러가 NUMERIC_LIMIT 정지로 바꾼다.
- 글자 크기별 문제판 예산: `product.defaults.v0.5.json`의 `layout.questionFontExtraPx`(+0/12/28px).
- 연습 판은 정규 규칙에 시도 수 1·적 3마리·등장 간격 2.2초만 바꾼 문맥으로 돌고, 저장·기록·소유권이 없다. 홈의 연습 권유는 설정 `practiceSeen`으로 끈다.
- `.gitattributes`: `asset-source/**`는 줄바꿈 변환 없이 바이트 그대로 둔다(`SHA256SUMS.txt`와 일치). `asset-source`·`content-source`는 ESLint 대상에서 뺐다.
- e2e는 이미 떠 있는 서버를 재사용한다. 작업 폴더가 5173을 쓰고 있으면 `E2E_PORT=5175 npm run test:e2e`로 포트를 나눈다.
- PRD 질문 2건의 답: 한 번의 긴 프레임은 벽시계 시간을 버린다(§13.3), seed 0은 먼저 재매핑한 뒤 스트림 상수와 XOR(§20.1, golden vector 시험).

## 검증(2026-10-29, 집 Mac에서 실제 실행)

- 2차 수합 뒤: `npm run verify` 통과(PRD 검산 48개 포함, `vitest list` 기준 단위·속성 시험 82개), `npm run test:e2e` 7개 통과(2.0분, 5173 비어 있음).
- RIG 연결: 헤드리스 Chromium 1440×900 실제 전투에서 궁수(8,2)·서리(8,0) 옆을 지나는 고블린을 48장 연속 캡처했다. 맞은 순간 피격 그림으로 바뀌고 발이 같은 지면선에 있는 것을 확인했다(캡처는 저장소 밖 임시 폴더, 내장 브라우저 창이 가려져 있으면 게임이 멈추므로 헤드리스로 대신).
- 미실행: `npm run build`(바뀐 범위 밖, 2026-10-28 결과 재사용), 앞 창에서 사람 눈으로 보는 보행 확인, 위·아래 구간 보행, 실기기, 소리, 배포.

## 검증(2026-10-28, 집 Mac에서 실제 실행)

- 전환 직후(`19e1c6c`): `npm run verify` 통과, `npm run test:e2e` 7개 통과(2.6분). Mac 첫 실행 공백은 해소.
- 비석·S11 뒤: `npm run verify` 통과(단위·속성 시험 18파일 72개, PRD 검산 48개, 문항 검사), e2e `1440×900` 한 판 흐름 1개 통과. 비석 글자는 내장 브라우저 1440×900 연습 판에서 비석 면 위에 보이는 것을 확인했다.
- 밸런스 `0.4-candidate` 뒤: `npm run verify` 통과(72개·48개), S11 기준 6개 통과, `E2E_PORT=5175`로 e2e `1440×900` 한 판 흐름 1개 통과(5173은 RIG-001 작업 폴더의 서버가 쓰는 중), 사용 설명서에 ‘그다음은 2문제’가 보이는 것을 브라우저로 확인했다.
- 미실행: 나머지 e2e 6개(바뀐 범위 밖), `npm run build`, 실기기, 소리, 문항 공동검수, 리깅 인수, 배포.

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
