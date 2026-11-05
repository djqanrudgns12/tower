#!/usr/bin/env node
/**
 * PNG|WebP 비교판(접촉판)과 화질 수치를 만든다 (docs/HOSTING_IMPL_PLAN.md §2.2의 4번, 단계 1).
 *
 * 쓰는 법
 *   node tools/assets/webp-compare.mjs --out <폴더> [--png-rev <git 커밋, 기본 HEAD>] [--png-dir <PNG 폴더>] [--sheets 이름,…] [--stats]
 *     WebP는 public/assets(manifest의 file)에서, 원래 PNG는 --png-rev 커밋의 public/assets 또는 --png-dir에서 읽는다.
 *     시트는 한 그림마다 [PNG|WebP 실제 표시 크기(칸 72px × displayCells)] [PNG|WebP 2배 확대] 순서로 놓는다(왼쪽이 PNG, 오른쪽이 WebP).
 *     앞 한 쌍은 풀색 바탕, 뒤 한 쌍은 어두운 바탕이다(밝은·어두운 테두리 얼룩이 모두 보이게). 시트는 무손실 WebP로 저장한다.
 *     --stats: manifest 전체의 화질 수치(회색 바탕에 얹은 PSNR, 알파는 무손실이라 색 차이만 잰다)를 <out>/stats.json에 쓴다.
 *   표본은 아래 sheetsFor(데이터)다. 다른 그림을 보려면 --ids <id,…>로 시트 하나(custom)를 만든다.
 *   manifest 밖의 그림(화면 아이콘·설명서 삽화)은 --files <public/assets 기준 경로 또는 패턴,…> --name <시트 이름>
 *     (예: --files 'ui/icon.*.webp,ui/trait.*.webp' --name ui-icons). 1배 너비는 --w1 <px>(기본: 원본 160px 이하면 48px, 아니면 원본의 절반).
 *     --stats를 같이 주면 stats-<이름>.json을 쓴다.
 *
 * 필요한 것: brew install imagemagick (그리고 git)
 */
import { execFile } from 'node:child_process';
import { availableParallelism, tmpdir } from 'node:os';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ASSETS = path.join(ROOT, 'public/assets');
const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf';
const CELL = 72; // 1440×900 전투 화면의 실제 칸(CSS px)
const BG_LIGHT = '#8aa85e', BG_DARK = '#2d3a2a', BG_SHEET = '#e9e4d6', INK = '#1c1c1c';
const PAD = 8, GAP = 20, LABEL_H = 24, SHEET_W = 1960, MIN_TILE_W = 640; // 한 줄 설명(id·용량·PSNR)이 잘리지 않을 너비

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  execFile(cmd, args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
    if (err) reject(Object.assign(err, { stderr: stderr?.toString() ?? '', stdout: stdout?.toString() ?? '' }));
    else resolve(stdout);
  });
});

async function pool(items, worker, size = Math.max(2, availableParallelism())) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await worker(items[i], i); }
  }));
  return results;
}

/** 표본(데이터). 타워는 manifest에서 뽑는다. */
function sheetsFor(manifest) {
  const ids = manifest.assets.map(a => a.id);
  const has = id => ids.includes(id);
  const towers = ids.filter(i => /^tower\.[a-z]+$/.test(i));
  const formsOf = t => ids.filter(i => new RegExp(`^${t.replace('.', '\\.')}\\.[AB][12]?$`).test(i));
  const cycle = ['A', 'B', 'A1', 'B2', 'A2', 'B1'];
  const evolved = towers.map((t, i) => { const forms = formsOf(t); return forms.find(f => f.endsWith(`.${cycle[i % cycle.length]}`)) ?? forms[0]; }).filter(Boolean);
  const factions = [...new Set(ids.map(i => /^([a-z]+)\.boss10$/.exec(i)?.[1]).filter(Boolean))];
  const monsters = factions.flatMap(f => [has(`${f}.walker`) ? `${f}.walker` : `${f}.runner`, `${f}.boss10`]);
  const pick = list => list.filter(has);
  const mapFor = m => ({ ground: `map.${m}.ground.base`, path: `map.${m}.path.dirt` });
  return [
    { name: 'tower-base', ids: towers },
    { name: 'tower-evolved', ids: evolved },
    { name: 'monsters', ids: monsters },
    { name: 'map-ground-path', ids: pick(['ground.grass', 'ground.patch.0', 'ground.meadow.0', 'path.dirt', 'path.tuft.0', 'path.pebbles.0', 'slot.pad.0', ...['river_z', 'courtyard', 'snow_step'].flatMap(m => [mapFor(m).ground, mapFor(m).path, `map.${m}.path.pebbles.0`, `map.${m}.meadow.0`])]) },
    { name: 'map-edge-landmark', ids: pick(['edge.forest.0', 'edge.rocks.0', 'landmark.pond', 'map.gate', 'map.river_z.edge.forest.0', 'map.river_z.landmark.watermill', 'map.courtyard.edge.wall.0', 'map.courtyard.landmark.pavilion', 'map.snow_step.edge.forest.0', 'map.snow_step.landmark.pavilion']) },
  ];
}

