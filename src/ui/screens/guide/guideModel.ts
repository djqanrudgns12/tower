import { BALANCE } from '../../../content';
import { TOWER_IDS, type Balance, type FoeTag, type TowerId } from '../../../contracts/balance';
import { correctGoldAt, streakBonusGold } from '../../../domain/run';
import { matchupOf } from '../../../domain/towers';
import { BRANCH_MARK, fmtCells } from '../../copy';
import { FOE_LABEL, FOE_TRAIT_ICON } from '../../game/counters';
import type { ArtIconName } from '../../kit';
import { difficultyReadout } from './difficultyReadout';

// 사용 설명서 모델(R5 G1~G9). 화면 글과 수치는 모두 여기서 계약(balance·출제 문턱)을 읽어 만든다. 손으로 적은 수치를 두지 않는다.

export const GUIDE_CHAPTER_IDS = [1, 2, 3, 4, 5] as const;
export type GuideChapterId = (typeof GUIDE_CHAPTER_IDS)[number];

export type GuideRowIconId = 'gold' | 'play' | 'gate' | 'score' | 'seal' | 'flame' | 'range' | 'branch' | 'key' | 'pause' | 'chest' | 'undo' | 'note';

export interface GuideSummaryRow {
  /** 단계 배지('1단계' 등). */
  badge: string;
  title: string;
  /** 읽는 글 한 문단(95자 이하, G8). */
  body: string;
  icon: GuideRowIconId;
}

export interface GuideChapterSpec {
  id: GuideChapterId;
  title: string;
  /** 목차 카드에 늘 보이는 한 문장(30자 이하). */
  sentence: string;
  /** 장 머리띠 옆 한 줄 요지. */
  headline: string;
  /** 그림 경로(public 기준). 아직 그림이 없으면 null — 화면은 같은 크기의 자리만 잡는다. */
  illustrationUrl: string | null;
  illustrationAlt: string;
  rows: readonly [GuideSummaryRow, GuideSummaryRow, GuideSummaryRow];
}

export function nextGuideChapter(current: GuideChapterId, delta: -1 | 1): GuideChapterId {
  const idx = GUIDE_CHAPTER_IDS.indexOf(current);
  const nextIdx = Math.max(0, Math.min(GUIDE_CHAPTER_IDS.length - 1, idx + delta));
  return GUIDE_CHAPTER_IDS[nextIdx] ?? current;
}

/** 장 머리띠 글: "제N장 · 제목". */
export const chapterLabel = (ch: Pick<GuideChapterSpec, 'id' | 'title'>) => `제${ch.id}장 · ${ch.title}`;

/** 오답 노트 졸업 횟수. 화면은 persistence를 읽지 못해(PRD §13.2 모듈 경계) 값을 옮겨 적고, 단위 시험이 REVIEW_GRADUATE_CLEARS와 같은지 본다. */
export const GUIDE_NOTE_CLEARS = 2;

const secText = (ms: number) => `${Math.round(ms / 1000)}초`;
const pctText = (bp: number) => `+${Math.round(bp / 100)}%`;

