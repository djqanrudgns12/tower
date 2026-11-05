#!/usr/bin/env node
/**
 * PNG → WebP 변환 도구 (docs/HOSTING_IMPL_PLAN.md §2). 외부 의존성 없이 cwebp(libwebp)와 ImageMagick(알파 검사)만 부른다.
 *
 * 쓰는 법
 *   node tools/assets/to-webp.mjs <PNG 파일…> [--out <폴더>]
 *       각 PNG를 같은 이름의 .webp로 바꾼다(기본: PNG와 같은 폴더, --out이면 그 폴더). 크기·sha256을 출력한다.
 *       게임에 새 그림 한두 장을 넣을 때: node tools/assets/to-webp.mjs asset-source/<작업>/foo.png --out public/assets
 *       그다음 manifest.json의 file을 .webp로, artifactHash를 출력된 sha256으로 적는다(sourceHash는 원본 그대로).
 *   node tools/assets/to-webp.mjs --manifest [<PNG 파일…>] [--manifest-path <manifest.json>]
 *       manifest(기본 public/assets/manifest.json)의 integrated_pass 항목 중 file이 .png인 것을 모두(또는 인자로 준 PNG만)
 *       .webp로 바꾸고 file·artifactHash를 갱신한다. sourceHash는 건드리지 않는다. 옛 PNG는 지우지 않는다(git rm으로 뺀다).
 *
 * 변환 설정
 *   기본 -q 85 -alpha_q 100 -m 6 (손실, 투명도는 무손실). 파일별 예외는 tools/assets/webp-exceptions.json
 *   ([{ file, mode, reason }], mode: q92 | lossless | png). file은 PNG 파일 이름(예: tower.archer.A.r1.png)이거나
 *   public/assets 기준 경로 패턴(예: ui/*.png, * 는 한 폴더 안, ** 는 하위 폴더까지). png는 변환하지 않고 PNG로 둔다.
 *   (단계 4에서 ui·guide 그림을 바꿀 때는 해당 png 예외 항목을 먼저 지운다. tests/unit/webp-assets.test.ts가 안 쓰는 png 예외도 실패로 본다.)
 *
 * 검사: 변환할 때마다 PNG와 WebP의 크기와 알파 채널(8비트)이 바이트 단위로 같은지 본다. 다르면 그 파일은 실패이고
 * (WebP를 지우고 manifest도 바꾸지 않는다) 종료 코드는 1이다. WebP가 PNG의 90% 이상이면 PNG 유지 후보로 알린다.
 *
 * 필요한 것: brew install webp imagemagick
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  execFile(cmd, args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
    if (err) reject(Object.assign(err, { stderr: stderr?.toString() ?? '' }));
    else resolve(stdout);
  });
});

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXCEPTIONS_FILE = path.join(import.meta.dirname, 'webp-exceptions.json');
const DEFAULT_MANIFEST = path.join(ROOT, 'public/assets/manifest.json');
const MODES = { default: ['-q', '85', '-alpha_q', '100', '-m', '6'], q92: ['-q', '92', '-alpha_q', '100', '-m', '6'], lossless: ['-lossless', '-z', '9'] };

/** `*`는 한 폴더 안, `**`는 하위 폴더까지. */
const globToRegExp = glob => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\uE000').replace(/\*/g, '[^/]*').replace(/\uE000/g, '.*')}$`);

async function loadExceptions() {
  const list = JSON.parse(await readFile(EXCEPTIONS_FILE, 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${EXCEPTIONS_FILE}: 배열이어야 한다`);
  for (const e of list) {
    if (typeof e.file !== 'string' || !['q92', 'lossless', 'png'].includes(e.mode) || typeof e.reason !== 'string' || !e.reason) throw new Error(`${EXCEPTIONS_FILE}: 잘못된 항목 ${JSON.stringify(e)} (file, mode: q92|lossless|png, reason 필요)`);
  }
  return list.map(e => ({ ...e, test: e.file.includes('/') || e.file.includes('*') ? (rel => globToRegExp(e.file).test(rel)) : (rel => path.posix.basename(rel) === e.file) }));
}

/** 이 PNG에 맞는 예외(없으면 null). rel은 public/assets 기준 경로(그 밖의 파일이면 이름만). */
const exceptionFor = (exceptions, rel) => exceptions.find(e => e.test(rel)) ?? null;

async function preflight() {
  const need = [['cwebp', ['-version'], 'brew install webp'], ['magick', ['-version'], 'brew install imagemagick']];
  let bad = false;
  for (const [cmd, args, how] of need) {
    try { await run(cmd, args); } catch { console.error(`${cmd}가 없다. \`${how}\`로 설치한 뒤 다시 실행한다.`); bad = true; }
  }
  if (bad) process.exit(1);
}

const show = f => { const r = path.relative(ROOT, f); return r.startsWith('..') ? f : r; };
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

/** PNG와 WebP의 가로·세로와 알파 채널이 같은지 본다. 같으면 null, 다르면 이유. */
async function alphaMismatch(png, webp) {
  const alpha = f => run('magick', [f, '-alpha', 'extract', '-depth', '8', 'gray:-']);
  const dims = f => run('magick', ['identify', '-format', '%w %h', `${f}[0]`]).then(b => b.toString().trim());
  const [pd, wd] = await Promise.all([dims(png), dims(webp)]);
  if (pd !== wd) return `크기가 다르다(PNG ${pd}, WebP ${wd})`;
  const [pa, wa] = await Promise.all([alpha(png), alpha(webp)]);
  if (!pa.equals(wa)) {
    let diff = 0;
    for (let i = 0; i < Math.min(pa.length, wa.length); i++) if (pa[i] !== wa[i]) diff++;
    return `알파가 다르다(${diff}/${pa.length}픽셀)`;
  }
  return null;
}

