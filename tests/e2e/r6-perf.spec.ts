import { writeFileSync } from 'node:fs';
import type { BrowserContext, TestInfo } from '@playwright/test';
import type Phaser from 'phaser';
import type { RunController } from '../../src/application/RunController';
import type { QualityLevel } from '../../src/application/renderQuality';
import type { BattleScene } from '../../src/game/BattleScene';
import type * as Sim from '../../tools/sim/balanceSim';
import type * as Relics from '../../src/domain/relics';
import { expect, test, type Page } from './tower-browser';

test.use({
  trace: { mode: 'off' },
  ...(process.platform === 'darwin' ? { channel: 'chromium', launchOptions: { args: ['--use-angle=metal'] } } : {}),
});

interface WavePerf {
  frames: number;
  elapsedMs: number;
  minWindowFps: number | null;
  maxEnemies: number;
  bosses: string[];
}

interface MinWindow {
  ms: number;
  wave: number;
  fps: number;
  enemies: number;
}

interface Reading {
  frames: number;
  elapsedMs: number;
  tick: number;
  completedWave: number;
  quality: Array<{ ms: number; wave: number; level: QualityLevel }>;
  pauses: Array<{ ms: number; wave: number }>;
  minWindow: MinWindow | null;
  waves: Record<number, WavePerf>;
  renderer: string;
  ended: boolean;
  failure: string | null;
}

declare global {
  interface Window {
    qaPerf: { controller: RunController; scene: BattleScene };
    qaPerfReading: Reading;
  }
}

