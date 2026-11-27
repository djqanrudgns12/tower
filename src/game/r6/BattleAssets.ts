import type Phaser from 'phaser';
import type { Enemy, RunState } from '../../domain/types';
import { R6_TOWERS, SPECIES, type EntityId, type R6TowerId, type Species } from '../../contracts/balanceV2';
import type { GameContext } from '../../domain/context';
import { previewR6Wave } from '../../domain/r6Mixer';
import elf from './monsters/elf.json';
import human from './monsters/human.json';
import insect from './monsters/insect.json';
import machine from './monsters/machine.json';
import stone from './monsters/stone.json';
import { biomeForGrade, type MapBiome } from './mapPhase';
import { r6Pad } from './mapProjection';
import { monsterPackSchema, r6ManifestSchema, r6TowerPackSchema, towerPackPath, type R6Manifest, type R6Sheet } from './manifest';

const BASE = 'assets/r6/';
const MANIFEST_KEY = 'r6.manifest';
export const R6_GROUND_KEY = 'r6.ground';
const R6_GROUND_ALT_KEY = 'r6.ground.alt';
export const R6_PAD_KEY = 'r6.map.pad';
export const R6_GATE_BACK_KEY = 'r6.gate.back';
export const R6_GATE_FRONT_KEY = 'r6.gate.front';
export const R6_AURA_KEY = 'r6.map.aura';
export const R6_MAP_META_KEY = 'r6.map.v2meta';

export interface MapV2LayerMeta {
  readonly file: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly displayW: number;
  readonly displayH: number;
}

export interface MapV2Meta {
  readonly version: number;
  readonly overview: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly gatePlaneY: number;
  readonly portalInteriorCells: readonly [number, number];
  readonly gateBack: MapV2LayerMeta;
  readonly gateFront: MapV2LayerMeta;
  readonly aura: { readonly file: string; readonly size: readonly [number, number] };
}

function terrainFile(biome: MapBiome, lightTheme: boolean, high: boolean): string {
  return `map/${biome}-${lightTheme ? 'day' : 'dark'}-${high ? '2x' : '1x'}.webp`;
}

function terrainSpec(biome: MapBiome, lightTheme: boolean, high: boolean): string {
  return `${biome}:${lightTheme ? 'day' : 'dark'}:${high ? '2x' : '1x'}`;
}
const sheetKey = (id: string, high = false) => `r6.sheet.${id}${high ? '.2x' : ''}`;
const atlasKey = (id: string) => `r6.atlas.${id}`;
const rigKey = (id: string) => `r6.rig.${id}`;
export const HANGAR_FLIGHT = 'hangar-flight';
type SpeciesPack = NonNullable<R6Manifest['species'][Species]>;
const catalogs = { elf, human, insect, machine, stone };
const monsterPacks = new Map(SPECIES.map(species => [species, monsterPackSchema.parse(catalogs[species])]));

type EnemyRef = { faction?: string };

export class R6BattleAssets {
  manifest: R6Manifest | null = null;
  /** 적을 대역으로 그리는 중이면 새 파일이 준비됐을 때만 Spine으로 교체한다. */
  revision = 0;
  private readonly requested = new Set<string>();
  private readonly baseTowerSheets = new Set<string>();
  private readonly stagedTowerSheets = new Set<string>();
  private readonly failedTowerSheets = new Set<string>();
  private currentTerrainKey = R6_GROUND_KEY;
  private currentTerrainSpec = '';
  private pendingTerrainSpec = '';

