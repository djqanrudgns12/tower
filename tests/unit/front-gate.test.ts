import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as front from '../../tools/content/frontGate';
import * as b from '../../tools/content/bankBuild';
import * as d from '../../src/contracts/questionDraft';
import * as lint from '../../src/content/lint';
import { assessLevel } from '../../tools/content/levels';
import type { LevelJudge } from '../../src/contracts/levels';
import type { OptionId } from '../../src/contracts/questions';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { flagged, parseRevisions, apply, pendingJson, readReviseLog, gatePassedKeys, reviseBatch, promptFor } from '../../tools/orchestrate/revise.mjs';

vi.mock('node:child_process', () => ({ spawn: vi.fn(() => { throw new Error('시험 중 모델 호출 금지'); }) }));

const m = { b, d, lint, front };
const source = b.loadBatches(process.cwd());
const pilot = source.find(batch => batch.batchId === 'Q20-001')!;
const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture(sequence = 'a', batchId = 'Q50-G4-TEST'): b.BatchInput {
  const base = pilot.drafts[0]!;
  const drafts = [...sequence].map((answer, i): d.QuestionDraft => ({
    ...structuredClone(base), batchId, id: `g4-test-${String(i + 1).padStart(4, '0')}`, revision: 3, grade: 4,
    difficultyTier: 'basic', variantTag: 'standard', type: 'cloze',
    target: { lemma: `낱말${i}`, partOfSpeech: '명사', senseKey: `test/${i}` },
    gradeBasis: { ...base.gradeBasis, unit: 'stdict:전문어 표지 없음' },
    stem: `${i}번 빈칸에 알맞은 말은? (    )`,
    options: [{ id: 'a', text: '나무' }, { id: 'b', text: '바람' }, { id: 'c', text: '하늘' }, { id: 'd', text: '구름' }],
    correctOptionId: answer as OptionId, explanation: '문맥에 맞는 말이에요.',
    distractorRationales: Object.fromEntries(['a', 'b', 'c', 'd'].filter(id => id !== answer).map(id => [id, `${id}는 문맥에 맞지 않아요.`])),
  }));
  const sidecar: d.DraftSidecar = { ...structuredClone(pilot.sidecar), batchId, items: drafts.map(q => ({
    id: q.id, revision: q.revision, uniquenessNote: '정답 하나', gradeEvidence: '학년 적합',
    selfRefutation: q.options.map(o => ({ optionId: o.id, substituted: o.text, verdict: o.id === q.correctOptionId ? 'fits' : 'does_not_fit', reason: `${o.text} 대입` })),
  })), rejected: [] };
  const report: d.BlindReview = { ...structuredClone(pilot.reviews.codex!), items: drafts.map(q => ({
    questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), blindChoice: q.correctOptionId,
    verdicts: { source: 'pass', uniqueness: 'pass', grade: 'pass', language: 'pass', explanation: 'uncertain' }, findings: [],
  })) };
  return { batchId, drafts, sidecar, reviews: { codex: report }, argonBlind: null, explanation: null };
}
function levels(batch: b.BatchInput, change: Partial<LevelJudge> = {}) {
  return { batchId: batch.batchId, rubricVersion: 'lv1', items: batch.drafts.map(q => {
    const judge = (who: LevelJudge['judge']): LevelJudge => ({
      questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), judge: who, model: 'fixture',
      L1: 1, L2: 1, T1: 0, inference: 0, idiomOpacity: null, elementaryFit: 'pass',
      basisType: 'stdict_structural', unit: q.gradeBasis.unit, reason: '시험 근거', ...change,
    });
    return assessLevel(q, judge('argon'), judge('codex'));
  }) };
}
function gatePass(batch: b.BatchInput) {
  batch.reviews.claude = structuredClone(batch.reviews.codex!);
  batch.explanation = { batchId: batch.batchId, reviewer: { model: 'Claude', role: 'commander', date: '2026-11-06' },
    items: batch.drafts.map(q => ({ questionId: q.id, revision: q.revision, contentHash: b.contentHash(q), rationalesHash: b.rationalesHash(q), explanation: 'pass', findings: [] })) };
}
function write(root: string, file: string, value: unknown) {
  const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, JSON.stringify(value));
}
function temp(batch: b.BatchInput) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'front-gate-')); roots.push(root);
  write(root, file(batch, 'drafts'), batch.drafts); write(root, file(batch, 'sidecar'), batch.sidecar);
  return root;
}
const file = (batch: b.BatchInput, name: string) => `content-source/batches/${batch.batchId}/${name}.json`;
function revision(batch: b.BatchInput, phase = 'front', rounds = { front: 0, gate: 0 }) {
  const q = batch.drafts[0]!;
  const list = [{ q, phase, rounds, reasons: ['시험 결함'], findings: [] }];
  const reply = { items: [{ questionId: q.id, action: 'revise', draft: { ...q, revision: q.revision + 1, status: 'machine_checked', explanation: '다듬은 해설이에요.' },
    ...batch.sidecar.items[0], selfRefutation: batch.sidecar.items[0]!.selfRefutation }] };
  return { list, reply, parsed: parseRevisions(m, JSON.stringify(reply), list) };
}

