import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as d from '../../src/contracts/questionDraft';
import * as contracts from '../../src/contracts/levels';
import type { LevelJudge } from '../../src/contracts/levels';
import * as lint from '../../src/content/lint';
import * as b from '../../tools/content/bankBuild';
import * as front from '../../tools/content/frontGate';
import * as levels from '../../tools/content/levels';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { runGate, gatePrimary, createGateRuntime } from '../../tools/orchestrate/content-loop.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { buildPhase, acceptPhase, ingest } from '../../tools/orchestrate/review.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { gatePassedKeys, flagged } from '../../tools/orchestrate/revise.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { runLevels, liveRespond } from '../../tools/orchestrate/level.mjs';

// 이 파일의 어떤 경로도 실제 모델·git·프로세스를 부르면 안 된다.
vi.mock('node:child_process', () => {
  const deny = () => { throw new Error('시험 중 실제 프로세스 호출 금지'); };
  return { spawn: deny, spawnSync: deny, exec: deny, execSync: deny, execFile: deny, execFileSync: deny, fork: deny };
});

const repo = path.resolve(import.meta.dirname, '../..');
const roots: string[] = [];
afterEach(() => { for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const tempRoot = (prefix: string) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); roots.push(dir); return dir; };
const writeFile = (dir: string, relative: string, value: unknown) => {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
};
const readRepo = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

/** 정책 없는 Q20-001(공개 승인 51개에 포함). 메모리 사본만 바꾸고 추적 콘텐츠에는 쓰지 않는다. */
const pilotId = 'Q20-001';
const qid = 'g3-argon-0001';
const legacy: b.BatchInput = {
  batchId: pilotId,
  drafts: d.draftBatchSchema.parse(readRepo(`content-source/batches/${pilotId}/drafts.json`)),
  sidecar: d.draftSidecarSchema.parse(readRepo(`content-source/batches/${pilotId}/sidecar.json`)),
  reviews: {
    codex: d.blindReviewSchema.parse(readRepo(`content-source/reviews/${pilotId}/codex.json`)),
    claude: d.blindReviewSchema.parse(readRepo(`content-source/reviews/${pilotId}/claude.json`)),
  },
  argonBlind: null,
  explanation: d.explanationReviewSchema.parse(readRepo(`content-source/approvals/${pilotId}.explanation.json`)),
};
const opusRun = { id: 'test-claude-run', model: 'claude-opus-5-5', effort: 'high' as const };
const astraRun = { id: 'test-codex-run', model: 'gpt-6-astra', effort: 'high' as const };
const STRONG_CLAUDE = 'claude: claude-opus high 이상 실행 출처 필요';
const STRONG_CLAUDE_EXPLANATION = 'Claude 해설 대조: claude-opus high 이상 실행 출처 필요';

/** 한 문항짜리 정책 배치. 정책 검토자의 보고서·해설 대조만 남기고 강한 실행 출처를 붙인다. */
function policyBatch(policy: 'codex-argon-v1' | 'claude-argon-v1'): b.BatchInput {
  const who = policy === 'claude-argon-v1' ? 'claude' : 'codex';
  const run = who === 'claude' ? opusRun : astraRun;
  const batch = structuredClone(legacy);
  batch.drafts = batch.drafts.filter(q => q.id === qid);
  batch.sidecar.items = batch.sidecar.items.filter(q => q.id === qid);
  batch.sidecar.publicationPolicy = policy;
  const report = batch.reviews[who]!;
  report.items = report.items.filter(i => i.questionId === qid);
  report.reviewer.model = run.model;
  report.items[0]!.run = { ...run };
  report.items[0]!.verdicts.explanation = 'pass';
  delete batch.reviews[who === 'claude' ? 'codex' : 'claude'];
  batch.explanation!.items = batch.explanation!.items.filter(i => i.questionId === qid);
  batch.explanation!.reviewer.model = run.model;
  batch.explanation!.items[0]!.run = { ...run };
  return batch;
}
const claudeBatch = () => policyBatch('claude-argon-v1');
const codexBatch = () => policyBatch('codex-argon-v1');

function quarantined(batch: b.BatchInput, reason: string) {
  const decisions = b.decide(batch);
  expect(decisions[0]!.decision).toBe('quarantined');
  expect(decisions[0]!.reasons).toContain(reason);
  // 정책 배치는 후보 경로로도 같은 기준을 우회하지 못한다.
  expect(b.decideCandidate(batch)).toEqual(decisions);
}

