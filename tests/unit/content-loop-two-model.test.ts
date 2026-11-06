import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error MJS 선언 없음
import { runGate, createGateRuntime, acquireGateRun } from '../../tools/orchestrate/content-loop.mjs';

vi.mock('node:child_process', () => ({ spawn: () => { throw new Error('실제 모델 호출 금지'); }, spawnSync: () => { throw new Error('실제 프로세스 호출 금지'); } }));
const finalizeCodex = vi.hoisted(() => vi.fn());
vi.mock('../../tools/orchestrate/finalize-codex.mjs', () => ({ finalizeCodex }));
const roots: string[] = [];
const rootDir = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'two-model-')); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
type Ref = { batchId: string; questionId: string; revision: number; phase?: string };
type Event = { type: string; who: string; batchIds?: string[] };
type Emit = (event: Event) => void;
function fixture(ids = ['A'], failFirst = false) {
  const root = rootDir(), events: string[] = [];
  const items = ids.map(batchId => ({ batchId, id: `${batchId}-q`, revision: 1, level: false, codex: false, final: false, bad: false, frontBad: false }));
  const key = (q: typeof items[number]) => `${q.id}@${q.revision}`;
  const select = (refs: Ref[]) => items.filter(q => refs.some(r => r.batchId === q.batchId && r.questionId === q.id && r.revision === q.revision));
  const deps = {
    ids, log: vi.fn(), apply: vi.fn(async () => ({ runs: [] })),
    snapshot(id: string) { const qs = items.filter(q => q.batchId === id); return {
      drafts: qs, levelPending: qs.filter(q => !q.level).map(key), codexPending: qs.filter(q => !q.codex).map(key), argonPending: [],
      claudePending: qs.map(key), codexFinalPending: qs.filter(q => !q.final).map(key),
      front: { items: qs.map(q => ({ questionId: q.id, revision: q.revision, status: q.level && q.codex ? (q.frontBad ? 'defect' : 'pass') : 'pending' })), batchDefects: [] },
      // legacy의 Claude 미검수 결함도 S4보다 먼저 수정하면 안 된다.
      flagged: qs.filter(q => q.frontBad || !q.final || q.bad).map(q => ({ q, phase: q.frontBad ? 'front' : 'gate' })),
    }; },
    level: vi.fn(async (id: string, _keys: string[], cb: Emit) => { events.push(`S1:${id}`); cb({ type: 'call', who: 'argon' }); cb({ type: 'call', who: 'codex' }); items.filter(q => q.batchId === id).forEach(q => { q.level = true; }); return { assessed: 1 }; }),
    review: vi.fn(async (id: string, who: string, _keys: string[], cb: Emit) => { if (who !== 'codex') throw new Error('Claude 호출 금지'); events.push(`S2:${id}`); cb({ type: 'call', who }); items.filter(q => q.batchId === id).forEach(q => { q.codex = true; }); return { merged: 1 }; }),
    finalizeQuestions: vi.fn(async (refs: Ref[], cb: Emit) => { events.push(`S4:${refs.map(r => r.revision).join(',')}`); cb({ type: 'call', who: 'codex' }); return select(refs).map(q => { q.final = true; q.bad = failFirst && q.revision === 1; return { batchId: q.batchId, merged: 1, flagged: Number(q.bad), reused: 0, staging: 'fixture' }; }); }),
    reviseQuestions: vi.fn(async (refs: Ref[], cb: Emit) => { events.push('S5'); cb({ type: 'call', who: 'argon' }); return select(refs).map(q => { q.revision++; q.level = false; q.codex = false; q.final = false; q.bad = false; q.frontBad = false; return { batchId: q.batchId, revised: 1 }; }); }),
    levelQuestions: vi.fn(async (refs: Ref[], cb: Emit) => { events.push('pooled-S1'); cb({ type: 'call', who: 'codex' }); cb({ type: 'call', who: 'argon' }); return select(refs).map(q => { q.level = true; return { batchId: q.batchId, assessed: 1 }; }); }),
    reviewQuestions: vi.fn(async (refs: Ref[], who: string, cb: Emit) => { if (who !== 'codex') throw new Error('Claude 호출 금지'); events.push('pooled-S2'); cb({ type: 'call', who }); return select(refs).map(q => { q.codex = true; return { batchId: q.batchId, merged: 1 }; }); }),
  };
  return { root, items, deps, events, options: { root, batches: ids.join(','), 'stage-only': true } };
}

