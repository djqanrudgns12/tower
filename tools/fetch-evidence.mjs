import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runnerImport } from 'vite';

// 문항 근거 조회(PRD §9.3 2단계). 표준국어대사전(단어·관용구·속담) 및 국립국어원 우리말샘 전문가 감수(방언)에서
// 뜻풀이를 받아 근거 파일을 쓰고, evidence/index.json에 파일 이름·SHA-256·뜻 ID·출처를 모은다(용례 미복제).
// 사용:
//   npm run fetch-evidence -- Q50-G4-001 어리둥절하다 "idiom:발이 넓다" "proverb:가는 말이 고와야 오는 말이 곱다" "dialect:정구지"
//   npm run fetch-evidence -- Q50-G4-001 --file lemmas.json
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const batchId = args[0];
const rest = args.slice(1);
let rawTargets = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--file' && rest[i + 1]) {
    const fileContent = fs.readFileSync(path.resolve(root, rest[++i]), 'utf8').trim();
    if (fileContent.startsWith('[')) rawTargets.push(...JSON.parse(fileContent));
    else rawTargets.push(...fileContent.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  } else rawTargets.push(rest[i]);
}

if (!batchId || rawTargets.length === 0) {
  console.error('사용: npm run fetch-evidence -- <batchId> <낱말|idiom:관용구|proverb:속담|dialect:방언> … 또는 --file <목록파일>');
  process.exit(2);
}

const { module: sd } = await runnerImport(path.join(root, 'tools/content/stdict.ts'), { configFile: false, logLevel: 'error', root });

const dir = path.join(root, 'content-source/batches', batchId, 'evidence');
fs.mkdirSync(dir, { recursive: true });
const indexPath = path.join(dir, 'index.json');
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  : { note: '표준국어대사전·우리말샘(감수 완료 방언) 뜻풀이 근거 목록(용례 미복제). npm run fetch-evidence가 쓴다.', entries: [] };

const STDICT_BASE = 'https://stdict.korean.go.kr/search';
const OPENDICT_BASE = 'https://opendict.korean.go.kr/search';
const safeFileStem = s => s.normalize('NFC').replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '_');

let detailFormTemplate = null;
async function ensureDetailForm() {
  if (detailFormTemplate) return detailFormTemplate;
  const formHtml = await (await fetch(`${STDICT_BASE}/searchDetailWords.do`)).text();
  detailFormTemplate = /<form id="searchDataVO"[\s\S]*?<\/form>/.exec(formHtml)?.[0] ?? '';
  return detailFormTemplate;
}

async function searchStdictPhrases(lemma, kindCodes = ['4', '5']) {
  const formBody = await ensureDetailForm();
  const rawFirst = lemma.trim().split(/\s+/)[0].replace(/[()[\]]/g, '');
  const strippedFirst = rawFirst.length >= 2 ? rawFirst.replace(/(이|가|을|를|에|은|는|도|로)$/, '') || rawFirst : rawFirst;
  const queryOnce = async (kw, cond) => {
    const p = new URLSearchParams();
    for (const m of formBody.matchAll(/<input([^>]+)>/g)) {
      const attrs = m[1];
      const name = /name="([^"]+)"/.exec(attrs)?.[1];
      if (!name || name === 'searchKeywords' || name.startsWith('searchWordKindCode')) continue;
      const type = (/type="([^"]+)"/.exec(attrs)?.[1] ?? 'text').toLowerCase();
      if ((type === 'checkbox' || type === 'radio') && !/checked/.test(attrs)) continue;
      p.append(name, /value="([^"]*)"/.exec(attrs)?.[1] ?? '');
    }
    for (const name of ['searchWordKind', 'searchWordGrpCode', 'searchMultimediaCode']) {
      for (const m of formBody.matchAll(new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]*)"`, 'g'))) p.append(name, m[1]);
    }
    for (const code of kindCodes) p.append('searchWordKindCode', code);
    p.set('searchFlag', 'Y');
    p.set('pageIndex', '1');
    p.set('pageUnit', '50');
    p.append('searchOp', 'AND');
    p.append('searchTargets', 'WORD');
    p.append('searchConditions', cond);
    p.append('searchKeywords', kw);
    const html = await (await fetch(`${STDICT_BASE}/searchDetailWords.do`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString(),
    })).text();
    return sd.parseDetailPhraseHits(html, lemma);
  };
  for (const [kw, cond] of [[rawFirst, 'start'], [strippedFirst, 'start'], [rawFirst, 'all'], [strippedFirst, 'all']]) {
    const hits = await queryOnce(kw, cond);
    if (hits.length > 0) return hits;
  }
  return [];
}

