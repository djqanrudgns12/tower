import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';

// S11 타워 효율 실행기(PRD §7.5 ①, r4 §7.3 B0). 계산은 tools/sim/towerEfficiency.ts가 제품 domain 엔진으로 한다.
// 20종 모두를 Lv1 기본형으로 맵의 기준 칸에 놓고 적 역할 9종 줄을 한 번씩 통과시켜 100골드당 피해를 같은 칸 궁수와 견준다(상성표).
// 유틸 타워 6종(서리·바람·종각·깃발·약병·수호기사)은 직접 피해보다 남을 돕는 몫이 크므로 유틸 시너지(npm run simulate:gate)가 판정한다.
// 사용: npm run simulate:towers [-- --map garden_u|all] [--no-forms] [--set 경로=값] [--out docs/balance/파일.json]
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const out = flag('out', null);
const { module: eff } = await runnerImport(path.join(root, 'tools/sim/towerEfficiency.ts'), { configFile: false, logLevel: 'error', root });
const { module: sim } = await runnerImport(path.join(root, 'tools/sim/balanceSim.ts'), { configFile: false, logLevel: 'error', root });
// --set 경로=값(여러 번)으로 후보 수치를 잰다. 계약 파일은 바꾸지 않는다.
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const balance = sim.withOverrides(sets);
const maps = flag('map', 'garden_u') === 'all' ? sim.MAPS.map(m => m.id) : String(flag('map', 'garden_u')).split(',');

const matrix = Object.fromEntries(maps.map(mapId => [mapId, eff.runMatrix(balance, { mapId })]));
const r2 = x => Math.round(x * 100) / 100;
for (const mapId of maps) {
  const rows = matrix[mapId];
  console.log(`\n상성표 · ${mapId} · 기준 칸 ${eff.referenceSlot(mapId, balance).join(',')} · 100골드당 피해 ÷ 같은 칸 궁수 (Lv1 기본형)`);
  console.table(Object.fromEntries(rows.map(r => [r.tower, { ...Object.fromEntries(eff.ROLES.map(role => [role, r.attacks ? r2(r.ratio[role]) : '-'])), 최고: r.attacks ? `${r.best.role} ${r2(r.best.ratio)}` : '-', 판정: r.utility ? '유틸(시너지로 판정)' : r.pass === null ? '기준' : r.pass ? '통과' : '미달' }])));
  const failed = rows.filter(r => r.pass === false);
  console.log(failed.length ? `PRD §7.5 ① 미달(유틸 제외, 어느 역할에서도 궁수의 ${eff.REQUIRED_RATIO}배 미만): ${failed.map(r => r.tower).join(', ')}` : `PRD §7.5 ① 통과(유틸 제외 공격 타워 모두 어떤 역할에서 궁수의 ${eff.REQUIRED_RATIO}배 이상)`);
}

// 형태 비교(progression.md §6 ③): 같은 단계 형태 가운데 모든 줄에서 압도하는 형태가 없어야 한다. 20종 × 1차·2차 형태 모두.
const forms = args.includes('--no-forms') ? [] : eff.runFormComparisons(balance);
if (forms.length) {
  console.log(`\n형태 비교 · 줄 ${eff.FORM_STREAMS.join('/')} · 점수 = 줄마다 같은 단계 최고 형태 대비 비율의 평균`);
  console.table(forms.map(r => ({ 타워: r.type, 단계: `${r.tier}차(Lv${r.level})`, 점수: Object.entries(r.score).map(([f, v]) => `${f} ${v}`).join(' · '), 압도: r.dominant.join(',') || '-', '열세(참고)': r.weak.join(',') || '-' })));
  const dominated = forms.filter(r => !r.pass);
  console.log(dominated.length ? `형태 압도 미달: ${dominated.map(r => `${r.type} ${r.dominant.join(',')}`).join(' · ')}` : `형태 압도 없음(모든 줄에서 형제보다 ${eff.DOMINANCE_RATIO}배 이상인 형태 0)`);
}
if (out) fs.writeFileSync(path.join(root, out), JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), balanceVersion: balance.balanceVersion, overrides: sets, rule: `PRD §7.5 ①: 유틸이 아닌 공격 타워는 어떤 적 역할에서 같은 골드의 궁수보다 ${Math.round((eff.REQUIRED_RATIO - 1) * 100)}% 이상. 유틸 6종은 simulate:gate의 유틸 시너지로 판정`, matrix, formRule: `progression.md §6 ③: 같은 단계 형태 가운데 모든 줄(${eff.FORM_STREAMS.join('/')})에서 다른 형태 모두보다 ${eff.DOMINANCE_RATIO}배 이상인 형태가 없어야 한다`, forms }, null, 2) + '\n');
