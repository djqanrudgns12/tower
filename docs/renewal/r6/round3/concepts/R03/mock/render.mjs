import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..');
const scratchDir = '/Users/bodyking/.gemini/antigravity-cli/brain/00027665-1e3e-4dd7-9f32-cb94a7221a91/scratch/candidates/R03';
fs.mkdirSync(scratchDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];
  const filePath = path.join(__dirname, reqPath === '/' ? 'battle.html' : reqPath);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const pages = [
  { html: 'battle.html', out: 'a-battle.webp' },
  { html: 'towers.html', out: 'b-towers.webp' },
  { html: 'enemies.html', out: 'c-enemies.webp' },
];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  for (const item of pages) {
    await page.goto(`${baseUrl}/${item.html}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (window.__MOCK_READY__) await window.__MOCK_READY__;
    });
    const tmpPng = path.join(scratchDir, `render-${item.out.replace('.webp', '.png')}`);
    const destWebp = path.join(outDir, item.out);
    await page.screenshot({ path: tmpPng, type: 'png' });
    execFileSync('cwebp', ['-q', '90', tmpPng, '-o', destWebp], { stdio: 'inherit' });
    console.log(`Rendered ${destWebp}`);
  }
} finally {
  await browser.close();
  server.close();
}
