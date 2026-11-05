#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';

// CR-1000 §3.6 관문 보고. 후보·연습·인접 학년 공유분은 수량에 넣지 않는다.
// node tools/content/coverage-report.mjs [--enforce]
// 추적 파일을 쓰지 않는다. --enforce는 보고를 모두 출력한 뒤 바닥 미달이면 1로 끝난다.
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('사용법: node tools/content/coverage-report.mjs [--enforce]\n공개 은행의 자기 학년 문항만 집계한다. --enforce: 난이도별 바닥·Normal용 advanced 미달 시 종료 코드 1.');
  process.exit(0);
}
if (args.some(arg => arg !== '--enforce')) throw new Error(`알 수 없는 인수: ${args.join(' ')}`);

const root = path.resolve(import.meta.dirname, '../..');
const importOptions = { configFile: false, logLevel: 'error', root };
const [{ module: contracts }, { module: lint }] = await Promise.all([
  runnerImport(path.join(root, 'src/contracts/questions.ts'), importOptions),
  runnerImport(path.join(root, 'src/content/lint.ts'), importOptions),
]);
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'docs/contracts/product.defaults.v0.5.json'), 'utf8'));
const gate = contracts.difficultyGateSchema.parse(defaults.questionSelection.difficultyGate);
const floors = { Easy: 550, Normal: 750, Hard: 700, Crazy: 700 };
const tierGoals = { basic: '25%', core: '35%', advanced: '24%', challenge: '16%' };
const variantGoals = { standard: '58~64%', polysemy: '16~18%', confusable: '8~10%', idiom_proverb: '7~11%', dialect: '3~5%' };
const typeGoals = { definition: '25%', cloze: '27%', synonym_context: '18%', antonym_context: '13%', usage: '17%' };
const readingGoals = { 3: '—', 4: '≥82%', 5: '≥84%', 6: '≥85%' };
const failures = [];
const ratio = (count, total) => total ? `${(100 * count / total).toFixed(1)}%` : '—';

for (const grade of [3, 4, 5, 6]) {
  const file = path.join(root, `src/content/questions/grade${grade}.json`);
  const bank = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (bank && (bank.grade !== grade || !Array.isArray(bank.questions))) throw new Error(`${file}: 은행 학년·문항 배열이 잘못되었다`);
  const own = bank?.status === 'published'
    ? bank.questions.filter(q => q.grade === grade && q.status === 'published').map(q => contracts.bankQuestionSchema.parse(q)) : [];
  const cap = lint.GRADE_BATTLE_READING_LOAD[grade];
  const absCap = lint.GRADE_ABS_READING_LOAD[grade];
  const rows = own.map(q => ({
    ...q, tier: q.difficultyTier ?? 'core', variant: q.variantTag ?? 'standard', load: contracts.readingLoad(q),
  }));
  const count = predicate => rows.filter(predicate).length;
  const table = [];
  const row = (axis, item, n, target = '—', denominator = rows.length) => table.push({
    축: axis, 항목: item, 수: n, 비율: ratio(n, denominator), 목표: target,
  });
  console.log(`\n${grade}학년 자기 학년 공개 문항: ${rows.length}개${!bank ? ' (공개 은행 파일 없음)' : bank.status !== 'published' ? ' (공개 은행 아님)' : ''}`);
  row('낱말', '서로 다른 낱말', new Set(rows.map(q => q.target.lemma.normalize('NFC').trim())).size, '560~650');
  row('낱말', '서로 다른 뜻', new Set(rows.map(q => q.target.senseKey.normalize('NFC').trim())).size, '730~830');
  for (const tier of contracts.DIFFICULTY_TIERS) row('tier', tier, count(q => q.tier === tier), tierGoals[tier]);
  for (const variant of contracts.VARIANT_TAGS) row('변형', variant, count(q => q.variant === variant), variantGoals[variant]);
  for (const type of contracts.QUESTION_TYPES) row('유형', type, count(q => q.type === type), typeGoals[type]);
  row('읽기', `전투 상한 ${cap}음절 이하`, count(q => q.load <= cap), readingGoals[grade]);
  row('읽기', `절대 상한 ${absCap}음절 이하`, count(q => q.load <= absCap), '100%');
  const basic = count(q => q.tier === 'basic');
  row('교차', 'basic 중 standard', count(q => q.tier === 'basic' && q.variant === 'standard'), '100%', basic);
  row('교차', 'basic 중 전투 상한 이하', count(q => q.tier === 'basic' && q.load <= cap), '≥95%', basic);
  console.table(table);

  const eligibility = Object.entries(floors).map(([difficulty, floor]) => {
    const rule = gate[difficulty];
    const eligible = rows.filter(q => rule.allowedTiers.includes(q.tier) && rule.allowedVariants.includes(q.variant));
    if (eligible.length < floor) failures.push(`${grade}학년 ${difficulty} ${eligible.length} < ${floor}`);
    return { 난이도: difficulty, 출제가능: eligible.length, 전투상한이하: eligible.filter(q => q.load <= cap).length, 바닥: floor, 판정: eligible.length >= floor ? '통과' : '미달' };
  });
  const normalAdvanced = count(q => q.tier === 'advanced' && (q.variant === 'standard' || q.variant === 'polysemy') && q.load <= cap);
  if (normalAdvanced < 120) failures.push(`${grade}학년 Normal용 advanced ${normalAdvanced} < 120`);
  eligibility.push({ 난이도: 'Normal용 advanced', 출제가능: normalAdvanced, 전투상한이하: normalAdvanced, 바닥: 120, 판정: normalAdvanced >= 120 ? '통과' : '미달' });
  console.table(eligibility);
}

console.log('\n난이도별 출제 가능 수는 difficultyGate 기준이며, 전투 상한 이하 수는 별도다. Normal용 advanced 목표는 150개, 필수 바닥은 120개다.');
if (failures.length) console.log(`바닥 미달 ${failures.length}건:\n${failures.map(message => `- ${message}`).join('\n')}`);
else console.log('모든 학년의 난이도별 바닥·Normal용 advanced 바닥 통과');
if (args.includes('--enforce') && failures.length) process.exitCode = 1;
