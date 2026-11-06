import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build, loadConfigFromFile, mergeConfig } from 'vite';
import { gradeContent, MAPS } from '../../src/content';
import * as content from '../../src/content';
import { mapPreviewFromLocation, parseMapPreview, PREVIEW_PARAM, startMapPreview } from '../../src/application/mapPreview';
import { QA_RUN_KEY } from '../../src/application/qaRun';

// 개발 빌드 전용 맵 미리보기(src/application/mapPreview.ts). 4~6학년 문제은행이 없어도 새 맵의 전투 화면이 열리고, 운영 빌드에는 이 경로가 없다.

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('주소 읽기', () => {
  it('없는 맵 id·매개변수 없음은 null이고, 맵 id가 맞으면 요청을 만든다', () => {
    expect(parseMapPreview('')).toBeNull();
    expect(parseMapPreview('?previewMap=nowhere')).toBeNull();
    expect(parseMapPreview('?other=river_z')).toBeNull();
    expect(parseMapPreview('?previewMap=river_z')).toEqual({ mapId: 'river_z', towers: 0, wave: 1, ticks: 0 });
    expect(parseMapPreview('?previewMap=snow_step&towers=8&wave=17&ticks=200')).toEqual({ mapId: 'snow_step', towers: 8, wave: 17, ticks: 200 });
  });

  it('숫자 매개변수는 정수만 받고 상한으로 자른다(잘못된 값은 기본값)', () => {
    expect(parseMapPreview('?previewMap=courtyard&towers=99&wave=9999&ticks=99999')).toEqual({ mapId: 'courtyard', towers: 20, wave: 120, ticks: 3000 });
    expect(parseMapPreview('?previewMap=courtyard&towers=-3&wave=abc&ticks=1.5')).toEqual({ mapId: 'courtyard', towers: 0, wave: 1, ticks: 0 });
    expect(parseMapPreview('?previewMap=courtyard&wave=0')?.wave).toBe(1);
  });
});

describe('미리보기 판', () => {
  const preview = MAPS.filter(m => m.grade >= 4);

  it('4~6학년 맵 3개가 공개 문제은행 없이 열리고, 요청한 맵으로 돈다', () => {
    const realGradeContent = content.gradeContent;
    vi.spyOn(content, 'gradeContent').mockImplementation(grade => {
      const data = realGradeContent(grade);
      return grade >= 4 ? { ...data, bank: null } : data;
    });
    expect(preview.map(m => m.id)).toEqual(['river_z', 'courtyard', 'snow_step']);
    for (const m of preview) {
      expect(gradeContent(m.grade).bank, `${m.id}: 이 학년 은행`).toBeNull();
      const c = startMapPreview({ mapId: m.id, towers: 0, wave: 1, ticks: 0 }, 'tester');
      expect(c.ctx.map.id).toBe(m.id);
      expect(c.state.config.mapId).toBe(m.id);
      expect(c.state.config.grade).toBe(m.grade);
      expect(c.state.phase).toBe('PREP_QUIZ');
      expect(c.state.quiz.current).not.toBeNull();
      c.dispose();
    }
  });

  it('towers·wave·ticks를 주면 문제를 건너뛰고 타워를 세워 배치 단계 또는 전투로 연다', () => {
    const build = startMapPreview({ mapId: 'river_z', towers: 8, wave: 17, ticks: 0 }, 'tester');
    expect(build.state.phase).toBe('BUILD');
    expect(build.state.wave).toBe(17);
    expect(build.state.towers).toHaveLength(8);
    const slots = build.state.towers.map(t => t.slotId);
    expect(new Set(slots).size).toBe(8);
    for (const id of slots) expect(build.ctx.map.slots.some(s => s.id === id)).toBe(true);
    expect(build.state.owned.length).toBeLessThanOrEqual(8); // 장착함은 원래대로
    build.dispose();

    const battle = startMapPreview({ mapId: 'snow_step', towers: 6, wave: 1, ticks: 150 }, 'tester');
    expect(battle.state.phase).toBe('BATTLE');
    expect(battle.state.enemies.some(e => e.alive)).toBe(true);
    expect(battle.state.gateHp).toBe(battle.state.gateMaxHp);
    battle.dispose();
  });

  it('요청한 맵이 목록에 없으면 던진다', () => {
    expect(() => startMapPreview({ mapId: 'nowhere', towers: 0, wave: 1, ticks: 0 }, 'tester')).toThrow(/미리볼 맵이 없다/);
  });
});

describe('주소창 연결(개발 빌드 가드)', () => {
  it('개발 빌드에서는 주소의 요청대로 판을 만들고, 요청이 없으면 null이다', () => {
    vi.stubGlobal('window', { location: { search: '?previewMap=courtyard' } });
    const c = mapPreviewFromLocation('tester');
    expect(c?.ctx.map.id).toBe('courtyard');
    c?.dispose();
    vi.stubGlobal('window', { location: { search: '' } });
    expect(mapPreviewFromLocation('tester')).toBeNull();
  });

  it('개발 빌드가 아니면(DEV=false) 주소에 요청이 있어도 열지 않는다', () => {
    vi.stubEnv('DEV', false);
    vi.stubGlobal('window', { location: { search: '?previewMap=courtyard&towers=4' } });
    expect(mapPreviewFromLocation('tester')).toBeNull();
  });
});

describe('운영 빌드에는 개발용 진입 경로(맵 미리보기·QA 장면 로더)가 없다', () => {
  const ROOT = process.cwd();

  /**
   * 실제 vite 빌드(메모리 출력)를 mode별로 만들어 모든 산출 코드를 이어 붙여 돌려준다.
   * vite는 NODE_ENV로 import.meta.env.DEV를 정하는데 시험 프로세스는 NODE_ENV=test라서, 빌드하는 동안만 mode와 같게 맞춘다.
   */
  async function bundle(mode: 'production' | 'development') {
    vi.stubEnv('NODE_ENV', mode);
    const loaded = await loadConfigFromFile({ command: 'build', mode }, path.join(ROOT, 'vite.config.ts'), ROOT);
    if (!loaded) throw new Error('vite 설정을 읽지 못했다');
    const result = await build(mergeConfig(loaded.config, { configFile: false, root: ROOT, mode, logLevel: 'silent', build: { write: false } }));
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => ('output' in r ? r.output : []));
    return outputs.map(o => (o.type === 'chunk' ? o.code : '')).join('\n');
  }

  it('운영 번들에는 주소 이름(previewMap·qaRun 키)도 미리보기·로더 함수도 없고, 개발 번들에는 있다(대조)', async () => {
    const dev = await bundle('development');
    const devOnly = [PREVIEW_PARAM, '미리볼 맵이 없다', '미리보기 명령 거부', QA_RUN_KEY, 'QA 장면 상태가 없다', 'QA 장면 상태 버전이 다르다'];
    for (const text of devOnly) expect(dev, `개발 번들: ${text}`).toContain(text);
    const prod = await bundle('production');
    for (const text of devOnly) expect(prod, `운영 번들: ${text}`).not.toContain(text);
    // 운영 번들에서도 앱 본체는 그대로 들어 있다(빈 번들로 통과하지 않게).
    expect(prod).toContain('vocabulary-td');
  }, 120_000);
});
