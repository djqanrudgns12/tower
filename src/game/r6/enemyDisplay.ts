import type Phaser from 'phaser';
import type { SpineGameObject } from '@esotericsoftware/spine-phaser-v4';
import { R6_COLORS } from './manifest';

const TINT_MODE_FILL = 1 as Phaser.TintModes;
const TINT_MODE_ADD = 2 as Phaser.TintModes;

const HIGH_CONTRAST_ENTITIES = new Set([
  'elf-runner-t1', 'elf-runner-t2', 'elf-special-t2',
  'human-armored-t1', 'human-armored-t2', 'human-armored-t3', 'human-armored-t4',
  'human-boss-t1', 'human-boss-t4', 'human-infantry-t3', 'human-infantry-t4',
  'stone-armored-t4', 'stone-special-t1',
]);

const MID_CONTRAST_ENTITIES = new Set([
  'elf-armored-t1', 'elf-infantry-t1', 'elf-infantry-t2', 'elf-infantry-t4',
  'elf-runner-t3', 'elf-runner-t4', 'human-special-t2',
  'insect-armored-t1', 'insect-boss-t1', 'insect-boss-t2', 'insect-infantry-t4',
  'insect-runner-t2', 'insect-runner-t4', 'insect-special-t1',
  'machine-infantry-t4', 'machine-runner-t1',
  'stone-runner-t4', 'stone-special-t2', 'stone-special-t3',
]);

export interface OutlineStyle {
  enabled: boolean;
  color: number;
  alpha: number;
}

/** silhouettes.json의 groundContrastRaw 실측에 따른 개체·품질별 4방위 테두리 정책. */
export function r6OutlineStyle(entityId: string | undefined, quality: number): OutlineStyle {
  if (quality >= 2) return { enabled: false, color: R6_COLORS.silver, alpha: 0 };
  if (entityId && HIGH_CONTRAST_ENTITIES.has(entityId)) {
    if (entityId.includes('-boss-')) {
      return { enabled: true, color: R6_COLORS.carbon, alpha: 0.32 };
    }
    return { enabled: false, color: R6_COLORS.carbon, alpha: 0 };
  }
  if (entityId && MID_CONTRAST_ENTITIES.has(entityId)) {
    if (entityId.includes('-boss-')) {
      return { enabled: true, color: R6_COLORS.silver, alpha: 0.36 };
    }
    return { enabled: false, color: R6_COLORS.silver, alpha: 0 };
  }
  return { enabled: true, color: R6_COLORS.silver, alpha: 0.42 };
}

/** 리그 1보행 주기당 이상 화면 보폭(px, scale=1 기준). */
export function r6EnemyStridePx(entityId: string | undefined): number {
  if (!entityId) return 32;
  if (entityId.startsWith('machine-special-')) return 44;
  if (entityId.startsWith('elf-special-')) return 42;
  if (entityId.startsWith('insect-special-')) return 36;
  if (entityId.includes('-special-')) return 38;
  const species = entityId.split('-')[0];
  const isBoss = entityId.includes('-boss-');
  const isRunner = entityId.includes('-runner-');
  const isArmored = entityId.includes('-armored-');
  const base = isBoss ? 36 : isRunner ? 34 : isArmored ? 30 : 28;
  if (species === 'stone') return Math.round(base * 0.92 * 10) / 10;
  if (species === 'insect') return Math.round(base * 1.12 * 10) / 10;
  return base;
}

/** 실제 화면 이동 속도(px/s)에 맞춘 보행 클립 배속을 계산한다. */
export function r6WalkTimeScale(screenSpeedPxPerSec: number, stridePx: number, effectiveScale: number): number {
  const denom = Math.max(8, stridePx * Math.max(0.25, effectiveScale));
  return Math.min(2.2, Math.max(0.45, screenSpeedPxPerSec / denom));
}

/** 코너 방향 전환 히스테리시스 + 100ms 스쿼시-턴 단계 계산. */
export interface TurnStepResult {
  facing: 1 | -1;
  displayFacing: 1 | -1;
  turnStartMs: number;
  scaleXFactor: number;
}