describe('claude-argon-v1 공개 판정', () => {
  it.each(['high', 'xhigh', 'max'] as const)('Codex 없이 강한 Claude Opus(%s) 독립 풀이·해설 대조로 승인한다', effort => {
    const batch = claudeBatch();
    batch.reviews.claude!.items[0]!.run!.effort = effort;
    batch.explanation!.items[0]!.run!.effort = effort;
    expect(b.decide(batch)).toEqual([expect.objectContaining({ questionId: qid, decision: 'approved', reasons: [] })]);
    expect(b.decideCandidate(batch)).toEqual(b.decide(batch));
  });

  it('Codex 보고서만 있으면 Claude 독립 검토 없음으로 격리한다', () => {
    const batch = claudeBatch();
    batch.reviews.codex = structuredClone(codexBatch().reviews.codex!);
    delete batch.reviews.claude;
    const [decision] = b.decide(batch);
    expect(decision).toMatchObject({ decision: 'quarantined', reasons: ['claude: 이 revision의 독립 검토 없음'] });
  });

  it('같은 배치의 Codex fail 보고서는 Claude 정책 승인에 관여하지 않는다', () => {
    const batch = claudeBatch();
    batch.reviews.codex = structuredClone(codexBatch().reviews.codex!);
    for (const item of batch.reviews.codex.items) {
      item.blindChoice = 'none';
      item.verdicts.source = 'fail';
      item.verdicts.explanation = 'fail';
    }
    expect(b.decide(batch)[0]).toMatchObject({ decision: 'approved', reasons: [] });
  });

  it.each([
    ['Sonnet 실행', (run: NonNullable<d.BlindReview['items'][number]['run']>) => { run.model = 'claude-sonnet-5-5'; }],
    ['effort medium', (run: NonNullable<d.BlindReview['items'][number]['run']>) => { run.effort = 'medium'; }],
    ['effort low', (run: NonNullable<d.BlindReview['items'][number]['run']>) => { run.effort = 'low'; }],
    ['Codex 모델 실행', (run: NonNullable<d.BlindReview['items'][number]['run']>) => { run.model = 'gpt-6-astra'; }],
  ] as const)('독립 풀이의 %s는 격리한다', (_label, change) => {
    const batch = claudeBatch();
    change(batch.reviews.claude!.items[0]!.run!);
    quarantined(batch, STRONG_CLAUDE);
  });

  it('Codex와 달리 항목 실행 출처가 없으면 2단계 도구 보고서여도 격리한다', () => {
    const batch = claudeBatch();
    delete batch.reviews.claude!.items[0]!.run;
    batch.reviews.claude!.reviewer.tool = '2단계 블라인드 검수(tools/orchestrate/review.mjs)';
    quarantined(batch, STRONG_CLAUDE);
  });

  it('새 문맥이 아닌 Claude 보고서는 격리한다', () => {
    const batch = claudeBatch();
    Object.assign(batch.reviews.claude!.reviewer, { freshContext: false });
    quarantined(batch, 'claude: freshContext true 필요');
  });

  it('독립 풀이가 정답과 다르면 격리한다', () => {
    const batch = claudeBatch();
    batch.reviews.claude!.items[0]!.blindChoice = 'multiple';
    quarantined(batch, 'claude: 독립 풀이 multiple ≠ 정답');
  });

  it.each(['source', 'uniqueness', 'grade', 'language', 'explanation'] as const)('Claude %s는 pass여야 한다(uncertain 격리)', key => {
    const batch = claudeBatch();
    batch.reviews.claude!.items[0]!.verdicts[key] = 'uncertain';
    quarantined(batch, `claude: ${key} uncertain`);
  });

  it.each(['gpt-6-astra 검토자', 'Sonnet 실행', 'effort medium', 'run 없음'] as const)('해설 대조의 %s는 격리한다', kind => {
    const batch = claudeBatch();
    const exp = batch.explanation!.items[0]!;
    if (kind === 'gpt-6-astra 검토자') batch.explanation!.reviewer.model = 'gpt-6-astra';
    if (kind === 'Sonnet 실행') exp.run!.model = 'claude-sonnet-5-5';
    if (kind === 'effort medium') exp.run!.effort = 'medium';
    if (kind === 'run 없음') delete exp.run;
    quarantined(batch, STRONG_CLAUDE_EXPLANATION);
  });

  it('오답 이유만 바뀌어도 이전 Claude 해설 대조는 근거가 아니다', () => {
    const batch = claudeBatch();
    const draft = batch.drafts[0]!;
    const before = b.contentHash(draft);
    const wrong = draft.options.find(o => o.id !== draft.correctOptionId)!.id;
    draft.distractorRationales[wrong] += ' 추가 확인이 필요해요.';
    expect(b.contentHash(draft)).toBe(before);
    quarantined(batch, 'Claude 해설 대조 없음');
  });

  it('해설 대조 fail은 지적을 붙인 총괄 해설 대조 fail 사유로 격리한다', () => {
    const batch = claudeBatch();
    Object.assign(batch.explanation!.items[0]!, { explanation: 'fail', findings: ['오답 b의 이유가 사전 뜻과 달라요', '해설이 너무 길어요'] });
    const [decision] = b.decide(batch);
    expect(decision).toMatchObject({ decision: 'quarantined', reasons: ['총괄 해설 대조 fail: 오답 b의 이유가 사전 뜻과 달라요 / 해설이 너무 길어요'] });
  });

  it.each(['strong', 'sonnet', 'medium', 'gpt-explanation', 'explanation-fail', 'codex-only'] as const)('수정기의 관문 통과 판단(%s)은 공개 판정과 같다', kind => {
    const batch = claudeBatch();
    if (kind === 'sonnet') batch.reviews.claude!.items[0]!.run!.model = 'claude-sonnet-5-5';
    if (kind === 'medium') batch.explanation!.items[0]!.run!.effort = 'medium';
    if (kind === 'gpt-explanation') batch.explanation!.reviewer.model = 'gpt-6-astra';
    if (kind === 'explanation-fail') batch.explanation!.items[0]!.explanation = 'fail';
    if (kind === 'codex-only') { batch.reviews.codex = structuredClone(codexBatch().reviews.codex!); delete batch.reviews.claude; }
    const approved = b.decide(batch)[0]!.decision === 'approved';
    expect(approved).toBe(kind === 'strong');
    expect((gatePassedKeys({ b }, batch) as Set<string>).has(`${qid}@1`)).toBe(approved);
  });
});

