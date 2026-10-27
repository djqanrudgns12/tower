// xorshift32-v1(PRD §20.1). 상태는 uint32 하나라 저장·복원이 그대로 된다. 암호 용도가 아니다.
export const RNG_ALGORITHM = 'xorshift32-v1';
const ZERO_REMAP = 0x6d2b79f5;
export const STREAM_SALT = { battle: 0x9e3779b9, question: 0x243f6a88, option: 0xb7e15162, visual: 0xdeadbeef } as const;
export type RngStream = keyof typeof STREAM_SALT;

const nonZero = (x: number) => (x >>> 0 === 0 ? ZERO_REMAP : x >>> 0);

export function streamSeed(seed: number, stream: RngStream): number {
  return nonZero((nonZero(seed) ^ STREAM_SALT[stream]) >>> 0);
}

/** 다음 상태(=출력). */
export function nextU32(state: number): number {
  let x = state >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x;
}

/** 상태를 담은 작은 참조. 도메인 상태에는 숫자만 저장하고 계산 중에만 이 객체를 쓴다. */
export interface Rng { s: number }

export function u32(r: Rng): number {
  r.s = nextU32(r.s);
  return r.s;
}

/** [0, n) 균등 정수. modulo 편향을 거절 표본으로 없앤다. */
export function intBelow(r: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) throw new RangeError(`intBelow(${n})`);
  const limit = 0x100000000 - (0x100000000 % n);
  for (;;) {
    const v = u32(r);
    if (v < limit) return v % n;
  }
}

/** Fisher–Yates 제자리 섞기. */
export function shuffle<T>(r: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = intBelow(r, i + 1);
    const tmp = list[i] as T;
    list[i] = list[j] as T;
    list[j] = tmp;
  }
  return list;
}
