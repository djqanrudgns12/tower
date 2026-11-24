import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCRATCH_DIR =
  '/Users/bodyking/.gemini/antigravity-cli/brain/00027665-1e3e-4dd7-9f32-cb94a7221a91/scratch/renders/R02';

fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const targets = [
  { html: 'battle.html', out: 'a-battle.webp' },
  { html: 'towers.html', out: 'b-towers.webp' },
  { html: 'enemies.html', out: 'c-enemies.webp' },
];

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const rel = urlPath === '/' ? 'battle.html' : urlPath.replace(/^\/+/, '');
  const full = path.resolve(__dirname, rel);
  if (!full.startsWith(__dirname) || !fs.existsSync(full)) {
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

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  for (const t of targets) {
    const url = `http://127.0.0.1:${port}/${t.html}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__renderReady) {
        await window.__renderReady;
      }
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : img.decode().catch(() => {})
        )
      );
    });
    const tmpPng = path.join(SCRATCH_DIR, t.out.replace(/\.webp$/, '.png'));
    const outWebp = path.join(ROOT_DIR, t.out);
    await page.screenshot({ path: tmpPng, fullPage: false });
    execFileSync('cwebp', ['-q', '90', tmpPng, '-o', outWebp], { stdio: 'inherit' });
    console.log(`Rendered ${outWebp}`);
  }
} finally {
  await browser.close();
  server.close();
}
