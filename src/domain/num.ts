// 도메인의 모든 정수 산술은 이 헬퍼를 거친다. 안전 범위를 벗어나면 조용히 자르지 않고 던진다(PRD §8.6).
export class NumericLimitError extends Error {
  constructor(where: string, value: number) {
    super(`NUMERIC_LIMIT at ${where}: ${value}`);
    this.name = 'NumericLimitError';
  }
}

export function safe(value: number, where = 'value'): number {
  if (!Number.isSafeInteger(value)) throw new NumericLimitError(where, value);
  return value;
}

export const add = (a: number, b: number, where = 'add') => safe(a + b, where);

/** floor(a×b/c), c>0. 곱도 안전 범위여야 한다. */
export function mulDivFloor(a: number, b: number, c: number, where = 'mulDivFloor'): number {
  const p = safe(a * b, where);
  return Math.floor(p / c);
}

/** ceil(a×b/c), a·b ≥ 0, c>0. */
export function mulDivCeil(a: number, b: number, c: number, where = 'mulDivCeil'): number {
  const p = safe(a * b, where);
  return Math.floor((p + c - 1) / c);
}

export const ceilDiv = (a: number, b: number) => Math.floor((safe(a, 'ceilDiv') + b - 1) / b);

export const bpFloor = (value: number, bp: number, where = 'bp') => mulDivFloor(value, bp, 10000, where);
export const bpCeil = (value: number, bp: number, where = 'bp') => mulDivCeil(value, bp, 10000, where);

export const TICK_HZ = 30;
/** 정수 ms → 틱(올림). 부동소수 `ceil(초×30)`을 쓰지 않는다(PRD §13.3). */
export const msToTicks = (ms: number) => Math.floor((safe(ms, 'ms') * TICK_HZ + 999) / 1000);

/** 정수 제곱근(내림). Math.sqrt는 IEEE 754에서 정확히 반올림되므로 보정 후 결정적이다. */
export function isqrt(n: number): number {
  safe(n, 'isqrt');
  if (n < 0) throw new RangeError('isqrt of negative');
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

/** round5(x) = 5 × floor(x/5 + 0.5), x는 비용×BP/10000의 정확한 유리수. */
export function round5Bp(base: number, bp: number): number {
  // x = base×bp/10000 → round5 = 5×floor((base×bp + 25000)/50000)
  return 5 * Math.floor((safe(base * bp, 'round5') + 25000) / 50000);
}