/** 5장 설명서. 런타임 밸런스 계약을 직접 읽는다(하드코딩 금지). */
export function buildGuideChapters(balance: Balance = BALANCE): readonly GuideChapterSpec[] {
  const { run, burning, levels, draft, relics } = balance;
  const startNames = draft.startTowers.map(id => balance.towers[id].label).join('·');
  const sellPct = Math.round(run.sellRatioBP / 100);
  const [evolveA, evolveB] = levels.evolveAt;
  const tier2 = burning.tier2 ? ` ${burning.tier2.streak}연속이면 ${pctText(burning.tier2.attackSpeedBP)}예요.` : '';
  const advancedFrom = (['Easy', 'Normal', 'Hard', 'Crazy'] as const).map(id => difficultyReadout(id, balance)).find(r => r.advanced);
  const draftWaves = draft.afterWaves.join('·');

  return [
    {
      id: 1,
      title: '한 판 흐름',
      sentence: '문제를 풀고 타워로 성문을 지켜요',
      headline: '문제로 골드를 모아 타워를 세우고, 성문을 끝까지 지켜요',
      illustrationUrl: 'assets/guide/guide.ch1.wave_cycle.png',
      illustrationAlt: '금화 준비부터 궁수·서리 타워의 공격과 성문 회복으로 이어지는 수비 흐름 그림',
      rows: [
        {
          badge: '1단계',
          title: '준비 문제',
          body: `${run.startGold}골드로 시작해요. 첫 웨이브는 ${run.prepAttempts.firstWave}문제, 다음부터는 ${run.prepAttempts.laterWaves}문제를 먼저 풀어 골드를 모아요.`,
          icon: 'gold',
        },
        {
          badge: '2·3단계',
          title: '설치와 전투',
          body: '빈 돌 받침에 타워를 놓고 ‘전투 시작’을 눌러요. 싸우는 동안에도 문제를 풀어 골드를 벌어요.',
          icon: 'play',
        },
        {
          badge: '4단계',
          title: '성문 회복과 보스',
          body: `웨이브를 막으면 성문이 다시 가득 차고, 0이 되면 판이 끝나요. ${balance.waves.bossEveryWaves}의 배수 웨이브에는 보스가 와요.`,
          icon: 'gate',
        },
      ],
    },
    {
      id: 2,
      title: '문제와 골드',
      sentence: '맞히면 골드, 모르면 뜻을 배워요',
      headline: `모르면 감점 없이 뜻을 배우고, ${burning.streak}연속 정답이면 보너스가 켜져요`,
      illustrationUrl: 'assets/guide/guide.ch2.quiz_burning.png',
      illustrationAlt: '골드 주화와 문장 방패, 세 개의 붉은 보석과 빨라진 화살 그림',
      rows: [
        {
          badge: '보상',
          title: '골드와 점수',
          body: '골드는 타워를 놓고 키우는 데 쓰고, 점수는 랭킹 점수에 쌓이는 실력 기록이에요.',
          icon: 'score',
        },
        {
          badge: '안전장치',
          title: '오답과 ‘모르겠어요’',
          body: '틀려도 골드와 성문은 그대로고 점수만 줄어요. ‘모르겠어요’는 감점 없이 정답과 뜻을 알려 줘요.',
          icon: 'seal',
        },
        {
          badge: '연속 보너스',
          title: '연속 정답 보너스',
          body: `전투 중 ${burning.streak}문제를 연달아 맞히면 ${secText(burning.durationMs)} 동안 모든 타워가 ${pctText(burning.attackSpeedBP)} 빨라져요.${tier2}`,
          icon: 'flame',
        },
      ],
    },
    {
      id: 3,
      title: '타워 놓기와 진화',
      sentence: '타워를 놓고 키워서 진화시켜요',
      headline: `밝은 흙길이 많이 닿는 길목에 놓고, 레벨 ${evolveA}에서 진화 길을 골라요`,
      illustrationUrl: 'assets/guide/guide.ch3.tower_evolution.png',
      illustrationAlt: '굽은 흙길 위 밝은 사거리 원과 두 갈래 진화 문장, 판매 환급 상자 그림',
      rows: [
        {
          badge: '사거리',
          title: '사거리 원과 밝은 흙길',
          body: '받침이나 타워를 고르면 원 안의 밝은 흙길이 공격 범위로 보여요. 굽은 길목일수록 오래 맞혀요.',
          icon: 'range',
        },
        {
          badge: '진화',
          title: `레벨 ${evolveA}·${evolveB} 진화`,
          body: `${startNames}으로 시작해요. 레벨 ${evolveA}에서 두 갈래 중 하나를 고르고, 고른 길은 바꿀 수 없어요.`,
          icon: 'branch',
        },
        {
          badge: '판매',
          title: `${sellPct}% 돌려받기`,
          body: `자리나 조합을 바꾸고 싶으면 타워를 눌러 팔아요. 쓴 골드의 ${sellPct}%를 돌려받아요.`,
          icon: 'gold',
        },
      ],
    },
    {
      id: 4,
      title: '시작과 끝내기',
      sentence: '학년·난이도를 고르고, 끝나면 기록돼요',
      headline: '학년은 낱말과 지도를, 난이도는 성문 체력과 문제 범위를 정해요',
      illustrationUrl: 'assets/guide/guide.ch4.expedition_command.png',
      illustrationAlt: '돌 표지석과 4단계 난이도 방패, 나무 방향·숫자 키와 정지 등불 그림',
      rows: [
        {
          badge: '시작',
          title: '학년과 난이도',
          body: `학년(3~6학년)은 교과 낱말과 지도를 정해요.${advancedFrom ? ` ${advancedFrom.label}부터는 속담·관용구·방언도 나와요.` : ''}`,
          icon: 'gate',
        },
        {
          badge: '조작',
          title: '연습 판과 단축키',
          // 첫 연습 판(PRD §12.2): 기록·점수에 남지 않고 건너뛸 수 있다.
          body: '처음이라면 홈의 연습 판으로 익혀요. 보기는 숫자키 1~4, 전장 자리는 방향키와 엔터로 골라요.',
          icon: 'key',
        },
        {
          badge: '끝내기',
          title: '정지와 이번 판 끝내기',
          // 이어하기 없음(PRD §14.1): 판은 메모리에만 있어 끝내기·패배 때만 기록되고, 창을 닫으면 사라진다.
          body: '정지하면 전투가 멈추고 문제가 가려져요. ‘이번 판 끝내기’로 끝내야 기록되고, 창을 닫으면 그 판은 사라져요.',
          icon: 'pause',
        },
      ],
    },
    {
      id: 5,
      title: '새 타워와 적 특성',
      sentence: '새 타워·보물을 고르고 적 특성을 살펴요',
      headline: relics ? `${draftWaves}웨이브를 지키면 새 타워를, ${relics.fromWave}웨이브부터는 보물을 골라요` : `${draftWaves}웨이브를 지키면 새 타워를 골라요`,
      // ART-OAK2 guide.ch5.new_features(메인이 넣어 준다). 오기 전에는 화면이 자리만 잡는다.
      illustrationUrl: null,
      illustrationAlt: '펼친 타워 카드 세 장, 보물 상자, 트로피, 오답 노트, 끌어 놓는 타워와 되돌리기 화살표 그림',
      rows: [
        {
          badge: `${draftWaves}웨이브`,
          title: '새 타워와 보물',
          body: `없는 타워 ${draft.offerCount}종 중 1종을 골라요(최대 ${draft.maxOwned}칸).${relics ? ` ${relics.fromWave}웨이브부터 보스를 막으면 보물 ${relics.offerCount}개 중 1개를 골라요.` : ''}`,
          icon: 'chest',
        },
        {
          badge: '설치',
          title: '끌어 놓기와 되돌리기',
          body: `아래 타워 칸에서 빈 받침으로 끌어 놓아도 돼요. 놓고 ${secText(run.undoBuildMs)} 안에는 되돌려 골드를 모두 돌려받아요.`,
          icon: 'undo',
        },
        {
          badge: '기록',
          title: '최고 기록과 오답 노트',
          body: `웨이브 옆에 최고 기록이 보여요. 틀리거나 모른 낱말은 오답 노트에 모이고, 다른 판에서 ${GUIDE_NOTE_CLEARS}번 맞히면 빠져요.`,
          icon: 'note',
        },
      ],
    },
  ];
}