it.each([{}, { 'without-claude': true }])('기본 및 명시 두 모델 경로는 Codex 최종 대조만 호출한다 (%j)', async flags => {
  const f = fixture(); const result = await runGate({ ...f.options, ...flags }, f.deps);
  expect(result.A.error).toBeUndefined();
  expect(f.events).toEqual(['S1:A', 'S2:A', 'S4:1']);
  expect(f.deps.finalizeQuestions.mock.calls[0]![0]).toEqual([{ batchId: 'A', questionId: 'A-q', revision: 1 }]);
  expect(f.deps.reviseQuestions).not.toHaveBeenCalled();
  expect(result.A.modelCalls).toEqual({ claude: 0, codex: 3, argon: 1, bridge: 0 });
  expect(f.deps.apply).not.toHaveBeenCalled();
});

it('S5 뒤 여러 배치의 현재 판을 S1→S2→Codex 최종 대조로 모아 재검수한다', async () => {
  const f = fixture(['A', 'B'], true); const result = await runGate({ ...f.options, codex: 1 }, f.deps);
  expect(f.events.slice(-4)).toEqual(['S5', 'pooled-S1', 'pooled-S2', 'S4:2,2']);
  expect(f.deps.reviseQuestions.mock.calls[0]![0]).toEqual(['A', 'B'].map(batchId => ({ batchId, questionId: `${batchId}-q`, revision: 1, phase: 'gate' })));
  expect(f.deps.finalizeQuestions.mock.calls.map(([refs]) => refs.map(r => r.revision))).toEqual([[1], [1], [2, 2]]);
  for (const id of ['A', 'B']) { expect(result[id].error).toBeUndefined(); expect(result[id].modelCalls.claude).toBe(0); }
  expect(f.deps.reviewQuestions.mock.calls.map(c => c[1])).toEqual(['codex']);
});

it('S3 중단과 재개는 awaitingFinalReview로 보고한다', async () => {
  const f = fixture(); const result = await runGate({ ...f.options, until: 'S3' }, f.deps);
  expect(result.A.awaitingFinalReview).toBe(1); expect(result.A.awaitingClaude).toBeUndefined();
  expect(f.deps.finalizeQuestions).not.toHaveBeenCalled(); expect(f.deps.reviseQuestions).not.toHaveBeenCalled();
  const resumed = await runGate(f.options, f.deps);
  expect(resumed.A.error).toBeUndefined(); expect(f.deps.finalizeQuestions).toHaveBeenCalledTimes(1);
  expect(f.deps.level).toHaveBeenCalledTimes(1); expect(f.deps.review).toHaveBeenCalledTimes(1);
});

it.each([false, true])('plan은 S4의 Codex 모델 선택을 노출하고 실행하지 않는다 (frontOnly=%s)', async frontOnly => {
  const f = fixture(); f.items.forEach(q => { q.level = true; q.codex = true; });
  const result = await runGate({ ...f.options, plan: true, ...(frontOnly ? { until: 'S3' } : {}) }, f.deps);
  expect(result.A.next).toEqual({ stage: frontOnly ? 'S4 대기' : 'S4', target: 1, who: 'codex' });
  expect(f.events).toEqual([]); expect(f.deps.apply).not.toHaveBeenCalled();
});

it('Claude 포함/제외 옵션 충돌은 상태 조회 전 거절한다', async () => {
  const f = fixture(), snapshot = vi.spyOn(f.deps, 'snapshot');
  await expect(runGate({ ...f.options, 'with-claude': true, 'without-claude': true }, f.deps)).rejects.toThrow('--with-claude');
  expect(snapshot).not.toHaveBeenCalled(); expect(f.events).toEqual([]);
});

it('gate 잠금 export는 중복 소유를 거절하고 해제 후 재획득한다', () => {
  const root = rootDir(), release = acquireGateRun(root, 'A');
  expect(() => acquireGateRun(root, 'A')).toThrow('gate 실행 중');
  release(); const next = acquireGateRun(root, 'A'); next();
  expect(fs.existsSync(path.join(root, '.orchestrate/gate-locks/A.json'))).toBe(false);
});

