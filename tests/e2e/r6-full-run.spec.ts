import { writeFileSync } from 'node:fs';
import type Phaser from 'phaser';
import type { RunController } from '../../src/application/RunController';
import type * as Db from '../../src/persistence/db';
import type { BattleScene } from '../../src/game/BattleScene';
import type { R6Manifest } from '../../src/game/r6/manifest';
import type { R6TowerId } from '../../src/contracts/balanceV2';
import type * as Sim from '../../tools/sim/balanceSim';
import type * as Relics from '../../src/domain/relics';
import { expect, test } from './tower-browser';

const runId = 'r6-g3-normal-1';
const targetWave = 15;

// 프레임 캡처가 WebGL 읽기를 강제하면 실제 렌더 속도 측정에 영향을 준다.
test.use({
  trace: { mode: 'retain-on-failure', screenshots: false },
  ...(process.platform === 'darwin' ? { channel: 'chromium', launchOptions: { args: ['--use-angle=metal'] } } : {}),
});

interface WaveReading {
  species: string[];
  tiers: number[];
  bosses: string[];
  renderedBosses: string[];
  completed: boolean;
}

interface StageReading {
  tower: string;
  level: number;
  stage: number | null;
  weapon: number | null;
  image: '일치' | '임시 표시' | '누락';
}

interface RunReading {
  waves: Record<number, WaveReading>;
  stages: StageReading[];
  unlocks: Array<{ wave: number; tower: string }>;
  pauses: string[];
  frames: number;
  elapsedMs: number;
  tick: number;
  maxLevel: number;
  completedWave: number;
  correct: number;
  wrong: number;
  renderer: string;
  failure: string | null;
}

declare global {
  interface Window {
    r6RunController: RunController;
    r6RunScene: BattleScene;
    r6RunReading: RunReading;
    r6RunEnd: boolean;
  }
}

