#!/usr/bin/env node
// 문항 공동검수 전체 자동 루프(공동검수 절차 3~6단계, PRD §9.3). 배치마다:
//   Claude·Codex 2단계 블라인드 검수 → 결함 문항 Argon 수정(revision+1) → 고친 판을 다시 Claude·Codex 검수 (최대 2회)
// 각 단계의 대기분을 잠금 안에서 반영·빌드·커밋한다. 모든 단계가 "아직 안 한 것만" 하므로 멈춰도 다시 돌리면 이어 간다.
//
// --gate: S1 수준 → S2 앞단 검수 → S3 수정 → S4 Claude → S5 수정. --plan은 다음 단계만 조회.
// --recheck-codex 및 --claude-model/--claude-effort/--codex-model/--codex-effort 지원.
//   node tools/orchestrate/content-loop.mjs --root <dir> [--batches A,B | --all] [--claude 2] [--codex 2] [--argon 2] [--rounds 2] [--commit | --no-commit]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as level from './level.mjs';
import { applyStaged } from './commit-lock.mjs';
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
  const optionsFor = who => ({ config: configs[who], archiveExisting: a['archive-existing'] === true || a['archive-existing'] === who });

  const reviewWith = async (who, id) => {
    const options = optionsFor(who);
    if (!review.pending(rb, batchOf(id), who, options).length) return;
    await pools[who](async () => {
      await review.runPhase(rb, root, who, id, 'blind', log, options);
      await review.runPhase(rb, root, who, id, 'reveal', log, options);
      const r = await review.ingest(rb, root, who, id, options);
      log(`${id} ${who} 병합 대기 ${r.merged}문항 · 지적 ${r.flagged} (${r.staging})`);
    });
  };
  const reviewBoth = async id => {
    // 한쪽 보고서가 거절될 때 다른 쪽 모델부터 실행하지 않는다.
    const batch = batchOf(id);
    for (const who of ['claude', 'codex']) review.pending(rb, batch, who, optionsFor(who));
    const results = await Promise.allSettled([reviewWith('claude', id), reviewWith('codex', id)]);
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
      if (!commit && resumed.runs.length) { summary[id] = { awaitingCommit: true }; return; }
      if (!batchOf(id)) { summary[id] = { closed: true }; return; }
      await reviewBoth(id);
      await applyBatch(id);
      if (!commit) { summary[id] = { awaitingCommit: true }; return; }
      for (let round = 1; round <= rounds; round++) {
        const n = revise.flagged(rm, batchOf(id)).length;
        if (!n) break;
        const r = await pools.antigravity(() => revise.reviseBatch(rm, root, id, 'antigravity', log));
        log(`${id} 수정 ${round}회: 고침 ${r.revised} · 버림 ${r.dropped} · 거절 ${r.rejected}`);
        if (r.staging) await applyBatch(id);
        if (!r.revised || !batchOf(id)) break;
        await reviewBoth(id);
        await applyBatch(id);
      }
      summary[id] = { remainingDefects: batchOf(id) ? revise.flagged(rm, batchOf(id)).length : 0 };
    } catch (e) {
      log(`${id} 중단: ${e.message}`);
      summary[id] = { error: e.message };
    }
  }));

  fs.writeFileSync(path.join(root, '.orchestrate/content-loop.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
  if (Object.values(summary).some(item => item.error)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.stack ?? e.message); process.exitCode = 1; });

const keyOf = q => `${q.id ?? q.questionId}@${q.revision}`;
const emptyCalls = () => ({ claude: 0, codex: 0, bridge: 0 });
const readJson = (file, fallback = null) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

