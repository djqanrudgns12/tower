---
id: delta-2026-11-25-cab085
type: delta
title: "AI 생성 그림은 콘셉트·파츠 원화까지, 양산은 Blender·Spine으로 고정"
status: draft
updated: 2026-11-25
tags: [assets, towers, phaser]
delta_kind: new_lesson
ledger: wiki/lessons/ui-art-and-balance.md
by: antigravity
---

# 교훈 초안 · AI 생성 그림은 콘셉트·파츠 원화까지, 양산은 Blender·Spine으로 고정

- **언제**: 타워 다단계 진화(66형태·16방향)나 몬스터 100개체 스프라이트를 양산할 때
- **규칙**: AI 이미지 생성은 콘셉트 시트와 분해 파츠 원화까지만 쓰고, 타워 양산은 Blender 5.2 헤드리스+레시피 JSON으로, 몬스터 양산은 파츠 안내판 절단+Spine Pro 4.3 스킨으로 고정한다.
- **왜**: 최종 스프라이트를 AI로 직접 뽑으면 광원·실루엣·관절 일관성이 무너지지만 Blender/Spine 공정은 66형태 165쌍 IoU 0.5488·R04 팔레트·걷기 루프 일치까지 자동 검수할 수 있다.
- **검사**: tools/r6/qa/check.py 및 tools/r6/spine/check-runtime.mjs 통과
- **태그**: `assets`, `towers`, `phaser`
- **근거**: [docs/renewal/r6/PRD-r6.md](../../docs/renewal/r6/PRD-r6.md)
