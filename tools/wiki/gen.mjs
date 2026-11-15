import {
  REPO_ROOT,
  exists,
  readText,
  writeTextIfChanged,
} from './lib/fsutil.mjs';
import { stringifyFrontmatter } from './lib/frontmatter.mjs';
import { replaceAutoBlocks } from './lib/markdown.mjs';
import {
  extractCodemap,
  extractCommands,
  extractContracts,
  extractDecisions,
  extractDocsCatalog,
} from './lib/extractors.mjs';

const GENERATED_NOTICE =
  '> 이 파일은 `npm run wiki:sync` (`tools/wiki/gen.mjs`)가 코드·계약 JSON·SQL에서 결정적으로 자동 생성합니다. 직접 수정하지 마세요.';

function renderCommandsRegistry(cmdData) {
  const lines = [
    '# 명령 사전 (`commands`)',
    '',
    GENERATED_NOTICE,
    '',
    '## 1. 루트 `npm run` 스크립트',
    '',
    '| 명령 | 분류 | `resource-guard` | 실행 본문 | 비고 |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const s of cmdData.scripts) {
    const escapedCmd = s.command.replace(/\|/g, '\\|');
    lines.push(
      `| \`npm run ${s.name}\` | ${s.category} | ${s.guard} | \`${escapedCmd}\` | ${s.note || '-'} |`,
    );
  }

  lines.push(
    '',
    '## 2. `tools/` 주요 독립 CLI 스크립트',
    '',
    '| 경로 | 줄 수 | 역할 요약 |',
    '| --- | ---: | --- |',
  );

  for (const t of cmdData.toolClis) {
    lines.push(`| [${t.path}](../${t.path}) | ${t.lines} | ${t.summary.replace(/\|/g, '\\|')} |`);
  }

  return stringifyFrontmatter(
    {
      id: 'wiki-commands',
      type: 'registry',
      title: '명령 사전',
      status: 'active',
      generated_by: 'tools/wiki/gen.mjs',
    },
    lines.join('\n'),
  );
}

function renderCodemapRegistry(codeData) {
  const lines = [
    '# 모듈 코드맵 (`codemap`)',
    '',
    GENERATED_NOTICE,
    '',
    '## 1. ESLint 강제 계층 경계 (`eslint.config.js`)',
    '',
    '| 대상 경로 | 가져올 수 없는 대상 (`no-restricted-imports`) |',
    '| --- | --- |',
  ];

  for (const b of codeData.eslintBoundaries) {
    const src = b.files.map((f) => `\`${f}\``).join(', ');
    const deny = b.forbidden.map((f) => `\`${f}\``).join(', ');
    lines.push(`| ${src} | ${deny} |`);
  }

  lines.push(
    '',
    '## 2. 영역별 규모 요약',
    '',
    '| 영역 | 파일 수 | 총 줄 수 | 책임 |',
    '| --- | ---: | ---: | --- |',
  );

  for (const g of codeData.groups) {
    lines.push(`| \`${g.id}\` | ${g.fileCount} | ${g.totalLines.toLocaleString('en-US')} | ${g.role} |`);
  }

  lines.push('', '## 3. 영역별 대표 진입 모듈');
  for (const g of codeData.groups) {
    if (g.topModules.length === 0) continue;
    lines.push(
      '',
      `### ${g.id}`,
      '',
      '| 파일 | 줄 수 | 주요 `export` | 상단 설명 |',
      '| --- | ---: | --- | --- |',
    );
    for (const m of g.topModules) {
      const exps = m.exports.length ? m.exports.map((e) => `\`${e}\``).join(', ') : '-';
      const desc = (m.summary || '-').replace(/\|/g, '\\|');
      lines.push(`| [${m.path}](../${m.path}) | ${m.lines} | ${exps} | ${desc} |`);
    }
  }

  return stringifyFrontmatter(
    {
      id: 'wiki-codemap',
      type: 'registry',
      title: '모듈 코드맵',
      status: 'active',
      generated_by: 'tools/wiki/gen.mjs',
    },
    lines.join('\n'),
  );
}

