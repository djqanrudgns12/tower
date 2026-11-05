# 호스팅 구현 계획서 (단계별)

작성: 2026-11-05 · 총괄 Claude. **무엇을, 왜**는 [호스팅·운영 계획서 2판](HOSTING_PLAN.md)이 기준이다. 이 문서는 **어떤 순서로, 어떤 파일을, 어디까지 하면 끝인지**를 적는다. 상태가 바뀌면 §0 표를 고친다.

---

## 0. 한눈에

| 단계 | 하는 일 | 맡는 쪽 | 먼저 끝나야 할 것 | 상태 |
|---|---|---|---|---|
| 1 | **전투 그림 WebP 전환**(378장) + 변환 도구·규칙 시험 | Claude 서브에이전트 | 없음 | **완료** `9c476cc`(14.19MB → 3.20MB, 알파 불일치 0, 예외 0) |
| 2 | **고른 맵 그림만 받기** | 단계 1과 같은 서브에이전트 | 단계 1 | 진행 중 |
| 3 | **서버 작성**(Cloudflare Workers + D1) | Claude 서브에이전트 | 없음 | **완료** `1d5df7e`·`5c25030`·`ccf31c2`(서버 시험 57/57), Codex 검토 중 |
| 4 | **화면 그림 WebP 전환**(UI 아이콘·설명서 그림) | R5 담당 또는 총괄 | R5 P3 관문(`src/ui/**`를 R5가 쓰는 중) | 대기 |
| 5 | **앱을 새 서버에 연결** | Claude | 단계 3 | 대기 |
| 6 | **배포 장치**(GitHub Actions·Worker 설정·`supabase/` 보관) | Claude | 단계 5, 사용자 결정 A | 대기 |
| 7 | **실제로 올리고 연결 확인** | 사용자 + Claude | 단계 6, 사용자 할 일 B~E | 대기 |
| 8 | **출시 뒤**: 다시 열 때 바로 뜨게(서비스 워커), 실기기·학교 망, 월 점검 | Claude + 사용자 | 단계 7 | 대기 |

```
단계 1 → 2 ┐
           ├→ 단계 5 → 6 → 7 → 8
단계 3 ────┘
단계 4: R5 P3 뒤 언제든(다른 단계와 겹치지 않음)
```

단계 1·2와 단계 3은 고치는 파일이 겹치지 않아 **동시에** 한다.

---

## 1. 실측: WebP로 얼마나 줄어드나 (2026-11-05, 이 맥)

전투 시작 때 받는 인수 그림 378장 전체를 시험 변환했다(`cwebp` 1.x).

| 묶음 | 지금 PNG | WebP 손실 q85 · 투명도 무손실 | 무손실 WebP |
|---|---|---|---|
| 타워(154장) | 6.14MB | **1.37MB (22%)** | 4.05MB (66%) |
| 맵 재료(74장) | 3.91MB | **0.78MB (20%)** | 2.55MB (65%) |
| 그 밖(몬스터·지면·장식 등) | 4.13MB | **1.05MB (25%)** | 2.84MB (69%) |
| **합계 378장** | **14.19MB** | **3.20MB (23%)** | 9.45MB (67%) |

- 무손실 WebP는 33%만 줄어 효과가 작다. **기본은 손실 q85, 투명도는 무손실**로 한다.
- q90은 3.68MB(26%)인데 화질 수치는 q85와 거의 같았다(표본 PSNR 차이 0.4~1dB). 그래서 q85를 기본으로 한다.
- 화질 수치(표본 16장): PSNR 31~45dB. 낮은 쪽(서리 탑 B1 31dB)은 반투명 테두리의 색 차이다. 수치만으로 판정하지 않고, 실제 칸 크기(72px) 비교판을 눈으로 본다.
- **고른 맵만 받기까지 더하면**: 정원 맵 판은 306장, PNG 10.35MB → WebP **2.43MB**. JS 0.6MB를 더해 **첫 전투 전 다운로드 약 14MB → 약 3MB**다.
- **기기 지원**: WebP는 Safari 14(2020), 크롬 32부터 된다. 이 앱의 빌드 목표는 이미 `es2023`(`vite.config.ts`)이라 그보다 새 브라우저가 필요하다. WebP 때문에 못 여는 기기는 새로 생기지 않는다. 홈 맵 미리보기 4장과 참나무 화면 원화 12장은 이미 WebP로 돌고 있다.

