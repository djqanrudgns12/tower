import { isDeepStrictEqual } from 'node:util';
import type { LevelAssessment, LevelFlag } from '../../src/contracts/levels';
import type { QuestionDraft } from '../../src/contracts/questionDraft';
import type { DifficultyTier } from '../../src/contracts/questions';
import { isCurrentLevelAssessment, relativeDifficulty, tierForGrade } from './levels';

export interface UpwardShare {
  /** 원본 참조. ID·원학년·revision·본문·difficultyTier를 고치지 않는다. */
  readonly question: QuestionDraft;
  readonly targetGrade: number;
  readonly difficultyTier: DifficultyTier;
  readonly flags: readonly LevelFlag[];
}

export interface GradeSharingSelection {
  readonly ownApprovedCount: number;
  /** 자기 승인 1,000개 미만이면 0, 그 외에는 floor(자기 승인 수 * 24 / 100). */
  readonly limit: number;
  readonly shared: readonly UpwardShare[];
}

/** 중복은 한 번만 센다. 최신 revision의 서로 다른 초안은 어느 쪽도 택하지 않는다. */
function uniqueLatest(drafts: readonly QuestionDraft[]): QuestionDraft[] {
  const byId = new Map<string, { question: QuestionDraft; conflict: boolean }>();
  for (const q of drafts) {
    const previous = byId.get(q.id);
    if (!previous || q.revision > previous.question.revision) {
      byId.set(q.id, { question: q, conflict: false });
    } else if (q.revision === previous.question.revision && !isDeepStrictEqual(q, previous.question)) {
      previous.conflict = true;
    }
  }
  return [...byId.values()]
    .filter(({ question: q, conflict }) => !conflict && Number.isInteger(q.grade)
      && q.grade >= 3 && q.grade <= 6 && Number(q.id[1]) === q.grade
      && !/^g[3-6]-practice-/.test(q.id))
    .map(({ question }) => question)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * §3.3/3.4의 위로 한 학년 공유만 계산한다. 파일 IO·은행 변경·공개 승인 판단은 하지 않는다.
 *
 * approvedLatestDrafts는 호출부가 기존 공개 승인 레지스트리와 최신 초안을
 * ID/revision/contentHash로 대조하고 철회를 반영한 정규 문항 집합이어야 한다.
 * `approved`는 이 선행 조건의 이름이며 승인 증명이나 새 승인 경로가 아니다.
 * 수준 평가 통과, candidate 승인, 초안 status만으로 이 입력을 구성하면 안 된다.
 * 이 함수는 외부의 미승인 최신 revision이나 철회를 발견할 수 없다.
 *
 * 자기 수는 원학년의 고유 승인 초안에서만 구한다(수준 평가 유무와 별개).
 * 연습 문항·공유 유입은 분모에서 제외한다. 입력에 과거 revision이 섞여도
 * 최고 revision만 쓰며, 최신 초안 충돌은 집계·공유 모두에서 제외한다.
 * 현재 revision 평가가 없거나 하나라도 유효하지 않거나 서로 다른 수준 해시라면
 * 공유하지 않는다. 과거 revision 평가로 되돌아가지 않는다.
 *
 * ID의 코드 단위 오름차순으로 상한까지 선택한다. 배열·판정자 순서를 포함해
 * 입력은 변경하지 않으며, 결과의 원본 문항 참조도 호출부에서 변경하지 않아야 한다.
 * 받는 학년 tier/flags는 별도 반환하므로 은행 변환은 후속 W5 통합이 맡는다.
 */
export function selectUpwardShares(
  targetGrade: number,
  approvedLatestDrafts: readonly QuestionDraft[],
  assessments: readonly LevelAssessment[],
): GradeSharingSelection {
  if (!Number.isInteger(targetGrade) || targetGrade < 3 || targetGrade > 6) {
    throw new RangeError('받는 학년은 3~6학년이어야 한다');
  }
  const drafts = uniqueLatest(approvedLatestDrafts);
  const ownApprovedCount = drafts.filter(q => q.grade === targetGrade).length;
  const limit = ownApprovedCount < 1000 ? 0 : Math.floor(ownApprovedCount * 24 / 100);
  const shared: UpwardShare[] = [];
  if (limit === 0 || targetGrade === 3) return { ownApprovedCount, limit, shared };

  const byRevision = new Map<string, LevelAssessment[]>();
  for (const item of assessments) {
    const key = `${item.questionId}@${item.revision}`;
    const items = byRevision.get(key);
    if (items) items.push(item);
    else byRevision.set(key, [item]);
  }
  for (const q of drafts) {
    if (q.grade !== targetGrade - 1) continue;
    const items = byRevision.get(`${q.id}@${q.revision}`) ?? [];
    const level = items[0];
    if (!level || !items.every(item => isCurrentLevelAssessment(q, item)
      && item.levelAssessmentHash === level.levelAssessmentHash)) continue;
    const { rule, band, L, T, flags } = level.merged;
    if (rule !== 3 || targetGrade < band.min || targetGrade > band.max
      || relativeDifficulty(targetGrade, L, T) < 0
      || level.precomputed.stdictSpecialized || flags.includes('stdictSpecialized')
      || flags.includes('elementaryFit') || level.judges.some(j => j.elementaryFit !== 'pass')) continue;
    const target = tierForGrade(targetGrade, L, T, q.variantTag ?? 'standard', level.precomputed.readingLoad);
    shared.push({ question: q, targetGrade, difficultyTier: target.tier, flags: target.flags });
    if (shared.length === limit) break;
  }
  return { ownApprovedCount, limit, shared };
}
