# 호스팅·운영 계획서 · 1.0.0

작성: 2026-11-04 · 총괄 Claude. 가격과 한도는 2026-11-04에 공식 문서로 다시 확인했다(출처는 §9). 서비스 가격은 바뀔 수 있으니 결제하기 전에 가격표를 한 번 더 본다.

배포 점검 결과와 짧은 명령 모음은 [DEPLOY.md](DEPLOY.md)에 있다. 이 문서는 **어디에 올리고, 언제 무엇을 키우며, 사람이 무엇을 해야 하는지**를 처음 하는 사람 기준으로 적는다.

---

## 0. 한눈에 보기

| 무엇 | 결정 | 비용 |
|---|---|---|
| 게임 파일(화면·그림) | **Cloudflare Workers**에 정적 파일로 올린다 | 0원(무제한) |
| 기록·랭킹 | **Supabase 새 프로젝트**(서울 리전). 무료로 시작한다 | 0원 → 정식 운영 때 월 $25 |
| 쓰지 않는 것 | Vercel, Cloudflare R2, 맥미니(쌤유니버스)에 붙이기, 롤린썬더 DB에 합치기 | — |
| 앱 가볍게 | 첫 전투 전에 받는 그림을 약 13MB에서 4~5MB로 줄인다(어림값, 작업 뒤 실측) | 0원 |

이용자가 크게 늘어도 비용이 거의 늘지 않는 구조다. 게임은 학생 브라우저 안에서 돌고, 서버는 판이 끝날 때 결과만 받기 때문이다.

---

## 1. 먼저 알아 둘 말

| 말 | 뜻 |
|---|---|
| 정적 파일 | 누가 열어도 똑같은 파일(HTML·JS·그림). 이 게임은 빌드하면 `dist/` 폴더에 정적 파일만 나온다 |
| 호스팅 | 그 파일을 인터넷 주소로 열 수 있게 맡겨 두는 곳 |
| CDN | 세계 곳곳(서울 포함)에 파일 사본을 두고 가까운 곳에서 보내 주는 전송망. 빠르고 서버가 지치지 않는다 |
| Cloudflare Workers / Pages | Cloudflare의 호스팅 두 가지. 둘 다 정적 파일을 CDN으로 무료·무제한 보낸다. Cloudflare는 새 프로젝트에 Workers를 권한다 |
| Cloudflare R2 | 파일 보관 창고. 보관 장소만 바꿀 뿐, 학생이 받는 용량을 줄이지 않는다 |
| Supabase | Postgres DB에 로그인·실시간 기능을 묶어 빌려주는 서비스. 이 게임은 랭킹·서버 채점에 쓴다 |
| 마이그레이션 | DB에 표와 함수를 만드는 SQL 파일. `supabase/migrations/`에 순서대로 있다 |
| RPC 함수 | 앱이 부르는 DB 안의 함수. 판 제출(`submit_completed_run`), 랭킹 조회(`get_leaderboard_slice`) 등 |
| 익명 로그인 | 이메일 없이 기기마다 보이지 않는 계정을 하나 만들어 주는 방식. 학생은 아무것도 입력하지 않는다 |
| publishable 키 | Supabase가 앱에 넣으라고 주는 공개 키(`sb_publishable_...`). 공개돼도 된다. **secret 키는 절대 앱에 넣지 않는다** |
| 비밀 소금값(salt) | 학생 기기 계정 번호를 랭킹에서 알아볼 수 없게 섞는 비밀 문자열. 없으면 기록 제출이 모두 실패한다 |
| 빌드 변수 | 빌드할 때 화면 코드에 박히는 설정값. 이 게임의 Supabase 주소·키가 여기에 들어간다 |
| MAU | 한 달 동안 한 번이라도 접속한 계정 수. 학생 기기 1대가 1로 세어진다 |
| 동시 연결 | 같은 순간 서버와 실시간 연결을 유지한 사람 수. 이 게임은 홈 화면에서만 연결한다 |
| 브랜치 | 코드의 갈래. 지금 작업은 `p1/intake-round1`, 학생에게 낼 판은 보통 `main` |

