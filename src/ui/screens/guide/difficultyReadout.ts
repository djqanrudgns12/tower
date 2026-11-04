import { BALANCE, DIFFICULTY_GATE } from '../../../content';
import type { Balance, DifficultyId } from '../../../contracts/balance';
import type { DifficultyGate } from '../../../domain/context';
import { correctGoldAt } from '../../../domain/run';
import { DIFFICULTY_COPY } from '../../copy';

/**
 * 난이도 판독 한 줄(R5 G5·N3): 성문 체력 · 첫 웨이브 정답 골드 · 나오는 낱말 범위.
 * 설명서 4장 시연과 새 게임 창이 같은 함수를 쓴다. 수치는 balance 계약, 범위는 출제 문턱(product.defaults questionSelection.difficultyGate)에서만 읽는다.
 */
export interface DifficultyReadout {
  id: DifficultyId;
  /** 난이도 이름(쉬움·보통·어려움·아주 어려움). */
  label: string;
  gateHp: number;
  /** 첫 웨이브 정답 1회 골드(연속 정답 보너스 제외). */
  correctGold: number;
  /** 웨이브가 오를수록 정답 골드가 늘어나는가(correctGoldPerWaveBP > 0). */
  goldGrows: boolean;
  /** 속담·관용구·방언이 나오는가. */
  advanced: boolean;
  /** 낱말 범위 글: '교과 표준 낱말' 또는 '교과 낱말 + 속담·관용구·방언'. */
  scope: string;
  /** 칸으로 나눠 보일 때: ['성문 15', '정답 +19골드부터', '교과 표준 낱말']. */
  parts: readonly [string, string, string];
  /** 한 줄로 보일 때: parts를 ' · '로 이은 글. */
  line: string;
}

export function difficultyReadout(id: DifficultyId, balance: Balance = BALANCE, gate: DifficultyGate = DIFFICULTY_GATE): DifficultyReadout {
  const d = balance.difficulties[id];
  const variants = gate[id].allowedVariants;
  const advanced = variants.includes('idiom_proverb') || variants.includes('dialect');
  const goldGrows = (d.correctGoldPerWaveBP ?? 0) > 0;
  const correctGold = correctGoldAt(d, 1);
  const scope = advanced ? '교과 낱말 + 속담·관용구·방언' : '교과 표준 낱말';
  const parts = [`성문 ${d.gateHp}`, `정답 +${correctGold}골드${goldGrows ? '부터' : ''}`, scope] as const;
  return { id, label: DIFFICULTY_COPY[id].label, gateHp: d.gateHp, correctGold, goldGrows, advanced, scope, parts, line: parts.join(' · ') };
}