  constructor(private readonly scene: Phaser.Scene, private readonly useHighSheets: () => boolean) {
    scene.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (!file.key.startsWith('r6.sheet.')) return;
      this.stagedTowerSheets.delete(file.key);
      this.failedTowerSheets.add(file.key);
    });
  }

  get mapMeta(): MapV2Meta | null {
    const raw = this.scene.cache.json.get(R6_MAP_META_KEY) as MapV2Meta | undefined;
    return raw && typeof raw.gatePlaneY === 'number' ? raw : null;
  }

  preload(mapId: string, owned: readonly string[], grade = 3, lightTheme = true) {
    const { load } = this.scene;
    if (mapId === 'garden_u') {
      const biome = biomeForGrade(grade);
      const high = this.useHighSheets();
      this.currentTerrainKey = R6_GROUND_KEY;
      this.currentTerrainSpec = terrainSpec(biome, lightTheme, high);
      load.json(R6_MAP_META_KEY, BASE + 'map/map-v2-meta.json');
      load.image(R6_GROUND_KEY, BASE + terrainFile(biome, lightTheme, high));
      const padScale = high ? 2 : 1;
      load.spritesheet(R6_PAD_KEY, BASE + (high ? 'map/meadow-pads-2x.webp' : 'map/meadow-pads.webp'), {
        frameWidth: r6Pad.size[0]! * padScale, frameHeight: r6Pad.size[1]! * padScale,
      });
      load.image(R6_GATE_BACK_KEY, BASE + 'map/gate-back.webp');
      load.image(R6_GATE_FRONT_KEY, BASE + 'map/gate-front.webp');
      load.spritesheet(R6_AURA_KEY, BASE + 'map/wave-aura.webp', { frameWidth: 128, frameHeight: 128 });
    }
    load.once(`filecomplete-json-${MANIFEST_KEY}`, (_key: string, _type: string, data: unknown) => {
      const result = r6ManifestSchema.safeParse(data);
      if (!result.success) return;
      this.manifest = result.data;
      const map = this.manifest.maps[mapId];
      if (map && mapId !== 'garden_u') load.image(R6_GROUND_KEY, BASE + map);
      for (const id of R6_TOWERS) if (owned.includes(id)) this.queueTowerIcon(id);
    });
    load.json(MANIFEST_KEY, BASE + 'manifest-v2.json');
  }

  /** 주간/야간 또는 1x/2x 지형을 비동기 교체하고 이전 지형 텍스처를 내려 VRAM 예산을 12 MiB 이하로 유지한다. */
  swapMapTheme(grade: number, lightTheme: boolean, onSwapped: (key: string) => void) {
    const biome = biomeForGrade(grade);
    const high = this.useHighSheets();
    const spec = terrainSpec(biome, lightTheme, high);
    if (spec === this.currentTerrainSpec || spec === this.pendingTerrainSpec) return;
    const { load, textures } = this.scene;
    const nextKey = this.currentTerrainKey === R6_GROUND_KEY ? R6_GROUND_ALT_KEY : R6_GROUND_KEY;
    this.pendingTerrainSpec = spec;
    if (textures.exists(nextKey)) textures.remove(nextKey);
    load.once(`filecomplete-image-${nextKey}`, () => {
      if (this.pendingTerrainSpec !== spec) {
        if (textures.exists(nextKey)) textures.remove(nextKey);
        return;
      }
      const prevKey = this.currentTerrainKey;
      this.currentTerrainKey = nextKey;
      this.currentTerrainSpec = spec;
      this.pendingTerrainSpec = '';
      onSwapped(nextKey);
      if (prevKey !== nextKey && textures.exists(prevKey)) textures.remove(prevKey);
    });
    load.image(nextKey, BASE + terrainFile(biome, lightTheme, high));
    if (!load.isLoading()) load.start();
  }

  towerUnlocked(id: R6TowerId, onReady: () => void) {
    if (!this.queueTowerIcon(id)) return;
    const { load } = this.scene;
    load.once('complete', onReady);
    if (!load.isLoading()) load.start();
  }

  private queueTowerIcon(id: R6TowerId) {
    const { manifest, scene: { load } } = this;
    if (!manifest) return false;
    const first = manifest.towers[id]?.[0];
    if (!first) {
      const key = `r6.tower-pack.${id}`;
      if (!manifest.lazyTowers?.includes(id) || this.requested.has(key)) return false;
      this.queue(key, () => load.json(key, BASE + towerPackPath(id)));
      load.once(`filecomplete-json-${key}`, (_key: string, _type: string, data: unknown) => {
        const pack = r6TowerPackSchema.safeParse(data);
        if (!pack.success) return;
        Object.assign(manifest.sheets, pack.data.sheets);
        manifest.towers[id] = pack.data.forms;
        this.queueTowerIcon(id);
      });
      return true;
    }
    if (this.baseTowerSheets.has(sheetKey(first.body))) return false;
    for (const sheet of [first.body, first.head]) {
      const key = sheetKey(sheet);
      this.baseTowerSheets.add(key);
      if (!this.stagedTowerSheets.delete(key)) this.loadTowerSheet(key, manifest.sheets[sheet]!, false);
    }
    return true;
  }

  /** 새 해상도가 로드될 때까지 기존 시트를 계속 쓴다. 실제 프레임 크기는 이 키에만 영향을 준다. */
  towerTexture(id: string, keep?: Set<string>): string | undefined {
    const spec = this.manifest?.sheets[id];
    if (!spec) return undefined;
    const large = sheetKey(id, true);
    const high = Boolean(spec.file2x && this.useHighSheets() && !this.failedTowerSheets.has(large));
    const wanted = sheetKey(id, high);
    keep?.add(wanted);
    const { textures } = this.scene;
    const alternative = sheetKey(id, !high);
    const ready = textures.exists(wanted) ? wanted : textures.exists(alternative) ? alternative : undefined;
    if (ready) keep?.add(ready);
    return ready;
  }

  /** 전장에 쓰는 해상도만 적재한다. 그림을 교체한 뒤 사용하지 않는 GPU 텍스처를 정리한다. */
  keepTowerSheets(keys: ReadonlySet<string>) {
    const { manifest } = this;
    if (!manifest) return;
    const { load, textures } = this.scene;
    let added = false;
    for (const key of keys) {
      if (this.baseTowerSheets.has(key) || this.stagedTowerSheets.has(key) || this.failedTowerSheets.has(key)) continue;
      const [, , id, density] = key.split('.');
      const spec = id && manifest.sheets[id];
      if (!spec) continue;
      this.stagedTowerSheets.add(key);
      this.loadTowerSheet(key, spec, density === '2x');
      added = true;
    }
    for (const key of this.stagedTowerSheets) {
      if (keys.has(key) || !textures.exists(key)) continue;
      textures.remove(key);
      this.stagedTowerSheets.delete(key);
    }
    if (added && !load.isLoading()) load.start();
  }

  addTowerIcons(icons: Record<string, string>) {
    if (!this.manifest) return;
    const { textures } = this.scene;
    for (const id of R6_TOWERS) {
      const form = this.manifest.towers[id]?.[0];
      if (!form) continue;
      const body = sheetKey(form.body), head = sheetKey(form.head);
      if (textures.exists(body)) icons[`tower.${id}`] = textures.getBase64(body, form.bodyFrame);
      if (textures.exists(head)) icons[`tower.${id}.weapon`] = textures.getBase64(head, 0);
    }
  }

  prepareWave(ctx: GameContext, state: RunState) {
    const { load, spine } = this.scene;
    const { manifest } = this;
    if (!manifest || !spine || !ctx.balance.r6 || state.phase === 'GAME_OVER' || state.wave < 1) return;
    const refs: EnemyRef[] = state.battle
      ? [...state.enemies, ...state.battle.spawnList]
      : previewR6Wave(ctx.balance.r6.rules, ctx.map.id, state.config.seed, state.wave).map(m => ({ faction: m.species }));
    const before = this.requested.size;
    const active = new Set(refs.map(ref => ref.faction));
    for (const species of SPECIES) {
      if (!active.has(species)) continue;
      const pack = manifest.species[species];
      if (!pack) continue;
      this.queue(atlasKey(pack.atlas), () => load.spineAtlas(atlasKey(pack.atlas), BASE + manifest.atlases[pack.atlas]!));
      const monsters = monsterPacks.get(species);
      if (monsters && pack.atlas !== species && Object.keys(monsters.rigs).length) {
        this.queue(atlasKey(species), () => load.spineAtlas(atlasKey(species), BASE + monsters.atlas));
        for (const [id, rig] of Object.entries(monsters.rigs)) {
          this.queue(rigKey(id), () => load.spineSkeleton(rigKey(id), BASE + rig.file));
        }
      }
      // 분열·호위 파생체도 같은 종족 묶음에서 준비한다.
      for (const child of [pack.fallback, ...Object.values(pack.entities)]) {
        this.queue(rigKey(child.rig), () => load.spineSkeleton(rigKey(child.rig), BASE + manifest.rigs[child.rig]!.file));
      }
    }
    if (this.requested.size === before) return;
    load.once('complete', () => this.revision++);
    if (!load.isLoading()) load.start();
  }

  enemyArt(enemy: Enemy) {
    const { manifest, scene } = this;
    const species = SPECIES.find(id => id === enemy.faction);
    const pack = manifest && species && manifest.species[species];
    if (!manifest || !pack || !species) return null;
    const monsters = monsterPacks.get(species);
    const mapped = enemy.entityId && monsters?.entities[enemy.entityId];
    if (mapped && monsters && enemy.entityId && !pack.entities[enemy.entityId]) {
      const data = rigKey(mapped.rig);
      const atlas = atlasKey(species);
      if (scene.cache.json.exists(data) && scene.cache.text.exists(atlas) && scene.textures.exists(atlas + '!' + species + '.webp')) {
        return { data, atlas, skin: mapped.skin, rig: monsters.rigs[mapped.rig]!, scale: mapped.scale };
      }
      if (scene.load.isLoading()) return null;
    }
    const actor = this.actor(pack, enemy.entityId);
    const data = rigKey(actor.rig);
    const atlas = atlasKey(pack.atlas);
    if (!scene.cache.json.exists(data) || !scene.cache.text.exists(atlas)) return null;
    const rig = manifest.rigs[actor.rig]!;
    return { data, atlas, skin: actor.skin, rig, scale: rig.scale * (enemy.kind === 'boss' ? 1.5 : 1) };
  }

  private actor(pack: SpeciesPack, entityId: EntityId | undefined) {
    const actor = entityId && pack.entities[entityId];
    if (actor) return actor;
    const { rig, skin, tierSkins } = pack.fallback;
    const tier = Number(entityId?.at(-1)) - 1;
    return { rig, skin: tierSkins?.[tier] ?? skin };
  }

  private loadTowerSheet(key: string, spec: R6Sheet, high: boolean) {
    const density = high ? 2 : 1;
    this.scene.load.spritesheet(key, BASE + (high ? spec.file2x! : spec.file), {
      frameWidth: spec.width * density, frameHeight: spec.height * density, endFrame: spec.count - 1,
    });
  }

  private queue(key: string, add: () => void) {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    add();
  }
}
