import { useId, type KeyboardEvent, type ReactNode } from 'react';
import type { FormDelta, StatBar } from './statBars';
import { StatRows } from './TowerDetail';
import css from './ChoiceCard.module.css';

interface Props {
  /** 원화(카드 면 위에 바닥 그림자와 함께 놓인다). */
  art: ReactNode;
  name: string;
  /** 한 줄 설명. */
  desc: string;
  /** 능력치 칸 막대(진화 카드만). next가 있으면 늘어나는 칸이 호박색이다. 비면 그리지 않는다. */
  bars?: readonly StatBar[];
  /** 바뀌는 수치 칩 1~2개(진화 카드만, statBars formDeltas). 줄어드는 능력은 붉은 윤곽이고 화면 읽기도 '줄어듦'이다(R5 B9). */
  deltas?: readonly FormDelta[];
  /** 설명 아래 작은 한 줄(예: 하늘 적 공격). */
  note?: ReactNode;
  /** 잘 잡는 적·약한 적 아이콘 줄(CounterIcons, 계약 strongVs·weakVs). */
  counters?: ReactNode;
  /** 카드 아래쪽 값 줄(진화 비용: 금화 + 숫자). */
  price?: ReactNode;
  /** 카드 전체를 누르는 한 버튼의 화면 읽기 이름(예: "덫공방초소 고르기"). */
  actionLabel: string;
  /** 지금 고를 수 없다(골드 부족·단계 잠금). 눌러도 고르지 않고, 이유 줄(describedBy)이 알린다. */
  blocked?: boolean;
  /** 이유 줄 요소 id(화면 읽기 설명). */
  describedBy?: string;
  /** 그림이 타워 원화가 아니라 아이콘이다(보물). 카드를 채우지 않고 96px로 놓는다. */
  icon?: boolean;
  /** 화면 짜임: 휴대폰은 가로 한 줄(그림 | 글), 그 밖에는 세로 카드. */
  row?: boolean;
  onPick(): void;
  onPreview?(on: boolean): void;
}

/**
 * 새 타워·보물·진화 A/B 공용 카드(R4 PRD §9.2, ui-rules-v3): 카드 전체가 하나의 키캡 버튼이다(고르기 단추 줄 없음).
 * 원화·이름·한 줄 설명·상성 아이콘(진화는 능력치 막대와 비용)이 면 위에 놓이고, 눌리는 단추는 카드를 덮는 투명 버튼 하나다.
 * 그러면 카드 안의 막대·아이콘 목록은 올바른 마크업으로 남고 Tab은 카드마다 한 번 멈춘다. 호버·포커스는 위로 뜨고, 누르면 가라앉는다(kit Button과 같은 움직임).
 */
export function ChoiceCard({ art, name, desc, bars = [], deltas = [], note, counters, price, actionLabel, blocked = false, describedBy, icon = false, row = false, onPick, onPreview }: Props) {
  // 수치 칩은 카드를 덮는 단추의 설명으로도 걸어, 카드에 포커스가 가면 '줄어듦'까지 함께 읽힌다(R5 B9).
  const deltasId = useId();
  const describe = [deltas.length > 0 ? deltasId : null, blocked ? describedBy : null].filter(Boolean).join(' ') || undefined;
  return (
    <article className={css.card} data-row={row || undefined} data-icon={icon || undefined} data-priced={price ? true : undefined} data-blocked={blocked || undefined} onPointerEnter={() => onPreview?.(true)} onPointerLeave={() => onPreview?.(false)}>
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
      {deltas.length > 0 && (
        <ul id={deltasId} className={css.deltas}>
          {deltas.map(d => (
            <li key={d.text} className={css.delta} data-down={d.down || undefined}>
              <span aria-hidden="true">{d.text}</span>
              <span className="sr-only">{d.speech}</span>
            </li>
          ))}
        </ul>
      )}
      {price}
      <button
        type="button"
        className={css.hit}
        data-choice
        aria-label={actionLabel}
        aria-disabled={blocked || undefined}
        aria-describedby={describe}
        onFocus={() => onPreview?.(true)}
        onBlur={() => onPreview?.(false)}
        onClick={() => { if (!blocked) onPick(); }}
      />
    </article>
  );
}

/**
 * 카드 사이 방향키 이동(R5 B13, 옛 라디오 줄의 화살표 이동): →·↓는 다음 카드, ←·↑는 앞 카드(끝에서 처음으로 돈다), Home·End는 처음·끝.
 * 휴대폰 세로 쌓임에서도 같은 키가 같은 방향이다. 포커스만 옮기고 고르지 않는다(고르기는 Enter·Space). 다루지 않는 키는 -1.
 */
export function nextChoice(count: number, current: number, key: string): number {
  if (count === 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  return step === 0 ? -1 : (current + step + count) % count;
}

/** 카드 묶음의 keydown: 포커스가 카드(data-choice 단추)에 있을 때 nextChoice로 옮긴다. 막힌 카드도 포커스는 받는다(이유 줄을 읽게). */
function moveChoiceFocus(e: KeyboardEvent<HTMLElement>) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-choice]')];
  const at = items.indexOf(e.target as HTMLElement);
  if (at < 0) return;
  const to = nextChoice(items.length, at, e.key);
  if (to < 0) return;
  // 창이 세로로 넘칠 때 화살표가 창을 굴리지 않게 막는다.
  e.preventDefault();
  items[to]!.focus();
}

/**
 * 새 타워·보물·진화 창의 카드 묶음(R5 B13): 넓은 화면은 2·3칸 가로, 휴대폰은 세로로 쌓고, 세 창 모두 방향키로 카드 사이를 옮긴다.
 * 첫 포커스(첫 카드)와 Tab 가둠은 kit Modal 그대로다.
 */
export function ChoiceList({ columns, row = false, children }: { columns: 2 | 3; row?: boolean; children: ReactNode }) {
  return (
    <div className={row ? css.listRow : columns === 3 ? css.list3 : css.list2} onKeyDown={moveChoiceFocus}>
      {children}
    </div>
  );
}
