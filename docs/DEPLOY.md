# 배포 안내 · 1.0.0

작성: 2026-11-04 · 총괄 Claude. 2026-11-05 새 방식(GitHub Pages + Cloudflare Workers/D1)으로 다시 씀(구현 계획서 단계 6).
앱·규칙·밸런스 버전은 모두 `1.0.0`이다(`package.json`, `RULES_VERSION`, `balanceVersion`).

> 왜 이렇게 나눴는지는 [호스팅·운영 계획서](HOSTING_PLAN.md), 작업 순서는 [구현 계획서](HOSTING_IMPL_PLAN.md)가 기준이다.
> 이 문서는 **처음 하는 사람이 그대로 따라 하는 순서**를 적는다. 예전 Supabase 서버는 [`docs/archive/supabase/`](archive/supabase/)에 보관만 한다.

---

## 1. 구조

| 무엇 | 어디 | 주소 | 어떻게 올리나 |
|---|---|---|---|
| 게임 파일(`dist/`, 그림·JS) | **GitHub Pages** | `https://voca.ssamuniverse.com` | `main`에 올리면 GitHub Actions가 자동으로 검사 → 빌드 → 배포 |
| 기록·랭킹 서버(`server/`) | **Cloudflare Workers + D1** | `https://voca-api.ssamuniverse.com` | 사람이 명령으로 올린다(`npm run server:deploy`) |
| 비밀값 | Worker 비밀값 `PLAYER_SALT` 하나 | — | 사용자가 직접 넣는다(§8) |

```
학생 브라우저 ──▶ voca.ssamuniverse.com      (DNS only 회색 구름 → GitHub Pages, 서울 거점)
      └──────▶ voca-api.ssamuniverse.com   (Cloudflare Worker 사용자 지정 도메인 → D1, 아시아)
```

- 앱은 빌드할 때 `VITE_API_BASE=https://voca-api.ssamuniverse.com`을 받는다(워크플로가 넣는다). 비우면 서버 없이 "이 기기 기록" 모드로만 돈다.
- **서버가 꺼지거나 한도에 닿아도 게임은 돈다.** 랭킹·홈 지표만 이 기기 기록으로 바뀌고, 공개 기록은 대기열에 남았다가 나중에 다시 보낸다.
- 서버 주소는 사용자 지정 도메인 하나뿐이다. `workers.dev` 주소는 껐다(`server/wrangler.toml`). 속도 제한 규칙(§5)과 랭킹 캐시를 우회하는 입구가 되기 때문이다.
- Worker 배포는 CI에 넣지 않았다. Cloudflare API 토큰을 저장소·GitHub에 두지 않으려는 것이다.

### 1.1 파일

| 파일 | 하는 일 |
|---|---|
| `.github/workflows/pages.yml` | `main` push·수동 실행 → `check`(verify·서버 시험) → `build`(`VITE_API_BASE` 넣어 빌드) → `deploy`(Pages) |
| `.nvmrc` | CI의 Node 판(24) |
| `server/wrangler.toml` | Worker 이름·도메인·D1 연결·허용 출처·캐시·하루 정리 일정·Smart Placement |
| `server/migrations/*.sql` | D1 표 정의(순서대로 한 번씩 적용) |
| `server/seed/question_keys.sql` | 공개 정답 키·검증 규칙. `node tools/build-question-keys.mjs`가 만든다 |
| `server/.dev.vars.example` | 로컬 개발 값 견본(비밀값 없음). `server/.dev.vars`로 복사해 쓴다 |

---

## 2. 출시 전 점검

| 점검 | 결과 |
|---|---|
| `npm run verify` | 단위 891·콘텐츠 366·계약 대조 실패 0(2026-11-04) |
| `npx playwright test` | e2e 44 통과(2026-11-04) |
| `npm run simulate:gate` | 밸런스 관문 PASS 28 · FAIL 7(남은 미달과 까닭은 [r4-final](balance/r4-final.md)) |
| 서버 SQL(옛 Supabase) | 로컬 PostgreSQL 17에 마이그레이션 4개 + 정답 키 seed 적용, 회귀 시험 3종 통과(2026-11-04). 지금은 [`docs/archive/supabase/`](archive/supabase/)에 보관 |
| 새 서버(Workers + D1) | `npm run test:server` 70건 통과. 회귀 시험 3종을 옮겼고, 랭킹은 Postgres 질의와 162조합을 대조했다. `wrangler dev --local`과 curl로 가입 → 시작 → 제출(재채점) → 랭킹 확인(2026-11-05) |
| 앱 ↔ 새 서버 | 서버 없는 모드 e2e, 로컬 `wrangler dev` 연결 모드 e2e(`tests/e2e/api-connected.spec.ts`) 통과(2026-11-05) |
| 성능 | 운영 빌드, CPU 4·6배 감속에서 60fps |
| 정답 키 seed | `server/seed/question_keys.sql`(공개 정답 키 51개, 난이도별 검증 규칙 4개) |
| 운영 빌드 | `npm run build` 성공. 개발 전용 장면 로더(`?qaRun`·`?previewMap`)와 이어하기 문구 0건 |

