# 리뉴얼 헌장 (R-2026-10)

총괄: Claude 세션 「게임 화면 디자인 고도화 전략」 · 통합 브랜치 `renewal/hub` (작업 폴더 `../tower-wp/RENEWAL`) · 시작 2026-10-30

이 폴더가 리뉴얼의 단일 기준이다. 기존 PRD v0.5와 충돌하면 이 폴더가 우선한다. PRD 본문 반영은 다른 총괄(PRD 복구, WP-*)의 수합 뒤 사용자 확인을 받아 한다.

## 1. 사용자 결정 (2026-10-30)

| 영역 | 결정 |
|---|---|
| 화풍 | 41번 「왕국 원정대」 유지. 새 시안 없이 **41번 원화 수준의 자연스러움·완성도까지 고도화**. 복잡하지 않게. AI slop 0 |
| 타워 성장 | Lv1~3 기본형 → **Lv4 1차 진화(A/B)** → **Lv7 2차 진화(길마다 2갈래)**. 레벨은 무제한이되 상한은 설정으로 조절. 밸런스 검증 필수 → [progression.md](progression.md) |
| 타워 종류 | 10종에서 **대폭 확대**(1차 목표 20종) → [catalog/towers.md](catalog/towers.md) |
| 몬스터 | **다양한 종족, 궁극적으로 매우 많이**. 능력은 적게, 얼굴(종족)은 많이 → [catalog/monsters.md](catalog/monsters.md) |
| UI 규정 | PRD §12.8을 **합리적으로 완화** → [ui-rules-v2.md](ui-rules-v2.md) |
| UI/UX | 패널이 촌스러움 → **전면 리뉴얼**. 단, 절대 복잡해지지 않게 |
| 편의성 | 설치 버튼 없이 바로 설치, 사이드바에서 끌어 놓아 설치, 불필요한 문구 제거, 기물 크기 조정 |
| 위임 | 브리지는 토큰 문제로 **Codex보다 Antigravity 위주**. Codex는 이미지 생성 위주로 아껴 쓴다 |

## 2. 컨셉: 살아 있는 원정 지도

한 판 = 한 지역 원정. 지역마다 맵·종족·대장·색감이 한 세트다.

- **세계가 살아 있다**: 움직이는 풍경, 시간 흐름(아침→노을→밤), 지역마다 다른 경치
- **성장이 눈에 보인다**: 3단 진화, 진화 연출, 선택 카드에 진화 후 모습
- **공부가 힘이 된다**: 정답 → 금화 → 타워 강화가 화면에서 한 줄로 이어짐

## 3. 작업 흐름(스트림)과 소유

| 스트림 | 담당 | 브랜치 | 소유 경로 |
|---|---|---|---|
| R0 총괄 | 이 세션 | `renewal/hub` | `docs/renewal/**`, `asset-source/renewal/**`, 통합·검수 |
| R1 전투 UI/UX·편의성 | 별도 Claude 세션 | `renewal/ui` 계열 | `src/ui/game/**`, `src/ui/styles/global.css`, `src/ui/kit.module.css`, `src/ui/icons/**`, `src/ui/useLayout.ts`, `src/application/view.ts`, `src/game/BattleScene.ts`의 입력·선택 표시 부분, 관련 시험 |
| R2 엔진(성장·진화·종족·신규 타워 규칙) | 별도 Claude 세션 | `renewal/core` 계열 | `src/contracts/balance.ts`, `src/domain/{towers,waves,combat,run,types}.ts`, `docs/contracts/balance.candidate*.json`, `tools/balance-sim.mjs`, `tools/sim/**`, 관련 시험 |
| R3 아트 생산 | 총괄 지휘, Codex 이미지 생성 | `renewal/hub` | `asset-source/renewal/**` → 인수 후 `public/assets/**` |
| R4 카탈로그 설계 | Antigravity | `renewal/hub` | `docs/renewal/catalog/**` (총괄이 큐레이션) |

- 다른 총괄의 WP-UI·WP-CORE와 겹치는 파일(`src/ui/game/**`, `run.ts`, `types.ts` 등)은 **브랜치에서만** 고친다. 메인 체크아웃(`p1/intake-round1`)으로의 병합은 그쪽 수합 뒤 총괄끼리 맞춘다.
- 두 세션이 같은 파일을 동시에 고치지 않는다. 경계 파일(`ManagementPanel.tsx`가 R2 API를 부르는 부분 등)은 [progression.md §5](progression.md)의 API 계약으로만 맞닿는다.
- 메인 체크아웃의 미커밋 NEIS 변경은 **사용자 본인 작업**이다. 건드리지 않는다.

## 4. 단계

| 단계 | 내용 | 끝 기준 |
|---|---|---|
| R-1 기반 | UI 규정 v2, 성장·진화 엔진, 전투 UI 골격과 편의성, 정원 맵 아트 고도화, 기존 3종의 진화 그림 | 정원 맵 1판을 새 화면으로 끝까지 플레이할 수 있음, verify 통과, 밸런스 시뮬레이션 기준 통과 |
| R-2 확장 | 타워 20종 규칙과 그림, 4지역 맵과 4종족 | 4맵 모두 새 아트, 웨이브 2~3마다 새 얼굴 |
| R-3 대량 | 확장 종족 팩, 도감, 무한 후반 침입 순환 | 종족 팩을 데이터+그림만으로 추가할 수 있음 |
| R-4 다듬기 | 소리·연출·성능·실기기 | 사용자 확인 |

## 5. 품질 관문 (AI slop 차단)

1. **화면 관문**: 1440×900과 390×844에서 실제 크기 캡처. 다른 에이전트(Antigravity)와 총괄이 [ui-rules-v2.md](ui-rules-v2.md) §3 체크리스트로 따로 본다.
2. **아트 관문**: 32/48/64px 축소, 기존 인수 그림과 나란히, 밝은/어두운 배경 알파 가장자리 확인. 기준은 [art-bible-v2.md](art-bible-v2.md) §5.
3. **규칙 관문**: `npm run verify`, 밸런스 시뮬레이션(`npm run simulate:balance`, `simulate:towers`)의 기준 유지.
4. **복잡도 관문**: 전투 화면에서 한 번에 보이는 문구 수와 버튼 수를 세어 이전보다 늘지 않게 한다.
5. 에이전트 보고는 동료 보고다. 파일·diff·실행 결과로 확인한 뒤 수합한다.
