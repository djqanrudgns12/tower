import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, toPosix } from './lib/fsutil.mjs';
import { MARKER_TARGET_FILES, REGISTRY_FILES, generateAll } from './gen.mjs';

const WATCH_TARGETS = [
  'package.json',
  'eslint.config.js',
  'src',
  'server/src',
  'server/migrations',
  'server/wrangler.toml',
  'docs',
  'wiki/_data',
];

const MANAGED = new Set([...REGISTRY_FILES, ...MARKER_TARGET_FILES]);

let timer = null;
let running = false;
let suppressUntil = 0;

function scheduleSync() {
  if (Date.now() < suppressUntil) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (running) return;
    running = true;
    try {
      const res = generateAll(REPO_ROOT);
      if (res.changed.length > 0) {
        suppressUntil = Date.now() + 500;
        console.log(`[wiki:watch] 자동 갱신 완료: ${res.changed.join(', ')}`);
      }
    } catch (err) {
      console.error('[wiki:watch] 갱신 실패:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  }, 350);
}

const watchers = [];
for (const rel of WATCH_TARGETS) {
  const full = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const stat = fs.statSync(full);
  const w = fs.watch(
    full,
    { recursive: stat.isDirectory() },
    (_eventType, filename) => {
      if (!filename) {
        scheduleSync();
        return;
      }
      const changedRel = stat.isDirectory()
        ? toPosix(path.join(rel, String(filename)))
        : rel;
      if (MANAGED.has(changedRel)) return;
      if (changedRel.includes('prd_v0_5_validation.json')) return;
      scheduleSync();
    },
  );
  watchers.push(w);
}

console.log('[wiki:watch] 원천 코드·계약·문서 변경 감시 중 (종료: Ctrl+C)...');

function shutdown() {
  for (const w of watchers) w.close();
  if (timer) clearTimeout(timer);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
