import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE, DIFFICULTY_GATE, practiceContext } from '../../src/content';
import { TOWER_IDS } from '../../src/contracts/balance';
import { correctGoldAt, streakBonusGold } from '../../src/domain/run';
import { REVIEW_GRADUATE_CLEARS } from '../../src/persistence/reviewNote';
import { difficultyReadout } from '../../src/ui/screens/guide/difficultyReadout';
import {
  buildCounterRows,
  buildGuideChapters,
  buildQuizOutcomeSpecs,
  buildTowerGuideItems,
  chapterLabel,
  GUIDE_CHAPTER_IDS,
  GUIDE_COUNTER_CARD,
  GUIDE_NOTE_CLEARS,
  GUIDE_WAVE_BEATS,
  nextGuideChapter,
  sampleGuideWaveLoop,
} from '../../src/ui/screens/guide/guideModel';

// 사용 설명서 모델(R5 G1~G9, docs/renewal/prd-r5-oak-v2.md §5.3). 화면 글·수치가 계약에서 나오는지와 글 규칙(G8·G9)을 본다.

/** 화면에 보이는 설명서 글 전부. */
function visibleTexts(): string[] {
  const out: string[] = [];
  for (const ch of buildGuideChapters()) {
    out.push(chapterLabel(ch), ch.title, ch.sentence, ch.headline, ch.illustrationAlt);
    for (const row of ch.rows) out.push(row.badge, row.title, row.body);
  }
  for (const b of GUIDE_WAVE_BEATS) out.push(b.label);
  for (const beat of [0, 1, 2, 3] as const) {
    const s = sampleGuideWaveLoop(360, 110, 0, false, beat);
    out.push(s.statusTag, s.goldTag);
  }
  for (const q of buildQuizOutcomeSpecs()) out.push(q.label, q.goldText, q.scoreText, q.gateNote, q.summary);
  for (const t of buildTowerGuideItems()) out.push(t.label, t.rangeCellsText, t.branchATitle, t.branchASummary, t.branchBTitle, t.branchBSummary);
  for (const id of ['Easy', 'Normal', 'Hard', 'Crazy'] as const) out.push(difficultyReadout(id).line);
  for (const c of buildCounterRows()) out.push(c.enemy, ...c.towers.map(t => t.label));
  out.push(GUIDE_COUNTER_CARD.title, GUIDE_COUNTER_CARD.sentence);
  return out;
}

