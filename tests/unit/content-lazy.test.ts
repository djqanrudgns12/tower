import { expect, it } from 'vitest';
import * as content from '../../src/content';

it('읽기 전에는 공개 은행 본문이 적재되지 않는다', () => {
  expect(content.gradeContent(5).bank === null).toBe(true);
});

it('요청한 학년만 적재하고 같은 학년의 동시 요청은 같은 은행을 사용한다', async () => {
  expect(content.isGradeAvailable(5)).toBe(true);
  expect(content.gradeLoadState(5)).toBe('unloaded');
  const [first, second] = await Promise.all([content.loadGradeContent(5), content.loadGradeContent(5)]);
  expect(first.bank).toBe(second.bank);
  expect(first.bank?.grade).toBe(5);
  expect(content.gradeLoadState(5)).toBe('ready');
  expect(content.gradeLoadState(6)).toBe('unloaded');
  expect(content.gradeContent(6).bank === null).toBe(true);
  expect(() => content.contextFor(6, 'Normal')).toThrow(content.ContentNotLoadedError);
  expect(content.contextFor(5, 'Normal').questionIds.length).toBeGreaterThan(0);
});