describe('앞단 pass·defect·pending', () => {
  it('Claude·해설 없이 Codex와 수준 합의로 통과한다', () => {
    const batch = fixture();
    expect(front.frontGate(batch, levels(batch))).toEqual({ batchDefects: [], items: [{ questionId: batch.drafts[0]!.id, revision: 3, contentHash: b.contentHash(batch.drafts[0]!), status: 'pass', defects: [], pending: [] }] });
  });
  it('Codex·수준 합의 없음은 결함이 아니라 pending이다', () => {
    const batch = fixture(); batch.reviews = {};
    const item = front.frontGate(batch, null).items[0]!;
    expect(item.status).toBe('pending'); expect(item.defects).toEqual([]); expect(item.pending).toHaveLength(2);
    expect(flagged(m, batch)).toEqual([]);
  });
  it('옛 revision·다른 본문 해시·변조한 수준 합의는 통과 근거가 아니다', () => {
    const batch = fixture(), level = levels(batch);
    batch.reviews.codex!.items[0]!.contentHash = '0'.repeat(64);
    level.items[0]!.levelAssessmentHash = '0'.repeat(64);
    expect(front.frontGate(batch, level).items[0]).toMatchObject({ status: 'pending', defects: [] });
    batch.drafts[0]!.revision++;
    batch.sidecar.items[0]!.revision++;
    expect(front.frontGate(batch, levels(fixture())).items[0]!.pending).toHaveLength(2);
  });
  it('tier 미반영은 pending이고 현재 수준 합의의 금지 조건은 defect다', () => {
    const batch = fixture(), level = levels(batch); batch.drafts[0]!.difficultyTier = 'core';
    expect(front.frontGate(batch, level).items[0]!.pending).toEqual(['tier 미반영']);
    expect(front.frontGate(batch, levels(batch, { elementaryFit: 'too_high' })).items[0]!.defects).toContain('수준 합의: elementaryFit 금지 조건');
    expect(front.frontGate(batch, levels(batch, { L1: 3, L2: 3, T1: 3 })).items[0]!.defects).toContain('수준 합의: too_hard');
  });
  it('학년 근거는 현재 합의가 있을 때만 검사하며 정본 코드를 대조한다', () => {
    const batch = fixture(); batch.drafts[0]!.gradeBasis.unit = '[4국04-03] 문장';
    expect(front.frontGate(batch, null).items[0]!.defects).toEqual([]);
    const root = temp(batch);
    expect(front.frontGate(batch, levels(batch), { root }).items[0]!.status).toBe('defect');
    write(root, 'content-source/reference/curriculum-2022.json', { standards: [{ code: '4국04-03' }] });
    expect(front.frontGate(batch, levels(batch), { root }).items[0]!.status).toBe('pass');
  });
  it('자체 반박의 중복 보기와 복수 fits를 거절한다', () => {
    const batch = fixture(); batch.sidecar.items[0]!.selfRefutation[1]!.verdict = 'fits';
    expect(front.frontGate(batch, levels(batch)).items[0]!.status).toBe('defect');
    batch.sidecar.items[0]!.selfRefutation[1] = structuredClone(batch.sidecar.items[0]!.selfRefutation[2]!);
    expect(front.frontGate(batch, levels(batch)).items[0]!.defects).toContain('Argon 자체 반박에서 정답만 fits여야 한다');
  });
  it('Codex 불일치·uncertain·해설 fail을 결함으로 분류한다', () => {
    const batch = fixture(), review = batch.reviews.codex!.items[0]!;
    review.blindChoice = 'multiple'; review.verdicts.grade = 'uncertain'; review.verdicts.explanation = 'fail';
    expect(front.frontGate(batch, levels(batch)).items[0]!.defects).toEqual(['codex: 독립 풀이 multiple ≠ 정답', 'codex: grade uncertain', 'codex: explanation fail']);
  });
  it('basic 읽기량과 배치 결함을 분리한다', () => {
    const batch = fixture('a'.repeat(20)); batch.drafts[0]!.stem += '가'.repeat(81);
    const result = front.frontGate(batch, levels(batch));
    expect(result.items[0]!.defects.some(s => s.includes('basic 단계 문항 읽기 부담 과다'))).toBe(true);
    expect(result.batchDefects).toContain('같은 정답 번호가 4회 이상 연속된다');
    expect(result.items[1]!.defects).toEqual([]);
  });
  it('argon-blind 단독 결함의 실측 사례 g4-argon-0107@2를 잡는다', () => {
    const batch = source.find(b => b.batchId === 'Q50-G4-003')!;
    const item = front.frontGate(batch, null).items.find(i => i.questionId === 'g4-argon-0107')!;
    expect(item).toMatchObject({ revision: 2, status: 'defect' });
    expect(item.defects).toContain('argon-blind: language fail');
    expect(flagged(m, batch).find((i: { q: d.QuestionDraft }) => i.q.id === item.questionId)).toMatchObject({ phase: 'front', reasons: ['argon-blind: language fail'] });
  });
  it('최신 revision만 판정하고 Argon의 옛 판은 요구하지 않는다', () => {
    const batch = fixture(); batch.argonBlind = structuredClone(batch.reviews.codex!);
    batch.argonBlind.items[0]!.revision--;
    batch.argonBlind.items[0]!.verdicts.language = 'fail';
    batch.drafts.unshift({ ...batch.drafts[0]!, revision: 2 });
    const result = front.frontGate(batch, levels({ ...batch, drafts: batch.drafts.slice(1) }));
    expect(result.items).toHaveLength(1); expect(result.items[0]!.status).toBe('pass');
  });
});

