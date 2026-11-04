import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { ART_ROLES, balanceSchema, BOSS_RANKS, type BossTier, type EnemyKind } from '../../src/contracts/balance';
import { BALANCE, MAPS } from '../../src/content';
import { enemyArtId, enemyName, waveFactions, waveRoleWeights } from '../../src/domain/factions';
import type { SpawnEntry } from '../../src/domain/types';
import { composeWave } from '../../src/domain/waves';
import { applyManifest, enemyArt } from '../../src/game/assets';
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
    // 침입 첫 묶음(W16~20)의 종족이 된다. 그 묶음의 대장(W20)은 주력 총대장이라 침입 대장은 다음 순환(W51~55 연합 뒤 첫 단독 묶음)에 나온다.
    const w17 = composeWave(b, 'garden_u', 17, { s: 5 });
    const crabs = w17.filter(e => e.faction === 'tide_crab');
    expect(crabs.length).toBeGreaterThan(0);
    for (const e of crabs) expect(enemyArtId(b, { kind: e.kind, faction: e.faction!, bossTier: null })).toMatch(/^crab\./);
    expect(waveFactions(b, 'garden_u', 20).boss).toEqual({ faction: 'acorn_goblin', tier: 4 });
    expect(enemyArtId(b, { kind: 'boss', faction: 'tide_crab', bossTier: 2 })).toBe('crab.boss10');
  });
  it('없는 종족을 가리키는 편성은 스키마가 거절한다', () => {
    const draft = structuredClone(BALANCE);
    draft.campaigns.garden_u!.primary = 'nobody';
    expect(() => balanceSchema.parse(draft)).toThrow(/없는 주력 종족/);
  });
});

