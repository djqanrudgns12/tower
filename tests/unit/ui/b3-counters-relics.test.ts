import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TRAIT_TAG, type TowerId } from '../../../src/contracts/balance';
import { BALANCE } from '../../../src/content';
import { selectView } from '../../../src/application/view';
import { relicOfferFor } from '../../../src/domain/relics';
import { matchupOf } from '../../../src/domain/towers';
import { counterTags, counterText, FOE_TRAIT_ICON, hasCounter } from '../../../src/ui/game/counters';
import { RelicCard } from '../../../src/ui/game/RelicCard';
import { recruitCardInfo, showRecruit, showRelic } from '../../../src/ui/game/recruit';
import { forecastWarning, wavePreview } from '../../../src/ui/game/wavePreview';
import { FORECAST_WARNING } from '../../../src/ui/copy';
import { finishPrep, newRun } from '../helpers';

// R4 B3 화면: 잘 잡는 적·약한 적 아이콘, 다음 웨이브 종족 특성 경고, 원정 보물 창. 모두 계약(strongVs·weakVs·trait·relics)에서 만든다.

const air = (t: TowerId) => recruitCardInfo(BALANCE, t).air === true;

describe('잘 잡는 적·약한 적(계약 strongVs·weakVs)', () => {
  it('잘 잡는 적 최대 2개·약한 적 최대 1개를 계약 순서대로 보인다', () => {
    for (const t of Object.keys(BALANCE.towers) as TowerId[]) {
      const m = matchupOf(BALANCE, t, 'base');
      expect(counterTags(BALANCE, t, 'base')).toEqual({ strong: m.strongVs.slice(0, 2), weak: m.weakVs.slice(0, 1) });
    }
    expect(counterTags(BALANCE, 'trap', 'base')).toEqual({ strong: ['runner', 'burrow'], weak: ['flyer'] });
    expect(counterTags(BALANCE, 'archer', 'base')).toEqual({ strong: [], weak: [] });
    expect(counterText(BALANCE, 'spear', 'base')).toBe('잘 잡는 적 빠른 적, 힘센 적 · 약한 적 나는 적');
    expect(counterText(BALANCE, 'archer', 'base')).toBe('');
  });

  it('형태가 상성을 바꾸면 아이콘도 바뀐다(화차 A2는 하늘에도 강하다)', () => {
    expect(counterTags(BALANCE, 'hwacha', 'A2').strong).toEqual(['clay', 'flyer']);
    expect(counterTags(BALANCE, 'archer', 'B1').strong).toEqual(['flyer']);
  });

  it('종족 특성 표지는 모두 원화 특성 아이콘이 있다', () => {
    for (const tag of Object.values(TRAIT_TAG)) expect(FOE_TRAIT_ICON[tag], tag).toBeTruthy();
  });

  it('가진 타워: 장착함 기본형과 지어 둔 타워의 지금 형태', () => {
    expect(hasCounter(BALANCE, 'clay', ['archer', 'cannon'], [])).toBe(false);
    expect(hasCounter(BALANCE, 'clay', ['archer', 'sling'], [])).toBe(true);
    expect(hasCounter(BALANCE, 'flyer', ['archer'], [{ type: 'archer', form: 'B1' }])).toBe(true);
  });
});

describe('다음 웨이브 종족 특성과 경고 한 줄', () => {
  it('정원 맵: 침입 전에는 특성이 없고, W18 등껍질·W23 하늘 떼·W33 흙 보호막·W38 땅굴', () => {
    const map = 'garden_u';
    expect(wavePreview(BALANCE, map, 10).traits).toEqual([]);
    expect(wavePreview(BALANCE, map, 15).traits).toEqual([]);
    expect(wavePreview(BALANCE, map, 18).traits).toEqual(['shell']);
    expect(wavePreview(BALANCE, map, 23).traits).toEqual(['flyers']);
    expect(wavePreview(BALANCE, map, 33).traits).toEqual(['clay']);
    expect(wavePreview(BALANCE, map, 38).traits).toEqual(['burrow']);
  });

  it('하늘을 쏘는 타워가 없으면 그 경고가 먼저, 아니면 잘 잡는 타워가 없는 첫 특성', () => {
    const clay = wavePreview(BALANCE, 'garden_u', 33);
    expect(forecastWarning(BALANCE, clay, air, ['cannon', 'flame'], [])).toBe('air');
    expect(forecastWarning(BALANCE, clay, air, ['archer', 'cannon', 'frost', 'mage'], [])).toBe('clay');
    expect(forecastWarning(BALANCE, clay, air, ['archer', 'cannon', 'frost', 'mage', 'sling'], [])).toBeNull();
    const mole = wavePreview(BALANCE, 'garden_u', 38);
    expect(forecastWarning(BALANCE, mole, air, ['archer', 'cannon', 'frost', 'mage'], [])).toBe('burrow');
    expect(forecastWarning(BALANCE, mole, air, ['archer', 'cannon', 'frost', 'mage', 'trap'], [])).toBeNull();
    // 등껍질은 시작 타워(마법탑)가 이미 잘 잡는다.
    expect(forecastWarning(BALANCE, wavePreview(BALANCE, 'garden_u', 18), air, ['archer', 'cannon', 'frost', 'mage'], [])).toBeNull();
    // 하늘 떼: 하늘을 쏠 수는 있어도 잘 잡는 타워(매·노포·궁수 B1 등)가 없으면 경고, 지어 둔 궁수 B1이 있으면 없음.
    const sky = wavePreview(BALANCE, 'garden_u', 23);
    expect(forecastWarning(BALANCE, sky, air, ['archer', 'cannon', 'frost', 'mage'], [])).toBe('flyers');
    expect(forecastWarning(BALANCE, sky, air, ['archer', 'cannon', 'frost', 'mage'], [{ type: 'archer', form: 'B1' }])).toBeNull();
    for (const line of Object.values(FORECAST_WARNING)) expect(line.length).toBeLessThanOrEqual(30);
  });
});

