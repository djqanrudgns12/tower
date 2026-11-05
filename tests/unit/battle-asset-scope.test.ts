import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/content';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { applyManifest, entriesForMap } from '../../src/game/assets';
import { GROUND_KITS, layoutFor, resolvePlacements } from '../../src/game/layouts';

// 단계 2(구현 계획서): 전투 장면은 지금 맵의 재료(`map.<맵 id>.…`)와 공용 그림만 싣는다. 다른 맵 재료는 받지 않는다.

const manifest = assetManifestSchema.parse(JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')));
const accepted = applyManifest(manifest);
const mapIds = MAPS.map(m => m.id);
const own = (mapId: string) => entriesForMap(accepted, mapId, mapIds);
const ids = (mapId: string) => new Set(own(mapId).map(a => a.id));

describe('전투가 싣는 그림 범위(entriesForMap)', () => {
  it('맵마다 지금 맵 재료와 공용 그림만 남고 다른 맵 재료는 없다', () => {
    for (const id of mapIds) {
      const loaded = own(id);
      const foreign = loaded.filter(a => mapIds.some(other => other !== id && a.id.startsWith(`map.${other}.`)));
      expect(foreign.map(a => a.id), `${id}에서 다른 맵 재료`).toEqual([]);
      for (const a of accepted.filter(x => x.id.startsWith(`map.${id}.`))) expect(ids(id).has(a.id), `${id}의 ${a.id}`).toBe(true);
    }
  });

  it('공용 그림(타워·몬스터·정원 지면·성문 등)은 어느 맵에서나 남는다', () => {
    for (const id of mapIds) {
      for (const common of ['tower.archer', 'tower.archer.A', 'enemy.walker.0', 'acorn.boss10', 'ground.grass', 'path.dirt', 'slot.pad.0', 'map.gate', 'map.entry', 'deco.tree', 'deco.stele', 'fx.cloudshadow.0']) {
        expect(ids(id).has(common), `${id}에서 ${common}`).toBe(true);
      }
    }
  });

  it('정원 판은 맵 재료 72장(강가·궁궐 뜰·설원)을 빼고 306장을 싣는다', () => {
    const mapSpecific = accepted.filter(a => mapIds.some(id => a.id.startsWith(`map.${id}.`)));
    expect(mapSpecific).toHaveLength(72);
    expect(own('garden_u')).toHaveLength(accepted.length - 72);
    for (const id of mapIds.filter(m => m !== 'garden_u')) expect(own(id)).toHaveLength(accepted.length - 72 + 24);
  });

  it('맵 id 뒤의 점까지 맞춘다(접두어가 같은 다른 id를 잘못 빼지 않는다)', () => {
    const entry = (id: string) => ({ ...accepted[0]!, id });
    const list = [entry('map.river.tree.0'), entry('map.river_z.tree.0'), entry('map.gate')];
    expect(entriesForMap(list, 'river_z', ['river', 'river_z']).map(a => a.id)).toEqual(['map.river_z.tree.0', 'map.gate']);
    expect(entriesForMap(list, 'garden_u', ['river', 'river_z', 'garden_u']).map(a => a.id)).toEqual(['map.gate']);
  });

  it('각 맵의 배치표·지면 묶음이 쓰는 그림은 모두 그 맵 판에 남아 있다(받지 않아 빠지는 그림 없음)', () => {
    for (const map of MAPS) {
      const layout = layoutFor(map.id);
      const kit = GROUND_KITS[map.id];
      const needed = new Set<string>();
      if (layout) for (const p of resolvePlacements(layout, map)) needed.add(p.asset);
      if (kit) for (const id of [kit.base, kit.light, kit.shade, ...kit.meadows, kit.dirt, ...kit.pads, kit.fallbackPad, kit.entry]) needed.add(id);
      const manifestIds = new Set(accepted.map(a => a.id));
      const missing = [...needed].filter(id => manifestIds.has(id) && !ids(map.id).has(id));
      expect(missing, `${map.id}: 맵에 필요한데 싣지 않는 그림`).toEqual([]);
      expect(needed.size, `${map.id}: 배치표·묶음이 비어 있지 않다`).toBeGreaterThan(0);
    }
  });
});
