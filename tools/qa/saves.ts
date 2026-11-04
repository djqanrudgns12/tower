import { TOWER_IDS, type DifficultyId, type FormId, type TowerId } from '../../src/contracts/balance';
import { contextFor, gradeContent } from '../../src/content';
import type { GameContext } from '../../src/domain/context';
import type { DomainEvent } from '../../src/domain/events';
import { advanceTick, applyCommand, createRun, type Command } from '../../src/domain/run';
import { evolutionChoices } from '../../src/domain/towers';
import { burrowed } from '../../src/domain/traits';
import type { RunState } from '../../src/domain/types';

// 화면 점검용 저장본 만들기(tools/qa/scenes.mjs가 vite runnerImport로 읽는다). 판정은 제품 엔진이 하고,
// 여기서는 장면에서 볼 것이 실제로 보이는 상태(웨이브·타워 형태·적·연출)를 고르는 가상 플레이어일 뿐이다.
// 골드·장착함은 점검 편의로 늘려 쓰지만 만든 상태는 순수 RunState JSON이라 이어하기가 그대로 읽는다.

/** 장면 하나의 저장본. runMs는 이어한 뒤 게임 시간으로 이만큼 흘리고 찍으라는 뜻(0이면 바로 찍는다). */
export interface BuiltScene {
  state: RunState;
  runMs: number;
  /** 사람이 읽을 요약(찾은 순간·적 구성). 보고서·로그용이다. */
  note: string;
}

export interface SceneRequest {
  /** 학년(3~6). 맵은 학년이 정한다. 4~6학년은 공개 문제은행이 생기기 전에는 이어하기가 막힌다. */
  grade?: number;
  difficulty?: DifficultyId;
  seed?: number;
  /** 'invasion' 장면의 웨이브(기본 23). 정원 맵은 W16~20 딱정벌레(등껍질)·W21~25 하늘유랑단(하늘 떼)·W31~35 가마(흙 보호막)·W36~40 두더지(땅굴). */
  wave?: number;
}

const TICK_MS = 1000 / 30;
const ticksToMs = (n: number) => Math.round(n * TICK_MS) + 24;

// ── 기본 도구 ────────────────────────────────────────────────────────────────────────────────

function fresh(req: SceneRequest, seed: number): { ctx: GameContext; s: RunState } {
  const grade = req.grade ?? 3, difficulty = req.difficulty ?? 'Normal';
  const ctx = contextFor(grade, difficulty);
  const { bank } = gradeContent(grade);
  const s = createRun(ctx, {
    runId: `qa-${grade}-${seed}`, playerId: 'qa-player', nickname: '하늘바람', grade, difficulty, mapId: ctx.map.id, seed: req.seed ?? seed,
    bankId: bank!.bankId, bankVersion: bank!.bankVersion, contentMode: bank!.status === 'published' ? 'published' : 'development',
    availableTowers: [...TOWER_IDS], rankingEligibility: 'personal', createdAt: '2026-11-03T00:00:00.000Z',
  });
  return { ctx, s };
}

function ok(ctx: GameContext, s: RunState, cmd: Command): DomainEvent[] {
  const r = applyCommand(ctx, s, cmd);
  if (!r.ok) throw new Error(`명령 거부: ${cmd.type} → ${r.error}`);
  return r.events;
}

const ticks = (ctx: GameContext, s: RunState, n: number) => { for (let i = 0; i < n; i++) advanceTick(ctx, s); };

/** 현재 문항에 정답을 내고 피드백이 끝날 때까지 흘린다. */
function answerCorrect(ctx: GameContext, s: RunState) {
  const enc = s.quiz.current!;
  ok(ctx, s, { type: 'answer', encounterId: enc.id, choice: ctx.questions.get(enc.questionId)!.correctOptionId });
  ticks(ctx, s, s.quiz.feedback!.autoAdvanceTick! - s.tick);
}

/** 준비 문제를 모두 맞혀 배치 단계로 간다. */
function toBuild(ctx: GameContext, s: RunState) {
  while (s.phase === 'PREP_QUIZ') answerCorrect(ctx, s);
}

/** 배치 단계에서 웨이브 번호를 점검용으로 건너뛴다(그 웨이브의 편성·체력·색조가 바로 나온다). */
function jumpToWave(s: RunState, wave: number) {
  s.wave = wave;
  s.completedWave = wave - 1;
  s.waveKillPtGranted = 0;
}

