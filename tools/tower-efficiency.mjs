import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';

// S11 타워 효율 실행기(PRD §7.5 ①). 계산은 tools/sim/towerEfficiency.ts가 제품 domain 엔진으로 한다.
// 사용: npm run simulate:towers [-- --out docs/balance/s11-p2-efficiency.json]
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const { module: eff } = await runnerImport(path.join(root, 'tools/sim/towerEfficiency.ts'), { configFile: false, logLevel: 'error', root });
const { module: sim } = await runnerImport(path.join(root, 'tools/sim/balanceSim.ts'), { configFile: false, logLevel: 'error', root });
// --set 경로=값(여러 번)으로 후보 수치를 잰다. 계약 파일은 바꾸지 않는다.
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const rows = eff.runComparisons(undefined, sim.withOverrides(sets));
console.table(rows.map(r => ({ 비교: r.intent, 기준: r.required ? '①' : '참고', '대상 100골드당': r.subjectPer100, '궁수 100골드당': r.baselinePer100, 비: r.ratio, 통과: r.pass ? '예' : '아니오' })));
const failed = rows.filter(r => r.required && !r.pass);
console.log(failed.length ? `PRD §7.5 ① 미달: ${failed.map(r => r.intent).join(', ')}` : 'PRD §7.5 ① 통과(필수 비교 모두 1.15 이상)');
// 형태 비교(progression.md §6 ③): 같은 단계 형태 가운데 모든 줄에서 압도하는 형태가 없어야 한다.
const forms = args.includes('--no-forms') ? [] : eff.runFormComparisons(sim.withOverrides(sets));
if (forms.length) {
  console.log(`\n형태 비교 · 줄 ${eff.FORM_STREAMS.join('/')} · 점수 = 줄마다 같은 단계 최고 형태 대비 비율의 평균`);
  console.table(forms.map(r => ({ 타워: r.type, 단계: `${r.tier}차(Lv${r.level})`, 점수: Object.entries(r.score).map(([f, v]) => `${f} ${v}`).join(' · '), 압도: r.dominant.join(',') || '-', '열세(참고)': r.weak.join(',') || '-' })));
  const dominated = forms.filter(r => !r.pass);
  console.log(dominated.length ? `형태 압도 미달: ${dominated.map(r => `${r.type} ${r.dominant.join(',')}`).join(' · ')}` : `형태 압도 없음(모든 줄에서 형제보다 ${eff.DOMINANCE_RATIO}배 이상인 형태 0)`);
}
if (out) fs.writeFileSync(path.join(root, out), JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), balanceVersion: sim.withOverrides(sets).balanceVersion, overrides: sets, rule: 'PRD §7.5 ①: 의도한 상황에서 같은 골드의 궁수보다 15% 이상', rows, formRule: `progression.md §6 ③: 같은 단계 형태 가운데 모든 줄(${eff.FORM_STREAMS.join('/')})에서 다른 형태 모두보다 ${eff.DOMINANCE_RATIO}배 이상인 형태가 없어야 한다`, forms }, null, 2) + '\n');
