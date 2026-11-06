#!/usr/bin/env node
// S6: 검증한 새 낱말 → 근거 → Argon 초안. 추적 파일 반영은 W2b의 잠금에 맡긴다.
// CLI 가짜 입력: --dry-run --fixture <json>, { evidence: { entries, texts: { [file]: text } }, responses: [{ items: [...] }, ...] }.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { agyCall, AGY_MODEL } from './agy.mjs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runnerImport } from 'vite';

const TOOL = 'tools/orchestrate/produce.mjs';
const MODEL = 'Gemini 4 Argon (High)';
const IDS = ['a', 'b', 'c', 'd'];
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const json = v => `${JSON.stringify(v, null, 2)}\n`;
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const write = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, json(v)); };
const norm = s => String(s).normalize('NFC').trim().replace(/\s+/g, ' ');
const head = s => norm(s).replace(/[-^()]/g, '');
const pos = s => norm(s).replace(/[「」[\]]/g, '');

function files(dir, name) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? files(path.join(dir, e.name), name) : e.isFile() && (!name || e.name === name) ? [path.join(dir, e.name)] : []);
}

export async function load(root) {
  const imp = async p => (await runnerImport(path.join(root, p), { configFile: false, logLevel: 'error', root })).module;
  return { d: await imp('src/contracts/questionDraft.ts'), b: await imp('tools/content/bankBuild.ts'), lint: await imp('src/content/lint.ts') };
}

// 남은 칸이 많은 낱말부터 교차한다. 분리할 낱말이 없으면 마지막 중복 칸은 다음 배치에 남긴다.
function spreadItems(items, lemmaFor = i => i.lemma) {
  const groups = new Map();
  for (const item of items) {
    const lemma = norm(lemmaFor(item));
    if (!groups.has(lemma)) groups.set(lemma, []);
    groups.get(lemma).push(item);
  }
  const out = [];
  let last;
  while (out.length < items.length) {
    let next;
    for (const [lemma, queue] of groups) {
      if (lemma !== last && queue.length && (!next || queue.length > next[1].length)) next = [lemma, queue];
    }
    if (!next) break;
    last = next[0];
    out.push(next[1].shift());
  }
  return out;
}

export function selectItems(root, wordlist, grade, count) {
  const lists = Array.isArray(wordlist) ? wordlist : [wordlist];
  if (!lists.length || lists.some(w => !w || w.grade !== grade || !Array.isArray(w.items))) throw new Error('낱말 목록의 학년·items 형식 오류');
  const drafts = files(path.join(root, 'content-source/batches'), 'drafts.json')
    .concat(files(path.join(root, '.orchestrate/staging'), 'drafts.json')).flatMap(read);
  const key = (lemma, value) => JSON.stringify([norm(lemma), value]);
  const used = new Set(drafts.map(q => key(q.target.lemma, q.type)));
  // 대기 중인 같은 ID의 새 revision은 추가 문항이 아니다.
  const existing = [...new Map(drafts.map(q => [q.id, q])).values()].filter(q => q.grade === grade);
  const lemmaCounts = new Map(), senseCounts = new Map();
  const add = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);
  for (const q of existing) {
    add(lemmaCounts, norm(q.target.lemma));
    add(senseCounts, key(q.target.lemma, q.source?.senseOrder));
  }
  const candidates = lists.flatMap(w => w.items).filter(i => i.checked === true && typeof i.lemma === 'string' && i.lemma.trim());
  const polysemy = new Set([...existing.map(q => ({ ...q, lemma: q.target.lemma })), ...candidates]
    .filter(i => i.variantTag === 'polysemy').map(i => norm(i.lemma)));
  // 다른 학년을 포함한 전 배치 최대 번호. 아직 반영되지 않은 대기 초안도 예약으로 센다.
  let next = drafts.reduce((n, q) => Math.max(n, Number(/^g[3-6]-argon-(\d+)$/.exec(q.id)?.[1] ?? 0)), 0) + 1;
  const groups = new Map();
  for (const item of candidates) {
    const lemma = norm(item.lemma), sense = key(lemma, item.senseOrder);
    for (const type of Array.isArray(item.types) ? item.types : []) {
      const slot = key(lemma, type), group = groups.get(lemma) ?? [];
      if (used.has(slot) || group.length >= 2 || (lemmaCounts.get(lemma) ?? 0) >= (polysemy.has(lemma) ? 5 : 4) || (senseCounts.get(sense) ?? 0) >= 2) continue;
      group.push({ ...item, type });
      groups.set(lemma, group);
      used.add(slot);
      add(lemmaCounts, lemma);
      add(senseCounts, sense);
    }
  }
  // 먼저 각 낱말 1칸씩 골라 다양성을 확보하고, 남은 자리에 두 번째 칸을 채운다.
  const selected = [];
  for (let round = 0; round < 2; round++) for (const group of groups.values()) {
    if (selected.length < count && group[round]) selected.push(group[round]);
  }
  return spreadItems(selected).map(item => ({ ...item, id: `g${grade}-argon-${String(next++).padStart(4, '0')}` }));
}

