import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type Phaser from 'phaser';
import { expect, test, type Page } from './tower-browser';
import type { RunController } from '../../src/application/RunController';
import type { BattleScene } from '../../src/game/BattleScene';
import type { RunState } from '../../src/domain/types';
import type { R6Manifest } from '../../src/game/r6/manifest';
import type * as Content from '../../src/content';
import type * as Sessions from '../../src/application/balanceSession';
import type * as Run from '../../src/domain/run';
import type * as QaGold from '../../src/application/qaGold';
import type * as Controllers from '../../src/application/RunController';
import type * as Bridges from '../../src/game/bridge';
import type * as Battlefield from '../../src/game/battlefieldGame';
import type * as Projection from '../../src/game/r6/mapProjection';

const manifest = JSON.parse(readFileSync('public/assets/r6/manifest-v2.json', 'utf8')) as R6Manifest;
const types = ['rail', 'mortar', 'cryo'] as const;
const captureLevels = [1, 6, 12, 18, 20];

declare global {
  interface Window {
    qaTowers: {
      game: Phaser.Game;
      controller: RunController;
      image: (id: number, part: 'head' | 'body') => Phaser.GameObjects.Image | undefined;
      aim: (id: number, direction: number) => void;
    };
  }
}

async function openField(page: Page) {
  await page.route('**/r6-towers-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><title>타워 검사</title><div id="field" style="width:1200px;height:750px"></div></html>',
  }));
  await page.goto('/r6-towers-fixture');
  await page.evaluate(async urls => {
    const [content, sessions, run, qa, controllers, bridges, battlefield, projection] = await Promise.all([
      import(urls.content) as Promise<typeof Content>,
      import(urls.sessions) as Promise<typeof Sessions>,
      import(urls.run) as Promise<typeof Run>,
      import(urls.qa) as Promise<typeof QaGold>,
      import(urls.controller) as Promise<typeof Controllers>,
      import(urls.bridge) as Promise<typeof Bridges>,
      import(urls.battlefield) as Promise<typeof Battlefield>,
      import(urls.projection) as Promise<typeof Projection>,
    ]);
    await content.loadGradeContent(3);
    const { state, ctx } = sessions.localBalanceSession('2.0.0', 3, 'Easy', {
      runId: 'qa-r6-towers', playerId: 'qa', nickname: '타워 확인', seed: 1, rankingEligibility: 'personal',
      createdAt: '2026-11-25T00:00:00.000Z',
    });
    const runState = state as RunState;
    for (let i = 0; i < 240 && runState.phase !== 'BUILD'; i++) {
      const encounter = runState.quiz.current;
      if (encounter && !encounter.answer) {
        const choice = ctx.questions.get(encounter.questionId)!.correctOptionId;
        const result = run.applyCommand(ctx, runState, { type: 'answer', encounterId: encounter.id, choice });
        if (!result.ok) throw new Error(result.error);
      }
      run.advanceTick(ctx, runState);
    }
    if (runState.phase !== 'BUILD') throw new Error('설치 단계까지 진행하지 못했습니다.');
    qa.grantR6QaGold(runState, 100_000);
    const controller = new controllers.RunController(ctx, runState, { recordOnFinish: false });
    const bridge = new bridges.FieldBridgeHandle(controller);
    await new Promise<void>(resolve => battlefield.startBattlefield(
      document.getElementById('field')!, bridge, new AbortController().signal, game => {
        const scene = () => game.scene.getScene('battle') as BattleScene;
        window.qaTowers = {
          game, controller,
          image: (id, part) => scene().children.getByName(`r6:tower:${id}:${part}`) as Phaser.GameObjects.Image | undefined,
          aim(id, direction) {
            const bearing = Math.atan2(6.1, 8.2) - direction * Math.PI / 8;
            const target = projection.unprojectField(480 + 30 * Math.sin(bearing),
              286 - 30 * Math.cos(bearing) * projection.R6_MAP_SQUASH);
            const tower = controller.state.towers.find(value => value.id === id)!;
            // 같은 전장 공격 수신부에 16방향을 차례로 보내 길 배치에 좌우되지 않게 검증한다.
            scene()['towerLayer'].onStrike({
              type: 'strike', towerId: id, towerType: tower.type, fromX: tower.x, fromY: tower.y,
              targets: [{ enemyId: 0, x: tower.x + (target.x - 480) / 64, y: tower.y + (target.y - 288) / 64 }],
            });
          },
        };
        resolve();
      },
    ));
  }, {
    content: '/src/content/index.ts', sessions: '/src/application/balanceSession.ts', run: '/src/domain/run.ts',
    qa: '/src/application/qaGold.ts', controller: '/src/application/RunController.ts',
    bridge: '/src/game/bridge.ts', battlefield: '/src/game/battlefieldGame.ts', projection: '/src/game/r6/mapProjection.ts',
  });
}

const textures = (page: Page) => page.evaluate(() => window.qaTowers.game.textures.getTextureKeys());
const bodyFrames = (page: Page) => page.evaluate(() => window.qaTowers.controller.state.towers.map(tower => {
  const body = window.qaTowers.image(tower.id, 'body');
  return body ? [body.texture.key, Number(body.frame.name)] : null;
}));

