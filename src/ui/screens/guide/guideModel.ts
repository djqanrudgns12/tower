import { BALANCE, PILOT_TOWERS } from '../../../content';
import type { Balance, DifficultyId, TowerId } from '../../../contracts/balance';
import { BRANCH_MARK, DIFFICULTY_COPY, fmtCells, fmtSigned } from '../../copy';

export const GUIDE_CHAPTER_IDS = [1, 2, 3, 4] as const;
export type GuideChapterId = (typeof GUIDE_CHAPTER_IDS)[number];

export type GuideRowIconId =
  | 'gold'
  | 'play'
  | 'gate'
  | 'score'
  | 'seal'
  | 'burning'
  | 'range'
  | 'branch'
  | 'key'
  | 'pause';

export interface GuideSummaryRow {
  badge: string;
  title: string;
  body: string;
  icon: GuideRowIconId;
}

export interface GuideChapterSpec {
  id: GuideChapterId;
  tabLabel: string;
  title: string;
  headline: string;
  illustrationUrl: string;
  illustrationAlt: string;
  rows: readonly [GuideSummaryRow, GuideSummaryRow, GuideSummaryRow];
}

export function nextGuideChapter(current: GuideChapterId, delta: -1 | 1): GuideChapterId {
  const idx = GUIDE_CHAPTER_IDS.indexOf(current);
  const nextIdx = Math.max(0, Math.min(GUIDE_CHAPTER_IDS.length - 1, idx + delta));
  return GUIDE_CHAPTER_IDS[nextIdx] ?? current;
}