---

## 2. 그림 WebP 규칙 (지금 그림과 앞으로의 그림 모두)

### 2.1 무엇을 어떻게 바꾸나 (선별 기준)

| 그림 | 형식 | 설정·이유 |
|---|---|---|
| 게임에 싣는 원화: 타워·몬스터·맵 재료·장식·효과·UI 원화·설명서 그림 | **WebP 손실** | `cwebp -q 85 -alpha_q 100 -m 6`. 투명도(알파)는 무손실이라 그림 테두리와 투명 영역이 그대로다 |
| 비교판에서 번짐·테두리 얼룩·색 띠가 보이는 그림 | WebP 손실 q92 → 그래도 보이면 **무손실 WebP** | 예외 목록에 이유를 적는다 |
| 바꿔도 거의 안 작아지는 그림(WebP가 PNG의 90% 이상) | **PNG 유지** | 예외 목록에 이유를 적는다 |
| 기준 그림·증거 자료(`docs/assets/**`, 해시로 묶인 파일), QA 캡처, 생성 원본(`asset-source/**`) | **PNG 그대로** | 게임에 싣지 않는 파일이다. 원본은 다시 처리할 때 쓴다 |
| 브라우저 탭 아이콘·홈 화면 추가 아이콘(생기면) | **PNG** | iOS 홈 화면 아이콘은 PNG를 요구한다 |

### 2.2 앞으로 그림을 넣는 순서 (모든 에이전트)

1. 생성 원본은 지금처럼 `asset-source/<작업 ID>/`에 PNG로 둔다.
2. 인수한 그림은 `node tools/assets/to-webp.mjs <PNG 파일…>`로 바꿔 `public/assets/`에 `.webp`로 넣는다. 이 도구는 단계 1에서 만든다.
3. `manifest.json`의 `file`은 `.webp`, `artifactHash`는 WebP 파일의 해시로 적는다. `sourceHash`는 원본 해시 그대로다.
4. 실제 칸 크기 비교판(PNG와 WebP를 나란히)으로 눈 확인을 한다. 예외는 `tools/assets/webp-exceptions.json`에 파일과 이유를 적는다.
5. 단위 시험이 `public/assets/`에서 예외 목록 밖의 PNG를 찾으면 실패한다. 잊어도 시험에서 걸린다.
6. 그림 작업 요청서(ART-*)에는 "인수물은 WebP(구현 계획서 §2)" 한 줄을 넣는다. 지금 진행 중인 ART-OAK2부터 적용한다.

같은 규칙을 [AGENTS.md](../AGENTS.md)와 [아트 기준 v2 §6](renewal/art-bible-v2.md)에도 적었다.

### 2.3 저장소 크기 (사용자 결정 대기)

- 저장소 이력이 이미 371MB다(GitHub 권장 1GB). 대부분이 `asset-source/`의 생성 원본·탈락 시안이다(비압축 약 390MB). 실제 게임 그림은 16MB뿐이다.
- 제안: **앞으로 탈락 시안은 커밋하지 않고, 인수한 원본만 커밋한다.** 이미 커밋한 이력은 건드리지 않는다(이력 다시 쓰기는 하지 않는다).
- 이 방침은 사용자가 정한다. 정하기 전까지는 지금처럼 한다.

---

## 3. 단계별 상세

### 단계 1 · 전투 그림 WebP 전환

