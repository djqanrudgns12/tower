import { useEffect, useEffectEvent, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import css from './ui.module.css';
import { CloseIcon } from '../icons/ControlIcons';
import { nextSegment, type SegmentOption } from './segments';

export { nextSegment, type SegmentOption };

/**
 * 공용 부품(R4 구조 + R5 참나무 옷, ui-rules-v4 §4). 화면은 버튼·카드·고르기 줄·켜기 끄기·창을 이것으로만 만든다.
 * 모든 조작 요소는 44px 이상, 포커스 링 3px --ring, 비활성은 aria-disabled로 이유를 읽을 수 있게 둔다.
 */

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

export type ButtonVariant = 'primary' | 'accent' | 'danger' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
  /** 짙은 바탕(--bg) 위의 ghost 버튼. */
  onDark?: boolean;
  /** 글자를 왼쪽에 붙인다(답안 키캡처럼 긴 글). */
  align?: 'center' | 'start';
  /** 눌러도 자리를 옮기지 않는다(바닥만 0). 위치가 잠긴 문제판 안의 키(v4 §7.4). 묶음 전체는 조상에 --btn-press-y: 0px을 줘도 된다. */
  still?: boolean;
  /** 키 원화(알약)를 그린다(기본). false면 양피지 볼록 면 + 2px 호두나무 테 + 바닥으로 그린다: 여러 줄 문장 키(답안 보기)·정사각 아이콘 키. */
  art?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'secondary', size = 'md', block = false, onDark = false, align = 'center', still = false, art = true, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(css.btn, css[variant], size === 'lg' && css.lg, block && css.block, onDark && css.onDark, align === 'start' && css.alignStart, still && css.still, !art && css.noArt, className)}
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
  /** 아이콘 옆에 이름을 보인다(머리판·창 머리처럼 자리가 있는 곳, v4 §4.2). 전투 HUD는 아이콘만. */
  showLabel?: boolean;
}

/** 아이콘 키. 라벨 없는 정사각 키는 알약 원화가 동그란 메달로 찌그러지므로 원화를 끈 사각 양피지 키로 그린다. */
export function IconButton({ label, icon, count = 0, showLabel = false, art = true, variant = 'secondary', size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <Button variant={variant} size={size} art={showLabel && art} aria-label={count > 0 ? `${label} ${count}개` : label} title={label} className={cx(css.iconBtn, showLabel && css.showLabel, className)} {...rest}>
      {icon}
      {showLabel && <span aria-hidden="true">{label}</span>}
      {count > 0 && <span className={css.badge} aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </Button>
  );
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'aside' | 'article';
  /** 바탕 위에 떠 있는 카드(바닥 그림자 --float). */
  float?: boolean;
  /** 카드 안의 한 단 낮은 면(음각 홈, --paper-2). 카드 안에 테두리 상자를 다시 넣지 않을 때 쓴다. */
  sunk?: boolean;
  /** 재질: 양피지 면(기본), 참나무 판(옆판·문제판 바탕·탭 줄, 글은 --ink만), 머리판(짙은 호두나무, 머리판·HUD). v4 §4.3. */
  material?: 'parch' | 'board' | 'plaque';
  /** 안쪽 여백: md 16px(기본), sm 12px, none 0. */
  pad?: 'none' | 'sm' | 'md';
}

export function Card({ as: Tag = 'div', float = false, sunk = false, material = 'parch', pad = 'md', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(css.card, float && css.cardFloat, sunk && css.cardSunk, material === 'board' && css.cardBoard, material === 'plaque' && css.cardPlaque, pad === 'sm' && css.padSm, pad === 'none' && css.padNone, className)}
      {...rest}
    />
  );
}


interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  onBlocked?(value: T): void;
  /** 고르기 줄(radiogroup, 기본) 또는 탭 줄(tablist: 고른 칸이 아래 tabpanel 내용을 바꿀 때). 모양·키보드는 같다. */
  role?: 'radiogroup' | 'tablist';
  /** 탭 줄일 때 칸들이 바꾸는 tabpanel의 id(aria-controls). 칸 id는 option.id. */
  controls?: string;
  className?: string | undefined;
}

export function Segmented<T extends string>({ label, options, value, onChange, onBlocked, role = 'radiogroup', controls, className }: SegmentedProps<T>) {
  const tabs = role === 'tablist';
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
    <div role={role} aria-label={label} className={cx(css.segmented, className)} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={el => { refs.current[i] = el; }}
          id={o.id}
          type="button"
          role={tabs ? 'tab' : 'radio'}
          aria-checked={tabs ? undefined : o.value === value}
          aria-selected={tabs ? o.value === value : undefined}
          aria-controls={tabs ? controls : undefined}
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
  className?: string | undefined;
}

