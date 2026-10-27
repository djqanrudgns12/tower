import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// 독립 검토용 입력을 만든다: 정답 키·해설·오답 이유를 지운다(model_work_orders_v0_5 §10).
// 사용: node tools/make-blind-input.mjs Q20-001  → content-source/reviews/Q20-001/blind-input.json
// contentHash 정규화는 src/contracts/questionDraft.ts contentHashInput과 같아야 하며 content.test.ts가 대조한다.
const root = path.resolve(import.meta.dirname, '..');
const jobId = process.argv[2];
if (!jobId) { console.error('사용: node tools/make-blind-input.mjs <jobId>'); process.exit(2); }
const drafts = JSON.parse(fs.readFileSync(path.join(root, 'content-source/batches', jobId, 'drafts.json'), 'utf8'));
const n = t => t.normalize('NFC');
const hashInput = q => JSON.stringify({
  id: q.id, revision: q.revision, type: q.type,
  target: { lemma: n(q.target.lemma), partOfSpeech: n(q.target.partOfSpeech), senseKey: n(q.target.senseKey) },
  stem: n(q.stem),
  options: [...q.options].sort((a, b) => a.id.localeCompare(b.id)).map(o => ({ id: o.id, text: n(o.text) })),
  correctOptionId: q.correctOptionId,
  explanation: n(q.explanation),
});
const items = drafts.map(q => ({
  questionId: q.id, revision: q.revision, contentHash: crypto.createHash('sha256').update(hashInput(q)).digest('hex'),
  grade: q.grade, type: q.type, lemma: q.target.lemma, partOfSpeech: q.target.partOfSpeech, stem: q.stem,
  options: [...q.options].sort((a, b) => a.id.localeCompare(b.id)),
  source: { provider: q.source.provider, url: q.source.url, senseOrder: q.source.senseOrder, senseId: q.source.senseId },
  gradeBasis: q.gradeBasis,
}));
const out = path.join(root, 'content-source/reviews', jobId, 'blind-input.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ jobId, generatedAt: new Date().toISOString(), note: '정답·해설·오답 이유를 지운 입력이다. 새 대화 문맥에서만 쓴다.', items }, null, 2) + '\n');
console.log(`${items.length}문항 → ${path.relative(root, out)}`);
