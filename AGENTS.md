# 에이전트 공통 작업 규칙

Claude·Codex·Antigravity와 그 서브에이전트가 이 저장소에서 일할 때 따른다. 사용자에게 보이는 출력은 한국어로 쓴다.

## 단일 폴더(2026-11-04 사용자 결정)

- 작업 폴더는 이 저장소 `/Users/bodyking/Desktop/Architecture/towerdeffense` 한 곳뿐이다.
- `git worktree add`, `../tower-wp/<id>` 같은 별도 작업 폴더, 저장소 복사본을 만들지 않는다. Claude 서브에이전트와 새 세션도 worktree 격리를 쓰지 않는다.
- 결과 확인은 이 폴더의 커밋과 git 이력(`git log`, `git diff`, `git show`)으로만 한다. 다른 폴더의 파일을 근거로 삼지 않는다.
- 작업 단위마다 커밋한다. 변경을 커밋하지 않은 채 오래 두지 않는다.

## 여러 에이전트가 같은 폴더에서 일할 때

- 고칠 파일 범위를 나눠 맡는다. 같은 파일을 두 에이전트가 동시에 고치지 않는다.
- 남의 미커밋 변경을 되돌리거나 덮어쓰지 않는다. `git checkout -- .`, `git restore .`, `git reset --hard`, `git stash`, `git clean`을 쓰지 않는다.
- 커밋은 자기 파일만 경로를 지정해 한다(`git commit --only -- <경로>`). `git add -A`·`git add .`·`git commit -a`를 쓰지 않는다.
- 시작할 때 `git status`로 남의 미커밋 변경이 있는지 보고, 겹치는 파일이면 그 작업이 커밋될 때까지 기다리거나 사용자에게 묻는다.

## 지우기 전에 확인

- 사용자가 다듬은 화면이나 기능을 통째로 걷어내는 변경(화면 교체, 기능 삭제)은 사용자 확인 뒤에 한다. 2026-11-04에 R4 리뉴얼이 사용자가 다듬은 랜딩(통합 수호 랭킹)을 확인 없이 지운 일이 있었다.

## 폐기된 절차

- `docs/HANDOFF.md`, `docs/work-packages/DISPATCH.md`, `docs/EXECUTION_BOARD.md`, `docs/renewal/README.md`, `asset-source/**/REQUEST.md`에 적힌 worktree·`tower-wp` 작업 폴더 절차는 2026-11-04부로 쓰지 않는다. 기록으로만 남긴다.
- 2026-11-04 정리: `tower-wp` 14곳과 `.claude/worktrees` 2곳을 지웠다. 모든 브랜치가 `p1/intake-round1`에 병합돼 있었다. 메인에 없던 WP-CORE 미커밋 문항 검수 결과(10/31 content-loop 중단분)는 로컬 브랜치 `wp/WP-CORE`에 커밋해 보관했다(병합 안 함, 공개 승인 `registry.json`을 바꾸는 내용이라 따로 검토).