**하는 일**
- 변환 도구 `tools/assets/to-webp.mjs`를 만든다.
  - `cwebp`가 없으면 설치 방법(`brew install webp`)을 알리고 멈춘다.
  - §2.1 기본값으로 바꾼다. 바꾼 뒤 PNG와 WebP의 알파 경계 상자(불투명 영역의 가장자리)가 같은지 확인한다. `src/game/layoutGround.ts`가 알파로 그림 배치를 잡기 때문이다.
  - 실제 칸 크기 비교판(PNG|WebP 나란히)을 `asset-source/renewal/WEBP-1/`에 만든다.
- `manifest.json`의 `integrated_pass` 378장을 WebP로 바꾼다. `file`·`artifactHash`를 갱신하고 `sourceHash`는 그대로 둔다. 옛 PNG는 `public/assets/`에서 뺀다(git 이력에 남아 되살릴 수 있다).
- 계약 `src/contracts/assetManifest.ts`의 `file` 규칙을 `.png` 전용에서 `.webp`(예외만 `.png`)로 바꾼다.
- 시험: "`public/assets/`에 예외 목록 밖 PNG 없음"을 더한다. 기존 해시 시험(`tests/unit/content.test.ts`)은 새 해시로 통과해야 한다.

**고치는 파일**: `tools/assets/**`(새로 만듦), `public/assets/` 바로 아래의 manifest 그림, `public/assets/manifest.json`, `src/contracts/assetManifest.ts`, `tests/unit/content.test.ts`와 새 시험, `asset-source/renewal/WEBP-1/`(새로 만듦)
**건드리지 않는 파일**: `public/assets/ui/**`, `public/assets/guide/**`, `public/assets/maps/**`, `src/ui/**`(단계 4와 R5 몫)

**끝 기준**
- `npm run verify`와 전투 e2e가 통과한다.
- 비교판 눈 확인(타워 형태별 표본, 몬스터, 맵 재료)을 통과한다.
- 전후 용량 표가 있다.

### 단계 2 · 고른 맵 그림만 받기

**하는 일**
- `BattleScene`이 그림을 미리 받을 때, 지금 맵의 재료(`map.<지금 맵>.*`)와 공용 그림만 받는다. 다른 맵 재료는 받지 않는다.
- 개발 전용 `?previewMap` 미리보기도 그 맵 것만 받는다.
- 하지 않는 것: 진화형을 나중에 받는 방식. WebP 뒤 타워 그림 전체가 1.37MB라 얻는 것이 작고, 진화 순간에 그림이 늦게 뜰 위험만 생긴다.

**고치는 파일**: `src/game/BattleScene.ts`, 필요하면 `src/game/assets.ts`, 해당 시험

**끝 기준**
- 정원 맵 첫 전투 전 다운로드를 실측해 **약 3MB 이하**(JS 포함)를 확인한다.
- 다른 맵 미리보기가 정상으로 뜬다.
- verify가 통과한다.

### 단계 3 · 서버 작성 (Cloudflare Workers + D1)

**하는 일**: 지금 Supabase가 하던 일을 그대로 옮긴다.

| 지금(Supabase) | 새 서버(`server/`) |
|---|---|
| `/auth/v1/signup` 익명 로그인 | `POST /v1/device`: 기기 ID 발급 + 서명 토큰(HMAC, Worker 비밀값). 학교 IP 하나에 한 반이 몰려도 막지 않는다 |
| `record_lobby_visit` + 실시간 접속 웹소켓 | `POST /v1/lobby-visit`: 응답에 "최근 5분 안에 홈을 연 기기 수"를 담는다 |
| `record_run_start` | `POST /v1/runs/start` |
| `submit_completed_run`(서버 재채점) | `POST /v1/runs/submit`: `src/contracts/lobby.ts`를 그대로 가져다 재채점한다 |
| `get_leaderboard_slice` | `GET /v1/leaderboard` |
| `app.player_salt`(DB 설정) | Worker 비밀값 `PLAYER_SALT`(사용자가 직접 넣음, 계획서 §6 C) |
| `question_keys.seed.sql` | `tools/build-question-keys.mjs`가 D1(SQLite)용 SQL도 만든다 |