// ── 1장 시연(G2): 준비·설치·전투·회복 4박 수비 캔버스 ──

export type GuideWaveBeatId = 0 | 1 | 2 | 3;

export const GUIDE_WAVE_BEATS: readonly { id: GuideWaveBeatId; label: string }[] = [
  { id: 0, label: '1. 준비' },
  { id: 1, label: '2. 설치' },
  { id: 2, label: '3. 전투' },
  { id: 3, label: '4. 회복' },
];

export interface GuideLoopEnemy {
  kind: 'walker' | 'boss';
  x: number;
  y: number;
  hpRatio: number;
  frameIdx: number;
  hit: boolean;
}

export interface GuideLoopProjectile {
  towerId: 'archer' | 'frost';
  x: number;
  y: number;
}

export interface GuideWaveLoopSnapshot {
  beat: GuideWaveBeatId;
  beatProgress01: number;
  towersBuilt: boolean;
  showRangeOverlay: boolean;
  gateSparkle01: number;
  /** 캔버스 왼쪽 위 배지: 지금 단계. */
  statusTag: string;
  /** 캔버스 오른쪽 위 배지: 이 단계의 골드(정답 +N골드 등). */
  goldTag: string;
  enemies: GuideLoopEnemy[];
  projectiles: GuideLoopProjectile[];
  archerAngle: number;
  archerRecoil: number;
}