---

## 3. 처음 한 번 (순서대로)

**[사용자]**는 사람이 직접, **[총괄]**은 Claude가 한다. 비밀값(소금값·비밀번호·토큰)은 채팅에 붙이지 않는다. 막히면 화면에 보이는 글을 Claude에게 그대로 알려 준다.

| # | 누가 | 할 일 | 끝난 표시 |
|---|---|---|---|
| 1 | [총괄] | 작업 브랜치를 `main`에 합치기 전, 로컬에서 `npm run verify`·`npm run test:server`·`npm run build` | 모두 통과 |
| 2 | [사용자] B | Claude가 `npx wrangler login`을 실행하면 열리는 브라우저에서, 롤린썬더·쌤유니버스에 쓰는 Cloudflare 계정으로 로그인하고 **Allow** | 터미널에 "Successfully logged in" |
| 3 | [총괄] | `npx wrangler d1 create vocabulary-td --location apac` → 나온 `database_id`를 `server/wrangler.toml`에 넣고 커밋 | `npx wrangler d1 list`에 보임 |
| 4 | [총괄] | `npm run server:db:remote`(표 만들기) → `npm run server:seed:remote`(정답 키) | 마이그레이션 `0001_init.sql` ✅, 키 51개 |
| 5 | [총괄] | `npm run server:deploy`. `voca-api.ssamuniverse.com` DNS와 인증서가 저절로 생긴다 | 배포 끝 메시지. 이 순간 서버는 `503 PLAYER_SALT_REQUIRED`(6번 전이라 정상) |
| 6 | [사용자] C | 터미널에서 `openssl rand -base64 48` → 값을 비밀번호 관리자에 저장 → 저장소 폴더에서 `npx wrangler secret put PLAYER_SALT --config server/wrangler.toml` 실행 후 붙여 넣기 | "Success! Uploaded secret PLAYER_SALT" |
| 7 | [총괄] | `curl -X POST https://voca-api.ssamuniverse.com/v1/device -d '{}'` | `{"deviceId":…,"token":…}` |
| 8 | [사용자] D | GitHub `djqanrudgns12/tower` → **Settings → Pages** → **Source: GitHub Actions**, **Custom domain**: `voca.ssamuniverse.com` → Save | 화면에 도메인이 보임(DNS 확인 중이어도 됨) |
| 9 | [사용자] E | Cloudflare `ssamuniverse.com` → **DNS → Records → Add record**: Type `CNAME`, Name `voca`, Target `djqanrudgns12.github.io`, **Proxy status: DNS only(회색 구름)** | 회색 구름. **주황 구름이면 안 된다**(KT 학교에서 그림이 미국을 돌아온다) |
| 10 | [총괄] | `main`에 합치고 push(또는 Actions → Pages → **Run workflow**) | Actions의 check·build·deploy 모두 초록 |
| 11 | [사용자] D | 몇 분 뒤 Settings → Pages에서 **Enforce HTTPS** 체크. (권장) 계정 Settings → Pages → **Add a domain**으로 `ssamuniverse.com` 인증(TXT 한 줄) | 주소창 자물쇠 |
| 12 | [사용자] | §5 속도 제한 규칙 하나 걸기 | 규칙 목록에 보임 |
| 13 | [사용자] F | 학생 주소에서 한 판 → **설정 → 공개 기록 나누기** 켜기 → 한 판 더 → 홈 랭킹에 별명이 뜨는지 | 뜨면 끝. 안 뜨면 화면 문구를 Claude에게 |

- 3번의 `--location apac`은 D1 본체를 아시아에 둔다. 한 번 정하면 옮길 수 없다.
- 6번의 소금값은 **한 번 정하면 바꾸지 않는다**(§8).
- 10번에서 `deploy`가 "Pages가 켜져 있지 않다"로 실패하면 8번이 덜 된 것이다. 8번을 마치고 Actions에서 다시 돌린다.

---

## 4. 평소 배포

