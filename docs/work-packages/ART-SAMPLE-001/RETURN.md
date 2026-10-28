# ART-SAMPLE-001 RETURN

- 작업자: Codex. 원화 생성 도구: image_gen.imagegen. PNG 23개 모두의 실제 C2PA softwareAgent는 ChatGPT / gpt-image이다. 세부 백엔드 모델 버전은 미노출이며 추정하지 않았다.
- 완료일: 2026-10-28 (Asia/Seoul). 총괄: Claude Opus 5.5.
- 상태: RETURNED. 납품 PNG 16장, 에셋 HOLD 0장. manifest는 전부 draft이며 최종 인수는 총괄 판단이다.
- baseCommit: ee5833846f0aa227ea3a6e2fe89257b02bae0e33.
- 작업 경로: C:/Users/User/Desktop/vibecoding/tower-wp/ART-SAMPLE-001.

## 시작 확인

git rev-parse HEAD는 지정 커밋과 일치했다. 시작 git status --short는 아래 한 줄이었다.

~~~text
 M docs/work-packages/ART-SAMPLE-001/REQUEST.md
~~~

npm ci: exit 0. 실제 출력:

~~~text
added 187 packages, and audited 188 packages in 13s

48 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
~~~

node tools/contract-hash.mjs ART-SAMPLE-001의 5개 해시가 REQUEST 머리말과 일치했다. 도구 내부 gitHead 필드는 unknown으로 출력됐으나 별도 git rev-parse HEAD로 커밋을 확인했다.

| 입력 | 실제 SHA-256 |
|---|---|
| docs/assets/design-41-kingdom-expedition.png | 5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13 |
| vocabulary_td_prd_v0_5.md | 5d6f25e96aee6e07c31ea33d968cfbc210a9336ab4fb5235284db6cb0f20056a |
| src/contracts/assetManifest.ts | 7d2cf0b7aa6d50b7d63fd64765bbce56165469f6878bd45f180674b2c3f3b8e7 |
| src/game/assets.ts | ff2ec2c8510210ee890b41e0f955c8504635ce47cefc3a802ed067a108ae2421 |
| docs/archive/design-v0.7/prompts.json | 3b2c9fbeacce6537f5a2a9eac6921a9ce12f8ceb63a751ce109840882d90f00b |

첫 생성 후보로 실제 알파 능력을 확인했다: PNG color type 6, bit depth 8. 시작 검사 시 앞 95행에서 alpha=0 113259개, 부분 alpha 5825개, alpha=255 46개를 확인했다. 최종 16장도 전체 픽셀을 검사했으며 각각 투명·비투명 영역이 존재한다. 전체 집계는 technical-evidence.json에 있다.

## 장별 생성·납품

아래 경로는 asset-source/incoming/ART-SAMPLE-001 기준이다. 납품 파일명은 각 ID + .r1.png이다. sourceHash는 sources/<ID>.generated.png의 실제 SHA-256이다. 재생성 횟수는 첫 생성 이후 추가 호출 수다. 총 23회 생성, 선택 16개, 반려 후보 보존 7개.

