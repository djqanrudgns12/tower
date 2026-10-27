import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// 제품 실행 시험이 아닌 현재 PRD의 계약·문서 검사다.
const root = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const checks = [];
const run = (name, fn) => {
  try { fn(); checks.push({ name, status: 'passed' }); }
  catch (error) { checks.push({ name, status: 'failed', error: error.message }); }
};
const prdPath = 'vocabulary_td_prd_v0_5.md';
const prd = read(prdPath);
const data = json('docs/contracts/maps.candidate.v0.4.json');
const defaults = json('docs/contracts/product.defaults.v0.5.json');
const balance = json('docs/contracts/balance.candidate.v0.3.json');
const reportPath = 'docs/contracts/prd_v0_5_validation.json';
const preserved = {
  'docs/assets/design-41-kingdom-expedition.png': '5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13',
  'vocabulary_td_prd_claude_v0_1.md': 'b1277c8c3f1ffb8b495952aa9efedd8010e37cfb438c8a45fb2587ba40fb08cd',
  'vocabulary_td_prd_v0_3.md': '33b7522608106f6c80207e262dc729f2164c6c9a11b69a7b3f8b2f34c32fc2e8',
  'vocabulary_td_prd_v0_4.md': 'd47d614e5cf45b86e7e6b222a1861706a0f74451b0c755cd8c1d2722a6509d14',
};
const section = (start, end) => prd.slice(prd.indexOf(start), prd.indexOf(end, prd.indexOf(start)));
const tableRow = (text, head) => text.split('\n').find(line => line.startsWith(`| ${head} |`))?.split('|').slice(1, -1).map(s => s.trim());
for (const [file, expected] of Object.entries(preserved)) run(`원본 보존: ${file}`, () => assert.equal(hash(file), expected));
run('현재 PRD 절 0~21의 중복·누락 없음', () => {
  const headings = [...prd.matchAll(/^## (\d+)\./gm)].map(m => Number(m[1]));
  assert.deepEqual(headings, Array.from({ length: 22 }, (_, i) => i));
});
run('현재 PRD 내부 절 참조', () => {
  const headings = new Set([...prd.matchAll(/^#{2,3} (\d+(?:\.\d+)?)\.? /gm)].map(m => m[1]));
  for (const ref of prd.matchAll(/§(\d+(?:\.\d+)?)/g)) assert(headings.has(ref[1]), `없는 절: ${ref[0]}`);
});
run('현재 PRD 출처 ID 정의', () => {
  const ids = new Set([...prd.matchAll(/^- \[(R\d+|M\d+)\]/gm)].map(m => m[1]));
  for (const ref of prd.matchAll(/\[(R\d+|M\d+)\]/g)) assert(ids.has(ref[1]), `없는 출처: ${ref[1]}`);
});
run('학년별 지도 4개·ID 유일', () => {
  assert.deepEqual(data.maps.map(m => m.grade), [3, 4, 5, 6]);
  assert.equal(new Set(data.maps.map(m => m.id)).size, 4);
});
const mapMetrics = [];
for (const m of data.maps) {
  const key = p => p.join(',');
  const route = new Set(m.pathCells.map(key));
  const inside = ([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < m.gridWidth && y >= 0 && y < m.gridHeight;
  run(`${m.id}: 경로 경계·연결·중복·길이`, () => {
    assert.equal(m.gridWidth, 15); assert.equal(m.gridHeight, 9);
    assert.equal(route.size, m.pathCells.length);
    assert.equal(m.pathLength, m.pathCells.length - 1);
    m.pathCells.forEach((p, i) => {
      assert(inside(p));
      if (i) { const prev = m.pathCells[i - 1]; assert.equal(Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]), 1); }
    });
    assert.deepEqual(m.entryCell, m.pathCells[0]); assert.deepEqual(m.exitCell, m.pathCells.at(-1));
    assert.equal(m.baseTravelTicks, 720);
    const expanded = [m.waypoints[0]];
    for (const [ex, ey] of m.waypoints.slice(1)) {
      let [x, y] = expanded.at(-1);
      assert((x === ex) !== (y === ey), '대각선 또는 중복 waypoint');
      while (x !== ex || y !== ey) { x += Math.sign(ex - x); y += Math.sign(ey - y); expanded.push([x, y]); }
    }
    assert.deepEqual(expanded, m.pathCells);
  });
  const slots = new Set(m.slots.map(s => `${s.x},${s.y}`));
  run(`${m.id}: 설치20칸·장식·길 점유 분리`, () => {
    assert.equal(m.slots.length, 20); assert.equal(slots.size, 20);
    assert.equal(new Set(m.slots.map(s => s.id)).size, 20);
    for (const s of m.slots) { assert(inside([s.x, s.y])); assert(!route.has(`${s.x},${s.y}`)); }
    const decor = new Set();
    for (const d of m.decorations) {
      assert.equal(d.interactive, false);
      for (const p of d.cells) { assert(inside(p)); assert(!route.has(key(p))); assert(!slots.has(key(p))); assert(!decor.has(key(p))); decor.add(key(p)); }
    }
    assert(m.decorations.filter(d => d.kind === 'culture').length >= 1);
    assert(m.decorations.filter(d => d.kind === 'culture').length <= 2);
  });
  const distances = m.slots.map(s => Math.sqrt(Math.min(...m.pathCells.map(([x, y]) => (s.x - x) ** 2 + (s.y - y) ** 2))));
  run(`${m.id}: 실제 설치칸의 기본타워 경로 도달성`, () => {
    assert(distances.every(d => d <= 3.2));
    assert(distances.filter(d => d <= 1.3).length > 0, '근접 타워 유효 칸 없음');
    assert(Math.max(...m.slots.map(s => s.x)) - Math.min(...m.slots.map(s => s.x)) >= 10, '설치칸 가로 편중');
  });
  const archerCover = m.slots.map(s => m.pathCells.filter(([x, y]) => (s.x - x) ** 2 + (s.y - y) ** 2 <= 2.5 ** 2).length);
  run(`${m.id}: 설치칸 품질(궁수 사거리 안 길 칸)과 길 자기 접촉`, () => {
    assert(archerCover.every(c => c >= 2), `길 칸 2개 미만 슬롯: ${m.slots.filter((_, i) => archerCover[i] < 2).map(s => s.id)}`);
    assert(archerCover.filter(c => c >= 4).length >= 14, '길 칸 4개 이상 슬롯 14개 미만');
    const index = new Map(m.pathCells.map((p, i) => [key(p), i]));
    m.pathCells.forEach(([x, y], i) => {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const j = index.get(key([x + dx, y + dy]));
        assert(j === undefined || Math.abs(j - i) === 1, `길 자기 접촉: (${x},${y})`);
      }
    });
  });
  run(`${m.id}: PRD 좌표표와 JSON 일치`, () => {
    const row = prd.split('\n').find(line => line.startsWith(`| \`${m.id}\` /`));
    assert(row, 'PRD 지도 행 없음');
    assert(row.includes(m.waypoints.map(([x, y]) => `(${x},${y})`).join('→')));
    assert(row.endsWith(`| ${m.pathLength} |`));
  });
  mapMetrics.push({ id: m.id, pathLength: m.pathLength, slots: m.slots.length, maxNearestPathDistance: Math.max(...distances), spearReachableSlots: distances.filter(d => d <= 1.3).length, archerWeakSlots: archerCover.filter(c => c < 4).length, balanceValidated: false });
}
run('화면 기본값과 PRD의 치수·모드 규칙 일치', () => {
  const l = defaults.layout;
  assert(prd.includes(`관리${l.railWidthPx}px`));
  assert(prd.includes(`HUD${l.hudHeightPx}`));
  assert(prd.includes(`문제${l.questionBaseHeightPx}`));
  assert(prd.includes(`문제/보기${l.questionFontPx[0]}px, 크게${l.questionFontPx[1]}px, 아주크게${l.questionFontPx[2]}px`));
  assert(prd.includes(`레일${l.modes.R.railWidthPx}(맨 위에 HUD 두 줄 ${l.modes.R.railHudHeightPx})`));
  assert(prd.includes(`칸<${l.magnifyBelowCellPx.coarse}px`) && prd.includes(`칸<${l.magnifyBelowCellPx.fine}px`));
  assert(prd.includes(`폭이 ${l.optionGrid.twoByTwoMinCellWidthPx}px 이상`));
  assert(prd.includes(`=${l.questionWideHeightBudgetPx}px로 ${l.questionBaseHeightPx}px 안에`));
  assert(l.touchMinPx >= 44); assert(l.magnifiedCellMinPx >= l.touchMinPx);
  assert.deepEqual(l.mapAspect, [15, 9]);
});
run('§12.1 모드 계산표 재계산', () => {
  const rows = section('### 12.1', '### 12.2').split('\n').filter(line => /^\| [^|]*\d+×\d+[^|]* \| [RS] \|/.test(line));
  assert(rows.length >= 10, '모드 계산표 행 부족');
  for (const line of rows) {
    const [view, mode, , cellText] = line.split('|').slice(1, -1).map(s => s.trim());
    const [W, H] = (view.match(/≈?(\d+)×(\d+)(?!.*×)/) || []).slice(1).map(Number);
    const phone = W < defaults.layout.outerPaddingPx.phoneBelowWidthPx; const P = phone ? 8 : 16; const Q = phone ? 300 : 208;
    const cR = Math.min((W - 2 * P - 236) / 15, (H - 2 * P - 8 - Q) / 9);
    const cSfit = Math.min((W - 2 * P) / 15, (H - 2 * P - 44 - 8 - 8 - 44 - 8 - Q) / 9);
    const expected = phone ? 'S' : cR >= cSfit && cR >= 24 ? 'R' : 'S';
    const cell = expected === 'R' ? cR : phone || cSfit < 24 ? (W - 2 * P) / 15 : cSfit;
    assert.equal(mode, expected, `${view} 모드`);
    assert(Math.abs(Number(cellText) - cell) < 0.06, `${view} 칸 ${cellText} ≠ ${cell.toFixed(1)}`);
  }
});
run('밸런스 계약과 PRD 난이도표(§4.1) 일치', () => {
  const text = section('### 4.1', '### 4.2'); const ids = ['Easy', 'Normal', 'Hard', 'Crazy'];
  const expect = (head, pick) => { const row = tableRow(text, head); assert(row, `행 없음: ${head}`); ids.forEach((id, i) => assert.equal(Number(row[i + 1].replace('−', '-').replace('+', '')), pick(balance.difficulties[id]), `${head} ${id}`)); };
  expect('성문 최대 HP', d => d.gateHp); expect('같은 웨이브·종류 적의 HP 배율', d => d.enemyHpBP / 10000);
  expect('정답 1회 PT', d => d.correctPt); expect('오답 1회 PT', d => d.wrongPt); expect('정답 1회 골드', d => d.correctGold);
  expect('일반 처치 골드', d => d.killGold.regular); expect('정예 처치 골드', d => d.killGold.elite); expect('보스 처치 골드', d => d.killGold.boss);
  expect('일반 처치 PT', d => d.killPt.regular); expect('정예 처치 PT', d => d.killPt.elite); expect('보스 처치 PT', d => d.killPt.boss);
  expect('일반+정예 처치 PT의 웨이브별 상한', d => d.waveKillPtCap);
  for (const id of ids) { assert.equal(balance.difficulties[id].skipPt, 0); assert.equal(balance.difficulties[id].milestoneSurvivalGold, defaults.milestone.survivalGold[id]); assert.equal(balance.difficulties[id].label, defaults.displayLabels.difficulty[id]); }
  assert(prd.includes('**‘모르겠어요’는 PT 0·골드 0이다.**'));
});
run('밸런스 계약과 PRD 타워표(§7.1)·적표(§8.1) 일치', () => {
  const towers = section('### 7.1', '### 7.2');
  for (const [id, t] of Object.entries(balance.towers)) {
    const row = towers.split('\n').find(line => line.startsWith(`| \`${id}\` `))?.split('|').map(s => s.trim()); assert(row, `타워 행 없음: ${id}`);
    assert(row[1].endsWith(t.label), `${id} 이름`); assert.equal(Number(row[2]), t.cost, `${id} 가격`);
    if (id === 'banner') { assert(row[3].includes(`반경 ${(t.rangeMilli / 1000).toFixed(1)}`)); continue; }
    const m = row[3].match(/(물리|마법) (\d+) \/ ([\d.]+)초 \/ 사거리 ([\d.]+)/); assert(m, `${id} 공격 사양 형식`);
    assert.equal(m[1] === '물리' ? 'physical' : 'magic', t.damageType); assert.equal(Number(m[2]), t.damage);
    assert.equal(Math.round(Number(m[3]) * 1000), t.intervalMs); assert.equal(Math.round(Number(m[4]) * 1000), t.rangeMilli);
  }
  const enemies = section('### 8.1', '### 8.2');
  for (const [id, e] of Object.entries(balance.enemies)) {
    const row = enemies.split('\n').find(line => line.startsWith(`| \`${id}\` `))?.split('|').map(s => s.trim()); assert(row, `적 행 없음: ${id}`);
    assert.equal(Math.round(Number(row[2]) * 10000), e.hpBP, `${id} HP`); assert.equal(Math.round(Number(row[3]) * 10000), e.speedBP, `${id} 속도`);
  }
});
run('밸런스 계약과 PRD 생성식(§8.2) 일치', () => {
  const text = section('### 8.2', '### 8.3'); const w = balance.waves, s = w.spawnIntervalMs;
  assert(text.includes(`24 * ${(w.hpGrowthPercent / 100).toFixed(2)}^(w - 1)`)); assert(text.includes(`ceil(이전 값 ×${w.hpGrowthPercent}/100)`));
  assert(text.includes(`w=1: ${s.overrides[1]}, w=2: ${s.overrides[2]}, w=3: ${s.overrides[3]}, w>=4: max(${s.min}, ${s.base} - ${-s.perWave} * (w - 1))`));
  assert(text.includes(`min(${w.count.max}, ${w.count.base} + ${w.count.step} * floor((w - 1) / ${w.count.stepEveryWaves}))`));
  for (const row of section('### 17.2', '### 17.3').split('\n').filter(line => line.startsWith('| A33 |'))) {
    const tick = ms => Math.floor((ms * balance.units.tickHz + 999) / 1000);
    assert(row.includes([1, 2, 3, 4].map(n => tick(s.overrides[n] ?? Math.max(s.min, s.base + s.perWave * (n - 1)))).join('/') + '틱'));
  }
  const n1 = Math.min(w.count.max, w.count.base);
  for (const id of Object.keys(balance.difficulties)) assert(n1 * balance.leakDamage.regular >= balance.difficulties[id].gateHp, `1웨이브 무방비 누출 < 성문 ${id}`);
});
run('고비 보상표·기본값·안전조건 일치', () => {
  const section = prd.slice(prd.indexOf('### 4.6'), prd.indexOf('## 5.'));
  for (const [difficulty, gold] of Object.entries(defaults.milestone.survivalGold)) {
    const row = section.split('\n').find(line => line.startsWith(`| ${difficulty} |`));
    assert(row?.endsWith(`| ${gold} | ${defaults.milestone.survivalPt} |`));
  }
  assert.equal(defaults.milestone.bossCount, 1);
  assert.equal(defaults.milestone.additionalBossMultiplier, 1);
  assert.equal(defaults.milestone.scaleWithMilestoneIndex, false);
  assert.equal(defaults.milestone.allowLeakedBossSurvival, true);
  assert(section.includes(defaults.milestone.idempotencyKey));
});
run('무드표·기본값 일치와 밝기층 상한', () => {
  assert.equal(defaults.mood.entries.length, 5);
  for (const mood of defaults.mood.entries) {
    assert(mood.alpha >= 0 && mood.alpha <= 0.08);
    const row = prd.split('\n').find(line => line.includes(`| \`${mood.id}\` |`));
    assert(row); assert(row.includes(`/ ${mood.alpha} |`));
    if (mood.tint) assert(row.includes(mood.tint));
  }
  assert(prd.includes(`${defaults.mood.transitionMs}ms`));
});
run('승인 상태·병렬 소유권·시안 해시', () => {
  for (const [name, value] of Object.entries(defaults.approval)) if (name !== 'userStyleApproved' && !name.startsWith('userConfirmed')) assert.equal(value, false, name);
  assert.equal(defaults.authoring.commanderAtATime, 1); assert.equal(defaults.authoring.ownerPerFile, 1);
  assert.equal(defaults.referenceSha256, hash('docs/assets/design-41-kingdom-expedition.png'));
});
run('사용자 확정 결정(2026-10-28)의 PRD·JSON 일치', () => {
  const u = defaults.userDecisions, a = defaults.approval;
  assert(a.userConfirmedSkipZero && a.userConfirmedKoreanDifficultyLabels && a.userConfirmedNoSpeedControl && a.userConfirmedHpGrowth115);
  assert.equal(u.hpGrowthPercent, balance.waves.hpGrowthPercent); assert.equal(u.battleSpeedControl, false);
  for (const d of Object.values(balance.difficulties)) assert.equal(d.skipPt, u.skipPt);
  assert.deepEqual(Object.values(defaults.displayLabels.difficulty), ['쉬움', '보통', '어려움', '아주 어려움']);
  assert.deepEqual(balance.userConfirmed.fields, ['difficulties.*.skipPt', 'difficulties.*.label', 'waves.hpGrowthPercent']);
  assert(prd.includes(`**${u.date} 사용자 확정:**`));
  assert(prd.includes('[확정] **‘모르겠어요’는 PT 0·골드 0이다.**'));
  assert(prd.includes(`[확정] 성장률 ${u.hpGrowthPercent}%는 ${u.date} 사용자 결정이다.`));
  assert(prd.includes('[확정] **쉬움 / 보통 / 어려움 / 아주 어려움**'));
  assert(prd.includes('[확정] 배속은'));
  assert(!prd.includes('1%p씩 올려'), '확정 성장률을 자동으로 올리는 옛 규칙이 남음');
});
run('실제 문항 초안 스키마와 PRD의 버전·상태 분리', () => {
  const schema = json('docs/contracts/question-draft.schema.json');
  assert(prd.includes(`schemaVersion=${schema.properties.schemaVersion.const}`));
  assert.deepEqual(schema.properties.status.enum, ['draft', 'machine_checked']);
  assert.equal(schema.additionalProperties, false);
});
const docs = ['README.md', 'docs/READ_FIRST.md', 'docs/HANDOFF.md', 'docs/style-lock-v1.md', prdPath, 'docs/prd_v0_5_review.md', 'docs/model_work_orders_v0_5.md', 'docs/EXECUTION_BOARD.md', 'docs/contracts/README.md'];
let links = 0;
for (const file of docs) run(`활성 문서 로컬 링크: ${file}`, () => {
  const contents = read(file);
  for (const match of contents.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
    const url = match[1]; if (/^(https?:|mailto:|#)/.test(url)) continue;
    const relative = decodeURIComponent(url.split('#')[0]);
    const target = path.resolve(path.dirname(path.join(root, file)), relative);
    assert(target.startsWith(root + path.sep), `저장소 밖 링크: ${url}`);
    assert(fs.existsSync(target) || target === path.join(root, reportPath), `없는 링크: ${file} → ${url}`);
    links++;
  }
  assert.equal((contents.match(/^```/gm) || []).length % 2, 0, '닫히지 않은 코드 블록');
});
run('현재 진입 문서의 PRD 연결', () => {
  for (const file of ['README.md', 'docs/READ_FIRST.md', 'docs/HANDOFF.md']) assert(read(file).includes(prdPath));
});
const report = {
  reviewedForDate: '2026-10-28', generatedAt: new Date().toISOString(),
  scope: '현재 문서의 링크·계약 일치·좌표 구조·설치칸 품질·화면 모드 산술·보존 해시만 검사. 게임·브라우저·기기·밸런스·교육·외부 검수·공개 승인 아님.',
  sourceHashes: Object.fromEntries([...docs, 'docs/contracts/maps.candidate.v0.4.json', 'docs/contracts/product.defaults.v0.5.json', 'docs/contracts/balance.candidate.v0.3.json'].map(p => [p, hash(p)])),
  checks, localLinksChecked: links, maps: mapMetrics, preserved,
  passed: checks.filter(x => x.status === 'passed').length,
  failed: checks.filter(x => x.status === 'failed').length,
  notExecuted: ['제품 단위/통합/e2e', '앱 빌드', '브라우저/실기기', '밸런스 시뮬레이션', '외부 Argon/Opus', '문항 공동검수', '배포'],
};
fs.writeFileSync(path.join(root, reportPath), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, localLinksChecked: links, maps: mapMetrics, failures: checks.filter(x => x.status === 'failed'), reportPath, scope: report.scope }, null, 2));
if (report.failed) process.exitCode = 1;
