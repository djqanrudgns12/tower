import { describe, expect, it } from 'vitest';
import { cleanPublicNickname, matchesRegradedRun, regradeRunAnswers, type SubmittedAnswer } from '../../../src/contracts/lobby';

const rules = { correctPt: 15, wrongPt: -8, firstPrep: 5, laterPrep: 2, waveKillPtCap: 30, bossPt: 20, bossEvery: 5 };
const keys = new Map([['q-a@1', 'a']]);
const answers: SubmittedAnswer[] = Array.from({ length: 5 }, (_,i) => ({ encounterId: i+1, questionId: 'q-a', revision: 1, choice: i===1?'b':i===2?'skipped':'a', phase: 'prep', wave: 1 }));

describe('공개 재채점 계약', () => {
  it('최초 선택을 다시 채점하며 클라이언트 정답 합계와 문항·처치 점수 변조를 거부한다', () => {
    const score = regradeRunAnswers(answers, keys, rules, 1, 1);
    expect(score).toEqual({ correct: 3, wrong: 1, skipped: 1, questionPt: 37 });
    expect(matchesRegradedRun({ pt: 67, correct: 3, wrong: 1, skipped: 1, endedWave: 1 }, score, rules)).toBe(true);
    expect(matchesRegradedRun({ pt: 67, correct: 4, wrong: 0, skipped: 1, endedWave: 1 }, score, rules)).toBe(false);
    expect(matchesRegradedRun({ pt: 68, correct: 3, wrong: 1, skipped: 1, endedWave: 1 }, score, rules)).toBe(false);
    expect(matchesRegradedRun({ pt: 67, correct: 3, wrong: 1, skipped: 1, endedWave: 1, activeTicks: 90 }, score, rules)).toBe(false);
    expect(matchesRegradedRun({ pt: 36, correct: 3, wrong: 1, skipped: 1, endedWave: 1 }, score, rules)).toBe(false);
  });
  it('중복 응답·잘못된 revision·단계·웨이브·미완 준비를 거부한다', () => {
    expect(regradeRunAnswers([...answers, {...answers[0]!,encounterId:6,wave:2,phase:'battle'}], keys, rules, 1, 2)).toBeNull();
    expect(regradeRunAnswers([...answers, answers[0]!], keys, rules, 1, 1)).toBeNull();
    expect(regradeRunAnswers(answers.map(a=>({...a, revision:2})), keys, rules, 1, 1)).toBeNull();
    expect(regradeRunAnswers(answers.slice(1), keys, rules, 1, 1)).toBeNull();
    expect(regradeRunAnswers(answers.map(a=>({...a, wave:2})), keys, rules, 1, 1)).toBeNull();
    expect(regradeRunAnswers([{...answers[0]!, phase:'battle'}, ...answers.slice(1)], keys, rules, 1, 1)).toBeNull();
  });
});

describe('공개 별명 정규화', () => {
  it('한글 NFC와 호환 문자·전각 숫자를 정규화하고 제어문자를 제거한다', () => {
    expect(cleanPublicNickname('  솔방울\u0000  ')).toEqual({value:'솔방울',error:null});
    expect(cleanPublicNickname('친구１２')).toEqual({value:'친구12',error:null});
  });
  it.each(['１２３４５６','010-1234-5678','a@b.kr','www.a.kr','http://a.kr','a.com'])('%s 개인정보·주소를 차단한다', value => {
    expect(cleanPublicNickname(value).error).not.toBeNull();
  });
});


describe('별명의 사용자 인식 문자 수', () => {
  it('결합 이모지·국기·결합 문자를 한 글자로 세어 2~12글자를 허용한다', () => {
    for (const unit of ['👨‍👩‍👧‍👦', '🇰🇷', '👍🏽', 'a\u0301', '각']) {
      expect(cleanPublicNickname(unit).error).not.toBeNull();
      expect(cleanPublicNickname(unit.repeat(2)).error).toBeNull();
      expect(cleanPublicNickname(unit.repeat(12)).error).toBeNull();
      expect(cleanPublicNickname(unit.repeat(13)).error).not.toBeNull();
    }
  });
});
