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
if (out) fs.writeFileSync(path.join(root, out), JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), rule: 'PRD §7.5 ①: 의도한 상황에서 같은 골드의 궁수보다 15% 이상', rows }, null, 2) + '\n');
