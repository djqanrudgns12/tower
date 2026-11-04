// 홈·새 게임·설정·결과·오답 노트 화면의 새 문구(R5 세션 C). copy.ts는 메인 소유라 이 폴더에 두고 P4에서 메인이 합칠지 정한다.
// 용어는 ui-rules-v4 §6(평이한 말)을 지킨다. tests/unit/terms.test.ts 금지어를 쓰지 않는다.
import { cleanNickname } from '../../copy';

/** 새 게임 창(N1·N2). 닉네임 줄은 창 맨 아래 시작 줄 안에 있다. */
export const NEWGAME_COPY = {
  nickname: '닉네임',
  change: '바꾸기',
  changeLabel: '닉네임 바꾸기',
  /** 닉네임이 비었을 때 시작을 막는 이유. */
  needNickname: '닉네임을 정하면 시작할 수 있어요',
} as const;

/** 새 게임 창이 보일 닉네임과, 시작을 막는 이유(없으면 null). 비면 안내 문구, 규칙에 어긋나면 그 규칙 문구를 쓴다. */
export function nickProblemOf(raw: string): { nickname: string; problem: string | null } {
  const { value, error } = cleanNickname(raw);
  return { nickname: value, problem: error === null ? null : value === '' ? NEWGAME_COPY.needNickname : error };
}

/** 설정 창(S1·S2): 소제목 3개와 한 줄 설명. 이름·조작 문구는 copy.ts의 SETTINGS_COPY를 그대로 쓴다. 설명은 공백 포함 20자 미만으로 짧게(상시 문장 셈에 들지 않게). */
export const SETTINGS_SECTIONS = {
  sound: '소리',
  display: '화면·글자',
  records: '기록',
  /** 기본값인 고르기 칸 글자 아래 작게 붙는 표식. */
  base: '(기본)',
  baseSr: '기본',
  motionHint: '정지는 모든 움직임을 멈춰요',
  contrastHint: '길과 받침에 진한 선을 그려요',
} as const;

/** 결과 화면(R1·R2). 퍼센트·숙련도는 쓰지 않는다(PRD §20.5). */
export const RESULT_EXTRA = {
  /** 접기 머리글. 열면 푼 문제·모르겠어요·만난 낱말이 나온다. */
  logTitle: '이번 판 기록',
  solved: '푼 문제',
  skipped: '모르겠어요',
  words: '만난 낱말',
  /** 개수 단위. */
  unit: '개',
  /** 틀리거나 '모르겠어요'로 넘긴 낱말 카드(결과 오른쪽 창)의 제목. */
  missedTitle: '틀린 낱말',
  /** 한 문제도 틀리지 않고 넘기지도 않은 판에 한 줄 더하는 칭찬. */
  perfect: '한 문제도 틀리지 않았어요',
} as const;

/** 오답 노트(O1). */
export const NOTE_EXTRA = {
  /** 빈 상태 그림 자리의 읽기 이름은 비워 두고 안내 글만 읽힌다. */
  emptyHint: '문제를 풀다 틀리거나 모르겠어요를 누르면 여기에 담겨요',
} as const;
