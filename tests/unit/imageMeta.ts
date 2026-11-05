import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// 시험용 그림 읽기: PNG(8비트 RGBA·비월 없음)와 WebP(손실+ALPH, 무손실 VP8L)의 크기·알파 유무·알파 채널만 읽는다.
// 외부 도구(dwebp·ImageMagick) 없이 돌도록 WebP의 알파(ALPH 조각의 무손실 부호, VP8L)는 직접 푼다. 색은 읽지 않는다.
// 정본 대조: tools/assets/to-webp.mjs가 변환 때 PNG와 WebP의 알파를 ImageMagick으로 대조하고, 이 풀이는 그 결과와 같다(tests/unit/webp-assets.test.ts).

export interface ImageInfo { format: 'png' | 'webp'; width: number; height: number; hasAlpha: boolean }
export interface AlphaImage { width: number; height: number; alpha: Uint8Array }

const isPng = (buf: Buffer) => buf.subarray(1, 4).toString('latin1') === 'PNG';
const isWebp = (buf: Buffer) => buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';

// ── PNG ─────────────────────────────────────────────────────────────────────────

function pngInfo(buf: Buffer): ImageInfo {
  return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), hasAlpha: buf[25] === 4 || buf[25] === 6 };
}

function pngAlpha(buf: Buffer, name: string): AlphaImage {
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) throw new Error(`${name}: 8비트 RGBA 비월 없음 PNG가 아니다`);
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

// ── WebP 조각 ───────────────────────────────────────────────────────────────────

interface WebpChunks { vp8x?: Buffer; alph?: Buffer; vp8?: Buffer; vp8l?: Buffer }

function webpChunks(buf: Buffer): WebpChunks {
  const out: WebpChunks = {};
  for (let o = 12; o + 8 <= buf.length;) {
    const tag = buf.toString('latin1', o, o + 4), len = buf.readUInt32LE(o + 4);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (tag === 'VP8X') out.vp8x = data; else if (tag === 'ALPH') out.alph = data; else if (tag === 'VP8 ') out.vp8 = data; else if (tag === 'VP8L') out.vp8l = data;
    o += 8 + len + (len & 1);
  }
  return out;
}

function webpInfo(buf: Buffer): ImageInfo {
  const c = webpChunks(buf);
  if (c.vp8x) return { format: 'webp', width: 1 + (c.vp8x[4]! | (c.vp8x[5]! << 8) | (c.vp8x[6]! << 16)), height: 1 + (c.vp8x[7]! | (c.vp8x[8]! << 8) | (c.vp8x[9]! << 16)), hasAlpha: (c.vp8x[0]! & 0x10) !== 0 };
  if (c.vp8l) {
    const bits = c.vp8l.readUInt32LE(1);
    return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, hasAlpha: ((bits >>> 28) & 1) === 1 };
  }
  if (c.vp8) return { format: 'webp', width: c.vp8.readUInt16LE(6) & 0x3fff, height: c.vp8.readUInt16LE(8) & 0x3fff, hasAlpha: false };
  throw new Error('WebP 이미지 조각(VP8 /VP8L)이 없다');
}

// ── VP8L(무손실 WebP) 풀이 ─────────────────────────────────────────────────────────

class Bits {
  private pos: number;
  private readonly buf: Buffer;
  constructor(buf: Buffer, start: number) { this.buf = buf; this.pos = start * 8; }
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++, this.pos++) {
      const byte = this.buf[this.pos >> 3];
      if (byte === undefined) throw new Error('VP8L: 데이터가 모자란다');
      v |= ((byte >> (this.pos & 7)) & 1) << i;
    }
    return v;
  }
}

interface Huff { single: number; count: Uint16Array; symbols: Uint16Array }