function renderContractsRegistry(c) {
  const lines = [
    '# 살아있는 코드·데이터 계약 (`contracts`)',
    '',
    GENERATED_NOTICE,
    '',
    '## 1. 버전 및 에셋 개요',
    '',
    '| 항목 | 값 | 원본 |',
    '| --- | --- | --- |',
    `| 앱·규칙·밸런스 버전 | \`${c.appVersion}\` / \`${c.rulesVersion}\` / \`${c.balanceVersion}\` | [package.json](../package.json), [balance.candidate.v0.4.json](../docs/contracts/balance.candidate.v0.4.json) |`,
    `| 맵 버전 / 화풍 ID | \`${c.mapVersion}\` / \`${c.styleId}\` | [product.defaults.v0.5.json](../docs/contracts/product.defaults.v0.5.json) |`,
    `| 고정 틱 / 단위 체계 | \`${c.units.tickHz ?? 30}Hz\`, \`10000 BP = 1.0\`, \`1000 milli = 1\` | [balance.candidate.v0.4.json](../docs/contracts/balance.candidate.v0.4.json) |`,
    `| 등록 원화 에셋 / PNG 예외 | WebP \`${c.assetCount}\`장 / PNG 예외 \`${c.pngExceptionCount}\`건 | [public/assets/manifest.json](../public/assets/manifest.json) |`,
    '',
    '## 2. 공개 문제은행 현황 (`src/content/questions/manifest.json`)',
    '',
    '| 학년 | 은행 ID | 은행 판 (`bankVersion`) | 자기 학년 문항 | 공유 유입 문항 | 총 출제 풀 |',
    '| ---: | --- | --- | ---: | ---: | ---: |',
  ];

  for (const b of c.banks) {
    lines.push(
      `| ${b.grade}학년 | \`${b.bankId}\` | \`${b.bankVersion}\` | ${b.ownCount.toLocaleString('en-US')} | ${b.sharedCount.toLocaleString('en-US')} | **${b.questionCount.toLocaleString('en-US')}** |`,
    );
  }
  lines.push(
    `| **합계** | - | 연습 \`${c.practiceCount}\`문항 · 철회 \`${c.retractionCount}\`건 | **${c.totalOwnQuestions.toLocaleString('en-US')}** | ${(c.totalPoolQuestions - c.totalOwnQuestions).toLocaleString('en-US')} | **${c.totalPoolQuestions.toLocaleString('en-US')}** |`,
  );

  lines.push(
    '',
    '## 3. 난이도 4단계 수치 (`balance.candidate.v0.4.json`)',
    '',
    '| ID | 표시 | 성문 HP | 적 HP 배율 | 정답 PT | 오답 PT | 모르겠어요 PT | 정답 골드 | 처치 골드(일반/정예/보스) | 고비 골드 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const d of c.difficulties) {
    lines.push(
      `| \`${d.id}\` | ${d.label} | ${d.gateHp} | ×${d.enemyHpMultiplier} | +${d.correctPt} | ${d.wrongPt} | ${d.skipPt} | ${d.correctGold}G | ${d.killGoldRegular}/${d.killGoldElite}/${d.killGoldBoss}G | ${d.milestoneGold}G |`,
    );
  }

  lines.push(
    '',
    '## 4. 학년별 맵 4종 (`maps.candidate.v0.4.json`)',
    '',
    '| 맵 ID | 학년 | 격자 | 경로 길이 | 기본 이동 틱 | 입구 → 출구 | 설치 슬롯 | 장식 수 |',
    '| --- | ---: | --- | ---: | ---: | --- | ---: | ---: |',
  );
  for (const m of c.maps) {
    lines.push(
      `| \`${m.id}\` | ${m.grade}학년 | ${m.grid} | ${m.pathLength}칸 | ${m.baseTravelTicks}틱 | \`${m.entryCell}\` → \`${m.exitCell}\` | ${m.slots}칸 | ${m.decorations}개 |`,
    );
  }

  lines.push(
    '',
    `## 5. 타워 ${c.towers.length}종 기본 스펙 (\`balance.candidate.v0.4.json\`)`,
    '',
    `- 판 안 징집(\`draft\`): 시작 기본 \`${(c.draft.startTowers ?? []).length}\`종(\`${(c.draft.startTowers ?? []).join(', ')}\`), 웨이브 \`${(c.draft.afterWaves ?? []).join('·')}\` 직후 \`${c.draft.offerCount ?? 3}\`종 중 택1, 장착함 최대 \`${c.draft.maxOwned ?? 8}\`칸 · 원정 보물 \`${c.relicCount}\`종.`,
    '',
    '| 타워 ID | 이름 | 비용 | 속성 | 기본 피해 | 공격 간격 | 사거리(칸) | 동시 표적 | 대공 | 진화 형태 수 |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | :---: | ---: |',
  );
  for (const t of c.towers) {
    lines.push(
      `| \`${t.id}\` | ${t.label} | ${t.cost}G | ${t.damageType === 'magic' ? '마법' : '물리'} | ${t.damage} | ${t.intervalMs}ms | ${t.rangeCells} | ${t.maxTargets} | ${t.canHitFlyer ? 'O' : 'X'} | ${t.formCount} |`,
    );
  }

  lines.push(
    '',
    `## 6. 적 역할 ${c.enemies.length}종 및 종족 ${c.factions.length}종`,
    '',
    `- 등록 종족(\`factions\`): ${c.factions.map((f) => `\`${f.id}\`(${f.label})`).join(', ')}`,
    '',
    '| 역할 ID | HP 배율 | 이동속도 배율 | 특성·저항 |',
    '| --- | ---: | ---: | --- |',
  );
  for (const e of c.enemies) {
    lines.push(`| \`${e.id}\` | ×${e.hpMultiplier} | ×${e.speedMultiplier} | ${e.traits} |`);
  }

  lines.push(
    '',
    '## 7. 기록·랭킹 서버 API 및 Cloudflare D1 스키마 (`server/`)',
    '',
    `- Worker: \`${c.wrangler.workerName}\` · 도메인: \`https://${c.wrangler.customDomain}\` · 허용 출처: \`${c.wrangler.allowedOrigins}\` · 랭킹 캐시: \`${c.wrangler.rankingCacheSeconds}초\` · D1: \`${c.wrangler.d1DatabaseName}\` · 정리 Cron: \`${c.wrangler.cron}\``,
    '',
    '### 7.1 HTTP 엔드포인트 (`server/src/app.ts`)',
    '',
    '| 메서드 | 경로 | 기기 토큰 인증 | 핸들러 | 위치 |',
    '| --- | --- | :---: | --- | --- |',
  );
  for (const r of c.serverRoutes) {
    lines.push(
      `| \`${r.method}\` | \`${r.path}\` | ${r.auth ? '필수(`Bearer`)' : '불필요'} | \`${r.handler}\` | [${r.file}#L${r.line}](../${r.file}#L${r.line}) |`,
    );
  }

  lines.push(
    '',
    '### 7.2 D1 SQLite 테이블 (`server/migrations/0001_init.sql`)',
    '',
    '| 테이블명 | 열 수 | `WITHOUT ROWID` | 역할 요약 | 위치 |',
    '| --- | ---: | :---: | --- | --- |',
  );
  for (const t of c.dbTables) {
    lines.push(
      `| \`${t.name}\` | ${t.columns} | ${t.withoutRowid ? 'O' : '-'} | ${(t.comment || '-').replace(/\|/g, '\\|')} | [${t.file}#L${t.line}](../${t.file}#L${t.line}) |`,
    );
  }

  if (c.dbTriggers.length > 0) {
    lines.push(
      '',
      '### 7.3 SQLite 트리거',
      '',
      '| 트리거명 | 조건 | 위치 |',
      '| --- | --- | --- |',
    );
    for (const tr of c.dbTriggers) {
      lines.push(
        `| \`${tr.name}\` | \`${tr.event}\` | [${tr.file}#L${tr.line}](../${tr.file}#L${tr.line}) |`,
      );
    }
  }

  return stringifyFrontmatter(
    {
      id: 'wiki-contracts',
      type: 'registry',
      title: '살아있는 코드·데이터 계약',
      status: 'active',
      generated_by: 'tools/wiki/gen.mjs',
    },
    lines.join('\n'),
  );
}

