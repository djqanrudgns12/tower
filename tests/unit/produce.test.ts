import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as d from '../../src/contracts/questionDraft';
import type { DraftSidecar, QuestionDraft } from '../../src/contracts/questionDraft';
import * as b from '../../tools/content/bankBuild';
import * as lint from '../../src/content/lint';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { produce, prepare, selectItems, evidenceInput, parseDrafts, balanceAnswers, moveAnswer, recoverReply, parseArgs } from '../../tools/orchestrate/produce.mjs';

const modules = { d, b, lint };
const batchId = 'Q50-G4-022';
const roots: string[] = [];
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const write = (root: string, file: string, value: unknown) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value));
};
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

const words = [
  { kind: 'word', lemma: '간직하다', partOfSpeech: '동사', senseOrder: 1, types: ['cloze'], variantTag: 'standard', expectedL1: 1, expectedL2: 1, gradeEvidence: 'stdict:전문어 표지 없음', checked: true },
  { kind: 'idiom', lemma: '귀가 얇다', partOfSpeech: '관용구', senseOrder: 1, types: ['cloze'], variantTag: 'idiom_proverb', expectedL1: 1, expectedL2: 1, gradeEvidence: 'stdict:관용구 등재', checked: true },
  { kind: 'dialect', lemma: '정구지', partOfSpeech: '명사', senseOrder: 1, types: ['cloze'], variantTag: 'dialect', dialectRegion: '경상', expectedL1: 1, expectedL2: 1, gradeEvidence: 'rubric_inferred(L=2,T=3)', checked: true },
];
const drafts = [
  { stem: '선물을 상자에 잘 (    ).', options: [{ id: 'a', text: '간직하다' }, { id: 'b', text: '내던지다' }, { id: 'c', text: '빌려주다' }, { id: 'd', text: '가져가다' }], correctOptionId: 'a', explanation: '선물을 잘 챙겨 두어 보관한다는 뜻이에요.', distractorRationales: { b: '내던지는 것은 보관하는 것과 반대예요.', c: '빌려주는 것은 남에게 잠시 맡기는 일이에요.', d: '가져가는 것은 다른 곳으로 옮기는 일이에요.' } },
  { stem: '남의 말을 쉽게 믿는 동생에게 (    )고 했다.', options: [{ id: 'a', text: '귀가 얇다' }, { id: 'b', text: '손이 크다' }, { id: 'c', text: '발이 넓다' }, { id: 'd', text: '입이 무겁다' }], correctOptionId: 'a', explanation: '남의 말을 쉽게 받아들이는 것을 뜻해요.', distractorRationales: { b: '씀씀이가 크다는 말은 믿는 것과 달라요.', c: '아는 사람이 많다는 말은 믿는 것과 달라요.', d: '비밀을 잘 지킨다는 말은 믿는 것과 달라요.' } },
  { stem: '경상도 할머니가 부추를 썰며 “이 (    )로 전을 부치자.”라고 하셨다.', options: [{ id: 'a', text: '정구지' }, { id: 'b', text: '감자' }, { id: 'c', text: '고구마' }, { id: 'd', text: '호박' }], correctOptionId: 'a', explanation: '정구지는 부추를 가리키는 경상도 말이에요.', distractorRationales: { b: '감자는 할머니가 써는 부추와 달라요.', c: '고구마는 할머니가 써는 부추와 달라요.', d: '호박은 할머니가 써는 부추와 달라요.' } },
];
const replies = drafts.map((draft, i) => ({
  questionId: `g4-argon-00${42 + i}`, draft,
  selfRefutation: draft.options.map(o => ({ optionId: o.id, substituted: draft.stem.replace('(    )', o.text), verdict: o.id === 'a' ? 'fits' : 'does_not_fit', reason: o.id === 'a' ? '상황에서 요구하는 뜻과 맞아요.' : `${o.text}는 이 상황의 뜻과 달라요.` })),
  uniquenessNote: '네 보기를 대입하면 목표 뜻에 맞는 보기는 하나예요.',
}));

