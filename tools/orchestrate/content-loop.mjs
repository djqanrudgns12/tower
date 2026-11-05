#!/usr/bin/env node
// 문항 공동검수 전체 자동 루프(공동검수 절차 3~6단계, PRD §9.3). 배치마다:
//   Claude·Codex 2단계 블라인드 검수 → 결함 문항 Argon 수정(revision+1) → 고친 판을 다시 Claude·Codex 검수 (최대 2회)
// 각 단계의 대기분을 잠금 안에서 반영·빌드·커밋한다. 모든 단계가 "아직 안 한 것만" 하므로 멈춰도 다시 돌리면 이어 간다.
//
//   node tools/orchestrate/content-loop.mjs --root <dir> [--batches A,B | --all] [--claude 2] [--codex 2] [--argon 2] [--rounds 2] [--commit | --no-commit]
import fs from 'node:fs';
import path from 'node:path';
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
    active++;
    try { return await fn(); } finally { active--; waiting.shift()?.(); }
  };
}

async function main() {
  const a = args(process.argv.slice(2));
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

main().catch(e => { console.error(e.stack ?? e.message); process.exit(1); });
