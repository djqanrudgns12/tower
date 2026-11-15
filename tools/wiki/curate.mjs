import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  exists,
  isFile,
  readJson,
  readText,
  resolveRel,
  walkFiles,
  writeTextIfChanged,
} from './lib/fsutil.mjs';
import { formatLessonBlock, parseDelta, parseLessons } from './lib/entries.mjs';

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

function listPendingDeltas(root) {
  return walkFiles(
    root,
    'wiki/_inbox',
    (rel) =>
      rel.endsWith('.md') &&
      !rel.startsWith('wiki/_inbox/merged/') &&
      !rel.startsWith('wiki/_inbox/dropped/'),
  );
}

function nextIdForLedger(ledgerRel, existingIds) {
  const rangeStart = ledgerRel.includes('ui-art-and-balance')
    ? 101
    : ledgerRel.includes('ops-and-workflow')
      ? 201
      : 1;
  let num = rangeStart;
  while (existingIds.has(`L-TD-${String(num).padStart(3, '0')}`)) {
    num++;
  }
  return `L-TD-${String(num).padStart(3, '0')}`;
}

function moveDeltaFile(root, fromRel, subFolder) {
  const base = path.basename(fromRel);
  const destRel = `wiki/_inbox/${subFolder}/${base}`;
  const destFull = resolveRel(root, destRel);
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.renameSync(resolveRel(root, fromRel), destFull);
  return destRel;
}

export function reportCurateStatus(root = REPO_ROOT) {
  const pending = listPendingDeltas(root);
  const allLessons = [];
  for (const lf of walkFiles(root, 'wiki/lessons', (r) => r.endsWith('.md'))) {
    allLessons.push(...parseLessons(readText(root, lf), lf));
  }
  const promoteCandidates = allLessons.filter(
    (l) => l.counters.violated >= 1 && (l.stage === 'L0' || l.stage === 'L1'),
  );
  const noisyLessons = allLessons.filter((l) => l.counters.falseAlarm >= 2);
  return {
    pending,
    totalLessons: allLessons.length,
    promoteCandidates,
    noisyLessons,
  };
}

export function applyDelta(flags, root = REPO_ROOT) {
  const deltaRel = String(flags.apply ?? '').trim();
  if (!deltaRel || !isFile(root, deltaRel)) {
    throw new Error(`적용할 델타 파일이 없습니다: ${deltaRel}`);
  }
  const delta = parseDelta(readText(root, deltaRel), deltaRel);

  if (flags.drop) {
    const moved = moveDeltaFile(root, deltaRel, 'dropped');
    return { action: 'dropped', moved, reason: String(flags.drop) };
  }

  const lessonFiles = walkFiles(root, 'wiki/lessons', (r) => r.endsWith('.md'));
  const allLessons = [];
  for (const lf of lessonFiles) {
    allLessons.push(...parseLessons(readText(root, lf), lf));
  }
  const existingIds = new Set(allLessons.map((l) => l.id));

  // 카운터 업데이트 또는 --merge <ID>
  const mergeTargetId =
    typeof flags.merge === 'string'
      ? flags.merge
      : delta.meta.delta_kind !== 'new_lesson'
        ? String(delta.meta.target_id ?? '')
        : '';

  if (mergeTargetId) {
    const target = allLessons.find((l) => l.id === mergeTargetId);
    if (!target) throw new Error(`대상 교훈 ID를 찾을 수 없습니다: ${mergeTargetId}`);

    const kind = flags.merge ? 'violated' : String(delta.meta.delta_kind);
    const nextCounters = { ...target.counters };
    if (kind === 'hit') nextCounters.hit++;
    else if (kind === 'false_alarm') nextCounters.falseAlarm++;
    else nextCounters.violated++;

    const rawLedger = readText(root, target.file);
    const updatedLedger = rawLedger.replace(
      new RegExp(`(###\\s+${target.id}\\b[\\s\\S]*?- \\*\\*카운터\\*\\*:\\s*)([^\\n]+)`),
      `$1적중 ${nextCounters.hit} · 위반 ${nextCounters.violated} · 오탐 ${nextCounters.falseAlarm}`,
    );
    writeTextIfChanged(root, target.file, updatedLedger);
    const moved = moveDeltaFile(root, deltaRel, 'merged');
    return { action: 'updated_counter', id: target.id, moved };
  }

  if (!flags.new) {
    throw new Error('신규 교훈 델타는 --new, --merge <ID>, --drop "<사유>" 중 하나를 지정하세요.');
  }

  const ledgerRel = String(delta.meta.ledger ?? 'wiki/lessons/engineering-and-content.md');
  const newId = nextIdForLedger(ledgerRel, existingIds);
  const date = String(delta.meta.updated ?? new Date().toISOString().slice(0, 10));
  const rawSource = String(delta.fields['근거'] ?? '').replace(/\(\.\.\/\.\.\//g, '(../');

  const block = formatLessonBlock({
    id: newId,
    title: String(delta.meta.title ?? '새 교훈'),
    tags: Array.isArray(delta.meta.tags) ? delta.meta.tags : [],
    counters: { hit: 1, violated: 0, falseAlarm: 0 },
    fields: {
      언제: delta.fields['언제'] ?? '',
      규칙: delta.fields['규칙'] ?? '',
      왜: delta.fields['왜'] ?? '',
      검사: delta.fields['검사'] ?? '수동 확인',
      단계: 'L0',
      날짜: `최초 ${date} · 확인 ${date}`,
      근거: rawSource,
    },
  });

  const prevLedger = readText(root, ledgerRel).trimEnd();
  writeTextIfChanged(root, ledgerRel, `${prevLedger}\n\n${block}\n`);

  const idsPath = 'wiki/_data/lesson-ids.json';
  const idsObj = exists(root, idsPath) ? readJson(root, idsPath) : { ids: [] };
  const mergedIds = [...new Set([...(idsObj.ids ?? []), ...existingIds, newId])].sort();
  writeTextIfChanged(root, idsPath, `${JSON.stringify({ ids: mergedIds }, null, 2)}\n`);

  const moved = moveDeltaFile(root, deltaRel, 'merged');
  return { action: 'created_lesson', id: newId, ledger: ledgerRel, moved };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = parseFlags(process.argv.slice(2));
  try {
    if (flags.apply) {
      const res = applyDelta(flags, REPO_ROOT);
      console.log(`[wiki:curate] 완료: ${JSON.stringify(res)}`);
    } else {
      const st = reportCurateStatus(REPO_ROOT);
      console.log(
        [
          `# 교훈 큐레이션 현황 (총 원장 ${st.totalLessons}건 · 수신함 대기 ${st.pending.length}건)`,
          st.pending.length
            ? `- 대기 델타:\n  - ${st.pending.join('\n  - ')}`
            : '- 대기 중인 교훈 델타 없음',
          st.promoteCandidates.length
            ? `- 승격 권장(위반 ≥1, L0~L1): ${st.promoteCandidates.map((l) => l.id).join(', ')}`
            : '- 승격 대기 항목 없음',
          st.noisyLessons.length
            ? `- 오탐 점검 필요(오탐 ≥2): ${st.noisyLessons.map((l) => l.id).join(', ')}`
            : '- 오탐 과다 항목 없음',
        ].join('\n'),
      );
    }
  } catch (err) {
    console.error(`[wiki:curate] 오류: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}