describe('수정 단계와 회차', () => {
  it('Claude·해설 지적은 gate, 앞단과 겹치면 front다', () => {
    const batch = fixture(); gatePass(batch);
    batch.reviews.claude!.items[0]!.verdicts.language = 'fail';
    expect(flagged(m, batch)[0].phase).toBe('gate');
    batch.reviews.codex!.items[0]!.verdicts.source = 'fail';
    expect(flagged(m, batch)[0].phase).toBe('front');
    batch.reviews.codex!.items[0]!.verdicts.source = 'pass';
    batch.reviews.claude!.items[0]!.verdicts.language = 'pass';
    batch.explanation!.items[0]!.explanation = 'fail';
    expect(flagged(m, batch)[0].reasons).toEqual(['총괄 해설 대조 fail: ']);
  });
  it('revision 3도 이번 단계 첫 수정이면 받아들이며 단계 한도만 적용한다', () => {
    const batch = fixture();
    expect(revision(batch).parsed.accepted[0]).toMatchObject({ action: 'revise', phase: 'front', draft: { revision: 4 } });
    expect(revision(batch, 'gate', { front: 2, gate: 0 }).parsed.accepted[0].action).toBe('revise');
    expect(revision(batch, 'front', { front: 2, gate: 0 }).parsed.accepted[0]).toMatchObject({ action: 'drop', reason: 'front 수정 2회 한도 소진' });
    expect(revision(batch, 'gate', { front: 0, gate: 2 }).parsed.accepted[0].action).toBe('drop');
    expect(promptFor(temp(batch), batch.batchId, revision(batch).list)).not.toContain('revision 3 이상');
  });
  it('changes 응답은 전체 draft 응답과 같은 검증 결과를 내고 원본을 보존한다', () => {
    const batch = fixture(), original = structuredClone(batch), { list, reply, parsed } = revision(batch);
    const { draft, ...item } = reply.items[0]!;
    const compact = { items: [{ ...item, changes: { explanation: draft.explanation } }] };
    expect(parseRevisions(m, JSON.stringify(compact), list)).toEqual(parsed);
    expect(parsed.accepted[0].draft).toMatchObject({ revision: 4, status: 'machine_checked', target: batch.drafts[0]!.target, source: batch.drafts[0]!.source });
    expect(batch).toEqual(original);
    const prompt = promptFor(temp(batch), batch.batchId, list);
    expect(prompt).toContain('"changes"');
    expect(prompt).toContain('파일을 읽거나 추가 조회하지 말고');
    expect(prompt).not.toContain('고친 draft 전체');
  });
  it.each(['source', 'target', 'grade', 'gradeBasis', 'review', 'schemaVersion', 'id', 'batchId', 'revision', 'status', 'unknown', '__proto__'])('changes의 고정·알 수 없는 필드 %s를 거절한다', key => {
    const batch = fixture(), { list, reply } = revision(batch);
    const { draft, ...item } = reply.items[0]!;
    const changes = { explanation: draft.explanation, [key]: '변경 금지' };
    const result = parseRevisions(m, JSON.stringify({ items: [{ ...item, changes }] }), list);
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toContain(`changes에 허용되지 않은 필드: ${key}`);
  });
  it.each([null, [], ['문자'], '문자', 1].map(changes => ({ changes })))('changes는 배열·스칼라·null이 아닌 객체만 받는다: %j', ({ changes }) => {
    const { list, reply } = revision(fixture());
    const item = { ...reply.items[0], draft: undefined, changes };
    const result = parseRevisions(m, JSON.stringify({ items: [item] }), list);
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toContain('changes는 객체여야 한다');
  });
  it('draft와 changes 동시 입력은 어느 쪽도 선택하지 않고 거절한다', () => {
    const { list, reply } = revision(fixture());
    const result = parseRevisions(m, JSON.stringify({ items: [{ ...reply.items[0], changes: { explanation: '다른 해설' } }] }), list);
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toContain('draft와 changes를 함께 쓸 수 없다');
  });
  it('changes도 스키마·의미·자체 반박과 단계별 수정 한도를 그대로 검사한다', () => {
    const { list, reply } = revision(fixture());
    const item = { ...reply.items[0], draft: undefined, changes: { explanation: '가'.repeat(61) } };
    expect(parseRevisions(m, JSON.stringify({ items: [item] }), list).rejected[0]).toContain('의미 검사');
    expect(parseRevisions(m, JSON.stringify({ items: [{ ...item, changes: { options: [] } }] }), list).rejected[0]).toContain('초안 형식');
    expect(parseRevisions(m, JSON.stringify({ items: [{ ...item, changes: { explanation: '알맞은 해설이에요.' }, selfRefutation: [] }] }), list).rejected[0]).toContain('자체 반박 형식');
    const exhausted = list.map(entry => ({ ...entry, rounds: { ...entry.rounds, front: 2 } }));
    expect(parseRevisions(m, JSON.stringify({ items: [item] }), exhausted).accepted[0]).toMatchObject({ action: 'drop', reason: 'front 수정 2회 한도 소진' });
  });
  it('다른 대상·고정 필드 변경·누락 답장·잘못된 action을 거절한다', () => {
    const batch = fixture(), { list, reply } = revision(batch);
    reply.items[0]!.draft.source = { ...reply.items[0]!.draft.source, entryId: 'changed' };
    expect(parseRevisions(m, JSON.stringify(reply), list).rejected[0]).toContain('source는 바꿀 수 없다');
    expect(parseRevisions(m, '{"items":[]}', list).rejected).toEqual([`${batch.drafts[0]!.id}: 답이 없다`]);
    reply.items[0]!.action = 'unknown';
    expect(parseRevisions(m, JSON.stringify(reply), list).rejected[0]).toContain('알 수 없는 action');
  });
  it('staging만 쓰며 파일 해시와 회차를 남기고 재시작·한도 초과 drop을 이어 간다', async () => {
    const batch = fixture(), root = temp(batch);
    const original = fs.readFileSync(path.join(root, file(batch, 'drafts')), 'utf8');
    const first = await apply(root, batch.batchId, revision(batch).parsed.accepted, { modules: m, batch, model: 'fixture' });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, first.staging, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({ batchId: batch.batchId, tool: 'revise', model: 'fixture', deletes: [] });
    expect(manifest.writes.map((w: { path: string }) => w.path).sort()).toEqual(['drafts', 'sidecar', 'revise-log'].map(n => file(batch, n)).sort());
    for (const w of manifest.writes) expect(createHash('sha256').update(fs.readFileSync(path.join(root, first.staging, 'files', w.path))).digest('hex')).toBe(w.sha256);
    expect(fs.readFileSync(path.join(root, file(batch, 'drafts')), 'utf8')).toBe(original);
    expect(fs.existsSync(path.join(root, file(batch, 'revise-log')))).toBe(false);
    let log = readReviseLog(root, batch.batchId);
    expect(log.items[batch.drafts[0]!.id]).toMatchObject({ front: 1, gate: 0, dropped: false, history: [{ phase: 'front', revisionFrom: 3, revisionTo: 4, reasons: ['시험 결함'] }] });
    batch.drafts = pendingJson(root, batch.batchId, file(batch, 'drafts'));
    batch.sidecar = pendingJson(root, batch.batchId, file(batch, 'sidecar'));
    await apply(root, batch.batchId, revision(batch).parsed.accepted, { modules: m, batch });
    batch.drafts = pendingJson(root, batch.batchId, file(batch, 'drafts'));
    batch.sidecar = pendingJson(root, batch.batchId, file(batch, 'sidecar'));
    log = readReviseLog(root, batch.batchId);
    expect(log.items[batch.drafts[0]!.id].front).toBe(2);
    const parsed = parseRevisions(m, JSON.stringify(revision(batch).reply), revision(batch).list, log);
    expect(parsed.accepted[0].action).toBe('drop');
    const last = await apply(root, batch.batchId, parsed.accepted, { modules: m, batch });
    expect(last.closed).toBe(true);
    expect(readReviseLog(root, batch.batchId).items[batch.drafts[0]!.id]).toMatchObject({ front: 2, gate: 0, dropped: true });
    expect(pendingJson(root, batch.batchId, file(batch, 'closed'))).toMatchObject({ batchId: batch.batchId });
    expect(fs.readFileSync(path.join(root, file(batch, 'drafts')), 'utf8')).toBe(original);
  });
  it('같은 시각에 재시작해도 staging을 시간순으로 정렬하고 다음 판은 다시 앞단 대기한다', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
    const batch = fixture(), root = temp(batch);
    const first = await apply(root, batch.batchId, revision(batch).parsed.accepted, { modules: m, batch });
    batch.drafts = pendingJson(root, batch.batchId, file(batch, 'drafts'));
    batch.sidecar = pendingJson(root, batch.batchId, file(batch, 'sidecar'));
    const second = await apply(root, batch.batchId, revision(batch, 'gate').parsed.accepted, { modules: m, batch });
    const manifest = (staging: string) => JSON.parse(fs.readFileSync(path.join(root, staging, 'manifest.json'), 'utf8'));
    expect(Date.parse(manifest(second.staging).createdAt)).toBeGreaterThan(Date.parse(manifest(first.staging).createdAt));
    expect(first.staging < second.staging).toBe(true);
    const log = readReviseLog(root, batch.batchId);
    expect(log.items[batch.drafts[0]!.id]).toMatchObject({ front: 1, gate: 1, dropped: false });
    expect(flagged({ ...m, root }, batch)).toEqual([]);
    batch.drafts = pendingJson(root, batch.batchId, file(batch, 'drafts'));
    batch.sidecar = pendingJson(root, batch.batchId, file(batch, 'sidecar'));
    expect(front.frontGate(batch, levels(fixture())).items[0]!.status).toBe('pending');
  });
  it('버림 뒤 생긴 분포 편중을 함께 해소하고 보기 이동 회차를 남긴다', async () => {
    const batch = fixture('aaabaaabaabbbcccdddcd'), root = temp(batch);
    expect(lint.lintBatchStrict(batch.drafts)).toEqual([]);
    const drop = batch.drafts.at(-1)!;
    // 21개 중 a=8은 허용되지만 d 하나를 버리면 20개 상한은 7로 내려간다.
    expect(drop.correctOptionId).toBe('d');
    const result = await apply(root, batch.batchId, [{ q: drop, action: 'drop', phase: 'gate', reason: '수정 불가' }], { modules: m, batch });
    const drafts = pendingJson(root, batch.batchId, file(batch, 'drafts')) as d.QuestionDraft[];
    expect(drafts).toHaveLength(20);
    expect(lint.lintBatchStrict(drafts)).toEqual([]);
    expect(result.changed).toHaveLength(1);
    const changed = drafts.find(q => q.revision === 4)!;
    expect(readReviseLog(root, batch.batchId).items[changed.id]).toMatchObject({ front: 1, gate: 0, history: [{ phase: 'front', revisionFrom: 3, revisionTo: 4 }] });
  });
  it('이미 수정 중인 문항의 보기 이동은 최종 revision+1 한 회차로 합친다', async () => {
    const batch = fixture('abcd'.repeat(5)), root = temp(batch);
    const target = batch.drafts[6]!;
    const { parsed } = revision({ ...batch, drafts: [target], sidecar: { ...batch.sidecar, items: [batch.sidecar.items[6]!] } });
    const locks = new Set(batch.drafts.filter((_, i) => i !== 6 && i !== 14).map(q => `${q.id}@${q.revision}`));
    const result = await apply(root, batch.batchId, parsed.accepted, { modules: m, batch, gatePassed: locks });
    const drafts = pendingJson(root, batch.batchId, file(batch, 'drafts')) as d.QuestionDraft[];
    expect(lint.lintBatchStrict(drafts)).toEqual([]);
    expect(drafts[6]!.revision).toBe(4);
    for (const key of result.changed) expect(drafts.some(q => `${q.id}@${q.revision}` === key)).toBe(true);
    expect(readReviseLog(root, batch.batchId).items[target.id]).toMatchObject({ front: 1, history: [{ revisionFrom: 3, revisionTo: 4, reasons: ['시험 결함', '배치 엄격 결함: 보기 순서 재배열'] }] });
  });
  it('낡은 대상과 변조된 staging은 추적 파일 변경 없이 거절한다', async () => {
    const batch = fixture(), root = temp(batch), accepted = revision(batch).parsed.accepted;
    const result = await apply(root, batch.batchId, accepted, { modules: m, batch });
    await expect(apply(root, batch.batchId, accepted, { modules: m, batch })).rejects.toThrow('현재 초안과 다르다');
    fs.appendFileSync(path.join(root, result.staging, 'files', file(batch, 'drafts')), ' ');
    expect(() => pendingJson(root, batch.batchId, file(batch, 'drafts'))).toThrow('staging 해시 불일치');
    expect(JSON.parse(fs.readFileSync(path.join(root, file(batch, 'drafts')), 'utf8'))).toEqual(batch.drafts);
  });
  it('한도를 소진하고 다시 지적된 문항은 모델 호출 없이 버린다', async () => {
    const batch = fixture(), root = temp(batch), id = batch.drafts[0]!.id;
    batch.sidecar.items[0]!.selfRefutation[1]!.verdict = 'fits';
    write(root, file(batch, 'sidecar'), batch.sidecar);
    write(root, file(batch, 'revise-log'), { batchId: batch.batchId, items: { [id]: { front: 2, gate: 0, dropped: false, history: [] } } });
    const result = await reviseBatch({ ...m, root }, root, batch.batchId, 'unused', () => {});
    expect(result).toMatchObject({ revised: 0, dropped: 1, closed: true });
    expect(readReviseLog(root, batch.batchId).items[id]).toMatchObject({ front: 2, dropped: true });
  });
  it('closed 배치를 초안 파싱 전 건너뛰며 종료 대기도 모델 호출 없이 건너뛴다', async () => {
    const batch = fixture(), root = temp(batch);
    await apply(root, batch.batchId, [{ q: batch.drafts[0], phase: 'front', action: 'drop', reason: '수정 불가' }], { modules: m, batch });
    expect(await reviseBatch({ ...m, root }, root, batch.batchId, 'unused', () => {})).toEqual({ batchId: batch.batchId, revised: 0, dropped: 0, rejected: 0 });
    write(root, file(batch, 'closed'), { batchId: batch.batchId });
    write(root, file(batch, 'drafts'), []);
    expect(b.loadBatches(root)).toEqual([]);
  });
});

