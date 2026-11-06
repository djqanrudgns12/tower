#!/usr/bin/env node
// 공동검수 6단계 자동화: fail·uncertain을 받은 문항을 작성자(Argon)에게 돌려보내 revision을 올린다.
// 지적 근거는 은행 판정(decide)의 결함 사유와 검수 보고서 findings다. "검수 없음" 같은 미완 사유는 결함으로 보지 않는다.
// Argon 답장을 검사한 뒤 staging에 쌓는다. 추적 파일 반영은 잠금 적용기만 한다.
// 대상 낱말·근거(source)는 바꾸지 못한다. 고칠 수 없으면 drop으로 답하고 sidecar.rejected에 남긴다.
//
//   node tools/orchestrate/revise.mjs status --root <dir>
//   node tools/orchestrate/revise.mjs prompt --root <dir> --batch Q50-G3-004
//   node tools/orchestrate/revise.mjs run --root <dir> [--batches A,B | --all] [--parallel 2] [--author antigravity|codex]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { runnerImport } from 'vite';
import { AGY_MODEL } from './agy.mjs';
import { questionRefs, measuredAgyCall, modelAttempt } from './review.mjs';

const BRIDGE = process.env.AGENT_BRIDGE ?? path.join(os.homedir(), '.local/bin/agent-bridge');
const CHUNK = 12;
const MAX_REVISION_ROUNDS = 2; // 이번 작업의 front·gate 각각 두 번. 기존 revision 번호와 무관하다.
const MISSING = /독립 검토 없음|해설 대조 없음|Claude가 아님|검수 없음/;

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else out._.push(a);
  }
  return out;
}
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };

export async function load(root) {
  const imp = p => runnerImport(path.join(root, p), { configFile: false, logLevel: 'error', root }).then(r => r.module);
  return { root, b: await imp('tools/content/bankBuild.ts'), d: await imp('src/contracts/questionDraft.ts'), lint: await imp('src/content/lint.ts'), front: await imp('tools/content/frontGate.ts') };
}

/** 아직 반영되지 않은 대기 결과도 읽어 재시작 때 초안·회차를 되감지 않는다. */
export function pendingJson(root, batchId, relative, fallback = null) {
  let value = fs.existsSync(path.join(root, relative)) ? readJson(path.join(root, relative)) : fallback;
  const dir = path.join(root, '.orchestrate/staging', batchId);
  if (!fs.existsSync(dir)) return value;
  for (const run of fs.readdirSync(dir).sort()) {
    const manifestPath = path.join(dir, run, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (manifest.batchId !== batchId) throw new Error('staging 배치 ID 불일치');
    const write = manifest.writes.find(w => w.path === relative);
    if (write) {
      const bytes = fs.readFileSync(path.join(dir, run, 'files', relative));
      if (createHash('sha256').update(bytes).digest('hex') !== write.sha256) throw new Error(`staging 해시 불일치: ${relative}`);
      value = JSON.parse(bytes.toString('utf8'));
    }
    if (manifest.deletes.includes(relative)) value = fallback;
  }
  return value;
}

const batchFile = (id, name) => `content-source/batches/${id}/${name}.json`;
const emptyRounds = () => ({ front: 0, gate: 0, dropped: false, history: [] });
export function readReviseLog(root, batchId) {
  const log = pendingJson(root, batchId, batchFile(batchId, 'revise-log'), { batchId, items: {} });
  if (log.batchId !== batchId || !log.items || typeof log.items !== 'object'
    || Object.values(log.items).some(i => !['front', 'gate'].every(p => Number.isInteger(i[p]) && i[p] >= 0 && i[p] <= MAX_REVISION_ROUNDS)
      || typeof i.dropped !== 'boolean' || !Array.isArray(i.history))) throw new Error('수정 회차 기록 형식 오류');
  return log;
}

function stagedBatch(root, batch) {
  if (pendingJson(root, batch.batchId, batchFile(batch.batchId, 'closed'))) return null;
  const read = (relative, fallback) => pendingJson(root, batch.batchId, relative, fallback);
  return { ...batch,
    drafts: read(batchFile(batch.batchId, 'drafts'), batch.drafts),
    sidecar: read(batchFile(batch.batchId, 'sidecar'), batch.sidecar),
    reviews: Object.fromEntries(['codex', 'claude'].map(who => [who, read(`content-source/reviews/${batch.batchId}/${who}.json`, batch.reviews[who])])),
    argonBlind: read(`content-source/reviews/${batch.batchId}/argon-blind.json`, batch.argonBlind),
    explanation: read(`content-source/approvals/${batch.batchId}.explanation.json`, batch.explanation),
  };
}

/** 앞단 결함이 우선이며, 관문에서는 Claude 지적·총괄 해설 fail만 고친다. */
export function flagged(m, batch, options = {}) {
  if (!batch) return [];
  const root = options.root ?? m.root;
  if (root) batch = stagedBatch(root, batch);
  if (!batch) return [];
  const level = options.levelFile ?? (root ? pendingJson(root, batch.batchId, `content-source/levels/${batch.batchId}.json`) : null);
  const log = options.reviseLog ?? (root ? readReviseLog(root, batch.batchId) : { items: {} });
  const front = m.front.frontGate(batch, level, { root, ...options });
  const decisions = m.b.decide(batch);
  const out = [];
  for (const item of front.items) {
    const q = batch.drafts.find(x => x.id === item.questionId && x.revision === item.revision);
    const gate = decisions.find(d => d.questionId === q.id && d.revision === q.revision).reasons
      .filter(r => !MISSING.test(r) && (r.startsWith('claude:') || r.startsWith('총괄 해설 대조 fail')));
    const reasons = [...new Set([...item.defects, ...gate])];
    if (!reasons.length) continue;
    const findings = [];
    for (const [who, rep] of [['codex', batch.reviews.codex], ['claude', batch.reviews.claude], ['argon-blind', batch.argonBlind]]) {
      const it = rep?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === item.contentHash);
      if (it) findings.push(...it.findings.map(f => `${who}: ${f}`));
    }
    out.push({ q, phase: item.defects.length ? 'front' : 'gate', reasons, findings, rounds: log.items[q.id] ?? emptyRounds() });
  }
  return out;
}

