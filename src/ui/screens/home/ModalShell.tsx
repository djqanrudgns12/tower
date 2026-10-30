import { useEffect, useEffectEvent, useRef, useState, type KeyboardEventHandler, type ReactNode } from 'react';
import css from './home.module.css';

interface Props {
  titleId: string;
  title: string;
  wide?: boolean;
  onClose(): void;
  /** 대화상자 안에서만 받는 키 처리(예: 사용 설명서의 ←/→/Home/End). window 전역으로 가로채지 않는다. */
  onDialogKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Tab 순서에 실제로 들어가는 요소만 고른다(roving tabindex의 tabIndex=-1 항목·숨은 요소 제외). */
function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.tabIndex >= 0 && el.offsetParent !== null);
}

export function ModalShell({ titleId, title, wide = false, onClose, onDialogKeyDown, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  // 연 버튼은 첫 렌더 시점(클릭 직후, 배경이 inert가 되기 전)에 잡는다. 닫힐 때 이 요소로 포커스를 돌린다.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  );
  // 부모가 렌더마다 새 onClose를 넘겨도 아래 효과가 다시 돌지 않게 최신 onClose만 부른다.
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    const box = boxRef.current;
    // 열 때 한 번만 첫 요소에 포커스를 준다. 이후 다시 렌더돼도 포커스를 옮기지 않는다.
    if (box) tabbables(box)[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const nodes = tabbables(boxRef.current);
      if (nodes.length === 0) return;
      const firstEl = nodes[0]!;
      const lastEl = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // 언마운트(닫힘) 때만 연 버튼으로 되돌린다. 문서에서 빠진 요소면 건너뛴다.
      if (opener && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <div
      className={css.modalScrim}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${css.oakFrame} ${css.modalDialog} ${wide ? css.modalDialogWide : ''}`}
        onKeyDown={onDialogKeyDown}
      >
        <div className={`${css.parchmentInner} ${css.modalBody}`}>
          <div className={css.modalHeader}>
            <h2 id={titleId} className={css.modalTitle}>{title}</h2>
            <button type="button" className={css.smallBtn} onClick={onClose}>닫기</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
