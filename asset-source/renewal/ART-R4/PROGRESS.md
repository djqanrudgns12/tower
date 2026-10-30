# ART-R4 진행 기록

- 시작: 2026-10-31T07:04:48.697941+09:00
- 브랜치 `renewal/hub`, HEAD `52c6adfdeae11179ac5d50eb377b8815486b8727`. 시작 상태: 기존 `tools/__pycache__/`만 미추적.
- 요청서·카탈로그·아트 관문·기존 접촉판·41번 참조 확인 완료.
- 신규 본체 10종 + 분리 무기 4종 + 회전 날개 1종을 생성한다. wind는 요청서의 분리 회전층을 따른다(카탈로그 §0의 본체 1층 설명과 다름).
- ART-R3 prepare.py·save-generation.py를 이 폴더로 복사하여 재사용. 신규 타워이므로 기존 타워 하단 복제 규칙만 제외하고 알파 보존·비율 유지·접촉판·해시 기록을 계승한다.
- 검증 예산: 생성 후 PNG 측정, 최종 로스터 시각 검수, 인계 전 규격/원본/범위 검증 1회. 앱 build/e2e 미실행(앱 코드 변경 없음).

- 1차 3종 원화 저장: ballista·falcon 후보, sling 1차 자체 반려(기둥 대신 네 다리 데크). sling 재생성 예정.
- 2026-10-31T07:09:12+09:00: `tower.roller` 1차 원본 저장 → `sources/tower.roller.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:09:12+09:00: `tower.hwacha` 1차 원본 저장 → `sources/tower.hwacha.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:09:12+09:00: `tower.mortar` 1차 원본 저장 → `sources/tower.mortar.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:09:12+09:00: `tower.sling` 2차 원본 저장 → `sources/tower.sling.attempt2.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:11:56+09:00: `tower.bell` 1차 원본 저장 → `sources/tower.bell.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:11:56+09:00: `tower.wind` 1차 원본 저장 → `sources/tower.wind.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:11:56+09:00: `tower.alchemist` 1차 원본 저장 → `sources/tower.alchemist.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:11:56+09:00: `tower.trap` 1차 원본 저장 → `sources/tower.trap.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:14:17+09:00: `tower.hwacha.weapon` 1차 원본 저장 → `sources/tower.hwacha.weapon.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:14:17+09:00: `tower.mortar.weapon` 1차 원본 저장 → `sources/tower.mortar.weapon.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:14:17+09:00: `tower.sling.weapon` 1차 원본 저장 → `sources/tower.sling.weapon.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:14:17+09:00: `tower.ballista.weapon` 1차 원본 저장 → `sources/tower.ballista.weapon.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 본체 10종 원화 확보. 무기1차4종 중 ballista·mortar 반려: alphaMax254 및 주변 헤이즈. 원본/실패를 보존하며 도구 편집으로 깨끗한 알파 재생성. sling·hwacha는 실제 기계 중심을 (96,96)에 두는 좌표와 축소 비율을 기록.
- 2026-10-31T07:16:50+09:00: `tower.ballista.weapon` 2차 원본 저장 → `sources/tower.ballista.weapon.attempt2.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:16:50+09:00: `tower.wind.weapon` 1차 원본 저장 → `sources/tower.wind.weapon.attempt1.generated.png`. 후보 상태, 축소/합성 검수 전.
- 2026-10-31T07:16:50+09:00: `tower.mortar.weapon` 2차 원본 저장 → `sources/tower.mortar.weapon.attempt2.generated.png`. 후보 상태, 축소/합성 검수 전.
