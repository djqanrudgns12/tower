import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import balance from '../../../docs/contracts/balance.candidate.v0.4.json';
import maps from '../../../docs/contracts/maps.candidate.v0.4.json';
import published from '../../../src/content/questions/grade3.json';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sharedBankVersion } from '../../../tools/content/sharedBankVersion';
import type { SharedBankFile, SharedBankQuestion } from '../../../src/contracts/questions';
import { sharedBankQuestionSchema } from '../../../src/contracts/questions';

function generate(banks: unknown[], retractions: unknown = { entries: [] }) {
  const script = `import { buildQuestionKeySeed } from './tools/build-question-keys.mjs';
    process.stdin.setEncoding('utf8');
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
    expect(result.stdout).toContain('set active=0 where grade in (3,4,5,6)');
    expect(result.stdout).not.toContain('candidate-secret');
    expect(result.stdout).not.toContain(`values('${published.bankVersion}','${first.id}'`);
    expect(result.stdout).toContain(`values('${published.bankVersion}','${second.id}'`);
    expect(result.stdout).toContain(`delete from question_keys where question_id='${first.id}' and revision=${first.revision}`);
  });
  it('공개 문항이 사라진 학년의 이전 조건도 비활성화한다', () => {
    const result = generate([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('set active=0 where grade in (3,4,5,6)');
    expect(result.stdout).not.toContain('insert into approved_run_conditions');
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

function sharingFixture(): SharedBankFile[] {
  const source: SharedBankQuestion = sharedBankQuestionSchema.parse({ ...published.questions[0]!, grade: 3, status: 'published', type: 'cloze',
    difficultyTier: 'basic', variantTag: 'standard', dialectRegion: undefined,
    correctOptionId: 'a', distractorRationales: { b: '시험 이유', c: '시험 이유', d: '시험 이유' } });
  const own = Array.from({ length: 1000 }, (_, i) => ({ ...source, id: `g4-seed-${String(i + 1).padStart(4, '0')}`, grade: 4 }));
  const shared = { ...source, gradeBand: { min: 3, max: 4 } };
  return [
    { bankId: 'g3', grade: 3, status: 'published', questions: [source], bankVersion: sharedBankVersion(3, [source]) },
    { bankId: 'g4', grade: 4, status: 'published', questions: [...own, shared], bankVersion: sharedBankVersion(4, [...own, shared]) },
  ];
}

function generateSharing(banks: SharedBankFile[], retractions: unknown = { entries: [] }) {
  const script = `import { buildSharedQuestionKeySeed } from './tools/build-question-keys.mjs';
    process.stdin.setEncoding('utf8');
    let input=''; for await (const chunk of process.stdin) input+=chunk;
    process.stdout.write(buildSharedQuestionKeySeed(JSON.parse(input)));`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    input: JSON.stringify({ banks, retractions, balance, maps }), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
}

describe('공유 은행의 받는 학년 서버 키', () => {
  it('원 ID를 유지하고 은행 버전·학년으로 구분해 SQLite에서 조회할 수 있다', () => {
    const banks = sharingFixture(), source = banks[0]!.questions[0]!;
    const result = generateSharing(banks);
    expect(result.status, result.stderr).toBe(0);
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(readFileSync('server/migrations/0001_init.sql', 'utf8'));
      db.exec(result.stdout);
      const rows = db.prepare('SELECT bank_version, question_id, grade FROM question_keys WHERE question_id = ? ORDER BY grade').all(source.id);
      expect(rows).toEqual([
        { bank_version: banks[0]!.bankVersion, question_id: source.id, grade: 3 },
        { bank_version: banks[1]!.bankVersion, question_id: source.id, grade: 4 },
      ]);
      expect(db.prepare('SELECT grade FROM approved_run_conditions WHERE active=1 ORDER BY grade').all()).toEqual([{ grade: 3 }, { grade: 4 }]);
      const withdrawn = generateSharing(banks, { entries: [{ questionId: source.id, revision: source.revision }] });
      expect(withdrawn.status, withdrawn.stderr).toBe(0);
      db.exec(withdrawn.stdout);
      expect(db.prepare('SELECT question_id FROM question_keys WHERE question_id = ?').all(source.id)).toEqual([]);
    } finally { db.close(); }
    expect(generate(banks).status).not.toBe(0);
  });
  it('받는 학년 판 번호가 아니거나 검증 뒤 문항이 바뀌면 출력을 거절한다', () => {
    const banks = sharingFixture(); banks[1]!.bankVersion = banks[0]!.bankVersion;
    const reused = generateSharing(banks);
    expect(reused.status).not.toBe(0); expect(reused.stdout).toBe(''); expect(reused.stderr).toContain('받는 학년 은행 판 번호');
    const stale = sharingFixture(); stale[1]!.questions[0]!.difficultyTier = 'challenge';
    const changed = generateSharing(stale);
    expect(changed.status).not.toBe(0); expect(changed.stdout).toBe(''); expect(changed.stderr).toContain('받는 학년 은행 판 번호');
  });
  it('판 번호를 다시 계산해도 공유 계약을 위반한 문항은 받지 않는다', () => {
    const banks = sharingFixture(); delete banks[1]!.questions.at(-1)!.gradeBand;
    banks[1]!.bankVersion = sharedBankVersion(4, banks[1]!.questions);
    const result = generateSharing(banks);
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expect(result.stderr).toContain('공유 학년 띠');
  });
});