---

## 2. 이 게임은 서버를 얼마나 쓰나 (코드에서 확인)

- **올릴 파일**: `dist/` 22MB, 파일 약 510개(그림 410장). 가장 큰 파일은 0.3MB다.
- **전투 시작 때 받는 그림**: 378장, 약 13MB를 한꺼번에 받는다(`src/game/BattleScene.ts:41`). 이 중 아직 학생이 갈 수 없는 맵 3개(약 3.7MB)와 그 판에서 안 쓰는 진화형 그림이 섞여 있다.
- **서버 요청**: 아래가 전부다. 한 판이 15~25분이니 판마다 요청이 몇 개뿐이다.

| 언제 | 무엇 | 횟수 |
|---|---|---|
| 처음 기록 공유를 켤 때 | 익명 로그인(`/auth/v1/signup`) | 기기당 1번 |
| 홈에 들어올 때 | 방문 기록, 랭킹·통계 조회 | 1~2번 |
| 홈에 있는 동안 | 접속자 수 실시간 연결 1개(25초마다 신호) | 게임에 들어가면 끊김 |
| 판 시작 | `record_run_start` | 1번 |
| 판 끝 | `submit_completed_run`(서버가 답을 다시 채점) | 1번 |

- **어림셈**: 학생 1만 명이 동시에 해도 판 제출은 초당 10건 안팎이다. DB 한 대로 넉넉하다.
- **돈이 드는 곳은 두 군데**: 그림 전송량(Cloudflare가 무료로 처리)과 홈 화면 실시간 연결 수(Supabase 한도)다.

---

## 3. 결정과 이유

### 3.1 게임 파일 → Cloudflare Workers
- 정적 파일 요청은 **무료·무제한**이고 서울 거점에서 나간다.
- Cloudflare 공식 문서(2026-08-25)가 "새 프로젝트는 Workers로 시작하라"고 권한다. Pages도 종료 공지 없이 계속 동작하므로, Workers가 막히면 Pages로 같은 설정을 해도 된다.
- 한도는 배포당 파일 2만 개, 파일 하나 25MiB다. 이 게임(510개, 최대 0.3MB)과는 거리가 멀다.
- 스크립트 없이 파일만 올리므로 Workers의 "하루 10만 요청" 한도와 상관없다(그 한도는 스크립트를 실행하는 요청에만 붙는다).
- 설정 파일(`wrangler.jsonc`)은 Claude가 저장소에 넣는다(§7).

### 3.2 기록·랭킹 → Supabase 새 프로젝트
- 서버 채점 함수, 익명 로그인, 실시간 접속자 수가 이미 Supabase 기준으로 만들어져 있고 시험도 끝났다.
- 무료로 시작한다. 이 게임에 걸리는 무료 한도는 두 가지다.
  - **7일 동안 DB 활동이 적으면 일시정지**된다. 방학에 일어날 수 있다. 멈춰도 게임은 "이 기기 기록" 모드로 계속 돌고, 대시보드에서 다시 켜면 된다(정지 뒤 1년 안).
  - **실시간 동시 연결 200개**. 넘으면 홈의 접속자 수 표시만 4초 뒤 조용히 사라지고 게임은 멈추지 않는다.
- Supabase 사용을 끄고 싶으면 빌드 변수만 비우면 된다. 그러면 앱 전체가 이 기기 기록 모드로 안전하게 돈다.

### 3.3 Cloudflare R2를 쓰지 않는 이유
- R2는 파일 **보관 장소**만 바꾼다. 학생이 받는 용량은 그대로라 앱이 가벼워지지 않는다.
- Workers로 올려도 그림은 같은 Cloudflare 서울 거점에서 나간다.
- R2로 옮기면 손이 늘고 깨질 곳이 생긴다. 그림을 다른 주소에서 받으면 교차 출처 설정(CORS)이 필요하다. 이 게임은 전장 그림을 다시 아이콘으로 뽑아 쓰므로(`textures.getBase64`), 설정이 하나만 빠져도 타워·몬스터 아이콘이 깨진다.
- **R2가 필요해지는 때**
  - 그림을 코드 배포와 따로 자주 바꿔야 할 때
  - 학생·교사가 파일을 올리는 기능이 생길 때
  - 롤린썬더·쌤유니버스와 그림을 같이 쓸 때
  - 그때 비용: 무료로 월 10GB 보관, 전송료 없음.