/** 런타임 밸런스·파일럿 타워 계약을 직접 읽어 4장 설명서 콘텐츠를 생성한다(하드코딩 금지). */
export function buildGuideChapters(
  balance: Balance = BALANCE,
  pilotTowers: readonly TowerId[] = PILOT_TOWERS,
): readonly [GuideChapterSpec, GuideChapterSpec, GuideChapterSpec, GuideChapterSpec] {
  const startGold = balance.run.startGold;
  const firstWave = balance.run.prepAttempts.firstWave;
  const laterWaves = balance.run.prepAttempts.laterWaves;
  const bossEveryWaves = balance.waves.bossEveryWaves;
  const burningStreak = balance.burning.streak;
  const burningSec = Math.round(balance.burning.durationMs / 1000);
  const burningSpeedPct = Math.round(balance.burning.attackSpeedBP / 100);
  const maxLevel = balance.levels.max;
  const branchAtLevel = balance.levels.branchAtLevel;
  const sellPct = Math.round(balance.run.sellRatioBP / 100);
  const towerNames = pilotTowers.slice(0, 3).map(id => balance.towers[id].label).join('·');

  return [
    {
      id: 1,
      tabLabel: '1. 한 판 흐름',
      title: '한 판의 흐름',
      headline: '문제로 군자금을 모아 타워를 세우고, 성문을 끝까지 지켜요',
      illustrationUrl: 'assets/guide/guide.ch1.wave_cycle.png',
      illustrationAlt: '금화 준비부터 궁수·서리 타워 요격과 성문 회복으로 이어지는 수비 흐름 그림',
      rows: [
        {
          badge: '1단계',
          title: '준비 문제',
          body: `기본 ${startGold}골드로 시작해요. 첫 웨이브는 ${firstWave}문제, 다음부터는 ${laterWaves}문제를 먼저 풀어 골드를 모아요.`,
          icon: 'gold',
        },
        {
          badge: '2·3단계',
          title: '배치와 실시간 전투',
          body: '빈 돌 받침에 타워를 놓고 ‘전투 시작’을 눌러요. 싸우는 동안에도 문제를 풀어 골드를 벌고 바로 강화할 수 있어요.',
          icon: 'play',
        },
        {
          badge: '4단계',
          title: '성문 회복과 고비',
          body: `웨이브를 막으면 성문이 최대치로 회복돼요(0이 되면 종료). ${bossEveryWaves}의 배수 ‘고비’ 웨이브에는 대장이 오고, 버티면 보너스 골드를 받아요.`,
          icon: 'gate',
        },
      ],
    },
    {
      id: 2,
      tabLabel: '2. 문제·버닝',
      title: '문제 풀이와 버닝',
      headline: `모르면 감점 없이 뜻을 배우고, ${burningStreak}연속 정답으로 버닝을 켜요`,
      illustrationUrl: 'assets/guide/guide.ch2.quiz_burning.png',
      illustrationAlt: '골드 주화와 수호 문장 방패, 세 개의 버닝 보석과 가속 화살 그림',
      rows: [
        {
          badge: '보상 구분',
          title: '골드와 점수 구분',
          body: '골드는 타워 설치·강화에 쓰고, 점수는 순위표와 명예점에 남는 실력 기록이에요.',
          icon: 'score',
        },
        {
          badge: '안전장치',
          title: '오답과 ‘모르겠어요’',
          body: '틀려도 골드와 성문은 줄지 않고 점수만 깎여요. ‘모르겠어요’를 누르면 점수 감점 없이(0점·0골드) 정답과 뜻풀이를 알려 줘요.',
          icon: 'seal',
        },
        {
          badge: '연속 보너스',
          title: '전투 버닝 발동',
          body: `전투 중 ${burningStreak}문제를 연달아 맞히면 ${burningSec}초 동안 버닝이 켜져 모든 타워 공격 속도가 +${burningSpeedPct}% 빨라져요.`,
          icon: 'burning',
        },
      ],
    },
    {
      id: 3,
      tabLabel: '3. 타워·진화',
      title: '타워 배치와 진화',
      headline: `밝은 길이 많이 닿는 길목에 놓고, 레벨 ${branchAtLevel}에서 진화 길을 골라요`,
      illustrationUrl: 'assets/guide/guide.ch3.tower_evolution.png',
      illustrationAlt: '굽은 흙길 위 밝은 사거리 원과 두 갈래 진화 문장, 판매 환급 상자 그림',
      rows: [
        {
          badge: '조준 범위',
          title: '사거리 원과 밝은 흙길',
          body: '돌 받침과 타워를 고르면 하얀 원 안의 밝은 흙길이 공격 범위로 표시돼요. 굽은 길목일수록 적을 더 오래 맞혀요.',
          icon: 'range',
        },
        {
          badge: '진화 규칙',
          title: `역할 조합과 레벨 ${branchAtLevel} 진화`,
          body: `${towerNames} 등 역할을 섞어 레벨 ${maxLevel}까지 키워요. 레벨 ${branchAtLevel}에서 고른 두 갈래 길은 바꿀 수 없어요.`,
          icon: 'branch',
        },
        {
          badge: '환급 배치',
          title: `${sellPct}% 환급 판매`,
          body: `자리를 옮기거나 조합을 바꾸고 싶을 때는 타워를 눌러 판매하면 낸 골드의 ${sellPct}%를 돌려받아요.`,
          icon: 'gold',
        },
      ],
    },
    {
      id: 4,
      tabLabel: '4. 출정·조작',
      title: '출정 조건과 조작',
      headline: '학년은 교과 낱말 범위를, 난이도는 전투 압박과 심화 문제를 정해요',
      illustrationUrl: 'assets/guide/guide.ch4.expedition_command.png',
      illustrationAlt: '수호 비석과 4단계 난이도 방패, 목제 방향·숫자 키캡과 정지 등불 그림',
      rows: [
        {
          badge: '출정 기준',
          title: '학년과 난이도 차이',
          body: '학년(3~6학년)은 교과 수준 낱말과 지도를 정해요. 쉬움·보통은 표준어 중심이고, 어려움·아주 어려움에서는 속담·관용구·방언도 나와요.',
          icon: 'gate',
        },
        {
          badge: '빠른 조작',
          title: '단축키와 화면 확대',
          body: '문제 보기는 숫자키 1~4, 전장 자리는 화살표·엔터 키로도 골라요. 작은 화면에서는 칸을 누르면 자동으로 확대돼요.',
          icon: 'key',
        },
        {
          badge: '정지·마감',
          title: '일시정지와 기록 마감',
          body: '오른쪽 위 정지를 누르면 전투가 멈추고 문제가 가려져요. 글자 크기·소리를 바꾸거나 ‘이번 판 끝내기’로 지금까지 점수를 기록해요.',
          icon: 'pause',
        },
      ],
    },
  ];
}

