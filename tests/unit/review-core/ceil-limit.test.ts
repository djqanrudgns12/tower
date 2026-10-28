import { expect, test } from 'vitest';
import { mulDivCeil, NumericLimitError } from '../../../src/domain/num';

// PRD §8.6: "모든 정수 연산 결과에 Number.isSafeInteger 검사를 둔다."
// PRD §20.1: "모든 산술 결과를 Number.isSafeInteger로 검사하는 작은 헬퍼 ... 나눗셈은 몫·나머지를 명시한다."
test('올림 분자의 덧셈이 안전 범위를 넘으면 조용히 잘못 계산하지 않는다', () => {
  // 곱 MAX_SAFE_INTEGER×1은 안전하지만 올림용 +2는 안전하지 않다.
  let result: number | 'NUMERIC_LIMIT';
  try { result = mulDivCeil(Number.MAX_SAFE_INTEGER, 1, 2); }
  catch (error) {
    if (!(error instanceof NumericLimitError)) throw error;
    result = 'NUMERIC_LIMIT';
  }
  // 안전한 몫·나머지 계산으로 정확히 구하거나, 위험한 중간 연산을 감지해 중단해야 한다.
  expect([4503599627370496, 'NUMERIC_LIMIT']).toContain(result);
});
