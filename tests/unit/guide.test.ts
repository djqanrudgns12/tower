import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE, DIFFICULTY_GATE, practiceContext } from '../../src/content';
import {
  buildDifficultyGuideItems,
  buildGuideCards,
  buildGuideChapters,
  buildQuizOutcomeSpecs,
  buildTowerGuideItems,
  GUIDE_CHAPTER_IDS,
  GUIDE_WAVE_BEATS,
  nextGuideChapter,
  sampleGuideWaveLoop,
} from '../../src/ui/screens/guide/guideModel';
import { difficultyReadout } from '../../src/ui/screens/guide/difficultyReadout';

describe('사용 설명서 모델 및 전용 삽화 계약 (G03~G11, G15)', () => {
  it('G03·G05·G06·G15: 정확히 4장·3행 이하·95자 이내이며 끝내기·연습 안내가 있고(이어하기 없음) 느낌표·이모지·영문 라벨이 없다', () => {
    const chapters = buildGuideChapters();
    expect(chapters).toHaveLength(4);
    expect(chapters.map(c => c.id)).toEqual([...GUIDE_CHAPTER_IDS]);

    const visibleTexts: string[] = [];
    for (const ch of chapters) {
      expect(ch.rows.length).toBeLessThanOrEqual(3);
      visibleTexts.push(ch.tabLabel, ch.title, ch.headline, ch.illustrationAlt);
      for (const row of ch.rows) {
        expect(row.body.length, `${ch.id}장 ${row.title} 글자 수 초과`).toBeLessThanOrEqual(95);
        visibleTexts.push(row.badge, row.title, row.body);
      }
    }

    for (const beat of GUIDE_WAVE_BEATS) {
      visibleTexts.push(beat.shortLabel, beat.caption);
    }
    for (const q of buildQuizOutcomeSpecs()) {
      visibleTexts.push(q.tabLabel, q.goldDeltaText, q.scoreDeltaText, q.gateNote, q.summary);
    }
    for (const t of buildTowerGuideItems()) {
      visibleTexts.push(
        t.label,
        t.rangeCellsText,
        t.branchATitle,
        t.branchASummary,
        t.branchBTitle,
        t.branchBSummary,
      );
    }
    for (const d of buildDifficultyGuideItems()) {
      visibleTexts.push(d.label, d.vocabScope);
    }

    const joined = visibleTexts.join('\n');
    // G03: PRD §14.1 이어하기 없음(끝내야 기록, 창을 닫으면 사라짐)과 §12.2 첫 연습 판 안내가 있다.
    expect(joined).toContain('창을 닫으면 그 판은 사라져요');
    expect(joined).not.toMatch(/이어하기|저장하고 나가기|저장된 판/);
    expect(joined).toContain('연습 판');
    // G05: 핵심 최신 규칙 포함 확인
    expect(joined).toContain('모르겠어요');
    expect(joined).toContain('연속 정답 보너스');
    expect(joined).toContain('밝은 흙길');
    expect(joined).toContain('속담·관용구·방언');
    expect(joined).toContain('이번 판 끝내기');
    // 용어 규정(ui-rules-v3 §4): 옛 말이 화면 글에 남지 않는다.
    expect(joined).not.toMatch(/버닝|불꽃|고비|대장|징집|명예점|출정|군자금/);
    // G15: 느낌표 0건, 이모지 0건, 영문 단독 단어 0건
    expect(joined).not.toContain('!');
    expect(joined).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(joined).not.toMatch(/[A-Za-z]{2,}/);
  });

  it('G04: BALANCE 계약값이 바뀌면 설명서 모든 장의 수치가 하드코딩 없이 동적으로 갱신된다', () => {
    const custom = structuredClone(BALANCE);
    custom.run.startGold = 155;
    custom.run.prepAttempts = { firstWave: 4, laterWaves: 3 };
    custom.waves.bossEveryWaves = 6;
    custom.burning = { streak: 4, durationMs: 9000, attackSpeedBP: 3500 };
    custom.levels.max = 6;
    custom.levels.evolveAt = [5, 8];
    custom.run.sellRatioBP = 7000;

    const chapters = buildGuideChapters(custom, ['archer', 'frost']);
    const ch1Text = chapters[0].rows.map(r => r.body).join(' ');
    const ch2Text = [chapters[1].headline, ...chapters[1].rows.map(r => r.body)].join(' ');
    const ch3Text = [chapters[2].headline, ...chapters[2].rows.map(r => `${r.title} ${r.body}`)].join(' ');

    expect(ch1Text).toContain('155골드');
    expect(ch1Text).toContain('4문제');
    expect(ch1Text).toContain('3문제');
    expect(ch1Text).toContain('6의 배수');

    expect(ch2Text).toContain('4연속');
    expect(ch2Text).toContain('9초');
    expect(ch2Text).toContain('+35%');

    expect(ch3Text).toContain('궁수탑·서리탑');
    expect(ch3Text).not.toContain('포탑');
    expect(ch3Text).toContain('레벨 6');
    expect(ch3Text).toContain('레벨 5');
    expect(ch3Text).toContain('70%');
  });

  it('U3: 그림 카드 4장 + 상성 카드 1장 — 카드마다 한 문장(30자 이하)이고 기존 설명은 자세히 안에 그대로 있다', () => {
    const { cards, counters } = buildGuideCards();
    const chapters = buildGuideChapters();
    expect(cards.map(c => c.id)).toEqual(['flow', 'quiz', 'tower', 'start']);
    expect(cards.map(c => c.title)).toEqual(['한 판 흐름', '문제와 골드', '타워 놓기와 진화', '시작과 끝내기']);

    cards.forEach((card, i) => {
      expect(card.sentence.length, `${card.id} 문장 길이`).toBeLessThanOrEqual(30);
      expect(card.sentence).toMatch(/요$/);
      expect(card.illustrationUrl).toBe(chapters[i]!.illustrationUrl);
      expect(card.details.map(d => d.body)).toEqual(chapters[i]!.rows.map(r => r.body));
      expect(existsSync(`./public/${card.illustrationUrl}`), `${card.id} 그림 누락`).toBe(true);
    });

    expect(counters.sentence).toBe('하늘 적은 하늘을 쏘는 타워로');
    expect(counters.sentence.length).toBeLessThanOrEqual(30);
    expect(counters.pairs.map(p => p.trait)).toEqual(['trait.flying', 'trait.armor', 'trait.swarm']);
    for (const p of counters.pairs) {
      expect(p.towerLabel).toBe(BALANCE.towers[p.towerId].label);
      expect(p.note.length).toBeGreaterThan(0);
      expect(existsSync(`./public/assets/ui/${p.trait}.png`), `${p.trait} 아이콘 누락`).toBe(true);
    }

    const text = [...cards.flatMap(c => [c.title, c.sentence]), counters.title, counters.sentence, ...counters.pairs.flatMap(p => [p.enemy, p.towerLabel, p.note])].join('\n');
    expect(text).not.toContain('!');
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text).not.toMatch(/버닝|불꽃|고비|대장|징집|명예점|출정|군자금/);
  });

  it('G07: nextGuideChapter는 1~4장 경계 밖으로 넘어가지 않고 순차 이동한다', () => {
    expect(nextGuideChapter(1, -1)).toBe(1);
    expect(nextGuideChapter(1, 1)).toBe(2);
    expect(nextGuideChapter(2, 1)).toBe(3);
    expect(nextGuideChapter(3, 1)).toBe(4);
    expect(nextGuideChapter(4, 1)).toBe(4);
    expect(nextGuideChapter(4, -1)).toBe(3);
  });

  it('G09: public/assets/guide 전용 삽화 4종이 모두 RGBA PNG 규격으로 존재한다', () => {
    const chapters = buildGuideChapters();
    for (const ch of chapters) {
      const diskPath = `./public/${ch.illustrationUrl}`;
      expect(existsSync(diskPath), `${diskPath} 누락`).toBe(true);
      const png = readFileSync(diskPath);
      expect(png.byteLength).toBeGreaterThan(10_000);
      expect(png.byteLength).toBeLessThanOrEqual(450 * 1024);
      expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      const colorType = png[25];
      expect(width).toBeGreaterThanOrEqual(400);
      expect(width).toBeLessThanOrEqual(800);
      expect(height).toBeGreaterThanOrEqual(180);
      expect(height).toBeLessThanOrEqual(360);
      // RGBA(colorType=6) 실제 알파 채널 보유 확인
      expect(colorType).toBe(6);
    }
  });

  it('G10·G11: sampleGuideWaveLoop는 결정론적이며 4박자를 순환하고 모션 최소화 시 정지 대표 프레임을 유지한다', () => {
    const a = sampleGuideWaveLoop(360, 110, 5600, true, null);
    const b = sampleGuideWaveLoop(360, 110, 5600, true, null);
    expect(a).toEqual(b);

    expect(sampleGuideWaveLoop(360, 110, 800, true, null).beat).toBe(0);
    expect(sampleGuideWaveLoop(360, 110, 3200, true, null).beat).toBe(1);
    const combatSnap = sampleGuideWaveLoop(360, 110, 5800, true, null);
    expect(combatSnap.beat).toBe(2);
    expect(combatSnap.enemies.length).toBe(3);
    expect(combatSnap.projectiles.length).toBe(2);
    expect(sampleGuideWaveLoop(360, 110, 8600, true, null).beat).toBe(3);

    // 모션 감소 상태에서는 시간과 무관하게 동일한 정지 대표 상태를 반환한다
    const static0 = sampleGuideWaveLoop(360, 110, 0, false, null);
    const staticLater = sampleGuideWaveLoop(360, 110, 7432, false, null);
    expect(static0).toEqual(staticLater);
    expect(static0.showRangeOverlay).toBe(true);
  });

  it('G5: 난이도 판독 한 줄은 계약(성문·정답 골드)과 출제 문턱(속담·관용구·방언)에서만 만든다 — 새 게임 창(N3)도 같은 함수를 쓴다', () => {
    expect(difficultyReadout('Easy').line).toBe('성문 20 · 정답 +17골드부터 · 교과 표준 낱말');
    expect(difficultyReadout('Normal').line).toBe('성문 15 · 정답 +19골드부터 · 교과 표준 낱말');
    expect(difficultyReadout('Hard').line).toBe('성문 10 · 정답 +22골드부터 · 교과 낱말 + 속담·관용구·방언');
    expect(difficultyReadout('Crazy').line).toBe('성문 7 · 정답 +25골드부터 · 교과 낱말 + 속담·관용구·방언');
    for (const id of ['Easy', 'Normal', 'Hard', 'Crazy'] as const) {
      const r = difficultyReadout(id);
      expect(r.gateHp).toBe(BALANCE.difficulties[id].gateHp);
      expect(r.correctGold).toBe(BALANCE.difficulties[id].correctGold);
      expect(r.parts.join(' · ')).toBe(r.line);
    }

    // 계약·출제 문턱이 바뀌면 판독도 따라 바뀐다(손으로 적은 수치 없음).
    const custom = structuredClone(BALANCE);
    custom.difficulties.Normal.gateHp = 12;
    custom.difficulties.Normal.correctGold = 30;
    delete custom.difficulties.Normal.correctGoldPerWaveBP;
    const gate = structuredClone(DIFFICULTY_GATE);
    gate.Normal.allowedVariants = ['standard', 'dialect'];
    const r = difficultyReadout('Normal', custom, gate);
    expect(r.line).toBe('성문 12 · 정답 +30골드 · 교과 낱말 + 속담·관용구·방언');
    expect(r.advanced).toBe(true);
    expect(r.goldGrows).toBe(false);
  });

  it('보존 계약: 화면 버튼 제거 후에도 도메인 practiceContext 계약은 온전히 유지된다', () => {
    const ctx = practiceContext();
    expect(ctx.balance.run.prepAttempts.firstWave).toBe(1);
    expect(ctx.balance.waves.count.base).toBe(3);
  });
});