/** 실제 실행기와 가짜 실행기는 같은 상태/실행 계약을 쓴다. 추적 파일 쓰기는 apply만 담당한다. */
export async function createGateRuntime(options, modules) {
  const root = options.root;
  const rb = modules?.rb ?? await review.load(root);
  const rm = modules?.rm ?? await revise.load(root);
  const lm = modules?.lm ?? await level.load();
  const configs = review.resolveReviewConfig(options);
  const reviewOptions = (who, questionKeys) => ({ config: configs[who], questionKeys,
    archiveExisting: (who === 'codex' && Boolean(options['recheck-codex']))
      || options['archive-existing'] === true || options['archive-existing'] === who });
  const batchOf = id => rb.loadBatches(root).find(b => b.batchId === id);
  const log = options.log ?? console.log;
  return {
    ids: options.all ? rb.loadBatches(root).map(b => b.batchId).filter(id => /^Q50-/.test(id)) : String(options.batches).split(',').map(id => id.trim()),
    log,
    snapshot(id) {
      const raw = batchOf(id);
      if (!raw) return null;
      const batch = { ...raw, drafts: rm.front.currentDrafts(raw.drafts) };
      const levels = readJson(path.join(root, `content-source/levels/${id}.json`));
      const front = rm.front.frontGate(batch, levels, { root });
      // produce 배치의 현재 판만. 기존 제작 배치에는 새 Argon 호출을 만들지 않는다.
      const produced = /(?:^|\/)produce\.mjs(?:$|\b)/.test(batch.sidecar.producer?.tool ?? '');
      return {
        drafts: batch.drafts,
        levelPending: batch.drafts.filter(q => !(levels?.items ?? []).some(item => lm.levels.isCurrentLevelAssessment(q, item))).map(keyOf),
        codexPending: review.pending(rb, batch, 'codex', reviewOptions('codex')).map(keyOf),
        argonPending: produced ? review.pending(rb, batch, 'antigravity', reviewOptions('antigravity')).map(keyOf) : [],
        // 모델 변경 검사는 실제 관문 대상이 있을 때만 한다.
        claudePending: batch.drafts.filter(q => !(batch.reviews.claude?.items ?? []).some(i => keyOf(i) === keyOf(q) && i.contentHash === rb.contentHash(q))).map(keyOf),
        front, flagged: revise.flagged(rm, batch, { root, levelFile: levels }),
        awaitingStaging: fs.existsSync(path.join(root, '.orchestrate/staging', id))
          && fs.readdirSync(path.join(root, '.orchestrate/staging', id)).some(run => fs.existsSync(path.join(root, '.orchestrate/staging', id, run, 'manifest.json'))),
      };
    },
    async level(id) {
      const results = await level.runLevels({ ...options, all: false, batches: id, argon: 1, codex: 1 }, { modules: lm });
      return results[0];
    },
    async review(id, who, questionKeys) {
      const opts = reviewOptions(who, questionKeys);
      await review.runPhase(rb, root, who, id, 'blind', log, opts);
      await review.runPhase(rb, root, who, id, 'reveal', log, opts);
      return review.ingest(rb, root, who, id, opts);
    },
    async revise(id, phase, questionKeys) {
      const wanted = new Set(questionKeys);
      // reviseBatch/flagged가 전체 초안을 보존한 채 이번 단계의 결함만 고르게 한다.
      const scoped = { ...rm, front: { ...rm.front,
        frontGate(...args) {
          const result = rm.front.frontGate(...args);
          return { ...result, items: result.items.filter(item => wanted.has(keyOf(item))) };
        },
      } };
      return revise.reviseBatch(scoped, root, id, 'antigravity', log);
    },
    apply: (id, opts) => applyStaged({ root, batch: id, ...opts }),
    callRecords: id => callRecords(root, id),
  };
}

// 기존 도구가 기록한 답장 파일로 실제 응답 시도(형식 오류 포함)를 센다.
// 사용량 한도 응답은 기존 도구가 파일을 쓰지 않으므로 별도 계측 전에는 이 수의 하한이다.
function callRecords(root, id) {
  const records = new Map();
  const scan = (dir, who, pattern) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file, who, pattern);
      else if (pattern.test(entry.name)) {
        const stat = fs.statSync(file, { bigint: true });
        records.set(file, { who: who ?? (entry.name.startsWith('argon-') ? 'bridge' : 'codex'), stamp: `${stat.mtimeNs}:${stat.size}` });
      }
    }
  };
  scan(path.join(root, '.orchestrate/level', id), null, /^(argon|codex)-(assess|spotcheck)-\d+-\d+\.json$/);
  for (const who of ['claude', 'codex', 'antigravity']) scan(path.join(root, '.orchestrate/review', who, id), who === 'antigravity' ? 'bridge' : who, /^(blind|reveal)\.reply\d+\.md$/);
  scan(path.join(root, '.orchestrate/revise', id), 'bridge', /^chunk\d+\.reply\d+\.md$/);
  return records;
}

function nextGateAction(state) {
  if (!state || !state.drafts.length) return null;
  for (const [stage, field, who] of [['S1', 'levelPending', null], ['S2-codex', 'codexPending', 'codex'], ['S2-argon', 'argonPending', 'antigravity']]) {
    if (state[field].length) return { stage, keys: state[field], who };
  }
  const front = state.front.items.filter(item => item.status === 'defect').map(keyOf);
  if (front.length || state.front.batchDefects.length) return { stage: 'S3', phase: 'front', keys: front };
  const passed = new Set(state.front.items.filter(item => item.status === 'pass').map(keyOf));
  const claude = state.claudePending.filter(key => passed.has(key));
  if (claude.length) return { stage: 'S4', who: 'claude', keys: claude };
  const gate = state.flagged.filter(item => item.phase === 'gate' && passed.has(keyOf(item.q))).map(item => keyOf(item.q));
  if (gate.length) return { stage: 'S5', phase: 'gate', keys: gate };
  return null;
}

