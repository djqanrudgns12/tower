import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sharedBankFileSchema } from '../src/contracts/questions.ts';
import { sharedBankVersion } from './content/sharedBankVersion.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

const HEADER = [
  '-- 공개 은행 정답 키·검증 규칙(D1). server/migrations 적용 뒤에 넣는다.',
  '--   로컬: npm run server:db:local · 운영: npm run server:seed:remote',
  '-- tools/build-question-keys.mjs가 만든다. 손으로 고치지 않는다.',
].join('\n');

/**
 * 승인된 은행과 철회 오버레이로 재현 가능한 서버 seed를 D1(SQLite) 문법으로 만든다.
 * D1은 BEGIN/COMMIT 문을 받지 않는다. `wrangler d1 execute --file`이 파일 하나를 한 번에 실행한다.
 * Supabase(Postgres) 판은 2026-11-05 단계 6에서 멈췄다. 마지막 출력은 docs/archive/supabase/question_keys.seed.sql.
 */
export function buildQuestionKeySeed(input) {
  return buildSeed(input, (q, bank) => q.grade === bank.grade);
}

/** W5 연결용. 원 ID·학년을 보존하고 실제 받는 은행의 버전·학년으로 키를 만든다. 현재 CLI는 기존 경로를 쓴다. */
export function buildSharedQuestionKeySeed(input) {
  const banks = input.banks.map(bank => bank.status === 'published' ? sharedBankFileSchema.parse(bank) : bank);
  for (const bank of banks) {
    if (bank.status !== 'published') continue;
    if (bank.bankVersion !== sharedBankVersion(bank.grade, bank.questions)) {
      throw new Error(`${bank.bankId}: 받는 학년 은행 판 번호가 현재 문항과 일치하지 않는다`);
    }
  }
  return buildSeed({ ...input, banks }, (q, bank) => q.grade === bank.grade || q.grade + 1 === bank.grade);
}

function buildSeed({ banks, balance, maps, retractions }, belongs) {
  const sql = [HEADER];
  // 파일이 없어지거나 published가 아니게 된 학년도 이전 승인을 남기지 않는다.
  sql.push('update approved_run_conditions set active=0 where grade in (3,4,5,6);');
  const retracted = new Set();
  for (const entry of retractions.entries) {
    if (!Number.isSafeInteger(entry.revision) || entry.revision < 1) throw new Error('잘못된 철회 revision');
    retracted.add(`${entry.questionId}@${entry.revision}`);
    sql.push(`delete from question_keys where question_id=${quote(entry.questionId)} and revision=${entry.revision};`);
  }
  const seen = new Set();
  for (const bank of banks) {
    if (bank.status !== 'published') continue;
    const grade = bank.grade;
    if (![3, 4, 5, 6].includes(grade)) throw new Error('잘못된 공개 학년');
    const questions = bank.questions.filter(q => q.status === 'published' && !retracted.has(`${q.id}@${q.revision}`));
    if (questions.length === 0) continue;
    for (const q of questions) {
      if (!belongs(q, bank) || !Number.isSafeInteger(q.revision) || q.revision < 1 || !['a', 'b', 'c', 'd'].includes(q.correctOptionId)) throw new Error(`잘못된 정답 키: ${q.id}`);
      const key = `${bank.bankVersion}:${q.id}@${q.revision}`;
      if (seen.has(key)) throw new Error(`중복 정답 키: ${key}`);
      seen.add(key);
      sql.push(`insert into question_keys(bank_version,question_id,revision,correct_option,grade) values(${quote(bank.bankVersion)},${quote(q.id)},${q.revision},${quote(q.correctOptionId)},${grade}) on conflict do nothing;`);
    }
    const map = maps.maps.find(m => m.grade === grade);
    if (!map) throw new Error(`${grade}학년 맵이 없다`);
    sql.push(`insert into approved_run_conditions(bank_version,grade,balance_version,map_id) values(${quote(bank.bankVersion)},${grade},${quote(balance.balanceVersion)},${quote(map.id)}) on conflict(bank_version,grade,balance_version,map_id) do update set active=1;`);
  }
  for (const [difficulty, diff] of Object.entries(balance.difficulties)) {
    const rules = { correctPt: diff.correctPt, wrongPt: diff.wrongPt, waveKillPtCap: diff.waveKillPtCap, bossPt: diff.killPt.boss, bossEvery: balance.waves.bossEveryWaves, firstPrep: balance.run.prepAttempts.firstWave, laterPrep: balance.run.prepAttempts.laterWaves, countBase: balance.waves.count.base, countStep: balance.waves.count.step, countEvery: balance.waves.count.stepEveryWaves, countMax: balance.waves.count.max, spawnOverrides: balance.waves.spawnIntervalMs.overrides, spawnMin: balance.waves.spawnIntervalMs.min, spawnBase: balance.waves.spawnIntervalMs.base, spawnStep: balance.waves.spawnIntervalMs.perWave };
    sql.push(`insert into run_verification_rules(balance_version,difficulty,rules) values(${quote(balance.balanceVersion)},${quote(difficulty)},${quote(JSON.stringify(rules))}) on conflict do nothing;`);
  }
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
  await writeFile(path.join(root, 'server/seed/question_keys.sql'), sql);
  const count = sql.split('\n').filter(line => line.startsWith('insert into question_keys(')).length;
  console.log(`공개 정답 키 ${count}개, 검증 규칙 ${Object.keys(balance.difficulties).length}개 생성(server/seed/question_keys.sql)`);
}
