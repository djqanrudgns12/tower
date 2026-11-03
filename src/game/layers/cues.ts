import type { Balance, BossSkillKind, EnemyKind } from '../../contracts/balance';
import type { DomainEvent } from '../../domain/events';
import { bossDef, burstMarching } from '../../domain/factions';
import { positionAt, type PathGeometry } from '../../domain/geometry';
import type { Enemy, FieldHazard, HazardKind, Phase } from '../../domain/types';
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

// ── 장판·덫·굴림체(RunState.hazards, towers.md §4-7) 표시 ─────────────────────────────────────────
// 상태가 있을 때만 그린다. 길이는 칸, 시간은 ms다. 움직임 줄이기면 크기·위치 변화 없이 투명도만 바뀐다(ui-rules-v2 §2).

/** 장판 웅덩이: 반경은 규칙 값(milli-cell), 세로는 비스듬한 땅 위에 놓인 모양으로 살짝 눌러 그린다. 알파 0.35, 사라질 때 200ms 페이드. */
export const ZONE_ALPHA = 0.35;
export const ZONE_FLATTEN = 0.8;
export const ZONE_FADE_MS = 200;
/** 덫 원판 지름(칸). 발동하면 150ms 동안 이 배율까지 작아졌다 돌아온다. */
export const TRAP_DIAMETER_CELLS = 0.3;
export const TRAP_CLOSE_MS = 150;
export const TRAP_CLOSE_SCALE = 0.78;
/** 굴림체 통나무: 굴러가는 방향과 직각으로 눕는 길이·굵기(칸). 끝나면 150ms 페이드. */
export const ROLLER_LENGTH_CELLS = 0.62;
export const ROLLER_THICK_CELLS = 0.3;
export const ROLLER_FADE_MS = 150;

export type HazardLook =
  | { kind: 'zone'; rx: number; ry: number }
  | { kind: 'trap'; diameter: number }
  /** progress: 화면 시각의 진행도(milli). 상태의 진행도에서 틱 사이 alpha만큼 더 굴러간 값이다. */
  | { kind: 'roller'; progress: number };

/**
 * 상태의 장판·덫·굴림체 하나를 어떻게 그릴지 고른다. 한 번 터지고 사라지는 지연 폭발(blast)은 땅에 남는 것이 아니라서 null(그리지 않는다).
 * 굴림체는 틱마다 stepMilli씩 입구 쪽(진행도 감소)으로 가므로 틱 사이에는 alpha(0..1)만큼 더 간 자리에 그리고, 끝점을 넘지 않는다.
 */
export function hazardLook(h: FieldHazard, alpha = 0): HazardLook | null {
  switch (h.kind) {
    case 'zone': return h.blast ? null : { kind: 'zone', rx: h.radius / 1000, ry: (h.radius / 1000) * ZONE_FLATTEN };
    case 'trap': return { kind: 'trap', diameter: TRAP_DIAMETER_CELLS };
    case 'roller': return { kind: 'roller', progress: Math.max(h.endProgress, h.progress - h.stepMilli * Math.min(1, Math.max(0, alpha))) };
  }
}

/** 굴림체가 가는 방향(라디안, 화면 좌표). 입구 쪽(진행도가 줄어드는 쪽)이며, 길이 0이면 0이다. */
export function rollerHeading(path: PathGeometry, progress: number, span = 50): number {
  const from = positionAt(path, progress + span), to = positionAt(path, Math.max(0, progress - span));
  return from.x === to.x && from.y === to.y ? 0 : Math.atan2(to.y - from.y, to.x - from.x);
}

/** 사라지는 연출. scale이 1이 아니면 그만큼 작아지며 사라진다(움직임 줄이기면 항상 1). */
export function hazardEndCue(kind: HazardKind, reducedMotion: boolean): { ms: number; scale: number } {
  if (kind === 'zone') return { ms: ZONE_FADE_MS, scale: 1 };
  if (kind === 'trap') return { ms: TRAP_CLOSE_MS, scale: reducedMotion ? 1 : TRAP_CLOSE_SCALE };
  return { ms: ROLLER_FADE_MS, scale: 1 };
}

