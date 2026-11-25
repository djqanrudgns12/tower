# R6 G1 잔여① 타워 3종 · 부품 분해도 검수 · 비평 보고서

- 검수 일시: `2026-11-25 11:21 KST`
- 단일 기준: `docs/renewal/r6/PRD-r6.md` §2·§3·§8 G1, 화풍 `docs/renewal/r6/round3/concepts/R04/`
- 대조 레퍼런스: 확정 3D 렌더(`docs/renewal/r6/tech/towers/{mortar,rail,cryo}/*-review.webp`, `test-results/r6-towers/lv20-attack.webp`) 및 `docs/renewal/r6/tech/towers/mortar/review.md`
- 상태: **시트 4종 WebP 생성·6종 Lv20 48px IoU 전 15쌍 PASS (`≤ 0.5175 < 0.55`) · 최종 4장 중 3장 합격(`prism`·`hangar`·`parts-exploded`), 1장(`bastion`)은 HTTP 429 할당량 차단으로 리셋(`~15:51 KST`) 후 원화 통합 기단 보강 대기**

---

## 1. 후보 원화 3안+ 실루엣 선별 결과 (총 19장 생성 → 4장 채택)

*(탈락 시안 및 생성 원본 JPG/PNG는 저장소 외 로컬 스크래치에만 보관, 저장소 내 PNG 0건)*

| 대상 | 최종 채택안 | 선별 근거 및 탈락 사유 |
|---|---|---|
| `prism` 프리즘 탑 | **`prism_v2`** | 3/4 부감 삼각 기단 투시가 Lv1·6·18·20에서 안정적이며, 앰버 다면체 결정+4위성+상공 금테 광학 링이 48px에서도 즉시 판독됨. (`prism_v1`: 정면 아이레벨 앙각으로 아트 디렉터 1차 반려, `prism_v3`: Lv20 위성 수정이 하단에 몰림) |
| `hangar` 드론 격납고 | **`hangar_v3`** | 발진 레일·진입 경사로·방풍 벽·우측 격자 마스트·갑판 직상부 부유 드론 1~4기+Lv20 앰버 육각 유도선이 기계적 밀도와 48px 시인성을 동시에 확보. (`hangar_v1`: `mortar`와 IoU `0.5938` 초과 탈락, `hangar_v2`: 하단 중복 행 생성 탈락, `hangar_fix_v1~v3`: 드론 고공 분리·빈 판자로 1차 비평 반려) |
| `bastion` 방벽 기지 | **`bastion_fix_v2`** *(임시 채택)* | 개방형 L자 실루엣과 4단계 재질(강철→합금→세라믹 틸 띠→금테+4중 충격 방벽) 덕분에 6종 전 쌍 IoU `≤ 0.3538`로 실루엣 분리는 최상. (`bastion_v1~v3`: `mortar`/`cryo`와 IoU `0.5547~0.7507` 초과 탈락, `bastion_fix_v1`/`v3`: 색감·재질 일관성 저하) |
| `parts-exploded` 부품 분해도 | **`parts_v2`** | `base`·`mark`(상하 링)·`body`(유압 코어)·`armor`·`turret`(베어링 포두)·`weapon`·`deco` 7슬롯 수직 층 분리가 가장 명쾌하며 텍스트·화살표 0건. (`parts_v1`: 장갑판 4개가 body·turret 경계에 걸침, `parts_v3`: 하단 링이 기단 외곽에 붙어 분리 약함) |

---

## 2. 비평가 2명 병렬 검수 이력 (1차 → 보정 → 최종 재검수)

### 2.1 1차 검수 결과 (보정 전)
| 시트 | 아트 디렉터 (≥8.0) | 초등 6학년 | 1차 판정 및 주요 지적 |
|---|---|---|---|
| `tower-prism.webp` (`prism_v1`) | **7.6 / 10** *(반려)* | **9.0 / 10** *("멋있다")* | 정면 앙각 투시, Lv12 곡선 아치·틸 선 누락, Lv14 `확장 6각 기단` 텍스트 모순, 고아 줄바꿈 |
| `tower-hangar.webp` (`hangar_fix_v3`) | **6.8 / 10** *(반려)* | **6.0 / 10** *("아쉽다")* | 빈 갑판 민무늬, Lv12(고정익)→Lv18(로터) 역행, 드론 고공 분리로 48px 점처럼 보임 |
| `tower-bastion.webp` (`bastion_fix_v2`) | **7.5 / 10** *(반려)* | **7.0 / 10** *("아쉽다")* | 전면 방벽-후방 붐 연결 기단 부재, 편심 붐 회전 표기, Lv6 좌측 단절, 고아 줄바꿈 |
| `tower-parts-exploded.webp` (`parts_v2`) | **8.4 / 10** *(합격)* | **9.0 / 10** *("멋있다")* | `전 종족`→`전 6종` 오기 정정 및 `07·mark` 지시선 여백 정돈 권장 |

### 2.2 2차 원화 재생성 시도 및 HTTP 429 차단 기록
- 1차 반려 3종(`prism_r2`, `hangar_r2`, `bastion_r2`) 원화 재생성을 3개 병렬 에이전트로 요청했으나, **`2026-11-25 11:14:03~06 KST`**에 3건 모두 `HTTP 429 RESOURCE_EXHAUSTED`로 차단됨.
- 할당량 리셋 예정 시각: **발생 시점 기준 `4h 36m 46s` 뒤 → `2026-11-25 15:51 KST` 이후**.
- 대응: 추가 생성 호출 없이 기존 19장 후보 풀을 재평가하여 `prism_v2`(3/4 부감 기단)와 `hangar_v3`(발진 레일·격자 마스트·갑판 직상부 드론)로 교체하고, 4장 HTML 문구·지시선·IoU·고아 줄바꿈을 전면 보정한 뒤 2차 재검수를 수행함.

