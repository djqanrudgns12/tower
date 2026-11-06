import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as actualFront from '../../tools/content/frontGate';
import { contentHash as actualContentHash } from '../../tools/content/bankBuild';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error MJS 실행기의 선언 파일 없음
import { runGate, createGateRuntime } from '../../tools/orchestrate/content-loop.mjs';
// @ts-expect-error MJS 실행기의 선언 파일 없음
import { pending, buildPhase, ingest, acceptPhase, resolveReviewConfig, runPhase } from '../../tools/orchestrate/review.mjs';
// @ts-expect-error MJS 실행기의 선언 파일 없음
import { promptFor } from '../../tools/orchestrate/level.mjs';

vi.mock('node:child_process', () => {
  const blocked = () => { throw new Error('시험에서 실제 모델·브리지·git 호출 금지'); };
  return { spawn: blocked, spawnSync: blocked };
});
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
type Item = { id: string; revision: number; level?: boolean; codex?: boolean; claude?: boolean; status?: string; frontRounds: number; gateRounds: number };
function fixture(count = 1) {
  fs.mkdirSync('.orchestrate', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.orchestrate/gate-test-')); roots.push(root);
  let items: Item[] = Array.from({ length: count }, (_, i) => ({ id: `q${i}`, revision: 1, frontRounds: 0, gateRounds: 0 }));
  const events: string[] = [];
  let staged: (() => void) | undefined;
  const key = (q: Item) => `${q.id}@${q.revision}`;
  const deps = {
    ids: ['A'],
    snapshot: () => ({
      drafts: items, levelPending: items.filter(q => !q.level).map(key),
      codexPending: items.filter(q => !q.codex).map(key), argonPending: [],
      claudePending: items.filter(q => !q.claude).map(key),
      front: { items: items.map(q => ({ questionId: q.id, revision: q.revision, status: q.status ?? (q.level && q.codex ? 'pass' : 'pending'), defects: [], pending: [] })), batchDefects: [] },
      flagged: items.filter(q => q.status === 'defect' || q.status === 'gate-defect').map(q => ({ q, phase: q.status === 'defect' ? 'front' : 'gate' })),
    }),
    level: vi.fn(async () => { events.push('S1'); staged = () => { items.forEach(q => { q.level = true; }); }; return { assessed: items.length }; }),
    review: vi.fn(async (_id: string, who: 'codex' | 'claude', keys: string[]) => {
      events.push(`${who}:${keys.join(',')}`);
      staged = () => { items.filter(q => keys.includes(key(q))).forEach(q => { q[who] = true; }); };
      return { merged: keys.length, flagged: 0, modelCalls: { [who]: 2 } };
    }),
    revise: vi.fn(async (_id: string, phase: 'front' | 'gate', keys: string[]) => {
      events.push(`revise:${phase}`);
      const selected = items.filter(q => keys.includes(key(q)));
      const dropped = selected.filter(q => q[`${phase}Rounds`] >= 2).length;
      staged = () => {
        items = items.filter(q => !selected.includes(q) || q[`${phase}Rounds`] < 2);
        items.filter(q => selected.includes(q)).forEach(q => { q[`${phase}Rounds`]++; q.revision++; q.level = false; q.codex = false; q.claude = false; });
      };
      return { revised: selected.length - dropped, dropped, rejected: 0 };
    }),
    apply: vi.fn(async () => { events.push('apply'); const runs = staged ? ['run'] : []; staged?.(); staged = undefined; return { runs }; }),
    log: vi.fn(),
  };
  return { root, items, deps, events, options: { root, batches: 'A', gate: true } };
}

describe('단계 순서 관문 실행기', () => {
  it('--until S3은 관문을 대기시키고 이후 일반 실행에서 이어 간다', async () => {
    const f = fixture();
    const front = await runGate({ ...f.options, until: 'S3' }, f.deps);
    expect(f.deps.review.mock.calls.map(c => c[1])).toEqual(['codex']);
    expect(front.A.awaitingClaude).toBe(1);
    const plan = await runGate({ ...f.options, until: 'S3', plan: true }, f.deps);
    expect(plan.A.next).toEqual({ stage: 'S4 대기', target: 1 });
    await runGate(f.options, f.deps);
    expect(f.deps.review.mock.calls.map(c => c[1])).toEqual(['codex', 'claude']);
  });
  it('--until S3은 기존 관문 결함을 수정하지 않는다', async () => {
    const f = fixture(); f.items[0]!.status = 'gate-defect'; f.items[0]!.claude = true;
    const snapshot = f.deps.snapshot;
    f.deps.snapshot = () => { const s = snapshot(); s.front.items.forEach(q => { q.status = 'pass'; }); return s; };
    await runGate({ ...f.options, until: 'S3' }, f.deps);
    expect(f.deps.revise).not.toHaveBeenCalled();
    expect(f.deps.review.mock.calls.map(c => c[1])).toEqual(['codex']);
  });
  it('잘못된 --until은 호출 전에 거절한다', async () => {
    const f = fixture();
    await expect(runGate({ ...f.options, until: 'S2' }, f.deps)).rejects.toThrow('--until');
    expect(f.events).toEqual([]);
  });
  it('Claude 인증 차단은 S4 blocked로 기록하고 재시도하지 않는다', async () => {
    const f = fixture(); f.items[0]!.level = true; f.items[0]!.codex = true;
    f.deps.review.mockRejectedValue(Object.assign(new Error('Claude 인증 차단'), { code: 'CLAUDE_AUTH_BLOCKED' }));
    const result = await runGate(f.options, f.deps);
    expect(f.deps.review).toHaveBeenCalledTimes(1);
    expect(result.A).toMatchObject({ blocked: true, blockedReason: 'authentication', skipped: false });
    expect(result.A.stages.find((s: { stage: string }) => s.stage === 'S4')).toMatchObject({ status: 'blocked' });
  });
  it('잠금 반영의 자원 대기는 시험 실패·모델 재시도로 처리하지 않는다', async () => {
    const f = fixture();
    f.deps.apply.mockResolvedValueOnce({ runs: [] }).mockRejectedValue(Object.assign(new Error('자원 대기'), { code: 'RESOURCE_WAIT' }));
    const result = await runGate({ ...f.options, until: 'S3' }, f.deps);
    expect(f.deps.level).toHaveBeenCalledTimes(1);
    expect(f.deps.review).not.toHaveBeenCalled();
    expect(result.A).toMatchObject({ blocked: true, blockedReason: 'resource', skipped: false });
    expect(result.A.stages[0].status).toBe('blocked');
  });
  it('S1→S2→S4 사이마다 반영하고 호출 수·시각을 기록한다', async () => {
    const f = fixture(); const summary = await runGate(f.options, f.deps);
    expect(f.events).toEqual(['apply', 'S1', 'apply', 'codex:q0@1', 'apply', 'claude:q0@1', 'apply']);
    expect(summary.A.stages.map((s: { stage: string }) => s.stage)).toEqual(['S1', 'S2-codex', 'S3', 'S4']);
    expect(summary.A.stages[3]).toMatchObject({ target: 1, passed: 1, defects: 0, dropped: 0, modelCalls: { claude: 2, codex: 0, bridge: 0 } });
    expect(Date.parse(summary.A.endedAt)).toBeGreaterThanOrEqual(Date.parse(summary.A.startedAt));
    expect(JSON.parse(fs.readFileSync(path.join(f.root, '.orchestrate/content-loop.summary.json'), 'utf8'))).toEqual(summary);
  });
  it('pending을 고치지 않고 Claude에는 front pass만 전달한다', async () => {
    const f = fixture(2); f.items[1]!.status = 'pending';
    await runGate(f.options, f.deps);
    expect(f.deps.review.mock.calls.filter(c => c[1] === 'claude').map(c => c[2])).toEqual([['q0@1']]);
    expect(f.deps.revise).not.toHaveBeenCalled();
  });
  it.each(['front', 'gate'] as const)('%s 수정은 S1으로 돌아가고 두 번 뒤 버린다', async phase => {
    const f = fixture();
    if (phase === 'front') f.items[0]!.status = 'defect';
    else f.deps.review.mockImplementation(async (_id, who, keys) => {
      f.events.push(`${who}:${keys.join(',')}`);
      f.items.forEach(q => { q[who] = true; if (who === 'claude') q.status = 'gate-defect'; });
      return { merged: keys.length, flagged: who === 'claude' ? 1 : 0, modelCalls: { [who]: 2 } };
    });
    // 관문 결함은 앞단 판정에서 pass다.
    const snapshot = f.deps.snapshot;
    f.deps.snapshot = () => { const s = snapshot(); s.front.items.forEach(q => { if (q.status === 'gate-defect') q.status = 'pass'; }); return s; };
    const summary = await runGate(f.options, f.deps);
    expect(f.deps.revise).toHaveBeenCalledTimes(3);
    expect(f.events.filter(e => e === 'S1')).toHaveLength(3);
    expect(summary.A.stages.filter((s: { dropped: number }) => s.dropped === 1)).toHaveLength(1);
    if (phase === 'front') expect(f.deps.review.mock.calls.some(c => c[1] === 'claude')).toBe(false);
    for (const [i, event] of f.events.entries()) if (event === `revise:${phase}` && i < f.events.lastIndexOf(`revise:${phase}`)) expect(f.events.slice(i, i + 3)).toEqual([`revise:${phase}`, 'apply', 'S1']);
  });
  it('같은 오류 세 번이면 건너뛰며 다음 배치를 처리한다', async () => {
    const f = fixture(); f.deps.ids = ['A', 'B'];
    f.deps.level.mockRejectedValue(new Error('같은 오류'));
    const summary = await runGate({ ...f.options, batches: 'A,B' }, f.deps);
    expect(f.deps.level).toHaveBeenCalledTimes(6);
    expect(summary.A).toMatchObject({ skipped: true, error: '같은 오류' });
    expect(summary.B.skipped).toBe(true);
  });
  it('--plan은 다음 단계·대상 수만 보고하며 모델·반영을 호출하지 않는다', async () => {
    const f = fixture(2); const summary = await runGate({ ...f.options, plan: true }, f.deps);
    expect(summary.A.next).toEqual({ stage: 'S1', target: 2 });
    expect(f.deps.log).toHaveBeenCalledWith('A: 다음 S1 · 대상 2문항');
    expect(f.events).toEqual([]);
    expect(f.deps.apply).not.toHaveBeenCalled();
  });
  it('--no-commit은 첫 반영에서 멈추고 다음 배치를 실행하지 않는다', async () => {
    const f = fixture(); f.deps.ids = ['A', 'B'];
    const summary = await runGate({ ...f.options, 'no-commit': true }, f.deps);
    expect(f.events).toEqual(['apply', 'S1', 'apply']);
    expect(summary.A.awaitingCommit).toBe(true); expect(summary.B.awaitingApply).toBe(true);
    expect(f.deps.apply).toHaveBeenLastCalledWith('A', { noCommit: true });
  });
  it('반영 실패 뒤 다른 모델을 다시 부르지 않는다', async () => {
    const f = fixture(); f.deps.apply.mockResolvedValueOnce({ runs: [] }).mockRejectedValue(new Error('커밋 실패'));
    const summary = await runGate(f.options, f.deps);
    expect(f.deps.level).toHaveBeenCalledTimes(1); expect(f.deps.review).not.toHaveBeenCalled();
    expect(summary.A.error).toBe('커밋 실패');
  });
});

function reviewFixture() {
  const f = fixture();
  const drafts = ['q1', 'q2'].map(id => ({ id, revision: 1, grade: 4, type: 'definition', target: { lemma: '낱말', partOfSpeech: '명사', senseKey: '낱말/명사/1' },
    stem: '문제', options: [{ id: 'a', text: '답' }], correctOptionId: 'a', explanation: '해설', source: { evidenceArtifactId: 'missing.json' }, gradeBasis: {}, distractorRationales: {} }));
  const old = { reviewer: { model: 'gpt-6.1-sol' }, items: drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: 'hash', findings: [] })) };
  const batch = { batchId: 'A', drafts, sidecar: { producer: { tool: 'produce.mjs' } }, reviews: { codex: old }, argonBlind: null };
  const bank = { loadBatches: () => [batch], contentHash: () => 'hash', rationalesHash: () => 'rationales', decide: (input: { drafts: typeof drafts } = { drafts }) => input.drafts.map(q => ({ questionId: q.id, revision: q.revision, reasons: [] })) };
  const front = { currentDrafts: (qs: typeof drafts) => qs,
    frontGate: (input: { drafts: typeof drafts } = { drafts }) => ({ items: input.drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: 'hash', status: 'pass', defects: [], pending: [] })), batchDefects: [] }) };
  const modules = { rb: bank, rm: { b: bank, front, root: f.root }, lm: { levels: { isCurrentLevelAssessment: (q: { revision: number }, item: { revision: number }) => q.revision === item.revision } } };
  const reportPath = path.join(f.root, 'content-source/reviews/A/codex.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(old));
  return { ...f, drafts, old, batch, bank, modules, reportPath };
}