describe('기존 정책 보존·레지스트리 규칙 문구', () => {
  it('Claude 근거는 codex-argon-v1·legacy 승인을 대신하지 못하고, codex-argon-v1 승인은 그대로다', () => {
    expect(b.decide(codexBatch())[0]).toMatchObject({ decision: 'approved', reasons: [] });
    const asCodex = claudeBatch();
    asCodex.sidecar.publicationPolicy = 'codex-argon-v1';
    const codexReasons = b.decide(asCodex)[0]!.reasons;
    expect(codexReasons).toContain('codex: 이 revision의 독립 검토 없음');
    expect(codexReasons).toContain('Codex 해설 대조: gpt-6-astra high/xhigh 실행 출처 필요');
    const asLegacy = claudeBatch();
    delete asLegacy.sidecar.publicationPolicy;
    expect(b.decide(asLegacy)[0]).toMatchObject({ decision: 'quarantined', reasons: ['codex: 이 revision의 독립 검토 없음'] });
  });

  it('Claude 정책 배치가 없으면 규칙 문구가 추적 레지스트리와 같고, 있으면 Claude 규칙만 덧붙는다', () => {
    const stored = readRepo('content-source/approvals/registry.json') as b.Registry;
    // 2026-11-09부터 추적 은행에 claude-argon-v1 배치가 있다. 기존 codex 규칙은 바이트 그대로 앞에 두고 Claude 규칙만 덧붙는다.
    expect(stored.rule).toBe(`${b.RULE} ${b.CLAUDE_RULE}`);
    expect(b.buildRegistry([codexBatch()]).rule).toBe(b.RULE);
    const mixed = b.buildRegistry([codexBatch(), claudeBatch()]);
    expect(mixed.rule).toBe(`${b.RULE} ${b.CLAUDE_RULE}`);
    expect(mixed.approved).toBe(2);
    const legacyRule = b.buildRegistry([legacy]).rule;
    expect(legacyRule).not.toContain('claude-argon-v1');
    expect(b.buildRegistry([legacy, claudeBatch()]).rule).toBe(`${legacyRule} ${b.CLAUDE_RULE}`);
    expect(b.buildCandidateRegistry([codexBatch()]).rule).toBe(b.CANDIDATE_RULE);
    expect(b.buildCandidateRegistry([codexBatch(), claudeBatch()]).rule).toBe(`${b.CANDIDATE_RULE} ${b.CLAUDE_CANDIDATE_RULE}`);
  });

  it('loadBatches는 Claude 정책 배치의 깨진 codex.json을 읽지 않고, 정책 없는 배치는 읽는다', () => {
    const root = tempRoot('claude-policy-load-');
    const batch = claudeBatch();
    writeFile(root, `content-source/batches/${pilotId}/drafts.json`, batch.drafts);
    writeFile(root, `content-source/batches/${pilotId}/sidecar.json`, batch.sidecar);
    writeFile(root, `content-source/reviews/${pilotId}/claude.json`, batch.reviews.claude);
    writeFile(root, `content-source/reviews/${pilotId}/codex.json`, '{ 깨진 보고서');
    writeFile(root, `content-source/approvals/${pilotId}.explanation.json`, batch.explanation);
    const [loaded] = b.loadBatches(root);
    expect(Object.keys(loaded!.reviews)).toEqual(['claude']);
    expect(b.decide(loaded!)[0]).toMatchObject({ decision: 'approved', reasons: [] });
    const legacySidecar = structuredClone(batch.sidecar);
    delete legacySidecar.publicationPolicy;
    writeFile(root, `content-source/batches/${pilotId}/sidecar.json`, legacySidecar);
    expect(() => b.loadBatches(root)).toThrow();
  });
});

/** levels.test.ts와 같은 수준 판정 고정 문항. */
function levelQuestion(grade = 4): d.QuestionDraft {
  return {
    schemaVersion: '0.2', batchId: 'LEVEL-TEST', id: `g${grade}-test-0001`, revision: 1,
    status: 'draft', grade, type: 'cloze', variantTag: 'standard',
    gradeBasis: { reference: '수준 판정', editionYear: 2022, unit: 'stdict:전문어 표지 없음', reviewed: false },
    target: { lemma: '시험어', partOfSpeech: '명사', senseKey: '시험어/명사/1' },
    stem: '가'.repeat(43),
    options: [{ id: 'a', text: '나' }, { id: 'b', text: '다' }, { id: 'c', text: '라' }, { id: 'd', text: '마' }],
    correctOptionId: 'a', explanation: '시험 해설', distractorRationales: { b: '이유', c: '이유', d: '이유' },
    source: {
      provider: 'stdict', entryId: '1', senseId: '1', senseOrder: 1,
      url: 'https://stdict.korean.go.kr/', retrievedAt: '2026-11-05T00:00:00Z', license: '출처 표시',
      evidenceHash: 'a'.repeat(64), evidenceArtifactId: 'test',
    },
    review: { reviewerId: null, reviewedAt: null },
  };
}
function levelJudge(q: d.QuestionDraft, who: LevelJudge['judge'], change: Partial<LevelJudge> = {}): LevelJudge {
  return {
    questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), judge: who, model: `${who}-test`,
    L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null, elementaryFit: 'pass',
    basisType: 'stdict_structural', unit: 'stdict:전문어 표지 없음', reason: '점수 경계 시험', ...change,
  };
}

