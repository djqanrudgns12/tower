import { contextFor, loadGradeContent } from '../content';
import { replaceUnavailableQuestion } from '../domain/run';
import { RUN_STATE_VERSION, type RunState } from '../domain/types';
import { RunController } from './RunController';

// 개발 빌드 전용 QA 장면 로더(화면 점검 장비 tools/qa·e2e 시험이 쓴다). 이어하기가 없으므로 원하는 웨이브·형태의 장면으로
// 바로 들어가는 길은 이것뿐이다. 장비가 RunState JSON을 sessionStorage에 넣고(page.addInitScript) `/?qaRun=1`로 열면
// 그 상태의 판이 정지된 채 열리고, '계속하기'를 누르면 흐른다.
// 호출하는 쪽(ui/App.tsx)이 `import.meta.env.DEV`로 감싸므로 운영 빌드에서는 이 모듈과 주소·키 이름이 번들에서 통째로 빠진다
// (tests/unit/map-preview.test.ts의 운영 번들 검사가 확인한다).

/** 로더를 켜는 주소 매개변수(`?qaRun=1`). */
export const QA_RUN_PARAM = 'qaRun';
/** 장면 상태(RunState JSON)를 담는 sessionStorage 키. 탭마다 따로라 다른 창의 점검과 섞이지 않는다. */
export const QA_RUN_KEY = 'vocabulary-td.qaRun';

/**
 * 장면 상태로 판을 연다. 지금 코드와 상태 버전이 같아야 한다. 정지 이유는 수치 한계만 남기고 학생 정지(USER)로 연다.
 * 끝나면 정규 판처럼 기록·오답 노트를 남겨 결과 화면까지 실제와 같게 보인다(점검 브라우저는 매번 빈 저장소다).
 */
export async function startQaRun(json: string): Promise<RunController> {
  const state = JSON.parse(json) as RunState;
  if (state.v !== RUN_STATE_VERSION) throw new Error(`QA 장면 상태 버전이 다르다: ${state.v} (지금 ${RUN_STATE_VERSION})`);
  await loadGradeContent(state.config.grade);
  const ctx = contextFor(state.config.grade, state.config.difficulty);
  // 장면을 만든 뒤 철회된 미제출 문항이 걸려 있으면 바꾼다(PRD §9.5).
  replaceUnavailableQuestion(ctx, state);
  state.pause = [...state.pause.filter(r => r === 'NUMERIC_LIMIT'), 'USER'];
  return new RunController(ctx, state, { recordOnFinish: true });
}

/** 주소에 `?qaRun=1`이 있으면 sessionStorage의 장면 상태로 판을 연다. 없으면 null. 개발 빌드가 아니면 늘 null이다. */
export function qaRunFromLocation(): Promise<RunController> | null {
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(window.location.search).get(QA_RUN_PARAM) !== '1') return null;
  const json = window.sessionStorage.getItem(QA_RUN_KEY);
  if (!json) throw new Error(`QA 장면 상태가 없다: sessionStorage '${QA_RUN_KEY}'`);
  return startQaRun(json);
}