function setup() {
  fs.mkdirSync('.orchestrate', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.orchestrate/produce-test-'));
  roots.push(root);
  write(root, 'content-source/batches/old/nested/drafts.json', [{ id: 'g6-argon-0041', grade: 6, target: { lemma: '기존어' }, type: 'cloze', source: { senseOrder: 1 } }]);
  write(root, 'content-source/wordlists/g4-r1.json', { grade: 4, round: 1, items: [{ ...words[0], lemma: '기존어' }, { ...words[0], lemma: '미확인', checked: false }, ...words, words[0]] });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.copyFileSync('docs/model_work_orders_v0_5.md', path.join(root, 'docs/model_work_orders_v0_5.md'));
  const entries = words.map((w, i) => ({ provider: w.kind === 'dialect' ? 'opendict' : 'stdict', lemma: w.lemma, headword: w.lemma, partOfSpeech: `「${w.partOfSpeech}」`, senseOrder: 1,
    wordNo: String(100 + i), senseId: String(200 + i), url: `https://stdict.korean.go.kr/search/searchView.do?word_no=${100 + i}`, retrievedAt: '2026-11-06T00:00:00.000Z', license: '시험 근거', file: `word-${i}.txt`, sha256: hash(`근거 전문 ${w.lemma}\n`) }));
  const evidence = { entries, texts: Object.fromEntries(words.map((w, i) => [`word-${i}.txt`, `근거 전문 ${w.lemma}\n`])) };
  const options = { root, wordlist: 'content-source/wordlists/g4-r1.json', batchId, grade: 4, count: 3, dryRun: true };
  const deps = { modules, fetchEvidence: vi.fn(async () => evidence), respond: vi.fn(async () => JSON.stringify({ items: replies })), now: () => new Date('2026-11-06T03:15:00.000Z') };
  return { root, evidence, options, deps };
}
function results(dir: string) {
  const base = path.join(dir, 'files/content-source/batches', batchId);
  return { drafts: read(path.join(base, 'drafts.json')) as QuestionDraft[], side: read(path.join(base, 'sidecar.json')) as DraftSidecar };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

type Slot = typeof words[number] & { id: string; type: string };
const slots = (items: Slot[]) => items.map(i => [i.lemma, i.type]);

describe('S6 낱말·유형 칸', () => {
  it('checked=true의 모든 유형을 칸으로 펴고 중복 칸·미확인 항목은 빼며 근거 조회는 묶는다', () => {
    const { root, evidence } = setup();
    const first = { ...words[0], types: ['cloze', 'usage', 'cloze'] };
    const second = { ...words[1], types: ['cloze', 'definition'] };
    const selected = selectItems(root, { grade: 4, items: [first, second, first, { ...words[2], checked: false }, { ...words[2], checked: undefined }] }, 4, 50);
    expect(slots(selected)).toEqual([['간직하다', 'cloze'], ['귀가 얇다', 'cloze'], ['간직하다', 'usage'], ['귀가 얇다', 'definition']]);
    expect(new Set(selected.map((i: Slot) => i.id)).size).toBe(4);
    expect(evidenceInput(selected)).toEqual(['word:간직하다', 'idiom:귀가 얇다']);
    const prepared = prepare(root, batchId, 4, selected, evidence);
    expect(prepared.rejected).toEqual([]);
    expect(prepared.accepted.map((x: { fixed: QuestionDraft }) => x.fixed.type)).toEqual(['cloze', 'cloze', 'usage', 'definition']);
    expect(prepared.accepted[2].fixed.difficultyTier).toBe('core');
  });

  it('다른 학년·대기의 사용 칸을 빼고 같은 낱말의 다른 유형은 남긴다', () => {
    const { root } = setup();
    write(root, 'content-source/batches/used/drafts.json', [{ id: 'g5-argon-0090', grade: 5, target: { lemma: words[0]!.lemma.normalize('NFD') }, type: 'cloze', source: { senseOrder: 1 } }]);
    write(root, '.orchestrate/staging/other/run/files/content-source/batches/other/drafts.json', [{ id: 'g4-argon-0091', grade: 4, target: { lemma: words[1]!.lemma }, type: 'definition', source: { senseOrder: 1 } }]);
    const selected = selectItems(root, { grade: 4, items: [{ ...words[0], types: ['cloze', 'usage'] }, { ...words[1], types: ['cloze', 'definition'] }] }, 4, 50);
    expect(slots(selected)).toEqual([['간직하다', 'usage'], ['귀가 얇다', 'cloze']]);
    expect(selected.map((i: Slot) => i.id)).toEqual(['g4-argon-0092', 'g4-argon-0093']);
  });

  it('학년별 낱말 4문항·다의어 5문항 한도에 이번 선택도 포함한다', () => {
    const { root } = setup();
    const limits = [{ lemma: '일반여유', n: 3, variantTag: 'standard' }, { lemma: '일반가득', n: 4, variantTag: 'standard' }, { lemma: '다의여유', n: 4, variantTag: 'polysemy' }, { lemma: '다의가득', n: 5, variantTag: 'polysemy' }];
    const existing = limits.flatMap((w, j) => Array.from({ length: w.n }, (_, i) => ({ id: `g4-argon-${100 + j * 10 + i}`, grade: 4, target: { lemma: w.lemma }, type: 'definition', variantTag: w.variantTag, source: { senseOrder: i + 1 } })));
    write(root, 'content-source/batches/limits/drafts.json', existing);
    // 반영 전 같은 문항은 추가 한 건으로 세지 않는다.
    write(root, '.orchestrate/staging/limits/run/files/content-source/batches/limits/drafts.json', existing);
    const selected = selectItems(root, { grade: 4, items: limits.map(w => ({ ...words[0], lemma: w.lemma, variantTag: w.variantTag, senseOrder: 10, types: ['cloze', 'usage'] })) }, 4, 50);
    expect(slots(selected)).toEqual([['일반여유', 'cloze'], ['다의여유', 'cloze']]);
  });

  it('같은 뜻은 유형을 달리해 2문항까지만 고르고 다른 뜻·학년의 여유는 남긴다', () => {
    const { root } = setup();
    write(root, 'content-source/batches/senses/drafts.json', [
      { id: 'g4-argon-0100', grade: 4, target: { lemma: '간직하다' }, type: 'cloze', source: { senseOrder: 1 } },
      { id: 'g4-argon-0101', grade: 4, target: { lemma: '다른뜻' }, type: 'cloze', source: { senseOrder: 1 } },
      { id: 'g4-argon-0102', grade: 4, target: { lemma: '다른뜻' }, type: 'definition', source: { senseOrder: 1 } },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `g5-argon-${200 + i}`, grade: 5, target: { lemma: '간직하다' }, type: 'cloze', source: { senseOrder: 1 } })),
    ]);
    const selected = selectItems(root, { grade: 4, items: [
      { ...words[0], types: ['definition', 'usage'] },
      { ...words[0], lemma: '다른뜻', types: ['usage'] },
      { ...words[0], lemma: '다른뜻', senseOrder: 2, types: ['usage'] },
    ] }, 4, 50);
    expect(slots(selected)).toEqual([['간직하다', 'definition'], ['다른뜻', 'usage']]);
    expect(selected.map((i: Slot) => i.senseOrder)).toEqual([1, 2]);
  });

  it('한 배치의 같은 낱말은 2칸 이하이며 연달아 놓지 않는다', () => {
    const { root } = setup();
    const items = words.map(w => ({ ...w, types: ['cloze', 'definition', 'usage'] }));
    const selected = selectItems(root, { grade: 4, items: [...items, { ...items[0], senseOrder: 2, types: ['antonym_context'] }] }, 4, 50);
    expect(selected).toHaveLength(6);
    for (const w of words) expect(selected.filter((i: Slot) => i.lemma === w.lemma)).toHaveLength(2);
    expect(selected.slice(1).every((i: Slot, n: number) => i.lemma !== selected[n].lemma)).toBe(true);
    const uneven = selectItems(root, { grade: 4, items: [words[0], words[1], { ...words[2], types: ['cloze', 'definition'] }] }, 4, 4);
    expect(uneven).toHaveLength(4);
    expect(uneven.slice(1).every((i: Slot, n: number) => i.lemma !== uneven[n].lemma)).toBe(true);
    expect(selectItems(root, { grade: 4, items: [items[0]] }, 4, 50)).toHaveLength(1);
    expect(selectItems(root, { grade: 4, items }, 4, 3)).toHaveLength(3);
  });

  it.each([
    ['반복 옵션', ['run', '--wordlist', 'content-source/wordlists/g4-r1.json', '--wordlist', 'content-source/wordlists/g4-r1b.json']],
    ['쉼표 옵션', ['run', '--wordlist', 'content-source/wordlists/g4-r1.json, content-source/wordlists/g4-r1b.json']],
    ['혼합 옵션', ['run', '--wordlist', 'content-source/wordlists/g4-r1.json,content-source/wordlists/g4-r1b.json', '--wordlist', 'content-source/wordlists/g4-r1.json']],
  ])('%s의 여러 목록을 합치고 중복 칸을 한 번만 제작한다', async (_label, argv) => {
    const { root, options, deps } = setup();
    write(root, options.wordlist, { grade: 4, items: [words[0]] });
    write(root, 'content-source/wordlists/g4-r1b.json', { grade: 4, items: [words[0], words[1], words[2]] });
    const args = parseArgs(argv);
    const result = await produce({ ...options, wordlist: args.wordlist }, deps);
    expect(result.produced).toBe(3);
    expect(result.rejected).toBe(0);
    expect(results(result.stagingDir).drafts.map(q => [q.target.lemma, q.type])).toEqual(words.map(w => [w.lemma, 'cloze']));
    expect(() => selectItems(root, [{ grade: 4, items: words }, { grade: 5, items: words }], 4, 3)).toThrow('학년');
  });

  it.each([false, true])('유형별 초안을 대기하고 중간 문항 탈락 뒤에도 낱말을 분산한다(탈락=%s)', async rejectMiddle => {
    const { root, options, deps } = setup();
    write(root, options.wordlist, { grade: 4, items: [{ ...words[0], types: ['cloze', 'definition'] }, words[1]] });
    const definition = { ...drafts[0]!, stem: '선물을 “간직하다”에서 이 낱말의 뜻은 무엇일까요?', options: [
      { id: 'a', text: '잘 챙겨 두다' }, { id: 'b', text: '멀리 내던지다' }, { id: 'c', text: '잠깐 빌려주다' }, { id: 'd', text: '곧바로 가져가다' },
    ] };
    const last = { ...replies[0]!, questionId: 'g4-argon-0044', draft: definition, selfRefutation: definition.options.map(o => ({ optionId: o.id, substituted: `${definition.stem} ${o.text}`, verdict: o.id === 'a' ? 'fits' : 'does_not_fit', reason: '선물을 보관한다는 뜻과 맞는지 대조했어요.' })) };
    const middle = structuredClone(replies[1]!);
    if (rejectMiddle) middle.selfRefutation[0]!.verdict = 'does_not_fit';
    deps.respond.mockResolvedValueOnce(JSON.stringify({ items: [replies[0], middle, last] }));
    if (rejectMiddle) deps.respond.mockResolvedValueOnce(JSON.stringify({ items: [middle] }));
    const result = await produce(options, deps);
    const out = results(result.stagingDir);
    expect(result.produced).toBe(rejectMiddle ? 1 : 3);
    expect(result.rejected).toBe(rejectMiddle ? 2 : 0);
    expect(out.drafts.map(q => q.type)).toEqual(rejectMiddle ? ['cloze'] : ['cloze', 'cloze', 'definition']);
    expect(lint.lintBatchStrict(out.drafts)).toEqual([]);
    if (rejectMiddle) expect(out.side.rejected.some(r => /연속/.test(r.reason))).toBe(true);
  });
});

