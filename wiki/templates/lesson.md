---
id: template-lesson
type: template
title: 교훈 원장 항목 작성 틀
status: draft
updated: 2026-11-16
---

# 교훈 원장 항목 틀 (`template: lesson`)

> 직접 `wiki/lessons/*.md`를 편집하지 말고 아래 명령으로 `wiki/_inbox/`에 초안 델타를 제출하세요.
>
> ```sh
> npm run wiki:delta -- \
>   --area engineering \
>   --title "한 줄 제목" \
>   --when "언제 마주치는 상황인가" \
>   --rule "무엇을 반드시 지키거나 피해야 하는가" \
>   --why "어기면 어떤 장애·회귀·비용이 발생하는가" \
>   --check "자동 검사 스크립트 또는 수동 확인법" \
>   --tags "architecture,verification" \
>   --source "AGENTS.md#L7"
> ```

## 원장 수록 표준 형식 (항목당 ≤ 750자, 필수 필드 9개)

```markdown
### L-TD-000 · 짧고 구체적인 행동 규칙 제목
- **언제**: 어떤 파일·기능·명령을 다룰 때 이 규칙을 떠올려야 하는가
- **규칙**: 에이전트가 따라야 할 명확한 단언문
- **왜**: 과거 실제 사고나 구조적 제약 근거
- **검사**: `npm run ...` 또는 확인 방법
- **단계**: L0 (`L0` 원장 | `L1` 스킬 | `L2` AGENTS.md | `L3` 자동 시험/린트 | `L4` 훅/잠금 차단)
- **카운터**: 적중 1 · 위반 0 · 오탐 0
- **날짜**: 최초 YYYY-MM-DD · 확인 YYYY-MM-DD
- **태그**: `architecture`, `verification`
- **근거**: [AGENTS.md](../../AGENTS.md)
```
