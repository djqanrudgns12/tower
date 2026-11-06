#!/usr/bin/env node
// 공동검수 자동화(공동검수 절차 3~5단계, PRD §9.3). 한 검수자의 한 배치를 두 번에 나눠 맡긴다.
//   1) blind  : 정답 키·해설·오답 이유·사전 뜻풀이 없이 직접 풀고 유일성·학년·문장을 본다.
//   2) reveal : 정답 키·해설·오답 이유·사전 근거를 공개하고, 첫 풀이는 그대로 둔 채 최종 판정을 낸다.
// 답장 JSON을 형식·대상 일치로 검사한 뒤 보고서 병합 결과를 .orchestrate/staging에 쌓는다.
// 검수자가 claude면 공개 단계의 해설 판정으로 총괄 해설 대조(approvals/<batch>.explanation.json)도 만든다.
//
//   node tools/orchestrate/review.mjs status --root <dir> --reviewer claude
//   node tools/orchestrate/review.mjs prompt --root <dir> --reviewer claude --batch Q50-G3-004 --phase blind|reveal
//   node tools/orchestrate/review.mjs accept --root <dir> --reviewer claude --batch Q50-G3-004 --phase blind|reveal --file <답장>
//   node tools/orchestrate/review.mjs ingest --root <dir> --reviewer claude --batch Q50-G3-004
// 문항 제한: --questions ID@revision,ID@revision (모든 단계에 같은 목록 전달)
//   node tools/orchestrate/review.mjs run --root <dir> --reviewer claude [--batches A,B | --all] [--parallel 3]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { runnerImport } from 'vite';
import { agyCall, AGY_MODEL } from './agy.mjs';
const REVIEWERS = { claude: 'claude-opus-5-5', codex: 'gpt-6.1-sol', antigravity: 'Gemini 4 Argon (High)' };
const FILE_OF = { claude: 'claude.json', codex: 'codex.json', antigravity: 'argon-blind.json' };
const CHOICES = ['a', 'b', 'c', 'd', 'none', 'multiple'];
const VERDICT = ['pass', 'fail', 'uncertain'];
const today = () => new Date().toISOString().slice(0, 10);
const EFFORTS = {
  claude: ['low', 'medium', 'high', 'xhigh', 'max'],
  codex: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  antigravity: ['high'],
};

function validateConfig(reviewer, config) {
  const family = reviewer === 'claude' ? /^claude-/ : reviewer === 'codex' ? /^gpt-/ : /^Gemini /;
  if (typeof config?.model !== 'string' || !family.test(config.model) || !EFFORTS[reviewer]?.includes(config.effort)) {
    throw new Error(`${reviewer}: 모델·effort 설정 오류 (${JSON.stringify(config)})`);
  }
  return { model: config.model, effort: config.effort };
}

/** CLI > 환경변수 > 기존 기본값. 실행 전에 양쪽 역할의 설정을 모두 검사한다. */
export function resolveReviewConfig(cli = {}, env = process.env) {
  return Object.fromEntries(Object.keys(REVIEWERS).map(reviewer => {
    const prefix = `REVIEW_${reviewer.toUpperCase()}`;
    return [reviewer, validateConfig(reviewer, {
      model: cli[`${reviewer}-model`] ?? env[`${prefix}_MODEL`] ?? REVIEWERS[reviewer],
      effort: cli[`${reviewer}-effort`] ?? env[`${prefix}_EFFORT`] ?? (reviewer === 'codex' ? 'xhigh' : 'high'),
    })];
  }));
}

function reviewOptions(reviewer, options = {}) {
  const questionKeys = options.questionKeys == null ? null : new Set(typeof options.questionKeys === 'string' ? options.questionKeys.split(',') : options.questionKeys);
  if (questionKeys && [...questionKeys].some(key => typeof key !== 'string' || !/^.+@[1-9]\d*$/.test(key))) throw new Error('--questions는 ID@revision 목록이어야 한다');
  return { config: validateConfig(reviewer, options.config ?? resolveReviewConfig()[reviewer]), archiveExisting: options.archiveExisting === true, questionKeys };
}

