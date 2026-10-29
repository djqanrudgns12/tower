# ART-003 진행 기록

## 1/4 — 석궁탑·마법탑 (2026-10-29)

- 작업 시작 20:28 KST, 제작·자체 검토 종료 약 20:37 KST. 이번 실행 4장 완료, 모두 `draft`.
- 시작 HEAD `6e9f7dbf733dbe58d80db2ce8ed40d8f67eb5db5`, 상태 `?? docs/work-packages/ART-003/` 한 줄, `npm ls --depth=0` 성공. 계약 해시 9개 모두 REQUEST 머리말과 일치.
- 쓴 범위: `asset-source/incoming/ART-003/**`만. src/public/docs/package 파일 수정, commit/push, 다른 에이전트 호출 없음.
- 참고: `docs/assets/design-41-kingdom-expedition.png`, 기존 archer/cannon/frost 몸체를 실제로 열어 확인하고 모든 생성 호출에 이미지 참조로 첨부했다. 재생성 석궁에는 첫 몸체 후보도 첨부했다.

## 장별 기록

공통 생성 방식: 내장 `image_gen.imagegen`, `transparent_background: true`. 모델 증거: 원본 PNG의 C2PA `softwareAgent`가 `ChatGPT`, `version`이 **`gpt-image`**라고 기록한다. 도구는 더 구체적인 모델 번호를 공개하지 않았으므로 `gpt-image-1.5` 또는 `gpt-image-2`라고 추정하지 않는다. `generation-metadata.json` 참조.

| id | 최종 파일 | 사용 원본(sources/) | 재생성 횟수 | 기준점 | muzzle | HOLD |
| --- | --- | --- | --- | --- | --- | --- |
| tower.crossbow | tower.crossbow.r1.png | tower.crossbow.attempt2.generated.png | 1 | (0.5, 0.8125), 바닥 (96,156) | 해당 없음 | 없음 |
| tower.crossbow.weapon | tower.crossbow.weapon.r1.png | tower.crossbow.weapon.generated.png | 0 | (0.5,0.5), 회전축 (96,96) | (160,95), 화살촉 | 없음 |
| tower.mage | tower.mage.r1.png | tower.mage.attempt2.generated.png | 1 | (0.5, 0.8125), 바닥 (96,156) | 해당 없음 | 없음 |
| tower.mage.weapon | tower.mage.weapon.r1.png | tower.mage.weapon.generated.png | 0 | (0.5,0.5), 회전축 (96,96) | (126,96), 보라 구체 오른쪽 표면 | 없음 |

원본은 모두 1254×1254 RGBA PNG다. 최종 파일 4장은 모두 192×192, PNG 색 형식 6, 실제 투명·반투명·불투명 픽셀을 갖는다. 배경 제거·색 치환·알파 임계값 적용은 하지 않았다. 원본 전체를 ImageMagick으로 축소·배치했다. 정확한 변환·알파 수·원본/납품 SHA-256은 `technical-evidence-part1.json`에 있다.

- 석궁 첫 후보 `sources/tower.crossbow.generated.png`는 보존했다. 처음에는 낮은 포대 위에 무기가 떠 보였으므로 회전 받침을 가진 두 번째 후보를 생성했다. 최종 석궁 몸체는 폭154/높이116으로 비례 조정해 고정 무기 높이에 받침을 맞췄다. 다른 3장은 종횡비를 유지했다.
- 마법탑 첫 후보 `sources/tower.mage.generated.png`는 보존했다. 높이에 비해 폭이 좁아 바닥 기준점과 폭 75~85% 조건을 함께 맞추기 어려워 낮고 넓은 원뿔 지붕으로 재생성했다.
- 최종 몸체의 알파 32 이상 경계: crossbow `[19,39,173,156)`와 mage `[20,31,171,157)`. 경계의 끝 좌표는 배타적이며, 기준점은 텍스처 (96,156)이다. 석궁 전체 높이는 궁수보다 낮고, 석재 기반은 넓은 직사각형이다.

## 축소·합성 자체 검토

`contact-sheet-part1.png`를 실제 열어 확인했다. 문자를 빼서 이름 없이 비교한다.

