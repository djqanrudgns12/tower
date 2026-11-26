import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AtlasAttachmentLoader, MixFrom, Physics, Skeleton, SkeletonJson, TextureAtlas } from '@esotericsoftware/spine-core';
import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import batch from '../../docs/renewal/r6/tech/monsters/batch.json';
import { ENTITY_IDS, SPECIES } from '../../src/contracts/balanceV2';
import manifest from '../../public/assets/r6/manifest-v2.json';
import { R6BattleAssets } from '../../src/game/r6/BattleAssets';
import { r6EnemyScale } from '../../src/game/r6/enemyDisplay';
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

it.each(SPECIES)('%s 아틀라스가 예산 안에서 20개체 전용 스킨을 제공한다', faction => {
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
  const ids = ENTITY_IDS.filter(id => id.startsWith(faction + '-'));
  expect(ids).toHaveLength(20);
  for (const id of ids) {
    const rig = id.includes('-boss-') ? id : id.slice(0, -3);
    const skin = 'T' + id.at(-1);
    const file = `monsters/${faction}/${rig}.json`;
    const art = assets.enemyArt(enemy({ faction, entityId: id }));
    expect(art, id).toMatchObject({
      atlas: 'r6.atlas.' + faction, data: 'r6.rig.' + rig, skin, rig: { file },
    });
    const skeleton = JSON.parse(readFileSync('public/assets/r6/' + file, 'utf8')) as { skins: { name: string }[] };
    expect(skeleton.skins, id).toContainEqual(expect.objectContaining({ name: skin }));
  }
  expect(batch.actors.filter(row => row.species === faction && row.accepted)).toHaveLength(ids.length);
});

it.each(SPECIES)('%s 보스와 같은 종족 일반 개체는 걷기 중 높이가 1.4배 이상 차이 난다', faction => {
  const base = `public/assets/r6/monsters/${faction}/`;
  const atlas = new TextureAtlas(readFileSync(base + faction + '.atlas', 'utf8'));
  const loader = new SkeletonJson(new AtlasAttachmentLoader(atlas));
  const data = new Map<string, ReturnType<SkeletonJson['readSkeletonData']>>();
  const scene = {
    load: { on: vi.fn(), isLoading: () => false },
    cache: { json: { exists: () => true }, text: { exists: () => true } },
    textures: { exists: () => true },
  } as unknown as Phaser.Scene;
  const assets = new R6BattleAssets(scene, () => false);
  assets.manifest = r6ManifestSchema.parse(manifest);
  let shortestBoss = Infinity, tallestRegular = 0;
  for (const id of ENTITY_IDS.filter(id => id.startsWith(faction + '-'))) {
    const art = assets.enemyArt(enemy({ faction, entityId: id }))!;
    let definition = data.get(art.rig.file);
    if (!definition) {
      definition = loader.readSkeletonData(JSON.parse(readFileSync('public/assets/r6/' + art.rig.file, 'utf8')));
      data.set(art.rig.file, definition);
    }
    const skeleton = new Skeleton(definition);
    skeleton.setSkin(art.skin);
    skeleton.setupPose();
    skeleton.updateWorldTransform(Physics.none);
    const boss = id.includes('-boss-');
    const scale = r6EnemyScale(art.scale, skeleton.getBoundsRect().height, boss);
    const walk = definition.findAnimation(art.rig.walk)!;
    for (let sample = 0; sample < 16; sample++) {
      skeleton.setupPose();
      walk.apply(skeleton, -1, walk.duration * sample / 16, false, null, 1, MixFrom.setup, false, false, false);
      skeleton.updateWorldTransform(Physics.none);
      const height = skeleton.getBoundsRect().height * scale;
      if (boss) shortestBoss = Math.min(shortestBoss, height);
      else tallestRegular = Math.max(tallestRegular, height);
    }
  }
  expect(shortestBoss).toBeGreaterThanOrEqual(tallestRegular * 1.4);
});