test('보통 난이도에서 정답률 80%로 15웨이브를 지키고 결과를 저장한다', async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.TOWER_R6_FULL_RUN !== '1', '실시간 통주는 TOWER_R6_FULL_RUN=1로 실행합니다.');
  test.setTimeout(25 * 60_000);
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
    if (message.text().startsWith('통주 · ')) console.log(message.text());
  });

  // 공유 폴더를 작업하는 동안의 Vite 새로고침이 진행 중인 판에 들어오지 않게 한다.
  const devHost = new URL(baseURL!).host;
  await page.routeWebSocket(url => url.host === devHost, () => undefined);
  // 고정 시드의 새 상태만 주입한다. 재개 이후에는 앱의 컨트롤러와 렌더러가 정상 속도로 실행된다.
  await page.route(/\/\?qaRun=1$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '<script type="module" src="/src/main.tsx"></script>',
      `<script type="module">
        import { loadGradeContent } from '/src/content/index.ts';
        import { localBalanceSession } from '/src/application/balanceSession.ts';
        import { RunController } from '/src/application/RunController.ts';
        import { BattleScene } from '/src/game/BattleScene.ts';
        import { loadSettings, saveSettings } from '/src/persistence/settings.ts';
        saveSettings({ ...loadSettings(), shareRecords: false });
        await loadGradeContent(3);
        const { state } = localBalanceSession('2.0.0', 3, 'Normal', {
          runId: '${runId}', playerId: 'qa', nickname: '전장 점검', seed: 1, rankingEligibility: 'personal',
          createdAt: new Date().toISOString(),
        });
        sessionStorage.setItem('vocabulary-td.qaRun', JSON.stringify(state));
        const start = RunController.prototype.start;
        RunController.prototype.start = function () {
          window.r6RunController = this;
          start.call(this);
        };
        const create = BattleScene.prototype.create;
        BattleScene.prototype.create = function () {
          create.call(this);
          window.r6RunScene = this;
        };
        await import('/src/main.tsx');
      </script>`,
    );
    await route.fulfill({ response, body });
  });
  await page.goto('/?qaRun=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.r6RunScene))).toBe(true);
  await page.evaluate(async ({ simUrl, relicsUrl, stopAt }) => {
    const [sim, { relicContext }] = await Promise.all([
      import(simUrl) as Promise<typeof Sim>,
      import(relicsUrl) as Promise<typeof Relics>,
    ]);
    const controller = window.r6RunController;
    const scene = window.r6RunScene;
    const manifest = scene.cache.json.get('r6.manifest') as R6Manifest;
    const { gl } = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER));
    console.log(`통주 · 렌더러 ${renderer}`);
    const player = sim.createPlayer({
      mapId: controller.ctx.map.id, difficulty: 'Normal', balance: controller.ctx.balance,
      accuracy: 0.8, readSec: 2, strategy: 'balanced', seed: 1,
      towers: [...controller.state.config.availableTowers],
      policy: { ...sim.STRATEGIES.balanced, pattern: ['rail', 'rail', 'mortar', 'cryo', 'rail', 'mortar', 'rail', 'mortar'] as Sim.Strategy['pattern'] },
    });
    const reading: RunReading = {
      waves: {}, stages: [], unlocks: [], pauses: [], frames: 0, elapsedMs: 0,
      tick: 0, maxLevel: 0, completedWave: 0, correct: 0, wrong: 0, renderer, failure: null,
    };
    window.r6RunReading = reading;
    let started = 0;
    let lastTickAt = 0;
    let measuredTick = -1;
    let nextTrade = 0;
    let lastEncounter = -1;
    let answerTick = 0;
    let queuedAnswer = -1;
    let pausedAt = 0;
    let pendingArt: Array<{ towerId: number; deadline: number; entry: StageReading }> = [];
    const pendingBosses = new Map<number, { wave: WaveReading; entity: string }>();
    const offEvents = controller.onEvents(events => {
      const s = controller.state;
      const waveNo = events.find(e => e.type === 'waveComplete')?.wave ?? s.wave;
      const wave = reading.waves[waveNo] ??= { species: [], tiers: [], bosses: [], renderedBosses: [], completed: false };
      for (const event of events) {
        if (event.type === 'spawn' && event.entityId && !event.derived) {
          if (event.kind === 'boss') {
            wave.bosses.push(event.entityId);
            pendingBosses.set(event.enemyId, { wave, entity: event.entityId });
          } else {
            const tier = Number(event.entityId.at(-1));
            if (!wave.species.includes(event.faction)) wave.species.push(event.faction);
            if (!wave.tiers.includes(tier)) wave.tiers.push(tier);
          }
        } else if (event.type === 'towerUnlocked') {
          reading.unlocks.push({ wave: event.wave, tower: event.tower });
        } else if (event.type === 'towerBuilt' || event.type === 'towerUpgraded') {
          const tower = s.towers.find(t => t.id === event.towerId)!;
          reading.maxLevel = Math.max(reading.maxLevel, tower.level);
          if (tower.level !== 1 && tower.level % 2 !== 0) continue;
          const change = events.find(e => e.type === 'towerStage' && e.towerId === tower.id);
          pendingArt.push({
            towerId: tower.id,
            deadline: performance.now() + 4000,
            entry: {
              tower: tower.type, level: tower.level, stage: change?.type === 'towerStage' ? change.stage : null,
              weapon: change?.type === 'towerStage' ? change.weapon : null, image: '누락',
            },
          });
        } else if (event.type === 'waveComplete') {
          wave.completed = true;
          console.log(`통주 · W${event.wave} 완료 · 성문 ${s.gateHp} · 최고 Lv${reading.maxLevel}`);
        }
      }
    });
    const rendered = () => {
      if (!started) return;
      reading.frames++;
      for (const [enemyId, { wave, entity }] of pendingBosses) {
        if (scene.children.getByName(`r6:enemy:${enemyId}`)) {
          wave.renderedBosses.push(entity);
          pendingBosses.delete(enemyId);
        }
      }
      pendingArt = pendingArt.filter(({ towerId, deadline, entry }) => {
        const form = manifest.towers[entry.tower as R6TowerId]?.[Math.floor(entry.level / 2)];
        const body = scene.children.getByName(`r6:tower:${towerId}:body`) as Phaser.GameObjects.Image | undefined;
        const head = scene.children.getByName(`r6:tower:${towerId}:head`) as Phaser.GameObjects.Image | undefined;
        if (!form && scene.children.getByName(`r6:tower:${towerId}:placeholder`)) entry.image = '임시 표시';
        else if (form && body?.texture.key === `r6.sheet.${form.body}` && Number(body.frame.name) === form.bodyFrame) {
          const attack = form.attack;
          const fireSheets = 'sheets' in attack && Array.isArray(attack.sheets) ? attack.sheets
            : 'clip' in attack && attack.clip ? [attack.clip.sheet] : [];
          if ([form.head, ...fireSheets].some(id => head?.texture.key === `r6.sheet.${id}`)) entry.image = '일치';
        }
        if (entry.image === '누락' && performance.now() < deadline) return true;
        reading.stages.push(entry);
        return false;
      });
    };
    scene.game.events.on('postrender', rendered);

    const step = (now: number) => {
      const s = controller.state;
      if (!started && s.pause.includes('USER')) { requestAnimationFrame(step); return; }
      if (!started) started = lastTickAt = now;
      reading.elapsedMs = now - started;
      reading.completedWave = s.completedWave;
      reading.correct = s.stats.correct;
      reading.wrong = s.stats.wrong;
      reading.tick = s.tick;
      if (s.phase === 'GAME_OVER') {
        window.r6RunEnd = true;
      } else if (s.pause.length) {
        const reason = `W${s.wave} · ${s.phase} · ${s.pause.join(', ')}`;
        // 자동 정지도 결함으로 남긴다. 재개 가능한 경우 나머지 웨이브 검사는 계속한다.
        if (s.pause.length === 1 && s.pause[0] === 'PERFORMANCE') {
          pausedAt ||= now;
          const resume = document.querySelector<HTMLButtonElement>('[aria-labelledby="pause-title"] button');
          if (resume && now - pausedAt >= 1500) {
            reading.pauses.push(reason);
            console.log(`통주 · ${reason} · 계속하기로 재개`);
            resume.click();
            lastTickAt = now;
            pausedAt = 0;
          } else if (now - pausedAt > 4000) reading.failure = reason;
        } else reading.failure = reason;
      } else if (now - lastTickAt > 4000) {
        reading.failure = `W${s.wave} · ${s.phase} · 4초 동안 논리 틱 정지`;
      } else if (s.tick !== measuredTick) {
        lastTickAt = now;
        measuredTick = s.tick;
        const send = (command: Parameters<RunController['dispatch']>[0]) => {
          const result = controller.dispatch(command);
          if (!result.ok) reading.failure = `W${s.wave} · ${command.type} · ${result.error}`;
        };
        const unlock = document.querySelector<HTMLButtonElement>('[aria-labelledby="tower-unlock-title"] button');
        const relic = document.querySelector<HTMLButtonElement>('[aria-labelledby="r6-relic-title"] button:not([role="radio"])');
        const encounter = s.quiz.current;
        const feedback = s.quiz.feedback;
        if (s.completedWave >= stopAt) {
          if (pendingArt.length === 0) send({ type: 'quit' });
        } else if (unlock) unlock.click();
        else if (relic) relic.click();
        else if (encounter && !encounter.answer && encounter.id !== queuedAnswer) {
          if (lastEncounter !== encounter.id) { lastEncounter = encounter.id; answerTick = s.tick + 60; }
          if (s.tick >= answerTick) {
            const question = controller.ctx.questions.get(encounter.questionId)!;
            const correct = (s.stats.correct + s.stats.wrong + 1) % 5 !== 0;
            const choice = correct ? question.correctOptionId : question.options.find(o => o.id !== question.correctOptionId)!.id;
            send({ type: 'answer', encounterId: encounter.id, choice });
            queuedAnswer = encounter.id;
          }
        } else if (feedback && feedback.autoAdvanceTick === null && feedback.nextEnabledTick !== null &&
          s.tick >= feedback.nextEnabledTick) {
          send({ type: 'next', encounterId: feedback.encounterId });
        } else if ((s.phase === 'BUILD' || s.phase === 'BATTLE') && s.tick >= nextTrade) {
          const choice = sim.bestOption(sim.greedyOptions({ ...player, ctx: relicContext(controller.ctx, s), s }));
          if (choice && choice.cost <= s.gold) {
            const command = choice.cmd;
            // 실제 프레임에 각 형태가 한 번씩 그려지도록 한 틱에 한 번만 거래한다.
            if (command.type !== 'upgrade' || !pendingArt.some(art => art.towerId === command.towerId)) send(command);
            nextTrade = s.tick + 6;
          } else if (s.phase === 'BUILD') send({ type: 'startBattle' });
          else nextTrade = s.tick + 240;
        }
      }
      if (window.r6RunEnd || reading.failure) {
        offEvents();
        scene.game.events.off('postrender', rendered);
      } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { simUrl: '/tools/sim/balanceSim.ts', relicsUrl: '/src/domain/relics.ts', stopAt: targetWave });
  await page.getByRole('button', { name: '계속하기' }).click();
  await page.waitForFunction(() => window.r6RunEnd || window.r6RunReading.failure, null, { timeout: 24 * 60_000 });
  const reading = await page.evaluate(() => window.r6RunReading);
  const reportPath = testInfo.outputPath('run.json');
  writeFileSync(reportPath, JSON.stringify({ ...reading, errors, warnings }, null, 2));
  await testInfo.attach('통주 측정', { path: reportPath, contentType: 'application/json' });
  const fps = 1000 * reading.frames / reading.elapsedMs;
  console.log(`통주 · W${reading.completedWave} · ${(reading.elapsedMs / 1000).toFixed(1)}초 · ${fps.toFixed(2)}fps · 정답 ${reading.correct} · 오답 ${reading.wrong} · 오류 ${errors.length} · 경고 ${warnings.length} · 자동 정지 후 재개 ${reading.pauses.length}회`);
  expect(reading.failure).toBeNull();
  expect(reading.completedWave).toBe(targetWave);
  await expect(page.getByRole('status').filter({ hasText: '기록 저장됨' })).toBeVisible();
  const records = await page.evaluate(async url => (await (import(url) as Promise<typeof Db>)).listRecords(), '/src/persistence/db.ts');
  expect(records).toContainEqual(expect.objectContaining({
    runId, balanceVersion: '2.0.0', difficulty: 'Normal', completedWave: targetWave, endReason: 'QUIT',
  }));
  expect(reading.unlocks).toEqual([
    { wave: 3, tower: 'prism' }, { wave: 6, tower: 'hangar' }, { wave: 9, tower: 'bastion' },
  ]);
  for (let wave = 1; wave <= targetWave; wave++) {
    const observed = reading.waves[wave]!;
    expect(observed.completed, `W${wave}`).toBe(true);
    expect(observed.species, `W${wave} 종족`).toHaveLength(wave <= 3 ? 2 : wave <= 6 ? 3 : wave <= 10 ? 4 : 5);
    expect(observed.tiers.sort(), `W${wave} 단계`).toEqual(wave <= 3 ? [1] : wave <= 6 ? [1, 2] : [2, 3]);
    expect(observed.bosses, `W${wave} 보스`).toHaveLength(wave % 5 === 0 ? 1 : 0);
    expect(observed.renderedBosses, `W${wave} 보스 표시`).toEqual(observed.bosses);
  }
  expect(reading.correct).toBe(Math.ceil((reading.correct + reading.wrong) * 0.8));
  expect(reading.stages.some(e => e.image === '일치' && e.level >= 6)).toBe(true);
  expect(reading.stages.filter(e => e.image === '누락')).toEqual([]);
  for (const stage of reading.stages.filter(e => e.level > 1)) {
    expect(stage.stage, `${stage.tower} Lv${stage.level}`).toBe(stage.level / 2);
    expect(stage.weapon, `${stage.tower} Lv${stage.level}`).toBe(Math.min(4, Math.floor(stage.level / 6) + 1));
  }
  expect(errors).toEqual([]);
  expect(reading.pauses, '통주 중 자동 정지 횟수').toHaveLength(0);
});