| ID | 생성 방식 | 실제 기록 모델 | 재생성 횟수 | HOLD 사유 | 납품 artifact SHA-256 |
|---|---|---|---:|---|---|
| tower.archer | 41번 참조 단독 생성 | gpt-image | 1 | 없음 | cfd1931fa50088fdeb88dc62d832663315423e8ebc73063a010c48c2f0fbb335 |
| tower.cannon | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | 6e76d4febf6c9472369e7d7f0418c0f7c0a8abc4f73e3ddb4a889270baedc776 |
| tower.frost | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | 692b0858b3947d107245445e611c84cb85489cf6c0a9c597ea72e0dd24b4cf1d |
| tower.archer.weapon | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | c60f46f52da895da6206e57d05ac8eb3a26f6f152f4e47dd27c48bbecd4d1217 |
| tower.cannon.weapon | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | 9586c334c92d292a821e4014ac587168b628383147cd4fe426917fec9ebe9885 |
| tower.frost.weapon | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | fc7e34a5e9989607445aec5f4477bbf8058029e288a9aefd97766eaefaeab1d7 |
| enemy.walker.0 | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | 00cc3c9d7d9cc4b9e6fc8466f07be0657370a68da33978320c0ecad4276809dc |
| enemy.walker.1 | 기준 enemy.walker.0에서 파생·국소 수정 | gpt-image | 1 | 없음 | 15d863fd113040e2fa76baefb3e92917a1fd5a65470dd216e6f428e8b2621271 |
| enemy.walker.2 | 기준 enemy.walker.0에서 파생·국소 수정 | gpt-image | 2 | 없음 | 54e1d75fd6d9a93066f1bd593c3830de38be53fea21a1446bc88f2796c264865 |
| enemy.walker.3 | 기준 enemy.walker.0에서 파생·국소 수정 | gpt-image | 1 | 없음 | 73ecdfd3f8d4f639ac2980bb9b651b49451de9ffe77fd097eb0f62f890ddd3f2 |
| enemy.walker.hit | 기준 enemy.walker.0에서 파생·국소 수정 | gpt-image | 0 | 없음 | 6472f42fd855533035f35502a42fa8c97b40110c42e6e8b5a8f80188253143cf |
| enemy.boss.0 | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | 3b6b7a3661b8a306f9f7e3f06fb0a9a84788789534dd3af4a669ab12a30b2f7b |
| enemy.boss.1 | 기준 enemy.boss.0에서 파생·국소 수정; 한 발 들기 포즈 | gpt-image | 2 | 없음 | 9c353211b40ce18750be5895ef3e1f434dc970b5244fc74ea5502c3db987921e |
| map.gate | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | a2fb1391e8bc2f05a968bbbc85228a66785cd538fb1463ff19ab209e4db3d731 |
| deco.tree | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | 4a059b75cf8e14552707834a17069495162ba11a02f922c31be727ec75783419 |
| deco.stele | 41번 참조 단독 생성 | gpt-image | 0 | 없음 | df0b6da122a9041775e9a8139ed0b4c7efdca4e37e8ceaddb120eca434d2d72b |

모든 호출에 요청서 공통 머리말과 41번 참조 이미지를 사용했다. 파생 프레임에는 같은 캐릭터 기준 원본을 추가로 첨부했다. 모든 실제 프롬프트·후보별 sourceHash·선택 여부는 generation-log.json에 기록했다.

## 변경 파일과 목적