function renderDecisionsRegistry(decisions) {
  const lines = [
    '# 핵심 의사결정 색인 (`decisions-index`)',
    '',
    GENERATED_NOTICE,
    '',
    '> 이 저장소는 단일 ADR 파일 대신 `AGENTS.md`, `docs/renewal/README.md`, `docs/style-lock-v1.md`, `docs/DEPLOY.md`, `docs/CR1000_HANDOFF.md`에 도메인별 확정 결정이 분산되어 있습니다. 아래 색인이 각 원본의 정확한 줄 번호를 자동 추적합니다.',
    '',
    '| ID | 영역 | 상태 | 결정 제목 | 핵심 규칙 요약 | 근거 위치 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const d of decisions) {
    lines.push(
      `| \`${d.id}\` | ${d.domain} | ${d.status} | **${d.title}** | ${d.summary.replace(/\|/g, '\\|')} | [${d.sourceFile}#L${d.line}](../${d.sourceFile}#L${d.line}) |`,
    );
  }

  return stringifyFrontmatter(
    {
      id: 'wiki-decisions-index',
      type: 'registry',
      title: '핵심 의사결정 색인',
      status: 'active',
      generated_by: 'tools/wiki/gen.mjs',
    },
    lines.join('\n'),
  );
}

function renderDocsCatalogRegistry(catalog) {
  const byGroup = new Map();
  for (const item of catalog.items) {
    const arr = byGroup.get(item.group) ?? [];
    arr.push(item);
    byGroup.set(item.group, arr);
  }

  const groups = [...byGroup.keys()].sort();
  const lines = [
    '# 전체 문서 카탈로그 (`docs-catalog`)',
    '',
    GENERATED_NOTICE,
    '',
    `- 스캔된 마크다운 총계: **${catalog.totalFiles}개 파일** · **${catalog.totalChars.toLocaleString('en-US')}자** · 추정 **약 ${catalog.totalTokens.toLocaleString('en-US')} 토큰**`,
    '- **경고**: `해시 고정(validate-plan)` 문서는 1바이트도 수정·이동하면 안 되며, `링크·참조 검사(validate-plan)` 및 `코드·시험 경로 참조` 문서도 기존 경로를 그대로 유지해야 합니다.',
    '',
    '## 분류별 요약',
    '',
    '| 분류 | 파일 수 | 글자 수 | 추정 토큰 |',
    '| --- | ---: | ---: | ---: |',
  ];

  for (const g of groups) {
    const list = byGroup.get(g) ?? [];
    const chars = list.reduce((a, x) => a + x.chars, 0);
    const tokens = list.reduce((a, x) => a + x.tokens, 0);
    lines.push(
      `| ${g} | ${list.length} | ${chars.toLocaleString('en-US')} | ${tokens.toLocaleString('en-US')} |`,
    );
  }

  for (const g of groups) {
    const list = byGroup.get(g) ?? [];
    lines.push(
      '',
      `## ${g}`,
      '',
      '| 경로 | 생애주기 | Diataxis | 보호 잠금 | 절 수 | 글자 수 |',
      '| --- | --- | --- | --- | ---: | ---: |',
    );
    for (const item of list) {
      lines.push(
        `| [${item.path}](../${item.path}) | ${item.lifecycle} | ${item.diataxis} | ${item.protection} | ${item.sections} | ${item.chars.toLocaleString('en-US')} |`,
      );
    }
  }

  return stringifyFrontmatter(
    {
      id: 'wiki-docs-catalog',
      type: 'registry',
      title: '전체 문서 카탈로그',
      status: 'active',
      generated_by: 'tools/wiki/gen.mjs',
    },
    lines.join('\n'),
  );
}

