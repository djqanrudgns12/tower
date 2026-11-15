# 문서 시작점

> **에이전트 빠른 진입**: 최소 토큰 탐색은 **[LLM Wiki 색인](../wiki/index.md)** → **[문서 네비게이션 허브](README.md)** → **[살아있는 계약 레지스트리](../wiki/contracts.md)** 순서로 시작하고, 긴 문서는 `npm run wiki:query -- --section <파일> <절>`로 필요한 절만 발췌하세요.

기본 제품 명세 원본은 [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md)이며, 초기 P1 기준 인계·점검 이력은 [인계서](HANDOFF.md) → [v0.5 점검 근거](prd_v0_5_review.md) → [작업 게시판](EXECUTION_BOARD.md) → [모델별 지시문](model_work_orders_v0_5.md)에 보존되어 있습니다.

**현행 우선 기준 (코드 `v1.0.0` 운영 반영 완료)**:
1. **작업 규칙**: 단일 작업 폴더·부분 커밋·WebP·잠금 규칙은 [AGENTS.md](../AGENTS.md)가 최우선입니다(`HANDOFF.md`·`EXECUTION_BOARD.md`의 옛 worktree 절차는 폐기).
2. **게임 디자인·리뉴얼**: 타워 20종·Lv4/Lv7 진화, 종족 8종×역할 10종 몬스터, 학년별 맵 4종, UI 규정 완화, 바로 설치는 [리뉴얼 헌장](renewal/README.md)과 하위 문서가 [제작 PRD v0.5](../vocabulary_td_prd_v0_5.md)보다 우선합니다.
3. **운영 호스팅·배포**: 정적 웹(`voca.ssamuniverse.com`, GitHub Pages 회색 구름 DNS)과 기록·랭킹 서버(`voca-api.ssamuniverse.com`, Cloudflare Workers + D1)는 [배포 안내서](DEPLOY.md)와 [호스팅 구현 계획서](HOSTING_IMPL_PLAN.md)가 기준입니다.
4. **문제은행 공동검수(CR-1000)**: 3~6학년 공개 문제은행(자기 학년 승인 5,500+문항, 공유 포함 출제 풀 6,500+문항)은 [CR-1000 인수인계](CR1000_HANDOFF.md)와 [검수 정책](CR1000_REVIEW_POLICY.md)을 따릅니다.

41번 화풍([확정 화풍](style-lock-v1.md))과 ‘모르겠어요’ 0점·난이도 한국어 표시·배속 없음·HP 성장 115%(2026-10-28)는 확정 불변 규칙입니다. v0.1·v0.3·v0.4 문서는 해시가 고정된 비교용 이력입니다.
