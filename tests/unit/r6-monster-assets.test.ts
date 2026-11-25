import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import batch from '../../docs/renewal/r6/tech/monsters/batch.json';
import { ENTITY_IDS, entityId, SPECIES, type Lineage, type Tier } from '../../src/contracts/balanceV2';
import manifest from '../../public/assets/r6/manifest-v2.json';
import { R6BattleAssets } from '../../src/game/r6/BattleAssets';
import { r6ManifestSchema } from '../../src/game/r6/manifest';
import { enemy } from './review-core/fixtures';

it('기계 스킨은 종족 텍스처까지 준비되면 사용하고, 전송이 실패하면 같은 단계의 기본 표시를 쓴다', () => {
  let loading = true;
  const textures = new Set<string>();
  const scene = {
    load: { on: vi.fn(), isLoading: () => loading },
    cache: { json: { exists: () => true }, text: { exists: () => true } },
    textures: { exists: (key: string) => textures.has(key) },
  } as unknown as Phaser.Scene;
  const assets = new R6BattleAssets(scene, () => false);
  assets.manifest = r6ManifestSchema.parse(manifest);
  const unit = enemy({ faction: 'machine', entityId: 'machine-infantry-t1' });
  expect(assets.enemyArt(unit)).toBeNull();
  loading = false;
  expect(assets.enemyArt(unit)).toMatchObject({ atlas: 'r6.atlas.g2-walker', skin: 'T1' });
  textures.add('r6.atlas.machine!machine.webp');
  expect(assets.enemyArt(unit)).toMatchObject({ data: 'r6.rig.machine-infantry', skin: 'T1', scale: .95 });
});

it.each(['elf', 'human', 'insect'] as const)('%s 특수 T1은 해당 종족의 아틀라스와 리그로 그린다', faction => {
  const atlas = 'r6.atlas.' + faction;
  const scene = {
    load: { on: vi.fn(), isLoading: () => false },
    cache: { json: { exists: () => true }, text: { exists: () => true } },
    textures: { exists: (key: string) => key === atlas + '!' + faction + '.webp' },
  } as unknown as Phaser.Scene;
  const assets = new R6BattleAssets(scene, () => false);
  assets.manifest = r6ManifestSchema.parse(manifest);
  const unit = enemy({ faction, entityId: `${faction}-special-t1` });
  expect(assets.enemyArt(unit)).toMatchObject({ data: 'r6.rig.' + faction + '-special', atlas, skin: 'T1' });
});

it.each(SPECIES)('%s 아틀라스와 전장 스킨이 검수 결과와 일치한다', faction => {
  const image = readFileSync(`public/assets/r6/monsters/${faction}/${faction}.webp`);
  expect(image.byteLength).toBeLessThanOrEqual(768 * 1024);
  expect(createHash('sha256').update(image).digest('hex')).toBe(batch.atlases[faction].sha256);
  const available = { exists: () => true };
  const scene = {
    load: { on: vi.fn(), isLoading: () => false },
    cache: { json: available, text: available }, textures: available,
  } as unknown as Phaser.Scene;
  const assets = new R6BattleAssets(scene, () => false);
  assets.manifest = r6ManifestSchema.parse(manifest);
  const published = new Map(batch.actors.filter(row => row.species === faction).map(row => {
    const family = row.entry.startsWith('boss-') ? 'boss' : row.entry as Lineage;
    const id = entityId(faction, family, Number(row.skin.slice(1)) as Tier);
    return [id, row.accepted] as const;
  }));
  for (const id of ENTITY_IDS.filter(id => id.startsWith(faction + '-'))) {
    const art = assets.enemyArt(enemy({ faction, entityId: id }));
    expect(art, id).toMatchObject({
      atlas: 'r6.atlas.' + (published.get(id) ? faction : 'g2-walker'), skin: 'T' + id.at(-1),
    });
  }
});