export function buildAutoBlocks(extracted) {
  const { contracts: c, catalog, decisions, commands } = extracted;

  const repoStatsLines = [
    `- **제품·밸런스 판**: \`v${c.appVersion}\` (30Hz 고정 틱 · 화풍 \`${c.styleId}\` · WebP 원화 \`${c.assetCount}\`장)`,
    `- **게임 규모**: 학년별 맵 \`${c.maps.length}\`종(3~6학년, 15×9 격자·슬롯 20칸) · 타워 \`${c.towers.length}\`종(Lv4/Lv7 3단 진화) · 적 역할 \`${c.enemies.length}\`종 × 종족 \`${c.factions.length}\`종 · 원정 보물 \`${c.relicCount}\`종`,
    `- **공개 문제은행**: 3~6학년 자기 학년 승인 **${c.totalOwnQuestions.toLocaleString('en-US')}문항** · 공유 포함 총 출제 풀 **${c.totalPoolQuestions.toLocaleString('en-US')}문항** (3학년 ${c.banks.find((b) => b.grade === 3)?.questionCount ?? 0} · 4학년 ${c.banks.find((b) => b.grade === 4)?.questionCount ?? 0} · 5학년 ${c.banks.find((b) => b.grade === 5)?.questionCount ?? 0} · 6학년 ${c.banks.find((b) => b.grade === 6)?.questionCount ?? 0})`,
    `- **서버·인프라**: 정적 게임 \`https://voca.ssamuniverse.com\` (GitHub Pages) · 기록/랭킹 API \`https://${c.wrangler.customDomain}\` (Cloudflare Workers 라우트 \`${c.serverRoutes.length}\`종 + D1 테이블 \`${c.dbTables.length}\`종)`,
    `- **지식 베이스**: 전체 마크다운 \`${catalog.totalFiles}\`개 · 핵심 의사결정 \`${decisions.length}\`건 · 루트 npm 명령 \`${commands.scripts.length}\`개`,
  ].join('\n');

  const byGroup = new Map();
  for (const item of catalog.items) {
    const arr = byGroup.get(item.group) ?? [];
    arr.push(item);
    byGroup.set(item.group, arr);
  }
  const docsOverviewLines = [
    '| 분류 | 파일 수 | 총 글자 수 | 추정 토큰 |',
    '| --- | ---: | ---: | ---: |',
    ...[...byGroup.keys()].sort().map((g) => {
      const list = byGroup.get(g) ?? [];
      const chars = list.reduce((a, x) => a + x.chars, 0);
      const tokens = list.reduce((a, x) => a + x.tokens, 0);
      return `| ${g} | ${list.length} | ${chars.toLocaleString('en-US')} | ${tokens.toLocaleString('en-US')} |`;
    }),
    `| **전체 합계** | **${catalog.totalFiles}** | **${catalog.totalChars.toLocaleString('en-US')}** | **${catalog.totalTokens.toLocaleString('en-US')}** |`,
  ].join('\n');

  const depEntries = [
    ['node (engines)', c.nodeEngine, '런타임'],
    ...Object.entries(c.dependencies).map(([k, v]) => [k, String(v), '앱 의존성']),
    ...Object.entries(c.devDependencies).map(([k, v]) => [k, String(v), '개발·시험 도구']),
  ];
  const techStackLines = [
    '| 패키지 / 런타임 | 고정 버전 | 구분 |',
    '| --- | --- | --- |',
    ...depEntries.map(([name, ver, kind]) => `| \`${name}\` | \`${ver}\` | ${kind} |`),
  ].join('\n');

  return {
    'repo-stats': repoStatsLines,
    'docs-overview': docsOverviewLines,
    'tech-stack-versions': techStackLines,
  };
}