function evidenceOf(root, batchId, q) {
  const p = path.join(root, 'content-source/batches', batchId, 'evidence', q.source.evidenceArtifactId);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '(근거 파일 없음)';
}

export function promptFor(root, batchId, list) {
  const items = list.map(({ q, phase, rounds, reasons, findings }) => ({ draft: q, phase, revisionRounds: rounds, evidenceText: evidenceOf(root, batchId ?? q.batchId, q), defects: reasons, reviewerFindings: findings }));
  return [
    '너는 대한민국 초등학교 3~6학년용 한국어 어휘 문항의 작성자(Argon)다. 총괄은 Claude다. 아래 문항들은 공동검수에서 결함이 지적되어 격리되었다.',
    '입력에 문항과 사전 근거를 모두 제공했으므로 파일을 읽거나 추가 조회하지 말고 입력만으로 답한다. 파일 쓰기·명령 실행도 금지한다. 고친 결과를 답장 JSON으로만 보낸다(총괄의 도구가 검사해 파일에 쓴다).',
    '',
    '문항마다 둘 중 하나로 답한다.',
    '1) 고친다(action "revise"): changes 객체에 실제로 바꿀 필드만 보낸다. 바꾸지 않는 필드는 생략하고 draft 전체는 보내지 않는다.',
    '   - 도구가 원래 draft에 changes를 합치고 revision을 정확히 1 올려 status를 "machine_checked"로 기록한다. revision·status·id·batchId·grade·target·source·gradeBasis·review·schemaVersion은 응답에 쓰지 않는다(대상 낱말과 사전 근거는 바꿀 수 없다).',
    '   - 바꿀 수 있는 것: stem, options(a~d 4개), correctOptionId, explanation, distractorRationales(오답 3개에만 하나씩), type, difficultyTier, variantTag, dialectRegion(방언일 때만, 방언은 challenge만).',
    '   - 실제 결함을 해소한다: 정답이 문맥상 하나뿐, 다른 보기는 분명히 틀림, 자연스러운 문장(문맥 조각 뒤에 기본형을 붙인 비문 금지), 맞춤법·띄어쓰기·조사 호응, 학년에 맞는 쉬운 보기 말, 뜻을 몰라도 형식만으로 정답이 드러나는 단서 없음, 어린이에게 알맞은 내용, 해설·오답 이유는 각 60자 이내.',
    '   - 실제 결함만 최소한으로 고친다. [권고] 제안은 수정 의무가 아니며 이미 자연스럽고 정확한 부분은 유지한다. 추상 명사 나열·어색한 직역·억지 교훈·내용 없는 상투 문장(AI SLOP)을 넣지 않는다. 아이가 겪을 만한 구체적인 상황과 짧고 분명한 말로 쓴다.',
    '   - 정답 뜻은 evidenceText(표준국어대사전 뜻풀이)와 맞아야 한다. 사전 용례를 그대로 베끼지 않는다.',
    '   - selfRefutation: 네 보기를 지문에 하나씩 대입해 정답만 "fits", 나머지는 "does_not_fit"과 이유. uniquenessNote·gradeEvidence도 쓴다.',
    `2) 버린다(action "drop"): 이 낱말·뜻으로는 아이들에게 알맞은 유일 정답 문항을 만들 수 없을 때. reason에 이유를 쓴다. 이번 작업에서 그 단계(front 또는 gate)의 ${MAX_REVISION_ROUNDS}회 한도를 다 쓴 문항이 또 지적되면 버린다. revision 번호가 아니라 revisionRounds[phase]로 판단한다.`,
    '',
    '출력: 아래 형식의 JSON 하나만 ```json 코드 블록으로. 입력의 모든 문항에 하나씩 답한다.',
    '{"items":[{"questionId":"…","action":"revise","changes":{…실제로 바꿀 필드만…},"selfRefutation":[{"optionId":"a","substituted":"…","verdict":"does_not_fit","reason":"…"},…4개],"uniquenessNote":"…","gradeEvidence":"…"},{"questionId":"…","action":"drop","reason":"…"}]}',
    '',
    '----- 입력 -----',
    JSON.stringify({ batchId, items }, null, 1),
  ].join('\n');
}

