# 첫 밸런스 측정

보통에서 초보형 60%는 10웨이브로 목표 하한에 닿았다. 균형형 80%는 12웨이브로 목표 하한보다 2웨이브 일찍 끝났다. 읽기·정답·골드·이동은 기존 제품 엔진을, 편성은 R6의 [실행 예시](wave-mixer.mjs)를 사용했다. 학생 플레이와 정식 v2 관문은 아직 측정하지 않았다.

| 난이도·봇 | 시드 1~8의 완료 웨이브 | 중앙값 | 목표와 비교 | 한 판 중앙값 | 관측 최고 레벨 |
|---|---|---:|---|---:|---:|
| 보통 초보형 60% | 10, 10, 11, 9, 11, 9, 10, 10 | 10 | 목표 10~12 | 17.3분 | 10 |
| 쉬움 균형형 80% | 14, 14, 15, 14, 15, 14, 15, 15 | 14.5 | 보통 대비 +2.5, 목표 +4~6 | 21.2분 | 10 |
| 보통 균형형 80% | 13, 12, 13, 12, 12, 12, 12, 13 | 12 | 목표 14~17 | 18.8분 | 9 |
| 어려움 균형형 80% | 10, 9, 9, 9, 9, 9, 6, 9 | 9 | 보통 대비 −3, 목표 −3~−5 | 14.8분 | 7 |
| 아주 어려움 균형형 80% | 5, 5, 4, 5, 6, 5, 5, 4 | 5 | 보통 대비 −7, 목표 −6~−8 | 9.2분 | 6 |

**방법.** garden_u 한 맵, 시드 1~8, 읽기 12초·준비 8초, 상한 W40, 단일 프로세스 40판이다. `tools/balance-sim.mjs`의 `createPlayer/stepPlayer/finishPlayer` 경로를 재사용했다. 메모리 안에서 새 타워를 기존 봇이 알아보는 ID로 대응시키고 양쪽 진화 갈래에 같은 무기 II·III를 연결했다. 매 전투 첫 틱 전에 실제 v2 편성을 주입했다. 정답 보상·강화비, 해금 시점, 보스 기술과 정예·비행·분열은 이 경로로 계산했다. 표의 시간은 각 판의 활성 틱/30이다.

**해석 범위.** 보물과 바위 특수 재생은 제외했다. 드론의 분산 사격, 감속 대상의 남은 시간 우선, 곡사포의 후속 착탄·장판, 무기 IV, 일부 투사체 속도·즉발 시점은 기존 엔진의 근삿값을 썼다. 실측 최고 레벨은 10이어서 무기 III·IV 성능과 최적화형 95%의 22~26 목표, 초보↔최적 ≥12 차이는 이번 표로 판단할 수 없다. [R4 최종 관문](../../../balance/r4-final.md)의 16.5는 네 맵과 관문 봇으로 얻은 수치다. G3에서는 같은 seed로 보물 포함 전후, W6~13의 타워별 구매·누출을 기록해 원인을 가른 뒤 쉬움과 보통을 다시 조정한다. 이 결과만으로 학습 보상이나 공통 115% 체력 곡선을 바꾸지 않는다.

<details>
<summary>재현용 임시 드라이버</summary>

