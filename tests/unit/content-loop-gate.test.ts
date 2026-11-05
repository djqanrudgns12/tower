import fs from 'node:fs';
import path from 'node:path';
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
  const drafts = ['q1', 'q2'].map(id => ({ id, revision: 1, grade: 4, type: 'definition', target: { lemma: '낱말', partOfSpeech: '명사' },
    stem: '문제', options: [{ id: 'a', text: '답' }], correctOptionId: 'a', explanation: '해설', source: { evidenceArtifactId: 'missing.json' }, gradeBasis: {}, distractorRationales: {} }));
  const old = { reviewer: { model: 'gpt-6.1-sol' }, items: drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: 'hash', findings: [] })) };
  const batch = { batchId: 'A', drafts, sidecar: { producer: { tool: 'produce.mjs' } }, reviews: { codex: old }, argonBlind: null };
  const bank = { loadBatches: () => [batch], contentHash: () => 'hash', rationalesHash: () => 'rationales', decide: () => drafts.map(q => ({ questionId: q.id, revision: q.revision, reasons: [] })) };
  const front = { currentDrafts: (qs: typeof drafts) => qs,
    frontGate: () => ({ items: drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: 'hash', status: 'pass', defects: [], pending: [] })), batchDefects: [] }) };
  const modules = { rb: bank, rm: { b: bank, front, root: f.root }, lm: { levels: { isCurrentLevelAssessment: () => true } } };
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