const kb = n => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' }, 'png-rev': { type: 'string' }, 'png-dir': { type: 'string' }, sheets: { type: 'string' }, ids: { type: 'string' }, files: { type: 'string' }, name: { type: 'string' }, w1: { type: 'string' }, stats: { type: 'boolean', default: false } } });
  if (!values.out) { console.error('사용법: node tools/assets/webp-compare.mjs --out <폴더> [--png-rev <커밋>] [--png-dir <폴더>] [--sheets 이름,…] [--ids id,…] [--files 경로,… --name 이름 [--w1 px]] [--stats]'); process.exit(1); }
  try { await run('magick', ['-version']); } catch { console.error('magick이 없다. `brew install imagemagick`'); process.exit(1); }
  const out = path.resolve(values.out);
  await mkdir(out, { recursive: true });
  const tmp = await mkdtemp(path.join(tmpdir(), 'webp-compare-'));
  const manifest = JSON.parse(await readFile(path.join(ASSETS, 'manifest.json'), 'utf8'));
  const byId = new Map(manifest.assets.map(a => [a.id, a]));

  // 그림 하나 = { id, pngName(public/assets 기준 PNG 경로), webp(절대 경로), w1(1배 표시 너비), ratio(높이/너비) }.
  const dimsOf = async f => (await run('magick', ['identify', '-format', '%w %h', `${f}[0]`])).toString().trim().split(' ').map(Number);
  const itemOfEntry = entry => ({ id: entry.id, pngName: entry.file.replace(/\.webp$/, '.png'), webp: path.join(ASSETS, entry.file), w1: Math.round(CELL * entry.displayCells), ratio: entry.height / entry.width });
  const itemOfFile = async rel => {
    const webp = path.join(ASSETS, rel), [w, h] = await dimsOf(webp);
    return { id: rel, pngName: rel.replace(/\.webp$/, '.png'), webp, w1: values.w1 ? Number(values.w1) : w <= 160 ? 48 : Math.round(w / 2), ratio: h / w };
  };
  /** --files 토큰(경로 또는 * 패턴)을 .webp 파일 목록으로 푼다. */
  const filesFromArg = async arg => {
    const out = [];
    for (const token of arg.split(',')) {
      if (!token.includes('*')) { out.push(token); continue; }
      const dir = path.posix.dirname(token), re = new RegExp(`^${path.posix.basename(token).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
      for (const f of (await readdir(path.join(ASSETS, dir))).sort()) if (re.test(f)) out.push(path.posix.join(dir, f));
    }
    return out;
  };

  // 원래 PNG를 꺼낸다: --png-dir이면 그 폴더, 아니면 git 커밋에서.
  const pngOf = async item => {
    if (values['png-dir']) return path.resolve(values['png-dir'], item.pngName);
    const dest = path.join(tmp, `src-${item.pngName.split('/').join('__')}`);
    await writeFile(dest, await run('git', ['show', `${values['png-rev'] ?? 'HEAD'}:public/assets/${item.pngName}`], { cwd: ROOT }));
    return dest;
  };
  const webpOf = item => item.webp;

  /** 회색 바탕에 얹은 두 그림의 PSNR(dB). 같으면 99. */
  const psnr = async (png, webp) => {
    const key = `${path.basename(png)}-${path.basename(webp)}`;
    const flat = async (src, tag) => { const f = path.join(tmp, `flat-${tag}-${key}.png`); await run('magick', [src, '-background', 'gray50', '-alpha', 'remove', '-alpha', 'off', f]); return f; };
    const [a, b] = await Promise.all([flat(png, 'a'), flat(webp, 'b')]);
    try { await run('magick', ['compare', '-metric', 'PSNR', a, b, 'null:']); return 99; } catch (e) { const v = parseFloat(e.stderr); return Number.isFinite(v) ? v : 99; }
  };

  const fileItems = values.files ? await Promise.all((await filesFromArg(values.files)).map(itemOfFile)) : null;
  let stats = null;
  if (values.stats) {
    const list = fileItems ?? manifest.assets.filter(a => a.file.endsWith('.webp')).map(itemOfEntry);
    const rows = await pool(list, async a => {
      const png = await pngOf(a);
      return { id: a.id, file: path.relative(ASSETS, a.webp), pngBytes: (await stat(png)).size, webpBytes: (await stat(a.webp)).size, psnr: Math.round((await psnr(png, a.webp)) * 100) / 100 };
    });
    rows.sort((x, y) => x.psnr - y.psnr);
    stats = rows;
    await writeFile(path.join(out, fileItems ? `stats-${values.name ?? 'custom'}.json` : 'stats.json'), `${JSON.stringify(rows, null, 1)}\n`);
    const finite = rows.filter(r => r.psnr < 99);
    console.log(`PSNR(회색 바탕, dB) ${rows.length}장: 최저 ${rows[0].psnr}(${rows[0].id}), 평균 ${(finite.reduce((a, r) => a + r.psnr, 0) / finite.length).toFixed(1)}, 중앙값 ${rows[Math.floor(rows.length / 2)].psnr}`);
    console.log(`가장 낮은 10장: ${rows.slice(0, 10).map(r => `${r.id} ${r.psnr}`).join(', ')}`);
  }

  const wanted = values.sheets ? new Set(values.sheets.split(',')) : null;
  const sheets = fileItems ? [{ name: values.name ?? 'custom', ids: fileItems.map(i => i.id) }] : values.ids ? [{ name: 'custom', ids: values.ids.split(',') }] : sheetsFor(manifest).filter(s => !wanted || wanted.has(s.name));
  const itemById = new Map((fileItems ?? []).map(i => [i.id, i]));

  for (const sheet of sheets) {
    const tiles = await pool(sheet.ids, async id => {
      const entry = byId.get(id);
      if (!entry && !itemById.has(id)) throw new Error(`manifest에 ${id}가 없다`);
      const item = itemById.get(id) ?? itemOfEntry(entry);
      const png = await pngOf(item), webp = webpOf(item);
      const w1 = item.w1, h1 = Math.round(w1 * item.ratio), w2 = w1 * 2, h2 = h1 * 2;
      const width = Math.max(MIN_TILE_W, PAD + 2 * w1 + PAD + GAP + 2 * w2 + PAD + 2 * PAD), height = LABEL_H + h2 + 2 * PAD;
      const x1 = PAD, x2 = PAD + w1 + 2, x3 = PAD + 2 * w1 + 2 + GAP, x4 = x3 + w2 + 2, y1 = LABEL_H + PAD + (h2 - h1), y2 = LABEL_H + PAD;
      const pngBytes = (await stat(png)).size, webpBytes = (await stat(webp)).size, q = await psnr(png, webp);
      const rect = (x, y, w, h, c) => ['-fill', c, '-draw', `rectangle ${x},${y} ${x + w - 1},${y + h - 1}`];
      const put = (src, x, y, w, h) => ['(', src, '-filter', 'Lanczos', '-resize', `${w}x${h}!`, ')', '-geometry', `+${x}+${y}`, '-composite'];
      const file = path.join(tmp, `tile-${sheet.name}-${id.split('/').join('__')}.png`);
      await run('magick', [
        '-size', `${width}x${height}`, `xc:${BG_SHEET}`,
        ...rect(x1, y1, w1, h1, BG_LIGHT), ...rect(x2, y1, w1, h1, BG_LIGHT), ...rect(x3, y2, w2, h2, BG_DARK), ...rect(x4, y2, w2, h2, BG_DARK),
        ...put(png, x1, y1, w1, h1), ...put(webp, x2, y1, w1, h1), ...put(png, x3, y2, w2, h2), ...put(webp, x4, y2, w2, h2),
        '-font', FONT, '-pointsize', '14', '-fill', INK, '-annotate', `+${PAD}+${LABEL_H - 8}`, `${id}   PNG ${kb(pngBytes)} | WebP ${kb(webpBytes)} (${Math.round((webpBytes / pngBytes) * 100)}%)   PSNR ${q >= 99 ? 'inf' : q.toFixed(1)}dB   ${w1}px / ${w2}px`,
        file,
      ]);
      return { id, file, width, height };
    });
    // 선반 쌓기: 왼쪽에서 오른쪽으로 채우다 넘치면 다음 줄.
    const placed = [];
    let x = 0, y = 0, rowH = 0, maxW = 0;
    for (const t of tiles) {
      if (x > 0 && x + t.width > SHEET_W) { x = 0; y += rowH; rowH = 0; }
      placed.push({ ...t, x, y });
      x += t.width; rowH = Math.max(rowH, t.height); maxW = Math.max(maxW, x);
    }
    const total = y + rowH;
    const dest = path.join(out, `webp1-${sheet.name}.webp`);
    await run('magick', ['-size', `${maxW}x${total}`, `xc:${BG_SHEET}`, ...placed.flatMap(t => ['(', t.file, ')', '-geometry', `+${t.x}+${t.y}`, '-composite']), '-define', 'webp:lossless=true', '-define', 'webp:method=6', dest]);
    console.log(`${path.relative(ROOT, dest)}  ${maxW}x${total}  ${kb((await stat(dest)).size)}  그림 ${tiles.length}장`);
  }
  await rm(tmp, { recursive: true, force: true });
  return stats;
}

await main();
