import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type Phaser from 'phaser';
import type * as Controllers from '../../src/application/RunController';
import type * as Sessions from '../../src/application/balanceSession';
import type * as QaGold from '../../src/application/qaGold';
import type * as Content from '../../src/content';
import { ENTITY_IDS, SPECIES } from '../../src/contracts/balanceV2';
import type * as Run from '../../src/domain/run';
import type { RunState } from '../../src/domain/types';
import type * as Battlefield from '../../src/game/battlefieldGame';
import type * as Bridges from '../../src/game/bridge';
import type * as EnemyDisplay from '../../src/game/r6/enemyDisplay';
import { expect, test } from './tower-browser';

test.use({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
  trace: { mode: 'off' },
  ...(process.platform === 'darwin' ? { channel: 'chromium', launchOptions: { args: ['--use-angle=metal'] } } : {}),
});

const TOWER_IDS = ['rail', 'mortar', 'cryo', 'prism', 'hangar', 'bastion'] as const;
const OUT_DIR = 'test-results/r6-quality-perf';

interface AtlasCheck {
  key: string;
  species: string;
  width: number;
  height: number;
  isPot: boolean;
  minFilter: number;
  magFilter: number;
  mipmapped: boolean;
}

interface QualityPerfReport {
  timestamp: string;
  viewport: { width: number; height: number; dpr: number };
  cpuRate: number;
  renderer: string;
  enemies: number;
  bosses: number;
  towers: number;
  frames: number;
  elapsedMs: number;
  fps: number;
  p95Ms: number;
  maxMs: number;
  over50Ms: number;
  over100Ms: number;
  avgRenderMeshPerFrame: number;
  maxRenderMeshPerFrame: number;
  qualityLevels: number[];
  atlases: AtlasCheck[];
  allAtlasesPot: boolean;
  allAtlasesMipmapped: boolean;
  avgTexelPerCssPx: number;
  errors: string[];
}

declare global {
  interface Window {
    qaQualityPerf?: {
      game: Phaser.Game;
      controller: Controllers.RunController;
      state: RunState;
      enemyDisplay: typeof EnemyDisplay;
    };
  }
}

