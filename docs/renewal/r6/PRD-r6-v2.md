# R6 대개편 PRD V2 · 질적 고도화 및 다중 세션 단일 기준서 (`PRD-r6-v2`)

- **작성**: 2026-11-27
- **기준 커밋**: `8c5c3d25` (`p1/intake-round1`)
- **계보**: [PRD-r6.md (V1, 2026-11-25)](PRD-r6.md)에서 V2로 격상. V1이 타워 6종 66형태·몬스터 5종족 100개체·초원 고원 맵·시즌 2 운영 반영의 **양적 완성 기준서**였다면, 본 문서(V2)는 **질적 고도화(Craftsmanship & Game Feel)·세부 제작 노하우·다중 세션 무충돌 경계의 단일 기준서**다.
- **검수 기반**: 클로드(`claude-opus-5-5/xhigh`, `20261127T085109-f84023`) 및 코덱스(`gpt-6.2-astra/high`, `20261127T084111-ba1f69`) 교차 기술 검수 반영.

---

## §0. V1 → V2 격상 배경 및 확정 사용자 결정 (2026-11-27)

### 0.1 V1 달성 현황과 V2 해결 과제
- **V1 달성**: 타워 6종×11형태(66형태, Blender 5.2, `14MB`), 몬스터 5종족×20개체(100개체, Spine 4.3.26 뼈대 40개 + 아틀라스 5장 `2.6MB`), 홈 초상 `30/30`장(`410.4KB`), CR-1000 문제은행(자기 5,547 / 풀 6,583문항), Cloudflare Workers/D1 시즌 2 + GitHub Pages 운영 반영 완료.
- **V2 해결 과제 (현장·실브라우저 진단)**:
  1. **몬스터 "동동 떠다님" & 선화 깨짐**: Linear 4구간 삼각파 회전·단순 `scaleX` 즉시 플립·투영 세로 단축(`0.51배`) 미반영 보폭·NPOT `Linear` 축소 샘플링(밉맵 부재)·0단계 8패스 윤곽 이중선 및 `onKill` 무제한 업데이트.
  2. **타워·VFX·사운드 건조함**: 포두 즉시 스냅·대기 Idle 부재·매 프레임 Graphics 재테셀레이션, 단일 오실레이터 WebAudio 사운드의 단조로움.
  3. **UI/UX·개인정보 정합성**: `shareRecords` 기본 `false` 상태에서 `LaunchDeck`의 거짓 `준비 완료 · 순위 연동` 배지, 시작 전 동의 흐름 부재(`START_REQUIRED` 거절 구조).

### 0.2 확정된 사용자 결정 (2026-11-27)
1. **공개 기록 1회 동의 확정 (`WP-Q1b`)**: `shareRecords` 기본값은 `false`를 유지하되, 아직 선택하지 않은 기기에서 "새 게임"을 누르면 1회 동의 모달("순위표에 올리기" / "이 기기에만 저장")을 띄워 시작 전 동의를 명확히 받는다.
2. **학교 선택·공개 기능 완전 제거 (타 세션 진행 중)**: NEIS 학교 검색·학교 입력·학교 랭킹 필터·서버 학교 프록시 기능은 별도 세션에서 제거 중이다. 따라서 V2 동의 고지 항목은 **`닉네임 · 학년 · 난이도 · 점수 · 웨이브`**로 정립한다(학교명 제외).
3. **다중 세션 병렬 협업 및 무충돌 원칙**: 저장소 내 여러 세션이 동시에 서로 다른 분야를 작업 중이므로, 각 세션은 §1의 배타적 파일 소유 경계를 지키며 공유 파일은 직렬화한다.

---

## §1. 다중 세션 소유 경계 및 무충돌 프로토콜 (Active Ownership Matrix)

커밋·편집 직전 `git status --short`로 타 세션 수정 파일을 확인하고, 아래 소유 경계 밖 파일은 수정하지 않는다.

