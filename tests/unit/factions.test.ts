import { describe, expect, it } from 'vitest';
import { balanceSchema } from '../../src/contracts/balance';
import { BALANCE, MAPS } from '../../src/content';
import { enemyArtId, enemyName, waveFactions, waveRoleWeights } from '../../src/domain/factions';
import type { SpawnEntry } from '../../src/domain/types';
import { composeWave } from '../../src/domain/waves';
import { finishPrep, newRun, ok, ticks } from './helpers';

// 종족×역할 편성(docs/renewal/catalog/monsters.md §0·§2·§3). 규칙은 역할, 이름·그림은 종족.
const PRIMARY = { garden_u: 'acorn_goblin', river_z: 'river_rafter', courtyard: 'moon_dokkaebi', snow_step: 'hearth_yeti' } as const;
const art = (e: SpawnEntry) => enemyArtId(BALANCE, { kind: e.kind, faction: e.faction!, bossTier: e.bossTier ?? null });

describe('종족 팩과 그림 id', () => {
  it('모든 맵에 원정 편성이 있고, 주력 종족은 정원 도토리·강가 수달·궁궐 뜰 도깨비·설원 설인이다', () => {
    for (const m of MAPS) expect(BALANCE.campaigns[m.id]?.primary).toBe(PRIMARY[m.id as keyof typeof PRIMARY]);
  });
  it('그림 id는 <접두어>.<역할|boss5~20>이고, 정원 보병은 기존 enemy.walker 그림을 쓴다', () => {
    expect(enemyArtId(BALANCE, { kind: 'walker', faction: 'acorn_goblin', bossTier: null })).toBe('enemy.walker');
    expect(enemyArtId(BALANCE, { kind: 'runner', faction: 'acorn_goblin', bossTier: null })).toBe('acorn.runner');
    expect(enemyArtId(BALANCE, { kind: 'boss', faction: 'river_rafter', bossTier: 2 })).toBe('river.boss10');
    expect(enemyArtId(BALANCE, { kind: 'flyer', faction: 'moon_dokkaebi', bossTier: null })).toBe('dokkaebi.flyer');
    expect(enemyArtId(BALANCE, { kind: 'boss', faction: 'hearth_yeti', bossTier: 4 })).toBe('yeti.boss20');
    expect(enemyName(BALANCE, { kind: 'boss', faction: 'acorn_goblin', bossTier: 1 })).toBe('국자대장 달그락');
    expect(enemyName(BALANCE, { kind: 'flyer', faction: 'acorn_goblin', bossTier: null })).toBeNull();
  });
  it('종족 팩은 데이터 한 줄로 더한다: 새 종족을 침입 순환에 넣으면 그 접두어 그림으로 나온다', () => {
    const draft = structuredClone(BALANCE);
    draft.factions.tide_crab = { label: '시험 게 종족', artPrefix: 'crab' };
    draft.campaigns.garden_u!.invasionOrder = ['tide_crab', ...draft.campaigns.garden_u!.invasionOrder];
    const b = balanceSchema.parse(draft);
    const w25 = composeWave(b, 'garden_u', 25, { s: 5 });
    expect(w25.some(e => e.faction === 'tide_crab')).toBe(true);
    const boss = w25.find(e => e.kind === 'boss')!;
    expect(enemyArtId(b, { kind: boss.kind, faction: boss.faction!, bossTier: boss.bossTier ?? null })).toBe('crab.boss10');
  });
  it('없는 종족을 가리키는 편성은 스키마가 거절한다', () => {
    const draft = structuredClone(BALANCE);
    draft.campaigns.garden_u!.primary = 'nobody';
    expect(() => balanceSchema.parse(draft)).toThrow(/없는 주력 종족/);
  });
});

describe('1~20웨이브 편성(monsters.md §3.1)', () => {
  it('맵마다 2~3웨이브 간격으로 새 얼굴이 나오고, W14에 비행·W17에 분열이 처음 나온다', () => {
    for (const m of MAPS) {
      const seen = new Set<string>();
      const fresh: number[] = [];
      const first: Record<string, number> = {};
      for (let w = 1; w <= 20; w++) {
        const list = composeWave(BALANCE, m.id, w, { s: 100 + w });
        let isNew = false;
        for (const e of list) {
          if (e.faction !== PRIMARY[m.id as keyof typeof PRIMARY]) throw new Error(`${m.id} W${w}: 주력이 아닌 종족 ${e.faction}`);
          if (!seen.has(art(e))) { seen.add(art(e)); isNew = true; }
          first[e.kind] ??= w;
        }
        if (isNew) fresh.push(w);
      }
      expect(fresh[0]).toBe(1);
      for (let i = 1; i < fresh.length; i++) expect(fresh[i]! - fresh[i - 1]!, `${m.id} ${fresh.join(',')}`).toBeLessThanOrEqual(3);
      expect(fresh.at(-1)).toBe(20);
      expect(first.flyer).toBe(14);
      expect(first.splitter).toBe(17);
      // 일반 8종 + 대장 4종 = 12 얼굴.
      expect(seen.size).toBe(12);
    }
  });
  it('대장은 5·10·15·20웨이브마다 다른 단계다', () => {
    for (const m of MAPS) {
      const bosses = [5, 10, 15, 20].map(w => composeWave(BALANCE, m.id, w, { s: w }).filter(e => e.kind === 'boss'));
      expect(bosses.map(list => list.length)).toEqual([1, 1, 1, 1]);
      expect(bosses.map(list => list[0]!.bossTier)).toEqual([1, 2, 3, 4]);
    }
    expect(composeWave(BALANCE, 'garden_u', 4, { s: 4 }).some(e => e.kind === 'boss')).toBe(false);
  });
  it('역할 해금 순서는 맵마다 다르다: 궁궐 뜰·설원은 W3에 거구, 강가는 W5에 떼', () => {
    expect(waveRoleWeights(BALANCE, 'courtyard', 3).map(x => x.kind)).toEqual(['walker', 'brute']);
    expect(waveRoleWeights(BALANCE, 'snow_step', 5).map(x => x.kind).sort()).toEqual(['brute', 'runner', 'walker']);
    expect(waveRoleWeights(BALANCE, 'river_z', 5).map(x => x.kind).sort()).toEqual(['runner', 'swarm', 'walker']);
  });
  it('W14는 비행 20%, W17부터 비행 15%·분열 15%', () => {
    const share = (w: number, kind: string) => {
      const r = waveRoleWeights(BALANCE, 'garden_u', w);
      return (r.find(x => x.kind === kind)?.weight ?? 0) / r.reduce((a, x) => a + x.weight, 0);
    };
    expect(share(14, 'flyer')).toBeCloseTo(0.2);
    expect(share(17, 'flyer')).toBeCloseTo(0.15);
    expect(share(17, 'splitter')).toBeCloseTo(0.15);
    expect(share(16, 'splitter')).toBe(0);
  });
});

