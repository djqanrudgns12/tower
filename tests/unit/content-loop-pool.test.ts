import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as d from '../../src/contracts/questionDraft';
import * as levels from '../../tools/content/levels';
import * as contracts from '../../src/contracts/levels';
import * as lint from '../../src/content/lint';
import * as bank from '../../tools/content/bankBuild';
// @ts-expect-error MJS 선언 없음
import { runLevels } from '../../tools/orchestrate/level.mjs';
// @ts-expect-error MJS 선언 없음
import { reviseQuestions, readReviseLog } from '../../tools/orchestrate/revise.mjs';
// @ts-expect-error MJS 선언 없음
import { runGate } from '../../tools/orchestrate/content-loop.mjs';
// @ts-expect-error MJS 선언 없음
import { runQuestions, resolveReviewConfig, measuredAgyCall, modelAttempt } from '../../tools/orchestrate/review.mjs';

vi.mock('node:child_process', () => ({ spawn: () => { throw new Error('실제 호출 금지'); } }));
const roots: string[] = [];
function rootDir() { fs.mkdirSync('.orchestrate', { recursive: true }); const root = fs.mkdtempSync(path.resolve('.orchestrate/pool-test-')); roots.push(root); return root; }
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
type Ref = { batchId: string; questionId: string; revision: number; phase?: string };
type Q = Ref & { id: string; level: boolean; codex: boolean; claude: boolean; bad: boolean; rounds: number };
type Event = { type: string; who: string; batchIds?: string[]; durationMs?: number };
function fixture(count = 21) {
  const root = rootDir(), events: string[] = [], staged = new Map<string, (() => void)[]>();
  let items: Q[] = ['A', 'B', 'C'].flatMap(batchId => Array.from({ length: count }, (_, i) => ({ batchId, questionId: `${batchId}-${i}`, id: `${batchId}-${i}`, revision: 1, level: false, codex: false, claude: false, bad: i < count - 1, rounds: 0 })));
  const key = (q: Ref) => `${q.questionId}@${q.revision}`;
  const select = (refs: Ref[]) => items.filter(q => refs.some(r => r.batchId === q.batchId && key(r) === key(q)));
  const stage = (qs: Q[], action: (q: Q) => void) => { for (const q of qs) staged.set(q.batchId, [...(staged.get(q.batchId) ?? []), () => action(q)]); };
  const emit = (cb: (e: Event) => void, who: string, qs: Q[]) => cb({ type: 'call', who, batchIds: [...new Set(qs.map(q => q.batchId))] });
  const deps = {
    ids: ['A', 'B', 'C'], log: vi.fn(),
    snapshot: (id: string) => { const qs = items.filter(q => q.batchId === id); return { drafts: qs, levelPending: qs.filter(q => !q.level).map(key), codexPending: qs.filter(q => !q.codex).map(key), argonPending: [], claudePending: qs.filter(q => !q.claude).map(key), front: { items: qs.map(q => ({ ...q, status: !q.level || !q.codex ? 'pending' : q.bad ? 'defect' : 'pass' })), batchDefects: [] }, flagged: qs.filter(q => q.bad).map(q => ({ q, phase: 'front' })) }; },
    apply: vi.fn(async (id: string) => { const jobs = staged.get(id) ?? []; jobs.forEach(fn => fn()); staged.delete(id); events.push(`apply:${id}`); return { runs: jobs.length ? ['run'] : [] }; }),
    level: vi.fn(async (id: string, _keys: string[], cb: (e: Event) => void) => { const qs = items.filter(q => q.batchId === id); emit(cb, 'argon', qs); emit(cb, 'codex', qs); stage(qs, q => { q.level = true; }); events.push(`first-level:${id}`); return { assessed: qs.length }; }),
    review: vi.fn(async (id: string, who: string, keys: string[], cb: (e: Event) => void) => { const qs = items.filter(q => q.batchId === id && keys.includes(key(q))); emit(cb, who, qs); stage(qs, q => { if (who === 'codex') q.codex = true; else q.claude = true; }); events.push(`first-${who}:${id}`); return { merged: qs.length }; }),
    reviseQuestions: vi.fn(async (refs: Ref[], cb: (e: Event) => void) => { const qs = select(refs); events.push('pooled-revise'); emit(cb, 'argon', qs); const dropped = qs.filter(q => q.rounds === 2); stage(qs, q => { if (dropped.includes(q)) items = items.filter(i => i !== q); else { q.rounds++; q.revision++; q.level = false; q.codex = false; q.claude = false; } }); return refs.map(r => ({ batchId: r.batchId, revised: 0, dropped: dropped.filter(q => q.id === r.questionId).length })); }),
    levelQuestions: vi.fn(async (refs: Ref[], cb: (e: Event) => void) => { const qs = select(refs); emit(cb, 'argon', qs); emit(cb, 'codex', qs); stage(qs, q => { q.level = true; }); return [...new Set(refs.map(r => r.batchId))].map(batchId => ({ batchId, assessed: qs.filter(q => q.batchId === batchId).length })); }),
    reviewQuestions: vi.fn(async (refs: Ref[], who: string, cb: (e: Event) => void) => { const qs = select(refs); emit(cb, who, qs); stage(qs, q => { if (who === 'codex') q.codex = true; else q.claude = true; }); return [...new Set(refs.map(r => r.batchId))].map(batchId => ({ batchId, merged: qs.filter(q => q.batchId === batchId).length })); }),
  };
  return { root, deps, events, options: { root, batches: 'A,B,C' } };
}

