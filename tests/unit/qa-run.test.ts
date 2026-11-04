import { afterEach, describe, expect, it, vi } from 'vitest';
import { QA_RUN_KEY, QA_RUN_PARAM, qaRunFromLocation, startQaRun } from '../../src/application/qaRun';
import { RUN_STATE_VERSION } from '../../src/domain/types';
import { answerCurrent, newRun } from './helpers';

// 개발 빌드 전용 QA 장면 로더(src/application/qaRun.ts). 이어하기가 없으므로 화면 점검 장비·e2e가 원하는 장면으로 들어가는 길이다.
// 운영 번들에 없다는 검사는 map-preview.test.ts의 빌드 검사가 함께 한다.

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

/** 정답 하나를 낸 뒤 숨김·성능 정지로 멈춘 판의 상태 JSON. */
function sceneJson() {
  const { ctx, s } = newRun('Normal', 31);
  answerCurrent(ctx, s, 'correct');
  s.pause = ['HIDDEN', 'PERFORMANCE'];
  return JSON.stringify(s);
}

describe('QA 장면 로더', () => {
  it('상태 JSON 그대로(골드·문항·기록) 정지된 판을 열고, 지난 정지 이유는 학생 정지 하나로 바꾼다', () => {
    const json = sceneJson();
    const c = startQaRun(json);
    expect(c.state.pause).toEqual(['USER']);
    expect({ ...c.state, pause: [] }).toEqual({ ...JSON.parse(json), pause: [] });
    expect(c.state.stats.correct).toBe(1);
    c.resume();
    expect(c.state.pause).toEqual([]);
    c.dispose();
  });

  it('수치 한계 정지는 상태 자체의 문제라 그대로 남긴다', () => {
    const { s } = newRun('Normal', 32);
    s.pause = ['NUMERIC_LIMIT', 'HIDDEN'];
    const c = startQaRun(JSON.stringify(s));
    expect(c.state.pause).toEqual(['NUMERIC_LIMIT', 'USER']);
    c.dispose();
  });

  it('지금 코드와 상태 버전이 다르면 열지 않는다', () => {
    const { s } = newRun('Normal', 33);
    expect(() => startQaRun(JSON.stringify({ ...s, v: RUN_STATE_VERSION - 1 }))).toThrow(/버전이 다르다/);
  });

  it('개발 빌드에서는 `?qaRun=1`과 sessionStorage 상태로 열고, 매개변수가 없으면 null, 상태가 없으면 던진다', () => {
    const json = sceneJson();
    const store = new Map<string, string>([[QA_RUN_KEY, json]]);
    vi.stubGlobal('window', { location: { search: `?${QA_RUN_PARAM}=1` }, sessionStorage: { getItem: (k: string) => store.get(k) ?? null } });
    const c = qaRunFromLocation();
    expect(c?.state.config.runId).toBe(JSON.parse(json).config.runId);
    c?.dispose();
    store.clear();
    expect(() => qaRunFromLocation()).toThrow(/QA 장면 상태가 없다/);
    vi.stubGlobal('window', { location: { search: '' }, sessionStorage: { getItem: () => json } });
    expect(qaRunFromLocation()).toBeNull();
  });

  it('개발 빌드가 아니면(DEV=false) 주소와 상태가 있어도 열지 않는다', () => {
    const json = sceneJson();
    vi.stubEnv('DEV', false);
    vi.stubGlobal('window', { location: { search: `?${QA_RUN_PARAM}=1` }, sessionStorage: { getItem: () => json } });
    expect(qaRunFromLocation()).toBeNull();
  });
});
