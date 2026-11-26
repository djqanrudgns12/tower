/* global document, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const QA_URLS = [
  '/src/application/balanceSession.ts', '/tools/sim/balanceSim.ts',
  '/src/domain/relics.ts', '/src/domain/r6Mixer.ts', '/src/application/RunController.ts',
  '/src/game/bridge.ts', '/src/game/battlefieldGame.ts',
];

export async function captureDensity(page, out, [label = 'current', rawSeed = '2'] = []) {
  const seed = Number(rawSeed);
  assert.ok(/^[a-z][a-z0-9-]*$/.test(label) && Number.isSafeInteger(seed) && seed >= 0, '캡처 이름과 시드를 확인하세요.');
  const run = await page.evaluate(async ({ seed, urls }) => {
    const [{ getR6Battle }, sim, { relicContext }, { previewR6Wave }, { RunController }, { FieldBridgeHandle },
      { startBattlefield }] = await Promise.all(urls.map(url => import(url)));
    const { map, balance } = getR6Battle();
    const opt = {
      balance, mapId: map.id, seed, difficulty: 'Easy', accuracy: .8, readSec: 12, maxWaves: 20,
      towers: Object.keys(balance.r6.rules.towers),
      policy: { ...sim.STRATEGIES.balanced, pattern: ['rail', 'rail', 'mortar', 'cryo', 'rail', 'mortar', 'rail', 'mortar'] },
      brain: { ...sim.GREEDY, spend(p) {
        for (;;) {
          const choice = sim.bestOption(sim.greedyOptions({ ...p, ctx: relicContext(p.ctx, p.s) }));
          if (!choice || choice.cost > p.s.gold) return;
          sim.runCmd(p, choice.cmd);
        }
      } },
    };
    const peaks = new Map();
    const counts = new Map();
    function scan(options, waves) {
      const player = sim.createPlayer(options);
      let previous;
      while (!sim.playerDone(player)) {
        sim.stepPlayer(player);
        const s = player.s;
        if (s.pause.length) throw new Error(`게임 진행 정지 · W${s.wave} · ${s.pause.join(', ')}`);
        if (s.phase !== 'BATTLE' || !waves.includes(s.wave)) continue;
        const count = s.enemies.filter(e => e.alive).length;
        counts.set(s.wave, (counts.get(s.wave) ?? 0) + 1);
        const snapshot = structuredClone(s);
        if (count > (peaks.get(s.wave)?.count ?? 0)) {
          peaks.set(s.wave, { previous, state: snapshot, count, ctx: player.ctx });
        }
        previous = snapshot;
      }
      if (waves.some(wave => !peaks.has(wave))) {
        throw new Error(`시드 ${options.seed} · W${player.s.completedWave} 완료 · 대상 웨이브에 도달하지 못했습니다.`);
      }
      return player.s.completedWave;
    }
    const completedWave = scan(opt, [15, 20]);
    const stoneBossSeed = Array.from({ length: 64 }, (_, candidate) => candidate).find(candidate =>
      previewR6Wave(balance.r6.rules, map.id, candidate, 5).some(m => m.id === 'stone-boss-t1'));
    if (stoneBossSeed === undefined) throw new Error('바위 보스 T1이 등장하는 W5 시드가 없습니다.');
    scan({ ...opt, seed: stoneBossSeed, maxWaves: 5 }, [5]);
    window.qaDensity = {
      peaks,
      async mount(wave) {
        const { previous, state, ctx } = peaks.get(wave);
        const holder = document.querySelector('#field');
        document.querySelector('h1').textContent = `웨이브 ${wave} · ${state.enemies.filter(e => e.alive).length}개체 · 틱 ${state.tick}`;
        const initial = previous?.wave === wave ? previous : state;
        const controller = new RunController(ctx, structuredClone(initial), { recordOnFinish: false });
        window.qaDensity.game = await new Promise(ready => startBattlefield(holder, new FieldBridgeHandle(controller), new AbortController().signal, ready));
        window.qaDensity.controller = controller;
      },
    };
    return {
      seed, map: map.id, difficulty: opt.difficulty, strategy: 'balanced', accuracy: opt.accuracy, readSeconds: opt.readSec,
      completedWave, examinedTicks: Object.fromEntries(counts),
      stoneBossSeed,
    };
  }, { seed, urls: QA_URLS });

  // 전장 카메라와 실제 Phaser 그리기 순서로 그림별 마스크를 재생한다.
  const temporary = await mkdtemp(resolve(out, '.density-'));
  try {
    const readings = {};
    for (const wave of [5, 15, 20]) {
      await page.evaluate(wave => window.qaDensity.mount(wave), wave);
      await page.waitForFunction(wave => {
        const { game, peaks } = window.qaDensity;
        const scene = game.scene.getScene('battle');
        if (!scene?.enemyLayer || scene.load.isLoading()) return false;
        const state = peaks.get(wave).state;
        return state.enemies.filter(e => e.alive).every(e => {
          const art = scene.r6Assets.enemyArt(e);
          return art && art.data.startsWith('r6.rig.' + e.faction + '-');
        }) && window.qaDensity.controller.state.towers.every(t => scene.children.getByName(`r6:tower:${t.id}:body`));
      }, wave, { timeout: 45_000 });
      const { png, ...reading } = await page.evaluate(measurePeak, wave);
      readings[wave] = reading;
      const photo = resolve(temporary, 'field.png');
      await writeFile(photo, Buffer.from(png.split(',')[1], 'base64'));
      execFileSync('cwebp', ['-quiet', '-lossless', '-o', resolve(out, `density-w${wave}-${label}.webp`), '--', photo]);
      await page.evaluate(() => {
        const { game } = window.qaDensity;
        game.destroy(true);
        game.runDestroy();
      });
      console.log(`W${wave} · 최대 동시 표시 ${reading.displayed}개체 · 칸 최대 가림 ${reading.pads.max} · 타워 최대 가림 ${reading.towers.max} · 적 최대 가려짐 ${reading.enemyOcclusion.any.max}`);
    }
    await writeFile(resolve(out, `density-${label}.json`), JSON.stringify({
      chromium: page.context().browser().version(), ...run, waves: readings,
    }, null, 2) + '\n');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function measurePeak(wave) {
  const { game, controller, peaks } = window.qaDensity;
  const { state, count } = peaks.get(wave);
  const scene = game.scene.getScene('battle');
  game.loop.sleep();
  const start = scene.time.now;
  // 직전 틱에서 목표 틱으로 옮기고, 틱 끝 보간값으로 그린다.
  Object.assign(controller.state, state);
  controller.acc = 1000 / 30;
  scene.update(start + 1000 / 30, 1000 / 30);
  scene.sys.depthSort();
  const list = scene.children.list;
  const enemies = state.enemies.filter(e => e.alive).map(enemy => {
    const object = scene.children.getByName(`r6:enemy:${enemy.id}`);
    if (!object || !object.skeleton.slots.some(s => s.pose.attachment?.path.startsWith(enemy.faction + '-'))) {
      throw new Error(`전용 전장 스킨을 확인할 수 없습니다 · ${enemy.entityId}`);
    }
    return { object, enemy, order: list.indexOf(object) };
  });
  if (count !== undefined && enemies.length !== count) throw new Error('피크의 생존 개체 수가 다릅니다.');
  const renderer = game.renderer;
  const { gl } = renderer;
  const camera = scene.cameras.main;
  const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
  const pixelCount = width * height;
  const dark = new Uint8Array(pixelCount * 4);
  const light = new Uint8Array(pixelCount * 4);
  const bg = renderer.config.backgroundColor;
  const original = [bg.red, bg.green, bg.blue, bg.alpha];
  const draw = (objects, shade, buffer) => {
    bg.setTo(shade, shade, shade, 255);
    renderer.preRender();
    camera.preRender();
    renderer.render(scene, objects, camera);
    renderer.postRender();
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  };
  const mask = objects => {
    draw(objects, 0, dark);
    draw(objects, 255, light);
    const result = new Set();
    for (let i = 0; i < pixelCount; i++) {
      // 불투명 흑백 바탕에 같은 그림을 그린 색차로 실효 알파를 얻는다.
      if (light[i * 4] - dark[i * 4] <= 127) result.add(i);
    }
    return result;
  };
  const round = value => Number(value.toFixed(4));
  const hits = new Uint8Array(pixelCount);
  let overlap = 0;
  let union = 0;
  for (const enemy of enemies) {
    enemy.mask = mask([enemy.object]);
    if (!enemy.mask.size) throw new Error(`화면 밖 개체 · ${enemy.enemy.entityId}`);
    let bottom = height, top = -1;
    for (const pixel of enemy.mask) {
      if (hits[pixel] === 0) union++;
      if (hits[pixel] === 1) overlap++;
      hits[pixel]++;
      const row = Math.floor(pixel / width);
      bottom = Math.min(bottom, row);
      top = Math.max(top, row);
    }
    enemy.height = top - bottom + 1;
  }
  const target = (id, footY, objects) => {
    const parts = objects.filter(object => object?.visible).map(object => ({
      mask: mask([object]), order: list.indexOf(object),
    }));
    const pixels = new Map();
    for (const part of parts) {
      for (const p of part.mask) pixels.set(p, Math.max(part.order, pixels.get(p) ?? -1));
    }
    if (!pixels.size) throw new Error(`타워 또는 칸 그림이 없습니다 · ${id}`);
    return { id, footY, pixels };
  };
  const padTargets = controller.ctx.map.slots.map(slot => {
    const pad = scene.children.getByName(`r6:pad:${slot.id}`);
    return target(slot.id, pad.y, [pad]);
  });
  const towerTargets = state.towers.map(tower => {
    const body = scene.children.getByName(`r6:tower:${tower.id}:body`);
    const head = scene.children.getByName(`r6:tower:${tower.id}:head`);
    return target(tower.slotId, body.y, [body, head]);
  });
  const coverage = pixels => {
    let hidden = 0;
    for (const [p, order] of pixels) {
      if (hits[p] && enemies.some(e => e.order > order && e.mask.has(p))) hidden++;
    }
    return hidden / pixels.size;
  };
  const summary = values => ({
    max: round(Math.max(0, ...values)),
    mean: round(values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0),
  });
  const bySlot = targets => {
    const values = targets.map(({ pixels }) => coverage(pixels));
    return { ...summary(values), bySlot: Object.fromEntries(targets.map(({ id }, i) => [id, round(values[i])])) };
  };
  const pads = bySlot(padTargets);
  const towers = bySlot(towerTargets);
  const outlines = scene.children.getByName('r6:pad-outlines');
  const outlinePixels = outlines ? mask([outlines]) : new Set();
  const outlineOrder = list.indexOf(outlines);
  const padOutlines = outlines ? bySlot(padTargets.map(({ id, pixels }) => {
    const visibleOutline = new Map();
    for (const p of pixels.keys()) if (outlinePixels.has(p)) visibleOutline.set(p, outlineOrder);
    if (!visibleOutline.size) throw new Error(`설치 칸 윤곽이 없습니다 · ${id}`);
    return { id, pixels: visibleOutline };
  })) : null;
  const occludes = (targets, pixel, order) => targets.some(({ pixels }) => (pixels.get(pixel) ?? -1) > order);
  const enemyRows = enemies.map(({ enemy, mask, order }) => {
    const footY = scene.enemyLayer.placeOf(enemy.id).y;
    const rear = [...padTargets, ...towerTargets].filter(target => target.footY < footY);
    let pads = 0, towers = 0, any = 0, behind = 0, outline = 0;
    for (const p of mask) {
      const pad = occludes(padTargets, p, order);
      const tower = occludes(towerTargets, p, order);
      if (pad) pads++;
      if (tower) towers++;
      if (pad || tower) any++;
      if (occludes(rear, p, order)) behind++;
      if (outlineOrder > order && outlinePixels.has(p)) outline++;
    }
    return { id: enemy.id, entity: enemy.entityId, pads: pads / mask.size, towers: towers / mask.size,
      any: any / mask.size, behind: behind / mask.size, outline: outline / mask.size };
  });
  const occlusionFields = ['pads', 'towers', 'any', 'behind', 'outline'];
  const enemyOcclusion = Object.fromEntries(occlusionFields.map(key => [key, summary(enemyRows.map(row => row[key]))]));
  enemyOcclusion.byEnemy = enemyRows.map(({ id, entity, ...ratios }) => ({
    id, entity, ...Object.fromEntries(occlusionFields.map(key => [key, round(ratios[key])])),
  }));
  const bossComparisons = enemies.filter(e => e.enemy.kind === 'boss').map(boss => {
    const regulars = enemies.filter(e => e.enemy.faction === boss.enemy.faction && e.enemy.kind !== 'boss');
    return {
      entity: boss.enemy.entityId, height: boss.height, damaged: boss.enemy.hp < boss.enemy.maxHp,
      sourceHp: boss.enemy.hp, maxHp: boss.enemy.maxHp,
      sameSpecies: regulars.map(e => ({ entity: e.enemy.entityId, height: e.height, ratio: round(boss.height / e.height) })),
    };
  });
  bg.setTo(...original);
  renderer.preRender();
  scene.sys.render(renderer);
  renderer.postRender();
  return {
    png: game.canvas.toDataURL(), tick: state.tick, displayed: enemies.length, enemyOverlap: round(overlap / union),
    gates: state.gateHp, pads, padOutlines, towers, enemyOcclusion, bossComparisons,
    entities: enemies.map(e => ({ entity: e.enemy.entityId, progress: e.enemy.progress, height: e.height })),
  };
}