describe('배치를 넘는 재판정 회차', () => {
  it.each([false, true, 'wrapped'] as const)('반영 차단 뒤 대기 중인 호출과 내부 후속 호출을 시작하지 않는다 (후속=%s)', async followup => {
    const f = fixture(1);
    const originalApply = f.deps.apply.getMockImplementation()!;
    const originalLevel = f.deps.level.getMockImplementation()!;
    let release!: () => void;
    const inflight = new Promise<void>(resolve => { release = resolve; });
    f.deps.level.mockImplementation(async (id, keys, cb) => {
      if (id !== 'B') return originalLevel(id, keys, cb);
      cb({ type: 'call', who: 'argon', batchIds: [id] });
      await inflight;
      if (followup) {
        try { cb({ type: 'call', who: 'codex', batchIds: [id] }); }
        catch (error) {
          if (followup === 'wrapped') throw new Error('4회 모두 형식 오류', { cause: error });
          throw error;
        }
      }
      return { assessed: 1 };
    });
    f.deps.apply.mockImplementation(async id => {
      const result = await originalApply(id);
      if (id === 'A' && result.runs.length) throw Object.assign(new Error('자원 대기'), { code: 'RESOURCE_WAIT' });
      return result;
    });
    f.deps.log.mockImplementation((message: string) => { if (message.startsWith('A 차단:')) release(); });
    const summary = await runGate({ ...f.options, until: 'S3', codex: 1, argon: 1 }, f.deps);
    expect(f.deps.level.mock.calls.map(([id]) => id)).toEqual(['A', 'B']);
    expect(summary.B.modelCalls).toMatchObject({ argon: 1, codex: 0 });
    expect(summary.C.modelCalls).toMatchObject({ argon: 0, codex: 0 });
    for (const id of ['A', 'B', 'C']) expect(summary[id]).toMatchObject({ blocked: true, blockedReason: 'resource' });
  });
  it('--until S3은 여러 배치의 수정·재검수와 재시작에서도 Claude를 부르지 않는다', async () => {
    const f = fixture(2);
    const summary = await runGate({ ...f.options, until: 'S3' }, f.deps);
    expect(f.deps.reviseQuestions.mock.calls.map(([refs]) => refs.length)).toEqual([3, 3, 3]);
    expect(f.deps.review.mock.calls.map(c => c[1])).toEqual(['codex', 'codex', 'codex']);
    expect(f.deps.reviewQuestions.mock.calls.map(c => c[1])).toEqual(['codex', 'codex']);
    for (const id of ['A', 'B', 'C']) expect(summary[id].awaitingClaude).toBe(1);
    await runGate({ ...f.options, until: 'S3' }, f.deps);
    expect(f.deps.reviewQuestions.mock.calls.map(c => c[1])).toEqual(['codex', 'codex']);
  });
  it('3배치 첫 판 뒤 전역 목록을 넘기고 두 번 수정 뒤 버린다', async () => {
    const f = fixture(); const summary = await runGate(f.options, f.deps);
    expect(f.events.indexOf('pooled-revise')).toBeGreaterThan(f.events.indexOf('first-claude:C'));
    expect(f.deps.reviseQuestions.mock.calls.map(([refs]) => refs.length)).toEqual([60, 60, 60]);
    expect(f.deps.levelQuestions.mock.calls.map(([refs]) => refs.length)).toEqual([60, 60]);
    expect(new Set(f.deps.levelQuestions.mock.calls[0]![0].map(r => r.batchId)).size).toBe(3);
    expect(f.deps.reviewQuestions.mock.calls.map(([refs, who]) => [who, refs.length])).toEqual([['codex', 60], ['codex', 60]]);
    for (const id of ['A', 'B', 'C']) {
      expect(summary[id].error).toBeUndefined();
      expect(summary[id].stages.filter((s: { round: number; dropped: number }) => s.round === 3).reduce((n: number, s: { dropped: number }) => n + s.dropped, 0)).toBe(20);
      expect(summary[id].modelCallsBasis).toBe('measured');
    }
  });
  it('--pool-after 이후 첫 묶음만 먼저 재판정한다', async () => {
    const f = fixture(2); await runGate({ ...f.options, 'pool-after': 2 }, f.deps);
    expect(f.events.indexOf('pooled-revise')).toBeLessThan(f.events.indexOf('first-level:C'));
    expect(new Set(f.deps.reviseQuestions.mock.calls[0]![0].map(r => r.batchId))).toEqual(new Set(['A', 'B']));
  });
});

