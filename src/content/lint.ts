import type { DialectRegion, DifficultyTier, OptionId, VariantTag } from '../contracts/questions';
import { readingLoad } from '../contracts/questions';

// 기계 검사(PRD §9.2~9.3). 스키마가 증명하지 못하는 의미 규칙을 문항별·배치별 문제 목록으로 돌려준다.
// 정답의 유일성은 증명하지 못한다. 그것은 독립 검토의 몫이다.
export interface LintInput {
  id: string;
  grade: number;
  type: string;
  difficultyTier?: DifficultyTier | undefined;
  variantTag?: VariantTag | undefined;
  dialectRegion?: DialectRegion | undefined;
  target: { lemma: string; senseKey?: string | undefined };
  stem: string;
  options: Array<{ id: OptionId; text: string }>;
  correctOptionId: OptionId;
  explanation: string;
  distractorRationales: Partial<Record<OptionId, string>>;
}

const BANNED = ['완벽', '놀라운', '대단해', '최고야', '바보', '틀렸지', '모든 것', '위의 모든', '정답 없음', '보기 중 없음'];
const SPACING_ERRORS = /받아적|귀기울|[할갈볼될알줄살]수있|[할갈볼될알줄살]\s수있|[할갈볼될알줄살]수\s있|[할갈볼될알줄살]수없|[할갈볼될알줄살]\s수없|[할갈볼될알줄살]수\s없/;
const TRIVIA_DIALECT = /방언은 무엇|사투리는 무엇|어느 지역 방언|어느 고장 말/;
const HARD_META_LOW_GRADE = [
  '사교성', '흡족', '능숙', '단념', '기개', '체념', '일축', '배척', '간파',
  '타당성', '보편성', '특수성', '담론', '이념', '귀납', '연역', '함의', '수렴', '절충',
];
const HARD_META_GRADE3_ONLY = [
  '인과', '논증', '객관적', '주관적', '합리적', '비판적', '일관성', '형평성', '추상적',
];
const HARD_META_ALL_ELEMENTARY = [
  '형이상학', '사변적', '당위성', '귀결', '천착', '작위적', '편협',
  '변증법', '인식론', '존재론', '유물론', '관념론', '헤게모니', '패러다임', '아포리아',
  '음운 변동', '형태소', '통사론', '관형사절', '보문소', '소급효', '기속력', '정합성',
];
const GRADE_ABS_READING_LOAD: Record<number, number> = { 3: 98, 4: 112, 5: 126, 6: 140 };
const GRADE_BATTLE_READING_LOAD: Record<number, number> = { 3: 70, 4: 80, 5: 90, 6: 100 };
const STEM_STOPWORDS = new Set([
  '다음', '문장', '문장에', '문장의', '문장에서', '밑줄', '낱말', '낱말과', '낱말의', '알맞은', '고르세요', '빈칸', '빈칸에',
  '들어갈', '비슷한', '반대', '바르게', '사용한', '뜻으로', '뜻을', '말로', '가장', '것을', '것은', '무엇일까요',
  '선생님', '선생님이', '선생님께서', '친구들', '친구들과', '친구가', '친구에게', '할머니', '할머니께서', '할아버지', '할아버지께서',
  '어머니', '아버지', '동생이', '동생과', '언니가', '누나가', '오빠가', '형이', '우리가', '모두가',
]);

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

  // 정답만 유난히 길거나 짧은 보기는 힌트가 된다(PRD §9.2, QR-001/002 교훈).
  const lens = texts.map(hangul);
  const correctIdx = q.options.findIndex(o => o.id === q.correctOptionId);
  const correctLen = lens[correctIdx] ?? 0;
  const others = lens.filter((_, i) => i !== correctIdx);
  if (others.length && correctLen > Math.max(...others) * 1.5 && correctLen - Math.max(...others) >= 4) issues.push('정답 보기만 눈에 띄게 길다');
  if (others.length && correctLen > 0 && Math.min(...others) > correctLen * 1.6 && Math.min(...others) - correctLen >= 4) issues.push('정답 보기만 눈에 띄게 짧다');

  // 보기 문장 부호·어미 일관성 검사.
  const punctCount = texts.filter(t => /[.?!]$/.test(t)).length;
  if (punctCount > 0 && punctCount < 4) issues.push('보기 마침표·문장 부호 형식이 통일되지 않았다');
  if (punctCount === 0 && correctIdx >= 0) {
    const endsDa = texts.map(t => t.endsWith('다'));
    const endsYo = texts.map(t => t.endsWith('요'));
    if (endsDa.filter(Boolean).length === 1 && endsDa[correctIdx]) issues.push('정답 보기만 ~다 어미로 끝난다');
    if (endsDa.filter(Boolean).length === 3 && !endsDa[correctIdx]) issues.push('정답 보기만 ~다 어미가 아니다');
    if (endsYo.filter(Boolean).length === 1 && endsYo[correctIdx]) issues.push('정답 보기만 ~요 어미로 끝난다');
    if (endsYo.filter(Boolean).length === 3 && !endsYo[correctIdx]) issues.push('정답 보기만 ~요 어미가 아니다');
  }

  if (q.type === 'definition' && !q.stem.includes(q.target.lemma)) issues.push('뜻 문제 지문에 목표 낱말이 없다');
  if (q.type === 'cloze' && !/\(\s+\)/.test(q.stem)) issues.push('빈칸 문제에 ‘(    )’ 빈칸이 없다');
  if (q.type === 'usage' && texts.some(t => !/[.?!]$/.test(t))) issues.push('바른 사용 보기는 완결된 문장이어야 한다');
  if (/않지 않|없지 않/.test(q.stem)) issues.push('이중 부정');
  const echo = q.explanation.replace(/[‘’'"]/g, '');
  if (echo.trim() === `${q.target.lemma}는 ${q.target.lemma}`) issues.push('표제어를 되풀이하는 해설');

  // 난이도·방언 확장 규칙(고난도 게이트 및 문맥 제공 강제).
  if (q.variantTag === 'dialect') {
    if (q.difficultyTier !== 'challenge') issues.push('방언 문항은 difficultyTier가 challenge여야 한다');
    if (!q.dialectRegion) issues.push('방언 문항은 dialectRegion이 있어야 한다');
    if (hangul(q.stem) < 14 || TRIVIA_DIALECT.test(q.stem)) issues.push('방언 문항은 암기식 질문 대신 대화·상황 문맥을 주어야 한다');
  }
  if (q.difficultyTier === 'challenge' && !q.variantTag) {
    issues.push('challenge 문항은 variantTag를 명시해야 한다');
  }
  for (const hard of HARD_META_ALL_ELEMENTARY) {
    if (all.includes(hard)) issues.push(`초등 수준 초과 어휘: ${hard}`);
  }
  return issues;
}

/**
 * 대량 생성 배치(Q50-* 등)에 추가로 적용하는 엄격 품질 검사.
 * 기존 파일럿 배치(Q20-001~003)의 격리 사례(순환 정답, 저학년 어려운 한자어 풀이, 단서 노출, 중복 의미)를 사전 차단한다.
 */
export function lintBatchStrict(questions: readonly LintInput[]): string[] {
  const issues: string[] = [];
  const stems = new Set<string>();
  const senseTypes = new Set<string>();

  for (const q of questions) {
    for (const p of lintQuestion(q)) issues.push(`${q.id}: ${p}`);
    const fullText = [q.stem, q.explanation, ...q.options.map(o => o.text), ...Object.values(q.distractorRationales)].join(' ');
    if (SPACING_ERRORS.test(fullText)) issues.push(`${q.id}: 띄어쓰기 오류 의심 표현이 있다`);

    const normStem = q.stem.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (stems.has(normStem)) issues.push(`${q.id}: 배치 내 지문 중복`);
    stems.add(normStem);

    if (q.target.senseKey) {
      const key = `${q.grade}:${q.target.senseKey}:${q.type}`;
      if (senseTypes.has(key)) issues.push(`${q.id}: 같은 의미·같은 유형 중복(${key})`);
      senseTypes.add(key);
    }

    if (q.grade <= 4) {
      const metaText = [q.explanation, ...Object.values(q.distractorRationales), ...q.options.map(o => o.text)].join(' ');
      for (const word of HARD_META_LOW_GRADE) {
        if (!q.target.lemma.includes(word) && metaText.includes(word)) {
          issues.push(`${q.id}: ${q.grade}학년(3~4학년군)에 어려운 풀이·보기 어휘(${word})`);
        }
      }
      if (q.grade === 3) {
        for (const word of HARD_META_GRADE3_ONLY) {
          if (!q.target.lemma.includes(word) && metaText.includes(word)) {
            issues.push(`${q.id}: 3학년 수준 초과 추상 어휘(${word})`);
          }
        }
      }
    }

    const load = readingLoad(q);
    const absCap = GRADE_ABS_READING_LOAD[q.grade] ?? 100;
    if (load > absCap) {
      issues.push(`${q.id}: ${q.grade}학년 절대 읽기 부담 상한 초과(${load}음절 > ${absCap}음절)`);
    }

    // 4단계 난이도 티어별 엄격 일관성 검사(basic / core / advanced / challenge).
    if (q.difficultyTier === 'basic') {
      if (q.variantTag && q.variantTag !== 'standard') {
        issues.push(`${q.id}: basic 단계 문항은 variantTag=standard여야 한다(현재 ${q.variantTag})`);
      }
      const basicCap = (GRADE_BATTLE_READING_LOAD[q.grade] ?? 70) + 12;
      if (load > basicCap) {
        issues.push(`${q.id}: basic 단계 문항 읽기 부담 과다(${load}음절 > ${basicCap}음절)`);
      }
    }
    if (q.difficultyTier === 'core' && (q.variantTag === 'dialect' || q.variantTag === 'idiom_proverb')) {
      issues.push(`${q.id}: core 단계 문항에는 방언·관용/속담(${q.variantTag})을 넣지 않는다`);
    }
    if (q.difficultyTier === 'advanced' && q.variantTag === 'dialect') {
      issues.push(`${q.id}: 방언 문항은 advanced가 아닌 challenge여야 한다`);
    }

    // 뜻 문제에서 지문의 3음절 이상 내용어가 정답 보기에만 그대로 들어가면 표면 단서가 된다.
    if (q.type === 'definition') {
      const correctIdx = q.options.findIndex(o => o.id === q.correctOptionId);
      const correctText = q.options[correctIdx]?.text.normalize('NFC') ?? '';
      const wrongTexts = q.options.filter((_, i) => i !== correctIdx).map(o => o.text.normalize('NFC'));
      const lemmaRoot = q.target.lemma.normalize('NFC').replace(/하다$|되다$|스럽다$|롭다$|다$/, '');
      const tokens = q.stem.normalize('NFC').match(/[가-힣]{3,}/g) ?? [];
      for (const tok of tokens) {
        if (STEM_STOPWORDS.has(tok)) continue;
        if (lemmaRoot.length >= 2 && tok.includes(lemmaRoot)) continue;
        if (correctText.includes(tok) && wrongTexts.every(w => !w.includes(tok))) {
          issues.push(`${q.id}: 지문 단서어(${tok})가 정답 보기에만 그대로 반복된다`);
          break;
        }
      }
    }
  }

  if (questions.length >= 20) {
    const counts: Record<OptionId, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (const q of questions) counts[q.correctOptionId]++;
    const min = Math.floor(questions.length * 0.16);
    const max = Math.ceil(questions.length * 0.34);
    for (const id of ['a', 'b', 'c', 'd'] as const) {
      if (counts[id] < min || counts[id] > max) {
        issues.push(`정답 분포 편중: ${id}=${counts[id]}/${questions.length} (권장 ${min}~${max})`);
      }
    }
    const seq = questions.map(q => q.correctOptionId).join('');
    if (/aaaa|bbbb|cccc|dddd/.test(seq)) issues.push('같은 정답 번호가 4회 이상 연속된다');
    if (/(abcd){2}|(dcba){2}/.test(seq)) issues.push('규칙적인 순환 정답 패턴(abcdabcd 등)이 있다');
  }

  return issues;
}

export const loadOf = readingLoad;
