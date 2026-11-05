import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { parseSearch, selectEntry, loadTargets, checkRobots, makeRequester, collect, OUTPUT } from '../../tools/fetch-krdict-grade.mjs';

// 실제 HTML의 결과 헤더 구조만 보존한다. 뜻풀이·네트워크·모델 호출은 없다.
const article = (id: number, lemma: string, pos: string, stars: number) => `<dl id="article${id}" class="printArea"><dt>
  <a href="javascript:checkSubmit('${id}','Y');"><span class="word_type1_17">${lemma}<sup>1</sup></span></a>
  <span class="word_att_type1">「${pos}」</span><span class="star">${'<i class="ri-star-s-fill"></i>'.repeat(stars)}</span>
  </dt><dd>뜻풀이 속 별은 세지 않음 <i class="ri-star-s-fill"></i></dd></dl>`;
const page = (entries: string[], total = entries.length) => `<div class="result_title">총 ${total}개</div>${entries.join('')}
  <th>초급 <span class="star"><i class="ri-star-s-fill"></i></span></th>`;
const roots: string[] = [];
function setup() {
  fs.mkdirSync('.orchestrate', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.orchestrate/krdict-test-')); roots.push(root);
  fs.writeFileSync(path.join(root, 'words.json'), JSON.stringify([{ lemma: '배', partOfSpeech: '명사' }, '없음']));
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('한국어기초사전 등급', () => {
  it('헤더의 별 3/2/1/0개만 초급/중급/고급/없음으로 읽는다', () => {
    const parsed = parseSearch(page([3, 2, 1, 0].map((n, i) => article(i, '표제어', '명사', n))));
    expect(parsed.entries.map((e: { grade: string | null }) => e.grade)).toEqual(['초급', '중급', '고급', null]);
    expect(parsed.entries[0].lemma).toBe('표제어');
    expect(parsed.entries[0].entryUrl).toBe('https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=0');
  });
  it('같은 표제어·품사의 첫 항목을 선택하고 다른 품사/부분 일치/더 높은 등급을 제외한다', () => {
    const { entries } = parseSearch(page([article(1, '배', '접사', 3), article(2, '배달', '명사', 3), article(3, '배', '명사', 1), article(4, '배', '명사', 3)]));
    const selected = selectEntry(entries, { lemma: '배', pos: ['명사'] });
    expect(selected.grade).toBe('고급');
    expect(selected.entryUrl).toContain('ParaWordNo=3');
    expect(selected.note).toContain('표제어 후보 3개; 품사 일치 후보 2개');
    expect(selectEntry(entries, { lemma: '배', pos: ['동사'] }).entryUrl).toBeNull();
  });
  it('0건과 파싱 실패를 구분한다', () => {
    expect(parseSearch(page([]))).toEqual({ total: 0, entries: [] });
    expect(() => parseSearch('<html>접근 제한</html>')).toThrow('형식 불일치');
    expect(() => parseSearch(page([], 1))).toThrow('건수');
  });
  it('관용구의 표시되지 않은 품사·등급을 확인했다고 주장하지 않는다', () => {
    const { entries } = parseSearch(page([article(9, '귀가 얇다', '', 0).replace('<span class="word_att_type1">「」</span>', '')]));
    const selected = selectEntry(entries, { lemma: '귀가 얇다', pos: ['관용구'] });
    expect(selected.grade).toBeNull();
    expect(selected.entryUrl).toContain('ParaWordNo=9');
    expect(selected.note).toContain('관용구·속담 후보 1개');
    expect(selected.note).toContain('품사·등급 미표시');
  });
  it('학년 배치만 읽어 중복 표제어를 합치고 여러 입력 품사를 보존한다', () => {
    const root = setup();
    for (const [batch, pos] of [['Q50-G4-001', '관형사'], ['Q50-G4-002', '명사'], ['Q50-G3-001', '동사']]) {
      const dir = path.join(root, 'content-source/batches', batch!); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'drafts.json'), JSON.stringify([{ target: { lemma: '규칙적', partOfSpeech: pos } }]));
    }
    expect(loadTargets(root, { grade: 4 })).toEqual([{ lemma: '규칙적', pos: ['관형사', '명사'] }]);
    expect(loadTargets(root, { file: 'words.json' })).toEqual([{ lemma: '배', pos: ['명사'] }, { lemma: '없음', pos: [] }]);
    expect(() => loadTargets(root, { grade: 4, file: 'words.json' })).toThrow('하나만');
  });
  it('Googlebot 전용 규칙과 공통 차단/더 구체적인 허용을 구분한다', () => {
    expect(() => checkRobots('User-agent: Googlebot\nDisallow: /kor/')).not.toThrow();
    expect(() => checkRobots('User-agent: *\nDisallow: /kor/')).toThrow('금지');
    expect(() => checkRobots('User-agent: *\nDisallow: /\nAllow: /kor/')).not.toThrow();
    expect(() => checkRobots('<html>error</html>')).toThrow('확인 불가');
  });
  it('재시도 두 번과 다음 요청 사이에도 1.1초 간격을 지킨다', async () => {
    let time = 0;
    const times: number[] = [];
    const fetchImpl = vi.fn(async () => { times.push(time); if (times.length < 3) throw new Error('일시 오류'); return { ok: true, text: async () => '성공' }; });
    const request = makeRequester({ fetchImpl, now: () => time, wait: async (ms: number) => { time += ms; } });
    expect(await request('https://example.invalid/')).toBe('성공');
    await request('https://example.invalid/second');
    expect(times).toEqual([0, 1100, 2200, 3300]);
    const fail = vi.fn(async () => { throw new Error('오프라인'); });
    await expect(makeRequester({ fetchImpl: fail, wait: async () => {} })('x')).rejects.toThrow('오프라인');
    expect(fail).toHaveBeenCalledTimes(3);
    const denied = vi.fn(async () => ({ ok: false, status: 403 }));
    await expect(makeRequester({ fetchImpl: denied, wait: async () => {} })('x')).rejects.toThrow('403');
    expect(denied).toHaveBeenCalledTimes(1);
  });
  it('여러 페이지를 읽고 기존 항목 보존·정렬·staging 해시를 보장하며 재실행은 조회하지 않는다', async () => {
    const root = setup();
    fs.mkdirSync(path.dirname(path.join(root, OUTPUT)), { recursive: true });
    const old = JSON.stringify({ source: {}, items: { 기존: { grade: '초급', entryUrl: null, note: '기존' } } });
    fs.writeFileSync(path.join(root, OUTPUT), old);
    const requests: string[] = [];
    const request = async (url: string) => {
      requests.push(url);
      if (url.endsWith('robots.txt')) return 'User-agent: Googlebot\nDisallow: /';
      if (url.includes('copyRightTermsInfo')) return '저작자표시-동일조건변경허락2.0 자유롭게 이용';
      const u = new URL(url);
      if (u.searchParams.get('mainSearchWord') === '없음') return page([]);
      return u.searchParams.get('currentPage') === '1' ? page([article(7, '배', '명사', 1)], 2) : page([article(8, '배', '명사', 3)], 2);
    };
    const result = await collect({ root, file: 'words.json' }, { request });
    expect(result.counts).toEqual({ 초급: 0, 중급: 0, 고급: 1, 없음: 1 });
    expect(result.failures).toEqual([]);
    expect(requests).toHaveLength(5);
    expect(fs.readFileSync(path.join(root, OUTPUT), 'utf8')).toBe(old);
    const bytes = fs.readFileSync(path.join(result.stagingDir, 'files', OUTPUT));
    const data = JSON.parse(bytes.toString());
    expect(Object.keys(data.items)).toEqual(['기존', '배', '없음']);
    expect(data.items.기존.note).toBe('기존');
    const manifest = JSON.parse(fs.readFileSync(path.join(result.stagingDir, 'manifest.json'), 'utf8'));
    expect(manifest.writes).toEqual([{ path: OUTPUT, sha256: createHash('sha256').update(bytes).digest('hex') }]);
    const noNetwork = vi.fn(async () => { throw new Error('캐시 재조회 금지'); });
    const cached = await collect({ root, file: 'words.json' }, { request: noNetwork });
    expect(cached.cached).toBe(2); expect(noNetwork).not.toHaveBeenCalled();
  });
  it('조회 실패를 없음으로 캐시하지 않고 중단·미조회 수를 보고한다', async () => {
    const root = setup();
    const request = async (url: string) => {
      if (url.endsWith('robots.txt')) return 'User-agent: *\nAllow: /';
      if (url.includes('copyRightTermsInfo')) return '저작자표시-동일조건변경허락2.0 자유롭게 이용';
      throw new Error('fetch failed', { cause: Object.assign(new Error('연결 종료'), { code: 'ECONNRESET' }) });
    };
    const result = await collect({ root, file: 'words.json' }, { request });
    expect(result.failures).toEqual([{ lemma: '배', error: 'fetch failed; ECONNRESET; 연결 종료' }]);
    expect(result.unqueried).toBe(2);
    expect(JSON.parse(fs.readFileSync(path.join(result.stagingDir, 'files', OUTPUT), 'utf8')).items).toEqual({});
  });
});