it('실제 review 입력을 50개씩 섞어 배치별 staging으로 분배하고 재시도·대기를 센다', async () => {
  const root = rootDir();
  const batches = ['A', 'B', 'C'].map(batchId => ({ batchId, reviews: {}, drafts: Array.from({ length: 21 }, (_, i) => ({ batchId, id: `${batchId}-${i}`, revision: 2, grade: 4, type: 'definition', target: { lemma: '낱말', partOfSpeech: '명사' }, stem: '문제', options: [{ id: 'a', text: '답' }], correctOptionId: 'a', explanation: '비밀해설', source: { evidenceArtifactId: 'none' }, gradeBasis: {}, distractorRationales: {} })) }));
  const refs = batches.flatMap(b => b.drafts.map(q => ({ batchId: b.batchId, questionId: q.id, revision: q.revision })));
  const events: Event[] = []; let call = 0;
  const respond = vi.fn(async (r: { phase: string; prompt: string; items: Ref[] }) => {
    call++;
    if (call === 1) return { out: 'usage limit', err: '' };
    if (call === 2) return { out: '잘못된 JSON', err: '' };
    return { out: JSON.stringify({ items: r.items.map(q => ({ questionId: q.questionId, revision: q.revision, blindChoice: 'a', verdicts: { uniqueness: 'pass', grade: 'pass', language: 'pass', source: 'pass', explanation: 'pass' }, findings: [] })) }), err: '' };
  });
  const result = await runQuestions({ loadBatches: () => batches, contentHash: () => 'secret-hash', rationalesHash: () => 'rh' }, root, 'codex', refs, () => {}, { config: resolveReviewConfig({}, {}).codex, respond, sleep: async () => {}, onEvent: (e: Event) => events.push(e) });
  expect(respond.mock.calls.map(([r]) => r.items.length)).toEqual([50, 50, 50, 13, 50, 13]);
  expect(events.filter(e => e.type === 'call')).toHaveLength(6);
  expect(events.filter(e => e.type === 'wait')).toHaveLength(1);
  for (const [r] of respond.mock.calls) { expect(r.prompt).not.toContain('secret-hash'); if (r.phase === 'blind') { expect(r.prompt).not.toContain('비밀해설'); expect(r.prompt).not.toContain('correctOptionId'); } }
  for (const row of result) {
    const report = JSON.parse(fs.readFileSync(path.join(root, row.staging, 'files', `content-source/reviews/${row.batchId}/codex.json`), 'utf8'));
    expect(report.items).toHaveLength(21);
    expect(report.items.every((q: Ref) => q.questionId.startsWith(`${row.batchId}-`))).toBe(true);
    expect(fs.existsSync(path.join(root, `content-source/reviews/${row.batchId}/codex.json`))).toBe(false);
  }
});

