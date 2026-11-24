import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const MOCK_DIR = path.resolve('docs/renewal/r6/round3/concepts/R04/mock');
const OUT_DIR = path.resolve('docs/renewal/r6/round3/concepts/R04');
const TMP_DIR = '/Users/bodyking/.gemini/antigravity-cli/brain/00027665-1e3e-4dd7-9f32-cb94a7221a91/scratch/candidates/R04';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const TARGETS = [
  { html: 'battle.html', out: 'a-battle.webp' },
  { html: 'towers.html', out: 'b-towers.webp' },
  { html: 'enemies.html', out: 'c-enemies.webp' },
];

fs.mkdirSync(TMP_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'battle.html' : urlPath.replace(/^\/+/, '');
  const full = path.join(MOCK_DIR, rel);
  if (!full.startsWith(MOCK_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
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

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  for (const t of TARGETS) {
    await page.goto(`http://127.0.0.1:${port}/${t.html}`, { waitUntil: 'networkidle' });
    const fontStatus = await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__cropsReady) await window.__cropsReady;
      const loaded = [];
      for (const f of document.fonts) {
        if (f.status === 'loaded') loaded.push(f.family);
      }
      return [...new Set(loaded)];
    });
    await page.waitForTimeout(120);

    const tmpPng = path.join(TMP_DIR, `render-${t.out.replace('.webp', '.png')}`);
    const outWebp = path.join(OUT_DIR, t.out);
    await page.screenshot({ path: tmpPng, type: 'png' });
    execFileSync('cwebp', ['-q', '90', tmpPng, '-o', outWebp], { stdio: 'inherit' });
    const kb = (fs.statSync(outWebp).size / 1024).toFixed(1);
    console.log(`Rendered ${t.out} (${kb} KB), fonts: ${fontStatus.join(', ')}`);
  }
} finally {
  await browser.close();
  server.close();
}