저장소 루트에서 아래 JavaScript 블록을 `node --input-type=module`의 표준 입력으로 실행한다. 자원 보호 명령은 `~/.local/bin/resource-guard run --profile test --wait-seconds 900 -- node --input-type=module`이다. 별도 제품 파일이나 데이터베이스 없이 실행할 수 있다.

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';
const load = async file => (await runnerImport(path.resolve(file), { configFile: false, logLevel: 'error' })).module;
const sim = await load('tools/sim/balanceSim.ts');
const rng = await load('src/domain/rng.ts');
const { apportion } = await load('src/domain/factions.ts');
const { createWaveSequence } = await import(path.resolve('docs/renewal/r6/spec/wave-mixer.mjs'));
const v = JSON.parse(fs.readFileSync('docs/renewal/r6/balance-v2-draft.json', 'utf8'));
const ids = { rail:'archer', mortar:'cannon', cryo:'frost', prism:'mage', hangar:'falcon', bastion:'banner' };
const bp = (a,b) => Math.floor(a * b / 10000);
function effect(key, w) {
  switch (key) {
    case 'rail': return { instant:true, ...(w.shots > 1 && { burst:{count:w.shots, gapTicks:w.gapTicks, followDamageBP:w.followDamageBP} }) };
    case 'mortar': return { splashRadiusMilli:w.radiusMilli, maxTargets:w.maxTargets, ...(w.aftershockBP > 0 && { delayedBlast:{delayMs:w.aftershockDelayMs, damageBP:w.aftershockBP, radiusMilli:w.radiusMilli, maxTargets:w.maxTargets} }) };
    case 'cryo': return { ring:true, maxTargets:w.pulseTargets, slowMs:w.slowMs, slowBP:w.slowBP };
    case 'prism': return { chainRadiusMilli:w.chainRadiusMilli, maxTargets:w.chainTargets, chainFalloffBP:w.chainFalloffBP };
    case 'hangar': return { preferFlyer:true, flyerDamageBP:w.flyerDamageBP, ...(w.drones > 1 && { burst:{count:w.drones,gapTicks:w.launchGapTicks,followDamageBP:w.followDamageBP} }) };
    case 'bastion': return { ring:true, maxTargets:w.pushTargets, knockbackMilli:w.pushMilli, auraRangeMilli:w.auraRadiusMilli, auraDamageBPByLevel:[w.auraDamageAddBP], auraSpeedBPByLevel:[w.auraSpeedAddBP] };
  }
}
function project() {
  const b = structuredClone(sim.BALANCE);
  Object.assign(b.levels, {max:20,evolveAt:[6,12],damageMultiplierBP:v.levels.damageMultiplierBP,upgradeCostOfBaseBP:v.levels.upgradeCostOfBaseBP});
  b.draft.startTowers = v.unlocks.initial.map(id => ids[id]);
  b.draft.afterWaves = [];
  delete b.relics;
  for (const [key,t] of Object.entries(v.towers)) {
    const id = ids[key];
    b.towers[id] = { ...t, label:id, strongVs:[], weakVs:[], projectileSpeedMilliPerSec:10000, ...effect(key,t.weapons[0]) };
    for (const form of ['A','B','A1','A2','B1','B2']) b.forms[id][form] = effect(key, t.weapons[form.length]);
  }
  const e = v.enemies;
  for (const species of e.factionOrder) {
    const faction = e.factions[species];
    const bosses = {};
    b.factions[species] = { artPrefix:species, bosses };
    for (let tier=1; tier<=4; tier++) {
      const stage = e.tier[tier-1];
      for (const family of e.familyOrder) {
        const base = e.families[family];
        const s = family === 'special' ? e.specialByFaction[species] : {};
        const kind = species+'-'+family+'-t'+tier;
        const enemy = b.enemies[kind] = {
          hpBP:bp(bp(bp(base.hpBP, stage.hpBP), faction.hpBP), s.hpBP ?? 10000),
          speedBP:bp(bp(bp(base.speedBP, stage.speedBP), faction.speedBP), s.speedBP ?? 10000),
          physicalResistBP:Math.min(e.resistCapBP,base.physicalResistBP+stage.resistAddBP+faction.physicalResistBP),
          magicResistBP:Math.min(e.resistCapBP,base.magicResistBP+stage.resistAddBP+faction.magicResistBP),
          artRole:'walker', flying:s.flying ?? false, leakDamage:s.leakDamage ?? 1,
        };
        if (s.splitCount) {
          const child = kind+'-child';
          b.enemies[child] = {...enemy,hpBP:bp(enemy.hpBP,s.childHpBP),artRole:'swarm',leakDamage:1};
          enemy.split = {kind:child,count:s.splitCount,spreadMilli:s.spreadMilli};
        }
      }
      const kind = e.bossByFaction[species][tier-1];
      const {hpScaleBP,...params} = e.bossSkills[kind];
      const skill = {kind,...params,...e.bossSkillOverrides[species+'-boss-t'+tier]};
      if (kind === 'call_escort') skill.escorts = Array(params.escortCount).fill(species+'-infantry-t1');
      bosses['boss'+tier*5] = {skill,hpScaleBP};
    }
  }
  return b;
}
function play(seed, difficulty, strategy, accuracy) {
  const balance = project();
  const p = sim.createPlayer({seed,difficulty,strategy,accuracy,readSec:12,maxWaves:40,mapId:'garden_u',balance,towers:Object.values(ids)});
  const next = createWaveSequence(v,'garden_u',seed,{...rng,apportion});
  while (!sim.playerDone(p)) {
    if (p.s.phase === 'BUILD' && p.startAt >= 0 && p.s.tick >= p.startAt) {
      sim.runCmd(p,{type:'startBattle'});
      p.startAt = -1;
      p.spendAt = p.s.tick + p.attention;
      p.s.battle.spawnList = next().map(x => {
        if (x.lineage !== 'boss') return {kind:x.id,faction:x.species,elite:x.elite,bossTier:null};
        const base = v.enemies.families.boss, f = v.enemies.factions[x.species];
        balance.enemies.boss = {hpBP:bp(bp(base.hpBP,v.enemies.bossTierHpBP[x.tier-1]),f.hpBP),
          speedBP:bp(base.speedBP,f.speedBP),physicalResistBP:f.physicalResistBP,magicResistBP:f.magicResistBP};
        return {kind:'boss',faction:x.species,elite:null,bossTier:x.tier};
      });
    }
    sim.stepPlayer(p);
    const unlock = v.unlocks.afterCompletedWave[p.s.completedWave];
    if (unlock && !p.s.owned.includes(ids[unlock])) p.s.owned.push(ids[unlock]);
  }
  return sim.finishPlayer(p);
}
for (const [difficulty,strategy,acc] of [['Normal','novice',0.6],...Object.keys(v.difficulties).map(d=>[d,'balanced',0.8])]) {
  const runs = Array.from({length:8},(_,i)=>play(i+1,difficulty,strategy,acc));
  const median = key => { const a=runs.map(r=>r[key]).sort((a,b)=>a-b); return (a[3]+a[4])/2; };
  console.log(difficulty,strategy,acc,runs.map(r=>r.completedWave).join(','),median('completedWave'),median('minutes').toFixed(1), Math.max(...runs.map(r=>r.maxLevel)));
}
```

</details>
