import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../../src/domain/types';
import { ResultScreen } from '../../../src/ui/screens/ResultScreen';
import { countUpAt, r6WaveChapter, runLog, summarizeR6Run } from '../../../src/ui/screens/resultModel';

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

describe('R6 결과 요약과 복습 편의(WP-C2-03)', () => {
  it('r6WaveChapter는 0~55 범위 웨이브를 10구간 한국어 명칭으로 매핑하고 금지어를 포함하지 않는다', () => {
    expect(r6WaveChapter(0)).toEqual({ index: 1, rangeLabel: '1~5웨이브', name: '아침 햇살' });
    expect(r6WaveChapter(5).index).toBe(1);
    expect(r6WaveChapter(6).index).toBe(2);
    expect(r6WaveChapter(20)).toEqual({ index: 4, rangeLabel: '16~20웨이브', name: '저녁 노을' });
    expect(r6WaveChapter(50)).toEqual({ index: 10, rangeLabel: '46~50웨이브', name: '태양 왕관' });
    expect(r6WaveChapter(65).index).toBe(10);
  });

  it('summarizeR6Run은 1.0.0에서는 null이고 R6에서는 챕터·보스·최고 연속·주력 타워를 퍼센트 없이 요약한다', () => {
    const baseState = {
      config: { balanceVersion: '1.0.0', grade: 3, difficulty: 'Normal', nickname: '다람쥐', contentMode: 'published' },
      completedWave: 12,
      endReason: 'QUIT',
      pt: 4500,
      stats: { correct: 5, wrong: 1, skipped: 0, kills: 40, bossKills: 2, bossLeaks: 0, leaks: 0, goldEarned: 100, ptFromQuestions: 500, ptFromKills: 4000, activeTicks: 100, battleTicks: 100 },
      towers: [
        { id: 1, type: 'rail', attacks: 18 },
        { id: 2, type: 'mortar', attacks: 24 },
      ],
      quiz: {
        history: [
          { id: 1, questionId: 'Q50-G3-001', answer: { correct: true } },
          { id: 2, questionId: 'Q50-G3-002', answer: { correct: true } },
          { id: 3, questionId: 'Q50-G3-003', answer: { correct: false } },
          { id: 4, questionId: 'Q50-G3-004', answer: { correct: true } },
        ],
      },
    } as unknown as RunState;

    expect(summarizeR6Run(baseState)).toBeNull();
    const r6 = summarizeR6Run({ ...baseState, config: { ...baseState.config, balanceVersion: '2.1.0' } })!;
    expect(r6.chapter.name).toBe('구름 능선');
    expect(r6.bossKills).toBe(2);
    expect(r6.maxStreak).toBe(2);
    expect(r6.topTower).toEqual({ type: 'mortar', name: '곡사 포대', attacks: 24 });
    expect(JSON.stringify(r6)).not.toMatch(/percent|rate|ratio/i);

    const html = renderToStaticMarkup(createElement(ResultScreen, {
      state: { ...baseState, config: { ...baseState.config, balanceVersion: '2.0.0' } },
      controller: { getSaveStatus: () => 'saved' as const, subscribe: () => () => undefined, retrySave: vi.fn() },
      onAgain: vi.fn(),
      onHome: vi.fn(),
    }));
    expect(html).toContain('전장 성취 요약');
    expect(html).toContain('곡사 포대');
    expect(html).toContain('순위표 공유가 꺼져 있어 이 기기에만 기록됐어요.');
  });
});
