/* global document, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const [work, shots, ...args] = process.argv.slice(2);
if (!work || !shots) throw new Error('사용법 · node tools/r6/spine/capture-playwright.mjs <작업 폴더> <캡처 폴더>');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const allSpecies = ['machine', 'stone', 'elf', 'human', 'insect'];
const inspect = work === '--inspect';
const mixed = work === '--published';
const published = mixed || inspect;
const waveNumber = mixed ? Number(args[0] ?? 20) : 1;
if (mixed && ![15, 20].includes(waveNumber)) throw new Error('혼합 전장 캡처는 15 또는 20웨이브를 지정하세요.');
const shotName = inspect ? 'battle-detail' : waveNumber === 15 ? 'battle-w15' : 'battle';
const fragment = published ? null : await readJson(resolve(work, 'manifest-fragment.json'));
const species = fragment && Object.keys(fragment.species)[0];
const catalog = published ? Object.assign({}, ...await Promise.all(allSpecies.map(async s =>
  (await readJson(`src/game/r6/monsters/${s}.json`)).entities))) : fragment.species[species].entities;
let actors = Object.entries(catalog);
if (inspect) {
  if (args.length === 0 || args.some(id => !catalog[id])) throw new Error('게시된 개체 ID를 지정하세요.');
  actors = args.map(id => [id, catalog[id]]);
}
const allowedFiles = new Set(fragment ? [
  ...Object.values(fragment.rigs).map(({ file }) => basename(file)),
  `${species}.atlas`, `${species}.webp`,
] : []);
const mime = { json: 'application/json', atlas: 'text/plain', webp: 'image/webp' };

await mkdir(shots, { recursive: true });
const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  configFile: 'vite.config.ts',
  cacheDir: '.orchestrate/r6-monster-capture-vite',
  optimizeDeps: { entries: ['src/game/battlefieldGame.ts', 'src/application/RunController.ts', 'src/content/index.ts'],
    include: ['@esotericsoftware/spine-phaser-v4', 'phaser', 'idb', 'zod'] },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const requests = new Set();
  page.on('pageerror', error => errors.push(error.stack || error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  if (fragment) {
    const manifest = await readJson('public/assets/r6/manifest-v2.json');
    for (const field of ['atlases', 'rigs', 'species']) Object.assign(manifest[field], fragment[field]);
    await page.route('**/assets/r6/manifest-v2.json', route => route.fulfill({ json: manifest }));
    await page.route(`**/assets/r6/${species}/*`, async route => {
      const file = basename(new URL(route.request().url()).pathname);
      assert.ok(allowedFiles.has(file), `미등록 에셋 요청 · ${file}`);
      requests.add(file);
      await route.fulfill({ path: resolve(work, 'export', species, file), contentType: mime[file.split('.').at(-1)] });
    });
  } else {
    page.on('response', response => {
      if (response.ok() && response.url().includes('/assets/r6/monsters/')) requests.add(basename(response.url()));
    });
  }
  await page.route('**/r6-monster-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="ko"><meta charset="utf-8"><title>적 동작 확인</title>
<style>body{margin:0;background:#12161b;color:#b8c0c8;font:16px system-ui}main{padding:16px}
h1{font-size:19px;margin:0 0 12px}#field{width:1408px;height:834px}</style>
<main><h1>${mixed ? `혼합 웨이브 · W${waveNumber}` : `R6 전장 · ${actors.length}개체`}</h1><div id="field"></div></main></html>`,
  }));
  await page.goto(new URL('r6-monster-fixture', server.resolvedUrls.local[0]).href);
  const selection = await page.evaluate(async ({ mixed, ids, waveNumber, allSpecies }) => {
    const paths = ['/src/content/index.ts', '/src/application/balanceSession.ts', '/src/application/RunController.ts',
      '/src/game/bridge.ts', '/src/game/battlefieldGame.ts'];
    const [{ loadGradeContent }, { localBalanceSession }, { RunController }, { FieldBridgeHandle },
      { startBattlefield }] = await Promise.all(paths.map(path => import(path)));
    await loadGradeContent(3);
    const { state, ctx } = localBalanceSession('2.0.0', 3, 'Easy', {
      runId: 'qa-r6-monsters', playerId: 'qa', nickname: '파츠 확인', seed: 1,
      rankingEligibility: 'personal', createdAt: '2026-11-25T00:00:00.000Z',
    });
    state.phase = 'BUILD';
    state.wave = 1;
    let seed = state.config.seed;
    if (mixed) {
      const mixerUrl = '/src/domain/r6Mixer.ts';
      const { previewR6Wave } = await import(mixerUrl);
      state.wave = waveNumber;
      const tiers = waveNumber === 15 ? [2, 3] : [3, 4];
      const reviewed = allSpecies.filter(s =>
        ids.some(id => id.startsWith(s + '-') && tiers.includes(Number(id.at(-1)))));
      const hasBoss = ids.some(id => id.endsWith('-boss-t' + waveNumber / 5));
      // 실제 편성 중 서로 다른 전용 스킨을 가장 많이 볼 수 있는 시드를 고른다.
      let best;
      for (let candidate = 0; candidate < 64; candidate++) {
        const wave = previewR6Wave(ctx.balance.r6.rules, ctx.map.id, candidate, state.wave);
        const ready = wave.filter(m => ids.includes(m.id));
        if (!tiers.every(t => ready.some(m => m.tier === t)) ||
            !reviewed.every(s => ready.some(m => m.species === s)) ||
            !wave.some(m => m.lineage === 'boss' && (!hasBoss || ids.includes(m.id)))) continue;
        const unique = new Set(ready.map(m => m.id)).size;
        if (!best || unique > best.unique || (unique === best.unique && ready.length > best.count)) {
          best = { unique, count: ready.length, seed: candidate, ids: wave.map(m => m.id) };
        }
      }
      if (!best) throw new Error('대상 종족·단계·보스가 함께 나오는 웨이브를 찾지 못했습니다.');
      ids = best.ids;
      seed = best.seed;
      state.config.seed = seed;
    }
    state.pause = [];
    // 전장 로더가 이 종족만 불러오도록 실제 적 목록을 채운다.
    state.battle = { spawnList: [] };
    state.enemies = ids.map((entityId, index) => {
      const boss = entityId.includes('-boss-');
      const spec = ctx.balance.r6.entities[entityId];
      return {
        id: index + 1, entityId, faction: entityId.split('-')[0], alive: true, derived: false,
        kind: spec.kind, bossTier: boss ? Number(entityId.at(-1)) : null, boss: null,
        flying: spec.flying ?? false, groundedUntilTick: 0, elite: null,
        progress: ids.length === 1 ? Math.round(ctx.path.length / 2)
          : Math.round(550 + index * (ctx.path.length - 1600) / (ids.length - 1)),
        hp: 100, maxHp: 100, moveRem: 0, speedBP: spec.speedBP,
        physicalResistBP: spec.physicalResistBP, magicResistBP: spec.magicResistBP,
        slows: [], stunUntilTick: 0, stunTicksUsed: 0, burns: [], burnNextTick: null,
        burnRemainder: 0, vulns: [], shreds: [], knockbackUsed: 0,
      };
    });
    const controller = new RunController(ctx, state, { recordOnFinish: false });
    const bridge = new FieldBridgeHandle(controller);
    startBattlefield(document.querySelector('#field'), bridge, new AbortController().signal, (game) => {
      window.qaMonsters = { state, game };
    });
    return { ids, seed, wave: state.wave };
  }, { mixed, waveNumber, ids: actors.map(([id]) => id), allSpecies });
  actors = selection.ids.map(id => [id, catalog[id] ?? { skin: 'T' + id.at(-1), rig: 'g2-walker' }]);
  try {
    await page.waitForFunction(() => {
      const qa = window.qaMonsters;
      const scene = qa?.game.scene.getScene('battle');
      return qa?.state.enemies.every(({ id }) => scene?.children.getByName(`r6:enemy:${id}`));
    }, null, { timeout: 30_000 });
  } catch (cause) {
    const scene = await page.evaluate(() => {
      const game = window.qaMonsters?.game;
      const battle = game?.scene.getScene('battle');
      return {
        renderer: game?.renderer?.type, sceneReady: Boolean(battle?.enemyLayer),
        manifest: Boolean(battle?.r6Assets?.manifest), revision: battle?.r6Assets?.revision,
        rigKeys: battle?.cache?.json?.getKeys(), atlasKeys: battle?.cache?.text?.getKeys(),
        enemies: battle?.children?.list.filter(({ name }) => name.startsWith('r6:enemy:')).length,
      };
    });
    throw new Error(`전장 표시 대기 실패 · ${JSON.stringify({ scene, requests: [...requests], errors: errors.slice(0, 5) })}`, { cause });
  }
  await page.evaluate(() => {
    const { game, state } = window.qaMonsters;
    const scene = game.scene.getScene('battle');
    const units = state.enemies.map(({ id }) => scene.children.getByName(`r6:enemy:${id}`));
    const start = units.map(unit => unit.animationState.getTrack(0).trackTime);
    window.qaMonsters.units = units;
    return new Promise(done => {
      let frames = 0;
      const frame = () => {
        state.tick++;
        // 슬롯 사이는 유지하고 보행 트랙을 실제 전장 갱신으로 진행시킨다.
        for (const enemy of state.enemies) enemy.progress += 1;
        frames++;
        if (frames === 12) {
          game.events.off('prestep', frame);
          done();
        }
      };
      game.events.on('prestep', frame);
      window.qaMonsters.start = start;
    });
  });
  const rendered = await page.evaluate(inspect => window.qaMonsters.units.map((unit, i) => ({
    attachment: unit.skeleton.slots.find(slot => slot.pose.attachment).pose.attachment.path,
    skin: unit.skeleton.skin.name, renderer: unit.rendererType,
    track: unit.animationState.getTrack(0).animation.name,
    moved: unit.animationState.getTrack(0).trackTime > window.qaMonsters.start[i],
    slots: unit.skeleton.slots.filter(slot => slot.pose.attachment).length,
    ...(inspect ? { displayHeight: Number((unit.skeleton.getBoundsRect().height * unit.scaleY).toFixed(1)) } : {}),
  })), inspect);
  assert.deepEqual(rendered.map(({ skin }) => skin), actors.map(([, actor]) => actor.skin));
  assert.ok(rendered.every(unit => unit.renderer === 'phaser' && unit.track === 'walk' && unit.moved && unit.slots > 0),
    'Mesh2D 재생 또는 파츠 확인에 실패했습니다.');
  if (published) {
    for (const s of new Set(actors.filter(([id]) => catalog[id]).map(([id]) => id.split('-')[0]))) assert.ok(requests.has(s + '.webp'), s + ' 아틀라스 전송 확인');
    for (const [i, [, actor]] of actors.entries()) {
      if (actor.rig !== 'g2-walker') assert.ok(rendered[i].attachment.startsWith(actor.rig + '-'));
      else assert.ok(!Object.values(catalog).some(({ rig }) => rendered[i].attachment.startsWith(rig + '-')), '누락 개체 기본 표시');
    }
  } else assert.deepEqual([...requests].sort(), [...allowedFiles].sort());
  const temporary = await mkdtemp(resolve(shots, '.capture-'));
  try {
    const png = resolve(temporary, 'battle-walk.png');
    await page.screenshot({ path: png });
    execFileSync('cwebp', ['-quiet', '-lossless', '-o', resolve(shots, shotName + '-walk.webp'), '--', png]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  const events = await page.evaluate(({ hitIndex, fallIndex, bossIndices }) => {
    const { game, state, units } = window.qaMonsters;
    const { enemyLayer } = game.scene.getScene('battle');
    const skill = bossIndices.map(i => {
      enemyLayer.onBossSkill(state.enemies[i].id);
      return units[i].animationState.getTrack(2)?.animation.name;
    });
    const hitId = state.enemies[hitIndex].id;
    enemyLayer.onHit(hitId);
    const hit = units[hitIndex].animationState.getTrack(1)?.animation.name;
    const falling = state.enemies[fallIndex];
    falling.alive = false;
    enemyLayer.onKill(falling.id);
    const fall = units[fallIndex].animationState.getTrack(0)?.animation.name;
    return { hit, fall, skill };
  }, {
    hitIndex: mixed ? actors.findIndex(([id]) => catalog[id] && id.startsWith('machine-')) : 0,
    fallIndex: mixed ? actors.findIndex(([id]) => catalog[id] && id.startsWith('stone-')) : Math.min(1, actors.length - 1),
    bossIndices: actors.flatMap(([id, actor], i) => id.includes('-boss-') && actor.rig !== 'g2-walker' ? [i] : []),
  });
  assert.deepEqual(events, {
    hit: 'hit', fall: 'fall',
    skill: actors.filter(([id, actor]) => id.includes('-boss-') && actor.rig !== 'g2-walker').map(() => 'boss-skill'),
  });

  assert.deepEqual(errors, []);
  await writeFile(resolve(shots, shotName + '-report.json'), JSON.stringify({
    chromium: browser.version(), seed: selection.seed, wave: selection.wave, rendered: actors.map(([entity], i) => ({ entity, rig: actors[i][1].rig, ...rendered[i] })), events,
  }, null, 2) + '\n');
  console.log(`게임 전장 · Mesh2D ${actors.length}개체 · 걷기 진행·피격·쓰러짐 확인 · 보스 기술 ${events.skill.length}개`);
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
