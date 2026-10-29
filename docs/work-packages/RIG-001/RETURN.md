# RIG-001 — 고블린 보행·피격 동작 결과 보고 (RETURN)

```yaml
jobId: RIG-001
status: RETURNED   # 최종 ACCEPTED는 총괄만 부여
owner: Claude Opus 5.5 (claude-opus-5-5, 별도 세션)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
completedAt: 2026-10-28
baseCommit: bc3ee0720912d33ff2b96602c365cfdd38e37521
contractHashVerified: true   # node tools/contract-hash.mjs RIG-001 → REQUEST.md 머리말 4개와 일치
sourceArt: enemy.walker.0~3.r1.png(integrated_pass), enemy.walker.hit.r1.png(visual_pass)
requestedContractChanges: 1   # BattleScene.ts·assets.ts 연결(아래 §6)
```

## 1. 시작 확인

- `git rev-parse HEAD` → `bc3ee0720912d33ff2b96602c365cfdd38e37521` 일치. 시작 시 `git status --short`는 ` M docs/work-packages/RIG-001/REQUEST.md` 한 줄이었다.
- `npm ci` 성공(`npm ls --depth=0` exit 0), `npx playwright install chromium` exit 0.
- `contract-hash` 4개(PRD, manifest, pose.ts, BattleScene.ts)가 머리말과 모두 같았다.
- 5173: 처음 두 번 확인 때 `/Users/bodyking/Desktop/vibecoding/tower`(본 폴더)의 `vite --port 5173 --strictPort`(PID 33958)가 점유하고 있어 작업 전에 멈추고 보고했다. 사용자 지시("네가 꺼라")를 받고 종료한 뒤, 비어 있음을 확인하고 시작했다.

## 2. 바꾼 파일

| 경로 | 목적 | sha256 |
|---|---|---|
| `src/game/animation/gait.ts` (새 파일) | 납품 원화에서 잰 디딤발 표. 걸음 폭과 프레임별 시간 몫을 계산한다. | `bfddf73122ede94d8a47cd8733055d0eef419a0722d86f8b607db49f853a761a` |
| `src/game/animation/pose.ts` | 보행표 기반 프레임 선택, 지면 고정, 디딤 내려앉음, 피격 눌림. 선택 입력 `distance`·`hitAge`와 출력 `hit`을 더했다. | `6132f972520793ac4ec6e8ce0961ede024e5bfa83426f11a9e4238b348d305e0` |
| `tests/unit/animation.test.ts` (새 파일) | 원화 대조(PNG 직접 해독), 미끄럼·접지·속도·피격·감소된 모션 시험 8개. | `c9f0995eb50848f3553be117ad4ae3bb7a87613f1861eb023baff07464b95af8` |

- 기존 호출 `enemyPose({ kind, phase, time, speedBP, moving, frames, reducedMotion })`은 그대로 동작한다. 새 입력은 모두 선택값이다.
- 판정·이동 진행도·보상은 읽지도 바꾸지도 않는다. `distance`는 렌더러가 이미 계산한 보간 진행도를 읽기만 한다.

## 3. 원화 측정과 방식

- 4프레임 차례: 0 디딤(두 발) → 1 지나감 → 2 디딤 → 3 지나감.
- 다섯 장(걷기 4장, 피격 1장) 모두 가장 아래 불투명 행이 95다. 즉 바닥선은 96px이고, manifest 기준점 originY 0.75와 PRD §11.2의 pivot (64,96)에 정확히 맞는다.
- 디딤발 x 중심(원본 px, 측정: 바닥 4행 중 아래 2행까지 닿은 신발 덩어리):

  | 프레임 | 0 | 1 | 2 | 3 |
  |---|---|---|---|---|
  | 접지한 발 | 43.5, 81 | 68.5 | 40, 79 | 63 |

- 미끄러지지 않으려면, 한 프레임에서 몸을 받치는 앞 발이 다음 프레임에서 가장 뒤 접지 발 위치로 갈 때까지 몸이 그 차이만큼 나아가야 한다. 그래서 프레임 길이를 그 차이에 비례시켰다.
  - 프레임별 몫: 12.5 / 28.5 / 16 / 19.5px → 0.163 / 0.373 / 0.209 / 0.255
  - 한 주기 걸음 폭: 원본 76.5px = 월드 27.54px(표시 0.72셀 기준)
- 몸의 위아래 움직임은 bob(그림 전체를 띄우기)으로 하지 않는다. 기준점(발) 쪽에 고정한 세로 눌림 4%로 디딤 때만 내려앉게 했다. 그래서 발은 땅에서 떨어지지 않는다.

## 4. 인수 기준별 결과

