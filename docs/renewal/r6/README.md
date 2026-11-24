# R6 디자인 대개편 · 아트 디렉션 시안 5종 비교판

> 상세 조사 및 선정 근거는 [research.md](research.md), 각 시안의 팔레트·모션·양산 공수·체크리스트는 `concepts/C1~C5/concept.md` 참조.  
> 모든 한글 UI는 실제 상업 무료 웹폰트 기반 HTML/CSS(`concepts/*/mock/`)로 합성 후 Playwright(1280×720)로 캡처했으며, 생성 원화 내부의 가짜 문자·블룸 등 AI slop 요소를 전면 제거했습니다.

---

## 1. 한눈에 보는 5종 비교 요약

| ID | 콘셉트 & 파이프라인 | 한 줄 요약 | 핵심 장점 | 주요 주의점 | 양산 공수 · 크롬북 | 시안 용량 | 추천 |
|---|---|---|---|---|---|---|---|
| **C1** | **미니어처 블록 공방**<br>*(Tripo 3D → Blender 정투영 사전 렌더)* | 무광 나무·점토 미니어처 보드게임 디오라마 | 압도적 입체감, 단층 지형·그림자 위계, 48px 원색 지붕 식별성 최상 | 초기 Blender 씬/조명 리그 고정 및 Tripo 메시 정리 필요 | 17~20일<br>초기 ≤ 2.4MB · 60fps | 716 KB | 보드게임 감성 최상 |
| **C2** | **네오 포스터 아케이드**<br>*(순수 2D SVG/벡터 + 트윈)* | 2단 플랫 색면과 3px 잉크선의 그래픽 포스터 | 가장 빠르고 가벼운 양산, HiDPI 무손실, 퀴즈 가독성 최상 | 평면적이라 모션·파티클 연출을 풍부히 보완해야 함 | **14~16일**<br>**≤ 1.4MB · 60fps** | 976 KB | 속도/성능 1순위 |
| **C3** | **단청 모던 민화**<br>*(순수 2D 먹선+광물 채색 + Spine 2D)* | 밝은 한지 위 먹선과 오방색을 힙하게 재해석한 K-전략 | 우리말 어휘와 100% 맞물리는 유일무이 브랜드 정체성, 눈 피로 최저 | AI 보조 시 가짜 한자/낙관/어두운 톤 철저 차단 필요 | 20~23일<br>≤ 2.2MB · 60fps | 1,316 KB | **2순위 추천** (브랜드 차별화) |
| **C4** | **하이퍼 팝 아케이드**<br>*(2D 셀 셰이딩 + Spine/VFX 아틀라스)* | 브롤스타즈·쿠키런급 셀 셰이딩 치비 + 폭발적 손맛 VFX | **3~6학년 시선·몰입·도파민 최강**, 표정과 콤보 코인 연출 압도적 | 캐릭터·표정 작업량 최다, 바닥 단순화·블룸 금지 준수 | 22~25일<br>≤ 2.6MB · 60fps | 1,260 KB | **1순위 추천** (종합 1위) |
| **C5** | **팝업 종이 극장**<br>*(순수 2D 레이어드 페이퍼 + 시차)* | 300gsm 색지를 칼로 오려 4~5층으로 쌓은 팝업 그림책 | 독창적인 종이 공예 손맛, 층간 그림자가 자동 위계 형성 | 그림자 겹침이 어두워지지 않도록 알파 제한 필요 | 18~20일<br>≤ 2.0MB · 60fps | 808 KB | 독창적 동화 공예 |

---

## 2. 시안별 키아트 비교 (전투 · 홈 · 궁수탑 진화 · 몬스터 · UI · 도파민)

### C1 · 미니어처 블록 공방 (`Tripo 3D → Blender`) — [상세 문서](concepts/C1/concept.md)
| 전투 화면 (`a-battle`) | 홈 화면 (`b-home`) | 궁수탑 3단계 (`c-tower-evolution`) |
|---|---|---|
| ![C1 전투](concepts/C1/a-battle.webp) | ![C1 홈](concepts/C1/b-home.webp) | ![C1 진화](concepts/C1/c-tower-evolution.webp) |
| 몬스터 5종 (`d-monster-pack`) | UI 키트 (`e-ui-kit`) | 도파민: 진화 팝업 (`f-dopamine`) |
| ![C1 몬스터](concepts/C1/d-monster-pack.webp) | ![C1 UI](concepts/C1/e-ui-kit.webp) | ![C1 도파민](concepts/C1/f-dopamine.webp) |

