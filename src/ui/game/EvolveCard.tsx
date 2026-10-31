import { useEffect, useRef } from 'react';
import type { Balance } from '../../contracts/balance';
import type { TowerView } from '../../application/view';
import { fmtNumber } from '../copy';
import { BranchMarkIcon, CloseIcon, GoldCoinIcon, TowerShieldPortrait } from '../icons/GameIcons';
import { evolutionChoices, formInfo, towerForm, upgradeCost, type FormId } from './evolution';
import { formDeltas } from './statBars';
import css from './EvolveCard.module.css';

interface Props {
  balance: Balance;
  tower: TowerView;
  gold: number;
  icons: Record<string, string>;
  /** 진화를 받을 수 없는 이유(단계 잠금). 없으면 null. */
  lock: string | null;
  onPreview(form: FormId | null): void;
  onChoose(form: FormId): void;
  onClose(): void;
  /** 연 단추가 사라졌을 때(진화로 도구가 바뀜) 포커스를 둘 곳. */
  restoreFocus?(): void;
}

/**
 * 진화 카드(progression.md §5 화면 규칙): 두 형태의 그림을 크게 나란히, 한 줄 설명과 바뀌는 수치 1~2개만.
 * 고르면 바로 진화한다. 열 때 첫 카드에 한 번 포커스를 주고 닫으면 연 단추로 돌아간다. Tab은 카드 안에서 돈다.
 */
export function EvolveCard({ balance, tower, gold, icons, lock, onPreview, onChoose, onClose, restoreFocus }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const restore = useRef(restoreFocus);
  useEffect(() => { close.current = onClose; restore.current = restoreFocus; });
  const choices = evolutionChoices(balance, tower) ?? [];
  const cost = upgradeCost(balance, tower.type, tower.level);
  const from = towerForm(tower);
  const short = cost !== null && gold < cost;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('[data-choice]')?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
      else restore.current?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
    if (e.key !== 'Tab') return;
    const items = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
    if (items.length === 0) return;
    const first = items[0]!, last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className={css.layer} onPointerDown={e => { if (e.target === e.currentTarget) close.current(); }}>
      <div ref={box} className={css.card} role="dialog" aria-modal="true" aria-labelledby="evolve-title" onKeyDown={onKeyDown}>
        <div className={css.head}>
          <h2 id="evolve-title" className={css.title}>{balance.towers[tower.type].label} 진화</h2>
          <span className={css.price} data-short={short || undefined}><GoldCoinIcon size={16} />{cost !== null ? fmtNumber(cost) : '-'}</span>
          <button type="button" className={css.close} aria-label="닫기" onClick={() => close.current()}><CloseIcon size={18} /></button>
        </div>
        <div className={css.choices}>
          {choices.map(form => {
            const info = formInfo(balance, tower.type, form);
            const deltas = formDeltas(balance, tower.type, tower.level, from, tower.level + 1, form);
            return (
              <button
                key={form}
                type="button"
                data-choice
                className={css.choice}
                aria-disabled={short || lock !== null || undefined}
                aria-describedby={`evolve-${form}-sum`}
                onPointerEnter={() => onPreview(form)}
                onPointerLeave={() => onPreview(null)}
                onFocus={() => onPreview(form)}
                onClick={() => { if (!short && lock === null) onChoose(form); }}
              >
                <span className={css.art}>
                  <TowerShieldPortrait type={tower.type} icons={icons} size={128} bare />
                  {(form === 'A' || form === 'B') && <span className={css.mark}><BranchMarkIcon id={form} size={28} /></span>}
                </span>
                <span className={css.formName}>{info.label}</span>
                <span id={`evolve-${form}-sum`} className={css.summary}>{info.summary}</span>
                {deltas.length > 0 && (
                  <span className={css.deltas}>
                    {deltas.map(d => <span key={d} className={css.delta}>{d}</span>)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {(lock || short) && <p className={css.reason} role="status">{lock ?? `골드 ${cost! - gold} 부족`}</p>}
      </div>
    </div>
  );
}