describe('원정 보물 아이콘(계약 icon = relic.<id>, 전용 원화)', () => {
  it('보물 12개 모두 relic.<id>이고 원화 파일이 있다', () => {
    const items = BALANCE.relics!.items;
    expect(Object.keys(items)).toHaveLength(12);
    for (const [id, r] of Object.entries(items)) {
      expect(r.icon, id).toBe(`relic.${id}`);
      expect(existsSync(`./public/assets/ui/relic.${id}.png`), `relic.${id}.png 누락`).toBe(true);
    }
  });
});

describe('원정 보물 창', () => {
  const between = { draft: null, pause: [], phase: 'BUILD' as const };
  it('후보가 있고 웨이브 사이에 멈추지 않았을 때만, 새 타워 창이 먼저다', () => {
    const offer = { wave: 10, offers: ['wise_book', 'sky_net', 'frost_bead'] };
    expect(showRelic({ ...between, relicOffer: null })).toBe(false);
    expect(showRelic({ ...between, relicOffer: offer })).toBe(true);
    expect(showRelic({ ...between, relicOffer: offer, phase: 'BATTLE' })).toBe(false);
    expect(showRelic({ ...between, relicOffer: offer, pause: ['USER'] })).toBe(false);
    const draft = { wave: 9, offers: ['spear', 'sling', 'trap'] as TowerId[] };
    expect(showRecruit({ ...between, draft })).toBe(true);
    expect(showRelic({ ...between, draft, relicOffer: offer })).toBe(false);
  });

  it('카드 3장: 제목·이름·한 줄 규칙(계약 relics.items)과 카드마다 고르기', () => {
    const offers = relicOfferFor(BALANCE, 1234, 10, []);
    expect(offers).toHaveLength(3);
    const html = renderToStaticMarkup(createElement(RelicCard, { balance: BALANCE, choices: offers, icons: {}, onPick: () => {} }));
    expect(html).toContain('원정 보물');
    for (const id of offers) {
      const r = BALANCE.relics!.items[id]!;
      expect(html).toContain(r.label);
      expect(html).toContain(r.summary);
    }
    expect(html.match(/data-choice/g)).toHaveLength(3);
    // 카드 전체가 누르는 단추 하나(카드마다 고르기 단추 줄이 없다). 이름은 '<보물> 고르기: 규칙'.
    const buttons = html.match(/<button[^>]*>/g)!;
    expect(buttons).toHaveLength(3);
    for (const id of offers) expect(html).toContain(`aria-label="${BALANCE.relics!.items[id]!.label} 고르기: ${BALANCE.relics!.items[id]!.summary}"`);
    // 보물 전용 원화(public/assets/ui/relic.<id>.png)를 쓴다.
    for (const id of offers) expect(html).toContain(`assets/ui/relic.${id}.png`);
    expect(html).not.toContain('aria-label="닫기"');
  });

  it('화면 요약은 고른 보물·후보를 싣고, 정답 골드는 보물(지혜의 책 +3)까지 엔진과 같은 값이다', () => {
    const { ctx, s } = newRun('Normal', 31);
    finishPrep(ctx, s);
    const before = selectView(ctx, s);
    expect(before.relics).toEqual([]);
    expect(before.relicOffer).toBeNull();
    s.relics = ['wise_book'];
    s.relicOffer = { wave: 10, offers: ['sky_net', 'frost_bead', 'trade_seal'] };
    const after = selectView(ctx, s);
    expect(after.relics).toEqual(['wise_book']);
    expect(after.relicOffer).toEqual({ wave: 10, offers: ['sky_net', 'frost_bead', 'trade_seal'] });
    expect(after.stakes.correctGold).toBe(before.stakes.correctGold + 3);
  });
});