describe('수준 합의: Argon + Claude', () => {
  it('Argon·Claude 합의는 계약을 통과하고, Argon 없는 Codex·Claude 조합은 거부한다', () => {
    const q = levelQuestion();
    const item = levels.assessLevel(q, levelJudge(q, 'claude'), levelJudge(q, 'argon'));
    expect(item.judges.map(j => j.judge)).toEqual(['argon', 'claude']);
    expect(contracts.levelAssessmentSchema.safeParse(item).success).toBe(true);
    expect(levels.isCurrentLevelAssessment(q, item)).toBe(true);
    expect(() => levels.assessLevel(q, levelJudge(q, 'codex'), levelJudge(q, 'claude'))).toThrow();
    expect(contracts.levelAssessmentSchema.safeParse({ ...item, judges: [levelJudge(q, 'claude'), levelJudge(q, 'codex')] }).success).toBe(false);
    expect(contracts.levelAssessmentSchema.safeParse({ ...item, judges: [levelJudge(q, 'claude'), levelJudge(q, 'claude')] }).success).toBe(false);
  });

  it.each([
    [1, 3, { L1: 0, L2: 0, elementaryFit: 'too_low' as const }, { L1: 3, L2: 3, T1: 3 }],
    [2, 4, {}, { L1: 3, L2: 2 }],
    [3, 4, { L1: 1, L2: 1, T1: 1 }, { L1: 1, L2: 2, T1: 2 }],
    [4, 4, { L1: 1, L2: 1 }, { L1: 2, L2: 2 }],
  ] as const)('규칙 %i(%i학년): 판정자 이름만 다른 입력은 Codex와 같은 합의를 낸다', (rule, grade, a, c) => {
    const q = levelQuestion(grade);
    const argon = levelJudge(q, 'argon', a);
    const withCodex = levels.assessLevel(q, argon, levelJudge(q, 'codex', c));
    const withClaude = levels.assessLevel(q, argon, levelJudge(q, 'claude', c));
    expect(withClaude.merged.rule).toBe(rule);
    expect(withClaude.merged).toEqual(withCodex.merged);
    expect(levels.merge(q, argon, levelJudge(q, 'claude', c))).toEqual(levels.merge(q, argon, levelJudge(q, 'codex', c)));
    // 판정자가 다르면 같은 점수여도 다른 합의다(Codex 합의를 Claude 합의로 재사용하지 않는다).
    expect(withClaude.levelAssessmentHash).not.toBe(withCodex.levelAssessmentHash);
  });
});

describe('S1 실행기: level-judge claude', () => {
  type LevelRequest = { judge: string; config: { model: string; effort: string }; cwd: string; items: Array<{ questionId: string; revision: number }> };
  const runnerModules = { d, contracts, levels, lint };
  function runnerSetup() {
    const root = tempRoot('claude-level-');
    const q: d.QuestionDraft = { ...levelQuestion(), batchId: 'A', stem: '친구와 한 (    )을 지켜요.', target: { lemma: '약속', partOfSpeech: '명사', senseKey: '약속/명사/1' },
      options: [{ id: 'a', text: '약속' }, { id: 'b', text: '연필' }, { id: 'c', text: '신발' }, { id: 'd', text: '하늘' }] };
    writeFile(root, 'content-source/batches/A/drafts.json', [q]);
    const respond = vi.fn(async (r: LevelRequest) => JSON.stringify({ items: r.items.map(item => ({
      questionId: item.questionId, revision: item.revision, L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null,
      elementaryFit: 'pass', basisType: 'stdict_structural', unit: 'stdict:전문어 표지 없음', reason: `${r.judge} 판정 근거`,
    })) }));
    return { root, respond };
  }

  it('두 번째 판정자를 Claude Opus로 부르고 Argon·Claude 합의를 staging에 쓴다', async () => {
    const { root, respond } = runnerSetup();
    const [result] = await runLevels({ root, batches: 'A', 'level-judge': 'claude', 'skip-level-spotcheck': true }, { modules: runnerModules, respond });
    expect(respond.mock.calls.map(([r]) => r.judge).sort()).toEqual(['argon', 'claude']);
    expect(respond.mock.calls.find(([r]) => r.judge === 'claude')![0].config).toEqual({ model: 'claude-opus-5-5', effort: 'high' });
    const dir = path.join(root, result.staging);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.model).toBe('argon=Gemini 4 Argon (High);claude=claude-opus-5-5');
    const saved = contracts.levelBatchSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, 'files/content-source/levels/A.json'), 'utf8')));
    expect(saved.items[0]!.judges.map(j => [j.judge, j.model])).toEqual([['argon', 'Gemini 4 Argon (High)'], ['claude', 'claude-opus-5-5']]);
    const staged = d.draftBatchSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, 'files/content-source/batches/A/drafts.json'), 'utf8')));
    expect(levels.isCurrentLevelAssessment(staged[0]!, saved.items[0])).toBe(true);
  });

  it('알 수 없는 두 번째 판정자는 모델 호출 전에 거절한다', async () => {
    const { root, respond } = runnerSetup();
    await expect(runLevels({ root, batches: 'A', 'level-judge': 'gemini' }, { modules: runnerModules, respond })).rejects.toThrow('--level-judge');
    expect(respond).not.toHaveBeenCalled();
  });

  it('실제 응답기는 Claude 판정을 주입한 Claude CLI로 보내고 실패를 감추지 않는다', async () => {
    const config = { model: 'claude-opus-5-5', effort: 'high' };
    const claudeCli = vi.fn(async () => ({ code: 0, out: '{"items":[]}', err: '' }));
    await expect(liveRespond({ judge: 'claude', cwd: '/sealed', prompt: 'P', config }, { claudeCli })).resolves.toBe('{"items":[]}');
    expect(claudeCli).toHaveBeenCalledWith('/sealed', 'P', 1800, config);
    claudeCli.mockResolvedValueOnce({ code: 1, out: '', err: 'boom' });
    await expect(liveRespond({ judge: 'claude', cwd: '/sealed', prompt: 'P', config }, { claudeCli })).rejects.toThrow('판정 실행 실패(1)');
    claudeCli.mockResolvedValueOnce({ code: 0, out: '실행 실패: error_max_turns', err: '' });
    await expect(liveRespond({ judge: 'claude', cwd: '/sealed', prompt: 'P', config }, { claudeCli })).rejects.toThrow('판정 실행 실패');
  });
});

