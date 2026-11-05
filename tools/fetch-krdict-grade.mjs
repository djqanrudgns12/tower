#!/usr/bin/env node
// node --use-system-ca tools/fetch-krdict-grade.mjs --grade 4 | --file words.json
// words.json: ["낱말", {"lemma":"낱말","partOfSpeech":"명사"}] 또는 줄마다 낱말.
// 결과 데이터: 국립국어원 한국어기초사전, CC BY-SA 2.0 KR. W2b만 추적 경로에 반영한다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://krdict.korean.go.kr';
const SEARCH = '/kor/dicMarinerSearch/search';
const POLICY = '/kor/kboardPolicy/copyRightTermsInfo';
export const OUTPUT = 'content-source/reference/krdict-grade.json';
const BATCH = 'krdict-grade';
const AGENT = 'TowerVocabularyGrade/1.0';
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const text = html => html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '').replace(/<[^>]*>/g, '')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function parseSearch(html) {
  const count = /총\s*([\d,]+)개/.exec(html);
  if (!count) throw new Error('검색 결과 형식 불일치: 차단/오류 응답을 등급 없음으로 저장하지 않는다');
  const entries = [...html.matchAll(/<dl\b[^>]*\bid="article\d+"[^>]*>\s*<dt>([\s\S]*?)<\/dt>/g)].map(([, dt]) => {
    const lemma = /<span class="word_type1_17">([\s\S]*?)<\/span>/.exec(dt)?.[1];
    const id = /checkSubmit\('(\d+)'\s*,\s*'Y'\)/.exec(dt)?.[1];
    if (!lemma || !id) throw new Error('표제어/공개 항목 URL 형식 불일치');
    const stars = [...dt.matchAll(/class="ri-star-s-fill"/g)].length;
    if (stars > 3) throw new Error('알 수 없는 별 표시');
    return { lemma: text(lemma), pos: [...dt.matchAll(/<span class="word_att_type1">([\s\S]*?)<\/span>/g)].map(m => text(m[1]).replace(/[「」]/g, '')),
      grade: [null, '고급', '중급', '초급'][stars], entryUrl: `${BASE}/kor/dicSearch/SearchView?ParaWordNo=${id}` };
  });
  const total = Number(count[1].replaceAll(',', ''));
  if ((total > 0 && !entries.length) || total < entries.length) throw new Error('검색 건수와 표제어 목록 불일치');
  return { total, entries };
}

export function selectEntry(entries, target) {
  const exact = entries.filter(e => e.lemma === target.lemma);
  const phrase = target.pos.length > 0 && target.pos.every(p => ['관용구', '속담'].includes(p));
  const matches = exact.filter(e => !target.pos.length || e.pos.some(p => target.pos.includes(p)) || (phrase && !e.pos.length));
  const first = matches[0];
  return { grade: first?.grade ?? null, entryUrl: first?.entryUrl ?? null,
    note: `표제어 후보 ${exact.length}개; ${phrase ? '관용구·속담' : target.pos.length ? '품사 일치' : '품사 미지정'} 후보 ${matches.length}개; ${first ? '검색 순서 첫 번째 일치' : '일치 없음'}; 입력 품사 ${target.pos.join('/') || '미지정'}; 선택 품사 ${first?.pos.join('/') || '미표시'}${phrase ? '; 관용구·속담 검색은 품사·등급 미표시' : ''}${first && first.grade === null ? '; 별 표시 없음' : ''}` };
}

export function loadTargets(root, { grade, file }) {
  if ((grade == null) === (file == null)) throw new Error('--grade N 또는 --file 목록 중 하나만 지정한다');
  let rows;
  if (grade != null) {
    if (!/^[1-6]$/.test(String(grade))) throw new Error('학년은 1~6');
    rows = fs.readdirSync(path.join(root, 'content-source/batches')).sort().filter(n => n.startsWith(`Q50-G${grade}-`))
      .flatMap(n => read(path.join(root, 'content-source/batches', n, 'drafts.json')).map(d => d.target));
  } else {
    const raw = fs.readFileSync(path.resolve(root, file), 'utf8').trim();
    rows = raw.startsWith('[') ? JSON.parse(raw) : raw.split(/\r?\n/).filter(Boolean);
  }
  const targets = new Map();
  for (const row of rows) {
    const lemma = typeof row === 'string' ? row.trim() : row?.lemma?.trim();
    if (!lemma) throw new Error('빈 표제어 또는 잘못된 목록');
    const pos = typeof row === 'string' ? null : row.partOfSpeech;
    if (pos != null && (typeof pos !== 'string' || !pos.trim())) throw new Error('품사 형식 오류');
    const item = targets.get(lemma) ?? { lemma, pos: [] };
    if (pos && !item.pos.includes(pos)) item.pos.push(pos);
    targets.set(lemma, item);
  }
  if (!targets.size) throw new Error('조회할 낱말 없음');
  return [...targets.values()].sort((a, b) => a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0);
}

