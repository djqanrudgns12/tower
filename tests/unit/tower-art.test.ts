import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { FORM_IDS, TOWER_IDS } from '../../src/contracts/balance';
import { applyManifest, ASSETS, towerBodyArt } from '../../src/game/assets';

const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(new URL('../../public/assets/manifest.json', import.meta.url), 'utf8')));

describe('타워 그림(manifest·형태별 본체)', () => {
  it('기존 10종 기본형(본체·무기)은 integrated_pass이고, tower.<타워>.<형태>는 TOWER_IDS×FormId 조합에 기본형과 같은 규격이다', () => {
    const byId = new Map(manifest.assets.map(a => [a.id, a]));
    const baseIds = TOWER_IDS.flatMap(t => (t === 'banner' ? [`tower.${t}`] : [`tower.${t}`, `tower.${t}.weapon`]));
    expect(baseIds.filter(id => byId.get(id)?.status !== 'integrated_pass')).toEqual([]);

    const forms = manifest.assets.filter(a => /^tower\.[^.]+\.[^.]+$/.test(a.id) && !a.id.endsWith('.weapon'));
    const invalid = forms.filter(a => {
      const [, tower, form] = a.id.split('.');
      return !(TOWER_IDS as readonly string[]).includes(tower!) || !(FORM_IDS as readonly string[]).includes(form!) || form === 'base';
    });
    expect(invalid.map(a => a.id)).toEqual([]);
    // 1차형(A·B)은 10종 모두 있다. 2차형은 창병·수호기사·깃발이 아직 없다.
    expect(TOWER_IDS.flatMap(t => ['A', 'B'].map(f => `tower.${t}.${f}`)).filter(id => !byId.has(id))).toEqual([]);
    for (const a of forms) {
      const base = byId.get(a.id.split('.').slice(0, 2).join('.'))!;
      expect([a.status, a.layer, a.width, a.height, a.originX, a.originY, a.displayCells], a.id)
        .toEqual(['integrated_pass', 'body', base.width, base.height, base.originX, base.originY, base.displayCells]);
    }
  });

  it('본체 그림은 형태 → 부모 형태 → 기본형 순으로 고르고, 실리지 않은 텍스처는 건너뛴다', () => {
    applyManifest(manifest);
    const loaded = new Set(['tower.spear', 'tower.spear.A', 'tower.archer', 'tower.archer.A1']);
    const has = (key: string) => loaded.has(key);
    expect(towerBodyArt('spear', 'A1', has).key).toBe('tower.spear.A');
    expect(towerBodyArt('spear', 'B2', has).key).toBe('tower.spear');
    expect(towerBodyArt('archer', 'A1', has).key).toBe('tower.archer.A1');
    expect(towerBodyArt('archer', 'A2', has).key).toBe('tower.archer');
    expect(towerBodyArt('archer', 'base', has)).toBe(ASSETS.towers.archer);
  });
});
