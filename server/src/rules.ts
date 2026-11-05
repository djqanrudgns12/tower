import { z } from 'zod';
import type { AnswerRules } from '../../src/contracts/lobby';

const int = z.number().int().refine(Number.isSafeInteger);

/** run_verification_rules.rules(JSON). tools/build-question-keys.mjs가 balance 계약에서 만든다. */
const verificationRulesSchema = z.object({
  correctPt: int,
  wrongPt: int,
  waveKillPtCap: int,
  bossPt: int,
  bossEvery: int.min(1),
  firstPrep: int,
  laterPrep: int,
  countBase: int,
  countStep: int,
  countEvery: int.min(1),
  countMax: int,
  spawnOverrides: z.record(z.string(), int),
  spawnMin: int,
  spawnBase: int,
  spawnStep: int,
});

export type VerificationRules = z.infer<typeof verificationRulesSchema> & AnswerRules;

export function parseVerificationRules(text: string): VerificationRules {
  return verificationRulesSchema.parse(JSON.parse(text));
}

/** Postgres submit_completed_run의 웨이브별 최소 출현 시간 합(ms). 나눗셈은 정수 나눗셈이다. */
export function minimumDurationMs(rules: VerificationRules, completedWave: number): number {
  let total = 0;
  for (let w = 1; w <= completedWave; w++) {
    const count = Math.min(rules.countMax, rules.countBase + Math.trunc((w - 1) / rules.countEvery) * rules.countStep);
    const interval = rules.spawnOverrides[String(w)] ?? Math.max(rules.spawnMin, rules.spawnBase + (w - 1) * rules.spawnStep);
    total += (count - 1) * interval;
  }
  return total;
}
