import { describe, expect, it } from 'vitest';
import { NEWGAME_COPY, nickProblemOf } from '../../../src/ui/screens/home/homeCopy';

describe('새 게임 창 닉네임 줄(R5 N1)', () => {
  it('닉네임이 있으면 이름을 보이고 막지 않는다', () => {
    expect(nickProblemOf('하늘바람')).toEqual({ nickname: '하늘바람', problem: null });
    expect(nickProblemOf('  하늘바람  ').nickname).toBe('하늘바람');
  });

  it('비었거나 공백뿐이면 시작을 막는 이유 한 줄을 돌려준다', () => {
    expect(nickProblemOf('')).toEqual({ nickname: '', problem: NEWGAME_COPY.needNickname });
    expect(nickProblemOf('   ').problem).toBe(NEWGAME_COPY.needNickname);
  });

  it('규칙에 어긋나면(1글자·13글자·연락처) 그 규칙 문구를 닉네임 말로 돌려준다', () => {
    for (const bad of ['가', '가나다라마바사아자차카타파', '010-1234-5678', 'a@b.com']) {
      const r = nickProblemOf(bad);
      expect(r.problem, bad).not.toBeNull();
      expect(r.problem, bad).not.toContain('별명');
    }
  });
});