| 세션 | 담당 범위 | 배타적 소유 파일 (타 세션 수정 금지) |
| --- | --- | --- |
| **세션 A (타 세션)** | **맵 고화질화 · 전투 레이아웃 · 타워 초상화 · Lv1~5 강철 조명** | `tools/r6/map/**`, `public/assets/r6/map/**`, `public/assets/r6/meadow-plateau.webp`, `docs/renewal/r6/map-spec.md`, `src/game/r6/mapProjection.*`, `src/game/layers/GroundLayer.ts`, `src/ui/screens/r6Map.ts`, `src/ui/useLayout.ts`, `src/ui/game/{GameScreen,Armory,ContextCard,QuestionPanel,FieldOverlay,TowerDetail,BattleTowerPortrait}.*`, `src/ui/styles/tokens.css`, `tools/r6/blender/{mortar_render,tower_pack,tower_game_pack,pack}.py` |
| **세션 B (타 세션)** | **학교 선택·공개 기능 제거** | `src/application/neis.ts`, `src/ui/screens/home/{LaunchDeck,RankingBoard,RankingModal,ClassroomQrModal}.*`, `src/contracts/lobby.ts`, `src/persistence/lobbyClient.ts`, `server/**`, `src/ui/copy.ts` |
| **세션 C (본 세션 · R6 V2)** | **몬스터 밉맵·윤곽·리깅/모션, 타워 런타임·VFX·WebAudio, 공개 기록 동의 모달, 독립 성능 계측** | - 몬스터 공정/런타임: `tools/r6/spine/**`, `asset-source/r6/monsters/**`, `public/assets/r6/monsters/**`, `src/game/r6/monsters/*.json`, `src/game/layers/EnemyLayer.ts`, `src/game/r6/enemyDisplay.ts`<br>- 타워 런타임/VFX: `src/game/r6/TowerPlayback.ts`, `src/game/r6/CombatVfx.ts`, `src/game/r6/vfxTiming.ts`, `src/game/layers/TowerLayer.ts`, `src/game/layers/EffectLayer.ts`, `public/assets/r6/vfx/**`<br>- 오디오: `src/ui/audio/sound.ts`<br>- 동의 모달: `src/ui/screens/RecordConsentModal.*`(신규), `src/persistence/settings.ts`(`shareRecordsAsked` 필드만 추가), `src/ui/screens/NewGameScreen.tsx`(또는 `HomeScreen.tsx` 최소 연결, 타 세션 직렬 확인 후)<br>- 성능 스펙: `tests/e2e/r6-quality-perf.spec.ts`(신규) |

### 공유 파일 직렬화 및 계약 보존 규칙
1. **`public/assets/r6/manifest-v2.json`**: 최상위 키(`maps`·`towers`·`sheets` vs `atlases`·`rigs`·`species`)를 각 도구가 **자기 키만 부분 병합**해 기록하고 쓰기 시점을 직렬화한다.
2. **`src/game/BattleScene.ts`**: 세션 A의 맵/테마 작업 완료를 확인한 뒤 `prepareWave` 퀴즈 단계 선적재 패치 1회만 직렬 적용한다.
3. **`src/game/r6/manifest.ts`**: 스키마 충돌을 피하기 위해 몬스터 보폭(`stridePx`)·스킨별 윤곽 정책 메타는 `src/game/r6/monsters/*.json`(또는 `enemyDisplay.ts` 내 파생 테이블)에 둔다.
4. **`EnemyFootprint` 계약**: `EnemyLayer.activeFootprints()` → `padOutline.ts` → `GroundLayer.syncPads` 계약을 고정한다. 뒤집기 보간 중에도 경계 상자는 목표 방향 기준으로 계산한다.
5. **`src/game/layers/shared.ts`**: 본 세션에서는 읽기 전용으로만 참조한다.
6. **`docs/contracts/prd_v0_5_validation.json`**: 타인/기존 변경 보존을 위해 수정·커밋하지 않으며 `npm run validate:plan` 대신 읽기 전용 `npm run wiki:check`를 사용한다.

