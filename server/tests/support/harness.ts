/**
 * 시험용 로컬 Worker. wrangler createTestHarness는 `wrangler dev --local`과 같은 workerd·로컬 D1을 띄운다.
 * Cloudflare 계정에 닿지 않는다. 비밀값은 시험 전용 가짜 값만 쓴다.
 */
import { readFile } from 'node:fs/promises';
import { createTestHarness } from 'wrangler';
import { handleRequest, type Env } from '../../src/app';
import type { D1ResultLike, SqlStats } from '../../src/db';
import { SERVER_DIR, TEST_SALT } from './constants';

export { REPO_DIR, SERVER_DIR, TEST_ORIGIN, TEST_SALT } from './constants';

interface TestStatement {
  bind(...values: unknown[]): TestStatement;
  all(): Promise<{ results: Record<string, unknown>[] }>;
  run(): Promise<unknown>;
}

/** 시험에서 쓰는 D1 바인딩 모양(Node에서 로컬 D1을 직접 부른다). */
export interface TestD1 {
  prepare(query: string): TestStatement;
  batch(statements: TestStatement[]): Promise<D1ResultLike[]>;
}

export interface CallResult {
  status: number;
  headers: Headers;
  body: Record<string, unknown> & { error?: string };
}

export interface Device {
  deviceId: string;
  token: string;
}

export interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
  rawBody?: string;
  /** 천천히 올라오는 본문을 흉내 낼 때 쓴다(direct 전용). */
  stream?: ReadableStream<Uint8Array>;
  headers?: Record<string, string>;
}

/** 줄마다 한 문장인 SQL 파일(seed)을 D1 batch로 넣는다. */
export async function runSqlLines(db: TestD1, text: string): Promise<void> {
  const statements = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('--'));
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50).map(s => db.prepare(s)));
  }
}

/** SQL 회귀 시험(net-regression.sql)의 시험 은행·조건·규칙. 규칙은 실제 seed의 Normal을 복사한다. */
export async function seedFixtures(db: TestD1): Promise<void> {
  await runSqlLines(db, await readFile(new URL('../../seed/question_keys.sql', import.meta.url), 'utf8'));
  await db.batch([
    db.prepare("INSERT INTO question_keys VALUES ('test-bank', 'q-a', 1, 'a', 3)"),
    db.prepare("INSERT INTO question_keys VALUES ('test-bank', 'q-b', 2, 'c', 3)"),
    db.prepare("INSERT INTO question_keys VALUES ('test-bank-4', 'q-a', 1, 'b', 4)"),
    db.prepare("INSERT INTO approved_run_conditions (bank_version, grade, balance_version, map_id) VALUES ('test-bank', 3, 'test-balance', 'garden_u')"),
    db.prepare("INSERT INTO approved_run_conditions (bank_version, grade, balance_version, map_id) VALUES ('test-bank-4', 4, 'test-balance', 'garden_u')"),
    db.prepare("INSERT INTO run_verification_rules SELECT 'test-balance', difficulty, rules FROM run_verification_rules WHERE balance_version = '1.0.0'"),
  ]);
}

export interface TestServer {
  db: TestD1;
  call(path: string, options?: CallOptions): Promise<CallResult>;
  newDevice(ip?: string): Promise<Device>;
  /** Worker를 거치지 않고 같은 처리기를 Node에서 부른다(시계 고정·D1 행 수 측정용). 같은 로컬 D1을 쓴다. */
  direct(path: string, options: CallOptions & { now: number | (() => number); stats?: SqlStats }): Promise<CallResult>;
  scheduled(scheduledTime: number): Promise<void>;
  close(): Promise<void>;
}

async function toResult(response: Response): Promise<CallResult> {
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : {} };
}

function requestInit(options: CallOptions): RequestInit {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const method = options.method ?? (options.body !== undefined || options.rawBody !== undefined || options.stream ? 'POST' : 'GET');
  const init: RequestInit & { duplex?: 'half' } = { method, headers };
  if (options.stream) {
    init.body = options.stream;
    init.duplex = 'half';
  } else if (options.rawBody !== undefined) init.body = options.rawBody;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  return init;
}

