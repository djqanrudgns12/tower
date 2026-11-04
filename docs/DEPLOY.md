# 배포 안내 · 1.0.0

작성: 2026-11-04 · 총괄 Claude. 앱·규칙·밸런스 버전은 모두 `1.0.0`이다(`package.json`, `RULES_VERSION`, `balanceVersion`).

> 어디에 올리고 사람이 무엇을 하는지는 [호스팅·운영 계획서 2판](HOSTING_PLAN.md)이 기준이다. 게임 파일은 GitHub Pages, 기록·랭킹 서버는 Cloudflare Workers + D1로 옮길 계획이다(승인 대기). 아래 §3.2의 Supabase 절차는 그 전까지의 기록이며, 호스팅 Supabase에서는 그대로 통하지 않는다(계획서 §1).

## 1. 무엇을 배포하나

- **정적 웹앱** 하나(`dist/`). 서버 코드는 없다. 어느 정적 호스팅(Vercel·Netlify·Cloudflare Pages·GitHub Pages 등)에도 올릴 수 있다.
- **Supabase(선택)**: 공개 랭킹과 서버 재채점용이다. 환경 변수를 비워 두면 앱은 오프라인·내 기기 기록 모드로 안전하게 돈다.

## 2. 출시 전 점검(총괄이 2026-11-04에 끝낸 것)

| 점검 | 결과 |
|---|---|
| `npm run verify` | 단위 891·콘텐츠 366·계약 대조 실패 0 |
| `npx playwright test` | e2e 44 통과 |
| `npm run simulate:gate` | 밸런스 관문 PASS 28 · FAIL 7(남은 미달과 까닭은 [r4-final](balance/r4-final.md)) |
| 서버 SQL | 로컬 PostgreSQL 17에 마이그레이션 4개 + 정답 키 seed 적용, 회귀 시험 3종(net-regression·http-failures·unicode-grapheme) 통과 |
| 성능 | 운영 빌드, CPU 4·6배 감속에서 60fps |
| 정답 키 seed | `supabase/question_keys.seed.sql`을 1.0.0 최종 계약으로 다시 생성(공개 정답 키 51개, 난이도별 검증 규칙 4개) |
| 운영 빌드 | `npm run build` 성공, 결과물에 개발 전용 장면 로더(`?qaRun`·`?previewMap`)와 이어하기 문구 0건 |

## 3. 배포 순서

### 3.1 웹앱
```bash
npm ci
npm run verify
npm run build
```
- 결과물 `dist/`를 호스팅에 올린다. 하위 경로에 둘 때만 `vite.config.ts`의 `base`를 맞춘다.
- Supabase를 쓰면 **빌드 전에** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 호스팅의 환경 변수로 넣는다(`.env.example` 참고). 키는 저장소에 커밋하지 않는다.

### 3.2 Supabase(쓸 때만)
1. 프로젝트를 만들고 **익명 로그인**(Authentication → Anonymous sign-ins)을 켠다.
2. `supabase/migrations/*.sql`을 이름 순서대로 적용한다(`supabase db push` 또는 SQL 편집기).
3. 비밀 소금값을 넣는다(무작위 긴 문자열, 저장소에 남기지 않는다). 호스팅 Supabase에서는 아래 명령이 권한 때문에 막힐 수 있다([계획서 §1](HOSTING_PLAN.md)):
   ```sql
   alter database postgres set app.player_salt = '<무작위 긴 문자열>';
   ```
4. 관리자 권한으로 `supabase/question_keys.seed.sql`을 적용한다. 문제은행이나 밸런스를 바꾸면 `node tools/build-question-keys.mjs`로 다시 만들고 다시 적용한다.
5. 앱에서 설정 → 공개 기록을 켜고 한 판을 끝내 랭킹에 올라가는지 본다.

## 4. 1.0.0에서 달라진 점(운영자가 알아 둘 것)

- **이어하기가 없다**(2026-11-04 사용자 결정). 판은 메모리에만 있고, 창을 닫으면 사라지며 기록되지 않는다. "이번 판 끝내기"로 마친 판만 기록된다. 기기에 남은 예전 저장 판은 새 버전이 처음 열릴 때 지워진다(IndexedDB v3).
- 랭킹·서버 검증은 `balance_version = 1.0.0`으로 나뉜다. 예전 후보 버전 기록은 승인 조건에서 빠진다.
- 오답 노트는 이 기기(localStorage)에만 있다. 설정의 "이 기기 기록 지우기"로 함께 지워진다.

## 5. 사람만 할 수 있는 일

- Supabase 프로젝트 생성·키·소금값 입력, 호스팅 계정 연결과 도메인
- 크롬북·iPad 실기기 확인(학급에서 한 판씩)
- 4~6학년 문제은행 공개(콘텐츠 공동검수 뒤). 공개되면 강가·궁궐 뜰·설원 맵이 학생에게 열린다.
