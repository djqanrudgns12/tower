import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockDir = __dirname;
const outDir = path.resolve(__dirname, '..');
const tmpDir = '/Users/bodyking/.gemini/antigravity-cli/brain/00027665-1e3e-4dd7-9f32-cb94a7221a91/scratch';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const targets = [
  { html: 'battle.html', out: 'a-battle.webp' },
  { html: 'towers.html', out: 'b-towers.webp' },
  { html: 'enemies.html', out: 'c-enemies.webp' },
];

fs.mkdirSync(tmpDir, { recursive: true });

const server = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];
  const rel = reqPath.replace(/^\/+/, '');
  const full = path.resolve(mockDir, rel);
  if (!full.startsWith(mockDir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  for (const { html, out } of targets) {
    const tmpPng = path.join(tmpDir, `r01-${out.replace('.webp', '.png')}`);
    const destWebp = path.join(outDir, out);

    await page.goto(`${baseUrl}/${html}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__R01_READY) await window.__R01_READY;
    });
    await page.waitForTimeout(150);

    await page.screenshot({ path: tmpPng, type: 'png' });
    execFileSync('cwebp', ['-q', '90', tmpPng, '-o', destWebp], { stdio: 'inherit' });
    fs.unlinkSync(tmpPng);
  }
} finally {
  await browser.close();
  server.close();
}
