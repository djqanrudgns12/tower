#!/usr/bin/env node
// S1 수준 판정. 추적 파일 반영은 W2b 잠금 적용기에 맡긴다.
// node tools/orchestrate/level.mjs run --root <dir> (--batches A,B | --all) [--argon 2 --codex 2] [--level-judge codex|claude --claude 2]
// 두 번째 독립 판정자는 기본 Codex이며, claude-argon-v1 관문은 --level-judge claude로 Claude Opus를 쓴다.
// dry-run fixture: {responses:{A:{argon:[{items:[...]}],codex:[{items:[...]}],spotcheck:[{items:[...]}]}}}
// 각 배열은 해당 배치·판정자의 묶음/재요청 순서. 문자열 답장도 허용한다. 실제 호출로 대체하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runnerImport } from 'vite';
import { resolveReviewConfig, codexCliArgs, codexCliPath, claudeCli, questionRefs, measuredAgyCall, modelAttempt, pendingEvidenceText } from './review.mjs';
import { AGY_MODEL } from './agy.mjs';

const SOURCE_ROOT = path.resolve(import.meta.dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = value => createHash('sha256').update(value).digest('hex');
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, json(value)); };
const safeId = id => { if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error(`배치 ID 오류: ${id}`); return id; };

export async function load() {
  const imp = async file => (await runnerImport(path.join(SOURCE_ROOT, file), { configFile: false, logLevel: 'error', root: SOURCE_ROOT })).module;
  const [d, contracts, levels, lint] = await Promise.all([
    imp('src/contracts/questionDraft.ts'), imp('src/contracts/levels.ts'), imp('tools/content/levels.ts'), imp('src/content/lint.ts'),
  ]);
  return { d, contracts, levels, lint };
}

// 적용기 반영 전의 수정 revision·수준 합의도 읽는다. manifest 없는 미완성 쓰기는 무시한다.
function pendingJson(root, batchId, relative, fallback = null) {
  let value = fs.existsSync(path.join(root, relative)) ? read(path.join(root, relative)) : fallback;
  const dir = path.join(root, '.orchestrate/staging', batchId);
  if (!fs.existsSync(dir)) return value;
  for (const run of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, run, 'manifest.json');
    if (!fs.existsSync(file)) continue;
    const manifest = read(file);
    if (manifest.batchId !== batchId || manifest.runId !== run) throw new Error('staging 식별자 불일치');
    const entry = manifest.writes.find(w => w.path === relative);
    if (entry) {
      const bytes = fs.readFileSync(path.join(dir, run, 'files', relative));
      if (sha(bytes) !== entry.sha256) throw new Error(`staging 해시 불일치: ${relative}`);
      value = JSON.parse(bytes.toString('utf8'));
    }
    if (manifest.deletes.includes(relative)) value = fallback;
  }
  return value;
}

/** 표준국어대사전의 『분야명』 표지만 인정한다. 일반 전문어 언급·품사 「명사」는 표지가 아니다. */
export function stdictSpecialized(text) { return /『\s*[가-힣A-Za-z][가-힣A-Za-z ·ㆍ/]*\s*』/u.test(text); }

function krdictGrade(reference, lemma) {
  const rows = Array.isArray(reference) ? reference : reference?.items ?? reference?.entries;
  const value = Array.isArray(rows) ? rows.find(row => row.lemma === lemma) : rows?.[lemma] ?? reference?.[lemma];
  const grade = typeof value === 'string' ? value : value?.grade ?? value?.krdictGrade;
  return ['초급', '중급', '고급'].includes(grade) ? grade : null;
}

function curriculumCodes(root) {
  const file = path.join(root, 'content-source/reference/curriculum-2022.json');
  if (!fs.existsSync(file)) return null;
  const codes = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'code' && typeof child === 'string' && /^\[?\d{1,2}국\d{2}-\d{2}\]?$/.test(child)) codes.add(child);
      else visit(child);
    }
  };
  visit(read(file));
  return codes;
}

