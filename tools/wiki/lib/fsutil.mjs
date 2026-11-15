import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

const BLOCKED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'playwright-report',
  'test-results',
  '.vitest',
  '.wrangler',
  '.orchestrate',
]);

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function isSecretOrBlockedRel(relPath) {
  const posixRel = toPosix(relPath).replace(/^\.\//, '');
  if (!posixRel) return false;
  const parts = posixRel.split('/');
  for (const part of parts) {
    if (BLOCKED_DIRS.has(part)) return true;
    if (part === '.DS_Store') return true;
  }
  const base = parts.at(-1) ?? '';
  if (
    (base === '.env' || base.startsWith('.env.')) &&
    base !== '.env.example'
  ) {
    return true;
  }
  if (
    (base === '.dev.vars' || base.startsWith('.dev.vars.')) &&
    base !== '.dev.vars.example'
  ) {
    return true;
  }
  if (parts.includes('secrets')) return true;
  return false;
}

export function resolveRel(root, relPath) {
  return path.resolve(root, relPath);
}

export function exists(root, relPath) {
  if (isSecretOrBlockedRel(relPath)) return false;
  return fs.existsSync(resolveRel(root, relPath));
}

export function isFile(root, relPath) {
  if (isSecretOrBlockedRel(relPath)) return false;
  try {
    return fs.statSync(resolveRel(root, relPath)).isFile();
  } catch {
    return false;
  }
}

export function readText(root, relPath) {
  if (isSecretOrBlockedRel(relPath)) {
    throw new Error(`차단된 경로 읽기 거부: ${relPath}`);
  }
  return fs.readFileSync(resolveRel(root, relPath), 'utf8');
}

export function readJson(root, relPath) {
  return JSON.parse(readText(root, relPath));
}

export function writeTextIfChanged(root, relPath, content) {
  if (isSecretOrBlockedRel(relPath)) {
    throw new Error(`차단된 경로 쓰기 거부: ${relPath}`);
  }
  const full = resolveRel(root, relPath);
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  if (fs.existsSync(full)) {
    const prev = fs.readFileSync(full, 'utf8');
    if (prev === normalized) return false;
  } else {
    fs.mkdirSync(path.dirname(full), { recursive: true });
  }
  fs.writeFileSync(full, normalized, 'utf8');
  return true;
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sha256File(root, relPath) {
  if (isSecretOrBlockedRel(relPath)) {
    throw new Error(`차단된 경로 해시 거부: ${relPath}`);
  }
  const buf = fs.readFileSync(resolveRel(root, relPath));
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function charCount(text) {
  return [...text.replace(/\r\n/g, '\n')].length;
}

export function lineCount(text) {
  if (!text) return 0;
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  return normalized.endsWith('\n') ? lines.length - 1 : lines.length;
}

export function estTokens(text) {
  return Math.ceil(charCount(text) * 0.65);
}

export function walkFiles(root, startRel = '.', filterFn = null) {
  const results = [];
  const startFull = resolveRel(root, startRel);
  if (!fs.existsSync(startFull)) return results;

  function visit(currentFull) {
    const entries = fs.readdirSync(currentFull, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (BLOCKED_DIRS.has(entry.name) || entry.name === '.DS_Store') continue;
      const full = path.join(currentFull, entry.name);
      const rel = toPosix(path.relative(root, full));
      if (isSecretOrBlockedRel(rel)) continue;
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.isFile()) {
        if (!filterFn || filterFn(rel)) results.push(rel);
      }
    }
  }

  const stat = fs.statSync(startFull);
  if (stat.isFile()) {
    const rel = toPosix(path.relative(root, startFull));
    if (!isSecretOrBlockedRel(rel) && (!filterFn || filterFn(rel))) {
      results.push(rel);
    }
    return results;
  }
  visit(startFull);
  return results;
}
