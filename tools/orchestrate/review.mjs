#!/usr/bin/env node
// 공동검수 자동화(공동검수 절차 3~5단계, PRD §9.3). 한 검수자의 한 배치를 두 번에 나눠 맡긴다.
//   1) blind  : 정답 키·해설·오답 이유·사전 뜻풀이 없이 직접 풀고 유일성·학년·문장을 본다.
//   2) reveal : 정답 키·해설·오답 이유·사전 근거를 공개하고, 첫 풀이는 그대로 둔 채 최종 판정을 낸다.
// 답장 JSON을 형식·대상 일치로 검사한 뒤 content-source/reviews/<batch>/<reviewer>.json에 병합한다.
// 검수자가 claude면 공개 단계의 해설 판정으로 총괄 해설 대조(approvals/<batch>.explanation.json)도 만든다.
//
//   node tools/orchestrate/review.mjs status --root <dir> --reviewer claude
//   node tools/orchestrate/review.mjs prompt --root <dir> --reviewer claude --batch Q50-G3-004 --phase blind|reveal
//   node tools/orchestrate/review.mjs accept --root <dir> --reviewer claude --batch Q50-G3-004 --phase blind|reveal --file <답장>
//   node tools/orchestrate/review.mjs ingest --root <dir> --reviewer claude --batch Q50-G3-004
//   node tools/orchestrate/review.mjs run --root <dir> --reviewer claude [--batches A,B | --all] [--parallel 3]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { runnerImport } from 'vite';

const BRIDGE = process.env.AGENT_BRIDGE ?? path.join(os.homedir(), '.local/bin/agent-bridge');
const REVIEWERS = { claude: 'claude-opus-5-5', codex: 'gpt-6.1-sol', antigravity: 'Gemini 4 Argon (High)' };
const FILE_OF = { claude: 'claude.json', codex: 'codex.json', antigravity: 'argon-blind.json' };
const CHOICES = ['a', 'b', 'c', 'd', 'none', 'multiple'];
const VERDICT = ['pass', 'fail', 'uncertain'];
const today = () => new Date().toISOString().slice(0, 10);

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else out._.push(a);
  }
  return out;
}

export async function load(root) {
  const { module: b } = await runnerImport(path.join(root, 'tools/content/bankBuild.ts'), { configFile: false, logLevel: 'error', root });
  return b;
}

const workDir = (root, reviewer, batch) => path.join(root, '.orchestrate/review', reviewer, batch);
const readJson = (f, fb = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fb);
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };

/** 이 검수자가 아직 같은 revision·contentHash로 보지 않은 문항. */
export function pending(b, batch, reviewer) {
  const done = new Set();
  const report = reviewer === 'antigravity' ? batch.argonBlind : batch.reviews[reviewer];
  for (const i of report?.items ?? []) done.add(`${i.questionId}@${i.revision}:${i.contentHash}`);
  return batch.drafts.filter(q => !done.has(`${q.id}@${q.revision}:${b.contentHash(q)}`));
}

function blindItem(b, q) {
  return {
    questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), grade: q.grade, type: q.type,
    ...(q.difficultyTier ? { difficultyTier: q.difficultyTier } : {}),
    ...(q.variantTag ? { variantTag: q.variantTag } : {}),
    ...(q.dialectRegion ? { dialectRegion: q.dialectRegion } : {}),
    lemma: q.target.lemma, partOfSpeech: q.target.partOfSpeech, stem: q.stem,
    options: [...q.options].sort((x, y) => x.id.localeCompare(y.id)),
  };
}

function revealItem(b, root, batchId, q, blind) {
  const evidencePath = path.join(root, 'content-source/batches', batchId, 'evidence', q.source.evidenceArtifactId);
  return {
    ...blindItem(b, q),
    yourBlindChoice: blind.blindChoice,
    yourBlindFindings: blind.findings,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
    distractorRationales: q.distractorRationales,
    source: { provider: q.source.provider, url: q.source.url, senseOrder: q.source.senseOrder, senseId: q.source.senseId,
      evidenceText: fs.existsSync(evidencePath) ? fs.readFileSync(evidencePath, 'utf8').trim() : '(근거 파일 없음)' },
    gradeBasis: q.gradeBasis,
  };
}