export function evidenceInput(items) {
  return [...new Set(items.map(i => {
    if (!['word', 'idiom', 'proverb', 'dialect'].includes(i.kind)) throw new Error(`지원하지 않는 kind: ${i.kind}`);
    return `${i.kind}:${norm(i.lemma)}`;
  }))];
}

function gradeBasis(root, item) {
  const unit = item.gradeEvidence;
  if (typeof unit !== 'string' || /\d+\s*(쪽|단원)/.test(unit)) throw new Error('학년 근거는 계획 §3.5 형식이어야 한다');
  let reference;
  if (/^krdict:(초급|중급|고급)$/.test(unit)) reference = '국립국어원 한국어기초사전 어휘 등급';
  else if (/^stdict:.+/.test(unit)) reference = '국립국어원 표준국어대사전';
  else if (/^rubric_inferred\(L=[0-6],T=[0-9]\)$/.test(unit)) reference = 'CR-1000 수준 루브릭(잠정, S1 판정 전)';
  else {
    const code = /^\[([46]국\d{2}-\d{2})\]\s+\S/.exec(unit)?.[1];
    const registry = path.join(root, 'content-source/reference/curriculum-2022.json');
    if (!code || !fs.existsSync(registry) || !JSON.stringify(read(registry)).includes(code)) throw new Error('학년 근거 형식 오류 또는 정본에 없는 성취기준');
    reference = '2022 개정 국어과 교육과정';
  }
  return { reference, editionYear: 2022, unit, reviewed: false };
}

function targetTier(item, grade) {
  if (![item.expectedL1, item.expectedL2].every(n => Number.isInteger(n) && n >= 0 && n <= 3)) throw new Error('expectedL1·expectedL2는 0~3 정수여야 한다');
  const type = item.type ?? item.types?.[0];
  if (!['definition', 'cloze', 'synonym_context', 'antonym_context', 'usage'].includes(type)) throw new Error('지원하지 않는 목표 유형');
  const variants = ['standard', 'polysemy', 'confusable', 'idiom_proverb', 'dialect'];
  if (!variants.includes(item.variantTag)) throw new Error('지원하지 않는 variantTag');
  if ((item.kind === 'dialect') !== (item.variantTag === 'dialect') || (['idiom', 'proverb'].includes(item.kind) !== (item.variantTag === 'idiom_proverb'))) throw new Error('kind와 variantTag 불일치');
  const t = (type === 'usage' ? 2 : type.endsWith('_context') ? 1 : 0) + [0, 1, 2, 2, 3][variants.indexOf(item.variantTag)];
  const r = 2 * (item.expectedL1 + item.expectedL2) + t - 4 * (grade - 3);
  const floor = item.variantTag === 'dialect' ? 3 : item.variantTag === 'idiom_proverb' ? 2 : item.variantTag === 'standard' ? 0 : 1;
  return ['basic', 'core', 'advanced', 'challenge'][Math.max(floor, r <= 1 ? 0 : r <= 4 ? 1 : r <= 6 ? 2 : 3)];
}