/** front-gate.test.ts와 같은 한 문항 앞단 고정 자료. 두 검토자 보고서를 모두 넣고 정책으로 고르게 한다. */
function frontBatch(policy?: 'claude-argon-v1'): b.BatchInput {
  const base = legacy.drafts[0]!;
  const batchId = 'T-CLAUDE';
  const q: d.QuestionDraft = {
    ...structuredClone(base), batchId, id: 'g4-test-0001', revision: 3, grade: 4,
    difficultyTier: 'basic', variantTag: 'standard', type: 'cloze',
    target: { lemma: '낱말0', partOfSpeech: '명사', senseKey: 'test/0' },
    gradeBasis: { ...base.gradeBasis, unit: 'stdict:전문어 표지 없음' },
    stem: '0번 빈칸에 알맞은 말은? (    )',
    options: [{ id: 'a', text: '나무' }, { id: 'b', text: '바람' }, { id: 'c', text: '하늘' }, { id: 'd', text: '구름' }],
    correctOptionId: 'a', explanation: '문맥에 맞는 말이에요.',
    distractorRationales: { b: 'b는 문맥에 맞지 않아요.', c: 'c는 문맥에 맞지 않아요.', d: 'd는 문맥에 맞지 않아요.' },
  };
  const sidecar: d.DraftSidecar = { ...structuredClone(legacy.sidecar), batchId, items: [{
    id: q.id, revision: q.revision, uniquenessNote: '정답 하나', gradeEvidence: '학년 적합',
    selfRefutation: q.options.map(o => ({ optionId: o.id, substituted: o.text, verdict: o.id === q.correctOptionId ? 'fits' as const : 'does_not_fit' as const, reason: `${o.text} 대입` })),
  }], rejected: [] };
  if (policy) sidecar.publicationPolicy = policy;
  const report = (model: string): d.BlindReview => ({ ...structuredClone(legacy.reviews.codex!), reviewer: { model, tool: '시험', freshContext: true, date: '2026-11-09' }, items: [{
    questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), blindChoice: 'a',
    verdicts: { source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'uncertain' }, findings: [],
  }] });
  return { batchId, drafts: [q], sidecar, reviews: { codex: report('gpt-6-astra'), claude: report('claude-opus-5-5') }, argonBlind: null, explanation: null };
}
function frontLevels(batch: b.BatchInput) {
  return { batchId: batch.batchId, rubricVersion: 'lv1', items: batch.drafts.map(q => {
    const judge = (who: LevelJudge['judge']): LevelJudge => ({
      questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), judge: who, model: 'fixture',
      L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null, elementaryFit: 'pass',
      basisType: 'stdict_structural', unit: q.gradeBasis.unit, reason: '시험 근거',
    });
    return levels.assessLevel(q, judge('argon'), judge('claude'));
  }) };
}

describe('앞단: claude-argon-v1은 Claude 독립 검토로 판정한다', () => {
  const m = { b, d, lint, front };
  it('Codex 보고서의 fail은 보지 않고 Claude 보고서 지적만 결함으로 본다', () => {
    const batch = frontBatch('claude-argon-v1');
    const codex = batch.reviews.codex!.items[0]!;
    codex.blindChoice = 'none'; codex.verdicts.source = 'fail'; codex.findings = ['코덱스만의 지적'];
    expect(front.frontGate(batch, frontLevels(batch), { curriculumCodes: null }).items[0]).toMatchObject({ status: 'pass', defects: [], pending: [] });
    const claude = batch.reviews.claude!.items[0]!;
    claude.blindChoice = 'multiple'; claude.verdicts.grade = 'uncertain'; claude.verdicts.explanation = 'fail'; claude.findings = ['클로드 지적'];
    expect(front.frontGate(batch, frontLevels(batch), { curriculumCodes: null }).items[0]!.defects)
      .toEqual(['claude: 독립 풀이 multiple ≠ 정답', 'claude: grade uncertain', 'claude: explanation fail']);
    // 수정기에 넘기는 지적에도 Codex 보고서 내용이 섞이지 않는다.
    const [item] = flagged(m, batch, { levelFile: frontLevels(batch) });
    expect(item.phase).toBe('front');
    expect(item.findings).toContain('claude: 클로드 지적');
    expect(item.findings.some((f: string) => f.startsWith('codex:'))).toBe(false);
  });

  it('Claude 검토가 없으면 Codex가 통과여도 pending이고, 정책 없는 배치는 기존처럼 Codex로 판정한다', () => {
    const batch = frontBatch('claude-argon-v1');
    delete batch.reviews.claude;
    expect(front.frontGate(batch, frontLevels(batch), { curriculumCodes: null }).items[0]).toMatchObject({
      status: 'pending', defects: [], pending: ['claude: 이 revision·contentHash의 독립 검토 없음'],
    });
    const plain = frontBatch();
    delete plain.reviews.codex;
    expect(front.frontGate(plain, frontLevels(plain), { curriculumCodes: null }).items[0]).toMatchObject({
      status: 'pending', pending: ['codex: 이 revision·contentHash의 독립 검토 없음'],
    });
  });
});

