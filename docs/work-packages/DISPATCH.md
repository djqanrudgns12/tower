# 발행용 프롬프트

## 2차(2026-10-28 준비) — QR-001 · QR-002 · RIG-001

1차 네 작업은 반환·수합되었다(아래 ‘1차’ 절은 이력). 2차 기준 commit은 `bc3ee0720912d33ff2b96602c365cfdd38e37521`(브랜치 `p1/intake-round1`)이고, 머리말(`baseCommit`·`contractHash`)은 이미 채워 커밋했다. 작업 폴더는 컴퓨터마다 따로 만든다. 2026-10-28 Windows PC에는 만들어 두었고(아직 아무 모델에도 보내지 않음), **집 Mac에서는 아래 명령으로 새로 만든다.** 한 작업을 두 컴퓨터에서 동시에 보내지 않는다. 작업 폴더의 `git status`에는 채운 REQUEST.md 한 줄이 보이는 것이 정상이다.

```bash
B=bc3ee0720912d33ff2b96602c365cfdd38e37521
for j in QR-001 RIG-001; do node tools/contract-hash.mjs $j; done
# QR: 정답 원본(content-source/batches)과 정답 열이 있는 Q20-001 반환서를 뺀 작업 폴더.
for j in QR-001 QR-002; do
  git worktree add --no-checkout -b wp/$j ../tower-wp/$j $B
  # Windows Git Bash는 '/…' 인자를 C:/Program Files/Git/… 로 바꾸므로 경로 변환을 끈다.
  MSYS_NO_PATHCONV=1 git -C ../tower-wp/$j sparse-checkout set --no-cone '/*' '!/content-source/batches/' '!/docs/work-packages/Q20-001/RETURN.md'
  git -C ../tower-wp/$j checkout
done
git worktree add -b wp/RIG-001 ../tower-wp/RIG-001 $B
# 채운 머리말을 작업 폴더로 복사한다(작업 폴더는 bc3ee07이라 머리말이 비어 있다).
for j in QR-001 QR-002; do cp docs/work-packages/QR-001/REQUEST.md ../tower-wp/$j/docs/work-packages/QR-001/REQUEST.md; done
cp docs/work-packages/RIG-001/REQUEST.md ../tower-wp/RIG-001/docs/work-packages/RIG-001/REQUEST.md
# 확인: QR 폴더에는 content-source/reviews만 있고 batches가 없어야 한다. Q20-001 폴더에는 REQUEST.md만 있어야 한다.
ls ../tower-wp/QR-001/content-source ../tower-wp/QR-002/content-source
ls ../tower-wp/QR-001/docs/work-packages/Q20-001 ../tower-wp/QR-002/docs/work-packages/Q20-001
```

2026-10-28 집 Mac 점검: 처음 명령은 `docs/work-packages/Q20-001/RETURN.md`(20문항의 `정답` 열)를 검토자 폴더에 남겼다. 위 명령으로 고쳤다. Windows PC에 이미 만든 QR 폴더에는 이 파일이 남아 있으므로 거기서는 보내지 않는다. sparse checkout은 작업 트리에서만 빼므로 검토자는 `git show`·`git log -p`로 이력을 열 수 있고, `src/content/questions/grade3.dev.json`(개발용 은행)에 같은 표제어 16개가 있다. 프롬프트에서 둘 다 금지한다.

`MSYS_NO_PATHCONV=1`은 Windows Git Bash용이고 Mac에서는 아무 효과가 없으니 그대로 두어도 된다. Windows에서는 먼저 `git config core.autocrlf input`을 해 둔다(Mac은 필요 없음).

| jobId | 보낼 곳 | 작업 폴더(Windows PC) | 작업 폴더(집 Mac) | 결과 |
|---|---|---|---|---|
| QR-001 | Codex, 새 세션 | `C:\Users\User\Desktop\vibecoding\tower-wp\QR-001` | `/Users/bodyking/Desktop/vibecoding/tower-wp/QR-001` | `content-source/reviews/Q20-001/codex.json`, `docs/work-packages/QR-001/RETURN.md` |
| QR-002 | Claude, 새 대화(총괄 세션이 아닌 것) | `C:\Users\User\Desktop\vibecoding\tower-wp\QR-002` | `/Users/bodyking/Desktop/vibecoding/tower-wp/QR-002` | `content-source/reviews/Q20-001/claude.json`, `docs/work-packages/QR-001/RETURN-QR-002.md` |
| RIG-001 | Claude 새 대화 또는 Codex 세션 | `C:\Users\User\Desktop\vibecoding\tower-wp\RIG-001` | `/Users/bodyking/Desktop/vibecoding/tower-wp/RIG-001` | `src/game/animation/**`, `tests/unit/animation*.test.ts`, `docs/work-packages/RIG-001/RETURN.md` |