export function prepare(root, batchId, grade, items, evidence) {
  const accepted = [], rejected = [];
  for (const item of items) {
    try {
      // 동음이의어는 O-A1 제안·O-C5 독립 확인을 거친 제공자/항목 ID로만 좁힌다.
      const sourceEntry = item.sourceEntry;
      if (sourceEntry !== undefined && (!sourceEntry || typeof sourceEntry !== 'object'
        || !['stdict', 'opendict'].includes(sourceEntry.provider)
        || typeof sourceEntry.entryId !== 'string' || !/^[1-9]\d*$/.test(sourceEntry.entryId))) {
        throw new Error('사전 항목 선택자는 provider와 양의 정수 문자열 entryId가 필요하다');
      }
      const matches = evidence.entries.filter(e => norm(e.lemma) === norm(item.lemma) && head(e.headword) === head(item.lemma)
        && pos(e.partOfSpeech) === pos(item.partOfSpeech) && e.senseOrder === item.senseOrder
        && (sourceEntry === undefined || ((e.provider ?? 'stdict') === sourceEntry.provider && String(e.wordNo) === sourceEntry.entryId)));
      if (matches.length !== 1) throw new Error('근거 표제어·품사·뜻 번호 불일치, 누락 또는 동음이의어 모호성');
      const e = matches[0];
      if (path.basename(e.file) !== e.file) throw new Error('근거 파일 경로 오류');
      const text = evidence.texts[e.file];
      if (typeof text !== 'string' || sha(text) !== e.sha256) throw new Error('근거 전문 누락 또는 SHA-256 불일치');
      const fixed = {
        schemaVersion: '0.2', batchId, id: item.id, revision: 1, status: 'machine_checked', grade,
        gradeBasis: gradeBasis(root, item),
        target: { lemma: item.lemma, partOfSpeech: item.partOfSpeech, senseKey: `${item.lemma}/${item.partOfSpeech}/${e.provider === 'opendict' ? 'od-' : ''}${e.wordNo}-${e.senseOrder}` },
        type: item.type ?? item.types?.[0], difficultyTier: targetTier(item, grade), variantTag: item.variantTag,
        ...(item.dialectRegion ? { dialectRegion: item.dialectRegion } : {}),
        source: { provider: e.provider ?? 'stdict', entryId: String(e.wordNo), senseId: e.senseId == null ? null : String(e.senseId), senseOrder: e.senseOrder,
          url: e.url, retrievedAt: e.retrievedAt, license: e.license, evidenceHash: e.sha256, evidenceArtifactId: e.file },
        review: { reviewerId: null, reviewedAt: null },
      };
      accepted.push({ item, fixed, evidenceText: text });
    } catch (e) { rejected.push({ lemma: item.lemma, reason: e.message }); }
  }
  return { accepted, rejected };
}

