import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  charCount,
  estTokens,
  exists,
  lineCount,
  readJson,
  readText,
  walkFiles,
} from './fsutil.mjs';
import { extractHeadings } from './markdown.mjs';

function getTrackedFilter(root) {
  if (!exists(root, '.git')) return () => true;
  try {
    const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
    const tracked = new Set(
      out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    return (rel) =>
      tracked.has(rel) ||
      rel.startsWith('wiki/') ||
      rel.startsWith('.agents/skills/') ||
      rel.startsWith('tools/wiki/') ||
      rel === 'llms.txt' ||
      rel === 'docs/README.md' ||
      rel === 'tests/unit/wiki.test.ts' ||
      rel.startsWith('docs/WIKI_');
  } catch {
    return () => true;
  }
}

const VALIDATE_HASH_LOCKED = new Set([
  'vocabulary_td_prd_claude_v0_1.md',
  'vocabulary_td_prd_v0_3.md',
  'vocabulary_td_prd_v0_4.md',
]);

const VALIDATE_LINK_CHECKED = new Set([
  'README.md',
  'docs/READ_FIRST.md',
  'docs/HANDOFF.md',
  'docs/style-lock-v1.md',
  'vocabulary_td_prd_v0_5.md',
  'docs/prd_v0_5_review.md',
  'docs/model_work_orders_v0_5.md',
  'docs/EXECUTION_BOARD.md',
  'docs/contracts/README.md',
  'docs/renewal/catalog/towers.md',
  'docs/renewal/catalog/monsters.md',
]);

const CODE_REFERENCED_DOCS = new Set([
  'docs/DEPLOY.md',
  'docs/HOSTING_IMPL_PLAN.md',
  'docs/ui_ux_refinement_p1_v3_prd.md',
  'docs/renewal/README.md',
  'docs/renewal/progression.md',
  'docs/renewal/prd-r3-phases.md',
  'docs/renewal/prd-r4-ui-learning.md',
  'docs/renewal/prd-r5-oak-v2.md',
]);

function classifyScript(name) {
  if (name.startsWith('wiki:')) return '위키·문서';
  if (
    name === 'verify' ||
    name === 'typecheck' ||
    name === 'lint' ||
    name.startsWith('validate:')
  ) {
    return '검증·정적검사';
  }
  if (name === 'test' || name.startsWith('test:')) return '단위·통합·E2E 시험';
  if (name === 'dev' || name === 'build' || name === 'preview') return '개발·빌드';
  if (name.startsWith('server:')) return '기록·랭킹 서버(Workers/D1)';
  if (name.startsWith('simulate:')) return '밸런스 시뮬레이션';
  return '문제은행·콘텐츠 도구';
}

function detectResourceGuard(name) {
  if (name === 'build') return '`--profile build`';
  if (
    name === 'verify' ||
    name === 'test' ||
    name === 'test:e2e' ||
    name === 'test:server' ||
    name === 'test:api-connected' ||
    name === 'simulate:gate'
  ) {
    return '`--profile test`';
  }
  return '-';
}

export function extractCommands(root) {
  const pkg = readJson(root, 'package.json');
  const notes = exists(root, 'wiki/_data/command-notes.json')
    ? readJson(root, 'wiki/_data/command-notes.json')
    : {};

  const scripts = Object.entries(pkg.scripts ?? {}).map(([name, cmd]) => ({
    name,
    command: String(cmd),
    category: classifyScript(name),
    guard: detectResourceGuard(name),
    note: notes[name] ?? '',
  }));

  const toolTargets = [
    'tools/build-question-keys.mjs',
    'tools/assets/to-webp.mjs',
    'tools/assets/webp-compare.mjs',
    'tools/content/coverage-report.mjs',
    'tools/orchestrate/commit-lock.mjs',
    'tools/orchestrate/content-loop.mjs',
    'tools/qa/perf.mjs',
    'tools/qa/scenes.mjs',
  ];

  const toolClis = [];
  for (const rel of toolTargets) {
    if (!exists(root, rel)) continue;
    const text = readText(root, rel);
    const firstComment = extractTopComment(text);
    toolClis.push({
      path: rel,
      lines: lineCount(text),
      summary: firstComment || '내부 실행 도구',
    });
  }

  return { scripts, toolClis };
}

function extractTopComment(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n').slice(0, 20);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#!')) continue;
    if (line.startsWith('import ') || line.startsWith('export ') || line.startsWith('const ')) {
      break;
    }
    const cleaned = line
      .replace(/^\/\*\*?\s*/, '')
      .replace(/\*\/$/, '')
      .replace(/^\*\s?/, '')
      .replace(/^\/\/\s?/, '')
      .trim();
    if (cleaned.length >= 4) {
      const firstSentence = cleaned.split(/(?<=[.다])\s+/)[0] ?? cleaned;
      return firstSentence.slice(0, 95);
    }
  }
  return '';
}