export function r6TurnStep(
  aheadDeltaX: number,
  currentFacing: 1 | -1,
  displayFacing: 1 | -1,
  turnStartMs: number,
  timeMs: number,
  reducedMotion: boolean,
): TurnStepResult {
  const facing: 1 | -1 = Math.abs(aheadDeltaX) >= 2 ? (aheadDeltaX > 0 ? 1 : -1) : currentFacing;
  if (reducedMotion) {
    return { facing, displayFacing: facing, turnStartMs: -1, scaleXFactor: facing };
  }
  if (displayFacing === facing && turnStartMs < 0) {
    return { facing, displayFacing, turnStartMs: -1, scaleXFactor: facing };
  }
  const startMs = turnStartMs < 0 ? timeMs : turnStartMs;
  const elapsed = Math.max(0, timeMs - startMs);
  if (elapsed >= 100) {
    return { facing, displayFacing: facing, turnStartMs: -1, scaleXFactor: facing };
  }
  if (elapsed < 50) {
    const t = elapsed / 50;
    const widthK = 1 - 0.75 * t;
    return { facing, displayFacing, turnStartMs: startMs, scaleXFactor: displayFacing * widthK };
  }
  const t = (elapsed - 50) / 50;
  const widthK = 0.25 + 0.75 * t;
  return { facing, displayFacing: facing, turnStartMs: startMs, scaleXFactor: facing * widthK };
}

/** 품질 단계별 동시 낙하 스켈레톤 상한. */
export function r6MaxFallingSkeletons(quality: number): number {
  if (quality <= 0) return 8;
  if (quality === 1) return 6;
  return 4;
}

/** 캐릭터가 큰 구간의 배율만 눌러 단계별 크기 차이를 남긴다. */
export function r6EnemyScale(scale: number, setupHeight: number, boss: boolean): number {
  const height = scale * setupHeight;
  const knee = boss ? 86 : 37;
  if (height <= knee) return scale;
  const compressed = knee + (height - knee) * (boss ? .13 : .28);
  return Math.min(compressed, boss ? 95 : 54) / setupHeight;
}

const R6_VISUAL_LIFT_CELLS: ReadonlyArray<readonly [prefix: string, liftCells: number]> = [
  ['elf-special-', 0.22],
  ['machine-special-', 0.19],
  ['insect-runner-', 0.16],
];

/** R6 전장에서 비행 그림자와 띄운 높이를 적용할 개체인지 판별한다. */
export function isR6VisualFlyer(entityId: string | undefined, flying: boolean): boolean {
  if (flying) return true;
  if (!entityId) return false;
  return R6_VISUAL_LIFT_CELLS.some(([prefix]) => entityId.startsWith(prefix));
}

/** R6 비행 개체의 시각적 부유 높이(칸). 끌어내려진 동안은 0이다. */
export function r6VisualFlyerLiftCells(entityId: string | undefined, flying: boolean, grounded: boolean): number {
  if (grounded) return 0;
  if (entityId) {
    for (const [prefix, lift] of R6_VISUAL_LIFT_CELLS) {
      if (entityId.startsWith(prefix)) return lift;
    }
  }
  return flying ? 0.20 : 0;
}

export interface FlyerShadowSpec {
  width: number;
  height: number;
  offsetY: number;
  fillAlpha: number;
  outerAlpha: number;
  tealAlpha: number;
}

/** R6 비행 그림자 크기·오프셋·불투명도를 계산해 본체에 붙어 보이게 절제한다. */
export function r6FlyerShadowSpec(cells: number, lift: number, cellPx: number): FlyerShadowSpec {
  const k = 1 - 0.22 * Math.min(1, lift / (cellPx * 0.22));
  return {
    width: cellPx * Math.min(0.46, cells * 0.48) * k,
    height: cellPx * 0.13 * k,
    offsetY: -lift * 0.12,
    fillAlpha: 0.36 * k,
    outerAlpha: 0.68 * k,
    tealAlpha: 0.46 * k,
  };
}