### 4.1 게임
- `main`에 push하면 끝이다. Actions가 `check`(verify + 서버 시험) → `build` → `deploy` 순서로 돌고, 하나라도 실패하면 배포하지 않는다.
- 결과는 GitHub **Actions** 탭에서 본다. 같은 커밋을 다시 올리려면 Actions → Pages → **Run workflow**.
- e2e는 CI에 없다. 화면을 바꾼 커밋은 로컬에서 `npm run test:e2e`를 돌린 뒤 올린다.

### 4.2 서버
1. `server/**`, `src/persistence/**`, `src/contracts/lobby.ts`를 고쳤으면 `npm run test:server`(AGENTS.md 규칙)
2. 새 마이그레이션이 있으면 **먼저** `npm run server:db:remote`. 마이그레이션은 앞으로만 가므로 새 코드가 옛 표를 읽어도 되게 쓴다.
3. `npm run server:deploy`
4. `curl -X POST https://voca-api.ssamuniverse.com/v1/device -d '{}'`로 살아 있는지 본다.

### 4.3 문제은행·밸런스를 바꿨을 때
1. `node tools/build-question-keys.mjs` → `server/seed/question_keys.sql`이 바뀌면 커밋
2. `npm run server:seed:remote`
- 승인 조건은 그때의 공개 은행만 켜진다. 옛 은행 기록은 랭킹에서 빠지고 지워지지는 않는다.
- 검증 규칙은 `(balanceVersion, 난이도)`마다 처음 넣은 값이 남는다. 규칙 숫자를 바꾸면 `balanceVersion`도 올린다.

### 4.4 로컬에서 서버까지 띄우기
```bash
cp server/.dev.vars.example server/.dev.vars   # 처음 한 번
npm run server:db:local                        # 로컬 D1에 표·정답 키
npm run server:dev                             # http://127.0.0.1:8787
VITE_API_BASE=http://127.0.0.1:8787 npm run dev
```
앱에서 설정 → 공개 기록 나누기를 켜면 로컬 서버를 쓴다. 연결 모드 e2e는 `tests/e2e/api-connected.spec.ts` 머리 주석의 명령으로 돌린다.

---

## 5. Cloudflare 무료 속도 제한 규칙 (서버 주소에 하나)

Worker 안에도 기기·IP별 한도가 있지만, 그 판단도 D1 쓰기 행을 쓴다. 이 규칙은 Worker에 닿기 **전에** 같은 IP의 몰아치기를 끊는다. 막힌 요청은 Worker 요청 수에도 D1에도 세지 않는다.

- 위치: Cloudflare 대시보드 → `ssamuniverse.com` → **Security → WAF → Rate limiting rules → Create rule**(무료 플랜은 규칙 1개)

| 칸 | 값 |
|---|---|
| Rule name | `voca-api 몰아치기` |
| If incoming requests match | Custom expression: `(http.host eq "voca-api.ssamuniverse.com" and starts_with(http.request.uri.path, "/v1/"))` |
| With the same characteristics | IP |
| When rate exceeds | **600** requests per **10 seconds** |
| Then take action | Block |
| Duration | 10 seconds(무료 플랜 고정) |

- **600/10초인 까닭:** 학교 IP 하나 뒤의 학생 1,000명 가운데 300명이 같은 분에 홈·랭킹·시작을 누르는 정도를 막지 않으려는 값이다. 브라우저 사전 요청(OPTIONS)까지 치면 10초에 약 400번이다. Worker 안의 IP 한도는 분당 ranking 1,200·visit 600·start/submit 300이다.
- **한계:** 이 규칙은 순간 몰아치기만 끊는다. 초당 60번 아래로 꾸준히 보내면 Workers 무료 한도(하루 10만 요청)는 여전히 바닥날 수 있다. 그런 일이 보이면 한동안 값을 `100`으로 낮추고 Claude에게 알린다.
- 여러 IP를 쓰는 공격은 무료 플랜에서 막을 수 없다. 그날은 랭킹만 멈추고 게임은 이 기기 기록 모드로 돈다. D1 무료 한도는 매일 **오전 9시(한국)**에 다시 찬다.

---

## 6. 되돌리기