export function promptFor(root, batchId, list, note = '') {
  const orders = fs.readFileSync(path.join(root, 'docs/model_work_orders_v0_5.md'), 'utf8');
  const section = orders.match(/^## 5\.[\s\S]*?(?=^## 6\.)/m)?.[0];
  if (!section) throw new Error('작업 지시문 §5를 찾을 수 없다');
  return [section,
    '너는 초등학교 한국어 어휘 문항 작성자 Argon이다. 아래 목표 tier는 예상 L과 최소 과제 부담으로 잡은 잠정 목표이며 S1에서 확정한다.',
    '지문·보기·해설·오답 이유에 목표 낱말 외 그 학년보다 어려운 낱말 금지. 해설은 1~2문장 60자 이내. 오답 이유는 화면에 그대로 보이는 한 문장.',
    '문장은 아이가 겪을 만한 구체적인 상황을 짧고 분명하게 쓴다. 추상 명사 나열·어색한 직역·억지 교훈·내용 없는 상투 문장(AI SLOP)은 쓰지 않는다. 해설은 왜 정답인지, 오답 이유는 왜 그 상황에 맞지 않는지만 말한다. 목표 낱말은 배우는 말이므로 쉬운 주변 말과 상황 단서로 뜻을 알 수 있게 한다.',
    'basic은 지문+보기 읽기량이 전투 상한(3학년 70, 4학년 80, 5학년 90, 6학년 100)+12음절 이하. 사전 용례를 베끼지 않는다.',
    '문항마다 네 보기를 조사·어미까지 실제 대입한 자체 반박을 쓴다. 정답만 fits, 오답은 does_not_fit이어야 한다.',
    'draft에는 stem, options(a~d 각 한 번), correctOptionId, explanation, distractorRationales(오답 3개)만 쓴다. source·ID·학년·tier·유형 등은 도구가 고정한다.',
    '출력은 JSON 하나: {"items":[{"questionId":"…","draft":{"stem":"…","options":[{"id":"a","text":"…"},{"id":"b","text":"…"},{"id":"c","text":"…"},{"id":"d","text":"…"}],"correctOptionId":"a","explanation":"…","distractorRationales":{"b":"…","c":"…","d":"…"}},"selfRefutation":[{"optionId":"a","substituted":"…","verdict":"fits","reason":"…"},…4개],"uniquenessNote":"…"}]}',
    JSON.stringify({ batchId, items: list.map(x => ({ questionId: x.fixed.id, grade: x.fixed.grade, target: x.fixed.target, difficultyTier: x.fixed.difficultyTier,
      type: x.fixed.type, variantTag: x.fixed.variantTag, dialectRegion: x.fixed.dialectRegion, confusableWith: x.item.confusableWith, gradeEvidence: x.item.gradeEvidence, evidenceText: x.evidenceText })) }, null, 1),
    note, '답장 본문에 JSON으로 답하라. 명령 실행·파일 쓰기 금지.',
  ].join('\n\n');
}

function replyData(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(raw);
  if (!Array.isArray(data.items)) throw new Error('답장 items 배열 없음');
  return data;
}

// revise.mjs의 코드 블록/본문 JSON 파싱을 따른다. 잘린 답장은 지정 대화의 전문만 읽는다.
export function recoverReply(text, list, brain = path.join(os.homedir(), '.gemini/antigravity-cli/brain')) {
  try { replyData(text); return text; } catch { /* 아래에서 잘린 전문 복원 */ }
  const id = /(?:conversation_id["'\s:=]+|brain\/)([a-f0-9-]{36})(?=[/\s"']|$)/i.exec(text)?.[1];
  if (!id || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) return text;
  const candidates = files(path.join(brain, id)).filter(f => /\.(json|md|txt)(\.resolved)?$/.test(f));
  for (const f of candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)) {
    try {
      const full = fs.readFileSync(f, 'utf8');
      const data = replyData(full);
      if (data.items.length === list.length && list.every(x => data.items.filter(i => i.questionId === x.fixed.id).length === 1)) return full;
    } catch { /* 완전한 현재 묶음 응답만 사용 */ }
  }
  return text;
}

export function parseDrafts(m, text, list) {
  const data = replyData(text);
  const requested = new Set(list.map(x => x.fixed.id));
  if (data.items.some(i => !i || !requested.has(i.questionId))) throw new Error('요청하지 않은 문항이 답장에 있다');
  const accepted = [], rejected = [];
  for (const x of list) {
    try {
      const rows = data.items.filter(i => i.questionId === x.fixed.id);
      if (rows.length !== 1) throw new Error('답장 문항 누락 또는 중복');
      const it = rows[0];
      const allowed = ['stem', 'options', 'correctOptionId', 'explanation', 'distractorRationales'];
      if (!it.draft || Object.keys(it.draft).some(k => !allowed.includes(k))) throw new Error('초안에 허용되지 않은 필드');
      const draft = m.d.questionDraftSchema.parse({ ...it.draft, ...x.fixed });
      if (new Set(draft.options.map(o => o.id)).size !== 4) throw new Error('보기 ID 중복');
      const side = m.d.draftSidecarSchema.shape.items.element.parse({ id: draft.id, revision: 1, selfRefutation: it.selfRefutation,
        uniquenessNote: it.uniquenessNote, gradeEvidence: x.item.gradeEvidence });
      const fits = side.selfRefutation.filter(r => r.verdict === 'fits');
      if (new Set(side.selfRefutation.map(r => r.optionId)).size !== 4 || fits.length !== 1 || fits[0].optionId !== draft.correctOptionId) throw new Error('자체 반박은 4보기 각각 한 번, 정답만 fits여야 한다');
      const issues = [...m.lint.lintQuestion(m.b.toBankQuestion(draft)), ...m.lint.lintBatchStrict([draft])];
      if (issues.length) throw new Error([...new Set(issues)].join('; '));
      accepted.push({ draft, side });
    } catch (e) { rejected.push({ id: x.fixed.id, lemma: x.item.lemma, reason: e.message }); }
  }
  return { accepted, rejected };
}

/** 보기 글과 자체 반박을 같은 치환으로 이동한다. 첫 검수 전이므로 revision은 그대로다. */
export function moveAnswer(pair, desired) {
  if (!IDS.includes(desired)) throw new Error('정답 위치 오류');
  const out = structuredClone(pair);
  const old = out.draft.correctOptionId;
  const map = id => id === old ? desired : id === desired ? old : id;
  out.draft.options = out.draft.options.map(o => ({ ...o, id: map(o.id) })).sort((a, b) => a.id.localeCompare(b.id));
  out.draft.correctOptionId = desired;
  out.draft.distractorRationales = Object.fromEntries(Object.entries(out.draft.distractorRationales).map(([id, reason]) => [map(id), reason]));
  out.side.selfRefutation = out.side.selfRefutation.map(r => ({ ...r, optionId: map(r.optionId) })).sort((a, b) => a.optionId.localeCompare(b.optionId));
  return out;
}

export function balanceAnswers(pairs) {
  // 매 묶음의 순서를 번갈아 뒤집어 균등 분포를 만들고 abcd/dcba 순환·4연속을 피한다.
  const pattern = ['b', 'd', 'a', 'c', 'a', 'c', 'b', 'd'];
  return pairs.map((p, i) => moveAnswer(p, pattern[i % pattern.length]));
}

function command(exe, argv, cwd, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, argv, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', reject);
    child.stdin.on('error', e => { if (e.code !== 'EPIPE') reject(e); });
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`명령 실패(${code}): ${err || out}`)));
    child.stdin.end(input);
  });
}