const COMMON = [
  '너는 대한민국 초등학교 3~6학년용 한국어 어휘 4지선다 문항의 독립 검수자다. 이 문항들은 아이들이 게임에서 풀게 되므로 엄격하게 본다.',
  '파일을 열거나 명령을 실행하거나 인터넷을 찾지 말고, 아래 JSON만으로 판단한다. 다른 검수자 의견은 주지 않는다.',
  '판정 기준:',
  '- uniqueness: 정답이 문맥상 하나뿐이면 pass. 다른 보기도 문맥에 성립할 수 있으면 fail. 애매하면 uncertain.',
  '- grade: 그 학년 초등학생이 읽고 풀 수 있는 어휘·문장이고 내용이 어린이에게 알맞으면 pass. difficultyTier(basic<core<advanced<challenge)·variantTag(standard/polysemy/confusable/idiom_proverb/dialect)·dialectRegion이 문항과 맞지 않으면 그 사실을 findings에 적고 uncertain 이하로 둔다. 방언 문항은 대화·상황 문맥 단서가 있어야 한다.',
  '- language: 지문·보기가 자연스러운 한국어이고 맞춤법·띄어쓰기·조사 호응이 바르며, 비문(예: 문맥 조각 뒤에 기본형을 그대로 붙인 지문)이 없고, 보기 길이나 정답 낱말 노출 같은 풀이 단서가 없으면 pass.',
  '- findings: 문항마다 판정 근거를 한두 문장. fail·uncertain이면 무엇을 어떻게 고치면 되는지 구체적으로.',
];

export function promptFor(phase, items) {
  const lines = [...COMMON];
  if (phase === 'blind') {
    lines.push(
      '',
      '이번은 1단계(블라인드)다. 정답 키·해설·사전 뜻풀이는 없다. 네가 직접 푼다.',
      '- blindChoice: 문맥에 맞는 보기 하나(a~d). 둘 이상 성립하면 "multiple", 하나도 없으면 "none".',
      '- verdicts: uniqueness·grade·language 세 가지만.',
      '',
      '출력: 아래 형식의 JSON 하나만 ```json 코드 블록으로 답한다. 입력의 순서·개수·questionId·revision·contentHash를 그대로 쓴다.',
      '{"items":[{"questionId":"…","revision":1,"contentHash":"…","blindChoice":"a","verdicts":{"uniqueness":"pass","grade":"pass","language":"pass"},"findings":["…"]}]}',
    );
  } else {
    lines.push(
      '',
      '이번은 2단계(공개 대조)다. 정답 키(correctOptionId)·해설·오답 이유·표준국어대사전 근거(evidenceText)와 네가 1단계에서 고른 답(yourBlindChoice)을 함께 준다. 1단계 답은 바꾸지 않는다.',
      '- source: 정답 보기의 뜻이 근거의 같은 표제어·품사·뜻과 맞으면 pass, 다르면 fail.',
      '- uniqueness·grade·language: 정답 키를 알고 네 보기를 모두 문맥에 대입해 다시 반박한 최종 판정. 1단계 답이 정답과 달랐다면 그 이유를 따져 uniqueness를 정한다.',
      '- explanation: 해설이 정답·근거와 맞고 오답 이유 3개가 각 보기가 틀린 까닭을 바르게 말하면 pass, 틀리거나 모순이면 fail.',
      '',
      '출력: 아래 형식의 JSON 하나만 ```json 코드 블록으로. 입력의 순서·개수·식별자를 그대로 쓴다.',
      '{"items":[{"questionId":"…","revision":1,"contentHash":"…","verdicts":{"source":"pass","uniqueness":"pass","grade":"pass","language":"pass","explanation":"pass"},"findings":["…"]}]}',
    );
  }
  lines.push('', '----- 입력 -----', JSON.stringify({ items }, null, 1));
  return lines.join('\n');
}