function buildHuff(lengths: Uint8Array): Huff {
  const count = new Uint16Array(16);
  let used = 0, only = -1;
  lengths.forEach((l, s) => { if (l) { count[l]!++; used++; only = s; } });
  if (used === 0) throw new Error('VP8L: 빈 Huffman 부호');
  const offs = new Uint16Array(16);
  for (let l = 1; l < 15; l++) offs[l + 1] = offs[l]! + count[l]!;
  const symbols = new Uint16Array(used);
  lengths.forEach((l, s) => { if (l) symbols[offs[l]!++] = s; });
  return { single: used === 1 ? only : -1, count, symbols };
}

function sym(br: Bits, h: Huff): number {
  if (h.single >= 0) return h.single; // 기호가 하나뿐인 부호는 비트를 읽지 않는다
  let code = 0, first = 0, index = 0;
  for (let len = 1; len <= 15; len++) {
    code |= br.read(1);
    const n = h.count[len]!;
    if (code - n < first) return h.symbols[index + (code - first)]!;
    index += n; first += n; first <<= 1; code <<= 1;
  }
  throw new Error('VP8L: 잘못된 Huffman 부호');
}

const CODE_LENGTH_ORDER = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function readPrefixCode(br: Bits, alphabet: number): Huff {
  const lengths = new Uint8Array(alphabet);
  if (br.read(1)) { // 간단한 부호: 기호 1~2개
    const two = br.read(1) === 1, wide = br.read(1) === 1;
    lengths[br.read(wide ? 8 : 1)] = 1;
    if (two) lengths[br.read(8)] = 1;
    return buildHuff(lengths);
  }
  const meta = new Uint8Array(19);
  const n = 4 + br.read(4);
  for (let i = 0; i < n; i++) meta[CODE_LENGTH_ORDER[i]!] = br.read(3);
  const lenCode = buildHuff(meta);
  let maxSymbol = alphabet;
  if (br.read(1)) maxSymbol = 2 + br.read(2 + 2 * br.read(3));
  let s = 0, prev = 8;
  while (s < alphabet && maxSymbol-- > 0) {
    const c = sym(br, lenCode);
    if (c < 16) { lengths[s++] = c; if (c) prev = c; continue; }
    const extra = c === 16 ? 2 : c === 17 ? 3 : 7, base = c === 18 ? 11 : 3;
    let repeat = br.read(extra) + base;
    if (s + repeat > alphabet) throw new Error('VP8L: 부호 길이 반복이 넘친다');
    const value = c === 16 ? prev : 0;
    while (repeat-- > 0) lengths[s++] = value;
  }
  return buildHuff(lengths);
}

const DISTANCE_MAP: readonly (readonly [number, number])[] = [
  [0, 1], [1, 0], [1, 1], [-1, 1], [0, 2], [2, 0], [1, 2], [-1, 2], [2, 1], [-2, 1], [2, 2], [-2, 2], [0, 3], [3, 0], [1, 3], [-1, 3],
  [3, 1], [-3, 1], [2, 3], [-2, 3], [3, 2], [-3, 2], [0, 4], [4, 0], [1, 4], [-1, 4], [4, 1], [-4, 1], [3, 3], [-3, 3], [2, 4], [-2, 4],
  [4, 2], [-4, 2], [0, 5], [3, 4], [-3, 4], [4, 3], [-4, 3], [5, 0], [1, 5], [-1, 5], [5, 1], [-5, 1], [2, 5], [-2, 5], [5, 2], [-5, 2],
  [4, 4], [-4, 4], [3, 5], [-3, 5], [5, 3], [-5, 3], [0, 6], [6, 0], [1, 6], [-1, 6], [6, 1], [-6, 1], [2, 6], [-2, 6], [6, 2], [-6, 2],
  [4, 5], [-4, 5], [5, 4], [-5, 4], [3, 6], [-3, 6], [6, 3], [-6, 3], [0, 7], [7, 0], [1, 7], [-1, 7], [5, 5], [-5, 5], [7, 1], [-7, 1],
  [4, 6], [-4, 6], [6, 4], [-6, 4], [2, 7], [-2, 7], [7, 2], [-7, 2], [3, 7], [-3, 7], [7, 3], [-7, 3], [5, 6], [-5, 6], [6, 5], [-6, 5],
  [8, 0], [4, 7], [-4, 7], [7, 4], [-7, 4], [8, 1], [8, 2], [6, 6], [-6, 6], [8, 3], [5, 7], [-5, 7], [7, 5], [-7, 5], [8, 4], [6, 7],
  [-6, 7], [7, 6], [-7, 6], [8, 5], [7, 7], [-7, 7], [8, 6], [8, 7],
];

