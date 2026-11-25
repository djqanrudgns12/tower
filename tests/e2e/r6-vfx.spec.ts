import { mkdirSync, writeFileSync } from 'node:fs';
import type Phaser from 'phaser';
import type { RunController } from '../../src/application/RunController';
import type * as Sessions from '../../src/application/balanceSession';
import type * as QaGold from '../../src/application/qaGold';
import type * as Controllers from '../../src/application/RunController';
import type * as Content from '../../src/content';
import type * as Run from '../../src/domain/run';
import type { DomainEvent } from '../../src/domain/events';
import type { RunState } from '../../src/domain/types';
import type * as Geometry from '../../src/domain/geometry';
import type * as Bridges from '../../src/game/bridge';
import type * as Battlefield from '../../src/game/battlefieldGame';
import type { BattleScene } from '../../src/game/BattleScene';
import { expect, test, type Page } from './tower-browser';

const ids = ['rail', 'mortar', 'cryo', 'prism', 'hangar', 'bastion'] as const;
const slots = [2, 6, 11, 4, 15, 18];
const output = 'test-results/r6-vfx';

declare global {
  interface Window {
    qaVfx: {
      game: Phaser.Game;
      controller: RunController;
      bridge: Bridges.FieldBridgeHandle;
      state: RunState;
      events: DomainEvent[];
      near: (id: number) => void;
      begin: (id?: number) => void;
    };
  }
}

async function openBattle(page: Page, dense: boolean) {
  await page.route('**/r6-vfx-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><title>공격 효과 검사</title><div id="field" style="width:1200px;height:680px"></div></html>',
  }));
  await page.goto('/r6-vfx-fixture');
  await page.evaluate(async ({ urls, ids, slots, dense }) => {
    const [content, sessions, run, qaGold, controllers, bridges, field, geometry] = await Promise.all([
      import(urls.content) as Promise<typeof Content>,
      import(urls.sessions) as Promise<typeof Sessions>,
      import(urls.run) as Promise<typeof Run>,
      import(urls.qaGold) as Promise<typeof QaGold>,
      import(urls.controller) as Promise<typeof Controllers>,
      import(urls.bridge) as Promise<typeof Bridges>,
      import(urls.field) as Promise<typeof Battlefield>,
      import(urls.geometry) as Promise<typeof Geometry>,
    ]);
    await content.loadGradeContent(3);
    const session = sessions.localBalanceSession('2.0.0', 3, 'Normal', {
      runId: 'qa-r6-vfx', playerId: 'qa', nickname: '공격 효과 검사', seed: 1,
      rankingEligibility: 'personal', createdAt: '2026-11-25T00:00:00.000Z',
    });
    if (session.version !== '2.0.0') throw Error('R6 전장을 열지 못했습니다.');
    const { ctx, state } = session;
    state.wave = 15;
    state.completedWave = 14;
    state.phase = 'BUILD';
    state.owned = [...ids];
    qaGold.grantR6QaGold(state, 100_000);
    const pads = dense ? ctx.map.slots.map((_, i) => i) : slots;
    for (const [i, pad] of pads.entries()) {
      if (!run.applyCommand(ctx, state, { type: 'build', tower: ids[i % ids.length]!, slotId: ctx.map.slots[pad]!.id }).ok)
        throw Error(`타워를 설치하지 못했습니다. ${pad}`);
      state.towers.at(-1)!.level = 18;
    }
    if (!run.applyCommand(ctx, state, { type: 'startBattle' }).ok) throw Error('전투를 시작하지 못했습니다.');
    for (const tower of state.towers) tower.nextAttackTick = null;
    const battle = state.battle!;
    battle.intervalTicks = 1;
    while (battle.spawnIndex < battle.spawnList.length) run.advanceTick(ctx, state);
    if (!dense) {
      const ground = state.enemies.filter(e => !e.flying);
      state.enemies = [ground.find(e => e.kind === 'boss')!, ...ground.filter(e => e.kind !== 'boss').slice(0, 5)];
    }
    for (const [i, enemy] of state.enemies.entries()) {
      enemy.progress = 1800 + Math.floor(i * (ctx.path.length - 5200) / state.enemies.length);
      if (!dense) {
        enemy.speedBP = 0;
        // 종류별 장면을 비교하는 동안 표적이 남도록 전투 단위 시험과 같은 체력을 쓴다.
        enemy.maxHp = enemy.hp = 10_000_000;
      }
    }
    const controller = new controllers.RunController(ctx, state as RunState, { recordOnFinish: false });
    const bridge = new bridges.FieldBridgeHandle(controller);
    const events: DomainEvent[] = [];
    controller.onEvents(batch => events.push(...batch));
    const near = (id: number) => {
      const tower = state.towers.find(t => t.id === id)!;
      let distance = Infinity, nearest = 0;
      for (let i = 300; i < ctx.path.length - 1200; i += 100) {
        const p = geometry.positionAt(ctx.path, i);
        const d = (p.x - tower.x) ** 2 + (p.y - tower.y) ** 2;
        if (d < distance) { distance = d; nearest = i; }
      }
      state.projectiles.length = 0;
      for (const [i, enemy] of state.enemies.entries()) {
        const distance = [0, -450, 450, -900, 900, 1250][i]!;
        enemy.progress = Math.max(100, nearest + distance);
        enemy.hp = enemy.maxHp;
        enemy.slows = [];
      }
    };
    const begin = (id?: number) => {
      events.length = 0;
      for (const tower of state.towers) {
        tower.nextAttackTick = id === undefined || tower.id === id ? state.tick + 1 : null;
        tower.burst = null;
      }
      controller['step']();
      if (id !== undefined) state.towers.find(t => t.id === id)!.nextAttackTick = null;
    };
    await new Promise<void>(resolve => field.startBattlefield(document.getElementById('field')!, bridge, new AbortController().signal, game => {
      window.qaVfx = { game, controller, bridge, state: state as RunState, events, near, begin };
      resolve();
    }));
  }, { ids, slots, dense, urls: {
    content: '/src/content/index.ts', sessions: '/src/application/balanceSession.ts',
    run: '/src/domain/run.ts', qaGold: '/src/application/qaGold.ts',
    controller: '/src/application/RunController.ts', bridge: '/src/game/bridge.ts',
    field: '/src/game/battlefieldGame.ts', geometry: '/src/domain/geometry.ts',
  } });
  await expect.poll(() => page.evaluate(() => {
    const { game, state } = window.qaVfx;
    const scene = game.scene.getScene('battle');
    return state.towers.filter(t => scene?.children.getByName(`r6:tower:${t.id}:head`)).length;
  }), { timeout: 30_000 }).toBe(dense ? 20 : 6);
  await expect.poll(() => page.evaluate(() => window.qaVfx.game.textures.getTextureKeys().some(k => k.startsWith('r6.sheet.hangar-flight')))).toBe(true);
}

