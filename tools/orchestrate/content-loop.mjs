#!/usr/bin/env node
// 문항 공동검수 전체 자동 루프(공동검수 절차 3~6단계, PRD §9.3). 배치마다:
//   Claude·Codex 2단계 블라인드 검수 → 결함 문항 Argon 수정(revision+1) → 고친 판을 다시 Claude·Codex 검수 (최대 2회)
// 각 단계의 대기분을 잠금 안에서 반영·빌드·커밋한다. 모든 단계가 "아직 안 한 것만" 하므로 멈춰도 다시 돌리면 이어 간다.
//
// --gate: S1 수준 → S2 앞단 검수 → S3 수정 → S4 Codex 최종 대조 → S5 Argon 수정. --plan은 다음 단계만 조회.
// --pool-after N: N배치의 첫 판 완료 뒤 전역 회차(수정12·수준/검수50). 생략하면 전체 배치.
// --until S3: 앞단 수정·재검수까지만 진행하고 최종 대조는 대기한다.
// --with-claude만 옛 Claude S4 사용. 기본값과 --without-claude는 Codex S4 사용.
// --stage-only --gate: 기존 추적 배치의 staging overlay만 전진, apply/build/test/git 없이 awaitingApply.
// 별도 실행은 --summary-file <경로>로 기록을 분리한다. 같은 배치의 standalone 도구/apply와 함께 실행하지 않는다.
// --skip-argon-fresh: 제작 배치의 추가 Argon 새 문맥 호출만 생략(기존 실패 판정은 유지).
// --skip-level-spotcheck: S1 참고용 표본 재호출만 생략(독립 2판정·합의 유지).
// --recheck-codex 및 --claude-model/--claude-effort/--codex-model/--codex-effort 지원.
//   node tools/orchestrate/content-loop.mjs --root <dir> [--batches A,B | --all] [--claude 2] [--codex 2] [--argon 2] [--rounds 2] [--commit | --no-commit]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import * as level from './level.mjs';
import { applyStaged, guardedServerTest } from './commit-lock.mjs';
import * as review from './review.mjs';
import * as revise from './revise.mjs';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return out;
}