- manifest.json: 계약 스키마와 16개 ID, 규격·sourceHash·artifactHash.
- contact-sheet.png: 이름 없는 32/48/64px 참고판.
- sources/*.png: 선택 원본 16개와 반려 후보 7개. 원본 바이트 보존.
- generation-log.json: 23회 생성 프롬프트·모델 메타데이터·후보별 실제 해시.
- requested-specs.json / layout.json: 요청 규격 및 실제 배치·크기 변환.
- source-info.json / technical-evidence.json: 원본/납품 크기·RGBA·알파 집계·외곽·해시.
- holds.json: 빈 배열, 에셋 HOLD 0개.
- build-layout.mjs / prepare-assets.ps1 / build-manifest.mjs / make-contact-sheet.ps1: 추가 설치 없이 규격화·참고판을 재현하는 도구.
- validate-assets-output.txt: validate:assets 실제 출력.
- SHA256SUMS.txt: 위 산출물과 원본 전체의 실제 SHA-256 목록.
- docs/work-packages/ART-SAMPLE-001/RETURN.md: 이 반환서.

manifest.json SHA-256: 64035488653f4435fc230fb46b5f68fbe69d0bad54c65c3a5b0b446110770db0

contact-sheet.png SHA-256: a2832f8430b8c2be652facbbd89f72c077c284e186e8ee8068b562cc68c3d05d

## 인수 조건별 결과

- 정확한 16개 ID, 캔버스 크기, originX/Y, displayCells, layer와 frames=1을 manifest에 반영했다. 모든 status는 draft다.
- PNG는 전부 색 형식 6이다. transparent_background=true로 생성된 알파를 보존했다. 배경 삭제·색상 키잉·마스크 배경 제거를 하지 않았다.
- Windows System.Drawing HighQualityBicubic으로 축소·배치했다. 알파 32 이상의 외곽은 배치 계산에만 쓰고, 알파를 임계값으로 지우지 않고 원본 전체를 그렸다.
- 궁수 몸체는 두 번째 원본을 폭 154px/높이 144px로 맞췄으며 가로·세로 배율이 다르다. 고블린 4개 보행 프레임은 공통 X/Y 배율을 사용했다. 정확한 변환은 layout.json에 공개했다.
- 타워 지면 y=156, 고블린 y=96, 대장 y=144, 성문 y=192에 배치했다. 나무·비석은 기하학적 기준 y=163.2, originY=0.85다. 부분 픽셀의 알파 때문에 정수 외곽 경계는 반올림값과 다를 수 있다.
- 활 손잡이/화살 축과 포신의 중심을 (96,96)에 배치했다. muzzle은 활 (144,96), 포신 (169,96)으로 실제 화살촉/포구 중심이다. 얼음 결정 중심도 (96,96)이며 임의 muzzle은 넣지 않았다.
- 궁수 몸체에는 무기/캐릭터가 없고 대포 몸체에는 포신이 없다. 비석에는 문자·숫자·표식을 넣지 않았다.
- 고블린은 접지→교차→반대 접지→반대 교차, 피격은 얼굴/상체 국소 반응이다. 대장은 같은 기준 그림에서 접지/한 발 들기 2포즈를 만들었다.

## 참고판 직접 확인

경로: asset-source/incoming/ART-SAMPLE-001/contact-sheet.png (1080×530). 32/48/64px는 PNG 텍스처 전체 표시 너비다.

각 패널의 4×4 배열:

1. 궁수 몸체 / 대포 몸체 / 서리 몸체 / 성문
2. 활 / 포신 / 얼음 결정 / 비석
3. 고블린 .0 / .1 / .2 / .3
4. 고블린 hit / 대장 .0 / .1 / 나무

판 안에는 에셋 이름을 쓰지 않았다. 아래 별도 행은 타워 조합 참고이며 무기/몸체의 displayCells 비율 0.8/1.1을 적용했다. 게임 내부 소켓 검수 결과는 아니다.

직접 관찰: 초록 지붕, 목재 포가·원형 석재, 밝은 석재·얼음 결정이 세 축소 크기에서 구별됐다. 고블린 4포즈의 얼굴·머리카락·귀·창·의상·외곽선 굵기가 같은 캐릭터로 읽혔고, 수정 후 보행 단계 차이가 보였다. 32px에서는 발의 세부 동작이 작아 게임 내 재생 검수가 필요하다. 생성/참고판 확인을 visual_pass 또는 integrated_pass로 승격하지 않았다.

## 반려 후보

| 보존 후보 | 반려 이유 / 접근 변경 | 원본 SHA-256 |
|---|---|---|
| sources/rejected-tower.archer.attempt1.png | 세로로 길어 폭·접지 규격에 부적합 | 6962391ca945a1dddde393c13024daf42918e1f2e151f55e6345811f6b89c100 |
| sources/rejected-enemy.walker.1.attempt1.png | 교차 단계가 넓은 보폭처럼 보임 | 8945171ff9c6479d862be01ab27873445760630f6f281f53fe6194ef8442fdbd |
| sources/rejected-enemy.walker.2.attempt1.png | 반대 접지 차이가 불명확 | 710f2564a9bca3834fbe7d1761c61ab5d0d56d2211241d4c37529297c82faf0a |
| sources/rejected-enemy.walker.3.attempt1.png | 교차 단계가 넓은 보폭처럼 보임 | 96b6456e63315d8234d312a9d1a18597a11424382f618536e32605eef3e384ed |
| sources/rejected-enemy.boss.1.attempt1.png | 몸 크기·자세 변화와 위상 불명확 | 243e9cc3b2a86e25f9ca647a4eef6b9c1e3ebd687145c30f2142a8a281a18e39 |
| sources/rejected-enemy.walker.2.attempt2.png | 뒤로 뻗은 발의 발가락 방향 오류 | 678fecbed01082fffcf6a04e3829dc7bf711fed21e2fa4db7b9435f23ac24a2a |
| sources/rejected-enemy.boss.1.attempt2.png | 접지 차이가 작아 한 발 들기 방식으로 변경 | 2600725fd30d74fc30a8f9451c27e906d01590d0e83f56bcf96922825a9aa3fe |

대장 보행은 두 번째에도 위상 차이가 작아 한 발 들기 방식으로 변경했다. 고블린 .2의 마지막 수정은 잘못된 발 방향만 국소 편집했다. 어떤 ID도 3회 초과 생성하지 않았다.

## 실행 검사

환경: Windows PowerShell, Node v24.14.1, npm 11.11.0, System.Drawing. 추가 패키지 설치·업그레이드 없이 요청된 npm ci만 실행했다.

node asset-source/incoming/ART-SAMPLE-001/build-manifest.mjs: exit 0. 16개 PNG의 color type 6·크기·source/artifact 실제 SHA-256 확인.

npm run validate:assets: exit 0. 최종 manifest와 최종 16개 .r1.png 상태에서 실행했다. 실제 출력:

~~~text

> vocabulary-tower-defense@0.1.0 validate:assets
> vitest run tests/unit/content.test.ts -t manifest


 RUN  v5.0.5 C:/Users/User/Desktop/vibecoding/tower-wp/ART-SAMPLE-001


 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)
   Start at  11:29:44
   Duration  363ms (import 54%, transform 39%, tests 6%, worker 2%)
~~~

원래 validate:assets 테스트는 manifest 안의 모든 엔트리를 순회한다. 4 skipped는 이름 필터로 제외된 다른 콘텐츠 검사다. sourceHash는 보조 스크립트로 별도 검증했다.

## 미실행·알려진 제한·범위

- 게임 통합·런타임 소켓/회전/보행 재생 검수는 하지 않았다. public/assets로 복사하지 않았고 승인 상태로 올리지 않았다.
- 세부 생성 모델 버전은 미노출이다. 실제 원본 메타데이터의 gpt-image까지만 증명할 수 있다.
- 폴더 범위 예외: 시스템 제공 imagegen SKILL.md를 읽었고, 내장 생성 도구가 C:/Users/User/.codex/generated_images/01a18035-d9f9-7e71-9371-293a178fbe09에 자동 캐시를 작성했다. 이 도구에는 저장 경로를 강제하는 인수가 없다. 캐시를 수동으로 읽거나 복사하지 않고 도구가 반환한 PNG 바이트를 납품 폴더로 저장했다. 폴더 밖 자동 캐시 생성은 엄격한 폴더 제한의 예외로 남는다.
- 저장소 안 직접 작성 파일은 허용된 incoming 경로와 이 RETURN.md뿐이다. REQUEST.md는 시작 시 변경을 보존했다. 옆 저장소/다른 작업 폴더는 열지 않았다. src/public/package.json/package-lock.json 수정, commit/push는 하지 않았다.
- 최초 전체 이미지 데이터 검사 호출은 64000바이트 도구 제한으로 거절돼, 시작 검사는 헤더와 앞부분만 읽는 작은 검사로 변경했다. 최종 납품은 전체 픽셀 검사했다.
- 규격화 스크립트의 첫 실행은 .NET DrawImage 오버로드 선택 오류로 실패했고 RectangleF 소스 영역을 명시해 수정했다. 최종 실행과 자산 검사는 정상 종료했다.

## REQUESTED_CONTRACT_CHANGE

제품 스키마 변경 요청 없음. 향후 같은 도구를 사용할 때 도구 관리 자동 캐시의 폴더 제한 예외를 계약에 명시할 필요가 있다. 상세 모델 버전이 필수 인수 조건이면 도구 제공자 메타데이터가 추가로 필요하다.

## 통합 방법과 다음 첫 행동

총괄이 manifest와 PNG를 함께 검수한 뒤 승인한 항목만 배포 경로로 옮긴다. 기존 ID/스키마를 유지해 공용 코드 충돌을 만들지 않았다. 롤백은 이 incoming 묶음을 사용하지 않는 것으로 가능하다.

다음 첫 행동: 총괄이 contact-sheet.png와 draft manifest를 열고 실제 게임 셀 배율에서 타워 소켓 및 보행 접지를 검수한다.

## 최종 Git 범위 검사

아래 최종 검사 결과 참조.

최종 검사 exit 0. 전체 상태 항목 55개, 허용 경로 밖 항목 0개. tracked diff는 시작부터 있던 REQUEST.md뿐이다.

~~~text
 M docs/work-packages/ART-SAMPLE-001/REQUEST.md
?? asset-source/
?? docs/work-packages/ART-SAMPLE-001/RETURN.md
~~~

축약 출력의 asset-source/는 --untracked-files=all로 펼쳐 전부 asset-source/incoming/ART-SAMPLE-001/ 아래임을 확인했다.