export async function startServer(options: { salt?: string; seed?: boolean } = {}): Promise<TestServer> {
  const server = createTestHarness({
    root: SERVER_DIR,
    workers: [{ configPath: 'wrangler.toml', secrets: { PLAYER_SALT: options.salt ?? TEST_SALT } }],
  });
  await server.listen();
  const worker = server.getWorker();
  await worker.applyD1Migrations('DB');
  const env = (await worker.getEnv()) as { DB: TestD1; ALLOWED_ORIGINS: string };
  const db = env.DB;
  if (options.seed !== false) await seedFixtures(db);

  const call: TestServer['call'] = async (path, callOptions = {}) =>
    toResult((await server.fetch(path, requestInit(callOptions) as never)) as unknown as Response);

  return {
    db,
    call,
    async newDevice(ip) {
      const result = await call('/v1/device', { body: {}, ...(ip ? { headers: { 'CF-Connecting-IP': ip } } : {}) });
      if (result.status !== 200) throw new Error(`기기 발급 실패: ${result.status} ${JSON.stringify(result.body)}`);
      return result.body as unknown as Device;
    },
    async direct(path, callOptions) {
      const testEnv: Env = { DB: db, PLAYER_SALT: options.salt ?? TEST_SALT, ALLOWED_ORIGINS: env.ALLOWED_ORIGINS };
      const request = new Request(new URL(path, 'http://localhost'), requestInit(callOptions));
      const clock = typeof callOptions.now === 'function' ? callOptions.now : () => callOptions.now as number;
      const deps = callOptions.stats ? { now: clock, stats: callOptions.stats } : { now: clock };
      return toResult(await handleRequest(request, testEnv, deps));
    },
    async scheduled(scheduledTime) {
      await worker.scheduled({ cron: '0 19 * * *', scheduledTime: new Date(scheduledTime) });
    },
    close: () => server.close(),
  };
}

export const newStats = (): SqlStats => ({ batches: 0, statements: 0, rowsRead: 0, rowsWritten: 0 });

export async function rows(db: TestD1, query: string, ...params: unknown[]): Promise<Record<string, unknown>[]> {
  return (await db.prepare(query).bind(...params).all()).results;
}

export async function exec(db: TestD1, query: string, ...params: unknown[]): Promise<void> {
  await db.prepare(query).bind(...params).run();
}

export const NOW_MINUS = (ms: number) => Date.now() - ms;
export const MINUTE = 60_000;
export const DAY = 86_400_000;

/** net-regression.sql의 submit_test: 1웨이브 준비 문항 5개(정답 3·오답 1·건너뜀 1), 점수 67(문항 37 + 처치 30). */
export function submitBody(runId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    p_run_id: runId,
    p_nickname: '솔방울',
    p_grade: 3,
    p_difficulty: 'Normal',
    p_pt: 67,
    p_completed_wave: 1,
    p_correct: 3,
    p_wrong: 1,
    p_skipped: 1,
    p_content_mode: 'published',
    p_balance_version: 'test-balance',
    p_bank_version: 'test-bank',
    p_map_id: 'garden_u',
    p_ended_at: new Date(Date.now() - 8 * DAY).toISOString(),
    p_ended_at_wave: 1,
    p_answers: [
      { encounterId: 1, questionId: 'q-a', revision: 1, choice: 'a', phase: 'prep', wave: 1 },
      { encounterId: 2, questionId: 'q-a', revision: 1, choice: 'b', phase: 'prep', wave: 1 },
      { encounterId: 3, questionId: 'q-a', revision: 1, choice: 'skipped', phase: 'prep', wave: 1 },
      { encounterId: 4, questionId: 'q-a', revision: 1, choice: 'a', phase: 'prep', wave: 1 },
      { encounterId: 5, questionId: 'q-a', revision: 1, choice: 'a', phase: 'prep', wave: 1 },
    ],
    p_active_ticks: 3000,
    ...overrides,
  };
}

/**
 * 속도 제한 칸은 UTC 분(한국 자정도 분 경계다)이 바뀌면 다시 센다. 칸을 채운 뒤 요청하는 시험이
 * 경계를 넘지 않게, 분 끝 5초 안이면 다음 분까지 기다린다.
 */
export async function avoidMinuteBoundary(): Promise<void> {
  const intoMinute = Date.now() % 60_000;
  if (intoMinute > 55_000) await new Promise(resolve => setTimeout(resolve, 60_000 - intoMinute + 200));
}