### 3.4 Vercel을 쓰지 않는 이유
- 무료(Hobby)는 **비상업·개인 용도만** 허용한다. 유급 인력이 만들었거나 광고·결제가 있으면 상업으로 본다.
- 전송량이 월 100GB다. 처음 오는 기기 4~5천 대면 찬다. 넘으면 30일 동안 멈추고 추가 구매도 안 된다.
- Pro는 월 $20(전송 1TB 포함)다. 정적 게임에는 돈을 낼 이유가 없다.
- Vercel은 롤린썬더처럼 Next 서버 기능이 있는 서비스에 맞다.

### 3.5 맥미니(쌤유니버스)에 붙이지 않는 이유
- **메모리는 문제가 아니다.** 쌤유니버스 전체가 평소 약 0.8GB(`classlearning/infra/compose.yaml` 기록)이고, 이 게임을 붙여도 수십 MB 늘 뿐이다.
- **옮기는 일이 크다.** 서버 쪽이 Supabase 전용 기능(익명 로그인, `/rest/v1/rpc/` 호출 경로, 실시간 연결)에 기대고 있어서 맥미니 Postgres에서는 이걸 직접 꾸려야 한다. Supabase 전체를 맥미니에 설치하면 컨테이너가 여러 개 떠서 **그때 실제로 메모리를 크게 먹는다.**
- **고장이 함께 온다.** 정전·macOS 업데이트·재부팅 한 번에 수업 중 게임 랭킹과 교사용 쌤유니버스가 같이 멈춘다.
- **책임이 커진다.** 학생 기록을 집 컴퓨터 한 대에 두면 보안·백업을 직접 챙겨야 한다.

### 3.6 롤린썬더 DB에 합치지 않는 이유
- 두 서비스의 함수가 같은 `public` 공간에 섞인다.
- 롤린썬더의 DB 초기화 스크립트(`supabase/reset_db.sql`)를 한 번 돌리면 게임 기록까지 지워질 수 있다.
- 동시 연결 수와 MAU 한도를 나눠 쓴다.
- **예외**: 롤린썬더 Supabase가 이미 유료(Pro) 조직이라면 **같은 조직에 프로젝트만 하나 더** 만드는 건 좋다. DB는 따로 쓰고, 추가 비용은 월 약 $10이다.

### 3.7 서비스 한도 표 (2026-11-04 확인)

| 서비스 | 무료 | 유료 |
|---|---|---|
| Cloudflare Workers(정적) | 요청·전송 무제한, 파일 2만 개, 파일당 25MiB, 자동 빌드 월 3,000분 | 같은 정적 무제한, 파일 10만 개 |
| Supabase | DB 500MB, 전송 5GB, MAU 5만, 실시간 동시 200, 무료 프로젝트 2개(계정 전체), 7일 저활동 시 정지, 다운로드 가능한 백업 없음 | Pro 월 $25: DB 8GB, 전송 250GB, MAU 10만, 실시간 동시 500(지출 상한을 풀면 1만까지, 1,000개당 $10), 매일 백업 7일 보관, 정지 없음. 같은 조직의 추가 프로젝트 월 약 $10 |
| Vercel | 비상업만, 전송 100GB | Pro 월 $20, 전송 1TB |
| Cloudflare R2 | 보관 10GB, 쓰기 100만·읽기 1,000만 건, 전송료 없음 | 보관 GB당 월 $0.015 |

---

## 4. 출시 전에 꼭 고칠 것 (이번 조사에서 새로 나온 3가지)

