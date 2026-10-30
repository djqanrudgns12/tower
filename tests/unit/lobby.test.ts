import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, gradeContent } from '../../src/content';
import { computeHonorPoints, kstDateKey, kstIsoWeekKey } from '../../src/contracts/lobby';
import {
  loadAllStudyCards,
  pickRandomInitialStudyIndex,
  pickRandomStudyIndex,
  recommendNickname,
  selectDailySteleCards,
} from '../../src/application/lobby';
import {
  addRecord,
  clearLocalHistory,
  enqueueRunSync,
  listPendingRunSyncs,
  listRecords,
  resetDbConnection,
  type RunRecord,
} from '../../src/persistence/db';
import { buildLocalRanking } from '../../src/persistence/lobbyClient';
import { normalizeSettings, type Settings } from '../../src/persistence/settings';
import { SoundDirector } from '../../src/ui/audio/sound';
import { cleanNickname } from '../../src/ui/copy';

const sampleRecord = (overrides: Partial<RunRecord>): RunRecord => ({
  runId: crypto.randomUUID(),
  nickname: '하늘바람',
  grade: 3,
  difficulty: 'Normal',
  mapId: 'garden_u',
  pt: 1200,
  completedWave: 6,
  endedAtWave: 7,
  correct: 14,
  wrong: 2,
  skipped: 1,
  endedAt: '2026-10-30T03:00:00.000Z',
  endReason: 'DEFEAT',
  contentMode: 'published',
  balanceVersion: '0.4.0',
  bankVersion: 'pub-test',
  ...overrides,
});