/** 스위치. 이름 뒤 '켜짐'·'꺼짐' 글자는 보이기만 한다(상태는 aria-checked가 읽힌다, v4 §4.4). */
export function Toggle({ label, checked, onChange, className }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={cx(css.toggle, className)} onClick={() => onChange(!checked)}>
      <span className={css.track} aria-hidden="true"><span className={css.knob} /></span>
      <span>
        {label}
        <span className={css.toggleState} aria-hidden="true">{checked ? '켜짐' : '꺼짐'}</span>
      </span>
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
  className?: string | undefined;
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
export function ArtIcon({ name, size = 24, label, className }: { name: ArtIconName; size?: number; label?: string | undefined; className?: string | undefined }) {
  const file = name.startsWith('trait.') ? name : `icon.${name}`;
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/ui/${file}.webp`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={cx(css.artIcon, className)}
    />
  );
}

/** 개수 배지. 놋쇠(기본) 또는 밀랍(경고: 보스 웨이브·대응 공백). 글 흐름 안에 선다. */
export function Badge({ count, tone = 'brass' }: { count: number; tone?: 'brass' | 'wax' }) {
  return count > 0 ? <span className={cx(css.badge, css.badgeInline, tone === 'wax' && css.badgeWax)}>{count > 99 ? '99+' : count}</span> : null;
}

export interface ModalTabOption<T extends string = string> extends SegmentOption<T> {
  /** 0보다 크면 탭 이름 옆에 작은 개수 표식을 붙인다. */
  count?: number | undefined;
}

interface ModalTabsProps<T extends string> {
  label: string;
  options: readonly ModalTabOption<T>[];
  value: T;
  onChange(value: T): void;
  onBlocked?(value: T): void;
  /** 고른 탭이 바꾸는 tabpanel의 id(aria-controls). */
  controls: string;
  /** 탭 줄 오른쪽 보조 문구(선택). */
  aside?: ReactNode;
  className?: string | undefined;
}

/**
 * 창 상단 책갈피형 색인 탭(ModalTabs). 창 안의 값 선택기(Segmented radiogroup)와 시각 위계를 분리해
 * 아래 본문 시트(ModalTabPanel)와 한 장의 양피지처럼 맞물린다. 방향키·Home·End가 선택과 포커스를 함께 옮긴다.
 */
export function ModalTabs<T extends string>({ label, options, value, onChange, onBlocked, controls, aside, className }: ModalTabsProps<T>) {
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
    <div className={cx(css.modalTabRail, className)}>
      <div role="tablist" aria-label={label} className={css.modalTabList} onKeyDown={onKeyDown}>
        {options.map((o, i) => (
          <button
            key={o.value}
            ref={el => { refs.current[i] = el; }}
            id={o.id}
            type="button"
            role="tab"
            aria-selected={o.value === value}
            aria-controls={controls}
            aria-disabled={o.disabled || undefined}
            aria-label={o.ariaLabel}
            tabIndex={i === current ? 0 : -1}
            className={css.modalTab}
            onClick={() => (o.disabled ? onBlocked?.(o.value) : onChange(o.value))}
          >
            <span>{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span className={css.modalTabCount} aria-hidden="true">{o.count > 99 ? '99+' : o.count}</span>
            )}
          </button>
        ))}
      </div>
      {aside && <div className={css.modalTabAside}>{aside}</div>}
    </div>
  );
}

interface ModalTabShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** ModalTabs와 ModalTabPanel을 틈 없이 한 덩어리로 묶는 외곽 상자. 고정 프레임 안에서 남은 높이를 채운다. */
export function ModalTabShell({ className, ...rest }: ModalTabShellProps) {
  return <div className={cx(css.modalTabShell, className)} {...rest} />;
}

interface ModalTabPanelProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  labelledBy?: string | undefined;
  pad?: 'none' | 'sm' | 'md';
}

/** ModalTabs 아래 맞물리는 양피지 본문 시트(role="tabpanel"). */
export function ModalTabPanel({ id, labelledBy, pad = 'md', className, ...rest }: ModalTabPanelProps) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className={cx(css.modalTabPanel, pad === 'sm' && css.padSm, pad === 'none' && css.padNone, className)}
      {...rest}
    />
  );
}

interface WindowProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside';
  size?: 'sm' | 'md' | 'lg' | undefined;
  /** 데스크톱·크롬북(≥720×620)에서 3단 고정 프레임 크기(md 680×540, lg 860×580)로 잠근다. */
  fixed?: boolean | undefined;
}

/** 화면에 서는 나무 창(결과·오답 노트): Modal과 같은 틀 한 벌(호두나무 테 + 안쪽 몰딩 + 양피지 면). 배치는 화면 CSS가 정한다. */
export function Window({ as: Tag = 'div', size, fixed = false, className, ...rest }: WindowProps) {
  return (
    <Tag
      className={cx(
        css.window,
        size === 'sm' && css.dialogSm,
        size === 'md' && css.dialogMd,
        size === 'lg' && css.dialogLg,
        fixed && css.frameFixed,
        className,
      )}
      {...rest}
    />
  );
}

/** 창 머리줄 아래 놋쇠 구분선(rule 원화). 꾸밈이라 읽지 않는다. */
export function Rule({ className }: { className?: string | undefined }) {
  return <span className={cx(css.rule, className)} aria-hidden="true" />;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.tabIndex >= 0 && el.offsetParent !== null);
}

/** 열린 창 차례. 창이 겹치면(진화 창 위 자동 정지) 맨 위 창만 Esc·Tab 가둠을 처리한다. */
const openModals: object[] = [];

interface ModalProps {
  titleId: string;
  title: ReactNode;
  onClose(): void;
  size?: 'sm' | 'md' | 'lg';
  /** 데스크톱·크롬북(≥720×620)에서 창 높이를 고정 규격(md 680×540, lg 860×580)으로 잠가 탭 전환 흔들림을 없앤다. */
  fixed?: boolean;
  /** 아래 버튼 줄(오른쪽 정렬). */
  footer?: ReactNode;
  /** 막을 눌러도 닫지 않는다(고르기 창처럼 꼭 골라야 하는 창). */
  dismissable?: boolean;
  /** 처음 포커스를 줄 곳. 기본은 내용의 첫 조작 요소다. 내용이 읽기·둘러보기뿐인 창(전체 랭킹)은 닫기('close')에서 시작한다. */
  initialFocus?: 'content' | 'close';
  onDialogKeyDown?(e: KeyboardEvent<HTMLDivElement>): void;
  children: ReactNode;
}

/** 막(--scrim) 위에 뜬 나무 창(호두나무 테 + 양피지 면). 포커스를 가두고 Esc로 닫으며, 닫히면 연 버튼으로 포커스를 돌린다. */
export function Modal({ titleId, title, onClose, size = 'md', fixed = false, footer, dismissable = true, initialFocus = 'content', onDialogKeyDown, children }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [opener] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  const close = useEffectEvent(() => { if (dismissable) onClose(); });
  // 첫 포커스 자리는 열 때 한 번만 정한다(열린 뒤 바뀌어도 포커스를 옮기지 않는다).
  const [startAtClose] = useState(initialFocus === 'close');
  const [token] = useState<object>(() => ({}));

  useEffect(() => {
    openModals.push(token);
    const box = boxRef.current;
    // 첫 포커스는 내용(고를 카드·입력칸)이다. 내용에 조작 요소가 없거나 initialFocus가 'close'일 때만 머리줄의 닫기로 간다.
    if (box) {
      const nodes = tabbables(box);
      (startAtClose ? nodes[0] : (nodes.find(el => !el.closest('[data-dialog-head]')) ?? nodes[0]))?.focus();
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== token) return;
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
      const at = openModals.lastIndexOf(token);
      if (at >= 0) openModals.splice(at, 1);
      if (opener && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, [opener, startAtClose, token]);

  return (
    <div className={css.scrim} onMouseDown={e => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(css.dialog, size === 'sm' ? css.dialogSm : size === 'lg' ? css.dialogLg : css.dialogMd, fixed && css.frameFixed)}
        onKeyDown={onDialogKeyDown}
      >
        <div className={css.dialogHead} data-dialog-head>
          <h2 id={titleId} className={css.dialogTitle}>{title}</h2>
          {dismissable && <IconButton label="닫기" icon={<CloseIcon />} variant="secondary" onClick={onClose} />}
        </div>
        {children}
        {footer && <div className={css.dialogFoot}>{footer}</div>}
      </div>
    </div>
  );
}
