import {
  REPO_ROOT,
  charCount,
  estTokens,
  exists,
  readText,
  walkFiles,
} from './lib/fsutil.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';

export function measureBudget(root = REPO_ROOT) {
  const hotFiles = ['AGENTS.md', 'CLAUDE.md', 'llms.txt', 'wiki/index.md'].filter((r) =>
    exists(root, r),
  );
  const warmHubFiles = walkFiles(
    root,
    'wiki',
    (rel) =>
      rel.endsWith('.md') &&
      rel !== 'wiki/index.md' &&
      !rel.startsWith('wiki/_inbox/') &&
      !rel.startsWith('wiki/templates/'),
  );
  const coldDocs = walkFiles(
    root,
    '.',
    (rel) =>
      rel.endsWith('.md') &&
      !rel.startsWith('wiki/') &&
      !hotFiles.includes(rel),
  );

  const summarize = (rels) => {
    let chars = 0;
    let tokens = 0;
    const rows = rels.map((rel) => {
      const text = readText(root, rel);
      const c = charCount(text);
      const t = estTokens(text);
      chars += c;
      tokens += t;
      const { data } = parseFrontmatter(text);
      return { rel, type: data.type ?? '-', chars: c, tokens: t };
    });
    return { count: rels.length, chars, tokens, rows };
  };

  const hot = summarize(hotFiles);
  const warm = summarize(warmHubFiles);
  const cold = summarize(coldDocs);

  const typicalStartChars =
    (exists(root, 'AGENTS.md') ? charCount(readText(root, 'AGENTS.md')) : 0) +
    (exists(root, 'wiki/index.md') ? charCount(readText(root, 'wiki/index.md')) : 0);

  return {
    hot,
    warm,
    cold,
    typicalStartChars,
    typicalStartTokens: Math.ceil(typicalStartChars * 0.65),
    savingsPercent:
      cold.chars > 0
        ? Number(((1 - typicalStartChars / (cold.chars + hot.chars)) * 100).toFixed(2))
        : 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const b = measureBudget(REPO_ROOT);
  const lines = [
    '# LLM Wiki 컨텍스트 예산 측정 리포트',
    '',
    `- **세션 시작 진입 비용 (` + '`AGENTS.md` + `wiki/index.md`' + `)**: ${b.typicalStartChars.toLocaleString('en-US')}자 (약 ${b.typicalStartTokens.toLocaleString('en-US')} 토큰)`,
    `- **원본 전체 열람 대비 초기 탐색 토큰 절감률**: **${b.savingsPercent}%**`,
    '',
    '| 계층 | 파일 수 | 총 글자 수 | 추정 토큰 | 설명 |',
    '| --- | ---: | ---: | ---: | --- |',
    `| Hot (즉시 진입) | ${b.hot.count} | ${b.hot.chars.toLocaleString('en-US')} | ${b.hot.tokens.toLocaleString('en-US')} | AGENTS.md · CLAUDE.md · llms.txt · wiki/index.md |`,
    `| Warm (컴파일 위키) | ${b.warm.count} | ${b.warm.chars.toLocaleString('en-US')} | ${b.warm.tokens.toLocaleString('en-US')} | 도메인 허브 · 엔티티 · 교훈 · 5대 자동 레지스트리 |`,
    `| Cold (원천 문서·이력) | ${b.cold.count} | ${b.cold.chars.toLocaleString('en-US')} | ${b.cold.tokens.toLocaleString('en-US')} | PRD · 리뉴얼 · 인계 · 작업패키지 (wiki:query로 절 발췌) |`,
  ];
  console.log(lines.join('\n'));
}
