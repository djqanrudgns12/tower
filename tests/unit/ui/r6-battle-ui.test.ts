import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import raw from '../../../docs/contracts/balance.v2.json';
import { BALANCE } from '../../../src/content';
import { balanceV2Schema } from '../../../src/contracts/balanceV2';
import { compileR6Balance } from '../../../src/domain/r6Balance';
import { previewR6Wave } from '../../../src/domain/r6Mixer';
import { TowerDetail } from '../../../src/ui/game/TowerDetail';
import { nextTowerUnlock } from '../../../src/ui/game/r6Display';
import { r6Forecast } from '../../../src/ui/game/r6Forecast';

const rules = balanceV2Schema.parse(raw);
const balance = compileR6Balance(BALANCE, rules);

describe('R6 전투 UI', () => {
  const detail = (level: number) => renderToStaticMarkup(createElement(TowerDetail, {
    balance, type: 'mortar', level, form: 'base', icons: {},
  }));

  it('레벨 5에서 무기 II가 적용되는 레벨 6을 예고하고 레벨 20에서 미리보기를 닫는다', () => {
    const before = detail(5);
    expect(before).toContain('레벨 진행 5/20');
    expect(before).toContain('다음 진화 · Lv6');
    expect(before).toContain('무기 II ·');
    const max = detail(20);
    expect(max).toContain('레벨 진행 20/20');
    expect(max).toContain('aria-current="step"><strong>IV');
    expect(max).not.toContain('다음 진화 미리보기');
  });

  it('보유 목록과 완료 웨이브를 반영해 다음 해금 타워를 고른다', () => {
    const available = ['rail', 'mortar', 'cryo', 'prism', 'hangar', 'bastion'];
    expect(nextTowerUnlock(balance, 2, available, available.slice(0, 3))).toEqual({ type: 'prism', wave: 3 });
    expect(nextTowerUnlock(balance, 3, available, available.slice(0, 4))).toEqual({ type: 'hangar', wave: 6 });
    expect(nextTowerUnlock(balance, 8, available, available)).toBeNull();
  });

  it('현재 판의 시드로 편성한 종족별 마릿수와 보스를 표시한다', () => {
    const map = 'garden_u', seed = 1927, wave = 10;
    const roster = previewR6Wave(rules, map, seed, wave);
    const forecast = r6Forecast(balance.r6!, map, seed, wave);
    expect(forecast.boss).toBe(true);
    expect(forecast.total).toBe(roster.length);
    expect(Object.fromEntries(forecast.species.map(({ id, count }) => [id, count]))).toEqual(
      roster.reduce<Record<string, number>>((counts, enemy) => ({ ...counts, [enemy.species]: (counts[enemy.species] ?? 0) + 1 }), {}),
    );
  });
});
