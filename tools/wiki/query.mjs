import {
  REPO_ROOT,
  exists,
  readText,
  walkFiles,
} from './lib/fsutil.mjs';
import { extractHeadings, extractSection } from './lib/markdown.mjs';
import { parseGlossary, parseLessons } from './lib/entries.mjs';
import { extractContracts, extractDecisions } from './lib/extractors.mjs';

const USAGE = `사용법: npm run wiki:query -- <옵션>
  --toc <파일>                  문서의 헤딩 목차·줄 범위·글자 수 조회
  --section <파일> <절/제목>    문서에서 특정 절만 발췌 (예: vocabulary_td_prd_v0_5.md 13.2)
  --tower [ID/이름]             타워 20종 전체 또는 특정 타워 계약 조회
  --enemy [ID]                  적 역할 10종 및 종족 8종 계약 조회
  --map [ID/학년]               학년별 맵 4종 계약 조회
  --bank                        3~6학년 공개 문제은행 버전·문항 수 실시간 조회
  --route [키워드]              기록·랭킹 서버 HTTP 엔드포인트 조회
  --table [이름]                Cloudflare D1 SQLite 테이블·트리거 조회
  --decision [ID/키워드]        핵심 확정 의사결정(DEC-01~) 조회
  --lessons [영역] [--tag 태그] 교훈 원장 조회 (engineering | ui | ops)
  --glossary [용어]             용어·약어 사전 조회
  --grep <검색어>               wiki/ 및 핵심 기준 문서 고속 검색`;

