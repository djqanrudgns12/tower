/* global window, document, requestAnimationFrame, cancelAnimationFrame -- page.evaluate 안에서 도는 코드가 쓰는 브라우저 전역이다 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadavg, tmpdir } from 'node:os';
import { buildAndServe, ensureServer, enterGame, flag, launch, loadStates, baseSettings, openPage, seed, SIZES } from './lib.mjs';

// 저사양 측정(R3 P1, docs/renewal/prd-r3-phases.md §3.2). 장면 7(연출이 가장 많은 구간, states.ts 'fx-window')을 QA 장면 로더로 열어 실시간으로
// CDP Emulation.setCPUThrottlingRate로 CPU를 늦춘 채 secs초 동안 requestAnimationFrame 간격을 재고, 평균 fps와 50ms 넘는 프레임 비율을 낸다.
// 분위기 층(AmbientLayer) 끈 경우는 개발 서버가 내주는 모듈을 바꿔 층을 만들지도 갱신하지도 않게 해서 잰다(제품 코드는 그대로다).
// 쓰는 법: node tools/qa/perf.mjs --out <결과.json> [--target dev|prod] [--rates 4,6] [--ambient on,off] [--secs 10] [--size desk|cb] [--reps 1] [--state fx-window] [--shot <끝 화면.png>] [--port 5341] [--base http://localhost:4173]
// 기본은 이 기기의 실제 GPU로 그린다(--software면 소프트웨어 GL). --base를 주면 그 주소를 쓴다. QA 장면 로더가 켜진 서버여야 하고(개발 서버, 또는 --target prod가
// 만드는 측정용 빌드처럼 DEV 분기를 켠 빌드. 배포 빌드에는 로더가 없다), 이 경우 분위기 층 끄기는 지원하지 않는다.

const AMBIENT_OFF = {
  pattern: '**/src/game/layers/AmbientLayer.ts*',
  async handler(route) {
    const response = await route.fetch();
    const text = (await response.text()).replace('export class AmbientLayer', 'class AmbientLayerOriginal') + '\nexport class AmbientLayer { constructor() {} update() {} }\n';
    await route.fulfill({ response, body: text, headers: { ...response.headers(), 'content-length': String(Buffer.byteLength(text)) } });
  },
};

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;

/** rAF 시각 목록에서 평균 fps·느린 프레임 비율 등을 구한다. */
export function summarize(frames) {
  const gaps = frames.slice(1).map((t, i) => t - frames[i]);
  const span = frames.length > 1 ? frames.at(-1) - frames[0] : 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    frames: gaps.length,
    seconds: Math.round(span) / 1000,
    avgFps: span > 0 ? Math.round((gaps.length / span) * 10000) / 10 : 0,
    slowPct: gaps.length ? Math.round((gaps.filter(g => g > 50).length / gaps.length) * 1000) / 10 : 0,
    p50ms: Math.round(quantile(sorted, 0.5) * 10) / 10,
    p95ms: Math.round(quantile(sorted, 0.95) * 10) / 10,
    maxMs: Math.round((sorted.at(-1) ?? 0) * 10) / 10,
  };
}

async function measure(browser, ctx, { rate, ambient, secs, size, states, built, shot, route }) {
  const { context, page, issues } = await openPage(browser, { base: ctx.base, size, clock: false, ...(route && ambient === 'off' ? { route: AMBIENT_OFF } : {}) });
  try {
    await seed(page, ctx.base, { runState: built.state, states, settings: baseSettings() });
    await enterGame(page, { clock: false });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(300);
    // 틱 진행(PERFORMANCE 정지 여부)과 프레임 간격을 한 번에 재려고, 계속하기를 누르는 순간부터 기록한다.
    await page.evaluate(() => {
      window.__frames = [];
      const loop = t => { window.__frames.push(t); window.__raf = requestAnimationFrame(loop); };
      window.__raf = requestAnimationFrame(loop);
      [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === '계속하기')?.click();
    });
    await page.waitForTimeout(secs * 1000);
    const frames = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__frames; });
    const paused = await page.getByRole('dialog').count();
    const dialogText = paused ? (await page.getByRole('dialog').first().innerText()).replace(/\s+/g, ' ').slice(0, 60) : null;
    const hud = await page.getByRole('application', { name: /전장/ }).getAttribute('aria-label');
    if (shot) await page.screenshot({ path: shot.replace('.png', `-${rate}x-${ambient}.png`) });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return { rate, ambient, size: size.name, loadAvg1: Math.round(loadavg()[0] * 10) / 10, ...summarize(frames), pausedAtEnd: paused > 0, dialogText, field: hud, errors: issues.pageErrors.length };
  } finally {
    await context.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const out = flag(args, 'out', null);
  const rates = flag(args, 'rates', '4,6').split(',').map(Number);
  const ambients = flag(args, 'ambient', 'on,off').split(',');
  const secs = Number(flag(args, 'secs', 10));
  const size = SIZES[flag(args, 'size', 'desk')];
  const reps = Number(flag(args, 'reps', 1));
  const stateName = flag(args, 'state', 'fx-window');
  const target = flag(args, 'target', 'dev');
  const external = flag(args, 'base', null);
  const port = Number(flag(args, 'port', process.env.E2E_PORT ?? 5341));
  const work = flag(args, 'work', path.join(tmpdir(), 'qa-perf-build'));
  const servers = [];
  const bases = {};
  if (external) bases.on = external;
  else if (target === 'prod') {
    const on = await buildAndServe({ outDir: path.join(work, 'on'), port: port + 10 });
    const off = ambients.includes('off') ? await buildAndServe({ outDir: path.join(work, 'off'), port: port + 11, ambientOff: true }) : null;
    servers.push(on, ...(off ? [off] : []));
    bases.on = on.base;
    if (off) bases.off = off.base;
  } else {
    const dev = await ensureServer(port);
    servers.push(dev);
    bases.on = bases.off = dev.base;
  }
  console.log(`대상: ${external ? `외부 ${external}` : target === 'prod' ? '운영 빌드(vite preview)' : '개발 서버'}`);
  const states = await loadStates();
  const built = states.buildScene(stateName, {});
  console.log(`장면 상태: ${stateName} — ${built.note}`);
  console.log(args.includes('--software') ? '렌더: 소프트웨어 GL(SwiftShader)' : '렌더: 실제 GPU(Metal)');
  const browser = await launch({ gpu: !args.includes('--software') });
  const rows = [];
  try {
    for (const rate of rates) for (const ambient of ambients) for (let r = 0; r < reps; r++) {
      if (!bases[ambient]) continue;
      const row = await measure(browser, { base: bases[ambient] }, { rate, ambient, secs, size, states, built, shot: flag(args, 'shot', null), route: target === 'dev' && !external });
      rows.push(row);
      console.log(`${rate}x 분위기 ${ambient}: 평균 ${row.avgFps}fps(부하 ${row.loadAvg1}), 50ms 초과 ${row.slowPct}%, p50 ${row.p50ms}ms p95 ${row.p95ms}ms 최대 ${row.maxMs}ms, 프레임 ${row.frames}/${row.seconds}s${row.pausedAtEnd ? `, 정지 창: ${row.dialogText}` : ''}`);
    }
  } finally {
    await browser.close();
    for (const s of servers) await s.stop();
  }
  if (out) {
    await mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await writeFile(out, JSON.stringify({ state: stateName, note: built.note, secs, rows }, null, 2));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
