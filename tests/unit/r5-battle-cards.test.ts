import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOWER_IDS, type FormId, type TowerId } from '../../src/contracts/balance';
import type { TowerView } from '../../src/application/view';
import { BALANCE } from '../../src/content';
import { nextChoice } from '../../src/ui/game/ChoiceCard';
import { EvolveCard } from '../../src/ui/game/EvolveCard';
import { formDeltas } from '../../src/ui/game/statBars';

// R5 P3 트랙 A 전투 카드(docs/renewal/prd-r5-oak-v2.md §5.2): B9 진화 수치 칩, B13 카드 사이 방향키 이동.

/** 진화 한 걸음씩(Lv3→4 기본형 → A·B, Lv6→7 A → A1·A2, B → B1·B2). */
function* evolutions(): Generator<{ type: TowerId; from: FormId; to: FormId; level: number }> {
  const [first, second] = BALANCE.levels.evolveAt;
  for (const type of TOWER_IDS) {
    for (const to of ['A', 'B'] as const) yield { type, from: 'base', to, level: first - 1 };
    for (const to of ['A1', 'A2'] as const) yield { type, from: 'A', to, level: second - 1 };
    for (const to of ['B1', 'B2'] as const) yield { type, from: 'B', to, level: second - 1 };
  }
}

describe('B9 진화 카드 바뀌는 수치 칩', () => {
  it('계약에서 능력이 줄어드는 형태 16종은 모두 붉은 감소 칩이 있고, 나머지 형태에는 감소 칩이 없다', () => {
    // 계획서 §5.2는 "archer A2 등 6종"이라 적었지만, 계약 balance v0.4를 읽으면 16종이다(공격력·대상·느리게·공격 횟수·깃발 주변 효과).
    const expected = [
      'archer A2 공격력', 'cannon B 대상', 'frost B 느리게', 'banner B 주변 힘', 'banner A2 주변 힘', 'banner B2 주변 속도',
      'lightning B 대상', 'sling A2 공격력', 'ballista B 대상', 'falcon A2 공격력', 'mortar B1 공격력', 'roller B 대상',
      'alchemist A1 공격력', 'alchemist B2 공격력', 'trap B2 대상', 'hwacha B 공격 횟수',
    ];
    const found: string[] = [];
    for (const { type, from, to, level } of evolutions()) {
      const chips = formDeltas(BALANCE, type, level, from, level + 1, to);
      // 깃발초소 A1·B1은 진화 레벨에서 주변 힘·속도가 그대로라(대장 피해·보너스 때 효과만 붙는다) 칩이 없다.
      expect(chips.length, `${type} ${to}`).toBeLessThanOrEqual(2);
      for (const chip of chips.filter(c => c.down)) {
        found.push(`${type} ${to} ${chip.text.split(/ [\d+]/)[0]}`);
        expect(chip.speech).toContain('줄어듦');
      }
      for (const chip of chips.filter(c => !c.down)) expect(chip.speech).toContain('늘어남');
    }
    expect(found.sort()).toEqual([...expected].sort());
  });

  it('갈래 화살(archer A2)은 줄어든 공격력과 함께 늘어난 공격 횟수를 보이고, 공격 간격은 짧아지면 공격 속도가 늘어난다고 읽는다', () => {
    const [, second] = BALANCE.levels.evolveAt;
    expect(formDeltas(BALANCE, 'archer', second - 1, 'A', second, 'A2')).toEqual([
      { text: '공격 횟수 1 → 3번', speech: '공격 횟수 늘어남, 1에서 3번', down: false },
      { text: '공격력 27.0 → 24.6', speech: '공격력 줄어듦, 27.0에서 24.6', down: true },
    ]);
    const [first] = BALANCE.levels.evolveAt;
    expect(formDeltas(BALANCE, 'archer', first - 1, 'base', first, 'A')[0]).toEqual({ text: '공격 간격 1초 → 0.7초', speech: '공격 속도 늘어남, 공격 간격 1초에서 0.7초', down: false });
  });

  it('진화 창 카드는 막대 아래 칩을 그리고, 감소 칩은 붉은 표시(data-down)이며 카드 단추의 설명으로 읽힌다', () => {
    const [, second] = BALANCE.levels.evolveAt;
    const tower: TowerView = { id: 1, type: 'archer', slotId: 's1', level: second - 1, form: 'A', branch: 'A', invested: 0, undoable: false };
    const noop = () => {};
    const html = renderToStaticMarkup(createElement(EvolveCard, { balance: BALANCE, tower, gold: 9999, icons: {}, lock: null, onPreview: noop, onChoose: noop, onClose: noop }));
    expect(html.match(/<dl/g)).toHaveLength(2);
    expect(html.match(/data-down="true"/g)).toHaveLength(1);
    expect(html).toContain('공격력 줄어듦, 27.0에서 24.6');
    // 카드를 덮는 단추마다 aria-describedby가 그 카드의 칩 목록 id를 가리킨다.
    const ids = [...html.matchAll(/<ul id="([^"]+)"/g)].map(m => m[1]);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(html).toContain(`aria-describedby="${id}"`);
  });
});

describe('B13 카드 사이 방향키 이동', () => {
  it('→·↓는 다음, ←·↑는 앞 카드로 끝에서 처음으로 돌고, Home·End는 처음·끝, 다른 키는 다루지 않는다', () => {
    expect(nextChoice(3, 0, 'ArrowRight')).toBe(1);
    expect(nextChoice(3, 2, 'ArrowRight')).toBe(0);
    expect(nextChoice(3, 0, 'ArrowLeft')).toBe(2);
    expect(nextChoice(3, 1, 'ArrowDown')).toBe(2);
    expect(nextChoice(3, 1, 'ArrowUp')).toBe(0);
    expect(nextChoice(2, 1, 'Home')).toBe(0);
    expect(nextChoice(2, 0, 'End')).toBe(1);
    for (const key of ['Enter', ' ', 'Tab', 'a']) expect(nextChoice(3, 1, key)).toBe(-1);
    expect(nextChoice(0, 0, 'ArrowRight')).toBe(-1);
  });
});
