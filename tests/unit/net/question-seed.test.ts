import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import balance from '../../../docs/contracts/balance.candidate.v0.4.json';
import maps from '../../../docs/contracts/maps.candidate.v0.4.json';
import published from '../../../src/content/questions/grade3.json';

function generate(banks: unknown[], retractions: unknown = { entries: [] }) {
  const script = `import { buildQuestionKeySeed } from './tools/build-question-keys.mjs';
    let input=''; for await (const chunk of process.stdin) input+=chunk;
    process.stdout.write(buildQuestionKeySeed(JSON.parse(input)));`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    input: JSON.stringify({ banks, retractions, balance, maps }), encoding: 'utf8',
  });
}

describe('서버 공개 정답 키 seed', () => {
  it('후보·철회 문항을 빼고 현재 공개 조건만 활성화한다', () => {
    const first = published.questions[0]!;
    const second = published.questions[1]!;
    const result = generate([
      { ...published, questions: [first, second] },
      { ...published, grade: 4, bankVersion: 'candidate-secret', status: 'verified_candidate' },
    ], { entries: [{ questionId: first.id, revision: first.revision }] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('set active=false where grade in (3,4,5,6)');
    expect(result.stdout).not.toContain('candidate-secret');
    expect(result.stdout).not.toContain(`values('${published.bankVersion}','${first.id}'`);
    expect(result.stdout).toContain(`values('${published.bankVersion}','${second.id}'`);
    expect(result.stdout).toContain(`delete from public.question_keys where question_id='${first.id}' and revision=${first.revision}`);
  });
  it('공개 문항이 사라진 학년의 이전 조건도 비활성화한다', () => {
    const result = generate([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('set active=false where grade in (3,4,5,6)');
    expect(result.stdout).not.toContain('insert into public.approved_run_conditions');
  });
  it('동일 은행·문항·revision에 다른 정답이 있으면 seed를 만들지 않는다', () => {
    const question = published.questions[0]!;
    const conflicting = { ...question, correctOptionId: question.correctOptionId === 'a' ? 'b' : 'a' };
    const result = generate([{ ...published, questions: [question, conflicting] }]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('중복 정답 키');
    expect(result.stdout).toBe('');
  });
});