### C2 · 네오 포스터 아케이드 (`순수 2D SVG/벡터`) — [상세 문서](concepts/C2/concept.md)
| 전투 화면 (`a-battle`) | 홈 화면 (`b-home`) | 궁수탑 3단계 (`c-tower-evolution`) |
|---|---|---|
| ![C2 전투](concepts/C2/a-battle.webp) | ![C2 홈](concepts/C2/b-home.webp) | ![C2 진화](concepts/C2/c-tower-evolution.webp) |
| 몬스터 5종 (`d-monster-pack`) | UI 키트 (`e-ui-kit`) | 도파민: 5연속 피버 (`f-dopamine`) |
| ![C2 몬스터](concepts/C2/d-monster-pack.webp) | ![C2 UI](concepts/C2/e-ui-kit.webp) | ![C2 도파민](concepts/C2/f-dopamine.webp) |

### C3 · 단청 모던 민화 (`순수 2D 먹선+채색`) — [상세 문서](concepts/C3/concept.md) · **추천 2순위**
| 전투 화면 (`a-battle`) | 홈 화면 (`b-home`) | 궁수탑 3단계 (`c-tower-evolution`) |
|---|---|---|
| ![C3 전투](concepts/C3/a-battle.webp) | ![C3 홈](concepts/C3/b-home.webp) | ![C3 진화](concepts/C3/c-tower-evolution.webp) |
| 몬스터 5종 (`d-monster-pack`) | UI 키트 (`e-ui-kit`) | 도파민: 웨이브 승리 (`f-dopamine`) |
| ![C3 몬스터](concepts/C3/d-monster-pack.webp) | ![C3 UI](concepts/C3/e-ui-kit.webp) | ![C3 도파민](concepts/C3/f-dopamine.webp) |

### C4 · 하이퍼 팝 아케이드 (`2D 셀 셰이딩 + VFX`) — [상세 문서](concepts/C4/concept.md) · **추천 1순위**
| 전투 화면 (`a-battle`) | 홈 화면 (`b-home`) | 궁수탑 3단계 (`c-tower-evolution`) |
|---|---|---|
| ![C4 전투](concepts/C4/a-battle.webp) | ![C4 홈](concepts/C4/b-home.webp) | ![C4 진화](concepts/C4/c-tower-evolution.webp) |
| 몬스터 5종 (`d-monster-pack`) | UI 키트 (`e-ui-kit`) | 도파민: 5연속 콤보 (`f-dopamine`) |
| ![C4 몬스터](concepts/C4/d-monster-pack.webp) | ![C4 UI](concepts/C4/e-ui-kit.webp) | ![C4 도파민](concepts/C4/f-dopamine.webp) |

### C5 · 팝업 종이 극장 (`순수 2D 레이어드 페이퍼`) — [상세 문서](concepts/C5/concept.md)
| 전투 화면 (`a-battle`) | 홈 화면 (`b-home`) | 궁수탑 3단계 (`c-tower-evolution`) |
|---|---|---|
| ![C5 전투](concepts/C5/a-battle.webp) | ![C5 홈](concepts/C5/b-home.webp) | ![C5 진화](concepts/C5/c-tower-evolution.webp) |
| 몬스터 5종 (`d-monster-pack`) | UI 키트 (`e-ui-kit`) | 도파민: 팝업 승리 (`f-dopamine`) |
| ![C5 몬스터](concepts/C5/d-monster-pack.webp) | ![C5 UI](concepts/C5/e-ui-kit.webp) | ![C5 도파민](concepts/C5/f-dopamine.webp) |

---

## 3. 원본 이미지 보관 경로 (커밋 제외)

저장소 용량 및 PNG 배제 규칙에 따라, 생성 원본 파일(25종)은 에이전트 로컬 브레인 디렉터리에만 보관하고 저장소에는 `cwebp -q 90` 결과물만 커밋했습니다.

- **원본 보관 경로**: `/Users/bodyking/.gemini/antigravity-cli/brain/89ebb9fb-bc34-4130-896e-ac7d6f21db40/r6-originals/C1~C5/`
- **HTML 목업 소스**: `docs/renewal/r6/concepts/C1~C5/mock/{battle,home,tower-evo,monster-pack,ui-kit,dopamine}.html`
