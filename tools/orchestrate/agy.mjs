// 사용자 브리지 설정을 읽지 않는 Argon 전용 호출. 권한은 봉인 폴더 읽기 하나뿐이다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export const AGY_MODEL = 'gemini-4-argon-high';
const BRAIN = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function agyArgs({ cwd, prompt, model = AGY_MODEL, timeoutSec = 1200 }) {
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) throw new Error('agy timeoutSec는 양수여야 한다');
  if (model !== AGY_MODEL) throw new Error(`허용되지 않은 Argon 모델: ${model}`);
  const sealed = fs.realpathSync(cwd);
  // --settings는 세션 한정 덮어쓰기다. 전역 allow/MCP/command 규칙을 가져오지 않는다.
  return ['-p', prompt, '--output-format', 'json', '--print-timeout', `${timeoutSec}s`, '--model', model,
    '--mode', 'plan', '--disable-slash-commands', '--settings', JSON.stringify({ permissions: { allow: [`read_file(${sealed})`] } })];
}

function rateRoot(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (path.basename(dir) === '.orchestrate') return path.dirname(dir);
    if (path.dirname(dir) === dir) throw new Error('agy 사용량 원장 root를 지정해야 한다');
  }
}

/** 모든 프로세스가 같은 원장의 호출 시작을 예약한다. 실패한 호출도 예산에 포함한다. */
export async function reserveAgyCall({ root, perHour = 40, now = Date.now() }) {
  perHour = Number(perHour);
  if (!Number.isSafeInteger(perHour) || perHour < 1) throw new Error('--argon-per-hour는 양의 정수여야 한다');
  const file = path.join(root, '.orchestrate/agy-rate.json'), lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // 죽은 프로세스의 잠금도 함부로 지우지 않는다. 미확인 상태에서는 호출하지 않는다.
      if (Date.now() >= deadline) throw new Error(`agy 사용량 잠금 대기 초과: ${lock}`, { cause: error });
      await delay(25);
    }
  }
  try {
    const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { calls: [] };
    if (!Array.isArray(state.calls) || state.calls.some(t => !Number.isFinite(t) || t < 0)) throw new Error('agy 사용량 원장 형식 오류');
    const calls = state.calls.filter(t => t > now - 3_600_000);
    if (calls.length >= perHour) throw new Error(`Argon 시간당 실행 상한 ${perHour}회: 다음 예약 가능 ${new Date(Math.min(...calls) + 3_600_000).toISOString()}`);
    calls.push(now);
    const temp = `${file}.${randomUUID()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify({ calls })}\n`);
    fs.renameSync(temp, file);
  } finally { fs.unlinkSync(lock); }
}

function completeJson(text) {
  // 출력 한도 뒤 전체를 다시 쓴 경우 앞의 블록은 사용하지 않는다.
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  const candidates = blocks.length ? blocks.reverse().map(m => m[1]) : [text.trim(), text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const candidate of candidates) {
    try { const value = JSON.parse(candidate); if (value && typeof value === 'object') return JSON.stringify(value); } catch { /* 다음 완결 블록 */ }
  }
  return null;
}

function brainFiles(dir) {
  if (!fs.existsSync(dir) || fs.lstatSync(dir).isSymbolicLink()) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? brainFiles(path.join(dir, e.name))
    : e.isFile() && /\.(json|md|txt)(\.resolved)?$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

export function parseAgyOutput(raw, { brain = BRAIN, validate } = {}) {
  const envelope = JSON.parse(raw);
  const response = typeof envelope.response === 'string' ? envelope.response : '';
  const complete = completeJson(response);
  if (complete) return complete; // 문항별 형식·대상 검사는 기존 호출자의 검사로 남긴다.
  const incomplete = /```|[[{]|exceeded the output token limit/i.test(response);
  if (!envelope.is_error && response && !incomplete) return response;
  const id = envelope.conversation_id;
  if (typeof id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) {
    const files = brainFiles(path.join(brain, id)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    for (const file of files) {
      try {
        const full = fs.readFileSync(file, 'utf8');
        let candidate = completeJson(full);
        try { const j = JSON.parse(full); if (typeof j.response === 'string') candidate = completeJson(j.response); } catch { /* Markdown 전문 */ }
        if (!candidate || !Array.isArray(JSON.parse(candidate).items)) continue;
        if (validate) validate(candidate);
        return candidate;
      } catch { /* 현재 요청과 맞는 완결 전문만 선택한다. */ }
    }
  }
  throw new Error(`agy 잘린 또는 불완전한 응답${id ? ` (conversation_id: ${id})` : ''}: ${response.slice(-500)}`);
}

function execute(executable, args, { cwd, timeoutSec }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, (timeoutSec + 10) * 1000);
    child.stdout.on('data', data => { out += data; });
    child.stderr.on('data', data => { err += data; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut) reject(new Error('agy 호출 시간 초과'));
      else resolve({ code, out, err: err.trim() });
    });
  });
}

export async function agyCall({ cwd, prompt, model = AGY_MODEL, timeoutSec = 1200, root, argonPerHour = 40, validate }, deps = {}) {
  const args = agyArgs({ cwd, prompt, model, timeoutSec });
  await reserveAgyCall({ root: root ?? rateRoot(cwd), perHour: argonPerHour });
  const installed = path.join(os.homedir(), '.gemini/bin/agy');
  const result = await (deps.execute ?? execute)(fs.existsSync(installed) ? installed : 'agy', args, { cwd, timeoutSec });
  if (result.code !== 0) throw new Error(`agy 실행 실패(${result.code}): ${result.err || result.out}`);
  return { ...result, out: parseAgyOutput(result.out, { brain: deps.brain, validate }) };
}
