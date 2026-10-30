#!/usr/bin/env node
// 작업 패키지 자동 발행·수합기. 총괄이 정한 jobs.json의 작업마다 전용 git worktree를 만들고,
// agent-bridge로 담당 에이전트(codex·antigravity·claude)를 깨워 일을 맡긴 뒤,
// 바뀐 파일이 소유 경로 안에 있는지와 지정 검사를 기계로 확인한다. ACCEPTED는 총괄의 `accept`로만 붙는다.
//
//   node tools/orchestrate/wp.mjs list
//   node tools/orchestrate/wp.mjs new <id>          작업 폴더(../tower-wp/<id>, 브랜치 wp/<id>)를 HEAD에서 만든다
//   node tools/orchestrate/wp.mjs drive <id...>     만들기 → 발행 → 수합을 반복(라운드 상한까지). 브리지 담당만
//   node tools/orchestrate/wp.mjs intake <id>       범위·검사만 다시 본다(서브에이전트 작업에도 쓴다)
//   node tools/orchestrate/wp.mjs accept <id> [--into <dir>]  작업 폴더 변경을 커밋하고 현재(또는 지정 폴더의) 브랜치에 병합한다
//   node tools/orchestrate/wp.mjs board [--write]   상태표(EXECUTION_BOARD.md의 자동 구역)를 만든다
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const JOBS = path.join(root, 'tools/orchestrate/jobs.json');
const STATE_DIR = path.join(root, '.orchestrate/state');
const BRIDGE = process.env.AGENT_BRIDGE ?? path.join(os.homedir(), '.local/bin/agent-bridge');
const BRIDGE_AGENTS = new Set(['codex', 'antigravity', 'claude']);
// 검사 도중 다시 쓰이는 생성 파일. 작업이 소유하지 않으면 수합 전에 되돌린다.
const GENERATED = ['docs/contracts/prd_v0_5_validation.json'];
const BOARD_BEGIN = '<!-- orchestrate:begin -->';
const BOARD_END = '<!-- orchestrate:end -->';

const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };
const now = () => new Date().toISOString();

export function loadJobs() {
  const { jobs } = readJson(JOBS, { jobs: [] });
  return new Map(jobs.map(j => [j.id, j]));
}
const stateFile = id => path.join(STATE_DIR, `${id}.json`);
export const loadState = id => readJson(stateFile(id), { status: 'PLANNED', rounds: [] });
const saveState = (id, s) => writeJson(stateFile(id), { ...s, updatedAt: now() });

