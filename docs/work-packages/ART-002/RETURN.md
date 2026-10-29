# ART-002 RETURN

- jobId: ART-002
- 실제 작업자: Codex. 대화 실행 모델의 세부 식별자는 미노출. 이미지 모델은 원본 C2PA `softwareAgent.version=gpt-image`, 실제 도구 `image_gen.imagegen`(`image_gen__imagegen`). 세부 이미지 모델 버전은 미공개이며 추정하지 않는다.
- 완료일: 2026-10-29 KST. 최종 실행은 19:07~19:13.
- 상태: **RETURNED**. PNG **11장**, HOLD **0장**, manifest의 모든 항목은 **draft**. 생성 성공·자체 시각 확인·검사 통과를 visual_pass/ACCEPTED로 올리지 않았다.
- 범위 변경 근거: 총괄 브리지 `20261029T100702-754715`는 별도 `preview-garden_u*.png`를 만들지 않고 기존 `commander-preview-1.png`·`commander-preview-2.png`로 대체하도록 명시했다. 나머지 요청 규격은 유지한다.

## 입력과 시작 확인

baseCommit: `ea7ffe4750c1f96256447e1e065bb7c2be3c8f23`.

3/3 실제 실행:

```text
git rev-parse HEAD
ea7ffe4750c1f96256447e1e065bb7c2be3c8f23

git status --short (3/3 시작)
?? asset-source/incoming/ART-002/
?? docs/work-packages/ART-002/

git diff --stat
(출력 없음)
```

1/3 시작 확인 **재사용**: `npm ls --depth=0` exit 0, `node tools/contract-hash.mjs ART-002`의 입력 계약 해시 9개가 REQUEST와 일치. 당시 `gitHead: unknown`은 별도 git HEAD 확인으로 보완했다. 명령의 실제 출력과 9개 해시는 `asset-source/incoming/ART-002/PROGRESS.md` 첫 절에 보존되어 있다. 3/3에서 이 검사들을 반복하지 않았다.

41번 styleReferenceSha256은 `5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13`이며 3/3 manifest 작성 시 해당 파일에서 다시 계산했다. 모든 생성 원본·납품 파일의 해시 역시 실제 파일에서 계산했다. 기존 납품 PNG 7장·src·public·package 파일 총 83개는 `protected-before-small.json`과 비교해 동일했다.

## 변경 파일과 생성 이력

모든 아래 상대경로는 `asset-source/incoming/ART-002/` 기준이다. 프로젝트 내 쓰기는 이 폴더 및 본 RETURN.md에 한정했다.

- 납품: 아래 표의 `ID.r1.png` 11장, `manifest.json`.
- 생성 원본: `sources/ID.generated.png` 11장. 기본 저장소 원본을 복사해 보존했다.
- 지시문: `prompts.json`, `prompts-props.json`, `prompts-small.json`.
- 재현: `prepare-ground.py`, `prepare-props.py`, `prepare-small.py`. Python 표준 라이브러리·macOS sips로 크기·위치·허용된 바닥 색/이음매만 정리했다. 외부 패키지 설치 없음.
- 측정: `measurements.json`, `measurements-props.json`, `measurements-small.json`, `validate-assets.log`, `protected-before-small.json`.
- 확인 이미지: `tile-check.png`, `patch-check.png`, `props-check.png`, `slot-contact-check.png`, `small-check.png`. 총괄 제공 `commander-preview-1.png`, `commander-preview-2.png` 보존.
- 반려 생성 후보 없음. 각 자산 생성 1회·재생성 0회. bush.1의 최초 편집 호출은 의도된 파생 제작이며 bush.0 재생성에 포함하지 않는다.