function recordSense(lemma, s, license) {
  const stem = safeFileStem(lemma);
  const provider = s.provider ?? 'stdict';
  const prefix = provider === 'opendict' ? `od-${s.wordNo}` : s.wordNo;
  const file = `${stem}-${prefix}-${s.senseOrder}.txt`;
  const body = sd.evidenceText(s);
  const retrievedAt = new Date().toISOString();
  const url = provider === 'opendict' ? sd.opendictUrl(s.senseId ?? s.wordNo) : sd.stdictUrl(s.wordNo, s.keywordTo ?? '3');
  fs.writeFileSync(path.join(dir, file), body);
  index.entries = index.entries.filter(e => e.file !== file);
  index.entries.push({
    provider,
    lemma,
    headword: s.headword,
    homograph: s.homograph,
    wordNo: s.wordNo,
    partOfSpeech: s.partOfSpeech,
    ...(s.category ? { category: s.category } : {}),
    senseOrder: s.senseOrder,
    label: s.label,
    senseId: s.senseId,
    gloss: s.gloss,
    url,
    license,
    retrievedAt,
    file,
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
  });
}

for (const raw of rawTargets) {
  const spec = typeof raw === 'string'
    ? (() => {
        const m = /^(word|idiom|proverb|dialect):(.+)$/.exec(raw.trim());
        return m ? { kind: m[1], lemma: m[2].trim() } : { kind: 'auto', lemma: raw.trim() };
      })()
    : raw;
  const { kind, lemma } = spec;

  if (kind === 'dialect') {
    const html = await (await fetch(`${OPENDICT_BASE}/searchResult?focus_name=query&query=${encodeURIComponent(lemma)}`)).text();
    const senses = sd.parseOpendictConfirmed(html, lemma, true);
    if (senses.length === 0) { console.log(`[방언 미발견] ${lemma}`); continue; }
    for (const s of senses) recordSense(lemma, s, '국립국어원 우리말샘(전문가 감수 방언, CC BY-SA 2.0 KR, 뜻풀이만 인용)');
    console.log(`${lemma} [방언]: 감수 항목 ${senses.length}개`);
    continue;
  }

  if (kind === 'idiom' || kind === 'proverb') {
    const codes = kind === 'idiom' ? ['4'] : ['5'];
    const hits = await searchStdictPhrases(lemma, codes);
    if (hits.length === 0) {
      // 표준국어대사전에 없는 속담·관용구는 우리말샘 감수 완료 항목도 보조 확인한다.
      const odHtml = await (await fetch(`${OPENDICT_BASE}/searchResult?focus_name=query&query=${encodeURIComponent(lemma)}`)).text();
      const odSenses = sd.parseOpendictConfirmed(odHtml, lemma, false);
      if (odSenses.length === 0) { console.log(`[${kind} 미발견] ${lemma}`); continue; }
      for (const s of odSenses) recordSense(lemma, s, '국립국어원 우리말샘(전문가 감수, CC BY-SA 2.0 KR, 뜻풀이만 인용)');
      console.log(`${lemma} [${kind}/우리말샘]: 뜻 ${odSenses.length}개`);
      continue;
    }
    for (const hit of hits) {
      const res = await fetch(`${STDICT_BASE}/contentViewOne.do`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `word_no=${hit.wordNo}&searchKeywordTo=${hit.keywordTo}`,
      });
      const senses = sd.parseStdictEntry(await res.text(), hit.wordNo).map(s => ({ ...s, keywordTo: hit.keywordTo }));
      for (const s of senses) recordSense(lemma, s, '국립국어원 표준국어대사전(뜻풀이만 인용, 용례 미복제)');
      console.log(`${lemma} [${kind}]: word_no ${hit.wordNo} 뜻 ${senses.length}개`);
    }
    continue;
  }

  // 기본 단어(word / auto)
  const search = await (await fetch(`${STDICT_BASE}/searchResult.do?pageSize=10&searchKeyword=${encodeURIComponent(lemma)}`)).text();
  const wordNos = sd.parseSearchWordNos(search, lemma);
  if (wordNos.length === 0 && kind === 'auto' && /\s/.test(lemma)) {
    const hits = await searchStdictPhrases(lemma, ['4', '5']);
    if (hits.length > 0) {
      for (const hit of hits) {
        const res = await fetch(`${STDICT_BASE}/contentViewOne.do`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `word_no=${hit.wordNo}&searchKeywordTo=${hit.keywordTo}`,
        });
        const senses = sd.parseStdictEntry(await res.text(), hit.wordNo).map(s => ({ ...s, keywordTo: hit.keywordTo }));
        for (const s of senses) recordSense(lemma, s, '국립국어원 표준국어대사전(뜻풀이만 인용, 용례 미복제)');
        console.log(`${lemma} [구문]: word_no ${hit.wordNo} 뜻 ${senses.length}개`);
      }
      continue;
    }
  }
  if (wordNos.length === 0) { console.log(`[단어 미발견] ${lemma}`); continue; }
  for (const wordNo of wordNos) {
    const res = await fetch(`${STDICT_BASE}/contentViewOne.do`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `word_no=${wordNo}&searchKeywordTo=3`,
    });
    const senses = sd.parseStdictEntry(await res.text(), wordNo);
    for (const s of senses) recordSense(lemma, s, '국립국어원 표준국어대사전(뜻풀이만 인용, 용례 미복제)');
    console.log(`${lemma}: word_no ${wordNo} 뜻 ${senses.length}개`);
  }
}

index.entries.sort((a, b) => a.file.localeCompare(b.file));
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`→ ${path.relative(root, indexPath)} (${index.entries.length}개)`);
