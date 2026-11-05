#!/usr/bin/env node
// 추적 콘텐츠 쓰기·빌드·서버 시험·경로 한정 커밋을 하나의 잠금으로 묶는다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeBlindInput } from '../make-blind-input.mjs';

const generatedPaths = [
  'content-source/approvals/registry.json', 'content-source/approvals/candidate-registry.json',
  ...[3, 4, 5, 6].flatMap(grade => [`src/content/questions/grade${grade}.json`, `src/content/questions/grade${grade}.candidate.json`]),
  'src/content/questions/practice.json', 'server/seed/question_keys.sql',
];
const inputScopes = ['content-source', 'src/content/questions', 'server/seed/question_keys.sql', 'src/content/retractions.json',
  'docs/contracts/balance.candidate.v0.4.json', 'docs/contracts/maps.candidate.v0.4.json'];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
const write = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
function command(root, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' } });
  if (result.error || result.status !== 0) throw new Error(`${executable} ${args.join(' ')} 실패 (${result.status}): ${result.error?.message ?? ''}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result.stdout;
}
const git = (root, ...args) => command(root, 'git', args);
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('잠금 PID가 잘못되어 자동 회수할 수 없다');
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
}
function acquire(root) {
  const lock = path.join(root, '.orchestrate/commit.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const token = randomUUID();
  const take = () => fs.writeFileSync(lock, json({ pid: process.pid, startedAt: new Date().toISOString(), token }), { flag: 'wx' });
  try { take(); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // 두 회수자가 같은 죽은 PID를 보고 새 소유자의 잠금을 지우지 않게 회수도 직렬화한다.
    const reclaim = `${lock}.reclaim`;
    try { fs.mkdirSync(reclaim); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('잠금 회수가 이미 진행 중이다', { cause: error }); throw error; }
    try {
      if (fs.existsSync(lock)) {
        const owner = readJson(lock);
        if (alive(owner.pid)) throw new Error(`커밋 잠금 사용 중: PID ${owner.pid}, ${owner.startedAt}`, { cause: error });
        fs.unlinkSync(lock);
      }
      try { take(); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('커밋 잠금 사용 중', { cause: error }); throw error; }
    } finally { fs.rmdirSync(reclaim); }
  }
  return () => { if (fs.existsSync(lock) && readJson(lock).token === token) fs.unlinkSync(lock); };
}

/** 상대 경로와 모든 기존 부모를 검사해 저장소 밖/심볼릭 링크 쓰기를 막는다. */
function destination(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0')
    || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..' || p === '.git')) throw new Error(`잘못된 저장소 경로: ${relative}`);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`심볼릭 링크 경로 거절: ${relative}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}
function owns(batchId, file) {
  return file.startsWith(`content-source/batches/${batchId}/`) || file.startsWith(`content-source/reviews/${batchId}/`)
    || file.startsWith(`content-source/reviews/archive/${batchId}.`) || file === `content-source/approvals/${batchId}.explanation.json`
    || file.startsWith(`content-source/approvals/archive/${batchId}.explanation.`) || file === `content-source/levels/${batchId}.json`;
}
function discover(root, batch) {
  const base = path.join(root, '.orchestrate/staging');
  if (!fs.existsSync(base)) return [];
  const runs = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || (batch && entry.name !== batch)) continue;
    for (const run of fs.readdirSync(path.join(base, entry.name), { withFileTypes: true })) {
      if (!run.isDirectory()) continue;
      const dir = `.orchestrate/staging/${entry.name}/${run.name}`;
      if (fs.existsSync(path.join(root, dir, 'manifest.json'))) runs.push({ batchId: entry.name, runId: run.name, dir });
    }
  }
  return runs.sort((a, b) => a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : a.batchId.localeCompare(b.batchId));
}
function validateRun(root, run) {
  if (!safeId(run.batchId) || !safeId(run.runId)) throw new Error('잘못된 배치/run ID');
  const manifest = readJson(destination(root, `${run.dir}/manifest.json`));
  if (manifest.batchId !== run.batchId || manifest.runId !== run.runId || !Array.isArray(manifest.writes) || !Array.isArray(manifest.deletes)) throw new Error('manifest 식별자·목록 불일치');
  const seen = new Set();
  for (const file of [...manifest.writes.map(w => w.path), ...manifest.deletes]) {
    destination(root, file);
    if (!owns(run.batchId, file) || seen.has(file)) throw new Error(`배치 밖 또는 중복 경로: ${file}`);
    seen.add(file);
  }
  const writes = manifest.writes.map(item => {
    const bytes = fs.readFileSync(destination(root, `${run.dir}/files/${item.path}`));
    if (sha256(bytes) !== item.sha256) throw new Error(`sha256 불일치: ${run.runId} ${item.path}`);
    return { path: item.path, bytes };
  });
  return { manifest, writes };
}
function quarantine(root, run) {
  const failed = path.join(root, '.orchestrate/staging-failed', run.batchId, run.runId);
  fs.mkdirSync(path.dirname(failed), { recursive: true });
  fs.renameSync(path.join(root, run.dir), fs.existsSync(failed) ? `${failed}-${randomUUID()}` : failed);
}
function changedInputs(root) {
  return new Set([
    ...git(root, 'diff', '--name-only', '--no-renames', '-z', 'HEAD', '--', ...inputScopes).split('\0'),
    ...git(root, 'ls-files', '--others', '--exclude-standard', '-z', '--', ...inputScopes).split('\0'),
  ].filter(Boolean));
}