const divCeil = (a: number, b: number) => Math.ceil(a / b);
const prefixValue = (br: Bits, code: number) => {
  if (code < 4) return code + 1;
  const extra = (code - 2) >> 1;
  return ((2 + (code & 1)) << extra) + br.read(extra) + 1;
};

/** 화소 데이터(색 캐시·LZ77·여러 부호 묶음). level0만 묶음 선택 그림(entropy image)을 가진다. */
function decodeData(br: Bits, xsize: number, ysize: number, level0: boolean): Uint32Array {
  let cacheBits = 0;
  if (br.read(1)) { cacheBits = br.read(4); if (cacheBits < 1 || cacheBits > 11) throw new Error('VP8L: 색 캐시 크기'); }
  let metaBits = 0, meta: Uint32Array | null = null, metaW = 0, groups = 1;
  if (level0 && br.read(1)) {
    metaBits = br.read(3) + 2;
    metaW = divCeil(xsize, 1 << metaBits);
    meta = decodeData(br, metaW, divCeil(ysize, 1 << metaBits), false);
    for (const p of meta) groups = Math.max(groups, ((p >>> 8) & 0xffff) + 1);
  }
  const alphabets = [256 + 24 + (cacheBits ? 1 << cacheBits : 0), 256, 256, 256, 40];
  const codes: Huff[][] = [];
  for (let g = 0; g < groups; g++) codes.push(alphabets.map(a => readPrefixCode(br, a)));
  const total = xsize * ysize, out = new Uint32Array(total), cache = cacheBits ? new Uint32Array(1 << cacheBits) : null;
  const remember = (argb: number) => { if (cache) cache[Math.imul(argb, 0x1e35a7bd) >>> (32 - cacheBits)] = argb; };
  let pos = 0;
  while (pos < total) {
    const g = meta ? (meta[(Math.floor(pos / xsize) >> metaBits) * metaW + ((pos % xsize) >> metaBits)]! >>> 8) & 0xffff : 0;
    const c = codes[g]!;
    const s = sym(br, c[0]!);
    if (s < 256) {
      const r = sym(br, c[1]!), b = sym(br, c[2]!), a = sym(br, c[3]!);
      const argb = ((a << 24) | (r << 16) | (s << 8) | b) >>> 0;
      out[pos++] = argb; remember(argb);
    } else if (s < 280) {
      const len = prefixValue(br, s - 256);
      const code = prefixValue(br, sym(br, c[4]!));
      let dist: number;
      if (code > 120) dist = code - 120;
      else { const [dx, dy] = DISTANCE_MAP[code - 1]!; dist = Math.max(1, dx + dy * xsize); }
      if (dist > pos || pos + len > total) throw new Error('VP8L: 되돌아 복사 범위');
      for (let k = 0; k < len; k++, pos++) { const argb = out[pos - dist]!; out[pos] = argb; remember(argb); }
    } else {
      const argb = cache?.[s - 280];
      if (argb === undefined) throw new Error('VP8L: 색 캐시 번호');
      out[pos++] = argb; remember(argb);
    }
  }
  return out;
}