- 왼쪽부터 archer / cannon / frost / crossbow / mage.
- 위 3줄: 각각 텍스처 전체를 32/48/64px로 축소한 몸체.
- 아래 3줄: 각각 cell=32/48/64px로 몸체 displayCells=1.10, 무기=0.80을 적용한 합성.
- 엔진 `BattleScene.ts`에서 몸체는 y+0.32칸, 무기는 y-0.32칸이다. 따라서 바닥과 무기 회전축의 간격은 **0.64칸**이며 합성판에도 이 간격을 적용했다. 이는 실시간 엔진 실행이 아닌 PNG 정적 합성이다. frost의 시간별 부유 움직임은 재현하지 않았다.
- 32/48px에서 석궁은 직사각 기반·굵은 쇠뇌, 마법은 둥근 벽·보라 원뿔 지붕으로 기존 3종과 구별된다. 색뿐 아니라 윤곽이 다르다. 수정한 석궁의 받침과 무기가 연결되는 것도 합성판에서 확인했다.
- `parts-preview.png`: 최종 4장 원래 192px 크기를 나란히 놓은 보조 판. 원본 파일의 투명성은 별도 기술 증거로 확인했다.
- 현재 자체 HOLD 없음. `visual_pass`/`integrated_pass` 아님. 실제 게임·회전 애니메이션·사용자 승인은 미실행이며 총괄 검토가 남았다.

## 재현·검사 기록

- `prompts.json`: 첫 생성 4개와 재생성 2개의 전체 프롬프트.
- `prepare-assets.mjs`: 원본 알파를 보존하는 출력 처리와 좁은 PNG 검사. 최종 실행 성공. 기준점과 muzzle 계산을 포함한다.
- `make-preview.mjs`: 기존 3종과 이번 2종의 정적 비교판 생성. 최종 실행 성공. 최초 Arial 폰트 미설치 오류 1회 후, 글자를 제외한 비교판으로 변경해 해결했다.
- Python Pillow는 설치되어 있지 않아 사용하지 않았다. ImageMagick 7.1.2-34와 Node를 사용했고 추가 설치는 하지 않았다.
- 시작 계약·의존성 검사는 이후 입력 변경이 없어 재사용했다. 코드 시험·빌드·브라우저 검사는 미실행.
- `npm run validate:assets`는 이번 1/4에서 미실행. 요청대로 manifest와 전체 13장 검사·RETURN은 4/4에서 수행한다.

## 다음 실행

2/4: lightning/flame 4장. 3/4: spear/guardian/banner 5장. 4/4: 13장 manifest(status draft), 기존 3종을 포함한 10종 비교판, validate:assets, RETURN.md.
이번 `prepare-assets.mjs`는 1/4의 4장만 처리하므로 다음 실행에서 덮어쓰지 말고 항목을 확장하거나 별도 명확한 범위의 처리 파일을 사용한다. 이 기록과 원본·반려 후보를 유지한다.

## 2/4 — 번개탑·화염탑 (2026-10-29)

- 작업 시작 약 20:38 KST, 제작·자체 검토 종료 약 20:44 KST. 이번 실행 4장 완료, 모두 `draft`, 자체 HOLD 없음. 재생성 각 0회.
- 쓴 범위는 `asset-source/incoming/ART-003/**`뿐이다. 소스 코드·public·docs·package 파일 수정, commit/push, 다른 에이전트 호출 없음. 내장 생성 도구의 기본 보관소에 생긴 PNG는 지정 `sources/`로 복사하고 원본은 유지했다.
- `docs/assets/design-41-kingdom-expedition.png`, 기존 궁수 몸체·서리 무기, 1/4 `parts-preview.png`를 실제 열어 확인했다. 생성 4회 모두 디자인 원화·궁수 몸체·1/4 부품판을 스타일 참조로 첨부했다.
- 생성 방식은 내장 `image_gen.imagegen`, `transparent_background: true`. 원본 4장의 C2PA에서 `softwareAgent: ChatGPT`, `version: gpt-image`를 각각 확인했다. 세부 모델 번호는 도구가 공개하지 않아 추정하지 않는다. 원문 증거는 `generation-metadata.json`의 해당 4개 항목, 전체 프롬프트는 `prompts-part2.json`에 있다.

