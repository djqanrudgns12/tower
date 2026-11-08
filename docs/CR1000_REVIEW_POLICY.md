# CR-1000 실용 검수 정책 — codex-argon-v1

2026-11-06 최신 사용자 지시: **Claude를 역할에서 제외하고 Codex와 Antigravity 판단으로 진행한다. 사용량 복구를 기다리지 않는다.** 기존 Claude 필수 승인 조건보다 이 결정이 우선한다.

앞선 사용자 지시: 판정 기준을 대폭 완화하고 중간 과정을 간소화하되, 학습 품질과 자연스러운 한국어를 지킨다. 앞선 계획서의 취향 중심 반려·추가 검수 의무보다 이 정책을 우선한다.

## 1. 수정이 필요한 오류와 권고

| 수정·격리 대상 | 통과 가능하며 필요하면 권고만 기록 |
|---|---|
| 실제 복수 정답, 정답 없음, 키 불일치 | 문맥에 없는 상황을 가정해야만 가능한 다른 해석 |
| 사전의 표제어·품사·뜻 불일치, 근거 부족 | 표현을 사전 문구와 똑같이 맞추자는 취향 |
| 해설·오답 이유의 오류, 모순, 이유 없는 동어반복 | 정확하고 자연스러운 짧은 해설에 부연을 추가하자는 제안 |
| 비문, 틀린 맞춤법·조사, 이해 불가능한 상황 | 자연스러운 다른 표현, 허용 표기, 통상적인 생략 |
| 문맥으로도 해결 못 하는 전문 지식, 부적절한 내용 | 목표 어휘를 아직 모른다는 사실, 교과서 출현 시기 미확인, 미세한 tier 차이 |
| 뜻을 몰라도 형식만 보고 답이 드러나는 단서 | 목표 낱말을 뜻 묻는 발문에 쓰기, 보기 길이의 작은 차이 |

`fail`은 구체적인 오류에, `uncertain`은 판정에 꼭 필요한 정보가 없어 실질적 오류를 배제할 수 없을 때 쓴다. 취향만 남으면 `pass`와 선택적인 `[권고]`를 쓴다. **기존 fail/uncertain을 코드가 일괄 pass로 바꾸지 않는다.** 새 판정 요청부터 같은 기준을 Codex·Claude에게 적용한다.

통과 findings는 `[]`로 충분하다. 지적은 문제 구절 또는 대안 정답과 최소 수정 한 가지만 쓴다. 긴 칭찬·전체 문항 재작성·반복 지적은 생략한다.

## 2. AI SLOP 금지

어색한 직역, 억지 인과관계·교훈, 불필요하게 거창한 추상 표현, 내용 없는 상투 문장을 구체적인 문제 구절로 판정한다. 특정 단어가 있다는 이유만으로 반려하지 않는다.

제작·수정은 아이가 겪을 만한 구체적인 상황과 짧고 분명한 말을 쓴다. 한 문장에 조건을 욱여넣는 대신 필요한 경우 짧은 두 문장으로 쓴다. 읽기량 상한은 유지한다. 해설은 정답 이유, 오답 이유는 그 뜻이 상황과 다른 이유를 말한다. 이미 자연스럽고 정확한 부분은 다시 쓰지 않는다.

## 3. 실행과 승인

