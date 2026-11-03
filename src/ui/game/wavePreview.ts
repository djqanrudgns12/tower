import type { Balance, BossTier, EnemyKind } from '../../contracts/balance';
import { campaignOf, enemyArtId } from '../../domain/factions';
import { composeWave } from '../../domain/waves';

/** 화면 읽기용 적 이름(종족 카탈로그가 들어오면 그 이름으로 바꾼다). */
export const ENEMY_NAME: Record<EnemyKind, string> = {
  walker: '걷는 적', runner: '빠른 적', brute: '힘센 적', shell: '단단한 적', wisp: '떠다니는 적', swarm: '떼로 오는 적',
  flyer: '나는 적', splitter: '갈라지는 적', splitling: '갈라져 나온 적', boss: '대장',
};

/** 준비판 미리보기 한 줄: 역할(kind)·마릿수, 그림을 고를 종족(그 역할이 가장 많은 종족)과 대장 단계. */
export interface PreviewFoe { kind: EnemyKind; count: number; faction: string; bossTier: BossTier | null }
export interface WavePreview { total: number; kinds: PreviewFoe[]; boss: boolean; bossFoe: PreviewFoe | null }

/**
 * 다음 웨이브 미리보기(준비판). 종류별 마릿수는 엔진 편성기가 seed와 상관없이 정하고 순서·정예만 seed로 섞는다.
 * 그래서 아무 seed로 편성해 세어도 실제와 같다(종족이 여럿이어도 역할별로 합쳐 센다). 판정·보상에는 쓰지 않는다.
 */
export function wavePreview(b: Balance, mapId: string, wave: number): WavePreview {
  const list = composeWave(b, mapId, Math.max(1, wave), { s: 1 });
  // 편성기는 늘 종족을 채우지만 타입은 선택이라, 없으면 맵의 주력 종족(엔진의 기본값)으로 본다.
  const primary = campaignOf(b, mapId).primary;
  const counts = new Map<EnemyKind, { count: number; byFaction: Map<string, number> }>();
  for (const e of list) {
    if (e.kind === 'boss') continue;
    const row = counts.get(e.kind) ?? { count: 0, byFaction: new Map<string, number>() };
    row.count++;
    const faction = e.faction ?? primary;
    row.byFaction.set(faction, (row.byFaction.get(faction) ?? 0) + 1);
    counts.set(e.kind, row);
  }
  // 같은 역할이 여러 종족에 나오면 가장 많은 종족의 그림을 쓴다(같으면 편성 순서가 앞선 종족).
  const lead = (m: Map<string, number>) => [...m].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  const boss = list.find(e => e.kind === 'boss');
  return {
    total: list.length,
    kinds: [...counts].map(([kind, row]) => ({ kind, count: row.count, faction: lead(row.byFaction), bossTier: null })).sort((a, c) => c.count - a.count),
    boss: boss !== undefined,
    bossFoe: boss ? { kind: 'boss', count: 1, faction: boss.faction ?? primary, bossTier: boss.bossTier ?? 1 } : null,
  };
}

/**
 * 미리보기 그림 주소 고르기: 종족 그림 id(domain/factions.ts enemyArtId — 한 장 `<id>` 또는 프레임 묶음 `<id>.0`) →
 * 그림이 없을 때만 전장 텍스처에서 뽑은 옛 그림(`fallback`). 전장 EnemyLayer가 그림을 고르는 순서와 같다.
 */
export function foeIconUrl(b: Balance, foe: PreviewFoe, urlOf: (artId: string) => string | undefined, fallback: string | undefined): string | undefined {
  const id = b.factions[foe.faction] ? enemyArtId(b, foe) : null;
  return (id && (urlOf(`${id}.0`) ?? urlOf(id))) ?? fallback;
}
