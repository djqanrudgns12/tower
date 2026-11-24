import { expandEntities } from './r6Enemies';
import type { Balance, TowerConfig } from '../contracts/balance';
import { DIFFICULTY_IDS } from '../contracts/balance';
import type { BalanceV2, R6TowerId } from '../contracts/balanceV2';
import { r6Tables, type WeaponProfile } from './r6Towers';

export interface R6Runtime {
  entities: ReturnType<typeof expandEntities>;
  rules: BalanceV2;
  base: Record<R6TowerId,TowerConfig>;
  profiles: Record<R6TowerId,WeaponProfile[]>;
}

/** 공통 문제·경제·틱 엔진의 입력. 새 판이 쓰는 값은 모두 v2에서 가져온다. */
export function compileR6Balance(legacy: Balance, rules: BalanceV2): Balance {
  const b = structuredClone(legacy);
  b.r6 = { rules,entities:expandEntities(rules),...r6Tables(rules) };
  Object.assign(b,{balanceVersion:rules.balanceVersion,run:rules.run,burning:rules.burning,externalCaps:rules.externalCaps,statusCaps:rules.statusCaps,
    leakDamage:rules.leakDamage,elites:rules.elites});
  Object.assign(b.waves,rules.waves);
  Object.assign(b.levels,rules.levels,{evolveAt:[6,12]});
  Object.assign(b.towers,b.r6.base);
  for (const id of DIFFICULTY_IDS) b.difficulties[id] = {...rules.difficulties[id],label:id};
  b.draft = {startTowers:[],afterWaves:[],offerCount:1,maxOwned:6};
  delete b.matchup;
  b.relics = {fromWave:rules.relics.fromWave,offerCount:rules.relics.offerCount,items:{}};
  for (const [id,rule] of Object.entries(rules.relics.effects)) {
    const {towers: _targets,...effect} = rule;
    b.relics.items[id] = {label:id,summary:id,icon:'relic.'+id,effect};
  }
  return b;
}
