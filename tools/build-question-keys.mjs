import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

/** 승인된 은행과 철회 오버레이로 재현 가능한 서버 seed를 만든다. */
export function buildQuestionKeySeed({ banks, balance, maps, retractions }) {
  const sql = [
    '-- 공개 은행 정답 키·검증 규칙. 모든 마이그레이션 뒤에 관리자로 적용한다.',
    'begin;',
    // 파일이 없어지거나 published가 아니게 된 학년도 이전 승인을 남기지 않는다.
    'update public.approved_run_conditions set active=false where grade in (3,4,5,6);',
  ];
  const retracted = new Set();
  for (const entry of retractions.entries) {
    if (!Number.isSafeInteger(entry.revision) || entry.revision < 1) throw new Error('잘못된 철회 revision');
    retracted.add(`${entry.questionId}@${entry.revision}`);
    sql.push(`delete from public.question_keys where question_id=${quote(entry.questionId)} and revision=${entry.revision};`);
  }
  const seen = new Set();
  for (const bank of banks) {
    if (bank.status !== 'published') continue;
    const grade = bank.grade;
    if (![3, 4, 5, 6].includes(grade)) throw new Error('잘못된 공개 학년');
    const questions = bank.questions.filter(q => q.status === 'published' && !retracted.has(`${q.id}@${q.revision}`));
    if (questions.length === 0) continue;
    for (const q of questions) {
      if (q.grade !== grade || !Number.isSafeInteger(q.revision) || q.revision < 1 || !['a', 'b', 'c', 'd'].includes(q.correctOptionId)) throw new Error(`잘못된 정답 키: ${q.id}`);
      const key = `${bank.bankVersion}:${q.id}@${q.revision}`;
      if (seen.has(key)) throw new Error(`중복 정답 키: ${key}`);
      seen.add(key);
      sql.push(`insert into public.question_keys(bank_version,question_id,revision,correct_option,grade) values(${quote(bank.bankVersion)},${quote(q.id)},${q.revision},${quote(q.correctOptionId)},${grade}) on conflict do nothing;`);
    }
    const map = maps.maps.find(m => m.grade === grade);
    if (!map) throw new Error(`${grade}학년 맵이 없다`);
    sql.push(`insert into public.approved_run_conditions(bank_version,grade,balance_version,map_id) values(${quote(bank.bankVersion)},${grade},${quote(balance.balanceVersion)},${quote(map.id)}) on conflict(bank_version,grade,balance_version,map_id) do update set active=true;`);
  }
  for (const [difficulty, d] of Object.entries(balance.difficulties)) {
    const rules = { correctPt: d.correctPt, wrongPt: d.wrongPt, waveKillPtCap: d.waveKillPtCap, bossPt: d.killPt.boss, bossEvery: balance.waves.bossEveryWaves, firstPrep: balance.run.prepAttempts.firstWave, laterPrep: balance.run.prepAttempts.laterWaves, countBase: balance.waves.count.base, countStep: balance.waves.count.step, countEvery: balance.waves.count.stepEveryWaves, countMax: balance.waves.count.max, spawnOverrides: balance.waves.spawnIntervalMs.overrides, spawnMin: balance.waves.spawnIntervalMs.min, spawnBase: balance.waves.spawnIntervalMs.base, spawnStep: balance.waves.spawnIntervalMs.perWave };
    sql.push(`insert into public.run_verification_rules(balance_version,difficulty,rules) values(${quote(balance.balanceVersion)},${quote(difficulty)},${quote(JSON.stringify(rules))}::jsonb) on conflict do nothing;`);
  }
  sql.push('commit;');
  return sql.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
  const balance = await readJson('docs/contracts/balance.candidate.v0.4.json');
  const maps = await readJson('docs/contracts/maps.candidate.v0.4.json');
  const retractions = await readJson('src/content/retractions.json');
  const banks = [];
  for (const grade of [3, 4, 5, 6]) {
    try { banks.push(await readJson(`src/content/questions/grade${grade}.json`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const sql = buildQuestionKeySeed({ banks, balance, maps, retractions });
  await writeFile(path.join(root, 'supabase/question_keys.seed.sql'), sql);
  const count = sql.split('\n').filter(line => line.startsWith('insert into public.question_keys(')).length;
  console.log(`공개 정답 키 ${count}개, 검증 규칙 ${Object.keys(balance.difficulties).length}개 생성`);
}
