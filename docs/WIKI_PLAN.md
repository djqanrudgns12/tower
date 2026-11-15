# 어휘력 타워 디펜스 LLM Wiki 및 자동 갱신 세부 구현 계획 (WIKI_PLAN v1.0)

> 기준 문서: [docs/WIKI_PRD.md](WIKI_PRD.md) (`TD-WIKI-01` ~ `TD-WIKI-10`)
> 작성일: 2026-11-16 · 실행 방식: 설계 직후 Phase 1~3 연속 완결 및 커밋·푸시

---

## 1. 목표 디렉터리 및 파일 아키텍처

기존 원천 문서(`vocabulary_td_prd_*.md`, `docs/**`, `asset-source/**`, `content-source/**`)는 제자리에 그대로 보존하고 아래 컴파일 지식 계층과 자동화 도구를 구축한다.

```text
towerdeffense/
├── AGENTS.md                         [보강] 위키 진입점(wiki/index.md · docs/README.md · llms.txt)과 조회·동기화 명령 연결
├── CLAUDE.md                         [유지] @AGENTS.md 상속
├── README.md                         [갱신] 1.0.0 운영 실체 반영 + WIKI-AUTO 현황 블록 (validate-plan 호환 100% 유지)
├── llms.txt                          [신규] llmstxt.org v2 규격 머신 리더블 사이트맵 + WIKI-AUTO 통계 블록
│
├── docs/                             [원천 계층 — 기존 파일 이동·이름 변경 0건]
│   ├── README.md                     [신규] Diataxis 4분류 × 문서 권위·생애주기 허브 + WIKI-AUTO 카탈로그 요약
│   ├── READ_FIRST.md                 [갱신] 현행 권위 사슬(리뉴얼 > PRD v0.5, 호스팅·CR-1000 완료) 반영 + 위키 라우터 연결
│   ├── WIKI_PRD.md                   [신규] LLM Wiki 및 문서 자동 갱신 시스템 요구사항 명세
│   ├── WIKI_PLAN.md                  [신규] 본 세부 구현 계획서
│   ├── DEPLOY.md · HOSTING_PLAN.md · HOSTING_IMPL_PLAN.md · CR1000_HANDOFF.md · CONTENT_REVIEW_PLAN.md … (보존)
│   ├── renewal/ · contracts/ · balance/ · work-packages/ · archive/ … (보존)
│
├── wiki/                             [컴파일 지식 계층 — 에이전트 최우선 참조]
│   ├── index.md                      1홉 에이전트 라우터 (≤ 3,800자, 작업/질문별 즉시 이동 + WIKI-AUTO 지표)
│   ├── SCHEMA.md                     위키 규약·권위 사슬·글자 예산·증거 태그·자동 갱신·교훈 승격(L0~L4) 규칙
│   ├── glossary.md                   프로젝트 고유 용어·약어 사전 (PT·BP·milli·R/S모드·징집·보물·CR-1000·R1~R5 등)
│   ├── log.md                        연산 기록 (append-only, `## [YYYY-MM-DD] 연산 | 대상 | 담당`)
│   │
│   ├── commands.md                   [자동 생성] npm 스크립트 + tools/ 주요 CLI · 분류 · resource-guard 표기
│   ├── codemap.md                    [자동 생성] src 7계층 · server · tools · tests 모듈 지도 + ESLint 계층 경계 + 주요 export
│   ├── contracts.md                  [자동 생성] 문제은행 · 밸런스(난이도·타워 20종·적 10종) · 맵 4종 · 서버 API/D1 9테이블 · 에셋 통계
│   ├── decisions-index.md            [자동 생성] 분산된 핵심 확정 결정(화풍·게임 규칙·리뉴얼·WebP·호스팅·CR-1000) 통합 색인
│   ├── docs-catalog.md               [자동 생성] 전체 마크다운 문서 생애주기·Diataxis 역할·보존 잠금(Preserve Lock)·용량 카탈로그
│   │
│   ├── entities/                     고유명사·환경 단일 진실원
│   │   ├── vocabulary-td.md          제품 정의·핵심 플레이 루프·운영 도메인(voca / voca-api)·로컬 포트(5173 / 8787)
│   │   └── tech-stack.md             런타임·프레임워크·서버·검증 도구 버전 단일 진실원 (WIKI-AUTO 자동 버전 표 연동)
│   │
│   ├── concepts/                     6대 도메인 개념 허브 (주제별 코드·문서 진실원 지도)
│   │   ├── architecture-and-layers.md    src 7계층 의존성 · ESLint 경계 · 시드 PRNG · RunController 30Hz 단일 상태 작성자
│   │   ├── combat-towers-and-balance.md  타워 20종 · Lv4/Lv7 진화 · 징집/원정 보물 · 종족×역할 몬스터 · 밸런스 시뮬레이터
│   │   ├── ui-phaser-and-assets.md       React↔Phaser 브리지 · R/S 반응형 레이아웃(v3) · 41번 화풍 잠금 · WebP 파이프라인
│   │   ├── question-bank-and-cr1000.md   3~6학년 공개 은행 · 공동검수(codex/claude-argon-v1) · 학년 띠 공유 · commit-lock
│   │   ├── persistence-and-ranking-server.md  IndexedDB/오답 노트/오프라인 폴백 ↔ Workers+D1 재채점 · standings · 캐시
│   │   └── deploy-and-verification.md    GitHub Pages(회색 구름) · Workers/D1 수동 배포 · validate-plan 잠금 · 검증 예산
│   │
│   ├── projects/                     단계 계보 및 코드 실체 기반 완료 상태
│   │   └── roadmap-and-status.md     P1/WP → 리뉴얼(R1~R5) → 호스팅 1.0.0 → CR-1000 완료 계보 및 잔여 과제 정리
│   │
│   ├── lessons/                      ACE형 교훈 원장 (영구 ID `L-TD-NNN` · 단계 L0~L4 · 카운터)
│   │   ├── engineering-and-content.md    도메인·서버·CR-1000·잠금·시드 버퍼 교훈 (L-TD-001~)
│   │   ├── ui-art-and-balance.md         랜딩 보존·WebP 알파 경계·밸런스 연쇄 영향 교훈 (L-TD-101~)
│   │   └── ops-and-workflow.md           회색 구름 DNS·workers.dev 차단·단일 폴더·검증 예산 교훈 (L-TD-201~)
│   │
│   ├── templates/                    표준 문서 작성 틀
│   │   ├── lesson.md                 교훈 원장/델타 작성 틀
│   │   └── hub.md                    도메인 개념 허브 작성 틀
│   │
│   ├── _data/                        도구 메타데이터
│   │   ├── command-notes.json        npm 스크립트별 용도·주의사항 메모
│   │   ├── tags.json                 교훈 허용 태그 어휘집
│   │   └── lesson-ids.json           발급된 교훈 ID 불변 목록 (삭제 방지)
│   └── _inbox/                       다중 에이전트 무충돌 교훈 델타 수신함 (`merged/`, `dropped/`)
│
├── .agents/skills/wiki-maintain/     도구 중립 에이전트 위키 운영 스킬 (Claude · Codex · Antigravity 공용)
│   └── SKILL.md
│
├── tools/wiki/                       무의존성 결정적 자동 갱신·조회·검사 엔진 (Node 24 ESM)
│   ├── lib/
│   │   ├── fsutil.mjs                안전 경로 탐색·SHA-256·글자/토큰 계산(비밀값·임시 폴더 차단)
│   │   ├── frontmatter.mjs           결정적 YAML 부분집합 파서·직렬화기
│   │   ├── markdown.mjs              코드 펜스 마스킹·링크/앵커 슬러그·절 추출·WIKI-AUTO 마커 치환기
│   │   ├── extractors.mjs            명령·코드맵·계약(은행·밸런스·맵·API·D1·에셋)·결정·문서 카탈로그 추출기
│   │   └── entries.mjs               용어집·교훈 원장·델타 파서
│   ├── gen.mjs                       5대 레지스트리 및 5개 문서 WIKI-AUTO 블록 결정적 생성기
│   ├── sync.mjs                      통합 동기화 CLI (`--check`, `--staged`, `--quiet`)
│   ├── watch.mjs                     디바운스 파일 감시 자동 동기화 데몬
│   ├── lint.mjs                      결정적 무결성·보존 검사기 (W01~W09, `--strict` 지원)
│   ├── query.mjs                     토큰 절약형 절·계약·타워·적·맵·은행·라우트·테이블·교훈 조회 CLI
│   ├── stamp.mjs                     큐레이션 페이지 `sources` SHA-256 해시 및 HEAD 커밋 스탬프 도구
│   ├── budget.mjs                    계층별 글자·토큰 예산 측정기
│   ├── delta.mjs                     무충돌 교훈 델타 생성기
│   ├── curate.mjs                    교훈 수신함 리포트 및 원장 병합기
│   └── hooks/
│       ├── install.mjs               Git pre-commit / post-commit / post-merge / post-checkout 훅 설치기
│       └── run-hook.mjs              단일 폴더·commit-lock·--only 안전 판정 Git 훅 실행기
│
└── tests/unit/wiki.test.ts           위키 엔진 전체 단위 시험 (Vitest 통합)
```

---

## 2. 핵심 모듈 설계 상세

### 2.1 결정적 추출기 (`tools/wiki/lib/extractors.mjs`)

1. **명령 추출 (`extractCommands`)**:
   - 루트 `package.json`의 모든 스크립트와 `tools/` 내 핵심 독립 실행 스크립트(`tools/build-question-keys.mjs`, `tools/assets/to-webp.mjs`, `tools/content/coverage-report.mjs`, `tools/orchestrate/commit-lock.mjs`, `tools/qa/perf.mjs`, `tools/qa/scenes.mjs`)를 수집한다.
   - 각 명령의 분류(`검증·정적검사`, `위키·문서`, `개발·빌드`, `서버·D1`, `문제은행·검수`, `밸런스·QA`)와 맥미니 `resource-guard` 프로필(`test` / `build`) 권장 여부를 표기한다.
2. **코드맵 추출 (`extractCodemap`)**:
   - `eslint.config.js`에서 계층별 `no-restricted-imports` 금지 패턴을 직접 파싱해 표로 보여준다.
   - `src/{domain,contracts,content,application,persistence,game,ui}`, `server/src`, `tools/{assets,content,orchestrate,qa,sim}`, `tests/{unit,e2e}`의 파일 수·줄 수·상단 주석 요약·대표 `export` 심볼을 추출한다.
3. **살아있는 계약 추출 (`extractContracts`)**:
   - **문제은행(`src/content/questions/manifest.json`, `practice.json`, `retractions.json`)**: 3~6학년별 `bankVersion`, `ownCount`, `sharedCount`, `questionCount` 합계, 연습 문항 수, 철회 목록 버전을 집계한다.
   - **밸런스(`docs/contracts/balance.candidate.v0.4.json`)**: 버전·단위(`30Hz`, `BP`, `milli`), 난이도 4단계(`Easy`~`Crazy`) 핵심 수치, **타워 20종 전체 기본 스펙(`id`, `label`, `cost`, `damageType`, `damage`, `intervalMs`, `rangeMilli`, `canHitFlyer`, 진화 형태 수)**, **적 역할 10종 스펙(`id`, `hpBP`, `speedBP`, 저항·특수기믹)**, 웨이브 생성식, 징집·유물 개수를 추출한다.
   - **맵(`docs/contracts/maps.candidate.v0.4.json`)**: 4개 학년 맵(`garden_u`, `river_z`, `courtyard`, `snow_step`)의 격자·경로 길이·시작/출구·슬롯 수·장식 수를 추출한다.
   - **제품 기본값(`docs/contracts/product.defaults.v0.5.json`)**: 레이아웃 프레임/레일/모드 치수, 고비 보상, 무드 5종, 2026-10-28 사용자 확정 항목을 추출한다.
   - **서버 API 및 D1 스키마(`server/src/app.ts`, `server/wrangler.toml`, `server/migrations/*.sql`)**: `ROUTES` 객체의 메서드·경로·인증 여부·핸들러·줄 번호, `wrangler.toml` 공개 설정(도메인, D1 이름, 캐시 초, cron), SQL 마이그레이션의 모든 `CREATE TABLE` 및 `CREATE TRIGGER` 목록을 추출한다.
   - **원화 에셋(`public/assets/manifest.json`, `tools/assets/webp-exceptions.json`)**: 등록된 WebP 원화 총 매수와 PNG 예외 건수를 집계한다.
4. **핵심 의사결정 추출 (`extractDecisions`)**:
   - `AGENTS.md`, `docs/style-lock-v1.md`, `docs/prd_v0_3_decisions.md`, `docs/renewal/README.md`, `docs/HOSTING_PLAN.md`, `docs/HOSTING_IMPL_PLAN.md`, `docs/CR1000_REVIEW_POLICY.md`, `docs/CR1000_HANDOFF.md`의 확정 결정들을 도메인별로 구조화하고 각 원문 파일·절·줄 번호를 자동 매핑한다.
5. **문서 카탈로그 추출 (`extractDocsCatalog`)**:
   - 저장소 내 모든 마크다운 파일(루트, `docs/**`, `asset-source/**`, `content-source/**` — `.orchestrate`·`node_modules` 제외)을 스캔하여 생애주기(`현행 기준`, `리뉴얼 우선 기준`, `운영·인계`, `위키 지식`, `밸런스 실험 기록`, `보관·구판 이력`, `과거 작업패키지`, `원화·콘텐츠 검수 기록`), Diataxis 역할, **`validate-plan.mjs` 보호 잠금(`해시 고정` / `링크·PRD참조 검사` / `코드·시험 참조`)**, 글자 수·추정 토큰을 자동 집계한다.

### 2.2 부분 자동 갱신 마커 (`WIKI-AUTO`)

인간/에이전트가 작성한 설명 문맥을 해치지 않고 통계·카탈로그만 갱신하기 위해 아래 마커 구간을 치환한다.

```markdown
<!-- WIKI-AUTO:START:<block-id> -->
... (`npm run wiki:sync`가 결정적으로 갱신) ...
<!-- WIKI-AUTO:END:<block-id> -->
```

지원 블록 ID:
- `repo-stats`: 버전·출제 풀 문항 수·타워/적/맵/원화 매수·서버 API/D1 표 수·문서/위키 현황 요약 (`README.md`, `llms.txt`, `wiki/index.md`)
- `docs-overview`: 권위 계층별 핵심 문서 요약 표 및 전체 문서 분포 집계 (`docs/README.md`)
- `tech-stack-versions`: `package.json` 및 `.nvmrc`의 실제 고정 버전 표 (`wiki/entities/tech-stack.md`)

### 2.3 Git Hook 및 `commit-lock` · `--only` 안전 공존 설계

1. **`.orchestrate/commit.lock` 감지 시 즉시 통과**: CR-1000 등 자동 루프가 `commit-lock.mjs` 안에서 배치 커밋을 수행할 때는 훅이 개입하지 않고 즉시 종료 코드 `0`으로 통과한다.
2. **일반 `git commit` (`GIT_INDEX_FILE`이 임시 `--only` 인덱스가 아닐 때)**:
   - `pre-commit`: 스테이징된 파일 중 위키 생성 원천이 있을 때만 `sync`를 돌리고, **unstaged 변경이 없는 생성 파일만** 인덱스에 추가한다.
3. **`git commit --only -- <경로>` 및 `post-commit` / `post-merge` / `post-checkout`**:
   - `--only` 커밋 시 Git은 지정된 pathspec 밖의 `git add`를 최종 커밋에 반영하지 않으므로, `pre-commit`에서는 무결성 오류 여부만 빠르게 확인하고, `post-commit`·`post-merge`·`post-checkout`이 워킹 트리의 생성 레지스트리(unstaged 수정이 없는 파일만)를 조용히 최신 상태로 맞춰 둔다.
4. **비파괴 보호**: `docs/contracts/prd_v0_5_validation.json` 등 위키 관리 대상 밖의 파일은 어떤 경우에도 읽거나 덮어쓰지 않는다.

### 2.4 정적 검사 규칙 (`W01` ~ `W09`)

| 코드 | 기본 수준 | `--strict` | 검사 내용 |
| --- | --- | --- | --- |
| `W01` | error | error | `wiki/` 마크다운의 YAML frontmatter 필수 키(`id`, `type`, `title`, `status`, `updated` 또는 `generated_by`), enum, `id` 전역 유일성 |
| `W02` | error | error | 진입 문서(`AGENTS.md`, `CLAUDE.md`, `README.md`, `llms.txt`, `docs/README.md`, `docs/READ_FIRST.md`, `docs/WIKI_*.md`), `wiki/**/*.md`, `.agents/skills/**/*.md`의 로컬 상대 링크 실재 및 `wiki/` 내부 `#앵커` 실재 |
| `W03` | error | error | `wiki/` 활성 페이지 중 진입점이나 다른 위키 페이지에서 들어오는 링크가 0개인 고아 페이지 |
| `W04` | error | error | 유형별 글자 예산 준수 (`index` ≤ 3,800자, `hub` ≤ 6,500자, `entity` ≤ 4,500자, `project` ≤ 6,500자, `schema` ≤ 8,000자, `SKILL.md` ≤ 6,000자/150줄) |
| `W05` | warn | error | `wiki/` 큐레이션 페이지의 `sources` 파일 실재(미존재 시 error) 및 SHA-256 해시 일치 여부 |
| `W06` | error | error | 위키·진입 문서·스킬 본문에 적힌 `npm run <명령>`이 실제 루트 `package.json`에 존재하는지 검증 |
| `W07` | warn | error | 5대 레지스트리 및 `WIKI-AUTO` 마커 블록이 현재 코드·계약 원천과 바이트 단위로 일치하는지 검증 |
| `W08` | error | error | 교훈 원장 영구 ID(`wiki/_data/lesson-ids.json`) 누락 방지, 태그 어휘(`tags.json`) 준수, 필수 필드 검증 |
| `W09` | error | error | **`validate-plan.mjs` 읽기 전용 보존 검사**: 보존 파일 4종 SHA-256 해시 불변, `README.md`·`docs/READ_FIRST.md`·`docs/HANDOFF.md`의 `vocabulary_td_prd_v0_5.md` 포함 및 핵심 9개 문서 로컬 링크·코드 펜스 짝수 유지 검증 (`prd_v0_5_validation.json` 파일 쓰기 없음) |