- 지키는 것
  - 기기·IP별 속도 제한은 D1 표로 한다(유료 기능에 기대지 않는다).
  - 허용 출처(CORS)는 설정값 `ALLOWED_ORIGINS`로 정한다. 학생 주소가 정해지기 전에도 코드를 쓸 수 있다.
  - 요청 크기 제한, 쓰기는 D1 batch로 묶는다.
- 비상 대체를 쉽게: 저장소 접근을 얇은 층 하나로 묶어, 맥미니에서 Node 24 내장 `node:sqlite`로 바꿔 끼울 수 있게 한다(실행기는 필요할 때만 만든다).
- 시험: 로컬 D1로 Worker 시험을 돌린다. 기존 SQL 회귀 시험 3종(net-regression·http-failures·unicode-grapheme)의 경우를 그대로 옮긴다.

**고치는 파일**: `server/**`(새로 만듦), `package.json`·`package-lock.json`(wrangler 등 개발 의존성), `tools/build-question-keys.mjs`(D1 출력 추가)
**건드리지 않는 파일**: `src/**`(단계 5 몫), `supabase/**`(단계 6에서 보관 이동)

**끝 기준**
- 서버 시험이 통과한다.
- `wrangler dev` 로컬 서버에 curl로 가입 → 판 시작 → 제출(재채점) → 랭킹 흐름이 된다.
- 무료 한도 계산(판당 요청·D1 쓰기 행 수)을 보고한다.

### 단계 4 · 화면 그림 WebP 전환 (R5 P3 뒤)

- 대상
  - `public/assets/ui/*.png` 28장(0.43MB)
  - `public/assets/guide/*.png` 4장(0.99MB)
- 그림을 부르는 곳: kit `ArtIcon`, `RelicCard`, `guideModel`, `global.css`, `BattleScene` 특성 배지, `tests/unit/guide.test.ts`
- R5 P3가 `src/ui/**`를 쓰는 중이라, R5 P3 관문 뒤에 하거나 R5 메인에 넘긴다. 같은 파일을 동시에 고치지 않는다.
- 끝 기준: 예외 목록 밖 PNG 0, verify·e2e 통과, 화면 캡처 비교.

### 단계 5 · 앱을 새 서버에 연결

- `src/persistence/auth.ts`와 `lobbyClient.ts`를 새 서버로 바꾼다. 설정은 `VITE_API_BASE` 하나로 한다. `.env.example`도 고친다.
- 실시간 접속 웹소켓을 빼고, 홈 숫자를 "최근 5분" 기준으로 바꾼다. 홈 문구는 R5 홈 담당과 맞춘다.
- 서버가 없거나 꺼져도 "이 기기 기록" 모드로 도는 지금 동작을 그대로 지킨다.
- 랭킹 응답을 Worker 캐시에 30~60초 둔다(D1 읽기 한도, 계획서 §9.1). `npm run test:server`를 verify나 CI에 넣는다(서버가 `src/contracts/lobby.ts`를 가져다 쓰므로 계약 변경을 잡는다).
- 단계 3 보고의 차이점을 반영한다: 인증은 `Authorization: Bearer <기기 토큰>` 하나, 랭킹은 GET 쿼리, 숫자는 JSON 숫자만, 홈 접속자 수는 `recentVisitors`.
- 끝 기준: verify, e2e(서버 없는 모드 + 로컬 `wrangler dev` 연결 모드)가 통과한다.

### 단계 6 · 배포 장치 (사용자 결정 A 뒤)