export const R6_OUTLINE_COLOR = R6_COLORS.silver;
export const R6_OUTLINE_PASS_ALPHA = 0.25;
export const R6_OUTLINE_CARDINAL_ALPHA = 0.45;

const R6_OUTLINE_OFFSETS_4: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

/** 화면 1 CSS px에 대응하는 월드 좌표 보폭을 계산한다. */
export function r6OutlineStepPx(cameraZoom: number, scaleZoom: number): number {
  return Math.min(2.2, Math.max(0.5, 1 / Math.max(0.01, cameraZoom * scaleZoom)));
}

type TintedMesh2D = Phaser.GameObjects.Mesh2D & Phaser.GameObjects.Components.Tint & {
  tint2: number;
  setTint2(value: number): TintedMesh2D;
};

interface CapturedSlotMesh {
  mesh: TintedMesh2D;
  x: number;
  y: number;
  tint: number;
  tint2: number;
  tintMode: number;
  alpha: number;
}

interface SpineMeshBackend {
  type: string;
  renderMesh: (
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    mesh: TintedMesh2D,
    baseContext: Phaser.Renderer.WebGL.DrawingContext,
    currentContext: Phaser.Renderer.WebGL.DrawingContext,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ) => Phaser.Renderer.WebGL.DrawingContext;
}

const capturedMeshes: CapturedSlotMesh[] = [];
let capturingOutline = false;

/** 프레임별 Spine renderMesh 실제 제출 횟수를 계측하는 경량 카운터(HMR/이중 번들 간 단일 인스턴스 보장). */
const PERF_COUNTER_KEY = Symbol.for('vocabulary-td.r6PerfCounters');
const globalCounters = globalThis as Record<symbol, { renderMeshCalls: number }>;
export const r6PerfCounters: { renderMeshCalls: number } = (globalCounters[PERF_COUNTER_KEY] ??= { renderMeshCalls: 0 });

export function resetR6PerfCounters(): void {
  r6PerfCounters.renderMeshCalls = 0;
}

const countedBackends = new WeakSet<object>();

function ensureRenderMeshCounter(backend: SpineMeshBackend): void {
  if (countedBackends.has(backend)) return;
  const orig = backend.renderMesh;
  backend.renderMesh = function countedRenderMesh(renderer, mesh, baseCtx, currentCtx, parentMatrix) {
    r6PerfCounters.renderMeshCalls += 1;
    return orig.call(this, renderer, mesh, baseCtx, currentCtx, parentMatrix);
  };
  countedBackends.add(backend);
}

export interface SilhouetteOutlineOptions {
  entityId?: string | undefined;
  getHitFlash?: (() => number) | undefined;
  isFalling?: (() => boolean) | undefined;
}

/**
 * Spine 개체의 뒤쪽 실루엣을 개체 대비 등급에 맞는 4방위 FILL 모드로 1px 바깥에만 그려
 * 내부 이음매와 원본 색을 건드리지 않고 바닥 대비를 보강하며, 피격 플래시를 베이스 패스에 0-추가패스로 합친다.
 * Phaser 4의 `_renderSteps` 배열을 함께 교체해야 실제 WebGL 렌더 파이프라인에 연결된다.
 */
