import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/content';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { PAD_CELLS } from '../../src/game/layoutGround';
import { artRect, claimedDecorations, distanceToPolyline, GROUND_KITS, grassMasks, groundKitFor, layoutFor, mapLayoutSchema, pathCenterline, pathPolyline, RAW_LAYOUTS, resolvePlacements, steleOriginY } from '../../src/game/layouts';

// 맵 배치표(art-bible-v2 §2)의 형식·가림·풀 마스크 검사. 그림 위치는 렌더러와 같은 artRect로 계산한다.

const manifest = assetManifestSchema.parse(JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')));
const fileOf = new Map(manifest.assets.filter(a => a.status === 'integrated_pass').map(a => [a.id, a.file]));
const garden = MAPS.find(m => m.id === 'garden_u')!;
/** 배치표가 있는 맵. 맵마다 같은 형식·가림 검사를 한다. */
const LAYOUT_MAPS = Object.keys(RAW_LAYOUTS);

/** 8비트 RGBA·비월 없음 PNG의 알파 채널만 읽는다(이 저장소의 원화 형식). */
function readAlpha(file: string) {
  const buf = readFileSync(file);
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) throw new Error(`${file}: 8비트 RGBA 비월 없음 PNG가 아니다`);
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o);
    if (buf.toString('latin1', o + 4, o + 8) === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!, row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4]! : 0, b = y ? px[(y - 1) * stride + x]! : 0, c = y && x >= 4 ? px[(y - 1) * stride + x - 4]! : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter] ?? 0;
      px[y * stride + x] = (raw[row + x]! + pred) & 255;
    }
  }
  const alpha = new Uint8Array(width * height);
  for (let k = 0; k < alpha.length; k++) alpha[k] = px[k * 4 + 3]!;
  return { width, height, alpha };
}

describe('지면 배치표(garden_u)', () => {
  it('연못(d03~d05)·바위 정원(d02)을 배치표가 맡고 비석(d01)은 기존 그림을 쓴다', () => {
    const layout = layoutFor('garden_u')!;
    expect([...claimedDecorations(layout)].sort()).toEqual(['garden_u-d02', 'garden_u-d03', 'garden_u-d04', 'garden_u-d05']);
    const pond = resolvePlacements(layout, garden).find(p => p.asset === 'landmark.pond')!;
    expect([pond.cx, pond.cy]).toEqual([5.5, 2.5]);
  });
});

describe('맵별 지면 재료 묶음', () => {
  it('배치표가 있는 맵은 모두 묶음이 있고, 묶음의 재료·얼룩·받침은 인수된 원화(integrated_pass)다', () => {
    expect(Object.keys(GROUND_KITS).sort()).toEqual(['courtyard', 'garden_u', 'river_z', 'snow_step']);
    for (const id of LAYOUT_MAPS) expect(groundKitFor(id), `${id}: 재료 묶음`).not.toBeNull();
    for (const [id, kit] of Object.entries(GROUND_KITS)) {
      const ids = [kit.base, kit.light, kit.shade, kit.dirt, kit.entry, kit.fallbackPad, ...kit.pads, ...kit.meadows];
      expect(ids.filter(a => !fileOf.has(a)), `${id}: 없는 재료`).toEqual([]);
      expect(kit.meadows).toHaveLength(3);
      // 정원 말고는 맵 id가 붙은 자기 재료만 쓴다(다른 맵 재료를 섞지 않는다).
      if (id !== 'garden_u') for (const a of [kit.base, kit.light, kit.shade, kit.dirt, ...kit.pads, ...kit.meadows]) expect(a.startsWith(`map.${id}.`), `${id}: ${a}`).toBe(true);
    }
  });

  it('배치표가 없는 맵은 묶음이 있어도 기존 지면을 쓴다(layoutFor가 null)', () => {
    for (const m of MAPS) if (!LAYOUT_MAPS.includes(m.id)) expect(layoutFor(m.id), m.id).toBeNull();
    expect(layoutFor('nowhere')).toBeNull();
  });
});

