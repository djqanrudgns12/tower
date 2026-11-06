import { createHash } from 'node:crypto';
import type { LevelAssessment } from '../../src/contracts/levels';
import type { BankFile, BankQuestion, RetractionList } from '../../src/contracts/questions';
import { lintBatchForGrade } from '../../src/content/lint';
import { MIN_PUBLISHED, toBankQuestion, type BatchInput } from './bankBuild';
import { selectUpwardShares } from './gradeSharing';
import { buildSharingInputs } from './sharingInputs';

export type SharedBankQuestion = BankQuestion & { gradeBand?: LevelAssessment['merged']['band'] };
/** 런타임 계약 통합 전의 빌드 입력. 이 모듈은 파일을 쓰거나 은행을 공개하지 않는다. */
export type SharedBankPlan = Omit<BankFile, 'questions'> & { questions: SharedBankQuestion[] };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value)
    .filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError('은행 판 번호 입력은 JSON 값이어야 한다');
  return encoded;
}

/** 대상 학년과 실제 런타임 필드 전체를 묶는다. 원학년·본문이 같아도 다른 은행의 키와 섞이지 않는다. */
export function sharedBankVersion(grade: number, questions: readonly SharedBankQuestion[]): string {
  if (!Number.isInteger(grade) || grade < 3 || grade > 6) throw new RangeError('받는 학년은 3~6학년이어야 한다');
  const sorted = [...questions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return `pub-g${grade}-${createHash('sha256').update(canonical({ grade, questions: sorted })).digest('hex').slice(0, 12)}`;
}

/**
 * 원 검수 보고서·최신 판·철회에서 공개 입력을 다시 계산하고 위로 공유할 은행을 준비한다.
 * 현재 빌드/런타임에는 연결하지 않는다. 계약·키 생성기의 통합은 루프 정지 지점에서 한다.
 * 자기 문항 수와 공유 수는 분리하며, 같은 지문이나 받는 학년 검사에 걸린 공유는 제외한다.
 */
export function prepareSharedBank(batches: BatchInput[], assessments: readonly LevelAssessment[], retractions: RetractionList, grade: number): {
  bank: SharedBankPlan | null; ownApproved: number; shared: number; rejectedShares: { questionId: string; reasons: string[] }[];
} {
  const inputs = buildSharingInputs(batches, retractions);
  const selection = selectUpwardShares(grade, inputs.drafts, assessments);
  const ownApproved = selection.ownApprovedCount;
  const rejectedShares: { questionId: string; reasons: string[] }[] = [];
  if (ownApproved < MIN_PUBLISHED) return { bank: null, ownApproved, shared: 0, rejectedShares };
  const questions: SharedBankQuestion[] = inputs.drafts.filter(q => q.grade === grade).map(q => toBankQuestion(q, 'published'));
  const stemKey = (q: BankQuestion) => q.stem.normalize('NFC').replace(/\s+/g, ' ').trim();
  const stems = new Set(questions.map(stemKey));
  let shared = 0;
  for (const selected of selection.shared) {
    const q = selected.question;
    const projected = { ...toBankQuestion(q, 'published'), difficultyTier: selected.difficultyTier };
    // 정답 분포·연속 패턴은 원 제작 배치에서 이미 검사했다. 은행 풀은 출제 때 섞이므로 개별 문항의 받는 학년 조건을 검사한다.
    const reasons = lintBatchForGrade([projected], grade);
    if (stems.has(stemKey(projected))) reasons.push('받는 학년 은행의 지문과 중복');
    if (reasons.length) { rejectedShares.push({ questionId: q.id, reasons }); continue; }
    // 선택기가 동일 revision의 모든 평가·현재 해시·합의 띠를 대조했으므로 첫 평가를 재사용할 수 있다.
    const assessment = assessments.find(item => item.questionId === q.id && item.revision === q.revision)!;
    questions.push({ ...projected, gradeBand: { ...assessment.merged.band } });
    stems.add(stemKey(projected));
    shared++;
  }
  questions.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { bank: { bankId: `g${grade}`, bankVersion: sharedBankVersion(grade, questions), grade, status: 'published', questions },
    ownApproved, shared, rejectedShares };
}
