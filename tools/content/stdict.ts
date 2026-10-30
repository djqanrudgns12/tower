// 표준국어대사전 상세 응답(search/contentViewOne.do)에서 뜻 목록을 뽑는다(PRD §9.3 2단계: 제작 파이프라인이 근거를 조회).
// 뜻풀이만 쓰고 용례는 복제하지 않는다(PRD §9.5).

export interface StdictSense {
  provider?: 'stdict' | 'opendict';
  wordNo: string;
  headword: string;
  /** 동형어 어깨번호(없으면 null). */
  homograph: string | null;
  partOfSpeech: string;
  /** 방언·관용구·속담 등 부가 분류 표지(없으면 빈 문자열). */
  category?: string;
  /** 표제어 안에서의 차례(1부터). 뜻이 문형 묶음 아래 다시 번호가 매겨져도 겹치지 않는다. */
  senseOrder: number;
  /** 사전에 적힌 번호(예: 「2」, 3「1」, 2). */
  label: string;
  senseId: string | null;
  gloss: string;
  /** 상세 조회 구분값(단어 3, 관용구 2, 속담 1). */
  keywordTo?: '1' | '2' | '3';
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function parseStdictEntry(html: string, wordNo: string): StdictSense[] {
  const head = /<span class="tit_b">([\s\S]*?)<span/.exec(html)?.[1] ?? '';
  const homograph = /<sup>\s*(\d+)\s*<\/sup>/.exec(head)?.[1] ?? null;
  const headword = text(head.replace(/<sup>[\s\S]*?<\/sup>/g, ''));
  // 품사 표지·문형 묶음·뜻 문단을 나온 순서대로 훑는다. 뜻 ID는 그 뜻 뒤의 용례 목록 id(senseExample<ID>)에 있다.
  const tokens = [...html.matchAll(/<span class="tit_noun">([\s\S]*?)<\/span>|<p class="t_tit2">([\s\S]*?)<\/p>|<p class="t_number"[^>]*>([\s\S]*?)<\/p>|<ul id="senseExample(\d+)"/g)];
  const senses: StdictSense[] = [];
  let pos = '';
  let group = '';
  for (const t of tokens) {
    if (t[1] !== undefined) { pos = text(t[1]); group = ''; }
    else if (t[2] !== undefined) group = /^(\d+)/.exec(text(t[2]))?.[1] ?? '';
    else if (t[3] !== undefined) {
      const gloss = text(t[3]);
      const label = `${group}${/^「\d+」/.exec(gloss)?.[0] ?? ''}`;
      senses.push({ wordNo, headword, homograph, partOfSpeech: pos, senseOrder: senses.length + 1, label, senseId: null, gloss });
    } else if (t[4] !== undefined && senses.length > 0 && senses[senses.length - 1]!.senseId === null) senses[senses.length - 1]!.senseId = t[4];
  }
  return senses;
}

/** 근거 파일 본문. Q20-001·Q20-002 근거 파일과 같은 줄 형식이다. */
export function evidenceText(s: StdictSense): string {
  const url = s.provider === 'opendict' ? opendictUrl(s.senseId ?? s.wordNo) : stdictUrl(s.wordNo, s.keywordTo ?? '3');
  return [
    `표제어: ${s.headword}`,
    ...(s.homograph ? [`동형어 번호: ${s.homograph}`] : []),
    `word_no: ${s.wordNo}`,
    `sense_no: ${s.senseId ?? '없음'}`,
    `sense_order: ${s.senseOrder}`,
    ...(s.label && s.label !== `「${s.senseOrder}」` ? [`사전 뜻 번호: ${s.label}`] : []),
    `품사: ${s.partOfSpeech}`,
    ...(s.category ? [`구분: ${s.category}`] : []),
    `뜻풀이: ${s.gloss}`,
    `출처: ${url}`,
  ].join('\n') + '\n';
}

export const stdictUrl = (wordNo: string, keywordTo: '1' | '2' | '3' = '3') =>
  `https://stdict.korean.go.kr/search/searchView.do?word_no=${wordNo}&searchKeywordTo=${keywordTo}`;

export const opendictUrl = (senseNo: string) =>
  `https://opendict.korean.go.kr/dictionary/view?sense_no=${senseNo}&viewType=confirm`;

/** 관용구·속담 표제어의 선택 조사 괄호·이형태 대괄호를 풀어 비교 가능한 후보 문자열 집합을 만든다. */
export function phraseVariants(raw: string): Set<string> {
  const clean = raw.replace(/\[[^\]]*\]/g, '').replace(/[-^\d]/g, '').replace(/\s+/g, ' ').trim();
  const withParen = clean.replace(/[()]/g, '').replace(/\s+/g, '');
  const withoutParen = clean.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
  return new Set([withParen, withoutParen].filter(Boolean));
}

