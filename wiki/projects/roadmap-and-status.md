---
id: project-roadmap-and-status
type: project
title: 프로젝트 계보 및 현행 코드 실체 판정
status: active
updated: 2026-11-26
verified: { commit: "1a7fe4eb", date: 2026-11-27 }
sources:
  - path: package.json
    sha256: "438e5fc906d190ae6ff3e75af936f686e94d883375aff3ab996bcf06cd749d08"
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: docs/renewal/r6/PRD-r6.md
    sha256: a4bae91b43a1c2adb3a549c47b6f4250a1d6d1f45010b3facc530fdd3a7d9175
  - path: docs/renewal/r6/review/G4-towers-fix.md
    sha256: "87b41052a8a094586a2afbeb9a15a9c9a58fb17b5bf1acb6e48bc9ff893a4631"
  - path: docs/renewal/r6/tech/monster-pipeline.md
    sha256: "4ddd88e111db9d790eebe00a810a65de4dd35aaccdf0314357eaa90d24207603"
  - path: docs/renewal/r6/tech/G3-precheck.md
    sha256: "906225d8dbbf4156b53f4c1b771be93367f9fe4eb12995c8599b2f817b86db5e"
  - path: docs/renewal/r6/tech/G5-perf.md
    sha256: "16b0d22d3fe0532d0cfa718fb55e71e4b9fa7b650ca7ea5bdb5549b69914e452"
  - path: docs/renewal/r6/tech/G5-server.md
    sha256: a4dde2850b32b8b9153902259fd7a54a3d157f08e526b8e4dba0116b2a073036
  - path: docs/renewal/r6/tech/G5-readiness.md
    sha256: "907a680f8b779f86d5d56f7a97fd2a3ad3de0820d1a62c80b78e17fc3995c9f9"
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: docs/CR1000_HANDOFF.md
    sha256: c3c01581eceead622afc236790d68ce0c3f6f600317b819d9f549176dbb1707c
---

# 프로젝트 계보 및 현행 코드 실체 판정 (`roadmap-and-status`)

초기 계획 문서(`docs/EXECUTION_BOARD.md`, `docs/HANDOFF.md`)는 P1 제작 당시 스냅샷이라 현행 코드와 큰 시차가 있다. 에이전트는 아래 **실제 코드·계약 기준 완료 판정**을 따른다.

## 1. 단계별 진화 계보

| 시기 / 단계 | 핵심 목표 및 산출물 | 현재 상태 |
| --- | --- | --- |
| **1. PRD v0.1~v0.5 & P1** (10월 말) | 30Hz 도메인 엔진, 3학년 정원 맵, 기본 타워 3종, 41번 화풍 잠금 | **완료** (초기 PRD 해시 보존) |
| **2. 리뉴얼 R1~R5 (v1)** (10/30~11/04) | 타워 20종·Lv4/Lv7 갈래 진화, 종족 8종×역할 10종, 학년별 맵 4종, R4 밸런스 | **완료 · v1 보존** ([renewal/README.md](../../docs/renewal/README.md)) |
| **3. 호스팅 1.0.0 출시** (11/05) | WebP 원화 378장, 지연 적재, GitHub Pages(`voca`) + Workers/D1(`voca-api`) 운영 배포 | **운영 중 (`v1.0.0`)** ([DEPLOY.md](../../docs/DEPLOY.md)) |
| **4. CR-1000 공동검수** (11/06~11/09) | 3~6학년 자기 학년 각 1,000+ 승인(자기 **5,547문항**, 총 출제 풀 **6,583문항**) | **목표 달성 · 유지보수** ([CR1000_HANDOFF.md](../../docs/CR1000_HANDOFF.md)) |
| **5. LLM Wiki 구축** (11/16) | `wiki/` 컴파일 지식 계층, `tools/wiki/` 동기화·조회·린트·교훈 델타, `llms.txt` | **현행 운영** ([SCHEMA.md](../SCHEMA.md)) |
| **6. 학교 입장과 재방문 개선** (11/16) | 서비스워커 캐시, 교실 QR 입장, 우리 학교 랭킹 필터, `GET /v1/schools` 프록시 | **완료** (`8e02afec`) |
| **7. R6 대개편 (`balanceVersion: 2.0.0`)** (11/25~) | R04 전술 지도·UI, 타워 6종 Lv20(66형태), 몬스터 5종족×20, 초원 고원 3/4 맵, Blender/Spine 공정, 자동 화질 3단계, 시즌 2 서버 | **진행 중 · 운영 미반영** ([PRD-r6.md](../../docs/renewal/r6/PRD-r6.md)) |

## 2. R6 단계·관문 현황

