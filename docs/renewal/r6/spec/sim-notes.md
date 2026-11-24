# R6 밸런스 v2 측정

최종 계약으로 초원 고원에서 시드 1~8을 여섯 조건으로 실행했다. 48판 모두 성문 체력이 소진되어 끝났다. 보통의 초보·균형·최적화 도달 웨이브와 난이도 간격은 목표에 들었다. 보통 균형형의 웨이브당 평균 시간은 목표보다 1.41초 길었다.

| 난이도·전략·정답률 | 시드 1~8 완료 웨이브 | 중앙값 | 목표 | 한 판 중앙값 |
|---|---|---:|---|---:|
| 보통 초보 60% | 13, 9, 9, 9, 14, 10, 12, 13 | 11 | 10~12 | 19.5분 |
| 쉬움 균형 80% | 19, 20, 19, 21, 20, 20, 19, 20 | 20 | 보통보다 +4~6, 결과 +5 | 29.4분 |
| 보통 균형 80% | 17, 15, 16, 15, 15, 15, 15, 17 | 15 | 14~17 | 23.0분 |
| 어려움 균형 80% | 11, 12, 12, 12, 12, 11, 12, 13 | 12 | 보통보다 −3~5, 결과 −3 | 18.8분 |
| 아주 어려움 균형 80% | 9, 10, 9, 9, 10, 10, 6, 8 | 9 | 보통보다 −6~8, 결과 −6 | 14.7분 |
| 보통 최적화 95% | 19, 21, 23, 21, 24, 23, 23, 23 | 23 | 22~26 | 34.2분 |

초보↔최적화 간격은 12웨이브(목표 ≥12), 보통 균형형의 정답 골드 몫은 73.2%(목표 ≥55%)였다. 같은 조건의 완료 웨이브 한 개는 준비 문제를 포함해 평균 1.424분(목표 ≤1.4분)이다.

### 두 번의 조정

| 단계 | 보통 초보 / 균형 / 최적화 | 쉬움 / 어려움 / 아주 어려움 균형 | 보통 균형 W6~13 |
|---|---|---|---|
| G0 수치로 새 엔진 실측 | 10 / 12 / 미측정 | 15 / 9 / 5 | 거래 27.5회, 성문 피해 26 |
| 1회 | 11 / 15 / 23 | 24 / 12.5 / 10 | 거래 12회, 성문 피해 0.5 |
| 2회·최종 | 11 / 15 / 23 | 20 / 12 / 9 | 거래 12회, 성문 피해 0.5 |

1. W6~13에 강화를 사도 누출이 이어져 중간 강화 비용을 내리고 무기 II 이후 레벨의 피해 증가폭을 키웠다. 쉬움·아주 어려움 체력 배율도 낮춰 보았다. 보통 균형형은 W15까지 살아남았고 쉬움 간격은 +9까지 벌어졌다.
2. 보통 성장표를 유지하고 적 체력 배율을 쉬움 4250→6250BP, 어려움 19000→21900BP, 아주 어려움 30500→38000BP로 조정했다. 공통 115% 체력 성장과 문항 보상, 등장 간격은 G0 값이다. 마지막 측정은 레일 연사의 표적 유지 수정까지 포함한다.

### 재현 범위

`node tools/sim-gate.mjs --v2 --seeds 8`로 위 표를 재현한다. 읽기 기준 12초, 준비 8초, W40 상한, 보물 포함이다. `--out`은 시드별 거래·누출·설치·무기 도달을 JSON으로, `--report`는 측정표를 Markdown으로 쓴다. 추가 조합은 `node tools/balance-sim.mjs --v2 --diffs Normal --strats mono-rail,balanced --acc 0.8`로 비교한다. 단일 타워 실험에서는 지정 타워만 시작부터 설치할 수 있다.

초보·균형 봇은 기존 전략의 구매 순서를 R6 장착함에 맞췄다. 최적화형은 설치 단계마다 상위 거래 3개와 저축을 두 웨이브 앞까지 같은 엔진으로 비교한다. R4 네 지도와 다른 표본·구매 정책을 사용했다. 학생 플레이, 운영 랭킹, 기기 성능은 이 측정의 대상 밖이다.

## G0 초안 측정 기록

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

G0 커밋 `fe53199e`의 파일과 엔진을 기준으로, 저장소 루트에서 아래 JavaScript 블록을 `node --input-type=module`의 표준 입력으로 실행한다. 자원 보호 명령은 `~/.local/bin/resource-guard run --profile test --wait-seconds 900 -- node --input-type=module`이다. 별도 제품 파일이나 데이터베이스 없이 실행할 수 있다.

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
