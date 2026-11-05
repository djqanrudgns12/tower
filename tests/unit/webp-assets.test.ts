import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assetManifestSchema } from '../../src/contracts/assetManifest';
import { readAlphaFromBuffer, readImageInfo } from './imageMeta';

// 그림 WebP 규칙(docs/HOSTING_IMPL_PLAN.md §2)을 지키는 시험: public/assets 아래 PNG는 tools/assets/webp-exceptions.json의 png 예외뿐이다.
// 그림을 새로 넣을 때 node tools/assets/to-webp.mjs를 잊으면 여기서 걸린다. 알파 풀이(imageMeta.ts)는 cwebp가 만든 작은 표본으로 확인한다.

interface Exception { file: string; mode: 'q92' | 'lossless' | 'png'; reason: string }
const exceptions = JSON.parse(readFileSync('tools/assets/webp-exceptions.json', 'utf8')) as Exception[];
const ASSETS = 'public/assets';

/** `*`는 한 폴더 안, `**`는 하위 폴더까지(tools/assets/to-webp.mjs와 같은 규칙). */
const globRe = (glob: string) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\uE000').replace(/\*/g, '[^/]*').replace(/\uE000/g, '.*')}$`);
const matches = (e: Exception, rel: string) => (e.file.includes('/') || e.file.includes('*') ? globRe(e.file).test(rel) : rel.split('/').at(-1) === e.file);
const pngKept = exceptions.filter(e => e.mode === 'png');

const pngs = (readdirSync(ASSETS, { recursive: true }) as string[]).map(f => f.split('\\').join('/')).filter(f => /\.png$/i.test(f) && statSync(`${ASSETS}/${f}`).isFile());

describe('그림 WebP 규칙(public/assets)', () => {
  it('예외 목록(webp-exceptions.json)은 파일·mode·이유를 모두 적는다', () => {
    expect(Array.isArray(exceptions)).toBe(true);
    for (const e of exceptions) {
      expect(typeof e.file === 'string' && e.file.length > 0, JSON.stringify(e)).toBe(true);
      expect(['q92', 'lossless', 'png'], `${e.file}: mode`).toContain(e.mode);
      expect(typeof e.reason === 'string' && e.reason.trim().length > 0, `${e.file}: 이유 없음`).toBe(true);
    }
  });

  it('public/assets 아래 PNG는 예외 목록(mode png)에 있는 것뿐이다', () => {
    const stray = pngs.filter(f => !pngKept.some(e => matches(e, f)));
    expect(stray, `WebP로 바꾸지 않은 PNG: node tools/assets/to-webp.mjs <PNG> --out public/assets (구현 계획서 §2). 정말 PNG여야 하면 tools/assets/webp-exceptions.json에 이유와 함께 올린다`).toEqual([]);
  });

  it('PNG 예외 항목은 실제 PNG를 하나 이상 가리킨다(전환이 끝난 항목은 지운다)', () => {
    const unused = pngKept.filter(e => !pngs.some(f => matches(e, f))).map(e => e.file);
    expect(unused, '가리키는 PNG가 없는 예외').toEqual([]);
  });

  it('manifest의 file이 .png이면 예외 목록에 올라 있다', () => {
    const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'utf8')));
    const bad = manifest.assets.filter(a => a.file.endsWith('.png') && !pngKept.some(e => matches(e, a.file))).map(a => a.file);
    expect(bad).toEqual([]);
  });

  it('manifest의 .webp 파일은 WebP 형식이다', () => {
    const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'utf8')));
    for (const a of manifest.assets.filter(x => x.file.endsWith('.webp'))) expect(readImageInfo(readFileSync(`${ASSETS}/${a.file}`), a.file).format, a.file).toBe('webp');
  });
});

// ── 알파 풀이 표본: 48×40, 알파는 둥근 그라데이션+점무늬. cwebp 1.6.0 (-q 85 -alpha_q 100 등)으로 만들었다 ───────────────────────────

const W = 48, H = 40;
const alphaAt = (x: number, y: number) => {
  const d = Math.hypot(x - 23.5, y - 19.5);
  let a = d < 8 ? 255 : d < 20 ? Math.round((255 * (20 - d)) / 12) : 0;
  if (x < 4 || y > 34) a = 0;
  if ((x * 7 + y * 13) % 11 === 0 && a > 0) a = Math.max(0, a - 17);
  return a;
};
const expected = Uint8Array.from({ length: W * H }, (_, i) => alphaAt(i % W, Math.floor(i / W)));