describe('최소 보기 재배열', () => {
  it.each(['a'.repeat(20), 'abcd'.repeat(5), 'dcba'.repeat(5), 'aaaabbbbccccddddabcd'])('%s 분포·연속·순환을 해소하고 모든 연결 필드를 보존한다', sequence => {
    const batch = fixture(sequence), original = structuredClone(batch);
    const fixed = front.fixBatchStrict(batch.drafts, batch.sidecar, new Set());
    expect(lint.lintBatchStrict(fixed.drafts)).toEqual([]);
    expect(batch).toEqual(original);
    for (const [i, q] of fixed.drafts.entries()) {
      const old = batch.drafts[i]!;
      expect(lint.lintQuestion(q)).toEqual([]);
      expect(q.options.find(o => o.id === q.correctOptionId)!.text).toBe(old.options.find(o => o.id === old.correctOptionId)!.text);
      const side = fixed.sidecar.items.find(s => s.id === q.id)!;
      expect(front.selfRefutationPasses(q, side)).toBe(true);
      for (const o of q.options) {
        const oldId = old.options.find(prev => prev.text === o.text)!.id;
        expect(q.distractorRationales[o.id]).toBe(old.distractorRationales[oldId]);
        expect(side.selfRefutation.find(r => r.optionId === o.id)!.substituted).toBe(o.text);
      }
      expect(q.revision).toBe(old.revision + Number(q.correctOptionId !== old.correctOptionId));
    }
    // 20개 모두 a면 상한 7개이므로 적어도 13개를 바꾸어야 한다.
    if (sequence === 'a'.repeat(20)) expect(fixed.changed).toHaveLength(13);
  });
  it('순환 2개를 깨는 최소 두 문항만 바꾸고 잠긴 문항은 보존한다', () => {
    const batch = fixture('abcd'.repeat(5)); gatePass(batch);
    const locks = gatePassedKeys(m, batch);
    locks.delete(`${batch.drafts[6]!.id}@3`); locks.delete(`${batch.drafts[14]!.id}@3`);
    const fixed = front.fixBatchStrict(batch.drafts, batch.sidecar, locks);
    expect(fixed.changed).toHaveLength(2);
    expect(lint.lintBatchStrict(fixed.drafts)).toEqual([]);
    for (const [i, q] of fixed.drafts.entries()) if (locks.has(`${q.id}@3`)) expect(q).toEqual(batch.drafts[i]);
    expect(() => front.fixBatchStrict(batch.drafts, batch.sidecar, gatePassedKeys(m, batch))).toThrow('해소할 수 없다');
  });
  it('50문항 편중도 최소 33개만 고치고 잠긴 끝부분의 불가능한 연속을 거절한다', () => {
    const batch = fixture('a'.repeat(50));
    const fixed = front.fixBatchStrict(batch.drafts, batch.sidecar, new Set());
    expect(fixed.changed).toHaveLength(33);
    expect(lint.lintBatchStrict(fixed.drafts)).toEqual([]);
    const locked = new Set(batch.drafts.slice(-4).map(q => `${q.id}@${q.revision}`));
    expect(() => front.fixBatchStrict(batch.drafts, batch.sidecar, locked)).toThrow('해소할 수 없다');
  });
  it('문항 결함·자체 반박 불일치 문항은 옮기지 않고 다음 수정 회차로 남긴 채 배치 결함만 해소한다', () => {
    const batch = fixture('a'.repeat(20));
    batch.drafts[0]!.explanation = '가'.repeat(61);
    batch.sidecar.items[1]!.selfRefutation[1]!.verdict = 'fits';
    const fixed = front.fixBatchStrict(batch.drafts, batch.sidecar, new Set());
    expect(fixed.drafts[0]).toEqual(batch.drafts[0]);
    expect(fixed.drafts[1]).toEqual(batch.drafts[1]);
    const left = lint.lintBatchStrict(fixed.drafts);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every(s => s.startsWith(`${batch.drafts[0]!.id}: `))).toBe(true);
  });
  it('유효한 배치는 판을 올리지 않는다', () => {
    const batch = fixture('abacbdcdabdcabdcabcd');
    expect(lint.lintBatchStrict(batch.drafts)).toEqual([]);
    expect(front.fixBatchStrict(batch.drafts, batch.sidecar, new Set())).toEqual({ drafts: batch.drafts, sidecar: batch.sidecar, changed: [] });
  });
});
