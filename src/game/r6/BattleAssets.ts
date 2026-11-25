import type Phaser from 'phaser';
import type { Enemy, RunState } from '../../domain/types';
import { R6_TOWERS, SPECIES, type EntityId, type R6TowerId, type Species } from '../../contracts/balanceV2';
import type { GameContext } from '../../domain/context';
import { previewR6Wave } from '../../domain/r6Mixer';
import { r6Pad } from './mapProjection';
import { r6ManifestSchema, r6TowerPackSchema, towerPackPath, type R6Manifest, type R6Sheet } from './manifest';

const BASE = 'assets/r6/';
const MANIFEST_KEY = 'r6.manifest';
export const R6_GROUND_KEY = 'r6.ground';
export const R6_PAD_KEY = 'r6.map.pad';
export const sheetKey = (id: string) => `r6.sheet.${id}`;
const atlasKey = (id: string) => `r6.atlas.${id}`;
const rigKey = (id: string) => `r6.rig.${id}`;
export const HANGAR_FLIGHT = 'hangar-flight';
type SpeciesPack = NonNullable<R6Manifest['species'][Species]>;
type EnemyRef = { faction?: string };

export class R6BattleAssets {
  manifest: R6Manifest | null = null;
  /** 적을 대역으로 그리는 중이면 새 파일이 준비됐을 때만 Spine으로 교체한다. */
  revision = 0;
  private readonly requested = new Set<string>();
  private readonly baseTowerSheets = new Set<string>();
  private readonly stagedTowerSheets = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  preload(mapId: string, owned: readonly string[]) {
    const { load } = this.scene;
    load.once(`filecomplete-json-${MANIFEST_KEY}`, (_key: string, _type: string, data: unknown) => {
      const result = r6ManifestSchema.safeParse(data);
      if (!result.success) return;
      this.manifest = result.data;
      const map = this.manifest.maps[mapId];
      if (mapId === 'garden_u' && map) {
        load.image(R6_GROUND_KEY, BASE + 'map/meadow-plateau.webp');
        load.spritesheet(R6_PAD_KEY, BASE + 'map/meadow-pads.webp', {
          frameWidth: r6Pad.size[0]!, frameHeight: r6Pad.size[1]!,
        });
      } else if (map) load.image(R6_GROUND_KEY, BASE + map);
      for (const id of R6_TOWERS) if (owned.includes(id)) this.queueTowerIcon(id);
    });
    load.json(MANIFEST_KEY, BASE + 'manifest-v2.json');
  }

  towerUnlocked(id: R6TowerId, onReady: () => void) {
    if (!this.queueTowerIcon(id)) return;
    const { load } = this.scene;
    load.once('complete', onReady);
    if (!load.isLoading()) load.start();
  }

  prepareHangarFlight() {
    const spec = this.manifest?.sheets[HANGAR_FLIGHT];
    if (!spec) return;
    const { load } = this.scene;
    this.queue(sheetKey(HANGAR_FLIGHT), () => {
      this.loadTowerSheet(HANGAR_FLIGHT, spec);
      if (!load.isLoading()) load.start();
    });
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
    if (this.baseTowerSheets.has(first.body)) return false;
    for (const sheet of [first.body, first.head]) {
      this.baseTowerSheets.add(sheet);
      if (!this.stagedTowerSheets.delete(sheet)) this.loadTowerSheet(sheet, manifest.sheets[sheet]!);
    }
    return true;
  }

  /** 전장에 쓰는 형태만 적재한다. 사용할 그림을 적용한 뒤 이전 프레임의 텍스처를 정리한다. */
  keepTowerSheets(ids: ReadonlySet<string>) {
    if (!this.manifest) return;
    const { load, textures } = this.scene;
    let added = false;
    for (const id of ids) {
      if (this.baseTowerSheets.has(id) || this.stagedTowerSheets.has(id)) continue;
      const spec = this.manifest.sheets[id];
      if (!spec) continue;
      this.stagedTowerSheets.add(id);
      this.loadTowerSheet(id, spec);
      added = true;
    }
    for (const id of this.stagedTowerSheets) {
      const key = sheetKey(id);
      if (ids.has(id) || !textures.exists(key)) continue;
      textures.remove(key);
      this.stagedTowerSheets.delete(id);
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
    if (!manifest || !pack) return null;
    const actor = this.actor(pack, enemy.entityId);
    const data = rigKey(actor.rig);
    const atlas = atlasKey(pack.atlas);
    if (!scene.cache.json.exists(data) || !scene.cache.text.exists(atlas)) return null;
    return { data, atlas, skin: actor.skin, rig: manifest.rigs[actor.rig]! };
  }

  private actor(pack: SpeciesPack, entityId: EntityId | undefined) {
    const actor = entityId && pack.entities[entityId];
    if (actor) return actor;
    const { rig, skin, tierSkins } = pack.fallback;
    const tier = Number(entityId?.at(-1)) - 1;
    return { rig, skin: tierSkins?.[tier] ?? skin };
  }

  private loadTowerSheet(id: string, spec: R6Sheet) {
    const high = this.scene.scale.zoom < .75 ? spec.file2x : undefined;
    const density = high ? 2 : 1;
    this.scene.load.spritesheet(sheetKey(id), BASE + (high ?? spec.file), {
      frameWidth: spec.width * density, frameHeight: spec.height * density, endFrame: spec.count - 1,
    });
  }

  private queue(key: string, add: () => void) {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    add();
  }
}
