import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/content';
import type { GameView } from '../../src/application/view';
import { Armory } from '../../src/ui/game/Armory';
import { Hud } from '../../src/ui/game/Hud';
import { PauseOverlay } from '../../src/ui/game/PauseOverlay';

// R5 P3 세션 A(S1) 상태 카드·타워 칸·일시정지(B6·B12·B15, docs/renewal/prd-r5-oak-v2.md §5.2). 화면 글·구조만 서버 렌더로 본다.

const noop = () => undefined;

describe('잠긴 칸 숫자 배지(B12)', () => {
  const armory = (variant: 'rail' | 'strip', lockedWave: number | null) => renderToStaticMarkup(createElement(Armory, {
    balance: BALANCE, towers: [], gold: 0, armed: null, icons: {}, variant,
    locked: '5웨이브를 지키면 새 타워', lockedWave,
    onArm: noop, onPress: noop, takeClick: () => true,
  }));

  it('레일·휴대폰 줄 모두 잠긴 칸 안에 풀리는 웨이브 숫자가 글자로 보인다(호버 없이 터치에서도)', () => {
    for (const variant of ['rail', 'strip'] as const) {
      const html = armory(variant, 5);
      // 배지: 웨이브 아이콘 + 숫자(타워 칸의 가격 줄 자리).
      expect(html).toMatch(/icon\.wave\.png"[^>]*\/>5<\/span><\/span>/);
      // 화면 읽기 문장은 그대로 남는다.
      expect(html).toContain('잠긴 칸: 5웨이브를 지키면 새 타워');
    }
  });

  it('웨이브 번호를 모르면 배지 없이 자물쇠만 둔다', () => {
    const html = armory('rail', null);
    expect(html).toContain('icon.lock.png');
    expect(html).not.toContain('icon.wave.png');
  });
});

describe('연속 정답 보너스 칸 묶음(B6)', () => {
  const view = (burningSecondsLeft: number) => ({
    gateHp: 15, gateMaxHp: 15, wave: 3, completedWave: 2, gold: 120, milestoneWave: false, pt: 40,
    stats: { ptFromQuestions: 30, ptFromKills: 10 }, burningSecondsLeft, battleStreak: 2, relics: [],
  }) as unknown as GameView;
  const hud = (seconds: number, mode: 'R' | 'S') => renderToStaticMarkup(createElement(Hud, { view: view(seconds), burning: BALANCE.burning, mode, onPause: noop }));
  /** 칸 묶음(aria-label "연속 정답…")부터 태그 12개의 뼈대: 묶음·불꽃 칸 겹(그림 3)·보너스 겹(그림 1 + 남은 초)과 그 닫힘. */
  const skeleton = (html: string) => {
    const start = html.lastIndexOf('<span', html.indexOf('aria-label="연속 정답'));
    return html.slice(start).match(/<\/?[a-z]+/g)!.slice(0, 12).join('');
  };

  it('켜지면 남은 초가 보이고, 켜짐·꺼짐이 같은 겹 구조라 상자 크기가 바뀌지 않는다', () => {
    for (const mode of ['R', 'S'] as const) {
      const off = hud(0, mode);
      const on = hud(8, mode);
      expect(on).toContain('data-burning="true"');
      expect(off).not.toContain('data-burning');
      expect(on).toContain('8초');
      expect(skeleton(on)).toBe(skeleton(off));
    }
  });
});

describe('일시정지 창(B15)', () => {
  const pause = (reasons: Parameters<typeof PauseOverlay>[0]['reasons']) => renderToStaticMarkup(createElement(PauseOverlay, {
    reasons, renderLost: false, fontScale: 'base', soundOn: true,
    onResume: noop, onFont: noop, onSound: noop, onQuit: noop, onLeave: noop,
  }));

  it('창은 하나이고 #pause-title로 이름이 붙으며, 학생이 멈추면 "잠시 멈췄어요." 한 줄이 보인다', () => {
    const html = pause(['USER']);
    expect(html.match(/role="dialog"/g)).toHaveLength(1);
    expect(html).toContain('aria-labelledby="pause-title"');
    expect(html).toContain('잠시 멈췄어요.');
    expect(html).toContain('계속하기');
    // 꼭 계속하기로 돌아가는 창: 닫기 단추가 없다.
    expect(html).not.toContain('aria-label="닫기"');
  });

  it('수치 한계로 막히면 처음 화면으로만 나간다', () => {
    const html = pause(['USER', 'NUMERIC_LIMIT']);
    expect(html).toContain('처음 화면으로');
    expect(html).not.toContain('계속하기');
  });
});
