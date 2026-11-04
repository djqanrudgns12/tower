/* global window, document -- page.evaluate 안에서 도는 코드가 쓰는 브라우저 전역이다 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { domAudit, ensureServer, enterGame, flag, launch, loadSaves, baseSettings, openPage, resumeGame, runGame, seed, SIZES } from './lib.mjs';

// 화면 점검 장비(R3 P1, docs/renewal/prd-r3-phases.md §3.1). 제품 엔진으로 장면 저장본을 만들어 IndexedDB에 넣고 홈의 '이어하기'로 들어가
// 장면마다 캡처·객관 검사(가로 넘침, 44px 미만 조작 요소, 13px 미만 글자, 깨진 이미지, 오류 로그)를 남긴다. 쓰는 법:
//   node tools/qa/scenes.mjs --out <폴더> [--scenes 02,05a] [--sizes desk,cb,phone] [--port 5341] [--no-montage] [--list]
// 장면은 아래 SCENES 배열(데이터)이다. 맵 미리보기 장면은 save를 빼고 url을 주거나(`?previewMap=`), save.args.grade로 맵을 고른다.

/**
 * 장면 정의.
 *  id·slug·title   파일 이름 `<id>-<shot>-<크기>.png`과 보고에 쓴다.
 *  sizes           찍을 화면 크기(SIZES의 키). 기본은 desk(1440×900).
 *  save            { builder, args } → tools/qa/saves.ts BUILDERS[builder](args). 없으면 저장 없이 홈에서 시작한다.
 *  url             save 없이 열 주소(예: '/?previewMap=river_z'). 없으면 '/'.
 *  settings·coach  localStorage 설정·첫 판 코치 마크 덮어쓰기(기본: 연습 안내 끔, 코치 끝, 소리 끔).
 *  steps           순서대로 실행할 동작. op는 아래 STEP_OPS.
 */
