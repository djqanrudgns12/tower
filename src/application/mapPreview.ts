import { TOWER_IDS, type TowerId } from '../contracts/balance';
import { contextFor, gradeContent, loadGradeContent, MAPS, PILOT_TOWERS } from '../content';
import type { GameContext } from '../domain/context';
import { buildPath } from '../domain/geometry';
import { advanceTick, applyCommand, createRun, type Command } from '../domain/run';
import type { RunState } from '../domain/types';
import { RunController } from './RunController';

// 개발 빌드 전용 맵 미리보기(R3 P3, docs/renewal/prd-r3-phases.md §5.4).
// 4~6학년 문제은행이 아직 후보뿐이라 학생 경로로는 강가·궁궐 뜰·설원에 들어갈 수 없다. 개발 서버에서 `/?previewMap=<맵 id>`로 그 맵의 전투 화면을 바로 연다.
// 문제는 3학년 개발용 은행으로 대신하고, 기록을 남기지 않는 판이다(연습 판과 같다).
// 호출하는 쪽(ui/App.tsx)이 `import.meta.env.DEV`로 감싸므로 운영 빌드에서는 이 모듈과 주소 이름이 번들에서 통째로 빠진다(tests/unit/map-preview.test.ts가 확인한다).
// 원하는 웨이브·형태의 정규 맵 장면은 같은 방식의 QA 장면 로더(application/qaRun.ts, `?qaRun=1`)로 연다.
//   ?previewMap=river_z            그 맵의 첫 준비(문제 풀이) 화면
//   &towers=8                      문제를 건너뛰고 타워 8기(최대 20)를 경로가 잘 보이는 자리부터 세운 배치 단계
//   &wave=17                       웨이브 번호(밤 색조 등 확인용, 기본 1)
//   &ticks=200                     배치 뒤 전투를 시작해 그 틱(30틱=1초)만큼 흘린 상태로 연다(적이 길 위에 있다)

/** 미리보기를 켜는 주소 매개변수 이름. */
export const PREVIEW_PARAM = 'previewMap';
/** 시험·점검용으로 세울 타워 종류(순서대로 돌려 쓴다)와 레벨(순서대로 돌려 쓴다). */
export const SAMPLE_TOWERS: readonly TowerId[] = ['archer', 'cannon', 'frost', 'mage', 'sling', 'spear', 'trap', 'crossbow'];
const SAMPLE_LEVELS = [1, 2, 3] as const;
const PREVIEW_SEED = 20261103;

export interface MapPreviewRequest {
  mapId: string;
  towers: number;
  wave: number;
  ticks: number;
}

/** 주소의 쿼리 문자열에서 미리보기 요청을 읽는다. 없는 맵 id이거나 매개변수가 없으면 null이다. */
export function parseMapPreview(search: string): MapPreviewRequest | null {
  const q = new URLSearchParams(search);
  const map = MAPS.find(m => m.id === q.get(PREVIEW_PARAM));
  if (!map) return null;
  const int = (key: string, fallback: number, max: number) => {
    const raw = q.get(key);
    const v = raw === null ? NaN : Number(raw);
    return Number.isInteger(v) && v >= 0 ? Math.min(v, max) : fallback;
  };
  return { mapId: map.id, towers: int('towers', 0, 20), wave: Math.max(1, int('wave', 1, 120)), ticks: int('ticks', 0, 3000) };
}

const ok = (ctx: GameContext, s: RunState, cmd: Command) => {
  const r = applyCommand(ctx, s, cmd);
  if (!r.ok) throw new Error(`미리보기 명령 거부: ${cmd.type} → ${r.error}`);
};
const ticks = (ctx: GameContext, s: RunState, n: number) => { for (let i = 0; i < n; i++) advanceTick(ctx, s); };

/** 경로를 많이 덮는 빈 자리부터(점검용 배치 순서). */
function slotsByCover(ctx: GameContext): string[] {
  const path = ctx.map.pathCells;
  return [...ctx.map.slots]
    .map(slot => ({ id: slot.id, d: Math.min(...path.map(([x, y]) => (x - slot.x) ** 2 + (y - slot.y) ** 2)), cover: path.filter(([x, y]) => (x - slot.x) ** 2 + (y - slot.y) ** 2 <= 6.25).length }))
    .sort((a, b) => b.cover - a.cover || a.d - b.d || a.id.localeCompare(b.id))
    .map(x => x.id);
}

/** 준비 문제를 모두 맞혀 배치 단계로 가고, 요청대로 웨이브·타워·전투를 맞춘다. 점검 편의로 골드·장착함을 늘렸다가 돌려놓는다. */
function prepare(ctx: GameContext, s: RunState, req: MapPreviewRequest) {
  while (s.phase === 'PREP_QUIZ') {
    const enc = s.quiz.current!;
    ok(ctx, s, { type: 'answer', encounterId: enc.id, choice: ctx.questions.get(enc.questionId)!.correctOptionId });
    ticks(ctx, s, s.quiz.feedback!.autoAdvanceTick! - s.tick);
  }
  s.wave = req.wave;
  s.completedWave = req.wave - 1;
  const realOwned = [...s.owned];
  s.owned = [...TOWER_IDS];
  const order = slotsByCover(ctx);
  for (let i = 0; i < req.towers && i < order.length; i++) {
    s.gold = 1_000_000;
    const type = SAMPLE_TOWERS[i % SAMPLE_TOWERS.length]!, level = SAMPLE_LEVELS[i % SAMPLE_LEVELS.length]!;
    ok(ctx, s, { type: 'build', slotId: order[i]!, tower: type });
    const tower = s.towers.find(t => t.slotId === order[i])!;
    while (tower.level < level) ok(ctx, s, { type: 'upgrade', towerId: tower.id });
    tower.undoUntilTick = null;
  }
  s.owned = realOwned;
  s.gold = 300;
  if (req.ticks > 0) {
    ok(ctx, s, { type: 'startBattle' });
    ticks(ctx, s, req.ticks);
    s.gateHp = s.gateMaxHp;
  }
}

/** 요청대로 맵 미리보기 판을 만든다. 문제는 3학년 개발용 은행이고 맵만 요청한 맵이다. */
export async function startMapPreview(req: MapPreviewRequest, playerId: string): Promise<RunController> {
  const map = MAPS.find(m => m.id === req.mapId);
  if (!map) throw new Error(`미리볼 맵이 없다: ${req.mapId}`);
  await loadGradeContent(3);
  const base = contextFor(3, 'Normal');
  const ctx: GameContext = { ...base, map, path: buildPath(map) };
  const { bank } = gradeContent(3);
  const s = createRun(ctx, {
    runId: `preview-${map.id}-${crypto.randomUUID()}`, playerId, nickname: '미리보기', grade: map.grade, difficulty: 'Normal', mapId: map.id, seed: PREVIEW_SEED,
    bankId: bank!.bankId, bankVersion: bank!.bankVersion, contentMode: 'development', availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal', createdAt: new Date().toISOString(),
  });
  if (req.towers > 0 || req.wave > 1 || req.ticks > 0) prepare(ctx, s, req);
  return new RunController(ctx, s, { recordOnFinish: false });
}

/** 지금 주소에 미리보기 요청이 있으면 그 판을, 없으면 null. 개발 빌드가 아니면 늘 null이다. */
export function mapPreviewFromLocation(playerId: string): Promise<RunController> | null {
  if (!import.meta.env.DEV) return null;
  const req = parseMapPreview(window.location.search);
  return req ? startMapPreview(req, playerId) : null;
}
