import { describe, expect, it } from 'vitest';
import { bestWaveOf } from '../../../src/application/session';
import { bestLine, resultHeadline } from '../../../src/ui/copy';

const rec = (grade: number, difficulty: string, completedWave: number) => ({ grade, difficulty, completedWave });

describe('이 기기 최고 기록(prd-r4 §7.2-F)', () => {
  it('같은 학년·난이도 기록 중 가장 높은 지킨 웨이브', () => {
    const records = [rec(3, 'Normal', 9), rec(3, 'Normal', 18), rec(3, 'Hard', 25), rec(4, 'Normal', 30), rec(3, 'Normal', 12)];
    expect(bestWaveOf(records, 3, 'Normal')).toBe(18);
    expect(bestWaveOf(records, 3, 'Hard')).toBe(25);
    expect(bestWaveOf(records, 4, 'Normal')).toBe(30);
  });
  it('기록이 없거나 1웨이브도 못 지킨 기록뿐이면 null', () => {
    expect(bestWaveOf([], 3, 'Normal')).toBeNull();
    expect(bestWaveOf([rec(3, 'Hard', 12)], 3, 'Normal')).toBeNull();
    expect(bestWaveOf([rec(3, 'Normal', 0)], 3, 'Normal')).toBeNull();
  });
});

describe('상태 카드 최고 기록 한 줄', () => {
  // 최고 기록 18. 지금 웨이브 W(진행 중), 지킨 웨이브 C = W−1.
  const at = (best: number | null, wave: number) => bestLine(best, wave, Math.max(0, wave - 1));

  it('최고 기록이 없으면 아무것도 보이지 않는다', () => {
    expect(at(null, 1)).toBeNull();
    expect(at(null, 30)).toBeNull();
  });
  it('멀리 있으면 작게 "최고 18"', () => {
    expect(at(18, 1)).toEqual({ kind: 'best', text: '최고 18' });
    expect(at(18, 16)).toEqual({ kind: 'best', text: '최고 18' });
  });
  it('2웨이브 전부터 "최고 기록까지 N"(N = 최고 − 지금 + 1)', () => {
    expect(at(18, 17)).toEqual({ kind: 'chase', text: '최고 기록까지 2' });
    expect(at(18, 18)).toEqual({ kind: 'chase', text: '최고 기록까지 1' });
  });
  it('최고 기록을 채운 웨이브(지금 19, 지킨 18)는 아직 새 기록이 아니다', () => {
    expect(at(18, 19)).toEqual({ kind: 'best', text: '최고 18' });
  });
  it('지킨 웨이브가 최고 기록을 넘으면 "새 기록!"', () => {
    expect(bestLine(18, 20, 19)).toEqual({ kind: 'new', text: '새 기록!' });
    expect(bestLine(18, 40, 39)).toEqual({ kind: 'new', text: '새 기록!' });
  });
  it('최고 기록이 1~2면 첫 웨이브부터 따라잡기 문구', () => {
    expect(at(1, 1)).toEqual({ kind: 'chase', text: '최고 기록까지 1' });
    expect(at(2, 1)).toEqual({ kind: 'chase', text: '최고 기록까지 2' });
  });
  it('좁은 카드용 짧은 말은 "기록까지 N"만 줄이고 나머지는 그대로', () => {
    expect(bestLine(18, 17, 16, true)).toEqual({ kind: 'chase', text: '기록까지 2' });
    expect(bestLine(18, 5, 4, true)).toEqual({ kind: 'best', text: '최고 18' });
    expect(bestLine(18, 20, 19, true)).toEqual({ kind: 'new', text: '새 기록!' });
  });
  it('웨이브 0(준비 전)은 1로 센다', () => {
    expect(bestLine(2, 0, 0)).toEqual({ kind: 'chase', text: '최고 기록까지 2' });
  });
});

describe('결과 첫 줄', () => {
  const head = (completedWave: number, previousBest: number | null, endReason: 'DEFEAT' | 'QUIT' | null = 'DEFEAT') =>
    resultHeadline({ endReason, completedWave, previousBest });

  it('최고 기록을 넘으면 새 최고 기록', () => {
    expect(head(19, 18)).toEqual({ kind: 'newBest', text: '새 최고 기록이에요!' });
    expect(head(3, 2, 'QUIT').kind).toBe('newBest');
  });
  it('이전 기록이 없고 1웨이브 이상 지켰으면 새 최고 기록, 0웨이브면 기존 줄', () => {
    expect(head(5, null).kind).toBe('newBest');
    expect(head(0, null)).toEqual({ kind: 'defeat', text: '성문이 무너졌어요' });
  });
  it('1~2웨이브 모자라게 지면 아까운 패배', () => {
    expect(head(17, 18)).toEqual({ kind: 'nearMiss', text: '아까워요! 최고 기록까지 1웨이브' });
    expect(head(16, 18)).toEqual({ kind: 'nearMiss', text: '아까워요! 최고 기록까지 2웨이브' });
  });
  it('3웨이브 이상 모자라거나 같으면 기존 패배 줄', () => {
    expect(head(15, 18)).toEqual({ kind: 'defeat', text: '성문이 무너졌어요' });
    expect(head(18, 18)).toEqual({ kind: 'defeat', text: '성문이 무너졌어요' });
  });
  it('스스로 끝낸 판은 아까운 패배가 아니라 기존 마침 줄', () => {
    expect(head(17, 18, 'QUIT')).toEqual({ kind: 'ended', text: '이번 판을 마쳤어요' });
  });
});
