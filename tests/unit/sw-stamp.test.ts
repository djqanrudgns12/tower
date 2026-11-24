import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test } from 'vitest';
import viteConfig from '../../vite.config';

test('경로와 크기가 같은 정적 파일도 내용이 바뀌면 캐시 이름이 바뀐다', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tower-sw-'));
  try {
    mkdirSync(join(root, 'public/assets'), { recursive: true });
    copyFileSync(new URL('../../public/sw.js', import.meta.url), join(root, 'public/sw.js'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>캐시 시험</title>');
    const asset = join(root, 'public/assets/board.webp');
    const buildStamp = async (bytes: readonly number[]) => {
      writeFileSync(asset, Buffer.from(bytes));
      await build({ ...viteConfig, configFile: false, root, logLevel: 'silent' });
      return readFileSync(join(root, 'dist/sw.js'), 'utf8').match(/const BUILD_VERSION = '([a-f0-9]{12})'/)?.[1];
    };

    const original = await buildStamp([0, 1, 2, 3]);
    const replaced = await buildStamp([0, 1, 3, 2]);
    expect(original).toMatch(/^[a-f0-9]{12}$/);
    expect(replaced).toMatch(/^[a-f0-9]{12}$/);
    expect(replaced).not.toBe(original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
