#!/usr/bin/env node
// Argon·Codex 승인용 공개 대조. 기존 독립 풀이를 보존하고 부족한 해설 근거만 보충한다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertPhaseConfig, load, parseReply, pendingReviewFiles, questionRefs, resolveReviewConfig, revealItem, reviewChunk } from './review.mjs';

const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const key = q => `${q.questionId ?? q.id}@${q.revision}`;
const axes = ['source', 'uniqueness', 'grade', 'language', 'explanation'];
const strong = run => run?.model === 'gpt-6-astra' && ['high', 'xhigh'].includes(run.effort);

function cachedReveal(root, batchId, expected, item, bank, config) {
  const dir = path.join(root, '.orchestrate/review/codex', batchId);
  const input = read(path.join(dir, 'reveal.input.json')), result = read(path.join(dir, 'reveal.result.json'));
  if (!input || !result) return null;
  try {
    assertPhaseConfig(input.config, config, 'cached input');
    assertPhaseConfig(result.config, config, 'cached result');
    const old = input.items.find(q => key(q) === key(expected) && q.contentHash === expected.contentHash);
    const row = result.items.find(q => key(q) === key(expected) && q.contentHash === expected.contentHash);
    if (!old || !row || bank.rationalesHash(old) !== bank.rationalesHash(expected)) return null;
    for (const field of ['correctOptionId', 'explanation', 'source', 'stem', 'options', 'grade', 'type', 'lemma']) {
      if (JSON.stringify(old[field]) !== JSON.stringify(expected[field])) return null;
    }
    if (axes.some(axis => row.verdicts?.[axis] !== item.verdicts[axis])) return null;
    return parseReply(json({ items: [row] }), 'reveal', [expected])[0];
  } catch { return null; } // 불완전한 과거 대조는 재사용하지 않고 현재 입력으로 다시 대조한다.
}

