import { createHash } from 'node:crypto';
import type { SharedBankQuestion } from '../../src/contracts/questions';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value)
    .filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError('은행 판 번호 입력은 JSON 값이어야 한다');
  return encoded;
}

/** 대상 학년과 실제 런타임 필드 전체를 묶는다. 빌드 준비와 서버 키 생성기가 같은 산식을 쓴다. */
export function sharedBankVersion(grade: number, questions: readonly SharedBankQuestion[]): string {
  if (!Number.isInteger(grade) || grade < 3 || grade > 6) throw new RangeError('받는 학년은 3~6학년이어야 한다');
  const sorted = [...questions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return `pub-g${grade}-${createHash('sha256').update(canonical({ grade, questions: sorted })).digest('hex').slice(0, 12)}`;
}
