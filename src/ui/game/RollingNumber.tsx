import { useEffect, useRef, useState, type Ref } from 'react';
import { fmtNumber } from '../copy';

interface Props {
  value: number;
  className?: string | undefined;
  /** 굴림 시간(ms). 보상 연출 상한 600ms 안. */
  duration?: number;
  reducedMotion: boolean;
  ref?: Ref<HTMLElement> | undefined;
}

/**
 * 숫자 굴림(ui-rules-v2 §5): 값이 바뀌면 이전 값에서 새 값까지 ease-out으로 굴러간다.
 * 화면 읽기에는 늘 최종 값만 보이도록 바깥(부모)의 aria-label을 쓴다. 모션을 끄면 바로 바뀐다.
 */
export function RollingNumber({ value, className, duration = 520, reducedMotion, ref }: Props) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);

  useEffect(() => {
    if (reducedMotion || value === shownRef.current) {
      from.current = value;
      shownRef.current = value;
      setShown(value);
      return undefined;
    }
    from.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from.current + (value - from.current) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reducedMotion]);

  return <strong ref={ref as Ref<HTMLElement>} className={className} aria-hidden="true">{fmtNumber(shown)}</strong>;
}