| # | 문제 | 왜 중요한가 | 누가·어떻게 |
|---|---|---|---|
| 1 | **익명 로그인 한도: 같은 IP에서 시간당 30건** | 한 반 30명은 같은 학교 공인 IP로 나간다. 31번째 기기부터, 또는 옆 반이 이어서 들어오면 랭킹 연결이 실패한다. 게임 자체는 된다 | **사용자**: 대시보드에서 한도를 올린다(§6 B-4). 무료 플랜에서 바꿀 수 있는지는 공식 문서에 없어 직접 확인해야 한다. 안 되면 Claude에게 알려 준다 |
| 2 | **비밀 소금값을 넣는 방법** | DEPLOY.md의 `alter database postgres set app.player_salt` 방식은 호스팅 Supabase에서 막힐 수 있다(DB 소유자가 따로 있음). 소금값이 없으면 기록 제출이 모두 `PLAYER_SALT_REQUIRED`로 실패한다 | **Claude**: Supabase 금고(Vault)에서 소금값을 읽는 마이그레이션을 더한다. **사용자**: SQL 한 줄로 금고에 넣는다(§6 B-6) |
| 3 | **Supabase 새 API 키** | 2025-11부터 새 프로젝트는 예전 `anon` 키 대신 publishable 키를 준다. 예전 키는 2026년 말 폐지 예정이다 | 앱 코드를 확인한 결과 새 키와 맞는 방식이다(가입은 `apikey` 헤더만, 기록 호출은 학생 토큰 사용, 실시간 연결도 publishable 키 허용). **Claude**: 설정 이름을 `VITE_SUPABASE_PUBLISHABLE_KEY`로 바꾸고 옛 이름도 받게 한다. 프로젝트가 생기면 실제 연결을 시험한다 |

---

## 5. 단계별 계획

### P0 · 출시 (지금, 0원)
- **Claude**: §4의 2·3 코드 작업, Cloudflare 설정 파일, DEPLOY.md 갱신, 배포 브랜치 병합(요청 시)
- **사용자**: §6의 A~E
- **끝 기준**: 학교 기기에서 한 판을 끝내고 홈 랭킹에 닉네임이 뜬다.

### P1 · 앱 가볍게 (출시 직후, 0원, 전부 Claude)

| 순서 | 일 | 줄어드는 양 |
|---|---|---|
| ① | 지금 맵의 그림만 받기 | 약 3.7MB(28%) |
| ② | 타워 진화형 그림은 그 타워가 진화에 가까워질 때 받기 | 수 MB |
| ③ | 그림을 WebP로 바꾸기 | 남은 양의 절반 안팎 |
| ④ | 21웨이브부터 나오는 확장 종족 몬스터는 나중에 받기 | 약 0.8MB |

- **목표**: 첫 전투 전 다운로드를 13MB에서 4~5MB로 줄인다(어림값). 끝나면 실측해서 보고한다.
- **사용자**: 결과를 한 판 해 보고 확인만 한다.

### P2 · 정식 운영 (월 $25)
- **언제**: 아래 중 하나라도 해당되면 올린다.
  - 여러 학교가 쓰고 랭킹이 중요해졌다.
  - 방학 중 정지가 싫다.
  - 대시보드 사용량이 무료 한도의 80%를 넘었다.
  - 기록 백업이 필요하다.
- **무엇**: Supabase Pro로 올린다. 정지가 없어지고, 매일 백업이 7일 보관되며, 실시간 동시 연결 500개·MAU 10만이 된다.
- **사용자**: 결제는 직접 한다(Claude는 결제를 하지 않는다).
- **Claude**: 익명 로그인에 Cloudflare Turnstile(보이지 않는 로봇 확인)을 붙일지 검토한다. 오래된 익명 계정 정리는 랭킹 신원과 엮여 있어 따로 설계한다.