// 실제 UA에 적용되는 가장 구체적인 그룹/경로 규칙을 사용한다. Googlebot으로 위장하지 않는다.
export function checkRobots(body) {
  if (/<html/i.test(body) || !/user-agent:/i.test(body)) throw new Error('robots.txt 확인 불가');
  const groups = []; let group; let hasRules = false;
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*(user-agent|allow|disallow)\s*:\s*([^#]*)/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group) { group.rules.push({ key, value }); hasRules = true; }
  }
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && AGENT.toLowerCase().includes(a)));
  const applicable = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  for (const pathname of [SEARCH, POLICY]) {
    const rules = applicable.flatMap(g => g.rules).filter(r => r.value && new RegExp(`^${r.value.split('*').map(s => s.replace(/[.+?^{}()|[\]\\]/g, '\\$&')).join('.*')}`).test(pathname))
      .sort((a, b) => b.value.length - a.value.length || (a.key === 'allow' ? -1 : 1));
    if (rules[0]?.key === 'disallow') throw new Error(`robots.txt 자동 조회 금지: ${pathname}`);
  }
}

export function makeRequester({ fetchImpl = fetch, now = Date.now, wait = sleep } = {}) {
  let last = -Infinity;
  return async url => {
    for (let attempt = 0; ; attempt++) {
      await wait(Math.max(0, 1100 - (now() - last))); last = now();
      try {
        const response = await fetchImpl(url, { headers: { 'User-Agent': AGENT }, redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${url}`);
          error.blocked = [401, 403, 429].includes(response.status); throw error;
        }
        return await response.text();
      } catch (error) { if (error.blocked || attempt >= 2) throw error; }
    }
  };
}

export async function collect(options, deps = {}) {
  const started = Date.now(), root = path.resolve(options.root ?? path.resolve(import.meta.dirname, '..'));
  const targets = loadTargets(root, options), items = {};
  const staging = path.join(root, '.orchestrate/staging', BATCH);
  // 성공 결과만 캐시한다. 이전 중단 실행의 체크포인트도 보존·재사용한다.
  const caches = [path.join(root, OUTPUT), ...(fs.existsSync(staging) ? fs.readdirSync(staging).sort().map(r => path.join(staging, r, 'files', OUTPUT)) : [])];
  for (const cache of caches) if (fs.existsSync(cache)) {
    for (const [lemma, item] of Object.entries(read(cache).items)) if (!Object.hasOwn(items, lemma)) items[lemma] = item;
  }
  const createdAt = new Date().toISOString(), runId = `${createdAt.replace(/[-:.]/g, '')}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const dir = path.join(staging, runId), out = path.join(dir, 'files', OUTPUT);
  const source = { name: '국립국어원 한국어기초사전', url: `${BASE}/`, retrievedAt: createdAt };
  const save = () => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(`${out}.tmp`, json({ source, items: Object.fromEntries(Object.entries(items).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) }));
    fs.renameSync(`${out}.tmp`, out);
  };
  const request = deps.request ?? makeRequester();
  const missing = targets.filter(t => !Object.hasOwn(items, t.lemma));
  const failures = [];
  if (missing.length) {
    checkRobots(await request(`${BASE}/robots.txt`));
    const policy = await request(`${BASE}${POLICY}`);
    if (!policy.includes('저작자표시-동일조건변경허락2.0') || !policy.includes('자유롭게 이용')) throw new Error('이용 정책 변경/확인 불가: 수동 검토 필요');
  }
  for (const target of missing) {
    try {
      const entries = []; let total = 1;
      const searchType = target.pos.length && target.pos.every(p => ['관용구', '속담'].includes(p)) ? 'P' : 'W';
      for (let page = 1; entries.length < total; page++) {
        const url = new URL(SEARCH, BASE);
        url.search = new URLSearchParams({ mainSearchWord: target.lemma, searchType, sort: 'W', blockCount: '100', currentPage: String(page) });
        const result = parseSearch(await request(url.href));
        if (page > 1 && result.total !== total) throw new Error('조회 중 검색 건수 변경');
        if (result.entries.some(e => entries.some(old => old.entryUrl === e.entryUrl))) throw new Error('페이지 반복/항목 중복');
        total = result.total; entries.push(...result.entries);
        if (total > 10000) throw new Error('검색 범위가 너무 큼: 수동 검토 필요');
      }
      items[target.lemma] = selectEntry(entries, target); save();
      deps.progress?.({ lemma: target.lemma, completed: targets.filter(t => Object.hasOwn(items, t.lemma)).length, total: targets.length });
    } catch (error) { failures.push({ lemma: target.lemma, error: [error.message, error.cause?.code, error.cause?.message].filter(Boolean).join('; ') }); break; }
  }
  save();
  const manifest = { batchId: BATCH, runId, tool: 'fetch-krdict-grade', model: 'none', createdAt,
    writes: [{ path: OUTPUT, sha256: hash(fs.readFileSync(out)) }], deletes: [] };
  fs.writeFileSync(path.join(dir, 'manifest.tmp'), json(manifest));
  fs.renameSync(path.join(dir, 'manifest.tmp'), path.join(dir, 'manifest.json'));
  const counts = { 초급: 0, 중급: 0, 고급: 0, 없음: 0 };
  for (const target of targets) if (Object.hasOwn(items, target.lemma)) counts[items[target.lemma].grade ?? '없음']++;
  return { stagingDir: dir, counts, failures, cached: targets.length - missing.length,
    unqueried: targets.filter(t => !Object.hasOwn(items, t.lemma)).length, seconds: (Date.now() - started) / 1000 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || !['--grade', '--file'].includes(args[0])) throw new Error('사용법: --grade N 또는 --file 목록');
    const result = await collect({ [args[0].slice(2)]: args[1] }, { progress: p => console.error(`${p.completed}/${p.total} ${p.lemma}`) });
    console.log(json(result)); if (result.failures.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