export interface TowerSpec {
  type: TowerId;
  level?: number;
  /** 진화 경로. 'A1'처럼 2차형이면 1차형은 앞 글자로 따라온다. 기본은 형태 이름 없이 레벨만 올린다(Lv4부터는 A로 간다). */
  form?: FormId;
  slot?: string;
}

/** 경로를 많이 덮는 빈 자리부터(tests/unit/helpers.ts nearestSlots와 같은 순서). */
function slotsByCover(ctx: GameContext): string[] {
  const path = ctx.map.pathCells;
  return [...ctx.map.slots]
    .map(slot => ({ id: slot.id, d: Math.min(...path.map(([x, y]) => (x - slot.x) ** 2 + (y - slot.y) ** 2)), cover: path.filter(([x, y]) => (x - slot.x) ** 2 + (y - slot.y) ** 2 <= 6.25).length }))
    .sort((a, b) => b.cover - a.cover || a.d - b.d || a.id.localeCompare(b.id))
    .map(x => x.id);
}

/**
 * 타워를 지어 원하는 레벨·형태까지 키운다. 골드와 장착함은 점검 편의로 늘렸다가 끝에 돌려놓는다(`owned`는 realOwned로).
 * 설치 되돌리기 칩이 화면에 남지 않게 undo 기한도 지운다.
 */
function place(ctx: GameContext, s: RunState, specs: readonly TowerSpec[], opts: { owned?: TowerId[]; gold?: number } = {}) {
  const realOwned = [...s.owned];
  s.owned = [...TOWER_IDS];
  const order = slotsByCover(ctx);
  const taken = new Set(s.towers.map(t => t.slotId));
  const free = () => order.find(id => !taken.has(id))!;
  for (const spec of specs) {
    s.gold = 1_000_000;
    const slotId = spec.slot ?? free();
    taken.add(slotId);
    ok(ctx, s, { type: 'build', slotId, tower: spec.type });
    const tower = s.towers.find(t => t.slotId === slotId)!;
    const want = spec.form ?? 'A';
    const parent = want.length === 2 ? (want[0] as 'A' | 'B') : (want === 'B' ? 'B' : 'A');
    while (tower.level < (spec.level ?? 1)) {
      const choices = evolutionChoices(ctx.balance, tower);
      ok(ctx, s, choices ? { type: 'upgrade', towerId: tower.id, form: (choices.includes(want) ? want : choices.includes(parent) ? parent : choices[0]!) as FormId } : { type: 'upgrade', towerId: tower.id });
    }
    tower.undoUntilTick = null;
  }
  s.owned = opts.owned ?? realOwned;
  s.gold = opts.gold ?? s.gold;
}

/** 시작 4종 + 징집으로 얻은 것으로 보이는 장착함(최대 8칸). */
const OWNED_8: TowerId[] = ['archer', 'cannon', 'frost', 'mage', 'sling', 'trap', 'alchemist', 'falcon'];

interface Scan { tick: number; score: number; note: string }

/**
 * 전투 틱을 maxTicks까지 흘리며 장면 점수가 가장 높은 순간을 찾는다. 상태를 복제해 두고 그 순간 lead틱 앞으로 다시 흘려 돌려준다
 * (이어한 뒤 lead틱 + after틱 흘려 찍으면 연출이 한창일 때를 잡는다). 점수가 0 이하이면 던진다.
 */
function findMoment(ctx: GameContext, s: RunState, maxTicks: number, score: (s: RunState, ev: DomainEvent[]) => number, lead: number): { state: RunState; peek: RunState; tick: number; score: number } {
  const base = structuredClone(s);
  let best: Scan = { tick: -1, score: 0, note: '' };
  for (let i = 0; i < maxTicks && s.phase === 'BATTLE'; i++) {
    const ev = advanceTick(ctx, s);
    const sc = score(s, ev);
    if (sc > best.score) best = { tick: i + 1, score: sc, note: '' };
  }
  if (best.tick < 0) throw new Error('원하는 순간을 찾지 못했다');
  const replay = structuredClone(base);
  const head = Math.max(0, best.tick - lead);
  ticks(ctx, replay, head);
  // 이어한 뒤 lead틱을 더 흘렸을 때의 모습(찍을 순간). 보고용 요약은 이 상태로 쓴다.
  const peek = structuredClone(replay);
  ticks(ctx, peek, best.tick - head);
  return { state: replay, peek, tick: best.tick, score: best.score };
}

