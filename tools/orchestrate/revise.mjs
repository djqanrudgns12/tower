#!/usr/bin/env node
// 공동검수 6단계 자동화: fail·uncertain을 받은 문항을 작성자(Argon)에게 돌려보내 revision을 올린다.
// 지적 근거는 은행 판정(decide)의 결함 사유와 검수 보고서 findings다. "검수 없음" 같은 미완 사유는 결함으로 보지 않는다.
// Argon은 브리지에서 읽기 전용이므로, 고친 초안과 자체 반박을 답장 JSON으로 받고 이 도구가 검사 뒤 파일에 쓴다.
// 대상 낱말·근거(source)는 바꾸지 못한다. 고칠 수 없으면 drop으로 답하고 sidecar.rejected에 남긴다.
//
//   node tools/orchestrate/revise.mjs status --root <dir>
//   node tools/orchestrate/revise.mjs prompt --root <dir> --batch Q50-G3-004
//   node tools/orchestrate/revise.mjs run --root <dir> [--batches A,B | --all] [--parallel 2] [--author antigravity|codex]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { runnerImport } from 'vite';

const BRIDGE = process.env.AGENT_BRIDGE ?? path.join(os.homedir(), '.local/bin/agent-bridge');
const CHUNK = 12;
const MAX_REVISION_ROUNDS = 2; // 공동검수 절차 6: 두 번 고쳐도 안 되면 다른 낱말로 바꾼다.
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function load(root) {
  const imp = p => runnerImport(path.join(root, p), { configFile: false, logLevel: 'error', root }).then(r => r.module);
  return { b: await imp('tools/content/bankBuild.ts'), d: await imp('src/contracts/questionDraft.ts'), lint: await imp('src/content/lint.ts') };
}

/** 문항별 결함 사유와 검수자 findings. 미완(검수 없음) 사유만 있는 문항은 대상이 아니다. */
export function flagged(m, batch) {
  const strict = batch.batchId.startsWith('Q50-') ? m.lint.lintBatchStrict(batch.drafts) : [];
  const out = [];
  for (const dec of m.b.decide(batch)) {
    const reasons = dec.reasons.filter(r => !MISSING.test(r));
    for (const s of strict) if (s.startsWith(`${dec.questionId}: `)) reasons.push(`엄격 검사: ${s.slice(dec.questionId.length + 2)}`);
    if (!reasons.length) continue;
    const q = batch.drafts.find(x => x.id === dec.questionId && x.revision === dec.revision);
    const findings = [];
    for (const [who, rep] of [['codex', batch.reviews.codex], ['claude', batch.reviews.claude], ['argon-blind', batch.argonBlind]]) {
      const it = rep?.items.find(i => i.questionId === q.id && i.revision === q.revision && i.contentHash === dec.contentHash);
      if (it) findings.push(...it.findings.map(f => `${who}: ${f}`));
    }
    out.push({ q, reasons: [...new Set(reasons)], findings });
  }
  return out;
}

function evidenceOf(root, batchId, q) {
  const p = path.join(root, 'content-source/batches', batchId, 'evidence', q.source.evidenceArtifactId);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '(근거 파일 없음)';
}