describe('S6 보충 제작', () => {
  it('3문항을 새 낱말 선택부터 근거·검사·배열 조정·대기 manifest까지 만든다', async () => {
    const { root, options, deps, evidence } = setup();
    const old = fs.readFileSync(path.join(root, 'content-source/batches/old/nested/drafts.json'), 'utf8');
    const result = await produce(options, deps);
    expect(result.produced).toBe(3);
    expect(result.rejected).toBe(0);
    expect(deps.fetchEvidence).toHaveBeenCalledTimes(1);
    const fetchArgs = deps.fetchEvidence.mock.calls[0] as unknown as [{ inputFile: string; outputDir: string }];
    expect(read(fetchArgs[0].inputFile)).toEqual(['word:간직하다', 'idiom:귀가 얇다', 'dialect:정구지']);
    expect(path.relative(root, fetchArgs[0].outputDir)).toMatch(/^\.orchestrate\/produce\/Q50-G4-022\/.+\/evidence$/);
    const call = deps.respond.mock.calls[0] as unknown as [{ prompt: string; cwd: string }];
    expect(call[0].prompt).toContain('뜻만 되풀이하는 해설');
    expect(call[0].prompt).toContain('전투 상한');
    expect(call[0].prompt).toContain('근거 전문 정구지');
    expect(call[0].prompt).toContain('명령 실행·파일 쓰기 금지');
    expect(fs.readdirSync(call[0].cwd)).toEqual([]);
    const { drafts: out, side } = results(result.stagingDir);
    expect(d.draftBatchSchema.safeParse(out).success).toBe(true);
    expect(d.draftSidecarSchema.safeParse(side).success).toBe(true);
    expect(out.map(q => q.id)).toEqual(['g4-argon-0042', 'g4-argon-0043', 'g4-argon-0044']);
    expect(out.map(q => q.correctOptionId)).toEqual(['b', 'd', 'a']);
    expect(out.map(q => q.difficultyTier)).toEqual(['basic', 'advanced', 'challenge']);
    expect(out.map(q => q.gradeBasis.unit)).toEqual(words.map(w => w.gradeEvidence));
    out.forEach((q, i) => {
      expect(q.revision).toBe(1);
      expect(q.status).toBe('machine_checked');
      expect(q.review).toEqual({ reviewerId: null, reviewedAt: null });
      expect(q.source.entryId).toBe(evidence.entries[i]!.wordNo);
      expect(q.source.evidenceHash).toBe(evidence.entries[i]!.sha256);
      expect(q.source.evidenceArtifactId).toBe(evidence.entries[i]!.file);
      expect(side.items[i]!.selfRefutation.filter(r => r.verdict === 'fits').map(r => r.optionId)).toEqual([q.correctOptionId]);
    });
    expect(side.jobId).toBe(batchId);
    expect(side.producer).toEqual({ model: 'Gemini 4 Argon (High)', tool: 'tools/orchestrate/produce.mjs', date: '2026-11-06' });
    expect(lint.lintBatchStrict(out)).toEqual([]);
    expect(read(path.join(result.stagingDir, 'manifest.json'))).toEqual(result.manifest);
    expect(Object.keys(result.manifest).sort()).toEqual(['batchId', 'createdAt', 'deletes', 'model', 'runId', 'tool', 'writes']);
    expect(result.manifest.runId).toMatch(/^20261106T031500000Z-\d+-[a-f0-9]+$/);
    expect(result.manifest.deletes).toEqual([]);
    expect(result.manifest.writes.map((w: { path: string }) => w.path)).toEqual([
      'drafts.json', 'sidecar.json', 'evidence/index.json', ...evidence.entries.map(e => `evidence/${e.file}`),
    ].map(file => `content-source/batches/${batchId}/${file}`));
    expect(read(path.join(result.stagingDir, 'files', `content-source/batches/${batchId}/evidence/index.json`)).entries).toEqual(evidence.entries);
    for (const e of evidence.entries) expect(fs.readFileSync(path.join(result.stagingDir, 'files', `content-source/batches/${batchId}/evidence/${e.file}`), 'utf8')).toBe(evidence.texts[e.file]);
    for (const w of result.manifest.writes as { path: string; sha256: string }[]) {
      expect(w.sha256).toBe(hash(fs.readFileSync(path.join(result.stagingDir, 'files', w.path), 'utf8')));
      expect(fs.existsSync(path.join(root, w.path))).toBe(false);
    }
    expect(fs.readFileSync(path.join(root, 'content-source/batches/old/nested/drafts.json'), 'utf8')).toBe(old);
    await expect(produce(options, deps)).rejects.toThrow('대기 결과');
  });

  it('표제어·품사·뜻 번호·해시가 다르거나 모호하면 그 낱말을 사유와 함께 제외한다', () => {
    const { root, evidence } = setup();
    const selected = selectItems(root, read(path.join(root, 'content-source/wordlists/g4-r1.json')), 4, 3);
    for (const patch of [{ headword: '다른말' }, { partOfSpeech: '명사' }, { senseOrder: 9 }, { sha256: '0'.repeat(64) }]) {
      const changed = structuredClone(evidence);
      Object.assign(changed.entries[0]!, patch);
      const result = prepare(root, batchId, 4, selected, changed);
      expect(result.accepted).toHaveLength(2);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].lemma).toBe('간직하다');
      expect(result.rejected[0].reason).toMatch(/불일치/);
    }
    const ambiguous = structuredClone(evidence);
    ambiguous.entries.push({ ...ambiguous.entries[0]!, wordNo: '999' });
    expect(prepare(root, batchId, 4, selected, ambiguous).rejected[0].reason).toContain('모호성');
    selected[0].gradeEvidence = '국어 2단원 20쪽';
    expect(prepare(root, batchId, 4, selected, evidence).rejected[0].reason).toContain('학년 근거');
    expect(evidenceInput([{ kind: 'proverb', lemma: '가는 말이 고와야 오는 말이 곱다' }])).toEqual(['proverb:가는 말이 고와야 오는 말이 곱다']);
  });

  it('기존 배치에는 근거 조회를 하지 않으며 dry-run 의존성 누락도 먼저 거부한다', async () => {
    const { root, options, deps } = setup();
    await expect(produce(options, { modules })).rejects.toThrow('가짜 응답기');
    write(root, `content-source/batches/${batchId}/drafts.json`, []);
    await expect(produce(options, deps)).rejects.toThrow('이미 drafts.json');
    expect(deps.fetchEvidence).not.toHaveBeenCalled();
    expect(deps.respond).not.toHaveBeenCalled();
  });

  it('틀린 답장 문항만 한 번 다시 요청하고 재실패는 sidecar.rejected로 남긴다', async () => {
    const { options, deps } = setup();
    const first = structuredClone(replies);
    first[1]!.selfRefutation[0]!.verdict = 'does_not_fit';
    first[2]!.draft.options[1]!.text = first[2]!.draft.options[0]!.text;
    const second = structuredClone(replies.slice(1));
    second[1]!.selfRefutation[0]!.verdict = 'does_not_fit';
    deps.respond.mockResolvedValueOnce(JSON.stringify({ items: first })).mockResolvedValueOnce(JSON.stringify({ items: second }));
    const result = await produce(options, deps);
    expect(deps.respond).toHaveBeenCalledTimes(2);
    const retry = deps.respond.mock.calls[1] as unknown as [{ items: { fixed: { id: string } }[] }];
    expect(retry[0].items.map(x => x.fixed.id)).toEqual(['g4-argon-0043', 'g4-argon-0044']);
    expect(result.produced).toBe(2);
    const output = results(result.stagingDir);
    expect(output.drafts.map(q => q.id)).toEqual(['g4-argon-0042', 'g4-argon-0043']);
    expect(output.side.rejected).toHaveLength(1);
    expect(output.side.rejected[0]!.lemma).toBe('정구지');
    expect(output.side.rejected[0]!.reason).toContain('정답만 fits');
  });

  it('잘못된 JSON은 두 번으로 멈추고 전부 거절되면 빈 초안을 게시하지 않는다', async () => {
    const { options, deps, evidence } = setup();
    deps.respond.mockResolvedValue('```json\n{"items":[');
    const result = await produce(options, deps);
    expect(deps.respond).toHaveBeenCalledTimes(2);
    expect(result.produced).toBe(0);
    expect(result.rejected).toBe(3);
    expect(result.manifest.writes.map((w: { path: string }) => w.path)).toEqual([
      'sidecar.json', 'evidence/index.json', ...evidence.entries.map(e => `evidence/${e.file}`),
    ].map(file => `content-source/batches/${batchId}/${file}`));
    const side = read(path.join(result.stagingDir, 'files', result.manifest.writes[0].path));
    expect(side.rejected.map((r: { lemma: string }) => r.lemma)).toEqual(words.map(w => w.lemma));
  });

  it('중복 문항·보기 ID·자체 반박 ID 및 모델의 source 주입을 거절한다', () => {
    const { root, evidence } = setup();
    const selected = selectItems(root, read(path.join(root, 'content-source/wordlists/g4-r1.json')), 4, 3);
    const list = prepare(root, batchId, 4, selected, evidence).accepted;
    const duplicate = { items: [...replies, replies[0]] };
    expect(parseDrafts(modules, JSON.stringify(duplicate), list).rejected[0].reason).toContain('중복');
    for (const target of ['options', 'selfRefutation', 'source']) {
      const changed = structuredClone(replies);
      if (target === 'options') changed[0]!.draft.options[1]!.id = 'a';
      else if (target === 'selfRefutation') changed[0]!.selfRefutation[1]!.optionId = 'a';
      else Object.assign(changed[0]!.draft, { source: { entryId: '모델이 지어낸 값' } });
      const parsed = parseDrafts(modules, JSON.stringify({ items: changed }), list);
      expect(parsed.accepted).toHaveLength(2);
      expect(parsed.rejected).toHaveLength(1);
    }
    expect(() => parseDrafts(modules, '{"items":[{"questionId":"unknown"}]}', list)).toThrow('요청하지 않은');
  });

  it('50문항의 정답 분포·연속·순환을 고치면서 보기/오답 이유/자체 반박의 결합을 지킨다', () => {
    const { root, evidence } = setup();
    const selected = selectItems(root, read(path.join(root, 'content-source/wordlists/g4-r1.json')), 4, 3);
    const list = prepare(root, batchId, 4, selected, evidence).accepted;
    const pair = parseDrafts(modules, JSON.stringify({ items: replies }), list).accepted[0] as { draft: QuestionDraft; side: DraftSidecar['items'][number] };
    const many = Array.from({ length: 50 }, (_, i) => ({ draft: { ...pair.draft, id: `g4-argon-${String(100 + i).padStart(4, '0')}`, stem: `${i}번 선물을 상자에 잘 (    ).`, target: { ...pair.draft.target, senseKey: `sense-${i}` } }, side: { ...pair.side } }));
    expect(lint.lintBatchStrict(many.map(p => p.draft))).toContain('같은 정답 번호가 4회 이상 연속된다');
    const out = balanceAnswers(many) as typeof many;
    expect(lint.lintBatchStrict(out.map(p => p.draft))).toEqual([]);
    for (const id of ['a', 'b', 'c', 'd']) {
      const count = out.filter(p => p.draft.correctOptionId === id).length;
      expect(count / 50).toBeGreaterThanOrEqual(0.16);
      expect(count / 50).toBeLessThanOrEqual(0.34);
    }
    const cyclic = many.map((p, i) => moveAnswer(p, ['a', 'b', 'c', 'd'][i % 4]));
    expect(lint.lintBatchStrict(cyclic.map((p: typeof pair) => p.draft))).toContain('규칙적인 순환 정답 패턴(abcdabcd 등)이 있다');
    expect(lint.lintBatchStrict(balanceAnswers(cyclic).map((p: typeof pair) => p.draft))).toEqual([]);
    for (const p of out) {
      expect(lint.lintQuestion(b.toBankQuestion(p.draft))).toEqual([]);
      expect(p.draft.revision).toBe(1);
      expect(p.side.selfRefutation.filter(r => r.verdict === 'fits').map(r => r.optionId)).toEqual([p.draft.correctOptionId]);
      for (const option of p.draft.options) {
        const original = pair.draft.options.find(o => o.text === option.text)!;
        expect(p.draft.distractorRationales[option.id]).toBe(pair.draft.distractorRationales[original.id]);
        expect(p.side.selfRefutation.find(r => r.optionId === option.id)).toEqual({ ...pair.side.selfRefutation.find(r => r.optionId === original.id), optionId: option.id });
      }
    }
    expect(pair.draft.correctOptionId).toBe('a');
  });

  it('현재 대화 ID와 요청 문항이 맞는 전문만 복원한다', () => {
    const { root, evidence } = setup();
    const list = prepare(root, batchId, 4, selectItems(root, read(path.join(root, 'content-source/wordlists/g4-r1.json')), 4, 3), evidence).accepted;
    const brain = path.join(root, 'brain');
    const id = '12345678-1234-1234-1234-123456789abc';
    write(brain, `${id}/response.json`, { items: replies });
    const truncated = `{"items":[\nconversation_id: ${id}`;
    expect(JSON.parse(recoverReply(truncated, list, brain)).items).toEqual(replies);
    expect(recoverReply('{"items":[', list, brain)).toBe('{"items":[');
    write(brain, `${id}/response.json`, { items: [{ questionId: '이전 작업' }] });
    expect(recoverReply(truncated, list, brain)).toBe(truncated);
  });

  it('반영 전 대기 초안도 사용 낱말과 ID 예약으로 인식한다', async () => {
    const { root, options, deps } = setup();
    await produce(options, deps);
    write(root, 'content-source/wordlists/g4-r2.json', { grade: 4, round: 2, items: [...words, { ...words[0], lemma: '새로운말' }] });
    const selected = selectItems(root, read(path.join(root, 'content-source/wordlists/g4-r2.json')), 4, 50);
    expect(selected.map((x: { lemma: string; id: string }) => [x.lemma, x.id])).toEqual([['새로운말', 'g4-argon-0045']]);
  });

  it('13문항은 12개와 1개로 나누고 동시 제작은 ID 배정 전에 막는다', async () => {
    const { root, options, deps, evidence } = setup();
    const extended = Array.from({ length: 13 }, (_, i) => ({ ...words[0], lemma: `낱말${i}` }));
    write(root, options.wordlist, { grade: 4, round: 1, items: extended });
    const entries = extended.map((w, i) => ({ ...evidence.entries[0]!, lemma: w.lemma, headword: w.lemma, wordNo: String(300 + i), file: `entry-${i}.txt`, sha256: hash(`뜻 ${i}`) }));
    const fetched = { entries, texts: Object.fromEntries(entries.map((e, i) => [e.file, `뜻 ${i}`])) };
    const responseItems = extended.map((_, i) => ({ ...replies[0], questionId: `g4-argon-${String(42 + i).padStart(4, '0')}`, draft: { ...drafts[0], stem: `${i}번 선물을 상자에 잘 (    ).` } }));
    deps.fetchEvidence.mockImplementationOnce(async () => {
      await expect(produce({ ...options, batchId: 'Q50-G4-023' }, deps)).rejects.toThrow('ID 예약 잠금');
      return fetched;
    });
    deps.respond.mockResolvedValueOnce(JSON.stringify({ items: responseItems.slice(0, 12) })).mockResolvedValueOnce(JSON.stringify({ items: responseItems.slice(12) }));
    const result = await produce({ ...options, count: 13 }, deps);
    expect(result.produced).toBe(13);
    expect(result.rejected).toBe(0);
    expect(deps.respond).toHaveBeenCalledTimes(2);
    const calls = deps.respond.mock.calls as unknown as [{ items: unknown[] }][];
    expect(calls.map(c => c[0].items.length)).toEqual([12, 1]);
    expect(fs.existsSync(path.join(root, '.orchestrate/produce/producer.lock'))).toBe(false);
    expect(fs.existsSync(path.join(result.stagingDir, 'manifest.tmp'))).toBe(false);
  });
});
