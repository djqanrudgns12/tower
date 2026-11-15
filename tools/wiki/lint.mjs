import path from 'node:path';
import {
  REPO_ROOT,
  charCount,
  exists,
  isFile,
  lineCount,
  readJson,
  readText,
  sha256File,
  toPosix,
  walkFiles,
} from './lib/fsutil.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import {
  extractHeadings,
  extractMarkdownLinks,
  isExternalTarget,
  splitLinkTarget,
} from './lib/markdown.mjs';
import {
  LESSON_ID_RE,
  REQUIRED_LESSON_FIELDS,
  parseLessons,
} from './lib/entries.mjs';
import { generateAll } from './gen.mjs';

const ALLOWED_TYPES = new Set([
  'index',
  'schema',
  'hub',
  'entity',
  'project',
  'glossary',
  'lessons',
  'registry',
  'log',
  'template',
  'delta',
]);

const ALLOWED_STATUSES = new Set(['draft', 'active', 'superseded', 'archived']);

const CHAR_BUDGETS = {
  index: 3800,
  schema: 8000,
  hub: 6500,
  entity: 4500,
  project: 6500,
  template: 3000,
};

const PRESERVED_HASHES = {
  'docs/assets/design-41-kingdom-expedition.png':
    '5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13',
  'vocabulary_td_prd_claude_v0_1.md':
    'b1277c8c3f1ffb8b495952aa9efedd8010e37cfb438c8a45fb2587ba40fb08cd',
  'vocabulary_td_prd_v0_3.md':
    '33b7522608106f6c80207e262dc729f2164c6c9a11b69a7b3f8b2f34c32fc2e8',
  'vocabulary_td_prd_v0_4.md':
    'd47d614e5cf45b86e7e6b222a1861706a0f74451b0c755cd8c1d2722a6509d14',
};

const VALIDATE_PLAN_DOCS = [
  'README.md',
  'docs/READ_FIRST.md',
  'docs/HANDOFF.md',
  'docs/style-lock-v1.md',
  'vocabulary_td_prd_v0_5.md',
  'docs/prd_v0_5_review.md',
  'docs/model_work_orders_v0_5.md',
  'docs/EXECUTION_BOARD.md',
  'docs/contracts/README.md',
];

function extractNpmRunCommands(rawMarkdown) {
  const results = [];
  const lines = rawMarkdown.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let fence = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const open = line.match(/^\s*(`{3,}|~{3,})/);
    if (!inFence && open) {
      inFence = true;
      fence = open[1] ?? '```';
      continue;
    }
    if (inFence) {
      const ch = fence[0] ?? '`';
      if (new RegExp(`^\\s*${ch}{${fence.length},}\\s*$`).test(line)) {
        inFence = false;
        fence = '';
      }
      // 코드 펜스 안의 실제 사용 예시도 검사하되 <placeholder> 형태만 제외
    }
    const re = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const cmd = m[1] ?? '';
      if (cmd && !line.slice(m.index).startsWith('npm run <')) {
        results.push({ cmd, line: i + 1 });
      }
    }
  }
  return results;
}