function extractExportSymbols(sourceText, limit = 5) {
  const symbols = [];
  const seen = new Set();
  const re =
    /^export\s+(?:async\s+)?(?:function|class|const|let|type|interface|enum)\s+([A-Za-z0-9_]+)/gm;
  let m;
  while ((m = re.exec(sourceText)) !== null) {
    const sym = m[1] ?? '';
    if (sym && !seen.has(sym)) {
      seen.add(sym);
      symbols.push(sym);
      if (symbols.length >= limit) break;
    }
  }
  return symbols;
}

export function extractCodemap(root) {
  const eslintBoundaries = [];
  if (exists(root, 'eslint.config.js')) {
    const eslintText = readText(root, 'eslint.config.js');
    const ruleRe =
      /\{\s*files:\s*\[([^\]]+)\],\s*rules:\s*\{\s*'no-restricted-imports':\s*forbid\(\[([^\]]+)\]\)/g;
    let m;
    while ((m = ruleRe.exec(eslintText)) !== null) {
      const files = (m[1] ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      const forbidden = (m[2] ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      eslintBoundaries.push({ files, forbidden });
    }
  }

  const groupDefs = [
    {
      id: 'src/domain',
      dir: 'src/domain',
      role: '30Hz 고정 틱 전투·경제·징집·보물·퀴즈·시드 PRNG 순수 도메인',
    },
    {
      id: 'src/contracts',
      dir: 'src/contracts',
      role: '밸런스·맵·문제은행·초안·로비·원화 manifest Zod 런타임 계약',
    },
    {
      id: 'src/content',
      dir: 'src/content',
      role: '학년별 문제은행 지연 로더·의미 검사·철회 목록 적용',
    },
    {
      id: 'src/application',
      dir: 'src/application',
      role: 'RunController(유일한 상태 작성자)·세션·로비·NEIS·QA 장면 상태',
    },
    {
      id: 'src/persistence',
      dir: 'src/persistence',
      role: 'IndexedDB 로컬 기록·오답 노트·기기 인증·서버 동기화 큐',
    },
    {
      id: 'src/game',
      dir: 'src/game',
      role: 'Phaser 4 전장 렌더러·레이어 6종·보행/자세 애니메이션·맵 지면 조립',
    },
    {
      id: 'src/ui',
      dir: 'src/ui',
      role: 'React 19 화면(홈·새 게임·전투 HUD/카드·오답 노트·설명서·결과) 및 오디오',
    },
    {
      id: 'server/src',
      dir: 'server/src',
      role: 'Cloudflare Workers + D1 기기 발급·판 재채점·통합 랭킹·일일 정리 서버',
    },
    {
      id: 'tools/content & orchestrate',
      dirs: ['tools/content', 'tools/orchestrate'],
      role: '공개 은행 컴파일러·학년 띠 공유·CR-1000 다중 모델 공동검수 및 commit-lock',
    },
    {
      id: 'tools/sim, qa & assets',
      dirs: ['tools/sim', 'tools/qa', 'tools/assets'],
      role: '밸런스 봇 시뮬레이터·관문 평가기·성능/장면 QA·WebP 알파 보존 변환기',
    },
    {
      id: 'tests/unit & e2e',
      dirs: ['tests/unit', 'tests/e2e'],
      role: 'Vitest 단위/속성 시험 및 Playwright 실브라우저·로컬 서버 연결 시험',
    },
  ];

  const isAllowedFile = getTrackedFilter(root);
  const groups = groupDefs.map((def) => {
    const targetDirs = def.dirs ?? [def.dir];
    const allFiles = [];
    for (const d of targetDirs) {
      const found = walkFiles(
        root,
        d,
        (rel) => /\.(ts|tsx|mjs|js)$/.test(rel) && isAllowedFile(rel),
      );
      allFiles.push(...found);
    }
    let totalLines = 0;
    const keyModules = [];
    for (const rel of allFiles) {
      const content = readText(root, rel);
      const lines = lineCount(content);
      totalLines += lines;
      if (!rel.endsWith('.test.ts') && !rel.endsWith('.spec.ts')) {
        keyModules.push({
          path: rel,
          lines,
          summary: extractTopComment(content),
          exports: extractExportSymbols(content, 5),
        });
      }
    }
    keyModules.sort((a, b) => b.lines - a.lines);
    return {
      id: def.id,
      role: def.role,
      fileCount: allFiles.length,
      totalLines,
      topModules: keyModules.slice(0, 8),
    };
  });

  return { eslintBoundaries, groups };
}

export function extractContracts(root) {
  const pkg = readJson(root, 'package.json');
  const balance = readJson(root, 'docs/contracts/balance.candidate.v0.4.json');
  const mapsData = readJson(root, 'docs/contracts/maps.candidate.v0.4.json');
  const defaults = readJson(root, 'docs/contracts/product.defaults.v0.5.json');
  const qManifest = readJson(root, 'src/content/questions/manifest.json');
  const practice = readJson(root, 'src/content/questions/practice.json');
  const retractions = readJson(root, 'src/content/retractions.json');
  const assetManifest = readJson(root, 'public/assets/manifest.json');
  const webpExceptions = exists(root, 'tools/assets/webp-exceptions.json')
    ? readJson(root, 'tools/assets/webp-exceptions.json')
    : { exceptions: [] };

  const banks = (qManifest.banks ?? []).map((b) => ({
    grade: b.grade,
    bankId: b.bankId,
    bankVersion: b.bankVersion,
    ownCount: b.ownCount,
    sharedCount: b.sharedCount,
    questionCount: b.questionCount,
  }));
  const totalOwnQuestions = banks.reduce((acc, b) => acc + Number(b.ownCount ?? 0), 0);
  const totalPoolQuestions = banks.reduce((acc, b) => acc + Number(b.questionCount ?? 0), 0);
  const practiceCount = Array.isArray(practice)
    ? practice.length
    : Array.isArray(practice.questions)
      ? practice.questions.length
      : 0;
  const retractionCount = Array.isArray(retractions.entries) ? retractions.entries.length : 0;

  const difficulties = Object.entries(balance.difficulties ?? {}).map(([id, d]) => ({
    id,
    label: d.label ?? defaults.displayLabels?.difficulty?.[id] ?? id,
    gateHp: d.gateHp,
    enemyHpMultiplier: (Number(d.enemyHpBP ?? 10000) / 10000).toFixed(2),
    correctPt: d.correctPt,
    wrongPt: d.wrongPt,
    skipPt: d.skipPt,
    correctGold: d.correctGold,
    killGoldRegular: d.killGold?.regular ?? 0,
    killGoldElite: d.killGold?.elite ?? 0,
    killGoldBoss: d.killGold?.boss ?? 0,
    milestoneGold: d.milestoneSurvivalGold ?? defaults.milestone?.survivalGold?.[id] ?? 0,
  }));

  const formsObj = balance.forms ?? {};
  const towers = Object.entries(balance.towers ?? {}).map(([id, t]) => ({
    id,
    label: t.label ?? id,
    cost: t.cost,
    damageType: t.damageType,
    damage: t.damage,
    intervalMs: t.intervalMs,
    rangeCells: (Number(t.rangeMilli ?? 0) / 1000).toFixed(2).replace(/\.?0+$/, ''),
    maxTargets: t.maxTargets ?? 1,
    canHitFlyer: Boolean(t.canHitFlyer),
    formCount: Object.keys(formsObj[id] ?? {}).length,
  }));

  const enemies = Object.entries(balance.enemies ?? {}).map(([id, e]) => {
    const traits = [];
    if (e.flying || e.flyer) traits.push('비행');
    if (e.leakDamage && e.leakDamage > 1) traits.push(`성문피해 ${e.leakDamage}`);
    if (e.split?.kind) traits.push(`분열→${e.split.kind}×${e.split.count ?? 2}`);
    if (e.physicalResistBP) traits.push(`물리저항 ${(e.physicalResistBP / 100).toFixed(0)}%`);
    if (e.magicResistBP) traits.push(`마법저항 ${(e.magicResistBP / 100).toFixed(0)}%`);
    return {
      id,
      hpMultiplier: (Number(e.hpBP ?? 10000) / 10000).toFixed(2),
      speedMultiplier: (Number(e.speedBP ?? 10000) / 10000).toFixed(2),
      traits: traits.join(', ') || '기본 지상',
    };
  });

  const factionList = Array.isArray(balance.factions)
    ? balance.factions.map((f) => ({ id: f.id, label: f.label ?? f.name ?? f.id }))
    : Object.entries(balance.factions ?? {}).map(([id, f]) => ({
        id,
        label: f?.label ?? f?.name ?? id,
      }));

  const relicList = Array.isArray(balance.relics)
    ? balance.relics
    : Object.values(balance.relics ?? {});

  const maps = (mapsData.maps ?? []).map((m) => ({
    id: m.id,
    grade: m.grade,
    grid: `${m.gridWidth}×${m.gridHeight}`,
    pathLength: m.pathLength,
    baseTravelTicks: m.baseTravelTicks,
    entryCell: `(${m.entryCell.join(',')})`,
    exitCell: `(${m.exitCell.join(',')})`,
    slots: m.slots.length,
    decorations: m.decorations.length,
  }));

  const serverRoutes = [];
  if (exists(root, 'server/src/app.ts')) {
    const appLines = readText(root, 'server/src/app.ts').replace(/\r\n/g, '\n').split('\n');
    for (let i = 0; i < appLines.length; i++) {
      const line = appLines[i] ?? '';
      const m = line.match(
        /^\s*'(\/[^']+)':\s*\{\s*method:\s*'(GET|POST|PUT|DELETE|PATCH)',\s*auth:\s*(true|false),\s*handler:\s*(?:ctx\s*=>\s*)?([A-Za-z0-9_]+)/,
      );
      if (m) {
        serverRoutes.push({
          path: m[1] ?? '',
          method: m[2] ?? 'GET',
          auth: m[3] === 'true',
          handler: m[4] ?? '',
          file: 'server/src/app.ts',
          line: i + 1,
        });
      }
    }
  }

  const isAllowedFile = getTrackedFilter(root);
  const dbTables = [];
  const dbTriggers = [];
  const migrationFiles = walkFiles(
    root,
    'server/migrations',
    (rel) => rel.endsWith('.sql') && isAllowedFile(rel),
  );
  for (const migRel of migrationFiles) {
    const sqlLines = readText(root, migRel).replace(/\r\n/g, '\n').split('\n');
    for (let i = 0; i < sqlLines.length; i++) {
      const line = sqlLines[i] ?? '';
      const tMatch = line.match(/^CREATE\s+TABLE\s+([A-Za-z0-9_]+)\s*\(/i);
      if (tMatch) {
        const name = tMatch[1] ?? '';
        let comment = '';
        for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
          const prev = (sqlLines[k] ?? '').trim();
          if (prev.startsWith('--')) {
            comment = prev.replace(/^--\s*/, '').trim();
            break;
          }
          if (prev !== '') break;
        }
        let colCount = 0;
        let withoutRowid = false;
        for (let j = i + 1; j < sqlLines.length; j++) {
          const bodyLine = (sqlLines[j] ?? '').trim();
          if (bodyLine.startsWith(')')) {
            withoutRowid = /WITHOUT\s+ROWID/i.test(bodyLine);
            break;
          }
          if (
            bodyLine &&
            !bodyLine.startsWith('--') &&
            !/^(PRIMARY\s+KEY|CONSTRAINT|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(bodyLine)
          ) {
            colCount++;
          }
        }
        dbTables.push({
          name,
          columns: colCount,
          withoutRowid,
          comment,
          file: migRel,
          line: i + 1,
        });
      }
      const dropTrMatch = line.match(/^DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_]+)/i);
      if (dropTrMatch) {
        const dropName = dropTrMatch[1] ?? '';
        const prevIdx = dbTriggers.findIndex((t) => t.name === dropName);
        if (prevIdx >= 0) dbTriggers.splice(prevIdx, 1);
      }
      const trMatch = line.match(/^CREATE\s+TRIGGER\s+([A-Za-z0-9_]+)\s+(.+)$/i);
      if (trMatch) {
        dbTriggers.push({
          name: trMatch[1] ?? '',
          event: (trMatch[2] ?? '').trim(),
          file: migRel,
          line: i + 1,
        });
      }
    }
  }

  const wrangler = {
    workerName: '',
    customDomain: '',
    allowedOrigins: '',
    rankingCacheSeconds: '',
    d1DatabaseName: '',
    cron: '',
  };
  if (exists(root, 'server/wrangler.toml')) {
    const wText = readText(root, 'server/wrangler.toml');
    wrangler.workerName = wText.match(/^name\s*=\s*"([^"]+)"/m)?.[1] ?? '';
    wrangler.customDomain = wText.match(/pattern\s*=\s*"([^"]+)"/)?.[1] ?? '';
    wrangler.allowedOrigins = wText.match(/^ALLOWED_ORIGINS\s*=\s*"([^"]+)"/m)?.[1] ?? '';
    wrangler.rankingCacheSeconds =
      wText.match(/^RANKING_CACHE_SECONDS\s*=\s*"([^"]+)"/m)?.[1] ?? '';
    wrangler.d1DatabaseName = wText.match(/^database_name\s*=\s*"([^"]+)"/m)?.[1] ?? '';
    wrangler.cron = wText.match(/^crons\s*=\s*\["([^"]+)"\]/m)?.[1] ?? '';
  }

  const assetCount = assetManifest.assets ? Object.keys(assetManifest.assets).length : 0;
  const pngExceptionCount = Array.isArray(webpExceptions)
    ? webpExceptions.length
    : Array.isArray(webpExceptions.exceptions)
      ? webpExceptions.exceptions.length
      : Object.keys(webpExceptions.exceptions ?? webpExceptions.files ?? {}).length;

  return {
    appVersion: pkg.version ?? '1.0.0',
    nodeEngine: pkg.engines?.node ?? '>=24.0.0',
    balanceVersion: balance.balanceVersion ?? '1.0.0',
    rulesVersion: defaults.rulesVersion ?? '1.0.0',
    mapVersion: defaults.mapVersion ?? '0.4.0',
    styleId: defaults.styleId ?? '',
    units: balance.units ?? {},
    banks,
    totalOwnQuestions,
    totalPoolQuestions,
    practiceCount,
    retractionCount,
    difficulties,
    towers,
    enemies,
    factions: factionList,
    relicCount: relicList.length,
    draft: balance.draft ?? {},
    waves: balance.waves ?? {},
    maps,
    layout: defaults.layout ?? {},
    moods: defaults.mood?.entries ?? [],
    serverRoutes,
    dbTables,
    dbTriggers,
    wrangler,
    assetCount,
    pngExceptionCount,
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
  };
}