/** `**`·`*`·`?`만 쓰는 경로 글롭. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
export const matchesAny = (file, globs) => globs.some(g => globToRegExp(g).test(file));

function git(cwd, args, { allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')} 실패 (${cwd})\n${r.stderr}`);
  return r.stdout.trim();
}

function job(id) {
  const j = loadJobs().get(id);
  if (!j) throw new Error(`jobs.json에 없는 작업: ${id}`);
  return { ...j, worktree: path.resolve(root, j.worktree ?? `../tower-wp/${id}`), branch: j.branch ?? `wp/${id}` };
}
const allowedFor = j => [...j.owns, `docs/work-packages/${j.id}/**`];

export function create(id) {
  const j = job(id);
  const s = loadState(id);
  if (fs.existsSync(j.worktree)) {
    if (!s.baseCommit) saveState(id, { ...s, status: 'READY', baseCommit: git(j.worktree, ['merge-base', 'HEAD', git(root, ['rev-parse', 'HEAD'])]), worktree: j.worktree });
    return loadState(id);
  }
  if (!fs.existsSync(path.join(root, 'docs/work-packages', id, 'REQUEST.md'))) throw new Error(`요청서가 없다: docs/work-packages/${id}/REQUEST.md`);
  if (git(root, ['status', '--porcelain', '--', `docs/work-packages/${id}`])) throw new Error(`요청서를 먼저 커밋한다: docs/work-packages/${id}`);
  const base = git(root, ['rev-parse', 'HEAD']);
  git(root, ['worktree', 'add', '-b', j.branch, j.worktree, base]);
  // 의존성은 본 저장소 것을 그대로 쓴다(잠금 파일이 같다). package.json을 바꾸는 작업은 npm ci를 따로 한다.
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(j.worktree, 'node_modules'), 'dir');
  const next = { ...s, status: 'READY', baseCommit: base, worktree: j.worktree, createdAt: now() };
  saveState(id, next);
  return next;
}

function prompt(j, round, feedback) {
  const checks = j.checks.map(c => `   - ${c}`).join('\n');
  return [
    `[${j.id}] ${j.title} — ${round}회차`,
    '',
    `너는 초등 3~6학년용 한국어 어휘 타워 디펜스 웹게임의 ${j.role ?? '구현 담당'}이다. 총괄은 Claude Opus 5.5이고 너는 이 작업 하나만 맡는다.`,
    '',
    `작업 폴더: ${j.worktree}`,
    '이 폴더 안에서만 읽고 쓴다. 본 저장소 폴더(/Users/bodyking/Desktop/vibecoding/tower)나 다른 tower-wp 폴더는 열지 않는다.',
    '',
    `1. docs/work-packages/${j.id}/REQUEST.md를 끝까지 읽고 그대로 따른다. 이 메시지와 다르면 요청서가 우선이다.`,
    `2. 쓸 수 있는 경로(이 밖의 변경은 수합 때 기계적으로 거부된다):\n${allowedFor(j).map(g => `   - ${g}`).join('\n')}`,
    '3. 하지 않는다: 패키지 설치·업그레이드, package.json·lockfile 수정(요청서가 허락한 경우 제외), git commit·push·branch 조작, 다른 에이전트 깨우기.',
    `4. 끝내기 전에 이 검사를 직접 돌려 통과시킨다:\n${checks}`,
    `5. 이번 실행은 15분 안에 끝나야 한다. 시간이 모자라면 docs/work-packages/${j.id}/PROGRESS.md에 끝낸 일·남은 일·다음에 할 첫 단계를 적고 멈춘다. 다음 회차에 이어서 맡긴다.`,
    `6. 모두 끝났으면 docs/work-packages/${j.id}/RETURN.md 첫 줄에 \`STATUS: DONE\`, 아니면 \`STATUS: PARTIAL\`을 쓰고, 바꾼 파일·검사 결과(실제 출력 요약)·남은 위험을 적는다. 돌리지 않은 검사는 "미실행"으로 적는다.`,
    '7. 답장은 다섯 줄 안으로: 상태, 바꾼 파일 수, 검사 통과 여부, 막힌 점.',
    feedback ? `\n----- 지난 회차 수합 결과(이것부터 고친다) -----\n${feedback}` : '',
  ].join('\n');
}

function runBridge(j, body) {
  return new Promise(resolve => {
    const args = ['ask', '--from', 'claude', '--to', j.agent, '--cwd', j.worktree, '--wait', String(j.waitSec ?? 1200)];
    if (j.tier) args.push('--tier', j.tier);
    args.push('-');
    const child = spawn(BRIDGE, args, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => resolve({ code, out: out.trim(), err: err.trim() }));
    child.stdin.end(body);
  });
}

function readReturn(j) {
  const f = path.join(j.worktree, 'docs/work-packages', j.id, 'RETURN.md');
  if (!fs.existsSync(f)) return { status: 'MISSING', text: '' };
  const text = fs.readFileSync(f, 'utf8');
  const m = text.match(/STATUS:\s*(DONE|PARTIAL)/);
  return { status: m ? m[1] : 'UNKNOWN', text };
}

export function changedFiles(j, base) {
  for (const g of GENERATED) if (!matchesAny(g, j.owns)) git(j.worktree, ['checkout', base, '--', g], { allowFail: true });
  const tracked = git(j.worktree, ['diff', '--name-only', base]).split('\n').filter(Boolean);
  const untracked = git(j.worktree, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  return [...new Set([...tracked, ...untracked])].filter(f => f !== 'node_modules').sort();
}

function runCheck(cwd, cmd, timeoutSec) {
  const started = Date.now();
  const r = spawnSync('bash', ['-lc', cmd], { cwd, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024 });
  const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-30).join('\n');
  return { cmd, ok: r.status === 0, code: r.status, seconds: Math.round((Date.now() - started) / 1000), tail };
}

export function intake(id, { runChecks = true } = {}) {
  const j = job(id);
  const s = loadState(id);
  if (!s.baseCommit) throw new Error(`${id}: 작업 폴더가 없다(new 먼저)`);
  const changed = changedFiles(j, s.baseCommit);
  const allowed = allowedFor(j);
  const violations = changed.filter(f => !matchesAny(f, allowed));
  const checks = runChecks && violations.length === 0 ? j.checks.map(c => runCheck(j.worktree, c, j.checkTimeoutSec ?? 900)) : [];
  for (const g of GENERATED) if (!matchesAny(g, j.owns)) git(j.worktree, ['checkout', s.baseCommit, '--', g], { allowFail: true });
  const ret = readReturn(j);
  const pass = changed.length > 0 && violations.length === 0 && checks.every(c => c.ok) && (!runChecks || checks.length === j.checks.length);
  const result = { at: now(), changed, violations, checks, returnStatus: ret.status, pass };
  saveState(id, { ...loadState(id), status: pass ? (ret.status === 'DONE' ? 'INTAKE_PASS' : 'PARTIAL') : 'INTAKE_FAIL', intake: result });
  return result;
}

function feedbackText(result) {
  const lines = [];
  if (result.violations.length) lines.push(`허용 경로 밖 변경(되돌린다): ${result.violations.join(', ')}`);
  for (const c of result.checks.filter(x => !x.ok)) lines.push(`검사 실패: ${c.cmd} (코드 ${c.code})\n${c.tail}`);
  if (result.returnStatus !== 'DONE') lines.push(`RETURN.md 상태: ${result.returnStatus}. PROGRESS.md의 남은 일을 이어서 한다.`);
  return lines.join('\n\n');
}

export async function drive(id) {
  const j = job(id);
  if (!BRIDGE_AGENTS.has(j.agent)) throw new Error(`${id}: 담당 ${j.agent}는 브리지로 보내지 않는다(총괄이 직접 맡긴다)`);
  for (const dep of j.dependsOn ?? []) if (loadState(dep).status !== 'ACCEPTED') throw new Error(`${id}: 선행 ${dep}가 ACCEPTED가 아니다`);
  create(id);
  let s = loadState(id);
  const maxRounds = j.maxRounds ?? 3;
  let feedback = s.intake && !s.intake.pass ? feedbackText(s.intake) : '';
  for (let round = (s.rounds?.length ?? 0) + 1; round <= maxRounds; round++) {
    saveState(id, { ...loadState(id), status: 'RUNNING', round });
    const res = await runBridge(j, prompt(j, round, feedback));
    const replyFile = path.join(STATE_DIR, `${id}.round${round}.md`);
    fs.writeFileSync(replyFile, `${res.out}\n${res.err ? `\n[stderr]\n${res.err}` : ''}`);
    s = loadState(id);
    s.rounds = [...(s.rounds ?? []), { round, at: now(), exitCode: res.code, reply: path.relative(root, replyFile) }];
    saveState(id, s);
    const result = intake(id);
    console.log(`[${id}] ${round}회차 · 바뀐 파일 ${result.changed.length} · 범위 위반 ${result.violations.length} · 검사 ${result.checks.filter(c => c.ok).length}/${j.checks.length} · RETURN ${result.returnStatus}`);
    if (result.pass && result.returnStatus === 'DONE') return loadState(id);
    feedback = feedbackText(result);
  }
  saveState(id, { ...loadState(id), status: 'NEEDS_COMMANDER' });
  return loadState(id);
}

export function accept(id, { force = false, into = root } = {}) {
  const j = job(id);
  const s = loadState(id);
  if (!force && s.status !== 'INTAKE_PASS') throw new Error(`${id}: 수합 통과(INTAKE_PASS)가 아니다(현재 ${s.status}). 확인 뒤 --force`);
  for (const g of GENERATED) if (!matchesAny(g, j.owns)) git(j.worktree, ['checkout', s.baseCommit, '--', g], { allowFail: true });
  const violations = changedFiles(j, s.baseCommit).filter(f => !matchesAny(f, allowedFor(j)));
  if (violations.length) throw new Error(`${id}: 허용 경로 밖 변경이 남아 있다: ${violations.join(', ')}`);
  git(j.worktree, ['add', '-A']);
  git(j.worktree, ['reset', '-q', '--', 'node_modules'], { allowFail: true });
  if (git(j.worktree, ['diff', '--cached', '--name-only'])) {
    git(j.worktree, ['commit', '-m', `wp(${id}): ${j.title}\n\n담당 ${j.agent}, 총괄 수합.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`]);
  }
  // 병합 대상 폴더의 커밋 안 된 변경이 이 작업의 변경과 겹치면 덮어쓸 수 있으므로 멈춘다(겹치지 않으면 그대로 둔다).
  const dirty = git(into, ['status', '--porcelain', '--untracked-files=no']).split('\n').filter(Boolean).map(l => l.slice(3));
  const touched = new Set(git(into, ['diff', '--name-only', `HEAD...${j.branch}`]).split('\n').filter(Boolean));
  const overlap = dirty.filter(f => touched.has(f));
  if (overlap.length) throw new Error(`${id}: 병합 대상(${into})의 커밋 안 된 변경과 겹친다: ${overlap.join(', ')}`);
  const merged = spawnSync('git', ['merge', '--no-ff', '-m', `merge wp/${id}: ${j.title}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, j.branch], { cwd: into, encoding: 'utf8' });
  if (merged.status !== 0) {
    git(into, ['merge', '--abort'], { allowFail: true });
    throw new Error(`${id}: 병합 충돌. 총괄이 직접 푼다.\n${merged.stdout}\n${merged.stderr}`);
  }
  saveState(id, { ...loadState(id), status: 'ACCEPTED', acceptedAt: now(), mergedInto: into, mergeCommit: git(into, ['rev-parse', 'HEAD']) });
  return loadState(id);
}

export function board() {
  const rows = [...loadJobs().values()].map(j => {
    const s = loadState(j.id);
    const ck = s.intake ? `${s.intake.checks.filter(c => c.ok).length}/${j.checks.length}` : '-';
    return `| ${j.id} | ${j.agent} | ${s.status} | ${s.rounds?.length ?? 0} | ${ck} | ${s.intake?.violations?.length ?? '-'} | ${j.title} |`;
  });
  return [BOARD_BEGIN, '| 작업 | 담당 | 상태 | 회차 | 검사 | 범위 위반 | 내용 |', '|---|---|---|---:|---|---:|---|', ...rows, `\n자동 생성: ${now()} · \`node tools/orchestrate/wp.mjs board --write\``, BOARD_END].join('\n');
}

function writeBoard() {
  const f = path.join(root, 'docs/EXECUTION_BOARD.md');
  const text = fs.readFileSync(f, 'utf8');
  const table = board();
  const next = text.includes(BOARD_BEGIN)
    ? text.slice(0, text.indexOf(BOARD_BEGIN)) + table + text.slice(text.indexOf(BOARD_END) + BOARD_END.length)
    : `${text.trimEnd()}\n\n## 자동 작업 패키지 상태\n\n${table}\n`;
  fs.writeFileSync(f, next);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const ids = rest.filter(a => !a.startsWith('--'));
  const flags = new Set(rest.filter(a => a.startsWith('--')));
  switch (cmd) {
    case 'list':
      for (const j of loadJobs().values()) console.log(`${j.id}\t${j.agent}\t${loadState(j.id).status}\t${j.title}`);
      break;
    case 'new':
      for (const id of ids) console.log(JSON.stringify(create(id)));
      break;
    case 'intake':
      for (const id of ids) {
        const r = intake(id, { runChecks: !flags.has('--no-checks') });
        console.log(JSON.stringify({ id, pass: r.pass, returnStatus: r.returnStatus, changed: r.changed.length, violations: r.violations, checks: r.checks.map(c => ({ cmd: c.cmd, ok: c.ok, seconds: c.seconds, tail: c.ok ? undefined : c.tail })) }, null, 2));
      }
      break;
    case 'drive': {
      const results = await Promise.allSettled(ids.map(id => drive(id)));
      results.forEach((r, i) => console.log(`${ids[i]}: ${r.status === 'fulfilled' ? r.value.status : `오류 ${r.reason.message}`}`));
      break;
    }
    case 'accept': {
      const at = process.argv.indexOf('--into');
      const into = at > 0 ? path.resolve(process.argv[at + 1]) : root;
      for (const id of ids.filter(x => path.resolve(x) !== into)) console.log(JSON.stringify(accept(id, { force: flags.has('--force'), into })));
      break;
    }
    case 'board':
      if (flags.has('--write')) writeBoard();
      else console.log(board());
      break;
    default:
      console.error('사용: wp.mjs list | new <id> | drive <id...> | intake <id> [--no-checks] | accept <id> [--force] | board [--write]');
      process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
