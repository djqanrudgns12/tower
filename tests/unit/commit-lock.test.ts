import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error 독립 실행 MJS 도구에는 별도 선언 파일이 없다.
import { applyStaged, resolveCoAuthor } from '../../tools/orchestrate/commit-lock.mjs';

const roots: string[] = [];
const source = (batch: string) => `content-source/batches/${batch}/drafts.json`;
const bankPath = 'src/content/questions/grade4.json';
const candidatePath = 'src/content/questions/grade4.candidate.json';
const registryPath = 'content-source/approvals/registry.json';
const seedPath = 'server/seed/question_keys.sql';
const json = (value: unknown) => `${JSON.stringify(value)}\n`;
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const write = (root: string, file: string, bytes: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), bytes);
};
const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const draft = (id: string, revision = 1) => ({
  id, revision, grade: 4, type: 'meaning', target: { lemma: id, partOfSpeech: '명사', senseKey: '1' },
  stem: `${id} 뜻`, options: [{ id: 'a', text: '뜻' }, { id: 'b', text: '오답' }],
  correctOptionId: 'a', explanation: '해설', source: { provider: 'stdict', url: 'https://example.test' }, gradeBasis: '근거',
});
type Draft = ReturnType<typeof draft>;
// 전체 소스를 읽는 주입 빌드: 배치마다 독립 빌드를 쓰면 엇갈린 도착 시험이 실패한다.
function derive(drafts: Draft[]) {
  const items = drafts.map(q => `${q.id}@${q.revision}`).sort();
  return { registry: { items }, bank: { grade: 4, questions: items }, seed: `${items.join('\n')}\n` };
}
function buildBank(root: string) {
  const dir = path.join(root, 'content-source/batches');
  const drafts = fs.readdirSync(dir).sort().flatMap(batch => JSON.parse(fs.readFileSync(path.join(root, source(batch)), 'utf8')) as Draft[]);
  const result = derive(drafts);
  write(root, registryPath, json(result.registry));
  write(root, bankPath, json(result.bank));
  fs.rmSync(path.join(root, candidatePath), { force: true });
}
function buildQuestionKeys(root: string) {
  const bank = JSON.parse(fs.readFileSync(path.join(root, bankPath), 'utf8')) as { questions: string[] };
  write(root, seedPath, `${bank.questions.join('\n')}\n`);
}
function fixture() {
  fs.mkdirSync('.orchestrate', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.orchestrate/commit-lock-test-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', '잠금 시험');
  git(root, 'config', 'user.email', 'lock@example.test');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'config', 'core.hooksPath', path.join(root, '.git/hooks'));
  write(root, '.gitignore', '.orchestrate/\n');
  write(root, source('A'), json([draft('a')]));
  write(root, source('B'), json([draft('b')]));
  buildBank(root);
  buildQuestionKeys(root);
  write(root, candidatePath, json({ oldCandidate: true }));
  git(root, 'add', '--', '.gitignore', source('A'), source('B'), bankPath, registryPath, candidatePath, seedPath);
  git(root, 'commit', '-qm', 'fixture');
  return root;
}
function stage(root: string, batchId: string, runId: string, outputs: Record<string, unknown>, deletes: string[] = []) {
  const dir = `.orchestrate/staging/${batchId}/${runId}`;
  const writes = Object.entries(outputs).map(([file, value]) => {
    const bytes = json(value);
    write(root, `${dir}/files/${file}`, bytes);
    return { path: file, sha256: hash(bytes) };
  });
  write(root, `${dir}/manifest.json`, json({ batchId, runId, tool: 'fixture', model: 'test', createdAt: new Date().toISOString(), writes, deletes }));
  return path.join(root, dir);
}
const options = (root: string) => ({ root, buildBank, buildQuestionKeys, noServerTest: true });
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function assertReproducible(root: string, sha: string) {
  const drafts = ['A', 'B'].flatMap(batch => JSON.parse(git(root, 'show', `${sha}:${source(batch)}`)) as Draft[]);
  const expected = derive(drafts);
  expect(JSON.parse(git(root, 'show', `${sha}:${registryPath}`))).toEqual(expected.registry);
  expect(JSON.parse(git(root, 'show', `${sha}:${bankPath}`))).toEqual(expected.bank);
  expect(git(root, 'show', `${sha}:${seedPath}`)).toBe(expected.seed.trim());
}