---

## 3. 단계별 실행 계획

1. **Phase 1 — 자동화·조회·검사 엔진 구현 (`tools/wiki/**`)**
   - `lib/{fsutil,frontmatter,markdown,entries,extractors}.mjs` 작성
   - `gen.mjs`, `sync.mjs`, `watch.mjs`, `query.mjs`, `lint.mjs`, `stamp.mjs`, `budget.mjs`, `delta.mjs`, `curate.mjs`, `hooks/{install,run-hook}.mjs` 작성
2. **Phase 2 — LLM Wiki 큐레이션 지식 및 3단 진입 문서 구축 (`wiki/**`, `docs/README.md`, `llms.txt`, `AGENTS.md`, `README.md`, `.agents/skills/`)**
   - `wiki/_data/*`, `SCHEMA.md`, `index.md`, `glossary.md`, `log.md`, `entities/*`, `concepts/*`(6종), `projects/*`, `lessons/*`(3종), `templates/*` 작성
   - `llms.txt`, `docs/README.md` 신설 및 `README.md`, `docs/READ_FIRST.md`, `AGENTS.md` 현대화
   - `.agents/skills/wiki-maintain/SKILL.md` 작성 및 `package.json` 스크립트 연결
3. **Phase 3 — 동기화·스탬프·훅 설치·단위 시험·검증·커밋/푸시**
   - `npm run wiki:sync` → `npm run wiki:stamp` → `npm run wiki:hooks:install`
   - `tests/unit/wiki.test.ts` 작성 및 실행
   - `npm run wiki:check`, `npm run typecheck`, `npm run lint` 실행 및 `docs/contracts/prd_v0_5_validation.json` 무침범 확인 후 커밋·푸시
