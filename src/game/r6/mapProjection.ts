import spec from './mapProjection.json' with { type: 'json' };

type Point = { x: number; y: number };

const [rayX, rayY, rayZ] = spec.cameraRay as [number, number, number];
const horizontal = Math.hypot(rayX, rayY);
const rightX = -rayY / horizontal, rightY = rayX / horizontal;
export const R6_MAP_SQUASH = rayZ / Math.hypot(horizontal, rayZ);
export const R6_MAP_SCALE = spec.pixelsPerCell / 64;
export const r6Pad = { radius: spec.padRadius * spec.pixelsPerCell, size: spec.padSize, pivot: spec.padPivot };
export const r6Overview = spec.overview;

/** 전투 격자 px의 벡터를 직교 카메라의 화면 축으로 옮긴다. */
export function projectFieldDelta(x: number, y: number): Point {
  return { x: R6_MAP_SCALE * (rightX * x - rightY * y), y: R6_MAP_SCALE * R6_MAP_SQUASH * (rightY * x + rightX * y) };
}

/** 높이 0의 길 표면과 설치대 윗면은 동일한 좌표계를 쓴다. */
export function projectField(x: number, y: number): Point {
  const p = projectFieldDelta(x - 480, y - 288);
  return { x: p.x + spec.center[0]!, y: p.y + spec.center[1]! };
}

export function unprojectField(x: number, y: number): Point {
  const u = (x - spec.center[0]!) / R6_MAP_SCALE;
  const v = (y - spec.center[1]!) / (R6_MAP_SCALE * R6_MAP_SQUASH);
  return { x: 480 + rightX * u + rightY * v, y: 288 - rightY * u + rightX * v };
}