function locateLineInFile(root, relPath, needle) {
  if (!exists(root, relPath)) return 1;
  const lines = readText(root, relPath).replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx >= 0 ? idx + 1 : 1;
}

export function extractDecisions(root) {
  const specs = [
    {
      id: 'DEC-01',
      domain: '작업 폴더·Git',
      title: '단일 작업 폴더 운영 및 worktree 격리 폐기',
      status: '확정 (2026-11-04)',
      summary:
        '`towerdeffense` 단일 폴더에서만 작업하며 별도 worktree·복사본을 만들지 않는다. 커밋은 자기 파일만 경로를 지정해 수행한다.',
      sourceFile: 'AGENTS.md',
      needle: '## 단일 폴더',
    },
    {
      id: 'DEC-02',
      domain: '문서 우선순위',
      title: '리뉴얼 헌장(`docs/renewal/**`) 우선 적용',
      status: '확정 (2026-10-30)',
      summary:
        '타워 20종·Lv4/Lv7 진화·종족 몬스터·전투 UI 완화는 `docs/renewal/`이 PRD v0.5보다 우선한다.',
      sourceFile: 'docs/renewal/README.md',
      needle: '이 폴더가 리뉴얼의 단일 기준이다',
    },
    {
      id: 'DEC-03',
      domain: '화풍·시각',
      title: '41번 「왕국 원정대」 화풍 잠금 및 AI slop 차단',
      status: '확정 (2026-10-28)',
      summary:
        '`docs/assets/design-41-kingdom-expedition.png` 해시를 기준선으로 고정하고 32/48/64px 가독성과 알파 테두리를 검증한다.',
      sourceFile: 'docs/style-lock-v1.md',
      needle: '41',
    },
    {
      id: 'DEC-04',
      domain: '게임 규칙',
      title: '‘모르겠어요’ 0점·한국어 난이도·배속 없음·HP 성장 115%',
      status: '확정 (2026-10-28)',
      summary:
        '모르겠어요는 PT 0·골드 0, 난이도 표시는 쉬움/보통/어려움/아주 어려움, 전투 배속 없음, 웨이브 HP 성장률 115%로 고정한다.',
      sourceFile: 'vocabulary_td_prd_v0_5.md',
      needle: '모르겠어요’는 PT 0·골드 0이다',
    },
    {
      id: 'DEC-05',
      domain: '도메인 엔진',
      title: '30Hz 고정 틱 · 시드 PRNG 전용 · 이어하기 없음',
      status: '확정',
      summary:
        '`RunController`가 유일한 상태 작성자이며 `Math.random`을 금지한다. 진행 중 창을 닫으면 기록 없이 폐기하고 완주/패배만 기록한다.',
      sourceFile: 'src/application/RunController.ts',
      needle: '도메인 상태의 유일한 작성자',
    },
    {
      id: 'DEC-06',
      domain: '원화·성능',
      title: '인게임 그림 전면 WebP 전환 및 선택 맵 지연 적재',
      status: '확정 (2026-11-05)',
      summary:
        '`public/assets/**`는 `cwebp -q 85 -alpha_q 100 -m 6` WebP로 넣고 알파 경계 상자를 보존해 첫 전투 전 전송량을 약 3MB로 줄인다.',
      sourceFile: 'docs/HOSTING_IMPL_PLAN.md',
      needle: '## 2. 그림 WebP 규칙',
    },
    {
      id: 'DEC-07',
      domain: '호스팅·배포',
      title: 'GitHub Pages(회색 구름 DNS) + Cloudflare Workers/D1 분리 아키텍처',
      status: '확정 (2026-11-05)',
      summary:
        '정적 게임(`voca.ssamuniverse.com`)은 KT 학교망 우회를 막기 위해 Cloudflare 프록시 없는 GitHub Pages로, 기록·랭킹 API(`voca-api.ssamuniverse.com`)는 Workers+D1 APAC으로 운영한다.',
      sourceFile: 'docs/DEPLOY.md',
      needle: '## 1. 구조',
    },
    {
      id: 'DEC-08',
      domain: '보안·랭킹',
      title: '`workers.dev` 비활성화 · `PLAYER_SALT` 단일 비밀값 · `standings` 사전 집계',
      status: '확정 (2026-11-05)',
      summary:
        'WAF와 거점 캐시 우회를 막기 위해 사용자 지정 도메인만 허용하고, 서버 재채점(`question_regraded_combat_bounded`) 통과 판만 `standings` 집계표에 반영한다.',
      sourceFile: 'server/wrangler.toml',
      needle: 'workers_dev = false',
    },
    {
      id: 'DEC-09',
      domain: '문제은행 검수',
      title: 'CR-1000 다중 모델 블라인드 공동검수 및 `commit-lock` 원자적 반영',
      status: '확정 (2026-11-06~09)',
      summary:
        '`codex-argon-v1` 및 `claude-argon-v1` 정책으로 3~6학년 자기 학년 각 1,000문항 이상과 Normal 심화 150+ 바닥을 달성했으며, 콘텐츠 경로는 반드시 `commit-lock.mjs` 안에서만 수정한다.',
      sourceFile: 'docs/CR1000_HANDOFF.md',
      needle: '## 2026-11-09 Claude 대체 검수로 난이도 바닥 완료',
    },
    {
      id: 'DEC-10',
      domain: 'UI 보존',
      title: '사용자가 다듬은 화면·기능(통합 수호 랭킹 등) 임의 교체 금지',
      status: '확정 (2026-11-04)',
      summary:
        '기존 화면이나 기능을 통째로 걷어내는 리뉴얼·삭제는 반드시 사용자 확인 뒤에 수행한다.',
      sourceFile: 'AGENTS.md',
      needle: '## 지우기 전에 확인',
    },
  ];

  return specs.map((item) => ({
    ...item,
    line: locateLineInFile(root, item.sourceFile, item.needle),
  }));
}