export function promptFor(root, batchId, list) {
  const items = list.map(({ q, reasons, findings }) => ({ draft: q, evidenceText: evidenceOf(root, batchId, q), defects: reasons, reviewerFindings: findings }));
  return [
    '너는 대한민국 초등학교 3~6학년용 한국어 어휘 문항의 작성자(Argon)다. 총괄은 Claude다. 아래 문항들은 공동검수에서 결함이 지적되어 격리되었다.',
    '파일을 쓰거나 명령을 실행하지 말고, 고친 결과를 답장 JSON으로만 보낸다(총괄의 도구가 검사해 파일에 쓴다).',
    '',
    '문항마다 둘 중 하나로 답한다.',
    '1) 고친다(action "revise"): draft 전체를 고쳐서 보낸다.',
    '   - revision은 정확히 1 올린다. status는 "machine_checked". id·batchId·grade·target·source·gradeBasis·review·schemaVersion은 그대로 둔다(대상 낱말과 사전 근거는 바꿀 수 없다).',
    '   - 바꿀 수 있는 것: stem, options(a~d 4개), correctOptionId, explanation, distractorRationales(오답 3개에만 하나씩), type, difficultyTier, variantTag, dialectRegion(방언일 때만, 방언은 challenge만).',
    '   - 지적(defects·reviewerFindings)을 모두 해소한다: 정답이 문맥상 하나뿐, 다른 보기는 분명히 틀림, 자연스러운 문장(문맥 조각 뒤에 기본형을 붙인 비문 금지), 맞춤법·띄어쓰기·조사 호응, 학년에 맞는 쉬운 보기 말, 정답만 길거나 정답 낱말이 지문에 드러나는 단서 없음, 어린이에게 알맞은 내용, 해설·오답 이유는 각 60자 이내.',
    '   - 정답 뜻은 evidenceText(표준국어대사전 뜻풀이)와 맞아야 한다. 사전 용례를 그대로 베끼지 않는다.',
    '   - selfRefutation: 네 보기를 지문에 하나씩 대입해 정답만 "fits", 나머지는 "does_not_fit"과 이유. uniquenessNote·gradeEvidence도 쓴다.',
    `2) 버린다(action "drop"): 이 낱말·뜻으로는 아이들에게 알맞은 유일 정답 문항을 만들 수 없을 때. reason에 이유를 쓴다. 이미 ${MAX_REVISION_ROUNDS}번 고친 문항(revision ${MAX_REVISION_ROUNDS + 1} 이상)이 또 지적되면 버린다.`,
    '',
    '출력: 아래 형식의 JSON 하나만 ```json 코드 블록으로. 입력의 모든 문항에 하나씩 답한다.',
    '{"items":[{"questionId":"…","action":"revise","draft":{…고친 draft 전체…},"selfRefutation":[{"optionId":"a","substituted":"…","verdict":"does_not_fit","reason":"…"},…4개],"uniquenessNote":"…","gradeEvidence":"…"},{"questionId":"…","action":"drop","reason":"…"}]}',
    '',
    '----- 입력 -----',
    JSON.stringify({ batchId, items }, null, 1),
  ].join('\n');
}

const FIXED = ['schemaVersion', 'batchId', 'id', 'grade', 'gradeBasis', 'target', 'source', 'review'];

/** 답장을 검사해 적용할 변경을 돌려준다. 문항 하나라도 틀리면 그 문항만 이유와 함께 거절한다. */
export function parseRevisions(m, text, list) {
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
    if (it.action === 'drop') {
      if (typeof it.reason !== 'string' || !it.reason) rejected.push(`${it.questionId}: drop 이유 없음`);
      else accepted.push({ action: 'drop', q: cur.q, reason: it.reason });
      continue;
    }
    const problems = [];
    const draft = m.d.questionDraftSchema.safeParse(it.draft);
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
      if (fits.length !== 1 || fits[0] !== draft.data.correctOptionId) problems.push('자체 반박에서 정답만 fits여야 한다');
    }
    if (problems.length) rejected.push(`${it.questionId}: ${problems.join('; ')}`);
    else accepted.push({ action: 'revise', q: cur.q, draft: draft.data, side: sideOk.data });
  }
  for (const id of byId.keys()) rejected.push(`${id}: 답이 없다`);
  return { accepted, rejected };
}