### P3 · 폭발 대비 (필요할 때만)
- **막히는 곳**: 홈 화면의 실시간 연결 하나뿐이다.
- **Claude**
  - 접속자 수를 실시간 연결 대신 1분마다 숫자 하나 받아오는 방식으로 바꾼다. 연결 비용이 0이 된다.
  - 랭킹 조회를 30초씩 캐시한다.
  - 그래도 넘치면 DB 사양을 한 단계 올린다.
- **언제**: 홈 동시 접속이 Pro 한도(500)의 70%를 넘을 때.

---

## 6. 사용자가 할 일 (순서대로)

메뉴 이름은 서비스가 화면을 바꾸면 조금 달라질 수 있다. 비슷한 이름을 찾으면 된다. 막히면 화면에 보이는 글을 Claude에게 그대로 알려 준다.

### A. 배포할 브랜치 정하기 (5분)
- **지금 상태**: 모든 작업은 `p1/intake-round1`에 있고, `main`보다 커밋 193개 앞서 있다.
- **추천**: `main`에 합친 뒤 `main`을 배포한다. "학생이 보는 판 = `main`"으로 정해 두면 헷갈리지 않는다.
- **할 일**: Claude에게 "main에 병합해"라고 말한다. 병합·push는 Claude가 한다.

### B. Supabase 프로젝트 만들기 (20~30분)
1. [supabase.com](https://supabase.com)에 로그인한다. 롤린썬더 계정을 그대로 써도 된다.
   - 무료 프로젝트는 **계정 전체에서 2개까지**다(정지된 프로젝트는 세지 않는다). 롤린썬더가 무료 프로젝트를 쓰고 있으면 남은 자리가 있는지 본다.
2. **New project**를 누르고 아래처럼 정한다.
   - 이름: `vocabulary-td`
   - Region: **Northeast Asia (Seoul)**
   - Database password: 길게 만들어 **비밀번호 관리자에 저장**한다. 채팅·저장소·메모장에 붙이지 않는다.
3. **Authentication → Sign In / Providers**에서 **Allow anonymous sign-ins**(익명 로그인)를 켜고 저장한다.
4. **Authentication → Rate Limits**에서 익명 로그인 한도(anonymous users)를 **시간당 1,000**으로 올린다.
   - 이 칸이 없거나 무료 플랜이라 막히면 Claude에게 알려 준다. 그러면 P2(Pro)를 앞당기거나 다른 방법을 찾는다.
5. **SQL Editor**에서 마이그레이션을 이름 순서대로 하나씩 붙여 넣고 **Run**을 누른다.
   - `supabase/migrations/20261030000001_lobby_telemetry_and_rankings.sql`
   - `supabase/migrations/20261030000002_authenticated_regraded_runs.sql`
   - `supabase/migrations/20261030131722_nickname_graphemes_and_receipts.sql`
   - `supabase/migrations/20261030132649_rpc_http_failures.sql`
   - Claude가 §7-1에서 더할 금고(Vault) 파일
6. **비밀 소금값 넣기** (§7-1 작업이 끝난 뒤)
   - 무작위 문자열은 맥 터미널에서 아래 명령으로 만든다. 나온 값을 비밀번호 관리자에 저장한다.
     ```bash
     openssl rand -base64 48
     ```
   - SQL Editor에서 `<무작위 문자열>` 자리에 그 값을 넣어 실행한다.
     ```sql
     select vault.create_secret('<무작위 문자열>', 'player_salt');
     ```
   - 이 값은 채팅·저장소에 남기지 않는다. 한 번 정하면 바꾸지 않는다. 바꾸면 기존 랭킹의 학생 구분이 끊긴다.
7. **정답 키 넣기**: `supabase/question_keys.seed.sql` 내용을 SQL Editor에 붙여 넣고 Run을 누른다.
8. **키 두 개 복사하기**
   - **Project URL**: 상단 **Connect** 버튼이나 **Project Settings → Data API**에 있다. `https://xxxx.supabase.co` 꼴이다.
   - **Publishable key**: **Project Settings → API Keys**에 있다. `sb_publishable_...` 꼴이다.
   - 이 두 값은 공개돼도 된다. **secret key는 복사하지도, 앱에 넣지도 않는다.**

### C. Cloudflare에 올리기 (20분)
1. [cloudflare.com](https://dash.cloudflare.com)에 무료로 가입한다.
2. **Workers & Pages → Create → Import a repository**를 고르고, GitHub를 연결해 저장소 `djqanrudgns12/tower`를 선택한다.
3. 설정 칸을 이렇게 채운다.
   - 프로젝트(Worker) 이름: `vocabulary-td` (Claude가 넣을 설정 파일의 이름과 같아야 한다)
   - Production branch: A에서 정한 브랜치(추천 `main`)
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. **Advanced settings → Build variables**에 두 개를 넣는다. 런타임 변수가 아니라 **빌드 변수**여야 한다. 이 값은 빌드할 때 화면 코드에 박히기 때문이다.
   - `VITE_SUPABASE_URL` = B-8의 Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = B-8의 Publishable key
5. **Node 버전**: 저장소의 `.nvmrc`(24.21.0)를 보통 자동으로 읽는다.
   - 빌드 기록에 Node가 v24가 아니라고 나오면 빌드 변수에 `NODE_VERSION` = `24.21.0`을 더한다.
6. **Deploy**를 누른다. 끝나면 `https://vocabulary-td.<계정 이름>.workers.dev` 꼴의 주소가 나온다.
   - 이후 브랜치에 push할 때마다 자동으로 다시 배포된다.
7. (선택) 도메인이 있으면 **Settings → Domains & Routes**에서 연결한다.

### D. 첫 확인 (15분)
1. C-6의 주소를 열고 한 판을 시작했다가 "이번 판 끝내기"로 끝낸다.
2. **설정 → 공개 기록**을 켜고 한 판을 더 끝낸 뒤, 홈 랭킹에 닉네임이 뜨는지 본다.
3. 안 뜨면 화면에 보이는 문구를 Claude에게 알려 준다. Claude가 연결을 시험해 원인을 찾는다(§7-5).

### E. 실기기 확인 (수업 한 번)
- 크롬북과 iPad로 한 판씩 한다. 아래 셋을 본다.
  - 처음 열 때 걸리는 시간
  - 전투 중 버벅임
  - 글자 크기
- 이상하면 기종과 증상을 적어 Claude에게 준다.
- **한 반이 동시에 처음 접속했을 때** 모두 랭킹에 연결되는지 본다(§4-1 익명 로그인 한도 확인).

### F. 운영 습관 (한 달에 한 번, 5분)
- **Supabase 대시보드 → Usage**에서 DB 용량, MAU, 실시간 연결 최고치를 본다. 무료 한도의 80%를 넘으면 P2로 간다.
- **방학 전**: 무료 프로젝트는 7일 동안 활동이 적으면 멈춘다. 멈춰도 게임은 돌고, 개학 때 대시보드에서 **Resume project**를 누르면 된다. 정지 약 1주 전에 경고 메일이 온다.
- **백업**: 무료 단계는 내려받을 수 있는 자동 백업이 없다. 잃는 것은 랭킹 기록뿐이고 게임과 학생 기기 기록은 그대로라, 무료 단계에서는 백업 없이 간다. P2부터 매일 자동 백업된다.
- **비밀값**: DB 비밀번호, 소금값, secret key는 비밀번호 관리자에만 둔다. 누가 물어봐도 채팅에 붙이지 않는다.

### G. 콘텐츠 (기존 일)
- 4~6학년 문제은행 공동 검수를 끝내고 공개한다. 공개되면 강가·궁궐 뜰·설원 맵이 학생에게 열린다.

### H. 돈이 드는 결정 (P2부터)
- Supabase Pro 결제와 도메인 구매는 직접 한다.

---

## 7. Claude가 할 일 (승인하면 바로 시작)

| 순서 | 일 | 단계 | 끝 기준 |
|---|---|---|---|
| 1 | 금고(Vault)에서 소금값을 읽는 마이그레이션 추가. 금고가 없으면 기존 설정값으로 대체 | P0 | 로컬 SQL 회귀 시험 3종 통과 |
| 2 | 설정 이름 `VITE_SUPABASE_PUBLISHABLE_KEY`로 정리(옛 `VITE_SUPABASE_ANON_KEY`도 받음), `.env.example` 갱신 | P0 | verify 통과 |
| 3 | Cloudflare 설정 파일 `wrangler.jsonc` 추가(`dist/` 정적 파일만, 이름 `vocabulary-td`), DEPLOY.md 갱신 | P0 | 로컬에서 `npx wrangler deploy --dry-run` 통과 |
| 4 | `main` 병합·push | P0 | 사용자가 A에서 요청할 때 |
| 5 | 사용자 프로젝트로 실제 연결 시험(익명 가입·판 제출·랭킹·실시간 접속자 수) | P0 | B·C 뒤 |
| 6 | 앱 가볍게 ①~④, 전후 다운로드 용량 실측 | P1 | 출시 뒤 |
| 7 | 접속자 수 1분 조회, 랭킹 캐시 | P3 | 필요할 때만 |

---

## 8. 비용 요약

| 단계 | 게임 파일 | 기록·랭킹 | 월 비용 |
|---|---|---|---|
| P0·P1 출시·가볍게 | Cloudflare 무료 | Supabase 무료 | **0원** |
| P2 정식 운영 | Cloudflare 무료 | Supabase Pro | **$25** (롤린썬더 Pro 조직에 추가하면 약 $10) |
| P3 폭발 | Cloudflare 무료 | Pro + 실시간 연결 추가분 | $25 + 연결 1,000개당 $10. P3 작업을 하면 대부분 필요 없다 |

---

## 9. 확인한 출처 (2026-11-04 조회, 괄호는 페이지 갱신일)

- Cloudflare Pages 첫머리 "새 프로젝트는 Workers로": https://developers.cloudflare.com/pages/ (2026-08-25)
- Workers 정적 파일 무료·무제한: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ (2026-11-03)
- Workers 한도(파일 2만·25MiB): https://developers.cloudflare.com/workers/platform/limits/ (2026-10-29)
- Workers Builds 한도: https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/ (2026-10-28)
- Pages 한도: https://developers.cloudflare.com/pages/platform/limits/ (2026-09-05)
- R2 가격: https://developers.cloudflare.com/r2/pricing/ (2026-10-30)
- Supabase 가격·한도: https://supabase.com/pricing , https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase 무료 프로젝트 정지: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase 실시간 한도: https://supabase.com/docs/guides/realtime/limits
- Supabase 추가 프로젝트 비용: https://supabase.com/docs/guides/platform/billing-faq
- Supabase 백업: https://supabase.com/docs/guides/platform/backups
- Supabase API 키: https://supabase.com/docs/guides/api/api-keys , 공지 https://github.com/orgs/supabase/discussions/29260 (2025-06-17 갱신)
- Supabase 익명 로그인 한도: https://supabase.com/docs/guides/auth/rate-limits , https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase 금고(Vault): https://supabase.com/docs/guides/database/vault
- Supabase 서울 리전: https://supabase.com/docs/guides/platform/regions
- Vercel Hobby: https://vercel.com/docs/plans/hobby , https://vercel.com/docs/limits/fair-use-guidelines (2026-09-14)

## 10. 아직 확인 못 한 것

| 항목 | 어떻게 정리하나 |
|---|---|
| 무료 플랜에서 익명 로그인 한도를 바꿀 수 있는지 | B-4에서 직접 확인한다 |
| `alter database ... set app.player_salt`가 호스팅에서 되는지 | 금고 방식으로 돌아가므로 몰라도 된다 |
| 익명 계정이 MAU에 세어지는지 | 공식 문서에 없다. 센다고 가정한다(무료 5만이라 여유 있음) |
| publishable 키로 RPC 호출이 되는지(공식 문서의 직접 보증) | 앱 방식은 문서 규칙과 맞는다. D와 §7-5에서 실제로 시험한다 |
