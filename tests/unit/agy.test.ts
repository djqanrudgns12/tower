import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { agyArgs, agyCall, parseAgyOutput, reserveAgyCall } from '../../tools/orchestrate/agy.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { antigravityRespond, measuredAgyCall } from '../../tools/orchestrate/review.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { liveRespond } from '../../tools/orchestrate/level.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { author as reviseAuthor } from '../../tools/orchestrate/revise.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { author as produceAuthor } from '../../tools/orchestrate/produce.mjs';

const roots: string[] = [];
const temp = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-test-')); roots.push(root); return root; };
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const block = (data: unknown) => `\`\`\`json\n${JSON.stringify(data)}\n\`\`\``;
const output = (response: string, extra = {}) => JSON.stringify({ response, ...extra });

describe('봉인 폴더만 읽는 agy 직접 호출', () => {
  it('사용자 전역 설정과 무관하게 plan 모드·읽기 하나만 전달한다', () => {
    const cwd = temp();
    const args = agyArgs({ cwd, prompt: '입력', timeoutSec: 20 });
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args.slice(args.indexOf('--mode'), args.indexOf('--mode') + 2)).toEqual(['--mode', 'plan']);
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual(['--model', 'gemini-4-argon-high']);
    expect(JSON.parse(args[args.indexOf('--settings') + 1])).toEqual({ permissions: { allow: [`read_file(${fs.realpathSync(cwd)})`] } });
    expect(args.slice(0, 6)).toEqual(['-p', '입력', '--output-format', 'json', '--print-timeout', '20s']);
    expect(args).toContain('--disable-slash-commands');
    expect(() => agyArgs({ cwd, prompt: '', timeoutSec: 0 })).toThrow(/timeout/);
  });

  it('정상 JSON의 response를 꺼낸다', () => {
    const answer = { items: [{ questionId: 'q1', revision: 1 }] };
    expect(JSON.parse(parseAgyOutput(output(block(answer))))).toEqual(answer);
    expect(parseAgyOutput(output('작성이 거부되었습니다.'))).toBe('작성이 거부되었습니다.');
  });

  it('중첩된 agy 봉투는 실제 답장까지 꺼내고 잘린 내부 응답은 거절한다', () => {
    const brain = temp(), conversation_id = '12345678-1234-1234-1234-123456789abc';
    const answer = { items: [{ questionId: 'q1', action: 'revise' }] };
    const nested = (response: string) => output(JSON.stringify({ conversation_id, status: 'ERROR', response }));
    expect(JSON.parse(parseAgyOutput(nested(JSON.stringify(answer)), { brain }))).toEqual(answer);
    expect(() => parseAgyOutput(nested('{"items":['), { brain })).toThrow(/잘린|불완전/);
  });

  it('출력 상한 뒤 이어 쓴 답장은 마지막 완결 JSON 블록을 고른다', () => {
    const answer = { items: [{ questionId: 'q1' }, { questionId: 'q2' }] };
    const response = `${block({ items: [] })}\nexceeded the output token limit … continue\n${block(answer)}`;
    expect(JSON.parse(parseAgyOutput(output(response)))).toEqual(answer);
  });

  it('출력 한도 뒤 울타리 없이 다시 쓴 완성본은 현재 대상 검사 후 꺼낸다', () => {
    const brain = temp(), answer = { items: [{ questionId: 'q1' }, { questionId: 'q2' }] };
    const response = '{"items":[{"questionId":"q1","reason":"미완결\n' + JSON.stringify(answer) + '\n';
    const validate = vi.fn((text: string) => {
      if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(answer)) throw new Error('대상 불일치');
    });
    const raw = output(response, { status: 'ERROR', error: 'exceeded the output token limit', finished_reason: 'error' });
    expect(JSON.parse(parseAgyOutput(raw, { brain, validate }))).toEqual(answer);
    expect(validate).toHaveBeenCalledExactlyOnceWith(JSON.stringify(answer));
    expect(() => parseAgyOutput(raw, { brain })).toThrow(/잘린|불완전/);
  });

  it('출력 한도 뒤 완성본도 대상이 다르거나 미완결이면 복구하지 않는다', () => {
    const brain = temp();
    const validate = (text: string) => {
      if (JSON.parse(text).items?.[0]?.questionId !== 'q1') throw new Error('대상 불일치');
    };
    const prefix = '{"items":[{"reason":"미완결\n';
    for (const suffix of ['{"items":[{"questionId":"other"}]}', '{"items":[{"questionId":"q1"']) {
      expect(() => parseAgyOutput(output(prefix + suffix, {
        status: 'ERROR', error: 'exceeded the output token limit',
      }), { brain, validate })).toThrow(/잘린|불완전/);
    }
  });

  it('잘린 응답은 해당 conversation_id의 전문만 복원하고 검증한다', () => {
    const brain = temp(), id = '12345678-1234-1234-1234-123456789abc';
    fs.mkdirSync(path.join(brain, id));
    const answer = { items: [{ questionId: 'q1' }] };
    fs.writeFileSync(path.join(brain, id, 'response.md'), block(answer));
    const raw = output('```json\n{"items":[', { conversation_id: id });
    const validate = (text: string) => { if (JSON.parse(text).items[0]?.questionId !== 'q1') throw new Error('대상 불일치'); };
    expect(JSON.parse(parseAgyOutput(raw, { brain, validate }))).toEqual(answer);
    fs.writeFileSync(path.join(brain, id, 'response.md'), block({ items: [{ questionId: 'other' }] }));
    expect(() => parseAgyOutput(raw, { brain, validate })).toThrow(/잘린|불완전/);
    expect(() => parseAgyOutput(output('```json\n{"items":[', { conversation_id: '../outside' }), { brain })).toThrow();
  });

  it('시간당 상한은 동시 예약에도 공유되며 한 시간 뒤 다시 허용한다', async () => {
    const root = temp(), now = 3_600_000;
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => reserveAgyCall({ root, perHour: 2, now })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(4);
    expect(JSON.parse(fs.readFileSync(path.join(root, '.orchestrate/agy-rate.json'), 'utf8')).calls).toEqual([now, now]);
    await expect(reserveAgyCall({ root, perHour: 2, now: now + 3_600_000 })).resolves.toBeUndefined();
    await expect(reserveAgyCall({ root, perHour: 0, now })).rejects.toThrow(/양의 정수/);
  });

  it('기본 상한 40과 손상된 상태를 닫힌 쪽으로 처리한다', async () => {
    const root = temp();
    for (let i = 0; i < 40; i++) await reserveAgyCall({ root, now: 1 });
    await expect(reserveAgyCall({ root, now: 2 })).rejects.toThrow(/시간당 실행 상한/);
    fs.writeFileSync(path.join(root, '.orchestrate/agy-rate.json'), '{bad');
    await expect(reserveAgyCall({ root, now: 3 })).rejects.toThrow();
  });

  it('실행기를 주입해 인자·봉인 cwd·응답과 상한에서 미실행을 확인한다', async () => {
    const root = temp(), cwd = path.join(root, '.orchestrate/sealed');
    fs.mkdirSync(cwd, { recursive: true });
    const execute = vi.fn<(executable: string, args: string[], options: { cwd: string; timeoutSec: number }) => Promise<{ code: number; out: string; err: string }>>(async () => ({ code: 0, out: output(block({ items: [] })), err: '' }));
    const result = await agyCall({ root, cwd, prompt: '입력', argonPerHour: 1 }, { execute });
    expect(result).toEqual({ code: 0, out: '{"items":[]}', err: '' });
    expect(execute.mock.calls).toHaveLength(1);
    const [executable, args, execution] = execute.mock.calls[0]!;
    expect(executable.endsWith('/agy') || executable === 'agy').toBe(true);
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(execution).toEqual({ cwd, timeoutSec: 1200 });
    await expect(agyCall({ root, cwd, prompt: '입력', argonPerHour: 1 }, { execute })).rejects.toThrow(/시간당 실행 상한/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  function timeoutFixture(change: { input?: string; status?: string; reply?: string; code?: string; logId?: string } = {}) {
    const root = temp(), cwd = path.join(root, '.orchestrate/sealed'), brain = path.join(root, 'brain');
    const id = '12345678-1234-1234-1234-123456789abc', prompt = '현재 입력 q1@2를 판정한다';
    const transcript = path.join(brain, id, '.system_generated/logs/transcript_full.jsonl');
    fs.mkdirSync(cwd, { recursive: true }); fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, [
      { type: 'USER_INPUT', content: change.input ?? prompt },
      { type: 'PLANNER_RESPONSE', status: change.status ?? 'DONE', content: change.reply ?? block({ items: [{ questionId: 'q1', revision: 2 }] }) },
    ].map(row => JSON.stringify(row)).join('\n'));
    const failure = Object.assign(new Error('agy 호출 시간 초과'), { code: change.code ?? 'AGY_TIMEOUT' });
    const execute = vi.fn(async (_executable: string, args: string[]) => {
      const index = args.indexOf('--log-file');
      if (index >= 0) fs.writeFileSync(args[index + 1]!, `Stream goroutine exited for ${change.logId ?? id}, sending completion signal\n`);
      throw failure;
    });
    const validate = vi.fn((text: string) => {
      const parsed: unknown = JSON.parse(text);
      if (JSON.stringify(parsed) !== JSON.stringify({ items: [{ questionId: 'q1', revision: 2 }] })) throw new Error('현재 대상과 불일치');
    });
    return { root, cwd, brain, id, prompt, failure, execute, validate };
  }

  it('CLI 시간 초과라도 같은 호출·입력의 완료 답장은 대상 검사 후 복구한다', async () => {
    const f = timeoutFixture();
    const result = await agyCall({ root: f.root, cwd: f.cwd, prompt: f.prompt, validate: f.validate }, { execute: f.execute, brain: f.brain });
    expect(JSON.parse(result.out)).toEqual({ items: [{ questionId: 'q1', revision: 2 }] });
    expect(result.recovered).toBe(true);
    expect(f.validate).toHaveBeenCalledTimes(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
    const args = f.execute.mock.calls[0]![1], logFile = args[args.indexOf('--log-file') + 1]!;
    expect(JSON.parse(fs.readFileSync(`${logFile}.recovery.json`, 'utf8'))).toMatchObject({ conversationId: f.id, reason: 'AGY_TIMEOUT' });
  });

  it.each(['DONE', 'RUNNING'])('CLI 종료 코드 3의 print_timeout도 완료 상태 %s를 확인한다', async status => {
    const f = timeoutFixture({ status });
    const execute = vi.fn(async (_exe: string, args: string[]) => {
      fs.writeFileSync(args[args.indexOf('--log-file') + 1]!, `Stream goroutine exited for ${f.id}, sending completion signal\n`);
      return { code: 3, out: '', err: 'AGY_ERROR: {"reason":"print_timeout","status":"DEADLINE_EXCEEDED","retryable":false}' };
    });
    const result = agyCall({ root: f.root, cwd: f.cwd, prompt: f.prompt, validate: f.validate }, { execute, brain: f.brain });
    if (status === 'DONE') {
      await expect(result).resolves.toMatchObject({ code: 0, recovered: true, out: '{"items":[{"questionId":"q1","revision":2}]}' });
      expect(f.validate).toHaveBeenCalledTimes(1);
    } else {
      await expect(result).rejects.toMatchObject({ code: 'AGY_TIMEOUT', retryable: false });
      expect(f.validate).not.toHaveBeenCalled();
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    { reason: 'auth_failed', status: 'UNAUTHENTICATED' },
    { reason: 'print_timeout', status: 'UNKNOWN' },
  ])('다른 CLI 오류는 시간 초과로 바꾸지 않는다: %j', async detail => {
    const f = timeoutFixture();
    const execute = vi.fn(async () => ({ code: 3, out: '', err: `AGY_ERROR: ${JSON.stringify(detail)}` }));
    await expect(agyCall({ root: f.root, cwd: f.cwd, prompt: f.prompt, validate: f.validate }, { execute, brain: f.brain })).rejects.toThrow('agy 실행 실패(3)');
    expect(f.validate).not.toHaveBeenCalled();
  });

  it('호출 집계 실행기의 실제 타이머 경로도 완료 답장을 검증해 복구한다', async () => {
    const f = timeoutFixture();
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(),
      kill: vi.fn(() => { child.emit('close', null); return true; }) });
    const spawn = vi.fn((_exe: string, args: string[]) => {
      fs.writeFileSync(args[args.indexOf('--log-file') + 1]!, `Stream goroutine exited for ${f.id}, sending completion signal\n`);
      return child;
    });
    const onEvent = vi.fn();
    const result = measuredAgyCall({ root: f.root, cwd: f.cwd, prompt: f.prompt, timeoutSec: 1, validate: f.validate, onEvent },
      { spawn, brain: f.brain }).catch((error: unknown) => ({ error }));
    await vi.advanceTimersByTimeAsync(11_000);
    expect(await result).toMatchObject({ code: 0, recovered: true });
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL');
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: 'call', who: 'argon' });
    expect(f.validate).toHaveBeenCalledTimes(1);
  });

  it.each([
    { input: '다른 입력 q2@1' }, { status: 'RUNNING' }, { reply: '{"items":[' },
    { reply: block({ items: [{ questionId: 'other', revision: 2 }] }) },
    { logId: '87654321-1234-1234-1234-123456789abc' }, { code: 'AUTH_FAILED' },
  ])('미완·다른 요청·잘못된 답장·인증 실패는 복구하지 않는다: %j', async change => {
    const f = timeoutFixture(change);
    await expect(agyCall({ root: f.root, cwd: f.cwd, prompt: f.prompt, validate: f.validate }, { execute: f.execute, brain: f.brain })).rejects.toBe(f.failure);
  });

  it('대상 검사기가 없으면 시간 초과 답장을 승인하지 않는다', async () => {
    const f = timeoutFixture();
    await expect(agyCall({ root: f.root, cwd: f.cwd, prompt: f.prompt }, { execute: f.execute, brain: f.brain })).rejects.toBe(f.failure);
  });

  it('네 도구가 브리지 대신 주입한 agyCall에 모델·cwd·상한을 전달한다', async () => {
    const root = temp(), cwd = path.join(root, 'sealed');
    fs.mkdirSync(cwd);
    const agy = vi.fn(async () => ({ code: 0, out: '{"items":[]}', err: '' }));
    const request = { root, cwd, prompt: '입력', argonPerHour: 7, judge: 'argon', config: { model: 'Gemini 4 Argon (High)', effort: 'high' } };
    expect((await antigravityRespond(request, { agyCall: agy })).out).toBe('{"items":[]}');
    expect(await liveRespond(request, { agyCall: agy })).toBe('{"items":[]}');
    expect((await reviseAuthor('antigravity', cwd, '입력', { root, argonPerHour: 7, agyCall: agy })).out).toBe('{"items":[]}');
    expect(await produceAuthor(request, { agyCall: agy })).toBe('{"items":[]}');
    expect(agy).toHaveBeenCalledTimes(4);
    for (const call of agy.mock.calls as unknown as [Record<string, unknown>][]) {
      expect(call[0]).toMatchObject({ root, cwd, prompt: '입력', model: 'gemini-4-argon-high', timeoutSec: 1200, argonPerHour: 7 });
    }
  });
});