export const REGISTRY_FILES = [
  'wiki/commands.md',
  'wiki/codemap.md',
  'wiki/contracts.md',
  'wiki/decisions-index.md',
  'wiki/docs-catalog.md',
];

export const MARKER_TARGET_FILES = [
  'README.md',
  'llms.txt',
  'docs/README.md',
  'wiki/index.md',
  'wiki/entities/tech-stack.md',
];

export function computeGeneratedArtifacts(root = REPO_ROOT) {
  const commands = extractCommands(root);
  const codemap = extractCodemap(root);
  const contracts = extractContracts(root);
  const decisions = extractDecisions(root);

  const prelimCatalog = extractDocsCatalog(root);
  const prelimBlocks = buildAutoBlocks({
    commands,
    codemap,
    contracts,
    decisions,
    catalog: prelimCatalog,
  });

  const files = new Map();
  files.set('wiki/commands.md', renderCommandsRegistry(commands));
  files.set('wiki/codemap.md', renderCodemapRegistry(codemap));
  files.set('wiki/contracts.md', renderContractsRegistry(contracts));
  files.set('wiki/decisions-index.md', renderDecisionsRegistry(decisions));
  files.set('wiki/docs-catalog.md', renderDocsCatalogRegistry(prelimCatalog));

  for (const rel of MARKER_TARGET_FILES) {
    if (!exists(root, rel)) continue;
    const raw = readText(root, rel);
    const { content } = replaceAutoBlocks(raw, prelimBlocks);
    files.set(rel, content.endsWith('\n') ? content : `${content}\n`);
  }

  return {
    extracted: { commands, codemap, contracts, decisions, catalog: prelimCatalog },
    files,
  };
}

