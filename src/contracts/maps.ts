import { z } from 'zod';

const cell = z.tuple([z.number().int().min(0), z.number().int().min(0)]);

export const mapSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  grade: z.number().int().min(3).max(6),
  mapVersion: z.string().min(1),
  gridWidth: z.literal(15),
  gridHeight: z.literal(9),
  waypoints: z.array(cell).min(2),
  pathCells: z.array(cell).min(2),
  pathLength: z.number().int().min(1),
  baseTravelTicks: z.number().int().min(1),
  entryCell: cell,
  exitCell: cell,
  slots: z.array(z.object({ id: z.string().min(1), x: z.number().int().min(0), y: z.number().int().min(0) })).length(20),
  decorations: z.array(z.object({ id: z.string().min(1), kind: z.enum(['culture', 'nature']), cells: z.array(cell).min(1), interactive: z.literal(false) })),
}).loose().superRefine((m, ctx) => {
  const key = ([x, y]: readonly [number, number]) => `${x},${y}`;
  const route = new Set(m.pathCells.map(key));
  if (m.pathLength !== m.pathCells.length - 1) ctx.addIssue({ code: 'custom', message: `${m.id}: pathLength 불일치` });
  for (const s of m.slots) if (route.has(`${s.x},${s.y}`)) ctx.addIssue({ code: 'custom', message: `${m.id}: 길 위 슬롯 ${s.id}` });
});

export const mapsFileSchema = z.object({ schemaVersion: z.string(), maps: z.array(mapSchema).min(1) }).loose();

export type MapConfig = z.infer<typeof mapSchema>;
export type MapSlot = MapConfig['slots'][number];
