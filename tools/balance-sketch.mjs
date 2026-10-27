import fs from 'node:fs';
import path from 'node:path';

// PRD 수치 탐색용 근사 모델이다. 제품 domain 엔진·시뮬레이터(S11)가 생기면 그 결과가 우선이고 이 파일은 폐기한다.
// 궁수/포탑/서리/마법탑과 각 A분기만 모델링하고, 부동소수 이동·즉시 판정 등 단순화를 쓴다.
const root = path.resolve(import.meta.dirname, '..');
const json = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const B = json('docs/contracts/balance.candidate.v0.3.json');
const MAPS = json('docs/contracts/maps.candidate.v0.4.json').maps;
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const HZ = B.units.tickHz;
const ticks = ms => Math.floor((ms * HZ + 999) / 1000);
const bp = x => x / 10000;
const round5 = x => 5 * Math.floor(x / 5 + 0.5);
const growth = Number(flag('growth', B.waves.hpGrowthPercent));
const ramp = !args.includes('--no-ramp');
const KINDS = ['walker', 'runner', 'brute', 'shell', 'wisp', 'swarm'];
const BRANCH_A = { archer: { intervalBP: 8000 }, cannon: { splash: 1050, maxTargets: 6 }, frost: { slowBP: 4000, slowMs: 2500 }, mage: { damageBP: 14000 } };
const STRATS = {
  novice: { attentionMs: 30000, randomSlots: true, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'mage', 'archer', 'cannon', 'mage'], upgradeAfterTowers: 6 },
  balanced: { attentionMs: 20000, randomSlots: false, pattern: ['archer', 'archer', 'cannon', 'frost', 'archer', 'cannon', 'mage', 'archer', 'cannon', 'mage'], upgradeAfterTowers: 0 },
  focused: { attentionMs: 20000, randomSlots: false, pattern: ['archer'], upgradeAfterTowers: 0 },
};

function xorshift(seed) { let x = (seed >>> 0) || 0x6d2b79f5; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function shuffle(list, rand) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }

