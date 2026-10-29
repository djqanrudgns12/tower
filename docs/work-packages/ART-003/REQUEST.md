# ART-003 — P2 타워 7종 원화(몸체·무기 13장, Codex 이미지 생성)

```yaml
jobId: ART-003
status: READY
owner: Codex (총괄이 agent-bridge로 깨워 네 번에 나눠 전달. 브리지 실행은 15분 상한)
commander: Claude Opus 5.5 (P1 첫 구현 총괄)
baseCommit: 6e9f7dbf733dbe58d80db2ce8ed40d8f67eb5db5  # 요청서는 작업 폴더에 복사했다
contractHash:  # node tools/contract-hash.mjs ART-003
  docs/assets/design-41-kingdom-expedition.png: 5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13
  docs/style-lock-v1.md: 9cef3809c446c28e77316ca8c4ac3b2fc3f2f09e14f1c82539e7dfe604471ceb
  docs/work-packages/ART-SAMPLE-001/REQUEST.md: f6a73b45cddd06cf11de2a8f5cc088a9bcce8eb947ccd848eacd533e7c354e9d
  public/assets/manifest.json: ed85114aeb8f579edb288db960f9780886d80b53eb65b42a19e407450073a853
  public/assets/tower.archer.r1.png: cfd1931fa50088fdeb88dc62d832663315423e8ebc73063a010c48c2f0fbb335
  public/assets/tower.archer.weapon.r1.png: c60f46f52da895da6206e57d05ac8eb3a26f6f152f4e47dd27c48bbecd4d1217
  public/assets/tower.cannon.r1.png: 6e76d4febf6c9472369e7d7f0418c0f7c0a8abc4f73e3ddb4a889270baedc776
  public/assets/tower.frost.r1.png: 692b0858b3947d107245445e611c84cb85489cf6c0a9c597ea72e0dd24b4cf1d
  asset-source/incoming/ART-SAMPLE-001/contact-sheet.png: a2832f8430b8c2be652facbbd89f72c077c284e186e8ee8068b562cc68c3d05d
inputFiles:
  - docs/assets/design-41-kingdom-expedition.png
  - docs/style-lock-v1.md
  - docs/work-packages/ART-SAMPLE-001/REQUEST.md
  - public/assets/manifest.json
  - public/assets/tower.archer.r1.png
  - public/assets/tower.archer.weapon.r1.png
  - public/assets/tower.cannon.r1.png
  - public/assets/tower.frost.r1.png
  - asset-source/incoming/ART-SAMPLE-001/contact-sheet.png
allowedPaths:
  - asset-source/incoming/ART-003/**
  - docs/work-packages/ART-003/RETURN.md
forbiddenPaths:
  - src/**, public/**, 다른 asset-source/incoming 폴더(읽기만), docs/**(자기 RETURN 제외), package.json
deliverable: 아래 표의 PNG 13장 + manifest.json + contact-sheet.png(32/48/64px) + RETURN.md
returnPath: docs/work-packages/ART-003/RETURN.md
```

## 왜 지금

P1 타워 3종(궁수·포탑·서리)은 원화로 게임에 들어갔다. P2는 나머지 7종(PRD §7.1)을 전투에 넣는다. 총괄이 엔진에 즉발 공격·연쇄·화상·오라를 붙이는 동안 원화를 같이 만든다.

규격·화풍·납품 형식·자체 확인은 [ART-SAMPLE-001 요청서](../ART-SAMPLE-001/REQUEST.md)와 같다.

- 몸체: 192×192, 기준점 (0.5, 0.8125)이고 바닥 중심이 (96,156)이다. displayCells 1.10, layer body다.
- 무기: 192×192, 기준점 (0.5, 0.5)이 회전축이다. displayCells 0.80, layer weapon이다. 오른쪽(+x)을 보고, `muzzle`은 발사·타격 끝점이다.
- 실제 RGBA 알파로 만든다. 못 만들면 HOLD로 둔다.
- 글자·문양·보석·발광·형광색은 넣지 않는다.