export function assertPhaseConfig(saved, current, phase) {
  if (!saved || saved.model !== current.model || saved.effort !== current.effort) {
    throw new Error(`${phase}: 저장된 검수 설정과 현재 설정이 다르다. 같은 모델·effort로 다시 시작해야 한다`);
  }
}

/** 다른 모델의 보고서를 자동으로 재사용하지 않는다. 보관은 ingest의 staging에서 수행한다. */
export function existingReportArchive(batchId, reviewer, report, config, archiveExisting = false) {
  if (!report || report.reviewer?.model === config.model) return null;
  if (!archiveExisting) throw new Error(`${batchId} ${reviewer}: 기존 보고서 모델 ${report.reviewer?.model} ≠ ${config.model}. --archive-existing 필요`);
  if (typeof report.reviewer?.model !== 'string' || !report.reviewer.model) throw new Error(`${batchId}: 기존 보고서 모델이 없다`);
  return `content-source/reviews/archive/${batchId}.${reviewer}.${report.reviewer.model.replace(/[^A-Za-z0-9]/g, '-')}.json`;
}

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

// 잠금 반영 전 여러 회차가 끝나도 직전 대기 보고서·해설·보관 원문을 이어 읽는다.
function pendingReviewFiles(root, batchId) {
  const base = path.join(root, '.orchestrate/staging', batchId);
  const stages = (fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }) : [])
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort().flatMap(runId => {
      const dir = path.join(base, runId), file = path.join(dir, 'manifest.json');
      if (!fs.existsSync(file)) return [];
      const manifest = readJson(file);
      if (manifest.batchId !== batchId || manifest.runId !== runId || !Array.isArray(manifest.writes)
        || !Array.isArray(manifest.deletes) || !Number.isFinite(Date.parse(manifest.createdAt))) {
        throw new Error(`${batchId}: 대기 manifest 식별자·형식 오류`);
      }
      return [{ dir, manifest }];
    });
  const bytes = relative => {
    const tracked = path.join(root, relative);
    let value = fs.existsSync(tracked) ? fs.readFileSync(tracked) : null;
    for (const { dir, manifest } of stages) {
      const writes = manifest.writes.filter(write => write.path === relative);
      if (writes.length > 1) throw new Error(`${batchId}: 대기 경로 중복: ${relative}`);
      if (writes.length) {
        value = fs.readFileSync(path.join(dir, 'files', relative));
        if (createHash('sha256').update(value).digest('hex') !== writes[0].sha256) throw new Error(`대기 해시 불일치: ${relative}`);
      }
      if (manifest.deletes.includes(relative)) value = null;
    }
    return value;
  };
  return {
    bytes,
    json: relative => { const value = bytes(relative); return value === null ? null : JSON.parse(value.toString('utf8')); },
    lastTime: Math.max(0, ...stages.map(({ manifest }) => Date.parse(manifest.createdAt))),
  };
}
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };

/** 이 검수자가 아직 같은 revision·contentHash로 보지 않은 문항. */
export function pending(b, batch, reviewer, options) {
  const done = new Set();
  const selected = options ? reviewOptions(reviewer, options).questionKeys : null;
  const drafts = batch.drafts.filter(q => !selected || selected.has(`${q.id}@${q.revision}`));
  const report = reviewer === 'antigravity' ? batch.argonBlind : batch.reviews[reviewer];
  if (options) {
    const { config, archiveExisting } = reviewOptions(reviewer, options);
    if (existingReportArchive(batch.batchId, reviewer, report, config, archiveExisting)) return drafts;
  }
  for (const i of report?.items ?? []) done.add(`${i.questionId}@${i.revision}:${i.contentHash}`);
  return drafts.filter(q => !done.has(`${q.id}@${q.revision}:${b.contentHash(q)}`));
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
      '출력: 아래 형식의 JSON 하나만 ```json 코드 블록으로 답한다. 입력의 순서·개수·questionId·revision을 그대로 쓴다. 문자열 안의 큰따옴표는 쓰지 말고 작은따옴표나 ‘ ’를 쓴다.',
      '{"items":[{"questionId":"…","revision":1,"blindChoice":"a","verdicts":{"uniqueness":"pass","grade":"pass","language":"pass"},"findings":["…"]}]}',
    );
  } else {
    lines.push(
      '',
      '이번은 2단계(공개 대조)다. 정답 키(correctOptionId)·해설·오답 이유·표준국어대사전 근거(evidenceText)와 네가 1단계에서 고른 답(yourBlindChoice)을 함께 준다. 1단계 답은 바꾸지 않는다.',
      '- source: 정답 보기의 뜻이 근거의 같은 표제어·품사·뜻과 맞으면 pass, 다르면 fail.',
      '- uniqueness·grade·language: 정답 키를 알고 네 보기를 모두 문맥에 대입해 다시 반박한 최종 판정. 1단계 답이 정답과 달랐다면 그 이유를 따져 uniqueness를 정한다.',
      '- explanation: 해설이 정답·근거와 맞고 오답 이유 3개가 각 보기가 틀린 까닭을 바르게 말하면 pass, 틀리거나 모순이면 fail.',
      '',
      '출력: 아래 형식의 JSON 하나만 ```json 코드 블록으로. 입력의 순서·개수·questionId·revision을 그대로 쓴다. 문자열 안의 큰따옴표는 쓰지 말고 작은따옴표나 ‘ ’를 쓴다.',
      '{"items":[{"questionId":"…","revision":1,"verdicts":{"source":"pass","uniqueness":"pass","grade":"pass","language":"pass","explanation":"pass"},"findings":["…"]}]}',
    );
  }
  // 64자리 해시는 모델이 옮겨 적다 틀리므로 보내지 않는다. 도구가 questionId·revision으로 다시 붙인다.
  lines.push('', '----- 입력 -----', JSON.stringify({ items: items.map(it => Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'contentHash'))) }, null, 1));
  return lines.join('\n');
}

/** 답장에서 JSON을 꺼내고 입력과 1:1로 맞는지 검사한다. 틀리면 이유 목록을 던진다. */
export function parseReply(text, phase, expected) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let data;
  try { data = JSON.parse(raw); } catch (e) { throw new Error(`JSON을 읽지 못했다: ${e.message}`, { cause: e }); }
  const items = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(items)) throw new Error('items 배열이 없다');
  const problems = [];
  const want = new Map(expected.map(e => [`${e.questionId}@${e.revision}`, e]));
  const seen = new Set();
  for (const it of items) {
    const key = `${it.questionId}@${it.revision}`;
    const e = want.get(key);
    if (!e) { problems.push(`요청하지 않은 문항 ${key}`); continue; }
    if (seen.has(key)) problems.push(`${key}: 중복`);
    seen.add(key);
    const keys = phase === 'blind' ? ['uniqueness', 'grade', 'language'] : ['source', 'uniqueness', 'grade', 'language', 'explanation'];
    for (const k of keys) if (!VERDICT.includes(it.verdicts?.[k])) problems.push(`${key}: verdicts.${k} 값 ${it.verdicts?.[k]}`);
    if (phase === 'blind' && !CHOICES.includes(it.blindChoice)) problems.push(`${key}: blindChoice 값 ${it.blindChoice}`);
    if (!Array.isArray(it.findings) || it.findings.some(f => typeof f !== 'string')) problems.push(`${key}: findings는 문자열 배열`);
  }
  for (const k of want.keys()) if (!seen.has(k)) problems.push(`빠진 문항 ${k}`);
  if (problems.length) throw new Error(problems.slice(0, 12).join('; ') + (problems.length > 12 ? ` …외 ${problems.length - 12}건` : ''));
  return items.map(it => ({ questionId: it.questionId, revision: it.revision, contentHash: want.get(`${it.questionId}@${it.revision}`).contentHash, ...(phase === 'blind' ? { blindChoice: it.blindChoice } : {}), verdicts: it.verdicts, findings: it.findings }));
}

async function findBatch(b, root, batchId) {
  const batch = b.loadBatches(root).find(x => x.batchId === batchId);
  if (!batch) throw new Error(`배치 없음: ${batchId}`);
  return batch;
}