function write(root: string, file: string, value: unknown) { const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, JSON.stringify(value)); }
function draft(batchId: string, i: number): d.QuestionDraft {
  return { schemaVersion: '0.2', batchId, id: `g4-pool-${batchId.toLowerCase()}-${String(i).padStart(4, '0')}`, revision: 1, status: 'draft', grade: 4, type: 'cloze', variantTag: 'standard',
    gradeBasis: { reference: '출처', editionYear: 2022, unit: 'stdict:전문어 표지 없음', reviewed: false },
    target: { lemma: '약속', partOfSpeech: '명사', senseKey: '약속/명사/1' }, stem: '친구와 한 (    )을 지켜요.',
    options: [{ id: 'a', text: '약속' }, { id: 'b', text: '연필' }, { id: 'c', text: '신발' }, { id: 'd', text: '하늘' }], correctOptionId: 'a', explanation: '하기로 정한 일을 지켜요.',
    distractorRationales: { b: '쓰는 도구예요.', c: '발에 신어요.', d: '위를 보면 있어요.' },
    source: { provider: 'stdict', entryId: '1', senseId: '1', senseOrder: 1, url: 'https://stdict.korean.go.kr/', retrievedAt: '2026-11-05T00:00:00Z', license: '출처 표시', evidenceHash: 'a'.repeat(64), evidenceArtifactId: 'word.txt' }, review: { reviewerId: null, reviewedAt: null } };
}

it('혼합 수준 판정은 50개씩, 형식 재시도까지 계측하고 기존 초안을 보존한다', async () => {
  const root = rootDir(), qs = ['A', 'B', 'C'].flatMap(id => Array.from({ length: 21 }, (_, i) => draft(id, i)));
  for (const id of ['A', 'B', 'C']) write(root, `content-source/batches/${id}/drafts.json`, qs.filter(q => q.batchId === id));
  const events: Event[] = [];
  type Request = { judge: string; chunk: number; attempt: number; items: Ref[]; prompt: string };
  const respond = vi.fn(async (r: Request) => r.judge === 'argon' && r.chunk === 0 && r.attempt === 1 ? '{' : JSON.stringify({ items: r.items.map(q => ({ questionId: q.questionId, revision: q.revision, L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null, elementaryFit: 'pass', basisType: 'stdict_structural', unit: 'stdict:전문어 표지 없음', reason: '생활 낱말' })) }));
  const results = await runLevels({ root, questions: qs.map(q => ({ batchId: q.batchId, questionId: q.id, revision: q.revision })), onEvent: (e: Event) => events.push(e) }, { modules: { d, levels, contracts, lint }, respond });
  expect(respond.mock.calls.filter(([r]) => r.judge === 'argon').map(([r]) => r.items.length)).toEqual([50, 50, 13]);
  expect(respond.mock.calls.filter(([r]) => r.judge === 'codex').map(([r]) => r.items.length)).toEqual([50, 13]);
  expect(events.filter(e => e.type === 'call' && e.who === 'argon')).toHaveLength(3);
  expect(events.filter(e => e.type === 'call' && e.who === 'codex')).toHaveLength(2);
  for (const row of results) {
    expect(row.assessed).toBe(21);
    const next = JSON.parse(fs.readFileSync(path.join(root, row.staging, 'files', `content-source/levels/${row.batchId}.json`), 'utf8'));
    expect(next.items.map((q: Ref) => q.questionId)).toEqual(qs.filter(q => q.batchId === row.batchId).map(q => q.id).sort((a, b) => a.localeCompare(b)));
    expect(JSON.parse(fs.readFileSync(path.join(root, `content-source/batches/${row.batchId}/drafts.json`), 'utf8'))).toEqual(qs.filter(q => q.batchId === row.batchId));
  }
});