const ch = { a: (p: number) => p >>> 24, r: (p: number) => (p >>> 16) & 255, g: (p: number) => (p >>> 8) & 255, b: (p: number) => p & 255 };
const pack = (a: number, r: number, g: number, b: number) => ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
const each = (x: number, y: number, f: (u: number, v: number) => number) => pack(f(ch.a(x), ch.a(y)), f(ch.r(x), ch.r(y)), f(ch.g(x), ch.g(y)), f(ch.b(x), ch.b(y)));
const add = (x: number, y: number) => each(x, y, (u, v) => (u + v) & 255);
const avg = (x: number, y: number) => each(x, y, (u, v) => (u + v) >> 1);
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function predict(mode: number, L: number, T: number, TR: number, TL: number): number {
  switch (mode) {
    case 1: return L;
    case 2: return T;
    case 3: return TR;
    case 4: return TL;
    case 5: return avg(avg(L, TR), T);
    case 6: return avg(L, TL);
    case 7: return avg(L, T);
    case 8: return avg(TL, T);
    case 9: return avg(T, TR);
    case 10: return avg(avg(L, TL), avg(T, TR));
    case 11: {
      let pl = 0, pt = 0;
      for (const f of [ch.a, ch.r, ch.g, ch.b]) { const p = f(L) + f(T) - f(TL); pl += Math.abs(p - f(L)); pt += Math.abs(p - f(T)); }
      return pl < pt ? L : T;
    }
    case 12: return pack(clamp(ch.a(L) + ch.a(T) - ch.a(TL)), clamp(ch.r(L) + ch.r(T) - ch.r(TL)), clamp(ch.g(L) + ch.g(T) - ch.g(TL)), clamp(ch.b(L) + ch.b(T) - ch.b(TL)));
    case 13: {
      const m = avg(L, T), half = (f: (p: number) => number) => clamp(f(m) + Math.trunc((f(m) - f(TL)) / 2));
      return pack(half(ch.a), half(ch.r), half(ch.g), half(ch.b));
    }
    default: return 0xff000000;
  }
}

type Transform =
  | { type: 'predictor' | 'cross'; xsize: number; bits: number; data: Uint32Array }
  | { type: 'green'; xsize: number }
  | { type: 'index'; xsize: number; widthBits: number; table: Uint32Array };

function decodeImage(br: Bits, width: number, height: number): Uint32Array {
  const transforms: Transform[] = [];
  let xsize = width;
  while (br.read(1)) {
    const type = br.read(2);
    if (type === 0 || type === 1) {
      const bits = br.read(3) + 2;
      transforms.push({ type: type === 0 ? 'predictor' : 'cross', xsize, bits, data: decodeData(br, divCeil(xsize, 1 << bits), divCeil(height, 1 << bits), false) });
    } else if (type === 2) transforms.push({ type: 'green', xsize });
    else {
      const size = br.read(8) + 1, table = decodeData(br, size, 1, false);
      for (let i = 1; i < size; i++) table[i] = add(table[i]!, table[i - 1]!);
      const widthBits = size > 16 ? 0 : size > 4 ? 1 : size > 2 ? 2 : 3;
      transforms.push({ type: 'index', xsize, widthBits, table });
      xsize = divCeil(xsize, 1 << widthBits);
    }
  }
  let px = decodeData(br, xsize, height, true);
  for (let i = transforms.length - 1; i >= 0; i--) px = inverse(transforms[i]!, px, height);
  return px;
}

const int8 = (v: number) => (v << 24) >> 24;
const delta = (t: number, c: number) => (int8(t) * int8(c)) >> 5;