| 무엇 | 방법 |
|---|---|
| 게임 | `main`에서 문제 커밋을 `git revert` → push(Actions가 다시 배포). 급하면 Actions에서 이전에 성공한 실행을 **Re-run all jobs** |
| 서버 코드 | `npx wrangler rollback --config server/wrangler.toml`(바로 앞 배포로). 판 목록은 `npx wrangler deployments list --config server/wrangler.toml` |
| 서버 데이터 | D1 Time Travel(무료 7일): `npx wrangler d1 time-travel restore vocabulary-td --timestamp=<되돌릴 시각 ISO>`. 코드 되돌리기는 표를 되돌리지 않는다 |
| Smart Placement | `server/wrangler.toml`의 `[placement]` 두 줄을 지우고 `npm run server:deploy` |
| 서버를 아예 끄기 | 앱은 그대로 돈다(이 기기 기록 모드). 끄려면 Cloudflare 대시보드 → Workers & Pages → `vocabulary-td-api` → Settings → Domains에서 `voca-api` 도메인을 뗀다 |
| 랭킹 집계가 이상할 때 | 관리자가 `completed_runs`를 손으로 고쳤다면 `npx wrangler d1 execute DB --remote --config server/wrangler.toml --file server/sql/rebuild-standings.sql` |

- 서버 명령(rollback·time-travel·execute)은 Cloudflare 계정에 닿는다. 총괄은 사용자 허락을 받고 친다.

---

## 7. 월 점검 (한 달에 한 번, 5분)

| 볼 곳 | 볼 것 | 무료 한도 | 알릴 때 |
|---|---|---|---|
| Cloudflare → Workers & Pages → `vocabulary-td-api` → Metrics | 하루 요청 수 | 100,000/일 | 50% 넘음 |
| Cloudflare → Storage & Databases → D1 → `vocabulary-td` → Metrics | 읽은 행·쓴 행 | 읽기 5,000,000·쓰기 100,000/일 | 50% 넘음(쓰기가 먼저 닿는다: 한 판 약 22~26행) |
| Cloudflare → Security → Events | 속도 제한 규칙에 막힌 요청 | — | 갑자기 많음 |
| GitHub → Actions | 실패한 배포 | — | 빨간 실행 |

- GitHub Pages에는 사용량 화면이 없다. 한도를 크게 넘으면 GitHub가 메일로 알린다.
- Smart Placement가 켜졌는지는 Worker의 Settings → Runtime → Placement에서 본다.

---

## 8. 비밀값 다루기

- 비밀값은 `PLAYER_SALT` **하나뿐**이다. 서버가 이 값에서 토큰 서명 키·기기 해시 키·IP 해시 키를 따로 만든다.
- 만들기: `openssl rand -base64 48`(64자). 32자보다 짧으면 서버가 받지 않는다.
- 넣기: `npx wrangler secret put PLAYER_SALT --config server/wrangler.toml`(입력 칸에 붙여 넣기). 파일·채팅·커밋·GitHub 비밀값에 두지 않는다. 보관은 비밀번호 관리자에만 한다.
- **바꾸지 않는다.** 바꾸면 모든 기기 토큰이 무효가 된다. 앱은 기기를 한 번 새로 받지만 예전 랭킹 기록은 "내 기록"으로 이어지지 않는다. 새어 나갔을 때만 바꾼다.
- 로컬 개발 값은 `server/.dev.vars`(커밋 안 함)에 아무 문자열이나 넣는다.
- GitHub Actions에는 비밀값이 필요 없다. `VITE_API_BASE`는 공개 주소다.
- Cloudflare 로그인 토큰은 총괄 기기의 wrangler에만 있다. 저장소·CI에 Cloudflare API 토큰을 두지 않는다.

---

## 9. 1.0.0 운영 메모

- **이어하기가 없다**(2026-11-04 사용자 결정). 판은 메모리에만 있다. 창을 닫으면 판이 사라지고 기록되지 않는다.
  - "이번 판 끝내기"로 마친 판만 기록된다.
  - 기기에 남은 예전 저장 판은 새 버전을 처음 열 때 지워진다(IndexedDB v3).
- 랭킹·서버 검증은 `balance_version = 1.0.0`으로 나뉜다. 예전 후보 버전 기록은 승인 조건에서 빠진다.
- 오답 노트는 이 기기(localStorage)에만 있다. 설정의 "이 기기 기록 지우기"로 함께 지워진다.
- 홈의 "최근 접속"은 최근 5분 안에 홈을 연 기기 수다(실시간 연결이 아니다).
- 랭킹은 서버 거점마다 최대 60초 늦을 수 있다(`RANKING_CACHE_SECONDS`). 자기 제출은 바로 보인다.

---

## 10. 사람만 할 수 있는 일

- Cloudflare 로그인 허락, 소금값 만들고 넣기, GitHub Pages·DNS 설정, 속도 제한 규칙 걸기(§3·§5)
- 크롬북·iPad 실기기와 학교 망 확인(학급에서 한 판씩, [계획서 §6 G](HOSTING_PLAN.md))
- 4~6학년 문제은행 공개(콘텐츠 공동검수 뒤). 공개되면 강가·궁궐 뜰·설원 맵이 학생에게 열린다.