async function fetchEvidence({ root, batchId, inputFile, outputDir }) {
  // fetch-evidence는 자기 파일 위치로 root를 정하므로 반드시 요청한 저장소의 스크립트를 실행한다.
  await command(process.execPath, ['--use-system-ca', path.join(root, 'tools/fetch-evidence.mjs'), batchId, '--file', inputFile, '--output-dir', outputDir], root);
  const dir = outputDir;
  const index = read(path.join(dir, 'index.json'));
  return { index, entries: index.entries, texts: Object.fromEntries(index.entries.map(e => {
    if (path.basename(e.file) !== e.file) throw new Error('근거 파일 경로 오류');
    return [e.file, fs.readFileSync(path.join(dir, e.file), 'utf8')];
  })) };
}

export async function author(request, deps = {}) {
  return (await (deps.agyCall ?? agyCall)({ ...request, model: AGY_MODEL, timeoutSec: 1200 })).out;
}

/** dryRun에서는 두 의존성을 반드시 주입한다. 실수로 모델·네트워크를 호출하지 않는다. */
export async function produce(options, deps = {}) {
  const dir = path.join(path.resolve(options.root), '.orchestrate/produce');
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, 'producer.lock');
  try { fs.writeFileSync(lock, json({ pid: process.pid, batchId: options.batchId }), { flag: 'wx' }); }
  catch (e) { if (e.code === 'EEXIST') throw new Error(`다른 제작 실행의 ID 예약 잠금이 있다: ${lock}. 종료된 실행이면 총괄이 확인 후 해제한다.`, { cause: e }); throw e; }
  try { return await produceRun(options, deps); }
  finally { fs.unlinkSync(lock); }
}

