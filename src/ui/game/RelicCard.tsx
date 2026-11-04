import { TOWER_IDS, type Balance, type TowerId } from '../../contracts/balance';
import { relicDef } from '../../domain/relics';
import { RELIC_TITLE } from '../copy';
import { TowerShieldPortrait } from '../icons/GameIcons';
import { ArtIcon, Modal, type ArtIconName } from '../kit';
import { ChoiceCard } from './ChoiceCard';
import css from './ChoiceCard.module.css';

interface Props {
  balance: Balance;
  /** 후보 보물 id 3개(balance relics.items 키). */
  choices: readonly string[];
  icons: Record<string, string>;
  /** 휴대폰: 카드를 가로 한 줄 짜임으로 세로로 쌓는다. */
  compact?: boolean;
  onPick(relic: string): void;
}

const ART_ICONS: readonly ArtIconName[] = [
  'coin', 'gate', 'wave', 'star', 'flame', 'note', 'lock', 'chest',
  'trait.armor', 'trait.ward', 'trait.flying', 'trait.swarm', 'trait.fast', 'trait.split', 'trait.clay', 'trait.burrow',
];

/** 보물 아이콘(계약 icon): `tower.<id>`는 타워 초상화, 원화 아이콘 이름은 그 아이콘, 모르는 이름은 보물 상자. */
export function RelicArt({ icon, icons, size }: { icon: string; icons: Record<string, string>; size: number | 'fill' }) {
  if (icon.startsWith('tower.')) {
    const type = icon.slice(6) as TowerId;
    if (TOWER_IDS.includes(type)) return <TowerShieldPortrait type={type} icons={icons} size={size} bare />;
  }
  const name = (ART_ICONS as readonly string[]).includes(icon) ? (icon as ArtIconName) : 'chest';
  return <ArtIcon name={name} size={size === 'fill' ? 96 : size} />;
}

/** 보물 이름·한 줄 규칙(화면 읽기·호버 안내). 모르는 id면 id 그대로. */
export function relicLine(b: Balance, id: string): string {
  const r = relicDef(b, id);
  return r ? `${r.label} · ${r.summary}` : id;
}

/**
 * 원정 보물 고르기 창(prd-r4 §7.2-F·§9.2): 대장 웨이브를 지키면 막이 전장과 문제 카드까지 덮고, 보물 카드 3장마다 ‘고르기’ 한 번으로 바로 고른다.
 * 새 타워·진화와 같은 카드 부품(ChoiceCard)이고 꼭 골라야 하는 창이라 닫기가 없다(kit Modal dismissable=false). 효과는 그 판에서만 있다.
 */
export function RelicCard({ balance, choices, icons, compact = false, onPick }: Props) {
  return (
    <Modal
      titleId="relic-title"
      title={<span className={css.titleRow}><ArtIcon name="chest" size={compact ? 28 : 32} />{RELIC_TITLE}</span>}
      size={compact ? 'sm' : 'lg'}
      dismissable={false}
      onClose={() => {}}
    >
      <div className={compact ? css.listRow : css.list3}>
        {choices.map(id => {
          const r = relicDef(balance, id);
          if (!r) return null;
          return (
            <ChoiceCard
              key={id}
              row={compact}
              art={<RelicArt icon={r.icon} icons={icons} size="fill" />}
              name={r.label}
              desc={r.summary}
              bars={[]}
              action="고르기"
              actionLabel={`${r.label} 고르기: ${r.summary}`}
              variant="primary"
              onPick={() => onPick(id)}
            />
          );
        })}
      </div>
    </Modal>
  );
}