describe('대기분 반영·잠금·배치 커밋', () => {
  it('선택한 여러 배치만 한 번 빌드·서버 검사·커밋하고 미선택 대기분은 보존한다', async () => {
    const root = fixture();
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    stage(root, 'B', '02', { [source('B')]: [draft('b', 2)] });
    const excluded = stage(root, 'wordlist-g4-r2', '03', { 'content-source/wordlists/g4-r2.json': { items: [] } });
    const calls: string[] = [];
    const result = await applyStaged({ ...options(root), batches: 'A,B,A', noServerTest: false,
      buildBank: (r: string) => { calls.push('bank'); buildBank(r); },
      buildQuestionKeys: (r: string) => { calls.push('keys'); buildQuestionKeys(r); },
      testServer: () => { calls.push('server'); },
    });
    expect(result.runs.map((r: { batchId: string }) => r.batchId)).toEqual(['A', 'B']);
    expect(calls).toEqual(['bank', 'keys', 'server']);
    expect(git(root, 'rev-list', '--count', 'HEAD')).toBe('2');
    expect(fs.existsSync(excluded)).toBe(true);
    expect(fs.existsSync(path.join(root, 'content-source/wordlists/g4-r2.json'))).toBe(false);
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
  });

  it('여러 배치 선택에도 이전 미커밋 배치를 모두 포함해야 하고 포함하면 함께 완료한다', async () => {
    const root = fixture();
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await applyStaged({ ...options(root), batch: 'A', noCommit: true });
    stage(root, 'B', '02', { [source('B')]: [draft('b', 2)] });
    await expect(applyStaged({ ...options(root), batches: 'B' })).rejects.toThrow(/미커밋/);
    expect(JSON.parse(fs.readFileSync(path.join(root, source('B')), 'utf8'))[0].revision).toBe(1);
    const result = await applyStaged({ ...options(root), batches: 'A,B' });
    expect(result.committed).toBe(true);
    expect(fs.existsSync(path.join(root, '.orchestrate/commit.pending.json'))).toBe(false);
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
  });

  it.each(['', 'A,,B', '../A', 'A/B'])('잘못된 배치 목록 %s는 쓰기 전에 거절한다', async batches => {
    const root = fixture();
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await expect(applyStaged({ ...options(root), batches })).rejects.toThrow(/batches/);
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('단일 배치와 여러 배치 옵션의 중복 지정은 거절한다', async () => {
    const root = fixture();
    await expect(applyStaged({ ...options(root), batch: 'A', batches: 'A,B' })).rejects.toThrow(/함께/);
  });

  it('낱말 목록 전용 staging은 같은 학년·라운드 목록만 잠금 커밋한다', async () => {
    const root = fixture();
    const file = 'content-source/wordlists/g4-r2.json';
    const list = { grade: 4, round: 2, items: [{ lemma: '표제어', checked: true, reason: '독립 검수 완료' }] };
    stage(root, 'wordlist-g4-r2', '01', { [file]: list });
    const result = await applyStaged({ ...options(root), batch: 'wordlist-g4-r2', coAuthor: 'Codex <noreply@openai.com>' });
    expect(result.committed).toBe(true);
    expect(JSON.parse(git(root, 'show', `HEAD:${file}`))).toEqual(list);
    expect(git(root, 'log', '-1', '--format=%B')).toContain('Co-Authored-By: Codex <noreply@openai.com>');
    expect(fs.existsSync(path.join(root, '.orchestrate/staging/wordlist-g4-r2/01'))).toBe(false);
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
  });

  it.each([
    ['wordlist-g4-r2', 'content-source/wordlists/g5-r2.json'],
    ['wordlist-g4-r2', 'content-source/wordlists/g4-r3.json'],
    ['A', 'content-source/wordlists/g4-r2.json'],
    ['wordlist-g7-r2', 'content-source/wordlists/g7-r2.json'],
  ])('목록 staging %s의 다른 소유 경로 %s를 거절한다', async (batchId, file) => {
    const root = fixture();
    const head = git(root, 'rev-parse', 'HEAD');
    stage(root, batchId, '01', { [file]: { items: [] } });
    await expect(applyStaged({ ...options(root), batch: batchId })).rejects.toThrow(/배치 밖 경로/);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.existsSync(path.join(root, file))).toBe(false);
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('두 배치가 엇갈려 도착해도 각 커밋의 소스만으로 산출물을 재현하며 남의 staged 파일은 남긴다', async () => {
    const root = fixture();
    write(root, 'unrelated.txt', '다른 작업');
    git(root, 'add', '--', 'unrelated.txt');
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    const first = await applyStaged(options(root));
    expect(first.committed).toBe(true);
    const sha1 = git(root, 'rev-parse', 'HEAD');
    expect(git(root, 'log', '-1', '--format=%B')).toContain(`Co-Authored-By: ${resolveCoAuthor()}`);
    assertReproducible(root, sha1);
    stage(root, 'B', '03', { [source('B')]: [draft('b', 3)] });
    stage(root, 'A', '02', { [source('A')]: [draft('a', 3)] });
    stage(root, 'B', '00', { [source('B')]: [draft('b', 2)] });
    const second = await applyStaged(options(root));
    expect(second.runs.map((r: { runId: string }) => r.runId)).toEqual(['00', '02', '03']);
    const sha2 = git(root, 'rev-parse', 'HEAD');
    assertReproducible(root, sha2);
    expect(JSON.parse(git(root, 'show', `${sha2}:${source('B')}`))[0].revision).toBe(3);
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('unrelated.txt');
    expect(git(root, 'ls-tree', '-r', '--name-only', sha2)).not.toContain('unrelated.txt');
    expect(fs.existsSync(path.join(root, '.orchestrate/staging/B/03'))).toBe(false);
  });

  it('하나의 run에서 sha가 틀리면 일부 파일도 반영하지 않고 실패 폴더로 이동한다', async () => {
    const root = fixture();
    const head = git(root, 'rev-parse', 'HEAD');
    const dir = stage(root, 'A', '01', { [source('A')]: [draft('a', 2)], 'content-source/batches/A/sidecar.json': {} });
    fs.appendFileSync(path.join(dir, 'files/content-source/batches/A/sidecar.json'), 'broken');
    await expect(applyStaged(options(root))).rejects.toThrow(/sha256/);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(fs.existsSync(path.join(root, '.orchestrate/staging-failed/A/01/manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.orchestrate/commit.lock'))).toBe(false);
  });

  it('잠금이 유지되는 동안 두 번째 반영은 거절한다', async () => {
    const root = fixture();
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    let release!: () => void;
    let entered!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const first = applyStaged({ ...options(root), buildBank: async (r: string) => { entered(); await barrier; buildBank(r); } });
    await started;
    try { await expect(applyStaged(options(root))).rejects.toThrow(/잠금/); }
    finally { release(); }
    await first;
    expect(fs.existsSync(path.join(root, '.orchestrate/commit.lock'))).toBe(false);
  });

  it('죽은 PID의 잠금은 회수한다', async () => {
    const root = fixture();
    const deadPid = Number(execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }));
    write(root, '.orchestrate/commit.lock', json({ pid: deadPid, startedAt: '2020-01-01' }));
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await applyStaged(options(root));
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
  });

  it('명시적 삭제·생성기가 지운 후보 파일을 커밋하고 이전 blind-input을 보관한다', async () => {
    const root = fixture();
    const old = { jobId: 'A', items: [{ questionId: 'a', revision: 1, contentHash: 'old' }] };
    write(root, 'content-source/reviews/A/blind-input.json', json(old));
    write(root, 'content-source/batches/A/obsolete.json', '{}');
    git(root, 'add', '--', 'content-source/reviews/A/blind-input.json', 'content-source/batches/A/obsolete.json');
    git(root, 'commit', '-qm', 'old review');
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] }, ['content-source/batches/A/obsolete.json']);
    await applyStaged(options(root));
    const files = git(root, 'ls-tree', '-r', '--name-only', 'HEAD');
    expect(files).not.toContain('obsolete.json');
    expect(files).not.toContain(candidatePath);
    expect(JSON.parse(git(root, 'show', 'HEAD:content-source/reviews/archive/A.blind-input.01.json'))).toEqual(old);
    expect(JSON.parse(git(root, 'show', 'HEAD:content-source/reviews/A/blind-input.json')).items[0].revision).toBe(2);
  });

  it('서버 시험 실패는 소스·산출물·대기분을 보존하고 재시도에서 커밋한다', async () => {
    const root = fixture();
    const head = git(root, 'rev-parse', 'HEAD');
    const dir = stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await expect(applyStaged({ ...options(root), noServerTest: false, testServer: () => { throw new Error('서버 시험 실패'); } })).rejects.toThrow('서버 시험 실패');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(JSON.parse(fs.readFileSync(path.join(root, source('A')), 'utf8'))[0].revision).toBe(2);
    expect(fs.existsSync(dir)).toBe(true);
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('');
    expect(fs.existsSync(path.join(root, '.orchestrate/commit.lock'))).toBe(false);
    await applyStaged(options(root));
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
  });

  it('--no-commit은 반영 기록을 남겨 다른 배치와 섞지 않고 이어 커밋한다', async () => {
    const root = fixture();
    const head = git(root, 'rev-parse', 'HEAD');
    const dir = stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    const result = await applyStaged({ ...options(root), batch: 'A', noCommit: true });
    expect(result.committed).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.existsSync(dir)).toBe(true);
    stage(root, 'B', '02', { [source('B')]: [draft('b', 2)] });
    await expect(applyStaged({ ...options(root), batch: 'B' })).rejects.toThrow(/미커밋/);
    await applyStaged({ ...options(root), batch: 'A' });
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
    expect(fs.existsSync(path.join(root, '.orchestrate/staging/B/02'))).toBe(true);
  });

  it('대기 대상 밖에 미커밋 콘텐츠가 있으면 산출물에 섞기 전에 거절한다', async () => {
    const root = fixture();
    write(root, source('B'), json([draft('b', 7)]));
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await expect(applyStaged({ ...options(root), batch: 'A' })).rejects.toThrow(/미커밋/);
    expect(JSON.parse(fs.readFileSync(path.join(root, source('A')), 'utf8'))[0].revision).toBe(1);
  });

  it('빌드 실패·커밋 훅 실패는 대기분과 미커밋 파일을 남기며 재시도할 수 있다', async () => {
    const root = fixture();
    const head = git(root, 'rev-parse', 'HEAD');
    const dir = stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await expect(applyStaged({ ...options(root), buildBank: () => { throw new Error('빌드 실패'); } })).rejects.toThrow('빌드 실패');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.existsSync(dir)).toBe(true);
    write(root, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(root, '.git/hooks/pre-commit'), 0o755);
    await expect(applyStaged(options(root))).rejects.toThrow(/git commit/);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(root, '.orchestrate/commit.lock'))).toBe(false);
    fs.unlinkSync(path.join(root, '.git/hooks/pre-commit'));
    await applyStaged(options(root));
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
  });

  it('새 배치의 직접 준비한 evidence를 초안과 함께 커밋한다', async () => {
    const root = fixture();
    write(root, 'content-source/batches/C/evidence/source.txt', '사전 근거');
    stage(root, 'C', '01', { [source('C')]: [draft('c')] });
    await applyStaged(options(root));
    expect(git(root, 'show', 'HEAD:content-source/batches/C/evidence/source.txt')).toBe('사전 근거');
    const expected = derive([draft('a'), draft('b'), draft('c')]);
    expect(JSON.parse(git(root, 'show', `HEAD:${bankPath}`))).toEqual(expected.bank);
  });

  it('뒤 run이 거절돼도 먼저 반영한 run을 남기고 다음 실행에서 완결한다', async () => {
    const root = fixture();
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    const bad = stage(root, 'B', '02', { [source('B')]: [draft('b', 2)] });
    fs.appendFileSync(path.join(bad, 'files', source('B')), 'tampered');
    await expect(applyStaged(options(root))).rejects.toThrow(/sha256/);
    expect(JSON.parse(fs.readFileSync(path.join(root, source('A')), 'utf8'))[0].revision).toBe(2);
    await applyStaged(options(root));
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
    expect(JSON.parse(git(root, 'show', `HEAD:${source('B')}`))[0].revision).toBe(1);
  });

  it('CLI 기본 빌드와 서버 시험을 순서대로 호출하며 --root 저장소만 커밋한다', () => {
    const root = fixture();
    write(root, 'tools/build-bank.mjs', `import fs from 'node:fs'; fs.appendFileSync('.orchestrate/order', 'bank\\n');`);
    write(root, 'tools/build-question-keys.mjs', `import fs from 'node:fs'; fs.appendFileSync('.orchestrate/order', 'keys\\n');`);
    write(root, 'package.json', json({ scripts: { 'test:server': 'node tools/server-test.mjs' } }));
    write(root, 'tools/server-test.mjs', `import fs from 'node:fs'; fs.appendFileSync('.orchestrate/order', 'server\\n');`);
    stage(root, 'A', '01', {
      'content-source/reviews/A/codex.json': { items: [] },
      'content-source/approvals/archive/A.explanation.old-model.json': { previousModel: true },
    });
    const cli = path.resolve('tools/orchestrate/commit-lock.mjs');
    const output = execFileSync(process.execPath, [cli, 'apply', '--root', root, '--batch', 'A', '--co-author', 'CLI 실행 <cli@example.test>'], { encoding: 'utf8' });
    expect(JSON.parse(output).committed).toBe(true);
    expect(git(root, 'log', '-1', '--format=%B')).toMatch(/\n\nCo-Authored-By: CLI 실행 <cli@example.test>$/);
    expect(fs.readFileSync(path.join(root, '.orchestrate/order'), 'utf8')).toBe('bank\nkeys\nserver\n');
    expect(JSON.parse(git(root, 'show', 'HEAD:content-source/reviews/A/codex.json'))).toEqual({ items: [] });
    expect(JSON.parse(git(root, 'show', 'HEAD:content-source/approvals/archive/A.explanation.old-model.json'))).toEqual({ previousModel: true });
  });

  it('manifest 밖 수정·추가·삭제와 seed 전체 오염을 모두 보고하고 반영하지 않는다', async () => {
    const root = fixture(), head = git(root, 'rev-parse', 'HEAD');
    const dir = stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    write(root, source('B'), json([draft('b', 9)]));
    write(root, 'server/seed/새 근거.sql', '오염');
    fs.unlinkSync(path.join(root, bankPath));
    git(root, 'add', '--', source('B'), bankPath, 'server/seed/새 근거.sql');
    write(root, 'content-source/새 폴더/근거.json', '{}');
    const before = git(root, 'status', '--porcelain');
    const result = await applyStaged(options(root)).catch((e: Error) => e);
    expect(result).toBeInstanceOf(Error);
    for (const file of [source('B'), bankPath, 'server/seed/새 근거.sql', 'content-source/새 폴더/근거.json']) expect(result.message).toContain(file);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(root, 'status', '--porcelain')).toBe(before);
    expect(JSON.parse(fs.readFileSync(path.join(root, source('A')), 'utf8'))[0].revision).toBe(1);
    expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.orchestrate/commit.pending.json'))).toBe(false);
  });

  it('manifest에 명시된 경로만 변경되어 있으면 반영할 수 있다', async () => {
    const root = fixture();
    write(root, source('A'), json([draft('a', 2)]));
    stage(root, 'A', '01', { [source('A')]: [draft('a', 3)] });
    await applyStaged(options(root));
    assertReproducible(root, git(root, 'rev-parse', 'HEAD'));
    expect(JSON.parse(git(root, 'show', `HEAD:${source('A')}`))[0].revision).toBe(3);
  });

  it('이름 변경의 이전 경로도 manifest 밖이면 거절한다', async () => {
    const root = fixture();
    git(root, 'mv', '--', source('B'), 'content-source/batches/B/renamed.json');
    stage(root, 'B', '01', { 'content-source/batches/B/renamed.json': [draft('b', 2)] });
    await expect(applyStaged(options(root))).rejects.toThrow(source('B'));
  });

  it('공동 작성자는 옵션 > 환경변수 > Claude 기본값이고 실제 커밋에 기록된다', async () => {
    expect(resolveCoAuthor({}, {})).toBe('Claude Opus 5.5 <noreply@anthropic.com>');
    expect(resolveCoAuthor({}, { COMMIT_CO_AUTHOR: '환경 <env@example.test>' })).toBe('환경 <env@example.test>');
    expect(resolveCoAuthor({ 'co-author': 'CLI <cli@example.test>' }, { COMMIT_CO_AUTHOR: '환경' })).toBe('CLI <cli@example.test>');
    expect(() => resolveCoAuthor({ coAuthor: '이름\n다른 줄' })).toThrow(/한 줄/);
    const root = fixture();
    stage(root, 'A', '01', { [source('A')]: [draft('a', 2)] });
    await applyStaged({ ...options(root), coAuthor: '실행 주체 <runner@example.test>' });
    expect(git(root, 'log', '-1', '--format=%B')).toMatch(/\n\nCo-Authored-By: 실행 주체 <runner@example.test>$/);
  });

});
