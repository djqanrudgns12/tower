import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/fsutil.mjs';
import { runSync } from '../sync.mjs';
import { runLint } from '../lint.mjs';

const SOURCE_TRIGGER_RE =
  /^(package\.json|eslint\.config\.js|src\/|server\/(src|migrations|wrangler\.toml)|docs\/|wiki\/_data\/|public\/assets\/manifest\.json|tools\/assets\/webp-exceptions\.json|vocabulary_td_prd_)/;

function getStagedFiles(root) {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: root,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isTemporaryOnlyIndex() {
  const idx = process.env.GIT_INDEX_FILE ?? '';
  return idx.includes('next-index-');
}

function main() {
  if (process.env.WIKI_SKIP_HOOK === '1') return;

  // CR-1000 commit-lock 자동 배치 중에는 개입하지 않음
  if (fs.existsSync(path.join(REPO_ROOT, '.orchestrate/commit.lock'))) {
    return;
  }

  const hookName = process.argv[2] ?? '';

  if (hookName === 'pre-commit') {
    const staged = getStagedFiles(REPO_ROOT);
    if (staged.length === 0) return;

    const touchesWikiSource = staged.some((f) => SOURCE_TRIGGER_RE.test(f));
    if (touchesWikiSource && !isTemporaryOnlyIndex()) {
      runSync(REPO_ROOT, {
        stageUpdated: true,
        protectUnstaged: true,
        quiet: true,
      });
    }

    const touchesDocsOrWiki = staged.some(
      (f) =>
        f.startsWith('wiki/') ||
        f === 'AGENTS.md' ||
        f === 'README.md' ||
        f === 'llms.txt' ||
        f === 'docs/README.md' ||
        f === 'docs/READ_FIRST.md',
    );
    if (touchesDocsOrWiki) {
      const lint = runLint(REPO_ROOT, { strict: false });
      if (!lint.ok) {
        for (const e of lint.errors) {
          console.error(`[wiki:pre-commit][${e.code}] ${e.file}: ${e.msg}`);
        }
        process.exitCode = 1;
      }
    }
    return;
  }

  if (
    hookName === 'post-commit' ||
    hookName === 'post-merge' ||
    hookName === 'post-checkout'
  ) {
    try {
      runSync(REPO_ROOT, {
        stageUpdated: false,
        protectUnstaged: true,
        quiet: true,
      });
    } catch {
      // 후처리 동기화 실패가 git 명령 종료 코드를 깨뜨리지 않도록 보호
    }
  }
}

main();
