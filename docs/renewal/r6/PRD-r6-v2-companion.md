# PRD: R6 V2 동반 고도화 규격 (`PRD-r6-v2-companion`)

- **문서 ID**: `PRD-R6-V2-COMPANION`
- **작성일**: 2026-11-28
- **기준 커밋**: `cb54ccb9` (`p1/intake-round1`)
- **동시 세션 관계**: 세션 `152ecb73-6ae8-48a8-a0dd-c6cac190fb7c`([MASTER_PLAN.md](v2/MASTER_PLAN.md), [DETAILED_EXECUTION_PLAN.md](v2/DETAILED_EXECUTION_PLAN.md), `WP-A1-01`~`WP-A4-02`)와 파일 충돌 없이 구현한 동반 고도화 PRD
- **통합 상태**: `WP-C2-01`~`WP-C2-08` 구현·감사 보강 및 통합 완료

---

## §0. 개요 · 비전 · 실측된 5대 제품 공백

세션 `152ecb73`이 R6 V2의 **전장·맵·타워 초상화·전투 UI(`src/ui/game/**`)·4학년 8바이옴·50웨이브 아우라·시즌 3·배포**를 전담하는 동안, 본 PRD(`Session C2`)는 기존 코드 전수 점검에서 확인된 **나머지 5대 제품 공백**을 완결한다.

1. **음향 공백 (`0KB` WebAudio BGM·피크 보호)**:
   - [sound.ts](../../../src/ui/audio/sound.ts)의 BGM을 국면(`PREP_QUIZ` / `BUILD` / `BATTLE` / `BOSS` / `BURNING` / `RESULT`)·바이옴(3~6학년 4대 월드) 반응형 3-레이어 0KB 합성 사운드스케이프로 고도화한다.
   - 마스터 버스에 `DynamicsCompressorNode` 리미터를 연결해 다중 타워 연사 + 보스 효과음 중첩 시 크롬북/교실 스피커 피크 클리핑을 방지한다.
2. **비전투 학습 루프·도감·설정 정합 공백**:
   - **오답 노트**([NoteScreen.tsx](../../../src/ui/screens/NoteScreen.tsx), [noteModel.ts](../../../src/ui/screens/noteModel.ts)): 낱말 검색, 최근 순/복습 우선 정렬, 다음 판 우선 출제 예정(`최대 12개`, [reviewNote.ts](../../../src/persistence/reviewNote.ts)) 배지 표시, 무보상 자가 복습 플래시카드([NoteFlashcard.tsx](../../../src/ui/screens/NoteFlashcard.tsx))를 제공한다.
   - **결과 화면**([ResultScreen.tsx](../../../src/ui/screens/ResultScreen.tsx), [resultModel.ts](../../../src/ui/screens/resultModel.ts)): 5웨이브 10단계 한국어 도달 구간·보스 격파·최고 연속·주력 타워 요약(퍼센트·숙련도 지표 없음), 틀린 낱말 `정답 가리기`/`모두 펼치기`, `shareRecords === false` 비침해 안내를 추가한다.
   - **사용 설명서**([GuideScreen.tsx](../../../src/ui/screens/GuideScreen.tsx), [R6GuideStages.tsx](../../../src/ui/screens/guide/R6GuideStages.tsx), [guideModel.ts](../../../src/ui/screens/guide/guideModel.ts)): `balanceVersion !== '1.0.0'` 일반화, `Lv` → `단계` 100% 한국어 치환, 5종족 `256×256` WebP 초상화·추천 대응 타워 칩·특수 받침(`언덕`/`빛`)·5웨이브 변화 안내를 반영한다.
   - **환경설정**([SettingsModal.tsx](../../../src/ui/screens/SettingsModal.tsx), [settings.ts](../../../src/persistence/settings.ts)): `shareRecords` 판 시작 시점 스냅샷 안내, `배경음 듣기` 미리듣기, `색약 보조 색상` 토글, 접이식 단축키 안내를 추가한다.
3. **전투 VFX 주스·타워 오버클럭·외곽 앰비언트 공백**:
   - [CombatVfx.ts](../../../src/game/r6/CombatVfx.ts), [TowerPlayback.ts](../../../src/game/r6/TowerPlayback.ts), [EffectLayer.ts](../../../src/game/layers/EffectLayer.ts), [AmbientLayer.ts](../../../src/game/layers/AmbientLayer.ts)에서 6종 타워 무기 단계(I~IV)별 VFX 차등, 버닝 오버클럭 글로우, 진화 승격 버스트, 보스 전조/방패 파괴, 120ms 보스 처치 미세 진동, R6 4대 바이옴 외곽 입자(`GroundLayer` 50W 틴트 비충돌)를 구현한다.
4. **Spine Stage 2b 유기적 가중치 메시 & `rig_audit` 자동 검증**:
   - 원화 재절단 없이 날개·망토·촉수·2본 무릎 가중치 `MeshAttachment` 빌더([mesh_weights.py](../../../tools/r6/spine/mesh_weights.py)) 및 `fall` 머리 안착·발 접지 키 베이킹([rigs.py](../../../tools/r6/spine/rigs.py))과 클로드 예산 상한·루프 폐합 `--budget` 감사([rig_audit.py](../../../tools/r6/spine/rig_audit.py))를 완비한다.
