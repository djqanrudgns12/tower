import type { QualityLevel } from '../application/renderQuality';

export function battlefieldDensity(level: QualityLevel): number {
  return Math.min(2, window.devicePixelRatio || 1) * (level === 3 ? 0.75 : 1);
}
