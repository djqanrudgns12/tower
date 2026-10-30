import { useLayoutEffect, useRef, useState } from 'react';
import type { PauseReason } from '../../domain/types';
import type { FontScale } from '../../application/session';
import { PAUSE_COPY, RENDER_WAIT } from '../copy';
import kit from '../kit.module.css';
import css from './PauseOverlay.module.css';

interface Props {
  reasons: PauseReason[];
  /** 화면(WebGL)이 아직 돌아오지 않았다. ‘계속’을 막되 포커스는 받도록 aria-disabled를 쓴다. */
  renderLost: boolean;
  canSave?: boolean;
  fontScale: FontScale;
  soundOn: boolean;
  saveError?: boolean;
  onResume(): void;
  onFont(scale: FontScale): void;
  onSound(on: boolean): void;
  onSaveExit?(): Promise<boolean>;
  onRetrySave?(): Promise<void>;
  onQuit(): void;
  onLeaveUnsaved(): void;
  /** 연 단추를 찾지 못했을 때(정지 층이 열리며 화면이 비활성화돼 포커스가 풀린 경우) 돌아갈 곳. */
  restoreFocus?(): void;
}

/** 불투명 정지층. 문제·보기·해설은 이 층이 열린 동안 DOM에서 빠진다(PRD §3.6, §12.7). */
export function PauseOverlay(p: Props) {
  const first = useRef<HTMLButtonElement>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocked = p.reasons.includes('STORAGE') || p.reasons.includes('OWNERSHIP') || p.reasons.includes('NUMERIC_LIMIT');
  const main = blocked ? p.reasons.find(r => r === 'STORAGE' || r === 'OWNERSHIP' || r === 'NUMERIC_LIMIT')! : p.reasons[p.reasons.length - 1] ?? 'USER';

  // 열 때 한 번만 첫 단추에 포커스를 주고, 닫으면 연 곳으로 돌려준다. 이유·글자 크기가 바뀌어도 다시 돌지 않는다.
  const box = useRef<HTMLDivElement>(null);
  const restore = useRef(p.restoreFocus);
  useLayoutEffect(() => { restore.current = p.restoreFocus; });
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    // 닫힐 때 정지 층이 먼저 빠지고 화면의 inert가 그 뒤에 풀리므로, 커밋이 끝난 다음 돌려준다.
    return () => queueMicrotask(() => {
      if (previous?.isConnected && previous !== document.body) previous.focus();
      if (document.activeElement === document.body || !document.activeElement) restore.current?.();
    });
  }, []);

  /** Tab은 정지 카드 안에서만 돈다. */
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? [])];
    if (items.length === 0) return;
    const head = items[0]!, tail = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
    else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
  };

  return (
    <div ref={box} className={css.layer} role="dialog" aria-modal="true" aria-labelledby="pause-title" onKeyDown={trap}>
      <div className={css.box}>
        <h2 id="pause-title" className={css.title}>{blocked ? '잠깐만요' : '일시정지'}</h2>
        <p>{p.renderLost && !blocked ? RENDER_WAIT : PAUSE_COPY[main]}</p>
        {p.reasons.includes('STORAGE') && p.onRetrySave ? (
          <div className={css.stack}>
            <button ref={first} type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} disabled={busy} aria-busy={busy} onClick={async () => { setBusy(true); await p.onRetrySave?.(); setBusy(false); }}>다시 저장하기</button>
            <button type="button" className={`${kit.button} ${kit.quietWood}`} onClick={p.onLeaveUnsaved}>저장하지 않고 나가기</button>
            <p className={kit.muted}>저장하지 않고 나가면 마지막으로 저장된 곳까지만 이어할 수 있어요.</p>
          </div>
        ) : blocked ? (
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
            {p.canSave && p.onSaveExit && (
              <button type="button" className={`${kit.button} ${kit.quietWood}`} disabled={busy} aria-busy={busy} onClick={async () => { setBusy(true); setFailed(false); const ok = await p.onSaveExit!(); setBusy(false); if (!ok) setFailed(true); }}>
                {busy ? '저장하는 중…' : '저장하고 나가기'}
              </button>
            )}
            {(failed || p.saveError) && <p className={kit.reason}>아직 저장되지 않았어요. 다시 눌러 주세요.</p>}
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
