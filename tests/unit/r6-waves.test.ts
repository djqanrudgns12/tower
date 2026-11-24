import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import raw from '../../docs/contracts/balance.v2.json';
import { balanceV2Schema } from '../../src/contracts/balanceV2';
import { createWaveSequence, previewR6Wave } from '../../src/domain/r6Mixer';
import { expandEntities } from '../../src/domain/r6Enemies';
import { localBalanceSession } from '../../src/application/balanceSession';
import { applyCommand, advanceTick } from '../../src/domain/run';
import { newRun } from './helpers';

const v = balanceV2Schema.parse(raw);
it('개체별 체력·속도·저항을 순서대로 계산하고 종족별 보스 기술을 고른다', () => {
  const e = expandEntities(v);
  expect(Object.keys(e)).toHaveLength(100);
  expect(e['machine-armored-t3']).toMatchObject({
    hpBP: 12810,
    speedBP: 8364,
    physicalResistBP: 3700,
    magicResistBP: 900,
  });
  expect(e['stone-boss-t3'].boss?.skill).toMatchObject({ kind: 'ward_layers', layers: 5 });
  expect(e['stone-boss-t4'].boss?.skill.kind).toBe('snack_mend');
});
it('시드별 단계 경계, 첫 등장, 정예와 20개 보스 순환이 일정하다', () => {
  for (const seed of [0, 1, 19, 0xffffffff]) {
    const next = createWaveSequence(v, 'garden_u', seed);
    const seen = new Set<string>(),
      bosses = new Set<string>();
    for (let wave = 1; wave <= 105; wave++) {
      const list = next(),
        band = v.mixer.bands.findLast((x) => x.fromWave <= wave)!;
      const n = Math.min(64, 24 + Math.floor((wave - 1) / 3));
      expect(list).toHaveLength(n);
      expect(new Set(list.map((e) => e.species)).size).toBe(band.factions);
      const regular = list.filter((e) => e.lineage !== 'boss');
      if (wave % 3 === 0 && wave <= 48) expect(regular.some((e) => !seen.has(e.id))).toBe(true);
      regular.forEach((e) => seen.add(e.id));
      const rate =
        wave < 6 ? 0 : wave < 21 ? Math.min(2500, 500 + (wave - 6) * 175) : Math.min(4000, 2600 + (wave - 21) * 100);
      expect(list.filter((e) => e.elite).length).toBe(Math.floor((regular.length * rate) / 10000));
      if (wave % 5 === 0) {
        const boss = list[Math.floor(0.7 * (n - 1))]!;
        expect(boss.lineage).toBe('boss');
        bosses.add(boss.id);
      }
      if ([3, 4, 7, 10, 11, 15, 16, 21, 51, 105].includes(wave))
        expect(previewR6Wave(v, 'garden_u', seed, wave)).toEqual(list);
    }
    expect(bosses.size).toBe(20);
  }
});
it('로컬 판 선택 뒤 예고와 실제 예약이 일치하고 첫 생성 틱에 발견한다', () => {
  const input = newRun().s.config;
  const run = localBalanceSession('2.0.0', 3, 'Normal', input);
  if (run.version !== '2.0.0') throw new Error('판 선택 실패');
  const { ctx, state: s } = run;
  const preview = previewR6Wave(v, 'garden_u', s.config.seed, 1);
  const battleRng = s.rng.battle;
  s.phase = 'BUILD';
  expect(applyCommand(ctx, s, { type: 'startBattle' }).ok).toBe(true);
  expect(s.battle!.spawnList.map((e) => e.entityId)).toEqual(preview.map((e) => e.id));
  expect(s.rng.battle).toBe(battleRng);
  expect(s.discovered).toBeUndefined();
  const spawn = advanceTick(ctx, s).find((e) => e.type === 'spawn');
  expect(spawn).toMatchObject({ entityId: preview[0]!.id, art: 'r6.enemy.' + preview[0]!.id });
  expect(s.discovered).toEqual([preview[0]!.id]);
  expect(localBalanceSession('1.0.0', 3, 'Normal', input).state.config.balanceVersion).toBe('1.0.0');
});
it('G0가 고정한 열 개의 경계 편성을 바이트 단위로 유지한다', () => {
  const hashes: Record<number, string> = {
    3: '8b620d61ed4895fa',
    4: 'f76075761cdc54e9',
    6: '81d05a961169fb1f',
    7: '9ab285bd1f21e01e',
    10: 'b06fb83f4d5dd459',
    11: '9e7910bed165a445',
    15: 'be573d1ee3b3e31e',
    16: '2ac39e3373b67b56',
    20: '8b48daa15fa90894',
    21: 'e22875f5095688fa',
  };
  for (const [wave, hash] of Object.entries(hashes)) {
    const list = previewR6Wave(v, 'garden_u', 1, Number(wave));
    expect(
      createHash('sha256')
        .update(JSON.stringify(list.map((e) => [e.id, e.elite])))
        .digest('hex')
        .slice(0, 16),
    ).toBe(hash);
  }
});