### 2.3 최종 재검수 결과 (현재 커밋본)
| 시트 | 아트 디렉터 (≥8.0) | 초등 6학년 | 최종 판정 및 요약 |
|---|---|---|---|
| [tower-prism.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/tower-prism.webp) | **8.8 / 10** *(합격)* | **9.0 / 10** *("멋있다")* | 3/4 부감 삼각 기단·48px 즉시 판독·IoU `0.4559` 통과. (참고: Lv12 아치 기단은 Blender 모델링 시 `삼각 기단`으로 통일 권장) |
| [tower-hangar.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/tower-hangar.webp) | **8.7 / 10** *(합격)* | **8.0 / 10** *("멋있다")* | 발진 레일·격자 마스트·갑판 직상부 드론·비팔레트 `0.0%`·IoU `0.5175` 통과. (참고: Lv18 마스트는 Blender에서 격자 연속성 유지 권장) |
| [tower-bastion.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/tower-bastion.webp) | **7.5 / 10** *(반려)* | **7.0 / 10** *("아쉽다")* | 시트 편집·16방향 회전 표기·IoU `0.3538`은 통과했으나, **429 리셋 후 원화 재생성 필요**: ① 전면 방벽-후방 붐 통합 호형 기단(`base`) 연결, ② Lv6 좌측 방벽 단절 해소, ③ Lv1·Lv6·Lv18 붐 48px 엣지 대비 보강 |
| [tower-parts-exploded.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/tower-parts-exploded.webp) | **9.1 / 10** *(합격)* | **9.0 / 10** *("멋있다")* | 7슬롯 수직 분해·`07·mark` 여백·`전 6종` 정정·실측 IoU `0.5175` 동기화 완결 |

---

## 3. 6종 Lv20 48×48px 실루엣 겹침(IoU) 15쌍 전체 실측표

- 측정 도구: `tools/r6/qa/check.py` (`mask_at_48`, `silhouette_iou`, 알파 `≥ 128`, `192×192` 지면 피벗 `[96, 137]` 기준 — `rail`은 `[96, 169]`)
- 기존 3종 원본: `docs/renewal/r6/tech/towers/{rail,mortar,cryo}/manifest.json`의 `*-forms.webp` Lv20 프레임(인덱스 10)
- 통과 기준: **전 15쌍 `< 0.55`** (`rail·mortar·cryo` 3쌍 포함 전체 최대 **`0.5175` PASS**)

| 비교 쌍 | 실측 IoU | 48px 픽셀(A / B) | 판정 (< 0.55) |
|---|---:|---:|---|
| `rail` ↔ `mortar` | `0.4034` | 597 / 1,059 | **PASS** |
| `rail` ↔ `cryo` | `0.5119` | 597 / 614 | **PASS** |
| `rail` ↔ `prism` | **`0.3838`** | 597 / 427 | **PASS** |
| `rail` ↔ `hangar` | **`0.3423`** | 597 / 548 | **PASS** |
| `rail` ↔ `bastion` | **`0.3538`** | 597 / 371 | **PASS** |
| `mortar` ↔ `cryo` | `0.5140` | 1,059 / 614 | **PASS** |
| `mortar` ↔ `prism` | **`0.3849`** | 1,059 / 427 | **PASS** |
| `mortar` ↔ `hangar` | **`0.5175`** | 1,059 / 548 | **PASS** |
| `mortar` ↔ `bastion` | **`0.3478`** | 1,059 / 371 | **PASS** |
| `cryo` ↔ `prism` | **`0.4559`** | 614 / 427 | **PASS** |
| `cryo` ↔ `hangar` | **`0.3190`** | 614 / 548 | **PASS** |
| `cryo` ↔ `bastion` | **`0.2978`** | 614 / 371 | **PASS** |
| `prism` ↔ `hangar` | **`0.4487`** | 427 / 548 | **PASS** |
| `prism` ↔ `bastion` | **`0.3190`** | 427 / 371 | **PASS** |
| `hangar` ↔ `bastion` | **`0.3319`** | 548 / 371 | **PASS** |

---

## 4. R04 팔레트 · 규격 · AI 티 8항목 점검표

| 대상 시트 | 해상도 | 파일 크기 | 비팔레트 고채도 (`v>0.22, s>0.35`) | 평균 R04 거리 | 판정 |
|---|---|---:|---:|---:|---|
| `tower-prism.webp` | `1920×1080` | `116,458 B` (113.7 KB) | `0.0461%` | `36.80` | **PASS** |
| `tower-hangar.webp` | `1920×1080` | `105,026 B` (102.6 KB) | `0.0000%` | `29.62` | **PASS** |
| `tower-bastion.webp` | `1920×1080` | `101,322 B` (98.9 KB) | `0.1001%` | `36.50` | **PASS** |
| `tower-parts-exploded.webp` | `1920×1080` | `121,586 B` (118.7 KB) | `0.0112%` | `24.30` | **PASS** |

- **AI 티 8항목 점검**: R04 팔레트 이탈 없음(`≤ 0.10%`), 좌상단 단일 방향광 통일, 생성 이미지 내 깨진 텍스트 0건(Playwright HTML+SVG 합성), 반짝이·무지개·블룸·광택 0건, 사람·동물형 0건, 저장소 내 PNG 0건, PRD §2 금지어 0건.
- **429 리셋(`~15:51 KST`) 이후 남은 일**: `bastion` 원화 1종만 통합 호형 기단 연결 및 Lv6 단절 해소를 반영해 3안 재생성 후 [tower-bastion.webp](file:///Users/bodyking/Desktop/Architecture/towerdeffense/docs/renewal/r6/bible/sheets/tower-bastion.webp) 교체.
