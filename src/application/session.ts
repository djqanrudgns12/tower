import type { DifficultyId } from '../contracts/balance';
import { ContentUnavailableError, contextFor, gradeContent, PILOT_TOWERS, PRACTICE, PRACTICE_BANK, practiceContext } from '../content';
import type { GameContext } from '../domain/context';
import { createRun } from '../domain/run';
import { RULES_VERSION, RUN_STATE_VERSION, type PauseReason, type RunState } from '../domain/types';
import { clearLocalHistory, clearSnapshot, listRecords, loadSnapshot, type LoadResult, type RunRecord } from '../persistence/db';
import { reportRunStarted } from '../persistence/lobbyClient';
import { acquireRunLock, locksSupported } from '../persistence/ownership';
import { loadReviewNote, reviewSensesForRun } from '../persistence/reviewNote';
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
export type { FontScale, LoadResult, MotionMode, RunRecord, Settings, VolumeStepBgm, VolumeStepSfx };
export { BGM_STEPS, clearLocalHistory, listRecords, loadSettings, normalizeSettings, saveSettings, SFX_STEPS };

export type StartResult = { ok: true; controller: RunController; warning: string | null } | { ok: false; message: string };
export type SavedRun = Extract<LoadResult, { kind: 'ok' }>;

const NO_QUESTIONS = '지금은 이 학년 문제를 쓸 수 없어요. 기록은 그대로 남아 있어요. 나중에 다시 해 주세요.';
const OTHER_TAB = '다른 창에서 이 게임을 하고 있어요. 그 창을 닫고 다시 눌러 주세요.';
/** Web Locks가 없거나 저장소를 쓸 수 없는 브라우저(PRD §14 소유권, §16.2 브라우저 저장 차단). 시작 전에 알린다. */
export const NO_SAVE_NOTICE = '이 브라우저에서는 저장되지 않아요. 창을 닫으면 처음부터 해야 해요.';
export const CORRUPT_SAVE_NOTICE = '저장된 판이 손상되어 이어할 수 없어요. 새 게임을 시작하면 지금까지의 기록은 그대로 남아요.';
const VERSION_CHANGED = '게임이 바뀌어서 저장된 판은 이어할 수 없어요. 지금까지의 기록은 그대로 남아 있어요. 새 게임을 시작해 주세요.';
const SAVED_EXISTS = '저장된 판이 있어요. 이어하기와 새 게임 중에서 골라 주세요.';

/** 이 브라우저가 판을 저장하고 이어할 수 있는지. 홈이 시작 전에 안내하고 이어하기를 끌 때 쓴다. */
export const saveSupported = (): boolean => locksSupported();

/** 홈이 이어하기·손상 안내를 고를 때 쓴다. 저장소를 열 수 없으면 거부된다. */
export function loadSaved(): Promise<LoadResult> {
  return loadSnapshot();
}

/** 문항이 모두 철회됐으면 판을 열지 않는다(PRD §16.2). 학생 패배로 처리하지 않는다. */
function tryContext(grade: number, difficulty: DifficultyId): GameContext | null {
  try {
    return contextFor(grade, difficulty);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return null;
    throw error;
  }
}

/**
 * 판을 연다. 소유권(Web Locks)을 얻은 뒤에만 이전 저장을 비운다. 다른 탭이 쥔 판의 저장을 지우지 않기 위해서다.
 * 저장소를 비우지 못하면 저장 차단으로 보고 자동 저장 없이 열고 시작 전에 알린다.
 */
async function own(state: RunState, opts: { seq: number; clearSaved: boolean }): Promise<StartResult> {
  const ctx = tryContext(state.config.grade, state.config.difficulty);
  if (!ctx) return { ok: false, message: NO_QUESTIONS };
  if (!locksSupported()) {
    return { ok: true, controller: new RunController(ctx, state, { ownership: null, recordOnFinish: true }), warning: NO_SAVE_NOTICE };
  }
  const ownership = await acquireRunLock();
  if (!ownership) return { ok: false, message: OTHER_TAB };
  let storageOk = true;
  if (opts.clearSaved) {
    try {
      await clearSnapshot();
    } catch {
      storageOk = false;
    }
  }
  const controller = new RunController(ctx, state, { saveSeq: opts.seq, ownership, recordOnFinish: true, autosave: storageOk });
  return { ok: true, controller, warning: storageOk ? null : NO_SAVE_NOTICE };
}