it.each(['pass', 'fail', 'default-config', 'xhigh', 'no-policy', 'no-explanation', 'reviewer', 'model', 'effort', 'revision', 'content', 'rationales'])('현재 Codex 해설 증거 %s의 재대조 대상을 판별한다', async mismatch => {
  const root = rootDir(), q = { id: 'q', revision: 2 };
  const item = { questionId: 'q', revision: 2, contentHash: 'content', rationalesHash: 'rationales', explanation: mismatch === 'fail' ? 'fail' : 'pass', findings: ['정답 해설의 뜻이 다름'], run: { model: 'gpt-6-astra', effort: 'high' } };
  const explanation = { reviewer: { model: 'gpt-6-astra' }, items: [item] };
  if (mismatch === 'reviewer') explanation.reviewer.model = 'claude';
  if (mismatch === 'model') item.run.model = 'gpt-6.1-sol';
  if (mismatch === 'effort') item.run.effort = 'low';
  if (mismatch === 'xhigh') item.run.effort = 'xhigh';
  if (mismatch === 'revision') item.revision = 1;
  if (mismatch === 'content') item.contentHash = 'old';
  if (mismatch === 'rationales') item.rationalesHash = 'old';
  const batch = { batchId: 'A', drafts: [q], sidecar: { publicationPolicy: mismatch === 'no-policy' ? undefined : 'codex-argon-v1' }, reviews: { codex: { reviewer: { model: 'gpt-6-astra' }, items: [{ questionId: 'q', revision: 2, contentHash: 'content' }] } }, explanation: mismatch === 'no-explanation' ? null : explanation };
  const rb = { loadBatches: () => [batch], contentHash: () => 'content', rationalesHash: () => 'rationales', decide: () => [{ questionId: 'q', revision: 2, reasons: mismatch === 'fail' ? ['Codex 해설 대조 fail'] : [] }] };
  const front = { currentDrafts: (qs: unknown[]) => qs, frontGate: () => ({ items: [{ questionId: 'q', revision: 2, status: 'pass', defects: [], pending: [] }], batchDefects: [] }) };
  const runtime = await createGateRuntime({ root, batches: 'A', ...(mismatch === 'default-config' ? {} : { 'codex-model': 'gpt-6-astra', 'codex-effort': 'high' }) }, { rb, rm: { b: rb, front }, lm: { levels: { isCurrentLevelAssessment: () => true } } });
  expect(runtime.snapshot('A').codexFinalPending).toEqual(['pass', 'fail', 'default-config', 'xhigh'].includes(mismatch) ? [] : ['q@2']);
  if (mismatch === 'fail') expect(runtime.snapshot('A').flagged).toEqual([expect.objectContaining({ phase: 'gate', q, reasons: ['총괄 해설 대조 fail: Codex 해설 대조 fail / 정답 해설의 뜻이 다름'] })]);
  expect(runtime.batch('A')).toBe(batch);
});


it('앞단 결함은 S3 수정 뒤 새 판의 수준·독립 풀이를 거쳐 최종 대조한다', async () => {
  const f = fixture(); f.items[0]!.frontBad = true;
  const result = await runGate(f.options, f.deps);
  expect(result.A.error).toBeUndefined();
  expect(f.deps.reviseQuestions.mock.calls[0]![0]).toEqual([{ batchId: 'A', questionId: 'A-q', revision: 1, phase: 'front' }]);
  expect(f.deps.finalizeQuestions.mock.calls.map(([refs]) => refs.map(r => r.revision))).toEqual([[2]]);
  expect(f.events.slice(-3)).toEqual(['pooled-S1', 'pooled-S2', 'S4:2']);
});

it('여러 배치의 최종 대조도 Codex pool의 동시 수 제한을 지킨다', async () => {
  const f = fixture(['A', 'B', 'C']); let active = 0, maximum = 0;
  const finalize = f.deps.finalizeQuestions.getMockImplementation()!;
  f.deps.finalizeQuestions.mockImplementation(async (refs, cb) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    try { return await finalize(refs, cb); } finally { active--; }
  });
  const result = await runGate({ ...f.options, codex: 1, claude: 3 }, f.deps);
  expect(maximum).toBe(1); expect(f.deps.finalizeQuestions).toHaveBeenCalledTimes(3);
  for (const id of ['A', 'B', 'C']) { expect(result[id].error).toBeUndefined(); expect(result[id].modelCalls.claude).toBe(0); }
});


it('runtime은 최종 대조 모듈에 현재 runtime과 staging overlay 은행을 그대로 넘긴다', async () => {
  const batch = { batchId: 'A', drafts: [], sidecar: { items: [] }, reviews: {}, argonBlind: null, explanation: null };
  const root = rootDir(), rb = { loadBatches: () => [batch] };
  const runtime = await createGateRuntime({ root, batches: 'A', 'stage-only': true }, { rb, rm: { b: rb }, lm: {} });
  const questions = [{ batchId: 'A', questionId: 'q', revision: 2 }], onEvent = vi.fn();
  const result = [{ batchId: 'A', merged: 1, flagged: 0, reused: 1, staging: 'fixture' }];
  finalizeCodex.mockResolvedValueOnce(result);
  expect(await runtime.finalizeQuestions(questions, onEvent)).toBe(result);
  expect(finalizeCodex).toHaveBeenCalledTimes(1);
  const [options, deps] = finalizeCodex.mock.calls[0]!;
  expect(options).toEqual({ root, batches: 'A', 'stage-only': true, 'codex-model': 'gpt-6-astra', 'codex-effort': 'high', questions, onEvent });
  expect(deps.runtime).toBe(runtime);
  expect(deps.bank).not.toBe(rb);
  expect(deps.bank.loadBatches()).toEqual([{ ...batch, reviews: { codex: null, claude: null } }]);
});