function inputItem(m, root, batchId, q, reference) {
  const evidenceText = pendingEvidenceText(root, batchId, q, '(근거 파일 조회 불가)');
  const evidence = { krdictGrade: krdictGrade(reference, q.target.lemma), stdictSpecialized: stdictSpecialized(evidenceText) };
  return {
    questionId: q.id, revision: q.revision, contentHash: sha(m.d.contentHashInput(q)), grade: q.grade,
    type: q.type, variantTag: q.variantTag ?? 'standard', ...(q.dialectRegion ? { dialectRegion: q.dialectRegion } : {}),
    target: q.target, stem: q.stem, options: q.options, correctOptionId: q.correctOptionId,
    explanation: q.explanation, distractorRationales: q.distractorRationales,
    source: { ...q.source, evidenceText }, precomputed: m.levels.precompute(q, evidence),
    // 판정자가 대상 문항을 스스로 맞히지 않게 불투명도(2/3)가 필요한 문항을 표시한다(variantTag=idiom_proverb, 속담 포함).
    needsIdiomOpacity: (q.variantTag ?? 'standard') === 'idiom_proverb',
  };
}

/** 승인된 계획 원문에서 축 표 전체·6개 판정 예·근거 형식을 가져온다. */
export function rubricText(plan = fs.readFileSync(path.join(SOURCE_ROOT, 'docs/CONTENT_REVIEW_PLAN.md'), 'utf8')) {
  const section = (start, end) => {
    const from = plan.indexOf(start), to = plan.indexOf(end, from + start.length);
    if (from < 0 || to < 0) throw new Error(`수준 루브릭 절을 찾지 못했다: ${start}`);
    return plan.slice(from, to).trim();
  };
  return [section('### 3.1 ', '### 3.2 '), section('판정 예(Antigravity', '### 3.3 '), section('### 3.5 ', '### 3.6 ')].join('\n\n');
}

export function promptFor(items, rubric, phase = 'assess', root = SOURCE_ROOT) {
  const file = path.join(root, 'content-source/reference/curriculum-2022.json');
  const standards = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.code === 'string' && typeof value.text === 'string') standards.push({ code: value.code, text: value.text });
    for (const child of Object.values(value)) visit(child);
  };
  if (fs.existsSync(file)) visit(read(file));
  return [
    '대한민국 초등학교 3~6학년 어휘 문항의 독립 수준 판정자다. 다른 판정자의 결과는 제공하지 않는다.',
    '명령 실행·파일 쓰기 금지. 파일 읽기·인터넷 조회도 하지 말고 아래 입력만 판단한다.',
    rubric,
    'curriculum_explicit은 이 목록의 코드만, 원문 뜻이 낱말과 맞을 때만 사용한다. 목록이 비어 있으면 curriculum_explicit을 쓰지 않는다.',
    '----- 성취기준 정본 코드·원문 전체 -----', JSON.stringify(standards, null, 1),
    phase === 'spotcheck' ? '이번은 근거 대조 표본 재판정이다. 사전 근거와 각 축의 근거를 다시 대조해 reason에 적는다. 합의 변경용이 아니다.' : '각 축을 독립적으로 판정한다.',
    'T2 유형·길이, T3 기본값, 읽기량은 precomputed를 그대로 사용한다. krdictGrade=null은 조회 불가다. needsIdiomOpacity=true인 문항만 idiomOpacity=2(비유가 쉬움) 또는 3(불투명), 나머지는 반드시 null.',
    'L1·L2·T1은 0~3 정수, inference는 0 또는 1. elementaryFit은 pass|too_low|too_high.',
    'basisType은 corpus_graded|curriculum_explicit|stdict_structural|rubric_inferred. unit은 §3.5 형식만, 교과서 단원·쪽수 금지. basisType과 unit의 출처를 일치시킨다.',
    'tier·학년 띠·V·R은 답하지 않는다. 입력의 questionId·revision마다 정확히 한 항목을 쓴다.',
    '답장에 JSON 하나만: {"items":[{"questionId":"…","revision":1,"L1":1,"L2":1,"T1":0,"inference":0,"idiomOpacity":null,"elementaryFit":"pass","basisType":"stdict_structural","unit":"stdict:전문어 표지 없음","reason":"…"}]}',
    '----- 입력 -----', JSON.stringify({ items: items.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'contentHash'))) }, null, 1),
    '명령 실행·파일 쓰기 금지. 답장 본문에 JSON 하나로 답한다.',
  ].join('\n\n');
}