/** 검색 결과 HTML에서 표제어가 정확히 같은 항목의 word_no(동형어는 여럿). */
export function parseSearchWordNos(html: string, lemma: string): string[] {
  const found = new Set<string>();
  const target = lemma.replace(/[-^\d\s]/g, '');
  for (const m of html.matchAll(/href="\/search\/searchView\.do\?word_no=(\d+)[^"]*"\s+class="t_blue1">([\s\S]*?)<\/a>/g)) {
    // 표제어 표기의 붙임표(-)·어깨번호(동형어)를 지우고 비교한다.
    if (text(m[2]!).replace(/[-^\d\s]/g, '') === target) found.add(m[1]!);
  }
  return [...found];
}

/** 표준국어대사전 자세히 찾기(관용구 native_code=4 → To=2, 속담 native_code=5 → To=1) 결과에서 일치 항목을 뽑는다. */
export function parseDetailPhraseHits(html: string, lemma: string): Array<{ wordNo: string; keywordTo: '1' | '2' | '3'; title: string }> {
  const wanted = phraseVariants(lemma);
  const seen = new Set<string>();
  const out: Array<{ wordNo: string; keywordTo: '1' | '2' | '3'; title: string }> = [];
  for (const m of html.matchAll(/fnSearchView\('(\d+)'\s*,\s*'(\d+)'\)[^>]*>([\s\S]*?)<\/a>/g)) {
    const wordNo = m[1]!;
    const nativeCode = m[2]!;
    const title = text(m[3]!);
    if (!title || title === '전체 보기') continue;
    const variants = phraseVariants(title);
    if (![...wanted].some(w => variants.has(w))) continue;
    const keywordTo: '1' | '2' | '3' = nativeCode === '4' ? '2' : nativeCode === '5' ? '1' : '3';
    const key = `${wordNo}:${keywordTo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ wordNo, keywordTo, title });
  }
  return out;
}

/**
 * 국립국어원 우리말샘(opendict.korean.go.kr)에서 전문가 감수 완료(viewType=confirm)된 항목만 뽑는다.
 * 표준국어대사전에서 이관된 지역 방언 근거 수집에 쓰며, 미감수 참여자 항목(viewType 없음/기타)은 받지 않는다.
 */
export function parseOpendictConfirmed(html: string, lemma: string, onlyDialect = false): StdictSense[] {
  const wanted = phraseVariants(lemma);
  const out: StdictSense[] = [];
  for (const m of html.matchAll(/<a href="\/dictionary\/view\?sense_no=(\d+)&(?:amp;)?viewType=confirm">([\s\S]*?)<\/a>/g)) {
    const senseNo = m[1]!;
    const inner = m[2]!;
    const rawHead = /<span class="search_word_type3_15[^"]*">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? '';
    const homograph = /<sup>\s*(\d+)\s*<\/sup>/.exec(rawHead)?.[1] ?? null;
    const headword = text(rawHead.replace(/<sup>[\s\S]*?<\/sup>/g, ''));
    if (![...phraseVariants(headword)].some(v => wanted.has(v))) continue;
    const rawOrder = text(/<span class="word_no[^"]*">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? '');
    const senseOrder = Number(/\d+/.exec(rawOrder)?.[0] ?? '1') || 1;
    const partOfSpeech = text(/<span class="word_att_type1[^"]*">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? '') || '「품사 없음」';
    const category = text(/<span class="word_att_type3[^"]*">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? '');
    const gloss = text(/<span class="word_dis[^"]*">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? '');
    if (!gloss) continue;
    if (onlyDialect && !category.includes('방언') && !gloss.includes('방언')) continue;
    out.push({
      provider: 'opendict',
      wordNo: senseNo,
      headword,
      homograph,
      partOfSpeech,
      ...(category ? { category } : {}),
      senseOrder,
      label: rawOrder,
      senseId: senseNo,
      gloss,
    });
  }
  return out;
}
