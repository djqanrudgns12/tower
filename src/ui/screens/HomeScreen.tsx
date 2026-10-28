import type { LoadResult, Settings } from '../../application/session';
import kit from '../kit.module.css';
import css from './screens.module.css';

interface Props {
  saved: LoadResult | null;
  message: string | null;
  settings: Settings;
  onNew(): void;
  onResume(): void;
  onPractice(): void;
  onRecords(): void;
  onGuide(): void;
  onSettings(patch: Partial<Settings>): void;
}

/** 첫 화면: 활성 저장이 있으면 이어하기를 먼저 보인다. 손상된 저장은 조용히 지우지 않고 알린다(PRD §12.2). */
export function HomeScreen({ saved, message, settings, onNew, onResume, onPractice, onRecords, onGuide, onSettings }: Props) {
  const canResume = saved?.kind === 'ok';
  // 처음 온 학생에게는 연습을 먼저 권한다. 건너뛰어도 되고, 나중에 ‘연습하기’로 다시 볼 수 있다(PRD §12.2).
  const suggestPractice = !canResume && !settings.practiceSeen;
  return (
    <main className={css.page}>
      <div className={`${kit.board} ${css.card}`}>
        <div className={css.stack}>
          <h1 className={css.title}>어휘력 타워 디펜스</h1>
          <p className={css.subtitle}>낱말 문제를 풀어 골드를 모으고, 타워로 성문을 지켜요.</p>
        </div>
        {message && <p className={css.notice} role="status">{message}</p>}
        {saved?.kind === 'corrupt' && <p className={css.notice} role="status">저장된 판이 손상되어 이어할 수 없어요. 새 게임을 시작하면 지금 기록은 그대로 남아요.</p>}
        <div className={css.stack}>
          {canResume && (
            <button type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} onClick={onResume}>
              이어하기 · {saved.state.config.nickname} · {Math.max(1, saved.state.wave)}웨이브
            </button>
          )}
          {suggestPractice && (
            <button type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} onClick={onPractice}>처음이라면 연습부터</button>
          )}
          <button type="button" className={`${kit.button} ${canResume || suggestPractice ? '' : kit.primary} ${kit.big}`} onClick={onNew}>새 게임</button>
          <div className={css.row}>
            {!suggestPractice && <button type="button" className={kit.button} onClick={onPractice}>연습하기</button>}
            <button type="button" className={kit.button} onClick={onGuide}>사용 설명서</button>
            <button type="button" className={kit.button} onClick={onRecords}>내 기록</button>
          </div>
        </div>
        <fieldset className={css.stack} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className={css.h2}>설정</legend>
          <div className={css.row} role="radiogroup" aria-label="글자 크기">
            {(['base', 'large', 'xlarge'] as const).map((f, i) => (
              <button key={f} type="button" role="radio" aria-checked={settings.fontScale === f} className={css.choice} onClick={() => onSettings({ fontScale: f })}>
                <span className={css.choiceLabel}>{['글자 보통', '글자 크게', '글자 아주 크게'][i]}</span>
              </button>
            ))}
          </div>
          <label className={css.row} style={{ alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={settings.reducedMotion} onChange={e => onSettings({ reducedMotion: e.target.checked })} style={{ width: 20, height: 20 }} />
            움직이는 효과 줄이기
          </label>
        </fieldset>
        <p className={kit.muted}>지금 문제들은 개발용이에요. 정식 문제는 검수를 마친 뒤 들어가요.</p>
      </div>
    </main>
  );
}