describe('1~20웨이브 편성(monsters.md §3.1)', () => {
  it('맵마다 3웨이브 안 간격으로 주력 종족의 새 얼굴이 나오고, W8에 비행·W12에 분열이 처음 나온다(prd-r4 §7.2 C)', () => {
    for (const m of MAPS) {
      const primary = PRIMARY[m.id as keyof typeof PRIMARY];
      const seen = new Set<string>(), own = new Set<string>();
      const fresh: number[] = [];
      const first: Record<string, number> = {};
      for (let w = 1; w <= 20; w++) {
        const list = composeWave(BALANCE, m.id, w, { s: 100 + w });
        let isNew = false;
        for (const e of list) {
          // 15웨이브까지는 주력 종족만, 16웨이브부터 침입 종족이 섞인다(대장은 20웨이브까지 주력).
          if (w < BALANCE.waves.invasion.fromWave && e.faction !== primary) throw new Error(`${m.id} W${w}: 주력이 아닌 종족 ${e.faction}`);
          if (!seen.has(art(e))) { seen.add(art(e)); isNew = true; }
          if (e.faction !== primary) continue;
          own.add(art(e));
          first[e.kind] ??= w;
        }
        if (isNew) fresh.push(w);
      }
      // 새 얼굴(주력의 역할·대장, 16웨이브에 침입 종족 전부)이 16웨이브까지 3웨이브 안 간격으로 나오고, 마지막은 20웨이브 총대장이다.
      // 침입 종족은 16웨이브에 역할 얼굴이 한꺼번에 나오므로 16→20만 4웨이브 간격이다(B3 종족 특성이 이 구간의 변화를 맡는다).
      expect(fresh[0]).toBe(1);
      expect(fresh.slice(-2)).toEqual([BALANCE.waves.invasion.fromWave, 20]);
      for (let i = 1; i < fresh.length - 1; i++) expect(fresh[i]! - fresh[i - 1]!, `${m.id} ${fresh.join(',')}`).toBeLessThanOrEqual(3);
      expect(first.flyer).toBe(8);
      expect(first.splitter).toBe(12);
      // 주력 종족: 일반 8종 + 대장 4종 = 12 얼굴.
      expect(own.size).toBe(12);
    }
  });
  it('정원 역할 첫 등장: 질주 W3·거구 W4·껍질 W6·떼 W7·비행 W8·정령 W10·분열 W12(prd-r4 §7.2 C 표)', () => {
    const first: Record<string, number> = {};
    for (let w = 1; w <= 15; w++) for (const r of waveRoleWeights(BALANCE, 'garden_u', w)) first[r.kind] ??= w;
    expect(first).toEqual({ walker: 1, runner: 3, brute: 4, shell: 6, swarm: 7, flyer: 8, wisp: 10, splitter: 12 });
    // 다른 맵은 같은 웨이브에 자기 roleOrder의 다음 역할이 나온다(궁궐 뜰: 거구 W3·껍질 W4·질주 W6·정령 W7·떼 W10).
    const court: Record<string, number> = {};
    for (let w = 1; w <= 15; w++) for (const r of waveRoleWeights(BALANCE, 'courtyard', w)) court[r.kind] ??= w;
    expect(court).toEqual({ walker: 1, brute: 3, shell: 4, runner: 6, wisp: 7, flyer: 8, swarm: 10, splitter: 12 });
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
  it('비행은 W8~9 10%, W10부터 15%, 분열은 W12부터 15%', () => {
    const share = (w: number, kind: string) => {
      const r = waveRoleWeights(BALANCE, 'garden_u', w);
      return (r.find(x => x.kind === kind)?.weight ?? 0) / r.reduce((a, x) => a + x.weight, 0);
    };
    expect(share(7, 'flyer')).toBe(0);
    expect(share(8, 'flyer')).toBeCloseTo(0.1);
    expect(share(9, 'flyer')).toBeCloseTo(0.1);
    expect(share(10, 'flyer')).toBeCloseTo(0.15);
    expect(share(12, 'flyer')).toBeCloseTo(0.15);
    expect(share(12, 'splitter')).toBeCloseTo(0.15);
    expect(share(11, 'splitter')).toBe(0);
  });
});

describe('16웨이브부터 침입 순환(monsters.md §3.2, prd-r4 §7.2 C)', () => {
  const factionShare = (list: SpawnEntry[], f: string) => list.filter(e => e.kind !== 'boss' && e.faction === f).length / list.filter(e => e.kind !== 'boss').length;
  it('정원: W15까지 주력만, W16~17 꿀벌레 50%, W18~20 70%, W20 대장은 주력 총대장(4단)', () => {
    expect(factionShare(composeWave(BALANCE, 'garden_u', 15, { s: 1 }), 'acorn_goblin')).toBe(1);
    expect(factionShare(composeWave(BALANCE, 'garden_u', 16, { s: 1 }), 'honey_beetle')).toBeCloseTo(0.5, 1);
    expect(factionShare(composeWave(BALANCE, 'garden_u', 18, { s: 1 }), 'honey_beetle')).toBeCloseTo(0.7, 1);
    const w20 = composeWave(BALANCE, 'garden_u', 20, { s: 1 });
    const boss = w20.find(e => e.kind === 'boss')!;
    expect([boss.faction, boss.bossTier, art(boss)]).toEqual(['acorn_goblin', 4, 'acorn.boss20']);
    expect(factionShare(w20, 'honey_beetle')).toBeCloseTo(0.7, 1);
  });
  it('다음 블록은 순환의 다음 종족이고, W25부터 침입 대장 단계는 2→3→4→2단으로 돈다', () => {
    expect(waveFactions(BALANCE, 'garden_u', 21).shares.map(x => x.faction)).toEqual(['acorn_goblin', 'breeze_corsair']);
    expect(waveFactions(BALANCE, 'garden_u', 25).boss).toEqual({ faction: 'breeze_corsair', tier: 2 });
    expect(waveFactions(BALANCE, 'garden_u', 30).boss).toEqual({ faction: 'river_rafter', tier: 3 });
    expect(waveFactions(BALANCE, 'garden_u', 35).boss).toEqual({ faction: 'kiln_pottery', tier: 4 });
    expect(waveFactions(BALANCE, 'garden_u', 40).boss).toEqual({ faction: 'brass_mole', tier: 2 });
    expect(waveFactions(BALANCE, 'garden_u', 24).boss).toBeNull();
  });
  it('51웨이브(블록 7, 순환 한 바퀴 뒤)부터 주력 20% + 두 침입 종족 40%씩 연합', () => {
    expect(waveFactions(BALANCE, 'garden_u', 50).shares).toHaveLength(2);
    const f = waveFactions(BALANCE, 'garden_u', 51);
    expect(f.shares).toEqual([{ faction: 'acorn_goblin', shareBP: 2000 }, { faction: 'honey_beetle', shareBP: 4000 }, { faction: 'kiln_pottery', shareBP: 4000 }]);
    const list = composeWave(BALANCE, 'garden_u', 51, { s: 9 });
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

describe('종족 그림 연결(ART-M1~M4)', () => {
  it('주력 4종족의 모든 그림 id가 manifest에 있고, 렌더러는 대체 없이 그 그림을 manifest 기준점·크기로 고른다', () => {
    const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(new URL('../../public/assets/manifest.json', import.meta.url), 'utf8')));
    const byId = new Map(applyManifest(manifest).map(a => [a.id, a]));
    const primaries = [...new Set(Object.values(BALANCE.campaigns).map(c => c.primary))];
    expect(primaries).toHaveLength(4);
    const missing: string[] = [];
    for (const faction of primaries) for (const role of ART_ROLES) {
      const tier = (BOSS_RANKS as readonly string[]).indexOf(role) + 1;
      const kind = (tier > 0 ? 'boss' : role) as EnemyKind;
      const id = enemyArtId(BALANCE, { kind, faction, bossTier: tier > 0 ? (tier as BossTier) : null });
      const picked = enemyArt(id, kind, key => byId.has(key));
      if (picked.base !== id) { missing.push(id); continue; }
      const entry = byId.get(picked.framed ? `${id}.0` : id)!;
      expect([picked.originX, picked.originY, picked.displayCells], id).toEqual([entry.originX, entry.originY, entry.displayCells]);
    }
    expect(missing).toEqual([]);
  });
});