- 제작·자체 반박·수정은 Antigravity Argon High, 독립 풀이와 공개 대조는 Codex gpt-6-astra/high가 맡는다. Claude에는 새 작업을 보내지 않는다.
- `content-loop --gate --stage-only --without-claude`는 S1 수준 판정 → S2 Codex 독립 풀이 → S3 수정 → S4 Codex 공개 대조 → S5 Argon 수정을 자동 진행한다. 수정판은 S1부터 필요한 단계만 다시 거친다. `--until S3`는 앞단만 진행하는 선택 사항이다.
- S4는 현재 Codex 독립 풀이를 보존하고 해설·오답 이유·근거를 대조한다. 기존 Codex 공개 대조의 실제 입력/결과·내용/오답 이유 해시·모델 설정이 일치하면 재사용한다. 그 외에는 공개 대조만 추가 호출한다. 현재 실패는 S5에 넘기고, 통과를 얻으려고 자동 pass로 바꾸지 않는다.
- `publicationPolicy: codex-argon-v1`이 붙은 배치의 공개 조건은 Argon 자체 반박, 현재 Codex 독립 풀이 일치와 source/uniqueness/grade/language/explanation pass, 현재 contentHash·rationalesHash의 Codex 해설 대조 pass, 게시 형식·의미·Q50 엄격 검사다. 실제 현재 Argon 블라인드 지적도 유지한다. Argon에게 제공하지 않은 해설의 uncertain은 추가 검수 의무로 만들지 않으며, 실제 explanation fail은 차단한다.
- 항목별 모델·effort 출처를 사용한다. 항목별 출처 도입 전의 보고서는 명시된 gpt-6-astra 모델·freshContext·2단계 도구 출처로 독립 풀이를 확인한다. 과거 effort를 지어내지 않으며, 새 Codex 해설 대조에는 실제 high/xhigh 출처를 남긴다. 약한 예전 GPT-6 보고서를 자동 승격하지 않는다.
- 이미 공개된 legacy 문항은 기존 완료 근거를 보존한다. 새 정책은 배치별 명시적 전환으로 적용하며, Claude의 과거 지적이나 부재가 새 승인을 막지 않는다. 이전 Claude 해설 파일은 덮어 버리지 않고 보관한다.
- `--skip-level-spotcheck`는 합의에 반영되지 않는 참고 표본 호출만 생략한다. 두 독립 수준 판정·합의 계산은 유지한다. `--skip-argon-fresh`는 제작자의 추가 새 문맥 호출만 생략하며 자체 반박·독립 Codex 풀이·실제 기존 실패는 유지한다.
- 읽기량 상한과 수정 회차 한도(앞단 2회·관문 2회)를 유지한다. 실제 오류·AI SLOP을 고치되 표현 취향에 따른 반복 수정은 하지 않는다.
- 여러 배치는 `--pool-after 2 --codex 2 --argon 1`로 진행한다. 50개 공개 대조 묶음의 병렬 수는 `--review-concurrency`로 1~4 사이에서 제한하고, 여러 실행기의 실제 동시 수를 합산한다.
- 추적 콘텐츠는 `commit-lock`에서만 반영한다. staging 통과와 최종 공개 승인을 구분하며, 은행/콘텐츠/서버 시험과 잠금 커밋을 마친 실제 공개 문항만 목표에 센다. 서버 자원 대기는 모델 작업을 막지 않는다. 배포는 사용자 확인 뒤에 한다.

## 4. 현재 분업

- Codex 메인: 실행·승인 규칙·결과 확인·잠금 반영·커밋·push.
- Codex 구현 담당: 승인 계약과 자동 실행 흐름을 파일별로 나눠 구현. 메인이 diff와 관련 시험을 직접 확인한다.
- Antigravity: 제작·수정·자체 반박·수준 판정. agy 제한 호출을 사용하고 현재 시간당 상한을 지킨다.
- Claude: 현재 역할 없음. 이전 정책 검토·문항 검수 기록은 감사 근거로 보존하며 새 승인에는 사용하지 않는다.

## 5. claude-argon-v1 — Claude 대체 검수(2026-11-09 사용자 결정)

Codex 사용량이 2026-11-14 08:13 KST까지 소진되어, 사용자가 남은 난이도 바닥 보충을 **Claude가 대신 검수**하도록 정했다. 위 §1~§3의 판정 기준·AI SLOP 금지·수정 한도·잠금 반영은 그대로 쓰고, 담당만 바꾼다.

- `publicationPolicy: claude-argon-v1` 배치는 Codex 자리(S1 두 번째 수준 판정, S2 독립 풀이, 공개 대조)를 Claude Opus(`claude-opus-5-5`, effort high 이상)가 맡는다. 공개 조건은 `codex-argon-v1`과 같다: Argon 자체 반박, 현재 revision·contentHash의 Claude 독립 풀이 일치와 다섯 판정 pass(항목 run 출처 필수), 현재 contentHash·rationalesHash의 Claude 해설 대조 pass, Argon 블라인드의 실제 지적, 게시 형식·의미·Q50 엄격 검사. Sonnet·Haiku나 낮은 effort 출처는 인정하지 않는다. 실제 조건은 `tools/content/bankBuild.ts`의 `decidePolicy`가 정한다.
- 정책은 배치 단위다. 아직 추적하지 않은 새 제작 배치에만 붙이며(S2 Claude 검수 반영 때 sidecar에 기록), 기존 `codex-argon-v1`·legacy 배치는 바꾸지 않는다. 그래서 G6-014 개선 회수 4개처럼 기존 Codex 정책 배치의 개선분은 Codex 복구 뒤에 검수한다.
- 실행: `content-loop --gate --stage-only --primary claude --skip-argon-fresh --skip-level-spotcheck`. Claude 호출은 `claude -p`에 내장 도구·MCP·설정 훅을 모두 끄고(`--tools "" --strict-mcp-config --setting-sources ""`) 세션도 남기지 않는다.
- 제작·자체 반박·수정은 계속 Argon High가 맡는다. Codex가 복구돼도 이미 `claude-argon-v1`로 승인된 배치를 Codex 정책으로 되돌려 쓰지 않는다(`finalize-codex`가 거부한다).