/** 단계별 입력을 만든다. reveal은 blind 결과가 있어야 한다. */
export async function buildPhase(b, root, reviewer, batchId, phase, options = {}) {
  const resolved = reviewOptions(reviewer, options);
  const batch = await findBatch(b, root, batchId);
  const dir = workDir(root, reviewer, batchId);
  const todo = pending(b, batch, reviewer, resolved);
  if (phase === 'blind') {
    const input = { config: resolved.config, items: todo.map(q => blindItem(b, q)) };
    writeJson(path.join(dir, 'blind.input.json'), input);
    return input;
  }
  if (phase !== 'reveal') throw new Error(`검수 단계 오류: ${phase}`);
  const blind = readJson(path.join(dir, 'blind.result.json'));
  if (!blind) throw new Error(`${batchId}: blind 결과가 먼저 필요하다`);
  assertPhaseConfig(blind.config, resolved.config, 'blind');
  const byKey = new Map(blind.items.map(i => [`${i.questionId}@${i.revision}:${i.contentHash}`, i]));
  const items = todo.filter(q => byKey.has(`${q.id}@${q.revision}:${b.contentHash(q)}`)).map(q => revealItem(b, root, batchId, q, byKey.get(`${q.id}@${q.revision}:${b.contentHash(q)}`)));
  const input = { config: resolved.config, items };
  writeJson(path.join(dir, 'reveal.input.json'), input);
  return input;
}

export function acceptPhase(root, reviewer, batchId, phase, text, expected, options = {}) {
  const { config } = reviewOptions(reviewer, options);
  if (!['blind', 'reveal'].includes(phase)) throw new Error(`검수 단계 오류: ${phase}`);
  const dir = workDir(root, reviewer, batchId);
  assertPhaseConfig(readJson(path.join(dir, `${phase}.input.json`))?.config, config, `${phase} 입력`);
  if (phase === 'reveal') assertPhaseConfig(readJson(path.join(dir, 'blind.result.json'))?.config, config, 'blind');
  const parsed = parseReply(text, phase, expected);
  writeJson(path.join(dir, `${phase}.result.json`), { at: new Date().toISOString(), config, items: parsed });
  return parsed;
}

