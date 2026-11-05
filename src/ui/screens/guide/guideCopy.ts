// 사용 설명서 화면 조작 글(R5 트랙 B). copy.ts(메인 소유)의 GUIDE_COPY는 창 제목·'자세히'만 있다. P4에서 메인이 합칠지 정한다.
export const GUIDE_UI = {
  tocLabel: '사용 설명서 목차',
  toc: '목차',
  prev: '이전 장',
  next: '다음 장',
  pagerLabel: '장 넘기기',
  beatGroup: '한 판 단계 시연',
  outcomeGroup: '문제 결과별 변화',
  towerGroup: '시작 타워 사거리와 진화',
  difficultyGroup: '난이도별 성문·골드·낱말 범위',
  keyGroup: '보기 단축키',
  keyHint: (key: string) => `보기 ${key}번 고르기`,
  traitGroup: '적 특성',
  traitHead: '적 특성과 잘 잡는 타워',
  counterLead: '잘 잡는 타워',
} as const;
