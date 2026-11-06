#!/usr/bin/env node
// 여러 staging 배치의 현판 S1/S2와 해설 근거만 모은다. 공개·반영·수정·firstPassComplete는 runGate의 몫이다.
// node tools/orchestrate/pre-review.mjs --batches Q50-G3-024,Q50-G3-025 --stage-only --without-claude --plan
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { acquireGateRun, createGateRuntime } from './content-loop.mjs';
import { load as loadBank } from './review.mjs';

const flags = new Set(['plan', 'stage-only', 'without-claude', 'recheck-codex', 'skip-argon-fresh', 'skip-level-spotcheck']);
const values = new Set(['root', 'batches', 'summary-file', 'codex-model', 'codex-effort']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => hash(JSON.stringify(value));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const key = q => `${q.questionId ?? q.id}@${q.revision}`;
const fail = message => { throw new Error(message); };

export function parsePreReviewArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match || Object.hasOwn(out, match[1])) fail(`옵션 오류 또는 중복: ${argv[i]}`);
    const [, name, inline] = match;
    if (flags.has(name)) { if (inline !== undefined) fail(`--${name}는 값 없는 플래그`); out[name] = true; }
    else if (values.has(name)) {
      const value = inline ?? argv[++i];
      if (!value || value.startsWith('--')) fail(`--${name} 값 필요`);
      out[name] = value;
    } else fail(`알 수 없는 옵션: ${name}`);
  }
  return out;
}
function config(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('옵션 객체 필요');
  for (const [name, value] of Object.entries(input)) {
    if (!flags.has(name) && !values.has(name)) fail(`알 수 없는 옵션: ${name}`);
    if (flags.has(name) ? typeof value !== 'boolean' : typeof value !== 'string' || !value.trim()) fail(`옵션 값 오류: ${name}`);
  }
  if (input['stage-only'] !== true || input['without-claude'] !== true) fail('--stage-only --without-claude 필수');
  if (input['codex-model'] !== undefined && input['codex-model'] !== 'gpt-6-astra') fail('gpt-6-astra 모델만 허용');
  if (input['codex-effort'] !== undefined && input['codex-effort'] !== 'high') fail('high 추론만 허용');
  if (!input.batches) fail('--batches 필수');
  const ids = input.batches.split(',').map(id => id.trim());
  if (ids.some(id => !/^Q50-G[3-6]-\d{3}$/.test(id)) || new Set(ids).size !== ids.length) fail('배치 ID 오류 또는 중복');
  const root = path.resolve(input.root ?? process.cwd());
  const file = path.resolve(root, input['summary-file'] ?? `.orchestrate/pre-review/${Date.now()}-${randomUUID()}.json`);
  if (!file.startsWith(path.join(root, '.orchestrate/pre-review') + path.sep)) fail('요약은 .orchestrate/pre-review/ 아래 새 파일만 허용');
  return { ...input, root, batches: ids.join(','), ids, file, 'codex-model': 'gpt-6-astra', 'codex-effort': 'high', 'review-concurrency': 1, 'argon-per-hour': 40, argon: 1, codex: 1 };
}
function resourceProbe() {
  const result = spawnSync('/Users/bodyking/.local/bin/resource-guard', ['status', '--profile', 'avatar'], { encoding: 'utf8' });
  if (result.status !== 0) fail(`자원 검사 실패: ${result.error?.message ?? result.stderr}`);
  return JSON.parse(result.stdout);
}
function inputFiles(root, ids) {
  const pinned = new Map();
  const pin = file => { const bytes = fs.readFileSync(file); pinned.set(file, hash(bytes)); return bytes; };
  const walk = dir => { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, e.name); if (e.isSymbolicLink()) fail(`입력 symlink 금지: ${file}`); if (e.isDirectory()) walk(file); else pin(file); } };
  for (const id of ids) {
    const dir = path.join(root, '.orchestrate/staging', id);
    const manifests = fs.existsSync(dir) ? fs.readdirSync(dir).map(run => path.join(dir, run, 'manifest.json')).filter(fs.existsSync) : [];
    if (!manifests.length) fail(`${id}: staging 배치가 없다`);
    for (const file of manifests) {
      const manifest = JSON.parse(pin(file));
      if (manifest.batchId !== id || !Array.isArray(manifest.writes)) fail(`${id}: staging 배치 불일치`);
      for (const w of manifest.writes) {
        if (typeof w.path !== 'string' || path.isAbsolute(w.path) || w.path.split('/').includes('..')) fail('staging 입력 경로 오류');
        const bytes = pin(path.join(path.dirname(file), 'files', w.path));
        if (hash(bytes) !== w.sha256) fail(`${id}: staging 해시 불일치: ${w.path}`);
      }
    }
    walk(path.join(root, 'content-source/batches', id));
    walk(path.join(root, 'content-source/reviews', id));
    for (const relative of [`content-source/levels/${id}.json`, `content-source/approvals/${id}.explanation.json`]) if (fs.existsSync(path.join(root, relative))) pin(path.join(root, relative));
  }
  return pinned;
}
function unchanged(files) {
  for (const [file, expected] of files) if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== expected) fail(`스테이징/추적 원본 불변 조건 위반: ${file}`);
}
function fingerprint(q, bank) {
  // S1이 native로 보강하는 두 필드만 제외한다. 정답·출처·언어·해설·판 번호는 보존한다.
  const protectedDraft = { ...q }; delete protectedDraft.difficultyTier; delete protectedDraft.gradeBasis;
  return { contentHash: bank.contentHash(q), rationalesHash: bank.rationalesHash(q), protectedHash: digest(protectedDraft) };
}
function sidecarHash(batch) {
  if (!batch?.sidecar) fail('현재 배치 자체 반박 근거 없음');
  const side = { ...batch.sidecar }; delete side.publicationPolicy;
  return digest(side);
}
function stateRows(runtime, ids, bank, baseline) {
  const states = new Map(), identities = new Map(), sidecars = new Map();
  for (const id of ids) {
    const state = runtime.snapshot(id);
    if (!state || !Array.isArray(state.drafts) || !state.drafts.length) fail(`${id}: 현판 초안 없음`);
    states.set(id, state); sidecars.set(id, sidecarHash(runtime.batch(id)));
    for (const q of state.drafts) {
      if (q.batchId !== id || !Number.isSafeInteger(q.revision) || q.revision < 1 || q.grade !== Number(/^Q50-G([3-6])-/.exec(id)[1]) || identities.has(q.id)) fail(`${id}: 현판 ID/학년/revision 오류`);
      identities.set(q.id, { batchId: id, questionId: q.id, revision: q.revision, grade: q.grade, ...fingerprint(q, bank) });
    }
    const current = new Set(state.drafts.map(key));
    for (const field of ['levelPending', 'codexPending', 'argonPending', 'codexFinalPending']) {
      if (!Array.isArray(state[field]) || new Set(state[field]).size !== state[field].length || state[field].some(k => !current.has(k))) fail(`${id}: ${field} 현판 불일치`);
    }
  }
  if (baseline && (digest([...identities]) !== digest([...baseline.identities]) || digest([...sidecars]) !== digest([...baseline.sidecars]))) fail('현판/출처/자체 반박 불변 조건 위반');
  return { states, identities, sidecars };
}
function groupsOf(snapshot, stage) {
  const grouped = new Map();
  for (const [id, state] of snapshot.states) {
    let keys = state[stage === 'S1' ? 'levelPending' : stage === 'S2' ? 'codexPending' : 'codexFinalPending'];
    if (stage === 'S4') {
      if (state.levelPending.length || state.codexPending.length || state.argonPending.length || state.front.batchDefects.length) continue;
      const passed = new Set(state.front.items.filter(item => item.status === 'pass').map(key)); keys = keys.filter(k => passed.has(k));
    }
    for (const k of keys) {
      const q = state.drafts.find(q => key(q) === k), refs = grouped.get(q.grade) ?? [];
      refs.push({ batchId: id, questionId: q.id, revision: q.revision }); grouped.set(q.grade, refs);
    }
  }
  return [...grouped].sort(([a], [b]) => a - b).flatMap(([grade, refs]) => {
    const chunks = []; for (let i = 0; i < refs.length; i += 50) chunks.push({ stage, grade, refs: refs.slice(i, i + 50) }); return chunks;
  });
}

