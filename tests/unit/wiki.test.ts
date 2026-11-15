import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REPO_ROOT,
  applyDelta,
  computeGeneratedArtifacts,
  createLessonDelta,
  measureBudget,
  replaceAutoBlocks,
  reportCurateStatus,
  runLint,
  runQuery,
} from '../../tools/wiki/index.mjs';

describe('LLM Wiki 엔진 및 문서 무결성', () => {
  it('자동 생성 레지스트리 5종과 WIKI-AUTO 마커 계산이 결정적(바이트 멱등)이다', () => {
    const pass1 = computeGeneratedArtifacts(REPO_ROOT);
    const pass2 = computeGeneratedArtifacts(REPO_ROOT);
    expect([...pass1.files.keys()]).toEqual([...pass2.files.keys()]);
    for (const [rel, content1] of pass1.files.entries()) {
      expect(pass2.files.get(rel), `non-deterministic output: ${rel}`).toBe(content1);
    }
  });

  it('wiki:lint 검사(W01~W09 및 보존 해시)를 오류 0건으로 통과한다', () => {
    const res = runLint(REPO_ROOT, { strict: false });
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.checkedWikiPages).toBeGreaterThanOrEqual(20);
  });

  it('초기 탐색 컨텍스트 예산이 원천 전체 열람 대비 95% 이상 토큰을 절감한다', () => {
    const budget = measureBudget(REPO_ROOT);
    expect(budget.savingsPercent).toBeGreaterThanOrEqual(95);
    expect(budget.typicalStartChars).toBeLessThanOrEqual(7500);
  });

  it('wiki:query의 모든 주요 조회 플래그가 정확한 계약과 절을 반환한다', () => {
    const cases: Array<{ args: string[]; mustInclude: string }> = [
      { args: ['--toc', 'vocabulary_td_prd_v0_5.md'], mustInclude: '# TOC: vocabulary_td_prd_v0_5.md' },
      { args: ['--section', 'vocabulary_td_prd_v0_5.md', '13.2'], mustInclude: '<!-- 출처: vocabulary_td_prd_v0_5.md#L' },
      { args: ['--tower', 'archer'], mustInclude: '궁수탑' },
      { args: ['--enemy', 'flyer'], mustInclude: '비행' },
      { args: ['--map', 'garden_u'], mustInclude: '3학년' },
      { args: ['--bank'], mustInclude: '공개 문제은행 현황' },
      { args: ['--route', 'leaderboard'], mustInclude: '/v1/leaderboard' },
      { args: ['--table', 'standings'], mustInclude: 'WITHOUT ROWID' },
      { args: ['--decision', 'DEC-01'], mustInclude: 'AGENTS.md' },
      { args: ['--lessons', '--tag', 'cr1000'], mustInclude: 'L-TD-001' },
      { args: ['--glossary', 'BP'], mustInclude: '10000 BP' },
      { args: ['--grep', 'RunController'], mustInclude: 'RunController' },
    ];

    for (const c of cases) {
      const res = runQuery(c.args, REPO_ROOT);
      expect(res.code, `query failed: ${c.args.join(' ')}`).toBe(0);
      expect(res.output).toContain(c.mustInclude);
    }
  });

  it('replaceAutoBlocks가 지정된 마커만 치환하고 재실행 시 무변경을 보장한다', () => {
    const sample = [
      '# 제목',
      '<!-- WIKI-AUTO:START:repo-stats -->',
      '구버전 내용',
      '<!-- WIKI-AUTO:END:repo-stats -->',
      '보존 본문',
    ].join('\n');

    const first = replaceAutoBlocks(sample, { 'repo-stats': '- 최신 통계 1건' });
    expect(first.changed).toBe(true);
    expect(first.content).toContain('- 최신 통계 1건');
    expect(first.content).toContain('보존 본문');

    const second = replaceAutoBlocks(first.content, { 'repo-stats': '- 최신 통계 1건' });
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it('무충돌 교훈 델타(createLessonDelta) 생성 및 원장 병합(applyDelta) 라운드트립이 동작한다', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'td-wiki-test-'));
    try {
      fs.mkdirSync(path.join(tmpRoot, 'wiki/_data'), { recursive: true });
      fs.mkdirSync(path.join(tmpRoot, 'wiki/_inbox'), { recursive: true });
      fs.mkdirSync(path.join(tmpRoot, 'wiki/lessons'), { recursive: true });

      fs.writeFileSync(path.join(tmpRoot, 'AGENTS.md'), '# 규칙\n단일 폴더 작업\n', 'utf8');
      fs.writeFileSync(
        path.join(tmpRoot, 'wiki/_data/tags.json'),
        JSON.stringify({ tags: ['architecture', 'verification'] }, null, 2),
        'utf8',
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'wiki/_data/lesson-ids.json'),
        JSON.stringify({ ids: [] }, null, 2),
        'utf8',
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'wiki/lessons/engineering-and-content.md'),
        [
          '---',
          'id: lessons-eng-test',
          'type: lessons',
          'title: 테스트 원장',
          'status: active',
          'updated: 2026-11-16',
          '---',
          '',
          '# 테스트 원장',
          '',
          '## 수록 교훈',
          '',
        ].join('\n'),
        'utf8',
      );

      const created = createLessonDelta(
        {
          area: 'engineering',
          by: 'vitest',
          title: '테스트 교훈 규칙',
          when: '단위 시험 작성 시',
          rule: '임시 폴더에서 라운드트립을 검증한다.',
          why: '공유 원장 오염을 막기 위해서다.',
          check: 'npm run test',
          tags: 'architecture,verification',
          source: 'AGENTS.md#L1',
        },
        tmpRoot,
      );
      expect(created.kind).toBe('new_lesson');

      const beforeStatus = reportCurateStatus(tmpRoot);
      expect(beforeStatus.pending).toContain(created.relPath);

      const applied = applyDelta({ apply: created.relPath, new: true }, tmpRoot);
      expect(applied.action).toBe('created_lesson');
      expect(applied.id).toBe('L-TD-001');

      const hitDelta = createLessonDelta(
        {
          hit: 'L-TD-001',
          by: 'vitest',
          why: '규칙 재적중 확인',
          source: 'AGENTS.md#L2',
        },
        tmpRoot,
      );
      const hitApplied = applyDelta({ apply: hitDelta.relPath }, tmpRoot);
      expect(hitApplied.action).toBe('updated_counter');

      const ledgerText = fs.readFileSync(
        path.join(tmpRoot, 'wiki/lessons/engineering-and-content.md'),
        'utf8',
      );
      expect(ledgerText).toContain('### L-TD-001 · 테스트 교훈 규칙');
      expect(ledgerText).toContain('적중 2 · 위반 0 · 오탐 0');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
