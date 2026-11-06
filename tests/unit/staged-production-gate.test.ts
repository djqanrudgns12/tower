import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import * as bank from '../../tools/content/bankBuild';
import * as d from '../../src/contracts/questionDraft';
import * as front from '../../tools/content/frontGate';
import * as lint from '../../src/content/lint';
import * as levels from '../../tools/content/levels';
// @ts-expect-error MJS 선언 없음
import { createGateRuntime, runGate } from '../../tools/orchestrate/content-loop.mjs';
// @ts-expect-error MJS 선언 없음
import { revealItem, runStagedQuestions } from '../../tools/orchestrate/review.mjs';
// @ts-expect-error MJS 선언 없음
import { promptFor } from '../../tools/orchestrate/revise.mjs';

vi.mock('node:child_process', () => ({ spawn: () => { throw new Error('실제 모델 호출 금지'); } }));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function setup() {
  const root = fs.mkdtempSync(path.resolve('.orchestrate/produced-gate-test-')); roots.push(root);
  const original = structuredClone(bank.loadBatches(process.cwd()).find(b => b.batchId === 'Q20-001')!);
  const q = original.drafts[0]!; q.batchId = 'NEW';
  const sidecar = { ...original.sidecar, batchId: 'NEW', producer: { ...original.sidecar.producer, tool: 'produce.mjs' } };
  const evidence = 'staging에서만 제공되는 사전 근거';
  const base = path.join(root, '.orchestrate/staging/NEW/0001');
  const values = {
    'content-source/batches/NEW/drafts.json': JSON.stringify([q]),
    'content-source/batches/NEW/sidecar.json': JSON.stringify(sidecar),
    [`content-source/batches/NEW/evidence/${q.source.evidenceArtifactId}`]: evidence,
  };
  const writes = Object.entries(values).map(([relative, bytes]) => {
    const file = path.join(base, 'files', relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
    return { path: relative, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  fs.writeFileSync(path.join(base, 'manifest.json'), JSON.stringify({ batchId: 'NEW', runId: '0001', createdAt: new Date().toISOString(), writes, deletes: [] }));
  const modules = { rb: bank, rm: { b: bank, d, front, lint, root }, lm: { levels } };
  const options = { root, batches: 'NEW', 'stage-only': true, 'without-claude': true, 'codex-model': 'gpt-6-astra', 'codex-effort': 'high', log: () => {} };
  return { root, q, sidecar, evidence, base, modules, options };
}

it('새 제작 배치를 반영하지 않고 S1 계획과 독립 검수에 연결한다', async () => {
  const f = setup();
  const runtime = await createGateRuntime(f.options, f.modules);
  const plan = await runGate({ ...f.options, plan: true }, runtime);
  expect(plan.NEW.next).toEqual({ stage: 'S1', target: 1 });
  const respond = vi.fn(async (r: { phase: string; items: Array<{ questionId: string; revision: number; source?: { evidenceText: string } }> }) => ({ out: JSON.stringify({ items: r.items.map(q => ({ questionId: q.questionId, revision: q.revision, blindChoice: 'a', verdicts: { source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'pass' }, findings: [] })) }), err: '' }));
  const rows = await runStagedQuestions(f.root, 'codex', [{ batchId: 'NEW', questionId: f.q.id, revision: f.q.revision }], () => {}, { ...f.options, respond }, f.modules);
  expect(rows[0].merged).toBe(1);
  expect(respond.mock.calls.map(([r]) => r.phase)).toEqual(['blind', 'reveal']);
  expect(respond.mock.calls[0]![0].items[0]!.source).toBeUndefined();
  expect(respond.mock.calls[1]![0].items[0]!.source!.evidenceText).toBe(f.evidence);
  expect(fs.existsSync(path.join(f.root, 'content-source'))).toBe(false);
});

it('공개 대조와 수정 모두 staging 사전 근거를 읽고 손상된 근거는 거절한다', () => {
  const f = setup();
  expect(revealItem(bank, f.root, 'NEW', f.q, { blindChoice: 'a', findings: [] }).source.evidenceText).toBe(f.evidence);
  expect(promptFor(f.root, 'NEW', [{ q: f.q, phase: 'front', rounds: {}, reasons: [], findings: [] }])).toContain(f.evidence);
  fs.writeFileSync(path.join(f.base, 'files/content-source/batches/NEW/evidence', f.q.source.evidenceArtifactId), '변조');
  expect(() => revealItem(bank, f.root, 'NEW', f.q, { blindChoice: 'a', findings: [] })).toThrow('해시 불일치');
  expect(() => promptFor(f.root, 'NEW', [{ q: f.q, phase: 'front', rounds: {}, reasons: [], findings: [] }])).toThrow('해시 불일치');
});
