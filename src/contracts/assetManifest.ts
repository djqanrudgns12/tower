import { z } from 'zod';

// 에셋 납품·배포 manifest(PRD §11.2, §11.5). Codex 이미지 작업은 이 형식으로 납품하고, 총괄이 검수 상태를 올린다.
// 런타임은 status=integrated_pass인 항목만 읽고, 없으면 같은 ID의 임시 그림을 쓴다.
export const ASSET_STATUS = ['draft', 'technical_pass', 'visual_pass', 'integrated_pass', 'rejected'] as const;

const sha = z.string().regex(/^[a-f0-9]{64}$/);

export const assetEntrySchema = z.object({
  id: z.string().regex(/^[a-z]+(\.[a-z0-9_]+)+$/),
  revision: z.number().int().min(1),
  file: z.string().regex(/^[a-z0-9._-]+\.png$/),
  width: z.number().int().min(8).max(2048),
  height: z.number().int().min(8).max(2048),
  originX: z.number().min(0).max(1),
  originY: z.number().min(0).max(1),
  displayCells: z.number().positive().max(2),
  muzzle: z.object({ x: z.number().int(), y: z.number().int() }).optional(),
  layer: z.enum(['body', 'weapon', 'shadow', 'frame', 'ground', 'decor', 'fx', 'ui']),
  frames: z.number().int().min(1).max(8).default(1),
  status: z.enum(ASSET_STATUS),
  sourceHash: sha,
  artifactHash: sha,
  producer: z.string().min(1),
  license: z.string().min(1),
  notes: z.string().optional(),
}).strict();

export const assetManifestSchema = z.object({
  schemaVersion: z.literal('1'),
  jobId: z.string().min(1),
  styleReferenceSha256: sha,
  assets: z.array(assetEntrySchema),
}).strict().superRefine((m, ctx) => {
  const ids = m.assets.map(a => `${a.id}@${a.revision}`);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'id@revision 중복' });
});

export type AssetEntry = z.infer<typeof assetEntrySchema>;
export type AssetManifest = z.infer<typeof assetManifestSchema>;
