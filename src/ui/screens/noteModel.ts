import type { RuntimeQuestion } from '../../domain/context';

/** 다른 판에서 이만큼 맞히면 노트를 졸업한다. persistence/reviewNote.ts의 REVIEW_GRADUATE_CLEARS와 같은 값이다(UI는 persistence를 가져오지 않는다). */
export const NOTE_GRADUATE_CLEARS = 2;

/** 노트 한 항목. persistence의 ReviewNoteItem이 이 모양을 만족한다. */
export interface NoteItemLike {
  lemma: string;
  senseKey: string;
  /** 틀린 문항(최근 것부터). */
  questionIds: readonly string[];
  /** 담은 뒤 다른 판에서 맞힌 판 수. */
  clears: number;
  lastSeenAt: string;
}

/** 화면에 그릴 낱말 카드 한 장. 퍼센트·점수는 두지 않는다(PRD v0.5 §20.5). */
export interface NoteEntry {
  senseKey: string;
  lemma: string;
  meaning: string;
  example: string | null;
  clears: number;
}

const correctText = (q: RuntimeQuestion) => q.options.find(o => o.id === q.correctOptionId)?.text ?? '';

/** 문항에서 예문 한 줄을 뽑는다: 쓰임 문항은 정답 문장, 빈칸은 정답을 채운 문장, 유의어·반의어는 따옴표 안 문장. 뜻풀이 문항은 없다. */
function exampleOf(q: RuntimeQuestion): string | null {
  switch (q.type) {
    case 'usage': return correctText(q) || null;
    case 'cloze': return q.stem.replace(/\(\s*\)/, correctText(q)).trim();
    case 'synonym_context':
    case 'antonym_context': return /‘([^’]+)’/.exec(q.stem)?.[1] ?? null;
    default: return null;
  }
}

/**
 * 노트 항목을 카드로 바꾼다(최근 것부터). 뜻은 같은 뜻의 뜻풀이 문항 정답이고, 없으면 틀린 문항의 해설이다.
 * `questions`에 문항이 하나도 없는 항목(철회·다른 은행)은 건너뛴다.
 */
export function buildNoteEntries(items: readonly NoteItemLike[], questions: ReadonlyMap<string, RuntimeQuestion>): NoteEntry[] {
  const bySense = new Map<string, RuntimeQuestion[]>();
  for (const q of questions.values()) {
    const list = bySense.get(q.target.senseKey);
    if (list) list.push(q); else bySense.set(q.target.senseKey, [q]);
  }
  const recent = [...items].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.lemma.localeCompare(b.lemma, 'ko'));
  return recent.flatMap(item => {
    const missed = item.questionIds.flatMap(id => questions.get(id) ?? []);
    const pool = [...missed, ...(bySense.get(item.senseKey) ?? [])];
    const first = pool[0];
    if (!first) return [];
    const definition = pool.find(q => q.type === 'definition');
    const meaning = definition ? correctText(definition) : first.explanation;
    const example = pool.map(exampleOf).find((e): e is string => e !== null) ?? null;
    return [{ senseKey: item.senseKey, lemma: item.lemma, meaning, example, clears: item.clears }];
  });
}
