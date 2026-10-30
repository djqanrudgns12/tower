import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { blindReviewSchema, contentHashInput, draftBatchSchema, draftSidecarSchema } from '../../src/contracts/questionDraft';
import { bankFileSchema, readingLoad } from '../../src/contracts/questions';
import defaults from '../../docs/contracts/product.defaults.v0.5.json';
import { lintBatchStrict, lintQuestion } from '../../src/content/lint';
import { isPractice, MIN_PUBLISHED, PRACTICE_SIZE } from '../../tools/content/bankBuild';

// npm run validate:content / validate:assets의 본체. 작업자 RETURN은 이 검사를 통과해야 RETURNED다.
// 배치·보고서·manifest가 아직 없으면 해당 describe에는 시험이 생기지 않는다.
const banks = import.meta.glob('/src/content/questions/*.json', { eager: true, import: 'default' });
const drafts = import.meta.glob('/content-source/batches/*/drafts.json', { eager: true, import: 'default' });
const sidecars = import.meta.glob('/content-source/batches/*/sidecar.json', { eager: true, import: 'default' });
const reviews = import.meta.glob(['/content-source/reviews/*/*.json', '!/content-source/reviews/*/blind-input.json'], { eager: true, import: 'default' });
const blindInputs = import.meta.glob('/content-source/reviews/*/blind-input.json', { eager: true, import: 'default' }) as Record<string, { jobId: string; items: Array<{ questionId: string; revision: number; contentHash: string }> }>;
const manifests = import.meta.glob(['/public/assets/manifest.json', '/asset-source/incoming/*/manifest.json'], { eager: true, import: 'default' });
const caps = defaults.questionSelection.battleReadingLoadMaxSyllables as Record<string, number>;
const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');

describe('런타임 문제은행', () => {
  it('은행 파일이 하나 이상 있다', () => { expect(Object.keys(banks).length).toBeGreaterThan(0); });
  for (const [path, raw] of Object.entries(banks)) {
    it(`${path}: 스키마·의미 검사·전투 읽기 부담`, () => {
      const bank = bankFileSchema.parse(raw);
      const problems = bank.questions.flatMap(q => lintQuestion(q).map(p => `${q.id}: ${p}`));
      expect(problems).toEqual([]);
      const stems = bank.questions.map(q => q.stem.normalize('NFC'));
      expect(new Set(stems).size).toBe(stems.length);
      const eligible = bank.questions.filter(q => readingLoad(q) <= (caps[String(bank.grade)] ?? 70)).length;
      expect(eligible).toBeGreaterThanOrEqual(Math.min(20, bank.questions.length));
      // 학년 은행은 30문항 이상(PRD §9.4), 첫 연습 판 은행은 승인된 연습 문항 네 개 그대로다(PRD §12.2).
      if (bank.status === 'published' && bank.bankId === 'practice') expect(bank.questions.map(q => q.id).filter(isPractice)).toHaveLength(PRACTICE_SIZE);
      else if (bank.status === 'published') expect(bank.questions.length).toBeGreaterThanOrEqual(MIN_PUBLISHED);
    });
  }
  it('의미 검사는 정답만 긴 보기·빈칸 누락·긴 해설을 잡는다', () => {
    const base = { id: 'g3-x-0001', grade: 3, type: 'cloze', target: { lemma: '줍다' }, correctOptionId: 'a' as const, distractorRationales: { b: '가', c: '나', d: '다' } };
    const issues = lintQuestion({ ...base, stem: '쓰레기를 주웠어요.', explanation: '가'.repeat(61), options: [{ id: 'a', text: '아주 길고 길고 긴 정답 보기입니다' }, { id: 'b', text: '짧다' }, { id: 'c', text: '작다' }, { id: 'd', text: '낮다' }] });
    expect(issues).toEqual(expect.arrayContaining(['정답 보기만 눈에 띄게 길다', '빈칸 문제에 ‘(    )’ 빈칸이 없다', '해설은 1~2문장 60자 이내(61자)']));
  });
});