/** 답장에서 JSON을 꺼내고 입력과 1:1로 맞는지 검사한다. 틀리면 이유 목록을 던진다. */
export function parseReply(text, phase, expected) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let data;
  try { data = JSON.parse(raw); } catch (e) { throw new Error(`JSON을 읽지 못했다: ${e.message}`); }
  const items = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(items)) throw new Error('items 배열이 없다');
  const problems = [];
  const want = new Map(expected.map(e => [`${e.questionId}@${e.revision}`, e]));
  const seen = new Set();
  for (const it of items) {
    const key = `${it.questionId}@${it.revision}`;
    const e = want.get(key);
    if (!e) { problems.push(`요청하지 않은 문항 ${key}`); continue; }
    if (it.contentHash !== e.contentHash) problems.push(`${key}: contentHash 불일치`);
    if (seen.has(key)) problems.push(`${key}: 중복`);
    seen.add(key);
    const keys = phase === 'blind' ? ['uniqueness', 'grade', 'language'] : ['source', 'uniqueness', 'grade', 'language', 'explanation'];
    for (const k of keys) if (!VERDICT.includes(it.verdicts?.[k])) problems.push(`${key}: verdicts.${k} 값 ${it.verdicts?.[k]}`);
    if (phase === 'blind' && !CHOICES.includes(it.blindChoice)) problems.push(`${key}: blindChoice 값 ${it.blindChoice}`);
    if (!Array.isArray(it.findings) || it.findings.some(f => typeof f !== 'string')) problems.push(`${key}: findings는 문자열 배열`);
  }
  for (const k of want.keys()) if (!seen.has(k)) problems.push(`빠진 문항 ${k}`);
  if (problems.length) throw new Error(problems.slice(0, 12).join('; ') + (problems.length > 12 ? ` …외 ${problems.length - 12}건` : ''));
  return items.map(it => ({ questionId: it.questionId, revision: it.revision, contentHash: it.contentHash, ...(phase === 'blind' ? { blindChoice: it.blindChoice } : {}), verdicts: it.verdicts, findings: it.findings }));
}

async function findBatch(b, root, batchId) {
  const batch = b.loadBatches(root).find(x => x.batchId === batchId);
  if (!batch) throw new Error(`배치 없음: ${batchId}`);
  return batch;
}

/** 단계별 입력을 만든다. reveal은 blind 결과가 있어야 한다. */
export async function buildPhase(b, root, reviewer, batchId, phase) {
  const batch = await findBatch(b, root, batchId);
  const dir = workDir(root, reviewer, batchId);
  const todo = pending(b, batch, reviewer);
  if (phase === 'blind') return { items: todo.map(q => blindItem(b, q)) };
  const blind = readJson(path.join(dir, 'blind.result.json'));
  if (!blind) throw new Error(`${batchId}: blind 결과가 먼저 필요하다`);
  const byKey = new Map(blind.items.map(i => [`${i.questionId}@${i.revision}:${i.contentHash}`, i]));
  const items = todo.filter(q => byKey.has(`${q.id}@${q.revision}:${b.contentHash(q)}`)).map(q => revealItem(b, root, batchId, q, byKey.get(`${q.id}@${q.revision}:${b.contentHash(q)}`)));
  return { items };
}

export function acceptPhase(root, reviewer, batchId, phase, text, expected) {
  const parsed = parseReply(text, phase, expected);
  writeJson(path.join(workDir(root, reviewer, batchId), `${phase}.result.json`), { at: new Date().toISOString(), items: parsed });
  return parsed;
}

