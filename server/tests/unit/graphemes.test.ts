/**
 * supabase/tests/unicode-grapheme-regression.sql을 옮겼다. Unicode 17.0 GraphemeBreakTest.txt 전체를 그대로 읽는다.
 * Postgres 글은 NUL을 담을 수 없어 SQL 시험은 NUL 74건을 뺐다. JS 문자열은 담을 수 있으므로 766건 모두 본다.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { countGraphemes } from '../../src/graphemes';

interface Vector { text: string; expected: number; line: string; hasNul: boolean }

async function loadVectors(): Promise<Vector[]> {
  const raw = await readFile(new URL('../fixtures/GraphemeBreakTest.txt', import.meta.url), 'utf8');
  return raw.split('\n').filter(line => line.startsWith('÷')).map(line => {
    const spec = line.split('#')[0]!.trim();
    const codePoints = spec.split(/[÷×]/).map(s => s.trim()).filter(Boolean).map(hex => parseInt(hex, 16));
    const breaks = (spec.match(/÷/g) ?? []).length;
    return { text: String.fromCodePoint(...codePoints), expected: breaks - 1, line: spec, hasNul: codePoints.includes(0) };
  });
}

describe('사용자 인식 문자 수(UAX #29, Unicode 17)', () => {
  it('GraphemeBreakTest 766건(그중 NUL 없는 692건은 SQL 시험과 같은 집합)을 모두 맞힌다', async () => {
    const vectors = await loadVectors();
    expect(vectors).toHaveLength(766);
    expect(vectors.filter(v => !v.hasNul)).toHaveLength(692);
    const failures = vectors.filter(v => countGraphemes(v.text) !== v.expected).map(v => `${v.line} → ${countGraphemes(v.text)}`);
    expect(failures).toEqual([]);
  });

  it('한글 음절·자모, 국기, 피부색 이모지, 가족 이모지', () => {
    expect(countGraphemes('솔방울')).toBe(3);
    expect(countGraphemes('각')).toBe(1);
    expect(countGraphemes('🇰🇷🇯🇵')).toBe(2);
    expect(countGraphemes('👍🏽')).toBe(1);
    expect(countGraphemes('👨‍👩‍👧‍👦'.repeat(12))).toBe(12);
    expect(countGraphemes('')).toBe(0);
  });
});
