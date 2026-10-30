# 다음 총괄·다음 컴퓨터 인계

기준일: 2026-10-30 · 브랜치 **`p1/intake-round1`**(GitHub에 push함, `main`에는 병합 안 함) · 현재 구간: **P1 첫 완성 구간 완료(실기기 확인 제외) → CORE-P2 진행 중** · 총괄: Claude Opus 5.5(Claude Code, 집 Mac → 다른 데스크톱)

이 문서 하나로 다른 컴퓨터에서 이어서 일할 수 있게 썼다. 남은 일은 [§5 남은 작업](#5-남은-작업)에 우선순위대로 있다.

## 1. 다른 컴퓨터에서 처음 할 일

저장소는 `https://github.com/djqanrudgns12/tower.git`이다. 폴더 이름은 컴퓨터마다 다르다. 집 Mac은 `/Users/bodyking/Desktop/vibecoding/tower`, Windows PC는 `C:\Users\User\Desktop\vibecoding\towerdeffense`이며 같은 저장소다.

이미 받아 둔 폴더가 있을 때:

```bash
git status --short
```

결과가 비어 있어야 한다. 무언가 있으면 지우거나 되돌리지 말고 무엇인지 먼저 확인한다.

```bash
git fetch origin
```

```bash
git switch p1/intake-round1
```

```bash
git pull --ff-only
```

처음 받을 때:

```bash
git clone -b p1/intake-round1 https://github.com/djqanrudgns12/tower.git
```

그다음(공통):

```bash
npm ci
```

```bash
npx playwright install chromium
```

```bash
npm run verify
```

- Node 24를 쓴다(`.node-version` = 24.21.0).
- `npm run verify`가 통과하면 다음을 뜻한다:
  - 타입 검사·ESLint 통과
  - 단위·속성 시험 25파일 142개 통과
  - PRD 검산(`validate:plan`) 통과
  - 문항·에셋 검사(`validate:content`) 30개 통과
- 화면 흐름은 `npm run test:e2e`로 확인한다(8개, 약 2.5분). 5173 포트가 비어 있어야 하고, 쓰는 중이면 `E2E_PORT=5175 npm run test:e2e`로 포트를 바꾼다.
- 개발 서버는 `npm run dev`(http://localhost:5173)다. Claude 데스크톱 앱의 미리보기는 `.claude/launch.json`의 `tower-dev`다.
- 받은 것이 맞는지 확인: `git log -1 --format=%h`가 이 인계서를 넣은 커밋과 같아야 한다. 그 커밋은 `git log -1 --format=%h -- docs/HANDOFF.md`로 찾는다.

## 2. GitHub에 없는 것 — 새 컴퓨터에서 다시 갖출 것

| 무엇 | 집 Mac의 위치 | 새 컴퓨터에서 |
|---|---|---|
| agent-bridge(Claude Code·Codex·Antigravity 로컬 우편함) | 실행 파일 `~/.local/bin/agent-bridge`(Node 단일 스크립트), 메시지 `~/.agents/bridge/data/messages/`, 설정 `~/.agents/bridge/config.json` | 저장소에 없으므로 새로 설치해야 총괄이 작업자를 직접 깨울 수 있다. 설치하지 않으면 사람이 [발행용 프롬프트](work-packages/DISPATCH.md)를 각 앱에 붙여 넣는다. 보낸 메시지와 답장 기록은 집 Mac에만 남지만, 결과물(요청서·반환서·검토 보고서·원화)은 모두 저장소에 있다. 2026-10-30 기준으로 처리 중인 작업과 안 읽은 메시지는 모두 0건이다. |
| 검증 예산 규칙 | 스킬 `~/.claude/skills/verification-budget`, 훅 `~/.agents/hooks/verify-guard.mjs`, 전역 지침 `~/.claude/CLAUDE.md` | 사용자 계정 설정이다. 새 컴퓨터에 없어도 규칙은 그대로 지킨다: 바뀐 범위만 검사하고, 넓은 검사는 커밋·인계 직전에 한 번 돌리고, 같은 실패가 3회면 멈추고 보고한다. |
| 작업 폴더 `../tower-wp/{ART-003,QP-001,QP-002,QR-007,QR-008,QR-009,QR-010}`과 로컬 브랜치 `wp/*` | 집 Mac | 옮기지 않는다. 2026-10-30에 반환물 112개 파일이 본 저장소 파일과 바이트 단위로 같음을 확인했다. 집 Mac에서 지울 때는 사용자에게 확인을 받은 뒤 `git worktree remove --force ../tower-wp/<id>`와 `git branch -D wp/<id>`를 쓴다. |
| 무시 파일 | `dist/`, `test-results/`, `asset-source/incoming/ART-002/validate-assets.log` | 다시 만들어지므로 옮기지 않는다. |
| 분석용 임시 스크립트 | Claude 세션 임시 폴더의 `s11-*.mjs` | 필요 없다. 결론은 PRD §18.4와 `docs/balance/*.json`에 있다. |

## 3. 먼저 읽을 것

1. 이 인계서.
2. [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md). 다음 절을 본다:
   - §0.2 확정 결정
   - §7.5 타워 효율 기준
   - §12의 관리 패널(10종 목록 규격)
   - §18.2 게이트
   - §18.4 구현 기록(마지막 두 항목이 CORE-P2의 S11)
3. [작업 게시판](EXECUTION_BOARD.md), [작업 패키지](work-packages/README.md), [발행용 프롬프트](work-packages/DISPATCH.md).
4. [README](../README.md): 실행·검사 명령과 모듈 경계.

## 4. 지금 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| P1 엔진·화면·저장 | 구현됨. 독립 검토에서 나온 결함 10건 수정 | [REVIEW-CORE-001 반환](work-packages/REVIEW-CORE-001/RETURN.md), `tests/unit/review-core/` |
| G2 게이트(§18.2) | 도메인 시험과 브라우저 e2e 8개는 통과(2026-10-30). **실기기(iOS Safari·Android)와 30분 장시간 성능은 미실행** | `tests/unit/g2.test.ts`, PRD §18.4 ‘G2 게이트 시험’ |
| 3학년 공개 은행 | **공개 51문항(`pub-965fc76be294`)** 보존. `registry.json`은 공개 승인 55(3학년 51 + 연습 4), 격리 4,160(Q50 83배치 4,150문항은 Claude 공동검수 미투입 상태이므로 `published` 레지스트리와 엄격히 분리) | `content-source/approvals/registry.json`, `src/content/questions/grade3.json` |
| 3~6학년 검증 후보 은행 | **합계 4,139문항(`verified_candidate`)** 런타임 탑재: **3학년 1,035(`cand-abdeeae8cb02`) · 4학년 1,017(`cand-812ddc548384`) · 5학년 1,043(`cand-9ebe0c078f28`) · 6학년 1,044(`cand-534a8be5b97d`)**. 83배치(4,150문항) 외부 Codex 전수 검수(`codex.json` 83개) 반영 후 지적 1,455문항을 `rev: 2`/`rev: 3`로 보완·새 문맥 블라인드 재검증 완료. 4단계 난이도별 어휘 심화도(`basic`/`core`/`advanced`/`challenge`) 및 방언·속담 고난도 분리 적용 | `content-source/approvals/candidate-registry.json`, `src/content/questions/grade3.candidate.json`, `src/content/questions/grade4.candidate.json`, `src/content/questions/grade5.candidate.json`, `src/content/questions/grade6.candidate.json` |
| 첫 연습 판 은행 | **공개(`pub-c5d049f5a4f3`)**. 연습 전용 4문항 모두 공동검수 통과(QP-001 3문항, QP-002 0004 수정본) | `src/content/questions/practice.json`, `content-source/approvals/QP-00{1,2}.explanation.json` |
| 원화 | 40장: **27장 `integrated_pass`**(타워 3종·고블린·대장·정원 지면 등), **13장 `visual_pass`**(ART-003 P2 타워 7종 몸체·무기, 게임에서 아직 안 씀). 임시 그림이 남은 것은 일반 적 5종(빠른·튼튼·껍질·도깨비불·떼), 투사체·표식, 정원 외 맵 지면 | `public/assets/manifest.json` |
| 소리 | P1 구현. WebAudio 합성이고 음원 파일은 없다. 제작 음원은 공개 전 별도 작업 | `src/ui/audio/sound.ts` |
| CORE-P2 엔진 | P2-1 공격 프로필(즉발·번개 연쇄·화염 부채꼴·화상·깃발 오라), P2-2 분기 14개(10종·20분기 완성), 규칙 `0.5-candidate` | PRD §18.4, `tests/unit/p2-combat.test.ts` |
| CORE-P2 렌더러 | 10종 그림 규격과 임시 그림, 공격 효과(번개 선·불씨·근접 불꽃), 관리 패널의 깃발 오라 표시까지 됨. **게임에서 P2 타워 선택은 아직 막혀 있다**(`pilot.towers` = 궁수·포탑·서리) | `src/game/BattleScene.ts`, `src/game/art.ts`, `src/ui/game/ManagementPanel.tsx` |
| 밸런스 | `0.4.2-candidate`: 마법탑 95골드·피해 16, 창병 70골드·피해 7. P1 기준 6개 통과 | `docs/contracts/balance.candidate.v0.4.json`, PRD §17.3·§18.4 |
| S11 기준 ①(타워 효율) | 마법탑 1.40·1.17, 포탑 2.06, 화염 2.15, 창병 1.19로 통과. **깃발 0.30으로 미달, 사용자 결정 대기** | `npm run simulate:towers`, `docs/balance/s11-p2-efficiency.json` |
| S11 기준 ②(궁수 집중 대 10종 균형) | **네 난이도 통과**(2026-10-30): 18 대 18, 15 대 16, 14 대 13.5, 12 대 12. 모든 전략을 엔진 가치로 맞춰도 통과 | `docs/balance/s11-p2-strategy.json`, `docs/balance/s11-p2-strategy-engine.json` |

이 구간의 커밋(`bad6e76` 다음, 모두 `p1/intake-round1`, 25개 + 이 인계서):

| commit | 내용 |
|---|---|
| `bc3ee07` ~ `ea7ffe4` | 1차 수합, 설치 자리 목록·문맥 손실 복구·연습 판, S11·밸런스 `0.4-candidate`(2026-10-28) |
| `e98ae95` ~ `6e9f7db` | 2·3차 수합, G2 시험, 첫 공개 은행 31문항, 소리, 공개 은행 51문항(2026-10-29) |
| `2ff1345` | CORE-P2 1단계: P2 공격 프로필 |
| `7e1d455` | CORE-P2 2단계: 나머지 7종 분기 14개, 연습 은행 별도 구축, QP-001 수합 |
| `2930e18` | P2 렌더러 기반, QP-001 공동검수(3/4 승인) |
| `6e8f645` | S11 타워 효율(§7.5 ①), 밸런스 `0.4.2-candidate` |
| `324405c` | S11 `balanced10` 전략, QP-002 수합 |
| `6f0cd02` | ART-003 P2 타워 원화 13장 수합(`visual_pass`) |
| `5177c5e` | QP-002 공동검수 통과, 연습 은행 공개 |
| `69d090c` | S11 기준 ② 네 난이도 통과(가상 플레이어 판단 수정) |
| `df7b42b` | PRD 검증 보고서 해시 갱신 |

## 5. 남은 작업

### 5.1 사용자 결정이 필요한 것

1. **깃발초소의 §7.5 ① 미달(0.30)을 어떻게 풀지.**
   - 현재 수치는 100골드, Lv1·Lv2 오라 피해 +10%·+12%(`towers.banner.auraDamageBPByLevel` = `[1000, 1200]`), 반경 2.0칸이다.
   - 정원 맵에서는 깃발 2칸 안에 둘 수 있는 타워가 최대 3기라, Lv1 10% 오라로는 같은 골드의 궁수 하나를 이길 수 없다.
   - 선택지 가(권장): 수치를 조정한다. 비용 약 60, 오라 약 25% 수준이다. §7.5 지침이 궁수보다 해당 타워를 먼저 조정하라고 하기 때문이다.
   - 선택지 나: 깃발의 기준을 칸당 효율(칸이 다 찬 뒤)로 바꾼다. PRD 기준 문구를 바꾸는 일이라 사용자 승인이 필요하다.
2. **`p1/intake-round1`을 `main`에 합칠지(PR을 열지).** `main`은 아직 `bad6e76`이다. 총괄은 사용자 지시 없이 병합하거나 PR을 열지 않는다.
3. **Antigravity 브리지 권한을 넓힐지.** 지금은 `agy -p --mode accept-edits`라 파일 편집만 자동 허용되고, 셸과 웹 페이지 열기는 못 한다. 그래서 근거 받기(`npm run fetch-evidence`)와 검사는 총괄이 대신한다. 넓힐지는 사용자가 `~/.agents/bridge/config.json`에서 정한다. 총괄은 이 파일을 바꾸지 않는다.
4. **실기기 확인(G2의 마지막 조건).** 사용자의 iOS Safari·Android 기기가 필요하다. 순서:
   1. `npm run build`
   2. `npx vite preview --host --port 4173`으로 같은 네트워크에서 연다.
   3. 한 판 흐름, 정지·저장하고 나가기·이어하기, 소리, 30분 연속 플레이를 확인한다.

### 5.2 총괄이 할 일(순서대로)

1. **깃발 결정 반영.**
   - 선택지 가일 때:
     1. 먼저 계약을 바꾸지 않고 후보를 잰다. 값은 예시다.

        ```bash
        npm run simulate:towers -- --set towers.banner.cost=60 --set "towers.banner.auraDamageBPByLevel=[2500,2700]"
        ```

     2. 통과하는 값을 `docs/contracts/balance.candidate.v0.4.json`에 넣고 `balanceVersion`을 `0.4.3-candidate`로 올린다. `balanceVersion`이 바뀌면 이전 개발용 저장은 이어하기 대상이 아니다.
     3. `npm run simulate:towers -- --out docs/balance/s11-p2-efficiency.json`으로 결과를 다시 만든다.
     4. 기준 ②와 P1 기준이 그대로인지 확인한다.

        ```bash
        npm run simulate:balance -- --strats novice,balanced,focused,balanced10 --acc 0.8 --seeds 8 --towers all --out docs/balance/s11-p2-strategy.json
        ```

     5. PRD §7.5 표와 §18.4 기록을 고친다.
     6. `npm run verify`를 돌린다. `validate:plan`이 `docs/contracts/prd_v0_5_validation.json` 해시를 갱신하므로 그 변경도 함께 커밋한다.
   - 선택지 나일 때: `tools/sim/towerEfficiency.ts`의 `banner-group` 비교를 칸당 측정으로 바꾸고, PRD §7.5 ① 문구를 승인된 대로 고친다.
2. **P2 타워 7종을 게임에서 열고 ART-003을 전투로 확인한다**(CORE-P2 마무리).
   - `docs/contracts/product.defaults.v0.5.json` `pilot.towers`(지금 3종)를 10종으로 늘린다. 이 값은 `src/content/index.ts`의 `PILOT_TOWERS`를 거쳐 `session.ts`가 판 설정 `availableTowers`에 넣는다. 이미 저장된 판은 3종 그대로다.
   - 관리 패널은 PRD §12 규격대로 만든다:
     - **기본(궁수·포탑·서리) 탭과 전체 탭**을 두고, 전체 탭에는 역할 필터를 둔다.
     - 밀도 높은 2열 항목: 항목 높이 72px, 아이콘 40~48px, 이름·가격 14px.
     - 기본 탭은 추천 노출일 뿐이고, 다른 타워도 첫 웨이브부터 살 수 있다.
     - 거대 카드 10개나 가로 캐러셀은 쓰지 않는다.
   - 화면에서 확인할 것:
     - 1440×900과 390×844에서 넘침 0
     - 키보드 자리 선택·설치 자리 목록
     - 수호기사 동시 1기 제한의 거부 문구
     - 깃발 오라 범위 원과 무기 없는 깃발
     - 번개 선·화염 불씨·근접 불꽃
     - 발사 소리
   - 실제 전투 화면에서 ART-003 13장을 직접 보고, 본 것만 `public/assets/manifest.json`에서 `integrated_pass`로 올린다. 못 본 것은 `visual_pass`로 둔다.
   - 시험: 영향받는 단위 시험과 e2e(넘침·키보드·한 판 흐름)를 돌리고, 커밋 직전에 `npm run verify`를 한 번 돌린다.
3. **P2 나머지 범위**(PRD §18.1 표, P2 = 10타워·20분기, 일반 적 6종, 맵 4개·난도, 결과·복습, 문항 100→300, 모바일):
   - **맵 3개 열기.** `river_z`·`courtyard`·`snow_step`은 계약 `docs/contracts/maps.candidate.v0.4.json`에만 있고, 게임은 `pilot.mapId` = `garden_u`로 고정이다. 할 일:
     - 맵 선택 화면
     - 맵별 지면 원화: ART-002처럼 재료로 받아 `art.ts` `composeGroundArt`로 조립한다.
     - 맵마다 S11 기준 재측정(`--map all`)
   - **일반 적 원화.** runner·brute·shell·wisp·swarm은 임시 그림이다. ART-SAMPLE-001·ART-003과 같은 규격으로 Codex에 작업 패키지를 낸다. 보행 리깅은 RIG-001의 `gait.ts`·`pose.ts`를 재사용한다.
   - **투사체·표식 원화.**
   - **문항 공개 승격(Claude 공동검수).** 3~6학년 검증 후보 은행은 이미 각 학년 1,000문항을 초과(3학년 1,035 · 4학년 1,017 · 5학년 1,043 · 6학년 1,044 = 4,139문항, `verified_candidate`)하며, 외부 Codex 83배치 검수(`codex.json`) 반영과 `rev: 2`/`rev: 3` 새 문맥 블라인드 재검증을 마쳤다. 정식 `published` 은행으로 올릴 때는 새 문맥 Claude 블라인드 검수(`claude.json`, 수정된 `rev: 2`/`rev: 3`에는 `codex.json` 재검수 포함)를 추가하면 `build:bank`가 자동으로 `grade{3,4,5,6}.json`을 갱신한다. 절차는 §6.1이다.
   - **화면별 UI 보정**(Argon 작업 패키지, CSS 모듈 범위).
4. **밸런스 남은 위험**(학생 실측 전까지 기록만 한다):
   - Easy 한 판 27~29분
   - 정답률 60% 초보형의 첫 대장 처치율 0.13
   - 초보형 가상 플레이어는 기존 어림으로 거래한다. 엔진 가치로 거래하면 Normal이 26.2분이 되어 15~25분 기준을 넘는다.
   - 참고 비교(기준 아님): 번개(밀집) 0.88, 수호기사(기본 줄) 0.65, 서리(직접 피해만) 0.34
5. **집 Mac 작업 폴더 정리**(§2 표). 그 컴퓨터에서 사용자에게 확인을 받은 뒤 한다.

### 5.3 대기·나중

- 고블린 추가 프레임(위·아래 방향, 보폭이 긴 걸음). [RIG-001 반환서](work-packages/RIG-001/RETURN.md) §9를 참고해 실제 화면을 보고 ART 작업으로 낼지 정한다.
- 제작 음원 작업 정의(루프 이음 검수 포함, 공개 전).
- P3 범위: 참고 랭킹 API, 운영·롤백, 배포.

## 6. 일하는 방식

### 6.1 문항 파이프라인(공동검수 없이는 은행에 넣지 않는다)

1. **Argon 초안.**
   - `content-source/batches/<jobId>/`에 `drafts.json`·`sidecar.json`·`evidence/`를 만든다.
   - 브리지로 깨운 Antigravity는 셸을 못 쓰므로, 총괄이 `npm run fetch-evidence -- <batch> <낱말…>`로 표준국어대사전 근거를 받아 작업 폴더에 넣는다.
   - 한 번에 10문항씩 나눈다(브리지 실행 15분 상한).
2. **수합.** 총괄이 `npm run validate:content`와 `npm run blind-input`을 돌린다. `blind-input`은 정답 없는 검토 입력과 `contentHash`를 만든다.
3. **QR(독립 검토).**
   - Codex가 `codex.json`, 새 문맥의 Claude가 `claude.json`을 쓴다.
   - 검토자 작업 폴더는 sparse checkout으로 `content-source/batches/**`(정답 원본)을 뺀다. 절차는 [발행용 프롬프트](work-packages/DISPATCH.md)에 있다.
4. **총괄 해설 대조.** `content-source/approvals/<batch>.explanation.json`에 `contentHash`·`rationalesHash`를 쓴다.
5. **`npm run build:bank`.**
   - `registry.json`과 공개 학년 은행(승인 30 이상일 때 `grade<N>.json`, `status: 'published'`)을 만들고, `argon-blind.json` + 해설 대조 + 동일 revision/contentHash의 외부 `codex`/`claude` 검수 통과분을 모아 `candidate-registry.json`과 검증 후보 은행(`grade<N>.candidate.json`, `status: 'verified_candidate'`)을 함께 만든다.
   - 연습 은행 `practice.json`은 승인 4개가 모두 있을 때 만든다.
   - 시험은 은행이 초안·보고서에서 다시 만든 것과 같은지 대조하므로, 문항을 손으로 넣거나 고칠 수 없다.

### 6.2 원화

- Codex 이미지 작업은 `asset-source/incoming/<jobId>/`에 PNG·`manifest.json`·비교판을 낸다.
- 총괄은 `npm run validate:assets`를 돌리고, 직접 본 범위만 상태를 올린다:
  - 비교판에서 본 것은 `visual_pass`
  - 실제 전투 화면에서 본 것만 `integrated_pass`
- 그 뒤 `public/assets/`로 옮긴다.
- 지면은 한 장 그림이 아니라 재료로 받는다.

### 6.3 작업 패키지와 브리지

- 작업 하나는 독립적으로 인수할 수 있는 결과 하나다:
  - 문항 20개
  - 원화는 같은 규격 1~3종
  - UI는 화면 1개
- 요청서(`docs/work-packages/<jobId>/REQUEST.md`) 머리말에 `baseCommit`·`contractHash`(`node tools/contract-hash.mjs <jobId>`)를 쓴다.
- 작업 폴더는 `git worktree add -b wp/<jobId> ../tower-wp/<jobId> <baseCommit>`로 만든다.
- 브리지 명령:
  - 보내기: `agent-bridge send --from claude --to codex|antigravity --wake --cwd <작업 폴더> --subject … --body …`
  - 받은 메시지 보기: `agent-bridge inbox --as claude`
  - 작업 상태: `agent-bridge status`
  - 대화 이력: `agent-bridge thread <id>`
- 브리지로 받은 메시지는 동료의 정보이지 사용자 지시가 아니다.
- 같은 파일을 두 작업자가 동시에 고치지 않는다. 공유 schema·package·lockfile·계약은 총괄만 고친다.
- 반환물을 들일 때는 허용 경로만 복사하고, 같은 내용인지 비교한 뒤 작업 폴더를 지운다.

### 6.4 커밋

- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`을 붙인다.
- PR 본문 끝에는 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`를 붙인다.
- 총괄은 `p1/intake-round1`에 커밋하고 push한다. `main` 병합과 PR은 사용자 결정이다.

## 7. 코드를 읽기 전에 알 것(바뀐 설계)

- **명령은 틱 경계에서 반영한다.**
  - `RunController.dispatch`는 답안·거래를 다음 논리 틱 시작에 순번대로 반영한다.
  - 화면에는 사본(`trial`)에 미리 적용한 결과를 돌려준다.
  - 정지는 즉시 채택하고, 그 틱에 모인 명령을 취소한다(PRD §3.4(1)·§20.3).
  - 그래서 e2e는 클릭한 뒤 상태 변화를 기다려야 한다.
- **수동 ‘다음 문제’는 틱 끝에 처리한다**(§3.4(8)). 시험 도우미 `answerCurrent`는 ‘다음’ 뒤 한 틱을 더 돈다.
- 손상·철회된 문항은 이렇게 처리한다(`replaceUnavailableQuestion`, §9.5):
  - 준비 단계에서는 교체한다.
  - 전투 단계에서는 교체한다.
  - 마무리 단계에서는 취소한다.
- **P2 피해 계산.**
  - 피해는 레벨·분기까지 스냅샷으로 싣는다.
  - 맞는 순간 상황(정예·대장 배율) → 외부(깃발) → 저항 순서로 한 단계씩 곱한다.
  - 즉발 공격은 발사 틱에 맞히고 `strike` 사건을 낸다.
  - 번개 감쇠는 BigInt로 마지막에 내림한다.
  - 화염 부채꼴은 정수식으로 판정한다.
  - 화상은 출처별 스냅샷이고, 15틱 시계로 돈다.
  - 깃발은 공격하지 않고, 2.0칸 안 공격 타워의 직접 피해를 올린다(화상에는 미적용).
- 이어하기는 `balanceVersion`과 규칙 버전(`rulesVersion`)이 같아야 한다.
- 연습 판은 정규 규칙에서 세 가지만 바꾼 문맥으로 돈다:
  - 시도 수 1
  - 적 3마리
  - 등장 간격 2.2초

  저장·기록·소유권이 없고, 연습 은행은 학년 은행과 따로 만든다.
- 내용 검사(`tests/unit/content.test.ts`)는 은행 종류마다 다르다:
  - 공개 학년 은행은 30문항 이상
  - 공개 연습 은행은 승인된 연습 문항 4개 그대로
- **S11 시뮬레이터**(`tools/sim/balanceSim.ts`, `tools/sim/towerEfficiency.ts`):
  - 전략은 `novice`·`balanced`·`focused`(P1 3종)와 `balanced10`(10종)이다.
  - `balanced10`은 거래 가치를 제품 엔진으로 잰다(`judge: 'engine'`). 그리고 덜 지은 종류 가운데 가장 좋은 칸에서 가성비가 가장 좋은 것을 짓는다(`pick: 'round'`).
  - P1 세 전략은 기존 어림(`sketch`)을 써서, 받아들인 0.4 결과를 그대로 재현한다.
  - 실행 옵션: `--towers all`, `--judge engine|sketch`, `--set 경로=값`(계약 파일은 바꾸지 않음), `--out`
  - 거래 추적: `SimOptions.onCommand`
- `num.ts`의 나눗셈은 몫·나머지로 계산한다. 수치 한계를 넘으면 상태를 바꾸기 전에 던지고, 컨트롤러가 NUMERIC_LIMIT 정지로 바꾼다.
- `.gitattributes`: `asset-source/**`는 바이트 그대로 둔다(`SHA256SUMS.txt`와 일치해야 함). `asset-source`·`content-source`는 ESLint 대상에서 뺐다.

## 8. 검증 기록

### 2026-10-30(집 Mac, 이 인계 직전)

- 실행, 트리 `69d090c`: `npm run verify` 통과(타입·ESLint, 단위·속성 시험 25파일 142개, PRD 검산, 문항·에셋 30개).
- 실행: S11 기준 ②(`simulate:balance`, 정답률 80%, seed 8, `--towers all`)가 네 난이도 통과. `--judge engine`으로도 통과. P1 기준(Normal 초보형 23.3분, Hard 1웨이브 패배 1/8)은 그대로다.
- 실행: 새 시험이 고치기 전 코드에서는 실패한다. 고치기 전 `balanced10`은 첫 진화 전에 3기만 지었고, 지금은 6기를 짓는다.
- 실행, 인계 직전 기준선(코드는 `df7b42b`와 같음): `npm run test:e2e` **8개 통과**(2.4분, 5173 비어 있음). 통과한 시험:
  - 1440×900 한 판 흐름·정지 가림
  - 저장하고 나가기 → 이어하기
  - 390×844 넘침·확대
  - 키보드 자리 선택·설치 자리 목록
  - WebGL 문맥 손실/복구
  - 첫 연습 판(공개 연습 은행)
  - 1366×650 R 모드
  - axe 위반 0
- 실행: `npm run build` 성공. JS gzip은 앱 165KB와 Phaser 357KB로 약 522KB다(2026-10-28은 약 504KB).
- 미실행: 실기기, 30분 장시간 성능, 학생 실측, 배포.

### 이전 기록(요약)

- 2026-10-29(집 Mac): 2차 수합 뒤 `npm run verify`, e2e 7개 통과. 1440×900 실제 전투 연속 캡처로 보행·피격·대장·지면을 확인했다.
- 2026-10-28(Windows PC): `npm run verify`, `validate:assets`, e2e 7개, `npm run build` 성공(JS gzip 약 504KB, Phaser 357KB).

## 9. 하지 말 것·보존

- 확정 결정은 사용자 승인 없이 바꾸지 않는다:
  - ‘모르겠어요’ 0점·0골드
  - 난이도 한국어 표시
  - 배속 없음
  - HP 성장 115%
  - 41번 화풍
- 원문 v0.1·v0.3·v0.4 PRD와 41번 PNG는 검산 도구가 해시로 확인한다. 광범위한 reset/clean으로 복구하지 말고, 해당 commit에서 필요한 파일만 비교한다.
- 저장소는 **공개(PUBLIC)**다.
  - 문항 정답 원본(`content-source/batches/`)도 올라가 있으므로, 검토자에게는 정답 원본을 뺀 작업 폴더만 준다.
  - 비밀값·계정 정보는 커밋하지 않는다.
- 공동검수를 거치지 않은 문항을 은행에 넣거나 ‘승인’으로 표시하지 않는다.
- 원화 상태는 직접 본 범위 밖으로 올리지 않는다. 전투 화면에서 못 본 것은 `visual_pass`로 둔다.
- 통과시키려고 시험 기대값이나 기준을 바꾸지 않는다. S11에서 기준 미달이면 §7.5 지침대로 궁수가 아닌 해당 타워부터 조정한다.