describe('사용 설명서 모델 (R5 G1~G9)', () => {
  it('G1·G6·G8: 5장 · 장마다 머리띠 "제N장 · 제목" + 요지 + 3행 · 행당 95자 이하 · 목차 문장 30자 이하', () => {
    const chapters = buildGuideChapters();
    expect(chapters.map(c => c.id)).toEqual([...GUIDE_CHAPTER_IDS]);
    expect(chapters).toHaveLength(5);
    expect(chapters.map(c => c.title)).toEqual(['한 판 흐름', '문제와 골드', '타워 놓기와 진화', '시작과 끝내기', '새 타워와 적 특성']);
    expect(chapterLabel(chapters[0]!)).toBe('제1장 · 한 판 흐름');
    for (const ch of chapters) {
      expect(ch.rows).toHaveLength(3);
      expect(ch.sentence.length, `${ch.id}장 목차 문장`).toBeLessThanOrEqual(30);
      expect(ch.sentence).toMatch(/요$/);
      expect(ch.headline.length, `${ch.id}장 요지`).toBeLessThanOrEqual(40);
      for (const row of ch.rows) {
        expect(row.body.length, `${ch.id}장 ${row.title} 글자 수`).toBeLessThanOrEqual(95);
        expect(row.badge.length).toBeGreaterThan(0);
      }
    }
    expect(GUIDE_COUNTER_CARD.sentence.length).toBeLessThanOrEqual(30);
    expect(GUIDE_COUNTER_CARD.chapter).toBe(5);
  });

  it('G6: 5장은 새 타워(3·6·9·12웨이브)·보물(10웨이브~)·끌어 놓기·3초 되돌리기·최고 기록·오답 노트를 계약 값으로 안내한다', () => {
    const ch5 = buildGuideChapters()[4]!;
    const text = [ch5.headline, ...ch5.rows.flatMap(r => [r.badge, r.title, r.body])].join('\n');
    expect(text).toContain(`${BALANCE.draft.afterWaves.join('·')}웨이브`);
    expect(text).toContain(`${BALANCE.relics!.fromWave}웨이브부터`);
    expect(text).toContain(`${BALANCE.draft.offerCount}종 중 1종`);
    expect(text).toContain(`최대 ${BALANCE.draft.maxOwned}칸`);
    expect(text).toContain('끌어 놓');
    expect(text).toContain(`${BALANCE.run.undoBuildMs / 1000}초 안에는 되돌려`);
    expect(text).toContain('최고 기록');
    expect(text).toContain('오답 노트');
    // 화면은 persistence를 읽지 못해 졸업 횟수를 옮겨 적는다. 저장소 규칙과 어긋나면 여기서 잡는다.
    expect(GUIDE_NOTE_CLEARS).toBe(REVIEW_GRADUATE_CLEARS);
    expect(text).toContain(`${REVIEW_GRADUATE_CLEARS}번 맞히면`);
  });

  it('G9: 지금 규칙의 글 — 이어하기·저장 행 없음, 끝내기·연습·핵심 규칙 있음, 느낌표·이모지·영문·옛 말 0', () => {
    const joined = visibleTexts().join('\n');
    // PRD §14.1 이어하기 없음(끝내야 기록, 창을 닫으면 사라짐)과 §12.2 첫 연습 판.
    expect(joined).toContain('창을 닫으면 그 판은 사라져요');
    expect(joined).not.toMatch(/이어하기|저장하고 나가기|저장된 판|저장/);
    expect(joined).toContain('연습 판');
    expect(joined).toContain('모르겠어요');
    expect(joined).toContain('연속 정답 보너스');
    expect(joined).toContain('밝은 흙길');
    expect(joined).toContain('속담·관용구·방언');
    expect(joined).toContain('이번 판 끝내기');
    // 용어(ui-rules-v4 §6): terms.test.ts 금지어 중 설명서에 나오기 쉬운 말.
    expect(joined).not.toMatch(/버닝|불꽃|고비|대장|징집|명예점|출정|군자금|원정|종족|수호|왕국|처음으로/);
    expect(joined).not.toContain('!');
    expect(joined).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(joined).not.toMatch(/[A-Za-z]{2,}/);
  });

  it('계약값이 바뀌면 모든 장의 수치가 따라 바뀐다(하드코딩 없음)', () => {
    const custom = structuredClone(BALANCE);
    custom.run.startGold = 155;
    custom.run.prepAttempts = { firstWave: 4, laterWaves: 3 };
    custom.run.sellRatioBP = 7000;
    custom.run.undoBuildMs = 5000;
    custom.waves.bossEveryWaves = 6;
    custom.burning = { streak: 4, durationMs: 9000, attackSpeedBP: 3500, streakAcrossWaves: true };
    custom.levels.evolveAt = [5, 8];
    custom.draft.startTowers = ['archer', 'frost'];
    custom.draft.afterWaves = [4, 8];
    custom.relics!.fromWave = 15;

    const [ch1, ch2, ch3, ch4, ch5] = buildGuideChapters(custom).map(ch => [ch.headline, ...ch.rows.map(r => `${r.badge} ${r.title} ${r.body}`)].join(' '));
    expect(ch1).toContain('155골드');
    expect(ch1).toContain('4문제');
    expect(ch1).toContain('3문제');
    expect(ch1).toContain('6의 배수');
    expect(ch2).toContain('4연속');
    expect(ch2).toContain('9초');
    expect(ch2).toContain('+35%');
    expect(ch2, '2단(tier2)이 없으면 2단 문장을 쓰지 않는다').not.toMatch(/\d연속이면/);
    expect(ch3).toContain('궁수탑·서리탑');
    expect(ch3).not.toContain('포탑');
    expect(ch3).toContain('레벨 5·8');
    expect(ch3).toContain('70%');
    expect(ch4).toContain('어려움부터는 속담·관용구·방언');
    expect(ch5).toContain('4·8웨이브');
    expect(ch5).toContain('15웨이브부터');
    expect(ch5).toContain('5초 안에는');
  });

  it('G2: 1장 수비 시연 — 4박(준비·설치·전투·회복)과 정답 +N골드 배지가 계약에서 나온다', () => {
    expect(GUIDE_WAVE_BEATS.map(b => b.label)).toEqual(['1. 준비', '2. 설치', '3. 전투', '4. 회복']);
    const normal = BALANCE.difficulties.Normal;
    expect(sampleGuideWaveLoop(360, 110, 0, false, 0).goldTag).toBe(`정답 +${correctGoldAt(normal, 1)}골드`);
    expect(sampleGuideWaveLoop(360, 110, 0, false, 1).goldTag).toBe(`${BALANCE.towers.archer.label} ${BALANCE.towers.archer.cost}골드`);
    expect(sampleGuideWaveLoop(360, 110, 0, false, 2).goldTag).toBe(`처치 +${normal.killGold.regular}~${normal.killGold.boss}골드`);
    expect(sampleGuideWaveLoop(360, 110, 0, false, 3).statusTag).toBe(`성문 ${normal.gateHp}/${normal.gateHp} 회복`);
    expect(sampleGuideWaveLoop(360, 110, 0, false, 3).goldTag).toBe(`보스 웨이브 +${normal.milestoneSurvivalGold}골드`);
  });

  it('G2: 수비 순환은 결정론이고 4박을 돌며, 움직임을 끄면 시간과 무관한 대표 장면 하나다', () => {
    const a = sampleGuideWaveLoop(360, 110, 5600, true, null);
    expect(a).toEqual(sampleGuideWaveLoop(360, 110, 5600, true, null));
    expect(sampleGuideWaveLoop(360, 110, 800, true, null).beat).toBe(0);
    expect(sampleGuideWaveLoop(360, 110, 3200, true, null).beat).toBe(1);
    const combat = sampleGuideWaveLoop(360, 110, 5800, true, null);
    expect(combat.beat).toBe(2);
    expect(combat.enemies).toHaveLength(3);
    expect(combat.projectiles).toHaveLength(2);
    expect(sampleGuideWaveLoop(360, 110, 8600, true, null).beat).toBe(3);

    const still = sampleGuideWaveLoop(360, 110, 0, false, null);
    expect(still).toEqual(sampleGuideWaveLoop(360, 110, 7432, false, null));
    expect(still.beat).toBe(2);
    expect(still.showRangeOverlay).toBe(true);
    // 박을 고정하면 움직임을 꺼도 그 박이 보인다.
    expect(sampleGuideWaveLoop(360, 110, 0, false, 0).beat).toBe(0);
  });

  it('G3: 2장 결과 시연 — 연속 정답 보너스 골드와 2단 속도가 계약(run.answerStreakBonus·burning.tier2)과 일치한다', () => {
    const normal = BALANCE.difficulties.Normal;
    const base = correctGoldAt(normal, 1);
    const specs = buildQuizOutcomeSpecs();
    expect(specs.map(s => s.id)).toEqual(['correct', 'wrong', 'skip', 'streak']);
    const by = Object.fromEntries(specs.map(s => [s.id, s]));
    expect(by.correct!.gold).toBe(base);
    expect(by.correct!.scoreText).toBe(`+${normal.correctPt}점`);
    expect(by.wrong!.gold).toBe(0);
    expect(by.wrong!.scoreText).toBe(`${normal.wrongPt}점`);
    expect(by.skip!.gold).toBe(0);
    expect(by.skip!.scoreText).toBe(`${normal.skipPt}점`);

    const streak = BALANCE.burning.streak;
    const bonus = streakBonusGold(BALANCE, streak);
    expect(bonus, '지금 계약에는 연속 정답 보너스가 있다').toBeGreaterThan(0);
    expect(by.streak!.label).toBe(`${streak}연속 정답`);
    expect(by.streak!.gold).toBe(base + bonus);
    expect(by.streak!.goldText).toBe(`+${base + bonus}골드(보너스 +${bonus})`);
    expect(by.streak!.litCount).toBe(streak);
    expect(by.streak!.gateNote).toBe(`${BALANCE.burning.durationMs / 1000}초 동안 +${BALANCE.burning.attackSpeedBP / 100}%`);
    const tier2 = BALANCE.burning.tier2!;
    expect(by.streak!.summary).toContain(`${tier2.streak}연속이면 +${tier2.attackSpeedBP / 100}%`);
    // 지금 계약 값(balance 1.0.0): 보통 정답 19골드 + 3연속 보너스 6골드, 1단 +25%, 2단(6연속) +40%.
    expect([base, bonus, BALANCE.burning.attackSpeedBP, tier2.streak, tier2.attackSpeedBP]).toEqual([19, 6, 2500, 6, 4000]);

    // 보너스 규칙을 바꾸면 따라 바뀐다.
    const custom = structuredClone(BALANCE);
    custom.run.answerStreakBonus = { goldPerStreak: 5, maxGold: 7 };
    delete custom.burning.tier2;
    const s = buildQuizOutcomeSpecs(custom).find(x => x.id === 'streak')!;
    expect(s.gold).toBe(base + 7);
    expect(s.summary).toBe(`전투 중 ${streak}연속이면 모든 타워가 +${BALANCE.burning.attackSpeedBP / 100}% 빨라져요.`);
  });

  it('G4: 3장 시연은 시작 4종(계약 draft.startTowers)의 비용·사거리·두 갈래 진화', () => {
    const items = buildTowerGuideItems();
    expect(items.map(t => t.id)).toEqual(BALANCE.draft.startTowers);
    expect(items).toHaveLength(4);
    for (const t of items) {
      const tower = BALANCE.towers[t.id];
      expect(t.costGold).toBe(tower.cost);
      expect(t.rangeMilli).toBe(tower.rangeMilli);
      expect(t.branchATitle).toContain(BALANCE.forms[t.id]!.A.label);
      expect(t.branchBTitle).toContain(BALANCE.forms[t.id]!.B.label);
    }
    expect(items[0]!.rangeCellsText).toBe('2.5칸');
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

  it('G7: 타워 상성은 계약 strongVs(20종)에서 만든다 — 적 특성 아이콘 8개, 손으로 적은 짝 없음', () => {
    const rows = buildCounterRows();
    expect(TOWER_IDS).toHaveLength(20);
    expect(rows.map(r => r.tag)).toEqual(['flyer', 'shell', 'swarm', 'runner', 'wisp', 'splitter', 'clay', 'burrow']);
    for (const r of rows) {
      const expected = TOWER_IDS.filter(id => (BALANCE.towers[id].strongVs ?? []).includes(r.tag));
      expect(r.towers.map(t => t.id), `${r.enemy}`).toEqual(expected);
      expect(r.towers.map(t => t.label)).toEqual(expected.map(id => BALANCE.towers[id].label));
      expect(existsSync(`./public/assets/ui/${r.icon}.png`), `${r.icon} 아이콘`).toBe(true);
    }
    // 지금 계약: 나는 적은 거대노포·매사냥대·바람개비탑.
    expect(rows[0]!.towers.map(t => t.id)).toEqual(['ballista', 'falcon', 'wind']);
    expect(new Set(rows.flatMap(r => r.towers.map(t => t.id))).size).toBeGreaterThan(10);

    const custom = structuredClone(BALANCE);
    custom.towers.archer.strongVs = ['flyer'];
    expect(buildCounterRows(custom)[0]!.towers[0]!.id).toBe('archer');
  });

  it('G1: nextGuideChapter는 1~5장 경계 밖으로 넘어가지 않는다', () => {
    expect(nextGuideChapter(1, -1)).toBe(1);
    expect(nextGuideChapter(1, 1)).toBe(2);
    expect(nextGuideChapter(4, 1)).toBe(5);
    expect(nextGuideChapter(5, 1)).toBe(5);
    expect(nextGuideChapter(5, -1)).toBe(4);
  });

  it('그림: 1~4장 전용 삽화는 RGBA PNG, 5장은 그림이 오기 전까지 자리만 잡는다(ART-OAK2)', () => {
    const chapters = buildGuideChapters();
    for (const ch of chapters.slice(0, 4)) expect(ch.illustrationUrl, `${ch.id}장 그림`).not.toBeNull();
    for (const ch of chapters) {
      if (!ch.illustrationUrl) continue;
      const diskPath = `./public/${ch.illustrationUrl}`;
      expect(existsSync(diskPath), `${diskPath} 누락`).toBe(true);
      const png = readFileSync(diskPath);
      expect(png.byteLength).toBeGreaterThan(10_000);
      expect(png.byteLength).toBeLessThanOrEqual(450 * 1024);
      expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
      expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(400);
      expect(png.readUInt32BE(16)).toBeLessThanOrEqual(800);
      expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(180);
      expect(png.readUInt32BE(20)).toBeLessThanOrEqual(360);
      expect(png[25], 'RGBA(colorType 6)').toBe(6);
    }
    expect(chapters[4]!.illustrationAlt.length).toBeGreaterThan(0);
  });

  it('보존 계약: 도메인 practiceContext 계약은 그대로다', () => {
    const ctx = practiceContext();
    expect(ctx.balance.run.prepAttempts.firstWave).toBe(1);
    expect(ctx.balance.waves.count.base).toBe(3);
  });
});
