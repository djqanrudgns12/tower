import type { AssetEntry, AssetManifest } from '../contracts/assetManifest';
import { ART_ROLES, ENEMY_KINDS, FORM_IDS, TOWER_IDS, type EnemyKind, type FormId, type TowerId } from '../contracts/balance';
import { formBranch } from '../domain/towers';

// 에셋 ID와 표시 규격. Codex 이미지 작업(ART-SAMPLE)은 같은 ID·기준점으로 PNG를 납품하고,
// 납품 전에는 art.ts가 같은 ID로 임시 그림을 만든다. 렌더러 코드는 출처를 구분하지 않는다(PRD §11.2).
export const CELL_PX = 64;
export const WORLD_W = 15 * CELL_PX;
export const WORLD_H = 9 * CELL_PX;
/** 임시 그림의 텍스처 배율(고해상도 화면 대비). */
export const TEX = 2;

export interface AssetSpec {
  key: string;
  /** 텍스처 원본 px. */
  width: number;
  height: number;
  /** 지면 기준점(0..1). */
  originX: number;
  originY: number;
  /** 전장 표시 너비(셀). */
  displayCells: number;
  /** 본체 그림에서 무기 중심을 놓을 점(본체 그림 px). 없으면 TowerLayer의 기본 높이를 쓴다. */
  weaponMount?: { x: number; y: number };
}

const tower = (id: TowerId): AssetSpec => ({ key: `tower.${id}`, width: 128, height: 160, originX: 0.5, originY: 0.86, displayCells: 1.28 });
const weapon = (id: TowerId): AssetSpec => ({ key: `tower.${id}.weapon`, width: 96, height: 96, originX: 0.5, originY: 0.5, displayCells: 0.9 });

export const ENEMY_DISPLAY: Record<EnemyKind, number> = { walker: 0.72, runner: 0.66, brute: 0.8, shell: 0.76, wisp: 0.7, swarm: 0.6, flyer: 0.7, splitter: 0.76, splitling: 0.5, boss: 1.15 };
/** 인수된 원화의 적 기준점(발 중심). 없는 종류는 임시 그림 기준점(0.5, 0.78)을 쓴다. */
const ENEMY_ORIGIN: Partial<Record<EnemyKind, { x: number; y: number }>> = {};

/** 무기 층이 없는 타워. 임시 무기가 뜨지 않게 ASSETS.weapons에서 뺀다(깃발초소는 공격하지 않고, 나머지 5종은 장판·덫·굴림·부름·조련이라 날아가는 무기 그림이 없다). */
export const WEAPONLESS_TOWERS: readonly TowerId[] = ['banner', 'falcon', 'roller', 'alchemist', 'trap', 'bell'];

export const ASSETS = {
  ground: { key: 'map.ground', width: WORLD_W * TEX, height: WORLD_H * TEX, originX: 0, originY: 0, displayCells: 15 },
  towers: Object.fromEntries(TOWER_IDS.map(id => [id, tower(id)])) as Record<TowerId, AssetSpec>,
  weapons: Object.fromEntries(TOWER_IDS.filter(id => !WEAPONLESS_TOWERS.includes(id)).map(id => [id, weapon(id)])) as Partial<Record<TowerId, AssetSpec>>,
  enemy: (kind: EnemyKind, frame: 0 | 1): AssetSpec => ({ key: `enemy.${kind}.${frame}`, width: kind === 'boss' ? 192 : 128, height: kind === 'boss' ? 192 : 128, originX: ENEMY_ORIGIN[kind]?.x ?? 0.5, originY: ENEMY_ORIGIN[kind]?.y ?? 0.78, displayCells: ENEMY_DISPLAY[kind] }),
  projectile: { arrow: 'fx.arrow', ball: 'fx.ball', shard: 'fx.shard', spark: 'fx.spark', puff: 'fx.puff' },
  badge: { armored: 'badge.armored', swift: 'badge.swift' },
  /** 종족 특성 배지(prd-r4 §7.2 E): 화면 원화 아이콘(public/assets/ui/trait.*.webp)을 같은 그림으로 싣는다. 못 실으면 배지 없이 둔다. 하늘 떼는 배지를 달지 않는다. */
  traitBadge: { shell: 'badge.trait.armor', clay: 'badge.trait.clay', burrow: 'badge.trait.burrow' },
} as const;

type Placement = Pick<AssetSpec, 'originX' | 'originY' | 'displayCells'>;

/** 진화 형태 본체 그림(`tower.<타워>.<형태>`, 형태는 FormId 그대로)의 규격. manifest의 integrated_pass 항목으로 채운다. */
export const TOWER_FORM_ART = new Map<string, AssetSpec>();
const isTowerId = (id: string): id is TowerId => (TOWER_IDS as readonly string[]).includes(id);
const isEvolvedForm = (form: string): form is Exclude<FormId, 'base'> => form !== 'base' && (FORM_IDS as readonly string[]).includes(form);

/**
 * 타워 본체 그림 고르기: tower.<타워>.<형태> → 부모 형태(A1·A2→A, B1·B2→B) → 기본형(ASSETS.towers — 인수 원화, 없으면 같은 키의 임시 그림).
 * `has`는 텍스처 존재 여부(Phaser textures.exists)라서 manifest에 있어도 파일을 못 실었으면 다음 후보로 넘어간다.
 */
export function towerBodyArt(type: TowerId, form: FormId, has: (key: string) => boolean): AssetSpec {
  const branch = formBranch(form);
  const chain = branch === null ? [] : form === branch ? [form] : [form, branch];
  for (const f of chain) {
    const spec = TOWER_FORM_ART.get(`tower.${type}.${f}`);
    if (spec && has(spec.key)) return spec;
  }
  return ASSETS.towers[type];
}