/** 이 웨이브의 적 구성 요약(종족·역할 개수). */
function crowdNote(s: RunState): string {
  const count = new Map<string, number>();
  for (const e of s.enemies) count.set(`${e.faction}/${e.kind}`, (count.get(`${e.faction}/${e.kind}`) ?? 0) + 1);
  return [...count].map(([k, n]) => `${k}×${n}`).join(', ');
}

const alive = (s: RunState) => s.enemies.filter(e => e.alive);
const onRoad = (s: RunState) => alive(s).filter(e => e.progress > 1500 && e.progress < 38000).length;

/** 웨이브 w를 막 시작한 전투 상태. 타워는 specs대로, 적은 spawnTicks 동안 흘려 길에 올린다. */
function battleAt(req: SceneRequest, seed: number, wave: number, specs: readonly TowerSpec[], opts: { ownedTowers?: TowerId[]; gold?: number; warm: number }): { ctx: GameContext; s: RunState } {
  const { ctx, s } = fresh(req, seed);
  toBuild(ctx, s);
  jumpToWave(s, wave);
  place(ctx, s, specs, { owned: opts.ownedTowers ?? OWNED_8, gold: opts.gold ?? 140 });
  ok(ctx, s, { type: 'startBattle' });
  ticks(ctx, s, opts.warm);
  s.gateHp = s.gateMaxHp;
  return { ctx, s };
}

// ── 장면 ─────────────────────────────────────────────────────────────────────────────────────

type Builder = (req: SceneRequest) => BuiltScene;

/** 중간 강도의 기본 방어(웨이브가 올라도 몇 마리는 살아서 길 위를 간다). */
const MID_DEFENSE: TowerSpec[] = [
  { type: 'archer', level: 5 }, { type: 'cannon', level: 4 }, { type: 'frost', level: 4 }, { type: 'mage', level: 3 },
  { type: 'sling', level: 3 }, { type: 'archer', level: 2 }, { type: 'trap', level: 2 },
];

/** 장면 7(비행·분열·바닥 효과)을 만드는 방어. */
const FX_DEFENSE: TowerSpec[] = [
  { type: 'alchemist', level: 5, form: 'B2' }, { type: 'trap', level: 5, form: 'B1' }, { type: 'roller', level: 5, form: 'B1' }, { type: 'ballista', level: 5, form: 'B2' },
  { type: 'falcon', level: 4 }, { type: 'archer', level: 4 }, { type: 'wind', level: 4 }, { type: 'mortar', level: 3 }, { type: 'cannon', level: 3 }, { type: 'bell', level: 3 },
];

/**
 * 웨이브 wave를 specs 방어로 돌리며, 화면 부하(적 수·비행·분열·바닥 효과·폭발·피격)가 가장 큰 windowTicks틱 구간을 찾아 그 시작에서 멈춘 상태를 돌려준다.
 * 성문은 아주 튼튼하게 해 둬 구간 안에서 지지 않는다(저사양 측정은 실시간으로 이 구간을 이어 흘린다).
 */
function effectWindow(req: SceneRequest, seed: number, wave: number, specs: readonly TowerSpec[], windowTicks: number): BuiltScene {
  const { ctx, s } = battleAt(req, seed, wave, specs, { warm: 0, ownedTowers: OWNED_8 });
  s.gateMaxHp = s.gateHp = 100_000;
  const base = structuredClone(s);
  const load: number[] = [];
  for (let i = 0; i < 4000 && s.phase === 'BATTLE'; i++) {
    const ev = advanceTick(ctx, s);
    const a = alive(s);
    load.push(a.filter(e => e.flying).length + a.filter(e => e.kind === 'splitter' || e.derived).length + s.hazards.length * 2
      + ev.filter(e => e.type === 'hazardTriggered').length * 4 + ev.filter(e => e.type === 'hit' || e.type === 'kill').length + Math.min(a.length, 40) / 2);
  }
  let best = { at: 0, sum: -1 };
  let sum = load.slice(0, windowTicks).reduce((x, y) => x + y, 0);
  for (let i = 0; i + windowTicks < load.length; i++) {
    if (i > 0) sum += load[i + windowTicks - 1]! - load[i - 1]!;
    if (sum > best.sum) best = { at: i, sum };
  }
  if (best.sum < 0) throw new Error('측정 구간을 찾지 못했다');
  ticks(ctx, base, best.at);
  const peek = structuredClone(base);
  ticks(ctx, peek, windowTicks);
  return { state: base, runMs: 0, note: `W${wave} 부하 구간 시작 ${best.at}틱(평균 부하 ${(best.sum / windowTicks).toFixed(1)}), 시작 적 ${alive(base).length}(${crowdNote(base)}), 끝 적 ${alive(peek).length}` };
}

