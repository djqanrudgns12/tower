import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type Phaser from 'phaser';
import { expect, test, type Page } from './tower-browser';
import type { RunController } from '../../src/application/RunController';
import type { BattleScene } from '../../src/game/BattleScene';
import type { RunState } from '../../src/domain/types';
import { r6ManifestSchema, r6TowerPackSchema, towerPackPath } from '../../src/game/r6/manifest';
import type * as Content from '../../src/content';
import type * as Sessions from '../../src/application/balanceSession';
import type * as Run from '../../src/domain/run';
import type * as Draft from '../../src/domain/draft';
import type * as QaGold from '../../src/application/qaGold';
import type * as Controllers from '../../src/application/RunController';
import type * as Bridges from '../../src/game/bridge';
import type * as Battlefield from '../../src/game/battlefieldGame';
import type * as Projection from '../../src/game/r6/mapProjection';

const manifest = r6ManifestSchema.parse(JSON.parse(readFileSync('public/assets/r6/manifest-v2.json', 'utf8')));
for (const id of manifest.lazyTowers ?? []) {
  const pack = r6TowerPackSchema.parse(JSON.parse(readFileSync(`public/assets/r6/${towerPackPath(id)}`, 'utf8')));
  manifest.towers[id] = pack.forms;
  Object.assign(manifest.sheets, pack.sheets);
}
const startingTypes = ['rail', 'mortar', 'cryo'] as const;
const types = [...startingTypes, 'prism', 'hangar', 'bastion'] as const;
const slots = ['garden_u-s03', 'garden_u-s07', 'garden_u-s12', 'garden_u-s05', 'garden_u-s10', 'garden_u-s19'];
const captureLevels = [1, 6, 12, 18, 20];

