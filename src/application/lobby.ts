import { gradeContent, RETRACTIONS, toRuntime, VERIFIED_GRADE_BANKS } from '../content';
import type { RetractionList } from '../contracts/questions';
import {
  computeHonorPoints,
  kstDateKey,
  kstIsoWeekKey,
  type RankingQuery,
  type RankingResponse,
  type SteleCardItem,
  type TelemetrySnapshot,
} from '../contracts/lobby';
import {
  connectPresenceChannel,
  fetchInitialTelemetry,
  fetchRanking,
  flushPendingRunSyncs,
} from '../persistence/lobbyClient';

export { computeHonorPoints, fetchRanking, kstDateKey, kstIsoWeekKey };
export type { RankingQuery, RankingResponse, SteleCardItem, TelemetrySnapshot };

/** FNV-1a 32비트 결정론 해시(부동소수점·Math.random 미사용). */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function firstGrapheme(word: string): string {
  const seg = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(word)][0];
  return seg?.segment ?? '가';
}

function cleanStudyMeaning(
  q: { type: string; variantTag?: string | undefined; explanation: string },
  answerText: string,
): string {
  if (q.type === 'definition' && q.variantTag !== 'dialect') {
    return answerText.trim();
  }
  return q.explanation
    .trim()
    .replace(/^(?:여기서\s*)?[‘'][^’']+[’'][은는]\s*/, '');
}

function extractStudyExample(
  q: { type: string; stem: string; explanation: string; target: { lemma: string } },
  answerText: string,
): { sentence: string; highlightHint?: string } {
  const cleanEnd = (s: string) => s.trim().replace(/[.!?]+$/, '');

  if (q.type === 'usage') {
    return { sentence: cleanEnd(answerText) };
  }
  if (q.type === 'cloze') {
    const filled = answerText.trim();
    const withoutLeadPrompt = q.stem
      .trim()
      .replace(
        /^(?:[^()]*\?|[^().!?]*(?:빈칸|괄호|알맞은\s*말|고르세요|고르시오|골라\s*보세요)[^().!?]*[.!])\s+/,
        '',
      );
    const withoutPrompts = withoutLeadPrompt
      .replace(
        /([.!?][”"」』’']?)\s+(?:[^().!?]*\?|[^().!?]*(?:빈칸|괄호|알맞은\s*말|고르세요|고르시오|골라\s*보세요)[^().!?]*[.!])$/,
        '$1',
      )
      .replace(/\s*(?:빈칸|괄호)[^().!?]*[.!?]$/, '');
    const merged = withoutPrompts.replace(/\(\s*\)/g, filled);
    return {
      sentence: cleanEnd(merged.replace(/[「」『』“”"‘’']/g, '')),
      highlightHint: filled,
    };
  }
  const cornerQuoted = /[「『]([^」』]{4,})[」』]/.exec(q.stem);
  if (cornerQuoted?.[1] && /\s/.test(cornerQuoted[1].trim())) {
    return { sentence: cleanEnd(cornerQuoted[1].replace(/[‘’']/g, '')) };
  }

  const dblQuoted = /[“"]([^”"]{4,})[”"]/.exec(q.stem);
  if (dblQuoted?.[1] && /\s/.test(dblQuoted[1].trim())) {
    return { sentence: cleanEnd(dblQuoted[1].replace(/[‘’']/g, '')) };
  }

  const leadQuoted = /^[‘']([^’']{4,})[’']/.exec(q.stem.trim());
  if (leadQuoted?.[1] && leadQuoted[1].trim() !== q.target.lemma && /\s/.test(leadQuoted[1].trim())) {
    return { sentence: cleanEnd(leadQuoted[1]) };
  }

  const twoSent = /^([^?]+?[.!])\s+(?:[^.!?]+\?|[^.!?]*(?:고르세요|고르시오|골라\s*보세요|알맞은\s*것은)[^.!?]*[.!])$/.exec(
    q.stem.trim(),
  );
  if (twoSent?.[1]) {
    return { sentence: cleanEnd(twoSent[1].replace(/[‘’'「」『』“”"]/g, '')) };
  }

  const leadPromptTwoSent = /^(?:[^.!?]+\?|[^.!?]*(?:고르세요|고르시오|골라\s*보세요|알맞은\s*것은)[^.!?]*[.!])\s+([^?]+[.!])$/.exec(
    q.stem.trim(),
  );
  if (leadPromptTwoSent?.[1]) {
    return { sentence: cleanEnd(leadPromptTwoSent[1].replace(/[‘’'「」『』“”"]/g, '')) };
  }

  const stripped = q.stem
    .trim()
    .replace(/^[‘'][^’']+[’'](?:라는|이라는)?(?:\s*말)?의\s*(?:뜻|쓰임).*$/, '')
    .replace(/[‘']([^’']+)[’'](?:라는|이라는)?\s*말의\s*뜻.*$/, '$1')
    .replace(/에서\s*[‘'][^’']+[’'].*$/, '')
    .replace(/[‘’'「」『』“”"]/g, '');
  const candidate = cleanEnd(stripped);
  const looksLikePrompt =
    candidate.length < 4 ||
    !/\s/.test(candidate) ||
    /(?:무엇일까요|알맞은\s*것은|알맞은\s*말을|바른\s*것은|고르시오|고르세요|골라\s*보세요|\?)/.test(candidate);
  return { sentence: looksLikePrompt ? cleanEnd(q.explanation) : candidate };
}

function splitHighlight(
  sentence: string,
  lemma: string,
  highlightHint?: string,
): {
  examplePrefix: string;
  exampleHighlight: string;
  exampleSuffix: string;
} {
  const exactIdx = sentence.indexOf(lemma);
  if (exactIdx >= 0) {
    return {
      examplePrefix: sentence.slice(0, exactIdx),
      exampleHighlight: sentence.slice(exactIdx, exactIdx + lemma.length),
      exampleSuffix: sentence.slice(exactIdx + lemma.length),
    };
  }

  if (highlightHint && highlightHint.length >= 1) {
    const hintIdx = sentence.indexOf(highlightHint);
    if (hintIdx >= 0) {
      return {
        examplePrefix: sentence.slice(0, hintIdx),
        exampleHighlight: sentence.slice(hintIdx, hintIdx + highlightHint.length),
        exampleSuffix: sentence.slice(hintIdx + highlightHint.length),
      };
    }
  }

  const root = lemma.endsWith('다') && lemma.length >= 2 ? lemma.slice(0, -1) : lemma;
  const candidates = [root];
  if (lemma.endsWith('다') && root.length >= 3) {
    candidates.push(root.slice(0, -1));
  }

  for (const stem of candidates) {
    if (stem.length < 1) continue;
    const rootIdx = sentence.indexOf(stem);
    if (rootIdx >= 0) {
      let end = rootIdx + stem.length;
      while (end < sentence.length && !/[\s,.!?’'”")]/.test(sentence[end]!)) end++;
      return {
        examplePrefix: sentence.slice(0, rootIdx),
        exampleHighlight: sentence.slice(rootIdx, end),
        exampleSuffix: sentence.slice(end),
      };
    }
  }
  return { examplePrefix: sentence, exampleHighlight: '', exampleSuffix: '' };
}

function resolveLevelLabel(q: {
  type: string;
  difficultyTier?: string | undefined;
  variantTag?: string | undefined;
  dialectRegion?: string | undefined;
}): string {
  if (q.variantTag === 'dialect') {
    return `${q.dialectRegion && q.dialectRegion !== '공통' ? `${q.dialectRegion} ` : ''}방언 · 도전`;
  }
  if (q.variantTag === 'idiom_proverb') return '관용·속담';
  if (q.difficultyTier === 'challenge') return '도전 어휘';
  if (q.difficultyTier === 'advanced') return '심화 어휘';
  if (q.difficultyTier === 'basic') return '기초 어휘';
  if (q.difficultyTier === 'core') return '핵심 어휘';
  switch (q.type) {
    case 'synonym_context': return '유의어 확장';
    case 'antonym_context': return '반의어 확장';
    case 'usage': return '문장 활용';
    case 'cloze': return '문맥 어휘';
    default: return '기본 뜻풀이';
  }
}

const QUESTION_TYPE_PRIORITY: Record<string, number> = {
  definition: 0,
  cloze: 1,
  usage: 2,
  synonym_context: 3,
  antonym_context: 4,
};

interface StudyQuestionLike {
  readonly id: string;
  readonly revision: number;
  readonly grade: number;
  readonly type: string;
  readonly difficultyTier?: string | undefined;
  readonly variantTag?: string | undefined;
  readonly dialectRegion?: string | undefined;
  readonly target: {
    readonly lemma: string;
    readonly partOfSpeech: string;
    readonly senseKey: string;
  };
  readonly stem: string;
  readonly options: ReadonlyArray<{ readonly id: string; readonly text: string }>;
  readonly correctOptionId: string;
  readonly explanation: string;
  readonly fromBank?: boolean | undefined;
}

function toSteleCardItem(q: StudyQuestionLike, gradeLabel: string): SteleCardItem | null {
  const answerOpt = q.options.find(o => o.id === q.correctOptionId);
  if (!answerOpt || answerOpt.text.trim().length === 0) return null;
  const levelLabel = resolveLevelLabel(q);
  const meaning = cleanStudyMeaning(q, answerOpt.text);
  if (meaning.length === 0) return null;
  const { sentence, highlightHint } = extractStudyExample(q, answerOpt.text);
  const parts = splitHighlight(sentence, q.target.lemma, highlightHint);
  return {
    questionId: q.id,
    lemma: q.target.lemma,
    glyph: firstGrapheme(q.target.lemma),
    partOfSpeech: q.target.partOfSpeech,
    gradeLabel,
    levelLabel,
    meaning,
    explanation: q.explanation,
    ...parts,
  };
}

let rawStudyPoolPromise: Promise<readonly StudyQuestionLike[]> | null = null;
let cachedDefaultAllStudyCards: readonly SteleCardItem[] | null = null;

function loadRawStudyPool(): Promise<readonly StudyQuestionLike[]> {
  if (rawStudyPoolPromise) return rawStudyPoolPromise;
  rawStudyPoolPromise = Promise.resolve().then(() => {
    const byId = new Map<string, StudyQuestionLike>();
    const orderedBanks = [...VERIFIED_GRADE_BANKS].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'published' ? 1 : -1;
      return a.grade - b.grade;
    });
    for (const bank of orderedBanks) {
      for (const q of bank.questions) {
        const prev = byId.get(q.id);
        if (!prev || q.revision >= prev.revision) {
          byId.set(q.id, { ...q, fromBank: true });
        }
      }
    }
    return [...byId.values()];
  });
  return rawStudyPoolPromise;
}

/** 이미 메모리에 적재된 전체 서버 낱말 풀이 있으면 동기 반환한다. */
export function getCachedAllStudyCards(): readonly SteleCardItem[] | null {
  return cachedDefaultAllStudyCards;
}

/**
 * 공개 은행과 블라인드 검증 후보 은행(3~6학년)에 수록된 모든 검증 완료 낱말을 로드하여
 * 철회 문항을 배제한 뒤 학년·낱말 뜻 단위로 정제된 학습 카드 풀을 반환한다(미검수 초안 배제).
 */
export async function loadAllStudyCards(
  retractions: RetractionList = RETRACTIONS,
): Promise<readonly SteleCardItem[]> {
  if (retractions === RETRACTIONS && cachedDefaultAllStudyCards) {
    return cachedDefaultAllStudyCards;
  }

  const rawPool = await loadRawStudyPool();
  const retractedKeys = new Set(retractions.entries.map(e => `${e.questionId}@${e.revision}`));
  const active = rawPool.filter(q => !retractedKeys.has(`${q.id}@${q.revision}`));

  active.sort((a, b) => {
    const pa = QUESTION_TYPE_PRIORITY[a.type] ?? 9;
    const pb = QUESTION_TYPE_PRIORITY[b.type] ?? 9;
    if (pa !== pb) return pa - pb;
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.id.localeCompare(b.id);
  });

  const seenSenses = new Set<string>();
  const cards: SteleCardItem[] = [];
  for (const q of active) {
    const senseId = `${q.grade}:${q.target.lemma}:${q.target.senseKey}`;
    if (seenSenses.has(senseId)) continue;
    const card = toSteleCardItem(q, `${q.grade}학년`);
    if (!card) continue;
    seenSenses.add(senseId);
    cards.push(card);
  }

  if (retractions === RETRACTIONS) {
    cachedDefaultAllStudyCards = cards;
  }
  return cards;
}

/** 초기 진입 시 전체 낱말 풀에서 무작위 시작 인덱스를 고른다(Math.random 미사용). */
export function pickRandomInitialStudyIndex(count: number): number {
  if (count <= 1) return 0;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! >>> 0) % count;
}

/**
 * 오늘의 낱말 공부: 등록된 모든 학년·수준 어휘를 철회 문항 배제 후 추출하고,
 * KST 일자 시드를 기준으로 다양한 학년·수준이 고르게 섞이도록 배치한다.
 */
export function selectDailySteleCards(
  preferredGrade: number = 3,
  now: Date = new Date(),
  retractions: RetractionList = RETRACTIONS,
): SteleCardItem[] {
  const orderedGrades = [preferredGrade, 3, 4, 5, 6].filter(
    (g, idx, arr) => g >= 3 && g <= 6 && arr.indexOf(g) === idx,
  );
  const dateKey = kstDateKey(now);
  const seenSenses = new Set<string>();
  const buckets = new Map<string, Array<{ card: SteleCardItem; score: number }>>();

  for (const g of orderedGrades) {
    const bank = gradeContent(g).bank;
    if (!bank) continue;
    const runtime = toRuntime(bank, retractions);
    if (runtime.length === 0) continue;

    const baseSeed = fnv1a32(`${dateKey}:${bank.bankId}:${bank.bankVersion}`);
    const sorted = [...runtime].sort((a, b) => {
      const pa = QUESTION_TYPE_PRIORITY[a.type] ?? 9;
      const pb = QUESTION_TYPE_PRIORITY[b.type] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.id.localeCompare(b.id);
    });

    const gradeLabel = `${g}학년`;
    for (const q of sorted) {
      const senseId = `${g}:${q.target.senseKey}`;
      if (seenSenses.has(senseId)) continue;
      const card = toSteleCardItem(q, gradeLabel);
      if (!card) continue;
      seenSenses.add(senseId);

      const bucketKey = `${gradeLabel}:${card.levelLabel}`;
      const list = buckets.get(bucketKey) ?? [];
      list.push({ card, score: fnv1a32(`${baseSeed}:${q.id}:${q.revision}`) });
      buckets.set(bucketKey, list);
    }
  }

  if (buckets.size === 0) return [];

  const bucketKeys = [...buckets.keys()].sort((a, b) => {
    const sa = fnv1a32(`${dateKey}:bucket:${a}`);
    const sb = fnv1a32(`${dateKey}:bucket:${b}`);
    return sa - sb || a.localeCompare(b);
  });

  for (const key of bucketKeys) {
    buckets.get(key)!.sort((a, b) => a.score - b.score || a.card.questionId.localeCompare(b.card.questionId));
  }

  // 수준·학년 버킷을 라운드로빈으로 교차 배치하여 연속 탐색 시에도 다양한 수준이 고르게 노출된다.
  const interleaved: SteleCardItem[] = [];
  let cursor = 0;
  let added = true;
  while (added) {
    added = false;
    for (const key of bucketKeys) {
      const item = buckets.get(key)![cursor];
      if (item) {
        interleaved.push(item.card);
        added = true;
      }
    }
    cursor++;
  }

  return interleaved;
}

/**
 * 랜덤 낱말 선택기: 직전 낱말과 겹치지 않으며, 아직 보지 않은 전체 낱말 중
 * 무작위로 뽑아 서버 내 모든 학년·수준 어휘가 고르게 랜덤 노출되도록 한다.
 */
export function pickRandomStudyIndex(
  cards: readonly SteleCardItem[],
  currentIndex: number,
  visited: ReadonlySet<number> = new Set(),
): number {
  if (cards.length <= 1) return 0;
  const safeCurrent = ((currentIndex % cards.length) + cards.length) % cards.length;
  const currentCard = cards[safeCurrent]!;
  const currentKey = `${currentCard.gradeLabel}:${currentCard.levelLabel}`;

  const allOthers: number[] = [];
  const unvisited: number[] = [];
  const unvisitedDifferentLevel: number[] = [];
  const differentLevel: number[] = [];

  for (let i = 0; i < cards.length; i++) {
    if (i === safeCurrent) continue;
    allOthers.push(i);
    if (cards[i]!.lemma === currentCard.lemma) continue;
    const key = `${cards[i]!.gradeLabel}:${cards[i]!.levelLabel}`;
    const isDiff = key !== currentKey;
    if (isDiff) differentLevel.push(i);
    if (!visited.has(i)) {
      unvisited.push(i);
      if (isDiff) unvisitedDifferentLevel.push(i);
    }
  }

  const pool =
    unvisitedDifferentLevel.length > 0
      ? unvisitedDifferentLevel
      : unvisited.length > 0
        ? unvisited
        : differentLevel.length > 0
          ? differentLevel
          : allOthers;

  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return pool[(buf[0]! >>> 0) % pool.length]!;
}

const QUIRKY_STATES = [
  '잠덜깬', '배고픈', '길잃은', '하품하는', '간식찾는', '딴청피우는',
  '안경찾는', '앞니빠진', '방금일어난', '도시락숨긴', '딸꾹질하는', '헛기침하는',
  '살금살금', '뒤뚱뒤뚱', '깜빡졸던', '신발짝짝이', '까치집머리', '연필굴리는',
  '초코우유찾는', '밤새책읽은', '일기밀린', '준비물잊은', '몸풀기중인', '눈비비는',
] as const;

const QUIRKY_ROLES = [
  '수문장', '사령관', '마법사', '궁수장', '방패병', '정찰병', '학술관', '성문지기',
  '부엉이', '호랑이', '너구리', '다람쥐', '수달', '오소리', '고슴도치', '두더지',
  '북극곰', '펭귄', '까마귀', '참새',
] as const;

const SNACK_PROPS = [
  '떡볶이', '붕어빵', '호떡', '군고구마', '감자튀김', '단팥빵', '찰옥수수', '귤까기',
  '솜사탕', '식혜', '누룽지', '주먹밥', '팥빙수', '약과', '강냉이', '메추리알',
  '김밥꼬투리', '지우개가루', '색종이', '종이학', '딱지', '구슬', '분필', '도토리', '꽈배기',
] as const;

const GRAND_TITLES = [
  '연금술사', '대장군', '수호신', '감별사', '명사수', '평론가', '연구회장', '특공대장',
  '수집가', '박사님', '기사단장', '원정대장', '보안관', '전략가', '심판관', '장인',
] as const;

const WORDPLAY_TOPICS = [
  '맞춤법', '띄어쓰기', '받아쓰기', '국어사전', '속담백과', '사자성어', '비유법', '끝말잇기',
  '낱말퍼즐', '어휘력', '겹받침', '된소리', '의성어', '의태어', '유의어', '반의어',
  '방언사전', '수수께끼', '책갈피', '순우리말',
] as const;

const WORDPLAY_TITLES = [
  '보안관', '해결사', '끝판왕', '만점왕', '일타강사', '탐정단', '마술사',
  '수호대', '능력자', '수집왕', '요정', '장인', '박사', '고수',
] as const;

const FIELD_SPOTS = [
  '성문앞', '망루위', '방패뒤', '참나무아래', '비석옆', '성벽모퉁이',
  '작전실', '훈련장', '포탑옆', '최전방', '성곽길', '수비진',
] as const;

const FIELD_GUESTS = [
  '낮잠고양이', '고구마장수', '다람쥐대장', '숨은고수', '간식당번', '응원단장', '비둘기',
  '복슬강아지', '청개구리', '주먹밥요정', '독서왕', '깍두기', '붕어빵장수', '고슴도치',
] as const;

const MIMETIC_WORDS = [
  '우당탕탕', '두근두근', '폴짝폴짝', '데굴데굴', '엉금엉금', '번쩍번쩍',
  '콩콩뛰는', '배시시웃는', '눈만끔뻑', '볼빵빵한', '귀쫑긋한', '꼬리살랑',
  '복슬복슬', '말랑말랑', '반질반질', '기웃기웃', '두리번대는', '신나서뛰는',
] as const;

const CRITTER_HEROES = [
  '다람쥐', '청설모', '산토끼', '아기곰', '햄스터', '사막여우', '호랑이', '거북이',
  '진돗개', '치즈냥', '까치', '수달', '너구리', '오소리', '물개', '판다', '미어캣', '쿼카',
] as const;

const SIGNATURE_WITTY_NICKS = [
  // 속담·사자성어 유쾌한 비틀기
  '소잃고타워고침', '돌다리두드리다지각', '천리길도간식부터', '금강산도급식후경',
  '호랑이도간식찾음', '등잔밑에간식숨김', '가는말이길잃음', '식은죽도불어먹음',
  '떡본김에다먹음', '누워서떡만먹음', '꿩대신닭다리', '세살버릇백웨이브',
  '박수칠때타워짓기', '사공많아배가산행', '새우등안터짐', '우물안개구리대장',
  '벼락치기장학생', '백지장도혼자듦', '개천에서용출동', '원숭이도나무타기왕',
  '티끌모아포탑건설', '시작이반나머진간식', '고생끝에골드온다', '낮말은새가받아적음',
  '박학다식다람쥐', '우유부단마법사', '동문서답앵무새', '유비무환방패병',
  '일석삼조대포병', '천하태평나무늘보',
  // 타워 디펜스·왕국 전장 개그
  '성문열고환영할뻔', '보스랑눈마주침', '포탑세우다깜빡잠', '일웨이브부터진심',
  '마법봉으로등긁기', '투구쓰고앞안보임', '방패로썰매타기', '화살대신분필',
  '창병인데효자손', '얼음타워팥빙수', '화염타워군고구마', '번개타워충전중',
  '대포로박터뜨리기', '깃발타워응원단장', '궁수탑옆자리예약', '성벽위도시락까기',
  '화살통속다람쥐', '보물상자속청개구리', '얼떨결에수문장', '얼떨결에사령관',
  '엉겁결에영웅됨', '골드모으는다람쥐', '성문앞붕어빵가게', '퇴근하고싶은보스',
  '길잘못든몬스터', '수호비석광택장인', '낮잠수문장', '방패썰매왕',
  // 어휘·퀴즈·학교생활 공감 유머
  '모르겠어요안누름', '해설까지다읽는편', '보기가다정답같음', '고민끝에정답맞힘',
  '사전두께만큼강함', '사전베고낮잠자기', '적군도반한어휘력', '말로이기는수문장',
  '어제배운낱말출동', '아는낱말총동원', '받침하나안틀림', '쉬는시간일등주자',
  '급식실일등공신', '우유당번에이스', '칠판지우기장인', '분필깎기장인',
  '발바닥젤리대장', '국어시간눈반짝', '수수께끼출제위원', '한글날태어난기분',
  '방언까지섭렵함', '급식특공대', '간식사령부', '도토리부자',
  '붕어빵장군', '사전탐험대', '받아쓰기신',
] as const;

const PATTERN_CUMULATIVE_WEIGHTS = [18, 36, 51, 63, 75, 100] as const;
const RECENT_NICK_LIMIT = 24;
const recentNicknames: string[] = [];
let lastNicknamePattern = -1;

function pickFrom<T>(arr: readonly T[], rand: number): T {
  return arr[(rand >>> 0) % arr.length]!;
}

function buildNicknameByPattern(pattern: number, r1: number, r2: number): string {
  switch (pattern) {
    case 0:
      return `${pickFrom(QUIRKY_STATES, r1)}${pickFrom(QUIRKY_ROLES, r2)}`;
    case 1:
      return `${pickFrom(SNACK_PROPS, r1)}${pickFrom(GRAND_TITLES, r2)}`;
    case 2:
      return `${pickFrom(WORDPLAY_TOPICS, r1)}${pickFrom(WORDPLAY_TITLES, r2)}`;
    case 3:
      return `${pickFrom(FIELD_SPOTS, r1)}${pickFrom(FIELD_GUESTS, r2)}`;
    case 4:
      return `${pickFrom(MIMETIC_WORDS, r1)}${pickFrom(CRITTER_HEROES, r2)}`;
    default:
      return pickFrom(SIGNATURE_WITTY_NICKS, (r1 ^ r2) >>> 0);
  }
}

/**
 * 재치 있는 다중 문형 출정 별명 랜덤 추천기(4~10자, cleanNickname 100% 통과).
 * 6가지 서로 다른 유머 구조(엉뚱 상태·간식 직함·국어 개그·전장 반전·의태어 동물·속담 패러디 단독형)를
 * 연속 중복 없이 순환하며, 최근 추천 이력까지 피해 매번 색다른 별명을 뽑는다.
 * ESLint 규칙에 따라 Math.random()을 쓰지 않고 crypto.getRandomValues만 사용한다.
 */
export function recommendNickname(previous = ''): string {
  const trimmedPrev = previous.trim();
  const buf = new Uint32Array(24);
  crypto.getRandomValues(buf);

  for (let attempt = 0; attempt < 8; attempt++) {
    const base = attempt * 3;
    const roll = buf[base]! % 100;
    let pattern = PATTERN_CUMULATIVE_WEIGHTS.findIndex(w => roll < w);
    if (pattern < 0) pattern = 5;
    if (pattern === lastNicknamePattern) {
      pattern = (pattern + 1 + (buf[base + 1]! % 5)) % 6;
    }

    const candidate = buildNicknameByPattern(pattern, buf[base + 1]!, buf[base + 2]!);
    if (candidate !== trimmedPrev && !recentNicknames.includes(candidate)) {
      lastNicknamePattern = pattern;
      recentNicknames.push(candidate);
      if (recentNicknames.length > RECENT_NICK_LIMIT) recentNicknames.shift();
      return candidate;
    }
  }

  for (let i = 0; i < SIGNATURE_WITTY_NICKS.length; i++) {
    const fallback = SIGNATURE_WITTY_NICKS[(buf[0]! + i) % SIGNATURE_WITTY_NICKS.length]!;
    if (fallback !== trimmedPrev) {
      lastNicknamePattern = 5;
      recentNicknames.push(fallback);
      if (recentNicknames.length > RECENT_NICK_LIMIT) recentNicknames.shift();
      return fallback;
    }
  }
  return SIGNATURE_WITTY_NICKS[0];
}

/**
 * 상단 4대 지표 전용 격리 스토어.
 * 실시간 접속자 수가 바뀌어도 TelemetryStrip만 다시 그려지고 별명 입력창은 리렌더링되지 않는다.
 */
export interface LobbyTelemetryStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TelemetrySnapshot;
  start(playerId: string): () => void;
  refreshCounts(playerId: string): Promise<void>;
}

export function createLobbyTelemetryStore(): LobbyTelemetryStore {
  let snapshot: TelemetrySnapshot = {
    status: 'loading',
    onlineNow: null,
    todayPlays: 0,
    totalVisitors: null,
    totalPlays: 0,
    updatedAtIso: null,
  };
  const listeners = new Set<() => void>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    for (const l of listeners) l();
  };

  const setPatch = (patch: Partial<TelemetrySnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    emit();
  };

  const refreshCounts = async (playerId: string) => {
    const initial = await fetchInitialTelemetry(playerId);
    setPatch({
      status: snapshot.onlineNow !== null ? 'live' : initial.status,
      todayPlays: initial.todayPlays,
      totalVisitors: initial.totalVisitors,
      totalPlays: initial.totalPlays,
      updatedAtIso: initial.updatedAtIso,
    });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    refreshCounts,
    start(playerId: string) {
      let active = true;
      void flushPendingRunSyncs();
      void refreshCounts(playerId);

      const disconnectPresence = connectPresenceChannel(playerId, count => {
        if (!active) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        if (snapshot.onlineNow === null || count === null) {
          setPatch({ onlineNow: count, status: count !== null ? 'live' : snapshot.totalVisitors !== null ? 'live' : 'offline' });
        } else {
          debounceTimer = setTimeout(() => {
            if (!active) return;
            setPatch({ onlineNow: count, status: 'live' });
          }, 1500);
        }
      });

      const onOnline = () => {
        if (!active) return;
        void flushPendingRunSyncs();
        void refreshCounts(playerId);
      };
      window.addEventListener('online', onOnline);

      return () => {
        active = false;
        if (debounceTimer) clearTimeout(debounceTimer);
        window.removeEventListener('online', onOnline);
        disconnectPresence();
      };
    },
  };
}

export const lobbyTelemetryStore = createLobbyTelemetryStore();