아래 프롬프트는 Windows 경로로 적었다. **집 Mac에서 보낼 때는 `C:\Users\User\Desktop\vibecoding\tower-wp\` 를 `/Users/bodyking/Desktop/vibecoding/tower-wp/` 로 바꿔 붙여 넣는다.** 결과는 보낸 컴퓨터의 작업 폴더에만 생긴다.

### QR-001 → Codex / QR-002 → Claude(각각 새 대화)

두 모델에 같은 본문을 보내되 `[내 몫]` 줄과 작업 폴더만 다르게 고친다.

```text
[QR-001 또는 QR-002] 3학년 어휘 문항 20개 독립 검토(정답 키 없음)

너는 대한민국 초등 3학년 어휘 문항의 독립 검토자다. 총괄은 Claude Opus 5.5이고, 너는 이 검토 하나만 맡는다. 정답 키를 받지 않았다. 다른 검토자와 상의하지 않는다.
[내 몫] QR-001(Codex): 결과 content-source/reviews/Q20-001/codex.json, 반환서 docs/work-packages/QR-001/RETURN.md
        QR-002(Claude): 결과 content-source/reviews/Q20-001/claude.json, 반환서 docs/work-packages/QR-001/RETURN-QR-002.md

작업 폴더: C:\Users\User\Desktop\vibecoding\tower-wp\<QR-001 또는 QR-002>
이 폴더 안에서만 읽고 쓴다. 본 저장소 폴더(Windows: towerdeffense, Mac: tower)나 다른 tower-wp 폴더는 열지 않는다. 이 폴더에는 정답 원본(content-source/batches)이 없다. 다른 곳에서 찾아 열지 않는다. git show·git log -p·git cat-file 등으로 이력의 파일을 열지 않고, 개발용 은행 src/content/questions/** 도 열지 않는다.

1. 시작 확인 — 하나라도 다르면 작업하지 말고 그 출력만 보고한다.
   - git rev-parse HEAD → bc3ee0720912d33ff2b96602c365cfdd38e37521
   - content-source/batches 폴더가 없다
   - npm ci 성공
   - node tools/contract-hash.mjs QR-001 의 해시가 docs/work-packages/QR-001/REQUEST.md 머리말 contractHash와 모두 같다

2. 할 일 — docs/work-packages/QR-001/REQUEST.md의 ‘검토자 지시’를 그대로 따른다. 입력은 content-source/reviews/Q20-001/blind-input.json 하나다.
   - 먼저 문항마다 직접 풀어 blindChoice를 적는다(답이 둘 이상이면 multiple, 없으면 none). 사전 페이지는 풀고 난 뒤에 연다.
   - 그다음 source(제시된 표준국어대사전 URL·뜻 번호를 실제로 열어 확인), uniqueness(네 보기를 문장에 넣어 보기), grade, language를 pass/fail/uncertain으로 판정한다. explanation은 uncertain으로 둔다.
   - 의심은 findings에 구체적으로 쓴다(어느 보기를 넣으면 왜 말이 되는지, 어떤 표기가 맞춤법·띄어쓰기에 어긋나는지).
   - 사전에 접속할 수 없으면 source를 uncertain으로 두고 그 사실을 반환서에 적는다. 근거를 지어내지 않는다.
   - 결과는 src/contracts/questionDraft.ts 의 blindReviewSchema 형식 JSON 하나다. reviewer.freshContext=true, reviewer.model은 실제 모델명.

3. 범위
   - 쓸 수 있는 곳: [내 몫]의 두 파일뿐이다.
   - 하지 않는다: 다른 파일 수정, 패키지 설치·업그레이드, git commit·push.

4. 검사: npx vitest run tests/unit/content.test.ts 를 통과시킨다(검토 보고서 형식 검사 포함).

5. 끝낼 때: 반환서에 실제 모델명·작업일·문항별 blindChoice와 fail/uncertain 목록·검사 실제 출력을 쓴다. git status --short 에 [내 몫] 파일만 보이는지 확인하고, fail 수·uncertain 수·multiple/none 수를 다섯 줄 안으로 보고한다.
```

### RIG-001 → Claude 새 대화 또는 Codex

```text
[RIG-001] 고블린 보행·피격 동작

너는 초등 어휘 타워 디펜스 웹게임의 2D 동작(리깅) 담당이다. 총괄은 Claude Opus 5.5이고, 너는 이 작업 하나만 맡는다. 다른 모델들이 다른 폴더에서 동시에 일하고 있다.

작업 폴더: C:\Users\User\Desktop\vibecoding\tower-wp\RIG-001
이 폴더 안에서만 읽고 쓴다.

1. 시작 확인 — 하나라도 다르면 작업하지 말고 그 출력만 보고한다.
   - git rev-parse HEAD → bc3ee0720912d33ff2b96602c365cfdd38e37521
   - npm ci 성공, npx playwright install chromium 성공
   - node tools/contract-hash.mjs RIG-001 의 해시가 REQUEST.md 머리말 contractHash와 모두 같다
   - 5173 포트에 떠 있는 서버가 없다. Windows PowerShell: Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue / macOS: lsof -nP -iTCP:5173 -sTCP:LISTEN 의 출력이 비어 있어야 한다. e2e는 이미 떠 있는 서버를 그대로 쓰므로, 비어 있지 않으면 멈추고 보고한다.

2. 할 일 — docs/work-packages/RIG-001/REQUEST.md를 끝까지 읽고 그대로 따른다.
   - 원화는 public/assets/manifest.json 의 integrated_pass 항목이다(enemy.walker.0~3). 렌더러는 enemyPose(...)의 { frame, bob, squashY }만 그린다.
   - 발 교대가 보이고 접지 기준점이 프레임마다 흔들리지 않으며, 걸음 빠르기가 speedBP에 맞아야 한다. 정지·감소된 모션에서는 bob·squash가 0이다.
   - 피격 프레임(enemy.walker.hit)을 쓰려면 렌더러 연결이 더 필요하다. BattleScene.ts는 고치지 말고 REQUESTED_CONTRACT_CHANGE로 적는다.
   - npm run dev 후 브라우저 창을 앞에 두고 실제 크기와 확대에서 본다. 탭이 뒤로 가면 게임이 정지하는 것이 정상이다.

3. 범위
   - 쓸 수 있는 곳: src/game/animation/**, tests/unit/animation*.test.ts, docs/work-packages/RIG-001/RETURN.md 뿐이다.
   - 하지 않는다: 그 밖의 파일 수정, 판정·이동 진행도·보상을 애니메이션 시간으로 만들기, 패키지 설치·업그레이드, git commit·push.

4. 검사: npm run typecheck, npx eslint src/game/animation tests/unit, npm test, npm run test:e2e 통과.

5. 끝낼 때: 요청서의 ‘RETURN.md’대로 바꾼 파일, 실제 크기·확대 캡처(접촉판), 프레임 시간표, 요청한 연결점 변경을 쓴다. git status --short 에 허용 경로만 보이는지 확인하고 다섯 줄 안으로 보고한다.
```

## 1차(2026-10-28 발행·반환 완료, 이력)

READY 네 개를 동시에 보낼 때 각 모델의 **새 대화**에 아래 블록을 그대로 붙여 넣었다. Argon의 두 작업, Codex의 두 작업은 서로 다른 대화로 보냈다.

- 기준 commit: `ee5833846f0aa227ea3a6e2fe89257b02bae0e33`(docs/prd-v0-5)
- 작업마다 전용 작업 폴더(git worktree)가 있다. 서로 다른 폴더라 한쪽이 만든 미완성 문항·원화가 다른 쪽 `npm test`를 깨뜨리지 않는다.
- 작업 폴더는 컴퓨터마다 따로 있다(worktree와 `wp/*` 브랜치는 GitHub에 올라가지 않는다). 아래 프롬프트는 **Windows PC**(`C:\Users\User\Desktop\vibecoding\towerdeffense`) 경로로 적었다. 집 Mac에서 보낼 때는 `C:\Users\User\Desktop\vibecoding\tower-wp\` 를 `/Users/bodyking/Desktop/vibecoding/tower-wp/` 로 바꾼다. 결과도 보낸 컴퓨터의 작업 폴더에만 생긴다.

| jobId | 보낼 곳 | 작업 폴더(Windows PC) | 작업 폴더(집 Mac) | 브랜치 |
|---|---|---|---|---|
| Q20-001 | Argon 4, 대화 1 | `C:\Users\User\Desktop\vibecoding\tower-wp\Q20-001` | `/Users/bodyking/Desktop/vibecoding/tower-wp/Q20-001` | `wp/Q20-001` |
| UI-AUDIT-001 | Argon 4, 대화 2 | `C:\Users\User\Desktop\vibecoding\tower-wp\UI-AUDIT-001` | `/Users/bodyking/Desktop/vibecoding/tower-wp/UI-AUDIT-001` | `wp/UI-AUDIT-001` |
| ART-SAMPLE-001 | Codex, 세션 1(이미지 생성 가능) | `C:\Users\User\Desktop\vibecoding\tower-wp\ART-SAMPLE-001` | `/Users/bodyking/Desktop/vibecoding/tower-wp/ART-SAMPLE-001` | `wp/ART-SAMPLE-001` |
| REVIEW-CORE-001 | Codex, 세션 2(새 문맥) | `C:\Users\User\Desktop\vibecoding\tower-wp\REVIEW-CORE-001` | `/Users/bodyking/Desktop/vibecoding/tower-wp/REVIEW-CORE-001` | `wp/REVIEW-CORE-001` |

각 폴더의 `git status`에는 총괄이 머리말(`baseCommit`·`contractHash`)을 채운 `REQUEST.md` 한 줄이 보이는 것이 정상이다. 모델은 커밋하지 않는다. 총괄이 폴더에서 결과를 받아 [작업 패키지](README.md)의 ‘받을 때’ 절차로 들인다.

### Q20-001 → Argon 4(대화 1)

```text
[Q20-001] 3학년 어휘 문항 초안 20개

너는 초등 3~6학년용 한국어 어휘 타워 디펜스 웹게임의 문항 작성자다. 총괄은 Claude Opus 5.5이고, 너는 이 작업 하나만 맡는다. 다른 모델들이 다른 폴더에서 동시에 일하고 있다.

작업 폴더: C:\Users\User\Desktop\vibecoding\tower-wp\Q20-001
이 폴더 안에서만 읽고 쓴다. 본 저장소 폴더(towerdeffense)나 다른 tower-wp 폴더는 열지 않는다.

1. 시작 확인 — 하나라도 다르면 작업하지 말고 그 출력만 보고한다.
   - git rev-parse HEAD → ee5833846f0aa227ea3a6e2fe89257b02bae0e33
   - git status --short → docs/work-packages/Q20-001/REQUEST.md 한 줄(총괄이 머리말을 채운 것)
   - npm ci 성공
   - node tools/contract-hash.mjs Q20-001 의 해시가 REQUEST.md 머리말 contractHash와 모두 같다

2. 할 일 — docs/work-packages/Q20-001/REQUEST.md를 끝까지 읽고 절차 1~6을 순서대로 따른다. 이 메시지와 요청서가 다르면 요청서가 우선이다.
   - 학년 근거(gradeBasis)는 현행 3학년 국어 교과서(2022 개정 3-1·3-2, 국어·국어 활동)에서 실제로 찾은 단원만 쓴다. 못 찾은 낱말은 빼고 sidecar의 rejected에 사유를 적는다.
   - 사전 근거는 표준국어대사전 상세 페이지 https://stdict.korean.go.kr/search/searchView.do?word_no=<번호>&searchKeywordTo=3 를 실제로 열어 확인한다. 묻는 뜻 번호 하나를 정하고, 뜻풀이만 evidence/<artifactId>.txt(UTF-8)로 저장해 SHA-256을 적는다. 용례·이미지는 복제하지 않는다.
   - 웹에 접속할 수 없거나 근거를 확인할 수 없으면 근거를 지어내지 말고 그 사실을 RETURN.md에 적고 멈춘다.
   - 빈칸 문항은 네 보기를 조사·어미까지 붙여 실제로 넣어 보고, 정답이 하나뿐인지 sidecar에 남긴다.
   - status는 draft 또는 machine_checked만 쓴다. 20개를 채우려고 근거 없는 문항을 넣지 않는다.

3. 범위
   - 쓸 수 있는 곳: content-source/batches/Q20-001/** 와 docs/work-packages/Q20-001/RETURN.md 뿐이다.
   - 하지 않는다: 그 밖의 파일 수정(src·docs·package.json·스키마), 패키지 설치·업그레이드, 검사 규칙 완화, git commit·push.
   - 스키마나 검사 규칙이 잘못됐다고 판단되면 고치지 말고 RETURN.md에 REQUESTED_CONTRACT_CHANGE로 적는다.

4. 검사: npm run validate:content 를 통과시킨다. 같은 실패가 세 번 나오면 고치기를 멈추고 시도·가설·오류 원문을 RETURN.md에 적는다.

5. 끝낼 때: 요청서의 ‘RETURN.md에 쓸 것’대로 RETURN.md를 쓴다(실제 모델명·작업일·validate:content 실제 출력 포함). git status --short 에 허용 경로와 REQUEST.md 한 줄만 보이는지 확인하고, 만든 수·뺀 수·막힌 점을 다섯 줄 안으로 보고한다.
```

### UI-AUDIT-001 → Argon 4(대화 2)

```text
[UI-AUDIT-001] 화면 반려 기준 점검과 CSS 보정

너는 초등 3~6학년용 한국어 어휘 타워 디펜스 웹게임의 UI 점검자다. 총괄은 Claude Opus 5.5이고, 너는 이 작업 하나만 맡는다. 다른 모델들이 다른 폴더에서 동시에 일하고 있다.

작업 폴더: C:\Users\User\Desktop\vibecoding\tower-wp\UI-AUDIT-001
이 폴더 안에서만 읽고 쓴다. 본 저장소 폴더(towerdeffense)나 다른 tower-wp 폴더는 열지 않는다.

1. 시작 확인 — 하나라도 다르면 작업하지 말고 그 출력만 보고한다.
   - git rev-parse HEAD → ee5833846f0aa227ea3a6e2fe89257b02bae0e33
   - git status --short → docs/work-packages/UI-AUDIT-001/REQUEST.md 한 줄(총괄이 머리말을 채운 것)
   - npm ci 성공, npx playwright install chromium 성공
   - node tools/contract-hash.mjs UI-AUDIT-001 의 해시가 REQUEST.md 머리말 contractHash와 모두 같다
   - 5173 포트에 떠 있는 서버가 없다. Windows PowerShell: Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue / macOS: lsof -nP -iTCP:5173 -sTCP:LISTEN 의 출력이 비어 있어야 한다. e2e는 5173에 이미 떠 있는 서버를 그대로 쓰므로, 다른 폴더의 서버가 떠 있으면 남의 화면을 검사하게 된다. 비어 있지 않으면 멈추고 보고한다.

2. 할 일 — docs/work-packages/UI-AUDIT-001/REQUEST.md를 끝까지 읽고 그대로 따른다. 이 메시지와 요청서가 다르면 요청서가 우선이다.
   - 먼저 npm run test:e2e 를 한 번 돌리고 test-results/shots/ 를 test-results/before/ 로 복사해 ‘전’ 캡처로 쓴다.
   - 요청서의 화면 목록 × 크기(1440×900, 1366×650, 1024×690, 768×950, 390×664, 320×460, 글자 크게·아주 크게)를 PRD §12.8 11항목과 요청서 추가 항목으로 점검한다. 대비는 실제 합성색으로 잰다.
   - 직접 볼 때는 npm run dev 후 브라우저 창을 앞에 둔다. 탭이 뒤로 가면 게임이 정지하는 것이 정상이다.

3. 범위
   - 고칠 수 있는 곳: src/ui/**/*.module.css (src/ui/kit.module.css 제외) 와 docs/work-packages/UI-AUDIT-001/RETURN.md 뿐이다.
   - 하지 않는다: src/ui/styles/global.css·kit.module.css·*.tsx·copy.ts 수정(문구·구조·동작·새 토큰은 RETURN.md에 REQUESTED_CONTRACT_CHANGE로 위치·현재·제안·PRD 절을 적는다), UI 키트·CSS 프레임워크 도입, 패키지 설치·업그레이드, git commit·push.

