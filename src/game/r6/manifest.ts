import { z } from 'zod';
import { ENTITY_IDS, R6_TOWERS, SPECIES } from '../../contracts/balanceV2';
import type { GameContext } from '../../domain/context';

export const isR6Battlefield = (ctx: GameContext) => ctx.balance.balanceVersion === '2.0.0';
export const R6_COLORS = { carbon: 0x12161b, slate: 0x1d242c, line: 0x4a5563, silver: 0xb8c0c8, amber: 0xe69f24, teal: 0x2fb5a3 };

const path = (ext: string) => z.string().refine(value =>
  /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.[a-z]+$/.test(value) && value.endsWith(ext));
const key = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
const size = z.int().min(1).max(2048);
const pivot = z.tuple([z.int().min(0), z.int().min(0)]);
const sheet = z.strictObject({
  file: path('.webp'), width: size, height: size, count: z.int().min(1).max(256), pivot,
}).refine(s => s.pivot[0] < s.width && s.pivot[1] < s.height);
const frameIndex = z.int().min(0).max(255);
const attack = z.strictObject({
  fps: z.int().min(1).max(60),
  recoilPixels: z.array(z.number().min(0).max(24)).min(1).max(30),
  clip: z.strictObject({
    sheet: key, direction: z.int().min(0).max(15), first: frameIndex, count: z.int().min(1).max(30),
  }).optional(),
});
const towerForm = z.strictObject({
  body: key, bodyFrame: frameIndex, head: key,
  mount: pivot, scale: z.number().positive().max(3), attack,
});
const rig = z.strictObject({
  file: path('.json'), scale: z.number().positive().max(8),
  walk: key, hit: key.optional(), fall: key.optional(),
});
const actor = z.strictObject({ rig: key, skin: z.string().min(1) });
export const r6ManifestSchema = z.strictObject({
  version: z.literal(2),
  maps: z.record(key, path('.webp')),
  sheets: z.record(key, sheet),
  projection: z.strictObject({ zeroBearingDeg: z.number(), squashY: z.number().positive().max(1) }),
  towers: z.partialRecord(z.enum(R6_TOWERS), z.array(towerForm).length(11)),
  atlases: z.record(key, path('.atlas')),
  rigs: z.record(key, rig),
  species: z.partialRecord(z.enum(SPECIES), z.strictObject({
    atlas: key,
    fallback: actor.extend({ tierSkins: z.tuple([z.string(), z.string(), z.string(), z.string()]).optional() }),
    entities: z.partialRecord(z.enum(ENTITY_IDS), actor),
  })),
}).refine(m => Object.values(m.towers).every(forms => forms.every(form => {
  const body = m.sheets[form.body];
  const head = m.sheets[form.head];
  const clip = form.attack.clip;
  const clipSheet = clip && m.sheets[clip.sheet];
  return body && head?.count === 16 && form.bodyFrame < body.count &&
    form.mount[0] < body.width && form.mount[1] < body.height &&
    (!clip || (clipSheet && clip.first + clip.count <= clipSheet.count));
})), { message: '타워 시트·프레임 참조를 확인하세요' })
  .refine(m => Object.entries(m.species).every(([species, pack]) =>
    m.atlases[pack.atlas] && m.rigs[pack.fallback.rig] &&
    Object.entries(pack.entities).every(([id, art]) => id.startsWith(species + '-') && m.rigs[art.rig])),
  { message: '종족 아틀라스·리그 참조를 확인하세요' });

export type R6Manifest = z.infer<typeof r6ManifestSchema>;
export type TowerFormArt = z.infer<typeof towerForm>;
export type R6Sheet = z.infer<typeof sheet>;

export function headDirection(dx: number, dy: number, projection: R6Manifest['projection']): number {
  // Blender의 기울어진 카메라에서 투영된 공간을 펴고, +Y 기준 반시계 순서로 고른다.
  const bearing = Math.atan2(dx, -dy / projection.squashY);
  const zero = projection.zeroBearingDeg * Math.PI / 180;
  return ((Math.round((zero - bearing) * 8 / Math.PI) % 16) + 16) % 16;
}