describe.skipIf(Object.keys(drafts).length === 0)('제작 초안 배치(content-source)', () => {
  for (const [path, raw] of Object.entries(drafts)) {
    const dir = path.replace(/\/drafts\.json$/, '');
    const batchId = dir.split('/').pop() ?? '';
    it(`${dir}: 초안 스키마·의미 검사·sidecar·근거 해시`, () => {
      const batch = draftBatchSchema.parse(raw);
      expect(batch.flatMap(q => lintQuestion(q).map(p => `${q.id}: ${p}`))).toEqual([]);
      if (batchId.startsWith('Q50-')) {
        expect(lintBatchStrict(batch)).toEqual([]);
      }
      const sidecar = draftSidecarSchema.parse(sidecars[`${dir}/sidecar.json`]);
      for (const q of batch) {
        const item = sidecar.items.find(i => i.id === q.id && i.revision === q.revision);
        expect(item, `${q.id} sidecar 없음`).toBeDefined();
        expect(item!.selfRefutation.filter(r => r.verdict === 'fits').map(r => r.optionId)).toEqual([q.correctOptionId]);
        const evidence = `.${dir}/evidence/${q.source.evidenceArtifactId}`;
        expect(existsSync(evidence), `${evidence} 근거 파일 없음`).toBe(true);
        expect(sha256(readFileSync(evidence))).toBe(q.source.evidenceHash);
      }
    });
  }
});

describe('독립 검토 보고서', () => {
  for (const [path, raw] of Object.entries(reviews)) {
    it(`${path}: 형식`, () => { expect(blindReviewSchema.safeParse(raw).error?.issues ?? []).toEqual([]); });
  }
  for (const [path, input] of Object.entries(blindInputs)) {
    // 검토자 작업 폴더에는 정답 원본(batches)이 없다. 그때는 해시 대조를 건너뛰고 형식만 본다.
    const batchPath = `/content-source/batches/${input.jobId}/drafts.json`;
    it.skipIf(!(batchPath in drafts))(`${path}: tools/make-blind-input.mjs의 해시가 TS 정규화와 같다`, () => {
      const batch = draftBatchSchema.parse(drafts[batchPath]);
      for (const item of input.items) {
        const q = batch.find(x => x.id === item.questionId && x.revision === item.revision)!;
        expect(sha256(contentHashInput(q))).toBe(item.contentHash);
      }
    });
  }
  it('contentHash 입력은 보기 순서와 무관하게 같다', () => {
    const base = { id: 'g3-x-0001', revision: 1, type: 'definition' as const, target: { lemma: '가', partOfSpeech: '명사', senseKey: 'k' }, stem: 's', correctOptionId: 'a' as const, explanation: 'e' };
    const a = contentHashInput({ ...base, options: [{ id: 'b', text: '둘' }, { id: 'a', text: '하나' }, { id: 'c', text: '셋' }, { id: 'd', text: '넷' }] });
    const b = contentHashInput({ ...base, options: [{ id: 'a', text: '하나' }, { id: 'b', text: '둘' }, { id: 'c', text: '셋' }, { id: 'd', text: '넷' }] });
    expect(sha256(a)).toBe(sha256(b));
    expect(sha256(a)).not.toBe(sha256(contentHashInput({ ...base, correctOptionId: 'b', options: [{ id: 'a', text: '하나' }, { id: 'b', text: '둘' }, { id: 'c', text: '셋' }, { id: 'd', text: '넷' }] })));
  });
});

describe.skipIf(Object.keys(manifests).length === 0)('에셋 manifest(validate:assets)', () => {
  for (const [path, raw] of Object.entries(manifests)) {
    it(`${path}: 형식·PNG 크기·알파·해시`, () => {
      const m = assetManifestSchema.parse(raw);
      const dir = `.${path.replace(/\/manifest\.json$/, '')}`;
      for (const a of m.assets) {
        const file = `${dir}/${a.file}`;
        expect(existsSync(file), `${file} 없음`).toBe(true);
        const png = readFileSync(file);
        expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([a.width, a.height]);
        // 색 형식 6(RGBA) 또는 4(회색+알파)만 실제 투명도를 가진다. 체크무늬 배경을 투명으로 보지 않는다.
        expect([4, 6]).toContain(png[25]);
        expect(sha256(png)).toBe(a.artifactHash);
      }
    });
  }
});