function classifyDoc(rel) {
  if (
    rel === 'AGENTS.md' ||
    rel === 'CLAUDE.md' ||
    rel === 'README.md' ||
    rel === 'llms.txt' ||
    rel === 'docs/README.md' ||
    rel === 'docs/READ_FIRST.md' ||
    rel.startsWith('docs/WIKI_') ||
    rel.startsWith('wiki/') ||
    rel.startsWith('.agents/skills/')
  ) {
    return {
      group: '01. 진입·규약 및 LLM Wiki',
      diataxis: rel.startsWith('wiki/concepts/') ? 'Explanation' : 'Reference / Navigation',
      lifecycle: '현행 활성',
    };
  }
  if (rel.startsWith('docs/renewal/')) {
    return {
      group: '02. 리뉴얼 현행 기준 (PRD보다 우선)',
      diataxis: rel.includes('/catalog/') ? 'Reference' : 'Explanation / Spec',
      lifecycle: '현행 우선 기준',
    };
  }
  if (rel === 'docs/DEPLOY.md' || rel.startsWith('docs/HOSTING_')) {
    return {
      group: '03. 호스팅·배포·운영 기준',
      diataxis: rel === 'docs/DEPLOY.md' ? 'How-to' : 'Explanation / Plan',
      lifecycle: '현행 운영 기준',
    };
  }
  if (
    rel.startsWith('docs/CR1000_') ||
    rel === 'docs/CONTENT_REVIEW_PLAN.md' ||
    rel === 'docs/joint_review_protocol_v0_2.md'
  ) {
    return {
      group: '04. 문제은행 CR-1000 공동검수',
      diataxis: rel.includes('HISTORY') ? 'Archive' : 'How-to / Handoff',
      lifecycle: rel.includes('HISTORY') ? '보관 원문' : '현행 완료·유지 기준',
    };
  }
  if (
    rel === 'vocabulary_td_prd_v0_5.md' ||
    rel === 'docs/contracts/README.md' ||
    rel === 'docs/style-lock-v1.md' ||
    rel === 'docs/ui_ux_refinement_p1_v3_prd.md' ||
    rel === 'docs/prd_v0_5_review.md' ||
    rel === 'docs/model_work_orders_v0_5.md'
  ) {
    return {
      group: '05. 제작 PRD v0.5 및 계약 기준',
      diataxis: 'Reference / Spec',
      lifecycle: '현행 기본 명세',
    };
  }
  if (rel.startsWith('docs/balance/')) {
    return {
      group: '06. 밸런스 시뮬레이션 실험 기록',
      diataxis: 'Explanation / Evidence',
      lifecycle: rel === 'docs/balance/r4-final.md' ? '현행 기준선' : '실험 이력',
    };
  }
  if (
    rel.startsWith('docs/archive/') ||
    rel.startsWith('vocabulary_td_prd_') ||
    rel === 'docs/HANDOFF.md' ||
    rel === 'docs/EXECUTION_BOARD.md' ||
    /_v0_[234]/.test(rel)
  ) {
    return {
      group: '07. 구판 PRD·초기 인계·아카이브',
      diataxis: 'Archive',
      lifecycle: '보관 전용 (이동·수정 금지)',
    };
  }
  return {
    group: '08. 과거 작업 패키지 및 원화·배치 검수 이력',
    diataxis: 'Archive / Record',
    lifecycle: '이력 보존',
  };
}