describe.each(LAYOUT_MAPS)('지면 배치표 형식·연결(%s)', mapId => {
  const map = MAPS.find(m => m.id === mapId)!;

  it('형식이 맞고, 장식 칸 연결·에셋·길 이탈이 정상이다', () => {
    expect(mapLayoutSchema.safeParse(RAW_LAYOUTS[mapId]).success).toBe(true);
    const layout = layoutFor(mapId)!;
    expect(layout.mapId).toBe(mapId);
    expect(resolvePlacements(layout, map)).toHaveLength(layout.placements.length);
    expect(layout.placements.map(p => p.asset).filter(id => !fileOf.has(id))).toEqual([]);
    // 랜드마크는 장식 칸에만 둔다(art-bible-v2 §2): 랜드마크 그림은 장식 칸을 맡은 배치여야 한다.
    expect(layout.placements.filter(p => /(^|\.)landmark\./.test(p.asset) && !p.decorationIds).map(p => p.key)).toEqual([]);
    // 맡은 장식 칸은 이 맵에 실제로 있는 칸이다.
    const known = new Set(map.decorations.map(d => d.id));
    for (const id of claimedDecorations(layout)) expect(known.has(id), id).toBe(true);
    // 그리는 길(둥근 굽이 중심선)은 적이 걷는 논리 중심선에서 0.25칸 안에 머문다.
    const line = pathPolyline(map);
    const drift = Math.max(...pathCenterline(map, 0.6, 0.04).map(p => distanceToPolyline(p.x, p.y, line)));
    expect(drift).toBeLessThan(0.25);
  });

  it('소품·숲이 설치 받침·길 중심·장식 칸·비석을 가리지 않는다(알파 128 이상 픽셀 기준)', () => {
    const layout = layoutFor(mapId)!;
    const placed = resolvePlacements(layout, map);
    const line = pathPolyline(map);
    const pad = PAD_CELLS / 2;
    // 길 가장자리 풀 술·자갈은 흙 가장자리까지 덮어도 되지만 적이 걷는 중심 ±0.18칸은 비운다.
    // 나머지는 흙과 가장자리 띠(반폭 0.42칸) 밖에 둔다. 길 아래 지면 얼룩(meadow)은 대상이 아니다.
    const minPathGap = (kind: string) => (kind === 'pathEdge' ? 0.18 : 0.45);
    // 안쪽 숲 덩이(grove)와 들판 소품 무리(field-*)는 설치 자리 칸에서 반 칸 이상 떨어진다(칸 중심에서 ±1칸 밖).
    const clearOfSlots = (kind: string, group: string) => kind === 'grove' || group.startsWith('field');
    // 장식 칸(±0.4칸)은 그 칸을 맡은 배치와 같은 무리(연못 둘레 꽃·돌 등)만 겹칠 수 있다.
    const owner = new Map(layout.placements.flatMap(p => (p.decorationIds ?? []).map(id => [id, p.group ?? p.key] as const)));
    const decorCells = map.decorations.flatMap(d => d.cells.map(([x, y]) => ({ id: d.id, x: x + 0.5, y: y + 0.5 })));
    // 배치표가 맡지 않은 비석은 GroundLayer.placeDecor 그대로(1.05칸, 기준점 0.5·steleOriginY) 칸 위로 솟는다. 그 불투명 영역도 지킨다.
    const stele = readAlpha(`public/assets/${fileOf.get('deco.stele')}`);
    const steleBoxes = map.decorations.filter(d => d.kind === 'culture' && !owner.has(d.id)).map(d => {
      const [x, y] = d.cells[0]!;
      const r = artRect({ key: d.id, kind: 'prop', asset: 'deco.stele', cx: x + 0.5, cy: y + 0.5, w: 1.05, ox: 0.5, oy: steleOriginY(y) }, stele.width, stele.height);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let j = 0; j < stele.height; j++) for (let i = 0; i < stele.width; i++) if (stele.alpha[j * stele.width + i]! >= 128) {
        x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, j); y1 = Math.max(y1, j + 1);
      }
      return { id: d.id, left: r.left + (x0 / stele.width) * r.width, right: r.left + (x1 / stele.width) * r.width, top: r.top + (y0 / stele.height) * r.height, bottom: r.top + (y1 / stele.height) * r.height };
    });
    expect(steleBoxes.map(b => b.id).sort()).toEqual(map.decorations.filter(d => d.kind === 'culture' && !owner.has(d.id)).map(d => d.id).sort());
    const problems: string[] = [];
    for (const p of placed) {
      if (p.kind === 'meadow') continue;
      const group = layout.placements.find(q => q.key === p.key)!.group ?? p.key;
      const img = readAlpha(`public/assets/${fileOf.get(p.asset)}`);
      const r = artRect(p, img.width, img.height);
      const near = <T extends { x: number; y: number }>(list: T[]) => list.filter(c => c.x + pad > r.left && c.x - pad < r.left + r.width && c.y + pad > r.top && c.y - pad < r.top + r.height);
      const slotGap = clearOfSlots(p.kind, group) ? 1 : pad;
      const slots = map.slots.map(s => ({ id: s.id, x: s.x + 0.5, y: s.y + 0.5 })).filter(c => c.x + slotGap > r.left && c.x - slotGap < r.left + r.width && c.y + slotGap > r.top && c.y - slotGap < r.top + r.height);
      const decor = near(decorCells.filter(c => owner.get(c.id) !== group));
      const hits = new Map<string, number>();
      const hit = (what: string) => hits.set(what, (hits.get(what) ?? 0) + 1);
      let pathGap = Infinity;
      for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
        if (img.alpha[j * img.width + i]! < 128) continue;
        const x = r.left + ((i + 0.5) / img.width) * r.width, y = r.top + ((j + 0.5) / img.height) * r.height;
        for (const s of slots) if (Math.abs(x - s.x) < slotGap && Math.abs(y - s.y) < slotGap) hit(`설치 자리 ${s.id}(±${slotGap}칸)`);
        for (const c of decor) if (Math.abs(x - c.x) < pad && Math.abs(y - c.y) < pad) hit(`장식 칸 ${c.id}`);
        for (const b of steleBoxes) if (x > b.left && x < b.right && y > b.top && y < b.bottom) hit(`비석 ${b.id}`);
        pathGap = Math.min(pathGap, distanceToPolyline(x, y, line));
      }
      for (const [what, n] of hits) problems.push(`${p.key}: ${what} 위 ${n}px`);
      if (pathGap < minPathGap(p.kind)) problems.push(`${p.key}: 길 중심에서 ${pathGap.toFixed(3)}칸(최소 ${minPathGap(p.kind)})`);
    }
    expect(problems).toEqual([]);
  });

  it('풀 마스크는 맵 id로 정해지고, 칸 단위 난수 무늬 없이 부드러운 큰 덩어리다', () => {
    const a = grassMasks('garden_u', 15, 9, 16), b = grassMasks('garden_u', 15, 9, 16), other = grassMasks('river_z', 15, 9, 16);
    expect(a.light).toEqual(b.light);
    expect(a.shade).not.toEqual(other.shade);
    const coverage = (v: Float32Array) => v.reduce((s, x) => s + x, 0) / v.length;
    for (const v of [a.light, a.shade]) {
      expect(coverage(v)).toBeGreaterThan(0.2);
      expect(coverage(v)).toBeLessThan(0.4);
      // 이웃 표본(1/16칸) 차이가 작으면 경계가 칸보다 넓게 번진다. 칸마다 다른 난수라면 이 값이 1에 가깝다.
      let step = 0;
      for (let j = 0; j < a.height; j++) for (let i = 1; i < a.width; i++) step = Math.max(step, Math.abs(v[j * a.width + i]! - v[j * a.width + i - 1]!));
      expect(step).toBeLessThan(0.08);
    }
  });
});
