/**
 * 랭킹 응답 캐시(Workers Cache API, 거점별).
 * - 담는 것: 공용 범위(분류·기간·학년·난이도)마다 순위를 매긴 전체 목록 하나. 쪽(limit·offset)은 꺼낼 때 자른다.
 * - 담지 않는 것: 기기마다 다른 부분(isMe·runIds·myEntry). 요청마다 이 목록에서 내 해시를 찾아 만든다.
 * - 적중하면 속도 제한 칸도 D1도 건드리지 않는다(명예점 탭의 내 runIds만 읽기 전용으로 조회).
 * - 제출이 기록되면 그 판이 바꾸는 범위를 이 거점에서 지운다. 다른 거점은 최대 TTL만큼 늦을 수 있다.
 * - workers.dev 주소에서는 Cache API가 아무것도 저장하지 않으므로 늘 빗나가고, 캐시 없는 동작과 같다.
 */
import type { RankedPlayer, RankingTab } from './ranking';

export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}

export interface CacheScope {
  tab: RankingTab;
  period: string;
  grade: number;
  difficulty: string;
}

const CACHE_PATH = '/__ranking-cache/v1';

/** 공용 범위의 열쇠. 같은 Worker 주소 아래 Worker가 응답하지 않는 경로라 밖에서 꺼낼 수 없다. */
function keyOf(origin: string, scope: CacheScope): Request {
  const difficulty = scope.tab === 'honor_points' ? '*' : scope.difficulty;
  return new Request(`${origin}${CACHE_PATH}/${scope.tab}/${encodeURIComponent(scope.period)}/${scope.grade}/${encodeURIComponent(difficulty)}`);
}

type Packed = [hash: string, nickname: string, grade: number, difficulty: string, val: number, secondary: number, correct: number, achievedAt: number, runId: string | null];

export class RankingCache {
  constructor(private readonly cache: CacheLike, private readonly origin: string, private readonly ttlSeconds: number) {}

  async get(scope: CacheScope): Promise<RankedPlayer[] | null> {
    try {
      const hit = await this.cache.match(keyOf(this.origin, scope));
      if (!hit) return null;
      const packed = (await hit.json()) as Packed[];
      return packed.map(([hash, nickname, grade, difficulty, val, secondary, correct, achievedAt, runId], i) => ({
        rank: i + 1, hash, nickname, grade, difficulty, val, secondary, correct, achievedAt, runId,
      }));
    } catch {
      return null;
    }
  }

  async put(scope: CacheScope, players: readonly RankedPlayer[]): Promise<void> {
    const packed: Packed[] = players.map(p => [p.hash, p.nickname, p.grade, p.difficulty, p.val, p.secondary, p.correct, p.achievedAt, p.runId]);
    try {
      await this.cache.put(keyOf(this.origin, scope), new Response(JSON.stringify(packed), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${this.ttlSeconds}` },
      }));
    } catch {
      // 캐시 실패는 응답에 영향을 주지 않는다.
    }
  }

  /** 새 기록 하나가 바꾸는 범위: 점수·웨이브(그 학년·전체 학년, 그 난이도), 명예점(그 학년·전체 학년), 각각 전체·그 주. */
  async purgeForRun(run: { grade: number; difficulty: string; weekKey: string }): Promise<void> {
    const scopes: CacheScope[] = [];
    for (const period of ['all', `week:${run.weekKey}`]) {
      for (const grade of [run.grade, 0]) {
        scopes.push({ tab: 'single_score', period, grade, difficulty: run.difficulty });
        scopes.push({ tab: 'best_wave', period, grade, difficulty: run.difficulty });
        scopes.push({ tab: 'honor_points', period, grade, difficulty: '*' });
      }
    }
    await Promise.all(scopes.map(scope => this.cache.delete(keyOf(this.origin, scope)).catch(() => false)));
  }
}

/** RANKING_CACHE_SECONDS(기본 wrangler.toml 60). 0이거나 숫자가 아니면 캐시를 쓰지 않는다. */
export function cacheSeconds(value: string | undefined): number {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 0;
}