export type GuideWaveBeatId = 0 | 1 | 2 | 3;

export const GUIDE_WAVE_BEATS: readonly {
  id: GuideWaveBeatId;
  shortLabel: string;
  caption: string;
}[] = [
  { id: 0, shortLabel: '1. 준비', caption: '문제를 풀어 군자금 확보' },
  { id: 1, shortLabel: '2. 설치', caption: '받침 선택 · 밝은 길 조준' },
  { id: 2, shortLabel: '3. 전투', caption: '실시간 요격 · 문제 병행' },
  { id: 3, shortLabel: '4. 회복', caption: '성문 완전 회복 · 고비 보상' },
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
  statusTag: string;
  goldTag: string;
  enemies: GuideLoopEnemy[];
  projectiles: GuideLoopProjectile[];
  archerAngle: number;
  archerRecoil: number;
}

const GUIDE_LOOP_MS = 10_000;
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

/** 1장 수비 순환 캔버스의 결정론 상태 계산 함수(Math.random 미사용, 단위 검증 겸용). */
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
      statusTag: `준비 풀이 · 첫 판 ${balance.run.prepAttempts.firstWave}문제`,
      goldTag: `정답 +${normal.correctGold}골드`,
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
      statusTag: '돌 받침 선택 · 밝은 길 사거리 확인',
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
      goldTag: `고비 보상 +${normal.milestoneSurvivalGold}골드`,
      enemies: [],
      projectiles: [],
      archerAngle: -0.5,
      archerRecoil: 0,
    };
  }

  // Beat 2: 실시간 전투 (고블린 2기 + 고비 대장 1기 행군 및 궁수·서리 요격)
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
    return {
      kind: s.kind,
      x: pos.x,
      y: pos.y,
      hpRatio,
      frameIdx,
      hit: idx === 0 && shotPhase > 0.76,
    };
  });

  const lead = enemies[0]!;
  const boss = enemies[2]!;
  const archerAngle = Math.atan2(lead.y - (archerY - 14), lead.x - archerX);
  const archerRecoil = animate && shotPhase < 0.2 ? (1 - shotPhase / 0.2) * 2.2 : 0;
  const flightT = Math.min(1, shotPhase / 0.85);

  const projectiles: GuideLoopProjectile[] = [
    {
      towerId: 'archer',
      x: archerX + (lead.x - archerX) * flightT,
      y: archerY - 14 + (lead.y - 8 - (archerY - 14)) * flightT,
    },
    {
      towerId: 'frost',
      x: frostX + (boss.x - frostX) * flightT,
      y: frostY - 16 + (boss.y - 10 - (frostY - 16)) * flightT,
    },
  ];

  return {
    beat,
    beatProgress01,
    towersBuilt: true,
    showRangeOverlay: !animate,
    gateSparkle01: 0,
    statusTag: '전투 중 · 문제 풀이 병행 가능',
    goldTag: `처치 +${normal.killGold.regular}~${normal.killGold.boss}골드`,
    enemies,
    projectiles,
    archerAngle,
    archerRecoil,
  };
}

export type QuizOutcomeId = 'correct' | 'wrong' | 'skip' | 'burning';

export interface QuizOutcomeSpec {
  id: QuizOutcomeId;
  tabLabel: string;
  goldDeltaText: string;
  scoreDeltaText: string;
  gateNote: string;
  burningLitCount: 0 | 1 | 2 | 3;
  summary: string;
}

