import raw from '../../docs/contracts/balance.v2.json';
import { BALANCE, MAPS, PILOT_TOWERS, contextFor, gradeContent } from '../content';
import { loadR6Theme } from '../content/theme';
import type { DifficultyId } from '../contracts/balance';
import { R6_TOWERS, balanceV2Schema } from '../contracts/balanceV2';
import { buildPath } from '../domain/geometry';
import { compileR6Balance } from '../domain/r6Balance';
import { createRun, type NewRunInput } from '../domain/run';

function loadR6() {
  const rules = balanceV2Schema.parse(raw);
  const map = MAPS.find((m) => m.id === rules.prototypeMap);
  if (!map) throw new Error('R6 지도 좌표가 없습니다');
  return { balance: compileR6Balance(BALANCE, rules), map, path: buildPath(map), theme: loadR6Theme(rules) };
}
let cached: ReturnType<typeof loadR6> | undefined;

export type LocalBalanceVersion = '1.0.0' | '2.0.0';

export function getR6Battle() {
  return cached ??= loadR6();
}

export function localBalanceContext(
  version: LocalBalanceVersion,
  grade: number,
  difficulty: DifficultyId,
  source = contextFor(grade, difficulty),
) {
  if (version === '1.0.0') return source;
  if (version !== '2.0.0') throw new Error('지원하지 않는 밸런스 판입니다');
  const { map, path, balance } = getR6Battle();
  return { ...source, map, path, balance, difficulty: balance.difficulties[difficulty], questionGrade: grade };
}

/** 로컬 전장과 시연용 진입점. 학년별 문제·읽기 기준을 유지하고 판별로 지도와 장착함을 고른다. */
export function localBalanceSession(
  version: LocalBalanceVersion,
  grade: number,
  difficulty: DifficultyId,
  input: Omit<
    NewRunInput,
    'grade' | 'difficulty' | 'availableTowers' | 'mapId' | 'bankId' | 'bankVersion' | 'contentMode'
  >,
  source?: ReturnType<typeof contextFor>,
) {
  const ctx = localBalanceContext(version, grade, difficulty, source);
  const bank = gradeContent(grade).bank!;
  const common = {
    ...input,
    grade,
    difficulty,
    bankId: bank.bankId,
    bankVersion: bank.bankVersion,
    contentMode: bank.status === 'published' ? ('published' as const) : ('development' as const),
  };
  if (version === '1.0.0')
    return {
      version,
      ctx,
      state: createRun(ctx, { ...common, mapId: ctx.map.id, availableTowers: [...PILOT_TOWERS] }),
    };
  return { version, ctx, theme: getR6Battle().theme, state: createRun(ctx, { ...common, mapId: ctx.map.id, availableTowers: [...R6_TOWERS] }) };
}
