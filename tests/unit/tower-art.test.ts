import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { FORM_IDS, TOWER_IDS } from '../../src/contracts/balance';
import { applyManifest, ASSETS, CELL_PX, towerBodyArt, WEAPONLESS_TOWERS, weaponMountOffset } from '../../src/game/assets';

const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(new URL('../../public/assets/manifest.json', import.meta.url), 'utf8')));

describe('타워 그림(manifest·형태별 본체)', () => {
  it('기존 10종 기본형(본체·무기)은 integrated_pass이고, tower.<타워>.<형태>는 TOWER_IDS×FormId 조합에 기본형과 같은 규격이다', () => {
    const byId = new Map(manifest.assets.map(a => [a.id, a]));
    // 이 시험은 기존 10종(TOWER_IDS 앞 10개)의 기본형을 본다. 신규 10종·2차형은 아래 시험이 본다.
    const legacy = TOWER_IDS.slice(0, 10);
    const baseIds = legacy.flatMap(t => (t === 'banner' ? [`tower.${t}`] : [`tower.${t}`, `tower.${t}.weapon`]));
    expect(baseIds.filter(id => byId.get(id)?.status !== 'integrated_pass')).toEqual([]);

    const forms = manifest.assets.filter(a => /^tower\.[^.]+\.[^.]+$/.test(a.id) && !a.id.endsWith('.weapon'));
    const invalid = forms.filter(a => {
      const [, tower, form] = a.id.split('.');
      return !(TOWER_IDS as readonly string[]).includes(tower!) || !(FORM_IDS as readonly string[]).includes(form!) || form === 'base';
    });
    expect(invalid.map(a => a.id)).toEqual([]);
    // 1차형(A·B)은 기존 10종 모두 있고, 2차형 12장(창병·수호기사·깃발)도 아래 시험이 본다. 형태 그림은 모두 기본형과 같은 규격이다.
    expect(legacy.flatMap(t => ['A', 'B'].map(f => `tower.${t}.${f}`)).filter(id => !byId.has(id))).toEqual([]);
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

  it('신규 10종 본체와 창병·수호기사·깃발 2차형 12장은 integrated_pass이고, 무기 없는 6종은 ASSETS.weapons에 없다', () => {
    applyManifest(manifest);
    const byId = new Map(manifest.assets.map(a => [a.id, a]));
    const added = TOWER_IDS.slice(10);
    expect(added.map(t => [t, byId.get(`tower.${t}`)?.status, byId.get(`tower.${t}`)?.layer])).toEqual(added.map(t => [t, 'integrated_pass', 'body']));
    const second = ['spear', 'guardian', 'banner'].flatMap(t => ['A1', 'A2', 'B1', 'B2'].map(f => `tower.${t}.${f}`));
    expect(second).toHaveLength(12);
    expect(second.filter(id => byId.get(id)?.status !== 'integrated_pass')).toEqual([]);

    // 무기 그림은 날아가는 무기가 있는 5종(조약돌 새총·쇠뇌포·박격 화포·신기전·바람개비)만 있다.
    const withWeapon = ['sling', 'ballista', 'mortar', 'hwacha', 'wind'] as const;
    expect(withWeapon.filter(t => byId.get(`tower.${t}.weapon`)?.status !== 'integrated_pass')).toEqual([]);
    expect([...WEAPONLESS_TOWERS].sort()).toEqual(['alchemist', 'banner', 'bell', 'falcon', 'roller', 'trap']);
    for (const t of WEAPONLESS_TOWERS) {
      expect(ASSETS.weapons[t], `${t} 임시 무기`).toBeUndefined();
      expect(byId.has(`tower.${t}.weapon`), `${t} 무기 manifest`).toBe(false);
    }
    for (const t of TOWER_IDS.filter(id => !WEAPONLESS_TOWERS.includes(id))) expect(ASSETS.weapons[t], `${t} 무기`).toBeDefined();
  });

  it('무기 장착점은 신규 5종 본체에만 있고, 있으면 무기 위치를 정하며 없으면 기본 높이 그대로다', () => {
    applyManifest(manifest);
    const mounted = TOWER_IDS.filter(t => ASSETS.towers[t].weaponMount);
    expect(mounted).toEqual(['sling', 'ballista', 'mortar', 'hwacha', 'wind']);
    for (const t of mounted) {
      const spec = ASSETS.towers[t], m = spec.weaponMount!;
      expect(m.x >= 0 && m.x <= spec.width && m.y >= 0 && m.y <= spec.height, `${t} 장착점이 그림 안`).toBe(true);
    }
    // 기존 타워는 장착점이 없어 TowerLayer의 기본 높이(돌리는 무기 0.64칸, 떠 있는 무기 0.70칸)를 그대로 쓴다.
    for (const t of TOWER_IDS.slice(0, 10)) expect(weaponMountOffset(ASSETS.towers[t], false)).toEqual({ lift: 0, dx: 0 });
    // 새총: 장착점(96,72)은 기준점 아래 선(170)보다 98px 위 → 그림 px당 CELL_PX*1.45/192 월드 px.
    const sling = ASSETS.towers.sling;
    const perPx = (CELL_PX * sling.displayCells) / sling.width;
    const off = weaponMountOffset(sling, false);
    expect(off.lift).toBeCloseTo((sling.originY * sling.height - 72) * perPx - CELL_PX * 0.64, 6);
    expect(off.dx).toBeCloseTo(0, 6);
    // 고정형(바람개비)은 기본 높이가 0.70칸이라 같은 장착점이라도 올림이 0.06칸 작다.
    const wind = ASSETS.towers.wind;
    expect(weaponMountOffset(wind, true).lift).toBeCloseTo(weaponMountOffset(wind, false).lift - CELL_PX * 0.06, 6);
  });
});