export function parseReply(m, text, expected, judge, model) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const data = JSON.parse(fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (!data || !Array.isArray(data.items) || Object.keys(data).some(k => k !== 'items')) throw new Error('답장은 items 배열 하나가 필요하다');
  const byKey = new Map(expected.map(item => [`${item.questionId}@${item.revision}`, item]));
  if (data.items.length !== expected.length) throw new Error('답장 문항 수 불일치');
  const output = [];
  for (const item of data.items) {
    const key = `${item?.questionId}@${item?.revision}`, input = byKey.get(key);
    if (!input) throw new Error(`미요청·중복·revision 불일치: ${key}`);
    if (['contentHash', 'judge', 'model'].some(k => Object.hasOwn(item, k))) throw new Error('도구 전용 식별 필드가 답장에 있다');
    // 대상이 아닌 문항의 불투명도는 판정에 쓰이지 않으므로 버린다. 대상인데 없으면 아래 judgeScores가 재요청 사유로 던진다.
    const opacity = input.needsIdiomOpacity ? item.idiomOpacity : null;
    const parsed = m.contracts.levelJudgeSchema.parse({ ...item, idiomOpacity: opacity, contentHash: input.contentHash, judge, model });
    m.levels.judgeScores(input.precomputed, parsed); // 관용구 불투명도도 이 묶음의 재요청 대상으로 검사한다.
    output.push(parsed);
    byKey.delete(key);
  }
  return output;
}

/** 잘림 시 명시된 대화 폴더만 탐색한다. 현재 ID·revision·스키마가 맞는 전문만 복원한다. */
export function recoverReply(text, validate, brain = path.join(os.homedir(), '.gemini/antigravity-cli/brain')) {
  try { validate(text); return text; } catch { /* 전문 복원 시도 */ }
  const id = /(?:conversation_id["'\s:=]+|brain\/)([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})(?=[/\s"']|$)/i.exec(text)?.[1];
  if (!id) return text;
  const files = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? files(path.join(dir, e.name)) : e.isFile() && /\.(json|md|txt)(\.resolved)?$/.test(e.name) ? [path.join(dir, e.name)] : []) : [];
  for (const file of files(path.join(brain, id)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)) {
    try { const full = fs.readFileSync(file, 'utf8'); validate(full); return full; } catch { /* 다른 묶음·불완전한 답장은 제외 */ }
  }
  return text;
}

export function selectGradeBasis(m, argon, codex, merged, codes) {
  const prefix = { corpus_graded: /^krdict:/, curriculum_explicit: /^\[/, stdict_structural: /^stdict:/, rubric_inferred: /^rubric_inferred\(/ };
  for (const judge of [argon, codex]) {
    if (prefix[judge.basisType]?.test(judge.unit) && m.lint.lintGradeBasisUnit(judge.unit, codes).length === 0) {
      return { unit: judge.unit.trim(), reviewed: judge.basisType !== 'rubric_inferred' };
    }
  }
  return { unit: `rubric_inferred(L=${merged.L},T=${merged.T})`, reviewed: false };
}

function limit(max) {
  if (!Number.isInteger(max) || max < 1) throw new Error('동시 실행 수는 양의 정수여야 한다');
  let active = 0;
  const queue = [];
  return async fn => {
    if (active >= max) await new Promise(resolve => queue.push(resolve));
    else active++;
    try { return await fn(); } finally { if (queue.length) queue.shift()(); else active--; }
  };
}

function execute(command, args, cwd, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', bytes => { out += bytes; });
    child.stderr.on('data', bytes => { err += bytes; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', () => {}); // 시작 실패/EPIPE는 close 또는 error에서 처리한다.
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0 || timedOut) reject(new Error(`판정 실행 실패(${timedOut ? '시간 초과' : code}): ${err.slice(-1000) || out.slice(-1000)}`));
      else resolve(out.trim());
    });
    child.stdin.end(prompt);
  });
}

