import type { Balance, BossSkillKind, EnemyKind } from '../../contracts/balance';
import type { DomainEvent } from '../../domain/events';
import { bossDef, burstMarching } from '../../domain/factions';
import type { Enemy } from '../../domain/types';
import { airborne } from '../../domain/waves';

// 전장 연출 고르기(대장 기믹·비행·분열). Phaser 없이 상태·사건만 읽어 무엇을 그릴지 정한다.
// 층은 이 결과만 그리고, 고를 것이 없으면(사건·기믹·그림이 없으면) 아무것도 그리지 않는다.

/** 떠 있는 비행 적의 몸 높이(칸). 그림자는 땅에 남는다. */
export const FLYER_LIFT_CELLS = 0.25;
/** 분열 파생체가 튀어나오고 호위병이 나타나는 시간(ms). */
export const INTRO_MS = 300;
/** 분열 파생체가 튀는 높이·옆 거리의 꼭대기(칸). */
export const SPLIT_HOP_CELLS = 0.22, SPLIT_SWAY_CELLS = 0.4;
/** 분열 적의 처치 보상 표찰을 올리는 높이(칸): 튀어나오는 파생체를 가리지 않게 한다. */
export const SPLIT_LABEL_RAISE_CELLS = 0.5;

/** 대장이 지금 하고 있는 일(상태로 읽는 상시 표시). */
export interface BossStatus {
  /** 방어 태세 중: 발밑 방패 고리. */
  stance: boolean;
  /** 남은 겹방패: 머리 위 방패 점 수. */
  wardDots: number;
  /** 박차 행진 돌진 중: 발밑 먼지 줄. */
  dash: boolean;
  /** 진군 북소리 반경(milli-cell): 둘레 옅은 원. 기믹이 아니면 0. */
  rallyMilli: number;
}

/** 대장의 상시 표시. 기믹이 없는 적이면 null. 돌진은 이동과 같은 식(factions.burstMarching)이고, 기절 중이면 보이지 않는다. */
export function bossStatus(b: Balance, e: Enemy, tick: number): BossStatus | null {
  if (!e.boss) return null;
  const skill = bossDef(b, e)?.skill;
  if (!skill) return null;
  return {
    stance: skill.kind === 'iron_stance' && e.boss.stance !== null && tick < e.boss.stance.untilTick,
    wardDots: skill.kind === 'ward_layers' ? Math.max(0, e.boss.wardLeft) : 0,
    dash: skill.kind === 'burst_march' && e.stunUntilTick <= tick && burstMarching(skill, e.boss.bornTick, tick),
    rallyMilli: skill.kind === 'rally_haste' ? skill.radiusMilli : 0,
  };
}

/** 대장 기믹 사건 하나의 순간 연출. 돌진·북소리는 사건이 없고 상시 표시로만 보인다. */
export type BossCue =
  /** 방어 태세 발동: 발밑 방패 고리가 한 번 조여 든다. */
  | { kind: 'ring' }
  /** 겹방패 한 겹이 벗겨졌다: 머리 위 점 하나(index, 벗겨지기 전 줄 기준)가 튄다. */
  | { kind: 'wardPop'; index: number; of: number }
  /** 새참 회복: 초록 +체력(화면 단위 HP). */
  | { kind: 'heal'; hp: number }
  /** 호위 호출: 대장 옆 먼지 구름. */
  | { kind: 'dust' };

/** 사건의 기믹이 그 대장의 기믹과 같을 때만 연출을 고른다. 적이 이미 없으면 null(되돌림). */
export function bossCue(b: Balance, e: Enemy | undefined, skill: BossSkillKind): BossCue | null {
  if (!e?.alive || !e.boss) return null;
  const def = bossDef(b, e)?.skill;
  if (!def || def.kind !== skill) return null;
  switch (def.kind) {
    case 'iron_stance': return { kind: 'ring' };
    case 'ward_layers': return { kind: 'wardPop', index: e.boss.wardLeft, of: e.boss.wardLeft + 1 };
    // 체력은 milli-HP다. 화면에는 타워 피해와 같은 HP 단위로 보인다.
    case 'snack_mend': return { kind: 'heal', hp: Math.max(1, Math.round(Math.floor((e.maxHp * def.healBP) / 10000) / 1000)) };
    case 'call_escort': return { kind: 'dust' };
    default: return null;
  }
}