export const BUILDERS: Record<string, Builder> = {
  /** 장면 2: 웨이브 1 전투 시작 직후. 타워 3기, 적이 한두 마리 길에 오른 순간. */
  'w1-battle': req => {
    const { s } = battleAt(req, 101, 1, [{ type: 'archer', slot: 'garden_u-s09' }, { type: 'cannon', slot: 'garden_u-s12' }, { type: 'frost', slot: 'garden_u-s13' }], { warm: 150, gold: 85, ownedTowers: ['archer', 'cannon', 'frost', 'mage'] });
    return { state: s, runMs: 200, note: `W1 전투 ${s.tick}틱, 적 ${alive(s).length}마리(${crowdNote(s)})` };
  },

  /** 장면 3: 웨이브 3을 지킨 직후. 마무리 문제와 징집 카드 3장이 뜬다. */
  'draft-w3': req => {
    const { ctx, s } = battleAt(req, 102, 3, [{ type: 'archer', level: 3 }, { type: 'archer', level: 2 }, { type: 'cannon', level: 3 }, { type: 'frost', level: 2 }, { type: 'mage', level: 2 }], { warm: 60, gold: 160, ownedTowers: ['archer', 'cannon', 'frost', 'mage'] });
    for (let i = 0; i < 6000 && s.phase === 'BATTLE'; i++) advanceTick(ctx, s);
    if (s.phase === 'BATTLE') throw new Error('W3이 끝나지 않았다');
    if (s.phase === 'GAME_OVER') throw new Error('W3에서 졌다');
    // 마무리 문제를 풀고 준비 단계로 넘어간 뒤의 화면이 대표적이다. 답하지 않은 채 두면 마무리 문제가 그대로 보인다.
    return { state: s, runMs: 120, note: `${s.phase} W${s.wave}, 징집 후보 ${s.draft?.offers.join('/')}` };
  },

  /** 장면 4: 첫 진화(Lv3 → Lv4) 직전. 7웨이브 배치 단계에 Lv3 타워 몇 기와 충분한 골드. */
  'evolve-w7': req => {
    const { ctx, s } = fresh(req, 103);
    toBuild(ctx, s);
    jumpToWave(s, 7);
    place(ctx, s, [
      { type: 'archer', level: 3, slot: 'garden_u-s09' }, { type: 'cannon', level: 3, slot: 'garden_u-s12' }, { type: 'frost', level: 2, slot: 'garden_u-s13' },
      { type: 'mage', level: 2, slot: 'garden_u-s16' }, { type: 'sling', level: 2, slot: 'garden_u-s03' }, { type: 'trap', level: 1, slot: 'garden_u-s18' },
    ], { owned: ['archer', 'cannon', 'frost', 'mage', 'sling', 'trap'], gold: 420 });
    return { state: s, runMs: 0, note: `W7 배치, 골드 ${s.gold}, 타워 ${s.towers.length}기` };
  },

  /** 장면 5: 자리 20곳 모두 Lv7 2차형. 신규 10종 + 기존 10종을 한 번씩. 장착함은 실제처럼 8칸. */
  'lv7-field': req => {
    const { ctx, s } = fresh(req, 104);
    toBuild(ctx, s);
    jumpToWave(s, 15);
    const forms: Array<[TowerId, FormId]> = [
      ['archer', 'B1'], ['crossbow', 'A1'], ['cannon', 'A2'], ['mage', 'B1'], ['frost', 'A1'], ['lightning', 'B2'], ['flame', 'A2'], ['spear', 'B1'], ['guardian', 'A1'], ['banner', 'B2'],
      ['sling', 'A2'], ['ballista', 'B2'], ['falcon', 'A1'], ['mortar', 'B1'], ['hwacha', 'A1'], ['roller', 'B1'], ['alchemist', 'B2'], ['wind', 'A2'], ['trap', 'B1'], ['bell', 'B2'],
    ];
    place(ctx, s, forms.map(([type, form]) => ({ type, form, level: 7 })), { owned: OWNED_8, gold: 500 });
    return { state: s, runMs: 0, note: `W15 배치, Lv7 ${s.towers.length}기: ${s.towers.map(t => `${t.type}.${t.form}`).join(' ')}` };
  },

  /** 장면 6a: 5웨이브 대장(국자대장 달그락, 방어 태세). 대장 체력이 반 아래로 내려가 태세가 켜진 직후. */
  'boss-w5': req => {
    const { ctx, s } = battleAt(req, 105, 5, MID_DEFENSE.slice(0, 6), { warm: 0, ownedTowers: ['archer', 'cannon', 'frost', 'mage', 'sling', 'trap'] });
    const m = findMoment(ctx, s, 2400, st => {
      const boss = st.enemies.find(e => e.boss && e.alive);
      return boss?.boss?.stance ? 1 + (onRoad(st) > 3 ? 1 : 0) + (1 - boss.progress / 40000) * 0.1 : 0;
    }, 12);
    const boss = m.peek.enemies.find(e => e.boss);
    return { state: m.state, runMs: ticksToMs(12 + 10), note: `W5 대장 태세 순간 ${m.tick}틱, 적 ${alive(m.peek).length}(${crowdNote(m.peek)}), 대장 ${boss ? `${boss.hp}/${boss.maxHp}, 태세 ${boss.boss?.stance ? '켜짐' : '꺼짐'}` : '?'}` };
  },

  /** 장면 6b: 10웨이브 대장(멧돼지기수 우당탕, 박차 행진). 돌진 구간 한가운데. */
  'boss-w10': req => {
    const { ctx, s } = battleAt(req, 106, 10, [...MID_DEFENSE, { type: 'hwacha', level: 3 }, { type: 'ballista', level: 3 }], { warm: 0, ownedTowers: OWNED_8 });
    const m = findMoment(ctx, s, 3000, st => {
      const boss = st.enemies.find(e => e.boss && e.alive);
      if (!boss) return 0;
      const sk = ctx.balance.factions[boss.faction]?.bosses?.boss10?.skill;
      if (!sk || sk.kind !== 'burst_march') return 0;
      const period = Math.round((sk.periodMs / 1000) * 30), dur = Math.round((sk.durationMs / 1000) * 30);
      const marching = (st.tick - boss.boss!.bornTick) % period >= period - dur;
      return marching && boss.progress > 4000 && boss.progress < 30000 ? 1 + onRoad(st) / 20 : 0;
    }, 20);
    const boss = m.peek.enemies.find(e => e.boss);
    return { state: m.state, runMs: ticksToMs(20 + 6), note: `W10 대장 돌진 순간 ${m.tick}틱, 적 ${alive(m.peek).length}(${crowdNote(m.peek)}), 대장 진행 ${boss?.progress}` };
  },

  /** 장면 7: 비행·분열 적 + 장판·덫·굴림체·폭발이 한 화면에. W18 전투에서 연출이 가장 많은 순간을 찾는다. */
  'fx-heavy': req => {
    const { ctx, s } = battleAt(req, 107, 18, FX_DEFENSE, { warm: 0, ownedTowers: OWNED_8 });
    const m = findMoment(ctx, s, 3600, (st, ev) => {
      const flyers = alive(st).filter(e => e.flying).length;
      const split = alive(st).filter(e => e.kind === 'splitter' || e.derived).length;
      const zones = st.hazards.filter(h => h.kind === 'zone' && !h.blast).length;
      const traps = st.hazards.filter(h => h.kind === 'trap').length;
      const rollers = st.hazards.filter(h => h.kind === 'roller').length;
      const blasts = st.hazards.filter(h => h.kind === 'zone' && h.blast).length;
      const burst = ev.some(e => e.type === 'hazardTriggered' && e.blast);
      if (!flyers || !split || !zones || !traps || !rollers) return 0;
      return Math.min(flyers, 3) + Math.min(split, 3) + Math.min(zones, 2) + Math.min(traps, 2) + Math.min(rollers, 2) + Math.min(blasts, 2) * 2 + (burst ? 6 : 0) + Math.min(onRoad(st), 14) / 4;
    }, 6);
    const kinds = [...new Set(m.peek.hazards.map(h => h.kind + (h.kind === 'zone' && h.blast ? '(blast)' : '')))].join('/');
    return { state: m.state, runMs: ticksToMs(6 + 6), note: `W18 연출 순간 ${m.tick}틱 점수 ${m.score}, 바닥 효과 ${kinds}, 적 ${alive(m.peek).length}(${crowdNote(m.peek)})` };
  },

  /**
   * 저사양 측정용(장면 7을 길게): 장면 7과 같은 방어로 W18을 돌리며 연출이 가장 많은 구간을 찾아 그 시작에서 멈춘 상태를 준다.
   * 측정 중에 지거나 웨이브가 끝나 장면이 비지 않게 성문을 아주 튼튼하게 해 둔다(렌더 부담에는 영향이 없다).
   */
  'fx-window': req => effectWindow(req, 107, 18, FX_DEFENSE, 330),

  /** 저사양 측정 참고(최악 장면): W61 침입(적 40마리 안팎)을 고레벨 방어로 돌리며 가장 붐비는 구간. */
  'crowd-window': req => effectWindow(req, 171, 61, [
    { type: 'archer', level: 9 }, { type: 'cannon', level: 9 }, { type: 'frost', level: 8 }, { type: 'mage', level: 8 }, { type: 'sling', level: 7 }, { type: 'trap', level: 7 },
    { type: 'alchemist', level: 7 }, { type: 'falcon', level: 7 }, { type: 'crossbow', level: 7 }, { type: 'wind', level: 7 },
  ], 330),

  /** 장면 8a: 9웨이브 노을. 길 위에 적이 여럿 있는 순간. */
  'tint-w9': req => {
    const { ctx, s } = battleAt(req, 108, 9, MID_DEFENSE, { warm: 0, ownedTowers: OWNED_8 });
    const m = findMoment(ctx, s, 1800, st => onRoad(st) + new Set(alive(st).map(e => e.kind)).size * 3, 0);
    return { state: m.state, runMs: 200, note: `W9 노을 ${m.tick}틱, 적 ${alive(m.peek).length}(${crowdNote(m.peek)})` };
  },

  /** 장면 8b: 17웨이브 밤. 비행·분열이 섞인 첫 웨이브. */
  'tint-w17': req => {
    const { ctx, s } = battleAt(req, 109, 17, [...MID_DEFENSE, { type: 'falcon', level: 3 }, { type: 'wind', level: 3 }], { warm: 0, ownedTowers: OWNED_8 });
    const m = findMoment(ctx, s, 2400, st => {
      const kinds = new Set(alive(st).map(e => e.kind));
      return onRoad(st) + kinds.size * 3 + (kinds.has('flyer') ? 4 : 0) + (kinds.has('splitter') ? 4 : 0);
    }, 0);
    return { state: m.state, runMs: 200, note: `W17 밤 ${m.tick}틱, 적 ${alive(m.peek).length}(${crowdNote(m.peek)})` };
  },

  /**
   * 장면 9: 침입 종족과 종족 특성(prd-r4 §7.2 E). 정원 맵에서 wave로 18(딱정벌레 등껍질)·23(하늘유랑단 하늘 떼)·33(가마 흙 보호막)·38(두더지 땅굴)을 고른다.
   * 타워는 고레벨 방어. 특성 배지가 붙은 적이 많고, 땅굴 구간에 들어간(흐려진) 적이 있는 순간을 고른다.
   */
  'invasion': req => {
    const wave = req.wave ?? 23;
    const hi: TowerSpec[] = [
      { type: 'archer', level: 9 }, { type: 'cannon', level: 9 }, { type: 'frost', level: 8 }, { type: 'mage', level: 8 }, { type: 'sling', level: 7 }, { type: 'trap', level: 7 },
      { type: 'alchemist', level: 7 }, { type: 'falcon', level: 7 }, { type: 'crossbow', level: 7 }, { type: 'wind', level: 7 },
    ];
    const { ctx, s } = battleAt(req, 110 + wave, wave, hi, { warm: 0, ownedTowers: OWNED_8 });
    const m = findMoment(ctx, s, 2400, st => {
      const f = new Set(alive(st).filter(e => e.faction !== ctx.balance.campaigns[ctx.map.id]!.primary).map(e => e.faction));
      const traits = alive(st).filter(e => e.trait).length;
      const under = alive(st).filter(e => burrowed(ctx.balance, ctx.path, e)).length;
      return onRoad(st) + f.size * 6 + new Set(alive(st).map(e => e.kind)).size + Math.min(traits, 6) + Math.min(under, 2) * 6;
    }, 0);
    const traits = [...new Set(alive(m.peek).flatMap(e => (e.trait ? [e.trait] : [])))].join('/') || '없음';
    return { state: m.state, runMs: 200, note: `W${wave} 침입 ${m.tick}틱, 특성 ${traits}, 땅속 ${alive(m.peek).filter(e => burrowed(ctx.balance, ctx.path, e)).length}, 적 ${alive(m.peek).length}(${crowdNote(m.peek)})` };
  },

  /** 장면 11: 원정 보물(prd-r4 §7.2-F). 10웨이브(대장)를 막 지킨 직후라 보물 후보 3개가 기다린다. */
  'relic-w10': req => {
    const { ctx, s } = battleAt(req, 113, 10, [
      { type: 'archer', level: 6 }, { type: 'cannon', level: 6 }, { type: 'frost', level: 5 }, { type: 'mage', level: 6 },
      { type: 'sling', level: 5 }, { type: 'falcon', level: 5 }, { type: 'trap', level: 4 }, { type: 'alchemist', level: 4 },
    ], { warm: 0, gold: 260, ownedTowers: OWNED_8 });
    s.gateMaxHp = s.gateHp = 100;
    for (let i = 0; i < 9000 && s.phase === 'BATTLE'; i++) advanceTick(ctx, s);
    if (s.phase === 'BATTLE' || s.phase === 'GAME_OVER') throw new Error(`W10이 끝나지 않았다: ${s.phase}`);
    s.gateMaxHp = s.gateHp = ctx.difficulty.gateHp;
    if (!s.relicOffer) throw new Error('보물 후보가 없다');
    return { state: s, runMs: 120, note: `${s.phase} W${s.wave}, 보물 후보 ${s.relicOffer.offers.join('/')}` };
  },

  /** 장면 10: 성문이 곧 무너질 전투. 이어한 뒤 몇 초 안에 패배해 결과 화면으로 간다. */
  'defeat-w9': req => {
    const { ctx, s } = battleAt(req, 111, 9, MID_DEFENSE.slice(0, 3), { warm: 0, ownedTowers: ['archer', 'cannon', 'frost', 'mage'] });
    const m = findMoment(ctx, s, 3000, st => (st.enemies.some(e => e.progress > 22000) ? onRoad(st) : 0), 0);
    m.state.gateHp = 1;
    m.state.stats.kills = 41; m.state.stats.goldEarned = 880;
    return { state: m.state, runMs: 0, note: `W9 성문 1, 적 ${alive(m.state).length}(${crowdNote(m.state)}), 가장 앞 진행 ${Math.max(...m.state.enemies.map(e => e.progress))}` };
  },

  /** 장면 10a용: 정지 화면을 볼 전투 중 상태. */
  'pause-w9': req => {
    const { ctx, s } = battleAt(req, 112, 9, MID_DEFENSE, { warm: 0, ownedTowers: OWNED_8 });
    const m = findMoment(ctx, s, 1500, st => onRoad(st), 0);
    return { state: m.state, runMs: 200, note: `W9 전투 ${m.tick}틱, 적 ${alive(m.state).length}` };
  },
};

export function buildScene(name: string, req: SceneRequest = {}): BuiltScene {
  const build = BUILDERS[name];
  if (!build) throw new Error(`없는 저장본: ${name} (${Object.keys(BUILDERS).join(', ')})`);
  const built = build(req);
  // 이어하기가 읽는 JSON 그대로인지 확인한다(순수 값만).
  JSON.parse(JSON.stringify(built.state));
  return built;
}