describe('문항 제한·D3·성취기준 연결', () => {
  it.each(['Failed to authenticate', 'OAuth session expired and could not be refreshed', 'not logged in'])('인증 실패 %s는 형식 재시도와 사용량 대기를 쓰지 않는다', async message => {
    const f = reviewFixture(), respond = vi.fn(async () => ({ code: 1, out: '', err: message })), sleep = vi.fn();
    await expect(runPhase(f.bank, f.root, 'claude', 'A', 'blind', vi.fn(), { respond, sleep }))
      .rejects.toMatchObject({ code: 'CLAUDE_AUTH_BLOCKED' });
    expect(respond).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it('문항 제한을 blind→reveal→ingest까지 유지하고 기존 다른 문항은 보존한다', async () => {
    const f = reviewFixture();
    const config = resolveReviewConfig({}, {}).codex;
    // q2만 이미 검수되어 있어 q1 제한 목록만 새로 본다.
    f.old.items = f.old.items.filter(i => i.questionId === 'q2');
    fs.writeFileSync(f.reportPath, JSON.stringify(f.old));
    const opts = { config, questionKeys: ['q1@1'] };
    expect(pending(f.bank, f.batch, 'codex', opts).map((q: { id: string }) => q.id)).toEqual(['q1']);
    for (const phase of ['blind', 'reveal']) {
      const input = await buildPhase(f.bank, f.root, 'codex', 'A', phase, opts);
      expect(input.items.map((q: { questionId: string }) => q.questionId)).toEqual(['q1']);
      const text = JSON.stringify({ items: input.items.map((q: { questionId: string; revision: number }) => ({ questionId: q.questionId, revision: q.revision, blindChoice: 'a', verdicts: { uniqueness: 'pass', grade: 'pass', language: 'pass', source: 'pass', explanation: 'pass' }, findings: [] })) });
      acceptPhase(f.root, 'codex', 'A', phase, text, input.items, opts);
    }
    const result = await ingest(f.bank, f.root, 'codex', 'A', opts);
    const report = JSON.parse(fs.readFileSync(path.join(f.root, result.staging, 'files/content-source/reviews/A/codex.json'), 'utf8'));
    expect(report.items.map((q: { questionId: string }) => q.questionId)).toEqual(['q1', 'q2']);
    expect(report.items[1]).toEqual(f.old.items[0]);
    expect(pending(f.bank, f.batch, 'codex', { config, questionKeys: [] })).toEqual([]);
  });
  it('--recheck-codex는 모델이 다르면 현재 판 전부를 선택하고 ingest에서 원문을 보관한다', async () => {
    const f = reviewFixture();
    const options = { ...f.options, 'codex-model': 'gpt-6-astra', 'codex-effort': 'high', 'recheck-codex': true };
    const runtime = await createGateRuntime(options, f.modules);
    expect(runtime.snapshot('A').codexPending).toEqual(['q1@1', 'q2@1']);
    const noRecheck = await createGateRuntime({ ...options, 'recheck-codex': false }, f.modules);
    expect(() => noRecheck.snapshot('A')).toThrow(/archive-existing/);
    const opts = { config: resolveReviewConfig(options, {}).codex, archiveExisting: true, questionKeys: runtime.snapshot('A').codexPending };
    for (const phase of ['blind', 'reveal']) {
      const input = await buildPhase(f.bank, f.root, 'codex', 'A', phase, opts);
      const text = JSON.stringify({ items: input.items.map((q: { questionId: string; revision: number }) => ({ questionId: q.questionId, revision: q.revision, blindChoice: 'a', verdicts: { uniqueness: 'pass', grade: 'pass', language: 'pass', source: 'pass', explanation: 'pass' }, findings: [] })) });
      acceptPhase(f.root, 'codex', 'A', phase, text, input.items, opts);
    }
    const original = fs.readFileSync(f.reportPath, 'utf8');
    const result = await ingest(f.bank, f.root, 'codex', 'A', opts);
    expect(fs.readFileSync(path.join(f.root, result.staging, 'files/content-source/reviews/archive/A.codex.gpt-6-1-sol.json'), 'utf8')).toBe(original);
    expect(fs.readFileSync(f.reportPath, 'utf8')).toBe(original);
    f.old.reviewer.model = 'gpt-6-astra';
    expect(runtime.snapshot('A').codexPending).toEqual([]);
  });
  it('produce.mjs 배치만 현재 revision의 누락된 Argon 검수를 요청한다', async () => {
    const f = reviewFixture(); const runtime = await createGateRuntime(f.options, f.modules);
    expect(runtime.snapshot('A').argonPending).toEqual(['q1@1', 'q2@1']);
    f.batch.sidecar.producer.tool = '기존 제작기';
    expect(runtime.snapshot('A').argonPending).toEqual([]);
  });
  it('produce 수정판에는 Argon 새 문맥 검수를 반복하지 않는다', async () => {
    const f = reviewFixture(); f.drafts.forEach(q => { q.revision++; });
    const runtime = await createGateRuntime(f.options, f.modules);
    expect(runtime.snapshot('A').argonPending).toEqual([]);
    expect(runtime.snapshot('A').codexPending).toEqual(['q1@2', 'q2@2']);
  });
  it('성취기준 모든 코드·원문을 지시문에 포함하며 빈 정본에서는 사용을 금한다', () => {
    const f = fixture(); const file = path.join(f.root, 'content-source/reference/curriculum-2022.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const items = [{ code: '[4국01-01]', text: '중요한 내용과 주제를 파악하며 듣고 그 내용을 요약한다.' }, { code: '[6국01-01]', text: '대화에서 생략된 내용을 추론하며 듣는다.' }];
    fs.writeFileSync(file, JSON.stringify({ items }));
    const prompt = promptFor([], '루브릭', 'assess', f.root);
    for (const item of items) { expect(prompt).toContain(item.code); expect(prompt).toContain(item.text); }
    expect(prompt).toContain('curriculum_explicit은 이 목록의 코드만, 원문 뜻이 낱말과 맞을 때만');
    expect(promptFor([], '루브릭', 'assess', path.join(f.root, 'absent'))).toContain('목록이 비어 있으면 curriculum_explicit을 쓰지 않는다');
  });
});

function stageFiles(root: string, runId: string, values: Record<string, unknown>, deletes: string[] = []) {
  const base = path.join(root, '.orchestrate/staging/A', runId);
  const writes = Object.entries(values).map(([relative, value]) => {
    const bytes = JSON.stringify(value), file = path.join(base, 'files', relative);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
    return { path: relative, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, 'manifest.json'), JSON.stringify({ batchId: 'A', runId, createdAt: new Date().toISOString(), writes, deletes }));
  return base;
}

function stagedFixture() {
  const f = reviewFixture();
  const drafts = f.drafts.map(q => ({ ...q, revision: 2 }));
  const staged = stageFiles(f.root, '0001', {
    'content-source/batches/A/drafts.json': drafts,
    'content-source/batches/A/sidecar.json': { producer: { tool: '기존 제작기' } },
    'content-source/levels/A.json': { items: drafts },
    'content-source/reviews/A/codex.json': { ...f.old, items: [] },
  });
  const respond = vi.fn(async (request: { items: { questionId: string; revision: number }[] }) => ({ code: 0, err: '', out: JSON.stringify({ items: request.items.map(q => ({ questionId: q.questionId, revision: q.revision, blindChoice: 'a', verdicts: { uniqueness: 'pass', grade: 'pass', language: 'pass', source: 'pass', explanation: 'pass' }, findings: [] })) }) }));
  return { ...f, staged, respond, options: { ...f.options, 'stage-only': true, until: 'S3', respond } };
}

describe('staging 전용 gate', () => {
  it('현재 staging 판을 검수하고 apply 없이 재개하며 추적 파일과 기존 요약을 보존한다', async () => {
    const f = stagedFixture();
    const tracked = fs.readFileSync(f.reportPath, 'utf8');
    const pendingPath = path.join(f.root, '.orchestrate/commit.pending.json');
    fs.writeFileSync(pendingPath, '{"batches":["OTHER"]}');
    const summaryPath = path.join(f.root, '.orchestrate/content-loop.summary.json');
    fs.writeFileSync(summaryPath, '{"legacy":true}');
    const runtime = await createGateRuntime(f.options, f.modules);
    const apply = vi.fn(); runtime.apply = apply;
    const plan = await runGate({ ...f.options, plan: true }, runtime);
    expect(plan.A).toEqual({ awaitingApply: true, next: { stage: 'S2-codex', target: 2 } });
    expect(f.respond).not.toHaveBeenCalled();
    const first = await runGate(f.options, runtime);
    expect(first.A.error).toBeUndefined();
    expect(first.A).toMatchObject({ awaitingApply: true, awaitingClaude: 2, firstPassComplete: true });
    expect(f.respond).toHaveBeenCalledTimes(2);
    expect(f.respond.mock.calls.flatMap(([r]) => r.items.map(q => q.revision))).toEqual([2, 2, 2, 2]);
    await runGate(f.options, runtime);
    expect(f.respond).toHaveBeenCalledTimes(2);
    expect(apply).not.toHaveBeenCalled();
    expect(fs.readFileSync(f.reportPath, 'utf8')).toBe(tracked);
    expect(fs.readFileSync(summaryPath, 'utf8')).toBe('{"legacy":true}');
    expect(fs.readFileSync(pendingPath, 'utf8')).toBe('{"batches":["OTHER"]}');
    expect(fs.existsSync(path.join(f.root, '.orchestrate/content-loop.stage-only.summary.json'))).toBe(true);
  });
  it('S3 수정 staging에서 S1 재판정과 S2 재검수까지 자동 진행한다', async () => {
    const f = stagedFixture();
    f.modules.rm.front.frontGate = (batch = { drafts: f.drafts }) => ({ items: batch.drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: 'hash', status: q.revision === 2 ? 'defect' : 'pass', defects: [], pending: [] })), batchDefects: [] });
    const runtime = await createGateRuntime(f.options, f.modules);
    runtime.apply = vi.fn();
    runtime.reviseQuestions = vi.fn(async () => {
      stageFiles(f.root, '0002', { 'content-source/batches/A/drafts.json': f.drafts.map(q => ({ ...q, revision: 3 })) });
      return [{ batchId: 'A', revised: 2, dropped: 0, rejected: 0 }];
    });
    runtime.levelQuestions = vi.fn(async () => {
      stageFiles(f.root, '0003', { 'content-source/levels/A.json': { items: f.drafts.map(q => ({ ...q, revision: 3 })) } });
      return [{ batchId: 'A', assessed: 2 }];
    });
    const result = await runGate(f.options, runtime);
    expect(result.A.error).toBeUndefined();
    expect(result.A.stages.map((s: { stage: string }) => s.stage)).toEqual(['S2-codex', 'S3', 'S3', 'S1', 'S2-codex', 'S3']);
    expect(f.respond.mock.calls.flatMap(([r]) => r.items.map(q => q.revision))).toEqual([2, 2, 2, 2, 3, 3, 3, 3]);
    await runGate(f.options, runtime);
    expect(runtime.reviseQuestions).toHaveBeenCalledTimes(1);
    expect(runtime.levelQuestions).toHaveBeenCalledTimes(1);
    expect(f.respond).toHaveBeenCalledTimes(4);
    expect(runtime.apply).not.toHaveBeenCalled();
  });
  it('manifest의 배치 밖 경로도 읽기 전에 거절한다', async () => {
    const f = stagedFixture(), file = path.join(f.staged, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.deletes.push('content-source/batches/OTHER/drafts.json');
    fs.writeFileSync(file, JSON.stringify(manifest));
    await expect(runGate(f.options, { modules: f.modules })).rejects.toThrow('배치 밖');
    expect(f.respond).not.toHaveBeenCalled();
  });
  it('손상된 manifest는 plan과 실행 모두 모델 호출 전에 거절한다', async () => {
    const f = stagedFixture();
    fs.writeFileSync(path.join(f.staged, 'files/content-source/batches/A/drafts.json'), '[]');
    await expect(runGate({ ...f.options, plan: true }, { modules: f.modules })).rejects.toThrow('해시 불일치');
    await expect(runGate(f.options, { modules: f.modules })).rejects.toThrow('해시 불일치');
    expect(f.respond).not.toHaveBeenCalled();
  });
  it('staged closed 배치는 재검수 없이 반영 대기로 남긴다', async () => {
    const f = stagedFixture();
    stageFiles(f.root, '0002', { 'content-source/batches/A/closed.json': { batchId: 'A' } }, ['content-source/batches/A/drafts.json']);
    const result = await runGate(f.options, { modules: f.modules });
    expect(result.A).toMatchObject({ closed: true, awaitingApply: true });
    expect(f.respond).not.toHaveBeenCalled();
  });
  it('추적되지 않은 새 staging 배치를 완료로 오인하지 않는다', async () => {
    const f = stagedFixture();
    await expect(runGate(f.options, { modules: { ...f.modules, rb: { ...f.bank, loadBatches: () => [] } } })).rejects.toThrow('기존 추적 배치만');
  });
  it('같은 배치 writer의 실행잠금을 존중한다', async () => {
    const f = stagedFixture(), dir = path.join(f.root, '.orchestrate/gate-locks');
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'A.json'), JSON.stringify({ pid: process.pid, token: 'other' }));
    await expect(runGate(f.options, { modules: f.modules })).rejects.toThrow('gate 실행 중');
    expect(f.respond).not.toHaveBeenCalled();
  });
});

