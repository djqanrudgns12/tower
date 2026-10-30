import { useEffect, useRef, useState } from 'react';
import type { PauseReason } from '../../domain/types';
import type { FontScale } from '../../application/session';
import { PAUSE_COPY, RENDER_WAIT } from '../copy';
import kit from '../kit.module.css';
import css from './PauseOverlay.module.css';

interface Props {
  reasons: PauseReason[];
  /** 화면(WebGL)이 아직 돌아오지 않았다. ‘계속’을 막되 포커스는 받도록 aria-disabled를 쓴다. */
  renderLost: boolean;
  /** 이 판을 저장할 수 있다(연습 판·저장 불가 브라우저는 false). */
  canSave: boolean;
  fontScale: FontScale;
  soundOn: boolean;
  /** 마지막 저장이 실패했다. */
  saveError: boolean;
  onResume(): void;
  onFont(scale: FontScale): void;
  onSound(on: boolean): void;
  /** 저장이 끝나야 true. 실패하면 false이고 화면을 떠나지 않는다(PRD §12.7, §14.1). */
  onSaveExit(): Promise<boolean>;
  /** 같은 상태를 다시 저장한다. 성공하면 true. */
  onRetrySave(): Promise<boolean>;
  onQuit(): void;
  onLeaveUnsaved(): void;
}

type Mode = 'storage' | 'blocked' | 'normal';

/** 불투명 정지층. 문제·보기·해설은 이 층이 열린 동안 DOM에서 빠진다(PRD §3.6, §12.7). */
export function PauseOverlay(p: Props) {
  const first = useRef<HTMLButtonElement>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocked = p.reasons.includes('STORAGE') || p.reasons.includes('OWNERSHIP') || p.reasons.includes('NUMERIC_LIMIT');
  const main = blocked ? p.reasons.find(r => r === 'STORAGE' || r === 'OWNERSHIP' || r === 'NUMERIC_LIMIT')! : p.reasons[p.reasons.length - 1] ?? 'USER';
  const mode: Mode = p.reasons.includes('STORAGE') ? 'storage' : blocked ? 'blocked' : 'normal';

  // 열릴 때 포커스를 받고 닫힐 때 돌려준다.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);
  // 저장 실패처럼 열린 채 내용이 바뀌면 누른 단추가 사라지므로 새 첫 단추로 옮긴다.
  useEffect(() => {
    first.current?.focus();
  }, [mode]);

  const saveExit = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await p.onSaveExit().catch(() => false);
    setBusy(false);
    if (!ok) setFailed(true);
  };
  const retry = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await p.onRetrySave().catch(() => false);
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <div className={css.layer} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={`${kit.board} ${css.box}`}>
        <h2 id="pause-title" className={css.title}>{blocked ? '잠깐만요' : '일시정지'}</h2>
        <p>{p.renderLost && !blocked ? RENDER_WAIT : PAUSE_COPY[main]}</p>
        {mode === 'storage' ? (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} disabled={busy} aria-busy={busy} onClick={retry}>
              {busy ? '저장하는 중…' : '다시 저장하기'}
            </button>
            {failed && <p className={kit.reason} role="status">아직 저장되지 않았어요. 잠시 뒤 다시 눌러 주세요.</p>}
            <button type="button" className={`${kit.button} ${kit.quietWood}`} disabled={busy} onClick={p.onLeaveUnsaved}>저장하지 않고 나가기</button>
            <p className={kit.muted}>저장하지 않고 나가면 마지막으로 저장된 곳까지만 이어할 수 있어요.</p>
          </div>
        ) : mode === 'blocked' ? (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary}`} onClick={p.onLeaveUnsaved}>처음 화면으로</button>
          </div>
        ) : (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} aria-disabled={p.renderLost || undefined} onClick={() => { if (!p.renderLost) p.onResume(); }}>계속하기</button>
            <fieldset className={css.fonts}>
              <legend>글자 크기</legend>
              {(['base', 'large', 'xlarge'] as const).map((f, i) => (
                <label key={f} className={css.font}>
                  <input type="radio" name="font" checked={p.fontScale === f} onChange={() => p.onFont(f)} />
                  {['보통', '크게', '아주 크게'][i]}
                </label>
              ))}
            </fieldset>
            <label className={css.font}>
              <input type="checkbox" checked={p.soundOn} onChange={e => p.onSound(e.target.checked)} />
              소리
            </label>
            {p.canSave && (
              <button type="button" className={`${kit.button} ${kit.quietWood}`} disabled={busy} aria-busy={busy} onClick={saveExit}>
                {busy ? '저장하는 중…' : '저장하고 나가기'}
              </button>
            )}
            {(failed || p.saveError) && <p className={kit.reason} role="status">아직 저장되지 않았어요. 다시 눌러 주세요.</p>}
            {confirmQuit ? (
              <div className={css.confirm}>
                <p>이번 판을 끝낼까요? 지금까지의 점수가 기록돼요.</p>
                <div className={css.row}>
                  <button type="button" className={`${kit.button} ${kit.danger}`} onClick={p.onQuit}>끝내기</button>
                  <button type="button" className={`${kit.button} ${kit.quietWood}`} onClick={() => setConfirmQuit(false)}>취소</button>
                </div>
              </div>
            ) : (
              <button type="button" className={`${kit.button} ${kit.quiet}`} onClick={() => setConfirmQuit(true)}>이번 판 끝내기</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