/** blind+reveal 결과를 보고서에 병합한다. claude면 총괄 해설 대조 파일도 만든다(옛 Argon 대조는 archive로 옮긴다). */
export async function ingest(b, root, reviewer, batchId) {
  const dir = workDir(root, reviewer, batchId);
  const blind = readJson(path.join(dir, 'blind.result.json'));
  const reveal = readJson(path.join(dir, 'reveal.result.json'));
  if (!blind || !reveal) throw new Error(`${batchId}: blind·reveal 결과가 모두 있어야 한다`);
  const batch = await findBatch(b, root, batchId);
  const drafts = new Map(batch.drafts.map(q => [`${q.id}@${q.revision}`, q]));
  const blindBy = new Map(blind.items.map(i => [`${i.questionId}@${i.revision}:${i.contentHash}`, i]));
  const merged = reveal.items.filter(r => blindBy.has(`${r.questionId}@${r.revision}:${r.contentHash}`)).map(r => {
    const bl = blindBy.get(`${r.questionId}@${r.revision}:${r.contentHash}`);
    return { questionId: r.questionId, revision: r.revision, contentHash: r.contentHash, blindChoice: bl.blindChoice, verdicts: r.verdicts,
      findings: [...bl.findings.map(f => `[블라인드] ${f}`), ...r.findings.map(f => `[공개 대조] ${f}`)] };
  });
  const reportPath = path.join(root, 'content-source/reviews', batchId, FILE_OF[reviewer]);
  const report = readJson(reportPath) ?? {
    reviewId: `QR-AUTO-${reviewer}-${batchId}`, jobId: batchId,
    reviewer: { model: REVIEWERS[reviewer], tool: 'agent-bridge 2단계 블라인드 검수(tools/orchestrate/review.mjs)', freshContext: true, date: today() },
    items: [],
  };
  const keep = report.items.filter(i => !merged.some(m => m.questionId === i.questionId && m.revision === i.revision && m.contentHash === i.contentHash));
  report.items = [...keep, ...merged].sort((x, y) => x.questionId.localeCompare(y.questionId) || x.revision - y.revision);
  writeJson(reportPath, report);

  if (reviewer === 'claude') {
    const expPath = path.join(root, 'content-source/approvals', `${batchId}.explanation.json`);
    const old = readJson(expPath);
    const commander = old && /claude/i.test(old.reviewer.model) ? old : { batchId, reviewer: { model: REVIEWERS.claude, role: 'commander', date: today() }, items: [] };
    if (old && old !== commander) {
      const archived = path.join(root, 'content-source/approvals/archive', `${batchId}.explanation.${old.reviewer.model.replace(/[^A-Za-z0-9]+/g, '-')}.json`);
      if (!fs.existsSync(archived)) writeJson(archived, old);
    }
    const expItems = merged.map(m => {
      const q = drafts.get(`${m.questionId}@${m.revision}`);
      return { questionId: m.questionId, revision: m.revision, contentHash: m.contentHash, rationalesHash: b.rationalesHash(q),
        explanation: m.verdicts.explanation === 'pass' ? 'pass' : 'fail', findings: m.verdicts.explanation === 'pass' ? [] : m.findings.filter(f => f.startsWith('[공개 대조]')) };
    });
    const keepExp = commander.items.filter(i => !expItems.some(e => e.questionId === i.questionId && e.revision === i.revision));
    commander.items = [...keepExp, ...expItems].sort((x, y) => x.questionId.localeCompare(y.questionId) || x.revision - y.revision);
    commander.reviewer.date = today();
    writeJson(expPath, commander);
  }
  const fails = merged.filter(m => m.blindChoice !== drafts.get(`${m.questionId}@${m.revision}`)?.correctOptionId || Object.values(m.verdicts).some(v => v !== 'pass'));
  return { merged: merged.length, flagged: fails.length };
}