export const SCENES = [
  {
    id: '01', slug: 'home-newgame', title: '홈 → 새 게임 시작', sizes: ['desk', 'cb', 'phone'], settings: { lastNickname: '', practiceSeen: false }, coach: [],
    steps: [
      { op: 'open' },
      { op: 'fill', role: 'textbox', name: '닉네임', value: '하늘바람' },
      { op: 'fill', role: 'textbox', name: '학교 이름', value: '서울참나무초등학교' },
      { op: 'shot', name: 'home-form', only: ['cb', 'phone'] },
      { op: 'scrollTop' },
      { op: 'shot', name: 'home' },
      { op: 'shot', name: 'home-full', fullPage: true, only: ['cb', 'phone'] },
      { op: 'click', role: 'button', name: '시작' },
      { op: 'wait', ms: 400 },
      { op: 'shot', name: 'newgame' },
      { op: 'click', selector: '[role="dialog"] button:has-text("시작")' },
      { op: 'wait', ms: 2500 },
      { op: 'shot', name: 'first-prep' },
    ],
  },
  { id: '02', slug: 'w1-battle', title: 'W1 전투 시작', save: { builder: 'w1-battle' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'battle' }] },
  {
    id: '03', slug: 'draft-w3', title: 'W3 뒤 징집 화면', save: { builder: 'draft-w3' },
    steps: [
      { op: 'resume' }, { op: 'shot', name: 'cards' },
      { op: 'click', role: 'button', name: /고르기/, nth: 1 }, { op: 'run', ms: 200 }, { op: 'wait', ms: 200 }, { op: 'shot', name: 'picked' },
    ],
  },
  {
    id: '04', slug: 'evolve-w7', title: '첫 진화 Lv4 A/B 고르기와 진화 직후', save: { builder: 'evolve-w7' },
    steps: [
      { op: 'resume' },
      { op: 'tapCell', x: 8, y: 2 }, { op: 'shot', name: 'tools' },
      { op: 'click', role: 'button', name: /^진화/ }, { op: 'wait', ms: 300 }, { op: 'shot', name: 'choice' },
      // 고르는 순간 빛기둥과 튀어 오름이 보인다(빛기둥은 실시간 CSS라 눌러서 바로 찍어야 잡힌다). 이어서 끝난 모습.
      { op: 'click', selector: '[data-choice]', nth: 1 }, { op: 'shot', name: 'after-a' },
      { op: 'wait', ms: 600 }, { op: 'run', ms: 300 }, { op: 'shot', name: 'after-b' },
    ],
  },
  // 상황 카드의 잘 잡는 적·약한 적 아이콘(prd-r4 §9.1, R4 B3): 덫공방(빠른 적·땅굴 / 나는 적)을 고른 모습.
  { id: '04b', slug: 'detail-counters', title: '고른 타워 상황 카드의 잘 잡는 적·약한 적', sizes: ['desk', 'cb', 'phone'], save: { builder: 'evolve-w7' }, steps: [{ op: 'resume' }, { op: 'tapCell', x: 7, y: 7 }, { op: 'wait', ms: 200 }, { op: 'shot', name: 'trap' }] },
  { id: '05', slug: 'lv7-field', title: 'Lv7 2차형 20종이 모인 전장', save: { builder: 'lv7-field' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'field' }] },
  { id: '06a', slug: 'boss-w5', title: 'W5 대장(국자대장 방어 태세)', save: { builder: 'boss-w5' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'boss5' }, { op: 'run', ms: 700 }, { op: 'shot', name: 'boss5-later' }] },
  { id: '06b', slug: 'boss-w10', title: 'W10 대장(멧돼지기수 박차 행진)', save: { builder: 'boss-w10' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'boss10' }] },
  { id: '07', slug: 'fx-heavy', title: '비행·분열 적, 장판·덫·굴림체·폭발', save: { builder: 'fx-heavy' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'fx' }] },
  { id: '08a', slug: 'tint-w9', title: 'W9 노을 색조', save: { builder: 'tint-w9' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'dusk' }] },
  { id: '08b', slug: 'tint-w17', title: 'W17 밤 색조', save: { builder: 'tint-w17' }, steps: [{ op: 'resume' }, { op: 'shot', name: 'night' }] },
  // 종족 특성(prd-r4 §7.2 E, R4 B3): 침입이 W16으로 당겨져 정원 맵은 W16~20 딱정벌레·W21~25 하늘유랑단·W31~35 가마·W36~40 두더지다.
  { id: '09a', slug: 'invasion-w23', title: 'W23 침입 종족(하늘유랑단, 하늘 떼)', save: { builder: 'invasion', args: { wave: 23 } }, steps: [{ op: 'resume' }, { op: 'shot', name: 'corsair' }] },
  { id: '09b', slug: 'invasion-w33', title: 'W33 침입 종족(가마 토기단, 흙 보호막)', save: { builder: 'invasion', args: { wave: 33 } }, steps: [{ op: 'resume' }, { op: 'shot', name: 'kiln' }] },
  { id: '09c', slug: 'invasion-w38', title: 'W38 침입 종족(두더지단, 땅굴)', save: { builder: 'invasion', args: { wave: 38 } }, steps: [{ op: 'resume' }, { op: 'shot', name: 'mole' }] },
  { id: '09d', slug: 'invasion-w18', title: 'W18 침입 종족(딱정벌레 기사단, 등껍질)', save: { builder: 'invasion', args: { wave: 18 } }, steps: [{ op: 'resume' }, { op: 'shot', name: 'beetle' }] },
  {
    id: '11', slug: 'relic-w10', title: 'W10 대장 뒤 원정 보물 고르기와 고른 뒤 상태 카드', sizes: ['desk', 'cb', 'phone'], save: { builder: 'relic-w10' },
    steps: [
      { op: 'resume' }, { op: 'wait', ms: 300 }, { op: 'shot', name: 'cards' },
      { op: 'click', selector: '[role="dialog"] [data-choice]', nth: 0 }, { op: 'run', ms: 200 }, { op: 'wait', ms: 300 }, { op: 'shot', name: 'picked' },
    ],
  },
  { id: '10a', slug: 'pause', title: '일시정지 (1366×650)', sizes: ['cb'], save: { builder: 'pause-w9' }, steps: [{ op: 'resume' }, { op: 'click', role: 'button', name: '일시정지' }, { op: 'wait', ms: 300 }, { op: 'shot', name: 'pause' }] },
  { id: '10b', slug: 'result', title: '결과 화면 (1366×650)', sizes: ['cb'], save: { builder: 'defeat-w9' }, steps: [{ op: 'resume' }, { op: 'runUntil', text: '지킨 웨이브', stepMs: 500, maxMs: 20000 }, { op: 'wait', ms: 500 }, { op: 'shot', name: 'result' }, { op: 'shot', name: 'result-full', fullPage: true }] },
  // R3 P3 맵 미리보기(개발 서버 전용 `?previewMap=<맵 id>`, src/application/mapPreview.ts). 빈 맵 = 첫 준비 화면, 타워 = 타워 8기 + 전투 150틱(적이 길 위에 있다).
  ...['river_z', 'courtyard', 'snow_step'].flatMap((map, i) => [
    { id: `2${i + 1}a`, slug: `${map}-empty`, title: `${map} 빈 맵`, sizes: map === 'river_z' ? ['desk', 'phone'] : ['desk'], url: `/?previewMap=${map}`, steps: [{ op: 'open' }, { op: 'wait', ms: 2500 }, { op: 'shot', name: 'empty' }] },
    { id: `2${i + 1}b`, slug: `${map}-towers`, title: `${map} 타워·적`, sizes: map === 'river_z' ? ['desk', 'phone'] : ['desk'], url: `/?previewMap=${map}&towers=8&ticks=150`, steps: [{ op: 'open' }, { op: 'wait', ms: 2500 }, { op: 'shot', name: 'towers' }] },
    { id: `2${i + 1}c`, slug: `${map}-night`, title: `${map} 밤(W17)`, url: `/?previewMap=${map}&towers=8&wave=17&ticks=150`, steps: [{ op: 'open' }, { op: 'wait', ms: 2500 }, { op: 'shot', name: 'night' }] },
  ]),
];

