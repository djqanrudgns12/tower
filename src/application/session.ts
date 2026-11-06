import type { DifficultyId } from '../contracts/balance';
import { ContentUnavailableError, contextFor, gradeContent, gradeLoadState, PILOT_TOWERS, PRACTICE, PRACTICE_BANK, practiceContext, reviewQuestions } from '../content';
import type { GameContext } from '../domain/context';
import { createRun } from '../domain/run';
import { clearLocalHistory, listRecords, type RunRecord } from '../persistence/db';
import { reportRunStarted } from '../persistence/lobbyClient';
import { listReviewNoteItems, loadReviewNote, reviewSensesForRun, type ReviewDelta, type ReviewNoteItem } from '../persistence/reviewNote';
import {
  BGM_STEPS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  SFX_STEPS,
  type FontScale,
  type MotionMode,
  type Settings,
  type VolumeStepBgm,
  type VolumeStepSfx,
} from '../persistence/settings';
import { RunController } from './RunController';

// 화면은 저장소를 직접 부르지 않고 이 세션 서비스를 쓴다(PRD §13.2).
export type { FontScale, MotionMode, ReviewDelta, ReviewNoteItem, RunRecord, Settings, VolumeStepBgm, VolumeStepSfx };
export { BGM_STEPS, clearLocalHistory, listRecords, loadSettings, normalizeSettings, saveSettings, SFX_STEPS };

export type StartResult = { ok: true; controller: RunController } | { ok: false; message: string };

const NO_QUESTIONS = '지금은 이 학년 문제를 쓸 수 없어요. 기록은 그대로 남아 있어요. 나중에 다시 해 주세요.';

/** 문항이 모두 철회됐으면 판을 열지 않는다(PRD §16.2). 학생 패배로 처리하지 않는다. */
function tryContext(grade: number, difficulty: DifficultyId): GameContext | null {
  try {
    return contextFor(grade, difficulty);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return null;
    throw error;
  }
}

/** 새 정규 판. 판은 메모리에만 있고(이어하기 없음, PRD §14), 끝내기·패배 때만 기록에 남는다. */
export function startNewRun(input: { grade: number; difficulty: DifficultyId; nickname: string; playerId: string }): StartResult {
  const { map, bank } = gradeContent(input.grade);
  if (!bank && gradeLoadState(input.grade) !== 'unavailable') return { ok: false, message: '문제를 불러온 뒤 다시 시작해 주세요.' };
  if (!bank) return { ok: false, message: '이 학년의 문제가 아직 준비되지 않았어요.' };
  const ctx = tryContext(input.grade, input.difficulty);
  if (!ctx) return { ok: false, message: NO_QUESTIONS };
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const state = createRun(ctx, {
    runId: crypto.randomUUID(), playerId: input.playerId, nickname: input.nickname, grade: input.grade, difficulty: input.difficulty, mapId: map.id, seed,
    bankId: bank.bankId, bankVersion: bank.bankVersion, contentMode: bank.status === 'published' ? 'published' : 'development',
    availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal', createdAt: new Date().toISOString(),
    // 판 밖 자료는 여기서 한 번만 읽어 RunState에 복사한다. 판 안의 출제는 이 복사본만 본다(결정성, A18).
    reviewSenses: reviewSensesForRun(loadReviewNote(), bank.bankId, ctx.questions),
  });
  void reportRunStarted(state.config.runId, input.playerId).catch(() => undefined);
  return { ok: true, controller: new RunController(ctx, state, { recordOnFinish: true }) };
}

/**
 * 같은 학년·난이도로 끝낸 판 중 가장 높은 지킨 웨이브(prd-r4 §7.2-F 최고 기록 선). 1웨이브도 못 지킨 기록은 견줄 기록으로 세지 않는다.
 * 기록이 없으면 null. 연습 판은 기록이 없다.
 */
export function bestWaveOf(records: readonly Pick<RunRecord, 'grade' | 'difficulty' | 'completedWave'>[], grade: number, difficulty: string): number | null {
  let best = 0;
  for (const r of records) if (r.grade === grade && r.difficulty === difficulty && r.completedWave > best) best = r.completedWave;
  return best >= 1 ? best : null;
}

/** 판을 열 때 한 번 읽는 이 기기의 최고 기록(그 판 전까지). 저장소를 열 수 없으면 기록이 없는 것으로 본다. */
export async function bestWaveFor(grade: number, difficulty: DifficultyId): Promise<number | null> {
  try {
    return bestWaveOf(await listRecords(), grade, difficulty);
  } catch {
    return null;
  }
}

/** 이 학년 은행의 오답 노트 항목(R4 §6.1). 철회·다른 은행 항목은 걸러진다. 화면은 저장소를 직접 부르지 않는다(PRD §13.2). */
export function reviewNoteItems(grade: number): ReviewNoteItem[] {
  const { bank } = gradeContent(grade);
  return bank ? listReviewNoteItems(loadReviewNote(), bank.bankId, reviewQuestions(grade)) : [];
}

/**
 * 첫 연습 판(PRD §12.2). 기록을 남기지 않는다. 고정 seed라 정규 판의 seed·점수·첫 5문항에 영향이 없다.
 */
export function startPractice(playerId: string): RunController {
  const ctx = practiceContext();
  const state = createRun(ctx, {
    runId: `practice-${crypto.randomUUID()}`, playerId, nickname: '연습', grade: PRACTICE.grade, difficulty: PRACTICE.difficulty,
    mapId: ctx.map.id, seed: PRACTICE.seed, bankId: PRACTICE_BANK.bankId, bankVersion: PRACTICE_BANK.bankVersion,
    contentMode: 'development', availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal', createdAt: new Date().toISOString(),
  });
  return new RunController(ctx, state, { recordOnFinish: false });
}