4. 검사: 고친 뒤 npm run test:e2e 를 통과시킨다. 같은 실패가 세 번 나오면 고치기를 멈추고 시도·가설·오류 원문을 RETURN.md에 적는다.

5. 끝낼 때: 요청서의 ‘RETURN.md’ 절대로 화면×크기 점검표(pass/fail+근거), 바꾼 CSS와 이유, 제안 목록, 전후 캡처 경로(test-results/before/, test-results/shots/), test:e2e 실제 결과를 쓴다. 취향 차이는 ‘사용자 판단’으로 따로 적는다. git status --short 에 허용 경로와 REQUEST.md 한 줄만 보이는지 확인하고, fail 수·고친 수·제안 수를 다섯 줄 안으로 보고한다.
```

### ART-SAMPLE-001 → Codex(세션 1, 이미지 생성)

```text
[ART-SAMPLE-001] 원화 표본 16장 + manifest

너는 초등 3~6학년용 한국어 어휘 타워 디펜스 웹게임의 2D 원화 제작자다. 총괄은 Claude Opus 5.5이고, 너는 이 작업 하나만 맡는다. 다른 모델들이 다른 폴더에서 동시에 일하고 있다.

작업 폴더: C:\Users\User\Desktop\vibecoding\tower-wp\ART-SAMPLE-001
이 폴더 안에서만 읽고 쓴다. 본 저장소 폴더(towerdeffense)나 다른 tower-wp 폴더는 열지 않는다.