/** blind+reveal 병합 결과만 대기시킨다. 추적 파일 반영·커밋은 W2b 잠금 담당이다. */
export async function ingest(b, root, reviewer, batchId, options = {}) {
  const { config, archiveExisting, questionKeys } = reviewOptions(reviewer, options);
  const dir = workDir(root, reviewer, batchId);
  const blind = readJson(path.join(dir, 'blind.result.json'));
  const reveal = readJson(path.join(dir, 'reveal.result.json'));
  if (!blind || !reveal) throw new Error(`${batchId}: blind·reveal 결과가 모두 있어야 한다`);
  assertPhaseConfig(blind.config, config, 'blind');
  assertPhaseConfig(reveal.config, config, 'reveal');
  const prior = pendingReviewFiles(root, batchId);
  const createdAt = new Date(Math.max(Date.now(), prior.lastTime + 1)).toISOString();
  const runId = `${createdAt.replace(/[-:.]/g, '')}-${process.pid}-${randomUUID()}`;
  const run = { id: runId, model: config.model, effort: config.effort };
  const batch = await findBatch(b, root, batchId);
  const drafts = new Map(batch.drafts.map(q => [`${q.id}@${q.revision}`, q]));
  const blindBy = new Map(blind.items.map(i => [`${i.questionId}@${i.revision}:${i.contentHash}`, i]));
  const merged = reveal.items.filter(r => (!questionKeys || questionKeys.has(`${r.questionId}@${r.revision}`)) && blindBy.has(`${r.questionId}@${r.revision}:${r.contentHash}`)).map(r => {
    const bl = blindBy.get(`${r.questionId}@${r.revision}:${r.contentHash}`);
    return { questionId: r.questionId, revision: r.revision, contentHash: r.contentHash, run, blindChoice: bl.blindChoice, verdicts: r.verdicts,
      findings: [...bl.findings.map(f => `[블라인드] ${f}`), ...r.findings.map(f => `[공개 대조] ${f}`)] };
  });
  const writes = new Map();
  const jsonWrite = (file, value) => writes.set(file, `${JSON.stringify(value, null, 2)}\n`);
  // 보관은 원문 바이트를 그대로 복사한다. 기존 보관본과 충돌하면 덮어쓰지 않는다.
  const archive = (source, target) => {
    const bytes = prior.bytes(source), existing = prior.bytes(target);
    if (bytes === null) throw new Error(`보관 원문 없음: ${source}`);
    if (existing !== null && !existing.equals(bytes)) throw new Error(`보관 경로 충돌: ${target}`);
    writes.set(target, bytes);
  };
  const reportPath = `content-source/reviews/${batchId}/${FILE_OF[reviewer]}`;
  const oldReport = prior.json(reportPath);
  const archivedReport = existingReportArchive(batchId, reviewer, oldReport, config, archiveExisting);
  if (archivedReport) archive(reportPath, archivedReport);
  const report = (archivedReport ? null : oldReport) ?? {
    reviewId: `QR-AUTO-${reviewer}-${batchId}`, jobId: batchId,
    reviewer: { model: config.model, tool: '2단계 블라인드 검수(tools/orchestrate/review.mjs)', freshContext: true, date: today() },
    items: [],
  };
  const keep = report.items.filter(i => !merged.some(m => m.questionId === i.questionId && m.revision === i.revision && m.contentHash === i.contentHash));
  report.items = [...keep, ...merged].sort((x, y) => x.questionId.localeCompare(y.questionId) || x.revision - y.revision);
  jsonWrite(reportPath, report);

  if (reviewer === 'claude') {
    const expPath = `content-source/approvals/${batchId}.explanation.json`;
    const old = prior.json(expPath);
    if (old && /claude/i.test(old.reviewer.model) && old.reviewer.model !== config.model && !archiveExisting) {
      throw new Error(`${batchId}: 해설 대조 모델이 다르다. --archive-existing 필요`);
    }
    const commander = old?.reviewer.model === config.model ? old : { batchId, reviewer: { model: config.model, role: 'commander', date: today() }, items: [] };
    if (old && old !== commander) {
      const archived = `content-source/approvals/archive/${batchId}.explanation.${old.reviewer.model.replace(/[^A-Za-z0-9]/g, '-')}.json`;
      archive(expPath, archived);
    }
    const expItems = merged.map(m => {
      const q = drafts.get(`${m.questionId}@${m.revision}`);
      return { questionId: m.questionId, revision: m.revision, contentHash: m.contentHash, rationalesHash: b.rationalesHash(q), run: m.run,
        explanation: m.verdicts.explanation === 'pass' ? 'pass' : 'fail', findings: m.verdicts.explanation === 'pass' ? [] : m.findings.filter(f => f.startsWith('[공개 대조]')) };
    });
    const keepExp = commander.items.filter(i => !expItems.some(e => e.questionId === i.questionId && e.revision === i.revision));
    commander.items = [...keepExp, ...expItems].sort((x, y) => x.questionId.localeCompare(y.questionId) || x.revision - y.revision);
    commander.reviewer.date = today();
    jsonWrite(expPath, commander);
  }
  const fails = merged.filter(m => m.blindChoice !== drafts.get(`${m.questionId}@${m.revision}`)?.correctOptionId || Object.values(m.verdicts).some(v => v !== 'pass'));
  const staging = `.orchestrate/staging/${batchId}/${runId}`;
  const manifest = { batchId, runId, tool: 'review', model: config.model, createdAt, writes: [], deletes: [] };
  for (const [file, bytes] of writes) {
    const destination = path.join(root, staging, 'files', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    manifest.writes.push({ path: file, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  // manifest는 모든 파일을 쓴 뒤 마지막에 만들어 불완전한 실행을 반영하지 않게 한다.
  writeJson(path.join(root, staging, 'manifest.json'), manifest);
  return { merged: merged.length, flagged: fails.length, staging };
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

export function claudeCliArgs(config) {
  const checked = validateConfig('claude', config);
  return ['-p', '--output-format', 'json', '--model', checked.model, '--effort', checked.effort, '--disallowedTools', ...BLOCKED_TOOLS];
}

function claudeAuthError(message) {
  if (!/Failed to authenticate|\bOAuth\b|not logged in/i.test(message)) return null;
  return Object.assign(new Error('Claude 인증 차단: 사용자 로그인 복구 후 관문을 다시 실행해야 한다'), { code: 'CLAUDE_AUTH_BLOCKED' });
}

function claudeCli(cwd, body, timeoutSec, config) {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeCliPath(), claudeCliArgs(config), { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutSec * 1000);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => {
      clearTimeout(timer);
      let text = out.trim();
      try { const j = JSON.parse(text); text = j.is_error ? `실행 실패: ${j.result ?? j.subtype}` : String(j.result ?? ''); } catch { /* 원문 그대로 */ }
      const authError = claudeAuthError(`${text}\n${err}`);
      if (authError) { reject(authError); return; }
      resolve({ code, out: text, err: err.trim() });
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.stdin.end(body);
  });
}

/** Codex 검수도 브리지 시간당 상한을 다른 세션과 나눠 쓰지 않도록 codex exec를 직접 부른다(읽기 전용 sandbox, 기록 없는 세션). */
// ChatGPT 앱 위치가 바뀌어도 찾도록 브리지(agent-bridge resolveCli)와 같은 후보를 차례로 본다.
export function codexCliPath() {
  const inner = app => path.join(app, 'Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
  const apps = ['Desktop/Developer Tools/ChatGPT.app', 'Desktop/ChatGPT.app', 'Applications/ChatGPT.app'].map(a => path.join(os.homedir(), a)).concat(['/Applications/ChatGPT.app', '/Applications/Codex.app']);
  return process.env.CODEX_CLI ?? apps.map(inner).find(p => fs.existsSync(p)) ?? inner(apps[0]);
}
const CODEX_CLI = codexCliPath();
export function codexCliArgs(cwd, outFile, config) {
  const checked = validateConfig('codex', config);
  return ['exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'read-only', '-C', cwd, '-o', outFile, '-m', checked.model, '-c', `model_reasoning_effort="${checked.effort}"`, '-'];
}

function codexCli(cwd, body, timeoutSec, config) {
  return new Promise((resolve, reject) => {
    const outFile = path.join(cwd, `last-${process.pid}-${Date.now()}.md`);
    const child = spawn(CODEX_CLI, codexCliArgs(cwd, outFile, config), { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
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
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.stdin.end(body);
  });
}

export function antigravityRespond(request, deps = {}) {
  return (deps.agyCall ?? measuredAgyCall)({ ...request, model: AGY_MODEL, timeoutSec: 1200 });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 공통 입력 계약: [{batchId, questionId, revision}]. ID가 여러 배치에 있으면 분배하지 않는다. */
export function questionRefs(value) {
  const refs = typeof value === 'string' ? readJson(path.resolve(value)) : value;
  if (!Array.isArray(refs)) throw new Error('questions는 문항 목록 또는 JSON 파일이어야 한다');
  const ids = new Set();
  for (const ref of refs) {
    if (!ref || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(ref.batchId) || typeof ref.questionId !== 'string'
      || !ref.questionId || !Number.isSafeInteger(ref.revision) || ref.revision < 1 || ids.has(ref.questionId)) throw new Error('문항 목록의 배치·ID·revision 오류 또는 중복');
    ids.add(ref.questionId);
  }
  return refs;
}

/** agy 예약 성공 뒤 subprocess 직전에 센다. 예약 거절은 모델 호출이 아니다. */
export async function measuredAgyCall(request, deps = {}) {
  let response;
  try { return await agyCall(request, { ...deps, execute: async (exe, argv, execOptions) => {
    request.onEvent?.({ type: 'call', who: 'argon', ...request.callContext });
    if (deps.execute) return (response = await deps.execute(exe, argv, execOptions));
    return (response = await new Promise((resolve, reject) => {
      const child = (deps.spawn ?? spawn)(exe, argv, { cwd: execOptions.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '', timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, (execOptions.timeoutSec + 10) * 1000);
      child.stdout.on('data', data => { out += data; });
      child.stderr.on('data', data => { err += data; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); if (timedOut) reject(Object.assign(new Error('agy 호출 시간 초과'), { code: 'AGY_TIMEOUT' })); else resolve({ code, out, err: err.trim() }); });
    }));
  } }); } catch (error) {
    // agy가 실행은 마쳤지만 envelope/전문을 못 읽은 경우에도 호출자의 형식 재시도에 넣는다.
    if (response?.code === 0) return { ...response, err: error.message };
    throw error;
  }
}

/** 형식 재시도는 호출자가, 사용량 대기는 여기서 처리한다. 실패 호출도 실측에 포함한다. */
export async function modelAttempt(who, invoke, options = {}, context = {}) {
  for (;;) {
    let result, error;
    if (!options.liveArgon) options.onEvent?.({ type: 'call', who, ...context });
    try { result = await invoke(); } catch (e) { error = e; }
    const message = error?.message ?? (typeof result === 'string' ? result : `${result?.out ?? ''}\n${result?.err ?? ''}`);
    const authError = who === 'claude' && (error?.code === 'CLAUDE_AUTH_BLOCKED' ? error : claudeAuthError(message));
    if (authError) throw authError;
    const hourly = /시간당 실행 상한/.test(message);
    const usage = /session limit|usage limit|rate[_ ]limit|\b429\b|hit your limit/i.test(message) && !/```/.test(message);
    if (!hourly && !usage) { if (error) throw error; return result; }
    const requestedMs = hourly ? 600_000 : 1_200_000;
    const started = Date.now();
    try { await (options.sleep ?? sleep)(requestedMs); }
    finally { options.onEvent?.({ type: 'wait', who, ...context, reason: hourly ? 'hourly-limit' : 'usage-limit', requestedMs, durationMs: Date.now() - started }); }
  }
}

async function reviewChunk(root, reviewer, phase, items, log, options, context, dir) {
  const config = reviewOptions(reviewer, options).config;
  const sealed = path.join(root, '.orchestrate/review/sealed', randomUUID());
  fs.mkdirSync(sealed, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  let note = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const prompt = promptFor(phase, items) + note;
    const callContext = { ...context, phase, attempt };
    const liveArgon = reviewer === 'antigravity' && !options.respond && !options.agyCall;
    const res = await modelAttempt(reviewer === 'antigravity' ? 'argon' : reviewer, () => options.respond
      ? options.respond({ root, reviewer, phase, items, prompt, cwd: sealed, config, attempt })
      : reviewer === 'claude' ? claudeCli(sealed, prompt, 1500, config)
      : reviewer === 'codex' ? codexCli(sealed, prompt, 1800, config)
      : (options.agyCall ?? measuredAgyCall)({ root, cwd: sealed, prompt, model: AGY_MODEL, timeoutSec: 1200,
        onEvent: options.onEvent, callContext, argonPerHour: options.argonPerHour ?? options['argon-per-hour'], validate: text => parseReply(text, phase, items) }),
    { ...options, liveArgon }, callContext);
    fs.writeFileSync(path.join(dir, `${phase}.reply${attempt}.md`), res.out || res.err || '');
    if (/자기 자신에게는|CLI를 찾지 못했다|깨우기 깊이 한도/.test(res.out + res.err)) throw new Error(`${phase}: 실행 수단 오류 — ${(res.out || res.err).slice(0, 200)}`);
    try { return parseReply(res.out ?? '', phase, items); }
    catch (e) { log(`${phase} ${attempt}회차 형식 오류: ${e.message.slice(0, 300)}`); note = `\n지난 답장 형식 오류: ${e.message.slice(0, 600)}\n원래 입력 전체를 형식에 맞게 다시 답한다.`; }
  }
  throw new Error(`${phase}: 4회 모두 형식 오류`);
}

export async function runPhase(b, root, reviewer, batchId, phase, log, options = {}) {
  const { items } = await buildPhase(b, root, reviewer, batchId, phase, options);
  if (!items.length) return 0;
  const parsed = [];
  for (let offset = 0; offset < items.length; offset += 50) parsed.push(...await reviewChunk(root, reviewer, phase, items.slice(offset, offset + 50), log, options,
    { batchIds: [batchId] }, path.join(workDir(root, reviewer, batchId), `chunk${offset / 50}`)));
  writeJson(path.join(workDir(root, reviewer, batchId), `${phase}.result.json`), { at: new Date().toISOString(), config: reviewOptions(reviewer, options).config, items: parsed });
  return items.length;
}

/** 모든 blind 묶음이 끝난 뒤 reveal. 배치별 기존 보고서는 ingest에서 한 번만 병합한다. */
export async function runQuestions(b, root, reviewer, questions, log = console.log, options = {}) {
  const refs = questionRefs(questions), ids = [...new Set(refs.map(q => q.batchId))];
  const owner = new Map(refs.map(q => [q.questionId, q.batchId]));
  const opts = id => ({ ...options, questionKeys: refs.filter(q => q.batchId === id).map(q => `${q.questionId}@${q.revision}`) });
  const active = new Set();
  for (const phase of ['blind', 'reveal']) {
    const inputs = [];
    for (const id of ids) {
      const { items } = await buildPhase(b, root, reviewer, id, phase, opts(id));
      inputs.push(...items); if (items.length) active.add(id);
    }
    const results = [];
    for (let offset = 0; offset < inputs.length; offset += 50) {
      const items = inputs.slice(offset, offset + 50);
      results.push(...await reviewChunk(root, reviewer, phase, items, log, options,
        { batchIds: [...new Set(items.map(q => owner.get(q.questionId)))] }, path.join(root, '.orchestrate/review/pool', randomUUID())));
    }
    for (const id of active) {
      const items = results.filter(q => owner.get(q.questionId) === id);
      writeJson(path.join(workDir(root, reviewer, id), `${phase}.result.json`), { at: new Date().toISOString(), config: reviewOptions(reviewer, options).config, items });
    }
  }
  const results = [];
  for (const id of active) results.push({ batchId: id, ...await ingest(b, root, reviewer, id, opts(id)) });
  return results;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a._[0] === 'run' && a['question-list']) {
    const root = path.resolve(a.root ?? path.resolve(import.meta.dirname, '../..'));
    const reviewer = a.reviewer ?? 'claude';
    console.log(JSON.stringify(await runQuestions(await load(root), root, reviewer, a['question-list'], console.log, { ...a, archiveExisting: a['archive-existing'] === true || a['archive-existing'] === reviewer, config: resolveReviewConfig(a)[reviewer] })));
    return;
  }
  const cmd = a._[0];
  const root = path.resolve(a.root ?? path.resolve(import.meta.dirname, '../..'));
  const reviewer = a.reviewer ?? 'claude';
  if (!FILE_OF[reviewer]) throw new Error(`검수자는 ${Object.keys(FILE_OF).join('·')}`);
  const configs = resolveReviewConfig(a);
  const options = { argonPerHour: a['argon-per-hour'], config: configs[reviewer], questionKeys: a.questions, archiveExisting: a['archive-existing'] === true || a['archive-existing'] === reviewer };
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
    const { items } = await buildPhase(b, root, reviewer, a.batch, a.phase, options);
    process.stdout.write(promptFor(a.phase, items));
    return;
  }
  if (cmd === 'accept') {
    // prompt 때 저장한 입력을 사용해야 accept 옵션 변경으로 봉인이 덮어써지지 않는다.
    const input = readJson(path.join(workDir(root, reviewer, a.batch), `${a.phase}.input.json`));
    if (!input) throw new Error(`${a.batch}: 먼저 prompt로 입력을 생성해야 한다`);
    const n = acceptPhase(root, reviewer, a.batch, a.phase, fs.readFileSync(a.file, 'utf8'), input.items, options).length;
    console.log(`${a.batch} ${a.phase}: ${n}문항 저장`);
    return;
  }
  if (cmd === 'ingest') {
    console.log(JSON.stringify(await ingest(b, root, reviewer, a.batch, options)));
    return;
  }
  if (cmd === 'run') {
    const ids = a.all ? all.filter(x => pending(b, x, reviewer, options).length).map(x => x.batchId) : String(a.batches).split(',');
    const parallel = Number((reviewer === 'antigravity' ? a.argon : undefined) ?? a.parallel ?? 3);
    const queue = [...ids];
    const summary = [];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const batch = await findBatch(b, root, id);
          if (!pending(b, batch, reviewer, options).length) { summary.push({ id, skipped: true }); continue; }
          await runPhase(b, root, reviewer, id, 'blind', log, options);
          await runPhase(b, root, reviewer, id, 'reveal', log, options);
          const r = await ingest(b, root, reviewer, id, options);
          log(`${id} 병합 대기: ${r.merged}문항, 지적 ${r.flagged} (${r.staging})`);
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
