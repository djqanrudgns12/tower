/* global document, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const [work, shots] = process.argv.slice(2);
if (!work || !shots) throw new Error('사용법 · node tools/r6/spine/capture-playwright.mjs <작업 폴더> <캡처 폴더>');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const fragment = await readJson(resolve(work, 'manifest-fragment.json'));
const [species] = Object.keys(fragment.species);
const pack = fragment.species[species];
const actors = Object.entries(pack.entities);
const manifest = await readJson('public/assets/r6/manifest-v2.json');
for (const field of ['atlases', 'rigs', 'species']) Object.assign(manifest[field], fragment[field]);
const allowedFiles = new Set([
  ...Object.values(fragment.rigs).map(({ file }) => basename(file)),
  `${species}.atlas`, `${species}.webp`,
]);
const mime = { json: 'application/json', atlas: 'text/plain', webp: 'image/webp' };

await mkdir(shots, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, configFile: 'vite.config.ts' });
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
  await page.route('**/assets/r6/manifest-v2.json', route => route.fulfill({ json: manifest }));
  await page.route(`**/assets/r6/${species}/*`, async route => {
    const file = basename(new URL(route.request().url()).pathname);
    assert.ok(allowedFiles.has(file), `미등록 에셋 요청 · ${file}`);
    requests.add(file);
    await route.fulfill({ path: resolve(work, 'export', species, file), contentType: mime[file.split('.').at(-1)] });
  });
  await page.route('**/r6-monster-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="ko"><meta charset="utf-8"><title>적 동작 확인</title>
<style>body{margin:0;background:#12161b;color:#b8c0c8;font:16px system-ui}main{padding:16px}
h1{font-size:19px;margin:0 0 12px}#field{width:1408px;height:834px}</style>
<main><h1>R6 전장 · 파츠 ${actors.length}개체 확인</h1><div id="field"></div></main></html>`,
  }));
  await page.goto(new URL('r6-monster-fixture', server.resolvedUrls.local[0]).href);
  await page.evaluate(async ({ species, ids }) => {
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
    state.pause = [];
    // 전장 로더가 이 종족만 불러오도록 실제 적 목록을 채운다.
    state.battle = { spawnList: [] };
    state.enemies = ids.map((entityId, index) => {
      const boss = entityId.includes('-boss-');
      const spec = ctx.balance.r6.entities[entityId];
      return {
        id: index + 1, entityId, faction: species, alive: true, derived: false,
        kind: boss ? 'boss' : 'walker', bossTier: boss ? Number(entityId.at(-1)) : null, boss: null,
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
  }, { species, ids: actors.map(([id]) => id) });
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
  const rendered = await page.evaluate(() => window.qaMonsters.units.map((unit, i) => ({
    skin: unit.skeleton.skin.name, renderer: unit.rendererType,
    track: unit.animationState.getTrack(0).animation.name,
    moved: unit.animationState.getTrack(0).trackTime > window.qaMonsters.start[i],
    slots: unit.skeleton.slots.filter(slot => slot.pose.attachment).length,
  })));
  assert.deepEqual(rendered.map(({ skin }) => skin), actors.map(([, actor]) => actor.skin));
  assert.ok(rendered.every(unit => unit.renderer === 'phaser' && unit.track === 'walk' && unit.moved && unit.slots > 0),
    'Mesh2D 재생 또는 파츠 확인에 실패했습니다.');
  assert.deepEqual([...requests].sort(), [...allowedFiles].sort());
  const temporary = await mkdtemp(resolve(shots, '.capture-'));
  try {
    const png = resolve(temporary, 'battle-walk.png');
    await page.screenshot({ path: png });
    execFileSync('cwebp', ['-quiet', '-lossless', '-o', resolve(shots, 'battle-walk.webp'), '--', png]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  const events = await page.evaluate(() => {
    const { game, state, units } = window.qaMonsters;
    const { enemyLayer } = game.scene.getScene('battle');
    const hitId = state.enemies[0].id;
    enemyLayer.onHit(hitId);
    const hit = units[0].animationState.getTrack(1)?.animation.name;
    const fallIndex = units.length === 1 ? 0 : 1;
    const falling = state.enemies[fallIndex];
    falling.alive = false;
    enemyLayer.onKill(falling.id);
    const fall = units[fallIndex].animationState.getTrack(0)?.animation.name;
    const skill = state.enemies.flatMap((enemy, i) => enemy.kind === 'boss'
      ? [units[i].animationState.setAnimation(0, 'boss-skill', false).animation.name] : []);
    return { hit, fall, skill };
  });
  assert.deepEqual(events, {
    hit: 'hit', fall: 'fall', skill: actors.filter(([id]) => id.includes('-boss-')).map(() => 'boss-skill'),
  });
  assert.deepEqual(errors, []);
  await writeFile(resolve(shots, 'battle-report.json'), JSON.stringify({
    chromium: browser.version(), rendered: actors.map(([entity], i) => ({ entity, ...rendered[i] })), events,
  }, null, 2) + '\n');
  console.log(`게임 전장 · Mesh2D ${actors.length}개체 · 걷기 진행·피격·쓰러짐 확인 · 보스 기술 ${events.skill.length}개`);
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