/** 호출자가 배치 gate 잠금을 소유한다. 추적 파일은 쓰지 않고 staging만 만든다. */
export async function finalizeCodex(options, deps = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const config = resolveReviewConfig({ ...options, 'codex-model': options['codex-model'] ?? 'gpt-6-astra', 'codex-effort': options['codex-effort'] ?? 'high' }).codex;
  if (!strong(config)) throw new Error('Codex 최종 대조는 gpt-6-astra high/xhigh가 필요하다');
  const concurrency = Number(options['review-concurrency'] ?? 2);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('--review-concurrency는 1~4의 정수여야 한다');
  const runtime = deps.runtime ?? await (await import('./content-loop.mjs')).createGateRuntime({ ...options, root, 'stage-only': true });
  const bank = deps.bank ?? await load(root);
  const refs = questionRefs(options.questions ?? runtime.ids.flatMap(id => runtime.snapshot(id).drafts.map(q => ({ batchId: id, questionId: q.id, revision: q.revision }))));
  const ids = [...new Set(refs.map(q => q.batchId))], batches = new Map(), entries = [], pending = [];
  const priors = new Map(ids.map(id => [id, pendingReviewFiles(root, id)]));
  const createdAt = new Date(Math.max(Date.now(), ...[...priors.values()].map(p => p.lastTime + 1))).toISOString();
  const runId = `${createdAt.replace(/[-:.]/g, '')}-${process.pid}-${randomUUID()}`;
  const run = { id: runId, ...config };
  for (const id of ids) {
    const batch = runtime.batch(id), state = runtime.snapshot(id);
    if (!batch || !state || state.levelPending.length || state.codexPending.length || state.argonPending.length || state.front.batchDefects.length) throw new Error(`${id}: 앞단 미완료`);
    batches.set(id, batch);
    const front = new Set(state.front.items.filter(q => q.status === 'pass').map(key));
    for (const ref of refs.filter(q => q.batchId === id)) {
      const q = state.drafts.find(q => key(q) === key(ref));
      if (!q || !front.has(key(ref))) throw new Error(`${id}: 현재 앞단 통과 문항이 아님: ${key(ref)}`);
      const item = batch.reviews.codex?.items.find(i => key(i) === key(q) && i.contentHash === bank.contentHash(q));
      const reportProvenance = item && !item.run && batch.reviews.codex.reviewer.model === config.model
        && batch.reviews.codex.reviewer.tool === '2단계 블라인드 검수(tools/orchestrate/review.mjs)';
      if (!item || batch.reviews.codex.reviewer.freshContext !== true || (!strong(item.run) && !reportProvenance) || item.blindChoice !== q.correctOptionId
        || axes.slice(0, 4).some(axis => item.verdicts[axis] !== 'pass')) throw new Error(`${id}: 강한 Codex 독립 풀이 근거 없음: ${key(ref)}`);
      const entry = { batchId: id, q, item, expected: revealItem(bank, root, id, q, item) };
      const exp = batch.explanation?.items.find(i => key(i) === key(q) && i.contentHash === bank.contentHash(q) && i.rationalesHash === bank.rationalesHash(q));
      if (batch.explanation?.reviewer.model === config.model && exp && strong(exp.run)) entry.explanation = exp;
      else {
        const cached = strong(item.run) ? cachedReveal(root, id, entry.expected, item, bank, config) : null;
        if (cached) { entry.result = cached; entry.run = item.run; entry.reused = true; }
        else pending.push(entry);
      }
      entries.push(entry);
    }
  }
  if (options.plan) return ids.map(batchId => ({ batchId, target: entries.filter(e => e.batchId === batchId).length,
    reused: entries.filter(e => e.batchId === batchId && (e.explanation || e.reused)).length,
    needsReveal: pending.filter(e => e.batchId === batchId).length }));

  const chunks = [];
  for (let offset = 0; offset < pending.length; offset += 50) chunks.push(pending.slice(offset, offset + 50));
  let cursor = 0, failed = false;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
    while (!failed && cursor < chunks.length) {
      const index = cursor++, chunk = chunks[index];
      try {
        const dir = path.join(root, '.orchestrate/finalize-codex', runId, `chunk${index}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'reveal.input.json'), json({ config, items: chunk.map(e => e.expected) }));
        const result = await reviewChunk(root, 'codex', 'reveal', chunk.map(e => e.expected), options.log ?? (() => {}),
          { ...options, config, respond: deps.respond ?? options.respond }, { batchIds: [...new Set(chunk.map(e => e.batchId))] }, dir);
        fs.writeFileSync(path.join(dir, 'reveal.result.json'), json({ at: new Date().toISOString(), config, items: result }));
        for (const entry of chunk) { entry.result = result.find(r => key(r) === key(entry.q)); entry.run = run; }
      } catch (error) { failed = true; throw error; }
    }
  }));
  const failure = workers.find(r => r.status === 'rejected');
  if (failure) throw failure.reason;
  const results = [];
  for (const id of ids) {
    const batch = batches.get(id), selected = entries.filter(e => e.batchId === id), writes = new Map();
    const expPath = `content-source/approvals/${id}.explanation.json`;
    const old = batch.explanation;
    const items = selected.map(e => {
      if (e.explanation) return e.explanation;
      const failedAxes = axes.filter(axis => e.result.verdicts[axis] !== 'pass');
      return { questionId: e.q.id, revision: e.q.revision, contentHash: bank.contentHash(e.q), rationalesHash: bank.rationalesHash(e.q), run: e.run,
        explanation: failedAxes.length ? 'fail' : 'pass', findings: failedAxes.length ? [...failedAxes.map(axis => `Codex 최종 대조: ${axis} ${e.result.verdicts[axis]}`), ...e.result.findings] : [] };
    });
    const keep = old?.reviewer.model === config.model ? old.items.filter(i => !items.some(q => key(q) === key(i))) : [];
    const explanation = { batchId: id, reviewer: { model: config.model, role: 'commander', date: createdAt.slice(0, 10) }, items: [...keep, ...items] };
    if (old && old.reviewer.model !== config.model) writes.set(`content-source/approvals/archive/${id}.explanation.${runId}.json`, priors.get(id).bytes(expPath));
    writes.set(expPath, json(explanation));
    const report = structuredClone(batch.reviews.codex);
    let reportChanged = false;
    for (const item of report.items) {
      if (item.verdicts.explanation === 'uncertain' && items.some(exp => key(exp) === key(item) && exp.contentHash === item.contentHash && exp.explanation === 'pass')) {
        item.verdicts.explanation = 'pass'; reportChanged = true;
      }
    }
    // 기존 독립 풀이·실행 출처는 보존하고, 실제 Codex 대조로 확인한 해설 판정만 채운다.
    if (reportChanged) writes.set(`content-source/reviews/${id}/codex.json`, json(report));
    writes.set(`content-source/batches/${id}/sidecar.json`, json({ ...batch.sidecar, publicationPolicy: 'codex-argon-v1' }));
    const staging = `.orchestrate/staging/${id}/${runId}`;
    const manifest = { batchId: id, runId, tool: 'codex-finalize', model: config.model, createdAt, writes: [], deletes: [] };
    for (const [relative, bytes] of writes) {
      const dest = path.join(root, staging, 'files', relative); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
      manifest.writes.push({ path: relative, sha256: hash(bytes) });
    }
    fs.writeFileSync(path.join(root, staging, 'manifest.json'), json(manifest));
    results.push({ batchId: id, merged: items.length, flagged: items.filter(i => i.explanation !== 'pass').length,
      reused: selected.filter(e => e.explanation || e.reused).length, staging });
  }
  return results;
}

async function main() {
  const options = {};
  const argv = process.argv.slice(2);
  while (argv.length) { const flag = argv.shift(); if (!flag.startsWith('--')) throw new Error('옵션은 --이름 형식'); options[flag.slice(2)] = argv[0] && !argv[0].startsWith('--') ? argv.shift() : true; }
  const root = path.resolve(options.root ?? process.cwd());
  if (typeof options.batches !== 'string') throw new Error('--batches 필요');
  const ids = options.batches.split(',');
  if (ids.some(id => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))) throw new Error('배치 ID 오류');
  const { acquireGateRun } = await import('./content-loop.mjs');
  const releases = [];
  try { if (!options.plan) for (const id of [...new Set(ids)].sort()) releases.push(acquireGateRun(root, id)); console.log(json(await finalizeCodex({ ...options, root }))); }
  finally { for (const release of releases.reverse()) release(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(error => { console.error(error.message); process.exitCode = 1; });