5. **교실 대형 QR · 학년 청크 프리페치 · 오프라인/색약 접근성**:
   - [ClassroomQrModal.tsx](../../../src/ui/screens/home/ClassroomQrModal.tsx), [entryUrl.ts](../../../src/application/entryUrl.ts)에 난이도 프리셋 URL과 `교실 화면 크게 보기` 프로젝터 대형 QR 모드를 추가한다.
   - [gradeLoader.ts](../../../src/content/gradeLoader.ts) `prefetch(grade)`, [sw.js](../../../public/sw.js) 오프라인 폴백 알림, [accessibility.css](../../../src/ui/styles/accessibility.css) Okabe-Ito 색약 보조 배색 레이어를 제공한다.

---

## §1. 불변 제약 및 제품 원칙 (`Non-Negotiables`)

1. **PRD v0.5 §20.5 (퍼센트·숙련도 금지)**: `ResultScreen`·`NoteScreen`에는 정답률(%)·숙련도·백분율을 표시하지 않는다.
2. **PRD §2.2 (복습 무보상 원칙)**: 오답 노트 플래시카드는 `clears`·골드·점수·랭킹 보상을 부여하지 않는다.
3. **PRD §13.2 (UI → persistence 직접 참조 금지)**: `src/ui/**`는 `src/persistence/**`를 직접 import하지 않고 순수 모델·`src/application/**` 경유를 지킨다.
4. **PRD §13.3 (결정론·난수 금지)**: 오디오·VFX·앰비언트에서도 `Math.random()`을 쓰지 않고 시드 기반 결정론 연산만 사용한다.
5. **R6 V2 100% 한국어 규칙**: 신규·수정 UI/도감/결과/노트/설정에서 `Lv`, `Wave`, `HP`, `DPS` 등 영문 약어와 금지어(`수호`·`출격`·`징집`·`작전실` 등)를 쓰지 않는다.
6. **저장소·성능 상한**: IndexedDB 스키마 `v2` 유지, 외부 오디오·VFX 텍스처 파일 추가 `0KB`, 도형 상한(`400 / 200 / 100`) 및 파티클 상한(`≤ 120`) 준수.

---

## §2. 패키지별 구현 및 통합 내역 (`WP-C2-01` ~ `WP-C2-08`)

| 패키지 | 범위 | 핵심 파일 |
| --- | --- | --- |
| `WP-C2-01` | 적응형 0KB WebAudio BGM·컴프레서·결과 팡파르 | `src/ui/audio/{scales,bgmEngine,sound}.ts` |
| `WP-C2-02` | 오답 노트 검색·우선 배지·무보상 플래시카드 | `src/ui/screens/{noteModel,NoteScreen,NoteFlashcard}.*` |
| `WP-C2-03` | R6 결과 성취 요약·정답 가리기/모두 펼치기 | `src/ui/screens/{resultModel,ResultScreen}.*` |
| `WP-C2-04` | R6 도감 한국어(`단계`)·초상·설정 스냅샷/단축키 | `src/ui/screens/{GuideScreen,SettingsModal}.*`, `src/ui/screens/guide/*`, `src/persistence/settings.ts` |
| `WP-C2-05` | 무기 4단계 VFX·오버클럭 글로우·외곽 바이옴 입자 | `src/game/r6/{CombatVfx,vfxTiming,TowerPlayback}.ts`, `src/game/layers/{EffectLayer,AmbientLayer}.ts` |
| `WP-C2-06a` | Spine Stage 2b 가중치 메시 빌더·`--budget` 감사기 | `tools/r6/spine/{mesh_weights,rigs,rig_audit,test_monsters}.py`, `tools/r6/spine/rig-poses.mjs` |
| `WP-C2-07` | 대형 프로젝터 QR·난이도 URL·프리페치·색약 CSS | `src/application/entryUrl.ts`, `src/ui/screens/home/ClassroomQrModal.*`, `src/content/gradeLoader.ts`, `public/sw.js`, `src/ui/styles/accessibility.css` |
| `WP-C2-08` | `App`/`GameScreen`/`BattleScene` 통합·문서 승격·동기화 | `src/main.tsx`, `src/ui/App.tsx`, `src/ui/game/GameScreen.tsx`, `src/game/BattleScene.ts`, `docs/renewal/r6/PRD-r6-v2-companion.md` |

---

## §3. 정량 검증 및 완료 관문

- `npm run verify` (`typecheck`, `lint`, `test`, `validate:plan`, `validate:content`, `wiki:lint`) 0오류
- `npm run test:server` (Cloudflare Workers + D1 서버 회귀 시험) 100% 통과
- `npm run build` 성공 및 Playwright E2E 핵심 스위트 통과
- `npm run wiki:stamp && npm run wiki:sync && npm run wiki:check` 0오류
- `tools/r6/spine` 단위 시험 20/20 및 `rig_audit.py --budget` 위반 0건