const cellCenter = async (page, x, y) => {
  const box = await page.locator('canvas').first().boundingBox();
  const cell = box.width / 15;
  return { x: box.x + (x + 0.5) * cell, y: box.y + (y + 0.5) * cell };
};

/** 장면 한 번(크기 하나)을 돌리는 동안 쓰는 상태: 페이지, 저장본 요약, 찍은 파일 목록. */
const STEP_OPS = {
  /** 홈 화면 열기(저장 없는 장면). */
  async open(c) { await c.page.waitForTimeout(1200); },
  async fill(c, s) { await c.page.getByRole(s.role, { name: s.name }).fill(s.value); },
  async click(c, s) {
    const target = s.selector ? c.page.locator(s.selector) : c.page.getByRole(s.role, s.name ? { name: s.name } : {});
    await (s.nth !== undefined ? target.nth(s.nth) : target.first()).click();
    // 가짜 시계가 멈춰 있으면 화면 프레임이 없어 입력이 처리되지 않는다. 조금 흘려 반영한다.
    if (c.clock) await runGame(c.page, 50);
  },
  async tapCell(c, s) {
    const at = await cellCenter(c.page, s.x, s.y);
    await c.page.mouse.click(at.x, at.y);
    if (c.clock) await runGame(c.page, 80);
    await c.page.waitForTimeout(200);
  },
  async wait(c, s) { await c.page.waitForTimeout(s.ms); },
  async scrollTop(c) { await c.page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; }); await c.page.waitForTimeout(150); },
  async scrollInto(c, s) { await c.page.getByRole(s.role, { name: s.name }).first().scrollIntoViewIfNeeded(); await c.page.waitForTimeout(150); },
  /** 화면에 text가 보일 때까지 게임 시간을 stepMs씩 흘린다(패배 뒤 결과 화면처럼 시간이 지나야 나오는 화면). */
  async runUntil(c, s) {
    for (let t = 0; t < s.maxMs; t += s.stepMs) {
      if (await c.page.getByText(s.text).first().isVisible().catch(() => false)) return;
      await runGame(c.page, s.stepMs);
      await c.page.waitForTimeout(80);
    }
  },
  async run(c, s) { if (c.clock) await runGame(c.page, s.ms); else await c.page.waitForTimeout(s.ms); },
  /** 정지 창의 '계속하기'를 누르고 저장본이 정한 시간(runMs)만큼 게임을 흘린다. */
  async resume(c, s) {
    await resumeGame(c.page);
    const ms = s.ms ?? c.built?.runMs ?? 0;
    if (ms > 0) await (c.clock ? runGame(c.page, ms) : c.page.waitForTimeout(ms));
    await c.page.waitForTimeout(250);
  },
  async shot(c, s) {
    if (s.only && !s.only.includes(c.size.name)) return;
    const file = `${c.scene.id}-${s.name}-${c.size.name}.png`;
    await c.page.screenshot({ path: path.join(c.out, file), ...(s.fullPage ? { fullPage: true } : {}) });
    c.shots.push({ file, shot: s.name, audit: await domAudit(c.page) });
    console.log(`  ${file}`);
  },
};

