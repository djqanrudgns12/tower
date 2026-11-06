import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { blindReviewSchema, explanationReviewSchema } from '../../src/contracts/questionDraft';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { resolveReviewConfig, assertPhaseConfig, existingReportArchive, claudeCliArgs, codexCliArgs, buildPhase, acceptPhase, ingest, pending } from '../../tools/orchestrate/review.mjs';

const sonnet = { model: 'claude-sonnet-5-5', effort: 'high' };
const astra = { model: 'gpt-6-astra', effort: 'high' };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('검수자 설정 해석', () => {
  it('기존 기본값을 유지한다', () => {
    expect(resolveReviewConfig({}, {})).toEqual({
      claude: { model: 'claude-opus-5-5', effort: 'high' },
      codex: { model: 'gpt-6.1-sol', effort: 'xhigh' },
      antigravity: { model: 'Gemini 4 Argon (High)', effort: 'high' },
    });
  });
  it('각 필드에서 CLI > 환경변수 > 기본값을 적용한다', () => {
    const config = resolveReviewConfig({ 'claude-model': sonnet.model, 'codex-effort': 'high' }, {
      REVIEW_CLAUDE_MODEL: 'claude-env', REVIEW_CLAUDE_EFFORT: 'max',
      REVIEW_CODEX_MODEL: astra.model, REVIEW_CODEX_EFFORT: 'low',
    });
    expect(config.claude).toEqual({ model: sonnet.model, effort: 'max' });
    expect(config.codex).toEqual(astra);
  });
  it.each([
    ['claude-model', 'gpt-6-astra'], ['codex-model', 'claude-sonnet-5-5'],
    ['claude-model', true], ['codex-model', ''], ['claude-effort', 'minimal'],
    ['codex-effort', 'max'], ['claude-effort', true], ['codex-effort', 'HIGH'],
  ])('잘못된 %s=%s를 거절한다', (key, value) => {
    expect(() => resolveReviewConfig({ [key]: value }, {})).toThrow(/설정 오류/);
  });
  it('환경변수의 잘못된 설정도 거절한다', () => {
    expect(() => resolveReviewConfig({}, { REVIEW_CODEX_MODEL: sonnet.model })).toThrow(/codex/);
  });
  it.each(['low', 'medium', 'high', 'xhigh', 'max'])('Claude effort %s 허용', effort => {
    expect(resolveReviewConfig({ 'claude-effort': effort }, {}).claude.effort).toBe(effort);
  });
  it.each(['minimal', 'low', 'medium', 'high', 'xhigh'])('Codex effort %s 허용', effort => {
    expect(resolveReviewConfig({ 'codex-effort': effort }, {}).codex.effort).toBe(effort);
  });
  it('실제 CLI가 사용하는 인자에 모델·effort와 블라인드 제한을 함께 담는다', () => {
    expect(claudeCliArgs(sonnet)).toEqual([
      '-p', '--output-format', 'json', '--model', sonnet.model, '--effort', 'high',
      '--disallowedTools', 'Bash', 'Read', 'Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit',
      'WebFetch', 'WebSearch', 'Agent', 'Task',
    ]);
    expect(codexCliArgs('/sealed', '/sealed/out.md', astra)).toEqual([
      'exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'read-only',
      '-C', '/sealed', '-o', '/sealed/out.md', '-m', astra.model, '-c', 'model_reasoning_effort="high"', '-',
    ]);
  });
});

describe('설정 봉인·기존 보고서 출처', () => {
  it('같은 설정만 허용하고 기록이 없는 옛 결과도 거절한다', () => {
    expect(() => assertPhaseConfig(sonnet, sonnet, 'blind')).not.toThrow();
    for (const saved of [undefined, { ...sonnet, effort: 'max' }, { ...sonnet, model: 'claude-opus-5-5' }]) {
      expect(() => assertPhaseConfig(saved, sonnet, 'blind')).toThrow(/설정/);
    }
  });
  it('기존 모델이 다르면 거절하고 명시적 보관 옵션이면 경로를 계산한다', () => {
    const old = { reviewer: { model: 'GPT 6.1 (old)' } };
    expect(() => existingReportArchive('B', 'codex', old, astra)).toThrow(/archive-existing/);
    expect(existingReportArchive('B', 'codex', old, astra, true))
      .toBe('content-source/reviews/archive/B.codex.GPT-6-1--old-.json');
    expect(existingReportArchive('B', 'codex', { reviewer: { model: astra.model } }, astra, true)).toBeNull();
  });
});

