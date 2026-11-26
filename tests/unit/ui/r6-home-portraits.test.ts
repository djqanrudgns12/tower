import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PORTRAIT_RACES,
  R6_PORTRAIT_ACCENTS,
  R6_PORTRAITS,
  STUDY_MONSTER_ARTS,
  advancePortraitDeck,
  createPortraitDeckState,
  portraitRaceOf,
  shufflePortraitDeck,
} from '../../../src/ui/screens/home/portraitDeck';
import { STUDY_MONSTER_ARTS as PANEL_STUDY_ARTS } from '../../../src/ui/screens/home/SteleStudyPanel';
import { readImageInfo } from '../imageMeta';

const ASSETS_DIR = 'public/assets';
const MAX_PORTRAIT_BYTES = 18 * 1024;
const MAX_TOTAL_BYTES = 540 * 1024;

describe('R6 홈 오늘의 낱말 초상 규격 및 5종족 블록 셔플', () => {
  it('STUDY_MONSTER_ARTS는 R6 5종족×6장 = 30장 경로를 가리킨다', () => {
    expect(PANEL_STUDY_ARTS).toEqual(STUDY_MONSTER_ARTS);
    expect(STUDY_MONSTER_ARTS).toHaveLength(30);
    expect(R6_PORTRAITS).toHaveLength(30);

    for (const race of PORTRAIT_RACES) {
      const raceItems = R6_PORTRAITS.filter(item => item.race === race);
      expect(raceItems).toHaveLength(6);
    }
  });

  it('1,000회 재셔플에서 같은 종족 연속 0건·직전 그림 반복 0건·30장 1회씩 출현을 지킨다', () => {
    let prevLast: string | undefined;
    for (let run = 0; run < 1000; run++) {
      const deck = shufflePortraitDeck(prevLast);
      expect(deck).toHaveLength(30);

      // 30장 모두 중복 없이 정확히 한 번씩 포함된다.
      const uniquePaths = new Set(deck.map(item => item.path));
      expect(uniquePaths.size).toBe(30);
      expect(STUDY_MONSTER_ARTS.every(path => uniquePaths.has(path))).toBe(true);

      // 6개 라운드 블록(각 5장)마다 5종족이 모두 1장씩 들어간다.
      for (let round = 0; round < 6; round++) {
        const block = deck.slice(round * 5, round * 5 + 5);
        expect(new Set(block.map(item => item.race)).size).toBe(5);
      }

      // 재셔플 경계에서도 직전 종족 및 직전 그림과 겹치지 않는다.
      if (prevLast) {
        expect(deck[0]!.path).not.toBe(prevLast);
        expect(deck[0]!.race).not.toBe(portraitRaceOf(prevLast));
      }

      // 덱 내부에서도 같은 종족 연속 0건, 같은 그림 연속 0건이다.
      for (let i = 1; i < deck.length; i++) {
        expect(deck[i]!.race, `run=${run} idx=${i}`).not.toBe(deck[i - 1]!.race);
        expect(deck[i]!.path, `run=${run} idx=${i}`).not.toBe(deck[i - 1]!.path);
      }

      prevLast = deck[deck.length - 1]!.path;
    }
  });

  it('연속 랜덤 클릭 시뮬레이션(3,000회)에서도 종족 연속·그림 반복·예열 누락이 0건이다', () => {
    let state = createPortraitDeckState();
    let prev = state.deck[state.cursor]!;
    const window30: string[] = [prev.path];

    for (let step = 0; step < 3000; step++) {
      const preloaded = state.deck[state.cursor + 1];
      expect(preloaded, `step=${step} nextArt 누락`).toBeDefined();

      state = advancePortraitDeck(state);
      const current = state.deck[state.cursor]!;
      expect(current.path).toBe(preloaded!.path);
      expect(current.race).not.toBe(prev.race);
      expect(current.path).not.toBe(prev.path);

      window30.push(current.path);
      if (window30.length === 30) {
        expect(new Set(window30).size, `step=${step} 30장 주기 중복`).toBe(30);
        window30.length = 0;
      }
      prev = current;
    }
  });

  it('public/assets/ui/study/r6.portrait.<race>.<01~06>.webp 30장은 256×256 불투명 WebP이며 장당 ≤ 18KB · 합계 ≤ 540KB다', () => {
    let totalBytes = 0;

    for (const race of PORTRAIT_RACES) {
      for (let i = 1; i <= 6; i++) {
        const rel = `ui/study/r6.portrait.${race}.${String(i).padStart(2, '0')}.webp`;
        const full = `${ASSETS_DIR}/${rel}`;
        expect(existsSync(full), `${rel} 파일 없음`).toBe(true);

        const buf = readFileSync(full);
        totalBytes += buf.byteLength;
        expect(buf.byteLength, `${rel} 용량 비정상`).toBeGreaterThan(2048);
        expect(buf.byteLength, `${rel} 장당 18KB 초과 (${buf.byteLength}B)`).toBeLessThanOrEqual(MAX_PORTRAIT_BYTES);
        expect(readImageInfo(buf, rel), rel).toEqual({
          format: 'webp',
          width: 256,
          height: 256,
          hasAlpha: false,
        });
      }
    }

    expect(totalBytes, `30장 합계 540KB 초과 (${totalBytes}B)`).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it('옛 study.monster.01~30.webp 파일은 v1 보존을 위해 삭제하지 않고 유지하며, CSS 88×172 왜곡이 제거됐다', () => {
    for (let i = 1; i <= 30; i++) {
      const rel = `ui/study/study.monster.${String(i).padStart(2, '0')}.webp`;
      expect(existsSync(`${ASSETS_DIR}/${rel}`), `${rel} 보존 누락`).toBe(true);
    }

    expect(R6_PORTRAIT_ACCENTS).toEqual({
      elf: '#2FB5A3',
      human: '#B8C0C8',
      mech: '#2FB5A3',
      insect: '#E69F24',
      golem: '#E69F24',
    });

    const css = readFileSync('src/ui/screens/home/home.module.css', 'utf8');
    expect(css).not.toMatch(/\.steleGardenFrame\s*\{[^}]*height:\s*172px/);
    expect(css).toContain('height: 88px;');
  });
});