| ID | 생성·후처리 방식 | 실제 이미지 모델·도구 | 생성 / 재생성 | HOLD |
|---|---|---|---|---|
| ground.grass | 독립 생성 → 256px·평균색·양축 이음매 보정 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| ground.patch.0 | 실제 투명 생성 → 190px·평균색·1px 여백 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| ground.patch.1 | 실제 투명 생성 → 190px·평균색·1px 여백 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| ground.dirt | 독립 생성 → 256px·평균색·양축 이음매 보정 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| slot.base | 실제 투명 생성 → 192×240 → (0,-11) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| deco.rock | 실제 투명 생성 → 190px → (1,7) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| deco.bush.0 | 실제 투명 생성 → 126px → (1,0) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| deco.bush.1 | bush.0 원본 편집·꽃 4송이 추가 → 126px → (1,0) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| deco.pebble | 실제 투명 생성 → 126px → (1,9) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| deco.flowers | 실제 투명 생성 → 126px → (2,-3) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |
| map.entry | 실제 투명 생성 → 192px → (9,3) 배치 | gpt-image / image_gen.imagegen | 1 / 0 | 없음 |

1/3은 41번 원화와 deco.tree를 참조 이미지로 첨부했다. 2/3은 기준 이미지들을 직접 보고 지시문으로 화풍을 기술했다. 3/3은 props-check의 바위·나무·풀밭을 직접 보고 기본 덤불·조약돌·들꽃을 독립 생성했고, bush.1에만 bush.0 생성 원본을 편집 대상으로 첨부했다. 소품의 배경 제거·알파 임계값 삭제·색 덧칠은 하지 않았다. 새 장식은 원본 1254×1254에서 126px로 축소하고 128px 투명 캔버스에 배치했다.

| ID | sourceHash (생성 원본) | artifactHash (납품 PNG) |
|---|---|---|
| ground.grass | `91793a0a169e384be07fd00cc2785d11a28362df0a58da0d099eb67127b185be` | `f5e5030eb5746fe775badd6f1410bc8b7c2c829b4a874e61003ab83765568c29` |
| ground.patch.0 | `0944db2c82d1f6625a674f32fbced2d4c1fd3c18edc29988900d03c4febf3639` | `894ccbcdb4ce0adb5be688b2bbc1ac5719206e1d2fcb5a7c92a27055711243a6` |
| ground.patch.1 | `ad07b3bc929ae219c9278da41823634b67989c55b794fb065074c131b9c7bf89` | `71d4a5e1a9807185244807525f6003b10492d0f2d943be0e92e4c9c57ba31233` |
| ground.dirt | `b91ec2977baebdc8c918646eb10a6c7a6490ad1f6facc4972a5b51388402a75a` | `0b47a661e1f3120364cfe525f85210361dc7aa2cf8278d427d0a653ac12ec573` |
| slot.base | `1c7da9851e5c35d2c9c4d25ff298f50b372f13c00b284d41db6d5e9371f0bd84` | `75a735e1c555b5191f438081ef1bf6ebfb2082b86d6465b25d9936fc089c2524` |
| deco.rock | `9ca98e1df55e6e77432a862bc20865a0f93c8f6c2a8afd8ff21b74c9b928fe77` | `04595042a75ad13025ed377f051f09a77fbd4b3431fd0553824b82fd5ffac7a4` |
| deco.bush.0 | `3371c1a2dab16be909473a669d2b3a36e430113fa1737af9466338596e24b85a` | `9a0406fe6fa8002b2b31e6da0fbf6739df9aaa571f33e4928df7bb63adca00c7` |
| deco.bush.1 | `ea746d7ebf386d37dd5896317846d218dcc9e7d062284645815aaea1fa789efd` | `77fa2831546700a31b86b6c88983f4fab1761d4a2415a0405c33a95d9981fd88` |
| deco.pebble | `9475236819fd748f3872679eef2d8482ddb7585b65627d93b033121de5015dbb` | `235c946218c1e56b7bcb560395a9b826ed7cf05a145717cb86cc8127760e1808` |
| deco.flowers | `aa1ce6900abcc1fcbf983636d5ad62c993fef7451372875a92e7d2415b5eca34` | `ca04753c1a551494d467beae0f064d3fe454000e3a3c639e7b431fc33ff29b36` |
| map.entry | `92cd0240499f621d7995d62a1fc92a787228b006226508976a900648dcd63978` | `8feaa43f0b1e0a2342994a7cafa518efb4661cd97395cafa9c4fc25650ba27e7` |

