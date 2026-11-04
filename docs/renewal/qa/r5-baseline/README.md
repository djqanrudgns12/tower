# R5 착수 전 기준선 캡처

- 찍은 날: 2026-11-04
- 기준 커밋: `f082690` (브랜치 `p1/intake-round1`, 랜딩 복원판 홈 + R4 나머지 화면). R5 결과를 이 폴더와 나란히 비교한다.
- 형식: webp(품질 80), 59장, 합계 약 2.9MB. 원본 PNG와 객관 검사 보고(`report.json`)는 git 무시 폴더 `test-results/r5-baseline-png/`에 있다.
- 파일 이름: `<장면 id>-<shot>-<크기>.webp`. 크기: `desk` 1440×900, `cb` 1366×650, `phone` 390×844, `w1100` 1100×800, `w1180` 1180×800.

## 명령

```
node tools/qa/scenes.mjs --out test-results/r5-baseline-png --scenes 01,02,03,04,04b,06a,06b,10a,10b,11,12 --no-montage --port 5341
# PNG → webp
magick <파일>.png -quality 80 -define webp:method=6 docs/renewal/qa/r5-baseline/<파일>.webp
```

장면 12a~12f는 이번에 `tools/qa/scenes.mjs`에 더했다(크기 `w1100`·`w1180`은 `tools/qa/lib.mjs`, 오답 노트 항목 빌더 `buildReviewNote`는 `tools/qa/states.ts`).

## 파일 목록

| 장면 | 파일(shot) | 설명 |
| --- | --- | --- |
| 01 홈 → 새 게임 | `01-home-form-{cb,phone}` | 닉네임·학교 이름을 채운 홈(폼 위치 확인) |
| | `01-home-{desk,cb,phone}` | 맨 위로 스크롤한 홈 |
| | `01-home-full-phone` | 휴대폰 홈 전체 쪽(390×1891). cb는 뷰포트와 같아 뺐다 |
| | `01-newgame-{desk,cb,phone}` | 새 게임 창(학년·난이도 고르기) |
| | `01-first-prep-{desk,cb,phone}` | 시작 직후 첫 준비 문제 화면 |
| 02 | `02-battle-desk` | W1 전투 시작 |
| 03 | `03-cards-desk`, `03-picked-desk` | W3 뒤 징집 카드 3장, 하나를 고른 뒤 |
| 04 | `04-tools-desk`, `04-choice-desk` | 타워를 눌러 연 도구 줄, Lv4 진화 A/B 고르기 |
| | `04-after-a-desk`, `04-after-b-desk` | 고른 순간(빛기둥)과 진화가 끝난 모습 |
| 04b | `04b-trap-{desk,cb,phone}` | 고른 타워 상황 카드(잘 잡는 적·약한 적 아이콘) |
| 06a | `06a-boss5-desk`, `06a-boss5-later-desk` | W5 대장(국자대장) 처음과 0.7초 뒤 |
| 06b | `06b-boss10-desk` | W10 대장(멧돼지기수) |
| 10a | `10a-pause-cb` | 일시정지 창 |
| 10b | `10b-result-cb` | 패배 뒤 결과 화면. 전체 쪽 캡처는 뷰포트와 같아 뺐다 |
| 11 | `11-cards-{desk,cb,phone}`, `11-picked-{desk,cb,phone}` | W10 대장 뒤 원정 보물 고르기, 고른 뒤 상태 |
| 12a 사용 설명서 | `12a-guide-{desk,cb,phone}` | 홈 '사용 설명서' 창 첫 화면(카드 목차) |
| | `12a-guide-detail-{desk,cb,phone}` | 첫 카드의 '자세히'를 펼친 상태 |
| 12b 설정 | `12b-settings-{desk,cb,phone}` | 홈 '설정' 창(환경설정) 맨 위 |
| | `12b-settings-bottom-{cb,phone}` | 같은 창을 맨 아래까지 민 모습 |
| 12c 랭킹 | `12c-ranking-{desk,cb,phone}` | 랭킹 판 '상세 순위표 열기'로 연 전체 보기 창. 개발 서버라 순위는 빈 상태 |
| 12d 오답 노트(빔) | `12d-note-empty-{desk,cb,phone}` | 기록이 없는 오답 노트(책 그림 + 안내 한 줄) |
| 12e 오답 노트(8개) | `12e-note-{desk,cb,phone}` | 낱말 8개가 담긴 오답 노트(3학년 은행, 졸업 점 0/1 섞음) |
| | `12e-note-full-{cb,phone}` | 같은 화면 전체 쪽(cb 1366×690, phone 390×1252) |
| 12f 홈 중간 폭 | `12f-home-{w1100,w1180}` | 홈 첫 화면 머리판(브랜드·현황 4칸·단추 4개)이 줄바꿈되는 폭 |
| | `12f-home-full-{w1100,w1180}` | 같은 폭의 홈 전체 쪽 |

## 객관 검사(`scenes.mjs` 요약, 사진 61장·33회 실행 기준)

- 가로 넘침 0장 / 44px 미만 조작 요소 0장 / 13px 미만 글자 0장 / 깨진 이미지 0장 / 콘솔·페이지 오류·요청 실패 로그 0건.
- 잘림(`cutOff`) 4장: `12a-guide-cb`, `12a-guide-detail-cb`, `12b-settings-cb`, `12b-settings-bottom-cb`. 1366×650에서 창 안쪽 스크롤 영역의 제목·줄이 홈 바탕 가장자리를 4~34px 넘는다는 표시이고, 캡처상 창 안 스크롤로 가려진 것이라 실제 잘림은 아니다(검사기가 스크롤 상자를 구분하지 못하는 경우).

## 알아 둘 점

- 홈 머리판 현황은 개발 서버(오프라인)라 '공개 기록 꺼짐 · 연결 대기'이고, 랭킹 판·전체 보기는 기록 없음 상태다.
- 오답 노트 8개는 `tools/qa/states.ts`의 `buildReviewNote(8)`가 3학년 은행의 뜻을 이름순으로 고르게 뽑아 localStorage(`vocabulary-td.reviewNote.v1`)에 넣은 값이다.
- 맵 미리보기(2x 장면)·색조(08)·침입(09)·Lv7(05)·효과(07) 장면은 이번 기준선에서 뺐다.
- 10b는 첫 실행에서 `계속하기` 창 대기(30초) 시간 초과가 한 번 났고, 같은 명령으로 다시 돌려 통과했다.