function inverse(t: Transform, px: Uint32Array, height: number): Uint32Array {
  const w = t.xsize;
  if (t.type === 'green') return px.map(p => pack(ch.a(p), (ch.r(p) + ch.g(p)) & 255, ch.g(p), (ch.b(p) + ch.g(p)) & 255));
  if (t.type === 'index') {
    const out = new Uint32Array(w * height), pw = divCeil(w, 1 << t.widthBits), bpp = 8 >> t.widthBits, mask = (1 << bpp) - 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < w; x++) {
      const packed = ch.g(px[y * pw + (x >> t.widthBits)]!);
      const idx = t.widthBits ? (packed >> ((x & ((1 << t.widthBits) - 1)) * bpp)) & mask : packed;
      out[y * w + x] = t.table[idx] ?? 0;
    }
    return out;
  }
  const bw = divCeil(w, 1 << t.bits);
  if (t.type === 'cross') {
    return px.map((p, i) => {
      const e = t.data[(Math.floor(i / w) >> t.bits) * bw + (((i % w)) >> t.bits)]!;
      const g = ch.g(p), r = (ch.r(p) + delta(ch.b(e), g)) & 255;
      return pack(ch.a(p), r, g, (ch.b(p) + delta(ch.g(e), g) + delta(ch.r(e), r)) & 255);
    });
  }
  const out = new Uint32Array(px.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let pred: number;
    if (i === 0) pred = 0xff000000;
    else if (y === 0) pred = out[i - 1]!;
    else if (x === 0) pred = out[i - w]!;
    else pred = predict((t.data[(y >> t.bits) * bw + (x >> t.bits)]! >>> 8) & 15, out[i - 1]!, out[i - w]!, out[i - w + 1]!, out[i - w - 1]!);
    out[i] = add(px[i]!, pred);
  }
  return out;
}

/** ALPH 조각: 헤더 1바이트(압축·필터) + 알파 평면(무압축 또는 VP8L 초록 채널) + 필터 되돌리기. */
function alphaFromAlph(alph: Buffer, w: number, h: number): Uint8Array {
  const method = alph[0]! & 3, filter = (alph[0]! >> 2) & 3;
  const a = method === 0 ? Uint8Array.from(alph.subarray(1, 1 + w * h)) : Uint8Array.from(decodeImage(new Bits(alph, 1), w, h), p => ch.g(p));
  if (filter) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const pred = i === 0 ? 0 : y === 0 ? a[i - 1]! : x === 0 ? a[i - w]! : filter === 1 ? a[i - 1]! : filter === 2 ? a[i - w]! : clamp(a[i - 1]! + a[i - w]! - a[i - w - 1]!);
      a[i] = (a[i]! + pred) & 255;
    }
  }
  return a;
}

function webpAlpha(buf: Buffer): AlphaImage {
  const { width, height } = webpInfo(buf);
  const c = webpChunks(buf);
  if (c.alph) return { width, height, alpha: alphaFromAlph(c.alph, width, height) };
  if (c.vp8l) {
    if (c.vp8l[0] !== 0x2f) throw new Error('VP8L: 서명이 다르다');
    const px = decodeImage(new Bits(c.vp8l, 5), width, height);
    return { width, height, alpha: webpInfo(buf).hasAlpha ? Uint8Array.from(px, p => ch.a(p)) : new Uint8Array(width * height).fill(255) };
  }
  return { width, height, alpha: new Uint8Array(width * height).fill(255) };
}

// ── 공개 함수 ───────────────────────────────────────────────────────────────────

/** 내용(PNG 또는 WebP)을 보고 형식·크기·알파 유무를 읽는다. 확장자는 보지 않는다. */
export function readImageInfo(buf: Buffer, name = ''): ImageInfo {
  if (isPng(buf)) return pngInfo(buf);
  if (isWebp(buf)) return webpInfo(buf);
  throw new Error(`${name}: PNG도 WebP도 아니다`);
}

/** 내용(PNG 또는 WebP)의 알파 채널(0~255)을 읽는다. */
export function readAlphaFromBuffer(buf: Buffer, name = ''): AlphaImage {
  if (isPng(buf)) return pngAlpha(buf, name);
  if (isWebp(buf)) return webpAlpha(buf);
  throw new Error(`${name}: PNG도 WebP도 아니다`);
}

/** 파일(PNG 또는 WebP)의 알파 채널(0~255)을 읽는다. */
export const readAlpha = (file: string): AlphaImage => readAlphaFromBuffer(readFileSync(file), file);
