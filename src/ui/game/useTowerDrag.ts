import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { TowerId } from '../../contracts/balance';
import type { FieldDrag, FieldView } from '../../game/bridge';
import type { MapConfig } from '../../contracts/maps';
import { snapSlot, toWorldPoint } from './fieldGeometry';

/** 이만큼 움직여야 끌기로 본다(그 전에 떼면 누르기). */
const DRAG_START_PX = 6;

interface Options {
  fieldRef: RefObject<HTMLElement | null>;
  /** 카메라가 알려 준 보이는 세계 영역. */
  viewRef: RefObject<FieldView>;
  slots: readonly MapConfig['slots'][number][];
  occupied: ReadonlySet<string>;
  /** 끌기를 막을 이유(골드 부족·단계 잠금). 없으면 null. */
  blockReason(type: TowerId): string | null;
  onBlocked(reason: string): void;
  /** 붙을 자리가 바뀔 때마다(끝나면 null). 전장 표시용. */
  onDrag(drag: FieldDrag | null): void;
  onDrop(type: TowerId, slotId: string): void;
}

interface Pending { type: TowerId; id: number; x: number; y: number; el: HTMLElement; dragging: boolean; slotId: string | null }

/**
 * 장착 홈 → 전장 끌어 놓기(ui-rules-v2 §4). 놓으면 확인 없이 바로 설치한다.
 * 그림자 위치는 React를 다시 그리지 않고 ref로 옮긴다. 끌기 시작과 끝, 붙는 자리 변화만 알린다.
 */
export function useTowerDrag(o: Options) {
  const opts = useRef(o);
  useEffect(() => { opts.current = o; });
  const pending = useRef<Pending | null>(null);
  const suppressClick = useRef(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [ghostType, setGhostType] = useState<TowerId | null>(null);

  const place = (x: number, y: number) => {
    const g = ghostRef.current;
    if (g) g.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  };

  const finish = useCallback((drop: boolean) => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    if (p.el.hasPointerCapture?.(p.id)) p.el.releasePointerCapture(p.id);
    if (p.dragging) {
      setGhostType(null);
      opts.current.onDrag(null);
      if (drop && p.slotId) opts.current.onDrop(p.type, p.slotId);
    }
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const p = pending.current;
    if (!p || e.pointerId !== p.id) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      suppressClick.current = true;
      const reason = opts.current.blockReason(p.type);
      if (reason) {
        opts.current.onBlocked(reason);
        finish(false);
        return;
      }
      p.dragging = true;
      setGhostType(p.type);
      opts.current.onDrag({ type: p.type, slotId: null });
    }
    // 손가락이 그림을 가리지 않도록 터치는 조금 위에 띄운다.
    const lift = e.pointerType === 'touch' ? 36 : 0;
    place(e.clientX, e.clientY - lift);
    const box = opts.current.fieldRef.current?.getBoundingClientRect();
    let slotId: string | null = null;
    if (box && e.clientX >= box.left && e.clientX <= box.right && e.clientY - lift >= box.top && e.clientY - lift <= box.bottom) {
      const w = toWorldPoint(opts.current.viewRef.current, box.width, box.height, e.clientX - box.left, e.clientY - lift - box.top);
      slotId = snapSlot(opts.current.slots, opts.current.occupied, w.x, w.y);
    }
    if (slotId !== p.slotId) {
      p.slotId = slotId;
      opts.current.onDrag({ type: p.type, slotId });
    }
  }, [finish]);

  const onUp = useCallback((e: PointerEvent) => {
    if (pending.current && e.pointerId === pending.current.id) finish(e.type === 'pointerup');
  }, [finish]);

  useEffect(() => {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onMove, onUp]);

  // 그림자는 처음 그려질 때 누른 자리에 둔다.
  useEffect(() => {
    const p = pending.current;
    if (ghostType && p) place(p.x, p.y);
  }, [ghostType]);

  /** 장착 홈 소켓의 pointerdown. 주 버튼만 받는다. */
  const begin = useCallback((type: TowerId, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || pending.current) return;
    suppressClick.current = false;
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    pending.current = { type, id: e.pointerId, x: e.clientX, y: e.clientY, el, dragging: false, slotId: null };
  }, []);

  /** 끌기 뒤에 따라오는 click은 누르기로 치지 않는다. */
  const takeClick = useCallback(() => {
    const skip = suppressClick.current;
    suppressClick.current = false;
    return !skip;
  }, []);

  return { begin, takeClick, ghostRef, ghostType };
}
