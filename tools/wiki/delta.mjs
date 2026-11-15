import crypto from 'node:crypto';
import {
  REPO_ROOT,
  exists,
  isFile,
  readJson,
  readText,
  walkFiles,
  writeTextIfChanged,
} from './lib/fsutil.mjs';
import { stringifyFrontmatter } from './lib/frontmatter.mjs';
import { LESSON_ID_RE, parseLessons } from './lib/entries.mjs';

const AREA_MAP = {
  engineering: 'wiki/lessons/engineering-and-content.md',
  content: 'wiki/lessons/engineering-and-content.md',
  ui: 'wiki/lessons/ui-art-and-balance.md',
  art: 'wiki/lessons/ui-art-and-balance.md',
  balance: 'wiki/lessons/ui-art-and-balance.md',
  ops: 'wiki/lessons/ops-and-workflow.md',
  workflow: 'wiki/lessons/ops-and-workflow.md',
};

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function todayKstIso() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function makeSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 32);
}

export function createLessonDelta(flags, root = REPO_ROOT) {
  const author = String(flags.by ?? 'agent').replace(/[^a-zA-Z0-9_-]/g, '');
  const date = todayKstIso();
  const nonce = crypto.randomBytes(3).toString('hex');

  const counterMode = flags.violated
    ? { kind: 'violated', targetId: String(flags.violated) }
    : flags.hit
      ? { kind: 'hit', targetId: String(flags.hit) }
      : flags['false-alarm']
        ? { kind: 'false_alarm', targetId: String(flags['false-alarm']) }
        : null;

  if (counterMode) {
    if (!LESSON_ID_RE.test(counterMode.targetId)) {
      throw new Error(`유효하지 않은 교훈 ID: ${counterMode.targetId}`);
    }
    const source = String(flags.source ?? '').trim();
    const why = String(flags.why ?? '').trim();
    if (!source || !why) {
      throw new Error('카운터 델타에는 --why와 --source가 필요합니다.');
    }
    const cleanSource = source.split('#')[0] ?? '';
    if (!isFile(root, cleanSource)) {
      throw new Error(`존재하지 않는 근거 경로(--source): ${cleanSource}`);
    }

    const relPath = `wiki/_inbox/${date}-${author}-${counterMode.targetId.toLowerCase()}-${nonce}.md`;
    const content = stringifyFrontmatter(
      {
        id: `delta-${date}-${nonce}`,
        type: 'delta',
        delta_kind: counterMode.kind,
        target_id: counterMode.targetId,
        by: author,
        updated: date,
        status: 'draft',
      },
      [
        `# 교훈 카운터 델타 · ${counterMode.targetId} (${counterMode.kind})`,
        '',
        `- **사유**: ${why}`,
        `- **근거**: ${source}`,
      ].join('\n'),
    );
    writeTextIfChanged(root, relPath, content);
    return { relPath, kind: counterMode.kind };
  }

  const area = String(flags.area ?? '').toLowerCase();
  const ledgerRel = AREA_MAP[area];
  if (!ledgerRel) {
    throw new Error(`--area는 ${Object.keys(AREA_MAP).join(', ')} 중 하나여야 합니다.`);
  }

  const title = String(flags.title ?? '').trim();
  const when = String(flags.when ?? '').trim();
  const rule = String(flags.rule ?? '').trim();
  const why = String(flags.why ?? '').trim();
  const source = String(flags.source ?? '').trim();
  const check = String(flags.check ?? '수동 확인').trim();
  const rawTags = String(flags.tags ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!title || !when || !rule || !why || !source || rawTags.length === 0) {
    throw new Error(
      '신규 교훈 델타 필수 인자: --area --title --when --rule --why --tags --source',
    );
  }

  const cleanSource = source.split('#')[0] ?? '';
  if (!isFile(root, cleanSource)) {
    throw new Error(`존재하지 않는 근거 경로(--source): ${cleanSource}`);
  }

  if (exists(root, 'wiki/_data/tags.json')) {
    const allowed = new Set(readJson(root, 'wiki/_data/tags.json').tags ?? []);
    for (const t of rawTags) {
      if (!allowed.has(t)) {
        throw new Error(`허용되지 않는 태그 '${t}' (wiki/_data/tags.json 확인)`);
      }
    }
  }

  // 기존 유사 교훈 안내
  const existing = [];
  for (const lf of walkFiles(root, 'wiki/lessons', (r) => r.endsWith('.md'))) {
    existing.push(...parseLessons(readText(root, lf), lf));
  }
  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const similar = existing.filter((e) =>
    titleWords.some((w) => e.title.toLowerCase().includes(w)),
  );

  const slug = makeSlug(title) || 'lesson';
  const relPath = `wiki/_inbox/${date}-${author}-${slug}-${nonce}.md`;
  const content = stringifyFrontmatter(
    {
      id: `delta-${date}-${nonce}`,
      type: 'delta',
      delta_kind: 'new_lesson',
      ledger: ledgerRel,
      title,
      by: author,
      tags: rawTags,
      updated: date,
      status: 'draft',
    },
    [
      `# 교훈 초안 · ${title}`,
      '',
      `- **언제**: ${when}`,
      `- **규칙**: ${rule}`,
      `- **왜**: ${why}`,
      `- **검사**: ${check}`,
      `- **태그**: ${rawTags.map((t) => `\`${t}\``).join(', ')}`,
      `- **근거**: [${cleanSource}](../../${source})`,
    ].join('\n'),
  );

  writeTextIfChanged(root, relPath, content);
  return {
    relPath,
    kind: 'new_lesson',
    similarIds: similar.map((s) => `${s.id}(${s.title})`),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    const res = createLessonDelta(flags, REPO_ROOT);
    console.log(`[wiki:delta] 생성 완료: ${res.relPath}`);
    if (res.similarIds?.length) {
      console.log(`[wiki:delta] 참고 — 유사 기존 교훈: ${res.similarIds.join(', ')}`);
    }
  } catch (err) {
    console.error(`[wiki:delta] 오류: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}