export function buildQuizOutcomeSpecs(balance: Balance = BALANCE): readonly QuizOutcomeSpec[] {
  const normal = balance.difficulties.Normal;
  const speedPct = Math.round(balance.burning.attackSpeedBP / 100);
  const sec = Math.round(balance.burning.durationMs / 1000);
  return [
    {
      id: 'correct',
      tabLabel: '정답',
      goldDeltaText: `+${normal.correctGold}골드`,
      scoreDeltaText: `+${normal.correctPt}점`,
      gateNote: '성문 유지',
      burningLitCount: 1,
      summary: '군자금과 점수가 함께 오르고 버닝 보석이 1칸 차올라요.',
    },
    {
      id: 'wrong',
      tabLabel: '오답',
      goldDeltaText: '0골드 (차감 없음)',
      scoreDeltaText: `${fmtSigned(normal.wrongPt)}점`,
      gateNote: '성문 피해 없음',
      burningLitCount: 0,
      summary: '틀려도 모아 둔 골드와 성문은 그대로고 해설을 보여 줘요.',
    },
    {
      id: 'skip',
      tabLabel: '모르겠어요',
      goldDeltaText: '0골드',
      scoreDeltaText: '0점 (감점 없음)',
      gateNote: '뜻풀이 학습',
      burningLitCount: 0,
      summary: '모르는 낱말은 찍지 않고 누르면 감점 없이 뜻을 배울 수 있어요.',
    },
    {
      id: 'burning',
      tabLabel: `${balance.burning.streak}연속 버닝`,
      goldDeltaText: `+${normal.correctGold}골드`,
      scoreDeltaText: `공격 속도 +${speedPct}%`,
      gateNote: `${sec}초 동안 가속`,
      burningLitCount: 3,
      summary: `전투 중 ${balance.burning.streak}문제를 연달아 맞히면 ${sec}초 동안 모든 타워가 빨라져요.`,
    },
  ];
}

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

export function buildTowerGuideItems(
  balance: Balance = BALANCE,
  pilotTowers: readonly TowerId[] = PILOT_TOWERS,
): readonly TowerGuideStageItem[] {
  return pilotTowers.slice(0, 3).map(id => {
    const tower = balance.towers[id];
    const branch = balance.branches[id];
    const branchALabel = branch?.A.label ?? '기본 강화';
    const branchASummary = branch?.A.summary ?? '공격 능력이 강해져요';
    const branchBLabel = branch?.B.label ?? '특수 강화';
    const branchBSummary = branch?.B.summary ?? '범위와 효과가 넓어져요';
    return {
      id,
      label: tower.label,
      costGold: tower.cost,
      rangeCellsText: fmtCells(tower.rangeMilli),
      rangeMilli: tower.rangeMilli,
      branchATitle: `${BRANCH_MARK.A} · ${branchALabel}`,
      branchASummary,
      branchBTitle: `${BRANCH_MARK.B} · ${branchBLabel}`,
      branchBSummary,
    };
  });
}

export interface DifficultyGuideItem {
  id: DifficultyId;
  label: string;
  gateHp: number;
  correctGold: number;
  vocabScope: string;
  includesProverbDialect: boolean;
}

export function buildDifficultyGuideItems(balance: Balance = BALANCE): readonly DifficultyGuideItem[] {
  const order: readonly DifficultyId[] = ['Easy', 'Normal', 'Hard', 'Crazy'];
  return order.map(id => {
    const d = balance.difficulties[id];
    const includesProverbDialect = id === 'Hard' || id === 'Crazy';
    return {
      id,
      label: DIFFICULTY_COPY[id].label,
      gateHp: d.gateHp,
      correctGold: d.correctGold,
      vocabScope: includesProverbDialect ? '교과 어휘 + 속담·관용구·방언' : '학년 교과 표준 어휘 중심',
      includesProverbDialect,
    };
  });
}