export function runLint(root = REPO_ROOT, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const addErr = (code, file, msg) => errors.push({ code, file, msg });
  const addWarn = (code, file, msg) =>
    (strict ? errors : warnings).push({ code, file, msg });

  const pkg = readJson(root, 'package.json');
  const validScripts = new Set(Object.keys(pkg.scripts ?? {}));

  const wikiMdFiles = walkFiles(
    root,
    'wiki',
    (rel) => rel.endsWith('.md') && !rel.startsWith('wiki/_inbox/'),
  );
  const skillMdFiles = walkFiles(root, '.agents/skills', (rel) => rel.endsWith('.md'));

  // W01 & W04 & W05: Frontmatter, Budgets, Sources
  const seenIds = new Map();
  const headingSlugCache = new Map();

  const getSlugs = (rel) => {
    if (!headingSlugCache.has(rel)) {
      const slugs = new Set(extractHeadings(readText(root, rel)).map((h) => h.slug));
      headingSlugCache.set(rel, slugs);
    }
    return headingSlugCache.get(rel);
  };

  for (const rel of wikiMdFiles) {
    const raw = readText(root, rel);
    const isTemplate = rel.startsWith('wiki/templates/');
    const { hasFrontmatter, data } = parseFrontmatter(raw);

    if (!hasFrontmatter) {
      addErr('W01', rel, 'YAML frontmatter가 없습니다.');
      continue;
    }

    if (isTemplate) continue;

    for (const req of ['id', 'type', 'title', 'status']) {
      if (!data[req]) {
        addErr('W01', rel, `필수 frontmatter 키 누락: ${req}`);
      }
    }

    if (data.id) {
      const prev = seenIds.get(data.id);
      if (prev) {
        addErr('W01', rel, `중복된 페이지 ID '${data.id}' (기존: ${prev})`);
      } else {
        seenIds.set(data.id, rel);
      }
    }

    if (data.type && !ALLOWED_TYPES.has(data.type)) {
      addErr('W01', rel, `허용되지 않는 type: '${data.type}'`);
    }

    if (data.status && !ALLOWED_STATUSES.has(data.status)) {
      addErr('W01', rel, `허용되지 않는 status: '${data.status}'`);
    }

    if (data.type === 'registry') {
      if (!data.generated_by) {
        addErr('W01', rel, 'registry 페이지는 generated_by 키가 필요합니다.');
      }
    } else if (!data.updated || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated))) {
      addErr('W01', rel, '큐레이션 페이지는 YYYY-MM-DD 형식의 updated 키가 필요합니다.');
    }

    const budget = CHAR_BUDGETS[data.type];
    if (budget) {
      const chars = charCount(raw);
      if (chars > budget) {
        addErr('W04', rel, `글자 예산 초과: ${chars}자 > 상한 ${budget}자 (type=${data.type})`);
      }
    }

    if (Array.isArray(data.sources)) {
      for (const src of data.sources) {
        const srcPath = typeof src === 'string' ? src : src?.path;
        const recordedHash = typeof src === 'object' ? src?.sha256 : null;
        if (!srcPath) continue;
        const cleanPath = String(srcPath).split('#')[0] ?? '';
        if (!isFile(root, cleanPath)) {
          addErr('W05', rel, `sources 원본 파일이 존재하지 않습니다: ${cleanPath}`);
        } else if (recordedHash) {
          const actualHash = sha256File(root, cleanPath);
          if (actualHash !== recordedHash) {
            addWarn(
              'W05',
              rel,
              `원본 '${cleanPath}' 해시가 변경되었습니다. 내용 대조 후 'npm run wiki:stamp'를 실행하세요.`,
            );
          }
        } else {
          addWarn('W05', rel, `원본 '${cleanPath}'의 sha256 스탬프가 없습니다 ('npm run wiki:stamp').`);
        }
      }
    }
  }

  // SKILL.md 예산 검사 (W04)
  for (const rel of skillMdFiles) {
    if (path.basename(rel) !== 'SKILL.md') continue;
    const raw = readText(root, rel);
    const chars = charCount(raw);
    const lines = lineCount(raw);
    if (chars > 6000 || lines > 150) {
      addErr('W04', rel, `SKILL.md 예산 초과: ${chars}자/${lines}줄 (상한 6,000자/150줄)`);
    }
  }

  // W02 & W03 & W06: 링크 실재, 앵커 실재, 고아 페이지, npm run 명령 실재
  const linkCheckRoots = [
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'llms.txt',
    'docs/README.md',
    'docs/READ_FIRST.md',
    'docs/WIKI_PRD.md',
    'docs/WIKI_PLAN.md',
    ...wikiMdFiles.filter((r) => !r.startsWith('wiki/templates/')),
    ...skillMdFiles,
  ].filter((rel) => exists(root, rel));

  const inboundToWiki = new Set();

  for (const rel of linkCheckRoots) {
    const raw = readText(root, rel);
    const links = extractMarkdownLinks(raw);
    for (const lnk of links) {
      if (isExternalTarget(lnk.target)) continue;
      const { filePart, anchor } = splitLinkTarget(lnk.target);
      const resolvedFull = filePart
        ? path.resolve(path.dirname(path.join(root, rel)), filePart)
        : path.join(root, rel);
      const targetRel = toPosix(path.relative(root, resolvedFull));

      if (targetRel.startsWith('..')) {
        // AGENTS.md 등에서 ../rollingthunder 등을 단순 텍스트가 아닌 링크로 걸지 않도록 검증
        addErr('W02', rel, `L${lnk.line}: 저장소 바깥을 가리키는 로컬 링크 '${lnk.target}'`);
        continue;
      }

      if (!exists(root, targetRel)) {
        addErr('W02', rel, `L${lnk.line}: 존재하지 않는 링크 대상 '${lnk.target}' (해석: ${targetRel})`);
        continue;
      }

      if (targetRel.startsWith('wiki/') && targetRel !== rel) {
        inboundToWiki.add(targetRel);
      }

      if (
        anchor &&
        isFile(root, targetRel) &&
        targetRel.endsWith('.md') &&
        targetRel.startsWith('wiki/')
      ) {
        const slugs = getSlugs(targetRel);
        if (!slugs.has(anchor.toLowerCase())) {
          addErr(
            'W02',
            rel,
            `L${lnk.line}: '${targetRel}' 안에 '#${anchor}' 헤딩 앵커가 없습니다.`,
          );
        }
      }
    }

    // W06: npm run <script> 검증
    if (rel.startsWith('wiki/') || rel.startsWith('.agents/') || rel === 'docs/README.md' || rel === 'llms.txt' || rel === 'README.md') {
      for (const item of extractNpmRunCommands(raw)) {
        if (!validScripts.has(item.cmd)) {
          addErr(
            'W06',
            rel,
            `L${item.line}: package.json에 없는 명령 'npm run ${item.cmd}' 참조`,
          );
        }
      }
    }
  }

  // W03: 고아 위키 페이지 검사
  for (const rel of wikiMdFiles) {
    if (rel === 'wiki/index.md' || rel.startsWith('wiki/templates/')) continue;
    const { data } = parseFrontmatter(readText(root, rel));
    if (data.status !== 'active') continue;
    if (!inboundToWiki.has(rel)) {
      addErr('W03', rel, '진입 문서나 다른 위키 페이지에서 들어오는 링크가 없는 고아 페이지입니다.');
    }
  }

  // W07: 생성 레지스트리 및 마커 블록 최신성 검사
  const genCheck = generateAll(root, { checkOnly: true });
  for (const staleRel of genCheck.changed) {
    addWarn(
      'W07',
      staleRel,
      "자동 생성 레지스트리 또는 WIKI-AUTO 마커 블록이 최신 원천과 다릅니다 ('npm run wiki:sync' 필요).",
    );
  }

  // W08: 교훈 원장 불변식 검사
  const allowedTags = new Set(
    exists(root, 'wiki/_data/tags.json') ? readJson(root, 'wiki/_data/tags.json').tags ?? [] : [],
  );
  const recordedIds = new Set(
    exists(root, 'wiki/_data/lesson-ids.json')
      ? readJson(root, 'wiki/_data/lesson-ids.json').ids ?? []
      : [],
  );
  const foundLessonIds = new Set();
  const lessonFiles = walkFiles(root, 'wiki/lessons', (r) => r.endsWith('.md'));

  for (const rel of lessonFiles) {
    const entries = parseLessons(readText(root, rel), rel);
    for (const entry of entries) {
      if (!LESSON_ID_RE.test(entry.id)) {
        addErr('W08', rel, `L${entry.line}: 잘못된 교훈 ID 형식 '${entry.id}'`);
      }
      if (foundLessonIds.has(entry.id)) {
        addErr('W08', rel, `L${entry.line}: 중복된 교훈 ID '${entry.id}'`);
      }
      foundLessonIds.add(entry.id);

      for (const reqField of REQUIRED_LESSON_FIELDS) {
        if (!entry.fields[reqField]) {
          addErr('W08', rel, `${entry.id}: 필수 필드 누락 '${reqField}'`);
        }
      }
      if (entry.chars > 750) {
        addErr('W08', rel, `${entry.id}: 교훈 단일 항목 글자 예산 초과 (${entry.chars}자 > 750자)`);
      }
      for (const tag of entry.tags) {
        if (allowedTags.size > 0 && !allowedTags.has(tag)) {
          addErr('W08', rel, `${entry.id}: 허용 어휘집(wiki/_data/tags.json)에 없는 태그 '${tag}'`);
        }
      }
    }
  }

  for (const mustExistId of recordedIds) {
    if (!foundLessonIds.has(mustExistId)) {
      addErr(
        'W08',
        'wiki/_data/lesson-ids.json',
        `발급된 영구 교훈 ID '${mustExistId}'가 원장에서 삭제되었습니다 (삭제 금지, 대체 필드 사용).`,
      );
    }
  }

  // W09: validate-plan.mjs 읽기 전용 보존 불변식 검사 (prd_v0_5_validation.json 덮어쓰기 없음)
  for (const [fileRel, expectedHash] of Object.entries(PRESERVED_HASHES)) {
    if (!isFile(root, fileRel)) {
      addErr('W09', fileRel, '보존 필수 원본 파일이 누락되었습니다.');
    } else {
      const actual = sha256File(root, fileRel);
      if (actual !== expectedHash) {
        addErr('W09', fileRel, `보존 원본 SHA-256 해시 불일치 (기대: ${expectedHash}, 실제: ${actual})`);
      }
    }
  }

  for (const entryDoc of ['README.md', 'docs/READ_FIRST.md', 'docs/HANDOFF.md']) {
    if (!exists(root, entryDoc)) {
      addErr('W09', entryDoc, '핵심 진입 문서 누락');
      continue;
    }
    if (!readText(root, entryDoc).includes('vocabulary_td_prd_v0_5.md')) {
      addErr('W09', entryDoc, "'vocabulary_td_prd_v0_5.md' 참조가 반드시 유지되어야 합니다 (validate-plan 규칙).");
    }
  }

  for (const docRel of VALIDATE_PLAN_DOCS) {
    if (!exists(root, docRel)) continue;
    const contents = readText(root, docRel);
    const fenceTicks = contents.match(/^```/gm) ?? [];
    if (fenceTicks.length % 2 !== 0) {
      addErr('W09', docRel, '닫히지 않은 ``` 코드 블록이 있습니다.');
    }
    for (const match of contents.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      const url = match[1] ?? '';
      if (/^(https?:|mailto:|#)/.test(url)) continue;
      const relative = decodeURIComponent(url.split('#')[0] ?? '');
      const target = path.resolve(path.dirname(path.join(root, docRel)), relative);
      const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
      if (!target.startsWith(rootWithSep)) {
        addErr('W09', docRel, `저장소 밖 로컬 링크: ${url}`);
      } else if (
        !exists(root, toPosix(path.relative(root, target))) &&
        toPosix(path.relative(root, target)) !== 'docs/contracts/prd_v0_5_validation.json'
      ) {
        addErr('W09', docRel, `깨진 로컬 링크: ${url}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checkedWikiPages: wikiMdFiles.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2));
  const strict = args.has('--strict');
  const quiet = args.has('--quiet');
  const res = runLint(REPO_ROOT, { strict });

  if (!quiet) {
    for (const w of res.warnings) {
      console.warn(`[warn][${w.code}] ${w.file}: ${w.msg}`);
    }
    for (const e of res.errors) {
      console.error(`[error][${e.code}] ${e.file}: ${e.msg}`);
    }
    if (res.ok) {
      console.log(
        `[wiki:lint] 통과 (위키 ${res.checkedWikiPages}개 페이지 · 오류 0 · 경고 ${res.warnings.length})`,
      );
    }
  }

  if (!res.ok) process.exitCode = 1;
}