declare global {
  interface Window {
    qaTowers: {
      game: Phaser.Game;
      controller: RunController;
      image: (id: number, part: 'head' | 'body' | 'drone') => Phaser.GameObjects.Image | undefined;
      aim: (id: number, direction: number) => void;
      unlockSupport: () => void;
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
    const [content, sessions, run, qa, controllers, bridges, battlefield, projection, draft] = await Promise.all([
      import(urls.content) as Promise<typeof Content>,
      import(urls.sessions) as Promise<typeof Sessions>,
      import(urls.run) as Promise<typeof Run>,
      import(urls.qa) as Promise<typeof QaGold>,
      import(urls.controller) as Promise<typeof Controllers>,
      import(urls.bridge) as Promise<typeof Bridges>,
      import(urls.battlefield) as Promise<typeof Battlefield>,
      import(urls.projection) as Promise<typeof Projection>,
      import(urls.draft) as Promise<typeof Draft>,
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
          unlockSupport() {
            const wave = runState.completedWave;
            for (const completedWave of [3, 6, 9]) {
              const events: Parameters<typeof draft.openDraft>[2] = [];
              runState.completedWave = completedWave;
              draft.openDraft(ctx.balance, runState, events);
              // 화면 제어기가 기존 사건 타입으로 전달하는 경계와 같다.
              scene()['onEvents'](events as Parameters<BattleScene['onEvents']>[0]);
            }
            runState.completedWave = wave;
          },
          aim(id, direction) {
            const bearing = Math.atan2(6.1, 8.2) - direction * Math.PI / 8;
            const target = projection.unprojectField(480 + 30 * Math.sin(bearing),
              286 - 30 * Math.cos(bearing) * projection.R6_MAP_SQUASH);
            const tower = controller.state.towers.find(value => value.id === id)!;
            // 같은 전장 공격 수신부에 16방향을 차례로 보내 길 배치에 좌우되지 않게 검증한다.
            scene()['towerLayer'].onStrike({
              type: 'strike', towerId: id, towerType: tower.type, fromX: tower.x, fromY: tower.y,
              targets: [{ enemyId: 0, x: tower.x + (target.x - 480) * 1000 / 64, y: tower.y + (target.y - 288) * 1000 / 64 }],
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
    draft: '/src/domain/draft.ts',
  });
}

const textures = (page: Page) => page.evaluate(() => window.qaTowers.game.textures.getTextureKeys());
const bodyFrames = (page: Page) => page.evaluate(() => window.qaTowers.controller.state.towers.map(tower => {
  const body = window.qaTowers.image(tower.id, 'body');
  return body ? [body.texture.key, Number(body.frame.name)] : null;
}));

async function buildTowers(page: Page, lineup: readonly (typeof types)[number][]) {
  const results = await page.evaluate(({ types, slots }) => types.map((type, index) =>
    window.qaTowers.controller.dispatch({ type: 'build', slotId: slots[index]!, tower: type as RunState['owned'][number] }),
  ), { types: lineup, slots });
  expect(results.map(result => result.ok)).toEqual(lineup.map(() => true));
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
  const { observed, travelled, droneFrames, capture } = await page.evaluate(async ({ direction, clips }) => {
    const { game, controller, image, aim } = window.qaTowers;
    const scene = game.scene.getScene('battle') as BattleScene;
    const attacks = controller.state.towers.map((tower, i) => ({
      id: tower.id,
      key: 'r6.sheet.' + clips[i]![direction < 8 ? 0 : 1],
      frames: new Set<number>(),
    }));
    const hangar = controller.state.towers.find(tower => String(tower.type) === 'hangar')!;
    const droneFrames = new Set<number>();
    let travelled = 0;
    let capture: Promise<string> | undefined;
    // 느린 검수 환경에서도 장면이 렌더할 때마다 40ms씩 진행해 20fps 공격 프레임을 건너뛰지 않는다.
    const layer = scene['towerLayer'];
    const sync = layer.sync;
    let playbackTime = scene.time.now;
    layer.sync = function(state) {
      sync.call(this, state, playbackTime);
      playbackTime += 40;
    };
    await new Promise<void>((resolve, reject) => {
      const stop = () => {
        scene.events.off('postupdate', observe);
        layer.sync = sync;
      };
      const timeout = setTimeout(() => { stop(); reject(new Error('공격 그림이 대기 그림으로 돌아오지 않았습니다.')); }, 3500);
      function observe() {
        const drone = image(hangar.id, 'drone');
        if (drone?.visible && drone.texture.key === 'r6.sheet.hangar-flight') {
          droneFrames.add(Number(drone.frame.name));
          const body = image(hangar.id, 'body')!;
          travelled = Math.max(travelled, Math.hypot(drone.x - body.x, drone.y - body.y));
        }
        let animated = 0;
        for (const attack of attacks) {
          const head = image(attack.id, 'head')!;
          if (head.texture.key === attack.key) {
            const frame = Number(head.frame.name);
            attack.frames.add(frame);
            if (frame % 8 >= 2) animated++;
          }
        }
        if (animated === attacks.length && drone?.visible) capture ??= new Promise<string>(resolve => {
          game.events.once('postrender', () => resolve(game.canvas.toDataURL('image/webp', .95)));
        });
        if (!drone && attacks.every(attack => attack.frames.size && image(attack.id, 'head')!.texture.key !== attack.key)) {
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
      travelled, droneFrames: [...droneFrames],
      capture: await capture,
    };
  }, { direction, clips });
  for (const { frames, aim } of observed) {
    const first = (direction % 8) * 8;
    expect(frames).toHaveLength(8);
    expect(frames.every((frame, index) => frame >= first && frame < first + 8 && (!index || frame > frames[index - 1]!))).toBe(true);
    expect(aim).toBe(direction);
  }
  const flightTier = stage >= 9 ? 3 : stage >= 6 ? 2 : stage >= 3 ? 1 : 0;
  expect(droneFrames.length).toBeGreaterThan(2);
  expect(droneFrames.every(frame => Math.floor(frame / 8) === flightTier)).toBe(true);
  expect(travelled).toBeGreaterThan(25);
  expect(capture).toBeDefined();
  saveCapture(capture!, captureName);
}

test('R6 타워 여섯 종을 해금하고 진화·조준·공격 그림을 전장에 표시한다', async ({ page }) => {
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
  expect(requested.some(path => path.endsWith('/pack.json'))).toBe(false);
  await page.evaluate(() => window.qaTowers.unlockSupport());
  await expect.poll(async () => (await textures(page)).filter(key => key.startsWith('r6.sheet.')).length).toBe(12);
  expect(requested.filter(path => path.endsWith('/pack.json'))).toHaveLength(3);
  expect(requested.filter(path => /\/(prism|hangar|bastion)\/.*\.webp$/.test(path))).toHaveLength(6);
  expect(requested.some(path => path.includes('hangar-flight'))).toBe(false);
  await buildTowers(page, types);
  await expect.poll(async () => (await textures(page)).includes('r6.sheet.hangar-flight')).toBe(true);

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
      expect(upgraded).toEqual(types.map(() => true));
    }
    await expect.poll(() => bodyFrames(page)).toEqual(types.map(type => [`r6.sheet.${type}-bodies`, stage]));
    if (!captureLevels.includes(level)) continue;
    const forms = types.map(type => manifest.towers[type]![stage]!);
    await expect.poll(() => page.evaluate(forms => window.qaTowers.controller.state.towers.every((tower, index) => {
      const { image } = window.qaTowers;
      const body = image(tower.id, 'body')!;
      const head = image(tower.id, 'head')!;
      const { mount, bodyPivot } = forms[index]!;
      const scale = body.displayWidth / 192;
      const mountX = body.x + (mount[0] - bodyPivot[0]) * scale;
      const mountY = body.y + (mount[1] - bodyPivot[1]) * scale;
      return Math.abs(head.x - mountX) < .03 && Math.abs(head.y - mountY) < .03;
    }), forms.map(form => ({ mount: form.mount, bodyPivot: manifest.sheets[form.body]!.pivot })))).toBe(true);
    if (level === 20) await capture(page, 'six-lv20');
    await watchAttack(page, (level + 5) % 16, stage, `six-lv${level}-attack`);
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
    await buildTowers(page, startingTypes);
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
        reject(new Error('곡사 포대의 첫발을 그리지 못했습니다.'));
      }, 5000);
      function watch() {
        const head = image(mortar.id, 'head');
        if (!head?.texture.key.startsWith('r6.sheet.mortar-attack-lv1-')) return;
        scene.events.off('postupdate', watch);
        clearTimeout(timeout);
        resolve(mortar.attacks > 0);
      }
      scene.events.on('postupdate', watch);
      // 전장 렌더 속도와 무관하게 제어기가 판정하고 구독자에게 발사 사건을 보내게 한다.
      for (let ticks = 0; ticks < 600 && mortar.attacks === 0; ticks++) {
        if (!controller['step']()) break;
      }
      if (mortar.attacks === 0) {
        scene.events.off('postupdate', watch);
        clearTimeout(timeout);
        reject(new Error(`논리 틱 ${controller.state.tick}까지 곡사 포대가 발사하지 않았습니다.`));
      }
    }));
    expect(fired).toBe(true);
  });
});