function fixture(oldModel?: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrate-config-'));
  roots.push(root);
  const item = { questionId: 'q1', revision: 1, contentHash: 'hash' };
  const draft = {
    id: 'q1', revision: 1, grade: 4, type: 'definition', target: { lemma: '낱말', partOfSpeech: '명사' },
    stem: '문제', options: [{ id: 'a', text: '답' }], correctOptionId: 'a', explanation: '해설',
    source: { evidenceArtifactId: 'missing.json' }, gradeBasis: {}, distractorRationales: {},
  };
  const report = oldModel ? { reviewer: { model: oldModel }, items: [item] } : null;
  const batch = { batchId: 'B', drafts: [draft], reviews: { claude: report } };
  const bank = { loadBatches: () => [batch], contentHash: () => 'hash', rationalesHash: () => 'rationales' };
  const dir = path.join(root, '.orchestrate/review/claude/B');
  const reportPath = path.join(root, 'content-source/reviews/B/claude.json');
  if (report) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report)); }
  const reply = (phase: string) => JSON.stringify({ items: [{ ...item, blindChoice: 'a',
    verdicts: { uniqueness: 'pass', grade: 'pass', language: 'pass', ...(phase === 'reveal' ? { source: 'pass', explanation: 'pass' } : {}) }, findings: [],
  }] });
  return { root, item, bank, batch, dir, reportPath, reply };
}