describe('content-loop --primary claude', () => {
  type Ref = { batchId: string; questionId: string; revision: number; phase?: string };
  type Emit = (event: { type: string; who: string }) => void;
  /** two-model 시험 방식의 가짜 runtime. Codex 앞단·최종 대기열과 옛 Claude 대기열은 일부러 비우지 않는다. */
  function loop(failFirst = false) {
    const root = tempRoot('claude-loop-');
    const q = { batchId: 'A', id: 'A-q', revision: 1, level: false, claude: false, final: false, bad: false };
    const key = () => `${q.id}@${q.revision}`;
    const touch = (who: string) => {
      if (who !== 'claude') throw new Error(`${who} 검수 호출 금지`);
      if (!q.claude) q.claude = true;
      else { q.final = true; q.bad = failFirst && q.revision === 1; }
    };
    const deps = {
      ids: ['A'], log: vi.fn(), apply: vi.fn(async () => ({ runs: [] })),
      snapshot: () => ({
        drafts: [q], levelPending: q.level ? [] : [key()], argonPending: [],
        codexPending: [key()], codexFinalPending: [key()], claudePending: [key()],
        claudeFrontPending: q.claude ? [] : [key()], claudeFinalPending: q.final ? [] : [key()],
        front: { items: [{ questionId: q.id, revision: q.revision, status: q.level && q.claude ? 'pass' : 'pending' }], batchDefects: [] },
        flagged: q.bad ? [{ q, phase: 'gate' }] : [],
      }),
      level: vi.fn(async (_id: string, _keys: string[], cb: Emit) => { cb({ type: 'call', who: 'argon' }); cb({ type: 'call', who: 'claude' }); q.level = true; return { assessed: 1 }; }),
      review: vi.fn(async (_id: string, who: string, _keys: string[], cb: Emit) => { cb({ type: 'call', who }); touch(who); return { merged: 1 }; }),
      finalizeQuestions: vi.fn(async () => { throw new Error('Codex 최종 대조 호출 금지'); }),
      levelQuestions: vi.fn(async (_refs: Ref[], cb: Emit) => { cb({ type: 'call', who: 'claude' }); q.level = true; return [{ batchId: 'A', assessed: 1 }]; }),
      reviewQuestions: vi.fn(async (_refs: Ref[], who: string, cb: Emit) => { cb({ type: 'call', who }); touch(who); return [{ batchId: 'A', merged: 1 }]; }),
      reviseQuestions: vi.fn(async (_refs: Ref[], cb: Emit) => {
        cb({ type: 'call', who: 'argon' });
        Object.assign(q, { revision: q.revision + 1, level: false, claude: false, final: false, bad: false });
        return [{ batchId: 'A', revised: 1 }];
      }),
    };
    return { q, deps, options: { root, batches: 'A', 'stage-only': true, primary: 'claude' } };
  }
  const stages = (result: { stages: Array<{ stage: string }> }) => result.stages.map(s => s.stage);

  it('gatePrimary는 기본 codex, claude를 받고 옛 Claude 경로·모르는 값과의 조합을 거절한다', () => {
    expect(gatePrimary({})).toBe('codex');
    expect(gatePrimary({ primary: 'claude', 'stage-only': true })).toBe('claude');
    expect(() => gatePrimary({ primary: 'claude', 'stage-only': true, 'with-claude': true })).toThrow('--primary claude와 --with-claude');
    // 커밋 모드는 첫 apply가 정책 없는 제작분을 추적 파일로 굳혀 claude-argon-v1 기록을 막는다.
    expect(() => gatePrimary({ primary: 'claude' })).toThrow('--stage-only');
    // 공개 판정이 인정하지 않는 Claude 설정은 시작 전에 막는다.
    expect(() => gatePrimary({ primary: 'claude', 'stage-only': true, 'claude-model': 'claude-sonnet-5-5' })).toThrow('claude-opus-* high 이상');
    expect(() => gatePrimary({ primary: 'claude', 'stage-only': true, 'claude-effort': 'medium' })).toThrow('claude-opus-* high 이상');
    expect(gatePrimary({ primary: 'claude', 'stage-only': true, 'claude-effort': 'max' })).toBe('claude');
    expect(() => gatePrimary({ primary: 'gemini' })).toThrow('--primary');
  });

  it('옵션 충돌은 상태 조회 전에 거절한다', async () => {
    const f = loop();
    const snapshot = vi.spyOn(f.deps, 'snapshot');
    await expect(runGate({ ...f.options, 'with-claude': true }, f.deps)).rejects.toThrow('--with-claude');
    expect(snapshot).not.toHaveBeenCalled();
  });

  it('첫 판은 S1 → S2-claude → S3 → S4(claude)이고 Codex 앞단·최종 대조를 부르지 않는다', async () => {
    const f = loop();
    const result = await runGate(f.options, f.deps);
    expect(result.A.error).toBeUndefined();
    expect(stages(result.A)).toEqual(['S1', 'S2-claude', 'S3', 'S4']);
    expect(f.deps.review.mock.calls.map(c => c[1])).toEqual(['claude', 'claude']);
    expect(f.deps.finalizeQuestions).not.toHaveBeenCalled();
    expect(result.A.firstPassComplete).toBe(true);
  });

  it('S5 수정 뒤 재검수도 S1 → S2-claude → S4를 Claude 묶음 검수로 돌린다', async () => {
    const f = loop(true);
    const result = await runGate(f.options, f.deps);
    expect(result.A.error).toBeUndefined();
    expect(stages(result.A)).toEqual(['S1', 'S2-claude', 'S3', 'S4', 'S5', 'S1', 'S2-claude', 'S3', 'S4']);
    expect(f.deps.reviewQuestions.mock.calls.map(c => c[1])).toEqual(['claude', 'claude']);
    expect(f.deps.finalizeQuestions).not.toHaveBeenCalled();
    expect(f.q).toMatchObject({ revision: 2, final: true, bad: false });
  });

  it('plan과 --until S3는 Claude 단계를 알려 주고 S4를 실행하지 않는다', async () => {
    const f = loop();
    expect((await runGate({ ...f.options, plan: true }, f.deps)).A.next).toEqual({ stage: 'S1', target: 1 });
    f.q.level = true;
    expect((await runGate({ ...f.options, plan: true }, f.deps)).A.next).toEqual({ stage: 'S2-claude', target: 1, who: 'claude' });
    f.q.claude = true;
    expect((await runGate({ ...f.options, plan: true }, f.deps)).A.next).toEqual({ stage: 'S4', target: 1, who: 'claude' });
    expect((await runGate({ ...f.options, plan: true, until: 'S3' }, f.deps)).A.next).toEqual({ stage: 'S4 대기', target: 1, who: 'claude' });
    expect(f.deps.review).not.toHaveBeenCalled();
    const g = loop();
    const result = await runGate({ ...g.options, until: 'S3' }, g.deps);
    expect(stages(result.A)).toEqual(['S1', 'S2-claude', 'S3']);
    expect(result.A.awaitingFinalReview).toBe(1);
    expect(g.deps.review).toHaveBeenCalledTimes(1);
  });

  describe('실제 runtime 상태 계산(가짜 은행 주입)', () => {
    const run = { id: 'r', model: 'claude-opus-5-5', effort: 'high' };
    function snapshotBatch(change: (batch: ReturnType<typeof base>) => void = () => {}) {
      const batch = base();
      change(batch);
      return batch;
    }
    function base() {
      return {
        batchId: 'A', drafts: [{ id: 'q', revision: 2 }], sidecar: { publicationPolicy: 'claude-argon-v1' } as { publicationPolicy?: string },
        reviews: { claude: { reviewer: { model: 'claude-opus-5-5' }, items: [{ questionId: 'q', revision: 2, contentHash: 'content', run: { ...run } }] } } as Record<string, unknown>,
        argonBlind: null,
        explanation: { reviewer: { model: 'claude-opus-5-5' }, items: [{ questionId: 'q', revision: 2, contentHash: 'content', rationalesHash: 'rationales', explanation: 'pass', findings: [] as string[], run: { ...run } }] } as null | {
          reviewer: { model: string }; items: Array<{ questionId: string; revision: number; contentHash: string; rationalesHash: string; explanation: string; findings: string[]; run?: typeof run }>;
        },
      };
    }
    async function runtimeFor(batch: ReturnType<typeof base>, root = tempRoot('claude-runtime-')) {
      const rb = { loadBatches: () => [batch], contentHash: () => 'content', rationalesHash: () => 'rationales',
        decide: () => [{ questionId: 'q', revision: 2, reasons: [] }],
        CLAUDE_REVIEW_MODEL: b.CLAUDE_REVIEW_MODEL, isStrongReviewRun: b.isStrongReviewRun, policyReviewer: b.policyReviewer };
      const frontStub = { currentDrafts: (qs: unknown[]) => qs, frontGate: () => ({ items: [{ questionId: 'q', revision: 2, status: 'pass', defects: [], pending: [] }], batchDefects: [] }) };
      return createGateRuntime({ root, batches: 'A', 'stage-only': true, primary: 'claude' }, { rb, rm: { b: rb, front: frontStub }, lm: { levels: { isCurrentLevelAssessment: () => true } } });
    }

    it.each([
      ['강한 Opus pass', () => {}, []],
      ['강한 Opus fail(대조 완료)', (x: ReturnType<typeof base>) => { x.explanation!.items[0]!.explanation = 'fail'; }, []],
      ['gpt-6-astra 검토자', (x: ReturnType<typeof base>) => { x.explanation!.reviewer.model = 'gpt-6-astra'; }, ['q@2']],
      ['Sonnet 실행', (x: ReturnType<typeof base>) => { x.explanation!.items[0]!.run!.model = 'claude-sonnet-5-5'; }, ['q@2']],
      ['effort medium', (x: ReturnType<typeof base>) => { x.explanation!.items[0]!.run!.effort = 'medium'; }, ['q@2']],
      ['오답 이유 해시 불일치', (x: ReturnType<typeof base>) => { x.explanation!.items[0]!.rationalesHash = 'old'; }, ['q@2']],
      ['해설 대조 없음', (x: ReturnType<typeof base>) => { x.explanation = null; }, ['q@2']],
    ] as const)('S4 대기열: %s', async (_label, change, expected) => {
      const runtime = await runtimeFor(snapshotBatch(change));
      const state = runtime.snapshot('A');
      expect(state.claudeFinalPending).toEqual(expected);
      // Claude 관문은 Codex 앞단 검수를 요구하지 않는다(Codex 보고서가 없어도 비어 있음).
      expect(state.codexPending).toEqual([]);
      expect(state.claudeFrontPending).toEqual([]);
    });

    it('S2-claude 대기열은 현재 해시의 Claude 보고서가 없을 때만 채운다', async () => {
      const runtime = await runtimeFor(snapshotBatch(x => { x.reviews = {}; }));
      expect(runtime.snapshot('A').claudeFrontPending).toEqual(['q@2']);
    });

    it('추적 legacy 배치·codex-argon-v1 배치는 검수 전에 거절하고 추적 전 새 배치는 받는다', async () => {
      await expect((async () => (await runtimeFor(snapshotBatch(x => { x.sidecar.publicationPolicy = 'codex-argon-v1'; }))).snapshot('A'))())
        .rejects.toThrow('--primary claude');
      const tracked = tempRoot('claude-runtime-tracked-');
      writeFile(tracked, 'content-source/batches/A/drafts.json', []);
      const legacyBatch = snapshotBatch(x => { delete x.sidecar.publicationPolicy; });
      await expect((async () => (await runtimeFor(legacyBatch, tracked)).snapshot('A'))()).rejects.toThrow('legacy 추적 배치');
      const fresh = await runtimeFor(snapshotBatch(x => { delete x.sidecar.publicationPolicy; }));
      expect(fresh.snapshot('A').claudeFrontPending).toEqual([]);
    });
  });
});

