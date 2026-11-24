/* global window */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { copyFile, cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { cpus, platform, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('./', import.meta.url));
const modes = ['phaser', 'webgl', 'baked'];
const [work, ...options] = process.argv.slice(2);
if (!work || options.some((value) => value !== '--serve')) {
  throw new Error('사용법 · node tools/r6/spine/run.mjs <작업 폴더> [--serve]');
}
const site = resolve(work, 'site');
const modules = resolve(work, 'runtime/node_modules');
const shots = resolve(work, 'shots');
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json'], ['.webp', 'image/webp'], ['.atlas', 'text/plain'],
]);

async function bundle(mode) {
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: `import {runGame} from './scene.mjs'; import {adapter} from './${mode}.mjs'; runGame(adapter);`,
      resolveDir: root,
    },
    alias: { phaser: resolve(modules, 'phaser') },
    nodePaths: [modules],
    bundle: true,
    minify: true,
    format: 'esm',
    legalComments: 'inline',
    write: false,
  });
  const bytes = result.outputFiles[0].contents;
  await writeFile(resolve(site, `${mode}.js`), bytes);
  return { minified: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
}

const stats = async (dir, files) => {
  const named = {};
  for (const file of files) named[file] = (await stat(resolve(dir, file))).size;
  return named;
};

function metrics({ intervals, cpu }) {
  assert.ok(intervals.length >= 30, '프레임 표본이 부족합니다.');
  const round = (n) => Number(n.toFixed(2));
  const p95 = (xs) => round(xs.toSorted((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1]);
  return {
    frames: intervals.length, fps: round(1000 * intervals.length / intervals.reduce((a, b) => a + b, 0)),
    p95Ms: p95(intervals), cpuP95Ms: p95(cpu),
    over20Ms: intervals.filter((value) => value > 20).length,
  };
}

async function verifyAndMeasure(base) {
  await mkdir(shots, { recursive: true });
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const mode of modes) {
      const result = {};
      const page = await browser.newPage({ viewport: { width: 840, height: 760 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      async function open(count) {
        await page.goto(`${base}?mode=${mode}&count=${count}`);
        await page.waitForFunction(() => window.r6 || window.r6Error);
        const info = await page.evaluate(() => ({
          error: window.r6Error, count: window.r6?.count, renderer: window.r6?.renderer,
        }));
        assert.equal(info.error, undefined);
        assert.equal(info.count, count);
        return info.renderer;
      }
      try {
        result.renderer = await open(4);
        const stage = await page.locator('#stage').boundingBox();
        const clip = { x: stage.x, y: stage.y, width: 256, height: 61 };
        const captures = [];
        for (const [name, milliseconds] of [['walk', 230], ['hit', 90], ['fall', 500]]) {
          await page.evaluate((name) => window.r6.play(name, false), name);
          await page.evaluate((delay) => new Promise((done) => setTimeout(done, delay)), milliseconds);
          captures.push(await page.screenshot({ clip, path: resolve(shots, `${mode}-${name}.png`) }));
        }
        assert.equal(new Set(captures.map((capture) => capture.toString('base64'))).size, 3,
          `${mode}에서 동작별 화면이 달라야 합니다.`);
        await open(120);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('HeapProfiler.collectGarbage');
        result.heapUsedBytes = (await cdp.send('Runtime.getHeapUsage')).usedSize;
        for (const rate of [1, 4]) {
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          result[`cpu${rate}x`] = metrics(await page.evaluate(() => window.r6.measure(6000, 1500)));
        }
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
      results[mode] = result;
    }
    return { chromium: browser.version(), host: [platform(), release(), cpus()[0]?.model], results };
  } finally {
    await browser.close();
  }
}

await mkdir(site, { recursive: true });
await copyFile(resolve(root, 'index.html'), resolve(site, 'index.html'));
await cp(resolve(work, 'spine/packed'), resolve(site, 'packed'), { recursive: true, filter: (file) => extname(file) !== '.png' });
await cp(resolve(work, 'spine/baked'), resolve(site, 'baked'), { recursive: true });
const bundles = {};
for (const mode of modes) bundles[mode] = await bundle(mode);
const transfer = {
  spine: await stats(resolve(site, 'packed'), ['walker.json', 'walker.atlas', 'walker.webp']),
  baked: await stats(resolve(site, 'baked'), ['frames.json', 'walker.webp']),
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = resolve(site, path === '/' ? 'index.html' : `.${path}`);
    if (!file.startsWith(site + sep) || !mime.has(extname(file))) throw new Error('없는 파일');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime.get(extname(file)) });
    response.end(bytes);
  } catch {
    response.writeHead(404).end('파일 없음');
  }
});
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const url = `http://127.0.0.1:${server.address().port}/`;
console.log(`시험 페이지 · ${url}`);
if (options.includes('--serve')) {
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
} else {
  try {
    const report = { bundles, transfer, ...await verifyAndMeasure(url) };
    const json = JSON.stringify(report, null, 2) + '\n';
    await writeFile(resolve(work, 'benchmark.json'), json);
    console.log(json.trim());
  } finally {
    server.close();
  }
}
