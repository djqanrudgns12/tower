import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { contentHashInput, rationalesHashInput } from '../../src/contracts/questionDraft';
// @ts-expect-error MJS 선언 없음
import { runPreReview, parsePreReviewArgs } from '../../tools/orchestrate/pre-review.mjs';
// @ts-expect-error MJS 선언 없음
import { acquireGateRun } from '../../tools/orchestrate/content-loop.mjs';

vi.mock('node:child_process', () => ({ spawn: () => { throw new Error('실제 모델 금지'); }, spawnSync: () => { throw new Error('실제 프로세스 금지'); } }));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
type Ref = { batchId: string; questionId: string; revision: number };
type Event = { type: string; who: string; phase: string; attempt: number; batchIds: string[] };
type Emit = (event: Event) => void;
function fixture(sizes = [5, 7], grades = [3, 3]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-review-')); roots.push(root);
  const ids = sizes.map((_, i) => `Q50-G${grades[i]}-${String(i + 1).padStart(3, '0')}`);
  const drafts = sizes.flatMap((size, i) => Array.from({ length: size }, (_, n) => ({
    id: `q-${i}-${n}`, batchId: ids[i]!, revision: 1, grade: grades[i]!, type: 'definition' as const,
    target: { lemma: '낱말', partOfSpeech: '명사', senseKey: `${i}-${n}` }, stem: '뜻을 고르세요.',
    options: [{ id: 'a' as const, text: '첫째' }, { id: 'b' as const, text: '둘째' }, { id: 'c' as const, text: '셋째' }, { id: 'd' as const, text: '넷째' }],
    correctOptionId: 'a' as const, explanation: '첫째 뜻이다.', distractorRationales: { 'b': '다른 뜻', 'c': '다른 뜻', 'd': '다른 뜻' },
    difficultyTier: 'basic', gradeBasis: { method: 'rubric_inferred' }, source: { entryId: `${i}-${n}` },
  })));
  const progress = new Map(drafts.map(q => [q.id, { level: false, codex: false, final: false, bad: false }]));
  const key = (q: { id: string; revision: number }) => `${q.id}@${q.revision}`;
  const sidecars = new Map(ids.map(id => [id, { batchId: id, items: drafts.filter(q => q.batchId === id).map(q => ({ id: q.id, selfRefutation: '원본' })) }]));
  for (const id of ids) {
    const dir = path.join(root, '.orchestrate/staging', id, 'original'), relative = `content-source/batches/${id}/drafts.json`;
    fs.mkdirSync(path.join(dir, 'files', path.dirname(relative)), { recursive: true });
    const bytes = JSON.stringify(drafts.filter(q => q.batchId === id)); fs.writeFileSync(path.join(dir, 'files', relative), bytes);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ batchId: id, writes: [{ path: relative, sha256: sha(bytes) }], deletes: [] }));
  }
  const select = (refs: Ref[]) => refs.map(r => { const q = drafts.find(q => q.batchId === r.batchId && q.id === r.questionId && q.revision === r.revision); if (!q) throw new Error('오래된 판'); return q; });
  const emit = (refs: Ref[], cb: Emit, who: string, phase: string) => cb({ type: 'call', who, phase, attempt: 1, batchIds: [...new Set(refs.map(r => r.batchId))] });
  const runtime = {
    ids, batch: (id: string) => ({ sidecar: sidecars.get(id) }),
    snapshot(id: string) { const qs = drafts.filter(q => q.batchId === id); return {
      drafts: qs, levelPending: qs.filter(q => !progress.get(q.id)!.level).map(key), codexPending: qs.filter(q => !progress.get(q.id)!.codex).map(key), argonPending: [],
      codexFinalPending: qs.filter(q => !progress.get(q.id)!.final).map(key),
      front: { items: qs.map(q => ({ questionId: q.id, revision: q.revision, status: !progress.get(q.id)!.level || !progress.get(q.id)!.codex ? 'pending' : progress.get(q.id)!.bad ? 'defect' : 'pass' })), batchDefects: [] },
    }; },
    levelQuestions: vi.fn(async (refs: Ref[], cb: Emit) => { emit(refs, cb, 'argon', 'assess'); emit(refs, cb, 'codex', 'assess'); for (const q of select(refs)) { progress.get(q.id)!.level = true; q.difficultyTier = 'core'; } return []; }),
    reviewQuestions: vi.fn(async (refs: Ref[], who: string, cb: Emit) => { expect(who).toBe('codex'); emit(refs, cb, who, 'blind'); emit(refs, cb, who, 'reveal'); for (const q of select(refs)) progress.get(q.id)!.codex = true; return []; }),
    finalizeQuestions: vi.fn(async (refs: Ref[]) => { for (const q of select(refs)) progress.get(q.id)!.final = true; return []; }),
    apply: vi.fn(() => { throw new Error('반영 금지'); }), reviseQuestions: vi.fn(() => { throw new Error('수정 금지'); }),
  };
  const resourceProbe = vi.fn(() => ({ 판단: { allowed: true }, 측정: { headroom_estimate_gib: 8 } }));
  const bank = { contentHash: (q: typeof drafts[number]) => sha(contentHashInput(q)), rationalesHash: (q: typeof drafts[number]) => sha(rationalesHashInput(q)) };
  const options = { root, batches: ids.join(','), 'stage-only': true, 'without-claude': true };
  return { root, ids, drafts, runtime, progress, options, deps: { runtime, bank, resourceProbe }, resourceProbe };
}

