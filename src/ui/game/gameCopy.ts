/**
 * 전투 화면 새 문구(R5 P3 트랙 A). copy.ts는 메인 소유라 트랙 A의 새 글은 여기에 두고, P4에서 메인이 합칠지 정한다.
 * 용어는 ui-rules-v4 §6(평이한 말)을 따른다: tests/unit/terms.test.ts 금지어를 쓰지 않는다.
 */

// ── 문제판(B2·B3·B4·B14) ──
/** 정답 보상 미리보기 칩(view.stakes.correctGold). */
export const stakesGold = (gold: number) => `+${gold} 골드`;
/** 보상 미리보기 앞 작은 이름(휴대폰은 화면 읽기에만). */
export const STAKES_LABEL = '정답이면';
/** 정답 뒤 받은 골드 칩의 화면 읽기 앞말. */
export const EARNED_LABEL = '받은 골드';
/** 복습 문제 배지(view.question.isReview). */
export const REVIEW_BADGE = '복습';
export const REVIEW_BADGE_LABEL = '오답 노트 복습 문제';
/** 오답 뒤 정답 한 줄. */
export const answerLine = (text: string) => `정답은 ‘${text}’예요.`;
/** 해설 잠금 중 다음 문제 키 글자. */
export const readLock = (seconds: number) => `해설을 읽어 주세요 · ${seconds}초`;

// ── 준비 바·전장 쪽지(B5·B11) ──
export const NEXT_FOES = '다음 적';

// ── 상태 카드·웨이브 띠·타워 칸·일시정지(B6·B7·B12·B15) ──
// S1-COPY

// ── 진화·새 타워 창(B9·B13) ──
/** 진화 수치 칩(B9)의 새 능력: 한 번에 쏘는 화살·돌·매·포탄 수(계약 volley × burst.count). */
export const SHOTS_LABEL = '공격 횟수';
export const shotsValue = (n: number) => `${n}번`;
/**
 * 수치 칩의 화면 읽기(B9): 늘고 주는 것을 말로 먼저 읽는다(예: "공격 속도 줄어듦, 공격 간격 1초에서 1.2초").
 * 보이는 이름과 능력 이름이 같으면 이름을 한 번만 읽는다("공격력 줄어듦, 27.0에서 24.6").
 */
export const deltaSpeech = (ability: string, label: string, from: string, to: string, down: boolean) =>
  `${ability} ${down ? '줄어듦' : '늘어남'}, ${ability === label ? '' : `${label} `}${from}에서 ${to}`;
// S2-COPY
