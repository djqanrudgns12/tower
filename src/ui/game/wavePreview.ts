import type { Balance, EnemyKind } from '../../contracts/balance';
import { composeWave } from '../../domain/waves';

/** 화면 읽기용 적 이름(종족 카탈로그가 들어오면 그 이름으로 바꾼다). */
export const ENEMY_NAME: Record<EnemyKind, string> = {
  walker: '걷는 적', runner: '빠른 적', brute: '힘센 적', shell: '단단한 적', wisp: '떠다니는 적', swarm: '떼로 오는 적',
  flyer: '나는 적', splitter: '갈라지는 적', splitling: '갈라져 나온 적', boss: '대장',
};

export interface WavePreview { total: number; kinds: Array<{ kind: EnemyKind; count: number }>; boss: boolean }

/**
 * 다음 웨이브 미리보기(준비판). 종류별 마릿수는 엔진 편성기가 seed와 상관없이 정하고 순서·정예만 seed로 섞는다.
 * 그래서 아무 seed로 편성해 세어도 실제와 같다(종족이 여럿이어도 역할별로 합쳐 센다). 판정·보상에는 쓰지 않는다.
 */
export function wavePreview(b: Balance, mapId: string, wave: number): WavePreview {
  const list = composeWave(b, mapId, Math.max(1, wave), { s: 1 });
  const counts = new Map<EnemyKind, number>();
  for (const e of list) if (e.kind !== 'boss') counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return {
    total: list.length,
    kinds: [...counts].map(([kind, count]) => ({ kind, count })).sort((a, c) => c.count - a.count),
    boss: list.some(e => e.kind === 'boss'),
  };
}
