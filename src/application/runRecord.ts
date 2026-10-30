import type { RunState } from '../domain/types';
import type { RunRecord } from '../persistence/db';

/** 끝난 판에서 개인 기록·공개 제출에 쓸 기록을 만든다(PRD §2.2, §15.1). RunController와 공개 제출이 같은 모양을 쓴다. */
export function buildRunRecord(s: RunState, endedAt: Date = new Date()): RunRecord {
  return {
    runId: s.config.runId, nickname: s.config.nickname, grade: s.config.grade, difficulty: s.config.difficulty, mapId: s.config.mapId,
    pt: s.pt, completedWave: s.completedWave, endedAtWave: s.endedAtWave ?? s.wave, correct: s.stats.correct, wrong: s.stats.wrong, skipped: s.stats.skipped,
    endedAt: endedAt.toISOString(), endReason: s.endReason ?? 'QUIT', contentMode: s.config.contentMode, balanceVersion: s.config.balanceVersion, bankVersion: s.config.bankVersion,
  };
}