| id | 최종 파일 | 사용 원본(sources/) | 재생성 | 기준점 | muzzle | HOLD |
| --- | --- | --- | --- | --- | --- | --- |
| tower.lightning | tower.lightning.r1.png | tower.lightning.generated.png | 0 | (0.5,0.8125), 바닥 (96,156) | 해당 없음 | 없음 |
| tower.lightning.weapon | tower.lightning.weapon.r1.png | tower.lightning.weapon.generated.png | 0 | (0.5,0.5), 구슬 중심 (96,96) | (96,96), 구리 구슬 | 없음 |
| tower.flame | tower.flame.r1.png | tower.flame.generated.png | 0 | (0.5,0.8125), 바닥 (96,156) | 해당 없음 | 없음 |
| tower.flame.weapon | tower.flame.weapon.r1.png | tower.flame.weapon.generated.png | 0 | (0.5,0.5), 뒤쪽 회전 결합부 (96,96) | (170,96), 오른쪽 입 내부 | 없음 |

### 처리 및 기술 증거

- 원본은 모두 1254×1254 RGBA PNG다. 최종 4장은 192×192, PNG 색 형식 6이며 실제 투명·반투명·불투명 픽셀이 있다. 생성된 알파를 보존했고 배경 제거·색 치환·알파 임계값 처리는 하지 않았다.
- 기존 `prepare-assets.mjs`에 범위 인자 `part2`를 추가했다. 인자 생략 시 기존 `part1` 동작을 유지한다. `node asset-source/incoming/ART-003/prepare-assets.mjs part2`는 이번 4장만 처리하고 `technical-evidence-part2.json`에 원본/결과 SHA-256, 알파 수, 배치 변환, 기준점, muzzle을 기록한다.
- 원본 전체를 ImageMagick으로 축소·배치했다. 고정된 무기 높이에 받침을 맞추기 위해 번개 몸체는 폭154/높이106, 화염 몸체는 폭154/높이120으로 가로·세로 배율을 각각 적용했다. 무기는 종횡비를 유지했다. 몸체 두 장 모두 폭이 텍스처의 약 80%다.
- 알파 32 이상 경계(끝 좌표 배타적): lightning `[19,50,173,157)`, lightning.weapon `[43,61,150,148)`, flame `[19,36,173,157)`, flame.weapon `[74,70,182,126)`. 알파 32 기준은 경계 측정용이며 실제 이미지 알파에는 적용하지 않았다.
- 기존 1/4 최종 PNG 4장의 SHA-256이 `technical-evidence-part1.json`과 모두 같음을 확인했다. 결과는 `part1-preservation-part2.json`에 기록했다. 1/4 원본·반려 후보·프롬프트·비교판·기술 증거를 유지했다.

### 축소·합성 자체 검토

- `make-preview.mjs`도 범위 인자 `part2`로 확장했다. `node asset-source/incoming/ART-003/make-preview.mjs part2`로 `contact-sheet-part2.png`를 만들고 실제로 열어 확인했다.
- 왼쪽부터 archer / cannon / frost / crossbow / mage / lightning / flame. 위 3줄은 몸체 텍스처 32/48/64px, 아래 3줄은 cell=32/48/64px에서 몸체 displayCells=1.10·무기=0.80의 정적 합성이다. 1/4와 동일하게 바닥–무기 회전축 간격 0.64칸을 적용했다.
- 32/48px에서 번개는 넓은 석재 기반 위 좁은 금속 코일과 세 갈래 구리 전극, 서리는 각진 큰 얼음 결정으로 구별된다. 번개를 얼음 기둥 형태로 만들지 않았다. 아래쪽 전극 가지는 몸체 상단에 겹쳐 연결된다.
- 화염은 경사진 붉은 벽돌 화로·앞쪽 어두운 화구·나팔처럼 넓어지는 청동 분사구로 읽힌다. 기존 포탑의 둥근 받침·곧은 철 포신, 석궁의 사각 포대·큰 쇠뇌, 마법의 원뿔 지붕과 구별된다. 몸체 상단과 무기 뒤쪽 결합부가 접합되어 떠 보이지 않는다.
- `parts-preview-part2.png`는 이번 4장을 각각 192px로 나란히 놓은 보조 판이다. 번개·발광·불꽃·문자는 그리지 않았다.
- 자체 HOLD 없음. 이는 PNG 정적 비교이며 실시간 엔진·무기 회전·서리 부유 애니메이션·사용자 승인 및 총괄의 `visual_pass`/`integrated_pass`는 미실행이다.