describe('review.mjs ingest: claude-argon-v1 정책 기록', () => {
  const opus = { model: 'claude-opus-5-5', effort: 'high' };
  const astra = { model: 'gpt-6-astra', effort: 'high' };
  const sidecarPath = 'content-source/batches/B/sidecar.json';
  const sidecar = { batchId: 'B', jobId: 'produce-B', producer: { model: 'Gemini 4 Argon (High)', tool: 'tools/orchestrate/produce.mjs', date: '2026-11-09' }, items: [], rejected: [] };
  /** orchestrate-config.test.ts와 같은 가짜 은행. 제작 결과는 staging overlay에만 있다. */
  function fixture() {
    const root = tempRoot('claude-policy-ingest-');
    const item = { questionId: 'q1', revision: 1, contentHash: 'hash' };
    const draft = {
      id: 'q1', revision: 1, grade: 4, type: 'definition', target: { lemma: '낱말', partOfSpeech: '명사' },
      stem: '문제', options: [{ id: 'a', text: '답' }], correctOptionId: 'a', explanation: '해설',
      source: { evidenceArtifactId: 'missing.json' }, gradeBasis: {}, distractorRationales: {},
    };
    const bank = { loadBatches: () => [{ batchId: 'B', drafts: [draft], reviews: {} }], contentHash: () => 'hash', rationalesHash: () => 'rationales' };
    const reply = (phase: string) => JSON.stringify({ items: [{ ...item, blindChoice: 'a',
      verdicts: { uniqueness: 'pass', grade: 'pass', language: 'pass', ...(phase === 'reveal' ? { source: 'pass', explanation: 'pass' } : {}) }, findings: [],
    }] });
    return { root, bank, reply };
  }
  function stageProduced(root: string, value: unknown) {
    const runId = '20260101T000000000Z-produce';
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    const dir = path.join(root, '.orchestrate/staging/B', runId);
    writeFile(dir, `files/${sidecarPath}`, bytes);
    writeFile(dir, 'manifest.json', { batchId: 'B', runId, tool: 'produce', model: 'fixture', createdAt: '2026-01-01T00:00:00.000Z', writes: [{ path: sidecarPath, sha256: sha(bytes) }], deletes: [] });
  }
  async function review(f: ReturnType<typeof fixture>, reviewer: 'claude' | 'codex', config: typeof opus, policy: string) {
    const options = { config, questionKeys: ['q1@1'] };
    for (const phase of ['blind', 'reveal']) {
      const { items } = await buildPhase(f.bank, f.root, reviewer, 'B', phase, options);
      acceptPhase(f.root, reviewer, 'B', phase, f.reply(phase), items, options);
    }
    return ingest(f.bank, f.root, reviewer, 'B', { ...options, publicationPolicy: policy });
  }
  const runs = (root: string) => {
    const dir = path.join(root, '.orchestrate/staging/B');
    return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  };

  it('추적 전 새 배치는 staging sidecar에 정책을 기록하고 나머지 필드는 보존한다', async () => {
    const f = fixture();
    stageProduced(f.root, sidecar);
    const result = await review(f, 'claude', opus, 'claude-argon-v1');
    const stage = path.join(f.root, result.staging);
    const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'manifest.json'), 'utf8'));
    expect(manifest.writes.map((w: { path: string }) => w.path)).toContain(sidecarPath);
    const written = fs.readFileSync(path.join(stage, 'files', sidecarPath));
    expect(manifest.writes.find((w: { path: string }) => w.path === sidecarPath).sha256).toBe(sha(written));
    expect(JSON.parse(written.toString('utf8'))).toEqual({ ...sidecar, publicationPolicy: 'claude-argon-v1' });
    expect(d.draftSidecarSchema.parse(JSON.parse(written.toString('utf8'))).publicationPolicy).toBe('claude-argon-v1');
    expect(fs.existsSync(path.join(f.root, sidecarPath))).toBe(false);
  });

  it('추적 중인 정책 없는 배치는 바꾸지 않고 staging도 남기지 않는다', async () => {
    const f = fixture();
    writeFile(f.root, sidecarPath, sidecar);
    await expect(review(f, 'claude', opus, 'claude-argon-v1')).rejects.toThrow('추적 중이거나 다른 정책');
    expect(runs(f.root)).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(f.root, sidecarPath), 'utf8'))).toEqual(sidecar);
  });

  it('staging의 다른 정책(codex-argon-v1) 배치도 바꾸지 않는다', async () => {
    const f = fixture();
    stageProduced(f.root, { ...sidecar, publicationPolicy: 'codex-argon-v1' });
    const before = runs(f.root);
    await expect(review(f, 'claude', opus, 'claude-argon-v1')).rejects.toThrow('추적 중이거나 다른 정책');
    expect(runs(f.root)).toEqual(before);
  });

  it('이미 claude-argon-v1인 추적 배치는 sidecar를 다시 쓰지 않는다', async () => {
    const f = fixture();
    writeFile(f.root, sidecarPath, { ...sidecar, publicationPolicy: 'claude-argon-v1' });
    const result = await review(f, 'claude', opus, 'claude-argon-v1');
    const manifest = JSON.parse(fs.readFileSync(path.join(f.root, result.staging, 'manifest.json'), 'utf8'));
    expect(manifest.writes.map((w: { path: string }) => w.path)).not.toContain(sidecarPath);
  });

  it.each([['codex', astra, 'claude-argon-v1'], ['claude', opus, 'codex-argon-v1']] as const)('%s 검수의 %s 기록 요청은 거절한다', async (reviewer, config, policy) => {
    const f = fixture();
    stageProduced(f.root, sidecar);
    const before = runs(f.root);
    await expect(review(f, reviewer, config, policy)).rejects.toThrow('정책 기록은 Claude 검수의 claude-argon-v1만 지원한다');
    expect(runs(f.root)).toEqual(before);
  });
});
