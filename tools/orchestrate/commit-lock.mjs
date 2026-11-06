#!/usr/bin/env node
// 추적 콘텐츠 쓰기·빌드·서버 시험·경로 한정 커밋을 하나의 잠금으로 묶는다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeBlindInput } from '../make-blind-input.mjs';

const generatedPaths = [
  'content-source/approvals/registry.json', 'content-source/approvals/candidate-registry.json',
  ...[3, 4, 5, 6].flatMap(grade => [`src/content/questions/grade${grade}.json`, `src/content/questions/grade${grade}.candidate.json`]),
  'src/content/questions/practice.json', 'src/content/questions/manifest.json', 'server/seed/question_keys.sql',
];
const inputScopes = ['content-source', 'src/content/questions', 'server/seed', 'src/content/retractions.json',
  'docs/contracts/balance.candidate.v0.4.json', 'docs/contracts/maps.candidate.v0.4.json'];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const safeId = id => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
const write = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
function command(root, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, GIT_LITERAL_PATHSPECS: '1' } });
  if (path.basename(executable) === 'resource-guard' && result.status === 75) {
    throw Object.assign(new Error('자원 대기: 서버 시험은 실행되지 않았다. 반영 기록과 staging을 보존한다.'), { code: 'RESOURCE_WAIT' });
  }
  if (result.error || result.status !== 0) throw new Error(`${executable} ${args.join(' ')} 실패 (${result.status}): ${result.error?.message ?? ''}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result.stdout;
}
const git = (root, ...args) => command(root, 'git', args);
export function guardedServerTest(root) {
  const args = ['run', 'test:server', '--', '--maxWorkers=1'];
  const guard = path.join(os.homedir(), '.local/bin/resource-guard');
  if (process.env.RESOURCE_GUARD_ACTIVE === '1' || !fs.existsSync(guard)) return command(root, 'npm', args);
  command(root, guard, ['status', '--profile', 'avatar']);
  return command(root, guard, ['run', '--profile', 'test', '--wait-seconds', '600', '--', 'npm', ...args]);
}
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

/** 모델의 stage-only 작업과 분리된 은행 전환도 같은 쓰기 잠금 안에서 실행한다. */
export async function withCommitLock(root, operation) {
  root = fs.realpathSync(path.resolve(root));
  const release = acquire(root);
  try {
    if (fs.realpathSync(git(root, 'rev-parse', '--show-toplevel').trim()) !== root) throw new Error('저장소 루트가 필요하다');
    if (fs.existsSync(path.join(root, '.orchestrate/commit.pending.json'))) throw new Error('다른 배치의 미커밋 반영을 먼저 완료해야 한다');
    return await operation(root);
  } finally { release(); }
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
  // O-C5 목록도 콘텐츠 잠금을 거친다. 전용 작업 ID에는 그 목록 한 파일만 허용한다.
  const wordlist = /^wordlist-(g[3-6]-r[1-9]\d*[a-z]?)$/.exec(batchId)?.[1];
  if (wordlist) return file === `content-source/wordlists/${wordlist}.json`;
  return file.startsWith(`content-source/batches/${batchId}/`) || file.startsWith(`content-source/reviews/${batchId}/`)
    || file.startsWith(`content-source/reviews/archive/${batchId}.`) || file === `content-source/approvals/${batchId}.explanation.json`
    || file.startsWith(`content-source/approvals/archive/${batchId}.explanation.`) || file === `content-source/levels/${batchId}.json`
    // 배치가 아닌 공용 참조 파일은 같은 이름의 대기 폴더만 쓴다(W9 tools/fetch-krdict-grade.mjs).
    || (batchId === 'krdict-grade' && file === 'content-source/reference/krdict-grade.json');
}
function discover(root, selected) {
  const base = path.join(root, '.orchestrate/staging');
  if (!fs.existsSync(base)) return [];
  const runs = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || (selected && !selected.has(entry.name))) continue;
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
  // -z 보존: 공백·한글·개행 경로, staged 삭제/추가, 이름 변경 양쪽을 빠뜨리지 않는다.
  const entries = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...inputScopes).split('\0');
  const changed = new Set();
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i]) continue;
    const status = entries[i].slice(0, 2);
    changed.add(entries[i].slice(3));
    if (/[RC]/.test(status) && entries[i + 1]) changed.add(entries[++i]);
  }
  return changed;
}

export function resolveCoAuthor(opts = {}, env = process.env) {
  const value = opts.coAuthor ?? opts['co-author'] ?? env.COMMIT_CO_AUTHOR ?? 'Claude Opus 5.5 <noreply@anthropic.com>';
  if (typeof value !== 'string' || !value.trim() || /[\r\n\0]/.test(value)) throw new Error('공동 작성자는 비어 있지 않은 한 줄이어야 한다');
  return value.trim();
}

/**
 * 기본값은 반영·검증·커밋이다. buildBank/buildQuestionKeys/testServer는 임시 저장소 시험용 주입점.
 * noCommit은 검증까지 실행하고 대기분·미커밋 기록을 남긴다. 다른 배치는 먼저 이 기록을 완료해야 한다.
 */
export async function applyStaged(opts = {}) {
  const root = fs.realpathSync(path.resolve(opts.root ?? path.resolve(import.meta.dirname, '../..')));
  const batch = opts.batch ?? opts.batchId;
  const coAuthor = resolveCoAuthor(opts);
  if (batch && !safeId(batch)) throw new Error('잘못된 batch');
  if (batch != null && opts.batches != null) throw new Error('--batch와 --batches는 함께 쓸 수 없다');
  if (opts.batches != null && (typeof opts.batches !== 'string' || opts.batches.split(',').some(id => !safeId(id.trim())))) throw new Error('잘못된 batches');
  const selected = opts.batches != null ? new Set(opts.batches.split(',').map(id => id.trim())) : batch ? new Set([batch]) : null;
  const release = acquire(root);
  const pendingFile = path.join(root, '.orchestrate/commit.pending.json');
  let pending;
  const save = () => { write(`${pendingFile}.tmp`, json(pending)); fs.renameSync(`${pendingFile}.tmp`, pendingFile); };
  try {
    if (fs.realpathSync(git(root, 'rev-parse', '--show-toplevel').trim()) !== root) throw new Error('--root는 git 저장소 루트여야 한다');
    pending = fs.existsSync(pendingFile) ? readJson(pendingFile) : { runs: [], paths: [] };
    if (selected && pending.runs.some(run => !selected.has(run.batchId))) throw new Error('다른 배치의 미커밋 반영이 남아 있다. 해당 배치를 포함하거나 전체 apply를 먼저 완료한다');
    const runs = discover(root, selected);
    for (const run of pending.runs) {
      if (!runs.some(r => r.dir === run.dir)) throw new Error(`미커밋 반영의 대기분이 없다: ${run.dir}. staging-failed와 작업 파일을 확인해야 한다`);
    }
    if (!runs.length && !pending.runs.length) return { committed: false, runs: [], paths: [] };
    const paths = new Set(pending.paths);
    // manifest 밖 오염은 복사·삭제·빌드 전에 전체 경로 목록으로 보고한다.
    const manifestPaths = new Set();
    for (const run of runs) {
      const manifest = readJson(destination(root, `${run.dir}/manifest.json`));
      for (const file of [...manifest.writes.map(w => w.path), ...manifest.deletes]) {
        destination(root, file);
        if (!owns(run.batchId, file)) throw new Error(`배치 밖 경로: ${file}`);
        manifestPaths.add(file);
      }
    }
    const contamination = [];
    for (const file of changedInputs(root)) {
      if (paths.has(file) || manifestPaths.has(file)) continue;
      // 계획 §8의 새 배치 evidence 예외만 유지한다. 기존 배치의 근거는 예외가 아니다.
      const evidence = /^content-source\/batches\/([^/]+)\/evidence\//.exec(file);
      if (evidence && runs.some(run => run.batchId === evidence[1]) && !fs.existsSync(path.join(root, `content-source/batches/${evidence[1]}/drafts.json`))) {
        paths.add(file);
      } else contamination.push(file);
    }
    if (contamination.length) throw new Error(`미커밋 콘텐츠 오염으로 반영 중단:\n${contamination.sort().join('\n')}`);
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
    if (!opts.noServerTest) await (opts.testServer ?? (r => command(r, 'npm', ['run', 'test:server', '--', '--maxWorkers=1'])))(root);
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
    git(root, 'commit', '--only', '--allow-empty', '-m', `content(${batches.join(',')}): ${summary}\n\nCo-Authored-By: ${coAuthor}`, '--', ...existing, ...deleted);
    result.committed = true;
    result.commit = git(root, 'rev-parse', 'HEAD').trim();
    // 커밋 실패 시 이 줄에 도달하지 않아 대기분과 반영 기록이 모두 남는다.
    for (const run of pending.runs) fs.rmSync(path.join(root, run.dir), { recursive: true, force: true });
    fs.rmSync(pendingFile, { force: true });
    return result;
  } finally { release(); }
}

async function main(argv) {
  if (argv.shift() !== 'apply') throw new Error('사용: commit-lock.mjs apply --root <dir> [--batch <id> | --batches <id,id>] [--no-commit] [--no-server-test]');
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-commit') opts.noCommit = true;
    else if (arg === '--no-server-test') opts.noServerTest = true;
    else if (['--root', '--batch', '--batches', '--co-author'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) opts[arg.slice(2)] = argv[++i];
    else throw new Error(`알 수 없는 옵션: ${arg}`);
  }
  console.log(JSON.stringify(await applyStaged(opts)));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