- `.github/workflows/pages.yml`: 배포 브랜치에 push하면 빌드(`VITE_API_BASE` 주입) → `upload-pages-artifact` → `deploy-pages`.
- Vite `base`: 자체 도메인 루트에 올리므로 `/`로 둔다(GitHub 기본 주소 `…github.io/towerdeffense/`로 먼저 볼 때는 `./`).
- `server/wrangler.toml`: D1 연결, 서버 주소(예: `voca-api.<도메인>`)를 Worker 사용자 지정 도메인으로 붙인다.
- `docs/DEPLOY.md`를 새 방식으로 다시 쓴다. `supabase/`는 `docs/archive/supabase/`로 옮긴다(지우지 않는다).
- 배포 브랜치(`main` 추천)에 작업 브랜치를 병합한다. 사용자 결정 A 뒤에 한다.
- 끝 기준: 로컬 운영 빌드 통과, 워크플로 파일 점검.

### 단계 7 · 실제로 올리고 연결 확인

1. 사용자: 계획서 §6 B(Cloudflare 로그인 허락), C(비밀값 입력)
2. Claude: D1 만들기 → 표 만들기 → 정답 키 넣기 → Worker 배포
3. 사용자: §6 D(GitHub Pages 켜기), E(DNS 한 줄, **회색 구름**)
4. Claude: 첫 배포, 실제 주소로 가입·제출·랭킹 확인
5. 사용자: §6 F 확인

### 단계 8 · 출시 뒤

- **다시 열 때 바로 뜨게(서비스 워커)**
  - GitHub Pages는 캐시를 10분으로 고정한다. 그래서 다시 열면 그림 300여 개가 "바뀌었나요?"를 서버에 묻는다.
  - 서비스 워커가 `assets/`를 기기에 저장해 두고 바로 꺼내 쓰게 한다. `index.html`은 늘 네트워크를 먼저 본다.
  - 저장본 이름에 빌드 버전을 넣어, 새로 배포하면 저절로 바뀐다.
- 사용자: 실기기·학교 망 확인(§6 G), 월 1회 사용량 점검(§6 H)
- 총괄: 분기마다 저장소 크기 점검(§2.3)

---

## 4. 누가 무엇을 하나

| 쪽 | 맡는 일 |
|---|---|
| Claude 서브에이전트 ① | 단계 1·2(그림 가볍게). 위 파일 범위 안에서만 고치고 `git commit --only -- <경로>`로 커밋 |
| Claude 서브에이전트 ② | 단계 3(서버). 위 파일 범위 안에서만 고치고 경로 지정 커밋 |
| Codex | 단계 1·3 결과 독립 검토(짧게) |
| Antigravity | 필요하면 비교판 두 번째 눈 |
| 총괄 Claude | 결과 확인(diff·시험·실측), push, 이 문서와 계획서 갱신, 단계 5~7 |

---

## 5. 사용자가 정하거나 할 일 (언제 필요한가)

| 언제까지 | 무엇 | 자세히 |
|---|---|---|
| 단계 6 전 | **A. 학생 주소 이름, 배포 브랜치(`main` 병합)** | 계획서 §6 A |
| 단계 7 | B·C·D·E | 계획서 §6 |
| 출시 뒤 | G·H | 계획서 §6 |
| 언제든 | 탈락 시안을 커밋하지 않는 방침 | 이 문서 §2.3 |

단계 1~5는 사용자 결정 없이 진행한다.

---

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| WebP에서 그림이 뭉개짐 | 기본 q85 + 비교판 눈 확인. 걸리면 q92 → 무손실 → PNG 예외 순서로 올린다 |
| 투명 영역이 바뀌어 배치가 어긋남 | 투명도는 무손실로 둔다. 도구가 알파 경계 상자를 PNG와 비교한다 |
| R5 작업과 파일 충돌 | 단계 1~3은 `src/ui/**`를 건드리지 않는다. 화면 그림은 단계 4로 미룬다 |
| 새 서버 버그로 기록이 안 올라감 | 앱은 서버 오류 때 "이 기기 기록" 모드로 돈다(지금과 같음). 시험으로 막고, 출시 첫 주는 매일 본다 |
| 무료 한도 변경 | 계획서 §9 대체 경로(DNS 한 줄·설정 한 줄) |
