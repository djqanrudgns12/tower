// 한 판은 한 탭만 쓴다. Web Locks 배타 잠금을 판이 끝날 때까지 쥐고 있는다(PRD §14).
const LOCK_NAME = 'vocabulary-td-active-run';

export interface Ownership { release(): void }

export const locksSupported = () => typeof navigator !== 'undefined' && 'locks' in navigator;

/** 잠금을 얻으면 Ownership, 다른 탭이 쥐고 있으면 null. */
export async function acquireRunLock(): Promise<Ownership | null> {
  if (!locksSupported()) return null;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const granted = await new Promise<boolean>(resolve => {
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async lock => {
      if (!lock) { resolve(false); return; }
      resolve(true);
      await held;
    });
  });
  return granted ? { release } : null;
}
