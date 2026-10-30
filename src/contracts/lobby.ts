import { z } from 'zod';
import { DIFFICULTY_IDS, type DifficultyId } from './balance';

export type TelemetryStatus = 'loading' | 'live' | 'offline';

export interface TelemetrySnapshot {
  status: TelemetryStatus;
  onlineNow: number | null;
  todayPlays: number;
  totalVisitors: number | null;
  totalPlays: number;
  updatedAtIso: string | null;
}

export const RANKING_TAB_IDS = ['single_score', 'honor_points', 'best_wave', 'local_device'] as const;
export type RankingTabId = (typeof RANKING_TAB_IDS)[number];

export const RANKING_PERIODS = ['weekly', 'season1', 'all_time'] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number];

export interface RankingQuery {
  tab: RankingTabId;
  grade: 3 | 4 | 5 | 6 | 'all';
  difficulty: DifficultyId;
  period: RankingPeriod;
  limit: 8 | 50;
  offset: number;
}

export const rankingEntrySchema = z.object({
  rank: z.number().int().min(1),
  playerIdHash: z.string().min(1),
  isMe: z.boolean(),
  nickname: z.string().min(1).max(24),
  grade: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  difficulty: z.enum(DIFFICULTY_IDS),
  primaryValue: z.number().int(),
  secondaryLabel: z.string(),
  achievedAtIso: z.string(),
});

export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export const rankingSliceResponseSchema = z.object({
  entries: z.array(rankingEntrySchema),
  totalCount: z.number().int().min(0),
  myEntry: rankingEntrySchema.nullable(),
});

export interface RankingResponse {
  source: 'remote' | 'local_fallback';
  entries: readonly RankingEntry[];
  totalCount: number;
  myEntry: RankingEntry | null;
}

export const lobbyVisitResponseSchema = z.object({
  todayPlays: z.number().int().min(0),
  totalVisitors: z.number().int().min(0),
  totalPlays: z.number().int().min(0),
  updatedAtIso: z.string(),
});

export interface SteleCardItem {
  questionId: string;
  lemma: string;
  glyph: string;
  partOfSpeech: string;
  gradeLabel: string;
  levelLabel: string;
  meaning: string;
  explanation: string;
  examplePrefix: string;
  exampleHighlight: string;
  exampleSuffix: string;
}

const HONOR_MULTIPLIER_PERCENT: Record<DifficultyId, number> = {
  Easy: 80,
  Normal: 100,
  Hard: 125,
  Crazy: 150,
};

/**
 * 원정 명예점 정수 산식(랜딩 PRD §2.6).
 * 1웨이브 이상 지킨 정규 판만 인정하며, 부동소수점 없이 정수 나눗셈만 쓴다.
 */
export function computeHonorPoints(input: {
  pt: number;
  difficulty: string;
  completedWave: number;
  correct: number;
}): number {
  if (input.completedWave < 1) return 0;
  const mult = HONOR_MULTIPLIER_PERCENT[input.difficulty as DifficultyId] ?? 100;
  const positivePt = Math.max(0, Math.trunc(input.pt));
  const waveBonus = Math.trunc(input.completedWave) * 15;
  const correctBonus = Math.max(0, Math.trunc(input.correct)) * 2;
  const raw = Math.trunc((positivePt * mult) / 100) + waveBonus + correctBonus;
  return Math.min(5000, Math.max(0, raw));
}

/** 한국 표준시(Asia/Seoul, UTC+9) 기준 YYYY-MM-DD 날짜 문자열. */
export function kstDateKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 한국 표준시 기준 ISO 8601 주차 문자열(예: 2026-W44). DB의 IYYY-"W"IW와 일치한다. */
export function kstIsoWeekKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const target = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