it('두 배치의 실제 현판 refs를 한 S1·S2·해설 묶음으로 처리하고 반영하지 않는다', async () => {
  const f = fixture(); const result = await runPreReview(f.options, f.deps);
  const refs = f.drafts.map(q => ({ batchId: q.batchId, questionId: q.id, revision: q.revision }));
  expect(result.status).toBe('complete'); expect(f.runtime.levelQuestions.mock.calls.map(c => c[0])).toEqual([refs]);
  expect(f.runtime.reviewQuestions.mock.calls.map(c => c[0])).toEqual([refs]); expect(f.runtime.finalizeQuestions.mock.calls.map(c => c[0])).toEqual([refs]);
  expect(result.modelCalls).toEqual({ argon: 1, codex: 3 }); expect(result.firstPassComplete).toBeUndefined();
  expect(f.runtime.apply).not.toHaveBeenCalled(); expect(f.runtime.reviseQuestions).not.toHaveBeenCalled();
  for (const id of f.ids) expect(fs.existsSync(path.join(f.root, '.orchestrate/gate-locks', id + '.json'))).toBe(false);
});
it('같은 학년만 최대 50개로 묶는다', async () => {
  const f = fixture([28, 28, 4], [3, 3, 4]); const result = await runPreReview(f.options, f.deps);
  expect(result.status).toBe('complete'); expect(f.runtime.levelQuestions.mock.calls.map(c => c[0].length)).toEqual([50, 6, 4]);
  for (const [refs] of f.runtime.levelQuestions.mock.calls) expect(new Set(refs.map(r => f.drafts.find(q => q.id === r.questionId)!.grade)).size).toBe(1);
});
it('plan은 살아 있는 gate 잠금도 읽기만 하고 모델과 자원 probe를 호출하지 않는다', async () => {
  const f = fixture(), release = acquireGateRun(f.root, f.ids[0]);
  try { const result = await runPreReview({ ...f.options, plan: true }, f.deps); expect(result.status).toBe('planned'); expect(result.locks[0].pid).toBe(process.pid); expect(result.modelCalls).toEqual({ argon: 0, codex: 0 }); expect(f.resourceProbe).not.toHaveBeenCalled(); expect(f.runtime.levelQuestions).not.toHaveBeenCalled(); } finally { release(); }
});
it('둘째 잠금 실패 시 첫째 자기 잠금만 해제하고 모델을 부르지 않는다', async () => {
  const f = fixture(), release = acquireGateRun(f.root, f.ids[1]);
  try { const result = await runPreReview(f.options, f.deps); expect(result.status).toBe('failed'); expect(result.error.message).toMatch(/gate 실행 중/); expect(f.runtime.levelQuestions).not.toHaveBeenCalled(); expect(fs.existsSync(path.join(f.root, '.orchestrate/gate-locks', f.ids[0] + '.json'))).toBe(false); } finally { release(); }
});
it('오래된 pending revision과 손상 staging은 모델 전에 거절한다', async () => {
  const f = fixture(); const snap = f.runtime.snapshot.bind(f.runtime);
  f.runtime.snapshot = id => ({ ...snap(id), levelPending: ['q-0-0@9'] });
  const result = await runPreReview(f.options, f.deps); expect(result.status).toBe('failed'); expect(result.error.message).toMatch(/현판/); expect(f.runtime.levelQuestions).not.toHaveBeenCalled();
  const g = fixture(); fs.appendFileSync(path.join(g.root, '.orchestrate/staging', g.ids[0]!, 'original/files/content-source/batches', g.ids[0]!, 'drafts.json'), ' ');
  const broken = await runPreReview(g.options, g.deps); expect(broken.status).toBe('failed'); expect(broken.error.message).toMatch(/해시/); expect(g.runtime.levelQuestions).not.toHaveBeenCalled();
});
it('S1 실패 뒤 S2를 실행하지 않고 실제 호출과 원인을 보존한다', async () => {
  const f = fixture(); f.runtime.levelQuestions.mockImplementationOnce(async (refs, cb) => { cb({ type: 'call', who: 'codex', phase: 'assess', attempt: 1, batchIds: refs.map(r => r.batchId) }); throw new Error('원응답 형식 오류'); });
  const result = await runPreReview(f.options, f.deps); expect(result.status).toBe('failed'); expect(result.error.message).toBe('원응답 형식 오류'); expect(result.modelCalls).toEqual({ argon: 0, codex: 1 }); expect(f.runtime.reviewQuestions).not.toHaveBeenCalled(); expect(f.runtime.finalizeQuestions).not.toHaveBeenCalled();
});
it('native 두 번째 시도는 모델 이벤트를 세기 전에 차단한다', async () => {
  const f = fixture(); f.runtime.levelQuestions.mockImplementationOnce(async (refs, cb) => { for (const attempt of [1, 2]) cb({ type: 'call', who: 'codex', phase: 'assess', attempt, batchIds: refs.map(r => r.batchId) }); return []; });
  const result = await runPreReview(f.options, f.deps); expect(result.status).toBe('failed'); expect(result.error.message).toMatch(/재시도/); expect(result.modelCalls.codex).toBe(1); expect(f.runtime.reviewQuestions).not.toHaveBeenCalled();
});
it('S1 도중 본문 변경 또는 7GiB 미만이면 다음 호출 전에 닫힌다', async () => {
  const f = fixture(); f.runtime.levelQuestions.mockImplementationOnce(async () => { f.drafts[0]!.stem = '바뀐 본문'; return []; });
  const result = await runPreReview(f.options, f.deps); expect(result.status).toBe('failed'); expect(result.error.message).toMatch(/현판|불변/); expect(f.runtime.reviewQuestions).not.toHaveBeenCalled();
  const g = fixture(); g.resourceProbe.mockReturnValue({ 판단: { allowed: true }, 측정: { headroom_estimate_gib: 6.9 } });
  const low = await runPreReview(g.options, g.deps); expect(low.status).toBe('failed'); expect(low.modelCalls).toEqual({ argon: 0, codex: 0 }); expect(g.runtime.levelQuestions).not.toHaveBeenCalled();
});
it('front 결함 문항은 해설 연결에서 제외하고 runGate에 남긴다', async () => {
  const f = fixture(); f.progress.get(f.drafts[0]!.id)!.bad = true; const result = await runPreReview(f.options, f.deps);
  expect(result.status).toBe('complete'); expect(f.runtime.finalizeQuestions.mock.calls[0]![0]).toHaveLength(11); expect(result.remaining[f.ids[0]!].frontDefects).toBe(1);
});
it('잘못된 CLI/API 옵션을 실행 전에 거절한다', async () => {
  expect(() => parsePreReviewArgs(['--plan=false'])).toThrow(); expect(() => parsePreReviewArgs(['--batches', 'A', '--batches', 'B'])).toThrow();
  const f = fixture();
  for (const extra of [{ 'stage-only': false }, { 'without-claude': 'true' }, { 'codex-model': 'gpt-6.1-sol' }, { 'codex-effort': 'xhigh' }, { commit: true }, { batches: f.ids[0] + ',' + f.ids[0] }]) await expect(runPreReview({ ...f.options, ...extra }, f.deps)).rejects.toThrow();
  expect(f.runtime.levelQuestions).not.toHaveBeenCalled();
});

