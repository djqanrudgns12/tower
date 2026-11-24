import { readFileSync, writeFileSync } from 'node:fs';
import type Phaser from 'phaser';
import type { SpineGameObject } from '@esotericsoftware/spine-phaser-v4';
import type { RunController } from '../../src/application/RunController';
import type * as Content from '../../src/content';
import type * as Run from '../../src/domain/run';
import type * as Sessions from '../../src/application/balanceSession';
import type * as Mixer from '../../src/domain/r6Mixer';
import type * as Battlefield from '../../src/game/battlefieldGame';
import type * as Controller from '../../src/application/RunController';
import type * as Bridge from '../../src/game/bridge';
import type * as QaGold from '../../src/application/qaGold';
import type { RunState } from '../../src/domain/types';
import type { R6Manifest } from '../../src/game/r6/manifest';
import { expect, test, type Page } from './tower-browser';

declare global {
  interface Window {
    r6Field: {
      game: Phaser.Game;
      controller: RunController;
      activeSpecies: string[];
      readyNextWave: () => void;
      showWavePreview: () => Record<string, number>;
    };
  }
}

async function openField(page: Page, r6: boolean, progression = false) {
  await page.route('**/r6-battlefield-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="ko"><meta charset="utf-8"><title>전장 검사</title><div id="field" style="width:960px;height:576px"></div>${progression ? '<section aria-label="웨이브 미리보기"><ul id="preview"></ul></section>' : ''}</html>`,
  }));
  if (r6 && !progression) await page.route('**/assets/r6/manifest-v2.json', async route => {
    const manifest = JSON.parse(readFileSync('public/assets/r6/manifest-v2.json', 'utf8')) as R6Manifest;
    const active = await page.evaluate(() => window.r6Field.activeSpecies);
    // 호출돼서는 안 될 비등장 종족의 독립 아틀라스. 제품 파일은 공통 임시 아틀라스를 쓴다.
    manifest.atlases.inactive = 'inactive/unused.atlas';
    for (const [id, pack] of Object.entries(manifest.species)) if (!active.includes(id)) pack.atlas = 'inactive';
    await route.fulfill({ json: manifest });
  });
  await page.goto('/r6-battlefield-fixture');
  await page.evaluate(async ({ r6, progression, urls }) => {
    const [content, domains, sessions, mixer, battle, controllerModule, bridgeModule] = await Promise.all([
      import(urls.content) as Promise<typeof Content>,
      import(urls.run) as Promise<typeof Run>,
      import(urls.sessions) as Promise<typeof Sessions>,
      import(urls.mixer) as Promise<typeof Mixer>,
      import(urls.battle) as Promise<typeof Battlefield>,
      import(urls.controller) as Promise<typeof Controller>,
      import(urls.bridge) as Promise<typeof Bridge>,
    ]);
    await content.loadGradeContent(3);
    const seed = progression ? 1 : content.PRACTICE.seed;
    const selected = sessions.localBalanceSession(r6 ? '2.0.0' : '1.0.0', 3, 'Easy', {
      runId: 'qa-전장', playerId: 'qa', nickname: '전장 검사', seed, rankingEligibility: 'personal',
      createdAt: '2026-11-25T00:00:00.000Z',
    });
    const { ctx } = selected;
    // 현재 RunController의 공개 타입은 v1이다. 도메인 리듀서는 v2 타워를 판별한다.
    const state = selected.state as RunState;
    function advanceToBuild(maxTicks: number) {
      for (let i = 0; i < maxTicks && state.phase !== 'BUILD' && state.phase !== 'GAME_OVER'; i++) {
        const encounter = state.quiz.current;
        if (encounter && !encounter.answer) {
          const result = domains.applyCommand(ctx, state, {
            type: 'answer', encounterId: encounter.id, choice: ctx.questions.get(encounter.questionId)!.correctOptionId,
          });
          if (!result.ok) throw new Error(`시험 답안 거절 · ${result.error}`);
        }
        domains.advanceTick(ctx, state);
      }
      if (state.phase !== 'BUILD') throw new Error(`설치 단계에 도달하지 못했습니다. ${state.wave}웨이브 · ${state.phase}`);
    }
    advanceToBuild(240);
    if (progression) {
      const { grantR6QaGold } = await import(urls.qaGold) as typeof QaGold;
      grantR6QaGold(state, 100_000);
    }
    const controller = new controllerModule.RunController(ctx, state, { recordOnFinish: false });
    const bridge = new bridgeModule.FieldBridgeHandle(controller);
    const tower = (r6 ? 'rail' : 'archer') as RunState['owned'][number];
    bridge.onTap = tap => {
      if (tap.kind === 'slot') {
        const result = controller.dispatch({ type: 'build', slotId: tap.slotId, tower });
        if (!result.ok) throw new Error(result.error);
      }
    };
    const r6Rules = ctx.balance.r6?.rules;
    const activeSpecies = r6Rules ? [...new Set(mixer.previewR6Wave(r6Rules, ctx.map.id, seed, 1).map(e => e.species))] : [];
    await new Promise<void>(resolve => battle.startBattlefield(document.getElementById('field')!, bridge, new AbortController().signal, game => {
      window.r6Field = {
        game, controller, activeSpecies,
        // 전투 상태를 덮어쓰지 않고 브라우저에서 엔진의 실제 논리 틱을 돌린다.
        readyNextWave: () => advanceToBuild(5000),
        showWavePreview() {
          if (selected.version !== '2.0.0' || !r6Rules) throw new Error('R6 미리보기에는 새 밸런스 판이 필요합니다');
          const bySpecies = new Map<Mixer.MixedEnemy['species'], number>();
          for (const { species } of mixer.previewR6Wave(r6Rules, ctx.map.id, seed, state.wave)) {
            bySpecies.set(species, (bySpecies.get(species) ?? 0) + 1);
          }
          const list = document.getElementById('preview')!;
          list.replaceChildren();
          for (const [species, count] of bySpecies) {
            const item = document.createElement('li');
            item.textContent = `${selected.theme.species[species].name} ${count}마리`;
            list.append(item);
          }
          return Object.fromEntries(bySpecies);
        },
      };
      resolve();
    }));
  }, { r6, progression, urls: {
    content: '/src/content/index.ts', run: '/src/domain/run.ts', sessions: '/src/application/balanceSession.ts',
    mixer: '/src/domain/r6Mixer.ts', battle: '/src/game/battlefieldGame.ts', controller: '/src/application/RunController.ts', bridge: '/src/game/bridge.ts',
    qaGold: '/src/application/qaGold.ts',
  } });
}