/** 에이전트 종류별 동시 실행 상한. */
function pool(size) {
  let active = 0;
  const waiting = [];
  return async fn => {
    if (active >= size) await new Promise(r => waiting.push(r));
    else active++;
    try { return await fn(); } finally {
      const next = waiting.shift();
      if (next) next(); else active--;
    }
  };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a['stage-only'] && !a.gate && !a.plan) throw new Error('--stage-only는 --gate 또는 --plan과 함께 써야 한다');
  if (a.until && !a.gate && !a.plan) throw new Error('--until은 --gate 또는 --plan과 함께 써야 한다');
  if (a.gate || a.plan) {
    const summary = await runGate(a);
    console.log(JSON.stringify(summary));
    if (Object.values(summary).some(item => item.error)) process.exitCode = 1;
    return;
  }
  if (a.commit && a['no-commit']) throw new Error('--commit과 --no-commit을 함께 쓸 수 없다');
  const commit = !a['no-commit'];
  const configs = review.resolveReviewConfig(a);
  const root = path.resolve(a.root ?? path.resolve(import.meta.dirname, '../..'));
  const logFile = path.join(root, '.orchestrate/content-loop.log');
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = m => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); fs.appendFileSync(logFile, `${line}\n`); };
  const rb = await review.load(root);
  const rm = await revise.load(root);
  const batchOf = id => rb.loadBatches(root).find(x => x.batchId === id);
  const ids = a.all ? rb.loadBatches(root).map(x => x.batchId).filter(id => /^Q50-/.test(id)) : String(a.batches).split(',');
  const pools = { claude: pool(Number(a.claude ?? 2)), codex: pool(Number(a.codex ?? 2)), antigravity: pool(Number(a.argon ?? 2)) };
  const rounds = Number(a.rounds ?? 2);

  // 모델 호출은 병렬로 두되 같은 루프의 반영 요청은 순서대로 실행한다.
  // 한 반영이 실패하면 뒤 요청도 멈춰 미커밋 소스를 다음 배치에 섞지 않는다.
  let applying = Promise.resolve();
  const applyBatch = id => {
    applying = applying.then(async () => {
      const result = await applyStaged({ root, batch: id, noCommit: !commit });
      log(`${id} 잠금 반영: ${result.runs.length}회 · ${commit ? `커밋 ${result.commit ?? '변경 없음'}` : '미커밋 보존'}`);
      return result;
    });
    return applying;
  };
  const legacyMeter = (id, stage, round) => {
    const entry = summary[id] ??= { modelCallsBasis: 'measured', stages: [] };
    const record = { stage, round, modelCalls: emptyCalls(), waits: emptyCalls(), waitMs: emptyCalls(), modelCallsBasis: 'measured', startedAt: new Date().toISOString(), events: [] };
    entry.stages.push(record);
    return { record, onEvent(event) {
      record.events.push(event);
      if (event.type === 'call') record.modelCalls[event.who]++;
      else if (event.type === 'wait') { record.waits[event.who]++; record.waitMs[event.who] += event.durationMs; }
      fs.writeFileSync(path.join(root, '.orchestrate/content-loop.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    } };
  };
  const optionsFor = who => ({ config: configs[who], archiveExisting: a['archive-existing'] === true || a['archive-existing'] === who });

  const reviewWith = async (who, id, round) => {
    const options = optionsFor(who);
    if (!review.pending(rb, batchOf(id), who, options).length) return;
    const meter = legacyMeter(id, `review-${who}`, round);
    options.onEvent = meter.onEvent;
    await pools[who](async () => {
      await review.runPhase(rb, root, who, id, 'blind', log, options);
      await review.runPhase(rb, root, who, id, 'reveal', log, options);
      const r = await review.ingest(rb, root, who, id, options);
      log(`${id} ${who} 병합 대기 ${r.merged}문항 · 지적 ${r.flagged} (${r.staging})`);
    }).finally(() => { meter.record.endedAt = new Date().toISOString(); });
  };
  const reviewBoth = async (id, round = 0) => {
    // 한쪽 보고서가 거절될 때 다른 쪽 모델부터 실행하지 않는다.
    const batch = batchOf(id);
    for (const who of ['claude', 'codex']) review.pending(rb, batch, who, optionsFor(who));
    const results = await Promise.allSettled([reviewWith('claude', id, round), reviewWith('codex', id, round)]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  };

  const summary = {};
  // 미커밋 미리보기 뒤에는 다른 배치를 읽는 빌드를 시작할 수 없다.
  const workIds = commit ? ids : ids.slice(0, 1);
  if (!commit && ids.length > 1) log('--no-commit: 첫 배치만 반영한다. 커밋 후 나머지 배치를 이어 실행한다');
  for (const id of ids.slice(workIds.length)) summary[id] = { awaitingApply: true };
  await Promise.all(workIds.map(async id => {
    try {
      // 지난 실행의 대기분을 먼저 반영해야 옛 초안/보고서로 모델을 호출하지 않는다.
      const resumed = await applyBatch(id);
      if (!commit && resumed.runs.length) { summary[id] = { ...summary[id], awaitingCommit: true }; return; }
      if (!batchOf(id)) { summary[id] = { ...summary[id], closed: true }; return; }
      await reviewBoth(id);
      await applyBatch(id);
      if (!commit) { summary[id] = { ...summary[id], awaitingCommit: true }; return; }
      for (let round = 1; round <= rounds; round++) {
        const n = revise.flagged(rm, batchOf(id)).length;
        if (!n) break;
        const meter = legacyMeter(id, 'revise', round);
        const r = await pools.antigravity(() => revise.reviseBatch(rm, root, id, 'antigravity', log, { ...a, onEvent: meter.onEvent }))
          .finally(() => { meter.record.endedAt = new Date().toISOString(); });
        log(`${id} 수정 ${round}회: 고침 ${r.revised} · 버림 ${r.dropped} · 거절 ${r.rejected}`);
        if (r.staging) await applyBatch(id);
        if (!r.revised || !batchOf(id)) break;
        await reviewBoth(id, round);
        await applyBatch(id);
      }
      summary[id] = { ...summary[id], remainingDefects: batchOf(id) ? revise.flagged(rm, batchOf(id)).length : 0 };
    } catch (e) {
      log(`${id} 중단: ${e.message}`);
      summary[id] = { ...summary[id], error: e.message };
    }
  }));

  fs.writeFileSync(path.join(root, '.orchestrate/content-loop.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
  if (Object.values(summary).some(item => item.error)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.stack ?? e.message); process.exitCode = 1; });

const keyOf = q => `${q.id ?? q.questionId}@${q.revision}`;
const emptyCalls = () => ({ claude: 0, codex: 0, argon: 0, bridge: 0 });
const readJson = (file, fallback = null) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

/** apply와 동일한 배치 경로 범위만 overlay로 읽는다. 손상된 미적용 파일은 모델 호출 전에 거절한다. */
function validateOverlay(root, id) {
  const safePath = relative => {
    if (!relative || typeof relative !== 'string' || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative)
      || relative.split('/').some(p => !p || p === '.' || p === '..' || p === '.git')) throw new Error(`staging 경로 오류: ${relative}`);
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`staging 심볼릭 링크 거절: ${relative}`);
    }
    return current;
  };
  const base = safePath(`.orchestrate/staging/${id}`);
  if (!fs.existsSync(base)) return;
  for (const run of fs.readdirSync(base).sort()) {
    const dir = `.orchestrate/staging/${id}/${run}`;
    const file = safePath(`${dir}/manifest.json`);
    if (!fs.existsSync(file)) continue;
    const m = readJson(file);
    if (!/^[A-Za-z0-9_-]+$/.test(run) || m.batchId !== id || m.runId !== run || !Array.isArray(m.writes) || !Array.isArray(m.deletes)) throw new Error('staging manifest 식별자·목록 불일치');
    const seen = new Set();
    for (const relative of [...m.writes.map(w => w.path), ...m.deletes]) {
      safePath(relative);
      if (!(relative.startsWith(`content-source/batches/${id}/`) || relative.startsWith(`content-source/reviews/${id}/`)
        || relative.startsWith(`content-source/reviews/archive/${id}.`) || relative === `content-source/approvals/${id}.explanation.json`
        || relative.startsWith(`content-source/approvals/archive/${id}.explanation.`) || relative === `content-source/levels/${id}.json`)
        || seen.has(relative)) throw new Error(`staging 배치 밖 또는 중복 경로: ${relative}`);
      seen.add(relative);
    }
    for (const w of m.writes) {
      const bytes = fs.readFileSync(safePath(`${dir}/files/${w.path}`));
      if (createHash('sha256').update(bytes).digest('hex') !== w.sha256) throw new Error(`staging 해시 불일치: ${w.path}`);
    }
  }
}

function overlayBatch(root, raw) {
  const id = raw.batchId;
  validateOverlay(root, id);
  const read = (relative, fallback = null) => revise.pendingJson(root, id, relative, fallback);
  if (read(`content-source/batches/${id}/closed.json`)) return null;
  return { ...raw,
    drafts: read(`content-source/batches/${id}/drafts.json`, raw.drafts),
    sidecar: read(`content-source/batches/${id}/sidecar.json`, raw.sidecar),
    reviews: Object.fromEntries(['codex', 'claude'].map(who => [who, read(`content-source/reviews/${id}/${who}.json`, raw.reviews[who])])),
    argonBlind: read(`content-source/reviews/${id}/argon-blind.json`, raw.argonBlind),
    explanation: read(`content-source/approvals/${id}.explanation.json`, raw.explanation),
  };
}

// gate 실행끼리 같은 배치의 review 임시 파일을 덮어쓰지 않는다. standalone 제작/검수/apply는 함께 실행하지 않는다.
export function acquireGateRun(root, id) {
  const file = path.join(root, '.orchestrate/gate-locks', `${id}.json`), token = randomUUID();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const take = () => fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
  try { take(); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const reclaim = `${file}.reclaim`;
    fs.mkdirSync(reclaim);
    try {
      if (fs.existsSync(file)) {
        const owner = readJson(file);
        if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw new Error('gate 잠금 PID 오류', { cause: error });
        let alive = true;
        try { process.kill(owner.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; else if (e.code !== 'EPERM') throw e; }
        if (alive) throw new Error(`${id}: gate 실행 중 (PID ${owner.pid})`, { cause: error });
        fs.unlinkSync(file);
      }
      take();
    } finally { fs.rmdirSync(reclaim); }
  }
  return () => { if (readJson(file)?.token === token) fs.unlinkSync(file); };
}

/** 실제 실행기와 가짜 실행기는 같은 상태/실행 계약을 쓴다. 추적 파일 쓰기는 apply만 담당한다. */
export async function createGateRuntime(options, modules) {
  if (!options['with-claude']) options = { ...options,
    'codex-model': options['codex-model'] ?? 'gpt-6-astra',
    'codex-effort': options['codex-effort'] ?? 'high',
  };
  const root = options.root;
  const baseBank = modules?.rb ?? await review.load(root);
  const stageOnly = Boolean(options['stage-only']);
  const selected = options.all ? null : new Set(String(options.batches).split(',').map(id => id.trim()));
  const rb = stageOnly ? { ...baseBank, loadBatches: () => baseBank.loadBatches(root).filter(b => !selected || selected.has(b.batchId)).map(b => overlayBatch(root, b)).filter(Boolean) } : baseBank;
  const baseRevise = modules?.rm ?? await revise.load(root);
  // 기존 수정기의 gate 사유 계약을 유지하면서 Codex 최종 대조 실패도 전달한다.
  // snapshot과 실제 reviseQuestions가 반드시 같은 판정 어댑터를 사용한다.
  const rm = { ...baseRevise, b: { ...baseRevise.b,
    ...(stageOnly ? { loadBatches: rb.loadBatches } : {}),
    decide(batch) {
      const decisions = baseRevise.b.decide(batch);
      if (batch.sidecar.publicationPolicy !== 'codex-argon-v1') return decisions;
      return decisions.map(item => {
        const explanation = batch.explanation?.items.find(q => q.questionId === item.questionId && q.revision === item.revision);
        return { ...item, reasons: item.reasons.map(reason => reason.startsWith('Codex 해설 대조 fail')
          ? `총괄 해설 대조 fail: ${[reason, ...(explanation?.findings ?? [])].join(' / ')}` : reason) };
      });
    },
  } };
  const lm = modules?.lm ?? await level.load();
  const configs = review.resolveReviewConfig(options);
  const reviewOptions = (who, questionKeys) => ({ config: configs[who], questionKeys,
    archiveExisting: (who === 'codex' && Boolean(options['recheck-codex']))
      || options['archive-existing'] === true || options['archive-existing'] === who });
  const batchOf = id => {
    const raw = baseBank.loadBatches(root).find(b => b.batchId === id);
    if (!stageOnly) return raw;
    if (raw) return overlayBatch(root, raw);
    validateOverlay(root, id);
    if (revise.pendingJson(root, id, `content-source/batches/${id}/closed.json`)) return null;
    throw new Error(`${id}: stage-only는 기존 추적 배치만 지원한다. 새 배치는 먼저 apply가 필요하다`);
  };
  const log = options.log ?? console.log;
  return {
    ids: options.all ? baseBank.loadBatches(root).map(b => b.batchId).filter(id => /^Q50-/.test(id)) : String(options.batches).split(',').map(id => id.trim()),
    log,
    batch: batchOf,
    snapshot(id) {
      const raw = batchOf(id);
      if (!raw) return null;
      const batch = { ...raw, drafts: rm.front.currentDrafts(raw.drafts) };
      const levels = stageOnly ? revise.pendingJson(root, id, `content-source/levels/${id}.json`) : readJson(path.join(root, `content-source/levels/${id}.json`));
      const front = rm.front.frontGate(batch, levels, { root });
      // produce 배치의 현재 판만. 기존 제작 배치에는 새 Argon 호출을 만들지 않는다.
      const produced = /(?:^|\/)produce\.mjs(?:$|\b)/.test(batch.sidecar.producer?.tool ?? '');
      return {
        drafts: batch.drafts,
        levelPending: batch.drafts.filter(q => !(levels?.items ?? []).some(item => lm.levels.isCurrentLevelAssessment(q, item))).map(keyOf),
        codexPending: review.pending(rb, batch, 'codex', reviewOptions('codex')).map(keyOf),
        argonPending: produced && options['skip-argon-fresh'] !== true ? review.pending(rb, batch, 'antigravity', reviewOptions('antigravity')).filter(q => q.revision === 1).map(keyOf) : [],
        codexFinalPending: batch.drafts.filter(q => batch.sidecar.publicationPolicy !== 'codex-argon-v1'
          || batch.explanation?.reviewer?.model !== 'gpt-6-astra'
          || !(batch.explanation?.items ?? []).some(item => keyOf(item) === keyOf(q)
            && item.contentHash === rb.contentHash(q) && item.rationalesHash === rb.rationalesHash(q)
            && item.run?.model === 'gpt-6-astra' && ['high', 'xhigh'].includes(item.run?.effort)
            && ['pass', 'fail'].includes(item.explanation))).map(keyOf),
        // 옛 Claude 경로에서만 소비한다. 모델 변경 검사는 실제 관문 대상이 있을 때만 한다.
        claudePending: batch.drafts.filter(q => !(batch.reviews.claude?.items ?? []).some(i => keyOf(i) === keyOf(q) && i.contentHash === rb.contentHash(q))).map(keyOf),
        front, flagged: revise.flagged(rm, batch, { root, levelFile: levels }),
        awaitingStaging: !stageOnly && fs.existsSync(path.join(root, '.orchestrate/staging', id))
          && fs.readdirSync(path.join(root, '.orchestrate/staging', id)).some(run => fs.existsSync(path.join(root, '.orchestrate/staging', id, run, 'manifest.json'))),
      };
    },
    async level(id, questionKeys, onEvent) {
      const results = await level.runLevels({ ...options, all: false, batches: id, argon: 1, codex: 1, onEvent }, { modules: lm });
      return results[0];
    },
    async review(id, who, questionKeys, onEvent) {
      const opts = { ...options, ...reviewOptions(who, questionKeys), onEvent };
      await review.runPhase(rb, root, who, id, 'blind', log, opts);
      await review.runPhase(rb, root, who, id, 'reveal', log, opts);
      return review.ingest(rb, root, who, id, opts);
    },
    async revise(id, phase, questionKeys, onEvent) {
      return (await revise.reviseQuestions(rm, root, questionKeys.map(key => {
        const at = key.lastIndexOf('@'); return { batchId: id, questionId: key.slice(0, at), revision: Number(key.slice(at + 1)), phase };
      }), 'antigravity', log, { ...options, batchIds: [id], onEvent }))[0];
    },
    async finalizeQuestions(refs, onEvent) {
      const { finalizeCodex } = await import('./finalize-codex.mjs');
      return finalizeCodex({ ...options, root, questions: refs, onEvent }, { runtime: this, bank: rb });
    },
    levelQuestions: (questions, onEvent) => level.runLevels({ ...options, questions, all: false, batches: undefined, argon: 1, codex: 1, onEvent }, { modules: lm }),
    reviewQuestions: (questions, who, onEvent) => review.runQuestions(rb, root, who, questions, log, { ...options, ...reviewOptions(who), onEvent }),
    reviseQuestions: (questions, onEvent, batchIds) => revise.reviseQuestions(rm, root, questions, 'antigravity', log, { ...options, batchIds, onEvent }),
    apply: (id, opts) => { if (stageOnly) throw new Error('stage-only에서는 apply를 호출할 수 없다'); return applyStaged({ root, batch: id, ...opts, testServer: guardedServerTest }); },
  };
}

function nextGateAction(state, frontOnly = false, withClaude = false) {
  if (!state || !state.drafts.length) return null;
  for (const [stage, field, who] of [['S1', 'levelPending', null], ['S2-codex', 'codexPending', 'codex'], ['S2-argon', 'argonPending', 'antigravity']]) {
    if (state[field].length) return { stage, keys: state[field], who };
  }
  const front = state.front.items.filter(item => item.status === 'defect').map(keyOf);
  if (front.length || state.front.batchDefects.length) return { stage: 'S3', phase: 'front', keys: front };
  const passed = new Set(state.front.items.filter(item => item.status === 'pass').map(keyOf));
  const final = state[withClaude ? 'claudePending' : 'codexFinalPending'].filter(key => passed.has(key));
  if (final.length) return { stage: frontOnly ? 'S4 대기' : 'S4', who: withClaude ? 'claude' : 'codex', keys: final };
  if (frontOnly) return null;
  const gate = state.flagged.filter(item => item.phase === 'gate' && passed.has(keyOf(item.q))).map(item => keyOf(item.q));
  if (gate.length) return { stage: 'S5', phase: 'gate', keys: gate };
  return null;
}

/** --gate: 단계별 staging을 반영한 후 반드시 현재 판을 다시 읽는다. deps는 모델/브리지/git 없는 시험 주입점. */
export async function runGate(options = {}, deps = {}) {
  const releases = [];
  try { return await runGateUnlocked(options, deps, releases); }
  finally { for (const release of releases.reverse()) release(); }
}

async function runGateUnlocked(options, deps, releases) {
  if (options['with-claude'] && options['without-claude']) throw new Error('--with-claude와 --without-claude를 함께 쓸 수 없다');
  const withClaude = Boolean(options['with-claude']);
  const finalField = withClaude ? 'claudePending' : 'codexFinalPending';
  const finalWho = withClaude ? 'claude' : 'codex';
  const stageOnly = Boolean(options['stage-only']);
  if (stageOnly && (options.commit || options['no-commit'])) throw new Error('--stage-only는 --commit/--no-commit과 함께 쓸 수 없다');
  if (options.until != null && options.until !== 'S3') throw new Error('--until은 S3만 지원한다');
  const frontOnly = options.until === 'S3';
  if (options.commit && options['no-commit']) throw new Error('--commit과 --no-commit을 함께 쓸 수 없다');
  if (Boolean(options.all) === Boolean(options.batches)) throw new Error('--all 또는 --batches 중 하나가 필요하다');
  const root = path.resolve(options.root ?? path.resolve(import.meta.dirname, '../..'));
  const sizes = Object.fromEntries(['claude', 'codex', 'argon'].map(who => [who, Number(options[who] ?? 2)]));
  for (const [who, size] of Object.entries(sizes)) if (!Number.isInteger(size) || size < 1) throw new Error(`--${who}는 양의 정수여야 한다`);
  review.resolveReviewConfig(options); // plan도 잘못된 설정을 실행 전에 알린다.
  const runtime = deps.snapshot ? deps : await createGateRuntime({ ...options, root }, deps.modules);
  const ids = [...new Set(runtime.ids)];
  if (ids.some(id => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id))) throw new Error('배치 ID 오류');
  const log = runtime.log ?? console.log;
  const summary = {};
  const file = options['summary-file'] ? path.resolve(root, String(options['summary-file'])) : path.join(root, stageOnly ? '.orchestrate/content-loop.stage-only.summary.json' : '.orchestrate/content-loop.summary.json');
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(summary, null, 2)}\n`); fs.renameSync(temp, file);
  };
  if (options.plan) {
    for (const id of ids) {
      const state = await runtime.snapshot(id);
      const action = nextGateAction(state, frontOnly, withClaude);
      summary[id] = { ...(stageOnly ? { awaitingApply: true } : {}), next: state?.awaitingStaging ? { stage: 'applyStaged', target: state.drafts.length } : { stage: action?.stage ?? (stageOnly ? '반영 대기' : '완료/대기'), target: action?.keys.length ?? 0, ...(!withClaude && action?.who ? { who: action.who } : {}) } };
      log(`${id}: 다음 ${summary[id].next.stage} · 대상 ${summary[id].next.target}문항`);
    }
    return summary;
  }
  for (const id of [...ids].sort()) releases.push(acquireGateRun(root, id));
  if (stageOnly) for (const id of ids) await runtime.snapshot(id); // 손상은 모델 호출 전 중단한다.
  const previous = readJson(file, {});
  const runId = `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID()}`;
  if (fs.existsSync(file)) {
    const archive = path.join(root, '.orchestrate/content-loop-history', `${runId}.json`);
    fs.mkdirSync(path.dirname(archive), { recursive: true }); fs.copyFileSync(file, archive);
  }
  const threshold = Number(options['pool-after'] ?? (ids.length || 1));
  if (!Number.isSafeInteger(threshold) || threshold < 1) throw new Error('--pool-after는 양의 정수여야 한다');
  const pools = { claude: pool(sizes.claude), codex: pool(sizes.codex), antigravity: pool(sizes.argon) };
  const noCommit = Boolean(options['no-commit']);
  let applying = Promise.resolve(), applyError, callSequence = 0;
  const apply = id => {
    if (stageOnly) return Promise.resolve({ runs: [] });
    applying = applying.then(() => runtime.apply(id, { noCommit })).catch(error => { applyError = error; throw error; });
    return applying;
  };
  const requireApplyReady = () => { if (applyError) throw applyError; };
  const startModel = fn => { requireApplyReady(); return fn(); };
  const workIds = noCommit ? ids.slice(0, 1) : ids;
  for (const id of ids.slice(workIds.length)) summary[id] = { awaitingApply: true };
  for (const id of workIds) summary[id] = { ...(stageOnly ? { awaitingApply: true } : {}), startedAt: new Date().toISOString(), stages: [], runId, firstPassComplete: previous[id]?.firstPassComplete === true, lastRound: previous[id]?.lastRound ?? 0, modelCalls: emptyCalls(), waits: emptyCalls(), waitMs: emptyCalls(), modelCallsBasis: 'measured' };
  const active = id => !summary[id].error && !summary[id].awaitingCommit;
  const refsOf = (id, keys, phase) => keys.map(key => {
    const at = key.lastIndexOf('@');
    return { batchId: id, questionId: key.slice(0, at), revision: Number(key.slice(at + 1)), ...(phase ? { phase } : {}) };
  });
  const markError = (batchIds, error) => {
    for (const id of batchIds) {
      summary[id].error = error.message;
      const blockedReason = { CLAUDE_AUTH_BLOCKED: 'authentication', RESOURCE_WAIT: 'resource', MODEL_USAGE_BLOCKED: 'usage' }[error.code];
      summary[id].blocked = Boolean(blockedReason);
      if (summary[id].blocked) summary[id].blockedReason = blockedReason;
      summary[id].skipped = !applyError && !summary[id].blocked;
      log(`${id} ${summary[id].blocked ? '차단' : '중단'}: ${error.message}`);
    }
  };
  const assessFront = async (id, round) => {
    const state = await runtime.snapshot(id);
    if (!state || state.levelPending.length || state.codexPending.length || state.argonPending.length) return;
    const at = new Date().toISOString();
    summary[id].stages.push({ stage: 'S3', action: '판정', round, target: state.front.items.length,
      passed: state.front.items.filter(q => q.status === 'pass').length, defects: state.front.items.filter(q => q.status === 'defect').length,
      pending: state.front.items.filter(q => q.status === 'pending').length, dropped: 0, modelCalls: emptyCalls(), modelCallsBasis: 'measured', startedAt: at, endedAt: at });
  };
  // 한 묶음 호출은 첫 소유 배치에 1회 귀속한다. 모든 참여 배치에는 같은 callId를 기록한다.
  // 따라서 modelCalls는 배치 합산 가능하고 sharedModelCalls는 참여 횟수(합산 금지)다.
  const execute = async (stage, refs, batchIds, round, invoke) => {
    const before = new Map();
    for (const id of batchIds) before.set(id, JSON.stringify(await runtime.snapshot(id)));
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (applyError) { markError(batchIds, applyError); return false; }
      const records = new Map(batchIds.map(id => {
        const record = { stage, round, target: refs.filter(q => q.batchId === id).length, passed: 0, defects: 0, dropped: 0,
          modelCalls: emptyCalls(), sharedModelCalls: emptyCalls(), waits: emptyCalls(), waitMs: emptyCalls(), events: [], modelCallsBasis: 'measured', startedAt: new Date().toISOString() };
        summary[id].stages.push(record); summary[id].lastRound = Math.max(summary[id].lastRound, round); return [id, record];
      }));
      const onEvent = event => {
        // 큐 대기뿐 아니라 하위 실행기의 재시도·다음 단계 호출도 실제 실행 직전에 막는다.
        if (event.type === 'call') requireApplyReady();
        const who = event.who === 'antigravity' || event.who === 'bridge' ? 'argon' : event.who;
        if (!['claude', 'codex', 'argon'].includes(who)) throw new Error(`계측 모델 오류: ${who}`);
        const participants = [...new Set(event.batchIds ?? batchIds)].filter(id => records.has(id)).sort();
        if (!participants.length) throw new Error('계측 호출의 소유 배치 없음');
        const callId = `${runId}-${stage}-${round}-${++callSequence}`;
        for (const id of participants) {
          const record = records.get(id);
          record.events.push({ ...event, who, callId, attributedTo: participants[0] });
          if (event.type === 'call') {
            record.sharedModelCalls[who]++;
            if (id === participants[0]) { record.modelCalls[who]++; summary[id].modelCalls[who]++; }
          } else if (event.type === 'wait' && id === participants[0]) { record.waits[who]++; record.waitMs[who] += event.durationMs; summary[id].waits[who]++; summary[id].waitMs[who] += event.durationMs; }
        }
        save();
      };
      try {
        const result = await invoke(onEvent);
        const results = Array.isArray(result) ? result : [{ batchId: batchIds[0], ...result }];
        for (const row of results) {
          const record = records.get(row.batchId);
          if (!record) throw new Error(`미요청 결과 배치: ${row.batchId}`);
          record.passed += row.assessed ?? (row.merged == null ? 0 : row.merged - (row.flagged ?? 0));
          record.defects += row.flagged ?? row.rejected ?? 0; record.dropped += row.dropped ?? 0;
          // 기존 가짜 실행기 계약 호환. 실실행은 콜백으로만 계측한다.
          if (row.modelCalls && !record.events.length) Object.assign(record.modelCalls, row.modelCalls);
        }
        for (const id of batchIds) {
          const applied = await apply(id);
          if (noCommit && applied.runs.length) { summary[id].awaitingCommit = true; return false; }
        }
        if (results.some(row => row.rejected > 0)) throw new Error(`${stage}: 수정기 재요청 한도 소진`);
        const unchanged = [];
        for (const id of batchIds) if (JSON.stringify(await runtime.snapshot(id)) === before.get(id)) unchanged.push(id);
        if (unchanged.length === batchIds.length) throw new Error(`${stage}: 대상 상태가 바뀌지 않음`);
        return true;
      } catch (caught) {
        // 하위 실행기가 형식 오류로 감싸도 최초 반영 차단의 원인을 유지한다.
        const error = applyError ?? caught;
        for (const record of records.values()) record.error = error.message;
        if (['CLAUDE_AUTH_BLOCKED', 'RESOURCE_WAIT', 'MODEL_USAGE_BLOCKED'].includes(error.code)) {
          for (const record of records.values()) record.status = 'blocked';
          markError(batchIds, error); return false;
        }
        if (applyError || attempt === 3 || /4회 모두 형식 오류|재요청 3회 소진|수정기 재요청 한도 소진/.test(error.message)) { markError(batchIds, error); return false; }
      } finally {
        for (const record of records.values()) record.endedAt = new Date().toISOString();
        save();
      }
    }
  };
  const firstPass = async id => {
    try {
      const resumed = await apply(id);
      if (noCommit && resumed.runs.length) { summary[id].awaitingCommit = true; return; }
      if (summary[id].firstPassComplete) return;
      for (const [stage, field, who] of [['S1', 'levelPending', null], ['S2-codex', 'codexPending', 'codex'], ['S2-argon', 'argonPending', 'antigravity']]) {
        const state = await runtime.snapshot(id), keys = state?.[field] ?? [];
        if (!keys.length) continue;
        const ok = await execute(stage, refsOf(id, keys), [id], 0, cb => who
          ? pools[who](() => startModel(() => runtime.review(id, who, keys, cb)))
          : pools.codex(() => pools.antigravity(() => startModel(() => runtime.level(id, keys, cb)))));
        if (!ok) return;
      }
      await assessFront(id, 0);
      const state = await runtime.snapshot(id);
      const passed = new Set(state?.front.batchDefects.length ? [] : state?.front.items.filter(q => q.status === 'pass').map(keyOf));
      const keys = state?.[finalField].filter(key => passed.has(key)) ?? [];
      if (!frontOnly && keys.length && !await execute('S4', refsOf(id, keys), [id], 0, cb => pools[finalWho](() => startModel(() => withClaude
        ? runtime.review(id, 'claude', keys, cb) : runtime.finalizeQuestions(refsOf(id, keys), cb))))) return;
      summary[id].firstPassComplete = true; save();
    } catch (error) { markError([id], error); }
  };
  const pooled = async (stage, refs, batchIds, round, who) => {
    const invoke = async cb => {
      requireApplyReady();
      if (stage === 'S4' && !withClaude) return runtime.finalizeQuestions(refs, cb);
      if (stage === 'S1' && runtime.levelQuestions) return runtime.levelQuestions(refs, cb);
      if (who && runtime.reviewQuestions) return runtime.reviewQuestions(refs, who, cb);
      if (!who && stage !== 'S1' && runtime.reviseQuestions) return runtime.reviseQuestions(refs, cb, batchIds);
      const results = [];
      for (const id of batchIds) {
        const selected = refs.filter(q => q.batchId === id), keys = selected.map(keyOf);
        const scoped = event => cb({ ...event, batchIds: event.batchIds ?? [id] });
        const result = stage === 'S1' ? await runtime.level(id, keys, scoped)
          : who ? await runtime.review(id, who, keys, scoped) : await runtime.revise(id, selected[0]?.phase ?? 'front', keys, scoped);
        results.push({ batchId: id, ...result });
      }
      return results;
    };
    return execute(stage, refs, batchIds, round, cb => stage === 'S1'
      ? pools.codex(() => pools.antigravity(() => invoke(cb))) : pools[who ?? 'antigravity'](() => invoke(cb)));
  };
  const recheck = async (cohort, round) => {
    for (const [stage, field, who] of [['S1', 'levelPending', null], ['S2-codex', 'codexPending', 'codex'], ['S4', finalField, finalWho]]) {
      if (frontOnly && stage === 'S4') {
        for (const id of cohort.filter(active)) await assessFront(id, round);
        continue;
      }
      let refs = [];
      for (const id of cohort.filter(active)) {
        const state = await runtime.snapshot(id); if (!state) continue;
        if (stage === 'S4') await assessFront(id, round);
        const passed = new Set(state.front.batchDefects.length ? [] : state.front.items.filter(q => q.status === 'pass').map(keyOf));
        refs.push(...refsOf(id, state[field].filter(key => stage !== 'S4' || passed.has(key))));
      }
      if (refs.length) await pooled(stage, refs, [...new Set(refs.map(q => q.batchId))], round, who);
      if (applyError) break;
    }
  };
  // --pool-after는 첫 판 완료 배치 수의 장벽이다. 기본값은 선택한 모든 배치.
  for (let offset = 0; offset < workIds.length; offset += threshold) {
    const cohort = workIds.slice(offset, offset + threshold);
    await Promise.all(cohort.map(firstPass));
    const roundBase = Math.max(0, ...cohort.map(id => previous[id]?.lastRound ?? 0), ...cohort.flatMap(id => previous[id]?.stages?.map(stage => stage.round ?? 0) ?? []));
    if (!applyError && cohort.some(id => previous[id]?.firstPassComplete)) await recheck(cohort, roundBase);
    let budget = 10;
    for (const id of cohort.filter(active)) budget += 30 * ((await runtime.snapshot(id))?.drafts.length ?? 0);
    for (let round = roundBase + 1; round <= roundBase + budget && !applyError; round++) {
      let refs = [], repairIds = [];
      for (const id of cohort.filter(active)) {
        const state = await runtime.snapshot(id);
        if (!state) continue;
        const defects = new Set(state.front.items.filter(q => q.status === 'defect').map(keyOf));
        const passed = new Set(state.front.batchDefects.length ? [] : state.front.items.filter(q => q.status === 'pass').map(keyOf));
        refs.push(...refsOf(id, [...defects], 'front'));
        if (!frontOnly) refs.push(...refsOf(id, state.flagged.filter(x => x.phase === 'gate' && passed.has(keyOf(x.q))).map(x => keyOf(x.q)), 'gate'));
        if (state.front.batchDefects.length) repairIds.push(id);
      }
      const reviseIds = [...new Set([...refs.map(q => q.batchId), ...repairIds])];
      if (!reviseIds.length) break;
      const phases = new Set(refs.map(q => q.phase));
      await pooled(phases.size === 1 && phases.has('gate') ? 'S5' : phases.size > 1 ? 'S3/S5' : 'S3', refs, reviseIds, round);
      if (applyError) break;
      await recheck(cohort, round);
      if (round === roundBase + budget) markError(cohort.filter(active), new Error('전역 회차 안전 상한 소진'));
    }
    for (const id of cohort) {
      const state = await runtime.snapshot(id);
      summary[id].closed = !state || !state.drafts.length;
      summary[id].pending = state?.front.items.filter(q => q.status === 'pending').length ?? 0;
      if (frontOnly) {
        const passed = new Set(state?.front.batchDefects.length ? [] : state?.front.items.filter(q => q.status === 'pass').map(keyOf));
        summary[id].until = 'S3';
        summary[id][withClaude ? 'awaitingClaude' : 'awaitingFinalReview'] = state?.[finalField].filter(key => passed.has(key)).length ?? 0;
      }
      summary[id].endedAt = new Date().toISOString();
    }
    save();
    if (applyError || noCommit) break;
  }
  return summary;
}

/** 제작 경로도 같은 계측기를 주입할 수 있다. 독립 produce CLI는 별도 파일 소유자 작업이다. */
export async function runProduce(options, deps = {}) {
  const { produce } = await import('./produce.mjs');
  const metrics = { modelCallsBasis: 'measured', modelCalls: emptyCalls(), waits: emptyCalls(), waitMs: emptyCalls(), events: [] };
  const onEvent = event => {
    metrics.events.push(event);
    if (event.type === 'call') metrics.modelCalls[event.who]++;
    else if (event.type === 'wait') { metrics.waits[event.who]++; metrics.waitMs[event.who] += event.durationMs; }
    (options.onEvent ?? deps.onEvent)?.(event);
  };
  const callContext = { batchIds: [options.batchId], phase: 'produce', round: options.round ?? 0 };
  const injected = { ...deps, agyCall: request => review.modelAttempt('argon', () => (deps.agyCall ?? review.measuredAgyCall)({ ...request, onEvent, callContext }),
    { onEvent, sleep: deps.sleep, liveArgon: !deps.agyCall }, callContext) };
  if (deps.respond) injected.respond = request => review.modelAttempt('argon', () => deps.respond(request), { onEvent, sleep: deps.sleep }, callContext);
  return { ...await produce(options, injected), ...metrics };
}