## 인수 조건별 결과

- 정확한 ID 11개, 요청 크기·originX·originY·displayCells·layer, revision=1, frames=1, status=draft, license 규격을 manifest에 기록했다.
- PNG 전부 RGBA 색 형식 6. 두 반복 질감은 alpha=255. 소품·얼룩은 실제 투명 배경이며 이전 측정과 새 4장 측정의 alpha 범위는 0~255, 프레임 테두리 alpha max=0이다.
- 새 덤불 두 장의 alpha≥128 윤곽은 모두 x15~113/y24~102로 동일하다. 노랑 2송이·분홍 2송이를 추가한 형태다. 픽셀 단위로 전체 이미지가 동일하다는 뜻은 아니다.
- bush·pebble 접지선 y102는 originY=0.8의 y102.4에 가장 가까운 정수 픽셀, flowers y90은 originY=0.7의 y89.6에 가장 가까운 정수 픽셀이다. manifest의 정규화 기준점은 요청값 그대로다.
- slot.base의 타워 접촉점 (96,157)은 밝은 윗면 안쪽이되 앞 경계 가까이 있다. RGBA=(200,192,179,253). 확대 증거와 행별 픽셀은 props 측정에 있다.
- `small-check.png`를 직접 확인했다. 위 행은 128px 프레임, 중간은 덤불 42px·돌/들꽃 35px, 아래는 같은 축소 크기를 짙은 풀 얼룩 위에 합성했다. 덤불의 어두운 하부/외곽, 꽃의 노랑·분홍, 낮은 회색 돌, 노랑·크림 들꽃 덩어리가 구별된다. outline 두께의 정량 검사는 미실행이다.

## 이음매 측정 — 기존 결과 재사용

단위는 0~255 RGB 절대차 평균(MAD). 내부는 모든 인접 열/행 쌍 평균이며 허용 상한은 내부 MAD ×1.5다. 납품 바닥 파일이 변경되지 않았으므로 1/3 측정을 재사용한다.

| 질감 | 좌우 경계 | 내부 열 | 상한 | 상하 경계 | 내부 행 | 상한 | 결과 |
|---|---:|---:|---:|---:|---:|---:|---|
| ground.grass | 0.000000 | 1.122375 | 1.683563 | 0.000000 | 1.119608 | 1.679412 | 통과 |
| ground.dirt | 0.000000 | 0.910866 | 1.366299 | 0.000000 | 1.236877 | 1.855316 | 통과 |

평균색 명도 차이: grass -0.04782%, dirt -0.00238%로 목표 ±8% 이내. `tile-check.png`의 grass/dirt 3×3 타일을 이번에도 직접 보았으며 경계선은 보이지 않는다. 작은 풀 포기의 규칙적 반복은 남으므로 얼룩 분산이 필요하다.

## 실행 검사

환경: macOS, 현재 ART-002 작업 폴더, 기존 설치 의존성. 검증 예산 스킬 적용. 새 자산·manifest에 직접 관련된 검사만 실행했다.

1. `python3 asset-source/incoming/ART-002/prepare-small.py`: exit 0, 첫 실행 통과. 생성 알파·프레임 경계·크기·기준점 정렬을 저장 후 재읽기로 확인, 원본·납품 해시 기록, 작은 장식 비교판 생성. 통과 후 재실행 없음.
2. manifest 작성 단계: 11장 원본·납품 SHA-256 실측, 보호 대상 83개 파일 해시 동일.
3. `npm run validate:assets`: **exit 0**, 이번 ART-002를 포함한 manifest 3개 검사 통과. 실제 전체 출력은 `validate-assets.log`이며 아래에 그대로 옮겼다. 기존 시험은 sourceHash의 원본 대조까지 하지는 않으므로 원본 해시는 위 작성 단계의 직접 계산으로 보완했다.