/** 겹방패 점 n개의 가로 위치(월드 px, 대장 가운데 기준). 점 사이 gap. */
export function wardDotOffsets(n: number, gap = 11): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => (i - (n - 1) / 2) * gap);
}

/** 새로 나온 적의 등장 연출: 분열 파생체는 처치 지점에서 튀어나오고, 호위병은 대장 옆 먼지 속에서 나타난다. */
export interface SpawnIntro {
  enemyId: number;
  style: 'split' | 'escort';
  /** 분열: 처치 지점(milli). 호위: null(제자리에서 나타난다). */
  from: { x: number; y: number } | null;
  /** 튀어나가는 옆 방향(-1…1). 둘이면 왼쪽·오른쪽으로 갈라진다. */
  side: number;
}

/**
 * 한 틱의 사건 묶음에서 등장 연출할 적을 찾는다. 처치 → 분열 파생체 생성, 호위 호출 → 호위병 생성은 같은 묶음에서 바로 이어진다
 * (combat.kill → split, combat.bossThresholds). 그 사이에 다른 사건이 끼면 묶음이 끝난 것으로 본다.
 */
export function spawnIntros(b: Balance, events: readonly DomainEvent[]): SpawnIntro[] {
  interface Group { style: SpawnIntro['style']; from: SpawnIntro['from']; kind: EnemyKind | null; ids: number[] }
  const groups: Group[] = [];
  let open: Group | null = null;
  for (const e of events) {
    if (e.type === 'spawn' && open && (open.kind === null || open.kind === e.kind)) { open.ids.push(e.enemyId); continue; }
    open = null;
    if (e.type === 'kill') {
      const rule: Balance['enemies'][EnemyKind]['split'] = b.enemies[e.kind].split;
      if (rule) open = { style: 'split', from: { x: e.x, y: e.y }, kind: rule.kind, ids: [] };
    } else if (e.type === 'bossSkill' && e.skill === 'call_escort') open = { style: 'escort', from: null, kind: null, ids: [] };
    if (open) groups.push(open);
  }
  return groups.flatMap(g => g.ids.map((enemyId, i) => ({ enemyId, style: g.style, from: g.from, side: g.ids.length === 1 ? 0 : -1 + (2 * i) / (g.ids.length - 1) })));
}

/** 등장 연출의 한 순간. t: 출발점→제자리 비율, lift·sway: 위·옆 오프셋(칸). 끝났으면 null. */
export interface IntroFrame { t: number; lift: number; sway: number; alpha: number; scale: number }

/** 움직임 줄이기면 제자리에서 투명도만 바뀐다(ui-rules-v2 §2). */
export function introFrame(intro: Pick<SpawnIntro, 'style' | 'side'>, ageMs: number, reducedMotion: boolean): IntroFrame | null {
  if (ageMs >= INTRO_MS) return null;
  const k = Math.max(0, ageMs) / INTRO_MS;
  if (reducedMotion) return { t: 1, lift: 0, sway: 0, alpha: k, scale: 1 };
  const ease = 1 - (1 - k) ** 2;
  if (intro.style === 'escort') return { t: 1, lift: 0, sway: 0, alpha: Math.min(1, k * 1.6), scale: 0.7 + 0.3 * ease };
  // 연기 덩이(반지름 약 0.3칸) 밖으로 옆으로 튀었다가 제자리에 내려앉는다. 낮게 뛰어 처치 보상 표찰 밑에 남는다.
  const arc = Math.sin(Math.PI * k);
  return { t: ease, lift: arc * SPLIT_HOP_CELLS, sway: intro.side * arc * SPLIT_SWAY_CELLS, alpha: 1, scale: 0.55 + 0.45 * ease };
}

/** 비행 적의 몸 높이(칸): 떠 있으면 FLYER_LIFT_CELLS, 끌어내려진 동안·지상 적은 0. */
export const flyerLift = (e: Pick<Enemy, 'flying' | 'groundedUntilTick'>, tick: number) => (airborne(e, tick) ? FLYER_LIFT_CELLS : 0);
