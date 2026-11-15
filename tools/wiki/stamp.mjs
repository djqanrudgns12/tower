import { execFileSync } from 'node:child_process';
import {
  REPO_ROOT,
  isFile,
  readText,
  sha256File,
  walkFiles,
  writeTextIfChanged,
} from './lib/fsutil.mjs';
import { parseFrontmatter, stringifyFrontmatter } from './lib/frontmatter.mjs';

function currentHeadShort(root) {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'uncommitted';
  }
}

function todayKstIso() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function stampWikiSources(root = REPO_ROOT, targetFiles = []) {
  const files =
    targetFiles.length > 0
      ? targetFiles
      : walkFiles(
          root,
          'wiki',
          (rel) =>
            rel.endsWith('.md') &&
            !rel.startsWith('wiki/_inbox/') &&
            !rel.startsWith('wiki/templates/'),
        );

  const commit = currentHeadShort(root);
  const date = todayKstIso();
  const updatedFiles = [];

  for (const rel of files) {
    if (!isFile(root, rel)) continue;
    const raw = readText(root, rel);
    const { hasFrontmatter, data, body } = parseFrontmatter(raw);
    if (!hasFrontmatter || data.type === 'registry') continue;
    if (!Array.isArray(data.sources) || data.sources.length === 0) continue;

    const nextSources = data.sources.map((item) => {
      const rawPath = typeof item === 'string' ? item : String(item?.path ?? '');
      const cleanPath = rawPath.split('#')[0] ?? '';
      if (!cleanPath || !isFile(root, cleanPath)) return item;
      return {
        path: rawPath,
        sha256: sha256File(root, cleanPath),
      };
    });

    const nextData = {
      ...data,
      verified: { commit, date },
      sources: nextSources,
    };

    const rendered = stringifyFrontmatter(nextData, body);
    if (writeTextIfChanged(root, rel, rendered)) {
      updatedFiles.push(rel);
    }
  }

  return { updatedFiles, commit, date };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const res = stampWikiSources(REPO_ROOT, targets);
  console.log(
    `[wiki:stamp] 완료 (commit=${res.commit}, date=${res.date}, 갱신 ${res.updatedFiles.length}개${res.updatedFiles.length ? `: ${res.updatedFiles.join(', ')}` : ''})`,
  );
}
