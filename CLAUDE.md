@AGENTS.md

## Claude 전용

- `Agent` 도구에 `isolation: "worktree"`를 주지 않는다. 새 세션(`start_session`)은 `use_worktree: false`로 이 폴더에서 연다.
- 서브에이전트·세션에 일을 나눌 때는 고칠 파일 범위를 브리프에 적고, 커밋은 `git commit --only -- <경로>`로 하게 한다.
