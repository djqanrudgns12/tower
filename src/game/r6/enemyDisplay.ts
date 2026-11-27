import type Phaser from 'phaser';
import type { SpineGameObject } from '@esotericsoftware/spine-phaser-v4';
import { R6_COLORS } from './manifest';

const TINT_MODE_FILL = 1 as Phaser.TintModes;

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

const DIAG = Math.SQRT1_2;
const R6_OUTLINE_OFFSETS_8: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-DIAG, -DIAG], [DIAG, -DIAG], [-DIAG, DIAG], [DIAG, DIAG],
];
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

/**
 * Spine 개체의 뒤쪽 실루엣을 R04 은회(`#B8C0C8`) FILL 모드로 1px 바깥에만 그려
 * 내부 이음매와 원본 색을 건드리지 않고 바닥 대비를 보강한다.
 */
export function attachR6SilhouetteOutline(
  object: SpineGameObject,
  scene: Phaser.Scene,
  getQuality: () => number,
): void {
  const initBackend = (object as unknown as { rendererBackend?: SpineMeshBackend }).rendererBackend;
  if (initBackend && initBackend.type === 'phaser') {
    ensureRenderMeshCounter(initBackend);
  }
  const baseRender = object.renderWebGL;
  object.renderWebGL = function renderWithOuterOutline(
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
    if (capturingOutline || quality >= 2 || src.alpha <= 0.01 || !backend || backend.type !== 'phaser') {
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
    const offsets = quality === 0 ? R6_OUTLINE_OFFSETS_8 : R6_OUTLINE_OFFSETS_4;
    const passAlpha = quality === 0 ? R6_OUTLINE_PASS_ALPHA : R6_OUTLINE_CARDINAL_ALPHA;

    let currentContext = drawingContext;
    try {
      // 1) 실루엣 바깥 1px 은회 패스(뒤쪽)
      for (let o = 0; o < offsets.length; o++) {
        const [ox, oy] = offsets[o]!;
        const dx = ox * step;
        const dy = oy * step;
        for (let i = prevLength; i < capturedMeshes.length; i++) {
          const item = capturedMeshes[i]!;
          const { mesh } = item;
          mesh.x = item.x + dx;
          mesh.y = item.y + dy;
          mesh.setTint(R6_OUTLINE_COLOR);
          mesh.setTint2(0x000000);
          mesh.setTintMode(TINT_MODE_FILL);
          mesh.alpha = item.alpha * passAlpha;
          currentContext = origRenderMesh.call(backend, renderer, mesh, drawingContext, currentContext, parentMatrix);
        }
      }

      // 2) 원본 색 정상 패스(앞쪽): 불투명 내부 색과 부위 이음매를 100% 보존한다.
      for (let i = prevLength; i < capturedMeshes.length; i++) {
        const item = capturedMeshes[i]!;
        const { mesh } = item;
        mesh.x = item.x;
        mesh.y = item.y;
        mesh.setTint(item.tint);
        mesh.setTint2(item.tint2);
        mesh.setTintMode(item.tintMode);
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
}