**가장 중요한 것은 역할이 실루엣으로 구별되는 것이다**(PRD §11.1·§11.2). 전체 지도 48px에서 10종이 이름 없이 구별되어야 하고, 모든 타워가 같은 탑에 색만 다르면 반려한다. 기존 3종(public/assets/tower.*.r1.png)과 나란히 놓아 확인한다.

## 납품 목록

| id | 내용(역할이 보이는 실루엣) | muzzle |
|---|---|---|
| `tower.crossbow` | 두꺼운 석재 받침 위 낮고 넓은 목재 포대. 궁수탑보다 무겁고 낮다 | — |
| `tower.crossbow.weapon` | 오른쪽을 보는 큰 석궁(쇠뇌). 시위·화살대가 보인다 | 화살촉 |
| `tower.mage` | 둥근 석탑, 보라 원뿔 지붕, 작은 창. 궁수탑 망루와 확실히 다른 원기둥 | — |
| `tower.mage.weapon` | 떠 있는 보라 수정구와 작은 청동 고리. 회전해도 모양이 같다 | 수정구 앞쪽 |
| `tower.lightning` | 석재 받침 위 청동 기둥과 감긴 구리선 | — |
| `tower.lightning.weapon` | 기둥 꼭대기의 구리 구슬과 짧은 가지 셋(번개를 쏘는 끝). 회전하지 않아도 어색하지 않다 | 구슬 |
| `tower.flame` | 넓은 석재 화로 받침. 짙은 붉은 벽돌 | — |
| `tower.flame.weapon` | 오른쪽을 보는 청동 분사구(용 머리처럼 둥근 입, 불꽃은 그리지 않는다) | 입 |
| `tower.spear` | 나무 말뚝 울타리로 둘러싼 낮은 초소(근접 길목용) | — |
| `tower.spear.weapon` | 오른쪽을 향한 긴 창 한 자루. 회전축(가운데)에서 손잡이가 시작한다 | 창끝 |
| `tower.guardian` | 둥근 석재 받침 위 갑옷 기사(오른쪽 3/4, 방패를 든 몸, 칼은 그리지 않는다). 정면 인물 금지 | — |
| `tower.guardian.weapon` | 오른쪽을 향한 칼 한 자루. 회전축(가운데)이 손잡이다 | 칼끝 |
| `tower.banner` | 공격하지 않는 깃발 초소. 나무 기둥에 큰 파란 깃발(성문·입구 깃발과 같은 파랑), 받침 돌. 무기 없음 | — |

- 같은 타워의 몸체와 무기는 겹쳐 놓았을 때 크기·광원·외곽선이 맞아야 한다.
- 무기는 몸체 위 0.32칸 위치에서 회전한다. 게임의 실제 겹침은 ART-SAMPLE-001 규칙과 같다.

## 네 번에 나눈다

| 실행 | 만들 것 |
|---|---|
| 1/4 | crossbow·mage 몸체와 무기(4장). 시작 확인과 기준 이미지 확인 포함 |
| 2/4 | lightning·flame 몸체와 무기(4장) |
| 3/4 | spear·guardian 몸체와 무기, banner 몸체(5장) |
| 4/4 | manifest.json(13장, status draft), contact-sheet.png(기존 3종 포함 10종을 32/48/64px로), `npm run validate:assets`, RETURN.md |

각 실행은 `asset-source/incoming/ART-003/PROGRESS.md`에 장마다 생성 방식·실제 모델명·재생성 횟수·원본·HOLD를 적고 다음 실행이 이어 간다.

## RETURN.md에 쓸 것

ART-SAMPLE-001과 같다. 더해서 쓸 것:

- 10종 실루엣 구별을 어떻게 확인했는지(48px 판)
- 네 번에 나눠 실행했다는 사실

생성 성공을 visual_pass로 적지 않는다.