async function railBody(page: Page) {
  return page.evaluate(() => {
    const { controller, game } = window.r6Field;
    const tower = controller.state.towers[0];
    const body = tower && game.scene.getScene('battle').children.getByName(`r6:tower:${tower.id}:body`) as Phaser.GameObjects.Image | undefined;
    return tower && body ? { slot: tower.slotId, level: tower.level, sheet: body.texture.key, frame: Number(body.frame.name) } : null;
  });
}

test('초원 고원에서 설치·진화·포두 발사·Spine 보행을 재생하고 4배 감속을 측정한다', async ({ page, browser }, testInfo) => {
  await page.setViewportSize({ width: 1032, height: 648 });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await openField(page, true);
  const canvas = page.locator('#field canvas');
  await expect(canvas).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.r6Field.game.textures.exists('r6.atlas.g2-walker!walker.webp'))).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.r6Field.game.scene.getScene('battle');
    return scene.children.getAll().some(object => 'texture' in object && (object as Phaser.GameObjects.Image).texture.key === 'r6.ground');
  })).toBe(true);
  expect(requests.filter(url => url.endsWith('/walker.atlas'))).toHaveLength(1);
  expect(requests.some(url => url.includes('/inactive/'))).toBe(false);
  expect(requests.some(url => url.endsWith('/assets/manifest.json'))).toBe(false);

  await canvas.click({ position: { x: 32, y: 32 } });
  await expect.poll(() => railBody(page)).toEqual({ slot: 'garden_u-s01', level: 1, sheet: 'r6.sheet.rail-bodies', frame: 0 });
  expect(await page.evaluate(() => {
    const { controller } = window.r6Field;
    return controller.dispatch({ type: 'upgrade', towerId: controller.state.towers[0]!.id }).ok;
  })).toBe(true);
  await expect.poll(() => railBody(page)).toMatchObject({ level: 2, frame: 1 });

  const headFrame = () => page.evaluate(() => {
    const { controller, game } = window.r6Field;
    const towerId = controller.state.towers[0]!.id;
    const head = game.scene.getScene('battle').children.getByName(`r6:tower:${towerId}:head`) as Phaser.GameObjects.Image;
    return Number(head.frame.name);
  });
  const restingDirection = await headFrame();
  expect(restingDirection).toBeGreaterThanOrEqual(0);
  expect(restingDirection).toBeLessThan(16);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    expect(await page.evaluate(() => {
      const { controller } = window.r6Field;
      const result = controller.dispatch({ type: 'startBattle' });
      controller.start();
      return result.ok;
    })).toBe(true);
    const readWalker = () => page.evaluate(() => {
      const scene = window.r6Field.game.scene.getScene('battle');
      const unit = scene.children.getAll().find(object => object.name.startsWith('r6:enemy:')) as SpineGameObject | undefined;
      const track = unit?.animationState.getTrack(0);
      return unit && track ? { name: unit.name, x: unit.x, renderer: unit.rendererType, time: track.trackTime } : null;
    });
    await expect.poll(readWalker).toMatchObject({ renderer: 'phaser' });
    const first = (await readWalker())!;
    await expect.poll(async () => {
      const next = await readWalker();
      return next?.name === first.name && next.x > first.x + 5 && next.time > first.time;
    }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.r6Field.controller.state.towers[0]!.attacks)).toBeGreaterThan(0);
    await expect.poll(headFrame).not.toBe(restingDirection);

    const stats = await page.evaluate(() => new Promise<{ fps: number; frames: number; p95Ms: number; end: string; renderer: string }>(resolve => {
      const { game } = window.r6Field;
      const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      const gl = renderer.gl;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const intervals: number[] = [];
      let start: number | undefined;
      let previous: number | undefined;
      const onFrame = (_renderer: unknown, time: number) => {
        start ??= time;
        if (previous !== undefined) intervals.push(time - previous);
        previous = time;
        if (time - start < 5000) return;
        game.events.off('postrender', onFrame);
        const sorted = intervals.toSorted((a, b) => a - b);
        resolve({
          fps: intervals.length * 1000 / (time - start), frames: intervals.length,
          p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
          end: game.canvas.toDataURL('image/webp', 0.94),
          renderer: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
        });
      };
      game.events.on('postrender', onFrame);
    }));
    expect(errors).toEqual([]);
    expect(stats.frames).toBeGreaterThan(0);
    expect(stats.end).toMatch(/^data:image\/webp;base64,/);
    const capture = testInfo.outputPath('meadow-plateau.webp');
    writeFileSync(capture, Buffer.from(stats.end.split(',')[1]!, 'base64'));
    const metrics = { cpuRate: 4, fps: Number(stats.fps.toFixed(2)), p95Ms: Number(stats.p95Ms.toFixed(2)),
      frames: stats.frames, chromium: browser.version(), renderer: stats.renderer };
    await testInfo.attach('크롬북 감속 측정', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
    await testInfo.attach('초원 고원', { path: capture, contentType: 'image/webp' });
    console.log(`초원 고원 · ${metrics.fps} FPS · p95 ${metrics.p95Ms}ms · ${metrics.frames}프레임 · ${metrics.chromium} · ${metrics.renderer}\n캡처 ${capture}`);
  } finally {
    await cdp.detach();
    await page.evaluate(() => { window.r6Field.controller.stop(); window.r6Field.game.destroy(true); });
  }
});