### 검증 예산 및 다음 실행

- 실행: `prepare-assets.mjs part2` 1회 성공(4장 크기·RGBA·투명성 검사 포함), `make-preview.mjs part2` 1회 성공, 비교판·부품판 육안 확인, 기존 1/4 PNG 4장 해시 보존 확인. 실패·재시도 없음.
- 재사용: 1/4에 기록된 계약·의존성 검사 결과. 이번에는 다시 실행하지 않았다.
- 미실행: 코드 시험·빌드·브라우저·`npm run validate:assets`. 전체 manifest 작성·13장 검사·RETURN은 요청대로 4/4에서 수행한다.
- 다음 3/4: spear/guardian/banner 5장. 이번까지 8장 완료. 4/4 manifest에 이번 muzzle은 위 표와 `technical-evidence-part2.json` 값을 사용한다.

## 3/4 — 창병초소·수호기사·깃발초소 (2026-10-29)

- 작업 시작 20:45 KST, 제작·자체 검토 종료 약 20:55 KST. 이번 5장 완료, 누적 13장. 모두 draft이며 자체 HOLD 없음.
- 쓴 범위: asset-source/incoming/ART-003/**만. src/public/docs/package 수정, commit/push, 다른 에이전트 호출 없음. 내장 생성 도구의 기본 보관소 PNG는 sources/로 복사하고 보존했다.
- 참조 확인: design-41-kingdom-expedition.png, 1/4 parts-preview.png, map.entry.r1.png를 열어 확인했다. 최초 5회 모두 디자인·기존 부품판을 참조로 전달했고 banner에는 입구 깃발도 첨부했다. 수정 3회는 해당 이전 후보를 참조로 편집했다.
- 생성: 내장 image_gen.imagegen, transparent_background:true. 최종 5장 C2PA에서 softwareAgent ChatGPT / version gpt-image 확인. 세부 모델 번호는 미공개이며 추정하지 않는다. generation-metadata.json 및 prompts-part3.json에 증거·8개 전체 프롬프트를 기록했다.

| id | 최종 파일 | 사용 원본(sources/) | 재생성 | 기준점 | muzzle | HOLD |
| --- | --- | --- | --- | --- | --- | --- |
| tower.spear | tower.spear.r1.png | tower.spear.generated.png | 0 | (0.5,0.8125), 바닥 (96,156) | — | 없음 |
| tower.spear.weapon | tower.spear.weapon.r1.png | tower.spear.weapon.generated.png | 0 | (0.5,0.5), 손잡이 (96,96) | (183,96), 창끝 | 없음 |
| tower.guardian | tower.guardian.r1.png | tower.guardian.attempt3.generated.png | 2 | (0.5,0.8125), 바닥 (96,156) | — | 없음 |
| tower.guardian.weapon | tower.guardian.weapon.r1.png | tower.guardian.weapon.generated.png | 0 | (0.5,0.5), 손잡이 (96,96) | (187,96), 칼끝 | 없음 |
| tower.banner | tower.banner.r1.png | tower.banner.attempt2.generated.png | 1 | (0.5,0.8125), 바닥 (96,156) | — (무기 없음) | 없음 |

### 처리·수정 근거

- 창 무기 원본만 1774×887이며 나머지 최종 선택 원본은 1254×1254다. 최종 5장은 모두 192×192, PNG 색 형식 6, 실제 투명·반투명·불투명 픽셀을 가진다. 배경 제거·색 치환·알파 임계값 처리 없이 전체 원본을 ImageMagick으로 축소·배치했다.
- 몸체 창병·수호기사는 고정 무기 높이에 맞춰 폭154/높이120, 폭154/높이126으로 각각 배율을 적용했다. 무기와 깃발은 종횡비를 유지했다. 모든 몸체의 측정 폭은 154~155px로 75~85% 조건 안이다. 알파32 기준은 경계 측정에만 쓰며 픽셀 수정에는 쓰지 않는다.
- 수호기사 첫 후보는 허리 높이 손과 엔진 무기 높이가 맞지 않았다. 2차에서 손을 들고 3차에서 손을 몸 중심 쪽으로 옮겼다. 오른쪽 3/4 측면·온몸·방패·칼 없는 몸체를 유지했다. 두 이전 후보 모두 sources/에 보존했다.
- 깃발 첫 후보는 돌 받침 중심을 (96,156)에 놓으면 우측 천 때문에 너비75% 조건을 충족하기 어려웠다. 2차에서 받침을 넓히고 기둥 중심을 조정했다. 첫 후보도 보존했다. 기둥·돌 받침 중심을 기준으로 배치하므로 비대칭 천의 전체 경계 중심을 바닥 중심으로 오인하지 않는다.
- prepare-assets.mjs에 part3와 선택 id 인자를 추가했다. 최초 part3 5장 처리 1회, 깃발 수정 후 part3 tower.banner 1회만 실행했다. 기존 part1/part2 동작은 유지하며 다른 4장을 재처리하지 않았다.
- technical-evidence-part3.json: 원본/결과 해시, 알파 수, 배율·이동, 원점, muzzle. preservation-baseline-part3.json 및 preservation-result-part3.json: 기존 1/4·2/4 PNG 8장 모두 해시 일치.

### 비교판 자체 검토

- contact-sheet-part3.png를 실제 열어 확인했다. 왼쪽부터 archer / cannon / frost / crossbow / mage / lightning / flame / spear / guardian / banner, 이름 표기 없음.
- 위 3줄은 몸체 텍스처 32/48/64px. 아래 3줄은 cell=32/48/64px, 몸체1.10·무기0.80, 바닥–회전축 간격0.64칸을 적용한 정적 합성이다. 깃발에는 무기를 합성하지 않는다.
- 32/48px에서 10종 구별 확인: 창병은 뾰족한 원형 말뚝 울타리와 수평 창, 수호기사는 둥근 방패·오른쪽 투구·갑옷 몸, 깃발은 큰 파란 천과 넓은 돌 받침이다. 기존 석궁의 사각 포대·쇠뇌, 궁수의 녹색 지붕, 포탑·서리·마법·번개·화염과 윤곽이 다르다.
- assembly-detail-part3.png: 세 신규 몸체와 무기 정적 접합을 확대 확인하는 보조판. 창은 중앙 받침 위에 놓이고 칼은 들어 올린 손 부근에 연결된다. 무기 손잡이는 (96,96)에 있으며 얼굴 정면 그림이나 얼굴 클로즈업이 아니다.
- banner-entry-comparison.png: 같은192px 캔버스의 입구 표식과 깃발초소. 큰 천 면적·두꺼운 기둥·넓은 계단 돌 받침으로 구별된다. banner-blue-comparison.json에 파랑 영역의 동일 해상도 측정도 기록했다. parts-preview-part3.png는 최종 5장 부품판이다.
- 자체 HOLD 없음. 이 결과는 정적 이미지 자체 확인이며 visual_pass/integrated_pass가 아니다. 실제 엔진·무기 전방향 회전·사용자 승인은 미실행. 수호기사의 이동 없는 몸체와 회전 칼의 손 접합은 실제 리깅 시 추가 확인 대상이다.

### 검증 예산 및 다음 실행

- 실행: 변경5장 PNG 규격 검사 1회 통과, 깃발 교체분만 추가1회 통과, 변경 비교판 재생성·육안 확인, 기존8장 해시 보존1회 통과. 동일 실패 반복 없음. 프롬프트 기록 패치의 중복 경로 오류1회는 단일 update 패치로 해결했다.
- 재사용: 1/4 계약·의존성 결과 및 1/4·2/4 정적 검토 기록. 미실행: 코드 시험·빌드·브라우저·npm run validate:assets.
- 4/4 남은 일: 누적13장 manifest.json(status draft), 최종 contact-sheet.png, npm run validate:assets, RETURN.md. muzzle은 본 표와 technical-evidence-part3.json 값을 사용한다.
