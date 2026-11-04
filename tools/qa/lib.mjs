/* global window, document, getComputedStyle -- page.evaluate 안에서 도는 코드가 쓰는 브라우저 전역이다 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { build, loadConfigFromFile, mergeConfig, preview, runnerImport } from 'vite';

// 화면 점검 공용 도구(tools/qa/scenes.mjs·perf.mjs가 쓴다): 개발 서버, 장면 상태 주입(개발 전용 `?qaRun=1` 로더), 게임 시간 시계, 객관 검사.
export const ROOT = path.resolve(import.meta.dirname, '../..');

/** 화면 크기. 1440×900이 기본이고 크롬북·휴대폰은 표가 정한 장면만 쓴다. */
export const SIZES = {
  desk: { name: 'desk', width: 1440, height: 900 },
  cb: { name: 'cb', width: 1366, height: 650 },
  phone: { name: 'phone', width: 390, height: 844 },
};

export const NICKNAME = '하늘바람';

export const flag = (args, name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
};

/** 같은 주소에 이미 서버가 있으면 쓰고, 없으면 vite를 띄운다. 끝낼 때 stop()으로 우리가 띄운 것만 끈다. */
export async function ensureServer(port) {
  const base = `http://localhost:${port}`;
  const up = () => fetch(base).then(r => r.ok, () => false);
  if (await up()) return { base, stop: async () => undefined, started: false };
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    if (await up()) break;
    await new Promise(r => setTimeout(r, 250));
  }
  if (!(await up())) { child.kill(); throw new Error(`개발 서버가 ${base}에서 뜨지 않았다`); }
  return { base, started: true, stop: async () => { child.kill('SIGTERM'); } };
}

/**
 * 운영 빌드를 outDir에 만들어 vite preview로 띄운다(개발 서버는 React 개발판이라 실제 기기보다 훨씬 느리다).
 * 장면 상태로 들어가야 하므로 이 측정용 빌드에서만 개발 진입 분기(`import.meta.env.DEV`: QA 장면 로더·맵 미리보기)를 켠다.
 * React·번들은 운영판 그대로라 성능 측정에는 영향이 없고, 배포 빌드(npm run build)에는 이 분기가 없다.
 * ambientOff면 분위기 층(AmbientLayer)을 아무것도 안 하는 대역으로 바꿔 빌드한다. 제품 소스는 건드리지 않는다.
 */
export async function buildAndServe({ outDir, port, ambientOff = false }) {
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(ROOT, 'vite.config.ts'), ROOT);
  const stub = { name: 'qa-ambient-off', enforce: 'pre', resolveId(id) { return /layers\/AmbientLayer$/.test(id) ? '\0qa-ambient-off' : null; }, load(id) { return id === '\0qa-ambient-off' ? 'export class AmbientLayer { constructor() {} update() {} }' : null; } };
  await build(mergeConfig(loaded.config, { configFile: false, root: ROOT, logLevel: 'error', define: { 'import.meta.env.DEV': 'true' }, build: { outDir, emptyOutDir: true }, plugins: ambientOff ? [stub] : [] }));
  const server = await preview({ configFile: false, root: ROOT, logLevel: 'error', preview: { port, strictPort: true }, build: { outDir } });
  return { base: `http://localhost:${port}`, stop: async () => { await new Promise(resolve => server.httpServer.close(() => resolve())); } };
}

/** tools/qa/states.ts를 vite로 읽어 장면 상태 만들기 함수(buildScene)와 로더 이름(QA_RUN_KEY·QA_RUN_PARAM)을 돌려준다. */
export async function loadStates() {
  const { module } = await runnerImport(path.join(ROOT, 'tools/qa/states.ts'), { configFile: false, logLevel: 'error', root: ROOT });
  return module;
}

/**
 * 기본은 헤드리스 셸(소프트웨어 GL, 캡처가 결정적). gpu면 새 헤드리스 크롬을 써서 이 기기의 실제 GPU(Metal)로 그린다
 * — 소프트웨어 GL은 CPU 감속과 상관없이 느려서 성능 측정에는 쓸 수 없다(1440×900에서 1배속도 20fps대).
 */