---

## §2. V1 진단 대비 V2 아키텍처 확정 결정

1. **축소 문제(몬스터) vs 확대 문제(배경 맵)의 정반대 해법**:
   - **몬스터 (축소 샘플링 문제)**: `1366×768 DPR1`(zoom ≈ `1.26~1.46`)에서 현행 `256/ppu=3`은 이미 화면보다 **2.0~3.4배 큰 텍셀**을 가지므로, 해상도 부족이 아니라 **`pot=false` + `filterMin=Linear`로 밉맵이 꺼져 선화가 깨지는 문제**다. 따라서 `384/512` 상향 및 `1x/2x` 분기는 기각하고, **`256/ppu=3` 유지 + `pot=true` + `filterMin=MipMapLinearLinear` + `filterMag=Linear` + 손실 WebP `-sharp_yuv`**를 확정한다(DPR2 실측 텍셀/기기px < 1.1일 때만 후속 2× 검토).
   - **배경 맵 (확대 블러 문제, 세션 A 관할)**: `960×576`이 고해상도 캔버스에서 2.76× 확대되는 정반대 문제이므로 세션 A에서 `1920×1152`(2×)로 상향한다.
2. **실루엣 윤곽 및 피격 표현**:
   - 파츠별 오프라인 림 베이크(관절 내부 이음매에 은회 선 생성) 및 Phaser 4 FBO 1패스 셰이더(개체당 22회 FBO 전환 또는 Y정렬 파괴)는 **기각**한다.
   - **확정안 (1단계)**: 런타임 실루엣 방식 유지 + 화질 0단계도 **4방향(5배 제출, W20 `renderMesh` ≤ 1,400회)**으로 통일 + `silhouettes.json` 길 대비 기반 스킨별 윤곽 정책 + 동일 훅 본 패스 `ADD 0x404040` 피격 점멸(추가 제출 0). (Q2 후 예산 초과 시에만 `monsters.py` 팽창 실루엣 슬롯 2단계 검토).
3. **2D Spine 통일 및 실시간 Three.js 배제**:
   - 경질 몬스터(`machine`/`stone`) Blender 3D 파츠 혼용은 계통 내 T1~T4 선화·명암 일관성 파괴 및 100개체 개별 모델링 비용 때문에 기각한다. **고화질 2D 파츠(취약 5개체 보강 포함) + Spine 4.3 Mesh2D**로 통일하며, 실시간 Three.js 런타임은 채택하지 않는다([PRD-r6.md §3.4](PRD-r6.md) 유지).

---

## §3. 질적 향상을 위한 10대 세부 노하우 (V2 Craftsmanship Playbook)

### 노하우 1 · 텍셀 밀도 & 밉맵 & WebP 크로마 법칙
- **규칙**: 화면 기기 px 대비 텍셀 밀도는 **1.0~2.0×**가 적정선이다. 3배 초과 축소는 밉맵 없이는 에일리어싱을 유발한다.
- **패킹 설정**: Spine 아틀라스는 반드시 **`pot=true`, `filterMin=MipMapLinearLinear`, `filterMag=Linear`**로 패킹해 `PhaserTexture.generateMipmap()`이 실제로 작동하게 한다.
- **WebP 색 번짐 방지**: 종족 아틀라스(`768KB` 상한)가 무손실에서 `-q 92` 손실로 내려갈 때(`elf` 등) 반드시 **`-sharp_yuv`** 플래그를 추가해 4:2:0 서브샘플링으로 1px 앰버·틸 포인트가 탁해지는 현상을 막는다. 알파 채널 무변화(`alpha_q 100 -exact`) 및 투명 여백 보존(`L-TD-102`)을 유지한다.