test('6종 타워가 실제 전투 사건에서 서로 다른 공격 효과를 그린다', async ({ page }) => {
  await openBattle(page, false);
  mkdirSync(output, { recursive: true });
  const timing: Record<typeof ids[number], number[]> = {
    rail: [0, 34, 68],
    mortar: [25, 145, 360],
    cryo: [34, 115, 235],
    prism: [140, 375, 620],
    hangar: [305, 550, 875],
    bastion: [28, 100, 205],
  };
  for (const type of ids) {
    const reading = await page.evaluate(async ({ type, marks }) => {
      const { game, controller, state, events, near, begin } = window.qaVfx;
      const tower = state.towers.find(t => String(t.type) === type)!;
      near(tower.id);
      const scene = game.scene.getScene('battle');
      const commands = (name: string) => (scene.children.getByName(name) as Phaser.GameObjects.Graphics | undefined)?.commandBuffer.length ?? 0;
      await new Promise<void>(resolve => game.events.once('postrender', () => resolve()));
      begin(tower.id);
      const samples: Array<{ image: string; air: number; ground: number; shell: number; drone: boolean }> = [];
      await new Promise<void>((resolve, reject) => {
        let start: number | undefined;
        let at = performance.now();
        const timeout = setTimeout(() => {
          game.events.off('postrender', frame);
          reject(Error(`${type} 효과를 캡처하지 못했습니다.`));
        }, 4000);
        function frame() {
          const now = performance.now();
          start ??= now;
          while (now - at >= 1000 / 30) { controller['step'](); at += 1000 / 30; }
          if (now - start < marks[samples.length]!) return;
          samples.push({
            image: game.canvas.toDataURL('image/webp', .93),
            air: commands('r6:vfx:air'), ground: commands('r6:vfx:ground'), shell: commands('r6:vfx:shell'),
            drone: Boolean((scene.children.getByName(`r6:tower:${tower.id}:drone`) as Phaser.GameObjects.Image | undefined)?.visible),
          });
          if (samples.length === marks.length) {
            clearTimeout(timeout);
            game.events.off('postrender', frame);
            setTimeout(resolve, 850);
          }
        }
        game.events.on('postrender', frame);
      });
      return { attacks: tower.attacks, types: events.map(e => e.type), samples };
    }, { type, marks: timing[type] });
    expect(reading.attacks, `${type} 첫 공격`).toBe(1);
    expect(reading.types).toContain(type === 'mortar' ? 'areaImpact' : 'strike');
    for (const [i, sample] of reading.samples.entries()) {
      expect(sample.image.startsWith('data:image/webp;base64,')).toBe(true);
      writeFileSync(`${output}/${type}-${i + 1}.webp`, Buffer.from(sample.image.split(',')[1]!, 'base64'));
    }
    if (type === 'mortar') {
      expect(reading.samples[0]!.shell).toBeGreaterThan(0);
      expect(reading.samples.at(-1)!.ground).toBeGreaterThan(0);
    } else if (type === 'cryo' || type === 'bastion') {
      expect(reading.samples.some(s => s.ground > 0)).toBe(true);
    } else if (type === 'hangar') {
      expect(reading.samples.every(s => s.drone)).toBe(true);
    } else {
      expect(reading.samples.some(s => s.air > 0)).toBe(true);
    }
  }
  const shake = await page.evaluate(async () => {
    const { game, bridge, state } = window.qaVfx;
    const scene = game.scene.getScene('battle') as BattleScene;
    const rail = state.towers.find(t => String(t.type) === 'rail')!;
    const boss = state.enemies.find(e => e.kind === 'boss')!;
    const event = { type: 'hit', enemyId: boss.id, x: rail.x, y: rail.y, damage: 1, towerType: rail.type } as const;
    bridge.update({ reducedMotion: true });
    scene['onEvents']([event]);
    const reduced = scene.cameras.main.shakeEffect.isRunning;
    await new Promise(resolve => setTimeout(resolve, 320));
    bridge.update({ reducedMotion: false });
    scene['onEvents']([event]);
    const full = scene.cameras.main.shakeEffect.isRunning;
    return { reduced, full };
  });
  expect(shake).toEqual({ reduced: false, full: true });
});

