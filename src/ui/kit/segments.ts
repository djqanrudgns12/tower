import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 고를 수 없는 칸. 누르면 onBlocked가 불린다(예: "문제 준비 중"). */
  disabled?: boolean;
  /** 화면 읽기용 이름(label이 그림일 때). */
  ariaLabel?: string;
}

/** 화살표·Home·End로 고를 수 있는 다음 칸. 고를 수 없는 칸은 건너뛴다. */
export function nextSegment<T extends string>(options: readonly SegmentOption<T>[], current: number, key: string): number {
  const n = options.length;
  if (n === 0) return -1;
  const open = (i: number) => !options[i]?.disabled;
  if (key === 'Home') return options.findIndex((_, i) => open(i));
  if (key === 'End') { for (let i = n - 1; i >= 0; i--) if (open(i)) return i; return -1; }
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return current;
  for (let k = 1; k <= n; k++) {
    const i = (current + step * k + n * k) % n;
    if (open(i)) return i;
  }
  return current;
}