describe('랜딩 로비 · 설정 v2 · 비석 학습 · 세분화 랭킹 단위 검증', () => {
  beforeEach(async () => {
    await resetDbConnection();
    await clearLocalHistory();
  });

  it('Settings v1 저장본에서 v2 확장 필드로 손실 없이 정규화하고 motionMode ↔ reducedMotion을 동기화한다', () => {
    const base: Settings = {
      fontScale: 'base',
      reducedMotion: false,
      lastDifficulty: 'Normal',
      lastNickname: '',
      playerId: 'p-1',
      practiceSeen: false,
      soundOn: true,
      lastGrade: 3,
      bgmVolume: 0.2,
      sfxVolume: 0.4,
      motionMode: 'full',
      highContrastMap: false,
      showKeyHints: true,
    };

    const migrated = normalizeSettings(base, { reducedMotion: true, lastNickname: '솔방울' });
    expect(migrated.motionMode).toBe('minimal');
    expect(migrated.reducedMotion).toBe(true);
    expect(migrated.lastNickname).toBe('솔방울');

    const simple = normalizeSettings(migrated, { motionMode: 'simple' });
    expect(simple.motionMode).toBe('simple');
    expect(simple.reducedMotion).toBe(false);

    // 허용 단계 밖의 볼륨 값은 가장 가까운 단계로 클램프된다.
    const clamped = normalizeSettings(base, { bgmVolume: 0.99 as Settings['bgmVolume'], sfxVolume: 0.38 as Settings['sfxVolume'] });
    expect(clamped.bgmVolume).toBe(0.5);
    expect(clamped.sfxVolume).toBe(0.4);
  });

  it('SoundDirector.setVolumes와 preview가 배경 루프를 켜지 않고 즉시 게인과 효과음을 반영한다', () => {
    const gains: { value: number }[] = [];
    let oscillators = 0;
    const fakeCtx = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createGain: () => {
        const node = {
          gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        gains.push(node.gain);
        return node;
      },
      createOscillator: () => {
        oscillators++;
        return {
          type: 'sine',
          frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      },
      resume: vi.fn(() => Promise.resolve()),
      suspend: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
    };

    const sd = new SoundDirector(DEFAULTS.audio, 5, () => fakeCtx as unknown as AudioContext);
    sd.setVolumes(0.35, 0.6);
    sd.preview('correct');
    expect(sd.bgmRunning).toBe(false);
    expect(oscillators).toBeGreaterThan(0);
    // 첫 createGain은 sfxBus(0.6), 두 번째는 bgmBus(0.35)
    expect(gains[0]?.value).toBe(0.6);
    expect(gains[1]?.value).toBe(0.35);
    sd.dispose();
  });

  it('다중 문형 별명 랜덤 추천기(recommendNickname)는 500회 연속 호출해도 cleanNickname을 100% 통과하고 높은 다양성을 보장한다', () => {
    let prev = '';
    const sample100 = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const next = recommendNickname(prev);
      expect(cleanNickname(next)).toEqual({ value: next, error: null });
      expect(next).not.toBe(prev);
      if (i < 100) sample100.add(next);
      prev = next;
    }
    expect(sample100.size).toBeGreaterThanOrEqual(80);
  });

  it('오늘의 낱말 공부(selectDailySteleCards · pickRandomStudyIndex)는 5개 제한 없이 다양한 수준의 등록 낱말을 추출·순환하고 철회 문항을 배제한다', () => {
    const d1 = new Date('2026-10-29T15:05:00.000Z'); // KST 2026-10-30 00:05
    const d2 = new Date('2026-10-30T14:55:00.000Z'); // KST 2026-10-30 23:55 (같은 KST 일자)
    expect(kstDateKey(d1)).toBe('2026-10-30');
    expect(kstDateKey(d2)).toBe('2026-10-30');

    const cardsA = selectDailySteleCards(3, d1);
    const cardsB = selectDailySteleCards(3, d2);
    expect(cardsA.length).toBeGreaterThan(20);
    expect(cardsA).toEqual(cardsB);

    // 다양한 수준(levelLabel)이 고르게 포함되고 랜덤 선택기가 서로 다른 수준·미방문 낱말을 우선 순환하는지 확인
    const distinctLevels = new Set(cardsA.map(c => c.levelLabel));
    expect(distinctLevels.size).toBeGreaterThanOrEqual(4);

    const visited = new Set<number>([0]);
    let current = 0;
    const sampledLevels = new Set<string>([cardsA[0]!.levelLabel]);
    for (let i = 0; i < 10; i++) {
      const next = pickRandomStudyIndex(cardsA, current, visited);
      expect(next).not.toBe(current);
      expect(visited.has(next)).toBe(false);
      visited.add(next);
      sampledLevels.add(cardsA[next]!.levelLabel);
      current = next;
    }
    expect(sampledLevels.size).toBeGreaterThanOrEqual(3);

    // 해당 senseKey의 모든 문항을 철회 목록에 넣으면 결과에서 즉시 빠진다(L11).
    const targetGrade = Number.parseInt(cardsA[0]!.gradeLabel, 10);
    const bank = gradeContent(targetGrade).bank!;
    const retractedTarget = bank.questions.find(q => q.id === cardsA[0]!.questionId)!;
    const sameSenseEntries = [3, 4, 5, 6]
      .flatMap(g => gradeContent(g).bank?.questions ?? [])
      .filter(q => q.target.senseKey === retractedTarget.target.senseKey)
      .map(q => ({
        questionId: q.id,
        revision: q.revision,
        reason: '검증 테스트 철회',
        retractedAt: '2026-10-30T00:00:00Z',
      }));
    const filtered = selectDailySteleCards(3, d1, {
      listVersion: '1',
      entries: sameSenseEntries,
    });
    expect(filtered.some(c => c.lemma === retractedTarget.target.lemma && c.partOfSpeech === retractedTarget.target.partOfSpeech && c.questionId === retractedTarget.id)).toBe(false);
  });

  it('전체 낱말 로더(loadAllStudyCards)는 서버에 구현된 3~6학년 전체 낱말을 정제·로드하고 랜덤 순환 시 중복 없이 다양한 학년을 노출한다', async () => {
    const allCards = await loadAllStudyCards();
    expect(allCards.length).toBeGreaterThan(2000);

    const grades = new Set(allCards.map(c => c.gradeLabel));
    expect(grades).toEqual(new Set(['3학년', '4학년', '5학년', '6학년']));

    for (const card of allCards) {
      expect(card.lemma.length).toBeGreaterThan(0);
      expect(card.meaning.length).toBeGreaterThan(0);
      const example = `${card.examplePrefix}${card.exampleHighlight}${card.exampleSuffix}`.trim();
      expect(example.length).toBeGreaterThanOrEqual(4);
      expect(example).not.toMatch(/무엇일까요|알맞은\s*것은|고르시오|고르세요|골라\s*보세요|빈칸에\s*들어갈|\(\s*\)/);
    }

    const startIdx = pickRandomInitialStudyIndex(allCards.length);
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(startIdx).toBeLessThan(allCards.length);

    const visited = new Set<number>([startIdx]);
    let cur = startIdx;
    const sampledGrades = new Set<string>([allCards[cur]!.gradeLabel]);
    for (let i = 0; i < 30; i++) {
      const next = pickRandomStudyIndex(allCards, cur, visited);
      expect(next).not.toBe(cur);
      expect(allCards[next]!.lemma).not.toBe(allCards[cur]!.lemma);
      expect(visited.has(next)).toBe(false);
      visited.add(next);
      sampledGrades.add(allCards[next]!.gradeLabel);
      cur = next;
    }
    expect(sampledGrades.size).toBeGreaterThanOrEqual(3);

    const target = allCards[0]!;
    const afterRetract = await loadAllStudyCards({
      listVersion: '1',
      entries: [{
        questionId: target.questionId,
        revision: 1,
        reason: '단위 검증 철회',
        retractedAt: '2026-10-30T00:00:00Z',
      }],
    });
    expect(afterRetract.some(c => c.questionId === target.questionId)).toBe(false);
  });

  it('원정 명예점(computeHonorPoints)은 0웨이브 조기 종료를 0점 처리하고 난이도 정수 가중치를 정확히 적용한다', () => {
    expect(computeHonorPoints({ pt: 900, difficulty: 'Crazy', completedWave: 0, correct: 5 })).toBe(0);
    // 음수 점수여도 1웨이브 이상 생존했으면 웨이브·정답 기본 명예점은 적립된다.
    expect(computeHonorPoints({ pt: -120, difficulty: 'Normal', completedWave: 2, correct: 3 })).toBe(2 * 15 + 3 * 2);
    // Crazy(150%): trunc(1000 * 150 / 100) + 10*15 + 20*2 = 1500 + 150 + 40 = 1690
    expect(computeHonorPoints({ pt: 1000, difficulty: 'Crazy', completedWave: 10, correct: 20 })).toBe(1690);
    // 판당 상한 5000
    expect(computeHonorPoints({ pt: 99999, difficulty: 'Crazy', completedWave: 50, correct: 100 })).toBe(5000);
  });

  it('세분화 로컬 랭킹(buildLocalRanking)은 학년·난이도 리그를 분리하고 누적 명예점·동기화 큐를 정확히 관리한다', async () => {
    const rNormal = sampleRecord({ nickname: '참나무방패', grade: 3, difficulty: 'Normal', pt: 1500, completedWave: 8, correct: 18, endedAt: '2026-10-30T01:00:00.000Z' });
    const rHard = sampleRecord({ nickname: '별빛수호자', grade: 3, difficulty: 'Hard', pt: 2400, completedWave: 11, correct: 22, endedAt: '2026-10-30T02:00:00.000Z' });
    const rOldWeek = sampleRecord({ nickname: '참나무방패', grade: 3, difficulty: 'Normal', pt: 800, completedWave: 4, correct: 9, endedAt: '2026-10-01T02:00:00.000Z' });

    await addRecord(rNormal);
    await addRecord(rHard);
    await addRecord(rOldWeek);

    // 한 판 최고점(3학년 Normal): Hard 기록(2400점)이 절대 섞이지 않아야 한다(PRD §15.1).
    const normalBoard = await buildLocalRanking(
      { tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0 },
      '참나무방패',
      new Date('2026-10-30T04:00:00.000Z'),
    );
    expect(normalBoard.entries).toHaveLength(1);
    expect(normalBoard.entries[0]?.nickname).toBe('참나무방패');
    expect(normalBoard.entries[0]?.primaryValue).toBe(1500);

    // 누적 명예점: 주간(2026-W44) vs 누적(all_time) 분리 검증
    expect(kstIsoWeekKey(new Date('2026-10-30T04:00:00.000Z'))).toBe('2026-W44');
    const weeklyHonor = await buildLocalRanking(
      { tab: 'honor_points', grade: 'all', difficulty: 'Normal', period: 'weekly', limit: 8, offset: 0 },
      '참나무방패',
      new Date('2026-10-30T04:00:00.000Z'),
    );
    const allTimeHonor = await buildLocalRanking(
      { tab: 'honor_points', grade: 'all', difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0 },
      '참나무방패',
      new Date('2026-10-30T04:00:00.000Z'),
    );
    const myWeekly = weeklyHonor.myEntry!.primaryValue;
    const myAllTime = allTimeHonor.myEntry!.primaryValue;
    expect(myAllTime).toBeGreaterThan(myWeekly);

    // 오프라인 동기화 큐 멱등 적재 및 clearLocalHistory 정리 검증
    await enqueueRunSync(rNormal, 'player-uuid');
    await enqueueRunSync(rNormal, 'player-uuid');
    expect(await listPendingRunSyncs()).toHaveLength(1);

    await clearLocalHistory();
    expect(await listRecords()).toHaveLength(0);
    expect(await listPendingRunSyncs()).toHaveLength(0);
  });
});
