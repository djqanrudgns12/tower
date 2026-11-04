import { useEffect, useEffectEvent, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import css from './ui.module.css';
import { CloseIcon } from '../icons/ControlIcons';
import { nextSegment, type SegmentOption } from './segments';

export { nextSegment, type SegmentOption };

/**
 * R4 공용 부품(ui-rules-v3 §2). 화면은 버튼·카드·고르기 줄·켜기 끄기·창을 이것으로만 만든다.
 * 모든 조작 요소는 44px 이상, 포커스 링 3px --blue, 비활성은 aria-disabled로 이유를 읽을 수 있게 둔다.
 */

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

export type ButtonVariant = 'primary' | 'accent' | 'danger' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
  /** 짙은 바탕(--bg) 위의 ghost 버튼. */
  onDark?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'secondary', size = 'md', block = false, onDark = false, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(css.btn, css[variant], size === 'lg' && css.lg, block && css.block, onDark && css.onDark, className)}
      {...rest}
    />
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'block'> {
  /** 화면 읽기 이름이자 마우스 호버 안내. */
  label: string;
  icon: ReactNode;
  /** 0보다 크면 오른쪽 위에 개수 배지를 단다. */
  count?: number;
}

export function IconButton({ label, icon, count = 0, variant = 'secondary', size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <Button variant={variant} size={size} aria-label={count > 0 ? `${label} ${count}개` : label} title={label} className={cx(css.iconBtn, className)} {...rest}>
      {icon}
      {count > 0 && <span className={css.badge} aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </Button>
  );
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'aside' | 'article';
  /** 바탕 위에 떠 있는 카드(그림자 --float). */
  float?: boolean;
  /** 카드 안의 한 단 낮은 면(--paper-2). 카드 안에 테두리 상자를 다시 넣지 않을 때 쓴다. */
  sunk?: boolean;
}

export function Card({ as: Tag = 'div', float = false, sunk = false, className, ...rest }: CardProps) {
  return <Tag className={cx(css.card, float && css.cardFloat, sunk && css.cardSunk, className)} {...rest} />;
}


interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  onBlocked?(value: T): void;
  className?: string;
}

export function Segmented<T extends string>({ label, options, value, onChange, onBlocked, className }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = Math.max(0, options.findIndex(o => o.value === value));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextSegment(options, current, e.key);
    if (next === current || next < 0) return;
    e.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx(css.segmented, className)} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={el => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-disabled={o.disabled || undefined}
          aria-label={o.ariaLabel}
          tabIndex={i === current ? 0 : -1}
          className={css.segment}
          onClick={() => (o.disabled ? onBlocked?.(o.value) : onChange(o.value))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  className?: string;
}

export function Toggle({ label, checked, onChange, className }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={cx(css.toggle, className)} onClick={() => onChange(!checked)}>
      <span className={css.track} aria-hidden="true"><span className={css.knob} /></span>
      {label}
    </button>
  );
}

interface StatProps {
  icon: ReactNode;
  value: ReactNode;
  /** 보이는 작은 이름(없으면 화면 읽기용 이름만). */
  label?: string;
  srLabel?: string;
  size?: 'md' | 'lg';
  className?: string;
}

export function Stat({ icon, value, label, srLabel, size = 'md', className }: StatProps) {
  return (
    <span className={cx(css.stat, size === 'lg' ? css.statLg : css.statMd, className)}>
      {icon}
      {srLabel && <span className="sr-only">{srLabel}</span>}
      <span>{value}</span>
      {label && <span className={css.statLabel}>{label}</span>}
    </span>
  );
}

export type ArtIconName =
  | 'coin' | 'gate' | 'wave' | 'star' | 'flame' | 'note' | 'lock' | 'chest'
  | 'trait.armor' | 'trait.ward' | 'trait.flying' | 'trait.swarm' | 'trait.fast' | 'trait.split' | 'trait.clay' | 'trait.burrow';

/** 원화 아이콘(public/assets/ui). 상태 아이콘은 icon.<이름>, 적 특성은 trait.<이름>. 꾸밈이면 label 없이 숨긴다. */
export function ArtIcon({ name, size = 24, label, className }: { name: ArtIconName; size?: number; label?: string; className?: string }) {
  const file = name.startsWith('trait.') ? name : `icon.${name}`;
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/ui/${file}.png`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={cx(css.artIcon, className)}
    />
  );
}

export function Badge({ count }: { count: number }) {
  return count > 0 ? <span className={css.badge}>{count > 99 ? '99+' : count}</span> : null;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.tabIndex >= 0 && el.offsetParent !== null);
}

interface ModalProps {
  titleId: string;
  title: ReactNode;
  onClose(): void;
  size?: 'sm' | 'md' | 'lg';
  /** 아래 버튼 줄(오른쪽 정렬). */
  footer?: ReactNode;
  /** 막을 눌러도 닫지 않는다(고르기 창처럼 꼭 골라야 하는 창). */
  dismissable?: boolean;
  onDialogKeyDown?(e: KeyboardEvent<HTMLDivElement>): void;
  children: ReactNode;
}

/** 막(--scrim) 위에 뜬 카드 창. 포커스를 가두고 Esc로 닫으며, 닫히면 연 버튼으로 포커스를 돌린다. */
export function Modal({ titleId, title, onClose, size = 'md', footer, dismissable = true, onDialogKeyDown, children }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [opener] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  const close = useEffectEvent(() => { if (dismissable) onClose(); });

  useEffect(() => {
    const box = boxRef.current;
    if (box) tabbables(box)[0]?.focus();
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const nodes = tabbables(boxRef.current);
      if (nodes.length === 0) return;
      const first = nodes[0]!, last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (opener && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <div className={css.scrim} onMouseDown={e => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(css.card, css.cardFloat, css.dialog, size === 'sm' ? css.dialogSm : size === 'lg' ? css.dialogLg : css.dialogMd)}
        onKeyDown={onDialogKeyDown}
      >
        <div className={css.dialogHead}>
          <h2 id={titleId} className={css.dialogTitle}>{title}</h2>
          {dismissable && <IconButton label="닫기" icon={<CloseIcon />} variant="ghost" onClick={onClose} />}
        </div>
        {children}
        {footer && <div className={css.dialogFoot}>{footer}</div>}
      </div>
    </div>
  );
}