/** Claude 검수는 브리지가 자기 자신에게 보내기를 막으므로 Claude Code CLI를 직접 부른다. 파일·명령·웹 도구를 모두 막아 블라인드를 권한으로 보장한다. */
function claudeCliPath() {
  if (process.env.CLAUDE_CLI) return process.env.CLAUDE_CLI;
  const base = path.join(os.homedir(), 'Library/Application Support/Claude/claude-code');
  const versions = fs.existsSync(base) ? fs.readdirSync(base).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })) : [];
  for (const v of versions.reverse()) {
    for (const h of fs.readdirSync(path.join(base, v))) {
      const p = path.join(base, v, h, 'claude.app/Contents/MacOS/claude');
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('Claude Code CLI를 찾지 못했다(CLAUDE_CLI로 지정)');
}
const BLOCKED_TOOLS = ['Bash', 'Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Agent', 'Task'];

function claudeCli(cwd, body, timeoutSec) {
  return new Promise(resolve => {
    const child = spawn(claudeCliPath(), ['-p', '--output-format', 'json', '--model', REVIEWERS.claude, '--effort', 'high', '--disallowedTools', ...BLOCKED_TOOLS], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutSec * 1000);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => {
      clearTimeout(timer);
      let text = out.trim();
      try { const j = JSON.parse(text); text = j.is_error ? `실행 실패: ${j.result ?? j.subtype}` : String(j.result ?? ''); } catch { /* 원문 그대로 */ }
      resolve({ code, out: text, err: err.trim() });
    });
    child.stdin.end(body);
  });
}

