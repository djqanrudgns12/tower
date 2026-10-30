import { useEffect, useRef, type ReactNode } from 'react';
import css from './home.module.css';

interface Props {
  titleId: string;
  title: string;
  wide?: boolean;
  onClose(): void;
  children: ReactNode;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function ModalShell({ titleId, title, wide = false, onClose, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = boxRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const nodes = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
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
      previous?.focus?.();
    };
  }, [onClose]);

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