### 노하우 2 · Spine 4.3 애니메이션 원칙 & 5종족 모션 문법
- **Linear 삼각파 금지**: 모든 `walk`/`hit`/`fall`/`boss-skill` 키프레임에 목적별 Cubic Bezier 커브를 부여한다(딛고 차오르는 탄성 `[0.25, 0.1, 0.25, 1.0]`, 타격 반동 급가속 `[0.1, 0.9, 0.2, 1.0]`).
- **원화 재절단 없는 2본 무릎 가중치 메시**: 다리 PNG를 2개로 다시 자르지 않고 단일 다리 이미지를 **2본 가중치 메시**로 묶어 무릎 관절 굽힘을 구현한다. 날개(`wing-*`)·망토·깃발·촉수(`mark`/`gear`) 등 연성 슬롯은 `3×4` 이하 격자 메시로 바람/관성 흔들림을 준다. (4.3.26 편집기 호환: 모든 정점의 bone influence는 본 인덱스 오름차순 고정)
- **사전 계산 IK & 위상 지연 키 (런타임 제약 0)**: 50/100ms 자세 스로틀(`quality >= 2`)에서 물리·IK 시뮬레이션이 튀지 않도록 **런타임 IK·물리·경로 제약·클리핑은 모두 `0`개**로 제한한다. 대신 `rigs.py`에서 2본 역산 IK를 회전 키로 사전 베이킹해 접지 발 미끄럼을 **≤ 1.5px**로 잡고, 머리·망토·무기의 2차 추종은 1~2프레임 위상을 늦춘 키로 만든다.
- **5종족 × 5계통 모션 문법**:
  - `elf`: 가볍고 탄력 있는 보폭, 잎날개·망토 지연 추종.
  - `human`: 절도 있는 행진 박자, 기병 말 상하 반동과 기수·창 지연 흔들림.
  - `machine`: 유압 스텝 정지-가속 커브, 포탑/센서 수평 안정화.
  - `insect`: 다리 간 위상차 빠른 잔걸음, 복부·더듬이·날개 고주파 진동.
  - `stone`: 느리고 묵직한 체중 이동, 착지 순간 스쿼시(`scaleY 0.94`, `scaleX 1.05`) 후 복원.
- **다관절 `hit` · `fall` · `boss-skill`**: `body` 단일 회전 대신 머리·양팔·다리가 연쇄 반응하며, 보스는 종족별 시전 자세(내려치기/포효/급상승/충전)를 차별화한다.

### 노하우 3 · 투영 보폭 동기화 & 코너 히스테리시스
- **보폭 동기화**: 3/4 투영 맵의 세로 단축률(`R6_MAP_SQUASH ≈ 0.509`)로 인해 상하 경로 이동 시 화면 속도가 약 0.51배가 되며, `r6EnemyScale` 압축 배율도 개체마다 다르다. `rigs.py`가 리그별 기준 보폭(`stridePx`)을 출력하고, `EnemyLayer.ts`는 **`화면 이동 px/s ÷ (stridePx × effScale)`**를 부드럽게 필터링해 `walk.timeScale`로 적용한다.
- **방향 떨림 방지 & 스쿼시 턴**: `EnemyLayer.ts:216`의 `aheadX !== point.x` 즉시 비교 대신 **`|aheadX - point.x| ≥ 2px` 히스테리시스**를 적용해 세로 경로 떨림을 막고, 전환 시 `80~120ms` 동안 `scaleX` 스쿼시 보간을 둔다(`reducedMotion` 시 즉시 전환).

### 노하우 4 · 적응형 실루엣 분리 & 제로-코스트 피격 + 쓰러짐 상한
- **스킨별 윤곽 정책 (`silhouettes.json` 길 대비 기준)**:
  - 길 대비 `≥ 2.0` (밝은 `human` 갑주 등): 카본(`#12161B`) `α 0.30` 또는 생략 → **이중선 0건**.
  - 길 대비 `1.5 ~ 2.0`: 은회(`#B8C0C8`) `α 0.25`.
  - 길 대비 `< 1.5` (어두운 개체): 은회(`#B8C0C8`) `α 0.45`.