export async function liveRespond(request, deps = {}) {
  const { judge, cwd, prompt, config } = request;
  if (judge === 'argon') {
    return (await (deps.agyCall ?? measuredAgyCall)({ ...request, model: AGY_MODEL, timeoutSec: 1200 })).out;
  }
  if (judge === 'claude') {
    const res = await (deps.claudeCli ?? claudeCli)(cwd, prompt, 1800, config);
    if (res.code !== 0 || /^실행 실패/.test(res.out)) throw new Error(`판정 실행 실패(${res.code}): ${(res.err || res.out).slice(-1000)}`);
    return res.out;
  }
  const cli = codexCliPath();
  const outFile = path.join(cwd, `last-${randomUUID()}.md`);
  try {
    await execute(cli, codexCliArgs(cwd, outFile, config), cwd, prompt, 1_800_000);
    return fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  } finally { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); }
}

export function fixtureResponder(fixture) {
  const offsets = new Map();
  return async ({ batchId, judge, phase }) => {
    const role = phase === 'spotcheck' ? 'spotcheck' : judge, key = `${batchId}/${role}`;
    const index = offsets.get(key) ?? 0, response = fixture.responses?.[batchId]?.[role]?.[index];
    if (response === undefined) throw new Error(`fixture 응답 없음: ${key} #${index + 1}`);
    offsets.set(key, index + 1);
    return typeof response === 'string' ? response : JSON.stringify(response);
  };
}