```text

> vocabulary-tower-defense@0.1.0 validate:assets
> vitest run tests/unit/content.test.ts -t manifest


 RUN  v5.0.5 /Users/bodyking/Desktop/vibecoding/tower-wp/ART-002


 Test Files  1 passed (1)
      Tests  3 passed | 7 skipped (10)
   Start at  19:11:28
   Duration  826ms (import 62%, transform 31%, tests 6%, worker 1%)
```

재사용: 1/3 바닥 이음매·명도·알파 결과, 2/3 소품 정렬·받침 접촉점 결과. 당시 후처리 실패와 수정 이력도 PROGRESS.md에 보존했다(얼룩 투명 여백 추가, 받침 1px 상향). 이전 validate:assets의 2개 manifest 통과를 이번 11장 검증 대신 사용하지 않았다.

미실행: 전체 시험·타입 검사·빌드·e2e·새 장식 4장을 넣은 실제 게임 브라우저 확인. src 변경이 없고 담당 범위가 자산 납품이므로 전체 검사는 실행하지 않았다. 새 장식 게임 반영 확인은 총괄이 이어서 수행한다.

## 미리보기와 알려진 제한

- `preview-garden_u.png` 및 `preview-garden_u@2x.png`는 총괄의 이번 지시에 따라 만들지 않았다. 대체 자료는 `commander-preview-1.png`·`commander-preview-2.png`이며, 2번 이미지는 이번에 직접 확인했다. 길과 풀밭이 구별되고, 빨간 고블린·타워·밝은 빈 받침이 먼저 읽힌다. 이미지를 본 것이 실제 게임을 직접 실행했다는 뜻은 아니다.
- 총괄은 2/3의 받침·바위·깃발을 실제 게임에 올려 유지한다고 전달했다. 이 전달 내용과 자체 확인을 구별하며 모든 manifest 상태는 draft다.
- 실제 게임 대체 스크린샷에는 이번 작은 장식 4장이 아직 없다. 작은 장식 전체의 게임 내 visual/integrated 승인은 남아 있다.
- bush.0 원본 유래 alpha=1 수준의 미세 잡음은 x1의 일부 픽셀에 남아 있다. 지우지 않았으며 프레임 테두리는 투명하다. 확인판에서 육안으로 드러나지는 않았다.
- outline 두께는 생성 지시로 약 3~4px를 요청했지만 이를 픽셀 단위 합격으로 주장하지 않는다. 최종 화풍·화면 크기 판단은 총괄 검수 대상이다.
- HOLD 0, REQUESTED_CONTRACT_CHANGE 없음. 미리보기 대체는 이번 요청에서 승인된 납품 조정이다.

## 통합 방법과 다음 행동

- 총괄이 납품 manifest와 PNG를 검수한 뒤 기존 자산 승격 절차로 반영한다. 이번 작업자는 src/public 수정·commit/push·배포를 하지 않았다.
- displayCells는 프레임 전체 너비다. 투명 여백을 잘라 기준점을 다시 계산하지 않는다. 작은 장식은 길·받침·고정 장식 제외 칸마다 최대 하나, 요청된 0.5~0.6칸으로 둔다.
- 얼룩 밀도는 허용 빈칸의 20~30%에서 밝음/짙음을 섞어 시작하는 것을 제안한다. 과도한 중첩은 피하고 게임 화면에서 조정한다.
- 흙길은 요청대로 폭 0.80칸, 모서리 둥근 띠로 잘라 쓰고 가장자리 #b38a55 띠 약 0.05칸을 렌더러에서 적용한다. 이미지에는 길 형태가 없다.
- map.entry의 manifest는 요청서 기준 0.8칸이다. 총괄이 시험한 0.6칸과 구별하며 필요하면 렌더러에서 명시적으로 결정한다.
- 충돌: 기존 src/public 수정 없음. 롤백은 총괄이 해당 ID의 승격을 보류하거나 기존 임시 그림 경로를 유지하면 된다. incoming 원본·측정·이전 결과를 삭제할 필요가 없다.
- **다음 첫 행동:** 총괄이 작은 장식 4장을 garden_u의 허용 빈칸에 반영해 실제 0.5~0.6칸 표시와 겹침을 확인한다.