const CHANGE_FIELDS = new Set(['stem', 'options', 'correctOptionId', 'explanation', 'distractorRationales', 'type', 'difficultyTier', 'variantTag', 'dialectRegion']);
const FIXED = ['schemaVersion', 'batchId', 'id', 'grade', 'gradeBasis', 'target', 'source', 'review'];

/** 답장을 검사해 적용할 변경을 돌려준다. 문항 하나라도 틀리면 그 문항만 이유와 함께 거절한다. */
export function parseRevisions(m, text, list, reviseLog = null) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(raw);
  const byId = new Map(list.map(x => [x.q.id, x]));
  const accepted = [];
  const rejected = [];
  for (const it of data.items ?? []) {
    const cur = byId.get(it.questionId);
    if (!cur) { rejected.push(`${it.questionId}: 요청하지 않은 문항`); continue; }
    byId.delete(it.questionId);
    const phase = cur.phase ?? 'front';
    const meta = { phase, reasons: cur.reasons ?? [] };
    const rounds = reviseLog?.items[cur.q.id] ?? cur.rounds ?? emptyRounds();
    if (rounds[phase] >= MAX_REVISION_ROUNDS) {
      accepted.push({ action: 'drop', q: cur.q, ...meta, reason: `${phase} 수정 ${MAX_REVISION_ROUNDS}회 한도 소진` });
      continue;
    }
    if (it.action !== 'revise' && it.action !== 'drop') { rejected.push(`${it.questionId}: 알 수 없는 action`); continue; }
    if (it.action === 'drop') {
      if (typeof it.reason !== 'string' || !it.reason) rejected.push(`${it.questionId}: drop 이유 없음`);
      else accepted.push({ action: 'drop', q: cur.q, ...meta, reason: it.reason });
      continue;
    }
    let candidate = it.draft;
    if (Object.hasOwn(it, 'changes')) {
      if (Object.hasOwn(it, 'draft')) { rejected.push(`${it.questionId}: draft와 changes를 함께 쓸 수 없다`); continue; }
      if (!it.changes || typeof it.changes !== 'object' || Array.isArray(it.changes)) {
        rejected.push(`${it.questionId}: changes는 객체여야 한다`); continue;
      }
      const forbidden = Object.keys(it.changes).filter(key => !CHANGE_FIELDS.has(key));
      if (forbidden.length) { rejected.push(`${it.questionId}: changes에 허용되지 않은 필드: ${forbidden.join(', ')}`); continue; }
      candidate = { ...cur.q, ...it.changes, revision: cur.q.revision + 1, status: 'machine_checked' };
    }
    const problems = [];
    const draft = m.d.questionDraftSchema.safeParse(candidate);
    if (!draft.success) problems.push(`초안 형식: ${draft.error.issues.slice(0, 3).map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`);
    else {
      for (const k of FIXED) if (JSON.stringify(draft.data[k]) !== JSON.stringify(cur.q[k])) problems.push(`${k}는 바꿀 수 없다`);
      if (draft.data.revision !== cur.q.revision + 1) problems.push(`revision은 ${cur.q.revision + 1}이어야 한다`);
      const bank = m.b.toBankQuestion(draft.data);
      problems.push(...m.lint.lintQuestion(bank).map(p => `의미 검사: ${p}`));
    }
    const side = { id: it.questionId, revision: cur.q.revision + 1, selfRefutation: it.selfRefutation, uniquenessNote: it.uniquenessNote, gradeEvidence: it.gradeEvidence };
    const sideOk = m.d.draftSidecarSchema.shape.items.element.safeParse(side);
    if (!sideOk.success) problems.push(`자체 반박 형식: ${sideOk.error.issues.slice(0, 2).map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`);
    else if (draft.success) {
      const fits = sideOk.data.selfRefutation.filter(r => r.verdict === 'fits').map(r => r.optionId);
      if (fits.length !== 1 || fits[0] !== draft.data.correctOptionId || new Set(sideOk.data.selfRefutation.map(r => r.optionId)).size !== 4) problems.push('자체 반박에서 정답만 fits여야 한다');
    }
    if (problems.length) rejected.push(`${it.questionId}: ${problems.join('; ')}`);
    else accepted.push({ action: 'revise', q: cur.q, ...meta, draft: draft.data, side: sideOk.data });
  }
  for (const id of byId.keys()) rejected.push(`${id}: 답이 없다`);
  return { accepted, rejected };
}

