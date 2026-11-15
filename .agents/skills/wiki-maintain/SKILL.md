---
name: wiki-maintain
description: 타워디펜스 저장소의 LLM Wiki(`wiki/`)를 최소 토큰으로 조회(`wiki:query`)하고, 코드·계약 변경 후 자동 레지스트리 동기화(`wiki:sync`)·해시 스탬프(`wiki:stamp`)·무충돌 교훈 제출(`wiki:delta`)·엄격 검증(`wiki:check`)을 수행할 때 사용한다.
---

# LLM Wiki 탐색 및 유지보수 (`wiki-maintain`)

이 저장소는 140개 이상의 원천 문서를 통째로 읽는 비용과 구식 문서 오독을 막기 위해 `wiki/` 컴파일 지식 계층을 운영한다. 상세 규약은 [SCHEMA.md](../../../wiki/SCHEMA.md)에 있다.

## 1. 점진적 문맥 탐색 절차 (읽기 6,000자 예산)

1. **라우터 확인**: 항상 [wiki/index.md](../../../wiki/index.md)와 [docs/README.md](../../../docs/README.md)에서 시작한다.
2. **도메인 허브 진입**: 작업 대상에 맞는 `wiki/concepts/*.md` 1개와 자동 레지스트리([contracts.md](../../../wiki/contracts.md), [codemap.md](../../../wiki/codemap.md), [commands.md](../../../wiki/commands.md))만 읽는다.
3. **원본 정밀 발췌 (`wiki:query`)**: 대형 PRD(`vocabulary_td_prd_v0_5.md` 등)는 통째로 열지 말고 절 단위로 발췌한다.
   ```sh
   npm run wiki:query -- --toc vocabulary_td_prd_v0_5.md
   npm run wiki:query -- --section vocabulary_td_prd_v0_5.md 13.2
   npm run wiki:query -- --tower cannon
   npm run wiki:query -- --bank
   npm run wiki:query -- --route
   npm run wiki:query -- --lessons --tag cr1000
   ```

## 2. 코드·계약·문서 수정 후 자동 갱신 절차

1. **자동 레지스트리·마커 동기화 (`wiki:sync`)**
   - `package.json`, `eslint.config.js`, `src/`, `server/`, `docs/contracts/*.json`, `src/content/questions/manifest.json`, `public/assets/manifest.json` 또는 문서 구성을 바꿨다면 커밋 전에 실행한다.
   ```sh
   npm run wiki:sync
   ```
   - `wiki/{commands,codemap,contracts,decisions-index,docs-catalog}.md` 5종과 `README.md`, `llms.txt`, `docs/README.md`, `wiki/index.md`, `wiki/entities/tech-stack.md`의 `WIKI-AUTO` 블록을 결정적으로 갱신한다(타인 unstaged 파일 자동 보호).
2. **원본 해시 스탬프 (`wiki:stamp`)**
   - 위키 큐레이션 문서의 `sources`에 등록된 원본을 수정했고, 위키 요약 본문도 최신 내용과 맞췄다면 해시를 갱신한 뒤 다시 한 번 `wiki:sync`로 글자 수 집계를 맞춘다.
   ```sh
   npm run wiki:stamp && npm run wiki:sync
   ```

## 3. 다중 에이전트 무충돌 교훈 제출 (`wiki:delta` → `wiki:curate`)

- `wiki/lessons/*.md`를 직접 편집하면 동시 작업 시 병합 충돌이 난다. 새 교훈이나 위반 카운터는 `wiki/_inbox/`에 단일 파일로 추가한다.
  ```sh
  npm run wiki:delta -- \
    --area engineering \
    --title "짧은 규칙 제목" \
    --when "발생 상황" \
    --rule "준수할 규칙" \
    --why "근거·사고 사례" \
    --check "검사 명령" \
    --tags "architecture,verification" \
    --source "AGENTS.md#L7"
  ```
- 수신함 점검 및 원장 반영(단독 정리 시):
  ```sh
  npm run wiki:curate
  npm run wiki:curate -- --apply wiki/_inbox/<파일명>.md --new
  ```

## 4. 커밋 전 검증 체크리스트

- **엄격 검사**: `npm run wiki:check` (`sync --check` + `lint --strict` `W01`~`W09` 무결성·링크·앵커·고아·예산·보존 해시 전부 검사)
- **예산 점검**: `npm run wiki:budget`
- **금지 사항**:
  - 기존 `docs/**`, `vocabulary_td_prd_*.md`, `asset-source/**`, `content-source/**` 파일 이동·삭제·이름 변경 절대 금지
  - `wiki/{commands,codemap,contracts,decisions-index,docs-catalog}.md` 수동 편집 금지 (`wiki:sync`로만 생성)
  - 타인이 미커밋 수정 중인 `docs/contracts/prd_v0_5_validation.json` 덮어쓰기 금지
