import fs from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import * as bank from '../../tools/content/bankBuild';
// @ts-expect-error MJS 선언 없음
import { finalizeCodex } from '../../tools/orchestrate/finalize-codex.mjs';
// @ts-expect-error MJS 선언 없음
import { revealItem } from '../../tools/orchestrate/review.mjs';
// @ts-expect-error MJS 선언 없음
import { flagged } from '../../tools/orchestrate/revise.mjs';

vi.mock('node:child_process', () => ({ spawn: () => { throw new Error('실제 모델 호출 금지'); } }));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const verdicts = { source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'pass' } as const;
function write(root: string, relative: string, value: unknown) { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); }
function fixture() {
  const root = fs.mkdtempSync(path.resolve('.orchestrate/finalize-test-')); roots.push(root);
  const batch = structuredClone(bank.loadBatches(process.cwd()).find(b => b.batchId === 'Q20-001')!);
  const q = batch.drafts.find(q => q.id === 'g3-argon-0001')!;
  batch.drafts = [q];
  const item = batch.reviews.codex!.items.find(i => i.questionId === q.id)!;
  item.run = { id: 'actual-blind-run', model: 'gpt-6-astra', effort: 'high' };
  item.verdicts = { ...verdicts };
  batch.reviews.codex!.items = [item];
  batch.reviews.codex!.reviewer.model = 'gpt-6-astra';
  write(root, `content-source/approvals/${batch.batchId}.explanation.json`, batch.explanation);
  const runtime = { ids: [batch.batchId], batch: () => batch, snapshot: () => ({ drafts: [q], levelPending: [], codexPending: [], argonPending: [],
    front: { batchDefects: [], items: [{ questionId: q.id, revision: q.revision, contentHash: bank.contentHash(q), status: 'pass', defects: [], pending: [] }] } }) };
  const options = { root, batches: batch.batchId, 'codex-model': 'gpt-6-astra', 'codex-effort': 'high' };
  const respond = vi.fn(async () => ({ out: JSON.stringify({ items: [{ questionId: q.id, revision: q.revision, verdicts, findings: [] }] }), err: '' }));
  return { root, batch, q, item, runtime, options, respond };
}
function staged(f: ReturnType<typeof fixture>, row: { staging: string }) {
  const file = `content-source/approvals/${f.batch.batchId}.explanation.json`;
  return JSON.parse(fs.readFileSync(path.join(f.root, row.staging, 'files', file), 'utf8'));
}
function cache(f: ReturnType<typeof fixture>) {
  const dir = `.orchestrate/review/codex/${f.batch.batchId}`;
  const config = { model: 'gpt-6-astra', effort: 'high' };
  write(f.root, `${dir}/reveal.input.json`, { config, items: [revealItem(bank, f.root, f.batch.batchId, f.q, f.item)] });
  write(f.root, `${dir}/reveal.result.json`, { config, items: [{ questionId: f.q.id, revision: f.q.revision, contentHash: bank.contentHash(f.q), verdicts, findings: [] }] });
}

it('기존 독립 풀이를 보존하고 Codex 공개 대조만 호출해 승인 근거를 staging에 쓴다', async () => {
  const f = fixture(), before = JSON.stringify(f.batch.reviews.codex);
  const [row] = await finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond });
  expect(f.respond).toHaveBeenCalledTimes(1);
  expect(f.respond).toHaveBeenCalledWith(expect.objectContaining({ reviewer: 'codex', phase: 'reveal' }));
  expect(JSON.stringify(f.batch.reviews.codex)).toBe(before);
  expect(row).toMatchObject({ merged: 1, flagged: 0, reused: 0 });
  expect(staged(f, row).items[0]).toMatchObject({ rationalesHash: bank.rationalesHash(f.q), explanation: 'pass', run: { model: 'gpt-6-astra', effort: 'high' } });
  const side = JSON.parse(fs.readFileSync(path.join(f.root, row.staging, 'files', `content-source/batches/${f.batch.batchId}/sidecar.json`), 'utf8'));
  expect(side.publicationPolicy).toBe('codex-argon-v1');
  expect(JSON.parse(fs.readFileSync(path.join(f.root, `content-source/approvals/${f.batch.batchId}.explanation.json`), 'utf8')).reviewer.model).not.toBe('gpt-6-astra');
});

