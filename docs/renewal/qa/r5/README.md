# R5 P4 비교판

- 찍은 날: 2026-11-05 · 기준 커밋: `fb5b75a`(P3 트랙 A·B·C + P4 kit `Window`·계약 문구 정리까지)
- 판 하나 = 왼쪽부터 [R4 이전(`qa/pre-r4/`) 또는 복원 랜딩 기준(`qa/landing-baseline/`)] · [R5 착수 전(`qa/r5-baseline/`)] · [R5 P4]. 이전 캡처가 없는 장면은 2칸.
- 원본 PNG와 객관 검사 보고(`report.json`)는 git 무시 폴더 `test-results/r5-p4/`(보통), `r5-p4-large/`, `r5-p4-xlarge/`에 있다.

## 객관 검사(scenes.mjs 감사)

| 글자 크기 | 장면·사진 | 가로 넘침 | 44px 미만 | 13px 미만 | 비고 |
|---|---|---|---|---|---|
| 보통 | 33회 · 55장 | 0 | 0 | 0 | 실패 4회(04b cb·11 cb·12a desk·12e desk 시간 초과, 기기 부하 평균 21~30). 같은 장면 다른 크기는 찍힘 |
| 크게 | 25회 · 48장 | 0 | 0 | 0 | 잘림 1(창 안 스크롤 상자 감사 오탐 종류) |
| 아주 크게 | 25회 · 48장 | 0 | 0 | 0 | — |

## 명령

```
node tools/qa/scenes.mjs --out test-results/r5-p4 --scenes 01,02,03,04,04b,06a,06b,10a,10b,11,12 --port 5341 --no-montage
node tools/qa/scenes.mjs --out test-results/r5-p4-xlarge --scenes 01,02,10b,11,12 --font xlarge --port 5341 --no-montage
```
비교판은 메인 세션의 일회성 Pillow 스크립트로 이어 붙였다(webp 품질 80, 폭 2400px 상한).
