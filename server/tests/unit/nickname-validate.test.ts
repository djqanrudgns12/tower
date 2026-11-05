import { describe, expect, it } from 'vitest';
import { cleanPublicNickname } from '../../../src/contracts/lobby';
import { cleanServerNickname } from '../../src/nickname';
import { minimumDurationMs, parseVerificationRules } from '../../src/rules';
import { canonicalJson, parseAnswers, parseRankingParams, parseRunId, parseTimestamp } from '../../src/validate';

describe('서버 별명 판정(clean_public_nickname)', () => {
  it('SQL 회귀 시험의 경우', () => {
    expect(cleanServerNickname('１２３４５６')).toBeNull();
    expect(cleanServerNickname('a@b.kr')).toBeNull();
    expect(cleanServerNickname('a.com')).toBeNull();
    expect(cleanServerNickname('친구１２')).toBe('친구12');
    expect(cleanServerNickname('👨‍👩‍👧‍👦'.repeat(2))).not.toBeNull();
    expect(cleanServerNickname('👨‍👩‍👧‍👦'.repeat(12))).not.toBeNull();
    expect(cleanServerNickname('👨‍👩‍👧‍👦')).toBeNull();
    expect(cleanServerNickname('👨‍👩‍👧‍👦'.repeat(13))).toBeNull();
    expect(cleanServerNickname('﻿솔\u0085방울 ')).toBe('솔방울');
  });

  it('전화번호·주소·바이트 상한·타입·짝 없는 대리 문자', () => {
    for (const bad of ['010 1234 5678', '02-123-4567', 'https://x', 'www.abc', 'see me@home', 'x'.repeat(4097), '\uD800가나', 12, null, undefined]) {
      expect(cleanServerNickname(bad), String(bad)).toBeNull();
    }
    expect(cleanServerNickname('  다람쥐  ')).toBe('다람쥐');
    expect(cleanServerNickname('Kim 2024')).toBe('Kim 2024');
  });

  it('흔한 별명에서는 앱 계약(cleanPublicNickname)과 같은 판정을 낸다', () => {
    for (const nick of ['솔방울', '도토리왕', 'ABC', '하늘🌙', '반장 3번', '１２３', '가', 'a.b', '010-1234-5678', '  은행잎 ', '🇰🇷🇰🇷']) {
      const client = cleanPublicNickname(nick);
      const server = cleanServerNickname(nick);
      expect(server === null, nick).toBe(client.error !== null);
      if (server !== null) expect(server).toBe(client.value);
    }
  });
});

describe('입력 검사', () => {
  it('판 ID는 UUID만 받고 소문자로 맞춘다', () => {
    expect(parseRunId('55555555-5555-4555-8555-55555555AAAA')).toBe('55555555-5555-4555-8555-55555555aaaa');
    expect(parseRunId('not-uuid')).toBeNull();
    expect(parseRunId(5)).toBeNull();
  });

  it('종료 시각은 시간대가 적힌 ISO 8601만 받는다', () => {
    expect(parseTimestamp('2026-11-05T01:02:03.456Z')).toBe(Date.parse('2026-11-05T01:02:03.456Z'));
    expect(parseTimestamp('2026-11-05T10:02:03+09:00')).toBe(Date.parse('2026-11-05T01:02:03Z'));
    expect(parseTimestamp('2026-11-05')).toBeNull();
    expect(parseTimestamp('yesterday')).toBeNull();
  });

  it('답안은 필드·타입·정수 범위·개수를 본다(regrade_run_answers 입력 검사)', () => {
    const ok = { encounterId: 1, questionId: 'q', revision: 1, choice: 'a', phase: 'prep', wave: 1 };
    expect(parseAnswers([ok])).toHaveLength(1);
    expect(parseAnswers([{ ...ok, choice: null }])).toBeNull();
    expect(parseAnswers([{ ...ok, encounterId: -1 }])).toBeNull();
    expect(parseAnswers([{ ...ok, wave: 1.5 }])).toBeNull();
    expect(parseAnswers([{ ...ok, revision: 2 ** 31 }])).toBeNull();
    const { phase: _phase, ...missing } = ok;
    void _phase;
    expect(parseAnswers([missing])).toBeNull();
    expect(parseAnswers(Array.from({ length: 1601 }, () => ok))).toBeNull();
    expect(parseAnswers({})).toBeNull();
  });

  it('같은 제출은 객체 키 순서가 달라도 같은 해시 입력이 된다(jsonb와 같다)', () => {
    expect(canonicalJson([{ b: 1, a: [{ d: 2, c: 3 }] }])).toBe(canonicalJson([{ a: [{ c: 3, d: 2 }], b: 1 }]));
    expect(canonicalJson([1, 'x', null])).toBe('[1,"x",null]');
  });

  it('랭킹 조건: RPC 기본값(8·0)과 범위', () => {
    const base = 'p_tab=single_score&p_grade=3&p_difficulty=Normal&p_period=all_time';
    expect(parseRankingParams(new URLSearchParams(base))).toEqual({ tab: 'single_score', grade: 3, difficulty: 'Normal', period: 'all_time', limit: 8, offset: 0 });
    expect(parseRankingParams(new URLSearchParams(`${base}&p_limit=50&p_offset=10000`))).toMatchObject({ limit: 50, offset: 10000 });
    expect(parseRankingParams(new URLSearchParams(`${base}&p_limit=0`))).toBeNull();
    expect(parseRankingParams(new URLSearchParams(`${base}&p_offset=-1`))).toBeNull();
  });
});

describe('웨이브 최소 시간', () => {
  it('Normal 1웨이브는 23마리 × 1450ms, 2웨이브까지는 + 23 × 1300ms', () => {
    const rules = parseVerificationRules('{"correctPt":15,"wrongPt":-8,"waveKillPtCap":30,"bossPt":20,"bossEvery":5,"firstPrep":5,"laterPrep":2,"countBase":24,"countStep":1,"countEvery":3,"countMax":64,"spawnOverrides":{"1":1450,"2":1300,"3":1150},"spawnMin":650,"spawnBase":950,"spawnStep":-15}');
    expect(minimumDurationMs(rules, 1)).toBe(23 * 1450);
    expect(minimumDurationMs(rules, 2)).toBe(23 * 1450 + 23 * 1300);
    // 4웨이브: 24 + floor(3/3) = 25마리, 간격 max(650, 950 - 45) = 905ms
    expect(minimumDurationMs(rules, 4) - minimumDurationMs(rules, 3)).toBe(24 * 905);
  });
});