/** Codex 검수도 브리지 시간당 상한을 다른 세션과 나눠 쓰지 않도록 codex exec를 직접 부른다(읽기 전용 sandbox, 기록 없는 세션). */
const CODEX_CLI = process.env.CODEX_CLI ?? '/Users/bodyking/Desktop/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
function codexCli(cwd, body, timeoutSec) {
  return new Promise(resolve => {
    const outFile = path.join(cwd, `last-${process.pid}-${Date.now()}.md`);
    const child = spawn(CODEX_CLI, ['exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'read-only', '-C', cwd, '-o', outFile, '-m', REVIEWERS.codex, '-c', 'model_reasoning_effort="xhigh"', '-'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutSec * 1000);
    child.stdout.on('data', () => {});
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => {
      clearTimeout(timer);
      const out = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim() : '';
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
      resolve({ code, out, err: err.trim().slice(-2000) });
    });
    child.stdin.end(body);
  });
}

function bridge(reviewer, cwd, body, waitSec) {
  return new Promise(resolve => {
    const child = spawn(BRIDGE, ['ask', '--from', 'claude', '--to', reviewer, '--cwd', cwd, '--wait', String(waitSec), '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => resolve({ code, out: out.trim(), err: err.trim() }));
    child.stdin.end(body);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function runPhase(b, root, reviewer, batchId, phase, log) {
  const { items } = await buildPhase(b, root, reviewer, batchId, phase);
  if (items.length === 0) return 0;
  const sealed = path.join(root, '.orchestrate/review/sealed', `${reviewer}-${batchId}-${phase}`);
  fs.mkdirSync(sealed, { recursive: true });
  fs.mkdirSync(workDir(root, reviewer, batchId), { recursive: true });
  let note = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const started = Date.now();
    const body = promptFor(phase, items) + note;
    const res = reviewer === 'claude' ? await claudeCli(sealed, body, 1500) : reviewer === 'codex' ? await codexCli(sealed, body, 1800) : await bridge(reviewer, sealed, body, 1200);
    // 계정 사용량 한도에 걸리면 시도 횟수를 쓰지 않고 기다렸다 같은 묶음을 다시 보낸다.
    if (/session limit|usage limit|rate[_ ]limit|\b429\b|hit your limit/i.test(`${res.out}\n${res.err}`) && !/```/.test(res.out)) {
      log(`${batchId} ${phase}: 사용량 한도 — 20분 대기 후 재시도`);
      await sleep(1_200_000);
      attempt--;
      continue;
    }
    fs.writeFileSync(path.join(workDir(root, reviewer, batchId), `${phase}.reply${attempt}.md`), res.out || res.err);
    if (/시간당 실행 상한/.test(res.out)) { log(`${batchId} ${phase}: 시간당 상한 — 10분 뒤 다시`); await sleep(600_000); attempt--; continue; }
    if (/자기 자신에게는|CLI를 찾지 못했다|깨우기 깊이 한도/.test(res.out + res.err)) throw new Error(`${batchId} ${phase}: 실행 수단 오류 — ${(res.out || res.err).slice(0, 200)}`);
    if (!res.out) { log(`${batchId} ${phase} ${attempt}회차: 빈 답장(코드 ${res.code}) ${res.err.slice(0, 200)}`); await sleep(30_000); continue; }
    try {
      acceptPhase(root, reviewer, batchId, phase, res.out, items);
      log(`${batchId} ${phase}: ${items.length}문항 ${Math.round((Date.now() - started) / 1000)}초`);
      return items.length;
    } catch (e) {
      log(`${batchId} ${phase} ${attempt}회차 형식 오류: ${e.message.slice(0, 300)}`);
      note = `\n\n지난 답장이 형식 검사를 통과하지 못했다: ${e.message.slice(0, 600)}\n형식을 정확히 지켜 전체를 다시 답한다.`;
    }
  }
  throw new Error(`${batchId} ${phase}: 4회 모두 형식 오류`);
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  const root = path.resolve(a.root ?? path.resolve(import.meta.dirname, '../..'));
  const reviewer = a.reviewer ?? 'claude';
  if (!FILE_OF[reviewer]) throw new Error(`검수자는 ${Object.keys(FILE_OF).join('·')}`);
  const b = await load(root);
  const log = m => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); fs.appendFileSync(path.join(root, '.orchestrate/review', `${reviewer}.log`), `${line}\n`); };
  fs.mkdirSync(path.join(root, '.orchestrate/review'), { recursive: true });
  const all = b.loadBatches(root);
  if (cmd === 'status') {
    for (const batch of all) {
      const n = pending(b, batch, reviewer).length;
      if (n) console.log(`${batch.batchId}\t미검수 ${n}/${batch.drafts.length}`);
    }
    return;
  }
  if (cmd === 'prompt') {
    const { items } = await buildPhase(b, root, reviewer, a.batch, a.phase);
    process.stdout.write(promptFor(a.phase, items));
    return;
  }
  if (cmd === 'accept') {
    const { items } = await buildPhase(b, root, reviewer, a.batch, a.phase);
    const n = acceptPhase(root, reviewer, a.batch, a.phase, fs.readFileSync(a.file, 'utf8'), items).length;
    console.log(`${a.batch} ${a.phase}: ${n}문항 저장`);
    return;
  }
  if (cmd === 'ingest') {
    console.log(JSON.stringify(await ingest(b, root, reviewer, a.batch)));
    return;
  }
  if (cmd === 'run') {
    const ids = a.all ? all.filter(x => pending(b, x, reviewer).length).map(x => x.batchId) : String(a.batches).split(',');
    const parallel = Number(a.parallel ?? 3);
    const queue = [...ids];
    const summary = [];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          await runPhase(b, root, reviewer, id, 'blind', log);
          await runPhase(b, root, reviewer, id, 'reveal', log);
          const r = await ingest(b, root, reviewer, id);
          log(`${id} 병합: ${r.merged}문항, 지적 ${r.flagged}`);
          summary.push({ id, ...r });
        } catch (e) {
          log(`${id} 실패: ${e.message}`);
          summary.push({ id, error: e.message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, ids.length) }, worker));
    console.log(JSON.stringify(summary, null, 1));
    return;
  }
  console.error('사용: review.mjs status|prompt|accept|ingest|run --root <dir> --reviewer claude|codex|antigravity ...');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