export const GUIDE_LOOP_MS = 10_000;
const GUIDE_BEAT_MS = GUIDE_LOOP_MS / 4;

export const GUIDE_ROAD_WAYPOINTS: readonly [number, number][] = [
  [-0.04, 0.62],
  [0.24, 0.62],
  [0.38, 0.34],
  [0.64, 0.34],
  [0.76, 0.62],
  [0.9, 0.62],
];

export function samplePolyline(
  waypoints: readonly [number, number][],
  progress01: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, progress01));
  const segCount = waypoints.length - 1;
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < segCount; i++) {
    const [x0, y0] = waypoints[i]!;
    const [x1, y1] = waypoints[i + 1]!;
    const len = Math.hypot((x1 - x0) * w, (y1 - y0) * h);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) {
    const [fx, fy] = waypoints[0]!;
    return { x: fx * w, y: fy * h };
  }
  const target = clamped * total;
  let acc = 0;
  for (let i = 0; i < segCount; i++) {
    const len = segLens[i]!;
    if (acc + len >= target || i === segCount - 1) {
      const t = len > 0 ? Math.max(0, Math.min(1, (target - acc) / len)) : 0;
      const [x0, y0] = waypoints[i]!;
      const [x1, y1] = waypoints[i + 1]!;
      return { x: (x0 + (x1 - x0) * t) * w, y: (y0 + (y1 - y0) * t) * h };
    }
    acc += len;
  }
  const [lx, ly] = waypoints[segCount]!;
  return { x: lx * w, y: ly * h };
}

/** 1장 수비 순환 캔버스의 결정론 상태 계산 함수(Math.random 미사용, 단위 검증 겸용). 움직임을 끄면 시간과 무관한 대표 장면이다. */
export function sampleGuideWaveLoop(
  w: number,
  h: number,
  timeMs: number,
  animate: boolean,
  pinnedBeat: GuideWaveBeatId | null = null,
  balance: Balance = BALANCE,
): GuideWaveLoopSnapshot {
  const normal = balance.difficulties.Normal;
  const normalizedMs = ((timeMs % GUIDE_LOOP_MS) + GUIDE_LOOP_MS) % GUIDE_LOOP_MS;
  const beat: GuideWaveBeatId =
    pinnedBeat !== null
      ? pinnedBeat
      : animate
        ? (Math.min(3, Math.floor(normalizedMs / GUIDE_BEAT_MS)) as GuideWaveBeatId)
        : 2;
  const beatProgress01 =
    pinnedBeat !== null
      ? animate
        ? ((timeMs % GUIDE_BEAT_MS) + GUIDE_BEAT_MS) % GUIDE_BEAT_MS / GUIDE_BEAT_MS
        : 0.52
      : animate
        ? (normalizedMs - beat * GUIDE_BEAT_MS) / GUIDE_BEAT_MS
        : 0.52;

  const archerX = w * 0.31;
  const archerY = h * 0.67;
  const frostX = w * 0.56;
  const frostY = h * 0.58;

  if (beat === 0) {
    return {
      beat,
      beatProgress01,
      towersBuilt: false,
      showRangeOverlay: false,
      gateSparkle01: 0,
      statusTag: `준비 문제 · 첫 웨이브 ${balance.run.prepAttempts.firstWave}문제`,
      goldTag: `정답 +${correctGoldAt(normal, 1)}골드`,
      enemies: [],
      projectiles: [],
      archerAngle: -0.6,
      archerRecoil: 0,
    };
  }

  if (beat === 1) {
    return {
      beat,
      beatProgress01,
      towersBuilt: true,
      showRangeOverlay: true,
      gateSparkle01: 0,
      statusTag: '돌 받침 고르기 · 밝은 길 확인',
      goldTag: `${balance.towers.archer.label} ${balance.towers.archer.cost}골드`,
      enemies: [],
      projectiles: [],
      archerAngle: -0.45,
      archerRecoil: 0,
    };
  }

  if (beat === 3) {
    return {
      beat,
      beatProgress01,
      towersBuilt: true,
      showRangeOverlay: false,
      gateSparkle01: animate ? 0.5 + 0.5 * Math.sin(beatProgress01 * Math.PI * 2) : 0.85,
      statusTag: `성문 ${normal.gateHp}/${normal.gateHp} 회복`,
      goldTag: `보스 웨이브 +${normal.milestoneSurvivalGold}골드`,
      enemies: [],
      projectiles: [],
      archerAngle: -0.5,
      archerRecoil: 0,
    };
  }

  // 3박: 실시간 전투(작은 적 2기 + 보스 1기 행군, 궁수·서리 공격)
  const slots: readonly { kind: 'walker' | 'boss'; offset: number; span: number }[] = [
    { kind: 'walker', offset: 0.08, span: 0.66 },
    { kind: 'walker', offset: 0.22, span: 0.58 },
    { kind: 'boss', offset: 0.0, span: 0.54 },
  ];
  const shotPhase = animate ? ((beatProgress01 * 3) % 1) : 0.64;
  const enemies: GuideLoopEnemy[] = slots.map((s, idx) => {
    const p = Math.min(0.82, s.offset + beatProgress01 * s.span);
    const pos = samplePolyline(GUIDE_ROAD_WAYPOINTS, p, w, h);
    const frameCount = s.kind === 'boss' ? 2 : 4;
    const frameIdx = animate ? Math.floor((timeMs / 160 + idx) % frameCount) : 0;
    const hpRatio = Math.max(0.18, 1 - beatProgress01 * (s.kind === 'boss' ? 0.45 : 0.78));
    return { kind: s.kind, x: pos.x, y: pos.y, hpRatio, frameIdx, hit: idx === 0 && shotPhase > 0.76 };
  });

  const lead = enemies[0]!;
  const boss = enemies[2]!;
  const archerAngle = Math.atan2(lead.y - (archerY - 14), lead.x - archerX);
  const archerRecoil = animate && shotPhase < 0.2 ? (1 - shotPhase / 0.2) * 2.2 : 0;
  const flightT = Math.min(1, shotPhase / 0.85);

  const projectiles: GuideLoopProjectile[] = [
    { towerId: 'archer', x: archerX + (lead.x - archerX) * flightT, y: archerY - 14 + (lead.y - 8 - (archerY - 14)) * flightT },
    { towerId: 'frost', x: frostX + (boss.x - frostX) * flightT, y: frostY - 16 + (boss.y - 10 - (frostY - 16)) * flightT },
  ];

  return {
    beat,
    beatProgress01,
    towersBuilt: true,
    showRangeOverlay: !animate,
    gateSparkle01: 0,
    statusTag: '전투 중에도 문제를 풀어요',
    goldTag: `처치 +${normal.killGold.regular}~${normal.killGold.boss}골드`,
    enemies,
    projectiles,
    archerAngle,
    archerRecoil,
  };
}

