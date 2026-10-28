# 현재 제작 계약과 검산

현재 요구는 [PRD v0.5](../../vocabulary_td_prd_v0_5.md)다. PRD와 JSON이 다르면 조용히 한쪽을 선택하지 않고 같은 변경에서 맞춘다. `node tools/validate-plan.mjs`가 주요 표의 일치를 검사한다.

| 파일 | 역할 | 상태 |
|---|---|---|
| [maps.candidate.v0.4.json](maps.candidate.v0.4.json) | 15×9·4개 긴 경로·80개 지정 슬롯·영구 장식 | 좌표 후보, 게임 밸런스 미검증(v0.5에서 좌표 변경 없음) |
| [product.defaults.v0.5.json](product.defaults.v0.5.json) | 화면 R/S 모드·확대 기준·고비보상·무드·‘모르겠어요’·숫자/저장 방식·학생용 표시 | 작업 기본값, 제품 승인 아님 |
| [balance.candidate.v0.4.json](balance.candidate.v0.4.json) | 난이도·적·타워 Lv1·강화·웨이브 생성식(정수 ms·BP·milli 단위) | 현재 밸런스 후보(S11 엔진 시뮬레이션 반영), 나머지 7종 분기는 P2에 추가 |
| [balance.candidate.v0.3.json](balance.candidate.v0.3.json) | 이전 후보 | S11 기준선의 비교 대상으로만 보존 |
| [question-draft.schema.json](question-draft.schema.json) | 실제 초안 스키마0.2 | draft/machine_checked 전용 |
| [prd_v0_5_validation.json](prd_v0_5_validation.json) | 현재 문서/계약/좌표/해시 검사 실제 결과 | 제품 실행 시험과 구분 |

이력: `product.defaults.v0.4.json`·`prd_v0_4_validation.json`은 v0.4 기준, `maps.candidate.v0.2.json`·`validation_report.json`은 과거7×7/산술 검산이다. 현재 계약으로 가져오지 않는다. 제품의 런타임 schema/게시 은행/리깅 manifest는 구현 단계에 작성한다. 현재 JSON 후보를 곧바로 승인 콘텐츠로 배포하지 않는다.

초안의 추가 제작 정보는 sidecar에 두고 스키마의 additionalProperties:false를 우회하지 않는다. `readingLoad`는 게시 빌드가 계산해 게시본에만 넣는다. 게시본은 실제 공동검수 레지스트리와 id/revision/hash를 연결해 생성한다. JSON 스키마만으로 문항 정답의 유일성은 증명할 수 없다.