| 기준 | 결과 | 근거 |
|---|---|---|
| 발 교대가 보인다 | 통과 | 프레임 0→1→2→3 차례 확인(시험). 실제 게임 연속 캡처에서도 디딤·지나감이 번갈아 보인다(§7). |
| 접지 기준점이 프레임마다 흔들리지 않는다 | 통과 | 원화 바닥선이 다섯 장 모두 같다(시험). 발 있는 적은 bob이 항상 0이다. 렌더러 변환을 그대로 적용한 발 높이 변화는 0.1 월드px 미만이다(시험). |
| 미끄러짐 없이 걸음 빠르기가 speedBP에 맞는다 | 통과(조건부) | `distance`를 주면 프레임이 바뀔 때 디딘 발의 어긋남이 0.1px 이하다. 지금 계약(시간·speedBP)에서도 3학년 맵 속도로 speedBP 7500·10000·12000일 때 0.3px 이하다(1ms 표본). 고치기 전 코드는 같은 시험에서 7.66px 미끄러졌다. 다른 맵과 감속은 §8 참조. |
| 개체마다 위상이 다르다 | 통과 | `phase`를 그대로 더한다. 거리 방식에서도 같은 거리·다른 위상이면 프레임이 다르다(시험). |
| 정지·감소된 모션에서는 bob·squash가 0이다 | 통과 | 정지·감소·둘 다, 피격 유무 6가지 조합 모두 `bob 0, squashY 1`(시험). 감소된 모션에서도 발 교대 프레임과 피격 그림 표시는 유지한다. |
| 피격 압축 80~120ms, 지면 기준점 고정 | 함수 쪽 통과, 화면 연결은 요청 | `HIT_MS=100`. 맞은 순간 0.88에서 시작해 100ms에 걸쳐 1로 풀리고 bob은 0이다. 같은 적 재시작 최소 간격 120ms는 `acceptsHit`가 맡는다(PRD §11.4). 렌더러가 `hitAge`를 넘기지 않아 아직 화면에는 나오지 않는다(§6). |
| 그림 전체를 위아래로 흔드는 것만으로 보행 완료 금지 | 통과 | 발 있는 적은 bob 0이다. 보행은 원화 4프레임이 만든다. |

- 함께 바뀐 것: 임시 2프레임 그림을 쓰는 다른 발 있는 적(runner·brute·shell·swarm·boss)도 bob을 0으로 하고 같은 디딤 내려앉음을 쓴다. 걸음 빠르기 표(`STEPS_PER_SECOND`)는 그대로다.
- wisp는 떠다니는 적이라 bob 3px 흔들림을 유지하고, 걷기 눌림은 없앴다.

## 5. 프레임 시간표 (walker, 원화 4프레임)

지금 렌더러(시간 방식)는 3학년 맵 garden_u(40칸 / 720틱 = 24초) 속도에 맞춘다.

| 조건 | 이동 속도(월드px/s) | 한 주기 | 프레임 0 / 1 / 2 / 3 (ms) | 주기/초 | 프레임 교체/초 |
|---|---|---|---|---|---|
| garden_u, speedBP 10000 | 106.7 | 258.2ms | 42.2 / 96.2 / 54.0 / 65.8 | 3.87 | 15.5 |
| garden_u, swift 정예(12000) | 128.0 | 215.2ms | 35.2 / 80.2 / 45.0 / 54.8 | 4.65 | 18.6 |
| river_z(37칸), 10000 — 거리 방식 | 98.7 | 279.1ms | 45.6 / 104.0 / 58.4 / 71.1 | 3.58 | 14.3 |
| courtyard(48칸), 10000 — 거리 방식 | 128.0 | 215.2ms | 35.2 / 80.2 / 45.0 / 54.8 | 4.65 | 18.6 |
| snow_step(38칸), 10000 — 거리 방식 | 101.3 | 271.8ms | 44.4 / 101.3 / 56.8 / 69.3 | 3.68 | 14.7 |
| garden_u, 서리 감속 50% — 거리 방식 | 53.3 | 516.4ms | 84.4 / 192.4 / 108.0 / 131.6 | 1.94 | 7.7 |

- 디딤 내려앉음(눌림 0.96)은 주기 위치 0.082와 0.582에서 가장 깊다(garden_u 기준 21ms, 150ms). 지나감 프레임 가운데에서는 1.0이다.
- 피격 눌림(squashY): 0ms 0.880, 17ms 0.917, 33ms 0.946, 50ms 0.970, 67ms 0.987, 83ms 0.997, 100ms에 해제.

## 6. REQUESTED_CONTRACT_CHANGE — 렌더러 연결 (BattleScene.ts, assets.ts, manifest)