- **제로-코스트 피격 점멸**: `enemyDisplay.ts` 훅의 원본 본 패스에서 `ADD 0x404040` 틴트를 직접 적용해 추가 `renderMesh` 제출 `0`으로 선명한 피격 반응을 낸다(화질 2+단계는 윤곽 0패스 분기로 점멸만 유지).
- **쓰러짐(`onKill`) 동시 상한**: `onKill`이 `addToUpdateList()`로 스켈레톤을 무제한 등록해 곡사포 연쇄 처치 시 프레임이 급락하는 함정을 막기 위해, 동시 쓰러짐 애니메이션 상한을 **0단계 `8` · 1단계 `6` · 2+단계 `4`**로 제한하고 초과분은 `0.15초` 페이드아웃만 실행한다.

### 노하우 5 · 타워 조준-표시 분리 & 무비용(Zero-Texture) Idle
- **조준 vs 표시 방향 분리**: `TowerPlayback.ts`에서 공격 클립이 읽는 `aimDirection`과 화면에 그리는 `displayDirection`을 분리한다. 표시 방향은 프레임당 최대 **2스텝**(90° 약 33ms) 회전하되, 공격 발사 순간 차이가 **4스텝**을 넘으면 즉시 맞춘다.
- **새 대형 시트 0 원칙 Idle**: 타워당 추가 표시 객체 `≤ 1`개, 매 프레임 다시 그리는 `Graphics` `0`개 원칙 하에, ① 비표적 시 기존 16방향 포두로 저속 스캔(`400~600ms/스텝`), ② 포두 `±1px` 호흡, ③ 격납고 기존 드론 시트 호버, ④ 부팅 시 만든 `32×32` 공용 방사형 광택 텍스처 1장을 `ADD` 1쿼드로 프리즘·냉각에 적용한다(1단계 광택 끔, 2+단계 Idle 전부 끔).

### 노하우 6 · 2계층 VFX 풀링 (판독선 + 30KB 장식 아틀라스)
- **역할 분리**: `CombatVfx.ts`에서 매 프레임 `Graphics.clear()` 테셀레이션 비용이 폭증하지 않도록, **전투 판독에 필수인 핵심선**(레일 빔·프리즘 연쇄선·착탄 원·방벽 부채꼴)만 `Graphics`에 남기고 **장식 효과**(총구 섬광·충격 링·포탄 연기 궤적·지면 균열·냉기 결정 파동·종족별 처치 파편)는 **`256×256` 이하 VFX 아틀라스 1장(`≤ 30KB`) + 풀링 Image/파티클(`ADD`)**로 분리한다.
- **엄격한 상한**: 프레임당 Graphics 도형 **0단계 `400` / 1단계 `200` / 2+단계 `100`**, 활성 파티클 **`≤ 120`**, 프레임당 블렌드 모드 전환 **`≤ 4회`**, 장식 원 분할 **`20`**, `MAX_CUES = 96`, Phaser `Glow/Bloom` 필터 및 FBO `0`개.