1. 시작 확인 — 하나라도 다르면 작업하지 말고 그 출력만 보고한다.
   - git rev-parse HEAD → ee5833846f0aa227ea3a6e2fe89257b02bae0e33
   - git status --short → docs/work-packages/ART-SAMPLE-001/REQUEST.md 한 줄(총괄이 머리말을 채운 것)
   - npm ci 성공
   - node tools/contract-hash.mjs ART-SAMPLE-001 의 해시가 REQUEST.md 머리말 contractHash와 모두 같다
   - 이 환경에서 실제 RGBA 알파(PNG 색 형식 6) 이미지를 생성할 수 있다. 할 수 없으면 아무것도 만들지 말고 그 사실만 보고한다.

2. 할 일 — docs/work-packages/ART-SAMPLE-001/REQUEST.md를 끝까지 읽고 그대로 따른다. 이 메시지와 요청서가 다르면 요청서가 우선이다.
   - 화풍 기준은 docs/assets/design-41-kingdom-expedition.png 다. 생성할 때 참조 이미지로 붙이고, 요청서의 공통 머리말과 장별 꼬리를 쓴다.
   - 납품은 표의 ID 그대로 PNG 16장(표 12행: 타워 몸체·무기 6, 고블린 걷기 4·피격 1, 대장 걷기 2, 성문·나무·비석 3)이다. 크기·기준점·displayCells·layer·muzzle을 표와 정확히 맞춘다.
   - 같은 캐릭터의 프레임은 기준 이미지 하나에서 파생해 얼굴·장비·몸 크기·외곽선 두께를 맞춘다. 비석에는 글자를 그리지 않는다.
   - 투명 배경을 만들지 못한 장은 배경을 억지로 지우지 말고 그 ID를 HOLD로 남긴다. 같은 결함으로 세 번 실패하면 그 ID를 HOLD로 남기고 다음 ID로 넘어간다.
   - manifest.json은 src/contracts/assetManifest.ts 스키마 그대로, status는 draft만 쓴다. sourceHash·artifactHash는 실제 파일의 SHA-256이다.
   - 32/48/64px로 줄인 참고판 contact-sheet.png를 만들어 타워 셋이 이름 없이 구별되는지, 고블린 4포즈가 같은 캐릭터인지 직접 본다.

