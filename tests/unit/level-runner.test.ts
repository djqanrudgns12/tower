import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as d from '../../src/contracts/questionDraft';
import * as contracts from '../../src/contracts/levels';
import * as levels from '../../tools/content/levels';
import * as lint from '../../src/content/lint';
import { contentHash } from '../../tools/content/bankBuild';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import type { LevelJudge } from '../../src/contracts/levels';
// @ts-expect-error 독립 실행 MJS 실행기에는 선언 파일이 없다.
import { runLevels, parseReply, recoverReply, selectGradeBasis, stdictSpecialized, fixtureResponder } from '../../tools/orchestrate/level.mjs';

const modules = { d, contracts, levels, lint };
const roots: string[] = [];
const write = (root: string, file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), JSON.stringify(value));
};
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function question(batchId = 'A', index = 1): QuestionDraft {
  return {
    schemaVersion: '0.2', batchId, id: `g4-test-${String(index).padStart(4, '0')}`, revision: 1, status: 'draft',
    grade: 4, type: 'cloze', variantTag: 'standard',
    gradeBasis: { reference: '기존 출처', editionYear: 2022, unit: '기존 근거', reviewed: false },
    target: { lemma: '약속', partOfSpeech: '명사', senseKey: '약속/명사/1' },
    stem: '친구와 한 (    )을 지켜요.', options: [{ id: 'a', text: '약속' }, { id: 'b', text: '연필' }, { id: 'c', text: '신발' }, { id: 'd', text: '하늘' }],
    correctOptionId: 'a', explanation: '하기로 정한 일을 지켜요.', distractorRationales: { b: '쓰는 도구예요.', c: '발에 신어요.', d: '위를 보면 있어요.' },
    source: { provider: 'stdict', entryId: '1', senseId: '1', senseOrder: 1, url: 'https://stdict.korean.go.kr/', retrievedAt: '2026-11-05T00:00:00Z', license: '출처 표시', evidenceHash: 'a'.repeat(64), evidenceArtifactId: 'word.txt' },
    review: { reviewerId: null, reviewedAt: null },
  };
}
function reply(q: QuestionDraft, changes = {}) {
  return { questionId: q.id, revision: q.revision, L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null,
    elementaryFit: 'pass', basisType: 'stdict_structural', unit: 'stdict:전문어 표지 없음', reason: '생활에서 쓰는 구체적인 약속', ...changes };
}
function assessment(q: QuestionDraft) {
  const j = { ...reply(q), contentHash: contentHash(q), model: '시험 모델' };
  return levels.assessLevel(q, { ...j, judge: 'argon' } as LevelJudge, { ...j, judge: 'codex' } as LevelJudge);
}
type Request = { judge: 'argon' | 'codex'; phase: string; batchId: string; chunk: number; attempt: number; prompt: string; cwd: string; config: { model: string; effort: string }; items: Array<{ questionId: string; revision: number }> };
function setup(batches: QuestionDraft[][] = [[question()], [question('B', 2)]]) {
  fs.mkdirSync('.orchestrate', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.orchestrate/level-test-'));
  roots.push(root);
  for (const qs of batches) {
    write(root, `content-source/batches/${qs[0]!.batchId}/drafts.json`, qs);
    const file = path.join(root, `content-source/batches/${qs[0]!.batchId}/evidence/word.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '뜻풀이: 『법률』 서로 하기로 정한 일.');
  }
  const respond = vi.fn(async (r: Request) => JSON.stringify({ items: r.items.map(item => reply({ id: item.questionId, revision: item.revision } as QuestionDraft, { reason: `${r.judge}-비공개근거` })) }));
  return { root, respond, options: { root, all: true, argon: 2, codex: 2 }, deps: { modules, respond } };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('S1 수준 판정 실행기', () => {
  it.each([
    { items: [{ lemma: '약속', grade: '중급' }] },
    { source: '한국어기초사전', items: { 약속: { grade: '중급', entryUrl: 'https://krdict.korean.go.kr/' } } },
  ])('2배치를 독립 판정하고 사전 등급·staging·본문 보존을 확인한다: %j', async reference => {
    const { root, options, deps, respond } = setup();
    write(root, 'content-source/reference/krdict-grade.json', reference);
    const before = ['A', 'B'].map(id => fs.readFileSync(path.join(root, `content-source/batches/${id}/drafts.json`), 'utf8'));
    const results = await runLevels({ ...options, 'codex-model': 'gpt-6-astra', 'codex-effort': 'high' }, deps);
    expect(results.map((r: { assessed: number }) => r.assessed)).toEqual([1, 1]);
    expect(respond).toHaveBeenCalledTimes(4);
    for (const [r] of respond.mock.calls) {
      expect(r.prompt).not.toContain('-비공개근거');
      expect(r.prompt).toContain('명령 실행·파일 쓰기 금지');
      expect(r.prompt).toContain('지양하다');
      expect(r.prompt).toContain('어리둥절하다');
      expect(r.prompt).toContain('『법률』');
      expect(r.prompt).toContain('distractorRationales');
      expect(r.prompt).not.toContain('기존 근거');
      expect(r.prompt).not.toContain('"contentHash"');
      expect(fs.readdirSync(r.cwd)).toEqual([]);
      if (r.judge === 'codex') expect(r.config).toEqual({ model: 'gpt-6-astra', effort: 'high' });
    }
    expect(new Set(respond.mock.calls.map(([r]) => r.cwd)).size).toBe(4);
    for (const [i, id] of ['A', 'B'].entries()) {
      const dir = path.join(root, results[i].staging);
      const manifest = read(path.join(dir, 'manifest.json'));
      expect(manifest).toMatchObject({ batchId: id, tool: 'level', deletes: [] });
      expect(manifest.writes.map((w: { path: string }) => w.path).sort()).toEqual([`content-source/batches/${id}/drafts.json`, `content-source/levels/${id}.json`]);
      for (const w of manifest.writes) expect(hash(fs.readFileSync(path.join(dir, 'files', w.path)))).toBe(w.sha256);
      const qs: QuestionDraft[] = read(path.join(dir, 'files', `content-source/batches/${id}/drafts.json`));
      const original: QuestionDraft[] = JSON.parse(before[i]!);
      expect(qs[0]).toEqual({ ...original[0], difficultyTier: 'basic', gradeBasis: { ...original[0]!.gradeBasis, unit: 'stdict:전문어 표지 없음', reviewed: true } });
      expect(contentHash(qs[0]!)).toBe(contentHash(original[0]!));
      const level = contracts.levelBatchSchema.parse(read(path.join(dir, 'files', `content-source/levels/${id}.json`)));
      expect(level.items[0]!.precomputed).toMatchObject({ krdictGrade: '중급', stdictSpecialized: true });
      expect(levels.isCurrentLevelAssessment(qs[0]!, level.items[0])).toBe(true);
      expect(fs.readFileSync(path.join(root, `content-source/batches/${id}/drafts.json`), 'utf8')).toBe(before[i]);
      expect(fs.existsSync(path.join(root, `content-source/levels/${id}.json`))).toBe(false);
    }
    // 대기 결과를 재사용해 모델 재호출·초안 되감기를 막는다.
    expect((await runLevels(options, deps)).map((r: { assessed: number }) => r.assessed)).toEqual([0, 0]);
    expect(respond).toHaveBeenCalledTimes(4);
  });

  it('현재 합의만 건너뛰고 50개씩 나누며 형식 오류인 판정자 묶음만 재요청한다', async () => {
    const qs = Array.from({ length: 53 }, (_, i) => question('A', i + 1));
    const { root, options, deps, respond } = setup([qs]);
    write(root, 'content-source/levels/A.json', { batchId: 'A', rubricVersion: 'lv1', items: [assessment(qs[0]!), assessment({ ...qs[1]!, revision: 2 })] });
    respond.mockImplementation(async r => {
      if (r.judge === 'argon' && r.chunk === 0 && r.attempt === 1) return '{"items":[';
      return JSON.stringify({ items: r.items.map(item => reply({ id: item.questionId, revision: item.revision } as QuestionDraft)) });
    });
    const [result] = await runLevels(options, deps);
    expect(result.assessed).toBe(52);
    expect(respond.mock.calls.filter(([r]) => r.judge === 'argon').map(([r]) => r.items.length)).toEqual([50, 50, 2]);
    expect(respond.mock.calls.filter(([r]) => r.judge === 'codex').map(([r]) => r.items.length)).toEqual([50, 2]);
    expect(respond.mock.calls.some(([r]) => r.items.some(q => q.questionId === qs[0]!.id))).toBe(false);
    const saved = read(path.join(root, result.staging, 'files/content-source/levels/A.json'));
    expect(saved.items).toContainEqual(assessment(qs[0]!));
    expect(saved.items.some((i: { questionId: string; revision: number }) => i.questionId === qs[1]!.id && i.revision === 1)).toBe(true);
  });

  it('형식 오류 재요청은 3회로 끝나고 불완전한 합의를 staging에 쓰지 않는다', async () => {
    const { root, options, deps, respond } = setup([[question()]]);
    respond.mockResolvedValue('{"items":[]}');
    await expect(runLevels(options, deps)).rejects.toThrow(/형식|실패/);
    for (const judge of ['argon', 'codex']) expect(respond.mock.calls.filter(([r]) => r.judge === judge)).toHaveLength(4);
    expect(fs.existsSync(path.join(root, '.orchestrate/staging'))).toBe(false);
  });

  it('규칙4는 배치당 5개만 근거 대조하고 합의는 그대로 둔다', async () => {
    const qs = Array.from({ length: 6 }, (_, i) => question('A', i + 1));
    const { root, options, deps, respond } = setup([qs]);
    respond.mockImplementation(async r => JSON.stringify({ items: r.items.map(item => reply({ id: item.questionId, revision: item.revision } as QuestionDraft,
      r.phase === 'spotcheck' ? { L1: 3, L2: 3, T1: 3 } : r.judge === 'codex' ? { L1: 3, L2: 1 } : {})) }));
    const [result] = await runLevels(options, deps);
    const spot = respond.mock.calls.filter(([r]) => r.phase === 'spotcheck');
    expect(spot).toHaveLength(1);
    expect(spot[0]![0].judge).toBe('codex');
    expect(spot[0]![0].items).toHaveLength(5);
    const saved = read(path.join(root, result.staging, 'files/content-source/levels/A.json'));
    expect(saved.items.map((i: { merged: unknown }) => i.merged)).toEqual(qs.map(() => ({ rule: 4, L: 4, T: 0, V: 8, ownTier: 'core', band: { min: 4, max: 4 }, flags: ['stdictSpecialized', 'spotCheck'] })));
    const report = read(path.join(root, '.orchestrate/level-spotcheck/A.json'));
    expect(report.items).toHaveLength(5);
    expect(report.items[0]).toMatchObject({ L1: 3, L2: 3, T1: 3 });
  });

  it('Argon → Codex → 계산값 순으로 유효한 unit을 고르고 선택된 근거로 reviewed를 정한다', () => {
    const a = reply(question());
    const c = { ...a, basisType: 'corpus_graded', unit: 'krdict:중급' };
    const select = (left: unknown, right: unknown) => selectGradeBasis(modules, left, right, { L: 2, T: 0 }, new Set(['4국04-03']));
    expect(select(a, c)).toEqual({ unit: a.unit, reviewed: true });
    expect(select({ ...a, unit: '2단원 30쪽' }, c)).toEqual({ unit: 'krdict:중급', reviewed: true });
    expect(select({ ...a, unit: '2단원' }, { ...c, unit: '[4국99-99] 허구' })).toEqual({ unit: 'rubric_inferred(L=2,T=0)', reviewed: false });
    expect(select({ ...a, unit: '[4국04-03] 낱말의 의미 관계', basisType: 'curriculum_explicit' }, c)).toEqual({ unit: '[4국04-03] 낱말의 의미 관계', reviewed: true });
    expect(select({ ...a, unit: 'rubric_inferred(L=2,T=0)', basisType: 'rubric_inferred' }, c)).toEqual({ unit: 'rubric_inferred(L=2,T=0)', reviewed: false });
    expect(select({ ...a, unit: 'rubric_inferred(L=2,T=0)' }, c)).toEqual({ unit: 'krdict:중급', reviewed: true });
  });

  it.each([['뜻풀이: 『법률』 효력을 지닌다.', true], ['『 음악 』 여러 악기로 연주한다.', true], ['「명사」 일반적인 뜻.', false], ['전문어 표지 없음', false], ['', false], ['『』', false]])('전문 분야 표지: %s', (text, expected) => {
    expect(stdictSpecialized(text)).toBe(expected);
  });

  it('응답 ID·revision·중복·범위·관용구 불투명도를 엄격히 검사한다', () => {
    const q = question();
    const input = [{ questionId: q.id, revision: q.revision, contentHash: contentHash(q), precomputed: levels.precompute(q) }];
    const parse = (items: unknown[]) => parseReply(modules, JSON.stringify({ items }), input, 'argon', '시험 모델');
    expect(parse([reply(q)])[0]).toMatchObject({ contentHash: contentHash(q), judge: 'argon', model: '시험 모델' });
    for (const items of [[], [reply(q), reply(q)], [reply(q, { revision: 2 })], [reply(q, { L1: 4 })], [reply(q, { ownTier: 'basic' })]]) expect(() => parse(items)).toThrow();
    // 관용구가 아닌 문항에 들어온 불투명도는 판정에 쓰이지 않으므로 버린다(형식 오류로 재요청하지 않는다).
    expect(parse([reply(q, { idiomOpacity: 2 })])[0]!.idiomOpacity).toBeNull();
    // 관용구 문항인데 불투명도가 없으면 재요청 사유다.
    const idiom = { ...q, variantTag: 'idiom_proverb' as const, difficultyTier: 'advanced' as const };
    const idiomInput = [{ questionId: idiom.id, revision: idiom.revision, contentHash: contentHash(idiom), precomputed: levels.precompute(idiom), needsIdiomOpacity: true }];
    expect(() => parseReply(modules, JSON.stringify({ items: [reply(idiom)] }), idiomInput, 'argon', '시험 모델')).toThrow();
  });

  it('잘린 브리지 답장은 명시된 대화 폴더에서 현재 입력과 일치하는 전문만 복원한다', () => {
    const { root } = setup([[question()]]);
    const id = '12345678-1234-1234-1234-123456789abc';
    const input = [{ questionId: question().id, revision: 1, contentHash: contentHash(question()), precomputed: levels.precompute(question()) }];
    const validate = (text: string) => parseReply(modules, text, input, 'argon', '시험 모델');
    const truncated = `{"items":[\nconversation_id: ${id}`;
    write(root, `${id}/reply.json`, { items: [reply(question())] });
    expect(JSON.parse(recoverReply(truncated, validate, root)).items).toEqual([reply(question())]);
    write(root, `${id}/reply.json`, { items: [reply(question(), { revision: 2 })] });
    expect(recoverReply(truncated, validate, root)).toBe(truncated);
    expect(recoverReply('{"items":[', validate, root)).toBe('{"items":[');
  });

  it('dry-run은 가짜 응답 없이 실제 실행으로 넘어가지 않는다', async () => {
    const { options } = setup([[question()]]);
    await expect(runLevels({ ...options, dryRun: true }, { modules })).rejects.toThrow(/fixture|응답/);
    const fake = fixtureResponder({ responses: { A: { argon: [{ items: [reply(question())] }] } } });
    expect(await fake({ batchId: 'A', judge: 'argon', phase: 'assess' })).toContain('g4-test-0001');
    await expect(fake({ batchId: 'A', judge: 'codex', phase: 'assess' })).rejects.toThrow(/fixture/);
  });

  it('실제 CLI의 dry-run이 fixture만으로 모듈을 읽고 한 배치를 staging한다', () => {
    const { root } = setup([[question()]]);
    write(root, 'fixture.json', { responses: { A: { argon: [{ items: [reply(question())] }], codex: [{ items: [reply(question())] }] } } });
    const output = execFileSync(process.execPath, ['tools/orchestrate/level.mjs', 'run', '--root', root, '--batches', 'A', '--dry-run', '--fixture', path.join(root, 'fixture.json')], {
      encoding: 'utf8', timeout: 30_000,
      // fixture 경로에서 실행 수단으로 빠지는 회귀는 즉시 실패해야 한다.
      env: { ...process.env, AGENT_BRIDGE: '/존재하지않는/bridge', CODEX_CLI: '/존재하지않는/codex' },
    });
    const [result] = JSON.parse(output);
    expect(result).toMatchObject({ batchId: 'A', assessed: 1, spotChecked: 0 });
    const level = read(path.join(root, result.staging, 'files/content-source/levels/A.json'));
    expect(level.items[0].precomputed.krdictGrade).toBeNull();
    expect(fs.existsSync(path.join(root, 'content-source/levels/A.json'))).toBe(false);
  });
});