### 노하우 7 · 무파일(0KB) WebAudio 타격감 & 도파민 사운드 설계 (`src/ui/audio/sound.ts`)
- **원칙**: 외부 음원 파일(`0KB`) 없이 WebAudio 합성만으로 상용 게임 수준의 타격감과 퀴즈 보상을 만든다. 기존 채널·우선순위(`correct`/`wrong`/`leak` 최우선, 넘치면 `fire.*`부터 생략)와 `bgmVolume`/`sfxVolume`/`soundOn` 계약을 유지한다.
- **5가지 합성 고도화 기법**:
  1. **마이크로 피치 변주 & 다층 어택**: 동일 `fire.*` 연속 재생 시 `±4%` 피치 랜덤화로 기계적 반복 피로를 없애고, 짧은 필터링 화이트/핑크 노이즈 버스트(15~45ms) + 피치 하강 오실레이터를 합성해 타격감을 만든다.
  2. **무기 단계(I~IV) 음색 분화**: 무기 단계가 오를수록 배음(filter cutoff)·저역 무게감을 높여 Lv6·Lv12·Lv18 진화 체감을 귀로 전달한다.
  3. **퀴즈 연속 정답 콤보 음계**: `battleStreak` 1→2→3→버닝 진입에 따라 5음 음계(`C6→E6→G6→C7` 스웰)로 피치·화음을 상승시켜 도파민 보상을 강화한다.
  4. **종족별 처치 질감 & 보스 등장 펄스**: `machine`/`stone` 경질 파쇄(고역 클릭+저음 둔탁함) vs `elf`/`insect` 유기적 소멸, 보스 웨이브 진입 시 낮은 브라스형 2중 펄스.
  5. **타워 진화·해금 피드백**: 2레벨 외형 진화 및 W3·6·9 타워 해금 시 짧은 상승 아르페지오 차임 추가.

### 노하우 8 · 전투 중 0ms 스터터 프리로드
- `BattleScene.ts:prepareWave`가 전투 중 불려 아틀라스·밉맵 GPU 업로드 끊김을 유발하지 않도록, 다음 웨이브 종족 적재 및 GPU 업로드는 반드시 **준비/퀴즈 단계에서 완료**해 전투 중 `100ms` 초과 프레임 **0회**를 보장한다.

### 노하우 9 · 거짓 없는 성능 계측 & 모든 신기능 품질 스위치
- 모든 측정은 목표 환경인 **`1366×768 DPR1`**, `resource-guard` **일반 우선순위(학생 접속 0명)** 조건에서 수행한다.
- 평균 FPS(60 상한에 가려짐) 대신 **`p95` 프레임 작업시간(≤ 12ms)**, `50ms` 초과 프레임 수, **`renderMesh` 호출 카운터**, **스트레스 장면(적 40 · 보스 2 · 타워 24 동시 연사)**을 함께 기록한다.
- **No-Go 안전장치**: 모든 V2 시각·모션 신기능은 `renderQuality` 단계별 토글로 즉시 끌 수 있게 구현한다.

### 노하우 10 · 공개 기록 시작 전 동의 정합성 (`START_REQUIRED` 대응)
- 서버가 `/v1/runs/start` 기록 없는 제출을 `START_REQUIRED`로 거절하므로(`lobbyClient.ts:435`), 동의는 반드시 **새 게임 시작 전**에 완료해야 한다.
- 각 판마다 **시작 시점의 `shareRecords` 스냅샷**을 저장해, 판 도중에 설정을 켜더라도 `"이번 판은 시작할 때 공개 기록이 꺼져 있어 이 기기에만 저장돼요"`라고 정확히 안내한다.
- 고지 문구는 학교 선택 제거를 반영해 **`닉네임 · 학년 · 난이도 · 점수 · 웨이브`**만 정확히 명시한다.

---

## §4. V2 세부 실행 로드맵 (본 세션 독점 트랙)

> **순서 원칙**: ① `Q0` 계측·밉맵 스파이크 최우선 → ② 트랙 B에서 `Q3 경량(패킹/밉맵)`을 `Q2(리깅/애니메이션)`보다 **먼저** 확정해 100개체 재생성을 **1회**로 통합 → ③ 각 트랙 병합 직후 `r6-quality-perf` 관문 1회 실행 → ④ 최종 `Q5` 통합.