export function runQuery(argv, root = REPO_ROOT) {
  const args = [...argv];
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { code: 0, output: USAGE };
  }

  const flag = args[0] ?? '';

  if (flag === '--toc') {
    const file = args[1];
    if (!file || !exists(root, file)) {
      return { code: 1, output: `파일을 찾을 수 없습니다: ${file ?? '(미입력)'}` };
    }
    const headings = extractHeadings(readText(root, file));
    const lines = [
      `# TOC: ${file} (총 ${headings.length}개 절)`,
      ...headings.map(
        (h) =>
          `${'  '.repeat(Math.max(0, h.level - 1))}- [L${h.line}-L${h.endLine} · ${h.chars}자] ${'#'.repeat(h.level)} ${h.text} (#${h.slug})`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--section') {
    const file = args[1];
    const query = args.slice(2).join(' ').trim();
    if (!file || !query || !exists(root, file)) {
      return { code: 1, output: '사용법: --section <파일> <절번호 또는 제목>' };
    }
    const res = extractSection(readText(root, file), query);
    if (!res) {
      return { code: 1, output: `'${file}'에서 '${query}' 절을 찾지 못했습니다. --toc로 목차를 확인하세요.` };
    }
    const header = `<!-- 출처: ${file}#L${res.heading.line}-L${res.heading.endLine} (${res.heading.chars}자) -->`;
    return { code: 0, output: `${header}\n${res.content}` };
  }

  if (flag === '--tower') {
    const q = (args[1] ?? '').toLowerCase();
    const c = extractContracts(root);
    const list = q
      ? c.towers.filter(
          (t) => t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q),
        )
      : c.towers;
    if (list.length === 0) {
      return { code: 1, output: `일치하는 타워가 없습니다: ${args[1]}` };
    }
    const lines = [
      `# 타워 계약 (${list.length}/${c.towers.length}종) — 상세 진화표: docs/renewal/catalog/towers.md`,
      ...list.map(
        (t) =>
          `- ${t.id} (${t.label}): 비용 ${t.cost}G | ${t.damageType} 피해 ${t.damage} | 간격 ${t.intervalMs}ms | 사거리 ${t.rangeCells}칸 | 표적 ${t.maxTargets} | 대공 ${t.canHitFlyer ? 'O' : 'X'} | 진화형태 ${t.formCount}개`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--enemy') {
    const q = (args[1] ?? '').toLowerCase();
    const c = extractContracts(root);
    const list = q
      ? c.enemies.filter((e) => e.id.toLowerCase().includes(q) || e.traits.toLowerCase().includes(q))
      : c.enemies;
    if (list.length === 0) {
      return { code: 1, output: `일치하는 적 역할이 없습니다: ${args[1]}` };
    }
    const lines = [
      `# 적 역할 (${list.length}/${c.enemies.length}종) · 종족 ${c.factions.length}종(${c.factions.map((f) => f.id).join(', ')})`,
      ...list.map(
        (e) => `- ${e.id}: HP ×${e.hpMultiplier} | 속도 ×${e.speedMultiplier} | ${e.traits}`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--map') {
    const q = (args[1] ?? '').toLowerCase();
    const c = extractContracts(root);
    const list = q
      ? c.maps.filter(
          (m) => m.id.toLowerCase().includes(q) || String(m.grade) === q.replace('학년', ''),
        )
      : c.maps;
    if (list.length === 0) {
      return { code: 1, output: `일치하는 맵이 없습니다: ${args[1]}` };
    }
    const lines = [
      `# 맵 계약 (${list.length}/${c.maps.length}종)`,
      ...list.map(
        (m) =>
          `- ${m.id} (${m.grade}학년): 격자 ${m.grid} | 경로 ${m.pathLength}칸(${m.baseTravelTicks}틱) | ${m.entryCell}→${m.exitCell} | 슬롯 ${m.slots}칸 | 장식 ${m.decorations}개`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--bank') {
    const c = extractContracts(root);
    const lines = [
      `# 공개 문제은행 현황 (자기 학년 합계 ${c.totalOwnQuestions} · 총 출제 풀 ${c.totalPoolQuestions} · 연습 ${c.practiceCount} · 철회 ${c.retractionCount})`,
      ...c.banks.map(
        (b) =>
          `- ${b.grade}학년 (${b.bankId}, ${b.bankVersion}): 자기 학년 ${b.ownCount} + 공유 ${b.sharedCount} = 출제 풀 ${b.questionCount}문항`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--route') {
    const q = (args[1] ?? '').toLowerCase();
    const c = extractContracts(root);
    const list = q
      ? c.serverRoutes.filter(
          (r) =>
            r.path.toLowerCase().includes(q) ||
            r.handler.toLowerCase().includes(q) ||
            r.method.toLowerCase() === q,
        )
      : c.serverRoutes;
    if (list.length === 0) {
      return { code: 1, output: `일치하는 서버 라우트가 없습니다: ${args[1]}` };
    }
    const lines = [
      `# 서버 HTTP 라우트 (${list.length}종 · 도메인 https://${c.wrangler.customDomain})`,
      ...list.map(
        (r) =>
          `- ${r.method} ${r.path} [auth=${r.auth}] → ${r.handler} (${r.file}#L${r.line})`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--table') {
    const q = (args[1] ?? '').toLowerCase();
    const c = extractContracts(root);
    const list = q
      ? c.dbTables.filter(
          (t) => t.name.toLowerCase().includes(q) || t.comment.toLowerCase().includes(q),
        )
      : c.dbTables;
    if (list.length === 0) {
      return { code: 1, output: `일치하는 D1 테이블이 없습니다: ${args[1]}` };
    }
    const lines = [
      `# Cloudflare D1 테이블 (${list.length}/${c.dbTables.length}종)`,
      ...list.map(
        (t) =>
          `- ${t.name} (열 ${t.columns}${t.withoutRowid ? ', WITHOUT ROWID' : ''}): ${t.comment} (${t.file}#L${t.line})`,
      ),
    ];
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--decision') {
    const q = args.slice(1).join(' ').toLowerCase();
    const decisions = extractDecisions(root);
    const list = q
      ? decisions.filter(
          (d) =>
            d.id.toLowerCase().includes(q) ||
            d.domain.toLowerCase().includes(q) ||
            d.title.toLowerCase().includes(q) ||
            d.summary.toLowerCase().includes(q),
        )
      : decisions;
    if (list.length === 0) {
      return { code: 1, output: `일치하는 결정이 없습니다: ${q}` };
    }
    const lines = list.map(
      (d) =>
        `[${d.id}] (${d.domain} · ${d.status}) ${d.title}\n  요약: ${d.summary}\n  근거: ${d.sourceFile}#L${d.line}`,
    );
    return { code: 0, output: lines.join('\n\n') };
  }

  if (flag === '--lessons') {
    let domainFilter = '';
    let tagFilter = '';
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--tag' || args[i] === '--tags') {
        tagFilter = (args[i + 1] ?? '').toLowerCase();
        i++;
      } else if (!(args[i] ?? '').startsWith('--')) {
        domainFilter = (args[i] ?? '').toLowerCase();
      }
    }
    const lessonFiles = walkFiles(root, 'wiki/lessons', (rel) => rel.endsWith('.md'));
    const all = [];
    for (const rel of lessonFiles) {
      if (domainFilter && !rel.toLowerCase().includes(domainFilter)) continue;
      all.push(...parseLessons(readText(root, rel), rel));
    }
    const filtered = tagFilter
      ? all.filter((l) => l.tags.some((t) => t.toLowerCase().includes(tagFilter)))
      : all;
    if (filtered.length === 0) {
      return { code: 0, output: '조건에 맞는 교훈 항목이 없습니다.' };
    }
    const lines = filtered.map(
      (l) =>
        `[${l.id}] ${l.title} (${l.stage} · ${l.file}#L${l.line})\n  언제: ${l.fields['언제'] ?? ''}\n  규칙: ${l.fields['규칙'] ?? ''}\n  근거: ${l.fields['근거'] ?? ''}`,
    );
    return { code: 0, output: lines.join('\n\n') };
  }

  if (flag === '--glossary') {
    const q = args.slice(1).join(' ').toLowerCase();
    if (!exists(root, 'wiki/glossary.md')) {
      return { code: 1, output: 'wiki/glossary.md 파일이 없습니다.' };
    }
    const items = parseGlossary(readText(root, 'wiki/glossary.md'));
    const list = q
      ? items.filter(
          (g) =>
            g.term.toLowerCase().includes(q) ||
            g.category.toLowerCase().includes(q) ||
            g.definition.toLowerCase().includes(q),
        )
      : items;
    if (list.length === 0) {
      return { code: 1, output: `용어 사전에 '${q}' 항목이 없습니다.` };
    }
    const lines = list.map(
      (g) => `- ${g.term} [${g.category}]: ${g.definition} (근거: ${g.source})`,
    );
    return { code: 0, output: lines.join('\n') };
  }

  if (flag === '--grep') {
    const pattern = args.slice(1).join(' ').trim();
    if (!pattern) return { code: 1, output: '사용법: --grep <검색어>' };
    const pLower = pattern.toLowerCase();
    const targets = [
      'AGENTS.md',
      'README.md',
      'llms.txt',
      'docs/README.md',
      'docs/READ_FIRST.md',
      ...walkFiles(root, 'wiki', (rel) => rel.endsWith('.md') && !rel.startsWith('wiki/_inbox/')),
    ].filter((rel) => exists(root, rel));

    const hits = [];
    for (const rel of targets) {
      const lines = readText(root, rel).replace(/\r\n/g, '\n').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (line.toLowerCase().includes(pLower)) {
          hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
          if (hits.length >= 40) break;
        }
      }
      if (hits.length >= 40) break;
    }
    return {
      code: 0,
      output: hits.length > 0 ? hits.join('\n') : `'${pattern}' 검색 결과가 없습니다.`,
    };
  }

  return { code: 1, output: `알 수 없는 옵션: ${flag}\n\n${USAGE}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runQuery(process.argv.slice(2), REPO_ROOT);
  if (res.code !== 0) {
    console.error(res.output);
    process.exitCode = res.code;
  } else {
    console.log(res.output);
  }
}
