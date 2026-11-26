export const PORTRAIT_RACES = ['elf', 'human', 'mech', 'insect', 'golem'] as const;

export type PortraitRace = (typeof PORTRAIT_RACES)[number];

/** R6 portrait-spec §3.3 종족 강조색 띠 (R04 6색 팔레트). */
export const R6_PORTRAIT_ACCENTS: Readonly<Record<PortraitRace, string>> = {
  elf: '#2FB5A3',
  human: '#B8C0C8',
  mech: '#2FB5A3',
  insect: '#E69F24',
  golem: '#E69F24',
};

/** 오늘의 낱말 액자용 R6 5종족 초상 30종 (256×256 불투명 WebP). */
export const STUDY_MONSTER_ARTS = [
  'assets/ui/study/r6.portrait.elf.01.webp',
  'assets/ui/study/r6.portrait.elf.02.webp',
  'assets/ui/study/r6.portrait.elf.03.webp',
  'assets/ui/study/r6.portrait.elf.04.webp',
  'assets/ui/study/r6.portrait.elf.05.webp',
  'assets/ui/study/r6.portrait.elf.06.webp',
  'assets/ui/study/r6.portrait.human.01.webp',
  'assets/ui/study/r6.portrait.human.02.webp',
  'assets/ui/study/r6.portrait.human.03.webp',
  'assets/ui/study/r6.portrait.human.04.webp',
  'assets/ui/study/r6.portrait.human.05.webp',
  'assets/ui/study/r6.portrait.human.06.webp',
  'assets/ui/study/r6.portrait.mech.01.webp',
  'assets/ui/study/r6.portrait.mech.02.webp',
  'assets/ui/study/r6.portrait.mech.03.webp',
  'assets/ui/study/r6.portrait.mech.04.webp',
  'assets/ui/study/r6.portrait.mech.05.webp',
  'assets/ui/study/r6.portrait.mech.06.webp',
  'assets/ui/study/r6.portrait.insect.01.webp',
  'assets/ui/study/r6.portrait.insect.02.webp',
  'assets/ui/study/r6.portrait.insect.03.webp',
  'assets/ui/study/r6.portrait.insect.04.webp',
  'assets/ui/study/r6.portrait.insect.05.webp',
  'assets/ui/study/r6.portrait.insect.06.webp',
  'assets/ui/study/r6.portrait.golem.01.webp',
  'assets/ui/study/r6.portrait.golem.02.webp',
  'assets/ui/study/r6.portrait.golem.03.webp',
  'assets/ui/study/r6.portrait.golem.04.webp',
  'assets/ui/study/r6.portrait.golem.05.webp',
  'assets/ui/study/r6.portrait.golem.06.webp',
] as const;

export type StudyPortraitPath = (typeof STUDY_MONSTER_ARTS)[number];

export interface PortraitArt {
  readonly path: StudyPortraitPath;
  readonly race: PortraitRace;
}

export interface PortraitDeckState {
  readonly deck: readonly PortraitArt[];
  readonly cursor: number;
}

const ROUNDS_PER_DECK = 6;
const RANDOM_POOL_SIZE = PORTRAIT_RACES.length * ROUNDS_PER_DECK * 2;

export function portraitRaceOf(path: string): PortraitRace {
  const match = /r6\.portrait\.(elf|human|mech|insect|golem)\.\d{2}\.webp$/.exec(path);
  if (!match) {
    throw new Error(`Invalid R6 portrait path: ${path}`);
  }
  return match[1] as PortraitRace;
}

export const R6_PORTRAITS: readonly PortraitArt[] = STUDY_MONSTER_ARTS.map(path => ({
  path,
  race: portraitRaceOf(path),
}));

function makeRandomReader(randomUint32?: () => number): () => number {
  if (randomUint32) return randomUint32;
  const pool = new Uint32Array(RANDOM_POOL_SIZE);
  crypto.getRandomValues(pool);
  let idx = 0;
  return () => {
    if (idx >= pool.length) {
      crypto.getRandomValues(pool);
      idx = 0;
    }
    return pool[idx++]! >>> 0;
  };
}

function shuffleInPlace<T>(items: T[], nextUint32: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = (nextUint32() >>> 0) % (i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

/**
 * 5종족 블록 라운드 로빈 셔플 (portrait-spec §4.2):
 * 1) 5종족별 6장 배열을 각각 Fisher-Yates 셔플
 * 2) 라운드 k=0..5마다 각 종족 k번째 초상을 모아 5장 블록 생성 후 블록 내부 셔플
 * 3) 직전 블록(또는 이전 덱 마지막)과 첫 카드 종족이 겹치면 블록 0번·1번 교체
 */
export function shufflePortraitDeck(
  excludeLast?: PortraitArt | string,
  randomUint32?: () => number,
): PortraitArt[] {
  const nextUint32 = makeRandomReader(randomUint32);
  const buckets = new Map<PortraitRace, PortraitArt[]>();
  for (const race of PORTRAIT_RACES) {
    const list = R6_PORTRAITS.filter(item => item.race === race);
    shuffleInPlace(list, nextUint32);
    buckets.set(race, list);
  }

  const excludeRace = excludeLast
    ? typeof excludeLast === 'string'
      ? portraitRaceOf(excludeLast)
      : excludeLast.race
    : undefined;

  const deck: PortraitArt[] = [];
  for (let round = 0; round < ROUNDS_PER_DECK; round++) {
    const block: PortraitArt[] = PORTRAIT_RACES.map(race => buckets.get(race)![round]!);
    shuffleInPlace(block, nextUint32);

    const prevRace = round === 0 ? excludeRace : deck[deck.length - 1]!.race;
    if (prevRace !== undefined && block[0]!.race === prevRace) {
      const first = block[0]!;
      block[0] = block[1]!;
      block[1] = first;
    }
    deck.push(...block);
  }

  return deck;
}

export function createPortraitDeckState(randomUint32?: () => number): PortraitDeckState {
  return {
    deck: shufflePortraitDeck(undefined, randomUint32),
    cursor: 0,
  };
}

export function advancePortraitDeck(
  prev: PortraitDeckState,
  randomUint32?: () => number,
): PortraitDeckState {
  const nextCursor = prev.cursor + 1;
  if (nextCursor >= prev.deck.length - 1) {
    const currentLast = prev.deck[prev.deck.length - 1]!;
    return {
      deck: [currentLast, ...shufflePortraitDeck(currentLast, randomUint32)],
      cursor: 0,
    };
  }
  return {
    deck: prev.deck,
    cursor: nextCursor,
  };
}
