import type { OptionId } from '../contracts/questions';
import { readingLoad } from '../contracts/questions';

// 기계 검사(PRD §9.2~9.3). 스키마가 증명하지 못하는 의미 규칙을 문항별 문제 목록으로 돌려준다.
// 정답의 유일성은 증명하지 못한다. 그것은 독립 검토의 몫이다.
export interface LintInput {
  id: string;
  grade: number;
  type: string;
  target: { lemma: string };
  stem: string;
  options: Array<{ id: OptionId; text: string }>;
  correctOptionId: OptionId;
  explanation: string;
  distractorRationales: Partial<Record<OptionId, string>>;
}

const BANNED = ['완벽', '놀라운', '대단해', '최고야', '바보', '틀렸지', '모든 것', '위의 모든', '정답 없음', '보기 중 없음'];
const hangul = (t: string) => (t.normalize('NFC').match(/[가-힣]/g) ?? []).length;

export function lintQuestion(q: LintInput): string[] {
  const issues: string[] = [];
  const texts = q.options.map(o => o.text.normalize('NFC').trim());
  if (new Set(texts).size !== 4) issues.push('보기 글이 겹친다');
  if (!q.options.some(o => o.id === q.correctOptionId)) issues.push('정답 ID가 보기에 없다');
  const wrong = q.options.map(o => o.id).filter(id => id !== q.correctOptionId).sort().join(',');
  if (Object.keys(q.distractorRationales).sort().join(',') !== wrong) issues.push('오답 이유는 오답 3개에 하나씩');
  if (!q.id.startsWith(`g${q.grade}-`)) issues.push('ID와 학년이 다르다');
  const sentences = q.explanation.split(/(?<=[.!?요다])\s+/).filter(Boolean).length;
  if (q.explanation.length > 60 || sentences > 2) issues.push(`해설은 1~2문장 60자 이내(${q.explanation.length}자)`);
  for (const [id, r] of Object.entries(q.distractorRationales)) if ((r ?? '').length > 60) issues.push(`오답 이유 ${id}가 60자를 넘는다`);
  const all = [q.stem, q.explanation, ...texts, ...Object.values(q.distractorRationales)].join(' ');
  for (const word of BANNED) if (all.includes(word)) issues.push(`금지 표현: ${word}`);
  // 정답만 유난히 긴 보기는 힌트가 된다(PRD §9.2).
  const lens = texts.map(hangul);
  const correctLen = lens[q.options.findIndex(o => o.id === q.correctOptionId)] ?? 0;
  const others = lens.filter((_, i) => q.options[i]!.id !== q.correctOptionId);
  if (others.length && correctLen > Math.max(...others) * 1.5 && correctLen - Math.max(...others) >= 4) issues.push('정답 보기만 눈에 띄게 길다');
  if (q.type === 'definition' && !q.stem.includes(q.target.lemma)) issues.push('뜻 문제 지문에 목표 낱말이 없다');
  if (q.type === 'cloze' && !/\(\s+\)/.test(q.stem)) issues.push('빈칸 문제에 ‘(    )’ 빈칸이 없다');
  if (q.type === 'usage' && texts.some(t => !/[.?!]$/.test(t))) issues.push('바른 사용 보기는 완결된 문장이어야 한다');
  if (/않지 않|없지 않/.test(q.stem)) issues.push('이중 부정');
  const echo = q.explanation.replace(/[‘’'"]/g, '');
  if (echo.trim() === `${q.target.lemma}는 ${q.target.lemma}`) issues.push('표제어를 되풀이하는 해설');
  return issues;
}

export const loadOf = readingLoad;