const SAMPLES: Record<string, string> = {
  // 손실 + 무손실 알파(ALPH: VP8L 부호, 경사 필터)
  lossy: 'UklGRpwDAABXRUJQVlA4WAoAAAAQAAAALwAAJwAAQUxQSIECAAANoCRJkiPJMa9hyzcjwYH/v40jvYZ1o1n5oaR7BvwaERPAq15f7d6R5XTkr6h8vhHvthDGh90uf9L07u7tHwJcQA2y2yx/xtu3Eu5AGWAUyXb7atPHhx6pDwQuQh+JMqblda4/qFvA3EE1IHERPs1Px9e4fi/kLtEN4ILUSIjb8/Fl06Ej+oyEO1AOZFRCc56WF33sFpI7UreCRiWpQcKoPL7k7ZXmEuqzQHOJ1AhktJAaOW0vm96KmiUx1yRqBuLKQnOSuLJdLnqnSHOJqe6R5ALaCAu/V0gbyuYSbbpQzRKTu8QHmG40WlhqJMQtu1xw1y0kdya+eAZwwe0Pz1lY3EhqkN0luIO6JyTfAsV6/2XCZycwiktu1IeE3CVuWbuAQkncSPrI4dy1wB3ULYELKNb+IaENCK4cz1wB3Qi5A8XaBRQKcYOUOZ2ZBLgQ/RHABRRrf01oBvDb5cz2HdBNhD8DxdoF1DNErkA5Z95tAFxAsXYBxdoFlAE2nI0LUlbgvoBi7QI+GwV34O32zNIM4Eb4mrULKICDO6IMiLMnXIHmED0XUKxd7NMthDuXHlMmMBrJD6xdQMFGchd0X8Qhoyc0J9G+gGLt20jdQhpdl+yoAYk/k3zJ2gXc/iYxuQu6uSiMSmheWDL/cAsF+03mL5jolpB1SXZpDsmohbShm4nfP0TqnpDmEvqwuYRNNFpI/c5CRgPKkrivCdUsRVy8bFNOEjeWlAPMhaaakTQX4oXbU0aFtBHIqKCaBZq7UM3ixY+pQcKoJDVE5C7RLSFPL1ue4kZSIxAX0I3E3BHXh5dxfG4OyahAGcAdqVuIVz0+PDw+PW/4cbc/npYVG/6HAgBWUDgg9AAAALAHAJ0BKjAAKAA+SR6JRCKhjVYCqhQCQlkJgACYGjPAn8p+MHOXIrAuDYIVYvwvtj1wZmTHSHTtzQr/I0zaMSX6LtpDUqAA/v+dcfEoyyJZ+7UGfjBHWWp/rEGf/vHLZAeku+zWG/53AvHxMSodvqXzFWeXHhhbbTxkg/KefK65EC6YqCUmB7TnMCrflKs5Id7aiiWiSNrA3r58IXGGOJjQnWDw8E0Miz+LHjgKuXlLsjIJ35Ejgddy6SvsfKrwwlEm3xgXiX/QBfv/zrtm4YwY2KO4koKebWydalzc/xHCklv4ESwnqKWLZWDAQeFlY74kAAA=',
  // 같은 그림, 알파 필터 없음
  none: 'UklGRtwDAABXRUJQVlA4WAoAAAAQAAAALwAAJwAAQUxQSMcCAAABuTJE9D9EVGtbe/Y4zl45Z/dfW845G3zr/34504OEhj/iowImXfYRFfAVoJcLfew68VEB/8MdYSxgzP+ngEnmrwqYBkwiJmACbspO3uZW77sbn/rExz7C5/FmfsDtxN67wLziXmfO+DO6xd6d7vIeAa96CJAdn3nH9FmcnEjEw4AMgJ7Y2+2OLfd5Q1mqjiASU92W+zLtzH/HqhDwmgJlBzsSc7/5LZd34r97CEVJVABEgrPbOB70tsvrLR8qRM1IRAEZBve0aeHT01r/VggpCqlCRj1tZ8emp9+0zsnvmlOoZoHmFM5ucG/G2b27HbeciJwlMecicgYc6YkWth3p7TRqT5bmFEu+DkmRQOtm4mVp3Lq8GaNNCeUssURJHMNySr2ZKbuNo/mMR/xYIaQoFh5xCBAJd3jGoSemaNjZ8ZkxRIEqFqQ4AJLhBx5lsx829GTMKVWXUJTEAcNIIJHtaNjV/dOq/wRRoAoJIoFkGH/YtA4m0pdX/A5UIBQFJMNIIJFxNHAGuysWAZGIugEQCSTDeBymBUCcTCu2e0AFFrEPJMNIIA/BijRkeMXeBiASSIaRQDKMBDIANqx0JDhDhosJJMNIYD+QiQJOtiumFgDRMD8zjAQS4KcoRAYgVu4SaWhhrMMEkmEkR64QIoqxl52BoTfsPxhGAgkbKUpQMYqf3MumhW0dJZAM48BShZB6acwZsoMd+9hnGUYCBy+RWKIEFYwyPW1aTEye/ziAhKON5/9ZqJBQaIzPuIWxe064dZ1a+OfYUsWCNKfQ8WYMG6s34/yHCfcGZEjiYi4oZ8li9LR1hm1HY3KGgTnRkjOS5kSsud11T+PWDe5plLNAcwnlLNa+4ezY9LSdXVhREhUSimW96bSjYWc3OBKoQGIuxH8/rcflwxbG7mnIAIhCqhBiRy9funTj9OGGZ505urw7DdjwDRQAVlA4IO4AAABQCACdASowACgAPkkeiUQioY1WAqoUAkJZF2ATuLdfQflPxg5y5FYFwbBCwem+wNDCOvSRn6tT2b1ZQw+YtwulG/zNba7RG/S5SwAA/v+dcfEoy5v3xbdd2FVysg2f3e6D/3jlsYPsLUX+lvopq7c7ldNO5xxKYxZKQx7KQEIvrEe2ezqPyL338LNFCzGAxRVglUqnPsFz9ctIISKLhato4Fw/IAzGK1LrP2HOKpM3iSmQgcire5JUFTTHVdfhnwFmTr9GZ9aOsHb24SRZT8MATZb49cpAbuuR9h2aF0CYhSZeT5aozr/A8tq8AAAA',
  // 무손실 WebP(VP8L, 알파 포함: 예측·색 변환·LZ77)
  lossless: 'UklGRnIDAABXRUJQVlA4TGUDAAAvL8AJEAFFbdtAyvotf8S7EUT0fwIAyTnINXLHS/GEXnegoG0bJhDCn+7+EBhI2zYVCdv+6P8EIPKY8q1oWvqhDnpdC+VIkiRJjr/yNQQsJUv8UgECQAMImB8wmVWN+2u4Cp57RFXskSEyh4yT2rZtZZrFT9OAEDRAo9EUowshCEGDbdg0kuSoTpMelfce6CNzSD5+OQwAsGxS2+7+v82LnYKB20aKspBjnJlHCI9bmt5/qATC6CJXASq3yqVyioNforXn5NFeR9Om1SeeAEquFQXiRgWqlCom/DO5e/R+m+LuuY5tqjZNAgKJDkgBsYpRkeL6ObRJ2qSPbcr3bc4HRCcQwEpsFSXUzby5N75K9cP3oqJ31VxUJzOXXV668G/c2MZvE9SMAgSeULnA7k5VqbWCFf7XLbQBbbw2PsITaFYxg2G3c9k4RKuIG3qbqw38sQuPKTBVCDS73QavtHkMK/za4/r+91YzivpJVM0oUytt58JmpQXbo429T1BHFiX6o6B7BOfq9Gicyyrnh23amCxEd1QVRwq/yANwpC8ew7Yj/bq56WqjH111ZHGmIFRVJCDaZS7EP40fV1nILe7Gu6/IWdSDOLuLiBJOEdXDYdd4EW+GZCPZOOdEDEKMVxWxeDz74opH7FxYmC2ICTXjpCpEDCQAworRRjRhw0q2aEQ1V9UQJp8YRVK2O81l4Ube/r/wu2v1GFUFkRuKF5tHAcFEqtwjjQCYQScg98SDcAYjDV94/XMV8yPsScyYxz6QRTbyoZH3chF/70oIcEUatnRHfo/cfJsbHyEAvow07j5nogyC7B77d1AmJrCx0riGD/OI+X9XwoXoqV410jiJNDyGcQmxo8/uQq7XiDiuDAzrEVs8dvSlKmbBDDZbw3lNu8+ZEnZTn1zVx/SatUXDMJQV0WCLcUufxK8K4Y/axKzsJC4uHy+fOn3+4kMMApx00VlRW/hvd+d45dUlpYhOXkXpGjLlyKKevmyqIV19gXjlwusRyKgqBMmzT2AXm1wN5Qz3OXM5w8CR1JkH9SCKnfahcXr1BWKodlT2JWqoEOy2d7eTbZU4O1fhilk1nnPuczW4+wLRKXJIxeKYFCIUjv0mjoYYLrKVM2ORpYBbuqDfBBNcCCERT2E+/yXOC4Av/Pk0AAA=',
};

