# Q20-003 진행 기록 (2/2 최종 완료)

## 1. 실행 요약 (총 20문항 완료)

- **실행 방식:** 브리지 실행 상한에 따라 1/2(10문항)과 2/2(10문항 + `RETURN.md`) 두 번에 나누어 실행했으며, 셸 명령 없이 파일 읽기·쓰기·웹 검색 도구만 사용함.
- **산출물:**
  - `content-source/batches/Q20-003/drafts.json` (총 20문항: `revision: 3` 3개 + `revision: 1` 17개)
  - `content-source/batches/Q20-003/sidecar.json` (20문항 `selfRefutation` 및 `rejected` 6건)
  - `docs/work-packages/Q20-003/RETURN.md` (최종 작업 반환서)
  - `content-source/batches/Q20-003/evidence/` 내 모든 파일은 일절 수정하지 않음(해시 보존)

## 2. 전체 20문항 목록

| 순서 | ID | 단계 | 구분 | 목표 낱말 | 유형 | 정답 | 근거 파일(`evidenceArtifactId`) |
|---|---|---|---|---|---|---|---|
| 1 | `g3-argon-0004` | 1/2 | rev 3 | 짐작하다 | `definition` | `d` | `g3-argon-0004.txt` |
| 2 | `g3-argon-0006` | 1/2 | rev 3 | 끈기 | `definition` | `b` | `g3-argon-0006.txt` |
| 3 | `g3-argon-0015` | 1/2 | rev 3 | 소중하다 | `cloze` (전환) | `c` | `g3-argon-0015.txt` |
| 4 | `g3-argon-0035` | 1/2 | rev 1 | 맞장구 | `definition` | `b` | `맞장구-113331-1.txt` |
| 5 | `g3-argon-0036` | 1/2 | rev 1 | 살피다 | `definition` | `a` | `살피다-441353-1.txt` |
| 6 | `g3-argon-0037` | 1/2 | rev 1 | 데굴데굴 | `cloze` | `c` | `데굴데굴-83829-1.txt` |
| 7 | `g3-argon-0038` | 1/2 | rev 1 | 속상하다 | `cloze` | `a` | `속상하다-447949-1.txt` |
| 8 | `g3-argon-0039` | 1/2 | rev 1 | 아쉽다 | `synonym_context` | `d` | `아쉽다-222054-2.txt` |
| 9 | `g3-argon-0040` | 1/2 | rev 1 | 부끄럽다 | `antonym_context` | `b` | `부끄럽다-434676-1.txt` |
| 10 | `g3-argon-0041` | 1/2 | rev 1 | 깡충깡충 | `usage` | `c` | `깡충깡충-53176-1.txt` |
| 11 | `g3-argon-0042` | 2/2 | rev 1 | 어리둥절하다 | `definition` | `d` | `어리둥절하다-454584-1.txt` |
| 12 | `g3-argon-0043` | 2/2 | rev 1 | 실망하다 | `definition` | `c` | `실망하다-202742-1.txt` |
| 13 | `g3-argon-0044` | 2/2 | rev 1 | 용기 | `definition` | `a` | `용기-468084-1.txt` |
| 14 | `g3-argon-0045` | 2/2 | rev 1 | 꾸준하다 | `cloze` | `d` | `꾸준하다-57512-1.txt` |
| 15 | `g3-argon-0046` | 2/2 | rev 1 | 살랑살랑 | `cloze` | `b` | `살랑살랑-446419-1.txt` |
| 16 | `g3-argon-0047` | 2/2 | rev 1 | 반짝반짝 | `cloze` | `a` | `반짝반짝-427340-1.txt` |
| 17 | `g3-argon-0048` | 2/2 | rev 1 | 쑥스럽다 | `synonym_context` | `c` | `쑥스럽다-453518-1.txt` |
| 18 | `g3-argon-0049` | 2/2 | rev 1 | 반갑다 | `synonym_context` | `b` | `반갑다-427373-1.txt` |
| 19 | `g3-argon-0050` | 2/2 | rev 1 | 차분하다 | `antonym_context` | `d` | `차분하다-483016-1.txt` |
| 20 | `g3-argon-0051` | 2/2 | rev 1 | 조심스럽다 | `usage` | `a` | `조심스럽다-478604-1.txt` |

## 3. 분포 요약 및 다음 단계

- **새 문항 17개 유형 분포:** `definition` 5, `cloze` 5, `synonym_context` 3, `antonym_context` 2, `usage` 2 (목표 100% 일치)
- **전체 20개 유형 분포:** `definition` 7, `cloze` 6, `synonym_context` 3, `antonym_context` 2, `usage` 2
- **전체 20개 정답 위치 분포:** `a` 5, `b` 5, `c` 5, `d` 5
- **제외(`rejected`) 합계:** 6개 (`나누다`, `정직하다`, `견디다`, `대견하다`, `기특하다`, `어울리다`)
- **다음 행동:** 총괄이 `npm run validate:content`를 실행해 20문항 최종 검증 및 블라인드 독립 검토 입력을 생성함.