/** 종족 그림(`<접두어>.<역할|boss5~boss20>`, domain/factions.ts enemyArtId)의 기준점·표시 크기. manifest에서 채운다. */
export const ART_DISPLAY = new Map<string, Placement>();
const isArtRole = (role: string) => (ART_ROLES as readonly string[]).includes(role);
const isEnemyKind = (kind: string): kind is EnemyKind => (ENEMY_KINDS as readonly string[]).includes(kind);

export interface EnemyArt extends Placement {
  /** 텍스처 키의 뿌리. 프레임 묶음이면 `<base>.<n>`, 한 장이면 base 자체가 키다. 피격 그림은 `<base>.hit`. */
  base: string;
  framed: boolean;
  frames: number;
}

const FRAME_MAX = 8;
const placement = (s: AssetSpec): Placement => ({ originX: s.originX, originY: s.originY, displayCells: s.displayCells });

/**
 * 적 하나의 그림 고르기: 종족 그림 id(한 장, 또는 `<id>.0…` 묶음 — 정원 보병 별칭 enemy.walker) → 지금의 enemy.<kind>.<n>
 * → 임시 대역(enemy.walker.<n>, 종류 크기). `has`는 텍스처 존재 여부(Phaser textures.exists).
 */
export function enemyArt(artId: string, kind: EnemyKind, has: (key: string) => boolean): EnemyArt {
  const framed = (base: string, at: Placement): EnemyArt => {
    let frames = 1;
    while (frames < FRAME_MAX && has(`${base}.${frames}`)) frames++;
    return { base, framed: true, frames, ...at };
  };
  const own = placement(ASSETS.enemy(kind, 0));
  if (has(`${artId}.0`)) {
    const alias = /^enemy\.([a-z]+)$/.exec(artId)?.[1];
    return framed(artId, alias && isEnemyKind(alias) ? placement(ASSETS.enemy(alias, 0)) : own);
  }
  if (has(artId)) return { base: artId, framed: false, frames: 1, ...(ART_DISPLAY.get(artId) ?? own) };
  if (has(`enemy.${kind}.0`)) return framed(`enemy.${kind}`, own);
  return framed('enemy.walker', { ...placement(ASSETS.enemy('walker', 0)), displayCells: own.displayCells });
}

/** 무기 그림 중심이 본체 기준점 위로 놓이는 기본 높이(월드 px): 돌리는 무기는 0.32+0.32칸, 떠 있는 무기는 0.38+0.32칸. */
const defaultWeaponAbove = (fixed: boolean) => CELL_PX * (fixed ? 0.70 : 0.64);

/**
 * 본체 그림의 장착점(본체 그림 px)이 정하는 무기 위치: 기본 높이보다 올라가는 높이(lift)와 가로 이동(dx), 월드 px.
 * 장착점이 없으면(기존 10종) 0·0이라 위치가 그대로다.
 */
export function weaponMountOffset(spec: AssetSpec, fixed: boolean): { lift: number; dx: number } {
  const m = spec.weaponMount;
  if (!m) return { lift: 0, dx: 0 };
  const perPx = (CELL_PX * spec.displayCells) / spec.width;
  return { lift: (spec.originY * spec.height - m.y) * perPx - defaultWeaponAbove(fixed), dx: (m.x - spec.originX * spec.width) * perPx };
}

/** 인수된 원화의 기준점·표시 크기로 임시 규격을 덮어쓴다. 반환값은 실을 파일 목록. */
export function applyManifest(manifest: AssetManifest): AssetEntry[] {
  const accepted = manifest.assets.filter(a => a.status === 'integrated_pass');
  for (const a of accepted) {
    const override = { key: a.id, width: a.width, height: a.height, originX: a.originX, originY: a.originY, displayCells: a.displayCells };
    const art = /^[a-z]+\.([a-z0-9]+)$/.exec(a.id)?.[1];
    if (art && isArtRole(art)) ART_DISPLAY.set(a.id, placement(override));
    const tower = /^tower\.([a-z]+)$/.exec(a.id)?.[1] as TowerId | undefined;
    const weapon = /^tower\.([a-z]+)\.weapon$/.exec(a.id)?.[1] as TowerId | undefined;
    if (tower) ASSETS.towers[tower] = a.weaponMount ? { ...override, weaponMount: { ...a.weaponMount } } : override;
    if (weapon) ASSETS.weapons[weapon] = override;
    const form = /^tower\.([a-z]+)\.([A-Z][0-9]?)$/.exec(a.id);
    if (form && isTowerId(form[1]!) && isEvolvedForm(form[2]!)) TOWER_FORM_ART.set(a.id, override);
    const enemy = /^enemy\.([a-z]+)\.[01]$/.exec(a.id)?.[1] as EnemyKind | undefined;
    if (enemy) { ENEMY_DISPLAY[enemy] = a.displayCells; ENEMY_ORIGIN[enemy] = { x: a.originX, y: a.originY }; }
  }
  return accepted;
}

/**
 * 이 맵 판에서 실을 그림만 남긴다(구현 계획서 단계 2). 다른 맵의 재료(`map.<다른 맵 id>.…`)는 빼고,
 * 지금 맵의 재료(`map.<지금 맵 id>.…`)와 공용 그림(타워·몬스터·정원 지면·성문 등)은 둔다. 맵 id 뒤의 점까지 맞춰서 `river_z`가 `river`와 헷갈리지 않는다.
 */
export function entriesForMap(entries: readonly AssetEntry[], mapId: string, allMapIds: readonly string[]): AssetEntry[] {
  const others = allMapIds.filter(id => id !== mapId).map(id => `map.${id}.`);
  return entries.filter(a => !others.some(prefix => a.id.startsWith(prefix)));
}
