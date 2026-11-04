import type { ReactNode } from 'react';
import { Button } from '../kit';
import type { StatBar } from './statBars';
import { StatRows } from './TowerDetail';
import css from './ChoiceCard.module.css';

interface Props {
  /** 원화(종이 위에 바닥 그림자와 함께 놓인다). */
  art: ReactNode;
  name: string;
  /** 한 줄 설명. */
  desc: string;
  /** 능력치 칸 막대. next가 있으면 늘어나는 칸이 호박색이다. */
  bars: readonly StatBar[];
  /** 설명 아래 작은 한 줄(예: 하늘 적 공격). */
  note?: ReactNode;
  /** 잘 잡는 적·약한 적 아이콘 줄(CounterIcons, 계약 strongVs·weakVs). */
  counters?: ReactNode;
  /** 고르기 단추의 글(값이 붙을 수 있다: 고르기 · 45). */
  action: ReactNode;
  actionLabel: string;
  variant: 'primary' | 'accent';
  /** 지금 고를 수 없다(골드 부족·단계 잠금). 눌러도 고르지 않고 이유는 창 아래 한 줄이 알린다. */
  blocked?: boolean;
  /** 화면 짜임: 휴대폰은 가로 한 줄(그림 | 글 | 단추), 그 밖에는 세로 카드. */
  row?: boolean;
  onPick(): void;
  onPreview?(on: boolean): void;
}

/**
 * 새 타워·진화 A/B 공용 카드(R4 PRD §9.2): 종이 위 원화와 바닥 그림자, 이름, 한 줄 설명, 능력치 칸 막대, 카드마다 ‘고르기’.
 * 고르기 한 번으로 바로 고른다(라디오 + 공통 확정 단추 없음). 카드 자체는 면을 두지 않아 창(카드) 안 겹이 늘지 않는다.
 */
export function ChoiceCard({ art, name, desc, bars, note, counters, action, actionLabel, variant, blocked = false, row = false, onPick, onPreview }: Props) {
  return (
    <article className={css.card} data-row={row || undefined} onPointerEnter={() => onPreview?.(true)} onPointerLeave={() => onPreview?.(false)}>
      <div className={css.stage} aria-hidden="true">
        <svg className={css.ground} viewBox="0 0 100 20" preserveAspectRatio="none"><ellipse cx="50" cy="10" rx="50" ry="10" /></svg>
        <span className={css.art}>{art}</span>
      </div>
      <div className={css.body}>
        <h3 className={css.name}>{name}</h3>
        <p className={css.desc}>{desc}</p>
        {note}
        {counters}
        {bars.length > 0 && <StatRows bars={bars} values={false} labels={!row} />}
      </div>
      <Button
        variant={variant}
        block={!row}
        className={css.pick}
        data-choice
        aria-label={actionLabel}
        aria-disabled={blocked || undefined}
        onFocus={() => onPreview?.(true)}
        onBlur={() => onPreview?.(false)}
        onClick={() => { if (!blocked) onPick(); }}
      >
        {action}
      </Button>
    </article>
  );
}
