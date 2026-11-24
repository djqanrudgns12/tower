---
id: project-roadmap-and-status
type: project
title: 프로젝트 계보 및 현행 코드 실체 판정
status: active
updated: 2026-11-24
verified: { commit: eb87c5ed, date: 2026-11-25 }
sources:
  - path: package.json
    sha256: "868d9aefb60ec389e8fc0436fc69266c84e34ff3858f61f62766a8c88c92a90a"
  - path: AGENTS.md
    sha256: f22902d65d0a4e1a65acb94dcd3e46101332e9685f9ef2fb7d6213198e7d9534
  - path: docs/renewal/README.md
    sha256: "7230e4d3bab99c364914af07ae0292643bf009590a8b63051ff7f97a80842e4c"
  - path: docs/DEPLOY.md
    sha256: ddaf762fa130c340599cddb9a93d3d32e40f81ff5e4a76f96ebe4cec54bfc66f
  - path: docs/HOSTING_IMPL_PLAN.md
    sha256: "79f1f85a62652e420cf36b3a1a0f058656fb8685fb5f179d825f5570caed6701"
  - path: docs/CR1000_HANDOFF.md
    sha256: c3c01581eceead622afc236790d68ce0c3f6f600317b819d9f549176dbb1707c
  - path: docs/balance/r4-final.md
    sha256: "3ce50ccc026b07b67ea0cb9d8702a8f43a353d656da97d6fabfc0774da752716"
---

# 프로젝트 계보 및 현행 코드 실체 판정 (`roadmap-and-status`)

초기 계획 문서(`docs/EXECUTION_BOARD.md`, `docs/HANDOFF.md`)는 P1 제작 당시 스냅샷으로 보존되어 있어 현행 코드와 큰 시차가 있다. 에이전트는 아래 **실제 코드·계약 기준 완료 판정**을 따른다.

## 1. 단계별 진화 계보

| 시기 / 단계 | 핵심 목표 및 산출물 | 현재 상태 |
| --- | --- | --- |
| **1. PRD v0.1~v0.5 & P1** (10월 말) | 30Hz 도메인 엔진, 3학년 정원 맵, 기본 타워 3종, 41번 화풍 잠금 | **완료** (초기 PRD 해시 보존) |
| **2. 리뉴얼 R1~R5** (10/30~11/04) | 타워 **20종 + Lv4/Lv7 진화**, 종족 8종×역할 10종 몬스터, 학년별 맵 4종, 징집·보물, R4 밸런스 확정 | **완료** ([renewal/README.md](../../docs/renewal/README.md), [r4-final.md](../../docs/balance/r4-final.md)) |
| **3. 호스팅 1.0.0 출시** (11/05) | 에셋 WebP 378장 변환, 맵별 지연 적재, GitHub Pages(`voca`) + Workers/D1(`voca-api`) 운영 배포 | **완료 (`v1.0.0`)** ([DEPLOY.md](../../docs/DEPLOY.md)) |
| **4. CR-1000 공동검수** (11/06~11/09) | 3~6학년 자기 학년 각 1,000+ 승인(합계 **5,547문항**, 총 풀 **6,583문항**), Normal 심화 150+ 바닥 및 원격 D1 반영 | **목표 달성 · 유지보수** ([CR1000_HANDOFF.md](../../docs/CR1000_HANDOFF.md)) |
| **5. LLM Wiki 구축** (11/16) | `wiki/` 컴파일 지식 계층, `tools/wiki/` 무의존성 동기화·조회·린트·교훈 수신함, `llms.txt`·`docs/README.md` 도입 | **현행 운영** ([SCHEMA.md](../SCHEMA.md)) |
| **6. 학교 입장과 재방문 개선** (11/16) | 서비스워커 정적 자산 캐시, 교실 QR 입장, 홈의 우리 학교 랭킹 필터, `GET /v1/schools` 학교 검색 프록시 | **구현 완료** (`8e02afec`) |

## 2. 영역별 현행 코드 실체 (구식 문서 오독 주의)

- **문항 수**: 옛 문서의 "3학년 51문항"은 폐기된 과거 수치다. 현행 공개 은행은 **3~6학년 전 학년 개통(총 출제 풀 6,583문항)** 상태다.
- **원화 에셋**: 옛 문서의 "P2 임시 그림"과 달리 현행 `public/assets/manifest.json`에는 **WebP 원화 378장**이 정식 등록되어 있다.
- **작업 폴더**: 옛 문서(`DISPATCH.md`, `HANDOFF.md`)의 `../tower-wp/*` worktree 절차는 **2026-11-04부로 전면 폐기**되었다(`DEC-01`).
- **보관 브랜치 주의**: 로컬 `wp/WP-CORE`(`4a9da40`)는 중단된 검수 묶음 해시 불일치로 병합 금지 상태다([AGENTS.md](../../AGENTS.md)).

## 3. 열린 후속 과제 및 점검 포인터

1. **실기기·학교 망 확인**. 저사양 크롬북·태블릿에서 다시 열기, 연결 단절과 복구, 장시간 메모리와 프레임을 확인한다. [HOSTING_IMPL_PLAN.md](../../docs/HOSTING_IMPL_PLAN.md)
2. **보류 목록**. 문제 난이도·유형 분포, 밸런스 관문, 5·6학년 은행 분할과 나머지 후보를 추후 검토한다. [BACKLOG.md](../../docs/renewal/BACKLOG.md)
