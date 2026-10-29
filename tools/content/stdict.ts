// 표준국어대사전 상세 응답(search/contentViewOne.do)에서 뜻 목록을 뽑는다(PRD §9.3 2단계: 제작 파이프라인이 근거를 조회).
// 뜻풀이만 쓰고 용례는 복제하지 않는다(PRD §9.5).

export interface StdictSense {
  wordNo: string;
  headword: string;
  /** 동형어 어깨번호(없으면 null). */
  homograph: string | null;
  partOfSpeech: string;
  /** 표제어 안에서의 차례(1부터). 뜻이 문형 묶음 아래 다시 번호가 매겨져도 겹치지 않는다. */
  senseOrder: number;
  /** 사전에 적힌 번호(예: 「2」, 3「1」, 2). */
  label: string;
  senseId: string | null;
  gloss: string;
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
  return [
    `표제어: ${s.headword}`,
    ...(s.homograph ? [`동형어 번호: ${s.homograph}`] : []),
    `word_no: ${s.wordNo}`,
    `sense_no: ${s.senseId ?? '없음'}`,
    `sense_order: ${s.senseOrder}`,
    ...(s.label && s.label !== `「${s.senseOrder}」` ? [`사전 뜻 번호: ${s.label}`] : []),
    `품사: ${s.partOfSpeech}`,
    `뜻풀이: ${s.gloss}`,
    `출처: ${stdictUrl(s.wordNo)}`,
  ].join('\n') + '\n';
}

export const stdictUrl = (wordNo: string) => `https://stdict.korean.go.kr/search/searchView.do?word_no=${wordNo}&searchKeywordTo=3`;

/** 검색 결과 HTML에서 표제어가 정확히 같은 항목의 word_no(동형어는 여럿). */
export function parseSearchWordNos(html: string, lemma: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/href="\/search\/searchView\.do\?word_no=(\d+)[^"]*"\s+class="t_blue1">([\s\S]*?)<\/a>/g)) {
    // 표제어 표기의 붙임표(-)·어깨번호(동형어)를 지우고 비교한다.
    if (text(m[2]!).replace(/[-^\d\s]/g, '') === lemma) found.add(m[1]!);
  }
  return [...found];
}