/** 관문을 통과한 같은 판만 고정한다. 다른 앞단 결함 여부와 무관하게 Claude 결과를 보존한다. */
export function gatePassedKeys(m, batch) {
  return new Set(batch.drafts.filter(q => {
    const hash = m.b.contentHash(q);
    const review = batch.reviews.claude?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash);
    const exp = batch.explanation?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === hash && i.rationalesHash === m.b.rationalesHash(q));
    return review?.blindChoice === q.correctOptionId && ['source', 'uniqueness', 'grade', 'language'].every(k => review.verdicts[k] === 'pass')
      && review.verdicts.explanation !== 'fail' && exp?.explanation === 'pass' && m.b.isCommanderModel(batch.explanation.reviewer.model);
  }).map(q => `${q.id}@${q.revision}`));
}

export async function apply(root, batchId, accepted, options = {}) {
  const m = options.modules ?? await load(root);
  let drafts = pendingJson(root, batchId, batchFile(batchId, 'drafts'));
  const originalDrafts = structuredClone(drafts);
  const sidecar = pendingJson(root, batchId, batchFile(batchId, 'sidecar'));
  const reviseLog = readReviseLog(root, batchId);
  if (pendingJson(root, batchId, batchFile(batchId, 'closed'))) throw new Error('종료한 배치는 수정할 수 없다');
  const stagingDir = path.join(root, '.orchestrate/staging', batchId);
  const lastTime = fs.existsSync(stagingDir) ? Math.max(0, ...fs.readdirSync(stagingDir).map(run => {
    const manifest = path.join(stagingDir, run, 'manifest.json');
    return fs.existsSync(manifest) ? (Date.parse(readJson(manifest).createdAt) || 0) : 0;
  })) : 0;
  const createdAt = new Date(Math.max(Date.now(), lastTime + 1)).toISOString();
  const record = (q, phase, revisionTo, reasons, dropped = false) => {
    const item = reviseLog.items[q.id] ??= emptyRounds();
    if (!dropped) item[phase]++;
    item.dropped = dropped;
    item.history.push({ phase, revisionFrom: q.revision, revisionTo, at: createdAt, reasons });
  };
  const seen = new Set();
  for (const a of accepted) {
    const current = drafts.find(q => q.id === a.q.id);
    if (seen.has(a.q.id) || !current || current.revision !== a.q.revision || m.b.contentHash(current) !== m.b.contentHash(a.q)
      || m.b.rationalesHash(current) !== m.b.rationalesHash(a.q)) throw new Error(`${a.q.id}: 수정 대상이 현재 초안과 다르다`);
    seen.add(a.q.id);
    const phase = a.phase ?? 'front';
    if (!['front', 'gate'].includes(phase)) throw new Error('알 수 없는 수정 단계');
    const overLimit = (reviseLog.items[a.q.id]?.[phase] ?? 0) >= MAX_REVISION_ROUNDS;
    if (a.action === 'drop' || overLimit) {
      const reason = overLimit ? `${phase} 수정 ${MAX_REVISION_ROUNDS}회 한도 소진` : a.reason;
      drafts = drafts.filter(q => q.id !== a.q.id);
      sidecar.items = sidecar.items.filter(i => i.id !== a.q.id);
      sidecar.rejected.push({ lemma: a.q.target.lemma, reason: `${a.q.id} r${a.q.revision} 공동검수 결함으로 제외: ${reason}` });
      record(a.q, phase, null, [...(a.reasons ?? []), reason], true);
    } else {
      drafts = drafts.map(q => (q.id === a.q.id ? a.draft : q));
      sidecar.items = [...sidecar.items.filter(i => i.id !== a.q.id), a.side];
      record(a.q, phase, a.draft.revision, a.reasons ?? []);
    }
  }
  const batch = options.batch ?? m.b.loadBatches(root).find(b => b.batchId === batchId);
  const locked = new Set(options.gatePassed ?? gatePassedKeys(m, stagedBatch(root, batch)));
  for (const q of drafts) if (!seen.has(q.id) && (reviseLog.items[q.id]?.front ?? 0) >= MAX_REVISION_ROUNDS) locked.add(`${q.id}@${q.revision}`);
  const fixed = batchId.startsWith('Q50-') && drafts.length
    ? m.front.fixBatchStrict(drafts, sidecar, locked)
    : { drafts, sidecar, changed: [] };
  // 자동 보기 이동도 독립된 앞단 수정이다. 같은 호출에서 고친 문항은 아직 반영 전이므로 한 회차로 합친다.
  for (const key of fixed.changed) {
    const q = fixed.drafts.find(q => `${q.id}@${q.revision}` === key);
    const before = drafts.find(d => d.id === q.id);
    const item = reviseLog.items[q.id];
    if (seen.has(q.id)) {
      q.revision--;
      fixed.sidecar.items.find(s => s.id === q.id && s.revision === q.revision + 1).revision--;
      item.history.at(-1).revisionTo = q.revision;
      item.history.at(-1).reasons.push('배치 엄격 결함: 보기 순서 재배열');
    } else {
      if ((item?.front ?? 0) >= MAX_REVISION_ROUNDS) throw new Error(`${q.id}: 보기 재배열에 필요한 앞단 수정 한도 소진`);
      record(before, 'front', q.revision, ['배치 엄격 결함: 보기 순서 재배열']);
    }
  }
  fixed.changed = fixed.changed.map(key => {
    const id = key.slice(0, key.lastIndexOf('@'));
    return `${id}@${fixed.drafts.find(q => q.id === id).revision}`;
  });
  if (fixed.drafts.length) m.d.draftBatchSchema.parse(fixed.drafts);
  m.d.draftSidecarSchema.parse(fixed.sidecar);
  const writes = new Map();
  writes.set(batchFile(batchId, 'sidecar'), fixed.sidecar);
  writes.set(batchFile(batchId, 'revise-log'), reviseLog);
  if (fixed.drafts.length) writes.set(batchFile(batchId, 'drafts'), fixed.drafts);
  else writes.set(batchFile(batchId, 'closed'), { batchId, closedAt: createdAt, reason: '공동검수 수정 후 모든 문항 버림' });
  if (!originalDrafts.length) throw new Error('빈 원본 배치는 종료 표시로 처리해야 한다');
  const runId = `${createdAt.replace(/[-:.]/g, '')}-${process.pid}-${randomUUID()}`;
  const staging = `.orchestrate/staging/${batchId}/${runId}`;
  const manifest = { batchId, runId, tool: 'revise', model: options.model ?? 'antigravity', createdAt, writes: [], deletes: [] };
  for (const [file, value] of writes) {
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    const destination = path.join(root, staging, 'files', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    manifest.writes.push({ path: file, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  writeJson(path.join(root, staging, 'manifest.json'), manifest);
  return { staging, changed: fixed.changed, closed: !fixed.drafts.length };
}

export function author(who, cwd, body, options = {}) {
  if (who === 'antigravity') return (options.agyCall ?? measuredAgyCall)({ root: options.root, cwd, prompt: body, model: AGY_MODEL, timeoutSec: 1200,
    onEvent: options.onEvent, callContext: options.callContext, argonPerHour: options.argonPerHour ?? options['argon-per-hour'], validate: options.validate });
  return new Promise(resolve => {
    const child = spawn(BRIDGE, ['ask', '--from', 'claude', '--to', who, '--cwd', cwd, '--wait', '1200', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => resolve({ code, out: out.trim(), err: err.trim() }));
    child.stdin.end(body);
  });
}

export async function reviseBatch(m, root, batchId, who, log, options = {}) {
  return (await reviseMany(m, root, [batchId], null, who, log, options))[0];
}

export async function reviseQuestions(m, root, questions, who = 'antigravity', log = console.log, options = {}) {
  const refs = questionRefs(questions);
  return reviseMany(m, root, [...new Set([...refs.map(q => q.batchId), ...(options.batchIds ?? [])])], refs, who, log, options);
}

async function reviseMany(m, root, ids, refs, who, log, options) {
  const all = m.b.loadBatches(root);
  const contexts = ids.map(batchId => {
    const loaded = all.find(x => x.batchId === batchId), batch = loaded ? stagedBatch(root, loaded) : null;
    const wanted = refs ? new Map(refs.filter(q => q.batchId === batchId).map(q => [`${q.questionId}@${q.revision}`, q.phase])) : null;
    const list = batch ? flagged(m, batch, { root }).filter(x => !wanted || (wanted.has(`${x.q.id}@${x.q.revision}`) && (!wanted.get(`${x.q.id}@${x.q.revision}`) || wanted.get(`${x.q.id}@${x.q.revision}`) === x.phase))) : [];
    return { batchId, batch, list };
  });
  const list = contexts.flatMap(ctx => ctx.list), owner = new Map();
  for (const ctx of contexts) for (const item of ctx.list) {
    if (owner.has(item.q.id)) throw new Error(`배치 간 중복 문항 ID: ${item.q.id}`);
    owner.set(item.q.id, ctx.batchId);
  }
  const accepted = [], rejected = new Set();
  const dir = path.join(root, '.orchestrate/revise', refs ? 'pool' : ids[0], randomUUID());
  const sealed = path.join(dir, 'sealed');
  fs.mkdirSync(sealed, { recursive: true });
  // 한도 초과 문항은 모델 입력에서 먼저 빼고, 남은 대상만 12개씩 꽉 채운다.
  const exhausted = list.filter(x => x.rounds[x.phase] >= MAX_REVISION_ROUNDS);
  accepted.push(...exhausted.map(x => ({ ...x, action: 'drop', reason: `${x.phase} 수정 ${MAX_REVISION_ROUNDS}회 한도 소진` })));
  const pending = list.filter(x => !exhausted.includes(x));
  for (let i = 0; i < pending.length; i += CHUNK) {
    let chunk = pending.slice(i, i + CHUNK), note = '';
    for (let attempt = 1; attempt <= 3 && chunk.length; attempt++) {
      const callContext = { batchIds: [...new Set(chunk.map(x => owner.get(x.q.id)))], phase: 'revise', attempt };
      const prompt = promptFor(root, refs ? undefined : ids[0], chunk) + note;
      const res = await modelAttempt(who === 'antigravity' ? 'argon' : who,
        () => options.respond ? options.respond({ who, prompt, items: chunk, cwd: sealed, attempt })
          : author(who, sealed, prompt, { ...options, root, callContext, validate: text => {
            const result = parseRevisions(m, text, chunk);
            if (result.rejected.length) throw new Error(result.rejected.join('; '));
          } }), { ...options, liveArgon: who === 'antigravity' && !options.respond && !options.agyCall }, callContext);
      fs.writeFileSync(path.join(dir, `chunk${i / CHUNK + 1}.reply${attempt}.md`), res.out || res.err || '');
      let parsed;
      try { parsed = parseRevisions(m, res.out, chunk); }
      catch (e) { log(`수정 묶음${i / CHUNK + 1} ${attempt}회차 답장 오류: ${e.message.slice(0, 200)}`); note = `\n지난 답장을 읽지 못했다(${e.message.slice(0, 200)}). 형식을 지켜 다시 답한다.`; continue; }
      accepted.push(...parsed.accepted);
      const done = new Set(parsed.accepted.map(a => a.q.id));
      chunk = chunk.filter(x => !done.has(x.q.id));
      if (parsed.rejected.length) note = `\n지난 답장에서 아래 문항이 검사를 통과하지 못했다. 이 문항만 고쳐 다시 답한다.\n${parsed.rejected.join('\n')}`;
    }
    for (const x of chunk) rejected.add(x.q.id);
  }
  const results = [];
  for (const { batchId, batch } of contexts) {
    const selected = accepted.filter(x => owner.get(x.q.id) === batchId);
    const needsRepair = batch && m.front.frontGate(batch, null).batchDefects.length;
    const staged = batch && (selected.length || needsRepair) ? await apply(root, batchId, selected, { modules: m, batch, model: who }) : {};
    results.push({ batchId, revised: selected.filter(x => x.action === 'revise').length,
      dropped: selected.filter(x => x.action === 'drop').length, rejected: [...rejected].filter(id => owner.get(id) === batchId).length, ...staged });
  }
  return results;
}

async function main() {
  const a = args(process.argv.slice(2));
  const root = path.resolve(a.root ?? path.resolve(import.meta.dirname, '../..'));
  const m = await load(root);
  if (a._[0] === 'run' && a['question-list']) {
    console.log(JSON.stringify(await reviseQuestions(m, root, a['question-list'], a.author ?? 'antigravity', console.log, a)));
    return;
  }
  const all = m.b.loadBatches(root);
  const log = msg => { const line = `[${new Date().toISOString()}] ${msg}`; console.log(line); fs.mkdirSync(path.join(root, '.orchestrate/revise'), { recursive: true }); fs.appendFileSync(path.join(root, '.orchestrate/revise/revise.log'), `${line}\n`); };
  if (a._[0] === 'status') {
    let total = 0;
    for (const batch of all) { const n = flagged(m, batch).length; total += n; if (n) console.log(`${batch.batchId}\t결함 ${n}`); }
    console.log(`합계 ${total}`);
    return;
  }
  if (a._[0] === 'prompt') { process.stdout.write(promptFor(root, a.batch, flagged(m, all.find(x => x.batchId === a.batch)))); return; }
  if (a._[0] === 'run') {
    const ids = a.all ? all.filter(x => {
      const current = stagedBatch(root, x);
      return current && (flagged(m, current).length || m.front.frontGate(current, null).batchDefects.length);
    }).map(x => x.batchId) : String(a.batches).split(',');
    const who = a.author ?? 'antigravity';
    const queue = [...ids];
    const results = [];
    const worker = async () => { while (queue.length) { const id = queue.shift(); try { const r = await reviseBatch(m, root, id, who, log, a); log(JSON.stringify(r)); results.push(r); } catch (e) { log(`${id} 실패: ${e.message}`); results.push({ batchId: id, error: e.message }); } } };
    await Promise.all(Array.from({ length: Math.min(Number((who === 'antigravity' ? a.argon : undefined) ?? a.parallel ?? 2), ids.length) }, worker));
    console.log(JSON.stringify(results, null, 1));
    return;
  }
  console.error('사용: revise.mjs status|prompt|run --root <dir> ...');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.stack ?? e.message); process.exit(1); });