test('정답을 채점하면 문제판에 300ms 앰버 테두리가 붙는다', async ({ page }) => {
  await page.route(/\/\?qaRun=1$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<script type="module" src="/src/main.tsx"></script>', `<script type="module">
      import { loadGradeContent } from '/src/content/index.ts';
      import { localBalanceSession } from '/src/application/balanceSession.ts';
      await loadGradeContent(3);
      const { state, ctx } = localBalanceSession('2.0.0', 3, 'Normal', {
        runId: 'qa-r6-vfx-answer', playerId: 'qa', nickname: '정답 검사', seed: 1,
        rankingEligibility: 'personal', createdAt: '2026-11-25T00:00:00.000Z',
      });
      sessionStorage.setItem('vocabulary-td.qaRun', JSON.stringify(state));
      document.documentElement.dataset.qaChoice = ctx.questions.get(state.quiz.current.questionId).correctOptionId;
      await import('/src/main.tsx');
    </script>`);
    await route.fulfill({ response, body });
  });
  await page.goto('/?qaRun=1');
  await page.getByRole('button', { name: '계속하기' }).click();
  const card = page.getByRole('region', { name: '어휘 문제' });
  const id = await page.locator('html').getAttribute('data-qa-choice');
  await card.locator(`[data-option-id="${id}"]`).click();
  const pulse = card.locator('[class*="correctPulse"]');
  await expect(pulse).toHaveCount(1);
  await expect(pulse).toHaveCSS('animation-duration', '0.3s');
  await expect(pulse).toHaveCSS('border-top-color', 'rgb(230, 159, 36)');
});

test('CPU 4배 감속으로 밀집 W15의 실제 전장 렌더 속도를 기록한다', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openBattle(page, true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const result = await page.evaluate(() => new Promise<{
    fps: number; frames: number; p95Ms: number; quality: number[]; enemies: number; bosses: number;
    wave: number; attacks: number; renderer: string; towers: number; elapsedMs: number; ticks: number;
  }>(resolve => {
    const { game, controller, state, begin } = window.qaVfx;
    const { gl } = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const quality = new Set<number>(), intervals: number[] = [];
    const enemies = state.enemies.length, bosses = state.enemies.filter(e => e.kind === 'boss').length;
    let start = 0, last = 0;
    const startTick = state.tick;
    const onFrame = () => {
      const now = performance.now();
      if (!start) { start = last = now; return; }
      intervals.push(now - last);
      last = now;
      quality.add(controller.renderQuality.current);
      if (now - start < 6000) return;
      game.events.off('postrender', onFrame);
      controller.stop();
      const sorted = intervals.toSorted((a, b) => a - b);
      resolve({
        fps: Number((intervals.length * 1000 / (now - start)).toFixed(2)),
        frames: intervals.length, p95Ms: Number(sorted[Math.ceil(sorted.length * .95) - 1]!.toFixed(1)),
        quality: [...quality], enemies, bosses, wave: state.wave, towers: state.towers.length,
        attacks: state.towers.reduce((sum, t) => sum + t.attacks, 0), elapsedMs: now - start, ticks: state.tick - startTick,
        renderer: String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
      });
    };
    begin();
    game.events.on('postrender', onFrame);
    controller.start();
  }));
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/wave15-cpu4.json`, JSON.stringify({ cpuRate: 4, ...result }, null, 2));
  console.log(`밀집 W${result.wave} · 적 ${result.enemies}기 · 타워 ${result.towers}기 · ${result.fps}fps · p95 ${result.p95Ms}ms`);
  expect(result.wave).toBe(15);
  expect(result.enemies).toBeGreaterThanOrEqual(25);
  expect(result.bosses).toBeGreaterThan(0);
  expect(result.attacks).toBeGreaterThan(20);
  expect(result.ticks).toBeGreaterThan(60);
  expect(errors).toEqual([]);
});