it('수정기에서 3배치를 12개씩 섞고 한도 초과는 호출 없이 배치 원장에 버림을 남긴다', async () => {
  const root = rootDir();
  const batches = ['A', 'B', 'C'].map(batchId => {
    const drafts = Array.from({ length: 11 }, (_, i) => draft(batchId, i));
    const sidecar = { batchId, jobId: batchId, producer: { model: 'fixture', tool: 'fixture', date: '2026-11-06' }, items: drafts.map(q => ({ id: q.id, revision: q.revision, uniquenessNote: '하나', gradeEvidence: '생활', selfRefutation: q.options.map(o => ({ optionId: o.id, substituted: o.text, verdict: o.id === 'a' ? 'fits' : 'does_not_fit', reason: '대입' })) })), rejected: [] };
    write(root, `content-source/batches/${batchId}/drafts.json`, drafts); write(root, `content-source/batches/${batchId}/sidecar.json`, sidecar);
    write(root, `content-source/batches/${batchId}/revise-log.json`, { batchId, items: { [draft(batchId, 0).id]: { front: 2, gate: 0, dropped: false, history: [] } } });
    return { batchId, drafts, sidecar, reviews: {}, argonBlind: null, explanation: null };
  });
  const m = { d, lint, b: { ...bank, loadBatches: () => batches, decide: (batch: typeof batches[number]) => batch.drafts.map(q => ({ questionId: q.id, revision: q.revision, reasons: [] })) }, front: { frontGate: (batch: typeof batches[number]) => ({ items: batch.drafts.map(q => ({ questionId: q.id, revision: q.revision, defects: ['문장 결함'], pending: [], status: 'defect' })), batchDefects: [] }) } };
  const refs = batches.flatMap(b => b.drafts.map(q => ({ batchId: b.batchId, questionId: q.id, revision: q.revision, phase: 'front' })));
  const events: Event[] = [];
  const respond = vi.fn(async (r: { items: Array<{ q: d.QuestionDraft }>; prompt: string }) => ({ out: JSON.stringify({ items: r.items.map(x => ({ questionId: x.q.id, action: 'drop', reason: '고칠 수 없음' })) }), err: '' }));
  const results = await reviseQuestions(m, root, refs, 'antigravity', () => {}, { respond, onEvent: (e: Event) => events.push(e) });
  expect(respond.mock.calls.map(([r]) => r.items.length)).toEqual([12, 12, 6]);
  expect(new Set(respond.mock.calls[0]![0].items.map(x => x.q.batchId))).toEqual(new Set(['A', 'B']));
  expect(respond.mock.calls.flatMap(([r]) => r.items.map(x => x.q.id)).some(id => id.endsWith('-0000'))).toBe(false);
  expect(events.filter(e => e.type === 'call')).toHaveLength(3);
  for (const row of results) {
    expect(row).toMatchObject({ dropped: 11, revised: 0, rejected: 0, closed: true });
    const log = readReviseLog(root, row.batchId);
    expect(Object.keys(log.items)).toHaveLength(11);
    expect(log.items[draft(row.batchId, 0).id]).toMatchObject({ front: 2, dropped: true });
    expect(fs.existsSync(path.join(root, `content-source/batches/${row.batchId}/closed.json`))).toBe(false);
  }
});

