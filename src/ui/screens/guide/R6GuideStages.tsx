import { useState, type CSSProperties } from 'react';
import { getR6Battle } from '../../../application/balanceSession';
import { FAMILIES, R6_TOWERS, SPECIES, type R6TowerId, type Species } from '../../../contracts/balanceV2';
import type { Balance } from '../../../contracts/balance';
import type { R6Runtime } from '../../../domain/r6Balance';
import { battleTheme, battleTowerRole, WEAPON_RANKS } from '../../game/r6Display';
import { LineIcon, type LineIconName } from '../../icons/LineIcon';
import { Segmented } from '../../kit';
import css from '../GuideScreen.module.css';
import { R6_MAP_DIAGRAM } from '../r6Map';

const TOWER_ICONS: Record<R6TowerId, LineIconName> = {
  rail: 'hud/stat-power', mortar: 'relics/big_blast', cryo: 'status/slow',
  prism: 'relics/evolve_stone', hangar: 'traits/flying', bastion: 'status/ward',
};

export function R6TowerStage({ runtime, balance, highContrastMap }: { runtime: R6Runtime; balance: Balance; highContrastMap: boolean }) {
  const [id, setId] = useState<R6TowerId>('rail');
  const { rules } = runtime;
  const theme = battleTheme(rules);
  const tower = rules.towers[id];
  const range = tower.rangeMilli / 1000;
  const radiusOnMap = range / getR6Battle().map.gridWidth * 100;
  const unlock = Object.entries(rules.unlocks.afterCompletedWave).find(([, towerId]) => towerId === id)?.[0];
  const stage = { '--range-radius': `${radiusOnMap}%` } as CSSProperties;

  return (
    <div className={css.pane}>
      <Segmented<R6TowerId>
        label="타워 종류"
        className={css.towerOptions}
        options={R6_TOWERS.map(value => ({
          value,
          label: <><LineIcon name={TOWER_ICONS[value]} size={16} />{theme.towers[value].name}</>,
        }))}
        value={id}
        onChange={setId}
      />
      <div className={css.tacticalMap} data-contrast={highContrastMap || undefined} style={stage}>
        <img src={R6_MAP_DIAGRAM} width={960} height={576} alt="" />
        <span className={css.rangeMarker} aria-hidden="true">
          <LineIcon name={TOWER_ICONS[id]} />
        </span>
      </div>
      <p className={css.stageReadout} aria-live="polite">
        <strong>{theme.towers[id].name} · {tower.cost}골드 · 사거리 {range}칸</strong>
        <span>{battleTowerRole(balance, id)} · {unlock ? `${unlock}웨이브를 막으면 열림` : '처음부터 사용'}</span>
      </p>
      <ol className={css.weaponStages} aria-label="무기 단계">
        {WEAPON_RANKS.map((rank, index) => {
          const weapon = theme.weapon(id, rank);
          return (
            <li key={rank}>
              <span>Lv{rules.levels.weaponAt[index]} · {rank}</span>
              <strong>{weapon.name}</strong>
              <span>{weapon.summary}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const SPECIES_GUIDE = {
  elf: { icon: 'traits/flying', detail: '빠르게 다가오고 마법 공격에 강해요. 숲 정령은 날아서 성문으로 와요.' },
  human: { icon: 'traits/siege', detail: '갑옷과 방패로 물리 공격을 버텨요. 공성 수레가 성문에 더 큰 피해를 줘요.' },
  machine: { icon: 'traits/armor', detail: '장갑을 두른 보행기가 와요. 드론 모함을 쓰러뜨리면 작은 적이 나와요.' },
  insect: { icon: 'traits/split', detail: '빠르게 몰려와요. 유충을 쓰러뜨리면 더 작은 적으로 나뉘어요.' },
  stone: { icon: 'traits/regen', detail: '느리지만 단단해요. 재생 수정은 싸우는 동안 체력을 회복해요.' },
} satisfies Record<Species, { icon: LineIconName; detail: string }>;

export function R6SpeciesStage({ runtime }: { runtime: R6Runtime }) {
  const [id, setId] = useState<Species>('elf');
  const theme = battleTheme(runtime.rules);
  const species = SPECIES_GUIDE[id];
  const count = Object.values(runtime.entities).filter(entity => entity.species === id).length;

  return (
    <div className={css.pane}>
      <Segmented<Species>
        label="적 종류"
        className={css.towerOptions}
        options={SPECIES.map(value => ({
          value,
          label: <><LineIcon name={SPECIES_GUIDE[value].icon} size={16} />{theme.species[value].name}</>,
        }))}
        value={id}
        onChange={setId}
      />
      <div className={css.speciesReadout} aria-live="polite">
        <strong><LineIcon name={species.icon} />{theme.species[id].name} · {count}개체</strong>
        <p>{species.detail}</p>
        <p>{FAMILIES.map(family => theme.lineages[family].name).join(' · ')}가 각각 4단계로 강해지고, 보스는 4종이에요.</p>
      </div>
    </div>
  );
}
