import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const UI_DIR = path.resolve('docs/renewal/r6/ui');
const SCRATCH_DIR = '/Users/bodyking/.gemini/antigravity-cli/brain/da44b283-1140-4a13-9d9a-0b4ae0d2a8a9/scratch/r6-ui';
const DESK_DIR = path.join(UI_DIR, 'captures/desktop');
const MOB_DIR = path.join(UI_DIR, 'captures/mobile');

fs.mkdirSync(SCRATCH_DIR, { recursive: true });
fs.mkdirSync(DESK_DIR, { recursive: true });
fs.mkdirSync(MOB_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

const SCREENS = [
  '01-home',
  '02-new-game',
  '03-battle-hud',
  '04-tower-detail',
  '05-tower-unlock',
  '06-relic-select',
  '07-pause',
  '08-result',
  '09-wrong-note',
  '10-guide',
  '11-settings',
  '12-ranking',
  '13-classroom-qr',
];

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.join(UI_DIR, rel);
  if (!full.startsWith(UI_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(full);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });

async function inspectAndCapture(page, url, outWebp, tag) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (window.__iconsReady) await window.__iconsReady;
  });
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    function parseColor(str) {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    }
    function composite(fg, bg) {
      const a = fg.a;
      return {
        r: Math.round(fg.r * a + bg.r * (1 - a)),
        g: Math.round(fg.g * a + bg.g * (1 - a)),
        b: Math.round(fg.b * a + bg.b * (1 - a)),
        a: 1,
      };
    }
    function lum(c) {
      const toLin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLin(c.r) + 0.7152 * toLin(c.g) + 0.0722 * toLin(c.b);
    }
    function contrast(c1, c2) {
      const l1 = lum(c1);
      const l2 = lum(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function effectiveBg(el) {
      const stack = [];
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const bg = parseColor(getComputedStyle(cur).backgroundColor);
        if (bg && bg.a > 0) stack.unshift(bg);
        cur = cur.parentElement;
      }
      let out = { r: 14, g: 18, b: 22, a: 1 };
      for (const layer of stack) out = composite(layer, out);
      return out;
    }

    const overflowX = document.documentElement.scrollWidth - window.innerWidth;
    const issues = [];
    let minContrast = 99;
    let minBodyContrast = 99;
    let checked = 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.6) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest('.sr-only')) continue;

      const fg = parseColor(st.color);
      if (!fg) continue;
      const bg = effectiveBg(el);
      const ratio = contrast(composite(fg, bg), bg);
      const fs = parseFloat(st.fontSize);
      const fw = parseInt(st.fontWeight, 10) || 400;
      const isLarge = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const req = isLarge ? 3.0 : 4.5;
      checked++;
      if (ratio < minContrast) minContrast = ratio;
      if (!isLarge && ratio < minBodyContrast) minBodyContrast = ratio;
      if (ratio < req) {
        issues.push({
          text: node.nodeValue.trim().slice(0, 30),
          ratio: Number(ratio.toFixed(2)),
          req,
          fg: st.color,
          bg: `rgb(${bg.r},${bg.g},${bg.b})`,
        });
      }
    }

    return {
      overflowX,
      scrollHeight: document.documentElement.scrollHeight,
      checked,
      minContrast: Number(minContrast.toFixed(2)),
      minBodyContrast: Number(minBodyContrast.toFixed(2)),
      issues: issues.slice(0, 10),
    };
  });

  const tmpPng = path.join(SCRATCH_DIR, `${tag}.png`);
  await page.screenshot({ path: tmpPng, type: 'png', fullPage: false });
  execFileSync('cwebp', ['-quiet', '-q', '88', '-m', '6', tmpPng, '-o', outWebp]);
  const kb = Number((fs.statSync(outWebp).size / 1024).toFixed(1));
  return { tag, kb, ...metrics };
}

const results = [];
try {
  // 1. Desktop 1280x720
  const desk = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  results.push(
    await inspectAndCapture(desk, `${baseUrl}/icons/index.html`, path.join(UI_DIR, 'captures/icon-sheet.webp'), 'icon-sheet')
  );
  for (const s of SCREENS) {
    results.push(
      await inspectAndCapture(desk, `${baseUrl}/screens/${s}.html`, path.join(DESK_DIR, `${s}.webp`), `desk-${s}`)
    );
  }
  results.push(
    await inspectAndCapture(
      desk,
      `${baseUrl}/screens/03-battle-hud.html?theme=light`,
      path.join(DESK_DIR, '03-battle-hud-light.webp'),
      'desk-03-battle-hud-light'
    )
  );
  results.push(
    await inspectAndCapture(
      desk,
      `${baseUrl}/screens/11-settings.html?theme=light`,
      path.join(DESK_DIR, '11-settings-light.webp'),
      'desk-11-settings-light'
    )
  );
  await desk.close();

  // 2. Mobile 390x844
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  for (const s of SCREENS) {
    results.push(
      await inspectAndCapture(mob, `${baseUrl}/screens/${s}.html`, path.join(MOB_DIR, `${s}.webp`), `mob-${s}`)
    );
  }
  await mob.close();

  fs.writeFileSync(path.join(SCRATCH_DIR, 'metrics.json'), JSON.stringify(results, null, 2));
  for (const r of results) {
    const warn = r.issues.length ? ` CONTRAST_FAIL(${r.issues.length})` : '';
    const ov = r.overflowX > 1 ? ` OVERFLOW_X(${r.overflowX})` : '';
    console.log(`${r.tag.padEnd(28)} ${String(r.kb).padStart(6)}KB | minBody=${r.minBodyContrast} | ovX=${r.overflowX}${warn}${ov}`);
    if (r.issues.length) console.log('  issues:', JSON.stringify(r.issues));
  }
} finally {
  await browser.close();
  server.close();
}