/** deps.runtime/bank/resourceProbe는 모델 없는 회귀 시험 주입점이다. 실패 요약을 반환하며 재시도하지 않는다. */
export async function runPreReview(input, deps = {}) {
  const options = config(input), { root, ids, file } = options;
  const summary = { status: options.plan ? 'planned' : 'running', pid: process.pid, startedAt: new Date().toISOString(), batches: ids,
    config: { model: 'gpt-6-astra', effort: 'high', stageOnly: true, withoutClaude: true }, modelCalls: { argon: 0, codex: 0 }, modelCallsBasis: 'measured', stages: [], locks: [], remaining: {} };
  const releases = [];
  let ownedSummary = false;
  const save = () => { if (ownedSummary) fs.writeFileSync(file, JSON.stringify(summary, null, 2) + '\n'); };
  const abortSleep = async () => { fail('모델 한도 대기/자동 재시도 금지'); };
  try {
    if (!options.plan) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' }); ownedSummary = true;
      for (const id of [...ids].sort()) releases.push(acquireGateRun(root, id));
    } else for (const id of ids) {
      const lock = path.join(root, '.orchestrate/gate-locks', `${id}.json`);
      if (fs.existsSync(lock)) summary.locks.push({ batchId: id, ...read(lock), executionBlockedUntilReleased: true });
    }
    const runtime = deps.runtime ?? await (deps.createRuntime ?? createGateRuntime)({ ...options, sleep: abortSleep });
    if (JSON.stringify([...runtime.ids].sort()) !== JSON.stringify([...ids].sort())) fail('runtime 대상 배치 불일치');
    const bank = deps.bank ?? await loadBank(root), files = inputFiles(root, ids);
    const baseline = stateRows(runtime, ids, bank);
    summary.inputHashes = Object.fromEntries([...files].map(([p, value]) => [path.relative(root, p), value]));
    summary.questions = [...baseline.identities.values()];
    const fresh = () => { unchanged(files); return stateRows(runtime, ids, bank, baseline); };
    const checkResource = () => {
      const probe = (deps.resourceProbe ?? resourceProbe)();
      summary.resource = probe; summary.resourceCheckedAt = new Date().toISOString(); save();
      if (probe?.판단?.allowed !== true || !Number.isFinite(probe?.측정?.headroom_estimate_gib) || probe.측정.headroom_estimate_gib < 7) fail('자원 대기: avatar 허용 및 여유 7GiB 이상 필요');
    };
    if (options.plan) {
      summary.stages = ['S1', 'S2', 'S4'].flatMap(stage => groupsOf(baseline, stage));
      summary.note = '현판 읽기 계획만. S4 대상은 S1/S2 뒤 다시 계산한다. gate 잠금은 변경하지 않았다.';
      unchanged(files); return summary;
    }
    for (const stage of ['S1', 'S2', 'S4']) {
      for (const group of groupsOf(fresh(), stage)) {
        const record = { ...group, status: 'running', startedAt: new Date().toISOString(), events: [], modelCalls: { argon: 0, codex: 0 } };
        summary.stages.push(record); save();
        const calls = new Set(); let stopped;
        const onEvent = event => {
          try {
            if (stopped) throw stopped;
            if (event.type === 'call') {
              const who = event.who === 'antigravity' ? 'argon' : event.who;
              if (!['argon', 'codex'].includes(who) || (stage !== 'S1' && who !== 'codex')) fail('미허용 모델 호출');
              const owners = [...new Set(event.batchIds ?? group.refs.map(r => r.batchId))].sort();
              if (!owners.length || owners.some(id => !group.refs.some(r => r.batchId === id))) fail('모델 호출 소유 배치 불일치');
              const callKey = JSON.stringify([who, event.phase, owners]);
              if (event.attempt !== 1 || calls.has(callKey)) fail('native 모델 재시도 금지');
              fresh(); checkResource(); calls.add(callKey);
              summary.modelCalls[who]++; record.modelCalls[who]++;
            }
            record.events.push({ ...event, at: new Date().toISOString() }); save();
          } catch (error) { stopped = error; throw error; }
        };
        try {
          fresh(); checkResource();
          // 같은 모델의 후속 요청도 실패 뒤 시작하지 않는다. native가 이미 시작한 판정은 기다린다.
          let queue = Promise.resolve();
          const serial = fn => { const next = queue.then(() => { if (stopped) throw stopped; return fn(); }).catch(error => { stopped = error; throw error; }); queue = next.catch(() => {}); return next; };
          record.results = stage === 'S1' ? await runtime.levelQuestions(group.refs, onEvent, { argon: serial, codex: serial })
            : stage === 'S2' ? await runtime.reviewQuestions(group.refs, 'codex', onEvent)
            : await runtime.finalizeQuestions(group.refs, onEvent);
          if (stopped) throw stopped;
          const after = fresh(), field = stage === 'S1' ? 'levelPending' : stage === 'S2' ? 'codexPending' : 'codexFinalPending';
          if (group.refs.some(ref => after.states.get(ref.batchId)[field].includes(key(ref)))) fail(`${stage}: 요청한 현판 대기가 남음`);
          record.status = 'complete';
        } catch (error) { record.status = 'failed'; record.error = { message: error.message, ...(error.code ? { code: error.code } : {}) }; throw error; }
        finally { record.endedAt = new Date().toISOString(); save(); }
      }
    }
    for (const [id, state] of fresh().states) summary.remaining[id] = {
      levelPending: state.levelPending.length, codexPending: state.codexPending.length, argonPending: state.argonPending.length, codexFinalPending: state.codexFinalPending.length,
      frontDefects: state.front.items.filter(item => item.status === 'defect').length, batchDefects: state.front.batchDefects,
      next: 'runGate에서 S3/S5 및 firstPassComplete 처리',
    };
    summary.status = 'complete';
  } catch (error) {
    summary.status = 'failed'; summary.error = { message: error.message, ...(error.code ? { code: error.code } : {}) };
  } finally {
    for (const release of releases.reverse()) {
      try { release(); } catch (error) { summary.status = 'failed'; (summary.releaseErrors ??= []).push(error.message); }
    }
    summary.endedAt = new Date().toISOString(); if (ownedSummary) summary.summaryFile = path.relative(root, file); save();
  }
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runPreReview(parsePreReviewArgs(process.argv.slice(2))).then(summary => { console.log(JSON.stringify(summary)); if (summary.status === 'failed') process.exitCode = 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