describe('21웨이브부터 침입 순환(monsters.md §3.2)', () => {
  const factionShare = (list: SpawnEntry[], f: string) => list.filter(e => e.kind !== 'boss' && e.faction === f).length / list.filter(e => e.kind !== 'boss').length;
  it('정원: W21~22 꿀벌레 50%, W23~25 70%, W25 대장은 꿀벌레 2단(W10급)', () => {
    expect(factionShare(composeWave(BALANCE, 'garden_u', 21, { s: 1 }), 'honey_beetle')).toBeCloseTo(0.5, 1);
    expect(factionShare(composeWave(BALANCE, 'garden_u', 23, { s: 1 }), 'honey_beetle')).toBeCloseTo(0.7, 1);
    const w25 = composeWave(BALANCE, 'garden_u', 25, { s: 1 });
    const boss = w25.find(e => e.kind === 'boss')!;
    expect([boss.faction, boss.bossTier, art(boss)]).toEqual(['honey_beetle', 2, 'beetle.boss10']);
  });
  it('다음 블록은 순환의 다음 종족이고 대장 단계는 2→3→4→2단으로 돈다', () => {
    expect(waveFactions(BALANCE, 'garden_u', 26).shares.map(x => x.faction)).toEqual(['acorn_goblin', 'breeze_corsair']);
    expect(waveFactions(BALANCE, 'garden_u', 30).boss).toEqual({ faction: 'breeze_corsair', tier: 3 });
    expect(waveFactions(BALANCE, 'garden_u', 35).boss).toEqual({ faction: 'river_rafter', tier: 4 });
    expect(waveFactions(BALANCE, 'garden_u', 40).boss).toEqual({ faction: 'kiln_pottery', tier: 2 });
    expect(waveFactions(BALANCE, 'garden_u', 24).boss).toBeNull();
  });
  it('56웨이브(블록 7)부터 주력 20% + 두 침입 종족 40%씩 연합', () => {
    const f = waveFactions(BALANCE, 'garden_u', 56);
    expect(f.shares).toEqual([{ faction: 'acorn_goblin', shareBP: 2000 }, { faction: 'honey_beetle', shareBP: 4000 }, { faction: 'kiln_pottery', shareBP: 4000 }]);
    const list = composeWave(BALANCE, 'garden_u', 56, { s: 9 });
    expect(factionShare(list, 'acorn_goblin')).toBeCloseTo(0.2, 1);
  });
  it('같은 seed면 같은 편성, 난수 호출 수는 맵·종족과 무관하다', () => {
    expect(composeWave(BALANCE, 'river_z', 27, { s: 77 })).toEqual(composeWave(BALANCE, 'river_z', 27, { s: 77 }));
    const states = MAPS.map(m => { const rng = { s: 77 }; composeWave(BALANCE, m.id, 27, rng); return rng.s; });
    expect(new Set(states).size).toBe(1);
  });
});

describe('생성 사건', () => {
  it('적은 종족·대장 단계를 지니고, 생성 사건이 그림 id를 싣는다', () => {
    const { ctx, s } = newRun('Normal', 3);
    finishPrep(ctx, s);
    ok(ctx, s, { type: 'startBattle' });
    s.battle!.spawnList = [{ kind: 'runner', elite: null }, { kind: 'boss', elite: null, faction: 'river_rafter', bossTier: 3 }];
    s.battle!.nextSpawnTick = s.tick + 1;
    s.battle!.intervalTicks = 1;
    const ev = ticks(ctx, s, 3).filter(e => e.type === 'spawn');
    expect(ev).toEqual([
      { type: 'spawn', enemyId: expect.any(Number), kind: 'runner', faction: 'acorn_goblin', art: 'acorn.runner' },
      { type: 'spawn', enemyId: expect.any(Number), kind: 'boss', faction: 'river_rafter', art: 'river.boss15' },
    ]);
    expect(s.enemies.map(e => [e.faction, e.bossTier])).toEqual([['acorn_goblin', null], ['river_rafter', 3]]);
  });
});
