import { describe, expect, it } from 'vitest';
import { evidenceText, parseDetailPhraseHits, parseOpendictConfirmed, parseSearchWordNos, parseStdictEntry } from '../../tools/content/stdict';

// 표준국어대사전 응답의 실제 마크업을 줄인 조각(2026-10-29 contentViewOne.do·searchResult.do에서 확인한 구조).
const grouped = `<li><span class="tit_b">나누다<span class="chi_info_list"></span></span>
<span class="tit_noun">「동사」</span>
<p class="t_tit2"><span>1</span> 【…을 …으로】</p>
<p class="t_number">「1」 하나를 둘 이상으로 가르다.</p><ul id="senseExample29897" class="more_list"><li>예</li></ul>
<p class="t_number">「2」 여러 가지가 섞인 것을 구분하여 분류하다.</p><ul id="senseExample60901"></ul>
<p class="t_tit2"><span>2</span> 【…을 …에/에게】</p>
<p class="t_number">몫을 분배하다.</p><ul id="senseExample111419"></ul>
<p class="t_tit2"><span>3</span> 【(…과) …을】</p>
<p class="t_number">「1」 음식 따위를 함께 먹거나 갈라 먹다.</p>
<p class="t_number">「2」 말이나 이야기, 인사 따위를 주고받다.</p><ul id="senseExample62357"></ul></li>`;

describe('표준국어대사전 근거 조회(tools/content/stdict.ts)', () => {
  it('문형 묶음 아래 다시 매긴 번호도 표제어 안 차례로 겹치지 않게 세고, 사전 번호와 뜻 ID를 붙인다', () => {
    const senses = parseStdictEntry(grouped, '406097');
    expect(senses.map(s => [s.senseOrder, s.label, s.senseId])).toEqual([
      [1, '1「1」', '29897'], [2, '1「2」', '60901'], [3, '2', '111419'], [4, '3「1」', null], [5, '3「2」', '62357'],
    ]);
    expect(senses.every(s => s.headword === '나누다' && s.partOfSpeech === '「동사」')).toBe(true);
  });

  it('동형어 어깨번호는 표제어와 따로 두고, 근거 파일에 사전 번호를 함께 적는다', () => {
    const [s] = parseStdictEntry('<span class="tit_b">용기<sup>2</sup><span></span></span><span class="tit_noun">「명사」</span><p class="t_number">씩씩하고 굳센 기운.</p><ul id="senseExample393573">', '468084');
    expect(s).toMatchObject({ headword: '용기', homograph: '2', senseOrder: 1, label: '', senseId: '393573' });
    expect(evidenceText(s!)).toBe('표제어: 용기\n동형어 번호: 2\nword_no: 468084\nsense_no: 393573\nsense_order: 1\n품사: 「명사」\n뜻풀이: 씩씩하고 굳센 기운.\n출처: https://stdict.korean.go.kr/search/searchView.do?word_no=468084&searchKeywordTo=3\n');
    expect(evidenceText(parseStdictEntry(grouped, '406097')[3]!)).toContain('sense_order: 4\n사전 뜻 번호: 3「1」\n');
  });

  it('검색 결과에서 붙임표·어깨번호를 뺀 표제어가 같은 항목만 고른다', () => {
    const html = '<a href="/search/searchView.do?word_no=454584&searchKeywordTo=3"  class="t_blue1">\n어리둥절-하다</a>'
      + '<a href="/search/searchView.do?word_no=1&searchKeywordTo=3"  class="t_blue1">어리둥절</a>'
      + '<a href="/search/searchView.do?word_no=468084&searchKeywordTo=3"  class="t_blue1">용기<sup>2</sup></a>';
    expect(parseSearchWordNos(html, '어리둥절하다')).toEqual(['454584']);
    expect(parseSearchWordNos(html, '용기')).toEqual(['468084']);
  });

  it('관용구·속담 상세 검색 결과에서 선택 조사·이형태 표기를 정규화해 일치 항목을 뽑는다', () => {
    const html = `<a href="#none" onclick="javascript:fnSearchView('521624', '4')" class="t_blue1">발(이) 넓다[너르다]</a>`
      + `<a href="#none" onclick="javascript:fnSearchView('519151', '5')" class="t_blue1">가는 말이 고와야 오는 말이 곱다</a>`
      + `<a href="#none" onclick="javascript:fnSearchView('999999', '4')" class="t_blue1">발이 묶이다</a>`;
    expect(parseDetailPhraseHits(html, '발이 넓다')).toEqual([{ wordNo: '521624', keywordTo: '2', title: '발(이) 넓다[너르다]' }]);
    expect(parseDetailPhraseHits(html, '가는 말이 고와야 오는 말이 곱다')).toEqual([{ wordNo: '519151', keywordTo: '1', title: '가는 말이 고와야 오는 말이 곱다' }]);
  });

  it('우리말샘 감수 완료(viewType=confirm) 방언만 뽑고 미감수 항목은 버린다', () => {
    const html = `<a href="/dictionary/view?sense_no=433889&viewType=confirm">
      <span class="search_word_type3_15 mr5">정구지</span>
      <span class="word_no mr5">「001」</span>
      <span class="word_att_type1 mr5">「명사」</span>
      <span class="word_att_type3 mr5">「방언」</span>
      <span class="word_dis ml5">‘부추’의 방언(경상, 전북, 충청).</span>
    </a>
    <a href="/dictionary/view?sense_no=777777">
      <span class="search_word_type3_15 mr5">정구지</span>
      <span class="word_no mr5">「002」</span>
      <span class="word_att_type1 mr5">「명사」</span>
      <span class="word_att_type3 mr5">「방언」</span>
      <span class="word_dis ml5">미감수 오픈 사전 항목.</span>
    </a>`;
    const senses = parseOpendictConfirmed(html, '정구지', true);
    expect(senses).toHaveLength(1);
    expect(senses[0]).toMatchObject({
      provider: 'opendict', wordNo: '433889', headword: '정구지', senseOrder: 1,
      partOfSpeech: '「명사」', category: '「방언」', senseId: '433889', gloss: '‘부추’의 방언(경상, 전북, 충청).',
    });
    expect(evidenceText(senses[0]!)).toContain('구분: 「방언」\n뜻풀이: ‘부추’의 방언(경상, 전북, 충청).\n출처: https://opendict.korean.go.kr/dictionary/view?sense_no=433889&viewType=confirm\n');
  });
});
