import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { deriveKeys, ipHash, isUsableSalt, KEY_LABELS, playerHash, signDeviceToken, verifyDeviceToken } from '../../src/crypto';
import { REPO_DIR, TEST_SALT } from '../support/constants';

const DEVICE = '11111111-1111-4111-8111-111111111111';

describe('PLAYER_SALT 하나에서 용도별 키 파생', () => {
  it('토큰 서명·플레이어 해시·IP 해시는 서로 다른 라벨의 다른 키다', async () => {
    expect(new Set(Object.values(KEY_LABELS)).size).toBe(3);
    const keys = await deriveKeys(TEST_SALT);
    const token = await signDeviceToken(keys, DEVICE);
    const hash = await playerHash(keys, DEVICE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await ipHash(keys, DEVICE)).not.toBe(hash.slice(0, 32));
    // 토큰 서명(base64url)과 플레이어 해시(hex)는 같은 바이트가 아니다.
    const signature = Buffer.from(token.split('.')[2]!, 'base64url').toString('hex');
    expect(signature).not.toBe(hash);
  });

  it('토큰은 같은 소금값에서만 맞고, 한 글자라도 바꾸면 거부한다', async () => {
    const keys = await deriveKeys(TEST_SALT);
    const token = await signDeviceToken(keys, DEVICE);
    expect(await verifyDeviceToken(keys, token)).toBe(DEVICE);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(await verifyDeviceToken(keys, tampered)).toBeNull();
    expect(await verifyDeviceToken(keys, token.replace(DEVICE, '22222222-2222-4222-8222-222222222222'))).toBeNull();
    expect(await verifyDeviceToken(await deriveKeys(`${TEST_SALT}-other`), token)).toBeNull();
    expect(await verifyDeviceToken(keys, 'v1.garbage')).toBeNull();
  });

  it('소금값은 32자 이상이어야 쓴다', () => {
    expect(isUsableSalt(undefined)).toBe(false);
    expect(isUsableSalt('short')).toBe(false);
    expect(isUsableSalt(TEST_SALT)).toBe(true);
  });
});

describe('D1 정답 키 seed(tools/build-question-keys.mjs)', () => {
  function generate(banks: unknown[], retractions: unknown = { entries: [] }) {
    const script = `import { readFile } from 'node:fs/promises';
      import { buildQuestionKeySeed } from './tools/build-question-keys.mjs';
      const j = async p => JSON.parse(await readFile(p, 'utf8'));
      let input=''; for await (const chunk of process.stdin) input+=chunk;
      const { banks, retractions } = JSON.parse(input);
      process.stdout.write(buildQuestionKeySeed({ banks, retractions, balance: await j('docs/contracts/balance.candidate.v0.4.json'), maps: await j('docs/contracts/maps.candidate.v0.4.json') }));`;
    return spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: REPO_DIR, input: JSON.stringify({ banks, retractions }), encoding: 'utf8' });
  }

  it('SQLite 문법: 스키마 접두어·트랜잭션 문·jsonb 캐스트가 없고 active는 0/1이다', async () => {
    const published = JSON.parse(await readFile(`${REPO_DIR}src/content/questions/grade3.json`, 'utf8')) as { questions: { id: string; revision: number }[] };
    const first = published.questions[0]!;
    const result = generate([{ ...published, questions: published.questions.slice(0, 2) }], { entries: [{ questionId: first.id, revision: first.revision }] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/public\.|^begin;|^commit;|::jsonb|active=(true|false)/m);
    expect(result.stdout).toContain('update approved_run_conditions set active=0 where grade in (3,4,5,6);');
    expect(result.stdout).toContain(`delete from question_keys where question_id='${first.id}' and revision=${first.revision};`);
    expect(result.stdout).toMatch(/do update set active=1;/);
  });

  it('저장소의 server/seed/question_keys.sql은 지금 공개 은행으로 만든 출력과 같다(다시 만들기: node tools/build-question-keys.mjs)', async () => {
    const script = `import { readFile } from 'node:fs/promises';
      import { buildSharedQuestionKeySeed } from './tools/build-question-keys.mjs';
      const j = async p => JSON.parse(await readFile(p, 'utf8'));
      const banks = [];
      for (const g of [3, 4, 5, 6]) { try { banks.push(await j('src/content/questions/grade' + g + '.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
      process.stdout.write(buildSharedQuestionKeySeed({ banks, balance: await j('docs/contracts/balance.candidate.v0.4.json'), maps: await j('docs/contracts/maps.candidate.v0.4.json'), retractions: await j('src/content/retractions.json') }));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: REPO_DIR, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(`${REPO_DIR}server/seed/question_keys.sql`, 'utf8')).toBe(result.stdout);
  });
});