test('R6 새 판에서 레일 포탑 11형태, 웨이브 해금 순서와 종족 예고를 확인한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1032, height: 760 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openField(page, true, true);
  const canvas = page.locator('#field canvas');
  const readRun = () => page.evaluate(() => {
    const { state } = window.r6Field.controller;
    return { owned: state.owned, version: state.config.balanceVersion, wave: state.wave, completed: state.completedWave };
  });
  const owned = ['rail', 'mortar', 'cryo'];
  expect(await readRun()).toEqual({ owned, version: '2.0.0', wave: 1, completed: 0 });
  const position = { x: 5.5 * 64, y: 4.5 * 64 };
  const padEdge = () => page.evaluate(({ x, y }) => new Promise<number>(resolve => {
    const { game } = window.r6Field;
    game.events.once('postrender', () => {
      const { gl } = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      const rgba = new Uint8Array(4);
      gl.readPixels(x, game.canvas.height - 1 - (y - 18), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      resolve(rgba[0]! + rgba[1]! + rgba[2]!);
    });
  }), position);
  await expect.poll(padEdge).toBeGreaterThan(50);
  const idle = await padEdge();
  await canvas.hover({ position });
  await expect.poll(padEdge).toBeGreaterThan(idle + 200);
  await page.mouse.move(1020, 300);
  await expect.poll(padEdge).toBe(idle);
  await canvas.click({ position });
  const pathFrames = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10];
  for (const [index, frame] of pathFrames.entries()) {
    const level = index + 1;
    if (level > 1) expect(await page.evaluate(() => {
      const { controller } = window.r6Field;
      return controller.dispatch({ type: 'upgrade', towerId: controller.state.towers[0]!.id }).ok;
    })).toBe(true);
    await expect.poll(() => railBody(page), { message: `Lv${level} 몸체` }).toMatchObject({ level, frame, sheet: 'r6.sheet.rail-bodies' });
  }
  expect(await page.evaluate(() => {
    const { controller } = window.r6Field;
    return controller.dispatch({ type: 'upgrade', towerId: controller.state.towers[0]!.id });
  })).toEqual({ ok: false, error: 'MAX_LEVEL' });
  // WebGL 버퍼는 프레임이 끝나면 지워지므로 그린 직후 캡처한다.
  const capture = await page.evaluate(() => new Promise<string>(resolve => {
    const { game } = window.r6Field;
    game.events.once('postrender', () => resolve(game.canvas.toDataURL('image/webp', 0.94)));
  }));
  expect(capture).toMatch(/^data:image\/webp;base64,/);
  const path = testInfo.outputPath('rail-lv20.webp');
  const webp = Buffer.from(capture.split(',')[1]!, 'base64');
  expect(webp.length).toBeGreaterThan(10_000);
  writeFileSync(path, webp);
  await testInfo.attach('레일 포탑 Lv20', { path, contentType: 'image/webp' });

  // 해금은 전투에서 실제로 웨이브를 지켜 연다. 남은 칸에도 초기 설치권으로 보강한다.
  await page.evaluate(() => {
    const { controller } = window.r6Field;
    const main = controller.state.towers[0]!;
    for (const slot of controller.ctx.map.slots) {
      if (slot.id === main.slotId) continue;
      const build = controller.dispatch({ type: 'build', tower: 'mortar', slotId: slot.id });
      if (!build.ok) throw Error(`곡사 포대 설치 · ${build.error}`);
      const id = controller.state.towers.at(-1)!.id;
      for (let level = 1; level < 8; level++) {
        const upgrade = controller.dispatch({ type: 'upgrade', towerId: id });
        if (!upgrade.ok) throw Error(`곡사 포대 강화 · ${upgrade.error}`);
      }
    }
  });
  const preview = page.getByRole('region', { name: '웨이브 미리보기' });
  const expectedNames: Record<number, RegExp> = {
    1: /^(바위 거인|기계 군단) 12마리$/,
    4: /^(바위 거인 6|기계 군단 13|군체 벌레 6)마리$/,
    7: /^(바위 거인 5|기계 군단 5|군체 벌레 11|숲 엘프 5)마리$/,
  };
  const unlockAt: Record<number, string> = { 3: 'prism', 6: 'hangar', 9: 'bastion' };
  for (let wave = 1; wave <= 9; wave++) {
    const forecast = await page.evaluate(() => window.r6Field.showWavePreview());
    const names = expectedNames[wave];
    if (names) await expect(preview.getByRole('listitem').filter({ hasText: names })).toHaveCount(wave === 1 ? 2 : wave === 4 ? 3 : 4);
    const scheduled = await page.evaluate(() => {
      const { controller } = window.r6Field;
      const started = controller.dispatch({ type: 'startBattle' });
      if (!started.ok) throw Error(`전투 시작 · ${started.error}`);
      const counts: Record<string, number> = {};
      for (const enemy of controller.state.battle!.spawnList) {
        const species = enemy.faction!;
        counts[species] = (counts[species] ?? 0) + 1;
      }
      return counts;
    });
    expect(scheduled, `${wave}웨이브 편성`).toEqual(forecast);
    await page.evaluate(() => window.r6Field.readyNextWave());
    const unlocked = unlockAt[wave];
    if (unlocked) owned.push(unlocked);
    expect(await readRun()).toEqual({ owned, version: '2.0.0', wave: wave + 1, completed: wave });
  }
  await page.evaluate(() => window.r6Field.showWavePreview());
  await expect(preview.getByRole('listitem')).toHaveText(['바위 거인 12마리', '군체 벌레 5마리', '기계 군단 5마리', '숲 엘프 5마리']);
  expect(errors).toEqual([]);
  await page.evaluate(() => { window.r6Field.controller.dispose(); window.r6Field.game.destroy(true); });
});

test('이전 계약은 기존 전장과 에셋을 사용한다', async ({ page }) => {
  await page.setViewportSize({ width: 1032, height: 648 });
  const r6Requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/assets/r6/')) r6Requests.push(request.url()); });
  await openField(page, false);
  await expect.poll(() => page.evaluate(() => {
    const { game } = window.r6Field;
    return game.textures.exists('map.ground') && Boolean(game.scene.getScene('battle').children);
  })).toBe(true);
  await page.locator('#field canvas').click({ position: { x: 32, y: 32 } });
  await expect.poll(() => page.evaluate(() => window.r6Field.controller.state.towers[0]?.type)).toBe('archer');
  expect(r6Requests).toEqual([]);
  await page.evaluate(() => window.r6Field.game.destroy(true));
});
