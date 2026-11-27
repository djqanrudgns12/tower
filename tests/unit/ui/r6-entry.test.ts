import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { bestWaveFor, loadSettings, normalizeSettings, startNewRun } from '../../../src/application/session';
import { buildRunRecord } from '../../../src/application/runRecord';
import { loadGradeContent } from '../../../src/content';
import { db } from '../../../src/persistence/db';

describe('R6 새 게임', () => {
  it('4학년 문제를 초원 고원에서 진행하고 같은 밸런스 판의 최고 기록만 비교한다', async () => {
    const { bank } = await loadGradeContent(4);
    const result = await startNewRun({ grade: 4, difficulty: 'Hard', playerId: 'r6-test', nickname: '바람지도' });
    if (!result.ok) throw Error(result.message);
    const { controller } = result;
    try {
      expect(controller.state.config).toMatchObject({
        grade: 4, difficulty: 'Hard', mapId: 'garden_u', balanceVersion: '2.0.0', bankId: bank!.bankId,
      });
      expect(controller.state.owned).toEqual(['rail', 'mortar', 'cryo']);
      expect(controller.ctx.balance.r6?.rules.levels.max).toBe(20);
      const record = buildRunRecord(controller.state);
      const database = await db();
      await database.put('records', { ...record, completedWave: 6 });
      await database.put('records', { ...record, runId: 'old-run', balanceVersion: '1.0.0', completedWave: 15 });
      expect(await bestWaveFor(4, 'Hard', '2.0.0')).toBe(6);
      expect(await bestWaveFor(4, 'Hard', '1.0.0')).toBe(15);
    } finally {
      controller.dispose();
    }
  });
});

describe('밝은 화면 설정', () => {
  it('기본 저장본은 밝게 열고, 다른 설정을 바꿔도 어두운 화면 선택을 유지한다', () => {
    const initial = loadSettings();
    expect(initial.lightTheme).toBe(true);
    const dark = normalizeSettings(initial, { lightTheme: false });
    expect(normalizeSettings(dark, { fontScale: 'xlarge' }).lightTheme).toBe(false);
    expect(normalizeSettings(dark, { lightTheme: true }).lightTheme).toBe(true);
  });
});