it('Argon 원장 예약 거절은 호출 0회이며 실제 실행 직전의 실패도 1회로 센다', async () => {
  const root = rootDir(), cwd = path.join(root, '.orchestrate/sealed'); fs.mkdirSync(cwd, { recursive: true });
  const events: Event[] = [], execute = vi.fn(async () => ({ code: 1, out: '', err: '실행 실패' }));
  const request = { root, cwd, prompt: 'fixture', argonPerHour: 1, onEvent: (e: Event) => events.push(e), callContext: { batchIds: ['A'] } };
  await expect(measuredAgyCall(request, { execute })).rejects.toThrow('실행 실패');
  await expect(measuredAgyCall(request, { execute })).rejects.toThrow('시간당 실행 상한');
  expect(execute).toHaveBeenCalledTimes(1); expect(events.filter(e => e.type === 'call')).toHaveLength(1);
});

it('사용량 대기 후 재호출과 실제 대기 시간을 함께 기록한다', async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(0); const events: Event[] = [];
    const invoke = vi.fn().mockRejectedValueOnce(new Error('usage limit')).mockResolvedValue('완료');
    await expect(modelAttempt('codex', invoke, { onEvent: (e: Event) => events.push(e), sleep: async (ms: number) => { vi.setSystemTime(Date.now() + ms); } }, { batchIds: ['A', 'B'] })).resolves.toBe('완료');
    expect(events.map(e => e.type)).toEqual(['call', 'wait', 'call']);
    expect(events[1]).toMatchObject({ who: 'codex', durationMs: 1_200_000, requestedMs: 1_200_000, batchIds: ['A', 'B'] });
  } finally { vi.useRealTimers(); }
});

it('첫 판 완료 후 중단된 재판정은 재시작 때도 혼합 목록으로 이어 간다', async () => {
  const f = fixture(2);
  const original = f.deps.levelQuestions.getMockImplementation()!;
  f.deps.levelQuestions.mockRejectedValue(new Error('일시 중단'));
  const first = await runGate(f.options, f.deps);
  expect(first.A.error).toBe('일시 중단');
  expect(first.A.firstPassComplete).toBe(true);
  f.deps.levelQuestions.mockImplementation(original);
  f.deps.level.mockClear(); f.deps.review.mockClear(); f.deps.levelQuestions.mockClear();
  const second = await runGate(f.options, f.deps);
  expect(f.deps.level).not.toHaveBeenCalled(); expect(f.deps.review).not.toHaveBeenCalled();
  expect(f.deps.levelQuestions.mock.calls[0]![0].map(q => q.revision)).toEqual([2, 2, 2]);
  expect(second.A.error).toBeUndefined();
  expect(fs.readdirSync(path.join(f.root, '.orchestrate/content-loop-history'))).toHaveLength(1);
});

it('공유 호출은 한 배치에만 귀속하고 모든 참여 배치에 같은 호출 ID를 남긴다', async () => {
  const f = fixture(2); const summary = await runGate(f.options, f.deps);
  const records = ['A', 'B', 'C'].map(id => summary[id].stages.find((s: { stage: string; round: number }) => s.stage === 'S1' && s.round === 1));
  expect(records.map(r => r.modelCalls.codex)).toEqual([1, 0, 0]);
  expect(records.map(r => r.sharedModelCalls.codex)).toEqual([1, 1, 1]);
  expect(new Set(records.flatMap(r => r.events.filter((e: Event) => e.who === 'codex').map((e: { callId: string }) => e.callId))).size).toBe(1);
});

it('Argon envelope 형식 오류도 호출 결과로 남겨 상위 형식 재시도가 처리한다', async () => {
  const root = rootDir(), cwd = path.join(root, '.orchestrate/sealed'); fs.mkdirSync(cwd, { recursive: true });
  const events: Event[] = [];
  const result = await measuredAgyCall({ root, cwd, prompt: 'fixture', onEvent: (e: Event) => events.push(e) }, { execute: async () => ({ code: 0, out: '{', err: '' }) });
  expect(result.out).toBe('{'); expect(result.err.length).toBeGreaterThan(0);
  expect(events.filter(e => e.type === 'call')).toHaveLength(1);
});