허용 경로 밖이라 고치지 않았다. 아래 네 가지가 들어가야 피격 그림이 나오고, 감속·맵 길이와 상관없이 미끄럼이 0이 된다.

```ts
// BattleScene.ts — EnemyView에 hitAt: number | null(초깃값 null) 추가
import { acceptsHit, enemyPose, HIT_MS } from './animation/pose';

// onEvents의 'hit': 같은 적 효과는 120ms 안에 다시 시작하지 않는다(PRD §11.4)
if (v && acceptsHit(v.hitAt, this.time.now)) { v.hitAt = this.time.now; v.flashUntil = this.time.now + HIT_MS; }

// syncEnemies: 걸음은 보간 진행도(거리)로, 피격은 경과 시간으로 넘긴다
const pose = enemyPose({ kind: e.kind, phase: v.phase, time: time / 1000, speedBP: e.speedBP, moving, frames: this.frameCount(e.kind),
  reducedMotion: this.bridge.reducedMotion, distance: toWorld(progress), ...(v.hitAt === null ? {} : { hitAge: (time - v.hitAt) / 1000 }) });
const hitKey = `enemy.${e.kind}.hit`;
v.sprite.setTexture(pose.hit && this.textures.exists(hitKey) ? hitKey : `enemy.${e.kind}.${pose.frame}`) // 이하 setPosition… 그대로
```

1. **`distance: toWorld(progress)`**
   - 이유: 지금 `e.speedBP`에는 서리 감속이 빠져 있다. 시간 방식은 맵 길이(37~48칸)도 알 수 없다.
   - 영향: 감속 중 걸음이 느려지고 모든 맵에서 미끄럼이 0이 된다. 판정·진행도에는 영향이 없다.
2. **`hitAge` 전달과 `acceptsHit`**
   - 이유: 피격 눌림을 화면에 내고, 최소 간격 120ms를 지키기 위해서다.
   - 영향: 지금 흰색 점멸도 120ms 간격을 따르게 된다.
3. **`enemy.walker.hit` 사용**
   - 할 일: 전투 화면 확인 뒤 manifest 상태를 `integrated_pass`로 올린다. 그러면 `applyManifest`가 싣는다. `frameCount`는 숫자 프레임만 세므로 hit 텍스처가 있어도 걷기 프레임 수는 4 그대로다.
   - 영향: 그림이 없는 종류는 `textures.exists`에서 걸러진다.
4. **`assets.ts`의 적 기준점**
   - 할 일: `ASSETS.enemy`의 originY 0.78을 manifest 값(0.75)으로 덮도록 한다(`applyManifest`의 enemy 분기에서 originX/originY도 반영).
   - 이유: 지금은 발이 기준점보다 1.38 월드px 위에 있다. 일정한 값이라 프레임 간 흔들림은 없지만, 눌림 기준이 발보다 아래가 되어 피격 눌림 때 발이 최대 0.17px 내려간다. 0.75면 정확히 0이 된다.
   - 영향: 고블린이 1.38px 내려가 보인다. 렌더러의 `CELL_PX * 0.14` 보정과 함께 다시 맞춰야 한다.

## 7. 실제 크기·확대 캡처(접촉판)

이 세션은 데스크톱 앱 창에 열려 있지 않아 브라우저 창을 앞에 둘 수 없었다. 브라우저 창이 가려져 있으면 게임이 정지하는 것이 정상이다. 그래서 같은 dev 서버(5173, 이 폴더의 `npm run dev`)에 Playwright 헤드리스 Chromium(1440×900, DPR 1)을 붙여 찍었다. 캡처 파일은 허용 경로 밖이라 저장소에 넣지 않았다.

| 파일 | 내용 | sha256 |
|---|---|---|
| `/private/tmp/claude-501/-Users-bodyking--claude-spares-spare-lY0E1E/46716f3b-36b2-4c02-a8c5-72a25f342947/scratchpad/captures/game-1440x900.png` | 실제 게임 1웨이브 전체 화면(칸 72.4px) | `217d71e0d34212d7668e94380c2da443cff65ee23cc3067a1b9fadf705812697` |
| `/private/tmp/claude-501/-Users-bodyking--claude-spares-spare-lY0E1E/46716f3b-36b2-4c02-a8c5-72a25f342947/scratchpad/captures/game-strip.png` | 첫 구간 연속 캡처 14장(약 33ms 간격). 실제 크기 + 앞쪽 3.5칸 3배 확대 | `80f26306d3076e64e0efa2498b83b20d335328262f1aef520b6a4937a5055191` |
| `/private/tmp/claude-501/-Users-bodyking--claude-spares-spare-lY0E1E/46716f3b-36b2-4c02-a8c5-72a25f342947/scratchpad/captures/pose-sheet.png` | dev 서버가 변환한 `pose.ts`와 납품 PNG를 렌더러 변환(원점 0.78, 0.72셀)으로 그린 접촉판. 한 주기 16표본(60fps) 실제 크기·3배, 피격 7표본(enemy.walker.hit) 실제 크기·3배. 빨강은 지면선, 파랑은 디딘 발이 있어야 할 곳. | `da39d501a6fc4ee98174a558f554b5f8579fb2eaffcd6ebde4c6203376e16ea7` |