export function generateAll(root = REPO_ROOT, { checkOnly = false, skipRelSet = null } = {}) {
  let pass1 = computeGeneratedArtifacts(root);
  const changed = [];
  const skipped = [];

  if (checkOnly) {
    for (const [rel, expected] of pass1.files.entries()) {
      if (skipRelSet?.has(rel)) continue;
      if (!exists(root, rel)) {
        changed.push(rel);
        continue;
      }
      const actual = readText(root, rel);
      const normActual = actual.endsWith('\n') ? actual : `${actual}\n`;
      if (normActual !== expected) changed.push(rel);
    }
    return { changed, skipped };
  }

  const touchedSet = new Set();
  for (const [rel, content] of pass1.files.entries()) {
    if (skipRelSet?.has(rel)) {
      skipped.push(rel);
      continue;
    }
    if (writeTextIfChanged(root, rel, content)) {
      touchedSet.add(rel);
    }
  }

  // docs-catalog.md와 마커 블록의 전체 파일/글자 수 합계가 자릿수 경계에서도 완전 수렴하도록 고정점 루프 수행
  for (let round = 0; round < 3; round++) {
    pass1 = computeGeneratedArtifacts(root);
    let roundChanged = false;
    for (const [rel, content] of pass1.files.entries()) {
      if (skipRelSet?.has(rel)) continue;
      if (writeTextIfChanged(root, rel, content)) {
        touchedSet.add(rel);
        roundChanged = true;
      }
    }
    if (!roundChanged) break;
  }

  return { changed: [...touchedSet].sort(), skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const checkOnly = process.argv.includes('--check');
  const res = generateAll(REPO_ROOT, { checkOnly });
  if (checkOnly) {
    if (res.changed.length > 0) {
      console.error(`[wiki:gen] 최신화 필요 파일 ${res.changed.length}개:\n  - ${res.changed.join('\n  - ')}`);
      process.exitCode = 1;
    } else {
      console.log('[wiki:gen] 모든 레지스트리와 WIKI-AUTO 블록이 최신 상태입니다.');
    }
  } else {
    console.log(
      `[wiki:gen] 완료 (갱신 ${res.changed.length}개${res.changed.length ? `: ${res.changed.join(', ')}` : ''})`,
    );
  }
}
