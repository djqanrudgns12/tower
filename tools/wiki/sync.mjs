import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './lib/fsutil.mjs';
import { MARKER_TARGET_FILES, REGISTRY_FILES, generateAll } from './gen.mjs';

function getUnstagedModifiedSet(root) {
  try {
    const out = execFileSync('git', ['diff', '--name-only'], {
      cwd: root,
      encoding: 'utf8',
    });
    return new Set(
      out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

export function runSync(
  root = REPO_ROOT,
  { checkOnly = false, stageUpdated = false, protectUnstaged = false, quiet = false } = {},
) {
  const managedSet = new Set([...REGISTRY_FILES, ...MARKER_TARGET_FILES]);
  const skipRelSet = new Set();

  if (protectUnstaged) {
    const unstaged = getUnstagedModifiedSet(root);
    for (const rel of unstaged) {
      if (managedSet.has(rel)) {
        skipRelSet.add(rel);
      }
    }
  }

  const res = generateAll(root, { checkOnly, skipRelSet });

  if (checkOnly) {
    if (res.changed.length > 0) {
      if (!quiet) {
        console.error(
          `[wiki:sync] 동기화 필요 파일 ${res.changed.length}개:\n  - ${res.changed.join('\n  - ')}`,
        );
      }
      return { ok: false, changed: res.changed, skipped: res.skipped };
    }
    if (!quiet) {
      console.log('[wiki:sync] 모든 자동 생성 문서와 WIKI-AUTO 마커가 최신입니다.');
    }
    return { ok: true, changed: [], skipped: res.skipped };
  }

  if (stageUpdated && res.changed.length > 0) {
    execFileSync('git', ['add', '--', ...res.changed], { cwd: root });
  }

  if (!quiet) {
    const skippedMsg =
      res.skipped.length > 0 ? ` (미스테이징 보호로 건너뜀: ${res.skipped.join(', ')})` : '';
    console.log(
      `[wiki:sync] 완료 — 갱신 ${res.changed.length}개${res.changed.length ? ` (${res.changed.join(', ')})` : ''}${skippedMsg}`,
    );
  }

  return { ok: true, changed: res.changed, skipped: res.skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2));
  const result = runSync(REPO_ROOT, {
    checkOnly: args.has('--check'),
    stageUpdated: args.has('--staged'),
    protectUnstaged: args.has('--staged') || args.has('--protect-unstaged'),
    quiet: args.has('--quiet'),
  });
  if (!result.ok) process.exitCode = 1;
}