const clamp = (v: number) => Math.min(255, Math.max(0, v));
const riff = (chunks: [string, Buffer][]) => {
  const body = Buffer.concat(chunks.flatMap(([tag, data]) => {
    const head = Buffer.alloc(8);
    head.write(tag, 0, 'latin1'); head.writeUInt32LE(data.length, 4);
    return [head, data, ...(data.length & 1 ? [Buffer.alloc(1)] : [])];
  }));
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1'); head.writeUInt32LE(body.length + 4, 4); head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, body]);
};
const chunkOf = (buf: Buffer, tag: string) => {
  for (let o = 12; o + 8 <= buf.length; o += 8 + buf.readUInt32LE(o + 4) + (buf.readUInt32LE(o + 4) & 1)) if (buf.toString('latin1', o, o + 4) === tag) return buf.subarray(o + 8, o + 8 + buf.readUInt32LE(o + 4));
  throw new Error(`${tag} 조각 없음`);
};
/** 알파 필터 되돌리기의 정반대: 원본 알파에서 예측값을 뺀 나머지(ALPH 필터 1 가로·2 세로·3 경사). */
function residuals(a: Uint8Array, filter: 1 | 2 | 3) {
  return Uint8Array.from(a, (v, i) => {
    const y = Math.floor(i / W), x = i % W;
    const pred = i === 0 ? 0 : y === 0 ? a[i - 1]! : x === 0 ? a[i - W]! : filter === 1 ? a[i - 1]! : filter === 2 ? a[i - W]! : clamp(a[i - 1]! + a[i - W]! - a[i - W - 1]!);
    return (v - pred) & 255;
  });
}

