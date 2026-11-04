import type { Balance } from '../../contracts/balance';
import type { TowerView } from '../../application/view';
import { fmtNumber } from '../copy';
import { useLobbySprites } from '../screens/home/canvasAssets';
import { BranchMarkIcon, TowerShieldPortrait } from '../icons/GameIcons';
import { ArtIcon, Modal } from '../kit';
import { ChoiceCard } from './ChoiceCard';
import css from './ChoiceCard.module.css';
import { evolutionChoices, formBodyUrl, formInfo, towerForm, upgradeCost, type FormId } from './evolution';
import { statBars } from './statBars';

interface Props {
  balance: Balance;
  tower: TowerView;
  gold: number;
  icons: Record<string, string>;
  /** 진화를 받을 수 없는 이유(단계 잠금). 없으면 null. */
  lock: string | null;
  /** 휴대폰: 카드를 가로 한 줄 짜임으로 세로로 쌓는다. */
  compact?: boolean;
  onPreview(form: FormId | null): void;
  onChoose(form: FormId): void;
  onClose(): void;
}

/**
 * 진화 A/B 창(progression.md §5, R4 PRD §9.2): 막 위 창에 두 형태 카드를 나란히. 카드마다 ‘고르기 · 값’ 한 번으로 바로 진화한다.
 * 능력치는 지금 칸 + 늘어날 칸(호박색)으로 보인다. 닫으면(×·Esc·막) 연 단추로 포커스가 돌아간다(kit Modal).
 */
export function EvolveCard({ balance, tower, gold, icons, lock, compact = false, onPreview, onChoose, onClose }: Props) {
  // 인수된 원화(manifest의 integrated_pass): 각 카드에 그 형태의 본체 그림을 보인다. 없으면 기본형 초상화.
  const sprites = useLobbySprites();
  const choices = evolutionChoices(balance, tower) ?? [];
  const cost = upgradeCost(balance, tower.type, tower.level);
  const from = towerForm(tower);
  const short = cost !== null && gold < cost;
  const blocked = short || lock !== null;
  const label = balance.towers[tower.type].label;

  return (
    <Modal
      titleId="evolve-title"
      title={`${label} 진화`}
      size={compact ? 'sm' : 'md'}
      onClose={onClose}
      footer={blocked ? <p className={css.reason} role="status">{lock ?? `골드 ${cost! - gold} 부족`}</p> : undefined}
    >
      <div className={compact ? css.listRow : css.list2}>
        {choices.map(form => {
          const info = formInfo(balance, tower.type, form);
          const src = formBodyUrl(tower.type, form, id => sprites.get(id)?.url);
          return (
            <ChoiceCard
              key={form}
              row={compact}
              art={
                <>
                  {src ? <img src={src} alt="" draggable={false} /> : <TowerShieldPortrait type={tower.type} icons={icons} size="fill" bare />}
                  {(form === 'A' || form === 'B') && <span className={css.mark}><BranchMarkIcon id={form} size={24} /></span>}
                </>
              }
              name={info.label}
              desc={info.summary}
              bars={statBars(balance, tower.type, tower.level, from, { level: tower.level + 1, form })}
              action={<span className={css.price}>고르기<ArtIcon name="coin" size={18} />{cost !== null ? fmtNumber(cost) : '-'}</span>}
              actionLabel={`${info.label} 고르기 ${cost ?? 0} 골드`}
              variant="accent"
              blocked={blocked}
              onPick={() => onChoose(form)}
              onPreview={on => onPreview(on ? form : null)}
            />
          );
        })}
      </div>
    </Modal>
  );
}