// ── 2장 시연(G3): 정답·오답·모르겠어요·연속 정답 → 골드·점수·성문 메모 ──

export type QuizOutcomeId = 'correct' | 'wrong' | 'skip' | 'streak';

export interface QuizOutcomeSpec {
  id: QuizOutcomeId;
  /** 고르기 칸 이름. */
  label: string;
  /** 이번 문제로 받는 골드(정답 골드 + 연속 정답 보너스). */
  gold: number;
  goldText: string;
  scoreText: string;
  /** 성문·효과 메모. */
  gateNote: string;
  /** 불꽃 아이콘이 몇 칸 켜지는가(전투 연속 정답 칸). */
  litCount: number;
  summary: string;
}

/** 보통 난이도·1웨이브 기준 결과별 변화. 연속 정답 보너스(run.answerStreakBonus)와 2단(burning.tier2)까지 계약에서 계산한다. */
export function buildQuizOutcomeSpecs(balance: Balance = BALANCE): readonly QuizOutcomeSpec[] {
  const normal = balance.difficulties.Normal;
  const { burning } = balance;
  const base = correctGoldAt(normal, 1);
  const streakGold = base + streakBonusGold(balance, burning.streak);
  const bonus = streakGold - base;
  const speed = burning.tier2
    ? `${pctText(burning.attackSpeedBP)}, ${burning.tier2.streak}연속이면 ${pctText(burning.tier2.attackSpeedBP)}`
    : pctText(burning.attackSpeedBP);
  return [
    {
      id: 'correct',
      label: '정답',
      gold: base,
      goldText: `+${base}골드`,
      scoreText: `+${normal.correctPt}점`,
      gateNote: '성문 그대로',
      litCount: 1,
      summary: '골드와 점수가 함께 오르고 연속 정답 칸이 1칸 차요.',
    },
    {
      id: 'wrong',
      label: '오답',
      gold: 0,
      goldText: '0골드',
      scoreText: `${normal.wrongPt}점`,
      gateNote: '성문 그대로',
      litCount: 0,
      summary: '골드와 성문은 그대로고 해설을 보여 줘요. 낱말은 오답 노트에 담겨요.',
    },
    {
      id: 'skip',
      label: '모르겠어요',
      gold: 0,
      goldText: '0골드',
      scoreText: `${normal.skipPt}점`,
      gateNote: '감점 없음',
      litCount: 0,
      summary: '찍지 않고 누르면 정답과 뜻을 알려 줘요. 낱말은 오답 노트에 담겨요.',
    },
    {
      id: 'streak',
      label: `${burning.streak}연속 정답`,
      gold: streakGold,
      goldText: bonus > 0 ? `+${streakGold}골드(보너스 +${bonus})` : `+${streakGold}골드`,
      scoreText: `+${normal.correctPt}점`,
      gateNote: `${secText(burning.durationMs)} 동안 ${pctText(burning.attackSpeedBP)}`,
      litCount: burning.streak,
      summary: `전투 중 ${burning.streak}연속이면 모든 타워가 ${speed} 빨라져요.`,
    },
  ];
}