describe('WebP 알파 풀이(tests/unit/imageMeta.ts)', () => {
  for (const [name, b64] of Object.entries(SAMPLES)) {
    it(`cwebp 표본 ${name}: 크기·알파 표시·알파 채널이 원본과 같다`, () => {
      const buf = Buffer.from(b64, 'base64');
      expect(readImageInfo(buf, name)).toEqual({ format: 'webp', width: W, height: H, hasAlpha: true });
      const { width, height, alpha } = readAlphaFromBuffer(buf, name);
      expect([width, height]).toEqual([W, H]);
      expect(alpha).toEqual(expected);
    });
  }

  for (const filter of [1, 2, 3] as const) {
    it(`ALPH 무압축 + 필터 ${filter}을 되돌린다`, () => {
      const lossy = Buffer.from(SAMPLES.lossy!, 'base64');
      const vp8x = Buffer.from(chunkOf(lossy, 'VP8X'));
      const alph = Buffer.concat([Buffer.from([filter << 2]), residuals(expected, filter)]);
      const buf = riff([['VP8X', vp8x], ['ALPH', alph], ['VP8 ', Buffer.from(chunkOf(lossy, 'VP8 '))]]);
      expect(readAlphaFromBuffer(buf, `필터 ${filter}`).alpha).toEqual(expected);
    });
  }

  it('알파가 없는 WebP는 전부 255로 읽는다', () => {
    const lossy = Buffer.from(SAMPLES.lossy!, 'base64');
    const buf = riff([['VP8 ', Buffer.from(chunkOf(lossy, 'VP8 '))]]);
    expect(readImageInfo(buf).hasAlpha).toBe(false);
    expect(readAlphaFromBuffer(buf).alpha.every(v => v === 255)).toBe(true);
  });
});
