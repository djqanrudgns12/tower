import kit from '../kit.module.css';
import css from './screens.module.css';

/** 사용 설명서: 준비→배치→전투→회복을 짧은 문장으로(PRD §2). */
export function GuideScreen({ onBack }: { onBack(): void }) {
  return (
    <main className={css.page}>
      <div className={`${kit.board} ${css.card}`}>
        <h1 className={css.title}>사용 설명서</h1>
        <section className={css.stack}>
          <h2 className={css.h2}>한 판은 이렇게 돌아가요</h2>
          <ol className={css.steps}>
            <li><strong>준비 문제</strong>: 첫 웨이브는 5문제, 그다음은 3문제를 풀어요. 맞히면 골드를 받아요.</li>
            <li><strong>타워 놓기</strong>: 빈 돌 받침을 누르고 타워를 고른 뒤 ‘설치’를 눌러요. 원 안의 밝은 길까지 공격해요.</li>
            <li><strong>전투 시작</strong>: 준비가 되면 ‘전투 시작’을 눌러요. 싸우는 동안에도 문제를 풀고 타워를 놓을 수 있어요.</li>
            <li><strong>성문 회복</strong>: 웨이브를 버티면 성문이 다시 튼튼해져요. 성문이 0이 되면 판이 끝나요.</li>
          </ol>
        </section>
        <section className={css.stack}>
          <h2 className={css.h2}>골드와 점수</h2>
          <p><strong>골드</strong>는 타워를 사고 강화하는 데 써요. <strong>점수</strong>는 기록이라 쓰지 않아요.</p>
          <p>틀리면 점수가 줄어 0보다 작아질 수도 있어요. 골드와 성문은 줄지 않아요.</p>
          <p><strong>모르겠어요</strong>를 누르면 점수가 줄지 않아요. 대신 골드도 없고, 정답과 뜻을 알려 줘요.</p>
          <p>전투 중에 세 문제를 연달아 맞히면 <strong>버닝</strong>이 켜져 8초 동안 타워가 더 빨리 공격해요.</p>
        </section>
        <section className={css.stack}>
          <h2 className={css.h2}>타워 다루기</h2>
          <p>타워를 누르면 강화할 수 있어요. 레벨 3이 될 때 두 길 중 하나로 진화해요. 한 번 고른 길은 바꿀 수 없어요.</p>
          <p>판매하면 낸 골드의 60%를 돌려받아요.</p>
          <p>5, 10, 15웨이브처럼 5의 배수 웨이브에는 강한 적이 와요. 버티면 골드를 더 받아요.</p>
        </section>
        <section className={css.stack}>
          <h2 className={css.h2}>잠시 멈추기</h2>
          <p>오른쪽 위 정지 버튼을 누르면 모든 것이 멈추고 문제는 가려져요. ‘저장하고 나가기’로 나중에 이어할 수 있어요.</p>
        </section>
        <button type="button" className={`${kit.button} ${kit.primary}`} onClick={onBack}>처음으로</button>
      </div>
    </main>
  );
}