| 관문 | 상태 | 완료된 산출물과 근거 | 남은 항목 |
| --- | --- | --- | --- |
| **G0 기획** | **통과** | [PRD-r6.md](../../docs/renewal/r6/PRD-r6.md), [balance.v2.json](../../docs/contracts/balance.v2.json), 한국어 이름 분리(`r6.ko.json`), 시드 혼합기(`r6-mix-1`), [엔진 명세](../../docs/renewal/r6/spec/engine-changes.md) | 없음 |
| **G1 아트 바이블** | **일부 통과** | 세계관·타워 6종·몬스터 100 문서 완료. 타워 시트 6종 중 5장 합격(15쌍 IoU ≤ 0.5175). 몬스터 5종족 라인업·파츠 분해도·초상 시범 제작(`mech`·`golem` 합격) | 이미지 생성 429 한도 리셋 후 `bastion` 시트 원화 보강, 몬스터 반려분(`elf`·`human`·`insect`) 및 전용 홈 초상 4종 재생성 |
| **G2 공정 스파이크** | **통과** | Blender 5.2 헤드리스 타워 11형태·16방향 포두 렌더, Spine Pro 4.3 + `spine-phaser-v4@4.3.13` Mesh2D 채택, `tools/r6/qa/` 자동 검수 ([G2-spike.md](../../docs/renewal/r6/tech/G2-spike.md)) | 없음 |
| **G3 수직 단면** | **통과** | 초원 고원 3/4 맵·[map-spec.md](../../docs/renewal/r6/map-spec.md), 전투 엔진·해금·웨이브 혼합 통합, 4개 뷰포트·W1~W15 통주 확인 ([G3-precheck.md](../../docs/renewal/r6/tech/G3-precheck.md)) | 없음 |
| **G4 양산** | **통과 (2026-11-27)** | 타워 6종 66형태 전장 반영(165쌍 최대 IoU 0.5488), 타워별 전투 VFX, R04 전 화면 UI, 몬스터 5종족 100/100개체 재작화·접합(33자세 0/100 미달)·단조 배율·원본 색 복원 + 런타임 바깥 1px 은회 실루엣 테두리·비행 이중 그림자 반영. 발밑 Y 정렬, 빈 칸 >50% 가림 R04 모서리 표식, 비행 그림자 절제, `human-armored-t3`·`stone-boss-t3` 보정, W5·W15·W20 피크 가림 재측정 완료. [타워 검수](../../docs/renewal/r6/review/G4-towers-fix.md) · [몬스터 공정](../../docs/renewal/r6/tech/monster-pipeline.md) | 없음. 필수 조건 2건 충족, 홈 초상 30장 연결. 길 대비 미달 44개체는 G5 실기기에서 재확인. [G4 판정](../../docs/renewal/r6/review/G4-monsters-notes.md) · [2차 비평](../../docs/renewal/r6/review/G4-monsters-critique-2.md) |
| **G5 통합·운영** | **운영 반영 (2026-11-27, `1a7fe4eb`)** | **완료**: `npm run verify`(단위 1,892개·콘텐츠 604개·`fa75c724`), 전체 E2E **79통과/11건너뜀/0실패**([판별표](../../docs/renewal/r6/tech/G5-e2e-triage.md): 제품 결함 4건 수정·설계 변경 18건 R6 이관), `r6-full-run` **W15 통주** 59.99fps·성문 15/15·정지 0회, `test:r6-perf` **W20 통주** CPU 6배 59.35fps·1배 59.98fps([G5-perf.md](../../docs/renewal/r6/tech/G5-perf.md)), 이전 `npm run build`·`npm run test:server`(76/76, `ae889b19`), 점검표([G5-readiness.md](../../docs/renewal/r6/tech/G5-readiness.md)), 서버 시즌 2([G5-server.md](../../docs/renewal/r6/tech/G5-server.md)), 밸런스 v2 2차 조정(재사용, [sim-notes.md](../../docs/renewal/r6/spec/sim-notes.md)) | **실기기 크롬북(1366×768)·교실 프로젝터 확인**(길 대비 미달 44개체·혼잡도·글자 크기), 운영 반영 완료([실행 기록](../../docs/renewal/r6/tech/G5-server.md)). 남은 일: 학생 화면 한 판으로 시즌 2 기록 확인(교사) |

## 3. 구식 문서 오독 주의

- **운영판 대 코드 기본값**: `p1/intake-round1` 코드 기본값은 R6(`2.0.0`)이며 `?balance=v1`으로 `1.0.0`을 연다. 운영 서비스(`voca.ssamuniverse.com`, `voca-api.ssamuniverse.com`)는 아직 `v1.0.0`(시즌 1)이다.
- **문항 수**: 옛 문서의 "3학년 51문항"은 폐기 수치다. 현행 공개 은행은 3~6학년 전 학년 개통(총 출제 풀 **6,583문항**)이다.
- **작업 폴더**: 옛 문서(`DISPATCH.md`, `HANDOFF.md`)의 `../tower-wp/*` worktree 절차는 **2026-11-04부로 폐기**되었다(`DEC-01`).
- **보관 브랜치**: 로컬 `wp/WP-CORE`(`4a9da40`)는 승인 레지스트리 해시 불일치로 병합 금지다([AGENTS.md](../../AGENTS.md)).