export function apply(root, batchId, accepted) {
  const draftsPath = path.join(root, 'content-source/batches', batchId, 'drafts.json');
  const sidePath = path.join(root, 'content-source/batches', batchId, 'sidecar.json');
  let drafts = readJson(draftsPath);
  const sidecar = readJson(sidePath);
  for (const a of accepted) {
    if (a.action === 'drop') {
      drafts = drafts.filter(q => q.id !== a.q.id);
      sidecar.items = sidecar.items.filter(i => i.id !== a.q.id);
      sidecar.rejected.push({ lemma: a.q.target.lemma, reason: `${a.q.id} r${a.q.revision} 공동검수 결함으로 제외: ${a.reason}` });
    } else {
      drafts = drafts.map(q => (q.id === a.q.id ? a.draft : q));
      sidecar.items = [...sidecar.items.filter(i => i.id !== a.q.id), a.side];
    }
  }
  writeJson(draftsPath, drafts);
  writeJson(sidePath, sidecar);
}

function author(who, cwd, body) {
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

export async function reviseBatch(m, root, batchId, who, log) {
  const batch = m.b.loadBatches(root).find(x => x.batchId === batchId);
  const list = flagged(m, batch);
  if (!list.length) return { batchId, revised: 0, dropped: 0, rejected: 0 };
  const dir = path.join(root, '.orchestrate/revise', batchId);
  fs.mkdirSync(dir, { recursive: true });
  let revised = 0;
  let dropped = 0;
  let rejectedCount = 0;
  for (let i = 0; i < list.length; i += CHUNK) {
    let chunk = list.slice(i, i + CHUNK);
    let note = '';
    for (let attempt = 1; attempt <= 3 && chunk.length; attempt++) {
      const res = await author(who, dir, promptFor(root, batchId, chunk) + note);
      fs.writeFileSync(path.join(dir, `chunk${i / CHUNK + 1}.reply${attempt}.md`), res.out || res.err);
      if (/시간당 실행 상한/.test(res.out)) { log(`${batchId}: 시간당 상한 — 10분 대기`); await sleep(600_000); attempt--; continue; }
      let parsed;
      try { parsed = parseRevisions(m, res.out, chunk); } catch (e) { log(`${batchId} 묶음${i / CHUNK + 1} ${attempt}회차 답장 오류: ${e.message.slice(0, 200)}`); note = `\n\n지난 답장을 읽지 못했다(${e.message.slice(0, 200)}). 형식을 지켜 다시 답한다.`; continue; }
      apply(root, batchId, parsed.accepted);
      revised += parsed.accepted.filter(a => a.action === 'revise').length;
      dropped += parsed.accepted.filter(a => a.action === 'drop').length;
      const done = new Set(parsed.accepted.map(a => a.q.id));
      chunk = chunk.filter(x => !done.has(x.q.id));
      if (parsed.rejected.length) {
        log(`${batchId} 묶음${i / CHUNK + 1} ${attempt}회차 거절 ${parsed.rejected.length}: ${parsed.rejected.slice(0, 3).join(' | ').slice(0, 400)}`);
        note = `\n\n지난 답장에서 아래 문항이 검사를 통과하지 못했다. 이 문항만 고쳐 다시 답한다.\n${parsed.rejected.join('\n')}`;
      }
    }
    rejectedCount += chunk.length;
  }
  return { batchId, revised, dropped, rejected: rejectedCount };
}

async function main() {
  const a = args(process.argv.slice(2));
  const root = path.resolve(a.root ?? path.resolve(import.meta.dirname, '../..'));
  const m = await load(root);
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
    const ids = a.all ? all.filter(x => flagged(m, x).length).map(x => x.batchId) : String(a.batches).split(',');
    const who = a.author ?? 'antigravity';
    const queue = [...ids];
    const results = [];
    const worker = async () => { while (queue.length) { const id = queue.shift(); try { const r = await reviseBatch(m, root, id, who, log); log(JSON.stringify(r)); results.push(r); } catch (e) { log(`${id} 실패: ${e.message}`); results.push({ batchId: id, error: e.message }); } } };
    await Promise.all(Array.from({ length: Math.min(Number(a.parallel ?? 2), ids.length) }, worker));
    console.log(JSON.stringify(results, null, 1));
    return;
  }
  console.error('사용: revise.mjs status|prompt|run --root <dir> ...');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.stack ?? e.message); process.exit(1); });
