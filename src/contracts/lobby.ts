import { z } from 'zod';
import { DIFFICULTY_IDS, type DifficultyId } from './balance';

export type TelemetryStatus = 'loading' | 'live' | 'offline' | 'disabled';

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
  /** 인증 사용자 자신의 기록 ID만 서버가 반환한다. */
  runIds: z.array(z.string()).optional(),
  nickname: z.string().min(1).max(4096),
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

/** 공개 별명은 서버 clean_public_nickname과 같은 정규화·차단 규칙을 쓴다. */
export function cleanPublicNickname(raw: string): { value: string; error: string | null } {
  const value = raw.normalize('NFC').normalize('NFKC').replace(/\p{Cc}/gu, '').trim();
  const count = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value)].length;
  if (new TextEncoder().encode(raw).length > 4096 || new TextEncoder().encode(value).length > 4096 || count < 2 || count > 12) return { value, error: '별명은 2~12글자로 써요' };
  if (/[0-9]{6,}|0[0-9]{1,2}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}|@|https?:\/\/|www\.|[^\s@/]+\.[a-z]{2,}(?:\/|$)/iu.test(value)) return { value, error: '전화번호, 이메일, 인터넷 주소 대신 별명을 써요' };
  return { value, error: null };
}

export interface SubmittedAnswer {
  encounterId: number; questionId: string; revision: number; choice: 'a' | 'b' | 'c' | 'd' | 'skipped'; phase: 'prep' | 'battle'; wave: number;
}
export interface AnswerRules { correctPt: number; wrongPt: number; firstPrep: number; laterPrep: number; waveKillPtCap: number; bossPt: number; bossEvery: number }

/** SQL regrade_run_answers와 같은 공개 계약. 키는 서버의 승인 테이블에서 제공한다. */
export function regradeRunAnswers(answers: readonly SubmittedAnswer[], keys: ReadonlyMap<string,string>, rules: AnswerRules, completedWave: number, endedWave: number) {
  if (!Number.isSafeInteger(completedWave) || completedWave < 1 || !Number.isSafeInteger(endedWave) || endedWave < completedWave || endedWave > completedWave+1 || answers.length > 1600) return null;
  let correct=0, wrong=0, skipped=0, questionPt=0, lastId=0, lastWave=0, lastPhase='prep';
  const prep = new Map<number,number>();
  for (const a of answers) {
    if (!Number.isSafeInteger(a.encounterId) || !Number.isSafeInteger(a.wave) || !Number.isSafeInteger(a.revision) || a.revision < 1 || a.encounterId<=lastId || a.wave<Math.max(lastWave,1) || a.wave>endedWave || !['prep','battle'].includes(a.phase) || !['a','b','c','d','skipped'].includes(a.choice) || (a.wave===lastWave && lastPhase==='battle' && a.phase==='prep')) return null;
    if (a.phase==='battle' && prep.get(a.wave)!==(a.wave===1?rules.firstPrep:rules.laterPrep)) return null;
    const key=keys.get(`${a.questionId}@${a.revision}`);
    if (!key) return null;
    if (a.phase==='prep') { const count=(prep.get(a.wave)??0)+1; prep.set(a.wave,count); if (count>(a.wave===1?rules.firstPrep:rules.laterPrep)) return null; }
    if (a.choice==='skipped') skipped++;
    else if (a.choice===key) { correct++; questionPt+=rules.correctPt; }
    else { wrong++; questionPt+=rules.wrongPt; }
    lastId=a.encounterId; lastWave=a.wave; lastPhase=a.phase;
  }
  for (let w=1;w<=completedWave;w++) if (prep.get(w)!==(w===1?rules.firstPrep:rules.laterPrep)) return null;
  return {correct,wrong,skipped,questionPt};
}

export function matchesRegradedRun(claim: { pt: number; correct: number; wrong: number; skipped: number; endedWave: number; activeTicks?: number }, score: ReturnType<typeof regradeRunAnswers>, rules: AnswerRules): boolean {
  if (!score || !Object.values(claim).every(Number.isSafeInteger) || claim.endedWave<1) return false;
  if (claim.activeTicks !== undefined && (claim.activeTicks<0 || claim.correct+claim.wrong+claim.skipped>Math.floor(claim.activeTicks/30)+1)) return false;
  const killPt=claim.pt-score.questionPt;
  return claim.correct===score.correct && claim.wrong===score.wrong && claim.skipped===score.skipped && killPt>=0 && killPt<=claim.endedWave*rules.waveKillPtCap+Math.floor(claim.endedWave/rules.bossEvery)*rules.bossPt;
}