async function runScene(browser, saves, ctx, scene, size) {
  const clock = Boolean(scene.save);
  const built = scene.save ? saves.buildScene(scene.save.builder, scene.save.args ?? {}) : null;
  const { context, page, issues } = await openPage(browser, { base: ctx.base, size, clock });
  const settings = baseSettings(scene.settings);
  const state = { page, scene, size, out: ctx.out, clock, built, shots: [] };
  try {
    await seed(page, ctx.base, { state: built?.state ?? null, settings, ...(scene.coach ? { coach: scene.coach } : {}) });
    if (scene.url) await page.goto(`${ctx.base}${scene.url}`);
    if (built) await enterGame(page, { clock });
    for (const step of scene.steps) await STEP_OPS[step.op](state, step);
  } catch (error) {
    console.log(`  실패: ${scene.id} ${size.name}: ${String(error).split('\n')[0]}`);
    state.error = String(error).split('\n').slice(0, 3).join(' ');
    try { await page.screenshot({ path: path.join(ctx.out, `${scene.id}-ERROR-${size.name}.png`) }); } catch { /* 화면이 없으면 건너뛴다 */ }
  }
  await context.close();
  return { scene: scene.id, slug: scene.slug, title: scene.title, size: size.name, note: built?.note ?? null, error: state.error ?? null, shots: state.shots, issues };
}

// ── 몽타주: 캡처를 4장씩 50% 크기로 한 장에 묶는다(별도 이미지 도구 없이 Playwright로 그린다). ──
const pngSize = async file => { const b = await readFile(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };

export async function makeMontages(browser, out) {
  const files = (await readdir(out)).filter(f => /^\d\d[a-z]?-.+-(desk|cb|phone)\.png$/.test(f) && !f.includes('-ERROR-')).sort();
  const pages = [];
  for (let i = 0; i < files.length; i += 4) pages.push(files.slice(i, i + 4));
  const names = [];
  for (const [n, group] of pages.entries()) {
    const cells = await Promise.all(group.map(async f => {
      const { width, height } = await pngSize(path.join(out, f));
      return `<figure><img src="file://${path.join(out, f)}" style="width:${Math.round(width / 2)}px;height:${Math.round(height / 2)}px;max-width:100%;max-height:100%;object-fit:contain"><figcaption>${f.replace('.png', '')}</figcaption></figure>`;
    }));
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;width:1440px;height:900px;display:grid;grid-template:450px 450px/720px 720px;background:#222;font:12px sans-serif}figure{margin:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;outline:1px solid #555;outline-offset:-1px}figcaption{position:absolute;left:4px;top:4px;background:#000c;color:#fff;padding:2px 6px;border-radius:3px}</style>${cells.join('')}`;
    const htmlFile = path.join(out, '_montage.html');
    await writeFile(htmlFile, html);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`file://${htmlFile}`);
    await page.waitForLoadState('load');
    const name = `montage-${String(n + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(out, name) });
    await page.close();
    names.push(name);
  }
  return names;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) { for (const s of SCENES) console.log(`${s.id}\t${s.slug}\t${(s.sizes ?? ['desk']).join(',')}\t${s.title}`); return; }
  const out = flag(args, 'out', null);
  if (!out) throw new Error('--out <폴더>가 필요하다');
  await mkdir(out, { recursive: true });
  const only = flag(args, 'scenes', '')?.split(',').filter(Boolean) ?? [];
  const sizeFilter = flag(args, 'sizes', '')?.split(',').filter(Boolean) ?? [];
  const server = await ensureServer(Number(flag(args, 'port', process.env.E2E_PORT ?? 5341)));
  const browser = await launch();
  try {
    if (!args.includes('--montage-only')) {
      const saves = await loadSaves();
      const picked = SCENES.filter(s => only.length === 0 || only.some(o => s.id === o || s.id.startsWith(o)));
      const report = [];
      for (const scene of picked) {
        for (const key of args.includes('--all-sizes') && sizeFilter.length ? sizeFilter : (scene.sizes ?? ['desk'])) {
          if (sizeFilter.length && !sizeFilter.includes(key)) continue;
          console.log(`${scene.id} ${scene.title} [${key}]`);
          report.push(await runScene(browser, saves, { base: server.base, out }, scene, SIZES[key]));
        }
      }
      const reportFile = path.join(out, 'report.json');
      let merged = report;
      if (only.length) {
        // 일부 장면만 다시 돌렸으면 이전 보고에서 그 장면을 바꿔 끼운다.
        try {
          const prev = JSON.parse(await readFile(reportFile, 'utf8'));
          const key = r => `${r.scene}/${r.size}`;
          const fresh = new Map(report.map(r => [key(r), r]));
          merged = [...prev.filter(r => !fresh.has(key(r))), ...report].sort((a, b) => key(a).localeCompare(key(b)));
        } catch { /* 이전 보고가 없다 */ }
      }
      await writeFile(reportFile, JSON.stringify(merged, null, 2));
    }
    if (!args.includes('--no-montage')) console.log('몽타주:', (await makeMontages(browser, out)).join(' '));
  } finally {
    await browser.close();
    await server.stop();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