test('R6 전장 Q0/Q5 통합 성능·밉맵·드로우콜 계측(1366x768 · CPU 6배 · 40기+보스 2기)', async ({ page, context }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.route('**/r6-quality-perf-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><title>R6 품질·성능 계측</title><div id="field" style="width:1366px;height:768px"></div></html>',
  }));
  await page.goto('/r6-quality-perf-fixture');

  const regularIds = SPECIES.flatMap(sp => [
    `${sp}-infantry-t2`,
    `${sp}-runner-t2`,
    `${sp}-armored-t2`,
    `${sp}-special-t2`,
  ]) as Array<(typeof ENTITY_IDS)[number]>;
  const bossIds = ['stone-boss-t2', 'machine-boss-t4'] as Array<(typeof ENTITY_IDS)[number]>;

  await page.evaluate(async ({ urls, towerIds, regularIds, bossIds }) => {
    const [content, sessions, run, qaGold, controllers, bridges, field, enemyDisplay] = await Promise.all([
      import(urls.content) as Promise<typeof Content>,
      import(urls.sessions) as Promise<typeof Sessions>,
      import(urls.run) as Promise<typeof Run>,
      import(urls.qaGold) as Promise<typeof QaGold>,
      import(urls.controller) as Promise<typeof Controllers>,
      import(urls.bridge) as Promise<typeof Bridges>,
      import(urls.field) as Promise<typeof Battlefield>,
      import(urls.enemyDisplay) as Promise<typeof EnemyDisplay>,
    ]);
    await content.loadGradeContent(3);
    const session = sessions.localBalanceSession('2.0.0', 3, 'Normal', {
      runId: 'qa-r6-quality-perf',
      playerId: 'qa',
      nickname: '성능 계측',
      seed: 1,
      rankingEligibility: 'personal',
      createdAt: '2026-11-27T00:00:00.000Z',
    });
    if (session.version !== '2.0.0') throw Error('R6 전장을 열지 못했습니다.');
    const { ctx, state } = session;
    state.wave = 15;
    state.completedWave = 14;
    state.phase = 'BUILD';
    state.owned = [...towerIds];
    qaGold.grantR6QaGold(state, 500_000);
    for (let i = 0; i < ctx.map.slots.length; i++) {
      const tower = towerIds[i % towerIds.length]!;
      const res = run.applyCommand(ctx, state, { type: 'build', tower, slotId: ctx.map.slots[i]!.id });
      if (!res.ok) throw Error(`타워 설치 실패: ${i}`);
      state.towers.at(-1)!.level = 18;
    }
    if (!run.applyCommand(ctx, state, { type: 'startBattle' }).ok) throw Error('전투 시작 실패');
    const battle = state.battle!;
    battle.intervalTicks = 1;
    while (battle.spawnIndex < battle.spawnList.length) run.advanceTick(ctx, state);

    const templateNormal = state.enemies.find(e => e.kind !== 'boss') ?? state.enemies[0]!;
    const templateBoss = state.enemies.find(e => e.kind === 'boss') ?? state.enemies[0]!;
    const populated: typeof state.enemies = [];
    let nextId = 1000;
    const totalRegular = 38;
    for (let i = 0; i < totalRegular; i++) {
      const entityId = regularIds[i % regularIds.length]!;
      const faction = entityId.split('-')[0] as typeof templateNormal.faction;
      const clone = structuredClone(templateNormal);
      clone.id = nextId++;
      clone.faction = faction;
      clone.entityId = entityId;
      clone.kind = entityId.includes('-armored-') ? 'brute' : entityId.includes('-runner-') ? 'runner' : entityId.includes('-special-') ? 'flyer' : 'walker';
      clone.flying = entityId.startsWith('elf-special-') || entityId.startsWith('machine-special-') || entityId.startsWith('insect-runner-');
      clone.progress = 300 + Math.floor((i * (ctx.path.length * 0.45)) / totalRegular);
      clone.maxHp = clone.hp = 50_000_000;
      clone.alive = true;
      populated.push(clone);
    }
    for (let b = 0; b < bossIds.length; b++) {
      const entityId = bossIds[b]!;
      const faction = entityId.split('-')[0] as typeof templateBoss.faction;
      const clone = structuredClone(templateBoss);
      clone.id = nextId++;
      clone.faction = faction;
      clone.entityId = entityId;
      clone.kind = 'boss';
      clone.flying = false;
      clone.progress = 900 + b * 2200;
      clone.maxHp = clone.hp = 80_000_000;
      clone.alive = true;
      populated.push(clone);
    }
    state.enemies = populated;

    const controller = new controllers.RunController(ctx, state as RunState, { recordOnFinish: false });
    const bridge = new bridges.FieldBridgeHandle(controller);
    await new Promise<void>(resolve => field.startBattlefield(document.getElementById('field')!, bridge, new AbortController().signal, game => {
      window.qaQualityPerf = { game, controller, state: state as RunState, enemyDisplay };
      resolve();
    }));
  }, {
    towerIds: [...TOWER_IDS],
    regularIds,
    bossIds,
    urls: {
      content: '/src/content/index.ts',
      sessions: '/src/application/balanceSession.ts',
      run: '/src/domain/run.ts',
      qaGold: '/src/application/qaGold.ts',
      controller: '/src/application/RunController.ts',
      bridge: '/src/game/bridge.ts',
      field: '/src/game/battlefieldGame.ts',
      enemyDisplay: '/src/game/r6/enemyDisplay.ts',
    },
  });

  // 5종족 아틀라스와 40기 스파인 객체가 모두 준비될 때까지 대기
  await expect.poll(() => page.evaluate(() => {
    const qp = window.qaQualityPerf;
    if (!qp) return { spines: 0, atlases: 0 };
    const scene = qp.game.scene.getScene('battle');
    const spines = qp.state.enemies.filter(e => scene?.children.getByName(`r6:enemy:${e.id}`)).length;
    const atlases = qp.game.textures.getTextureKeys().filter(k => k.startsWith('r6.atlas.') && k.endsWith('.webp') && !k.includes('g2-walker')).length;
    return { spines, atlases };
  }), { timeout: 30_000 }).toEqual({ spines: 40, atlases: 5 });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  const raw = await page.evaluate(({ speciesList }) => new Promise<Omit<QualityPerfReport, 'timestamp' | 'viewport' | 'cpuRate' | 'errors'>>(resolve => {
    const { game, controller, state, enemyDisplay } = window.qaQualityPerf!;
    const scene = game.scene.getScene('battle');
    const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const { gl } = renderer;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const isPot = (n: number) => n > 0 && (n & (n - 1)) === 0;

    // 아틀라스 WebGL 필터·POT 여부 검사
    const atlases: AtlasCheck[] = [];
    for (const sp of speciesList) {
      const key = `r6.atlas.${sp}!${sp}.webp`;
      const tex = game.textures.exists(key) ? game.textures.get(key) : null;
      const src = tex?.source?.[0];
      const glTex = src?.glTexture as { webGLTexture?: WebGLTexture; minFilter?: number; magFilter?: number } | undefined;
      const width = src?.width ?? 0;
      const height = src?.height ?? 0;
      let minFilter = 0;
      let magFilter = 0;
      if (glTex?.webGLTexture) {
        gl.bindTexture(gl.TEXTURE_2D, glTex.webGLTexture);
        minFilter = Number(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER));
        magFilter = Number(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER));
      }
      atlases.push({
        key,
        species: sp,
        width,
        height,
        isPot: isPot(width) && isPot(height),
        minFilter,
        magFilter,
        // WebGL: NEAREST_MIPMAP_NEAREST(9984) ~ LINEAR_MIPMAP_LINEAR(9987)
        mipmapped: minFilter >= 9984 && minFilter <= 9987,
      });
    }

    // 대표 적 텍셀 밀도 계측(Spine 캔버스 높이 대비 표시 높이 비율)
    const densities: number[] = [];
    for (const e of state.enemies.slice(0, 10)) {
      const obj = scene.children.getByName(`r6:enemy:${e.id}`) as { scaleY?: number; displayHeight?: number } | undefined;
      if (obj && obj.scaleY && obj.scaleY > 0) {
        const zoom = scene.cameras.main.zoom * scene.scale.zoom;
        densities.push(1 / Math.max(0.01, Math.abs(obj.scaleY) * zoom));
      }
    }
    const avgTexelPerCssPx = densities.length
      ? Number((densities.reduce((a, b) => a + b, 0) / densities.length).toFixed(2))
      : 0;

    const intervals: number[] = [];
    const meshCounts: number[] = [];
    const qualityLevels = new Set<number>();
    let start = 0;
    let last = 0;
    enemyDisplay.resetR6PerfCounters();

    const onPreRender = () => {
      enemyDisplay.resetR6PerfCounters();
    };
    const onPostRender = () => {
      const now = performance.now();
      const calls = enemyDisplay.r6PerfCounters.renderMeshCalls;
      if (!start) {
        start = last = now;
        return;
      }
      intervals.push(now - last);
      meshCounts.push(calls);
      last = now;
      qualityLevels.add(controller.renderQuality.current);
      if (now - start < 6000) return;

      game.events.off('prerender', onPreRender);
      game.events.off('postrender', onPostRender);
      controller.stop();

      const sorted = intervals.toSorted((a, b) => a - b);
      const totalMesh = meshCounts.reduce((a, b) => a + b, 0);
      resolve({
        renderer: String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
        enemies: state.enemies.length,
        bosses: state.enemies.filter(e => e.kind === 'boss').length,
        towers: state.towers.length,
        frames: intervals.length,
        elapsedMs: Number((now - start).toFixed(1)),
        fps: Number(((intervals.length * 1000) / (now - start)).toFixed(2)),
        p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1]!.toFixed(2)),
        maxMs: Number(sorted.at(-1)!.toFixed(2)),
        over50Ms: intervals.filter(ms => ms > 50).length,
        over100Ms: intervals.filter(ms => ms > 100).length,
        avgRenderMeshPerFrame: Number((totalMesh / Math.max(1, meshCounts.length)).toFixed(1)),
        maxRenderMeshPerFrame: Math.max(0, ...meshCounts),
        qualityLevels: [...qualityLevels],
        atlases,
        allAtlasesPot: atlases.every(a => a.isPot),
        allAtlasesMipmapped: atlases.every(a => a.mipmapped),
        avgTexelPerCssPx,
      });
    };

    game.events.on('prerender', onPreRender);
    game.events.on('postrender', onPostRender);
    controller.start();
  }), { speciesList: [...SPECIES] });

  const report: QualityPerfReport = {
    timestamp: new Date().toISOString(),
    viewport: { width: 1366, height: 768, dpr: 1 },
    cpuRate: 6,
    errors,
    ...raw,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/latest.json`, JSON.stringify(report, null, 2));
  if (process.env.R6_PERF_SAVE_BASELINE === '1') {
    copyFileSync(`${OUT_DIR}/latest.json`, `${OUT_DIR}/baseline.json`);
  }

  console.log(
    `[Q-Perf] ${report.fps}fps · p95=${report.p95Ms}ms · >50ms=${report.over50Ms} · >100ms=${report.over100Ms} · renderMesh=${report.avgRenderMeshPerFrame}/frame · POT=${report.allAtlasesPot} · Mipmap=${report.allAtlasesMipmapped} · Q=${JSON.stringify(report.qualityLevels)}`,
  );

  expect(ENTITY_IDS.length).toBe(100);
  expect(report.errors).toEqual([]);
  expect(report.enemies).toBe(40);
  expect(report.bosses).toBe(2);
  expect(report.frames).toBeGreaterThan(30);
  expect(report.atlases).toHaveLength(5);

  if (process.env.R6_PERF_STRICT === '1') {
    expect(report.allAtlasesPot, '모든 종족 아틀라스 POT 규격').toBe(true);
    expect(report.allAtlasesMipmapped, '모든 종족 아틀라스 MipMapLinear 활성화').toBe(true);
    expect(report.over100Ms, '100ms 이상 프레임 스파이크 0회').toBe(0);
    expect(report.avgRenderMeshPerFrame, '4방위 아웃라인 적용 평균 renderMesh').toBeLessThanOrEqual(1600);
    expect(report.fps, 'CPU 6배 스트레스 45fps 이상').toBeGreaterThanOrEqual(45);
  }
});