| 단계 | 작업 내용 | 주요 대상 파일 (본 세션 독점) | 선행 / 병렬 |
| --- | --- | --- | --- |
| **Q0** | `1366×768 DPR1` W20 + 스트레스 장면 기준선 스펙(`r6-quality-perf.spec.ts`) 작성, `pot=true`+`MipMapLinearLinear` 실작동 스파이크, 3환경 텍셀 밀도 실측, 맵 세션 `manifest-v2.json` 쓰기 순서 확인 | `tests/e2e/r6-quality-perf.spec.ts`(신규) | 최우선 착수 |
| **WP-Q3 경량** | `monsters.py` `pot=true`+`MipMapLinearLinear/Linear`+`-sharp_yuv` 적용, `enemyDisplay.ts` 0단계 4방향·스킨별 윤곽 정책·동일 훅 `ADD 0x404040` 피격 점멸, `BattleScene` 퀴즈 단계 프리로드 | `tools/r6/spine/monsters.py`, `src/game/r6/enemyDisplay.ts`, `src/game/layers/EnemyLayer.ts`, (`BattleScene.ts` 직렬) | Q0 후 즉시 |
| **WP-Q2** | `rigs.py` Bezier·5종족 아키타입·2본 무릎 메시·연성 메시·사전 2본 IK 키·다관절 `hit`/`fall`/`boss-skill`(1회 재생성), `EnemyLayer` 투영 보폭·2px 히스테리시스·80ms 턴·쓰러짐 상한(8/6/4), `rig_audit.py` 상한·발 미끄럼(`≤1.5px`) 검증 + 취약 5개체 2D 보강 | `tools/r6/spine/{rigs,rig_audit,batch}.py`, `asset-source/r6/monsters/**`, `public/assets/r6/monsters/**`, `src/game/layers/EnemyLayer.ts` | Q3 경량 후 (취약 5개체 병렬) |
| **WP-Q4.1 · Q4.3 · Q4.4** | `TowerPlayback` 조준/표시 분리 스무스 회전 + Zero-Texture Idle, `CombatVfx` + `30KB` VFX 아틀라스 풀링 + 도형 상한(400/200/100), `sound.ts` 무파일 WebAudio 타격감·콤보·진화·보스·종족음 고도화 | `src/game/r6/{TowerPlayback,CombatVfx,vfxTiming}.ts`, `src/game/layers/{TowerLayer,EffectLayer}.ts`, `public/assets/r6/vfx/**`, `src/ui/audio/sound.ts` | Q0 후 트랙 B와 병렬 |
| **WP-Q1b** | `RecordConsentModal`(1회 동의 카드, 학교명 제외 고지) + `settings.ts`(`shareRecordsAsked`, 시작 시점 스냅샷) 구현 후 타 세션 B 완료 직후 최소 연결 | `src/ui/screens/RecordConsentModal.*`(신규), `src/persistence/settings.ts` | 독립 모듈 먼저, 연결은 세션 B 후 |
| **WP-Q5** | 각 트랙 병합 성능 관문 + 최종 통합(`npm run verify`, `npm run build`, `tests/e2e/r6-*.spec.ts`, 연속 8프레임 보행 스트립 시각 검수, `npm run wiki:sync`) | 전체 검증 + 비교판 산출물 | 모든 트랙 완료 후 |

---

## §5. 정량 예산 및 Go / No-Go 관문표

