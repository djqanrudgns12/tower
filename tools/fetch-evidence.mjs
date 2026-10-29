import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runnerImport } from 'vite';

// 문항 근거 조회(PRD §9.3 2단계). 표준국어대사전에서 낱말의 모든 뜻을 받아 뜻마다 근거 파일을 쓰고,
// 문항 작성자가 고를 수 있게 evidence/index.json에 파일 이름·SHA-256·뜻 ID를 모은다. 작성자는 해시를 직접 계산하지 않는다.
// 사용: npm run fetch-evidence -- Q20-003 어리둥절하다 쑥스럽다 …
const root = path.resolve(import.meta.dirname, '..');
const [batchId, ...lemmas] = process.argv.slice(2);
if (!batchId || lemmas.length === 0) { console.error('사용: npm run fetch-evidence -- <batchId> <낱말> [<낱말> …]'); process.exit(2); }
const { module: sd } = await runnerImport(path.join(root, 'tools/content/stdict.ts'), { configFile: false, logLevel: 'error', root });

const dir = path.join(root, 'content-source/batches', batchId, 'evidence');
fs.mkdirSync(dir, { recursive: true });
const indexPath = path.join(dir, 'index.json');
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : { note: '표준국어대사전 뜻풀이 근거 목록(용례 미복제). npm run fetch-evidence가 쓴다.', entries: [] };
const BASE = 'https://stdict.korean.go.kr/search';

for (const lemma of lemmas) {
  const search = await (await fetch(`${BASE}/searchResult.do?pageSize=10&searchKeyword=${encodeURIComponent(lemma)}`)).text();
  const wordNos = sd.parseSearchWordNos(search, lemma);
  if (wordNos.length === 0) { console.log(`${lemma}: 표제어를 찾지 못함`); continue; }
  for (const wordNo of wordNos) {
    const res = await fetch(`${BASE}/contentViewOne.do`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `word_no=${wordNo}&searchKeywordTo=3` });
    const senses = sd.parseStdictEntry(await res.text(), wordNo);
    const retrievedAt = new Date().toISOString();
    for (const s of senses) {
      const file = `${lemma}-${wordNo}-${s.senseOrder}.txt`;
      const body = sd.evidenceText(s);
      fs.writeFileSync(path.join(dir, file), body);
      index.entries = index.entries.filter(e => e.file !== file);
      index.entries.push({ lemma, headword: s.headword, homograph: s.homograph, wordNo, partOfSpeech: s.partOfSpeech, senseOrder: s.senseOrder, label: s.label, senseId: s.senseId, gloss: s.gloss, url: sd.stdictUrl(wordNo), retrievedAt, file, sha256: crypto.createHash('sha256').update(body).digest('hex') });
    }
    console.log(`${lemma}: word_no ${wordNo} 뜻 ${senses.length}개`);
  }
}
index.entries.sort((a, b) => a.file.localeCompare(b.file));
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`→ ${path.relative(root, indexPath)} (${index.entries.length}개)`);
