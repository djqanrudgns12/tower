import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/fsutil.mjs';

const HOOK_NAMES = ['pre-commit', 'post-commit', 'post-merge', 'post-checkout'];
const MARKER = '# MANAGED-BY-TD-WIKI-HOOKS';

export function installGitHooks(root = REPO_ROOT) {
  const hooksDir = path.join(root, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    throw new Error(`.git/hooks 디렉터리가 없습니다: ${hooksDir}`);
  }

  const installed = [];
  for (const name of HOOK_NAMES) {
    const hookPath = path.join(hooksDir, name);
    const backupPath = `${hookPath}.pre-wiki.bak`;

    if (fs.existsSync(hookPath)) {
      const prev = fs.readFileSync(hookPath, 'utf8');
      if (!prev.includes(MARKER) && !fs.existsSync(backupPath)) {
        fs.copyFileSync(hookPath, backupPath);
        fs.chmodSync(backupPath, 0o755);
      }
    }

    const script = [
      '#!/bin/sh',
      MARKER,
      'REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"',
      'if [ -z "$REPO_ROOT" ]; then exit 0; fi',
      `if [ -x "$REPO_ROOT/.git/hooks/${name}.pre-wiki.bak" ]; then`,
      `  "$REPO_ROOT/.git/hooks/${name}.pre-wiki.bak" "$@" || exit $?`,
      'fi',
      'if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/tools/wiki/hooks/run-hook.mjs" ]; then',
      `  node "$REPO_ROOT/tools/wiki/hooks/run-hook.mjs" "${name}" "$@" || exit $?`,
      'fi',
      '',
    ].join('\n');

    fs.writeFileSync(hookPath, script, { encoding: 'utf8', mode: 0o755 });
    fs.chmodSync(hookPath, 0o755);
    installed.push(name);
  }

  return { installed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = installGitHooks(REPO_ROOT);
  console.log(`[wiki:hooks] Git 훅 설치 완료: ${res.installed.join(', ')}`);
}