describe('선택적 추가 검수 생략', () => {
  it('--skip-argon-fresh는 제작 배치의 추가 2단계 호출만 생략한다', async () => {
    const f = stagedFixture();
    stageFiles(f.root, '0002', {
      'content-source/batches/A/drafts.json': f.drafts,
      'content-source/batches/A/sidecar.json': { producer: { tool: 'produce.mjs' } },
      'content-source/levels/A.json': { items: f.drafts },
    });
    const normal = await createGateRuntime(f.options, f.modules);
    expect(normal.snapshot('A').argonPending).toEqual(['q1@1', 'q2@1']);
    const options = { ...f.options, 'skip-argon-fresh': true };
    const runtime = await createGateRuntime(options, f.modules);
    expect(runtime.snapshot('A').argonPending).toEqual([]);
    const result = await runGate(options, runtime);
    expect(result.A.error).toBeUndefined();
    expect(result.A.stages.map((s: { stage: string }) => s.stage)).toEqual(['S2-codex', 'S3']);
    expect(f.respond).toHaveBeenCalledTimes(2);
    expect(result.A.awaitingClaude).toBe(2);
  });
  it('--skip-argon-fresh도 기존 argon-blind 실패를 frontGate와 수정 대상으로 보존한다', async () => {
    const f = reviewFixture();
    const report = { reviewer: { model: 'Gemini 4 Argon' }, items: f.drafts.map(q => ({ questionId: q.id, revision: q.revision,
      contentHash: actualContentHash(q as unknown as QuestionDraft), blindChoice: 'a', verdicts: { uniqueness: 'pass', grade: 'pass', language: 'fail', source: 'pass', explanation: 'pass' }, findings: ['명백한 비문'] })) };
    const batch = { ...f.batch, sidecar: { ...f.batch.sidecar, items: [] }, reviews: {}, argonBlind: report };
    const modules = { ...f.modules, rb: { ...f.bank, loadBatches: () => [batch] }, rm: { ...f.modules.rm, front: actualFront } };
    const options = { ...f.options, 'archive-existing': true };
    const before = (await createGateRuntime(options, modules)).snapshot('A');
    const after = (await createGateRuntime({ ...options, 'skip-argon-fresh': true }, modules)).snapshot('A');
    expect(after.front).toEqual(before.front);
    expect(after.flagged).toEqual(before.flagged);
    expect(after.front.items.every((q: { defects: string[] }) => q.defects.includes('argon-blind: language fail'))).toBe(true);
    expect(batch.argonBlind).toEqual(report);
  });
});