/** 하나를 변환한다. 결과 { src, out, mode, pngBytes, webpBytes, sha, error }. mode가 png면 건너뛴다. */
async function convertOne(png, out, mode) {
  const pngBytes = (await stat(png)).size;
  if (mode === 'png') return { src: png, out: png, mode, pngBytes, webpBytes: pngBytes, sha: null, error: null, kept: true };
  try {
    await run('cwebp', ['-quiet', ...MODES[mode], png, '-o', out]);
    const webpBytes = (await stat(out)).size;
    const why = await alphaMismatch(png, out);
    if (why) { await unlink(out); return { src: png, out, mode, pngBytes, webpBytes, sha: null, error: why }; }
    return { src: png, out, mode, pngBytes, webpBytes, sha: sha256(await readFile(out)), error: null };
  } catch (e) {
    await unlink(out).catch(() => undefined);
    return { src: png, out, mode, pngBytes, webpBytes: 0, sha: null, error: `cwebp 실패: ${(e.stderr || e.message).trim().slice(0, 200)}` };
  }
}

async function pool(items, worker, size = Math.max(2, availableParallelism())) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await worker(items[i], i); }
  }));
  return results;
}

const mb = n => `${(n / 1048576).toFixed(2)}MB`;

async function main() {
  const { values, positionals } = parseArgs({
    options: { manifest: { type: 'boolean', default: false }, 'manifest-path': { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', default: false } },
    allowPositionals: true,
  });
  if (values.help || (!values.manifest && positionals.length === 0)) {
    console.log('사용법: node tools/assets/to-webp.mjs <PNG 파일…> [--out <폴더>]\n        node tools/assets/to-webp.mjs --manifest [<PNG 파일…>] [--manifest-path <manifest.json>]\n자세한 설명은 이 파일 머리 주석.');
    process.exit(values.help ? 0 : 1);
  }
  await preflight();
  const exceptions = await loadExceptions();
  const manifestPath = path.resolve(values['manifest-path'] ?? DEFAULT_MANIFEST);
  const assetsDir = path.dirname(manifestPath);
  const relOf = file => (path.relative(assetsDir, file).startsWith('..') ? path.basename(file) : path.relative(assetsDir, file).split(path.sep).join('/'));
  const given = positionals.map(p => path.resolve(p));

  let jobs; // { png, out, entry? }
  let manifest = null;
  if (values.manifest) {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const wanted = given.length ? new Set(given) : null;
    jobs = manifest.assets.filter(a => a.status === 'integrated_pass' && a.file.endsWith('.png') && (!wanted || wanted.has(path.join(assetsDir, a.file))))
      .map(entry => ({ png: path.join(assetsDir, entry.file), out: path.join(values.out ? path.resolve(values.out) : assetsDir, entry.file.replace(/\.png$/, '.webp')), entry }));
    if (wanted && jobs.length !== wanted.size) console.error(`manifest에 없는 PNG ${wanted.size - jobs.length}개는 건너뛴다.`);
  } else {
    for (const g of given) if (!g.endsWith('.png')) { console.error(`PNG만 변환한다: ${g}`); process.exit(1); }
    const outDir = values.out ? path.resolve(values.out) : null;
    jobs = given.map(png => ({ png, out: path.join(outDir ?? path.dirname(png), path.basename(png).replace(/\.png$/, '.webp')) }));
  }

  const results = await pool(jobs, async job => {
    const ex = exceptionFor(exceptions, relOf(job.png));
    return { ...job, ...(await convertOne(job.png, job.out, ex?.mode === 'q92' || ex?.mode === 'lossless' || ex?.mode === 'png' ? ex.mode : 'default')), reason: ex?.reason ?? null };
  });

  const failed = results.filter(r => r.error);
  const converted = results.filter(r => !r.error && !r.kept);
  const kept = results.filter(r => r.kept);
  if (manifest) {
    for (const r of converted) { r.entry.file = r.entry.file.replace(/\.png$/, '.webp'); r.entry.artifactHash = r.sha; }
    if (converted.length) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  for (const r of results) {
    if (r.error) console.error(`실패 ${show(r.src)}: ${r.error}`);
    else if (!manifest) console.log(`${show(r.out)}  ${r.pngBytes}B → ${r.webpBytes}B  sha256=${r.sha ?? '(PNG 유지)'}`);
  }
  const sum = (list, k) => list.reduce((a, r) => a + r[k], 0);
  console.log(`변환 ${converted.length}개: ${mb(sum(converted, 'pngBytes'))} → ${mb(sum(converted, 'webpBytes'))} (${converted.length ? Math.round((sum(converted, 'webpBytes') / sum(converted, 'pngBytes')) * 100) : 0}%), 알파·크기 불일치 ${failed.filter(r => /알파|크기/.test(r.error)).length}개, 실패 ${failed.length}개`);
  const modes = results.filter(r => r.mode !== 'default');
  if (modes.length) console.log(`예외 ${modes.length}개: ${modes.map(r => `${path.basename(r.src)}=${r.mode}`).join(', ')}`);
  if (kept.length) console.log(`PNG 유지 ${kept.length}개(예외 목록)`);
  const weak = converted.filter(r => r.mode === 'default' && r.webpBytes >= r.pngBytes * 0.9);
  if (weak.length) console.log(`PNG 유지 후보(WebP가 PNG의 90% 이상) ${weak.length}개: ${weak.map(r => path.basename(r.src)).join(', ')}`);
  if (manifest && converted.length) console.log(`${path.relative(ROOT, manifestPath)}의 file·artifactHash를 ${converted.length}개 갱신했다. 옛 PNG는 git rm으로 뺀다.`);
  process.exit(failed.length ? 1 : 0);
}

await main();
