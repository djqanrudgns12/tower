import { describe, expect, it } from 'vitest';
import { countUpAt, runLog } from '../../../src/ui/screens/resultModel';

const senses: Record<string, string> = { q1: 'a', q2: 'a', q3: 'b' };
const senseOf = (id: string) => senses[id];

describe('결과 이번 판 기록(R5 R1)', () => {
  it('푼 문제는 정답+오답, 모르겠어요는 따로 센다(퍼센트·숙련도 필드가 없다)', () => {
    const r = runLog({ correct: 3, wrong: 1, skipped: 2 }, [{ questionId: 'q1' }, { questionId: 'q3' }], senseOf);
    expect(r.solved).toBe(4);
    expect(r.skipped).toBe(2);
    expect(Object.keys(r).sort()).toEqual(['perfect', 'skipped', 'solved', 'words']);
  });

  it('만난 낱말은 서로 다른 뜻 수다: 같은 뜻의 다른 문항은 한 번, 사라진 문항은 문항 id로', () => {
    const r = runLog({ correct: 4, wrong: 0, skipped: 0 }, [{ questionId: 'q1' }, { questionId: 'q2' }, { questionId: 'q3' }, { questionId: 'gone' }], senseOf);
    expect(r.words).toBe(3);
  });
});

describe('만점 칭찬(R5 R2)', () => {
  it('하나 이상 맞히고 틀린 것도 모르겠어요도 없을 때만', () => {
    expect(runLog({ correct: 5, wrong: 0, skipped: 0 }, [], senseOf).perfect).toBe(true);
    expect(runLog({ correct: 5, wrong: 1, skipped: 0 }, [], senseOf).perfect).toBe(false);
    expect(runLog({ correct: 5, wrong: 0, skipped: 1 }, [], senseOf).perfect).toBe(false);
    expect(runLog({ correct: 0, wrong: 0, skipped: 0 }, [], senseOf).perfect).toBe(false);
  });
});

describe('웨이브 숫자 올라가기(R5 R2)', () => {
  it('0에서 시작해 끝 값에 닿고, 중간 값은 정수로 끝 값을 넘지 않는다', () => {
    expect(countUpAt(9, 0)).toBe(0);
    expect(countUpAt(9, 1)).toBe(9);
    for (let i = 0; i <= 20; i++) {
      const v = countUpAt(9, i / 20);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('올라가기만 하고(단조) 범위 밖 진행도는 잘라 쓴다', () => {
    let prev = -1;
    for (let i = 0; i <= 50; i++) {
      const v = countUpAt(40, i / 50);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(countUpAt(7, -3)).toBe(0);
    expect(countUpAt(7, 4)).toBe(7);
  });
});
