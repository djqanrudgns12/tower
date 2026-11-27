import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getR6Battle } from '../../../src/application/balanceSession';
import { loadSettings, normalizeSettings } from '../../../src/persistence/settings';
import { GuideScreen } from '../../../src/ui/screens/GuideScreen';
import { R6SpeciesStage, R6TowerStage } from '../../../src/ui/screens/guide/R6GuideStages';
import { SettingsModal } from '../../../src/ui/screens/SettingsModal';

describe('R6 도감과 설정 고도화(WP-C2-04)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GuideScreen은 2.0.0과 2.1.0 모두 R6 도감으로 열고 영문 Lv 표기를 남기지 않는다', () => {
    for (const v of ['2.0.0', '2.1.0'] as const) {
      const html = renderToStaticMarkup(createElement(GuideScreen, {
        balanceVersion: v as '2.0.0',
        onBack: vi.fn(),
      }));
      expect(html).not.toMatch(/\bLv\d/);
      expect(html).toContain('단계');
    }

    const r6 = getR6Battle();
    const towerHtml = renderToStaticMarkup(createElement(R6TowerStage, {
      runtime: r6.balance.r6!,
      balance: r6.balance,
      highContrastMap: false,
    }));
    expect(towerHtml).not.toMatch(/\bLv\d/);
    expect(towerHtml).toContain('무기 1');

    const speciesHtml = renderToStaticMarkup(createElement(R6SpeciesStage, {
      runtime: r6.balance.r6!,
    }));
    expect(speciesHtml).toContain('assets/ui/study/r6.portrait.elf.01.webp');
    expect(speciesHtml).toContain('추천 대응 타워');
    expect(speciesHtml).toContain('특수 받침');
  });

  it('설정 저장본이 colorblindPalette를 정규화하고 SettingsModal은 스냅샷 안내·색약·배경음 듣기를 그린다', () => {
    const base = loadSettings();
    expect(base.colorblindPalette).toBe(false);
    expect(normalizeSettings(base, { colorblindPalette: true }).colorblindPalette).toBe(true);

    const html = renderToStaticMarkup(createElement(SettingsModal, {
      settings: base,
      inRun: true,
      onUpdate: vi.fn(),
      onHistoryCleared: vi.fn(),
      onClose: vi.fn(),
    }));
    expect(html).toContain('배경음 듣기');
    expect(html).toContain('M키');
  });
});