- 다시 만드는 명령: `node /private/tmp/claude-501/-Users-bodyking--claude-spares-spare-lY0E1E/46716f3b-36b2-4c02-a8c5-72a25f342947/scratchpad/capture.mjs <출력폴더> 1500` (dev 서버가 5173에 떠 있어야 한다).
- 확인한 것:
  - 걷기: 프레임마다 발이 지면선에 붙어 있고, 파랑 표시가 디딘 발 아래를 지나 다음 프레임의 뒷발로 이어진다.
  - 피격: 피격 그림의 발도 같은 선에 있다.
  - 실제 게임: 캡처마다 발 높이가 같은 줄이고 디딤·지나감이 번갈아 보인다.

## 8. 실행 검사

| 명령 | 결과 |
|---|---|
| `npx vitest run tests/unit/animation.test.ts` (고치기 전 pose.ts) | 동작 시험 6개 실패, 원화 대조 2개 통과(빨강 확인). 실패 내용: 미끄럼 7.66px, bob 2.09px, `hit` 없음, 거리 무시 |
| `npx vitest run tests/unit/animation.test.ts` (고친 뒤) | 8 passed |
| `npm run typecheck` | 오류 출력 없이 끝남. 파이프 뒤에서 실행해 exit 값은 `tail`의 것이다. |
| `npx eslint src/game/animation tests/unit` | exit 0 |
| `npm test` | Test Files 15 passed, Tests 69 passed, exit 0 |
| `npm run test:e2e` (5173 = 이 폴더의 dev 서버를 재사용) | 4 passed (51.6s), exit 0 |

- 재사용: 없음.
- 미실행:
  - 사람 눈으로 앞 창에서 보는 확인(창을 앞에 둘 수 없어 헤드리스로 대신했다).
  - 위/아래 구간과 꺾임의 접촉판(V07 "네 방향 꺾임"). 이번 캡처는 오른쪽 직선 구간만이다.

## 9. 알려진 결함·잔여 위험

1. **시간 방식의 미끄럼**(§6-1 연결 전까지)
   - 서리 감속 중에는 몸이 느려져도 걸음은 그대로라 발이 뒤로 미끄러진다.
   - 3학년이 아닌 맵에서는 한 주기마다 어긋난다: river_z −2.1px, snow_step −1.4px, courtyard +5.5px.
2. **걸음이 빠르다**
   - garden_u에서 초당 3.9주기(프레임 교체 15.5회)다. 원화 걸음 폭(0.43칸)에 비해 이동 속도(1.67칸/초)가 빨라서다. 실제 크기에서는 종종걸음으로 읽힌다.
   - 더 느긋한 걸음을 원하면 속도가 아니라 원화 쪽에서 보폭이 긴 프레임이 필요하다(ART 작업 몫).
3. **위/아래 이동**
   - 측면 보행 그림을 마지막 좌우 방향 그대로 쓴다. PRD §11.3이 요구하는 위/아래 구분 검토와, 필요하면 추가 제작은 원화 작업 몫이다.
4. **원화 1px 차이**
   - 프레임 2의 앞발만 가장 아래 행이 94다(다른 접지 발은 95). 디딤 순간 발끝이 1 원본px(0.36 월드px) 떠 보일 수 있다.
5. **보행표는 r1 원화 기준이다**
   - revision이 바뀌면 `gait.ts` 표를 다시 재야 한다. 그때 `animation.test.ts`의 원화 대조 시험이 실패해서 알려 준다.

## 10. 통합 방법

- 적용 대상: 위 세 파일. 다른 작업 패키지와 겹치는 파일은 없다.
- 의존: `gait.ts`는 `../assets`의 `CELL_PX`·`ENEMY_DISPLAY`를 읽기만 한다.
- 롤백: `pose.ts`를 baseCommit 판으로 되돌리고 `gait.ts`·`animation.test.ts`를 지우면 된다.
- 다음 첫 행동: 총괄이 §6의 BattleScene 연결(`distance`·`hitAge`·`acceptsHit`·hit 텍스처)을 넣고, 서리탑 감속 중인 고블린의 접촉판을 다시 찍는다.