async function openRun(page: Page, tower = false) {
  // 공유 저장소의 파일 편집이 측정 중인 탭을 새로고침하지 않게 한다.
  await page.routeWebSocket(url => url.hostname === 'localhost' || url.hostname === '127.0.0.1', () => undefined);
  await page.route(/\/\?qaRun=1$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<script type="module" src="/src/main.tsx"></script>', `<script type="module">
      import { loadGradeContent } from '/src/content/index.ts';
      import { localBalanceSession } from '/src/application/balanceSession.ts';
      import { RunController } from '/src/application/RunController.ts';
      import { applyCommand } from '/src/domain/run.ts';
      import { BattleScene } from '/src/game/BattleScene.ts';
      await loadGradeContent(3);
      const { state, ctx } = localBalanceSession('2.0.0', 3, 'Normal', {
        runId: 'r6-perf-normal-1', playerId: 'qa', nickname: '전장 점검', seed: 1,
        rankingEligibility: 'personal', createdAt: new Date().toISOString(),
      });
      if (${tower}) {
        state.phase = 'BUILD';
        state.gold = 500;
        if (!applyCommand(ctx, state, { type: 'build', tower: 'rail', slotId: ctx.map.slots[0].id }).ok)
          throw Error('타워 설치 실패');
      }
      sessionStorage.setItem('vocabulary-td.qaRun', JSON.stringify(state));
      window.qaPerf = {};
      const start = RunController.prototype.start;
      RunController.prototype.start = function () { window.qaPerf.controller = this; start.call(this); };
      const create = BattleScene.prototype.create;
      BattleScene.prototype.create = function () { create.call(this); window.qaPerf.scene = this; };
      await import('/src/main.tsx');
    </script>`);
    await route.fulfill({ response, body });
  });
  await page.goto('/?qaRun=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.qaPerf?.scene && window.qaPerf?.controller)), { timeout: 25_000 }).toBe(true);
}

test.describe('가벼운 화면', () => {
  test.use({ deviceScaleFactor: 2 });
  test('설정을 저장하고 타워와 캔버스의 해상도를 낮춘다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '설정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '환경설정' });
    await dialog.getByRole('tab', { name: '화면·조작' }).click();
    const setting = dialog.getByRole('switch', { name: '가벼운 화면' });
    await expect(setting).not.toBeChecked();
    await setting.click();
    await expect(setting).toBeChecked();
    await openRun(page, true);
    const readField = () => page.evaluate(() => {
      const { controller, scene } = window.qaPerf;
      const canvas = scene.game.canvas;
      const body = scene.children.getByName(`r6:tower:${controller.state.towers[0]!.id}:body`) as Phaser.GameObjects.Image | undefined;
      return {
        level: controller.renderQuality.current,
        frame: body?.frame.width, size: body?.displayWidth,
        width: canvas.width, cssWidth: canvas.getBoundingClientRect().width,
      };
    });
    await expect.poll(async () => (await readField()).frame).toBe(192);
    const light = await readField();
    expect(light.level).toBe(3);
    expect(light.width / light.cssWidth).toBeCloseTo(1.5, 2);
    await page.evaluate(() => window.qaPerf.controller.renderQuality.setLight(false));
    await expect.poll(async () => (await readField()).frame).toBe(384);
    const full = await readField();
    expect(full.size).toBeCloseTo(light.size!, 3);
    expect(full.cssWidth).toBeCloseTo(light.cssWidth, 0);
    expect(full.width / full.cssWidth).toBeCloseTo(2, 2);
    // 고해상도에서 낮은 해상도로 전환하면 쓰지 않는 2배 텍스처를 회수한다.
    await page.evaluate(() => window.qaPerf.controller.renderQuality.setLight(true));
    await expect.poll(async () => (await readField()).frame).toBe(192);
    await expect.poll(() => page.evaluate(() => window.qaPerf.scene.textures.getTextureKeys().some(key =>
      key.startsWith('r6.sheet.') && key.endsWith('.2x')))).toBe(false);
  });
});

async function runPerfPass(
  cpuRate: number,
  targetWave: 10 | 20,
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
) {
  test.skip(process.env.TOWER_R6_PERF_RUN !== '1', '실시간 통주는 npm run test:r6-perf로 실행합니다.');
  test.setTimeout(targetWave === 20 ? 45 * 60_000 : 25 * 60_000);
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.text().startsWith('통주 · ')) console.log(message.text());
  });
  await openRun(page);
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  await page.evaluate(async ({ simUrl, relicsUrl, stopAt }) => {
    const [sim, { relicContext }] = await Promise.all([
      import(simUrl) as Promise<typeof Sim>,
      import(relicsUrl) as Promise<typeof Relics>,
    ]);
    const { controller, scene } = window.qaPerf;
    const { gl } = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    const reading: Reading = {
      frames: 0, elapsedMs: 0, tick: 0, completedWave: 0, quality: [], pauses: [],
      minWindow: null, waves: {},
      renderer: String(gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)), ended: false, failure: null,
    };
    window.qaPerfReading = reading;
    const player = sim.createPlayer({
      mapId: controller.ctx.map.id, difficulty: 'Normal', balance: controller.ctx.balance,
      accuracy: 0.8, readSec: 2, strategy: 'balanced', seed: 1,
      towers: [...controller.state.config.availableTowers],
      policy: { ...sim.STRATEGIES.balanced, pattern: ['rail', 'rail', 'mortar', 'cryo', 'rail', 'mortar', 'rail', 'mortar'] as Sim.Strategy['pattern'] },
    });
    let started = 0;
    let lastTickAt = 0;
    let nextTrade = 0;
    let encounterId = -1;
    let queuedAnswer = -1;
    let answerTick = 0;
    let inPerformancePause = false;
    let winStart = 0;
    let winFrames = 0;
    let winWave = 0;
    let winMaxEnemies = 0;
    let lastFrameAt = 0;
    let lastFrameWave = 0;

    const ensureWave = (waveNo: number): WavePerf => (reading.waves[waveNo] ??= {
      frames: 0, elapsedMs: 0, minWindowFps: null, maxEnemies: 0, bosses: [],
    });

    const offEvents = controller.onEvents(events => {
      const waveNo = controller.state.wave;
      for (const event of events) {
        if (event.type === 'spawn' && event.kind === 'boss') {
          ensureWave(waveNo).bosses.push(event.entityId ?? event.art);
        }
      }
    });

    const countFrame = () => {
      if (!started || reading.ended || reading.failure) return;
      reading.frames++;
      const s = controller.state;
      if (s.pause.length > 0 || s.phase === 'GAME_OVER') {
        winStart = 0;
        winFrames = 0;
        winWave = 0;
        winMaxEnemies = 0;
        lastFrameAt = 0;
        return;
      }
      const now = performance.now();
      const waveNo = s.wave;
      const waveStat = ensureWave(waveNo);
      waveStat.frames++;
      if (lastFrameAt > 0 && lastFrameWave === waveNo) {
        waveStat.elapsedMs += now - lastFrameAt;
      }
      lastFrameAt = now;
      lastFrameWave = waveNo;
      let aliveEnemies = 0;
      for (const e of s.enemies) if (e.alive) aliveEnemies++;
      if (aliveEnemies > waveStat.maxEnemies) waveStat.maxEnemies = aliveEnemies;
      if (winStart === 0 || winWave !== waveNo) {
        winStart = now;
        winFrames = 1;
        winWave = waveNo;
        winMaxEnemies = aliveEnemies;
      } else {
        winFrames++;
        if (aliveEnemies > winMaxEnemies) winMaxEnemies = aliveEnemies;
        const winMs = now - winStart;
        if (winMs >= 1000) {
          const winFps = Number((1000 * winFrames / winMs).toFixed(2));
          if (!reading.minWindow || winFps < reading.minWindow.fps) {
            reading.minWindow = {
              ms: Number((now - started).toFixed(1)),
              wave: waveNo,
              fps: winFps,
              enemies: winMaxEnemies,
            };
          }
          if (waveStat.minWindowFps === null || winFps < waveStat.minWindowFps) {
            waveStat.minWindowFps = winFps;
          }
          winStart = now;
          winFrames = 0;
          winMaxEnemies = 0;
        }
      }
    };
    scene.game.events.on('postrender', countFrame);

    function step(now: number) {
      const s = controller.state;
      if (!started && s.pause.includes('USER')) { requestAnimationFrame(step); return; }
      if (!started) started = lastTickAt = now;
      reading.elapsedMs = now - started;
      const level = controller.renderQuality.current;
      if (reading.quality.at(-1)?.level !== level) {
        reading.quality.push({ ms: reading.elapsedMs, wave: s.wave, level });
        console.log(`통주 · W${s.wave} · 품질 ${level}단계`);
      }
      if (s.completedWave > reading.completedWave) {
        reading.completedWave = s.completedWave;
        console.log(`통주 · W${s.completedWave} 완료 · 성문 ${s.gateHp}`);
      }
      if (s.phase === 'GAME_OVER') {
        reading.ended = true;
      } else if (s.pause.length === 1 && s.pause[0] === 'PERFORMANCE') {
        if (!inPerformancePause) {
          reading.pauses.push({ ms: reading.elapsedMs, wave: s.wave });
          inPerformancePause = true;
          console.log(`통주 · W${s.wave} · 기기 느려짐 정지`);
        }
        // 실패는 그대로 기록하되 최대 세 번까지 재개해 나머지 웨이브도 측정한다.
        const resume = document.querySelector<HTMLButtonElement>('[aria-labelledby="pause-title"] button');
        if (reading.pauses.length > 3) reading.failure = '자동 정지 4회';
        else if (resume) { resume.click(); lastTickAt = now; }
        else if (now - lastTickAt > 40_000) reading.failure = '자동 정지에서 재개할 수 없음';
      } else if (s.pause.length) {
        reading.failure = `W${s.wave} · ${s.pause.join(', ')}`;
      } else if (now - lastTickAt > 40_000) {
        reading.failure = `W${s.wave} · 40초 동안 논리 틱 정지`;
      } else if (s.tick !== reading.tick) {
        inPerformancePause = false;
        lastTickAt = now;
        reading.tick = s.tick;
        const send = (command: Parameters<RunController['dispatch']>[0]) => {
          const result = controller.dispatch(command);
          if (!result.ok) reading.failure = `W${s.wave} · ${command.type} · ${result.error}`;
        };
        const unlock = document.querySelector<HTMLButtonElement>('[aria-labelledby="tower-unlock-title"] button');
        const relic = document.querySelector<HTMLButtonElement>('[aria-labelledby="r6-relic-title"] button:not([role="radio"])');
        const encounter = s.quiz.current;
        const feedback = s.quiz.feedback;
        if (s.completedWave >= stopAt) send({ type: 'quit' });
        else if (unlock) unlock.click();
        else if (relic) relic.click();
        else if (encounter && !encounter.answer && encounter.id !== queuedAnswer) {
          if (encounterId !== encounter.id) { encounterId = encounter.id; answerTick = s.tick + 60; }
          if (s.tick >= answerTick) {
            const question = controller.ctx.questions.get(encounter.questionId)!;
            const correct = (s.stats.correct + s.stats.wrong + 1) % 5 !== 0;
            const choice = correct ? question.correctOptionId : question.options.find(option => option.id !== question.correctOptionId)!.id;
            send({ type: 'answer', encounterId: encounter.id, choice });
            queuedAnswer = encounter.id;
          }
        } else if (feedback && feedback.autoAdvanceTick === null && feedback.nextEnabledTick !== null &&
          s.tick >= feedback.nextEnabledTick) send({ type: 'next', encounterId: feedback.encounterId });
        else if ((s.phase === 'BUILD' || s.phase === 'BATTLE') && s.tick >= nextTrade) {
          const choice = sim.bestOption(sim.greedyOptions({ ...player, ctx: relicContext(controller.ctx, s), s }));
          if (choice && choice.cost <= s.gold) { send(choice.cmd); nextTrade = s.tick + 6; }
          else if (s.phase === 'BUILD') send({ type: 'startBattle' });
          else nextTrade = s.tick + 240;
        }
      }
      if (reading.ended || reading.failure) {
        offEvents();
        scene.game.events.off('postrender', countFrame);
      } else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, { simUrl: '/tools/sim/balanceSim.ts', relicsUrl: '/src/domain/relics.ts', stopAt: targetWave });
  await page.getByRole('button', { name: '계속하기' }).click();
  const finished = await page.waitForFunction(() => window.qaPerfReading?.ended || window.qaPerfReading?.failure,
    null, { polling: 1000, timeout: (targetWave === 20 ? 42 : 23) * 60_000 }).then(() => true, () => false);
  const reading = await page.evaluate(() => window.qaPerfReading);
  const fps = Number((1000 * reading.frames / reading.elapsedMs).toFixed(2));
  const minWindowFps = reading.minWindow?.fps ?? null;
  const path = testInfo.outputPath('run.json');
  writeFileSync(path, JSON.stringify({
    cpuRate, targetWave, fps, minWindowFps, ...reading, errors,
  }, null, 2));
  await testInfo.attach('통주 측정', { path, contentType: 'application/json' });
  console.log(`통주 · CPU ${cpuRate}배 · W${reading.completedWave}/${targetWave} · 평균 ${fps}fps · 최저(1초) ${minWindowFps ?? '-'}fps · 자동 정지 ${reading.pauses.length}회`);
  expect(finished, '제한 시간 안에 통주 완료').toBe(true);
  expect(reading.failure).toBeNull();
  expect(reading.completedWave).toBe(targetWave);
  expect(reading.pauses, '자동 정지 횟수').toEqual([]);
  expect(errors).toEqual([]);
  if (targetWave === 20) {
    expect(fps, '평균 50fps 이상').toBeGreaterThanOrEqual(50);
    expect(reading.waves[15]?.bosses.length ?? 0, 'W15 보스 등장').toBeGreaterThanOrEqual(1);
    expect(reading.waves[20]?.bosses.length ?? 0, 'W20 보스 등장').toBeGreaterThanOrEqual(1);
  }
}

for (const cpuRate of [6, 1]) {
  test(`CPU ${cpuRate}배 · W1~W10 무정지 통주`, async ({ page, context }, testInfo) => {
    await runPerfPass(cpuRate, 10, page, context, testInfo);
  });
}

for (const cpuRate of [6, 1]) {
  test(`CPU ${cpuRate}배 · W1~W20 무정지 통주`, async ({ page, context }, testInfo) => {
    await runPerfPass(cpuRate, 20, page, context, testInfo);
  });
}