export async function runLevels(options, deps = {}) {
  const root = path.resolve(options.root ?? SOURCE_ROOT);
  const dryRun = options.dryRun === true || options['dry-run'] === true;
  if (dryRun && !options.fixture && !deps.respond) throw new Error('--dry-run은 fixture 또는 가짜 응답기가 필요하다');
  if (options.fixture && !dryRun) throw new Error('--fixture는 --dry-run과 함께 쓴다');
  const respond = deps.respond ?? (dryRun ? fixtureResponder(read(path.resolve(options.fixture))) : request => liveRespond(request, deps));
  const m = deps.modules ?? await load();
  const configs = resolveReviewConfig(options);
  const second = options['level-judge'] ?? options.levelJudge ?? 'codex';
  if (!['codex', 'claude'].includes(second)) throw new Error('--level-judge는 codex 또는 claude여야 한다');
  const pools = deps.modelPools ?? { argon: limit(Number(options.argon ?? 2)), codex: limit(Number(options.codex ?? 2)), claude: limit(Number(options.claude ?? 2)) };
  if (!pools[second]) throw new Error(`${second} 판정 실행 자리 없음`);
  const rubric = rubricText(), codes = curriculumCodes(root);
  const refFile = path.join(root, 'content-source/reference/krdict-grade.json');
  const reference = fs.existsSync(refFile) ? read(refFile) : null;
  const refs = options.questions != null || options['question-list'] != null ? questionRefs(options.questions ?? options['question-list']) : null;
  if (!refs && Boolean(options.all) === Boolean(options.batches)) throw new Error('--all 또는 --batches 중 하나가 필요하다');
  const batchDirs = ['content-source/batches', '.orchestrate/staging'].flatMap(relative => {
    const dir = path.join(root, relative);
    return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [];
  });
  const ids = [...new Set(refs ? refs.map(q => q.batchId) : options.all ? batchDirs.sort() : String(options.batches).split(',').map(s => s.trim()))].map(safeId);

  if (!ids.length) return [];

  async function runGroup(batchIds) {
    const contexts = batchIds.map(batchId => {
      const draftPath = `content-source/batches/${batchId}/drafts.json`, levelPath = `content-source/levels/${batchId}.json`;
      if (pendingJson(root, batchId, `content-source/batches/${batchId}/closed.json`)) return { batchId, closed: true, todo: [] };
      const raw = pendingJson(root, batchId, draftPath);
      if (!raw) throw new Error(`배치 초안 없음: ${batchId}`);
      const drafts = m.d.draftBatchSchema.parse(raw), latest = new Map();
      for (const q of drafts) {
        if (q.batchId !== batchId) throw new Error(`초안 배치 ID 불일치: ${q.id}`);
        if (!latest.has(q.id) || latest.get(q.id).revision < q.revision) latest.set(q.id, q);
      }
      const old = pendingJson(root, batchId, levelPath, { items: [] });
      const wanted = refs ? new Set(refs.filter(q => q.batchId === batchId).map(q => `${q.questionId}@${q.revision}`)) : null;
      const todo = [...latest.values()].filter(q => (!wanted || wanted.has(`${q.id}@${q.revision}`)) && !old.items.some(item => m.levels.isCurrentLevelAssessment(q, item)));
      return { batchId, raw, draftPath, levelPath, latest, old, todo };
    });
    const owner = new Map();
    const inputs = contexts.flatMap(ctx => ctx.todo.map(q => {
      if (owner.has(q.id)) throw new Error(`배치 간 중복 문항 ID: ${q.id}`);
      owner.set(q.id, ctx.batchId);
      return inputItem(m, root, ctx.batchId, q, reference);
    }));
    const batchId = batchIds.join(',');
    const createdAt = new Date().toISOString();
    const runId = `${createdAt.replace(/[-:.]/g, '')}-${process.pid}-${randomUUID()}`;
    const work = path.join(root, '.orchestrate/level', refs ? 'pool' : batchIds[0], runId);
    const request = async (judge, items, chunk, phase = 'assess') => {
      const config = judge === 'argon' ? configs.antigravity : configs[judge];
      const validate = text => parseReply(m, text, items, judge, config.model);
      let error;
      // 첫 요청 + 형식 오류 재요청 최대 3회. 한 판정자의 실패를 다른 판정자에게 보여 주지 않는다.
      for (let attempt = 1; attempt <= 4; attempt++) {
        const cwd = path.join(work, 'sealed', judge, `${phase}-${chunk}-${attempt}`);
        fs.mkdirSync(cwd, { recursive: true });
        const prompt = promptFor(items, rubric, phase, root) + (error ? '\n지난 답장이 JSON·스키마·입력 1:1 검사를 통과하지 못했다. 원래 입력 전체를 형식에 맞게 다시 답한다.' : '');
        const callContext = { batchIds: [...new Set(items.map(q => owner.get(q.questionId)))], phase, attempt };
        const onEvent = options.onEvent ?? deps.onEvent;
        const reply = await pools[judge](() => modelAttempt(judge, () => respond({ judge, phase, batchId, chunk, attempt, cwd, prompt, config, items, root,
          onEvent, callContext, argonPerHour: options.argonPerHour ?? options['argon-per-hour'], validate }),
        { onEvent, sleep: deps.sleep ?? options.sleep, liveArgon: judge === 'argon' && !deps.respond && !dryRun && !deps.agyCall }, callContext));
        const full = judge === 'argon' && !dryRun && !deps.respond ? recoverReply(reply, validate, deps.brain) : reply;
        write(path.join(work, 'replies', `${judge}-${phase}-${chunk}-${attempt}.json`), { config, reply: full });
        try { return validate(full); } catch (e) { error = e; }
      }
      throw new Error(`${batchId} ${judge} ${phase} 묶음${chunk + 1}: 형식 오류, 재요청 3회 소진 (${error.message.slice(0, 300)})`);
    };
    // 판정자는 같은 입력만 받는다. 상대 판정·기존 합의·기존 gradeBasis는 입력에서 제외한다.
    const judgeAll = async judge => {
      const judged = [];
      for (let i = 0; i < inputs.length; i += 50) judged.push(...await request(judge, inputs.slice(i, i + 50), i / 50));
      return judged;
    };
    const judged = await Promise.allSettled([judgeAll('argon'), judgeAll(second)]);
    const failed = judged.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    // codex는 두 번째 판정자(Codex 또는 Claude)의 판정 묶음이다.
    const [argon, codex] = judged.map(result => new Map(result.value.map(j => [j.questionId, j])));
    const results = [];
    for (const ctx of contexts) {
      const { batchId, raw, draftPath, levelPath, latest, old, todo } = ctx;
      if (!todo.length) { results.push({ batchId, assessed: 0, ...(ctx.closed ? { closed: true } : {}) }); continue; }
      const merged = inputs.filter(input => owner.get(input.questionId) === batchId).map(input => m.levels.assessLevel(latest.get(input.questionId), argon.get(input.questionId), codex.get(input.questionId), input.precomputed));
      const byId = new Map(merged.map(item => [item.questionId, item]));
      const nextDrafts = raw.map(q => {
        const item = byId.get(q.id);
        if (!item || item.revision !== q.revision) return q;
        const next = { ...q, difficultyTier: item.merged.ownTier, gradeBasis: { ...q.gradeBasis, ...selectGradeBasis(m, argon.get(q.id), codex.get(q.id), item.merged, codes) } };
        if (sha(m.d.contentHashInput(next)) !== item.contentHash) throw new Error(`${q.id}: 수준 보강이 본문 해시를 바꿨다`);
        return next;
      });
      const nextLevel = m.contracts.levelBatchSchema.parse({ batchId, rubricVersion: m.contracts.LEVEL_RUBRIC_VERSION,
        items: [...old.items.filter(item => m.contracts.levelAssessmentSchema.safeParse(item).success && !merged.some(j => j.questionId === item.questionId && j.revision === item.revision)), ...merged]
          .sort((a, b) => a.questionId.localeCompare(b.questionId) || a.revision - b.revision) });
      const spots = merged.filter(item => item.merged.rule === 4 && latest.has(item.questionId) && m.levels.isCurrentLevelAssessment(latest.get(item.questionId), item)).slice(0, 5);
      // 참고용 표본만 생략한다. nextLevel·nextDrafts·spotCheck 표시는 두 독립 판정 그대로다.
      const checkSpots = options['skip-level-spotcheck'] !== true && spots.length > 0;
      if (checkSpots) {
        const spotInputs = spots.map(item => inputItem(m, root, batchId, latest.get(item.questionId), reference));
        const items = await request(second, spotInputs, contexts.indexOf(ctx), 'spotcheck');
        write(path.join(root, '.orchestrate/level-spotcheck', `${batchId}.json`), { batchId, runId, createdAt, model: configs[second].model, items });
      }
      const staging = `.orchestrate/staging/${batchId}/${runId}`;
      const manifest = { batchId, runId, tool: 'level', model: `argon=${configs.antigravity.model};${second}=${configs[second].model}`, createdAt, writes: [], deletes: [] };
      for (const [file, value] of [[levelPath, nextLevel], [draftPath, nextDrafts]]) {
        const bytes = json(value), target = path.join(root, staging, 'files', file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
        manifest.writes.push({ path: file, sha256: sha(bytes) });
      }
      write(path.join(root, staging, 'manifest.json'), manifest);
      results.push({ batchId, assessed: merged.length, spotChecked: checkSpots ? spots.length : 0, staging });
    }
    return results;
  }
  const results = await Promise.allSettled((refs ? [ids] : ids.map(id => [id])).map(runGroup));
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
  if (errors.length) throw new AggregateError(errors, `수준 판정 실패: ${errors.map(e => e.message).join('; ')}`);
  return results.flatMap(result => result.value);
}

async function main() {
  const args = process.argv.slice(2), options = {};
  if (args.shift() !== 'run') throw new Error('사용: level.mjs run --root <dir> (--batches A,B | --all) [--argon 2 --codex 2] [--skip-level-spotcheck] [--dry-run --fixture <json>]');
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) throw new Error(`옵션 오류: ${args[i]}`);
    const key = args[i].slice(2);
    options[key] = ['all', 'dry-run', 'skip-level-spotcheck'].includes(key) ? true : args[++i];
    if (options[key] === undefined) throw new Error(`옵션 값 없음: ${key}`);
  }
  console.log(JSON.stringify(await runLevels(options), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
