// 브리지·agy 답장에서 낱말 목록 JSON을 꺼내 검사·저장한다(출력 한도로 이어 쓴 답은 마지막 완결 블록을 쓴다).
// 사용: node tools/orchestrate/wordlist-extract.mjs <답장 파일> <학년> <제외 낱말 txt(쉼표 구분)> [저장 경로]
import fs from 'node:fs';
const [file, gradeArg, usedFile, outPath] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
let texts = [raw];
for (const line of raw.split('\n')) if (line.startsWith('{"conversation_id"')) { try { texts.unshift(JSON.parse(line).response ?? ''); } catch {} }
let data = null;
for (const t of texts) {
  const blocks = []; let at = 0;
  while ((at = t.indexOf('```json', at)) >= 0) { const st = t.indexOf('\n', at) + 1, en = t.indexOf('```', st); if (en < 0) break; blocks.push(t.slice(st, en)); at = st; }
  for (const b of blocks.reverse()) { try { const d = JSON.parse(b); if (Array.isArray(d.items)) { data = d; break; } } catch {} }
  if (data) break;
}
if (!data) { console.log('JSON 목록을 찾지 못함'); process.exit(1); }
const used = new Set(fs.readFileSync(usedFile, 'utf8').split(',').map(s => s.trim()).filter(Boolean));
const grade = Number(gradeArg), seen = new Set(), problems = [], kinds = {}, variants = {}, types = {};
const KINDS = ['word', 'idiom', 'proverb', 'dialect'], VAR = ['standard', 'polysemy', 'confusable', 'idiom_proverb', 'dialect'];
for (const it of data.items) {
  const k = `${it.lemma}`;
  if (!it.lemma || !KINDS.includes(it.kind) || !VAR.includes(it.variantTag) || !Number.isInteger(it.senseOrder) || !Array.isArray(it.types)) problems.push(`형식: ${JSON.stringify(it).slice(0, 80)}`);
  if (used.has(it.lemma)) problems.push(`기존 낱말: ${k}`);
  if (seen.has(k)) problems.push(`목록 내 중복: ${k}`);
  if (it.variantTag === 'confusable' && !it.confusableWith) problems.push(`혼동 짝 없음: ${k}`);
  if (it.kind === 'dialect' && !it.dialectRegion) problems.push(`방언 지역 없음: ${k}`);
  if (/\d+쪽|\d+단원/.test(it.gradeEvidence ?? '')) problems.push(`단원·쪽 표기: ${k}`);
  seen.add(k); kinds[it.kind] = (kinds[it.kind] ?? 0) + 1; variants[it.variantTag] = (variants[it.variantTag] ?? 0) + 1;
  for (const t of it.types) types[t] = (types[t] ?? 0) + 1;
}
console.log(`학년 ${data.grade ?? '?'}(요청 ${grade}) 항목 ${data.items.length}`, JSON.stringify({ kinds, variants, types }));
console.log(`문제 ${problems.length}건`, problems.slice(0, 15).join(' | '));
if (outPath && problems.filter(p => !p.startsWith('기존 낱말') && !p.startsWith('목록 내 중복')).length === 0) {
  const items = data.items.filter((it, i, a) => !used.has(it.lemma) && a.findIndex(x => x.lemma === it.lemma) === i).map(it => ({ ...it, checked: null }));
  fs.writeFileSync(outPath, JSON.stringify({ grade, round: 1, source: { producer: 'Gemini 4 Argon (High)', order: 'O-A1', date: new Date().toISOString().slice(0, 10) }, items }, null, 1) + '\n');
  console.log(`저장 ${items.length}개 → ${outPath}`);
}
