# WEBP-1 · 전투 그림 378장 WebP 전환 비교판

2026-11-05, Claude 서브에이전트. 근거: [호스팅 구현 계획서](../../../docs/HOSTING_IMPL_PLAN.md) §1~§3 단계 1. 변환 도구 `tools/assets/to-webp.mjs`(cwebp 1.6.0), 비교판 도구 `tools/assets/webp-compare.mjs`.

## 한 일

- `public/assets/manifest.json`의 `integrated_pass` 378장을 `cwebp -q 85 -alpha_q 100 -m 6`으로 바꿨다(예외 없음). `file`은 `.webp`, `artifactHash`는 WebP 파일의 sha256이고 `sourceHash`는 그대로다. 옛 PNG는 `git rm`으로 뺐다. 되살리려면 이 작업 커밋의 부모에서 `git show <부모>:public/assets/<이름>.png`로 꺼낸다.
- `public/assets/ui/**`·`guide/**`의 PNG 34장은 단계 4(R5 P3 뒤) 몫이라 그대로 두고 `tools/assets/webp-exceptions.json`에 "단계 4 전환 대기"로 올렸다. 단위 시험(`tests/unit/webp-assets.test.ts`)은 이 목록 밖의 PNG가 `public/assets/`에 있으면 실패한다.

## 용량

| 묶음 | 지금 PNG | WebP | 비율 |
|---|---|---|---|
| 타워 154장 | 6.14MB | 1.37MB | 22% |
| 맵 재료 108장(정원 + 강가·궁궐 뜰·설원) | 5.64MB | 1.13MB | 20% |
| 그 밖 116장(몬스터·장식·효과) | 2.41MB | 0.70MB | 29% |
| **합계 378장** | **14.19MB** | **3.20MB** | **23%** |
| 정원 맵 판 306장 | 10.35MB | 2.43MB | 23% |

계획서 §1의 시험 변환 수치와 같다. WebP가 PNG의 50% 이상인 그림은 `map.snow_step.path.tuft.0`(50%) 하나뿐이라 PNG 유지 후보(90% 이상)는 없다.

## 알파(투명도)

- 378장 모두 PNG와 WebP의 알파 채널이 8비트 단위로 완전히 같다(변환 도구가 ImageMagick `-alpha extract`로 바이트 대조, 불일치 0장).
- 완전 불투명한 바닥 타일 18장(`layer: ground`)은 cwebp가 알파 평면을 아예 빼 저장한다. 투명도 정보가 없는 것과 전부 255인 것은 같아서 손실이 없다. `tests/unit/content.test.ts`가 이 경우만 허용한다.
- 알파를 읽는 코드(`layoutGround.alphaBox`, `TowerLayer`)는 브라우저가 풀어 준 픽셀을 쓰므로 그대로 동작한다. 알파를 직접 읽는 시험 두 곳(`animation.test.ts`, `ground-layout.test.ts`)은 `tests/unit/imageMeta.ts`의 읽기 함수(PNG·WebP 모두, 외부 도구 불필요)로 바꿨다.

## 화질

- 회색 바탕에 얹어 잰 PSNR: 평균 37.2dB, 중앙값 35.7dB, 하위 10%가 32.6dB 이하, 최저 29.45dB(`tower.cannon.A1`). 전체 값은 `stats.json`.
- 33dB 미만 47장은 대부분 타워·몬스터(가는 윤곽선이 많은 그림)이고 나머지는 노랑 나비 효과(`fx.butterfly.yellow.0`, 18px)와 강가 나루터(`map.river_z.landmark.ferry`) 2장이다. 이 2장과 `corsair.flyer`도 비교판으로 따로 봤고 문제가 없었다. 가장 낮은 6장(`cannon.A1`, `frost.B1`, `beetle.brute`, `trap.A2`, `frost.A2`, `frost.B2`)은 4배 확대와 차이 6배 강조로 따로 봤다. 차이는 가는 윤곽선 둘레의 색 번짐(4:2:0 색 줄임)뿐이고 실제 칸 크기(72px)와 2배 확대에서는 보이지 않는다. 거미줄(`trap.A2`)이 2배 확대에서 아주 조금 부드러워지는 정도다.
- **눈 확인 결과**: 아래 5장을 직접 열어 봤다. 뭉개지거나 테두리 얼룩·색 띠가 보이는 그림이 없어 q92·무손실 예외는 0개다.

## 비교판 읽는 법

그림마다 한 줄 설명(id, PNG|WebP 용량, PSNR, 표시 크기)과 네 칸이 있다: **왼쪽 PNG, 오른쪽 WebP**. 앞 한 쌍은 풀색 바탕의 실제 표시 크기(칸 72px × `displayCells`), 뒤 한 쌍은 어두운 바탕의 2배 확대다(밝은 얼룩·어두운 얼룩이 모두 보이게). 시트는 용량을 아끼려고 무손실 WebP다(브라우저로 열린다).

| 시트 | 내용 |
|---|---|
| `webp1-tower-base.webp` | 타워 기본형 20종 |
| `webp1-tower-evolved.webp` | 진화형 표본 20종(타워마다 하나, A·B·A1·B2·A2·B1을 돌려 가며) |
| `webp1-monsters.webp` | 종족 8개 × 2(걷는 일꾼 또는 달리기 + 5웨이브 대장) |
| `webp1-map-ground-path.webp` | 지면·길·설치 받침(정원 + 강가·궁궐 뜰·설원) |
| `webp1-map-edge-landmark.webp` | 가장자리 숲·바위, 연못·정자·물레방아 같은 랜드마크, 성문 |

다시 만들기(변환 커밋의 부모에서 PNG를 꺼낸다): `node tools/assets/webp-compare.mjs --out asset-source/renewal/WEBP-1 --png-rev 8600e49 --stats`

## 참고: `-sharp_yuv`

기본값(-q 85)에 `-sharp_yuv`를 더하면 윤곽선 둘레의 색 번짐이 줄어든다. 가장 낮던 6장 표본에서 PSNR이 +0.7~2.5dB 오르고 용량은 +3~8%(q92는 +0.4~0.9dB에 +20%)였다. 지금 화질에 문제가 없어 계획서 기본값을 그대로 썼다. 쓰기로 하면 `tools/assets/to-webp.mjs`의 `MODES.default`에 `-sharp_yuv`를 더하고 PNG를 되살려 다시 변환한다(전체 약 3.4MB 예상).