async function buildThree(page: Page) {
  const slots = ['garden_u-s03', 'garden_u-s07', 'garden_u-s12'];
  const results = await page.evaluate(({ types, slots }) => types.map((type, index) =>
    window.qaTowers.controller.dispatch({ type: 'build', slotId: slots[index]!, tower: type as RunState['owned'][number] }),
  ), { types, slots });
  expect(results.map(result => result.ok)).toEqual([true, true, true]);
}

async function measureUpgrade(page: Page, stage: number) {
  return page.evaluate(stage => {
    const { controller, game, image } = window.qaTowers;
    const scene = game.scene.getScene('battle');
    const id = controller.state.towers[0]!.id;
    const result = controller.state.towers.map(tower => controller.dispatch({ type: 'upgrade', towerId: tower.id }).ok);
    if (!result.every(Boolean)) throw new Error('타워 강화에 실패했습니다.');
    return new Promise<number>((resolve, reject) => {
      let changedAt: number | undefined;
      let dustAppeared = false;
      const timeout = setTimeout(() => {
        scene.events.off('postupdate', observe);
        reject(new Error('부품이 맞물리는 연출을 확인하지 못했습니다.'));
      }, 5000);
      function observe() {
        const body = image(id, 'body')!;
        if (Number(body.frame.name) !== stage) return;
        changedAt ??= scene.time.now;
        if (scene.children.getByName(body.name + ':dust')) dustAppeared = true;
        else if (dustAppeared) {
          clearTimeout(timeout);
          scene.events.off('postupdate', observe);
          resolve(scene.time.now - changedAt);
        }
      }
      scene.events.on('postupdate', observe);
    });
  }, stage);
}

async function capture(page: Page, name: string) {
  const url = await page.evaluate(() => new Promise<string>(resolve => {
    const { game } = window.qaTowers;
    game.events.once('postrender', () => resolve(game.canvas.toDataURL('image/webp', .95)));
  }));
  saveCapture(url, name);
}

function saveCapture(url: string, name: string) {
  expect(url).toMatch(/^data:image\/webp;base64,/);
  const bytes = Buffer.from(url.split(',')[1]!, 'base64');
  expect(bytes.byteLength).toBeGreaterThan(10_000);
  mkdirSync('test-results/r6-towers', { recursive: true });
  writeFileSync(`test-results/r6-towers/${name}.webp`, bytes);
}

async function watchAttack(page: Page, direction: number, stage: number, captureName: string) {
  const clips = types.map(id => {
    const { attack } = manifest.towers[id]![stage]!;
    if (!('sheets' in attack)) throw new Error(`${id} 공격 시트에 16방향이 없습니다.`);
    return attack.sheets;
  });
  await expect.poll(async () => {
    const keys = await textures(page);
    return clips.flat().every(id => keys.includes(`r6.sheet.${id}`));
  }).toBe(true);
  const { observed, capture } = await page.evaluate(async ({ direction, clips }) => {
    const { game, controller, image, aim } = window.qaTowers;
    const scene = game.scene.getScene('battle');
    const attacks = controller.state.towers.map((tower, i) => ({
      id: tower.id,
      key: 'r6.sheet.' + clips[i]![direction < 8 ? 0 : 1],
      frames: new Set<number>(),
    }));
    let capture: Promise<string> | undefined;
    await new Promise<void>((resolve, reject) => {
      const stop = () => scene.events.off('postupdate', observe);
      const timeout = setTimeout(() => { stop(); reject(new Error('공격 그림이 대기 그림으로 돌아오지 않았습니다.')); }, 3500);
      function observe() {
        let animated = 0;
        for (const attack of attacks) {
          const head = image(attack.id, 'head')!;
          if (head.texture.key === attack.key) {
            const frame = Number(head.frame.name);
            attack.frames.add(frame);
            if (frame % 8 >= 2) animated++;
          }
        }
        if (animated === attacks.length) capture ??= new Promise<string>(resolve => {
          game.events.once('postrender', () => resolve(game.canvas.toDataURL('image/webp', .95)));
        });
        if (attacks.every(attack => attack.frames.size && image(attack.id, 'head')!.texture.key !== attack.key)) {
          stop();
          clearTimeout(timeout);
          resolve();
        }
      }
      scene.events.on('postupdate', observe);
      for (const tower of controller.state.towers) aim(tower.id, direction);
    });
    return {
      observed: attacks.map(attack => ({ frames: [...attack.frames], aim: Number(image(attack.id, 'head')!.frame.name) })),
      capture: await capture,
    };
  }, { direction, clips });
  for (const { frames, aim } of observed) {
    const first = (direction % 8) * 8;
    expect(frames.length).toBeGreaterThan(2);
    expect(frames.every((frame, index) => frame >= first && frame < first + 8 && (!index || frame > frames[index - 1]!))).toBe(true);
    expect(aim).toBe(direction);
  }
  expect(capture).toBeDefined();
  saveCapture(capture!, captureName);
}

