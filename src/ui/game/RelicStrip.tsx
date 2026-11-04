import type { Balance } from '../../contracts/balance';
import { ArtIcon } from '../kit';
import { RelicArt, relicLine } from './RelicCard';
import css from './Hud.module.css';

interface Props {
  balance: Balance;
  /** 고른 보물 id(고른 순서). 비면 아무것도 그리지 않는다. */
  relics: readonly string[];
  icons: Record<string, string>;
  /** icons: 보물마다 아이콘 하나(넘치면 +n), count: 보물 상자 + 개수 하나. */
  variant: 'icons' | 'count';
  size?: number;
  /** icons일 때 하나씩 보이는 최대 수. */
  max?: number;
  /** 아이콘 앞에 작은 이름("원정 보물")을 붙인다(휴대폰 상황 카드처럼 따로 놓일 때). */
  labeled?: boolean;
}

/**
 * 가진 원정 보물(prd-r4 §7.2-F): 작은 아이콘 줄 또는 보물 상자 + 개수. 이름·한 줄 규칙은 화면 읽기 이름과 호버 안내(title)로 읽힌다.
 * 상태 카드 줄 높이를 늘리지 않게 아이콘은 18~20px다.
 */
export function RelicStrip({ balance, relics, icons, variant, size = 20, max = 4, labeled = false }: Props) {
  if (relics.length === 0) return null;
  const lines = relics.map(id => relicLine(balance, id));
  const said = `보물 ${relics.length}개: ${lines.join(', ')}`;
  if (variant === 'count') {
    return (
      <span className={css.relics} role="img" aria-label={said} title={lines.join('\n')}>
        <ArtIcon name="chest" size={size} />
        <span className={css.relicMore}>{relics.length}</span>
      </span>
    );
  }
  return (
    <span className={css.relics} role="img" aria-label={said}>
      {labeled && <span className={css.relicLabel} aria-hidden="true">보물</span>}
      {relics.slice(0, max).map((id, i) => (
        <span key={id} className={css.relic} style={{ width: size, height: size }} title={lines[i]}>
          <RelicArt icon={balance.relics?.items[id]?.icon ?? 'chest'} icons={icons} size={size} />
        </span>
      ))}
      {relics.length > max && <span className={css.relicMore}>+{relics.length - max}</span>}
    </span>
  );
}