/** --gate: 단계별 staging을 반영한 후 반드시 현재 판을 다시 읽는다. deps는 모델/브리지/git 없는 시험 주입점. */
export async function runGate(options = {}, deps = {}) {
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
  const file = path.join(root, '.orchestrate/content-loop.summary.json');
  const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`); };
  if (options.plan) {
    for (const id of ids) {
      const state = await runtime.snapshot(id);
      const action = nextGateAction(state);
      summary[id] = { next: state?.awaitingStaging ? { stage: 'applyStaged', target: state.drafts.length } : { stage: action?.stage ?? '완료/대기', target: action?.keys.length ?? 0 } };
      log(`${id}: 다음 ${summary[id].next.stage} · 대상 ${summary[id].next.target}문항`);
    }
    return summary;
  }
  const pools = { claude: pool(sizes.claude), codex: pool(sizes.codex), antigravity: pool(sizes.argon) };
  const noCommit = Boolean(options['no-commit']);
  let applying = Promise.resolve(), applyError;
  const apply = id => {
    applying = applying.then(() => runtime.apply(id, { noCommit })).catch(error => { applyError = error; throw error; });
    return applying;
  };
  const workIds = noCommit ? ids.slice(0, 1) : ids;
  for (const id of ids.slice(workIds.length)) summary[id] = { awaitingApply: true };
  await Promise.all(workIds.map(async id => {
    const entry = summary[id] = { startedAt: new Date().toISOString(), stages: [] };
    const failures = new Map();
    try {
      const resumed = await apply(id);
      if (noCommit && resumed.runs.length) { entry.awaitingCommit = true; return; }
      let state = await runtime.snapshot(id);
      // 각 문항 front 2회 + gate 2회와 각 재판정/재검수, 배치 재배열을 포함한 유한 안전 상한.
      const budget = 30 * (state?.drafts.length ?? 0) + 10;
      let assessedFront;
      for (let step = 0; ; step++) {
        if (applyError) throw applyError;
        const action = nextGateAction(state);
        if (state && !state.levelPending.length && !state.codexPending.length && !state.argonPending.length) {
          const fingerprint = JSON.stringify(state.front);
          if (fingerprint !== assessedFront && action?.stage !== 'S3') {
            const at = new Date().toISOString();
            entry.stages.push({ stage: 'S3', action: '판정', target: state.front.items.length,
              passed: state.front.items.filter(i => i.status === 'pass').length,
              defects: state.front.items.filter(i => i.status === 'defect').length,
              pending: state.front.items.filter(i => i.status === 'pending').length,
              dropped: 0, modelCalls: emptyCalls(), startedAt: at, endedAt: at });
          }
          assessedFront = fingerprint;
        }
        if (!action) { entry.closed = !state || !state.drafts.length; entry.pending = state?.front.items.filter(i => i.status === 'pending').length ?? 0; break; }
        if (step >= budget) throw new Error('단계 실행 안전 상한 소진');
        const record = { stage: action.stage, target: action.keys.length, passed: 0, defects: 0, dropped: 0,
          modelCalls: emptyCalls(), startedAt: new Date().toISOString() };
        entry.stages.push(record);
        const beforeCalls = runtime.callRecords?.(id) ?? new Map();
        let result;
        try {
          if (action.stage === 'S1') result = await pools.codex(() => pools.antigravity(() => runtime.level(id)));
          else if (action.who) result = await pools[action.who](() => runtime.review(id, action.who, action.keys));
          else result = await pools.antigravity(() => runtime.revise(id, action.phase, action.keys));
          if (applyError) throw applyError;
          const applied = await apply(id);
          record.passed = result.assessed ?? (result.merged == null ? 0 : result.merged - (result.flagged ?? 0));
          record.defects = result.flagged ?? result.rejected ?? 0;
          record.dropped = result.dropped ?? 0;
          if (noCommit && applied.runs.length) { entry.awaitingCommit = true; break; }
          if (result.rejected > 0) throw new Error(`${action.stage}: 수정기 재요청 한도 소진, 거절 ${result.rejected}문항`);
          const next = await runtime.snapshot(id);
          // staging 없는 응답/거절만 반복해도 같은 묶음 오류 세 번 규칙에 들어간다.
          const again = nextGateAction(next);
          if (again?.stage === action.stage && JSON.stringify(again.keys) === JSON.stringify(action.keys)) throw new Error(`${action.stage}: 대상 상태가 바뀌지 않음`);
          state = next;
        } catch (error) {
          record.error = error.message;
          if (applyError) throw applyError; // 반영 실패에는 모델 재호출 금지.
          const signature = `${action.stage}:${action.keys.join(',')}:${error.message}`;
          const count = (failures.get(signature) ?? 0) + 1;
          failures.set(signature, count);
          log(`${id} ${action.stage}: ${error.message} (${count}/3)`);
          if (count >= 3 || /4회 모두 형식 오류|재요청 3회 소진|수정기 재요청 한도 소진/.test(error.message)) { entry.skipped = true; throw error; }
          state = await runtime.snapshot(id);
        } finally {
          const afterCalls = runtime.callRecords?.(id) ?? new Map();
          for (const [file, item] of afterCalls) if (beforeCalls.get(file)?.stamp !== item.stamp) record.modelCalls[item.who]++;
          if (result?.modelCalls) Object.assign(record.modelCalls, result.modelCalls);
          record.modelCallsBasis = runtime.callRecords ? 'recorded-replies-lower-bound' : 'injected-runner';
          record.endedAt = new Date().toISOString(); save();
        }
      }
    } catch (error) { entry.error = error.message; log(`${id} 중단: ${error.message}`); }
    finally { entry.endedAt = new Date().toISOString(); save(); }
  }));
  return summary;
}