/**
 * 새 정규 판. 저장된 판이 있으면 조용히 지우지 않는다. 홈이 이어하기·새 게임을 보여 주고 학생이 새 게임을 고른 경우에만
 * `replaceSaved: true`로 불러 이전 저장을 바꾼다(PRD §12.2, §14.1 한 기기 활성 판 1개).
 */
export async function startNewRun(input: { grade: number; difficulty: DifficultyId; nickname: string; playerId: string; replaceSaved?: boolean }): Promise<StartResult> {
  const { map, bank } = gradeContent(input.grade);
  if (!bank) return { ok: false, message: '이 학년의 문제가 아직 준비되지 않았어요.' };
  const ctx = tryContext(input.grade, input.difficulty);
  if (!ctx) return { ok: false, message: NO_QUESTIONS };
  if (!input.replaceSaved) {
    const existing = await loadSnapshot().catch(() => null);
    if (existing?.kind === 'ok') return { ok: false, message: SAVED_EXISTS };
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const state = createRun(ctx, {
    runId: crypto.randomUUID(), playerId: input.playerId, nickname: input.nickname, grade: input.grade, difficulty: input.difficulty, mapId: map.id, seed,
    bankId: bank.bankId, bankVersion: bank.bankVersion, contentMode: bank.status === 'published' ? 'published' : 'development',
    availableTowers: [...PILOT_TOWERS], rankingEligibility: 'personal', createdAt: new Date().toISOString(),
    // 판 밖 자료는 여기서 한 번만 읽어 RunState에 복사한다. 판 안의 출제는 이 복사본만 본다(결정성, A18).
    reviewSenses: reviewSensesForRun(loadReviewNote(), bank.bankId, ctx.questions),
  });
  const res = await own(state, { seq: 0, clearSaved: true });
  if (res.ok) void reportRunStarted(state.config.runId, input.playerId).catch(() => undefined);
  return res;
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

/**
 * 저장된 판을 이어할 수 없는 이유. 없으면 null.
 * 시작 때의 규칙·밸런스·맵·은행 버전이 그대로여야 하고(PRD §14.2), 저장할 수 있는 브라우저여야 한다(§14 소유권).
 */
export function resumeBlocker(saved: SavedRun): string | null {
  if (!locksSupported()) return NO_SAVE_NOTICE;
  const state = saved.state;
  const { bank } = gradeContent(state.config.grade);
  const ctx = tryContext(state.config.grade, state.config.difficulty);
  if (!ctx) return NO_QUESTIONS;
  if (
    state.v !== RUN_STATE_VERSION ||
    state.config.rulesVersion !== RULES_VERSION ||
    ctx.balance.balanceVersion !== state.config.balanceVersion ||
    ctx.map.mapVersion !== state.config.mapVersion ||
    !bank || bank.bankId !== state.config.bankId || bank.bankVersion !== state.config.bankVersion
  ) {
    return VERSION_CHANGED;
  }
  return null;
}

/** 지난 세션의 정지 이유는 버리고 RESTORED로 시작한다. 수치 한계는 상태 자체의 문제라 그대로 둔다. */
const CARRIED_PAUSE: readonly PauseReason[] = ['NUMERIC_LIMIT'];

/** 시작 때의 버전이 그대로일 때만 이어한다(PRD §14.2). 재개는 정지 상태로 시작하고 학생이 ‘계속’을 누른다(§3.6, §14.1). */
export async function resumeRun(saved: SavedRun): Promise<StartResult> {
  const blocked = resumeBlocker(saved);
  if (blocked) return { ok: false, message: blocked };
  const state = structuredClone(saved.state);
  state.pause = [...state.pause.filter(r => CARRIED_PAUSE.includes(r)), 'RESTORED'];
  return own(state, { seq: saved.seq, clearSaved: false });
}