3. 범위
   - 쓸 수 있는 곳: asset-source/incoming/ART-SAMPLE-001/** 와 docs/work-packages/ART-SAMPLE-001/RETURN.md 뿐이다.
   - 하지 않는다: src·public·docs(RETURN.md 제외)·package.json 수정, public/assets로 옮기기, status를 draft 밖으로 올리기, 패키지 설치·업그레이드, git commit·push.

4. 검사: npm run validate:assets 를 통과시킨다. 통과하지 못한 장은 고치거나 HOLD로 남긴다.

5. 끝낼 때: 요청서의 ‘RETURN.md에 쓸 것’대로 장별 생성 방식·실제 모델명·재생성 횟수·HOLD 사유·validate:assets 실제 출력·참고판 경로를 쓴다. 생성 성공을 visual_pass라고 적지 않는다. git status --short 에 허용 경로와 REQUEST.md 한 줄만 보이는지 확인하고, 납품 수·HOLD 수를 다섯 줄 안으로 보고한다.
```

### REVIEW-CORE-001 → Codex(세션 2, 새 문맥)

```text
[REVIEW-CORE-001] 게임 규칙 엔진 독립 검토

너는 초등 3~6학년용 한국어 어휘 타워 디펜스 웹게임의 독립 검토자다. 엔진은 총괄 Claude Opus 5.5가 구현했고, 너는 구현자와 같은 맹점을 갖지 않도록 PRD 문장만을 기준으로 검토한다. 다른 모델들이 다른 폴더에서 동시에 일하고 있다.

작업 폴더: C:\Users\User\Desktop\vibecoding\tower-wp\REVIEW-CORE-001
이 폴더 안에서만 읽고 쓴다. 본 저장소 폴더(towerdeffense)나 다른 tower-wp 폴더는 열지 않는다.

1. 시작 확인 — 하나라도 다르면 작업하지 말고 그 출력만 보고한다.
   - git rev-parse HEAD → ee5833846f0aa227ea3a6e2fe89257b02bae0e33
   - git status --short → docs/work-packages/REVIEW-CORE-001/REQUEST.md 한 줄(총괄이 머리말을 채운 것)
   - npm ci 성공, npm test 통과(검토 전 기준선)
   - node tools/contract-hash.mjs REVIEW-CORE-001 의 해시가 REQUEST.md 머리말 contractHash와 모두 같다

2. 할 일 — docs/work-packages/REVIEW-CORE-001/REQUEST.md의 ‘검토 지시’를 그대로 따른다. 이 메시지와 요청서가 다르면 요청서가 우선이다.
   - 기준은 vocabulary_td_prd_v0_5.md §3·§4·§5·§7·§8·§20 과 docs/contracts/balance.candidate.v0.3.json 이다. 구현 코드나 기존 시험을 정답으로 삼지 않는다.
   - 결함마다 tests/review/<짧은이름>.test.ts 에 지금 실패하는 Vitest 시험을 하나 쓴다. 기대값은 PRD 문장에서 가져오고, 그 문장(절 번호 포함)을 시험 위 주석으로 남긴다. tests/unit/helpers.ts 는 가져다 써도 된다.
   - 처음부터 통과하는 시험은 결함 증거가 아니므로 내지 않는다. 기대값을 구현에 맞추지 않는다.
   - PRD가 모호하거나 서로 충돌하면 결함이 아니라 ‘PRD 질문’으로 따로 적는다.

3. 범위
   - 쓸 수 있는 곳: tests/review/** 와 docs/work-packages/REVIEW-CORE-001/RETURN.md 뿐이다.
   - 하지 않는다: 결함을 찾아도 src/** 를 고치지 않는다(고치는 것은 총괄). tests/unit/**·package.json·설정 수정, 패키지 설치·업그레이드, git commit·push.

4. 검사
   - npx vitest run tests/review → 낸 시험이 모두 실패하는 것이 정상이다. 실패 이유가 타입 오류·가져오기 오류가 아니라 단언 불일치인지 확인한다.
   - npm run typecheck 와 npx eslint tests/review 통과, npm test 는 계속 통과.

5. 끝낼 때: 요청서의 ‘RETURN.md’ 절대로 결함마다 PRD 절·문장, 재현(파일·시험 이름), 실제/기대, 학생에게 보이는 영향, 심각도(공개 차단/높음/보통)를 쓰고, PRD 질문 목록을 붙인다. 결함이 없으면 ‘없음’과 함께 무엇을 어떻게 확인했는지 쓴다. git status --short 에 허용 경로와 REQUEST.md 한 줄만 보이는지 확인하고, 결함 수·심각도별 수·PRD 질문 수를 다섯 줄 안으로 보고한다.
```

## 보낸 뒤(총괄)

- 실제로 보낸 작업만 [작업 게시판](../EXECUTION_BOARD.md)에서 RUNNING으로 바꾸고 보낸 시각을 적는다.
- 반환되면 그 작업 폴더에서 `git status --short`로 허용 경로만 바뀌었는지 보고, 허용 경로의 파일만 본 저장소로 들인다.
- 다 받은 뒤 작업 폴더를 지운다: `git worktree remove ../tower-wp/<jobId>` 후 `git branch -D wp/<jobId>`.
- 다른 컴퓨터로 옮겨 이어 하려면, 받은 결과를 본 저장소에 커밋·push한 뒤 옮긴다. 작업 폴더째로는 옮겨지지 않는다.