/** 덫 발동의 닫힘: ms 동안 scale·alpha까지 갔다가 같은 시간에 돌아온다(yoyo). 움직임 줄이기면 크기 대신 투명도만. */
export function trapCloseCue(reducedMotion: boolean): { ms: number; scale: number; alpha: number } {
  return reducedMotion ? { ms: TRAP_CLOSE_MS, scale: 1, alpha: 0.5 } : { ms: TRAP_CLOSE_MS, scale: TRAP_CLOSE_SCALE, alpha: 1 };
}


// ── 설치 받침 밝기 ─────────────────────────────────────────────────────────────────────────────────
// 받침은 평소 흐리게 두고, 타워를 고르거나 끌어 놓는 동안에만 밝힌다. 이미 타워가 선 받침은 그 타워의 발판이라 늘 밝다.

/** 빈 받침의 평소 투명도(타워·길보다 눈에 띄지 않게). 밝을 때는 1이다. */
export const PAD_ALPHA_REST = 0.4;
/** 받침 투명도가 목표로 가는 시간(ms). 움직임 줄이기면 바로 바뀐다(투명도만 바뀌므로 허용, ui-rules-v2 §2). */
export const PAD_FADE_MS = 140;

/** 놓을 자리를 밝혀야 하는 때: 설치·전투 단계에서 타워를 먼저 골랐거나(자리는 아직 안 골랐다) 장착 홈에서 끌고 있다. InputLayer의 빈 자리 테두리와 같은 조건이다. */
export function isPlacing(phase: Phase, sel: { previewType: string | null; slotId: string | null }, dragging: boolean): boolean {
  return (phase === 'BUILD' || phase === 'BATTLE') && ((sel.previewType !== null && sel.slotId === null) || dragging);
}

/** 받침 하나의 목표 투명도. 타워가 서 있거나 고르는 중인 자리·키보드 커서·고대비 설정이면 늘 밝다. */
export function padAlpha(o: { occupied: boolean; placing: boolean; focused: boolean; highContrast: boolean }): number {
  return o.occupied || o.placing || o.focused || o.highContrast ? 1 : PAD_ALPHA_REST;
}

// ── 맨 윗줄 타워의 세계 위쪽 경계 맞춤 ──────────────────────────────────────────────────────────────
// 캔버스가 세계(15×9칸)와 정확히 같아 위쪽 경계 밖은 그릴 수 없다(레이아웃 계약: 칸 = 캔버스 너비/15). 맨 윗줄 칸의 타워가 칸 위로 솟은 만큼 잘리지 않게
// 발판을 조금 내리고 필요하면 조금 줄인다. 위쪽 줄(경계에 닿지 않는 타워)은 그대로다.

/** 발판을 내리는 최대 거리(칸)·줄이는 최소 배율·위쪽 경계에서 남기는 여유(월드 px). 발판을 너무 내리면 받침에서 떠 길을 가린다. */
export const TOP_FIT = { dropCells: 0.08, minScale: 0.8, marginPx: 1 } as const;

/**
 * footY는 타워 발판(월드 px), above는 그 위로 솟은 가장 높은 불투명 부분(월드 px)이다. 경계 안에 들면 그대로(drop 0, scale 1),
 * 아니면 먼저 발판을 내리고 모자란 만큼 발판을 기준으로 줄인다.
 */
export function topFit(footY: number, above: number, cellPx: number): { drop: number; scale: number } {
  const room = footY - TOP_FIT.marginPx;
  if (above <= room) return { drop: 0, scale: 1 };
  const drop = Math.min(above - room, TOP_FIT.dropCells * cellPx);
  return { drop, scale: Math.max(TOP_FIT.minScale, Math.min(1, (room + drop) / above)) };
}