// ── 3장 시연(G4): 시작 타워 사거리·비용·두 갈래 진화 ──

export interface TowerGuideStageItem {
  id: TowerId;
  label: string;
  costGold: number;
  rangeCellsText: string;
  rangeMilli: number;
  branchATitle: string;
  branchASummary: string;
  branchBTitle: string;
  branchBSummary: string;
}

/** 새 판을 시작할 때 가진 타워(계약 draft.startTowers)의 사거리·비용·1차 진화 두 갈래. */
export function buildTowerGuideItems(balance: Balance = BALANCE): readonly TowerGuideStageItem[] {
  return balance.draft.startTowers.map(id => {
    const tower = balance.towers[id];
    const branch = balance.forms[id];
    return {
      id,
      label: tower.label,
      costGold: tower.cost,
      rangeCellsText: fmtCells(tower.rangeMilli),
      rangeMilli: tower.rangeMilli,
      branchATitle: `${BRANCH_MARK.A} · ${branch?.A.label ?? '기본 강화'}`,
      branchASummary: branch?.A.summary ?? '공격이 강해져요',
      branchBTitle: `${BRANCH_MARK.B} · ${branch?.B.label ?? '특수 강화'}`,
      branchBSummary: branch?.B.summary ?? '범위와 효과가 넓어져요',
    };
  });
}

// ── 5장 시연·목차 상성 카드(G7): 적 특성 → 잘 잡는 타워(계약 strongVs, 20종) ──

/** 상성 표에 싣는 적 특성 순서. 원화 특성 아이콘이 있는 표지만 싣는다(FOE_TRAIT_ICON). */
const COUNTER_TAGS: readonly FoeTag[] = ['flyer', 'shell', 'swarm', 'runner', 'wisp', 'splitter', 'clay', 'burrow'];

export interface GuideCounterRow {
  tag: FoeTag;
  icon: ArtIconName;
  /** 적 특성 이름(전투 화면과 같은 이름, FOE_LABEL). */
  enemy: string;
  /** 기본형 strongVs에 이 표지를 적은 타워(계약 TOWER_IDS 순서). */
  towers: readonly { id: TowerId; label: string }[];
}

export function buildCounterRows(balance: Balance = BALANCE): readonly GuideCounterRow[] {
  return COUNTER_TAGS.flatMap(tag => {
    const icon = FOE_TRAIT_ICON[tag];
    if (!icon) return [];
    const towers = TOWER_IDS.filter(id => matchupOf(balance, id, 'base').strongVs.includes(tag)).map(id => ({ id, label: balance.towers[id].label }));
    return towers.length ? [{ tag, icon, enemy: FOE_LABEL[tag], towers }] : [];
  });
}

/** 목차의 타워 상성 카드 글. 누르면 상성 시연이 있는 5장이 열린다. */
export const GUIDE_COUNTER_CARD = { title: '타워 상성', sentence: '적 특성마다 잘 잡는 타워가 있어요', chapter: 5 as GuideChapterId } as const;