export function attachR6SilhouetteOutline(
  object: SpineGameObject,
  scene: Phaser.Scene,
  getQuality: () => number,
  options?: SilhouetteOutlineOptions,
): void {
  const initBackend = (object as unknown as { rendererBackend?: SpineMeshBackend }).rendererBackend;
  if (initBackend && initBackend.type === 'phaser') {
    ensureRenderMeshCounter(initBackend);
  }
  const baseRender = object.renderWebGL;
  const renderWithOuterOutline: typeof baseRender = function renderWithOuterOutline(
    this: SpineGameObject,
    renderer,
    src,
    drawingContext,
    parentMatrix,
    renderStep,
    displayList,
    displayListIndex,
  ) {
    const quality = getQuality();
    const backend = (src as unknown as { rendererBackend?: SpineMeshBackend }).rendererBackend;
    if (backend && backend.type === 'phaser' && !capturingOutline) {
      ensureRenderMeshCounter(backend);
    }
    const hitFlash = options?.getHitFlash?.() ?? 0;
    const falling = Boolean(options?.isFalling?.());
    const style = falling
      ? { enabled: false, color: R6_OUTLINE_COLOR, alpha: 0 }
      : r6OutlineStyle(options?.entityId, quality);

    if (
      capturingOutline
      || src.alpha <= 0.01
      || !backend
      || backend.type !== 'phaser'
      || (!style.enabled && hitFlash <= 0)
    ) {
      baseRender.call(this, renderer, src, drawingContext, parentMatrix, renderStep, displayList, displayListIndex);
      return;
    }

    const origRenderMesh = backend.renderMesh;
    const prevLength = capturedMeshes.length;
    capturingOutline = true;
    backend.renderMesh = (_r, mesh, _baseCtx, currentCtx) => {
      capturedMeshes.push({
        mesh,
        x: mesh.x,
        y: mesh.y,
        tint: mesh.tint,
        tint2: mesh.tint2,
        tintMode: mesh.tintMode,
        alpha: mesh.alpha,
      });
      return currentCtx;
    };
    try {
      baseRender.call(this, renderer, src, drawingContext, parentMatrix, renderStep, displayList, displayListIndex);
    } finally {
      backend.renderMesh = origRenderMesh;
      capturingOutline = false;
    }

    const count = capturedMeshes.length - prevLength;
    if (count <= 0) return;

    const camera = drawingContext.camera ?? scene.cameras.main;
    const step = r6OutlineStepPx(camera.zoom, scene.scale.zoom);
    let currentContext = drawingContext;
    try {
      // 1) 실루엣 바깥 1px 4방위 패스(뒤쪽) — 저·중대비 개체 위주
      if (style.enabled) {
        for (let o = 0; o < R6_OUTLINE_OFFSETS_4.length; o++) {
          const [ox, oy] = R6_OUTLINE_OFFSETS_4[o]!;
          const dx = ox * step;
          const dy = oy * step;
          for (let i = prevLength; i < capturedMeshes.length; i++) {
            const item = capturedMeshes[i]!;
            const { mesh } = item;
            mesh.x = item.x + dx;
            mesh.y = item.y + dy;
            mesh.setTint(style.color);
            mesh.setTint2(0x000000);
            mesh.setTintMode(TINT_MODE_FILL);
            mesh.alpha = item.alpha * style.alpha;
            currentContext = origRenderMesh.call(backend, renderer, mesh, drawingContext, currentContext, parentMatrix);
          }
        }
      }

      // 2) 원본 색 정상 패스(앞쪽) + 0-추가패스 피격 플래시(ADD)
      for (let i = prevLength; i < capturedMeshes.length; i++) {
        const item = capturedMeshes[i]!;
        const { mesh } = item;
        mesh.x = item.x;
        mesh.y = item.y;
        if (hitFlash > 0) {
          mesh.setTint(0x404040);
          mesh.setTint2(0x404040);
          mesh.setTintMode(TINT_MODE_ADD);
        } else {
          mesh.setTint(item.tint);
          mesh.setTint2(item.tint2);
          mesh.setTintMode(item.tintMode);
        }
        mesh.alpha = item.alpha;
        currentContext = origRenderMesh.call(backend, renderer, mesh, drawingContext, currentContext, parentMatrix);
      }

      if (currentContext !== drawingContext) {
        renderer.renderNodes.finishBatch();
        currentContext.release();
        drawingContext.beginDraw();
      }
    } finally {
      capturedMeshes.length = prevLength;
    }
  };
  object.renderWebGL = renderWithOuterOutline;
  const steps = (object as unknown as { _renderSteps?: Array<typeof baseRender> })._renderSteps;
  if (Array.isArray(steps)) {
    const idx = steps.indexOf(baseRender);
    if (idx >= 0) steps[idx] = renderWithOuterOutline;
  }
}