it('기본 실행기에 강한 모델·단일 동시성·사용량 재시도 차단을 전달한다', async () => {
  const f = fixture();
  const createRuntime = vi.fn<(options: Record<string, unknown>) => Promise<typeof f.runtime>>().mockResolvedValue(f.runtime);
  const result = await runPreReview({ ...f.options, plan: true }, { createRuntime, bank: f.deps.bank, resourceProbe: f.resourceProbe });
  expect(result.status).toBe('planned');
  const options = createRuntime.mock.calls[0]![0];
  expect(options['codex-model']).toBe('gpt-6-astra'); expect(options['codex-effort']).toBe('high');
  expect(options['review-concurrency']).toBe(1); expect(options['argon-per-hour']).toBe(40);
  await expect((options.sleep as () => Promise<void>)()).rejects.toThrow(/자동 재시도 금지/);
});
it('호출 직전 자원이 줄거나 기존 staging 원본이 바뀌면 후속 모델을 차단한다', async () => {
  const f = fixture(); f.resourceProbe.mockReturnValueOnce({ 판단: { allowed: true }, 측정: { headroom_estimate_gib: 8 } }).mockReturnValue({ 판단: { allowed: true }, 측정: { headroom_estimate_gib: 6 } });
  const blocked = await runPreReview(f.options, f.deps); expect(blocked.status).toBe('failed'); expect(blocked.modelCalls).toEqual({ argon: 0, codex: 0 }); expect(f.runtime.reviewQuestions).not.toHaveBeenCalled();
  const g = fixture(); g.runtime.levelQuestions.mockImplementationOnce(async () => {
    fs.appendFileSync(path.join(g.root, '.orchestrate/staging', g.ids[0]!, 'original/manifest.json'), ' '); return [];
  });
  const changed = await runPreReview(g.options, g.deps); expect(changed.status).toBe('failed'); expect(changed.error.message).toMatch(/원본 불변/); expect(g.runtime.reviewQuestions).not.toHaveBeenCalled();
});
it('native 형식 재요청과 달리 같은 attempt의 사용량 재호출도 차단한다', async () => {
  const f = fixture(); f.runtime.levelQuestions.mockImplementationOnce(async (refs, cb) => {
    const event = { type: 'call', who: 'codex', phase: 'assess', attempt: 1, batchIds: refs.map(r => r.batchId) };
    cb(event); cb(event); return [];
  });
  const result = await runPreReview(f.options, f.deps); expect(result.status).toBe('failed'); expect(result.modelCalls.codex).toBe(1); expect(result.error.message).toMatch(/재시도 금지/);
});