describe('모델 호출 없는 단계 통합', () => {
  it('새 항목과 해설 대조에 같은 실행 출처를 기록하고 기존 항목은 보존한다', async () => {
    const f = fixture();
    const previousRun = { id: 'previous-run', ...sonnet };
    const legacy = { ...f.item, questionId: 'legacy', blindChoice: 'a', verdicts: {
      source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'pass',
    }, findings: [] };
    const prior = { ...legacy, questionId: 'prior', run: previousRun };
    const oldReport = { reviewId: 'old', jobId: 'B', reviewer: {
      model: sonnet.model, tool: 'old', freshContext: true, date: '2026-11-06',
    }, items: [legacy, prior] };
    fs.mkdirSync(path.dirname(f.reportPath), { recursive: true });
    fs.writeFileSync(f.reportPath, JSON.stringify(oldReport));
    const config = { ...sonnet, effort: 'xhigh' };
    for (const phase of ['blind', 'reveal']) {
      const { items } = await buildPhase(f.bank, f.root, 'claude', 'B', phase, { config });
      acceptPhase(f.root, 'claude', 'B', phase, f.reply(phase), items, { config });
    }
    const result = await ingest(f.bank, f.root, 'claude', 'B', { config });
    const stage = path.join(f.root, result.staging);
    const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'manifest.json'), 'utf8'));
    const report = JSON.parse(fs.readFileSync(path.join(stage, 'files/content-source/reviews/B/claude.json'), 'utf8'));
    const approval = JSON.parse(fs.readFileSync(path.join(stage, 'files/content-source/approvals/B.explanation.json'), 'utf8'));
    expect(report.items.find((i: { questionId: string }) => i.questionId === 'q1').run)
      .toEqual({ id: manifest.runId, ...config });
    expect(approval.items[0].run).toEqual({ id: manifest.runId, ...config });
    expect(report.items.find((i: { questionId: string }) => i.questionId === 'prior')).toEqual(prior);
    expect(report.items.find((i: { questionId: string }) => i.questionId === 'legacy')).toEqual(legacy);
    expect(JSON.parse(fs.readFileSync(f.reportPath, 'utf8'))).toEqual(oldReport);
  });
  it('보고서 스키마는 실행 출처를 보존하고 옛 항목도 허용하되 잘못된 출처는 거절한다', () => {
    const common = { questionId: 'q1', revision: 1, contentHash: 'a'.repeat(64), findings: [] };
    const run = { id: 'execution-1', ...astra };
    const item = { ...common, blindChoice: 'a', verdicts: {
      source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'pass',
    } };
    const report = { reviewId: 'R', jobId: 'B', reviewer: {
      model: astra.model, tool: 'test', freshContext: true, date: '2026-11-06',
    }, items: [item, { ...item, questionId: 'q2', run }] };
    expect(blindReviewSchema.parse(report).items[1]).toHaveProperty('run', run);
    const approval = { batchId: 'B', reviewer: { model: sonnet.model, role: 'commander', date: '2026-11-06' },
      items: [{ ...common, rationalesHash: 'b'.repeat(64), explanation: 'pass', run: { ...run, ...sonnet } }] };
    expect(explanationReviewSchema.parse(approval).items[0]).toHaveProperty('run', { ...run, ...sonnet });
    for (const invalid of [{ ...run, id: '' }, { ...run, model: '' }, { ...run, effort: 'invented' }]) {
      expect(blindReviewSchema.safeParse({ ...report, items: [{ ...item, run: invalid }] }).success).toBe(false);
      expect(explanationReviewSchema.safeParse({ ...approval, items: [{ ...approval.items[0], run: invalid }] }).success).toBe(false);
    }
  });
  it('기존 모델이 다르면 미검수 0건이어도 거절하고, 보관 시 전부 다시 검수한다', async () => {
    const f = fixture('claude-opus-5-5');
    const options = { config: sonnet };
    expect(() => pending(f.bank, f.batch, 'claude', options)).toThrow(/모델/);
    await expect(buildPhase(f.bank, f.root, 'claude', 'B', 'blind', options)).rejects.toThrow(/모델/);
    expect((await buildPhase(f.bank, f.root, 'claude', 'B', 'blind', { ...options, archiveExisting: true })).items).toHaveLength(1);
  });
  it('blind 설정을 기록하고 reveal·accept·ingest의 다른 설정을 거절한다', async () => {
    const f = fixture();
    const options = { config: sonnet };
    await buildPhase(f.bank, f.root, 'claude', 'B', 'blind', options);
    expect(() => acceptPhase(f.root, 'claude', 'B', 'blind', f.reply('blind'), [f.item], { config: { ...sonnet, effort: 'max' } })).toThrow(/설정/);
    acceptPhase(f.root, 'claude', 'B', 'blind', f.reply('blind'), [f.item], options);
    expect(JSON.parse(fs.readFileSync(path.join(f.dir, 'blind.result.json'), 'utf8')).config).toEqual(sonnet);
    await expect(buildPhase(f.bank, f.root, 'claude', 'B', 'reveal', { config: { ...sonnet, effort: 'max' } })).rejects.toThrow(/설정/);
    await buildPhase(f.bank, f.root, 'claude', 'B', 'reveal', options);
    acceptPhase(f.root, 'claude', 'B', 'reveal', f.reply('reveal'), [f.item], options);
    await expect(ingest(f.bank, f.root, 'claude', 'B', { config: { ...sonnet, model: 'claude-opus-5-5' } })).rejects.toThrow(/설정/);
    const revealPath = path.join(f.dir, 'reveal.result.json');
    const reveal = JSON.parse(fs.readFileSync(revealPath, 'utf8'));
    fs.writeFileSync(revealPath, JSON.stringify({ ...reveal, config: { ...sonnet, effort: 'max' } }));
    await expect(ingest(f.bank, f.root, 'claude', 'B', options)).rejects.toThrow(/설정/);
  });
  it('보관 원문과 새 모델 보고서를 staging에만 쓰고 manifest 해시를 맞춘다', async () => {
    const f = fixture('claude-opus-5-5');
    const original = fs.readFileSync(f.reportPath, 'utf8');
    const options = { config: sonnet, archiveExisting: true };
    for (const phase of ['blind', 'reveal']) {
      const { items } = await buildPhase(f.bank, f.root, 'claude', 'B', phase, options);
      acceptPhase(f.root, 'claude', 'B', phase, f.reply(phase), items, options);
    }
    await expect(ingest(f.bank, f.root, 'claude', 'B', { config: sonnet })).rejects.toThrow(/archive-existing/);
    const result = await ingest(f.bank, f.root, 'claude', 'B', options);
    expect(result).toMatchObject({ merged: 1, flagged: 0 });
    expect(fs.readFileSync(f.reportPath, 'utf8')).toBe(original);
    const stage = path.join(f.root, result.staging);
    const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ batchId: 'B', tool: 'review', model: sonnet.model, deletes: [] });
    expect(manifest.runId).toMatch(/^\d{8}T\d{9}Z-/);
    expect(manifest.writes).toHaveLength(3);
    for (const write of manifest.writes) {
      const bytes = fs.readFileSync(path.join(stage, 'files', write.path));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(write.sha256);
    }
    expect(fs.readFileSync(path.join(stage, 'files/content-source/reviews/archive/B.claude.claude-opus-5-5.json'), 'utf8')).toBe(original);
    const report = JSON.parse(fs.readFileSync(path.join(stage, 'files/content-source/reviews/B/claude.json'), 'utf8'));
    expect(report.reviewer.model).toBe(sonnet.model);
    expect(report.items).toHaveLength(1);
    const approval = JSON.parse(fs.readFileSync(path.join(stage, 'files/content-source/approvals/B.explanation.json'), 'utf8'));
    expect(approval.reviewer.model).toBe(sonnet.model);
    expect(fs.existsSync(path.join(f.root, 'content-source/approvals/B.explanation.json'))).toBe(false);
  });
});
