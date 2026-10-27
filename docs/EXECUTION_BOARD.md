# 현재 작업 게시판

기준일: 2026-10-28 · 현재 구간: **PRD 점검·보강(v0.5)** · 제품 구현: **미착수**

현재 문서 작업자: Claude Opus 5.5(Claude Code). 이전 v0.4 문서 작업자: Codex. 외부 Argon/Codex 실행 및 실제 공동검수 반환물은 없다. 아래 READY는 미래 작업 정의이며 발행/실행 완료가 아니다. 제품 구현 총괄은 다음 구현 요청 시 지정한다. 출발 제안은 Codex→Claude→Codex 교대다.

기준 commit: `fe625edf2f6a19c992a204e4d52934cce9501690`. 이번 점검 시작 때 Codex의 v0.4 변경이 미커밋 상태였고 보존했다. 이번 문서 변경도 미커밋이다. 현재 PRD는 [v0.5](../vocabulary_td_prd_v0_5.md), 요청/반환/인계 규격은 [작업 지시서](model_work_orders_v0_5.md)다.

| jobId | 상태 | 다음 담당 역할 | 소유 범위(구현 시 정확한 파일 확정) | 선행 입력 |
|---|---|---|---|---|
| CORE-P1 | READY·미발행 | 현 총괄 Codex 또는 Claude | domain/application/persistence·공유 계약 | 구현 지시·버전 호환성 표본·`balance.candidate.v0.3` 스키마 |
| UI-Q-001 | READY·미발행 | Argon 4 | ui/question·전용 CSS/fixture | QuestionPanelProps·토큰 고정·§12.5 3구획·§12.8 반려표 |
| UI-M-001 | READY·미발행 | Argon 4 | ui/management·전용 CSS/fixture | 거래 event·토큰 고정·§12.1 R/S 모드·설치 미리보기 |
| ART-SAMPLE | READY·미발행 | Codex 이미지 작업 | 지정 asset-source/incoming | asset ID·레이어·수량 고정·§11.1 가져오지 않을 요소 |
| RIG-001 | READY·미발행 | Claude 또는 Codex 별도 작업 | game/animation·전용 fixture | 실제 인수 원본·pivot/muzzle |
| Q20-001 | READY·미발행 | Argon 4 | 지정 content-source/batch | 실제 의미·학년 근거 확보·§9.2 읽기 수준 규칙 |
| SIM-S11 | READY·미발행 | 현 총괄 | tools/·tests/ 시뮬레이터 | CORE-P1 엔진, §17.3 표 형식, `balance-sketch` 대체 |

총괄만 공유 schema/package/lockfile/전역 토큰/라우터/인덱스를 수정한다. 같은 파일 소유권을 두 작업에 주지 않는다. 모든 작업자는 RETURN만 제출하고 ACCEPTED는 총괄이 검사 후 부여한다. 교대 때 RUNNING job의 계약과 소유권을 보존한다.

현재 측정된 제품 성과: 없음. 앱 빌드·게임 시험·브라우저·실기기·엔진 밸런스·외부 공동검수·배포는 미실행. 근사 모델(`tools/balance-sketch.mjs`) 결과는 PRD §17.3과 [점검 근거](prd_v0_5_review.md)에 있으며 제품 성과가 아니다. 문서 검산 결과는 [검산 보고서](contracts/prd_v0_5_validation.json)를 따른다.
