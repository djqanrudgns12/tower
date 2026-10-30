import type { DifficultyId } from '../contracts/balance';
import { ContentUnavailableError, contextFor, gradeContent, PILOT_TOWERS, PRACTICE, PRACTICE_BANK, practiceContext } from '../content';
import type { GameContext } from '../domain/context';
import { createRun } from '../domain/run';
import type { RunState } from '../domain/types';
import { clearLocalHistory, clearSnapshot, listRecords, type RunRecord } from '../persistence/db';
import { reportRunStarted } from '../persistence/lobbyClient';
import { acquireRunLock, locksSupported } from '../persistence/ownership';
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
export type { FontScale, MotionMode, RunRecord, Settings, VolumeStepBgm, VolumeStepSfx };
export { BGM_STEPS, clearLocalHistory, listRecords, loadSettings, normalizeSettings, saveSettings, SFX_STEPS };

export type StartResult = { ok: true; controller: RunController; warning: string | null } | { ok: false; message: string };

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

async function own(state: RunState): Promise<StartResult> {
  const ctx = tryContext(state.config.grade, state.config.difficulty);
  if (!ctx) return { ok: false, message: NO_QUESTIONS };
  const supported = locksSupported();
  const ownership = supported ? await acquireRunLock() : null;
  if (supported && !ownership) return { ok: false, message: '다른 창에서 이 게임을 하고 있어요. 그 창을 닫고 다시 눌러 주세요.' };
  return { ok: true, controller: new RunController(ctx, state, { ownership, recordOnFinish: true }), warning: null };
}

export function startNewRun(input: { grade: number; difficulty: DifficultyId; nickname: string; playerId: string }): Promise<StartResult> {
  const { map, bank } = gradeContent(input.grade);
  if (!bank) return Promise.resolve({ ok: false, message: '이 학년의 문제가 아직 준비되지 않았어요.' });
  const ctx = tryContext(input.grade, input.difficulty);
  if (!ctx) return Promise.resolve({ ok: false, message: NO_QUESTIONS });
  void clearSnapshot().catch(() => undefined);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const state = createRun(ctx, {
    runId: crypto.randomUUID(), playerId: input.playerId, nickname: input.nickname, grade: input.grade, difficulty: input.difficulty, mapId: map.id, seed,
    bankId: bank.bankId, bankVersion: bank.bankVersion, contentMode: bank.status === 'published' ? 'published' : 'development',
    availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal', createdAt: new Date().toISOString(),
  });
  return own(state).then(res => {
    if (res.ok) void reportRunStarted(state.config.runId, input.playerId).catch(() => undefined);
    return res;
  });
}

/**
 * 첫 연습 판(PRD §12.2). 저장·기록·소유권 없이 메모리에서만 돈다. 고정 seed라 정규 판의 seed·점수·첫 5문항에 영향이 없다.
 */
export function startPractice(playerId: string): RunController {
  const ctx = practiceContext();
  const state = createRun(ctx, {
    runId: `practice-${crypto.randomUUID()}`, playerId, nickname: '연습', grade: PRACTICE.grade, difficulty: PRACTICE.difficulty,
    mapId: ctx.map.id, seed: PRACTICE.seed, bankId: PRACTICE_BANK.bankId, bankVersion: PRACTICE_BANK.bankVersion,
    contentMode: 'development', availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal', createdAt: new Date().toISOString(),
  });
  return new RunController(ctx, state, { ownership: null, recordOnFinish: false });
}