it('실제 입력·결과·모델이 맞는 기존 Codex 공개 대조는 추가 호출 없이 재사용한다', async () => {
  const f = fixture(); cache(f);
  const [row] = await finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond });
  expect(f.respond).not.toHaveBeenCalled();
  expect(row).toMatchObject({ merged: 1, flagged: 0, reused: 1 });
  expect(staged(f, row).items[0].run.id).toBe('actual-blind-run');
});

it('오답 이유가 바뀐 캐시는 재사용하지 않고 현재 해설을 다시 대조한다', async () => {
  const f = fixture(); cache(f); f.q.distractorRationales.b = '바뀐 이유예요.';
  const [row] = await finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond });
  expect(f.respond).toHaveBeenCalledTimes(1);
  expect(row.reused).toBe(0);
  expect(staged(f, row).items[0].rationalesHash).toBe(bank.rationalesHash(f.q));
});

it('실행 출처가 없는 과거 검수는 최종 대조 전에 거절한다', async () => {
  const f = fixture(); delete f.item.run;
  await expect(finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond })).rejects.toThrow('강한 Codex 독립 풀이 근거 없음');
  expect(f.respond).not.toHaveBeenCalled();
  expect(fs.existsSync(path.join(f.root, '.orchestrate/staging'))).toBe(false);
});

it('항목 출처 도입 전의 2단계 보고서는 독립 풀이를 재호출하지 않고 새 대조 출처만 기록한다', async () => {
  const f = fixture(); delete f.item.run;
  f.batch.reviews.codex!.reviewer.tool = '2단계 블라인드 검수(tools/orchestrate/review.mjs)';
  const [row] = await finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond });
  expect(f.respond).toHaveBeenCalledTimes(1);
  expect(f.respond).toHaveBeenCalledWith(expect.objectContaining({ phase: 'reveal' }));
  expect(f.item.run).toBeUndefined();
  expect(staged(f, row).items[0].run).toMatchObject({ model: 'gpt-6-astra', effort: 'high' });
});

it('예전 해설 uncertain은 실제 Codex 대조 통과 후에만 채우고 독립 풀이 출처는 보존한다', async () => {
  const f = fixture(); f.item.verdicts.explanation = 'uncertain';
  const [row] = await finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond });
  const report = JSON.parse(fs.readFileSync(path.join(f.root, row.staging, 'files', `content-source/reviews/${f.batch.batchId}/codex.json`), 'utf8'));
  expect(report.items[0]).toMatchObject({ blindChoice: f.item.blindChoice, run: f.item.run, verdicts: { explanation: 'pass' } });
  expect(f.item.verdicts.explanation).toBe('uncertain');
});

it('새 공개 대조의 실제 오류는 실패 근거로 남겨 수정 대상으로 돌린다', async () => {
  const f = fixture();
  f.respond.mockImplementation(async () => ({ out: JSON.stringify({ items: [{ questionId: f.q.id, revision: f.q.revision, verdicts: { ...verdicts, source: 'fail' }, findings: ['근거와 뜻이 다름'] }] }), err: '' }));
  const [row] = await finalizeCodex(f.options, { runtime: f.runtime, bank, respond: f.respond });
  expect(row.flagged).toBe(1);
  expect(staged(f, row).items[0]).toMatchObject({ explanation: 'fail', findings: ['Codex 최종 대조: source fail', '근거와 뜻이 다름'] });
  f.batch.sidecar.publicationPolicy = 'codex-argon-v1';
  f.batch.explanation = staged(f, row);
  f.batch.reviews.claude!.items.find(i => i.questionId === f.q.id)!.findings = ['옛 Claude 지적'];
  const issues = flagged({ b: bank, front: { frontGate: () => f.runtime.snapshot().front } }, f.batch, { reviseLog: { items: {} } });
  expect(issues[0]).toMatchObject({ phase: 'gate', reasons: ['Codex 해설 대조 fail'] });
  expect(issues[0].findings).toContain('codex-finalize: 근거와 뜻이 다름');
  expect(issues[0].findings.join(' ')).not.toContain('옛 Claude 지적');
});