test('R6 타워 세 종의 진화·조준·공격 그림을 전장에 표시한다', async ({ page }) => {
  const requested: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/assets/r6/towers/')) requested.push(path);
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '새 게임', exact: true })).toBeVisible();
  expect(requested).toEqual([]);
  await openField(page);
  await expect.poll(async () => (await textures(page)).filter(key => key.startsWith('r6.sheet.')).length).toBe(6);
  expect(requested).toHaveLength(6);
  expect(requested.every(path => !path.includes('-2x') && !path.includes('-attack'))).toBe(true);
  await buildThree(page);

  for (let level = 1; level <= 20; level++) {
    const stage = Math.floor(level / 2);
    if (level === 2 || level === 6) {
      const duration = level === 2 ? 600 : 1200;
      const elapsed = await measureUpgrade(page, stage);
      expect(elapsed).toBeGreaterThanOrEqual(duration - 25);
      expect(elapsed).toBeLessThan(duration + 200);
    } else if (level > 1) {
      const upgraded = await page.evaluate(() => window.qaTowers.controller.state.towers.map(tower =>
        window.qaTowers.controller.dispatch({ type: 'upgrade', towerId: tower.id }).ok));
      expect(upgraded).toEqual([true, true, true]);
    }
    await expect.poll(() => bodyFrames(page)).toEqual(types.map(type => [`r6.sheet.${type}-bodies`, stage]));
    if (!captureLevels.includes(level)) continue;
    const forms = types.map(type => manifest.towers[type]![stage]!);
    await expect.poll(() => page.evaluate(forms => window.qaTowers.controller.state.towers.every((tower, index) => {
      const { image } = window.qaTowers;
      const body = image(tower.id, 'body')!;
      const head = image(tower.id, 'head')!;
      const { mount, bodyPivot } = forms[index]!;
      const mountY = body.y + (mount - bodyPivot) * body.displayWidth / 192;
      return Math.abs(head.y - mountY) < .03;
    }), forms.map(form => ({ mount: form.mount[1], bodyPivot: manifest.sheets[form.body]!.pivot[1] })))).toBe(true);
    await capture(page, `lv${level}`);
    await watchAttack(page, (level + 5) % 16, stage, `lv${level}-attack`);
  }

  const directions = await page.evaluate(async () => {
    const { game, aim, image, controller } = window.qaTowers;
    const scene = game.scene.getScene('battle');
    const id = controller.state.towers[0]!.id;
    const seen: number[] = [];
    for (let direction = 0; direction < 16; direction++) {
      aim(id, direction);
      const frame = await new Promise<number>(resolve => {
        scene.events.once('postupdate', () => {
          const head = image(id, 'head')!;
          const half = head.texture.key.endsWith('-1') ? 8 : 0;
          resolve(head.texture.key.includes('-attack-') ? half + Math.floor(Number(head.frame.name) / 8) : -1);
        });
      });
      seen.push(frame);
    }
    return seen;
  });
  expect(directions).toEqual(Array.from({ length: 16 }, (_, index) => index));
  expect(errors).toEqual([]);
});

test.describe('고해상도 화면', () => {
  test.use({ deviceScaleFactor: 2 });
  test('같은 전장 크기로 384px 타워를 표시하고 곡사 포대의 실제 첫발을 재생한다', async ({ page }) => {
    await openField(page);
    await expect.poll(async () => (await textures(page)).includes('r6.sheet.cryo-lv1-heads')).toBe(true);
    await buildThree(page);
    await expect.poll(() => page.evaluate(() => window.qaTowers.controller.state.towers.map(tower => {
      const body = window.qaTowers.image(tower.id, 'body');
      return body ? [body.frame.width, Math.round(body.displayWidth)] : null;
    }))).toEqual([[384, 115], [384, 115], [384, 115]]);

    await expect.poll(async () => (await textures(page)).filter(key => key.startsWith('r6.sheet.mortar-attack-lv1-')).length).toBe(2);
    const fired = await page.evaluate(() => new Promise<boolean>((resolve, reject) => {
      const { game, controller, image } = window.qaTowers;
      const scene = game.scene.getScene('battle');
      const mortar = controller.state.towers.find(tower => tower.slotId === 'garden_u-s07')!;
      const started = controller.dispatch({ type: 'startBattle' });
      if (!started.ok) { reject(new Error(started.error)); return; }
      const timeout = setTimeout(() => {
        scene.events.off('postupdate', watch);
        controller.stop();
        reject(new Error('곡사 포대의 첫발을 그리지 못했습니다.'));
      }, 20000);
      function watch() {
        const head = image(mortar.id, 'head');
        if (!head?.texture.key.startsWith('r6.sheet.mortar-attack-lv1-')) return;
        scene.events.off('postupdate', watch);
        controller.stop();
        clearTimeout(timeout);
        resolve(mortar.attacks > 0);
      }
      scene.events.on('postupdate', watch);
      controller.start();
    }));
    expect(fired).toBe(true);
  });
});
