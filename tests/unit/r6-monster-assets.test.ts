import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
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
  const legacy = enemy({ faction: 'elf', entityId: 'elf-runner-t3' });
  expect(assets.enemyArt(legacy)).toMatchObject({ atlas: 'r6.atlas.g2-walker', skin: 'T3' });
});
