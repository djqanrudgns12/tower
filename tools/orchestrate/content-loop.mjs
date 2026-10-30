#!/usr/bin/env node
// 문항 공동검수 전체 자동 루프(공동검수 절차 3~6단계, PRD §9.3). 배치마다:
//   Claude·Codex 2단계 블라인드 검수 → 결함 문항 Argon 수정(revision+1) → 고친 판을 다시 Claude·Codex 검수 (최대 2회)
// 끝나면 build-bank로 레지스트리와 공개·후보 은행을 다시 만든다. 모든 단계가 "아직 안 한 것만" 하므로 멈춰도 다시 돌리면 이어 간다.
//
//   node tools/orchestrate/content-loop.mjs --root <dir> [--batches A,B | --all] [--claude 2] [--codex 2] [--argon 2] [--rounds 2]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

  const reviewWith = async (who, id) => {
    if (!review.pending(rb, batchOf(id), who).length) return;
    await pools[who](async () => {
      await review.runPhase(rb, root, who, id, 'blind', log);
      await review.runPhase(rb, root, who, id, 'reveal', log);
      const r = await review.ingest(rb, root, who, id);
      log(`${id} ${who} 병합 ${r.merged}문항 · 지적 ${r.flagged}`);
    });
  };

  const summary = {};
  await Promise.all(ids.map(async id => {
    try {
      await Promise.all([reviewWith('claude', id), reviewWith('codex', id)]);
      for (let round = 1; round <= rounds; round++) {
        const n = revise.flagged(rm, batchOf(id)).length;
        if (!n) break;
        const r = await pools.antigravity(() => revise.reviseBatch(rm, root, id, 'antigravity', log));
        log(`${id} 수정 ${round}회: 고침 ${r.revised} · 버림 ${r.dropped} · 거절 ${r.rejected}`);
        if (!r.revised) break;
        await Promise.all([reviewWith('claude', id), reviewWith('codex', id)]);
      }
      summary[id] = { remainingDefects: revise.flagged(rm, batchOf(id)).length };
    } catch (e) {
      log(`${id} 중단: ${e.message}`);
      summary[id] = { error: e.message };
    }
  }));

  const built = spawnSync('node', ['tools/build-bank.mjs'], { cwd: root, encoding: 'utf8' });
  log(`build-bank 종료 ${built.status}\n${built.stdout}${built.stderr}`);
  fs.writeFileSync(path.join(root, '.orchestrate/content-loop.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
}

main().catch(e => { console.error(e.stack ?? e.message); process.exit(1); });