async function produceRun(options, deps) {
  const { root: rootArg, wordlist, batchId, grade, count = 50, dryRun = false } = options;
  const root = path.resolve(rootArg);
  if (!/^Q50-G[3-6]-\d{3}$/.test(batchId) || !batchId.startsWith(`Q50-G${grade}-`) || !Number.isInteger(count) || count < 1 || count > 60) throw new Error('배치·학년·count 인자 오류');
  const draftsPath = path.join(root, 'content-source/batches', batchId, 'drafts.json');
  if (fs.existsSync(draftsPath)) throw new Error('이미 drafts.json이 있는 배치에는 제작할 수 없다');
  if (files(path.join(root, '.orchestrate/staging', batchId), 'manifest.json').length) throw new Error('이미 대기 결과가 있는 배치');
  if (dryRun && (!deps.respond || !deps.fetchEvidence)) throw new Error('--dry-run은 가짜 응답기·근거 조회 주입이 필요하다(--fixture <json>)');
  const m = deps.modules ?? await load(root);
  const lists = wordlistPaths(wordlist).map(file => read(path.resolve(root, file)));
  const items = selectItems(root, lists, grade, count);
  if (!items.length) throw new Error('제작할 checked=true 낱말·유형 칸이 없다');
  const createdAt = (deps.now?.() ?? new Date()).toISOString();
  const runId = `${createdAt.replace(/[-:]/g, '').replace('.', '')}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  const work = path.join(root, '.orchestrate/produce', batchId, runId);
  const cwd = path.join(work, 'sealed');
  fs.mkdirSync(cwd, { recursive: true });
  const inputFile = path.join(work, 'evidence-input.json');
  write(inputFile, evidenceInput(items));
  // 조회 직전에도 확인한다. 다른 제작기의 이미 반영된 배치를 건드리지 않는다.
  if (fs.existsSync(draftsPath)) throw new Error('근거 조회 전에 대상 배치가 생성되었다');
  const evidence = await (deps.fetchEvidence ?? fetchEvidence)({ root, batchId, inputFile, items, outputDir: path.join(work, 'evidence') });
  const prepared = prepare(root, batchId, grade, items, evidence);
  const rejected = [...prepared.rejected], pairs = [];
  for (let offset = 0; offset < prepared.accepted.length; offset += 12) {
    let pending = prepared.accepted.slice(offset, offset + 12), note = '';
    for (let attempt = 1; attempt <= 2 && pending.length; attempt++) {
      let parsed;
      try {
        const prompt = promptFor(root, batchId, pending, note);
        const reply = await (deps.respond ?? (request => author(request, deps)))({ prompt, cwd, items: pending, attempt, root,
          argonPerHour: options.argonPerHour ?? options['argon-per-hour'], validate: text => {
            const data = replyData(text);
            if (data.items.length !== pending.length || !pending.every(x => data.items.filter(i => i.questionId === x.fixed.id).length === 1)) throw new Error('제작 대상 불일치');
          } });
        const full = recoverReply(reply, pending, deps.brain);
        fs.writeFileSync(path.join(work, `chunk${offset / 12 + 1}.reply${attempt}.md`), full);
        parsed = parseDrafts(m, full, pending);
      } catch (e) { parsed = { accepted: [], rejected: pending.map(x => ({ id: x.fixed.id, lemma: x.item.lemma, reason: e.message })) }; }
      pairs.push(...parsed.accepted);
      const done = new Set(parsed.accepted.map(p => p.draft.id));
      pending = pending.filter(x => !done.has(x.fixed.id));
      note = `지난 답장의 실패 문항만 한 번 수정한다:\n${parsed.rejected.map(r => `${r.id}: ${r.reason}`).join('\n')}`;
      if (attempt === 2) rejected.push(...parsed.rejected.map(({ lemma, reason }) => ({ lemma, reason })));
    }
  }
  // 수정 답장이 나중에 와도 원래 낱말 순서로 조립한다.
  const order = new Map(items.map((x, i) => [x.id, i]));
  let accepted = pairs.sort((a, b) => order.get(a.draft.id) - order.get(b.draft.id));
  // 배치 지문/의미 중복 같은 문항별 엄격 오류는 제외하고 이유를 남긴다.
  const localIssues = m.lint.lintBatchStrict(accepted.map(p => p.draft));
  accepted = accepted.filter(p => {
    const reasons = localIssues.filter(s => s.startsWith(`${p.draft.id}: `));
    if (reasons.length) rejected.push({ lemma: p.draft.target.lemma, reason: reasons.join('; ') });
    return !reasons.length;
  });
  const spaced = spreadItems(accepted, p => p.draft.target.lemma);
  const kept = new Set(spaced.map(p => p.draft.id));
  for (const p of accepted) if (!kept.has(p.draft.id)) rejected.push({ lemma: p.draft.target.lemma, reason: '같은 낱말이 연속되지 않도록 분리할 다른 낱말이 없다' });
  accepted = balanceAnswers(spaced);
  const drafts = accepted.map(p => p.draft);
  const issues = m.lint.lintBatchStrict(drafts);
  if (issues.length) throw new Error(`최종 배치 검사 실패: ${issues.join('; ')}`);
  if (drafts.length) m.d.draftBatchSchema.parse(drafts);
  const sidecar = m.d.draftSidecarSchema.parse({ batchId, jobId: batchId, producer: { model: MODEL, tool: TOOL, date: createdAt.slice(0, 10) }, items: accepted.map(p => p.side), rejected });
  const dir = path.join(root, '.orchestrate/staging', batchId, runId);
  // 전부 거절된 경우 빈 drafts.json 없이 반려 기록·근거만 보존한다.
  const outputs = { ...(drafts.length ? { 'drafts.json': json(drafts) } : {}), 'sidecar.json': json(sidecar),
    'evidence/index.json': json(evidence.index ?? { entries: evidence.entries }) };
  for (const entry of evidence.entries) {
    const text = evidence.texts[entry.file];
    if (path.basename(entry.file) !== entry.file || entry.file === 'index.json' || typeof text !== 'string' || sha(text) !== entry.sha256) throw new Error('근거 staging 경로·해시 불일치');
    outputs[`evidence/${entry.file}`] = text;
  }
  const writes = Object.entries(outputs).map(([name, bytes]) => {
    const relative = `content-source/batches/${batchId}/${name}`;
    const file = path.join(dir, 'files', relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    return { path: relative, sha256: sha(bytes) };
  });
  const manifest = { batchId, runId, tool: TOOL, model: MODEL, createdAt, writes, deletes: [] };
  // manifest를 마지막에 쓰므로 완성되지 않은 파일은 W2b가 읽지 않는다.
  write(path.join(dir, 'manifest.tmp'), manifest);
  fs.renameSync(path.join(dir, 'manifest.tmp'), path.join(dir, 'manifest.json'));
  return { manifest, stagingDir: dir, produced: drafts.length, rejected: rejected.length };
}

function wordlistPaths(value) {
  const paths = (Array.isArray(value) ? value : [value]).flatMap(file => typeof file === 'string' ? file.split(',').map(s => s.trim()) : ['']);
  if (!paths.length || paths.some(file => !file)) throw new Error('--wordlist에 하나 이상의 목록 경로가 필요하다');
  return [...new Set(paths)];
}

export function parseArgs(args) {
  const argv = [...args], a = { wordlist: [] };
  if (argv.shift() !== 'run') throw new Error('사용: produce.mjs run --root <dir> --wordlist <json[,json]> [--wordlist <json>] --batch Q50-G<N>-0NN --grade <N> [--count 50] [--dry-run --fixture <json>]');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true;
    else if (/^--(root|wordlist|batch|grade|count|fixture|argon-per-hour)$/.test(argv[i]) && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      const name = argv[i].slice(2), value = argv[++i];
      if (name === 'wordlist') a.wordlist.push(value);
      else a[name] = value;
    }
    else throw new Error(`알 수 없거나 값이 없는 인자: ${argv[i]}`);
  }
  a.wordlist = wordlistPaths(a.wordlist);
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const root = path.resolve(a.root ?? path.join(import.meta.dirname, '../..'));
  const deps = {};
  if (a.dryRun && a.fixture) {
    const fixture = read(path.resolve(root, a.fixture));
    let call = 0;
    deps.fetchEvidence = async () => fixture.evidence;
    deps.respond = async () => { const response = fixture.responses[call++]; if (!response) throw new Error('가짜 응답 부족'); return typeof response === 'string' ? response : json(response); };
  }
  console.log(json(await produce({ root, wordlist: a.wordlist, batchId: a.batch, grade: Number(a.grade), count: Number(a.count ?? 50), dryRun: a.dryRun, argonPerHour: a['argon-per-hour'] }, deps)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