function detectProtection(rel) {
  if (VALIDATE_HASH_LOCKED.has(rel)) return '해시 고정(validate-plan)';
  if (VALIDATE_LINK_CHECKED.has(rel)) return '링크·참조 검사(validate-plan)';
  if (CODE_REFERENCED_DOCS.has(rel)) return '코드·시험 경로 참조';
  return '-';
}

export function extractDocsCatalog(root) {
  const isAllowedFile = getTrackedFilter(root);
  const mdFiles = walkFiles(root, '.', (rel) => rel.endsWith('.md') && isAllowedFile(rel));
  const items = mdFiles.map((rel) => {
    const content = readText(root, rel);
    const headings = extractHeadings(content);
    const firstH1 = headings.find((h) => h.level === 1)?.text ?? path.basename(rel, '.md');
    const cls = classifyDoc(rel);
    return {
      path: rel,
      title: firstH1.slice(0, 70),
      chars: charCount(content),
      tokens: estTokens(content),
      sections: headings.length,
      group: cls.group,
      diataxis: cls.diataxis,
      lifecycle: cls.lifecycle,
      protection: detectProtection(rel),
    };
  });

  const totalChars = items.reduce((acc, x) => acc + x.chars, 0);
  const totalTokens = items.reduce((acc, x) => acc + x.tokens, 0);

  return {
    totalFiles: items.length,
    totalChars,
    totalTokens,
    items,
  };
}
