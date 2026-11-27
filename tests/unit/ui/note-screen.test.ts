import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_REVIEW_SENSES } from '../../../src/domain/quiz';
import { emptyReviewNote, listReviewNoteItems, reviewNoteItemKey } from '../../../src/persistence/reviewNote';
import { NoteFlashcard } from '../../../src/ui/screens/NoteFlashcard';
import { NoteScreen } from '../../../src/ui/screens/NoteScreen';
import {
  buildNoteEntries,
  filterNoteEntries,
  markNextRunPriority,
  maskLemmaInExample,
  NOTE_NEXT_RUN_CAP,
  sortNoteEntries,
  type NoteEntry,
} from '../../../src/ui/screens/noteModel';
import { contextFor, gradeContent, loadGradeContent } from '../../../src/content';

function sampleEntries(count = 5): NoteEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    senseKey: `sense/${i + 1}`,
    lemma: `낱말${i + 1}`,
    meaning: `뜻풀이 ${i + 1}`,
    example: `오늘은 낱말${i + 1} 표현을 익혀요.`,
    clears: i % 2,
    misses: (i % 3) + 1,
  }));
}

describe('오답 노트 고도화 모델 (WP-C2-02)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('우선 출제 상한(NOTE_NEXT_RUN_CAP)은 도메인 MAX_REVIEW_SENSES(12)와 일치하고 상위 12개만 표시한다', () => {
    expect(NOTE_NEXT_RUN_CAP).toBe(MAX_REVIEW_SENSES);
    const list = sampleEntries(20);
    const marked = markNextRunPriority(list);
    expect(marked).toHaveLength(20);
    expect(marked.filter(e => e.nextRunPriority)).toHaveLength(MAX_REVIEW_SENSES);
    // 원래 배열 순서가 유지된다.
    expect(marked.map(e => e.senseKey)).toEqual(list.map(e => e.senseKey));
  });

  it('검색어는 앞뒤·연속 공백과 무관하게 낱말·뜻·예문을 거르고 특수문자에도 안전하다', () => {
    const entries = sampleEntries(4);
    expect(filterNoteEntries(entries, '   ')).toHaveLength(4);
    expect(filterNoteEntries(entries, '  낱말2  ').map(e => e.lemma)).toEqual(['낱말2']);
    expect(filterNoteEntries(entries, '뜻풀이 3').map(e => e.lemma)).toEqual(['낱말3']);
    expect(filterNoteEntries(entries, '[없음].*')).toEqual([]);
  });

  it('정렬(priority)은 clears 적은 순 → misses 많은 순 → 기존 순서를 지킨다', () => {
    const list: NoteEntry[] = [
      { senseKey: 'a', lemma: '가', meaning: '뜻1', example: null, clears: 1, misses: 5 },
      { senseKey: 'b', lemma: '나', meaning: '뜻2', example: null, clears: 0, misses: 1 },
      { senseKey: 'c', lemma: '다', meaning: '뜻3', example: null, clears: 0, misses: 4 },
    ];
    expect(sortNoteEntries(list, 'recent').map(e => e.senseKey)).toEqual(['a', 'b', 'c']);
    expect(sortNoteEntries(list, 'priority').map(e => e.senseKey)).toEqual(['c', 'b', 'a']);
  });

  it('maskLemmaInExample는 예문의 낱말을 빈칸으로 가리고 없으면 null을 돌려준다', () => {
    expect(maskLemmaInExample('아이가 반짝이며 걸어요.', '아이가')).toBe('____ 반짝이며 걸어요.');
    expect(maskLemmaInExample('다른 문장이에요.', '없는낱말')).toBeNull();
    expect(maskLemmaInExample(null, '아이가')).toBeNull();
  });

  it('buildNoteEntries는 실제 문제은행과 misses 필드를 보존한다', async () => {
    await loadGradeContent(3);
    const ctx = contextFor(3, 'Normal');
    const q = ctx.questions.values().next().value!;
    const out = buildNoteEntries(
      [{ lemma: q.target.lemma, senseKey: q.target.senseKey, questionIds: [q.id], clears: 0, misses: 3, lastSeenAt: '2026-11-28T00:00:00.000Z' }],
      ctx.questions,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.misses).toBe(3);
  });

  it('NoteScreen·NoteFlashcard가 무보상 안내·우선 배지·검색창을 정상 렌더링하고 localStorage를 건드리지 않는다', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    const entries = sampleEntries(3);
    const screenHtml = renderToStaticMarkup(createElement(NoteScreen, { entries, onBack: vi.fn() }));
    expect(screenHtml).toContain('aria-label="낱말 검색"');
    expect(screenHtml).toContain('카드 복습');
    expect(screenHtml).toContain('다음 판 출제 예정');

    const cardHtml = renderToStaticMarkup(createElement(NoteFlashcard, { entries, onClose: vi.fn() }));
    expect(cardHtml).toContain('연습용 복습 카드예요. 다음 판에서 맞히면 졸업해요.');
    expect(cardHtml).toContain('뜻 확인');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('markNextRunPriority 상위 12개는 persistence listReviewNoteItems와 clears 혼합 시에도 정확히 일치한다', async () => {
    await loadGradeContent(3);
    const ctx = contextFor(3, 'Normal');
    const bankId = gradeContent(3).bank!.bankId;
    const pool = [...ctx.questions.values()].slice(0, 20);
    const note = emptyReviewNote();
    const noteItems = pool.map((q, idx) => {
      const clears = idx % 2;
      const misses = (idx * 7) % 11 + 1;
      const lastSeenAt = `2026-11-${String((idx % 20) + 1).padStart(2, '0')}T00:00:00.000Z`;
      note.items[reviewNoteItemKey(bankId, q.target.senseKey)] = {
        lemma: q.target.lemma,
        senseKey: q.target.senseKey,
        bankId,
        questionIds: [q.id],
        misses,
        clears,
        addedAt: lastSeenAt,
        lastSeenAt,
      };
      return {
        lemma: q.target.lemma,
        senseKey: q.target.senseKey,
        questionIds: [q.id],
        clears,
        misses,
        lastSeenAt,
      };
    });

    const expectedTop12 = new Set(
      listReviewNoteItems(note, bankId, ctx.questions)
        .slice(0, MAX_REVIEW_SENSES)
        .map(item => item.senseKey),
    );
    const uiEntries = markNextRunPriority(buildNoteEntries(noteItems, ctx.questions));
    const uiTop12 = new Set(uiEntries.filter(e => e.nextRunPriority).map(e => e.senseKey));
    expect(uiTop12).toEqual(expectedTop12);
  });
});
