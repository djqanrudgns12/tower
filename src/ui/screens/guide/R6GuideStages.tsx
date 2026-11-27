import { useState, type CSSProperties } from 'react';
import { getR6Battle } from '../../../application/balanceSession';
import { FAMILIES, R6_TOWERS, SPECIES, type R6TowerId, type Species } from '../../../contracts/balanceV2';
import type { Balance } from '../../../contracts/balance';
import type { R6Runtime } from '../../../domain/r6Balance';
import { battleTheme, battleTowerRole, WEAPON_RANKS } from '../../game/r6Display';
import { LineIcon, type LineIconName } from '../../icons/LineIcon';
import { Segmented } from '../../kit';
import { R6_PORTRAIT_ACCENTS, type PortraitRace } from '../home/portraitDeck';
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
              <span>{rules.levels.weaponAt[index]}단계 · 무기 {index + 1}</span>
              <strong>{weapon.name}</strong>
              <span>{weapon.summary}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const SPECIES_PORTRAIT_RACE: Record<Species, PortraitRace> = {
  elf: 'elf',
  human: 'human',
  machine: 'mech',
  insect: 'insect',
  stone: 'golem',
};

const SPECIES_GUIDE = {
  elf: {
    icon: 'traits/flying',
    detail: '빠르게 다가오고 마법 공격에 강해요. 숲 정령은 날아서 성문으로 와요.',
    counters: ['rail', 'hangar'] as const,
  },
  human: {
    icon: 'traits/siege',
    detail: '갑옷과 방패로 물리 공격을 버텨요. 공성 수레가 성문에 더 큰 피해를 줘요.',
    counters: ['prism', 'mortar'] as const,
  },
  machine: {
    icon: 'traits/armor',
    detail: '장갑을 두른 보행기가 와요. 드론 모함을 쓰러뜨리면 작은 적이 나와요.',
    counters: ['mortar', 'rail'] as const,
  },
  insect: {
    icon: 'traits/split',
    detail: '빠르게 몰려와요. 유충을 쓰러뜨리면 더 작은 적으로 나뉘어요.',
    counters: ['cryo', 'prism'] as const,
  },
  stone: {
    icon: 'traits/regen',
    detail: '느리지만 단단해요. 재생 수정은 싸우는 동안 체력을 회복해요.',
    counters: ['prism', 'bastion'] as const,
  },
} satisfies Record<Species, { icon: LineIconName; detail: string; counters: readonly R6TowerId[] }>;

export function R6SpeciesStage({ runtime }: { runtime: R6Runtime }) {
  const [id, setId] = useState<Species>('elf');
  const theme = battleTheme(runtime.rules);
  const species = SPECIES_GUIDE[id];
  const race = SPECIES_PORTRAIT_RACE[id];
  const count = Object.values(runtime.entities).filter(entity => entity.species === id).length;
  const accentStyle = { '--species-accent': R6_PORTRAIT_ACCENTS[race] } as CSSProperties;

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
      <div className={css.speciesReadout} aria-live="polite" style={accentStyle}>
        <div className={css.speciesHead}>
          <img
            src={`assets/ui/study/r6.portrait.${race}.01.webp`}
            width={56}
            height={56}
            alt={`${theme.species[id].name} 대표 초상`}
            className={css.speciesPortrait}
          />
          <div className={css.speciesMeta}>
            <strong><LineIcon name={species.icon} />{theme.species[id].name} · {count}개체</strong>
            <p>{species.detail}</p>
          </div>
        </div>
        <div className={css.speciesChips}>
          <span className={css.chipLabel}>추천 대응 타워</span>
          {species.counters.map(tid => (
            <span key={tid} className={css.counterChip}>
              <LineIcon name={TOWER_ICONS[tid]} size={14} />
              {theme.towers[tid].name}
            </span>
          ))}
        </div>
        <p>{FAMILIES.map(family => theme.lineages[family].name).join(' · ')}가 각각 4단계로 강해지고, 보스는 4종이에요.</p>
      </div>
      <div className={css.fieldTraitsBox} aria-label="전장 환경 안내">
        <strong>특수 받침 · 5웨이브 환경 변화</strong>
        <p>언덕 받침은 사거리 +15%, 빛 받침은 공격력 +10%를 줘요. 5웨이브마다 전장 분위기가 바뀌고 보스가 나타나요.</p>
      </div>
    </div>
  );
}