/**
 * 기본값은 반영·검증·커밋이다. buildBank/buildQuestionKeys/testServer는 임시 저장소 시험용 주입점.
 * noCommit은 검증까지 실행하고 대기분·미커밋 기록을 남긴다. 다른 배치는 먼저 이 기록을 완료해야 한다.
 */
export async function applyStaged(opts = {}) {
  const root = fs.realpathSync(path.resolve(opts.root ?? path.resolve(import.meta.dirname, '../..')));
  const batch = opts.batch ?? opts.batchId;
  if (batch && !safeId(batch)) throw new Error('잘못된 batch');
  const release = acquire(root);
  const pendingFile = path.join(root, '.orchestrate/commit.pending.json');
  let pending;
  const save = () => { write(`${pendingFile}.tmp`, json(pending)); fs.renameSync(`${pendingFile}.tmp`, pendingFile); };
  try {
    if (fs.realpathSync(git(root, 'rev-parse', '--show-toplevel').trim()) !== root) throw new Error('--root는 git 저장소 루트여야 한다');
    pending = fs.existsSync(pendingFile) ? readJson(pendingFile) : { runs: [], paths: [] };
    if (batch && pending.runs.some(run => run.batchId !== batch)) throw new Error('다른 배치의 미커밋 반영이 남아 있다. 해당 배치 또는 전체 apply를 먼저 완료한다');
    const runs = discover(root, batch);
    for (const run of pending.runs) {
      if (!runs.some(r => r.dir === run.dir)) throw new Error(`미커밋 반영의 대기분이 없다: ${run.dir}. staging-failed와 작업 파일을 확인해야 한다`);
    }
    if (!runs.length && !pending.runs.length) return { committed: false, runs: [], paths: [] };
    const paths = new Set(pending.paths);
    // 빌드가 읽는 다른 배치의 미커밋 소스를 산출물에 끼워 넣지 않는다.
    // 아직 초안이 없는 새 배치의 evidence만 제작기가 잠금 밖에서 준비할 수 있다.
    for (const file of changedInputs(root)) {
      if (paths.has(file)) continue;
      const evidence = /^content-source\/batches\/([^/]+)\/evidence\//.exec(file);
      if (evidence && runs.some(run => run.batchId === evidence[1]) && !fs.existsSync(path.join(root, `content-source/batches/${evidence[1]}/drafts.json`))) {
        paths.add(file);
      } else throw new Error(`미커밋 콘텐츠가 있어 반영 중단: ${file}`);
    }
    for (const file of generatedPaths) paths.add(file);
    const draftsChanged = new Map();
    for (const run of runs) {
      let checked;
      try { checked = validateRun(root, run); }
      catch (error) { quarantine(root, run); throw error; }
      const { manifest, writes } = checked;
      for (const file of [...writes.map(w => w.path), ...manifest.deletes]) paths.add(file);
      if (!pending.runs.some(r => r.dir === run.dir)) pending.runs.push({ ...run, tool: manifest.tool });
      pending.paths = [...paths];
      save(); // 복사 도중 끊겨도 다음 실행이 이 경로를 소유한 작업으로 알아본다.
      try {
        for (const item of writes) write(destination(root, item.path), item.bytes);
        for (const file of manifest.deletes) fs.rmSync(destination(root, file), { force: true });
      } catch (error) {
        quarantine(root, run);
        throw new Error(`반영 실패: ${run.batchId}/${run.runId}. 미커밋 파일을 보존했다`, { cause: error });
      }
      if ([...writes.map(w => w.path), ...manifest.deletes].includes(`content-source/batches/${run.batchId}/drafts.json`)) draftsChanged.set(run.batchId, run.runId);
    }
    for (const [batchId, runId] of draftsChanged) {
      const blindPath = `content-source/reviews/${batchId}/blind-input.json`;
      const out = destination(root, blindPath);
      const hasDrafts = fs.existsSync(path.join(root, `content-source/batches/${batchId}/drafts.json`));
      const next = hasDrafts ? makeBlindInput(batchId, { root, write: false }) : null;
      const previous = fs.existsSync(out) ? readJson(out) : null;
      // contentHash도 비교하므로 같은 revision의 본문 정정 역시 보관한다. 시각만 바뀐 파일은 다시 쓰지 않는다.
      if (previous && JSON.stringify(previous.items) === JSON.stringify(next?.items)) continue;
      paths.add(blindPath);
      const archivePath = `content-source/reviews/archive/${batchId}.blind-input.${runId}.json`;
      if (previous) paths.add(archivePath);
      pending.paths = [...paths];
      save();
      if (previous) {
        const archive = destination(root, archivePath);
        if (fs.existsSync(archive)) throw new Error(`이전 blind-input 보관 경로가 이미 있다: ${archivePath}`);
        fs.mkdirSync(path.dirname(archive), { recursive: true });
        fs.renameSync(out, archive);
      }
      if (next) write(out, json(next));
    }
    await (opts.buildBank ?? (r => command(r, process.execPath, ['tools/build-bank.mjs'])))(root);
    await (opts.buildQuestionKeys ?? (r => command(r, process.execPath, ['tools/build-question-keys.mjs'])))(root);
    if (!opts.noServerTest) await (opts.testServer ?? (r => command(r, 'npm', ['run', 'test:server'])))(root);
    const result = { committed: false, runs: pending.runs, paths: [...paths].sort() };
    if (opts.noCommit || opts.commit === false) return result;
    const tracked = new Set(git(root, 'ls-files', '-z').split('\0').filter(Boolean));
    const atHead = new Set(git(root, 'ls-tree', '-r', '--name-only', '-z', 'HEAD').split('\0').filter(Boolean));
    const existing = result.paths.filter(file => fs.existsSync(destination(root, file)));
    const deleted = result.paths.filter(file => !fs.existsSync(destination(root, file)) && (tracked.has(file) || atHead.has(file)));
    if (existing.length) git(root, 'add', '--', ...existing);
    if (deleted.length) git(root, 'rm', '--cached', '--ignore-unmatch', '-q', '--', ...deleted);
    const batches = [...new Set(pending.runs.map(run => run.batchId))].sort();
    const summary = pending.runs.map(run => `${run.tool ?? 'apply'} ${run.runId}`).join(', ');
    git(root, 'commit', '--only', '--allow-empty', '-m', `content(${batches.join(',')}): ${summary}\n\nCo-Authored-By: Codex <noreply@openai.com>`, '--', ...existing, ...deleted);
    result.committed = true;
    result.commit = git(root, 'rev-parse', 'HEAD').trim();
    // 커밋 실패 시 이 줄에 도달하지 않아 대기분과 반영 기록이 모두 남는다.
    for (const run of pending.runs) fs.rmSync(path.join(root, run.dir), { recursive: true, force: true });
    fs.rmSync(pendingFile, { force: true });
    return result;
  } finally { release(); }
}

async function main(argv) {
  if (argv.shift() !== 'apply') throw new Error('사용: commit-lock.mjs apply --root <dir> [--batch <id>] [--no-commit] [--no-server-test]');
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-commit') opts.noCommit = true;
    else if (arg === '--no-server-test') opts.noServerTest = true;
    else if (['--root', '--batch'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) opts[arg.slice(2)] = argv[++i];
    else throw new Error(`알 수 없는 옵션: ${arg}`);
  }
  console.log(JSON.stringify(await applyStaged(opts)));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