function waveSpec(w, rand) {
  const c = B.waves.count, N = Math.min(c.max, c.base + c.step * Math.floor((w - 1) / c.stepEveryWaves));
  const boss = w % B.waves.bossEveryWaves === 0 ? 1 : 0, M = N - boss;
  const weights = B.waves.composition.filter(x => x.fromWave <= w).at(-1).weights;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const counts = KINDS.map(k => Math.floor(M * (weights[k] || 0) / total));
  const order = KINDS.map((k, i) => [M * (weights[k] || 0) / total - counts[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < M - counts.reduce((a, b) => a + b, 0); k++) counts[order[k][1]]++;
  const list = shuffle(KINDS.flatMap((k, i) => Array(counts[i]).fill(k)), rand).map(kind => ({ kind, elite: null }));
  const er = B.waves.eliteRate, rate = w < er.fromWave ? 0 : Math.min(er.maxBP, er.baseBP + er.perWaveBP * (w - er.fromWave)) / 10000;
  shuffle(list.map((_, i) => i), rand).slice(0, Math.floor(M * rate)).forEach(i => { list[i].elite = rand() < 0.5 ? 'armored' : 'swift'; });
  if (boss) list.splice(Math.floor(0.7 * (N - 1)), 0, { kind: 'boss', elite: null });
  const si = B.waves.spawnIntervalMs, ms = ramp && si.overrides[w] ? si.overrides[w] : Math.max(si.min, si.base + si.perWave * (w - 1));
  return { list, interval: ticks(ms) };
}

function geometry(map) {
  const pts = map.pathCells.map(([x, y]) => [x + 0.5, y + 0.5]), len = pts.length - 1;
  const at = p => { const i = Math.min(Math.floor(p), len - 1), f = p - i, a = pts[i], b = pts[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
  const coverage = (s, r) => { let n = 0; for (let p = 0; p <= len; p += 0.1) { const [x, y] = at(p); if ((x - s.x - 0.5) ** 2 + (y - s.y - 0.5) ** 2 <= r * r) n++; } return n / 10; };
  return { len, at, coverage };
}

function run({ mapId, diff, acc, readSec, strat, seed }) {
  const map = MAPS.find(m => m.id === mapId), D = B.difficulties[diff], S = STRATS[strat], geo = geometry(map);
  const rand = xorshift(seed * 2654435761), qrand = xorshift(seed * 97 + 13);
  const slots = map.slots.map(s => ({ ...s, cov: geo.coverage(s, 2.5) })).sort((a, b) => b.cov - a.cov || a.id.localeCompare(b.id));
  if (S.randomSlots) shuffle(slots, rand);
  const T = id => B.towers[id];
  const interval = t => T(t.type).intervalMs * (t.branch ? bp(BRANCH_A[t.type].intervalBP || 10000) : 1);
  const value = t => { const base = T(t.type).damage * bp(B.levels.damageMultiplierBP[t.lv - 1]) * (t.branch ? bp(BRANCH_A[t.type].damageBP || 10000) : 1) * 1000 / interval(t); return (t.type === 'cannon' ? base * 2 : t.type === 'frost' ? base + 6 : base) * t.cov / 4; };
  const state = { gold: B.run.startGold, pt: 0, ptQ: 0, ptK: 0, towers: [], correct: 0, wrong: 0, bossKill: 0, bossLeak: 0, firstEvo: null, sec: 0 };
  const answer = () => { const ok = qrand() < acc; if (ok) { state.gold += D.correctGold; state.pt += D.correctPt; state.ptQ += D.correctPt; state.correct++; } else { state.pt += D.wrongPt; state.ptQ += D.wrongPt; state.wrong++; } return ok; };
  const feedback = ok => readSec + (ok ? B.run.correctFeedbackMs : B.run.wrongFeedbackMinMs + 1000) / 1000;
  const spend = wave => {
    for (;;) {
      const options = [];
      if (state.towers.length < slots.length) { const type = S.pattern[state.towers.length % S.pattern.length], slot = slots[state.towers.length]; options.push({ cost: T(type).cost, gain: value({ type, lv: 1, cov: slot.cov }), apply: () => state.towers.push({ type, x: slot.x + 0.5, y: slot.y + 0.5, cov: slot.cov, lv: 1, branch: false, next: null }) }); }
      if (state.towers.length >= S.upgradeAfterTowers) for (const t of state.towers) if (t.lv < B.levels.max) {
        const next = { ...t, lv: t.lv + 1, branch: t.branch || t.lv + 1 === B.levels.branchAtLevel };
        options.push({ cost: round5(T(t.type).cost * bp(B.levels.upgradeCostOfBaseBP[t.lv - 1])), gain: value(next) - value(t), apply: () => { t.lv++; if (t.lv === B.levels.branchAtLevel) { t.branch = true; state.firstEvo ??= wave; } } });
      }
      const best = options.sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];
      if (!best || best.cost > state.gold) return;
      state.gold -= best.cost; best.apply();
    }
  };
  let hpBase = B.waves.baseHpMilli, completed = 0;
  for (let w = 1; w <= 200; w++) {
    if (w > 1) hpBase = Math.ceil(hpBase * growth / 100);
    for (let i = 0; i < (w === 1 ? B.run.prepAttempts.firstWave : B.run.prepAttempts.laterWaves); i++) state.sec += feedback(answer());
    spend(w); state.sec += 8;
    const spec = waveSpec(w, rand), enemies = [], shots = [];
    let tick = 0, spawned = 0, gate = D.gateHp, waveKillPt = 0, streak = 0, burnUntil = -1;
    let qTimer = Math.round(readSec * HZ), spendTimer = ticks(S.attentionMs);
    for (const t of state.towers) t.next = ticks(interval(t));
    const pos = e => geo.at(e.prog);
    const kill = e => {
      e.alive = false; const tier = e.kind === 'boss' ? 'boss' : e.elite ? 'elite' : 'regular';
      state.gold += D.killGold[tier]; let p = D.killPt[tier];
      if (tier === 'boss') state.bossKill++; else { p = Math.min(p, D.waveKillPtCap - waveKillPt); waveKillPt += p; }
      state.pt += p; state.ptK += p;
    };
    const hit = (e, dmg, type) => { if (!e.alive) return; e.hp -= dmg * (1 - (type === 'physical' ? e.phys : e.mag)); if (e.hp <= 0) kill(e); };
    for (;;) {
      tick++;
      if (--qTimer <= 0) { const ok = answer(); streak = ok ? streak + 1 : 0; if (ok && streak % B.burning.streak === 0) burnUntil = tick + ticks(B.burning.durationMs); qTimer = Math.round(feedback(ok) * HZ); }
      if (--spendTimer <= 0) { spend(w); spendTimer = ticks(S.attentionMs); for (const t of state.towers) t.next ??= tick + ticks(interval(t)); }
      if (spawned < spec.list.length && (tick - 1) % spec.interval === 0) {
        const s = spec.list[spawned++], K = B.enemies[s.kind], E = s.elite ? B.elites[s.elite] : null;
        const hp = Math.ceil(Math.ceil(Math.ceil(hpBase * bp(D.enemyHpBP)) * bp(K.hpBP)) * (E ? bp(E.hpBP) : 1)) / 1000;
        enemies.push({ kind: s.kind, elite: s.elite, hp, prog: 0, alive: true, slow: 0, slowUntil: 0, speed: bp(K.speedBP) * (E ? bp(E.speedBP) : 1), phys: Math.min(bp(B.elites.physicalResistCapBP), bp(K.physicalResistBP + (E ? E.addPhysicalResistBP : 0))), mag: bp(K.magicResistBP) });
      }
      for (const p of shots) if (!p.done && p.at <= tick) {
        p.done = true;
        if (p.splash) enemies.filter(e => e.alive).map(e => { const [x, y] = pos(e); return [e, (x - p.x) ** 2 + (y - p.y) ** 2]; }).filter(([, d]) => d <= p.splash ** 2).sort((a, b) => a[1] - b[1]).slice(0, p.max).forEach(([e]) => hit(e, p.dmg, 'physical'));
        else if (p.target.alive) { hit(p.target, p.dmg, p.type); if (p.slow && p.target.alive && p.slow >= p.target.slow) { p.target.slow = p.slow; p.target.slowUntil = tick + ticks(p.slowMs); } }
      }
      const speedUp = tick < burnUntil ? bp(B.burning.attackSpeedBP) : 0;
      for (const t of state.towers) {
        if (t.next === null || tick < t.next) continue;
        const C = T(t.type), r = C.rangeMilli / 1000;
        let target = null;
        for (const e of enemies) if (e.alive) { const [x, y] = pos(e); if ((x - t.x) ** 2 + (y - t.y) ** 2 <= r * r && (!target || e.prog > target.prog)) target = e; }
        if (!target) continue;
        const [x, y] = pos(target), A = t.branch ? BRANCH_A[t.type] : {};
        const dmg = C.damage * bp(B.levels.damageMultiplierBP[t.lv - 1]) * bp(A.damageBP || 10000);
        const at = tick + Math.max(1, Math.ceil(Math.hypot(x - t.x, y - t.y) / (C.projectileSpeedMilliPerSec / 1000) * HZ));
        shots.push(t.type === 'cannon' ? { splash: (A.splash || C.splashRadiusMilli) / 1000, max: A.maxTargets || C.maxTargets, x, y, dmg, at } : { target, dmg, type: C.damageType, at, slow: C.slowBP ? bp(A.slowBP || C.slowBP) : 0, slowMs: A.slowMs || C.slowMs });
        t.next = tick + Math.max(ticks(B.externalCaps.minAttackIntervalMs), Math.ceil(interval(t) / (1 + speedUp) * HZ / 1000));
      }
      for (const e of enemies) {
        if (!e.alive) continue;
        if (tick >= e.slowUntil) e.slow = 0;
        e.prog += geo.len / B.waves.baseTravelTicks * e.speed * (1 - Math.min(bp(e.kind === 'boss' ? B.statusCaps.bossSlowMaxBP : B.statusCaps.regularSlowMaxBP), e.slow));
        if (e.prog >= geo.len) { e.alive = false; gate -= B.leakDamage[e.kind === 'boss' ? 'boss' : e.elite ? 'elite' : 'regular']; if (e.kind === 'boss') state.bossLeak++; }
      }
      if (gate <= 0) { state.sec += tick / HZ; return { completed, minutes: state.sec / 60, ...state }; }
      if (spawned === spec.list.length && enemies.every(e => !e.alive)) break;
    }
    state.sec += tick / HZ; completed = w;
    if (w % B.waves.bossEveryWaves === 0) state.gold += D.milestoneSurvivalGold;
  }
  return { completed, minutes: state.sec / 60, ...state };
}

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const maps = flag('map', 'garden_u') === 'all' ? MAPS.map(m => m.id) : [flag('map', 'garden_u')];
const seeds = Number(flag('seeds', 6));
const rows = [];
for (const mapId of maps) for (const diff of Object.keys(B.difficulties)) for (const strat of (flag('strats', 'novice,focused')).split(',')) for (const acc of [0.6, 0.8, 0.95]) {
  const readSec = Number(flag('read', 12));
  const rs = Array.from({ length: seeds }, (_, i) => run({ mapId, diff, acc, readSec, strat, seed: i + 1 }));
  const bossTotal = rs.reduce((a, r) => a + r.bossKill + r.bossLeak, 0);
  rows.push({ mapId, diff, strat, acc, waves: `${median(rs.map(r => r.completed))} (${Math.min(...rs.map(r => r.completed))}-${Math.max(...rs.map(r => r.completed))})`, minutes: +median(rs.map(r => r.minutes)).toFixed(1), wave1Fail: `${rs.filter(r => r.completed === 0).length}/${seeds}`, firstEvo: median(rs.map(r => r.firstEvo ?? 99)), bossKill: bossTotal ? +(rs.reduce((a, r) => a + r.bossKill, 0) / bossTotal).toFixed(2) : null, vocabPtShare: +median(rs.map(r => r.ptQ / Math.max(1, r.ptQ + r.ptK))).toFixed(2) });
}
console.log(`balance-sketch · ${B.balanceVersion} · 성장 ${growth}% · 1~3웨이브 완화 ${ramp ? '적용' : '미적용'} · 읽기 ${flag('read', 12)}초 · seed ${seeds}`);
console.log('근사 모델 결과다. 실제 엔진·학생 플레이·밸런스 승인이 아니다.');
console.table(rows);