### 5.1 스켈레톤 · 자산 · VFX 정량 상한
| 항목 | 일반 개체 / 기본 상한 | 보스 개체 / 비고 |
| --- | --- | --- |
| Spine 본 수 / 그리는 슬롯 수 | 본 `≤ 24` · 슬롯 `≤ 16` | 본 `≤ 32` · 슬롯 `≤ 22` |
| 가중치 메시 / 정점 / 영향 본 | 메시 `≤ 6`(다리4+날개·망토2) · 정점 `≤ 16`(날개·망토 `≤ 24`) · 영향 본 `≤ 2` · 가중치 합 `≤ 200` | 메시 `≤ 8` · 정점 `≤ 32` · 영향 본 `≤ 3` · 가중치 합 `≤ 400` |
| 런타임 제약 · 키 · 길이 | 런타임 IK·물리·클리핑 **`0`** · 걷기 키 `≤ 9`(시작=끝) · `fall ≤ 0.6s` | `fall ≤ 0.9s` · W20 가중치 합 `≤ 6,000` |
| 몬스터 아틀라스 | 종족당 **1장 · `≤ 768KB`**, 폴더 `≤ 3.0MB`, 밉맵 포함 5종 RGBA 합 `≤ 32MB` (`≤ 5.6MB`/종족) | 알파 변형 0, `256/ppu=3` 유지 |
| 윤곽 · `renderMesh` | W20 프레임당 `renderMesh ≤ 1,400` (2단계 전환 시 `≤ 600`) | 밝은 스킨 이중선 0, G4 지형 대비 `≥ 2.056` 유지 |
| 타워 런타임 · VFX · 오디오 | Idle 추가 객체 `≤ 1`/타워, VFX 아틀라스 `≤ 30KB`, 도형 상한 `400/200/100`, 파티클 `≤ 120`, 블렌드 전환 `≤ 4`/프레임 | 타워 자산은 세션 A 범위 포함 전체 `≤ 16.1MB`(`1x ≤ 5.0MB`), 오디오 추가 파일 `0KB` |

### 5.2 완료 승인(Go) 및 차단(No-Go) 기준
- **완료 Go**:
  1. **성능**: `1366×768 DPR1` W20 CPU 6배 감속 평균 **`≥ 55fps`**, 1초 최저 **`≥ 45fps`**(웨이브 시작 2초 제외), 품질 `0` 유지, 자동 정지 `0`, `p95` 작업시간 **`≤ 기준선 +15%` 및 `≤ 12ms`**, 전투 중 `> 100ms` 프레임 **`0`**, 스트레스 장면 자동 정지 `0`·평균 `≥ 45fps`(1단계 하향 허용), CPU 1배 `≥ 58fps`.
  2. **리그·모션**: `rig_audit` 100/100 통과, 33자세 접합 미달 `0`, 걷기 시작=끝 오차 `0`, 접지 발 미끄럼 **`≤ 1.5px`**.
  3. **UX·동의**: 공유 끔 상태에서 새 게임 시작 시 `/v1/runs/start` 호출 `0`(E2E), 동의 켬 1판 완주 시 D1 `run_start_dedup`·`completed_runs` 각 `1`건 이상, 고지 문구(`닉네임·학년·난이도·점수·웨이브`) 일치.
  4. **공통**: `npm run verify`, `npm run build`, `tests/e2e/r6-*.spec.ts`, `npm run wiki:check` 통과.
- **No-Go (차단/되돌림)**:
  - 성능 기준 1회 수정 후에도 실패 시 해당 신기능을 품질 단계 스위치로 끈 채 출시하고 원인을 후속 이관한다.
  - 리그 접합 미달 `≥ 1건`, 종족 아틀라스 `2장 이상` 분할, 타 세션 소유 파일 무단 변경 감지 시 병합을 차단한다.

---

## §6. 미확인 실측 항목 (`Q0` 해소 대상) 및 V1 → V2 변경 이력

- **Q0 실측 예정 4건**: ① `1366×768` 실제 전장 캔버스 크기 및 3환경 텍셀 밀도 실측, ② 5종족 `atlas-report.json` 손실/무손실 실태, ③ Phaser 4.2.1 `'phaser'` 백엔드 WebGL 버전 및 POT 밉맵 GL 파라미터 실작동, ④ 타워 6종 최단 공격 간격 대비 회전 스텝 여유.
- **V1 → V2 변경 요약**:
  - 양적 구축([PRD-r6.md](PRD-r6.md)) → 질적 고도화(밉맵·적응형 윤곽·5종족 모션·투영 보폭·2계층 VFX·무파일 WebAudio·시작 전 동의·1366×768 p95 계측)로 기준 격상.
  - 동시 진행 중인 타 세션(① 맵·전투 레이아웃·타워 초상화·Lv1~5 강철, ② 학교 선택 제거)과의 파일 소유 경계 및 `manifest-v2.json` 직렬화 규약 명문화.
