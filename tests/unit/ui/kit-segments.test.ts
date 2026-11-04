import { describe, expect, it } from 'vitest';
import { nextSegment, type SegmentOption } from '../../../src/ui/kit/segments';

const opts: SegmentOption<string>[] = [
  { value: 'g3', label: '3학년' },
  { value: 'g4', label: '4학년', disabled: true },
  { value: 'g5', label: '5학년' },
  { value: 'g6', label: '6학년', disabled: true },
];

describe('Segmented 키보드 이동(R4 U0)', () => {
  it('화살표는 고를 수 없는 칸을 건너뛰고 끝에서 처음으로 돈다', () => {
    expect(nextSegment(opts, 0, 'ArrowRight')).toBe(2);
    expect(nextSegment(opts, 2, 'ArrowRight')).toBe(0);
    expect(nextSegment(opts, 0, 'ArrowLeft')).toBe(2);
    expect(nextSegment(opts, 2, 'ArrowUp')).toBe(0);
  });
  it('Home·End는 고를 수 있는 처음·마지막 칸, 다른 키는 그대로', () => {
    expect(nextSegment(opts, 2, 'Home')).toBe(0);
    expect(nextSegment(opts, 0, 'End')).toBe(2);
    expect(nextSegment(opts, 2, 'a')).toBe(2);
  });
});
