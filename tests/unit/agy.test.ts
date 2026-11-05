import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { agyArgs, agyCall, parseAgyOutput, reserveAgyCall } from '../../tools/orchestrate/agy.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { antigravityRespond } from '../../tools/orchestrate/review.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { liveRespond } from '../../tools/orchestrate/level.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { author as reviseAuthor } from '../../tools/orchestrate/revise.mjs';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { author as produceAuthor } from '../../tools/orchestrate/produce.mjs';

const roots: string[] = [];
const temp = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-test-')); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
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

  it('출력 상한 뒤 이어 쓴 답장은 마지막 완결 JSON 블록을 고른다', () => {
    const answer = { items: [{ questionId: 'q1' }, { questionId: 'q2' }] };
    const response = `${block({ items: [] })}\nexceeded the output token limit … continue\n${block(answer)}`;
    expect(JSON.parse(parseAgyOutput(output(response)))).toEqual(answer);
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