export const launch = ({ gpu = false } = {}) => chromium.launch(gpu ? { channel: 'chromium', args: ['--hide-scrollbars', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : { args: ['--hide-scrollbars'] });

/** 점검 기본 설정: 소리 끔, 연습 안내 끔, 첫 판 코치 마크는 끝낸 것으로(장면 1·2만 예외). */
export const baseSettings = (extra = {}) => ({ practiceSeen: true, soundOn: false, lastNickname: NICKNAME, lastGrade: 3, lastDifficulty: 'Normal', ...extra });

/**
 * 새 브라우저 창(저장소가 비어 있는 별도 컨텍스트)을 연다. clock이면 Playwright 가짜 시계를 깔아 게임 시간을 직접 흘린다(결정적 연출).
 * 페이지 오류·콘솔 오류·실패한 요청을 모아 둔다.
 */
export async function openPage(browser, { base, size, clock = false, route }) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = { pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [] };
  page.on('pageerror', e => issues.pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') issues.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('requestfailed', r => issues.failedRequests.push(`${r.url().replace(base, '')} ${r.failure()?.errorText ?? ''}`));
  page.on('response', r => { if (r.status() >= 400) issues.badResponses.push(`${r.status()} ${r.url().replace(base, '')}`); });
  if (route) await page.route(route.pattern, route.handler);
  if (clock) await page.clock.install({ time: new Date('2026-11-03T12:00:00Z') });
  return { context, page, issues };
}

/**
 * 설정·첫 판 코치 마크를 localStorage에 넣는다. 장면 상태(runState: loadStates().buildScene(...).state)가 있으면 같은 탭의 sessionStorage에
 * 넣고 개발 전용 QA 장면 로더 주소(`/?qaRun=1`)로 연다(src/application/qaRun.ts, 운영 빌드에는 없다). 없으면 홈을 다시 불러온다.
 */
export async function seed(page, base, { runState = null, states = null, settings, coach = ['place', 'start'] }) {
  await page.goto(`${base}/`);
  const qa = runState ? { key: states.QA_RUN_KEY, json: JSON.stringify(runState) } : null;
  await page.evaluate(({ settings, coach, qa }) => {
    localStorage.setItem('vocabulary-td.settings', JSON.stringify(settings));
    localStorage.setItem('vocabulary-td.coach', JSON.stringify(coach));
    if (qa) sessionStorage.setItem(qa.key, qa.json);
  }, { settings, coach, qa });
  if (runState) await page.goto(`${base}/?${states.QA_RUN_PARAM}=1`);
  else await page.reload();
}

/**
 * 로더가 연 게임 화면(정지 상태, '계속하기' 대기)이 다 뜰 때까지 기다린다.
 * clock이면 화면이 다 뜬 뒤 시계를 멈춘다. 이후 게임 시간은 runGame으로만 흐른다.
 */
export async function enterGame(page, { clock = false } = {}) {
  await page.getByRole('dialog').getByRole('button', { name: '계속하기' }).waitFor();
  await page.locator('canvas').first().waitFor();
  // 텍스처·원화 로딩과 첫 장면 생성을 기다린다.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);
  if (clock) {
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 800);
  }
}

/** 정지 창의 '계속하기'. */
export const continueGame = page => page.getByRole('dialog').getByRole('button', { name: '계속하기' }).click();

/** 게임 시간(가짜 시계)을 ms만큼 흘린다. 16ms마다 화면 한 프레임이 그려진다. */
export const runGame = (page, ms) => page.clock.runFor(ms);

/**
 * 화면의 객관 검사(미적 판단 아님): 포커스가 있는 요소, 가로 넘침, 44px 미만 조작 요소, 작은 글자, 깨진 이미지, 화면 밖으로 잘린 보이는 요소.
 * 전장 캔버스는 안쪽을 볼 수 없으니 이 검사는 DOM 몫이고, 캔버스 안은 캡처를 눈으로 본다.
 */
export async function domAudit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const visible = el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
    };
    const label = el => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28)}"`;
    /** 스크롤·잘라내기 상자 안에 있어서 일부러 가려진 요소인가(그 상자의 안쪽 영역 밖이면 true). */
    const hiddenByBox = el => {
      const r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
        const b = p.getBoundingClientRect();
        if (r.bottom > b.bottom + 1 || r.top < b.top - 1 || r.right > b.right + 1 || r.left < b.left - 1) return true;
      }
      return false;
    };
    /** overflow가 hidden/clip인 조상 상자에 일부가 잘려 나간 요소인가(스크롤 상자 auto/scroll은 일부러 가린 것이라 제외). 몇 px 잘렸는지 돌려준다. */
    const cutBy = el => {
      const r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        const clip = v => v === 'hidden' || v === 'clip';
        if (!clip(st.overflowX) && !clip(st.overflowY)) continue;
        const b = p.getBoundingClientRect();
        const dx = Math.max(r.right - b.right, b.left - r.left, 0), dy = Math.max(r.bottom - b.bottom, b.top - r.top, 0);
        // 통째로 가려진 것은 일부러 접어 둔 것으로 보고 건너뛴다. 일부만 보이는 것(잘림)만 돌려준다.
        const partial = (dx > 2 && dx < r.width - 2) || (dy > 2 && dy < r.height - 2);
        if (partial) return `${Math.round(dx)}px×${Math.round(dy)}px by ${p.tagName.toLowerCase()}.${String(p.className).split(' ')[0].slice(0, 24)}`;
      }
      return null;
    };
    const out = { overflowX: document.documentElement.scrollWidth - vw, overflowY: document.documentElement.scrollHeight - vh, small: [], tiny: [], broken: [], clipped: [], cutOff: [] };
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="option"], [role="radio"], [role="checkbox"]')) {
      if (!visible(el) || el.closest('[inert]') || hiddenByBox(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.small.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!visible(el) || el.closest('.sr-only') || hiddenByBox(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 13) out.tiny.push(`${label(el)} ${px}px`);
    }
    for (const img of document.images) if (visible(img) && (!img.complete || img.naturalWidth === 0)) out.broken.push(img.src.slice(-60));
    for (const el of document.querySelectorAll('button, [role="dialog"], [role="group"], [role="listbox"], [role="region"], [role="meter"], h1, h2, h3, p, li')) {
      if (!visible(el) || el.closest('.sr-only') || hiddenByBox(el)) continue;
      if (el.closest('[inert]') && !el.closest('[role="dialog"]')) continue;
      const r = el.getBoundingClientRect();
      // 세로로 스크롤되는 쪽은 화면 밖에 있는 것이 정상이라 가로로 나간 것만, 세로는 스크롤이 없는 화면에서만 센다.
      const sideways = r.right > vw + 1 || r.left < -1, vertical = r.bottom > vh + 1 || r.top < -1;
      if (sideways || (vertical && out.overflowY <= 1)) out.clipped.push(`${label(el)} (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    for (const el of document.querySelectorAll('button, input, select, [role="option"], [role="radio"], [role="meter"], [role="img"], img, h1, h2, h3, p, li, span')) {
      if (!visible(el) || el.closest('.sr-only') || el.closest('canvas') || el.closest('details:not([open])')) continue;
      const cut = cutBy(el);
      if (cut && (el.matches('button, input, select, [role], img') || el.textContent.trim())) out.cutOff.push(`${label(el)} cut ${cut}`);
    }
    // slop 계측(R4 §5.1): 화면 관문 수치. 문제 본문·선택지([data-content])는 상시 문장에서 뺀다.
    const shown = el => visible(el) && !el.closest('.sr-only') && !el.closest('canvas') && !hiddenByBox(el) && !(el.closest('[inert]') && !el.closest('[role="dialog"]'));
    const rgba = v => (v.match(/[\d.]+/g) ?? []).map(Number);
    const opaque = v => { const c = rgba(v); return c.length >= 3 && (c.length < 4 || c[3] > 0.05); };
    // 반투명 막(모달 scrim 등)은 겹이 아니라 덮개라 겹·토큰 밖 색에서 뺀다.
    const solid = v => { const c = rgba(v); return c.length >= 3 && (c.length < 4 || c[3] >= 0.9); };
    const boxed = el => {
      const st = getComputedStyle(el);
      return solid(st.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(st[`border${s}Width`]) >= 1 && opaque(st[`border${s}Color`]) && st[`border${s}Style`] !== 'none');
    };
    const root = getComputedStyle(document.documentElement);
    const tokens = new Set(['--bg', '--paper', '--paper-2', '--line', '--ink', '--ink-2', '--on-dark', '--green', '--green-base', '--amber', '--amber-base', '--red', '--red-base', '--blue']
      .map(n => root.getPropertyValue(n).trim().toLowerCase()).filter(Boolean)
      .map(hex => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }));
    const offToken = v => solid(v) && !tokens.has(rgba(v).slice(0, 3).join(','));
    const slop = { buttons: 0, sentences: [], fontSizes: new Set(), pills: 0, depth: 0, offToken: 0 };
    for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"], [role="radio"], [role="switch"], [role="checkbox"], [role="tab"]')) if (shown(el)) slop.buttons++;
    for (const el of document.querySelectorAll('body *')) {
      if (!shown(el)) continue;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim().replace(/\s+/g, ' ');
      if (own) {
        slop.fontSizes.add(Math.round(parseFloat(st.fontSize)));
        if (own.length >= 20 && own.includes(' ') && !el.closest('[data-content]')) slop.sentences.push(own.slice(0, 40));
        let d = 0;
        for (let p = el; p && p !== document.body; p = p.parentElement) if (boxed(p)) d++;
        slop.depth = Math.max(slop.depth, d);
        if (offToken(st.color)) slop.offToken++;
      }
      if (offToken(st.backgroundColor)) slop.offToken++;
      const rad = parseFloat(st.borderTopLeftRadius);
      if (r.height > 0 && rad >= r.height / 2 - 1 && r.width > r.height * 1.4 && boxed(el)) slop.pills++;
    }
    out.slop = { ...slop, sentences: [...new Set(slop.sentences)], fontSizes: [...slop.fontSizes].sort((a, b) => a - b) };
    const active = document.activeElement;
    out.focus = active && active !== document.body ? `${label(active)}${active.closest('[role="dialog"]') ? ' (대화상자 안)' : ''}` : 'body';
    for (const k of ['small', 'tiny', 'broken', 'clipped', 'cutOff']) out[k] = [...new Set(out[k])].slice(0, 12);
    return out;
  });
}
